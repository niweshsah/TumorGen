"""Prepare real, cached UPenn-GBM comparison cases. Run with uv run prepare.py."""

from __future__ import annotations

import argparse
import hashlib
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import nibabel as nib
import numpy as np
import trimesh
from scipy import ndimage
from skimage import measure

from metrics import compute_metrics

REVISION = "662f85bd477f2f6306c0702d2e44301b716ae45c"
PREPARATION_VERSION = 2
SOURCE = "https://huggingface.co/datasets/MedOtter/UPENN-GBM/resolve/" + REVISION + "/"
ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUT = ROOT.parent / "web/public/data"
LABELS = {0, 1, 2, 4}
COLORS = {1: [245, 183, 96, 255], 2: [91, 177, 208, 255], 4: [238, 122, 135, 255]}


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2, allow_nan=False))
    temporary.replace(path)


def download(relative, cache):
    """Cache downloads atomically; retry failures without substituting data."""
    path = cache / relative
    if path.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(4):
        try:
            request = urllib.request.Request(
                SOURCE + relative, headers={"User-Agent": "TumorGen-Demo/1.0"}
            )
            with urllib.request.urlopen(request, timeout=90) as response:
                content = response.read()
            temporary = path.with_suffix(path.suffix + ".partial")
            temporary.write_bytes(content)
            temporary.replace(path)
            return path
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2**attempt)


def validate_labels(image, reference):
    values = image.get_fdata(dtype=np.float32)
    if values.shape != reference.shape or not np.allclose(
        image.affine, reference.affine, atol=1e-4
    ):
        raise ValueError("Mask and MRI geometry disagree; refuse unregistered overlays")
    if not np.isin(values, list(LABELS)).all():
        raise ValueError("Mask contains unknown or fractional labels")
    return values.astype(np.uint8)


def save_volume(data, affine, path):
    image = nib.Nifti1Image(data, affine)
    image.header.set_xyzt_units("mm")
    nib.save(image, path)


def surface(mask, affine, path, color, brain=False):
    """Surface in the same physical RAS coordinates as the NIfTI volumes."""
    if not np.any(mask):
        return None
    padded = np.pad(mask.astype(np.float32), 1)
    if brain:
        padded = ndimage.gaussian_filter(padded, 0.65)
    verts, faces, _, _ = measure.marching_cubes(padded, 0.5, step_size=1)
    verts = nib.affines.apply_affine(affine, verts - 1)
    mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
    budget = 65000 if brain else 24000
    if len(mesh.faces) > budget:
        mesh = mesh.simplify_quadric_decimation(face_count=budget)
    mesh.visual.vertex_colors = color
    mesh.export(path, file_type="glb")
    return path.name


def export_prediction(mask_path, reference_path, output, label_map=None):
    """Shared helper for future inference: aligned NIfTI -> viewer artifacts."""
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    reference = nib.as_closest_canonical(nib.load(reference_path))
    original = nib.load(mask_path)
    data = original.get_fdata(dtype=np.float32)
    if label_map:
        if not np.isin(data, list(label_map)).all():
            raise ValueError("Unmapped prediction labels")
        mapped = np.zeros(data.shape, dtype=np.uint8)
        for source, target in label_map.items():
            mapped[data == source] = target
        original = nib.Nifti1Image(mapped, original.affine)
    image = nib.as_closest_canonical(original)
    data = validate_labels(image, reference)
    save_volume(data, reference.affine, output / "prediction.nii.gz")
    meshes = {}
    for value in (1, 2, 4):
        name = surface(
            data == value,
            reference.affine,
            output / f"prediction-{value}.glb",
            COLORS[value],
        )
        if name:
            meshes[str(value)] = name
    return {
        "maskUrl": "prediction.nii.gz",
        "meshUrls": meshes,
        "shape": list(reference.shape),
        "affine": reference.affine.tolist(),
        "labelMap": {"0": 0, "1": 1, "2": 2, "4": 4},
    }


