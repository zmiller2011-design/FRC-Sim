export interface FixedStepSystem {
  readonly name: string;
  /** Called at a fixed rate. `dt` is constant for a given configuration. */
  fixedUpdate(dt: number, tick: number): void;
}

export interface RenderSyncSystem {
  readonly name: string;
  /** Called once per rendered frame. `alpha` in [0, 1) interpolates the last two fixed steps. */
  sync(alpha: number, frameDt: number): void;
}

/**
 * Run order of fixed-step work. `physics` runs every step; `logic` runs every
 * `logicDivisor` steps (robot code at 50 Hz on a 200 Hz physics step).
 */
export type FixedPhase = 'input' | 'logic' | 'prePhysics' | 'physics' | 'postPhysics' | 'rules';

export const FIXED_PHASE_ORDER: readonly FixedPhase[] = [
  'input',
  'logic',
  'prePhysics',
  'physics',
  'postPhysics',
  'rules',
];

const LOGIC_RATE_PHASES: ReadonlySet<FixedPhase> = new Set(['input', 'logic']);

export class SystemScheduler {
  private readonly fixed = new Map<FixedPhase, FixedStepSystem[]>(
    FIXED_PHASE_ORDER.map((phase) => [phase, []]),
  );
  private readonly render: RenderSyncSystem[] = [];
  private logicDivisor: number;

  constructor(logicDivisor: number) {
    this.logicDivisor = Math.max(1, Math.round(logicDivisor));
  }

  setLogicDivisor(divisor: number): void {
    this.logicDivisor = Math.max(1, Math.round(divisor));
  }

  addFixed(phase: FixedPhase, system: FixedStepSystem): () => void {
    const list = this.fixed.get(phase)!;
    list.push(system);
    return () => {
      const i = list.indexOf(system);
      if (i >= 0) list.splice(i, 1);
    };
  }

  addRender(system: RenderSyncSystem): () => void {
    this.render.push(system);
    return () => {
      const i = this.render.indexOf(system);
      if (i >= 0) this.render.splice(i, 1);
    };
  }

  /** Runs one physics step. Logic-rate phases run on every `logicDivisor`-th tick with a scaled dt. */
  runFixed(dt: number, tick: number): void {
    const isLogicTick = tick % this.logicDivisor === 0;
    const logicDt = dt * this.logicDivisor;
    for (let p = 0; p < FIXED_PHASE_ORDER.length; p++) {
      const phase = FIXED_PHASE_ORDER[p]!;
      const logicRate = LOGIC_RATE_PHASES.has(phase);
      if (logicRate && !isLogicTick) continue;
      const systems = this.fixed.get(phase)!;
      const phaseDt = logicRate ? logicDt : dt;
      for (let i = 0; i < systems.length; i++) systems[i]!.fixedUpdate(phaseDt, tick);
    }
  }

  runRender(alpha: number, frameDt: number): void {
    for (let i = 0; i < this.render.length; i++) this.render[i]!.sync(alpha, frameDt);
  }

  clear(): void {
    for (const list of this.fixed.values()) list.length = 0;
    this.render.length = 0;
  }
}
