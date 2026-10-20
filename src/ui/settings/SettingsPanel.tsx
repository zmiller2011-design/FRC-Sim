import { type ChangeEvent, type ReactNode, useId } from 'react';
import {
  graphicsForPreset,
  QUALITY_PRESET_ORDER,
  type QualityPreset,
  type SettingsPatch,
} from '@/settings';
import { uiStore } from '@/state';
import { useUiStore } from '../hooks/useUiStore';

const PHYSICS_RATES = [60, 120, 240] as const;
const SHADOW_SIZES = [1024, 2048, 4096] as const;

const update = (patch: SettingsPatch) => uiStore.getState().updateSettings(patch);
const capitalize = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings__section">
      <h3 className="settings__heading">{title}</h3>
      {children}
    </section>
  );
}

function Toggle(props: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange(v: boolean): void;
}) {
  return (
    <label className="toggle">
      <span className="toggle__text">
        <span>{props.label}</span>
        {props.hint && <span className="toggle__hint">{props.hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
    </label>
  );
}

export function SettingsPanel() {
  const settings = useUiStore((s) => s.settings);
  const { graphics, simulation } = settings;
  const id = useId();

  const onPreset = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value !== 'custom') update({ graphics: graphicsForPreset(value as QualityPreset) });
  };
  const custom = (patch: NonNullable<SettingsPatch['graphics']>) =>
    update({ graphics: { ...patch, preset: 'custom' } });

  return (
    <div className="settings">
      <h2 className="settings__title">Settings</h2>

      <Section title="Graphics">
        <label className="field" htmlFor={`${id}-preset`}>
          <span className="field__label">Quality preset</span>
          <select id={`${id}-preset`} value={graphics.preset} onChange={onPreset}>
            {QUALITY_PRESET_ORDER.map((p) => (
              <option key={p} value={p}>
                {capitalize(p)}
              </option>
            ))}
            <option value="custom" disabled>
              Custom
            </option>
          </select>
        </label>

        <label className="field" htmlFor={`${id}-scale`}>
          <span className="field__label">
            Render resolution <output>{Math.round(graphics.renderScale * 100)}%</output>
          </span>
          <input
            id={`${id}-scale`}
            type="range"
            min={0.5}
            max={1}
            step={0.05}
            value={graphics.renderScale}
            onChange={(e) => custom({ renderScale: Number(e.target.value) })}
          />
        </label>

        <label className="field" htmlFor={`${id}-dpr`}>
          <span className="field__label">
            Pixel ratio cap <output>{graphics.pixelRatioCap.toFixed(2)}×</output>
          </span>
          <input
            id={`${id}-dpr`}
            type="range"
            min={0.5}
            max={3}
            step={0.25}
            value={graphics.pixelRatioCap}
            onChange={(e) => custom({ pixelRatioCap: Number(e.target.value) })}
          />
        </label>

        <Toggle
          label="Antialiasing"
          hint="Smoother edges. Briefly restarts the renderer."
          checked={graphics.antialias}
          onChange={(antialias) => custom({ antialias })}
        />
        <Toggle
          label="Shadows"
          hint="One shadow-casting light. Costs an extra render pass."
          checked={graphics.shadows}
          onChange={(shadows) => custom({ shadows })}
        />
        <label className="field" htmlFor={`${id}-shadow`}>
          <span className="field__label">Shadow quality</span>
          <select
            id={`${id}-shadow`}
            value={graphics.shadowMapSize}
            disabled={!graphics.shadows}
            onChange={(e) => custom({ shadowMapSize: Number(e.target.value) })}
          >
            {SHADOW_SIZES.map((size) => (
              <option key={size} value={size}>
                {size === 1024 ? 'Low' : size === 2048 ? 'Medium' : 'High'} ({size}px)
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section title="Field">
        <label className="field" htmlFor={`${id}-variant`}>
          <span className="field__label">Field construction</span>
          <select
            id={`${id}-variant`}
            value={settings.field.variant}
            onChange={(e) =>
              update({ field: { variant: e.target.value === 'andymark' ? 'andymark' : 'welded' } })
            }
          >
            <option value="welded">Welded (official drawings)</option>
            <option value="andymark">AndyMark</option>
          </select>
        </label>
        <Toggle
          label="Show collision geometry"
          hint="Wireframe of the simplified shapes physics will use."
          checked={settings.field.showColliders}
          onChange={(showColliders) => update({ field: { showColliders } })}
        />
      </Section>

      <Section title="Driving">
        <Toggle
          label="Field-relative"
          hint="Forward is away from your alliance wall. Toggle with F."
          checked={settings.driving.fieldRelative}
          onChange={(fieldRelative) => update({ driving: { fieldRelative } })}
        />
        <label className="field" htmlFor={`${id}-neutral`}>
          <span className="field__label">When no input</span>
          <select
            id={`${id}-neutral`}
            value={settings.driving.neutralMode}
            onChange={(e) =>
              update({ driving: { neutralMode: e.target.value === 'coast' ? 'coast' : 'brake' } })
            }
          >
            <option value="brake">Brake (motors resist motion)</option>
            <option value="coast">Coast (robot glides)</option>
          </select>
        </label>
      </Section>

      <Section title="Simulation">
        <label className="field" htmlFor={`${id}-hz`}>
          <span className="field__label">Physics rate</span>
          <select
            id={`${id}-hz`}
            value={simulation.physicsHz}
            onChange={(e) => update({ simulation: { physicsHz: Number(e.target.value) } })}
          >
            {PHYSICS_RATES.map((hz) => (
              <option key={hz} value={hz}>
                {hz} Hz (control {hz / simulation.logicDivisor} Hz)
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section title="Diagnostics">
        <Toggle
          label="Performance overlay"
          hint="Toggle with the ` key."
          checked={settings.interface.showPerfOverlay}
          onChange={(showPerfOverlay) => update({ interface: { showPerfOverlay } })}
        />
        <Toggle
          label="Robot telemetry"
          hint="Velocity, acceleration, heading, module states. Toggle with T."
          checked={settings.interface.showRobotTelemetry}
          onChange={(showRobotTelemetry) => update({ interface: { showRobotTelemetry } })}
        />
      </Section>
    </div>
  );
}
