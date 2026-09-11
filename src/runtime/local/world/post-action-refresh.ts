// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeMenuSelection } from "../menus/selection";
import type { RuntimeInputRequests } from "../input/input-requests";
import type { RuntimePositionInput } from "../input/position-selection";
import type { RuntimeMapCallbacks } from "./map-callbacks";
import type { RuntimeUnderPlayerItems } from "./under-player-items";
import type { RuntimeGlyphs } from "./glyphs";
import type { RuntimeTileRefresh } from "./tile-refresh";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeQuestionInput } from "../input/questions";

export interface RuntimeRefreshTarget {
  x: number;
  y: number;
}

export interface RuntimeUnderPlayerSnapshot {
  glyph: number;
  char?: string | null;
  color?: number | null;
  tileIndex?: number | null;
  symidx?: number | null;
}

export interface RuntimePostActionRefreshDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "runtimeVersion"
  >;
  readonly inputRequests: Pick<
    RuntimeInputRequests,
    "awaitingQuestionInput"
  >;
  readonly mapCallbacks: Pick<
    RuntimeMapCallbacks,
    "gameMap"
    | "playerPosition"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "normalizeQuestionText"
  >;
  readonly positionInput: Pick<
    RuntimePositionInput,
    "isFarLookPositionRequest"
    | "positionInputActive"
  >;
  readonly questionInput: Pick<
    RuntimeQuestionInput,
    "activeYnPrompt"
    | "lastQuestionText"
  >;
  readonly runtimeGlyphs: Pick<
    RuntimeGlyphs,
    "isLootLikeGlyph"
    | "isLootLikeRuntimeMapTile"
  >;
  readonly tileRefresh: Pick<
    RuntimeTileRefresh,
    "canQueryWasmHelpers"
  >;
  readonly underPlayerItems: Pick<
    RuntimeUnderPlayerItems,
    "buildUnderPlayerItemSnapshotFromRuntimeMapTile"
    | "doesRuntimeMapTileMatchUnderPlayerSnapshot"
    | "emitUnderPlayerItemGlyphFromPendingSnapshot"
    | "emitUnderPlayerItemGlyphIfAvailableAt"
    | "maybeEmitConfirmedBoulderPushEventFromRuntimeMap"
  >;
}

/** Pending under-player refresh reasons, target/snapshot retention, action arming and deferred completion. */
export class RuntimePostActionRefresh {
  declare pendingPostActionPlayerTileRefreshReason: any;
  declare pendingPostActionPlayerTileRefreshTarget: any;
  declare pendingPostActionPlayerTileRefreshSnapshot: any;

  constructor(private readonly deps: RuntimePostActionRefreshDependencies) {
    this.pendingPostActionPlayerTileRefreshReason = null;
    this.pendingPostActionPlayerTileRefreshTarget = null;
    this.pendingPostActionPlayerTileRefreshSnapshot = null;
  }

  getPostActionPlayerTileRefreshReasonForMenuItem(menuItem) {
    if (!menuItem || typeof menuItem !== "object") {
      return null;
    }
    const normalizedText =
      typeof menuItem.text === "string"
        ? menuItem.text.trim().toLowerCase()
        : "";
    if (!normalizedText) {
      return null;
    }
    if (normalizedText.startsWith("pick up")) {
      return "pickup-auto-menu";
    }
    if (
      normalizedText.startsWith("drop ") ||
      normalizedText === "drop items"
    ) {
      return "drop-auto-menu";
    }
    if (normalizedText.startsWith("eat ")) {
      return "eat-auto-menu";
    }
    return null;
  }

  getPostActionPlayerTileRefreshReasonForQuestion(question) {
    const normalizedQuestion = this.deps.menuSelection.normalizeQuestionText(question);
    if (!normalizedQuestion) {
      return null;
    }
    if (
      normalizedQuestion.includes("pick up what") ||
      normalizedQuestion.includes("what do you want to pick up") ||
      normalizedQuestion.includes("what would you like to pick up")
    ) {
      return "pickup-question";
    }
    if (
      normalizedQuestion.includes("drop what") ||
      normalizedQuestion.includes("what do you want to drop") ||
      normalizedQuestion.includes("what would you like to drop") ||
      normalizedQuestion.includes("drop what type of items")
    ) {
      return "drop-question";
    }
    if (
      normalizedQuestion.includes("eat what") ||
      normalizedQuestion.includes("what do you want to eat") ||
      normalizedQuestion.includes("what would you like to eat")
    ) {
      return "eat-question";
    }
    return null;
  }

