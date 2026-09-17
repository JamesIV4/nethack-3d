import * as THREE from "three";

/** Adjust only the rendered eye baseline; tracked head/controller poses stay intact. */
export class StereoDepth {
  private readonly left = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly midpoint = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();

  render(xr: Pick<THREE.WebXRManager, "isPresenting" | "updateCamera" | "cameraAutoUpdate"> & { getCamera(): THREE.ArrayCamera },
    camera: THREE.PerspectiveCamera, depth: number, draw: () => void): void {
    if (!xr.isPresenting || depth === 1 || !Number.isFinite(depth)) {
      draw();
      return;
    }
    const eyes = xr.getCamera().cameras;
    if (eyes.length !== 2) { draw(); return; }
    // Eye matrices are in tracking space. Adjust before updateCamera so Three
    // also recomputes its stereo union frustum under the game's scaled rig.
    this.left.setFromMatrixPosition(eyes[0].matrix);
    this.right.setFromMatrixPosition(eyes[1].matrix);
    this.midpoint.addVectors(this.left, this.right).multiplyScalar(.5);
    const autoUpdate = xr.cameraAutoUpdate;
    try {
      eyes[0].matrix.setPosition(this.offset.subVectors(this.left, this.midpoint).multiplyScalar(depth).add(this.midpoint));
      eyes[1].matrix.setPosition(this.offset.subVectors(this.right, this.midpoint).multiplyScalar(depth).add(this.midpoint));
      xr.updateCamera(camera);
      xr.cameraAutoUpdate = false;
      draw();
    } finally {
      eyes[0].matrix.setPosition(this.left);
      eyes[1].matrix.setPosition(this.right);
      xr.cameraAutoUpdate = autoUpdate;
      xr.updateCamera(camera);
    }
  }
}
