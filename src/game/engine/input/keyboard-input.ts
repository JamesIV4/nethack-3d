import { createControllerBooleanActionMap } from "../shared/constants";
import type { AudioHapticsPlatform } from "../audio/audio-haptics-platform";
import type { Camera } from "../camera/camera";
import type { ControllerDialogs } from "./controller-dialogs";
import type { ControllerGameplay } from "./controller-gameplay";
import type { DirectionPrompts } from "../ui/direction-prompts";
import type { EngineMessages } from "../ui/engine-messages";
import type { EngineState } from "../runtime/engine-state";
import type { ExtendedCommands } from "../ui/extended-commands";
import type { FpsDiagnostics } from "../diagnostics/fps-diagnostics";
import type { GameOver } from "../ui/game-over";
import type { HeldWeaponAnimationDebug } from "../diagnostics/held-weapon-animation-debug";
import type { InputCommands } from "./input-commands";
import type { Minimap } from "../ui/minimap";
import type { ModalNavigation } from "../ui/modal-navigation";
import type { MouseInput } from "./mouse-input";
import type { MovementInput } from "./movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PointerLock } from "./pointer-lock";
import type { PositionSelection } from "./position-selection";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { QuestionMenus } from "../ui/question-menus";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { RunTelemetry } from "../world/run-telemetry";
import type { TileContextActions } from "../ui/tile-context-actions";
import type { TouchInput } from "./touch-input";

