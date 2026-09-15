import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebXrPresentation, type WebXrPresentationDependencies } from "./webxr-presentation";
import { getWebXrState, toggleWebXr } from "../../../quest/webxr/presentation";
vi.mock("../../../quest/webxr/controller-input", () => ({ WebXrControllerInput: class { update() {} dispose() {} } }));
vi.mock("../../../quest/webxr/html-ui-panel", () => ({ HtmlUiPanel: class { recenter() {} setFirstPersonAnchor = vi.fn(); followViewer() {} update() {} dispose() {} } }));
afterEach(() => vi.unstubAllGlobals());

function fixture(native = false) {
  const classes = new Set<string>();
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible", exitPointerLock: vi.fn(), documentElement: { classList: {
    add: (value: string) => classes.add(value), remove: (value: string) => classes.delete(value),
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
  const renderer = {
    domElement: { style },
    render: vi.fn(), clippingPlanes: [] as THREE.Plane[],
    getClearColor: (value: THREE.Color) => value.set(0x123456), getClearAlpha: () => 1, setClearColor: vi.fn(),
    xr: {
      enabled: false, isPresenting: false, setReferenceSpaceType: vi.fn(), setFramebufferScaleFactor: vi.fn(),
      setSession: vi.fn(async () => { renderer.xr.isPresenting = true; }),
      getReferenceSpace: () => ({}),
      getFrame: () => ({ getViewerPose: () => ({ transform: {
        position: { x: 0, y: 1.6, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 },
      } }) }),
      updateCamera: vi.fn(), getCamera: () => new THREE.ArrayCamera(),
    },
  };
  const deps = {
    camera: { camera: new THREE.PerspectiveCamera(), cameraYaw: 2, cameraPitch: 0.4, firstPersonEyeHeight: 0.62, applyStandardCameraPresetForTopDownModes: vi.fn() },
    engineState: { clientOptions: { vrPassthrough: false }, playMode: "normal", disposed: false },
    playerMovement: { playerPos: { x: 3, y: 5 } }, renderPipeline: { scene, renderer },
    heldWeapon: { fpsHeldWeaponMesh: null },
  } as unknown as WebXrPresentationDependencies;
  const presentation = new WebXrPresentation(deps);
  return { presentation, deps, renderer, scene, mesh, classes, session, requestSession, styleValues,
    frame: () => { const camera = presentation.prepareRender(); if (camera) renderer.render(scene, camera); return !!camera; } };
}
describe("Three.js owns the Quest world", () => {
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
  it("snap turning bypasses first-person UI lag and centers its heading immediately", async () => {
    const f = fixture(); (f.deps.engineState as { playMode: string }).playMode = "fps";
    const head = { position: { x: 0, y: 1.6, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } };
    f.renderer.xr.getFrame = () => ({ getViewerPose: () => ({ transform: head }) });
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    f.presentation.start(); await Promise.resolve(); await toggleWebXr(); f.presentation.updateCamera();
    const owner = f.presentation as unknown as { htmlPanel: { setFirstPersonAnchor: ReturnType<typeof vi.fn> }; snapTurn(direction: -1 | 1): void };
    head.orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), 2);
    now.mockReturnValue(10); f.presentation.updateCamera();
    const previous = owner.htmlPanel.setFirstPersonAnchor.mock.lastCall!;
    expect(previous[1]).toBeGreaterThan(0); expect(previous[1]).toBeLessThan(2);
    owner.snapTurn(1);
    const centered = owner.htmlPanel.setFirstPersonAnchor.mock.lastCall!;
    expect(centered[1]).toBeCloseTo(2); expect(centered[2]).toBeGreaterThan(previous[2]);
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
    expect(f.renderer.xr.setFramebufferScaleFactor).toHaveBeenCalledWith(1.5);
    expect(f.presentation.updateCamera()).toBe(true);
    expect(f.frame()).toBe(true);
    expect(f.renderer.render.mock.calls[0][0]).toBe(f.scene);
    expect(f.renderer.clippingPlanes).toHaveLength(4);
    f.deps.engineState.playMode = "fps";
    f.presentation.updateCamera(); f.frame();
    expect(f.renderer.clippingPlanes).toHaveLength(0);
    expect(f.mesh.geometry).toBe(geometry); expect(f.mesh.material).toBe(material); expect(f.mesh.matrix.equals(matrix)).toBe(true);
    await toggleWebXr();
    expect(f.presentation.active).toBe(false);
    expect(f.deps.camera.cameraPitch).toBe(0); // FPS selected during XR stays FPS on exit.
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
  it("requests AR explicitly and clears alpha for mixed reality", async () => {
    const f = fixture(); f.deps.engineState.clientOptions.vrPassthrough = true;
    f.session.environmentBlendMode = "alpha-blend";
    f.presentation.start(); await Promise.resolve(); await toggleWebXr();
    f.presentation.updateCamera();
    expect(f.requestSession).toHaveBeenCalledWith("immersive-ar", expect.anything());
    expect(f.renderer.setClearColor).toHaveBeenCalledWith(0, 0);
    expect(f.scene.background).toBeNull();
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
  it("waits for normal user activation when startup outlasts the Start interaction", async () => {
    const f = fixture(true);
    Object.assign(navigator.userActivation, { isActive: false });
    f.presentation.start();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(f.requestSession).not.toHaveBeenCalled();
    Object.assign(navigator.userActivation, { isActive: true });
    document.dispatchEvent(new Event("pointerup"));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(f.presentation.active).toBe(true);
    f.presentation.dispose();
  });
  it("keeps wired browser entry under the normal Enter VR button", async () => {
    const f = fixture();
    f.presentation.start();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(f.requestSession).not.toHaveBeenCalled();
    f.presentation.dispose();
  });
});
