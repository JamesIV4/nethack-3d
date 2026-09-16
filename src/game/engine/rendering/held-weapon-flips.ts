import { resolveDefaultNh3dTilesetWeaponSpriteFlipX } from "../../tilesets";
import { DEFAULT_FPS_HELD_WEAPON_TILE_FLIP_OVERRIDES_BY_TILESET } from "../shared/constants";
import type { FpsHeldWeaponTileFlipOverride, FpsHeldWeaponTileFlipOverridesByTileset } from "../shared/types";
import { authoredHeldWeaponTileFlips } from "./held-weapon-flip-defaults";

/** Calibrated sprite corrections take precedence over built-in defaults in every held-weapon view. */
export function resolveHeldWeaponTileFlips(
  tilesetPath: string,
  tileId: number | null,
  authored: FpsHeldWeaponTileFlipOverridesByTileset = authoredHeldWeaponTileFlips,
): FpsHeldWeaponTileFlipOverride {
  if (tileId !== null && Number.isFinite(tileId) && tileId >= 0) {
    const key = String(Math.trunc(tileId));
    const override = authored[tilesetPath]?.[key] ?? DEFAULT_FPS_HELD_WEAPON_TILE_FLIP_OVERRIDES_BY_TILESET[tilesetPath]?.[key];
    if (override) return { ...override };
  }
  return { flipX: resolveDefaultNh3dTilesetWeaponSpriteFlipX(tilesetPath), flipY: false, flipDiagonal: false };
}
