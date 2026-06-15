import type { NethackRuntimeVersion } from "../runtime/types";
import {
  defaultNh3dTilesetPath,
  isNh3dTilesetPathAvailable,
  isNh3dTilesetBackgroundRemovalModeForcedOff,
  resolveDefaultNh3dTilesetBackgroundTileId,
  resolveDefaultNh3dTilesetBackgroundRemovalMode,
  resolveDefaultNh3dTilesetSolidChromaKeyColorHex,
  resolveDefaultNh3dTilesetWeaponSpriteFlipX,
} from "./tilesets";
import {
  defaultNh3dControllerBindings,
  normalizeNh3dControllerBindings,
  type Nh3dControllerBindings,
} from "./controller-bindings";
import {
  getCurrentLocale,
  resolveSupportedLocale,
  resolveSystemLocale,
  type SupportedLocale,
} from "../i18n/core";

export type NethackConnectionState =
  | "disconnected"
  | "starting"
  | "running"
  | "error";

export type NethackMenuItem = {
  text?: string;
  accelerator?: string;
  originalAccelerator?: string | number;
  isCategory?: boolean;
  isSelectable?: boolean;
  selectionInput?: string;
  identifier?: number;
  menuIndex?: number;
  glyph?: number;
  tileIndex?: number;
  tilePreviewDataUrl?: string;
  glyphChar?: string;
  isTileApplicable?: boolean;
  [key: string]: unknown;
};

export type PlayerStatsSnapshot = {
  name: string;
  hp: number;
  maxHp: number;
  power: number;
  maxPower: number;
  level: number;
  experience: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  armor: number;
  magicCancellation?: number | null;
  toHit?: number | null;
  dungeon: string;
  dlevel: number;
  locationLabel?: string;
  gold: number;
  alignment: string;
  hunger: string;
  encumbrance: string;
  conditionMask: number;
  time: number;
  score: number;
};

export type QuestionDialogState = {
  text: string;
  choices: string;
  defaultChoice: string;
  menuItems: NethackMenuItem[];
  isPickupDialog: boolean;
  selectedAccelerators: string[];
  selectedCounts?: Record<string, number>;
  supportsSelectionCount?: boolean;
  pendingSelectionCount?: number | null;
  allPickupSelected?: boolean;
  activePickupSelectionInput?: string | null;
  activeMenuSelectionInput?: string | null;
  activeActionButton?: "select-all" | "confirm" | "cancel" | null;
  menuPageIndex?: number;
  menuPageCount?: number;
};

export type InfoMenuState = {
  title: string;
  lines: string[];
};

export type InventoryDialogState = {
  visible: boolean;
  items: NethackMenuItem[];
  contextActionsEnabled?: boolean;
};

export type GameOverState = {
  active: boolean;
  deathMessage: string | null;
  promptReady: boolean;
  tombstoneLines: string[] | null;
};

export type TextInputRequestState = {
  text: string;
  contextMessage?: string;
  maxLength?: number;
  placeholder?: string;
};

export type NewGamePromptState = {
  visible: boolean;
  reason: string | null;
};

export type FpsContextAction = {
  id: string;
  label: string;
  kind: "quick" | "extended" | "contextual";
  value: string;
};

export type FpsCrosshairContextState = {
  title: string;
  tileX: number;
  tileY: number;
  actions: FpsContextAction[];
  autoDirectionFromFpsAim?: boolean;
  anchorClientX?: number;
  anchorClientY?: number;
};

export type PlayMode = "normal" | "fps";
export type Nh3dAntialiasingMode = "taa" | "fxaa";
export type Nh3dDesktopTouchInterfaceMode = "off" | "portrait" | "landscape";
export type Nh3dBloodDetailMode = "veryLow" | "low" | "medium" | "high";
export type Nh3dInventoryFixedTileSizeMode =
  | "none"
  | "small"
  | "medium"
  | "large";
export type DarkCorridorWallTileOverrideEnabledByTileset = Record<
  string,
  boolean
>;
export type DarkCorridorWallTileOverrideByTileset = Record<string, number>;
export type DarkCorridorWallSolidColorOverrideEnabledByTileset = Record<
  string,
  boolean
>;
export type DarkCorridorWallSolidColorHexByTileset = Record<string, string>;
export type DarkCorridorWallSolidColorHexFpsByTileset = Record<string, string>;
export type DarkCorridorWallSolidColorGridEnabledByTileset = Record<
  string,
  boolean
>;
export type DarkCorridorWallSolidColorGridDarknessPercentByTileset = Record<
  string,
  number
>;
export type TilesetBackgroundTileByTileset = Record<string, number>;
export type TilesetBackgroundRemovalMode = "none" | "tile" | "solid";
export type TilesetBackgroundRemovalModeByTileset = Record<
  string,
  TilesetBackgroundRemovalMode
>;
export type TilesetSolidChromaKeyColorHexByTileset = Record<string, string>;
export type TilesetWeaponSpriteFlipXByTileset = Record<string, boolean>;

