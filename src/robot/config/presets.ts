import { INCHES_TO_METERS as IN, POUNDS_TO_KG as LB } from '@/core';
import type { RobotConfig } from './types';

const half = (27 * IN) / 2;
/** Modules sit 2.625in in from each frame corner (typical for COTS swerve on a 27in frame). */
const inset = 2.625 * IN;
const m = half - inset;

/**
 * A typical competitive 2026 swerve base: 27 × 27 in frame, 3 in bumpers, Kraken X60 drive
 * motors on an L2-style 6.75:1 ratio with 4 in wheels (~4.7 m/s free speed), about 125 lb
 * with battery and bumpers. Height is kept under the 22.25 in TRENCH clearance.
 */
export const DEFAULT_ROBOT: RobotConfig = {
  id: 'swerve-base',
  name: 'Swerve Base (Kraken X60, L2)',
  chassis: {
    frameLengthM: 27 * IN,
    frameWidthM: 27 * IN,
    bumperThicknessM: 3 * IN,
    heightM: 20 * IN,
    massKg: 125 * LB,
    centerOfMass: { x: 0, y: 0 },
    groundClearanceM: 1.5 * IN,
  },
  modules: [
    { name: 'FL', position: { x: m, y: m } },
    { name: 'FR', position: { x: m, y: -m } },
    { name: 'BL', position: { x: -m, y: m } },
    { name: 'BR', position: { x: -m, y: -m } },
  ],
  moduleHardware: {
    wheelRadiusM: 2 * IN,
    wheelCoF: 1.1,
    driveMotor: 'krakenX60',
    driveGearRatio: 6.75,
    driveEfficiency: 0.95,
    driveCurrentLimitA: 70,
    driveVelocityKp: 8,
    steerMaxRateRadps: 18,
    steerMaxAccelRadps2: 260,
    steerKp: 30,
    rollingResistance: 0.015,
    viscousDragNsPerM: 4,
  },
  limits: {
    maxSpeedMps: 4.5,
    maxAngularRateRadps: 3 * Math.PI,
    maxAccelMps2: 9,
    maxAngularAccelRadps2: 4 * Math.PI * 4,
  },
  neutralMode: 'brake',
};
