import { PerspectiveCamera } from 'three';
import type { Disposable } from '@/core';
import type { CameraContext, CameraMode, CameraModeId } from './CameraMode';

/** Owns the single render camera and switches between camera modes. */
export class CameraManager implements Disposable {
  readonly camera = new PerspectiveCamera(55, 1, 0.05, 200);
  private readonly modes = new Map<CameraModeId, CameraMode>();
  private active: CameraMode | null = null;
  private domElement: HTMLElement | null = null;

  register(mode: CameraMode): void {
    this.modes.get(mode.id)?.dispose();
    this.modes.set(mode.id, mode);
  }

  get activeId(): CameraModeId | null {
    return this.active?.id ?? null;
  }

  /** Binds pointer input to an element. Call again when the canvas changes. */
  attach(domElement: HTMLElement): void {
    this.domElement = domElement;
    if (this.active) this.active.activate(this.context(domElement));
  }

  detach(): void {
    this.active?.deactivate();
    this.domElement = null;
  }

  setMode(id: CameraModeId): void {
    const next = this.modes.get(id);
    if (!next || next === this.active) return;
    this.active?.deactivate();
    this.active = next;
    if (this.domElement) next.activate(this.context(this.domElement));
  }

  resetActive(): void {
    this.active?.reset();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(frameDt: number): void {
    this.active?.update(frameDt);
  }

  dispose(): void {
    for (const mode of this.modes.values()) mode.dispose();
    this.modes.clear();
    this.active = null;
    this.domElement = null;
  }

  private context(domElement: HTMLElement): CameraContext {
    return { camera: this.camera, domElement };
  }
}
