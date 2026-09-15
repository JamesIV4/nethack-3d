import { isQuestBrowser } from "../../../quest/webxr/host";
import * as THREE from "three";
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
import type { PointerLock } from "./pointer-lock";
import type { PointerTargeting } from "./pointer-targeting";
import type { PositionSelection } from "./position-selection";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { QuestionMenus } from "../ui/question-menus";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { TerminalRendering } from "../rendering/terminal-rendering";
import type { TileContextActions } from "../ui/tile-context-actions";
import type { TileRendering } from "../rendering/tile-rendering";

export interface MouseInputDependencies {
  readonly audioHapticsPlatform: Pick<
    AudioHapticsPlatform,
    "resumeFmodFromUserGesture"
  >;
  readonly camera: Pick<
    Camera,
    "applyFpsLookDelta"
    | "cameraDistance"
    | "cameraPitch"
    | "cameraYaw"
    | "clearCameraYawSnapTarget"
    | "firstPersonMouseSensitivity"
    | "isCameraCenteredOnPlayer"
    | "maxCameraPitch"
    | "maxDistance"
    | "minCameraPitch"
    | "minDistance"
    | "panThirdPersonCameraByScreenDelta"
    | "queueCameraYawSnapToNearest45"
    | "rotationSpeed"
    | "terminalMaxCameraDistance"
    | "wrapAngle"
  >;
  readonly combatAttribution: Pick<
    CombatAttribution,
    "pendingPointerAttackTargetContext"
    | "setPendingPointerAttackTargetFromTile"
    | "updateDirectionalAttackContextFromTarget"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "canUseFpsDirectionPromptMouseInput"
    | "canUseNormalDirectionPromptOverlayMouseInput"
    | "cancelDirectionPromptOverlaySelection"
    | "clearDirectionPromptOverlayInteraction"
    | "confirmDirectionPromptOverlayButton"
    | "directionPromptMouseDownActive"
    | "directionPromptPressedButtonId"
    | "getDirectionPromptOverlayButtonFromClientCoordinates"
    | "hideDirectionQuestion"
    | "isInDirectionQuestion"
    | "isNormalDirectionPromptOverlayActive"
    | "setHoveredDirectionPromptOverlayButton"
    | "updateDirectionPromptOverlayState"
  >;
  readonly engineMessages: Pick<
    EngineMessages,
    "logClickLookTileDebug"
  >;
  readonly engineState: Pick<
    EngineState,
    "session"
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
    | "sendForcedDirectionalInput"
    | "sendInput"
    | "sendMouseInput"
    | "submitDirectionAnswer"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "fireInCurrentAimDirection"
    | "getFpsDirectionQuestionInputFromAim"
    | "isFpsFireSuppressed"
    | "isFpsMode"
    | "lastMovementInputAtMs"
    | "resolveDirectionFromDelta"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "hasPlayerMovedOnce"
    | "playerPos"
  >;
  readonly pointerLock: Pick<
    PointerLock,
    "fpsPointerLockActive"
  >;
  readonly pointerTargeting: Pick<
    PointerTargeting,
    "getClickedTilePosition"
    | "getGridPositionFromClientCoordinates"
    | "resolveTileContextTargetFromClientCoordinates"
    | "shouldSearchAdjacentTerminalVoid"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "handleFarLookPositionPointerSelection"
    | "handleFarLookPositionTileSelection"
    | "isFarLookPositionInputMode"
    | "positionCursor"
    | "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "isAnyModalVisible"
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
    "clearVultureMouseHoverHighlight"
    | "closeAnyTileContextMenu"
    | "closeFpsCrosshairContextMenu"
    | "fpsCrosshairContextMenuOpen"
    | "openFpsCrosshairContextMenu"
    | "openNormalTileContextMenuAtTarget"
    | "shouldConsumeSuppressedMapPrimaryPointerEvent"
    | "tryRunFpsDoorPrimaryClickAction"
    | "tryRunFpsSelfTilePrimaryClickAction"
    | "updateVultureMouseHoverHighlightFromMouseEvent"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
}

