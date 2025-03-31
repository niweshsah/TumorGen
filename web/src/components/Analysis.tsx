import { Download, Info } from 'lucide-react';
import { useWorkspace } from '../state';
import {
  REGION_LABELS,
  type CaseRecord,
  type Metrics,
  type Provenance,
  type Region,
} from '../types';

const format = (value: number | null) => (value === null ? 'N/A' : value.toFixed(3));
export function Analysis({
  record,
  metrics,
  provenance,
  onProvenance,
}: {
  record: CaseRecord;
  metrics: Record<Region, Metrics> | null;
  provenance?: Provenance;
  onProvenance: () => void;
}) {
  const region = useWorkspace((s) => s.region),
    set = useWorkspace((s) => s.set);
  const current = metrics?.[region];
  const exportMetrics = () => {
    if (!metrics) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            caseId: record.id,
            region,
            metrics,
            prediction: provenance ?? record.prediction.provenance,
            reference: 'Expert-reviewed UPenn-GBM annotation',
            units: 'mL',
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `${record.id}-metrics.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="analysis-panel" aria-label="Segmentation analysis">
      <div className="analysis-heading">
        <div>
          <h2>Segmentation agreement</h2>
        </div>
        <label className="region-select">
          Evaluation region
          <select
            aria-label="Evaluation region"
            value={region}
            onChange={(event) => set({ region: event.target.value as Region })}
          >
            {Object.entries(REGION_LABELS).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <dl className="agreement-metrics">
        <div className="dice-summary">
          <dt title="Spatial overlap with the expert reference">Dice coefficient</dt>
          <dd data-testid="dice-score">{current ? current.dice.toFixed(3) : '—'}</dd>
        </div>
        {(
          [
            ['IoU', current?.iou, 'Intersection over union'],
            ['Precision', current?.precision, 'Fraction of predicted tumor matching the reference'],
            ['Recall', current?.recall, 'Fraction of reference tumor recovered'],
          ] as const
        ).map(([name, value, title]) => (
          <div key={name}>
            <dt title={title}>{name}</dt>
            <dd>{value === undefined ? '—' : format(value)}</dd>
          </div>
        ))}
        <div>
          <dt>Ground Truth volume</dt>
          <dd>
            {current?.groundTruthMl.toFixed(2) ?? '—'} <small>mL</small>
          </dd>
        </div>
        <div>
          <dt>Prediction volume</dt>
          <dd>
            {current?.predictionMl.toFixed(2) ?? '—'} <small>mL</small>
          </dd>
        </div>
        <div>
          <dt>
            Volume difference{' '}
            <small className="difference-note">
              {current?.differencePercent != null
                ? `· ${current.differencePercent >= 0 ? '+' : ''}${current.differencePercent.toFixed(1)}%`
                : '· N/A'}
            </small>
          </dt>
          <dd>
            {current
              ? `${current.differenceMl >= 0 ? '+' : ''}${current.differenceMl.toFixed(2)}`
              : '—'}{' '}
            <small>mL</small>
          </dd>
        </div>
      </dl>
      <div className="analysis-detail-row">
        <details className="acquisition-details">
          <summary>Acquisition & export</summary>
          <div className="acquisition-content">
            <p className="section-note">Measured on the original voxel grid</p>
            <dl>
              <div>
                <dt>Category</dt>
                <dd>{record.category}</dd>
              </div>
              <div>
                <dt>Voxel spacing</dt>
                <dd>{record.spacing.map((n) => n.toFixed(1)).join(' × ')} mm</dd>
              </div>
              <div>
                <dt>Volume grid</dt>
                <dd>{record.shape.join(' × ')}</dd>
              </div>
              <div>
                <dt>Modalities</dt>
                <dd>T1 / T1ce / T2 / FLAIR</dd>
              </div>
            </dl>
          </div>
        </details>
        <button className="export-button" disabled={!metrics} onClick={exportMetrics}>
          <Download size={15} />
          Export case metrics
        </button>
        <button className="info-link" onClick={onProvenance}>
          <Info size={14} /> About these predictions
        </button>
      </div>
    </section>
  );
}
