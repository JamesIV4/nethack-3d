import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebXrControllerInput } from "./controller-input";
import type { HtmlUiPanel } from "./html-ui-panel";
import type { BoardTilt } from "./board-tilt";
import { TableMoveHandle } from "./table-move-handle";
import type { QuestWeaponProvider } from "./controller-weapons";

const { game } = vi.hoisted(() => ({ game: { current: {} as Record<string, unknown> } }));
vi.mock("../../state/gameStore", () => ({ useGameStore: { getState: () => game.current } }));
vi.mock("../native/bootstrap", () => ({ dispatchQuestKey: vi.fn() }));

function fixture(withTableHandle = false, withNavigation = false, withWeapons = false) {
  vi.stubGlobal("HTMLElement", class {});
  vi.stubGlobal("document", { querySelector: () => null, activeElement: null });
  const controller = { runQuestDirection: vi.fn(), chooseDirection: vi.fn(), sendInput: vi.fn(), activateQuestTile: vi.fn(() => true) };
  game.current = { engineController: controller, connectionState: "running", loadingVisible: false,
    uiBlockingVisible: false, inventory: { visible: false }, newGamePrompt: { visible: false },
    gameOver: { active: false }, numberPadModeEnabled: true };
  const source = (handedness: string) => ({ handedness, targetRaySpace: {}, gripSpace: {},
    gamepad: { buttons: Array.from({ length: 6 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] } });
  const left = source("left"), right = source("right");
  const session = Object.assign(new EventTarget(), { visibilityState: "visible", inputSources: [left, right] });
  const root = new THREE.Group(), scene = new THREE.Scene();
  scene.add(root);
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial());
  tile.userData = { tileX: 4, tileY: 6 }; scene.add(tile); scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(); camera.position.z = 1; camera.updateMatrixWorld();
  const pose = new THREE.Matrix4().makeTranslation(0, 0, 1);
  const renderer = { clippingPlanes: [] as THREE.Plane[], xr: { getReferenceSpace: () => ({}), getCamera: () => camera,
    getFrame: () => ({ getPose: () => ({ transform: { matrix: pose.elements } }),
      getViewerPose: () => ({ transform: { position: { x: 0, y: 1.6, z: 0 } } }) }) } };
  const panel = { native: true, nativePointer: { setControllerOpacity: vi.fn(), hit: vi.fn(), setContextTarget: vi.fn() }, hit: () => null, hover: vi.fn(), forget: vi.fn(), beginGrab: vi.fn(), moveGrab: vi.fn(), endGrab: vi.fn() };
  const tilt = { hit: () => null, hover: vi.fn(), surfaceHit: () => null, end: vi.fn() };
  const pan = vi.fn();
  const player = {x:3,y:6};
  const tableMove = withTableHandle ? new TableMoveHandle(root) : undefined;
  const weaponProvider: QuestWeaponProvider | undefined = withWeapons ? {
    resolveFpsHeldWeaponTextureState: () => ({ signature: "test", tileIndex: 1, sourceGlyph: 1, tilesetPath: "test" }),
    createQuestWeaponTexture: () => new THREE.Texture(),
  } : undefined;
  const input = new WebXrControllerInput(session as unknown as XRSession, renderer as unknown as THREE.WebGLRenderer,
    scene, root, 1, () => panel as unknown as HtmlUiPanel, tilt as unknown as BoardTilt, undefined, weaponProvider, pan, tableMove,
    withNavigation ? {playerTile:()=>player,direction:(dx,dy)=>dx||dy ? {dx:Math.sign(dx),dy:Math.sign(dy)} : null} : undefined);
  return { input, left, right, controller, session, scene, root, tile, pose, panel, renderer, pan, tableMove, player };
}
afterEach(() => vi.unstubAllGlobals());

