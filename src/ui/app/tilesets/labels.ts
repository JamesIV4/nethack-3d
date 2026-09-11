import {
  type Nh3dTilesetEntry,
  type Nh3dTilesetTileLayoutVersion
} from "../../../game/tilesets";
import {
  t
} from "../shared/translations";

/** Tileset runtime-layout and picker display labels. */
export function resolveTilesetLayoutShortLabel(
  tileLayoutVersion: Nh3dTilesetTileLayoutVersion,
): string {
  switch (tileLayoutVersion) {
    case "slashem":
      return "Slash'EM";
    case "3.4.3":
      return "3.4.3";
    case "5.0":
      return "5.0";
    case "3.6.7":
      return "3.6.7";
    default:
      return "unknown";
  }
}

export function resolveTilesetLayoutDisplayLabel(
  tileLayoutVersion: Nh3dTilesetTileLayoutVersion,
): string {
  switch (tileLayoutVersion) {
    case "slashem":
      return "Slash'EM layout";
    case "3.4.3":
      return "NetHack 3.4.3 layout";
    case "5.0":
      return t.dialogs.tilesetManager.layout5;
    case "3.6.7":
      return t.dialogs.tilesetManager.layout367;
    default:
      return "Unknown layout";
  }
}

export function formatTilesetPickerOptionLabel(
  tileset: Nh3dTilesetEntry,
  showLayoutVersion: boolean,
): string {
  if (!showLayoutVersion) {
    return tileset.label;
  }
  return `${tileset.label} (${resolveTilesetLayoutShortLabel(
    tileset.tileLayoutVersion,
  )})`;
}
