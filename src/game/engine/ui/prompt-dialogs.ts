import { silentInventoryRefreshCommand } from "../../../runtime/input/inventory-refresh";
import { useGameStore } from "../../../state/gameStore";
import type { InventoryDialogState, NethackConnectionState } from "../../ui-types";
import { getItemTextClassName } from "../../helpers/helpers";
import type { InventoryDialogOptions } from "../shared/types";
import type { DirectionPrompts } from "./direction-prompts";
import type { EngineMessages } from "./engine-messages";
import type { EngineState } from "../runtime/engine-state";
import type { ExtendedCommands } from "./extended-commands";
import type { GameOver } from "./game-over";
import type { InputCommands } from "../input/input-commands";
import type { MenuPreviews } from "./menu-previews";
import type { Minimap } from "./minimap";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PointerLock } from "../input/pointer-lock";
import type { PositionSelection } from "../input/position-selection";
import type { QuestionMenus } from "./question-menus";
import type { TileContextActions } from "./tile-context-actions";
import type { TilesetAssets } from "../rendering/tileset-assets";
import type { TileUpdates } from "../world/tile-updates";

export interface PromptDialogsDependencies {
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "hideDirectionQuestion"
    | "isInDirectionQuestion"
  >;
  readonly engineMessages: Pick<
    EngineMessages,
    "addGameMessage"
  >;
  readonly engineState: Pick<
    EngineState,
    "session"
    | "uiAdapter"
  >;
  readonly extendedCommands: Pick<
    ExtendedCommands,
    "metaCommandModal"
    | "metaCommandModeActive"
  >;
  readonly gameOver: Pick<
    GameOver,
    "fulfillDeferredGameOverPromptReadyIfPossible"
    | "gameOverState"
  >;
  readonly inputCommands: Pick<
    InputCommands,
    "pendingInventoryContextPromptCloseRequestedAtMs"
    | "sendInput"
  >;
  readonly menuPreviews: Pick<
    MenuPreviews,
    "normalizeMenuItemsForUi"
  >;
  readonly minimap: Pick<
    Minimap,
    "updateMinimapVisibility"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "clearPlayerCliparoundInputCooldown"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "hasSeenPlayerPosition"
  >;
  readonly pointerLock: Pick<
    PointerLock,
    "syncFpsPointerLockForUiState"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "positionInputModeActive"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "hideQuestion"
    | "isInQuestion"
  >;
  readonly tileContextActions: Pick<
    TileContextActions,
    "closeAnyTileContextMenu"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "tilesetCompilationLoadingVisible"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "flushDeferredPlayerTileRefreshIfNeeded"
  >;
}

/** Inventory and information dialogs, text prompts, startup inventory refresh and input gates. */
export class PromptDialogs {
  constructor(private readonly dependencies: PromptDialogsDependencies) {}

  readonly startupInventoryRefreshDelayMs: number = 1200;

  currentInventory: any[] = [];
 // Store current inventory items
  pendingInventoryDialog: boolean = false;
 // Flag to show inventory dialog after update
  pendingInventoryDialogOptions: InventoryDialogOptions | null = null;

  inventoryRefreshInFlight: boolean = false;

  pendingStartupInventoryRefresh: boolean = false;

  pendingStartupInventoryRefreshEarliestAtMs: number = 0;

  runtimeTerminationPromptShown: boolean = false;

  runtimeConnectionState: NethackConnectionState = "disconnected";

  lastMessageInfoMenu: { title: string; lines: string[] } | null = null;

  isInventoryDialogVisible: boolean = false;

  inventoryContextActionsEnabled: boolean = true;

  isInfoDialogVisible: boolean = false;

  infoMenuBlockingActive: boolean = false;

  isTextInputActive: boolean = false;

  runtimeLoadingVisible = true;

  normalizeInfoMenuLines(rawLines: unknown): string[] {
    if (!Array.isArray(rawLines)) {
      return [];
    }
    return rawLines.map((line) =>
      String(line ?? "")
        .replace(/\r/g, "")
        .trimEnd(),
    );
  }

  isNetHackMessageInfoMenuTitle(title: string): boolean {
    return (
      String(title || "")
        .trim()
        .toLowerCase() === "nethack message"
    );
  }

