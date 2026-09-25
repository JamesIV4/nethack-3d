import * as THREE from "three";
import { TerrainRenderGeometry } from "./terrain-render-geometry";
import type { WorldClipCulling } from "./world-clip-culling";

interface Batch {
  mesh: THREE.InstancedMesh;
  ownedMaterial: boolean;
  sources: THREE.Mesh[];
  seen: boolean;
}

const floorKeyProperties = [
  "version", "side", "depthFunc", "alphaTest", "polygonOffset", "polygonOffsetFactor",
  "polygonOffsetUnits", "fog", "toneMapped", "dithering", "premultipliedAlpha",
] as const;

/** Temporary XR draw batches. Runtime tiles, overlays, effects and picking stay authoritative. */
export class XrTerrainBatches {
  private readonly root = new THREE.Group();
  private readonly geometries = new TerrainRenderGeometry();
  private readonly batches = new Map<string, Batch>();
  private readonly opaqueTextures = new WeakMap<THREE.Texture, {
    image: unknown; width: number; height: number; version: number; sourceVersion: number; opaque: boolean;
  }>();
  private readonly masked: THREE.Mesh[] = [];
  private readonly masks: number[] = [];
  private readonly swapped: THREE.Mesh[] = [];
  private readonly originalGeometries: THREE.BufferGeometry[] = [];
  private readonly floorKeys = new WeakMap<THREE.MeshBasicMaterial, {
    texture: THREE.Texture | null; r: number; g: number; b: number; shader: string;
    values: (number | boolean)[]; key: string;
  }>();
  private readonly meshKeys = new WeakMap<THREE.Mesh, {
    materialKey: string; geometry: THREE.BufferGeometry; layers: number; order: number;
    castShadow: boolean; receiveShadow: boolean; key: string;
  }>();

  constructor() {
    this.root.name = "XR terrain draw batches";
    this.root.visible = false;
    this.root.matrixAutoUpdate = false;
  }

