import * as THREE from "three";
import {
  nh3dCloseControllerActionWheelEventName,
  nh3dToggleControllerActionWheelEventName,
} from "../../ui-types";
import {
  defaultNh3dControllerBindings,
  normalizeNh3dControllerBindings,
  parseNh3dControllerBinding,
  type Nh3dControllerActionId,
  type Nh3dControllerBindings,
} from "../../controller-bindings";
import type {
  Nh3dAndroidBridge,
  Nh3dAndroidNativeGamepadState,
  ControllerActionSnapshot,
} from "../shared/types";
import {
  nh3dControllerActionIds,
  createControllerBooleanActionMap,
  createControllerNumberActionMap,
} from "../shared/constants";
import type { AudioHapticsPlatform } from "../audio/audio-haptics-platform";
import type { Camera } from "../camera/camera";
import type { CombatAttribution } from "../world/combat-attribution";
import type { ControllerDialogs } from "./controller-dialogs";
import type { DirectionPrompts } from "../ui/direction-prompts";
import type { EngineMessages } from "../ui/engine-messages";
import type { EngineState } from "../runtime/engine-state";
import type { ExtendedCommands } from "../ui/extended-commands";
import type { InputCommands } from "./input-commands";
import type { Minimap } from "../ui/minimap";
import type { MovementInput } from "./movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PositionSelection } from "./position-selection";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { QuestionMenus } from "../ui/question-menus";
import type { TerminalRendering } from "../rendering/terminal-rendering";
import type { TileContextActions } from "../ui/tile-context-actions";
import type { TileRendering } from "../rendering/tile-rendering";

export interface ControllerGameplayDependencies {
  readonly audioHapticsPlatform: Pick<
    AudioHapticsPlatform,
    "getNativeCapacitorPlatform"
    | "resumeFmodFromUserGesture"
  >;
  readonly camera: Pick<
    Camera,
    | "applyFpsLookDelta"
    | "cameraDistance"
    | "cameraPitch"
    | "cameraYaw"
    | "clearCameraYawSnapTarget"
    | "firstPersonMouseSensitivity"
    | "getFpsAimDirectionFromCamera"
    | "maxCameraPitch"
    | "maxDistance"
    | "minCameraPitch"
    | "minDistance"
    | "panThirdPersonCameraByScreenDelta"
    | "queueCameraYawSnapToNearest45"
    | "recenterCameraOnPlayerIfNeeded"
    | "terminalMaxCameraDistance"
    | "wrapAngle"
  >;
  readonly combatAttribution: Pick<
    CombatAttribution,
    | "setPendingPointerAttackTargetFromTile"
    | "updateDirectionalAttackContextFromTarget"
  >;
  readonly controllerDialogs: Pick<
    ControllerDialogs,
    | "clearControllerDialogDpadRepeat"
    | "clearControllerDialogSliderInteraction"
    | "focusFirstControllerOverlayActionSoon"
    | "getTopControllerOverlayElement"
    | "handleControllerDialogInput"
    | "resetControllerVirtualCursor"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
    | "updateDirectionPromptOverlayState"
  >;
  readonly engineMessages: Pick<
    EngineMessages,
    "logClickLookTileDebug"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
    | "session"
  >;
  readonly extendedCommands: Pick<
    ExtendedCommands,
    "metaCommandModeActive"
  >;
  readonly inputCommands: Pick<
    InputCommands,
    | "openCharacterSheet"
    | "sendForcedDirectionalInput"
    | "sendInput"
    | "sendMouseInput"
    | "submitDirectionAnswer"
  >;
  readonly minimap: Pick<
    Minimap,
    "updateMinimapPresentation"
  >;
  readonly movementInput: Pick<
    MovementInput,
    | "getDirectionInputFromMapDelta"
    | "getFpsDirectionQuestionInputFromAim"
    | "getMovementDeltaFromInput"
    | "isCameraRelativeMovementEnabled"
    | "isFpsMode"
    | "resolveCameraRelativeDirectionInputFromLocalDelta"
    | "resolveDirectionKeyFromDelta"
    | "resolveDirectionQuestionInputForCurrentCamera"
    | "resolveFpsRelativeMovementInput"
    | "shouldUseFpsSelfTileDirectionTarget"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    | "isAnyModalVisible"
    | "isInfoDialogOpen"
    | "isInventoryDialogOpen"
    | "isTextInputActive"
    | "toggleInventoryDialogState"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "isInQuestion"
  >;
  readonly terminalRendering: Pick<
    TerminalRendering,
    "isTerminalDisplayMode"
  >;
  readonly tileContextActions: Pick<
    TileContextActions,
    | "closeFpsCrosshairContextMenu"
    | "fpsCrosshairContextMenuOpen"
    | "normalTileContextMenuOpen"
    | "openFpsCrosshairContextMenu"
    | "openNormalTileContextMenuAtTarget"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
}

/** Gamepad sampling and bindings, movement previews and latches, gameplay and camera controls. */
export class ControllerGameplay {
  constructor(private readonly dependencies: ControllerGameplayDependencies) {}

  controllerPreviousActionState: Record<Nh3dControllerActionId, boolean> =
    createControllerBooleanActionMap(false);

  controllerMoveHighlightTile: { x: number; y: number } | null = null;

  controllerDpadMovePreviewInput: string | null = null;

  controllerDpadDiagonalReleasePreviewInput: string | null = null;

  controllerDpadDiagonalReleaseFallbackInput: string | null = null;

  controllerDpadDiagonalReleaseUntilMs: number = 0;

  controllerLeftStickMovePreviewInput: string | null = null;

  controllerDirectionPromptPreviewInput: string | null = null;

  controllerDirectionPromptPreviewSource:
    | "left_stick"
    | "dpad"
    | "right_stick"
    | "fps_aim"
    | null = null;

  controllerConfirmRearmPending: boolean = false;

  controllerCancelRearmPending: boolean = false;

  controllerFpsDirectionPromptUiUntilMs: number = 0;

  readonly controllerFpsDirectionPromptUiWindowMs: number = 3000;

  controllerFpsLeftStickLastMoveInput: string | null = null;

  controllerFpsLeftStickNextMoveAtMs: number = 0;

  controllerMinimapExpanded: boolean = false;

  controllerZoomCameraRotationActive: boolean = false;

