# TumorGen

A two-stage brain tumor segmentation project combining MedSAM localization with a 10 mm region-of-interest buffer and nnU-Net volumetric refinement. The repository includes training, inference, evaluation, and an interactive MRI visualization application.

[Live application](https://crimson-disk-92b1.sahniwesh.workers.dev/?case=UPENN-GBM-00002_11) · [Research workflow and results](https://crimson-disk-92b1.sahniwesh.workers.dev/?view=research) · [GitHub](https://github.com/niweshsah/TumorGen)

## Repository

| Directory | Purpose |
| --- | --- |
| `inference/` | MRI preprocessing and model inference |
| `training/` | MedSAM/LoRA, YOLO, and nnU-Net training |
| `evaluation/` | Segmentation metrics and CSV/JSON reports |
| `dataset/` | Local research datasets |
| `visualization-dataset/` | Public case preparation and prediction adapter |
| `web/` | React and TypeScript application |

## Run the website

Requires Node.js 22.12+, uv, and Python 3.11. From the repository root:

```bash
uv sync --project visualization-dataset --python 3.11
uv run --project visualization-dataset python visualization-dataset/prepare.py --count 40
cd web
npm ci
npm run dev -- --port 5183
```

Open `http://127.0.0.1:5183/`. Preparation downloads public MRI data and generates ignored assets in `web/public/data/`. Allow at least 500 MB for prepared assets, plus space for the source cache. Use `npm run build` for a production build.

The interactive library contains 40 public [UPenn-GBM / TCIA](https://doi.org/10.7937/TCIA.709X-DN49) cases under CC BY 4.0. Its Prediction masks are published automated segmentations; TumorGen weights are not integrated into this library. Case-level agreement is separate from the BraTS research results presented on the site.

See [web documentation](web/README.md) for controls, checks, and deployment, and [prediction integration](visualization-dataset/INTEGRATION.md) for connecting trained outputs.

Keep patient data, checkpoints, generated outputs, environments, and build artifacts out of Git.