export type Nh3dClientOptions = {
  locale: SupportedLocale;
  fpsMode: boolean;
  fpsFov: number;
  fpsLookSensitivityX: number;
  fpsLookSensitivityY: number;
  fpsWasdKeyboardMovementEnabled: boolean;
  lightingEnabled: boolean;
  fpsFlattenEntityBillboards: boolean;
  showItemsUnderPlayerInOverheadTilesMode: boolean;
  controllerEnabled: boolean;
  controllerFpsMoveRepeatMs: number;
  controllerBindings: Nh3dControllerBindings;
  invertLookYAxis: boolean;
  cameraRelativeMovement: boolean;
  snapCameraYawToNearest45: boolean;
  invertTouchPanningDirection: boolean;
  desktopTouchInterfaceMode: Nh3dDesktopTouchInterfaceMode;
  disableAnimatedTransitions: boolean;
  uiTileBackgroundRemoval: boolean;
  minimap: boolean;
  minimapScale: number;
  reduceInventoryMotion: boolean;
  inventoryTileOnlyMotion: boolean;
  inventoryFixedTileSize: Nh3dInventoryFixedTileSizeMode;
  damageNumbers: boolean;
  displayStatChangesAbovePlayer: boolean;
  displayXpGainsAbovePlayer: boolean;
  tileShakeOnHit: boolean;
  bloodMist: boolean;
  bloodGround: boolean;
  bloodStrength: number;
  bloodColorLightHex: string;
  bloodColorDarkHex: string;
  bloodMistColorHex: string;
  bloodDetail: Nh3dBloodDetailMode;
  monsterShatter: boolean;
  monsterShatterBloodBorders: boolean;
  liveMessageLog: boolean;
  showPersistentMobileMessageLog: boolean;
  rumbleEnabled: boolean;
  manualMobileBottomSafeZoneEnabled: boolean;
  manualMobileBottomSafeZoneVerticalPx: number;
  manualMobileBottomSafeZoneHorizontalPx: number;
  manualMobileRightSafeZoneHorizontalPx: number;
  liveMessageDisplayTimeMs: number;
  liveMessageFadeOutTimeMs: number;
  showVersionNotificationsOnLaunch: boolean;
  uiFontScale: number;
  liveMessageLogFontScale: number;
  desktopMessageLogWindowScale: number;
  soundEnabled: boolean;
  blockAmbientOcclusion: boolean;
  darkCorridorWalls367: boolean;
  overrideNh5DarkCorridorWallTiles: boolean;
  darkCorridorWallTileOverrideEnabled: boolean;
  darkCorridorWallTileOverrideEnabledByTileset: DarkCorridorWallTileOverrideEnabledByTileset;
  darkCorridorWallTileOverrideTileId: number;
  darkCorridorWallTileOverrideTileIdByTileset: DarkCorridorWallTileOverrideByTileset;
  darkCorridorWallSolidColorOverrideEnabled: boolean;
  darkCorridorWallSolidColorOverrideEnabledByTileset: DarkCorridorWallSolidColorOverrideEnabledByTileset;
  darkCorridorWallSolidColorHex: string;
  darkCorridorWallSolidColorHexByTileset: DarkCorridorWallSolidColorHexByTileset;
  darkCorridorWallSolidColorHexFps: string;
  darkCorridorWallSolidColorHexFpsByTileset: DarkCorridorWallSolidColorHexFpsByTileset;
  darkCorridorWallSolidColorGridEnabled: boolean;
  darkCorridorWallSolidColorGridEnabledByTileset: DarkCorridorWallSolidColorGridEnabledByTileset;
  darkCorridorWallSolidColorGridDarknessPercent: number;
  darkCorridorWallSolidColorGridDarknessPercentByTileset: DarkCorridorWallSolidColorGridDarknessPercentByTileset;
  tilesetBackgroundTileId: number;
  tilesetBackgroundTileIdByTileset: TilesetBackgroundTileByTileset;
  tilesetBackgroundRemovalMode: TilesetBackgroundRemovalMode;
  tilesetBackgroundRemovalModeByTileset: TilesetBackgroundRemovalModeByTileset;
  tilesetSolidChromaKeyColorHex: string;
  tilesetSolidChromaKeyColorHexByTileset: TilesetSolidChromaKeyColorHexByTileset;
  fpsHeldWeaponVisible: boolean;
  fpsHeldWeaponSpriteFlipX: boolean;
  fpsHeldWeaponSpriteFlipXByTileset: TilesetWeaponSpriteFlipXByTileset;
  tilesetMode: "ascii" | "tiles";
  tilesetPath: string;
  antialiasing: Nh3dAntialiasingMode;
  brightness: number;
  contrast: number;
  gamma: number;
};

export const nh3dFpsLookSensitivityMin = 0.4;
export const nh3dFpsLookSensitivityMax = 2.6;
export const defaultNh3dBloodColorLightHex = "#c70700";
export const defaultNh3dBloodColorDarkHex = "#b30000";
export const defaultNh3dBloodMistColorHex = "#ff3333";
export const nh3dOpenCharacterSheetEventName = "nh3d:open-character-sheet";
export const nh3dToggleControllerActionWheelEventName =
  "nh3d:toggle-controller-action-wheel";
export const nh3dCloseControllerActionWheelEventName =
  "nh3d:close-controller-action-wheel";
export const nh3dCloseInventoryContextMenuEventName =
  "nh3d:close-inventory-context-menu";

export function resolveNh3dBloodDetailPixelsPerTile(
  detail: Nh3dBloodDetailMode,
): number {
  switch (detail) {
    case "veryLow":
      return 16;
    case "low":
      return 32;
    case "high":
      return 128;
    case "medium":
    default:
      return 64;
  }
}

function resolveDefaultNh3dBloodDetail(): Nh3dBloodDetailMode {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "medium";
  }

  if (window.matchMedia("(pointer: coarse)").matches) {
    return "veryLow";
  }

  const globalWithCapacitor = window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  if (globalWithCapacitor.Capacitor?.isNativePlatform?.() === true) {
    return "veryLow";
  }

  const protocol = window.location.protocol.toLowerCase();
  if (protocol === "capacitor:" || protocol === "ionic:") {
    return "veryLow";
  }

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints =
    typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0;
  const isIosBrowser =
    /\b(iPad|iPhone|iPod)\b/i.test(userAgent) ||
    (/Mac/i.test(platform) && maxTouchPoints > 1);
  return isIosBrowser ? "veryLow" : "medium";
}

const isMobilePortrait = window.matchMedia(
  "(orientation: portrait) and (pointer: coarse)",
);
const isMobile = window.matchMedia("(pointer: coarse)");

export const defaultNh3dClientOptions: Nh3dClientOptions = {
  locale: resolveSystemLocale(),
  fpsMode: false,
  fpsFov: isMobilePortrait.matches ? 95 : 62,
  fpsLookSensitivityX: isMobile.matches ? 1.5 : 1,
  fpsLookSensitivityY: isMobile.matches ? 1.5 : 1,
  fpsWasdKeyboardMovementEnabled: true,
  lightingEnabled: true,
  fpsFlattenEntityBillboards: true,
  showItemsUnderPlayerInOverheadTilesMode: true,
  controllerEnabled: false,
  controllerFpsMoveRepeatMs: 190,
  controllerBindings: normalizeNh3dControllerBindings(
    defaultNh3dControllerBindings,
  ),
  invertLookYAxis: false,
  cameraRelativeMovement: true,
  snapCameraYawToNearest45: true,
  invertTouchPanningDirection: false,
  desktopTouchInterfaceMode: "off",
  disableAnimatedTransitions: false,
  uiTileBackgroundRemoval: true,
  minimap: true,
  minimapScale: 1,
  reduceInventoryMotion: true,
  inventoryTileOnlyMotion: true,
  inventoryFixedTileSize: "medium",
  damageNumbers: true,
  displayStatChangesAbovePlayer: true,
  displayXpGainsAbovePlayer: true,
  tileShakeOnHit: true,
  bloodMist: true,
  bloodGround: true,
  bloodStrength: 1.5,
  bloodColorLightHex: defaultNh3dBloodColorLightHex,
  bloodColorDarkHex: defaultNh3dBloodColorDarkHex,
  bloodMistColorHex: defaultNh3dBloodMistColorHex,
  bloodDetail: resolveDefaultNh3dBloodDetail(),
  monsterShatter: true,
  monsterShatterBloodBorders: true,
  liveMessageLog: true,
  showPersistentMobileMessageLog: false,
  rumbleEnabled: true,
  manualMobileBottomSafeZoneEnabled: false,
  manualMobileBottomSafeZoneVerticalPx: 0,
  manualMobileBottomSafeZoneHorizontalPx: 0,
  manualMobileRightSafeZoneHorizontalPx: 0,
  liveMessageDisplayTimeMs: 3000,
  liveMessageFadeOutTimeMs: 520,
  showVersionNotificationsOnLaunch: true,
  uiFontScale: 1,
  liveMessageLogFontScale: 1,
  desktopMessageLogWindowScale: 1,
  soundEnabled: true,
  blockAmbientOcclusion: true,
  darkCorridorWalls367: true,
  overrideNh5DarkCorridorWallTiles: true,
  darkCorridorWallTileOverrideEnabled: false,
  darkCorridorWallTileOverrideEnabledByTileset: {},
  darkCorridorWallTileOverrideTileId: 850,
  darkCorridorWallTileOverrideTileIdByTileset: {
    "assets/3.6/DawnHack.bmp": 872,
    "assets/3.6/RZTiles.bmp": 869,
  },
  darkCorridorWallSolidColorOverrideEnabled: true,
  darkCorridorWallSolidColorOverrideEnabledByTileset: {},
  darkCorridorWallSolidColorHex: "#C7DAFF",
  darkCorridorWallSolidColorHexByTileset: {},
  darkCorridorWallSolidColorHexFps: "#0e131f",
  darkCorridorWallSolidColorHexFpsByTileset: {},
  darkCorridorWallSolidColorGridEnabled: true,
  darkCorridorWallSolidColorGridEnabledByTileset: {},
  darkCorridorWallSolidColorGridDarknessPercent: 33,
  darkCorridorWallSolidColorGridDarknessPercentByTileset: {},
  tilesetBackgroundTileId: resolveDefaultNh3dTilesetBackgroundTileId(
    defaultNh3dTilesetPath,
  ),
  tilesetBackgroundTileIdByTileset: {},
  tilesetBackgroundRemovalMode: "tile",
  tilesetBackgroundRemovalModeByTileset: {},
  tilesetSolidChromaKeyColorHex:
    resolveDefaultNh3dTilesetSolidChromaKeyColorHex(defaultNh3dTilesetPath),
  tilesetSolidChromaKeyColorHexByTileset: {},
  fpsHeldWeaponVisible: true,
  fpsHeldWeaponSpriteFlipX:
    resolveDefaultNh3dTilesetWeaponSpriteFlipX(defaultNh3dTilesetPath),
  fpsHeldWeaponSpriteFlipXByTileset: {},
  tilesetMode: "tiles",
  tilesetPath: defaultNh3dTilesetPath,
  antialiasing: "taa",
  brightness: 0,
  contrast: 0,
  gamma: 1.5,
};

