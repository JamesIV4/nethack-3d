import * as THREE from "three";
import { defaultWeaponPoses } from "./weapon-pose-defaults";

export interface WeaponPose {
  attachmentOffsetPixels: { x: number; y: number; z: number };
  rotationDeg: { x: number; y: number; z: number };
}
export type WeaponRotation = WeaponPose['rotationDeg'];
export interface WeaponPoseLibrary {
  globalRotationDeg: WeaponRotation;
  tilesetRotationDeg: Record<string, WeaponRotation>;
  sprites: Record<string, WeaponPose>;
}
export const createWeaponPoseLibrary = (): WeaponPoseLibrary => ({
  globalRotationDeg: { x: 0, y: 0, z: 0 }, tilesetRotationDeg: {}, sprites: {},
});

const emptyPose = (): WeaponPose => ({
  attachmentOffsetPixels: { x: 0, y: 0, z: 0 },
  rotationDeg: { x: 0, y: 0, z: 0 },
});
const finite = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === "number" && Number.isFinite(value) ? THREE.MathUtils.clamp(value, min, max) : fallback;
export const snapWeaponAngle = (degrees: number): number => Math.round(degrees / 15) * 15;
export function normalizeWeaponPose(value: Partial<WeaponPose> | null | undefined): WeaponPose {
  const base = emptyPose();
  return {
    attachmentOffsetPixels: {
      x: finite(value?.attachmentOffsetPixels?.x, base.attachmentOffsetPixels.x, -4096, 4096),
      y: finite(value?.attachmentOffsetPixels?.y, base.attachmentOffsetPixels.y, -4096, 4096),
      z: finite(value?.attachmentOffsetPixels?.z, base.attachmentOffsetPixels.z, -4096, 4096),
    },
    rotationDeg: {
      x: snapWeaponAngle(finite(value?.rotationDeg?.x, 0, -180, 180)),
      y: snapWeaponAngle(finite(value?.rotationDeg?.y, 0, -180, 180)),
      z: snapWeaponAngle(finite(value?.rotationDeg?.z, 0, -180, 180)),
    },
  };
}

export const weaponPoseKey = (tilesetPath: string, tileIndex: number, sourceGlyph: number | null): string =>
  `${tilesetPath}|${tileIndex}|${tileIndex < 0 ? sourceGlyph ?? -1 : -1}`;
/** Runtime poses are authored in the standalone utility and baked into the app. */
export function resolveWeaponPose(library: WeaponPoseLibrary, tilesetPath: string, key: string): WeaponPose {
  const sprite = library.sprites[key] ?? emptyPose();
  const global = library.globalRotationDeg, tileset = library.tilesetRotationDeg[tilesetPath];
  return { attachmentOffsetPixels: { ...sprite.attachmentOffsetPixels }, rotationDeg: {
    x: global.x + (tileset?.x ?? 0) + sprite.rotationDeg.x,
    y: global.y + (tileset?.y ?? 0) + sprite.rotationDeg.y,
    z: global.z + (tileset?.z ?? 0) + sprite.rotationDeg.z,
  } };
}
export const getWeaponPose = (tilesetPath: string, key: string): WeaponPose => resolveWeaponPose(defaultWeaponPoses, tilesetPath, key);

/** Sprite pixels are already flipped and centered by the shared texture/voxel pipeline.
 * The chosen pixel attachment stays at the laser origin through every rotation. */
export function weaponLocalMatrix(pose: WeaponPose, pixelSize: number, height = .4): THREE.Matrix4 {
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(pose.rotationDeg.x),
    THREE.MathUtils.degToRad(pose.rotationDeg.y),
    THREE.MathUtils.degToRad(pose.rotationDeg.z), "XYZ"));
  const attachment = pose.attachmentOffsetPixels;
  const position = new THREE.Vector3(attachment.x, attachment.y, attachment.z)
    .multiplyScalar(-pixelSize * height).applyQuaternion(rotation);
  return new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(height, height, height));
}
