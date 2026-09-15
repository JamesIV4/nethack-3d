import * as THREE from "three";

/** Versioned render data only: the worker remains authoritative for game rules. */
export interface QuestSceneGeometry {
  id: string;
  positions: number[];
  normals: number[];
  uvs: number[];
  colors?: number[];
  indices: number[];
}

export interface QuestSceneTexture {
  id: string;
  dataUrl: string;
  flipY: boolean;
  nearest: boolean;
  wrapS: number;
  wrapT: number;
}

export interface QuestSceneMaterial {
  id: string;
  color: number[];
  opacity: number;
  map?: string;
  uvTransform?: number[];
  transparent: boolean;
  alphaTest: number;
  side: number;
  unlit: boolean;
  depthWrite: boolean;
  depthTest: boolean;
  vertexColors: boolean;
  additive: boolean;
}

export interface QuestSceneObject {
  id: string;
  geometry: string;
  materials: { material: string; start: number; count: number }[];
  matrix: number[];
  renderOrder: number;
  tile?: [number, number];
  billboard?: boolean;
  upright?: boolean;
  center?: number[];
  rotation?: number;
}

export interface QuestSceneFrame {
  version: 1;
  type: "scene";
  session: string;
  sequence: number;
  reset: boolean;
  geometries: QuestSceneGeometry[];
  textures: QuestSceneTexture[];
  materials: QuestSceneMaterial[];
  objects: QuestSceneObject[];
  removed: string[];
  removedGeometries: string[];
  removedMaterials: string[];
  removedTextures: string[];
  camera: { position: number[]; quaternion: number[] };
  player: number[];
  tileSize: number;
  /** Presentation width multiplier; logical tile IDs and lighting center stay unscaled. */
  worldScaleX?: number;
  eyeHeight?: number;
  lighting?: {
    center: number[];
    radius: number;
    falloffPower: number;
    maxDarkAlpha: number;
    isFpsMode: boolean;
  };
}

export interface QuestSceneSnapshot {
  scene: THREE.Scene;
  camera: THREE.Camera;
  player: [number, number, number];
  tileSize: number;
  eyeHeight?: number;
  lighting?: QuestSceneFrame["lighting"];
}

type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
type MappedMaterial = THREE.Material & {
  color?: THREE.Color;
  map?: THREE.Texture | null;
  vertexColors?: boolean;
};
interface ExportState {
  view: string;
  geometries: Map<string, string>;
  textures: Map<string, string>;
  materials: Map<string, string>;
  objects: Map<string, string>;
}
const emptyState = (): ExportState => ({
  view: "", geometries: new Map(), textures: new Map(), materials: new Map(), objects: new Map(),
});
const spriteGeometryId = "quest:sprite-quad";
const spriteGeometry: QuestSceneGeometry = {
  id: spriteGeometryId,
  positions: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  uvs: [0, 0, 1, 0, 1, 1, 0, 1],
  indices: [0, 1, 2, 0, 2, 3],
};

/** Preserve normalized/interleaved attributes without exposing their padding. */
function attributeValues(attribute: Attribute | undefined, count: number, size: number, fallback: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i += 1) {
    for (let component = 0; component < size; component += 1) {
      values.push(attribute && component < attribute.itemSize
        ? component === 0 ? attribute.getX(i)
          : component === 1 ? attribute.getY(i)
            : component === 2 ? attribute.getZ(i) : attribute.getW(i)
        : fallback);
    }
  }
  return values;
}

export function serializeQuestGeometry(geometry: THREE.BufferGeometry): QuestSceneGeometry | null {
  const position = geometry.getAttribute("position");
  if (!position || position.itemSize < 3 || position.count === 0) return null;
  const indices = geometry.index
    ? attributeValues(geometry.index, geometry.index.count, 1, 0)
    : Array.from({ length: position.count }, (_, i) => i);
  let normal = geometry.getAttribute("normal");
  let generated: THREE.BufferGeometry | undefined;
  if (!normal) {
    // Do not mutate the browser scene to fill an optional native attribute.
    generated = geometry.clone();
    generated.computeVertexNormals();
    normal = generated.getAttribute("normal");
  }
  const result: QuestSceneGeometry = {
    id: geometry.uuid,
    positions: attributeValues(position, position.count, 3, 0),
    normals: attributeValues(normal, position.count, 3, 0),
    uvs: attributeValues(geometry.getAttribute("uv"), position.count, 2, 0),
    indices,
  };
  const color = geometry.getAttribute("color");
  if (color) result.colors = attributeValues(color, position.count, 4, 1);
  generated?.dispose();
  return result;
}

