import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { StereoDepth } from "./stereo-depth";
import { normalizeXrSettings } from "./settings";

it("defaults old preferences to normal stereo and bounds invalid saved depth", () => {
  for (const depth of [undefined, NaN, Infinity]) expect(normalizeXrSettings({ depth }).depth).toBe(1);
  expect(normalizeXrSettings({ depth: -3 }).depth).toBe(.5);
  expect(normalizeXrSettings({ depth: 3 }).depth).toBe(1.5);
});

function setup() {
  const eyes = [new THREE.PerspectiveCamera(), new THREE.PerspectiveCamera()];
  const head = new THREE.Matrix4().compose(new THREE.Vector3(2, 1.6, -3),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, .7, .3)), new THREE.Vector3(1, 1, 1));
  eyes.forEach((eye, i) => eye.matrix.multiplyMatrices(head, new THREE.Matrix4().makeTranslation(i ? .032 : -.032, 0, 0)));
  const rig = new THREE.Matrix4().makeRotationX(.7).scale(new THREE.Vector3(4, 4, 4));
  const xr = { isPresenting: true, cameraAutoUpdate: true, getCamera: () => new THREE.ArrayCamera(eyes),
    updateCamera: vi.fn(() => eyes.forEach(eye => {
      eye.matrixWorld.multiplyMatrices(rig, eye.matrix);
      eye.matrixWorldInverse.copy(eye.matrixWorld).invert();
    })) };
  return { eyes, xr };
}

it.each([.5, 1, 1.5])("scales eye distance by %s without moving the midpoint or accumulating changes", depth => {
  const { eyes, xr } = setup();
  const original = eyes.map(eye => eye.matrix.clone());
  const center = new THREE.Vector3(2, 1.6, -3);
  const renderer = new StereoDepth();
  for (let frame = 0; frame < 3; frame++) {
    renderer.render(xr, new THREE.PerspectiveCamera(), depth, () => {
      const positions = eyes.map(eye => new THREE.Vector3().setFromMatrixPosition(eye.matrix));
      expect(positions[0].distanceTo(positions[1])).toBeCloseTo(.064 * depth);
      expect(positions[0].add(positions[1]).multiplyScalar(.5).distanceTo(center)).toBeLessThan(1e-12);
      if (depth !== 1) {
        expect(xr.cameraAutoUpdate).toBe(false);
        const world = eyes.map(eye => new THREE.Vector3().setFromMatrixPosition(eye.matrixWorld));
        expect(world[0].distanceTo(world[1])).toBeCloseTo(.064 * depth * 4);
      }
    });
    expect(eyes.map(eye => eye.matrix)).toEqual(original);
    expect(xr.cameraAutoUpdate).toBe(true);
  }
});

it("restores tracking even when rendering fails and leaves flat rendering untouched", () => {
  const { eyes, xr } = setup();
  const original = eyes.map(eye => eye.matrix.clone());
  const depth = new StereoDepth();
  expect(() => depth.render(xr, new THREE.PerspectiveCamera(), 1.5, () => { throw new Error("draw failed"); })).toThrow("draw failed");
  expect(eyes.map(eye => eye.matrix)).toEqual(original);
  expect(xr.cameraAutoUpdate).toBe(true);
  xr.isPresenting = false;
  xr.updateCamera.mockClear();
  const draw = vi.fn();
  depth.render(xr, new THREE.PerspectiveCamera(), 1.5, draw);
  expect(draw).toHaveBeenCalledOnce();
  expect(xr.updateCamera).not.toHaveBeenCalled();
});
