import type { GeometryBatcher } from '../GeometryBatcher';
import type { ElementOf } from './types';

const HOOK = 0.003;

/** DEPOT: three low steel barriers against the ALLIANCE WALL with hook-fastener tops. */
export function buildDepot(b: GeometryBatcher, depot: ElementOf<'depot'>): void {
  const { width: w, depth, barrierWidth: bw, barrierHeight: bh } = depot.dims;
  const p = depot.pose;
  const steel = bh - HOOK;
  const parts: [number, number, number, number][] = [
    [depth - bw, depth, -w / 2, w / 2],
    [0, depth - bw, -w / 2, -w / 2 + bw],
    [0, depth - bw, w / 2 - bw, w / 2],
  ];
  for (const [x0, x1, y0, y1] of parts) {
    b.boxSpan('steelDark', p, x0, x1, y0, y1, 0, steel);
    b.boxSpan('blackFrame', p, x0, x1, y0, y1, steel, bh);
  }
}
