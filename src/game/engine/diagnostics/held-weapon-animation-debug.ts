import * as THREE from "three";
import {
  FPS_HELD_WEAPON_MELEE_SWIPE_ANIMATION_ID,
  serializeFpsHeldWeaponAnimationDefinition,
  type FpsHeldWeaponAnimationDefinition,
  type FpsHeldWeaponAnimationKeyframe
} from "../../fps-held-weapon-animations";
import type {
  FpsHeldWeaponAnimationEditorAxis,
  FpsHeldWeaponAnimationEditorInputMap,
  FpsHeldWeaponAnimationEditorElements
} from "../shared/types";
import {
  FPS_HELD_WEAPON_ANIMATION_DEBUG_BASE_POSE_ID,
  FPS_HELD_WEAPON_ANIMATION_DEBUG_BASE_POSE_LABEL,
  serializeFpsHeldWeaponBasePoseDefinition,
  serializeFpsHeldWeaponTileFlipOverrides
} from "../shared/constants";
import type { EngineState } from "../runtime/engine-state";
import type { HeldWeapon } from "../rendering/held-weapon";
import type { MenuPreviews } from "../ui/menu-previews";
import type { MovementInput } from "../input/movement-input";

export interface HeldWeaponAnimationDebugDependencies {
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
    | "mountElement"
  >;
  readonly heldWeapon: Pick<
    HeldWeapon,
    "clearFpsHeldWeaponAnimationState"
    | "findHeldWeaponInventoryItem"
    | "fpsHeldWeaponAnimations"
    | "fpsHeldWeaponBasePose"
    | "fpsHeldWeaponTileFlipOverridesByTileset"
    | "getConfiguredFpsHeldWeaponAnimationDebugPreviewTileId"
    | "getFpsHeldWeaponAnimation"
    | "getFpsHeldWeaponTileFlipOverrideTilesetLabel"
    | "getFpsHeldWeaponTileFlipOverrideTilesetPath"
    | "playFpsHeldWeaponAnimation"
    | "resolveFpsHeldWeaponTileFlipState"
    | "resolveTilesetDefaultFpsHeldWeaponTileFlipState"
    | "setFpsHeldWeaponTileFlipOverride"
  >;
  readonly menuPreviews: Pick<
    MenuPreviews,
    "resolveNonNegativeMenuInteger"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
}

/** Held weapon animation editor panel, preview state and clipboard export. */
export class HeldWeaponAnimationDebug {
  constructor(private readonly dependencies: HeldWeaponAnimationDebugDependencies) {}

  fpsHeldWeaponAnimationDebugVisible: boolean = false;

  fpsHeldWeaponAnimationDebugSelectedAnimationId: string =
    FPS_HELD_WEAPON_MELEE_SWIPE_ANIMATION_ID;

  fpsHeldWeaponAnimationDebugSelectedKeyframeIndex: number = 0;

  fpsHeldWeaponAnimationDebugSlowMoEnabled: boolean = false;

  fpsHeldWeaponAnimationDebugPreviewSelectedKeyframe: boolean = true;

  fpsHeldWeaponAnimationDebugPreviewTileEnabled: boolean = false;

  fpsHeldWeaponAnimationDebugPreviewTileId: number = 0;

  readonly fpsHeldWeaponAnimationDebugElements: FpsHeldWeaponAnimationEditorElements =
    {
      panel: null,
      animationSelect: null,
      copyButton: null,
      weightInput: null,
      keyframeSelect: null,
      durationInput: null,
      slowMoCheckbox: null,
      previewKeyframeCheckbox: null,
      statusLabel: null,
      noteLabel: null,
      weightRow: null,
      previewRow: null,
      tilePreviewRow: null,
      tileFlipRow: null,
      keyframeRow: null,
      addRow: null,
      durationRow: null,
      basePositionSection: null,
      baseRotationSection: null,
      pivotSection: null,
      translationSection: null,
      rotationSection: null,
      tilePreviewEnabledCheckbox: null,
      tilePreviewTileIdInput: null,
      tilePreviewTilesetLabel: null,
      tileFlipXCheckbox: null,
      tileFlipYCheckbox: null,
      tileFlipDiagonalCheckbox: null,
      basePositionInputs: { x: null, y: null, z: null },
      baseRotationInputs: { x: null, y: null, z: null },
      pivotInputs: { x: null, y: null, z: null },
      translationInputs: { x: null, y: null, z: null },
      rotationInputs: { x: null, y: null, z: null },
    };

  handleFpsHeldWeaponAnimationDebugShortcutKeyDown(
    event: KeyboardEvent,
  ): boolean {
    if (event.metaKey) {
      return false;
    }
    if (!event.ctrlKey || !event.altKey || !event.shiftKey) {
      return false;
    }
    const isAKey =
      event.code === "KeyA" ||
      (typeof event.key === "string" && event.key.toLowerCase() === "a");
    if (!isAKey) {
      return false;
    }

    event.preventDefault();
    if (event.repeat) {
      return true;
    }
    this.setFpsHeldWeaponAnimationDebugVisible(
      !this.fpsHeldWeaponAnimationDebugVisible,
    );
    return true;
  }

  formatFpsHeldWeaponAnimationDebugNumber(
    value: number,
    decimals: number = 4,
  ): string {
    if (!Number.isFinite(value)) {
      return "0";
    }
    return Number(value.toFixed(decimals)).toString();
  }

  isFpsHeldWeaponAnimationDebugBasePoseSelected(): boolean {
    return (
      this.fpsHeldWeaponAnimationDebugSelectedAnimationId ===
      FPS_HELD_WEAPON_ANIMATION_DEBUG_BASE_POSE_ID
    );
  }

  getFpsHeldWeaponAnimationDebugSelectedAnimation(): FpsHeldWeaponAnimationDefinition | null {
    if (this.isFpsHeldWeaponAnimationDebugBasePoseSelected()) {
      return null;
    }
    const selected = this.dependencies.heldWeapon.getFpsHeldWeaponAnimation(
      this.fpsHeldWeaponAnimationDebugSelectedAnimationId,
    );
    if (selected) {
      return selected;
    }
    const fallback = Object.values(this.dependencies.heldWeapon.fpsHeldWeaponAnimations)[0] ?? null;
    if (!fallback) {
      return null;
    }
    this.fpsHeldWeaponAnimationDebugSelectedAnimationId = fallback.id;
    return fallback;
  }

  getFpsHeldWeaponAnimationDebugSelectedKeyframe(): FpsHeldWeaponAnimationKeyframe | null {
    const animation = this.getFpsHeldWeaponAnimationDebugSelectedAnimation();
    if (!animation || animation.keyframes.length <= 0) {
      return null;
    }
    this.fpsHeldWeaponAnimationDebugSelectedKeyframeIndex =
      THREE.MathUtils.clamp(
        this.fpsHeldWeaponAnimationDebugSelectedKeyframeIndex,
        0,
        animation.keyframes.length - 1,
      );
    return (
      animation.keyframes[
        this.fpsHeldWeaponAnimationDebugSelectedKeyframeIndex
      ] ?? null
    );
  }

  setFpsHeldWeaponAnimationDebugStatus(message: string): void {
    const statusLabel = this.fpsHeldWeaponAnimationDebugElements.statusLabel;
    if (statusLabel) {
      statusLabel.textContent = message;
    }
  }

