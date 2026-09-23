import type { TileMaterialKind } from "../glyphs";
import type { GlyphKind } from "../glyphs/types";
import { GLYPH_CATALOG as legacyGlyphCatalog, GLYPH_CATALOG_RANGES as legacyGlyphRanges } from "../glyphs/glyph-catalog.367.generated";
import { translateNh5TileIndexToNh367 } from "../tileset-367-to-5-translation";
import { getGlyphCatalogEntry, getGlyphCatalogRanges } from "../glyphs/registry";
import type { NethackRuntimeVersion } from "../../runtime/types";
import { VULTURE_MONSTER_KEYS_367 } from "./vulture-monster-keys.367.generated";
import { NETHACK_367_OBJECT_TOKENS } from "./nethack-object-tokens";
import { VultureIdlePreloader } from "./idle-preloader";

// Vulture's asset names follow 3.6 identities, even when the running game uses
// 5.0 glyphs (split cmap ranges, added species/objects, and male/female tiles).
const legacyIdentitiesByTile = (() => {
  const monsters = new Map<number, string>();
  const objects = new Map<number, string>();
  const cmap = new Map<number, number>();
  const starts = new Map(legacyGlyphRanges.map(range => [range.kind, range.start]));
  for (const entry of legacyGlyphCatalog) {
    if (typeof entry.tileIndex !== "number" || entry.tileIndex < 0) continue;
    const start = starts.get(entry.kind);
    if (start === undefined) continue;
    const index = entry.glyph - start;
    if (entry.kind === "mon" || entry.kind === "statue") {
      const key = VULTURE_MONSTER_KEYS_367[index];
      if (key) monsters.set(entry.tileIndex, key);
    } else if (entry.kind === "obj") {
      const token = NETHACK_367_OBJECT_TOKENS[index];
      if (token) objects.set(entry.tileIndex, token);
    } else if (entry.kind === "cmap") {
      cmap.set(entry.tileIndex, index);
    }
  }
  return { monsters, objects, cmap };
})();

export type VultureTileProjectionMode = "sprite" | "iso_floor";

type VultureTilePointer = {
  category: string;
  name: string;
};

type VultureRawTileEntry =
  | {
      kind: "asset";
      path: string;
      hsX: number;
      hsY: number;
    }
  | {
      kind: "redirect";
      target: VultureTilePointer;
    };

type VultureResolvedTileEntry = {
  path: string;
  hsX: number;
  hsY: number;
};

export type VultureTileLookup = {
  category: string;
  name: string;
  projection: VultureTileProjectionMode;
};

export type VultureWallFaceDirection = "west" | "north" | "east" | "south";

type VultureWallHeightToken = "F" | "H";

type VultureWallDecorStyle =
  | "BRICK"
  | "BRICK_BANNER"
  | "BRICK_PAINTING"
  | "BRICK_POCKET"
  | "BRICK_PILLAR"
  | "MARBLE"
  | "VINE_COVERED"
  | "STUCCO"
  | "ROUGH"
  | "DARK"
  | "LIGHT";

type VultureFloorDecorStyle =
  | "COBBLESTONE"
  | "ROUGH"
  | "CERAMIC"
  | "LAVA"
  | "WATER"
  | "ICE"
  | "MURAL"
  | "MURAL2"
  | "CARPET"
  | "MOSS_COVERED"
  | "MARBLE"
  | "ROUGH_LIT"
  | "AIR"
  | "DARK";

type DrawTranslatedTileParams = {
  context: CanvasRenderingContext2D;
  size: number;
  glyph: number;
  tileIndex?: number | null;
  tileX?: number | null;
  tileY?: number | null;
  materialKind: TileMaterialKind | null;
  forBillboard: boolean;
};

type DrawLookupTileParams = {
  context: CanvasRenderingContext2D;
  size: number;
  lookup: VultureTileLookup;
  forBillboard: boolean;
};

type DrawLookupSourcePreviewParams = {
  context: CanvasRenderingContext2D;
  size: number;
  lookup: VultureTileLookup;
};

type ResolveWallFaceLookupParams = {
  face: VultureWallFaceDirection;
  wallX: number;
  wallY: number;
  floorX: number;
  floorY: number;
  floorTileIndex?: number | null;
  floorGlyph?: number | null;
  floorMaterialKind?: TileMaterialKind | null;
  wallMaterialKind?: TileMaterialKind | null;
  halfHeight?: boolean;
};

type ImageState = HTMLImageElement | "loading" | null;

const explosionTypeNames = [
  "DARK",
  "NOXIOUS",
  "MUDDY",
  "WET",
  "MAGICAL",
  "FIERY",
  "FROSTY",
] as const;

const zapTileNames = [
  "ZAP_VERTICAL",
  "ZAP_HORIZONTAL",
  "ZAP_SLANT_LEFT",
  "ZAP_SLANT_RIGHT",
] as const;

const genericFloorLookup: VultureTileLookup = {
  category: "floor",
  name: "FLOOR_COBBLESTONE_1_1",
  projection: "iso_floor",
};

const brickWallDecorVariants = [
  "BRICK",
  "BRICK_BANNER",
  "BRICK_PAINTING",
  "BRICK_POCKET",
  "BRICK_PILLAR",
] as const;

const floorDecorPatternByStyle: Readonly<
  Record<VultureFloorDecorStyle, { width: number; height: number }>
> = {
  COBBLESTONE: { width: 3, height: 3 },
  ROUGH: { width: 3, height: 3 },
  CERAMIC: { width: 3, height: 3 },
  LAVA: { width: 3, height: 3 },
  WATER: { width: 3, height: 3 },
  ICE: { width: 3, height: 3 },
  MURAL: { width: 3, height: 2 },
  MURAL2: { width: 3, height: 2 },
  CARPET: { width: 3, height: 2 },
  MOSS_COVERED: { width: 3, height: 3 },
  MARBLE: { width: 3, height: 3 },
  ROUGH_LIT: { width: 3, height: 3 },
  AIR: { width: 3, height: 3 },
  DARK: { width: 1, height: 1 },
};

type VultureDecorativeFloorStyle = "CARPET" | "MURAL" | "MURAL2";

type VultureDecorativeFloorPlacement = {
  style: VultureDecorativeFloorStyle;
  position: number;
};

type VultureKnownRoom = {
  id: number;
  lx: number;
  ly: number;
  hx: number;
  hy: number;
  cellKeys: string[];
};

type VultureRoomDecorAnchor = {
  style: VultureDecorativeFloorStyle;
  originX: number;
  originY: number;
};

type VultureRuntimeRoomState = {
  id: number;
  anchorX: number;
  anchorY: number;
  selector: number;
  firstSeenOrder: number;
  decorAnchor: VultureRoomDecorAnchor | null;
};

const decorativeFloorStylesInPlacementOrder: ReadonlyArray<VultureDecorativeFloorStyle> =
  ["CARPET", "MURAL", "MURAL2"];

const vultureDecorativeFloorPlacementCount = 10;

const allWallDecorStyles: ReadonlyArray<VultureWallDecorStyle> = [
  "BRICK",
  "BRICK_BANNER",
  "BRICK_PAINTING",
  "BRICK_POCKET",
  "BRICK_PILLAR",
  "MARBLE",
  "VINE_COVERED",
  "STUCCO",
  "ROUGH",
  "DARK",
  "LIGHT",
];

const fixedFloorDecorStyleByCmap = new Map<number, VultureFloorDecorStyle>([
  [20, "DARK"],
  [21, "ROUGH"],
  [22, "ROUGH_LIT"],
  [32, "WATER"],
  [33, "ICE"],
  [34, "LAVA"],
  [39, "AIR"],
  [41, "WATER"],
]);

function createLookup(
  category: string,
  name: string,
  projection: VultureTileProjectionMode,
): VultureTileLookup {
  return { category, name, projection };
}

const staticCmapLookupByIndex = new Map<number, VultureTileLookup>([
  [13, createLookup("misc", "VDOOR_WOOD_OPEN", "sprite")],
  [14, createLookup("misc", "HDOOR_WOOD_OPEN", "sprite")],
  [15, createLookup("misc", "VDOOR_WOOD_CLOSED", "sprite")],
  [16, createLookup("misc", "HDOOR_WOOD_CLOSED", "sprite")],
  [17, createLookup("misc", "BARS", "sprite")],
  [18, createLookup("misc", "TREE", "sprite")],
  [23, createLookup("misc", "STAIRS_UP", "sprite")],
  [24, createLookup("misc", "STAIRS_DOWN", "sprite")],
  [25, createLookup("misc", "LADDER_UP", "sprite")],
  [26, createLookup("misc", "LADDER_DOWN", "sprite")],
  [27, createLookup("misc", "ALTAR", "sprite")],
  [28, createLookup("misc", "GRAVE", "sprite")],
  [29, createLookup("misc", "THRONE", "sprite")],
  [30, createLookup("misc", "SINK", "sprite")],
  [31, createLookup("misc", "FOUNTAIN", "sprite")],
  [35, createLookup("misc", "VODBRIDGE", "sprite")],
  [36, createLookup("misc", "HODBRIDGE", "sprite")],
  [37, createLookup("misc", "VCDBRIDGE", "sprite")],
  [38, createLookup("misc", "HCDBRIDGE", "sprite")],
  [40, createLookup("misc", "CLOUD", "sprite")],
  [42, createLookup("misc", "TRAP_ARROW", "sprite")],
  [43, createLookup("misc", "DART_TRAP", "sprite")],
  [44, createLookup("misc", "FALLING_ROCK_TRAP", "sprite")],
  [45, createLookup("misc", "SQUEAKY_BOARD", "sprite")],
  [46, createLookup("misc", "TRAP_BEAR", "sprite")],
  [47, createLookup("misc", "LAND_MINE", "sprite")],
  [48, createLookup("misc", "ROLLING_BOULDER_TRAP", "sprite")],
  [49, createLookup("misc", "GAS_TRAP", "sprite")],
  [50, createLookup("misc", "TRAP_WATER", "sprite")],
  [51, createLookup("misc", "TRAP_FIRE", "sprite")],
  [52, createLookup("misc", "TRAP_PIT", "sprite")],
  [53, createLookup("misc", "SPIKED_PIT", "sprite")],
  [54, createLookup("misc", "HOLE", "sprite")],
  [55, createLookup("misc", "TRAP_DOOR", "sprite")],
  [56, createLookup("misc", "TRAP_TELEPORTER", "sprite")],
  [57, createLookup("misc", "LEVEL_TELEPORTER", "sprite")],
  [58, createLookup("misc", "MAGIC_PORTAL", "sprite")],
  [59, createLookup("misc", "WEB_TRAP", "sprite")],
  [60, createLookup("object", "STATUE", "sprite")],
  [61, createLookup("misc", "MAGIC_TRAP", "sprite")],
  [62, createLookup("misc", "TRAP_ANTI_MAGIC", "sprite")],
  [63, createLookup("misc", "TRAP_POLYMORPH", "sprite")],
  [64, createLookup("misc", "MAGIC_TRAP", "sprite")],
]);

function trimSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function clampTileSize(value: number): number {
  if (!Number.isFinite(value)) {
    return 32;
  }
  return Math.max(1, Math.trunc(value));
}

function normalizeTileNameToken(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/[a-z]/g, (char) => char.toUpperCase())
    .replace(/[^A-Z0-9_]/g, "_");
}

