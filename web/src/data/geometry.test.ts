import { describe, expect, it } from 'vitest';
import { sliceVoxel, sliceCrosshair, voxelToWorld, voxelVolumeMl, sameGeometry } from './geometry';
import { computeMetrics } from './metrics';
const affine = [
  [2, 0, 0, -80],
  [0, 3, 0, -110],
  [0, 0, 4, -60],
  [0, 0, 0, 1],
];
describe('physical geometry and radiological orientation', () => {
  it('maps voxels into millimeters', () =>
    expect(voxelToWorld([10, 20, 5], affine)).toEqual([-60, -50, -40]));
  it('preserves patient coordinates between slice planes', () => {
    const point: [number, number, number] = [7, 12, 3],
      shape: [number, number, number] = [20, 30, 10];
    for (const plane of ['axial', 'coronal', 'sagittal'] as const) {
      const [u, v] = sliceCrosshair(plane, point, shape);
      expect(sliceVoxel(plane, u, v, point, shape)).toEqual(point);
    }
    expect(sliceVoxel('axial', 0, 0, point, shape)).toEqual([19, 29, 3]);
  });
  it('detects mismatched affines', () => {
    const shape: [number, number, number] = [2, 2, 2];
    expect(
      sameGeometry({ shape, affine }, { shape, affine: [[2, 0, 0, 0], ...affine.slice(1)] }),
    ).toBe(false);
  });
  it('uses absolute determinant for volume', () =>
    expect(voxelVolumeMl([[-2, 0, 0, 0], ...affine.slice(1)])).toBeCloseTo(0.024));
});
describe('segmentation metrics', () => {
  it('computes known disagreement independently', () => {
    const result = computeMetrics(
      new Uint8Array([1, 2, 0, 0]),
      new Uint8Array([0, 2, 4, 4]),
      affine,
    ).WT;
    expect(result.dice).toBeCloseTo(0.4);
    expect(result.iou).toBeCloseTo(0.25);
    expect(result.precision).toBeCloseTo(1 / 3);
    expect(result.recall).toBe(0.5);
    expect(result.groundTruthMl).toBeCloseTo(0.048);
  });
  it('reports undefined precision and recall for empty regions', () => {
    const result = computeMetrics(new Uint8Array([0]), new Uint8Array([0]), affine).ET;
    expect(result.dice).toBe(1);
    expect(result.precision).toBeNull();
    expect(result.recall).toBeNull();
  });
});
