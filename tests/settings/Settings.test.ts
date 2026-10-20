import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from '@/settings/Settings';

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
    expect(merged.simulation.physicsHz).toBe(1000);
    expect(merged.simulation.maxSubSteps).toBe(DEFAULT_SETTINGS.simulation.maxSubSteps);
    expect(merged.graphics.pixelRatioCap).toBe(0.5);
  });
});