  getPostActionPlayerTileRefreshReasonForAnsweredYnQuestion(question, input) {
    const normalizedQuestion = this.deps.menuSelection.normalizeQuestionText(question);
    const normalizedInput = String(input ?? "").trim().toLowerCase();
    if (!normalizedQuestion || normalizedInput !== "y") {
      return null;
    }
    if (normalizedQuestion.includes("eat it")) {
      return "eat-confirm-question";
    }
    return null;
  }

  getPostActionPlayerTileRefreshReasonPriority(refreshReason) {
    switch (String(refreshReason || "").trim()) {
      case "move-onto-lootlike-tile":
      case "pickup-current-player-tile":
      case "autopickup-raw-print":
        return 100;
      case "pickup-question":
      case "pickup-auto-menu":
      case "eat-question":
      case "eat-auto-menu":
      case "eat-confirm-question":
      case "drop-question":
      case "drop-auto-menu":
        return 80;
      case "monster-like-vacated-tile":
        return 20;
      default:
        return 50;
    }
  }

  armPendingPostActionPlayerTileRefreshByReason(
    refreshReason,
    sourceLabel,
    target: RuntimeRefreshTarget | null = null,
    snapshot: RuntimeUnderPlayerSnapshot | null = null,
  ) {
    const normalizedReason =
      typeof refreshReason === "string" ? refreshReason.trim() : "";
    if (!normalizedReason) {
      return;
    }
    const existingReason =
      typeof this.pendingPostActionPlayerTileRefreshReason === "string"
        ? this.pendingPostActionPlayerTileRefreshReason.trim()
        : "";
    if (existingReason) {
      const existingPriority =
        this.getPostActionPlayerTileRefreshReasonPriority(existingReason);
      const nextPriority =
        this.getPostActionPlayerTileRefreshReasonPriority(normalizedReason);
      if (existingPriority > nextPriority) {
        console.log(
          `Keeping existing post-action top-item check (${existingReason}) instead of lower-priority (${normalizedReason}) ${sourceLabel}`,
        );
        return;
      }
    }
    this.pendingPostActionPlayerTileRefreshReason = normalizedReason;
    this.pendingPostActionPlayerTileRefreshTarget =
      target &&
        Number.isFinite(target.x) &&
        Number.isFinite(target.y)
        ? { x: Math.trunc(Number(target.x)), y: Math.trunc(Number(target.y)) }
        : null;
    this.pendingPostActionPlayerTileRefreshSnapshot =
      snapshot && typeof snapshot === "object" ? { ...snapshot } : null;
    console.log(
      `Armed post-action top-item check (${normalizedReason}) ${sourceLabel}`,
      this.pendingPostActionPlayerTileRefreshTarget,
    );
  }

  clearPendingPostActionPlayerTileRefreshByReason(refreshReason, sourceLabel) {
    const normalizedReason =
      typeof refreshReason === "string" ? refreshReason.trim() : "";
    const existingReason =
      typeof this.pendingPostActionPlayerTileRefreshReason === "string"
        ? this.pendingPostActionPlayerTileRefreshReason.trim()
        : "";
    if (!normalizedReason || existingReason !== normalizedReason) {
      return;
    }
    this.pendingPostActionPlayerTileRefreshReason = null;
    this.pendingPostActionPlayerTileRefreshTarget = null;
    this.pendingPostActionPlayerTileRefreshSnapshot = null;
    console.log(
      `Cleared post-action top-item check (${normalizedReason}) ${sourceLabel}`,
    );
  }

  clearPendingPostActionPlayerTileRefresh(sourceLabel) {
    const existingReason =
      typeof this.pendingPostActionPlayerTileRefreshReason === "string"
        ? this.pendingPostActionPlayerTileRefreshReason.trim()
        : "";
    if (!existingReason) {
      return;
    }
    this.pendingPostActionPlayerTileRefreshReason = null;
    this.pendingPostActionPlayerTileRefreshTarget = null;
    this.pendingPostActionPlayerTileRefreshSnapshot = null;
    console.log(
      `Cleared post-action top-item check (${existingReason}) ${sourceLabel}`,
    );
  }

