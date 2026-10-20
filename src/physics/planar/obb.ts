/** Oriented rectangle on the field plane. */
export interface Obb {
  cx: number;
  cy: number;
  /** Half extents along the box's own X and Y axes. */
  hx: number;
  hy: number;
  angle: number;
}

export interface Contact {
  /** Unit normal pointing from the obstacle toward the body (direction to push the body). */
  nx: number;
  ny: number;
  /** Penetration depth along the normal (m), > 0 when overlapping. */
  depth: number;
  /** Contact point in field coordinates. */
  px: number;
  py: number;
}

export function makeContact(): Contact {
  return { nx: 0, ny: 0, depth: 0, px: 0, py: 0 };
}

const cornersA = new Float64Array(8);
/** Corners within this distance of the deepest one count as the same contact face (m). */
const FACE_TOLERANCE = 0.01;
const cornersB = new Float64Array(8);

/** Writes the four corners (x0, y0, x1, y1, …) of a box into `out`. */
export function obbCorners(b: Obb, out: Float64Array): Float64Array {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const ax = c * b.hx;
  const ay = s * b.hx;
  const bx = -s * b.hy;
  const by = c * b.hy;
  out[0] = b.cx + ax + bx;
  out[1] = b.cy + ay + by;
  out[2] = b.cx - ax + bx;
  out[3] = b.cy - ay + by;
  out[4] = b.cx - ax - bx;
  out[5] = b.cy - ay - by;
  out[6] = b.cx + ax - bx;
  out[7] = b.cy + ay - by;
  return out;
}

function projectRadius(b: Obb, axisX: number, axisY: number): number {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  return b.hx * Math.abs(c * axisX + s * axisY) + b.hy * Math.abs(-s * axisX + c * axisY);
}

function inside(b: Obb, px: number, py: number, slop: number): boolean {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const dx = px - b.cx;
  const dy = py - b.cy;
  return Math.abs(c * dx + s * dy) <= b.hx + slop && Math.abs(-s * dx + c * dy) <= b.hy + slop;
}

/**
 * Separating-axis test between a moving body box and a static obstacle box. On overlap,
 * fills `out` with the minimum-translation normal (obstacle → body), depth and a contact
 * point, and returns true.
 */
export function collideObb(body: Obb, obstacle: Obb, out: Contact): boolean {
  let best = Infinity;
  let bnx = 0;
  let bny = 0;
  const dx = body.cx - obstacle.cx;
  const dy = body.cy - obstacle.cy;
  for (let i = 0; i < 4; i++) {
    const box = i < 2 ? body : obstacle;
    const a = box.angle + (i % 2 === 0 ? 0 : Math.PI / 2);
    const axisX = Math.cos(a);
    const axisY = Math.sin(a);
    const distance = dx * axisX + dy * axisY;
    const overlap =
      projectRadius(body, axisX, axisY) +
      projectRadius(obstacle, axisX, axisY) -
      Math.abs(distance);
    if (overlap <= 0) return false;
    if (overlap < best) {
      best = overlap;
      const sign = distance >= 0 ? 1 : -1;
      bnx = axisX * sign;
      bny = axisY * sign;
    }
  }
  out.nx = bnx;
  out.ny = bny;
  out.depth = best;

  // Contact point: the body corners inside the obstacle (averaged when a whole face is in
  // contact, so flat pushes don't create spurious spin), else the obstacle corner deepest
  // into the body, else the midpoint between the centres.
  obbCorners(body, cornersA);
  obbCorners(obstacle, cornersB);
  let found = false;
  let deepest = Infinity;
  for (let i = 0; i < 4; i++) {
    const px = cornersA[i * 2]!;
    const py = cornersA[i * 2 + 1]!;
    if (inside(obstacle, px, py, 1e-6)) deepest = Math.min(deepest, px * bnx + py * bny);
  }
  if (deepest !== Infinity) {
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (let i = 0; i < 4; i++) {
      const px = cornersA[i * 2]!;
      const py = cornersA[i * 2 + 1]!;
      if (
        inside(obstacle, px, py, FACE_TOLERANCE) &&
        px * bnx + py * bny <= deepest + FACE_TOLERANCE
      ) {
        sx += px;
        sy += py;
        count++;
      }
    }
    out.px = sx / count;
    out.py = sy / count;
    found = true;
  }
  if (!found) {
    let highest = -Infinity;
    for (let i = 0; i < 4; i++) {
      const px = cornersB[i * 2]!;
      const py = cornersB[i * 2 + 1]!;
      const along = px * bnx + py * bny;
      if (along > highest && inside(body, px, py, 1e-6)) {
        highest = along;
        out.px = px;
        out.py = py;
        found = true;
      }
    }
  }
  if (!found) {
    out.px = (body.cx + obstacle.cx) / 2;
    out.py = (body.cy + obstacle.cy) / 2;
  }
  return true;
}
