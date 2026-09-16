import * as THREE from "three";

/** Reject only geometry wholly outside the renderer's existing world clipping planes. */
export class WorldClipCulling {
  private readonly center = new THREE.Vector3();
  private readonly halfSize = new THREE.Vector3();
  private readonly maskedObjects: THREE.Object3D[] = [];
  private readonly savedMasks: number[] = [];

  isOutside(object: THREE.Object3D, planes: readonly THREE.Plane[]): boolean {
    // Sprites face the viewer in a shader; animated/deformed meshes can exceed
    // their geometry bounds. Keep their existing rendering and picking paths.
    if (planes.length === 0 || !(object instanceof THREE.Mesh) ||
      !object.frustumCulled || object instanceof THREE.SkinnedMesh ||
      object instanceof THREE.InstancedMesh || object instanceof THREE.BatchedMesh ||
      object.morphTargetInfluences?.length) return false;
    const geometry = object.geometry;
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box || box.isEmpty()) return false;
    box.getCenter(this.center).applyMatrix4(object.matrixWorld);
    box.getSize(this.halfSize).multiplyScalar(0.5);
    const m = object.matrixWorld.elements;
    for (const plane of planes) {
      const n = plane.normal;
      // Project the local box onto the world plane. This also covers rotated
      // children of rectangular tiles (nonuniform scale/shear).
      const extent =
        Math.abs(n.x * m[0] + n.y * m[1] + n.z * m[2]) * this.halfSize.x +
        Math.abs(n.x * m[4] + n.y * m[5] + n.z * m[6]) * this.halfSize.y +
        Math.abs(n.x * m[8] + n.y * m[9] + n.z * m[10]) * this.halfSize.z;
      if (plane.distanceToPoint(this.center) < -extent - 1e-6) return true;
    }
    return false;
  }

  render(
    renderer: THREE.WebGLRenderer, scene: THREE.Scene,
    camera: THREE.Camera, excludedRoot: THREE.Object3D,
  ): void {
    if (renderer.clippingPlanes.length === 0) {
      renderer.render(scene, camera);
      return;
    }
    const autoUpdate = scene.matrixWorldAutoUpdate;
    // Match the renderer's normal update, once, before testing current bounds.
    if (autoUpdate) scene.updateMatrixWorld();
    const visit = (object: THREE.Object3D): void => {
      if (!object.visible || object === excludedRoot) return;
      if (object.layers.mask !== 0 && this.isOutside(object, renderer.clippingPlanes)) {
        this.maskedObjects.push(object);
        this.savedMasks.push(object.layers.mask);
        // Layers exclude just this object's draw; visible=false would also
        // discard children that can extend back into the board.
        object.layers.mask = 0;
      }
      // A mesh's own bounds do not bound its children (wall overlays, effects).
      for (const child of object.children) visit(child);
    };
    try {
      for (const child of scene.children) visit(child);
      scene.matrixWorldAutoUpdate = false;
      renderer.render(scene, camera);
    } finally {
      scene.matrixWorldAutoUpdate = autoUpdate;
      for (let i = 0; i < this.maskedObjects.length; i++) {
        this.maskedObjects[i].layers.mask = this.savedMasks[i];
      }
      this.maskedObjects.length = this.savedMasks.length = 0;
    }
  }
}
