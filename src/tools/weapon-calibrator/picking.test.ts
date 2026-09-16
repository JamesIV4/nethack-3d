import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { createWeaponVoxelMesh } from '../../quest/webxr/weapon-voxels';
import { normalizeWeaponPose, weaponLocalMatrix } from '../../quest/webxr/weapon-pose';
import { pickWeaponAttachment } from './picking';

afterEach(() => vi.unstubAllGlobals());
it('centers the visible pixels despite uneven margins and picks their attachment after rotation', () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 0; y < 3; y++) for (let x = 1; x < 3; x++) pixels[(y * 8 + x) * 4 + 3] = 255;
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ drawImage() {}, getImageData: () => ({ data: pixels }) }) }) });
  const texture = new THREE.Texture({ width: 8, height: 8 } as HTMLImageElement);
  const { mesh, pixelSize } = createWeaponVoxelMesh(texture);
  mesh.computeBoundingBox();
  expect(mesh.boundingBox!.getCenter(new THREE.Vector3()).length()).toBeLessThan(1e-6);
  expect(pixelSize).toBeCloseTo(1 / 3);
  const pose = normalizeWeaponPose({ rotationDeg: { x: 30, y: -15, z: 45 } });
  mesh.matrixAutoUpdate = false; mesh.matrix.copy(weaponLocalMatrix(pose, pixelSize));
  const pixelCenter = new THREE.Vector3(.5, 1, 0).multiplyScalar(pixelSize);
  const target = pixelCenter.clone().applyMatrix4(mesh.matrix);
  const normal = new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrix);
  const ray = new THREE.Raycaster(target.clone().add(normal), normal.clone().negate());
  const picked = pickWeaponAttachment(mesh, pixelSize, ray);
  expect(picked).toEqual({ x: .5, y: 1, z: 0 });
  const attached = weaponLocalMatrix({ ...pose, attachmentOffsetPixels: picked! }, pixelSize);
  expect(pixelCenter.clone().applyMatrix4(attached).length()).toBeLessThan(1e-6);
  mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.dispose(); texture.dispose();
});