describe("WebXR trigger to game command integration", () => {
  it.each([
    [0,1,"8"], [1,1,"9"], [1,0,"6"], [1,-1,"3"],
    [0,-1,"2"], [-1,-1,"1"], [-1,0,"4"], [-1,1,"7"],
  ] as const)("keeps LS camera-relative at heading %s,%s even when the laser owns highlighting",(x,y,key)=>{
    const f=fixture(false,true),forward=new THREE.Vector3(x,y,0);
    f.input.update(0,forward);
    f.left.gamepad.axes[3]=-1;f.input.update(10,forward);
    expect(f.controller.sendInput).toHaveBeenLastCalledWith(`Numpad${key}`);
    // While LS stays held, a new relative laser tile may own the preview.
    f.tile.userData.tileX=12;f.input.update(20,forward);
    expect(f.input.highlightHeadset).toBe(false);
    expect(f.input.highlightTile).toEqual({x:12,y:6});
    f.input.update(200,forward);
    expect(f.controller.sendInput).toHaveBeenLastCalledWith(`Numpad${key}`);
    f.left.gamepad.buttons[0].pressed=true;f.input.update(400,forward);
    expect(f.controller.runQuestDirection).toHaveBeenLastCalledWith(key);
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled();
    f.input.dispose();
  });
  it("reclaims headset highlighting on RS turning and rebases the relative laser tile",()=>{
    const f=fixture(false,true),forward=new THREE.Vector3(0,1,0);
    f.input.update(0,forward);expect(f.input.highlightHeadset).toBe(false);
    f.right.gamepad.axes[2]=1;f.tile.userData.tileX=8;
    f.input.update(10,forward);expect(f.input.highlightHeadset).toBe(true);
    f.player.x++;f.tile.userData.tileX++;
    f.input.update(20,forward);expect(f.input.highlightHeadset).toBe(true);
    f.tile.userData.tileY++;
    f.input.update(30,forward);expect(f.input.highlightHeadset).toBe(false);
    f.input.dispose();
  });
  it("lets RT claim a stationary laser target and keeps it until a fresh LS tilt or 30-degree head turn",()=>{
    const f=fixture(false,true),forward=new THREE.Vector3(0,1,0);
    f.left.gamepad.axes[3]=.06;f.input.update(0,forward);expect(f.input.highlightHeadset).toBe(true);
    f.left.gamepad.axes[3]=0;f.input.update(10,forward);
    f.right.gamepad.buttons[0].pressed=true;f.input.update(20,forward);
    f.right.gamepad.buttons[0].pressed=false;f.input.update(100,forward);
    expect(f.input.highlightHeadset).toBe(false);
    f.player.x++;f.tile.userData.tileX++;f.input.update(110,forward);
    expect(f.input.highlightHeadset).toBe(false);
    forward.set(Math.sin(Math.PI/6),Math.cos(Math.PI/6),0);f.input.update(120,forward);
    expect(f.input.highlightHeadset).toBe(true);
    f.input.dispose();
  });
  it("selects headset highlighting at 5 percent, moves at 30 percent, and switches only for relative laser changes", () => {
    const f=fixture(false,true),forward=new THREE.Vector3(0,1,0);
    f.left.gamepad.axes[3]=.04;f.input.update(0,forward);
    expect(f.input.highlightTile).toEqual({x:4,y:6});
    f.left.gamepad.axes[3]=.06;f.input.update(10,forward);
    expect(f.input.highlightTile).toEqual({x:3,y:5});expect(f.controller.sendInput).not.toHaveBeenCalled();
    f.left.gamepad.axes[3]=.29;f.input.update(20,forward);expect(f.controller.sendInput).not.toHaveBeenCalled();
    f.left.gamepad.axes[3]=.30;f.input.update(30,forward);
    expect(f.controller.sendInput).toHaveBeenCalledExactlyOnceWith("Numpad2");
    f.left.gamepad.axes[3]=0;f.input.update(529,forward);expect(f.input.highlightTile).toEqual({x:3,y:5});
    f.input.update(10000,forward);expect(f.input.highlightTile).toEqual({x:3,y:5});
    f.player.x++;f.tile.userData.tileX++;f.input.update(10001,forward);
    expect(f.input.highlightHeadset).toBe(true);expect(f.input.highlightTile).toEqual({x:4,y:5});
    forward.set(1,0,0);f.input.update(10002,forward);expect(f.input.highlightTile).toEqual({x:5,y:6});
    f.tile.userData.tileX=7;f.input.update(10003,forward);expect(f.input.highlightHeadset).toBe(false);
    f.right.gamepad.buttons[0].pressed=true;f.input.update(10004,forward);
    f.right.gamepad.buttons[0].pressed=false;f.input.update(10080,forward);
    expect(f.controller.activateQuestTile).toHaveBeenCalledExactlyOnceWith(7,6);
    f.tile.userData.tileX=8;f.input.update(10081,forward);
    expect(f.input.highlightTile).toEqual({x:8,y:6});
    f.session.visibilityState="hidden";f.input.update(10082,forward);expect(f.input.highlightTile).toBeNull();
    f.input.dispose();
  });
  it.each([[-.4, 12, 8, .5], [.4, 4, 6, 0]])("uses visible sprite pixels for the Info target and laser at ray x=%s", (x, tileX, tileY, z) => {
    const f = fixture();
    const texture = new THREE.DataTexture(new Uint8Array([0,0,0,255, 0,0,0,0]), 2, 1);
    const sprite = new THREE.Mesh(new THREE.PlaneGeometry(2,2), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
    sprite.userData = { isEntityBillboardProxy: true, tileX: 12, tileY: 8 }; sprite.position.z = .5;
    f.scene.add(sprite); f.scene.updateMatrixWorld(true);
    f.pose.makeTranslation(x,0,1);
    f.right.gamepad.buttons[1].pressed = true; f.input.update(0,new THREE.Vector3(0,1,0));
    f.right.gamepad.buttons[1].pressed = false; f.input.update(100,new THREE.Vector3(0,1,0));
    expect(f.controller.activateQuestTile).toHaveBeenCalledExactlyOnceWith(tileX,tileY,true);
    expect(f.panel.nativePointer.setContextTarget).toHaveBeenCalledExactlyOnceWith(new THREE.Vector3(x,0,z));
    const rightHits = f.panel.nativePointer.hit.mock.calls.filter(call => call[0] === "right");
    const rightHit = rightHits[rightHits.length - 1];
    expect(rightHit[2]).toEqual(new THREE.Vector3(x,0,z));
    f.input.dispose();
  });
  it("routes repeated far-look floor clicks to the exact cell, including a held trigger", () => {
    const f = fixture(false, true); f.tile.visible = false;
    game.current.positionInputActive = true;
    f.pose.makeTranslation(7, -8, 1);
    const forward = new THREE.Vector3(0, 1, 0);
    f.right.gamepad.buttons[0].pressed = true; f.input.update(0, forward);
    f.input.update(600, forward);
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled();
    f.right.gamepad.buttons[0].pressed = false; f.input.update(610, forward);
    f.right.gamepad.buttons[0].pressed = true; f.input.update(700, forward);
    f.right.gamepad.buttons[0].pressed = false; f.input.update(800, forward);
    expect(f.controller.activateQuestTile.mock.calls).toEqual([[7, 8], [7, 8]]);
    expect(f.controller.runQuestDirection).not.toHaveBeenCalled();
    expect(f.controller.sendInput).not.toHaveBeenCalled();
    f.input.dispose();
  });
  it("does not turn a cancelled far-look press into a gameplay click", () => {
    const f = fixture(); game.current.positionInputActive = true;
    f.right.gamepad.buttons[0].pressed = true; f.input.update(0, new THREE.Vector3(0, 1, 0));
    game.current.positionInputActive = false;
    f.right.gamepad.buttons[0].pressed = false; f.input.update(100, new THREE.Vector3(0, 1, 0));
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled(); f.input.dispose();
  });
  it("does not invent a far-look tile for a horizontal void ray", () => {
    const f = fixture(false, true); f.tile.visible = false; game.current.positionInputActive = true;
    f.pose.compose(new THREE.Vector3(3, -6, .62), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)), new THREE.Vector3(1, 1, 1));
    f.right.gamepad.buttons[0].pressed = true; f.input.update(0, new THREE.Vector3(1, 0, 0));
    f.right.gamepad.buttons[0].pressed = false; f.input.update(100, new THREE.Vector3(1, 0, 0));
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled();
    expect(f.controller.sendInput).not.toHaveBeenCalled(); f.input.dispose();
  });
  it.each(["hold", "grip"])("anchors a %s context at the precise press hit rather than the tile center", (activation) => {
    const f = fixture();
    f.pose.makeTranslation(.7, -.4, 1);
    const button = activation === "hold" ? 0 : 1;
    f.right.gamepad.buttons[button].pressed = true;
    f.input.update(0, new THREE.Vector3(0, 1, 0));
    // Hand drift must not change the selected point while the gesture matures.
    f.pose.makeTranslation(1.1, -.1, 1);
    if (activation === "hold") f.input.update(500, new THREE.Vector3(0, 1, 0));
    f.right.gamepad.buttons[button].pressed = false;
    f.input.update(510, new THREE.Vector3(0, 1, 0));
    expect(f.panel.nativePointer.setContextTarget).toHaveBeenCalledExactlyOnceWith(new THREE.Vector3(.7, -.4, 0));
    expect(f.controller.activateQuestTile).toHaveBeenCalledExactlyOnceWith(4, 6, true);
    f.input.dispose();
  });
  it("keeps a billboard's owning tile for FPS secondary hits through a scaled tracking rig", () => {
    const f = fixture();
    f.tile.visible = false;
    const billboard = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    billboard.position.set(4, -6, .5);
    billboard.userData = { tileX: 4, tileY: 6 };
    f.scene.add(billboard);
    f.scene.scale.x = 1.4;
    f.root.position.set(4, -6, 0);
    f.root.scale.setScalar(.5);
    f.scene.updateMatrixWorld(true);
    // Hit the visual edge, which rounds to a neighboring grid tile without metadata.
    f.pose.makeTranslation(1.6, 0, 2);
    f.right.gamepad.buttons[1].pressed = true;
    f.input.update(0, new THREE.Vector3(0, 1, 0));
    f.right.gamepad.buttons[1].pressed = false;
    f.input.update(100, new THREE.Vector3(0, 1, 0));
    expect(f.controller.activateQuestTile).toHaveBeenCalledExactlyOnceWith(4, 6, true);
    f.input.dispose();
  });

  it("does not invent tile zero when an FPS context ray has no target", () => {
    const f = fixture(); f.tile.visible = false;
    f.pose.makeRotationY(Math.PI);
    f.pose.setPosition(0, 0, 1);
    f.right.gamepad.buttons[1].pressed = true;
    f.input.update(0, new THREE.Vector3(0, 1, 0));
    f.right.gamepad.buttons[1].pressed = false;
    f.input.update(100, new THREE.Vector3(0, 1, 0));
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled();
    f.input.dispose();
  });

  it("mounts held weapon voxels only while in first-person VR", () => {
    const f = fixture(false, false, true);
    f.input.update(0, new THREE.Vector3(0, 0, -1));
    expect(f.root.children.filter(child => child instanceof THREE.InstancedMesh && child.visible)).toHaveLength(2);
    f.input.update(20, null);
    expect(f.root.children.filter(child => child instanceof THREE.InstancedMesh && child.visible)).toHaveLength(0);
    f.input.dispose();
  });
  it("uses fast directional movement for a horizontal FPS void ray instead of requiring a floor hit", () => {
    const f=fixture(false,true); f.tile.visible=false;
    f.pose.compose(new THREE.Vector3(3,-6,.62),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),new THREE.Vector3(1,0,0)),new THREE.Vector3(1,1,1));
    f.right.gamepad.buttons[0].pressed=true; f.input.update(0,new THREE.Vector3(1,0,0));
    f.right.gamepad.buttons[0].pressed=false; f.input.update(100,new THREE.Vector3(1,0,0));
    expect(f.controller.runQuestDirection).toHaveBeenCalledExactlyOnceWith("6");
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled();
    f.input.dispose();
  });
  it("gripping the capsule moves the entire table at 2x without world pan or a context click", () => {
    const f = fixture(true);
    f.tableMove!.place(new THREE.Vector3(0,.035,-1.14),new THREE.Quaternion(),0,true);
    f.right.gamepad.buttons[1].pressed=true; f.input.update(0,null);
    f.pose.makeTranslation(.1,.2,1.3); f.input.update(100,null);
    expect(f.tableMove!.offset.x).toBeCloseTo(.2); expect(f.tableMove!.offset.y).toBeCloseTo(.4); expect(f.tableMove!.offset.z).toBeCloseTo(.6);
    f.right.gamepad.buttons[1].pressed=false; f.input.update(200,null);
    expect(f.pan).not.toHaveBeenCalled(); expect(f.controller.activateQuestTile).not.toHaveBeenCalled();
    f.input.dispose(); f.tableMove!.dispose();
  });
  it("left Y searches once per press and does not search through prompts", () => {
    const f = fixture();
    f.left.gamepad.buttons[5].pressed = true; f.input.update(0,null); f.input.update(50,null);
    expect(f.controller.sendInput).toHaveBeenCalledExactlyOnceWith("s");
    f.left.gamepad.buttons[5].pressed = false; f.input.update(100,null);
    game.current.question = { text: "Really?" };
    f.left.gamepad.buttons[5].pressed = true; f.input.update(150,null);
    expect(f.controller.sendInput).toHaveBeenCalledOnce(); f.input.dispose();
  });
  it("uses a direction-arrow mesh before the world beneath it", () => {
    const f = fixture();
    f.controller.chooseDirection = vi.fn();
    game.current.directionQuestion = "In what direction?";
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
    arrow.position.z = .1; arrow.userData.directionPromptOverlayButtonId = "northwest"; f.scene.add(arrow);
    f.scene.updateMatrixWorld(true);
    f.right.gamepad.buttons[0].pressed = true; f.input.update(0, null);
    f.right.gamepad.buttons[0].pressed = false; f.input.update(100, null);
    expect(f.controller.chooseDirection).toHaveBeenCalledExactlyOnceWith("7");
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled(); f.input.dispose();
  });
  it("quantizes any world-object hit from the prompt player tile in X/Y, including self", () => {
    const f = fixture();
    f.controller.chooseDirection = vi.fn();
    game.current.directionQuestion = "In what direction?";
    f.scene.userData.nh3dDirectionPromptPlayerTileX = 4;
    f.scene.userData.nh3dDirectionPromptPlayerTileY = 6;
    const monsterRoot = new THREE.Group(); monsterRoot.userData = { tileX: 5, tileY: 5 };
    const monster = new THREE.Mesh(new THREE.BoxGeometry(.4, .4, .4), new THREE.MeshBasicMaterial()); monster.position.set(0, 0, .4);
    monsterRoot.add(monster); f.scene.add(monsterRoot); f.scene.updateMatrixWorld(true);
    f.right.gamepad.buttons[0].pressed = true; f.input.update(0, null);
    f.right.gamepad.buttons[0].pressed = false; f.input.update(100, null);
    expect(f.controller.chooseDirection).toHaveBeenCalledExactlyOnceWith("9");
    f.controller.chooseDirection.mockClear(); monsterRoot.userData = { tileX: 4, tileY: 6 }; f.scene.updateMatrixWorld(true);
    f.right.gamepad.buttons[0].pressed = true; f.input.update(200, null);
    f.right.gamepad.buttons[0].pressed = false; f.input.update(300, null);
    expect(f.controller.chooseDirection).toHaveBeenCalledExactlyOnceWith("s");
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled(); f.input.dispose();
  });
  it("uses the bounded logical floor plane for FPS void clicks and direction prompts", () => {
    const f = fixture(); f.tile.visible = false; f.pose.makeTranslation(4, -6, 1);
    const fps = new THREE.Vector3(0, 1, 0);
    f.right.gamepad.buttons[0].pressed = true; f.input.update(0, fps);
    f.right.gamepad.buttons[0].pressed = false; f.input.update(100, fps);
    expect(f.controller.activateQuestTile).toHaveBeenCalledExactlyOnceWith(4, 6);
    f.controller.activateQuestTile.mockClear(); f.controller.chooseDirection = vi.fn();
    game.current.directionQuestion = "In what direction?";
    f.scene.userData.nh3dDirectionPromptPlayerTileX = 3;
    f.scene.userData.nh3dDirectionPromptPlayerTileY = 6;
    f.right.gamepad.buttons[0].pressed = true; f.input.update(200, fps);
    f.right.gamepad.buttons[0].pressed = false; f.input.update(300, fps);
    expect(f.controller.chooseDirection).toHaveBeenCalledExactlyOnceWith("6");
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled(); f.input.dispose();
  });
  it("grip captures the UI pane rather than panning or activating the world behind it", () => {
    const f = fixture();
    Object.assign(f.panel, { hit: () => ({ point: new THREE.Vector3(0,0,.5), distance: .5, x: 10,y: 10,target: {} }) });
    f.right.gamepad.buttons[1].pressed = true; f.input.update(0,null);
    f.pose.makeTranslation(.2,.1,1); f.input.update(100,null);
    expect(f.panel.beginGrab).toHaveBeenCalledOnce(); expect(f.panel.moveGrab).toHaveBeenCalled();
    expect(f.pan).not.toHaveBeenCalled();
    f.right.gamepad.buttons[1].pressed = false; f.input.update(200,null);
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled(); f.input.dispose();
  });
  it("A performs a left click even when held, without confirming or opening context", () => {
    const f = fixture();
    f.right.gamepad.buttons[4].pressed = true; f.input.update(0, null);
    f.input.update(800, null);
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled();
    f.right.gamepad.buttons[4].pressed = false; f.input.update(900, null);
    expect(f.controller.activateQuestTile).toHaveBeenCalledExactlyOnceWith(4, 6);
    expect(f.controller.sendInput).not.toHaveBeenCalled(); f.input.dispose();
  });
  it("grip tap opens context only on release, while grip drag pans without a click", () => {
    const f = fixture();
    f.right.gamepad.buttons[1].pressed = true; f.input.update(0, null); f.input.update(800, null);
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled();
    f.right.gamepad.buttons[1].pressed = false; f.input.update(900, null);
    expect(f.controller.activateQuestTile).toHaveBeenCalledExactlyOnceWith(4, 6, true);
    f.controller.activateQuestTile.mockClear();
    f.right.gamepad.buttons[1].pressed = true; f.input.update(1000, null);
    f.pose.makeTranslation(.2, .1, 1); f.input.update(1100, null);
    expect(f.pan).toHaveBeenCalledWith(.2, .1);
    f.right.gamepad.buttons[1].pressed = false; f.input.update(1200, null);
    expect(f.controller.activateQuestTile).not.toHaveBeenCalled(); f.input.dispose();
  });
  it("cancels grip across tracking/visibility loss until the hand releases", () => {
    const f = fixture();
    f.right.gamepad.buttons[1].pressed = true; f.input.update(0, null);
    f.session.visibilityState = "hidden"; f.input.update(10, null);
    f.session.visibilityState = "visible"; f.input.update(20, null);
    f.right.gamepad.buttons[1].pressed = false; f.input.update(30, null);
    expect(f.pan).not.toHaveBeenCalled(); expect(f.controller.activateQuestTile).not.toHaveBeenCalled(); f.input.dispose();
  });
  it("skips hidden raycasts while retaining child overlays and exact hit clipping", () => {
    const f = fixture();
    const clipped = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    clipped.position.x = 30; f.scene.add(clipped);
    const overlay = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
    overlay.position.set(-30, 0, 0.5); overlay.userData = { tileX: 8, tileY: 9 }; clipped.add(overlay);
    const hidden = new THREE.Group(); hidden.visible = false; f.scene.add(hidden);
    const hiddenMesh = overlay.clone(); hidden.add(hiddenMesh);
    f.renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1)];
    f.scene.updateMatrixWorld(true);
    const hiddenRaycast = vi.spyOn(hiddenMesh, "raycast");
    f.right.gamepad.buttons[0].pressed = true; f.input.update(0, null);
    f.right.gamepad.buttons[0].pressed = false; f.input.update(100, null);
    expect(f.controller.activateQuestTile).toHaveBeenCalledExactlyOnceWith(8, 9);
    expect(hiddenRaycast).not.toHaveBeenCalled();
    // The wide floor overlaps the boundary, but this ray hits its clipped part.
    overlay.visible = false; f.pose.makeTranslation(2, 0, 1);
    f.right.gamepad.buttons[0].pressed = true; f.input.update(200, null);
    f.right.gamepad.buttons[0].pressed = false; f.input.update(300, null);
    expect(f.controller.activateQuestTile).toHaveBeenCalledOnce();
    f.input.dispose();
  });
  it("converts physical rectangular-cell hits back to logical tile coordinates", () => {
    const f = fixture();
    f.scene.scale.x = 0.6;
    f.root.scale.x = 1 / 0.6;
    f.tile.position.set(4, -6, 0);
    f.tile.userData = {};
    f.pose.makeTranslation(4 * 0.6, -6, 1);
    f.scene.updateMatrixWorld(true);
    const context = vi.fn();
    Object.assign(f.panel, { nativePointer: { setControllerOpacity: vi.fn(), hit: vi.fn(), setContextTarget: context } });
    f.right.gamepad.buttons[0].pressed = true; f.input.update(0, null);
    f.input.update(450, null);
    expect(f.controller.activateQuestTile).toHaveBeenCalledExactlyOnceWith(4, 6, true);
    expect(context).toHaveBeenCalledExactlyOnceWith(new THREE.Vector3(2.4, -6, 0));
    f.input.dispose();
  });
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
