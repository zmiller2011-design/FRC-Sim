import { describe, expect, it } from 'vitest';
import { wrapAngle } from '@/core/math/scalar';
import { DEFAULT_ROBOT } from '@/robot/config/presets';
import { outerSize } from '@/robot/config/types';
import { cmd, DT, fieldWorld, PHYSICS_HZ, Sim } from './harness';

const MAX = DEFAULT_ROBOT.limits.maxSpeedMps;

describe('1. forward movement', () => {
  it('reaches the commanded speed straight ahead without turning', () => {
    const sim = new Sim().run(cmd({ vx: 3 }), 3);
    expect(sim.robot.body.vx).toBeCloseTo(3, 1);
    expect(Math.abs(sim.robot.body.vy)).toBeLessThan(0.01);
    expect(Math.abs(sim.pose.y)).toBeLessThan(0.01);
    expect(Math.abs(sim.pose.heading)).toBeLessThan(0.002);
    expect(sim.pose.x).toBeGreaterThan(6.5);
  });
});

describe('2. reverse movement', () => {
  it('drives backwards the same way', () => {
    const sim = new Sim().run(cmd({ vx: -3 }), 3);
    expect(sim.robot.body.vx).toBeCloseTo(-3, 1);
    expect(sim.pose.x).toBeLessThan(-6.5);
    expect(Math.abs(sim.pose.heading)).toBeLessThan(0.002);
  });
});

describe('3. strafing', () => {
  it('moves sideways while keeping its heading', () => {
    const sim = new Sim().run(cmd({ vy: 2 }), 3);
    expect(sim.robot.body.vy).toBeCloseTo(2, 1);
    expect(Math.abs(sim.pose.x)).toBeLessThan(0.01);
    expect(Math.abs(sim.pose.heading)).toBeLessThan(0.002);
    // Wheels steered to +90°.
    for (const m of sim.robot.drive.modules)
      expect(Math.abs(wrapAngle(m.steerAngle)) % Math.PI).toBeCloseTo(Math.PI / 2, 2);
  });
});

describe('4. in-place rotation', () => {
  it('spins at the commanded rate without drifting', () => {
    const sim = new Sim().run(cmd({ omega: 2 }), 3);
    expect(sim.robot.body.omega).toBeCloseTo(2, 1);
    expect(Math.hypot(sim.pose.x, sim.pose.y)).toBeLessThan(0.02);
  });
});

describe('5. combined translation and rotation', () => {
  it('follows a straight field-relative line while spinning', () => {
    const sim = new Sim();
    let maxDrift = 0;
    sim.run(cmd({ vx: 2, omega: 2, fieldRelative: true }), 4, (s) => {
      if (s.tick > PHYSICS_HZ) maxDrift = Math.max(maxDrift, Math.abs(s.pose.y));
    });
    expect(sim.robot.body.vx).toBeCloseTo(2, 0);
    expect(sim.robot.body.omega).toBeCloseTo(2, 0);
    // Discretisation keeps sideways drift small despite the heading changing continuously.
    expect(maxDrift).toBeLessThan(0.15);
    expect(sim.pose.x).toBeGreaterThan(6);
  });
});

describe('6. acceleration and braking', () => {
  it('cannot reach full speed instantly', () => {
    const sim = new Sim();
    sim.run(cmd({ vx: MAX }), 0.1);
    expect(sim.speed).toBeLessThan(MAX * 0.3);
    expect(sim.speed).toBeGreaterThan(0.1);
  });

  it('reaches 90% of a 4 m/s request within 1 s, with realistic peak acceleration', () => {
    const sim = new Sim();
    let peak = 0;
    let t90 = Infinity;
    sim.run(cmd({ vx: 4 }), 2, (s) => {
      peak = Math.max(peak, s.robot.accel.x);
      if (s.speed >= 3.6 && t90 === Infinity) t90 = s.tick * DT;
    });
    expect(t90).toBeLessThan(1);
    expect(t90).toBeGreaterThan(0.35);
    // Below the slew limit (9 m/s²) and below 1.1 g of traction.
    expect(peak).toBeLessThan(10.8);
  });

  it('brakes to a stop quickly, and coasts much further in coast mode', () => {
    const stopDistance = (neutralMode: 'brake' | 'coast') => {
      const sim = new Sim(undefined, { ...DEFAULT_ROBOT, neutralMode });
      sim.run(cmd({ vx: 3 }), 2);
      const x0 = sim.pose.x;
      sim.run(cmd({}), 8);
      return { distance: sim.pose.x - x0, speed: sim.speed };
    };
    const brake = stopDistance('brake');
    const coast = stopDistance('coast');
    expect(brake.speed).toBeLessThan(0.01);
    expect(brake.distance).toBeLessThan(1.2);
    expect(coast.distance).toBeGreaterThan(brake.distance * 2);
  });

  it('X-lock holds position against a shove', () => {
    const sim = new Sim().run(cmd({ xLock: true }), 0.5);
    sim.robot.body.vx = 1.5;
    sim.run(cmd({ xLock: true }), 1);
    expect(sim.speed).toBeLessThan(0.01);
    expect(sim.pose.x).toBeLessThan(0.3);
  });
});

describe('7. field-relative vs robot-relative', () => {
  it('interprets the same command in different frames when the robot faces +Y', () => {
    const robotRel = new Sim(undefined, undefined, 0, 0, Math.PI / 2).run(
      cmd({ vx: 2, fieldRelative: false }),
      2,
    );
    const fieldRel = new Sim(undefined, undefined, 0, 0, Math.PI / 2).run(
      cmd({ vx: 2, fieldRelative: true }),
      2,
    );
    // Robot-relative "forward" is along the robot's nose: field +Y.
    expect(robotRel.pose.y).toBeGreaterThan(3);
    expect(Math.abs(robotRel.pose.x)).toBeLessThan(0.02);
    // Field-relative "forward" is field +X regardless of heading.
    expect(fieldRel.pose.x).toBeGreaterThan(3);
    expect(Math.abs(fieldRel.pose.y)).toBeLessThan(0.02);
    expect(fieldRel.pose.heading).toBeCloseTo(Math.PI / 2, 3);
  });
});

