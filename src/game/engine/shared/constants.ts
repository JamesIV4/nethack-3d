import * as THREE from "three";
import { nh3dControllerActionSpecs, type Nh3dControllerActionId } from "../../controller-bindings";
import { type FpsHeldWeaponAnimationVector3 } from "../../fps-held-weapon-animations";
import type {
  FpsHeldWeaponTileFlipOverridesByTileId,
  FpsHeldWeaponTileFlipOverridesByTileset,
  FpsHeldWeaponBasePoseDefinition,
  VultureProjectionTextureMode
} from "./types";

export const createZeroFpsHeldWeaponAnimationVector =
  (): FpsHeldWeaponAnimationVector3 => ({
    x: 0,
    y: 0,
    z: 0,
  });

export const FPS_HELD_WEAPON_ANIMATION_DEBUG_BASE_POSE_ID =
  "__fps_held_weapon_base_pose__";

export const FPS_HELD_WEAPON_ANIMATION_DEBUG_BASE_POSE_LABEL = "Weapon Idle Offset";

export const DEFAULT_FPS_HELD_WEAPON_TILE_FLIP_OVERRIDES_BY_TILESET: FpsHeldWeaponTileFlipOverridesByTileset =
  {
    "assets/slashem/Absurd.png": {
      "645": { flipX: false, flipY: false, flipDiagonal: false },
      "646": { flipX: false, flipY: true, flipDiagonal: true },
      "648": { flipX: true, flipY: false, flipDiagonal: true },
      "650": { flipX: false, flipY: true, flipDiagonal: true },
      "656": { flipX: false, flipY: true, flipDiagonal: false },
      "657": { flipX: false, flipY: true, flipDiagonal: false },
      "660": { flipX: true, flipY: false, flipDiagonal: true },
      "666": { flipX: false, flipY: false, flipDiagonal: false },
      "668": { flipX: false, flipY: false, flipDiagonal: false },
      "670": { flipX: false, flipY: false, flipDiagonal: false },
      "671": { flipX: false, flipY: false, flipDiagonal: false },
      "673": { flipX: false, flipY: true, flipDiagonal: true },
      "674": { flipX: false, flipY: false, flipDiagonal: false },
      "675": { flipX: false, flipY: false, flipDiagonal: false },
      "679": { flipX: false, flipY: false, flipDiagonal: true },
      "681": { flipX: false, flipY: false, flipDiagonal: false },
      "694": { flipX: false, flipY: false, flipDiagonal: false },
      "704": { flipX: false, flipY: false, flipDiagonal: true },
      "705": { flipX: false, flipY: false, flipDiagonal: true },
      "706": { flipX: false, flipY: false, flipDiagonal: true },
      "707": { flipX: false, flipY: false, flipDiagonal: true },
      "715": { flipX: false, flipY: false, flipDiagonal: true },
      "716": { flipX: false, flipY: false, flipDiagonal: false },
      "717": { flipX: false, flipY: false, flipDiagonal: true },
      "718": { flipX: false, flipY: false, flipDiagonal: true },
      "719": { flipX: false, flipY: false, flipDiagonal: false },
      "720": { flipX: false, flipY: false, flipDiagonal: false },
      "721": { flipX: false, flipY: false, flipDiagonal: false },
      "722": { flipX: false, flipY: false, flipDiagonal: false },
      "723": { flipX: false, flipY: false, flipDiagonal: false },
      "724": { flipX: false, flipY: false, flipDiagonal: false },
      "737": { flipX: false, flipY: false, flipDiagonal: true },
      "911": { flipX: false, flipY: true, flipDiagonal: false },
      "912": { flipX: false, flipY: false, flipDiagonal: false },
      "913": { flipX: false, flipY: false, flipDiagonal: false },
      "914": { flipX: false, flipY: false, flipDiagonal: false },
      "915": { flipX: false, flipY: false, flipDiagonal: false },
      "916": { flipX: false, flipY: false, flipDiagonal: false },
      "917": { flipX: false, flipY: false, flipDiagonal: true },
      "919": { flipX: false, flipY: false, flipDiagonal: false },
      "925": { flipX: true, flipY: true, flipDiagonal: false },
      "928": { flipX: false, flipY: false, flipDiagonal: false },
      "931": { flipX: false, flipY: true, flipDiagonal: false },
      "944": { flipX: true, flipY: false, flipDiagonal: true },
      "1130": { flipX: true, flipY: true, flipDiagonal: true },
    },
    "assets/3.6/Absurdly Evil.png": {
      "795": { flipX: true, flipY: false, flipDiagonal: true },
      "801": { flipX: false, flipY: true, flipDiagonal: true },
      "805": { flipX: false, flipY: false, flipDiagonal: true },
      "807": { flipX: false, flipY: true, flipDiagonal: false },
      "808": { flipX: true, flipY: false, flipDiagonal: true },
      "809": { flipX: true, flipY: false, flipDiagonal: true },
      "810": { flipX: true, flipY: false, flipDiagonal: true },
      "811": { flipX: true, flipY: false, flipDiagonal: true },
      "813": { flipX: true, flipY: false, flipDiagonal: true },
      "815": { flipX: true, flipY: true, flipDiagonal: false },
      "829": { flipX: true, flipY: false, flipDiagonal: true },
      "830": { flipX: true, flipY: false, flipDiagonal: true },
      "839": { flipX: true, flipY: false, flipDiagonal: true },
      "840": { flipX: true, flipY: false, flipDiagonal: true },
      "848": { flipX: true, flipY: false, flipDiagonal: true },
      "849": { flipX: true, flipY: false, flipDiagonal: true },
      "850": { flipX: true, flipY: false, flipDiagonal: true },
      "851": { flipX: false, flipY: true, flipDiagonal: true },
      "857": { flipX: true, flipY: false, flipDiagonal: true },
      "858": { flipX: true, flipY: false, flipDiagonal: true },
      "859": { flipX: true, flipY: false, flipDiagonal: true },
      "869": { flipX: false, flipY: true, flipDiagonal: true },
      "870": { flipX: false, flipY: true, flipDiagonal: true },
      "871": { flipX: false, flipY: false, flipDiagonal: true },
      "876": { flipX: true, flipY: false, flipDiagonal: true },
      "1266": { flipX: false, flipY: false, flipDiagonal: true },
    },
    "assets/3.6/DawnHack.bmp": {
      "395": { flipX: false, flipY: true, flipDiagonal: false },
      "396": { flipX: true, flipY: true, flipDiagonal: false },
      "397": { flipX: false, flipY: true, flipDiagonal: false },
      "398": { flipX: true, flipY: true, flipDiagonal: false },
      "399": { flipX: false, flipY: true, flipDiagonal: false },
      "401": { flipX: false, flipY: true, flipDiagonal: false },
      "403": { flipX: false, flipY: false, flipDiagonal: true },
      "405": { flipX: false, flipY: false, flipDiagonal: false },
      "407": { flipX: false, flipY: false, flipDiagonal: false },
      "408": { flipX: false, flipY: true, flipDiagonal: true },
      "409": { flipX: false, flipY: false, flipDiagonal: false },
      "411": { flipX: false, flipY: false, flipDiagonal: false },
      "413": { flipX: false, flipY: false, flipDiagonal: false },
      "415": { flipX: false, flipY: false, flipDiagonal: false },
      "417": { flipX: false, flipY: false, flipDiagonal: false },
      "419": { flipX: false, flipY: false, flipDiagonal: false },
      "421": { flipX: false, flipY: false, flipDiagonal: true },
      "423": { flipX: false, flipY: false, flipDiagonal: true },
      "424": { flipX: false, flipY: true, flipDiagonal: true },
      "425": { flipX: false, flipY: false, flipDiagonal: true },
      "427": { flipX: false, flipY: false, flipDiagonal: false },
      "429": { flipX: false, flipY: false, flipDiagonal: false },
      "432": { flipX: false, flipY: false, flipDiagonal: false },
      "434": { flipX: false, flipY: false, flipDiagonal: false },
      "436": { flipX: false, flipY: false, flipDiagonal: false },
      "439": { flipX: false, flipY: false, flipDiagonal: false },
      "441": { flipX: false, flipY: false, flipDiagonal: false },
      "443": { flipX: false, flipY: false, flipDiagonal: false },
      "445": { flipX: false, flipY: false, flipDiagonal: false },
      "447": { flipX: false, flipY: false, flipDiagonal: false },
      "448": { flipX: false, flipY: true, flipDiagonal: false },
      "449": { flipX: true, flipY: true, flipDiagonal: false },
      "453": { flipX: false, flipY: false, flipDiagonal: false },
      "455": { flipX: false, flipY: false, flipDiagonal: false },
      "457": { flipX: false, flipY: true, flipDiagonal: true },
      "458": { flipX: false, flipY: true, flipDiagonal: true },
      "459": { flipX: false, flipY: false, flipDiagonal: false },
      "461": { flipX: false, flipY: false, flipDiagonal: false },
    },
    "assets/3.6/NetHack Modern.bmp": {
      "401": { flipX: false, flipY: false, flipDiagonal: false },
      "403": { flipX: false, flipY: false, flipDiagonal: true },
      "404": { flipX: true, flipY: true, flipDiagonal: false },
      "405": { flipX: true, flipY: true, flipDiagonal: false },
      "406": { flipX: true, flipY: true, flipDiagonal: false },
      "407": { flipX: true, flipY: true, flipDiagonal: false },
      "408": { flipX: true, flipY: true, flipDiagonal: false },
      "409": { flipX: true, flipY: true, flipDiagonal: false },
      "410": { flipX: true, flipY: true, flipDiagonal: false },
      "411": { flipX: true, flipY: true, flipDiagonal: false },
      "412": { flipX: true, flipY: true, flipDiagonal: false },
      "413": { flipX: true, flipY: true, flipDiagonal: false },
      "414": { flipX: true, flipY: true, flipDiagonal: false },
      "415": { flipX: true, flipY: true, flipDiagonal: false },
      "417": { flipX: true, flipY: true, flipDiagonal: true },
      "418": { flipX: true, flipY: true, flipDiagonal: false },
      "420": { flipX: true, flipY: true, flipDiagonal: true },
      "423": { flipX: true, flipY: true, flipDiagonal: true },
      "424": { flipX: true, flipY: true, flipDiagonal: true },
      "425": { flipX: true, flipY: true, flipDiagonal: true },
      "426": { flipX: true, flipY: true, flipDiagonal: true },
      "427": { flipX: true, flipY: true, flipDiagonal: true },
      "429": { flipX: true, flipY: true, flipDiagonal: false },
      "430": { flipX: true, flipY: true, flipDiagonal: false },
      "431": { flipX: true, flipY: true, flipDiagonal: false },
      "432": { flipX: true, flipY: true, flipDiagonal: false },
      "433": { flipX: true, flipY: true, flipDiagonal: false },
      "434": { flipX: true, flipY: true, flipDiagonal: false },
      "435": { flipX: true, flipY: true, flipDiagonal: false },
      "436": { flipX: true, flipY: true, flipDiagonal: false },
      "437": { flipX: true, flipY: true, flipDiagonal: false },
      "438": { flipX: true, flipY: true, flipDiagonal: false },
      "439": { flipX: true, flipY: true, flipDiagonal: false },
      "440": { flipX: true, flipY: true, flipDiagonal: false },
      "441": { flipX: true, flipY: true, flipDiagonal: false },
      "442": { flipX: true, flipY: true, flipDiagonal: false },
      "443": { flipX: true, flipY: true, flipDiagonal: false },
      "445": { flipX: false, flipY: false, flipDiagonal: true },
      "446": { flipX: false, flipY: false, flipDiagonal: true },
      "447": { flipX: false, flipY: false, flipDiagonal: true },
      "448": { flipX: true, flipY: true, flipDiagonal: false },
      "449": { flipX: true, flipY: true, flipDiagonal: false },
      "453": { flipX: true, flipY: true, flipDiagonal: false },
      "454": { flipX: false, flipY: false, flipDiagonal: true },
      "455": { flipX: false, flipY: true, flipDiagonal: true },
      "456": { flipX: true, flipY: true, flipDiagonal: false },
      "458": { flipX: false, flipY: false, flipDiagonal: true },
    },
    "assets/3.6/Nevanda.png": {
      "401": { flipX: false, flipY: true, flipDiagonal: false },
      "403": { flipX: false, flipY: true, flipDiagonal: true },
      "415": { flipX: false, flipY: true, flipDiagonal: true },
      "416": { flipX: false, flipY: true, flipDiagonal: true },
      "417": { flipX: false, flipY: true, flipDiagonal: true },
      "427": { flipX: false, flipY: true, flipDiagonal: true },
      "451": { flipX: false, flipY: false, flipDiagonal: true },
      "452": { flipX: false, flipY: true, flipDiagonal: true },
      "457": { flipX: false, flipY: false, flipDiagonal: false },
      "458": { flipX: false, flipY: true, flipDiagonal: true },
      "459": { flipX: false, flipY: true, flipDiagonal: false },
      "460": { flipX: false, flipY: true, flipDiagonal: false },
      "461": { flipX: false, flipY: true, flipDiagonal: false },
      "462": { flipX: false, flipY: true, flipDiagonal: false },
      "463": { flipX: false, flipY: false, flipDiagonal: true },
    },
    "assets/3.6/RZTiles.bmp": {
      "400": { flipX: false, flipY: true, flipDiagonal: false },
      "401": { flipX: false, flipY: false, flipDiagonal: false },
      "406": { flipX: false, flipY: true, flipDiagonal: false },
      "416": { flipX: false, flipY: true, flipDiagonal: true },
      "421": { flipX: false, flipY: true, flipDiagonal: true },
      "429": { flipX: false, flipY: true, flipDiagonal: false },
      "430": { flipX: false, flipY: true, flipDiagonal: false },
      "431": { flipX: false, flipY: true, flipDiagonal: true },
      "432": { flipX: false, flipY: true, flipDiagonal: true },
      "433": { flipX: false, flipY: true, flipDiagonal: false },
      "434": { flipX: false, flipY: true, flipDiagonal: false },
      "435": { flipX: false, flipY: true, flipDiagonal: true },
      "436": { flipX: false, flipY: true, flipDiagonal: true },
      "437": { flipX: false, flipY: true, flipDiagonal: false },
      "438": { flipX: false, flipY: true, flipDiagonal: false },
      "441": { flipX: false, flipY: true, flipDiagonal: true },
      "442": { flipX: false, flipY: true, flipDiagonal: true },
      "452": { flipX: true, flipY: false, flipDiagonal: true },
      "456": { flipX: false, flipY: true, flipDiagonal: false },
      "457": { flipX: false, flipY: true, flipDiagonal: false },
      "459": { flipX: false, flipY: false, flipDiagonal: true },
      "460": { flipX: false, flipY: false, flipDiagonal: true },
      "461": { flipX: false, flipY: false, flipDiagonal: true },
      "462": { flipX: false, flipY: false, flipDiagonal: true },
      "463": { flipX: true, flipY: false, flipDiagonal: true },
    },
    "assets/3.6/Vanilla NetHack Tiles.png": {
      "400": { flipX: false, flipY: false, flipDiagonal: true },
      "401": { flipX: false, flipY: true, flipDiagonal: false },
      "403": { flipX: false, flipY: false, flipDiagonal: true },
      "404": { flipX: false, flipY: true, flipDiagonal: true },
      "405": { flipX: false, flipY: true, flipDiagonal: true },
      "406": { flipX: false, flipY: true, flipDiagonal: true },
      "407": { flipX: false, flipY: true, flipDiagonal: true },
      "408": { flipX: false, flipY: true, flipDiagonal: true },
      "410": { flipX: false, flipY: false, flipDiagonal: false },
      "411": { flipX: false, flipY: true, flipDiagonal: true },
      "412": { flipX: false, flipY: true, flipDiagonal: true },
      "413": { flipX: false, flipY: true, flipDiagonal: true },
      "414": { flipX: false, flipY: true, flipDiagonal: true },
      "415": { flipX: false, flipY: true, flipDiagonal: true },
      "416": { flipX: true, flipY: true, flipDiagonal: true },
      "417": { flipX: false, flipY: true, flipDiagonal: true },
      "418": { flipX: false, flipY: true, flipDiagonal: true },
      "419": { flipX: false, flipY: false, flipDiagonal: true },
      "420": { flipX: false, flipY: true, flipDiagonal: true },
      "421": { flipX: false, flipY: false, flipDiagonal: true },
      "422": { flipX: false, flipY: false, flipDiagonal: false },
      "423": { flipX: false, flipY: false, flipDiagonal: true },
      "424": { flipX: false, flipY: false, flipDiagonal: true },
      "425": { flipX: false, flipY: false, flipDiagonal: true },
      "426": { flipX: false, flipY: false, flipDiagonal: true },
      "427": { flipX: false, flipY: false, flipDiagonal: true },
      "428": { flipX: false, flipY: true, flipDiagonal: true },
      "429": { flipX: false, flipY: false, flipDiagonal: true },
      "430": { flipX: false, flipY: false, flipDiagonal: true },
      "431": { flipX: false, flipY: true, flipDiagonal: true },
      "432": { flipX: false, flipY: true, flipDiagonal: true },
      "436": { flipX: false, flipY: true, flipDiagonal: true },
      "437": { flipX: false, flipY: true, flipDiagonal: false },
      "438": { flipX: false, flipY: true, flipDiagonal: false },
      "440": { flipX: false, flipY: false, flipDiagonal: false },
      "449": { flipX: false, flipY: false, flipDiagonal: false },
      "451": { flipX: false, flipY: false, flipDiagonal: true },
      "463": { flipX: false, flipY: true, flipDiagonal: true },
      "464": { flipX: false, flipY: true, flipDiagonal: true },
    },
    "assets/5.0/Nevanda (5.0).png": {
      "813": { flipX: false, flipY: true, flipDiagonal: false },
      "815": { flipX: false, flipY: true, flipDiagonal: true },
      "827": { flipX: false, flipY: true, flipDiagonal: true },
      "828": { flipX: false, flipY: true, flipDiagonal: true },
      "829": { flipX: false, flipY: true, flipDiagonal: true },
      "839": { flipX: false, flipY: true, flipDiagonal: true },
      "864": { flipX: false, flipY: false, flipDiagonal: false },
      "865": { flipX: false, flipY: true, flipDiagonal: true },
      "870": { flipX: false, flipY: false, flipDiagonal: false },
      "872": { flipX: false, flipY: true, flipDiagonal: false },
      "873": { flipX: false, flipY: true, flipDiagonal: false },
      "874": { flipX: false, flipY: true, flipDiagonal: false },
      "875": { flipX: false, flipY: true, flipDiagonal: false },
      "876": { flipX: false, flipY: false, flipDiagonal: true },
    },
    "assets/5.0/Vanilla NetHack Tiles (5.0).png": {
      "807": { flipX: false, flipY: true, flipDiagonal: false },
      "808": { flipX: false, flipY: true, flipDiagonal: false },
      "809": { flipX: false, flipY: true, flipDiagonal: false },
      "810": { flipX: false, flipY: true, flipDiagonal: false },
      "811": { flipX: false, flipY: true, flipDiagonal: false },
      "812": { flipX: false, flipY: false, flipDiagonal: false },
      "813": { flipX: false, flipY: false, flipDiagonal: true },
      "816": { flipX: false, flipY: true, flipDiagonal: true },
      "817": { flipX: false, flipY: true, flipDiagonal: true },
      "818": { flipX: false, flipY: true, flipDiagonal: true },
      "819": { flipX: false, flipY: true, flipDiagonal: true },
      "822": { flipX: false, flipY: false, flipDiagonal: false },
      "828": { flipX: false, flipY: false, flipDiagonal: false },
      "831": { flipX: false, flipY: true, flipDiagonal: true },
      "833": { flipX: false, flipY: false, flipDiagonal: true },
      "834": { flipX: false, flipY: false, flipDiagonal: true },
      "835": { flipX: false, flipY: false, flipDiagonal: true },
      "836": { flipX: false, flipY: false, flipDiagonal: true },
      "837": { flipX: false, flipY: false, flipDiagonal: true },
      "838": { flipX: false, flipY: false, flipDiagonal: true },
      "839": { flipX: false, flipY: false, flipDiagonal: true },
      "841": { flipX: false, flipY: false, flipDiagonal: true },
      "842": { flipX: false, flipY: false, flipDiagonal: true },
      "848": { flipX: false, flipY: true, flipDiagonal: false },
      "849": { flipX: true, flipY: false, flipDiagonal: true },
      "850": { flipX: true, flipY: false, flipDiagonal: true },
      "855": { flipX: false, flipY: true, flipDiagonal: true },
      "856": { flipX: false, flipY: true, flipDiagonal: true },
      "857": { flipX: false, flipY: true, flipDiagonal: true },
      "859": { flipX: false, flipY: false, flipDiagonal: false },
      "861": { flipX: true, flipY: true, flipDiagonal: false },
      "864": { flipX: false, flipY: false, flipDiagonal: true },
      "869": { flipX: true, flipY: false, flipDiagonal: true },
      "877": { flipX: false, flipY: false, flipDiagonal: true },
    },
  };

