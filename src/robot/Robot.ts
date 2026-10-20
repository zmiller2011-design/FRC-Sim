import type { ChassisSpeeds } from '@/core';
import { type Footprint, makeTerrainSample, type PlanarWorld, RigidBody2D } from '@/physics/planar';
import { type NeutralMode, outerSize, type RobotConfig, yawInertia } from './config/types';
import { copyDriveCommand, type DriveCommand, makeDriveCommand } from './DriveCommand';
import { SwerveDrivetrain } from './drivetrain/SwerveDrivetrain';

const GRAVITY = 9.80665;
/** Sequential-impulse passes for wheel side friction. */
const FRICTION_ITERATIONS = 4;
/** Smoothing for the displayed acceleration (fraction of the new sample per step). */
const ACCEL_SMOOTHING = 0.25;

/** Everything the renderer needs to draw one robot at one simulation step. */
export interface RobotRenderState {
  /** Frame-centre pose (field frame). */
  x: number;
  y: number;
  heading: number;
  /** Chassis height, pitch and roll from the terrain under the wheels. */
  z: number;
  pitch: number;
  roll: number;
  /** Per-module steering angle and accumulated wheel rotation (rad). */
  steer: Float64Array;
  wheel: Float64Array;
}

function makeRenderState(modules: number): RobotRenderState {
  return {
    x: 0,
    y: 0,
    heading: 0,
    z: 0,
    pitch: 0,
    roll: 0,
    steer: new Float64Array(modules),
    wheel: new Float64Array(modules),
  };
}

function copyRenderState(from: RobotRenderState, to: RobotRenderState): void {
  to.x = from.x;
  to.y = from.y;
  to.heading = from.heading;
  to.z = from.z;
  to.pitch = from.pitch;
  to.roll = from.roll;
  to.steer.set(from.steer);
  to.wheel.set(from.wheel);
}

/**
 * A simulated swerve robot: drivetrain controller, module and motor models, and a planar
 * rigid body that collides with the field. Independent of rendering and UI.
 *
 * Call {@link control} at the control rate and {@link step} at the physics rate.
 */
export class Robot {
  readonly body: RigidBody2D;
  readonly drive: SwerveDrivetrain;
  readonly footprint: Footprint;
  /** Field-frame acceleration of the centre of mass, smoothed (m/s², rad/s²). */
  readonly accel = { x: 0, y: 0, angular: 0 };
  /** Snapshots for render interpolation: state before and after the latest step. */
  readonly previous: RobotRenderState;
  readonly current: RobotRenderState;
  /** The command most recently applied. */
  readonly command: DriveCommand = makeDriveCommand();
  /** Contacts with walls/obstacles during the latest step. */
  contacts = 0;
  /** Height of terrain under the chassis centre (m). */
  terrainHeight = 0;
  /** Drive motor neutral behaviour; starts from the config and can be changed live. */
  neutralMode: NeutralMode;

  private readonly normalLoads: Float64Array;
  private readonly offX: Float64Array;
  private readonly offY: Float64Array;
  private readonly dirX: Float64Array;
  private readonly dirY: Float64Array;
  private readonly sideImpulse: Float64Array;
  private readonly sideBudget: Float64Array;
  private readonly terrain = makeTerrainSample();
  private readonly heights: Float64Array;
  private readonly measured: ChassisSpeeds = { vx: 0, vy: 0, omega: 0 };

  constructor(
    readonly config: RobotConfig,
    private world: PlanarWorld,
  ) {
    const c = config.chassis;
    this.neutralMode = config.neutralMode;
    this.body = new RigidBody2D(c.massKg, yawInertia(c));
    this.drive = new SwerveDrivetrain(config);
    const { length, width } = outerSize(c);
    this.footprint = {
      halfLength: length / 2,
      halfWidth: width / 2,
      offsetX: -c.centerOfMass.x,
      offsetY: -c.centerOfMass.y,
    };
    const n = config.modules.length;
    this.normalLoads = staticLoads(config);
    this.offX = new Float64Array(n);
    this.offY = new Float64Array(n);
    this.dirX = new Float64Array(n);
    this.dirY = new Float64Array(n);
    this.sideImpulse = new Float64Array(n);
    this.sideBudget = new Float64Array(n);
    this.heights = new Float64Array(n);
    this.previous = makeRenderState(n);
    this.current = makeRenderState(n);
  }

  /** Replaces the collision world (e.g. after switching field variants). */
  setWorld(world: PlanarWorld): void {
    this.world = world;
  }

