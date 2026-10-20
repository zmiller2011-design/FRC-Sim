import { DirectionalLight, HemisphereLight, type Object3D } from 'three';
import type { Disposable } from '@/core';

export interface LightingOptions {
  /** Half-size in meters of the square area the sun's shadow camera covers. */
  shadowExtentM: number;
}

/**
 * Two lights total: a hemisphere fill (no shadows, very cheap) and one directional "sun"
 * that is the only shadow caster. Keeping one caster bounds the shadow cost to one extra pass.
 */
export class Lighting implements Disposable {
  private readonly hemisphere = new HemisphereLight(0xdfe7f5, 0x262a33, 1.6);
  private readonly sun = new DirectionalLight(0xffffff, 2.0);

  constructor(parent: Object3D, options: LightingOptions) {
    this.sun.position.set(-8, 16, 10);
    this.sun.target.position.set(0, 0, 0);

    const extent = options.shadowExtentM;
    const cam = this.sun.shadow.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.near = 1;
    cam.far = 50;
    cam.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;

    parent.add(this.hemisphere, this.sun, this.sun.target);
  }

  get castsShadows(): boolean {
    return this.sun.castShadow;
  }

  setShadows(enabled: boolean, mapSize: number): void {
    this.sun.castShadow = enabled;
    if (this.sun.shadow.mapSize.x !== mapSize) {
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      // The shadow render target is reallocated lazily at the new size.
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  dispose(): void {
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.sun.dispose();
    this.hemisphere.dispose();
    this.hemisphere.removeFromParent();
    this.sun.removeFromParent();
    this.sun.target.removeFromParent();
  }
}
