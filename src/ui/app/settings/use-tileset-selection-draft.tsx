import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  resolveDefaultNh3dTilesetBackgroundTileId,
  resolveDefaultNh3dTilesetBackgroundRemovalMode,
  resolveDefaultNh3dTilesetSolidChromaKeyColorHex,
  resolveDefaultNh3dTilesetWeaponSpriteFlipX
} from "../../../game/tilesets";
import type * as React from "react";
import type {
  TileAtlasState
} from "../tilesets/atlas";
import {
  createDefaultTileAtlasState
} from "../tilesets/atlas";
import {
  normalizeSolidChromaKeyHex
} from "../tilesets/TilesetSolidColorPickerDialog";
import type {
  TilesetBackgroundRemovalMode
} from "./types";

export interface UseTilesetSelectionDraftDependencies {
  readonly clientOptionsDraft: Nh3dClientOptions;
  readonly setTileAtlasState: React.Dispatch<React.SetStateAction<TileAtlasState>>;
  readonly setTileAtlasImage: React.Dispatch<React.SetStateAction<HTMLImageElement | null>>;
  readonly setClientOptionsDraft: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  readonly defaultDarkWallTileId: number;
  readonly defaultDarkWallSolidColorHex: string;
  readonly defaultDarkWallSolidColorHexFps: string;
}