function normalizeDarkCorridorWallOverrideEnabledByTileset(
  rawValue: unknown,
): DarkCorridorWallTileOverrideEnabledByTileset {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }
  const normalized: DarkCorridorWallTileOverrideEnabledByTileset = {};
  for (const [rawPath, rawEnabled] of Object.entries(rawValue)) {
    const tilesetPath = String(rawPath || "").trim();
    if (!tilesetPath || !isNh3dTilesetPathAvailable(tilesetPath)) {
      continue;
    }
    normalized[tilesetPath] = Boolean(rawEnabled);
  }
  return normalized;
}

function normalizeDarkCorridorWallTileOverrideByTileset(
  rawValue: unknown,
): DarkCorridorWallTileOverrideByTileset {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }
  const normalized: DarkCorridorWallTileOverrideByTileset = {};
  for (const [rawPath, rawTileId] of Object.entries(rawValue)) {
    const tilesetPath = String(rawPath || "").trim();
    if (!tilesetPath || !isNh3dTilesetPathAvailable(tilesetPath)) {
      continue;
    }
    if (typeof rawTileId !== "number" || !Number.isFinite(rawTileId)) {
      continue;
    }
    normalized[tilesetPath] = Math.max(0, Math.trunc(rawTileId));
  }
  return normalized;
}

function normalizeDarkCorridorWallSolidColorHex(
  rawValue: unknown,
  fallback: string,
): string {
  const normalized = String(rawValue || "").trim();
  const match = normalized.match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) {
    return fallback;
  }
  return `#${match[1].toLowerCase()}`;
}

function normalizeDarkCorridorWallSolidColorHexByTileset(
  rawValue: unknown,
): DarkCorridorWallSolidColorHexByTileset {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }
  const normalized: DarkCorridorWallSolidColorHexByTileset = {};
  for (const [rawPath, rawHex] of Object.entries(rawValue)) {
    const tilesetPath = String(rawPath || "").trim();
    if (!tilesetPath || !isNh3dTilesetPathAvailable(tilesetPath)) {
      continue;
    }
    normalized[tilesetPath] = normalizeDarkCorridorWallSolidColorHex(
      rawHex,
      defaultNh3dClientOptions.darkCorridorWallSolidColorHex,
    );
  }
  return normalized;
}

function normalizeDarkCorridorWallSolidColorHexFpsByTileset(
  rawValue: unknown,
): DarkCorridorWallSolidColorHexFpsByTileset {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }
  const normalized: DarkCorridorWallSolidColorHexFpsByTileset = {};
  for (const [rawPath, rawHex] of Object.entries(rawValue)) {
    const tilesetPath = String(rawPath || "").trim();
    if (!tilesetPath || !isNh3dTilesetPathAvailable(tilesetPath)) {
      continue;
    }
    normalized[tilesetPath] = normalizeDarkCorridorWallSolidColorHex(
      rawHex,
      defaultNh3dClientOptions.darkCorridorWallSolidColorHexFps,
    );
  }
  return normalized;
}

function normalizeDarkCorridorWallSolidColorGridDarknessPercent(
  rawValue: unknown,
  fallback: number,
): number {
  const parsed =
    typeof rawValue === "number" && Number.isFinite(rawValue)
      ? rawValue
      : fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeDarkCorridorWallSolidColorGridDarknessPercentByTileset(
  rawValue: unknown,
): DarkCorridorWallSolidColorGridDarknessPercentByTileset {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }
  const normalized: DarkCorridorWallSolidColorGridDarknessPercentByTileset = {};
  for (const [rawPath, rawPercent] of Object.entries(rawValue)) {
    const tilesetPath = String(rawPath || "").trim();
    if (!tilesetPath || !isNh3dTilesetPathAvailable(tilesetPath)) {
      continue;
    }
    normalized[tilesetPath] =
      normalizeDarkCorridorWallSolidColorGridDarknessPercent(
        rawPercent,
        defaultNh3dClientOptions.darkCorridorWallSolidColorGridDarknessPercent,
      );
  }
  return normalized;
}

function normalizeTilesetBackgroundTileIdByTileset(
  rawValue: unknown,
): TilesetBackgroundTileByTileset {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }
  const normalized: TilesetBackgroundTileByTileset = {};
  for (const [rawPath, rawTileId] of Object.entries(rawValue)) {
    const tilesetPath = String(rawPath || "").trim();
    if (!tilesetPath || !isNh3dTilesetPathAvailable(tilesetPath)) {
      continue;
    }
    if (typeof rawTileId !== "number" || !Number.isFinite(rawTileId)) {
      continue;
    }
    normalized[tilesetPath] = Math.max(0, Math.trunc(rawTileId));
  }
  return normalized;
}

function normalizeTilesetBackgroundRemovalMode(
  rawValue: unknown,
  fallbackMode: TilesetBackgroundRemovalMode = "tile",
): TilesetBackgroundRemovalMode {
  if (rawValue === "solid") {
    return "solid";
  }
  if (rawValue === "none") {
    return "none";
  }
  return fallbackMode === "solid" || fallbackMode === "none"
    ? fallbackMode
    : "tile";
}

