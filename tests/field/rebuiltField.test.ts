import { describe, expect, it } from 'vitest';
import { FieldState } from '@/field/FieldState';
import { tag36h11Cells } from '@/field/tag36h11';
import type { FieldConfig, FieldElement } from '@/field/types';
import { WELDED_TAGS } from '@/game/seasons/rebuilt2026/aprilTags';
import { createRebuiltField, rebuiltAnchors } from '@/game/seasons/rebuilt2026';

const IN = 0.0254;
const welded = createRebuiltField({ variant: 'welded' });
const andymark = createRebuiltField({ variant: 'andymark' });

function element(config: FieldConfig, alliance: string, id: string): FieldElement {
  const e = config.elements.find((x) => x.alliance === alliance && x.id === id);
  if (!e) throw new Error(`missing ${alliance} ${id}`);
  return e;
}

const tagById = (id: number) => WELDED_TAGS.find((t) => t.id === id)!;

describe('REBUILT field dimensions (welded)', () => {
  it('uses the official field size: 651.22in × 317.69in', () => {
    expect(welded.lengthM).toBeCloseTo(16.541, 6);
    expect(welded.widthM).toBeCloseTo(8.069, 6);
    expect(welded.lengthM / IN).toBeCloseTo(651.22, 1);
    expect(welded.widthM / IN).toBeCloseTo(317.69, 1);
  });

  it('centres each HUB between its near- and far-face tags, on the field centreline', () => {
    const blue = element(welded, 'blue', 'hub');
    expect(blue.pose.x / IN).toBeCloseTo(182.11, 1);
    expect(blue.pose.y).toBeCloseTo(welded.widthM / 2, 9);
    // Side-face tags (18, 21) sit on the same X as the centre.
    expect(blue.pose.x).toBeCloseTo(tagById(18).x, 3);
    expect(blue.pose.x).toBeCloseTo(tagById(21).x, 3);
    // Half the tag-to-tag spacing ≈ 23.5in body + plate offset.
    expect((tagById(20).x - tagById(26).x) / 2 / IN).toBeCloseTo(23.76, 1);
  });

  it('places the red HUB at the point reflection of the blue HUB, matching red tags', () => {
    const red = element(welded, 'red', 'hub');
    // Official red tags are point-symmetric to blue within 0.04 mm.
    expect(Math.abs(red.pose.x - (tagById(4).x + tagById(10).x) / 2)).toBeLessThan(1e-4);
    expect(red.pose.y).toBeCloseTo(welded.widthM / 2, 9);
    expect(red.pose.yaw).toBeCloseTo(Math.PI, 9);
  });

  it('puts BUMPS flush against the HUB sides, 73in wide', () => {
    const hub = element(welded, 'blue', 'hub');
    const right = element(welded, 'blue', 'bump-right');
    const left = element(welded, 'blue', 'bump-left');
    const offset = (47 / 2 + 73 / 2) * IN;
    expect(hub.pose.y - right.pose.y).toBeCloseTo(offset, 9);
    expect(left.pose.y - hub.pose.y).toBeCloseTo(offset, 9);
  });

  it('centres TRENCH arms on the trench tags and leaves a 12in leg up to the BUMP', () => {
    const trench = element(welded, 'blue', 'trench-right');
    if (trench.type !== 'trench') throw new Error();
    const tagMidX = (tagById(17).x + tagById(28).x) / 2;
    expect(trench.pose.x).toBeCloseTo(tagMidX, 3);
    expect(trench.dims.openingWidth / IN).toBeCloseTo(50.34, 2);
    expect(trench.dims.legWidth / IN).toBeCloseTo(12.0, 1);
    // Trench tags sit over the middle of the opening.
    expect(tagById(17).y / IN).toBeCloseTo(50.34 / 2, 0);
  });

  it('places the TOWER on the blue wall at tag 31 with rungs at 27/45/63in', () => {
    const tower = element(welded, 'blue', 'tower');
    expect(tower.pose.x).toBe(0);
    expect(tower.pose.y).toBeCloseTo(tagById(31).y, 9);
    const rungs = welded.scoringTargets.filter((t) => t.kind === 'rung' && t.alliance === 'blue');
    expect(rungs.map((r) => (r.kind === 'rung' ? r.start.z / IN : 0))).toEqual([
      expect.closeTo(27, 6),
      expect.closeTo(45, 6),
      expect.closeTo(63, 6),
    ]);
  });

  it('places the DEPOT 75.93in left of centre and the OUTPOST at tag 29', () => {
    const depot = element(welded, 'blue', 'depot');
    const outpost = element(welded, 'blue', 'outpost');
    expect((depot.pose.y - welded.widthM / 2) / IN).toBeCloseTo(75.93, 6);
    expect(outpost.pose.y).toBeCloseTo(tagById(29).y, 9);
    // Red counterparts on the red wall, matching red tags 13 and 15.
    expect(element(welded, 'red', 'outpost').pose.y).toBeCloseTo(
      WELDED_TAGS.find((t) => t.id === 13)!.y,
      3,
    );
    expect(element(welded, 'red', 'tower').pose.y).toBeCloseTo(
      WELDED_TAGS.find((t) => t.id === 15)!.y,
      3,
    );
  });

  it('has the HUB opening 72in high', () => {
    const hubs = welded.scoringTargets.filter((t) => t.kind === 'hubOpening');
    expect(hubs).toHaveLength(2);
    for (const h of hubs) if (h.kind === 'hubOpening') expect(h.center.z / IN).toBeCloseTo(72, 6);
  });

  it('draws the ROBOT STARTING LINE inside the ALLIANCE ZONE edge', () => {
    const line = welded.markings.find((m) => m.id === 'start-blue')!;
    expect(line.start.x + line.width / 2).toBeCloseTo(rebuiltAnchors('welded').startingLineX, 9);
  });

  it('is point-symmetric: every red element mirrors a blue one', () => {
    for (const blue of welded.elements.filter((e) => e.alliance === 'blue')) {
      const red = element(welded, 'red', blue.id);
      expect(red.pose.x).toBeCloseTo(welded.lengthM - blue.pose.x, 9);
      expect(red.pose.y).toBeCloseTo(welded.widthM - blue.pose.y, 9);
    }
  });

  it('includes all 32 AprilTags', () => {
    expect(welded.aprilTags.map((t) => t.id)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });
});

describe('FUEL starting configuration', () => {
  const r = welded.gamePiece.radius;
  const count = (loc: string) => welded.pieceSpawns.filter((s) => s.location === loc).length;

  it('totals 504: 408 neutral (no robots), 24 per DEPOT, 24 per OUTPOST', () => {
    expect(welded.pieceSpawns).toHaveLength(504);
    expect(count('neutral')).toBe(408);
    expect(count('depot')).toBe(48);
    expect(count('outpost')).toBe(48);
  });

  it('moves preloaded FUEL out of the NEUTRAL ZONE', () => {
    const preloaded = createRebuiltField({ preloadedFuel: 48 });
    expect(preloaded.pieceSpawns.filter((s) => s.location === 'neutral')).toHaveLength(360);
  });

  it('uses 5.91in FUEL', () => {
    expect((2 * r) / IN).toBeCloseTo(5.91, 6);
  });

  it('never overlaps two balls', () => {
    const p = welded.pieceSpawns.map((s) => s.position);
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const d = Math.hypot(p[i]!.x - p[j]!.x, p[i]!.y - p[j]!.y, p[i]!.z - p[j]!.z);
        expect(d).toBeGreaterThanOrEqual(2 * r - 1e-9);
      }
    }
  });

  // 408 balls do not fit the 71.9in depth in one layer without touching; the staggered rows
  // overrun it by ~12.5 mm. Reported as an approximation.
  it('keeps the neutral pool centred and within the published footprint (+1.5 cm)', () => {
    const neutral = welded.pieceSpawns.filter((s) => s.location === 'neutral');
    const xs = neutral.map((s) => s.position.x);
    const ys = neutral.map((s) => s.position.y);
    const cx = welded.lengthM / 2;
    const cy = welded.widthM / 2;
    expect(Math.max(...ys) + r - cy).toBeLessThanOrEqual((181.9 / 2) * IN + 1e-9);
    expect(Math.max(...xs) + r - cx).toBeLessThanOrEqual((71.9 / 2) * IN + 0.015);
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    expect(meanX).toBeCloseTo(cx, 6);
    expect(meanY).toBeCloseTo(cy, 6);
  });

  it('keeps DEPOT FUEL inside the barriers', () => {
    const depot = element(welded, 'blue', 'depot');
    if (depot.type !== 'depot') throw new Error();
    const balls = welded.pieceSpawns.filter((s) => s.location === 'depot' && s.alliance === 'blue');
    for (const b of balls) {
      expect(b.position.x - r).toBeGreaterThanOrEqual(-1e-9);
      expect(b.position.x + r).toBeLessThanOrEqual(
        depot.dims.depth - depot.dims.barrierWidth + 1e-9,
      );
      expect(Math.abs(b.position.y - depot.pose.y) + r).toBeLessThanOrEqual(
        depot.dims.width / 2 - depot.dims.barrierWidth + 1e-9,
      );
    }
  });
});

