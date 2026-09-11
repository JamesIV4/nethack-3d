import * as THREE from "three";
import { TILE_SIZE } from "../../constants";
import { classifyTileBehavior } from "../../glyphs/behavior";
import {
  buildTerminalCellTextureKey,
  defaultTerminalRenderOptionStates,
  resolveTerminalCellPresentation,
  resolveTerminalRenderOptionStates,
  splitNetHackOptionsString,
  type TerminalCellPresentation,
  type TerminalRenderOptionStates
} from "../../terminal/terminal-display";
import { getGlyphCatalogEntry, getGlyphCatalogRanges } from "../../glyphs/registry";
import type { TileUpdateOptions, TerminalCellTextureEntry } from "../shared/types";
import type { BloodGround } from "../effects/blood-ground";
import type { Camera } from "../camera/camera";
import type { EngineCoordinator } from "../engine-coordinator";
import type { DarkCorridorInference } from "../world/dark-corridor-inference";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "./entity-billboards";
import type { FloorOcclusion } from "./floor-occlusion";
import type { GlyphTextures } from "./glyph-textures";
import type { LevelTerrainCache } from "../world/level-terrain-cache";
import type { Lighting } from "./lighting";
import type { Minimap } from "../ui/minimap";
import type { PositionSelection } from "../input/position-selection";
import type { RenderPipeline } from "./render-pipeline";
import type { RuntimeEntityTracking } from "../world/runtime-entity-tracking";
import type { TileRendering } from "./tile-rendering";
import type { TileUpdates } from "../world/tile-updates";
import type { WallGeometry } from "./wall-geometry";
import type { WallOverlays } from "./wall-overlays";
import type { WorldClassification } from "../world/world-classification";

export interface TerminalRenderingDependencies {
  readonly bloodGround: Pick<
    BloodGround,
    "updateBloodGroundOverlayVisibility"
  >;
  readonly camera: Pick<
    Camera,
    "applyStandardCameraPresetForTopDownModes"
    | "cameraDistance"
    | "cameraFollowInitialized"
    | "cameraPanTargetX"
    | "cameraPanTargetY"
    | "cameraPanX"
    | "cameraPanY"
    | "terminalFitCameraDistance"
  >;
  readonly coordinator: Pick<
    EngineCoordinator,
    "applyPlayMode"
  >;
  readonly darkCorridorInference: Pick<
    DarkCorridorInference,
    "clearAllInferredDarkCorridorWallMeshes"
  >;
  readonly engineState: Pick<
    EngineState,
    "characterCreationConfig"
    | "clientOptions"
    | "mountElement"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "entityBlobShadows"
    | "monsterBillboards"
    | "removeEntityBlobShadow"
    | "removeMonsterBillboard"
  >;
  readonly floorOcclusion: Pick<
    FloorOcclusion,
    "clearFloorBlockAmbientOcclusion"
  >;
  readonly glyphTextures: Pick<
    GlyphTextures,
    "disposeGlyphOverlay"
    | "drawConnectedBoxDrawingGlyph"
    | "glyphOverlayMap"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "lastKnownTerrain"
  >;
  readonly lighting: Pick<
    Lighting,
    "markLightingDirty"
  >;
  readonly minimap: Pick<
    Minimap,
    "queueMinimapTileUpdate"
    | "setTerminalGutterMinimapState"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "clearPositionCursor"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "renderer"
    | "scene"
  >;
  readonly runtimeEntityTracking: Pick<
    RuntimeEntityTracking,
    "isRuntimeTrackedPlayerEntityId"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "activeEffectTileKeys"
    | "floorGeometry"
    | "tileMap"
    | "tileRevealStartMs"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "getLatestRuntimeGlobalsSnapshot"
  >;
  readonly wallGeometry: Pick<
    WallGeometry,
    "clearFpsWallChamferFloorMeshes"
  >;
  readonly wallOverlays: Pick<
    WallOverlays,
    "disposeAllWallSideTileOverlays"
    | "disposeIronBarsWallPlaneOverlay"
    | "disposeTransparentWallGroundPlaneOverlay"
    | "disposeVultureDoorPlaneOverlay"
    | "disposeVultureWallFaceOverlay"
    | "disposeVultureWallPlaneOverlay"
    | "disposeWallSideTileOverlay"
  >;
  readonly worldClassification: Pick<
    WorldClassification,
    "isDamageFlashableBehavior"
    | "isLootLikeBehavior"
    | "isMonsterLikeBehavior"
    | "isUndiscoveredKind"
    | "snapshotPersistentTerrainFromTile"
  >;
}

