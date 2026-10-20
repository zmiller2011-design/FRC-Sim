import { type PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Vec3 } from '@/core';
import type { CameraContext, CameraMode } from '../CameraMode';

/** Free camera that orbits a target point. Drag to rotate, right-drag to pan, wheel to zoom. */
export class OrbitCameraMode implements CameraMode {
  readonly id = 'orbit';
  private controls: OrbitControls | null = null;
  private camera: PerspectiveCamera | null = null;
  private readonly defaultTarget: Vector3;
  private readonly defaultOffset: Vector3;
  private readonly target: Vector3;
  private hasPose = false;

  /** Both vectors are in world coordinates. */
  constructor(target: Vec3, initialOffset: Vec3) {
    this.defaultTarget = new Vector3(target.x, target.y, target.z);
    this.defaultOffset = new Vector3(initialOffset.x, initialOffset.y, initialOffset.z);
    this.target = this.defaultTarget.clone();
  }

  activate(ctx: CameraContext): void {
    this.deactivate();
    this.camera = ctx.camera;
    if (!this.hasPose) {
      ctx.camera.position.copy(this.target).add(this.defaultOffset);
      this.hasPose = true;
    }
    const controls = new OrbitControls(ctx.camera, ctx.domElement);
    controls.target.copy(this.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 1.5;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.update();
    this.controls = controls;
  }

  update(): void {
    this.controls?.update();
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
    this.controls.dispose();
    this.controls = null;
  }

  dispose(): void {
    this.deactivate();
    this.camera = null;
  }
}