  showFloatingGameMessage(message: string): void {
    this.dependencies.engineState.uiAdapter.pushFloatingMessage(message);
  }

  updateStatus(status: string): void {
    this.dependencies.engineState.uiAdapter.setStatus(status);
  }

  updateConnectionStatus(
    status: string,
    state: NethackConnectionState,
  ): void {
    this.runtimeConnectionState = state;
    this.dependencies.engineState.uiAdapter.setConnectionStatus(status, state);
    this.dependencies.minimap.updateMinimapVisibility();
  }

  setNewGamePrompt(visible: boolean, reason: string | null): void {
    this.dependencies.engineState.uiAdapter.setNewGamePrompt({
      visible,
      reason: reason && reason.trim() ? reason.trim() : null,
    });
  }

  handleRuntimeTermination(reason: string): void {
    if (this.runtimeTerminationPromptShown) {
      return;
    }
    this.runtimeTerminationPromptShown = true;

    this.dependencies.questionMenus.hideQuestion();
    this.dependencies.directionPrompts.hideDirectionQuestion();
    this.hideTextInputRequest();
    this.dependencies.movementInput.clearPlayerCliparoundInputCooldown();
    this.hideInventoryDialog();
    this.dependencies.tileContextActions.closeAnyTileContextMenu(false);

    this.dependencies.engineState.uiAdapter.setPositionRequest(null);
    this.dependencies.engineState.uiAdapter.setPositionInputActive(false);
    this.dependencies.engineState.uiAdapter.setFpsCrosshairContext(null);
    this.dependencies.engineState.uiAdapter.setRepeatActionVisible(false);

    this.updateConnectionStatus("Game ended", "error");
    this.updateStatus("Game ended");
    this.setLoadingVisible(false);
    this.dependencies.engineMessages.addGameMessage("Game ended.");
    this.setNewGamePrompt(true, reason);
  }

  handleRuntimeError(errorMessage: string): void {
    const normalizedMessage =
      typeof errorMessage === "string" && errorMessage.trim()
        ? errorMessage.trim()
        : "Runtime error";
    const normalizedLower = normalizedMessage.toLowerCase();
    const looksLikeNormalTermination =
      (normalizedLower.includes("exitstatus") &&
        normalizedLower.includes("exit(0)")) ||
      normalizedLower.includes("program terminated with exit(0)") ||
      normalizedLower.includes("asyncify wakeup failed");
    if (looksLikeNormalTermination) {
      this.handleRuntimeTermination(normalizedMessage);
      return;
    }
    console.error("Runtime error:", normalizedMessage);
    this.updateConnectionStatus("Error", "error");
    this.updateStatus("Runtime error");
    this.dependencies.engineMessages.addGameMessage(normalizedMessage);
  }

  isUiInputBlocked(): boolean {
    const { loadingVisible, uiBlockingVisible } = useGameStore.getState();
    return loadingVisible || uiBlockingVisible;
  }

  syncLoadingVisibility(): void {
    this.dependencies.engineState.uiAdapter.setLoadingVisible(
      this.runtimeLoadingVisible || this.dependencies.tilesetAssets.tilesetCompilationLoadingVisible,
    );
  }

  setLoadingVisible(visible: boolean): void {
    this.runtimeLoadingVisible = Boolean(visible);
    this.syncLoadingVisibility();
  }

  updateInventoryDisplay(items: any[]): void {
    const nextInventory = this.dependencies.menuPreviews.normalizeMenuItemsForUi(items);
    this.currentInventory = nextInventory;

    this.dependencies.engineState.uiAdapter.setInventory(this.buildInventoryDialogState());
  }

  buildInventoryDialogState(): InventoryDialogState {
    const items = this.currentInventory.map((item) => {
      if (item.text) {
        return {
          ...item,
          className: getItemTextClassName(item.text),
        };
      }
      return item;
    });

    return {
      visible: this.isInventoryDialogVisible,
      items: items,
      contextActionsEnabled:
        this.inventoryContextActionsEnabled && !this.dependencies.gameOver.gameOverState.active,
    };
  }

