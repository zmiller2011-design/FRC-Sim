/**
 * Brushless DC motor characteristics at 12 V, from manufacturer specifications.
 * Values are the commonly published nominal figures; real motors vary by a few percent.
 */
export interface MotorSpec {
  id: string;
  name: string;
  /** Free speed in rad/s at nominal voltage. */
  freeSpeedRadps: number;
  stallTorqueNm: number;
  stallCurrentA: number;
  freeCurrentA: number;
  nominalVoltage: number;
}

const rpm = (value: number) => (value * 2 * Math.PI) / 60;

export const MOTORS = {
  krakenX60: {
    id: 'krakenX60',
    name: 'Kraken X60',
    freeSpeedRadps: rpm(6000),
    stallTorqueNm: 7.09,
    stallCurrentA: 366,
    freeCurrentA: 2,
    nominalVoltage: 12,
  },
  falcon500: {
    id: 'falcon500',
    name: 'Falcon 500',
    freeSpeedRadps: rpm(6380),
    stallTorqueNm: 4.69,
    stallCurrentA: 257,
    freeCurrentA: 1.5,
    nominalVoltage: 12,
  },
  neoVortex: {
    id: 'neoVortex',
    name: 'NEO Vortex',
    freeSpeedRadps: rpm(6784),
    stallTorqueNm: 3.6,
    stallCurrentA: 211,
    freeCurrentA: 3.6,
    nominalVoltage: 12,
  },
  neo: {
    id: 'neo',
    name: 'NEO',
    freeSpeedRadps: rpm(5676),
    stallTorqueNm: 2.6,
    stallCurrentA: 105,
    freeCurrentA: 1.8,
    nominalVoltage: 12,
  },
} as const satisfies Record<string, MotorSpec>;

export type MotorId = keyof typeof MOTORS;

/** Derived electrical constants for a motor model. */
export interface MotorConstants {
  /** Winding resistance (Ω). */
  resistance: number;
  /** Torque per amp (N·m/A). */
  kT: number;
  /** Speed per volt of back-EMF (rad/s/V). */
  kV: number;
}

export function motorConstants(spec: MotorSpec): MotorConstants {
  const resistance = spec.nominalVoltage / spec.stallCurrentA;
  return {
    resistance,
    kT: spec.stallTorqueNm / spec.stallCurrentA,
    kV: spec.freeSpeedRadps / (spec.nominalVoltage - resistance * spec.freeCurrentA),
  };
}

/**
 * Motor current for an applied voltage at a given motor speed, limited to ±`limitA`.
 * Pure: the DC motor equation I = (V − ω/kV) / R.
 */
export function motorCurrent(
  c: MotorConstants,
  voltage: number,
  speedRadps: number,
  limitA: number,
): number {
  const current = (voltage - speedRadps / c.kV) / c.resistance;
  return current > limitA ? limitA : current < -limitA ? -limitA : current;
}
