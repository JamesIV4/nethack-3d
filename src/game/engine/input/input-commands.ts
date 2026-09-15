import { resolveSlashEmCommandInputBinding } from "../../slashem-command-capabilities";
import { nh3dOpenCharacterSheetEventName } from "../../ui-types";
import type { RepeatableActionSpec } from "../shared/types";
import type { AudioHapticsPlatform } from "../audio/audio-haptics-platform";
import type { Camera } from "../camera/camera";
import type { CombatAttribution } from "../world/combat-attribution";
import type { ControllerGameplay } from "./controller-gameplay";
import type { DarkCorridorInference } from "../world/dark-corridor-inference";
import type { DirectionPrompts } from "../ui/direction-prompts";
import type { EngineMessages } from "../ui/engine-messages";
import type { EngineState } from "../runtime/engine-state";
import type { ExtendedCommands } from "../ui/extended-commands";
import type { GameOver } from "../ui/game-over";
import type { MovementInput } from "./movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PositionSelection } from "./position-selection";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { QuestionMenus } from "../ui/question-menus";
import type { RunTelemetry } from "../world/run-telemetry";
import type { TileContextActions } from "../ui/tile-context-actions";
import type { TilesetAssets } from "../rendering/tileset-assets";
import type { TileUpdates } from "../world/tile-updates";

export interface InputCommandsDependencies {
  readonly audioHapticsPlatform: Pick<
    AudioHapticsPlatform,
    "armPendingPlayerFootstepSound"
    | "armPendingThrownWeaponDirectionSound"
    | "clearPendingThrownWeaponDirectionSound"
    | "maybePlayDrinkSoundForInventoryItemAction"
    | "maybePlayThrownWeaponSoundForDirectionAnswer"
    | "shouldArmPlayerFootstepFromMouseInput"
  >;
  readonly camera: Pick<
    Camera,
    "fpsAutoMoveDirection"
    | "fpsAutoTurnTargetYaw"
    | "lastManualDirectionalInputAtMs"
    | "lastRunLikeInputAtMs"
  >;
  readonly combatAttribution: Pick<
    CombatAttribution,
    "armPendingFpsHeldWeaponMeleeSwipeFromMovementInput"
    | "pendingFpsHeldWeaponMeleeSwipeContext"
    | "pendingPointerAttackTargetContext"
    | "updateDirectionalAttackContext"
  >;
  readonly controllerGameplay: Pick<
    ControllerGameplay,
    "consumeControllerFpsDirectionPromptUi"
    | "controllerDirectionPromptPreviewInput"
  >;
  readonly darkCorridorInference: Pick<
    DarkCorridorInference,
    "beginDarkCorridorDiscoveryWindowFromPlayerInput"
    | "shouldEnableBlindDarkCorridorInferenceForInput"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "confirmDirectionPromptOverlayButton"
    | "confirmFpsDirectionQuestionFromAim"
    | "directionPromptHoveredButtonId"
    | "directionPromptPressedButtonId"
    | "hideDirectionQuestion"
    | "isInDirectionQuestion"
    | "resolveDirectionPromptOverlayButtonFromInput"
  >;
  readonly engineMessages: Pick<
    EngineMessages,
    "addGameMessage"
    | "logClickLookTileDebug"
    | "logNameInputTrace"
  >;
  readonly engineState: Pick<
    EngineState,
    "session"
    | "uiAdapter"
  >;
  readonly extendedCommands: Pick<
    ExtendedCommands,
    "metaCommandModeActive"
  >;
  readonly gameOver: Pick<
    GameOver,
    "gameOverState"
    | "pendingSuppressedGameOverReportKind"
    | "resolveGameOverPostmortemReportKindFromQuestion"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "armFpsFireSuppression"
    | "armPlayerCliparoundInputCooldown"
    | "getFpsDirectionQuestionInputFromAim"
    | "isFpsMode"
    | "isMovementInput"
    | "isNumpadRunPrefixInput"
    | "isRunMovementInput"
    | "isRunPrefixInput"
    | "lastMovementInputAtMs"
    | "resolveDirectionFromDelta"
    | "resolveDirectionQuestionInputForCurrentCamera"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "hasPlayerMovedOnce"
    | "playerPos"
    | "setFpsPredictedPlayerTileFromMovementInput"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "cancelPositionInputMode"
    | "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "hideInfoMenuDialog"
    | "hideInventoryDialog"
    | "hideTextInputRequest"
    | "isInventoryDialogOpen"
    | "isTextInputActive"
    | "toggleInventoryDialogState"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "activeQuestionText"
    | "hideQuestion"
    | "isInQuestion"
    | "isNumberPadModeQuestion"
  >;
  readonly runTelemetry: Pick<
    RunTelemetry,
    "recentSpellKillAttribution"
  >;
  readonly tileContextActions: Pick<
    TileContextActions,
    "activeContextActionTile"
    | "closeAnyTileContextMenu"
    | "closeNormalTileContextMenu"
    | "fpsCrosshairGlancePending"
    | "fpsCrosshairGlanceTimeoutMs"
    | "normalTileContextMenuOpen"
    | "normalTileContextSignature"
    | "sanitizeFpsCrosshairGlanceText"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "resolveRuntimeVersion"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "getPlayerTileRefreshReasonForItemCommandInput"
    | "requestDirectionalAnswerTileRefresh"
    | "requestPlayerTileRefresh"
  >;
}

/** Runtime input transport, commands, repeat actions and automatic direction answers. */
export class InputCommands {
  constructor(private readonly dependencies: InputCommandsDependencies) {}

  pendingInventoryContextPromptCloseRequestedAtMs: number = 0;

  readonly inventoryContextPromptCloseWindowMs: number = 2200;

  readonly metaInputPrefix = "__META__:";

  readonly ctrlInputPrefix = "__CTRL__:";