/** Switches the draft tileset and restores its saved display settings. */
export function useTilesetSelectionDraft(dependencies: UseTilesetSelectionDraftDependencies) {
  const {
    clientOptionsDraft,
    setTileAtlasState,
    setTileAtlasImage,
    setClientOptionsDraft,
    defaultDarkWallTileId,
    defaultDarkWallSolidColorHex,
    defaultDarkWallSolidColorHexFps,
  } = dependencies;

  const updateTilesetPathDraft = (rawTilesetPath: string): void => {
    const tilesetPath = String(rawTilesetPath || "").trim();
    const currentTilesetPath = String(
      clientOptionsDraft.tilesetPath || "",
    ).trim();
    if (tilesetPath !== currentTilesetPath) {
      setTileAtlasState(createDefaultTileAtlasState());
      setTileAtlasImage(null);
    }
    setClientOptionsDraft((previous) => {
      const mappedDarkWallTileOverrideEnabled = tilesetPath
        ? previous.darkCorridorWallTileOverrideEnabledByTileset[tilesetPath]
        : undefined;
      const mappedDarkWallTileId = tilesetPath
        ? previous.darkCorridorWallTileOverrideTileIdByTileset[tilesetPath]
        : undefined;
      const mappedDarkWallSolidColorOverrideEnabled = tilesetPath
        ? previous.darkCorridorWallSolidColorOverrideEnabledByTileset[
        tilesetPath
        ]
        : undefined;
      const mappedDarkWallSolidColorHex = tilesetPath
        ? previous.darkCorridorWallSolidColorHexByTileset[tilesetPath]
        : undefined;
      const mappedDarkWallSolidColorHexFps = tilesetPath
        ? previous.darkCorridorWallSolidColorHexFpsByTileset[tilesetPath]
        : undefined;
      const mappedDarkWallSolidColorGridEnabled = tilesetPath
        ? previous.darkCorridorWallSolidColorGridEnabledByTileset[tilesetPath]
        : undefined;
      const mappedDarkWallSolidColorGridDarknessPercent = tilesetPath
        ? previous.darkCorridorWallSolidColorGridDarknessPercentByTileset[
        tilesetPath
        ]
        : undefined;
      const mappedBackgroundTileId = tilesetPath
        ? previous.tilesetBackgroundTileIdByTileset[tilesetPath]
        : undefined;
      const mappedBackgroundRemovalMode = tilesetPath
        ? previous.tilesetBackgroundRemovalModeByTileset[tilesetPath]
        : undefined;
      const mappedSolidColorHex = tilesetPath
        ? previous.tilesetSolidChromaKeyColorHexByTileset[tilesetPath]
        : undefined;
      const mappedWeaponSpriteFlipX = tilesetPath
        ? previous.fpsHeldWeaponSpriteFlipXByTileset[tilesetPath]
        : undefined;
      const nextDarkWallTileId =
        typeof mappedDarkWallTileId === "number" &&
          Number.isFinite(mappedDarkWallTileId)
          ? Math.max(0, Math.trunc(mappedDarkWallTileId))
          : defaultDarkWallTileId;
      const nextDarkWallTileOverrideEnabled =
        typeof mappedDarkWallTileOverrideEnabled === "boolean"
          ? mappedDarkWallTileOverrideEnabled
          : Boolean(previous.darkCorridorWallTileOverrideEnabled);
      let nextDarkWallSolidColorOverrideEnabled =
        typeof mappedDarkWallSolidColorOverrideEnabled === "boolean"
          ? mappedDarkWallSolidColorOverrideEnabled
          : Boolean(previous.darkCorridorWallSolidColorOverrideEnabled);
      if (
        nextDarkWallTileOverrideEnabled &&
        nextDarkWallSolidColorOverrideEnabled
      ) {
        nextDarkWallSolidColorOverrideEnabled = false;
      }
      const nextDarkWallSolidColorHex = normalizeSolidChromaKeyHex(
        typeof mappedDarkWallSolidColorHex === "string"
          ? mappedDarkWallSolidColorHex
          : defaultDarkWallSolidColorHex,
      );
      const nextDarkWallSolidColorHexFps = normalizeSolidChromaKeyHex(
        typeof mappedDarkWallSolidColorHexFps === "string"
          ? mappedDarkWallSolidColorHexFps
          : defaultDarkWallSolidColorHexFps,
      );
      const nextDarkWallSolidColorGridEnabled =
        typeof mappedDarkWallSolidColorGridEnabled === "boolean"
          ? mappedDarkWallSolidColorGridEnabled
          : Boolean(previous.darkCorridorWallSolidColorGridEnabled);
      const nextDarkWallSolidColorGridDarknessPercent = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            typeof mappedDarkWallSolidColorGridDarknessPercent === "number" &&
              Number.isFinite(mappedDarkWallSolidColorGridDarknessPercent)
              ? mappedDarkWallSolidColorGridDarknessPercent
              : previous.darkCorridorWallSolidColorGridDarknessPercent,
          ),
        ),
      );
      const nextBackgroundTileId =
        typeof mappedBackgroundTileId === "number" &&
          Number.isFinite(mappedBackgroundTileId)
          ? Math.max(0, Math.trunc(mappedBackgroundTileId))
          : resolveDefaultNh3dTilesetBackgroundTileId(tilesetPath);
      const nextBackgroundRemovalMode: TilesetBackgroundRemovalMode =
        mappedBackgroundRemovalMode === "solid"
          ? "solid"
          : mappedBackgroundRemovalMode === "none"
            ? "none"
            : resolveDefaultNh3dTilesetBackgroundRemovalMode(tilesetPath);
      const nextSolidColorHex = normalizeSolidChromaKeyHex(
        typeof mappedSolidColorHex === "string"
          ? mappedSolidColorHex
          : resolveDefaultNh3dTilesetSolidChromaKeyColorHex(tilesetPath),
      );
      const nextWeaponSpriteFlipX =
        typeof mappedWeaponSpriteFlipX === "boolean"
          ? mappedWeaponSpriteFlipX
          : resolveDefaultNh3dTilesetWeaponSpriteFlipX(tilesetPath);
      return {
        ...previous,
        tilesetPath,
        darkCorridorWallTileOverrideEnabled: nextDarkWallTileOverrideEnabled,
        darkCorridorWallTileOverrideTileId: nextDarkWallTileId,
        darkCorridorWallSolidColorOverrideEnabled:
          nextDarkWallSolidColorOverrideEnabled,
        darkCorridorWallSolidColorHex: nextDarkWallSolidColorHex,
        darkCorridorWallSolidColorHexFps: nextDarkWallSolidColorHexFps,
        darkCorridorWallSolidColorGridEnabled:
          nextDarkWallSolidColorGridEnabled,
        darkCorridorWallSolidColorGridDarknessPercent:
          nextDarkWallSolidColorGridDarknessPercent,
        tilesetBackgroundTileId: nextBackgroundTileId,
        tilesetBackgroundRemovalMode: nextBackgroundRemovalMode,
        tilesetSolidChromaKeyColorHex: nextSolidColorHex,
        fpsHeldWeaponSpriteFlipX: nextWeaponSpriteFlipX,
      };
    });
  };
  return {
    updateTilesetPathDraft,
  } as const;
}
