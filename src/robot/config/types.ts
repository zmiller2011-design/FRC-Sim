import type { MotorId } from './motors';

/** Where the motors' windings go when the drive is commanded to zero. */
export type NeutralMode = 'brake' | 'coast';

export interface ChassisConfig {
  /** Frame perimeter size without bumpers (m). Length is along the robot's forward axis. */
  frameLengthM: number;
  frameWidthM: number;
  /** Bumper thickness added on every side (m). */
  bumperThicknessM: number;
  /** Maximum robot height (m); decides what it can drive under (e.g. TRENCH arms). */
  heightM: number;
  /** Total mass with battery and bumpers (kg). */
  massKg: number;
  /** Centre of mass offset from the frame centre in the robot frame (m). */
  centerOfMass: { x: number; y: number };
  /** Yaw moment of inertia about the centre of mass (kg·m²). Derived from the footprint if omitted. */
  momentOfInertiaKgM2?: number;
  /** Height of the bumpers' bottom edge; obstacles lower than this are driven over (m). */
  groundClearanceM: number;
}

export interface SwerveModuleConfig {
  /** Short name for telemetry, e.g. "FL". */
  name: string;
  /** Wheel contact position relative to the frame centre, robot frame (m). */
  position: { x: number; y: number };
}

export interface SwerveModuleHardware {
  wheelRadiusM: number;
  /** Wheel-to-carpet friction coefficient. */
  wheelCoF: number;
  driveMotor: MotorId;
  /** Motor revolutions per wheel revolution. */
  driveGearRatio: number;
  /** Gearbox efficiency (0–1). */
  driveEfficiency: number;
  /** Stator current limit per drive motor (A). Lower values soften acceleration. */
  driveCurrentLimitA: number;
  /** Closed-loop velocity gain (volts per m/s of wheel-speed error). */
  driveVelocityKp: number;
  /** Maximum steering rate (rad/s) and acceleration (rad/s²). */
  steerMaxRateRadps: number;
  steerMaxAccelRadps2: number;
  /** Proportional steering gain (1/s): commanded rate per radian of error. */
  steerKp: number;
  /** Rolling-resistance coefficient and viscous drivetrain drag (N per m/s) per module. */
  rollingResistance: number;
  viscousDragNsPerM: number;
}

export interface DriveLimits {
  /** Software speed limits (m/s, rad/s). */
  maxSpeedMps: number;
  maxAngularRateRadps: number;
  /** Command slew limits: how fast the requested velocity may change. */
  maxAccelMps2: number;
  maxAngularAccelRadps2: number;
}

export interface RobotConfig {
  id: string;
  name: string;
  chassis: ChassisConfig;
  /** Exactly four modules: front-left, front-right, back-left, back-right. */
  modules: readonly [
    SwerveModuleConfig,
    SwerveModuleConfig,
    SwerveModuleConfig,
    SwerveModuleConfig,
  ];
  moduleHardware: SwerveModuleHardware;
  limits: DriveLimits;
  neutralMode: NeutralMode;
}

/** Bumper-outer footprint size (m). */
export function outerSize(c: ChassisConfig): { length: number; width: number } {
  return {
    length: c.frameLengthM + 2 * c.bumperThicknessM,
    width: c.frameWidthM + 2 * c.bumperThicknessM,
  };
}

/** Yaw inertia: configured value, or a uniform plate the size of the frame plus bumpers. */
export function yawInertia(c: ChassisConfig): number {
  if (c.momentOfInertiaKgM2 !== undefined) return c.momentOfInertiaKgM2;
  const { length, width } = outerSize(c);
  return (c.massKg * (length * length + width * width)) / 12;
}

/** Theoretical top wheel speed (m/s) at nominal voltage, ignoring losses. */
export function freeWheelSpeed(hw: SwerveModuleHardware, freeSpeedRadps: number): number {
  return (freeSpeedRadps / hw.driveGearRatio) * hw.wheelRadiusM;
}
