import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebXrControllerInput } from "./controller-input";
import type { HtmlUiPanel } from "./html-ui-panel";
import type { BoardTilt } from "./board-tilt";

const { game } = vi.hoisted(() => ({ game: { current: {} as Record<string, unknown> } }));
vi.mock("../../state/gameStore", () => ({ useGameStore: { getState: () => game.current } }));
vi.mock("../native/bootstrap", () => ({ dispatchQuestKey: vi.fn() }));

function fixture() {
  vi.stubGlobal("HTMLElement", class {});
  vi.stubGlobal("document", { querySelector: () => null, activeElement: null });
  const controller = { runQuestDirection: vi.fn(), sendInput: vi.fn(), activateQuestTile: vi.fn(() => true) };
  game.current = { engineController: controller, connectionState: "running", loadingVisible: false,
    uiBlockingVisible: false, inventory: { visible: false }, newGamePrompt: { visible: false },
    gameOver: { active: false }, numberPadModeEnabled: true };
  const source = (handedness: string) => ({ handedness, targetRaySpace: {},
    gamepad: { buttons: Array.from({ length: 6 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] } });
  const left = source("left"), right = source("right");
  const session = Object.assign(new EventTarget(), { visibilityState: "visible", inputSources: [left, right] });
  const root = new THREE.Group(), scene = new THREE.Scene();
  scene.add(root);
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial());
  tile.userData = { tileX: 4, tileY: 6 }; scene.add(tile); scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(); camera.position.z = 1; camera.updateMatrixWorld();
  const pose = new THREE.Matrix4().makeTranslation(0, 0, 1);
  const renderer = { clippingPlanes: [], xr: { getReferenceSpace: () => ({}), getCamera: () => camera,
    getFrame: () => ({ getPose: () => ({ transform: { matrix: pose.elements } }) }) } };
  const panel = { native: true, hit: () => null, hover: vi.fn(), forget: vi.fn() };
  const tilt = { hit: () => null, hover: vi.fn(), surfaceHit: () => null, end: vi.fn() };
  const input = new WebXrControllerInput(session as unknown as XRSession, renderer as unknown as THREE.WebGLRenderer,
    scene, root, 1, () => panel as unknown as HtmlUiPanel, tilt as unknown as BoardTilt);
  return { input, left, right, controller, session };
}
afterEach(() => vi.unstubAllGlobals());

describe("WebXR trigger to game command integration", () => {
  it("uses LT as the run modifier and resumes walking when it is released", () => {
    const f = fixture();
    f.left.gamepad.buttons[0].pressed = true;
    f.left.gamepad.axes[2] = 1;
    f.input.update(0, null);
    expect(f.controller.runQuestDirection).toHaveBeenCalledExactlyOnceWith("6");
    expect(f.controller.sendInput).not.toHaveBeenCalled();
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled();
    f.left.gamepad.buttons[0].pressed = false;
    f.input.update(200, null);
    expect(f.controller.sendInput).toHaveBeenCalledExactlyOnceWith("Numpad6");
    f.input.dispose();
  });
  it("holds RT to open context actions once and does not click the tile on release", () => {
    const f = fixture();
    f.right.gamepad.buttons[0].pressed = true;
    f.input.update(0, null); f.input.update(449, null);
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled();
    f.input.update(450, null); f.input.update(800, null);
    f.right.gamepad.buttons[0].pressed = false; f.input.update(850, null);
    expect(f.controller.activateQuestTile).toHaveBeenCalledExactlyOnceWith(4, 6, true);
    f.input.dispose();
  });
  it("taps RT to select normally and cancels an unfinished hold on loss of visibility", () => {
    const f = fixture();
    f.right.gamepad.buttons[0].pressed = true; f.input.update(0, null);
    f.right.gamepad.buttons[0].pressed = false; f.input.update(100, null);
    expect(f.controller.activateQuestTile).toHaveBeenCalledExactlyOnceWith(4, 6);
    f.right.gamepad.buttons[0].pressed = true; f.input.update(200, null);
    f.session.visibilityState = "hidden"; f.input.update(1000, null);
    f.session.visibilityState = "visible"; f.right.gamepad.buttons[0].pressed = false; f.input.update(1100, null);
    expect(f.controller.activateQuestTile).toHaveBeenCalledOnce();
    f.input.dispose();
  });
});
