import type { GraphicsSettings, QualityPreset } from './Settings';

/**
 * Low and Medium keep shadows off: a shadow pass re-renders the scene from the light,
 * which is the single most expensive optional feature. High and Ultra enable them.
 */
export const QUALITY_PRESETS: Record<QualityPreset, Omit<GraphicsSettings, 'preset'>> = {
  low: {
    renderScale: 0.75,
    pixelRatioCap: 1,
    antialias: false,
    shadows: false,
    shadowMapSize: 1024,
  },
  medium: {
    renderScale: 1,
    pixelRatioCap: 1.5,
    antialias: true,
    shadows: false,
    shadowMapSize: 1024,
  },
  high: { renderScale: 1, pixelRatioCap: 2, antialias: true, shadows: true, shadowMapSize: 2048 },
  ultra: { renderScale: 1, pixelRatioCap: 3, antialias: true, shadows: true, shadowMapSize: 4096 },
};

export const QUALITY_PRESET_ORDER: readonly QualityPreset[] = ['low', 'medium', 'high', 'ultra'];

export function graphicsForPreset(preset: QualityPreset): GraphicsSettings {
  return { preset, ...QUALITY_PRESETS[preset] };
}