  showInfoMenuDialog(
    title: string,
    lines: string[],
    options: { blocking?: boolean } = {},
  ): void {
    this.isInfoDialogVisible = true;
    this.infoMenuBlockingActive = Boolean(options.blocking);
    this.dependencies.pointerLock.syncFpsPointerLockForUiState(false);
    const normalizedLines = this.normalizeInfoMenuLines(lines);
    this.dependencies.engineState.uiAdapter.setInfoMenu({
      title: title || "NetHack Information",
      lines: normalizedLines,
    });
  }

  hideInfoMenuDialog(): void {
    this.dismissBlockingInfoMenuIfNeeded();
    this.isInfoDialogVisible = false;
    this.dependencies.engineState.uiAdapter.setInfoMenu(null);
    this.dependencies.pointerLock.syncFpsPointerLockForUiState(true);
    this.dependencies.gameOver.fulfillDeferredGameOverPromptReadyIfPossible();
    this.dependencies.tileUpdates.flushDeferredPlayerTileRefreshIfNeeded("info-menu-closed");
  }

  dismissBlockingInfoMenuIfNeeded(): void {
    if (!this.infoMenuBlockingActive) {
      return;
    }
    this.infoMenuBlockingActive = false;
    if (this.dependencies.engineState.session) {
      this.dependencies.engineState.session.sendInput(" ");
    }
  }

  toggleInfoMenuDialog(): void {
    if (this.isInfoDialogVisible) {
      this.hideInfoMenuDialog();
      return;
    }

    if (this.lastMessageInfoMenu) {
      this.showInfoMenuDialog(
        this.lastMessageInfoMenu.title,
        this.lastMessageInfoMenu.lines,
        {
          blocking: false,
        },
      );
    } else {
      this.dependencies.engineMessages.addGameMessage("No recent NetHack message to reopen.");
    }
  }

  showInventoryDialog(options?: InventoryDialogOptions): void {
    this.isInventoryDialogVisible = true;
    const shouldDisableForGameOver = this.dependencies.gameOver.gameOverState.active;
    this.inventoryContextActionsEnabled = shouldDisableForGameOver
      ? false
      : options?.contextActionsEnabled !== false;
    this.pendingInventoryDialogOptions = null;
    this.dependencies.pointerLock.syncFpsPointerLockForUiState(false);
    this.dependencies.engineState.uiAdapter.setInventory(this.buildInventoryDialogState());
  }

  hideInventoryDialog(): void {
    this.isInventoryDialogVisible = false;
    this.dependencies.inputCommands.pendingInventoryContextPromptCloseRequestedAtMs = 0;
    this.inventoryContextActionsEnabled = true;
    this.pendingInventoryDialogOptions = null;
    this.dependencies.engineState.uiAdapter.setInventory(this.buildInventoryDialogState());
    this.pendingInventoryDialog = false;
    this.dependencies.pointerLock.syncFpsPointerLockForUiState(true);
  }

  hasInventorySnapshot(): boolean {
    return this.currentInventory.some(
      (item) => item && typeof item === "object" && item.isCategory !== true,
    );
  }

  requestSilentInventoryRefresh(reason: string): boolean {
    const session = this.dependencies.engineState.session;
    if (
      !session ||
      this.inventoryRefreshInFlight ||
      this.isInventoryDialogVisible ||
      this.dependencies.questionMenus.isInQuestion ||
      this.dependencies.directionPrompts.isInDirectionQuestion ||
      this.dependencies.positionSelection.positionInputModeActive ||
      this.dependencies.extendedCommands.metaCommandModeActive ||
      this.isInfoDialogVisible ||
      this.dependencies.gameOver.gameOverState.active
    ) {
      return false;
    }
    console.log(`Requesting silent inventory refresh (${reason})...`);
    this.inventoryRefreshInFlight = true;
    this.pendingInventoryDialog = false;
    this.pendingInventoryDialogOptions = null;
    // An inventory mutation can precede a sell prompt in the same command.
    // Let the worker wait for an ordinary command prompt before sending i.
    session.sendInput(silentInventoryRefreshCommand);
    return true;
  }

