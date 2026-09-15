import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptDialogs, type PromptDialogsDependencies } from "./prompt-dialogs";
import { silentInventoryRefreshCommand } from "../../../runtime/input/inventory-refresh";

vi.mock("../../../state/gameStore", () => ({ useGameStore: {} }));
afterEach(() => vi.restoreAllMocks());

function fixture() {
  const sendInput = vi.fn();
  const gameplayInput = vi.fn();
  const engineState = { session: { sendInput } as { sendInput: typeof sendInput } | null };
  const questionMenus = { isInQuestion: false };
  const prompts = new PromptDialogs({
    engineState,
    questionMenus,
    directionPrompts: { isInDirectionQuestion: false },
    positionSelection: { positionInputModeActive: false },
    extendedCommands: { metaCommandModeActive: false },
    gameOver: { gameOverState: { active: false } },
    inputCommands: { sendInput: gameplayInput },
  } as unknown as PromptDialogsDependencies);
  vi.spyOn(console, "log").mockImplementation(() => {});
  return { prompts, sendInput, gameplayInput, engineState, questionMenus };
}

describe("silent inventory refresh dispatch", () => {
  it("requests a worker-scheduled snapshot when mutation arrives before the sell prompt", () => {
    const f = fixture();
    expect(f.prompts.requestSilentInventoryRefresh("inventory-updated-signal")).toBe(true);
    expect(f.sendInput).toHaveBeenCalledExactlyOnceWith(silentInventoryRefreshCommand);
    expect(f.gameplayInput).not.toHaveBeenCalled();
    expect(f.prompts.inventoryRefreshInFlight).toBe(true);
    expect(f.prompts.pendingInventoryDialog).toBe(false);
    expect(f.prompts.requestSilentInventoryRefresh("inventory-updated-signal")).toBe(false);
    expect(f.sendInput).toHaveBeenCalledOnce();
  });

  it("does not mark a refresh in flight without a runtime session", () => {
    const f = fixture();
    f.engineState.session = null;
    expect(f.prompts.requestSilentInventoryRefresh("fps-mode-enter")).toBe(false);
    expect(f.prompts.inventoryRefreshInFlight).toBe(false);
    expect(f.sendInput).not.toHaveBeenCalled();
  });

  it("keeps visible question prompts ahead of a refresh request", () => {
    const f = fixture();
    f.questionMenus.isInQuestion = true;
    expect(f.prompts.requestSilentInventoryRefresh("inventory-updated-signal")).toBe(false);
    expect(f.prompts.inventoryRefreshInFlight).toBe(false);
    expect(f.sendInput).not.toHaveBeenCalled();
    expect(f.gameplayInput).not.toHaveBeenCalled();
  });
});
