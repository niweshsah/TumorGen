import { useEffect, useState } from 'react';
import type { CaseRecord, Metrics, Modality, PredictionArtifact, Region, Volume } from '../types';
import { loadVolume } from './dataset';
import { predictionProvider } from '../prediction/providers';
import { sameGeometry } from './geometry';
import { runWorker } from './worker-client';

export interface LoadedCase {
  caseId: string;
  modality: Modality;
  mri: Volume;
  groundTruth: Volume;
  prediction: Volume;
  artifact: PredictionArtifact;
  metrics: Record<Region, Metrics>;
}
export function useCase(record: CaseRecord | null, modality: Modality, retry: number) {
  const [state, setState] = useState<{
    data: LoadedCase | null;
    progress: number;
    error: string | null;
  }>({ data: null, progress: 0, error: null });
  useEffect(() => {
    if (!record) return;
    const controller = new AbortController();
    setState({ data: null, progress: 0, error: null });
    const progress = [0, 0, 0];
    const update = (index: number) => (value: number) => {
      if (!controller.signal.aborted) {
        progress[index] = value;
        setState((s) => ({
          ...s,
          progress: (progress.reduce((a, b) => a + b, 0) / 3) * 0.95,
        }));
      }
    };
    const load = async () => {
      const artifact = await predictionProvider.load(record, controller.signal);
      if (
        !sameGeometry({ shape: record.shape as Volume['shape'], affine: record.affine }, artifact)
      )
        throw new Error(
          'Prediction geometry does not match this case. Prepare an aligned prediction first.',
        );
      const [mri, groundTruth, prediction] = await Promise.all([
        loadVolume(record.modalities[modality], controller.signal, update(0)),
        loadVolume(record.groundTruthUrl, controller.signal, update(1), {
          '0': 0,
          '1': 1,
          '2': 2,
          '4': 4,
        }),
        loadVolume(artifact.maskUrl, controller.signal, update(2), artifact.labelMap),
      ]);
      if (![mri, groundTruth, prediction].every((volume) => sameGeometry(volume, record)))
        throw new Error('Volume geometry mismatch; overlays have been blocked.');
      const metrics = await runWorker<Record<Region, Metrics>>({
        kind: 'metrics',
        gt: groundTruth.data,
        pred: prediction.data,
        affine: groundTruth.affine,
      });
      controller.signal.throwIfAborted();
      setState({
        data: {
          caseId: record.id,
          modality,
          mri,
          groundTruth,
          prediction,
          artifact,
          metrics,
        },
        progress: 1,
        error: null,
      });
    };
    load().catch((error) => {
      if (!controller.signal.aborted)
        setState({
          data: null,
          progress: 0,
          error: error instanceof Error ? error.message : 'Could not load this case',
        });
    });
    return () => controller.abort();
  }, [record, modality, retry]);
  const matches = state.data?.caseId === record?.id && state.data?.modality === modality;
  return { ...state, data: matches ? state.data : null };
}
