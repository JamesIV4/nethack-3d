import { TILE_SIZE } from "../../constants";
import { isDoorwayCmapGlyph } from "../../glyphs/behavior";
import { getGlyphCatalogEntry } from "../../glyphs/registry";
import type { TileMaterialKind } from "../../glyphs";
import { type VultureWallFaceDirection } from "../../vulture/translation";
import type {
  VultureWallFaceSlot,
  VultureDoorPlaneOverlay,
  VultureWallProjectionFamily,
  VultureWallProjectionLookup,
  VultureWallPlaneRenderConfig
} from "../shared/types";
import type { Camera } from "../camera/camera";
import type { DarkCorridorInference } from "../world/dark-corridor-inference";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "./entity-billboards";
import type { LevelTerrainCache } from "../world/level-terrain-cache";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { TileMaterials } from "./tile-materials";
import type { TileRendering } from "./tile-rendering";
import type { TilesetAssets } from "./tileset-assets";
import type { WallOverlays } from "./wall-overlays";

export interface VultureWallsDependencies {
  readonly camera: Pick<
    Camera,
    "camera"
  >;
  readonly darkCorridorInference: Pick<
    DarkCorridorInference,
    "resolveInferredDarkCorridorWallSolidColorGridDarknessPercent"
    | "resolveInferredDarkCorridorWallSolidColorGridEnabled"
    | "resolveInferredDarkCorridorWallSolidColorHex"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "vultureBillboardRenderOrder"
  >;
  readonly levelTerrainCache: Pick<
    LevelTerrainCache,
    "getTileSnapshotFromStateCache"
    | "parseTileKey"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly tileMaterials: Pick<
    TileMaterials,
    "applyGlyphMaterial"
    | "applyWallBackSideVisibilityForCurrentPlayMode"
    | "getMaterialByKind"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
    | "updateTile"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "isDarkCorridorWallCompatibilityActiveOnMesh"
    | "shouldUseVultureTiles"
    | "vultureTilesetTranslator"
  >;
  readonly wallOverlays: Pick<
    WallOverlays,
    "ironBarsWallPlaneOverlayMeshes"
    | "vultureBackWallPlaneRenderOrder"
    | "vultureDoorPlaneOverlayMeshes"
    | "vultureFrontWallPlaneRenderOrder"
  >;
}

/** Vulture wall face choice, doorway neighbor resolution and incremental wall/decor reconciliation */
export class VultureWalls {
  constructor(private readonly dependencies: VultureWallsDependencies) {}

  pendingVultureWallMaterialRefreshKeys: Set<string> = new Set();

  vultureWallMaterialRefreshScheduled: boolean = false;

  readonly vultureWallMaterialRefreshMaxPerFrame: number = 48;

  pendingVultureRoomDecorReconcileKeys: Set<string> = new Set();

  vultureRoomDecorReconcileScheduled = false;

  readonly vultureRoomDecorReconcileMaxPerFrame = 96;

  collectPendingVultureRoomDecorReconcileKeys(
    scheduleDeferred: boolean = true,
  ): void {
    const translator = this.dependencies.tilesetAssets.vultureTilesetTranslator;
    if (
      !translator ||
      !this.dependencies.tilesetAssets.shouldUseVultureTiles() ||
      this.dependencies.engineState.clientOptions.tilesetMode !== "tiles"
    ) {
      this.pendingVultureRoomDecorReconcileKeys.clear();
      return;
    }
    const keys = translator.consumeRoomDecorDirtyCoordinateKeys();
    if (keys.length <= 0) {
      return;
    }
    for (const key of keys) {
      this.pendingVultureRoomDecorReconcileKeys.add(key);
    }
    if (scheduleDeferred) {
      this.scheduleVultureRoomDecorReconcile();
    }
  }

  scheduleVultureRoomDecorReconcile(): void {
    if (this.vultureRoomDecorReconcileScheduled) {
      return;
    }
    this.vultureRoomDecorReconcileScheduled = true;
    requestAnimationFrame(() => {
      this.vultureRoomDecorReconcileScheduled = false;
      this.flushPendingVultureRoomDecorReconcile();
      if (this.pendingVultureRoomDecorReconcileKeys.size > 0) {
        this.scheduleVultureRoomDecorReconcile();
      }
    });
  }

