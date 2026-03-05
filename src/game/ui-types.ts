import type { NethackRuntimeVersion } from "../runtime/types";
import {
  defaultNh3dTilesetPath,
  isNh3dTilesetPathAvailable,
  resolveDefaultNh3dTilesetBackgroundTileId,
  resolveDefaultNh3dTilesetSolidChromaKeyColorHex,
} from "./tilesets";

export type NethackConnectionState =
  | "disconnected"
  | "starting"
  | "running"
  | "error";

export type NethackMenuItem = {
  text?: string;
  accelerator?: string;
  isCategory?: boolean;
  glyph?: number;
  glyphChar?: string;
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
  dungeon: string;
  dlevel: number;
  gold: number;
  alignment: string;
  hunger: string;
  encumbrance: string;
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
  activePickupSelectionInput?: string | null;
  activeMenuSelectionInput?: string | null;
  activeActionButton?: "confirm" | "cancel" | null;
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
};

export type TextInputRequestState = {
  text: string;
  maxLength?: number;
  placeholder?: string;
};

export type NewGamePromptState = {
  visible: boolean;
  reason: string | null;
};

export type Nh3dVrPointerHand = "left" | "right";
export type XrLaunchMode = "webxr" | "browser-handoff" | "unavailable";
export type XrSessionState =
  | "inactive"
  | "entering"
  | "immersive"
  | "exiting"
  | "handoff";

export type XrAvailabilityState = {
  supported: boolean;
  launchMode: XrLaunchMode;
  directWebXrAvailable: boolean;
  isHeadsetShell: boolean;
  browserHandoffUrl: string | null;
  buttonLabel: string;
  statusText: string;
  usingDomOverlay: boolean;
};

