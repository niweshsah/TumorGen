import { voxelIndex, voxelToWorld } from './geometry';
import type { MeshData, Volume } from '../types';

// Native-resolution boundary fallback for providers without prepared GLB meshes.
// Published demo surfaces use offline marching cubes and quadric simplification.
export function boundaryMesh(volume: Volume, label: number): MeshData {
  const positions: number[] = [],
    normals: number[] = [];
  const faces = [
    {
      n: [-1, 0, 0],
      p: [
        [-0.5, -0.5, -0.5],
        [-0.5, -0.5, 0.5],
        [-0.5, 0.5, 0.5],
        [-0.5, 0.5, -0.5],
      ],
    },
    {
      n: [1, 0, 0],
      p: [
        [0.5, -0.5, 0.5],
        [0.5, -0.5, -0.5],
        [0.5, 0.5, -0.5],
        [0.5, 0.5, 0.5],
      ],
    },
    {
      n: [0, -1, 0],
      p: [
        [-0.5, -0.5, 0.5],
        [-0.5, -0.5, -0.5],
        [0.5, -0.5, -0.5],
        [0.5, -0.5, 0.5],
      ],
    },
    {
      n: [0, 1, 0],
      p: [
        [-0.5, 0.5, -0.5],
        [-0.5, 0.5, 0.5],
        [0.5, 0.5, 0.5],
        [0.5, 0.5, -0.5],
      ],
    },
    {
      n: [0, 0, -1],
      p: [
        [0.5, -0.5, -0.5],
        [-0.5, -0.5, -0.5],
        [-0.5, 0.5, -0.5],
        [0.5, 0.5, -0.5],
      ],
    },
    {
      n: [0, 0, 1],
      p: [
        [-0.5, -0.5, 0.5],
        [0.5, -0.5, 0.5],
        [0.5, 0.5, 0.5],
        [-0.5, 0.5, 0.5],
      ],
    },
  ];
  const [nx, ny, nz] = volume.shape;
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        if (volume.data[voxelIndex(x, y, z, volume.shape)] !== label) continue;
        for (const face of faces) {
          const [dx, dy, dz] = face.n;
          const [xx, yy, zz] = [x + dx, y + dy, z + dz];
          if (
            xx >= 0 &&
            yy >= 0 &&
            zz >= 0 &&
            xx < nx &&
            yy < ny &&
            zz < nz &&
            volume.data[voxelIndex(xx, yy, zz, volume.shape)] === label
          )
            continue;
          const normal = [dx, dy, dz]; // Prepared provider grids are canonical axis-aligned RAS.
          for (const index of [0, 1, 2, 0, 2, 3]) {
            const p = face.p[index];
            positions.push(...voxelToWorld([x + p[0], y + p[1], z + p[2]], volume.affine));
            normals.push(...normal);
          }
        }
      }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
  };
}
