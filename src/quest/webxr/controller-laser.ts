import * as THREE from 'three';
import { withoutWorldClipping } from './overlay-material';

/** targetRaySpace defines the laser origin and local -Z forward direction. */
export function createControllerLaser(): THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    withoutWorldClipping(new THREE.LineBasicMaterial({ color: 0x78d5ff, transparent: true,
      opacity: .7, depthTest: false, depthWrite: false, toneMapped: false })));
  line.renderOrder = 20000;
  line.frustumCulled = false;
  return line;
}