  readonly controllerAxisDeadzone: number = 0.35;

  readonly controllerDpadDiagonalReleaseConfirmWindowMs: number = 150;

  readonly controllerLookSpeedPxPerSec: number = 700;

  readonly controllerCameraPanTilesPerSec: number = 9.2;

  readonly controllerCameraPanRunSpeedMultiplier: number = 3;

  readonly controllerZoomDistancePerSec: number = 14;

  readonly controllerCameraRotateRadPerSec: number = Math.PI;

  getControllerBindings(): Nh3dControllerBindings {
    const bindings =
      this.dependencies.engineState.clientOptions.controllerBindings;
    if (bindings) {
      return bindings;
    }
    return normalizeNh3dControllerBindings(defaultNh3dControllerBindings);
  }

  shouldReadAndroidNativeGamepadState(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    if (
      this.dependencies.audioHapticsPlatform.getNativeCapacitorPlatform() ===
      "android"
    ) {
      return true;
    }
    return (
      typeof navigator !== "undefined" &&
      /\bAndroid\b/i.test(navigator.userAgent || "")
    );
  }

  normalizeAndroidNativeGamepadAxes(rawValue: unknown): number[] {
    const axes = [0, 0, 0, 0];
    if (!Array.isArray(rawValue)) {
      return axes;
    }
    for (let index = 0; index < axes.length; index += 1) {
      const value = Number(rawValue[index]);
      axes[index] = Number.isFinite(value)
        ? THREE.MathUtils.clamp(value, -1, 1)
        : 0;
    }
    return axes;
  }

  normalizeAndroidNativeGamepadButtons(rawValue: unknown): GamepadButton[] {
    const buttonCount = 17;
    const buttons: GamepadButton[] = [];
    const rawButtons = Array.isArray(rawValue) ? rawValue : [];
    for (let index = 0; index < buttonCount; index += 1) {
      const value = THREE.MathUtils.clamp(Number(rawButtons[index]) || 0, 0, 1);
      buttons.push({
        pressed: value >= 0.5,
        touched: value > 0,
        value,
      });
    }
    return buttons;
  }

  getAndroidNativeGamepad(): Gamepad | null {
    if (!this.shouldReadAndroidNativeGamepadState()) {
      return null;
    }
    const androidBridge = (
      window as Window & {
        nh3dAndroid?: Nh3dAndroidBridge;
      }
    ).nh3dAndroid;
    const rawStateJson = androidBridge?.getGamepadStateJson?.();
    if (!rawStateJson) {
      return null;
    }
    let state: Nh3dAndroidNativeGamepadState;
    try {
      state = JSON.parse(rawStateJson) as Nh3dAndroidNativeGamepadState;
    } catch {
      return null;
    }
    if (state.connected !== true) {
      return null;
    }
    const timestamp = Number(state.timestamp);
    return {
      axes: this.normalizeAndroidNativeGamepadAxes(state.axes),
      buttons: this.normalizeAndroidNativeGamepadButtons(state.buttons),
      connected: true,
      hapticActuators: [],
      id: "Android native controller",
      index: 0,
      mapping: "standard",
      timestamp: Number.isFinite(timestamp) ? timestamp : 0,
      vibrationActuator: null,
    } as unknown as Gamepad;
  }

  getConnectedGamepads(): Gamepad[] {
    const connected: Gamepad[] = [];
    const androidNativeGamepad = this.getAndroidNativeGamepad();
    if (androidNativeGamepad) {
      connected.push(androidNativeGamepad);
    }
    if (typeof navigator === "undefined" || !navigator.getGamepads) {
      return connected;
    }
    const pads = navigator.getGamepads();
    if (pads && pads.length > 0) {
      for (const gamepad of pads) {
        if (gamepad && gamepad.connected) {
          connected.push(gamepad);
        }
      }
    }
    return connected;
  }

  getControllerBindingValue(
    gamepad: Gamepad,
    binding: string | null | undefined,
  ): number {
    if (!binding) {
      return 0;
    }
    const parsedBinding = parseNh3dControllerBinding(binding);
    if (!parsedBinding) {
      return 0;
    }
    if (parsedBinding.kind === "button") {
      const button = gamepad.buttons[parsedBinding.index];
      if (!button) {
        return 0;
      }
      const buttonValue = button.pressed ? 1 : button.value;
      return THREE.MathUtils.clamp(buttonValue, 0, 1);
    }
    const axisValue = gamepad.axes[parsedBinding.index];
    if (!Number.isFinite(axisValue)) {
      return 0;
    }
    const directionalValue = axisValue * parsedBinding.direction;
    if (directionalValue <= this.controllerAxisDeadzone) {
      return 0;
    }
    return THREE.MathUtils.clamp(
      (directionalValue - this.controllerAxisDeadzone) /
        (1 - this.controllerAxisDeadzone),
      0,
      1,
    );
  }

  getControllerActionValue(
    actionId: Nh3dControllerActionId,
    bindings: Nh3dControllerBindings,
    gamepads: readonly Gamepad[],
  ): number {
    const slots = bindings[actionId];
    if (!slots) {
      return 0;
    }
    let maxValue = 0;
    for (const gamepad of gamepads) {
      const firstValue = this.getControllerBindingValue(gamepad, slots[0]);
      const secondValue = this.getControllerBindingValue(gamepad, slots[1]);
      maxValue = Math.max(maxValue, firstValue, secondValue);
      if (maxValue >= 1) {
        return 1;
      }
    }
    return THREE.MathUtils.clamp(maxValue, 0, 1);
  }

  sampleControllerActionSnapshot(
    bindings: Nh3dControllerBindings,
    gamepads: readonly Gamepad[],
  ): ControllerActionSnapshot {
    const values = createControllerNumberActionMap(0);
    const active = createControllerBooleanActionMap(false);
    const pressed = createControllerBooleanActionMap(false);
    const released = createControllerBooleanActionMap(false);
    const nextPrevious = createControllerBooleanActionMap(false);
    const activeThreshold = 0.5;

    for (const actionId of nh3dControllerActionIds) {
      const value = this.getControllerActionValue(actionId, bindings, gamepads);
      const isActive = value >= activeThreshold;
      values[actionId] = value;
      active[actionId] = isActive;
      pressed[actionId] =
        isActive && !this.controllerPreviousActionState[actionId];
      released[actionId] =
        !isActive && Boolean(this.controllerPreviousActionState[actionId]);
      nextPrevious[actionId] = isActive;
    }

    this.controllerPreviousActionState = nextPrevious;
    return { values, active, pressed, released };
  }

