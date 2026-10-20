import { DEFAULT_SETTINGS, mergeSettings, type Settings, type SettingsPatch } from '@/settings';

// v3: 120 Hz physics default and driving settings; older values are intentionally not migrated.
const SETTINGS_KEY = 'frc-sim.settings.v3';

/** Storage may be unavailable (private mode, blocked site data), so every access is guarded. */
function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persisting is a convenience; the app works without it.
  }
}

export function loadSettings(): Settings {
  const stored = readJson(SETTINGS_KEY);
  if (!stored || typeof stored !== 'object') return DEFAULT_SETTINGS;
  // mergeSettings clamps every numeric field, which guards against stale or edited values.
  return mergeSettings(DEFAULT_SETTINGS, stored as SettingsPatch);
}

export function saveSettings(settings: Settings): void {
  writeJson(SETTINGS_KEY, settings);
}