  private isOpaqueTexture(texture: THREE.Texture | null): boolean {
    if (!texture) return true;
    // Our tile canvases are readable. Unknown/tainted/dynamic image sources
    // simply retain their normal material and transparency ordering.
    const image = texture.image as HTMLCanvasElement | undefined;
    const width = image?.width ?? 0, height = image?.height ?? 0;
    const cached = this.opaqueTextures.get(texture);
    if (cached && cached.image === image && cached.width === width && cached.height === height &&
      cached.version === texture.version && cached.sourceVersion === texture.source.version) return cached.opaque;
    let opaque = false;
    if (image && width > 0 && height > 0 && typeof image.getContext === "function") {
      try {
        const context = image.getContext("2d");
        if (context) {
          const data = context.getImageData(0, 0, width, height).data;
          opaque = true;
          for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) { opaque = false; break; }
        }
      } catch { /* Unreadable textures are not eligible for opaque batching. */ }
    }
    this.opaqueTextures.set(texture, { image, width, height, version: texture.version, sourceVersion: texture.source.version, opaque });
    return opaque;
  }

  private floorKey(material: THREE.MeshBasicMaterial): string | null {
    if (material.opacity !== 1 || !material.visible || !material.depthWrite || !material.depthTest ||
      !material.colorWrite || material.blending !== THREE.NormalBlending || material.alphaMap ||
      material.lightMap || material.aoMap || material.envMap || material.wireframe || material.vertexColors ||
      material.stencilWrite || material.clippingPlanes?.length || material.alphaHash ||
      !this.isOpaqueTexture(material.map)) return null;
    const shader = material.customProgramCacheKey(), cached = this.floorKeys.get(material);
    let unchanged = !!cached && cached.texture === material.map && cached.r === material.color.r &&
      cached.g === material.color.g && cached.b === material.color.b && cached.shader === shader;
    for (let i = 0; unchanged && i < floorKeyProperties.length; i++) {
      unchanged = cached!.values[i] === material[floorKeyProperties[i]];
    }
    if (unchanged) return cached!.key;
    const values = floorKeyProperties.map(property => material[property]);
    const key = "floor:" + [material.map?.id ?? -1, material.color.r, material.color.g, material.color.b, ...values, shader].join(":");
    this.floorKeys.set(material, { texture: material.map, r: material.color.r, g: material.color.g, b: material.color.b, shader, values, key });
    return key;
  }

  private meshKey(mesh: THREE.Mesh, materialKey: string): string {
    const cached = this.meshKeys.get(mesh);
    if (cached && cached.materialKey === materialKey && cached.geometry === mesh.geometry &&
      cached.layers === mesh.layers.mask && cached.order === mesh.renderOrder &&
      cached.castShadow === mesh.castShadow && cached.receiveShadow === mesh.receiveShadow) return cached.key;
    const key = materialKey + ":" + [mesh.geometry.id, mesh.layers.mask, mesh.renderOrder, mesh.castShadow, mesh.receiveShadow].join(":");
    this.meshKeys.set(mesh, { materialKey, geometry: mesh.geometry, layers: mesh.layers.mask, order: mesh.renderOrder,
      castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow, key });
    return key;
  }

  render(
    renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, trackingRoot: THREE.Object3D,
    tiles: ReadonlyMap<string, THREE.Mesh>, floorGeometry: THREE.BufferGeometry,
    overlays: ReadonlyMap<string, { material: THREE.Material }>, culling: WorldClipCulling,
  ): void {
    const autoUpdate = scene.matrixWorldAutoUpdate;
    if (this.root.parent !== scene) scene.add(this.root);
    if (autoUpdate) scene.updateMatrixWorld();
    scene.matrixWorldAutoUpdate = false;
    this.root.visible = true;
    for (const batch of this.batches.values()) { batch.sources.length = 0; batch.seen = false; batch.mesh.visible = false; }
    try {
      for (const [tileKey, mesh] of tiles) {
        if (!mesh.visible || mesh.parent !== scene || mesh.layers.mask === 0 || mesh.morphTargetInfluences?.length) continue;
        if (mesh.userData.isWall === true) {
          const geometry = this.geometries.withoutBottom(mesh.geometry, mesh.material);
          if (geometry !== mesh.geometry) {
            this.swapped.push(mesh); this.originalGeometries.push(mesh.geometry); mesh.geometry = geometry;
          }
        }
        const material = mesh.material;
        if (Array.isArray(material) || !material.visible || material.opacity !== 1) continue;
        let key: string, ownedMaterial = false;
        if (mesh.geometry === floorGeometry && (mesh.userData.materialKind === "floor" || mesh.userData.materialKind === "dark") &&
          material instanceof THREE.MeshBasicMaterial && overlays.get(tileKey)?.material === material) {
          const floorKey = this.floorKey(material);
          if (floorKey === null) continue;
          key = floorKey; ownedMaterial = true;
        } else if (mesh.userData.isWall === true && material instanceof THREE.MeshLambertMaterial && !material.transparent) {
          key = "wall:" + material.uuid;
        } else continue;
        // Avoid allocating two descriptor arrays and long strings per tile on
        // every headset frame. Transforms and clip tests still update each frame.
        key = this.meshKey(mesh, key);
        let batch = this.batches.get(key);
        if (!batch) {
          const batchMaterial = ownedMaterial ? material.clone() : material;
          if (ownedMaterial) {
            batchMaterial.transparent = false;
            // Material.clone deliberately omits shader callbacks. Preserve the
            // game's vignette (which already supports instanceMatrix).
            batchMaterial.onBeforeCompile = material.onBeforeCompile;
            batchMaterial.customProgramCacheKey = material.customProgramCacheKey;
          }
          const instanced = this.createMesh(mesh, batchMaterial, 2);
          batch = { mesh: instanced, ownedMaterial, sources: [], seen: false };
          this.batches.set(key, batch); this.root.add(instanced);
        }
        batch.seen = true;
        if (!culling.isOutside(mesh, renderer.clippingPlanes)) batch.sources.push(mesh);
      }
      for (const [key, batch] of this.batches) {
        if (!batch.seen) { this.releaseBatch(batch); this.batches.delete(key); continue; }
        if (batch.sources.length < 2) continue;
        if (batch.mesh.instanceMatrix.count < batch.sources.length) {
          const old = batch.mesh;
          batch.mesh = this.createMesh(batch.sources[0], old.material, 2 ** Math.ceil(Math.log2(batch.sources.length)));
          this.root.remove(old); old.dispose(); this.root.add(batch.mesh);
        }
        batch.mesh.count = batch.sources.length;
        for (let i = 0; i < batch.sources.length; i++) {
          const mesh = batch.sources[i];
          batch.mesh.setMatrixAt(i, mesh.matrix);
          this.masked.push(mesh); this.masks.push(mesh.layers.mask); mesh.layers.mask = 0;
        }
        batch.mesh.instanceMatrix.needsUpdate = true;
        batch.mesh.visible = true;
      }
      this.root.updateMatrixWorld(true);
      culling.render(renderer, scene, camera, trackingRoot);
    } finally {
      for (let i = 0; i < this.masked.length; i++) this.masked[i].layers.mask = this.masks[i];
      for (let i = 0; i < this.swapped.length; i++) this.swapped[i].geometry = this.originalGeometries[i];
      this.masked.length = this.masks.length = this.swapped.length = this.originalGeometries.length = 0;
      this.root.visible = false;
      scene.matrixWorldAutoUpdate = autoUpdate;
    }
  }

  private createMesh(source: THREE.Mesh, material: THREE.Material | THREE.Material[], capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(source.geometry, material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.matrixAutoUpdate = false;
    // Individual sources have already been tested against the board. Avoid a
    // second full instance-bounds rebuild each frame; the GPU clips both eyes.
    mesh.frustumCulled = false;
    mesh.layers.mask = source.layers.mask; mesh.renderOrder = source.renderOrder;
    mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow;
    mesh.visible = false;
    return mesh;
  }

  private releaseBatch(batch: Batch): void {
    this.root.remove(batch.mesh); batch.mesh.dispose();
    if (batch.ownedMaterial) (batch.mesh.material as THREE.Material).dispose();
  }

  dispose(): void {
    for (const batch of this.batches.values()) this.releaseBatch(batch);
    this.batches.clear(); this.geometries.dispose(); this.root.removeFromParent();
  }
}
