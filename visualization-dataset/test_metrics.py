import numpy as np
import pytest

from metrics import compute_metrics, region_metrics


def test_known_overlap_and_volume():
    result = region_metrics([1, 1, 0, 0], [0, 1, 1, 1], 0.008)
    assert result["dice"] == pytest.approx(0.4)
    assert result["iou"] == pytest.approx(0.25)
    assert result["precision"] == pytest.approx(1 / 3)
    assert result["recall"] == 0.5
    assert result["differenceMl"] == 0.008


def test_empty_regions_are_explicit():
    both_empty = region_metrics([0], [0], 0.001)
    assert both_empty["dice"] == 1
    assert both_empty["precision"] is None
    assert both_empty["recall"] is None
    false_positive = region_metrics([0], [1], 0.001)
    assert false_positive["dice"] == 0
    assert false_positive["precision"] == 0
    assert false_positive["recall"] is None


def test_affine_volume_and_region_mapping():
    gt = np.array([1, 2, 4, 0])
    pred = np.array([1, 0, 4, 0])
    affine = np.diag([-2.0, 3.0, 4.0, 1.0])
    result = compute_metrics(gt, pred, affine)
    assert result["WT"]["groundTruthMl"] == pytest.approx(0.072)
    assert result["TC"]["dice"] == 1
    assert result["ET"]["groundTruthMl"] == pytest.approx(0.024)


def test_mismatched_masks_rejected():
    with pytest.raises(ValueError):
        region_metrics([1, 1], [1], 1)
