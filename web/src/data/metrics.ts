import type { Affine, Metrics, Region } from '../types';
import { voxelVolumeMl } from './geometry';

const REGION_MASKS: Record<Region, number[]> = {
  WT: [1, 2, 4],
  TC: [1, 4],
  ET: [4],
};
export function computeMetrics(
  groundTruth: Uint8Array,
  prediction: Uint8Array,
  affine: Affine,
): Record<Region, Metrics> {
  if (groundTruth.length !== prediction.length) throw new Error('Masks must share a grid');
  const voxelMl = voxelVolumeMl(affine);
  const results = {} as Record<Region, Metrics>;
  for (const region of ['WT', 'TC', 'ET'] as Region[]) {
    const labels = REGION_MASKS[region];
    let gt = 0,
      pred = 0,
      tp = 0;
    for (let i = 0; i < groundTruth.length; i++) {
      const g = labels.includes(groundTruth[i]),
        p = labels.includes(prediction[i]);
      if (g) gt++;
      if (p) pred++;
      if (g && p) tp++;
    }
    results[region] = {
      dice: gt + pred ? (2 * tp) / (gt + pred) : 1,
      iou: gt + pred - tp ? tp / (gt + pred - tp) : 1,
      precision: pred ? tp / pred : null,
      recall: gt ? tp / gt : null,
      groundTruthMl: gt * voxelMl,
      predictionMl: pred * voxelMl,
      differenceMl: (pred - gt) * voxelMl,
      differencePercent: gt ? ((pred - gt) / gt) * 100 : null,
      tp,
      fp: pred - tp,
      fn: gt - tp,
    };
  }
  return results;
}
