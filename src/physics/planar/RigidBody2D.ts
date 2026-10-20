/**
 * Planar rigid body integrated at its centre of mass. Field frame: X/Y on the carpet,
 * angle CCW about +Z. All methods are allocation-free.
 */
export class RigidBody2D {
  /** Centre of mass position (m). */
  x = 0;
  y = 0;
  /** Heading (rad). */
  angle = 0;
  /** Linear velocity of the centre of mass (m/s, field frame). */
  vx = 0;
  vy = 0;
  /** Angular velocity (rad/s). */
  omega = 0;

  readonly invMass: number;
  readonly invInertia: number;

  constructor(
    readonly mass: number,
    readonly inertia: number,
  ) {
    if (!(mass > 0) || !(inertia > 0)) throw new RangeError('Mass and inertia must be positive');
    this.invMass = 1 / mass;
    this.invInertia = 1 / inertia;
  }

  /**
   * Applies an impulse (N·s) at a point given relative to the centre of mass (field-frame
   * offset `rx, ry`).
   */
  applyImpulse(rx: number, ry: number, jx: number, jy: number): void {
    this.vx += jx * this.invMass;
    this.vy += jy * this.invMass;
    this.omega += (rx * jy - ry * jx) * this.invInertia;
  }

  /** Velocity of a point at offset (rx, ry) from the centre of mass: v + ω × r. */
  pointVelocityX(ry: number): number {
    return this.vx - this.omega * ry;
  }

  pointVelocityY(rx: number): number {
    return this.vy + this.omega * rx;
  }

  /** Effective mass for an impulse along unit direction (nx, ny) applied at offset (rx, ry). */
  effectiveMass(rx: number, ry: number, nx: number, ny: number): number {
    const rn = rx * ny - ry * nx;
    return 1 / (this.invMass + rn * rn * this.invInertia);
  }

  /** Semi-implicit Euler position update using the current velocities. */
  integrate(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.omega * dt;
  }

  setState(x: number, y: number, angle: number, vx = 0, vy = 0, omega = 0): void {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = vx;
    this.vy = vy;
    this.omega = omega;
  }
}
