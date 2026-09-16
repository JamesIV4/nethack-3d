import * as THREE from 'three';

/** Pick the center of an actual visible voxel in sprite-local pixel coordinates. */
export function pickWeaponAttachment(mesh: THREE.InstancedMesh, pixelSize: number, ray: THREE.Raycaster): { x: number; y: number; z: number } | null {
  mesh.updateWorldMatrix(true, false);
  const hit = ray.intersectObject(mesh, false)[0];
  if (hit?.instanceId === undefined) return null;
  const matrix = new THREE.Matrix4(); mesh.getMatrixAt(hit.instanceId, matrix);
  const point = new THREE.Vector3().setFromMatrixPosition(matrix).divideScalar(pixelSize);
  return { x: Math.round(point.x * 2) / 2, y: Math.round(point.y * 2) / 2, z: 0 };
}
