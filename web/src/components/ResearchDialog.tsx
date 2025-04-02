import { useEffect, useRef } from 'react';
import { ArrowRight, ExternalLink, X } from 'lucide-react';
import type { Provenance } from '../types';

export function ResearchDialog({
  kind,
  provenance,
  onClose,
}: {
  kind: 'method' | 'provenance';
  provenance?: Provenance;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="research-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-body">
        <button className="dialog-close icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={19} />
        </button>
        <h2 id="dialog-title">
          {kind === 'method' ? 'Segmentation beyond the familiar.' : 'A transparent comparison.'}
        </h2>
        {kind === 'method' ? (
          <>
            <p className="dialog-lead">
              TumorGen investigates generalizable brain-tumor segmentation, with particular interest
              in tumor types absent from training.
            </p>
            <div className="method-pipeline">
              {['Multimodal MRI', 'YOLO + MedSAM', 'Dilated ROI', 'nnU-Net'].map((name, i) => (
                <div key={name}>
                  <span>0{i + 1}</span>
                  <strong>{name}</strong>
                  {i < 3 && <ArrowRight size={17} />}
                </div>
              ))}
            </div>
            <h3>How the repository works</h3>
            <p>
              T1 contrast, T2, and FLAIR are stacked into 2D images. YOLO detections supply
              bounding-box prompts to MedSAM. The reconstructed masks are dilated to retain
              surrounding tissue, then applied to MRI modalities before nnU-Net performs 3D
              segmentation.
            </p>
            <p>
              Training code includes rank-4 decoder LoRA fine-tuning of MedSAM with Tversky loss and
              AdamW, YOLO data preparation, and an nnU-Net preprocessing/training wrapper.
            </p>
            <h3>What this workspace demonstrates</h3>
            <p>
              Interactive review of real glioblastoma MRI and two separate segmentation sources.
              This single-category cohort and published predictions do not measure TumorGen
              performance on unseen tumor types. Actual TumorGen weights can be connected through
              the prediction provider.
            </p>
            <a
              className="external-link"
              href="https://github.com/niweshsah/TumorGen"
              target="_blank"
              rel="noreferrer"
            >
              Explore the research repository <ExternalLink size={14} />
            </a>
          </>
        ) : (
          <>
            <p className="dialog-lead">
              Real patient volumes. Expert-reviewed references. TumorGen Prediction.
            </p>
            <dl className="provenance-list">
              <div>
                <dt>Dataset</dt>
                <dd>UPenn-GBM · TCIA · CC BY 4.0</dd>
              </div>
              <div>
                <dt>Ground Truth</dt>
                <dd>Released expert-reviewed tumor annotations</dd>
              </div>
              <div>
                <dt>Prediction source</dt>
                <dd>TumorGen Prediction</dd>
              </div>
              <div>
                <dt>Prediction status</dt>
                <dd>
                  {provenance?.kind === 'tumorgen'
                    ? 'TumorGen provider'
                    : 'Published automated segmentation · TumorGen weights not integrated'}
                </dd>
              </div>
            </dl>
            <h3>Read the agreement in context</h3>
            <p>
              {provenance?.description ??
                'Published automated masks are compared with expert-reviewed annotations from the same cohort.'}
            </p>
            <p>
              The expert annotations were reviewed and revised from automated segmentations.
              Agreement is descriptive, not an independent estimate of clinical performance.
              Predictions are never copied or synthesized from the reference masks.
            </p>
            <h3>Reproducibility</h3>
            <p>
              Cases are selected deterministically. Preparation checks geometry and genuine mask
              differences and records source hashes. Metrics use the original-resolution grid and
              affine-derived voxel volumes; MRI brightness is normalized only for display.
            </p>
            <p>
              Empty-region Dice and IoU are 1 when both masks are empty. Precision or recall is N/A
              when its denominator is zero. Confidence is omitted because these released masks do
              not supply calibrated probabilities.
            </p>
            <a
              className="external-link"
              href={provenance?.sourceUrl ?? 'https://doi.org/10.7937/TCIA.709X-DN49'}
              target="_blank"
              rel="noreferrer"
            >
              Dataset and prediction attribution <ExternalLink size={14} />
            </a>
          </>
        )}
      </div>
    </dialog>
  );
}
