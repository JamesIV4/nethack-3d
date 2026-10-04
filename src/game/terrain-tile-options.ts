import type { Nh3dClientOptions } from "./ui-types";
import type { TileMaterialKind } from "./glyphs/types";

type TerrainTileOptions = Pick<Nh3dClientOptions,
  "tilesetMode" | "asciiTilesForWalls" | "asciiTilesForFloors">;

export function usesWallTiles(options: TerrainTileOptions): boolean {
  return options.tilesetMode === "tiles" ||
    (options.tilesetMode === "ascii" && options.asciiTilesForWalls === true);
}

export function usesFloorTiles(options: TerrainTileOptions): boolean {
  return options.tilesetMode === "tiles" ||
    (options.tilesetMode === "ascii" && options.asciiTilesForFloors === true);
}

export function usesTileTextures(options: TerrainTileOptions): boolean {
  return usesWallTiles(options) || usesFloorTiles(options);
}

/** Only terrain surfaces opt into tiles; features, items and actors stay ASCII. */
export function usesTerrainTiles(
  options: TerrainTileOptions,
  isWall: boolean,
  materialKind: TileMaterialKind | null,
): boolean {
  if (options.tilesetMode === "tiles") return true;
  if (isWall) return usesWallTiles(options);
  return usesFloorTiles(options) &&
    (materialKind === "floor" || materialKind === "dark" || materialKind === "water");
}
