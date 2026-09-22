import * as THREE from "three";

export function isBillboardObject(object: THREE.Object3D): boolean {
  return object instanceof THREE.Sprite || object.userData.isEntityBillboardProxy === true;
}

type Pixels = { image: unknown; width: number; height: number; version: number; sourceVersion: number; alpha: Uint8Array | null };
/** Shared by Info/screen picking and controller rays. Read pixels once per texture revision. */
export class VisibleSpriteHits {
  private readonly cache = new WeakMap<THREE.Texture, Pixels>();
  private readonly uv = new THREE.Vector2();

  accepts(hit: THREE.Intersection): boolean {
    if (!isBillboardObject(hit.object)) return true;
    const material = (hit.object as THREE.Sprite | THREE.Mesh).material;
    if (Array.isArray(material)) return true;
    if (!material.visible || material.opacity <= 0) return false;
    const texture = (material as THREE.SpriteMaterial | THREE.MeshBasicMaterial).map;
    if (!texture || !hit.uv) return true;
    const image = texture.image;
    const width = image?.width ?? 0, height = image?.height ?? 0;
    if (width <= 0 || height <= 0) return false;
    let entry = this.cache.get(texture);
    if (!entry || entry.image !== image || entry.width !== width || entry.height !== height ||
      entry.version !== texture.version || entry.sourceVersion !== texture.source.version) {
      let alpha: Uint8Array | null = null;
      try {
        let pixels: ArrayLike<number> | undefined;
        if (texture instanceof THREE.DataTexture && texture.format === THREE.RGBAFormat && texture.type === THREE.UnsignedByteType) {
          pixels = image.data;
        } else if (typeof image.getContext === "function") {
          pixels = image.getContext("2d", { willReadFrequently: true })?.getImageData(0, 0, width, height).data;
        } else if (typeof document !== "undefined") {
          const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context?.drawImage(image, 0, 0, width, height);
          pixels = context?.getImageData(0, 0, width, height).data;
        }
        if (pixels) {
          alpha = new Uint8Array(width * height);
          for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3];
        }
      } catch { /* Unreadable external textures retain geometry picking; cache the failure too. */ }
      entry = { image, width, height, version: texture.version, sourceVersion: texture.source.version, alpha };
      this.cache.set(texture, entry);
    }
    if (!entry.alpha) return true;
    if (texture.matrixAutoUpdate) texture.updateMatrix();
    texture.transformUv(this.uv.copy(hit.uv));
    const x = Math.floor(THREE.MathUtils.clamp(this.uv.x, 0, .999999) * width);
    // transformUv already applies flipY; do not flip it a second time.
    const y = Math.floor(THREE.MathUtils.clamp(this.uv.y, 0, .999999) * height);
    const alpha = entry.alpha[y * width + x] / 255 * material.opacity;
    return alpha > 0 && alpha >= material.alphaTest;
  }
}