export interface KeyboardInputDependencies {
  readonly audioHapticsPlatform: Pick<
    AudioHapticsPlatform,
    "armPendingThrownWeaponDirectionSound"
    | "clearPendingThrownWeaponDirectionSound"
    | "maybePlayDrinkSoundForQuestionAnswer"
    | "maybePlayDrinkSoundForQuestionMenuSelection"
    | "resumeFmodFromUserGesture"
  >;
  readonly camera: Pick<
    Camera,
    "queueCameraYawSnapToNearest45"
  >;
  readonly controllerDialogs: Pick<
    ControllerDialogs,
    "resetControllerVirtualCursor"
  >;
  readonly controllerGameplay: Pick<
    ControllerGameplay,
    "clearControllerMovePreview"
    | "controllerFpsLeftStickLastMoveInput"
    | "controllerFpsLeftStickNextMoveAtMs"
    | "controllerPreviousActionState"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "clearDirectionPromptOverlayInteraction"
    | "hideDirectionQuestion"
    | "isInDirectionQuestion"
  >;
  readonly engineMessages: Pick<
    EngineMessages,
    "logClickLookTileDebug"
  >;
  readonly engineState: Pick<
    EngineState,
    "uiAdapter"
  >;
  readonly extendedCommands: Pick<
    ExtendedCommands,
    "altOrMetaHeld"
    | "canStartMetaCommandMode"
    | "exitMetaCommandMode"
    | "handleMetaCommandKeyDown"
    | "isMetaCommandTriggerKey"
    | "metaCommandModeActive"
    | "startMetaCommandMode"
    | "useNativeExtendedCommandMenu"
  >;
  readonly fpsDiagnostics: Pick<
    FpsDiagnostics,
    "handleFpsDebugShortcutKeyDown"
  >;
  readonly gameOver: Pick<
    GameOver,
    "releaseDeferredGameOverUiReveal"
    | "shouldReleaseDeferredGameOverUiFromKeyDown"
  >;
  readonly heldWeaponAnimationDebug: Pick<
    HeldWeaponAnimationDebug,
    "handleFpsHeldWeaponAnimationDebugShortcutKeyDown"
  >;
  readonly inputCommands: Pick<
    InputCommands,
    "cancelActivePrompt"
    | "ctrlInputPrefix"
    | "metaInputPrefix"
    | "numberPadModeEnabled"
    | "sendForcedDirectionalInput"
    | "sendInput"
    | "sendMouseInput"
    | "submitDirectionAnswer"
    | "submitTextInput"
    | "updateNumberPadModeFromChoice"
  >;
  readonly minimap: Pick<
    Minimap,
    "stopMinimapDrag"
  >;
  readonly modalNavigation: Pick<
    ModalNavigation,
    "getFocusedSimpleQuestionChoiceValue"
    | "getModalNavigationDirection"
    | "handleModalHomeEndFocusKeyDown"
    | "handleModalPageScrollKeyDown"
    | "isEditableModalKeyboardTarget"
    | "moveSimpleQuestionChoiceFocus"
  >;
  readonly mouseInput: Pick<
    MouseInput,
    "isMiddleMouseDown"
    | "isRightMouseDown"
    | "rightMouseCanOpenContextMenuOnRelease"
    | "rightMouseDragExceededDeadzone"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "clearPlayerCliparoundInputCooldown"
    | "isFpsMode"
    | "isFpsWasdKeyboardMovementEnabled"
    | "isMovementInput"
    | "mapDirectionalKeyFromNavigationInput"
    | "mapNumpadDigitToDirectionKey"
    | "normalizeWaitKey"
    | "resolveDirectionQuestionInputForCurrentCamera"
    | "tryResolveCameraRelativeGameplayMovementInput"
    | "tryResolveFpsDirectionQuestionInput"
    | "tryResolveFpsMovementInput"
    | "tryResolveFpsPositionLookInput"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly pointerLock: Pick<
    PointerLock,
    "fpsPointerLockActive"
    | "fpsPointerLockRestorePending"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "cancelPositionInputMode"
    | "positionHideTimerId"
    | "positionInputModeActive"
    | "resolvePositionInputConfirmKey"
    | "resolveTravelPositionShortcutKey"
    | "setPositionInputMode"
    | "tryResolvePositionInputMovementKey"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "hideInfoMenuDialog"
    | "hideInventoryDialog"
    | "isAnyModalVisible"
    | "isClientOptionsDialogOpen"
    | "isInfoDialogOpen"
    | "isInfoDialogVisible"
    | "isInventoryDialogOpen"
    | "isInventoryDialogVisible"
    | "isTextInputActive"
    | "isUiInputBlocked"
    | "runtimeConnectionState"
    | "toggleInfoMenuDialog"
    | "toggleInventoryDialogState"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "activateFocusedQuestionAction"
    | "activeQuestionIsPickupDialog"
    | "activeQuestionMenuItems"
    | "activeQuestionMenuPageCount"
    | "activeQuestionText"
    | "chooseQuestionChoice"
    | "confirmPickupChoices"
    | "confirmQuestionMenuChoice"
    | "findActiveMenuItemBySelectionInput"
    | "getQuestionMenuSelectionInput"
    | "goToFirstQuestionMenuPage"
    | "goToLastQuestionMenuPage"
    | "goToNextQuestionMenuPage"
    | "goToPreviousQuestionMenuPage"
    | "handlePickupDialogShortcutKey"
    | "handleQuestionMenuCountKeyDown"
    | "hideQuestion"
    | "isInQuestion"
    | "moveQuestionDialogMenuLikeFocus"
    | "moveQuestionDialogTabFocus"
    | "resolveQuestionSelectionInput"
    | "resolveQuestionSelectionInputForKeyPress"
    | "sendInputWithPendingQuestionCount"
    | "setActiveQuestionMenuFocusBySelectionInput"
    | "toggleActivePickupFocusSelection"
    | "togglePickupChoice"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "renderer"
  >;
  readonly runTelemetry: Pick<
    RunTelemetry,
    "armRecentSpellKillAttribution"
    | "extractSpellNameFromMenuItemText"
    | "isSpellCastQuestionText"
  >;
  readonly tileContextActions: Pick<
    TileContextActions,
    "closeAnyTileContextMenu"
  >;
  readonly touchInput: Pick<
    TouchInput,
    "clearFpsTouchGestures"
  >;
}

/** Browser keyboard intake, modifier shortcuts and blur reset gates. */
export class KeyboardInput {
  constructor(private readonly dependencies: KeyboardInputDependencies) {}

  isSpaceDismissKey(event: KeyboardEvent): boolean {
    return (
      event.key === " " ||
      event.key === "Spacebar" ||
      event.key === "Space" ||
      event.code === "Space"
    );
  }

  getModifiedInput(event: KeyboardEvent): string | null {
    // NetHack ctrl commands are represented as control keycodes in the runtime bridge.
    if (event.ctrlKey) {
      const normalizedControlKey = this.getMetaPrimaryKey(event);
      if (normalizedControlKey) {
        return `${this.dependencies.inputCommands.ctrlInputPrefix}${normalizedControlKey}`;
      }
    }

    // NetHack meta commands are represented as ESC + key in the runtime bridge.
    const hasMetaModifier = event.altKey || event.metaKey || this.dependencies.extendedCommands.altOrMetaHeld;
    if (!hasMetaModifier) {
      return null;
    }
    if (
      event.key === "Alt" ||
      event.key === "Meta" ||
      event.key === "Control" ||
      event.key === "Shift"
    ) {
      return null;
    }
    const normalizedKey = this.getMetaPrimaryKey(event);
    if (!normalizedKey) {
      return null;
    }
    return `${this.dependencies.inputCommands.metaInputPrefix}${normalizedKey}`;
  }

