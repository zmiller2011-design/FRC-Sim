import { type ChassisSpeeds, clamp } from '@/core';
import type { RobotConfig } from '../config/types';
import type { DriveCommand } from '../DriveCommand';
import {
  desaturate,
  fieldToRobot,
  makeModuleStates,
  type ModuleState,
  optimize,
  SwerveKinematics,
} from './kinematics';
import { SwerveModuleSim } from './SwerveModuleSim';

/** Requests smaller than this (m/s or rad/s) count as "no input". */
const IDLE_EPSILON = 1e-3;

/**
 * Drivetrain controller: turns a {@link DriveCommand} into module targets the way robot
 * code would. Command slew limits keep requests physically sensible; the module and
 * chassis physics decide what actually happens.
 */
export class SwerveDrivetrain {
  readonly modules: readonly SwerveModuleSim[];
  readonly kinematics: SwerveKinematics;
  /** Slew-limited request in the field frame (m/s, rad/s). */
  readonly limitedField: ChassisSpeeds = { vx: 0, vy: 0, omega: 0 };
  /** Last robot-relative speeds sent to the kinematics. */
  readonly requested: ChassisSpeeds = { vx: 0, vy: 0, omega: 0 };

  private readonly states: ModuleState[];
  private readonly currentAngles: number[];
  private readonly maxWheelSpeed: number;
  /** True while no motion is requested: motors are in their neutral (brake/coast) mode. */
  neutral = true;

  constructor(private readonly config: RobotConfig) {
    this.modules = config.modules.map((m) => new SwerveModuleSim(m, config.moduleHardware));
    // Kinematics about the centre of mass, the point the chassis rotates about.
    const com = config.chassis.centerOfMass;
    this.kinematics = new SwerveKinematics(
      config.modules.map((m) => ({ x: m.position.x - com.x, y: m.position.y - com.y })),
    );
    this.states = makeModuleStates(config.modules.length);
    this.currentAngles = config.modules.map(() => 0);
    this.maxWheelSpeed = Math.min(config.limits.maxSpeedMps, this.modules[0]!.maxWheelSpeed);
  }

  reset(): void {
    this.limitedField.vx = this.limitedField.vy = this.limitedField.omega = 0;
    this.requested.vx = this.requested.vy = this.requested.omega = 0;
    this.neutral = true;
    for (const m of this.modules) m.reset(0);
  }

  /**
   * Applies a command for one control period.
   * @param heading current robot heading (rad)
   * @param dt control period (s)
   */
  applyCommand(
    command: DriveCommand,
    heading: number,
    dt: number,
    measured: ChassisSpeeds = this.limitedField,
  ): void {
    const limits = this.config.limits;

    if (command.xLock) {
      this.limitedField.vx = this.limitedField.vy = this.limitedField.omega = 0;
      this.requested.vx = this.requested.vy = this.requested.omega = 0;
      for (const m of this.modules) {
        const p = m.config.position;
        const state = this.states[0]!;
        state.speed = 0;
        state.angle = Math.atan2(p.y, p.x);
        optimize(state, m.steerAngle);
        m.setTarget(0, state.angle);
      }
      this.neutral = true;
      return;
    }

    // Requested velocity in the field frame, clamped to the speed limits.
    let fx = command.vx;
    let fy = command.vy;
    if (!command.fieldRelative) {
      const c = Math.cos(heading);
      const s = Math.sin(heading);
      fx = c * command.vx - s * command.vy;
      fy = s * command.vx + c * command.vy;
    }
    const speed = Math.hypot(fx, fy);
    if (speed > limits.maxSpeedMps) {
      fx *= limits.maxSpeedMps / speed;
      fy *= limits.maxSpeedMps / speed;
    }
    const omega = clamp(command.omega, -limits.maxAngularRateRadps, limits.maxAngularRateRadps);

    // No motion requested: put the motors in neutral (brake or coast) rather than actively
    // servoing to zero, hold the wheel angles, and track the real velocity so the next
    // request ramps smoothly from wherever the robot is.
    if (Math.hypot(fx, fy) < IDLE_EPSILON && Math.abs(omega) < IDLE_EPSILON) {
      this.neutral = true;
      this.limitedField.vx = measured.vx;
      this.limitedField.vy = measured.vy;
      this.limitedField.omega = measured.omega;
      this.requested.vx = this.requested.vy = this.requested.omega = 0;
      for (const m of this.modules) m.setTarget(0, m.targetAngle);
      return;
    }
    this.neutral = false;

    // Slew limit the translation vector and the rotation rate.
    const lf = this.limitedField;
    const dx = fx - lf.vx;
    const dy = fy - lf.vy;
    const change = Math.hypot(dx, dy);
    const maxChange = limits.maxAccelMps2 * dt;
    if (change > maxChange) {
      lf.vx += (dx / change) * maxChange;
      lf.vy += (dy / change) * maxChange;
    } else {
      lf.vx = fx;
      lf.vy = fy;
    }
    const maxOmegaChange = limits.maxAngularAccelRadps2 * dt;
    lf.omega += clamp(omega - lf.omega, -maxOmegaChange, maxOmegaChange);

    // Field → robot frame at the current heading.
    fieldToRobot(lf.vx, lf.vy, heading, this.requested);
    this.requested.omega = lf.omega;
    const tx = this.requested.vx;
    const ty = this.requested.vy;
    const w = lf.omega;

    for (let i = 0; i < this.modules.length; i++)
      this.currentAngles[i] = this.modules[i]!.steerAngle;
    this.kinematics.toModuleStates(this.requested, this.states, this.currentAngles);
    desaturate(this.states, this.maxWheelSpeed);
    for (let i = 0; i < this.modules.length; i++) {
      const state = this.states[i]!;
      const module = this.modules[i]!;
      optimize(state, module.steerAngle);
      // Steering feedforward: while the robot spins, a field-fixed translation turns in the
      // robot frame at −ω, so each module's target direction keeps rotating between control
      // ticks. d/dt of the module velocity is (ω·ty, −ω·tx); its angle rate is v × v̇ / |v|².
      let rate = 0;
      if (command.fieldRelative && w !== 0) {
        const vx = tx - w * this.kinematics.positionY(i);
        const vy = ty + w * this.kinematics.positionX(i);
        const speedSq = vx * vx + vy * vy;
        if (speedSq > 1e-6) rate = (vx * (-w * tx) - vy * (w * ty)) / speedSq;
      }
      module.setTarget(state.speed, state.angle, rate);
    }
  }
}
