import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  defaultNh3dClientOptions
} from "../../../game/ui-types";
import type * as React from "react";
import type {
  TileAtlasState
} from "../tilesets/atlas";
import {
  normalizeSolidChromaKeyHex
} from "../tilesets/TilesetSolidColorPickerDialog";

export interface UseDarkWallDraftDependencies {
  readonly setClientOptionsDraft: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  readonly tileAtlasState: TileAtlasState;
}

/** Updates per-tileset dark-wall tiles, colors and grid settings. */
export function useDarkWallDraft(dependencies: UseDarkWallDraftDependencies) {
  const {
    setClientOptionsDraft,
    tileAtlasState,
  } = dependencies;

  const updateDarkWallTileOverrideEnabledDraft = (
    enabled: boolean,
    rawTilesetPath?: string,
  ): void => {
    setClientOptionsDraft((previous) => {
      const selectedTilesetPath = String(previous.tilesetPath || "").trim();
      const tilesetPath = String(rawTilesetPath || selectedTilesetPath).trim();
      const nextTileByTileset = {
        ...previous.darkCorridorWallTileOverrideEnabledByTileset,
      };
      const nextSolidByTileset = {
        ...previous.darkCorridorWallSolidColorOverrideEnabledByTileset,
      };
      if (tilesetPath) {
        nextTileByTileset[tilesetPath] = enabled;
        if (enabled) {
          nextSolidByTileset[tilesetPath] = false;
        }
      }
      const appliesToSelected =
        Boolean(tilesetPath) && tilesetPath === selectedTilesetPath;
      return {
        ...previous,
        darkCorridorWallTileOverrideEnabled: appliesToSelected
          ? enabled
          : previous.darkCorridorWallTileOverrideEnabled,
        darkCorridorWallTileOverrideEnabledByTileset: nextTileByTileset,
        darkCorridorWallSolidColorOverrideEnabled: appliesToSelected
          ? enabled
            ? false
            : previous.darkCorridorWallSolidColorOverrideEnabled
          : previous.darkCorridorWallSolidColorOverrideEnabled,
        darkCorridorWallSolidColorOverrideEnabledByTileset: nextSolidByTileset,
      };
    });
  };

  const updateDarkWallTileOverrideTileIdDraft = (rawTileId: number): void => {
    const maxTileId =
      tileAtlasState.tileCount > 0 ? tileAtlasState.tileCount - 1 : Infinity;
    const nextTileId = Math.max(0, Math.min(maxTileId, Math.trunc(rawTileId)));
    setClientOptionsDraft((previous) => {
      const tilesetPath = String(previous.tilesetPath || "").trim();
      const nextByTileset = {
        ...previous.darkCorridorWallTileOverrideTileIdByTileset,
      };
      if (tilesetPath) {
        nextByTileset[tilesetPath] = nextTileId;
      }
      return {
        ...previous,
        darkCorridorWallTileOverrideTileId: nextTileId,
        darkCorridorWallTileOverrideTileIdByTileset: nextByTileset,
      };
    });
  };

  const updateDarkWallSolidColorOverrideEnabledDraft = (
    enabled: boolean,
    rawTilesetPath?: string,
  ): void => {
    setClientOptionsDraft((previous) => {
      const selectedTilesetPath = String(previous.tilesetPath || "").trim();
      const tilesetPath = String(rawTilesetPath || selectedTilesetPath).trim();
      const nextSolidByTileset = {
        ...previous.darkCorridorWallSolidColorOverrideEnabledByTileset,
      };
      const nextTileByTileset = {
        ...previous.darkCorridorWallTileOverrideEnabledByTileset,
      };
      if (tilesetPath) {
        nextSolidByTileset[tilesetPath] = enabled;
        if (enabled) {
          nextTileByTileset[tilesetPath] = false;
        }
      }
      const appliesToSelected =
        Boolean(tilesetPath) && tilesetPath === selectedTilesetPath;
      return {
        ...previous,
        darkCorridorWallSolidColorOverrideEnabled: appliesToSelected
          ? enabled
          : previous.darkCorridorWallSolidColorOverrideEnabled,
        darkCorridorWallSolidColorOverrideEnabledByTileset: nextSolidByTileset,
        darkCorridorWallTileOverrideEnabled: appliesToSelected
          ? enabled
            ? false
            : previous.darkCorridorWallTileOverrideEnabled
          : previous.darkCorridorWallTileOverrideEnabled,
        darkCorridorWallTileOverrideEnabledByTileset: nextTileByTileset,
      };
    });
  };

  const updateDarkWallSolidColorHexDraft = (
    rawHex: string,
    rawTilesetPath?: string,
  ): void => {
    const normalizedHex = normalizeSolidChromaKeyHex(rawHex);
    setClientOptionsDraft((previous) => {
      const selectedTilesetPath = String(previous.tilesetPath || "").trim();
      const tilesetPath = String(rawTilesetPath || selectedTilesetPath).trim();
      const nextByTileset = {
        ...previous.darkCorridorWallSolidColorHexByTileset,
      };
      if (tilesetPath) {
        nextByTileset[tilesetPath] = normalizedHex;
      }
      return {
        ...previous,
        darkCorridorWallSolidColorHex:
          tilesetPath && tilesetPath === selectedTilesetPath
            ? normalizedHex
            : previous.darkCorridorWallSolidColorHex,
        darkCorridorWallSolidColorHexByTileset: nextByTileset,
      };
    });
  };

  const updateDarkWallSolidColorHexFpsDraft = (
    rawHex: string,
    rawTilesetPath?: string,
  ): void => {
    const normalizedHex = normalizeSolidChromaKeyHex(rawHex);
    setClientOptionsDraft((previous) => {
      const selectedTilesetPath = String(previous.tilesetPath || "").trim();
      const tilesetPath = String(rawTilesetPath || selectedTilesetPath).trim();
      const nextByTileset = {
        ...previous.darkCorridorWallSolidColorHexFpsByTileset,
      };
      if (tilesetPath) {
        nextByTileset[tilesetPath] = normalizedHex;
      }
      return {
        ...previous,
        darkCorridorWallSolidColorHexFps:
          tilesetPath && tilesetPath === selectedTilesetPath
            ? normalizedHex
            : previous.darkCorridorWallSolidColorHexFps,
        darkCorridorWallSolidColorHexFpsByTileset: nextByTileset,
      };
    });
  };

  const updateDarkWallSolidColorGridEnabledDraft = (
    enabled: boolean,
    rawTilesetPath?: string,
  ): void => {
    setClientOptionsDraft((previous) => {
      const selectedTilesetPath = String(previous.tilesetPath || "").trim();
      const tilesetPath = String(rawTilesetPath || selectedTilesetPath).trim();
      const nextByTileset = {
        ...previous.darkCorridorWallSolidColorGridEnabledByTileset,
      };
      if (tilesetPath) {
        nextByTileset[tilesetPath] = enabled;
      }
      const appliesToSelected =
        Boolean(tilesetPath) && tilesetPath === selectedTilesetPath;
      return {
        ...previous,
        darkCorridorWallSolidColorGridEnabled: appliesToSelected
          ? enabled
          : previous.darkCorridorWallSolidColorGridEnabled,
        darkCorridorWallSolidColorGridEnabledByTileset: nextByTileset,
      };
    });
  };

  const updateDarkWallSolidColorGridDarknessPercentDraft = (
    rawPercent: number,
    rawTilesetPath?: string,
  ): void => {
    const parsed =
      typeof rawPercent === "number" && Number.isFinite(rawPercent)
        ? rawPercent
        : defaultNh3dClientOptions.darkCorridorWallSolidColorGridDarknessPercent;
    const percent = Math.max(0, Math.min(100, Math.round(parsed)));
    setClientOptionsDraft((previous) => {
      const selectedTilesetPath = String(previous.tilesetPath || "").trim();
      const tilesetPath = String(rawTilesetPath || selectedTilesetPath).trim();
      const nextByTileset = {
        ...previous.darkCorridorWallSolidColorGridDarknessPercentByTileset,
      };
      if (tilesetPath) {
        nextByTileset[tilesetPath] = percent;
      }
      const appliesToSelected =
        Boolean(tilesetPath) && tilesetPath === selectedTilesetPath;
      return {
        ...previous,
        darkCorridorWallSolidColorGridDarknessPercent: appliesToSelected
          ? percent
          : previous.darkCorridorWallSolidColorGridDarknessPercent,
        darkCorridorWallSolidColorGridDarknessPercentByTileset: nextByTileset,
      };
    });
  };
  return {
    updateDarkWallTileOverrideEnabledDraft,
    updateDarkWallTileOverrideTileIdDraft,
    updateDarkWallSolidColorOverrideEnabledDraft,
    updateDarkWallSolidColorHexDraft,
    updateDarkWallSolidColorHexFpsDraft,
    updateDarkWallSolidColorGridEnabledDraft,
    updateDarkWallSolidColorGridDarknessPercentDraft,
  } as const;
}
