import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebXrPresentation, type WebXrPresentationDependencies } from "./webxr-presentation";
import { getWebXrState, toggleWebXr } from "../../../quest/webxr/presentation";
vi.mock("../../../quest/webxr/controller-input", () => ({ WebXrControllerInput: class { update() {} dispose() {} } }));
vi.mock("../../../quest/webxr/html-ui-panel", () => ({ HtmlUiPanel: class { recenter() {} update() {} dispose() {} } }));
afterEach(() => vi.unstubAllGlobals());

function fixture(native = false) {
  const classes = new Set<string>();
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible", exitPointerLock: vi.fn(), documentElement: { classList: {
    add: (value: string) => classes.add(value), remove: (value: string) => classes.delete(value),
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
  const renderer = {
    render: vi.fn(), clippingPlanes: [] as THREE.Plane[],
    getClearColor: (value: THREE.Color) => value.set(0x123456), getClearAlpha: () => 1, setClearColor: vi.fn(),
    xr: {
      enabled: false, isPresenting: false, setReferenceSpaceType: vi.fn(),
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
  return { presentation, deps, renderer, scene, mesh, classes, session, requestSession };
}
describe("Three.js owns the Quest world", () => {
  it("renders the original scene/materials in both modes and restores normal rendering on exit", async () => {
    const f = fixture();
    const geometry = f.mesh.geometry, material = f.mesh.material, matrix = f.mesh.matrix.clone();
    f.presentation.start(); await Promise.resolve(); await toggleWebXr();
    expect(f.requestSession).toHaveBeenCalledWith("immersive-vr", { requiredFeatures: ["local-floor"] });
    expect(f.presentation.updateCamera()).toBe(true);
    expect(f.presentation.render()).toBe(true);
    expect(f.renderer.render.mock.calls[0][0]).toBe(f.scene);
    expect(f.renderer.clippingPlanes).toHaveLength(4);
    f.deps.engineState.playMode = "fps";
    f.presentation.updateCamera(); f.presentation.render();
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
    expect(f.classes.size).toBe(0); expect(f.presentation.render()).toBe(false);
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