  readonly menuSelectionInputPrefix = "__MENU_SELECT__:";

  readonly textInputPrefix = "__TEXT_INPUT__:";

  readonly inventoryContextSelectionPrefix = "__INVCTX_SELECT__:";

  readonly inventoryContextSelectionCountPrefix =
    "__INVCTX_SELECT_COUNT__:";

  readonly contextualGlanceProbePrefix = "__CTX_GLANCE_PROBE__";

  readonly contextualLookInfoProbePrefix = "__CTX_LOOK_INFO_PROBE__";

  repeatableAction: RepeatableActionSpec | null = null;

  repeatActionVisible: boolean = false;

  repeatAutoDirectionPending: boolean = false;

  repeatAutoDirectionArmedAtMs: number = 0;

  readonly repeatAutoDirectionWindowMs: number = 1800;

  fpsContextAutoDirectionInput: string | null = null;

  fpsContextAutoDirectionArmedAtMs: number = 0;

  readonly fpsContextAutoDirectionWindowMs: number = 10000;

  repeatDirectionCandidate: RepeatableActionSpec | null = null;

  repeatDirectionCandidateAtMs: number = 0;

  readonly repeatDirectionCandidateWindowMs: number = 1100;

  lastRepeatDirectionInput: string | null = null;

  skipNextMobileFpsClickLookPromptMessage: boolean = false;

  numberPadModeEnabled: boolean = true;

  setRepeatActionVisible(visible: boolean): void {
    if (this.repeatActionVisible === visible) {
      return;
    }
    this.repeatActionVisible = visible;
    this.dependencies.engineState.uiAdapter.setRepeatActionVisible(visible);
  }

  armRepeatableAction(action: RepeatableActionSpec): void {
    this.repeatableAction = action;
    this.repeatAutoDirectionPending = false;
    this.repeatAutoDirectionArmedAtMs = 0;
    this.repeatDirectionCandidate = null;
    this.repeatDirectionCandidateAtMs = 0;
    this.setRepeatActionVisible(true);
  }

  clearRepeatableAction(): void {
    this.repeatableAction = null;
    this.repeatAutoDirectionPending = false;
    this.repeatAutoDirectionArmedAtMs = 0;
    this.repeatDirectionCandidate = null;
    this.repeatDirectionCandidateAtMs = 0;
    this.setRepeatActionVisible(false);
  }

  onSwipeCommandExecuted(): void {
    this.clearRepeatableAction();
  }

  queueRepeatDirectionCandidate(action: RepeatableActionSpec): void {
    this.repeatDirectionCandidate = action;
    this.repeatDirectionCandidateAtMs = Date.now();
  }

  consumeRepeatDirectionCandidate(): RepeatableActionSpec | null {
    const candidate = this.repeatDirectionCandidate;
    const ageMs = Date.now() - this.repeatDirectionCandidateAtMs;
    this.repeatDirectionCandidate = null;
    this.repeatDirectionCandidateAtMs = 0;
    if (!candidate || ageMs > this.repeatDirectionCandidateWindowMs) {
      return null;
    }
    return candidate;
  }

  clearRepeatDirectionCandidate(): void {
    this.repeatDirectionCandidate = null;
    this.repeatDirectionCandidateAtMs = 0;
  }

  shouldCloseInventoryForPendingContextPrompt(): boolean {
    const requestedAt = this.pendingInventoryContextPromptCloseRequestedAtMs;
    if (!requestedAt) {
      return false;
    }
    this.pendingInventoryContextPromptCloseRequestedAtMs = 0;
    return Date.now() - requestedAt <= this.inventoryContextPromptCloseWindowMs;
  }

  shouldSkipMobileFpsClickLookPromptMessageEvent(
    messageLike: unknown,
  ): boolean {
    if (!this.skipNextMobileFpsClickLookPromptMessage) {
      return false;
    }
    this.skipNextMobileFpsClickLookPromptMessage = false;
    if (typeof messageLike !== "string") {
      return false;
    }
    const normalized =
      this.dependencies.tileContextActions.sanitizeFpsCrosshairGlanceText(messageLike).toLowerCase();
    if (!normalized) {
      return false;
    }
    if (/^pick (an?|the)? ?object\b/.test(normalized)) {
      return true;
    }
    if (/^pick (a )?location\b/.test(normalized)) {
      return true;
    }
    if (
      normalized.startsWith("pick ") &&
      normalized.includes("monster, object or location")
    ) {
      return true;
    }
    return false;
  }

  canExecuteRepeatableGameplayAction(): boolean {
    return (
      Boolean(this.dependencies.engineState.session) &&
      !(
        this.dependencies.extendedCommands.metaCommandModeActive ||
        this.dependencies.questionMenus.isInQuestion ||
        this.dependencies.directionPrompts.isInDirectionQuestion ||
        this.dependencies.positionSelection.positionInputModeActive
      )
    );
  }

  isAutomaticHashCommandBlockedByLookMode(): boolean {
    const pending = this.dependencies.tileContextActions.fpsCrosshairGlancePending;
    if (!pending) {
      return false;
    }
    if (pending.commandKind !== "glance") {
      return false;
    }
    return Date.now() - pending.startedAtMs <= this.dependencies.tileContextActions.fpsCrosshairGlanceTimeoutMs;
  }

  clearAutomaticGlancePendingState(): void {
    this.dependencies.tileContextActions.fpsCrosshairGlancePending = null;
  }

  shouldUseLegacyTileContextLookProbe(): boolean {
    return this.dependencies.tilesetAssets.resolveRuntimeVersion() === "slashem";
  }

