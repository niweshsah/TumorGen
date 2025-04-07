import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as nifti from 'nifti-reader-js';
import { expect, it } from 'vitest';
import { computeMetrics } from './metrics';
import type { Affine, Manifest, Region } from '../types';

const dataRoot = resolve('public/data');
const available = existsSync(resolve(dataRoot, 'manifest.json'));
it.skipIf(!available)(
  'cross-checks TypeScript metrics against Python for every prepared case',
  () => {
    const manifest = JSON.parse(
      readFileSync(resolve(dataRoot, 'manifest.json'), 'utf8'),
    ) as Manifest;
    const readMask = (url: string) => {
      const file = readFileSync(resolve(dataRoot, url.replace('/data/', '')));
      const buffer = file.buffer.slice(
        file.byteOffset,
        file.byteOffset + file.byteLength,
      ) as ArrayBuffer;
      const decoded = nifti.isCompressed(buffer) ? nifti.decompress(buffer) : buffer;
      const header = nifti.readHeader(decoded);
      expect(header.datatypeCode).toBe(2);
      return {
        data: new Uint8Array(nifti.readImage(header, decoded)),
        affine: header.affine as Affine,
      };
    };
    for (const record of manifest.cases) {
      const gt = readMask(record.groundTruthUrl),
        pred = readMask(record.prediction.maskUrl);
      expect(gt.data.some((value, index) => value !== pred.data[index])).toBe(true);
      const actual = computeMetrics(gt.data, pred.data, gt.affine);
      for (const region of ['WT', 'TC', 'ET'] as Region[]) {
        for (const key of ['dice', 'iou', 'groundTruthMl', 'predictionMl', 'differenceMl'] as const)
          expect(actual[region][key]).toBeCloseTo(record.metrics[region][key], 9);
        expect(actual[region].precision).toBe(record.metrics[region].precision);
        expect(actual[region].recall).toBe(record.metrics[region].recall);
      }
    }
  },
  60000,
);
