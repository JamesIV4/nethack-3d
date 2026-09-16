import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
vi.hoisted(() => { vi.stubGlobal("window", { location: new URL("http://localhost/"), matchMedia: () => ({ matches: false, addEventListener() {} }), localStorage: {getItem: () => null} }); });
import { Camera, type CameraDependencies } from "../camera/camera";
vi.mock("../create-engine-systems", () => ({ createEngineSystems: vi.fn() }));
import { GameOver, type GameOverDependencies } from "../ui/game-over";
import Nethack3DEngine from "../../Nethack3DEngine";
afterEach(() => vi.unstubAllGlobals());
it("recenter snaps an active FPS step to the player grid without discarding its completion lifecycle", () => {
  const camera=new Camera({playerMovement:{playerPos:{x:10,y:9}}} as unknown as CameraDependencies);
  camera.fpsStepCameraActive=true; camera.fpsStepCameraFrom.set(2,-3,.62); camera.fpsStepCameraTo.set(3,-3,.62);
  camera.fpsStepCameraStartMs=performance.now(); camera.fpsStepCameraDurationMs=1000;
  camera.snapFpsStepToPlayer();
  const position=new THREE.Vector3();
  expect(camera.sampleFpsStepCameraGroundPosition(position)).toBe(true);
  expect(position).toEqual(new THREE.Vector3(10,-9,0));
  expect(camera.fpsStepCameraActive).toBe(true);
  expect(performance.now()-camera.fpsStepCameraStartMs).toBeGreaterThanOrEqual(1000);
});
it("preserves camera completion and releases postmortem modals in the shared XR frame", () => {
  const callbacks: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callbacks.push(callback); return callbacks.length; });
  const tiles = { pendingTileUpdates: new Map([["2,3", {}]]), tileFlushScheduled: false, flushPendingTileUpdates: vi.fn(),
    schedulePendingTileFlush: () => { tiles.tileFlushScheduled = true; requestAnimationFrame(() => tiles.flushPendingTileUpdates()); } };
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
  const showQuestion=vi.fn();
  const gameOver=new GameOver({questionMenus:{isInQuestion:false,showQuestion},directionPrompts:{isInDirectionQuestion:false},promptDialogs:{isInventoryDialogVisible:false}} as unknown as GameOverDependencies);
  gameOver.armGameOverUiRevealDelay();
  gameOver.deferredGameOverQuestionState={question:"Identify possessions?",choices:"yn",defaultChoice:"y",menuItems:[]};
  gameOver.deferredGameOverCompletionState={deathMessage:"Killed by a newt",tombstoneLines:["RIP"],shouldDeferPromptReady:false};
  gameOver.setGameOverState=vi.fn();
  const systems = new Proxy<Record<string, unknown>>({
    gameOver,
    engineState: { disposed: false, lastFrameTimeMs: null, clientOptions: { minimap: false } },
    camera: new Proxy(camera, { get: (o,k) => k in o ? Reflect.get(o,k) : noop }),
    webXrPresentation: { active: true, updateInput: noop, updateCamera: () => { order.push("XR pose"); return true; }, prepareRender: () => camera.camera, render: () => order.push("render") },
    renderPipeline: { syncWorldTileScale: () => order.push("world scale"), renderer: { xr: { isPresenting: true }, render: () => order.push("render") }, scene: new THREE.Scene() },
    directionPrompts: { directionPromptOverlay: null, syncDirectionPromptOverlayVisibility: noop },
    tilesetAssets: { vultureTilesetTranslator: null },
    playerMovement: { playerPos: { x: 2, y: 3 } },
  }, { get: (o,k) => Reflect.get(o,k) ?? new Proxy({}, {get: () => noop}) });
  const engine = Object.create(Nethack3DEngine.prototype) as { systems: unknown; animate: (time: number) => void };
  engine.systems = systems; engine.animate(performance.now());
  expect(gameOver.isGameOverUiRevealBlocked()).toBe(false);
  expect(showQuestion).toHaveBeenCalledWith("Identify possessions?","yn","y",[]);
  expect(gameOver.setGameOverState).toHaveBeenCalledWith(true,"Killed by a newt",{promptReady:true,tombstoneLines:["RIP"]});
  expect(camera.fpsStepCameraActive).toBe(false);
  expect(tiles.tileFlushScheduled).toBe(true);
  expect(order).toEqual(["world scale", "XR pose", "camera lifecycle", "XR pose", "render"]);
  callbacks.forEach(callback => callback(performance.now()));
  expect(tiles.flushPendingTileUpdates).toHaveBeenCalledOnce();
});
