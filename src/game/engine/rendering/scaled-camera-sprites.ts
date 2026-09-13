import * as THREE from "three";

const scaleLine = "vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );";
const marker = "nh3d_scaled_camera_sprite";

/** Three's sprite shader measures object scale, so scaled XR cameras need the view scale too. */
export class ScaledCameraSprites {
  private readonly installed = new WeakMap<THREE.SpriteMaterial, THREE.Material["onBeforeCompile"]>();

  prepare(scene: THREE.Scene): void {
    scene.traverseVisible((object) => {
      if (object instanceof THREE.Sprite) this.patch(object.material);
    });
  }

  patch(material: THREE.SpriteMaterial): void {
    if (this.installed.get(material) === material.onBeforeCompile) return;
    const previousCompile = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey;
    const compile: THREE.Material["onBeforeCompile"] = (shader, renderer) => {
      previousCompile.call(material, shader, renderer);
      if (!shader.vertexShader.includes(marker)) {
        shader.vertexShader = shader.vertexShader.replace(scaleLine,
          scaleLine + "\n\t// " + marker + "\n\tscale *= length( viewMatrix[ 0 ].xyz );");
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
