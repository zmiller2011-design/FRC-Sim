import type { PerspectiveCamera } from 'three';
import type { CameraContext, CameraMode, FieldBounds } from '../CameraMode';

const FIT_MARGIN = 1.04;
/** Extra framing beyond the carpet so the alliance walls and stations are in view. */
const FRAME_BEYOND_X = 1.4;
const FRAME_BEYOND_Z = 0.5;
/** A narrow field of view from higher up keeps tall elements from leaning outward. */
const OVERHEAD_FOV = 20;
const MIN_HEIGHT = 6;
const MAX_HEIGHT = 80;

/**
 * Top-down view of the whole field with blue on the left and red on the right.
 * Drag to pan, scroll to zoom. Re-fits to the viewport on resize until the user zooms.
 */
export class OverheadCameraMode implements CameraMode {
  readonly id = 'overhead';
  private ctx: CameraContext | null = null;
  private centerX: number;
  private centerZ: number;
  private height = 20;
  private userZoomed = false;
  private lastAspect = 0;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private previousFov = 50;

  constructor(private readonly bounds: FieldBounds) {
    this.centerX = (bounds.minX + bounds.maxX) / 2;
    this.centerZ = (bounds.minZ + bounds.maxZ) / 2;
  }

  activate(ctx: CameraContext): void {
    this.deactivate();
    this.ctx = ctx;
    // Screen up = field +Y = world −Z, so the field's long axis runs left to right.
    ctx.camera.up.set(0, 0, -1);
    this.previousFov = ctx.camera.fov;
    ctx.camera.fov = OVERHEAD_FOV;
    ctx.camera.updateProjectionMatrix();
    const el = ctx.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    if (!this.userZoomed) this.fit(ctx.camera);
    this.apply();
  }

  update(): void {
    const camera = this.ctx?.camera;
    if (!camera) return;
    if (!this.userZoomed && camera.aspect !== this.lastAspect) {
      this.fit(camera);
      this.apply();
    }
  }

  reset(): void {
    this.centerX = (this.bounds.minX + this.bounds.maxX) / 2;
    this.centerZ = (this.bounds.minZ + this.bounds.maxZ) / 2;
    this.userZoomed = false;
    if (this.ctx) {
      this.fit(this.ctx.camera);
      this.apply();
    }
  }

  deactivate(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const el = ctx.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerUp);
    el.removeEventListener('wheel', this.onWheel);
    ctx.camera.up.set(0, 1, 0);
    ctx.camera.fov = this.previousFov;
    ctx.camera.updateProjectionMatrix();
    this.dragging = false;
    this.ctx = null;
  }

  dispose(): void {
    this.deactivate();
  }

  private fit(camera: PerspectiveCamera): void {
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    const halfLength = ((this.bounds.maxX - this.bounds.minX) / 2 + FRAME_BEYOND_X) * FIT_MARGIN;
    const halfWidth = ((this.bounds.maxZ - this.bounds.minZ) / 2 + FRAME_BEYOND_Z) * FIT_MARGIN;
    this.height = Math.max(halfWidth / tanHalf, halfLength / (tanHalf * camera.aspect));
    this.lastAspect = camera.aspect;
  }

  private apply(): void {
    const camera = this.ctx?.camera;
    if (!camera) return;
    camera.position.set(this.centerX, this.height, this.centerZ);
    camera.lookAt(this.centerX, 0, this.centerZ);
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const ctx = this.ctx;
    if (!this.dragging || !ctx) return;
    // Metres per pixel at ground level for the current height.
    const tanHalf = Math.tan((ctx.camera.fov * Math.PI) / 360);
    const perPixel = (2 * this.height * tanHalf) / ctx.domElement.clientHeight;
    this.centerX -= (e.clientX - this.lastPointer.x) * perPixel;
    this.centerZ -= (e.clientY - this.lastPointer.y) * perPixel;
    this.centerX = Math.min(Math.max(this.centerX, this.bounds.minX), this.bounds.maxX);
    this.centerZ = Math.min(Math.max(this.centerZ, this.bounds.minZ), this.bounds.maxZ);
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.apply();
  };

  private readonly onPointerUp = (): void => {
    this.dragging = false;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.userZoomed = true;
    this.height = Math.min(
      Math.max(this.height * Math.exp(e.deltaY * 0.001), MIN_HEIGHT),
      MAX_HEIGHT,
    );
    this.apply();
  };
}
