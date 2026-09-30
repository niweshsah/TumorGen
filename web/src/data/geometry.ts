import type { Affine, Plane, Vec3, Volume } from '../types';

export function voxelToWorld(point: Vec3, affine: Affine): Vec3 {
  return [0, 1, 2].map(
    (row) =>
      affine[row][0] * point[0] +
      affine[row][1] * point[1] +
      affine[row][2] * point[2] +
      affine[row][3],
  ) as Vec3;
}
export function voxelIndex(x: number, y: number, z: number, shape: Vec3) {
  return x + shape[0] * (y + shape[1] * z);
}
// Radiological convention: image right corresponds to patient left.
export function sliceVoxel(plane: Plane, u: number, v: number, crosshair: Vec3, shape: Vec3): Vec3 {
  if (plane === 'axial') return [shape[0] - 1 - u, shape[1] - 1 - v, crosshair[2]];
  if (plane === 'coronal') return [shape[0] - 1 - u, crosshair[1], shape[2] - 1 - v];
  return [crosshair[0], u, shape[2] - 1 - v];
}
export function sliceDimensions(plane: Plane, shape: Vec3): [number, number] {
  return plane === 'axial'
    ? [shape[0], shape[1]]
    : plane === 'coronal'
      ? [shape[0], shape[2]]
      : [shape[1], shape[2]];
}
export function sliceCrosshair(plane: Plane, point: Vec3, shape: Vec3): [number, number] {
  return plane === 'axial'
    ? [shape[0] - 1 - point[0], shape[1] - 1 - point[1]]
    : plane === 'coronal'
      ? [shape[0] - 1 - point[0], shape[2] - 1 - point[2]]
      : [point[1], shape[2] - 1 - point[2]];
}
export function sameGeometry(
  a: Pick<Volume, 'shape' | 'affine'>,
  b: { shape: number[]; affine: Affine },
): boolean {
  return (
    a.shape.every((n, i) => n === b.shape[i]) &&
    a.affine.every((row, i) => row.every((v, j) => Math.abs(v - b.affine[i][j]) < 1e-4))
  );
}
export function voxelVolumeMl(affine: Affine): number {
  const a = affine;
  const determinant =
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  if (!Number.isFinite(determinant) || determinant === 0) throw new Error('Invalid affine');
  return Math.abs(determinant) / 1000;
}
