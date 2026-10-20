import { type ChangeEvent, useId } from 'react';
import {
  graphicsForPreset,
  QUALITY_PRESET_ORDER,
  type QualityPreset,
  type SettingsPatch,
} from '@/settings';
import { uiStore } from '@/state';
import { useUiStore } from '../hooks/useUiStore';

const PHYSICS_RATES = [120, 200, 240, 500] as const;

const update = (patch: SettingsPatch) => uiStore.getState().updateSettings(patch);

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useUiStore((s) => s.settings);
  const { graphics, simulation } = settings;
  const id = useId();

  const onPreset = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value !== 'custom') update({ graphics: graphicsForPreset(value as QualityPreset) });
  };

  return (
    <section className="panel settings" aria-label="Settings">
      <header className="settings__header">
        <h2>Settings</h2>
        <button className="button button--ghost" onClick={onClose} aria-label="Close settings">
          ✕
        </button>
      </header>

      <h3>Graphics</h3>
      <label className="field" htmlFor={`${id}-preset`}>
        <span>Quality</span>
        <select id={`${id}-preset`} value={graphics.preset} onChange={onPreset}>
          {QUALITY_PRESET_ORDER.map((p) => (
            <option key={p} value={p}>
              {p[0]!.toUpperCase() + p.slice(1)}
            </option>
          ))}
          <option value="custom" disabled>
            Custom
          </option>
        </select>
      </label>
      <label className="field" htmlFor={`${id}-dpr`}>
        <span>Resolution cap ({graphics.pixelRatioCap.toFixed(2)}×)</span>
        <input
          id={`${id}-dpr`}
          type="range"
          min={0.5}
          max={3}
          step={0.25}
          value={graphics.pixelRatioCap}
          onChange={(e) =>
            update({ graphics: { preset: 'custom', pixelRatioCap: Number(e.target.value) } })
          }
        />
      </label>
      <label className="field field--inline">
        <input
          type="checkbox"
          checked={graphics.shadows}
          onChange={(e) => update({ graphics: { preset: 'custom', shadows: e.target.checked } })}
        />
        <span>Shadows</span>
      </label>
      <label className="field field--inline">
        <input
          type="checkbox"
          checked={graphics.antialias}
          onChange={(e) => update({ graphics: { preset: 'custom', antialias: e.target.checked } })}
        />
        <span>Antialiasing</span>
      </label>

      <h3>Simulation</h3>
      <label className="field" htmlFor={`${id}-hz`}>
        <span>Physics rate</span>
        <select
          id={`${id}-hz`}
          value={simulation.physicsHz}
          onChange={(e) => update({ simulation: { physicsHz: Number(e.target.value) } })}
        >
          {PHYSICS_RATES.map((hz) => (
            <option key={hz} value={hz}>
              {hz} Hz
            </option>
          ))}
        </select>
      </label>

      <h3>Interface</h3>
      <label className="field field--inline">
        <input
          type="checkbox"
          checked={settings.interface.showPerfOverlay}
          onChange={(e) => update({ interface: { showPerfOverlay: e.target.checked } })}
        />
        <span>Performance overlay</span>
      </label>
    </section>
  );
}