  resolvePreferredKeyboardInputForExtendedCommand(
    normalizedCommandText: string,
  ):
    | { kind: "input"; input: string }
    | { kind: "sequence"; inputs: string[] }
    | null {
    if (this.dependencies.tilesetAssets.resolveRuntimeVersion() === "slashem") {
      const binding = resolveSlashEmCommandInputBinding(normalizedCommandText);
      if (binding) {
        const input =
          binding.modifier === "ctrl"
            ? `${this.ctrlInputPrefix}${binding.key}`
            : binding.modifier === "meta"
              ? `${this.metaInputPrefix}${binding.key}`
              : binding.key;
        return { kind: "input", input };
      }
    }

    switch (normalizedCommandText) {
      case "apply":
        return { kind: "input", input: "a" };
      case "attributes":
        return this.dependencies.tilesetAssets.resolveRuntimeVersion() === "slashem"
          ? { kind: "input", input: `${this.ctrlInputPrefix}x` }
          : null;
      case "call":
        return { kind: "input", input: "C" };
      case "cast":
        return { kind: "input", input: "Z" };
      case "close":
        return { kind: "input", input: "c" };
      case "known":
        return this.dependencies.tilesetAssets.resolveRuntimeVersion() === "slashem"
          ? { kind: "input", input: "\\" }
          : null;
      case "dip":
        return { kind: "input", input: `${this.metaInputPrefix}d` };
      case "drop":
        return { kind: "input", input: "d" };
      case "eat":
        return { kind: "input", input: "e" };
      case "engrave":
        return { kind: "input", input: "E" };
      case "fire":
        return { kind: "input", input: "f" };
      case "force":
        return { kind: "input", input: `${this.metaInputPrefix}f` };
      case "glance":
        return { kind: "input", input: ";" };
      case "invoke":
        return { kind: "input", input: `${this.metaInputPrefix}i` };
      case "kick":
        return { kind: "input", input: `${this.ctrlInputPrefix}d` };
      case "loot":
        return this.numberPadModeEnabled
          ? { kind: "input", input: "l" }
          : { kind: "input", input: `${this.metaInputPrefix}l` };
      case "name":
        return this.numberPadModeEnabled
          ? { kind: "input", input: "N" }
          : { kind: "input", input: `${this.metaInputPrefix}n` };
      case "offer":
        return { kind: "input", input: `${this.metaInputPrefix}o` };
      case "open":
        return { kind: "input", input: "o" };
      case "pickup":
        return { kind: "input", input: "," };
      case "pray":
        return this.dependencies.tilesetAssets.resolveRuntimeVersion() === "slashem"
          ? { kind: "input", input: `${this.metaInputPrefix}p` }
          : null;
      case "puton":
        return { kind: "input", input: "P" };
      case "quaff":
        return { kind: "input", input: "q" };
      case "quiver":
        return { kind: "input", input: "Q" };
      case "read":
        return { kind: "input", input: "r" };
      case "remove":
        return { kind: "input", input: "R" };
      case "rub":
        return { kind: "input", input: `${this.metaInputPrefix}r` };
      case "search":
        return { kind: "input", input: "s" };
      case "seespells":
        return this.dependencies.tilesetAssets.resolveRuntimeVersion() === "slashem"
          ? { kind: "sequence", inputs: ["I", "+"] }
          : null;
      case "spells":
        return null;
      case "takeoff":
        return { kind: "input", input: "T" };
      case "throw":
        return { kind: "input", input: "t" };
      case "untrap":
        return this.numberPadModeEnabled
          ? { kind: "input", input: "u" }
          : { kind: "input", input: `${this.metaInputPrefix}u` };
      case "wear":
        return { kind: "input", input: "W" };
      case "wield":
        return { kind: "input", input: "w" };
      case "zap":
        return { kind: "input", input: "z" };
      default:
        return null;
    }
  }

  executeQuickAction(
    normalizedActionId: string,
    shouldArmRepeat: boolean,
    autoDirectionFromFpsAim: boolean = false,
    submitDelayMs: number = 0,
  ): boolean {
    if (!normalizedActionId || !this.dependencies.engineState.session) {
      return false;
    }
    const shouldAutoSelfDirectionForLoot =
      normalizedActionId === "loot" && this.isActiveContextActionOnPlayerTile();
    const adjacentDoorDirection =
      normalizedActionId === "open" || normalizedActionId === "close"
        ? this.getContextAutoDirectionFromActiveTileIfAdjacent()
        : null;

    this.dependencies.tileContextActions.closeAnyTileContextMenu(true);
    if (!this.canExecuteRepeatableGameplayAction()) {
      return false;
    }

    this.dependencies.promptDialogs.hideInfoMenuDialog();
    if (this.dependencies.promptDialogs.isInventoryDialogOpen()) {
      this.dependencies.promptDialogs.hideInventoryDialog();
    }

    if (shouldArmRepeat) {
      this.clearRepeatableAction();
    }
    this.clearRepeatDirectionCandidate();
    this.clearFpsContextAutoDirection();
    this.dependencies.audioHapticsPlatform.clearPendingThrownWeaponDirectionSound();
    if (shouldArmRepeat && normalizedActionId === "look" && this.dependencies.movementInput.isFpsMode()) {
      this.skipNextMobileFpsClickLookPromptMessage = true;
    }

    let didExecute = true;
    const submitOptions = { delayMs: submitDelayMs };
    switch (normalizedActionId) {
      case "wait":
        this.sendInput(".", submitOptions);
        break;
      case "search":
        this.sendInput("s", submitOptions);
        break;
      case "pickup":
        this.sendInput(",", submitOptions);
        break;
      case "eat":
        this.sendInput("e", submitOptions);
        break;
      case "look":
        this.sendInput("/", submitOptions);
        break;
      case "loot":
        if (this.isAutomaticHashCommandBlockedByLookMode()) {
          return false;
        }
        {
          const preferredLootInput =
            this.resolvePreferredKeyboardInputForExtendedCommand("loot");
          if (preferredLootInput?.kind === "input") {
            this.sendInput(preferredLootInput.input, submitOptions);
          } else if (preferredLootInput?.kind === "sequence") {
            this.sendInputSequence(preferredLootInput.inputs, submitOptions);
          } else {
            this.sendInputSequence(
              ["#", "l", "o", "o", "t", "Enter"],
              submitOptions,
            );
          }
        }
        if (shouldAutoSelfDirectionForLoot) {
          this.armContextAutoDirection("s");
        }
        break;
      case "quaff":
        this.sendInput("q", submitOptions);
        break;
      case "open":
        this.dependencies.movementInput.armFpsFireSuppression();
        this.sendInput("o", submitOptions);
        if (adjacentDoorDirection) {
          this.armContextAutoDirection(adjacentDoorDirection);
        }
        break;
      case "close":
        this.dependencies.movementInput.armFpsFireSuppression();
        this.sendInput("c", submitOptions);
        if (adjacentDoorDirection) {
          this.armContextAutoDirection(adjacentDoorDirection);
        }
        break;
      case "ascend":
        this.sendInput("<", submitOptions);
        break;
      case "descend":
        this.sendInput(">", submitOptions);
        break;
      case "extended":
        this.sendInput("#", submitOptions);
        break;
      default:
        console.log(`Unknown quick action requested: ${normalizedActionId}`);
        didExecute = false;
        break;
    }

    if (didExecute && shouldArmRepeat) {
      this.queueRepeatDirectionCandidate({
        kind: "quick",
        value: normalizedActionId,
      });
    }
    if (
      didExecute &&
      autoDirectionFromFpsAim &&
      !adjacentDoorDirection &&
      (normalizedActionId === "open" || normalizedActionId === "close")
    ) {
      this.armFpsContextAutoDirectionFromAim();
    }

    return didExecute;
  }

