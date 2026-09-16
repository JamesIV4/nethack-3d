import * as THREE from "three";
import { expect, it } from "vitest";
import { createWeaponPoseLibrary, normalizeWeaponPose, resolveWeaponPose, weaponLocalMatrix, weaponPoseKey } from "./weapon-pose";

it("snaps only VR rotation adjustments in 15 degree steps", () => {
  const pose = normalizeWeaponPose({ attachmentOffsetPixels: { x: 2, y: -3.5, z: .5 },
    rotationDeg: { x: 22, y: -8, z: 181 } });
  expect(pose.attachmentOffsetPixels).toEqual({ x: 2, y: -3.5, z: .5 });
  expect(pose.rotationDeg).toEqual({ x: 15, y: -15, z: 180 });
  expect(weaponPoseKey("tiles", 10, 20)).toBe(weaponPoseKey("tiles", 10, 30));
  expect(weaponPoseKey("tiles", -1, 20)).not.toBe(weaponPoseKey("tiles", -1, 30));
});

it("defaults to an upright sprite centered on the laser with no flat held-weapon pose", () => {
  const matrix = weaponLocalMatrix(normalizeWeaponPose({}), 1 / 32);
  expect(new THREE.Vector3().applyMatrix4(matrix)).toEqual(new THREE.Vector3());
  expect(new THREE.Vector3(0, 1, 0).transformDirection(matrix)).toEqual(new THREE.Vector3(0, 1, 0));
  expect(new THREE.Vector3(0, 0, 1).transformDirection(matrix)).toEqual(new THREE.Vector3(0, 0, 1));
  expect(new THREE.Vector3().setFromMatrixScale(matrix)).toEqual(new THREE.Vector3(.4, .4, .4));
});

it("adds global, tileset and sprite rotations while keeping attachments per sprite", () => {
  const library = createWeaponPoseLibrary();
  library.globalRotationDeg = { x: 15, y: 30, z: 180 };
  library.tilesetRotationDeg['tiles-a'] = { x: -15, y: 0, z: 90 };
  const key = weaponPoseKey('tiles-a', 1, null);
  library.sprites[key] = normalizeWeaponPose({ attachmentOffsetPixels: { x: 1, y: -2, z: .5 }, rotationDeg: { x: 45, y: 15, z: 0 } });
  const pose = resolveWeaponPose(library, 'tiles-a', key);
  expect(pose.rotationDeg).toEqual({ x: 45, y: 45, z: 270 });
  expect(pose.attachmentOffsetPixels).toEqual({ x: 1, y: -2, z: .5 });
  expect(resolveWeaponPose(library, 'tiles-a', weaponPoseKey('tiles-a', 2, null)).rotationDeg).toEqual({ x: 0, y: 30, z: 270 });
  expect(resolveWeaponPose(library, 'tiles-b', weaponPoseKey('tiles-b', 1, null)).rotationDeg).toEqual(library.globalRotationDeg);
  const point = new THREE.Vector3(1, -2, .5).multiplyScalar(1 / 16).applyMatrix4(weaponLocalMatrix(pose, 1 / 16));
  expect(point.length()).toBeLessThan(1e-6);
  pose.attachmentOffsetPixels.x = 99;
  expect(library.sprites[key].attachmentOffsetPixels.x).toBe(1);
});

it.each([1 / 16, 1 / 64])("keeps the selected attachment at the laser origin while rotating, pixel size %s", pixelSize => {
  const pose = normalizeWeaponPose({ attachmentOffsetPixels: { x: 2, y: -3.5, z: .5 }, rotationDeg: { x: 30, y: -15, z: 45 } });
  const matrix = weaponLocalMatrix(pose, pixelSize);
  const attachment = new THREE.Vector3(2, -3.5, .5).multiplyScalar(pixelSize).applyMatrix4(matrix);
  expect(attachment.length()).toBeLessThan(1e-6);
  expect(new THREE.Vector3().applyMatrix4(matrix).length()).toBeGreaterThan(0);
  const expected = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 6, -Math.PI / 12, Math.PI / 4));
  const rotation = new THREE.Quaternion();
  matrix.decompose(new THREE.Vector3(), rotation, new THREE.Vector3());
  expect(rotation.angleTo(expected)).toBeLessThan(1e-6);
});

