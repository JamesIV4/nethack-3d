import * as THREE from "three";
import DirectionPromptOverlay, { type DirectionPromptOverlayButtonId } from "../../DirectionPromptOverlay";
import type { AudioHapticsPlatform } from "../audio/audio-haptics-platform";
import type { Camera } from "../camera/camera";
import type { ControllerGameplay } from "../input/controller-gameplay";
import type { EngineState } from "../runtime/engine-state";
import type { ExtendedCommands } from "./extended-commands";
import type { InputCommands } from "../input/input-commands";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PointerLock } from "../input/pointer-lock";
import type { PointerTargeting } from "../input/pointer-targeting";
import type { PositionSelection } from "../input/position-selection";
import type { PromptDialogs } from "./prompt-dialogs";
import type { QuestionMenus } from "./question-menus";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { TerminalRendering } from "../rendering/terminal-rendering";
import type { TileContextActions } from "./tile-context-actions";
import type { TouchInput } from "../input/touch-input";

export interface DirectionPromptsDependencies {
  readonly audioHapticsPlatform: Pick<
    AudioHapticsPlatform,
    "clearPendingThrownWeaponDirectionSound"
  >;
  readonly camera: Pick<
    Camera,
    "getActiveCamera"
    | "recenterCameraOnPlayerIfNeeded"
  >;
  readonly controllerGameplay: Pick<
    ControllerGameplay,
    "clearControllerDirectionPromptPreview"
    | "controllerDirectionPromptPreviewInput"
    | "controllerDirectionPromptPreviewSource"
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
  readonly inputCommands: Pick<
    InputCommands,
    "sendInput"
    | "submitDirectionAnswer"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "clearFpsFireSuppression"
    | "getDirectionInputFromMapDelta"
    | "getDirectionVectorFromInput"
    | "getFpsDirectionQuestionInputFromAim"
    | "isFpsMode"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly pointerLock: Pick<
    PointerLock,
    "syncFpsPointerLockForUiState"
  >;
  readonly pointerTargeting: Pick<
    PointerTargeting,
    "getTilePositionFromClientCoordinates"
    | "pointerRaycaster"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "isInfoDialogOpen"
    | "isInventoryDialogOpen"
    | "isTextInputActive"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "isInQuestion"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "renderer"
  >;
  readonly terminalRendering: Pick<
    TerminalRendering,
    "isTerminalDisplayMode"
    | "terminalCellAspect"
  >;
  readonly tileContextActions: Pick<
    TileContextActions,
    "fpsCrosshairContextMenuOpen"
  >;
  readonly touchInput: Pick<
    TouchInput,
    "cancelMapTouchContextHoldState"
    | "fpsTouchTapMaxDurationMs"
    | "isTouchEventOnGameSurface"
    | "touchSwipeMaxDurationMs"
    | "touchSwipeMinDistancePx"
  >;
}

/** Direction prompt visibility, overlay interactions and pointer confirmation. */
export class DirectionPrompts {
  constructor(private readonly dependencies: DirectionPromptsDependencies) {}

  readonly directionPromptOverlayNdc = new THREE.Vector2();

  directionPromptOverlay: DirectionPromptOverlay | null = null;

  directionPromptHoveredButtonId: DirectionPromptOverlayButtonId | null =
    null;

  directionPromptPressedButtonId: DirectionPromptOverlayButtonId | null =
    null;

  directionPromptMouseDownActive: boolean = false;

  directionPromptTouchId: number | null = null;


  // Direction question handling
  isInDirectionQuestion: boolean = false;

  isSelfDirectionAnswerInput(input: string): boolean {
    const normalized = String(input || "").trim();
    if (!normalized) {
      return false;
    }
    if (normalized === "." || normalized === "5" || normalized === "Numpad5") {
      return true;
    }
    return normalized.toLowerCase() === "s";
  }

  showDirectionQuestion(question: string): void {
    this.dependencies.questionMenus.isInQuestion = false;
    this.isInDirectionQuestion = true;
    this.dependencies.touchInput.cancelMapTouchContextHoldState();
    if (!this.dependencies.movementInput.isFpsMode()) {
      this.dependencies.camera.recenterCameraOnPlayerIfNeeded();
    }
    this.dependencies.controllerGameplay.clearControllerDirectionPromptPreview();
    this.clearDirectionPromptOverlayInteraction();
    this.syncDirectionPromptOverlayVisibility();
    this.dependencies.pointerLock.syncFpsPointerLockForUiState(this.dependencies.movementInput.isFpsMode());
    this.dependencies.engineState.uiAdapter.setDirectionQuestion(question);
  }

