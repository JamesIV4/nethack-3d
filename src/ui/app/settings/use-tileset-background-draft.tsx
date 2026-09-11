import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  isNh3dTilesetCombinedBackgroundRemovalForced,
  isNh3dTilesetBackgroundRemovalModeForcedOff
} from "../../../game/tilesets";
import type * as React from "react";
import type {
  TilesetBackgroundRemovalMode
} from "./types";
import {
  normalizeSolidChromaKeyHex
} from "../tilesets/TilesetSolidColorPickerDialog";

export interface UseTilesetBackgroundDraftDependencies {
  readonly setClientOptionsDraft: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
}

/** Updates per-tileset background removal, chroma colors and weapon orientation. */
export function useTilesetBackgroundDraft(dependencies: UseTilesetBackgroundDraftDependencies) {
  const {
    setClientOptionsDraft,
  } = dependencies;

  const updateTilesetBackgroundTileIdDraft = (
    rawTileId: number,
    rawTilesetPath?: string,
    tileCountHint?: number,
  ): void => {
    const maxTileId =
      Number.isFinite(tileCountHint) && Number(tileCountHint) > 0
        ? Number(tileCountHint) - 1
        : Infinity;
    const nextTileId = Math.max(0, Math.min(maxTileId, Math.trunc(rawTileId)));
    setClientOptionsDraft((previous) => {
      const selectedTilesetPath = String(previous.tilesetPath || "").trim();
      const tilesetPath = String(rawTilesetPath || selectedTilesetPath).trim();
      if (isNh3dTilesetCombinedBackgroundRemovalForced(tilesetPath)) {
        return previous;
      }
      const nextByTileset = {
        ...previous.tilesetBackgroundTileIdByTileset,
      };
      if (tilesetPath) {
        nextByTileset[tilesetPath] = nextTileId;
      }
      return {
        ...previous,
        tilesetBackgroundTileId:
          tilesetPath && tilesetPath === selectedTilesetPath
            ? nextTileId
            : previous.tilesetBackgroundTileId,
        tilesetBackgroundTileIdByTileset: nextByTileset,
      };
    });
  };

  const updateTilesetBackgroundRemovalModeDraft = (
    mode: TilesetBackgroundRemovalMode,
    rawTilesetPath?: string,
  ): void => {
    const resolvedMode: TilesetBackgroundRemovalMode =
      mode === "solid" ? "solid" : mode === "none" ? "none" : "tile";
    setClientOptionsDraft((previous) => {
      const selectedTilesetPath = String(previous.tilesetPath || "").trim();
      const tilesetPath = String(rawTilesetPath || selectedTilesetPath).trim();
      if (
        isNh3dTilesetBackgroundRemovalModeForcedOff(tilesetPath) ||
        isNh3dTilesetCombinedBackgroundRemovalForced(tilesetPath)
      ) {
        return previous;
      }
      const nextByTileset = {
        ...previous.tilesetBackgroundRemovalModeByTileset,
      };
      if (tilesetPath) {
        nextByTileset[tilesetPath] = resolvedMode;
      }
      return {
        ...previous,
        tilesetBackgroundRemovalMode:
          tilesetPath && tilesetPath === selectedTilesetPath
            ? resolvedMode
            : previous.tilesetBackgroundRemovalMode,
        tilesetBackgroundRemovalModeByTileset: nextByTileset,
      };
    });
  };

  const updateTilesetSolidChromaKeyColorHexDraft = (
    rawHex: string,
    rawTilesetPath?: string,
  ): void => {
    const normalizedHex = normalizeSolidChromaKeyHex(rawHex);
    setClientOptionsDraft((previous) => {
      const selectedTilesetPath = String(previous.tilesetPath || "").trim();
      const tilesetPath = String(rawTilesetPath || selectedTilesetPath).trim();
      if (isNh3dTilesetCombinedBackgroundRemovalForced(tilesetPath)) {
        return previous;
      }
      const nextByTileset = {
        ...previous.tilesetSolidChromaKeyColorHexByTileset,
      };
      if (tilesetPath) {
        nextByTileset[tilesetPath] = normalizedHex;
      }
      return {
        ...previous,
        tilesetSolidChromaKeyColorHex:
          tilesetPath && tilesetPath === selectedTilesetPath
            ? normalizedHex
            : previous.tilesetSolidChromaKeyColorHex,
        tilesetSolidChromaKeyColorHexByTileset: nextByTileset,
      };
    });
  };

  const updateTilesetWeaponSpriteFlipXDraft = (
    enabled: boolean,
    rawTilesetPath?: string,
  ): void => {
    setClientOptionsDraft((previous) => {
      const selectedTilesetPath = String(previous.tilesetPath || "").trim();
      const tilesetPath = String(rawTilesetPath || selectedTilesetPath).trim();
      const nextByTileset = {
        ...previous.fpsHeldWeaponSpriteFlipXByTileset,
      };
      if (tilesetPath) {
        nextByTileset[tilesetPath] = enabled;
      }
      return {
        ...previous,
        fpsHeldWeaponSpriteFlipX:
          tilesetPath && tilesetPath === selectedTilesetPath
            ? enabled
            : previous.fpsHeldWeaponSpriteFlipX,
        fpsHeldWeaponSpriteFlipXByTileset: nextByTileset,
      };
    });
  };
  return {
    updateTilesetBackgroundTileIdDraft,
    updateTilesetBackgroundRemovalModeDraft,
    updateTilesetSolidChromaKeyColorHexDraft,
    updateTilesetWeaponSpriteFlipXDraft,
  } as const;
}
