import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { MouseInput, type MouseInputDependencies } from "./mouse-input";
import { PositionSelection, type PositionSelectionDependencies } from "./position-selection";

function mouseFixture() {
  const tile = new THREE.Mesh();
  const events: string[] = [];
  const sendMouseInput = vi.fn(() => events.push("submit"));
  const farLook = vi.fn(() => false);
  const dependencies = {
    engineState: { session: {} },
    audioHapticsPlatform: { resumeFmodFromUserGesture: vi.fn() },
    promptDialogs: { isUiInputBlocked: () => false, isAnyModalVisible: () => false },
    questionMenus: { isInQuestion: false }, directionPrompts: { isInDirectionQuestion: false },
    extendedCommands: { metaCommandModeActive: false },
    tileRendering: { tileMap: new Map([["12,8", tile]]) },
    positionSelection: { handleFarLookPositionTileSelection: farLook },
    playerMovement: { hasPlayerMovedOnce: false, playerPos: {x:11,y:8} }, movementInput: { lastMovementInputAtMs: 0, isFpsMode: () => false, resolveDirectionFromDelta: vi.fn(()=>"6") },
    pointerTargeting: {shouldSearchAdjacentTerminalVoid:()=>false},
    renderPipeline: {renderer:{xr:{isPresenting:true}}},
    heldWeapon: {findHeldWeaponInventoryItem:vi.fn(()=>({text:"sword (weapon in hand)"}))},
    tileContextActions: { fpsCrosshairContextMenuOpen: false, openFpsCrosshairContextMenu: vi.fn(), closeFpsCrosshairContextMenu: vi.fn(), openNormalTileContextMenuAtTarget: vi.fn() },
    combatAttribution: {
      updateDirectionalAttackContextFromTarget: vi.fn(() => events.push("direction")),
      setPendingPointerAttackTargetFromTile: vi.fn(() => events.push("target")),
    },
    engineMessages: { logClickLookTileDebug: vi.fn() },
    inputCommands: { sendMouseInput, sendForcedDirectionalInput:vi.fn(), executeQuickAction:vi.fn(), sendInputSequence:vi.fn(), numberPadModeEnabled:true },
  };
  const mouse = new MouseInput(dependencies as unknown as MouseInputDependencies);
  return { mouse, tile, events, dependencies, sendMouseInput, farLook };
}