  flushPendingVultureRoomDecorReconcile(
    forceAll: boolean = false,
  ): void {
    if (
      !this.dependencies.tilesetAssets.shouldUseVultureTiles() ||
      this.dependencies.engineState.clientOptions.tilesetMode !== "tiles" ||
      !this.dependencies.tilesetAssets.vultureTilesetTranslator
    ) {
      this.pendingVultureRoomDecorReconcileKeys.clear();
      return;
    }
    if (this.pendingVultureRoomDecorReconcileKeys.size <= 0) {
      return;
    }
    const maxToProcess = forceAll
      ? this.pendingVultureRoomDecorReconcileKeys.size
      : this.vultureRoomDecorReconcileMaxPerFrame;
    let processed = 0;
    const pendingIterator = this.pendingVultureRoomDecorReconcileKeys.keys();
    while (processed < maxToProcess) {
      const nextPending = pendingIterator.next();
      if (nextPending.done) {
        break;
      }
      const key = nextPending.value;
      this.pendingVultureRoomDecorReconcileKeys.delete(key);
      const coordinate = this.dependencies.levelTerrainCache.parseTileKey(key);
      if (!coordinate) {
        continue;
      }
      const snapshot = this.dependencies.levelTerrainCache.getTileSnapshotFromStateCache(key);
      if (!snapshot) {
        continue;
      }
      this.dependencies.tileRendering.updateTile(
        coordinate.x,
        coordinate.y,
        snapshot.glyph,
        snapshot.char,
        snapshot.color,
        {
          runtimeTileIndex:
            typeof snapshot.tileIndex === "number"
              ? snapshot.tileIndex
              : undefined,
        },
      );
      this.refreshVultureWallMaterialsNear(coordinate.x, coordinate.y);
      processed += 1;
    }
  }

  shouldUseVultureWallFaceRendering(): boolean {
    return this.dependencies.tilesetAssets.shouldUseVultureTiles();
  }

  resolveVultureWallNeighborFaceLookup(
    face: VultureWallFaceSlot,
    wallX: number,
    wallY: number,
    floorX: number,
    floorY: number,
    wallMaterialKind: TileMaterialKind | null,
  ): VultureWallProjectionLookup | null {
    const translator = this.dependencies.tilesetAssets.vultureTilesetTranslator;
    if (!translator) {
      return null;
    }
    const floorMesh = this.dependencies.tileRendering.tileMap.get(`${floorX},${floorY}`);
    if (!floorMesh) {
      return null;
    }
    const floorTileIndex =
      typeof floorMesh.userData?.tileIndex === "number" &&
      Number.isFinite(floorMesh.userData.tileIndex)
        ? Math.trunc(floorMesh.userData.tileIndex)
        : null;
    const floorGlyph =
      typeof floorMesh.userData?.tileTextureSourceGlyph === "number" &&
      Number.isFinite(floorMesh.userData.tileTextureSourceGlyph)
        ? Math.trunc(floorMesh.userData.tileTextureSourceGlyph)
        : typeof floorMesh.userData?.sourceGlyph === "number" &&
            Number.isFinite(floorMesh.userData.sourceGlyph)
          ? Math.trunc(floorMesh.userData.sourceGlyph)
          : null;
    const floorMaterialKind =
      typeof floorMesh.userData?.materialKind === "string"
        ? (floorMesh.userData.materialKind as TileMaterialKind)
        : null;
    const wallFaceDirection: VultureWallFaceDirection = face;
    const lookup = translator.resolveWallFaceLookup({
      face: wallFaceDirection,
      wallX,
      wallY,
      floorX,
      floorY,
      floorTileIndex,
      floorGlyph,
      floorMaterialKind,
      wallMaterialKind,
      halfHeight: false,
    });
    if (!lookup) {
      return null;
    }
    return {
      ...lookup,
      wallFace: face,
    };
  }