export const roundFpsHeldWeaponAnimationDebugNumber = (
  value: number,
  decimals: number = 4,
): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const createDefaultFpsHeldWeaponBasePoseDefinition =
  (): FpsHeldWeaponBasePoseDefinition => ({
    position: {
      x: 0.12,
      y: 0.06,
      z: -0.01,
    },
    rotationDeg: {
      x: -8.2,
      y: 0,
      z: -65.4,
    },
  });

export const serializeFpsHeldWeaponBasePoseDefinition = (
  basePose: FpsHeldWeaponBasePoseDefinition,
): string =>
  JSON.stringify(
    {
      positionOffset: {
        x: roundFpsHeldWeaponAnimationDebugNumber(basePose.position.x),
        y: roundFpsHeldWeaponAnimationDebugNumber(basePose.position.y),
        z: roundFpsHeldWeaponAnimationDebugNumber(basePose.position.z),
      },
      rotationOffsetDeg: {
        x: roundFpsHeldWeaponAnimationDebugNumber(basePose.rotationDeg.x),
        y: roundFpsHeldWeaponAnimationDebugNumber(basePose.rotationDeg.y),
        z: roundFpsHeldWeaponAnimationDebugNumber(basePose.rotationDeg.z),
      },
    },
    null,
    2,
  );

