import { clamp, wrapAngle } from '@/core';
import { type MotorConstants, motorConstants, motorCurrent, MOTORS } from '../config/motors';
import type { NeutralMode, SwerveModuleConfig, SwerveModuleHardware } from '../config/types';

/** Below this commanded speed the drive motor is put in neutral (brake or coast). */
const NEUTRAL_SPEED = 1e-3;
/** cos(20°): drive output is zero beyond 20° of steering error and full when aligned. */
const ALIGN_COS = Math.cos((20 * Math.PI) / 180);
/** Speed scale for the rolling-resistance sign smoothing (avoids chatter at rest). */
const ROLLING_SMOOTHING = 0.05;

/**
 * One swerve module: a steering axis with rate and acceleration limits, and a drive motor
 * modelled as a DC motor under closed-loop velocity control with a current limit.
 *
 * The wheel is assumed to roll without slipping, so motor speed follows ground speed along
 * the wheel; the force it produces is capped by traction (friction coefficient × load).
 */
export class SwerveModuleSim {
  /** Steering angle in the robot frame (rad), continuous (not wrapped). */
  steerAngle = 0;
  steerRate = 0;
  /** Commanded state after optimisation. */
  targetAngle = 0;
  targetSpeed = 0;
  /** Expected rate of change of the target angle (rad/s), used as steering feedforward. */
  targetRate = 0;
  /** Wheel ground speed along the wheel direction (m/s), measured. */
  wheelSpeed = 0;
  /** Accumulated wheel rotation (rad) for visuals. */
  wheelRotation = 0;
  /** Last applied drive voltage, current and longitudinal force. */
  driveVoltage = 0;
  driveCurrent = 0;
  driveForce = 0;
  /** True when the requested force exceeded traction this step. */
  slipping = false;

  private readonly motor: MotorConstants;
  private readonly forcePerAmp: number;
  private readonly motorRadPerMps: number;

  constructor(
    readonly config: SwerveModuleConfig,
    readonly hw: SwerveModuleHardware,
  ) {
    this.motor = motorConstants(MOTORS[hw.driveMotor]);
    this.forcePerAmp = (hw.driveEfficiency * hw.driveGearRatio * this.motor.kT) / hw.wheelRadiusM;
    this.motorRadPerMps = hw.driveGearRatio / hw.wheelRadiusM;
  }

  /** Fastest the wheel can be driven with 12 V (m/s), from the motor's back-EMF constant. */
  get maxWheelSpeed(): number {
    return (12 * this.motor.kV) / this.motorRadPerMps;
  }

  reset(angle = 0): void {
    this.steerAngle = angle;
    this.steerRate = 0;
    this.targetAngle = angle;
    this.targetSpeed = 0;
    this.wheelSpeed = 0;
    this.driveVoltage = 0;
    this.driveCurrent = 0;
    this.driveForce = 0;
    this.slipping = false;
  }

  setTarget(speed: number, angle: number, rate = 0): void {
    this.targetSpeed = speed;
    this.targetAngle = angle;
    this.targetRate = rate;
  }

  /** Advances the steering axis toward its target with P control and rate/accel limits. */
  updateSteer(dt: number): void {
    // Track the moving target between control ticks, then correct the remaining error.
    this.targetAngle += this.targetRate * dt;
    const error = wrapAngle(this.targetAngle - this.steerAngle);
    // P correction, capped at the rate the axis can still stop from before reaching the
    // target (trapezoidal profile), so large turns don't overshoot.
    const stoppable = Math.sqrt(2 * this.hw.steerMaxAccelRadps2 * Math.abs(error));
    const correction = clamp(error * this.hw.steerKp, -stoppable, stoppable);
    const desiredRate = clamp(
      this.targetRate + correction,
      -this.hw.steerMaxRateRadps,
      this.hw.steerMaxRateRadps,
    );
    const maxChange = this.hw.steerMaxAccelRadps2 * dt;
    this.steerRate += clamp(desiredRate - this.steerRate, -maxChange, maxChange);
    // Never step past a stationary target in one tick.
    const step = this.steerRate * dt;
    if (
      this.targetRate === 0 &&
      Math.abs(step) > Math.abs(error) &&
      Math.sign(step) === Math.sign(error)
    ) {
      this.steerAngle += error;
      this.steerRate = 0;
    } else {
      this.steerAngle += step;
    }
  }

  /**
   * Longitudinal force the wheel applies to the chassis this step (N, along the wheel).
   * @param groundSpeed chassis velocity at the contact point along the wheel direction
   * @param normalLoad weight carried by this wheel (N)
   */
  driveForceFor(groundSpeed: number, normalLoad: number, neutral: NeutralMode): number {
    const hw = this.hw;
    const motorSpeed = groundSpeed * this.motorRadPerMps;
    let voltage = 0;
    let current: number;

    if (Math.abs(this.targetSpeed) < NEUTRAL_SPEED) {
      // Neutral: brake shorts the windings (back-EMF current opposes motion); coast opens them.
      current =
        neutral === 'brake' ? motorCurrent(this.motor, 0, motorSpeed, hw.driveCurrentLimitA) : 0;
    } else {
      // Drive only once the wheel points (nearly) the right way: output fades in over the
      // last ~20° of steering so the robot doesn't lurch diagonally while wheels turn.
      const cosError = Math.cos(this.targetAngle - this.steerAngle);
      const alignment = clamp((cosError - ALIGN_COS) / (1 - ALIGN_COS), 0, 1);
      const target = this.targetSpeed * alignment;
      const feedforward = (target * this.motorRadPerMps) / this.motor.kV;
      voltage = clamp(feedforward + hw.driveVelocityKp * (target - groundSpeed), -12, 12);
      current = motorCurrent(this.motor, voltage, motorSpeed, hw.driveCurrentLimitA);
    }

    let force = current * this.forcePerAmp;
    force -= hw.rollingResistance * normalLoad * Math.tanh(groundSpeed / ROLLING_SMOOTHING);
    force -= hw.viscousDragNsPerM * groundSpeed;

    const traction = hw.wheelCoF * normalLoad;
    this.slipping = Math.abs(force) > traction;
    if (this.slipping) force = Math.sign(force) * traction;

    this.driveVoltage = voltage;
    this.driveCurrent = current;
    this.driveForce = force;
    return force;
  }

  /** Records the measured wheel speed and advances the visual wheel rotation. */
  updateWheel(groundSpeed: number, dt: number): void {
    this.wheelSpeed = groundSpeed;
    this.wheelRotation += (groundSpeed / this.hw.wheelRadiusM) * dt;
  }
}
