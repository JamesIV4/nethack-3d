import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
vi.mock("../../ui-types", () => ({ nh3dFpsLookSensitivityMax: 5, nh3dFpsLookSensitivityMin: .1 }));
import { Camera, type CameraDependencies } from "../camera/camera";
import { XrFarLook } from "./xr-far-look";
import { createTrackingToGame } from "./webxr-rig";

function fixture(width = 1) {
  const selection = { positionInputModeActive: true, positionCursor: { x: 3, y: 5 },
    positionCursorColumnHeight: 1, isFpsFarLookViewActive: () => selection.positionInputModeActive };
  const camera = new Camera({
    positionSelection: selection, movementInput: { isFpsMode: () => true },
    terminalRendering: { isTerminalDisplayMode: () => false },
    playerMovement: { playerPos: { x: 3, y: 5 } }, tileRendering: { tileMap: new Map() },
    tileUpdates: { pendingTileUpdates: new Map() },
  } as unknown as CameraDependencies);
  camera.camera = new THREE.PerspectiveCamera(); camera.camera.up.set(0, 0, 1);
  camera.cameraYaw = camera.fpsPositionCursorEntryCameraYaw = camera.fpsPositionCursorOrbitYaw = Math.PI;
  camera.cameraPitch = camera.fpsPositionCursorEntryCameraPitch = 0;
  camera.fpsPositionCursorOrbitPitch = Math.PI / 4;
  const player = new THREE.Vector3(3, -5, 0), scene = new THREE.Matrix4().makeScale(width, 1, 1);
  const head = new THREE.Vector3(0, 1.6, 0);
  const base = createTrackingToGame("first-person", player.clone().applyMatrix4(scene), head,
    new THREE.Quaternion(), 1, camera.firstPersonEyeHeight).matrix;
  const farLook = new XrFarLook();
  const tick = () => {
    farLook.prepare(camera, selection.positionInputModeActive, player);
    camera.updateCamera(1 / 72);
    farLook.prepare(camera, selection.positionInputModeActive, player);
    const rig = base.clone(); farLook.apply(camera, rig, scene, player); return rig;
  };
  const close = () => {
    selection.positionInputModeActive = false; camera.fpsPositionCursorReturnActive = true;
    camera.fpsPositionCursorCameraInitialized = false;
    // PositionSelection seeds these from the live tracked view on cancel/confirm.
    camera.fpsPositionCursorCameraCurrent.set(99, 88, 77);
    camera.fpsPositionCursorLookCurrent.set(12, 13, 14);
  };
  return { camera, selection, player, scene, head, base, farLook, tick, close };
}