/** Canvas glyphs and atlas images are copied once for each actual texture version. */
export function serializeQuestTexture(texture: THREE.Texture): QuestSceneTexture | null {
  const source = texture.image as (CanvasImageSource & {
    width: number; height: number; naturalWidth?: number; naturalHeight?: number;
    data?: ArrayLike<number>; toDataURL?: (type: string) => string;
  }) | undefined;
  if (!source) return null;
  const width = source.naturalWidth ?? source.width;
  const height = source.naturalHeight ?? source.height;
  if (!width || !height) return null;
  let dataUrl: string;
  if (typeof source.toDataURL === "function") {
    dataUrl = source.toDataURL("image/png");
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    if (source.data) {
      if (texture.type !== THREE.UnsignedByteType || texture.format !== THREE.RGBAFormat) return null;
      context.putImageData(new ImageData(new Uint8ClampedArray(source.data), width, height), 0, 0);
    } else {
      context.drawImage(source, 0, 0);
    }
    dataUrl = canvas.toDataURL("image/png");
  }
  if (!dataUrl.startsWith("data:image/png;base64,")) return null;
  return {
    id: texture.uuid, dataUrl, flipY: texture.flipY,
    nearest: texture.magFilter === THREE.NearestFilter,
    wrapS: texture.wrapS, wrapT: texture.wrapT,
  };
}

/**
 * Diffs resolved scene resources; commits its cache only after native acknowledges
 * the complete frame. There is never more than one frame awaiting consumption.
 */
export class QuestSceneExporter {
  private state = emptyState();
  private readonly session = THREE.MathUtils.generateUUID();
  private sequence = 0;
  private generation = 0;
  private inFlight = false;
  private disposed = false;
  private lastCaptureMs = -Infinity;
  private attributeIds = new WeakMap<object, number>();
  private nextAttributeId = 0;
  private lastError: unknown;

  constructor(private readonly transport: {
    available: () => boolean;
    send: (frame: QuestSceneFrame) => Promise<void>;
    clear?: (session: string) => void;
    encodeTexture?: (texture: THREE.Texture) => QuestSceneTexture | null;
    onError?: (error: unknown) => void;
  }) {}

  update(snapshot: QuestSceneSnapshot, timeMs: number): void {
    if (this.disposed || this.inFlight || !this.transport.available() || timeMs - this.lastCaptureMs < 1000 / 15) return;
    this.lastCaptureMs = timeMs;
    try {
      const { frame, next } = this.capture(snapshot);
      // A stationary turn-based scene needs no native parse, mesh work or JNI transforms.
      if (!frame.reset && next.view === this.state.view &&
          [frame.geometries, frame.textures, frame.materials, frame.objects, frame.removed,
            frame.removedGeometries, frame.removedMaterials, frame.removedTextures].every((items) => items.length === 0)) return;
      const generation = this.generation;
      this.inFlight = true;
      void this.transport.send(frame).then(() => {
        if (!this.disposed && generation === this.generation) this.state = next;
        this.lastError = undefined;
      }).catch((error: unknown) => {
        // A failed transfer can have reset the native cache. Send a complete
        // snapshot next time; do not retain a stale native resource assumption.
        this.state = emptyState();
        this.reportError(error);
      }).finally(() => { this.inFlight = false; });
    } catch (error) {
      this.inFlight = false;
      this.reportError(error);
    }
  }

  invalidate(): void {
    this.generation += 1;
    this.state = emptyState();
  }

  dispose(): void {
    this.disposed = true;
    this.transport.clear?.(this.session);
    this.state = emptyState();
  }

  private reportError(error: unknown): void {
    if (this.disposed) return;
    if (String(error) !== String(this.lastError)) this.transport.onError?.(error);
    this.lastError = error;
  }