  getMetaPrimaryKey(event: KeyboardEvent): string | null {
    if (event.code.startsWith("Key") && event.code.length === 4) {
      return event.code.slice(3).toLowerCase();
    }
    if (event.code.startsWith("Digit") && event.code.length === 6) {
      return event.code.slice(5);
    }
    if (event.key.length === 1) {
      return event.key.toLowerCase();
    }
    return null;
  }

  handleCtrlShortcutKeyDown(event: KeyboardEvent): boolean {
    if (!event.ctrlKey || event.altKey || event.metaKey) {
      return false;
    }

    const keyFromCode =
      event.code.startsWith("Key") && event.code.length === 4
        ? event.code.slice(3).toLowerCase()
        : "";
    const keyFromEvent =
      typeof event.key === "string" && event.key.length === 1
        ? event.key.toLowerCase()
        : "";
    const normalizedKey = keyFromCode || keyFromEvent;

    if (normalizedKey === "p") {
      event.preventDefault();
      this.dependencies.inputCommands.sendInput(`${this.dependencies.inputCommands.ctrlInputPrefix}p`);
      return true;
    }

    if (normalizedKey !== "m") {
      return false;
    }
    event.preventDefault();
    this.dependencies.promptDialogs.toggleInfoMenuDialog();
    return true;
  }

  handleKeyUp(event: KeyboardEvent): void {
    if (event.key === "Alt" || event.key === "Meta") {
      this.dependencies.extendedCommands.altOrMetaHeld = false;
    }
  }

