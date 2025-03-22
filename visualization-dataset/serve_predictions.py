"""Local prediction-provider adapter. Serves aligned outputs; optionally invokes inference."""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from prepare import DEFAULT_OUTPUT, ROOT, atomic_json, export_prediction


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--predictions",
        type=Path,
        required=True,
        help="Directory containing <caseId>.nii.gz outputs",
    )
    parser.add_argument("--raw", type=Path, default=ROOT / "data/raw")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_OUTPUT / "manifest.json")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "data/provider-artifacts")
    parser.add_argument("--label-scheme", choices=["tumorgen", "brats"], default="tumorgen")
    parser.add_argument(
        "--command-json",
        help='Optional argv template, e.g. ["python","infer.py","--input","{input_dir}","--output","{output}"]',
    )
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    cases = {record["id"]: record for record in json.loads(args.manifest.read_text())["cases"]}
    command = json.loads(args.command_json) if args.command_json else None
    if command and (
        not isinstance(command, list) or not all(isinstance(item, str) for item in command)
    ):
        parser.error("--command-json must be an array of strings")
    label_map = (
        {0: 0, 1: 1, 2: 2, 3: 4} if args.label_scheme == "tumorgen" else {0: 0, 1: 1, 2: 2, 4: 4}
    )
    inference_lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def send_json(self, status, value):
            body = json.dumps(value).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if urlparse(self.path).path != "/api/predictions":
                self.send_json(404, {"error": "Unknown endpoint"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length < 8192:
                    self.send_json(400, {"error": "Invalid request length"})
                    return
                case_id = json.loads(self.rfile.read(length))["caseId"]
                if not isinstance(case_id, str) or case_id not in cases:
                    self.send_json(404, {"error": "Unknown case ID"})
                    return
                input_dir = args.raw / "images_structural" / case_id
                reference = input_dir / f"{case_id}_T1GD.nii.gz"
                mask = args.predictions / f"{case_id}.nii.gz"
                with inference_lock:
                    if not mask.exists() and command:
                        args.predictions.mkdir(parents=True, exist_ok=True)
                        argv = [
                            item.format(
                                input_dir=str(input_dir.resolve()),
                                output=str(mask.resolve()),
                                case_id=case_id,
                            )
                            for item in command
                        ]
                        subprocess.run(
                            argv, check=True, timeout=900
                        )  # argv only; no shell; no ground-truth input.
                    if not mask.exists():
                        self.send_json(404, {"error": "Prediction is not prepared for this case"})
                        return
                    key = hashlib.sha256(mask.read_bytes() + str(label_map).encode()).hexdigest()
                    output = args.artifacts / case_id
                    cached = output / "artifact.json"
                    artifact = json.loads(cached.read_text()) if cached.exists() else None
                    if not artifact or artifact.get("sourceHash") != key:
                        artifact = export_prediction(mask, reference, output, label_map)
                        prefix = f"/api/artifacts/{case_id}/"
                        artifact["maskUrl"] = prefix + artifact["maskUrl"]
                        artifact["meshUrls"] = {
                            label: prefix + url for label, url in artifact["meshUrls"].items()
                        }
                        artifact["sourceHash"] = key
                        artifact["provenance"] = {
                            "name": "TumorGen inference output",
                            "kind": "tumorgen",
                            "description": "Output supplied by the configured TumorGen prediction provider. No reference annotations are used as inference inputs.",
                            "sourceUrl": "https://github.com/niweshsah/TumorGen",
                            "confidence": None,
                        }
                        atomic_json(cached, artifact)
                self.send_json(200, artifact)
            except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
                self.send_json(422, {"error": str(error)})
            except Exception as error:
                self.log_error("Prediction failed: %s", error)
                self.send_json(500, {"error": "Prediction preparation failed; inspect server logs"})

        def do_GET(self):
            path = unquote(urlparse(self.path).path)
            prefix = "/api/artifacts/"
            if not path.startswith(prefix):
                self.send_json(404, {"error": "Unknown endpoint"})
                return
            root = args.artifacts.resolve()
            file = (root / path[len(prefix) :]).resolve()
            if (
                not file.is_relative_to(root)
                or file.suffix not in {".gz", ".glb"}
                or not file.is_file()
            ):
                self.send_json(404, {"error": "Artifact unavailable"})
                return
            self.send_response(200)
            self.send_header(
                "Content-Type",
                mimetypes.guess_type(str(file))[0] or "application/octet-stream",
            )
            self.send_header("Content-Length", str(file.stat().st_size))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            with file.open("rb") as stream:
                while content := stream.read(1024 * 1024):
                    self.wfile.write(content)

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Local provider: http://127.0.0.1:{args.port}/api/predictions", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