  executeExtendedCommand(
    normalizedCommandText: string,
    shouldArmRepeat: boolean,
    autoDirectionFromFpsAim: boolean = false,
    submitDelayMs: number = 0,
    forceHashSubmission: boolean = false,
  ): boolean {
    if (!normalizedCommandText || !this.dependencies.engineState.session) {
      return false;
    }
    const kickAdjacentDirection =
      normalizedCommandText === "kick"
        ? this.getContextAutoDirectionFromActiveTileIfAdjacent()
        : null;

    this.dependencies.tileContextActions.closeAnyTileContextMenu(true);
    if (!this.canExecuteRepeatableGameplayAction()) {
      return false;
    }

    this.dependencies.promptDialogs.hideInfoMenuDialog();
    if (this.dependencies.promptDialogs.isInventoryDialogOpen()) {
      this.dependencies.promptDialogs.hideInventoryDialog();
    }

    if (shouldArmRepeat) {
      this.clearRepeatableAction();
    }
    this.clearRepeatDirectionCandidate();
    this.clearFpsContextAutoDirection();
    if (normalizedCommandText === "throw" || normalizedCommandText === "fire") {
      this.dependencies.audioHapticsPlatform.armPendingThrownWeaponDirectionSound();
    } else {
      this.dependencies.audioHapticsPlatform.clearPendingThrownWeaponDirectionSound();
    }
    if (normalizedCommandText === "kick") {
      this.dependencies.movementInput.armFpsFireSuppression();
    }
    let submittedAsDirectInput = false;
    const preferredInput = forceHashSubmission
      ? null
      : this.resolvePreferredKeyboardInputForExtendedCommand(
          normalizedCommandText,
        );
    if (preferredInput?.kind === "input") {
      submittedAsDirectInput = true;
      this.sendInput(preferredInput.input, { delayMs: submitDelayMs });
    } else if (preferredInput?.kind === "sequence") {
      this.sendInputSequence(preferredInput.inputs, { delayMs: submitDelayMs });
    } else {
      const sequence = ["#", ...normalizedCommandText.split(""), "Enter"];
      this.sendInputSequence(sequence, { delayMs: submitDelayMs });
    }
    if (
      !submittedAsDirectInput &&
      (normalizedCommandText === "pickup" ||
        normalizedCommandText === "drop" ||
        normalizedCommandText === "eat")
    ) {
      this.dependencies.tileUpdates.requestPlayerTileRefresh(`${normalizedCommandText}-command`);
    }
    if (shouldArmRepeat) {
      this.queueRepeatDirectionCandidate({
        kind: "extended",
        value: normalizedCommandText,
      });
    }
    if (kickAdjacentDirection) {
      this.armContextAutoDirection(kickAdjacentDirection);
    }
    if (
      autoDirectionFromFpsAim &&
      !kickAdjacentDirection &&
      (normalizedCommandText === "kick" ||
        normalizedCommandText === "throw" ||
        normalizedCommandText === "fire" ||
        normalizedCommandText === "zap")
    ) {
      this.armFpsContextAutoDirectionFromAim();
    }
    return true;
  }

  executeInventoryCommandWithoutSelection(
    commandKey: string,
    shouldArmRepeat: boolean,
  ): boolean {
    if (!commandKey || commandKey.length !== 1 || !this.dependencies.engineState.session) {
      return false;
    }

    this.dependencies.tileContextActions.closeAnyTileContextMenu(true);
    if (!this.canExecuteRepeatableGameplayAction()) {
      return false;
    }

    this.dependencies.promptDialogs.hideInfoMenuDialog();
    if (this.dependencies.promptDialogs.isInventoryDialogOpen()) {
      this.dependencies.promptDialogs.hideInventoryDialog();
    }

    if (shouldArmRepeat) {
      this.clearRepeatableAction();
    }
    this.clearRepeatDirectionCandidate();
    if (commandKey === "t" || commandKey === "f") {
      this.dependencies.audioHapticsPlatform.armPendingThrownWeaponDirectionSound();
    } else {
      this.dependencies.audioHapticsPlatform.clearPendingThrownWeaponDirectionSound();
    }
    this.sendInput(commandKey);
    if (shouldArmRepeat) {
      this.queueRepeatDirectionCandidate({
        kind: "inventory_command",
        value: commandKey,
      });
    }
    return true;
  }

