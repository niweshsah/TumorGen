"""Metrics on aligned, original-resolution label maps (never display meshes)."""

import numpy as np

REGIONS = {"WT": (1, 2, 4), "TC": (1, 4), "ET": (4,)}


def region_metrics(reference, prediction, voxel_ml):
    reference = np.asarray(reference, dtype=bool)
    prediction = np.asarray(prediction, dtype=bool)
    if reference.shape != prediction.shape:
        raise ValueError("Metric masks must be on the same grid")
    gt = int(reference.sum())
    pred = int(prediction.sum())
    tp = int(np.count_nonzero(reference & prediction))
    union = gt + pred - tp
    return {
        "dice": 2 * tp / (gt + pred) if gt + pred else 1.0,
        "iou": tp / union if union else 1.0,
        "precision": tp / pred if pred else None,
        "recall": tp / gt if gt else None,
        "groundTruthMl": gt * voxel_ml,
        "predictionMl": pred * voxel_ml,
        "differenceMl": (pred - gt) * voxel_ml,
        "differencePercent": (pred - gt) / gt * 100 if gt else None,
        "tp": tp,
        "fp": pred - tp,
        "fn": gt - tp,
    }


def compute_metrics(reference, prediction, affine):
    voxel_ml = abs(float(np.linalg.det(np.asarray(affine)[:3, :3]))) / 1000
    if not np.isfinite(voxel_ml) or voxel_ml <= 0:
        raise ValueError("Invalid voxel geometry")
    return {
        name: region_metrics(np.isin(reference, labels), np.isin(prediction, labels), voxel_ml)
        for name, labels in REGIONS.items()
    }
