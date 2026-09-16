import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import { createWeaponVoxelMesh } from "./weapon-voxels";

afterEach(() => vi.unstubAllGlobals());
it("builds one cube per opaque source pixel with one-pixel depth", () => {
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    drawImage: () => {}, getImageData: () => ({ data: pixels }),
  }) }) });
  const texture = new THREE.Texture({ width: 2, height: 1 } as HTMLImageElement);
  const { mesh, aspect } = createWeaponVoxelMesh(texture);
  expect(aspect).toBe(2);
  expect(mesh.count).toBe(2);
  const first = new THREE.Matrix4(), second = new THREE.Matrix4();
  mesh.getMatrixAt(0, first); mesh.getMatrixAt(1, second);
  const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
  first.decompose(position, rotation, scale);
  expect(scale.z).toBe(1);
  expect(scale.x).toBeCloseTo(.96);
  expect(position.x).toBeCloseTo(-.5);
  second.decompose(position, rotation, scale);
  expect(position.x).toBeCloseTo(.5);
  expect(mesh.instanceColor?.array).not.toBeNull();
  mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); texture.dispose();
});