  isControllerUiInputContextActive(): boolean {
    return (
      this.dependencies.questionMenus.isInQuestion ||
      this.dependencies.directionPrompts.isInDirectionQuestion ||
      this.dependencies.promptDialogs.isTextInputActive ||
      this.dependencies.positionSelection.positionInputModeActive ||
      this.dependencies.extendedCommands.metaCommandModeActive ||
      this.dependencies.promptDialogs.isInventoryDialogOpen() ||
      this.dependencies.promptDialogs.isInfoDialogOpen() ||
      this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen ||
      this.dependencies.tileContextActions.normalTileContextMenuOpen ||
      this.dependencies.promptDialogs.isAnyModalVisible()
    );
  }

  isControllerGameplayInputContextActive(): boolean {
    return (
      Boolean(this.dependencies.engineState.session) &&
      !this.isControllerUiInputContextActive()
    );
  }

  armControllerFpsDirectionPromptUi(): void {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return;
    }
    this.controllerFpsDirectionPromptUiUntilMs =
      Date.now() + this.controllerFpsDirectionPromptUiWindowMs;
  }

  consumeControllerFpsDirectionPromptUi(): boolean {
    if (
      !this.dependencies.movementInput.isFpsMode() ||
      Date.now() > this.controllerFpsDirectionPromptUiUntilMs
    ) {
      this.controllerFpsDirectionPromptUiUntilMs = 0;
      return false;
    }
    this.controllerFpsDirectionPromptUiUntilMs = 0;
    return true;
  }

  clearControllerMovePreview(): void {
    this.controllerDpadMovePreviewInput = null;
    this.controllerDpadDiagonalReleasePreviewInput = null;
    this.controllerDpadDiagonalReleaseFallbackInput = null;
    this.controllerDpadDiagonalReleaseUntilMs = 0;
    this.controllerLeftStickMovePreviewInput = null;
    this.controllerMoveHighlightTile = null;
  }

  clearControllerDirectionPromptPreview(): void {
    this.controllerDirectionPromptPreviewInput = null;
    this.controllerDirectionPromptPreviewSource = null;
    this.controllerMoveHighlightTile = null;
    this.dependencies.directionPrompts.updateDirectionPromptOverlayState();
  }

  consumeControllerConfirmUntilRelease(): void {
    this.controllerConfirmRearmPending = true;
  }

  consumeControllerCancelUntilRelease(): void {
    this.controllerCancelRearmPending = true;
  }

  applyControllerCancelRearmLatch(
    snapshot: ControllerActionSnapshot,
  ): ControllerActionSnapshot {
    if (!this.controllerCancelRearmPending) {
      return snapshot;
    }

    const pressed = {
      ...snapshot.pressed,
    };
    const released = {
      ...snapshot.released,
    };

    pressed.cancel_or_context = false;
    if (released.cancel_or_context) {
      released.cancel_or_context = false;
      this.controllerCancelRearmPending = false;
    }

    return {
      ...snapshot,
      pressed,
      released,
    };
  }

  applyControllerConfirmRearmLatch(
    snapshot: ControllerActionSnapshot,
  ): ControllerActionSnapshot {
    if (!this.controllerConfirmRearmPending) {
      return snapshot;
    }

    const pressed = {
      ...snapshot.pressed,
    };
    const released = {
      ...snapshot.released,
    };

    pressed.confirm = false;
    if (released.confirm) {
      released.confirm = false;
      this.controllerConfirmRearmPending = false;
    }

    return {
      ...snapshot,
      pressed,
      released,
    };
  }

  handleControllerDirectionQuestionInput(
    snapshot: ControllerActionSnapshot,
    deltaSeconds: number,
  ): void {
    const previousPreviewInput = this.controllerDirectionPromptPreviewInput;
    const previousPreviewSource = this.controllerDirectionPromptPreviewSource;
    const leftX =
      snapshot.values.left_stick_right - snapshot.values.left_stick_left;
    const leftY =
      snapshot.values.left_stick_down - snapshot.values.left_stick_up;
    const dpadX = snapshot.values.dpad_right - snapshot.values.dpad_left;
    const dpadY = snapshot.values.dpad_down - snapshot.values.dpad_up;
    const rightX =
      snapshot.values.right_stick_right - snapshot.values.right_stick_left;
    const rightY =
      snapshot.values.right_stick_down - snapshot.values.right_stick_up;

    const leftDirectionInput = this.getDirectionInputFromControllerAxes(
      leftX,
      leftY,
      this.controllerAxisDeadzone,
    );
    const dpadDirectionInput = this.getDirectionInputFromControllerAxes(
      dpadX,
      dpadY,
      this.controllerAxisDeadzone,
    );
    const resolvedLeftDirectionInput = leftDirectionInput
      ? this.dependencies.movementInput.resolveDirectionQuestionInputForCurrentCamera(
          leftDirectionInput,
        )
      : null;
    const resolvedDpadDirectionInput = dpadDirectionInput
      ? this.dependencies.movementInput.resolveDirectionQuestionInputForCurrentCamera(
          dpadDirectionInput,
        )
      : null;
    const dpadVerticalInput =
      this.getVerticalDirectionPromptInputFromControllerAxes(
        dpadX,
        dpadY,
        this.controllerAxisDeadzone,
        { negativeYInput: "<", positiveYInput: ">" },
      );
    const rightStickVerticalInput =
      this.getVerticalDirectionPromptInputFromControllerAxes(
        rightX,
        rightY,
        this.controllerAxisDeadzone,
      );

    if (this.dependencies.movementInput.isFpsMode()) {
      const rightStickMagnitude = Math.hypot(rightX, rightY);
      if (rightStickMagnitude > this.controllerAxisDeadzone) {
        const lookDeltaX =
          rightX * this.controllerLookSpeedPxPerSec * deltaSeconds;
        const lookDeltaY =
          rightY * this.controllerLookSpeedPxPerSec * deltaSeconds;
        this.dependencies.camera.applyFpsLookDelta(
          lookDeltaX,
          lookDeltaY,
          this.dependencies.camera.firstPersonMouseSensitivity,
        );
      }

      if (dpadVerticalInput) {
        this.controllerDirectionPromptPreviewInput = dpadVerticalInput;
        this.controllerDirectionPromptPreviewSource = "dpad";
      } else {
        this.controllerDirectionPromptPreviewInput =
          this.dependencies.movementInput.getFpsDirectionQuestionInputFromAim();
        this.controllerDirectionPromptPreviewSource = this
          .controllerDirectionPromptPreviewInput
          ? "fps_aim"
          : null;
      }
      this.dependencies.directionPrompts.updateDirectionPromptOverlayState();

      if (
        this.controllerDirectionPromptPreviewInput &&
        this.dependencies.movementInput.getMovementDeltaFromInput(
          this.controllerDirectionPromptPreviewInput,
        )
      ) {
        this.setControllerMovePreviewDirection(
          this.controllerDirectionPromptPreviewInput,
        );
      } else {
        this.controllerMoveHighlightTile = null;
      }

      if (snapshot.pressed.search) {
        this.dependencies.inputCommands.submitDirectionAnswer("s");
        this.clearControllerDirectionPromptPreview();
        return;
      }

      if (
        snapshot.released.confirm &&
        this.controllerDirectionPromptPreviewInput
      ) {
        this.dependencies.inputCommands.submitDirectionAnswer(
          this.controllerDirectionPromptPreviewInput,
        );
        this.clearControllerDirectionPromptPreview();
      }
      return;
    }

    const releasedAnyDpad =
      snapshot.released.dpad_up ||
      snapshot.released.dpad_down ||
      snapshot.released.dpad_left ||
      snapshot.released.dpad_right;

    if (
      releasedAnyDpad &&
      !dpadDirectionInput &&
      previousPreviewSource === "dpad" &&
      previousPreviewInput
    ) {
      this.dependencies.inputCommands.submitDirectionAnswer(
        previousPreviewInput,
      );
      this.clearControllerDirectionPromptPreview();
      return;
    }

    if (resolvedLeftDirectionInput) {
      this.controllerDirectionPromptPreviewInput = resolvedLeftDirectionInput;
      this.controllerDirectionPromptPreviewSource = "left_stick";
    } else if (resolvedDpadDirectionInput) {
      this.controllerDirectionPromptPreviewInput = resolvedDpadDirectionInput;
      this.controllerDirectionPromptPreviewSource = "dpad";
    } else if (rightStickVerticalInput) {
      this.controllerDirectionPromptPreviewInput = rightStickVerticalInput;
      this.controllerDirectionPromptPreviewSource = "right_stick";
    } else {
      this.controllerDirectionPromptPreviewInput = null;
      this.controllerDirectionPromptPreviewSource = null;
    }
    this.dependencies.directionPrompts.updateDirectionPromptOverlayState();

    if (
      this.controllerDirectionPromptPreviewInput &&
      this.dependencies.movementInput.getMovementDeltaFromInput(
        this.controllerDirectionPromptPreviewInput,
      )
    ) {
      this.setControllerMovePreviewDirection(
        this.controllerDirectionPromptPreviewInput,
      );
    } else {
      this.controllerMoveHighlightTile = null;
    }

    if (snapshot.pressed.search) {
      this.dependencies.inputCommands.submitDirectionAnswer("s");
      this.clearControllerDirectionPromptPreview();
      return;
    }

    if (
      snapshot.released.confirm &&
      this.controllerDirectionPromptPreviewInput
    ) {
      this.dependencies.inputCommands.submitDirectionAnswer(
        this.controllerDirectionPromptPreviewInput,
      );
      this.clearControllerDirectionPromptPreview();
      return;
    }
  }

  setControllerMovePreviewDirection(directionInput: string): void {
    const movementDelta =
      this.dependencies.movementInput.getMovementDeltaFromInput(directionInput);
    if (!movementDelta) {
      return;
    }
    this.controllerMoveHighlightTile = {
      x: this.dependencies.playerMovement.playerPos.x + movementDelta.dx,
      y: this.dependencies.playerMovement.playerPos.y + movementDelta.dy,
    };
  }

  isDiagonalMovementInput(input: string | null): boolean {
    if (!input) {
      return false;
    }
    const movementDelta =
      this.dependencies.movementInput.getMovementDeltaFromInput(input);
    return Boolean(
      movementDelta && movementDelta.dx !== 0 && movementDelta.dy !== 0,
    );
  }

  isCardinalDirectionPartOfDiagonal(
    cardinalInput: string | null,
    diagonalInput: string | null,
  ): boolean {
    if (!cardinalInput || !diagonalInput) {
      return false;
    }
    const cardinalDelta =
      this.dependencies.movementInput.getMovementDeltaFromInput(cardinalInput);
    const diagonalDelta =
      this.dependencies.movementInput.getMovementDeltaFromInput(diagonalInput);
    if (!cardinalDelta || !diagonalDelta) {
      return false;
    }
    const cardinalIsDiagonal = cardinalDelta.dx !== 0 && cardinalDelta.dy !== 0;
    const diagonalIsDiagonal = diagonalDelta.dx !== 0 && diagonalDelta.dy !== 0;
    if (cardinalIsDiagonal || !diagonalIsDiagonal) {
      return false;
    }
    const xMatches =
      cardinalDelta.dx === 0 || cardinalDelta.dx === diagonalDelta.dx;
    const yMatches =
      cardinalDelta.dy === 0 || cardinalDelta.dy === diagonalDelta.dy;
    return xMatches && yMatches;
  }

  restoreControllerMovePreviewAfterDpadClear(): void {
    if (this.controllerLeftStickMovePreviewInput) {
      this.setControllerMovePreviewDirection(
        this.controllerLeftStickMovePreviewInput,
      );
    } else {
      this.controllerMoveHighlightTile = null;
    }
  }

  clearControllerDpadDiagonalReleaseGrace(): void {
    this.controllerDpadDiagonalReleasePreviewInput = null;
    this.controllerDpadDiagonalReleaseFallbackInput = null;
    this.controllerDpadDiagonalReleaseUntilMs = 0;
  }

  submitControllerDpadPreviewInput(
    directionInput: string,
    runModifierActive: boolean,
  ): void {
    this.submitControllerDirectionalInput(directionInput, runModifierActive, {
      preferMouseMove: true,
    });
    this.controllerDpadMovePreviewInput = null;
    this.clearControllerDpadDiagonalReleaseGrace();
    this.restoreControllerMovePreviewAfterDpadClear();
  }

  updateControllerDpadMovePreview(
    dpadDirectionInput: string | null,
    runModifierActive: boolean,
  ): void {
    const nowMs = Date.now();
    const previewInput = this.controllerDpadMovePreviewInput;
    const pendingDiagonalInput = this.controllerDpadDiagonalReleasePreviewInput;

    if (pendingDiagonalInput) {
      const withinWindow = nowMs <= this.controllerDpadDiagonalReleaseUntilMs;
      if (dpadDirectionInput === pendingDiagonalInput) {
        this.clearControllerDpadDiagonalReleaseGrace();
        this.controllerDpadMovePreviewInput = pendingDiagonalInput;
        this.setControllerMovePreviewDirection(pendingDiagonalInput);
        return;
      }

      if (
        dpadDirectionInput &&
        this.isCardinalDirectionPartOfDiagonal(
          dpadDirectionInput,
          pendingDiagonalInput,
        )
      ) {
        this.controllerDpadDiagonalReleaseFallbackInput = dpadDirectionInput;
        if (withinWindow) {
          this.controllerDpadMovePreviewInput = pendingDiagonalInput;
          this.setControllerMovePreviewDirection(pendingDiagonalInput);
          return;
        }
        this.clearControllerDpadDiagonalReleaseGrace();
        this.controllerDpadMovePreviewInput = dpadDirectionInput;
        this.setControllerMovePreviewDirection(dpadDirectionInput);
        return;
      }

      if (!dpadDirectionInput) {
        const fallbackInput = this.controllerDpadDiagonalReleaseFallbackInput;
        if (withinWindow) {
          this.submitControllerDpadPreviewInput(
            pendingDiagonalInput,
            runModifierActive,
          );
          return;
        }
        if (fallbackInput) {
          this.submitControllerDpadPreviewInput(
            fallbackInput,
            runModifierActive,
          );
          return;
        }
        this.clearControllerDpadDiagonalReleaseGrace();
      } else {
        this.clearControllerDpadDiagonalReleaseGrace();
        this.controllerDpadMovePreviewInput = dpadDirectionInput;
        this.setControllerMovePreviewDirection(dpadDirectionInput);
        return;
      }
    }

    if (dpadDirectionInput) {
      if (
        previewInput &&
        this.isDiagonalMovementInput(previewInput) &&
        this.isCardinalDirectionPartOfDiagonal(dpadDirectionInput, previewInput)
      ) {
        this.controllerDpadDiagonalReleasePreviewInput = previewInput;
        this.controllerDpadDiagonalReleaseFallbackInput = dpadDirectionInput;
        this.controllerDpadDiagonalReleaseUntilMs =
          nowMs + this.controllerDpadDiagonalReleaseConfirmWindowMs;
        this.controllerDpadMovePreviewInput = previewInput;
        this.setControllerMovePreviewDirection(previewInput);
        return;
      }
      this.clearControllerDpadDiagonalReleaseGrace();
      this.controllerDpadMovePreviewInput = dpadDirectionInput;
      this.setControllerMovePreviewDirection(dpadDirectionInput);
      return;
    }

    if (previewInput) {
      this.submitControllerDpadPreviewInput(previewInput, runModifierActive);
    }
  }

  submitControllerDirectionalInput(
    directionInput: string | null,
    runModifierActive: boolean,
    options: { preferMouseMove?: boolean } = {},
  ): void {
    if (!directionInput) {
      return;
    }
    if (runModifierActive) {
      this.dependencies.inputCommands.sendForcedDirectionalInput(
        directionInput,
      );
      return;
    }
    if (
      options.preferMouseMove === true &&
      this.submitControllerDirectionalMouseMove(directionInput)
    ) {
      return;
    }
    this.dependencies.inputCommands.sendInput(directionInput);
  }

  submitControllerDirectionalMouseMove(directionInput: string): boolean {
    const movementDelta =
      this.dependencies.movementInput.getMovementDeltaFromInput(directionInput);
    if (!movementDelta) {
      return false;
    }
    const targetX =
      this.dependencies.playerMovement.playerPos.x + movementDelta.dx;
    const targetY =
      this.dependencies.playerMovement.playerPos.y + movementDelta.dy;
    this.dependencies.combatAttribution.updateDirectionalAttackContextFromTarget(
      targetX,
      targetY,
    );
    this.dependencies.combatAttribution.setPendingPointerAttackTargetFromTile(
      targetX,
      targetY,
    );
    this.dependencies.engineMessages.logClickLookTileDebug(
      "controller-confirm-move",
      targetX,
      targetY,
    );
    this.dependencies.inputCommands.sendMouseInput(targetX, targetY, 0);
    return true;
  }

  getDirectionInputFromControllerAxes(
    axisX: number,
    axisY: number,
    deadzone: number,
  ): string | null {
    if (!Number.isFinite(axisX) || !Number.isFinite(axisY)) {
      return null;
    }
    const direction =
      this.dependencies.movementInput.resolveDirectionKeyFromDelta(
        axisX,
        axisY,
        deadzone,
      );
    if (!direction) {
      return null;
    }
    return this.dependencies.movementInput.getDirectionInputFromMapDelta(
      direction.dx,
      direction.dy,
    );
  }

  resolveControllerGameplayDirectionInputFromAxes(
    axisX: number,
    axisY: number,
    deadzone: number,
  ): string | null {
    if (!Number.isFinite(axisX) || !Number.isFinite(axisY)) {
      return null;
    }
    const localDirection =
      this.dependencies.movementInput.resolveDirectionKeyFromDelta(
        axisX,
        axisY,
        deadzone,
      );
    if (!localDirection) {
      return null;
    }
    if (this.dependencies.movementInput.isCameraRelativeMovementEnabled()) {
      return this.dependencies.movementInput.resolveCameraRelativeDirectionInputFromLocalDelta(
        localDirection.dx,
        localDirection.dy,
      );
    }
    return this.dependencies.movementInput.getDirectionInputFromMapDelta(
      localDirection.dx,
      localDirection.dy,
    );
  }

  getVerticalDirectionPromptInputFromControllerAxes(
    axisX: number,
    axisY: number,
    deadzone: number,
    options: {
      negativeYInput?: string;
      positiveYInput?: string;
    } = {},
  ): string | null {
    if (!Number.isFinite(axisX) || !Number.isFinite(axisY)) {
      return null;
    }
    const absX = Math.abs(axisX);
    const absY = Math.abs(axisY);
    if (absY < deadzone) {
      return null;
    }
    if (absX > absY * 0.6) {
      return null;
    }
    const negativeYInput = options.negativeYInput ?? ">";
    const positiveYInput = options.positiveYInput ?? "<";
    return axisY < 0 ? negativeYInput : positiveYInput;
  }

  resolveControllerFpsMovementFromAxes(
    axisX: number,
    axisY: number,
  ): string | null {
    const localRight = THREE.MathUtils.clamp(Math.sign(axisX), -1, 1);
    const localForward = THREE.MathUtils.clamp(-Math.sign(axisY), -1, 1);
    if (localRight === 0 && localForward === 0) {
      return null;
    }
    const aim = this.dependencies.camera.getFpsAimDirectionFromCamera();
    if (!aim) {
      return null;
    }
    return this.dependencies.movementInput.resolveFpsRelativeMovementInput(
      aim,
      localRight as -1 | 0 | 1,
      localForward as -1 | 0 | 1,
    );
  }

  dispatchControllerKeyDown(key: string, code?: string): void {
    if (
      key === "Enter" &&
      !this.dependencies.directionPrompts.isInDirectionQuestion
    ) {
      this.armControllerFpsDirectionPromptUi();
    }
    const event = new KeyboardEvent("keydown", {
      key,
      code: code ?? key,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  }

  dispatchControllerActionWheelToggleRequest(): void {
    if (typeof window === "undefined") {
      return;
    }
    const event = new CustomEvent(nh3dToggleControllerActionWheelEventName, {
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  }

  dispatchControllerActionWheelCloseRequest(): void {
    if (typeof window === "undefined") {
      return;
    }
    const event = new CustomEvent(nh3dCloseControllerActionWheelEventName, {
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  }

  getControllerActionWheelOverlayElement(): HTMLElement | null {
    const overlay =
      this.dependencies.controllerDialogs.getTopControllerOverlayElement();
    if (
      !overlay ||
      !overlay.classList.contains("nh3d-controller-action-wheel-dialog")
    ) {
      return null;
    }
    return overlay;
  }

  highlightControllerActionWheelFromSticks(
    snapshot: ControllerActionSnapshot,
    overlay: HTMLElement,
  ): boolean {
    const leftX =
      snapshot.values.left_stick_right - snapshot.values.left_stick_left;
    const leftY =
      snapshot.values.left_stick_down - snapshot.values.left_stick_up;
    const rightX =
      snapshot.values.right_stick_right - snapshot.values.right_stick_left;
    const rightY =
      snapshot.values.right_stick_down - snapshot.values.right_stick_up;
    const leftMagnitude = Math.hypot(leftX, leftY);
    const rightMagnitude = Math.hypot(rightX, rightY);
    const useLeftStick = leftMagnitude >= rightMagnitude;
    const axisX = useLeftStick ? leftX : rightX;
    const axisY = useLeftStick ? leftY : rightY;
    const magnitude = useLeftStick ? leftMagnitude : rightMagnitude;
    if (magnitude <= this.controllerAxisDeadzone) {
      return false;
    }

    const wheelButtons = Array.from(
      overlay.querySelectorAll<HTMLElement>("[data-nh3d-wheel-angle]"),
    ).filter((button) => {
      if (!button.isConnected) {
        return false;
      }
      const style = window.getComputedStyle(button);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      return button.getClientRects().length > 0;
    });
    if (wheelButtons.length === 0) {
      return false;
    }

    const inputAngle = Math.atan2(axisY, axisX);
    let bestButton: HTMLElement | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const button of wheelButtons) {
      const rawAngle = Number.parseFloat(button.dataset.nh3dWheelAngle || "");
      if (!Number.isFinite(rawAngle)) {
        continue;
      }
      const buttonAngle = THREE.MathUtils.degToRad(rawAngle);
      const delta = Math.abs(
        this.dependencies.camera.wrapAngle(inputAngle - buttonAngle),
      );
      if (delta < bestDistance) {
        bestDistance = delta;
        bestButton = button;
      }
    }
    if (!bestButton) {
      return false;
    }

    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (activeElement !== bestButton) {
      bestButton.focus({ preventScroll: true });
    }
    return true;
  }

  openContextActionsFromController(): void {
    if (this.dependencies.movementInput.isFpsMode()) {
      if (this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen) {
        this.dependencies.tileContextActions.closeFpsCrosshairContextMenu(true);
      } else {
        this.dependencies.tileContextActions.openFpsCrosshairContextMenu();
        this.dependencies.controllerDialogs.focusFirstControllerOverlayActionSoon();
      }
      return;
    }
    const targetTile = this.controllerMoveHighlightTile ?? {
      x: this.dependencies.playerMovement.playerPos.x,
      y: this.dependencies.playerMovement.playerPos.y,
    };
    const key = `${targetTile.x},${targetTile.y}`;
    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    if (!mesh) {
      return;
    }
    this.dependencies.tileContextActions.openNormalTileContextMenuAtTarget({
      key,
      x: targetTile.x,
      y: targetTile.y,
      mesh,
    });
    this.dependencies.controllerDialogs.focusFirstControllerOverlayActionSoon();
  }

  toggleControllerLargeMinimap(): void {
    this.controllerMinimapExpanded = !this.controllerMinimapExpanded;
    this.dependencies.minimap.updateMinimapPresentation();
  }

  finishControllerZoomCameraRotation(): void {
    if (!this.controllerZoomCameraRotationActive) {
      return;
    }
    this.controllerZoomCameraRotationActive = false;
    this.dependencies.camera.queueCameraYawSnapToNearest45();
  }

  updateControllerZoomCameraRotation(
    axisX: number,
    axisY: number,
    zoomModifierActive: boolean,
    deltaSeconds: number,
  ): void {
    const yawAxis =
      zoomModifierActive && Math.abs(axisX) > this.controllerAxisDeadzone
        ? axisX
        : 0;
    const pitchAxis =
      zoomModifierActive && Math.abs(axisY) > this.controllerAxisDeadzone
        ? axisY
        : 0;
    if (yawAxis === 0 && pitchAxis === 0) {
      this.finishControllerZoomCameraRotation();
      return;
    }
    this.dependencies.camera.clearCameraYawSnapTarget();
    if (yawAxis !== 0) {
      this.dependencies.camera.cameraYaw = this.dependencies.camera.wrapAngle(
        this.dependencies.camera.cameraYaw +
          yawAxis * this.controllerCameraRotateRadPerSec * deltaSeconds,
      );
    }
    if (pitchAxis !== 0) {
      this.dependencies.camera.cameraPitch = THREE.MathUtils.clamp(
        this.dependencies.camera.cameraPitch +
          pitchAxis * this.controllerCameraRotateRadPerSec * deltaSeconds,
        this.dependencies.camera.minCameraPitch,
        this.dependencies.camera.maxCameraPitch,
      );
    }
    this.controllerZoomCameraRotationActive = true;
  }

  handleControllerGameplayInput(
    snapshot: ControllerActionSnapshot,
    deltaSeconds: number,
  ): void {
    const values = snapshot.values;
    const runModifierActive = snapshot.active.run_modifier;
    const dpadX = values.dpad_right - values.dpad_left;
    const dpadY = values.dpad_down - values.dpad_up;
    const leftX = values.left_stick_right - values.left_stick_left;
    const leftY = values.left_stick_down - values.left_stick_up;
    const rightX = values.right_stick_right - values.right_stick_left;
    const rightY = values.right_stick_down - values.right_stick_up;
    const zoomModifierActive =
      !this.dependencies.movementInput.isFpsMode() && snapshot.active.zoom_in;
    const leftStickPressed =
      snapshot.pressed.left_stick_up ||
      snapshot.pressed.left_stick_down ||
      snapshot.pressed.left_stick_left ||
      snapshot.pressed.left_stick_right;

    if (snapshot.pressed.pause_menu) {
      this.dispatchControllerKeyDown("Escape", "Escape");
    }
    if (snapshot.pressed.open_inventory) {
      this.dependencies.promptDialogs.toggleInventoryDialogState();
    }
    if (snapshot.pressed.open_character) {
      this.dependencies.inputCommands.openCharacterSheet();
    }
    if (snapshot.pressed.action_menu) {
      this.dispatchControllerActionWheelToggleRequest();
    }
    if (snapshot.pressed.toggle_large_minimap) {
      this.toggleControllerLargeMinimap();
    }
    if (
      snapshot.pressed.recenter_camera ||
      (!this.dependencies.movementInput.isFpsMode() &&
        !zoomModifierActive &&
        leftStickPressed)
    ) {
      this.dependencies.camera.recenterCameraOnPlayerIfNeeded();
    }
    if (!this.dependencies.movementInput.isFpsMode() && zoomModifierActive) {
      const leftZoomAxis =
        Math.abs(leftY) > this.controllerAxisDeadzone ? leftY : 0;
      if (leftZoomAxis !== 0) {
        this.dependencies.camera.cameraDistance = THREE.MathUtils.clamp(
          this.dependencies.camera.cameraDistance +
            leftZoomAxis * this.controllerZoomDistancePerSec * deltaSeconds,
          this.dependencies.camera.minDistance,
          this.dependencies.terminalRendering.isTerminalDisplayMode()
            ? this.dependencies.camera.terminalMaxCameraDistance
            : this.dependencies.camera.maxDistance,
        );
      }
    }
    this.updateControllerZoomCameraRotation(
      rightX,
      rightY,
      zoomModifierActive,
      deltaSeconds,
    );
    if (snapshot.pressed.cancel_or_context) {
      this.openContextActionsFromController();
    }

    if (this.dependencies.movementInput.isFpsMode()) {
      this.clearControllerMovePreview();
      const lookMagnitude = Math.hypot(rightX, rightY);
      if (lookMagnitude > this.controllerAxisDeadzone) {
        const lookDeltaX =
          rightX * this.controllerLookSpeedPxPerSec * deltaSeconds;
        const lookDeltaY =
          rightY * this.controllerLookSpeedPxPerSec * deltaSeconds;
        this.dependencies.camera.applyFpsLookDelta(
          lookDeltaX,
          lookDeltaY,
          this.dependencies.camera.firstPersonMouseSensitivity,
        );
      }

      if (
        snapshot.pressed.confirm &&
        this.dependencies.movementInput.shouldUseFpsSelfTileDirectionTarget()
      ) {
        this.dependencies.engineMessages.logClickLookTileDebug(
          "controller-confirm-player",
          this.dependencies.playerMovement.playerPos.x,
          this.dependencies.playerMovement.playerPos.y,
        );
        this.dependencies.inputCommands.sendMouseInput(
          this.dependencies.playerMovement.playerPos.x,
          this.dependencies.playerMovement.playerPos.y,
          0,
        );
        return;
      }

      const dpadPressed =
        snapshot.pressed.dpad_up ||
        snapshot.pressed.dpad_down ||
        snapshot.pressed.dpad_left ||
        snapshot.pressed.dpad_right;
      if (dpadPressed) {
        const dpadDirectionInput = this.resolveControllerFpsMovementFromAxes(
          dpadX,
          dpadY,
        );
        this.submitControllerDirectionalInput(
          dpadDirectionInput,
          runModifierActive,
        );
      }

      const leftDirectionInput = this.resolveControllerFpsMovementFromAxes(
        leftX,
        leftY,
      );
      if (leftDirectionInput) {
        const nowMs = Date.now();
        const repeatIntervalMs = Math.max(
          80,
          Math.round(
            this.dependencies.engineState.clientOptions
              .controllerFpsMoveRepeatMs,
          ),
        );
        if (
          this.controllerFpsLeftStickLastMoveInput !== leftDirectionInput ||
          nowMs >= this.controllerFpsLeftStickNextMoveAtMs
        ) {
          this.submitControllerDirectionalInput(
            leftDirectionInput,
            runModifierActive,
          );
          this.controllerFpsLeftStickNextMoveAtMs = nowMs + repeatIntervalMs;
        }
        this.controllerFpsLeftStickLastMoveInput = leftDirectionInput;
      } else {
        this.controllerFpsLeftStickLastMoveInput = null;
        this.controllerFpsLeftStickNextMoveAtMs = 0;
      }
      if (snapshot.pressed.search) {
        this.dependencies.inputCommands.sendInput("s");
      }
      return;
    }

    this.controllerFpsLeftStickLastMoveInput = null;
    this.controllerFpsLeftStickNextMoveAtMs = 0;

    const rightStickMagnitude = Math.hypot(rightX, rightY);
    if (
      !zoomModifierActive &&
      rightStickMagnitude > this.controllerAxisDeadzone
    ) {
      const panSpeed =
        this.controllerCameraPanTilesPerSec *
        (runModifierActive ? this.controllerCameraPanRunSpeedMultiplier : 1);
      this.dependencies.camera.panThirdPersonCameraByScreenDelta(
        rightX,
        rightY,
        panSpeed * deltaSeconds,
        -1,
      );
    }

    const dpadDirectionInput =
      this.resolveControllerGameplayDirectionInputFromAxes(
        dpadX,
        dpadY,
        this.controllerAxisDeadzone,
      );
    this.updateControllerDpadMovePreview(dpadDirectionInput, runModifierActive);

    const leftDirectionInput =
      this.resolveControllerGameplayDirectionInputFromAxes(
        zoomModifierActive ? 0 : leftX,
        zoomModifierActive ? 0 : leftY,
        this.controllerAxisDeadzone,
      );
    const previousLeftStickMovePreviewInput =
      this.controllerLeftStickMovePreviewInput;
    if (leftDirectionInput) {
      this.controllerLeftStickMovePreviewInput = leftDirectionInput;
      this.setControllerMovePreviewDirection(leftDirectionInput);
    }

    let confirmConsumedMovement = false;
    const confirmedLeftStickMoveInput =
      snapshot.pressed.confirm && !dpadDirectionInput
        ? (leftDirectionInput ?? previousLeftStickMovePreviewInput)
        : leftDirectionInput;
    if (snapshot.pressed.confirm && confirmedLeftStickMoveInput) {
      this.submitControllerDirectionalInput(
        confirmedLeftStickMoveInput,
        runModifierActive,
        { preferMouseMove: true },
      );
      confirmConsumedMovement = true;
      // Keep a held stick direction armed so the next move highlight can
      // advance immediately after the player position updates. Android WebView
      // can briefly report a centered axis on the same frame as A/RT.
      this.controllerLeftStickMovePreviewInput = confirmedLeftStickMoveInput;
      this.setControllerMovePreviewDirection(confirmedLeftStickMoveInput);
    }

    if (
      !leftDirectionInput &&
      !confirmConsumedMovement &&
      this.controllerLeftStickMovePreviewInput
    ) {
      this.controllerLeftStickMovePreviewInput = null;
      if (this.controllerDpadMovePreviewInput) {
        this.setControllerMovePreviewDirection(
          this.controllerDpadMovePreviewInput,
        );
      } else {
        this.controllerMoveHighlightTile = null;
      }
    }
    if (
      snapshot.pressed.confirm &&
      !confirmConsumedMovement &&
      !leftDirectionInput &&
      !this.controllerLeftStickMovePreviewInput
    ) {
      this.dependencies.engineMessages.logClickLookTileDebug(
        "controller-confirm-player",
        this.dependencies.playerMovement.playerPos.x,
        this.dependencies.playerMovement.playerPos.y,
      );
      this.dependencies.inputCommands.sendMouseInput(
        this.dependencies.playerMovement.playerPos.x,
        this.dependencies.playerMovement.playerPos.y,
        0,
      );
    }

    if (
      snapshot.pressed.search &&
      !confirmConsumedMovement &&
      !this.controllerLeftStickMovePreviewInput &&
      !this.controllerDpadMovePreviewInput
    ) {
      this.dependencies.inputCommands.sendInput("s");
    }
  }

  updateControllerInput(deltaSeconds: number, enabled = true): void {
    if (
      !enabled || this.dependencies.engineState.clientOptions.controllerEnabled !== true
    ) {
      this.controllerPreviousActionState =
        createControllerBooleanActionMap(false);
      this.dependencies.controllerDialogs.clearControllerDialogDpadRepeat();
      this.clearControllerDirectionPromptPreview();
      this.clearControllerMovePreview();
      this.dependencies.controllerDialogs.clearControllerDialogSliderInteraction();
      this.finishControllerZoomCameraRotation();
      this.controllerConfirmRearmPending = false;
      this.controllerCancelRearmPending = false;
      this.controllerFpsDirectionPromptUiUntilMs = 0;
      this.dependencies.controllerDialogs.resetControllerVirtualCursor();
      return;
    }
    const gamepads = this.getConnectedGamepads();
    const bindings = this.getControllerBindings();
    const rawSnapshot = this.sampleControllerActionSnapshot(bindings, gamepads);
    const cancelLatchedSnapshot =
      this.applyControllerCancelRearmLatch(rawSnapshot);
    const snapshot = this.applyControllerConfirmRearmLatch(
      cancelLatchedSnapshot,
    );
    const hadButtonPress = nh3dControllerActionIds.some(
      (actionId) => rawSnapshot.pressed[actionId],
    );
    if (hadButtonPress) {
      this.dependencies.audioHapticsPlatform.resumeFmodFromUserGesture();
    }

    if (this.isControllerGameplayInputContextActive()) {
      this.dependencies.controllerDialogs.clearControllerDialogDpadRepeat();
      this.dependencies.controllerDialogs.clearControllerDialogSliderInteraction();
      this.dependencies.controllerDialogs.resetControllerVirtualCursor();
      this.handleControllerGameplayInput(snapshot, deltaSeconds);
      return;
    }

    if (this.isControllerUiInputContextActive()) {
      this.finishControllerZoomCameraRotation();
      this.dependencies.controllerDialogs.handleControllerDialogInput(
        snapshot,
        deltaSeconds,
      );
      return;
    }

    this.dependencies.controllerDialogs.clearControllerDialogDpadRepeat();
    this.dependencies.controllerDialogs.clearControllerDialogSliderInteraction();
    this.clearControllerMovePreview();
    this.finishControllerZoomCameraRotation();
    this.dependencies.controllerDialogs.resetControllerVirtualCursor();
  }
}
