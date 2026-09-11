import {
  useEffect,
  useMemo,
  useState
} from "react";
import type {
  CharacterCreationConfig,
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  defaultNh3dClientOptions
} from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  findNh3dTilesetByPath,
  isNh3dTilesetCombinedBackgroundRemovalForced,
  isNh3dTilesetBackgroundRemovalModeForcedOff,
  resolveDefaultNh3dTilesetBackgroundTileId,
  resolveDefaultNh3dTilesetBackgroundRemovalMode,
  resolveDefaultNh3dTilesetSolidChromaKeyColorHex,
  resolveDefaultNh3dTilesetWeaponSpriteFlipX,
  type Nh3dTilesetEntry
} from "../../../game/tilesets";
import {
  type StoredUserTilesetRecord
} from "../../../game/user-tileset-storage";
import {
  getGlyphCatalogEntriesForVersion
} from "../../../game/glyphs/registry";
import type {
  GlyphCatalogEntry
} from "../../../game/glyphs/types";
import {
  buildRepresentativeGlyphByTileId,
  buildRepresentativeGlyphNumberByTileId,
  emptyGlyphCatalogEntries,
  formatTileGlyphLabel
} from "./atlas";
import {
  normalizeSolidChromaKeyHex
} from "./TilesetSolidColorPickerDialog";
import type {
  TilesetBackgroundRemovalMode
} from "../settings/types";

export interface UseTilePreviewModelDependencies {
  readonly activeRuntimeVersion: NethackRuntimeVersion;
  readonly clientOptionsDraft: Nh3dClientOptions;
  readonly tilesetManagerEditPath: string;
  readonly tilesetCatalog: readonly Nh3dTilesetEntry[];
  readonly userTilesetRecordByPath: Map<string, StoredUserTilesetRecord>;
  readonly tilesetManagerMode: "edit" | "new";
  readonly characterCreationConfig: CharacterCreationConfig | null;
}

