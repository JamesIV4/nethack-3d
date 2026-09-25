import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebXrPresentation, type WebXrPresentationDependencies } from "./webxr-presentation";
import { getWebXrState, toggleWebXr, recenterWebXr } from "../../../quest/webxr/presentation";
import type { TableMoveHandle } from "../../../quest/webxr/table-move-handle";
import { Minimap, type MinimapDependencies } from "../ui/minimap";
import { TILE_SIZE } from "../../constants";
import { setXrSettings } from "../../../quest/webxr/settings";
import { gridUiHeading } from "../../../quest/webxr/grid-ui-heading";
vi.mock("../../../quest/webxr/controller-input", () => ({ WebXrControllerInput: class { update() {} dispose() {} } }));
vi.mock("../../../quest/webxr/html-ui-panel", () => ({ HtmlUiPanel: class { recenter() {} setFirstPersonAnchor = vi.fn(); followViewer() {} update() {} dispose() {} } }));
vi.mock("../../../quest/webxr/menu-rain", () => ({ MenuRain: class {
  scene = new THREE.Scene(); recenter() {} update() {} reset() {} dispose() {}
} }));
afterEach(() => vi.unstubAllGlobals());

function fixture(native = false) {
  setXrSettings({fpsMode:false});
  const classes = new Set<string>();
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible", exitPointerLock: vi.fn(), documentElement: { classList: {
    add: (value: string) => classes.add(value), remove: (value: string) => classes.delete(value),
    contains: (value: string) => classes.has(value),
    toggle: (value: string, enabled: boolean) => enabled ? classes.add(value) : classes.delete(value),
  } } }));
  vi.stubGlobal("location", new URL(native ? "http://127.0.0.1:18973/" : "http://127.0.0.1/?xrHost=wired"));
  const session = new EventTarget() as EventTarget & { end: () => Promise<void>; environmentBlendMode: string };
  session.environmentBlendMode = "opaque";
  session.end = async () => { renderer.xr.isPresenting = false; session.dispatchEvent(new Event("end")); };
  const requestSession = vi.fn(async () => session);
  vi.stubGlobal("navigator", { userActivation: { isActive: true }, xr: Object.assign(new EventTarget(), { isSessionSupported: async () => true, requestSession }) });
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  scene.add(mesh);
  const styleValues = new Map<string, string>([["display", "block"]]);
  const style = {
    getPropertyValue: (key: string) => styleValues.get(key) ?? "",
    getPropertyPriority: () => "",
    setProperty: (key: string, value: string) => { styleValues.set(key, value); },
    removeProperty: (key: string) => { styleValues.delete(key); },
  };
  const referenceSpace = new EventTarget();
  Object.assign(session, {requestReferenceSpace: vi.fn(async () => referenceSpace)});
  const renderer = {
    domElement: { style },
    render: vi.fn(), clear: vi.fn(), clippingPlanes: [] as THREE.Plane[],
    getClearColor: (value: THREE.Color) => value.set(0x123456), getClearAlpha: () => 1, setClearColor: vi.fn(),
    xr: {
      enabled: false, isPresenting: false, setReferenceSpaceType: vi.fn(), setFramebufferScaleFactor: vi.fn(), setReferenceSpace: vi.fn(),
      setSession: vi.fn(async () => { renderer.xr.isPresenting = true; }),
      getReferenceSpace: () => referenceSpace as XRReferenceSpace,
      getFrame: () => ({ getViewerPose: () => ({ transform: {
        position: { x: 0, y: 1.6, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 },
      } }) }),
      updateCamera: vi.fn(), getCamera: () => new THREE.ArrayCamera(),
    },
  };
  const deps = {
    aimHighlights: {setXrTarget:vi.fn()},
    entityBillboards: { monsterBillboards: new Map() },
    positionSelection: { isFpsFarLookViewActive: () => false },
    camera: { camera: new THREE.PerspectiveCamera(), cameraYaw: 2, cameraPitch: 0.4, firstPersonEyeHeight: 0.62, sampleFpsStepCameraGroundPosition: () => false, getOverheadCameraFollowTargetWorldPosition: () => ({ x: 3, y: -5 }), applyStandardCameraPresetForTopDownModes: vi.fn() },
    engineState: { clientOptions: { vrPassthrough: false, fpsMode: false }, characterCreationConfig: {playMode:"normal"}, playMode: "normal", disposed: false },
    playerMovement: { playerPos: { x: 3, y: 5 } }, renderPipeline: { scene, renderer },
    heldWeapon: { fpsHeldWeaponMesh: null },
    tileRendering: { tileMap: new Map(), floorGeometry: new THREE.PlaneGeometry() }, glyphTextures: { glyphOverlayMap: new Map() },
  } as unknown as WebXrPresentationDependencies;
  Object.assign(deps, { coordinator: { applyPlayMode: vi.fn((mode: "fps" | "normal") => { deps.engineState.playMode=mode; }) } });
  Object.assign(deps.camera, {
    snapFpsStepToPlayer: vi.fn(),
    cameraPanX: 0, cameraPanY: 0, cameraPanTargetX: 0, cameraPanTargetY: 0, isCameraCenteredOnPlayer: true,
    getOverheadCameraFollowTargetWorldPosition: () => ({ x: deps.playerMovement.playerPos.x + deps.camera.cameraPanX, y: -deps.playerMovement.playerPos.y + deps.camera.cameraPanY }),
  });
  const presentation = new WebXrPresentation(deps);
  return { presentation, deps, renderer, scene, mesh, classes, session, requestSession, styleValues,
    frame: () => { const camera = presentation.prepareRender(); if (camera) presentation.render(camera); return !!camera; } };
}
describe("Three.js owns the Quest world", () => {
  it("does not dirty native UI layout with unchanged per-frame class writes", async () => {
    const f=fixture();
    const toggle=vi.spyOn(document.documentElement.classList,"toggle");
    f.presentation.start(); await Promise.resolve(); await toggleWebXr();
    f.presentation.updateCamera(); toggle.mockClear();
    f.presentation.updateCamera(); f.presentation.updateCamera();
    expect(toggle).not.toHaveBeenCalledWith("nh3d-xr-first-person",false);
    setXrSettings({fpsMode:true}); f.presentation.updateCamera();
    expect(toggle).toHaveBeenCalledWith("nh3d-xr-first-person",true);
    toggle.mockClear(); f.presentation.updateCamera();
    expect(toggle).not.toHaveBeenCalledWith("nh3d-xr-first-person",true);
    f.presentation.dispose();
  });
  it("defaults immersive FPS independently, preserves a tabletop choice, and restores flat view",async()=>{
    const f=fixture();setXrSettings({fpsMode:true});
    f.presentation.setStartupMenu(true);
    f.presentation.start();await Promise.resolve();await toggleWebXr();f.presentation.updateCamera();
    f.presentation.setStartupMenu(false);f.presentation.updateCamera();
    expect(f.deps.engineState.playMode).toBe("fps");
    expect(f.deps.engineState.clientOptions.fpsMode).toBe(false);
    setXrSettings({fpsMode:false});f.presentation.updateCamera();
    expect(f.deps.engineState.playMode).toBe("normal");
    f.presentation.setStartupMenu(true);f.presentation.setStartupMenu(false);f.presentation.updateCamera();
    expect(f.deps.engineState.playMode).toBe("normal");
    setXrSettings({fpsMode:true});f.presentation.updateCamera();
    await toggleWebXr();expect(f.deps.engineState.playMode).toBe("normal");
    f.presentation.dispose();
  });
  it("waits for a valid floor pose and recalibrates on late player/scene initialization and both reset paths",async()=>{
    const f=fixture();setXrSettings({fpsMode:true,fpsScale:1.5});
    const pose={emulatedPosition:true,transform:{position:{x:0,y:0,z:0},orientation:new THREE.Quaternion()}};
    f.renderer.xr.getFrame=()=>({getViewerPose:()=>pose});
    f.deps.playerMovement.hasSeenPlayerPosition=false;
    f.presentation.start();await Promise.resolve();await toggleWebXr();
    const owner=f.presentation as unknown as {needsRecenter:boolean;anchor:THREE.Vector3};
    f.presentation.updateCamera();expect(owner.needsRecenter).toBe(true);
    f.frame();expect(f.renderer.clear).toHaveBeenCalledOnce();expect(f.renderer.render).not.toHaveBeenCalled();
    pose.emulatedPosition=false;pose.transform.position.y=1.2;
    f.presentation.updateCamera();expect(owner.anchor.y).toBe(1.2);
    f.scene.scale.x=.6;f.deps.playerMovement.playerPos={x:19,y:13};
    f.deps.playerMovement.hasSeenPlayerPosition=true;pose.transform.position.y=1.8;
    f.presentation.updateCamera();expect(owner.anchor.y).toBe(1.8);
    const root=f.scene.getObjectByName("WebXR tracking space")!;
    const check=()=>{
      const floor=new THREE.Vector3(19*TILE_SIZE,-13*TILE_SIZE,0).applyMatrix4(f.scene.matrixWorld).applyMatrix4(root.matrixWorld.clone().invert());
      expect(floor.y).toBeCloseTo(0);
      expect(new THREE.Vector3().setFromMatrixScale(root.matrixWorld).x).toBeCloseTo(1/(1.8/.62*1.5));
    };
    check();
    for (const reset of [()=>recenterWebXr(),()=>f.renderer.xr.getReferenceSpace().dispatchEvent(new Event("reset"))]) {
      owner.anchor.y=8;root.matrix.makeScale(9,9,9);root.updateMatrixWorld(true);
      reset();await Promise.resolve();await Promise.resolve();await Promise.resolve();pose.emulatedPosition=true;f.presentation.updateCamera();expect(owner.needsRecenter).toBe(true);
      pose.emulatedPosition=false;f.presentation.updateCamera();check();expect(owner.anchor.y).toBe(1.8);
    }
    f.presentation.dispose();setXrSettings({fpsScale:1});
  });
  it("ignores a late floor-reference refresh after its session ends",async()=>{
    const f=fixture();
    let resolve!: (space:XRReferenceSpace)=>void;
    Object.assign(f.session,{requestReferenceSpace:()=>new Promise<XRReferenceSpace>(done=>{resolve=done;})});
    f.presentation.start();await Promise.resolve();await toggleWebXr();f.presentation.updateCamera();
    recenterWebXr();await toggleWebXr();await toggleWebXr();
    resolve(new EventTarget() as XRReferenceSpace);
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    expect(f.renderer.xr.setReferenceSpace).not.toHaveBeenCalled();
    f.presentation.updateCamera();expect(f.presentation.active).toBe(true);
    f.presentation.dispose();
  });
  it("holds the tabletop heading until its grab bar is held, then keeps the released heading", async () => {
    const f = fixture();
    const head = { position: { x: 0, y: 1.6, z: 0 }, orientation: new THREE.Quaternion() };
    f.renderer.xr.getFrame = () => ({ getViewerPose: () => ({ transform: head }) });
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    const owner = f.presentation as unknown as { tableHeading: THREE.Quaternion; tableMove: TableMoveHandle };
    const initial = owner.tableHeading.toArray();
    head.position.x = .8; f.presentation.updateCamera();
    expect(owner.tableHeading.toArray()).toEqual(initial);
    const hand = {} as XRInputSource;
    owner.tableMove.begin(hand,new THREE.Vector3()); f.presentation.updateCamera();
    expect(owner.tableHeading.toArray()).not.toEqual(initial);
    const held = owner.tableHeading.toArray();
    owner.tableMove.end(hand); head.position.x = -.8; f.presentation.updateCamera();
    expect(owner.tableHeading.toArray()).toEqual(held);
    recenterWebXr(); await Promise.resolve();await Promise.resolve();await Promise.resolve(); f.presentation.updateCamera();
    expect(owner.tableHeading.toArray()).toEqual(initial);
    f.presentation.dispose();
  });
  it("applies FPS scale live and restores the original rig at 100 percent", async () => {
    const f = fixture(); f.deps.engineState.playMode = "fps"; setXrSettings({fpsMode:true});
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    const root = f.scene.getObjectByName("WebXR tracking space")!;
    const baseline = root.matrixWorld.clone(), eye = f.deps.camera.camera.position.clone();
    setXrSettings({ fpsScale: .5 }); f.presentation.updateCamera();
    expect(new THREE.Vector3().setFromMatrixScale(root.matrixWorld).x).toBeCloseTo(new THREE.Vector3().setFromMatrixScale(baseline).x * 2);
    expect(f.deps.camera.camera.position.z).toBeCloseTo(eye.z * 2);
    setXrSettings({ fpsScale: 2 }); f.presentation.updateCamera();
    expect(new THREE.Vector3().setFromMatrixScale(root.matrixWorld).x).toBeCloseTo(new THREE.Vector3().setFromMatrixScale(baseline).x / 2);
    setXrSettings({ fpsScale: 1 }); f.presentation.updateCamera();
    expect(root.matrixWorld.elements).toEqual(baseline.elements);
    f.presentation.dispose();
  });
  it.each([.5,1,2])("anchors the dungeon to local-floor on FPS entry, recenter and re-entry at scale %s",async fpsScale=>{
    const f=fixture();
    const head={position:{x:1,y:1.25,z:2},orientation:new THREE.Quaternion()};
    f.renderer.xr.getFrame=()=>({getViewerPose:()=>({transform:head})});
    setXrSettings({fpsScale});
    const floorHeight=()=>{
      const tracking=f.scene.getObjectByName("WebXR tracking space")!;
      const player=f.deps.playerMovement.playerPos;
      return new THREE.Vector3(player.x*TILE_SIZE,-player.y*TILE_SIZE,0)
        .applyMatrix4(f.scene.matrixWorld).applyMatrix4(tracking.matrixWorld.clone().invert()).y;
    };
    try {
      f.presentation.start();await Promise.resolve();await toggleWebXr();
      f.presentation.updateCamera(); // Enter FPS from an existing tabletop session.
      f.deps.engineState.playMode="fps";setXrSettings({fpsMode:true});f.presentation.updateCamera();
      expect(floorHeight()).toBeCloseTo(0);
      head.position.y=.7;f.presentation.updateCamera(); // Crouching must not lift the floor.
      expect(floorHeight()).toBeCloseTo(0);
      recenterWebXr();await Promise.resolve();await Promise.resolve();await Promise.resolve();f.presentation.updateCamera();expect(floorHeight()).toBeCloseTo(0);
      await toggleWebXr();head.position.y=1.8;await toggleWebXr();f.presentation.updateCamera();
      expect(floorHeight()).toBeCloseTo(0);
      expect(f.renderer.xr.setReferenceSpaceType).toHaveBeenCalledWith("local-floor");
    } finally { f.presentation.dispose();setXrSettings({fpsScale:1}); }
  });
  it("faces the virtual eye during far-look and the upright player grid after return", async () => {
    const f = fixture(); f.deps.engineState.playMode = "fps"; setXrSettings({fpsMode:true});
    const camera = f.deps.camera;
    Object.assign(camera, {
      fpsPositionCursorCameraCurrent: new THREE.Vector3(), fpsPositionCursorLookCurrent: new THREE.Vector3(),
      fpsPositionCursorCameraInitialized: false, fpsPositionCursorReturnActive: false,
      fpsPositionCursorEntryCameraYaw: Math.PI, fpsPositionCursorEntryCameraPitch: 0,
      positionCursorFarLookOrbitDistance: 4.4,
    });
    let selecting = false;
    f.deps.positionSelection.isFpsFarLookViewActive = () => selecting;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial()); f.scene.add(sprite);
    const head = { position: { x: 0, y: 1.6, z: 0 }, orientation: new THREE.Quaternion() };
    f.renderer.xr.getFrame = () => ({ getViewerPose: () => ({ transform: head }) });
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    const root = f.scene.getObjectByName("WebXR tracking space")!;
    const baseline = root.matrixWorld.clone();
    selecting = true; f.presentation.updateCamera();
    // The same state vectors that the desktop camera updates every frame.
    camera.fpsPositionCursorCameraCurrent.set(3, -8, 3);
    camera.fpsPositionCursorLookCurrent.set(3, -5, .5);
    f.presentation.updateCamera(); f.presentation.prepareRender();
    expect(camera.camera.position.distanceTo(new THREE.Vector3(3, -8, 3))).toBeLessThan(1e-8);
    const shader = { vertexShader: THREE.ShaderLib.sprite.vertexShader, uniforms: {} } as Parameters<THREE.Material["onBeforeCompile"]>[0];
    sprite.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.uniforms.nh3dXrTabletop.value).toBe(false);
    expect(shader.uniforms.nh3dXrUpright.value).toBe(false);
    expect(shader.uniforms.nh3dXrOrigin.value.distanceTo(camera.camera.position)).toBeLessThan(1e-8);
    const logicalOrigin = shader.uniforms.nh3dXrOrigin.value.clone();
    head.position.x += .4; head.position.y -= .2; head.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), .5);
    f.presentation.updateCamera(); f.presentation.prepareRender();
    expect(camera.camera.position.distanceTo(logicalOrigin)).toBeGreaterThan(.1);
    expect(shader.uniforms.nh3dXrOrigin.value).toEqual(logicalOrigin);
    selecting = false; camera.fpsPositionCursorReturnActive = true;
    f.presentation.updateCamera(); f.presentation.prepareRender();
    expect(shader.uniforms.nh3dXrTabletop.value).toBe(false);
    expect(shader.uniforms.nh3dXrUpright.value).toBe(false);
    camera.fpsPositionCursorReturnActive = false;
    f.presentation.updateCamera(); f.presentation.prepareRender();
    expect(root.matrixWorld.elements).toEqual(baseline.elements);
    expect(shader.uniforms.nh3dXrTabletop.value).toBe(false);
    expect(shader.uniforms.nh3dXrUpright.value).toBe(true);
    expect(shader.uniforms.nh3dXrOrigin.value.toArray()).toEqual([3, -5, camera.firstPersonEyeHeight]);
    expect(sprite.material.side).toBe(THREE.DoubleSide);
    head.position.x += .2;
    Object.assign(camera, { sampleFpsStepCameraGroundPosition: (p: THREE.Vector3) => { p.set(2, -5, 0); return true; } });
    f.presentation.updateCamera(); f.presentation.prepareRender();
    expect(shader.uniforms.nh3dXrOrigin.value.toArray()).toEqual([3, -5, camera.firstPersonEyeHeight]);
    f.presentation.dispose();
  });
  it("removes movement made during loading when the first FPS player grid arrives", async () => {
    const f=fixture(); f.deps.engineState.playMode="fps";setXrSettings({fpsMode:true}); f.deps.playerMovement.hasSeenPlayerPosition=false;
    const head={position:{x:0,y:1.6,z:0},orientation:new THREE.Quaternion()};
    f.renderer.xr.getFrame=()=>({getViewerPose:()=>({transform:head})});
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    head.position.x=.5; f.deps.playerMovement.hasSeenPlayerPosition=true; f.presentation.updateCamera();
    expect(f.deps.camera.camera.position.x).toBeCloseTo(3); expect(f.deps.camera.camera.position.y).toBeCloseTo(-5);
    f.presentation.dispose();
  });
  it("snaps fast-movement turns to the target grid heading while keeping the headset position fixed", async () => {
    const f=fixture(); f.deps.engineState.playMode="fps";setXrSettings({fpsMode:true});
    const head={position:{x:0,y:1.6,z:0},orientation:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.4)};
    f.renderer.xr.getFrame=()=>({getViewerPose:()=>({transform:head})});
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    head.position.x=.2; f.presentation.updateCamera();
    const rig=f.scene.getObjectByName("WebXR tracking space")!;
    const physicalHead=new THREE.Vector3(head.position.x,head.position.y,head.position.z), before=physicalHead.clone().applyMatrix4(rig.matrixWorld);
    f.deps.camera.fpsAutoTurnTargetYaw=Math.PI/2; f.presentation.updateCamera();
    const forward=new THREE.Vector3(0,0,-1).applyQuaternion(head.orientation).transformDirection(rig.matrixWorld);
    expect(Math.atan2(-forward.x,-forward.y)).toBeCloseTo(Math.PI/2);
    expect(physicalHead.clone().applyMatrix4(rig.matrixWorld).distanceTo(before)).toBeLessThan(1e-8);
    expect(f.deps.camera.fpsAutoTurnTargetYaw).toBeNull();
    f.presentation.dispose();
  });
  it("centers FPS entry and recenter on the current grid instead of preserving roomscale offset", async () => {
    const f=fixture();
    const head={position:{x:0,y:1.6,z:0},orientation:new THREE.Quaternion()};
    f.renderer.xr.getFrame=()=>({getViewerPose:()=>({transform:head})});
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    head.position={x:.8,y:1.6,z:.4}; f.deps.engineState.playMode="fps";setXrSettings({fpsMode:true}); f.presentation.updateCamera();
    expect(f.deps.camera.camera.position.x).toBeCloseTo(3);
    expect(f.deps.camera.camera.position.y).toBeCloseTo(-5);
    head.position.x+=.3; f.presentation.updateCamera();
    expect(f.deps.camera.camera.position.x).not.toBeCloseTo(3);
    recenterWebXr(); await Promise.resolve();await Promise.resolve();await Promise.resolve(); f.presentation.updateCamera();
    expect(f.deps.camera.camera.position.x).toBeCloseTo(3);
    expect(f.deps.camera.camera.position.y).toBeCloseTo(-5);
    expect(f.deps.camera.snapFpsStepToPlayer).toHaveBeenCalledTimes(2);
    f.presentation.dispose();
  });
  it("recenter resets free table placement and pan in front of the current head pose", async () => {
    const f = fixture();
    const head = { position: {x:0,y:1.6,z:0}, orientation: new THREE.Quaternion() };
    f.renderer.xr.getFrame = () => ({ getViewerPose: () => ({transform:head}) });
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    const owner = f.presentation as unknown as {tableMove:TableMoveHandle;tablePosition:THREE.Vector3;tilt:{pitch:number}};
    owner.tableMove.offset.set(3,2,1); f.deps.camera.cameraPanX=20; f.presentation.updateCamera();
    head.position={x:5,y:1.6,z:-3}; head.orientation.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
    recenterWebXr(); await Promise.resolve();await Promise.resolve();await Promise.resolve(); f.presentation.updateCamera();
    expect(owner.tableMove.offset.length()).toBe(0); expect(f.deps.camera.cameraPanX).toBe(0);
    expect(owner.tablePosition.x).toBeCloseTo(5-1.55); expect(owner.tablePosition.z).toBeCloseTo(-3);
    expect(owner.tablePosition.y).toBeCloseTo(.95); expect(owner.tilt.pitch).toBeCloseTo(Math.PI/3);
    f.presentation.dispose();
  });
  it("renders minimap navigation through the same desktop pan state without moving the player", async () => {
    const f = fixture();
    const now = vi.spyOn(performance,"now").mockReturnValue(0);
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    const root = f.scene.getObjectByName("WebXR tracking space")!;
    const before = root.matrix.clone();
    const minimap = new Minimap({ camera: f.deps.camera, playerMovement: f.deps.playerMovement } as unknown as MinimapDependencies);
    minimap.centerCameraOnMinimapTile(20, 10);
    now.mockReturnValue(250);
    f.presentation.updateCamera();
    expect(root.matrix.equals(before)).toBe(false);
    expect(f.deps.playerMovement.playerPos).toEqual({ x: 3, y: 5 });
    expect(f.deps.camera.isCameraCenteredOnPlayer).toBe(false);
    expect(f.renderer.clippingPlanes[0].distanceToPoint(new THREE.Vector3(11.5*TILE_SIZE,-7.5*TILE_SIZE,0))).toBeCloseTo(12.5*TILE_SIZE);
    now.mockReturnValue(5000); f.presentation.updateCamera();
    expect(f.renderer.clippingPlanes[0].distanceToPoint(new THREE.Vector3(20*TILE_SIZE,-10*TILE_SIZE,0))).toBeCloseTo(12.5*TILE_SIZE);
    f.presentation.dispose(); now.mockRestore();
  });
  it("keeps one session through menu, game, return to menu, and another game", async () => {
    const f = fixture();
    f.presentation.setStartupMenu(true);
    f.presentation.start(); await Promise.resolve(); await toggleWebXr();
    f.presentation.renderStartupFrame(0);
    const menuScene = f.renderer.render.mock.calls[f.renderer.render.mock.calls.length - 1][0] as THREE.Scene;
    expect(menuScene).not.toBe(f.scene);
    const rig = menuScene.getObjectByName("WebXR tracking space");
    expect(rig).toBeDefined();
    expect(f.renderer.clippingPlanes).toEqual([]);
    const end = vi.spyOn(f.session, "end");
    f.presentation.setStartupMenu(false); f.presentation.updateCamera(); f.frame();
    expect(f.scene.getObjectByName("WebXR tracking space")).toBe(rig);
    expect(f.classes.has("nh3d-xr-menu")).toBe(false);
    f.presentation.setStartupMenu(true); f.presentation.renderStartupFrame(100);
    expect(f.renderer.clippingPlanes).toEqual([]);
    f.presentation.setStartupMenu(false); f.presentation.updateCamera(); f.frame();
    expect(f.renderer.xr.setSession).toHaveBeenCalledTimes(1);
    expect(f.requestSession).toHaveBeenCalledTimes(1);
    expect(end).not.toHaveBeenCalled();
    f.presentation.dispose();
    expect(end).toHaveBeenCalledTimes(1);
  });
  it("keeps tracked eyes and physical UI undistorted under rectangular world cells", async () => {
    const f = fixture();
    f.scene.scale.x = 0.6;
    f.deps.engineState.playMode = "fps"; setXrSettings({fpsMode:true});
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    const root = f.scene.getObjectByName("WebXR tracking space")!;
    const tracked = new THREE.ArrayCamera();
    tracked.up.set(0, 0, 1); tracked.lookAt(new THREE.Vector3(1, 1, 0)); tracked.updateMatrixWorld();
    f.renderer.xr.getCamera = () => tracked;
    f.presentation.updateCamera();
    const logicalForward = f.deps.camera.camera.getWorldDirection(new THREE.Vector3());
    expect(logicalForward.distanceTo(new THREE.Vector3(1 / 0.6, 1, 0).normalize())).toBeLessThan(1e-8);
    const head = new THREE.Vector3(0, 1.6, 0).applyMatrix4(root.matrixWorld);
    expect(head.x).toBeCloseTo(3 * 0.6);
    expect(head.y).toBeCloseTo(-5);
    expect(head.z).toBeCloseTo(0.62);
    expect(f.deps.camera.camera.position.x).toBeCloseTo(3);
    expect(f.deps.camera.camera.position.y).toBeCloseTo(-5);
    const basis = new THREE.Vector3().setFromMatrixScale(root.matrixWorld);
    expect(basis.x).toBeCloseTo(basis.y);
    expect(basis.x).toBeCloseTo(basis.z);
    const owner = f.presentation as unknown as { snapTurn(direction: -1 | 1): void };
    owner.snapTurn(1);
    const turnedHead = new THREE.Vector3(0, 1.6, 0).applyMatrix4(root.matrixWorld);
    expect(turnedHead.distanceTo(head)).toBeLessThan(1e-8);
    const turnedBasis = new THREE.Vector3().setFromMatrixScale(root.matrixWorld);
    expect(turnedBasis.x).toBeCloseTo(turnedBasis.y);
    expect(turnedBasis.x).toBeCloseTo(turnedBasis.z);
    expect(root.matrixAutoUpdate).toBe(false);
    f.scene.scale.x = 1;
    f.presentation.updateCamera();
    expect(new THREE.Vector3(0, 1.6, 0).applyMatrix4(root.matrixWorld).x).toBeCloseTo(3);
    f.presentation.dispose();
  });
  it("uses the tracked head position even when head rotation shifts the stereo union camera", async () => {
    const f = fixture(), union = new THREE.ArrayCamera();
    const head = { position: { x: 0, y: 1.6, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } };
    f.renderer.xr.getFrame = () => ({ getViewerPose: () => ({ transform: head }) });
    f.renderer.xr.getCamera = () => union;
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    const origin = f.deps.camera.camera.position.clone();
    head.orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), 1);
    union.position.set(.05, 0, .08); union.quaternion.copy(head.orientation as THREE.Quaternion); union.updateMatrixWorld();
    f.presentation.updateCamera();
    expect(f.deps.camera.camera.position).toEqual(origin);
    head.position.x += .1; f.presentation.updateCamera();
    expect(f.deps.camera.camera.position.distanceTo(origin)).toBeGreaterThan(.01);
    f.presentation.dispose();
  });
  it("uses the standard FPS step position unless instant movement is enabled", async () => {
    const f = fixture(); (f.deps.engineState as { playMode: string }).playMode = "fps"; setXrSettings({fpsMode:true});
    Object.assign(f.deps.camera, { sampleFpsStepCameraGroundPosition: (position: THREE.Vector3) => { position.set(2, -5, 0); return true; } });
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    const root = f.scene.getObjectByName("WebXR tracking space")!;
    expect(new THREE.Vector3(0, 1.6, 0).applyMatrix4(root.matrixWorld).x).toBeCloseTo(2);
    setXrSettings({ instantMovement: true }); f.presentation.updateCamera();
    expect(new THREE.Vector3(0, 1.6, 0).applyMatrix4(root.matrixWorld).x).toBeCloseTo(3);
    setXrSettings({ instantMovement: false }); f.presentation.dispose();
  });
  it("keeps a repeated FPS step sample stable with roomscale and the XR-written camera pose", async () => {
    const f = fixture(); (f.deps.engineState as { playMode: string }).playMode = "fps"; setXrSettings({fpsMode:true});
    const head = { position: { x: .35, y: 1.8, z: .2 }, orientation: { x: 0, y: 0, z: 0, w: 1 } };
    f.renderer.xr.getFrame = () => ({ getViewerPose: () => ({ transform: head }) });
    Object.assign(f.deps.camera, { sampleFpsStepCameraGroundPosition: (position: THREE.Vector3) => { position.set(2, -5, 0); return true; } });
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    const root = f.scene.getObjectByName("WebXR tracking space")!;
    const firstHead = new THREE.Vector3(head.position.x, head.position.y, head.position.z).applyMatrix4(root.matrixWorld);
    expect(firstHead.x).toBeCloseTo(2); expect(firstHead.y).toBeCloseTo(-5); expect(firstHead.z).toBeCloseTo(.62);
    f.deps.camera.camera.position.set(99, 88, 77);
    f.presentation.updateCamera();
    const secondHead = new THREE.Vector3(head.position.x, head.position.y, head.position.z).applyMatrix4(root.matrixWorld);
    expect(secondHead).toEqual(firstHead);
    expect(f.deps.camera.camera.position).toEqual(firstHead);
    f.presentation.dispose();
  });
  it("recenters the first-person HUD when gameplay moves the player", async () => {
    const f = fixture(); (f.deps.engineState as { playMode: string }).playMode = "fps"; setXrSettings({fpsMode:true});
    const head = { position: { x: 0, y: 1.6, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } };
    f.renderer.xr.getFrame = () => ({ getViewerPose: () => ({ transform: head }) });
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    const owner = f.presentation as unknown as { htmlPanel: { setFirstPersonAnchor: ReturnType<typeof vi.fn> } };
    const previousRevision = owner.htmlPanel.setFirstPersonAnchor.mock.lastCall![2];
    head.orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .4);
    f.deps.playerMovement.playerPos.x++;
    f.presentation.updateCamera();
    const moved = owner.htmlPanel.setFirstPersonAnchor.mock.lastCall!;
    expect(moved[1]).toBeCloseTo(gridUiHeading(.4,0,0));
    expect(moved[2]).toBeGreaterThan(previousRevision);
    f.presentation.dispose();
  });
  it("snap turning bypasses first-person UI lag and centers its heading immediately", async () => {
    const f = fixture(); (f.deps.engineState as { playMode: string }).playMode = "fps"; setXrSettings({fpsMode:true});
    const head = { position: { x: 0, y: 1.6, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } };
    f.renderer.xr.getFrame = () => ({ getViewerPose: () => ({ transform: head }) });
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    const owner = f.presentation as unknown as { htmlPanel: { setFirstPersonAnchor: ReturnType<typeof vi.fn> }; snapTurn(direction: -1 | 1): void };
    head.orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), 2);
    now.mockReturnValue(10); f.presentation.updateCamera();
    const previous = owner.htmlPanel.setFirstPersonAnchor.mock.lastCall!;
    expect(previous[1]).toBeCloseTo(gridUiHeading(2,0,0));
    owner.snapTurn(1);
    const centered = owner.htmlPanel.setFirstPersonAnchor.mock.lastCall!;
    expect(centered[1]).toBeCloseTo(gridUiHeading(2,0,Math.PI/4)); expect(centered[2]).toBeGreaterThan(previous[2]);
    f.presentation.dispose(); now.mockRestore();
  });
  it("restores the flat canvas after the renderer's session-end handlers finish", async () => {
    const f = fixture();
    f.presentation.start(); await Promise.resolve(); await toggleWebXr();
    let rendererEndObserved = false;
    f.session.addEventListener("end", () => {
      rendererEndObserved = true;
      expect(f.styleValues.get("display")).toBe("none");
    });
    await toggleWebXr();
    expect(rendererEndObserved).toBe(true);
    expect(f.styleValues.get("display")).toBe("block");
    f.presentation.dispose();
  });
  it("ignores an old session's delayed cleanup after a new session starts", async () => {
    const f = fixture();
    const listen = vi.spyOn(f.session, "addEventListener");
    f.presentation.start(); await Promise.resolve(); await toggleWebXr();
    const oldEnd = listen.mock.calls.find(([type]) => type === "end")![1] as EventListener;
    await toggleWebXr();
    const next = Object.assign(new EventTarget(), { environmentBlendMode: "opaque", end: async () => {} });
    f.requestSession.mockResolvedValueOnce(next);
    await toggleWebXr();
    oldEnd(new Event("end")); await Promise.resolve();
    expect(f.presentation.active).toBe(true);
    expect(f.styleValues.get("display")).toBe("none");
    f.presentation.dispose();
  });
  it("uses one scene and canvas through repeated XR entry, hiding it before each request", async () => {
    const f = fixture();
    const geometry = f.mesh.geometry, material = f.mesh.material;
    f.requestSession.mockImplementation(async () => {
      expect(f.styleValues.get("display")).toBe("none");
      expect(f.classes.has("nh3d-webxr-active")).toBe(true);
      return f.session;
    });
    f.presentation.start(); await Promise.resolve();
    for (let i = 0; i < 3; i++) {
      await toggleWebXr(); f.presentation.updateCamera();
      const calls = f.renderer.render.mock.calls.length;
      expect(f.presentation.prepareRender()).not.toBeNull();
      expect(f.renderer.render.mock.calls).toHaveLength(calls);
      f.frame(); expect(f.renderer.render.mock.calls).toHaveLength(calls + 1);
      expect(f.mesh.geometry).toBe(geometry); expect(f.mesh.material).toBe(material);
      await toggleWebXr();
      expect(f.scene.children).toEqual([f.mesh]);
      expect(f.styleValues.get("display")).toBe("block");
    }
    f.presentation.dispose();
  });
  it("renders the original scene/materials in both modes and restores normal rendering on exit", async () => {
    const f = fixture();
    const geometry = f.mesh.geometry, material = f.mesh.material, matrix = f.mesh.matrix.clone();
    f.presentation.start(); await Promise.resolve(); await toggleWebXr();
    expect(f.requestSession).toHaveBeenCalledWith("immersive-vr", { requiredFeatures: ["local-floor"] });
    expect(f.renderer.xr.setFramebufferScaleFactor).toHaveBeenCalledWith(1.3);
    expect(f.presentation.updateCamera()).toBe(true);
    expect(f.frame()).toBe(true);
    expect(f.renderer.render.mock.calls[0][0]).toBe(f.scene);
    expect(f.renderer.clippingPlanes).toHaveLength(4);
    f.deps.engineState.playMode = "fps"; setXrSettings({fpsMode:true});
    f.presentation.updateCamera(); f.frame();
    expect(f.renderer.clippingPlanes).toHaveLength(0);
    expect(f.mesh.geometry).toBe(geometry); expect(f.mesh.material).toBe(material); expect(f.mesh.matrix.equals(matrix)).toBe(true);
    await toggleWebXr();
    expect(f.presentation.active).toBe(false);
    expect(f.deps.camera.cameraPitch).toBe(.4); // Restore the independent flat camera preference.
    expect(f.classes.has("nh3d-webxr-active")).toBe(false);
    expect(f.scene.children).toEqual([f.mesh]);
    f.presentation.dispose();
  });
  it("does not hide HTML or strand the entry button when session permission is denied", async () => {
    const f = fixture();
    f.requestSession.mockRejectedValue(new Error("Permission denied"));
    f.presentation.start(); await Promise.resolve(); await toggleWebXr();
    expect(getWebXrState()).toMatchObject({ active: false, busy: false, error: "Permission denied" });
    expect(f.classes.size).toBe(0); expect(f.frame()).toBe(false);
    f.presentation.dispose();
  });
  it("enters opaque VR even when a saved mixed reality preference is enabled", async () => {
    const f = fixture(); f.deps.engineState.clientOptions.vrPassthrough = true;
    f.presentation.start(); await Promise.resolve(); await toggleWebXr();
    f.presentation.updateCamera();
    expect(f.requestSession).toHaveBeenCalledWith("immersive-vr", expect.anything());
    expect(f.renderer.setClearColor).toHaveBeenCalledWith(0, 1);
    expect(f.scene.background).toEqual(new THREE.Color(0x000000));
    f.presentation.dispose();
  });
  it("ends the XR session and releases its rig when the engine is disposed", async () => {
    const f = fixture();
    f.presentation.start(); await Promise.resolve(); await toggleWebXr();
    const end = vi.spyOn(f.session, "end");
    f.presentation.dispose();
    expect(end).toHaveBeenCalledTimes(1);
    expect(f.scene.children).toEqual([f.mesh]);
    expect(f.classes.size).toBe(0);
  });

  it("enters VR from native game startup without changing the tabletop preference", async () => {
    const f = fixture(true);
    f.presentation.start();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(f.requestSession).toHaveBeenCalledTimes(1);
    expect(f.presentation.active).toBe(true);
    expect(f.deps.engineState.playMode).toBe("normal");
    await toggleWebXr();
    document.dispatchEvent(new Event("pointerup"));
    await Promise.resolve();
    expect(f.requestSession).toHaveBeenCalledTimes(1);
    expect(f.presentation.active).toBe(false);
    f.presentation.dispose();
  });
  it("restores native immersive mode without requiring a new user activation", async () => {
    const f = fixture(true);
    Object.assign(navigator.userActivation, { isActive: false });
    f.presentation.start();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(f.requestSession).toHaveBeenCalledTimes(1);
    Object.assign(navigator.userActivation, { isActive: true });
    document.dispatchEvent(new Event("pointerup"));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(f.presentation.active).toBe(true);
    f.presentation.dispose();
  });
  it("restores VR after headset idle but keeps an explicit flat choice flat", async () => {
    const f=fixture(true);
    f.presentation.start(); for(let i=0;i<20;i++) await Promise.resolve();
    expect(f.presentation.active).toBe(true);
    Object.assign(document,{visibilityState:"hidden"}); document.dispatchEvent(new Event("visibilitychange"));
    await f.session.end(); for(let i=0;i<20;i++) await Promise.resolve();
    expect(f.requestSession).toHaveBeenCalledTimes(1);
    Object.assign(document,{visibilityState:"visible"}); document.dispatchEvent(new Event("visibilitychange"));
    for(let i=0;i<30;i++) await Promise.resolve();
    expect(f.requestSession).toHaveBeenCalledTimes(2); expect(f.presentation.active).toBe(true);
    await toggleWebXr();
    Object.assign(document,{visibilityState:"hidden"}); document.dispatchEvent(new Event("visibilitychange"));
    for(let i=0;i<10;i++) await Promise.resolve();
    Object.assign(document,{visibilityState:"visible"}); document.dispatchEvent(new Event("visibilitychange"));
    for(let i=0;i<30;i++) await Promise.resolve();
    expect(f.requestSession).toHaveBeenCalledTimes(2); expect(f.presentation.active).toBe(false);
    f.presentation.dispose();
  });
  it("uses a resumed render loop as a fallback when Quest emits no DOM visibility event", async () => {
    const now=vi.spyOn(performance,"now").mockReturnValue(0), f=fixture(true);
    f.presentation.start(); for(let i=0;i<20;i++) await Promise.resolve();
    await f.session.end(); for(let i=0;i<10;i++) await Promise.resolve();
    now.mockReturnValue(2000); f.presentation.updateCamera();
    for(let i=0;i<30;i++) await Promise.resolve();
    expect(f.requestSession).toHaveBeenCalledTimes(2); expect(f.presentation.active).toBe(true);
    f.presentation.dispose(); now.mockRestore();
  });
  it("keeps wired browser entry under the normal Enter VR button", async () => {
    const f = fixture();
    f.presentation.start();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(f.requestSession).not.toHaveBeenCalled();
    f.presentation.dispose();
  });
  it("requests the native menu at launch even before user activation", async () => {
    const f = fixture(true);
    Object.assign(navigator.userActivation, { isActive: false });
    f.presentation.setStartupMenu(true);
    f.presentation.start();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(f.requestSession).toHaveBeenCalledTimes(1);
    expect(f.presentation.active).toBe(true);
    await toggleWebXr();
    document.dispatchEvent(new Event("pointerup"));
    await Promise.resolve();
    expect(f.requestSession).toHaveBeenCalledTimes(1);
    f.presentation.dispose();
  });
});

it("renders controller overlays in menu and game and releases them with the session", async () => {
  const f=fixture();f.presentation.start();await Promise.resolve();await toggleWebXr();
  Object.assign(f.session, {inputSources:[]});
  const models={render:vi.fn(),renderWorld:(draw:()=>void)=>draw(),update:vi.fn(),dispose:vi.fn()};
  f.presentation.controllerModels=models as unknown as import("../../../quest/webxr/controller-models").ControllerModels;
  f.presentation.renderStartupFrame(0);
  expect(models.render).toHaveBeenCalledOnce();
  f.presentation.setStartupMenu(false);
  f.presentation.updateCamera();
  f.presentation.render(new THREE.PerspectiveCamera());
  expect(models.render).toHaveBeenCalledTimes(2);
  f.presentation.dispose();expect(models.dispose).toHaveBeenCalledOnce();expect(f.presentation.controllerModels).toBeNull();
});