/** Terminal cells, texture rasterization and terminal display option lifecycle */
export class TerminalRendering {
  constructor(private readonly dependencies: TerminalRenderingDependencies) {}

  terminalCellTextureCache: Map<string, TerminalCellTextureEntry> =
    new Map();

  // Canvas textures are rasterized at the current snapped physical-pixel cell
  // size. This avoids resampling both text and procedural wall strokes.
  terminalRasterCellWidthPx: number = 16;

  terminalDesktopGutterActive: boolean = false;

  terminalGutterMinimapVisible: boolean = false;

  terminalRenderOptionStates: TerminalRenderOptionStates = {
    ...defaultTerminalRenderOptionStates,
  };

  // Height of one terminal cell on screen relative to its width. Real
  // terminal fonts are roughly twice as tall as they are wide.
  readonly terminalCellAspect: number = 2;

  readonly terminalMapColumns: number = 80;

  readonly terminalMapRows: number = 21;

  isTerminalDisplayMode(): boolean {
    return this.dependencies.engineState.clientOptions.tilesetMode === "terminal";
  }


  // Re-reads the NetHack option state relevant to terminal rendering
  // (hilite_pet, hilite_pile, use_inverse, symset) from the runtime's
  // configured NETHACKOPTIONS, falling back to the startup init options.
  // Returns true when the resolved states changed.
  refreshTerminalRenderOptionStates(): boolean {
    const snapshot = this.dependencies.tileUpdates.getLatestRuntimeGlobalsSnapshot() as {
      configuredNethackOptions?: unknown;
    } | null;
    const configuredTokens = splitNetHackOptionsString(
      snapshot?.configuredNethackOptions,
    );
    const startupTokens = Array.isArray(this.dependencies.engineState.characterCreationConfig.initOptions)
      ? this.dependencies.engineState.characterCreationConfig.initOptions
      : [];
    const nextStates = resolveTerminalRenderOptionStates([
      startupTokens,
      configuredTokens,
    ]);
    const previousStates = this.terminalRenderOptionStates;
    const changed =
      previousStates.hilitePet !== nextStates.hilitePet ||
      previousStates.hilitePile !== nextStates.hilitePile ||
      previousStates.useInverse !== nextStates.useInverse ||
      previousStates.symsetHint !== nextStates.symsetHint;
    this.terminalRenderOptionStates = nextStates;
    return changed;
  }


