import * as THREE from "three";

const scaleLine = "vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );";
const marker = "nh3d_scaled_camera_sprite";

/** Three's sprite shader measures object scale, so scaled XR cameras need the view scale too. */
export class ScaledCameraSprites {
  private readonly origin = { value: new THREE.Vector3() };
  // The game is Z-up. Head roll must not rotate the artwork.
  private readonly up = { value: new THREE.Vector3(0, 0, 1) };
  private readonly enabled = { value: false };
  private readonly tabletop = { value: false };
  private readonly originalSides = new WeakMap<THREE.SpriteMaterial, THREE.Side>();
  private readonly raycasts = new WeakSet<THREE.Sprite>();
  private readonly pickCamera = new THREE.PerspectiveCamera();
  private readonly target = new THREE.Vector3();
  setOrigin(origin: THREE.Vector3): void { this.origin.value.copy(origin); }
  setTabletop(value: boolean): void { this.tabletop.value = value; }
  disable(scene?: THREE.Scene): void {
    this.enabled.value = false;
    scene?.traverse(o => { if (o instanceof THREE.Sprite) this.updateSide(o.material, false); });
  }
  private updateSide(material: THREE.SpriteMaterial, tabletop: boolean): void {
    if (tabletop && !this.originalSides.has(material)) {
      this.originalSides.set(material, material.side); material.side = THREE.DoubleSide; material.needsUpdate = true;
    } else if (!tabletop && this.originalSides.has(material)) {
      material.side = this.originalSides.get(material)!; this.originalSides.delete(material); material.needsUpdate = true;
    }
  }
  private readonly installed = new WeakMap<THREE.SpriteMaterial, THREE.Material["onBeforeCompile"]>();

  prepare(scene: THREE.Scene, headPosition?: THREE.Vector3, tabletop = false): void {
    this.setTabletop(tabletop);
    this.enabled.value = !!headPosition;
    if (headPosition) this.setOrigin(headPosition);
    scene.traverseVisible((object) => {
      if (object instanceof THREE.Sprite) { this.updateSide(object.material, tabletop); this.patch(object.material); this.patchRaycast(object); }
    });
  }

  private patchRaycast(sprite: THREE.Sprite): void {
    if (this.raycasts.has(sprite)) return;
    this.raycasts.add(sprite);
    const original = sprite.raycast;
    sprite.raycast = (raycaster, intersections) => {
      if (!this.enabled.value) { original.call(sprite, raycaster, intersections); return; }
      const camera = raycaster.camera;
      this.pickCamera.position.copy(this.origin.value);
      this.pickCamera.up.copy(this.up.value);
      this.target.setFromMatrixPosition(sprite.matrixWorld);
      if (this.tabletop.value) {
        const dz = this.origin.value.z - this.target.z;
        const depth = Math.max(1e-5, Math.hypot(this.origin.value.x - this.target.x, this.origin.value.y - this.target.y));
        this.target.copy(this.origin.value).sub(new THREE.Vector3(0, -depth, dz));
      }
      this.pickCamera.lookAt(this.target);
      this.pickCamera.updateMatrixWorld(true);
      raycaster.camera = this.pickCamera;
      try { original.call(sprite, raycaster, intersections); }
      finally { raycaster.camera = camera; }
    };
  }

  patch(material: THREE.SpriteMaterial): void {
    if (this.installed.get(material) === material.onBeforeCompile) return;
    const previousCompile = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey;
    const compile: THREE.Material["onBeforeCompile"] = (shader, renderer) => {
      previousCompile.call(material, shader, renderer);
      shader.uniforms.nh3dXrOrigin = this.origin;
      shader.uniforms.nh3dXrUp = this.up;
      shader.uniforms.nh3dXrFacing = this.enabled;
      shader.uniforms.nh3dXrTabletop = this.tabletop;
      if (!shader.vertexShader.includes(marker)) {
        shader.vertexShader = shader.vertexShader.replace(scaleLine,
          scaleLine + "\n\t// " + marker + "\n\tscale *= length( viewMatrix[ 0 ].xyz );");
        shader.vertexShader = "uniform vec3 nh3dXrOrigin;\nuniform vec3 nh3dXrUp;\nuniform bool nh3dXrFacing;\nuniform bool nh3dXrTabletop;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("mvPosition.xy += rotatedPosition;", `
          if (nh3dXrFacing) {
            vec3 facing = normalize(nh3dXrOrigin - modelMatrix[3].xyz);
            if (nh3dXrTabletop) {
              vec3 delta = nh3dXrOrigin - modelMatrix[3].xyz;
              facing = normalize(vec3(0.0, -max(length(delta.xy), 0.00001), delta.z));
            }
            vec3 right = cross(nh3dXrUp, facing);
            if (length(right) < 0.0001) right = vec3(1.0, 0.0, 0.0);
            right = normalize(right);
            vec3 up = normalize(cross(facing, right));
            mvPosition.xyz += mat3(viewMatrix) * (right * rotatedPosition.x + up * rotatedPosition.y) / length(viewMatrix[0].xyz);
          } else { mvPosition.xy += rotatedPosition; }
        `);
      }
    };
    material.onBeforeCompile = compile;
    material.customProgramCacheKey = () => (
      previousKey === THREE.Material.prototype.customProgramCacheKey
        ? previousCompile.toString() : previousKey.call(material)
    ) + "|" + marker;
    material.needsUpdate = true;
    this.installed.set(material, compile);
  }
}
