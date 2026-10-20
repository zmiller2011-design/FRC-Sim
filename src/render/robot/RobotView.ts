import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from 'three';
import { type Disposable, lerp, lerpAngle } from '@/core';
import type { RobotRenderState } from '@/robot/Robot';
import { ALLIANCE_COLORS } from '../field/FieldMaterials';
import { FIELD_TO_WORLD } from '../field/fieldSpace';

export interface RobotViewOptions {
  alliance: 'blue' | 'red';
  frameLength: number;
  frameWidth: number;
  bumperThickness: number;
  wheelRadius: number;
  modulePositions: readonly { x: number; y: number }[];
}

const IN = 0.0254;
const BUMPER_BOTTOM = 1 * IN;
const BUMPER_HEIGHT = 5 * IN;
const RAIL = 1 * IN;
const RAIL_HEIGHT = 2 * IN;
const FRAME_Z = 1.75 * IN;
const WHEEL_WIDTH = 1.5 * IN;

/**
 * Visual swerve robot. Everything is built once from shared geometries and materials and
 * placed in field coordinates (Z up) under a single field→world transform. `sync` only
 * writes interpolated transforms: chassis pose, each module's steering and wheel rotation.
 */
export class RobotView implements Disposable {
  readonly root = new Group();
  private readonly chassis = new Group();
  private readonly steerGroups: Group[] = [];
  private readonly wheelGroups: Group[] = [];

  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly wheelGeometry: CylinderGeometry;
  private readonly hubGeometry: CylinderGeometry;
  private readonly motorGeometry = new CylinderGeometry(0.5, 0.5, 1, 18);
  private readonly arrowGeometry = new ConeGeometry(0.5, 1, 3);
  private readonly materials: MeshStandardMaterial[];

