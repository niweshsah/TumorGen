import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ExternalLink, Github, X, Maximize2 } from 'lucide-react';
import { experiments, models, dsc, REPOSITORY } from '../research';
const sections = [
  ['overview', 'Overview'],
  ['datasets', 'Datasets'],
  ['methodology', 'Methodology'],
  ['training', 'Training'],
  ['results', 'Results'],
  ['discussion', 'Discussion & references'],
];
const stages = [
  [
    'Multimodal MRI',
    'Input: spatially aligned T1-native, T1ce, T2, and FLAIR volumes. Normalize intensities and assemble T1ce/T2/FLAIR slices into a three-channel representation for localization.',
  ],
  [
    'YOLOv8m localization',
    'Input: three-channel MRI slices. Output: predicted tumor bounding boxes, supplying spatial prompts to MedSAM.',
  ],
  [
    'MedSAM segmentation',
    'Input: MRI slices and bounding-box prompts. Output: initial tumor masks, reconstructed in the volumetric MRI coordinate system.',
  ],
  [
    '10 mm ROI dilation',
    'Expand the initial tumor mask by a 10 mm buffer to retain peritumoral context. Apply the resulting ROI to all four MRI modalities.',
  ],
  [
    'nnU-Net refinement',
    'Input: ROI-masked multimodal volumes. Output: final volumetric tumor segmentation, with necrotic/non-enhancing core, edema, and enhancing-tumor labels.',
  ],
  [
    'Quantitative evaluation',
    'Compare predicted masks with reference annotations using whole-tumor and per-label Dice similarity coefficient (DSC). Preserve volume geometry and label definitions.',
  ],
];
const figures = [
  {
    file: 'image24.png',
    title: 'YOLOv8m optimization and detection metrics',
    caption:
      'Training and validation losses, precision, recall, and mean average precision across approximately 100 epochs. The project reports precision and recall above 0.93 on untrained tumor types; the displayed recall curve is lower, and the evaluation setting for that statement is unspecified.',
  },
  {
    file: 'image28.png',
    title: 'nnU-Net: adult glioma + pediatric training',
    caption:
      'Reported 1,000-epoch training configuration. Green: evaluation metric (DSC); blue: training loss; red: validation loss. This training curve is not an external-cohort performance estimate.',
  },
  {
    file: 'image21.jpg',
    title: 'nnU-Net: adult glioma + SSA training',
    caption:
      'Reported 1,000-epoch training configuration. Green: evaluation metric; blue: training loss; red: validation loss. Raw epoch logs are not supplied.',
  },
  {
    file: 'image29.png',
    title: 'Qualitative segmentation: slice 106',
    caption:
      'FLAIR input, prediction overlay, and Ground Truth overlay. The available qualitative example does not identify the patient or evaluation cohort for this example.',
  },
  {
    file: 'image39.png',
    title: 'Qualitative segmentation: slice 107',
    caption:
      'Adjacent FLAIR slice with prediction and Ground Truth overlays. These experimental examples are separate from the interactive UPenn-GBM case library.',
  },
];
function Figure({ index, onOpen }: { index: number; onOpen: (index: number) => void }) {
  const figure = figures[index];
  return (
    <figure className="research-figure">
      <button onClick={() => onOpen(index)} aria-label={`Enlarge ${figure.title}`}>
        <img src={`/research/${figure.file}`} loading="lazy" decoding="async" alt={figure.title} />
        <span>
          <Maximize2 size={16} /> Enlarge figure
        </span>
      </button>
      <figcaption>
        <strong>{figure.title}</strong>
        {figure.caption}
      </figcaption>
    </figure>
  );
}
function EnlargedFigure({ index, close }: { index: number; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="research-lightbox"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      aria-label={figures[index].title}
    >
      <button className="icon-button" onClick={close} aria-label="Close figure">
        <X />
      </button>
      <h2>{figures[index].title}</h2>
      <img src={`/research/${figures[index].file}`} alt={figures[index].title} />
      <p>{figures[index].caption}</p>
    </dialog>
  );
}
export function ResearchPage({ onCompare }: { onCompare: () => void }) {
  const [experiment, setExperiment] = useState(experiments[0].id);
  const opener = useRef<HTMLElement | null>(null);
  const openFigure = (index: number) => {
    opener.current = document.activeElement as HTMLElement;
    setEnlarged(index);
  };
  const closeFigure = () => {
    setEnlarged(null);
    requestAnimationFrame(() => opener.current?.focus());
  };
  const [enlarged, setEnlarged] = useState<number | null>(null);
  const current = experiments.find((item) => item.id === experiment)!;
  return (
    <main className="workspace research-page" id="research" tabIndex={-1}>
      <header className="research-header">
        <div>
          <h1>Brain tumor segmentation across cohorts</h1>
          <p>
            A two-stage, coarse-to-fine framework combining prompt-guided localization with
            volumetric refinement.
          </p>
        </div>
        <div className="research-actions">
          <button className="primary-button" onClick={onCompare}>
            Open comparison <ArrowRight size={16} />
          </button>
          <a className="secondary-button" href={REPOSITORY} target="_blank" rel="noreferrer">
            <Github size={17} /> GitHub
          </a>
        </div>
      </header>
      <nav className="research-sections" aria-label="Research sections">
        {sections.map(([id, title]) => (
          <a key={id} href={`#${id}`}>
            {title}
          </a>
        ))}
      </nav>
      <label className="research-mobile-nav">
        Jump to section
        <select
          defaultValue="overview"
          onChange={(e) => {
            window.location.hash = e.target.value;
            document.getElementById(e.target.value)?.focus();
          }}
        >
          {sections.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
      </label>
      <article className="research-article">
        <section id="overview" tabIndex={-1}>
          <h2>Research objective</h2>
          <p>
            Brain tumor segmentation models can lose accuracy when applied to imaging cohorts and
            tumor phenotypes that differ from their training data. TumorGen investigates whether
            explicit tumor localization followed by region-focused volumetric segmentation improves
            cross-dataset generalization.
          </p>
          <p>
            The project combines YOLOv8m, MedSAM, and nnU-Net to study this hypothesis across adult
            glioma, Sub-Saharan African (SSA), and pediatric cohorts. The central finding is
            improved whole-tumor segmentation on pediatric and SSA evaluation cohorts excluded from
            the corresponding training combinations. This improvement does not extend uniformly to
            individual tumor subregions, and does not establish clinical effectiveness.
          </p>
          <p className="research-attribution">
            Presented by Group 12 · Mentored by Anoushkrit Goel and Ankita Joshi · Presented to
            Prof. Aditya Nigam, Prof. Arnav Bhavsar, and faculty members.
          </p>
        </section>
        <section id="datasets" tabIndex={-1}>
          <h2>Datasets and experimental design</h2>
          <p>
            The experimental datasets were sourced from the Brain Tumor Segmentation (BraTS)
            datasets, covering adult glioma, Sub-Saharan African (BraTS-SSA), and pediatric brain
            tumors (BraTS-PED). Intracranial meningioma is discussed as background, but no
            quantitative meningioma evaluation is supplied. Each result below identifies its
            training combination and evaluation cohort.
          </p>
          <div className="research-table-wrap" tabIndex={0} aria-label="Experimental settings">
            <table>
              <caption>Reported training and evaluation configurations</caption>
              <thead>
                <tr>
                  <th scope="col">Evaluation cohort</th>
                  <th scope="col">Training cohorts</th>
                  <th scope="col">TumorGen whole-tumor DSC</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">{item.cohort}</th>
                    <td>{item.training}</td>
                    <td>{dsc(item.whole[1])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Adult glioma appears in the training combinations for its own evaluation settings; these
            results should not be described as evaluation on an unseen tumor category. Available
            experiment documentation does not specify cohort sizes, split membership, uncertainty
            estimates, or aggregation procedures.
          </p>
          <details>
            <summary>MRI modalities and segmentation labels</summary>
            <p>
              T1-native, contrast-enhanced T1 (T1ce), T2, and FLAIR provide complementary anatomical
              and tissue information. The repository preserves modality suffixes _0000 through _0003
              in this order.
            </p>
            <p>
              Label 1: necrotic/non-enhancing tumor core (NCR). Label 2: edema (ED). Label 3:
              enhancing tumor (ET). Whole tumor is the union of these labels.
            </p>
          </details>
        </section>
        <section id="methodology" tabIndex={-1}>
          <h2>A two-stage, coarse-to-fine framework</h2>
          <p className="research-lead">
            We propose a two-stage, coarse-to-fine framework for brain tumor segmentation. In the
            first stage, YOLOv8m-derived bounding-box prompts guide MedSAM to generate an initial
            tumor segmentation. The resulting mask is expanded by a 10 mm margin to define a region
            of interest (ROI). In the second stage, nnU-Net processes the ROI-masked multimodal MRI
            volumes to produce the final volumetric tumor segmentation.
          </p>
          {[
            {
              label: 'Stage 1 · Localization and ROI definition',
              steps: stages.slice(0, 4),
              start: 1,
            },
            { label: 'Stage 2 · Volumetric refinement', steps: stages.slice(4, 5), start: 5 },
            { label: 'Downstream evaluation', steps: stages.slice(5), start: 6 },
          ].map((group) => (
            <div className="research-stage-group" key={group.label}>
              <h3>{group.label}</h3>
              <ol className="research-pipeline" start={group.start}>
                {group.steps.map(([title, body], i) => (
                  <li key={title}>
                    <span className="pipeline-index">{group.start + i}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <h3>Why region-focused refinement?</h3>
          <p>
            Multimodal input supplies complementary tissue contrast. Bounding-box prompting
            constrains the initial segmentation spatially, while the 10 mm buffer retains
            surrounding context. ROI masking directs nnU-Net toward the localized region. Errors in
            localization can nevertheless exclude tumor tissue and propagate to the final
            segmentation.
          </p>
          <details>
            <summary>Implementation and reproducibility</summary>
            <p>
              The repository separates slice stacking, YOLO/MedSAM inference, mask reconstruction,
              ROI masking, nnU-Net inference, and evaluation. MRI affines and voxel spacing must
              remain consistent throughout the pipeline.
            </p>
            <p>
              The current masking implementation approximates the 10 mm dilation using voxel spacing
              and repeated binary dilation. It does not implement an exact Euclidean-distance
              expansion on anisotropic volumes. The experimental scores below are reported project
              results; they have not been recomputed by this website.
            </p>
          </details>
        </section>
        <section id="training" tabIndex={-1}>
          <h2>Model development and training</h2>
          <p>
            The team explored MA-SAM, MedSAM, MedSAM-2, SAM-Med3D, and nn-Interactive before
            selecting MedSAM and nnU-Net for the combined framework. YOLOv8m supplies automatic
            spatial prompts for the localization stage.
          </p>
          <h3>Parameter-efficient MedSAM adaptation</h3>
          <p>
            MedSAM is fine-tuned using low-rank adaptation (LoRA) on a custom RGB-stacked MRI
            dataset. Spatially corresponding T1ce, T2, and FLAIR slices are intensity-normalized and
            stacked into a three-channel, pseudo-RGB representation. These channels encode
            complementary MRI contrasts rather than natural-image color.
          </p>
          <p>
            Parameter-efficient fine-tuning introduces rank-4 trainable low-rank updates into the
            mask decoder’s attention projections, while the image encoder remains frozen. This
            decoder-side adaptation transfers pretrained representations to the custom multimodal
            MRI distribution without retraining the image encoder. AdamW optimizes the adaptation
            using reference segmentation masks and Tversky loss with α = 0.7 and β = 0.3.
          </p>
          <h3>Classification and segmentation objectives</h3>
          <p>
            Cross-entropy is used for classification loss, penalizing disagreement between predicted
            class probabilities and reference class labels. Tversky loss is used for segmentation,
            measuring overlap while controlling the relative penalties for false positives and false
            negatives through α = 0.7 and β = 0.3.
          </p>
          <h3>Volumetric refinement</h3>
          <p>
            Two nnU-Net training configurations use adult glioma + pediatric data and adult glioma +
            SSA data, respectively. Each is trained for 1,000 epochs on ROI-masked multimodal MRI,
            with a 10 mm buffer retaining surrounding anatomical context.
          </p>
          <div className="research-figures">
            <Figure index={1} onOpen={openFigure} />
            <Figure index={2} onOpen={openFigure} />
          </div>
          <Figure index={0} onOpen={openFigure} />
          <h3>Development timeline</h3>
          <dl className="research-timeline">
            <div>
              <dt>March</dt>
              <dd>Investigated segmentation models and their limitations.</dd>
            </div>
            <div>
              <dt>April</dt>
              <dd>Integrated localization and refinement; analyzed multimodal MRI.</dd>
            </div>
            <div>
              <dt>May</dt>
              <dd>Fine-tuned models and investigated generalization strategies.</dd>
            </div>
            <div>
              <dt>Final phase</dt>
              <dd>Consolidated experiments and compared performance across cohorts.</dd>
            </div>
          </dl>
        </section>
        <section id="results" tabIndex={-1}>
          <h2>Reported experimental results</h2>
          <p>
            DSC measures overlap between prediction and reference: 2|P ∩ G| / (|P| + |G|). Values
            range from 0 to 1; higher values indicate greater overlap. The following 52 scores
            report the experimental comparisons, without recomputation or additional precision.
          </p>
          <h3>Whole-tumor comparison with nnU-Net</h3>
          <div className="research-overview-chart" aria-label="Whole-tumor DSC overview">
            {experiments.map((item) => (
              <div className="research-chart-group" key={item.id}>
                <h4>
                  {item.cohort}
                  <small>Training: {item.training}</small>
                </h4>
                {[0, 1].map((i) => (
                  <div className="research-bar-row" key={i}>
                    <span>{i === 0 ? 'nnU-Net' : 'TumorGen'}</span>
                    <div className="research-bar-track">
                      <i
                        className={i === 1 ? 'pipeline-bar' : ''}
                        style={{ width: `${item.whole[i] * 100}%` }}
                      />
                    </div>
                    <strong>{dsc(item.whole[i])}</strong>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p>
            The pipeline improves DSC by 0.06 on SSA and 0.52 on the pediatric cohort relative to
            the listed nnU-Net baseline. On adult glioma, DSC decreases by 0.04 and 0.05 across the
            two training settings.
          </p>
          <label className="research-experiment-select">
            Inspect an experiment
            <select value={experiment} onChange={(e) => setExperiment(e.target.value)}>
              {experiments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.cohort} · trained on {item.training}
                </option>
              ))}
            </select>
          </label>
          <h3>{current.cohort}: complete model comparison</h3>
          <p>Training cohorts: {current.training}.</p>
          <div className="research-table-wrap" tabIndex={0} aria-label="Whole-tumor results">
            <table>
              <caption>Whole-tumor Dice similarity coefficient</caption>
              <thead>
                <tr>
                  <th scope="col">Segmentation model</th>
                  <th scope="col">DSC</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model, i) => (
                  <tr className={i === 1 ? 'pipeline-result' : ''} key={model}>
                    <th scope="row">{model}</th>
                    <td>{dsc(current.whole[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="research-table-wrap" tabIndex={0} aria-label="Per-label results">
            <table>
              <caption>Per-label Dice similarity coefficient</caption>
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">NCR · label 1</th>
                  <th scope="col">ED · label 2</th>
                  <th scope="col">ET · label 3</th>
                </tr>
              </thead>
              <tbody>
                {current.labels.map((values, i) => (
                  <tr key={i} className={i === 1 ? 'pipeline-result' : ''}>
                    <th scope="row">
                      {i === 0 ? 'nnU-Net · pretrained' : 'TumorGen · MedSAM + nnU-Net'}
                    </th>
                    {values.map((value, j) => (
                      <td key={j}>{dsc(value)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Domain Game scores are literature comparisons, not experiments independently reproduced
            here. Equivalent splits and evaluation protocols are not established. “Pretrained”
            identifies the baseline model configuration; checkpoint provenance is not specified.
          </p>
          <h3>Qualitative segmentation examples</h3>
          <Figure index={3} onOpen={openFigure} />
          <Figure index={4} onOpen={openFigure} />
        </section>
        <section id="discussion" tabIndex={-1}>
          <h2>Interpretation and limitations</h2>
          <p>
            The principal result is improved whole-tumor overlap on evaluation cohorts not included
            in the corresponding training combinations: pediatric tumors after training on adult
            glioma + SSA, and SSA after training on adult glioma + pediatric data. Pediatric
            evaluation examines an unseen tumor population; SSA additionally examines a geographic
            cohort shift. Whole-tumor generalization is therefore the primary finding, while
            accurate delineation of each tumor subregion remains a separate challenge. They also
            show an adult-glioma tradeoff, where the nnU-Net baseline achieves higher DSC.
          </p>
          <p>
            Per-label performance is heterogeneous: SSA edema improves while NCR and ET decrease;
            pediatric scores improve across all three labels, but ET remains low at 0.13.
            Adult-glioma label scores decrease relative to the baseline. Further work should examine
            localization failure, ROI coverage, and subregion-specific errors.
          </p>
          <p>
            Dependence on bounding-box quality, incomplete split and checkpoint documentation,
            absent uncertainty estimates, and unmatched literature protocols limit the conclusions.
            Cross-dataset results do not establish clinical effectiveness. Future evaluation should
            use explicit held-out cohorts, reproducible configurations, and case-level
            distributions.
          </p>
          <h3>Relationship to the interactive workspace</h3>
          <p>
            The comparison workspace displays 40 UPenn-GBM cases with expert-reviewed annotations
            and separately released automated segmentation masks. Its per-case metrics are not the
            experimental results above. Actual TumorGen weights are not integrated into that
            prepared case library; source information is retained in exported provenance.
          </p>
          <h3>Sources and further reading</h3>
          <ul className="research-references">
            <li>
              <a href={REPOSITORY} target="_blank" rel="noreferrer">
                TumorGen source repository <ExternalLink size={14} />
              </a>{' '}
              — pipeline implementation and training scripts.
            </li>
            <li>
              <a href="https://arxiv.org/abs/2406.02125" target="_blank" rel="noreferrer">
                Domain Game
              </a>{' '}
              — literature comparator.
            </li>
            <li>
              <a href="https://github.com/bowang-lab/MedSAM" target="_blank" rel="noreferrer">
                MedSAM
              </a>{' '}
              ·{' '}
              <a href="https://github.com/MIC-DKFZ/nnUNet" target="_blank" rel="noreferrer">
                nnU-Net
              </a>{' '}
              ·{' '}
              <a
                href="https://docs.ultralytics.com/models/yolov8/"
                target="_blank"
                rel="noreferrer"
              >
                YOLOv8
              </a>{' '}
              ·{' '}
              <a href="https://arxiv.org/abs/2106.09685" target="_blank" rel="noreferrer">
                LoRA
              </a>
            </li>
            <li>
              <a href="https://doi.org/10.7937/TCIA.709X-DN49" target="_blank" rel="noreferrer">
                UPenn-GBM / TCIA
              </a>{' '}
              — interactive case-library attribution.
            </li>
          </ul>
        </section>
      </article>
      {enlarged !== null && <EnlargedFigure index={enlarged} close={closeFigure} />}
    </main>
  );
}