/** Mouse wheel, gameplay clicks, drag rotation and pointer movement. */
export class MouseInput {
  constructor(private readonly dependencies: MouseInputDependencies) {}

  isMiddleMouseDown: boolean = false;

  isRightMouseDown: boolean = false;

  rightMouseDownStartX: number = 0;

  rightMouseDownStartY: number = 0;

  rightMouseDragExceededDeadzone: boolean = false;

  rightMouseCanOpenContextMenuOnRelease: boolean = false;

  readonly rightMouseContextDeadzonePx: number = 10;

  lastMouseX: number = 0;

  lastMouseY: number = 0;

  handleMouseWheel(event: WheelEvent): void {
    if (this.dependencies.promptDialogs.isUiInputBlocked()) {
      event.preventDefault();
      return;
    }
    if (this.dependencies.movementInput.isFpsMode()) {
      event.preventDefault();
      return;
    }

    // Disable camera zoom while any modal/dialog is visible.
    if (this.dependencies.promptDialogs.isAnyModalVisible()) {
      return;
    }

    // Check if the mouse is over the game log element
    const gameLog = document.getElementById("game-log");
    if (gameLog) {
      const rect = gameLog.getBoundingClientRect();
      const mouseX = event.clientX;
      const mouseY = event.clientY;

      // If mouse is over the game log, allow normal scrolling and don't zoom camera
      if (
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom
      ) {
        // Don't prevent default - allow the log to scroll naturally
        return;
      }
    }

    // If not over game log, handle camera zooming
    event.preventDefault();
    const zoomSpeed = 1.0;
    const delta = event.deltaY > 0 ? zoomSpeed : -zoomSpeed;
    this.dependencies.camera.cameraDistance = Math.max(
      this.dependencies.camera.minDistance,
      Math.min(
        this.dependencies.terminalRendering.isTerminalDisplayMode()
          ? this.dependencies.camera.terminalMaxCameraDistance
          : this.dependencies.camera.maxDistance,
        this.dependencies.camera.cameraDistance + delta,
      ),
    );
  }

