import {
  Eye,
  EyeOff,
  Layers3,
  Link2,
  Maximize,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  Unlink,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { LABEL_COLORS, LABEL_NAMES } from '../types';
import { useWorkspace } from '../state';

export function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'active' : ''}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function RangeControl({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  suffix = '%',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <output>
          {suffix === '%' ? Math.round(value * 100) : Math.round(value)}
          {suffix}
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
export function ViewControls({ fullscreen }: { fullscreen: () => void }) {
  const state = useWorkspace();
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 900px)');
    const update = () => setOpen(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return (
    <details
      className="rendering-inspector"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-label="Rendering settings">
        <SlidersHorizontal size={17} />
        <span>Rendering controls</span>
        <ChevronDown size={16} />
      </summary>
      <div className="inspector-body">
        <button
          className="camera-switch"
          aria-label={state.synchronized ? 'Unlink cameras' : 'Synchronize cameras'}
          aria-pressed={state.synchronized}
          onClick={() => state.set({ synchronized: !state.synchronized })}
        >
          {state.synchronized ? <Link2 size={17} /> : <Unlink size={17} />}
          <span>{state.synchronized ? 'Cameras linked' : 'Independent cameras'}</span>
          <i className={`switch-track ${state.synchronized ? 'on' : ''}`} />
        </button>
        <div className="camera-actions">
          <button onClick={state.resetCamera} aria-label="Reset camera">
            <RotateCcw size={17} />
            Reset view
          </button>
          <button onClick={fullscreen} aria-label="Fullscreen comparison">
            <Maximize size={17} />
            Fullscreen
          </button>
        </div>
        <RangeControl
          label="Brain opacity"
          value={state.brainOpacity}
          onChange={(brainOpacity) => state.set({ brainOpacity })}
        />
        <details className="opacity-settings">
          <summary>
            More opacity settings <ChevronDown size={14} />
          </summary>
          <RangeControl
            label="Tumor opacity"
            value={state.tumorOpacity}
            onChange={(tumorOpacity) => state.set({ tumorOpacity })}
          />
          <RangeControl
            label="Mask opacity"
            value={state.maskOpacity}
            onChange={(maskOpacity) => state.set({ maskOpacity })}
          />
          <p className="inspector-note">
            Drag to rotate · Scroll to zoom
            <br />
            Right-drag to pan
          </p>
        </details>
        <div className="inspector-divider" />
        <button
          className="visibility-control"
          aria-label={state.tumorVisible ? 'Hide tumor' : 'Show tumor'}
          aria-pressed={state.tumorVisible}
          onClick={() => state.set({ tumorVisible: !state.tumorVisible })}
        >
          {state.tumorVisible ? <Eye size={17} /> : <EyeOff size={17} />}
          <span>Tumor regions</span>
          <i className={`switch-track ${state.tumorVisible ? 'on' : ''}`} />
        </button>
        <div className="segmentation-legend">
          {[2, 1, 4].map((label) => (
            <span key={label}>
              <i style={{ background: LABEL_COLORS[label] }} />
              {LABEL_NAMES[label]}
            </span>
          ))}
        </div>
        <button
          className="visibility-control"
          aria-label="Toggle MRI slice planes"
          aria-pressed={state.planesVisible}
          onClick={() => state.set({ planesVisible: !state.planesVisible })}
        >
          <Layers3 size={17} />
          <span>MRI slice planes</span>
          <i className={`switch-track ${state.planesVisible ? 'on' : ''}`} />
        </button>
      </div>
    </details>
  );
}