export const serializeFpsHeldWeaponTileFlipOverrides = (
  overridesByTileset: FpsHeldWeaponTileFlipOverridesByTileset,
): string => {
  const normalized: FpsHeldWeaponTileFlipOverridesByTileset = {};
  for (const tilesetPath of Object.keys(overridesByTileset).sort((a, b) =>
    a.localeCompare(b),
  )) {
    const overridesByTileId = overridesByTileset[tilesetPath];
    if (!overridesByTileId || typeof overridesByTileId !== "object") {
      continue;
    }
    const normalizedByTileId: FpsHeldWeaponTileFlipOverridesByTileId = {};
    const sortedTileIds = Object.keys(overridesByTileId).sort(
      (left, right) => Number(left) - Number(right),
    );
    for (const tileId of sortedTileIds) {
      const override = overridesByTileId[tileId];
      if (!override || typeof override !== "object") {
        continue;
      }
      normalizedByTileId[tileId] = {
        flipX: override.flipX === true,
        flipY: override.flipY === true,
        flipDiagonal: override.flipDiagonal === true,
      };
    }
    if (Object.keys(normalizedByTileId).length > 0) {
      normalized[tilesetPath] = normalizedByTileId;
    }
  }
  return JSON.stringify(normalized, null, 2);
};

export const MINIMAP_WIDTH_TILES = 79;

