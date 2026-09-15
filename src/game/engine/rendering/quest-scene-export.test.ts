import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  QuestSceneExporter,
  serializeQuestGeometry,
  serializeQuestTexture,
  type QuestSceneFrame,
  type QuestSceneSnapshot,
} from "./quest-scene-export";

async function settle(): Promise<void> {
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
}
function fixture(sendOverride?: (frame: QuestSceneFrame) => Promise<void>) {
  const frames: QuestSceneFrame[] = [];
  const textureEncoder = vi.fn((texture: THREE.Texture) => ({
    id: texture.uuid, dataUrl: "data:image/png;base64,dGVzdA==", flipY: texture.flipY,
    nearest: true, wrapS: texture.wrapS, wrapT: texture.wrapT,
  }));
  const transport = {
    available: vi.fn(() => true),
    send: vi.fn((frame: QuestSceneFrame) => { frames.push(frame); return sendOverride?.(frame) ?? Promise.resolve(); }),
    encodeTexture: textureEncoder,
    clear: vi.fn(),
    onError: vi.fn(),
  };
  const exporter = new QuestSceneExporter(transport);
  const snapshot: QuestSceneSnapshot = {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), player: [5, -8, 0], tileSize: 1,
  };
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  snapshot.scene.add(mesh);
  return { frames, transport, exporter, snapshot, mesh, geometry, material };
}