  clearFpsContextAutoDirection(): void {
    this.fpsContextAutoDirectionInput = null;
    this.fpsContextAutoDirectionArmedAtMs = 0;
  }

  armContextAutoDirection(directionInput: string): void {
    const normalized = String(directionInput || "").trim();
    if (!normalized) {
      return;
    }
    this.fpsContextAutoDirectionInput = normalized;
    this.fpsContextAutoDirectionArmedAtMs = Date.now();
  }

  isActiveContextActionOnPlayerTile(): boolean {
    const tile = this.dependencies.tileContextActions.activeContextActionTile;
    return Boolean(
      tile && tile.x === this.dependencies.playerMovement.playerPos.x && tile.y === this.dependencies.playerMovement.playerPos.y,
    );
  }

  armFpsContextAutoDirectionFromAim(): void {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return;
    }
    const directionInput = this.dependencies.movementInput.getFpsDirectionQuestionInputFromAim();
    if (!directionInput) {
      return;
    }
    this.armContextAutoDirection(directionInput);
  }

  getContextAutoDirectionFromActiveTileIfAdjacent(): string | null {
    const tile = this.dependencies.tileContextActions.activeContextActionTile;
    if (!tile) {
      return null;
    }
    const dx = tile.x - this.dependencies.playerMovement.playerPos.x;
    const dy = tile.y - this.dependencies.playerMovement.playerPos.y;
    if ((dx === 0 && dy === 0) || Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      return null;
    }
    return this.dependencies.movementInput.resolveDirectionFromDelta(dx, dy);
  }

  tryAutoAnswerDirectionQuestionFromFpsContextAction(): boolean {
    const directionKey = this.fpsContextAutoDirectionInput;
    if (!directionKey) {
      return false;
    }
    const ageMs = Date.now() - this.fpsContextAutoDirectionArmedAtMs;
    this.clearFpsContextAutoDirection();
    if (ageMs > this.fpsContextAutoDirectionWindowMs) {
      return false;
    }
    if (this.dependencies.controllerGameplay.consumeControllerFpsDirectionPromptUi()) {
      return false;
    }
    this.dependencies.directionPrompts.isInDirectionQuestion = true;
    this.submitDirectionAnswer(directionKey);
    return true;
  }

  tryAutoAnswerDirectionQuestionFromRepeat(): boolean {
    if (!this.repeatAutoDirectionPending) {
      return false;
    }
    if (
      Date.now() - this.repeatAutoDirectionArmedAtMs >
      this.repeatAutoDirectionWindowMs
    ) {
      this.repeatAutoDirectionPending = false;
      this.repeatAutoDirectionArmedAtMs = 0;
      return false;
    }
    this.repeatAutoDirectionPending = false;
    this.repeatAutoDirectionArmedAtMs = 0;
    const directionKey = this.lastRepeatDirectionInput;
    if (!directionKey) {
      return false;
    }
    this.dependencies.directionPrompts.isInDirectionQuestion = true;
    this.submitDirectionAnswer(directionKey);
    return true;
  }

  submitDirectionAnswer(directionKey: string): void {
    if (!this.dependencies.directionPrompts.isInDirectionQuestion || !directionKey) {
      return;
    }
    const normalized = String(directionKey).trim();
    if (!normalized) {
      return;
    }

    this.lastRepeatDirectionInput = normalized;
    this.dependencies.audioHapticsPlatform.maybePlayThrownWeaponSoundForDirectionAnswer(normalized);
    this.sendInput(normalized);
    if (this.dependencies.movementInput.isFpsMode()) {
      this.dependencies.tileUpdates.requestDirectionalAnswerTileRefresh(normalized);
    }
    this.dependencies.directionPrompts.hideDirectionQuestion();
  }

  setNumberPadModeEnabled(
    enabled: boolean,
    options: { announce?: boolean } = {},
  ): void {
    const normalized = Boolean(enabled);
    if (this.numberPadModeEnabled === normalized) {
      return;
    }
    this.numberPadModeEnabled = normalized;
    const modeLabel = normalized ? "numpad" : "hjklyubn";
    console.log(`🎮 Number pad mode set to ${modeLabel}`);
    if (options.announce !== false) {
      this.dependencies.engineMessages.addGameMessage(`Number pad mode: ${modeLabel}`);
    }
    this.dependencies.engineState.uiAdapter.setNumberPadModeEnabled(normalized);
  }

  updateNumberPadModeFromChoice(choice: string): void {
    if (!this.dependencies.questionMenus.isNumberPadModeQuestion(this.dependencies.questionMenus.activeQuestionText)) {
      return;
    }
    const normalizedChoice = String(choice || "").trim();
    if (!normalizedChoice) {
      return;
    }
    if (normalizedChoice === "0") {
      this.setNumberPadModeEnabled(false);
      return;
    }
    if (normalizedChoice === "1" || normalizedChoice === "2") {
      this.setNumberPadModeEnabled(true);
    }
  }

  chooseDirection(directionKey: string): void {
    if (!this.dependencies.directionPrompts.isInDirectionQuestion || !directionKey) {
      return;
    }
    const resolvedDirection =
      this.dependencies.movementInput.resolveDirectionQuestionInputForCurrentCamera(directionKey);
    if (!resolvedDirection) {
      return;
    }
    this.submitDirectionAnswer(resolvedDirection);
  }

  confirmActiveDirectionQuestion(): void {
    if (!this.dependencies.directionPrompts.isInDirectionQuestion) {
      return;
    }
    if (this.dependencies.movementInput.isFpsMode()) {
      this.dependencies.directionPrompts.confirmFpsDirectionQuestionFromAim();
      return;
    }
    const activeButtonId =
      this.dependencies.directionPrompts.directionPromptHoveredButtonId ??
      this.dependencies.directionPrompts.directionPromptPressedButtonId ??
      this.dependencies.directionPrompts.resolveDirectionPromptOverlayButtonFromInput(
        this.dependencies.controllerGameplay.controllerDirectionPromptPreviewInput,
      );
    if (!activeButtonId) {
      return;
    }
    this.dependencies.directionPrompts.confirmDirectionPromptOverlayButton(activeButtonId);
  }

  submitTextInput(text: string): void {
    if (!this.dependencies.engineState.session) {
      this.dependencies.promptDialogs.hideTextInputRequest();
      return;
    }
    const normalized = typeof text === "string" ? text : String(text ?? "");
    this.sendInput(`${this.textInputPrefix}${normalized}`);
    this.dependencies.promptDialogs.hideTextInputRequest();
  }

  cancelActivePrompt(): void {
    if (this.dependencies.promptDialogs.isTextInputActive) {
      this.submitTextInput("");
      return;
    }
    if (this.dependencies.positionSelection.positionInputModeActive) {
      this.dependencies.positionSelection.cancelPositionInputMode("active prompt cancel");
      return;
    }
    this.dependencies.audioHapticsPlatform.clearPendingThrownWeaponDirectionSound();
    if (this.dependencies.questionMenus.isInQuestion || this.dependencies.directionPrompts.isInDirectionQuestion) {
      this.sendInput("Escape");
    }
    this.dependencies.questionMenus.hideQuestion();
    this.dependencies.directionPrompts.hideDirectionQuestion();
  }

  toggleInventoryDialog(): void {
    this.dependencies.promptDialogs.toggleInventoryDialogState();
  }

  openCharacterSheet(): void {
    if (typeof window === "undefined") {
      this.runExtendedCommand("attributes");
      return;
    }
    const event = new CustomEvent(nh3dOpenCharacterSheetEventName, {
      bubbles: true,
      cancelable: true,
    });
    const shouldRunFallbackCommand = window.dispatchEvent(event);
    if (shouldRunFallbackCommand) {
      this.runExtendedCommand("attributes");
    }
  }

  runInventoryItemAction(
    actionId: string,
    itemAccelerator: string,
  ): void {
    const normalizedActionId = String(actionId || "")
      .trim()
      .toLowerCase();
    const accelerator = String(itemAccelerator || "").trim();
    if (!this.dependencies.engineState.session || !normalizedActionId || accelerator.length !== 1) {
      return;
    }

    this.dependencies.promptDialogs.hideInfoMenuDialog();
    this.clearRepeatableAction();
    this.clearRepeatDirectionCandidate();
    this.dependencies.promptDialogs.hideInventoryDialog();
    if (normalizedActionId === "throw" || normalizedActionId === "fire") {
      this.dependencies.audioHapticsPlatform.armPendingThrownWeaponDirectionSound();
    } else {
      this.dependencies.audioHapticsPlatform.clearPendingThrownWeaponDirectionSound();
    }
    this.dependencies.audioHapticsPlatform.maybePlayDrinkSoundForInventoryItemAction(
      normalizedActionId,
      accelerator,
    );

    const commandMap: Record<string, string> = {
      apply: "a",
      drop: "d",
      eat: "e",
      quaff: "q",
      quiver: "Q",
      read: "r",
      throw: "t",
      wield: "w",
      unwield: "w",
      wear: "W",
      "take-off": "T",
      "put-on": "P",
      remove: "R",
      zap: "z",
      cast: "Z",
    };

    const commandKey = commandMap[normalizedActionId];
    const contextSelectionInput = `${this.inventoryContextSelectionPrefix}${accelerator}:${normalizedActionId}`;
    if (normalizedActionId === "info") {
      this.sendInputSequence([contextSelectionInput, "/"]);
      return;
    }
    if (!commandKey) {
      return;
    }

    if (normalizedActionId === "unwield") {
      this.sendInputSequence([
        `${this.inventoryContextSelectionPrefix}-:${normalizedActionId}`,
        "w",
      ]);
      this.queueRepeatDirectionCandidate({
        kind: "inventory_command",
        value: "w",
      });
      return;
    }

    this.sendInputSequence([contextSelectionInput, commandKey]);
    if (normalizedActionId === "drop" || normalizedActionId === "eat") {
      this.dependencies.tileUpdates.requestPlayerTileRefresh(`inventory-${normalizedActionId}`);
    }
    this.queueRepeatDirectionCandidate({
      kind: "inventory_command",
      value: commandKey,
    });
  }

  runInventoryItemDropCount(
    itemAccelerator: string,
    count: number,
  ): void {
    const accelerator = String(itemAccelerator || "").trim();
    const normalizedCount = Number.isFinite(count) ? Math.trunc(count) : 0;
    if (!this.dependencies.engineState.session || accelerator.length !== 1 || normalizedCount < 1) {
      return;
    }

    this.dependencies.promptDialogs.hideInfoMenuDialog();
    this.clearRepeatableAction();
    this.clearRepeatDirectionCandidate();
    this.dependencies.promptDialogs.hideInventoryDialog();

    this.sendInputSequence([
      `${this.inventoryContextSelectionCountPrefix}${accelerator}:${String(normalizedCount)}:drop`,
      "d",
    ]);
    this.dependencies.tileUpdates.requestPlayerTileRefresh("inventory-drop-count");
    this.queueRepeatDirectionCandidate({
      kind: "inventory_command",
      value: "d",
    });
  }

  dismissFpsCrosshairContextMenu(): void {
    if (this.dependencies.tileContextActions.normalTileContextMenuOpen || this.dependencies.tileContextActions.normalTileContextSignature) {
      this.dependencies.tileContextActions.closeNormalTileContextMenu(true);
      return;
    }
    this.dependencies.tileContextActions.closeAnyTileContextMenu(true);
  }

  runQuickAction(
    actionId: string,
    options?: { autoDirectionFromFpsAim?: boolean; submitDelayMs?: number },
  ): void {
    const normalizedActionId = String(actionId || "")
      .trim()
      .toLowerCase();
    this.executeQuickAction(
      normalizedActionId,
      true,
      Boolean(options?.autoDirectionFromFpsAim),
      Number.isFinite(options?.submitDelayMs)
        ? Number(options?.submitDelayMs)
        : 0,
    );
  }

  runExtendedCommand(
    commandText: string,
    options?: {
      autoDirectionFromFpsAim?: boolean;
      submitDelayMs?: number;
      forceHashSubmission?: boolean;
    },
  ): void {
    const normalizedCommandText = String(commandText || "")
      .trim()
      .toLowerCase();
    this.executeExtendedCommand(
      normalizedCommandText,
      true,
      Boolean(options?.autoDirectionFromFpsAim),
      Number.isFinite(options?.submitDelayMs)
        ? Number(options?.submitDelayMs)
        : 0,
      Boolean(options?.forceHashSubmission),
    );
  }

  runContextualAction(actionId: string): void {
    const normalizedActionId = String(actionId || "")
      .trim()
      .toLowerCase();
    switch (normalizedActionId) {
      case "info":
        this.executeContextualTileInfoAction();
        break;
      default:
        break;
    }
  }

  repeatLastAction(): void {
    if (!this.repeatActionVisible || !this.repeatableAction) {
      return;
    }

    let didExecute = false;
    switch (this.repeatableAction.kind) {
      case "quick":
        didExecute = this.executeQuickAction(
          this.repeatableAction.value,
          false,
        );
        break;
      case "extended":
        didExecute = this.executeExtendedCommand(
          this.repeatableAction.value,
          false,
        );
        break;
      case "inventory_command":
        didExecute = this.executeInventoryCommandWithoutSelection(
          this.repeatableAction.value,
          false,
        );
        break;
      default:
        didExecute = false;
        break;
    }

    if (didExecute) {
      this.repeatAutoDirectionPending = true;
      this.repeatAutoDirectionArmedAtMs = Date.now();
    }
  }

  executeContextualTileInfoAction(): boolean {
    const targetTile = this.dependencies.tileContextActions.activeContextActionTile;
    if (!targetTile || !this.dependencies.engineState.session) {
      return false;
    }

    this.dependencies.tileContextActions.closeAnyTileContextMenu(true);
    if (!this.canExecuteRepeatableGameplayAction()) {
      return false;
    }

    this.dependencies.promptDialogs.hideInfoMenuDialog();
    if (this.dependencies.promptDialogs.isInventoryDialogOpen()) {
      this.dependencies.promptDialogs.hideInventoryDialog();
    }

    this.clearRepeatDirectionCandidate();
    this.clearFpsContextAutoDirection();
    this.skipNextMobileFpsClickLookPromptMessage = true;

    // Route /what is to the map, then let the runtime confirm verbose info
    // and exit the follow-up location prompt automatically.
    this.sendInput(this.contextualLookInfoProbePrefix);
    this.sendInput("/");
    this.dependencies.engineMessages.logClickLookTileDebug("fps-info", targetTile.x, targetTile.y);
    this.sendMouseInput(targetTile.x, targetTile.y, 0);
    return true;
  }

  sendInput(
    input: string,
    options: { keepContextMenuOpen?: boolean; delayMs?: number } = {},
  ): void {
    this.dependencies.engineMessages.logNameInputTrace(input);
    this.dependencies.combatAttribution.pendingPointerAttackTargetContext = null;
    if (!options.keepContextMenuOpen) {
      this.dependencies.tileContextActions.closeAnyTileContextMenu(false);
    }
    let resolvedInput = input;
    const pendingGameOverReportKind =
      this.dependencies.gameOver.gameOverState.active && this.dependencies.questionMenus.isInQuestion
        ? this.dependencies.gameOver.resolveGameOverPostmortemReportKindFromQuestion(
            this.dependencies.questionMenus.activeQuestionText,
          )
        : null;
    if (pendingGameOverReportKind) {
      const normalizedReportAnswer = String(resolvedInput || "")
        .trim()
        .toLowerCase();
      const shouldSuppressReportDisplay =
        normalizedReportAnswer === "escape" ||
        normalizedReportAnswer === "n" ||
        normalizedReportAnswer === "q";
      if (
        shouldSuppressReportDisplay
      ) {
        resolvedInput = "y";
      }
      if (
        shouldSuppressReportDisplay &&
        String(resolvedInput || "")
          .trim()
          .toLowerCase() === "y"
      ) {
        this.dependencies.gameOver.pendingSuppressedGameOverReportKind = pendingGameOverReportKind;
      }
    }
    if (
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      this.dependencies.runTelemetry.recentSpellKillAttribution &&
      String(resolvedInput || "")
        .trim()
        .toLowerCase() !== "z"
    ) {
      this.dependencies.runTelemetry.recentSpellKillAttribution = null;
    }
    const shouldTreatAsPlayerMovementInput =
      this.dependencies.movementInput.isMovementInput(resolvedInput) &&
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      !this.dependencies.positionSelection.positionInputModeActive;

    if (shouldTreatAsPlayerMovementInput) {
      const nowMs = Date.now();
      this.dependencies.camera.lastManualDirectionalInputAtMs = nowMs;
      this.dependencies.camera.fpsAutoMoveDirection = null;
      this.dependencies.camera.fpsAutoTurnTargetYaw = null;
      this.dependencies.audioHapticsPlatform.armPendingPlayerFootstepSound();
      this.dependencies.playerMovement.setFpsPredictedPlayerTileFromMovementInput(resolvedInput);
      if (this.dependencies.movementInput.isRunMovementInput(resolvedInput)) {
        this.dependencies.camera.lastRunLikeInputAtMs = nowMs;
        this.dependencies.movementInput.armPlayerCliparoundInputCooldown();
      } else if (this.dependencies.movementInput.isNumpadRunPrefixInput(resolvedInput)) {
        this.dependencies.camera.lastRunLikeInputAtMs = nowMs;
        this.dependencies.movementInput.armPlayerCliparoundInputCooldown();
      }
    }

    if (
      !this.dependencies.playerMovement.hasPlayerMovedOnce &&
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      shouldTreatAsPlayerMovementInput
    ) {
      this.dependencies.movementInput.lastMovementInputAtMs = Date.now();
    }

    this.dependencies.combatAttribution.updateDirectionalAttackContext(resolvedInput);
    if (shouldTreatAsPlayerMovementInput) {
      this.dependencies.combatAttribution.armPendingFpsHeldWeaponMeleeSwipeFromMovementInput(resolvedInput);
    }

    const itemCommandRefreshReason =
      this.dependencies.tileUpdates.getPlayerTileRefreshReasonForItemCommandInput(resolvedInput);
    if (
      itemCommandRefreshReason &&
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      !this.dependencies.positionSelection.positionInputModeActive
    ) {
      this.dependencies.tileUpdates.requestPlayerTileRefresh(itemCommandRefreshReason);
    }

    if (this.dependencies.engineState.session) {
      const allowBlindSearchInference =
        this.dependencies.darkCorridorInference.shouldEnableBlindDarkCorridorInferenceForInput(resolvedInput);
      this.dependencies.darkCorridorInference.beginDarkCorridorDiscoveryWindowFromPlayerInput({
        allowBlindSearchInference,
      });
      // Workaround for a race condition in contextual command handling.
      // TODO: remove once the underlying ordering issue is fixed.
      this.dependencies.engineState.session.sendInput(resolvedInput, { delayMs: options.delayMs });
    }
  }

  sendInputSequence(
    inputs: string[],
    options: { keepContextMenuOpen?: boolean; delayMs?: number } = {},
  ): void {
    if (!this.dependencies.engineState.session || inputs.length === 0) {
      return;
    }
    this.dependencies.combatAttribution.pendingPointerAttackTargetContext = null;
    if (!options.keepContextMenuOpen) {
      this.dependencies.tileContextActions.closeAnyTileContextMenu(false);
    }

    const nowMs = Date.now();
    let hasMovementInput = false;
    let firstMovementInput: string | null = null;
    for (const input of inputs) {
      if (this.dependencies.movementInput.isMovementInput(input)) {
        this.dependencies.camera.lastManualDirectionalInputAtMs = nowMs;
        this.dependencies.camera.fpsAutoMoveDirection = null;
        this.dependencies.camera.fpsAutoTurnTargetYaw = null;
        hasMovementInput = true;
        firstMovementInput = input;
        break;
      }
    }
    const hasRunPrefixInput = inputs.some((entry) =>
      this.dependencies.movementInput.isRunPrefixInput(entry),
    );
    if (hasMovementInput) {
      this.dependencies.audioHapticsPlatform.armPendingPlayerFootstepSound();
      if (firstMovementInput) {
        this.dependencies.playerMovement.setFpsPredictedPlayerTileFromMovementInput(firstMovementInput);
      }
      if (hasRunPrefixInput) {
        this.dependencies.camera.lastRunLikeInputAtMs = nowMs;
        this.dependencies.movementInput.armPlayerCliparoundInputCooldown();
      }
    }

    const allowBlindSearchInference =
      inputs.length === 1 &&
      this.dependencies.darkCorridorInference.shouldEnableBlindDarkCorridorInferenceForInput(inputs[0]);
    this.dependencies.darkCorridorInference.beginDarkCorridorDiscoveryWindowFromPlayerInput({
      allowBlindSearchInference,
    });
    // Workaround for a race condition in contextual command handling.
    // TODO: remove once the underlying ordering issue is fixed.
    this.dependencies.engineState.session.sendInputSequence(inputs, { delayMs: options.delayMs });
  }

  sendForcedDirectionalInput(direction: string): void {
    if (!direction) {
      return;
    }
    this.dependencies.combatAttribution.pendingFpsHeldWeaponMeleeSwipeContext = null;
    this.dependencies.combatAttribution.updateDirectionalAttackContext(direction);
    this.dependencies.movementInput.armPlayerCliparoundInputCooldown();
    this.sendInputSequence(["5", direction]);
  }

  sendMouseInput(
    x: number,
    y: number,
    button: number,
    options: { keepContextMenuOpen?: boolean; allowFpsMovement?: boolean } = {},
  ): void {
    if (!this.dependencies.engineState.session) {
      return;
    }
    if (!options.keepContextMenuOpen) {
      this.dependencies.tileContextActions.closeAnyTileContextMenu(false);
    }
    if (this.dependencies.audioHapticsPlatform.shouldArmPlayerFootstepFromMouseInput(x, y, button, options.allowFpsMovement === true)) {
      this.dependencies.audioHapticsPlatform.armPendingPlayerFootstepSound();
      this.dependencies.movementInput.armPlayerCliparoundInputCooldown();
    }
    this.dependencies.darkCorridorInference.beginDarkCorridorDiscoveryWindowFromPlayerInput({
      allowBlindSearchInference: false,
    });
    this.dependencies.engineState.session.sendMouseInput(x, y, button);
  }
}
