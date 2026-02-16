export type GlyphKind =
  | "mon"
  | "pet"
  | "invis"
  | "detect"
  | "body"
  | "ridden"
  | "obj"
  | "cmap"
  | "explode"
  | "zap"
  | "swallow"
  | "warning"
  | "statue";

export interface GlyphCatalogEntry {
  glyph: number;
  kind: GlyphKind;
  ch: number;
  color: number;
  special: number;
}

export interface GlyphCatalogRange {
  key: string;
  kind: GlyphKind;
  start: number;
  endExclusive: number;
}

export interface GlyphCatalogMeta {
  sourceJsPath: string;
  sourceWasmPath: string;
  sourceJsSha256: string;
  sourceWasmSha256: string;
  maxGlyph: number;
  noGlyph: number;
}

export interface ResolvedGlyph {
  glyph: number;
  kind: GlyphKind | "unknown";
  char: string | null;
  color: number | null;
  special: number | null;
  isKnown: boolean;
}

export type TileMaterialKind =
  | "floor"
  | "stairs_up"
  | "stairs_down"
  | "wall"
  | "dark_wall"
  | "door"
  | "dark"
  | "water"
  | "trap"
  | "feature"
  | "fountain"
  | "player"
  | "monster_hostile"
  | "monster_friendly"
  | "monster_neutral"
  | "item"
  | "effect_warning"
  | "effect_zap"
  | "effect_explode"
  | "effect_swallow"
  | "default";

export type TileGeometryKind = "floor" | "wall";

export type GlyphDisposition = "friendly" | "hostile" | "neutral" | "unknown";

export type TileEffectKind = "warning" | "zap" | "explode" | "swallow";

export interface GlyphRenderOverride {
  materialKind?: TileMaterialKind;
  geometryKind?: TileGeometryKind;
  isWall?: boolean;
  glyphChar?: string;
  textColor?: string;
  darkenFactor?: number;
  disposition?: GlyphDisposition;
  effectKind?: TileEffectKind | null;
}

export interface TileBehaviorResult {
  resolved: ResolvedGlyph;
  effective: ResolvedGlyph;
  materialKind: TileMaterialKind;
  geometryKind: TileGeometryKind;
  isWall: boolean;
  isPlayerGlyph: boolean;
  isDarkOverlay: boolean;
  darkenFactor: number;
  glyphChar: string;
  textColor: string;
  disposition: GlyphDisposition;
  effectKind: TileEffectKind | null;
}