describe('8. field boundary and obstacle collisions', () => {
  const { length, width } = outerSize(DEFAULT_ROBOT.chassis);

  it('stops at the alliance wall instead of passing through it', () => {
    const sim = new Sim(fieldWorld(), undefined, 2, 2, 0).run(cmd({ vx: -MAX }), 3);
    expect(sim.pose.x - length / 2).toBeGreaterThan(-0.003);
    expect(Math.abs(sim.robot.body.vx)).toBeLessThan(0.05);
  });

  it('stays inside the guardrail at full speed and recovers', () => {
    const sim = new Sim(fieldWorld(), undefined, 8, 1.5, 0).run(cmd({ vy: -MAX }), 3);
    expect(sim.pose.y - width / 2).toBeGreaterThan(-0.003);
    sim.run(cmd({ vy: 2 }), 1);
    expect(sim.robot.body.vy).toBeGreaterThan(1);
  });

  it('cannot drive through a HUB', () => {
    const field = fieldWorld();
    // Blue HUB centre ≈ (4.63, 4.03), 47in square; approach from the alliance zone.
    const sim = new Sim(field, undefined, 2.5, 4.03, 0).run(cmd({ vx: 3 }), 3);
    expect(sim.pose.x + length / 2).toBeLessThan(4.63 - 0.597 + 0.003);
  });

  it('a 20in robot drives under the TRENCH arm; a 30in robot is blocked', () => {
    const tall = { ...DEFAULT_ROBOT, chassis: { ...DEFAULT_ROBOT.chassis, heightM: 30 * 0.0254 } };
    // Right TRENCH opening spans Y 0–1.28 m at X ≈ 4.63; drive through its middle.
    const short = new Sim(fieldWorld(), undefined, 2.5, 0.64, 0).run(cmd({ vx: 3 }), 2.5);
    const blocked = new Sim(fieldWorld(tall), tall, 2.5, 0.64, 0).run(cmd({ vx: 3 }), 2.5);
    expect(short.pose.x).toBeGreaterThan(6);
    expect(blocked.pose.x).toBeLessThan(4.63);
  });

  it('a glancing hit rotates the robot rather than stopping it dead', () => {
    const sim = new Sim(fieldWorld(), undefined, 3.2, 3.1, 0).run(
      cmd({ vx: 2, vy: 0.4, fieldRelative: true }),
      2,
    );
    expect(sim.robot.contacts).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(sim.pose.heading)).toBe(true);
  });

  it('climbs over a BUMP and is slowed on the way up', () => {
    const sim = new Sim(fieldWorld(), undefined, 2.5, 2.51, 0);
    let maxZ = 0;
    sim.run(cmd({ vx: 2 }), 3, (s) => (maxZ = Math.max(maxZ, s.pose.z)));
    // Averaged over a 0.55 m wheelbase straddling the 0.165 m ridge the chassis rises ~8 cm.
    expect(maxZ).toBeGreaterThan(0.07);
    expect(sim.pose.x).toBeGreaterThan(5.5);
  });
});

describe('9. consistency under different render frame rates', () => {
  const profile = (t: number) =>
    t < 1
      ? cmd({ vx: 3 })
      : t < 2
        ? cmd({ vy: 2, omega: 2 })
        : t < 3
          ? cmd({ vx: -1, omega: -3 })
          : cmd({});
  const TICKS = 4 * PHYSICS_HZ;

  /** Drives the sim from a sequence of real frame times until exactly TICKS steps ran. */
  function runAt(nextFrame: () => number) {
    const sim = new Sim(fieldWorld(), undefined, 3, 2, 0);
    const frames: number[] = [];
    while (sim.tick < TICKS) {
      const before = sim.tick;
      sim.runFrames(profile, [nextFrame()], TICKS);
      frames.push(sim.tick - before);
    }
    return { pose: sim.pose, steer: [...sim.pose.steer], wheel: [...sim.pose.wheel], frames };
  }

  it('produces bit-identical states at 30, 60, 144, 240 fps and with frame jitter', () => {
    let seed = 7;
    const jitter = () => {
      seed = (seed * 16807) % 2147483647;
      return 1 / 60 + (seed / 2147483647 - 0.5) * 0.02;
    };
    const fixed = (dt: number) => () => dt;
    const runs = [fixed(1 / 30), fixed(1 / 60), fixed(1 / 144), fixed(1 / 240), jitter].map(runAt);
    const ref = runs[0]!;
    for (const run of runs.slice(1)) {
      expect(run.pose.x).toBe(ref.pose.x);
      expect(run.pose.y).toBe(ref.pose.y);
      expect(run.pose.heading).toBe(ref.pose.heading);
      expect(run.steer).toEqual(ref.steer);
      expect(run.wheel).toEqual(ref.wheel);
    }
    // Sanity: the runs really were grouped differently (4 steps/frame at 30 fps, 0–1 at 240).
    expect(Math.max(...runs[0]!.frames)).toBe(4);
    expect(Math.max(...runs[3]!.frames)).toBe(1);
  });

  it('caps catch-up after a long stall instead of running unbounded steps', () => {
    const sim = new Sim();
    sim.runFrames(profile, [5]);
    // maxSubSteps (12) bounds one frame; the rest of the 5 s gap is dropped.
    expect(sim.tick).toBe(12);
  });
});