  resolveVultureLookupWithOppositeFace(
    lookup: VultureWallProjectionLookup,
    targetFace: VultureWallFaceSlot,
  ): VultureWallProjectionLookup {
    const normalizedName = String(lookup.name || "").toUpperCase();
    const nextSuffix =
      targetFace === "east"
        ? "_E"
        : targetFace === "west"
          ? "_W"
          : targetFace === "north"
            ? "_N"
            : "_S";
    let remappedName = normalizedName;
    if (normalizedName.endsWith("_E")) {
      remappedName = `${normalizedName.slice(0, -2)}${nextSuffix}`;
    } else if (normalizedName.endsWith("_W")) {
      remappedName = `${normalizedName.slice(0, -2)}${nextSuffix}`;
    } else if (normalizedName.endsWith("_N")) {
      remappedName = `${normalizedName.slice(0, -2)}${nextSuffix}`;
    } else if (normalizedName.endsWith("_S")) {
      remappedName = `${normalizedName.slice(0, -2)}${nextSuffix}`;
    }
    return {
      ...lookup,
      name: remappedName,
      wallFace: targetFace,
    };
  }

  isVultureDoorwayNeighborFloor(
    floorX: number,
    floorY: number,
  ): boolean {
    const translator = this.dependencies.tilesetAssets.vultureTilesetTranslator;
    const floorMesh = this.dependencies.tileRendering.tileMap.get(`${floorX},${floorY}`);
    if (!translator || !floorMesh) {
      return false;
    }
    const floorMaterialKind =
      typeof floorMesh.userData?.materialKind === "string"
        ? (floorMesh.userData.materialKind as TileMaterialKind)
        : null;
    if (floorMaterialKind === "door") {
      return true;
    }
    const floorGlyph =
      typeof floorMesh.userData?.tileTextureSourceGlyph === "number" &&
      Number.isFinite(floorMesh.userData.tileTextureSourceGlyph)
        ? Math.trunc(floorMesh.userData.tileTextureSourceGlyph)
        : typeof floorMesh.userData?.sourceGlyph === "number" &&
            Number.isFinite(floorMesh.userData.sourceGlyph)
          ? Math.trunc(floorMesh.userData.sourceGlyph)
          : null;
    if (floorGlyph !== null && isDoorwayCmapGlyph(floorGlyph)) {
      return true;
    }
    const floorTileIndex =
      typeof floorMesh.userData?.tileIndex === "number" &&
      Number.isFinite(floorMesh.userData.tileIndex)
        ? Math.trunc(floorMesh.userData.tileIndex)
        : null;
    if (floorTileIndex === null) {
      return false;
    }
    const floorCmapIndex =
      translator.resolveCmapIndexForTileIndex(floorTileIndex);
    return (
      floorCmapIndex !== null &&
      ((floorCmapIndex >= 12 && floorCmapIndex <= 18) ||
        floorCmapIndex === 35 ||
        floorCmapIndex === 36 ||
        floorCmapIndex === 37 ||
        floorCmapIndex === 38)
    );
  }