  hideDirectionQuestion(): void {
    this.isInDirectionQuestion = false;
    this.dependencies.questionMenus.isInQuestion = false;
    this.dependencies.audioHapticsPlatform.clearPendingThrownWeaponDirectionSound();
    this.dependencies.controllerGameplay.clearControllerDirectionPromptPreview();
    this.clearDirectionPromptOverlayInteraction();
    this.syncDirectionPromptOverlayVisibility();
    this.dependencies.movementInput.clearFpsFireSuppression();
    this.dependencies.engineState.uiAdapter.setDirectionQuestion(null);
    this.dependencies.pointerLock.syncFpsPointerLockForUiState(true);
  }

  syncDirectionPromptOverlayVisibility(): void {
    this.directionPromptOverlay?.setWorldVerticalAspectScale(
      this.dependencies.terminalRendering.isTerminalDisplayMode() ? 1 / this.dependencies.terminalRendering.terminalCellAspect : 1,
    );
    this.directionPromptOverlay?.setDisplayMode(
      this.dependencies.movementInput.isFpsMode() ? "single_preview" : "full",
    );
    this.directionPromptOverlay?.setVisible(this.isInDirectionQuestion);
    this.updateDirectionPromptOverlayState();
  }

  getFpsDirectionPromptOverlayPreviewInput(): string | null {
    if (
      (this.dependencies.controllerGameplay.controllerDirectionPromptPreviewSource === "right_stick" ||
        this.dependencies.controllerGameplay.controllerDirectionPromptPreviewSource === "dpad") &&
      (this.dependencies.controllerGameplay.controllerDirectionPromptPreviewInput === "<" ||
        this.dependencies.controllerGameplay.controllerDirectionPromptPreviewInput === ">")
    ) {
      return this.dependencies.controllerGameplay.controllerDirectionPromptPreviewInput;
    }
    return this.dependencies.movementInput.getFpsDirectionQuestionInputFromAim();
  }

  getDirectionPromptOverlayPreviewInput(): string | null {
    if (!this.isInDirectionQuestion) {
      return null;
    }
    if (this.dependencies.movementInput.isFpsMode()) {
      return this.getFpsDirectionPromptOverlayPreviewInput();
    }
    return this.dependencies.controllerGameplay.controllerDirectionPromptPreviewInput;
  }

  resolveDirectionPromptOverlayButtonFromInput(
    input: string | null | undefined,
  ): DirectionPromptOverlayButtonId | null {
    const normalized = String(input ?? "").trim();
    if (!normalized) {
      return null;
    }
    if (normalized === "s" || normalized === "S") {
      return "self";
    }
    if (normalized === "<" || normalized === ",") {
      return "up";
    }
    if (normalized === ">") {
      return "down";
    }

    const direction = this.dependencies.movementInput.getDirectionVectorFromInput(normalized);
    if (!direction) {
      return null;
    }
    if (direction.dx === -1 && direction.dy === -1) {
      return "northwest";
    }
    if (direction.dx === 0 && direction.dy === -1) {
      return "north";
    }
    if (direction.dx === 1 && direction.dy === -1) {
      return "northeast";
    }
    if (direction.dx === -1 && direction.dy === 0) {
      return "west";
    }
    if (direction.dx === 1 && direction.dy === 0) {
      return "east";
    }
    if (direction.dx === -1 && direction.dy === 1) {
      return "southwest";
    }
    if (direction.dx === 0 && direction.dy === 1) {
      return "south";
    }
    if (direction.dx === 1 && direction.dy === 1) {
      return "southeast";
    }
    return null;
  }

  resolveDirectionPromptInputFromOverlayButton(
    buttonId: DirectionPromptOverlayButtonId,
  ): string | null {
    switch (buttonId) {
      case "northwest":
        return this.dependencies.movementInput.getDirectionInputFromMapDelta(-1, -1);
      case "north":
        return this.dependencies.movementInput.getDirectionInputFromMapDelta(0, -1);
      case "northeast":
        return this.dependencies.movementInput.getDirectionInputFromMapDelta(1, -1);
      case "west":
        return this.dependencies.movementInput.getDirectionInputFromMapDelta(-1, 0);
      case "self":
        return "s";
      case "east":
        return this.dependencies.movementInput.getDirectionInputFromMapDelta(1, 0);
      case "southwest":
        return this.dependencies.movementInput.getDirectionInputFromMapDelta(-1, 1);
      case "south":
        return this.dependencies.movementInput.getDirectionInputFromMapDelta(0, 1);
      case "southeast":
        return this.dependencies.movementInput.getDirectionInputFromMapDelta(1, 1);
      case "up":
        return "<";
      case "down":
        return ">";
      default:
        return null;
    }
  }