describe("XR far-look uses the desktop animation", () => {
  it("turns around the selection column rather than the player and restores the original rig", () => {
    const f=fixture();f.selection.positionCursor={x:8,y:7};
    let before=f.tick();for(let i=0;i<140;i++)before=f.tick();
    const pivot=new THREE.Vector3(8,-7,0),eye=f.head.clone().applyMatrix4(before);
    const distance=eye.clone().setZ(0).distanceTo(pivot);
    f.farLook.turn(f.camera,Math.PI/2,f.selection.positionCursor,1);
    const after=f.base.clone();f.farLook.apply(f.camera,after,f.scene,f.player);
    const next=f.head.clone().applyMatrix4(after);
    expect(next.clone().setZ(0).distanceTo(pivot)).toBeCloseTo(distance);
    const expected=eye.clone().sub(pivot).applyAxisAngle(new THREE.Vector3(0,0,1),-Math.PI/2).add(pivot);
    expect(next.distanceTo(expected)).toBeLessThan(1e-8);
    const up=new THREE.Vector3(0,1,0).transformDirection(after);
    expect(up.z).toBeCloseTo(1);
    f.close();let returned=after;for(let i=0;i<140;i++)returned=f.tick();
    expect(returned.elements).toEqual(f.base.elements);
  });
  it.each([0, .7, 1, 2.4, -1, -2.4, 3.1])("pulls away along the nearest grid axis at heading %s without tilting the world", yaw => {
    const f = fixture();
    f.camera.fpsPositionCursorEntryCameraYaw = yaw;
    f.camera.fpsPositionCursorEntryCameraPitch = .65;
    let rig = f.tick();
    expect(f.camera.fpsPositionCursorOrbitYaw).toBe(Math.round(yaw / (Math.PI / 2)) * Math.PI / 2);
    for (let i = 0; i < 140; i++) {
      rig = f.tick();
      // The full linear transform is unchanged: no pitch, roll, yaw or scale animation.
      for (const index of [0,1,2,4,5,6,8,9,10]) expect(rig.elements[index]).toBe(f.base.elements[index]);
    }
    const delta = f.head.clone().applyMatrix4(rig).sub(f.head.clone().applyMatrix4(f.base));
    const away = new THREE.Vector3(Math.sin(yaw), Math.cos(yaw), 0);
    expect(delta.dot(away)).toBeGreaterThan(0);
    expect(Math.min(Math.abs(delta.x), Math.abs(delta.y))).toBeLessThan(1e-8);
    f.close();
    for (let i = 0; i < 120; i++) rig = f.tick();
    expect(rig.elements).toEqual(f.base.elements);
  });
  it.each([1, .6])("pulls back, follows the cursor and returns with cell width %s", width => {
    const f = fixture(width);
    const start = f.head.clone().applyMatrix4(f.base);
    let rig = f.tick();
    expect(f.head.clone().applyMatrix4(rig).distanceTo(start)).toBeGreaterThan(.1);
    for (let i = 0; i < 100; i++) rig = f.tick();
    expect(f.head.clone().applyMatrix4(rig).distanceTo(
      f.camera.fpsPositionCursorCameraCurrent.clone().applyMatrix4(f.scene))).toBeLessThan(1e-8);
    const prior = f.head.clone().applyMatrix4(rig);
    f.selection.positionCursor.x += 3;
    for (let i = 0; i < 100; i++) rig = f.tick();
    expect(f.head.clone().applyMatrix4(rig).x - prior.x).toBeCloseTo(3 * width, 2);
    const virtualPosition = f.camera.fpsPositionCursorCameraCurrent.clone();
    f.close(); f.farLook.prepare(f.camera, false, f.player);
    expect(f.camera.fpsPositionCursorCameraCurrent).toEqual(virtualPosition);
    for (let i = 0; i < 120; i++) rig = f.tick();
    expect(f.camera.fpsPositionCursorReturnActive).toBe(false);
    expect(f.farLook.active).toBe(false);
    expect(rig.elements).toEqual(f.base.elements);
  });

  it("preserves roomscale motion without feeding the rendered pose into the orbit or return", () => {
    const f = fixture(), movedHead = f.head.clone().add(new THREE.Vector3(.3, -.1, .2));
    let rig = f.tick();
    const delta = movedHead.clone().applyMatrix4(rig).sub(f.head.clone().applyMatrix4(rig));
    expect(delta.length()).toBeCloseTo(movedHead.distanceTo(f.head) * f.camera.firstPersonEyeHeight / 1.6);
    const before = rig.clone();
    // The pre-input and post-animation XR updates may also repeat without a new desktop tick.
    f.camera.camera.position.copy(movedHead).applyMatrix4(rig);
    f.camera.camera.rotateZ(.7);
    f.farLook.prepare(f.camera, true, f.player);
    rig = f.base.clone(); f.farLook.apply(f.camera, rig, f.scene, f.player);
    expect(rig.elements).toEqual(before.elements);
    f.close();
    for (let i = 0; i < 120; i++) rig = f.tick();
    expect(movedHead.clone().applyMatrix4(rig)).toEqual(movedHead.clone().applyMatrix4(f.base));
  });

  it("can reenter during the return without reseeding from the headset", () => {
    const f = fixture(); for (let i = 0; i < 30; i++) f.tick();
    f.close(); f.tick();
    const before = f.camera.fpsPositionCursorCameraCurrent.clone();
    f.selection.positionInputModeActive = true;
    f.camera.fpsPositionCursorReturnActive = false;
    f.camera.fpsPositionCursorCameraInitialized = false;
    f.farLook.prepare(f.camera, true, f.player);
    expect(f.camera.fpsPositionCursorCameraCurrent).toEqual(before);
  });
});