/** Resolves glyph labels, selected tilesets and per-tileset preview settings. */
export function useTilePreviewModel(dependencies: UseTilePreviewModelDependencies) {
  const {
    activeRuntimeVersion,
    clientOptionsDraft,
    tilesetManagerEditPath,
    tilesetCatalog,
    userTilesetRecordByPath,
    tilesetManagerMode,
    characterCreationConfig,
  } = dependencies;

  const [tilesetPickerGlyphCatalog, setTilesetPickerGlyphCatalog] = useState<
    readonly GlyphCatalogEntry[]
  >(emptyGlyphCatalogEntries);

  useEffect(() => {
    let cancelled = false;
    void getGlyphCatalogEntriesForVersion(activeRuntimeVersion)
      .then((glyphCatalog) => {
        if (!cancelled) {
          setTilesetPickerGlyphCatalog(glyphCatalog);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTilesetPickerGlyphCatalog(emptyGlyphCatalogEntries);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeRuntimeVersion]);

  const representativeGlyphByTileId = useMemo(
    () => buildRepresentativeGlyphByTileId(tilesetPickerGlyphCatalog),
    [tilesetPickerGlyphCatalog],
  );

  const representativeGlyphNumberByTileId = useMemo(
    () => buildRepresentativeGlyphNumberByTileId(tilesetPickerGlyphCatalog),
    [tilesetPickerGlyphCatalog],
  );

  const showTilePickerGlyphNumber = import.meta.env.DEV;

  const defaultDarkWallTileId = Math.max(
    0,
    Math.trunc(defaultNh3dClientOptions.darkCorridorWallTileOverrideTileId),
  );

  const defaultDarkWallSolidColorHex = normalizeSolidChromaKeyHex(
    defaultNh3dClientOptions.darkCorridorWallSolidColorHex,
  );

  const defaultDarkWallSolidColorHexFps = normalizeSolidChromaKeyHex(
    defaultNh3dClientOptions.darkCorridorWallSolidColorHexFps,
  );

  const selectedDarkWallTileId = useMemo(() => {
    const tilesetPath = String(clientOptionsDraft.tilesetPath || "").trim();
    const mappedTileId = tilesetPath
      ? clientOptionsDraft.darkCorridorWallTileOverrideTileIdByTileset[
      tilesetPath
      ]
      : undefined;
    if (typeof mappedTileId === "number" && Number.isFinite(mappedTileId)) {
      return Math.max(0, Math.trunc(mappedTileId));
    }
    return defaultDarkWallTileId;
  }, [
    clientOptionsDraft.darkCorridorWallTileOverrideTileIdByTileset,
    clientOptionsDraft.tilesetPath,
    defaultDarkWallTileId,
  ]);

  const selectedDarkWallSolidColorHex = useMemo(() => {
    const tilesetPath = String(clientOptionsDraft.tilesetPath || "").trim();
    const mappedColorHex = tilesetPath
      ? clientOptionsDraft.darkCorridorWallSolidColorHexByTileset[tilesetPath]
      : undefined;
    if (typeof mappedColorHex === "string") {
      return normalizeSolidChromaKeyHex(mappedColorHex);
    }
    return defaultDarkWallSolidColorHex;
  }, [
    clientOptionsDraft.darkCorridorWallSolidColorHexByTileset,
    clientOptionsDraft.tilesetPath,
    defaultDarkWallSolidColorHex,
  ]);

  const selectedDarkWallSolidColorHexFps = useMemo(() => {
    const tilesetPath = String(clientOptionsDraft.tilesetPath || "").trim();
    const mappedColorHex = tilesetPath
      ? clientOptionsDraft.darkCorridorWallSolidColorHexFpsByTileset[
      tilesetPath
      ]
      : undefined;
    if (typeof mappedColorHex === "string") {
      return normalizeSolidChromaKeyHex(mappedColorHex);
    }
    return defaultDarkWallSolidColorHexFps;
  }, [
    clientOptionsDraft.darkCorridorWallSolidColorHexFpsByTileset,
    clientOptionsDraft.tilesetPath,
    defaultDarkWallSolidColorHexFps,
  ]);

  const selectedDarkWallSolidColorGridEnabled = useMemo(() => {
    const tilesetPath = String(clientOptionsDraft.tilesetPath || "").trim();
    const mappedEnabled = tilesetPath
      ? clientOptionsDraft.darkCorridorWallSolidColorGridEnabledByTileset[
      tilesetPath
      ]
      : undefined;
    if (typeof mappedEnabled === "boolean") {
      return mappedEnabled;
    }
    return Boolean(clientOptionsDraft.darkCorridorWallSolidColorGridEnabled);
  }, [
    clientOptionsDraft.darkCorridorWallSolidColorGridEnabled,
    clientOptionsDraft.darkCorridorWallSolidColorGridEnabledByTileset,
    clientOptionsDraft.tilesetPath,
  ]);

  const selectedDarkWallSolidColorGridDarknessPercent = useMemo(() => {
    const tilesetPath = String(clientOptionsDraft.tilesetPath || "").trim();
    const mappedPercent = tilesetPath
      ? clientOptionsDraft
        .darkCorridorWallSolidColorGridDarknessPercentByTileset[tilesetPath]
      : undefined;
    const fallback =
      clientOptionsDraft.darkCorridorWallSolidColorGridDarknessPercent;
    const source =
      typeof mappedPercent === "number" && Number.isFinite(mappedPercent)
        ? mappedPercent
        : fallback;
    return Math.max(0, Math.min(100, Math.round(source)));
  }, [
    clientOptionsDraft.darkCorridorWallSolidColorGridDarknessPercent,
    clientOptionsDraft.darkCorridorWallSolidColorGridDarknessPercentByTileset,
    clientOptionsDraft.tilesetPath,
  ]);

  const selectedDarkWallGlyphChar =
    representativeGlyphByTileId.get(selectedDarkWallTileId) ?? " ";

  const selectedDarkWallGlyphLabel = formatTileGlyphLabel(
    selectedDarkWallGlyphChar,
  );

  const selectedDarkWallGlyphNumber =
    representativeGlyphNumberByTileId.get(selectedDarkWallTileId) ?? null;

  const resolveDraftBackgroundTileIdByTilesetPath = (
    rawTilesetPath: string | null | undefined,
  ): number => {
    const tilesetPath = String(rawTilesetPath || "").trim();
    if (isNh3dTilesetCombinedBackgroundRemovalForced(tilesetPath)) {
      return resolveDefaultNh3dTilesetBackgroundTileId(tilesetPath);
    }
    const mappedTileId = tilesetPath
      ? clientOptionsDraft.tilesetBackgroundTileIdByTileset[tilesetPath]
      : undefined;
    if (typeof mappedTileId === "number" && Number.isFinite(mappedTileId)) {
      return Math.max(0, Math.trunc(mappedTileId));
    }
    return resolveDefaultNh3dTilesetBackgroundTileId(tilesetPath);
  };

  const resolveDraftBackgroundRemovalModeByTilesetPath = (
    rawTilesetPath: string | null | undefined,
  ): TilesetBackgroundRemovalMode => {
    const tilesetPath = String(rawTilesetPath || "").trim();
    if (isNh3dTilesetCombinedBackgroundRemovalForced(tilesetPath)) {
      return "tile";
    }
    if (isNh3dTilesetBackgroundRemovalModeForcedOff(tilesetPath)) {
      return "none";
    }
    const mappedMode = tilesetPath
      ? clientOptionsDraft.tilesetBackgroundRemovalModeByTileset[tilesetPath]
      : undefined;
    if (
      mappedMode === "none" ||
      mappedMode === "solid" ||
      mappedMode === "tile"
    ) {
      return mappedMode;
    }
    return resolveDefaultNh3dTilesetBackgroundRemovalMode(tilesetPath);
  };

  const resolveDraftSolidChromaKeyByTilesetPath = (
    rawTilesetPath: string | null | undefined,
  ): string => {
    const tilesetPath = String(rawTilesetPath || "").trim();
    if (isNh3dTilesetCombinedBackgroundRemovalForced(tilesetPath)) {
      return normalizeSolidChromaKeyHex(
        resolveDefaultNh3dTilesetSolidChromaKeyColorHex(tilesetPath),
      );
    }
    const mappedColorHex = tilesetPath
      ? clientOptionsDraft.tilesetSolidChromaKeyColorHexByTileset[tilesetPath]
      : undefined;
    if (typeof mappedColorHex === "string") {
      return normalizeSolidChromaKeyHex(mappedColorHex);
    }
    return normalizeSolidChromaKeyHex(
      resolveDefaultNh3dTilesetSolidChromaKeyColorHex(tilesetPath),
    );
  };

  const resolveDraftWeaponSpriteFlipXByTilesetPath = (
    rawTilesetPath: string | null | undefined,
  ): boolean => {
    const tilesetPath = String(rawTilesetPath || "").trim();
    const mappedEnabled = tilesetPath
      ? clientOptionsDraft.fpsHeldWeaponSpriteFlipXByTileset[tilesetPath]
      : undefined;
    if (typeof mappedEnabled === "boolean") {
      return mappedEnabled;
    }
    return resolveDefaultNh3dTilesetWeaponSpriteFlipX(tilesetPath);
  };

  const selectedTilesetManagerEditPath = String(
    tilesetManagerEditPath || "",
  ).trim();

  const selectedTilesetManagerEditEntry = useMemo(
    () => findNh3dTilesetByPath(selectedTilesetManagerEditPath),
    [selectedTilesetManagerEditPath, tilesetCatalog],
  );

  const selectedTilesetManagerEditUserRecord = useMemo(
    () => userTilesetRecordByPath.get(selectedTilesetManagerEditPath) ?? null,
    [selectedTilesetManagerEditPath, userTilesetRecordByPath],
  );

  const tilesetManagerInNewMode = tilesetManagerMode === "new";

  const tilesetManagerNameInputDisabled =
    !tilesetManagerInNewMode && !selectedTilesetManagerEditUserRecord;

  const tilesetManagerDefaultBackgroundTileId = useMemo(
    () =>
      resolveDefaultNh3dTilesetBackgroundTileId(selectedTilesetManagerEditPath),
    [selectedTilesetManagerEditPath, tilesetCatalog],
  );

  const tilesetManagerBackgroundTileId = useMemo(
    () =>
      resolveDraftBackgroundTileIdByTilesetPath(selectedTilesetManagerEditPath),
    [
      clientOptionsDraft.tilesetBackgroundTileIdByTileset,
      selectedTilesetManagerEditPath,
      tilesetCatalog,
    ],
  );

  const tilesetManagerBackgroundRemovalMode =
    useMemo<TilesetBackgroundRemovalMode>(
      () =>
        resolveDraftBackgroundRemovalModeByTilesetPath(
          selectedTilesetManagerEditPath,
        ),
      [
        clientOptionsDraft.tilesetBackgroundRemovalModeByTileset,
        selectedTilesetManagerEditPath,
        tilesetCatalog,
      ],
    );

  const tilesetManagerBackgroundRemovalSettingsLocked =
    isNh3dTilesetCombinedBackgroundRemovalForced(
      selectedTilesetManagerEditPath,
    );

  const tilesetManagerSolidChromaKeyColorHex = useMemo(
    () =>
      resolveDraftSolidChromaKeyByTilesetPath(selectedTilesetManagerEditPath),
    [
      clientOptionsDraft.tilesetSolidChromaKeyColorHexByTileset,
      selectedTilesetManagerEditPath,
      tilesetCatalog,
    ],
  );

  const tilesetManagerWeaponSpriteFlipX = useMemo(
    () =>
      resolveDraftWeaponSpriteFlipXByTilesetPath(selectedTilesetManagerEditPath),
    [
      clientOptionsDraft.fpsHeldWeaponSpriteFlipXByTileset,
      selectedTilesetManagerEditPath,
      tilesetCatalog,
    ],
  );

  const tilesetManagerBackgroundGlyphChar =
    representativeGlyphByTileId.get(tilesetManagerBackgroundTileId) ?? " ";

  const tilesetManagerBackgroundGlyphLabel = formatTileGlyphLabel(
    tilesetManagerBackgroundGlyphChar,
  );

  const tilesetManagerBackgroundGlyphNumber =
    representativeGlyphNumberByTileId.get(tilesetManagerBackgroundTileId) ??
    null;

  const selectedTilesetEntry = useMemo(
    () => findNh3dTilesetByPath(clientOptionsDraft.tilesetPath),
    [clientOptionsDraft.tilesetPath, tilesetCatalog],
  );

  const selectedTileAtlasLoadRequested = characterCreationConfig !== null;

  const isVultureTilesetSelected =
    clientOptionsDraft.tilesetMode === "tiles" &&
    selectedTilesetEntry?.source === "vulture";
  return {
    representativeGlyphByTileId,
    representativeGlyphNumberByTileId,
    showTilePickerGlyphNumber,
    defaultDarkWallTileId,
    defaultDarkWallSolidColorHex,
    defaultDarkWallSolidColorHexFps,
    selectedDarkWallTileId,
    selectedDarkWallSolidColorHex,
    selectedDarkWallSolidColorHexFps,
    selectedDarkWallSolidColorGridEnabled,
    selectedDarkWallSolidColorGridDarknessPercent,
    selectedDarkWallGlyphLabel,
    selectedDarkWallGlyphNumber,
    selectedTilesetManagerEditPath,
    selectedTilesetManagerEditEntry,
    selectedTilesetManagerEditUserRecord,
    tilesetManagerInNewMode,
    tilesetManagerNameInputDisabled,
    tilesetManagerDefaultBackgroundTileId,
    tilesetManagerBackgroundTileId,
    tilesetManagerBackgroundRemovalMode,
    tilesetManagerBackgroundRemovalSettingsLocked,
    tilesetManagerSolidChromaKeyColorHex,
    tilesetManagerWeaponSpriteFlipX,
    tilesetManagerBackgroundGlyphLabel,
    tilesetManagerBackgroundGlyphNumber,
    selectedTilesetEntry,
    selectedTileAtlasLoadRequested,
    isVultureTilesetSelected,
  } as const;
}
