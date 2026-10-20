import type { BufferGeometry } from 'three';
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
} from 'three';
import { type Disposable, fieldToWorld, vec3 } from '@/core';
import type { GraphicsSettings } from '@/settings';

/**
 * Placeholder field footprint until the REBUILT season pack (stage 8) supplies
 * dimensions from the game manual and field drawings.
 */
export const PLACEHOLDER_FIELD = { lengthM: 16.54, widthM: 8.07 } as const;

const WALL_HEIGHT_M = 0.5;
const WALL_THICKNESS_M = 0.05;

/**
 * Scene, lighting and placeholder environment. Every geometry and material is created
 * once here and released in `dispose`.
 */
export class SceneGraph implements Disposable {
  readonly scene = new Scene();
  /** Field-space content. Children are positioned with world coordinates from `fieldToWorld`. */
  readonly field = new Group();

  private readonly sun: DirectionalLight;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshStandardMaterial[] = [];

  constructor(graphics: GraphicsSettings) {
    this.scene.background = new Color(0x0d1117);
    this.scene.fog = new Fog(0x0d1117, 30, 80);
    this.scene.add(this.field);

    const center = fieldToWorld(
      PLACEHOLDER_FIELD.lengthM / 2,
      PLACEHOLDER_FIELD.widthM / 2,
      0,
      vec3(),
    );

    this.scene.add(new HemisphereLight(0xdde8ff, 0x2a2f3a, 1.4));

    this.sun = new DirectionalLight(0xffffff, 2.2);
    this.sun.position.set(center.x - 6, 18, center.z + 8);
    this.sun.target.position.set(center.x, 0, center.z);
    const halfDiagonal = Math.hypot(PLACEHOLDER_FIELD.lengthM, PLACEHOLDER_FIELD.widthM) / 2 + 1;
    const shadowCam = this.sun.shadow.camera;
    shadowCam.left = -halfDiagonal;
    shadowCam.right = halfDiagonal;
    shadowCam.top = halfDiagonal;
    shadowCam.bottom = -halfDiagonal;
    shadowCam.near = 1;
    shadowCam.far = 50;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);

    this.buildPlaceholderField(center.x, center.z);
    this.applyGraphics(graphics);
  }

  applyGraphics(graphics: GraphicsSettings): void {
    if (this.sun.castShadow !== graphics.shadows) {
      this.sun.castShadow = graphics.shadows;
      // Shadow support is compiled into shaders, so toggling it requires a recompile.
      this.scene.traverse((object) => {
        if (object instanceof Mesh) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.needsUpdate = true;
        }
      });
    }
    const size = graphics.shadowMapSize;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  dispose(): void {
    this.sun.shadow.map?.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.scene.clear();
  }

  private buildPlaceholderField(centerX: number, centerZ: number): void {
    const { lengthM, widthM } = PLACEHOLDER_FIELD;

    const carpetGeo = this.track(new PlaneGeometry(lengthM, widthM));
    const carpetMat = this.trackMat(new MeshStandardMaterial({ color: 0x3b4250, roughness: 0.95 }));
    const carpet = new Mesh(carpetGeo, carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(centerX, 0, centerZ);
    carpet.receiveShadow = true;
    this.field.add(carpet);

    const surroundGeo = this.track(new PlaneGeometry(lengthM + 12, widthM + 12));
    const surroundMat = this.trackMat(new MeshStandardMaterial({ color: 0x1a1e26, roughness: 1 }));
    const surround = new Mesh(surroundGeo, surroundMat);
    surround.rotation.x = -Math.PI / 2;
    surround.position.set(centerX, -0.002, centerZ);
    surround.receiveShadow = true;
    this.field.add(surround);

    // Center line and alliance wall color strips.
    const lineGeo = this.track(new PlaneGeometry(0.05, widthM));
    const whiteMat = this.trackMat(new MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.8 }));
    const centerLine = new Mesh(lineGeo, whiteMat);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.set(centerX, 0.001, centerZ);
    this.field.add(centerLine);

    const sideWallGeo = this.track(new BoxGeometry(lengthM, WALL_HEIGHT_M, WALL_THICKNESS_M));
    const endWallGeo = this.track(new BoxGeometry(WALL_THICKNESS_M, WALL_HEIGHT_M, widthM));
    const railMat = this.trackMat(
      new MeshStandardMaterial({ color: 0x9aa3b2, metalness: 0.6, roughness: 0.4 }),
    );
    const blueMat = this.trackMat(new MeshStandardMaterial({ color: 0x1f5fd6, roughness: 0.6 }));
    const redMat = this.trackMat(new MeshStandardMaterial({ color: 0xd62f2f, roughness: 0.6 }));

    const y = WALL_HEIGHT_M / 2;
    const walls: [BufferGeometry, MeshStandardMaterial, number, number][] = [
      [sideWallGeo, railMat, centerX, centerZ - widthM / 2],
      [sideWallGeo, railMat, centerX, centerZ + widthM / 2],
      [endWallGeo, blueMat, centerX - lengthM / 2, centerZ],
      [endWallGeo, redMat, centerX + lengthM / 2, centerZ],
    ];
    for (const [geo, mat, x, z] of walls) {
      const wall = new Mesh(geo, mat);
      wall.position.set(x, y, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.field.add(wall);
    }
  }

  private track<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private trackMat(material: MeshStandardMaterial): MeshStandardMaterial {
    this.materials.push(material);
    return material;
  }
}
