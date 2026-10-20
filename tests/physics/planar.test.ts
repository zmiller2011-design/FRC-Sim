import { describe, expect, it } from 'vitest';
import {
  collideObb,
  makeContact,
  makeTerrainSample,
  PlanarWorld,
  RigidBody2D,
  sampleTerrain,
} from '@/physics/planar';

describe('collideObb', () => {
  it('returns no contact for separated boxes', () => {
    const c = makeContact();
    expect(
      collideObb(
        { cx: 0, cy: 0, hx: 1, hy: 1, angle: 0 },
        { cx: 3, cy: 0, hx: 1, hy: 1, angle: 0 },
        c,
      ),
    ).toBe(false);
  });

  it('finds the minimum translation and a normal pointing toward the body', () => {
    const c = makeContact();
    const hit = collideObb(
      { cx: 1.9, cy: 0.2, hx: 1, hy: 1, angle: 0 },
      { cx: 0, cy: 0, hx: 1, hy: 1, angle: 0 },
      c,
    );
    expect(hit).toBe(true);
    expect(c.depth).toBeCloseTo(0.1, 9);
    expect(c.nx).toBeCloseTo(1, 9);
    expect(c.ny).toBeCloseTo(0, 9);
  });

  it('handles rotated boxes', () => {
    const c = makeContact();
    const hit = collideObb(
      { cx: 0, cy: 1.6, hx: 0.5, hy: 0.5, angle: Math.PI / 4 },
      { cx: 0, cy: 0, hx: 2, hy: 1, angle: 0 },
      c,
    );
    expect(hit).toBe(true);
    expect(c.ny).toBeCloseTo(1, 6);
    expect(c.depth).toBeCloseTo(1 + Math.SQRT1_2 * 1 - 1.6, 6);
  });
});

describe('terrain', () => {
  const ramp = { cx: 0, cy: 0, angle: 0, halfDepth: 1, halfWidth: 2, height: 0.2 };

  it('peaks at the ridge and falls to zero at the edges', () => {
    const s = makeTerrainSample();
    expect(sampleTerrain([ramp], 0, 0, s).height).toBeCloseTo(0.2);
    expect(sampleTerrain([ramp], 0.5, 1, s).height).toBeCloseTo(0.1);
    expect(sampleTerrain([ramp], 1.01, 0, s).height).toBe(0);
    expect(sampleTerrain([ramp], 0, 2.5, s).height).toBe(0);
  });

  it('reports the slope pointing uphill', () => {
    const s = makeTerrainSample();
    sampleTerrain([ramp], 0.5, 0, s);
    expect(s.gradX).toBeCloseTo(-0.2);
    sampleTerrain([ramp], -0.5, 0, s);
    expect(s.gradX).toBeCloseTo(0.2);
  });
});

describe('PlanarWorld', () => {
  it('pushes a body out of the bounds and stops it moving outward', () => {
    const world = new PlanarWorld({
      bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
      obstacles: [],
      ramps: [],
    });
    const body = new RigidBody2D(50, 5);
    body.setState(0.3, 5, 0, -2, 0, 0);
    world.resolve(body, { halfLength: 0.5, halfWidth: 0.5, offsetX: 0, offsetY: 0 });
    expect(body.x).toBeGreaterThanOrEqual(0.5 - 1e-3);
    expect(body.vx).toBeGreaterThanOrEqual(0);
    // A flat face contact must not induce spin.
    expect(body.omega).toBeCloseTo(0, 9);
  });
});
