import * as THREE from "three";
import type { TileContextTouchHoldState, FpsTouchGestureState } from "../shared/types";
import type { AudioHapticsPlatform } from "../audio/audio-haptics-platform";
import type { Camera } from "../camera/camera";
import type { CombatAttribution } from "../world/combat-attribution";
import type { DirectionPrompts } from "../ui/direction-prompts";
import type { EngineMessages } from "../ui/engine-messages";
import type { EngineState } from "../runtime/engine-state";
import type { ExtendedCommands } from "../ui/extended-commands";
import type { GameOver } from "../ui/game-over";
import type { InputCommands } from "./input-commands";
import type { MovementInput } from "./movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PointerTargeting } from "./pointer-targeting";
import type { PositionSelection } from "./position-selection";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { QuestionMenus } from "../ui/question-menus";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { TerminalRendering } from "../rendering/terminal-rendering";
import type { TileContextActions } from "../ui/tile-context-actions";
import type { TileRendering } from "../rendering/tile-rendering";

export interface TouchInputDependencies {
  readonly audioHapticsPlatform: Pick<
    AudioHapticsPlatform,
    "resumeFmodFromUserGesture"
  >;
  readonly camera: Pick<
    Camera,
    "applyFpsLookDelta"
    | "cameraDistance"
    | "isCameraCenteredOnPlayer"
    | "maxDistance"
    | "minDistance"
    | "panThirdPersonCameraByScreenDelta"
    | "terminalMaxCameraDistance"
  >;
  readonly combatAttribution: Pick<
    CombatAttribution,
    "pendingPointerAttackTargetContext"
    | "setPendingPointerAttackTargetFromTile"
    | "updateDirectionalAttackContextFromTarget"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "applyFpsDirectionTouchAction"
    | "canUseFpsDirectionPromptTouchInput"
    | "canUseNormalDirectionPromptOverlayTouchInput"
    | "cancelDirectionPromptOverlaySelection"
    | "clearDirectionPromptOverlayInteraction"
    | "confirmDirectionPromptOverlayButton"
    | "confirmFpsDirectionQuestionFromAim"
    | "directionPromptPressedButtonId"
    | "directionPromptTouchId"
    | "getDirectionPromptOverlayButtonFromClientCoordinates"
    | "isInDirectionQuestion"
    | "resolveFpsDirectionTouchSwipeAction"
    | "setHoveredDirectionPromptOverlayButton"
    | "updateDirectionPromptOverlayState"
  >;
  readonly engineMessages: Pick<
    EngineMessages,
    "logClickLookTileDebug"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
    | "mountElement"
    | "session"
  >;
  readonly extendedCommands: Pick<
    ExtendedCommands,
    "metaCommandModeActive"
  >;
  readonly gameOver: Pick<
    GameOver,
    "releaseDeferredGameOverUiReveal"
  >;
  readonly inputCommands: Pick<
    InputCommands,
    "executeQuickAction"
    | "onSwipeCommandExecuted"
    | "sendForcedDirectionalInput"
    | "sendInput"
    | "sendMouseInput"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
    | "lastMovementInputAtMs"
    | "resolveDirectionFromDelta"
    | "resolveSwipeDirectionInput"
    | "tryResolveFpsMovementInput"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "hasPlayerMovedOnce"
    | "playerPos"
  >;
  readonly pointerTargeting: Pick<
    PointerTargeting,
    "getGridPositionFromClientCoordinates"
    | "resolvePointerTargetTileFromClientCoordinates"
    | "shouldSearchAdjacentTerminalVoid"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "handleFarLookPositionPointerSelection"
    | "isFarLookPositionInputMode"
    | "positionCursor"
    | "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "isAnyModalVisible"
    | "isInfoDialogOpen"
    | "isInventoryDialogOpen"
    | "isTextInputActive"
    | "isUiInputBlocked"
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
  >;
  readonly tileContextActions: Pick<
    TileContextActions,
    "closeFpsCrosshairContextMenu"
    | "fpsCrosshairContextMenuOpen"
    | "openFpsCrosshairContextMenu"
    | "openNormalTileContextMenuAtTarget"
    | "shouldConsumeSuppressedMapPrimaryPointerEvent"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
}

/** Touch gesture state, long-press context actions, swipe movement, pinch and run button interactions. */
export class TouchInput {
  constructor(private readonly dependencies: TouchInputDependencies) {}

  touchSwipeStart: {
    touchId: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    startedAtMs: number;
    panningActive: boolean;
  } | null = null;

  pinchZoomStart: { distance: number; cameraDistance: number } | null =
    null;

  fpsTouchMoveGesture: FpsTouchGestureState | null = null;

  fpsTouchLookGesture: FpsTouchGestureState | null = null;

  fpsTouchRunButton: HTMLDivElement | null = null;

  fpsTouchRunButtonTouchId: number | null = null;

  fpsTouchRunButtonCenterX: number = 0;

  fpsTouchRunButtonCenterY: number = 0;

  fpsTouchRunButtonActive: boolean = false;

  fpsTouchRunButtonHoldTimerId: number | null = null;

  readonly fpsTouchLookSensitivity: number = 0.0038;

  readonly fpsTouchLookMoveThresholdPx: number = 8;

  readonly fpsTouchTapMaxDurationMs: number = 280;

  readonly touchSwipeMinDistancePx: number = 26;

  readonly touchSwipeMaxDurationMs: number = 720;

  readonly touchSwipePanHoldMs: number = 500;

  mapTouchContextHoldTimerId: number | null = null;

  mapTouchContextHoldState: TileContextTouchHoldState | null = null;

  readonly mapTouchContextHoldMs: number = 500;

  readonly mapTouchContextHoldDeadzonePx: number = 15;

  readonly fpsTouchRunButtonHoldMs: number = 500;

  readonly fpsTouchRunButtonOffsetYPx: number = 170;

  readonly fpsTouchRunButtonLandscapeOffsetYPx: number = 140;

  readonly fpsTouchRunButtonSizePx: number = 82;

  isTouchEventOnGameSurface(event: TouchEvent): boolean {
    if (event.target === this.dependencies.renderPipeline.renderer.domElement) {
      return true;
    }
    // The renderer can leave a small amount of its full-screen host exposed,
    // especially in Terminal mode. Treat that backdrop as map input without
    // accepting touches from controls or other child overlays in the host.
    if (this.dependencies.engineState.mountElement && event.target === this.dependencies.engineState.mountElement) {
      return true;
    }
    if (typeof event.composedPath === "function") {
      return event.composedPath().includes(this.dependencies.renderPipeline.renderer.domElement);
    }
    return false;
  }