describe("native Quest map ray input", () => {
  it("uses existing tabletop and FPS context menus for secondary activation", () => {
    const f = mouseFixture();
    expect(f.mouse.activateQuestTile(12, 8, true)).toBe(true);
    expect(f.dependencies.tileContextActions.openNormalTileContextMenuAtTarget).toHaveBeenCalledWith({ key: "12,8", x: 12, y: 8, mesh: f.tile });
    expect(f.sendMouseInput).not.toHaveBeenCalled();
    f.dependencies.movementInput.isFpsMode = () => true;
    expect(f.mouse.activateQuestTile(0, 0, true)).toBe(true);
    expect(f.dependencies.tileContextActions.openFpsCrosshairContextMenu).toHaveBeenCalledExactlyOnceWith({ x: 0, y: 0 });
    f.dependencies.tileContextActions.fpsCrosshairContextMenuOpen = true;
    f.mouse.activateQuestTile(0, 0, true);
    expect(f.dependencies.tileContextActions.closeFpsCrosshairContextMenu).toHaveBeenCalledWith(true);
  });
  it("preserves pointer attack attribution before the normal mouse command", () => {
    const f = mouseFixture();
    expect(f.mouse.activateQuestTile(12, 8)).toBe(true);
    expect(f.events).toEqual(["direction", "target", "submit"]);
    expect(f.sendMouseInput).toHaveBeenCalledExactlyOnceWith(12, 8, 0, { allowFpsMovement: true });
    expect(f.dependencies.audioHapticsPlatform.resumeFmodFromUserGesture).toHaveBeenCalledOnce();
    expect(f.dependencies.movementInput.lastMovementInputAtMs).toBeGreaterThan(0);
  });

  it("uses the flat forced-direction fallback when the tabletop has no tile mesh", () => {
    const f=mouseFixture();expect(f.mouse.activateQuestTile(13,8)).toBe(true);
    expect(f.dependencies.movementInput.resolveDirectionFromDelta).toHaveBeenCalledWith(2,0);
    expect(f.dependencies.inputCommands.sendForcedDirectionalInput).toHaveBeenCalledWith("6");
    expect(f.sendMouseInput).not.toHaveBeenCalled();
    f.dependencies.movementInput.isFpsMode=()=>true;
    expect(f.mouse.activateQuestTile(13,8)).toBe(true);
    expect(f.dependencies.inputCommands.sendForcedDirectionalInput).toHaveBeenCalledTimes(2);
  });
  it("issues one normal force-fight sequence from either equipped hand and obeys prompts", () => {
    const f=mouseFixture();f.dependencies.movementInput.isFpsMode=()=>true;
    expect(f.mouse.attackQuestDirection(1,0,"left")).toBe(true);
    expect(f.dependencies.heldWeapon.findHeldWeaponInventoryItem).toHaveBeenCalledWith("left");
    expect(f.dependencies.inputCommands.sendInputSequence).toHaveBeenCalledWith(["F","6"]);
    expect(f.mouse.attackQuestDirection(0,-1,"right")).toBe(true);
    f.dependencies.questionMenus.isInQuestion=true;
    expect(f.mouse.attackQuestDirection(1,0,"left")).toBe(false);
    expect(f.mouse.attackQuestDirection(2,0,"right")).toBe(false);
    expect(f.dependencies.inputCommands.sendInputSequence).toHaveBeenCalledTimes(2);
  });
  it("rejects hidden/missing tiles and non-integral native ray coordinates", () => {
    const f = mouseFixture();
    for (const [x, y] of [[12.5, 8], [NaN, 8], [Infinity, 8]]) {
      expect(f.mouse.activateQuestTile(x, y)).toBe(false);
    }
    f.tile.visible = false;
    expect(f.mouse.activateQuestTile(12, 8)).toBe(false);
    expect(f.sendMouseInput).not.toHaveBeenCalled();
  });

  it("rechecks engine modal and prompt gates even if browser state is stale", () => {
    for (const gate of ["loading", "modal", "question", "direction", "extended"]) {
      const f = mouseFixture();
      if (gate === "loading") f.dependencies.promptDialogs.isUiInputBlocked = () => true;
      if (gate === "modal") f.dependencies.promptDialogs.isAnyModalVisible = () => true;
      if (gate === "question") f.dependencies.questionMenus.isInQuestion = true;
      if (gate === "direction") f.dependencies.directionPrompts.isInDirectionQuestion = true;
      if (gate === "extended") f.dependencies.extendedCommands.metaCommandModeActive = true;
      expect(f.mouse.activateQuestTile(12, 8)).toBe(false);
      expect(f.sendMouseInput).not.toHaveBeenCalled();
    }
  });

  it("lets far-look own a selection without issuing a gameplay click", () => {
    const f = mouseFixture(); f.farLook.mockReturnValue(true);
    expect(f.mouse.activateQuestTile(12, 8)).toBe(true);
    expect(f.farLook).toHaveBeenCalledExactlyOnceWith(12, 8, "quest-ray");
    expect(f.events).toEqual([]);
  });

  it("moves the far-look cursor on first selection and confirms on the second", () => {
    const sendInputSequence = vi.fn();
    const sendMouseInput = vi.fn();
    const dependencies = {
      movementInput: { getDirectionInputFromMapDelta: (dx: number, dy: number) => ["789", "456", "123"][dy + 1][dx + 1] },
      inputCommands: { sendInputSequence, sendMouseInput },
      engineMessages: { logClickLookTileDebug: vi.fn() },
    } as unknown as PositionSelectionDependencies;
    const position = new PositionSelection(dependencies);
    position.positionInputModeActive = true;
    position.positionInputOrigin = "far-look";
    position.positionCursor = { x: 5, y: 5 };
    vi.spyOn(position, "setPositionCursorPosition").mockImplementation((x, y) => { position.positionCursor = { x, y }; });
    expect(position.handleFarLookPositionTileSelection(7, 6, "quest-ray")).toBe(true);
    expect(position.positionCursor).toEqual({ x: 7, y: 6 });
    expect(sendInputSequence).toHaveBeenCalledExactlyOnceWith(["3", "6"]);
    expect(sendMouseInput).not.toHaveBeenCalled();
    expect(position.handleFarLookPositionTileSelection(7, 6, "quest-ray")).toBe(true);
    expect(sendMouseInput).toHaveBeenCalledExactlyOnceWith(7, 6, 0);
    expect(sendInputSequence).toHaveBeenCalledOnce();
  });
});
