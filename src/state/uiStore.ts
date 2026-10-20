import { createStore } from 'zustand/vanilla';
import { mergeSettings, type Settings, type SettingsPatch } from '@/settings';
import type { PerfSample, RenderStatus } from './perf';
import { loadSettings, saveSettings } from './persistence';

export type Screen = 'menu' | 'sandbox';

/** Mirrors the engine's camera mode ids (state may not import from the engine). */
export type CameraView = 'orbit' | 'overhead' | 'blueStation' | 'redStation';

export interface UiState {
  screen: Screen;
  settings: Settings;
  paused: boolean;
  /** Simulation speed multiplier (1 = real time). */
  timeScale: number;
  renderStatus: RenderStatus;
  cameraView: CameraView;
  /** Latest throttled performance sample, or null before the first one arrives. */
  perf: Readonly<PerfSample> | null;

  setScreen(screen: Screen): void;
  updateSettings(patch: SettingsPatch): void;
  setPaused(paused: boolean): void;
  setTimeScale(timeScale: number): void;
  setRenderStatus(status: RenderStatus): void;
  setCameraView(view: CameraView): void;
  /** Copies the sample: the engine reuses its object between publishes. */
  publishPerf(sample: Readonly<PerfSample>): void;
}

/**
 * UI-facing state. The simulation never reads from here; it only receives
 * settings through the engine API and publishes throttled snapshots in.
 */
export const uiStore = createStore<UiState>()((set, get) => ({
  screen: 'menu',
  settings: loadSettings(),
  paused: false,
  timeScale: 1,
  renderStatus: 'ok',
  cameraView: 'orbit',
  perf: null,

  setScreen: (screen) => set({ screen }),
  updateSettings: (patch) => {
    const settings = mergeSettings(get().settings, patch);
    saveSettings(settings);
    set({ settings });
  },
  setPaused: (paused) => set({ paused }),
  setTimeScale: (timeScale) => set({ timeScale }),
  setRenderStatus: (renderStatus) => set({ renderStatus }),
  setCameraView: (cameraView) => set({ cameraView }),
  publishPerf: (sample) => set({ perf: { ...sample } }),
}));