  getDirectionPromptOverlayButtonFromTileDelta(
    dx: number,
    dy: number,
  ): DirectionPromptOverlayButtonId | null {
    if (dx === -1 && dy === -1) {
      return "northwest";
    }
    if (dx === 0 && dy === -1) {
      return "north";
    }
    if (dx === 1 && dy === -1) {
      return "northeast";
    }
    if (dx === -1 && dy === 0) {
      return "west";
    }
    if (dx === 0 && dy === 0) {
      return "self";
    }
    if (dx === 1 && dy === 0) {
      return "east";
    }
    if (dx === -1 && dy === 1) {
      return "southwest";
    }
    if (dx === 0 && dy === 1) {
      return "south";
    }
    if (dx === 1 && dy === 1) {
      return "southeast";
    }
    return null;
  }

  getDirectionPromptOverlayTileAssociatedButtonFromClientCoordinates(
    clientX: number,
    clientY: number,
  ): DirectionPromptOverlayButtonId | null {
    const target = this.dependencies.pointerTargeting.getTilePositionFromClientCoordinates(clientX, clientY);
    if (!target) {
      return null;
    }
    return this.getDirectionPromptOverlayButtonFromTileDelta(
      target.x - this.dependencies.playerMovement.playerPos.x,
      target.y - this.dependencies.playerMovement.playerPos.y,
    );
  }

  updateDirectionPromptOverlayState(): void {
    this.directionPromptOverlay?.setInteractionState({
      hoveredButtonId: this.directionPromptHoveredButtonId,
      pressedButtonId: this.directionPromptPressedButtonId,
      previewedButtonId: this.resolveDirectionPromptOverlayButtonFromInput(
        this.getDirectionPromptOverlayPreviewInput(),
      ),
    });
  }

  clearDirectionPromptOverlayInteraction(): void {
    this.directionPromptHoveredButtonId = null;
    this.directionPromptPressedButtonId = null;
    this.directionPromptMouseDownActive = false;
    this.directionPromptTouchId = null;
    this.updateDirectionPromptOverlayState();
  }

  isNormalDirectionPromptOverlayActive(): boolean {
    return Boolean(
      this.dependencies.engineState.session && this.isInDirectionQuestion && !this.dependencies.movementInput.isFpsMode(),
    );
  }