function normalizeMapCoordinate(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : null;
}

function positiveModulo(value: number, divisor: number): number {
  const normalizedDivisor = Math.max(1, Math.trunc(divisor));
  return ((Math.trunc(value) % normalizedDivisor) + normalizedDivisor) % normalizedDivisor;
}

function resolveRoomFloorStyleBySelector(
  selector: number,
): VultureFloorDecorStyle {
  switch (positiveModulo(selector, 4)) {
    case 0:
      return "CERAMIC";
    case 1:
      return "COBBLESTONE";
    case 2:
      return "MOSS_COVERED";
    case 3:
      return "MARBLE";
    default:
      return "COBBLESTONE";
  }
}

function resolveRoomWallStyleBySelector(selector: number): VultureWallDecorStyle {
  switch (positiveModulo(selector, 4)) {
    case 0:
      return "STUCCO";
    case 1:
      return "BRICK";
    case 2:
      return "VINE_COVERED";
    case 3:
      return "MARBLE";
    default:
      return "BRICK";
  }
}

export class VultureTilesetTranslator {
  private readonly dataRootUrl: string;

  private readonly configUrl: string;

  private readonly onAssetReady: (() => void) | null;

  private readonly imageByUrl = new Map<string, ImageState>();

  private readonly rawEntryByToken = new Map<string, VultureRawTileEntry>();

  private readonly resolvedEntryByToken = new Map<
    string,
    VultureResolvedTileEntry | null
  >();

  private readonly defaultTargetByCategory = new Map<
    string,
    VultureTilePointer
  >();

  private readonly rangeStartByKind = new Map<string, number>();

  private readonly cmapIndexByTileIndex = new Map<number, number>();

  private readonly objectTokenByTileIndex = new Map<number, string>();

  private readonly floorLookupByStylePattern = new Map<string, VultureTileLookup>();

  private readonly wallLookupByVariantAndFace = new Map<string, VultureTileLookup>();

  private readonly wallFaceLookupByStyleHeightFace = new Map<
    string,
    VultureTileLookup
  >();

  private readonly knownCmapIndexByCoordinate = new Map<string, number>();
  private readonly lastResolvedRoomFloorByCoordinate = new Map<string, VultureTileLookup>();

  private readonly roomSelectorHintByCoordinate = new Map<string, number>();

  private readonly roomSelectorObservationOrderByCoordinate = new Map<
    string,
    number
  >();

  private readonly roomIndexByCoordinate = new Map<string, number>();

  private readonly roomStateById = new Map<number, VultureRuntimeRoomState>();

  private readonly decorativeFloorPlacementByCoordinate = new Map<
    string,
    VultureDecorativeFloorPlacement
  >();

  private readonly roomDecorDirtyCoordinateKeys = new Set<string>();

  private readonly pseudoRoomSelectorByRoomCell = new Map<string, number>();

  private readonly tileLookupDecisionCache = new Map<
    string,
    VultureTileLookup | null
  >();

  private readonly wallFaceLookupDecisionCache = new Map<
    string,
    VultureTileLookup | null
  >();

  private readonly tileLookupDecisionCacheMaxEntries = 8192;

  private readonly wallFaceLookupDecisionCacheMaxEntries = 4096;

  private cmapTileLookupInitialized = false;

  private configLoadingStarted = false;

  private configLoaded = false;

  private configLoadFailed = false;

  private pendingAssetReadyCallback = false;

  private roomDecorStateDirty = true;

  private nextRuntimeRoomId = 1;

  private roomSelectorObservationCounter = 1;

  private disposed = false;

  private preloadUrls: string[] = [];
  private backgroundImage: { url: string; image: HTMLImageElement; demanded: boolean } | null = null;
  private idlePreloader: VultureIdlePreloader | null = null;

  public pauseIdlePreloading(): void {
    this.idlePreloader?.pause();
  }

  public updateIdlePreloading(): void {
    if (this.disposed || !this.configLoaded || this.preloadUrls.length === 0) return;
    this.idlePreloader ??= new VultureIdlePreloader(
      () => this.preloadOneImage(), () => this.cancelBackgroundImage(),
    );
    this.idlePreloader.tick();
  }

  private cancelBackgroundImage(): void {
    const pending = this.backgroundImage;
    // A visible sprite can adopt an in-flight preload; never cancel its load.
    if (!pending || pending.demanded) return;
    pending.image.onload = pending.image.onerror = null;
    pending.image.removeAttribute("src");
    this.imageByUrl.delete(pending.url);
    this.preloadUrls.push(pending.url);
    this.backgroundImage = null;
  }

  private preloadOneImage(): void {
    if (this.disposed || this.backgroundImage || this.isAssetCompilationInProgress()) return;
    // Bound even cache-hit scanning so this never monopolizes an idle callback.
    for (let i = 0; i < 32 && this.preloadUrls.length > 0; i++) {
      const url = this.preloadUrls.pop()!;
      if (this.imageByUrl.has(url)) continue;
      this.getLoadedImage(url, true);
      return;
    }
  }

  public readonly nominalTileSize = 112;

  private readonly runtimeVersion: NethackRuntimeVersion;

  public constructor(options: {
    dataRootUrl: string;
    onAssetReady?: () => void;
    runtimeVersion?: NethackRuntimeVersion;
  }) {
    const normalizedDataRootUrl = trimSlashes(String(options.dataRootUrl || ""));
    this.dataRootUrl = normalizedDataRootUrl;
    this.configUrl = `${normalizedDataRootUrl}/config/vulture_tiles.conf`;
    this.onAssetReady =
      typeof options.onAssetReady === "function" ? options.onAssetReady : null;
    this.runtimeVersion = options.runtimeVersion ?? "3.6.7";
    this.initializeLookupTables();
  }

  private shouldAvoidCatalogIdentityFallbackForRuntimeTile(
    kind: GlyphKind | null,
    tileIndex: number | null,
  ): boolean {
    if (this.runtimeVersion !== "slashem") {
      return false;
    }
    if (
      typeof tileIndex !== "number" ||
      !Number.isFinite(tileIndex) ||
      tileIndex < 0
    ) {
      return false;
    }
    switch (kind) {
      case "mon":
      case "pet":
      case "detect":
      case "ridden":
      case "statue":
      case "obj":
      case "body":
        return true;
      default:
        return false;
    }
  }

  private initializeLookupTables(): void {
    this.floorLookupByStylePattern.clear();
    for (const [rawStyle, pattern] of Object.entries(
      floorDecorPatternByStyle,
    ) as Array<[VultureFloorDecorStyle, { width: number; height: number }]>) {
      for (let x = 0; x < pattern.width; x += 1) {
        for (let y = 0; y < pattern.height; y += 1) {
          const key = `${rawStyle}:${x}:${y}`;
          this.floorLookupByStylePattern.set(
            key,
            createLookup("floor", `FLOOR_${rawStyle}_${x}_${y}`, "iso_floor"),
          );
        }
      }
    }

    this.wallLookupByVariantAndFace.clear();
    for (const variant of ["DARK", "ROUGH"] as const) {
      for (const faceToken of ["E", "S"] as const) {
        const key = `${variant}:${faceToken}`;
        this.wallLookupByVariantAndFace.set(
          key,
          createLookup("wall", `WALL_${variant}_F_${faceToken}`, "sprite"),
        );
      }
    }

    this.wallFaceLookupByStyleHeightFace.clear();
    for (const style of allWallDecorStyles) {
      for (const heightToken of ["F", "H"] as const) {
        for (const faceToken of ["W", "N", "E", "S"] as const) {
          const key = `${style}:${heightToken}:${faceToken}`;
          this.wallFaceLookupByStyleHeightFace.set(
            key,
            createLookup(
              "wall",
              `WALL_${style}_${heightToken}_${faceToken}`,
              "sprite",
            ),
          );
        }
      }
    }
  }

  private clearLookupDecisionCaches(): void {
    this.tileLookupDecisionCache.clear();
    this.wallFaceLookupDecisionCache.clear();
  }

  private cacheTileLookupDecision(
    key: string,
    lookup: VultureTileLookup | null,
  ): VultureTileLookup | null {
    if (this.tileLookupDecisionCache.size >= this.tileLookupDecisionCacheMaxEntries) {
      this.tileLookupDecisionCache.clear();
    }
    this.tileLookupDecisionCache.set(key, lookup);
    return lookup;
  }

  private cacheWallFaceLookupDecision(
    key: string,
    lookup: VultureTileLookup | null,
  ): VultureTileLookup | null {
    if (
      this.wallFaceLookupDecisionCache.size >=
      this.wallFaceLookupDecisionCacheMaxEntries
    ) {
      this.wallFaceLookupDecisionCache.clear();
    }
    this.wallFaceLookupDecisionCache.set(key, lookup);
    return lookup;
  }

  public resetRuntimeMapState(): void {
    this.knownCmapIndexByCoordinate.clear();
    this.lastResolvedRoomFloorByCoordinate.clear();
    this.roomSelectorHintByCoordinate.clear();
    this.roomSelectorObservationOrderByCoordinate.clear();
    this.roomIndexByCoordinate.clear();
    this.roomStateById.clear();
    this.decorativeFloorPlacementByCoordinate.clear();
    this.roomDecorDirtyCoordinateKeys.clear();
    this.pseudoRoomSelectorByRoomCell.clear();
    this.nextRuntimeRoomId = 1;
    this.roomSelectorObservationCounter = 1;
    this.roomDecorStateDirty = true;
    this.clearLookupDecisionCaches();
  }

  public consumeRoomDecorDirtyCoordinateKeys(): string[] {
    this.ensureRoomDecorState();
    if (this.roomDecorDirtyCoordinateKeys.size <= 0) {
      return [];
    }
    const keys = Array.from(this.roomDecorDirtyCoordinateKeys);
    this.roomDecorDirtyCoordinateKeys.clear();
    return keys;
  }

  public isAssetCompilationInProgress(): boolean {
    if (this.disposed) {
      return false;
    }
    const waitingForConfig =
      this.configLoadingStarted && !this.configLoaded && !this.configLoadFailed;
    if (waitingForConfig) {
      return true;
    }
    for (const [url, imageState] of this.imageByUrl) {
      if (imageState === "loading" &&
          (this.backgroundImage?.url !== url || this.backgroundImage.demanded)) {
        return true;
      }
    }
    return false;
  }

  public dispose(): void {
    this.idlePreloader?.dispose();
    this.idlePreloader = null;
    this.preloadUrls = [];
    this.disposed = true;
    this.imageByUrl.clear();
    this.rawEntryByToken.clear();
    this.resolvedEntryByToken.clear();
    this.defaultTargetByCategory.clear();
    this.rangeStartByKind.clear();
    this.cmapIndexByTileIndex.clear();
    this.objectTokenByTileIndex.clear();
    this.floorLookupByStylePattern.clear();
    this.wallLookupByVariantAndFace.clear();
    this.wallFaceLookupByStyleHeightFace.clear();
    this.resetRuntimeMapState();
    this.cmapTileLookupInitialized = false;
    this.configLoadingStarted = false;
    this.configLoaded = false;
    this.configLoadFailed = false;
    this.pendingAssetReadyCallback = false;
  }

