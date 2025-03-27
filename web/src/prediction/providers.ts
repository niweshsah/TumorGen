import type { CaseRecord, PredictionArtifact } from '../types';

export interface PredictionProvider {
  load(caseRecord: CaseRecord, signal: AbortSignal): Promise<PredictionArtifact>;
}
export class PublishedPredictionProvider implements PredictionProvider {
  async load(caseRecord: CaseRecord, signal: AbortSignal) {
    signal.throwIfAborted();
    return caseRecord.prediction;
  }
}
export class HttpPredictionProvider implements PredictionProvider {
  constructor(private endpoint = '/api/predictions') {}
  async load(caseRecord: CaseRecord, signal: AbortSignal): Promise<PredictionArtifact> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: caseRecord.id }),
      signal,
    });
    if (!response.ok) throw new Error(`Prediction endpoint failed (${response.status})`);
    const artifact = (await response.json()) as PredictionArtifact;
    if (
      !artifact.maskUrl ||
      !artifact.affine ||
      !artifact.shape ||
      !artifact.labelMap ||
      !artifact.provenance
    )
      throw new Error('Invalid prediction artifact');
    if (!Object.values(artifact.labelMap).every((label) => [0, 1, 2, 4].includes(label)))
      throw new Error('Prediction uses unsupported labels');
    return { ...artifact, meshUrls: artifact.meshUrls ?? {} };
  }
}
export const predictionProvider: PredictionProvider =
  import.meta.env.VITE_PREDICTION_PROVIDER === 'http'
    ? new HttpPredictionProvider(import.meta.env.VITE_PREDICTION_ENDPOINT || '/api/predictions')
    : new PublishedPredictionProvider();
