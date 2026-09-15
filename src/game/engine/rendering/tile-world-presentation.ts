import * as THREE from "three";

/** Preserve camera-relative artwork under a nonuniform world-grid transform. */
export function applyCameraAttachedWorldAspect(
  object: THREE.Object3D,
  logicalCamera: THREE.Camera,
  presentationCamera: THREE.Camera,
  scaleX: number,
  inverseWorldScale: THREE.Matrix4,
): void {
  object.matrixAutoUpdate = true;
  object.updateMatrix();
  if (scaleX === 1) return;
  logicalCamera.updateMatrixWorld();
  presentationCamera.updateMatrixWorld();
  inverseWorldScale.makeScale(1 / scaleX, 1, 1);
  object.matrix.premultiply(logicalCamera.matrixWorldInverse)
    .premultiply(presentationCamera.matrixWorld)
    .premultiply(inverseWorldScale);
  // Keep the full matrix: a rotated object under nonuniform scaling cannot
  // always be represented without shear by position/quaternion/scale alone.
  object.matrixAutoUpdate = false;
  object.matrixWorldNeedsUpdate = true;
}