def prepare_case(subject, cache, output):
    case_id = subject["subject_id"]
    directory = output / "cases" / case_id
    record_path = directory / "case.json"
    if record_path.exists():
        record = json.loads(record_path.read_text())
        if (
            record.get("revision") == REVISION
            and record.get("preparationVersion") == PREPARATION_VERSION
        ):
            required = [
                *record["modalities"].values(),
                record["groundTruthUrl"],
                record["prediction"]["maskUrl"],
                record["brainMeshUrl"],
                *record["groundTruthMeshes"].values(),
                *record["prediction"]["meshUrls"].values(),
            ]
            if all((output / url.removeprefix("/data/")).is_file() for url in required):
                return record
    paths = list(subject["modalities"].values()) + [
        subject["manual_segm"],
        subject["automated_segm"],
    ]
    with ThreadPoolExecutor(max_workers=4) as pool:
        downloaded = dict(zip(paths, pool.map(lambda path: download(path, cache), paths)))
    mri = {
        modality: nib.as_closest_canonical(nib.load(downloaded[path]))
        for modality, path in subject["modalities"].items()
    }
    reference = mri["T1GD"]
    if len(reference.shape) != 3:
        raise ValueError("Expected 3D MRI")
    for image in mri.values():
        if image.shape != reference.shape or not np.allclose(
            image.affine, reference.affine, atol=1e-4
        ):
            raise ValueError("MRI modalities are not co-registered")
        if not np.isfinite(image.get_fdata(dtype=np.float32)).all():
            raise ValueError("MRI contains non-finite intensities")
        if image.header.get_xyzt_units()[0] != "mm":
            raise ValueError("Expected physical spacing in millimeters")
    gt = validate_labels(
        nib.as_closest_canonical(nib.load(downloaded[subject["manual_segm"]])),
        reference,
    )
    prediction = validate_labels(
        nib.as_closest_canonical(nib.load(downloaded[subject["automated_segm"]])),
        reference,
    )
    if not np.any(gt) or not np.any(prediction) or np.array_equal(gt, prediction):
        raise ValueError("Require nonempty, genuinely distinct masks")
    directory.mkdir(parents=True, exist_ok=True)
    prefix = f"/data/cases/{case_id}/"
    modalities = {}
    for name, image in mri.items():
        data = image.get_fdata(dtype=np.float32)
        nonzero = data[data > 0]
        if not nonzero.size:
            raise ValueError("Empty MRI")
        low, high = np.percentile(nonzero, [0.5, 99.5])
        display = np.clip((data - low) / max(high - low, 1e-6) * 255, 0, 255).astype(np.uint8)
        save_volume(display, image.affine, directory / f"{name}.nii.gz")
        modalities[name] = prefix + f"{name}.nii.gz"
    save_volume(gt, reference.affine, directory / "ground-truth.nii.gz")
    save_volume(prediction, reference.affine, directory / "prediction.nii.gz")
    brain = reference.get_fdata(dtype=np.float32) > 0
    brain = ndimage.binary_fill_holes(brain)
    components, count = ndimage.label(brain)
    if count:
        sizes = np.bincount(components.ravel())
        sizes[0] = 0
        brain = components == sizes.argmax()
    brain_mesh = surface(
        brain,
        reference.affine,
        directory / "brain.glb",
        [184, 201, 211, 255],
        brain=True,
    )
    gt_meshes, pred_meshes = {}, {}
    for value in (1, 2, 4):
        for mask, basename, collection in (
            (gt, "ground-truth", gt_meshes),
            (prediction, "prediction", pred_meshes),
        ):
            name = surface(
                mask == value,
                reference.affine,
                directory / f"{basename}-{value}.glb",
                COLORS[value],
            )
            if name:
                collection[str(value)] = prefix + name
    indices = np.argwhere(gt > 0)
    centroid = np.round(indices.mean(axis=0)).astype(int).tolist()
    # Real MRI thumbnail, not a generated illustration.
    thumbnail_image = nib.load(directory / "T1GD.nii.gz").get_fdata().astype(np.uint8)
    slice_image = thumbnail_image[:, :, centroid[2]][::-1, ::-1].T
    from imageio.v3 import imwrite

    imwrite(directory / "thumbnail.png", slice_image)
    metrics = compute_metrics(gt, prediction, reference.affine)
    record = {
        "id": case_id,
        "category": "Glioblastoma",
        "cohort": "UPenn-GBM",
        "revision": REVISION,
        "preparationVersion": PREPARATION_VERSION,
        "modalities": modalities,
        "shape": list(reference.shape),
        "affine": reference.affine.tolist(),
        "spacing": list(map(float, nib.affines.voxel_sizes(reference.affine))),
        "centroid": centroid,
        "brainMeshUrl": prefix + brain_mesh,
        "groundTruthUrl": prefix + "ground-truth.nii.gz",
        "groundTruthMeshes": gt_meshes,
        "thumbnailUrl": prefix + "thumbnail.png",
        "metrics": metrics,
        "differentVoxels": int(np.count_nonzero(gt != prediction)),
        "prediction": {
            "maskUrl": prefix + "prediction.nii.gz",
            "meshUrls": pred_meshes,
            "shape": list(reference.shape),
            "affine": reference.affine.tolist(),
            "labelMap": {"0": 0, "1": 1, "2": 2, "4": 4},
            "provenance": {
                "name": "Published UPenn-GBM automated segmentation",
                "kind": "demo",
                "description": "Released automated ensemble segmentation; not TumorGen inference. Expert reference annotations were revised from automated masks.",
                "sourceUrl": "https://doi.org/10.7937/TCIA.709X-DN49",
                "confidence": None,
            },
        },
        "sourceFiles": {
            path: hashlib.sha256(downloaded[path].read_bytes()).hexdigest() for path in paths
        },
    }
    atomic_json(record_path, record)
    return record