  clearPendingCurrentPlayerPickupRefreshIfTargetDiffers(
    targetX,
    targetY,
    sourceLabel,
  ) {
    const pendingReason =
      typeof this.pendingPostActionPlayerTileRefreshReason === "string"
        ? this.pendingPostActionPlayerTileRefreshReason.trim()
        : "";
    if (pendingReason !== "pickup-current-player-tile") {
      return;
    }
    const pendingTarget =
      this.pendingPostActionPlayerTileRefreshTarget &&
        Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.x) &&
        Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.y)
        ? {
          x: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.x)),
          y: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.y)),
        }
        : null;
    if (!pendingTarget) {
      this.clearPendingPostActionPlayerTileRefreshByReason(
        "pickup-current-player-tile",
        `${sourceLabel} (missing target)`,
      );
      return;
    }
    const normalizedTargetX = Math.trunc(Number(targetX));
    const normalizedTargetY = Math.trunc(Number(targetY));
    if (
      normalizedTargetX === pendingTarget.x &&
      normalizedTargetY === pendingTarget.y
    ) {
      return;
    }
    this.clearPendingPostActionPlayerTileRefreshByReason(
      "pickup-current-player-tile",
      `${sourceLabel} (new target ${normalizedTargetX},${normalizedTargetY} differs from ${pendingTarget.x},${pendingTarget.y})`,
    );
  }

  maybeArmPendingPostActionPlayerTileRefreshForLootMoveTarget(
    targetX,
    targetY,
    sourceLabel,
  ) {
    if (
      !Number.isFinite(targetX) ||
      !Number.isFinite(targetY) ||
      this.deps.inputRequests.awaitingQuestionInput ||
      this.deps.positionInput.positionInputActive ||
      this.deps.positionInput.isFarLookPositionRequest()
    ) {
      return;
    }
    const tileX = Math.trunc(Number(targetX));
    const tileY = Math.trunc(Number(targetY));
    this.clearPendingCurrentPlayerPickupRefreshIfTargetDiffers(
      tileX,
      tileY,
      sourceLabel,
    );
    const destinationTileData = this.deps.mapCallbacks.gameMap.get(`${tileX},${tileY}`);
    const destinationSnapshot =
      this.deps.underPlayerItems.buildUnderPlayerItemSnapshotFromRuntimeMapTile(destinationTileData);
    if (!this.deps.runtimeGlyphs.isLootLikeRuntimeMapTile(destinationTileData)) {
      this.clearPendingPostActionPlayerTileRefreshByReason(
        "move-onto-lootlike-tile",
        `${sourceLabel} (target is not loot-like)`,
      );
      return;
    }
    this.armPendingPostActionPlayerTileRefreshByReason(
      "move-onto-lootlike-tile",
      sourceLabel,
      { x: tileX, y: tileY },
      destinationSnapshot,
    );
  }

  maybeArmPendingPostActionPlayerTileRefreshForCurrentPlayerLoot(sourceLabel) {
    const playerX = Number(this.deps.mapCallbacks.playerPosition?.x);
    const playerY = Number(this.deps.mapCallbacks.playerPosition?.y);
    if (
      !Number.isFinite(playerX) ||
      !Number.isFinite(playerY) ||
      this.deps.inputRequests.awaitingQuestionInput ||
      this.deps.positionInput.positionInputActive ||
      this.deps.positionInput.isFarLookPositionRequest()
    ) {
      return;
    }

    const normalizedPlayerX = Math.trunc(playerX);
    const normalizedPlayerY = Math.trunc(playerY);

    if (!this.deps.tileRefresh.canQueryWasmHelpers()) {
      this.armPendingPostActionPlayerTileRefreshByReason(
        "pickup-current-player-tile",
        `${sourceLabel} (optimistic arm while helpers unavailable)`,
        { x: normalizedPlayerX, y: normalizedPlayerY },
      );
      return;
    }

    const helpers =
      globalThis.nethackGlobal && globalThis.nethackGlobal.helpers
        ? globalThis.nethackGlobal.helpers
        : null;
    const topItemGlyphUnderPlayer =
      helpers && typeof helpers.topItemGlyphUnderPlayer === "function"
        ? helpers.topItemGlyphUnderPlayer
        : null;
    if (!topItemGlyphUnderPlayer) {
      return;
    }

    try {
      const topGlyph = Number(topItemGlyphUnderPlayer());
      if (!Number.isFinite(topGlyph) || !this.deps.runtimeGlyphs.isLootLikeGlyph(topGlyph)) {
        this.clearPendingPostActionPlayerTileRefreshByReason(
          "pickup-current-player-tile",
          `${sourceLabel} (no loot-like top item under player)`,
        );
        return;
      }
    } catch (error) {
      console.log(
        "[WARN] maybeArmPendingPostActionPlayerTileRefreshForCurrentPlayerLoot failed:",
        error,
      );
      return;
    }

    this.armPendingPostActionPlayerTileRefreshByReason(
      "pickup-current-player-tile",
      sourceLabel,
      { x: normalizedPlayerX, y: normalizedPlayerY },
    );
  }

  armPendingPostActionPlayerTileRefresh(menuItem) {
    const refreshReason =
      this.getPostActionPlayerTileRefreshReasonForMenuItem(menuItem);
    if (!refreshReason) {
      return;
    }
    this.armPendingPostActionPlayerTileRefreshByReason(
      refreshReason,
      `for auto-selected menu item "${menuItem.text}"`,
    );
  }

  armPendingPostActionPlayerTileRefreshForQuestion(question) {
    const refreshReason =
      this.getPostActionPlayerTileRefreshReasonForQuestion(question);
    if (!refreshReason) {
      return;
    }
    this.armPendingPostActionPlayerTileRefreshByReason(
      refreshReason,
      `for question "${question}"`,
    );
  }

  armPendingPostActionPlayerTileRefreshForMenuInteraction(
    question,
    menuItem,
    sourceLabel,
  ) {
    const questionReason =
      this.getPostActionPlayerTileRefreshReasonForQuestion(question);
    if (questionReason) {
      this.armPendingPostActionPlayerTileRefreshByReason(
        questionReason,
        `${sourceLabel} via question "${question}"`,
      );
      return;
    }

    const menuItemReason =
      this.getPostActionPlayerTileRefreshReasonForMenuItem(menuItem);
    if (!menuItemReason) {
      return;
    }
    this.armPendingPostActionPlayerTileRefreshByReason(
      menuItemReason,
      `${sourceLabel} via menu item "${menuItem?.text ?? ""}"`,
    );
  }

  armPendingPostActionPlayerTileRefreshForAnsweredYnQuestion(question, input) {
    const refreshReason =
      this.getPostActionPlayerTileRefreshReasonForAnsweredYnQuestion(
        question,
        input,
      );
    if (!refreshReason) {
      return;
    }
    this.armPendingPostActionPlayerTileRefreshByReason(
      refreshReason,
      `for answered Y/N question "${question}" with input "${input}"`,
    );
  }

  isAutopickupInventoryAssignmentRawPrint(text) {
    if (typeof text !== "string") {
      return false;
    }
    const normalizedText = text.trim();
    if (normalizedText.length < 5) {
      return false;
    }
    if (
      this.deps.coordinator.runtimeVersion === "slashem" &&
      /^(?:\d+|a|an)\s+gold piece(?:s)?\.$/i.test(normalizedText)
    ) {
      return true;
    }
    return /^[^\s] - \S/.test(normalizedText);
  }

  armPendingPostActionPlayerTileRefreshForAutopickupRawPrint(text) {
    if (!this.isAutopickupInventoryAssignmentRawPrint(text)) {
      return;
    }

    const pendingTarget =
      this.pendingPostActionPlayerTileRefreshTarget &&
        Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.x) &&
        Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.y)
        ? {
          x: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.x)),
          y: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.y)),
        }
        : null;
    const playerX = Number(this.deps.mapCallbacks.playerPosition?.x);
    const playerY = Number(this.deps.mapCallbacks.playerPosition?.y);
    const currentPlayerTarget =
      Number.isFinite(playerX) && Number.isFinite(playerY)
        ? { x: Math.trunc(playerX), y: Math.trunc(playerY) }
        : null;
    const refreshTarget = pendingTarget ?? currentPlayerTarget;

    if (
      refreshTarget &&
      currentPlayerTarget &&
      refreshTarget.x === currentPlayerTarget.x &&
      refreshTarget.y === currentPlayerTarget.y &&
      this.deps.tileRefresh.canQueryWasmHelpers()
    ) {
      const didRefresh = this.deps.underPlayerItems.emitUnderPlayerItemGlyphIfAvailableAt(
        refreshTarget.x,
        refreshTarget.y,
        null,
        null,
        true,
        `inventory-assignment:${text}`,
      );
      if (didRefresh) {
        this.clearPendingPostActionPlayerTileRefresh(
          `inventory-assignment raw_print "${text}" (immediate helper refresh)`,
        );
        return;
      }
    }

    if (refreshTarget) {
      this.armPendingPostActionPlayerTileRefreshByReason(
        "autopickup-raw-print",
        `for inventory-assignment raw_print "${text}"`,
        refreshTarget,
        null,
      );
      return;
    }
  }

  maybeRefreshPendingPostActionPlayerTile(trigger = "unknown") {
    const pendingReason =
      typeof this.pendingPostActionPlayerTileRefreshReason === "string" &&
        this.pendingPostActionPlayerTileRefreshReason.trim().length > 0
        ? this.pendingPostActionPlayerTileRefreshReason.trim()
        : "";
    if (!pendingReason) {
      return false;
    }
    const pendingTarget =
      this.pendingPostActionPlayerTileRefreshTarget &&
        Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.x) &&
        Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.y)
        ? {
          x: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.x)),
          y: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.y)),
        }
        : null;

    const tileX = Number(this.deps.mapCallbacks.playerPosition?.x);
    const tileY = Number(this.deps.mapCallbacks.playerPosition?.y);
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
      return false;
    }

    const normalizedTileX = Math.trunc(Number(tileX));
    const normalizedTileY = Math.trunc(Number(tileY));
    if (
      pendingTarget &&
      (normalizedTileX !== pendingTarget.x || normalizedTileY !== pendingTarget.y)
    ) {
      console.log(
        `Waiting to refresh pending action (${pendingReason}) until player reaches (${pendingTarget.x}, ${pendingTarget.y}) [trigger=${trigger}, current=(${normalizedTileX}, ${normalizedTileY})]`,
      );
      return false;
    }

    if (
      pendingReason === "move-onto-lootlike-tile" &&
      this.pendingPostActionPlayerTileRefreshSnapshot
    ) {
      const pendingTargetTileData =
        pendingTarget ? this.deps.mapCallbacks.gameMap.get(`${pendingTarget.x},${pendingTarget.y}`) ?? null : null;
      const pendingTargetStillMatchesSnapshot =
        pendingTarget &&
        this.deps.underPlayerItems.doesRuntimeMapTileMatchUnderPlayerSnapshot(
          pendingTargetTileData,
          this.pendingPostActionPlayerTileRefreshSnapshot,
        );
      if (pendingTargetStillMatchesSnapshot) {
        return this.deps.underPlayerItems.emitUnderPlayerItemGlyphFromPendingSnapshot(
          `post-action:${pendingReason}:${trigger}`,
        );
      }
      if (this.deps.underPlayerItems.maybeEmitConfirmedBoulderPushEventFromRuntimeMap(trigger)) {
        return true;
      }
    }

    if (!this.deps.tileRefresh.canQueryWasmHelpers()) {
      console.log(
        `Deferring post-action top-item check (${pendingReason}) until helpers are queryable [trigger=${trigger}]`,
      );
      return false;
    }

    console.log(
      `Checking under-player top item after pending action (${pendingReason}) [trigger=${trigger}] at (${normalizedTileX}, ${normalizedTileY})`,
    );
    return this.deps.underPlayerItems.emitUnderPlayerItemGlyphIfAvailableAt(
      normalizedTileX,
      normalizedTileY,
      null,
      null,
      true,
      `post-action:${pendingReason}:${trigger}`,
    );
  }

  resolvePostActionPlayerTileRefreshQuestionContext(question = "") {
    const explicitQuestion =
      typeof question === "string" ? question.trim() : "";
    if (explicitQuestion) {
      return question;
    }

    if (
      this.deps.inputRequests.awaitingQuestionInput &&
      this.deps.questionInput.activeYnPrompt &&
      typeof this.deps.questionInput.lastQuestionText === "string" &&
      this.deps.questionInput.lastQuestionText.trim().length > 0
    ) {
      return this.deps.questionInput.lastQuestionText;
    }

    return "";
  }
}
