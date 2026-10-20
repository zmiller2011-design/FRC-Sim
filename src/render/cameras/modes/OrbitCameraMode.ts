import { type PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Vec3 } from '@/core';
import type { CameraContext, CameraMode, FieldBounds } from '../CameraMode';

const BOUNDS_MARGIN = 3;
const MIN_HEIGHT = 0.25;

/**
 * Free perspective camera orbiting a target. Drag to rotate, right-drag to pan, scroll to zoom.
 * The target is kept over the field (plus a margin) and the camera above the carpet, so the
 * view can't be lost under the floor or far off the field.
 */
export class OrbitCameraMode implements CameraMode {
  readonly id = 'orbit';
  private controls: OrbitControls | null = null;
  private camera: PerspectiveCamera | null = null;
  private readonly defaultTarget: Vector3;
  private readonly defaultOffset: Vector3;
  private readonly target: Vector3;
  /** Camera position while this mode was last active; other modes move the shared camera. */
  private readonly position = new Vector3();
  private hasPose = false;

  /** Target and offset are in world coordinates. */
  constructor(
    target: Vec3,
    initialOffset: Vec3,
    private readonly bounds: FieldBounds | null = null,
  ) {
    this.defaultTarget = new Vector3(target.x, target.y, target.z);
    this.defaultOffset = new Vector3(initialOffset.x, initialOffset.y, initialOffset.z);
    this.target = this.defaultTarget.clone();
  }

  activate(ctx: CameraContext): void {
    this.deactivate();
    this.camera = ctx.camera;
    ctx.camera.up.set(0, 1, 0);
    if (!this.hasPose) {
      this.position.copy(this.target).add(this.defaultOffset);
      this.hasPose = true;
    }
    ctx.camera.position.copy(this.position);
    const controls = new OrbitControls(ctx.camera, ctx.domElement);
    controls.target.copy(this.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 1.5;
    controls.maxDistance = 32;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.screenSpacePanning = false;
    controls.update();
    this.controls = controls;
  }

  update(): void {
    const controls = this.controls;
    if (!controls) return;
    if (this.bounds) {
      const t = controls.target;
      t.x = Math.min(
        Math.max(t.x, this.bounds.minX - BOUNDS_MARGIN),
        this.bounds.maxX + BOUNDS_MARGIN,
      );
      t.z = Math.min(
        Math.max(t.z, this.bounds.minZ - BOUNDS_MARGIN),
        this.bounds.maxZ + BOUNDS_MARGIN,
      );
      t.y = Math.min(Math.max(t.y, 0), 3);
    }
    controls.update();
    if (this.camera && this.camera.position.y < MIN_HEIGHT) this.camera.position.y = MIN_HEIGHT;
  }

  reset(): void {
    this.target.copy(this.defaultTarget);
    if (!this.camera) {
      this.hasPose = false;
      return;
    }
    this.camera.position.copy(this.defaultTarget).add(this.defaultOffset);
    if (this.controls) {
      this.controls.target.copy(this.defaultTarget);
      this.controls.update();
    }
  }

  deactivate(): void {
    if (!this.controls) return;
    this.target.copy(this.controls.target);
    if (this.camera) this.position.copy(this.camera.position);
    this.controls.dispose();
    this.controls = null;
  }

  dispose(): void {
    this.deactivate();
    this.camera = null;
  }
}