describe('collision geometry', () => {
  it('uses only simple shapes and covers every structural element', () => {
    const owners = new Set(welded.colliders.map((c) => c.owner));
    for (const id of [
      'hub',
      'bump-left',
      'bump-right',
      'trench-left',
      'trench-right',
      'tower',
      'depot',
      'wall',
    ]) {
      expect(owners.has(`blue-${id}`)).toBe(true);
      expect(owners.has(`red-${id}`)).toBe(true);
    }
    expect(owners.has('guardrail-left') && owners.has('guardrail-right')).toBe(true);
    for (const c of welded.colliders) expect(['box', 'cylinder', 'convex']).toContain(c.kind);
  });

  it('keeps the TRENCH clearance at 22.25in', () => {
    const arm = welded.colliders.find((c) => c.owner === 'blue-trench-right' && c.kind === 'box');
    if (arm?.kind !== 'box') throw new Error();
    expect((arm.center.z - arm.halfExtents.z) / IN).toBeCloseTo(22.25, 6);
  });
});

describe('AndyMark variant', () => {
  it('uses its own field size and tag-derived positions', () => {
    expect(andymark.lengthM).toBeCloseTo(16.518, 6);
    expect(andymark.widthM).toBeCloseTo(8.043, 6);
    expect(element(andymark, 'blue', 'hub').pose.x).not.toBeCloseTo(
      element(welded, 'blue', 'hub').pose.x,
      4,
    );
    expect(andymark.pieceSpawns).toHaveLength(504);
  });
});

