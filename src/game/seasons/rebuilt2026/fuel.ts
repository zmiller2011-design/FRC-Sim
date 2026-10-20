import { localToField } from '@/field/transforms';
import type { Alliance, FieldElement, PieceSpawn } from '@/field/types';
import type { RebuiltAnchors } from './field';

export interface FuelLayoutInput {
  anchors: RebuiltAnchors;
  elements: readonly FieldElement[];
  fuelRadius: number;
  neutralCount: number;
  poolWidth: number;
  poolDepth: number;
  perDepot: number;
  perOutpost: number;
}

/** Small clearance between neighbouring balls so a future physics step starts at rest. */
const GAP_M = 0.001;
/** [APPROX] slope of the OUTPOST CHUTE tray. */
const CHUTE_SLOPE = (15 * Math.PI) / 180;

/**
 * Starting FUEL positions.
 *
 * - NEUTRAL ZONE: the official arrangement figure (manual 6.3.4.1) was not available, so FUEL
 *   is packed in staggered rows inside the published 181.9in × 71.9in pool, centred on the
 *   field. The layout is point-symmetric like the field, so neither alliance is favoured. [APPROX]
 * - DEPOT: a grid inside the steel barriers.
 * - OUTPOST: stacked on the CHUTE tray behind the wall, feeding the opening.
 */
export function generateFuelSpawns(input: FuelLayoutInput): PieceSpawn[] {
  return [
    ...neutralPool(input),
    ...input.elements.flatMap((e) => {
      if (e.type === 'depot') return depotGrid(e, input);
      if (e.type === 'outpost') return outpostChute(e, input);
      return [];
    }),
  ];
}

function neutralPool(input: FuelLayoutInput): PieceSpawn[] {
  const { anchors, fuelRadius: r, neutralCount, poolWidth, poolDepth } = input;
  if (neutralCount <= 0) return [];
  const cx = anchors.lengthM / 2;
  const cy = anchors.widthM / 2;

  // Rows run across the field (along Y); neighbouring rows are offset by half a pitch.
  const pitch = 2 * r + GAP_M;
  const perRow = Math.floor((poolWidth - 2 * r - pitch / 2) / pitch) + 1;
  const rowPitch = Math.sqrt(pitch * pitch - (pitch / 2) * (pitch / 2));
  const rows = Math.ceil(neutralCount / perRow);
  void poolDepth; // Rows are packed as tightly as the balls allow; see the report for overrun.

  const candidates: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row++) {
    const dx = (row - (rows - 1) / 2) * rowPitch;
    const stagger = (row % 2 === 0 ? 1 : -1) * (pitch / 4);
    for (let col = 0; col < perRow; col++) {
      const dy = (col - (perRow - 1) / 2) * pitch + stagger;
      candidates.push({ x: cx + dx, y: cy + dy });
    }
  }

  // Remove surplus balls from the corners in point-symmetric pairs.
  let surplus = candidates.length - neutralCount;
  if (surplus > 0) {
    const hx = (rows * rowPitch) / 2;
    const hy = (perRow * pitch) / 2;
    const cornerness = (p: { x: number; y: number }) =>
      Math.abs(p.x - cx) / hx + Math.abs(p.y - cy) / hy;
    const order = candidates
      .map((p, i) => ({ i, k: cornerness(p) }))
      .sort((a, b) => b.k - a.k || a.i - b.i);
    const removed = new Set<number>();
    const keyOf = (x: number, y: number) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;
    const index = new Map(candidates.map((p, i) => [keyOf(p.x, p.y), i]));
    for (const { i } of order) {
      if (surplus <= 0) break;
      if (removed.has(i)) continue;
      const p = candidates[i]!;
      const mirror = index.get(keyOf(2 * cx - p.x, 2 * cy - p.y));
      removed.add(i);
      surplus--;
      if (surplus > 0 && mirror !== undefined && !removed.has(mirror)) {
        removed.add(mirror);
        surplus--;
      }
    }
    return candidates
      .filter((_, i) => !removed.has(i))
      .map((p) => ({ position: { x: p.x, y: p.y, z: r }, location: 'neutral', alliance: null }));
  }
  return candidates.map((p) => ({
    position: { x: p.x, y: p.y, z: r },
    location: 'neutral',
    alliance: null,
  }));
}

function depotGrid(
  e: Extract<FieldElement, { type: 'depot' }>,
  input: FuelLayoutInput,
): PieceSpawn[] {
  const r = input.fuelRadius;
  const d = e.dims;
  const innerDepth = d.depth - d.barrierWidth;
  const innerWidth = d.width - 2 * d.barrierWidth;
  const rows = Math.max(1, Math.floor(innerDepth / (2 * r)));
  const cols = Math.ceil(input.perDepot / rows);
  const spawns: PieceSpawn[] = [];
  for (let i = 0; i < input.perDepot; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const lx = (row + 0.5) * (innerDepth / rows);
    const ly = (col + 0.5) * (innerWidth / cols) - innerWidth / 2;
    spawns.push(spawn(e.pose, lx, ly, r, 'depot', e.alliance));
  }
  return spawns;
}

function outpostChute(
  e: Extract<FieldElement, { type: 'outpost' }>,
  input: FuelLayoutInput,
): PieceSpawn[] {
  const r = input.fuelRadius;
  const d = e.dims;
  const wall = input.elements.find((w) => w.type === 'allianceWall' && w.alliance === e.alliance);
  const wallThickness = wall?.type === 'allianceWall' ? wall.dims.thickness : 0;
  const pitch = 2 * r + GAP_M;
  const across = Math.max(1, Math.floor(d.openingWidth / pitch));
  const spawns: PieceSpawn[] = [];
  for (let i = 0; i < input.perOutpost; i++) {
    const row = Math.floor(i / across);
    const col = i % across;
    const back = wallThickness + r + row * pitch * Math.cos(CHUTE_SLOPE);
    const ly = (col - (across - 1) / 2) * pitch;
    const z = d.openingBottom + r + back * Math.tan(CHUTE_SLOPE);
    spawns.push(spawn(e.pose, -back, ly, z, 'outpost', e.alliance));
  }
  return spawns;
}

function spawn(
  pose: { x: number; y: number; yaw: number },
  lx: number,
  ly: number,
  z: number,
  location: PieceSpawn['location'],
  alliance: Alliance,
): PieceSpawn {
  return { position: localToField(pose, lx, ly, z), location, alliance };
}
