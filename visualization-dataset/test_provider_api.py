"""Exercise the local adapter with a synthetic model-output fixture, not patient predictions."""

import io
import json
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import nibabel as nib
import numpy as np
import pytest

from prepare import save_volume


def test_local_provider_contract_and_artifact_access(tmp_path):
    case_id = "fixture-case"
    input_dir = tmp_path / "raw/images_structural" / case_id
    input_dir.mkdir(parents=True)
    predictions = tmp_path / "predictions"
    predictions.mkdir()
    data = np.zeros((8, 8, 8), dtype=np.uint8)
    data[2:5, 2:5, 2:5] = 3
    save_volume(
        np.ones(data.shape, dtype=np.uint8),
        np.eye(4),
        input_dir / f"{case_id}_T1GD.nii.gz",
    )
    save_volume(data, np.eye(4), predictions / f"{case_id}.nii.gz")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"cases": [{"id": case_id}]}))
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    command = [
        sys.executable,
        str(Path(__file__).with_name("serve_predictions.py")),
        "--predictions",
        str(predictions),
        "--raw",
        str(tmp_path / "raw"),
        "--manifest",
        str(manifest),
        "--artifacts",
        str(tmp_path / "artifacts"),
        "--port",
        str(port),
    ]
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(base, timeout=1)
            except urllib.error.HTTPError:
                break
            except urllib.error.URLError:
                if process.poll() is not None:
                    pytest.fail(process.stderr.read().decode())
                time.sleep(0.05)
        request = urllib.request.Request(
            base + "/api/predictions",
            data=json.dumps({"caseId": case_id}).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            artifact = json.load(response)
        assert artifact["shape"] == [8, 8, 8]
        assert artifact["labelMap"] == {"0": 0, "1": 1, "2": 2, "4": 4}
        assert artifact["provenance"]["kind"] == "tumorgen"
        with urllib.request.urlopen(base + artifact["maskUrl"]) as response:
            mask = nib.FileHolder(fileobj=io.BytesIO(response.read()))
        # Artifact is gzip-compressed NIfTI; inspect it from the prepared directory.
        assert mask.fileobj.getbuffer().nbytes > 0
        output = nib.load(tmp_path / "artifacts" / case_id / "prediction.nii.gz")
        assert set(np.unique(output.get_fdata())) == {0, 4}
        with urllib.request.urlopen(base + artifact["meshUrls"]["4"]) as response:
            assert response.read(4) == b"glTF"
        for path in [
            "/api/artifacts/%2e%2e/pyproject.toml",
            "/api/artifacts/missing.nii.gz",
        ]:
            with pytest.raises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(base + path)
            assert error.value.code == 404
        unknown = urllib.request.Request(
            base + "/api/predictions",
            data=b'{"caseId":"unknown"}',
            headers={"Content-Type": "application/json"},
        )
        with pytest.raises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(unknown)
        assert error.value.code == 404
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