  canUseMapMouseInput(event: MouseEvent): boolean {
    if (!this.dependencies.engineState.session) {
      return false;
    }
    if (event.button !== 0) {
      return false;
    }
    if (event.target !== this.dependencies.renderPipeline.renderer.domElement) {
      return false;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    if (this.dependencies.promptDialogs.isAnyModalVisible()) {
      return false;
    }
    if (this.dependencies.questionMenus.isInQuestion || this.dependencies.directionPrompts.isInDirectionQuestion) {
      return false;
    }
    if (this.dependencies.extendedCommands.metaCommandModeActive) {
      return false;
    }
    if (this.dependencies.movementInput.isFpsMode() && !this.dependencies.positionSelection.positionInputModeActive) {
      return false;
    }
    return true;
  }

  canUseFpsGameplayMouseInput(event: MouseEvent): boolean {
    if (!this.dependencies.engineState.session || !this.dependencies.movementInput.isFpsMode()) {
      return false;
    }
    if (event.target !== this.dependencies.renderPipeline.renderer.domElement) {
      return false;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
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

  handleMapMouseInput(event: MouseEvent): boolean {
    if (!this.canUseMapMouseInput(event)) {
      return false;
    }

    if (
      event.button === 0 &&
      this.dependencies.positionSelection.handleFarLookPositionPointerSelection(
        event.clientX,
        event.clientY,
        "mouse-primary",
      )
    ) {
      return true;
    }

    const target = this.dependencies.pointerTargeting.getClickedTilePosition(event);
    if (!target && event.button === 0) {
      this.dependencies.combatAttribution.pendingPointerAttackTargetContext = null;
      const gridTarget = this.dependencies.pointerTargeting.getGridPositionFromClientCoordinates(
        event.clientX,
        event.clientY,
      );
      if (gridTarget) {
        if (this.dependencies.pointerTargeting.shouldSearchAdjacentTerminalVoid(gridTarget)) {
          this.dependencies.inputCommands.executeQuickAction("search", true);
          return true;
        }
        const dx = gridTarget.x - this.dependencies.playerMovement.playerPos.x;
        const dy = gridTarget.y - this.dependencies.playerMovement.playerPos.y;
        const direction = this.dependencies.movementInput.resolveDirectionFromDelta(dx, dy);
        if (direction) {
          this.dependencies.inputCommands.sendForcedDirectionalInput(direction);
          return true;
        }
      }
      return false;
    }
    if (!target) {
      return false;
    }

    return this.activateMapTileTarget(target, event.button, "mouse-primary");
  }

  /** Native rays arrive as tiles; the ordinary UI/prompt gates still apply. */
  activateQuestTile(x: number, y: number, secondary = false): boolean {
    if (!Number.isInteger(x) || !Number.isInteger(y) ||
        !this.dependencies.engineState.session || this.dependencies.promptDialogs.isUiInputBlocked() ||
        this.dependencies.promptDialogs.isAnyModalVisible() || this.dependencies.questionMenus.isInQuestion ||
        this.dependencies.directionPrompts.isInDirectionQuestion || this.dependencies.extendedCommands.metaCommandModeActive) {
      return false;
    }
    if (secondary && this.dependencies.positionSelection.positionInputModeActive) return false;
    this.dependencies.audioHapticsPlatform.resumeFmodFromUserGesture();
    if (secondary && this.dependencies.movementInput.isFpsMode()) {
      if (this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen) this.dependencies.tileContextActions.closeFpsCrosshairContextMenu(true);
      else this.dependencies.tileContextActions.openFpsCrosshairContextMenu();
      return true;
    }
    const tile = this.dependencies.tileRendering.tileMap.get(x + "," + y);
    if (!tile || !tile.visible) return false;
    if (secondary) {
      this.dependencies.tileContextActions.openNormalTileContextMenuAtTarget({ key: `${x},${y}`, x, y, mesh: tile });
      return true;
    }
    if (this.dependencies.positionSelection.handleFarLookPositionTileSelection(x, y, "quest-ray")) return true;
    return this.activateMapTileTarget({ x, y }, 0, "quest-ray");
  }

  private activateMapTileTarget(target: { x: number; y: number }, button: number, source: string): boolean {
    if (button === 0 && !this.dependencies.playerMovement.hasPlayerMovedOnce) {
      this.dependencies.movementInput.lastMovementInputAtMs = Date.now();
    }

    if (button === 0) {
      this.dependencies.combatAttribution.updateDirectionalAttackContextFromTarget(target.x, target.y);
      this.dependencies.combatAttribution.setPendingPointerAttackTargetFromTile(target.x, target.y);
    }
    this.dependencies.engineMessages.logClickLookTileDebug(source, target.x, target.y);
    if (source === "quest-ray") {
      this.dependencies.inputCommands.sendMouseInput(target.x, target.y, button, { allowFpsMovement: true });
    } else this.dependencies.inputCommands.sendMouseInput(target.x, target.y, button);
    return true;
  }

  canOpenNormalTileContextMenuFromMouse(event: MouseEvent): boolean {
    if (!this.dependencies.engineState.session || this.dependencies.movementInput.isFpsMode()) {
      return false;
    }
    if (event.button !== 2) {
      return false;
    }
    if (event.target !== this.dependencies.renderPipeline.renderer.domElement) {
      return false;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
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
    return true;
  }

  handleMouseDown(event: MouseEvent): void {
    if (isQuestBrowser() && this.dependencies.movementInput.isFpsMode()) return;
    if (this.dependencies.promptDialogs.isUiInputBlocked()) {
      event.preventDefault();
      return;
    }
    this.dependencies.audioHapticsPlatform.resumeFmodFromUserGesture();
    if (event.button === 0 && this.dependencies.gameOver.releaseDeferredGameOverUiReveal()) {
      event.preventDefault();
      return;
    }

    if (
      !this.dependencies.movementInput.isFpsMode() &&
      event.button === 0 &&
      this.dependencies.tileContextActions.shouldConsumeSuppressedMapPrimaryPointerEvent(
        event.target === this.dependencies.renderPipeline.renderer.domElement,
      )
    ) {
      event.preventDefault();
      return;
    }

    if (
      !this.dependencies.movementInput.isFpsMode() &&
      event.button === 0 &&
      this.dependencies.directionPrompts.canUseNormalDirectionPromptOverlayMouseInput(event)
    ) {
      event.preventDefault();
      const buttonId =
        this.dependencies.directionPrompts.getDirectionPromptOverlayButtonFromClientCoordinates(
          event.clientX,
          event.clientY,
        );
      this.dependencies.directionPrompts.directionPromptMouseDownActive = true;
      this.dependencies.directionPrompts.directionPromptPressedButtonId = buttonId;
      this.dependencies.directionPrompts.setHoveredDirectionPromptOverlayButton(buttonId);
      this.dependencies.directionPrompts.updateDirectionPromptOverlayState();
      return;
    }

    if (
      this.dependencies.movementInput.isFpsMode() &&
      this.dependencies.directionPrompts.isInDirectionQuestion &&
      event.button === 0 &&
      this.dependencies.directionPrompts.canUseFpsDirectionPromptMouseInput(event)
    ) {
      event.preventDefault();
      if (document.pointerLockElement !== this.dependencies.renderPipeline.renderer.domElement) {
        this.dependencies.renderPipeline.renderer.domElement.requestPointerLock?.();
        return;
      }
      const lookDirectionInput = this.dependencies.movementInput.getFpsDirectionQuestionInputFromAim();
      if (!lookDirectionInput) {
        return;
      }
      this.dependencies.inputCommands.submitDirectionAnswer(lookDirectionInput);
      return;
    }

    if (
      this.dependencies.movementInput.isFpsMode() &&
      this.dependencies.directionPrompts.isInDirectionQuestion &&
      event.button === 2 &&
      this.dependencies.directionPrompts.canUseFpsDirectionPromptMouseInput(event)
    ) {
      event.preventDefault();
      this.dependencies.inputCommands.sendInput("Escape");
      this.dependencies.directionPrompts.hideDirectionQuestion();
      return;
    }

    if (
      this.dependencies.movementInput.isFpsMode() &&
      this.dependencies.positionSelection.positionInputModeActive &&
      event.button === 0 &&
      (event.target === this.dependencies.renderPipeline.renderer.domElement ||
        document.pointerLockElement === this.dependencies.renderPipeline.renderer.domElement)
    ) {
      event.preventDefault();
      const handledFarLookPointer = this.dependencies.positionSelection.handleFarLookPositionPointerSelection(
        event.clientX,
        event.clientY,
        "mouse-primary",
      );
      if (!handledFarLookPointer && !this.dependencies.positionSelection.isFarLookPositionInputMode()) {
        this.dependencies.inputCommands.sendMouseInput(this.dependencies.positionSelection.positionCursor.x, this.dependencies.positionSelection.positionCursor.y, 0);
      }
      return;
    }

    if (
      this.dependencies.movementInput.isFpsMode() &&
      event.button === 0 &&
      this.canUseFpsGameplayMouseInput(event)
    ) {
      event.preventDefault();
      if (this.dependencies.movementInput.isFpsFireSuppressed()) {
        if (document.pointerLockElement !== this.dependencies.renderPipeline.renderer.domElement) {
          this.dependencies.renderPipeline.renderer.domElement.requestPointerLock?.();
        }
        return;
      }
      if (this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen) {
        this.dependencies.tileContextActions.closeFpsCrosshairContextMenu(true);
        return;
      }
      if (document.pointerLockElement !== this.dependencies.renderPipeline.renderer.domElement) {
        this.dependencies.renderPipeline.renderer.domElement.requestPointerLock?.();
        return;
      }
      if (this.dependencies.tileContextActions.tryRunFpsSelfTilePrimaryClickAction()) {
        return;
      }
      if (this.dependencies.tileContextActions.tryRunFpsDoorPrimaryClickAction()) {
        return;
      }
      this.dependencies.movementInput.fireInCurrentAimDirection();
      return;
    }

    if (
      this.dependencies.movementInput.isFpsMode() &&
      event.button === 2 &&
      this.canUseFpsGameplayMouseInput(event)
    ) {
      event.preventDefault();
      if (this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen) {
        this.dependencies.tileContextActions.closeFpsCrosshairContextMenu(true);
      } else {
        this.dependencies.tileContextActions.openFpsCrosshairContextMenu();
      }
      this.isRightMouseDown = false;
      this.rightMouseCanOpenContextMenuOnRelease = false;
      this.rightMouseDragExceededDeadzone = false;
      return;
    }

    if (this.handleMapMouseInput(event)) {
      event.preventDefault();
      return;
    }

    if (event.button === 1) {
      // Middle mouse button - rotation
      event.preventDefault();
      this.isMiddleMouseDown = true;
      this.dependencies.camera.clearCameraYawSnapTarget();
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (event.button === 2) {
      // Right mouse button - panning
      event.preventDefault();
      this.isRightMouseDown = true;
      this.dependencies.camera.isCameraCenteredOnPlayer = false;
      this.rightMouseDownStartX = event.clientX;
      this.rightMouseDownStartY = event.clientY;
      this.rightMouseDragExceededDeadzone = false;
      this.rightMouseCanOpenContextMenuOnRelease =
        !this.dependencies.movementInput.isFpsMode() && this.canOpenNormalTileContextMenuFromMouse(event);
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  handleMouseMove(event: MouseEvent): void {
    if (isQuestBrowser() && this.dependencies.movementInput.isFpsMode()) return;
    if (this.dependencies.promptDialogs.isUiInputBlocked()) {
      event.preventDefault();
      return;
    }
    if (
      this.dependencies.movementInput.isFpsMode() &&
      this.dependencies.positionSelection.positionInputModeActive &&
      event.target === this.dependencies.renderPipeline.renderer.domElement
    ) {
      event.preventDefault();
      const deltaX =
        typeof event.movementX === "number" && Number.isFinite(event.movementX)
          ? event.movementX
          : event.clientX - this.lastMouseX;
      const deltaY =
        typeof event.movementY === "number" && Number.isFinite(event.movementY)
          ? event.movementY
          : event.clientY - this.lastMouseY;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      this.dependencies.tileContextActions.clearVultureMouseHoverHighlight();
      this.dependencies.camera.applyFpsLookDelta(deltaX, deltaY, this.dependencies.camera.rotationSpeed);
      return;
    }
    if (this.dependencies.movementInput.isFpsMode() && this.dependencies.pointerLock.fpsPointerLockActive) {
      this.dependencies.tileContextActions.clearVultureMouseHoverHighlight();
      const deltaX = event.movementX || 0;
      const deltaY = event.movementY || 0;
      this.dependencies.camera.applyFpsLookDelta(deltaX, deltaY, this.dependencies.camera.firstPersonMouseSensitivity);
      return;
    }

    if (this.isMiddleMouseDown) {
      // Middle mouse - rotate camera
      event.preventDefault();
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;

      if (this.dependencies.movementInput.isFpsMode()) {
        this.dependencies.camera.applyFpsLookDelta(deltaX, deltaY, this.dependencies.camera.rotationSpeed);
      } else {
        this.dependencies.camera.cameraYaw = this.dependencies.camera.wrapAngle(
          this.dependencies.camera.cameraYaw + deltaX * this.dependencies.camera.rotationSpeed,
        );
        this.dependencies.camera.cameraPitch = THREE.MathUtils.clamp(
          this.dependencies.camera.cameraPitch + deltaY * this.dependencies.camera.rotationSpeed,
          this.dependencies.camera.minCameraPitch,
          this.dependencies.camera.maxCameraPitch,
        );
      }

      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      this.dependencies.tileContextActions.clearVultureMouseHoverHighlight();
    } else if (this.dependencies.movementInput.isFpsMode() && this.isRightMouseDown) {
      event.preventDefault();
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;
      this.dependencies.camera.applyFpsLookDelta(deltaX, deltaY, this.dependencies.camera.rotationSpeed);
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      this.dependencies.tileContextActions.clearVultureMouseHoverHighlight();
    } else if (this.isRightMouseDown) {
      // Right mouse - pan camera
      event.preventDefault();
      if (!this.rightMouseDragExceededDeadzone) {
        const movedDistance = Math.hypot(
          event.clientX - this.rightMouseDownStartX,
          event.clientY - this.rightMouseDownStartY,
        );
        if (movedDistance > this.rightMouseContextDeadzonePx) {
          this.rightMouseDragExceededDeadzone = true;
        }
      }
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;

      const panSpeed = 0.05;
      this.dependencies.camera.panThirdPersonCameraByScreenDelta(deltaX, deltaY, panSpeed);

      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      this.dependencies.tileContextActions.clearVultureMouseHoverHighlight();
    } else {
      if (this.dependencies.directionPrompts.isNormalDirectionPromptOverlayActive()) {
        const buttonId =
          event.target === this.dependencies.renderPipeline.renderer.domElement
            ? this.dependencies.directionPrompts.getDirectionPromptOverlayButtonFromClientCoordinates(
                event.clientX,
                event.clientY,
              )
            : null;
        this.dependencies.directionPrompts.setHoveredDirectionPromptOverlayButton(buttonId);
        this.dependencies.tileContextActions.clearVultureMouseHoverHighlight();
        return;
      }
      this.dependencies.tileContextActions.updateVultureMouseHoverHighlightFromMouseEvent(event);
    }
  }

  handleMouseUp(event: MouseEvent): void {
    if (isQuestBrowser() && this.dependencies.movementInput.isFpsMode()) return;
    if (this.dependencies.promptDialogs.isUiInputBlocked()) {
      event.preventDefault();
      return;
    }
    if (event.button === 0 && this.dependencies.directionPrompts.directionPromptMouseDownActive) {
      const hoveredButtonId = this.dependencies.directionPrompts.canUseNormalDirectionPromptOverlayMouseInput(
        event,
      )
        ? this.dependencies.directionPrompts.getDirectionPromptOverlayButtonFromClientCoordinates(
            event.clientX,
            event.clientY,
          )
        : null;
      const shouldConfirm =
        hoveredButtonId !== null &&
        hoveredButtonId === this.dependencies.directionPrompts.directionPromptPressedButtonId;
      this.dependencies.directionPrompts.clearDirectionPromptOverlayInteraction();
      if (shouldConfirm) {
        this.dependencies.directionPrompts.confirmDirectionPromptOverlayButton(hoveredButtonId);
      } else {
        this.dependencies.directionPrompts.cancelDirectionPromptOverlaySelection();
      }
      event.preventDefault();
      return;
    }

    if (event.button === 1) {
      // Middle mouse button
      const wasMiddleMouseDown = this.isMiddleMouseDown;
      this.isMiddleMouseDown = false;
      if (wasMiddleMouseDown && !this.dependencies.movementInput.isFpsMode()) {
        this.dependencies.camera.queueCameraYawSnapToNearest45();
      }
    } else if (event.button === 2) {
      // Right mouse button
      const wasRightMouseDown = this.isRightMouseDown;
      this.isRightMouseDown = false;
      if (
        wasRightMouseDown &&
        this.rightMouseCanOpenContextMenuOnRelease &&
        !this.rightMouseDragExceededDeadzone
      ) {
        const target = this.dependencies.pointerTargeting.resolveTileContextTargetFromClientCoordinates(
          this.rightMouseDownStartX,
          this.rightMouseDownStartY,
        );
        if (!target) {
          this.dependencies.tileContextActions.closeAnyTileContextMenu(false);
        } else {
          this.dependencies.tileContextActions.openNormalTileContextMenuAtTarget(
            target,
          );
        }
        event.preventDefault();
      }
      this.rightMouseCanOpenContextMenuOnRelease = false;
      this.rightMouseDragExceededDeadzone = false;
    }
  }
}