  public drawTranslatedTile(params: DrawTranslatedTileParams): boolean {
    if (this.disposed) {
      return false;
    }
    this.ensureConfigLoadingStarted();
    if (!this.configLoaded) {
      return false;
    }

    const normalizedGlyph = Math.trunc(params.glyph);
    const normalizedTileIndex =
      typeof params.tileIndex === "number" && Number.isFinite(params.tileIndex)
        ? Math.trunc(params.tileIndex)
        : null;
    const normalizedTileX = normalizeMapCoordinate(params.tileX);
    const normalizedTileY = normalizeMapCoordinate(params.tileY);
    const lookup = this.resolveLookupForTile({
      glyph: normalizedGlyph,
      tileIndex: normalizedTileIndex,
      tileX: normalizedTileX,
      tileY: normalizedTileY,
      materialKind: params.materialKind,
      forBillboard: params.forBillboard,
    });
    if (!lookup) {
      return false;
    }

    return this.drawLookupTile({
      context: params.context,
      size: params.size,
      lookup,
      forBillboard: params.forBillboard,
    });
  }

  public ensureAssetLoadingStarted(): void {
    if (this.disposed) {
      return;
    }
    this.ensureConfigLoadingStarted();
  }

  public resolveLookupForTile(params: {
    glyph: number;
    tileIndex?: number | null;
    tileX?: number | null;
    tileY?: number | null;
    materialKind: TileMaterialKind | null;
    forBillboard: boolean;
  }): VultureTileLookup | null {
    if (this.disposed) {
      return null;
    }
    this.ensureConfigLoadingStarted();
    if (!this.configLoaded) {
      return null;
    }
    const normalizedGlyph = Math.trunc(params.glyph);
    const normalizedTileIndex =
      typeof params.tileIndex === "number" && Number.isFinite(params.tileIndex)
        ? Math.trunc(params.tileIndex)
        : null;
    const normalizedTileX = normalizeMapCoordinate(params.tileX);
    const normalizedTileY = normalizeMapCoordinate(params.tileY);
    if (!params.forBillboard) {
      const observedCmapIndex = this.resolveDirectCmapIndexFromContext(
        normalizedTileIndex,
        normalizedGlyph,
      );
      this.observeCmapIndexAtCoordinate(
        normalizedTileX,
        normalizedTileY,
        observedCmapIndex,
      );
    }
    const lookupCacheKey = `${normalizedGlyph}|${
      normalizedTileIndex === null ? "n" : normalizedTileIndex
    }|${params.materialKind ?? "none"}|${params.forBillboard ? 1 : 0}|${
      normalizedTileX === null ? "n" : normalizedTileX
    },${normalizedTileY === null ? "n" : normalizedTileY}`;
    if (this.tileLookupDecisionCache.has(lookupCacheKey)) {
      return this.tileLookupDecisionCache.get(lookupCacheKey) ?? null;
    }
    const resolvedTileIndexLookup =
      normalizedTileIndex !== null && normalizedTileIndex >= 0
        ? this.resolveTileLookupForTileIndex(
            normalizedTileIndex,
            params.materialKind,
            params.forBillboard,
            normalizedTileX,
            normalizedTileY,
          )
        : null;
    const catalogFallbackKind = (() => {
      const entry = getGlyphCatalogEntry(normalizedGlyph);
      return entry?.kind ?? null;
    })();
    const allowCatalogFallback =
      !this.shouldAvoidCatalogIdentityFallbackForRuntimeTile(
        catalogFallbackKind,
        normalizedTileIndex,
      );
    const resolvedLookup =
      resolvedTileIndexLookup ??
      (allowCatalogFallback
        ? this.resolveTileLookupForGlyph(
            normalizedGlyph,
            normalizedTileIndex,
            params.materialKind,
            params.forBillboard,
            normalizedTileX,
            normalizedTileY,
          )
        : null);
    return this.cacheTileLookupDecision(lookupCacheKey, resolvedLookup);
  }

  public drawLookupTile(params: DrawLookupTileParams): boolean {
    if (this.disposed) {
      return false;
    }
    this.ensureConfigLoadingStarted();
    if (!this.configLoaded) {
      return false;
    }
    const resolvedTile = this.resolveTileEntry(
      params.lookup.category,
      params.lookup.name,
    );
    if (!resolvedTile) {
      return false;
    }

    const imageUrl = this.resolveAssetUrl(resolvedTile.path);
    const image = this.getLoadedImage(imageUrl);
    if (!image) {
      return false;
    }

    const size = clampTileSize(params.size);
    if (params.lookup.projection === "iso_floor" && !params.forBillboard) {
      this.drawIsoFloorToTopDownTexture(
        params.context,
        size,
        image,
        resolvedTile.hsX,
        resolvedTile.hsY,
        params.lookup.category === "floor",
      );
      return true;
    }

    this.drawSpriteWithHotspot(
      params.context,
      size,
      image,
      resolvedTile.hsX,
      resolvedTile.hsY,
      params.forBillboard,
    );
    return true;
  }

  public drawLookupSourcePreview(params: DrawLookupSourcePreviewParams): boolean {
    if (this.disposed) {
      return false;
    }
    this.ensureConfigLoadingStarted();
    if (!this.configLoaded) {
      return false;
    }
    const resolvedTile = this.resolveTileEntry(
      params.lookup.category,
      params.lookup.name,
    );
    if (!resolvedTile) {
      return false;
    }
    const imageUrl = this.resolveAssetUrl(resolvedTile.path);
    const image = this.getLoadedImage(imageUrl);
    if (!image) {
      return false;
    }

    const size = clampTileSize(params.size);
    const sourceWidth = Math.max(1, image.width);
    const sourceHeight = Math.max(1, image.height);
    const scale = Math.max(
      0.001,
      Math.min(size / sourceWidth, size / sourceHeight),
    );
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    const drawX = Math.floor((size - drawWidth) * 0.5);
    const drawY = Math.floor((size - drawHeight) * 0.5);

    params.context.clearRect(0, 0, size, size);
    params.context.imageSmoothingEnabled = false;
    params.context.drawImage(
      image,
      0,
      0,
      sourceWidth,
      sourceHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    );
    return true;
  }

  public drawFallbackTile(
    context: CanvasRenderingContext2D,
    size: number,
    forBillboard: boolean,
  ): void {
    const normalizedSize = clampTileSize(size);
    if (forBillboard) {
      context.clearRect(0, 0, normalizedSize, normalizedSize);
      return;
    }
    context.fillStyle = "#6b736f";
    context.fillRect(0, 0, normalizedSize, normalizedSize);
    context.strokeStyle = "rgba(0, 0, 0, 0.32)";
    context.lineWidth = Math.max(1, Math.round(normalizedSize * 0.05));
    context.strokeRect(0, 0, normalizedSize, normalizedSize);
  }

  private makeToken(category: string, name: string): string {
    return `${category}.${name}`;
  }

  private resolveAssetUrl(relativePath: string): string {
    const normalizedRelativePath = String(relativePath || "")
      .replace(/\\/g, "/")
      .replace(/^\.?\//, "");
    return `${this.dataRootUrl}/${normalizedRelativePath}`;
  }

  private getLoadedImage(url: string, background = false): HTMLImageElement | null {
    if (this.disposed) {
      return null;
    }
    if (!background && this.backgroundImage?.url === url) this.backgroundImage.demanded = true;
    const cached = this.imageByUrl.get(url);
    if (cached instanceof HTMLImageElement) {
      return cached;
    }
    if (cached === "loading" || cached === null) {
      return null;
    }

    const image = new Image();
    if (background) {
      image.fetchPriority = "low";
      this.backgroundImage = { url, image, demanded: false };
    }
    this.imageByUrl.set(url, "loading");
    image.onload = () => {
      if (this.disposed) {
        return;
      }
      this.imageByUrl.set(url, image);
      const shouldNotify = !background || this.backgroundImage?.demanded === true;
      if (this.backgroundImage?.url === url) this.backgroundImage = null;
      if (shouldNotify) this.notifyAssetReady();
    };
    image.onerror = () => {
      if (this.disposed) {
        return;
      }
      this.imageByUrl.set(url, null);
      if (this.backgroundImage?.url === url) this.backgroundImage = null;
    };
    image.src = url;
    return null;
  }

  private notifyAssetReady(): void {
    if (this.disposed || !this.onAssetReady || this.pendingAssetReadyCallback) {
      return;
    }
    this.pendingAssetReadyCallback = true;
    const flush = (): void => {
      if (this.disposed) {
        return;
      }
      this.pendingAssetReadyCallback = false;
      this.onAssetReady?.();
    };
    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      window.requestAnimationFrame(() => flush());
      return;
    }
    flush();
  }

  private ensureConfigLoadingStarted(): void {
    if (this.disposed || this.configLoadingStarted) {
      return;
    }
    this.configLoadingStarted = true;
    this.configLoadFailed = false;
    void this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      const response = await fetch(this.configUrl);
      if (this.disposed) {
        return;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const configText = await response.text();
      if (this.disposed) {
        return;
      }
      this.parseConfig(configText);
      this.configLoaded = true;
      this.preloadUrls = Array.from(new Set(Array.from(this.rawEntryByToken.values())
        .filter(entry => entry.kind === "asset")
        .map(entry => this.resolveAssetUrl(entry.path))));
      this.configLoadFailed = false;
      this.notifyAssetReady();
    } catch (error) {
      if (this.disposed) {
        return;
      }
      console.warn(
        `Failed to load Vulture tile config from '${this.configUrl}':`,
        error,
      );
      this.configLoaded = false;
      this.configLoadFailed = true;
      this.notifyAssetReady();
    }
  }