  isKeyboardEventFromInteractiveElement(
    target: EventTarget | null,
  ): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    if (target.isContentEditable) {
      return true;
    }
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.tagName === "BUTTON"
    ) {
      return true;
    }
    return Boolean(
      target.closest(
        "input, textarea, select, button, [contenteditable='true']",
      ),
    );
  }

  handleWindowBlur(): void {
    const wasMiddleMouseRotating = this.dependencies.mouseInput.isMiddleMouseDown;
    this.dependencies.extendedCommands.altOrMetaHeld = false;
    this.dependencies.movementInput.clearPlayerCliparoundInputCooldown();
    this.dependencies.touchInput.clearFpsTouchGestures();
    this.dependencies.directionPrompts.clearDirectionPromptOverlayInteraction();
    this.dependencies.mouseInput.isMiddleMouseDown = false;
    this.dependencies.mouseInput.isRightMouseDown = false;
    this.dependencies.mouseInput.rightMouseCanOpenContextMenuOnRelease = false;
    this.dependencies.mouseInput.rightMouseDragExceededDeadzone = false;
    this.dependencies.extendedCommands.exitMetaCommandMode();
    this.dependencies.tileContextActions.closeAnyTileContextMenu(false);
    this.dependencies.minimap.stopMinimapDrag();
    this.dependencies.controllerGameplay.controllerPreviousActionState =
      createControllerBooleanActionMap(false);
    this.dependencies.controllerGameplay.clearControllerMovePreview();
    this.dependencies.controllerGameplay.controllerFpsLeftStickLastMoveInput = null;
    this.dependencies.controllerGameplay.controllerFpsLeftStickNextMoveAtMs = 0;
    this.dependencies.controllerDialogs.resetControllerVirtualCursor();
    if (document.pointerLockElement === this.dependencies.renderPipeline.renderer.domElement) {
      document.exitPointerLock?.();
    }
    this.dependencies.pointerLock.fpsPointerLockActive = false;
    this.dependencies.pointerLock.fpsPointerLockRestorePending = false;
    if (wasMiddleMouseRotating && !this.dependencies.movementInput.isFpsMode()) {
      this.dependencies.camera.queueCameraYawSnapToNearest45();
    }
  }

  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (
      this.dependencies.promptDialogs.runtimeConnectionState !== "running" &&
      this.dependencies.promptDialogs.runtimeConnectionState !== "starting"
    ) {
      return;
    }
    event.preventDefault();
    // Required for Chromium-based browsers (Edge/Chrome) to show prompt.
    event.returnValue = "";
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (this.dependencies.promptDialogs.isUiInputBlocked()) {
      event.preventDefault();
      return;
    }
    if (this.dependencies.gameOver.shouldReleaseDeferredGameOverUiFromKeyDown(event)) {
      event.preventDefault();
      this.dependencies.gameOver.releaseDeferredGameOverUiReveal();
      return;
    }
    this.dependencies.audioHapticsPlatform.resumeFmodFromUserGesture();
    if (this.dependencies.fpsDiagnostics.handleFpsDebugShortcutKeyDown(event)) {
      return;
    }
    if (this.dependencies.heldWeaponAnimationDebug.handleFpsHeldWeaponAnimationDebugShortcutKeyDown(event)) {
      return;
    }

    if (this.dependencies.promptDialogs.isClientOptionsDialogOpen()) {
      return;
    }

    if (this.isKeyboardEventFromInteractiveElement(event.target)) {
      const shouldRoutePromptKey =
        (this.dependencies.questionMenus.isInQuestion || this.dependencies.directionPrompts.isInDirectionQuestion) &&
        event.key !== "Tab" &&
        !this.dependencies.modalNavigation.isEditableModalKeyboardTarget(event.target);
      if (!shouldRoutePromptKey) {
        return;
      }
    }

    if (this.dependencies.extendedCommands.handleMetaCommandKeyDown(event)) {
      return;
    }

    if (event.key === "Alt" || event.key === "Meta") {
      this.dependencies.extendedCommands.altOrMetaHeld = true;
      event.preventDefault();
      return;
    }

    if (this.dependencies.extendedCommands.isMetaCommandTriggerKey(event)) {
      if (this.dependencies.extendedCommands.useNativeExtendedCommandMenu) {
        // extmenu=true: let NetHack handle "#" directly.
        event.preventDefault();
        this.dependencies.inputCommands.sendInput("#");
        return;
      }
      if (this.dependencies.extendedCommands.canStartMetaCommandMode()) {
        event.preventDefault();
        this.dependencies.extendedCommands.startMetaCommandMode();
        return;
      }
    }

    // Handle escape key to close dialogs
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (this.dependencies.promptDialogs.isTextInputActive) {
        this.dependencies.inputCommands.submitTextInput("");
        return;
      }
      if (this.dependencies.positionSelection.positionInputModeActive) {
        this.dependencies.positionSelection.cancelPositionInputMode("keyboard escape");
        this.dependencies.questionMenus.hideQuestion();
        this.dependencies.directionPrompts.hideDirectionQuestion();
        return;
      }
      if (this.dependencies.promptDialogs.isInventoryDialogVisible) {
        this.dependencies.promptDialogs.hideInventoryDialog();
        return;
      }

      if (this.dependencies.promptDialogs.isInfoDialogVisible) {
        this.dependencies.promptDialogs.hideInfoMenuDialog();
        return;
      }

      // If we're in a prompt/position mode, send Escape to NetHack so the
      // runtime can cancel the active flow (question, direction, far-look, etc.).
      if (this.dependencies.questionMenus.isInQuestion || this.dependencies.directionPrompts.isInDirectionQuestion) {
        console.log("🔄 Sending Escape to NetHack to cancel active prompt");
        this.dependencies.inputCommands.sendInput("Escape");
      }

      // Clear UI dialogs and states
      this.dependencies.questionMenus.hideQuestion();
      this.dependencies.directionPrompts.hideDirectionQuestion();
      this.dependencies.engineState.uiAdapter.setPositionRequest(null);
      if (this.dependencies.positionSelection.positionHideTimerId !== null) {
        window.clearTimeout(this.dependencies.positionSelection.positionHideTimerId);
        this.dependencies.positionSelection.positionHideTimerId = null;
      }
      // Clear question states when escape is pressed
      this.dependencies.questionMenus.isInQuestion = false;
      this.dependencies.directionPrompts.isInDirectionQuestion = false;
      this.dependencies.positionSelection.setPositionInputMode(false);
      return;
    }

    if (event.key === "Enter" || event.key === "NumpadEnter") {
      if (this.dependencies.promptDialogs.isInventoryDialogVisible) {
        this.dependencies.promptDialogs.hideInventoryDialog();
        return;
      }

      if (this.dependencies.promptDialogs.isInfoDialogVisible) {
        this.dependencies.promptDialogs.hideInfoMenuDialog();
        return;
      }

      if (
        !this.dependencies.movementInput.isFpsMode() &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !this.dependencies.promptDialogs.isAnyModalVisible() &&
        !this.dependencies.questionMenus.isInQuestion &&
        !this.dependencies.directionPrompts.isInDirectionQuestion &&
        !this.dependencies.positionSelection.positionInputModeActive &&
        !this.dependencies.extendedCommands.metaCommandModeActive
      ) {
        event.preventDefault();
        this.dependencies.engineMessages.logClickLookTileDebug(
          "keyboard-enter",
          this.dependencies.playerMovement.playerPos.x,
          this.dependencies.playerMovement.playerPos.y,
        );
        this.dependencies.inputCommands.sendMouseInput(this.dependencies.playerMovement.playerPos.x, this.dependencies.playerMovement.playerPos.y, 0);
        return;
      }
    }

    if (this.dependencies.modalNavigation.handleModalPageScrollKeyDown(event)) {
      return;
    }

    if (this.dependencies.modalNavigation.handleModalHomeEndFocusKeyDown(event)) {
      return;
    }

    if (
      event.key === "Tab" &&
      this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      this.dependencies.questionMenus.activeQuestionMenuItems.length > 0
    ) {
      if (!this.dependencies.modalNavigation.isEditableModalKeyboardTarget(event.target)) {
        if (this.dependencies.questionMenus.moveQuestionDialogTabFocus(event.shiftKey)) {
          event.preventDefault();
          return;
        }
      }
    }

    if (this.dependencies.promptDialogs.isTextInputActive) {
      return;
    }

    if (this.dependencies.promptDialogs.isInfoDialogOpen()) {
      if (this.isSpaceDismissKey(event)) {
        event.preventDefault();
        this.dependencies.promptDialogs.hideInfoMenuDialog();
        return;
      }

      if (this.dependencies.movementInput.isMovementInput(event.key) || this.dependencies.movementInput.isMovementInput(event.code)) {
        event.preventDefault();
        return;
      }
    }

    if (
      this.dependencies.positionSelection.positionInputModeActive &&
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion
    ) {
      const priorityTravelShortcutKey = this.dependencies.positionSelection.resolveTravelPositionShortcutKey(
        event,
        true,
      );
      if (priorityTravelShortcutKey) {
        event.preventDefault();
        this.dependencies.inputCommands.sendInput(priorityTravelShortcutKey);
        return;
      }
      const positionMoveKey = this.dependencies.positionSelection.tryResolvePositionInputMovementKey(event);
      if (positionMoveKey) {
        event.preventDefault();
        this.dependencies.inputCommands.sendInput(positionMoveKey);
        return;
      }
      const positionConfirmKey = this.dependencies.positionSelection.resolvePositionInputConfirmKey(event);
      if (positionConfirmKey) {
        event.preventDefault();
        this.dependencies.inputCommands.sendInput(positionConfirmKey);
        return;
      }
      const travelShortcutKey = this.dependencies.positionSelection.resolveTravelPositionShortcutKey(event);
      if (travelShortcutKey) {
        event.preventDefault();
        this.dependencies.inputCommands.sendInput(travelShortcutKey);
        return;
      }
      event.preventDefault();
      this.dependencies.positionSelection.cancelPositionInputMode();
      return;
    }

    if (this.handleCtrlShortcutKeyDown(event)) {
      return;
    }

    const modifiedInput = this.getModifiedInput(event);
    if (modifiedInput) {
      event.preventDefault();
      this.dependencies.inputCommands.sendInput(modifiedInput);
      return;
    }
    // Handle inventory display only during normal gameplay.
    // Question dialogs must take precedence over global inventory hotkey behavior.
    if (
      (event.key === "i" || event.key === "I") &&
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion
    ) {
      event.preventDefault();
      this.dependencies.promptDialogs.toggleInventoryDialogState();
      return;
    }

    // Keep gameplay movement frozen while inventory is open.
    // Close controls (Esc/Enter/i) are handled above.
    if (
      this.dependencies.promptDialogs.isInventoryDialogOpen() &&
      (this.dependencies.movementInput.isMovementInput(event.key) || this.dependencies.movementInput.isMovementInput(event.code))
    ) {
      event.preventDefault();
      return;
    }

    if (
      this.dependencies.movementInput.isFpsMode() &&
      this.dependencies.positionSelection.positionInputModeActive &&
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const fpsLookInput = this.dependencies.movementInput.tryResolveFpsPositionLookInput(
        event.key,
        event.code,
      );
      if (fpsLookInput) {
        event.preventDefault();
        this.dependencies.inputCommands.sendInput(fpsLookInput);
        return;
      }
    }

    if (
      this.dependencies.movementInput.isFpsMode() &&
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      !this.dependencies.positionSelection.positionInputModeActive &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const fpsMoveInput = this.dependencies.movementInput.tryResolveFpsMovementInput(
        event.key,
        event.code,
      );
      if (fpsMoveInput) {
        const lowerFpsKey = event.key.toLowerCase();
        const shiftedWasdMovementKey =
          event.shiftKey &&
          (lowerFpsKey === "w" ||
            lowerFpsKey === "a" ||
            lowerFpsKey === "s" ||
            lowerFpsKey === "d");
        if (shiftedWasdMovementKey && lowerFpsKey !== "w") {
          // Let shifted WASD fall through to vanilla NetHack commands like A/S/D.
        } else {
          event.preventDefault();
          if (event.shiftKey) {
            if (event.repeat) {
              return;
            }
            this.dependencies.inputCommands.sendForcedDirectionalInput(fpsMoveInput);
            return;
          }
          this.dependencies.inputCommands.sendInput(fpsMoveInput);
          return;
        }
      }

      if (
        this.dependencies.movementInput.isFpsWasdKeyboardMovementEnabled() &&
        (event.key === "f" || event.key === "F")
      ) {
        event.preventDefault();
        this.dependencies.inputCommands.sendInput("s");
        return;
      }
    }

    // Filter out modifier keys that shouldn't be sent to NetHack
    // Note: Home, End, PageUp, PageDown are NOT filtered as they can be used for diagonal movement
    const modifierKeys = [
      "Shift",
      "Control",
      "Alt",
      "Meta",
      "CapsLock",
      "NumLock",
      "ScrollLock",
      "Tab",
      "Insert",
      "Delete",
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12",
    ];

    if (modifierKeys.indexOf(event.key) !== -1) {
      console.log(`🚫 Filtering out modifier key: ${event.key}`);
      return;
    }

    const normalizedWaitKey = this.dependencies.movementInput.normalizeWaitKey(event);
    if (
      normalizedWaitKey &&
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion
    ) {
      event.preventDefault();
      this.dependencies.inputCommands.sendInput(normalizedWaitKey);
      return;
    }

    if (
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      !this.dependencies.movementInput.isFpsMode()
    ) {
      const cameraRelativeMovementInput =
        this.dependencies.movementInput.tryResolveCameraRelativeGameplayMovementInput(event);
      if (cameraRelativeMovementInput) {
        event.preventDefault();
        this.dependencies.inputCommands.sendInput(cameraRelativeMovementInput);
        return;
      }
    }

    // Preserve numpad intent in the runtime so movement digits are not
    // conflated with top-row numeric count prefixes.
    if (
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.directionPrompts.isInDirectionQuestion &&
      event.code.startsWith("Numpad") &&
      /^[1-9]$/.test(event.key)
    ) {
      event.preventDefault();
      if (this.dependencies.inputCommands.numberPadModeEnabled) {
        this.dependencies.inputCommands.sendInput(`Numpad${event.key}`);
      } else {
        const mappedKey = this.dependencies.movementInput.mapNumpadDigitToDirectionKey(event.key);
        if (mappedKey) {
          this.dependencies.inputCommands.sendInput(mappedKey);
        }
      }
      return;
    }

    // Handle diagonal movement keys during regular gameplay
    // Map navigation keys to direction equivalents for NetHack
    if (!this.dependencies.questionMenus.isInQuestion && !this.dependencies.directionPrompts.isInDirectionQuestion) {
      const mappedKey = this.dependencies.movementInput.mapDirectionalKeyFromNavigationInput(event.key);
      if (mappedKey) {
        this.dependencies.inputCommands.sendInput(mappedKey);
        return;
      }
    }

    // If we're in any question, handle input specially and don't allow normal movement
    if (this.dependencies.questionMenus.isInQuestion || this.dependencies.directionPrompts.isInDirectionQuestion) {
      // If it's a direction question, handle direction input
      if (this.dependencies.directionPrompts.isInDirectionQuestion) {
        if (this.dependencies.movementInput.isFpsMode()) {
          const keyToSend = this.dependencies.movementInput.tryResolveFpsDirectionQuestionInput(event);
          if (keyToSend) {
            event.preventDefault();
            if (keyToSend === "Escape") {
              this.dependencies.inputCommands.sendInput("Escape");
              this.dependencies.directionPrompts.hideDirectionQuestion();
            } else {
              this.dependencies.inputCommands.submitDirectionAnswer(keyToSend);
            }
          }
          return;
        }

        // With number_pad:1 option, we can pass numpad keys and arrow keys directly
        let keyToSend = null;

        const mappedNav = this.dependencies.movementInput.mapDirectionalKeyFromNavigationInput(event.key);
        if (mappedNav) {
          keyToSend = mappedNav;
        }

        if (
          !keyToSend &&
          event.code.startsWith("Numpad") &&
          /^[1-9]$/.test(event.key)
        ) {
          keyToSend = this.dependencies.movementInput.mapNumpadDigitToDirectionKey(event.key);
        }

        if (!keyToSend) {
          if (this.dependencies.inputCommands.numberPadModeEnabled && /^[1-9]$/.test(event.key)) {
            keyToSend = event.key;
          } else if (!this.dependencies.inputCommands.numberPadModeEnabled) {
            const lowerKey = event.key.toLowerCase();
            if ("hjklyubn".includes(lowerKey)) {
              keyToSend = lowerKey;
            }
          }
        }

        if (!keyToSend) {
          switch (event.key) {
            case "<":
            case ",":
              keyToSend = "<";
              break;
            case ">":
              keyToSend = ">";
              break;
            case "s":
            case "S":
              keyToSend = "s";
              break;
            case " ":
            case "Spacebar":
            case "Space":
            case ".":
            case "Decimal":
            case "NumpadDecimal":
              keyToSend = ".";
              break;
          }
        }

        if (keyToSend) {
          const resolvedDirection =
            this.dependencies.movementInput.resolveDirectionQuestionInputForCurrentCamera(keyToSend);
          if (resolvedDirection) {
            this.dependencies.inputCommands.submitDirectionAnswer(resolvedDirection);
          }
        }
        return; // Don't send other keys when in direction question mode
      }

      const isPickupDialog = this.dependencies.questionMenus.activeQuestionIsPickupDialog;
      const isMenuQuestion = this.dependencies.questionMenus.activeQuestionMenuItems.length > 0;
      const modalDirection = this.dependencies.modalNavigation.getModalNavigationDirection(event);

      if (this.dependencies.questionMenus.handleQuestionMenuCountKeyDown(event)) {
        return;
      }

      if (
        !isMenuQuestion &&
        (modalDirection === "left" || modalDirection === "right")
      ) {
        event.preventDefault();
        this.dependencies.modalNavigation.moveSimpleQuestionChoiceFocus(modalDirection);
        return;
      }

      if (
        !isMenuQuestion &&
        (event.key === "Enter" ||
          event.key === " " ||
          event.key === "Space" ||
          event.key === "Spacebar")
      ) {
        event.preventDefault();
        const focusedChoice = this.dependencies.modalNavigation.getFocusedSimpleQuestionChoiceValue();
        if (focusedChoice) {
          this.dependencies.questionMenus.chooseQuestionChoice(focusedChoice);
          return;
        }
        this.dependencies.inputCommands.updateNumberPadModeFromChoice(event.key);
        this.dependencies.audioHapticsPlatform.maybePlayDrinkSoundForQuestionAnswer(event.key);
        this.dependencies.questionMenus.sendInputWithPendingQuestionCount(event.key);
        this.dependencies.questionMenus.hideQuestion();
        return;
      }

      if (isMenuQuestion && this.dependencies.questionMenus.activeQuestionMenuPageCount > 1) {
        if (event.key === "<") {
          event.preventDefault();
          this.dependencies.questionMenus.goToPreviousQuestionMenuPage();
          return;
        }
        if (event.key === ">") {
          event.preventDefault();
          this.dependencies.questionMenus.goToNextQuestionMenuPage();
          return;
        }
        if (event.key === "^") {
          event.preventDefault();
          this.dependencies.questionMenus.goToFirstQuestionMenuPage();
          return;
        }
        if (event.key === "|") {
          event.preventDefault();
          this.dependencies.questionMenus.goToLastQuestionMenuPage();
          return;
        }
      }

      // For other questions, handle pickup dialogs specially
      if (isPickupDialog) {
        if (this.dependencies.questionMenus.handlePickupDialogShortcutKey(event.key)) {
          event.preventDefault();
          return;
        }

        if (modalDirection) {
          event.preventDefault();
          this.dependencies.questionMenus.moveQuestionDialogMenuLikeFocus(modalDirection);
          return;
        }

        if (
          event.key === " " ||
          event.key === "Space" ||
          event.key === "Spacebar"
        ) {
          event.preventDefault();
          if (this.dependencies.questionMenus.activateFocusedQuestionAction()) {
            return;
          }
          this.dependencies.questionMenus.toggleActivePickupFocusSelection();
          return;
        }

        // This is a pickup dialog - handle multi-selection
        if (event.key === "Enter") {
          event.preventDefault();
          if (this.dependencies.questionMenus.activateFocusedQuestionAction()) {
            return;
          }
          this.dependencies.questionMenus.confirmPickupChoices();
          return;
        } else if (event.key === "Escape") {
          event.preventDefault();
          this.dependencies.inputCommands.cancelActivePrompt();
          return;
        } else {
          const resolvedSelectionInput = isMenuQuestion
            ? this.dependencies.questionMenus.resolveQuestionSelectionInputForKeyPress(event.key)
            : this.dependencies.questionMenus.resolveQuestionSelectionInput(event.key);
          const matchingItem = resolvedSelectionInput
            ? this.dependencies.questionMenus.findActiveMenuItemBySelectionInput(resolvedSelectionInput)
            : null;

          if (matchingItem && resolvedSelectionInput) {
            event.preventDefault();
            this.dependencies.questionMenus.togglePickupChoice(resolvedSelectionInput);
          } else if (!isMenuQuestion) {
            // Send the key anyway in case it's a valid NetHack command
            this.dependencies.inputCommands.updateNumberPadModeFromChoice(event.key);
            this.dependencies.questionMenus.sendInputWithPendingQuestionCount(event.key);
          }
        }
      } else {
        if (isMenuQuestion) {
          if (modalDirection) {
            event.preventDefault();
            this.dependencies.questionMenus.moveQuestionDialogMenuLikeFocus(modalDirection);
            return;
          }

          if (
            event.key === " " ||
            event.key === "Space" ||
            event.key === "Spacebar" ||
            event.key === "Enter"
          ) {
            event.preventDefault();
            if (this.dependencies.questionMenus.activateFocusedQuestionAction()) {
              return;
            }
            this.dependencies.questionMenus.confirmQuestionMenuChoice();
            return;
          }
        }

        // Standard single-selection dialog - send key and close
        const resolvedSelectionInput = isMenuQuestion
          ? this.dependencies.questionMenus.resolveQuestionSelectionInputForKeyPress(event.key)
          : this.dependencies.questionMenus.resolveQuestionSelectionInput(event.key);
        const selectedItem = resolvedSelectionInput
          ? this.dependencies.questionMenus.findActiveMenuItemBySelectionInput(resolvedSelectionInput)
          : null;
        if (selectedItem && resolvedSelectionInput) {
          event.preventDefault();
          const selectionInput =
            this.dependencies.questionMenus.getQuestionMenuSelectionInput(selectedItem);
          if (this.dependencies.runTelemetry.isSpellCastQuestionText(this.dependencies.questionMenus.activeQuestionText)) {
            this.dependencies.runTelemetry.armRecentSpellKillAttribution(
              this.dependencies.runTelemetry.extractSpellNameFromMenuItemText(selectedItem.text),
            );
          }
          this.dependencies.questionMenus.setActiveQuestionMenuFocusBySelectionInput(selectionInput);
          this.dependencies.audioHapticsPlatform.maybePlayDrinkSoundForQuestionMenuSelection(selectedItem);
          this.dependencies.inputCommands.sendInput(selectionInput);
          this.dependencies.questionMenus.hideQuestion();
        } else if (!isMenuQuestion) {
          this.dependencies.inputCommands.updateNumberPadModeFromChoice(event.key);
          this.dependencies.audioHapticsPlatform.maybePlayDrinkSoundForQuestionAnswer(event.key);
          this.dependencies.questionMenus.sendInputWithPendingQuestionCount(event.key);
          this.dependencies.questionMenus.hideQuestion();
        } else {
          return;
        }
      }
      return; // Don't allow normal movement during questions
    }

    // Send input to local runtime for normal gameplay
    const normalizedGameplayKey = String(event.key || "").trim();
    if (normalizedGameplayKey === "t" || normalizedGameplayKey === "f") {
      this.dependencies.audioHapticsPlatform.armPendingThrownWeaponDirectionSound();
    } else {
      this.dependencies.audioHapticsPlatform.clearPendingThrownWeaponDirectionSound();
    }
    this.dependencies.inputCommands.sendInput(event.key);
  }
}
