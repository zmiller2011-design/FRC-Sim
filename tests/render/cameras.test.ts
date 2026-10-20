import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { OrbitCameraMode } from '@/render/cameras/modes/OrbitCameraMode';
import { OverheadCameraMode } from '@/render/cameras/modes/OverheadCameraMode';

const L = 16.541;
const W = 8.069;
const bounds = { minX: 0, maxX: L, minZ: -W, maxZ: 0 };
const fakeElement = {
  addEventListener() {},
  removeEventListener() {},
  clientHeight: 800,
  style: {},
  ownerDocument: { addEventListener() {}, removeEventListener() {} },
  getRootNode: () => ({ addEventListener() {}, removeEventListener() {} }),
} as unknown as HTMLElement;

function ndc(camera: PerspectiveCamera, x: number, y: number, z: number): Vector3 {
  camera.updateMatrixWorld();
  return new Vector3(x, y, z).project(camera);
}

describe('OverheadCameraMode', () => {
  it.each([16 / 9, 4 / 3, 21 / 9, 1])(
    'fits the whole field and both walls at aspect %f',
    (aspect) => {
      const camera = new PerspectiveCamera(50, aspect, 0.1, 160);
      camera.updateProjectionMatrix();
      const mode = new OverheadCameraMode(bounds);
      mode.activate({ camera, domElement: fakeElement });
      // Field corners at carpet level plus the alliance walls' top edges, 1 m beyond the ends.
      const points: [number, number, number][] = [
        [0, 0, 0],
        [L, 0, 0],
        [0, 0, -W],
        [L, 0, -W],
        [-1, 2, -W / 2],
        [L + 1, 2, -W / 2],
      ];
      for (const [x, y, z] of points) {
        const p = ndc(camera, x, y, z);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
      }
      // Blue (x = 0) on the left, field +Y (world −Z) toward the top.
      expect(ndc(camera, 0, 0, -W / 2).x).toBeLessThan(0);
      expect(ndc(camera, L / 2, 0, -W).y).toBeGreaterThan(0);
      mode.deactivate();
      expect(camera.fov).toBe(50);
      expect(camera.up.toArray()).toEqual([0, 1, 0]);
    },
  );
});

describe('OrbitCameraMode', () => {
  it('restores its own pose after another mode moved the shared camera', () => {
    const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 160);
    const orbit = new OrbitCameraMode(
      { x: L / 2, y: 0, z: -W / 2 },
      { x: -9, y: 9.5, z: 11 },
      bounds,
    );
    orbit.activate({ camera, domElement: fakeElement });
    const start = camera.position.clone();
    orbit.deactivate();
    camera.position.set(100, 1, 100);
    orbit.activate({ camera, domElement: fakeElement });
    expect(camera.position.distanceTo(start)).toBeLessThan(1e-9);
    orbit.dispose();
  });

  it('keeps the camera above the carpet', () => {
    const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 160);
    const orbit = new OrbitCameraMode(
      { x: L / 2, y: 0, z: -W / 2 },
      { x: -9, y: 9.5, z: 11 },
      bounds,
    );
    orbit.activate({ camera, domElement: fakeElement });
    camera.position.y = -2;
    orbit.update();
    expect(camera.position.y).toBeGreaterThan(0);
    orbit.dispose();
  });
});