  syncFpsHeldWeaponAnimationDebugAnimationOptions(): void {
    const select = this.fpsHeldWeaponAnimationDebugElements.animationSelect;
    if (!select) {
      return;
    }

    const animations = Object.values(this.dependencies.heldWeapon.fpsHeldWeaponAnimations).sort(
      (a, b) => a.label.localeCompare(b.label),
    );
    if (
      !this.isFpsHeldWeaponAnimationDebugBasePoseSelected() &&
      !this.dependencies.heldWeapon.fpsHeldWeaponAnimations[
        this.fpsHeldWeaponAnimationDebugSelectedAnimationId
      ]
    ) {
      this.fpsHeldWeaponAnimationDebugSelectedAnimationId =
        animations[0]?.id ?? FPS_HELD_WEAPON_ANIMATION_DEBUG_BASE_POSE_ID;
    }

    select.replaceChildren();
    const basePoseOption = document.createElement("option");
    basePoseOption.value = FPS_HELD_WEAPON_ANIMATION_DEBUG_BASE_POSE_ID;
    basePoseOption.textContent =
      FPS_HELD_WEAPON_ANIMATION_DEBUG_BASE_POSE_LABEL;
    select.appendChild(basePoseOption);
    for (const animation of animations) {
      const option = document.createElement("option");
      option.value = animation.id;
      option.textContent = animation.label;
      select.appendChild(option);
    }
    select.value = this.fpsHeldWeaponAnimationDebugSelectedAnimationId;
  }

  syncFpsHeldWeaponAnimationDebugKeyframeOptions(): void {
    const select = this.fpsHeldWeaponAnimationDebugElements.keyframeSelect;
    if (!select) {
      return;
    }

    const animation = this.getFpsHeldWeaponAnimationDebugSelectedAnimation();
    select.replaceChildren();
    if (!animation || animation.keyframes.length <= 0) {
      select.disabled = true;
      return;
    }
    select.disabled = false;
    this.fpsHeldWeaponAnimationDebugSelectedKeyframeIndex =
      THREE.MathUtils.clamp(
        this.fpsHeldWeaponAnimationDebugSelectedKeyframeIndex,
        0,
        animation.keyframes.length - 1,
      );

    animation.keyframes.forEach((keyframe, index) => {
      const option = document.createElement("option");
      option.value = `${index}`;
      option.textContent = `Keyframe ${index + 1} (${Math.max(
        1,
        Math.round(keyframe.durationMs),
      )} ms)`;
      select.appendChild(option);
    });
    select.value = `${this.fpsHeldWeaponAnimationDebugSelectedKeyframeIndex}`;
  }

  countFpsHeldWeaponTileFlipOverrides(): number {
    let count = 0;
    for (const overridesByTileId of Object.values(
      this.dependencies.heldWeapon.fpsHeldWeaponTileFlipOverridesByTileset,
    )) {
      count += Object.keys(overridesByTileId).length;
    }
    return count;
  }

  countFpsHeldWeaponTileFlipOverridesForTileset(
    tilesetPath: string,
  ): number {
    if (!tilesetPath) {
      return 0;
    }
    return Object.keys(
      this.dependencies.heldWeapon.fpsHeldWeaponTileFlipOverridesByTileset[tilesetPath] ?? {},
    ).length;
  }

  syncFpsHeldWeaponAnimationDebugFieldValues(): void {
    const basePoseSelected =
      this.isFpsHeldWeaponAnimationDebugBasePoseSelected();
    const animation = this.getFpsHeldWeaponAnimationDebugSelectedAnimation();
    const keyframe = this.getFpsHeldWeaponAnimationDebugSelectedKeyframe();
    const basePose = this.dependencies.heldWeapon.fpsHeldWeaponBasePose;

    const previewKeyframeCheckbox =
      this.fpsHeldWeaponAnimationDebugElements.previewKeyframeCheckbox;
    if (previewKeyframeCheckbox) {
      previewKeyframeCheckbox.checked =
        this.fpsHeldWeaponAnimationDebugPreviewSelectedKeyframe;
    }
    const tilePreviewEnabledCheckbox =
      this.fpsHeldWeaponAnimationDebugElements.tilePreviewEnabledCheckbox;
    if (tilePreviewEnabledCheckbox) {
      tilePreviewEnabledCheckbox.checked =
        this.fpsHeldWeaponAnimationDebugPreviewTileEnabled;
    }
    const tilePreviewTileIdInput =
      this.fpsHeldWeaponAnimationDebugElements.tilePreviewTileIdInput;
    if (tilePreviewTileIdInput) {
      tilePreviewTileIdInput.value = `${Math.max(
        0,
        Math.trunc(this.fpsHeldWeaponAnimationDebugPreviewTileId),
      )}`;
      tilePreviewTileIdInput.disabled =
        !this.fpsHeldWeaponAnimationDebugPreviewTileEnabled ||
        this.dependencies.engineState.clientOptions.tilesetMode !== "tiles";
    }
    const previewTileId =
      this.dependencies.heldWeapon.getConfiguredFpsHeldWeaponAnimationDebugPreviewTileId();
    const canEditTileFlip =
      this.dependencies.engineState.clientOptions.tilesetMode === "tiles" && previewTileId !== null;
    const tileFlipState =
      previewTileId !== null
        ? this.dependencies.heldWeapon.resolveFpsHeldWeaponTileFlipState(previewTileId)
        : this.dependencies.heldWeapon.resolveTilesetDefaultFpsHeldWeaponTileFlipState(
            this.dependencies.heldWeapon.getFpsHeldWeaponTileFlipOverrideTilesetPath(),
          );
    const tileFlipXCheckbox =
      this.fpsHeldWeaponAnimationDebugElements.tileFlipXCheckbox;
    if (tileFlipXCheckbox) {
      tileFlipXCheckbox.checked = tileFlipState.flipX;
      tileFlipXCheckbox.disabled = !canEditTileFlip;
    }
    const tileFlipYCheckbox =
      this.fpsHeldWeaponAnimationDebugElements.tileFlipYCheckbox;
    if (tileFlipYCheckbox) {
      tileFlipYCheckbox.checked = tileFlipState.flipY;
      tileFlipYCheckbox.disabled = !canEditTileFlip;
    }
    const tileFlipDiagonalCheckbox =
      this.fpsHeldWeaponAnimationDebugElements.tileFlipDiagonalCheckbox;
    if (tileFlipDiagonalCheckbox) {
      tileFlipDiagonalCheckbox.checked = tileFlipState.flipDiagonal;
      tileFlipDiagonalCheckbox.disabled = !canEditTileFlip;
    }
    const tilePreviewTilesetLabel =
      this.fpsHeldWeaponAnimationDebugElements.tilePreviewTilesetLabel;
    if (tilePreviewTilesetLabel) {
      const tilesetPath = this.dependencies.heldWeapon.getFpsHeldWeaponTileFlipOverrideTilesetPath();
      if (this.dependencies.engineState.clientOptions.tilesetMode !== "tiles") {
        tilePreviewTilesetLabel.textContent =
          "Tiles mode is required for held-weapon tile preview.";
      } else if (!tilesetPath) {
        tilePreviewTilesetLabel.textContent =
          "No tileset is selected for held-weapon tile overrides.";
      } else {
        const overrideCount =
          this.countFpsHeldWeaponTileFlipOverridesForTileset(tilesetPath);
        const defaultState =
          this.dependencies.heldWeapon.resolveTilesetDefaultFpsHeldWeaponTileFlipState(tilesetPath);
        tilePreviewTilesetLabel.textContent = `Tileset: ${this.dependencies.heldWeapon.getFpsHeldWeaponTileFlipOverrideTilesetLabel()} | Default X/Y/D: ${
          defaultState.flipX ? "on" : "off"
        }/${defaultState.flipY ? "on" : "off"}/${defaultState.flipDiagonal ? "on" : "off"} | Session Overrides: ${overrideCount}`;
        tilePreviewTilesetLabel.title = tilesetPath;
      }
    }
    for (const axis of ["x", "y", "z"] as const) {
      const basePositionInput =
        this.fpsHeldWeaponAnimationDebugElements.basePositionInputs[axis];
      if (basePositionInput) {
        basePositionInput.value = this.formatFpsHeldWeaponAnimationDebugNumber(
          basePose.position[axis],
        );
      }
      const baseRotationInput =
        this.fpsHeldWeaponAnimationDebugElements.baseRotationInputs[axis];
      if (baseRotationInput) {
        baseRotationInput.value = this.formatFpsHeldWeaponAnimationDebugNumber(
          basePose.rotationDeg[axis],
        );
      }
    }
    const slowMoCheckbox =
      this.fpsHeldWeaponAnimationDebugElements.slowMoCheckbox;
    if (slowMoCheckbox) {
      slowMoCheckbox.checked = this.fpsHeldWeaponAnimationDebugSlowMoEnabled;
    }
    if (!animation || !keyframe) {
      const weightInput = this.fpsHeldWeaponAnimationDebugElements.weightInput;
      if (weightInput && basePoseSelected) {
        weightInput.value = "1";
      }
      const durationInput =
        this.fpsHeldWeaponAnimationDebugElements.durationInput;
      if (durationInput && basePoseSelected) {
        durationInput.value = "";
      }
      return;
    }

    const weightInput = this.fpsHeldWeaponAnimationDebugElements.weightInput;
    if (weightInput) {
      weightInput.value = this.formatFpsHeldWeaponAnimationDebugNumber(
        animation.weight,
      );
    }
    const durationInput =
      this.fpsHeldWeaponAnimationDebugElements.durationInput;
    if (durationInput) {
      durationInput.value = `${Math.max(1, Math.round(keyframe.durationMs))}`;
    }
    for (const axis of ["x", "y", "z"] as const) {
      const pivotInput =
        this.fpsHeldWeaponAnimationDebugElements.pivotInputs[axis];
      if (pivotInput) {
        pivotInput.value = this.formatFpsHeldWeaponAnimationDebugNumber(
          animation.pivotNormalized[axis],
        );
      }
      const translationInput =
        this.fpsHeldWeaponAnimationDebugElements.translationInputs[axis];
      if (translationInput) {
        translationInput.value = this.formatFpsHeldWeaponAnimationDebugNumber(
          keyframe.translation[axis],
        );
      }
      const rotationInput =
        this.fpsHeldWeaponAnimationDebugElements.rotationInputs[axis];
      if (rotationInput) {
        rotationInput.value = this.formatFpsHeldWeaponAnimationDebugNumber(
          keyframe.rotationDeg[axis],
        );
      }
    }
  }

