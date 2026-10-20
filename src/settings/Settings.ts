export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface GraphicsSettings {
  preset: QualityPreset | 'custom';
  /**
   * Fraction of the display resolution to render at (0.5–1). The canvas is scaled up to fill
   * the viewport, so lower values trade sharpness for GPU time.
   */
  renderScale: number;
  /** Upper bound for the device pixel ratio. Keeps 4K and high-DPI laptop screens affordable. */
  pixelRatioCap: number;
  /** Multisample antialiasing. Changing it recreates the WebGL context. */
  antialias: boolean;
  shadows: boolean;
  /** Shadow map resolution in pixels (square). */
  shadowMapSize: number;
}

export interface SimulationSettings {
  /** Physics steps per simulated second. */
  physicsHz: number;
  /** Robot logic runs every N physics steps (200 Hz / 4 = 50 Hz, the roboRIO loop rate). */
  logicDivisor: number;
  /** Maximum physics steps per rendered frame before simulated time is dropped. */
  maxSubSteps: number;
}

export interface InterfaceSettings {
  showPerfOverlay: boolean;
  /** How often the simulation publishes numbers to the UI. */
  telemetryHz: number;
}

export type FieldVariant = 'welded' | 'andymark';

export interface FieldSettings {
  /** Official field construction to model; the two differ by a few centimetres. */
  variant: FieldVariant;
  /** Draw the simplified collision shapes as a wireframe overlay. */
  showColliders: boolean;
}

export interface Settings {
  graphics: GraphicsSettings;
  simulation: SimulationSettings;
  interface: InterfaceSettings;
  field: FieldSettings;
}

export type SettingsPatch = {
  [K in keyof Settings]?: Partial<Settings[K]>;
};

/** True in the Vite dev server. Guarded so this module also loads in plain Node (headless server). */
const IS_DEV = import.meta.env?.DEV ?? false;

export const DEFAULT_SETTINGS: Settings = {
  graphics: {
    // Must match QUALITY_PRESETS.medium: shadows start disabled.
    preset: 'medium',
    renderScale: 1,
    pixelRatioCap: 1.5,
    antialias: true,
    shadows: false,
    shadowMapSize: 1024,
  },
  simulation: {
    physicsHz: 200,
    logicDivisor: 4,
    maxSubSteps: 12,
  },
  interface: {
    showPerfOverlay: IS_DEV,
    telemetryHz: 10,
  },
  field: {
    variant: 'welded',
    showColliders: false,
  },
};

const LIMITS = {
  renderScale: [0.5, 1],
  pixelRatioCap: [0.5, 3],
  shadowMapSize: [256, 8192],
  physicsHz: [60, 1000],
  logicDivisor: [1, 20],
  maxSubSteps: [1, 64],
  telemetryHz: [1, 60],
} as const;

function clampSetting(key: keyof typeof LIMITS, value: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const [min, max] = LIMITS[key];
  return Math.min(Math.max(value, min), max);
}

/** Merges a partial patch into settings and clamps numeric values to safe ranges. */
export function mergeSettings(base: Settings, patch: SettingsPatch): Settings {
  const g = { ...base.graphics, ...patch.graphics };
  const s = { ...base.simulation, ...patch.simulation };
  const i = { ...base.interface, ...patch.interface };
  const f = { ...base.field, ...patch.field };
  return {
    graphics: {
      ...g,
      renderScale: clampSetting('renderScale', g.renderScale, base.graphics.renderScale),
      pixelRatioCap: clampSetting('pixelRatioCap', g.pixelRatioCap, base.graphics.pixelRatioCap),
      shadowMapSize: clampSetting('shadowMapSize', g.shadowMapSize, base.graphics.shadowMapSize),
    },
    simulation: {
      physicsHz: clampSetting('physicsHz', s.physicsHz, base.simulation.physicsHz),
      logicDivisor: Math.round(
        clampSetting('logicDivisor', s.logicDivisor, base.simulation.logicDivisor),
      ),
      maxSubSteps: Math.round(
        clampSetting('maxSubSteps', s.maxSubSteps, base.simulation.maxSubSteps),
      ),
    },
    interface: {
      ...i,
      telemetryHz: clampSetting('telemetryHz', i.telemetryHz, base.interface.telemetryHz),
    },
    field: {
      variant: f.variant === 'andymark' ? 'andymark' : 'welded',
      showColliders: f.showColliders === true,
    },
  };
}

/** Effective canvas pixel ratio for a display with the given device pixel ratio. */
export function effectivePixelRatio(graphics: GraphicsSettings, devicePixelRatio: number): number {
  return Math.min(devicePixelRatio || 1, graphics.pixelRatioCap) * graphics.renderScale;
}