  canUseMapTouchInput(event: TouchEvent): boolean {
    if (!this.dependencies.engineState.session) {
      return false;
    }
    if (!this.isTouchEventOnGameSurface(event)) {
      return false;
    }
    if (this.dependencies.promptDialogs.isAnyModalVisible()) {
      return false;
    }
    if (this.dependencies.questionMenus.isInQuestion || this.dependencies.directionPrompts.isInDirectionQuestion) {
      return false;
    }
    if (this.dependencies.extendedCommands.metaCommandModeActive || this.dependencies.positionSelection.positionInputModeActive) {
      return false;
    }
    if (this.dependencies.movementInput.isFpsMode()) {
      return false;
    }
    return true;
  }

  canUseOverheadPositionInputTouchInput(event: TouchEvent): boolean {
    if (!this.dependencies.engineState.session || this.dependencies.movementInput.isFpsMode() || !this.dependencies.positionSelection.positionInputModeActive) {
      return false;
    }
    if (!this.isTouchEventOnGameSurface(event)) {
      return false;
    }
    if (this.dependencies.promptDialogs.isAnyModalVisible()) {
      return false;
    }
    if (
      this.dependencies.questionMenus.isInQuestion ||
      this.dependencies.directionPrompts.isInDirectionQuestion ||
      this.dependencies.extendedCommands.metaCommandModeActive ||
      this.dependencies.promptDialogs.isTextInputActive ||
      this.dependencies.promptDialogs.isInventoryDialogOpen() ||
      this.dependencies.promptDialogs.isInfoDialogOpen()
    ) {
      return false;
    }
    return true;
  }

  canUseFpsTouchInput(event: TouchEvent): boolean {
    if (!this.dependencies.engineState.session || !this.dependencies.movementInput.isFpsMode()) {
      return false;
    }
    if (!this.isTouchEventOnGameSurface(event)) {
      return false;
    }
    if (this.dependencies.promptDialogs.isAnyModalVisible()) {
      return false;
    }
    if (
      this.dependencies.questionMenus.isInQuestion ||
      this.dependencies.directionPrompts.isInDirectionQuestion ||
      this.dependencies.extendedCommands.metaCommandModeActive ||
      this.dependencies.positionSelection.positionInputModeActive
    ) {
      return false;
    }
    return true;
  }

  canUseFpsPositionInputTouchInput(event: TouchEvent): boolean {
    if (!this.dependencies.engineState.session || !this.dependencies.movementInput.isFpsMode() || !this.dependencies.positionSelection.positionInputModeActive) {
      return false;
    }
    if (!this.isTouchEventOnGameSurface(event)) {
      return false;
    }
    if (this.dependencies.promptDialogs.isAnyModalVisible()) {
      return false;
    }
    if (
      this.dependencies.questionMenus.isInQuestion ||
      this.dependencies.directionPrompts.isInDirectionQuestion ||
      this.dependencies.extendedCommands.metaCommandModeActive ||
      this.dependencies.promptDialogs.isTextInputActive ||
      this.dependencies.promptDialogs.isInventoryDialogOpen() ||
      this.dependencies.promptDialogs.isInfoDialogOpen()
    ) {
      return false;
    }
    return true;
  }

  clearFpsTouchGestures(): void {
    this.fpsTouchMoveGesture = null;
    this.fpsTouchLookGesture = null;
    this.clearFpsTouchRunButtonHoldTimer();
    this.clearFpsTouchRunButtonState();
  }

  sendMapTouchPrimaryClickInput(
    clientX: number,
    clientY: number,
  ): boolean {
    const target = this.dependencies.pointerTargeting.resolvePointerTargetTileFromClientCoordinates(
      clientX,
      clientY,
    );
    if (!target) {
      this.dependencies.combatAttribution.pendingPointerAttackTargetContext = null;
      const gridTarget = this.dependencies.pointerTargeting.getGridPositionFromClientCoordinates(
        clientX,
        clientY,
      );
      if (!gridTarget) {
        return false;
      }
      if (this.dependencies.pointerTargeting.shouldSearchAdjacentTerminalVoid(gridTarget)) {
        this.dependencies.inputCommands.onSwipeCommandExecuted();
        this.dependencies.inputCommands.executeQuickAction("search", true);
        return true;
      }
      const dx = gridTarget.x - this.dependencies.playerMovement.playerPos.x;
      const dy = gridTarget.y - this.dependencies.playerMovement.playerPos.y;
      const direction = this.dependencies.movementInput.resolveDirectionFromDelta(dx, dy);
      if (!direction) {
        return false;
      }
      this.dependencies.inputCommands.onSwipeCommandExecuted();
      this.dependencies.inputCommands.sendForcedDirectionalInput(direction);
      return true;
    }

    if (!this.dependencies.playerMovement.hasPlayerMovedOnce) {
      this.dependencies.movementInput.lastMovementInputAtMs = Date.now();
    }
    this.dependencies.combatAttribution.updateDirectionalAttackContextFromTarget(target.x, target.y);
    this.dependencies.combatAttribution.setPendingPointerAttackTargetFromTile(target.x, target.y);
    this.dependencies.inputCommands.onSwipeCommandExecuted();
    this.dependencies.engineMessages.logClickLookTileDebug("touch-primary", target.x, target.y);
    this.dependencies.inputCommands.sendMouseInput(target.x, target.y, 0);
    return true;
  }

  clearMapTouchContextHoldTimer(): void {
    if (
      this.mapTouchContextHoldTimerId !== null &&
      typeof window !== "undefined"
    ) {
      window.clearTimeout(this.mapTouchContextHoldTimerId);
    }
    this.mapTouchContextHoldTimerId = null;
  }

  cancelMapTouchContextHoldState(): void {
    this.clearMapTouchContextHoldTimer();
    this.mapTouchContextHoldState = null;
  }