  canUseNormalDirectionPromptOverlayMouseInput(
    event: MouseEvent,
  ): boolean {
    if (!this.isNormalDirectionPromptOverlayActive()) {
      return false;
    }
    if (event.target !== this.dependencies.renderPipeline.renderer.domElement) {
      return false;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    if (
      this.dependencies.promptDialogs.isTextInputActive ||
      this.dependencies.positionSelection.positionInputModeActive ||
      this.dependencies.extendedCommands.metaCommandModeActive ||
      this.dependencies.promptDialogs.isInventoryDialogOpen() ||
      this.dependencies.promptDialogs.isInfoDialogOpen()
    ) {
      return false;
    }
    return true;
  }

  canUseNormalDirectionPromptOverlayTouchInput(
    event: TouchEvent,
  ): boolean {
    if (!this.isNormalDirectionPromptOverlayActive()) {
      return false;
    }
    if (!this.dependencies.touchInput.isTouchEventOnGameSurface(event)) {
      return false;
    }
    if (
      this.dependencies.promptDialogs.isTextInputActive ||
      this.dependencies.positionSelection.positionInputModeActive ||
      this.dependencies.extendedCommands.metaCommandModeActive ||
      this.dependencies.promptDialogs.isInventoryDialogOpen() ||
      this.dependencies.promptDialogs.isInfoDialogOpen()
    ) {
      return false;
    }
    return true;
  }

  getDirectionPromptOverlayButtonFromClientCoordinates(
    clientX: number,
    clientY: number,
  ): DirectionPromptOverlayButtonId | null {
    if (!this.directionPromptOverlay) {
      return null;
    }
    const canvas = this.dependencies.renderPipeline.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    this.directionPromptOverlayNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const directButtonId = this.directionPromptOverlay.hitTest(
      this.directionPromptOverlayNdc.x,
      this.directionPromptOverlayNdc.y,
      this.dependencies.camera.getActiveCamera(),
      this.dependencies.pointerTargeting.pointerRaycaster,
    );
    if (directButtonId) {
      return directButtonId;
    }

    return this.getDirectionPromptOverlayTileAssociatedButtonFromClientCoordinates(
      clientX,
      clientY,
    );
  }

  setHoveredDirectionPromptOverlayButton(
    buttonId: DirectionPromptOverlayButtonId | null,
  ): void {
    if (this.directionPromptHoveredButtonId === buttonId) {
      return;
    }
    this.directionPromptHoveredButtonId = buttonId;
    this.updateDirectionPromptOverlayState();
  }

  confirmDirectionPromptOverlayButton(
    buttonId: DirectionPromptOverlayButtonId | null,
  ): boolean {
    if (!buttonId || !this.isInDirectionQuestion) {
      return false;
    }
    const input = this.resolveDirectionPromptInputFromOverlayButton(buttonId);
    if (!input) {
      return false;
    }
    this.dependencies.inputCommands.submitDirectionAnswer(input);
    return true;
  }

  cancelDirectionPromptOverlaySelection(): void {
    if (!this.isInDirectionQuestion) {
      return;
    }
    this.dependencies.inputCommands.sendInput("Escape");
    this.hideDirectionQuestion();
  }

  canUseFpsDirectionPromptMouseInput(event: MouseEvent): boolean {
    if (!this.dependencies.engineState.session || !this.dependencies.movementInput.isFpsMode() || !this.isInDirectionQuestion) {
      return false;
    }
    if (event.target !== this.dependencies.renderPipeline.renderer.domElement) {
      return false;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    if (
      this.dependencies.promptDialogs.isTextInputActive ||
      this.dependencies.positionSelection.positionInputModeActive ||
      this.dependencies.extendedCommands.metaCommandModeActive ||
      this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen ||
      this.dependencies.promptDialogs.isInventoryDialogOpen() ||
      this.dependencies.promptDialogs.isInfoDialogOpen()
    ) {
      return false;
    }
    return true;
  }

  canUseFpsDirectionPromptTouchInput(event: TouchEvent): boolean {
    if (!this.dependencies.engineState.session || !this.dependencies.movementInput.isFpsMode() || !this.isInDirectionQuestion) {
      return false;
    }
    if (!this.dependencies.touchInput.isTouchEventOnGameSurface(event)) {
      return false;
    }
    if (
      this.dependencies.promptDialogs.isTextInputActive ||
      this.dependencies.positionSelection.positionInputModeActive ||
      this.dependencies.extendedCommands.metaCommandModeActive ||
      this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen ||
      this.dependencies.promptDialogs.isInventoryDialogOpen() ||
      this.dependencies.promptDialogs.isInfoDialogOpen()
    ) {
      return false;
    }
    return true;
  }

  resolveFpsDirectionTouchSwipeAction(
    dx: number,
    dy: number,
    durationMs: number,
  ): "confirm" | "self" | "cancel" | null {
    const distance = Math.hypot(dx, dy);
    if (distance < this.dependencies.touchInput.touchSwipeMinDistancePx) {
      if (durationMs <= this.dependencies.touchInput.fpsTouchTapMaxDurationMs) {
        return "confirm";
      }
      return null;
    }
    if (durationMs > this.dependencies.touchInput.touchSwipeMaxDurationMs) {
      return null;
    }

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const axisBiasRatio = 0.62;

    if (absX <= absY * axisBiasRatio) {
      return dy < 0 ? "confirm" : "self";
    }
    if (absY <= absX * axisBiasRatio) {
      return "cancel";
    }
    return absY >= absX ? (dy < 0 ? "confirm" : "self") : "cancel";
  }

  confirmFpsDirectionQuestionFromAim(): boolean {
    const lookDirectionInput = this.dependencies.movementInput.getFpsDirectionQuestionInputFromAim();
    if (!lookDirectionInput) {
      return false;
    }
    this.dependencies.inputCommands.submitDirectionAnswer(lookDirectionInput);
    return true;
  }

  applyFpsDirectionTouchAction(
    action: "confirm" | "self" | "cancel",
  ): boolean {
    if (!this.isInDirectionQuestion) {
      return false;
    }

    if (action === "confirm") {
      return this.confirmFpsDirectionQuestionFromAim();
    }

    if (action === "self") {
      this.dependencies.inputCommands.submitDirectionAnswer("s");
      return true;
    }

    this.dependencies.inputCommands.sendInput("Escape");
    this.hideDirectionQuestion();
    return true;
  }
}
