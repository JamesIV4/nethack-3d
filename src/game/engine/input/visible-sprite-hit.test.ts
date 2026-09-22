import * as THREE from "three";
import { expect, it } from "vitest";
import { VisibleSpriteHits } from "./visible-sprite-hit";
import { PointerTargeting, type PointerTargetingDependencies } from "./pointer-targeting";

it("applies flipY once, honors transformed UVs, opacity and alpha-test for sprite proxies", () => {
  const texture = new THREE.DataTexture(new Uint8Array([0,0,0,0, 0,0,0,128]), 1, 2);
  const proxy = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
  proxy.userData.isEntityBillboardProxy = true;
  const hits = new VisibleSpriteHits();
  const hit = (v: number) => hits.accepts({ object: proxy, uv: new THREE.Vector2(.5,v), distance: 1, point: new THREE.Vector3() });
  expect(hit(.25)).toBe(false); expect(hit(.75)).toBe(true);
  texture.flipY = true;
  expect(hit(.25)).toBe(true); expect(hit(.75)).toBe(false);
  proxy.material.alphaTest = .4; proxy.material.opacity = .5;
  expect(hit(.25)).toBe(false);
  proxy.material.opacity = 1; texture.offset.y = .5;
  expect(hit(.25)).toBe(false);
  proxy.material.visible = false;
  expect(hit(.75)).toBe(false);
});

it("Info picks the standing sprite's owning tile and passes transparent pixels to the floor", () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, .1, 100);
  camera.position.z = 3; camera.updateMatrixWorld();
  const texture = new THREE.DataTexture(new Uint8Array([0,0,0,255, 0,0,0,0]), 2, 1);
  const source = new THREE.Sprite(); source.visible = false;
  const proxy = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
  proxy.userData = { isEntityBillboardProxy: true, tileX: 12, tileY: 8 };
  source.userData.fpsPitchLockedProxyMesh = proxy;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20,20), new THREE.MeshBasicMaterial());
  floor.position.z = -1; floor.userData = { tileX: 20, tileY: 20 };
  scene.add(source, proxy, floor); scene.updateMatrixWorld(true);
  const target = new THREE.Mesh(); target.visible = false;
  const picker = new PointerTargeting({
    camera: { getActiveCamera: () => camera }, entityBillboards: { monsterBillboards: new Map([["12,8",source]]) },
    tileRendering: { tileMap: new Map([["12,8",target],["20,20",floor]]) },
    engineState: { clientOptions: { tilesetMode: "ascii" } },
    tileFaceTextureRotationDebug: { resolveTarget: () => null },
    tilesetAssets: { shouldUseVultureTiles: () => false },
  } as unknown as PointerTargetingDependencies);
  expect(picker.getTileTargetFromPointerNdc(-.2,0,true)?.key).toBe("12,8");
  expect(picker.getTileTargetFromPointerNdc(.2,0,true)?.key).toBe("20,20");
});
