import { InterpolatedPose, TAU } from '@/core';
import type { FixedStepSystem } from '../SystemScheduler';

/**
 * Temporary stand-in for a robot: drives a figure-eight at constant speed using only
 * the fixed timestep. If rendering is correct, motion looks identical at 30, 60 or 144 fps.
 * Removed once real drivetrains arrive (stage 4).
 */
export class TestBodySim implements FixedStepSystem {
  readonly name = 'testBody';
  readonly pose = new InterpolatedPose();
  private phase = 0;

  constructor(
    private readonly centerX: number,
    private readonly centerY: number,
    private readonly radiusM = 3,
    private readonly periodS = 8,
  ) {
    this.evaluate();
    this.pose.beginStep();
  }

  fixedUpdate(dt: number): void {
    this.pose.beginStep();
    this.phase = (this.phase + (TAU * dt) / this.periodS) % TAU;
    this.evaluate();
  }

  private evaluate(): void {
    // Lemniscate of Gerono: x = sin(t), y = sin(t)cos(t). Heading follows the velocity.
    const t = this.phase;
    const r = this.radiusM;
    const x = this.centerX + r * Math.sin(t);
    const y = this.centerY + r * Math.sin(t) * Math.cos(t);
    const dx = r * Math.cos(t);
    const dy = r * Math.cos(2 * t);
    const c = this.pose.current;
    c.x = x;
    c.y = y;
    c.heading = Math.atan2(dy, dx);
  }
}
