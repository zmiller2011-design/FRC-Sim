import { describe, expect, it } from 'vitest';
import { motorConstants, motorCurrent, MOTORS } from '@/robot/config/motors';
import { DEFAULT_ROBOT } from '@/robot/config/presets';
import { freeWheelSpeed } from '@/robot/config/types';
import {
  desaturate,
  discretize,
  makeModuleStates,
  optimize,
  SwerveKinematics,
} from '@/robot/drivetrain/kinematics';

const positions = DEFAULT_ROBOT.modules.map((m) => m.position);
const kin = new SwerveKinematics(positions);

describe('SwerveKinematics', () => {
  it('points every wheel forward for pure forward motion', () => {
    const states = makeModuleStates(4);
    kin.toModuleStates({ vx: 2, vy: 0, omega: 0 }, states);
    for (const s of states) {
      expect(s.speed).toBeCloseTo(2);
      expect(s.angle).toBeCloseTo(0);
    }
  });

  it('points wheels tangentially for pure rotation', () => {
    const states = makeModuleStates(4);
    kin.toModuleStates({ vx: 0, vy: 0, omega: 1 }, states);
    positions.forEach((p, i) => {
      const s = states[i]!;
      expect(s.speed).toBeCloseTo(Math.hypot(p.x, p.y));
      // Tangent direction is perpendicular to the position vector.
      expect(Math.cos(s.angle) * p.x + Math.sin(s.angle) * p.y).toBeCloseTo(0);
    });
  });

  it('round-trips through forward kinematics', () => {
    const states = makeModuleStates(4);
    const speeds = { vx: 1.3, vy: -0.7, omega: 2.1 };
    kin.toModuleStates(speeds, states);
    const back = kin.toChassisSpeeds(states, { vx: 0, vy: 0, omega: 0 });
    expect(back.vx).toBeCloseTo(speeds.vx, 9);
    expect(back.vy).toBeCloseTo(speeds.vy, 9);
    expect(back.omega).toBeCloseTo(speeds.omega, 9);
  });

  it('holds wheel angles when no motion is requested', () => {
    const states = makeModuleStates(4);
    kin.toModuleStates({ vx: 0, vy: 0, omega: 0 }, states, [0.1, 0.2, 0.3, 0.4]);
    expect(states.map((s) => s.angle)).toEqual([0.1, 0.2, 0.3, 0.4]);
  });
});

describe('desaturate', () => {
  it('scales all wheels together, preserving ratios', () => {
    const states = [
      { speed: 6, angle: 0 },
      { speed: 3, angle: 0 },
      { speed: -4.5, angle: 0 },
      { speed: 1, angle: 0 },
    ];
    desaturate(states, 4);
    expect(states.map((s) => s.speed)).toEqual([4, 2, -3, 4 / 6]);
  });
});

describe('optimize', () => {
  it('reverses the wheel instead of turning more than 90°', () => {
    const s = { speed: 2, angle: Math.PI };
    optimize(s, 0);
    expect(s.speed).toBe(-2);
    expect(s.angle).toBeCloseTo(0);
  });

  it('keeps targets continuous with the current (unwrapped) angle', () => {
    const s = { speed: 1, angle: 0.1 };
    optimize(s, 4 * Math.PI);
    expect(s.angle).toBeCloseTo(4 * Math.PI + 0.1);
  });
});

describe('discretize', () => {
  it('is the identity without rotation', () => {
    const out = discretize({ vx: 2, vy: 1, omega: 0 }, 0.02, { vx: 0, vy: 0, omega: 0 });
    expect(out).toEqual({ vx: 2, vy: 1, omega: 0 });
  });

  it('produces a twist whose arc ends at the straight-line target pose', () => {
    const dt = 0.5;
    const out = discretize({ vx: 2, vy: 0, omega: 2 }, dt, { vx: 0, vy: 0, omega: 0 });
    // Integrate the constant robot-frame twist exactly (pose exponential).
    const th = out.omega * dt;
    const x = (out.vx * Math.sin(th) - out.vy * (1 - Math.cos(th))) / out.omega;
    const y = (out.vx * (1 - Math.cos(th)) + out.vy * Math.sin(th)) / out.omega;
    expect(x).toBeCloseTo(2 * dt, 9);
    expect(y).toBeCloseTo(0, 9);
  });
});

describe('motor model', () => {
  const kraken = motorConstants(MOTORS.krakenX60);

  it('reproduces stall current and free speed at 12 V', () => {
    expect(motorCurrent(kraken, 12, 0, 1000)).toBeCloseTo(366, 6);
    expect(motorCurrent(kraken, 12, MOTORS.krakenX60.freeSpeedRadps, 1000)).toBeCloseTo(2, 6);
  });

  it('applies the current limit and brakes against motion at 0 V', () => {
    expect(motorCurrent(kraken, 12, 0, 60)).toBe(60);
    expect(motorCurrent(kraken, 0, 300, 1000)).toBeLessThan(0);
  });

  it('gives the preset a ~4.7 m/s free speed', () => {
    const v = freeWheelSpeed(DEFAULT_ROBOT.moduleHardware, MOTORS.krakenX60.freeSpeedRadps);
    expect(v).toBeGreaterThan(4.6);
    expect(v).toBeLessThan(4.8);
  });
});