  syncFpsHeldWeaponAnimationDebugLayout(): void {
    const basePoseSelected =
      this.isFpsHeldWeaponAnimationDebugBasePoseSelected();
    const tilePreviewEnabled =
      this.fpsHeldWeaponAnimationDebugPreviewTileEnabled;
    const { copyButton, noteLabel } = this.fpsHeldWeaponAnimationDebugElements;
    if (copyButton) {
      copyButton.textContent = tilePreviewEnabled
        ? "Copy Tile Flips"
        : basePoseSelected
          ? "Copy Offset"
          : "Copy Animation";
    }
    if (noteLabel) {
      noteLabel.textContent = tilePreviewEnabled
        ? "Preview Tile shows any tile id as the held weapon. Flip X, Flip Y, and Diagonal edit per-tileset per-tile overrides, and Copy Tile Flips exports every adjusted override from this session."
        : basePoseSelected
          ? "Weapon idle offset is added on top of the original hidden baseline pose and used for the resting pose."
          : "Weight affects random selection. Duration is the time from the previous keyframe into the current one.";
    }
    const setDisplay = (
      element: HTMLElement | null,
      visible: boolean,
      displayValue: string,
    ): void => {
      if (element) {
        element.style.display = visible ? displayValue : "none";
      }
    };
    setDisplay(
      this.fpsHeldWeaponAnimationDebugElements.weightRow,
      !basePoseSelected,
      "grid",
    );
    setDisplay(
      this.fpsHeldWeaponAnimationDebugElements.previewRow,
      !basePoseSelected,
      "grid",
    );
    setDisplay(
      this.fpsHeldWeaponAnimationDebugElements.keyframeRow,
      !basePoseSelected,
      "grid",
    );
    setDisplay(
      this.fpsHeldWeaponAnimationDebugElements.addRow,
      !basePoseSelected,
      "grid",
    );
    setDisplay(
      this.fpsHeldWeaponAnimationDebugElements.durationRow,
      !basePoseSelected,
      "grid",
    );
    setDisplay(
      this.fpsHeldWeaponAnimationDebugElements.basePositionSection,
      basePoseSelected,
      "block",
    );
    setDisplay(
      this.fpsHeldWeaponAnimationDebugElements.baseRotationSection,
      basePoseSelected,
      "block",
    );
    setDisplay(
      this.fpsHeldWeaponAnimationDebugElements.pivotSection,
      !basePoseSelected,
      "block",
    );
    setDisplay(
      this.fpsHeldWeaponAnimationDebugElements.translationSection,
      !basePoseSelected,
      "block",
    );
    setDisplay(
      this.fpsHeldWeaponAnimationDebugElements.rotationSection,
      !basePoseSelected,
      "block",
    );
  }

  syncFpsHeldWeaponAnimationDebugUi(): void {
    this.syncFpsHeldWeaponAnimationDebugAnimationOptions();
    this.syncFpsHeldWeaponAnimationDebugKeyframeOptions();
    this.syncFpsHeldWeaponAnimationDebugFieldValues();
    this.syncFpsHeldWeaponAnimationDebugLayout();
  }

