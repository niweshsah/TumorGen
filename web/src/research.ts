export const REPOSITORY = 'https://github.com/niweshsah/TumorGen';
export const PRESENTATION =
  'https://docs.google.com/presentation/d/1w_BFCxn8hc9H70to6h3_1vOmHWfLvOGO/edit';
export const models = [
  'nnU-Net · pretrained',
  'TumorGen · MedSAM + nnU-Net',
  'MedSAM · single modality, pretrained',
  'MedSAM · three modalities, pretrained',
  'MedSAM · three modalities, fine-tuned',
  'Domain Game · literature comparison',
  'nn-Interactive · single modality',
];
export const experiments = [
  {
    id: 'ssa',
    cohort: 'SSA',
    training: 'Adult glioma + Pediatric',
    slide: 26,
    labelSlide: 27,
    whole: [0.7, 0.76, 0.61, 0.55, 0.67, 0.57, 0.59],
    labels: [
      [0.54, 0.74, 0.74],
      [0.51, 0.84, 0.68],
    ],
  },
  {
    id: 'pediatric',
    cohort: 'Pediatric',
    training: 'Adult glioma + SSA',
    slide: 28,
    labelSlide: 29,
    whole: [0.12, 0.64, 0.53, 0.46, 0.59, 0.45, 0.46],
    labels: [
      [0.02, 0.14, 0.003],
      [0.43, 0.82, 0.13],
    ],
  },
  {
    id: 'adult-ssa',
    cohort: 'Adult glioma',
    training: 'Adult glioma + SSA',
    slide: 30,
    labelSlide: 31,
    whole: [0.92, 0.88, 0.71, 0.66, 0.74, 0.69, 0.58],
    labels: [
      [0.8, 0.86, 0.82],
      [0.61, 0.84, 0.73],
    ],
  },
  {
    id: 'adult-pediatric',
    cohort: 'Adult glioma',
    training: 'Adult glioma + Pediatric',
    slide: 32,
    labelSlide: 33,
    whole: [0.92, 0.87, 0.71, 0.66, 0.75, 0.69, 0.58],
    labels: [
      [0.8, 0.86, 0.82],
      [0.58, 0.82, 0.73],
    ],
  },
];
export const dsc = (value: number) => (value === 0.003 ? '0.003' : value.toFixed(2));