  /** Places the robot at rest with its frame centre at (x, y). */
  reset(x: number, y: number, heading: number): void {
    const com = this.config.chassis.centerOfMass;
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    this.body.setState(x + c * com.x - s * com.y, y + s * com.x + c * com.y, heading);
    this.drive.reset();
    this.accel.x = this.accel.y = this.accel.angular = 0;
    copyDriveCommand(makeDriveCommand(), this.command);
    this.updateRenderState();
    copyRenderState(this.current, this.previous);
  }

  /** Control tick: hands a command to the drivetrain controller. */
  control(command: DriveCommand, dt: number): void {
    copyDriveCommand(command, this.command);
    this.measured.vx = this.body.vx;
    this.measured.vy = this.body.vy;
    this.measured.omega = this.body.omega;
    this.drive.applyCommand(command, this.body.angle, dt, this.measured);
  }

  /** Physics tick. */
  step(dt: number): void {
    copyRenderState(this.current, this.previous);
    const body = this.body;
    const modules = this.drive.modules;
    const n = modules.length;
    // X-lock always holds with brake mode; otherwise use the configured neutral mode.
    const neutral = this.command.xLock ? 'brake' : this.neutralMode;
    const com = this.config.chassis.centerOfMass;
    const vx0 = body.vx;
    const vy0 = body.vy;
    const w0 = body.omega;

    const c = Math.cos(body.angle);
    const s = Math.sin(body.angle);
    // Wheel directions use the heading and steering angles at the middle of the step
    // (midpoint rule): both rotate during the step, and using either end biases the
    // direction by half a step and makes a spinning robot drift sideways.
    for (let i = 0; i < n; i++) {
      const m = modules[i]!;
      const px = m.config.position.x - com.x;
      const py = m.config.position.y - com.y;
      this.offX[i] = c * px - s * py;
      this.offY[i] = s * px + c * py;
      const a = body.angle + body.omega * dt * 0.5 + m.steerAngle + m.steerRate * dt * 0.5;
      this.dirX[i] = Math.cos(a);
      this.dirY[i] = Math.sin(a);
    }

    // 1. Drive forces along each wheel (motor model, traction-limited).
    const mu = this.config.moduleHardware.wheelCoF;
    for (let i = 0; i < n; i++) {
      const rx = this.offX[i]!;
      const ry = this.offY[i]!;
      const ux = this.dirX[i]!;
      const uy = this.dirY[i]!;
      const along = body.pointVelocityX(ry) * ux + body.pointVelocityY(rx) * uy;
      const load = this.normalLoads[i]!;
      const force = modules[i]!.driveForceFor(along, load, neutral);
      body.applyImpulse(rx, ry, force * ux * dt, force * uy * dt);
      const total = mu * load * dt;
      const used = Math.abs(force) * dt;
      // Friction circle: side grip is whatever traction the drive force left over.
      this.sideBudget[i] = Math.sqrt(Math.max(total * total - used * used, 0));
      this.sideImpulse[i] = 0;
    }

    // 2. Wheel side friction: sequential impulses that cancel sideways sliding at each
    //    contact patch, each limited by its remaining traction.
    for (let iteration = 0; iteration < FRICTION_ITERATIONS; iteration++) {
      for (let i = 0; i < n; i++) {
        const rx = this.offX[i]!;
        const ry = this.offY[i]!;
        const nx = -this.dirY[i]!;
        const ny = this.dirX[i]!;
        const side = body.pointVelocityX(ry) * nx + body.pointVelocityY(rx) * ny;
        const delta = -side * body.effectiveMass(rx, ry, nx, ny);
        const budget = this.sideBudget[i]!;
        const total = Math.min(Math.max(this.sideImpulse[i]! + delta, -budget), budget);
        const applied = total - this.sideImpulse[i]!;
        this.sideImpulse[i] = total;
        body.applyImpulse(rx, ry, applied * nx, applied * ny);
      }
    }

    // 3. Gravity on ramps (BUMPS): each wheel feels its share of weight along the slope.
    for (let i = 0; i < n; i++) {
      this.world.sampleTerrain(body.x + this.offX[i]!, body.y + this.offY[i]!, this.terrain);
      this.heights[i] = this.terrain.height;
      if (this.terrain.gradX !== 0 || this.terrain.gradY !== 0) {
        const load = this.normalLoads[i]!;
        body.applyImpulse(
          this.offX[i]!,
          this.offY[i]!,
          -load * this.terrain.gradX * dt,
          -load * this.terrain.gradY * dt,
        );
      }
    }

    // 4. Integrate and resolve collisions with the field.
    body.integrate(dt);
    this.contacts = this.world.resolve(body, this.footprint);

    // 5. Measurements: wheel speeds, acceleration. Then advance the steering axes.
    for (let i = 0; i < n; i++) {
      const along =
        body.pointVelocityX(this.offY[i]!) * this.dirX[i]! +
        body.pointVelocityY(this.offX[i]!) * this.dirY[i]!;
      modules[i]!.updateWheel(along, dt);
      modules[i]!.updateSteer(dt);
    }
    const k = ACCEL_SMOOTHING;
    this.accel.x += k * ((body.vx - vx0) / dt - this.accel.x);
    this.accel.y += k * ((body.vy - vy0) / dt - this.accel.y);
    this.accel.angular += k * ((body.omega - w0) / dt - this.accel.angular);

    this.updateRenderState();
  }

