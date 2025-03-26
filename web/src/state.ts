import { create } from 'zustand';
import type { CameraState, Modality, Region, Vec3, ViewMode } from './types';

export type Theme = 'dark' | 'light';
const initialTheme: Theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

interface WorkspaceState {
  theme: Theme;
  toggleTheme: () => void;
  modality: Modality;
  region: Region;
  mode: ViewMode;
  crosshair: Vec3;
  brainOpacity: number;
  tumorOpacity: number;
  maskOpacity: number;
  tumorVisible: boolean;
  planesVisible: boolean;
  synchronized: boolean;
  camera: CameraState | null;
  resetVersion: number;
  window: number;
  level: number;
  set: (value: Partial<Omit<WorkspaceState, 'set' | 'resetCamera' | 'publishCamera'>>) => void;
  resetCamera: () => void;
  publishCamera: (position: Vec3, target: Vec3, source: string) => void;
}
export const useWorkspace = create<WorkspaceState>((set) => ({
  theme: initialTheme,
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'dark' ? '#111e2b' : '#f3f6f9');
      try {
        localStorage.setItem('tumorgen-redesign-theme', theme);
      } catch {
        /* Storage is optional. */
      }
      return { theme };
    }),
  modality: 'T1GD',
  region: 'WT',
  mode: 'combined',
  crosshair: [0, 0, 0],
  brainOpacity: 0.28,
  tumorOpacity: 0.95,
  maskOpacity: 0.45,
  tumorVisible: true,
  planesVisible: false,
  synchronized: true,
  camera: null,
  resetVersion: 0,
  window: 255,
  level: 127.5,
  set: (value) => set(value),
  resetCamera: () => set((state) => ({ camera: null, resetVersion: state.resetVersion + 1 })),
  publishCamera: (position, target, source) =>
    set((state) => ({
      camera: {
        position,
        target,
        source,
        revision: (state.camera?.revision ?? 0) + 1,
      },
    })),
}));
