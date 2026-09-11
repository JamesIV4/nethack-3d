// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeMapCallbacks } from "../world/map-callbacks";
import type { RuntimeKeyboardInput } from "./keyboard";
import type { RuntimeMenuSelection } from "../menus/selection";
import type { RuntimeInventoryContext } from "../menus/inventory-context";
import type { RuntimePostActionRefresh } from "../world/post-action-refresh";
import type { RuntimeContextualLook } from "./contextual-look";
import type { RuntimeInputRequests } from "./input-requests";

export interface RuntimePositionInputDependencies {
  readonly contextualLook: Pick<
    RuntimeContextualLook,
    "contextualGlanceAutoCancelPositionUntilMs"
  >;
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
  >;
  readonly inputRequests: Pick<
    RuntimeInputRequests,
    "requestInputCode"
  >;
  readonly inventoryContext: Pick<
    RuntimeInventoryContext,
    "isCallRootQuestion"
    | "isLookAtMenuQuestion"
    | "isNameRootQuestion"
  >;
  readonly keyboardInput: Pick<
    RuntimeKeyboardInput,
    "isDirectionalMovementInput"
    | "normalizeInputKey"
    | "processKey"
  >;
  readonly mapCallbacks: Pick<
    RuntimeMapCallbacks,
    "playerPosition"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "currentMenuQuestionText"
    | "getPrintableAcceleratorCharacter"
  >;
  readonly postActionRefresh: Pick<
    RuntimePostActionRefresh,
    "maybeRefreshPendingPostActionPlayerTile"
    | "pendingPostActionPlayerTileRefreshReason"
    | "pendingPostActionPlayerTileRefreshTarget"
  >;
}

/** Far-look and travel position mode, cursor state and position request activation. */
export class RuntimePositionInput {
  declare farLookMode: string;
  declare farLookOrigin: any;
  declare pendingLookMenuFarLookArm: boolean;
  declare pendingLegacySlashEmCursorPromptFarLook: boolean;
  declare pendingTravelPositionInputArm: boolean;
  declare positionInputActive: boolean;
  declare positionCursor: any;

  constructor(private readonly deps: RuntimePositionInputDependencies) {
    this.farLookMode = "none";
    // none | armed | active
    this.farLookOrigin = null;
    // null | "direct" | "look_menu" | "floor_target_menu" | "legacy_cursor_prompt" | "travel"
    this.pendingLookMenuFarLookArm = false;
    this.pendingLegacySlashEmCursorPromptFarLook = false;
    this.pendingTravelPositionInputArm = false;
    this.positionInputActive = false;
    this.positionCursor = null;
  }

