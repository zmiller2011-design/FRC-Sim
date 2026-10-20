import { describe, expect, it } from 'vitest';
import { fieldToWorld, worldToField } from '@/core/math/frames';
import { InterpolatedPose } from '@/core/math/InterpolatedPose';
import { lerpAngle, wrapAngle } from '@/core/math/scalar';
import { pose2d, vec3 } from '@/core/math/types';

describe('wrapAngle', () => {
  it.each([
    [0, 0],
    [Math.PI, Math.PI],
    [-Math.PI, Math.PI],
    [3 * Math.PI, Math.PI],
    [Math.PI / 2 + 4 * Math.PI, Math.PI / 2],
    [-Math.PI / 2 - 2 * Math.PI, -Math.PI / 2],
  ])('wrapAngle(%f) = %f', (input, expected) => {
    expect(wrapAngle(input)).toBeCloseTo(expected, 12);
  });
});

describe('lerpAngle', () => {
  it('takes the short way across ±π', () => {
    const a = Math.PI - 0.1;
    const b = -Math.PI + 0.1;
    expect(wrapAngle(lerpAngle(a, b, 0.5))).toBeCloseTo(Math.PI, 12);
  });
});

describe('field/world frames', () => {
  it('maps field axes to world axes', () => {
    expect(fieldToWorld(1, 0, 0, vec3())).toEqual({ x: 1, y: 0, z: -0 });
    expect(fieldToWorld(0, 1, 0, vec3())).toEqual({ x: 0, y: 0, z: -1 });
    expect(fieldToWorld(0, 0, 1, vec3())).toEqual({ x: 0, y: 1, z: -0 });
  });

  it('round-trips', () => {
    const w = fieldToWorld(3.2, -1.5, 0.7, vec3());
    const f = worldToField(w.x, w.y, w.z, vec3());
    expect(f.x).toBeCloseTo(3.2);
    expect(f.y).toBeCloseTo(-1.5);
    expect(f.z).toBeCloseTo(0.7);
  });

  it('is right-handed (field X × Y = Z maps to world X × Y = Z)', () => {
    const x = fieldToWorld(1, 0, 0, vec3());
    const y = fieldToWorld(0, 1, 0, vec3());
    const z = fieldToWorld(0, 0, 1, vec3());
    const cross = {
      x: x.y * y.z - x.z * y.y,
      y: x.z * y.x - x.x * y.z,
      z: x.x * y.y - x.y * y.x,
    };
    expect(cross.x).toBeCloseTo(z.x);
    expect(cross.y).toBeCloseTo(z.y);
    expect(cross.z).toBeCloseTo(z.z);
  });
});

describe('InterpolatedPose', () => {
  it('interpolates between the previous and current step', () => {
    const p = new InterpolatedPose();
    p.reset(0, 0, 0);
    p.beginStep();
    p.current.x = 2;
    p.current.heading = 1;
    const out = p.sample(0.25, pose2d());
    expect(out.x).toBeCloseTo(0.5);
    expect(out.heading).toBeCloseTo(0.25);
  });
});
