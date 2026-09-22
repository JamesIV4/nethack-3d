import * as THREE from "three";
import { expect, it } from "vitest";
import { EntityBillboards, type EntityBillboardsDependencies } from "./entity-billboards";

it("uses virtual-eye sprites for XR far-look and restores grid-facing loot after return", () => {
  let selecting = false;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(); camera.position.set(0, -4, 2);
  const deps = {
    camera: { camera, cameraYaw: 0, fpsPositionCursorReturnActive: false },
    movementInput: { isFpsMode: () => true },
    engineState: { clientOptions: { fpsFlattenEntityBillboards: false } },
    positionSelection: { isFpsFarLookViewActive: () => selecting },
    renderPipeline: { scene, renderer: { xr: { isPresenting: true } } },
    playerMovement: { hasSeenPlayerPosition: true, playerPos: { x: 1, y: 1 }, fpsLastPlayerMoveFromTile: { x: 0, y: 1 } },
    tilesetAssets: { shouldUseVultureTiles: () => false, getWorldTileScaleX: () => 1 },
    lighting: { patchMaterialForVignette() {} },
  } as unknown as EntityBillboardsDependencies;
  const owner = new EntityBillboards(deps), sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  sprite.userData.tileX = 1; sprite.userData.tileY = 1; scene.add(sprite);
  sprite.position.set(1, -1, .1);
  const update = () => owner.updateMonsterBillboardPitchLockStateForEntry(sprite);
  update(); expect(sprite.visible).toBe(false);
  expect(owner.getMonsterBillboardPitchLockedProxyMesh(sprite)?.visible).toBe(true);
  const proxy = owner.getMonsterBillboardPitchLockedProxyMesh(sprite)!;
  expect(proxy.position.x).toBeCloseTo(1 + owner.fpsPlayerTileBillboardSideNudge);
  const originalRotation = proxy.quaternion.clone(), originalPosition = proxy.position.clone();
  camera.position.set(8, 9, 10); camera.rotateZ(.8); update();
  expect(proxy.quaternion.toArray()).toEqual(originalRotation.toArray());
  expect(proxy.position).toEqual(originalPosition);
  expect(new THREE.Vector3(0, 1, 0).applyQuaternion(proxy.quaternion).z).toBeCloseTo(1);
  selecting = true; update();
  expect(sprite.visible).toBe(true);
  expect(owner.getMonsterBillboardPitchLockedProxyMesh(sprite)).toBeNull();
  selecting = false; deps.camera.fpsPositionCursorReturnActive = true; update();
  expect(sprite.visible).toBe(true);
  deps.camera.fpsPositionCursorReturnActive = false; update();
  expect(sprite.visible).toBe(false);
  // Flat FPS retains its existing far-look presentation.
  deps.renderPipeline.renderer.xr.isPresenting = false; selecting = true; update();
  expect(sprite.visible).toBe(false);
  selecting = false; update();
  expect(owner.getMonsterBillboardPitchLockedProxyMesh(sprite)!.position).toEqual(originalPosition);
  deps.engineState.clientOptions.fpsFlattenEntityBillboards = true; update();
  expect(owner.getMonsterBillboardPitchLockedProxyMesh(sprite)).toBeNull();
  expect(sprite.position.toArray()).toEqual([1, -1, .1]);
  owner.disposeMonsterBillboardPitchLockedProxyMesh(sprite);
  owner.fpsPitchLockedBillboardGeometry.dispose(); sprite.material.dispose();
});