export const MINIMAP_HEIGHT_TILES = 21;

// A minimap cell is only one pixel, so it cannot preserve the glyph-shape
// distinction between a gray floor dot and a gray wall segment. Keep the
// NetHack hue, but move floor-like cells toward the map background.
export const MINIMAP_FLOOR_FOREGROUND_WEIGHT = 0.12;

export const MINIMAP_PLAYER_PULSE_PERIOD_MS = 1200;

export const MINIMAP_PLAYER_PULSE_MIN_BRIGHTNESS = 164;

export const MINIMAP_NETHACK_3D_PALETTE: readonly string[] = [
  "rgba(10, 16, 28, 0.82)",
  "rgba(20, 29, 46, 0.9)",
  "#3f4b5d",
  "#687384",
  "#7d614a",
  "#2b78ab",
  "#8f76c7",
  "#886137",
  "#b59037",
  "#954647",
  "#4f9a6f",
  "#5d89ba",
  "#ffffff",
];

export const nh3dControllerActionIds = nh3dControllerActionSpecs.map(
  (spec) => spec.id,
);

// Internal-only dev toggle for Vulture projection textures.
// Keep this out of user-facing options/UI.
export const NH3D_INTERNAL_VULTURE_PROJECTION_TEXTURE_MODE: VultureProjectionTextureMode =
  "prebaked";
 // prebaked or runtime
