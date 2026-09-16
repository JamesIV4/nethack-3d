import * as THREE from "three";

export type XrViewMode = "tabletop" | "first-person";
const sourceToTrackingRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
export const TABLETOP_CLIPPING_INSET_TILES = 0.001;

/**
 * The game scene stays in its original +Z-up coordinates (including custom shader uniforms).
 * Transform the tracked cameras into that scene instead of copying/rebuilding the world.
 */
export function createTrackingToGame(
  mode: XrViewMode, player: THREE.Vector3, anchor: THREE.Vector3,
  heading: THREE.Quaternion, tileSize: number, eyeHeight: number,
  pitch = 0,
  viewYaw = 0,
  worldScale = 1,
  tablePosition?: THREE.Vector3,
): { matrix: THREE.Matrix4; tabletop: THREE.Vector3; scale: number } {
  const scale = mode === "first-person"
    ? THREE.MathUtils.clamp(anchor.y / eyeHeight, 1 / tileSize, 3.5 / tileSize)
    : 0.11 * worldScale / tileSize;
  const tabletop = tablePosition?.clone() ?? new THREE.Vector3(0, THREE.MathUtils.clamp(anchor.y - 0.65, 0.45, 1.05), -1.55)
    .applyQuaternion(heading).add(new THREE.Vector3(anchor.x, 0, anchor.z));
  const center = mode === "first-person" ? new THREE.Vector3(anchor.x, 0, anchor.z) : tabletop;
  const rotation = heading.clone();
  if (mode === "first-person") rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), viewYaw));
  if (mode === "tabletop") rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch));
  rotation.multiply(sourceToTrackingRotation);
  const translation = center.clone().sub(player.clone().multiplyScalar(scale).applyQuaternion(rotation));
  return {
    matrix: new THREE.Matrix4().compose(translation, rotation, new THREE.Vector3(scale, scale, scale)).invert(),
    tabletop, scale,
  };
}

export function tabletopClippingPlanes(player: THREE.Vector3, tileSize: number, area = 1): THREE.Plane[] {
  const inset = tileSize * TABLETOP_CLIPPING_INSET_TILES;
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -player.x + tileSize * 12.5 * area - inset),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), player.x + tileSize * 12.5 * area - inset),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -player.y + tileSize * 8.5 * area - inset),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), player.y + tileSize * 8.5 * area - inset),
  ];
}
