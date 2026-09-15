import * as THREE from "three";
import { TILE_SIZE, WALL_HEIGHT } from "../../constants";
import { classifyTileBehavior, isDoorwayCmapGlyph } from "../../glyphs/behavior";
import {
  replaceNetHackLookDescriptionSymbol,
  resolveTerminalCellPresentation
} from "../../terminal/terminal-display";
import type { TerrainSnapshot } from "../../types";
import type { FpsContextAction, FpsCrosshairContextState } from "../../ui-types";
import type {
  FpsCrosshairTargetHint,
  FpsCrosshairGlanceCacheEntry,
  FpsCrosshairGlancePending,
  TileContextTarget,
  TileFaceTextureRotationTarget
} from "../shared/types";
import type { AimHighlights } from "./aim-highlights";
import type { Camera } from "../camera/camera";
import type { ControllerGameplay } from "../input/controller-gameplay";
import type { DarkCorridorInference } from "../world/dark-corridor-inference";
import type { DirectionPrompts } from "./direction-prompts";
import type { EngineMessages } from "./engine-messages";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "../rendering/entity-billboards";
import type { ExtendedCommands } from "./extended-commands";
import type { InputCommands } from "../input/input-commands";
import type { LevelTerrainCache } from "../world/level-terrain-cache";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PointerLock } from "../input/pointer-lock";
import type { PointerTargeting } from "../input/pointer-targeting";
import type { PositionSelection } from "../input/position-selection";
import type { PromptDialogs } from "./prompt-dialogs";
import type { QuestionMenus } from "./question-menus";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { TerminalRendering } from "../rendering/terminal-rendering";
import type { TileFaceTextureRotationDebug } from "../diagnostics/tile-face-texture-rotation-debug";
import type { TileRendering } from "../rendering/tile-rendering";
import type { TilesetAssets } from "../rendering/tileset-assets";
import type { TileUpdates } from "../world/tile-updates";
import type { WorldClassification } from "../world/world-classification";

export interface TileContextActionsDependencies {
  readonly aimHighlights: Pick<
    AimHighlights,
    "applyContextHighlightRenderConfig"
    | "ensureFpsAimVisuals"
    | "fpsAimLinePulseUntilMs"
    | "fpsForwardHighlight"
    | "fpsForwardHighlightMaterial"
    | "resolveHighlightTargetZ"
  >;
  readonly camera: Pick<
    Camera,
    "camera"
    | "getActiveCamera"
    | "getFpsAimDirectionFromCamera"
  >;
  readonly controllerGameplay: Pick<
    ControllerGameplay,
    "controllerMoveHighlightTile"
  >;
  readonly darkCorridorInference: Pick<
    DarkCorridorInference,
    "getKnownTerrainSnapshotForInferenceAtKey"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
  >;
  readonly engineMessages: Pick<
    EngineMessages,
    "logClickLookTileDebug"
  >;
  readonly engineState: Pick<
    EngineState,
    "session"
    | "uiAdapter"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "monsterBillboards"
  >;
  readonly extendedCommands: Pick<
    ExtendedCommands,
    "metaCommandModeActive"
  >;
  readonly inputCommands: Pick<
    InputCommands,
    "clearAutomaticGlancePendingState"
    | "contextualGlanceProbePrefix"
    | "executeQuickAction"
    | "sendInput"
    | "sendInputSequence"
    | "sendMouseInput"
    | "shouldUseLegacyTileContextLookProbe"
    | "skipNextMobileFpsClickLookPromptMessage"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "parseTileStateSignature"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
    | "shouldUseFpsSelfTileDirectionTarget"
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
    | "getTileUnderFpsCrosshair"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "isFpsFarLookViewActive"
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
  readonly terminalRendering: Pick<
    TerminalRendering,
    "resolveSlashEmTerminalCmapIndex"
    | "terminalRenderOptionStates"
  >;
  readonly tileFaceTextureRotationDebug: Pick<
    TileFaceTextureRotationDebug,
    "cycleRotation" | "isEnabled"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "resolveRuntimeVersion"
    | "shouldUseVultureTiles"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "tileStateCache"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "isLootLikeBehavior"
    | "isMonsterLikeBehavior"
  >;
}

/** Context menus, runtime glance probes, tile action inference and contextual selection state. */
export class TileContextActions {
  constructor(private readonly dependencies: TileContextActionsDependencies) {}

  fpsCrosshairContextMenuOpen: boolean = false;

  fpsCrosshairContextSignature: string = "";

  normalTileContextMenuOpen: boolean = false;

  normalTileContextSignature: string = "";

  normalTileContextTarget: TileContextTarget | null = null;

  activeContextActionTile: { x: number; y: number } | null = null;

  activeFaceTextureRotationTarget: TileFaceTextureRotationTarget | null = null;

  selectedContextHighlightTile: { x: number; y: number } | null = null;

  vultureMouseHoverHighlightTile: { x: number; y: number } | null =
    null;

  suppressNextMapPrimaryPointerUntilMs: number = 0;

  readonly suppressNextMapPrimaryPointerWindowMs: number = 140;

  readonly fpsVoidContextMesh: THREE.Mesh = (() => {
    const mesh = new THREE.Mesh();
    mesh.userData = {
      isWall: true,
      materialKind: "rock",
      isMonsterLikeCharacter: false,
      isLootLikeCharacter: false,
    };
    return mesh;
  })();

  fpsCrosshairGlanceCache: Map<string, FpsCrosshairGlanceCacheEntry> =
    new Map();

  fpsCrosshairGlanceAttemptedKeys: Set<string> = new Set();

  fpsCrosshairGlanceIssuedThisOpen: boolean = false;

  fpsCrosshairGlancePending: FpsCrosshairGlancePending | null = null;

  fpsCrosshairGlanceRequestSequence: number = 0;

  readonly fpsCrosshairGlanceTimeoutMs: number = 2600;

  readonly fpsCrosshairGlanceSettleWindowMs: number = 450;

  readonly fpsCrosshairGlanceMaxLines: number = 8;

  isContainerLikeGroundLootText(glanceText: string | null): boolean {
    const normalizedGlanceText = String(glanceText || "").toLowerCase();
    return /\b(chest|box|coffer|container|sack|bag)\b/.test(
      normalizedGlanceText,
    );
  }

  isCorpseLikeGroundLootText(glanceText: string | null): boolean {
    const normalizedGlanceText = String(glanceText || "").toLowerCase();
    return /\b(corpse)\b/.test(normalizedGlanceText);
  }