describe("Quest resolved scene export", () => {
  it("exports physical rectangular cell matrices with unchanged heights and logical picking metadata", async () => {
    const f = fixture();
    f.snapshot.scene.scale.x = 0.6;
    f.mesh.position.set(4, -6, 0.5);
    f.mesh.userData = { tileX: 4, tileY: 6 };
    f.exporter.update(f.snapshot, 0); await settle();
    expect(f.frames[0].worldScaleX).toBe(0.6);
    expect(f.frames[0].objects[0].matrix.slice(12, 15)).toEqual([2.4, -6, 0.5]);
    expect(f.frames[0].objects[0].tile).toEqual([4, 6]);
    const scale = new THREE.Vector3().setFromMatrixScale(new THREE.Matrix4().fromArray(f.frames[0].objects[0].matrix));
    expect(scale.toArray()).toEqual([0.6, 1, 1]);
    f.snapshot.scene.scale.x = 1;
    f.exporter.update(f.snapshot, 100); await settle();
    expect(f.frames[1].worldScaleX).toBe(1);
    expect(f.frames[1].objects[0].matrix.slice(12, 15)).toEqual([4, -6, 0.5]);
  });
  it("sends actual geometry, world transforms and camera pose once, then only changes", async () => {
    const f = fixture();
    f.mesh.position.set(3, -2, 0.5);
    f.snapshot.camera.position.set(1, 2, 3);
    f.exporter.update(f.snapshot, 0);
    await settle();
    expect(f.frames[0].reset).toBe(true);
    expect(f.frames[0].geometries[0].positions).toEqual(Array.from(f.geometry.attributes.position.array));
    expect(f.frames[0].objects[0].matrix.slice(12, 15)).toEqual([3, -2, 0.5]);
    expect(f.frames[0].camera.position).toEqual([1, 2, 3]);
    expect(f.frames[0].player).toEqual([5, -8, 0]);
    f.exporter.update(f.snapshot, 100);
    await settle();
    expect(f.frames).toHaveLength(1); // No idle JNI/geometry work on the headset.
    f.mesh.position.x = 4;
    f.exporter.update(f.snapshot, 200);
    await settle();
    expect(f.frames[1].reset).toBe(false);
    expect(f.frames[1].objects).toHaveLength(1);
    expect(f.frames[1].geometries).toEqual([]);
    expect(f.frames[1].materials).toEqual([]);
  });

  it("exports resources shared across meshes once and removes them only after their last user", async () => {
    const f = fixture();
    const second = new THREE.Mesh(f.geometry, f.material);
    f.snapshot.scene.add(second);
    f.exporter.update(f.snapshot, 0); await settle();
    expect(f.frames[0].geometries).toHaveLength(1);
    expect(f.frames[0].materials).toHaveLength(1);
    f.snapshot.scene.remove(f.mesh);
    f.exporter.update(f.snapshot, 100); await settle();
    expect(f.frames[1].removed).toEqual([f.mesh.uuid]);
    expect(f.frames[1].removedGeometries).toEqual([]);
    f.snapshot.scene.remove(second);
    f.exporter.update(f.snapshot, 200); await settle();
    expect(f.frames[2].removedGeometries).toEqual([f.geometry.uuid]);
    expect(f.frames[2].removedMaterials).toEqual([f.material.uuid]);
  });

  it("propagates parent visibility and camera layers without camera-frustum culling", async () => {
    const f = fixture();
    const parent = new THREE.Group();
    parent.add(f.mesh);
    f.snapshot.scene.add(parent);
    f.mesh.position.z = 100; // Behind the desktop camera, still required in VR.
    f.exporter.update(f.snapshot, 0); await settle();
    expect(f.frames[0].objects).toHaveLength(1);
    parent.visible = false;
    f.exporter.update(f.snapshot, 100); await settle();
    expect(f.frames[1].removed).toEqual([f.mesh.uuid]);
    parent.visible = true;
    f.mesh.layers.set(2);
    f.exporter.update(f.snapshot, 200); await settle();
    expect(f.frames[2].objects).toEqual([]);
  });

  it("preserves geometry material groups, draw ranges and hidden material slots", async () => {
    const f = fixture();
    const invisible = new THREE.MeshBasicMaterial({ visible: false });
    f.mesh.material = [f.material, invisible] as unknown as THREE.MeshBasicMaterial;
    f.geometry.clearGroups();
    f.geometry.addGroup(0, 6, 0);
    f.geometry.addGroup(6, 6, 1);
    f.geometry.setDrawRange(3, 9);
    f.exporter.update(f.snapshot, 0); await settle();
    expect(f.frames[0].objects[0].materials).toEqual([{ material: f.material.uuid, start: 3, count: 3 }]);
    expect(f.frames[0].materials).toHaveLength(1);
  });

  it("preserves normalized interleaved vertex attributes and generates missing normals without mutating source", () => {
    const geometry = new THREE.BufferGeometry();
    const data = new THREE.InterleavedBuffer(new Float32Array([0, 0, 0, 99, 1, 0, 0, 99, 0, 1, 0, 99]), 4);
    geometry.setAttribute("position", new THREE.InterleavedBufferAttribute(data, 3, 0));
    geometry.setAttribute("color", new THREE.Uint8BufferAttribute([255, 0, 128, 0, 255, 0, 0, 0, 255], 3, true));
    const resource = serializeQuestGeometry(geometry)!;
    expect(resource.positions).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(resource.normals).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    expect(resource.colors!.slice(0, 4)).toEqual([1, 0, 128 / 255, 1]);
    expect(geometry.getAttribute("normal")).toBeUndefined();
  });

  it("resends a geometry when its attribute changes version or is replaced", async () => {
    const f = fixture();
    f.exporter.update(f.snapshot, 0); await settle();
    f.geometry.attributes.position.setX(0, 9);
    f.geometry.attributes.position.needsUpdate = true;
    f.exporter.update(f.snapshot, 100); await settle();
    expect(f.frames[1].geometries[0].positions[0]).toBe(9);
    f.geometry.setAttribute("position", f.geometry.attributes.position.clone());
    f.exporter.update(f.snapshot, 200); await settle();
    expect(f.frames[2].geometries).toHaveLength(1);
  });

  it("copies a texture once/version while retaining changing atlas UV transforms and cleanup", async () => {
    const f = fixture();
    const texture = new THREE.Texture();
    texture.repeat.set(0.1, 0.2);
    texture.offset.set(0.3, 0.4);
    f.material.map = texture;
    f.exporter.update(f.snapshot, 0); await settle();
    expect(f.frames[0].materials[0].uvTransform).toEqual(texture.matrix.toArray());
    f.exporter.update(f.snapshot, 100); await settle();
    expect(f.transport.encodeTexture).toHaveBeenCalledTimes(1);
    texture.offset.x = 0.8;
    f.exporter.update(f.snapshot, 200); await settle();
    expect(f.frames[1].textures).toEqual([]);
    expect(f.frames[1].materials[0].uvTransform![6]).toBe(0.8);
    texture.needsUpdate = true;
    f.exporter.update(f.snapshot, 300); await settle();
    expect(f.transport.encodeTexture).toHaveBeenCalledTimes(2);
    f.material.map = null;
    f.exporter.update(f.snapshot, 400); await settle();
    expect(f.frames[3].removedTextures).toEqual([texture.uuid]);
  });

  it("serializes CanvasTextures without resizing or changing alpha/orientation metadata", () => {
    const canvas = { width: 4096, height: 1024, toDataURL: vi.fn(() => "data:image/png;base64,cG5n") };
    const texture = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
    texture.magFilter = THREE.NearestFilter;
    texture.flipY = false;
    expect(serializeQuestTexture(texture)).toMatchObject({ id: texture.uuid, flipY: false, nearest: true, dataUrl: "data:image/png;base64,cG5n" });
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/png");
  });

  it("exports sprite billboard size, rotation, center and authoritative ancestral tile metadata", async () => {
    const f = fixture();
    f.snapshot.scene.remove(f.mesh);
    const group = new THREE.Group();
    group.userData.tileX = 8; group.userData.tileY = 12;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ rotation: 0.3 }));
    sprite.center.set(0.2, 0.9);
    sprite.scale.set(2, 3, 1);
    group.add(sprite); f.snapshot.scene.add(group);
    f.exporter.update(f.snapshot, 0); await settle();
    expect(f.frames[0].objects[0]).toMatchObject({ billboard: true, tile: [8, 12], center: [0.2, 0.9], rotation: 0.3 });
    expect(f.frames[0].geometries[0].indices).toHaveLength(6);
  });

  it("allows only one in-flight frame and exports current state after acknowledgement", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    const f = fixture(() => pending);
    f.exporter.update(f.snapshot, 0);
    f.mesh.position.x = 7;
    f.exporter.update(f.snapshot, 100);
    expect(f.frames).toHaveLength(1);
    resolve(); await settle();
    f.exporter.update(f.snapshot, 200); await settle();
    expect(f.frames).toHaveLength(2);
    expect(f.frames[1].objects[0].matrix[12]).toBe(7);
  });

  it("recovers a rejected native transfer with a complete scene snapshot", async () => {
    let rejectFrame = false;
    const f = fixture(() => rejectFrame ? Promise.reject(new Error("Native restarted")) : Promise.resolve());
    f.exporter.update(f.snapshot, 0); await settle();
    rejectFrame = true;
    f.mesh.position.x = 1;
    f.exporter.update(f.snapshot, 100); await settle();
    rejectFrame = false;
    f.exporter.update(f.snapshot, 200); await settle();
    expect(f.frames[2].reset).toBe(true);
    expect(f.frames[2].geometries).toHaveLength(1);
    expect(f.frames[2].objects).toHaveLength(1);
  });

  it("invalidates a native reset even when an older frame acknowledges afterward", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    const f = fixture(() => pending);
    f.exporter.update(f.snapshot, 0);
    f.exporter.invalidate();
    resolve(); await settle();
    f.exporter.update(f.snapshot, 100); await settle();
    expect(f.frames[1].reset).toBe(true);
    expect(f.frames[1].geometries).toHaveLength(1);
    expect(f.frames[1].objects).toHaveLength(1);
  });

  it("exports authoritative source tile metadata for separate FPS sprite proxies", async () => {
    const f = fixture();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
    sprite.visible = false;
    sprite.userData.tileX = 9; sprite.userData.tileY = 14;
    sprite.userData.fpsPitchLockedProxyMesh = f.mesh;
    f.snapshot.scene.add(sprite);
    f.exporter.update(f.snapshot, 0); await settle();
    expect(f.frames[0].objects[0].tile).toEqual([9, 14]);
  });

  it("still sends camera, player and lighting changes when mesh resources are idle", async () => {
    const f = fixture();
    f.exporter.update(f.snapshot, 0); await settle();
    f.snapshot.camera.position.x = 2;
    f.exporter.update(f.snapshot, 100); await settle();
    expect(f.frames[1].camera.position[0]).toBe(2);
    expect(f.frames[1].objects).toEqual([]);
    f.snapshot.player = [6, -8, 0];
    f.exporter.update(f.snapshot, 200); await settle();
    expect(f.frames[2].player).toEqual([6, -8, 0]);
    f.snapshot.lighting = { center: [6, -8, 0], radius: 10, falloffPower: 2, maxDarkAlpha: 0.8, isFpsMode: true };
    f.exporter.update(f.snapshot, 300); await settle();
    expect(f.frames[3].lighting?.radius).toBe(10);
    f.exporter.update(f.snapshot, 400); await settle();
    expect(f.frames).toHaveLength(4);
  });

  it("tracks standing FPS proxies in VR while retaining flat decal orientation", async () => {
    const f = fixture();
    f.snapshot.scene.remove(f.mesh);
    const standing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), f.material);
    const ground = new THREE.Mesh(standing.geometry, f.material);
    ground.rotation.x = Math.PI / 2;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
    sprite.visible = false;
    sprite.userData.tileX = 9; sprite.userData.tileY = 14;
    sprite.userData.fpsPitchLockedProxyMesh = standing;
    sprite.userData.flatBillboardProxyMesh = ground;
    f.snapshot.scene.add(sprite, standing, ground);
    f.exporter.update(f.snapshot, 0); await settle();
    expect(f.frames[0].objects.find((object) => object.id === standing.uuid)).toMatchObject({ billboard: true, upright: true, tile: [9, 14] });
    const groundResource = f.frames[0].objects.find((object) => object.id === ground.uuid)!;
    expect(groundResource.billboard).toBeUndefined();
    expect(groundResource.matrix).toEqual(ground.matrixWorld.toArray());
  });
  it("throttles captures, remains inactive outside native Quest and clears its own session on disposal", async () => {
    const f = fixture();
    f.transport.available.mockReturnValue(false);
    f.exporter.update(f.snapshot, 0);
    expect(f.frames).toEqual([]);
    f.transport.available.mockReturnValue(true);
    f.exporter.update(f.snapshot, 1); await settle();
    f.exporter.update(f.snapshot, 2); await settle();
    expect(f.frames).toHaveLength(1);
    f.exporter.dispose();
    expect(f.transport.clear).toHaveBeenCalledWith(f.frames[0].session);
    f.exporter.update(f.snapshot, 1000); await settle();
    expect(f.frames).toHaveLength(1);
  });
});