function normalizeTilesetBackgroundRemovalModeByTileset(
  rawValue: unknown,
): TilesetBackgroundRemovalModeByTileset {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }
  const normalized: TilesetBackgroundRemovalModeByTileset = {};
  for (const [rawPath, rawMode] of Object.entries(rawValue)) {
    const tilesetPath = String(rawPath || "").trim();
    if (!tilesetPath || !isNh3dTilesetPathAvailable(tilesetPath)) {
      continue;
    }
    if (isNh3dTilesetBackgroundRemovalModeForcedOff(tilesetPath)) {
      normalized[tilesetPath] = "none";
      continue;
    }
    normalized[tilesetPath] = normalizeTilesetBackgroundRemovalMode(
      rawMode,
      resolveDefaultNh3dTilesetBackgroundRemovalMode(tilesetPath),
    );
  }
  return normalized;
}

function normalizeTilesetSolidChromaKeyColorHex(
  rawValue: unknown,
  fallback: string,
): string {
  const normalized = String(rawValue || "").trim();
  const match = normalized.match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) {
    return fallback;
  }
  return `#${match[1].toLowerCase()}`;
}

function normalizeBloodColorHex(rawValue: unknown, fallback: string): string {
  const normalized = String(rawValue || "").trim();
  const match = normalized.match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) {
    return fallback;
  }
  return `#${match[1].toLowerCase()}`;
}

function normalizeTilesetSolidChromaKeyColorHexByTileset(
  rawValue: unknown,
): TilesetSolidChromaKeyColorHexByTileset {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }
  const normalized: TilesetSolidChromaKeyColorHexByTileset = {};
  for (const [rawPath, rawHex] of Object.entries(rawValue)) {
    const tilesetPath = String(rawPath || "").trim();
    if (!tilesetPath || !isNh3dTilesetPathAvailable(tilesetPath)) {
      continue;
    }
    normalized[tilesetPath] = normalizeTilesetSolidChromaKeyColorHex(
      rawHex,
      resolveDefaultNh3dTilesetSolidChromaKeyColorHex(tilesetPath),
    );
  }
  return normalized;
}

function normalizeTilesetWeaponSpriteFlipXByTileset(
  rawValue: unknown,
): TilesetWeaponSpriteFlipXByTileset {
  return normalizeDarkCorridorWallOverrideEnabledByTileset(rawValue);
}

