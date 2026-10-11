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

## Research scripts

Use Python 3.10 with a compatible PyTorch/CUDA environment. Install `requirements.txt` after removing its non-installable `python>=3.10` entry; OpenCV and Ultralytics are also required. Configure local datasets and checkpoints, along with `nnUNet_raw_data_base`, `nnUNet_preprocessed`, and `RESULTS_FOLDER`.

```bash
python training/nnUnet/train.py --task_number 102 --task_name Task102_BratsMix --fold 0 --configuration 3d_fullres --trainer_class nnUNetTrainerV2
python inference/test.py
python evaluation/evaluation.py -ref /path/to/references -pred /path/to/predictions -l 1 2 3
```

Inference uses configured paths rather than a `--root_dir` argument; some scripts require local helper imports. The evaluator expects `BraTS-SSA*` case directories. Research labels are NCR = 1, ED = 2, ET = 3; the web adapter maps ET to 4. Preserve modality suffixes in T1, T1ce, T2, FLAIR order (`_0000`–`_0003`). Align training configuration with the reported experiments before reproduction.

## Cloudflare deployment

[GitHub Actions](.github/workflows/deploy-cloudflare.yml) prepares the public cases, builds `web/`, and deploys to the existing `crimson-disk-92b1` Worker. Add `CLOUDFLARE_API_TOKEN` (Workers Scripts edit permission) and `CLOUDFLARE_ACCOUNT_ID` under repository **Settings → Secrets and variables → Actions**. Deployment runs on relevant changes to `main` or through the manual **Deploy TumorGen web** action.

Keep patient data, checkpoints, generated outputs, environments, and build artifacts out of Git.