  tryRunFpsSelfTilePrimaryClickAction(): boolean {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return false;
    }

    if (!this.dependencies.movementInput.shouldUseFpsSelfTileDirectionTarget()) {
      return false;
    }

    const tileX = this.dependencies.playerMovement.playerPos.x;
    const tileY = this.dependencies.playerMovement.playerPos.y;
    const tileKey = `${tileX},${tileY}`;
    const tileMesh = this.dependencies.tileRendering.tileMap.get(tileKey);
    if (!tileMesh || Boolean(tileMesh.userData?.isWall)) {
      return false;
    }

    const nowMs = Date.now();
    const glanceEntry = this.getCachedFpsCrosshairGlanceEntry(tileKey, nowMs);
    const glanceText = glanceEntry?.sourceText ?? "";
    const isContainerLikeLoot = this.isContainerLikeGroundLootText(glanceText);
    const actions = this.getFpsCrosshairActionsForTile(
      tileKey,
      tileMesh,
      glanceEntry?.hint ?? null,
      glanceText,
    );
    const hasQuickAction = (id: string): boolean =>
      actions.some((action) => action.kind === "quick" && action.id === id);

    let actionId: string | null = null;
    if (hasQuickAction("ascend")) {
      actionId = "ascend";
    } else if (hasQuickAction("descend")) {
      actionId = "descend";
    } else if (isContainerLikeLoot && hasQuickAction("loot")) {
      actionId = "loot";
    } else if (hasQuickAction("pickup")) {
      actionId = "pickup";
    }

    if (!actionId) {
      return false;
    }