  /** Robot-relative velocity of the frame centre (m/s, rad/s). */
  robotRelativeVelocity(out: ChassisSpeeds): ChassisSpeeds {
    const b = this.body;
    const c = Math.cos(b.angle);
    const s = Math.sin(b.angle);
    out.vx = c * b.vx + s * b.vy;
    out.vy = -s * b.vx + c * b.vy;
    out.omega = b.omega;
    return out;
  }

  private updateRenderState(): void {
    const b = this.body;
    const com = this.config.chassis.centerOfMass;
    const c = Math.cos(b.angle);
    const s = Math.sin(b.angle);
    const r = this.current;
    r.x = b.x - (c * com.x - s * com.y);
    r.y = b.y - (s * com.x + c * com.y);
    r.heading = b.angle;
    const modules = this.drive.modules;
    for (let i = 0; i < modules.length; i++) {
      r.steer[i] = modules[i]!.steerAngle;
      r.wheel[i] = modules[i]!.wheelRotation;
    }
    this.updateTerrainPose(r);
  }

  /** Fits chassis height, pitch and roll to the terrain under the four wheels. */
  private updateTerrainPose(r: RobotRenderState): void {
    const modules = this.drive.modules;
    let sum = 0;
    let front = 0;
    let back = 0;
    let left = 0;
    let right = 0;
    let lengthSpan = 0;
    let widthSpan = 0;
    for (let i = 0; i < modules.length; i++) {
      const p = modules[i]!.config.position;
      const wx = r.x + Math.cos(r.heading) * p.x - Math.sin(r.heading) * p.y;
      const wy = r.y + Math.sin(r.heading) * p.x + Math.cos(r.heading) * p.y;
      const h = this.world.sampleTerrain(wx, wy, this.terrain).height;
      sum += h;
      if (p.x > 0) front += h;
      else back += h;
      if (p.y > 0) left += h;
      else right += h;
      lengthSpan = Math.max(lengthSpan, Math.abs(p.x) * 2);
      widthSpan = Math.max(widthSpan, Math.abs(p.y) * 2);
    }
    r.z = sum / modules.length;
    this.terrainHeight = r.z;
    // Pitch is positive nose-down about +Y; roll positive left-side-up about +X.
    r.pitch = lengthSpan > 0 ? Math.atan2((back - front) / 2, lengthSpan) : 0;
    r.roll = widthSpan > 0 ? Math.atan2((left - right) / 2, widthSpan) : 0;
  }
}

/**
 * Static weight on each wheel for a rigid rectangle of supports: equal shares, shifted
 * linearly toward the side the centre of mass is offset to. Clamped at zero.
 */
function staticLoads(config: RobotConfig): Float64Array {
  const weight = config.chassis.massKg * GRAVITY;
  const n = config.modules.length;
  const com = config.chassis.centerOfMass;
  let ax = 0;
  let ay = 0;
  for (const m of config.modules) {
    ax = Math.max(ax, Math.abs(m.position.x));
    ay = Math.max(ay, Math.abs(m.position.y));
  }
  const loads = new Float64Array(n);
  let total = 0;
  config.modules.forEach((m, i) => {
    const fx = ax > 0 ? (com.x * Math.sign(m.position.x)) / ax : 0;
    const fy = ay > 0 ? (com.y * Math.sign(m.position.y)) / ay : 0;
    loads[i] = Math.max(0, (weight / n) * (1 + fx + fy));
    total += loads[i]!;
  });
  // Renormalise so the loads always sum to the robot's weight.
  for (let i = 0; i < n; i++) loads[i] = (loads[i]! * weight) / total;
  return loads;
}
