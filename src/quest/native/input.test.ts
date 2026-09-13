import { describe, expect, it, vi } from "vitest";
import { parseQuestCommand, questDirectionKey, routeQuestCommand, type QuestInputState, type QuestInputUi } from "./input";
function fixture() {
  const controller = { sendInput: vi.fn(), chooseDirection: vi.fn(), toggleInventoryDialog: vi.fn(), activateQuestTile: vi.fn(() => true) };
  const state: QuestInputState = {
    engineController: controller, loadingVisible: false, uiBlockingVisible: false, connectionState: "running",
    question: null, directionQuestion: null, infoMenu: null, inventory: { visible: false }, textInput: null,
    positionInputActive: false, newGamePrompt: { visible: false }, gameOver: { active: false }, numberPadModeEnabled: true,
  };
  const ui: QuestInputUi = { hasBlockingOverlay: false, editableFocused: false, dispatchKey: vi.fn() };
  return { controller, state, ui };
}

describe("native Quest input", () => {
  it("uses the existing run action and leaves direction prompts unmodified", () => {
    const f = fixture(), run = vi.fn();
    f.state.engineController!.runQuestDirection = run;
    expect(routeQuestCommand({ type: "move", dx: 1, dy: 0, run: true }, f.state, f.ui).accepted).toBe(true);
    expect(run).toHaveBeenCalledExactlyOnceWith("6");
    f.state.directionQuestion = "Where?";
    routeQuestCommand({ type: "move", dx: 0, dy: -1, run: true }, f.state, f.ui);
    expect(run).toHaveBeenCalledOnce(); expect(f.controller.chooseDirection).toHaveBeenCalledWith("8");
  });
  it("routes a secondary tile action without issuing a primary click", () => {
    const f = fixture();
    routeQuestCommand({ type: "tile", x: 4, y: 6, secondary: true }, f.state, f.ui);
    expect(f.controller.activateQuestTile).toHaveBeenCalledExactlyOnceWith(4, 6, true);
    expect(parseQuestCommand({ type: "move", dx: 1, dy: 0, run: "yes" })).toBeNull();
  });
  it("rejects unsupported, malformed, and unbounded commands", () => {
    for (const value of [null, [], { type: "move", dx: 0, dy: 0 }, { type: "move", dx: 2, dy: 0 },
      { type: "tile", x: Infinity, y: 1 }, { type: "tile", x: 1.5, y: 1 }, { type: "tile", x: -1, y: 1 },
      { type: "key", key: "F12" }, { type: "inventory", extra: true }, { type: "wait", duration: 100 },
    ]) expect(parseQuestCommand(value)).toBeNull();
    expect(parseQuestCommand({ type: "wait" })).toEqual({ type: "wait" });
    expect(parseQuestCommand({ type: "move", dx: -1, dy: 1 })).toEqual({ type: "move", dx: -1, dy: 1 });
  });

  it("maps eight map directions in both runtime keypad settings", () => {
    expect([-1, 0, 1].flatMap((dy) => [-1, 0, 1].filter((dx) => dx || dy).map((dx) => questDirectionKey(dx, dy, true))).join("")).toBe("78946123");
    expect([-1, 0, 1].flatMap((dy) => [-1, 0, 1].filter((dx) => dx || dy).map((dx) => questDirectionKey(dx, dy, false))).join("")).toBe("ykuhlbjn");
  });

  it("submits one movement with explicit numpad intent", () => {
    const f = fixture();
    expect(routeQuestCommand({ type: "move", dx: 1, dy: -1 }, f.state, f.ui).accepted).toBe(true);
    expect(f.controller.sendInput).toHaveBeenCalledExactlyOnceWith("Numpad9");
    f.state.numberPadModeEnabled = false;
    routeQuestCommand({ type: "move", dx: 1, dy: -1 }, f.state, f.ui);
    expect(f.controller.sendInput).toHaveBeenLastCalledWith("u");
  });

  it("blocks movement across loading, startup, game over and every modal owner", () => {
    const cases: Partial<QuestInputState>[] = [
      { loadingVisible: true }, { uiBlockingVisible: true }, { connectionState: "starting" },
      { engineController: null }, { newGamePrompt: { visible: true } }, { gameOver: { active: true } },
      { question: {} }, { textInput: {} }, { infoMenu: {} }, { inventory: { visible: true } },
    ];
    for (const change of cases) {
      const f = fixture();
      expect(routeQuestCommand({ type: "move", dx: 0, dy: -1 }, { ...f.state, ...change }, f.ui).accepted).toBe(false);
      expect(f.controller.sendInput).not.toHaveBeenCalled();
    }
    for (const change of [{ hasBlockingOverlay: true }, { editableFocused: true }]) {
      const f = fixture();
      expect(routeQuestCommand({ type: "move", dx: 0, dy: -1 }, f.state, { ...f.ui, ...change }).accepted).toBe(false);
    }
  });

  it("direction prompts consume movement through the existing direction API", () => {
    const f = fixture(); f.state.directionQuestion = "In what direction?";
    routeQuestCommand({ type: "move", dx: -1, dy: 0 }, f.state, f.ui);
    expect(f.controller.chooseDirection).toHaveBeenCalledExactlyOnceWith("4");
    expect(f.controller.sendInput).not.toHaveBeenCalled();
  });

  it("position prompts keep cursor movement but reject wait and inventory", () => {
    const f = fixture(); f.state.positionInputActive = true;
    expect(routeQuestCommand({ type: "move", dx: 0, dy: 1 }, f.state, f.ui).accepted).toBe(true);
    expect(f.controller.sendInput).toHaveBeenCalledExactlyOnceWith("Numpad2");
    expect(routeQuestCommand({ type: "wait" }, f.state, f.ui).accepted).toBe(false);
    expect(routeQuestCommand({ type: "inventory" }, f.state, f.ui).accepted).toBe(false);
  });

  it("routes ray selections to the engine and reports rejected/hidden targets", () => {
    const f = fixture();
    expect(routeQuestCommand({ type: "tile", x: 12, y: 8 }, f.state, f.ui).accepted).toBe(true);
    expect(f.controller.activateQuestTile).toHaveBeenCalledExactlyOnceWith(12, 8);
    f.controller.activateQuestTile.mockReturnValue(false);
    expect(routeQuestCommand({ type: "tile", x: 13, y: 8 }, f.state, f.ui).accepted).toBe(false);
  });

  it("inventory toggles its existing controller and wait consumes exactly one turn", () => {
    const f = fixture();
    routeQuestCommand({ type: "inventory" }, f.state, f.ui);
    expect(f.controller.toggleInventoryDialog).toHaveBeenCalledOnce();
    routeQuestCommand({ type: "wait" }, f.state, f.ui);
    expect(f.controller.sendInput).toHaveBeenCalledExactlyOnceWith(".");
    f.state.directionQuestion = "Direction?";
    expect(routeQuestCommand({ type: "wait" }, f.state, f.ui).accepted).toBe(false);
  });

  it("Escape and Enter retain application UI routing before a game starts", () => {
    const f = fixture(); f.state.engineController = null; f.state.connectionState = "disconnected";
    for (const key of ["Escape", "Enter"]) expect(routeQuestCommand({ type: "key", key }, f.state, f.ui).accepted).toBe(true);
    expect(f.ui.dispatchKey).toHaveBeenCalledWith("Escape");
    expect(f.ui.dispatchKey).toHaveBeenCalledWith("Enter");
  });
});
