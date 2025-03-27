import * as nifti from 'nifti-reader-js';
import { computeMetrics } from './metrics';
import { boundaryMesh } from './mesh';
import type { Affine, Vec3, Volume } from '../types';

export type WorkerRequest =
  | {
      id: number;
      kind: 'decode';
      buffer: ArrayBuffer;
      labelMap?: Record<string, number>;
    }
  | {
      id: number;
      kind: 'metrics';
      gt: Uint8Array;
      pred: Uint8Array;
      affine: Affine;
    }
  | { id: number; kind: 'mesh'; volume: Volume; label: number };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    if (message.kind === 'metrics') {
      self.postMessage({
        id: message.id,
        value: computeMetrics(message.gt, message.pred, message.affine),
      });
      return;
    }
    if (message.kind === 'mesh') {
      const mesh = boundaryMesh(message.volume, message.label);
      self.postMessage(
        { id: message.id, value: mesh },
        { transfer: [mesh.positions.buffer, mesh.normals.buffer] },
      );
      return;
    }
    let buffer = message.buffer;
    if (nifti.isCompressed(buffer)) buffer = nifti.decompress(buffer);
    if (!nifti.isNIFTI(buffer)) throw new Error('Not a NIfTI volume');
    const header = nifti.readHeader(buffer);
    if (header.dims[0] !== 3) throw new Error('Expected a 3D NIfTI');
    const shape = header.dims.slice(1, 4) as Vec3;
    const image = nifti.readImage(header, buffer);
    const view = new DataView(image),
      data = new Uint8Array(shape[0] * shape[1] * shape[2]);
    const bytes = header.numBitsPerVoxel / 8;
    if (image.byteLength < data.length * bytes) throw new Error('Truncated NIfTI');
    const slope = header.scl_slope || 1,
      intercept = header.scl_slope ? header.scl_inter : 0;
    for (let i = 0; i < data.length; i++) {
      const offset = i * bytes;
      let value: number;
      switch (header.datatypeCode) {
        case 2:
          value = view.getUint8(offset);
          break;
        case 4:
          value = view.getInt16(offset, header.littleEndian);
          break;
        case 8:
          value = view.getInt32(offset, header.littleEndian);
          break;
        case 16:
          value = view.getFloat32(offset, header.littleEndian);
          break;
        case 64:
          value = view.getFloat64(offset, header.littleEndian);
          break;
        case 512:
          value = view.getUint16(offset, header.littleEndian);
          break;
        default:
          throw new Error('Unsupported NIfTI datatype');
      }
      value = value * slope + intercept;
      if (message.labelMap) {
        if (!Number.isInteger(value) || message.labelMap[String(value)] === undefined)
          throw new Error('Unknown prediction label');
        value = message.labelMap[String(value)];
      }
      if (!Number.isFinite(value) || value < 0 || value > 255 || !Number.isInteger(value))
        throw new Error('Expected prepared uint8 intensities or integer labels');
      data[i] = value;
    }
    const volume: Volume = { data, shape, affine: header.affine };
    self.postMessage({ id: message.id, value: volume }, { transfer: [data.buffer] });
  } catch (error) {
    self.postMessage({
      id: message.id,
      error: error instanceof Error ? error.message : 'Volume processing failed',
    });
  }
};
