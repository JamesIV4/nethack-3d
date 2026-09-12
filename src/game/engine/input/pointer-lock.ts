
import type { DirectionPrompts } from "../ui/direction-prompts";
import type { ExtendedCommands } from "../ui/extended-commands";
import type { FpsDiagnostics } from "../diagnostics/fps-diagnostics";
import type { MovementInput } from "./movement-input";
import type { PositionSelection } from "./position-selection";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { QuestionMenus } from "../ui/question-menus";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { TileContextActions } from "../ui/tile-context-actions";

export interface PointerLockDependencies {
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
  >;
  readonly extendedCommands: Pick<
    ExtendedCommands,
    "metaCommandModeActive"
  >;
  readonly fpsDiagnostics: Pick<
    FpsDiagnostics,
    "isFpsDebugDisplayInputFocused"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "cancelPositionInputMode"
    | "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "isAnyModalVisible"
    | "isInfoDialogOpen"
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
  readonly tileContextActions: Pick<
    TileContextActions,
    "clearVultureMouseHoverHighlight"
    | "fpsCrosshairContextMenuOpen"
  >;
}

/** FPS pointer lock lifecycle and UI gating. */
export class PointerLock {
  constructor(private readonly dependencies: PointerLockDependencies) {}

  fpsPointerLockActive: boolean = false;

  fpsPointerLockRestorePending: boolean = false;

  handlePointerLockChange(): void {
    const wasPointerLockActive = this.fpsPointerLockActive;
    this.fpsPointerLockActive =
      document.pointerLockElement === this.dependencies.renderPipeline.renderer.domElement;
    if (this.fpsPointerLockActive) {
      this.fpsPointerLockRestorePending = false;
      this.dependencies.tileContextActions.clearVultureMouseHoverHighlight();
    }
    if (
      wasPointerLockActive &&
      !this.fpsPointerLockActive &&
      this.dependencies.positionSelection.positionInputModeActive &&
      !this.isFpsPointerLockBlockedByUi()
    ) {
      this.dependencies.positionSelection.cancelPositionInputMode("pointer lock lost during active look mode");
      return;
    }
    this.syncFpsPointerLockForUiState(false);
  }

  isFpsPointerLockBlockedByUi(): boolean {
    const allowDirectionLook = this.dependencies.movementInput.isFpsMode() && this.dependencies.directionPrompts.isInDirectionQuestion;
    const modalBlocksPointerLock =
      this.dependencies.promptDialogs.isAnyModalVisible() &&
      !(allowDirectionLook && this.isOnlyDirectionDialogVisible());
    return (
      (this.dependencies.questionMenus.isInQuestion && !allowDirectionLook) ||
      (this.dependencies.directionPrompts.isInDirectionQuestion && !allowDirectionLook) ||
      this.dependencies.promptDialogs.isTextInputActive ||
      this.dependencies.fpsDiagnostics.isFpsDebugDisplayInputFocused() ||
      this.dependencies.extendedCommands.metaCommandModeActive ||
      this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen ||
      this.dependencies.promptDialogs.isInventoryDialogOpen() ||
      this.dependencies.promptDialogs.isInfoDialogOpen() ||
      modalBlocksPointerLock
    );
  }

  isOnlyDirectionDialogVisible(): boolean {
    return (
      this.dependencies.directionPrompts.isInDirectionQuestion &&
      !this.dependencies.questionMenus.isInQuestion &&
      !this.dependencies.promptDialogs.isTextInputActive &&
      !this.dependencies.positionSelection.positionInputModeActive &&
      !this.dependencies.extendedCommands.metaCommandModeActive &&
      !this.dependencies.promptDialogs.isInventoryDialogOpen() &&
      !this.dependencies.promptDialogs.isInfoDialogOpen()
    );
  }

  syncFpsPointerLockForUiState(tryAcquire: boolean): void {
    if (document.documentElement.classList.contains("nh3d-webxr-active")) return;
    if (!this.dependencies.movementInput.isFpsMode()) {
      return;
    }

    const isRendererLocked =
      document.pointerLockElement === this.dependencies.renderPipeline.renderer.domElement;
    if (this.isFpsPointerLockBlockedByUi()) {
      if (isRendererLocked || this.fpsPointerLockActive) {
        this.fpsPointerLockRestorePending = true;
      }
      if (isRendererLocked) {
        document.exitPointerLock?.();
      }
      this.fpsPointerLockActive = false;
      return;
    }

    if (
      (tryAcquire || this.fpsPointerLockRestorePending) &&
      !isRendererLocked &&
      !this.fpsPointerLockActive
    ) {
      this.fpsPointerLockRestorePending = false;
      this.dependencies.renderPipeline.renderer.domElement.requestPointerLock?.();
    }
  }
}