  setPositionInputActive(active) {
    const normalized = Boolean(active);
    if (this.positionInputActive === normalized) {
      return;
    }

    this.positionInputActive = normalized;
    if (!normalized) {
      this.positionCursor = null;
    }

    if (this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
        type: "position_input_state",
        active: normalized,
        origin: normalized ? this.farLookOrigin : null,
      });
    }
  }

  emitPositionCursor(windowId, x, y, source = "curs") {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    this.positionCursor = { x, y, window: windowId };
    if (this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
        type: "position_cursor",
        x: x,
        y: y,
        window: windowId,
        source: source,
      });
    }
  }

  isPositionModeInitiatorInput(input) {
    return input === ";";
  }

  isFarLookPositionRequest() {
    return this.farLookMode === "armed" || this.farLookMode === "active";
  }

  isTravelDestinationPrompt(text) {
    const normalized =
      typeof text === "string" ? text.trim().toLowerCase() : "";
    return normalized === "where do you want to travel to?";
  }

  armPendingTravelPositionInput(text) {
    if (!this.isTravelDestinationPrompt(text)) {
      return;
    }
    this.pendingTravelPositionInputArm = true;
    console.log("Arming travel position input mode from travel prompt");
    this.activateTravelPositionInputMode("travel prompt");
  }

  activateTravelPositionInputMode(reason = "unknown") {
    if (this.farLookMode === "active" && this.farLookOrigin === "travel") {
      return;
    }
    console.log(`Activating travel position input mode (${reason})`);
    this.farLookMode = "active";
    this.farLookOrigin = "travel";
    this.pendingTravelPositionInputArm = false;
    this.pendingLookMenuFarLookArm = false;
    this.setPositionInputActive(true);
    if (!this.positionCursor) {
      this.emitPositionCursor(
        null,
        this.deps.mapCallbacks.playerPosition.x,
        this.deps.mapCallbacks.playerPosition.y,
        "travel_position_start",
      );
    }
  }

  isTravelPositionOrigin() {
    return this.farLookOrigin === "travel";
  }

  isTravelPositionSelectionInput(input) {
    const normalized = this.deps.keyboardInput.normalizeInputKey(input);
    return (
      normalized === "Enter" ||
      normalized === "\r" ||
      normalized === "\n" ||
      normalized === "." ||
      normalized === "," ||
      normalized === ";" ||
      normalized === ":"
    );
  }

  isTravelPositionRequestInput(input) {
    const normalized = this.deps.keyboardInput.normalizeInputKey(input);
    if (typeof normalized !== "string" || normalized.length === 0) {
      return false;
    }
    if (this.isFarLookExitInput(normalized)) {
      return true;
    }
    if (this.deps.keyboardInput.isDirectionalMovementInput(normalized)) {
      return true;
    }
    if (this.isTravelPositionSelectionInput(normalized)) {
      return true;
    }
    return normalized.length === 1 && normalized.charCodeAt(0) >= 32;
  }

  isFarLookExitInput(input) {
    return (
      input === "Escape" ||
      input === "Enter" ||
      input === "\r" ||
      input === "\n"
    );
  }

  isPositionRequestContinuationInput(input) {
    const normalized = this.deps.keyboardInput.normalizeInputKey(input);
    if (typeof normalized !== "string" || normalized.length === 0) {
      return false;
    }
    if (
      this.isTravelPositionOrigin() &&
      this.isTravelPositionRequestInput(normalized)
    ) {
      return true;
    }
    if (this.isFarLookContinuationInput(normalized)) {
      return true;
    }
    if (this.isFarLookExitInput(normalized)) {
      return true;
    }
    return false;
  }

  isFarLookContinuationInput(input) {
    const normalized = this.deps.keyboardInput.normalizeInputKey(input);
    if (typeof normalized !== "string" || normalized.length === 0) {
      return false;
    }
    if (
      this.isTravelPositionOrigin() &&
      this.isTravelPositionRequestInput(normalized) &&
      !this.isTravelPositionSelectionInput(normalized)
    ) {
      return true;
    }
    if (
      this.isTravelPositionOrigin() &&
      this.isTravelPositionSelectionInput(normalized)
    ) {
      return false;
    }
    if (this.deps.keyboardInput.isDirectionalMovementInput(normalized)) {
      return true;
    }
    return (
      normalized === "," ||
      normalized === "." ||
      normalized === "5" ||
      normalized === "Numpad5"
    );
  }

  shouldPreserveFarLookAfterMouseSelection() {
    return (
      this.farLookOrigin === "look_menu" ||
      this.farLookOrigin === "legacy_cursor_prompt"
    );
  }

  normalizeFarLookPositionInput(input) {
    if (this.farLookMode !== "active") {
      return input;
    }

    // NetHack look mode uses ';' for detailed object description.
    // Treat Enter as that confirm key to avoid leaving far-look in a bad state.
    if (
      this.farLookOrigin !== "floor_target_menu" &&
      this.farLookOrigin !== "legacy_cursor_prompt" &&
      (input === "Enter" || input === "\r" || input === "\n")
    ) {
      return ";";
    }

    return input;
  }

  isLookAtMapMenuSelection(menuItem) {
    if (!menuItem || menuItem.isCategory) {
      return false;
    }

    const accelerator =
      typeof menuItem.accelerator === "string" ? menuItem.accelerator : "";
    const originalAccelerator = menuItem.originalAccelerator;
    const identifier = menuItem.identifier;
    const originalAcceleratorChar =
      this.deps.menuSelection.getPrintableAcceleratorCharacter(originalAccelerator);
    const selectsMapTarget =
      accelerator === "/" ||
      originalAccelerator === 47 ||
      originalAcceleratorChar === "/" ||
      identifier === 47;
    if (!selectsMapTarget) {
      return false;
    }

    if (this.deps.inventoryContext.isLookAtMenuQuestion(this.deps.menuSelection.currentMenuQuestionText)) {
      return true;
    }

    const text = String(menuItem.text || "")
      .trim()
      .toLowerCase();
    return text === "something on the map";
  }

  isFloorTargetPositionMenuSelection(menuItem) {
    if (!menuItem || menuItem.isCategory) {
      return false;
    }

    if (
      !this.deps.inventoryContext.isNameRootQuestion(this.deps.menuSelection.currentMenuQuestionText) &&
      !this.deps.inventoryContext.isCallRootQuestion(this.deps.menuSelection.currentMenuQuestionText)
    ) {
      return false;
    }

    const text = String(menuItem.text || "")
      .trim()
      .toLowerCase();
    return (
      text === "the type of an object upon the floor" ||
      text.includes("object upon the floor")
    );
  }

  isMonsterTargetPositionMenuSelection(menuItem) {
    if (!menuItem || menuItem.isCategory) {
      return false;
    }

    if (
      !this.deps.inventoryContext.isNameRootQuestion(this.deps.menuSelection.currentMenuQuestionText) &&
      !this.deps.inventoryContext.isCallRootQuestion(this.deps.menuSelection.currentMenuQuestionText)
    ) {
      return false;
    }

    const text = String(menuItem.text || "")
      .trim()
      .toLowerCase();
    return text === "a monster" || text.includes("monster");
  }

  handleShimNhPoskey(args) {
    const [xPtr, yPtr, modPtr] = args;
    console.log("NetHack requesting position key");
    if (this.deps.postActionRefresh.maybeRefreshPendingPostActionPlayerTile("nh_poskey")) {
      this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshReason = null;
      this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget = null;
    }
    if (this.deps.contextualLook.contextualGlanceAutoCancelPositionUntilMs > 0) {
      const nowMs = Date.now();
      if (nowMs <= this.deps.contextualLook.contextualGlanceAutoCancelPositionUntilMs) {
        console.log(
          "Auto-canceling contextual look/glance follow-up position request",
        );
        this.deps.contextualLook.contextualGlanceAutoCancelPositionUntilMs = 0;
        this.setPositionInputActive(false);
        return this.deps.keyboardInput.processKey("Escape");
      }
      this.deps.contextualLook.contextualGlanceAutoCancelPositionUntilMs = 0;
    }

    if (this.farLookMode === "none" && this.pendingTravelPositionInputArm) {
      this.activateTravelPositionInputMode("nh_poskey fallback");
    }

    if (this.farLookMode === "armed") {
      this.farLookMode = "active";
      this.setPositionInputActive(true);
      if (!this.positionCursor) {
        this.emitPositionCursor(
          null,
          this.deps.mapCallbacks.playerPosition.x,
          this.deps.mapCallbacks.playerPosition.y,
          "nh_poskey_start",
        );
      }
    } else if (this.farLookMode === "active") {
      this.setPositionInputActive(true);
    } else {
      this.setPositionInputActive(false);
    }

    return this.deps.inputRequests.requestInputCode("position", { xPtr, yPtr, modPtr });
  }
}