  constructor(parent: Object3D, options: RobotViewOptions) {
    const o = options;
    const bumperMat = new MeshStandardMaterial({
      color: ALLIANCE_COLORS[o.alliance],
      roughness: 0.85,
    });
    const aluminum = new MeshStandardMaterial({ color: 0xc4c9d1, metalness: 0.8, roughness: 0.35 });
    const dark = new MeshStandardMaterial({ color: 0x24272c, metalness: 0.3, roughness: 0.6 });
    const rubber = new MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
    const accent = new MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.5 });
    const pan = new MeshStandardMaterial({ color: 0x5a6068, metalness: 0.4, roughness: 0.5 });
    const battery = new MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.4 });
    this.materials = [bumperMat, aluminum, dark, rubber, accent, pan, battery];

    this.wheelGeometry = new CylinderGeometry(o.wheelRadius, o.wheelRadius, WHEEL_WIDTH, 28);
    this.hubGeometry = new CylinderGeometry(
      o.wheelRadius * 0.55,
      o.wheelRadius * 0.55,
      WHEEL_WIDTH + 0.004,
      16,
    );

    // Everything below is authored in field coordinates (X forward, Y left, Z up).
    this.root.matrixAutoUpdate = false;
    this.root.matrix.copy(FIELD_TO_WORLD);
    this.root.name = 'robot';
    this.root.add(this.chassis);
    this.chassis.rotation.order = 'ZYX';

    const L = o.frameLength;
    const W = o.frameWidth;
    const b = o.bumperThickness;
    const add = (
      mat: MeshStandardMaterial,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
    ) => {
      const mesh = new Mesh(this.box, mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.chassis.add(mesh);
      return mesh;
    };

    // Bumpers around the frame perimeter.
    const bz = BUMPER_BOTTOM + BUMPER_HEIGHT / 2;
    add(bumperMat, L / 2 + b / 2, 0, bz, b, W + 2 * b, BUMPER_HEIGHT);
    add(bumperMat, -L / 2 - b / 2, 0, bz, b, W + 2 * b, BUMPER_HEIGHT);
    add(bumperMat, 0, W / 2 + b / 2, bz, L, b, BUMPER_HEIGHT);
    add(bumperMat, 0, -W / 2 - b / 2, bz, L, b, BUMPER_HEIGHT);

    // Frame rails, cross members and belly pan.
    const rz = FRAME_Z + RAIL_HEIGHT / 2;
    add(aluminum, L / 2 - RAIL / 2, 0, rz, RAIL, W, RAIL_HEIGHT);
    add(aluminum, -L / 2 + RAIL / 2, 0, rz, RAIL, W, RAIL_HEIGHT);
    add(aluminum, 0, W / 2 - RAIL / 2, rz, L, RAIL, RAIL_HEIGHT);
    add(aluminum, 0, -W / 2 + RAIL / 2, rz, L, RAIL, RAIL_HEIGHT);
    add(aluminum, 0, 0, rz, RAIL, W, RAIL_HEIGHT);
    add(pan, 0, 0, FRAME_Z + 0.002, L - 2 * RAIL, W - 2 * RAIL, 0.004);

    // Battery and electronics on the belly pan, and a heading arrow on top.
    add(battery, -L * 0.18, 0, FRAME_Z + 0.004 + 0.085, 0.18, 0.08, 0.17);
    add(dark, L * 0.12, W * 0.18, FRAME_Z + 0.004 + 0.02, 0.18, 0.14, 0.04);
    add(dark, L * 0.12, -W * 0.2, FRAME_Z + 0.004 + 0.015, 0.2, 0.1, 0.03);
    const arrow = new Mesh(this.arrowGeometry, accent);
    arrow.scale.set(0.12, 0.2, 0.02);
    arrow.rotation.set(0, 0, -Math.PI / 2);
    arrow.position.set(L * 0.32, 0, FRAME_Z + RAIL_HEIGHT + 0.012);
    this.chassis.add(arrow);

    // Swerve modules: a fixed housing with the steering motor, a steering group with the
    // fork, and a wheel group that spins about the axle (module-local +Y).
    for (const p of o.modulePositions) {
      const module = new Group();
      module.position.set(p.x, p.y, o.wheelRadius);
      this.chassis.add(module);

      const housing = new Mesh(this.box, dark);
      housing.scale.set(0.11, 0.11, 0.012);
      housing.position.z = FRAME_Z + RAIL_HEIGHT - o.wheelRadius + 0.006;
      module.add(housing);
      const motor = new Mesh(this.motorGeometry, aluminum);
      motor.scale.set(0.06, 0.08, 0.06);
      motor.rotation.x = Math.PI / 2;
      motor.position.set(0.025, 0.025, housing.position.z + 0.046);
      module.add(motor);

      const steer = new Group();
      module.add(steer);
      this.steerGroups.push(steer);
      for (const side of [-1, 1]) {
        const fork = new Mesh(this.box, aluminum);
        fork.scale.set(0.07, 0.004, o.wheelRadius + 0.03);
        fork.position.set(0, side * (WHEEL_WIDTH / 2 + 0.006), 0.012);
        fork.castShadow = true;
        steer.add(fork);
      }

      const wheel = new Group();
      steer.add(wheel);
      this.wheelGroups.push(wheel);
      // Cylinders are built along +Y, which is already the axle direction.
      const tread = new Mesh(this.wheelGeometry, rubber);
      const hub = new Mesh(this.hubGeometry, aluminum);
      tread.castShadow = true;
      wheel.add(tread, hub);
      // A bright marker on the rim makes the wheel's rotation visible.
      const marker = new Mesh(this.box, accent);
      marker.scale.set(0.012, WHEEL_WIDTH + 0.006, 0.02);
      marker.position.z = o.wheelRadius * 0.78;
      wheel.add(marker);
    }

    parent.add(this.root);
  }

  /** Writes the state interpolated between the last two physics steps. Allocation-free. */
  sync(previous: RobotRenderState, current: RobotRenderState, alpha: number): void {
    this.chassis.position.set(
      lerp(previous.x, current.x, alpha),
      lerp(previous.y, current.y, alpha),
      lerp(previous.z, current.z, alpha),
    );
    this.chassis.rotation.set(
      lerp(previous.roll, current.roll, alpha),
      lerp(previous.pitch, current.pitch, alpha),
      lerpAngle(previous.heading, current.heading, alpha),
    );
    for (let i = 0; i < this.steerGroups.length; i++) {
      // Steering and wheel angles are continuous (unwrapped), so plain lerp is correct.
      this.steerGroups[i]!.rotation.z = lerp(previous.steer[i]!, current.steer[i]!, alpha);
      this.wheelGroups[i]!.rotation.y = lerp(previous.wheel[i]!, current.wheel[i]!, alpha);
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.box.dispose();
    this.wheelGeometry.dispose();
    this.hubGeometry.dispose();
    this.motorGeometry.dispose();
    this.arrowGeometry.dispose();
    for (const m of this.materials) m.dispose();
  }
}
