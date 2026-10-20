import {
  BufferGeometry,
  Float32BufferAttribute,
  GridHelper,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
} from 'three';
import { DisposalScope, type Disposable, fieldToWorld, vec3 } from '@/core';

export interface TestFloorOptions {
  /** Side length of the square floor in meters. */
  sizeM: number;
}

const AXIS_LENGTH_M = 1.5;

/**
 * Neutral measuring floor for the rendering foundation: a matte ground plane, a 1 m grid,
 * a brighter 5 m grid and field-frame axes at the origin (red = field +X, green = field +Y).
 * Not a competition field. That arrives with the season pack.
 *
 * Built once: 4 draw calls in total, every geometry and material released in `dispose`.
 */
export class TestFloor implements Disposable {
  private readonly scope = new DisposalScope();

  constructor(parent: Object3D, options: TestFloorOptions) {
    const size = options.sizeM;

    const ground = new Mesh(
      this.scope.add(new PlaneGeometry(size, size)),
      this.scope.add(new MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.95, metalness: 0 })),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;

    const minor = this.grid(size, size, 0x3d4450, 0.6);
    minor.position.y = 0.002;
    const major = this.grid(size, size / 5, 0x5a6472, 0.9);
    major.position.y = 0.003;

    const axes = this.fieldAxes();
    axes.position.y = 0.004;

    parent.add(ground, minor, major, axes);
    this.scope.defer(() => {
      ground.removeFromParent();
      minor.removeFromParent();
      major.removeFromParent();
      axes.removeFromParent();
    });
  }

  dispose(): void {
    this.scope.dispose();
  }

  private grid(size: number, divisions: number, color: number, opacity: number): GridHelper {
    const grid = new GridHelper(size, divisions, color, color);
    const material = grid.material as LineBasicMaterial;
    material.transparent = opacity < 1;
    material.opacity = opacity;
    material.depthWrite = false;
    this.scope.add(grid);
    return grid;
  }

  /** Field +X and +Y drawn in world space through the same conversion the simulation uses. */
  private fieldAxes(): LineSegments {
    const x = fieldToWorld(AXIS_LENGTH_M, 0, 0, vec3());
    const y = fieldToWorld(0, AXIS_LENGTH_M, 0, vec3());
    const geometry = this.scope.add(new BufferGeometry());
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, x.x, x.y, x.z, 0, 0, 0, y.x, y.y, y.z], 3),
    );
    geometry.setAttribute(
      'color',
      new Float32BufferAttribute(
        [0.9, 0.25, 0.25, 0.9, 0.25, 0.25, 0.3, 0.8, 0.4, 0.3, 0.8, 0.4],
        3,
      ),
    );
    const material = this.scope.add(new LineBasicMaterial({ vertexColors: true }));
    return new LineSegments(geometry, material);
  }
}
