# Connecting actual TumorGen predictions

The visualization accepts a segmentation artifact, independently of how inference was performed. A frontend rebuild or environment switch selects the provider; the views do not need redesigning.

## 1. Run your trained pipeline on original MRI

Inference must consume the original MRI modalities under `visualization-dataset/data/raw/images_structural/<caseId>/`, not normalized files in `web/public/data/` and not reference annotations.

The research repository’s checkpoint integration points are:

- `inference/seg_file_using_medsam_yolo.py`: `run_medsam_yolo_pipeline` accepts `yolo_weights_path` and `medsam_ckpt_path`.
- `inference/masking_before_nnUnet.py`: `run_label_masking_pipeline` applies the predicted ROI to four modalities before final segmentation.
- `inference/nnunet_inference.py`: `run_nnunet_inference` selects the trained task/model/folds; point `RESULTS_FOLDER` to your nnU-Net v1 model directory.

Provide a deployment wrapper that accepts an original case directory and an output path, performs slice preprocessing without requiring reference labels, invokes your three stages, and writes a 3D NIfTI prediction with the MRI’s original affine. Translate UPenn modality names to the nnU-Net mapping: T1 → `_0000`, T1GD → `_0001`, T2 → `_0002`, FLAIR → `_0003`. Preserve RGB/BGR conventions used by your trained YOLO/MedSAM preprocessing.

The current research scripts contain machine-specific paths, preprocessing coupled to segmentation inputs, incomplete local SAM/util imports, and a LoRA training/inference checkpoint mismatch. These must be resolved in your trained deployment wrapper; the demo does not silently claim to repair or run unavailable weights. Missing slices must retain their original positions rather than being dropped during volume reconstruction. Always reuse MRI geometry instead of an identity-affine fallback.

## 2. Use the supplied local HTTP adapter

Save model outputs as `/path/to/tumorgen-predictions/<caseId>.nii.gz`, for example `UPENN-GBM-00002_11.nii.gz`. From the repository root:

```bash
uv run --project visualization-dataset python visualization-dataset/serve_predictions.py \
  --predictions /path/to/tumorgen-predictions \
  --label-scheme tumorgen
```

`tumorgen` maps `0,1,2,3` to the viewer’s `0,1,2,4`. Use `--label-scheme brats` for outputs already encoded `0,1,2,4`. The adapter validates geometry, exports canonical NIfTI and meshes, caches artifacts by source hash, and serves them on localhost:8001.

To invoke your inference wrapper when an output is missing:

```bash
uv run --project visualization-dataset python visualization-dataset/serve_predictions.py \
  --predictions /path/to/tumorgen-predictions \
  --label-scheme tumorgen \
  --command-json '["/path/to/inference-env/bin/python","/path/to/infer.py","--input","{input_dir}","--output","{output}"]'
```

The command receives only original MRI and output paths. It uses an argument array rather than a shell, serializes inference runs, and times out after 15 minutes. It does not receive expert masks. Manage the actual training/inference dependencies in a **separate uv environment** appropriate to your checkpoints; do not add GPU/training packages to `visualization-dataset/.venv`.

## 3. Select the HTTP frontend provider

From `web/`:

```bash
VITE_PREDICTION_PROVIDER=http \
TUMORGEN_API_URL=http://127.0.0.1:8001 \
npm run dev
```

Vite forwards `/api/` to the adapter. Alternatively copy `.env.example` to `.env.local`, set `VITE_PREDICTION_PROVIDER=http`, and restart Vite. Production deployments require same-origin reverse-proxy routing for `/api/`; Vite’s development proxy is not part of the compiled frontend.

To restore the published demo, unset the provider override or use `VITE_PREDICTION_PROVIDER=published`.

## Custom endpoint contract

Implement `POST /api/predictions` with JSON `{ "caseId": "UPENN-GBM-00002_11" }`. Return a completed artifact, not a pending job:

```json
{
  "maskUrl": "/api/artifacts/UPENN-GBM-00002_11/prediction.nii.gz",
  "meshUrls": {
    "1": "/api/artifacts/UPENN-GBM-00002_11/prediction-1.glb",
    "2": "/api/artifacts/UPENN-GBM-00002_11/prediction-2.glb",
    "4": "/api/artifacts/UPENN-GBM-00002_11/prediction-4.glb"
  },
  "shape": [240, 240, 155],
  "affine": [[1, 0, 0, -239], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
  "labelMap": { "0": 0, "1": 1, "2": 2, "4": 4 },
  "provenance": {
    "name": "TumorGen checkpoint <version>",
    "kind": "tumorgen",
    "description": "Your actual checkpoint and inference configuration",
    "sourceUrl": "https://github.com/niweshsah/TumorGen",
    "confidence": null
  }
}
```

The example affine is from the first prepared case; always return the actual numeric matrix matching the requested case manifest. NIfTI and mesh coordinates must use the same physical RAS frame. The frontend rejects incompatible grids; registration is the provider’s responsibility. GLBs contain physical-mm vertices, without extra scene transforms. Omit mesh entries for empty labels. If no prepared mesh exists for a present label, a worker generates a native-resolution boundary surface; offline marching-cubes GLBs are recommended for polished rendering.

For standalone conversion, import `export_prediction` from `visualization-dataset/prepare.py` and call it with the model output, original T1GD volume, output directory, and an explicit numeric label map. It returns artifact filenames; prefix them with URLs served by your backend and attach accurate provenance. `serve_predictions.py` is a runnable example of this integration.

## Scientific interpretation

Actual-provider metrics are recalculated against the loaded expert annotation. They describe this cohort and checkpoint; they are not evidence of unseen-type generalization without a documented training distribution and independent unseen-category evaluation. Exports record the active provider’s provenance. The required right-panel label remains “TumorGen Demo Prediction”; its status tag and source dialog distinguish demo versus model artifacts.