  resolveVultureWallPlaneRenderConfig(
    wallX: number,
    wallY: number,
    wallMaterialKind: TileMaterialKind | null,
    wallOrientationChar: "|" | "-" | null,
  ): VultureWallPlaneRenderConfig | null {
    const eastNeighborLookup = this.resolveVultureWallNeighborFaceLookup(
      "east",
      wallX,
      wallY,
      wallX + 1,
      wallY,
      wallMaterialKind,
    );
    const westNeighborLookup = this.resolveVultureWallNeighborFaceLookup(
      "west",
      wallX,
      wallY,
      wallX - 1,
      wallY,
      wallMaterialKind,
    );
    const northNeighborLookup = this.resolveVultureWallNeighborFaceLookup(
      "north",
      wallX,
      wallY,
      wallX,
      wallY - 1,
      wallMaterialKind,
    );
    const southNeighborLookup = this.resolveVultureWallNeighborFaceLookup(
      "south",
      wallX,
      wallY,
      wallX,
      wallY + 1,
      wallMaterialKind,
    );

    const lookupByDirection: Record<
      VultureWallFaceSlot,
      VultureWallProjectionLookup | null
    > = {
      east: eastNeighborLookup,
      west: westNeighborLookup,
      north: northNeighborLookup,
      south: southNeighborLookup,
    };
    const doorwayNeighborByDirection: Record<VultureWallFaceSlot, boolean> = {
      east: this.isVultureDoorwayNeighborFloor(wallX + 1, wallY),
      west: this.isVultureDoorwayNeighborFloor(wallX - 1, wallY),
      north: this.isVultureDoorwayNeighborFloor(wallX, wallY - 1),
      south: this.isVultureDoorwayNeighborFloor(wallX, wallY + 1),
    };

    const ewNeighborCount =
      (eastNeighborLookup ? 1 : 0) + (westNeighborLookup ? 1 : 0);
    const snNeighborCount =
      (northNeighborLookup ? 1 : 0) + (southNeighborLookup ? 1 : 0);
    let family: VultureWallProjectionFamily | null = null;
    if (wallOrientationChar === "|") {
      family = "ew";
    } else if (wallOrientationChar === "-") {
      family = "sn";
    } else if (ewNeighborCount > snNeighborCount) {
      family = "ew";
    } else if (snNeighborCount > ewNeighborCount) {
      family = "sn";
    } else if (ewNeighborCount > 0) {
      family = "ew";
    } else if (snNeighborCount > 0) {
      family = "sn";
    }
    if (!family) {
      return null;
    }

    const remapLookup = (
      preferred: VultureWallProjectionLookup | null,
      fallback: VultureWallProjectionLookup | null,
      textureFace: VultureWallFaceSlot,
    ): VultureWallProjectionLookup | null => {
      const source = preferred ?? fallback;
      return source
        ? this.resolveVultureLookupWithOppositeFace(source, textureFace)
        : null;
    };
    const buildSlice = (
      direction: VultureWallFaceSlot,
      preferredLookup: VultureWallProjectionLookup | null,
      fallbackLookup: VultureWallProjectionLookup | null,
      innerTextureFace: VultureWallFaceSlot,
      outerTextureFace: VultureWallFaceSlot,
    ): {
      direction: VultureWallFaceSlot;
      innerTextureFace: VultureWallFaceSlot;
      outerTextureFace: VultureWallFaceSlot;
      innerLookup: VultureWallProjectionLookup;
      outerLookup: VultureWallProjectionLookup;
    } | null => {
      let innerLookup = remapLookup(
        preferredLookup,
        fallbackLookup,
        innerTextureFace,
      );
      let outerLookup = innerLookup
        ? this.resolveVultureLookupWithOppositeFace(
            innerLookup,
            outerTextureFace,
          )
        : remapLookup(fallbackLookup, preferredLookup, outerTextureFace);
      if (!innerLookup && outerLookup) {
        innerLookup = this.resolveVultureLookupWithOppositeFace(
          outerLookup,
          innerTextureFace,
        );
      }
      if (!outerLookup && innerLookup) {
        outerLookup = this.resolveVultureLookupWithOppositeFace(
          innerLookup,
          outerTextureFace,
        );
      }
      if (!innerLookup || !outerLookup) {
        return null;
      }
      return {
        direction,
        innerTextureFace,
        outerTextureFace,
        innerLookup,
        outerLookup,
      };
    };
    const buildDoorwaySlice = (
      direction: VultureWallFaceSlot,
      preferredLookup: VultureWallProjectionLookup | null,
      innerTextureFace: VultureWallFaceSlot,
      outerTextureFace: VultureWallFaceSlot,
    ): {
      direction: VultureWallFaceSlot;
      innerTextureFace: VultureWallFaceSlot;
      outerTextureFace: VultureWallFaceSlot;
      innerLookup: VultureWallProjectionLookup;
      outerLookup: VultureWallProjectionLookup;
    } | null => {
      if (!preferredLookup) {
        return null;
      }
      const outerLookup = this.resolveVultureLookupWithOppositeFace(
        preferredLookup,
        outerTextureFace,
      );
      const innerLookup = this.resolveVultureLookupWithOppositeFace(
        preferredLookup,
        innerTextureFace,
      );
      return {
        direction,
        innerTextureFace,
        outerTextureFace,
        innerLookup,
        outerLookup,
      };
    };
    const appendDoorwayCrossAxisSlices = (
      familyForSlices: VultureWallProjectionFamily,
      slices: VultureWallPlaneRenderConfig["slices"],
    ): void => {
      // Keep legacy wall-family mapping, but add doorway cross-axis faces so
      // interior doorway wall planes are still rendered.
      const doorwayInnerTextureFace: VultureWallFaceSlot =
        familyForSlices === "ew" ? "east" : "south";
      const doorwayOuterTextureFace: VultureWallFaceSlot =
        familyForSlices === "ew" ? "west" : "north";
      const doorwayDirections =
        familyForSlices === "ew"
          ? (["north", "south"] as const)
          : (["east", "west"] as const);
      for (const direction of doorwayDirections) {
        if (!doorwayNeighborByDirection[direction]) {
          continue;
        }
        if (slices.some((slice) => slice.direction === direction)) {
          continue;
        }
        const doorwaySlice = buildDoorwaySlice(
          direction,
          lookupByDirection[direction],
          doorwayInnerTextureFace,
          doorwayOuterTextureFace,
        );
        if (doorwaySlice) {
          slices.push(doorwaySlice);
        }
      }
    };

    if (family === "ew") {
      const innerTextureFace: VultureWallFaceSlot = "east";
      const outerTextureFace: VultureWallFaceSlot = "west";
      const slices: VultureWallPlaneRenderConfig["slices"] = [];
      if (eastNeighborLookup) {
        const eastSlice = buildSlice(
          "east",
          eastNeighborLookup,
          westNeighborLookup,
          innerTextureFace,
          outerTextureFace,
        );
        if (eastSlice) {
          slices.push(eastSlice);
        }
      }
      if (westNeighborLookup) {
        const westSlice = buildSlice(
          "west",
          westNeighborLookup,
          eastNeighborLookup,
          innerTextureFace,
          outerTextureFace,
        );
        if (westSlice) {
          slices.push(westSlice);
        }
      }
      if (slices.length === 0) {
        const fallbackSlice = buildSlice(
          "east",
          eastNeighborLookup,
          westNeighborLookup,
          innerTextureFace,
          outerTextureFace,
        );
        if (fallbackSlice) {
          slices.push(fallbackSlice);
        }
      }
      appendDoorwayCrossAxisSlices(family, slices);
      return slices.length > 0
        ? {
            family,
            slices,
          }
        : null;
    }

    const innerTextureFace: VultureWallFaceSlot = "south";
    const outerTextureFace: VultureWallFaceSlot = "north";
    const slices: VultureWallPlaneRenderConfig["slices"] = [];
    if (southNeighborLookup) {
      const southSlice = buildSlice(
        "south",
        southNeighborLookup,
        northNeighborLookup,
        innerTextureFace,
        outerTextureFace,
      );
      if (southSlice) {
        slices.push(southSlice);
      }
    }
    if (northNeighborLookup) {
      const northSlice = buildSlice(
        "north",
        northNeighborLookup,
        southNeighborLookup,
        innerTextureFace,
        outerTextureFace,
      );
      if (northSlice) {
        slices.push(northSlice);
      }
    }
    if (slices.length === 0) {
      const fallbackSlice = buildSlice(
        "south",
        southNeighborLookup,
        northNeighborLookup,
        innerTextureFace,
        outerTextureFace,
      );
      if (fallbackSlice) {
        slices.push(fallbackSlice);
      }
    }
    appendDoorwayCrossAxisSlices(family, slices);
    return slices.length > 0
      ? {
          family,
          slices,
        }
      : null;
  }

