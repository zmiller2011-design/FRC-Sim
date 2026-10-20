import { type ChassisSpeeds, wrapAngle } from '@/core';

/** Desired (or measured) state of one swerve module: wheel speed and steering angle. */
export interface ModuleState {
  /** Wheel ground speed along `angle` (m/s); may be negative after optimisation. */
  speed: number;
  /** Steering angle in the robot frame (rad). */
  angle: number;
}

export function makeModuleStates(count: number): ModuleState[] {
  return Array.from({ length: count }, () => ({ speed: 0, angle: 0 }));
}

/**
 * Swerve kinematics for modules at fixed robot-frame positions (relative to the point the
 * chassis speeds refer to). All methods write into caller-provided objects.
 */
export class SwerveKinematics {
  private readonly xs: Float64Array;
  private readonly ys: Float64Array;
  /** Pseudo-inverse rows for forward kinematics (least squares over all modules). */
  private readonly pinv: Float64Array;

  constructor(positions: readonly { x: number; y: number }[]) {
    const n = positions.length;
    this.xs = Float64Array.from(positions, (p) => p.x);
    this.ys = Float64Array.from(positions, (p) => p.y);

    // A (2n × 3): rows [1, 0, −y] and [0, 1, x]. pinv = (AᵀA)⁻¹ Aᵀ.
    let sx = 0;
    let sy = 0;
    let sr = 0;
    for (let i = 0; i < n; i++) {
      sx += this.xs[i]!;
      sy += this.ys[i]!;
      sr += this.xs[i]! ** 2 + this.ys[i]! ** 2;
    }
    const ata = [
      [n, 0, -sy],
      [0, n, sx],
      [-sy, sx, sr],
    ] as const;
    const inv = invert3(ata);
    this.pinv = new Float64Array(3 * 2 * n);
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < n; i++) {
        const row = inv[r]!;
        // Aᵀ column for module i's x row: (1, 0, −y); y row: (0, 1, x).
        this.pinv[r * 2 * n + 2 * i] = row[0]! - row[2]! * this.ys[i]!;
        this.pinv[r * 2 * n + 2 * i + 1] = row[1]! + row[2]! * this.xs[i]!;
      }
    }
  }

  get moduleCount(): number {
    return this.xs.length;
  }

  /** Module position used by the kinematics (relative to the rotation centre). */
  positionX(i: number): number {
    return this.xs[i]!;
  }

  positionY(i: number): number {
    return this.ys[i]!;
  }

  /** Inverse kinematics: robot-relative chassis speeds → per-module speed and angle. */
  toModuleStates(speeds: ChassisSpeeds, out: ModuleState[], keepAngles?: readonly number[]): void {
    for (let i = 0; i < this.xs.length; i++) {
      const vx = speeds.vx - speeds.omega * this.ys[i]!;
      const vy = speeds.vy + speeds.omega * this.xs[i]!;
      const speed = Math.hypot(vx, vy);
      const state = out[i]!;
      state.speed = speed;
      // With no motion requested, hold the current angle instead of snapping to 0.
      state.angle = speed > 1e-6 ? Math.atan2(vy, vx) : (keepAngles?.[i] ?? state.angle);
    }
  }

  /** Forward kinematics (least squares): module states → robot-relative chassis speeds. */
  toChassisSpeeds(states: readonly ModuleState[], out: ChassisSpeeds): ChassisSpeeds {
    const n = this.xs.length;
    let vx = 0;
    let vy = 0;
    let omega = 0;
    for (let i = 0; i < n; i++) {
      const s = states[i]!;
      const mx = s.speed * Math.cos(s.angle);
      const my = s.speed * Math.sin(s.angle);
      vx += this.pinv[2 * i]! * mx + this.pinv[2 * i + 1]! * my;
      vy += this.pinv[2 * n + 2 * i]! * mx + this.pinv[2 * n + 2 * i + 1]! * my;
      omega += this.pinv[4 * n + 2 * i]! * mx + this.pinv[4 * n + 2 * i + 1]! * my;
    }
    out.vx = vx;
    out.vy = vy;
    out.omega = omega;
    return out;
  }
}

/**
 * Scales every module speed down proportionally if any exceeds `maxSpeed`, preserving the
 * direction of motion (translation and rotation keep their ratio).
 */
export function desaturate(states: ModuleState[], maxSpeed: number): void {
  let peak = 0;
  for (const s of states) peak = Math.max(peak, Math.abs(s.speed));
  if (peak <= maxSpeed || peak === 0) return;
  const k = maxSpeed / peak;
  for (const s of states) s.speed *= k;
}

/**
 * Chooses the equivalent target (angle + π with reversed speed) that needs less than 90° of
 * steering from `currentAngle`. Returns the angle error after optimisation.
 */
export function optimize(state: ModuleState, currentAngle: number): number {
  let error = wrapAngle(state.angle - currentAngle);
  if (Math.abs(error) > Math.PI / 2) {
    state.angle = wrapAngle(state.angle + Math.PI);
    state.speed = -state.speed;
    error = wrapAngle(state.angle - currentAngle);
  }
  state.angle = currentAngle + error;
  return error;
}

/**
 * Converts speeds intended to be held for `dt` into the constant twist that actually ends at
 * the intended pose (WPILib ChassisSpeeds.discretize). Without this, translating while
 * rotating drifts sideways because the heading changes during the step.
 */
export function discretize(speeds: ChassisSpeeds, dt: number, out: ChassisSpeeds): ChassisSpeeds {
  const dx = speeds.vx * dt;
  const dy = speeds.vy * dt;
  const dtheta = speeds.omega * dt;
  const half = dtheta / 2;
  const cosMinusOne = Math.cos(dtheta) - 1;
  const a =
    Math.abs(cosMinusOne) < 1e-9
      ? 1 - (dtheta * dtheta) / 12
      : -(half * Math.sin(dtheta)) / cosMinusOne;
  // Rotate (dx, dy) by the angle whose (cos, sin) ∝ (a, −half), scaled by hypot(a, half).
  out.vx = (a * dx + half * dy) / dt;
  out.vy = (-half * dx + a * dy) / dt;
  out.omega = dtheta / dt;
  return out;
}

/** Rotates a field-frame velocity into the robot frame for a given heading. */
export function fieldToRobot(
  vx: number,
  vy: number,
  heading: number,
  out: ChassisSpeeds,
): ChassisSpeeds {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  out.vx = c * vx + s * vy;
  out.vy = -s * vx + c * vy;
  return out;
}

function invert3(m: readonly (readonly number[])[]): number[][] {
  const [a, b, c] = m[0]!;
  const [d, e, f] = m[1]!;
  const [g, h, i] = m[2]!;
  const A = e! * i! - f! * h!;
  const B = -(d! * i! - f! * g!);
  const C = d! * h! - e! * g!;
  const det = a! * A + b! * B + c! * C;
  if (Math.abs(det) < 1e-12) throw new Error('Module layout is degenerate');
  const k = 1 / det;
  return [
    [A * k, -(b! * i! - c! * h!) * k, (b! * f! - c! * e!) * k],
    [B * k, (a! * i! - c! * g!) * k, -(a! * f! - c! * d!) * k],
    [C * k, -(a! * h! - b! * g!) * k, (a! * e! - b! * d!) * k],
  ];
}