  getVisibleMessageLogBounds(): DOMRect | null {
    if (typeof document === "undefined") {
      return null;
    }

    const candidates = [
      document.querySelector(".top-left-ui.with-stats"),
      document.querySelector(".top-left-ui"),
      document.querySelector(
        ".nh3d-mobile-log:not(.nh3d-mobile-log-collapsed)",
      ),
    ];

    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) {
        continue;
      }
      const computedStyle = window.getComputedStyle(candidate);
      if (
        computedStyle.display === "none" ||
        computedStyle.visibility === "hidden" ||
        computedStyle.pointerEvents === "none"
      ) {
        continue;
      }
      const rect = candidate.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }
      return rect;
    }

    return null;
  }

  syncFpsHeldWeaponAnimationDebugPanelPosition(): void {
    const panel = this.fpsHeldWeaponAnimationDebugElements.panel;
    if (!panel) {
      return;
    }

    const defaultTopPx = 72;
    const viewportHeight = Math.max(1, window.innerHeight);
    const gapPx = 12;
    const messageLogBounds = this.getVisibleMessageLogBounds();
    const topPx = messageLogBounds
      ? Math.max(defaultTopPx, Math.round(messageLogBounds.bottom + gapPx))
      : defaultTopPx;
    const availableHeightPx = Math.max(160, viewportHeight - topPx - gapPx);

    panel.style.top = `${topPx}px`;
    panel.style.left = `${gapPx}px`;
    panel.style.right = "auto";
    panel.style.maxHeight = `${availableHeightPx}px`;
    panel.style.overflowY = "auto";
  }

  async copyFpsHeldWeaponAnimationDebugTextToClipboard(
    payload: string,
    successMessage: string,
  ): Promise<void> {
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(payload);
        this.setFpsHeldWeaponAnimationDebugStatus(successMessage);
        return;
      }
    } catch (_error) {
      // Fallback to textarea copy path below.
    }

    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = payload;
      textarea.style.position = "fixed";
      textarea.style.left = "-10000px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (copied) {
        this.setFpsHeldWeaponAnimationDebugStatus(successMessage);
      } else {
        this.setFpsHeldWeaponAnimationDebugStatus(
          "Copy failed. Open console and copy manually.",
        );
        console.log(payload);
      }
      return;
    }

    this.setFpsHeldWeaponAnimationDebugStatus(
      "Copy unavailable. Open console and copy manually.",
    );
    console.log(payload);
  }

  async copyFpsHeldWeaponAnimationDebugSelectionToClipboard(): Promise<void> {
    if (this.fpsHeldWeaponAnimationDebugPreviewTileEnabled) {
      const overrideCount = this.countFpsHeldWeaponTileFlipOverrides();
      if (overrideCount <= 0) {
        this.setFpsHeldWeaponAnimationDebugStatus(
          "No held-weapon tile flip overrides have been adjusted yet.",
        );
        return;
      }
      await this.copyFpsHeldWeaponAnimationDebugTextToClipboard(
        serializeFpsHeldWeaponTileFlipOverrides(
          this.dependencies.heldWeapon.fpsHeldWeaponTileFlipOverridesByTileset,
        ),
        `Copied ${overrideCount} held-weapon tile flip override${
          overrideCount === 1 ? "" : "s"
        } to clipboard.`,
      );
      return;
    }

    if (this.isFpsHeldWeaponAnimationDebugBasePoseSelected()) {
      const payload = serializeFpsHeldWeaponBasePoseDefinition(
        this.dependencies.heldWeapon.fpsHeldWeaponBasePose,
      );
      await this.copyFpsHeldWeaponAnimationDebugTextToClipboard(
        payload,
        "Copied weapon idle offset to clipboard.",
      );
      return;
    }

    const animation = this.getFpsHeldWeaponAnimationDebugSelectedAnimation();
    if (!animation) {
      this.setFpsHeldWeaponAnimationDebugStatus("No animation selected.");
      return;
    }

    const payload = serializeFpsHeldWeaponAnimationDefinition(animation);
    await this.copyFpsHeldWeaponAnimationDebugTextToClipboard(
      payload,
      `Copied ${animation.label} to clipboard.`,
    );
  }

  previewSelectedFpsHeldWeaponAnimation(): void {
    if (this.isFpsHeldWeaponAnimationDebugBasePoseSelected()) {
      this.dependencies.heldWeapon.clearFpsHeldWeaponAnimationState();
      this.setFpsHeldWeaponAnimationDebugStatus(
        "Weapon idle offset does not use animation playback.",
      );
      return;
    }
    const animation = this.getFpsHeldWeaponAnimationDebugSelectedAnimation();
    if (!animation) {
      this.setFpsHeldWeaponAnimationDebugStatus("No animation selected.");
      return;
    }
    if (!this.dependencies.movementInput.isFpsMode()) {
      this.setFpsHeldWeaponAnimationDebugStatus(
        "Enter FPS mode to preview held-weapon animations.",
      );
      return;
    }
    const didStart = this.dependencies.heldWeapon.playFpsHeldWeaponAnimation(animation.id, {
      durationScale: this.fpsHeldWeaponAnimationDebugSlowMoEnabled ? 5 : 1,
    });
    this.setFpsHeldWeaponAnimationDebugStatus(
      didStart
        ? `Previewing ${animation.label}.`
        : `Unable to preview ${animation.label}.`,
    );
  }

  cloneFpsHeldWeaponAnimationKeyframe(
    keyframe: FpsHeldWeaponAnimationKeyframe,
  ): FpsHeldWeaponAnimationKeyframe {
    return {
      durationMs: Math.max(1, Math.round(keyframe.durationMs)),
      translation: {
        x: keyframe.translation.x,
        y: keyframe.translation.y,
        z: keyframe.translation.z,
      },
      rotationDeg: {
        x: keyframe.rotationDeg.x,
        y: keyframe.rotationDeg.y,
        z: keyframe.rotationDeg.z,
      },
      ...(keyframe.soundEffect
        ? {
            soundEffect: keyframe.soundEffect,
          }
        : {}),
    };
  }

  insertFpsHeldWeaponAnimationDebugKeyframe(
    position: "before" | "after",
  ): void {
    if (this.isFpsHeldWeaponAnimationDebugBasePoseSelected()) {
      this.setFpsHeldWeaponAnimationDebugStatus(
        "Weapon idle offset does not use keyframes.",
      );
      return;
    }
    const animation = this.getFpsHeldWeaponAnimationDebugSelectedAnimation();
    const keyframe = this.getFpsHeldWeaponAnimationDebugSelectedKeyframe();
    if (!animation || !keyframe) {
      this.setFpsHeldWeaponAnimationDebugStatus("No keyframe selected.");
      return;
    }

    const insertIndex =
      position === "before"
        ? this.fpsHeldWeaponAnimationDebugSelectedKeyframeIndex
        : this.fpsHeldWeaponAnimationDebugSelectedKeyframeIndex + 1;
    animation.keyframes.splice(
      insertIndex,
      0,
      this.cloneFpsHeldWeaponAnimationKeyframe(keyframe),
    );
    this.fpsHeldWeaponAnimationDebugSelectedKeyframeIndex = insertIndex;
    this.syncFpsHeldWeaponAnimationDebugUi();
    this.setFpsHeldWeaponAnimationDebugStatus(
      `Added keyframe ${position} ${insertIndex + 1}.`,
    );
  }

  ensureFpsHeldWeaponAnimationDebugPanel(): HTMLDivElement {
    const existingPanel = this.fpsHeldWeaponAnimationDebugElements.panel;
    if (existingPanel) {
      return existingPanel;
    }

    const host = this.dependencies.engineState.mountElement ?? document.body;
    const panel = document.createElement("div");
    panel.className = "nh3d-fps-held-weapon-animation-debug";
    panel.style.position = "fixed";
    panel.style.top = "72px";
    panel.style.left = "12px";
    panel.style.right = "auto";
    panel.style.zIndex = "2147483647";
    panel.style.width = "344px";
    panel.style.padding = "10px";
    panel.style.border = "1px solid rgba(196, 255, 208, 0.4)";
    panel.style.borderRadius = "8px";
    panel.style.background = "rgba(2, 10, 8, 0.94)";
    panel.style.boxShadow = "0 10px 28px rgba(0, 0, 0, 0.35)";
    panel.style.color = "#ecfff0";
    panel.style.font = "12px monospace";
    panel.style.lineHeight = "1.3";
    panel.style.userSelect = "none";
    panel.style.pointerEvents = "auto";
    panel.style.display = "none";

    const headerRow = document.createElement("div");
    headerRow.style.display = "flex";
    headerRow.style.justifyContent = "space-between";
    headerRow.style.alignItems = "flex-start";
    headerRow.style.gap = "8px";
    headerRow.style.marginBottom = "8px";

    const title = document.createElement("div");
    title.textContent = "Weapon Animation";
    title.style.fontWeight = "700";
    headerRow.appendChild(title);

    const headerActions = document.createElement("div");
    headerActions.style.display = "flex";
    headerActions.style.flexWrap = "wrap";
    headerActions.style.justifyContent = "flex-end";
    headerActions.style.gap = "6px";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Copy Animation";
    copyButton.style.font = "11px monospace";
    copyButton.style.padding = "3px 6px";
    copyButton.addEventListener("click", () => {
      void this.copyFpsHeldWeaponAnimationDebugSelectionToClipboard();
    });
    headerActions.appendChild(copyButton);
    this.fpsHeldWeaponAnimationDebugElements.copyButton = copyButton;

    headerRow.appendChild(headerActions);
    panel.appendChild(headerRow);

    const createRow = (labelText: string): HTMLDivElement => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "112px minmax(0, 1fr)";
      row.style.columnGap = "8px";
      row.style.alignItems = "center";
      row.style.marginBottom = "8px";

      const label = document.createElement("div");
      label.textContent = labelText;
      row.appendChild(label);
      panel.appendChild(row);
      return row;
    };

    const animationRow = createRow("Animation");
    const animationSelect = document.createElement("select");
    animationSelect.style.font = "11px monospace";
    animationSelect.style.padding = "2px 4px";
    animationSelect.addEventListener("change", () => {
      this.fpsHeldWeaponAnimationDebugSelectedAnimationId =
        animationSelect.value;
      this.fpsHeldWeaponAnimationDebugSelectedKeyframeIndex = 0;
      if (this.isFpsHeldWeaponAnimationDebugBasePoseSelected()) {
        this.dependencies.heldWeapon.clearFpsHeldWeaponAnimationState();
      }
      this.syncFpsHeldWeaponAnimationDebugUi();
      this.setFpsHeldWeaponAnimationDebugStatus("");
    });
    animationRow.appendChild(animationSelect);
    this.fpsHeldWeaponAnimationDebugElements.animationSelect = animationSelect;

    const weightRow = createRow("Weight");
    this.fpsHeldWeaponAnimationDebugElements.weightRow = weightRow;
    const weightInput = document.createElement("input");
    weightInput.type = "number";
    weightInput.step = "0.05";
    weightInput.min = "0";
    weightInput.style.font = "11px monospace";
    weightInput.style.padding = "2px 4px";
    weightInput.addEventListener("input", () => {
      const animation = this.getFpsHeldWeaponAnimationDebugSelectedAnimation();
      const parsed = Number.parseFloat(weightInput.value);
      if (!animation || !Number.isFinite(parsed)) {
        return;
      }
      animation.weight = Math.max(0, parsed);
    });
    weightInput.addEventListener("change", () => {
      const animation = this.getFpsHeldWeaponAnimationDebugSelectedAnimation();
      const parsed = Number.parseFloat(weightInput.value);
      if (animation && Number.isFinite(parsed)) {
        animation.weight = Math.max(0, parsed);
      }
      this.syncFpsHeldWeaponAnimationDebugFieldValues();
    });
    weightInput.addEventListener("blur", () => {
      this.syncFpsHeldWeaponAnimationDebugFieldValues();
    });
    weightRow.appendChild(weightInput);
    this.fpsHeldWeaponAnimationDebugElements.weightInput = weightInput;

    const previewRow = createRow("Preview");
    this.fpsHeldWeaponAnimationDebugElements.previewRow = previewRow;
    const previewControls = document.createElement("div");
    previewControls.style.display = "flex";
    previewControls.style.alignItems = "center";
    previewControls.style.gap = "8px";

    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.textContent = "Play";
    playButton.style.font = "11px monospace";
    playButton.style.padding = "3px 8px";
    playButton.addEventListener("click", () => {
      this.previewSelectedFpsHeldWeaponAnimation();
    });
    previewControls.appendChild(playButton);

    const slowMoLabel = document.createElement("label");
    slowMoLabel.style.display = "inline-flex";
    slowMoLabel.style.alignItems = "center";
    slowMoLabel.style.gap = "6px";
    slowMoLabel.style.cursor = "pointer";

    const slowMoCheckbox = document.createElement("input");
    slowMoCheckbox.type = "checkbox";
    slowMoCheckbox.checked = this.fpsHeldWeaponAnimationDebugSlowMoEnabled;
    slowMoCheckbox.addEventListener("change", () => {
      this.fpsHeldWeaponAnimationDebugSlowMoEnabled = slowMoCheckbox.checked;
    });
    slowMoLabel.appendChild(slowMoCheckbox);

    const slowMoText = document.createElement("span");
    slowMoText.textContent = "Slo-mo 5x";
    slowMoLabel.appendChild(slowMoText);
    previewControls.appendChild(slowMoLabel);

    const previewKeyframeLabel = document.createElement("label");
    previewKeyframeLabel.style.display = "inline-flex";
    previewKeyframeLabel.style.alignItems = "center";
    previewKeyframeLabel.style.gap = "6px";
    previewKeyframeLabel.style.cursor = "pointer";

    const previewKeyframeCheckbox = document.createElement("input");
    previewKeyframeCheckbox.type = "checkbox";
    previewKeyframeCheckbox.checked =
      this.fpsHeldWeaponAnimationDebugPreviewSelectedKeyframe;
    previewKeyframeCheckbox.addEventListener("change", () => {
      this.fpsHeldWeaponAnimationDebugPreviewSelectedKeyframe =
        previewKeyframeCheckbox.checked;
    });
    previewKeyframeLabel.appendChild(previewKeyframeCheckbox);

    const previewKeyframeText = document.createElement("span");
    previewKeyframeText.textContent = "Show Keyframe";
    previewKeyframeLabel.appendChild(previewKeyframeText);
    previewControls.appendChild(previewKeyframeLabel);

    previewRow.appendChild(previewControls);
    this.fpsHeldWeaponAnimationDebugElements.slowMoCheckbox = slowMoCheckbox;
    this.fpsHeldWeaponAnimationDebugElements.previewKeyframeCheckbox =
      previewKeyframeCheckbox;

    const tilePreviewRow = createRow("Preview Tile");
    this.fpsHeldWeaponAnimationDebugElements.tilePreviewRow = tilePreviewRow;
    const tilePreviewControls = document.createElement("div");
    tilePreviewControls.style.display = "grid";
    tilePreviewControls.style.rowGap = "6px";

    const tilePreviewTopRow = document.createElement("div");
    tilePreviewTopRow.style.display = "flex";
    tilePreviewTopRow.style.alignItems = "center";
    tilePreviewTopRow.style.gap = "8px";
    tilePreviewTopRow.style.flexWrap = "wrap";

    const tilePreviewEnabledLabel = document.createElement("label");
    tilePreviewEnabledLabel.style.display = "inline-flex";
    tilePreviewEnabledLabel.style.alignItems = "center";
    tilePreviewEnabledLabel.style.gap = "6px";
    tilePreviewEnabledLabel.style.cursor = "pointer";

    const tilePreviewEnabledCheckbox = document.createElement("input");
    tilePreviewEnabledCheckbox.type = "checkbox";
    tilePreviewEnabledCheckbox.checked =
      this.fpsHeldWeaponAnimationDebugPreviewTileEnabled;
    tilePreviewEnabledCheckbox.addEventListener("change", () => {
      this.fpsHeldWeaponAnimationDebugPreviewTileEnabled =
        tilePreviewEnabledCheckbox.checked;
      if (this.fpsHeldWeaponAnimationDebugPreviewTileEnabled) {
        const heldWeaponTileId = this.dependencies.menuPreviews.resolveNonNegativeMenuInteger(
          this.dependencies.heldWeapon.findHeldWeaponInventoryItem()?.tileIndex,
        );
        if (
          heldWeaponTileId !== null &&
          this.fpsHeldWeaponAnimationDebugPreviewTileId <= 0
        ) {
          this.fpsHeldWeaponAnimationDebugPreviewTileId = heldWeaponTileId;
        }
      }
      this.syncFpsHeldWeaponAnimationDebugUi();
      this.setFpsHeldWeaponAnimationDebugStatus("");
    });
    tilePreviewEnabledLabel.appendChild(tilePreviewEnabledCheckbox);

    const tilePreviewEnabledText = document.createElement("span");
    tilePreviewEnabledText.textContent = "Use Tile ID";
    tilePreviewEnabledLabel.appendChild(tilePreviewEnabledText);
    tilePreviewTopRow.appendChild(tilePreviewEnabledLabel);

    const tilePreviewTileIdInput = document.createElement("input");
    tilePreviewTileIdInput.type = "number";
    tilePreviewTileIdInput.step = "1";
    tilePreviewTileIdInput.min = "0";
    tilePreviewTileIdInput.style.font = "11px monospace";
    tilePreviewTileIdInput.style.padding = "2px 4px";
    tilePreviewTileIdInput.style.width = "96px";
    tilePreviewTileIdInput.addEventListener("input", () => {
      const parsed = Number.parseInt(tilePreviewTileIdInput.value, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return;
      }
      this.fpsHeldWeaponAnimationDebugPreviewTileId = Math.trunc(parsed);
      this.syncFpsHeldWeaponAnimationDebugFieldValues();
      this.setFpsHeldWeaponAnimationDebugStatus("");
    });
    tilePreviewTileIdInput.addEventListener("change", () => {
      const parsed = Number.parseInt(tilePreviewTileIdInput.value, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        this.fpsHeldWeaponAnimationDebugPreviewTileId = Math.trunc(parsed);
      }
      this.syncFpsHeldWeaponAnimationDebugUi();
    });
    tilePreviewTileIdInput.addEventListener("blur", () => {
      this.syncFpsHeldWeaponAnimationDebugUi();
    });
    tilePreviewTopRow.appendChild(tilePreviewTileIdInput);
    tilePreviewControls.appendChild(tilePreviewTopRow);

    const tilePreviewTilesetLabel = document.createElement("div");
    tilePreviewTilesetLabel.style.opacity = "0.72";
    tilePreviewTilesetLabel.style.fontSize = "11px";
    tilePreviewControls.appendChild(tilePreviewTilesetLabel);
    tilePreviewRow.appendChild(tilePreviewControls);
    this.fpsHeldWeaponAnimationDebugElements.tilePreviewEnabledCheckbox =
      tilePreviewEnabledCheckbox;
    this.fpsHeldWeaponAnimationDebugElements.tilePreviewTileIdInput =
      tilePreviewTileIdInput;
    this.fpsHeldWeaponAnimationDebugElements.tilePreviewTilesetLabel =
      tilePreviewTilesetLabel;

    const tileFlipRow = createRow("Tile Flips");
    this.fpsHeldWeaponAnimationDebugElements.tileFlipRow = tileFlipRow;
    const tileFlipControls = document.createElement("div");
    tileFlipControls.style.display = "flex";
    tileFlipControls.style.alignItems = "center";
    tileFlipControls.style.gap = "12px";
    tileFlipControls.style.flexWrap = "wrap";

    const tileFlipXLabel = document.createElement("label");
    tileFlipXLabel.style.display = "inline-flex";
    tileFlipXLabel.style.alignItems = "center";
    tileFlipXLabel.style.gap = "6px";
    tileFlipXLabel.style.cursor = "pointer";
    const tileFlipXCheckbox = document.createElement("input");
    tileFlipXCheckbox.type = "checkbox";
    tileFlipXCheckbox.addEventListener("change", () => {
      const previewTileId =
        this.dependencies.heldWeapon.getConfiguredFpsHeldWeaponAnimationDebugPreviewTileId();
      if (previewTileId === null) {
        return;
      }
      const currentState =
        this.dependencies.heldWeapon.resolveFpsHeldWeaponTileFlipState(previewTileId);
      this.dependencies.heldWeapon.setFpsHeldWeaponTileFlipOverride(previewTileId, {
        flipX: tileFlipXCheckbox.checked,
        flipY: currentState.flipY,
        flipDiagonal: currentState.flipDiagonal,
      });
      this.syncFpsHeldWeaponAnimationDebugFieldValues();
      this.setFpsHeldWeaponAnimationDebugStatus("");
    });
    tileFlipXLabel.appendChild(tileFlipXCheckbox);
    const tileFlipXText = document.createElement("span");
    tileFlipXText.textContent = "Flip X";
    tileFlipXLabel.appendChild(tileFlipXText);
    tileFlipControls.appendChild(tileFlipXLabel);

    const tileFlipYLabel = document.createElement("label");
    tileFlipYLabel.style.display = "inline-flex";
    tileFlipYLabel.style.alignItems = "center";
    tileFlipYLabel.style.gap = "6px";
    tileFlipYLabel.style.cursor = "pointer";
    const tileFlipYCheckbox = document.createElement("input");
    tileFlipYCheckbox.type = "checkbox";
    tileFlipYCheckbox.addEventListener("change", () => {
      const previewTileId =
        this.dependencies.heldWeapon.getConfiguredFpsHeldWeaponAnimationDebugPreviewTileId();
      if (previewTileId === null) {
        return;
      }
      const currentState =
        this.dependencies.heldWeapon.resolveFpsHeldWeaponTileFlipState(previewTileId);
      this.dependencies.heldWeapon.setFpsHeldWeaponTileFlipOverride(previewTileId, {
        flipX: currentState.flipX,
        flipY: tileFlipYCheckbox.checked,
        flipDiagonal: currentState.flipDiagonal,
      });
      this.syncFpsHeldWeaponAnimationDebugFieldValues();
      this.setFpsHeldWeaponAnimationDebugStatus("");
    });
    tileFlipYLabel.appendChild(tileFlipYCheckbox);
    const tileFlipYText = document.createElement("span");
    tileFlipYText.textContent = "Flip Y";
    tileFlipYLabel.appendChild(tileFlipYText);
    tileFlipControls.appendChild(tileFlipYLabel);

    const tileFlipDiagonalLabel = document.createElement("label");
    tileFlipDiagonalLabel.style.display = "inline-flex";
    tileFlipDiagonalLabel.style.alignItems = "center";
    tileFlipDiagonalLabel.style.gap = "6px";
    tileFlipDiagonalLabel.style.cursor = "pointer";
    const tileFlipDiagonalCheckbox = document.createElement("input");
    tileFlipDiagonalCheckbox.type = "checkbox";
    tileFlipDiagonalCheckbox.addEventListener("change", () => {
      const previewTileId =
        this.dependencies.heldWeapon.getConfiguredFpsHeldWeaponAnimationDebugPreviewTileId();
      if (previewTileId === null) {
        return;
      }
      const currentState =
        this.dependencies.heldWeapon.resolveFpsHeldWeaponTileFlipState(previewTileId);
      this.dependencies.heldWeapon.setFpsHeldWeaponTileFlipOverride(previewTileId, {
        flipX: currentState.flipX,
        flipY: currentState.flipY,
        flipDiagonal: tileFlipDiagonalCheckbox.checked,
      });
      this.syncFpsHeldWeaponAnimationDebugFieldValues();
      this.setFpsHeldWeaponAnimationDebugStatus("");
    });
    tileFlipDiagonalLabel.appendChild(tileFlipDiagonalCheckbox);
    const tileFlipDiagonalText = document.createElement("span");
    tileFlipDiagonalText.textContent = "Diagonal";
    tileFlipDiagonalLabel.appendChild(tileFlipDiagonalText);
    tileFlipControls.appendChild(tileFlipDiagonalLabel);

    tileFlipRow.appendChild(tileFlipControls);
    this.fpsHeldWeaponAnimationDebugElements.tileFlipXCheckbox =
      tileFlipXCheckbox;
    this.fpsHeldWeaponAnimationDebugElements.tileFlipYCheckbox =
      tileFlipYCheckbox;
    this.fpsHeldWeaponAnimationDebugElements.tileFlipDiagonalCheckbox =
      tileFlipDiagonalCheckbox;

    const keyframeRow = createRow("Keyframe");
    this.fpsHeldWeaponAnimationDebugElements.keyframeRow = keyframeRow;
    const keyframeSelect = document.createElement("select");
    keyframeSelect.style.font = "11px monospace";
    keyframeSelect.style.padding = "2px 4px";
    keyframeSelect.addEventListener("change", () => {
      const parsed = Number.parseInt(keyframeSelect.value, 10);
      if (!Number.isFinite(parsed)) {
        return;
      }
      this.fpsHeldWeaponAnimationDebugSelectedKeyframeIndex = parsed;
      this.syncFpsHeldWeaponAnimationDebugUi();
      this.setFpsHeldWeaponAnimationDebugStatus("");
    });
    keyframeRow.appendChild(keyframeSelect);
    this.fpsHeldWeaponAnimationDebugElements.keyframeSelect = keyframeSelect;

    const addButtonsRow = createRow("Add");
    this.fpsHeldWeaponAnimationDebugElements.addRow = addButtonsRow;
    const addButtons = document.createElement("div");
    addButtons.style.display = "flex";
    addButtons.style.gap = "8px";

    const addBeforeButton = document.createElement("button");
    addBeforeButton.type = "button";
    addBeforeButton.textContent = "Add Before";
    addBeforeButton.style.font = "11px monospace";
    addBeforeButton.style.padding = "3px 8px";
    addBeforeButton.addEventListener("click", () => {
      this.insertFpsHeldWeaponAnimationDebugKeyframe("before");
    });
    addButtons.appendChild(addBeforeButton);

    const addAfterButton = document.createElement("button");
    addAfterButton.type = "button";
    addAfterButton.textContent = "Add After";
    addAfterButton.style.font = "11px monospace";
    addAfterButton.style.padding = "3px 8px";
    addAfterButton.addEventListener("click", () => {
      this.insertFpsHeldWeaponAnimationDebugKeyframe("after");
    });
    addButtons.appendChild(addAfterButton);

    addButtonsRow.appendChild(addButtons);

    const durationRow = createRow("Duration");
    this.fpsHeldWeaponAnimationDebugElements.durationRow = durationRow;
    const durationInput = document.createElement("input");
    durationInput.type = "number";
    durationInput.step = "1";
    durationInput.min = "1";
    durationInput.style.font = "11px monospace";
    durationInput.style.padding = "2px 4px";
    durationInput.addEventListener("input", () => {
      const keyframe = this.getFpsHeldWeaponAnimationDebugSelectedKeyframe();
      const parsed = Number.parseFloat(durationInput.value);
      if (!keyframe || !Number.isFinite(parsed)) {
        return;
      }
      keyframe.durationMs = Math.max(1, Math.round(parsed));
    });
    durationInput.addEventListener("change", () => {
      this.syncFpsHeldWeaponAnimationDebugKeyframeOptions();
      this.syncFpsHeldWeaponAnimationDebugFieldValues();
    });
    durationInput.addEventListener("blur", () => {
      this.syncFpsHeldWeaponAnimationDebugKeyframeOptions();
      this.syncFpsHeldWeaponAnimationDebugFieldValues();
    });
    durationRow.appendChild(durationInput);
    this.fpsHeldWeaponAnimationDebugElements.durationInput = durationInput;

    const createAxisSection = (
      titleText: string,
      step: string,
      inputs: FpsHeldWeaponAnimationEditorInputMap,
      onValue: (axis: FpsHeldWeaponAnimationEditorAxis, value: number) => void,
    ): HTMLDivElement => {
      const section = document.createElement("div");
      section.style.marginTop = "6px";
      section.style.marginBottom = "8px";

      const titleElement = document.createElement("div");
      titleElement.textContent = titleText;
      titleElement.style.marginBottom = "4px";
      titleElement.style.opacity = "0.86";
      section.appendChild(titleElement);

      const grid = document.createElement("div");
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
      grid.style.gap = "6px";

      for (const axis of ["x", "y", "z"] as const) {
        const wrapper = document.createElement("label");
        wrapper.style.display = "grid";
        wrapper.style.rowGap = "4px";

        const axisLabel = document.createElement("span");
        axisLabel.textContent = axis.toUpperCase();
        axisLabel.style.opacity = "0.76";
        wrapper.appendChild(axisLabel);

        const input = document.createElement("input");
        input.type = "number";
        input.step = step;
        input.style.font = "11px monospace";
        input.style.padding = "2px 4px";
        input.addEventListener("input", () => {
          const parsed = Number.parseFloat(input.value);
          if (!Number.isFinite(parsed)) {
            return;
          }
          onValue(axis, parsed);
        });
        input.addEventListener("change", () => {
          const parsed = Number.parseFloat(input.value);
          if (Number.isFinite(parsed)) {
            onValue(axis, parsed);
          }
          this.syncFpsHeldWeaponAnimationDebugFieldValues();
        });
        input.addEventListener("blur", () => {
          this.syncFpsHeldWeaponAnimationDebugFieldValues();
        });
        wrapper.appendChild(input);
        grid.appendChild(wrapper);
        inputs[axis] = input;
      }

      section.appendChild(grid);
      panel.appendChild(section);
      return section;
    };

    this.fpsHeldWeaponAnimationDebugElements.basePositionSection =
      createAxisSection(
        "Position Offset (camera local)",
        "0.01",
        this.fpsHeldWeaponAnimationDebugElements.basePositionInputs,
        (axis, value) => {
          this.dependencies.heldWeapon.fpsHeldWeaponBasePose.position[axis] = value;
        },
      );
    this.fpsHeldWeaponAnimationDebugElements.baseRotationSection =
      createAxisSection(
        "Rotation Offset (deg)",
        "0.1",
        this.fpsHeldWeaponAnimationDebugElements.baseRotationInputs,
        (axis, value) => {
          this.dependencies.heldWeapon.fpsHeldWeaponBasePose.rotationDeg[axis] = value;
        },
      );
    this.fpsHeldWeaponAnimationDebugElements.pivotSection = createAxisSection(
      "Pivot (relative to sprite center)",
      "0.01",
      this.fpsHeldWeaponAnimationDebugElements.pivotInputs,
      (axis, value) => {
        const animation =
          this.getFpsHeldWeaponAnimationDebugSelectedAnimation();
        if (!animation) {
          return;
        }
        animation.pivotNormalized[axis] = value;
      },
    );
    this.fpsHeldWeaponAnimationDebugElements.translationSection =
      createAxisSection(
        "Translation",
        "0.01",
        this.fpsHeldWeaponAnimationDebugElements.translationInputs,
        (axis, value) => {
          const keyframe =
            this.getFpsHeldWeaponAnimationDebugSelectedKeyframe();
          if (!keyframe) {
            return;
          }
          keyframe.translation[axis] = value;
        },
      );
    this.fpsHeldWeaponAnimationDebugElements.rotationSection =
      createAxisSection(
        "Rotation (deg)",
        "0.1",
        this.fpsHeldWeaponAnimationDebugElements.rotationInputs,
        (axis, value) => {
          const keyframe =
            this.getFpsHeldWeaponAnimationDebugSelectedKeyframe();
          if (!keyframe) {
            return;
          }
          keyframe.rotationDeg[axis] = value;
        },
      );

    const note = document.createElement("div");
    note.textContent =
      "Weapon idle offset is added on top of the original hidden baseline pose and used for the resting pose. Weight affects random selection. Duration is the time from the previous keyframe into the current one.";
    note.style.opacity = "0.72";
    note.style.marginTop = "2px";
    panel.appendChild(note);
    this.fpsHeldWeaponAnimationDebugElements.noteLabel = note;

    const statusLabel = document.createElement("div");
    statusLabel.style.minHeight = "16px";
    statusLabel.style.marginTop = "6px";
    statusLabel.style.opacity = "0.88";
    panel.appendChild(statusLabel);
    this.fpsHeldWeaponAnimationDebugElements.statusLabel = statusLabel;

    host.appendChild(panel);
    this.fpsHeldWeaponAnimationDebugElements.panel = panel;
    this.syncFpsHeldWeaponAnimationDebugPanelPosition();
    this.syncFpsHeldWeaponAnimationDebugUi();
    return panel;
  }

  setFpsHeldWeaponAnimationDebugVisible(visible: boolean): void {
    this.fpsHeldWeaponAnimationDebugVisible = visible;
    const panel = visible
      ? this.ensureFpsHeldWeaponAnimationDebugPanel()
      : this.fpsHeldWeaponAnimationDebugElements.panel;
    if (!panel) {
      return;
    }
    if (!visible) {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        panel.contains(activeElement)
      ) {
        activeElement.blur();
      }
    }
    panel.style.display = visible ? "block" : "none";
    if (visible) {
      this.syncFpsHeldWeaponAnimationDebugPanelPosition();
      this.syncFpsHeldWeaponAnimationDebugUi();
      this.setFpsHeldWeaponAnimationDebugStatus("");
    }
  }

  removeFpsHeldWeaponAnimationDebugPanel(): void {
    this.fpsHeldWeaponAnimationDebugElements.panel?.remove();
    this.fpsHeldWeaponAnimationDebugElements.panel = null;
    this.fpsHeldWeaponAnimationDebugElements.animationSelect = null;
    this.fpsHeldWeaponAnimationDebugElements.copyButton = null;
    this.fpsHeldWeaponAnimationDebugElements.weightInput = null;
    this.fpsHeldWeaponAnimationDebugElements.keyframeSelect = null;
    this.fpsHeldWeaponAnimationDebugElements.durationInput = null;
    this.fpsHeldWeaponAnimationDebugElements.slowMoCheckbox = null;
    this.fpsHeldWeaponAnimationDebugElements.previewKeyframeCheckbox = null;
    this.fpsHeldWeaponAnimationDebugElements.statusLabel = null;
    this.fpsHeldWeaponAnimationDebugElements.noteLabel = null;
    this.fpsHeldWeaponAnimationDebugElements.weightRow = null;
    this.fpsHeldWeaponAnimationDebugElements.previewRow = null;
    this.fpsHeldWeaponAnimationDebugElements.tilePreviewRow = null;
    this.fpsHeldWeaponAnimationDebugElements.tileFlipRow = null;
    this.fpsHeldWeaponAnimationDebugElements.keyframeRow = null;
    this.fpsHeldWeaponAnimationDebugElements.addRow = null;
    this.fpsHeldWeaponAnimationDebugElements.durationRow = null;
    this.fpsHeldWeaponAnimationDebugElements.basePositionSection = null;
    this.fpsHeldWeaponAnimationDebugElements.baseRotationSection = null;
    this.fpsHeldWeaponAnimationDebugElements.pivotSection = null;
    this.fpsHeldWeaponAnimationDebugElements.translationSection = null;
    this.fpsHeldWeaponAnimationDebugElements.rotationSection = null;
    this.fpsHeldWeaponAnimationDebugElements.tilePreviewEnabledCheckbox = null;
    this.fpsHeldWeaponAnimationDebugElements.tilePreviewTileIdInput = null;
    this.fpsHeldWeaponAnimationDebugElements.tilePreviewTilesetLabel = null;
    this.fpsHeldWeaponAnimationDebugElements.tileFlipXCheckbox = null;
    this.fpsHeldWeaponAnimationDebugElements.tileFlipYCheckbox = null;
    for (const axis of ["x", "y", "z"] as const) {
      this.fpsHeldWeaponAnimationDebugElements.basePositionInputs[axis] = null;
      this.fpsHeldWeaponAnimationDebugElements.baseRotationInputs[axis] = null;
      this.fpsHeldWeaponAnimationDebugElements.pivotInputs[axis] = null;
      this.fpsHeldWeaponAnimationDebugElements.translationInputs[axis] = null;
      this.fpsHeldWeaponAnimationDebugElements.rotationInputs[axis] = null;
    }
    this.fpsHeldWeaponAnimationDebugVisible = false;
  }
}