export function normalizeNh3dClientOptions(
  overrides?: Partial<Nh3dClientOptions> | null,
): Nh3dClientOptions {
  const legacyBloodOverrides = overrides as
    | (Partial<Nh3dClientOptions> & { blood?: unknown })
    | null
    | undefined;
  const legacyBloodEnabled =
    typeof legacyBloodOverrides?.blood === "boolean"
      ? legacyBloodOverrides.blood
      : undefined;
  const locale =
    resolveSupportedLocale(overrides?.locale) ?? getCurrentLocale();
  const rawFpsFov =
    typeof overrides?.fpsFov === "number" && Number.isFinite(overrides.fpsFov)
      ? overrides.fpsFov
      : defaultNh3dClientOptions.fpsFov;
  const fpsFov = Math.round(Math.max(45, Math.min(110, rawFpsFov)));
  const rawFpsLookSensitivityX =
    typeof overrides?.fpsLookSensitivityX === "number" &&
    Number.isFinite(overrides.fpsLookSensitivityX)
      ? overrides.fpsLookSensitivityX
      : defaultNh3dClientOptions.fpsLookSensitivityX;
  const rawFpsLookSensitivityY =
    typeof overrides?.fpsLookSensitivityY === "number" &&
    Number.isFinite(overrides.fpsLookSensitivityY)
      ? overrides.fpsLookSensitivityY
      : defaultNh3dClientOptions.fpsLookSensitivityY;
  const fpsLookSensitivityX = Number(
    Math.max(
      nh3dFpsLookSensitivityMin,
      Math.min(nh3dFpsLookSensitivityMax, rawFpsLookSensitivityX),
    ).toFixed(2),
  );
  const fpsLookSensitivityY = Number(
    Math.max(
      nh3dFpsLookSensitivityMin,
      Math.min(nh3dFpsLookSensitivityMax, rawFpsLookSensitivityY),
    ).toFixed(2),
  );
  const rawControllerFpsMoveRepeatMs =
    typeof overrides?.controllerFpsMoveRepeatMs === "number" &&
    Number.isFinite(overrides.controllerFpsMoveRepeatMs)
      ? overrides.controllerFpsMoveRepeatMs
      : defaultNh3dClientOptions.controllerFpsMoveRepeatMs;
  const controllerFpsMoveRepeatMs = Math.round(
    Math.max(80, Math.min(900, rawControllerFpsMoveRepeatMs)),
  );
  const controllerBindings = normalizeNh3dControllerBindings(
    overrides?.controllerBindings,
  );
  const antialiasing =
    overrides?.antialiasing === "taa" || overrides?.antialiasing === "fxaa"
      ? overrides.antialiasing
      : defaultNh3dClientOptions.antialiasing;
  const rawBrightness =
    typeof overrides?.brightness === "number" &&
    Number.isFinite(overrides.brightness)
      ? overrides.brightness
      : defaultNh3dClientOptions.brightness;
  const brightness = Number(
    Math.max(-0.25, Math.min(0.25, rawBrightness)).toFixed(2),
  );
  const rawContrast =
    typeof overrides?.contrast === "number" &&
    Number.isFinite(overrides.contrast)
      ? overrides.contrast
      : defaultNh3dClientOptions.contrast;
  const contrast = Number(
    Math.max(-0.25, Math.min(0.25, rawContrast)).toFixed(2),
  );
  const rawGamma =
    typeof overrides?.gamma === "number" && Number.isFinite(overrides.gamma)
      ? overrides.gamma
      : defaultNh3dClientOptions.gamma;
  const gamma = Number(Math.max(0.5, Math.min(2.5, rawGamma)).toFixed(2));
  const rawLiveMessageDisplayTimeMs =
    typeof overrides?.liveMessageDisplayTimeMs === "number" &&
    Number.isFinite(overrides.liveMessageDisplayTimeMs)
      ? overrides.liveMessageDisplayTimeMs
      : defaultNh3dClientOptions.liveMessageDisplayTimeMs;
  const liveMessageDisplayTimeMs = Math.round(
    Math.max(250, Math.min(6000, rawLiveMessageDisplayTimeMs)),
  );
  const rawLiveMessageFadeOutTimeMs =
    typeof overrides?.liveMessageFadeOutTimeMs === "number" &&
    Number.isFinite(overrides.liveMessageFadeOutTimeMs)
      ? overrides.liveMessageFadeOutTimeMs
      : defaultNh3dClientOptions.liveMessageFadeOutTimeMs;
  const liveMessageFadeOutTimeMs = Math.round(
    Math.max(120, Math.min(4000, rawLiveMessageFadeOutTimeMs)),
  );
  const rawManualMobileBottomSafeZoneVerticalPx =
    typeof overrides?.manualMobileBottomSafeZoneVerticalPx === "number" &&
    Number.isFinite(overrides.manualMobileBottomSafeZoneVerticalPx)
      ? overrides.manualMobileBottomSafeZoneVerticalPx
      : defaultNh3dClientOptions.manualMobileBottomSafeZoneVerticalPx;
  const manualMobileBottomSafeZoneVerticalPx = Math.round(
    Math.max(0, Math.min(100, rawManualMobileBottomSafeZoneVerticalPx)),
  );
  const rawManualMobileBottomSafeZoneHorizontalPx =
    typeof overrides?.manualMobileBottomSafeZoneHorizontalPx === "number" &&
    Number.isFinite(overrides.manualMobileBottomSafeZoneHorizontalPx)
      ? overrides.manualMobileBottomSafeZoneHorizontalPx
      : defaultNh3dClientOptions.manualMobileBottomSafeZoneHorizontalPx;
  const manualMobileBottomSafeZoneHorizontalPx = Math.round(
    Math.max(0, Math.min(100, rawManualMobileBottomSafeZoneHorizontalPx)),
  );
  const rawManualMobileRightSafeZoneHorizontalPx =
    typeof overrides?.manualMobileRightSafeZoneHorizontalPx === "number" &&
    Number.isFinite(overrides.manualMobileRightSafeZoneHorizontalPx)
      ? overrides.manualMobileRightSafeZoneHorizontalPx
      : defaultNh3dClientOptions.manualMobileRightSafeZoneHorizontalPx;
  const manualMobileRightSafeZoneHorizontalPx = Math.round(
    Math.max(0, Math.min(100, rawManualMobileRightSafeZoneHorizontalPx)),
  );
  const rawMinimapScale =
    typeof overrides?.minimapScale === "number" &&
    Number.isFinite(overrides.minimapScale)
      ? overrides.minimapScale
      : defaultNh3dClientOptions.minimapScale;
  const minimapScale = Number(
    Math.max(0.6, Math.min(2.2, rawMinimapScale)).toFixed(2),
  );
  const rawBloodStrength =
    typeof overrides?.bloodStrength === "number" &&
    Number.isFinite(overrides.bloodStrength)
      ? overrides.bloodStrength
      : defaultNh3dClientOptions.bloodStrength;
  const bloodStrength = Number(
    Math.max(1, Math.min(2.5, rawBloodStrength)).toFixed(2),
  );
  const bloodColorLightHex = normalizeBloodColorHex(
    overrides?.bloodColorLightHex,
    defaultNh3dClientOptions.bloodColorLightHex,
  );
  const bloodColorDarkHex = normalizeBloodColorHex(
    overrides?.bloodColorDarkHex,
    defaultNh3dClientOptions.bloodColorDarkHex,
  );
  const bloodMistColorHex = normalizeBloodColorHex(
    overrides?.bloodMistColorHex,
    defaultNh3dClientOptions.bloodMistColorHex,
  );
  const bloodDetail =
    overrides?.bloodDetail === "veryLow" ||
    overrides?.bloodDetail === "low" ||
    overrides?.bloodDetail === "high" ||
    overrides?.bloodDetail === "medium"
      ? overrides.bloodDetail
      : defaultNh3dClientOptions.bloodDetail;
  const inventoryFixedTileSize =
    overrides?.inventoryFixedTileSize === "none" ||
    overrides?.inventoryFixedTileSize === "small" ||
    overrides?.inventoryFixedTileSize === "large" ||
    overrides?.inventoryFixedTileSize === "medium"
      ? overrides.inventoryFixedTileSize
      : defaultNh3dClientOptions.inventoryFixedTileSize;
  const rawUiFontScale =
    typeof overrides?.uiFontScale === "number" &&
    Number.isFinite(overrides.uiFontScale)
      ? overrides.uiFontScale
      : defaultNh3dClientOptions.uiFontScale;
  const uiFontScale = Number(
    Math.max(0.7, Math.min(1.8, rawUiFontScale)).toFixed(2),
  );
  const rawLiveMessageLogFontScale =
    typeof overrides?.liveMessageLogFontScale === "number" &&
    Number.isFinite(overrides.liveMessageLogFontScale)
      ? overrides.liveMessageLogFontScale
      : defaultNh3dClientOptions.liveMessageLogFontScale;
  const liveMessageLogFontScale = Number(
    Math.max(0.7, Math.min(2.2, rawLiveMessageLogFontScale)).toFixed(2),
  );
  const rawDesktopMessageLogWindowScale =
    typeof overrides?.desktopMessageLogWindowScale === "number" &&
    Number.isFinite(overrides.desktopMessageLogWindowScale)
      ? overrides.desktopMessageLogWindowScale
      : defaultNh3dClientOptions.desktopMessageLogWindowScale;
  const desktopMessageLogWindowScale = Number(
    Math.max(0.33, Math.min(1.5, rawDesktopMessageLogWindowScale)).toFixed(2),
  );
  const requestedTilesetPath =
    typeof overrides?.tilesetPath === "string"
      ? overrides.tilesetPath.trim()
      : defaultNh3dClientOptions.tilesetPath;
  const tilesetPathExists = isNh3dTilesetPathAvailable(requestedTilesetPath);
  const tilesetPath = tilesetPathExists
    ? requestedTilesetPath
    : defaultNh3dClientOptions.tilesetPath;
  const requestedTilesetMode =
    overrides?.tilesetMode === "tiles"
      ? "tiles"
      : overrides?.tilesetMode === "ascii"
        ? "ascii"
        : defaultNh3dClientOptions.tilesetMode;
  const resolvedTilesetPathExists = isNh3dTilesetPathAvailable(tilesetPath);
  const tilesetMode =
    requestedTilesetMode === "tiles" && resolvedTilesetPathExists
      ? "tiles"
      : "ascii";
  const darkCorridorWallTileOverrideEnabledByTileset =
    normalizeDarkCorridorWallOverrideEnabledByTileset(
      overrides?.darkCorridorWallTileOverrideEnabledByTileset,
    );
  const darkCorridorWallTileOverrideTileIdByTileset =
    normalizeDarkCorridorWallTileOverrideByTileset(
      overrides?.darkCorridorWallTileOverrideTileIdByTileset,
    );
  const darkCorridorWallSolidColorOverrideEnabledByTileset =
    normalizeDarkCorridorWallOverrideEnabledByTileset(
      overrides?.darkCorridorWallSolidColorOverrideEnabledByTileset,
    );
  const darkCorridorWallSolidColorHexByTileset =
    normalizeDarkCorridorWallSolidColorHexByTileset(
      overrides?.darkCorridorWallSolidColorHexByTileset,
    );
  const darkCorridorWallSolidColorHexFpsByTileset =
    normalizeDarkCorridorWallSolidColorHexFpsByTileset(
      overrides?.darkCorridorWallSolidColorHexFpsByTileset,
    );
  const darkCorridorWallSolidColorGridEnabledByTileset =
    normalizeDarkCorridorWallOverrideEnabledByTileset(
      overrides?.darkCorridorWallSolidColorGridEnabledByTileset,
    );
  const darkCorridorWallSolidColorGridDarknessPercentByTileset =
    normalizeDarkCorridorWallSolidColorGridDarknessPercentByTileset(
      overrides?.darkCorridorWallSolidColorGridDarknessPercentByTileset,
    );
  const tilesetBackgroundTileIdByTileset =
    normalizeTilesetBackgroundTileIdByTileset(
      overrides?.tilesetBackgroundTileIdByTileset,
    );
  const tilesetBackgroundRemovalModeByTileset =
    normalizeTilesetBackgroundRemovalModeByTileset(
      overrides?.tilesetBackgroundRemovalModeByTileset,
    );
  const tilesetSolidChromaKeyColorHexByTileset =
    normalizeTilesetSolidChromaKeyColorHexByTileset(
      overrides?.tilesetSolidChromaKeyColorHexByTileset,
    );
  const fpsHeldWeaponSpriteFlipXByTileset =
    normalizeTilesetWeaponSpriteFlipXByTileset(
      overrides?.fpsHeldWeaponSpriteFlipXByTileset,
    );
  const selectedTilesetDarkWallOverrideTileId = tilesetPath
    ? darkCorridorWallTileOverrideTileIdByTileset[tilesetPath]
    : undefined;
  const selectedTilesetDarkWallTileOverrideEnabled = tilesetPath
    ? darkCorridorWallTileOverrideEnabledByTileset[tilesetPath]
    : undefined;
  const selectedTilesetDarkWallSolidOverrideEnabled = tilesetPath
    ? darkCorridorWallSolidColorOverrideEnabledByTileset[tilesetPath]
    : undefined;
  const selectedTilesetDarkWallSolidColorHex = tilesetPath
    ? darkCorridorWallSolidColorHexByTileset[tilesetPath]
    : undefined;
  const selectedTilesetDarkWallSolidColorHexFps = tilesetPath
    ? darkCorridorWallSolidColorHexFpsByTileset[tilesetPath]
    : undefined;
  const selectedTilesetDarkWallSolidColorGridEnabled = tilesetPath
    ? darkCorridorWallSolidColorGridEnabledByTileset[tilesetPath]
    : undefined;
  const selectedTilesetDarkWallSolidColorGridDarknessPercent = tilesetPath
    ? darkCorridorWallSolidColorGridDarknessPercentByTileset[tilesetPath]
    : undefined;
  const selectedTilesetBackgroundTileId = tilesetPath
    ? tilesetBackgroundTileIdByTileset[tilesetPath]
    : undefined;
  const selectedTilesetBackgroundRemovalMode = tilesetPath
    ? tilesetBackgroundRemovalModeByTileset[tilesetPath]
    : undefined;
  const selectedTilesetSolidChromaKeyColorHex = tilesetPath
    ? tilesetSolidChromaKeyColorHexByTileset[tilesetPath]
    : undefined;
  const selectedTilesetWeaponSpriteFlipX = tilesetPath
    ? fpsHeldWeaponSpriteFlipXByTileset[tilesetPath]
    : undefined;
  const darkCorridorWallTileOverrideTileId =
    typeof selectedTilesetDarkWallOverrideTileId === "number" &&
    Number.isFinite(selectedTilesetDarkWallOverrideTileId)
      ? Math.max(0, Math.trunc(selectedTilesetDarkWallOverrideTileId))
      : defaultNh3dClientOptions.darkCorridorWallTileOverrideTileId;
  const darkCorridorWallTileOverrideEnabled =
    typeof selectedTilesetDarkWallTileOverrideEnabled === "boolean"
      ? selectedTilesetDarkWallTileOverrideEnabled
      : typeof overrides?.darkCorridorWallTileOverrideEnabled === "boolean"
        ? overrides.darkCorridorWallTileOverrideEnabled
        : defaultNh3dClientOptions.darkCorridorWallTileOverrideEnabled;
  let darkCorridorWallSolidColorOverrideEnabled =
    typeof selectedTilesetDarkWallSolidOverrideEnabled === "boolean"
      ? selectedTilesetDarkWallSolidOverrideEnabled
      : typeof overrides?.darkCorridorWallSolidColorOverrideEnabled ===
          "boolean"
        ? overrides.darkCorridorWallSolidColorOverrideEnabled
        : defaultNh3dClientOptions.darkCorridorWallSolidColorOverrideEnabled;
  if (
    darkCorridorWallTileOverrideEnabled &&
    darkCorridorWallSolidColorOverrideEnabled
  ) {
    darkCorridorWallSolidColorOverrideEnabled = false;
  }
  const darkCorridorWallSolidColorHex = normalizeDarkCorridorWallSolidColorHex(
    selectedTilesetDarkWallSolidColorHex,
    defaultNh3dClientOptions.darkCorridorWallSolidColorHex,
  );
  const darkCorridorWallSolidColorHexFps =
    normalizeDarkCorridorWallSolidColorHex(
      selectedTilesetDarkWallSolidColorHexFps,
      typeof overrides?.darkCorridorWallSolidColorHexFps === "string"
        ? overrides.darkCorridorWallSolidColorHexFps
        : defaultNh3dClientOptions.darkCorridorWallSolidColorHexFps,
    );
  const darkCorridorWallSolidColorGridEnabled =
    typeof selectedTilesetDarkWallSolidColorGridEnabled === "boolean"
      ? selectedTilesetDarkWallSolidColorGridEnabled
      : typeof overrides?.darkCorridorWallSolidColorGridEnabled === "boolean"
        ? overrides.darkCorridorWallSolidColorGridEnabled
        : defaultNh3dClientOptions.darkCorridorWallSolidColorGridEnabled;
  const darkCorridorWallSolidColorGridDarknessPercent =
    normalizeDarkCorridorWallSolidColorGridDarknessPercent(
      selectedTilesetDarkWallSolidColorGridDarknessPercent,
      typeof overrides?.darkCorridorWallSolidColorGridDarknessPercent ===
        "number"
        ? overrides.darkCorridorWallSolidColorGridDarknessPercent
        : defaultNh3dClientOptions.darkCorridorWallSolidColorGridDarknessPercent,
    );
  const tilesetBackgroundTileId =
    typeof selectedTilesetBackgroundTileId === "number" &&
    Number.isFinite(selectedTilesetBackgroundTileId)
      ? Math.max(0, Math.trunc(selectedTilesetBackgroundTileId))
      : resolveDefaultNh3dTilesetBackgroundTileId(tilesetPath);
  const tilesetBackgroundRemovalMode =
    isNh3dTilesetBackgroundRemovalModeForcedOff(tilesetPath)
      ? "none"
      : normalizeTilesetBackgroundRemovalMode(
          selectedTilesetBackgroundRemovalMode,
          resolveDefaultNh3dTilesetBackgroundRemovalMode(tilesetPath),
        );
  const defaultSolidChromaKeyForTileset =
    resolveDefaultNh3dTilesetSolidChromaKeyColorHex(tilesetPath);
  const tilesetSolidChromaKeyColorHex = normalizeTilesetSolidChromaKeyColorHex(
    selectedTilesetSolidChromaKeyColorHex,
    defaultSolidChromaKeyForTileset,
  );
  const fpsHeldWeaponVisible =
    typeof overrides?.fpsHeldWeaponVisible === "boolean"
      ? overrides.fpsHeldWeaponVisible
      : defaultNh3dClientOptions.fpsHeldWeaponVisible;
  const fpsHeldWeaponSpriteFlipX =
    typeof selectedTilesetWeaponSpriteFlipX === "boolean"
      ? selectedTilesetWeaponSpriteFlipX
      : typeof overrides?.fpsHeldWeaponSpriteFlipX === "boolean"
        ? overrides.fpsHeldWeaponSpriteFlipX
        : resolveDefaultNh3dTilesetWeaponSpriteFlipX(tilesetPath);
  return {
    locale,
    fpsMode:
      typeof overrides?.fpsMode === "boolean"
        ? overrides.fpsMode
        : defaultNh3dClientOptions.fpsMode,
    fpsFov,
    fpsLookSensitivityX,
    fpsLookSensitivityY,
    fpsWasdKeyboardMovementEnabled:
      typeof overrides?.fpsWasdKeyboardMovementEnabled === "boolean"
        ? overrides.fpsWasdKeyboardMovementEnabled
        : defaultNh3dClientOptions.fpsWasdKeyboardMovementEnabled,
    lightingEnabled:
      typeof overrides?.lightingEnabled === "boolean"
        ? overrides.lightingEnabled
        : defaultNh3dClientOptions.lightingEnabled,
    fpsFlattenEntityBillboards:
      typeof overrides?.fpsFlattenEntityBillboards === "boolean"
        ? overrides.fpsFlattenEntityBillboards
        : defaultNh3dClientOptions.fpsFlattenEntityBillboards,
    showItemsUnderPlayerInOverheadTilesMode:
      typeof overrides?.showItemsUnderPlayerInOverheadTilesMode === "boolean"
        ? overrides.showItemsUnderPlayerInOverheadTilesMode
        : defaultNh3dClientOptions.showItemsUnderPlayerInOverheadTilesMode,
    controllerEnabled:
      typeof overrides?.controllerEnabled === "boolean"
        ? overrides.controllerEnabled
        : defaultNh3dClientOptions.controllerEnabled,
    controllerFpsMoveRepeatMs,
    controllerBindings,
    invertLookYAxis:
      typeof overrides?.invertLookYAxis === "boolean"
        ? overrides.invertLookYAxis
        : defaultNh3dClientOptions.invertLookYAxis,
    cameraRelativeMovement:
      typeof overrides?.cameraRelativeMovement === "boolean"
        ? overrides.cameraRelativeMovement
        : defaultNh3dClientOptions.cameraRelativeMovement,
    snapCameraYawToNearest45:
      typeof overrides?.snapCameraYawToNearest45 === "boolean"
        ? overrides.snapCameraYawToNearest45
        : defaultNh3dClientOptions.snapCameraYawToNearest45,
    invertTouchPanningDirection:
      typeof overrides?.invertTouchPanningDirection === "boolean"
        ? overrides.invertTouchPanningDirection
        : defaultNh3dClientOptions.invertTouchPanningDirection,
    desktopTouchInterfaceMode:
      overrides?.desktopTouchInterfaceMode === "portrait" ||
      overrides?.desktopTouchInterfaceMode === "landscape" ||
      overrides?.desktopTouchInterfaceMode === "off"
        ? overrides.desktopTouchInterfaceMode
        : defaultNh3dClientOptions.desktopTouchInterfaceMode,
    disableAnimatedTransitions:
      typeof overrides?.disableAnimatedTransitions === "boolean"
        ? overrides.disableAnimatedTransitions
        : defaultNh3dClientOptions.disableAnimatedTransitions,
    uiTileBackgroundRemoval:
      typeof overrides?.uiTileBackgroundRemoval === "boolean"
        ? overrides.uiTileBackgroundRemoval
        : defaultNh3dClientOptions.uiTileBackgroundRemoval,
    minimap:
      typeof overrides?.minimap === "boolean"
        ? overrides.minimap
        : defaultNh3dClientOptions.minimap,
    minimapScale,
    reduceInventoryMotion:
      typeof overrides?.reduceInventoryMotion === "boolean"
        ? overrides.reduceInventoryMotion
        : defaultNh3dClientOptions.reduceInventoryMotion,
    inventoryTileOnlyMotion:
      typeof overrides?.inventoryTileOnlyMotion === "boolean"
        ? overrides.inventoryTileOnlyMotion
        : defaultNh3dClientOptions.inventoryTileOnlyMotion,
    inventoryFixedTileSize,
    damageNumbers:
      typeof overrides?.damageNumbers === "boolean"
        ? overrides.damageNumbers
        : defaultNh3dClientOptions.damageNumbers,
    displayStatChangesAbovePlayer:
      typeof overrides?.displayStatChangesAbovePlayer === "boolean"
        ? overrides.displayStatChangesAbovePlayer
        : defaultNh3dClientOptions.displayStatChangesAbovePlayer,
    displayXpGainsAbovePlayer:
      typeof overrides?.displayXpGainsAbovePlayer === "boolean"
        ? overrides.displayXpGainsAbovePlayer
        : defaultNh3dClientOptions.displayXpGainsAbovePlayer,
    tileShakeOnHit:
      typeof overrides?.tileShakeOnHit === "boolean"
        ? overrides.tileShakeOnHit
        : defaultNh3dClientOptions.tileShakeOnHit,
    bloodMist:
      typeof overrides?.bloodMist === "boolean"
        ? overrides.bloodMist
        : typeof legacyBloodEnabled === "boolean"
          ? legacyBloodEnabled
          : defaultNh3dClientOptions.bloodMist,
    bloodGround:
      typeof overrides?.bloodGround === "boolean"
        ? overrides.bloodGround
        : typeof legacyBloodEnabled === "boolean"
          ? legacyBloodEnabled
          : defaultNh3dClientOptions.bloodGround,
    bloodStrength,
    bloodColorLightHex,
    bloodColorDarkHex,
    bloodMistColorHex,
    bloodDetail,
    monsterShatter:
      typeof overrides?.monsterShatter === "boolean"
        ? overrides.monsterShatter
        : defaultNh3dClientOptions.monsterShatter,
    monsterShatterBloodBorders:
      typeof overrides?.monsterShatterBloodBorders === "boolean"
        ? overrides.monsterShatterBloodBorders
        : defaultNh3dClientOptions.monsterShatterBloodBorders,
    liveMessageLog:
      typeof overrides?.liveMessageLog === "boolean"
        ? overrides.liveMessageLog
        : defaultNh3dClientOptions.liveMessageLog,
    showPersistentMobileMessageLog:
      typeof overrides?.showPersistentMobileMessageLog === "boolean"
        ? overrides.showPersistentMobileMessageLog
        : defaultNh3dClientOptions.showPersistentMobileMessageLog,
    rumbleEnabled:
      typeof overrides?.rumbleEnabled === "boolean"
        ? overrides.rumbleEnabled
        : defaultNh3dClientOptions.rumbleEnabled,
    manualMobileBottomSafeZoneEnabled:
      typeof overrides?.manualMobileBottomSafeZoneEnabled === "boolean"
        ? overrides.manualMobileBottomSafeZoneEnabled
        : defaultNh3dClientOptions.manualMobileBottomSafeZoneEnabled,
    manualMobileBottomSafeZoneVerticalPx,
    manualMobileBottomSafeZoneHorizontalPx,
    manualMobileRightSafeZoneHorizontalPx,
    liveMessageDisplayTimeMs,
    liveMessageFadeOutTimeMs,
    showVersionNotificationsOnLaunch:
      typeof overrides?.showVersionNotificationsOnLaunch === "boolean"
        ? overrides.showVersionNotificationsOnLaunch
        : defaultNh3dClientOptions.showVersionNotificationsOnLaunch,
    uiFontScale,
    liveMessageLogFontScale,
    desktopMessageLogWindowScale,
    soundEnabled:
      typeof overrides?.soundEnabled === "boolean"
        ? overrides.soundEnabled
        : defaultNh3dClientOptions.soundEnabled,
    blockAmbientOcclusion:
      typeof overrides?.blockAmbientOcclusion === "boolean"
        ? overrides.blockAmbientOcclusion
        : defaultNh3dClientOptions.blockAmbientOcclusion,
    darkCorridorWalls367:
      typeof overrides?.darkCorridorWalls367 === "boolean"
        ? overrides.darkCorridorWalls367
        : defaultNh3dClientOptions.darkCorridorWalls367,
    overrideNh5DarkCorridorWallTiles:
      typeof overrides?.overrideNh5DarkCorridorWallTiles === "boolean"
        ? overrides.overrideNh5DarkCorridorWallTiles
        : defaultNh3dClientOptions.overrideNh5DarkCorridorWallTiles,
    darkCorridorWallTileOverrideEnabled,
    darkCorridorWallTileOverrideEnabledByTileset,
    darkCorridorWallTileOverrideTileId,
    darkCorridorWallTileOverrideTileIdByTileset,
    darkCorridorWallSolidColorOverrideEnabled,
    darkCorridorWallSolidColorOverrideEnabledByTileset,
    darkCorridorWallSolidColorHex,
    darkCorridorWallSolidColorHexByTileset,
    darkCorridorWallSolidColorHexFps,
    darkCorridorWallSolidColorHexFpsByTileset,
    darkCorridorWallSolidColorGridEnabled,
    darkCorridorWallSolidColorGridEnabledByTileset,
    darkCorridorWallSolidColorGridDarknessPercent,
    darkCorridorWallSolidColorGridDarknessPercentByTileset,
    tilesetBackgroundTileId,
    tilesetBackgroundTileIdByTileset,
    tilesetBackgroundRemovalMode,
    tilesetBackgroundRemovalModeByTileset,
    tilesetSolidChromaKeyColorHex,
    tilesetSolidChromaKeyColorHexByTileset,
    fpsHeldWeaponVisible,
    fpsHeldWeaponSpriteFlipX,
    fpsHeldWeaponSpriteFlipXByTileset,
    tilesetMode,
    tilesetPath,
    antialiasing,
    brightness,
    contrast,
    gamma,
  };
}