  refreshVultureWallMaterialAt(tileX: number, tileY: number): void {
    if (!this.shouldUseVultureWallFaceRendering()) {
      return;
    }
    const key = `${tileX},${tileY}`;
    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    if (!mesh || !mesh.userData?.isWall) {
      return;
    }
    const materialKind =
      typeof mesh.userData?.materialKind === "string"
        ? (mesh.userData.materialKind as TileMaterialKind)
        : null;
    if (!materialKind) {
      return;
    }
    const baseMaterial = this.dependencies.tileMaterials.getMaterialByKind(materialKind);
    const glyphChar =
      typeof mesh.userData?.glyphChar === "string"
        ? mesh.userData.glyphChar
        : " ";
    const textColor =
      typeof mesh.userData?.glyphTextColor === "string"
        ? mesh.userData.glyphTextColor
        : "#F4F4F4";
    const glyphBackgroundColor =
      typeof mesh.userData?.glyphBackgroundColor === "string"
        ? mesh.userData.glyphBackgroundColor
        : null;
    const darkenFactor =
      typeof mesh.userData?.glyphDarkenFactor === "number"
        ? mesh.userData.glyphDarkenFactor
        : 1;
    const tileIndex =
      typeof mesh.userData?.tileIndex === "number"
        ? mesh.userData.tileIndex
        : -1;
    const darkCorridorWallCompatibilityActive =
      this.dependencies.tilesetAssets.isDarkCorridorWallCompatibilityActiveOnMesh(mesh);
    const inferredDarkWallSolidColorHex =
      this.dependencies.darkCorridorInference.resolveInferredDarkCorridorWallSolidColorHex(
        darkCorridorWallCompatibilityActive,
      );
    const inferredDarkWallSolidColorGridEnabled =
      this.dependencies.darkCorridorInference.resolveInferredDarkCorridorWallSolidColorGridEnabled(
        darkCorridorWallCompatibilityActive,
      );
    const inferredDarkWallSolidColorGridDarknessPercent =
      this.dependencies.darkCorridorInference.resolveInferredDarkCorridorWallSolidColorGridDarknessPercent(
        darkCorridorWallCompatibilityActive,
      );
    this.dependencies.tileMaterials.applyGlyphMaterial(
      key,
      mesh,
      baseMaterial,
      glyphChar,
      textColor,
      true,
      darkenFactor,
      this.dependencies.movementInput.isFpsMode() && !darkCorridorWallCompatibilityActive,
      tileIndex,
      inferredDarkWallSolidColorHex,
      inferredDarkWallSolidColorGridEnabled,
      inferredDarkWallSolidColorGridDarknessPercent,
      glyphBackgroundColor,
    );
  }