    return this.dependencies.inputCommands.executeQuickAction(actionId, true);
  }

  tryRunFpsDoorPrimaryClickAction(): boolean {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return false;
    }

    let target = this.dependencies.pointerTargeting.getTileUnderFpsCrosshair();
    if (!target) {
      const aim = this.dependencies.camera.getFpsAimDirectionFromCamera();
      if (!aim) {
        return false;
      }
      const tileX = this.dependencies.playerMovement.playerPos.x + aim.dx;
      const tileY = this.dependencies.playerMovement.playerPos.y + aim.dy;
      const tileKey = `${tileX},${tileY}`;
      const tileMesh = this.dependencies.tileRendering.tileMap.get(tileKey);
      if (!tileMesh) {
        return false;
      }
      target = { key: tileKey, x: tileX, y: tileY, mesh: tileMesh };
    }

    const nowMs = Date.now();
    const glanceEntry = this.getCachedFpsCrosshairGlanceEntry(
      target.key,
      nowMs,
    );
    const glanceHint = glanceEntry?.hint ?? null;
    const materialKind =
      typeof target.mesh.userData?.materialKind === "string"
        ? target.mesh.userData.materialKind
        : "";
    if (materialKind !== "door" && glanceHint !== "door") {
      return false;
    }

    return this.dependencies.inputCommands.executeQuickAction("open", true, true);
  }

  clearFpsCrosshairContextMenu(): void {
    if (!this.fpsCrosshairContextSignature) {
      return;
    }
    this.fpsCrosshairContextSignature = "";
    this.activeContextActionTile = null;
    this.activeFaceTextureRotationTarget = null;
    this.dependencies.engineState.uiAdapter.setFpsCrosshairContext(null);
  }

  closeNormalTileContextMenu(
    consumeNextPrimaryPointer: boolean = false,
  ): void {
    if (
      !this.normalTileContextMenuOpen &&
      !this.normalTileContextSignature &&
      !this.selectedContextHighlightTile
    ) {
      return;
    }
    if (consumeNextPrimaryPointer) {
      this.suppressNextMapPrimaryPointerUntilMs =
        Date.now() + this.suppressNextMapPrimaryPointerWindowMs;
    }
    this.normalTileContextMenuOpen = false;
    this.normalTileContextSignature = "";
    this.normalTileContextTarget = null;
    this.activeContextActionTile = null;
    this.activeFaceTextureRotationTarget = null;
    this.clearContextSelectionHighlight();
    this.dependencies.engineState.uiAdapter.setFpsCrosshairContext(null);
  }

  closeAnyTileContextMenu(restorePointerLock: boolean): void {
    if (this.fpsCrosshairContextMenuOpen || this.fpsCrosshairContextSignature) {
      this.closeFpsCrosshairContextMenu(restorePointerLock);
      return;
    }
    this.closeNormalTileContextMenu();
  }

  clearContextSelectionHighlight(): void {
    this.selectedContextHighlightTile = null;
  }

  shouldConsumeSuppressedMapPrimaryPointerEvent(
    targetIsCanvas: boolean,
  ): boolean {
    if (!targetIsCanvas) {
      return false;
    }
    const nowMs = Date.now();
    if (nowMs > this.suppressNextMapPrimaryPointerUntilMs) {
      return false;
    }
    this.suppressNextMapPrimaryPointerUntilMs = 0;
    return true;
  }

  setContextSelectionHighlight(tileX: number, tileY: number): void {
    this.selectedContextHighlightTile = { x: tileX, y: tileY };
  }

  clearVultureMouseHoverHighlight(): void {
    this.vultureMouseHoverHighlightTile = null;
  }

  updateVultureMouseHoverHighlightFromMouseEvent(
    event: MouseEvent,
  ): void {
    if (!this.dependencies.tilesetAssets.shouldUseVultureTiles() || this.dependencies.promptDialogs.isAnyModalVisible()) {
      this.clearVultureMouseHoverHighlight();
      return;
    }
    if (event.target !== this.dependencies.renderPipeline.renderer.domElement) {
      this.clearVultureMouseHoverHighlight();
      return;
    }
    const target = this.dependencies.pointerTargeting.getTilePositionFromClientCoordinates(
      event.clientX,
      event.clientY,
    );
    if (!target) {
      this.clearVultureMouseHoverHighlight();
      return;
    }
    this.vultureMouseHoverHighlightTile = { x: target.x, y: target.y };
  }

  openNormalTileContextMenuAtTarget(target: TileContextTarget): void {
    if (this.dependencies.movementInput.isFpsMode()) {
      return;
    }
    this.fpsCrosshairGlanceCache.clear();
    this.fpsCrosshairGlanceAttemptedKeys.clear();
    this.fpsCrosshairGlanceIssuedThisOpen = false;
    this.dependencies.inputCommands.clearAutomaticGlancePendingState();
    this.normalTileContextMenuOpen = true;
    this.normalTileContextTarget = target;
    this.normalTileContextSignature = "";
    this.setContextSelectionHighlight(target.x, target.y);
    this.updateNormalTileContextMenu();
  }

  openFpsCrosshairContextMenu(): void {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return;
    }
    this.fpsCrosshairGlanceCache.clear();
    this.fpsCrosshairGlanceAttemptedKeys.clear();
    this.fpsCrosshairGlanceIssuedThisOpen = false;
    this.dependencies.inputCommands.clearAutomaticGlancePendingState();
    this.fpsCrosshairContextMenuOpen = true;
    this.dependencies.pointerLock.syncFpsPointerLockForUiState(false);
    this.updateFpsCrosshairContextMenu();
  }

  closeFpsCrosshairContextMenu(restorePointerLock: boolean): void {
    if (
      !this.fpsCrosshairContextMenuOpen &&
      !this.fpsCrosshairContextSignature
    ) {
      return;
    }
    this.fpsCrosshairContextMenuOpen = false;
    this.fpsCrosshairGlanceIssuedThisOpen = false;
    this.dependencies.inputCommands.clearAutomaticGlancePendingState();
    this.activeContextActionTile = null;
    this.activeFaceTextureRotationTarget = null;
    this.clearContextSelectionHighlight();
    this.clearFpsCrosshairContextMenu();
    if (restorePointerLock) {
      this.dependencies.pointerLock.syncFpsPointerLockForUiState(true);
    }
  }

  sanitizeFpsCrosshairGlanceText(rawText: string): string {
    return String(rawText || "")
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  resolveFpsCrosshairGlanceDisplayChar(tileKey: string): string | null {
    const signature = this.dependencies.tileUpdates.tileStateCache.get(tileKey);
    const tile = signature ? this.dependencies.levelTerrainCache.parseTileStateSignature(signature) : null;
    if (!tile) {
      return null;
    }
    const presentation = resolveTerminalCellPresentation({
      char: tile.char ?? null,
      color: tile.color ?? null,
      glyphFlags: tile.glyphFlags ?? null,
      optionStates: this.dependencies.terminalRendering.terminalRenderOptionStates,
      slashEmCmapIndex: this.dependencies.terminalRendering.resolveSlashEmTerminalCmapIndex(tile.glyph),
    });
    return presentation.displayChar.trim().length > 0
      ? presentation.displayChar
      : null;
  }

  normalizeFpsCrosshairGlanceText(
    rawText: string,
    tileKey: string,
  ): string {
    const displayChar = this.resolveFpsCrosshairGlanceDisplayChar(tileKey);
    return this.sanitizeFpsCrosshairGlanceText(
      replaceNetHackLookDescriptionSymbol(rawText, displayChar),
    );
  }

  mergeFpsCrosshairGlanceSourceText(
    existingSourceText: string,
    nextLineText: string,
  ): { mergedText: string; changed: boolean } {
    const existingLines = String(existingSourceText || "")
      .split(/\r?\n+/)
      .map((line) => this.sanitizeFpsCrosshairGlanceText(line))
      .filter((line) => line.length > 0);
    const nextLine = this.sanitizeFpsCrosshairGlanceText(nextLineText);
    if (!nextLine) {
      return {
        mergedText: existingLines.join("\n"),
        changed: false,
      };
    }

    const seenLines = new Set(existingLines.map((line) => line.toLowerCase()));
    let changed = false;
    if (!seenLines.has(nextLine.toLowerCase())) {
      existingLines.push(nextLine);
      changed = true;
    }

    const cappedLines =
      existingLines.length > this.fpsCrosshairGlanceMaxLines
        ? existingLines.slice(-this.fpsCrosshairGlanceMaxLines)
        : existingLines;
    if (cappedLines.length !== existingLines.length) {
      changed = true;
    }
    return {
      mergedText: cappedLines.join("\n"),
      changed,
    };
  }

  shouldIgnoreFpsCrosshairGlanceText(text: string): boolean {
    const normalized = text.toLowerCase();
    if (!normalized) {
      return true;
    }
    if (/^pick (an?|the)? ?object\b/.test(normalized)) {
      return true;
    }
    if (
      normalized.startsWith("pick ") &&
      normalized.includes("monster, object or location")
    ) {
      return true;
    }
    if (normalized.startsWith("please move the cursor")) {
      return true;
    }
    if (normalized.includes("what do you want to look at")) {
      return true;
    }
    return false;
  }

  inferFpsCrosshairTargetHintFromGlanceText(
    text: string,
  ): FpsCrosshairTargetHint {
    const normalized = text.toLowerCase();

    if (
      /(?:staircase|stairs|stairway|ladder).*\bup\b/.test(normalized) ||
      /\bup\b.*(?:staircase|stairs|stairway|ladder)/.test(normalized)
    ) {
      return "stairs_up";
    }
    if (
      /(?:staircase|stairs|stairway|ladder).*\bdown\b/.test(normalized) ||
      /\bdown\b.*(?:staircase|stairs|stairway|ladder)/.test(normalized)
    ) {
      return "stairs_down";
    }
    if (/\bdoor\b/.test(normalized)) {
      return "door";
    }
    if (/\btrap\b/.test(normalized)) {
      return "trap";
    }
    if (/\b(fountain|sink|pool|water|moat|lava)\b/.test(normalized)) {
      return "water";
    }
    if (
      /\b(altar|throne|grave|headstone|tree|bars|boulder|statue)\b/.test(
        normalized,
      )
    ) {
      return "feature";
    }
    if (/\b(wall|rock)\b/.test(normalized)) {
      return "wall";
    }
    if (
      /\b(you see here|there is|lying here|on the floor)\b/.test(normalized) ||
      /\b(gold|coin|corpse|potion|scroll|ring|wand|spellbook|weapon|armor|amulet|gem|food)\b/.test(
        normalized,
      )
    ) {
      return "loot";
    }
    if (
      /\b(peaceful|hostile|tame|asleep|sleeping|fleeing)\b/.test(normalized) ||
      /\bis here\b/.test(normalized)
    ) {
      return "monster";
    }
    if (/\b(floor|room|corridor|passage)\b/.test(normalized)) {
      return "floor";
    }
    if (normalized.includes("never heard")) {
      return "unknown";
    }
    return "unknown";
  }

  captureFpsCrosshairGlanceMessage(messageLike: unknown): void {
    if (!this.fpsCrosshairGlancePending || typeof messageLike !== "string") {
      return;
    }

    const pending = this.fpsCrosshairGlancePending;
    const text = this.normalizeFpsCrosshairGlanceText(
      messageLike,
      pending.tileKey,
    );
    if (!text || this.shouldIgnoreFpsCrosshairGlanceText(text)) {
      return;
    }

    const cachedEntry = this.fpsCrosshairGlanceCache.get(pending.tileKey);
    const merged = this.mergeFpsCrosshairGlanceSourceText(
      cachedEntry?.sourceText ?? "",
      text,
    );
    if (!merged.changed && cachedEntry) {
      return;
    }
    const hint = this.inferFpsCrosshairTargetHintFromGlanceText(
      merged.mergedText,
    );
    this.fpsCrosshairGlanceCache.set(pending.tileKey, {
      hint,
      sourceText: merged.mergedText,
      updatedAtMs: Date.now(),
    });
    pending.lastCapturedMessageAtMs = Date.now();
    if (pending.commandKind === "glance" && !pending.targetClickSent) {
      // Ignore pre-target text for #glance probes until target click is sent.
      this.fpsCrosshairContextSignature = "";
      return;
    }
    this.fpsCrosshairContextSignature = "";
  }

  expireFpsCrosshairGlanceState(nowMs: number): void {
    const pending = this.fpsCrosshairGlancePending;
    if (!pending) {
      return;
    }
    if (nowMs - pending.startedAtMs > this.fpsCrosshairGlanceTimeoutMs) {
      this.dependencies.inputCommands.clearAutomaticGlancePendingState();
      return;
    }
    if (pending.lastCapturedMessageAtMs === null) {
      return;
    }
    const positionFlowResolved =
      pending.commandKind === "colon" ||
      !pending.sawPositionInput ||
      pending.positionResolvedAtMs !== null;
    if (!positionFlowResolved) {
      return;
    }
    if (
      nowMs - pending.lastCapturedMessageAtMs >
      this.fpsCrosshairGlanceSettleWindowMs
    ) {
      this.dependencies.inputCommands.clearAutomaticGlancePendingState();
    }
  }

  getCachedFpsCrosshairGlanceEntry(
    tileKey: string,
    _nowMs: number,
  ): FpsCrosshairGlanceCacheEntry | null {
    const cached = this.fpsCrosshairGlanceCache.get(tileKey);
    if (!cached) {
      return null;
    }
    return cached;
  }

  startTileContextGlanceProbe(
    target: { key: string; x: number; y: number },
    nowMs: number,
  ): void {
    if (
      !this.dependencies.engineState.session ||
      !(this.fpsCrosshairContextMenuOpen || this.normalTileContextMenuOpen)
    ) {
      return;
    }
    if (
      this.dependencies.questionMenus.isInQuestion ||
      this.dependencies.directionPrompts.isInDirectionQuestion ||
      this.dependencies.promptDialogs.isTextInputActive ||
      this.dependencies.extendedCommands.metaCommandModeActive ||
      this.dependencies.promptDialogs.isInventoryDialogOpen() ||
      this.dependencies.promptDialogs.isInfoDialogOpen()
    ) {
      return;
    }

    const cached = this.getCachedFpsCrosshairGlanceEntry(target.key, nowMs);
    if (cached !== null) {
      return;
    }
    if (this.fpsCrosshairGlanceIssuedThisOpen) {
      return;
    }
    if (this.fpsCrosshairGlanceAttemptedKeys.has(target.key)) {
      return;
    }

    if (this.fpsCrosshairGlancePending) {
      const pendingAgeMs = nowMs - this.fpsCrosshairGlancePending.startedAtMs;
      if (this.fpsCrosshairGlancePending.tileKey === target.key) {
        return;
      }
      if (pendingAgeMs <= this.fpsCrosshairGlanceTimeoutMs) {
        return;
      }
      this.dependencies.inputCommands.clearAutomaticGlancePendingState();
    }

    this.fpsCrosshairGlancePending = {
      requestId: ++this.fpsCrosshairGlanceRequestSequence,
      tileKey: target.key,
      tileX: target.x,
      tileY: target.y,
      startedAtMs: nowMs,
      sawPositionInput: false,
      positionResolvedAtMs: null,
      targetClickSent: false,
      lastCapturedMessageAtMs: null,
      commandKind: "glance",
    };
    this.fpsCrosshairGlanceAttemptedKeys.add(target.key);
    this.fpsCrosshairGlanceIssuedThisOpen = true;

    const isPlayerTile =
      target.x === this.dependencies.playerMovement.playerPos.x && target.y === this.dependencies.playerMovement.playerPos.y;
    if (isPlayerTile) {
      this.fpsCrosshairGlancePending.commandKind = "colon";
      this.fpsCrosshairGlancePending.targetClickSent = true;
      this.dependencies.inputCommands.sendInput(":", { keepContextMenuOpen: true });
      this.dependencies.engineMessages.logClickLookTileDebug("fps-glance", target.x, target.y);
      return;
    }

    this.dependencies.inputCommands.skipNextMobileFpsClickLookPromptMessage = true;
    if (this.dependencies.inputCommands.shouldUseLegacyTileContextLookProbe()) {
      // Slash'EM's legacy 3.4.3-based runtime uses one-shot ';' far-look
      // rather than supporting #glance. That path already exits after the
      // click lands, so do not arm the runtime's synthetic follow-up cancel.
      this.dependencies.inputCommands.sendInput(";", { keepContextMenuOpen: true });
      this.dependencies.engineMessages.logClickLookTileDebug("fps-look-legacy", target.x, target.y);
    } else {
      // Suppress transient look prompts generated by the synthetic glance flow
      // and arm the runtime-side follow-up cancel for the extra position wait.
      this.dependencies.inputCommands.sendInput(this.dependencies.inputCommands.contextualGlanceProbePrefix, {
        keepContextMenuOpen: true,
      });
      this.dependencies.inputCommands.sendInputSequence(["#", "g", "l", "a", "n", "c", "e", "Enter"], {
        keepContextMenuOpen: true,
      });
      this.dependencies.engineMessages.logClickLookTileDebug("fps-glance", target.x, target.y);
    }
    this.fpsCrosshairGlancePending.targetClickSent = true;
    this.dependencies.inputCommands.sendMouseInput(target.x, target.y, 0, { keepContextMenuOpen: true });
  }

  getFpsCrosshairHintFromTile(
    key: string,
    mesh: THREE.Mesh,
  ): FpsCrosshairTargetHint {
    const [rawX, rawY] = key.split(",");
    const tileX = Number.parseInt(rawX, 10);
    const tileY = Number.parseInt(rawY, 10);
    const isPlayerTile =
      Number.isFinite(tileX) &&
      Number.isFinite(tileY) &&
      tileX === this.dependencies.playerMovement.playerPos.x &&
      tileY === this.dependencies.playerMovement.playerPos.y;
    if (
      !isPlayerTile &&
      (Boolean(mesh.userData?.isMonsterLikeCharacter) ||
        this.dependencies.entityBillboards.monsterBillboards.has(key))
    ) {
      return "monster";
    }
    if (Boolean(mesh.userData?.isLootLikeCharacter)) {
      return "loot";
    }
    const knownTerrain = this.dependencies.darkCorridorInference.getKnownTerrainSnapshotForInferenceAtKey(key);
    if (
      knownTerrain &&
      typeof knownTerrain.glyph === "number" &&
      isDoorwayCmapGlyph(knownTerrain.glyph)
    ) {
      return "door";
    }
    const materialKind =
      typeof mesh.userData?.materialKind === "string"
        ? mesh.userData.materialKind
        : "";
    if (materialKind === "door") {
      return "door";
    }
    if (materialKind === "stairs_up") {
      return "stairs_up";
    }
    if (materialKind === "stairs_down") {
      return "stairs_down";
    }
    if (materialKind === "water" || materialKind === "fountain") {
      return "water";
    }
    if (materialKind === "trap") {
      return "trap";
    }
    if (materialKind === "feature") {
      return "feature";
    }
    if (Boolean(mesh.userData?.isWall)) {
      return "wall";
    }
    return "floor";
  }

  getContextTitleFromHintWithColon(
    hint: FpsCrosshairTargetHint,
  ): string {
    switch (hint) {
      case "monster":
        return ": monster";
      case "loot":
        return ": loot";
      case "door":
        return ": door";
      case "stairs_up":
        return ": staircase up";
      case "stairs_down":
        return ": staircase down";
      case "wall":
        return ": wall";
      case "water":
        return ": water";
      case "trap":
        return ": trap";
      case "feature":
        return ": feature";
      case "floor":
        return ": floor";
      default:
        return ": tile";
    }
  }

  createContextInferenceMeshFromTerrain(
    terrain: TerrainSnapshot,
  ): THREE.Mesh {
    const behavior = classifyTileBehavior({
      glyph: terrain.glyph,
      runtimeChar: terrain.char ?? null,
      runtimeColor: typeof terrain.color === "number" ? terrain.color : null,
      runtimeTileIndex:
        typeof terrain.tileIndex === "number" ? terrain.tileIndex : null,
      priorTerrain: terrain,
    });
    const mesh = new THREE.Mesh();
    mesh.userData = {
      isWall: behavior.isWall,
      materialKind: behavior.materialKind,
      isMonsterLikeCharacter: this.dependencies.worldClassification.isMonsterLikeBehavior(behavior),
      isLootLikeCharacter: this.dependencies.worldClassification.isLootLikeBehavior(behavior),
      sourceGlyph: terrain.glyph,
    };
    return mesh;
  }

  resolveContextActionTarget(target: TileContextTarget): {
    actionMesh: THREE.Mesh;
    allowGlanceProbe: boolean;
    fallbackTitle: string | null;
    glanceHintOverride: FpsCrosshairTargetHint | null;
  } {
    const isPlayerTile =
      target.x === this.dependencies.playerMovement.playerPos.x && target.y === this.dependencies.playerMovement.playerPos.y;
    if (!isPlayerTile) {
      const hint = this.getFpsCrosshairHintFromTile(target.key, target.mesh);
      return {
        actionMesh: target.mesh,
        allowGlanceProbe: true,
        fallbackTitle: this.getContextTitleFromHintWithColon(hint),
        glanceHintOverride: null,
      };
    }

    const terrain = this.dependencies.darkCorridorInference.getKnownTerrainSnapshotForInferenceAtKey(target.key);
    if (!terrain) {
      return {
        actionMesh: target.mesh,
        allowGlanceProbe: true,
        fallbackTitle: null,
        glanceHintOverride: null,
      };
    }
    const inferredMesh = this.createContextInferenceMeshFromTerrain(terrain);
    const hint = this.getFpsCrosshairHintFromTile(target.key, inferredMesh);
    return {
      actionMesh: inferredMesh,
      allowGlanceProbe: true,
      fallbackTitle: this.getContextTitleFromHintWithColon(hint),
      glanceHintOverride: hint,
    };
  }

  getTileContextAnchorClientPosition(
    target: TileContextTarget,
  ): { x: number; y: number } | null {
    if (!this.dependencies.renderPipeline.renderer || !this.dependencies.camera.camera) {
      return null;
    }
    const rect = this.dependencies.renderPipeline.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    const z =
      target.mesh?.userData?.isWall === true ? WALL_HEIGHT + 0.04 : 0.04;
    const world = new THREE.Vector3(
      target.x * TILE_SIZE,
      -target.y * TILE_SIZE,
      z,
    );
    world.project(this.dependencies.camera.getActiveCamera());
    if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) {
      return null;
    }
    const x = rect.left + ((world.x + 1) * rect.width) / 2;
    const y = rect.top + ((1 - world.y) * rect.height) / 2;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { x, y };
  }

  getFpsCrosshairActionsForTile(
    key: string,
    mesh: THREE.Mesh,
    glanceHint: FpsCrosshairTargetHint | null = null,
    glanceText: string | null = null,
    faceTextureRotationTarget: TileFaceTextureRotationTarget | null = null,
  ): FpsContextAction[] {
    const actions: FpsContextAction[] = [];
    const finalizeActions = (
      options: {
        includeCast?: boolean;
        includeTechnique?: boolean;
      } = {},
    ): FpsContextAction[] => {
      if (options.includeCast) {
        addExtendedAction("cast", "Cast");
      }
      if (options.includeTechnique) {
        addExtendedAction("technique", "Technique");
      }
      addContextualAction("info", "Info");
      const infoIndex = actions.findIndex(
        (action) => action.kind === "contextual" && action.id === "info",
      );
      if (infoIndex >= 0 && infoIndex !== actions.length - 1) {
        const [infoAction] = actions.splice(infoIndex, 1);
        if (infoAction) {
          actions.push(infoAction);
        }
      }
      if (
        faceTextureRotationTarget &&
        this.dependencies.tileFaceTextureRotationDebug.isEnabled()
      ) {
        actions.push({
          id: "rotate-face-texture",
          label: `Debug: Rotate ${faceTextureRotationTarget.face} face 90 degrees`,
          kind: "debug",
          value: "rotate-face-texture",
        });
      }
      return actions;
    };
    const addQuickAction = (id: string, label: string, value: string = id) => {
      if (
        actions.some((action) => action.id === id && action.kind === "quick")
      ) {
        return;
      }
      actions.push({
        id,
        label,
        kind: "quick",
        value,
      });
    };
    const addExtendedAction = (
      id: string,
      label: string,
      value: string = id,
    ) => {
      if (
        actions.some((action) => action.id === id && action.kind === "extended")
      ) {
        return;
      }
      actions.push({
        id,
        label,
        kind: "extended",
        value,
      });
    };
    const addContextualAction = (
      id: string,
      label: string,
      value: string = id,
    ) => {
      if (
        actions.some(
          (action) => action.id === id && action.kind === "contextual",
        )
      ) {
        return;
      }
      actions.push({
        id,
        label,
        kind: "contextual",
        value,
      });
    };

    let isMonster =
      Boolean(mesh.userData?.isMonsterLikeCharacter) ||
      this.dependencies.entityBillboards.monsterBillboards.has(key);
    let isLoot = Boolean(mesh.userData?.isLootLikeCharacter);
    let isWall = Boolean(mesh.userData?.isWall);
    let materialKind =
      typeof mesh.userData?.materialKind === "string"
        ? mesh.userData.materialKind
        : "";
    const knownTerrain = this.dependencies.darkCorridorInference.getKnownTerrainSnapshotForInferenceAtKey(key);
    if (
      knownTerrain &&
      typeof knownTerrain.glyph === "number" &&
      isDoorwayCmapGlyph(knownTerrain.glyph) &&
      !isMonster &&
      !isLoot
    ) {
      const doorwayBehavior = classifyTileBehavior({
        glyph: knownTerrain.glyph,
        runtimeChar: knownTerrain.char ?? null,
        runtimeColor:
          typeof knownTerrain.color === "number" ? knownTerrain.color : null,
        runtimeTileIndex:
          typeof knownTerrain.tileIndex === "number"
            ? knownTerrain.tileIndex
            : null,
        priorTerrain: knownTerrain,
      });
      materialKind = "door";
      isWall = doorwayBehavior.isWall;
    }
    const normalizedGlanceText = String(glanceText || "").toLowerCase();
    const glanceSaysClosedDoor = /\bclosed door\b/.test(normalizedGlanceText);
    const glanceSuggestsEdibleLoot =
      /\b(corpse|food|ration|tin|egg|tripe|carcass)\b/.test(
        normalizedGlanceText,
      );
    const glanceSuggestsContainerLoot =
      this.isContainerLikeGroundLootText(glanceText);
    const glanceSuggestCorpse = this.isCorpseLikeGroundLootText(glanceText);
    let isTargetPlayerTile = true;
    {
      const [rawX, rawY] = key.split(",");
      const tileX = Number.parseInt(rawX, 10);
      const tileY = Number.parseInt(rawY, 10);
      if (Number.isFinite(tileX) && Number.isFinite(tileY)) {
        isTargetPlayerTile =
          tileX === this.dependencies.playerMovement.playerPos.x && tileY === this.dependencies.playerMovement.playerPos.y;
      }
    }
    if (glanceHint) {
      switch (glanceHint) {
        case "monster":
          isMonster = true;
          isLoot = false;
          break;
        case "loot":
          isLoot = true;
          break;
        case "door":
          materialKind = "door";
          isLoot = false;
          isMonster = false;
          if (glanceSaysClosedDoor) {
            // Closed doors are interactable even when the tile mesh is wall-like.
            isWall = false;
          }
          break;
        case "stairs_up":
          materialKind = "stairs_up";
          isWall = false;
          break;
        case "stairs_down":
          materialKind = "stairs_down";
          isWall = false;
          break;
        case "water":
          materialKind = "water";
          isWall = false;
          break;
        case "trap":
          materialKind = "trap";
          isWall = false;
          break;
        case "feature":
          materialKind = "feature";
          isWall = false;
          break;
        case "wall":
          isWall = true;
          break;
        case "floor":
          isWall = false;
          break;
        default:
          break;
      }
    }
    if (isTargetPlayerTile) {
      // The player's own tile should still allow self-tile actions (loot/pickup).
      isMonster = false;
    }
    const isStairsUp = materialKind === "stairs_up";
    const isStairsDown = materialKind === "stairs_down";
    const supportsTipContextAction = this.dependencies.tilesetAssets.resolveRuntimeVersion() !== "slashem";
    const supportsCastContextAction = isTargetPlayerTile || isMonster;
    const supportsTechniqueContextAction =
      this.dependencies.tilesetAssets.resolveRuntimeVersion() === "slashem" &&
      (isTargetPlayerTile || isMonster);

    if (glanceSuggestCorpse) {
      addQuickAction("pickup", "Pick Up");
      addQuickAction("eat", "Eat");
    }

    if (glanceSuggestsContainerLoot) {
      if (supportsTipContextAction) {
        addExtendedAction("tip", "Tip");
      }
      addExtendedAction("force", "Force");
      addExtendedAction("apply", "Apply");
    }

    if (isStairsUp) {
      addQuickAction("ascend", "Ascend (<)");
    }
    if (isStairsDown) {
      addQuickAction("descend", "Descend (>)");
    }

    if (!isTargetPlayerTile) {
      addExtendedAction("kick", "Kick");
      addExtendedAction("throw", "Throw");
      addExtendedAction("fire", "Fire");
    }

    if (isMonster) {
      addQuickAction("search", "Search");
      return finalizeActions({
        includeCast: supportsCastContextAction,
        includeTechnique: supportsTechniqueContextAction,
      });
    }

    if (isLoot) {
      if (isTargetPlayerTile) {
        addQuickAction("pickup", "Pick Up");
        addQuickAction("loot", "Loot");
        addQuickAction("eat", "Eat");
      }
      return finalizeActions({
        includeCast: supportsCastContextAction,
        includeTechnique: supportsTechniqueContextAction,
      });
    }

    if (materialKind === "door") {
      addQuickAction("open", "Open");
      addQuickAction("close", "Close");
      addExtendedAction("kick", "Kick");
      addQuickAction("search", "Search");
      return finalizeActions({
        includeCast: supportsCastContextAction,
        includeTechnique: supportsTechniqueContextAction,
      });
    }

    if (isStairsUp || isStairsDown) {
      addQuickAction("search", "Search");
      if (isTargetPlayerTile) {
        addQuickAction("pickup", "Pick Up");
      }
      return finalizeActions({
        includeCast: supportsCastContextAction,
        includeTechnique: supportsTechniqueContextAction,
      });
    }

    if (materialKind === "water" || materialKind === "fountain") {
      addQuickAction("quaff", "Quaff");
    }

    if (
      materialKind === "water" ||
      materialKind === "fountain" ||
      materialKind === "trap" ||
      materialKind === "feature"
    ) {
      addQuickAction("search", "Search");
      addQuickAction("pickup", "Pick Up");
      return finalizeActions({
        includeCast: supportsCastContextAction,
        includeTechnique: supportsTechniqueContextAction,
      });
    }

    if (isWall) {
      addQuickAction("search", "Search");
      return finalizeActions({
        includeCast: supportsCastContextAction,
        includeTechnique: supportsTechniqueContextAction,
      });
    }

    addQuickAction("search", "Search");
    if (isTargetPlayerTile) {
      addQuickAction("pickup", "Pick Up");
      addQuickAction("loot", "Loot");
      if (glanceSuggestsContainerLoot && supportsTipContextAction) {
        addExtendedAction("tip", "Tip");
      }
      if (glanceSuggestsEdibleLoot) {
        addQuickAction("eat", "Eat");
      }
    }
    return finalizeActions({
      includeCast: supportsCastContextAction,
      includeTechnique: supportsTechniqueContextAction,
    });
  }

  getFpsCrosshairTitle(
    key: string,
    mesh: THREE.Mesh,
    glanceHint: FpsCrosshairTargetHint | null = null,
    glanceText: string | null = null,
  ): string {
    const glanceTitle = String(glanceText || "")
      .split(/\r?\n+/)
      .map((line) =>
        String(line || "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter((line) => line.length > 0)
      .join(" | ");
    if (glanceTitle) {
      return glanceTitle;
    }

    const hint = glanceHint ?? this.getFpsCrosshairHintFromTile(key, mesh);
    switch (hint) {
      case "monster":
        return "Target: monster";
      case "loot":
        return "Target: loot";
      case "door":
        return "Target: door";
      case "stairs_up":
        return "Target: stairs up";
      case "stairs_down":
        return "Target: stairs down";
      case "wall":
        return "Target: wall";
      case "water":
        return "Target: water";
      case "trap":
        return "Target: trap";
      case "feature":
        return "Target: feature";
      default:
        return "Target: tile";
    }
  }

  updateFpsCrosshairContextMenu(): void {
    if (!this.dependencies.movementInput.isFpsMode() || !this.fpsCrosshairContextMenuOpen) {
      this.clearFpsCrosshairContextMenu();
      return;
    }

    const nowMs = Date.now();
    this.expireFpsCrosshairGlanceState(nowMs);
    const glanceProbePositionInputActive =
      this.dependencies.positionSelection.positionInputModeActive && this.fpsCrosshairGlancePending !== null;

    if (
      this.dependencies.questionMenus.isInQuestion ||
      this.dependencies.directionPrompts.isInDirectionQuestion ||
      this.dependencies.promptDialogs.isTextInputActive ||
      (this.dependencies.positionSelection.positionInputModeActive && !glanceProbePositionInputActive) ||
      this.dependencies.extendedCommands.metaCommandModeActive ||
      this.dependencies.promptDialogs.isInventoryDialogOpen() ||
      this.dependencies.promptDialogs.isInfoDialogOpen() ||
      this.dependencies.promptDialogs.isAnyModalVisible()
    ) {
      this.clearFpsCrosshairContextMenu();
      return;
    }

    let target = this.dependencies.pointerTargeting.getTileUnderFpsCrosshair();
    let treatAsVoidWallTarget = false;
    if (!target) {
      const aim = this.dependencies.camera.getFpsAimDirectionFromCamera();
      if (!aim) {
        this.clearFpsCrosshairContextMenu();
        return;
      }
      const fallbackX = this.dependencies.playerMovement.playerPos.x + aim.dx;
      const fallbackY = this.dependencies.playerMovement.playerPos.y + aim.dy;
      const fallbackKey = `${fallbackX},${fallbackY}`;
      const fallbackMesh =
        this.dependencies.tileRendering.tileMap.get(fallbackKey) ?? this.fpsVoidContextMesh;
      target = {
        key: fallbackKey,
        x: fallbackX,
        y: fallbackY,
        mesh: fallbackMesh,
      };
      treatAsVoidWallTarget = fallbackMesh === this.fpsVoidContextMesh;
    }

    const resolved = this.resolveContextActionTarget(target);
    if (!treatAsVoidWallTarget && resolved.allowGlanceProbe) {
      this.startTileContextGlanceProbe(target, nowMs);
    }
    const glanceEntry = treatAsVoidWallTarget
      ? null
      : this.getCachedFpsCrosshairGlanceEntry(target.key, nowMs);
    const glanceHint: FpsCrosshairTargetHint | null = treatAsVoidWallTarget
      ? "wall"
      : (resolved.glanceHintOverride ?? glanceEntry?.hint ?? null);
    const actions = this.getFpsCrosshairActionsForTile(
      target.key,
      resolved.actionMesh,
      glanceHint,
      glanceEntry?.sourceText ?? null,
      target.faceTextureRotationTarget ?? null,
    );
    if (actions.length === 0) {
      this.clearFpsCrosshairContextMenu();
      return;
    }

    let title = this.getFpsCrosshairTitle(
      target.key,
      resolved.actionMesh,
      glanceHint,
      glanceEntry?.sourceText ?? resolved.fallbackTitle,
    );
    if (
      !treatAsVoidWallTarget &&
      resolved.allowGlanceProbe &&
      glanceHint === null &&
      this.fpsCrosshairGlancePending &&
      this.fpsCrosshairGlancePending.tileKey === target.key
    ) {
      title = `${title} (scanning...)`;
    }
    const signature = `${target.x},${target.y}|${title}|${actions
      .map((action) => `${action.kind}:${action.id}:${action.value}`)
      .join(",")}`;
    if (signature === this.fpsCrosshairContextSignature) {
      return;
    }

    this.fpsCrosshairContextSignature = signature;
    this.activeContextActionTile = { x: target.x, y: target.y };
    this.activeFaceTextureRotationTarget =
      target.faceTextureRotationTarget ?? null;
    const state: FpsCrosshairContextState = {
      title,
      tileX: target.x,
      tileY: target.y,
      actions,
      autoDirectionFromFpsAim: true,
    };
    this.dependencies.engineState.uiAdapter.setFpsCrosshairContext(state);
  }

  updateNormalTileContextMenu(): void {
    if (this.dependencies.movementInput.isFpsMode() || !this.normalTileContextMenuOpen) {
      this.closeNormalTileContextMenu();
      return;
    }
    if (
      this.dependencies.questionMenus.isInQuestion ||
      this.dependencies.directionPrompts.isInDirectionQuestion ||
      this.dependencies.promptDialogs.isTextInputActive ||
      this.dependencies.positionSelection.positionInputModeActive ||
      this.dependencies.extendedCommands.metaCommandModeActive ||
      this.dependencies.promptDialogs.isInventoryDialogOpen() ||
      this.dependencies.promptDialogs.isInfoDialogOpen() ||
      this.dependencies.promptDialogs.isAnyModalVisible()
    ) {
      this.closeNormalTileContextMenu();
      return;
    }

    const currentTarget = this.normalTileContextTarget;
    if (!currentTarget) {
      this.closeNormalTileContextMenu();
      return;
    }

    const liveMesh = this.dependencies.tileRendering.tileMap.get(currentTarget.key);
    const target = liveMesh
      ? { ...currentTarget, mesh: liveMesh }
      : currentTarget;
    this.normalTileContextTarget = target;
    this.setContextSelectionHighlight(target.x, target.y);

    const nowMs = Date.now();
    this.expireFpsCrosshairGlanceState(nowMs);
    const resolved = this.resolveContextActionTarget(target);
    if (resolved.allowGlanceProbe) {
      this.startTileContextGlanceProbe(target, nowMs);
    }
    const glanceEntry = this.getCachedFpsCrosshairGlanceEntry(
      target.key,
      nowMs,
    );
    const glanceHint = resolved.glanceHintOverride ?? glanceEntry?.hint ?? null;
    const actions = this.getFpsCrosshairActionsForTile(
      target.key,
      resolved.actionMesh,
      glanceHint,
      glanceEntry?.sourceText ?? null,
      target.faceTextureRotationTarget ?? null,
    );
    if (actions.length === 0) {
      this.closeNormalTileContextMenu();
      return;
    }

    let title = this.getFpsCrosshairTitle(
      target.key,
      resolved.actionMesh,
      glanceHint,
      glanceEntry?.sourceText ?? resolved.fallbackTitle,
    );
    if (
      resolved.allowGlanceProbe &&
      glanceHint === null &&
      this.fpsCrosshairGlancePending &&
      this.fpsCrosshairGlancePending.tileKey === target.key
    ) {
      title = `${title} (scanning...)`;
    }
    const anchor = this.getTileContextAnchorClientPosition(target);
    const canvasRect = this.dependencies.renderPipeline.renderer.domElement.getBoundingClientRect();
    const fallbackAnchorX = Math.round(
      canvasRect.left + canvasRect.width * 0.5,
    );
    const fallbackAnchorY = Math.round(
      canvasRect.top + canvasRect.height * 0.5,
    );
    const anchorX =
      anchor && Number.isFinite(anchor.x)
        ? Math.round(anchor.x)
        : fallbackAnchorX;
    const anchorY =
      anchor && Number.isFinite(anchor.y)
        ? Math.round(anchor.y)
        : fallbackAnchorY;
    const signature = `${target.x},${target.y}|${title}|${actions
      .map((action) => `${action.kind}:${action.id}:${action.value}`)
      .join(",")}|${anchorX},${anchorY}`;
    if (signature === this.normalTileContextSignature) {
      return;
    }
    this.normalTileContextSignature = signature;
    this.activeContextActionTile = { x: target.x, y: target.y };
    this.activeFaceTextureRotationTarget =
      target.faceTextureRotationTarget ?? null;
    this.dependencies.engineState.uiAdapter.setFpsCrosshairContext({
      title,
      tileX: target.x,
      tileY: target.y,
      actions,
      autoDirectionFromFpsAim: false,
      anchorClientX: anchorX,
      anchorClientY: anchorY,
    });
  }

  rotateActiveFaceTexture(): void {
    const target = this.activeFaceTextureRotationTarget;
    if (!target || !this.dependencies.tileFaceTextureRotationDebug.isEnabled()) {
      return;
    }
    this.dependencies.tileFaceTextureRotationDebug.cycleRotation(target);
  }

  updateContextSelectionHighlight(timeMs: number): void {
    if (this.dependencies.positionSelection.isFpsFarLookViewActive()) {
      if (this.dependencies.aimHighlights.fpsForwardHighlight) {
        this.dependencies.aimHighlights.fpsForwardHighlight.visible = false;
      }
      return;
    }

    const highlightTile =
      this.selectedContextHighlightTile ??
      this.dependencies.controllerGameplay.controllerMoveHighlightTile ??
      this.vultureMouseHoverHighlightTile;
    const isSelectedContextHighlight =
      highlightTile === this.selectedContextHighlightTile;
    const isControllerHighlight =
      highlightTile === this.dependencies.controllerGameplay.controllerMoveHighlightTile;
    if (highlightTile) {
      this.dependencies.aimHighlights.ensureFpsAimVisuals();
      const { x, y } = highlightTile;
      const targetTile = this.dependencies.tileRendering.tileMap.get(`${x},${y}`) ?? null;
      if (targetTile && this.dependencies.aimHighlights.fpsForwardHighlight) {
        this.dependencies.aimHighlights.applyContextHighlightRenderConfig(targetTile);
        const targetZ = this.dependencies.aimHighlights.resolveHighlightTargetZ(targetTile);
        this.dependencies.aimHighlights.fpsForwardHighlight.position.set(
          x * TILE_SIZE,
          -y * TILE_SIZE,
          targetZ,
        );
        this.dependencies.aimHighlights.fpsForwardHighlight.visible = true;
        if (this.dependencies.aimHighlights.fpsForwardHighlightMaterial) {
          const pulse = timeMs <= this.dependencies.aimHighlights.fpsAimLinePulseUntilMs ? 1 : 0.45;
          this.dependencies.aimHighlights.fpsForwardHighlightMaterial.opacity = 0.2 + pulse * 0.32;
        }
        return;
      }
      if (isSelectedContextHighlight) {
        this.closeAnyTileContextMenu(false);
      } else if (isControllerHighlight) {
        this.dependencies.controllerGameplay.controllerMoveHighlightTile = null;
      } else {
        this.clearVultureMouseHoverHighlight();
      }
      return;
    }
    if (!this.dependencies.movementInput.isFpsMode() && this.dependencies.aimHighlights.fpsForwardHighlight) {
      this.dependencies.aimHighlights.fpsForwardHighlight.visible = false;
    }
  }
}