  scheduleMapTouchContextHold(
    touchId: number,
    startX: number,
    startY: number,
  ): void {
    this.cancelMapTouchContextHoldState();
    this.mapTouchContextHoldState = {
      touchId,
      startX,
      startY,
      opened: false,
    };
    if (typeof window === "undefined") {
      return;
    }
    this.mapTouchContextHoldTimerId = window.setTimeout(() => {
      this.mapTouchContextHoldTimerId = null;
      const hold = this.mapTouchContextHoldState;
      if (!hold || hold.touchId !== touchId || hold.opened) {
        return;
      }
      if (
        this.dependencies.movementInput.isFpsMode() ||
        !this.dependencies.engineState.session ||
        this.dependencies.promptDialogs.isAnyModalVisible() ||
        this.dependencies.questionMenus.isInQuestion ||
        this.dependencies.directionPrompts.isInDirectionQuestion ||
        this.dependencies.extendedCommands.metaCommandModeActive ||
        this.dependencies.positionSelection.positionInputModeActive
      ) {
        return;
      }
      const target = this.dependencies.pointerTargeting.resolvePointerTargetTileFromClientCoordinates(
        hold.startX,
        hold.startY,
      );
      if (!target) {
        return;
      }
      const key = `${target.x},${target.y}`;
      const mesh = this.dependencies.tileRendering.tileMap.get(key);
      if (!mesh) {
        return;
      }
      this.dependencies.tileContextActions.openNormalTileContextMenuAtTarget({
        key,
        x: target.x,
        y: target.y,
        mesh,
      });
      hold.opened = true;
    }, this.mapTouchContextHoldMs);
  }

  clearFpsTouchRunButtonHoldTimer(): void {
    if (
      this.fpsTouchRunButtonHoldTimerId !== null &&
      typeof window !== "undefined"
    ) {
      window.clearTimeout(this.fpsTouchRunButtonHoldTimerId);
    }
    this.fpsTouchRunButtonHoldTimerId = null;
  }

  ensureFpsTouchRunButton(): HTMLDivElement {
    if (this.fpsTouchRunButton) {
      return this.fpsTouchRunButton;
    }
    const button = document.createElement("div");
    button.textContent = "Run";
    button.setAttribute("aria-hidden", "true");
    button.className = "nh3d-fps-touch-run-button";
    button.style.left = "0px";
    button.style.top = "0px";
    button.style.width = `${this.fpsTouchRunButtonSizePx}px`;
    button.style.height = `${this.fpsTouchRunButtonSizePx}px`;
    const host = this.dependencies.engineState.mountElement ?? document.body;
    host.appendChild(button);
    this.fpsTouchRunButton = button;
    return button;
  }

  clearFpsTouchRunButtonState(): void {
    this.fpsTouchRunButtonTouchId = null;
    this.fpsTouchRunButtonActive = false;
    this.fpsTouchRunButtonCenterX = 0;
    this.fpsTouchRunButtonCenterY = 0;
    if (this.fpsTouchRunButton) {
      this.fpsTouchRunButton.classList.remove("is-visible", "is-active");
    }
  }

  scheduleFpsTouchRunButtonHold(gesture: FpsTouchGestureState): void {
    this.clearFpsTouchRunButtonHoldTimer();
    if (typeof window === "undefined") {
      return;
    }
    this.fpsTouchRunButtonHoldTimerId = window.setTimeout(() => {
      this.fpsTouchRunButtonHoldTimerId = null;
      const activeGesture = this.fpsTouchMoveGesture;
      if (!activeGesture || activeGesture.touchId !== gesture.touchId) {
        return;
      }
      if (this.fpsTouchRunButtonTouchId !== null) {
        return;
      }
      this.showFpsTouchRunButtonForGesture(activeGesture);
      this.setFpsTouchRunButtonActive(
        this.isTouchOverFpsRunButton(activeGesture.lastX, activeGesture.lastY),
      );
    }, this.fpsTouchRunButtonHoldMs);
  }

  showFpsTouchRunButtonForGesture(gesture: FpsTouchGestureState): void {
    const button = this.ensureFpsTouchRunButton();
    const hostRect = this.dependencies.engineState.mountElement?.getBoundingClientRect();
    const hostLeft = hostRect?.left ?? 0;
    const hostTop = hostRect?.top ?? 0;
    const hostWidth = hostRect?.width ?? window.innerWidth;
    const hostHeight = hostRect?.height ?? window.innerHeight;
    const hostRight = hostLeft + hostWidth;
    const hostBottom = hostTop + hostHeight;
    const half = this.fpsTouchRunButtonSizePx / 2;
    const margin = 8;
    const minX = hostLeft + half + margin;
    const minY = hostTop + half + margin;
    const maxX = Math.max(minX, hostRight - half - margin);
    const maxY = Math.max(minY, hostBottom - half - margin);
    const centerX = THREE.MathUtils.clamp(gesture.startX, minX, maxX);
    const offsetY = this.resolveFpsTouchRunButtonOffsetY();
    const centerY = THREE.MathUtils.clamp(gesture.startY - offsetY, minY, maxY);
    this.fpsTouchRunButtonTouchId = gesture.touchId;
    this.fpsTouchRunButtonCenterX = centerX;
    this.fpsTouchRunButtonCenterY = centerY;
    this.fpsTouchRunButtonActive = false;
    button.style.left = `${centerX - hostLeft}px`;
    button.style.top = `${centerY - hostTop}px`;
    button.classList.add("is-visible");
    button.classList.remove("is-active");
  }

  resolveFpsTouchRunButtonOffsetY(): number {
    if (typeof window === "undefined") {
      return this.fpsTouchRunButtonOffsetYPx;
    }
    return window.innerWidth > window.innerHeight
      ? this.fpsTouchRunButtonLandscapeOffsetYPx
      : this.fpsTouchRunButtonOffsetYPx;
  }

  isTouchOverFpsRunButton(clientX: number, clientY: number): boolean {
    if (this.fpsTouchRunButtonTouchId === null) {
      return false;
    }
    const half = this.fpsTouchRunButtonSizePx / 2;
    return (
      clientX >= this.fpsTouchRunButtonCenterX - half &&
      clientX <= this.fpsTouchRunButtonCenterX + half &&
      clientY >= this.fpsTouchRunButtonCenterY - half &&
      clientY <= this.fpsTouchRunButtonCenterY + half
    );
  }

  setFpsTouchRunButtonActive(active: boolean): void {
    if (this.fpsTouchRunButtonActive === active) {
      return;
    }
    this.fpsTouchRunButtonActive = active;
    const button = this.fpsTouchRunButton;
    if (!button || !button.classList.contains("is-visible")) {
      return;
    }
    button.classList.toggle("is-active", active);
  }

  updateFpsTouchRunButtonForMoveGesture(
    gesture: FpsTouchGestureState,
    touch: Touch,
    nowMs: number,
  ): void {
    const matchingTouch =
      this.fpsTouchRunButtonTouchId !== null
        ? this.fpsTouchRunButtonTouchId === gesture.touchId
        : true;
    if (!matchingTouch) {
      return;
    }
    if (this.fpsTouchRunButtonTouchId === null) {
      const heldMs = nowMs - gesture.startedAtMs;
      if (heldMs < this.fpsTouchRunButtonHoldMs) {
        return;
      }
      this.showFpsTouchRunButtonForGesture(gesture);
    }
    if (this.fpsTouchRunButtonTouchId !== gesture.touchId) {
      return;
    }
    this.setFpsTouchRunButtonActive(
      this.isTouchOverFpsRunButton(touch.clientX, touch.clientY),
    );
  }