export const NH3D_VULTURE_PREBAKED_PROJECTION_MANIFEST_RELATIVE_PATH =
  "prebaked/projection-manifest.json";

// Lucide's Heart icon path. Keeping the original vector path here lets canvas
// billboard textures render the same icon used by the React UI package.
export const NH3D_LUCIDE_HEART_PATH =
  "M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5";

export const NH3D_PET_HEART_COLOR = "#ff244f";

export const NH3D_PET_HEART_MIN_TILE_RESOLUTION = 32;

export function createControllerBooleanActionMap(
  initialValue: boolean,
): Record<Nh3dControllerActionId, boolean> {
  const map = {} as Record<Nh3dControllerActionId, boolean>;
  for (const actionId of nh3dControllerActionIds) {
    map[actionId] = initialValue;
  }
  return map;
}

export function createControllerNumberActionMap(
  initialValue: number,
): Record<Nh3dControllerActionId, number> {
  const map = {} as Record<Nh3dControllerActionId, number>;
  for (const actionId of nh3dControllerActionIds) {
    map[actionId] = initialValue;
  }
  return map;
}

export const toneAdjustShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    brightness: { value: 0 },
    contrast: { value: 0 },
    gamma: { value: 1 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float brightness;
    uniform float contrast;
    uniform float gamma;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;
      color += vec3(brightness);
      color = (color - 0.5) * (1.0 + contrast) + 0.5;
      float safeGamma = max(gamma, 0.001);
      color = pow(max(color, vec3(0.0)), vec3(1.0 / safeGamma));
      gl_FragColor = vec4(color, texel.a);
    }
  `,
};
