import { DirectionalLight, HemisphereLight, type Object3D } from 'three';
import type { Disposable } from '@/core';

export interface LightingOptions {
  /** World-space centre of the lit area (the field centre). */
  center: { x: number; z: number };
  /** Half-size in metres of the square the key light's shadow camera covers. */
  shadowExtentM: number;
}

/**
 * Arena lighting: a hemisphere fill (cheap, no shadows), one high key light that is the only
 * shadow caster, and a weak opposing fill so vertical faces facing away from the key are not
 * black. One caster bounds the shadow cost to a single extra pass.
 */
export class Lighting implements Disposable {
  private readonly hemisphere = new HemisphereLight(0xe4ebf5, 0x30302c, 1.15);
  private readonly key = new DirectionalLight(0xfff7ec, 2.1);
  private readonly fill = new DirectionalLight(0xdbe6ff, 0.55);

  constructor(parent: Object3D, options: LightingOptions) {
    const { center, shadowExtentM: extent } = options;
    this.key.position.set(center.x - 5, 18, center.z + 7);
    this.key.target.position.set(center.x, 0, center.z);
    this.fill.position.set(center.x + 8, 10, center.z - 9);
    this.fill.target.position.set(center.x, 0, center.z);

    const cam = this.key.shadow.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.near = 2;
    cam.far = 45;
    cam.updateProjectionMatrix();
    this.key.shadow.bias = -0.0003;
    this.key.shadow.normalBias = 0.025;

    parent.add(this.hemisphere, this.key, this.key.target, this.fill, this.fill.target);
  }

  get castsShadows(): boolean {
    return this.key.castShadow;
  }

  setShadows(enabled: boolean, mapSize: number): void {
    this.key.castShadow = enabled;
    if (this.key.shadow.mapSize.x !== mapSize) {
      this.key.shadow.mapSize.set(mapSize, mapSize);
      // The shadow render target is reallocated lazily at the new size.
      this.key.shadow.map?.dispose();
      this.key.shadow.map = null;
    }
  }

  dispose(): void {
    this.key.shadow.map?.dispose();
    this.key.shadow.map = null;
    for (const light of [this.key, this.fill, this.hemisphere]) {
      light.dispose();
      light.removeFromParent();
    }
    this.key.target.removeFromParent();
    this.fill.target.removeFromParent();
  }
}
