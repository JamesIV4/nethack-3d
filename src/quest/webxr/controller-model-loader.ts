import { ControllerPrebakedModels } from "./controller-prebaked";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { withoutWorldClipping } from "./overlay-material";
import { profileControllerAnimation, runtimeControllerAnimation, type ControllerAnimation, type ControllerProfile } from "./controller-model-animation";

export interface LoadedController {
  scene: THREE.Group;
  animation: ControllerAnimation;
  meshes: number;
  triangles: number;
  dispose(): void;
}
export interface ControllerModelLoader {
  load(buffer: ArrayBuffer, hand: "left" | "right", runtime: boolean, signal: AbortSignal): Promise<LoadedController>;
  dispose(): void;
}

export class GlbControllerModelLoader implements ControllerModelLoader {
  private decoder: KTX2Loader | null = null;
  private readonly prebaked = new ControllerPrebakedModels();
  constructor(private readonly renderer: THREE.WebGLRenderer) {}
  async load(buffer: ArrayBuffer, hand: "left" | "right", runtime: boolean, signal: AbortSignal): Promise<LoadedController> {
    if (runtime) buffer = await this.prebaked.resolve(buffer, signal);
    if (buffer.byteLength > 16 * 1024 * 1024 || buffer.byteLength < 20) throw new Error("Invalid controller GLB size");
    const header = new DataView(buffer);
    if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== buffer.byteLength) throw new Error("Invalid controller GLB header");
    const jsonLength = header.getUint32(12, true);
    if (jsonLength > buffer.byteLength - 20 || header.getUint32(16, true) !== 0x4e4f534a) throw new Error("Invalid controller GLB JSON");
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
    if ([...(json.buffers ?? []), ...(json.images ?? [])].some((entry: { uri?: string }) => entry.uri && !entry.uri.startsWith("data:"))) throw new Error("Controller GLB must contain its own resources");
    this.decoder ??= new KTX2Loader().setTranscoderPath("/quest-controllers/basis/").detectSupport(this.renderer);
    const gltf = await new GLTFLoader().setKTX2Loader(this.decoder).parseAsync(buffer, "");
    const textures = new Set<THREE.Texture>(), geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    let meshes = 0, triangles = 0;
    const dispose = () => {
      gltf.scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        geometries.add(mesh.geometry);
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      });
      geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
      const images = new Set<unknown>();
      textures.forEach(value => { images.add(value.source.data); value.dispose(); });
      for (const image of images) if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) image.close();
      gltf.scene.removeFromParent();
    };
    try {
      gltf.scene.traverse(object => { if ((object as THREE.Mesh).isMesh) geometries.add((object as THREE.Mesh).geometry); });
      gltf.scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        meshes++; triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3;
        geometries.add(mesh.geometry);
        const convert = (original: THREE.Material) => {
          materials.add(original);
          for (const value of Object.values(original)) if (value instanceof THREE.Texture) textures.add(value);
          const source = original as THREE.MeshStandardMaterial;
          const material = withoutWorldClipping(new THREE.MeshStandardMaterial({
            roughness: Math.max(.65, source.roughness ?? .8), metalness: 0,
            aoMap: source.aoMap ?? null, aoMapIntensity: source.aoMapIntensity ?? 1,
            normalMap: source.normalMap ?? null, normalScale: source.normalScale ?? new THREE.Vector2(1, 1),
            roughnessMap: source.roughnessMap ?? null,
            map: source.map ?? null, color: source.color ?? new THREE.Color(0xffffff),
            alphaMap: source.alphaMap ?? null, transparent: source.transparent, opacity: source.opacity,
            alphaTest: source.alphaTest, side: source.side, vertexColors: mesh.geometry.hasAttribute("color"),
            toneMapped: false, depthTest: true, depthWrite: !source.transparent,
          }));
          materials.add(material); return material;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
        mesh.frustumCulled = false;
      });
      if (signal.aborted) throw new Error("Controller load cancelled");
      gltf.scene.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
      if (!meshes || ![size.x, size.y, size.z].every(Number.isFinite) || size.length() < 0.02 || size.length() > 1) throw new Error("Controller geometry has invalid meter-scale bounds");
      let animation: ControllerAnimation;
      if (runtime) animation = await runtimeControllerAnimation(gltf);
      else {
        const response = await fetch("/quest-controllers/meta-quest-touch-plus/profile.json", { signal });
        if (!response.ok) throw new Error("Controller fallback profile is unavailable");
        animation = profileControllerAnimation(gltf.scene, await response.json() as ControllerProfile, hand);
      }
      if (signal.aborted) throw new Error("Controller load cancelled");
      return { scene: gltf.scene, animation, meshes, triangles, dispose };
    } catch (error) { dispose(); throw error; }
  }
  dispose(): void { this.decoder?.dispose(); this.decoder = null; }
}