  isStartupInventoryRefreshReady(): boolean {
    return (
      this.pendingStartupInventoryRefresh &&
      this.runtimeConnectionState === "running" &&
      this.dependencies.playerMovement.hasSeenPlayerPosition &&
      Date.now() >= this.pendingStartupInventoryRefreshEarliestAtMs &&
      !this.inventoryRefreshInFlight &&
      !this.isInventoryDialogVisible &&
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      !this.dependencies.positionSelection.positionInputModeActive &&
      !this.dependencies.extendedCommands.metaCommandModeActive &&
      !this.isInfoDialogVisible &&
      !this.infoMenuBlockingActive &&
      !this.dependencies.gameOver.gameOverState.active
    );
  }

  maybeRequestPendingStartupInventoryRefresh(): void {
    if (!this.pendingStartupInventoryRefresh) {
      return;
    }
    if (this.hasInventorySnapshot()) {
      this.pendingStartupInventoryRefresh = false;
      this.pendingStartupInventoryRefreshEarliestAtMs = 0;
      return;
    }
    if (!this.isStartupInventoryRefreshReady()) {
      return;
    }
    if (this.requestSilentInventoryRefresh("game-start")) {
      this.pendingStartupInventoryRefresh = false;
      this.pendingStartupInventoryRefreshEarliestAtMs = 0;
    }
  }

  toggleInventoryDialogState(): void {
    if (
      this.dependencies.questionMenus.isInQuestion ||
      this.dependencies.directionPrompts.isInDirectionQuestion ||
      this.dependencies.positionSelection.positionInputModeActive ||
      this.dependencies.extendedCommands.metaCommandModeActive
    ) {
      return;
    }

    this.hideInfoMenuDialog();
    if (this.isInventoryDialogOpen()) {
      console.log("Closing inventory dialog");
      this.hideInventoryDialog();
      return;
    }

    console.log("Requesting current inventory from NetHack...");
    this.inventoryRefreshInFlight = true;
    this.dependencies.inputCommands.sendInput("i");
    this.pendingInventoryDialog = true;
  }

  showTextInputRequest(
    text: string,
    maxLength = 256,
    contextMessage = "",
  ): void {
    this.dependencies.questionMenus.isInQuestion = true;
    this.isTextInputActive = true;
    this.dependencies.pointerLock.syncFpsPointerLockForUiState(false);
    const normalizedContextMessage = String(contextMessage || "").trim();
    this.dependencies.engineState.uiAdapter.setTextInput({
      text: String(text || ""),
      contextMessage: normalizedContextMessage || undefined,
      maxLength,
      placeholder: "Enter text",
    });
  }

  hideTextInputRequest(): void {
    if (!this.isTextInputActive) {
      return;
    }

    this.isTextInputActive = false;
    this.dependencies.questionMenus.isInQuestion = false;
    this.dependencies.engineState.uiAdapter.setTextInput(null);
    this.dependencies.pointerLock.syncFpsPointerLockForUiState(true);
  }

  closeInventoryDialog(): void {
    this.hideInventoryDialog();
  }

  closeInfoMenuDialog(): void {
    this.hideInfoMenuDialog();
  }

  isInventoryDialogOpen(): boolean {
    return this.isInventoryDialogVisible;
  }

  isInfoDialogOpen(): boolean {
    return this.isInfoDialogVisible;
  }

  isClientOptionsDialogOpen(): boolean {
    return Boolean(
      document.querySelector<HTMLElement>(
        "#nh3d-client-options-dialog.is-visible",
      ),
    );
  }

  isAnyModalVisible(): boolean {
    if (this.dependencies.extendedCommands.metaCommandModal?.classList.contains("is-visible")) {
      return true;
    }

    if (document.querySelector(".nh3d-dialog.is-visible")) {
      return true;
    }
    if (document.querySelector(".nh3d-mobile-actions-sheet")) {
      return true;
    }
    if (document.querySelector(".nh3d-wizard-commands-sheet.is-visible")) {
      return true;
    }
    const mobileLog = document.querySelector(".nh3d-mobile-log");
    if (
      mobileLog &&
      !mobileLog.classList.contains("nh3d-mobile-log-collapsed")
    ) {
      return true;
    }
    return false;
  }
}