export type CharacterCreationConfig = {
  mode: "random" | "create" | "resume";
  playMode?: PlayMode;
  runtimeVersion?: NethackRuntimeVersion;
  name?: string;
  role?: string;
  race?: string;
  gender?: string;
  align?: string;
  initOptions?: string[];
  resumeCategory?: "manual" | "autosave";
};

export interface Nethack3DEngineUIAdapter {
  setStatus(status: string): void;
  setConnectionStatus(status: string, state: NethackConnectionState): void;
  setLoadingVisible(visible: boolean): void;
  setGameMessages(messages: string[]): void;
  pushFloatingMessage(message: string): void;
  setPlayerStats(stats: PlayerStatsSnapshot): void;
  setQuestion(state: QuestionDialogState | null): void;
  setDirectionQuestion(question: string | null): void;
  setNumberPadModeEnabled(enabled: boolean): void;
  setInfoMenu(state: InfoMenuState | null): void;
  setInventory(state: InventoryDialogState): void;
  setTextInput(state: TextInputRequestState | null): void;
  setExtendedCommands(commands: string[]): void;
  setPositionRequest(text: string | null): void;
  setPositionInputActive(active: boolean, origin?: string | null): void;
  setFpsCrosshairContext(state: FpsCrosshairContextState | null): void;
  setRepeatActionVisible(visible: boolean): void;
  setNewGamePrompt(state: NewGamePromptState): void;
  setGameOver(state: GameOverState): void;
}

