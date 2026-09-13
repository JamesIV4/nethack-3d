import type { Nethack3DEngineController } from "../../game/ui-types";

export type QuestNativeCommand =
  | { type: "move"; dx: number; dy: number; run?: boolean }
  | { type: "tile"; x: number; y: number; secondary?: boolean }
  | { type: "key"; key: string }
  | { type: "inventory" }
  | { type: "wait" };
export type QuestCommandResult = { accepted: boolean; reason?: string };
export interface QuestInputState {
  engineController: (Pick<Nethack3DEngineController, "sendInput" | "chooseDirection" | "toggleInventoryDialog" | "activateQuestTile"> & Partial<Pick<Nethack3DEngineController, "runQuestDirection">>) | null;
  loadingVisible: boolean;
  uiBlockingVisible: boolean;
  connectionState: string;
  question: unknown;
  directionQuestion: string | null;
  infoMenu: unknown;
  inventory: { visible: boolean };
  textInput: unknown;
  positionInputActive: boolean;
  newGamePrompt: { visible: boolean };
  gameOver: { active: boolean };
  numberPadModeEnabled: boolean;
}
export interface QuestInputUi {
  hasBlockingOverlay: boolean;
  editableFocused: boolean;
  dispatchKey(key: string): void;
}
const keys = new Set(["Enter", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "Backspace", " "]);
export function parseQuestCommand(value: unknown): QuestNativeCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const command = value as Record<string, unknown>;
  if ((command.type === "inventory" || command.type === "wait") && Object.keys(command).length === 1) return { type: command.type };
  if (command.type === "key" && Object.keys(command).length === 2 && typeof command.key === "string" && keys.has(command.key)) {
    return { type: "key", key: command.key };
  }
  if (command.type === "move" && Object.keys(command).every(key => ["type", "dx", "dy", "run"].includes(key)) &&
      (command.run === undefined || typeof command.run === "boolean") &&
      Number.isInteger(command.dx) && Number.isInteger(command.dy) &&
      Math.abs(command.dx as number) <= 1 && Math.abs(command.dy as number) <= 1 &&
      (command.dx !== 0 || command.dy !== 0)) {
    return { type: "move", dx: command.dx as number, dy: command.dy as number, ...(command.run !== undefined ? { run: command.run as boolean } : {}) };
  }
  if (command.type === "tile" && Object.keys(command).every(key => ["type", "x", "y", "secondary"].includes(key)) &&
      (command.secondary === undefined || typeof command.secondary === "boolean") &&
      Number.isInteger(command.x) && Number.isInteger(command.y) &&
      (command.x as number) >= 0 && (command.x as number) <= 255 &&
      (command.y as number) >= 0 && (command.y as number) <= 255) {
    return { type: "tile", x: command.x as number, y: command.y as number, ...(command.secondary !== undefined ? { secondary: command.secondary as boolean } : {}) };
  }
  return null;
}

export function questDirectionKey(dx: number, dy: number, numberPad: boolean): string {
  const row = dy + 1, column = dx + 1;
  return (numberPad ? ["789", "456", "123"] : ["yku", "h.l", "bjn"])[row]?.[column] ?? "";
}

export function routeQuestCommand(command: QuestNativeCommand, state: QuestInputState, ui: QuestInputUi): QuestCommandResult {
  const deny = (reason: string): QuestCommandResult => ({ accepted: false, reason });
  if (state.loadingVisible || state.uiBlockingVisible) return deny("Wait for loading to finish.");
  // Escape/Enter/arrows use the same application listener priority as a keyboard,
  // including startup and pause menus that live outside the engine controller.
  if (command.type === "key") { ui.dispatchKey(command.key); return { accepted: true }; }
  const controller = state.engineController;
  if (!controller || state.connectionState !== "running" || state.newGamePrompt.visible || state.gameOver.active) {
    return deny("Start or resume a game first.");
  }
  if (ui.hasBlockingOverlay || ui.editableFocused || state.textInput || state.infoMenu || state.question) {
    return deny("Finish the active dialog first.");
  }
  if (command.type === "inventory") {
    if (state.directionQuestion || state.positionInputActive) return deny("Finish the active prompt first.");
    controller.toggleInventoryDialog();
    return { accepted: true };
  }
  if (state.inventory.visible) return deny("Close inventory first.");
  if (command.type === "wait") {
    if (state.directionQuestion || state.positionInputActive) return deny("Finish the active prompt first.");
    controller.sendInput(".");
    return { accepted: true };
  }
  if (command.type === "move") {
    const key = questDirectionKey(command.dx, command.dy, state.numberPadModeEnabled);
    if (state.directionQuestion) controller.chooseDirection(key);
    else if (command.run && !state.positionInputActive) {
      if (!controller.runQuestDirection) return deny("Running is not available in this host.");
      controller.runQuestDirection(key);
    }
    else controller.sendInput(state.numberPadModeEnabled ? `Numpad${key}` : key);
    return { accepted: true };
  }
  if (state.directionQuestion) return deny("Choose a direction on the controls.");
  const accepted = command.secondary ? controller.activateQuestTile(command.x, command.y, true) : controller.activateQuestTile(command.x, command.y);
  return accepted ? { accepted: true } : deny("This tile cannot be selected now.");
}
