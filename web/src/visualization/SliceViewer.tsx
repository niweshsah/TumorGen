import { useEffect, useRef } from 'react';
import { useWorkspace } from '../state';
import { LABEL_COLORS, type Plane, type Vec3, type Volume } from '../types';
import { sliceCrosshair, sliceDimensions, sliceVoxel, voxelIndex } from '../data/geometry';

const AXES: Record<Plane, number> = { axial: 2, coronal: 1, sagittal: 0 };
const ORIENTATION: Record<Plane, [string, string, string, string]> = {
  axial: ['R', 'L', 'A', 'P'],
  coronal: ['R', 'L', 'S', 'I'],
  sagittal: ['P', 'A', 'S', 'I'],
};
const RGB = Object.fromEntries(
  Object.entries(LABEL_COLORS).map(([label, hex]) => [
    label,
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
  ]),
);
export function slicePixels(
  mri: Volume,
  mask: Volume,
  plane: Plane,
  crosshair: Vec3,
  opacity: number,
  visible: boolean,
  window: number,
  level: number,
): ImageData {
  const [width, height] = sliceDimensions(plane, mri.shape);
  const image = new ImageData(width, height);
  const low = level - window / 2;
  for (let v = 0; v < height; v++)
    for (let u = 0; u < width; u++) {
      const voxel = sliceVoxel(plane, u, v, crosshair, mri.shape),
        index = voxelIndex(...voxel, mri.shape);
      const intensity = Math.max(0, Math.min(255, ((mri.data[index] - low) / window) * 255));
      const rgb = visible ? RGB[mask.data[index]] : undefined;
      const offset = (u + v * width) * 4;
      for (let channel = 0; channel < 3; channel++)
        image.data[offset + channel] = rgb
          ? intensity * (1 - opacity) + rgb[channel] * opacity
          : intensity;
      image.data[offset + 3] = 255;
    }
  return image;
}
function SliceCanvas({
  mri,
  mask,
  plane,
  kind,
}: {
  mri: Volume;
  mask: Volume;
  plane: Plane;
  kind: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const crosshair = useWorkspace((s) => s.crosshair),
    opacity = useWorkspace((s) => s.maskOpacity);
  const visible = useWorkspace((s) => s.tumorVisible),
    window = useWorkspace((s) => s.window),
    level = useWorkspace((s) => s.level);
  const [width, height] = sliceDimensions(plane, mri.shape);
  const [u, v] = sliceCrosshair(plane, crosshair, mri.shape);
  const labels = ORIENTATION[plane];
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    ctx?.putImageData(
      slicePixels(mri, mask, plane, crosshair, opacity, visible, window, level),
      0,
      0,
    );
  }, [mri, mask, plane, crosshair, opacity, visible, window, level]);
  const setPoint = (x: number, y: number) => {
    const point = sliceVoxel(
      plane,
      Math.max(0, Math.min(width - 1, x)),
      Math.max(0, Math.min(height - 1, y)),
      crosshair,
      mri.shape,
    );
    useWorkspace.getState().set({ crosshair: point });
  };
  return (
    <div className="slice-image" style={{ aspectRatio: `${width}/${height}` }}>
      <canvas
        ref={ref}
        width={width}
        height={height}
        tabIndex={0}
        aria-label={`${kind} ${plane} MRI slice`}
        role="img"
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setPoint(
            Math.floor(((event.clientX - bounds.left) / bounds.width) * width),
            Math.floor(((event.clientY - bounds.top) / bounds.height) * height),
          );
        }}
        onKeyDown={(event) => {
          const movement: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
          };
          if (movement[event.key]) {
            event.preventDefault();
            const [dx, dy] = movement[event.key];
            setPoint(u + dx, v + dy);
          }
        }}
      />
      <div className="crosshair-h" style={{ top: `${((v + 0.5) / height) * 100}%` }} />
      <div className="crosshair-v" style={{ left: `${((u + 0.5) / width) * 100}%` }} />
      <span className="orientation left">{labels[0]}</span>
      <span className="orientation right">{labels[1]}</span>
      <span className="orientation top">{labels[2]}</span>
      <span className="orientation bottom">{labels[3]}</span>
      <span className={`slice-kind ${kind === 'Ground Truth' ? 'gt' : 'pred'}`}>{kind}</span>
    </div>
  );
}
export function SliceViewer({
  mri,
  groundTruth,
  prediction,
}: {
  mri: Volume;
  groundTruth: Volume;
  prediction: Volume;
}) {
  const crosshair = useWorkspace((s) => s.crosshair);
  return (
    <div className="slice-grid">
      {(['axial', 'coronal', 'sagittal'] as Plane[]).map((plane) => {
        const axis = AXES[plane];
        return (
          <section className="slice-plane" key={plane} aria-label={`${plane} comparison`}>
            <div className="slice-heading">
              <span>{plane}</span>
              <span className="mono">
                {String(crosshair[axis] + 1).padStart(3, '0')}
                <span className="subtle"> / {mri.shape[axis]}</span>
              </span>
            </div>
            <div className="slice-pair">
              <SliceCanvas mri={mri} mask={groundTruth} plane={plane} kind="Ground Truth" />
              <SliceCanvas mri={mri} mask={prediction} plane={plane} kind="Prediction" />
            </div>
            <input
              type="range"
              min={0}
              max={mri.shape[axis] - 1}
              value={crosshair[axis]}
              aria-label={`${plane} slice`}
              onChange={(event) => {
                const point: Vec3 = [...crosshair];
                point[axis] = Number(event.target.value);
                useWorkspace.getState().set({ crosshair: point });
              }}
            />
          </section>
        );
      })}
    </div>
  );
}
