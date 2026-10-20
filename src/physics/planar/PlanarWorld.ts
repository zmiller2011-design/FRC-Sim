import { type Contact, collideObb, makeContact, type Obb, obbCorners } from './obb';
import type { RigidBody2D } from './RigidBody2D';
import { type Ramp, sampleTerrain, type TerrainSample } from './terrain';

export interface PlanarWorldOptions {
  /** Playing-area rectangle the body must stay inside (walls and guardrails). */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Solid obstacles the body cannot pass through. */
  obstacles: readonly Obb[];
  /** Drive-over terrain. */
  ramps: readonly Ramp[];
  /** Coefficient of restitution for impacts (0 = no bounce). */
  restitution?: number;
  /** Friction between the bumpers and obstacles. */
  wallFriction?: number;
}

/** A body's collision footprint: a rectangle offset from its centre of mass. */
export interface Footprint {
  halfLength: number;
  halfWidth: number;
  /** Footprint centre relative to the centre of mass, in the body frame. */
  offsetX: number;
  offsetY: number;
}

const ITERATIONS = 4;
const SLOP = 0.0005;

/**
 * Static collision world for planar bodies: field bounds, solid obstacles and drive-over
 * ramps. Resolution moves the body out of penetration and applies impulses at the contact
 * point, so glancing hits rotate the robot as they would in reality.
 */
export class PlanarWorld {
  readonly options: Required<PlanarWorldOptions>;
  private readonly box: Obb = { cx: 0, cy: 0, hx: 0, hy: 0, angle: 0 };
  private readonly contact: Contact = makeContact();
  private readonly corners = new Float64Array(8);
  /** Contacts resolved during the most recent `resolve` call. */
  lastContactCount = 0;

  constructor(options: PlanarWorldOptions) {
    this.options = { restitution: 0.05, wallFriction: 0.25, ...options };
  }

  sampleTerrain(x: number, y: number, out: TerrainSample): TerrainSample {
    return sampleTerrain(this.options.ramps, x, y, out);
  }

  /** Pushes the body out of every overlap and removes approaching velocity at contacts. */
  resolve(body: RigidBody2D, footprint: Footprint): number {
    let contacts = 0;
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
      let any = false;
      this.updateBox(body, footprint);
      if (this.resolveBounds(body)) {
        any = true;
        contacts++;
        this.updateBox(body, footprint);
      }
      const obstacles = this.options.obstacles;
      for (let i = 0; i < obstacles.length; i++) {
        if (collideObb(this.box, obstacles[i]!, this.contact)) {
          this.applyContact(body, this.contact);
          this.updateBox(body, footprint);
          any = true;
          contacts++;
        }
      }
      if (!any) break;
    }
    this.lastContactCount = contacts;
    return contacts;
  }

  private updateBox(body: RigidBody2D, f: Footprint): void {
    const c = Math.cos(body.angle);
    const s = Math.sin(body.angle);
    this.box.cx = body.x + c * f.offsetX - s * f.offsetY;
    this.box.cy = body.y + s * f.offsetX + c * f.offsetY;
    this.box.hx = f.halfLength;
    this.box.hy = f.halfWidth;
    this.box.angle = body.angle;
  }

  /**
   * Handles the side of the bounds rectangle the body penetrates most. The contact point is
   * the average of the corners past that side, so a robot pushed flat against a wall gets a
   * centred impulse instead of rocking between corners.
   */
  private resolveBounds(body: RigidBody2D): boolean {
    const { minX, maxX, minY, maxY } = this.options.bounds;
    obbCorners(this.box, this.corners);
    let depth = 0;
    let side = -1;
    for (let i = 0; i < 4; i++) {
      const px = this.corners[i * 2]!;
      const py = this.corners[i * 2 + 1]!;
      for (let k = 0; k < 4; k++) {
        const d = sideDepth(k, px, py, minX, maxX, minY, maxY);
        if (d > depth) {
          depth = d;
          side = k;
        }
      }
    }
    if (side < 0) return false;
    const c = this.contact;
    const normal = BOUND_NORMALS[side]!;
    c.nx = normal[0];
    c.ny = normal[1];
    c.depth = depth;
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (let i = 0; i < 4; i++) {
      const px = this.corners[i * 2]!;
      const py = this.corners[i * 2 + 1]!;
      const d =
        side === 0 ? minX - px : side === 1 ? px - maxX : side === 2 ? minY - py : py - maxY;
      if (d >= depth - FACE_TOLERANCE) {
        sx += px;
        sy += py;
        count++;
      }
    }
    c.px = sx / count;
    c.py = sy / count;
    this.applyContact(body, c);
    return true;
  }

  private applyContact(body: RigidBody2D, c: Contact): void {
    // Positional correction (no rotation) removes the overlap beyond a small slop.
    const push = Math.max(c.depth - SLOP, 0) + SLOP * 0.5;
    body.x += c.nx * push;
    body.y += c.ny * push;

    const rx = c.px - body.x;
    const ry = c.py - body.y;
    const vx = body.pointVelocityX(ry);
    const vy = body.pointVelocityY(rx);
    const vn = vx * c.nx + vy * c.ny;
    if (vn >= 0) return;
    // Resting contact (slow approach) gets no bounce so a robot pushing a wall stays still.
    const e = vn < -BOUNCE_THRESHOLD ? this.options.restitution : 0;
    const jn = -(1 + e) * vn * body.effectiveMass(rx, ry, c.nx, c.ny);
    body.applyImpulse(rx, ry, jn * c.nx, jn * c.ny);

    // Coulomb friction along the contact tangent.
    const tx = -c.ny;
    const ty = c.nx;
    const vt = body.pointVelocityX(ry) * tx + body.pointVelocityY(rx) * ty;
    const jtMax = this.options.wallFriction * jn;
    const jt = Math.min(Math.max(-vt * body.effectiveMass(rx, ry, tx, ty), -jtMax), jtMax);
    body.applyImpulse(rx, ry, jt * tx, jt * ty);
  }
}

/** How far (px, py) lies beyond bounds side k (0 = min X, 1 = max X, 2 = min Y, 3 = max Y). */
function sideDepth(
  k: number,
  px: number,
  py: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): number {
  return k === 0 ? minX - px : k === 1 ? px - maxX : k === 2 ? minY - py : py - maxY;
}

/** Inward normals of the bounds rectangle's sides: min X, max X, min Y, max Y. */
const BOUND_NORMALS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
/** Approach speed (m/s) below which impacts don't bounce. */
const BOUNCE_THRESHOLD = 0.4;
/** Corners within this distance of the deepest one count as the same contact face (m). */
const FACE_TOLERANCE = 0.01;