  // Suspends the 3D presentation (billboards, glyph overlays, AO, inferred
  // walls) and prepares the flat simulated-terminal view. Tile meshes are
  // reconfigured in place by the subsequent refreshTilesFromStateCache().
  enterTerminalDisplayMode(): void {
    this.dependencies.coordinator.applyPlayMode("normal");
    this.refreshTerminalRenderOptionStates();
    for (const key of Array.from(this.dependencies.entityBillboards.monsterBillboards.keys())) {
      this.dependencies.entityBillboards.removeMonsterBillboard(key);
    }
    for (const key of Array.from(this.dependencies.entityBillboards.entityBlobShadows.keys())) {
      this.dependencies.entityBillboards.removeEntityBlobShadow(key);
    }
    this.dependencies.glyphTextures.glyphOverlayMap.forEach((overlay) => {
      this.dependencies.glyphTextures.disposeGlyphOverlay(overlay);
    });
    this.dependencies.glyphTextures.glyphOverlayMap.clear();
    this.dependencies.wallOverlays.disposeAllWallSideTileOverlays();
    this.dependencies.floorOcclusion.clearFloorBlockAmbientOcclusion();
    this.dependencies.wallGeometry.clearFpsWallChamferFloorMeshes();
    this.dependencies.darkCorridorInference.clearAllInferredDarkCorridorWallMeshes();
    this.dependencies.positionSelection.clearPositionCursor();
    this.dependencies.bloodGround.updateBloodGroundOverlayVisibility();
    this.dependencies.camera.cameraDistance = this.dependencies.camera.terminalFitCameraDistance;
    this.dependencies.camera.cameraPanX = 0;
    this.dependencies.camera.cameraPanY = 0;
    this.dependencies.camera.cameraPanTargetX = 0;
    this.dependencies.camera.cameraPanTargetY = 0;
    this.dependencies.camera.cameraFollowInitialized = false;
    // True terminal black behind the glyph grid.
    this.dependencies.renderPipeline.renderer.setClearColor(0x000000, 1);
    const host = this.dependencies.engineState.mountElement ?? document.body;
    host.style.backgroundColor = "#000000";
  }

  leaveTerminalDisplayMode(): void {
    this.dependencies.minimap.setTerminalGutterMinimapState(false, false);
    this.disposeAllTerminalCellVisuals();
    this.dependencies.renderPipeline.renderer.setClearColor(0x000000, 0);
    const host = this.dependencies.engineState.mountElement ?? document.body;
    host.style.backgroundColor = "#000011";
    this.dependencies.camera.cameraPanX = 0;
    this.dependencies.camera.cameraPanY = 0;
    this.dependencies.camera.cameraPanTargetX = 0;
    this.dependencies.camera.cameraPanTargetY = 0;
    this.dependencies.camera.applyStandardCameraPresetForTopDownModes({ force: true });
    this.dependencies.bloodGround.updateBloodGroundOverlayVisibility();
    this.dependencies.lighting.markLightingDirty();
  }

