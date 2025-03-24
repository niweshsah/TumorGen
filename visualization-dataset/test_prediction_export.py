import nibabel as nib
import numpy as np
import pytest

from prepare import export_prediction, save_volume


def test_export_maps_tumorgen_labels_and_preserves_geometry(tmp_path):
    reference = tmp_path / "mri.nii.gz"
    prediction = tmp_path / "model.nii.gz"
    affine = np.array([[2.0, 0, 0, -10], [0, 3, 0, -20], [0, 0, 4, -30], [0, 0, 0, 1]])
    data = np.zeros((8, 8, 8), dtype=np.uint8)
    data[2:5, 2:5, 2:5] = 3
    save_volume(np.ones(data.shape, dtype=np.uint8), affine, reference)
    save_volume(data, affine, prediction)
    output = tmp_path / "artifacts"
    artifact = export_prediction(prediction, reference, output, {0: 0, 1: 1, 2: 2, 3: 4})
    mask = nib.load(output / artifact["maskUrl"])
    assert set(np.unique(mask.get_fdata())) == {0, 4}
    np.testing.assert_allclose(mask.affine, affine)
    assert mask.header.get_xyzt_units()[0] == "mm"
    assert "4" in artifact["meshUrls"]
    assert "1" not in artifact["meshUrls"]
    assert (output / artifact["meshUrls"]["4"]).is_file()


def test_unregistered_prediction_is_rejected(tmp_path):
    reference = tmp_path / "mri.nii.gz"
    prediction = tmp_path / "model.nii.gz"
    save_volume(np.ones((4, 4, 4), dtype=np.uint8), np.eye(4), reference)
    shifted = np.eye(4)
    shifted[0, 3] = 10
    save_volume(np.ones((4, 4, 4), dtype=np.uint8), shifted, prediction)
    with pytest.raises(ValueError, match="geometry"):
        export_prediction(prediction, reference, tmp_path / "artifacts")


def test_unknown_labels_are_rejected(tmp_path):
    reference = tmp_path / "mri.nii.gz"
    prediction = tmp_path / "model.nii.gz"
    save_volume(np.ones((4, 4, 4), dtype=np.uint8), np.eye(4), reference)
    save_volume(np.full((4, 4, 4), 9, dtype=np.uint8), np.eye(4), prediction)
    with pytest.raises(ValueError, match="Unmapped"):
        export_prediction(prediction, reference, tmp_path / "artifacts", {0: 0, 1: 1})
