import type { Object3D } from 'three';
import { type Disposable, wrapAngle } from '@/core';
import { buildPlanarWorldOptions } from '@/field/planarCollision';
import type { FieldConfig } from '@/field/types';
import { rebuiltAnchors } from '@/game/seasons/rebuilt2026';
import { DriverInput, makeDriverAxes } from '@/input';
import { PlanarWorld } from '@/physics/planar';
import { RobotView } from '@/render';
import {
  DEFAULT_ROBOT,
  HumanDriveController,
  makeDriveCommand,
  Robot,
  type RobotConfig,
} from '@/robot';
import type { DrivingSettings, FieldVariant } from '@/settings';
import type { RobotTelemetry } from '@/state';
import type { SystemScheduler } from './SystemScheduler';

const DEG = 180 / Math.PI;
/** Spawn in the blue ALLIANCE ZONE, 1.2 m behind the starting line, right of the TOWER. */
const SPAWN_BEHIND_LINE_M = 1.2;
const SPAWN_RIGHT_OF_CENTRE_M = 1.6;

/**
 * Wires one human-driven robot into the engine:
 * input (sampled each control tick) → controller → drivetrain → planar physics → view.
 * The view only reads interpolated simulation snapshots; input never moves anything directly.
 */
export class RobotRuntime implements Disposable {
  readonly robot: Robot;
  private readonly view: RobotView;
  private readonly input: DriverInput;
  private readonly controller: HumanDriveController;
  private readonly axes = makeDriverAxes();
  private readonly command = makeDriveCommand();
  private readonly removers: (() => void)[] = [];
  private readonly telemetry: RobotTelemetry;
  private readonly measured = { vx: 0, vy: 0, omega: 0 };
  private spawn = { x: 0, y: 0, heading: 0 };

  constructor(
    parent: Object3D,
    scheduler: SystemScheduler,
    field: FieldConfig,
    driving: DrivingSettings,
    readonly config: RobotConfig = DEFAULT_ROBOT,
  ) {
    this.robot = new Robot(config, this.createWorld(field));
    this.robot.neutralMode = driving.neutralMode;
    this.controller = new HumanDriveController(
      { fieldRelative: driving.fieldRelative, alliance: 'blue', precisionScale: 0.35 },
      config.limits,
    );
    this.input = new DriverInput();
    const c = config.chassis;
    this.view = new RobotView(parent, {
      alliance: 'blue',
      frameLength: c.frameLengthM,
      frameWidth: c.frameWidthM,
      bumperThickness: c.bumperThicknessM,
      wheelRadius: config.moduleHardware.wheelRadiusM,
      modulePositions: config.modules.map((m) => m.position),
    });
    this.setSpawn(field);
    this.reset();

    this.removers.push(
      scheduler.addFixed('input', {
        name: 'driverInput',
        fixedUpdate: () => this.input.sample(this.axes),
      }),
      scheduler.addFixed('logic', {
        name: 'driveControl',
        fixedUpdate: (dt) => {
          this.controller.update(this.axes, this.command);
          this.robot.control(this.command, dt);
        },
      }),
      scheduler.addFixed('physics', {
        name: 'robotPhysics',
        fixedUpdate: (dt) => this.robot.step(dt),
      }),
      scheduler.addRender({
        name: 'robotView',
        sync: (alpha) => this.view.sync(this.robot.previous, this.robot.current, alpha),
      }),
    );
    this.telemetry = this.createTelemetry();
  }

  /** Puts the robot back at its starting position, at rest. */
  reset(): void {
    this.robot.reset(this.spawn.x, this.spawn.y, this.spawn.heading);
  }

  /** New field (variant change): rebuild collision geometry and respawn. */
  setField(field: FieldConfig): void {
    this.robot.setWorld(this.createWorld(field));
    this.setSpawn(field);
    this.reset();
  }

  applyDriving(driving: DrivingSettings): void {
    this.controller.options.fieldRelative = driving.fieldRelative;
    this.robot.neutralMode = driving.neutralMode;
  }

  /** Fills the reusable telemetry object (call at the telemetry rate, not per step). */
  fillTelemetry(physicsHz: number, controlHz: number): Readonly<RobotTelemetry> {
    const r = this.robot;
    const b = r.body;
    const t = this.telemetry;
    const rel = r.robotRelativeVelocity(this.measured);
    t.x = r.current.x;
    t.y = r.current.y;
    t.headingDeg = wrapAngle(b.angle) * DEG;
    t.vx = b.vx;
    t.vy = b.vy;
    t.vxRobot = rel.vx;
    t.vyRobot = rel.vy;
    t.speed = Math.hypot(b.vx, b.vy);
    t.omegaDegPs = b.omega * DEG;
    t.ax = r.accel.x;
    t.ay = r.accel.y;
    t.accel = Math.hypot(r.accel.x, r.accel.y);
    t.alphaDegPs2 = r.accel.angular * DEG;
    r.drive.modules.forEach((m, i) => {
      const out = t.modules[i]!;
      out.angleDeg = wrapAngle(m.steerAngle) * DEG;
      out.targetAngleDeg = wrapAngle(m.targetAngle) * DEG;
      out.speed = m.wheelSpeed;
      out.targetSpeed = m.targetSpeed;
      out.currentA = m.driveCurrent;
      out.slipping = m.slipping;
    });
    t.command.vx = r.command.vx;
    t.command.vy = r.command.vy;
    t.command.omega = r.command.omega;
    t.command.fieldRelative = r.command.fieldRelative;
    t.command.xLock = r.command.xLock;
    t.neutral = r.drive.neutral;
    t.neutralMode = r.neutralMode;
    t.contacts = r.contacts;
    t.terrainHeight = r.terrainHeight;
    t.physicsHz = physicsHz;
    t.controlHz = controlHz;
    t.dtMs = 1000 / physicsHz;
    t.gamepad = this.input.gamepad.connected;
    return t;
  }

  dispose(): void {
    for (const remove of this.removers) remove();
    this.input.dispose();
    this.view.dispose();
  }

  private createWorld(field: FieldConfig): PlanarWorld {
    return new PlanarWorld(buildPlanarWorldOptions(field, this.config.chassis));
  }

  private setSpawn(field: FieldConfig): void {
    const anchors = rebuiltAnchors(field.variant.id as FieldVariant);
    this.spawn = {
      x: anchors.startingLineX - SPAWN_BEHIND_LINE_M,
      y: field.widthM / 2 - SPAWN_RIGHT_OF_CENTRE_M,
      heading: 0,
    };
  }

  private createTelemetry(): RobotTelemetry {
    return {
      x: 0,
      y: 0,
      headingDeg: 0,
      vx: 0,
      vy: 0,
      vxRobot: 0,
      vyRobot: 0,
      speed: 0,
      omegaDegPs: 0,
      ax: 0,
      ay: 0,
      accel: 0,
      alphaDegPs2: 0,
      modules: this.config.modules.map((m) => ({
        name: m.name,
        angleDeg: 0,
        targetAngleDeg: 0,
        speed: 0,
        targetSpeed: 0,
        currentA: 0,
        slipping: false,
      })),
      command: { vx: 0, vy: 0, omega: 0, fieldRelative: true, xLock: false },
      neutral: true,
      neutralMode: 'brake',
      contacts: 0,
      terrainHeight: 0,
      physicsHz: 120,
      controlHz: 60,
      dtMs: 1000 / 120,
      gamepad: null,
    };
  }
}