  refreshVultureWallMaterialsNear(tileX: number, tileY: number): void {
    if (!this.shouldUseVultureWallFaceRendering()) {
      return;
    }
    const queueCell = (x: number, y: number): void => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }
      this.pendingVultureWallMaterialRefreshKeys.add(
        `${Math.trunc(x)},${Math.trunc(y)}`,
      );
    };
    queueCell(tileX, tileY);
    queueCell(tileX - 1, tileY);
    queueCell(tileX + 1, tileY);
    queueCell(tileX, tileY - 1);
    queueCell(tileX, tileY + 1);
    this.scheduleVultureWallMaterialRefresh();
  }

  flushPendingVultureWallMaterialRefreshes(
    forceAll: boolean = false,
  ): void {
    if (!this.shouldUseVultureWallFaceRendering()) {
      this.pendingVultureWallMaterialRefreshKeys.clear();
      return;
    }
    if (this.pendingVultureWallMaterialRefreshKeys.size <= 0) {
      return;
    }
    const maxPerFrame = forceAll
      ? this.pendingVultureWallMaterialRefreshKeys.size
      : this.vultureWallMaterialRefreshMaxPerFrame;
    let processed = 0;
    for (const key of Array.from(this.pendingVultureWallMaterialRefreshKeys)) {
      this.pendingVultureWallMaterialRefreshKeys.delete(key);
      const [rawX, rawY] = key.split(",");
      const x = Number(rawX);
      const y = Number(rawY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      this.refreshVultureWallMaterialAt(Math.trunc(x), Math.trunc(y));
      processed += 1;
      if (processed >= maxPerFrame) {
        break;
      }
    }
  }

  scheduleVultureWallMaterialRefresh(): void {
    if (this.vultureWallMaterialRefreshScheduled) {
      return;
    }
    this.vultureWallMaterialRefreshScheduled = true;
    requestAnimationFrame(() => {
      this.vultureWallMaterialRefreshScheduled = false;
      this.flushPendingVultureWallMaterialRefreshes();
      if (this.pendingVultureWallMaterialRefreshKeys.size > 0) {
        this.scheduleVultureWallMaterialRefresh();
      }
    });
  }

  resolveWallOrientationChar(
    glyphChar: string,
    sourceGlyph: number | null,
  ): "|" | "-" | null {
    if (glyphChar === "|" || glyphChar === "-") {
      return glyphChar;
    }
    if (sourceGlyph === null) {
      return null;
    }
    const glyphEntry = getGlyphCatalogEntry(sourceGlyph);
    if (!glyphEntry || typeof glyphEntry.ch !== "number") {
      return null;
    }
    const catalogChar = String.fromCodePoint(glyphEntry.ch);
    if (catalogChar === "|" || catalogChar === "-") {
      return catalogChar;
    }
    return null;
  }

  resolveCornerWallSideBaseTileIndex(tileIndex: number): number | null {
    const normalizedTileIndex = Math.trunc(tileIndex);
    if (normalizedTileIndex < 0) {
      return null;
    }

    // Corner-wall variants follow a base+offset pattern:
    // base+1 (top-left), base+2 (top-right), base+3 (bottom-left), base+4 (bottom-right).
    // Side faces should use the base tile while top keeps the corner tile.
    for (const baseTileIndex of [852, 1039, 1050, 1061, 1072]) {
      const offset = normalizedTileIndex - baseTileIndex;
      if (offset >= 1 && offset <= 4) {
        return baseTileIndex;
      }
    }

    return null;
  }

  updateVultureDoorPlaneRenderOrdering(): void {
    if (
      !this.dependencies.tilesetAssets.shouldUseVultureTiles() ||
      this.dependencies.wallOverlays.vultureDoorPlaneOverlayMeshes.size <= 0
    ) {
      return;
    }
    const cameraX = this.dependencies.camera.camera.position.x;
    const cameraY = this.dependencies.camera.camera.position.y;
    const playerX = this.dependencies.playerMovement.playerPos.x * TILE_SIZE;
    const playerY = -this.dependencies.playerMovement.playerPos.y * TILE_SIZE;
    const axisEpsilon = TILE_SIZE * 0.06;
    const doorBehindFrontOrder = this.dependencies.wallOverlays.vultureFrontWallPlaneRenderOrder;
    const doorBehindBackOrder = this.dependencies.wallOverlays.vultureFrontWallPlaneRenderOrder + 0.05;
    const doorAheadFrontOrder = this.dependencies.entityBillboards.vultureBillboardRenderOrder + 0.1;
    const doorAheadBackOrder = this.dependencies.wallOverlays.vultureBackWallPlaneRenderOrder;

    for (const mesh of this.dependencies.wallOverlays.vultureDoorPlaneOverlayMeshes) {
      const overlay = mesh.userData?.vultureDoorPlaneOverlay as
        | VultureDoorPlaneOverlay
        | undefined;
      if (!overlay) {
        continue;
      }
      const orientation =
        overlay.doorOrientation === "ew" || overlay.doorOrientation === "sn"
          ? overlay.doorOrientation
          : null;
      if (!orientation) {
        continue;
      }
      const tileX =
        typeof mesh.userData?.tileX === "number" &&
        Number.isFinite(mesh.userData.tileX)
          ? Math.trunc(mesh.userData.tileX)
          : null;
      const tileY =
        typeof mesh.userData?.tileY === "number" &&
        Number.isFinite(mesh.userData.tileY)
          ? Math.trunc(mesh.userData.tileY)
          : null;
      if (tileX === null || tileY === null) {
        continue;
      }

      const doorCenterX = tileX * TILE_SIZE;
      const doorCenterY = -tileY * TILE_SIZE;
      const cameraAxisDelta =
        orientation === "ew" ? cameraX - doorCenterX : cameraY - doorCenterY;
      const playerAxisDelta =
        orientation === "ew" ? playerX - doorCenterX : playerY - doorCenterY;
      const cameraSide =
        cameraAxisDelta > axisEpsilon
          ? 1
          : cameraAxisDelta < -axisEpsilon
            ? -1
            : 0;
      const playerSide =
        playerAxisDelta > axisEpsilon
          ? 1
          : playerAxisDelta < -axisEpsilon
            ? -1
            : 0;

      // If camera/player are on opposite sides of the door plane, the door
      // draws in front of the player. Crossing 180 degrees around Y naturally
      // flips sides and therefore flips this rule.
      const doorInFrontOfPlayer =
        cameraSide !== 0 && playerSide !== 0 && cameraSide !== playerSide;
      const frontOrder = doorInFrontOfPlayer
        ? doorAheadFrontOrder
        : doorBehindFrontOrder;
      const backOrder = doorInFrontOfPlayer
        ? doorAheadBackOrder
        : doorBehindBackOrder;
      overlay.frontMesh.renderOrder = frontOrder;
      overlay.backMesh.renderOrder = backOrder;
      overlay.floorMesh.renderOrder = frontOrder - 1;
    }
  }

  updateIronBarsWallPlaneVisibility(): void {
    if (this.dependencies.wallOverlays.ironBarsWallPlaneOverlayMeshes.size <= 0) {
      return;
    }
    for (const mesh of this.dependencies.wallOverlays.ironBarsWallPlaneOverlayMeshes) {
      this.dependencies.tileMaterials.applyWallBackSideVisibilityForCurrentPlayMode(mesh);
    }
  }
}