  findTouchById(list: TouchList, touchId: number): Touch | null {
    for (let i = 0; i < list.length; i += 1) {
      const touch = list.item(i);
      if (touch && touch.identifier === touchId) {
        return touch;
      }
    }
    return null;
  }

  resolveFpsMovementInputFromSwipe(
    dx: number,
    dy: number,
  ): string | null {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (
      absX < this.touchSwipeMinDistancePx &&
      absY < this.touchSwipeMinDistancePx
    ) {
      return null;
    }

    const axisBiasRatio = 0.62;
    let key: string;
    if (absX <= absY * axisBiasRatio) {
      key = dy < 0 ? "w" : "s";
    } else if (absY <= absX * axisBiasRatio) {
      key = dx < 0 ? "a" : "d";
    } else {
      key = absY >= absX ? (dy < 0 ? "w" : "s") : dx < 0 ? "a" : "d";
    }
    return this.dependencies.movementInput.tryResolveFpsMovementInput(key);
  }

  handleTouchStart(event: TouchEvent): void {
    if (this.dependencies.promptDialogs.isUiInputBlocked()) {
      event.preventDefault();
      return;
    }
    this.dependencies.audioHapticsPlatform.resumeFmodFromUserGesture();

    if (
      !this.dependencies.movementInput.isFpsMode() &&
      this.dependencies.tileContextActions.shouldConsumeSuppressedMapPrimaryPointerEvent(
        this.isTouchEventOnGameSurface(event),
      )
    ) {
      this.touchSwipeStart = null;
      this.pinchZoomStart = null;
      this.cancelMapTouchContextHoldState();
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (!this.dependencies.movementInput.isFpsMode() && this.dependencies.directionPrompts.isInDirectionQuestion) {
      if (!this.dependencies.directionPrompts.canUseNormalDirectionPromptOverlayTouchInput(event)) {
        this.dependencies.directionPrompts.clearDirectionPromptOverlayInteraction();
        return;
      }
      if (event.touches.length !== 1 || event.changedTouches.length < 1) {
        this.dependencies.directionPrompts.clearDirectionPromptOverlayInteraction();
        if (event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      const touch = event.changedTouches[0];
      const buttonId =
        this.dependencies.directionPrompts.getDirectionPromptOverlayButtonFromClientCoordinates(
          touch.clientX,
          touch.clientY,
        );
      this.dependencies.directionPrompts.directionPromptTouchId = touch.identifier;
      this.dependencies.directionPrompts.directionPromptPressedButtonId = buttonId;
      this.dependencies.directionPrompts.setHoveredDirectionPromptOverlayButton(buttonId);
      this.dependencies.directionPrompts.updateDirectionPromptOverlayState();
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (this.canUseOverheadPositionInputTouchInput(event)) {
      this.pinchZoomStart = null;
      this.cancelMapTouchContextHoldState();
      if (event.touches.length !== 1) {
        this.touchSwipeStart = null;
        if (event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      const touch = event.touches[0];
      this.touchSwipeStart = {
        touchId: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        startedAtMs: Date.now(),
        panningActive: false,
      };
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (this.dependencies.movementInput.isFpsMode()) {
      this.cancelMapTouchContextHoldState();
      if (this.dependencies.directionPrompts.isInDirectionQuestion) {
        if (!this.dependencies.directionPrompts.canUseFpsDirectionPromptTouchInput(event)) {
          this.clearFpsTouchGestures();
          return;
        }
        this.clearFpsTouchRunButtonHoldTimer();
        this.clearFpsTouchRunButtonState();

        const rect = this.dependencies.renderPipeline.renderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          this.clearFpsTouchGestures();
          return;
        }
        const splitX = rect.left + rect.width * 0.5;

        if (this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen) {
          this.dependencies.tileContextActions.closeFpsCrosshairContextMenu(false);
        }

        for (let i = 0; i < event.changedTouches.length; i += 1) {
          const touch = event.changedTouches.item(i);
          if (!touch) {
            continue;
          }
          const gesture: FpsTouchGestureState = {
            touchId: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastY: touch.clientY,
            startedAtMs: Date.now(),
          };
          if (touch.clientX < splitX) {
            if (!this.fpsTouchMoveGesture) {
              this.fpsTouchMoveGesture = gesture;
            }
          } else if (!this.fpsTouchLookGesture) {
            this.fpsTouchLookGesture = gesture;
          }
        }

        if (event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      if (this.canUseFpsPositionInputTouchInput(event)) {
        this.clearFpsTouchRunButtonHoldTimer();
        this.clearFpsTouchRunButtonState();

        const rect = this.dependencies.renderPipeline.renderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          this.clearFpsTouchGestures();
          return;
        }
        const splitX = rect.left + rect.width * 0.5;

        for (let i = 0; i < event.changedTouches.length; i += 1) {
          const touch = event.changedTouches.item(i);
          if (!touch) {
            continue;
          }
          const gesture: FpsTouchGestureState = {
            touchId: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastY: touch.clientY,
            startedAtMs: Date.now(),
          };
          if (touch.clientX < splitX) {
            if (!this.fpsTouchMoveGesture) {
              this.fpsTouchMoveGesture = gesture;
            }
          } else if (!this.fpsTouchLookGesture) {
            this.fpsTouchLookGesture = gesture;
          }
        }

        if (event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      if (!this.canUseFpsTouchInput(event)) {
        this.clearFpsTouchGestures();
        return;
      }

      const rect = this.dependencies.renderPipeline.renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        this.clearFpsTouchGestures();
        return;
      }
      const splitX = rect.left + rect.width * 0.5;

      for (let i = 0; i < event.changedTouches.length; i += 1) {
        const touch = event.changedTouches.item(i);
        if (!touch) {
          continue;
        }
        const gesture: FpsTouchGestureState = {
          touchId: touch.identifier,
          startX: touch.clientX,
          startY: touch.clientY,
          lastX: touch.clientX,
          lastY: touch.clientY,
          startedAtMs: Date.now(),
        };
        const isLeftSide = touch.clientX < splitX;
        if (isLeftSide) {
          if (!this.fpsTouchMoveGesture) {
            this.fpsTouchMoveGesture = gesture;
            this.scheduleFpsTouchRunButtonHold(gesture);
            if (this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen) {
              this.dependencies.tileContextActions.closeFpsCrosshairContextMenu(false);
            }
          }
        } else if (!this.fpsTouchLookGesture) {
          this.fpsTouchLookGesture = gesture;
        }
      }

      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (!this.canUseMapTouchInput(event)) {
      this.touchSwipeStart = null;
      this.pinchZoomStart = null;
      this.cancelMapTouchContextHoldState();
      return;
    }

    if (event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY,
      );
      this.pinchZoomStart = { distance, cameraDistance: this.dependencies.camera.cameraDistance };
      this.touchSwipeStart = null; // Prevent swipe while pinching
      this.cancelMapTouchContextHoldState();
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (event.touches.length !== 1) {
      this.touchSwipeStart = null;
      this.pinchZoomStart = null;
      this.cancelMapTouchContextHoldState();
      return;
    }

    const touch = event.touches[0];
    this.touchSwipeStart = {
      touchId: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      startedAtMs: Date.now(),
      panningActive: false,
    };
    this.pinchZoomStart = null;
    this.scheduleMapTouchContextHold(
      touch.identifier,
      touch.clientX,
      touch.clientY,
    );
    if (event.cancelable) {
      event.preventDefault();
    }
  }

  handleTouchMove(event: TouchEvent): void {
    if (this.dependencies.promptDialogs.isUiInputBlocked()) {
      event.preventDefault();
      return;
    }
    if (!this.dependencies.movementInput.isFpsMode() && this.dependencies.directionPrompts.isInDirectionQuestion) {
      if (!this.dependencies.directionPrompts.canUseNormalDirectionPromptOverlayTouchInput(event)) {
        this.dependencies.directionPrompts.clearDirectionPromptOverlayInteraction();
        return;
      }
      if (this.dependencies.directionPrompts.directionPromptTouchId === null) {
        return;
      }
      const touch =
        this.findTouchById(event.touches, this.dependencies.directionPrompts.directionPromptTouchId) ||
        this.findTouchById(event.changedTouches, this.dependencies.directionPrompts.directionPromptTouchId);
      if (!touch) {
        return;
      }
      const buttonId =
        this.dependencies.directionPrompts.getDirectionPromptOverlayButtonFromClientCoordinates(
          touch.clientX,
          touch.clientY,
        );
      this.dependencies.directionPrompts.setHoveredDirectionPromptOverlayButton(buttonId);
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (this.dependencies.movementInput.isFpsMode()) {
      if (this.dependencies.directionPrompts.isInDirectionQuestion) {
        if (!this.dependencies.directionPrompts.canUseFpsDirectionPromptTouchInput(event)) {
          return;
        }

        let consumed = false;
        if (this.fpsTouchLookGesture) {
          const touch =
            this.findTouchById(
              event.changedTouches,
              this.fpsTouchLookGesture.touchId,
            ) ||
            this.findTouchById(event.touches, this.fpsTouchLookGesture.touchId);
          if (touch) {
            const deltaX = touch.clientX - this.fpsTouchLookGesture.lastX;
            const deltaY = touch.clientY - this.fpsTouchLookGesture.lastY;
            this.dependencies.camera.applyFpsLookDelta(
              deltaX,
              deltaY,
              this.fpsTouchLookSensitivity,
            );
            this.fpsTouchLookGesture.lastX = touch.clientX;
            this.fpsTouchLookGesture.lastY = touch.clientY;
            consumed = true;
          }
        }

        if (this.fpsTouchMoveGesture) {
          const touch =
            this.findTouchById(
              event.changedTouches,
              this.fpsTouchMoveGesture.touchId,
            ) ||
            this.findTouchById(event.touches, this.fpsTouchMoveGesture.touchId);
          if (touch) {
            this.fpsTouchMoveGesture.lastX = touch.clientX;
            this.fpsTouchMoveGesture.lastY = touch.clientY;
            consumed = true;
          }
        }

        if (consumed && event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      if (this.canUseFpsPositionInputTouchInput(event)) {
        let consumed = false;
        if (this.fpsTouchLookGesture) {
          const touch =
            this.findTouchById(
              event.changedTouches,
              this.fpsTouchLookGesture.touchId,
            ) ||
            this.findTouchById(event.touches, this.fpsTouchLookGesture.touchId);
          if (touch) {
            const deltaX = touch.clientX - this.fpsTouchLookGesture.lastX;
            const deltaY = touch.clientY - this.fpsTouchLookGesture.lastY;
            this.dependencies.camera.applyFpsLookDelta(
              deltaX,
              deltaY,
              this.fpsTouchLookSensitivity,
            );
            this.fpsTouchLookGesture.lastX = touch.clientX;
            this.fpsTouchLookGesture.lastY = touch.clientY;
            consumed = true;
          }
        }

        if (this.fpsTouchMoveGesture) {
          const touch =
            this.findTouchById(
              event.changedTouches,
              this.fpsTouchMoveGesture.touchId,
            ) ||
            this.findTouchById(event.touches, this.fpsTouchMoveGesture.touchId);
          if (touch) {
            this.fpsTouchMoveGesture.lastX = touch.clientX;
            this.fpsTouchMoveGesture.lastY = touch.clientY;
            consumed = true;
          }
        }

        if (consumed && event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      if (!this.canUseFpsTouchInput(event)) {
        this.clearFpsTouchGestures();
        return;
      }

      const nowMs = Date.now();
      let consumed = false;
      if (this.fpsTouchLookGesture) {
        const touch =
          this.findTouchById(
            event.changedTouches,
            this.fpsTouchLookGesture.touchId,
          ) ||
          this.findTouchById(event.touches, this.fpsTouchLookGesture.touchId);
        if (touch) {
          const deltaX = touch.clientX - this.fpsTouchLookGesture.lastX;
          const deltaY = touch.clientY - this.fpsTouchLookGesture.lastY;
          const traveled = Math.hypot(
            touch.clientX - this.fpsTouchLookGesture.startX,
            touch.clientY - this.fpsTouchLookGesture.startY,
          );
          if (
            traveled >= this.fpsTouchLookMoveThresholdPx &&
            this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen
          ) {
            this.dependencies.tileContextActions.closeFpsCrosshairContextMenu(false);
          }
          this.dependencies.camera.applyFpsLookDelta(deltaX, deltaY, this.fpsTouchLookSensitivity);
          this.fpsTouchLookGesture.lastX = touch.clientX;
          this.fpsTouchLookGesture.lastY = touch.clientY;
          consumed = true;
        }
      }

      if (this.fpsTouchMoveGesture) {
        const touch =
          this.findTouchById(
            event.changedTouches,
            this.fpsTouchMoveGesture.touchId,
          ) ||
          this.findTouchById(event.touches, this.fpsTouchMoveGesture.touchId);
        if (touch) {
          this.fpsTouchMoveGesture.lastX = touch.clientX;
          this.fpsTouchMoveGesture.lastY = touch.clientY;
          this.updateFpsTouchRunButtonForMoveGesture(
            this.fpsTouchMoveGesture,
            touch,
            nowMs,
          );
          if (this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen) {
            const traveled = Math.hypot(
              touch.clientX - this.fpsTouchMoveGesture.startX,
              touch.clientY - this.fpsTouchMoveGesture.startY,
            );
            if (traveled >= this.touchSwipeMinDistancePx) {
              this.dependencies.tileContextActions.closeFpsCrosshairContextMenu(false);
            }
          }
          consumed = true;
        }
      }

      if (consumed && event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (this.canUseOverheadPositionInputTouchInput(event)) {
      const start = this.touchSwipeStart;
      if (!start) {
        return;
      }
      const touch =
        this.findTouchById(event.touches, start.touchId) ||
        this.findTouchById(event.changedTouches, start.touchId);
      if (!touch) {
        return;
      }
      start.lastX = touch.clientX;
      start.lastY = touch.clientY;
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (!this.canUseMapTouchInput(event)) {
      this.touchSwipeStart = null;
      this.pinchZoomStart = null;
      this.cancelMapTouchContextHoldState();
      return;
    }

    if (this.pinchZoomStart && event.touches.length === 2) {
      this.cancelMapTouchContextHoldState();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY,
      );
      const startDistance = this.pinchZoomStart.distance;
      const scale = startDistance / distance;

      const newCameraDistance = this.pinchZoomStart.cameraDistance * scale;
      this.dependencies.camera.cameraDistance = THREE.MathUtils.clamp(
        newCameraDistance,
        this.dependencies.camera.minDistance,
        this.dependencies.terminalRendering.isTerminalDisplayMode()
          ? this.dependencies.camera.terminalMaxCameraDistance
          : this.dependencies.camera.maxDistance,
      );

      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (!this.touchSwipeStart) {
      return;
    }

    const touch =
      this.findTouchById(event.touches, this.touchSwipeStart.touchId) ||
      this.findTouchById(event.changedTouches, this.touchSwipeStart.touchId);
    if (!touch) {
      return;
    }
    const holdState = this.mapTouchContextHoldState;
    if (holdState && holdState.touchId === this.touchSwipeStart.touchId) {
      const holdDx = touch.clientX - holdState.startX;
      const holdDy = touch.clientY - holdState.startY;
      if (Math.hypot(holdDx, holdDy) >= this.mapTouchContextHoldDeadzonePx) {
        this.cancelMapTouchContextHoldState();
      }
    }

    const nowMs = Date.now();
    const elapsedMs = nowMs - this.touchSwipeStart.startedAtMs;
    if (!this.touchSwipeStart.panningActive) {
      const travelX = touch.clientX - this.touchSwipeStart.x;
      const travelY = touch.clientY - this.touchSwipeStart.y;
      const traveled = Math.hypot(travelX, travelY);
      if (
        elapsedMs >= this.touchSwipePanHoldMs &&
        traveled >= this.touchSwipeMinDistancePx
      ) {
        this.touchSwipeStart.panningActive = true;
        this.dependencies.camera.isCameraCenteredOnPlayer = false;
      }
    }

    if (this.touchSwipeStart.panningActive) {
      const deltaX = touch.clientX - this.touchSwipeStart.lastX;
      const deltaY = touch.clientY - this.touchSwipeStart.lastY;
      const panSpeed = 0.05;
      const touchPanDirection = this.dependencies.engineState.clientOptions.invertTouchPanningDirection
        ? -1
        : 1;
      this.dependencies.camera.panThirdPersonCameraByScreenDelta(
        deltaX,
        deltaY,
        panSpeed,
        touchPanDirection,
      );
      this.touchSwipeStart.lastX = touch.clientX;
      this.touchSwipeStart.lastY = touch.clientY;
    }

    if (event.cancelable) {
      event.preventDefault();
    }
  }

  handleTouchEnd(event: TouchEvent): void {
    if (this.dependencies.promptDialogs.isUiInputBlocked()) {
      event.preventDefault();
      return;
    }
    if (!this.dependencies.movementInput.isFpsMode() && this.dependencies.directionPrompts.isInDirectionQuestion) {
      if (this.dependencies.directionPrompts.directionPromptTouchId === null || !event.changedTouches) {
        return;
      }
      const touch = this.findTouchById(
        event.changedTouches,
        this.dependencies.directionPrompts.directionPromptTouchId,
      );
      if (!touch) {
        return;
      }
      const hoveredButtonId =
        this.dependencies.directionPrompts.getDirectionPromptOverlayButtonFromClientCoordinates(
          touch.clientX,
          touch.clientY,
        );
      const shouldConfirm =
        hoveredButtonId !== null &&
        hoveredButtonId === this.dependencies.directionPrompts.directionPromptPressedButtonId;
      this.dependencies.directionPrompts.clearDirectionPromptOverlayInteraction();
      if (shouldConfirm) {
        this.dependencies.directionPrompts.confirmDirectionPromptOverlayButton(hoveredButtonId);
      } else {
        this.dependencies.directionPrompts.cancelDirectionPromptOverlaySelection();
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (this.dependencies.movementInput.isFpsMode()) {
      if (this.dependencies.directionPrompts.isInDirectionQuestion) {
        this.clearFpsTouchRunButtonHoldTimer();
        this.clearFpsTouchRunButtonState();
        if (!event.changedTouches || event.changedTouches.length === 0) {
          return;
        }

        let consumed = false;
        const nowMs = Date.now();
        for (let i = 0; i < event.changedTouches.length; i += 1) {
          const touch = event.changedTouches.item(i);
          if (!touch) {
            continue;
          }

          if (
            this.fpsTouchMoveGesture &&
            touch.identifier === this.fpsTouchMoveGesture.touchId
          ) {
            const gesture = this.fpsTouchMoveGesture;
            this.fpsTouchMoveGesture = null;
            const dx = touch.clientX - gesture.startX;
            const dy = touch.clientY - gesture.startY;
            const durationMs = nowMs - gesture.startedAtMs;
            const action = this.dependencies.directionPrompts.resolveFpsDirectionTouchSwipeAction(
              dx,
              dy,
              durationMs,
            );
            if (action && this.dependencies.directionPrompts.applyFpsDirectionTouchAction(action)) {
              consumed = true;
            }
          }

          if (
            this.fpsTouchLookGesture &&
            touch.identifier === this.fpsTouchLookGesture.touchId
          ) {
            const gesture = this.fpsTouchLookGesture;
            this.fpsTouchLookGesture = null;
            const dx = touch.clientX - gesture.startX;
            const dy = touch.clientY - gesture.startY;
            const distance = Math.hypot(dx, dy);
            const durationMs = nowMs - gesture.startedAtMs;
            const isTap =
              distance < this.fpsTouchLookMoveThresholdPx &&
              durationMs <= this.fpsTouchTapMaxDurationMs;
            if (isTap && this.dependencies.directionPrompts.confirmFpsDirectionQuestionFromAim()) {
              consumed = true;
            }
          }
        }

        if (consumed && event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      if (this.canUseFpsPositionInputTouchInput(event)) {
        this.clearFpsTouchRunButtonHoldTimer();
        this.clearFpsTouchRunButtonState();
        if (!event.changedTouches || event.changedTouches.length === 0) {
          return;
        }

        let consumed = false;
        const nowMs = Date.now();
        for (let i = 0; i < event.changedTouches.length; i += 1) {
          const touch = event.changedTouches.item(i);
          if (!touch) {
            continue;
          }

          if (
            this.fpsTouchLookGesture &&
            touch.identifier === this.fpsTouchLookGesture.touchId
          ) {
            const gesture = this.fpsTouchLookGesture;
            this.fpsTouchLookGesture = null;
            const dx = touch.clientX - gesture.startX;
            const dy = touch.clientY - gesture.startY;
            const distance = Math.hypot(dx, dy);
            const durationMs = nowMs - gesture.startedAtMs;
            const isTap =
              distance < this.fpsTouchLookMoveThresholdPx &&
              durationMs <= this.fpsTouchTapMaxDurationMs;
            if (isTap) {
              if (this.dependencies.gameOver.releaseDeferredGameOverUiReveal()) {
                consumed = true;
                continue;
              }
              const handledFarLookPointer =
                this.dependencies.positionSelection.handleFarLookPositionPointerSelection(
                  touch.clientX,
                  touch.clientY,
                  "touch-primary",
                );
              if (
                !handledFarLookPointer &&
                !this.dependencies.positionSelection.isFarLookPositionInputMode()
              ) {
                this.dependencies.engineMessages.logClickLookTileDebug(
                  "touch-primary",
                  this.dependencies.positionSelection.positionCursor.x,
                  this.dependencies.positionSelection.positionCursor.y,
                );
                this.dependencies.inputCommands.sendMouseInput(
                  this.dependencies.positionSelection.positionCursor.x,
                  this.dependencies.positionSelection.positionCursor.y,
                  0,
                );
              }
              consumed = true;
            }
          }

          if (
            this.fpsTouchMoveGesture &&
            touch.identifier === this.fpsTouchMoveGesture.touchId
          ) {
            const gesture = this.fpsTouchMoveGesture;
            this.fpsTouchMoveGesture = null;
            const dx = touch.clientX - gesture.startX;
            const dy = touch.clientY - gesture.startY;
            const distance = Math.hypot(dx, dy);
            const durationMs = nowMs - gesture.startedAtMs;
            const isTap =
              distance < this.fpsTouchLookMoveThresholdPx &&
              durationMs <= this.fpsTouchTapMaxDurationMs;
            if (isTap) {
              if (this.dependencies.gameOver.releaseDeferredGameOverUiReveal()) {
                consumed = true;
                continue;
              }
              const handledFarLookPointer =
                this.dependencies.positionSelection.handleFarLookPositionPointerSelection(
                  touch.clientX,
                  touch.clientY,
                  "touch-primary",
                );
              if (handledFarLookPointer || this.dependencies.positionSelection.isFarLookPositionInputMode()) {
                consumed = true;
                continue;
              }
            }

            const fpsMoveInput =
              durationMs <= this.touchSwipeMaxDurationMs
                ? this.resolveFpsMovementInputFromSwipe(dx, dy)
                : null;
            if (fpsMoveInput) {
              this.dependencies.inputCommands.onSwipeCommandExecuted();
              this.dependencies.inputCommands.sendInput(fpsMoveInput);
              consumed = true;
            }
          }
        }

        if (consumed && event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      if (!event.changedTouches || event.changedTouches.length === 0) {
        return;
      }

      let consumed = false;
      const nowMs = Date.now();
      for (let i = 0; i < event.changedTouches.length; i += 1) {
        const touch = event.changedTouches.item(i);
        if (!touch) {
          continue;
        }

        if (
          this.fpsTouchLookGesture &&
          touch.identifier === this.fpsTouchLookGesture.touchId
        ) {
          const gesture = this.fpsTouchLookGesture;
          this.fpsTouchLookGesture = null;
          const dx = touch.clientX - gesture.startX;
          const dy = touch.clientY - gesture.startY;
          const distance = Math.hypot(dx, dy);
          const durationMs = nowMs - gesture.startedAtMs;
          const isTap =
            distance < this.fpsTouchLookMoveThresholdPx &&
            durationMs <= this.fpsTouchTapMaxDurationMs;
          if (isTap) {
            if (this.dependencies.gameOver.releaseDeferredGameOverUiReveal()) {
              consumed = true;
              continue;
            }
            if (this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen) {
              this.dependencies.tileContextActions.closeFpsCrosshairContextMenu(false);
            } else {
              this.dependencies.tileContextActions.openFpsCrosshairContextMenu();
            }
            consumed = true;
          }
        }

        if (
          this.fpsTouchMoveGesture &&
          touch.identifier === this.fpsTouchMoveGesture.touchId
        ) {
          const gesture = this.fpsTouchMoveGesture;
          this.fpsTouchMoveGesture = null;
          this.clearFpsTouchRunButtonHoldTimer();
          const dx = touch.clientX - gesture.startX;
          const dy = touch.clientY - gesture.startY;
          const hadRunButtonForTouch =
            this.fpsTouchRunButtonTouchId === touch.identifier;
          const runButtonActive =
            hadRunButtonForTouch && this.fpsTouchRunButtonActive;
          if (hadRunButtonForTouch) {
            this.clearFpsTouchRunButtonState();
            const fpsMoveInput = this.resolveFpsMovementInputFromSwipe(dx, dy);
            if (runButtonActive && fpsMoveInput) {
              if (this.dependencies.gameOver.releaseDeferredGameOverUiReveal()) {
                consumed = true;
                continue;
              }
              if (this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen) {
                this.dependencies.tileContextActions.closeFpsCrosshairContextMenu(false);
              }
              if (!this.dependencies.playerMovement.hasPlayerMovedOnce) {
                this.dependencies.movementInput.lastMovementInputAtMs = nowMs;
              }
              this.dependencies.inputCommands.onSwipeCommandExecuted();
              this.dependencies.inputCommands.sendForcedDirectionalInput(fpsMoveInput);
            }
            // Releasing off the run button cancels the swipe entirely.
            consumed = true;
            continue;
          }

          const durationMs = nowMs - gesture.startedAtMs;
          const fpsMoveInput =
            durationMs <= this.touchSwipeMaxDurationMs
              ? this.resolveFpsMovementInputFromSwipe(dx, dy)
              : null;
          if (fpsMoveInput) {
            if (this.dependencies.gameOver.releaseDeferredGameOverUiReveal()) {
              consumed = true;
              continue;
            }
            if (this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen) {
              this.dependencies.tileContextActions.closeFpsCrosshairContextMenu(false);
            }
            if (!this.dependencies.playerMovement.hasPlayerMovedOnce) {
              this.dependencies.movementInput.lastMovementInputAtMs = nowMs;
            }
            this.dependencies.inputCommands.onSwipeCommandExecuted();
            this.dependencies.inputCommands.sendInput(fpsMoveInput);
            consumed = true;
          }
        }
      }

      if (consumed && event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (this.canUseOverheadPositionInputTouchInput(event)) {
      const start = this.touchSwipeStart;
      this.touchSwipeStart = null;
      this.cancelMapTouchContextHoldState();
      if (
        !start ||
        !event.changedTouches ||
        event.changedTouches.length === 0
      ) {
        return;
      }

      const touch =
        this.findTouchById(event.changedTouches, start.touchId) ||
        event.changedTouches[0];
      if (!touch) {
        return;
      }

      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const distance = Math.hypot(dx, dy);
      const durationMs = Date.now() - start.startedAtMs;
      const swipeInput =
        durationMs <= this.touchSwipeMaxDurationMs
          ? this.dependencies.movementInput.resolveSwipeDirectionInput(dx, dy)
          : null;

      if (swipeInput && distance >= this.touchSwipeMinDistancePx) {
        if (this.dependencies.gameOver.releaseDeferredGameOverUiReveal()) {
          if (event.cancelable) {
            event.preventDefault();
          }
          return;
        }
        this.dependencies.inputCommands.onSwipeCommandExecuted();
        this.dependencies.inputCommands.sendInput(swipeInput);
        if (event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      if (this.dependencies.gameOver.releaseDeferredGameOverUiReveal()) {
        if (event.cancelable) {
          event.preventDefault();
        }
        return;
      }

      if (
        Number.isFinite(this.dependencies.positionSelection.positionCursor.x) &&
        Number.isFinite(this.dependencies.positionSelection.positionCursor.y)
      ) {
        const handledFarLookPointer =
          this.dependencies.positionSelection.handleFarLookPositionPointerSelection(
            touch.clientX,
            touch.clientY,
            "touch-primary",
          );
        if (!handledFarLookPointer && !this.dependencies.positionSelection.isFarLookPositionInputMode()) {
          this.dependencies.engineMessages.logClickLookTileDebug(
            "touch-primary",
            this.dependencies.positionSelection.positionCursor.x,
            this.dependencies.positionSelection.positionCursor.y,
          );
          this.dependencies.inputCommands.sendMouseInput(this.dependencies.positionSelection.positionCursor.x, this.dependencies.positionSelection.positionCursor.y, 0);
        }
        if (handledFarLookPointer || !this.dependencies.positionSelection.isFarLookPositionInputMode()) {
          if (event.cancelable) {
            event.preventDefault();
          }
        }
      }
      return;
    }

    if (this.pinchZoomStart) {
      this.pinchZoomStart = null;
      this.cancelMapTouchContextHoldState();
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    const start = this.touchSwipeStart;
    this.touchSwipeStart = null;
    const holdState = this.mapTouchContextHoldState;
    this.clearMapTouchContextHoldTimer();
    if (!start || !this.canUseMapTouchInput(event)) {
      this.mapTouchContextHoldState = null;
      return;
    }
    if (!event.changedTouches || event.changedTouches.length === 0) {
      this.mapTouchContextHoldState = null;
      return;
    }

    const touch =
      this.findTouchById(event.changedTouches, start.touchId) ||
      event.changedTouches[0];
    if (!touch) {
      this.mapTouchContextHoldState = null;
      return;
    }

    if (holdState && holdState.touchId === start.touchId && holdState.opened) {
      this.mapTouchContextHoldState = null;
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    if (start.panningActive) {
      this.mapTouchContextHoldState = null;
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const distance = Math.hypot(dx, dy);
    const durationMs = Date.now() - start.startedAtMs;
    const isQuickTap =
      distance < this.touchSwipeMinDistancePx &&
      durationMs <= this.fpsTouchTapMaxDurationMs;
    if (isQuickTap && this.dependencies.gameOver.releaseDeferredGameOverUiReveal()) {
      this.mapTouchContextHoldState = null;
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }
    if (durationMs >= this.mapTouchContextHoldMs) {
      this.mapTouchContextHoldState = null;
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }
    if (
      distance < this.touchSwipeMinDistancePx ||
      durationMs > this.touchSwipeMaxDurationMs
    ) {
      if (this.sendMapTouchPrimaryClickInput(touch.clientX, touch.clientY)) {
        if (event.cancelable) {
          event.preventDefault();
        }
      }
      this.mapTouchContextHoldState = null;
      return;
    }

    const swipeInput = this.dependencies.movementInput.resolveSwipeDirectionInput(dx, dy);
    if (!swipeInput) {
      this.mapTouchContextHoldState = null;
      return;
    }
    if (this.dependencies.gameOver.releaseDeferredGameOverUiReveal()) {
      this.mapTouchContextHoldState = null;
      if (event.cancelable) {
        event.preventDefault();
      }
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    this.dependencies.inputCommands.onSwipeCommandExecuted();
    this.dependencies.inputCommands.sendInput(swipeInput);
    this.mapTouchContextHoldState = null;
  }

  handleTouchCancel(): void {
    if (this.dependencies.promptDialogs.isUiInputBlocked()) {
      return;
    }
    if (!this.dependencies.movementInput.isFpsMode() && this.dependencies.directionPrompts.isInDirectionQuestion) {
      this.dependencies.directionPrompts.clearDirectionPromptOverlayInteraction();
      return;
    }
    if (this.dependencies.movementInput.isFpsMode()) {
      this.clearFpsTouchGestures();
      return;
    }
    this.touchSwipeStart = null;
    this.pinchZoomStart = null;
    this.cancelMapTouchContextHoldState();
  }
}
