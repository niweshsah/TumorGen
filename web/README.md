# TumorGen web application

A React and TypeScript application for paired brain tumor segmentation review and scientific project documentation. The interface uses patient-derived MRI and segmentation geometry, synchronized camera controls, and a responsive light/dark workspace.

## Requirements and setup

Use Node.js 22.12 or later. From the repository root, prepare the public case library:

```bash
uv sync --project visualization-dataset --python 3.11
uv run --project visualization-dataset python visualization-dataset/prepare.py --count 40
cd web
npm ci
npm run dev -- --port 5183
```

Open `http://127.0.0.1:5183/`. The preparation script's default output is `web/public/data/`. Generated MRI, mask, mesh, thumbnail, and manifest files are excluded from Git and must be prepared locally. The build copies them into `dist/`; allow at least 500 MB for the prepared assets.

```bash
npm run build
npm run preview -- --port 4183
```

## Views and navigation

- **Compare:** synchronized Ground Truth and Prediction volumes, shared camera and rendering controls, agreement metrics, and three-plane MRI comparison.
- **Cases:** search, volume/agreement filters, ordering, thumbnails, and case selection.
- **Research:** two-stage methodology, BraTS experimental settings, complete model comparisons, training curves, qualitative examples, and research references.
- **Source:** case-library attribution and interpretation of the displayed agreement.

Use `?case=UPENN-GBM-00002_11` to select a case and `?view=research#results` to open experimental results. Browser history is supported. Switching Research/Compare preserves patient, camera, slices, modality, and rendering settings. Theme preference persists under the existing `tumorgen-redesign-theme` storage key for compatibility with previously deployed versions.

Drag to rotate, scroll to zoom, and right-drag to pan. Rendering controls include camera synchronization, reset, fullscreen, brain/tumor/mask opacity, tumor visibility, and MRI planes. Click an MRI slice or use arrow keys on its focused canvas to move the shared crosshair. Window/level changes affect display brightness only. Dialogs support Escape and restore focus; loading failures expose retry/reload controls.

## Scientific content and provenance

`src/research.ts` holds 28 whole-tumor and 24 per-label reported DSC values. Research describes a 10 mm ROI buffer, cross-entropy classification loss, and Tversky segmentation loss with α = 0.7 and β = 0.3. MedSAM uses decoder-side rank-4 LoRA adaptation on custom T1ce/T2/FLAIR pseudo-RGB slices. These scientific descriptions do not modify Python training defaults or recompute experimental results.

The interactive cohort contains 40 public [UPenn-GBM / TCIA](https://doi.org/10.7937/TCIA.709X-DN49) cases under CC BY 4.0, sourced from a pinned [MedOtter mirror](https://huggingface.co/datasets/MedOtter/UPENN-GBM) revision `662f85bd477f2f6306c0702d2e44301b716ae45c`. Ground Truth is expert-reviewed `images_segm`; prepared Prediction masks are separate `automated_segm` masks. Actual TumorGen weights are not integrated into this library. Research results and interactive case metrics are separate.

The viewer encodes background = 0, NCR = 1, ED = 2, ET = 4. WT = 1+2+4; TC = 1+4; ET = 4. Metrics are computed on original-resolution masks. Volume is voxel count × absolute affine determinant / 1000 in mL. Both-empty Dice/IoU are 1; undefined precision/recall are N/A. Exported JSON preserves true prediction provenance, including the compatible internal provider identifier.

Original scientific figures are in `public/research/`, with source metadata in `provenance.json`. Lato is self-hosted in `public/fonts/` under the included SIL Open Font License. No generated concept image replaces patient data.

## Prediction providers

The default provider uses prepared published masks. For trained outputs, follow [prediction integration](../visualization-dataset/INTEGRATION.md). Copy `.env.example` to `.env.local` and select HTTP mode only after starting the adapter:

```dotenv
VITE_PREDICTION_PROVIDER=http
VITE_PREDICTION_ENDPOINT=/api/predictions
TUMORGEN_API_URL=http://127.0.0.1:8001
```

The development server proxies `/api` to `TUMORGEN_API_URL`. Production hosting requires its own API routing if HTTP mode is enabled; the prepared static application does not require an inference server. Do not place secrets in `VITE_*` variables because those values are included in the browser bundle.

## Verification

```bash
npm run check
npm run lint
npm run format:check
npm test
npm run build
npx playwright install chromium
PLAYWRIGHT_TEST_BUILD=1 npm run test:e2e
```

Tests use port 4183 and require prepared data. Set `PLAYWRIGHT_EXECUTABLE_PATH` to use an existing Chromium-compatible browser. The scenarios cover camera controls, MRI navigation, case filtering, metrics, exports, error recovery, themes, Research content, history, and preserved viewing state.

## Deployment

Run `npm run build` and deploy the **contents of `dist/`**, including `assets`, `data`, `fonts`, and `research`, using the static-assets deployment method configured for the hosting service. Source folders and local dependency directories are not deployment artifacts. Preserve the SPA fallback to `index.html`.

Current application: https://crimson-disk-92b1.sahniwesh.workers.dev/

After deployment, verify `/`, `/?view=research#results`, `/?case=UPENN-GBM-00002_11`, figure requests, MRI assets, and both themes. Building locally does not publish or update the live deployment.

### GitHub deployment to the existing Worker

`.github/workflows/deploy-cloudflare.yml` prepares the pinned 40-case public cohort, runs the production build, and deploys static assets through Wrangler. The checked-in `wrangler.jsonc` names the existing `crimson-disk-92b1` Worker and enables SPA fallback for Research deep links. MRI files stay out of Git; Actions caches the downloaded source and generated case library.

Add `CLOUDFLARE_API_TOKEN` (Workers Scripts edit permission) and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions repository secrets. A push to `main` that changes `web/`, `visualization-dataset/`, or the deployment workflow triggers deployment. You can also run **Deploy TumorGen web** manually in GitHub Actions. The first deployment prepares the dataset and may take several minutes.
