import { describe, expect, it } from 'vitest';
import { QUALITY_PRESET_ORDER, QUALITY_PRESETS } from '@/settings/qualityPresets';
import { DEFAULT_SETTINGS, effectivePixelRatio, mergeSettings } from '@/settings/Settings';

describe('mergeSettings', () => {
  it('applies partial patches without touching other groups', () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, { graphics: { shadows: false } });
    expect(merged.graphics.shadows).toBe(false);
    expect(merged.graphics.pixelRatioCap).toBe(DEFAULT_SETTINGS.graphics.pixelRatioCap);
    expect(merged.simulation).toEqual(DEFAULT_SETTINGS.simulation);
  });

  it('clamps unsafe values and rejects non-numbers', () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, {
      simulation: { physicsHz: 1_000_000, maxSubSteps: Number.NaN },
      graphics: { pixelRatioCap: 0 },
    });
    expect(merged.simulation.physicsHz).toBe(480);
    expect(merged.simulation.maxSubSteps).toBe(DEFAULT_SETTINGS.simulation.maxSubSteps);
    expect(merged.graphics.pixelRatioCap).toBe(0.5);
  });
});

describe('render resolution', () => {
  it('clamps render scale to 50–100%', () => {
    expect(
      mergeSettings(DEFAULT_SETTINGS, { graphics: { renderScale: 0.1 } }).graphics.renderScale,
    ).toBe(0.5);
    expect(
      mergeSettings(DEFAULT_SETTINGS, { graphics: { renderScale: 2 } }).graphics.renderScale,
    ).toBe(1);
  });

  it('caps device pixel ratio, then applies render scale', () => {
    const g = { ...DEFAULT_SETTINGS.graphics, pixelRatioCap: 1.5, renderScale: 0.5 };
    expect(effectivePixelRatio(g, 3)).toBeCloseTo(0.75);
    expect(effectivePixelRatio(g, 1)).toBeCloseTo(0.5);
    expect(effectivePixelRatio({ ...g, renderScale: 1 }, 0)).toBe(1);
  });
});

describe('defaults', () => {
  it('match the Medium preset, with shadows disabled', () => {
    const { preset, ...rest } = DEFAULT_SETTINGS.graphics;
    expect(preset).toBe('medium');
    expect(rest).toEqual(QUALITY_PRESETS.medium);
    expect(DEFAULT_SETTINGS.graphics.shadows).toBe(false);
  });

  it('only High and Ultra presets enable shadows', () => {
    expect(QUALITY_PRESET_ORDER.filter((p) => QUALITY_PRESETS[p].shadows)).toEqual([
      'high',
      'ultra',
    ]);
  });
});

describe('driving settings', () => {
  it('default to 120 Hz physics, 60 Hz control, field-relative, brake', () => {
    expect(DEFAULT_SETTINGS.simulation.physicsHz).toBe(120);
    expect(DEFAULT_SETTINGS.simulation.physicsHz / DEFAULT_SETTINGS.simulation.logicDivisor).toBe(
      60,
    );
    expect(DEFAULT_SETTINGS.driving).toEqual({ fieldRelative: true, neutralMode: 'brake' });
  });

  it('rejects unknown neutral modes', () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, {
      driving: { neutralMode: 'freewheel' as never },
    });
    expect(merged.driving.neutralMode).toBe('brake');
  });
});
