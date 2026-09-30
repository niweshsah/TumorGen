# TumorGen

TumorGen investigates cross-dataset generalization in brain tumor segmentation using a two-stage, coarse-to-fine framework. YOLOv8m provides bounding-box prompts for MedSAM, and the resulting localization mask defines a region of interest for nnU-Net volumetric refinement.

The repository includes model training and inference scripts, segmentation evaluation utilities, and an interactive web application for reviewing MRI volumes and research results.

[Live application](https://crimson-disk-92b1.sahniwesh.workers.dev/) · [Research results](https://crimson-disk-92b1.sahniwesh.workers.dev/?view=research) · [Source repository](https://github.com/niweshsah/TumorGen)

## Methodology

1. **Multimodal preprocessing:** normalize spatially corresponding MRI slices and stack T1ce, T2, and FLAIR into a three-channel, pseudo-RGB representation.
2. **Initial localization:** use YOLOv8m bounding boxes to guide MedSAM segmentation.
3. **ROI definition:** reconstruct the segmentation volume, expand the mask with a 10 mm buffer, and apply the ROI to all four MRI modalities.
4. **Volumetric refinement:** process the masked MRI volumes with nnU-Net to obtain the final tumor segmentation.
5. **Evaluation:** compare predictions with reference annotations using whole-tumor and per-label Dice similarity coefficient (DSC).

MedSAM is adapted to a custom RGB-stacked MRI dataset through rank-4, decoder-side low-rank adaptation (LoRA), with the image encoder frozen. The reported research configuration uses cross-entropy for classification loss and Tversky loss for segmentation, with α = 0.7 and β = 0.3. The committed MedSAM training script currently uses different Tversky defaults; align the run configuration before attempting to reproduce these experiments. The ROI implementation approximates the physical margin through voxel-spacing-aware binary dilation rather than an exact Euclidean-distance expansion.

## Experimental results

Experiments use BraTS adult glioma, Sub-Saharan African (BraTS-SSA), and pediatric (BraTS-PED) datasets. The principal finding is improved whole-tumor segmentation on pediatric and SSA evaluation cohorts excluded from the corresponding training combinations, with uneven performance across individual tumor subregions.

| Evaluation cohort | Training cohorts         | nnU-Net baseline DSC | TumorGen pipeline DSC |
| ----------------- | ------------------------ | -------------------: | --------------------: |
| SSA               | Adult glioma + Pediatric |                 0.70 |                  0.76 |
| Pediatric         | Adult glioma + SSA       |                 0.12 |                  0.64 |
| Adult glioma      | Adult glioma + SSA       |                 0.92 |                  0.88 |
| Adult glioma      | Adult glioma + Pediatric |                 0.92 |                  0.87 |

The Research view includes all 28 whole-tumor and 24 per-label scores, model comparisons, training curves, and qualitative examples. These are reported experimental results, not scores recomputed by the website. Adult-glioma performance is lower than the listed baseline; whole-tumor improvements do not imply uniform improvement in NCR, ED, and ET segmentation. The available experiment documentation does not establish clinical effectiveness or provide uncertainty estimates.

## Repository structure

```text
TumorGen/
├── inference/                  # MRI preprocessing and model inference
├── training/
│   ├── medsam_finetune/        # MedSAM and LoRA training helpers
│   ├── nnUnet/                # nnU-Net preprocessing and training wrapper
│   └── yolo_finetune/          # YOLO dataset preparation
├── evaluation/                # Segmentation evaluation and CSV/JSON reports
├── dataset/                   # Local dataset location
├── visualization-dataset/                 # Public MRI preparation and prediction adapter
├── web/                       # React/TypeScript application and tests
└── requirements.txt           # Research Python dependencies
```

## Web application

The application provides synchronized Ground Truth and Prediction viewers, a 40-case browser, axial/coronal/sagittal MRI comparisons, segmentation metrics, JSON exports, and persistent light/dark themes. The Research view explains the scientific workflow and experimental results. Camera, patient, slice, and rendering state are preserved when switching views.

### Local setup

Use Node.js 22.12 or later, uv, and Python 3.11 for public-data preparation. This environment is separate from the research training environment.

```bash
uv sync --project visualization-dataset --python 3.11
uv run --project visualization-dataset python visualization-dataset/prepare.py --count 40
cd web
npm ci
npm run dev -- --port 5183
```

Open `http://127.0.0.1:5183/`. Preparation downloads public source data and writes generated assets to `web/public/data/`; these files are excluded from Git. Allow adequate space for the original MRI cache and at least 500 MB for the prepared application assets.

For an optimized build:

```bash
cd web
npm run build
npm run preview -- --port 4183
```

See [web application documentation](web/README.md) for controls, verification, and deployment. See [prediction integration](visualization-dataset/INTEGRATION.md) for connecting trained model outputs.

### Interactive data provenance

The interactive case library uses 40 public UPenn-GBM / TCIA cases under CC BY 4.0. Ground Truth comes from expert-reviewed annotations; the prepared Prediction masks come from separately released automated segmentations. Actual TumorGen weights are not integrated into that prepared library. Its case-level metrics are distinct from the BraTS experimental results above.

Original MRI geometry and source attribution are retained in preparation records and exported provenance. Expert annotations were reviewed and revised from automated masks, so agreement is descriptive rather than an independent clinical benchmark.

## Research environment and execution

Use Python 3.10 and a PyTorch/CUDA environment compatible with your hardware and the selected model packages. The research dependencies and scripts require environment-specific setup. The `python>=3.10` line in `requirements.txt` is an interpreter constraint, not an installable package; omit it when installing:

```bash
python3.10 -m venv .venv
source .venv/bin/activate
sed '/^python>=/d' requirements.txt > /tmp/tumorgen-requirements.txt
python -m pip install -r /tmp/tumorgen-requirements.txt
python -m pip install opencv-python ultralytics
```

Select the appropriate PyTorch build for your CUDA installation. Set `nnUNet_raw_data_base`, `nnUNet_preprocessed`, and `RESULTS_FOLDER` before nnU-Net workflows. Dataset directories and checkpoints must be supplied locally.

### Modality and label mappings

| nnU-Net suffix | MRI modality         |
| -------------- | -------------------- |
| `_0000.nii.gz` | T1-native            |
| `_0001.nii.gz` | Contrast-enhanced T1 |
| `_0002.nii.gz` | T2                   |
| `_0003.nii.gz` | FLAIR                |

Research scripts use label 0 for background, 1 for necrotic/non-enhancing tumor core (NCR), 2 for edema (ED), and 3 for enhancing tumor (ET). The web application uses BraTS-style encoding with ET = 4; the prediction adapter performs the required mapping.

### Training

```bash
python training/nnUnet/train.py \
  --task_number 102 \
  --task_name Task102_BratsMix \
  --fold 0 \
  --configuration 3d_fullres \
  --trainer_class nnUNetTrainerV2
```

MedSAM fine-tuning is configured in `training/medsam_finetune/lora_fine_tune.py`. Supply image/mask folders, split lists, the pretrained SAM checkpoint, and the output checkpoint directory. YOLO preparation scripts are under `training/yolo_finetune/`.

### Inference and evaluation

```bash
python inference/test.py
python evaluation/evaluation.py \
  -ref /path/to/reference_masks \
  -pred /path/to/predicted_masks \
  -l 1 2 3
```

Configure the inference script's dataset and checkpoint paths before execution; it does not implement a `--root_dir` argument. Some research scripts also depend on local model/helper imports and need integration work before use in another environment. The evaluator currently expects `BraTS-SSA*` case directories and writes `multilabel_evaluation.csv` and `.json` to the prediction directory.

## Verification

```bash
cd web
npm run check
npm run lint
npm run format:check
npm test
npm run build
npx playwright install chromium
PLAYWRIGHT_TEST_BUILD=1 npm run test:e2e
```

Browser tests require the prepared 40-case dataset and an available Chromium browser. An existing browser can be selected with `PLAYWRIGHT_EXECUTABLE_PATH`. Validate research-pipeline changes separately on representative MRI volumes, checking shape, affine orientation, label encoding, and per-label DSC.

## Data handling

Keep MRI volumes, patient data, trained checkpoints, generated predictions, local environments, caches, and build artifacts out of Git. The application’s source code, scientific figures, fonts and their license, test code, and configuration examples are version-controlled.

## References

- [MedSAM](https://github.com/bowang-lab/MedSAM)
- [nnU-Net](https://github.com/MIC-DKFZ/nnUNet)
- [YOLOv8](https://docs.ultralytics.com/models/yolov8/)
- [LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685)
- [Domain Game](https://arxiv.org/abs/2406.02125)
- [UPenn-GBM / TCIA dataset](https://doi.org/10.7937/TCIA.709X-DN49)