  private parseConfig(configText: string): void {
    this.rawEntryByToken.clear();
    this.resolvedEntryByToken.clear();
    this.defaultTargetByCategory.clear();
    this.clearLookupDecisionCaches();

    const lines = String(configText || "").split(/\r?\n/g);
    const assetPattern =
      /^([a-z]+)\.([A-Za-z0-9_]+)\s*=\s*"([^"]+)"\s*(-?\d+)\s*(-?\d+)\s*$/;
    const redirectPattern =
      /^([a-z]+)\.([A-Za-z0-9_]+)\s*=>\s*([a-z]+)\.([A-Za-z0-9_]+)\s*$/;

    for (const rawLine of lines) {
      const lineWithoutComment = rawLine.replace(/\s*#.*$/, "").trim();
      if (!lineWithoutComment) {
        continue;
      }

      const assetMatch = lineWithoutComment.match(assetPattern);
      if (assetMatch) {
        const category = assetMatch[1];
        const name = normalizeTileNameToken(assetMatch[2]);
        const path = assetMatch[3];
        const hsX = Number.parseInt(assetMatch[4], 10);
        const hsY = Number.parseInt(assetMatch[5], 10);
        const token = this.makeToken(category, name);
        this.rawEntryByToken.set(token, {
          kind: "asset",
          path,
          hsX: Number.isFinite(hsX) ? hsX : 0,
          hsY: Number.isFinite(hsY) ? hsY : 0,
        });
        continue;
      }

      const redirectMatch = lineWithoutComment.match(redirectPattern);
      if (!redirectMatch) {
        continue;
      }

      const sourceCategory = redirectMatch[1];
      const sourceName = redirectMatch[2];
      const targetCategory = redirectMatch[3];
      const targetName = normalizeTileNameToken(redirectMatch[4]);
      if (sourceName.toLowerCase() === "default") {
        this.defaultTargetByCategory.set(sourceCategory, {
          category: targetCategory,
          name: targetName,
        });
        continue;
      }
      const token = this.makeToken(
        sourceCategory,
        normalizeTileNameToken(sourceName),
      );
      this.rawEntryByToken.set(token, {
        kind: "redirect",
        target: {
          category: targetCategory,
          name: targetName,
        },
      });
    }
  }

  private resolveTileEntry(
    category: string,
    name: string,
  ): VultureResolvedTileEntry | null {
    return this.resolveTileEntryRecursive(category, name, new Set<string>());
  }

  private resolveTileEntryRecursive(
    category: string,
    name: string,
    stack: Set<string>,
  ): VultureResolvedTileEntry | null {
    const normalizedName = normalizeTileNameToken(name);
    const token = this.makeToken(category, normalizedName);
    if (this.resolvedEntryByToken.has(token)) {
      return this.resolvedEntryByToken.get(token) ?? null;
    }
    if (stack.has(token)) {
      this.resolvedEntryByToken.set(token, null);
      return null;
    }
    stack.add(token);

    const rawEntry = this.rawEntryByToken.get(token);
    if (rawEntry?.kind === "asset") {
      const resolved: VultureResolvedTileEntry = {
        path: rawEntry.path,
        hsX: rawEntry.hsX,
        hsY: rawEntry.hsY,
      };
      this.resolvedEntryByToken.set(token, resolved);
      return resolved;
    }

    const target =
      rawEntry?.kind === "redirect"
        ? rawEntry.target
        : this.defaultTargetByCategory.get(category) ?? null;
    if (!target) {
      this.resolvedEntryByToken.set(token, null);
      return null;
    }

    const resolved = this.resolveTileEntryRecursive(
      target.category,
      target.name,
      stack,
    );
    this.resolvedEntryByToken.set(token, resolved);
    return resolved;
  }

  private getRangeStart(kind: string): number | null {
    if (this.rangeStartByKind.size === 0) {
      for (const range of getGlyphCatalogRanges()) {
        // Pile-top ranges repeat object/body/statue kinds after the ordinary
        // ranges. Object IDs are always relative to the ordinary range.
        if (!this.rangeStartByKind.has(range.kind)) {
          this.rangeStartByKind.set(range.kind, range.start);
        }
      }
    }
    return this.rangeStartByKind.get(kind) ?? null;
  }

  private resolveMonsterKeyForGlyph(
    glyphKind: string,
    glyph: number,
  ): string | null {
    if (this.runtimeVersion === "5.0") {
      const entry = getGlyphCatalogEntry(glyph);
      return typeof entry?.tileIndex === "number"
        ? legacyIdentitiesByTile.monsters.get(translateNh5TileIndexToNh367(entry.tileIndex)) ?? null
        : null;
    }
    const rangeStart = this.getRangeStart(glyphKind);
    if (rangeStart === null) {
      return null;
    }
    const monsterIndex = Math.trunc(glyph) - rangeStart;
    if (
      monsterIndex < 0 ||
      monsterIndex >= VULTURE_MONSTER_KEYS_367.length ||
      !Number.isFinite(monsterIndex)
    ) {
      return null;
    }
    return VULTURE_MONSTER_KEYS_367[monsterIndex] ?? null;
  }

  private ensureCmapTileLookupInitialized(): void {
    if (this.cmapTileLookupInitialized) {
      return;
    }
    this.cmapTileLookupInitialized = true;
    this.cmapIndexByTileIndex.clear();

    const range = getGlyphCatalogRanges().find((entry) => entry.kind === "cmap");
    if (!range) {
      return;
    }

    for (let glyph = range.start; glyph < range.endExclusive; glyph += 1) {
      const entry = getGlyphCatalogEntry(glyph);
      if (
        !entry ||
        typeof entry.tileIndex !== "number" ||
        !Number.isFinite(entry.tileIndex)
      ) {
        continue;
      }
      const tileIndex = Math.trunc(entry.tileIndex);
      if (tileIndex < 0 || this.cmapIndexByTileIndex.has(tileIndex)) {
        continue;
      }
      const cmapIndex = this.resolveCmapIndexForGlyph(glyph);
      if (cmapIndex !== null) this.cmapIndexByTileIndex.set(tileIndex, cmapIndex);
    }
  }

  public resolveCmapIndexForTileIndex(tileIndex: number): number | null {
    this.ensureCmapTileLookupInitialized();
    const cmapIndex = this.cmapIndexByTileIndex.get(Math.trunc(tileIndex));
    return typeof cmapIndex === "number" ? cmapIndex : null;
  }

  private resolveObjectTokenForObjectId(objectId: number): string | null {
    if (this.runtimeVersion === "5.0") {
      const objectStart = this.getRangeStart("obj");
      const entry = objectStart !== null ? getGlyphCatalogEntry(objectStart + objectId) : null;
      return entry?.kind === "obj" && typeof entry.tileIndex === "number"
        ? legacyIdentitiesByTile.objects.get(translateNh5TileIndexToNh367(entry.tileIndex)) ?? null
        : null;
    }
    return NETHACK_367_OBJECT_TOKENS[objectId] ?? null;
  }

  public setRuntimeObjectTileIndexByObjectId(
    tileIndexByObjectId: ReadonlyArray<number> | null | undefined,
  ): void {
    this.clearLookupDecisionCaches();
    this.objectTokenByTileIndex.clear();
    if (this.runtimeVersion === "slashem") {
      return;
    }
    if (!Array.isArray(tileIndexByObjectId) || tileIndexByObjectId.length <= 0) {
      return;
    }

    for (let objectId = 0; objectId < tileIndexByObjectId.length; objectId += 1) {
      const rawTileIndex = tileIndexByObjectId[objectId];
      if (typeof rawTileIndex !== "number" || !Number.isFinite(rawTileIndex)) {
        continue;
      }
      const tileIndex = Math.trunc(rawTileIndex);
      if (tileIndex < 0 || this.objectTokenByTileIndex.has(tileIndex)) {
        continue;
      }

      const token = this.resolveObjectTokenForObjectId(objectId);
      if (!token) {
        continue;
      }
      this.objectTokenByTileIndex.set(tileIndex, token);
    }
  }

  public resolveWallFaceLookup(
    params: ResolveWallFaceLookupParams,
  ): VultureTileLookup | null {
    const wallX = Math.trunc(params.wallX);
    const wallY = Math.trunc(params.wallY);
    const floorX = Math.trunc(params.floorX);
    const floorY = Math.trunc(params.floorY);
    const wallMaterialKind = params.wallMaterialKind ?? null;
    const heightToken: VultureWallHeightToken =
      params.halfHeight === true ? "H" : "F";
    let floorCmapIndex = this.resolveCmapIndexFromContext(
      params.floorTileIndex ?? null,
      params.floorGlyph ?? null,
      params.floorMaterialKind ?? null,
    );
    this.observeCmapIndexAtCoordinate(floorX, floorY, floorCmapIndex);
    if (floorCmapIndex === 20 && this.knownCmapIndexByCoordinate.get(this.makeCoordinateKey(floorX, floorY)) === 19) {
      // Losing sight of a room does not change the neighboring wall's decor.
      floorCmapIndex = 19;
    }
    const wallFaceLookupCacheKey = `${floorCmapIndex ?? "null"}|${
      wallMaterialKind ?? "none"
    }|${wallX},${wallY}|${floorX},${floorY}|${params.face}|${heightToken}`;
    if (this.wallFaceLookupDecisionCache.has(wallFaceLookupCacheKey)) {
      return this.wallFaceLookupDecisionCache.get(wallFaceLookupCacheKey) ?? null;
    }
    if (this.isWallOrUnmappedCmapIndex(floorCmapIndex)) {
      return this.cacheWallFaceLookupDecision(wallFaceLookupCacheKey, null);
    }

    const wallStyle = this.resolveWallDecorStyle({
      floorCmapIndex,
      wallMaterialKind,
      wallX,
      wallY,
      floorX,
      floorY,
    });
    const faceToken =
      params.face === "west"
        ? "W"
        : params.face === "north"
          ? "N"
          : params.face === "east"
            ? "E"
            : "S";
    const lookupKey = `${wallStyle}:${heightToken}:${faceToken}`;
    const lookup =
      this.wallFaceLookupByStyleHeightFace.get(lookupKey) ??
      createLookup(
        "wall",
        `WALL_${wallStyle}_${heightToken}_${faceToken}`,
        "sprite",
      );
    return this.cacheWallFaceLookupDecision(wallFaceLookupCacheKey, lookup);
  }

  private resolveTileLookupForTileIndex(
    tileIndex: number,
    materialKind: TileMaterialKind | null,
    forBillboard: boolean,
    floorX: number | null,
    floorY: number | null,
  ): VultureTileLookup | null {
    const cmapIndex = this.resolveCmapIndexForTileIndex(tileIndex);
    if (typeof cmapIndex === "number") {
      return this.resolveCmapLookup(cmapIndex, materialKind, floorX, floorY);
    }

    const objectToken = this.objectTokenByTileIndex.get(tileIndex);
    if (!objectToken) {
      return null;
    }
    return forBillboard
      ? {
          category: "object",
          name: objectToken,
          projection: "sprite",
        }
      : genericFloorLookup;
  }

  private resolveCmapIndexForGlyph(glyph: number): number | null {
    const entry = getGlyphCatalogEntry(Math.trunc(glyph));
    if (!entry || entry.kind !== "cmap") {
      return null;
    }
    if (this.runtimeVersion === "5.0") {
      // A 5.0 wall's glyph offset includes alternate-wall blocks; symidx keeps
      // the shared stone/wall/door semantics. Later symbols have new inserted
      // variants too, so translate their tiles into Vulture's 3.6 symbol order.
      if (typeof entry.symidx === "number" && entry.symidx >= 0 && entry.symidx <= 18) {
        return Math.trunc(entry.symidx);
      }
      return typeof entry.tileIndex === "number"
        ? legacyIdentitiesByTile.cmap.get(translateNh5TileIndexToNh367(entry.tileIndex)) ?? null
        : null;
    }
    const rangeStart = this.getRangeStart("cmap");
    if (rangeStart === null) {
      return null;
    }
    return entry.glyph - rangeStart;
  }

  private resolveDirectCmapIndexFromContext(
    tileIndex: number | null,
    glyph: number | null,
  ): number | null {
    if (typeof tileIndex === "number" && Number.isFinite(tileIndex)) {
      const cmapIndex = this.resolveCmapIndexForTileIndex(tileIndex);
      if (typeof cmapIndex === "number") {
        return cmapIndex;
      }
    }
    if (typeof glyph === "number" && Number.isFinite(glyph)) {
      const cmapIndex = this.resolveCmapIndexForGlyph(glyph);
      if (typeof cmapIndex === "number") {
        return cmapIndex;
      }
    }
    return null;
  }

  private makeCoordinateKey(x: number, y: number): string {
    return `${Math.trunc(x)},${Math.trunc(y)}`;
  }

  private parseCoordinateKey(
    key: string,
  ): {
    x: number;
    y: number;
  } | null {
    const separatorIndex = key.indexOf(",");
    if (separatorIndex <= 0 || separatorIndex >= key.length - 1) {
      return null;
    }
    const x = Number.parseInt(key.slice(0, separatorIndex), 10);
    const y = Number.parseInt(key.slice(separatorIndex + 1), 10);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return {
      x: Math.trunc(x),
      y: Math.trunc(y),
    };
  }

  private observeCmapIndexAtCoordinate(
    x: number | null,
    y: number | null,
    cmapIndex: number | null,
  ): void {
    if (x === null || y === null) {
      return;
    }
    if (typeof cmapIndex !== "number" || !Number.isFinite(cmapIndex)) {
      return;
    }
    const key = this.makeCoordinateKey(x, y);
    const previousCmapIndex = this.knownCmapIndexByCoordinate.get(key);
    const normalizedCmapIndex = Math.trunc(cmapIndex);
    // S_darkroom is a visibility representation, not a new room boundary.
    // Keep observed room membership and its floor/rug layout when it goes dark.
    if (normalizedCmapIndex === 20 && previousCmapIndex === 19) return;
    if (previousCmapIndex === normalizedCmapIndex) {
      return;
    }
    this.knownCmapIndexByCoordinate.set(key, normalizedCmapIndex);
    if (normalizedCmapIndex !== 19) this.lastResolvedRoomFloorByCoordinate.delete(key);
    if (normalizedCmapIndex === 19) {
      if (!this.roomSelectorHintByCoordinate.has(key)) {
        this.roomSelectorHintByCoordinate.set(
          key,
          this.resolvePseudoRoomSelector(x, y),
        );
        this.roomSelectorObservationOrderByCoordinate.set(
          key,
          this.roomSelectorObservationCounter,
        );
        this.roomSelectorObservationCounter += 1;
      }
    } else {
      this.roomSelectorHintByCoordinate.delete(key);
      this.roomSelectorObservationOrderByCoordinate.delete(key);
    }
    const touchesRoomState =
      previousCmapIndex === 19 || normalizedCmapIndex === 19;
    if (touchesRoomState) {
      this.roomDecorStateDirty = true;
      this.clearLookupDecisionCaches();
    }
  }

  private resolveCmapIndexFromContext(
    tileIndex: number | null,
    glyph: number | null,
    materialKind: TileMaterialKind | null,
  ): number | null {
    if (typeof tileIndex === "number" && Number.isFinite(tileIndex)) {
      const cmapIndex = this.resolveCmapIndexForTileIndex(tileIndex);
      if (typeof cmapIndex === "number") {
        return cmapIndex;
      }
    }

    if (typeof glyph === "number" && Number.isFinite(glyph)) {
      const cmapIndex = this.resolveCmapIndexForGlyph(glyph);
      if (typeof cmapIndex === "number") {
        return cmapIndex;
      }
    }

    switch (materialKind) {
      case "dark_wall":
        return 0;
      case "wall":
        return 1;
      case "door":
        return 21;
      case "dark":
        return 20;
      case "water":
        return 32;
      case "floor":
      case "stairs_up":
      case "stairs_down":
      case "trap":
      case "feature":
      case "fountain":
      case "player":
      case "monster_hostile":
      case "monster_friendly":
      case "monster_neutral":
      case "item":
      case "effect_warning":
      case "effect_zap":
      case "effect_explode":
      case "effect_swallow":
      case "default":
        return 19;
      default:
        return null;
    }
  }

  private isWallOrUnmappedCmapIndex(cmapIndex: number | null): boolean {
    if (typeof cmapIndex !== "number" || !Number.isFinite(cmapIndex)) {
      return true;
    }
    return cmapIndex >= 0 && cmapIndex <= 11;
  }

  private createRuntimeRoomState(
    anchorX: number,
    anchorY: number,
    selectorOverride?: number,
    firstSeenOrderOverride?: number,
  ): VultureRuntimeRoomState {
    const roomId = this.nextRuntimeRoomId;
    this.nextRuntimeRoomId += 1;
    const normalizedAnchorX = Math.trunc(anchorX);
    const normalizedAnchorY = Math.trunc(anchorY);
    const roomState: VultureRuntimeRoomState = {
      id: roomId,
      anchorX: normalizedAnchorX,
      anchorY: normalizedAnchorY,
      selector:
        typeof selectorOverride === "number" && Number.isFinite(selectorOverride)
          ? positiveModulo(selectorOverride, 4)
          : this.resolvePseudoRoomSelector(normalizedAnchorX, normalizedAnchorY),
      firstSeenOrder:
        typeof firstSeenOrderOverride === "number" &&
        Number.isFinite(firstSeenOrderOverride)
          ? Math.max(0, Math.trunc(firstSeenOrderOverride))
          : Number.POSITIVE_INFINITY,
      decorAnchor: null,
    };
    this.roomStateById.set(roomId, roomState);
    return roomState;
  }

  private ensureRuntimeRoomState(
    roomId: number,
    fallbackX: number,
    fallbackY: number,
  ): VultureRuntimeRoomState {
    const normalizedRoomId = Math.max(1, Math.trunc(roomId));
    const existing = this.roomStateById.get(normalizedRoomId);
    if (existing) {
      return existing;
    }
    const normalizedFallbackX = Math.trunc(fallbackX);
    const normalizedFallbackY = Math.trunc(fallbackY);
    const created: VultureRuntimeRoomState = {
      id: normalizedRoomId,
      anchorX: normalizedFallbackX,
      anchorY: normalizedFallbackY,
      selector: this.resolvePseudoRoomSelector(
        normalizedFallbackX,
        normalizedFallbackY,
      ),
      firstSeenOrder: Number.POSITIVE_INFINITY,
      decorAnchor: null,
    };
    this.roomStateById.set(normalizedRoomId, created);
    this.nextRuntimeRoomId = Math.max(
      this.nextRuntimeRoomId,
      normalizedRoomId + 1,
    );
    return created;
  }

  private mergeRuntimeRoomState(
    canonicalRoomId: number,
    mergedRoomId: number,
  ): void {
    if (canonicalRoomId === mergedRoomId) {
      return;
    }
    const canonical = this.roomStateById.get(canonicalRoomId);
    const merged = this.roomStateById.get(mergedRoomId);
    if (!canonical || !merged) {
      this.roomStateById.delete(mergedRoomId);
      return;
    }
    if (merged.firstSeenOrder < canonical.firstSeenOrder) {
      canonical.firstSeenOrder = merged.firstSeenOrder;
    }
    if (!canonical.decorAnchor && merged.decorAnchor) {
      canonical.decorAnchor = merged.decorAnchor;
    }
    this.roomStateById.delete(mergedRoomId);
  }

  private isDecorativePlacementEqual(
    left: VultureDecorativeFloorPlacement | undefined,
    right: VultureDecorativeFloorPlacement | undefined,
  ): boolean {
    if (!left && !right) {
      return true;
    }
    if (!left || !right) {
      return false;
    }
    return left.style === right.style && left.position === right.position;
  }

  private ensureRoomDecorState(): void {
    if (!this.roomDecorStateDirty) {
      return;
    }
    this.roomDecorStateDirty = false;
    const previousRoomIndexByCoordinate = new Map(this.roomIndexByCoordinate);
    const previousDecorativeFloorPlacementByCoordinate = new Map(
      this.decorativeFloorPlacementByCoordinate,
    );

    const roomKeys: string[] = [];
    for (const [key, cmapIndex] of this.knownCmapIndexByCoordinate) {
      if (cmapIndex === 19) {
        roomKeys.push(key);
      }
    }
    this.roomIndexByCoordinate.clear();
    this.decorativeFloorPlacementByCoordinate.clear();
    if (roomKeys.length <= 0) {
      if (
        previousRoomIndexByCoordinate.size > 0 ||
        previousDecorativeFloorPlacementByCoordinate.size > 0
      ) {
        for (const key of previousRoomIndexByCoordinate.keys()) {
          this.roomDecorDirtyCoordinateKeys.add(key);
        }
        for (const key of previousDecorativeFloorPlacementByCoordinate.keys()) {
          this.roomDecorDirtyCoordinateKeys.add(key);
        }
        this.clearLookupDecisionCaches();
      }
      return;
    }

    const roomKeySet = new Set(roomKeys);
    const coordinateByRoomKey = new Map<
      string,
      {
        x: number;
        y: number;
      }
    >();
    for (const key of roomKeys) {
      const coordinate = this.parseCoordinateKey(key);
      if (!coordinate) {
        continue;
      }
      coordinateByRoomKey.set(key, coordinate);
    }

    const visited = new Set<string>();
    const rooms: VultureKnownRoom[] = [];
    for (const roomKey of roomKeys) {
      if (visited.has(roomKey) || !coordinateByRoomKey.has(roomKey)) {
        continue;
      }
      const queue = [roomKey];
      visited.add(roomKey);
      const roomCellKeys: string[] = [];
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      while (queue.length > 0) {
        const currentKey = queue.pop() as string;
        const currentCoordinate = coordinateByRoomKey.get(currentKey);
        if (!currentCoordinate) {
          continue;
        }
        roomCellKeys.push(currentKey);
        minX = Math.min(minX, currentCoordinate.x);
        minY = Math.min(minY, currentCoordinate.y);
        maxX = Math.max(maxX, currentCoordinate.x);
        maxY = Math.max(maxY, currentCoordinate.y);

        const neighbors = [
          { x: currentCoordinate.x - 1, y: currentCoordinate.y },
          { x: currentCoordinate.x + 1, y: currentCoordinate.y },
          { x: currentCoordinate.x, y: currentCoordinate.y - 1 },
          { x: currentCoordinate.x, y: currentCoordinate.y + 1 },
        ];
        for (const neighbor of neighbors) {
          const neighborKey = this.makeCoordinateKey(neighbor.x, neighbor.y);
          if (!roomKeySet.has(neighborKey) || visited.has(neighborKey)) {
            continue;
          }
          visited.add(neighborKey);
          queue.push(neighborKey);
        }
      }

      if (roomCellKeys.length <= 0) {
        continue;
      }
      const fallbackCoordinate = {
        x: minX,
        y: minY,
      };
      let roomFirstObservationOrder = Number.POSITIVE_INFINITY;
      for (const key of roomCellKeys) {
        const observationOrder =
          this.roomSelectorObservationOrderByCoordinate.get(key) ??
          Number.POSITIVE_INFINITY;
        if (observationOrder < roomFirstObservationOrder) {
          roomFirstObservationOrder = observationOrder;
        }
      }
      const priorRoomIds = new Set<number>();
      for (const key of roomCellKeys) {
        const previousRoomId = previousRoomIndexByCoordinate.get(key);
        if (typeof previousRoomId === "number" && Number.isFinite(previousRoomId)) {
          priorRoomIds.add(Math.trunc(previousRoomId));
        }
      }
      let roomId: number;
      if (priorRoomIds.size > 0) {
        const sortedPriorRoomIds = Array.from(priorRoomIds).sort((left, right) => {
          const leftState = this.roomStateById.get(left);
          const rightState = this.roomStateById.get(right);
          const leftOrder = leftState?.firstSeenOrder ?? Number.POSITIVE_INFINITY;
          const rightOrder = rightState?.firstSeenOrder ?? Number.POSITIVE_INFINITY;
          if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
          }
          const leftAnchorX = leftState?.anchorX ?? fallbackCoordinate.x;
          const leftAnchorY = leftState?.anchorY ?? fallbackCoordinate.y;
          const rightAnchorX = rightState?.anchorX ?? fallbackCoordinate.x;
          const rightAnchorY = rightState?.anchorY ?? fallbackCoordinate.y;
          if (leftAnchorX !== rightAnchorX) {
            return leftAnchorX - rightAnchorX;
          }
          if (leftAnchorY !== rightAnchorY) {
            return leftAnchorY - rightAnchorY;
          }
          return left - right;
        });
        roomId = sortedPriorRoomIds[0];
        const canonicalRoomState = this.ensureRuntimeRoomState(
          roomId,
          fallbackCoordinate.x,
          fallbackCoordinate.y,
        );
        if (roomFirstObservationOrder < canonicalRoomState.firstSeenOrder) {
          canonicalRoomState.firstSeenOrder = roomFirstObservationOrder;
        }
        for (let index = 1; index < sortedPriorRoomIds.length; index += 1) {
          this.mergeRuntimeRoomState(roomId, sortedPriorRoomIds[index]);
        }
      } else {
        let preferredSelector: number | null = null;
        let preferredOrder = Number.POSITIVE_INFINITY;
        for (const key of roomCellKeys) {
          const hintedSelector = this.roomSelectorHintByCoordinate.get(key);
          if (typeof hintedSelector !== "number" || !Number.isFinite(hintedSelector)) {
            continue;
          }
          const observationOrder =
            this.roomSelectorObservationOrderByCoordinate.get(key) ??
            Number.POSITIVE_INFINITY;
          if (observationOrder < preferredOrder) {
            preferredOrder = observationOrder;
            preferredSelector = hintedSelector;
          }
        }
        roomId = this.createRuntimeRoomState(
          fallbackCoordinate.x,
          fallbackCoordinate.y,
          preferredSelector ?? undefined,
          preferredOrder,
        ).id;
      }
      rooms.push({
        id: roomId,
        lx: minX,
        ly: minY,
        hx: maxX,
        hy: maxY,
        cellKeys: roomCellKeys,
      });
    }

    rooms.sort((left, right) => {
      const leftState = this.roomStateById.get(left.id);
      const rightState = this.roomStateById.get(right.id);
      const leftAnchorX = leftState?.anchorX ?? left.lx;
      const leftAnchorY = leftState?.anchorY ?? left.ly;
      const rightAnchorX = rightState?.anchorX ?? right.lx;
      const rightAnchorY = rightState?.anchorY ?? right.ly;
      if (leftAnchorX !== rightAnchorX) {
        return leftAnchorX - rightAnchorX;
      }
      if (leftAnchorY !== rightAnchorY) {
        return leftAnchorY - rightAnchorY;
      }
      return left.id - right.id;
    });

    for (const room of rooms) {
      for (const key of room.cellKeys) {
        this.roomIndexByCoordinate.set(key, room.id);
      }
    }

    const candidateDecorativeFloorPlacements =
      this.buildDecorativeFloorPlacements(rooms);
    for (const room of rooms) {
      const roomState = this.ensureRuntimeRoomState(room.id, room.lx, room.ly);
      if (!roomState.decorAnchor) {
        const derivedDecorAnchor = this.deriveDecorAnchorFromPlacements(
          room,
          candidateDecorativeFloorPlacements,
        );
        if (derivedDecorAnchor) {
          roomState.decorAnchor = derivedDecorAnchor;
        }
      }
      if (roomState.decorAnchor) {
        this.applyDecorAnchorPlacementForRoom(
          room,
          roomState.decorAnchor,
          this.decorativeFloorPlacementByCoordinate,
        );
        continue;
      }
      this.applyCandidateDecorPlacementsForRoom(
        room,
        candidateDecorativeFloorPlacements,
        this.decorativeFloorPlacementByCoordinate,
      );
    }

    for (const [key, previousRoomId] of previousRoomIndexByCoordinate.entries()) {
      const nextRoomId = this.roomIndexByCoordinate.get(key);
      if (nextRoomId !== previousRoomId) {
        this.roomDecorDirtyCoordinateKeys.add(key);
        continue;
      }
      const previousDecor =
        previousDecorativeFloorPlacementByCoordinate.get(key);
      const nextDecor = this.decorativeFloorPlacementByCoordinate.get(key);
      if (!this.isDecorativePlacementEqual(previousDecor, nextDecor)) {
        this.roomDecorDirtyCoordinateKeys.add(key);
      }
    }
    for (const key of this.roomIndexByCoordinate.keys()) {
      if (!previousRoomIndexByCoordinate.has(key)) {
        this.roomDecorDirtyCoordinateKeys.add(key);
      }
    }
    for (const key of this.decorativeFloorPlacementByCoordinate.keys()) {
      if (!previousDecorativeFloorPlacementByCoordinate.has(key)) {
        this.roomDecorDirtyCoordinateKeys.add(key);
      }
    }
    for (const key of previousDecorativeFloorPlacementByCoordinate.keys()) {
      if (!this.decorativeFloorPlacementByCoordinate.has(key)) {
        this.roomDecorDirtyCoordinateKeys.add(key);
      }
    }
    if (this.roomDecorDirtyCoordinateKeys.size > 0) {
      this.clearLookupDecisionCaches();
    }
  }

  private buildDecorativeFloorPlacements(
    rooms: ReadonlyArray<VultureKnownRoom>,
  ): Map<string, VultureDecorativeFloorPlacement> {
    const roomCount = rooms.length;
    if (roomCount <= 0) {
      return new Map();
    }

    const placedDecorByCoordinate = new Map<string, number>();
    const getDecorCodeAt = (x: number, y: number): number =>
      placedDecorByCoordinate.get(this.makeCoordinateKey(x, y)) ?? 0;
    const setDecorCodeAt = (x: number, y: number, code: number): void => {
      placedDecorByCoordinate.set(this.makeCoordinateKey(x, y), Math.trunc(code));
    };
    const clearDecorCodeAt = (x: number, y: number): void => {
      placedDecorByCoordinate.set(this.makeCoordinateKey(x, y), 0);
    };
    const decodeDecorStyleIndex = (code: number): number => {
      const encodedStyle = (Math.trunc(code) >> 4) - 1;
      if (
        encodedStyle < 0 ||
        encodedStyle >= decorativeFloorStylesInPlacementOrder.length
      ) {
        return -1;
      }
      return encodedStyle;
    };
    const getDecorPatternDimensions = (styleIndex: number) => {
      const style = decorativeFloorStylesInPlacementOrder[styleIndex];
      return floorDecorPatternByStyle[style];
    };

    let roomno = 0;
    const wrapadd = roomCount % 5 === 0 ? 1 : 0;
    for (
      let decorAttempt = 0;
      decorAttempt < vultureDecorativeFloorPlacementCount;
      decorAttempt += 1
    ) {
      const currentStyleIndex = positiveModulo(
        roomno,
        decorativeFloorStylesInPlacementOrder.length,
      );
      const currentPattern = getDecorPatternDimensions(currentStyleIndex);
      let retries = roomCount;
      let placed = false;

      while (retries-- > 0 && !placed) {
        const room = rooms[positiveModulo(roomno, roomCount)];
        let lx = room.lx;
        let ly = room.ly;
        while (ly <= room.hy) {
          const currentCode = getDecorCodeAt(lx, ly);
          const oldStyleIndex = decodeDecorStyleIndex(currentCode);
          if (oldStyleIndex < 0) {
            break;
          }
          while (lx <= room.hx) {
            const currentLineCode = getDecorCodeAt(lx, ly);
            const oldStyleIndexAtLine = decodeDecorStyleIndex(currentLineCode);
            if (oldStyleIndexAtLine < 0) {
              break;
            }
            lx += getDecorPatternDimensions(oldStyleIndexAtLine).width;
          }
          ly += getDecorPatternDimensions(oldStyleIndex).height;
          lx = room.lx;
        }

        if (
          room.hx - lx + 1 >= currentPattern.width &&
          room.hy - ly + 1 >= currentPattern.height
        ) {
          placed = true;
          for (let y = 0; y < currentPattern.height; y += 1) {
            for (let x = 0; x < currentPattern.width; x += 1) {
              const code =
                ((currentStyleIndex + 1) << 4) + y * currentPattern.width + x;
              setDecorCodeAt(lx + x, ly + y, code);
            }
          }
        }
      }

      if (!placed) {
        break;
      }

      roomno += 5;
      if (roomno >= roomCount) {
        roomno = positiveModulo((roomno % roomCount) + wrapadd, roomCount);
      }
    }

    for (const room of rooms) {
      let lx = room.lx;
      let ly = room.ly;
      while (lx <= room.hx && getDecorCodeAt(lx, ly) !== 0) {
        lx += 1;
      }
      const decorWidth = lx - room.lx;
      lx = room.lx;

      while (ly <= room.hy && getDecorCodeAt(lx, ly) !== 0) {
        ly += 1;
      }
      const decorHeight = ly - room.ly;
      if (decorWidth <= 0 || decorHeight <= 0) {
        continue;
      }

      const xoffset = Math.trunc(
        (room.lx + room.hx + 1) / 2 - decorWidth / 2,
      );
      const yoffset = Math.trunc(
        (room.ly + room.hy + 1) / 2 - decorHeight / 2,
      );

      for (let y = decorHeight - 1; y >= 0; y -= 1) {
        for (let x = decorWidth - 1; x >= 0; x -= 1) {
          const sourceCode = getDecorCodeAt(room.lx + x, room.ly + y);
          setDecorCodeAt(xoffset + x, yoffset + y, sourceCode);
        }
      }

      for (let y = room.ly; y < yoffset; y += 1) {
        for (let x = room.lx; x <= room.hx; x += 1) {
          clearDecorCodeAt(x, y);
        }
      }
      for (let y = room.ly; y <= room.hy; y += 1) {
        for (let x = room.lx; x < xoffset; x += 1) {
          clearDecorCodeAt(x, y);
        }
      }
    }

    const resolvedPlacements = new Map<string, VultureDecorativeFloorPlacement>();
    for (const [key, code] of placedDecorByCoordinate) {
      const styleIndex = decodeDecorStyleIndex(code);
      if (styleIndex < 0) {
        continue;
      }
      const style = decorativeFloorStylesInPlacementOrder[styleIndex];
      const pattern = floorDecorPatternByStyle[style];
      const patternTileCount = Math.max(1, pattern.width * pattern.height);
      const decorPosition = positiveModulo(code & 0x0f, patternTileCount);
      resolvedPlacements.set(key, {
        style,
        position: decorPosition,
      });
    }
    return resolvedPlacements;
  }

  private deriveDecorAnchorFromPlacements(
    room: VultureKnownRoom,
    candidateDecorativeFloorPlacements: ReadonlyMap<
      string,
      VultureDecorativeFloorPlacement
    >,
  ): VultureRoomDecorAnchor | null {
    let selectedCoordinate: { x: number; y: number } | null = null;
    let selectedDecorPlacement: VultureDecorativeFloorPlacement | null = null;
    for (const key of room.cellKeys) {
      const decorPlacement = candidateDecorativeFloorPlacements.get(key);
      if (!decorPlacement) {
        continue;
      }
      const coordinate = this.parseCoordinateKey(key);
      if (!coordinate) {
        continue;
      }
      if (
        !selectedCoordinate ||
        coordinate.y < selectedCoordinate.y ||
        (coordinate.y === selectedCoordinate.y &&
          coordinate.x < selectedCoordinate.x)
      ) {
        selectedCoordinate = coordinate;
        selectedDecorPlacement = decorPlacement;
      }
    }
    if (!selectedCoordinate || !selectedDecorPlacement) {
      return null;
    }
    const pattern = floorDecorPatternByStyle[selectedDecorPlacement.style];
    const patternTileCount = Math.max(1, pattern.width * pattern.height);
    const normalizedPosition = positiveModulo(
      selectedDecorPlacement.position,
      patternTileCount,
    );
    const patternX = normalizedPosition % pattern.width;
    const patternY = Math.trunc(normalizedPosition / pattern.width);
    return {
      style: selectedDecorPlacement.style,
      originX: selectedCoordinate.x - patternX,
      originY: selectedCoordinate.y - patternY,
    };
  }

  private applyDecorAnchorPlacementForRoom(
    room: VultureKnownRoom,
    decorAnchor: VultureRoomDecorAnchor,
    placementsByCoordinate: Map<string, VultureDecorativeFloorPlacement>,
  ): void {
    const pattern = floorDecorPatternByStyle[decorAnchor.style];
    const roomCellKeySet = new Set(room.cellKeys);
    for (let patternY = 0; patternY < pattern.height; patternY += 1) {
      for (let patternX = 0; patternX < pattern.width; patternX += 1) {
        const worldX = decorAnchor.originX + patternX;
        const worldY = decorAnchor.originY + patternY;
        const key = this.makeCoordinateKey(worldX, worldY);
        if (!roomCellKeySet.has(key)) {
          continue;
        }
        const position = patternY * pattern.width + patternX;
        placementsByCoordinate.set(key, {
          style: decorAnchor.style,
          position,
        });
      }
    }
  }

  private applyCandidateDecorPlacementsForRoom(
    room: VultureKnownRoom,
    candidateDecorativeFloorPlacements: ReadonlyMap<
      string,
      VultureDecorativeFloorPlacement
    >,
    placementsByCoordinate: Map<string, VultureDecorativeFloorPlacement>,
  ): void {
    for (const key of room.cellKeys) {
      const decorPlacement = candidateDecorativeFloorPlacements.get(key);
      if (!decorPlacement) {
        continue;
      }
      placementsByCoordinate.set(key, decorPlacement);
    }
  }

  private resolvePseudoRoomSelector(
    floorX: number | null,
    floorY: number | null,
  ): number {
    if (floorX === null || floorY === null) {
      return 1;
    }
    const roomCellX = Math.floor(floorX / 8);
    const roomCellY = Math.floor(floorY / 8);
    const roomCellKey = `${roomCellX},${roomCellY}`;
    const cachedSelector = this.pseudoRoomSelectorByRoomCell.get(roomCellKey);
    if (typeof cachedSelector === "number") {
      return cachedSelector;
    }
    const roomSeed =
      Math.imul(roomCellX + 17, 73856093) ^
      Math.imul(roomCellY + 31, 19349663);
    const selector = positiveModulo(roomSeed, 4);
    this.pseudoRoomSelectorByRoomCell.set(roomCellKey, selector);
    return selector;
  }

  private resolveRoomSelectorForCoordinate(
    floorX: number | null,
    floorY: number | null,
  ): number {
    if (floorX !== null && floorY !== null) {
      this.ensureRoomDecorState();
      const roomId = this.roomIndexByCoordinate.get(
        this.makeCoordinateKey(floorX, floorY),
      );
      if (typeof roomId === "number" && Number.isFinite(roomId)) {
        const roomState = this.roomStateById.get(roomId);
        if (roomState) {
          return positiveModulo(roomState.selector, 4);
        }
        return positiveModulo(roomId, 4);
      }
    }
    return this.resolvePseudoRoomSelector(floorX, floorY);
  }

  private resolveDecorativeFloorLookupForCoordinate(
    floorX: number | null,
    floorY: number | null,
  ): VultureTileLookup | null {
    if (floorX === null || floorY === null) {
      return null;
    }
    this.ensureRoomDecorState();
    const decor = this.decorativeFloorPlacementByCoordinate.get(
      this.makeCoordinateKey(floorX, floorY),
    );
    if (!decor) {
      return null;
    }
    const pattern = floorDecorPatternByStyle[decor.style];
    const patternTileCount = Math.max(1, pattern.width * pattern.height);
    const normalizedPosition = positiveModulo(decor.position, patternTileCount);
    const patternX = normalizedPosition % pattern.width;
    const patternY = Math.trunc(normalizedPosition / pattern.width);
    return this.resolveFloorLookup(decor.style, patternX, patternY);
  }

  private resolveFloorDecorStyleForCmap(
    cmapIndex: number,
    floorX: number | null,
    floorY: number | null,
  ): VultureFloorDecorStyle | null {
    // Ported from Vulture floor style selection (levelwin::get_floor_decor).
    if (cmapIndex === 19) {
      const roomSelector = this.resolveRoomSelectorForCoordinate(floorX, floorY);
      return resolveRoomFloorStyleBySelector(roomSelector);
    }
    return fixedFloorDecorStyleByCmap.get(cmapIndex) ?? null;
  }

  private resolveFloorPatternCoordinate(
    coordinate: number | null,
    size: number,
  ): number {
    const normalizedSize = Math.max(1, Math.trunc(size));
    if (coordinate === null) {
      return Math.min(1, normalizedSize - 1);
    }
    return positiveModulo(coordinate, normalizedSize);
  }

  private resolveFloorLookup(
    floorStyle: VultureFloorDecorStyle,
    floorX: number | null,
    floorY: number | null,
  ): VultureTileLookup {
    // Vulture picks floor tile variants by coordinate modulo style dimensions.
    const pattern =
      floorDecorPatternByStyle[floorStyle] ?? floorDecorPatternByStyle.COBBLESTONE;
    const patternX = this.resolveFloorPatternCoordinate(floorX, pattern.width);
    const patternY = this.resolveFloorPatternCoordinate(floorY, pattern.height);
    const lookupKey = `${floorStyle}:${patternX}:${patternY}`;
    const cachedLookup = this.floorLookupByStylePattern.get(lookupKey);
    if (cachedLookup) {
      return cachedLookup;
    }
    const fallbackLookup = createLookup(
      "floor",
      `FLOOR_${floorStyle}_${patternX}_${patternY}`,
      "iso_floor",
    );
    this.floorLookupByStylePattern.set(lookupKey, fallbackLookup);
    return fallbackLookup;
  }

  public resolveDoorwayFloorLookup(
    floorX: number | null,
    floorY: number | null,
  ): VultureTileLookup {
    return this.resolveFloorLookup(
      "ROUGH",
      normalizeMapCoordinate(floorX),
      normalizeMapCoordinate(floorY),
    );
  }

  private resolveWallDecorStyle(params: {
    floorCmapIndex: number | null;
    wallMaterialKind: TileMaterialKind | null;
    wallX: number;
    wallY: number;
    floorX: number;
    floorY: number;
  }): VultureWallDecorStyle {
    if (params.wallMaterialKind === "dark_wall") {
      return "DARK";
    }
    const floorCmapIndex =
      typeof params.floorCmapIndex === "number" &&
      Number.isFinite(params.floorCmapIndex)
        ? Math.trunc(params.floorCmapIndex)
        : null;
    if (floorCmapIndex === 21 || floorCmapIndex === 22) {
      return "ROUGH";
    }
    // Doors, bars, trees and drawbridges use rough floor backdrops in Vulture.
    if (
      (floorCmapIndex !== null && floorCmapIndex >= 12 && floorCmapIndex <= 18) ||
      floorCmapIndex === 35 ||
      floorCmapIndex === 36 ||
      floorCmapIndex === 37 ||
      floorCmapIndex === 38
    ) {
      return "ROUGH";
    }
    if (floorCmapIndex === 19) {
      const roomSelector = this.resolveRoomSelectorForCoordinate(
        params.floorX,
        params.floorY,
      );
      switch (roomSelector) {
        case 0:
          return "STUCCO";
        case 1: {
          const brickVariantSeed =
            Math.imul(params.wallY + 1, params.wallX + 1) - 1;
          const brickVariantIndex = positiveModulo(
            brickVariantSeed,
            brickWallDecorVariants.length,
          );
          return brickWallDecorVariants[brickVariantIndex];
        }
        case 2:
          return "VINE_COVERED";
        case 3:
          return "MARBLE";
        default:
          return "BRICK";
      }
    }
    return "BRICK";
  }

  private resolveWallLookup(
    cmapIndex: number,
    materialKind: TileMaterialKind | null,
  ): VultureTileLookup {
    const wallVariant =
      materialKind === "dark_wall" || cmapIndex === 0
        ? "DARK"
        : "ROUGH";
    // Vulture resolves wall faces from neighboring floor cells (mapdata.cpp +
    // levelwin.cpp). For our cube model, pick an orientation proxy from the
    // cmap symbol to keep wall UVs deterministic.
    const faceToken =
      cmapIndex === 1 || cmapIndex === 10 || cmapIndex === 11 ? "E" : "S";
    const lookupKey = `${wallVariant}:${faceToken}`;
    const cachedLookup = this.wallLookupByVariantAndFace.get(lookupKey);
    if (cachedLookup) {
      return cachedLookup;
    }
    const fallbackLookup = createLookup(
      "wall",
      `WALL_${wallVariant}_F_${faceToken}`,
      "sprite",
    );
    this.wallLookupByVariantAndFace.set(lookupKey, fallbackLookup);
    return fallbackLookup;
  }

  private resolveCmapLookup(
    cmapIndex: number,
    materialKind: TileMaterialKind | null,
    floorX: number | null,
    floorY: number | null,
  ): VultureTileLookup {
    const coordinateKey = floorX !== null && floorY !== null
      ? this.makeCoordinateKey(floorX, floorY) : null;
    if (cmapIndex === 20 && coordinateKey !== null &&
        this.knownCmapIndexByCoordinate.get(coordinateKey) === 19) {
      const remembered = this.lastResolvedRoomFloorByCoordinate.get(coordinateKey);
      if (remembered) return remembered;
      // The room may have been observed by a neighboring wall before its own
      // floor texture was requested. Resolve only that already-known terrain.
      return this.resolveCmapLookup(19, materialKind, floorX, floorY);
    }
    if (cmapIndex === 19) {
      const decorativeLookup = this.resolveDecorativeFloorLookupForCoordinate(
        floorX,
        floorY,
      );
      const resolved = decorativeLookup ?? this.resolveFloorLookup(
        this.resolveFloorDecorStyleForCmap(cmapIndex, floorX, floorY) ?? "COBBLESTONE", floorX, floorY,
      );
      if (coordinateKey !== null) this.lastResolvedRoomFloorByCoordinate.set(coordinateKey, resolved);
      return resolved;
    }

    const floorDecorStyle = this.resolveFloorDecorStyleForCmap(
      cmapIndex,
      floorX,
      floorY,
    );
    if (floorDecorStyle) {
      return this.resolveFloorLookup(floorDecorStyle, floorX, floorY);
    }

    if (cmapIndex >= 0 && cmapIndex <= 11) {
      return this.resolveWallLookup(cmapIndex, materialKind);
    }
    if (cmapIndex === 12) {
      // Doorway openings sit on rough floor in Vulture mapdata.
      return this.resolveFloorLookup("ROUGH", floorX, floorY);
    }
    const staticLookup = staticCmapLookupByIndex.get(cmapIndex);
    if (staticLookup) {
      return staticLookup;
    }
    if (materialKind === "dark_wall" || materialKind === "wall") {
      return this.resolveWallLookup(cmapIndex, materialKind);
    }
    if (materialKind === "dark") {
      return this.resolveFloorLookup("DARK", floorX, floorY);
    }
    return genericFloorLookup;
  }

  private resolveTileLookupForGlyph(
    glyph: number,
    tileIndex: number | null,
    materialKind: TileMaterialKind | null,
    forBillboard: boolean,
    floorX: number | null,
    floorY: number | null,
  ): VultureTileLookup | null {
    const entry = getGlyphCatalogEntry(glyph);
    if (!entry) {
      return null;
    }

    switch (entry.kind) {
      case "mon":
      case "pet":
      case "detect":
      case "ridden": {
        const key = this.resolveMonsterKeyForGlyph(entry.kind, glyph);
        if (!key) {
          return null;
        }
        return {
          category: "monster",
          name: key,
          projection: "sprite",
        };
      }
      case "statue": {
        const key = this.resolveMonsterKeyForGlyph("statue", glyph);
        if (!key) {
          return null;
        }
        return {
          category: "statue",
          name: key,
          projection: "sprite",
        };
      }
      case "cmap": {
        const cmapIndex = this.resolveCmapIndexForGlyph(glyph);
        if (cmapIndex === null) {
          return null;
        }
        return this.resolveCmapLookup(cmapIndex, materialKind, floorX, floorY);
      }
      case "warning": {
        const rangeStart = this.getRangeStart("warning");
        if (rangeStart === null) {
          return null;
        }
        const warningIndex = glyph - rangeStart;
        return {
          category: "misc",
          name: `WARNLEV_${warningIndex + 1}`,
          projection: "sprite",
        };
      }
      case "zap": {
        const rangeStart = this.getRangeStart("zap");
        if (rangeStart === null) {
          return null;
        }
        const zapIndex = glyph - rangeStart;
        const zapName = zapTileNames[zapIndex % zapTileNames.length];
        return {
          category: "misc",
          name: zapName,
          projection: "sprite",
        };
      }
      case "explode": {
        const rangeStart = this.getRangeStart("explode");
        if (rangeStart === null) {
          return null;
        }
        const explosionOffset = glyph - rangeStart;
        const typeIndex = Math.floor(explosionOffset / 9);
        const frameIndex = (explosionOffset % 9) + 1;
        const typeName =
          explosionTypeNames[typeIndex] ?? explosionTypeNames[0];
        return {
          category: "explosion",
          name: `${typeName}_${frameIndex}`,
          projection: "sprite",
        };
      }
      case "obj":
      case "body": {
        if (
          forBillboard &&
          typeof tileIndex === "number" &&
          Number.isFinite(tileIndex) &&
          tileIndex >= 0 &&
          entry.kind === "obj"
        ) {
          const rangeStart = getGlyphCatalogRanges().find(
            (range) => range.kind === "obj" && glyph >= range.start && glyph < range.endExclusive,
          )?.start ?? null;
          if (rangeStart !== null) {
            const objectId = glyph - rangeStart;
            if (
              objectId >= 0 &&
              Number.isInteger(objectId)
            ) {
              const objectToken = this.resolveObjectTokenForObjectId(objectId);
              if (objectToken) {
                this.objectTokenByTileIndex.set(Math.trunc(tileIndex), objectToken);
                return {
                  category: "object",
                  name: objectToken,
                  projection: "sprite",
                };
              }
            }
          }
        }
        return forBillboard
          ? {
              category: "object",
              name: "STRANGE_OBJECT",
              projection: "sprite",
            }
          : genericFloorLookup;
      }
      default:
        return null;
    }
  }

  private drawIsoFloorToTopDownTexture(
    context: CanvasRenderingContext2D,
    size: number,
    image: HTMLImageElement,
    hsX: number,
    hsY: number,
    solidifyOpaqueEdges: boolean = false,
  ): void {
    const hotspotX = -hsX;
    const hotspotY = -hsY;
    const sourceWidth = Math.max(1, image.width);
    const sourceHeight = Math.max(1, image.height);

    const scaleX = size / sourceWidth;
    const scaleY = size / sourceHeight;
    const matrixA = scaleX;
    const matrixB = -scaleX;
    const matrixC = scaleY;
    const matrixD = scaleY;
    const matrixE = size * 0.5 - matrixA * hotspotX - matrixC * hotspotY;
    const matrixF = size * 0.5 - matrixB * hotspotX - matrixD * hotspotY;

    context.save();
    context.imageSmoothingEnabled = false;
    context.setTransform(matrixA, matrixB, matrixC, matrixD, matrixE, matrixF);
    context.drawImage(image, 0, 0);
    context.restore();
    this.dilateTransparentPixels(context, size, 2);
    if (solidifyOpaqueEdges) {
      this.solidifyOpaqueTileToBorders(context, size);
    }
  }

  private dilateOpaquePixels(
    data: Uint8ClampedArray,
    size: number,
    iterations: number,
  ): void {
    if (iterations <= 0 || size <= 1) {
      return;
    }
    const directions: ReadonlyArray<readonly [number, number]> = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (let pass = 0; pass < iterations; pass += 1) {
      const source = new Uint8ClampedArray(data);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const index = (y * size + x) * 4;
          if (source[index + 3] > 0) {
            continue;
          }
          let bestNeighborIndex = -1;
          let bestNeighborAlpha = 0;
          for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) {
              continue;
            }
            const neighborIndex = (ny * size + nx) * 4;
            const neighborAlpha = source[neighborIndex + 3];
            if (neighborAlpha <= bestNeighborAlpha) {
              continue;
            }
            bestNeighborAlpha = neighborAlpha;
            bestNeighborIndex = neighborIndex;
          }
          if (bestNeighborIndex < 0) {
            continue;
          }
          data[index] = source[bestNeighborIndex];
          data[index + 1] = source[bestNeighborIndex + 1];
          data[index + 2] = source[bestNeighborIndex + 2];
          data[index + 3] = source[bestNeighborIndex + 3];
        }
      }
    }
  }

  private extendOpaqueRunsToBorders(
    data: Uint8ClampedArray,
    size: number,
  ): void {
    const rowHasOpaque = new Array<boolean>(size).fill(false);
    for (let y = 0; y < size; y += 1) {
      let firstOpaqueX = -1;
      let lastOpaqueX = -1;
      for (let x = 0; x < size; x += 1) {
        const alpha = data[(y * size + x) * 4 + 3];
        if (alpha <= 0) {
          continue;
        }
        if (firstOpaqueX < 0) {
          firstOpaqueX = x;
        }
        lastOpaqueX = x;
      }
      if (firstOpaqueX < 0 || lastOpaqueX < 0) {
        continue;
      }
      rowHasOpaque[y] = true;
      const firstIndex = (y * size + firstOpaqueX) * 4;
      const lastIndex = (y * size + lastOpaqueX) * 4;
      for (let x = 0; x < firstOpaqueX; x += 1) {
        const index = (y * size + x) * 4;
        data[index] = data[firstIndex];
        data[index + 1] = data[firstIndex + 1];
        data[index + 2] = data[firstIndex + 2];
        data[index + 3] = data[firstIndex + 3];
      }
      for (let x = lastOpaqueX + 1; x < size; x += 1) {
        const index = (y * size + x) * 4;
        data[index] = data[lastIndex];
        data[index + 1] = data[lastIndex + 1];
        data[index + 2] = data[lastIndex + 2];
        data[index + 3] = data[lastIndex + 3];
      }
    }
    for (let y = 0; y < size; y += 1) {
      if (rowHasOpaque[y]) {
        continue;
      }
      let sourceRow = -1;
      for (let search = y - 1; search >= 0; search -= 1) {
        if (rowHasOpaque[search]) {
          sourceRow = search;
          break;
        }
      }
      if (sourceRow < 0) {
        for (let search = y + 1; search < size; search += 1) {
          if (rowHasOpaque[search]) {
            sourceRow = search;
            break;
          }
        }
      }
      if (sourceRow < 0) {
        continue;
      }
      for (let x = 0; x < size; x += 1) {
        const srcIndex = (sourceRow * size + x) * 4;
        const destIndex = (y * size + x) * 4;
        data[destIndex] = data[srcIndex];
        data[destIndex + 1] = data[srcIndex + 1];
        data[destIndex + 2] = data[srcIndex + 2];
        data[destIndex + 3] = data[srcIndex + 3];
      }
      rowHasOpaque[y] = true;
    }
  }

  private solidifyOpaqueTileToBorders(
    context: CanvasRenderingContext2D,
    size: number,
  ): void {
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    this.dilateOpaquePixels(data, size, 3);
    this.extendOpaqueRunsToBorders(data, size);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] <= 0) {
        continue;
      }
      data[i + 3] = 255;
    }
    context.putImageData(imageData, 0, 0);
  }

  private dilateTransparentPixels(
    context: CanvasRenderingContext2D,
    size: number,
    iterations: number,
  ): void {
    if (iterations <= 0) {
      return;
    }
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    for (let pass = 0; pass < iterations; pass += 1) {
      const source = new Uint8ClampedArray(data);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const index = (y * size + x) * 4;
          if (source[index + 3] > 0) {
            continue;
          }
          let sumR = 0;
          let sumG = 0;
          let sumB = 0;
          let sumA = 0;
          let sampleCount = 0;
          for (const [dx, dy] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ] as const) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) {
              continue;
            }
            const neighborIndex = (ny * size + nx) * 4;
            const alpha = source[neighborIndex + 3];
            if (alpha <= 0) {
              continue;
            }
            sumR += source[neighborIndex];
            sumG += source[neighborIndex + 1];
            sumB += source[neighborIndex + 2];
            sumA += alpha;
            sampleCount += 1;
          }
          if (sampleCount <= 0) {
            continue;
          }
          data[index] = Math.round(sumR / sampleCount);
          data[index + 1] = Math.round(sumG / sampleCount);
          data[index + 2] = Math.round(sumB / sampleCount);
          data[index + 3] = Math.round(sumA / sampleCount);
        }
      }
    }
    context.putImageData(imageData, 0, 0);
  }

  private drawSpriteWithHotspot(
    context: CanvasRenderingContext2D,
    size: number,
    image: HTMLImageElement,
    hsX: number,
    hsY: number,
    forBillboard: boolean,
  ): void {
    const hotspotX = -hsX;
    const hotspotY = -hsY;
    const sourceWidth = Math.max(1, image.width);
    const sourceHeight = Math.max(1, image.height);
    const scale = forBillboard
      ? Math.max(0.001, size / Math.max(1, this.nominalTileSize))
      : Math.max(0.001, Math.min(size / sourceWidth, size / sourceHeight));
    const targetHotspotX = size * 0.5;
    const targetHotspotY = forBillboard ? size * 0.9 : size * 0.5;
    const drawX = targetHotspotX - hotspotX * scale;
    const drawY = targetHotspotY - hotspotY * scale;
    context.imageSmoothingEnabled = false;
    context.drawImage(
      image,
      drawX,
      drawY,
      sourceWidth * scale,
      sourceHeight * scale,
    );
  }
}