export interface Nethack3DEngineController {
  dispose(): void;
  sendInput(input: string): void;
  chooseDirection(directionKey: string): void;
  confirmActiveDirectionQuestion(): void;
  chooseQuestionChoice(choice: string): void;
  setQuestionSelectionCount(count: number | null): void;
  stepQuestionSelectionCount(delta: number): void;
  clearQuestionSelectionCount(): void;
  syncQuestionSelectionFocus(selectionInput: string): void;
  syncQuestionActionFocus(
    action: "select-all" | "confirm" | "cancel",
  ): void;
  resolveLegacyQuestionChoicePreviewTileIndex(choice: string): number | null;
  confirmQuestionMenuChoice(): void;
  togglePickupChoice(accelerator: string): void;
  toggleAllPickupChoices(): void;
  goToPreviousQuestionMenuPage(): void;
  goToNextQuestionMenuPage(): void;
  confirmPickupChoices(): void;
  submitTextInput(text: string): void;
  cancelActivePrompt(): void;
  toggleInventoryDialog(): void;
  openCharacterSheet(): void;
  runInventoryItemAction(actionId: string, itemAccelerator: string): void;
  runInventoryItemDropCount(itemAccelerator: string, count: number): void;
  dismissFpsCrosshairContextMenu(): void;
  runQuickAction(
    actionId: string,
    options?: { autoDirectionFromFpsAim?: boolean; submitDelayMs?: number },
  ): void;
  runExtendedCommand(
    commandText: string,
    options?: {
      autoDirectionFromFpsAim?: boolean;
      submitDelayMs?: number;
      forceHashSubmission?: boolean;
    },
  ): void;
  runContextualAction(actionId: string): void;
  repeatLastAction(): void;
  setClientOptions(options: Nh3dClientOptions): void;
  closeInventoryDialog(): void;
  closeInfoMenuDialog(): void;
}

export interface Nethack3DEngineOptions {
  mountElement?: HTMLElement | null;
  uiAdapter: Nethack3DEngineUIAdapter;
  characterCreationConfig?: CharacterCreationConfig;
  clientOptions?: Partial<Nh3dClientOptions>;
  loggingEnabled?: boolean;
}