def validate_dataset(output):
    manifest = json.loads((output / "manifest.json").read_text())
    errors = []

    def local(url):
        return output / url.removeprefix("/data/")

    for record in manifest["cases"]:
        try:
            reference = nib.load(local(record["modalities"]["T1GD"]))
            gt = validate_labels(nib.load(local(record["groundTruthUrl"])), reference)
            pred = validate_labels(nib.load(local(record["prediction"]["maskUrl"])), reference)
            if np.array_equal(gt, pred):
                raise ValueError("Identical masks")
            calculated = compute_metrics(gt, pred, reference.affine)
            if calculated != record["metrics"]:
                raise ValueError("Stored metrics disagree")
            for url in [
                record["brainMeshUrl"],
                *record["groundTruthMeshes"].values(),
                *record["prediction"]["meshUrls"].values(),
            ]:
                if not local(url).exists():
                    raise ValueError("Missing mesh")
        except Exception as error:
            errors.append({"case": record["id"], "error": str(error)})
    report = {
        "cases": len(manifest["cases"]),
        "passed": len(manifest["cases"]) - len(errors),
        "errors": errors,
    }
    atomic_json(output / "validation.json", report)
    print(json.dumps(report), flush=True)
    if errors:
        raise SystemExit(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=40)
    parser.add_argument("--cache", type=Path, default=ROOT / "data/raw")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()
    if args.validate:
        validate_dataset(args.output)
        return
    if args.count < 1:
        parser.error("--count must be positive")
    manifest_path = download("subjects_manifest.json", args.cache)
    upstream = json.loads(manifest_path.read_text())
    subjects = sorted(
        (
            s
            for s in upstream["subjects"]
            if s["manual_segm"] and s["automated_segm"] and s["timepoint"] == "11"
        ),
        key=lambda s: s["subject_id"],
    )
    cases, rejected = [], []
    for subject in subjects:
        if len(cases) >= args.count:
            break
        print(f"[{len(cases) + 1}/{args.count}] {subject['subject_id']}", flush=True)
        try:
            cases.append(prepare_case(subject, args.cache, args.output))
        except Exception as error:
            print(f"Rejected {subject['subject_id']}: {error}", flush=True)
            rejected.append({"id": subject["subject_id"], "error": str(error)})
        atomic_json(
            args.output / "manifest.json",
            {
                "version": 1,
                "dataset": "UPenn-GBM",
                "revision": REVISION,
                "requestedCases": args.count,
                "license": "CC BY 4.0",
                "sourceUrl": "https://doi.org/10.7937/TCIA.709X-DN49",
                "labels": {
                    "0": "Background",
                    "1": "Necrotic / non-enhancing core",
                    "2": "Peritumoral edema",
                    "4": "Enhancing tumor",
                },
                "displayPreprocessing": "Canonical RAS, native voxel grid; MRI percentiles 0.5–99.5 normalized to uint8. Original intensities retained in raw cache.",
                "cases": cases,
                "rejected": rejected,
            },
        )
    if len(cases) < args.count:
        raise SystemExit(
            f"Only {len(cases)} valid cases; requested {args.count}. See manifest.rejected."
        )
    validate_dataset(args.output)


if __name__ == "__main__":
    main()