  private attributeSignature(attribute: Attribute | null | undefined): string {
    if (!attribute) return "none";
    let id = this.attributeIds.get(attribute);
    if (id === undefined) {
      id = ++this.nextAttributeId;
      this.attributeIds.set(attribute, id);
    }
    const version = attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data.version : attribute.version;
    return `${id}:${version}:${attribute.count}:${attribute.itemSize}:${attribute.normalized}`;
  }

  private capture(snapshot: QuestSceneSnapshot): { frame: QuestSceneFrame; next: ExportState } {
    const next = emptyState();
    const frame: QuestSceneFrame = {
      version: 1, type: "scene", session: this.session, sequence: ++this.sequence,
      reset: this.state.objects.size === 0 && this.state.geometries.size === 0,
      geometries: [], textures: [], materials: [], objects: [], removed: [],
      removedGeometries: [], removedMaterials: [], removedTextures: [],
      camera: { position: [], quaternion: [] }, player: snapshot.player,
      tileSize: snapshot.tileSize, eyeHeight: snapshot.eyeHeight, lighting: snapshot.lighting,
      worldScaleX: snapshot.scene.scale.x,
    };
    snapshot.scene.updateMatrixWorld(true);
    snapshot.camera.updateWorldMatrix(true, false);
    frame.camera.position = new THREE.Vector3().setFromMatrixPosition(snapshot.camera.matrixWorld).toArray();
    frame.camera.quaternion = snapshot.camera.getWorldQuaternion(new THREE.Quaternion()).toArray();
    next.view = JSON.stringify([frame.camera, frame.player, frame.tileSize, frame.worldScaleX, frame.eyeHeight, frame.lighting]);

    const visitTexture = (texture: THREE.Texture): boolean => {
      if (next.textures.has(texture.uuid)) return true;
      const source = texture.image as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number } | undefined;
      const signature = `${texture.version}:${texture.source.version}:${source?.naturalWidth ?? source?.width}:${source?.naturalHeight ?? source?.height}:${texture.flipY}:${texture.magFilter}:${texture.wrapS}:${texture.wrapT}`;
      if (this.state.textures.get(texture.uuid) !== signature) {
        const encoded = (this.transport.encodeTexture ?? serializeQuestTexture)(texture);
        if (!encoded) return false;
        frame.textures.push(encoded);
      }
      next.textures.set(texture.uuid, signature);
      return true;
    };
    const visitMaterial = (material: MappedMaterial): string => {
      if (next.materials.has(material.uuid)) return material.uuid;
      const resource: QuestSceneMaterial = {
        id: material.uuid,
        color: material.color?.toArray() ?? [1, 1, 1], opacity: material.opacity,
        transparent: material.transparent, alphaTest: material.alphaTest, side: material.side,
        unlit: material instanceof THREE.MeshBasicMaterial || material instanceof THREE.SpriteMaterial,
        depthWrite: material.depthWrite, depthTest: material.depthTest,
        vertexColors: material.vertexColors === true,
        additive: material.blending === THREE.AdditiveBlending,
      };
      if (material.map && visitTexture(material.map)) {
        if (material.map.matrixAutoUpdate) material.map.updateMatrix();
        resource.map = material.map.uuid;
        resource.uvTransform = material.map.matrix.toArray();
      }
      const signature = JSON.stringify(resource);
      next.materials.set(material.uuid, signature);
      if (this.state.materials.get(material.uuid) !== signature) frame.materials.push(resource);
      return material.uuid;
    };
    const visitGeometry = (geometry: THREE.BufferGeometry): boolean => {
      if (next.geometries.has(geometry.uuid)) return true;
      const signature = [geometry.index, geometry.getAttribute("position"), geometry.getAttribute("normal"), geometry.getAttribute("uv"), geometry.getAttribute("color")]
        .map((attribute) => this.attributeSignature(attribute)).join("|");
      if (this.state.geometries.get(geometry.uuid) !== signature) {
        const resource = serializeQuestGeometry(geometry);
        if (!resource) return false;
        frame.geometries.push(resource);
      }
      next.geometries.set(geometry.uuid, signature);
      return true;
    };
    // FPS standing/flat proxies are independent scene roots. Recover picking
    // metadata from the actual source Sprite, including when it is hidden.
    const proxyTiles = new Map<THREE.Object3D, [number, number]>();
    const uprightProxies = new Set<THREE.Object3D>();
    snapshot.scene.traverse((object) => {
      if (!(object instanceof THREE.Sprite)) return;
      const { tileX, tileY, fpsPitchLockedProxyMesh, flatBillboardProxyMesh } = object.userData;
      if (fpsPitchLockedProxyMesh instanceof THREE.Mesh && fpsPitchLockedProxyMesh.geometry instanceof THREE.PlaneGeometry) uprightProxies.add(fpsPitchLockedProxyMesh);
      if (!Number.isSafeInteger(tileX) || !Number.isSafeInteger(tileY)) return;
      for (const proxy of [fpsPitchLockedProxyMesh, flatBillboardProxyMesh]) {
        if (proxy instanceof THREE.Object3D) proxyTiles.set(proxy, [tileX as number, tileY as number]);
      }
    });
    snapshot.scene.traverseVisible((object) => {
      if (!object.layers.test(snapshot.camera.layers)) return;
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Sprite)) return;
      const descriptor: QuestSceneObject = {
        id: object.uuid, geometry: "", materials: [], matrix: object.matrixWorld.toArray(), renderOrder: object.renderOrder,
      };
      for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
        const { tileX, tileY } = ancestor.userData;
        if (Number.isSafeInteger(tileX) && Number.isSafeInteger(tileY)) {
          descriptor.tile = [tileX as number, tileY as number];
          break;
        }
      }
      descriptor.tile ??= proxyTiles.get(object);
      if (uprightProxies.has(object)) {
        // Standing sprite proxies must face the tracked headset, not the hidden page camera.
        descriptor.billboard = true;
        descriptor.upright = true;
      }
      if (object instanceof THREE.Sprite) {
        if (!object.material.visible || object.material.opacity <= 0) return;
        descriptor.geometry = spriteGeometryId;
        if (!next.geometries.has(spriteGeometryId) && !this.state.geometries.has(spriteGeometryId)) frame.geometries.push(spriteGeometry);
        next.geometries.set(spriteGeometryId, "1");
        descriptor.materials = [{ material: visitMaterial(object.material), start: 0, count: 6 }];
        descriptor.billboard = true;
        descriptor.center = object.center.toArray();
        descriptor.rotation = object.material.rotation;
      } else {
        const geometry = object.geometry;
        const position = geometry.getAttribute("position");
        if (!position || !visitGeometry(geometry)) return;
        descriptor.geometry = geometry.uuid;
        const indexCount = geometry.index?.count ?? position.count;
        const drawStart = Math.max(0, geometry.drawRange.start);
        const drawEnd = Math.min(indexCount, drawStart + geometry.drawRange.count);
        const allMaterials = Array.isArray(object.material) ? object.material : [object.material];
        const groups = Array.isArray(object.material)
          ? geometry.groups
          : [{ start: 0, count: indexCount, materialIndex: 0 }];
        for (const group of groups) {
          const material = allMaterials[group.materialIndex ?? 0];
          if (!material || !material.visible || material.opacity <= 0) continue;
          const start = Math.max(drawStart, group.start);
          const end = Math.min(drawEnd, group.start + group.count);
          if (end <= start) continue;
          descriptor.materials.push({ material: visitMaterial(material), start, count: end - start });
        }
        if (!descriptor.materials.length) return;
      }
      const signature = JSON.stringify(descriptor);
      next.objects.set(object.uuid, signature);
      if (this.state.objects.get(object.uuid) !== signature) frame.objects.push(descriptor);
    });
    frame.removed = [...this.state.objects.keys()].filter((id) => !next.objects.has(id));
    frame.removedGeometries = [...this.state.geometries.keys()].filter((id) => !next.geometries.has(id));
    frame.removedMaterials = [...this.state.materials.keys()].filter((id) => !next.materials.has(id));
    frame.removedTextures = [...this.state.textures.keys()].filter((id) => !next.textures.has(id));
    return { frame, next };
  }
}