export type FpsContextAction = {
  id: string;
  label: string;
  kind: "quick" | "extended";
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
export type TilesetBackgroundRemovalMode = "tile" | "solid";
export type TilesetBackgroundRemovalModeByTileset = Record<
  string,
  TilesetBackgroundRemovalMode
>;
export type TilesetSolidChromaKeyColorHexByTileset = Record<string, string>;

export type Nh3dClientOptions = {
  fpsMode: boolean;
  vrOfferOnSupportedDevice: boolean;
  vrFollowPlayer: boolean;
  vrShowLevelBoundaries: boolean;
  vrPreferredPointerHand: Nh3dVrPointerHand;
  fpsFov: number;
  fpsLookSensitivityX: number;
  fpsLookSensitivityY: number;
  invertLookYAxis: boolean;
  invertTouchPanningDirection: boolean;
  minimap: boolean;
  minimapScale: number;
  damageNumbers: boolean;
  displayStatChangesAbovePlayer: boolean;
  displayXpGainsAbovePlayer: boolean;
  tileShakeOnHit: boolean;
  blood: boolean;
  monsterShatter: boolean;
  monsterShatterBloodBorders: boolean;
  liveMessageLog: boolean;
  liveMessageDisplayTimeMs: number;
  liveMessageFadeOutTimeMs: number;
  uiFontScale: number;
  liveMessageLogFontScale: number;
  soundEnabled: boolean;
  blockAmbientOcclusion: boolean;
  darkCorridorWalls367: boolean;
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
  tilesetMode: "ascii" | "tiles";
  tilesetPath: string;
  antialiasing: Nh3dAntialiasingMode;
  brightness: number;
  contrast: number;
  gamma: number;
};

export const nh3dFpsLookSensitivityMin = 0.4;
export const nh3dFpsLookSensitivityMax = 2.6;

const isMobilePortrait = window.matchMedia(
  "(orientation: portrait) and (pointer: coarse)",
);
const isMobile = window.matchMedia("(pointer: coarse)");

export const defaultXrAvailabilityState: XrAvailabilityState = {
  supported: false,
  launchMode: "unavailable",
  directWebXrAvailable: false,
  isHeadsetShell: false,
  browserHandoffUrl: null,
  buttonLabel: "VR Unavailable",
  statusText: "VR is unavailable on this device.",
  usingDomOverlay: false,
};

export const defaultNh3dClientOptions: Nh3dClientOptions = {
  fpsMode: false,
  vrOfferOnSupportedDevice: true,
  vrFollowPlayer: true,
  vrShowLevelBoundaries: false,
  vrPreferredPointerHand: "right",
  fpsFov: isMobilePortrait ? 95 : 62,
  fpsLookSensitivityX: isMobile ? 1.5 : 1,
  fpsLookSensitivityY: isMobile ? 1.5 : 1,
  invertLookYAxis: false,
  invertTouchPanningDirection: true,
  minimap: true,
  minimapScale: 1,
  damageNumbers: true,
  displayStatChangesAbovePlayer: true,
  displayXpGainsAbovePlayer: false,
  tileShakeOnHit: true,
  blood: true,
  monsterShatter: true,
  monsterShatterBloodBorders: true,
  liveMessageLog: true,
  liveMessageDisplayTimeMs: 3000,
  liveMessageFadeOutTimeMs: 520,
  uiFontScale: 1,
  liveMessageLogFontScale: 1,
  soundEnabled: true,
  blockAmbientOcclusion: true,
  darkCorridorWalls367: true,
  darkCorridorWallTileOverrideEnabled: false,
  darkCorridorWallTileOverrideEnabledByTileset: {},
  darkCorridorWallTileOverrideTileId: 850,
  darkCorridorWallTileOverrideTileIdByTileset: {
    "assets/3.6/DawnHack.bmp": 872,
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
): TilesetBackgroundRemovalMode {
  return rawValue === "solid" ? "solid" : "tile";
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
    normalized[tilesetPath] = normalizeTilesetBackgroundRemovalMode(rawMode);
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

export function normalizeNh3dClientOptions(
  overrides?: Partial<Nh3dClientOptions> | null,
): Nh3dClientOptions {
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
  const rawMinimapScale =
    typeof overrides?.minimapScale === "number" &&
    Number.isFinite(overrides.minimapScale)
      ? overrides.minimapScale
      : defaultNh3dClientOptions.minimapScale;
  const minimapScale = Number(
    Math.max(0.6, Math.min(2.2, rawMinimapScale)).toFixed(2),
  );
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
  const tilesetBackgroundRemovalMode = normalizeTilesetBackgroundRemovalMode(
    selectedTilesetBackgroundRemovalMode,
  );
  const defaultSolidChromaKeyForTileset =
    resolveDefaultNh3dTilesetSolidChromaKeyColorHex(tilesetPath);
  const tilesetSolidChromaKeyColorHex = normalizeTilesetSolidChromaKeyColorHex(
    selectedTilesetSolidChromaKeyColorHex,
    defaultSolidChromaKeyForTileset,
  );
  return {
    fpsMode:
      typeof overrides?.fpsMode === "boolean"
        ? overrides.fpsMode
        : defaultNh3dClientOptions.fpsMode,
    vrOfferOnSupportedDevice:
      typeof overrides?.vrOfferOnSupportedDevice === "boolean"
        ? overrides.vrOfferOnSupportedDevice
        : defaultNh3dClientOptions.vrOfferOnSupportedDevice,
    vrFollowPlayer:
      typeof overrides?.vrFollowPlayer === "boolean"
        ? overrides.vrFollowPlayer
        : defaultNh3dClientOptions.vrFollowPlayer,
    vrShowLevelBoundaries:
      typeof overrides?.vrShowLevelBoundaries === "boolean"
        ? overrides.vrShowLevelBoundaries
        : defaultNh3dClientOptions.vrShowLevelBoundaries,
    vrPreferredPointerHand:
      overrides?.vrPreferredPointerHand === "left" ? "left" : "right",
    fpsFov,
    fpsLookSensitivityX,
    fpsLookSensitivityY,
    invertLookYAxis:
      typeof overrides?.invertLookYAxis === "boolean"
        ? overrides.invertLookYAxis
        : defaultNh3dClientOptions.invertLookYAxis,
    invertTouchPanningDirection:
      typeof overrides?.invertTouchPanningDirection === "boolean"
        ? overrides.invertTouchPanningDirection
        : defaultNh3dClientOptions.invertTouchPanningDirection,
    minimap:
      typeof overrides?.minimap === "boolean"
        ? overrides.minimap
        : defaultNh3dClientOptions.minimap,
    minimapScale,
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
    blood:
      typeof overrides?.blood === "boolean"
        ? overrides.blood
        : defaultNh3dClientOptions.blood,
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
    liveMessageDisplayTimeMs,
    liveMessageFadeOutTimeMs,
    uiFontScale,
    liveMessageLogFontScale,
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
    tilesetMode,
    tilesetPath,
    antialiasing,
    brightness,
    contrast,
    gamma,
  };
}

export type CharacterCreationConfig = {
  mode: "random" | "create";
  playMode?: PlayMode;
  runtimeVersion?: NethackRuntimeVersion;
  name?: string;
  role?: string;
  race?: string;
  gender?: string;
  align?: string;
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
  setFpsCrosshairContext(state: FpsCrosshairContextState | null): void;
  setRepeatActionVisible(visible: boolean): void;
  setNewGamePrompt(state: NewGamePromptState): void;
  setGameOver(state: GameOverState): void;
  setXrAvailability(state: XrAvailabilityState): void;
  setXrSessionState(state: XrSessionState): void;
  setVrQuickPanelVisible(visible: boolean): void;
}

export interface Nethack3DEngineController {
  sendInput(input: string): void;
  chooseDirection(directionKey: string): void;
  chooseQuestionChoice(choice: string): void;
  confirmQuestionMenuChoice(): void;
  togglePickupChoice(accelerator: string): void;
  goToPreviousQuestionMenuPage(): void;
  goToNextQuestionMenuPage(): void;
  confirmPickupChoices(): void;
  submitTextInput(text: string): void;
  cancelActivePrompt(): void;
  toggleInventoryDialog(): void;
  runInventoryItemAction(actionId: string, itemAccelerator: string): void;
  dismissFpsCrosshairContextMenu(): void;
  runQuickAction(
    actionId: string,
    options?: { autoDirectionFromFpsAim?: boolean; submitDelayMs?: number },
  ): void;
  runExtendedCommand(
    commandText: string,
    options?: { autoDirectionFromFpsAim?: boolean; submitDelayMs?: number },
  ): void;
  repeatLastAction(): void;
  setClientOptions(options: Nh3dClientOptions): void;
  closeInventoryDialog(): void;
  closeInfoMenuDialog(): void;
  enterVr(): Promise<void>;
  exitVr(): Promise<void>;
  toggleVr(): Promise<void>;
  toggleVrQuickPanel(): void;
  destroy(): void;
}

export interface Nethack3DEngineOptions {
  mountElement?: HTMLElement | null;
  vrDomOverlayRoot?: HTMLElement | null;
  uiAdapter: Nethack3DEngineUIAdapter;
  characterCreationConfig?: CharacterCreationConfig;
  clientOptions?: Partial<Nh3dClientOptions>;
  loggingEnabled?: boolean;
}