  drawTerminalCellCanvas(
    presentation: TerminalCellPresentation,
  ): HTMLCanvasElement {
    const cellWidth = Math.max(1, Math.round(this.terminalRasterCellWidthPx));
    const cellHeight = Math.round(cellWidth * this.terminalCellAspect);
    const canvas = document.createElement("canvas");
    canvas.width = cellWidth;
    canvas.height = cellHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create terminal cell canvas context");
    }
    context.imageSmoothingEnabled = false;
    context.fillStyle = presentation.bgHex;
    context.fillRect(0, 0, cellWidth, cellHeight);
    const displayChar = presentation.displayChar;
    const drewConnectedBoxGlyph = this.dependencies.glyphTextures.drawConnectedBoxDrawingGlyph(
      context,
      cellWidth,
      cellHeight,
      displayChar,
      presentation.fgHex,
    );
    if (!drewConnectedBoxGlyph && displayChar.trim().length > 0) {
      const fontSize = Math.floor(cellHeight * 0.82);
      context.font = `${fontSize}px "Cascadia Mono", "Consolas", "Menlo", "DejaVu Sans Mono", monospace`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = presentation.fgHex;
      context.fillText(
        displayChar,
        Math.floor(cellWidth / 2),
        Math.floor(cellHeight / 2),
      );
    }
    return canvas;
  }

  buildScaledTerminalCellTextureKey(
    presentation: TerminalCellPresentation,
  ): string {
    return `${this.terminalRasterCellWidthPx}px|${buildTerminalCellTextureKey(
      presentation,
    )}`;
  }

  acquireTerminalCellMaterial(
    presentation: TerminalCellPresentation,
  ): { material: THREE.MeshBasicMaterial; textureKey: string } {
    const textureKey = this.buildScaledTerminalCellTextureKey(presentation);
    let entry = this.terminalCellTextureCache.get(textureKey);
    if (!entry) {
      const texture = new THREE.CanvasTexture(
        this.drawTerminalCellCanvas(presentation),
      );
      // The canvas and screen cell now have the same physical dimensions, so
      // nearest sampling is a true 1:1 copy rather than pixel-art scaling.
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      const material = new THREE.MeshBasicMaterial({ map: texture });
      entry = { texture, material, refCount: 0 };
      this.terminalCellTextureCache.set(textureKey, entry);
    }
    entry.refCount += 1;
    return { material: entry.material, textureKey };
  }

  releaseTerminalCellTexture(textureKey: string): void {
    const entry = this.terminalCellTextureCache.get(textureKey);
    if (!entry) {
      return;
    }
    entry.refCount -= 1;
    if (entry.refCount > 0) {
      return;
    }
    this.terminalCellTextureCache.delete(textureKey);
    entry.material.dispose();
    entry.texture.dispose();
  }


  // Releases the shared terminal texture referenced by a tile mesh. Safe to
  // call for non-terminal meshes; it only acts when terminal state is tagged.
  releaseTerminalCellVisualFromMesh(mesh: THREE.Mesh): void {
    const textureKey = mesh.userData?.terminalTextureKey;
    if (typeof textureKey === "string" && textureKey.length > 0) {
      this.releaseTerminalCellTexture(textureKey);
    }
    delete mesh.userData.terminalTextureKey;
    delete mesh.userData.terminalPresentation;
    delete mesh.userData.terminalCell;
  }

  refreshTerminalCellMaterialsForRasterScale(): void {
    for (const mesh of this.dependencies.tileRendering.tileMap.values()) {
      if (mesh.userData?.terminalCell !== true) {
        continue;
      }
      const presentation = mesh.userData
        ?.terminalPresentation as TerminalCellPresentation | null;
      if (!presentation || typeof presentation.displayChar !== "string") {
        continue;
      }
      const previousTextureKey = mesh.userData?.terminalTextureKey;
      const nextTextureKey =
        this.buildScaledTerminalCellTextureKey(presentation);
      if (previousTextureKey === nextTextureKey) {
        continue;
      }
      const acquired = this.acquireTerminalCellMaterial(presentation);
      mesh.material = acquired.material;
      mesh.userData.terminalTextureKey = acquired.textureKey;
      if (typeof previousTextureKey === "string") {
        this.releaseTerminalCellTexture(previousTextureKey);
      }
    }
  }

  disposeAllTerminalCellVisuals(): void {
    for (const mesh of this.dependencies.tileRendering.tileMap.values()) {
      this.releaseTerminalCellVisualFromMesh(mesh);
    }
    for (const entry of this.terminalCellTextureCache.values()) {
      entry.material.dispose();
      entry.texture.dispose();
    }
    this.terminalCellTextureCache.clear();
  }

  resolveSlashEmTerminalCmapIndex(glyph: number): number | null {
    if (
      (this.dependencies.engineState.characterCreationConfig.runtimeVersion ?? "3.6.7") !== "slashem"
    ) {
      return null;
    }
    const normalizedGlyph = Math.trunc(glyph);
    const entry = getGlyphCatalogEntry(normalizedGlyph);
    if (!entry || entry.kind !== "cmap") {
      return null;
    }
    const cmapRange = getGlyphCatalogRanges().find(
      (range) => range.kind === "cmap",
    );
    if (!cmapRange || normalizedGlyph < cmapRange.start) {
      return null;
    }
    const cmapIndex = normalizedGlyph - Math.trunc(cmapRange.start);
    return cmapIndex >= 0 && cmapIndex < cmapRange.endExclusive - cmapRange.start
      ? cmapIndex
      : null;
  }


  // Terminal-mode replacement for the 3D tile pipeline: renders one map cell
  // as a flat plane whose texture shows the runtime character and color with
  // tty-style MG_* highlighting. Slash'EM's legacy symbol-set substitution is
  // applied client-side because its shim build omits tty graphics. Interaction
  // metadata (userData) is still derived from the glyph catalog so clicking,
  // context menus, and the minimap behave identically to the other modes.
  updateTerminalCell(
    x: number,
    y: number,
    glyph: number,
    char?: string,
    color?: number,
    options: TileUpdateOptions = {},
  ): void {
    const key = `${x},${y}`;
    let mesh = this.dependencies.tileRendering.tileMap.get(key);
    const previousTerrainSnapshot = this.dependencies.levelTerrainCache.lastKnownTerrain.get(key) ?? null;
    const behavior = classifyTileBehavior({
      glyph,
      runtimeChar: char ?? null,
      runtimeColor: typeof color === "number" ? color : null,
      runtimeTileIndex:
        typeof options.runtimeTileIndex === "number"
          ? options.runtimeTileIndex
          : null,
      runtimeSymidx:
        typeof options.runtimeSymidx === "number" &&
        Number.isFinite(options.runtimeSymidx) &&
        options.runtimeSymidx >= 0
          ? Math.trunc(options.runtimeSymidx)
          : null,
      priorTerrain: previousTerrainSnapshot,
    });

    const isUndiscovered = this.dependencies.worldClassification.isUndiscoveredKind(behavior.effective.kind);
    if (isUndiscovered) {
      if (mesh) {
        this.releaseTerminalCellVisualFromMesh(mesh);
        this.dependencies.wallOverlays.disposeWallSideTileOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeTransparentWallGroundPlaneOverlay(mesh);
        this.dependencies.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
        this.dependencies.renderPipeline.scene.remove(mesh);
        this.dependencies.tileRendering.tileMap.delete(key);
      }
      this.dependencies.entityBillboards.removeMonsterBillboard(key);
      this.dependencies.tileRendering.activeEffectTileKeys.delete(key);
      const overlay = this.dependencies.glyphTextures.glyphOverlayMap.get(key);
      if (overlay) {
        this.dependencies.glyphTextures.disposeGlyphOverlay(overlay);
        this.dependencies.glyphTextures.glyphOverlayMap.delete(key);
      }
      this.dependencies.minimap.queueMinimapTileUpdate(x, y, behavior, true);
      return;
    }

    // Keep the persistent-terrain memory in sync so switching back to the
    // 3D modes (and level cache restores) behave exactly as before.
    const terrainSnapshot = this.dependencies.worldClassification.snapshotPersistentTerrainFromTile(
      { glyph, symidx: options.runtimeSymidx },
      behavior,
    );
    if (terrainSnapshot) {
      this.dependencies.levelTerrainCache.lastKnownTerrain.set(key, terrainSnapshot);
    }

    const presentation = resolveTerminalCellPresentation({
      char,
      color,
      glyphFlags:
        typeof options.runtimeGlyphFlags === "number"
          ? options.runtimeGlyphFlags
          : null,
      optionStates: this.terminalRenderOptionStates,
      slashEmCmapIndex: this.resolveSlashEmTerminalCmapIndex(glyph),
    });
    const nextTextureKey =
      this.buildScaledTerminalCellTextureKey(presentation);

    if (!mesh) {
      const acquired = this.acquireTerminalCellMaterial(presentation);
      mesh = new THREE.Mesh(this.dependencies.tileRendering.floorGeometry, acquired.material);
      mesh.position.set(x * TILE_SIZE, -y * TILE_SIZE, 0);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.dependencies.renderPipeline.scene.add(mesh);
      this.dependencies.tileRendering.tileMap.set(key, mesh);
      mesh.userData.terminalTextureKey = acquired.textureKey;
    } else {
      // Reconfigure a mesh that may still carry 3D-mode state (geometry,
      // wall overlays, lambert materials) from before the mode switch.
      this.dependencies.wallOverlays.disposeWallSideTileOverlay(mesh);
      this.dependencies.wallOverlays.disposeVultureWallFaceOverlay(mesh);
      this.dependencies.wallOverlays.disposeVultureWallPlaneOverlay(mesh);
      this.dependencies.wallOverlays.disposeVultureDoorPlaneOverlay(mesh);
      this.dependencies.wallOverlays.disposeTransparentWallGroundPlaneOverlay(mesh);
      this.dependencies.wallOverlays.disposeIronBarsWallPlaneOverlay(mesh);
      const previousTextureKey = mesh.userData?.terminalTextureKey;
      if (previousTextureKey !== nextTextureKey) {
        const acquired = this.acquireTerminalCellMaterial(presentation);
        if (typeof previousTextureKey === "string") {
          this.releaseTerminalCellTexture(previousTextureKey);
        }
        mesh.material = acquired.material;
        mesh.userData.terminalTextureKey = acquired.textureKey;
      }
      mesh.geometry = this.dependencies.tileRendering.floorGeometry;
      mesh.position.set(x * TILE_SIZE, -y * TILE_SIZE, 0);
      mesh.scale.set(1, 1, 1);
    }
    const existingOverlay = this.dependencies.glyphTextures.glyphOverlayMap.get(key);
    if (existingOverlay) {
      this.dependencies.glyphTextures.disposeGlyphOverlay(existingOverlay);
      this.dependencies.glyphTextures.glyphOverlayMap.delete(key);
    }
    this.dependencies.entityBillboards.removeMonsterBillboard(key);
    this.dependencies.entityBillboards.removeEntityBlobShadow(key);

    mesh.userData.terminalCell = true;
    mesh.userData.terminalPresentation = { ...presentation };
    mesh.userData.tileX = x;
    mesh.userData.tileY = y;
    // Terminal cells are flat; interaction logic still needs the semantic
    // terrain classification for context menus and travel targeting.
    mesh.userData.isWall = false;
    mesh.userData.isInferredDarkCorridorWall = false;
    mesh.userData.useDarkCorridorWallCompatibility = false;
    mesh.userData.materialKind = behavior.materialKind;
    mesh.userData.effectKind = behavior.effectKind;
    mesh.userData.disposition = behavior.disposition;
    mesh.userData.isPlayerGlyph = behavior.isPlayerGlyph;
    mesh.userData.isMonsterLikeCharacter = this.dependencies.worldClassification.isMonsterLikeBehavior(behavior);
    mesh.userData.isLootLikeCharacter = this.dependencies.worldClassification.isLootLikeBehavior(behavior);
    mesh.userData.isDamageFlashableCharacter =
      this.dependencies.worldClassification.isDamageFlashableBehavior(behavior);
    mesh.userData.glyphChar = behavior.glyphChar;
    mesh.userData.sourceGlyph = glyph;
    mesh.userData.tileTextureSourceGlyph = behavior.effective.glyph;
    mesh.userData.glyphTextColor = presentation.fgHex;
    mesh.userData.glyphBackgroundColor = presentation.bgHex;

    if (!this.dependencies.tileRendering.tileRevealStartMs.has(key)) {
      this.dependencies.tileRendering.tileRevealStartMs.set(key, performance.now());
    }
    this.dependencies.minimap.queueMinimapTileUpdate(x, y, behavior, false, {
      foregroundHex: presentation.fgHex,
      backgroundHex: presentation.bgHex,
      displayChar: presentation.displayChar,
      inverse: presentation.inverse,
      forcePlayer: this.dependencies.runtimeEntityTracking.isRuntimeTrackedPlayerEntityId(
        options.runtimeTrackedEntityId,
      ),
    });
  }
}