describe('FieldState', () => {
  it('restores every piece on reset', () => {
    const state = new FieldState(welded);
    const before = state.positions.slice();
    state.positions[0] = 99;
    state.positions[10] = -5;
    state.markChanged();
    const rev = state.revision;
    state.reset();
    expect(state.positions).toEqual(before);
    expect(state.revision).toBeGreaterThan(rev);
  });
});

describe('tag36h11', () => {
  it('produces a white outer ring and a black inner ring', () => {
    const cells = tag36h11Cells(1);
    const at = (x: number, y: number) => cells[y * 10 + x];
    for (let i = 0; i < 10; i++) {
      expect(at(i, 0) && at(i, 9) && at(0, i) && at(9, i)).toBe(true);
    }
    for (let i = 1; i < 9; i++) {
      expect(at(i, 1) || at(i, 8) || at(1, i) || at(8, i)).toBe(false);
    }
  });

  // Data areas decoded from AprilRobotics/apriltag-imgs tag36h11/tag36_11_000NN.png (1 = white).
  const OFFICIAL: Record<number, string[]> = {
    0: ['110101', '011101', '011000', '101000', '010110', '000100'],
    1: ['110110', '010111', '111100', '011000', '101101', '001001'],
    20: ['100000', '011101', '101001', '001001', '010010', '101111'],
    26: ['101100', '010110', '111001', '111101', '111110', '110000'],
    32: ['010000', '111101', '010000', '001100', '011001', '111000'],
  };

  it.each(Object.keys(OFFICIAL).map(Number))('matches the official image for ID %i', (id) => {
    const cells = tag36h11Cells(id);
    const rows = Array.from({ length: 6 }, (_, y) =>
      Array.from({ length: 6 }, (_, x) => (cells[(y + 2) * 10 + x + 2] ? '1' : '0')).join(''),
    );
    expect(rows).toEqual(OFFICIAL[id]);
  });
});
