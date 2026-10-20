export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface GraphicsSettings {
  preset: QualityPreset | 'custom';
  /** Upper bound for the canvas pixel ratio. Lower values trade sharpness for GPU time on high-DPI screens. */
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

export interface Settings {
  graphics: GraphicsSettings;
  simulation: SimulationSettings;
  interface: InterfaceSettings;
}

export type SettingsPatch = {
  [K in keyof Settings]?: Partial<Settings[K]>;
};

export const DEFAULT_SETTINGS: Settings = {
  graphics: {
    preset: 'medium',
    pixelRatioCap: 1.5,
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
  },
  simulation: {
    physicsHz: 200,
    logicDivisor: 4,
    maxSubSteps: 12,
  },
  interface: {
    showPerfOverlay: true,
    telemetryHz: 10,
  },
};

const LIMITS = {
  pixelRatioCap: [0.5, 3],
  shadowMapSize: [256, 8192],
  physicsHz: [60, 1000],
  logicDivisor: [1, 20],
  maxSubSteps: [1, 64],
  telemetryHz: [1, 60],
} as const;

function clampSetting(key: keyof typeof LIMITS, value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const [min, max] = LIMITS[key];
  return Math.min(Math.max(value, min), max);
}

/** Merges a partial patch into settings and clamps numeric values to safe ranges. */
export function mergeSettings(base: Settings, patch: SettingsPatch): Settings {
  const g = { ...base.graphics, ...patch.graphics };
  const s = { ...base.simulation, ...patch.simulation };
  const i = { ...base.interface, ...patch.interface };
  return {
    graphics: {
      ...g,
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
  };
}
