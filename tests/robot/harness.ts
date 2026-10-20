import { FixedStepper } from '@/core/loop/FixedStepper';
import { buildPlanarWorldOptions } from '@/field/planarCollision';
import { createRebuiltField } from '@/game/seasons/rebuilt2026';
import { PlanarWorld } from '@/physics/planar';
import { DEFAULT_ROBOT } from '@/robot/config/presets';
import type { RobotConfig } from '@/robot/config/types';
import { type DriveCommand, makeDriveCommand } from '@/robot/DriveCommand';
import { Robot } from '@/robot/Robot';

export const PHYSICS_HZ = 120;
export const CONTROL_DIVISOR = 2;
export const DT = 1 / PHYSICS_HZ;

/** A large empty area: motion tests are not affected by the field. */
export function openWorld(): PlanarWorld {
  return new PlanarWorld({
    bounds: { minX: -100, maxX: 100, minY: -100, maxY: 100 },
    obstacles: [],
    ramps: [],
  });
}

export function fieldWorld(config: RobotConfig = DEFAULT_ROBOT): PlanarWorld {
  return new PlanarWorld(buildPlanarWorldOptions(createRebuiltField(), config.chassis));
}

export function cmd(partial: Partial<DriveCommand>): DriveCommand {
  return { ...makeDriveCommand(), ...partial };
}

/**
 * Headless driver: steps the robot exactly as the engine does (control every 2nd physics
 * tick) for a number of simulated seconds.
 */
export class Sim {
  readonly robot: Robot;
  tick = 0;

  constructor(world = openWorld(), config: RobotConfig = DEFAULT_ROBOT, x = 0, y = 0, heading = 0) {
    this.robot = new Robot(config, world);
    this.robot.reset(x, y, heading);
  }

  step(command: DriveCommand): void {
    if (this.tick % CONTROL_DIVISOR === 0) this.robot.control(command, DT * CONTROL_DIVISOR);
    this.robot.step(DT);
    this.tick++;
  }

  run(command: DriveCommand, seconds: number, each?: (sim: Sim) => void): this {
    const steps = Math.round(seconds * PHYSICS_HZ);
    for (let i = 0; i < steps; i++) {
      this.step(command);
      each?.(this);
    }
    return this;
  }

  /** Steps driven by real frame times through the same fixed stepper the engine uses. */
  private readonly stepper = new FixedStepper({ stepHz: PHYSICS_HZ, maxSubSteps: 12 });

  /** Real frame times → fixed steps, via the same FixedStepper the engine uses. */
  runFrames(
    command: (t: number) => DriveCommand,
    frameTimes: readonly number[],
    maxTicks = Infinity,
  ): this {
    for (const frame of frameTimes) {
      this.stepper.advance(frame, () => {
        if (this.tick < maxTicks) this.step(command(this.tick * DT));
      });
    }
    return this;
  }

  get pose() {
    return this.robot.current;
  }

  get speed(): number {
    return Math.hypot(this.robot.body.vx, this.robot.body.vy);
  }
}
