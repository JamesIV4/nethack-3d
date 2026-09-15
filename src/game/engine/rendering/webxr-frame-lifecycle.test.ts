import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
vi.hoisted(() => { vi.stubGlobal("window", { location: new URL("http://localhost/"), matchMedia: () => ({ matches: false, addEventListener() {} }), localStorage: {getItem: () => null} }); });
import { Camera, type CameraDependencies } from "../camera/camera";
vi.mock("../create-engine-systems", () => ({ createEngineSystems: vi.fn() }));
import Nethack3DEngine from "../../Nethack3DEngine";
afterEach(() => vi.unstubAllGlobals());
it("completes the existing first-person step and releases queued tiles before applying the XR view", () => {
  const callbacks: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callbacks.push(callback); return callbacks.length; });
  const tiles = { pendingTileUpdates: new Map([["2,3", {}]]), tileFlushScheduled: false, flushPendingTileUpdates: vi.fn() };
  const camera = new Camera({
    tilesetAssets: { getWorldTileScaleX: () => 1 },
    movementInput: { isFpsMode: () => true }, terminalRendering: { isTerminalDisplayMode: () => false },
    playerMovement: { playerPos: { x: 2, y: 3 } },
    positionSelection: { positionInputModeActive: false, isFpsFarLookViewActive: () => false }, tileUpdates: tiles,
  } as unknown as CameraDependencies);
  camera.camera = new THREE.PerspectiveCamera(); camera.fpsStepCameraActive = true;
  camera.fpsStepCameraStartMs = performance.now() - 2000; camera.fpsStepCameraDurationMs = 92;
  const order: string[] = [], update = camera.updateCamera.bind(camera);
  camera.updateCamera = dt => { order.push("camera lifecycle"); update(dt); };
  const noop = () => undefined;
  const systems = new Proxy<Record<string, unknown>>({
    engineState: { disposed: false, lastFrameTimeMs: null, clientOptions: { minimap: false } },
    camera: new Proxy(camera, { get: (o,k) => k in o ? Reflect.get(o,k) : noop }),
    webXrPresentation: { active: true, updateInput: noop, updateCamera: () => { order.push("XR pose"); return true; }, prepareRender: () => camera.camera },
    renderPipeline: { syncWorldTileScale: () => order.push("world scale"), renderer: { xr: { isPresenting: true }, render: () => order.push("render") }, scene: new THREE.Scene() },
    directionPrompts: { directionPromptOverlay: null, syncDirectionPromptOverlayVisibility: noop },
    playerMovement: { playerPos: { x: 2, y: 3 } },
  }, { get: (o,k) => Reflect.get(o,k) ?? new Proxy({}, {get: () => noop}) });
  const engine = Object.create(Nethack3DEngine.prototype) as { systems: unknown; animate: (time: number) => void };
  engine.systems = systems; engine.animate(performance.now());
  expect(camera.fpsStepCameraActive).toBe(false);
  expect(tiles.tileFlushScheduled).toBe(true);
  expect(order).toEqual(["world scale", "XR pose", "camera lifecycle", "XR pose", "render"]);
  callbacks.forEach(callback => callback(performance.now()));
  expect(tiles.flushPendingTileUpdates).toHaveBeenCalledOnce();
});
