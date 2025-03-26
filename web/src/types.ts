export type Vec3 = [number, number, number];
export type Affine = number[][];
export type Modality = 'T1' | 'T1GD' | 'T2' | 'FLAIR';
export type Region = 'WT' | 'TC' | 'ET';
export type Plane = 'axial' | 'coronal' | 'sagittal';
export type ViewMode = 'combined' | '3d' | 'slices';
export interface Metrics {
  dice: number;
  iou: number;
  precision: number | null;
  recall: number | null;
  groundTruthMl: number;
  predictionMl: number;
  differenceMl: number;
  differencePercent: number | null;
  tp: number;
  fp: number;
  fn: number;
}
export interface Provenance {
  name: string;
  kind: 'demo' | 'tumorgen';
  description: string;
  sourceUrl: string;
  confidence: number | null;
}
export interface PredictionArtifact {
  maskUrl: string;
  meshUrls: Record<string, string>;
  shape: number[];
  affine: Affine;
  labelMap: Record<string, number>;
  provenance: Provenance;
}
export interface CaseRecord {
  id: string;
  category: string;
  cohort: string;
  revision: string;
  modalities: Record<Modality, string>;
  shape: number[];
  spacing: number[];
  affine: Affine;
  centroid: Vec3;
  brainMeshUrl: string;
  groundTruthUrl: string;
  groundTruthMeshes: Record<string, string>;
  thumbnailUrl: string;
  metrics: Record<Region, Metrics>;
  differentVoxels: number;
  prediction: PredictionArtifact;
}
export interface Manifest {
  version: number;
  dataset: string;
  revision: string;
  license: string;
  sourceUrl: string;
  requestedCases: number;
  cases: CaseRecord[];
}
export interface Volume {
  data: Uint8Array;
  shape: Vec3;
  affine: Affine;
}
export interface CameraState {
  position: Vec3;
  target: Vec3;
  source: string;
  revision: number;
}
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
}
export const LABEL_COLORS: Record<number, string> = {
  1: '#f5b760',
  2: '#5bb1d0',
  4: '#ee7a87',
};
export const LABEL_NAMES: Record<number, string> = {
  1: 'Necrotic core',
  2: 'Edema',
  4: 'Enhancing tumor',
};
export const MODALITY_NAMES: Record<Modality, string> = {
  T1: 'T1',
  T1GD: 'T1 contrast',
  T2: 'T2',
  FLAIR: 'FLAIR',
};
export const REGION_LABELS: Record<Region, string> = {
  WT: 'Whole tumor',
  TC: 'Tumor core',
  ET: 'Enhancing tumor',
};
