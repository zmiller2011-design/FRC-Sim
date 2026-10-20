import { createStore } from 'zustand/vanilla';
import { mergeSettings, type Settings, type SettingsPatch } from '@/settings';
import type { PerfSample } from './perf';
import { loadSettings, saveSettings } from './persistence';

export type Screen = 'menu' | 'sandbox';

export interface UiState {
  screen: Screen;
  settings: Settings;
  paused: boolean;
  /** Latest throttled performance sample, or null before the first one arrives. */
  perf: Readonly<PerfSample> | null;

  setScreen(screen: Screen): void;
  updateSettings(patch: SettingsPatch): void;
  setPaused(paused: boolean): void;
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
  perf: null,

  setScreen: (screen) => set({ screen }),
  updateSettings: (patch) => {
    const settings = mergeSettings(get().settings, patch);
    saveSettings(settings);
    set({ settings });
  },
  setPaused: (paused) => set({ paused }),
  publishPerf: (sample) => set({ perf: { ...sample } }),
}));
