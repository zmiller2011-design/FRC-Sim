import type { GraphicsSettings, QualityPreset } from './Settings';

export const QUALITY_PRESETS: Record<QualityPreset, Omit<GraphicsSettings, 'preset'>> = {
  low: { pixelRatioCap: 1, antialias: false, shadows: false, shadowMapSize: 1024 },
  medium: { pixelRatioCap: 1.5, antialias: true, shadows: true, shadowMapSize: 2048 },
  high: { pixelRatioCap: 2, antialias: true, shadows: true, shadowMapSize: 2048 },
  ultra: { pixelRatioCap: 3, antialias: true, shadows: true, shadowMapSize: 4096 },
};

export const QUALITY_PRESET_ORDER: readonly QualityPreset[] = ['low', 'medium', 'high', 'ultra'];

export function graphicsForPreset(preset: QualityPreset): GraphicsSettings {
  return { preset, ...QUALITY_PRESETS[preset] };
}
