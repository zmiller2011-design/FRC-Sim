export interface FixedStepperConfig {
  /** Simulation steps per simulated second. */
  stepHz: number;
  /** Maximum steps run for one frame. Excess time is dropped (prevents the spiral of death). */
  maxSubSteps: number;
}

/** Tolerance so that frame times that are exact multiples of dt don't lose a step to rounding. */
const STEP_EPSILON = 1e-9;

/**
 * Converts variable real frame times into a whole number of fixed simulation steps.
 * Pure and clock-free: the caller supplies elapsed time, so it runs identically in the
 * browser, in tests and on a headless server.
 */
export class FixedStepper {
  private _dt: number;
  private maxSubSteps: number;
  private accumulator = 0;

  /** Total steps executed since construction or reset. */
  tick = 0;
  /** Interpolation factor in [0, 1) between the last two steps, valid after `advance`. */
  alpha = 0;
  /** Steps executed by the most recent `advance`. */
  lastStepCount = 0;
  /** Simulated seconds discarded because `maxSubSteps` was reached (cumulative). */
  droppedTime = 0;

  constructor(config: FixedStepperConfig) {
    this._dt = 1 / config.stepHz;
    this.maxSubSteps = config.maxSubSteps;
  }

  get dt(): number {
    return this._dt;
  }

  /** Simulated time in seconds, derived from the tick count so it never drifts. */
  get simTime(): number {
    return this.tick * this._dt;
  }

  configure(config: FixedStepperConfig): void {
    // Preserve the fractional progress toward the next step when the rate changes.
    const progress = this.accumulator / this._dt;
    this._dt = 1 / config.stepHz;
    this.maxSubSteps = config.maxSubSteps;
    this.accumulator = progress * this._dt;
  }

  /**
   * Adds `elapsed` simulated seconds and runs as many fixed steps as fit.
   * @returns the number of steps executed.
   */
  advance(elapsed: number, step: (dt: number, tick: number) => void): number {
    if (elapsed > 0) this.accumulator += elapsed;

    let steps = 0;
    while (this.accumulator + STEP_EPSILON >= this._dt && steps < this.maxSubSteps) {
      step(this._dt, this.tick);
      this.tick++;
      this.accumulator -= this._dt;
      steps++;
    }

    if (this.accumulator + STEP_EPSILON >= this._dt) {
      // Fell behind: keep only the partial step so we don't try to catch up forever.
      // Not `%`: floating-point modulo can return almost a whole step instead of ~0.
      const wholeSteps = Math.floor((this.accumulator + STEP_EPSILON) / this._dt);
      const remainder = Math.max(0, this.accumulator - wholeSteps * this._dt);
      this.droppedTime += this.accumulator - remainder;
      this.accumulator = remainder;
    }
    if (this.accumulator < 0) this.accumulator = 0;

    this.alpha = Math.min(this.accumulator / this._dt, 1 - Number.EPSILON);
    this.lastStepCount = steps;
    return steps;
  }

  reset(): void {
    this.accumulator = 0;
    this.tick = 0;
    this.alpha = 0;
    this.lastStepCount = 0;
    this.droppedTime = 0;
  }
}
