import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Nethack3DEngine } from "../game";
import type {
  CharacterCreationConfig,
  FpsCrosshairContextState,
  InfoMenuState,
  Nh3dClientOptions,
  NethackMenuItem,
  PlayerStatsSnapshot,
} from "../game/ui-types";
import {
  nh3dCloseControllerActionWheelEventName,
  nh3dCloseInventoryContextMenuEventName,
  defaultNh3dClientOptions,
  nh3dOpenCharacterSheetEventName,
  nh3dFpsLookSensitivityMax,
  nh3dFpsLookSensitivityMin,
  nh3dToggleControllerActionWheelEventName,
  normalizeNh3dClientOptions,
} from "../game/ui-types";
import {
  createAxisBinding,
  createButtonBinding,
  defaultNh3dControllerBindings,
  formatNh3dControllerBindingLabel,
  nh3dControllerActionGroupLabels,
  nh3dControllerActionSpecsByGroup,
  normalizeNh3dControllerBindings,
  parseNh3dControllerBinding,
  type Nh3dControllerActionId,
  type Nh3dControllerActionGroupId,
  type Nh3dControllerBinding,
  type Nh3dControllerBindings,
} from "../game/controller-bindings";
import { registerDebugHelpers } from "../app";
import { createEngineUiAdapter } from "../state/engineUiAdapter";
import { defaultPlayerStats, useGameStore } from "../state/gameStore";
import {
  Nh3dIcon,
  Nh3dIconArrowDown,
  Nh3dIconArrowUp,
} from "./icons";
import { MobileDismissButton } from "./MobileDismissButton";
import type { NethackRuntimeVersion } from "../runtime/types";
import {
  appendRequiredStartupInitOptionTokens,
  createDefaultStartupInitOptionValues,
  sanitizeStartupInitOptionTokens,
  serializeStartupInitOptionTokens,
  type StartupInitOptionValue,
  type StartupInitOptionValues,
} from "../runtime/startup-init-options";
import { supportsRuntimeCheckpointRecovery } from "../runtime/runtime-capabilities";
import {
  resolveRuntimeSaveDbNames,
  getStoredFileByteLength,
  isRecoverableCheckpointLevelZeroByteLength,
} from "../runtime/save-storage";
import {
  findNh3dTilesetByPath,
  getNh3dTilesetAtlasTileColumns,
  getNh3dCompatibleTilesetCatalog,
  inferNh3dTilesetTileSizeFromAtlasWidthForPath,
  isNh3dTilesetPathAvailable,
  isNh3dTilesetBackgroundRemovalModeForcedOff,
  getNh3dUserTilesetPath,
  resolveNh3dCompatibleTilesetPathForRuntime,
  resolveDefaultNh3dTilesetBackgroundTileId,
  resolveDefaultNh3dTilesetBackgroundRemovalMode,
  resolveDefaultNh3dTilesetSolidChromaKeyColorHex,
  resolveDefaultNh3dTilesetWeaponSpriteFlipX,
  resolveNh3dTilesetAssetUrl,
  setNh3dUserTilesets,
  type Nh3dTilesetEntry,
  type Nh3dTilesetTileLayoutVersion,
} from "../game/tilesets";
import {
  shouldTranslateNh367TilesetForNh5Runtime,
  translateNh5TileIndexToNh367,
} from "../game/tileset-367-to-5-translation";
import {
  deleteStoredUserTileset,
  listStoredUserTilesets,
  saveStoredUserTileset,
  type StoredUserTilesetRecord,
  type StoredUserTilesetTileLayoutVersion,
} from "../game/user-tileset-storage";
import {
  loadPersistedNh3dClientOptionsWithMigration,
  loadPersistedNh3dStartupCharacterPreferences,
  loadPersistedNh3dStartupInitOptions,
  persistNh3dClientOptionsToIndexedDb,
  persistNh3dStartupCharacterPreferencesToIndexedDb,
  persistNh3dStartupInitOptionsToIndexedDb,
  type StartupCharacterPreferences,
  type StartupCharacterPreferencesByRuntime,
} from "../storage/client-options-storage";
import { getGlyphCatalogEntriesForVersion } from "../game/glyphs/registry";
import {
  checkForNh3dGitHubVersionUpdates,
  getNh3dGitHubReleasesPageUrl,
} from "../update/github-version-checker";
import type { Nh3dVersionCheckResult } from "../update/types";
import { resetNh3dDefaultSoundPackVolumeLevelsToDefaults } from "../audio/sound-pack-storage";
import SoundPackSettings, {
  type SoundPackDialogActions,
} from "./SoundPackSettings";
import { CastSpellMenu, parseCastSpellMenu } from "./modals/cast-menu";
import { TechniqueMenu, parseTechniqueMenu } from "./modals/technique-menu";
import { useConfirmationDialog } from "./modals/useConfirmationDialog";
import StartupInitOptionsAccordion from "./componenets/StartupInitOptionsAccordion";
import ConfirmationModal from "./modals/ConfirmationModal";
import AnimatedDialog from "./modals/AnimatedDialog";
import { setLoggingEnabled } from "../logging";
import {
  clearDebugSessionLogs,
  enableDebugSessionLogCapture,
  formatDebugSessionLogSession,
  readDebugSessionLogs,
  recordDebugSessionLogEvent,
  type DebugSessionLogSession,
} from "../debug-session-log";
import {
  normalizeStartupCreateCharacterSelection,
  pickRandomStartupCreateCharacterSelection,
  resolveStartupCreateCharacterOptionSet,
} from "../game/helpers/startup-character-constraints";
import {
  CharacterSheetStatKey,
  parseCharacterSheetInfoMenu,
  resolveCharacterCommandActions,
} from "./modals/character-sheet";
import { parseEnhanceMenu, type EnhanceMenuData } from "./modals/enhance-menu";
import {
  getCurrentLocale,
  getSupportedLocaleOptions,
  getTranslationStrings,
  resolveSupportedLocale,
  setCurrentLocale,
} from "../i18n/core";
import type { GlyphCatalogEntry } from "../game/glyphs/types";

type CoreStatKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma"
  | "armor";

type CoreStatSnapshot = {
  turn: number;
  playerName: string;
  values: Record<CoreStatKey, number>;
};

type StatusSeverity = "good" | "warning" | "danger";

type PlayerStatusBadge = {
  label: string;
  severity: StatusSeverity;
};

const translationStrings = getTranslationStrings();
const commonStrings = translationStrings.common;
const t = translationStrings.app;
const supportedLocaleOptions = getSupportedLocaleOptions();
const messageInfoMenuCacheLimit = 50;

function UpdateReleaseNotesMarkdown({
  markdown,
}: {
  markdown: string;
}): JSX.Element {
  return (
    <div className="nh3d-startup-update-release-notes">
      <ReactMarkdown
        components={{
          a: ({ ...props }) => (
            <a {...props} rel="noreferrer" target="_blank" />
          ),
        }}
        remarkPlugins={[remarkGfm]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

type MessageInfoMenuHistoryState = {
  entries: InfoMenuState[];
  index: number;
};

function isNetHackMessageInfoMenuTitle(
  title: string | null | undefined,
): boolean {
  return String(title ?? "").trim().toLowerCase() === "nethack message";
}

function getInfoMenuHistoryEntryKey(menu: InfoMenuState): string {
  return JSON.stringify([
    String(menu.title ?? "").trim(),
    Array.isArray(menu.lines) ? menu.lines : [],
  ]);
}

function resolveTilesetLayoutShortLabel(
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
    case "evilhack":
      return "EvilHack";
    default:
      return "unknown";
  }
}

function resolveTilesetLayoutDisplayLabel(
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
    case "evilhack":
      return "EvilHack layout";
    default:
      return "Unknown layout";
  }
}

function resolveRuntimeVersionDisplayLabel(
  runtimeVersion: NethackRuntimeVersion,
): string {
  switch (runtimeVersion) {
    case "5.0":
      return "NetHack 5.0";
    case "slashem":
      return "Slash'EM";
    case "evilhack":
      return "EvilHack 0.9.3";
    case "3.6.7":
    default:
      return "NetHack 3.6.7";
  }
}

const startupMenuRainAlphabet = [
  "@",
  "#",
  "$",
  "%",
  "&",
  "*",
  "+",
  "!",
  "?",
  "/",
  "\\",
  "[",
  "]",
  "{",
  "}",
  "<",
  ">",
  "|",
  "_",
  "~",
  "=",
  ":",
  ";",
  ".",
  ",",
  ")",
  "(",
  "d",
  "D",
  "g",
  "h",
  "k",
  "m",
  "o",
  "r",
  "s",
  "u",
  "w",
  "x",
  "y",
  "z",
  "B",
  "E",
  "F",
  "H",
  "K",
  "L",
  "N",
  "P",
  "R",
  "S",
  "T",
  "V",
] as const;

type StartupMenuRainGlyphFrame = {
  char: string;
  delayMs: number;
  durationMs: number;
};

type StartupMenuRainParticle = {
  blurPx: number;
  delayMs: number;
  durationMs: number;
  fontSizePx: number;
  glyphFrames: readonly StartupMenuRainGlyphFrame[];
  leftPercent: number;
  opacity: number;
};

function createStartupMenuRainParticles(): readonly StartupMenuRainParticle[] {
  let seed = 0x3d6b4f21;
  const next = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  return Array.from({ length: 72 }, () => {
    const durationMs = 14000 + Math.round(next() * 12000);
    const glyphFrameCount = 4;
    const glyphChangeIntervalMs = 5000 + Math.round(next() * 2200);
    const glyphCycleDurationMs = glyphChangeIntervalMs * glyphFrameCount;
    const glyphPhaseOffsetMs = -Math.round(next() * glyphCycleDurationMs);
    const glyphFrames = Array.from({ length: glyphFrameCount }, (_, index) => ({
      char: startupMenuRainAlphabet[
        Math.floor(next() * startupMenuRainAlphabet.length)
      ],
      delayMs: glyphPhaseOffsetMs + index * glyphChangeIntervalMs,
      durationMs: glyphCycleDurationMs,
    }));

    return {
      blurPx: next() > 0.76 ? Number((0.5 + next() * 0.9).toFixed(2)) : 0,
      delayMs: -Math.round(next() * durationMs),
      durationMs,
      fontSizePx: (13 + Math.round(next() * 8)) * 2.5,
      glyphFrames,
      leftPercent: Number((-4 + next() * 108).toFixed(3)),
      opacity: Number((0.18 + next() * 0.36).toFixed(3)),
    };
  });
}

const startupMenuRainParticles = createStartupMenuRainParticles();

function RuntimeVersionBadge({
  label,
  startup = false,
}: {
  label: string;
  startup?: boolean;
}): JSX.Element {
  return (
    <div
      className={`nh3d-dialog-context-label${
        startup ? " nh3d-dialog-context-label-startup" : ""
      }`}
    >
      <span className="nh3d-dialog-context-label-text">{label}</span>
    </div>
  );
}

function formatTilesetPickerOptionLabel(
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

const nh3dAppVersion =
  typeof import.meta.env.VITE_NH3D_APP_VERSION === "string" &&
  import.meta.env.VITE_NH3D_APP_VERSION.trim()
    ? import.meta.env.VITE_NH3D_APP_VERSION.trim()
    : "0.0.0";

const nh3dBuildCommitSha =
  typeof import.meta.env.VITE_NH3D_BUILD_COMMIT_SHA === "string"
    ? import.meta.env.VITE_NH3D_BUILD_COMMIT_SHA.trim()
    : "";

const nh3dBuildLabel = nh3dBuildCommitSha
  ? `v${nh3dAppVersion} (${nh3dBuildCommitSha.slice(0, 7)})`
  : `v${nh3dAppVersion}`;

const nh3dBuildLabelDebugEnableClickCount = 10;
const emptyGlyphCatalogEntries: readonly GlyphCatalogEntry[] = [];

function formatDebugSessionLogTimestamp(value: string): string {
  if (!value) {
    return t.unknownTime;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function describeDebugSessionLogSession(
  session: DebugSessionLogSession,
): string {
  const closeReason =
    session.closeReason === "abrupt-stop"
      ? t.debugSession.possibleCrash
      : session.closeReason === "active"
        ? t.debugSession.active
        : session.closeReason.replace(/-/g, " ");
  return `${formatDebugSessionLogTimestamp(session.startedAt)} - ${closeReason}`;
}

const playerConditionStatusDefinitions367: ReadonlyArray<{
  mask: number;
  label: string;
  severity: StatusSeverity;
}> = [
  {
    mask: 0x00000001,
    label: t.statusEffects.turningToStone,
    severity: "danger",
  },
  { mask: 0x00000002, label: t.statusEffects.slimed, severity: "danger" },
  {
    mask: 0x00000004,
    label: t.statusEffects.strangled,
    severity: "danger",
  },
  {
    mask: 0x00000008,
    label: t.statusEffects.foodPoisoning,
    severity: "danger",
  },
  {
    mask: 0x00000010,
    label: t.statusEffects.terminallyIll,
    severity: "danger",
  },
  { mask: 0x00000020, label: t.statusEffects.blind, severity: "warning" },
  { mask: 0x00000040, label: t.statusEffects.deaf, severity: "warning" },
  { mask: 0x00000080, label: t.statusEffects.stunned, severity: "warning" },
  { mask: 0x00000100, label: t.statusEffects.confused, severity: "warning" },
  {
    mask: 0x00000200,
    label: t.statusEffects.hallucinating,
    severity: "warning",
  },
  {
    mask: 0x00000400,
    label: t.statusEffects.levitating,
    severity: "good",
  },
  { mask: 0x00000800, label: t.statusEffects.flying, severity: "good" },
  { mask: 0x00001000, label: t.statusEffects.riding, severity: "good" },
];

const playerConditionStatusDefinitions5: ReadonlyArray<{
  mask: number;
  label: string;
  severity: StatusSeverity;
}> = [
  {
    mask: 0x00000001,
    label: t.statusEffects.barehanded,
    severity: "warning",
  },
  { mask: 0x00000002, label: t.statusEffects.blind, severity: "warning" },
  { mask: 0x00000004, label: t.statusEffects.busy, severity: "warning" },
  { mask: 0x00000008, label: t.statusEffects.confused, severity: "warning" },
  { mask: 0x00000010, label: t.statusEffects.deaf, severity: "warning" },
  { mask: 0x00000020, label: t.statusEffects.iron, severity: "warning" },
  { mask: 0x00000040, label: t.statusEffects.flying, severity: "good" },
  {
    mask: 0x00000080,
    label: t.statusEffects.foodPoisoning,
    severity: "danger",
  },
  {
    mask: 0x00000100,
    label: t.statusEffects.glowingHands,
    severity: "warning",
  },
  { mask: 0x00000200, label: t.statusEffects.grabbed, severity: "danger" },
  {
    mask: 0x00000400,
    label: t.statusEffects.hallucinating,
    severity: "warning",
  },
  { mask: 0x00000800, label: t.statusEffects.held, severity: "warning" },
  { mask: 0x00001000, label: t.statusEffects.icy, severity: "warning" },
  { mask: 0x00002000, label: t.statusEffects.inLava, severity: "danger" },
  {
    mask: 0x00004000,
    label: t.statusEffects.levitating,
    severity: "good",
  },
  {
    mask: 0x00008000,
    label: t.statusEffects.paralyzed,
    severity: "danger",
  },
  { mask: 0x00010000, label: t.statusEffects.riding, severity: "good" },
  { mask: 0x00020000, label: t.statusEffects.sleeping, severity: "warning" },
  { mask: 0x00040000, label: t.statusEffects.slimed, severity: "danger" },
  { mask: 0x00080000, label: t.statusEffects.slippery, severity: "warning" },
  {
    mask: 0x00100000,
    label: t.statusEffects.turningToStone,
    severity: "danger",
  },
  {
    mask: 0x00200000,
    label: t.statusEffects.strangled,
    severity: "danger",
  },
  { mask: 0x00400000, label: t.statusEffects.stunned, severity: "warning" },
  { mask: 0x00800000, label: t.statusEffects.submerged, severity: "warning" },
  {
    mask: 0x01000000,
    label: t.statusEffects.terminallyIll,
    severity: "danger",
  },
  { mask: 0x02000000, label: t.statusEffects.tethered, severity: "warning" },
  { mask: 0x04000000, label: t.statusEffects.trapped, severity: "warning" },
  {
    mask: 0x08000000,
    label: t.statusEffects.unconscious,
    severity: "danger",
  },
  {
    mask: 0x10000000,
    label: t.statusEffects.woundedLegs,
    severity: "warning",
  },
  { mask: 0x20000000, label: t.statusEffects.holding, severity: "warning" },
];

const playerConditionStatusDefinitionsSlashEm: ReadonlyArray<{
  mask: number;
  label: string;
  severity: StatusSeverity;
}> = [
  {
    mask: 0x00000001,
    label: t.statusEffects.levitating,
    severity: "good",
  },
  { mask: 0x00000002, label: t.statusEffects.confused, severity: "warning" },
  {
    mask: 0x00000004,
    label: t.statusEffects.foodPoisoning,
    severity: "danger",
  },
  {
    mask: 0x00000008,
    label: t.statusEffects.terminallyIll,
    severity: "danger",
  },
  { mask: 0x00000010, label: t.statusEffects.blind, severity: "warning" },
  { mask: 0x00000020, label: t.statusEffects.stunned, severity: "warning" },
  {
    mask: 0x00000040,
    label: t.statusEffects.hallucinating,
    severity: "warning",
  },
  { mask: 0x00000080, label: t.statusEffects.slimed, severity: "danger" },
  { mask: 0x00000100, label: t.statusEffects.held, severity: "warning" },
];

function resolveHungerStatusBadge(
  rawHunger: unknown,
): PlayerStatusBadge | null {
  const label = String(rawHunger || "").trim();
  if (!label) {
    return null;
  }
  const normalized = label.toLowerCase();
  if (normalized === "not hungry") {
    return null;
  }
  if (normalized === "satiated") {
    return { label, severity: "good" };
  }
  if (normalized === "hungry") {
    return { label, severity: "warning" };
  }
  if (
    normalized === "weak" ||
    normalized === "fainting" ||
    normalized === "fainted" ||
    normalized === "starved"
  ) {
    return { label, severity: "danger" };
  }
  return { label, severity: "warning" };
}

function resolveEncumbranceStatusBadge(
  rawEncumbrance: unknown,
): PlayerStatusBadge | null {
  const label = String(rawEncumbrance || "").trim();
  if (!label) {
    return null;
  }
  const normalized = label.toLowerCase();
  if (normalized.includes("unencumbered")) {
    return { label, severity: "good" };
  }
  if (normalized.includes("burdened") || normalized.includes("stressed")) {
    return { label, severity: "warning" };
  }
  if (
    normalized.includes("strained") ||
    normalized.includes("overtaxed") ||
    normalized.includes("overloaded")
  ) {
    return { label, severity: "danger" };
  }
  return { label, severity: "warning" };
}

function resolveConditionStatusDefinitions(
  runtimeVersion: NethackRuntimeVersion,
): ReadonlyArray<{
  mask: number;
  label: string;
  severity: StatusSeverity;
}> {
  return runtimeVersion === "5.0"
    ? playerConditionStatusDefinitions5
    : runtimeVersion === "slashem"
      ? playerConditionStatusDefinitionsSlashEm
      : playerConditionStatusDefinitions367;
}

function resolveConditionStatusBadges(
  rawMask: unknown,
  runtimeVersion: NethackRuntimeVersion,
): PlayerStatusBadge[] {
  const conditionMask =
    typeof rawMask === "number" && Number.isFinite(rawMask)
      ? Math.trunc(rawMask) >>> 0
      : 0;
  if (conditionMask === 0) {
    return [];
  }
  const definitions = resolveConditionStatusDefinitions(runtimeVersion);
  return definitions
    .filter((entry) => (conditionMask & entry.mask) !== 0)
    .map((entry) => ({
      label: entry.label,
      severity: entry.severity,
    }));
}

function resolveConditionStatusLinePatterns(
  runtimeVersion: NethackRuntimeVersion,
  mask: number,
): readonly RegExp[] {
  if (runtimeVersion === "5.0") {
    switch (mask >>> 0) {
      case 0x00000001:
        return [/\bbare[- ]handed\b/i];
      case 0x00000002:
        return [/\bblind\b/i];
      case 0x00000004:
        return [/\bbusy\b/i];
      case 0x00000008:
        return [/\bconfused\b/i];
      case 0x00000010:
        return [/\bdeaf\b/i];
      case 0x00000020:
        return [/\biron ball\b/i, /\bchained\b/i];
      case 0x00000040:
        return [/\bcan fly\b/i, /\bflying\b/i];
      case 0x00000080:
        return [/\bfood poison(?:ing|ed)?\b/i];
      case 0x00000100:
        return [/\bglowing hands?\b/i];
      case 0x00000200:
        return [/\bgrabbed\b/i];
      case 0x00000400:
        return [/\bhallucinat(?:ing|ion)\b/i];
      case 0x00000800:
        return [/\bheld\b/i];
      case 0x00001000:
        return [/\bicy\b/i];
      case 0x00002000:
        return [/\bin lava\b/i, /\blava\b/i];
      case 0x00004000:
        return [/\blevitat(?:ing|ion)\b/i];
      case 0x00008000:
        return [/\bparaly[sz]ed\b/i];
      case 0x00010000:
        return [/\briding\b/i];
      case 0x00020000:
        return [/\bsleeping\b/i, /\basleep\b/i];
      case 0x00040000:
        return [/\bslim(?:ed|ing)\b/i];
      case 0x00080000:
        return [/\bslippery\b/i];
      case 0x00100000:
        return [/\bturn(?:ing)? to stone\b/i, /\bpetrif(?:y|ied|ying)\b/i];
      case 0x00200000:
        return [/\bstrangl(?:ed|ing)\b/i];
      case 0x00400000:
        return [/\bstunned\b/i];
      case 0x00800000:
        return [/\bsubmerged\b/i];
      case 0x01000000:
        return [/\bterminally ill\b/i];
      case 0x02000000:
        return [/\btethered\b/i];
      case 0x04000000:
        return [/\btrapped\b/i];
      case 0x08000000:
        return [/\bunconscious\b/i];
      case 0x10000000:
        return [/\bwounded legs?\b/i, /\blimping\b/i];
      case 0x20000000:
        return [/\bholding\b/i];
      default:
        return [];
    }
  }

  if (runtimeVersion === "slashem") {
    switch (mask >>> 0) {
      case 0x00000001:
        return [/\blevitat(?:ing|ion)\b/i];
      case 0x00000002:
        return [/\bconfused\b/i];
      case 0x00000004:
        return [/\bfood poison(?:ing|ed)?\b/i];
      case 0x00000008:
        return [/\bterminally ill\b/i];
      case 0x00000010:
        return [/\bblind\b/i];
      case 0x00000020:
        return [/\bstunned\b/i];
      case 0x00000040:
        return [/\bhallucinat(?:ing|ion)\b/i];
      case 0x00000080:
        return [/\bslim(?:ed|ing)\b/i];
      case 0x00000100:
        return [/\bheld\b/i];
      default:
        return [];
    }
  }

  switch (mask >>> 0) {
    case 0x00000001:
      return [/\bturn(?:ing)? to stone\b/i, /\bpetrif(?:y|ied|ying)\b/i];
    case 0x00000002:
      return [/\bslim(?:ed|ing)\b/i];
    case 0x00000004:
      return [/\bstrangl(?:ed|ing)\b/i];
    case 0x00000008:
      return [/\bfood poison(?:ing|ed)?\b/i];
    case 0x00000010:
      return [/\bterminally ill\b/i];
    case 0x00000020:
      return [/\bblind\b/i];
    case 0x00000040:
      return [/\bdeaf\b/i];
    case 0x00000080:
      return [/\bstunned\b/i];
    case 0x00000100:
      return [/\bconfused\b/i];
    case 0x00000200:
      return [/\bhallucinat(?:ing|ion)\b/i];
    case 0x00000400:
      return [/\blevitat(?:ing|ion)\b/i];
    case 0x00000800:
      return [/\bcan fly\b/i, /\bflying\b/i];
    case 0x00001000:
      return [/\briding\b/i];
    default:
      return [];
  }
}

function resolveHungerStatusLineSeverity(
  line: string,
  rawHunger: unknown,
): StatusSeverity | null {
  const badge = resolveHungerStatusBadge(rawHunger);
  if (!badge) {
    return null;
  }

  const normalizedHunger = String(rawHunger || "")
    .trim()
    .toLowerCase();
  let pattern: RegExp | null = null;
  switch (normalizedHunger) {
    case "satiated":
      pattern = /\bsatiated\b/i;
      break;
    case "hungry":
      pattern = /\bhungry\b/i;
      break;
    case "weak":
      pattern = /\bweak\b/i;
      break;
    case "fainting":
      pattern = /\bfainting\b/i;
      break;
    case "fainted":
      pattern = /\bfainted\b/i;
      break;
    case "starved":
      pattern = /\bstarved\b/i;
      break;
    default:
      pattern = normalizedHunger ? new RegExp(`\\b${normalizedHunger}\\b`, "i") : null;
      break;
  }

  return pattern && pattern.test(line) ? badge.severity : null;
}

function resolveEncumbranceStatusLineSeverity(
  line: string,
  rawEncumbrance: unknown,
): StatusSeverity | null {
  const badge = resolveEncumbranceStatusBadge(rawEncumbrance);
  if (!badge) {
    return null;
  }

  const normalizedEncumbrance = String(rawEncumbrance || "")
    .trim()
    .toLowerCase();
  let pattern: RegExp | null = null;
  if (normalizedEncumbrance.includes("unencumbered")) {
    pattern = /\bunencumbered\b/i;
  } else if (normalizedEncumbrance.includes("burdened")) {
    pattern = /\bburdened\b/i;
  } else if (normalizedEncumbrance.includes("stressed")) {
    pattern = /\bstressed\b/i;
  } else if (normalizedEncumbrance.includes("strained")) {
    pattern = /\bstrained\b/i;
  } else if (normalizedEncumbrance.includes("overtaxed")) {
    pattern = /\bovertaxed\b/i;
  } else if (normalizedEncumbrance.includes("overloaded")) {
    pattern = /\boverloaded\b/i;
  }

  return pattern && pattern.test(line) ? badge.severity : null;
}

function resolveConditionStatusLineSeverity(
  line: string,
  rawMask: unknown,
  runtimeVersion: NethackRuntimeVersion,
): StatusSeverity | null {
  const conditionMask =
    typeof rawMask === "number" && Number.isFinite(rawMask)
      ? Math.trunc(rawMask) >>> 0
      : 0;
  if (conditionMask === 0) {
    return null;
  }

  for (const definition of resolveConditionStatusDefinitions(runtimeVersion)) {
    if ((conditionMask & definition.mask) === 0) {
      continue;
    }
    const patterns = resolveConditionStatusLinePatterns(
      runtimeVersion,
      definition.mask,
    );
    if (patterns.some((pattern) => pattern.test(line))) {
      return definition.severity;
    }
  }

  return null;
}

function resolveCharacterStatusLineSeverity(
  line: string,
  stats: PlayerStatsSnapshot,
  runtimeVersion: NethackRuntimeVersion,
): StatusSeverity | null {
  const normalizedLine = String(line || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalizedLine) {
    return null;
  }

  return (
    resolveHungerStatusLineSeverity(normalizedLine, stats.hunger) ??
    resolveEncumbranceStatusLineSeverity(normalizedLine, stats.encumbrance) ??
    resolveConditionStatusLineSeverity(
      normalizedLine,
      stats.conditionMask,
      runtimeVersion,
    )
  );
}

function buildPlayerStatusBadges(
  stats: PlayerStatsSnapshot,
  runtimeVersion: NethackRuntimeVersion,
): PlayerStatusBadge[] {
  const badges: PlayerStatusBadge[] = [];
  const seen = new Set<string>();
  const pushUnique = (badge: PlayerStatusBadge | null): void => {
    if (!badge) {
      return;
    }
    const key = badge.label.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    badges.push(badge);
  };

  pushUnique(resolveHungerStatusBadge(stats.hunger));
  pushUnique(resolveEncumbranceStatusBadge(stats.encumbrance));
  for (const badge of resolveConditionStatusBadges(
    stats.conditionMask,
    runtimeVersion,
  )) {
    pushUnique(badge);
  }
  return badges;
}

const trackedCoreStatKeys: CoreStatKey[] = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
  "armor",
];

const characterStatDescriptionById: Record<CharacterSheetStatKey, string> = {
  strength: t.characterStats.descriptions.strength,
  dexterity: t.characterStats.descriptions.dexterity,
  constitution: t.characterStats.descriptions.constitution,
  intelligence: t.characterStats.descriptions.intelligence,
  wisdom: t.characterStats.descriptions.wisdom,
  charisma: t.characterStats.descriptions.charisma,
};

const armorClassDescription = t.characterStats.armorClassDescription;

const maxExperienceLevel = 30;

function getExperienceThresholdForLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return 0;
  }
  const normalizedLevel = Math.trunc(level);
  if (normalizedLevel < 1) {
    return 0;
  }
  if (normalizedLevel < 10) {
    return 10 * (1 << normalizedLevel);
  }
  if (normalizedLevel < 20) {
    return 10000 * (1 << (normalizedLevel - 10));
  }
  return 10000000 * (normalizedLevel - 19);
}

function formatCharacterNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Math.max(0, Math.trunc(value)).toLocaleString("en-US");
}

type CharacterSheetFieldRow = {
  label: string;
  value: string;
  badges: string[];
};

type CharacterSheetFieldRenderOptions = {
  showBadges?: boolean;
  highlightCurrent?: boolean;
};

function normalizeCharacterSheetFieldBadges(note: string): string[] {
  const normalized = String(note || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return [];
  }

  if (/^[sc](\s*,\s*[sc])*$/.test(normalized)) {
    return normalized
      .split(",")
      .map((token) => token.trim())
      .filter((token, index, array) => array.indexOf(token) === index)
      .map((token) =>
        token === "s" ? "Starting" : token === "c" ? "Current" : token,
      );
  }

  return [note.trim()];
}

function parseCharacterSheetFieldRow(
  line: string,
): CharacterSheetFieldRow | null {
  const normalized = String(line || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return null;
  }
  const match = normalized.match(/^([^:]+):\s*(.+)$/);
  if (!match || !match[1] || !match[2]) {
    return null;
  }

  let value = match[2].trim();
  let badges: string[] = [];
  const noteMatch = value.match(/^(.*?)(?:\s+\(([^()]+)\))$/);
  if (noteMatch && noteMatch[1]) {
    value = noteMatch[1].trim();
    badges = normalizeCharacterSheetFieldBadges(noteMatch[2] || "");
  }

  return {
    label: match[1].trim(),
    value,
    badges,
  };
}

function renderCharacterSheetFieldRows(
  lines: string[],
  keyPrefix: string,
  options: CharacterSheetFieldRenderOptions = {},
): JSX.Element {
  const showBadges = options.showBadges === true;
  const highlightCurrent = options.highlightCurrent === true;
  return (
    <div className="nh3d-character-field-list">
      {lines.map((line, index) => {
        const parsed = parseCharacterSheetFieldRow(line);
        if (!parsed) {
          return (
            <div className="nh3d-character-line" key={`${keyPrefix}-${index}`}>
              {line}
            </div>
          );
        }
        const isCurrent = highlightCurrent && parsed.badges.includes("Current");
        return (
          <div
            className={`nh3d-character-field-row${
              isCurrent ? " is-current" : ""
            }`}
            key={`${keyPrefix}-${index}`}
          >
            <div className="nh3d-character-field-label">{parsed.label}</div>
            <div className="nh3d-character-field-value-group">
              <span className="nh3d-character-field-value">{parsed.value}</span>
              {showBadges
                ? parsed.badges.map((badge) => (
                    <span
                      className="nh3d-character-field-badge"
                      key={`${keyPrefix}-${index}-${badge}`}
                    >
                      {badge}
                    </span>
                  ))
                : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getLegacyCharacterStatValue(
  id: CharacterSheetStatKey,
  stats: PlayerStatsSnapshot,
): string | null {
  const valueById: Record<CharacterSheetStatKey, unknown> = {
    strength: stats.strength,
    dexterity: stats.dexterity,
    constitution: stats.constitution,
    intelligence: stats.intelligence,
    wisdom: stats.wisdom,
    charisma: stats.charisma,
  };
  const rawValue = valueById[id];
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return String(Math.trunc(rawValue));
  }
  const normalized = String(rawValue ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function renderEnhanceMenuContent(
  enhanceMenuData: EnhanceMenuData,
  options: {
    activeMenuSelectionInput?: string | null;
    onChooseSelectionInput?: ((selectionInput: string) => void) | null;
    onFocusSelectionInput?: ((selectionInput: string) => void) | null;
  } = {},
): JSX.Element {
  const activeMenuSelectionInput = options.activeMenuSelectionInput ?? null;
  const onChooseSelectionInput = options.onChooseSelectionInput ?? null;
  const onFocusSelectionInput = options.onFocusSelectionInput ?? null;
  return (
    <div className="nh3d-enhance-menu">
      <div className="nh3d-enhance-summary">
        <span className="nh3d-enhance-summary-chip is-available">
          {translationStrings.enhanceMenu.summary.available(
            enhanceMenuData.availableCount,
          )}
        </span>
        <span className="nh3d-enhance-summary-chip is-gated">
          {translationStrings.enhanceMenu.summary.gated(
            enhanceMenuData.needsExperienceCount,
          )}
        </span>
        <span className="nh3d-enhance-summary-chip is-practice">
          {translationStrings.enhanceMenu.summary.practice(
            enhanceMenuData.needsPracticeCount,
          )}
        </span>
        <span className="nh3d-enhance-summary-chip is-maxed">
          {translationStrings.enhanceMenu.summary.maxed(
            enhanceMenuData.maxedOutCount,
          )}
        </span>
      </div>
      {enhanceMenuData.legendLines.length > 0 ? (
        <div className="nh3d-enhance-legend">
          {enhanceMenuData.legendLines.map((line, index) => (
            <div
              className="nh3d-enhance-legend-line"
              key={`enhance-legend-${index}`}
            >
              {line}
            </div>
          ))}
        </div>
      ) : null}
      {enhanceMenuData.groups.map((group) => (
        <section
          className="nh3d-enhance-group"
          key={`enhance-group-${group.id}`}
        >
          <div className="nh3d-menu-category nh3d-enhance-group-title">
            {group.title}
          </div>
          <div className="nh3d-enhance-skill-grid">
            {group.entries.map((entry) => {
              const selectionInput = getMenuSelectionInput(entry.menuItem);
              const isSelectable =
                typeof onChooseSelectionInput === "function" &&
                isSelectableQuestionMenuItem(entry.menuItem);
              const isActive = activeMenuSelectionInput === selectionInput;
              const acceleratorLabel =
                typeof entry.menuItem.accelerator === "string" &&
                entry.menuItem.accelerator.trim().length > 0
                  ? `${entry.menuItem.accelerator})`
                  : "";
              return isSelectable ? (
                <button
                  autoFocus={isActive}
                  className={`nh3d-enhance-skill-card is-${entry.availability}${
                    isActive ? " nh3d-menu-button-active" : ""
                  }`}
                  key={`enhance-skill-${entry.id}`}
                  onClick={() => onChooseSelectionInput(selectionInput)}
                  onFocus={() => onFocusSelectionInput?.(selectionInput)}
                  type="button"
                >
                  <div className="nh3d-enhance-skill-head">
                    <span className="nh3d-enhance-skill-name">
                      {entry.name}
                    </span>
                    <span className="nh3d-enhance-skill-badges">
                      {acceleratorLabel ? (
                        <span className="nh3d-enhance-key">
                          {acceleratorLabel}
                        </span>
                      ) : null}
                      <span className="nh3d-enhance-state-chip">
                        {entry.availabilityLabel}
                      </span>
                    </span>
                  </div>
                  <div className="nh3d-enhance-rank-row">
                    <span>{entry.currentRank}</span>
                    {entry.nextRank ? (
                      <>
                        <span className="nh3d-enhance-rank-arrow">{"->"}</span>
                        <span>{entry.nextRank}</span>
                      </>
                    ) : (
                      <span className="nh3d-enhance-rank-max">
                        {translationStrings.enhanceMenu.maxLabel}
                      </span>
                    )}
                  </div>
                  {enhanceMenuData.showSlotCost && entry.slotCostForNextRank ? (
                    <div className="nh3d-enhance-slot-cost">
                      {translationStrings.enhanceMenu.slotCount(
                        entry.slotCostForNextRank,
                      )}
                    </div>
                  ) : null}
                </button>
              ) : (
                <div
                  className={`nh3d-enhance-skill-card is-${entry.availability} is-disabled${
                    isActive ? " nh3d-menu-button-active" : ""
                  }`}
                  key={`enhance-skill-${entry.id}`}
                >
                  <div className="nh3d-enhance-skill-head">
                    <span className="nh3d-enhance-skill-name">
                      {entry.name}
                    </span>
                    <span className="nh3d-enhance-state-chip">
                      {entry.availabilityLabel}
                    </span>
                  </div>
                  <div className="nh3d-enhance-rank-row">
                    <span>{entry.currentRank}</span>
                    {entry.nextRank ? (
                      <>
                        <span className="nh3d-enhance-rank-arrow">{"->"}</span>
                        <span>{entry.nextRank}</span>
                      </>
                    ) : (
                      <span className="nh3d-enhance-rank-max">
                        {translationStrings.enhanceMenu.maxLabel}
                      </span>
                    )}
                  </div>
                  {enhanceMenuData.showSlotCost && entry.slotCostForNextRank ? (
                    <div className="nh3d-enhance-slot-cost">
                      {translationStrings.enhanceMenu.slotCount(
                        entry.slotCostForNextRank,
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

const getCoreStatValuesFromSnapshot = (
  stats: PlayerStatsSnapshot,
): Record<CoreStatKey, number> => ({
  strength: Number(stats.strength) || 0,
  dexterity: Number(stats.dexterity) || 0,
  constitution: Number(stats.constitution) || 0,
  intelligence: Number(stats.intelligence) || 0,
  wisdom: Number(stats.wisdom) || 0,
  charisma: Number(stats.charisma) || 0,
  armor: Number(stats.armor) || 0,
});

const defaultCoreStatValues = getCoreStatValuesFromSnapshot(defaultPlayerStats);
const defaultCoreStatBaselineTurn = Number.isFinite(defaultPlayerStats.time)
  ? Math.trunc(defaultPlayerStats.time)
  : 0;
const defaultCoreStatBaselineName = String(defaultPlayerStats.name || "");

const isBootstrapCoreStatSnapshot = (snapshot: CoreStatSnapshot): boolean => {
  if (snapshot.turn !== defaultCoreStatBaselineTurn) {
    return false;
  }
  if (snapshot.playerName !== defaultCoreStatBaselineName) {
    return false;
  }
  return trackedCoreStatKeys.every(
    (key) => snapshot.values[key] === defaultCoreStatValues[key],
  );
};

const getDirectionHelpText = (
  numberPadModeEnabled: boolean,
  controllerEnabled: boolean,
) =>
  numberPadModeEnabled
    ? controllerEnabled
      ? t.directionHelp.controller
      : t.directionHelp.numpad
    : controllerEnabled
      ? t.directionHelp.controller
      : t.directionHelp.viKeys;

function expandChoiceSpec(spec: string): string[] {
  const normalized = String(spec || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+or\s+/gi, " ")
    .replace(/[,/|]/g, " ")
    .replace(/\s+/g, "")
    .replace(/[\[\]]/g, "");

  if (!normalized) {
    return [];
  }

  const expanded: string[] = [];
  const seen = new Set<string>();
  const addChoice = (value: string): void => {
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    expanded.push(value);
  };

  const canExpandRange = (start: string, end: string): boolean => {
    const isLower = (value: string) => value >= "a" && value <= "z";
    const isUpper = (value: string) => value >= "A" && value <= "Z";
    const isDigit = (value: string) => value >= "0" && value <= "9";
    return (
      (isLower(start) && isLower(end)) ||
      (isUpper(start) && isUpper(end)) ||
      (isDigit(start) && isDigit(end))
    );
  };

  for (let i = 0; i < normalized.length; i += 1) {
    const current = normalized[i];
    const hasRangeEnd = i + 2 < normalized.length && normalized[i + 1] === "-";

    if (hasRangeEnd) {
      const end = normalized[i + 2];
      if (canExpandRange(current, end)) {
        const startCode = current.charCodeAt(0);
        const endCode = end.charCodeAt(0);
        const step = startCode <= endCode ? 1 : -1;
        for (
          let code = startCode;
          step > 0 ? code <= endCode : code >= endCode;
          code += step
        ) {
          addChoice(String.fromCharCode(code));
        }
        i += 2;
        continue;
      }
    }

    if (current !== "-") {
      addChoice(current);
    }
  }

  return expanded;
}

function parseQuestionChoices(question: string, choices: string): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  const addChoice = (value: string): void => {
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    merged.push(value);
  };

  for (const choice of expandChoiceSpec(choices)) {
    addChoice(choice);
  }

  const bracketMatch = String(question || "").match(/\[([^\]]+)\]/);
  if (bracketMatch && bracketMatch[1]) {
    for (const choice of expandChoiceSpec(bracketMatch[1])) {
      addChoice(choice);
    }
  }

  return merged;
}

function isSymbolLookupTextQuestion(
  questionText: string,
  choices: string,
): boolean {
  if (String(choices || "").trim().length > 0) {
    return false;
  }
  const normalizedQuestion = String(questionText || "")
    .trim()
    .toLowerCase();
  return (
    normalizedQuestion === "what do you look for?" ||
    normalizedQuestion === "what do you look for"
  );
}

function getQuestionBracketChoiceSpec(question: string): string {
  const bracketMatch = String(question || "").match(/\[([^\]]+)\]/);
  return typeof bracketMatch?.[1] === "string"
    ? bracketMatch[1].trim().toLowerCase()
    : "";
}

function isAdjustLetterQuestionPrompt(questionText: string): boolean {
  return /^adjust letter to what\b/i.test(String(questionText || "").trim());
}

function isLegacyQuestionChoiceRuntime(
  runtimeVersion: NethackRuntimeVersion,
): boolean {
  return runtimeVersion !== "5.0";
}

function orderQuestionChoicesForDisplay(
  parsedChoices: string[],
  runtimeVersion: NethackRuntimeVersion,
): string[] {
  if (
    !isLegacyQuestionChoiceRuntime(runtimeVersion) ||
    !parsedChoices.some((choice) => choice.trim() === ".")
  ) {
    return parsedChoices;
  }

  const localActionChoices = parsedChoices.filter(
    (choice) => choice.trim() === ".",
  );
  const remainingChoices = parsedChoices.filter(
    (choice) => choice.trim() !== ".",
  );
  return [...localActionChoices, ...remainingChoices];
}

function isLegacyInventoryQuestionChoicePrompt(
  questionText: string,
  parsedChoices: string[],
  runtimeVersion: NethackRuntimeVersion,
  isYesNoPrompt: boolean,
): boolean {
  if (isYesNoPrompt || !isLegacyQuestionChoiceRuntime(runtimeVersion)) {
    return false;
  }
  const bracketChoiceSpec = getQuestionBracketChoiceSpec(questionText);
  if (
    bracketChoiceSpec.includes(".") ||
    bracketChoiceSpec.includes(",") ||
    bracketChoiceSpec.includes("?") ||
    bracketChoiceSpec.includes("*")
  ) {
    return true;
  }
  return parsedChoices.some((choice) => {
    const normalizedChoice = choice.trim();
    return (
      normalizedChoice === "." ||
      normalizedChoice === "," ||
      normalizedChoice === "?" ||
      normalizedChoice === "*"
    );
  });
}

function shouldUseCompactQuestionChoiceLayout(
  questionText: string,
  parsedChoices: string[],
  runtimeVersion: NethackRuntimeVersion,
  isYesNoPrompt: boolean,
): boolean {
  if (
    !Array.isArray(parsedChoices) ||
    parsedChoices.length === 0 ||
    !parsedChoices.every((choice) => choice.trim().length === 1)
  ) {
    return false;
  }
  if (isYesNoPrompt) {
    return true;
  }
  if (isAdjustLetterQuestionPrompt(questionText)) {
    return true;
  }
  if (
    isLegacyInventoryQuestionChoicePrompt(
      questionText,
      parsedChoices,
      runtimeVersion,
      isYesNoPrompt,
    )
  ) {
    return false;
  }
  return parsedChoices.length <= 4;
}

function isYesNoChoicePrompt(parsedChoices: string[]): boolean {
  if (!Array.isArray(parsedChoices) || parsedChoices.length === 0) {
    return false;
  }

  const normalized = parsedChoices
    .map((choice) =>
      String(choice || "")
        .trim()
        .toLowerCase(),
    )
    .filter((choice) => choice.length > 0);
  if (normalized.length === 0) {
    return false;
  }

  // Include common yes/no prompt auxiliaries so we never map these to inventory labels.
  const allowedChoices = new Set(["y", "n", "a", "q", "#", "?"]);
  const hasYes = normalized.includes("y");
  const hasNo = normalized.includes("n");
  const onlySimpleChoices = normalized.every(
    (choice) => choice.length === 1 && allowedChoices.has(choice),
  );
  return hasYes && hasNo && onlySimpleChoices;
}

function capitalizeFirstLetter(text: string): string {
  const normalized = String(text || "");
  if (!normalized) {
    return normalized;
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeTileIndexCandidate(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.trunc(value);
}

function resolveTileIndexForGlyph(glyph: unknown): number | null {
  if (typeof glyph !== "number" || !Number.isFinite(glyph) || glyph < 0) {
    return null;
  }
  const normalizedGlyph = Math.trunc(glyph);
  const helpers =
    (
      globalThis as {
        nethackGlobal?: {
          helpers?: {
            tileIndexForGlyph?: (glyphValue: number) => unknown;
          };
        };
      }
    ).nethackGlobal?.helpers ?? null;
  const tileIndexForGlyphHelper =
    typeof helpers?.tileIndexForGlyph === "function"
      ? helpers.tileIndexForGlyph
      : null;
  if (!tileIndexForGlyphHelper) {
    return null;
  }
  try {
    return normalizeTileIndexCandidate(
      tileIndexForGlyphHelper(normalizedGlyph),
    );
  } catch {
    return null;
  }
}

function resolveNoGlyphValueFromRuntime(): number | null {
  const glyphConstants =
    (
      globalThis as {
        nethackGlobal?: {
          constants?: {
            GLYPH?: {
              NO_GLYPH?: unknown;
              MAX_GLYPH?: unknown;
            };
          };
        };
      }
    ).nethackGlobal?.constants?.GLYPH ?? null;
  if (!glyphConstants) {
    return null;
  }
  const explicitNoGlyph = normalizeTileIndexCandidate(glyphConstants.NO_GLYPH);
  if (explicitNoGlyph !== null) {
    return explicitNoGlyph;
  }
  return normalizeTileIndexCandidate(glyphConstants.MAX_GLYPH);
}

function isMenuItemTileApplicable(
  item: NethackMenuItem | null | undefined,
): boolean {
  if (!item || item.isCategory) {
    return false;
  }
  if (typeof item.isTileApplicable === "boolean") {
    return item.isTileApplicable;
  }
  const glyphCandidate =
    typeof item.glyphChar === "string" ? item.glyphChar : "";
  if (glyphCandidate.length > 0 && glyphCandidate.trim().length === 0) {
    return false;
  }
  if (typeof item.glyph === "number" && Number.isFinite(item.glyph)) {
    const noGlyphValue = resolveNoGlyphValueFromRuntime();
    if (noGlyphValue !== null && Math.trunc(item.glyph) === noGlyphValue) {
      return false;
    }
  }
  if (normalizeTileIndexCandidate(item.tileIndex) !== null) {
    return true;
  }
  return (
    typeof item.glyph === "number" &&
    Number.isFinite(item.glyph) &&
    item.glyph >= 0
  );
}

function resolveMenuItemTileIndex(
  item: NethackMenuItem | null | undefined,
): number | null {
  if (!isMenuItemTileApplicable(item) || !item) {
    return null;
  }
  const explicitTileIndex = normalizeTileIndexCandidate(item.tileIndex);
  if (explicitTileIndex !== null) {
    return explicitTileIndex;
  }
  if (typeof item.isTileApplicable === "boolean") {
    // Runtime already made a deterministic tile/non-tile decision.
    return null;
  }
  return resolveTileIndexForGlyph(item.glyph);
}

function resolveMenuItemTilePreviewDataUrl(
  item: NethackMenuItem | null | undefined,
): string | null {
  const candidate =
    typeof item?.tilePreviewDataUrl === "string"
      ? item.tilePreviewDataUrl.trim()
      : "";
  return candidate.length > 0 ? candidate : null;
}

function resolveMenuItemFallbackGlyph(
  item: NethackMenuItem | null | undefined,
  fallback = "?",
): string {
  const glyphCandidate =
    typeof item?.glyphChar === "string" ? item.glyphChar : "";
  const glyphCodePoint = glyphCandidate.codePointAt(0);
  if (
    typeof glyphCodePoint === "number" &&
    glyphCodePoint >= 32 &&
    glyphCodePoint !== 127
  ) {
    return glyphCandidate.charAt(0);
  }
  return fallback;
}

function getInventoryItemForQuestionChoice(
  choice: string,
  inventoryItems: NethackMenuItem[],
): NethackMenuItem | null {
  const normalizedChoice = choice.trim();
  if (!normalizedChoice) {
    return null;
  }
  return (
    inventoryItems.find((item) => {
      if (!item || item.isCategory || typeof item.accelerator !== "string") {
        return false;
      }
      return (
        item.accelerator === normalizedChoice ||
        item.accelerator.toLowerCase() === normalizedChoice.toLowerCase()
      );
    }) ?? null
  );
}

function buildLegacyInventoryQuestionMenuItems(
  questionText: string,
  parsedChoices: string[],
  inventoryItems: NethackMenuItem[],
  runtimeVersion: NethackRuntimeVersion,
  isYesNoPrompt: boolean,
): NethackMenuItem[] {
  if (
    !isLegacyInventoryQuestionChoicePrompt(
      questionText,
      parsedChoices,
      runtimeVersion,
      isYesNoPrompt,
    )
  ) {
    return [];
  }

  const syntheticMenuItems: NethackMenuItem[] = [];
  for (const choice of parsedChoices) {
    const normalizedChoice = String(choice || "").trim();
    if (normalizedChoice.length !== 1) {
      return [];
    }

    const inventoryItem = getInventoryItemForQuestionChoice(
      normalizedChoice,
      inventoryItems,
    );
    if (!inventoryItem) {
      return [];
    }

    syntheticMenuItems.push({
      ...inventoryItem,
      accelerator: normalizedChoice,
      originalAccelerator:
        inventoryItem.originalAccelerator ?? normalizedChoice,
      selectionInput: normalizedChoice,
      isSelectable: true,
      isCategory: false,
    });
  }

  return syntheticMenuItems;
}

function getQuestionChoiceLabel(
  questionText: string,
  choice: string,
  inventoryItems: NethackMenuItem[],
  runtimeVersion: NethackRuntimeVersion,
  useInventoryLabels = true,
): string {
  const normalizedChoice = choice.trim();
  if (questionText.includes("Which ring-finger")) {
    if (normalizedChoice === "l") {
      return `l) ${t.dialogs.question.choices.leftRingFinger}`;
    }
    if (normalizedChoice === "r") {
      return `r) ${t.dialogs.question.choices.rightRingFinger}`;
    }
  }

  if (!normalizedChoice) {
    return choice;
  }
  if (isLegacyQuestionChoiceRuntime(runtimeVersion)) {
    if (normalizedChoice === ".") {
      return `.) ${t.dialogs.question.choices.here}`;
    }
    if (normalizedChoice === ",") {
      return `,) ${t.dialogs.question.choices.onGround}`;
    }
    if (normalizedChoice === "?") {
      return `?) ${t.dialogs.question.choices.eligibleItems}`;
    }
    if (normalizedChoice === "*") {
      return `*) ${t.dialogs.question.choices.allInventory}`;
    }
  }
  if (!useInventoryLabels) {
    return normalizedChoice;
  }
  const inventoryItem = getInventoryItemForQuestionChoice(
    normalizedChoice,
    inventoryItems,
  );
  if (!inventoryItem || typeof inventoryItem.text !== "string") {
    return normalizedChoice;
  }
  return `${normalizedChoice}) ${inventoryItem.text.trim()}`;
}

function getMenuSelectionInput(item: NethackMenuItem): string {
  if (typeof item.selectionInput === "string" && item.selectionInput.trim()) {
    return item.selectionInput;
  }
  return typeof item.accelerator === "string" ? item.accelerator : "";
}

function isSelectableQuestionMenuItem(item: NethackMenuItem): boolean {
  if (!item || item.isCategory) {
    return false;
  }
  if (typeof item.isSelectable === "boolean") {
    return item.isSelectable;
  }
  if (typeof item.identifier === "number") {
    return item.identifier !== 0;
  }
  return getMenuSelectionInput(item).trim().length > 0;
}

function isReadOnlyQuestionOptionMenuItem(
  item: NethackMenuItem | null | undefined,
  questionText: string,
): boolean {
  if (!item || item.isCategory || isSelectableQuestionMenuItem(item)) {
    return false;
  }
  const normalizedQuestion = String(questionText || "")
    .trim()
    .toLowerCase();
  if (normalizedQuestion !== "set what options?") {
    return false;
  }
  const menuText = String(item.text || "");
  if (menuText.trim().length === 0) {
    return false;
  }
  // NetHack emits non-modifiable options with indentation and [value] suffix.
  return /^\s{2,}\S.*\[[^\]]+\]\s*$/.test(menuText);
}

type TileAtlasState = {
  tilesetPath: string;
  loaded: boolean;
  failed: boolean;
  tileSourceSize: number;
  columns: number;
  rows: number;
  tileCount: number;
};

const createDefaultTileAtlasState = (): TileAtlasState => ({
  tilesetPath: "",
  loaded: false,
  failed: false,
  tileSourceSize: 32,
  columns: 0,
  rows: 0,
  tileCount: 0,
});

type TilePickerEntry = {
  tileId: number;
  glyphLabel: string;
  glyphNumber: number | null;
};

type TilesetTilePickerDialogProps = {
  visible: boolean;
  dialogId: string;
  title: string;
  helperText?: string;
  closeLabel: string;
  selectedTileId: number;
  defaultTileId: number;
  selectedGlyphLabel: string;
  selectedGlyphNumber: number | null;
  showGlyphNumber: boolean;
  statusText: string;
  tileAtlasLoaded: boolean;
  entries: TilePickerEntry[];
  renderTilePreviewImage: (tileId: number) => JSX.Element | null;
  onSelectTile: (tileId: number) => void;
  onResetToDefault: () => void;
  onDone: () => void;
  renderMobileCloseButton: (
    onClick: () => void,
    label: string,
  ) => JSX.Element | null;
};

function TilesetTilePickerDialog({
  visible,
  dialogId,
  title,
  helperText,
  closeLabel,
  selectedTileId,
  defaultTileId,
  selectedGlyphLabel,
  selectedGlyphNumber,
  showGlyphNumber,
  statusText,
  tileAtlasLoaded,
  entries,
  renderTilePreviewImage,
  onSelectTile,
  onResetToDefault,
  onDone,
  renderMobileCloseButton,
}: TilesetTilePickerDialogProps): JSX.Element | null {
  if (!visible) {
    return null;
  }

  return (
    <div
      className="nh3d-dialog nh3d-dialog-options nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close is-visible nh3d-dialog-tile-picker"
      id={dialogId}
    >
      {renderMobileCloseButton(onDone, closeLabel)}
      <div className="nh3d-options-title">{title}</div>
      {helperText ? (
        <div className="nh3d-option-description">{helperText}</div>
      ) : null}
      <div className="nh3d-dark-wall-picker-selected">
        <span className="nh3d-dark-wall-picker-selected-preview">
          {renderTilePreviewImage(selectedTileId)}
        </span>
        <div className="nh3d-dark-wall-picker-selected-copy">
          <div className="nh3d-option-label">
            {t.tilePicker.selectedTile(selectedTileId)}
            {selectedTileId === defaultTileId ? t.soundPack.defaultSuffix : ""}
          </div>
          <div className="nh3d-option-description">
            {t.tilePicker.glyph(selectedGlyphLabel)}
            {showGlyphNumber && typeof selectedGlyphNumber === "number"
              ? ` (${selectedGlyphNumber})`
              : ""}
          </div>
        </div>
      </div>
      {!tileAtlasLoaded ? (
        <div className="nh3d-dark-wall-picker-status">{statusText}</div>
      ) : (
        <div className="nh3d-overflow-glow-frame">
          <div
            className="nh3d-dark-wall-tile-grid"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
          >
            {entries.map((entry) => {
              const isSelected = entry.tileId === selectedTileId;
              const isDefault = entry.tileId === defaultTileId;
              return (
                <button
                  className={`nh3d-dark-wall-tile-card${
                    isSelected ? " is-selected" : ""
                  }${isDefault ? " is-default" : ""}`}
                  key={entry.tileId}
                  onClick={() => onSelectTile(entry.tileId)}
                  type="button"
                >
                  <span className="nh3d-dark-wall-tile-card-preview">
                    {renderTilePreviewImage(entry.tileId)}
                  </span>
                  <span className="nh3d-dark-wall-tile-card-glyph">
                    {t.tilePicker.glyph(entry.glyphLabel)}
                    {showGlyphNumber && typeof entry.glyphNumber === "number"
                      ? ` (${entry.glyphNumber})`
                      : ""}
                  </span>
                  <span className="nh3d-dark-wall-tile-card-id">
                    {t.tilePicker.tile(entry.tileId)}
                  </span>
                  {isDefault ? (
                    <span className="nh3d-dark-wall-tile-card-default">
                      {t.tilePicker.defaultBadge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button"
          disabled={selectedTileId === defaultTileId}
          onClick={onResetToDefault}
          type="button"
        >
          {t.tilePicker.resetToDefault}
        </button>
        <button
          className="nh3d-menu-action-button nh3d-menu-action-confirm"
          onClick={onDone}
          type="button"
        >
          {commonStrings.done}
        </button>
      </div>
    </div>
  );
}

type TilesetSolidColorPickerDialogProps = {
  visible: boolean;
  dialogId: string;
  title: string;
  closeLabel: string;
  selectedColorHex: string;
  statusText: string;
  tileAtlasLoaded: boolean;
  tileSourceSize: number;
  atlasWidthPx: number;
  atlasImage: HTMLImageElement | null;
  onSelectColorHex: (hexValue: string) => void;
  onDone: () => void;
  renderMobileCloseButton: (
    onClick: () => void,
    label: string,
  ) => JSX.Element | null;
};

type SolidColorPickerHoverState = {
  clientX: number;
  clientY: number;
  sourceX: number;
  sourceY: number;
  hexColor: string;
};

const defaultSolidChromaKeyHex = "#466d6c";

function normalizeSolidChromaKeyHex(
  rawValue: string,
  fallback: string = defaultSolidChromaKeyHex,
): string {
  const normalized = String(rawValue || "").trim();
  const match = normalized.match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) {
    return fallback;
  }
  return `#${match[1].toLowerCase()}`;
}

function formatSolidChromaKeyHex(rawValue: string): string {
  return normalizeSolidChromaKeyHex(rawValue).toUpperCase();
}

function rgbToSolidChromaKeyHex(r: number, g: number, b: number): string {
  const toHex = (value: number) =>
    Math.max(0, Math.min(255, Math.trunc(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function TilesetSolidColorPickerDialog({
  visible,
  dialogId,
  title,
  closeLabel,
  selectedColorHex,
  statusText,
  tileAtlasLoaded,
  tileSourceSize,
  atlasWidthPx,
  atlasImage,
  onSelectColorHex,
  onDone,
  renderMobileCloseButton,
}: TilesetSolidColorPickerDialogProps): JSX.Element | null {
  const atlasCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const zoomCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceWidthRef = useRef(0);
  const sourceHeightRef = useRef(0);
  const sourcePixelsRef = useRef<Uint8ClampedArray | null>(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [hoverState, setHoverState] =
    useState<SolidColorPickerHoverState | null>(null);

  useEffect(() => {
    if (!visible || !tileAtlasLoaded || !atlasImage) {
      sourceCanvasRef.current = null;
      sourceWidthRef.current = 0;
      sourceHeightRef.current = 0;
      sourcePixelsRef.current = null;
      setHoverState(null);
      return;
    }

    const naturalWidth = Math.max(0, Math.trunc(atlasImage.naturalWidth));
    const configuredWidth = Math.max(0, Math.trunc(atlasWidthPx));
    const sourceWidth =
      configuredWidth > 0
        ? Math.min(naturalWidth, configuredWidth)
        : naturalWidth;
    const sourceHeight = Math.max(0, Math.trunc(atlasImage.naturalHeight));
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      sourceCanvasRef.current = null;
      sourceWidthRef.current = 0;
      sourceHeightRef.current = 0;
      sourcePixelsRef.current = null;
      setHoverState(null);
      return;
    }

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = sourceWidth;
    sourceCanvas.height = sourceHeight;
    const sourceContext = sourceCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!sourceContext) {
      sourceCanvasRef.current = null;
      sourceWidthRef.current = 0;
      sourceHeightRef.current = 0;
      sourcePixelsRef.current = null;
      setHoverState(null);
      return;
    }
    sourceContext.imageSmoothingEnabled = false;
    sourceContext.clearRect(0, 0, sourceWidth, sourceHeight);
    sourceContext.drawImage(
      atlasImage,
      0,
      0,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight,
    );
    sourceCanvasRef.current = sourceCanvas;
    sourceWidthRef.current = sourceWidth;
    sourceHeightRef.current = sourceHeight;
    sourcePixelsRef.current = sourceContext.getImageData(
      0,
      0,
      sourceWidth,
      sourceHeight,
    ).data;

    const preferredScale =
      tileSourceSize <= 24
        ? 3.5
        : tileSourceSize <= 32
          ? 2.75
          : tileSourceSize <= 48
            ? 2
            : 1.6;
    const maxUpscaledDimension = 3200;
    const maxAllowedScale = Math.min(
      maxUpscaledDimension / sourceWidth,
      maxUpscaledDimension / sourceHeight,
    );
    const nextScale = Number(
      Math.max(1, Math.min(preferredScale, maxAllowedScale)).toFixed(2),
    );
    setDisplayScale(nextScale);

    const atlasCanvas = atlasCanvasRef.current;
    if (atlasCanvas) {
      const displayWidth = Math.max(1, Math.trunc(sourceWidth * nextScale));
      const displayHeight = Math.max(1, Math.trunc(sourceHeight * nextScale));
      atlasCanvas.width = displayWidth;
      atlasCanvas.height = displayHeight;
      const atlasContext = atlasCanvas.getContext("2d");
      if (atlasContext) {
        atlasContext.imageSmoothingEnabled = false;
        atlasContext.clearRect(0, 0, displayWidth, displayHeight);
        atlasContext.drawImage(
          sourceCanvas,
          0,
          0,
          sourceWidth,
          sourceHeight,
          0,
          0,
          displayWidth,
          displayHeight,
        );
      }
    }

    setHoverState(null);
  }, [atlasImage, atlasWidthPx, tileAtlasLoaded, tileSourceSize, visible]);

  const drawZoomPreview = (sourceX: number, sourceY: number): void => {
    const sourceCanvas = sourceCanvasRef.current;
    const zoomCanvas = zoomCanvasRef.current;
    const sourceWidth = sourceWidthRef.current;
    const sourceHeight = sourceHeightRef.current;
    if (!sourceCanvas || !zoomCanvas || sourceWidth <= 0 || sourceHeight <= 0) {
      return;
    }
    const zoomContext = zoomCanvas.getContext("2d");
    if (!zoomContext) {
      return;
    }
    const sampleSize = 15;
    const half = Math.floor(sampleSize / 2);
    const maxStartX = Math.max(0, sourceWidth - sampleSize);
    const maxStartY = Math.max(0, sourceHeight - sampleSize);
    const startX = Math.max(0, Math.min(maxStartX, sourceX - half));
    const startY = Math.max(0, Math.min(maxStartY, sourceY - half));
    const localX = sourceX - startX;
    const localY = sourceY - startY;
    zoomContext.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height);
    zoomContext.imageSmoothingEnabled = false;
    zoomContext.drawImage(
      sourceCanvas,
      startX,
      startY,
      sampleSize,
      sampleSize,
      0,
      0,
      zoomCanvas.width,
      zoomCanvas.height,
    );
    const crossX = ((localX + 0.5) / sampleSize) * zoomCanvas.width;
    const crossY = ((localY + 0.5) / sampleSize) * zoomCanvas.height;
    zoomContext.strokeStyle = "rgba(255, 255, 255, 0.92)";
    zoomContext.lineWidth = 1;
    zoomContext.beginPath();
    zoomContext.moveTo(crossX, 0);
    zoomContext.lineTo(crossX, zoomCanvas.height);
    zoomContext.moveTo(0, crossY);
    zoomContext.lineTo(zoomCanvas.width, crossY);
    zoomContext.stroke();
  };

  useEffect(() => {
    if (!hoverState) {
      return;
    }
    drawZoomPreview(hoverState.sourceX, hoverState.sourceY);
  }, [hoverState]);

  const sampleSolidColorFromCanvasPoint = (
    canvasX: number,
    canvasY: number,
  ): { sourceX: number; sourceY: number; hexColor: string } | null => {
    const sourcePixels = sourcePixelsRef.current;
    const sourceWidth = sourceWidthRef.current;
    const sourceHeight = sourceHeightRef.current;
    if (
      !sourcePixels ||
      sourceWidth <= 0 ||
      sourceHeight <= 0 ||
      !Number.isFinite(canvasX) ||
      !Number.isFinite(canvasY)
    ) {
      return null;
    }
    const safeScale = Math.max(0.001, displayScale);
    const sourceX = Math.max(
      0,
      Math.min(sourceWidth - 1, Math.floor(canvasX / safeScale)),
    );
    const sourceY = Math.max(
      0,
      Math.min(sourceHeight - 1, Math.floor(canvasY / safeScale)),
    );
    const pixelIndex = (sourceY * sourceWidth + sourceX) * 4;
    const r = sourcePixels[pixelIndex];
    const g = sourcePixels[pixelIndex + 1];
    const b = sourcePixels[pixelIndex + 2];
    return {
      sourceX,
      sourceY,
      hexColor: rgbToSolidChromaKeyHex(r, g, b),
    };
  };

  const handleAtlasMouseMove = (
    event: ReactMouseEvent<HTMLCanvasElement>,
  ): void => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      setHoverState(null);
      return;
    }
    const normalizedX = (event.clientX - rect.left) / rect.width;
    const normalizedY = (event.clientY - rect.top) / rect.height;
    const canvasX = Math.max(
      0,
      Math.min(canvas.width - 1, normalizedX * canvas.width),
    );
    const canvasY = Math.max(
      0,
      Math.min(canvas.height - 1, normalizedY * canvas.height),
    );
    const sample = sampleSolidColorFromCanvasPoint(canvasX, canvasY);
    if (!sample) {
      setHoverState(null);
      return;
    }
    drawZoomPreview(sample.sourceX, sample.sourceY);
    setHoverState({
      clientX: event.clientX,
      clientY: event.clientY,
      sourceX: sample.sourceX,
      sourceY: sample.sourceY,
      hexColor: sample.hexColor,
    });
  };

  const handleAtlasClick = (
    event: ReactMouseEvent<HTMLCanvasElement>,
  ): void => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const normalizedX = (event.clientX - rect.left) / rect.width;
    const normalizedY = (event.clientY - rect.top) / rect.height;
    const canvasX = Math.max(
      0,
      Math.min(canvas.width - 1, normalizedX * canvas.width),
    );
    const canvasY = Math.max(
      0,
      Math.min(canvas.height - 1, normalizedY * canvas.height),
    );
    const sample = sampleSolidColorFromCanvasPoint(canvasX, canvasY);
    if (!sample) {
      return;
    }
    onSelectColorHex(sample.hexColor);
  };

  const hoverTooltipStyle: CSSProperties | undefined = useMemo(() => {
    if (!hoverState || typeof window === "undefined") {
      return undefined;
    }
    const tooltipWidth = 190;
    const tooltipHeight = 160;
    const left = Math.max(
      8,
      Math.min(window.innerWidth - tooltipWidth - 8, hoverState.clientX + 18),
    );
    const top = Math.max(
      8,
      Math.min(window.innerHeight - tooltipHeight - 8, hoverState.clientY + 18),
    );
    return {
      left,
      top,
    };
  }, [hoverState]);
  const hoverTooltip =
    hoverState && hoverTooltipStyle ? (
      <div className="nh3d-solid-chroma-picker-hover" style={hoverTooltipStyle}>
        <canvas
          className="nh3d-solid-chroma-picker-hover-zoom"
          height={112}
          ref={zoomCanvasRef}
          width={112}
        />
        <div className="nh3d-solid-chroma-picker-hover-copy">
          <div className="nh3d-solid-chroma-picker-hover-hex">
            {formatSolidChromaKeyHex(hoverState.hexColor)}
          </div>
          <div
            className="nh3d-solid-chroma-picker-hover-color"
            style={{
              backgroundColor: normalizeSolidChromaKeyHex(hoverState.hexColor),
            }}
          />
        </div>
      </div>
    ) : null;

  if (!visible) {
    return null;
  }

  return (
    <div
      className="nh3d-dialog nh3d-dialog-options nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close is-visible nh3d-dialog-tile-picker nh3d-dialog-solid-chroma-picker"
      id={dialogId}
    >
      {renderMobileCloseButton(onDone, closeLabel)}
      <div className="nh3d-options-title">{title}</div>
      <div className="nh3d-dark-wall-picker-selected">
        <span
          aria-hidden="true"
          className="nh3d-solid-chroma-selected-color-preview"
          style={{
            backgroundColor: normalizeSolidChromaKeyHex(selectedColorHex),
          }}
        />
        <div className="nh3d-dark-wall-picker-selected-copy">
          <div className="nh3d-option-label">
            Selected color: {formatSolidChromaKeyHex(selectedColorHex)}
          </div>
          <div className="nh3d-option-description">
            Move over the full atlas and click a pixel to set the solid chroma
            key color.
          </div>
        </div>
      </div>
      {!tileAtlasLoaded ? (
        <div className="nh3d-dark-wall-picker-status">{statusText}</div>
      ) : (
        <div className="nh3d-overflow-glow-frame">
          <div
            className="nh3d-solid-chroma-picker-atlas-shell"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
          >
            <canvas
              className="nh3d-solid-chroma-picker-atlas-canvas"
              onClick={handleAtlasClick}
              onMouseLeave={() => setHoverState(null)}
              onMouseMove={handleAtlasMouseMove}
              ref={atlasCanvasRef}
            />
          </div>
        </div>
      )}
      {typeof document !== "undefined" && hoverTooltip
        ? createPortal(hoverTooltip, document.body)
        : hoverTooltip}
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button nh3d-menu-action-confirm"
          onClick={onDone}
          type="button"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function glyphCodePointToChar(codePoint: unknown): string | null {
  if (
    typeof codePoint !== "number" ||
    !Number.isInteger(codePoint) ||
    codePoint < 0 ||
    codePoint > 0x10ffff
  ) {
    return null;
  }
  return String.fromCodePoint(codePoint);
}

function formatTileGlyphLabel(glyphChar: string): string {
  if (glyphChar === " ") {
    return "space";
  }
  const codePoint = glyphChar.codePointAt(0);
  if (typeof codePoint === "number" && (codePoint < 32 || codePoint === 127)) {
    return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
  }
  return `'${glyphChar}'`;
}

function buildRepresentativeGlyphByTileId(
  glyphCatalog: ReadonlyArray<{
    tileIndex: number;
    ch?: number;
    ttychar?: number;
  }>,
): Map<number, string> {
  const representativeByTile = new Map<number, string>();
  for (const entry of glyphCatalog) {
    const tileId = Math.trunc(entry.tileIndex);
    if (!Number.isFinite(tileId) || tileId < 0) {
      continue;
    }
    const candidate =
      glyphCodePointToChar(entry.ch) ?? glyphCodePointToChar(entry.ttychar);
    if (!candidate || candidate.length === 0) {
      continue;
    }
    const glyphChar = candidate.charAt(0);
    const existing = representativeByTile.get(tileId);
    if (!existing) {
      representativeByTile.set(tileId, glyphChar);
      continue;
    }
    if (existing.trim().length === 0 && glyphChar.trim().length > 0) {
      representativeByTile.set(tileId, glyphChar);
    }
  }
  return representativeByTile;
}

function buildRepresentativeGlyphNumberByTileId(
  glyphCatalog: ReadonlyArray<{
    glyph?: number;
    tileIndex: number;
    ch?: number;
    ttychar?: number;
  }>,
): Map<number, number> {
  const representativeByTile = new Map<
    number,
    { glyphChar: string; glyph: number }
  >();
  for (const entry of glyphCatalog) {
    const tileId = Math.trunc(entry.tileIndex);
    if (!Number.isFinite(tileId) || tileId < 0) {
      continue;
    }
    const candidate =
      glyphCodePointToChar(entry.ch) ?? glyphCodePointToChar(entry.ttychar);
    if (!candidate || candidate.length === 0) {
      continue;
    }
    const glyph = Math.trunc(Number(entry.glyph));
    if (!Number.isFinite(glyph) || glyph < 0) {
      continue;
    }
    const glyphChar = candidate.charAt(0);
    const existing = representativeByTile.get(tileId);
    if (!existing) {
      representativeByTile.set(tileId, { glyphChar, glyph });
      continue;
    }
    if (existing.glyphChar.trim().length === 0 && glyphChar.trim().length > 0) {
      representativeByTile.set(tileId, { glyphChar, glyph });
    }
  }
  const glyphByTileId = new Map<number, number>();
  for (const [tileId, entry] of representativeByTile.entries()) {
    glyphByTileId.set(tileId, entry.glyph);
  }
  return glyphByTileId;
}

function createIsolatedAtlasTilePreviewDataUrl(
  atlasImage: HTMLImageElement,
  tileId: number,
  tileSourceSize: number,
  tileColumns: number,
  tileRows: number,
  backgroundRemoval?: {
    enabled: boolean;
    mode: TilesetBackgroundRemovalMode;
    solidChromaKeyColorHex: string;
    backgroundTilePixels: Uint8ClampedArray | null;
  },
): string | null {
  if (
    typeof document === "undefined" ||
    !atlasImage ||
    tileSourceSize <= 0 ||
    !Number.isFinite(tileId)
  ) {
    return null;
  }
  const tilesPerRow = Math.max(0, Math.trunc(tileColumns));
  const rows = Math.max(0, Math.trunc(tileRows));
  const tileCount = tilesPerRow > 0 && rows > 0 ? tilesPerRow * rows : 0;
  const safeTileId = Math.trunc(tileId);
  if (tileCount <= 0 || safeTileId < 0 || safeTileId >= tileCount) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = tileSourceSize;
  canvas.height = tileSourceSize;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const sx = (safeTileId % tilesPerRow) * tileSourceSize;
  const sy = Math.floor(safeTileId / tilesPerRow) * tileSourceSize;
  context.clearRect(0, 0, tileSourceSize, tileSourceSize);
  context.drawImage(
    atlasImage,
    sx,
    sy,
    tileSourceSize,
    tileSourceSize,
    0,
    0,
    tileSourceSize,
    tileSourceSize,
  );

  if (backgroundRemoval?.enabled) {
    const imageData = context.getImageData(
      0,
      0,
      tileSourceSize,
      tileSourceSize,
    );
    const data = imageData.data;
    if (backgroundRemoval.mode === "solid") {
      const match = String(backgroundRemoval.solidChromaKeyColorHex || "")
        .trim()
        .match(/^#?([0-9a-fA-F]{6})$/);
      if (match) {
        const hex = match[1];
        const targetR = Number.parseInt(hex.slice(0, 2), 16);
        const targetG = Number.parseInt(hex.slice(2, 4), 16);
        const targetB = Number.parseInt(hex.slice(4, 6), 16);
        for (let i = 0; i < data.length; i += 4) {
          if (
            data[i] === targetR &&
            data[i + 1] === targetG &&
            data[i + 2] === targetB
          ) {
            data[i + 3] = 0;
          }
        }
      }
    } else if (backgroundRemoval.backgroundTilePixels) {
      const alphaSoftMin = 12;
      const alphaSoftMax = 40;
      const backgroundPixels = backgroundRemoval.backgroundTilePixels;
      for (let i = 0; i < data.length; i += 4) {
        const sourceAlpha = data[i + 3];
        if (sourceAlpha === 0) {
          continue;
        }
        const deltaR = Math.abs(data[i] - backgroundPixels[i]);
        const deltaG = Math.abs(data[i + 1] - backgroundPixels[i + 1]);
        const deltaB = Math.abs(data[i + 2] - backgroundPixels[i + 2]);
        const delta = Math.max(deltaR, deltaG, deltaB);
        const visibility = Math.max(
          0,
          Math.min(1, (delta - alphaSoftMin) / (alphaSoftMax - alphaSoftMin)),
        );
        const nextAlpha = Math.round(sourceAlpha * visibility);
        data[i + 3] = nextAlpha;
        if (nextAlpha === 0) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
    }
    context.putImageData(imageData, 0, 0);
  }

  return canvas.toDataURL("image/png");
}

function getAtlasTilePixels(
  atlasImage: HTMLImageElement,
  tileSourceSize: number,
  tileId: number,
  tileColumns: number,
  tileRows: number,
): Uint8ClampedArray | null {
  if (
    typeof document === "undefined" ||
    !atlasImage ||
    tileSourceSize <= 0 ||
    !Number.isFinite(tileId)
  ) {
    return null;
  }
  const tilesPerRow = Math.max(0, Math.trunc(tileColumns));
  const rows = Math.max(0, Math.trunc(tileRows));
  const tileCount = tilesPerRow > 0 && rows > 0 ? tilesPerRow * rows : 0;
  const safeTileId = Math.trunc(tileId);
  if (tileCount <= 0 || safeTileId < 0 || safeTileId >= tileCount) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = tileSourceSize;
  canvas.height = tileSourceSize;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  const sx = (safeTileId % tilesPerRow) * tileSourceSize;
  const sy = Math.floor(safeTileId / tilesPerRow) * tileSourceSize;
  context.clearRect(0, 0, tileSourceSize, tileSourceSize);
  context.drawImage(
    atlasImage,
    sx,
    sy,
    tileSourceSize,
    tileSourceSize,
    0,
    0,
    tileSourceSize,
    tileSourceSize,
  );
  return context.getImageData(0, 0, tileSourceSize, tileSourceSize).data;
}

function resolvePreviewAtlasTileIdForRuntime(
  runtimeVersion: NethackRuntimeVersion,
  tileId: number,
  atlasTileCount: number,
): number {
  const normalizedTileId = Math.trunc(tileId);
  if (!Number.isFinite(normalizedTileId) || normalizedTileId < 0) {
    return normalizedTileId;
  }
  try {
    if (
      !shouldTranslateNh367TilesetForNh5Runtime(runtimeVersion, atlasTileCount)
    ) {
      return normalizedTileId;
    }
    return translateNh5TileIndexToNh367(normalizedTileId);
  } catch {
    return normalizedTileId;
  }
}

type StartupFlowStep = "variant" | "choose" | "create" | "random" | "resume";
const startupDefaultCharacterName = "Web_user";

function createDefaultStartupCharacterPreferences(
  runtimeVersion: NethackRuntimeVersion = "3.6.7",
): StartupCharacterPreferences {
  const defaultCreateSelection = normalizeStartupCreateCharacterSelection(
    {},
    runtimeVersion,
  );
  return {
    randomName: startupDefaultCharacterName,
    createName: startupDefaultCharacterName,
    createRole: defaultCreateSelection.role,
    createRace: defaultCreateSelection.race,
    createGender: defaultCreateSelection.gender,
    createAlign: defaultCreateSelection.align,
  };
}

function createDefaultStartupCharacterPreferencesByRuntime(): StartupCharacterPreferencesByRuntime {
  return {
    "3.6.7": createDefaultStartupCharacterPreferences("3.6.7"),
    "5.0": createDefaultStartupCharacterPreferences("5.0"),
    slashem: createDefaultStartupCharacterPreferences("slashem"),
  };
}

function resolveStartupCharacterPreferencesForRuntime(
  preferencesByRuntime: StartupCharacterPreferencesByRuntime,
  defaultPreferencesByRuntime: StartupCharacterPreferencesByRuntime,
  runtimeVersion: NethackRuntimeVersion,
): StartupCharacterPreferences {
  return (
    preferencesByRuntime[runtimeVersion] ??
    defaultPreferencesByRuntime[runtimeVersion] ??
    createDefaultStartupCharacterPreferences(runtimeVersion)
  );
}

function areStartupCharacterPreferencesEqual(
  left: StartupCharacterPreferences | undefined,
  right: StartupCharacterPreferences,
): boolean {
  return (
    left?.randomName === right.randomName &&
    left?.createName === right.createName &&
    left?.createRole === right.createRole &&
    left?.createRace === right.createRace &&
    left?.createGender === right.createGender &&
    left?.createAlign === right.createAlign
  );
}

type MobileActionEntry = {
  id: string;
  label: string;
  kind: "quick" | "extended";
  value: string;
};
type ControllerActionWheelEntry = MobileActionEntry & {
  index: number;
  angleDeg: number;
  clipPath: string;
  labelXPercent: number;
  labelYPercent: number;
};
type WizardCommandCopy = {
  name: string;
  description: string;
};
type MobileActionSheetMode = "quick" | "extended";
type InventoryContextAction = {
  id: string;
  label: string;
  kind?: "quick" | "extended";
  value?: string;
  armInventorySelection?: boolean;
};
type InventoryContextMenuState = {
  accelerator: string;
  itemText: string;
  x: number;
  y: number;
  anchorCenterX?: number;
  anchorLeftX?: number;
  anchorBottomY?: number;
  anchorRightX?: number;
  anchorTopY?: number;
};
type InventoryDropCountDialogState = {
  accelerator: string;
  itemText: string;
  maxCount: number;
};
type InventoryRowPressCandidate = {
  source: "pointer" | "touch";
  pointerId: number;
  accelerator: string;
  item: NethackMenuItem;
  rowElement: HTMLDivElement | null;
  startClientX: number;
  startClientY: number;
  startedAtMs: number;
};
type TilesetBackgroundRemovalMode =
  Nh3dClientOptions["tilesetBackgroundRemovalMode"];
type ClientOptionToggle = {
  key: ClientOptionToggleKey;
  label: string;
  description: string;
  type: "boolean";
  developerOnly?: boolean;
};

type ClientOptionSelect = {
  key:
    | "locale"
    | "tilesetMode"
    | "tilesetPath"
    | "antialiasing"
    | "inventoryFixedTileSize"
    | "desktopTouchInterfaceMode"
    | "bloodDetail";
  label: string;
  description: string;
  type: "select";
  disabled?: boolean;
  developerOnly?: boolean;
  options: {
    value: string;
    label: string;
  }[];
};

type ClientOptionSlider = {
  key:
    | "brightness"
    | "contrast"
    | "gamma"
    | "minimapScale"
    | "uiFontScale"
    | "liveMessageLogFontScale"
    | "desktopMessageLogWindowScale"
    | "controllerFpsMoveRepeatMs"
    | "fpsFov"
    | "fpsLookSensitivityX"
    | "fpsLookSensitivityY"
    | "bloodStrength"
    | "liveMessageDisplayTimeMs"
    | "liveMessageFadeOutTimeMs"
    | "manualMobileBottomSafeZoneVerticalPx"
    | "manualMobileBottomSafeZoneHorizontalPx"
    | "manualMobileRightSafeZoneHorizontalPx";
  label: string;
  description: string;
  type: "slider";
  min: number;
  max: number;
  step: number;
  developerOnly?: boolean;
};

type ClientOptionColor = {
  key: "bloodColorLightHex" | "bloodColorDarkHex" | "bloodMistColorHex";
  label: string;
  description: string;
  type: "color";
  developerOnly?: boolean;
};

type ClientOptionGroupHeader = {
  key: string;
  label: string;
  type: "group";
  developerOnly?: boolean;
};

type ClientOptionSectionHeader = {
  key: string;
  label: string;
  type: "section";
  developerOnly?: boolean;
};

type ClientOption =
  | ClientOptionGroupHeader
  | ClientOptionSectionHeader
  | ClientOptionToggle
  | ClientOptionSelect
  | ClientOptionSlider
  | ClientOptionColor;

type ClientOptionsTabId =
  | "display"
  | "mobile"
  | "controls"
  | "sound"
  | "combat"
  | "compatibility"
  | "updates";

type ClientOptionsTab = {
  id: ClientOptionsTabId;
  label: string;
  description: string;
  groupKey: string;
};
type ManualSafeZonePreview = {
  side: "bottom" | "right";
  sizePx: number;
};

type ClientOptionToggleKey =
  | "fpsMode"
  | "lightingEnabled"
  | "fpsFlattenEntityBillboards"
  | "fpsHeldWeaponVisible"
  | "fpsWasdKeyboardMovementEnabled"
  | "showItemsUnderPlayerInOverheadTilesMode"
  | "controllerEnabled"
  | "invertLookYAxis"
  | "cameraRelativeMovement"
  | "snapCameraYawToNearest45"
  | "invertTouchPanningDirection"
  | "disableAnimatedTransitions"
  | "uiTileBackgroundRemoval"
  | "minimap"
  | "reduceInventoryMotion"
  | "inventoryTileOnlyMotion"
  | "damageNumbers"
  | "displayStatChangesAbovePlayer"
  | "displayXpGainsAbovePlayer"
  | "tileShakeOnHit"
  | "bloodMist"
  | "bloodGround"
  | "monsterShatter"
  | "monsterShatterBloodBorders"
  | "liveMessageLog"
  | "showPersistentMobileMessageLog"
  | "rumbleEnabled"
  | "manualMobileBottomSafeZoneEnabled"
  | "showVersionNotificationsOnLaunch"
  | "soundEnabled"
  | "blockAmbientOcclusion"
  | "darkCorridorWalls367"
  | "overrideNh5DarkCorridorWallTiles"
  | "darkCorridorWallTileOverrideEnabled"
  | "darkCorridorWallSolidColorOverrideEnabled";

type ClientOptionLookSensitivityKey =
  | "fpsLookSensitivityX"
  | "fpsLookSensitivityY";

type ControllerRemapSlotIndex = 0 | 1;

type ControllerRemapListeningState = {
  actionId: Nh3dControllerActionId;
  slotIndex: ControllerRemapSlotIndex;
  startedAtMs: number;
  blockedBindings: Nh3dControllerBinding[];
};

type InventoryCategoryId =
  | "illegal_objects"
  | "weapons"
  | "armor"
  | "rings"
  | "amulets"
  | "tools"
  | "comestibles"
  | "potions"
  | "scrolls"
  | "spellbooks"
  | "wands"
  | "coins"
  | "gems_stones"
  | "boulders_statues"
  | "iron_balls"
  | "chains"
  | "venoms"
  | "bagged_boxed_items";

const inventoryContextActions: InventoryContextAction[] = [
  { id: "apply", label: t.inventoryContextActions.apply },
  {
    id: "invoke",
    label: t.inventoryContextActions.invoke,
    kind: "extended",
    value: "invoke",
  },
  {
    id: "tip",
    label: t.inventoryContextActions.tip,
    kind: "extended",
    value: "tip",
  },
  {
    id: "loot",
    label: t.inventoryContextActions.loot,
    kind: "extended",
    value: "loot",
    armInventorySelection: false,
  },
  { id: "drop", label: t.inventoryContextActions.drop },
  { id: "eat", label: t.inventoryContextActions.eat },
  { id: "quaff", label: t.inventoryContextActions.quaff },
  { id: "read", label: t.inventoryContextActions.read },
  {
    id: "rub",
    label: t.inventoryContextActions.rub,
    kind: "extended",
    value: "rub",
  },
  { id: "throw", label: t.inventoryContextActions.throw },
  { id: "wield", label: t.inventoryContextActions.wield },
  { id: "quiver", label: t.inventoryContextActions.quiver },
  { id: "wear", label: t.inventoryContextActions.wear },
  { id: "take-off", label: t.inventoryContextActions.takeOff },
  { id: "put-on", label: t.inventoryContextActions.putOn },
  { id: "remove", label: t.inventoryContextActions.remove },
  { id: "zap", label: t.inventoryContextActions.zap },
  {
    id: "untrap",
    label: t.inventoryContextActions.untrap,
    kind: "extended",
    value: "untrap",
    armInventorySelection: false,
  },
  {
    id: "offer",
    label: t.inventoryContextActions.offer,
    kind: "extended",
    value: "offer",
    armInventorySelection: false,
  },
  {
    id: "name",
    label: t.inventoryContextActions.name,
    kind: "extended",
    value: "name",
  },
  {
    id: "call",
    label: t.inventoryContextActions.call,
    kind: "extended",
    value: "call",
  },
  {
    id: "adjust",
    label: t.inventoryContextActions.adjust,
    kind: "extended",
    value: "adjust",
  },
  {
    id: "engrave",
    label: t.inventoryContextActions.engrave,
    kind: "extended",
    value: "engrave",
  },
  {
    id: "dip",
    label: t.inventoryContextActions.dip,
    kind: "extended",
    value: "dip",
  },
  { id: "info", label: t.inventoryContextActions.info },
];

const emptyInventoryActionIdSet: ReadonlySet<string> = new Set<string>();

const inventoryCategoryActionBlocklist: Record<
  InventoryCategoryId,
  ReadonlySet<string>
> = {
  illegal_objects: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
  ]),
  weapons: new Set([
    "quaff",
    "eat",
    "read",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
  ]),
  armor: new Set([
    "quaff",
    "eat",
    "read",
    "engrave",
    "put-on",
    "remove",
    "zap",
    "wield",
  ]),
  rings: new Set(["quaff", "wear", "take-off", "zap", "read", "eat", "wield"]),
  amulets: new Set([
    "quaff",
    "wear",
    "take-off",
    "zap",
    "read",
    "eat",
    "wield",
  ]),
  tools: new Set([
    "quaff",
    "wear",
    "take-off",
    "zap",
    "read",
    "put-on",
    "remove",
    "eat",
  ]),
  comestibles: new Set([
    "quaff",
    "read",
    "engrave",
    "wield",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
  ]),
  potions: new Set([
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "read",
    "eat",
  ]),
  scrolls: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "eat",
    "wield",
  ]),
  spellbooks: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "eat",
    "wield",
  ]),
  wands: new Set(["quaff", "wear", "take-off", "put-on", "remove", "wield"]),
  coins: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "read",
    "dip",
    "wield",
  ]),
  gems_stones: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "eat",
    "read",
    "wield",
  ]),
  boulders_statues: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "eat",
    "wield",
  ]),
  iron_balls: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "eat",
    "read",
    "wield",
  ]),
  chains: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "read",
    "wield",
  ]),
  venoms: new Set(["wear", "take-off", "put-on", "remove", "zap"]),
  // Mixed contents; keep this category permissive.
  bagged_boxed_items: emptyInventoryActionIdSet,
};

function normalizeInventoryCategoryLabel(raw: unknown): string {
  return String(raw || "")
    .replace(/[\s:]+$/g, "")
    .trim();
}

function classifyInventoryCategory(
  categoryLabel: string,
): InventoryCategoryId | null {
  const normalized =
    normalizeInventoryCategoryLabel(categoryLabel).toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("illegal object")) {
    return "illegal_objects";
  }
  if (normalized.startsWith("weapon")) {
    return "weapons";
  }
  if (normalized.startsWith("armor")) {
    return "armor";
  }
  if (normalized.startsWith("ring")) {
    return "rings";
  }
  if (normalized.startsWith("amulet")) {
    return "amulets";
  }
  if (normalized.startsWith("tool")) {
    return "tools";
  }
  if (normalized.startsWith("comestible")) {
    return "comestibles";
  }
  if (normalized.startsWith("potion")) {
    return "potions";
  }
  if (normalized.startsWith("scroll")) {
    return "scrolls";
  }
  if (normalized.startsWith("spellbook")) {
    return "spellbooks";
  }
  if (normalized.startsWith("wand")) {
    return "wands";
  }
  if (normalized.startsWith("coin")) {
    return "coins";
  }
  if (normalized.includes("gem") || normalized.includes("stone")) {
    return "gems_stones";
  }
  if (normalized.includes("boulder") || normalized.includes("statue")) {
    return "boulders_statues";
  }
  if (normalized.includes("iron ball")) {
    return "iron_balls";
  }
  if (normalized.includes("chain")) {
    return "chains";
  }
  if (normalized.includes("venom")) {
    return "venoms";
  }
  if (normalized.includes("bagged") || normalized.includes("boxed")) {
    return "bagged_boxed_items";
  }
  return null;
}

function getBlockedInventoryActionIdsForCategory(
  categoryLabel: string,
): ReadonlySet<string> {
  const categoryId = classifyInventoryCategory(categoryLabel);
  if (!categoryId) {
    return emptyInventoryActionIdSet;
  }
  return (
    inventoryCategoryActionBlocklist[categoryId] ?? emptyInventoryActionIdSet
  );
}

// NetHack 3.6.7 #rub accepts:
// - TOOL_CLASS: oil lamp, magic lamp, brass lantern
// - GEM_CLASS: graystones (luckstone/loadstone/touchstone/flint, including "gray stone")
function inventoryItemSupportsRub(
  categoryId: InventoryCategoryId | null,
  itemText: string,
): boolean {
  const normalizedText = String(itemText || "")
    .trim()
    .toLowerCase();
  if (!normalizedText) {
    return false;
  }

  const isLampOrLantern =
    /\b(?:oil lamp|magic lamp|brass lantern|lamp|lantern)s?\b/i.test(
      normalizedText,
    );
  const isGraystone =
    /\b(?:gray stone(?:s)?|luckstone(?:s)?|loadstone(?:s)?|touchstone(?:s)?|flint(?: stones?)?)\b/i.test(
      normalizedText,
    );

  if (categoryId === "tools") {
    return isLampOrLantern;
  }
  if (categoryId === "gems_stones") {
    return isGraystone;
  }
  if (categoryId === "bagged_boxed_items" || !categoryId) {
    return isLampOrLantern || isGraystone;
  }
  return false;
}

function inventoryItemLooksLikeContainer(itemText: string): boolean {
  return /\b(?:sack|bag|box|chest|ice box|large box|bag of holding|oilskin sack)s?\b/i.test(
    itemText,
  );
}

function inventoryItemSupportsTip(
  categoryId: InventoryCategoryId | null,
  itemText: string,
): boolean {
  const normalizedText = String(itemText || "")
    .trim()
    .toLowerCase();
  if (!normalizedText) {
    return false;
  }

  const isHornOfPlenty = /\bhorn of plenty\b/i.test(normalizedText);
  if (isHornOfPlenty) {
    return true;
  }

  if (categoryId === "tools" || categoryId === "bagged_boxed_items") {
    return inventoryItemLooksLikeContainer(normalizedText);
  }
  return false;
}

function inventoryItemSupportsLoot(
  categoryId: InventoryCategoryId | null,
  itemText: string,
): boolean {
  if (categoryId !== "tools" && categoryId !== "bagged_boxed_items") {
    return false;
  }
  return inventoryItemLooksLikeContainer(String(itemText || "").toLowerCase());
}

function inventoryItemSupportsUntrap(itemText: string): boolean {
  const normalizedText = String(itemText || "")
    .trim()
    .toLowerCase();
  if (!normalizedText) {
    return false;
  }
  return /\b(?:can of grease|potion(?:s)? of oil)\b/i.test(normalizedText);
}

function inventoryItemSupportsOffer(itemText: string): boolean {
  const normalizedText = String(itemText || "")
    .trim()
    .toLowerCase();
  if (!normalizedText) {
    return false;
  }
  return /\b(?:corpse|(?:fake )?amulet of yendor)\b/i.test(normalizedText);
}

function inventoryItemSupportsInvoke(
  categoryId: InventoryCategoryId | null,
  itemText: string,
): boolean {
  const normalizedText = String(itemText || "")
    .trim()
    .toLowerCase();
  if (!normalizedText) {
    return false;
  }

  if (
    /\b(?:crystal ball|magic lamp|oil lamp|brass lantern|mirror|bell of opening|candelabrum of invocation|book of the dead|(?:fake )?amulet of yendor)\b/i.test(
      normalizedText,
    )
  ) {
    return true;
  }

  return (
    categoryId === "weapons" ||
    categoryId === "armor" ||
    categoryId === "rings" ||
    categoryId === "amulets" ||
    categoryId === "tools" ||
    categoryId === "spellbooks"
  );
}

function inventoryItemSupportsCall(
  categoryId: InventoryCategoryId | null,
): boolean {
  return (
    categoryId === "scrolls" ||
    categoryId === "potions" ||
    categoryId === "wands" ||
    categoryId === "rings" ||
    categoryId === "amulets" ||
    categoryId === "gems_stones" ||
    categoryId === "spellbooks" ||
    categoryId === "armor" ||
    categoryId === "tools"
  );
}

function parseInventoryStackCount(itemText: string): number | null {
  const normalized = String(itemText || "").trim();
  if (!normalized) {
    return null;
  }
  const match = normalized.match(/^(\d+)\b/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed <= 1) {
    return null;
  }
  return parsed;
}

function inventoryItemSupportsContextAction(
  actionId: string,
  categoryId: InventoryCategoryId | null,
  itemText: string,
): boolean {
  switch (actionId) {
    case "rub":
      return inventoryItemSupportsRub(categoryId, itemText);
    case "tip":
      return inventoryItemSupportsTip(categoryId, itemText);
    case "loot":
      return inventoryItemSupportsLoot(categoryId, itemText);
    case "invoke":
      return inventoryItemSupportsInvoke(categoryId, itemText);
    case "offer":
      return inventoryItemSupportsOffer(itemText);
    case "untrap":
      return inventoryItemSupportsUntrap(itemText);
    case "call":
      return inventoryItemSupportsCall(categoryId);
    case "name":
    case "adjust":
      return true;
    default:
      return true;
  }
}

const mobileDefaultFpsLookSensitivity = 1.35;
const nh3dClientOptionsStorageKey = "nh3d-client-options:v1";
const controllerCaptureButtonThreshold = 0.7;
const controllerCaptureAxisThreshold = 0.72;
const controllerCaptureIgnoreDurationMs = 150;
const startupControllerActionThreshold = 0.5;
const startupControllerScrollSpeedPxPerSec = 1150;
const startupControllerCursorDeadzone = 0.2;
const startupControllerCursorSpeedPxPerSec = 820;
const startupControllerSliderFastStepsPerSec = 13;
const controllerActionGroupOrder: Nh3dControllerActionGroupId[] = [
  "movement",
  "lookAndCamera",
  "actions",
  "dialogs",
  "system",
];
const startupControllerNavActionIds: readonly Nh3dControllerActionId[] = [
  "dpad_up",
  "dpad_down",
  "dpad_left",
  "dpad_right",
  "left_stick_up",
  "left_stick_down",
  "left_stick_left",
  "left_stick_right",
  "right_stick_up",
  "right_stick_down",
  "confirm",
  "cancel_or_context",
];

function getConnectedGamepadsForCapture(): Gamepad[] {
  if (typeof navigator === "undefined" || !navigator.getGamepads) {
    return [];
  }
  const gamepads = navigator.getGamepads();
  if (!gamepads || gamepads.length === 0) {
    return [];
  }
  const connected: Gamepad[] = [];
  for (const gamepad of gamepads) {
    if (gamepad && gamepad.connected) {
      connected.push(gamepad);
    }
  }
  return connected;
}

function sampleActiveControllerBindingCandidates(
  buttonThreshold: number = controllerCaptureButtonThreshold,
  axisThreshold: number = controllerCaptureAxisThreshold,
): Nh3dControllerBinding[] {
  const gamepads = getConnectedGamepadsForCapture();
  if (gamepads.length === 0) {
    return [];
  }
  const maxMagnitudeByBinding = new Map<Nh3dControllerBinding, number>();
  for (const gamepad of gamepads) {
    const buttons = Array.isArray(gamepad.buttons) ? gamepad.buttons : [];
    for (let buttonIndex = 0; buttonIndex < buttons.length; buttonIndex += 1) {
      const button = buttons[buttonIndex];
      if (!button) {
        continue;
      }
      const rawValue = button.pressed ? 1 : button.value;
      const value =
        typeof rawValue === "number" && Number.isFinite(rawValue)
          ? Math.max(0, Math.min(1, rawValue))
          : 0;
      if (value < buttonThreshold) {
        continue;
      }
      const binding = createButtonBinding(buttonIndex);
      const previousMagnitude = maxMagnitudeByBinding.get(binding) ?? 0;
      if (value > previousMagnitude) {
        maxMagnitudeByBinding.set(binding, value);
      }
    }

    const axes = Array.isArray(gamepad.axes) ? gamepad.axes : [];
    for (let axisIndex = 0; axisIndex < axes.length; axisIndex += 1) {
      const rawAxisValue = axes[axisIndex];
      if (!Number.isFinite(rawAxisValue)) {
        continue;
      }
      const magnitude = Math.abs(rawAxisValue);
      if (magnitude < axisThreshold) {
        continue;
      }
      const direction: -1 | 1 = rawAxisValue < 0 ? -1 : 1;
      const binding = createAxisBinding(axisIndex, direction);
      const previousMagnitude = maxMagnitudeByBinding.get(binding) ?? 0;
      if (magnitude > previousMagnitude) {
        maxMagnitudeByBinding.set(binding, magnitude);
      }
    }
  }
  return [...maxMagnitudeByBinding.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([binding]) => binding);
}

function getControllerBindingValueFromGamepad(
  gamepad: Gamepad,
  binding: Nh3dControllerBinding | null | undefined,
  axisDeadzone: number = 0.35,
): number {
  if (!binding) {
    return 0;
  }
  const parsedBinding = parseNh3dControllerBinding(binding);
  if (!parsedBinding) {
    return 0;
  }
  if (parsedBinding.kind === "button") {
    const button = gamepad.buttons[parsedBinding.index];
    if (!button) {
      return 0;
    }
    const rawButtonValue = button.pressed ? 1 : button.value;
    if (!Number.isFinite(rawButtonValue)) {
      return 0;
    }
    return Math.max(0, Math.min(1, rawButtonValue));
  }
  const rawAxisValue = gamepad.axes[parsedBinding.index];
  if (!Number.isFinite(rawAxisValue)) {
    return 0;
  }
  const directionalValue = rawAxisValue * parsedBinding.direction;
  if (directionalValue <= axisDeadzone) {
    return 0;
  }
  const normalizedValue =
    (directionalValue - axisDeadzone) / (1 - axisDeadzone);
  return Math.max(0, Math.min(1, normalizedValue));
}

function getControllerActionValueFromGamepads(
  actionId: Nh3dControllerActionId,
  bindings: Nh3dControllerBindings,
  gamepads: readonly Gamepad[],
): number {
  const slots = bindings[actionId];
  if (!slots) {
    return 0;
  }
  let maxValue = 0;
  for (const gamepad of gamepads) {
    const firstValue = getControllerBindingValueFromGamepad(gamepad, slots[0]);
    const secondValue = getControllerBindingValueFromGamepad(gamepad, slots[1]);
    maxValue = Math.max(maxValue, firstValue, secondValue);
    if (maxValue >= 1) {
      return 1;
    }
  }
  return Math.max(0, Math.min(1, maxValue));
}

function getTopVisibleControllerDialogElement(): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".nh3d-dialog.is-visible, #position-dialog.is-visible",
    ),
  );
  if (candidates.length === 0) {
    return null;
  }
  let best = candidates[0];
  let bestZIndex =
    Number.parseInt(window.getComputedStyle(best).zIndex, 10) || 0;
  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const zIndex =
      Number.parseInt(window.getComputedStyle(candidate).zIndex, 10) || 0;
    if (zIndex > bestZIndex || (zIndex === bestZIndex && index > 0)) {
      best = candidate;
      bestZIndex = zIndex;
    }
  }
  return best;
}

function getControllerFocusableElements(root: HTMLElement): HTMLElement[] {
  const selector = [
    "button:not(:disabled)",
    "summary",
    "a[href]",
    "input:not(:disabled):not([tabindex='-1'])",
    "select:not(:disabled)",
    "textarea:not(:disabled)",
    '[role="button"][tabindex]:not([tabindex="-1"])',
    "[tabindex]:not([tabindex='-1'])",
  ].join(", ");
  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
  return elements.filter((element) => {
    if (!element.isConnected) {
      return false;
    }
    let current: HTMLElement | null = element;
    while (current && current !== root) {
      const parentElement: HTMLElement | null = current.parentElement;
      if (parentElement instanceof HTMLDetailsElement && !parentElement.open) {
        const isSummaryOfClosedDetails =
          current.tagName === "SUMMARY" &&
          current.parentElement === parentElement;
        if (!isSummaryOfClosedDetails) {
          return false;
        }
      }
      current = parentElement;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    return element.getClientRects().length > 0;
  });
}

function isControllerScrollableElement(element: HTMLElement): boolean {
  if (element.scrollHeight <= element.clientHeight + 2) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return (
    style.overflowY === "auto" ||
    style.overflowY === "scroll" ||
    style.overflowY === "overlay"
  );
}

function findNearestControllerScrollableAncestor(
  element: HTMLElement,
  boundary: HTMLElement,
): HTMLElement | null {
  let current: HTMLElement | null = element;
  while (current && current !== boundary) {
    if (isControllerScrollableElement(current)) {
      return current;
    }
    current = current.parentElement;
  }
  if (isControllerScrollableElement(boundary)) {
    return boundary;
  }
  return null;
}

function getControllerDialogFixedActionButtons(
  dialogRoot: HTMLElement,
): HTMLElement[] {
  const selector = [
    ".nh3d-menu-actions button:not(:disabled)",
    ".nh3d-pickup-actions button:not(:disabled)",
    ".nh3d-menu-actions [role='button'][tabindex]:not([tabindex='-1'])",
    ".nh3d-pickup-actions [role='button'][tabindex]:not([tabindex='-1'])",
  ].join(", ");
  const candidates = Array.from(
    dialogRoot.querySelectorAll<HTMLElement>(selector),
  );
  return candidates.filter((candidate) => {
    if (!candidate.isConnected) {
      return false;
    }
    const style = window.getComputedStyle(candidate);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    return candidate.getClientRects().length > 0;
  });
}

function focusControllerDialogElement(target: HTMLElement): void {
  target.focus();
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function findDirectionalControllerFocusTarget(
  source: HTMLElement,
  candidates: readonly HTMLElement[],
  direction: "left" | "right",
): HTMLElement | null {
  const sourceRect = source.getBoundingClientRect();
  const sourceCenterX = sourceRect.left + sourceRect.width * 0.5;
  const sourceCenterY = sourceRect.top + sourceRect.height * 0.5;
  const minHorizontalDelta = 8;
  let bestTarget: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate === source) {
      continue;
    }
    const rect = candidate.getBoundingClientRect();
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.5;
    const dx = centerX - sourceCenterX;
    if (direction === "right" && dx <= minHorizontalDelta) {
      continue;
    }
    if (direction === "left" && dx >= -minHorizontalDelta) {
      continue;
    }
    const horizontalDistance = Math.abs(dx);
    const verticalDistance = Math.abs(centerY - sourceCenterY);
    const score = horizontalDistance + verticalDistance * 2;
    if (score < bestScore) {
      bestScore = score;
      bestTarget = candidate;
    }
  }

  return bestTarget;
}

function moveClientOptionsDialogFocus(
  dialogRoot: HTMLElement,
  activeElement: HTMLElement,
  direction: "up" | "down" | "left" | "right",
): boolean {
  if (direction !== "left" && direction !== "right") {
    return false;
  }
  if (dialogRoot.id !== "nh3d-client-options-dialog") {
    return false;
  }

  const nav = dialogRoot.querySelector<HTMLElement>(".nh3d-options-nav");
  const panel = dialogRoot.querySelector<HTMLElement>(".nh3d-options-panel");
  if (!nav || !panel) {
    return false;
  }

  const navTabs = getControllerFocusableElements(nav).filter((element) =>
    element.classList.contains("nh3d-options-tab"),
  );
  const panelFocusable = getControllerFocusableElements(panel).filter(
    (element) =>
      !element.classList.contains("nh3d-mobile-dialog-close") &&
      !element.closest(".nh3d-options-panel-heading"),
  );
  if (navTabs.length === 0 || panelFocusable.length === 0) {
    return false;
  }

  if (direction === "right" && nav.contains(activeElement)) {
    const target =
      findDirectionalControllerFocusTarget(
        activeElement,
        panelFocusable,
        "right",
      ) ?? panelFocusable[0];
    if (!target) {
      return false;
    }
    focusControllerDialogElement(target);
    return true;
  }

  if (direction === "left" && panel.contains(activeElement)) {
    const leftTarget = findDirectionalControllerFocusTarget(
      activeElement,
      panelFocusable,
      "left",
    );
    if (leftTarget) {
      focusControllerDialogElement(leftTarget);
      return true;
    }
    const selectedTab =
      nav.querySelector<HTMLElement>(".nh3d-options-tab.is-selected") ??
      navTabs[0];
    if (!selectedTab) {
      return false;
    }
    focusControllerDialogElement(selectedTab);
    return true;
  }

  return false;
}

function moveControllerDialogFocus(
  direction: "up" | "down" | "left" | "right",
): boolean {
  const topDialog = getTopVisibleControllerDialogElement();
  if (!topDialog) {
    return false;
  }
  const focusable = getControllerFocusableElements(topDialog);
  if (focusable.length === 0) {
    return false;
  }
  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const activeInDialog =
    activeElement && topDialog.contains(activeElement) ? activeElement : null;
  if (
    activeInDialog &&
    moveClientOptionsDialogFocus(topDialog, activeInDialog, direction)
  ) {
    return true;
  }
  const fixedActionButtons = getControllerDialogFixedActionButtons(topDialog);
  const activeIsFixedAction =
    !!activeInDialog &&
    fixedActionButtons.some((button) => button === activeInDialog);

  if (
    activeIsFixedAction &&
    (direction === "left" || direction === "right") &&
    fixedActionButtons.length > 0
  ) {
    const activeFixedIndex = activeInDialog
      ? fixedActionButtons.findIndex((button) => button === activeInDialog)
      : -1;
    const fixedDelta = direction === "left" ? -1 : 1;
    const targetFixedIndex =
      activeFixedIndex < 0
        ? fixedDelta > 0
          ? 0
          : fixedActionButtons.length - 1
        : (((activeFixedIndex + fixedDelta) % fixedActionButtons.length) +
            fixedActionButtons.length) %
          fixedActionButtons.length;
    const targetFixedButton = fixedActionButtons[targetFixedIndex];
    if (targetFixedButton) {
      focusControllerDialogElement(targetFixedButton);
      return true;
    }
  }

  if (
    (direction === "down" || direction === "right") &&
    activeInDialog &&
    !activeIsFixedAction &&
    fixedActionButtons.length > 0
  ) {
    const nearestScrollable = findNearestControllerScrollableAncestor(
      activeInDialog,
      topDialog,
    );
    const atScrollableEnd =
      !!nearestScrollable &&
      nearestScrollable.scrollTop + nearestScrollable.clientHeight >=
        nearestScrollable.scrollHeight - 2;
    const atLastScrollableFocusable =
      !!nearestScrollable &&
      (() => {
        const scrollableFocusable = getControllerFocusableElements(
          nearestScrollable,
        ).filter(
          (element) => !fixedActionButtons.some((button) => button === element),
        );
        if (scrollableFocusable.length === 0) {
          return false;
        }
        return (
          scrollableFocusable[scrollableFocusable.length - 1] === activeInDialog
        );
      })();
    if (atScrollableEnd && atLastScrollableFocusable) {
      const targetButton = fixedActionButtons[0];
      focusControllerDialogElement(targetButton);
      return true;
    }
  }

  if (direction === "up" && activeIsFixedAction) {
    const topScrollable = findControllerScrollableElement(topDialog);
    if (topScrollable) {
      const scrollableFocusable = getControllerFocusableElements(
        topScrollable,
      ).filter(
        (element) => !fixedActionButtons.some((button) => button === element),
      );
      const fallbackTarget =
        scrollableFocusable[scrollableFocusable.length - 1] ??
        focusable[focusable.length - 1];
      if (fallbackTarget) {
        focusControllerDialogElement(fallbackTarget);
        return true;
      }
    }
  }

  const activeIndex = activeInDialog ? focusable.indexOf(activeInDialog) : -1;
  const delta = direction === "up" || direction === "left" ? -1 : 1;
  let nextIndex: number;
  if (activeIndex < 0) {
    nextIndex = delta > 0 ? 0 : focusable.length - 1;
  } else {
    nextIndex =
      (((activeIndex + delta) % focusable.length) + focusable.length) %
      focusable.length;
  }
  const nextElement = focusable[nextIndex];
  if (nextElement) {
    focusControllerDialogElement(nextElement);
  }
  return true;
}

function clickFocusedControllerDialogElement(): HTMLElement | null {
  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  if (activeElement && typeof activeElement.click === "function") {
    activeElement.click();
    return activeElement;
  }
  const topDialog = getTopVisibleControllerDialogElement();
  if (!topDialog) {
    return null;
  }
  const focusable = getControllerFocusableElements(topDialog);
  const first = focusable[0];
  if (!first) {
    return null;
  }
  first.focus();
  first.scrollIntoView({ block: "nearest", inline: "nearest" });
  first.click();
  return first;
}

function clickControllerDialogElementAtPoint(
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const target = document.elementFromPoint(clientX, clientY);
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  const clickableSelector = [
    "button",
    "summary",
    "[role='button']",
    "a",
    "input:not([tabindex='-1'])",
    "select",
    "textarea",
    "label",
    "[tabindex]",
  ].join(", ");
  const clickable = target.closest(clickableSelector) ?? target;
  if (!(clickable instanceof HTMLElement)) {
    return null;
  }
  clickable.focus();
  clickable.scrollIntoView({ block: "nearest", inline: "nearest" });
  clickable.click();
  return clickable;
}

function getFocusedControllerRangeInput(
  dialogRoot: HTMLElement | null,
): HTMLInputElement | null {
  if (!dialogRoot) {
    return null;
  }
  const activeElement =
    document.activeElement instanceof HTMLInputElement
      ? document.activeElement
      : null;
  if (!activeElement || !dialogRoot.contains(activeElement)) {
    return null;
  }
  if (activeElement.type !== "range" || activeElement.disabled) {
    return null;
  }
  return activeElement;
}

function stepControllerRangeInput(
  slider: HTMLInputElement,
  stepCount: number,
): boolean {
  if (!Number.isFinite(stepCount) || stepCount === 0 || slider.disabled) {
    return false;
  }
  const minValue = Number.parseFloat(slider.min);
  const maxValue = Number.parseFloat(slider.max);
  const min = Number.isFinite(minValue) ? minValue : 0;
  const max = Number.isFinite(maxValue) ? maxValue : 100;
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const stepValue = Number.parseFloat(slider.step);
  const step = Number.isFinite(stepValue) && stepValue > 0 ? stepValue : 1;
  const currentValue = Number.parseFloat(slider.value);
  const current = Number.isFinite(currentValue) ? currentValue : low;
  const normalizedStepCount =
    stepCount > 0 ? Math.floor(stepCount) : Math.ceil(stepCount);
  if (normalizedStepCount === 0) {
    return false;
  }
  const currentIndex = Math.round((current - low) / step);
  const nextValue = Math.max(
    low,
    Math.min(high, low + (currentIndex + normalizedStepCount) * step),
  );
  if (Math.abs(nextValue - current) < step * 0.001) {
    return false;
  }
  slider.value = String(nextValue);
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  slider.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function maintainControllerDialogFocusAfterKeyboardScroll(
  scrollElement: HTMLElement,
  direction: "up" | "down",
): void {
  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  if (!activeElement || !scrollElement.contains(activeElement)) {
    return;
  }

  const activeRect = activeElement.getBoundingClientRect();
  const scrollRect = scrollElement.getBoundingClientRect();
  const isVisibleInScrollFrame =
    activeRect.bottom > scrollRect.top + 2 &&
    activeRect.top < scrollRect.bottom - 2;
  if (isVisibleInScrollFrame) {
    return;
  }

  const focusableInScrollElement =
    getControllerFocusableElements(scrollElement);
  if (focusableInScrollElement.length === 0) {
    return;
  }

  const visibleFocusable = focusableInScrollElement.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > scrollRect.top + 2 && rect.top < scrollRect.bottom - 2;
  });
  if (visibleFocusable.length === 0) {
    return;
  }

  const targetElement =
    direction === "down"
      ? visibleFocusable[0]
      : visibleFocusable[visibleFocusable.length - 1];
  if (targetElement && targetElement !== activeElement) {
    focusControllerDialogElement(targetElement);
  }
}

function handleControllerDialogKeyboardScrollKey(
  dialogRoot: HTMLElement,
  key: string,
): boolean {
  if (
    key !== "Home" &&
    key !== "End" &&
    key !== "PageUp" &&
    key !== "PageDown"
  ) {
    return false;
  }

  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  let scrollElement: HTMLElement | null = null;
  if (activeElement && dialogRoot.contains(activeElement)) {
    scrollElement = findNearestControllerScrollableAncestor(
      activeElement,
      dialogRoot,
    );
  }
  if (!scrollElement) {
    scrollElement = findControllerScrollableElement(dialogRoot);
  }
  if (!scrollElement) {
    return false;
  }

  const direction: "up" | "down" =
    key === "Home" || key === "PageUp" ? "up" : "down";
  if (key === "Home") {
    scrollElement.scrollTop = 0;
  } else if (key === "End") {
    scrollElement.scrollTop = scrollElement.scrollHeight;
  } else {
    const pageDeltaPx = Math.max(
      96,
      Math.round(scrollElement.clientHeight * 0.9),
    );
    const scrollDelta = direction === "down" ? pageDeltaPx : -pageDeltaPx;
    scrollElement.scrollTop += scrollDelta;
  }

  maintainControllerDialogFocusAfterKeyboardScroll(scrollElement, direction);
  return true;
}

function findControllerScrollableElement(
  root: HTMLElement | null,
): HTMLElement | null {
  if (!root) {
    return null;
  }
  if (isControllerScrollableElement(root)) {
    return root;
  }
  const descendants = Array.from(root.querySelectorAll<HTMLElement>("*"));
  for (const descendant of descendants) {
    if (isControllerScrollableElement(descendant)) {
      return descendant;
    }
  }
  return null;
}

const clientOptionsConfig: ClientOption[] = [
  {
    key: "group-controls",
    label: t.clientOptions.config.groupControls,
    type: "group",
  },
  {
    key: "section-controls-controller",
    label: t.clientOptions.config.sectionControlsController,
    type: "section",
  },
  {
    key: "controllerEnabled",
    label: t.clientOptions.config.controllerEnabled.label,
    description: t.clientOptions.config.controllerEnabled.description,
    type: "boolean",
  },
  {
    key: "section-controls-look",
    label: t.clientOptions.config.sectionControlsLook,
    type: "section",
  },
  {
    key: "invertLookYAxis",
    label: t.clientOptions.config.invertLookYAxis.label,
    description: t.clientOptions.config.invertLookYAxis.description,
    type: "boolean",
  },
  {
    key: "invertTouchPanningDirection",
    label: t.clientOptions.config.invertTouchPanningDirection.label,
    description: t.clientOptions.config.invertTouchPanningDirection.description,
    type: "boolean",
  },
  {
    key: "fpsLookSensitivityX",
    label: t.clientOptions.config.fpsLookSensitivityX.label,
    description: t.clientOptions.config.fpsLookSensitivityX.description,
    type: "slider",
    min: nh3dFpsLookSensitivityMin,
    max: nh3dFpsLookSensitivityMax,
    step: 0.01,
  },
  {
    key: "fpsLookSensitivityY",
    label: t.clientOptions.config.fpsLookSensitivityY.label,
    description: t.clientOptions.config.fpsLookSensitivityY.description,
    type: "slider",
    min: nh3dFpsLookSensitivityMin,
    max: nh3dFpsLookSensitivityMax,
    step: 0.01,
  },
  {
    key: "snapCameraYawToNearest45",
    label: t.clientOptions.config.snapCameraYawToNearest45.label,
    description: t.clientOptions.config.snapCameraYawToNearest45.description,
    type: "boolean",
  },
  {
    key: "section-controls-movement",
    label: t.clientOptions.config.sectionControlsMovement,
    type: "section",
  },
  {
    key: "cameraRelativeMovement",
    label: t.clientOptions.config.cameraRelativeMovement.label,
    description: t.clientOptions.config.cameraRelativeMovement.description,
    type: "boolean",
  },
  {
    key: "fpsWasdKeyboardMovementEnabled",
    label: t.clientOptions.config.fpsWasdKeyboardMovementEnabled.label,
    description:
      t.clientOptions.config.fpsWasdKeyboardMovementEnabled.description,
    type: "boolean",
  },
  {
    key: "controllerFpsMoveRepeatMs",
    label: t.clientOptions.config.controllerFpsMoveRepeatMs.label,
    description: t.clientOptions.config.controllerFpsMoveRepeatMs.description,
    type: "slider",
    min: 80,
    max: 900,
    step: 10,
  },
  {
    key: "group-interface",
    label: t.clientOptions.config.groupInterface,
    type: "group",
  },
  {
    key: "locale",
    label: t.clientOptions.config.locale.label,
    description: t.clientOptions.config.locale.description,
    type: "select",
    options: supportedLocaleOptions,
  },
  {
    key: "section-display-camera",
    label: t.clientOptions.config.sectionDisplayCamera,
    type: "section",
  },
  {
    key: "fpsMode",
    label: t.clientOptions.config.fpsMode.label,
    description: t.clientOptions.config.fpsMode.description,
    type: "boolean",
  },
  {
    key: "fpsFlattenEntityBillboards",
    label: t.clientOptions.config.fpsFlattenEntityBillboards.label,
    description: t.clientOptions.config.fpsFlattenEntityBillboards.description,
    type: "boolean",
  },
  {
    key: "fpsHeldWeaponVisible",
    label: t.clientOptions.config.fpsHeldWeaponVisible.label,
    description: t.clientOptions.config.fpsHeldWeaponVisible.description,
    type: "boolean",
  },
  {
    key: "showItemsUnderPlayerInOverheadTilesMode",
    label: t.clientOptions.config.showItemsUnderPlayerInOverheadTilesMode.label,
    description:
      t.clientOptions.config.showItemsUnderPlayerInOverheadTilesMode
        .description,
    type: "boolean",
  },
  {
    key: "fpsFov",
    label: t.clientOptions.config.fpsFov.label,
    description: t.clientOptions.config.fpsFov.description,
    type: "slider",
    min: 45,
    max: 110,
    step: 1,
  },
  {
    key: "section-display-graphics",
    label: t.clientOptions.config.sectionDisplayGraphics,
    type: "section",
  },
  {
    key: "tilesetMode",
    label: t.clientOptions.config.tilesetMode.label,
    description: t.clientOptions.config.tilesetMode.description,
    type: "select",
    options: [
      {
        value: "ascii",
        label: t.clientOptions.config.tilesetMode.options.ascii,
      },
      {
        value: "tiles",
        label: t.clientOptions.config.tilesetMode.options.tiles,
      },
    ],
  },
  {
    key: "tilesetPath",
    label: t.clientOptions.config.tilesetPath.label,
    description: t.clientOptions.config.tilesetPath.description,
    type: "select",
    options: [],
    disabled: false,
  },
  {
    key: "antialiasing",
    label: t.clientOptions.config.antialiasing.label,
    description: t.clientOptions.config.antialiasing.description,
    type: "select",
    options: [
      {
        value: "taa",
        label: t.clientOptions.config.antialiasing.options.taa,
      },
      {
        value: "fxaa",
        label: t.clientOptions.config.antialiasing.options.fxaa,
      },
    ],
  },
  {
    key: "lightingEnabled",
    label: t.clientOptions.config.lightingEnabled.label,
    description: t.clientOptions.config.lightingEnabled.description,
    type: "boolean",
  },
  {
    key: "blockAmbientOcclusion",
    label: t.clientOptions.config.blockAmbientOcclusion.label,
    description: t.clientOptions.config.blockAmbientOcclusion.description,
    type: "boolean",
  },
  {
    key: "brightness",
    label: t.clientOptions.config.brightness.label,
    description: t.clientOptions.config.brightness.description,
    type: "slider",
    min: -0.25,
    max: 0.25,
    step: 0.01,
  },
  {
    key: "contrast",
    label: t.clientOptions.config.contrast.label,
    description: t.clientOptions.config.contrast.description,
    type: "slider",
    min: -0.25,
    max: 0.25,
    step: 0.01,
  },
  {
    key: "gamma",
    label: t.clientOptions.config.gamma.label,
    description: t.clientOptions.config.gamma.description,
    type: "slider",
    min: 0.5,
    max: 2.5,
    step: 0.01,
  },
  {
    key: "section-display-interface",
    label: t.clientOptions.config.sectionDisplayInterface,
    type: "section",
  },
  {
    key: "uiFontScale",
    label: t.clientOptions.config.uiFontScale.label,
    description: t.clientOptions.config.uiFontScale.description,
    type: "slider",
    min: 0.7,
    max: 1.8,
    step: 0.01,
  },
  {
    key: "disableAnimatedTransitions",
    label: t.clientOptions.config.disableAnimatedTransitions.label,
    description: t.clientOptions.config.disableAnimatedTransitions.description,
    type: "boolean",
  },
  {
    key: "uiTileBackgroundRemoval",
    label: t.clientOptions.config.uiTileBackgroundRemoval.label,
    description: t.clientOptions.config.uiTileBackgroundRemoval.description,
    type: "boolean",
  },
  {
    key: "desktopTouchInterfaceMode",
    label: t.clientOptions.config.desktopTouchInterfaceMode.label,
    description: t.clientOptions.config.desktopTouchInterfaceMode.description,
    type: "select",
    options: [
      {
        value: "off",
        label: t.clientOptions.config.desktopTouchInterfaceMode.options.off,
      },
      {
        value: "portrait",
        label:
          t.clientOptions.config.desktopTouchInterfaceMode.options.portrait,
      },
      {
        value: "landscape",
        label:
          t.clientOptions.config.desktopTouchInterfaceMode.options.landscape,
      },
    ],
  },
  {
    key: "section-display-messages",
    label: t.clientOptions.config.sectionDisplayMessages,
    type: "section",
  },
  {
    key: "desktopMessageLogWindowScale",
    label: t.clientOptions.config.desktopMessageLogWindowScale.label,
    description:
      t.clientOptions.config.desktopMessageLogWindowScale.description,
    type: "slider",
    min: 0.33,
    max: 1.5,
    step: 0.01,
  },
  {
    key: "liveMessageLog",
    label: t.clientOptions.config.liveMessageLog.label,
    description: t.clientOptions.config.liveMessageLog.description,
    type: "boolean",
  },
  {
    key: "liveMessageDisplayTimeMs",
    label: t.clientOptions.config.liveMessageDisplayTimeMs.label,
    description: t.clientOptions.config.liveMessageDisplayTimeMs.description,
    type: "slider",
    min: 250,
    max: 6000,
    step: 50,
  },
  {
    key: "liveMessageFadeOutTimeMs",
    label: t.clientOptions.config.liveMessageFadeOutTimeMs.label,
    description: t.clientOptions.config.liveMessageFadeOutTimeMs.description,
    type: "slider",
    min: 120,
    max: 4000,
    step: 20,
  },
  {
    key: "liveMessageLogFontScale",
    label: t.clientOptions.config.liveMessageLogFontScale.label,
    description: t.clientOptions.config.liveMessageLogFontScale.description,
    type: "slider",
    min: 0.7,
    max: 2.2,
    step: 0.01,
  },
  {
    key: "section-display-minimap",
    label: t.clientOptions.config.sectionDisplayMinimap,
    type: "section",
  },
  {
    key: "minimap",
    label: t.clientOptions.config.minimap.label,
    description: t.clientOptions.config.minimap.description,
    type: "boolean",
  },
  {
    key: "minimapScale",
    label: t.clientOptions.config.minimapScale.label,
    description: t.clientOptions.config.minimapScale.description,
    type: "slider",
    min: 0.6,
    max: 2.2,
    step: 0.01,
  },
  {
    key: "section-display-inventory",
    label: t.clientOptions.config.sectionDisplayInventory,
    type: "section",
  },
  {
    key: "reduceInventoryMotion",
    label: t.clientOptions.config.reduceInventoryMotion.label,
    description: t.clientOptions.config.reduceInventoryMotion.description,
    type: "boolean",
  },
  {
    key: "inventoryTileOnlyMotion",
    label: t.clientOptions.config.inventoryTileOnlyMotion.label,
    description: t.clientOptions.config.inventoryTileOnlyMotion.description,
    type: "boolean",
  },
  {
    key: "inventoryFixedTileSize",
    label: t.clientOptions.config.inventoryFixedTileSize.label,
    description: t.clientOptions.config.inventoryFixedTileSize.description,
    type: "select",
    options: [
      {
        value: "none",
        label: t.clientOptions.config.inventoryFixedTileSize.options.none,
      },
      {
        value: "small",
        label: t.clientOptions.config.inventoryFixedTileSize.options.small,
      },
      {
        value: "medium",
        label: t.clientOptions.config.inventoryFixedTileSize.options.medium,
      },
      {
        value: "large",
        label: t.clientOptions.config.inventoryFixedTileSize.options.large,
      },
    ],
  },
  {
    key: "group-mobile",
    label: t.clientOptions.config.groupMobileControls,
    type: "group",
  },
  {
    key: "section-mobile-messages",
    label: t.clientOptions.config.sectionDisplayMessages,
    type: "section",
  },
  {
    key: "showPersistentMobileMessageLog",
    label: t.clientOptions.config.showPersistentMobileMessageLog.label,
    description:
      t.clientOptions.config.showPersistentMobileMessageLog.description,
    type: "boolean",
  },
  {
    key: "rumbleEnabled",
    label: t.clientOptions.config.rumbleEnabled.label,
    description: t.clientOptions.config.rumbleEnabled.description,
    type: "boolean",
  },
  {
    key: "section-mobile-safe-zone",
    label: t.clientOptions.config.sectionMobileSafeZone,
    type: "section",
  },
  {
    key: "manualMobileBottomSafeZoneEnabled",
    label: t.clientOptions.config.manualMobileBottomSafeZoneEnabled.label,
    description:
      t.clientOptions.config.manualMobileBottomSafeZoneEnabled.description,
    type: "boolean",
  },
  {
    key: "manualMobileBottomSafeZoneVerticalPx",
    label: t.clientOptions.config.manualMobileBottomSafeZoneVerticalPx.label,
    description:
      t.clientOptions.config.manualMobileBottomSafeZoneVerticalPx.description,
    type: "slider",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "manualMobileBottomSafeZoneHorizontalPx",
    label: t.clientOptions.config.manualMobileBottomSafeZoneHorizontalPx.label,
    description:
      t.clientOptions.config.manualMobileBottomSafeZoneHorizontalPx.description,
    type: "slider",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "manualMobileRightSafeZoneHorizontalPx",
    label: t.clientOptions.config.manualMobileRightSafeZoneHorizontalPx.label,
    description:
      t.clientOptions.config.manualMobileRightSafeZoneHorizontalPx.description,
    type: "slider",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "group-sound",
    label: t.clientOptions.config.groupSound,
    type: "group",
  },
  {
    key: "soundEnabled",
    label: t.clientOptions.config.soundEnabled.label,
    description: t.clientOptions.config.soundEnabled.description,
    type: "boolean",
  },
  {
    key: "group-combat",
    label: t.clientOptions.config.groupCombat,
    type: "group",
  },
  {
    key: "damageNumbers",
    label: t.clientOptions.config.damageNumbers.label,
    description: t.clientOptions.config.damageNumbers.description,
    type: "boolean",
  },
  {
    key: "displayStatChangesAbovePlayer",
    label: t.clientOptions.config.displayStatChangesAbovePlayer.label,
    description:
      t.clientOptions.config.displayStatChangesAbovePlayer.description,
    type: "boolean",
  },
  {
    key: "displayXpGainsAbovePlayer",
    label: t.clientOptions.config.displayXpGainsAbovePlayer.label,
    description: t.clientOptions.config.displayXpGainsAbovePlayer.description,
    type: "boolean",
  },
  {
    key: "tileShakeOnHit",
    label: t.clientOptions.config.tileShakeOnHit.label,
    description: t.clientOptions.config.tileShakeOnHit.description,
    type: "boolean",
  },
  {
    key: "sectionCombatBlood",
    label: t.clientOptions.config.sectionCombatBlood,
    type: "section",
  },
  {
    key: "bloodMist",
    label: t.clientOptions.config.bloodMist.label,
    description: t.clientOptions.config.bloodMist.description,
    type: "boolean",
  },
  {
    key: "bloodGround",
    label: t.clientOptions.config.bloodGround.label,
    description: t.clientOptions.config.bloodGround.description,
    type: "boolean",
  },
  {
    key: "bloodStrength",
    label: t.clientOptions.config.bloodStrength.label,
    description: t.clientOptions.config.bloodStrength.description,
    type: "slider",
    min: 1,
    max: 2.5,
    step: 0.05,
  },
  {
    key: "bloodDetail",
    label: t.clientOptions.config.bloodDetail.label,
    description: t.clientOptions.config.bloodDetail.description,
    type: "select",
    options: [
      {
        value: "veryLow",
        label: t.clientOptions.config.bloodDetail.options.veryLow,
      },
      {
        value: "low",
        label: t.clientOptions.config.bloodDetail.options.low,
      },
      {
        value: "medium",
        label: t.clientOptions.config.bloodDetail.options.medium,
      },
      {
        value: "high",
        label: t.clientOptions.config.bloodDetail.options.high,
      },
    ],
  },
  {
    key: "bloodColorLightHex",
    label: t.clientOptions.config.bloodColorLightHex.label,
    description: t.clientOptions.config.bloodColorLightHex.description,
    type: "color",
  },
  {
    key: "bloodColorDarkHex",
    label: t.clientOptions.config.bloodColorDarkHex.label,
    description: t.clientOptions.config.bloodColorDarkHex.description,
    type: "color",
  },
  {
    key: "bloodMistColorHex",
    label: t.clientOptions.config.bloodMistColorHex.label,
    description: t.clientOptions.config.bloodMistColorHex.description,
    type: "color",
  },
  {
    key: "monsterShatter",
    label: t.clientOptions.config.monsterShatter.label,
    description: t.clientOptions.config.monsterShatter.description,
    type: "boolean",
  },
  {
    key: "monsterShatterBloodBorders",
    label: t.clientOptions.config.monsterShatterBloodBorders.label,
    description: t.clientOptions.config.monsterShatterBloodBorders.description,
    type: "boolean",
  },
  {
    key: "group-compatibility",
    label: t.clientOptions.config.groupCompatibility,
    type: "group",
  },
  {
    key: "darkCorridorWalls367",
    label: t.clientOptions.config.darkCorridorWalls367.label,
    description: t.clientOptions.config.darkCorridorWalls367.description,
    type: "boolean",
  },
  {
    key: "overrideNh5DarkCorridorWallTiles",
    label: t.clientOptions.config.overrideNh5DarkCorridorWallTiles.label,
    description:
      t.clientOptions.config.overrideNh5DarkCorridorWallTiles.description,
    type: "boolean",
  },
  {
    key: "darkCorridorWallTileOverrideEnabled",
    label: t.clientOptions.config.darkCorridorWallTileOverrideEnabled.label,
    description:
      t.clientOptions.config.darkCorridorWallTileOverrideEnabled.description,
    type: "boolean",
  },
  {
    key: "darkCorridorWallSolidColorOverrideEnabled",
    label:
      t.clientOptions.config.darkCorridorWallSolidColorOverrideEnabled.label,
    description:
      t.clientOptions.config.darkCorridorWallSolidColorOverrideEnabled
        .description,
    type: "boolean",
  },
];

const clientOptionsDefaultTabId: ClientOptionsTabId = "display";

const clientOptionsTabs: ClientOptionsTab[] = [
  {
    id: "display",
    label: t.clientOptions.tabs.display.label,
    description: t.clientOptions.tabs.display.description,
    groupKey: "group-interface",
  },
  {
    id: "controls",
    label: t.clientOptions.tabs.controls.label,
    description: t.clientOptions.tabs.controls.description,
    groupKey: "group-controls",
  },
  {
    id: "mobile",
    label: t.clientOptions.tabs.mobile.label,
    description: t.clientOptions.tabs.mobile.description,
    groupKey: "group-mobile",
  },
  {
    id: "sound",
    label: t.clientOptions.tabs.sound.label,
    description: t.clientOptions.tabs.sound.description,
    groupKey: "group-sound",
  },
  {
    id: "combat",
    label: t.clientOptions.tabs.combat.label,
    description: t.clientOptions.tabs.combat.description,
    groupKey: "group-combat",
  },
  {
    id: "compatibility",
    label: t.clientOptions.tabs.compatibility.label,
    description: t.clientOptions.tabs.compatibility.description,
    groupKey: "group-compatibility",
  },
  {
    id: "updates",
    label: t.clientOptions.tabs.updates.label,
    description: t.clientOptions.tabs.updates.description,
    groupKey: "group-updates",
  },
];

function getClientOptionsForGroup(groupKey: string): ClientOption[] {
  const options: ClientOption[] = [];
  let currentGroupKey = "";
  for (const option of clientOptionsConfig) {
    if (option.type === "group") {
      currentGroupKey = option.key;
      continue;
    }
    if (currentGroupKey === groupKey) {
      options.push(option);
    }
  }
  return options;
}

const clampInventoryContextMenuPosition = (
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } => {
  const rootStyle = getComputedStyle(document.documentElement);
  const safeLeft =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-modal-safe-left-inset"),
      8,
    ) + 4;
  const safeRight =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-action-context-safe-right-inset"),
      8,
    ) + 4;
  const safeTop =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-modal-safe-top-inset"),
      8,
    ) + 4;
  const safeBottom =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-modal-safe-bottom-inset"),
      8,
    ) + 4;
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 220;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 260;
  const maxX = Math.max(safeLeft, window.innerWidth - safeRight - safeWidth);
  const maxY = Math.max(safeTop, window.innerHeight - safeBottom - safeHeight);
  return {
    x: Math.min(Math.max(x, safeLeft), maxX),
    y: Math.min(Math.max(y, safeTop), maxY),
  };
};

const inventoryContextMenuAnchorGapPx = 8;
const inventoryContextMenuAnchorBottomGapPx = 6;
const inventoryContextMenuScrollRegionPaddingPx = 4;
const inventoryRowPressPreferInitialMs = 200;
const inventoryDropTypeMenuAnchorGapPx = 6;
const inventoryDropTypeMenuEstimatedWidthPx = 220;
const inventoryDropTypeMenuEstimatedHeightPx = 300;
const inventoryDropTypeHoldThresholdMs = 260;

const resolveInventoryContextMenuPosition = (
  state: InventoryContextMenuState,
  width: number,
  height: number,
  scrollRegionRect?: DOMRect | null,
): { x: number; y: number } => {
  const rootStyle = getComputedStyle(document.documentElement);
  const safeLeft =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-modal-safe-left-inset"),
      8,
    ) + 4;
  const safeRight =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-action-context-safe-right-inset"),
      8,
    ) + 4;
  const safeTop =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-modal-safe-top-inset"),
      8,
    ) + 4;
  const safeBottom =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-modal-safe-bottom-inset"),
      8,
    ) + 4;
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 220;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 260;
  let minX = safeLeft;
  let maxX = Math.max(safeLeft, window.innerWidth - safeRight - safeWidth);
  let minY = safeTop;
  let maxY = Math.max(safeTop, window.innerHeight - safeBottom - safeHeight);
  const anchorRightX =
    typeof state.anchorRightX === "number" &&
    Number.isFinite(state.anchorRightX)
      ? state.anchorRightX
      : state.x;
  const anchorCenterX =
    typeof state.anchorCenterX === "number" &&
    Number.isFinite(state.anchorCenterX)
      ? state.anchorCenterX
      : anchorRightX - safeWidth * 0.5;
  const anchorBottomY =
    typeof state.anchorBottomY === "number" &&
    Number.isFinite(state.anchorBottomY)
      ? state.anchorBottomY
      : state.y;
  const regionLeft = scrollRegionRect?.left;
  const regionRight = scrollRegionRect?.right;
  const regionTop = scrollRegionRect?.top;
  const regionBottom = scrollRegionRect?.bottom;
  const hasRegionBounds =
    typeof regionLeft === "number" &&
    Number.isFinite(regionLeft) &&
    typeof regionRight === "number" &&
    Number.isFinite(regionRight) &&
    typeof regionTop === "number" &&
    Number.isFinite(regionTop) &&
    typeof regionBottom === "number" &&
    Number.isFinite(regionBottom);
  if (hasRegionBounds) {
    const regionMinX = regionLeft + inventoryContextMenuScrollRegionPaddingPx;
    const regionMaxX =
      regionRight - safeWidth - inventoryContextMenuScrollRegionPaddingPx;
    const regionMinY = regionTop + inventoryContextMenuScrollRegionPaddingPx;
    const regionMaxY =
      regionBottom - safeHeight - inventoryContextMenuScrollRegionPaddingPx;
    const boundedMinX = Math.max(minX, regionMinX);
    const boundedMaxX = Math.min(maxX, regionMaxX);
    const boundedMinY = Math.max(minY, regionMinY);
    const boundedMaxY = Math.min(maxY, regionMaxY);
    if (boundedMaxX >= boundedMinX) {
      minX = boundedMinX;
      maxX = boundedMaxX;
    }
    if (boundedMaxY >= boundedMinY) {
      minY = boundedMinY;
      maxY = boundedMaxY;
    }
  }
  const preferredX = anchorCenterX - safeWidth * 0.5;
  const preferredY = anchorBottomY;
  return {
    x: Math.min(Math.max(preferredX, minX), maxX),
    y: Math.min(Math.max(preferredY, minY), maxY),
  };
};

const resolveInventoryDropTypeMenuPosition = (
  anchorRect: DOMRect,
  width: number,
  height: number,
): { x: number; y: number } => {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 220;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 300;
  const preferredX = anchorRect.left + anchorRect.width * 0.5 - safeWidth * 0.5;
  const preferredY =
    anchorRect.top - inventoryDropTypeMenuAnchorGapPx - safeHeight;
  return clampInventoryContextMenuPosition(
    preferredX,
    preferredY,
    safeWidth,
    safeHeight,
  );
};

const parseCssPixelValue = (value: string, fallback = 0): number => {
  const parsed = Number.parseFloat(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampTileContextMenuPosition = (
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } => {
  const rootStyle = getComputedStyle(document.documentElement);
  const safeLeft =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-modal-safe-left-inset"),
      8,
    ) + 4;
  const safeRight =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-action-context-safe-right-inset"),
      8,
    ) + 4;
  const safeTop =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-mobile-overlay-top-inset"),
      8,
    ) + 4;
  const safeBottom =
    parseCssPixelValue(
      rootStyle.getPropertyValue("--nh3d-mobile-overlay-bottom-inset"),
      8,
    ) + 4;
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 260;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 220;
  const maxX = Math.max(safeLeft, window.innerWidth - safeRight - safeWidth);
  const maxY = Math.max(safeTop, window.innerHeight - safeBottom - safeHeight);
  return {
    x: Math.min(Math.max(x, safeLeft), maxX),
    y: Math.min(Math.max(y, safeTop), maxY),
  };
};

const tileContextMenuAnchorOffsetY = 30;
const contextMenuTitleScrollGapPx = 28;
const contextMenuTitleScrollOverflowThresholdPx = 1;
const contextMenuTitleScrollPixelsPerSecond = 115;
const contextMenuTitleScrollInitialDelaySec = 0.75;

function useContextMenuTitleScroll(
  title: string,
  isActive: boolean,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const primaryTextRef = useRef<HTMLSpanElement | null>(null);
  const [scrollState, setScrollState] = useState<{
    shouldScroll: boolean;
    distancePx: number;
  }>({
    shouldScroll: false,
    distancePx: 0,
  });

  useLayoutEffect(() => {
    if (!isActive || !title) {
      setScrollState((previous) =>
        previous.shouldScroll || previous.distancePx !== 0
          ? {
              shouldScroll: false,
              distancePx: 0,
            }
          : previous,
      );
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    let animationFrameId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const measure = (): void => {
      animationFrameId = null;
      const container = containerRef.current;
      const primaryText = primaryTextRef.current;
      if (!container || !primaryText) {
        return;
      }
      const textWidth = Math.ceil(primaryText.scrollWidth);
      const containerWidth = Math.floor(container.clientWidth);
      const shouldScroll =
        textWidth - containerWidth > contextMenuTitleScrollOverflowThresholdPx;
      const distancePx = shouldScroll
        ? textWidth + contextMenuTitleScrollGapPx
        : 0;
      setScrollState((previous) =>
        previous.shouldScroll === shouldScroll &&
        previous.distancePx === distancePx
          ? previous
          : {
              shouldScroll,
              distancePx,
            },
      );
    };

    const scheduleMeasure = (): void => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        scheduleMeasure();
      });
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
      if (primaryTextRef.current) {
        resizeObserver.observe(primaryTextRef.current);
      }
    }

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener("resize", scheduleMeasure);
      resizeObserver?.disconnect();
    };
  }, [isActive, scrollState.shouldScroll, title]);

  return {
    containerRef,
    primaryTextRef,
    shouldScroll: scrollState.shouldScroll,
    style: scrollState.shouldScroll
      ? ({
          "--nh3d-context-title-scroll-distance": `-${scrollState.distancePx}px`,
          "--nh3d-context-title-scroll-duration": `${scrollState.distancePx / contextMenuTitleScrollPixelsPerSecond}s`,
          "--nh3d-context-title-scroll-delay": `${contextMenuTitleScrollInitialDelaySec}s`,
        } as CSSProperties)
      : undefined,
  };
}

const mobileActions: MobileActionEntry[] = [
  { id: "wait", label: t.mobileActions.wait, kind: "quick", value: "wait" },
  { id: "zap", label: t.mobileActions.zap, kind: "extended", value: "zap" },
  { id: "cast", label: t.mobileActions.cast, kind: "extended", value: "cast" },
  { id: "kick", label: t.mobileActions.kick, kind: "extended", value: "kick" },
  { id: "read", label: t.mobileActions.read, kind: "extended", value: "read" },
  {
    id: "quaff",
    label: t.mobileActions.quaff,
    kind: "extended",
    value: "quaff",
  },
  { id: "eat", label: t.mobileActions.eat, kind: "extended", value: "eat" },
  {
    id: "glance",
    label: t.mobileActions.glance,
    kind: "extended",
    value: "glance",
  },
  { id: "loot", label: t.mobileActions.loot, kind: "quick", value: "loot" },
  { id: "open", label: t.mobileActions.open, kind: "quick", value: "open" },
  {
    id: "wield",
    label: t.mobileActions.wield,
    kind: "extended",
    value: "wield",
  },
  { id: "wear", label: t.mobileActions.wear, kind: "extended", value: "wear" },
  {
    id: "put-on",
    label: t.mobileActions.putOn,
    kind: "extended",
    value: "puton",
  },
  {
    id: "take-off",
    label: t.mobileActions.takeOff,
    kind: "extended",
    value: "takeoff",
  },
  {
    id: "extended",
    label: t.mobileActions.extended,
    kind: "quick",
    value: "extended",
  },
];

const controllerActionWheelOuterRadiusPercent = 50;
const controllerActionWheelLabelRadiusPercent = 29;
const controllerActionWheelSliceGapDeg = 1;

function getControllerActionWheelPolarPoint(
  angleDeg: number,
  radiusPercent: number,
): { x: number; y: number } {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: 50 + Math.cos(radians) * radiusPercent,
    y: 50 + Math.sin(radians) * radiusPercent,
  };
}

function createControllerActionWheelEntries(
  actions: readonly MobileActionEntry[],
): ControllerActionWheelEntry[] {
  if (actions.length === 0) {
    return [];
  }
  const sliceSpanDeg = 360 / actions.length;
  return actions.map((action, index) => {
    const angleDeg = -90 + index * sliceSpanDeg;
    const halfGapDeg = Math.min(
      sliceSpanDeg * 0.35,
      controllerActionWheelSliceGapDeg / 2,
    );
    const startDeg = angleDeg - sliceSpanDeg / 2 + halfGapDeg;
    const endDeg = angleDeg + sliceSpanDeg / 2 - halfGapDeg;
    const startPoint = getControllerActionWheelPolarPoint(
      startDeg,
      controllerActionWheelOuterRadiusPercent,
    );
    const endPoint = getControllerActionWheelPolarPoint(
      endDeg,
      controllerActionWheelOuterRadiusPercent,
    );
    const labelPoint = getControllerActionWheelPolarPoint(
      angleDeg,
      controllerActionWheelLabelRadiusPercent,
    );
    const clipPath = `polygon(50% 50%, ${startPoint.x.toFixed(2)}% ${startPoint.y.toFixed(2)}%, ${endPoint.x.toFixed(2)}% ${endPoint.y.toFixed(2)}%)`;
    return {
      ...action,
      index,
      angleDeg,
      clipPath,
      labelXPercent: labelPoint.x,
      labelYPercent: labelPoint.y,
    };
  });
}

const fallbackExtendedCommandNames = [
  "adjust",
  "annotate",
  "apply",
  "attributes",
  "autopickup",
  "call",
  "cast",
  "chat",
  "close",
  "conduct",
  "dip",
  "drop",
  "droptype",
  "eat",
  "engrave",
  "enhance",
  "explode",
  "fight",
  "fire",
  "force",
  "getpos",
  "glance",
  "history",
  "invoke",
  "jump",
  "kick",
  "known",
  "knownclass",
  "look",
  "loot",
  "monster",
  "monsters",
  "name",
  "namefloor",
  "offer",
  "open",
  "options",
  "overview",
  "pay",
  "pickup",
  "pray",
  "prevmsg",
  "puton",
  "quaff",
  "quit",
  "quiver",
  "read",
  "redraw",
  "remove",
  "ride",
  "rub",
  "seeall",
  "seeamulet",
  "seegold",
  "seeinv",
  "seespells",
  "semicolon",
  "set",
  "shell",
  "sit",
  "spells",
  "takeoff",
  "takeoffall",
  "teleport",
  "terrain",
  "throw",
  "tip",
  "travel",
  "turn",
  "twoweapon",
  "untrap",
  "version",
  "versionshort",
  "wield",
  "wipe",
  "wear",
  "whatdoes",
  "whatis",
  "wieldquiver",
  "zap",
];
const commonExtendedCommandWhitelist = [
  "apply",
  "autopickup",
  "attributes",
  "drop",
  "engrave",
  "fire",
  "options",
  "pray",
  "quiver",
  "remove",
  "throw",
  "travel",
];

const wizardExtendedCommandNameSet = new Set([
  "levelchange",
  "lightsources",
  "migratemons",
  "panic",
  "polyself",
  "seenv",
  "stats",
  "timeout",
  "vanquished",
  "vision",
  "wizbury",
  "wizdetect",
  "wizgenesis",
  "wizidentify",
  "wizintrinsic",
  "wizlevelport",
  "wizmakemap",
  "wizmap",
  "wizrumorcheck",
  "wizsmell",
  "wizwhere",
  "wizwish",
  "wmode",
]);

const fallbackWizardExtendedCommandNames = Array.from(
  wizardExtendedCommandNameSet,
).sort((left, right) => left.localeCompare(right));

function getWizardCommandCopy(command: string): WizardCommandCopy {
  const normalized = String(command || "").trim().toLowerCase();
  const copy =
    t.dialogs.mobileActions.wizardCommandDetails[
      normalized as keyof typeof t.dialogs.mobileActions.wizardCommandDetails
    ];
  if (copy) {
    return copy;
  }
  return {
    name: command,
    description: t.dialogs.mobileActions.wizardCommandFallbackDescription,
  };
}

function isWizardExtendedCommandName(commandName: string): boolean {
  const normalized = String(commandName || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.startsWith("wiz") || wizardExtendedCommandNameSet.has(normalized)
  );
}

const overflowGlowClassName = "nh3d-overflow-glow";
const overflowGlowStartXClassName = "nh3d-overflow-glow-x-start";
const overflowGlowEndXClassName = "nh3d-overflow-glow-x-end";
const overflowGlowStartYClassName = "nh3d-overflow-glow-y-start";
const overflowGlowEndYClassName = "nh3d-overflow-glow-y-end";
const overflowGlowAxisThresholdPx = 1;
const overflowGlowTargetSelector = "[data-nh3d-overflow-glow]";

function resolveOverflowGlowHost(element: HTMLElement): HTMLElement {
  if (
    element.dataset.nh3dOverflowGlowHost === "parent" &&
    element.parentElement instanceof HTMLElement
  ) {
    return element.parentElement;
  }
  return element;
}

function supportsScrollableOverflowAxis(value: string): boolean {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return (
    normalized === "auto" || normalized === "scroll" || normalized === "overlay"
  );
}

function clearOverflowGlowState(element: HTMLElement): void {
  const hostElement = resolveOverflowGlowHost(element);
  hostElement.classList.remove(
    overflowGlowClassName,
    overflowGlowStartXClassName,
    overflowGlowEndXClassName,
    overflowGlowStartYClassName,
    overflowGlowEndYClassName,
  );
  hostElement.style.removeProperty("--nh3d-overflow-existing-shadow");
}

function updateOverflowGlowState(element: HTMLElement): boolean {
  const hostElement = resolveOverflowGlowHost(element);
  const computedStyle = window.getComputedStyle(element);
  const canOverflowX = supportsScrollableOverflowAxis(computedStyle.overflowX);
  const canOverflowY = supportsScrollableOverflowAxis(computedStyle.overflowY);
  const overflowX = Math.max(0, element.scrollWidth - element.clientWidth);
  const overflowY = Math.max(0, element.scrollHeight - element.clientHeight);
  const hasOverflowX = canOverflowX && overflowX > overflowGlowAxisThresholdPx;
  const hasOverflowY = canOverflowY && overflowY > overflowGlowAxisThresholdPx;

  if (!hasOverflowX && !hasOverflowY) {
    clearOverflowGlowState(element);
    return false;
  }

  if (!hostElement.classList.contains(overflowGlowClassName)) {
    const hostStyle = window.getComputedStyle(hostElement);
    const existingShadow =
      hostStyle.boxShadow && hostStyle.boxShadow !== "none"
        ? hostStyle.boxShadow
        : "none";
    hostElement.style.setProperty(
      "--nh3d-overflow-existing-shadow",
      existingShadow,
    );
    hostElement.classList.add(overflowGlowClassName);
  }

  if (hasOverflowX) {
    hostElement.classList.toggle(
      overflowGlowStartXClassName,
      element.scrollLeft > overflowGlowAxisThresholdPx,
    );
    hostElement.classList.toggle(
      overflowGlowEndXClassName,
      element.scrollLeft < overflowX - overflowGlowAxisThresholdPx,
    );
  } else {
    hostElement.classList.remove(
      overflowGlowStartXClassName,
      overflowGlowEndXClassName,
    );
  }

  if (hasOverflowY) {
    hostElement.classList.toggle(
      overflowGlowStartYClassName,
      element.scrollTop > overflowGlowAxisThresholdPx,
    );
    hostElement.classList.toggle(
      overflowGlowEndYClassName,
      element.scrollTop < overflowY - overflowGlowAxisThresholdPx,
    );
  } else {
    hostElement.classList.remove(
      overflowGlowStartYClassName,
      overflowGlowEndYClassName,
    );
  }

  return true;
}

function normalizeStartupCharacterName(value: string): string {
  const normalized = String(value || "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "Web_user";
  }
  return normalized.slice(0, 30);
}

function resolveEffectiveStartupCharacterName(
  config: CharacterCreationConfig,
): string {
  const normalizedName = normalizeStartupCharacterName(config.name || "");
  const startupTokens = sanitizeStartupInitOptionTokens(
    config.initOptions,
    config.runtimeVersion,
  );
  // NetHack 3.6.7 wizard/debug playmode canonicalizes player name to
  // "wizard" during startup, so align save-name logic with runtime behavior.
  if (startupTokens.includes("playmode:debug")) {
    return "wizard";
  }
  return normalizedName;
}

function resolveDeviceDefaultClientOptions(): Nh3dClientOptions {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  ) {
    return normalizeNh3dClientOptions({
      ...defaultNh3dClientOptions,
      fpsLookSensitivityX: mobileDefaultFpsLookSensitivity,
      fpsLookSensitivityY: mobileDefaultFpsLookSensitivity,
    });
  }
  return normalizeNh3dClientOptions(defaultNh3dClientOptions);
}

function resolveInitialClientOptionsFromPersisted(
  persisted: Partial<Nh3dClientOptions> | null,
): Nh3dClientOptions {
  const deviceDefaults = resolveDeviceDefaultClientOptions();
  if (!persisted) {
    return deviceDefaults;
  }
  const hydrated = normalizeNh3dClientOptions({
    ...deviceDefaults,
    ...persisted,
  });
  hydrated.controllerEnabled = false;
  return hydrated;
}

function isRunningOnLocalhost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const hostname = String(window.location.hostname || "")
    .trim()
    .toLowerCase();
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

function stripUserTilesetNameSuffix(value: string): string {
  return String(value || "")
    .replace(/\s*\(user\)\s*$/i, "")
    .trim();
}

function appendUserTilesetNameSuffix(value: string): string {
  const normalized = stripUserTilesetNameSuffix(value);
  return normalized ? `${normalized} (user)` : t.tilesets.userTilesetSuffix;
}

const defaultUserTilesetTileLayoutVersion: StoredUserTilesetTileLayoutVersion =
  "3.6.7";

function toUserTilesetRegistrations(
  records: ReadonlyArray<StoredUserTilesetRecord>,
): ReadonlyArray<{
  id: string;
  label: string;
  tileSize: number;
  tileLayoutVersion: StoredUserTilesetTileLayoutVersion;
  blob: Blob;
}> {
  return records.map((record) => ({
    id: record.id,
    label: record.label,
    tileSize: record.tileSize,
    tileLayoutVersion: record.tileLayoutVersion,
    blob: record.blob,
  }));
}

async function inferTilesetTileSizeFromBlob(blob: Blob): Promise<number> {
  if (typeof window === "undefined") {
    return 32;
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const size = await new Promise<number>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () =>
        resolve(
          inferNh3dTilesetTileSizeFromAtlasWidthForPath(image.naturalWidth),
        );
      image.onerror = () => reject(new Error(t.tilesets.failedToReadImage));
      image.src = objectUrl;
    });
    return size;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function normalizeUserTilesetTileSizes(
  records: ReadonlyArray<StoredUserTilesetRecord>,
): Promise<StoredUserTilesetRecord[]> {
  return Promise.all(
    records.map(async (record) => {
      const fallbackTileSize = Math.max(
        1,
        Math.trunc(Number.isFinite(record.tileSize) ? record.tileSize : 32),
      );
      try {
        const tileSize = await inferTilesetTileSizeFromBlob(record.blob);
        return {
          ...record,
          tileSize,
        };
      } catch {
        return {
          ...record,
          tileSize: fallbackTileSize,
        };
      }
    }),
  );
}

type SaveGameRecord = {
  key: string;
  name: string;
  displayName: string;
  displayPlayMode: "normal" | "explore" | "debug" | null;
  initOptions?: string[];
  category: "manual" | "autosave";
  isResumable: boolean;
  timestamp: Date;
  dateFormatted: string;
  files: Array<{
    dbName: string;
    key: string;
    filename: string;
    timestamp: Date;
  }>;
};

type SavePresentationMetadataEntry = {
  characterName: string;
  playMode: "normal" | "explore" | "debug" | null;
  initOptions?: string[];
  updatedAt: string;
};

const savePresentationMetadataStorageKey = "nh3d-save-presentation-v1";

function readSavePresentationMetadataByKey(): Record<
  string,
  SavePresentationMetadataEntry
> {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(savePresentationMetadataStorageKey);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const normalized: Record<string, SavePresentationMetadataEntry> = {};
    for (const [rawKey, rawValue] of Object.entries(parsed)) {
      if (!rawKey || typeof rawKey !== "string") {
        continue;
      }
      if (!rawValue || typeof rawValue !== "object") {
        continue;
      }
      const candidate = rawValue as Partial<SavePresentationMetadataEntry>;
      const characterName = normalizeStartupCharacterName(
        String(candidate.characterName || ""),
      );
      const playMode =
        candidate.playMode === "debug" ||
        candidate.playMode === "explore" ||
        candidate.playMode === "normal"
          ? candidate.playMode
          : null;
      normalized[rawKey] = {
        characterName,
        playMode,
        initOptions: sanitizeStartupInitOptionTokens(candidate.initOptions),
        updatedAt:
          typeof candidate.updatedAt === "string" && candidate.updatedAt.trim()
            ? candidate.updatedAt
            : "",
      };
    }
    return normalized;
  } catch {
    return {};
  }
}

function writeSavePresentationMetadataByKey(
  metadataByKey: Record<string, SavePresentationMetadataEntry>,
): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(
      savePresentationMetadataStorageKey,
      JSON.stringify(metadataByKey),
    );
  } catch (error) {
    console.warn("Failed to persist save presentation metadata:", error);
  }
}

function resolveStartupPlayModeForSavePresentation(
  runtimeVersion: NethackRuntimeVersion | undefined,
  initOptions: string[] | undefined,
): "normal" | "explore" | "debug" | null {
  const tokens = sanitizeStartupInitOptionTokens(initOptions, runtimeVersion);
  if (tokens.includes("playmode:debug")) {
    return "debug";
  }
  if (tokens.includes("playmode:explore")) {
    return "explore";
  }
  if (tokens.includes("playmode:normal")) {
    return "normal";
  }
  return "normal";
}

function resolveSaveResumeInitOptionTokens(
  rawInitOptions: unknown,
  runtimeVersion: NethackRuntimeVersion,
): string[] {
  const tokens = sanitizeStartupInitOptionTokens(
    rawInitOptions,
    runtimeVersion,
  );
  const hasNumberPadToken = tokens.some((token) =>
    String(token || "")
      .trim()
      .toLowerCase()
      .startsWith("number_pad:"),
  );
  return hasNumberPadToken ? tokens : [...tokens, "number_pad:1"];
}

function persistSavePresentationMetadataForCharacter(
  runtimeName: string,
  characterName: string,
  runtimeVersion: NethackRuntimeVersion | undefined,
  initOptions: string[] | undefined,
): void {
  const normalizedRuntimeName = normalizeStartupCharacterName(runtimeName);
  const normalizedCharacterName = normalizeStartupCharacterName(characterName);
  if (!normalizedRuntimeName || !normalizedCharacterName) {
    return;
  }

  const metadataByKey = readSavePresentationMetadataByKey();
  const playMode = resolveStartupPlayModeForSavePresentation(
    runtimeVersion,
    initOptions,
  );
  const sanitizedInitOptions = sanitizeStartupInitOptionTokens(initOptions);
  const updatedAt = new Date().toISOString();
  const categories: Array<"manual" | "autosave"> = ["manual", "autosave"];
  for (const category of categories) {
    metadataByKey[`${category}:${normalizedRuntimeName}`] = {
      characterName: normalizedCharacterName,
      playMode,
      initOptions: sanitizedInitOptions,
      updatedAt,
    };
  }
  writeSavePresentationMetadataByKey(metadataByKey);
}

function resolveSavePlayModeChipLabel(
  playMode: "normal" | "explore" | "debug" | null,
): string | null {
  if (playMode === "debug") {
    return "Wizard/Debug";
  }
  if (playMode === "explore") {
    return "Explore";
  }
  return null;
}

function resolveSaveCategory(filename: string): "manual" | "autosave" {
  const normalizedFilename = filename.toLowerCase();
  if (/(?:\.e|-e)(?:\.[a-z0-9]+)?$/.test(normalizedFilename)) {
    return "autosave";
  }
  // NetHack checkpoint files are level snapshots like "<uid><name>.<level>".
  if (/\.\d+$/.test(normalizedFilename)) {
    return "autosave";
  }
  return "manual";
}

function isCheckpointShardFilename(filename: string): boolean {
  return /\.\d+$/i.test(String(filename || "").toLowerCase());
}

function resolveSaveDisplayName(
  name: string,
  category: "manual" | "autosave",
): string {
  if (category === "autosave") {
    return name
      .replace(/(?:\.e|-e)(?:\.[a-z0-9]+)?$/i, "")
      .replace(/\.\d+$/i, "");
  }
  return name;
}

function resolveSaveLogicalName(
  filename: string,
  category: "manual" | "autosave",
): string {
  const strippedName = filename.replace(/^\d+/, "");
  if (category === "autosave") {
    return strippedName
      .replace(/(?:\.e|-e)(?:\.[a-z0-9]+)?$/i, "")
      .replace(/\.\d+$/i, "");
  }
  return strippedName;
}

async function fetchSavedGames(
  runtimeVersion: NethackRuntimeVersion,
): Promise<SaveGameRecord[]> {
  const saves = new Map<string, SaveGameRecord>();
  const dbNames = await resolveRuntimeSaveDbNames(runtimeVersion);
  const checkpointRecoverySupported =
    supportsRuntimeCheckpointRecovery(runtimeVersion);
  const savePresentationMetadataByKey = readSavePresentationMetadataByKey();

  for (const dbName of dbNames) {
    try {
      const db = await new Promise<IDBDatabase | null>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (e) => {
          (e.target as IDBOpenDBRequest).transaction?.abort();
          resolve(null);
        };
      });

      if (!db) continue;

      if (!db.objectStoreNames.contains("FILE_DATA")) {
        db.close();
        continue;
      }

      const records = await new Promise<{ key: string; value: any }[]>(
        (resolve, reject) => {
          const transaction = db.transaction(["FILE_DATA"], "readonly");
          const store = transaction.objectStore("FILE_DATA");
          const request = store.getAll();
          const keysRequest = store.getAllKeys();

          request.onsuccess = () => {
            keysRequest.onsuccess = () => {
              const result = [];
              for (let i = 0; i < request.result.length; i++) {
                result.push({
                  key: keysRequest.result[i] as string,
                  value: request.result[i],
                });
              }
              resolve(result);
            };
            keysRequest.onerror = () => reject(keysRequest.error);
          };
          request.onerror = () => reject(request.error);
        },
      );

      for (const record of records) {
        const key = record.key;
        const value = record.value;
        if (!key || typeof key !== "string") continue;

        const filename = key.split("/").pop();
        if (!filename) continue;
        const normalizedFilename = filename.toLowerCase();

        const isCheckpointShard = isCheckpointShardFilename(filename);
        const isCheckpointLevelZero = /\.0$/i.test(normalizedFilename);
        const fileByteLength = getStoredFileByteLength(value);
        const isRecoverableCheckpointLevelZero =
          isCheckpointLevelZero &&
          isRecoverableCheckpointLevelZeroByteLength(fileByteLength);
        const isTemporaryLockCheckpointShard = /^[a-z]lock\.\d+$/i.test(
          normalizedFilename,
        );

        // Ignore structural/metadata files used by NetHack
        const knownNonSaves = [
          "record",
          "logfile",
          "xlogfile",
          "perm",
          "timestamp",
          ".keep",
        ];
        if (knownNonSaves.includes(normalizedFilename)) continue;
        if (normalizedFilename.includes("level")) {
          continue;
        }
        // These shards come from lock-letter mode (MAXPLAYERS>0). Our current
        // browser resume bridge targets UID+name locknames, so these cannot be
        // resumed by character selection and should not be listed as loadable.
        if (isTemporaryLockCheckpointShard) {
          continue;
        }
        // Drop non-shard lock artifacts.
        const isLockArtifact =
          normalizedFilename === "lock" ||
          /^[a-z]lock$/i.test(normalizedFilename) ||
          normalizedFilename.endsWith(".lock");
        if (isLockArtifact && !isCheckpointShard) {
          continue;
        }

        // NetHack prepends a user ID (usually 0) to save files, e.g. "0Web_user".
        const category = resolveSaveCategory(filename);
        const name = resolveSaveLogicalName(filename, category);
        if (name && value && value.timestamp) {
          const timestamp = new Date(value.timestamp);
          const logicalKey = `${category}:${name}`;
          const presentationMetadata =
            savePresentationMetadataByKey[logicalKey];
          const displayPlayMode =
            presentationMetadata &&
            (presentationMetadata.playMode === "normal" ||
              presentationMetadata.playMode === "explore" ||
              presentationMetadata.playMode === "debug")
              ? presentationMetadata.playMode
              : null;
          const displayName =
            presentationMetadata &&
            typeof presentationMetadata.characterName === "string" &&
            presentationMetadata.characterName.trim().length > 0
              ? normalizeStartupCharacterName(
                  presentationMetadata.characterName,
                )
              : resolveSaveDisplayName(name, category);
          const initOptions =
            presentationMetadata &&
            Array.isArray(presentationMetadata.initOptions)
              ? resolveSaveResumeInitOptionTokens(
                  presentationMetadata.initOptions,
                  runtimeVersion,
                )
              : resolveSaveResumeInitOptionTokens([], runtimeVersion);
          const existing = saves.get(logicalKey);
          if (existing) {
            existing.files.push({
              dbName,
              key,
              filename,
              timestamp,
            });
            if (
              !isCheckpointShard ||
              (checkpointRecoverySupported && isRecoverableCheckpointLevelZero)
            ) {
              existing.isResumable = true;
            }
            if (existing.timestamp < timestamp) {
              existing.timestamp = timestamp;
              existing.dateFormatted = timestamp.toLocaleString();
            }
            continue;
          }

          saves.set(logicalKey, {
            key: logicalKey,
            name,
            displayName,
            displayPlayMode,
            initOptions,
            category,
            // A lone "<lock>.0" file at 4 bytes is just NetHack's pid lock,
            // not a recoverable checkpoint autosave.
            isResumable:
              !isCheckpointShard ||
              (checkpointRecoverySupported && isRecoverableCheckpointLevelZero),
            timestamp,
            dateFormatted: timestamp.toLocaleString(),
            files: [
              {
                dbName,
                key,
                filename,
                timestamp,
              },
            ],
          });
        }
      }

      db.close();
    } catch (e) {
      console.warn(`Could not read IndexedDB ${dbName}:`, e);
    }
  }

  return Array.from(saves.values()).sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  );
}

async function deleteSavedGame(save: SaveGameRecord): Promise<void> {
  const fileGroups = new Map<
    string,
    Array<{ key: string; filename: string; timestamp: Date }>
  >();

  for (const file of save.files) {
    const existing = fileGroups.get(file.dbName);
    if (existing) {
      existing.push(file);
      continue;
    }
    fileGroups.set(file.dbName, [file]);
  }

  for (const [dbName, files] of fileGroups.entries()) {
    try {
      const db = await new Promise<IDBDatabase | null>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (e) => {
          (e.target as IDBOpenDBRequest).transaction?.abort();
          resolve(null);
        };
      });

      if (!db) continue;

      if (!db.objectStoreNames.contains("FILE_DATA")) {
        db.close();
        continue;
      }

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(["FILE_DATA"], "readwrite");
        const store = transaction.objectStore("FILE_DATA");

        let remaining = files.length;
        if (remaining <= 0) {
          resolve();
          return;
        }

        const completeDelete = () => {
          remaining -= 1;
          if (remaining <= 0) {
            resolve();
          }
        };

        for (const file of files) {
          const request = store.delete(file.key);
          request.onsuccess = () => completeDelete();
          request.onerror = () => reject(request.error);
        }
      });

      db.close();
    } catch (e) {
      console.warn(`Could not delete from IndexedDB ${dbName}:`, e);
    }
  }
}

type Nh3dElectronBridge = {
  quitGame?: () => Promise<unknown>;
  signalAppRendered?: () => void;
};

type Nh3dAndroidBridge = {
  quitGame?: () => void;
};

type Nh3dWindowBridges = Window & {
  nh3dElectron?: Nh3dElectronBridge;
  nh3dAndroid?: Nh3dAndroidBridge;
};

async function requestGameQuit(): Promise<void> {
  const bridgeWindow = window as Nh3dWindowBridges;
  const electronBridge = bridgeWindow.nh3dElectron;
  if (typeof electronBridge?.quitGame === "function") {
    await electronBridge.quitGame();
    return;
  }

  const androidBridge = bridgeWindow.nh3dAndroid;
  if (typeof androidBridge?.quitGame === "function") {
    androidBridge.quitGame();
    return;
  }

  window.close();
}

export default function App(): JSX.Element {
  const startupDefaultCharacterPreferencesByRuntime = useMemo(
    () => createDefaultStartupCharacterPreferencesByRuntime(),
    [],
  );
  const startupDefaultCharacterPreferences =
    startupDefaultCharacterPreferencesByRuntime["3.6.7"] ??
    createDefaultStartupCharacterPreferences("3.6.7");
  const startupCharacterPreferencesStateRuntimeRef =
    useRef<NethackRuntimeVersion | null>("3.6.7");
  const [hasShownStartupMenu, setHasShownStartupMenu] = useState(false);
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const startupRenderSignalSentRef = useRef(false);
  const [characterCreationConfig, setCharacterCreationConfig] =
    useState<CharacterCreationConfig | null>(null);
  const [startupFlowStep, setStartupFlowStep] =
    useState<StartupFlowStep>("variant");
  const [runtimeVersion, setRuntimeVersion] =
    useState<NethackRuntimeVersion>("3.6.7");
  const activeRuntimeVersion =
    characterCreationConfig?.runtimeVersion ?? runtimeVersion;
  const activeRuntimeVersionLabel =
    resolveRuntimeVersionDisplayLabel(activeRuntimeVersion);
  const [createRole, setCreateRole] = useState(
    startupDefaultCharacterPreferences.createRole,
  );
  const [createRace, setCreateRace] = useState(
    startupDefaultCharacterPreferences.createRace,
  );
  const [createGender, setCreateGender] = useState(
    startupDefaultCharacterPreferences.createGender,
  );
  const [createAlign, setCreateAlign] = useState(
    startupDefaultCharacterPreferences.createAlign,
  );
  const [randomCharacterName, setRandomCharacterName] = useState(
    startupDefaultCharacterPreferences.randomName,
  );
  const [createCharacterName, setCreateCharacterName] = useState(
    startupDefaultCharacterPreferences.createName,
  );
  const [
    startupCharacterPreferencesByRuntime,
    setStartupCharacterPreferencesByRuntime,
  ] = useState<StartupCharacterPreferencesByRuntime>(() => ({
    ...startupDefaultCharacterPreferencesByRuntime,
  }));
  const [
    hasHydratedStartupCharacterPreferences,
    setHasHydratedStartupCharacterPreferences,
  ] = useState(false);
  const [startupInitOptionsExpanded, setStartupInitOptionsExpanded] =
    useState(false);
  const [startupInitOptionValues, setStartupInitOptionValues] =
    useState<StartupInitOptionValues>(() =>
      createDefaultStartupInitOptionValues(),
    );
  const [hasHydratedStartupInitOptions, setHasHydratedStartupInitOptions] =
    useState(false);
  const [savedGames, setSavedGames] = useState<SaveGameRecord[]>([]);
  const resumableSavedGames = useMemo(
    () => savedGames.filter((save) => save.isResumable),
    [savedGames],
  );
  // Checkpoint-only autosaves become actionable only when the selected wasm
  // build exposes the browser-side checkpoint resume bridge. The low-level
  // recover_savefile() export alone is not enough because libnhmain can still
  // reach unixunix.c/getlock() before the web host can prepare recovery.
  const savedGameSections = useMemo(
    () =>
      [
        {
          key: "manual" as const,
          label: t.saves.sections.manual,
          saves: resumableSavedGames.filter(
            (save) => save.category === "manual",
          ),
        },
        {
          key: "autosave" as const,
          label: t.saves.sections.autosave,
          saves: resumableSavedGames.filter(
            (save) => save.category === "autosave",
          ),
        },
      ].filter((section) => section.saves.length > 0),
    [resumableSavedGames],
  );
  const [isLoadingSaves, setIsLoadingSaves] = useState(false);
  const startupUpdateCheckStartedRef = useRef(false);
  const [startupUpdateCheck, setStartupUpdateCheck] =
    useState<Nh3dVersionCheckResult | null>(null);
  const [isStartupUpdateDialogVisible, setIsStartupUpdateDialogVisible] =
    useState(false);
  const [startupUpdateDetailsVisible, setStartupUpdateDetailsVisible] =
    useState(false);
  const startupCreateCharacterOptionSet = useMemo(
    () =>
      resolveStartupCreateCharacterOptionSet(
        {
          role: createRole,
          race: createRace,
          gender: createGender,
          align: createAlign,
        },
        runtimeVersion,
      ),
    [createRole, createRace, createGender, createAlign, runtimeVersion],
  );
  const normalizedCreateCharacterSelection =
    startupCreateCharacterOptionSet.selection;

  const handleDeleteSave = async (
    e: ReactMouseEvent<HTMLButtonElement>,
    save: SaveGameRecord,
  ) => {
    e.stopPropagation();
    const confirmed = await requestConfirmation({
      title: t.saves.deleteTitle,
      message: t.saves.deleteMessage(save.displayName),
      confirmLabel: commonStrings.delete,
      cancelLabel: commonStrings.cancel,
      confirmClassName: "nh3d-menu-action-cancel",
    });
    if (!confirmed) {
      return;
    }
    await deleteSavedGame(save);
    setSavedGames((prev) => prev.filter((s) => s.key !== save.key));
  };

  const handleResumeClick = async () => {
    setStartupFlowStep("resume");
    setIsLoadingSaves(true);
    try {
      const saves = await fetchSavedGames(runtimeVersion);
      setSavedGames(saves);
    } catch (e) {
      console.error(t.saves.errorLoading, e);
    } finally {
      setIsLoadingSaves(false);
    }
  };

  const handleStartNewGame = async (config: CharacterCreationConfig) => {
    const runtimeVersionForLaunch = config.runtimeVersion ?? runtimeVersion;
    const normalizedInitOptions = appendRequiredStartupInitOptionTokens(
      config.initOptions,
      runtimeVersionForLaunch,
    );
    const requestedCharacterName = normalizeStartupCharacterName(
      config.name || "",
    );
    const effectiveCharacterName = resolveEffectiveStartupCharacterName({
      ...config,
      runtimeVersion: runtimeVersionForLaunch,
      initOptions: normalizedInitOptions,
    });
    if (config.mode === "random" || config.mode === "create") {
      try {
        const saves = await fetchSavedGames(runtimeVersionForLaunch);
        const configName = effectiveCharacterName;
        const matchingSaves = saves.filter((s) => s.name === configName);
        if (matchingSaves.length > 0) {
          const confirmed = await requestConfirmation({
            title: t.saves.overwriteTitle,
            message: t.saves.overwriteMessage(configName),
            confirmLabel: "Overwrite",
            cancelLabel: commonStrings.cancel,
            confirmClassName: "nh3d-menu-action-cancel",
          });
          if (!confirmed) {
            return;
          }
          await Promise.all(matchingSaves.map((save) => deleteSavedGame(save)));
        }
      } catch (e) {
        console.warn("Failed to check for existing saves:", e);
      }
      persistSavePresentationMetadataForCharacter(
        effectiveCharacterName,
        requestedCharacterName,
        runtimeVersionForLaunch,
        normalizedInitOptions,
      );
    }
    const currentTilesetPath = String(clientOptions.tilesetPath || "").trim();
    const compatibleTilesetPath = resolveNh3dCompatibleTilesetPathForRuntime(
      currentTilesetPath,
      runtimeVersionForLaunch,
    );
    if (compatibleTilesetPath && compatibleTilesetPath !== currentTilesetPath) {
      setClientOptions((previous) =>
        normalizeNh3dClientOptions({
          ...previous,
          tilesetPath: compatibleTilesetPath,
        }),
      );
      setClientOptionsDraft((previous) =>
        normalizeNh3dClientOptions({
          ...previous,
          tilesetPath: compatibleTilesetPath,
        }),
      );
    }
    setCharacterCreationConfig({
      ...config,
      runtimeVersion: runtimeVersionForLaunch,
      name: effectiveCharacterName,
      initOptions: normalizedInitOptions,
    });
  };

  const updateStartupInitOptionValue = useCallback(
    (key: string, value: StartupInitOptionValue): void => {
      setStartupInitOptionValues((previous) => ({
        ...previous,
        [key]: value,
      }));
    },
    [],
  );
  const resetStartupInitOptionValues = useCallback((): void => {
    setStartupInitOptionValues(createDefaultStartupInitOptionValues());
  }, []);
  const startupInitOptionTokens = useMemo(
    () =>
      serializeStartupInitOptionTokens(startupInitOptionValues, runtimeVersion),
    [runtimeVersion, startupInitOptionValues],
  );
  const startupCharacterPreferences = useMemo<StartupCharacterPreferences>(
    () => ({
      randomName: randomCharacterName,
      createName: createCharacterName,
      createRole: normalizedCreateCharacterSelection.role,
      createRace: normalizedCreateCharacterSelection.race,
      createGender: normalizedCreateCharacterSelection.gender,
      createAlign: normalizedCreateCharacterSelection.align,
    }),
    [
      randomCharacterName,
      createCharacterName,
      normalizedCreateCharacterSelection.role,
      normalizedCreateCharacterSelection.race,
      normalizedCreateCharacterSelection.gender,
      normalizedCreateCharacterSelection.align,
    ],
  );
  useEffect(() => {
    if (createRole !== normalizedCreateCharacterSelection.role) {
      setCreateRole(normalizedCreateCharacterSelection.role);
    }
    if (createRace !== normalizedCreateCharacterSelection.race) {
      setCreateRace(normalizedCreateCharacterSelection.race);
    }
    if (createGender !== normalizedCreateCharacterSelection.gender) {
      setCreateGender(normalizedCreateCharacterSelection.gender);
    }
    if (createAlign !== normalizedCreateCharacterSelection.align) {
      setCreateAlign(normalizedCreateCharacterSelection.align);
    }
  }, [
    createRole,
    createRace,
    createGender,
    createAlign,
    normalizedCreateCharacterSelection.role,
    normalizedCreateCharacterSelection.race,
    normalizedCreateCharacterSelection.gender,
    normalizedCreateCharacterSelection.align,
  ]);
  useEffect(() => {
    if (!hasHydratedStartupCharacterPreferences) {
      return;
    }
    if (startupCharacterPreferencesStateRuntimeRef.current !== runtimeVersion) {
      return;
    }
    setStartupCharacterPreferencesByRuntime((previous) => {
      if (
        areStartupCharacterPreferencesEqual(
          previous[runtimeVersion],
          startupCharacterPreferences,
        )
      ) {
        return previous;
      }
      return {
        ...previous,
        [runtimeVersion]: startupCharacterPreferences,
      };
    });
  }, [
    hasHydratedStartupCharacterPreferences,
    runtimeVersion,
    startupCharacterPreferences,
  ]);
  useEffect(() => {
    if (!hasHydratedStartupCharacterPreferences) {
      return;
    }
    if (startupCharacterPreferencesStateRuntimeRef.current === runtimeVersion) {
      return;
    }

    const runtimePreferences = resolveStartupCharacterPreferencesForRuntime(
      startupCharacterPreferencesByRuntime,
      startupDefaultCharacterPreferencesByRuntime,
      runtimeVersion,
    );
    const defaultRuntimePreferences =
      startupDefaultCharacterPreferencesByRuntime[runtimeVersion] ??
      createDefaultStartupCharacterPreferences(runtimeVersion);
    setRandomCharacterName(
      runtimePreferences.randomName || defaultRuntimePreferences.randomName,
    );
    setCreateCharacterName(
      runtimePreferences.createName || defaultRuntimePreferences.createName,
    );
    const normalizedRuntimeSelection = normalizeStartupCreateCharacterSelection(
      {
        role: runtimePreferences.createRole,
        race: runtimePreferences.createRace,
        gender: runtimePreferences.createGender,
        align: runtimePreferences.createAlign,
      },
      runtimeVersion,
    );
    setCreateRole(normalizedRuntimeSelection.role);
    setCreateRace(normalizedRuntimeSelection.race);
    setCreateGender(normalizedRuntimeSelection.gender);
    setCreateAlign(normalizedRuntimeSelection.align);
    startupCharacterPreferencesStateRuntimeRef.current = runtimeVersion;
  }, [
    hasHydratedStartupCharacterPreferences,
    runtimeVersion,
    startupCharacterPreferencesByRuntime,
    startupDefaultCharacterPreferencesByRuntime,
  ]);

  const initialPersistedClientOptionsRef =
    useRef<Partial<Nh3dClientOptions> | null>(null);
  const initialClientOptions = useMemo(
    () => resolveDeviceDefaultClientOptions(),
    [],
  );
  const [clientOptions, setClientOptions] = useState<Nh3dClientOptions>(
    () => initialClientOptions,
  );
  const [clientOptionsDraft, setClientOptionsDraft] =
    useState<Nh3dClientOptions>(() => initialClientOptions);
  const [manualSafeZonePreview, setManualSafeZonePreview] =
    useState<ManualSafeZonePreview | null>(null);
  const manualSafeZonePreviewTimerRef = useRef<number | null>(null);
  const [hasHydratedUserTilesets, setHasHydratedUserTilesets] = useState(false);
  const [isClientOptionsVisible, setIsClientOptionsVisible] = useState(false);
  const [activeClientOptionsTab, setActiveClientOptionsTab] =
    useState<ClientOptionsTabId>(clientOptionsDefaultTabId);
  const [optionsUpdateCheckBusy, setOptionsUpdateCheckBusy] = useState(false);
  const [optionsUpdateCheckResult, setOptionsUpdateCheckResult] =
    useState<Nh3dVersionCheckResult | null>(null);
  const [optionsUpdateCheckStatus, setOptionsUpdateCheckStatus] = useState("");
  const [isDarkWallTilePickerVisible, setIsDarkWallTilePickerVisible] =
    useState(false);
  const [
    isTilesetBackgroundTilePickerVisible,
    setIsTilesetBackgroundTilePickerVisible,
  ] = useState(false);
  const [
    isTilesetSolidColorPickerVisible,
    setIsTilesetSolidColorPickerVisible,
  ] = useState(false);
  const [isTilesetManagerVisible, setIsTilesetManagerVisible] = useState(false);
  const [isPauseMenuVisible, setIsPauseMenuVisible] = useState(false);
  const [isExitConfirmationVisible, setIsExitConfirmationVisible] =
    useState(false);
  const [
    isResetClientOptionsConfirmationVisible,
    setIsResetClientOptionsConfirmationVisible,
  ] = useState(false);
  const [isControllerRemapVisible, setIsControllerRemapVisible] =
    useState(false);
  const [controllerRemapListening, setControllerRemapListening] =
    useState<ControllerRemapListeningState | null>(null);
  const [
    hasAskedControllerSupportThisSession,
    setHasAskedControllerSupportThisSession,
  ] = useState(false);
  const [
    isControllerSupportPromptVisible,
    setIsControllerSupportPromptVisible,
  ] = useState(false);
  const [isDebugSessionLogsLinkVisible, setIsDebugSessionLogsLinkVisible] =
    useState(false);
  const [userTilesets, setUserTilesets] = useState<StoredUserTilesetRecord[]>(
    [],
  );
  const [tilesetManagerMode, setTilesetManagerMode] = useState<"edit" | "new">(
    "edit",
  );
  const [tilesetManagerName, setTilesetManagerName] = useState("");
  const [tilesetManagerTileLayoutVersion, setTilesetManagerTileLayoutVersion] =
    useState<StoredUserTilesetTileLayoutVersion>(
      defaultUserTilesetTileLayoutVersion,
    );
  const [tilesetManagerEditPath, setTilesetManagerEditPath] = useState("");
  const [tilesetManagerFile, setTilesetManagerFile] = useState<File | null>(
    null,
  );
  const [tilesetManagerError, setTilesetManagerError] = useState("");
  const [tilesetManagerBusy, setTilesetManagerBusy] = useState(false);
  const tilesetManagerFileInputRef = useRef<HTMLInputElement | null>(null);
  const [tileAtlasImage, setTileAtlasImage] = useState<HTMLImageElement | null>(
    null,
  );
  const [tileAtlasState, setTileAtlasState] = useState<TileAtlasState>(() =>
    createDefaultTileAtlasState(),
  );
  const [tilesetManagerAtlasImage, setTilesetManagerAtlasImage] =
    useState<HTMLImageElement | null>(null);
  const [tilesetManagerAtlasState, setTilesetManagerAtlasState] =
    useState<TileAtlasState>(() => createDefaultTileAtlasState());
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileActionSheetVisible, setIsMobileActionSheetVisible] =
    useState(false);
  const [mobileActionSheetMode, setMobileActionSheetMode] =
    useState<MobileActionSheetMode>("quick");
  const [isControllerActionWheelVisible, setIsControllerActionWheelVisible] =
    useState(false);
  const [controllerActionWheelMode, setControllerActionWheelMode] =
    useState<MobileActionSheetMode>("quick");
  const [
    controllerActionWheelChosenIndex,
    setControllerActionWheelChosenIndex,
  ] = useState(0);
  const [startupBuildLabelClickCount, setStartupBuildLabelClickCount] =
    useState(0);
  const [startupBuildLabelToastVisible, setStartupBuildLabelToastVisible] =
    useState(false);
  const [debugSessionLogsEnabled, setDebugSessionLogsEnabled] = useState(false);
  const [isDebugSessionLogsVisible, setIsDebugSessionLogsVisible] =
    useState(false);
  const [debugSessionLogs, setDebugSessionLogs] = useState<
    DebugSessionLogSession[]
  >([]);
  const [selectedDebugSessionLogId, setSelectedDebugSessionLogId] =
    useState("");
  const controllerActionWheelDialogRef = useRef<HTMLDivElement | null>(null);
  const [isMobileLogVisible, setIsMobileLogVisible] = useState(false);
  const [isWizardCommandsVisible, setIsWizardCommandsVisible] = useState(false);
  const wizardCommandsButtonRef = useRef<HTMLButtonElement | null>(null);
  const wizardCommandsSheetRef = useRef<HTMLDivElement | null>(null);
  const [characterSheetInterceptionArmed, setCharacterSheetInterceptionArmed] =
    useState(false);
  const characterSheetAwaitingInfoRef = useRef(false);
  const [statsBarHeight, setStatsBarHeight] = useState(0);
  const [coreStatBoldUntilTurn, setCoreStatBoldUntilTurn] = useState<
    Partial<Record<CoreStatKey, number>>
  >({});
  const previousCoreStatSnapshotRef = useRef<CoreStatSnapshot | null>(null);
  const [textInputValue, setTextInputValue] = useState("");
  const soundPackDialogActionsRef = useRef<SoundPackDialogActions | null>(null);
  const {
    dialog: globalConfirmationDialog,
    requestConfirmation,
    resolveConfirmation,
  } = useConfirmationDialog();
  const startupControllerPreviousActionActiveRef = useRef<
    Partial<Record<Nh3dControllerActionId, boolean>>
  >({});
  const startupAccordionConfirmReleaseLatchRef = useRef(false);
  const startupControllerSliderInteractionActiveRef = useRef(false);
  const startupControllerSliderStepCarryRef = useRef(0);
  const startupControllerActiveSliderElementRef =
    useRef<HTMLInputElement | null>(null);
  const startupControllerCursorElementRef = useRef<HTMLDivElement | null>(null);
  const startupControllerCursorPulseElementRef = useRef<HTMLDivElement | null>(
    null,
  );
  const startupControllerCursorHighlightElementRef = useRef<HTMLElement | null>(
    null,
  );
  const startupControllerCursorPulseTimerRef = useRef<number | null>(null);
  const startupBuildLabelToastTimerRef = useRef<number | null>(null);
  const startupControllerCursorVisibleRef = useRef(false);
  const startupControllerCursorXRef = useRef<number>(Number.NaN);
  const startupControllerCursorYRef = useRef<number>(Number.NaN);
  const refreshMobileStatsCoreRowScaleRef = useRef<(() => void) | null>(null);
  const adapter = useMemo(() => createEngineUiAdapter(), []);
  const setEngineController = useGameStore(
    (state) => state.setEngineController,
  );
  const setPositionRequest = useGameStore((state) => state.setPositionRequest);
  const setFloatingMessageTiming = useGameStore(
    (state) => state.setFloatingMessageTiming,
  );
  const setNewGamePrompt = useGameStore((state) => state.setNewGamePrompt);
  const setGameOver = useGameStore((state) => state.setGameOver);

  const loadingVisible = useGameStore((state) => state.loadingVisible);
  const statusText = useGameStore((state) => state.statusText);
  const gameMessages = useGameStore((state) => state.gameMessages);
  const floatingMessages = useGameStore((state) => state.floatingMessages);
  const playerStats = useGameStore((state) => state.playerStats);
  const question = useGameStore((state) => state.question);
  const directionQuestion = useGameStore((state) => state.directionQuestion);
  const numberPadModeEnabled = useGameStore(
    (state) => state.numberPadModeEnabled,
  );
  const infoMenu = useGameStore((state) => state.infoMenu);
  const inventory = useGameStore((state) => state.inventory);
  const textInputRequest = useGameStore((state) => state.textInput);
  const fpsCrosshairContext = useGameStore(
    (state) => state.fpsCrosshairContext,
  );
  const repeatActionVisible = useGameStore(
    (state) => state.repeatActionVisible,
  );
  const positionRequest = useGameStore((state) => state.positionRequest);
  const positionInputActive = useGameStore(
    (state) => state.positionInputActive,
  );
  const positionInputOrigin = useGameStore(
    (state) => state.positionInputOrigin,
  );
  const connectionState = useGameStore((state) => state.connectionState);
  const extendedCommands = useGameStore((state) => state.extendedCommands);
  const controller = useGameStore((state) => state.engineController);
  const newGamePrompt = useGameStore((state) => state.newGamePrompt);
  const gameOver = useGameStore((state) => state.gameOver);
  const [messageInfoMenuHistory, setMessageInfoMenuHistory] =
    useState<MessageInfoMenuHistoryState>({
      entries: [],
      index: 0,
    });
  const questionTextInputRef = useRef<HTMLInputElement | null>(null);
  const [questionTextInputValue, setQuestionTextInputValue] = useState("");
  useEffect(() => {
    setMessageInfoMenuHistory({
      entries: [],
      index: 0,
    });
  }, [characterCreationConfig]);
  useEffect(() => {
    if (!infoMenu || !isNetHackMessageInfoMenuTitle(infoMenu.title)) {
      return;
    }

    const normalizedMessageInfoMenu: InfoMenuState = {
      title: String(infoMenu.title || "NetHack Message").trim(),
      lines: Array.isArray(infoMenu.lines)
        ? infoMenu.lines.map((line) => String(line ?? ""))
        : [],
    };
    const nextEntryKey = getInfoMenuHistoryEntryKey(normalizedMessageInfoMenu);

    setMessageInfoMenuHistory((previous) => {
      const latestEntry = previous.entries[previous.entries.length - 1];
      if (
        latestEntry &&
        getInfoMenuHistoryEntryKey(latestEntry) === nextEntryKey
      ) {
        const latestIndex = previous.entries.length - 1;
        return previous.index === latestIndex
          ? previous
          : {
              ...previous,
              index: latestIndex,
            };
      }

      const nextEntries = [
        ...previous.entries,
        normalizedMessageInfoMenu,
      ].slice(-messageInfoMenuCacheLimit);
      return {
        entries: nextEntries,
        index: nextEntries.length - 1,
      };
    });
  }, [infoMenu]);
  const displayedInfoMenu = useMemo<InfoMenuState | null>(() => {
    if (!infoMenu) {
      return null;
    }
    if (!isNetHackMessageInfoMenuTitle(infoMenu.title)) {
      return infoMenu;
    }
    return (
      messageInfoMenuHistory.entries[messageInfoMenuHistory.index] ?? infoMenu
    );
  }, [infoMenu, messageInfoMenuHistory]);
  const characterSheet = useMemo(
    () => parseCharacterSheetInfoMenu(displayedInfoMenu),
    [displayedInfoMenu],
  );
  const isLegacySlashEmBaseAttributesSheet =
    activeRuntimeVersion === "slashem" &&
    characterSheet?.variant === "slashem_base_attributes";
  const displayedCharacterStatEntries = useMemo(() => {
    if (!characterSheet) {
      return [];
    }
    if (!isLegacySlashEmBaseAttributesSheet) {
      return characterSheet.statEntries;
    }
    return characterSheet.statEntries.map((entry) => {
      const currentValue = getLegacyCharacterStatValue(entry.id, playerStats);
      return {
        ...entry,
        rawValue: currentValue,
        currentValue,
        limitValue: null,
      };
    });
  }, [characterSheet, isLegacySlashEmBaseAttributesSheet, playerStats]);
  const isCharacterSheetVisible = Boolean(
    displayedInfoMenu && characterSheet && characterSheetInterceptionArmed,
  );
  const hasCharacterStatValues = Boolean(
    displayedCharacterStatEntries.some((entry) =>
      Boolean(entry.currentValue || entry.rawValue || entry.limitValue),
    ),
  );
  const hasCharacterStatLimits = Boolean(
    displayedCharacterStatEntries.some((entry) => Boolean(entry.limitValue)),
  );
  const showLegacySlashEmDeitiesPanel = Boolean(
    isLegacySlashEmBaseAttributesSheet &&
    characterSheet?.deityLines &&
    characterSheet.deityLines.length > 0,
  );
  const characterExperienceProgress = useMemo(() => {
    const level = Number.isFinite(playerStats.level)
      ? Math.max(1, Math.trunc(playerStats.level))
      : 1;
    const experiencePoints = Number.isFinite(playerStats.experience)
      ? Math.max(0, Math.trunc(playerStats.experience))
      : 0;
    const currentLevelStart = getExperienceThresholdForLevel(level - 1);
    if (level >= maxExperienceLevel) {
      return {
        level,
        experiencePoints,
        isMaxLevel: true,
        currentLevelStart,
        nextLevelThreshold: currentLevelStart,
        toNextLevel: 0,
        progressPercent: 100,
      };
    }
    const nextLevelThreshold = getExperienceThresholdForLevel(level);
    const levelSpan = Math.max(1, nextLevelThreshold - currentLevelStart);
    const gainedThisLevel = Math.max(
      0,
      Math.min(levelSpan, experiencePoints - currentLevelStart),
    );
    const toNextLevel = Math.max(0, nextLevelThreshold - experiencePoints);
    return {
      level,
      experiencePoints,
      isMaxLevel: false,
      currentLevelStart,
      nextLevelThreshold,
      toNextLevel,
      progressPercent: Math.max(
        0,
        Math.min(100, (gainedThisLevel / levelSpan) * 100),
      ),
    };
  }, [playerStats.level, playerStats.experience]);
  const floatingMessageTextStyle = useMemo(
    () =>
      ({
        "--floating-message-fade-delay-ms": `${clientOptions.liveMessageDisplayTimeMs}ms`,
        "--floating-message-fade-duration-ms": `${clientOptions.liveMessageFadeOutTimeMs}ms`,
      }) as React.CSSProperties,
    [
      clientOptions.liveMessageDisplayTimeMs,
      clientOptions.liveMessageFadeOutTimeMs,
    ],
  );
  useEffect(() => {
    return () => {
      if (startupBuildLabelToastTimerRef.current !== null) {
        window.clearTimeout(startupBuildLabelToastTimerRef.current);
        startupBuildLabelToastTimerRef.current = null;
      }
    };
  }, []);
  const refreshDebugSessionLogs = useCallback((): void => {
    const nextLogs = readDebugSessionLogs();
    setDebugSessionLogs(nextLogs);
    setSelectedDebugSessionLogId((previous) => {
      if (previous && nextLogs.some((session) => session.id === previous)) {
        return previous;
      }
      return nextLogs[0]?.id || "";
    });
  }, []);
  const openDebugSessionLogsDialog = useCallback((): void => {
    refreshDebugSessionLogs();
    setIsDebugSessionLogsVisible(true);
  }, [refreshDebugSessionLogs]);
  useEffect(() => {
    if (!debugSessionLogsEnabled) {
      return;
    }
    setLoggingEnabled(true);
    enableDebugSessionLogCapture({ buildLabel: nh3dBuildLabel });
    refreshDebugSessionLogs();
  }, [debugSessionLogsEnabled, refreshDebugSessionLogs]);
  const handleStartupBuildLabelClick = useCallback((): void => {
    setStartupBuildLabelClickCount((previous) => {
      const next = previous + 1;
      if (next < nh3dBuildLabelDebugEnableClickCount) {
        return next;
      }
      setLoggingEnabled(true);
      enableDebugSessionLogCapture({ buildLabel: nh3dBuildLabel });
      recordDebugSessionLogEvent("debug-log-toggle", [
        t.debugLogs.enabledLogEntry,
      ]);
      setDebugSessionLogsEnabled(true);
      setIsDebugSessionLogsLinkVisible(true);
      refreshDebugSessionLogs();
      setStartupBuildLabelToastVisible(true);
      if (startupBuildLabelToastTimerRef.current !== null) {
        window.clearTimeout(startupBuildLabelToastTimerRef.current);
      }
      startupBuildLabelToastTimerRef.current = window.setTimeout(() => {
        setStartupBuildLabelToastVisible(false);
        startupBuildLabelToastTimerRef.current = null;
      }, 2200);
      return 0;
    });
  }, [refreshDebugSessionLogs]);
  const selectedDebugSessionLog = useMemo(
    () =>
      debugSessionLogs.find(
        (session) => session.id === selectedDebugSessionLogId,
      ) ||
      debugSessionLogs[0] ||
      null,
    [debugSessionLogs, selectedDebugSessionLogId],
  );
  const selectedDebugSessionLogText = useMemo(
    () =>
      selectedDebugSessionLog
        ? formatDebugSessionLogSession(selectedDebugSessionLog)
        : t.dialogs.debugLogs.noneSaved,
    [selectedDebugSessionLog],
  );
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.style.setProperty(
      "--nh3d-ui-font-scale",
      String(clientOptions.uiFontScale),
    );
    root.style.setProperty(
      "--nh3d-live-log-font-scale",
      String(clientOptions.liveMessageLogFontScale),
    );
    root.style.setProperty(
      "--nh3d-desktop-log-window-scale",
      String(clientOptions.desktopMessageLogWindowScale),
    );
    root.style.setProperty(
      "--nh3d-minimap-scale",
      String(clientOptions.minimapScale),
    );
    return () => {
      root.style.removeProperty("--nh3d-ui-font-scale");
      root.style.removeProperty("--nh3d-live-log-font-scale");
      root.style.removeProperty("--nh3d-desktop-log-window-scale");
      root.style.removeProperty("--nh3d-minimap-scale");
    };
  }, [
    clientOptions.uiFontScale,
    clientOptions.liveMessageLogFontScale,
    clientOptions.desktopMessageLogWindowScale,
    clientOptions.minimapScale,
  ]);
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.classList.toggle(
      "nh3d-manual-mobile-bottom-safe-zone",
      clientOptions.manualMobileBottomSafeZoneEnabled,
    );
    root.style.setProperty(
      "--nh3d-manual-mobile-bottom-safe-zone-vertical",
      `${Math.round(clientOptions.manualMobileBottomSafeZoneVerticalPx)}px`,
    );
    root.style.setProperty(
      "--nh3d-manual-mobile-bottom-safe-zone-horizontal",
      `${Math.round(clientOptions.manualMobileBottomSafeZoneHorizontalPx)}px`,
    );
    root.style.setProperty(
      "--nh3d-manual-mobile-right-safe-zone-horizontal",
      `${Math.round(clientOptions.manualMobileRightSafeZoneHorizontalPx)}px`,
    );
    return () => {
      root.classList.remove("nh3d-manual-mobile-bottom-safe-zone");
      root.style.removeProperty(
        "--nh3d-manual-mobile-bottom-safe-zone-vertical",
      );
      root.style.removeProperty(
        "--nh3d-manual-mobile-bottom-safe-zone-horizontal",
      );
      root.style.removeProperty(
        "--nh3d-manual-mobile-right-safe-zone-horizontal",
      );
    };
  }, [
    clientOptions.manualMobileBottomSafeZoneEnabled,
    clientOptions.manualMobileBottomSafeZoneVerticalPx,
    clientOptions.manualMobileBottomSafeZoneHorizontalPx,
    clientOptions.manualMobileRightSafeZoneHorizontalPx,
  ]);
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.classList.toggle(
      "nh3d-disable-animated-transitions",
      clientOptions.disableAnimatedTransitions,
    );
    return () => {
      root.classList.remove("nh3d-disable-animated-transitions");
    };
  }, [clientOptions.disableAnimatedTransitions]);
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const trackedElements = new Map<HTMLElement, () => void>();
    let refreshRafId: number | null = null;

    const refreshOverflowGlowTargets = (): void => {
      const activeElements = new Set<HTMLElement>();
      const candidates = document.querySelectorAll<HTMLElement>(
        overflowGlowTargetSelector,
      );
      for (const element of candidates) {
        if (!element.isConnected) {
          continue;
        }
        const hasOverflowGlow = updateOverflowGlowState(element);
        if (!hasOverflowGlow) {
          continue;
        }
        activeElements.add(element);
        if (trackedElements.has(element)) {
          continue;
        }
        const onScroll = (): void => {
          updateOverflowGlowState(element);
        };
        element.addEventListener("scroll", onScroll, { passive: true });
        trackedElements.set(element, onScroll);
      }

      for (const [element, onScroll] of trackedElements.entries()) {
        if (activeElements.has(element) && element.isConnected) {
          continue;
        }
        element.removeEventListener("scroll", onScroll);
        trackedElements.delete(element);
        clearOverflowGlowState(element);
      }
    };

    const scheduleOverflowGlowRefresh = (): void => {
      if (refreshRafId !== null) {
        return;
      }
      refreshRafId = window.requestAnimationFrame(() => {
        refreshRafId = null;
        refreshOverflowGlowTargets();
      });
    };

    scheduleOverflowGlowRefresh();

    const mutationObserver = new MutationObserver(() => {
      scheduleOverflowGlowRefresh();
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("resize", scheduleOverflowGlowRefresh);
    window.addEventListener("orientationchange", scheduleOverflowGlowRefresh);

    return () => {
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleOverflowGlowRefresh);
      window.removeEventListener(
        "orientationchange",
        scheduleOverflowGlowRefresh,
      );
      if (refreshRafId !== null) {
        window.cancelAnimationFrame(refreshRafId);
      }
      for (const [element, onScroll] of trackedElements.entries()) {
        element.removeEventListener("scroll", onScroll);
        clearOverflowGlowState(element);
      }
      trackedElements.clear();
    };
  }, []);
  const [
    reopenNewGamePromptOnInteraction,
    setReopenNewGamePromptOnInteraction,
  ] = useState(false);
  const [deferredNewGamePromptReason, setDeferredNewGamePromptReason] =
    useState<string | null>(null);
  const newGamePromptYesButtonRef = useRef<HTMLButtonElement | null>(null);
  const newGamePromptNoButtonRef = useRef<HTMLButtonElement | null>(null);
  const startupLikelyOpenSelectElementsRef = useRef<Set<HTMLSelectElement>>(
    new Set(),
  );
  const startupLikelyOpenSelectInitialValueByElementRef = useRef<
    Map<HTMLSelectElement, string>
  >(new Map());
  const clientOptionsLikelyOpenSelectElementsRef = useRef<
    Set<HTMLSelectElement>
  >(new Set());
  const clientOptionsLikelyOpenSelectInitialValueByElementRef = useRef<
    Map<HTMLSelectElement, string>
  >(new Map());
  const tilesetCatalog = useMemo(
    () => getNh3dCompatibleTilesetCatalog(activeRuntimeVersion),
    [activeRuntimeVersion, userTilesets],
  );
  const showBuiltInTilesetsInTilesetManagerList = useMemo(
    () => isRunningOnLocalhost(),
    [],
  );
  const showDeveloperClientSettings = showBuiltInTilesetsInTilesetManagerList;
  const userTilesetRecordByPath = useMemo(() => {
    const recordByPath = new Map<string, StoredUserTilesetRecord>();
    for (const record of userTilesets) {
      recordByPath.set(getNh3dUserTilesetPath(record.id), record);
    }
    return recordByPath;
  }, [userTilesets]);
  const tilesetManagerListTilesets = useMemo(
    () =>
      tilesetCatalog.filter(
        (tileset) =>
          tileset.source === "user" || showBuiltInTilesetsInTilesetManagerList,
      ),
    [showBuiltInTilesetsInTilesetManagerList, tilesetCatalog],
  );
  const hasAnyTilesets = tilesetCatalog.length > 0;
  const tilesetCatalogLayoutVersionCount = useMemo(
    () =>
      new Set(tilesetCatalog.map((tileset) => tileset.tileLayoutVersion)).size,
    [tilesetCatalog],
  );
  const showTilesetLayoutInDropdown = tilesetCatalogLayoutVersionCount > 1;
  const tilesetDropdownOptions = useMemo(
    () =>
      hasAnyTilesets
        ? tilesetCatalog.map((tileset) => ({
            value: tileset.path,
            label: formatTilesetPickerOptionLabel(
              tileset,
              showTilesetLayoutInDropdown,
            ),
          }))
        : [{ value: "", label: t.tilesets.noTilesetsFound }],
    [hasAnyTilesets, showTilesetLayoutInDropdown, tilesetCatalog],
  );
  useEffect(() => {
    const currentClientTilesetPath = String(
      clientOptions.tilesetPath || "",
    ).trim();
    const compatibleClientTilesetPath =
      resolveNh3dCompatibleTilesetPathForRuntime(
        currentClientTilesetPath,
        activeRuntimeVersion,
      );
    if (
      compatibleClientTilesetPath &&
      compatibleClientTilesetPath !== currentClientTilesetPath
    ) {
      setClientOptions((previous) =>
        normalizeNh3dClientOptions({
          ...previous,
          tilesetPath: compatibleClientTilesetPath,
        }),
      );
    }

    const currentDraftTilesetPath = String(
      clientOptionsDraft.tilesetPath || "",
    ).trim();
    const compatibleDraftTilesetPath =
      resolveNh3dCompatibleTilesetPathForRuntime(
        currentDraftTilesetPath,
        activeRuntimeVersion,
      );
    if (
      compatibleDraftTilesetPath &&
      compatibleDraftTilesetPath !== currentDraftTilesetPath
    ) {
      setClientOptionsDraft((previous) =>
        normalizeNh3dClientOptions({
          ...previous,
          tilesetPath: compatibleDraftTilesetPath,
        }),
      );
    }
  }, [
    clientOptions.tilesetPath,
    clientOptionsDraft.tilesetPath,
    activeRuntimeVersion,
    userTilesets,
  ]);
  const selectedClientOptionsTab = useMemo<ClientOptionsTab>(
    () =>
      clientOptionsTabs.find((tab) => tab.id === activeClientOptionsTab) ??
      clientOptionsTabs[0],
    [activeClientOptionsTab],
  );
  const visibleClientOptions = useMemo(
    () => getClientOptionsForGroup(selectedClientOptionsTab.groupKey),
    [selectedClientOptionsTab.groupKey],
  );
  const controllerRemapListeningActionLabel = useMemo(() => {
    if (!controllerRemapListening) {
      return "";
    }
    for (const group of controllerActionGroupOrder) {
      const spec = nh3dControllerActionSpecsByGroup[group].find(
        (entry) => entry.id === controllerRemapListening.actionId,
      );
      if (spec) {
        return spec.label;
      }
    }
    return controllerRemapListening.actionId;
  }, [controllerRemapListening]);
  const connectedControllerCount = useMemo(
    () =>
      isControllerRemapVisible ? getConnectedGamepadsForCapture().length : 0,
    [isControllerRemapVisible, controllerRemapListening],
  );
  const isFpsPlayMode = clientOptions.fpsMode;
  const fpsCrosshairContextMenuRef = useRef<HTMLDivElement | null>(null);
  const fpsCrosshairContextLastVisibleRef =
    useRef<FpsCrosshairContextState | null>(null);
  const [tileContextMenuPosition, setTileContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const tileContextMenuPositionLastVisibleRef = useRef<{
    x: number;
    y: number;
  } | null>(null);
  const inventoryItemActions = useMemo(
    () =>
      activeRuntimeVersion === "slashem"
        ? inventoryContextActions.filter((action) => action.id !== "tip")
        : inventoryContextActions,
    [activeRuntimeVersion],
  );
  const inventoryContextMenuRef = useRef<HTMLDivElement | null>(null);
  const inventoryDropTypeMenuRef = useRef<HTMLDivElement | null>(null);
  const inventoryDropActionButtonRef = useRef<HTMLButtonElement | null>(null);
  const inventoryDialogRef = useRef<HTMLDivElement | null>(null);
  const inventoryItemsContainerRef = useRef<HTMLDivElement | null>(null);
  const inventoryRowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const inventoryContextMenuStateRef = useRef<InventoryContextMenuState | null>(
    null,
  );
  const inventoryContextMenuLastVisibleRef =
    useRef<InventoryContextMenuState | null>(null);
  const inventoryRowHoverValueByIndexRef = useRef<Map<number, number>>(
    new Map(),
  );
  const inventoryKeyboardActivationKeysDownRef = useRef<Set<string>>(new Set());
  const inventoryContextMenuKeyboardOpenPendingRef = useRef(false);
  const inventoryPointerClientYRef = useRef<number | null>(null);
  const inventoryPointerActiveRef = useRef(false);
  const inventoryRowProximityAnimationFrameRef = useRef<number | null>(null);
  const inventoryTouchFallbackClearTimerRef = useRef<number | null>(null);
  const inventoryRowPressCandidateRef =
    useRef<InventoryRowPressCandidate | null>(null);
  const inventoryDropTypeHoldStateRef = useRef<{
    pointerId: number;
    startedAtMs: number;
    triggered: boolean;
  } | null>(null);
  const inventoryDropTypeHoldAnimationFrameRef = useRef<number | null>(null);
  const inventorySuppressDropActionClickRef = useRef(false);
  const tilesUiEnabled = clientOptions.tilesetMode === "tiles";
  const inventoryAsciiModeEnabled = !tilesUiEnabled;
  const inventoryReducedMotionEnabled =
    inventoryAsciiModeEnabled || clientOptions.reduceInventoryMotion === true;
  const inventoryTileOnlyMotionEnabled =
    !inventoryReducedMotionEnabled &&
    clientOptions.inventoryTileOnlyMotion === true;
  const inventoryUsesFullRowAnimation =
    !inventoryReducedMotionEnabled && !inventoryTileOnlyMotionEnabled;
  const inventoryFixedTileSizeMode = clientOptions.inventoryFixedTileSize;
  const inventoryFixedIconSizePx =
    inventoryFixedTileSizeMode === "small"
      ? 20
      : inventoryFixedTileSizeMode === "large"
        ? 50
        : 35;
  const [fpsContextTitleAnimationInstance, setFpsContextTitleAnimationInstance] =
    useState(0);
  const [inventoryContextMenu, setInventoryContextMenu] =
    useState<InventoryContextMenuState | null>(null);
  const [inventoryContextTitleAnimationInstance, setInventoryContextTitleAnimationInstance] =
    useState(0);
  const [inventoryDropTypeMenuPosition, setInventoryDropTypeMenuPosition] =
    useState<{ x: number; y: number } | null>(null);
  const [inventoryDropCountDialog, setInventoryDropCountDialog] =
    useState<InventoryDropCountDialogState | null>(null);
  const [inventoryDropCountValue, setInventoryDropCountValue] = useState(1);
  const inventoryDropCountSliderRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (fpsCrosshairContext) {
      fpsCrosshairContextLastVisibleRef.current = fpsCrosshairContext;
    }
  }, [fpsCrosshairContext]);
  useEffect(() => {
    if (!fpsCrosshairContext) {
      return;
    }
    setFpsContextTitleAnimationInstance((previous) => previous + 1);
  }, [fpsCrosshairContext]);
  useEffect(() => {
    if (tileContextMenuPosition) {
      tileContextMenuPositionLastVisibleRef.current = tileContextMenuPosition;
    }
  }, [tileContextMenuPosition]);
  useEffect(() => {
    inventoryContextMenuStateRef.current = inventoryContextMenu;
    if (inventoryContextMenu) {
      inventoryContextMenuLastVisibleRef.current = inventoryContextMenu;
    }
  }, [inventoryContextMenu]);
  useEffect(() => {
    if (!inventoryContextMenu) {
      return;
    }
    setInventoryContextTitleAnimationInstance((previous) => previous + 1);
  }, [inventoryContextMenu]);
  useEffect(() => {
    if (
      !inventoryContextMenu ||
      !inventoryContextMenuKeyboardOpenPendingRef.current ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }

    let cancelled = false;
    let animationFrameId: number | null = null;
    let remainingFrameAttempts = 4;
    const focusFirstActionButton = (): void => {
      if (cancelled) {
        return;
      }
      const firstActionButton =
        inventoryContextMenuRef.current?.querySelector<HTMLButtonElement>(
          ".nh3d-context-menu-button:not(:disabled)",
        ) ?? null;
      if (!firstActionButton) {
        if (remainingFrameAttempts <= 0) {
          return;
        }
        remainingFrameAttempts -= 1;
        animationFrameId = window.requestAnimationFrame(focusFirstActionButton);
        return;
      }
      firstActionButton.focus({ preventScroll: true });
      firstActionButton.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
      inventoryContextMenuKeyboardOpenPendingRef.current = false;
    };
    const timerId = window.setTimeout(() => {
      focusFirstActionButton();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [inventoryContextMenu]);
  const fpsCrosshairContextRenderState =
    fpsCrosshairContext ?? fpsCrosshairContextLastVisibleRef.current;
  const tileContextMenuRenderPosition =
    tileContextMenuPosition ?? tileContextMenuPositionLastVisibleRef.current;
  const inventoryContextMenuRenderState =
    inventoryContextMenu ?? inventoryContextMenuLastVisibleRef.current;
  const fpsContextTitle = String(fpsCrosshairContextRenderState?.title || "");
  const fpsContextTitleAnimationKey =
    `fps-context-title-${fpsContextTitleAnimationInstance}`;
  const fpsContextTitleScroll = useContextMenuTitleScroll(
    fpsContextTitle,
    Boolean(fpsCrosshairContextRenderState),
  );
  const inventoryContextTitle = inventoryContextMenuRenderState
    ? `${inventoryContextMenuRenderState.itemText} (${inventoryContextMenuRenderState.accelerator})`
    : "";
  const inventoryContextTitleAnimationKey =
    `inventory-context-title-${inventoryContextTitleAnimationInstance}`;
  const inventoryContextTitleScroll = useContextMenuTitleScroll(
    inventoryContextTitle,
    Boolean(inventoryContextMenuRenderState),
  );
  const inventoryItemCategoryByAccelerator = useMemo(() => {
    const categoryByAccelerator = new Map<string, string>();
    let currentCategory = "";
    for (const item of inventory.items) {
      if (item?.isCategory) {
        currentCategory = normalizeInventoryCategoryLabel(item.text);
        continue;
      }
      const accelerator =
        typeof item?.accelerator === "string" ? item.accelerator.trim() : "";
      if (!accelerator) {
        continue;
      }
      categoryByAccelerator.set(accelerator, currentCategory);
    }
    return categoryByAccelerator;
  }, [inventory.items]);
  const inventoryContextCategory = useMemo(() => {
    if (!inventoryContextMenu) {
      return "";
    }
    return (
      inventoryItemCategoryByAccelerator.get(
        String(inventoryContextMenu.accelerator || "").trim(),
      ) || ""
    );
  }, [inventoryContextMenu, inventoryItemCategoryByAccelerator]);
  const inventoryContextCategoryId = useMemo(
    () => classifyInventoryCategory(inventoryContextCategory),
    [inventoryContextCategory],
  );
  const inventoryContextStackCount = useMemo(
    () =>
      parseInventoryStackCount(String(inventoryContextMenu?.itemText || "")),
    [inventoryContextMenu?.itemText],
  );
  const inventoryContextSupportsDropAmount =
    typeof inventoryContextStackCount === "number" &&
    Number.isFinite(inventoryContextStackCount) &&
    inventoryContextStackCount > 1;
  const inventoryDropCountMaxValue = useMemo(() => {
    if (
      !inventoryDropCountDialog ||
      !Number.isFinite(inventoryDropCountDialog.maxCount)
    ) {
      return 1;
    }
    return Math.max(1, Math.trunc(inventoryDropCountDialog.maxCount));
  }, [inventoryDropCountDialog]);
  const inventoryContextMenuActions = useMemo(() => {
    const blocked = getBlockedInventoryActionIdsForCategory(
      inventoryContextCategory,
    );
    const filteredByCategory = blocked.size
      ? inventoryItemActions.filter((action) => !blocked.has(action.id))
      : inventoryItemActions;
    const selectedItemText = String(inventoryContextMenu?.itemText || "");
    const filteredByItemSupport = filteredByCategory.filter((action) =>
      inventoryItemSupportsContextAction(
        action.id,
        inventoryContextCategoryId,
        selectedItemText,
      ),
    );
    const visibleActions =
      inventoryContextCategoryId === "weapons"
        ? filteredByItemSupport
        : filteredByItemSupport.filter((action) => action.id !== "quiver");
    const selectedItemIsWeaponInHand = /\bweapon in hand\b/i.test(
      selectedItemText,
    );
    if (!selectedItemIsWeaponInHand) {
      return visibleActions;
    }
    return visibleActions.map((action) =>
      action.id === "wield"
        ? { ...action, id: "unwield", label: "Unwield" }
        : action,
    );
  }, [
    inventoryContextCategory,
    inventoryContextCategoryId,
    inventoryContextMenu?.itemText,
    inventoryItemActions,
  ]);
  const getInventoryContextMenuClampRegion = useCallback((): DOMRect | null => {
    const inventoryDialogRect =
      inventoryDialogRef.current?.getBoundingClientRect() ?? null;
    const inventoryItemsRect =
      inventoryItemsContainerRef.current?.getBoundingClientRect() ?? null;
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return inventoryDialogRect ?? inventoryItemsRect;
    }
    return inventoryItemsRect ?? inventoryDialogRect;
  }, []);
  const applyInventoryRowProximity = useCallback((): void => {
    inventoryRowProximityAnimationFrameRef.current = null;
    const rows = inventoryRowRefs.current;
    const hoverValuesByIndex = inventoryRowHoverValueByIndexRef.current;
    if (rows.size === 0) {
      hoverValuesByIndex.clear();
      return;
    }
    if (inventoryReducedMotionEnabled) {
      for (const [index, rowElement] of rows.entries()) {
        hoverValuesByIndex.set(index, 0);
        rowElement.style.setProperty("--nh3d-inv-hover", "0");
      }
      return;
    }
    const pointerY = inventoryPointerClientYRef.current;
    const rawPointerIsActive =
      inventoryPointerActiveRef.current &&
      typeof pointerY === "number" &&
      Number.isFinite(pointerY);
    const proximityFalloffPx = 240;
    let needsAnotherFrame = false;
    const activeIndexes = new Set<number>();
    let pinnedActiveIndex: number | null = null;
    let pinnedActiveRowRect: DOMRect | null = null;
    let virtualPointerY: number | null = null;

    for (const [index, rowElement] of rows.entries()) {
      if (
        rowElement.classList.contains("nh3d-inventory-item-active") &&
        !rowElement.classList.contains("nh3d-inventory-item-disabled")
      ) {
        pinnedActiveIndex = index;
        const activeRowRect = rowElement.getBoundingClientRect();
        pinnedActiveRowRect = activeRowRect;
        if (activeRowRect.height > 0) {
          virtualPointerY = activeRowRect.top + activeRowRect.height / 2;
        }
        break;
      }
    }
    const effectivePointerY =
      typeof virtualPointerY === "number" && Number.isFinite(virtualPointerY)
        ? virtualPointerY
        : pointerY;
    const pointerIsActive =
      typeof effectivePointerY === "number" &&
      Number.isFinite(effectivePointerY) &&
      (pinnedActiveIndex !== null || rawPointerIsActive);
    const smoothing = pointerIsActive ? 0.26 : 0.2;

    for (const [index, rowElement] of rows.entries()) {
      activeIndexes.add(index);
      let targetValue = 0;
      if (rowElement.classList.contains("nh3d-inventory-item-disabled")) {
        targetValue = 0;
      } else if (pointerIsActive) {
        const rowRect = rowElement.getBoundingClientRect();
        if (rowRect.height > 0) {
          const rowCenterY = rowRect.top + rowRect.height / 2;
          const distancePx = Math.abs(effectivePointerY - rowCenterY);
          const normalized = Math.max(0, 1 - distancePx / proximityFalloffPx);
          targetValue = normalized * normalized * (3 - 2 * normalized);
        }
      }

      const currentValue = hoverValuesByIndex.get(index) ?? 0;
      let nextValue = currentValue + (targetValue - currentValue) * smoothing;
      if (Math.abs(targetValue - nextValue) < 0.0015) {
        nextValue = targetValue;
      } else {
        needsAnotherFrame = true;
      }

      hoverValuesByIndex.set(index, nextValue);
      rowElement.style.setProperty("--nh3d-inv-hover", nextValue.toFixed(4));
    }

    for (const index of Array.from(hoverValuesByIndex.keys())) {
      if (!activeIndexes.has(index)) {
        hoverValuesByIndex.delete(index);
      }
    }

    const inventoryItemsContainer = inventoryItemsContainerRef.current;
    const inventoryItemsRect =
      inventoryItemsContainer?.getBoundingClientRect() ?? null;
    if (pinnedActiveRowRect && inventoryItemsContainer && inventoryItemsRect) {
      const viewportInsetPx = 6;
      const lowerBound = inventoryItemsRect.bottom - viewportInsetPx;
      const upperBound = inventoryItemsRect.top + viewportInsetPx;
      const overflowBelow = pinnedActiveRowRect.bottom - lowerBound;
      const overflowAbove = upperBound - pinnedActiveRowRect.top;
      if (overflowBelow > 0.5) {
        inventoryItemsContainer.scrollTop += overflowBelow;
      } else if (overflowAbove > 0.5) {
        inventoryItemsContainer.scrollTop -= overflowAbove;
      }
    }

    if (pinnedActiveRowRect && inventoryContextMenuRef.current) {
      const menuRect = inventoryContextMenuRef.current.getBoundingClientRect();
      const menuWidth =
        Number.isFinite(menuRect.width) && menuRect.width > 0
          ? menuRect.width
          : 220;
      const menuHeight =
        Number.isFinite(menuRect.height) && menuRect.height > 0
          ? menuRect.height
          : 260;
      const anchorRightX =
        pinnedActiveRowRect.right + inventoryContextMenuAnchorGapPx;
      const anchorBottomY =
        pinnedActiveRowRect.bottom + inventoryContextMenuAnchorBottomGapPx;
      const anchorCenterX =
        pinnedActiveRowRect.left + pinnedActiveRowRect.width * 0.5;
      const anchorLeftX =
        pinnedActiveRowRect.left - inventoryContextMenuAnchorGapPx;
      const anchorTopY =
        pinnedActiveRowRect.top - inventoryContextMenuAnchorBottomGapPx;
      setInventoryContextMenu((previous) => {
        if (!previous) {
          return previous;
        }
        const next = resolveInventoryContextMenuPosition(
          {
            ...previous,
            anchorCenterX,
            anchorLeftX,
            anchorBottomY,
            anchorRightX,
            anchorTopY,
          },
          menuWidth,
          menuHeight,
          getInventoryContextMenuClampRegion(),
        );
        const previousAnchorBottomY =
          typeof previous.anchorBottomY === "number" &&
          Number.isFinite(previous.anchorBottomY)
            ? previous.anchorBottomY
            : previous.y;
        const previousAnchorRightX =
          typeof previous.anchorRightX === "number" &&
          Number.isFinite(previous.anchorRightX)
            ? previous.anchorRightX
            : previous.x;
        const previousAnchorCenterX =
          typeof previous.anchorCenterX === "number" &&
          Number.isFinite(previous.anchorCenterX)
            ? previous.anchorCenterX
            : previous.x;
        const previousAnchorLeftX =
          typeof previous.anchorLeftX === "number" &&
          Number.isFinite(previous.anchorLeftX)
            ? previous.anchorLeftX
            : previous.x;
        if (
          Math.abs(next.x - previous.x) < 0.02 &&
          Math.abs(next.y - previous.y) < 0.02 &&
          Math.abs(anchorBottomY - previousAnchorBottomY) < 0.02 &&
          Math.abs(anchorCenterX - previousAnchorCenterX) < 0.02 &&
          Math.abs(anchorRightX - previousAnchorRightX) < 0.02 &&
          Math.abs(anchorLeftX - previousAnchorLeftX) < 0.02
        ) {
          return previous;
        }
        return {
          ...previous,
          anchorCenterX,
          anchorLeftX,
          x: next.x,
          y: next.y,
          anchorBottomY,
          anchorRightX,
          anchorTopY,
        };
      });
    }

    if (needsAnotherFrame && typeof window !== "undefined") {
      inventoryRowProximityAnimationFrameRef.current =
        window.requestAnimationFrame(() => {
          applyInventoryRowProximity();
        });
    }
  }, [getInventoryContextMenuClampRegion, inventoryReducedMotionEnabled]);
  const scheduleInventoryRowProximityUpdate = useCallback((): void => {
    if (typeof window === "undefined") {
      return;
    }
    if (inventoryRowProximityAnimationFrameRef.current !== null) {
      return;
    }
    inventoryRowProximityAnimationFrameRef.current =
      window.requestAnimationFrame(() => {
        applyInventoryRowProximity();
      });
  }, [applyInventoryRowProximity]);
  const clearInventoryTouchFallbackClearTimer = useCallback((): void => {
    if (typeof window === "undefined") {
      return;
    }
    const activeTimer = inventoryTouchFallbackClearTimerRef.current;
    if (activeTimer === null) {
      return;
    }
    window.clearTimeout(activeTimer);
    inventoryTouchFallbackClearTimerRef.current = null;
  }, []);
  const scheduleInventoryTouchFallbackClear = useCallback((): void => {
    if (typeof window === "undefined") {
      return;
    }
    clearInventoryTouchFallbackClearTimer();
    inventoryTouchFallbackClearTimerRef.current = window.setTimeout(() => {
      inventoryTouchFallbackClearTimerRef.current = null;
      inventoryPointerActiveRef.current = false;
      inventoryPointerClientYRef.current = null;
      scheduleInventoryRowProximityUpdate();
    }, 220);
  }, [
    clearInventoryTouchFallbackClearTimer,
    scheduleInventoryRowProximityUpdate,
  ]);
  const normalizeInventoryActivationKey = useCallback(
    (key: string): "Enter" | "Space" | null => {
      if (key === "Enter" || key === "NumpadEnter") {
        return "Enter";
      }
      if (key === " " || key === "Space" || key === "Spacebar") {
        return "Space";
      }
      return null;
    },
    [],
  );
  const setInventoryRowRef = useCallback(
    (index: number, element: HTMLDivElement | null): void => {
      if (element) {
        inventoryRowRefs.current.set(index, element);
        const existingValue =
          inventoryRowHoverValueByIndexRef.current.get(index) ?? 0;
        element.style.setProperty("--nh3d-inv-hover", existingValue.toFixed(4));
      } else {
        inventoryRowRefs.current.delete(index);
      }
      if (inventory.visible) {
        scheduleInventoryRowProximityUpdate();
      }
    },
    [inventory.visible, scheduleInventoryRowProximityUpdate],
  );
  const handleInventoryPointerUpdate = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      clearInventoryTouchFallbackClearTimer();
      inventoryPointerActiveRef.current = true;
      inventoryPointerClientYRef.current = event.clientY;
      scheduleInventoryRowProximityUpdate();
    },
    [
      clearInventoryTouchFallbackClearTimer,
      scheduleInventoryRowProximityUpdate,
    ],
  );
  const handleInventoryPointerLeave = useCallback((): void => {
    if (
      inventoryRowPressCandidateRef.current &&
      inventoryRowPressCandidateRef.current.source === "pointer"
    ) {
      inventoryRowPressCandidateRef.current = null;
    }
    clearInventoryTouchFallbackClearTimer();
    inventoryPointerActiveRef.current = false;
    inventoryPointerClientYRef.current = null;
    scheduleInventoryRowProximityUpdate();
  }, [
    clearInventoryTouchFallbackClearTimer,
    scheduleInventoryRowProximityUpdate,
  ]);
  const handleInventoryPointerUp = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    activateInventoryRowPressCandidateFromRelease(
      "pointer",
      event.pointerId,
      event.clientX,
      event.clientY,
      event.target,
    );
    if (event.pointerType === "mouse") {
      return;
    }
    clearInventoryTouchFallbackClearTimer();
    inventoryPointerActiveRef.current = false;
    inventoryPointerClientYRef.current = null;
    scheduleInventoryRowProximityUpdate();
  };
  const handleInventoryPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const pressCandidate = inventoryRowPressCandidateRef.current;
      if (
        pressCandidate &&
        pressCandidate.source === "pointer" &&
        pressCandidate.pointerId === event.pointerId
      ) {
        inventoryRowPressCandidateRef.current = null;
      }
      if (event.pointerType === "touch") {
        scheduleInventoryTouchFallbackClear();
        return;
      }
      handleInventoryPointerLeave();
    },
    [handleInventoryPointerLeave, scheduleInventoryTouchFallbackClear],
  );
  const handleInventoryTouchUpdate = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>): void => {
      const primaryTouch = event.touches[0] ?? event.changedTouches[0];
      if (!primaryTouch) {
        return;
      }
      clearInventoryTouchFallbackClearTimer();
      inventoryPointerActiveRef.current = true;
      inventoryPointerClientYRef.current = primaryTouch.clientY;
      scheduleInventoryRowProximityUpdate();
    },
    [
      clearInventoryTouchFallbackClearTimer,
      scheduleInventoryRowProximityUpdate,
    ],
  );
  const handleInventoryTouchEnd = (
    event: ReactTouchEvent<HTMLDivElement>,
  ): void => {
    const releaseTouch = event.changedTouches[0] ?? event.touches[0];
    if (releaseTouch) {
      activateInventoryRowPressCandidateFromRelease(
        "touch",
        releaseTouch.identifier,
        releaseTouch.clientX,
        releaseTouch.clientY,
        event.target,
      );
    } else {
      const pressCandidate = inventoryRowPressCandidateRef.current;
      if (pressCandidate && pressCandidate.source === "touch") {
        inventoryRowPressCandidateRef.current = null;
      }
    }
    clearInventoryTouchFallbackClearTimer();
    inventoryPointerActiveRef.current = false;
    inventoryPointerClientYRef.current = null;
    scheduleInventoryRowProximityUpdate();
  };
  const handleInventoryTouchCancel = useCallback((): void => {
    if (
      inventoryRowPressCandidateRef.current &&
      inventoryRowPressCandidateRef.current.source === "touch"
    ) {
      inventoryRowPressCandidateRef.current = null;
    }
    scheduleInventoryTouchFallbackClear();
  }, [scheduleInventoryTouchFallbackClear]);
  const handleInventoryTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>): void => {
      handleInventoryTouchUpdate(event);
    },
    [handleInventoryTouchUpdate],
  );
  const handleInventoryItemsScroll = useCallback((): void => {
    if (!inventoryPointerActiveRef.current) {
      return;
    }
    scheduleInventoryRowProximityUpdate();
  }, [scheduleInventoryRowProximityUpdate]);
  const beginInventoryRowPressCandidate = useCallback(
    (
      source: InventoryRowPressCandidate["source"],
      pointerId: number,
      item: NethackMenuItem,
      accelerator: string,
      rowElement: HTMLDivElement | null,
      startClientX: number,
      startClientY: number,
    ): void => {
      if (!inventoryUsesFullRowAnimation) {
        return;
      }
      if (inventoryContextMenu) {
        return;
      }
      const normalizedAccelerator = String(accelerator || "").trim();
      if (
        !normalizedAccelerator ||
        !Number.isFinite(startClientX) ||
        !Number.isFinite(startClientY)
      ) {
        return;
      }
      inventoryRowPressCandidateRef.current = {
        source,
        pointerId,
        accelerator: normalizedAccelerator,
        item,
        rowElement,
        startClientX,
        startClientY,
        startedAtMs: Date.now(),
      };
    },
    [inventoryContextMenu, inventoryUsesFullRowAnimation],
  );
  const activateInventoryRowPressCandidateFromRelease = useCallback(
    (
      source: InventoryRowPressCandidate["source"],
      pointerId: number,
      releaseClientX: number,
      releaseClientY: number,
      releaseTarget: EventTarget | null,
    ): void => {
      if (!inventoryUsesFullRowAnimation) {
        inventoryRowPressCandidateRef.current = null;
        return;
      }
      const candidate = inventoryRowPressCandidateRef.current;
      if (
        !candidate ||
        candidate.source !== source ||
        candidate.pointerId !== pointerId
      ) {
        return;
      }
      inventoryRowPressCandidateRef.current = null;
      if (
        !Number.isFinite(releaseClientX) ||
        !Number.isFinite(releaseClientY)
      ) {
        return;
      }
      const elapsedMs = Date.now() - candidate.startedAtMs;
      const preferInitialSelection =
        elapsedMs <= inventoryRowPressPreferInitialMs;
      if (!preferInitialSelection) {
        // After the short tap window, fall back to normal release-target behavior.
        return;
      }

      const releaseElement =
        releaseTarget instanceof Element ? releaseTarget : null;
      const releaseRowElement = releaseElement?.closest(".nh3d-inventory-item");
      const releaseAccelerator =
        releaseRowElement instanceof HTMLElement
          ? String(releaseRowElement.dataset.nh3dAccelerator || "").trim()
          : "";
      if (releaseAccelerator && releaseAccelerator === candidate.accelerator) {
        return;
      }

      const activeAccelerator = String(
        inventoryContextMenu?.accelerator || "",
      ).trim();
      if (activeAccelerator && activeAccelerator === candidate.accelerator) {
        setInventoryContextMenu(null);
        return;
      }

      const anchorRect =
        candidate.rowElement && candidate.rowElement.isConnected
          ? candidate.rowElement.getBoundingClientRect()
          : undefined;
      openInventoryContextMenu(
        candidate.item,
        candidate.startClientX,
        candidate.startClientY,
        anchorRect,
      );
    },
    [inventoryContextMenu?.accelerator, inventoryUsesFullRowAnimation],
  );
  const handleInventoryRowActivationDismissCapture = useCallback(
    (target: EventTarget | null): void => {
      if (!inventoryUsesFullRowAnimation) {
        return;
      }
      if (!inventoryContextMenu) {
        return;
      }
      const targetElement = target instanceof Element ? target : null;
      if (!targetElement) {
        return;
      }
      const rowElement = targetElement.closest(".nh3d-inventory-item");
      if (!(rowElement instanceof HTMLElement)) {
        return;
      }
      const accelerator = rowElement.dataset.nh3dAccelerator || "";
      const normalizedAccelerator = String(accelerator).trim();
      if (!normalizedAccelerator) {
        return;
      }
      inventoryRowPressCandidateRef.current = null;
      setInventoryContextMenu(null);
    },
    [inventoryContextMenu, inventoryUsesFullRowAnimation],
  );
  const handleInventoryRowPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      handleInventoryRowActivationDismissCapture(event.target);
    },
    [handleInventoryRowActivationDismissCapture],
  );
  const handleInventoryRowTouchStartCapture = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>): void => {
      handleInventoryRowActivationDismissCapture(event.target);
    },
    [handleInventoryRowActivationDismissCapture],
  );
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
  const tilePickerEntries = useMemo<TilePickerEntry[]>(() => {
    if (!tileAtlasState.loaded || tileAtlasState.tileCount <= 0) {
      return [];
    }
    const entries: TilePickerEntry[] = [];
    for (let tileId = 0; tileId < tileAtlasState.tileCount; tileId += 1) {
      const glyphChar = representativeGlyphByTileId.get(tileId) ?? " ";
      entries.push({
        tileId,
        glyphLabel: formatTileGlyphLabel(glyphChar),
        glyphNumber: representativeGlyphNumberByTileId.get(tileId) ?? null,
      });
    }
    return entries;
  }, [
    representativeGlyphByTileId,
    representativeGlyphNumberByTileId,
    tileAtlasState.loaded,
    tileAtlasState.tileCount,
  ]);
  const tilePickerStatusText =
    !selectedTilesetEntry || !selectedTileAtlasLoadRequested
      ? t.tilePicker.noAtlasAvailable
      : tileAtlasState.failed
        ? t.tilePicker.unableToLoadAtlas
        : tileAtlasState.loaded
          ? t.tilePicker.atlasLoaded
          : t.tilePicker.loadingAtlas;
  const tilePreviewDataUrlByIdRaw = useMemo(() => {
    const previewByTileId = new Map<number, string>();
    if (
      !tileAtlasState.loaded ||
      !tileAtlasImage ||
      tileAtlasState.tileCount <= 0
    ) {
      return previewByTileId;
    }
    for (let tileId = 0; tileId < tileAtlasState.tileCount; tileId += 1) {
      const dataUrl = createIsolatedAtlasTilePreviewDataUrl(
        tileAtlasImage,
        tileId,
        tileAtlasState.tileSourceSize,
        tileAtlasState.columns,
        tileAtlasState.rows,
      );
      if (!dataUrl) {
        continue;
      }
      previewByTileId.set(tileId, dataUrl);
    }
    return previewByTileId;
  }, [
    tileAtlasImage,
    tileAtlasState.columns,
    tileAtlasState.loaded,
    tileAtlasState.rows,
    tileAtlasState.tileCount,
    tileAtlasState.tileSourceSize,
  ]);
  const tilePreviewDataUrlById = useMemo(() => {
    if (!clientOptions.uiTileBackgroundRemoval) {
      return tilePreviewDataUrlByIdRaw;
    }
    const previewByTileId = new Map<number, string>();
    if (
      !tileAtlasState.loaded ||
      !tileAtlasImage ||
      tileAtlasState.tileCount <= 0
    ) {
      return previewByTileId;
    }
    const tilePreviewBackgroundRemoval = {
      enabled: clientOptions.tilesetBackgroundRemovalMode !== "none",
      mode: clientOptions.tilesetBackgroundRemovalMode,
      solidChromaKeyColorHex: clientOptions.tilesetSolidChromaKeyColorHex,
      backgroundTilePixels:
        clientOptions.tilesetBackgroundRemovalMode === "tile"
          ? getAtlasTilePixels(
              tileAtlasImage,
              tileAtlasState.tileSourceSize,
              clientOptions.tilesetBackgroundTileId,
              tileAtlasState.columns,
              tileAtlasState.rows,
            )
          : null,
    };
    for (let tileId = 0; tileId < tileAtlasState.tileCount; tileId += 1) {
      const dataUrl = createIsolatedAtlasTilePreviewDataUrl(
        tileAtlasImage,
        tileId,
        tileAtlasState.tileSourceSize,
        tileAtlasState.columns,
        tileAtlasState.rows,
        tilePreviewBackgroundRemoval,
      );
      if (!dataUrl) {
        continue;
      }
      previewByTileId.set(tileId, dataUrl);
    }
    return previewByTileId;
  }, [
    clientOptions.tilesetBackgroundRemovalMode,
    clientOptions.tilesetBackgroundTileId,
    clientOptions.tilesetSolidChromaKeyColorHex,
    clientOptions.uiTileBackgroundRemoval,
    tileAtlasImage,
    tileAtlasState.columns,
    tileAtlasState.loaded,
    tileAtlasState.rows,
    tileAtlasState.tileCount,
    tileAtlasState.tileSourceSize,
    tilePreviewDataUrlByIdRaw,
  ]);
  const getTilePreviewDataUrlForOptions = (tileId: number): string | null => {
    if (tileAtlasState.tileCount <= 0) {
      return null;
    }
    const clampedTileId = Math.max(
      0,
      Math.min(tileAtlasState.tileCount - 1, Math.trunc(tileId)),
    );
    return tilePreviewDataUrlByIdRaw.get(clampedTileId) ?? null;
  };
  const renderTilePreviewImageForOptions = (
    tileId: number,
  ): JSX.Element | null => {
    const tilePreviewDataUrl = getTilePreviewDataUrlForOptions(tileId);
    if (!tilePreviewDataUrl) {
      return null;
    }
    return (
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={tilePreviewDataUrl}
      />
    );
  };
  const getTilePreviewDataUrl = (tileId: number): string | null => {
    if (tileAtlasState.tileCount <= 0) {
      return null;
    }
    const clampedTileId = Math.max(
      0,
      Math.min(tileAtlasState.tileCount - 1, Math.trunc(tileId)),
    );
    return tilePreviewDataUrlById.get(clampedTileId) ?? null;
  };
  const getRuntimeTilePreviewDataUrl = (tileId: number): string | null => {
    if (tileAtlasState.tileCount <= 0) {
      return null;
    }
    const remappedTileId = resolvePreviewAtlasTileIdForRuntime(
      activeRuntimeVersion,
      tileId,
      tileAtlasState.tileCount,
    );
    const clampedTileId = Math.max(
      0,
      Math.min(tileAtlasState.tileCount - 1, Math.trunc(remappedTileId)),
    );
    return tilePreviewDataUrlById.get(clampedTileId) ?? null;
  };
  const renderTilePreviewImageFromDataUrl = (
    tilePreviewDataUrl: string,
  ): JSX.Element | null => {
    if (!tilePreviewDataUrl) {
      return null;
    }
    return (
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={tilePreviewDataUrl}
      />
    );
  };
  const renderTilePreviewImage = (tileId: number): JSX.Element | null => {
    const tilePreviewDataUrl = getTilePreviewDataUrl(tileId);
    if (!tilePreviewDataUrl) {
      return null;
    }
    return renderTilePreviewImageFromDataUrl(tilePreviewDataUrl);
  };
  const renderMenuItemTilePreview = (
    item: NethackMenuItem | null | undefined,
    tileId: number | null,
  ): JSX.Element | null => {
    const dataUrl = resolveMenuItemTilePreviewDataUrl(item);
    if (dataUrl) {
      return renderTilePreviewImageFromDataUrl(dataUrl);
    }
    if (tileId === null) {
      return null;
    }
    const tilePreviewDataUrl = getRuntimeTilePreviewDataUrl(tileId);
    if (!tilePreviewDataUrl) {
      return null;
    }
    return renderTilePreviewImageFromDataUrl(tilePreviewDataUrl);
  };
  const tilesetManagerTilePickerEntries = useMemo<TilePickerEntry[]>(() => {
    if (
      !tilesetManagerAtlasState.loaded ||
      tilesetManagerAtlasState.tileCount <= 0
    ) {
      return [];
    }
    const entries: TilePickerEntry[] = [];
    for (
      let tileId = 0;
      tileId < tilesetManagerAtlasState.tileCount;
      tileId += 1
    ) {
      const glyphChar = representativeGlyphByTileId.get(tileId) ?? " ";
      entries.push({
        tileId,
        glyphLabel: formatTileGlyphLabel(glyphChar),
        glyphNumber: representativeGlyphNumberByTileId.get(tileId) ?? null,
      });
    }
    return entries;
  }, [
    representativeGlyphByTileId,
    representativeGlyphNumberByTileId,
    tilesetManagerAtlasState.loaded,
    tilesetManagerAtlasState.tileCount,
  ]);
  const tilesetManagerTilePickerStatusText = !selectedTilesetManagerEditEntry
    ? t.tilePicker.noAtlasAvailable
    : tilesetManagerAtlasState.failed
      ? t.tilePicker.unableToLoadAtlas
      : tilesetManagerAtlasState.loaded
        ? t.tilePicker.atlasLoaded
        : t.tilePicker.loadingAtlas;
  const tilesetManagerTilePreviewDataUrlById = useMemo(() => {
    const previewByTileId = new Map<number, string>();
    if (
      !tilesetManagerAtlasState.loaded ||
      !tilesetManagerAtlasImage ||
      tilesetManagerAtlasState.tileCount <= 0
    ) {
      return previewByTileId;
    }
    for (
      let tileId = 0;
      tileId < tilesetManagerAtlasState.tileCount;
      tileId += 1
    ) {
      const dataUrl = createIsolatedAtlasTilePreviewDataUrl(
        tilesetManagerAtlasImage,
        tileId,
        tilesetManagerAtlasState.tileSourceSize,
        tilesetManagerAtlasState.columns,
        tilesetManagerAtlasState.rows,
      );
      if (!dataUrl) {
        continue;
      }
      previewByTileId.set(tileId, dataUrl);
    }
    return previewByTileId;
  }, [
    tilesetManagerAtlasImage,
    tilesetManagerAtlasState.columns,
    tilesetManagerAtlasState.loaded,
    tilesetManagerAtlasState.rows,
    tilesetManagerAtlasState.tileCount,
    tilesetManagerAtlasState.tileSourceSize,
  ]);
  const getTilesetManagerTilePreviewDataUrl = (
    tileId: number,
  ): string | null => {
    if (tilesetManagerAtlasState.tileCount <= 0) {
      return null;
    }
    const clampedTileId = Math.max(
      0,
      Math.min(tilesetManagerAtlasState.tileCount - 1, Math.trunc(tileId)),
    );
    return tilesetManagerTilePreviewDataUrlById.get(clampedTileId) ?? null;
  };
  const renderTilesetManagerTilePreviewImage = (
    tileId: number,
  ): JSX.Element | null => {
    const tilePreviewDataUrl = getTilesetManagerTilePreviewDataUrl(tileId);
    if (!tilePreviewDataUrl) {
      return null;
    }
    return (
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={tilePreviewDataUrl}
      />
    );
  };

  useEffect(() => {
    if (!canvasRootRef.current || !characterCreationConfig) {
      return;
    }
    const engine = new Nethack3DEngine({
      mountElement: canvasRootRef.current,
      uiAdapter: adapter,
      characterCreationConfig,
      clientOptions,
    });
    setEngineController(engine);
    registerDebugHelpers(engine);
    return () => {
      engine.dispose();
      setEngineController(null);
    };
  }, [adapter, characterCreationConfig, setEngineController]);

  useEffect(() => {
    if (!controller) {
      return;
    }
    controller.setClientOptions(clientOptions);
  }, [controller, clientOptions]);

  useEffect(() => {
    if (!controller || !isControllerSupportPromptVisible) {
      return;
    }
    controller.setClientOptions(
      normalizeNh3dClientOptions({
        ...clientOptions,
        controllerEnabled: true,
      }),
    );
  }, [clientOptions, controller, isControllerSupportPromptVisible]);

  useEffect(() => {
    if (!hasHydratedUserTilesets) {
      return;
    }
    const currentLocale = getCurrentLocale();
    if (clientOptions.locale === currentLocale) {
      return;
    }
    setCurrentLocale(clientOptions.locale);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, [clientOptions.locale, hasHydratedUserTilesets]);

  useEffect(() => {
    if (!hasHydratedUserTilesets) {
      return;
    }
    persistNh3dClientOptionsToIndexedDb(clientOptions).catch((error) => {
      console.warn("Failed to persist client options to IndexedDB:", error);
    });
  }, [clientOptions, hasHydratedUserTilesets]);

  useEffect(() => {
    if (hasHydratedStartupCharacterPreferences) {
      return;
    }
    let disposed = false;
    loadPersistedNh3dStartupCharacterPreferences()
      .then((persistedPreferencesByRuntime) => {
        if (disposed) {
          return;
        }
        const mergedPreferencesByRuntime: StartupCharacterPreferencesByRuntime =
          {
            ...startupDefaultCharacterPreferencesByRuntime,
            ...(persistedPreferencesByRuntime ?? {}),
          };
        setStartupCharacterPreferencesByRuntime(mergedPreferencesByRuntime);
        const hydratedRuntimePreferences =
          resolveStartupCharacterPreferencesForRuntime(
            mergedPreferencesByRuntime,
            startupDefaultCharacterPreferencesByRuntime,
            runtimeVersion,
          );
        const defaultRuntimePreferences =
          startupDefaultCharacterPreferencesByRuntime[runtimeVersion] ??
          createDefaultStartupCharacterPreferences(runtimeVersion);
        setRandomCharacterName(
          hydratedRuntimePreferences.randomName ||
            defaultRuntimePreferences.randomName,
        );
        setCreateCharacterName(
          hydratedRuntimePreferences.createName ||
            defaultRuntimePreferences.createName,
        );
        const normalizedPersistedCreateSelection =
          normalizeStartupCreateCharacterSelection(
            {
              role: hydratedRuntimePreferences.createRole,
              race: hydratedRuntimePreferences.createRace,
              gender: hydratedRuntimePreferences.createGender,
              align: hydratedRuntimePreferences.createAlign,
            },
            runtimeVersion,
          );
        setCreateRole(normalizedPersistedCreateSelection.role);
        setCreateRace(normalizedPersistedCreateSelection.race);
        setCreateGender(normalizedPersistedCreateSelection.gender);
        setCreateAlign(normalizedPersistedCreateSelection.align);
        startupCharacterPreferencesStateRuntimeRef.current = runtimeVersion;
      })
      .catch((error) => {
        if (disposed) {
          return;
        }
        console.warn(
          "Failed to hydrate startup character preferences from IndexedDB:",
          error,
        );
      })
      .finally(() => {
        if (disposed) {
          return;
        }
        setHasHydratedStartupCharacterPreferences(true);
      });

    return () => {
      disposed = true;
    };
  }, [
    hasHydratedStartupCharacterPreferences,
    runtimeVersion,
    startupDefaultCharacterPreferencesByRuntime,
  ]);

  useEffect(() => {
    if (!hasHydratedStartupCharacterPreferences) {
      return;
    }
    persistNh3dStartupCharacterPreferencesToIndexedDb(
      startupCharacterPreferencesByRuntime,
    ).catch((error) => {
      console.warn(
        "Failed to persist startup character preferences to IndexedDB:",
        error,
      );
    });
  }, [
    hasHydratedStartupCharacterPreferences,
    startupCharacterPreferencesByRuntime,
  ]);

  useEffect(() => {
    let disposed = false;
    loadPersistedNh3dStartupInitOptions()
      .then((persistedValues) => {
        if (disposed || !persistedValues) {
          return;
        }
        setStartupInitOptionValues(persistedValues);
      })
      .catch((error) => {
        if (disposed) {
          return;
        }
        console.warn(
          "Failed to hydrate startup init options from IndexedDB:",
          error,
        );
      })
      .finally(() => {
        if (disposed) {
          return;
        }
        setHasHydratedStartupInitOptions(true);
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedStartupInitOptions) {
      return;
    }
    persistNh3dStartupInitOptionsToIndexedDb(startupInitOptionValues).catch(
      (error) => {
        console.warn(
          "Failed to persist startup init options to IndexedDB:",
          error,
        );
      },
    );
  }, [hasHydratedStartupInitOptions, startupInitOptionValues]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (characterCreationConfig === null || !selectedTilesetEntry) {
      setTileAtlasState(createDefaultTileAtlasState());
      setTileAtlasImage(null);
      return;
    }
    let disposed = false;
    const atlasImage = new window.Image();
    const tilesetAssetUrl =
      resolveNh3dTilesetAssetUrl(selectedTilesetEntry.path) ??
      selectedTilesetEntry.path;

    const handleLoad = (): void => {
      if (disposed) {
        return;
      }
      const naturalWidth = Math.max(0, Math.trunc(atlasImage.naturalWidth));
      const tileSourceSize = inferNh3dTilesetTileSizeFromAtlasWidthForPath(
        naturalWidth,
        selectedTilesetEntry.path,
      );
      const height = Math.max(0, Math.trunc(atlasImage.naturalHeight));
      const columns = getNh3dTilesetAtlasTileColumns(selectedTilesetEntry.path);
      const rows = Math.max(0, Math.floor(height / tileSourceSize));
      const tileCount = columns > 0 && rows > 0 ? columns * rows : 0;
      setTileAtlasState({
        tilesetPath: selectedTilesetEntry.path,
        loaded: tileCount > 0,
        failed: tileCount <= 0,
        tileSourceSize,
        columns,
        rows,
        tileCount,
      });
      setTileAtlasImage(tileCount > 0 ? atlasImage : null);
    };

    const handleError = (): void => {
      if (disposed) {
        return;
      }
      setTileAtlasState({
        ...createDefaultTileAtlasState(),
        tilesetPath: selectedTilesetEntry.path,
        failed: true,
      });
      setTileAtlasImage(null);
    };

    atlasImage.addEventListener("load", handleLoad);
    atlasImage.addEventListener("error", handleError);
    atlasImage.src = tilesetAssetUrl;

    return () => {
      disposed = true;
      atlasImage.removeEventListener("load", handleLoad);
      atlasImage.removeEventListener("error", handleError);
    };
  }, [characterCreationConfig, selectedTilesetEntry]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isTilesetManagerVisible || !selectedTilesetManagerEditEntry) {
      setTilesetManagerAtlasState(createDefaultTileAtlasState());
      setTilesetManagerAtlasImage(null);
      return;
    }
    if (
      tileAtlasState.loaded &&
      tileAtlasState.tilesetPath === selectedTilesetManagerEditEntry.path &&
      tileAtlasImage
    ) {
      setTilesetManagerAtlasState(tileAtlasState);
      setTilesetManagerAtlasImage(tileAtlasImage);
      return;
    }
    let disposed = false;
    const atlasImage = new window.Image();
    const tilesetAssetUrl =
      resolveNh3dTilesetAssetUrl(selectedTilesetManagerEditEntry.path) ??
      selectedTilesetManagerEditEntry.path;

    const handleLoad = (): void => {
      if (disposed) {
        return;
      }
      const naturalWidth = Math.max(0, Math.trunc(atlasImage.naturalWidth));
      const tileSourceSize = inferNh3dTilesetTileSizeFromAtlasWidthForPath(
        naturalWidth,
        selectedTilesetManagerEditEntry.path,
      );
      const height = Math.max(0, Math.trunc(atlasImage.naturalHeight));
      const columns = getNh3dTilesetAtlasTileColumns(
        selectedTilesetManagerEditEntry.path,
      );
      const rows = Math.max(0, Math.floor(height / tileSourceSize));
      const tileCount = columns > 0 && rows > 0 ? columns * rows : 0;
      setTilesetManagerAtlasState({
        tilesetPath: selectedTilesetManagerEditEntry.path,
        loaded: tileCount > 0,
        failed: tileCount <= 0,
        tileSourceSize,
        columns,
        rows,
        tileCount,
      });
      setTilesetManagerAtlasImage(tileCount > 0 ? atlasImage : null);
    };

    const handleError = (): void => {
      if (disposed) {
        return;
      }
      setTilesetManagerAtlasState({
        ...createDefaultTileAtlasState(),
        tilesetPath: selectedTilesetManagerEditEntry.path,
        failed: true,
      });
      setTilesetManagerAtlasImage(null);
    };

    atlasImage.addEventListener("load", handleLoad);
    atlasImage.addEventListener("error", handleError);
    atlasImage.src = tilesetAssetUrl;

    return () => {
      disposed = true;
      atlasImage.removeEventListener("load", handleLoad);
      atlasImage.removeEventListener("error", handleError);
    };
  }, [
    isTilesetManagerVisible,
    selectedTilesetManagerEditEntry,
    tileAtlasImage,
    tileAtlasState,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const handleMediaQueryChange = (): void => {
      setIsMobileViewport(mediaQuery.matches);
    };

    handleMediaQueryChange();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaQueryChange);
    } else {
      mediaQuery.addListener(handleMediaQueryChange);
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleMediaQueryChange);
      } else {
        mediaQuery.removeListener(handleMediaQueryChange);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const statsBar = document.getElementById("stats-bar");
    if (!statsBar) {
      setStatsBarHeight(0);
      return;
    }

    const updateHeight = (): void => {
      setStatsBarHeight(statsBar.getBoundingClientRect().height);
    };

    updateHeight();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(statsBar);
    }

    window.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [
    characterCreationConfig,
    connectionState,
    loadingVisible,
    isMobileViewport,
    newGamePrompt.visible,
    infoMenu,
    question,
    gameOver.tombstoneLines,
  ]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      !window.matchMedia
    ) {
      return;
    }

    const root = document.documentElement;
    if (!isMobileViewport) {
      root.classList.remove("nh3d-mobile-browser-mode");
      return;
    }

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)");
    const minimalUiQuery = window.matchMedia("(display-mode: minimal-ui)");

    const updateMobileBrowserModeClass = (): void => {
      const iOSStandalone =
        typeof (window.navigator as { standalone?: boolean }).standalone ===
          "boolean" &&
        Boolean((window.navigator as { standalone?: boolean }).standalone);
      const isStandaloneDisplayMode =
        iOSStandalone ||
        standaloneQuery.matches ||
        fullscreenQuery.matches ||
        minimalUiQuery.matches;
      root.classList.toggle(
        "nh3d-mobile-browser-mode",
        !isStandaloneDisplayMode,
      );
    };

    updateMobileBrowserModeClass();

    const queries = [standaloneQuery, fullscreenQuery, minimalUiQuery];
    const addChangeListener = (query: MediaQueryList): void => {
      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", updateMobileBrowserModeClass);
      } else {
        query.addListener(updateMobileBrowserModeClass);
      }
    };
    const removeChangeListener = (query: MediaQueryList): void => {
      if (typeof query.removeEventListener === "function") {
        query.removeEventListener("change", updateMobileBrowserModeClass);
      } else {
        query.removeListener(updateMobileBrowserModeClass);
      }
    };

    for (const query of queries) {
      addChangeListener(query);
    }

    return () => {
      for (const query of queries) {
        removeChangeListener(query);
      }
      root.classList.remove("nh3d-mobile-browser-mode");
    };
  }, [isMobileViewport]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    if (!isMobileViewport) {
      root.style.removeProperty("--nh3d-mobile-visible-height");
      root.style.removeProperty("--nh3d-mobile-visible-top-offset");
      root.style.removeProperty("--nh3d-mobile-visible-bottom-offset");
      return;
    }

    const updateMobileVisibleViewportMetrics = (): void => {
      const visualViewport = window.visualViewport;
      const layoutViewportHeight = window.innerHeight;
      const viewportOffsetTop = visualViewport ? visualViewport.offsetTop : 0;
      const viewportBottomOffset = visualViewport
        ? Math.max(
            0,
            layoutViewportHeight -
              (visualViewport.height + visualViewport.offsetTop),
          )
        : 0;

      root.style.setProperty(
        "--nh3d-mobile-visible-height",
        `${Math.max(0, Math.round(layoutViewportHeight))}px`,
      );
      root.style.setProperty(
        "--nh3d-mobile-visible-top-offset",
        `${Math.max(0, Math.round(viewportOffsetTop))}px`,
      );
      root.style.setProperty(
        "--nh3d-mobile-visible-bottom-offset",
        `${Math.max(0, Math.round(viewportBottomOffset))}px`,
      );
    };

    updateMobileVisibleViewportMetrics();
    window.addEventListener("resize", updateMobileVisibleViewportMetrics);
    const orientationRefreshTimeoutIds: number[] = [];
    const handleOrientationViewportRefresh = (): void => {
      updateMobileVisibleViewportMetrics();
      const triggerResize = () => {
        updateMobileVisibleViewportMetrics();
        window.dispatchEvent(new Event("resize"));
      };
      orientationRefreshTimeoutIds.push(window.setTimeout(triggerResize, 120));
      orientationRefreshTimeoutIds.push(window.setTimeout(triggerResize, 280));
    };
    window.addEventListener(
      "orientationchange",
      handleOrientationViewportRefresh,
    );

    const visualViewport = window.visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener(
        "resize",
        updateMobileVisibleViewportMetrics,
      );
      visualViewport.addEventListener(
        "scroll",
        updateMobileVisibleViewportMetrics,
      );
    }
    const screenOrientation = window.screen?.orientation;
    if (
      screenOrientation &&
      typeof screenOrientation.addEventListener === "function"
    ) {
      screenOrientation.addEventListener(
        "change",
        handleOrientationViewportRefresh,
      );
    }

    return () => {
      window.removeEventListener("resize", updateMobileVisibleViewportMetrics);
      window.removeEventListener(
        "orientationchange",
        handleOrientationViewportRefresh,
      );
      if (visualViewport) {
        visualViewport.removeEventListener(
          "resize",
          updateMobileVisibleViewportMetrics,
        );
        visualViewport.removeEventListener(
          "scroll",
          updateMobileVisibleViewportMetrics,
        );
      }
      if (
        screenOrientation &&
        typeof screenOrientation.removeEventListener === "function"
      ) {
        screenOrientation.removeEventListener(
          "change",
          handleOrientationViewportRefresh,
        );
      }
      for (const timeoutId of orientationRefreshTimeoutIds) {
        window.clearTimeout(timeoutId);
      }
      root.style.removeProperty("--nh3d-mobile-visible-height");
      root.style.removeProperty("--nh3d-mobile-visible-top-offset");
      root.style.removeProperty("--nh3d-mobile-visible-bottom-offset");
    };
  }, [isMobileViewport]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.style.setProperty("--nh3d-stats-bar-height", `${statsBarHeight}px`);
    return () => {
      root.style.removeProperty("--nh3d-stats-bar-height");
    };
  }, [statsBarHeight]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      !window.matchMedia
    ) {
      return;
    }

    const statsBar = document.getElementById("stats-bar");
    if (!statsBar) {
      refreshMobileStatsCoreRowScaleRef.current = null;
      return;
    }

    const mobilePortraitQuery = window.matchMedia(
      "(orientation: portrait) and (pointer: coarse)",
    );
    const maxScale = 1;
    const minScale = 8 / 13;
    const groupSelector = ".nh3d-stats-group-core";
    const rowSelector =
      ".nh3d-stats-core-row-primary, .nh3d-stats-core-row-secondary";
    const scaleCssVar = "--nh3d-mobile-stats-core-scale";
    const wrapFallbackClass = "nh3d-mobile-stats-wrap-fallback";

    const refreshScale = (): void => {
      if (!mobilePortraitQuery.matches) {
        statsBar.classList.remove(wrapFallbackClass);
        statsBar.style.setProperty(scaleCssVar, String(maxScale));
        return;
      }

      statsBar.classList.remove(wrapFallbackClass);

      const group = statsBar.querySelector<HTMLElement>(groupSelector);
      const rows = Array.from(
        statsBar.querySelectorAll<HTMLElement>(rowSelector),
      );
      if (!group || rows.length === 0) {
        statsBar.style.setProperty(scaleCssVar, String(maxScale));
        return;
      }

      for (const row of rows) {
        row.style.flexWrap = "nowrap";
      }

      let targetScale = maxScale;
      const applyScale = (): void => {
        statsBar.style.setProperty(scaleCssVar, targetScale.toFixed(4));
      };
      const measureGroupFitRatio = (): number => {
        const availableWidth = group.clientWidth;
        const requiredWidth = group.scrollWidth;
        if (availableWidth <= 0 || requiredWidth <= 0) {
          return 1;
        }
        return availableWidth / requiredWidth;
      };

      // Keep both stat rows on one line by shrinking both rows together uniformly.
      for (let pass = 0; pass < 6; pass += 1) {
        applyScale();
        const fitRatio = measureGroupFitRatio();
        if (fitRatio >= 0.999) {
          break;
        }
        const nextScale = Math.max(minScale, targetScale * fitRatio * 0.985);
        if (nextScale >= targetScale - 0.0005) {
          break;
        }
        targetScale = nextScale;
        if (targetScale <= minScale + 0.0005) {
          break;
        }
      }
      applyScale();

      const finalFitRatio = measureGroupFitRatio();
      const hitMinScale = targetScale <= minScale + 0.0005;
      if (finalFitRatio < 0.999 && hitMinScale) {
        statsBar.classList.add(wrapFallbackClass);
      }
    };

    refreshMobileStatsCoreRowScaleRef.current = refreshScale;
    refreshScale();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(refreshScale);
      const observedElements = [
        statsBar,
        statsBar.querySelector<HTMLElement>(groupSelector),
        ...Array.from(statsBar.querySelectorAll<HTMLElement>(rowSelector)),
      ].filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element.isConnected,
      );
      for (const element of observedElements) {
        resizeObserver.observe(element);
      }
    }
    let mutationObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(refreshScale);
      mutationObserver.observe(statsBar, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    const handleViewportChange = (): void => {
      refreshScale();
    };
    if (typeof mobilePortraitQuery.addEventListener === "function") {
      mobilePortraitQuery.addEventListener("change", handleViewportChange);
    } else {
      mobilePortraitQuery.addListener(handleViewportChange);
    }
    window.addEventListener("resize", handleViewportChange);

    return () => {
      refreshMobileStatsCoreRowScaleRef.current = null;
      if (typeof mobilePortraitQuery.removeEventListener === "function") {
        mobilePortraitQuery.removeEventListener("change", handleViewportChange);
      } else {
        mobilePortraitQuery.removeListener(handleViewportChange);
      }
      window.removeEventListener("resize", handleViewportChange);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      statsBar.classList.remove(wrapFallbackClass);
      statsBar.style.removeProperty(scaleCssVar);
    };
  }, [isMobileViewport, statsBarHeight]);

  const isMobileGameRunning =
    (isMobileViewport ||
      (!isMobileViewport &&
        clientOptions.desktopTouchInterfaceMode !== "off")) &&
    characterCreationConfig !== null &&
    connectionState === "running" &&
    !loadingVisible;

  const isDesktopGameRunning =
    !(isMobileViewport || clientOptions.desktopTouchInterfaceMode !== "off") &&
    characterCreationConfig !== null &&
    connectionState === "running" &&
    !loadingVisible;

  const forcedDesktopTouchInterfaceMode = !isMobileViewport
    ? clientOptions.desktopTouchInterfaceMode
    : "off";
  const isDesktopTouchInterfaceForced =
    forcedDesktopTouchInterfaceMode !== "off";

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.classList.toggle(
      "nh3d-force-touch-layout",
      isDesktopTouchInterfaceForced,
    );
    root.classList.toggle(
      "nh3d-force-touch-layout-portrait",
      forcedDesktopTouchInterfaceMode === "portrait",
    );
    root.classList.toggle(
      "nh3d-force-touch-layout-landscape",
      forcedDesktopTouchInterfaceMode === "landscape",
    );
    return () => {
      root.classList.remove(
        "nh3d-force-touch-layout",
        "nh3d-force-touch-layout-portrait",
        "nh3d-force-touch-layout-landscape",
      );
    };
  }, [forcedDesktopTouchInterfaceMode, isDesktopTouchInterfaceForced]);

  const startup = !isMobileGameRunning && !isDesktopGameRunning;
  const startupScreenReady =
    startup &&
    hasHydratedUserTilesets &&
    hasHydratedStartupCharacterPreferences &&
    hasHydratedStartupInitOptions;
  const startupUiVisible = startupScreenReady;
  const startupLoadingVisible = startup && !startupScreenReady;
  const runtimeLoadingVisible =
    loadingVisible && characterCreationConfig !== null;
  const tilesetLoadingVisible =
    (selectedTileAtlasLoadRequested &&
      Boolean(selectedTilesetEntry) &&
      !tileAtlasState.loaded &&
      !tileAtlasState.failed) ||
    (isTilesetManagerVisible &&
      Boolean(selectedTilesetManagerEditEntry) &&
      !tilesetManagerAtlasState.loaded &&
      !tilesetManagerAtlasState.failed);
  const loadingOverlayVisible =
    startupLoadingVisible || runtimeLoadingVisible || tilesetLoadingVisible;
  const loadingSubtitle = startupLoadingVisible
    ? t.update.loading.startupData
    : tilesetLoadingVisible
      ? t.update.loading.tileset
      : t.update.loading.runtime;
  const startupInitialLoadingVisible =
    !hasShownStartupMenu && loadingOverlayVisible;
  const startupMenuVisible =
    startupUiVisible &&
    characterCreationConfig === null &&
    !startupInitialLoadingVisible;
  const startupUpdateDialogOpen =
    startupMenuVisible && isStartupUpdateDialogVisible;
  const startupUpdateExpanded =
    startupUpdateDialogOpen && startupUpdateDetailsVisible;
  const startupLogoVisible =
    startupUiVisible &&
    !startupInitialLoadingVisible &&
    !runtimeLoadingVisible;
  const newGameDialogVisible = newGamePrompt.visible && !infoMenu && !question;
  const gameOverTombstoneLines = Array.isArray(gameOver.tombstoneLines)
    ? gameOver.tombstoneLines
    : [];
  const gameOverDialogShowsTombstone =
    newGameDialogVisible && gameOverTombstoneLines.length > 0;
  const asciiLogoVisible = startupLogoVisible || gameOverDialogShowsTombstone;
  const mobileTouchUiVisible =
    isMobileGameRunning && !gameOverDialogShowsTombstone;
  const farLookPositionInputActive =
    positionInputActive && positionInputOrigin !== "travel";
  const positionInputInstruction = farLookPositionInputActive
    ? clientOptions.controllerEnabled && !mobileTouchUiVisible
      ? t.dialogs.positionPrompt.controllerHint
      : mobileTouchUiVisible
        ? t.dialogs.positionPrompt.mobileHint
        : t.dialogs.positionPrompt.desktopHint
    : null;
  const positionDialogVisible =
    Boolean(positionRequest) || Boolean(positionInputInstruction);
  const hideAllUiForDeferredGameOver =
    reopenNewGamePromptOnInteraction && !newGamePrompt.visible;
  const latestGameMessage =
    gameMessages.length > 0 ? String(gameMessages[0] || "").trim() : "";
  const runtimeInitializationErrorVisible =
    startup &&
    characterCreationConfig !== null &&
    connectionState === "error" &&
    !loadingOverlayVisible;
  const runtimeInitializationErrorMessage = runtimeInitializationErrorVisible
    ? latestGameMessage ||
      statusText.trim() ||
      t.update.runtimeStoppedBeforeStartup
    : "";
  const startupSelectedRuntimeVersionLabel =
    startupMenuVisible && startupFlowStep !== "variant"
      ? resolveRuntimeVersionDisplayLabel(runtimeVersion)
      : null;
  useEffect(() => {
    if (startupMenuVisible) {
      return;
    }
    setStartupBuildLabelClickCount(0);
    setStartupBuildLabelToastVisible(false);
    if (startupBuildLabelToastTimerRef.current !== null) {
      window.clearTimeout(startupBuildLabelToastTimerRef.current);
      startupBuildLabelToastTimerRef.current = null;
    }
  }, [startupMenuVisible]);
  const startupVariantDialogVisible =
    startupMenuVisible &&
    startupFlowStep === "variant" &&
    !startupUpdateDialogOpen;
  const startupChooseDialogVisible =
    startupMenuVisible &&
    startupFlowStep === "choose" &&
    !startupUpdateDialogOpen;
  const startupResumeDialogVisible =
    startupMenuVisible && startupFlowStep === "resume";
  const startupRandomDialogVisible =
    startupMenuVisible && startupFlowStep === "random";
  const startupCreateDialogVisible =
    startupMenuVisible && startupFlowStep === "create";
  const startupPendingUpdateCount = startupUpdateCheck?.newerTags.length ?? 0;
  const startupPendingUpdateTags = startupUpdateCheck?.newerTags ?? [];
  const startupCurrentVersionLabel = `v${
    startupUpdateCheck?.currentVersion ?? nh3dAppVersion
  }`;
  const startupLatestVersionLabel =
    startupUpdateCheck?.latestVersion ??
    startupUpdateCheck?.latestTagName ??
    commonStrings.none;

  useEffect(() => {
    if (!hasShownStartupMenu && startupMenuVisible) {
      setHasShownStartupMenu(true);
    }
  }, [hasShownStartupMenu, startupMenuVisible]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.classList.toggle(
      "nh3d-game-over-tombstone-active",
      gameOverDialogShowsTombstone,
    );
    return () => {
      root.classList.remove("nh3d-game-over-tombstone-active");
    };
  }, [gameOverDialogShowsTombstone]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.classList.toggle(
      "nh3d-hide-runtime-ui-deferred-game-over",
      hideAllUiForDeferredGameOver,
    );
    return () => {
      root.classList.remove("nh3d-hide-runtime-ui-deferred-game-over");
    };
  }, [hideAllUiForDeferredGameOver]);

  useLayoutEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.getElementById("root");
    if (!root) {
      return;
    }

    if (loadingOverlayVisible) {
      root.setAttribute("inert", "");
      root.setAttribute("aria-hidden", "true");
    } else {
      root.removeAttribute("inert");
      root.removeAttribute("aria-hidden");
    }

    return () => {
      root.removeAttribute("inert");
      root.removeAttribute("aria-hidden");
    };
  }, [loadingOverlayVisible]);

  useLayoutEffect(() => {
    useGameStore.getState().setUiBlockingVisible(loadingOverlayVisible);
    return () => {
      useGameStore.getState().setUiBlockingVisible(false);
    };
  }, [loadingOverlayVisible]);

  useEffect(() => {
    if (!startupUiVisible || startupRenderSignalSentRef.current) {
      return;
    }
    const bridgeWindow = window as Nh3dWindowBridges;
    const signalAppRendered = bridgeWindow.nh3dElectron?.signalAppRendered;
    if (typeof signalAppRendered !== "function") {
      startupRenderSignalSentRef.current = true;
      return;
    }
    startupRenderSignalSentRef.current = true;
    signalAppRendered();
  }, [startupUiVisible]);

  useEffect(() => {
    if (!startupUiVisible || startupUpdateCheckStartedRef.current) {
      return;
    }
    startupUpdateCheckStartedRef.current = true;
    if (!clientOptions.showVersionNotificationsOnLaunch) {
      return;
    }
    let canceled = false;
    (async () => {
      try {
        const result = await checkForNh3dGitHubVersionUpdates();
        if (canceled) {
          return;
        }
        if (result.error) {
          console.warn("Failed to check GitHub releases:", result.error);
          return;
        }
        setStartupUpdateCheck(result);
        if (result.hasUpdate) {
          setStartupUpdateDetailsVisible(false);
          setIsStartupUpdateDialogVisible(true);
        }
      } catch (error) {
        if (canceled) {
          return;
        }
        const errorMessage =
          error instanceof Error
            ? error.message
            : t.update.unexpectedCheckFailure;
        console.warn("Failed to check GitHub releases:", errorMessage);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [clientOptions.showVersionNotificationsOnLaunch, startupUiVisible]);

  const closeStartupUpdateDialog = useCallback((): void => {
    setStartupUpdateDetailsVisible(false);
    setIsStartupUpdateDialogVisible(false);
  }, []);

  const toggleStartupUpdateDetails = useCallback((): void => {
    setStartupUpdateDetailsVisible((previous) => !previous);
  }, []);

  const openGitHubReleases = useCallback((): void => {
    const targetUrl =
      startupUpdateCheck?.releasesPageUrl ??
      optionsUpdateCheckResult?.releasesPageUrl ??
      getNh3dGitHubReleasesPageUrl();
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }, [optionsUpdateCheckResult?.releasesPageUrl, startupUpdateCheck?.releasesPageUrl]);

  const checkForUpdatesFromOptions = useCallback(async (): Promise<void> => {
    if (optionsUpdateCheckBusy) {
      return;
    }
    setOptionsUpdateCheckBusy(true);
    setOptionsUpdateCheckStatus(t.update.checkingForUpdates);

    try {
      const result = await checkForNh3dGitHubVersionUpdates();
      setOptionsUpdateCheckResult(result);
      if (result.error) {
        setOptionsUpdateCheckStatus(t.update.updateCheckFailed(result.error));
        return;
      }

      setStartupUpdateCheck(result);
      if (!result.hasUpdate) {
        setOptionsUpdateCheckStatus(t.update.latestAlreadyInstalledOptions);
        if (startupMenuVisible) {
          setStartupUpdateDetailsVisible(false);
          setIsStartupUpdateDialogVisible(false);
        }
        return;
      }

      setOptionsUpdateCheckStatus(
        result.newerTags.length === 1
          ? t.update.oneUpdateAvailable
          : t.update.manyUpdatesAvailable(result.newerTags.length),
      );
      if (startupMenuVisible) {
        setStartupUpdateDetailsVisible(false);
        setIsStartupUpdateDialogVisible(true);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t.update.unexpectedCheckFailure;
      setOptionsUpdateCheckStatus(t.update.updateCheckFailed(errorMessage));
    } finally {
      setOptionsUpdateCheckBusy(false);
    }
  }, [optionsUpdateCheckBusy, startupMenuVisible]);

  useEffect(() => {
    if (!characterSheetInterceptionArmed) {
      characterSheetAwaitingInfoRef.current = false;
      return;
    }
    if (!infoMenu) {
      if (!characterSheetAwaitingInfoRef.current) {
        setCharacterSheetInterceptionArmed(false);
      }
      return;
    }
    characterSheetAwaitingInfoRef.current = false;
    if (!characterSheet) {
      setCharacterSheetInterceptionArmed(false);
    }
  }, [infoMenu, characterSheet, characterSheetInterceptionArmed]);

  useLayoutEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (!asciiLogoVisible) {
      root.style.removeProperty("--nh3d-startup-logo-bottom");
      return;
    }

    const measureLogoBottom = (): void => {
      const logos = Array.from(
        document.querySelectorAll<HTMLElement>(".nethack-ascii-logo"),
      );
      if (logos.length === 0) {
        root.style.removeProperty("--nh3d-startup-logo-bottom");
        return;
      }
      const maxBottom = logos.reduce((max, logo) => {
        const rect = logo.getBoundingClientRect();
        return Math.max(max, rect.bottom);
      }, 0);
      if (!Number.isFinite(maxBottom) || maxBottom <= 0) {
        root.style.removeProperty("--nh3d-startup-logo-bottom");
        return;
      }
      root.style.setProperty(
        "--nh3d-startup-logo-bottom",
        `${Math.ceil(maxBottom)}px`,
      );
    };

    measureLogoBottom();
    const rafId = window.requestAnimationFrame(measureLogoBottom);
    window.addEventListener("resize", measureLogoBottom);
    window.addEventListener("orientationchange", measureLogoBottom);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(measureLogoBottom);
      const logos = document.querySelectorAll<HTMLElement>(
        ".nethack-ascii-logo",
      );
      logos.forEach((logo) => resizeObserver?.observe(logo));
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measureLogoBottom);
      window.removeEventListener("orientationchange", measureLogoBottom);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      root.style.removeProperty("--nh3d-startup-logo-bottom");
    };
  }, [asciiLogoVisible]);

  const hasGameplayOverlayOpen =
    Boolean(question) ||
    Boolean(directionQuestion) ||
    Boolean(infoMenu) ||
    inventory.visible ||
    Boolean(textInputRequest) ||
    Boolean(positionRequest) ||
    Boolean(inventoryContextMenu) ||
    Boolean(inventoryDropCountDialog) ||
    Boolean(fpsCrosshairContext) ||
    isWizardCommandsVisible ||
    isControllerActionWheelVisible ||
    isControllerSupportPromptVisible ||
    newGamePrompt.visible;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!hasHydratedUserTilesets || hasAskedControllerSupportThisSession) {
      return;
    }

    const handleControllerDetection = (): void => {
      if (
        !hasHydratedUserTilesets ||
        hasAskedControllerSupportThisSession ||
        isControllerSupportPromptVisible
      ) {
        return;
      }
      if (getConnectedGamepadsForCapture().length <= 0) {
        return;
      }
      setIsControllerSupportPromptVisible(true);
    };

    handleControllerDetection();
    const pollId = window.setInterval(handleControllerDetection, 1200);
    window.addEventListener("gamepadconnected", handleControllerDetection);

    return () => {
      window.clearInterval(pollId);
      window.removeEventListener("gamepadconnected", handleControllerDetection);
    };
  }, [
    hasAskedControllerSupportThisSession,
    hasHydratedUserTilesets,
    isControllerSupportPromptVisible,
  ]);

  useEffect(() => {
    if (!isMobileGameRunning) {
      setIsMobileActionSheetVisible(false);
      setMobileActionSheetMode("quick");
      setIsMobileLogVisible(false);
    }
  }, [isMobileGameRunning]);

  useEffect(() => {
    if (!gameOverDialogShowsTombstone) {
      return;
    }
    setIsMobileActionSheetVisible(false);
    setMobileActionSheetMode("quick");
    setIsMobileLogVisible(false);
    setIsWizardCommandsVisible(false);
  }, [gameOverDialogShowsTombstone]);

  useEffect(() => {
    if (!hideAllUiForDeferredGameOver) {
      return;
    }
    setIsPauseMenuVisible(false);
    setIsExitConfirmationVisible(false);
    setIsClientOptionsVisible(false);
    setIsControllerRemapVisible(false);
    setControllerRemapListening(null);
    setIsControllerSupportPromptVisible(false);
    setIsControllerActionWheelVisible(false);
    setControllerActionWheelMode("quick");
    setControllerActionWheelChosenIndex(0);
    setIsMobileActionSheetVisible(false);
    setMobileActionSheetMode("quick");
    setIsMobileLogVisible(false);
    setIsWizardCommandsVisible(false);
    setInventoryContextMenu(null);
    setInventoryDropTypeMenuPosition(null);
    setInventoryDropCountDialog(null);
    setTileContextMenuPosition(null);
    setPositionRequest(null);
    setCharacterSheetInterceptionArmed(false);
    characterSheetAwaitingInfoRef.current = false;
    controller?.dismissFpsCrosshairContextMenu();
    controller?.closeInfoMenuDialog();
    controller?.closeInventoryDialog();
  }, [controller, hideAllUiForDeferredGameOver, setPositionRequest]);

  useEffect(() => {
    if (isMobileGameRunning || isDesktopGameRunning) {
      return;
    }
    setIsControllerActionWheelVisible(false);
    setControllerActionWheelMode("quick");
    setControllerActionWheelChosenIndex(0);
  }, [isDesktopGameRunning, isMobileGameRunning]);

  useEffect(() => {
    setFloatingMessageTiming(
      clientOptions.liveMessageDisplayTimeMs,
      clientOptions.liveMessageFadeOutTimeMs,
    );
  }, [
    clientOptions.liveMessageDisplayTimeMs,
    clientOptions.liveMessageFadeOutTimeMs,
    setFloatingMessageTiming,
  ]);

  useEffect(() => {
    if (!clientOptions.liveMessageLog) {
      setIsMobileLogVisible(false);
    }
  }, [clientOptions.liveMessageLog]);

  useEffect(() => {
    if (!textInputRequest) {
      return;
    }
    setTextInputValue("");
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        textInputRef.current?.focus();
      }, 0);
    }
  }, [textInputRequest]);

  useEffect(() => {
    const clearCoreStatHighlights = (): void => {
      setCoreStatBoldUntilTurn((current) =>
        Object.keys(current).length > 0 ? {} : current,
      );
    };
    if (!isMobileGameRunning && !isDesktopGameRunning) {
      previousCoreStatSnapshotRef.current = null;
      clearCoreStatHighlights();
      return;
    }

    const currentTurn = Number.isFinite(playerStats.time)
      ? Math.trunc(playerStats.time)
      : 0;
    const nextSnapshot: CoreStatSnapshot = {
      turn: currentTurn,
      playerName: String(playerStats.name || ""),
      values: getCoreStatValuesFromSnapshot(playerStats),
    };
    if (isBootstrapCoreStatSnapshot(nextSnapshot)) {
      previousCoreStatSnapshotRef.current = null;
      clearCoreStatHighlights();
      return;
    }

    const previousSnapshot = previousCoreStatSnapshotRef.current;
    if (
      !previousSnapshot ||
      nextSnapshot.turn < previousSnapshot.turn ||
      nextSnapshot.playerName !== previousSnapshot.playerName
    ) {
      previousCoreStatSnapshotRef.current = nextSnapshot;
      clearCoreStatHighlights();
      return;
    }

    const changedKeys = trackedCoreStatKeys.filter(
      (key) => nextSnapshot.values[key] !== previousSnapshot.values[key],
    );
    if (changedKeys.length > 0) {
      const highlightUntilTurn = nextSnapshot.turn + 20;
      setCoreStatBoldUntilTurn((current) => {
        const next = { ...current };
        for (const key of changedKeys) {
          next[key] = highlightUntilTurn;
        }
        return next;
      });
    }

    previousCoreStatSnapshotRef.current = nextSnapshot;
  }, [isDesktopGameRunning, isMobileGameRunning, playerStats]);

  useEffect(() => {
    const currentTurn = Number.isFinite(playerStats.time)
      ? Math.trunc(playerStats.time)
      : 0;
    setCoreStatBoldUntilTurn((current) => {
      let changed = false;
      const next: Partial<Record<CoreStatKey, number>> = {};
      for (const key of trackedCoreStatKeys) {
        const untilTurn = current[key];
        if (typeof untilTurn !== "number") {
          continue;
        }
        if (currentTurn < untilTurn) {
          next[key] = untilTurn;
          continue;
        }
        changed = true;
      }
      return changed ? next : current;
    });
  }, [playerStats.time]);

  const hpPercentage =
    playerStats.maxHp > 0
      ? Math.max(0, Math.min(100, (playerStats.hp / playerStats.maxHp) * 100))
      : 0;
  const hpColor =
    hpPercentage > 60 ? "#00ff00" : hpPercentage > 30 ? "#ffaa00" : "#ff0000";
  const powerPercentage =
    playerStats.maxPower > 0
      ? Math.max(
          0,
          Math.min(100, (playerStats.power / playerStats.maxPower) * 100),
        )
      : 0;
  const highlightedCoreStatStyle = useMemo<CSSProperties>(
    () => ({
      fontWeight: 700,
    }),
    [],
  );
  const currentStatsTurn = Number.isFinite(playerStats.time)
    ? Math.trunc(playerStats.time)
    : 0;
  const resolveCoreStatStyle = useCallback(
    (key: CoreStatKey): CSSProperties | undefined => {
      const untilTurn = coreStatBoldUntilTurn[key];
      if (typeof untilTurn !== "number" || currentStatsTurn >= untilTurn) {
        return undefined;
      }
      return highlightedCoreStatStyle;
    },
    [coreStatBoldUntilTurn, currentStatsTurn, highlightedCoreStatStyle],
  );
  const playerStatusBadges = useMemo(
    () => buildPlayerStatusBadges(playerStats, activeRuntimeVersion),
    [activeRuntimeVersion, playerStats],
  );
  const locationLabel = String(playerStats.locationLabel || "").trim();
  const fallbackLocationLabel = Number.isFinite(playerStats.dlevel)
    ? `${playerStats.dungeon} ${Math.trunc(playerStats.dlevel)}`.trim()
    : String(playerStats.dungeon || "").trim();
  const visibleLocationLabel = locationLabel || fallbackLocationLabel;
  const renderCharacterCurrentStatusPanel = (
    statusLines: readonly string[],
    fallbackBadges: readonly PlayerStatusBadge[] = [],
  ): JSX.Element => {
    const normalizedStatusLines = Array.isArray(statusLines) ? statusLines : [];
    const normalizedFallbackBadges = Array.isArray(fallbackBadges)
      ? fallbackBadges
      : [];
    return (
      <section className="nh3d-character-panel">
        <div className="nh3d-character-panel-title">
          {t.dialogs.info.currentStatus}
        </div>
        {normalizedStatusLines.length > 0 ? (
          <div className="nh3d-character-chip-list">
            {normalizedStatusLines.map((line, index) => {
              const severity = resolveCharacterStatusLineSeverity(
                line,
                playerStats,
                activeRuntimeVersion,
              );
              return (
                <div
                  className={`nh3d-character-chip${
                    severity ? ` is-${severity}` : ""
                  }`}
                  key={`character-status-${index}`}
                >
                  {line}
                </div>
              );
            })}
          </div>
        ) : normalizedFallbackBadges.length > 0 ? (
          <div className="nh3d-character-chip-list">
            {normalizedFallbackBadges.map((status) => (
              <div
                className={`nh3d-character-chip is-${status.severity}`}
                key={`character-status-badge-${status.label}`}
              >
                {status.label}
              </div>
            ))}
          </div>
        ) : (
          <div className="nh3d-character-line">
            {t.dialogs.info.noActiveStatus}
          </div>
        )}
      </section>
    );
  };
  const renderCharacterCurrentAttributesPanel = (
    attributeLines: readonly string[],
  ): JSX.Element => {
    const normalizedAttributeLines = Array.isArray(attributeLines)
      ? attributeLines
      : [];
    return (
      <section className="nh3d-character-panel">
        <div className="nh3d-character-panel-title">
          {t.dialogs.info.currentAttributes}
        </div>
        <div className="nh3d-character-chip-list">
          {normalizedAttributeLines.length > 0 ? (
            normalizedAttributeLines.map((line, index) => (
              <div
                className="nh3d-character-chip"
                key={`character-attributes-${index}`}
              >
                {line}
              </div>
            ))
          ) : (
            <div className="nh3d-character-line">
              {t.dialogs.info.noTemporaryAttributes}
            </div>
          )}
        </div>
      </section>
    );
  };

  useLayoutEffect(() => {
    refreshMobileStatsCoreRowScaleRef.current?.();
  }, [
    isMobileViewport,
    startup,
    playerStats.strength,
    playerStats.dexterity,
    playerStats.constitution,
    playerStats.intelligence,
    playerStats.wisdom,
    playerStats.charisma,
    playerStats.armor,
    playerStats.experience,
    playerStats.time,
    playerStats.gold,
    playerStatusBadges,
  ]);

  const parsedQuestionChoices = question
    ? parseQuestionChoices(question.text, question.choices)
    : [];
  const hideLegacySlashEmInventoryShortcuts =
    activeRuntimeVersion === "slashem" &&
    parsedQuestionChoices.some((choice) => choice.trim() === "*");
  const visibleQuestionChoices = hideLegacySlashEmInventoryShortcuts
    ? parsedQuestionChoices.filter((choice) => {
        const normalizedChoice = choice.trim();
        return normalizedChoice !== "*" && normalizedChoice !== "?";
      })
    : parsedQuestionChoices;
  const orderedQuestionChoices = orderQuestionChoicesForDisplay(
    visibleQuestionChoices,
    activeRuntimeVersion,
  );
  const shouldRenderQuestionTextInput =
    Boolean(question) &&
    (question?.menuItems.length ?? 0) === 0 &&
    orderedQuestionChoices.length === 0 &&
    isSymbolLookupTextQuestion(question?.text ?? "", question?.choices ?? "");
  const isYesNoQuestionChoices = isYesNoChoicePrompt(visibleQuestionChoices);
  const isAdjustLetterQuestion = isAdjustLetterQuestionPrompt(
    question?.text ?? "",
  );
  const useInventoryChoiceLabels =
    !isYesNoQuestionChoices && !isAdjustLetterQuestion;
  const normalizedVisibleQuestionChoiceSignature = visibleQuestionChoices
    .map((choice) =>
      String(choice || "")
        .trim()
        .toLowerCase(),
    )
    .filter((choice) => choice.length > 0)
    .join("");
  const suppressQuestionCancelButton =
    normalizedVisibleQuestionChoiceSignature === "yn" ||
    normalizedVisibleQuestionChoiceSignature === "ynq" ||
    normalizedVisibleQuestionChoiceSignature === "ynaq";
  const showLegacyInventoryQuestionCancelButton =
    isLegacyInventoryQuestionChoicePrompt(
      question?.text ?? "",
      visibleQuestionChoices,
      activeRuntimeVersion,
      isYesNoQuestionChoices,
    );
  const useCompactQuestionChoiceLayout = shouldUseCompactQuestionChoiceLayout(
    question?.text ?? "",
    orderedQuestionChoices,
    activeRuntimeVersion,
    isYesNoQuestionChoices,
  );
  const showQuestionCancelButton =
    Boolean(question) &&
    !suppressQuestionCancelButton &&
    ((question?.menuItems.length ?? 0) === 0 ||
      showLegacyInventoryQuestionCancelButton);
  const displayedQuestionText = capitalizeFirstLetter(question?.text ?? "");
  const displayedQuestionPendingCount =
    typeof question?.pendingSelectionCount === "number" &&
    Number.isFinite(question.pendingSelectionCount) &&
    question.pendingSelectionCount > 0
      ? Math.trunc(question.pendingSelectionCount)
      : null;
  const showQuestionAmountControls = Boolean(
    question?.supportsSelectionCount,
  );
  const questionMenuPageIndex = question?.menuPageIndex ?? 0;
  const questionMenuPageCount = Math.max(1, question?.menuPageCount ?? 1);
  const enhanceMenuData = useMemo(
    () =>
      question ? parseEnhanceMenu(question.text, question.menuItems) : null,
    [question],
  );
  const infoEnhanceMenuData = useMemo(
    () =>
      displayedInfoMenu
        ? parseEnhanceMenu(displayedInfoMenu.title, displayedInfoMenu.lines)
        : null,
    [displayedInfoMenu],
  );
  const castMenuData = useMemo(
    () =>
      question ? parseCastSpellMenu(question.text, question.menuItems) : null,
    [question],
  );
  const techniqueMenuData = useMemo(
    () =>
      question ? parseTechniqueMenu(question.text, question.menuItems) : null,
    [question],
  );
  const legacyInventoryQuestionMenuItems = useMemo(
    () =>
      question && question.menuItems.length === 0
        ? buildLegacyInventoryQuestionMenuItems(
            question.text,
            orderedQuestionChoices,
            inventory.items,
            activeRuntimeVersion,
            isYesNoQuestionChoices,
          )
        : [],
    [
      activeRuntimeVersion,
      inventory.items,
      isYesNoQuestionChoices,
      orderedQuestionChoices,
      question,
    ],
  );
  const displayedQuestionMenuItems =
    question && question.menuItems.length > 0
      ? question.menuItems
      : legacyInventoryQuestionMenuItems;
  const useSlashEmLegacyShortcutChoiceDialog =
    activeRuntimeVersion === "slashem" &&
    Boolean(question) &&
    showLegacyInventoryQuestionCancelButton &&
    !question?.isPickupDialog;
  const questionChoiceSourceItems =
    displayedQuestionMenuItems.length > 0
      ? displayedQuestionMenuItems
      : inventory.items;
  const shouldRenderQuestionMenuItems =
    displayedQuestionMenuItems.length > 0 &&
    !useSlashEmLegacyShortcutChoiceDialog;
  const questionSelectableMenuItemCount = displayedQuestionMenuItems.filter(
    (item) => isSelectableQuestionMenuItem(item),
  ).length;
  const showPickupActionButtons =
    Boolean(question?.isPickupDialog) &&
    (questionSelectableMenuItemCount > 0 || isMobileViewport);
  const showPickupToggleAllButton =
    Boolean(question?.isPickupDialog) && questionSelectableMenuItemCount > 1;
  const inventoryContextActionsEnabled =
    inventory.contextActionsEnabled !== false;
  const inventoryContextMenuOpen =
    inventoryContextMenu !== null && inventoryContextActionsEnabled;
  const inventoryCloseInstructionText = inventoryContextActionsEnabled
    ? t.dialogs.inventory.closeHintWithContext
    : t.dialogs.inventory.closeHint;
  const submitQuestionTextInput = useCallback((): void => {
    const answer = questionTextInputValue.charAt(0);
    if (!answer) {
      controller?.cancelActivePrompt();
      return;
    }
    controller?.chooseQuestionChoice(answer);
    setQuestionTextInputValue("");
  }, [controller, questionTextInputValue]);

  useEffect(() => {
    if (!shouldRenderQuestionTextInput) {
      setQuestionTextInputValue("");
      return;
    }
    setQuestionTextInputValue("");
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        questionTextInputRef.current?.focus();
      }, 0);
    }
  }, [question?.text, shouldRenderQuestionTextInput]);

  useLayoutEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const visibleOverlays = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".nh3d-context-menu.is-visible, .nh3d-dialog.is-visible, #position-dialog.is-visible, .nh3d-wizard-commands-sheet.is-visible, #loading:not(.is-hidden)",
      ),
    ).filter((element) => {
      if (!element.isConnected) {
        return false;
      }
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      return element.getClientRects().length > 0;
    });
    if (visibleOverlays.length === 0) {
      return;
    }

    let topOverlay = visibleOverlays[0];
    let topOverlayZIndex =
      Number.parseInt(window.getComputedStyle(topOverlay).zIndex, 10) || 0;
    for (let index = 1; index < visibleOverlays.length; index += 1) {
      const candidate = visibleOverlays[index];
      const zIndex =
        Number.parseInt(window.getComputedStyle(candidate).zIndex, 10) || 0;
      if (
        zIndex > topOverlayZIndex ||
        (zIndex === topOverlayZIndex && index > 0)
      ) {
        topOverlay = candidate;
        topOverlayZIndex = zIndex;
      }
    }

    if (topOverlay.id === "text-input-dialog") {
      return;
    }

    if (topOverlay.id === "loading") {
      topOverlay.focus({ preventScroll: true });
      return;
    }

    const focusableSelector = [
      ".nh3d-context-menu-button:not(:disabled)",
      "button:not(:disabled):not(.nh3d-mobile-dialog-close)",
      "summary",
      "a[href]",
      "input:not(:disabled):not([tabindex='-1'])",
      "select:not(:disabled)",
      "textarea:not(:disabled)",
      '[role="button"][tabindex="0"]',
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    const explicitActiveTarget = topOverlay.querySelector<HTMLElement>(
      ".nh3d-menu-button.nh3d-menu-button-active, button.nh3d-enhance-skill-card.nh3d-menu-button-active, button.nh3d-cast-row.nh3d-menu-button-active, button.nh3d-technique-row.nh3d-menu-button-active, .nh3d-pickup-item.nh3d-pickup-item-active, .nh3d-menu-action-button.nh3d-action-button-active, .nh3d-pickup-action-button.nh3d-action-button-active",
    );
    const firstContextActionButton = topOverlay.classList.contains(
      "nh3d-context-menu",
    )
      ? topOverlay.querySelector<HTMLElement>(
          ".nh3d-context-menu-button:not(:disabled)",
        )
      : null;
    const firstActionWheelButton = topOverlay.classList.contains(
      "nh3d-controller-action-wheel-dialog",
    )
      ? topOverlay.querySelector<HTMLElement>(
          "[data-nh3d-wheel-angle]:not(:disabled), .nh3d-controller-action-wheel-extended .nh3d-mobile-actions-button:not(:disabled)",
        )
      : null;
    const firstSelectableButton =
      topOverlay.querySelector<HTMLElement>(focusableSelector);
    const activeElement =
      typeof document.activeElement === "object" &&
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const activeElementInDialog =
      activeElement &&
      topOverlay.contains(activeElement) &&
      activeElement.matches(focusableSelector)
        ? activeElement
        : null;
    const shouldTrackExplicitActiveTarget =
      topOverlay.id === "question-dialog" ||
      topOverlay.classList.contains("nh3d-dialog-question");
    if (shouldTrackExplicitActiveTarget && explicitActiveTarget) {
      if (activeElementInDialog !== explicitActiveTarget) {
        explicitActiveTarget.focus({ preventScroll: true });
        explicitActiveTarget.scrollIntoView({
          block: "nearest",
          inline: "nearest",
        });
      }
      return;
    }
    const targetButton =
      activeElementInDialog ??
      firstActionWheelButton ??
      firstContextActionButton ??
      explicitActiveTarget ??
      firstSelectableButton;
    if (!targetButton) {
      return;
    }
    if (activeElementInDialog) {
      return;
    }
    targetButton.focus({ preventScroll: true });
  }, [
    characterCreationConfig,
    directionQuestion,
    infoMenu,
    inventory.visible,
    inventory.items,
    inventory.contextActionsEnabled,
    isClientOptionsVisible,
    isControllerRemapVisible,
    isDarkWallTilePickerVisible,
    isTilesetBackgroundTilePickerVisible,
    isTilesetManagerVisible,
    isTilesetSolidColorPickerVisible,
    newGamePrompt.visible,
    question,
    textInputRequest,
    inventoryContextMenu,
    inventoryContextMenuActions.length,
    fpsCrosshairContext,
    fpsCrosshairContext?.actions.length,
    tileContextMenuPosition,
    isWizardCommandsVisible,
    isControllerActionWheelVisible,
    controllerActionWheelMode,
    globalConfirmationDialog,
    loadingOverlayVisible,
  ]);

  const mobileExtendedCommandNames = useMemo(() => {
    const rawCommands =
      Array.isArray(extendedCommands) && extendedCommands.length > 0
        ? extendedCommands
        : fallbackExtendedCommandNames;
    const uniqueCommands: string[] = [];
    const seen = new Set<string>();
    for (const rawCommand of rawCommands) {
      const normalized = String(rawCommand || "")
        .trim()
        .toLowerCase();
      if (!normalized || normalized === "#" || normalized === "?") {
        continue;
      }
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      uniqueCommands.push(normalized);
    }
    return uniqueCommands;
  }, [extendedCommands]);
  const mobileCommonExtendedCommandNames = useMemo(() => {
    const available = new Set(mobileExtendedCommandNames);
    return commonExtendedCommandWhitelist.filter((command) =>
      available.has(command),
    );
  }, [mobileExtendedCommandNames]);
  const isWizardModeSession = useMemo(() => {
    if (!characterCreationConfig) {
      return false;
    }
    const initOptionTokens = sanitizeStartupInitOptionTokens(
      characterCreationConfig.initOptions,
      characterCreationConfig.runtimeVersion ?? runtimeVersion,
    );
    for (const token of initOptionTokens) {
      const normalizedToken = String(token || "")
        .trim()
        .toLowerCase();
      if (!normalizedToken.startsWith("playmode:")) {
        continue;
      }
      const playmodeValue = normalizedToken.slice("playmode:".length).trim();
      return playmodeValue === "debug";
    }
    return false;
  }, [characterCreationConfig, runtimeVersion]);
  const wizardExtendedCommandNames = useMemo(() => {
    const availableWizardCommands = mobileExtendedCommandNames.filter(
      isWizardExtendedCommandName,
    );
    return availableWizardCommands.length > 0
      ? availableWizardCommands
      : fallbackWizardExtendedCommandNames;
  }, [mobileExtendedCommandNames]);
  const wizardCommandsSupported =
    (isMobileGameRunning || isDesktopGameRunning) &&
    isWizardModeSession &&
    wizardExtendedCommandNames.length > 0;
  const controllerActionWheelEntries = useMemo(
    () => createControllerActionWheelEntries(mobileActions),
    [],
  );
  const characterCommandActions = useMemo(
    () =>
      resolveCharacterCommandActions(
        mobileExtendedCommandNames,
        activeRuntimeVersion,
      ),
    [activeRuntimeVersion, mobileExtendedCommandNames],
  );
  const closeControllerActionWheel = useCallback((): void => {
    setIsControllerActionWheelVisible(false);
    setControllerActionWheelMode("quick");
    setControllerActionWheelChosenIndex(0);
  }, []);
  const closeWizardCommands = useCallback((): void => {
    setIsWizardCommandsVisible(false);
  }, []);
  const openPauseMenu = useCallback((): void => {
    if (!isMobileGameRunning && !isDesktopGameRunning) {
      return;
    }
    controller?.dismissFpsCrosshairContextMenu();
    closeControllerActionWheel();
    closeWizardCommands();
    setIsMobileActionSheetVisible(false);
    setMobileActionSheetMode("quick");
    setIsMobileLogVisible(false);
    setIsExitConfirmationVisible(false);
    setIsPauseMenuVisible(true);
  }, [
    closeControllerActionWheel,
    closeWizardCommands,
    controller,
    isDesktopGameRunning,
    isMobileGameRunning,
  ]);
  const toggleWizardCommands = useCallback((): void => {
    if (!wizardCommandsSupported) {
      return;
    }
    controller?.dismissFpsCrosshairContextMenu();
    setIsWizardCommandsVisible((visible) => {
      const nextVisible = !visible;
      if (nextVisible) {
        closeControllerActionWheel();
        setIsMobileActionSheetVisible(false);
        setMobileActionSheetMode("quick");
        setIsMobileLogVisible(false);
      }
      return nextVisible;
    });
  }, [closeControllerActionWheel, controller, wizardCommandsSupported]);
  const runWizardExtendedCommand = useCallback(
    (command: string): void => {
      controller?.dismissFpsCrosshairContextMenu();
      controller?.runExtendedCommand(command);
      closeWizardCommands();
    },
    [closeWizardCommands, controller],
  );
  const runControllerWheelEntry = useCallback(
    (action: ControllerActionWheelEntry): void => {
      controller?.dismissFpsCrosshairContextMenu();
      if (action.id === "extended") {
        setControllerActionWheelMode("extended");
        return;
      }
      if (action.kind === "quick") {
        controller?.runQuickAction(action.value);
      } else {
        controller?.runExtendedCommand(action.value);
      }
      closeControllerActionWheel();
    },
    [closeControllerActionWheel, controller],
  );
  const runControllerWheelExtendedCommand = useCallback(
    (command: string): void => {
      controller?.dismissFpsCrosshairContextMenu();
      controller?.runExtendedCommand(command);
      closeControllerActionWheel();
    },
    [closeControllerActionWheel, controller],
  );
  const openCharacterDialog = useCallback((): void => {
    setCharacterSheetInterceptionArmed(true);
    characterSheetAwaitingInfoRef.current = true;
    controller?.dismissFpsCrosshairContextMenu();
    closeControllerActionWheel();
    setIsMobileActionSheetVisible(false);
    setMobileActionSheetMode("quick");
    setIsMobileLogVisible(false);
    closeWizardCommands();
    controller?.runExtendedCommand("attributes");
  }, [closeControllerActionWheel, closeWizardCommands, controller]);
  useEffect(() => {
    if (loadingOverlayVisible || typeof window === "undefined") {
      return;
    }
    const handleControllerCharacterSheetRequest = (event: Event): void => {
      if (event.cancelable) {
        event.preventDefault();
      }
      openCharacterDialog();
    };
    window.addEventListener(
      nh3dOpenCharacterSheetEventName,
      handleControllerCharacterSheetRequest,
    );
    return () => {
      window.removeEventListener(
        nh3dOpenCharacterSheetEventName,
        handleControllerCharacterSheetRequest,
      );
    };
  }, [loadingOverlayVisible, openCharacterDialog]);
  useEffect(() => {
    if (loadingOverlayVisible || typeof window === "undefined") {
      return;
    }
    const handleControllerActionWheelToggle = (event: Event): void => {
      if (event.cancelable) {
        event.preventDefault();
      }
      if (!isMobileGameRunning && !isDesktopGameRunning) {
        return;
      }
      controller?.dismissFpsCrosshairContextMenu();
      closeWizardCommands();
      setIsMobileActionSheetVisible(false);
      setMobileActionSheetMode("quick");
      setIsControllerActionWheelVisible((wasVisible) => {
        const nextVisible = !wasVisible;
        if (nextVisible) {
          setControllerActionWheelMode("quick");
          setControllerActionWheelChosenIndex(0);
        }
        return nextVisible;
      });
    };
    const handleControllerActionWheelClose = (event: Event): void => {
      if (event.cancelable) {
        event.preventDefault();
      }
      closeControllerActionWheel();
    };
    window.addEventListener(
      nh3dToggleControllerActionWheelEventName,
      handleControllerActionWheelToggle,
    );
    window.addEventListener(
      nh3dCloseControllerActionWheelEventName,
      handleControllerActionWheelClose,
    );
    return () => {
      window.removeEventListener(
        nh3dToggleControllerActionWheelEventName,
        handleControllerActionWheelToggle,
      );
      window.removeEventListener(
        nh3dCloseControllerActionWheelEventName,
        handleControllerActionWheelClose,
      );
    };
  }, [
    closeControllerActionWheel,
    closeWizardCommands,
    controller,
    isDesktopGameRunning,
    isMobileGameRunning,
    loadingOverlayVisible,
  ]);
  useEffect(() => {
    if (
      !isControllerActionWheelVisible ||
      loadingOverlayVisible ||
      typeof window === "undefined"
    ) {
      return;
    }
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closeControllerActionWheel();
    };
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null;
      if (target && controllerActionWheelDialogRef.current?.contains(target)) {
        return;
      }
      closeControllerActionWheel();
    };
    window.addEventListener("keydown", handleEscape, true);
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("keydown", handleEscape, true);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [
    closeControllerActionWheel,
    isControllerActionWheelVisible,
    loadingOverlayVisible,
  ]);
  useEffect(() => {
    if (
      !isControllerActionWheelVisible ||
      loadingOverlayVisible ||
      controllerActionWheelMode !== "quick"
    ) {
      return;
    }
    const dialog = controllerActionWheelDialogRef.current;
    if (!dialog) {
      return;
    }
    const syncChosenIndexFromElement = (element: HTMLElement | null): void => {
      const wheelArc = element?.closest<HTMLElement>("[data-nh3d-wheel-index]");
      if (!wheelArc || !dialog.contains(wheelArc)) {
        return;
      }
      const rawIndex = Number.parseInt(
        wheelArc.dataset.nh3dWheelIndex || "",
        10,
      );
      if (!Number.isFinite(rawIndex) || rawIndex < 0) {
        return;
      }
      setControllerActionWheelChosenIndex((previous) =>
        previous === rawIndex ? previous : rawIndex,
      );
    };
    const handleFocusIn = (event: FocusEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      syncChosenIndexFromElement(target);
    };
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    syncChosenIndexFromElement(activeElement);
    dialog.addEventListener("focusin", handleFocusIn);
    return () => {
      dialog.removeEventListener("focusin", handleFocusIn);
    };
  }, [
    controllerActionWheelMode,
    isControllerActionWheelVisible,
    controllerActionWheelEntries.length,
    loadingOverlayVisible,
  ]);
  useEffect(() => {
    if (
      !isControllerActionWheelVisible ||
      loadingOverlayVisible ||
      controllerActionWheelMode !== "extended"
    ) {
      return;
    }
    if (typeof document === "undefined") {
      return;
    }
    const overlay = controllerActionWheelDialogRef.current;
    if (!overlay) {
      return;
    }
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (activeElement && overlay.contains(activeElement)) {
      return;
    }
    const timerId = window.setTimeout(() => {
      const firstExtendedButton = overlay.querySelector<HTMLElement>(
        ".nh3d-controller-action-wheel-extended .nh3d-mobile-actions-button:not(:disabled)",
      );
      firstExtendedButton?.focus({ preventScroll: true });
    }, 0);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    isControllerActionWheelVisible,
    controllerActionWheelMode,
    mobileCommonExtendedCommandNames.length,
    mobileExtendedCommandNames.length,
    loadingOverlayVisible,
  ]);
  useEffect(() => {
    if (wizardCommandsSupported) {
      return;
    }
    setIsWizardCommandsVisible(false);
  }, [wizardCommandsSupported]);
  useEffect(() => {
    if (
      !isWizardCommandsVisible ||
      loadingOverlayVisible ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeWizardCommands();
    };
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null;
      if (target && wizardCommandsButtonRef.current?.contains(target)) {
        return;
      }
      if (target && wizardCommandsSheetRef.current?.contains(target)) {
        return;
      }
      closeWizardCommands();
    };
    window.addEventListener("keydown", handleEscape, true);
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("keydown", handleEscape, true);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [closeWizardCommands, isWizardCommandsVisible, loadingOverlayVisible]);
  useEffect(() => {
    if (!isWizardCommandsVisible || typeof window === "undefined") {
      return;
    }
    const focusTimerId = window.setTimeout(() => {
      const firstWizardCommandButton =
        wizardCommandsSheetRef.current?.querySelector<HTMLElement>(
          ".nh3d-mobile-actions-button:not(:disabled)",
        );
      firstWizardCommandButton?.focus({ preventScroll: true });
    }, 0);
    return () => {
      window.clearTimeout(focusTimerId);
    };
  }, [isWizardCommandsVisible, wizardExtendedCommandNames.length]);
  const runCharacterExtendedCommand = useCallback(
    (command: string): void => {
      const normalizedCommand = String(command || "")
        .trim()
        .toLowerCase();
      setCharacterSheetInterceptionArmed(normalizedCommand === "attributes");
      characterSheetAwaitingInfoRef.current =
        normalizedCommand === "attributes";
      controller?.dismissFpsCrosshairContextMenu();
      controller?.runExtendedCommand(command);
    },
    [controller],
  );
  const closeInfoMenuDialog = useCallback((): void => {
    setCharacterSheetInterceptionArmed(false);
    characterSheetAwaitingInfoRef.current = false;
    controller?.closeInfoMenuDialog();
  }, [controller]);
  const showPreviousCachedMessageInfoMenu = useCallback((): void => {
    setMessageInfoMenuHistory((previous) =>
      previous.index <= 0
        ? previous
        : {
            ...previous,
            index: previous.index - 1,
          },
    );
  }, []);
  const showEarliestCachedMessageInfoMenu = useCallback((): void => {
    setMessageInfoMenuHistory((previous) =>
      previous.index <= 0
        ? previous
        : {
            ...previous,
            index: 0,
          },
    );
  }, []);
  const showNextCachedMessageInfoMenu = useCallback((): void => {
    setMessageInfoMenuHistory((previous) => {
      const lastIndex = previous.entries.length - 1;
      return previous.index >= lastIndex
        ? previous
        : {
            ...previous,
            index: previous.index + 1,
          };
    });
  }, []);
  const showLatestCachedMessageInfoMenu = useCallback((): void => {
    setMessageInfoMenuHistory((previous) => {
      const lastIndex = previous.entries.length - 1;
      return previous.index >= lastIndex
        ? previous
        : {
            ...previous,
            index: lastIndex,
          };
    });
  }, []);
  const showMessageHistoryNavigation = Boolean(
    displayedInfoMenu &&
      isNetHackMessageInfoMenuTitle(displayedInfoMenu.title) &&
      messageInfoMenuHistory.entries.length > 1,
  );
  const canShowPreviousCachedMessage = messageInfoMenuHistory.index > 0;
  const canShowNextCachedMessage =
    messageInfoMenuHistory.index < messageInfoMenuHistory.entries.length - 1;

  const submitTextInput = (value: string): void => {
    controller?.submitTextInput(value);
    setTextInputValue("");
  };

  const questionInitialFocusSeed = useMemo(() => {
    if (!question) {
      return null;
    }
    const selectableKeys = question.menuItems
      .filter((item) => isSelectableQuestionMenuItem(item))
      .map((item, index) => {
        const selectionInput = getMenuSelectionInput(item).trim();
        return selectionInput.length > 0
          ? selectionInput
          : `${index}:${String(item.text || "").trim()}`;
      })
      .join("|");
    return [
      String(question.text || "").trim(),
      String(question.menuPageIndex ?? 0),
      question.activeMenuSelectionInput ?? "",
      question.activeActionButton ?? "",
      selectableKeys,
      question.isPickupDialog ? "pickup" : "question",
    ].join("|");
  }, [question]);

  const questionLastInitialFocusSeedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    if (!questionInitialFocusSeed) {
      questionLastInitialFocusSeedRef.current = null;
      return;
    }
    if (questionLastInitialFocusSeedRef.current === questionInitialFocusSeed) {
      return;
    }
    questionLastInitialFocusSeedRef.current = questionInitialFocusSeed;
    const timerId = window.setTimeout(() => {
      const questionDialog = document.querySelector<HTMLElement>(
        "#question-dialog.nh3d-dialog.is-visible",
      );
      if (!questionDialog) {
        return;
      }
      const activeQuestionTarget = questionDialog.querySelector<HTMLElement>(
        ".nh3d-menu-button.nh3d-menu-button-active, button.nh3d-enhance-skill-card.nh3d-menu-button-active, button.nh3d-cast-row.nh3d-menu-button-active, button.nh3d-technique-row.nh3d-menu-button-active, .nh3d-pickup-item.nh3d-pickup-item-active, .nh3d-menu-action-button.nh3d-action-button-active, .nh3d-pickup-action-button.nh3d-action-button-active",
      );
      const firstQuestionTarget = questionDialog.querySelector<HTMLElement>(
        ".nh3d-menu-button:not(:disabled), button.nh3d-enhance-skill-card:not(:disabled), button.nh3d-cast-row:not(:disabled), button.nh3d-technique-row:not(:disabled), .nh3d-pickup-item[tabindex='0'], .nh3d-choice-button:not(:disabled), .nh3d-menu-action-button:not(:disabled), .nh3d-pickup-action-button:not(:disabled)",
      );
      const focusTarget = activeQuestionTarget ?? firstQuestionTarget;
      if (!focusTarget) {
        return;
      }
      focusTarget.focus({ preventScroll: true });
      focusTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, 0);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [questionInitialFocusSeed]);

  const startNewGameFromPrompt = (): void => {
    setReopenNewGamePromptOnInteraction(false);
    setDeferredNewGamePromptReason(null);
    setNewGamePrompt({ visible: false, reason: null });
    setGameOver({
      active: false,
      deathMessage: null,
      promptReady: false,
      tombstoneLines: null,
    });
    setPositionRequest(null);
    setInventoryContextMenu(null);
    setIsPauseMenuVisible(false);
    setIsExitConfirmationVisible(false);
    setIsClientOptionsVisible(false);
    setIsControllerRemapVisible(false);
    setControllerRemapListening(null);
    setIsControllerActionWheelVisible(false);
    setIsMobileActionSheetVisible(false);
    setIsMobileLogVisible(false);
    setIsWizardCommandsVisible(false);
    setCharacterSheetInterceptionArmed(false);
    characterSheetAwaitingInfoRef.current = false;
    setCharacterCreationConfig(null);
    setStartupFlowStep("variant");
  };

  const dismissNewGamePromptUntilInteraction = (): void => {
    const nextReason =
      typeof newGamePrompt.reason === "string" && newGamePrompt.reason.trim()
        ? newGamePrompt.reason.trim()
        : deferredNewGamePromptReason;
    setDeferredNewGamePromptReason(nextReason ?? null);
    setReopenNewGamePromptOnInteraction(true);
    setNewGamePrompt({ visible: false, reason: null });
  };

  const restoreDeferredNewGamePrompt = useCallback((): void => {
    setReopenNewGamePromptOnInteraction(false);
    setNewGamePrompt({
      visible: true,
      reason: deferredNewGamePromptReason,
    });
  }, [deferredNewGamePromptReason, setNewGamePrompt]);

  const toggleDeferredGameOverTombstoneUi = useCallback((): boolean => {
    if (gameOverDialogShowsTombstone) {
      dismissNewGamePromptUntilInteraction();
      return true;
    }
    if (hideAllUiForDeferredGameOver) {
      restoreDeferredNewGamePrompt();
      return true;
    }
    return false;
  }, [
    dismissNewGamePromptUntilInteraction,
    gameOverDialogShowsTombstone,
    hideAllUiForDeferredGameOver,
    restoreDeferredNewGamePrompt,
  ]);

  const handleNewGamePromptKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const actionButtons = [
        newGamePromptYesButtonRef.current,
        newGamePromptNoButtonRef.current,
      ].filter((button): button is HTMLButtonElement => Boolean(button));
      if (actionButtons.length === 0) {
        return;
      }
      const activeElement =
        typeof document !== "undefined" &&
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const activeIndex = activeElement
        ? actionButtons.findIndex((button) => button === activeElement)
        : -1;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === "ArrowLeft" ? -1 : 1;
        const targetIndex =
          activeIndex < 0
            ? delta > 0
              ? 0
              : actionButtons.length - 1
            : (((activeIndex + delta) % actionButtons.length) +
                actionButtons.length) %
              actionButtons.length;
        actionButtons[targetIndex]?.focus({ preventScroll: true });
        return;
      }
      if (
        event.key === "Enter" ||
        event.key === "NumpadEnter" ||
        event.key === " " ||
        event.key === "Space" ||
        event.key === "Spacebar"
      ) {
        if (
          activeIndex < 0 &&
          activeElement?.classList.contains("nh3d-mobile-dialog-close")
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (activeIndex === 1) {
          dismissNewGamePromptUntilInteraction();
        } else {
          startNewGameFromPrompt();
        }
      }
    },
    [dismissNewGamePromptUntilInteraction, startNewGameFromPrompt],
  );

  const resolveStartupMenuNavigationDirection = useCallback(
    (key: string, code?: string): "up" | "down" | "left" | "right" | null => {
      switch (key) {
        case "ArrowUp":
        case "k":
        case "K":
        case "y":
        case "Y":
        case "u":
        case "U":
          return "up";
        case "ArrowDown":
        case "j":
        case "J":
        case "b":
        case "B":
        case "n":
        case "N":
          return "down";
        case "ArrowLeft":
        case "h":
        case "H":
          return "left";
        case "ArrowRight":
        case "l":
        case "L":
          return "right";
        default:
          break;
      }
      switch (code) {
        case "Numpad8":
        case "Numpad7":
        case "Numpad9":
          return "up";
        case "Numpad2":
        case "Numpad1":
        case "Numpad3":
          return "down";
        case "Numpad4":
          return "left";
        case "Numpad6":
          return "right";
        default:
          return null;
      }
    },
    [],
  );

  const applyDialogDirectionalNavigation = useCallback(
    (
      direction: "up" | "down" | "left" | "right",
      dialogRoot: HTMLElement | null,
      options?: {
        focusedSlider?: HTMLInputElement | null;
        stepFocusedSliderOnHorizontal?: boolean;
      },
    ): boolean => {
      if (!dialogRoot) {
        return false;
      }
      const focusedSlider =
        options?.focusedSlider ?? getFocusedControllerRangeInput(dialogRoot);
      const stepFocusedSliderOnHorizontal =
        options?.stepFocusedSliderOnHorizontal ?? true;
      if (
        stepFocusedSliderOnHorizontal &&
        focusedSlider &&
        (direction === "left" || direction === "right")
      ) {
        return stepControllerRangeInput(
          focusedSlider,
          direction === "left" ? -1 : 1,
        );
      }
      if (moveControllerDialogFocus(direction)) {
        return true;
      }
      const focusable = getControllerFocusableElements(dialogRoot);
      if (focusable.length === 0) {
        return false;
      }
      const targetElement =
        direction === "up" || direction === "left"
          ? focusable[focusable.length - 1]
          : focusable[0];
      focusControllerDialogElement(targetElement);
      return true;
    },
    [],
  );

  const handleInfoMenuDialogKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown"
      ) {
        if (
          handleControllerDialogKeyboardScrollKey(
            event.currentTarget,
            event.key,
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (event.key === "Home" || event.key === "End") {
        const focusable = getControllerFocusableElements(event.currentTarget);
        if (focusable.length === 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const targetElement =
          event.key === "End" ? focusable[focusable.length - 1] : focusable[0];
        focusControllerDialogElement(targetElement);
        return;
      }

      const direction = resolveStartupMenuNavigationDirection(
        event.key,
        event.code,
      );
      if (!direction) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      applyDialogDirectionalNavigation(direction, event.currentTarget, {
        stepFocusedSliderOnHorizontal: false,
      });
    },
    [applyDialogDirectionalNavigation, resolveStartupMenuNavigationDirection],
  );

  const handleStartupMainMenuKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const target = event.target as HTMLElement | null;
      const targetSelect = target instanceof HTMLSelectElement ? target : null;
      const selectLikelyOpen = !!targetSelect
        ? startupLikelyOpenSelectElementsRef.current.has(targetSelect)
        : false;
      if (targetSelect) {
        const closeLikelyOpenSelect = (): void => {
          const previousValue =
            startupLikelyOpenSelectInitialValueByElementRef.current.get(
              targetSelect,
            ) ?? targetSelect.value;
          startupLikelyOpenSelectElementsRef.current.delete(targetSelect);
          startupLikelyOpenSelectInitialValueByElementRef.current.delete(
            targetSelect,
          );
          if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => {
              if (!targetSelect.isConnected) {
                return;
              }
              if (targetSelect.value !== previousValue) {
                targetSelect.dispatchEvent(
                  new Event("input", { bubbles: true }),
                );
                targetSelect.dispatchEvent(
                  new Event("change", { bubbles: true }),
                );
              }
              targetSelect.blur();
            });
          }
        };
        if (selectLikelyOpen) {
          if (
            event.key === "Enter" ||
            event.key === "NumpadEnter" ||
            event.key === " " ||
            event.key === "Space" ||
            event.key === "Spacebar"
          ) {
            if (
              event.key === " " ||
              event.key === "Space" ||
              event.key === "Spacebar"
            ) {
              event.preventDefault();
              event.stopPropagation();
            }
            closeLikelyOpenSelect();
            return;
          }
          if (event.key === "Escape") {
            startupLikelyOpenSelectElementsRef.current.delete(targetSelect);
            startupLikelyOpenSelectInitialValueByElementRef.current.delete(
              targetSelect,
            );
            return;
          }
          return;
        }
        const opensSelect =
          event.key === "F4" ||
          event.key === "Enter" ||
          event.key === "NumpadEnter" ||
          event.key === " " ||
          event.key === "Space" ||
          event.key === "Spacebar" ||
          ((event.key === "ArrowDown" || event.key === "ArrowUp") &&
            event.altKey);
        if (opensSelect) {
          startupLikelyOpenSelectElementsRef.current.add(targetSelect);
          startupLikelyOpenSelectInitialValueByElementRef.current.set(
            targetSelect,
            targetSelect.value,
          );
          return;
        }
        // Let focused selects keep native keyboard ownership for changing values.
        return;
      }
      const targetInput = target instanceof HTMLInputElement ? target : null;
      const targetInputType = String(targetInput?.type || "").toLowerCase();
      const targetRangeInput =
        targetInput && targetInputType === "range" && !targetInput.disabled
          ? targetInput
          : null;
      if (targetRangeInput) {
        const inputDirection = resolveStartupMenuNavigationDirection(
          event.key,
          event.code,
        );
        if (inputDirection) {
          event.preventDefault();
          event.stopPropagation();
          applyDialogDirectionalNavigation(
            inputDirection,
            event.currentTarget,
            {
              focusedSlider: targetRangeInput,
            },
          );
          return;
        }
      }
      const isTextLikeInput =
        !!targetInput &&
        targetInputType !== "checkbox" &&
        targetInputType !== "radio" &&
        targetInputType !== "range" &&
        targetInputType !== "color" &&
        targetInputType !== "button" &&
        targetInputType !== "submit" &&
        targetInputType !== "reset";
      if (
        target &&
        (isTextLikeInput ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        // Do not hijack keyboard input from editable fields during startup
        // character creation; keep typing, selection, and caret movement native.
        return;
      }

      if (
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown"
      ) {
        if (
          handleControllerDialogKeyboardScrollKey(
            event.currentTarget,
            event.key,
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (event.key === "Home" || event.key === "End") {
        const focusable = getControllerFocusableElements(event.currentTarget);
        if (focusable.length === 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const targetElement =
          event.key === "End" ? focusable[focusable.length - 1] : focusable[0];
        focusControllerDialogElement(targetElement);
        return;
      }

      const direction = resolveStartupMenuNavigationDirection(
        event.key,
        event.code,
      );
      if (!direction) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      applyDialogDirectionalNavigation(direction, event.currentTarget, {
        stepFocusedSliderOnHorizontal: false,
      });
    },
    [
      applyDialogDirectionalNavigation,
      resolveStartupMenuNavigationDirection,
    ],
  );

  const handleStartupMainMenuPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      const target = event.target as EventTarget | null;
      if (target instanceof HTMLSelectElement) {
        startupLikelyOpenSelectElementsRef.current.add(target);
        startupLikelyOpenSelectInitialValueByElementRef.current.set(
          target,
          target.value,
        );
      } else {
        startupLikelyOpenSelectElementsRef.current.clear();
        startupLikelyOpenSelectInitialValueByElementRef.current.clear();
      }
    },
    [],
  );

  const handleStartupMainMenuBlurCapture = useCallback(
    (event: React.FocusEvent<HTMLDivElement>): void => {
      const target = event.target as EventTarget | null;
      if (target instanceof HTMLSelectElement) {
        startupLikelyOpenSelectElementsRef.current.delete(target);
        startupLikelyOpenSelectInitialValueByElementRef.current.delete(target);
      }
    },
    [],
  );

  const handleStartupMainMenuChangeCapture = useCallback(
    (event: React.FormEvent<HTMLDivElement>): void => {
      const target = event.target as EventTarget | null;
      if (target instanceof HTMLSelectElement) {
        startupLikelyOpenSelectElementsRef.current.delete(target);
        startupLikelyOpenSelectInitialValueByElementRef.current.delete(target);
      }
    },
    [],
  );

  const handleClientOptionsDialogKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const target = event.target as HTMLElement | null;
      const targetSelect = target instanceof HTMLSelectElement ? target : null;
      const selectLikelyOpen = !!targetSelect
        ? clientOptionsLikelyOpenSelectElementsRef.current.has(targetSelect)
        : false;
      if (targetSelect) {
        const closeLikelyOpenSelect = (): void => {
          const previousValue =
            clientOptionsLikelyOpenSelectInitialValueByElementRef.current.get(
              targetSelect,
            ) ?? targetSelect.value;
          clientOptionsLikelyOpenSelectElementsRef.current.delete(targetSelect);
          clientOptionsLikelyOpenSelectInitialValueByElementRef.current.delete(
            targetSelect,
          );
          if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => {
              if (!targetSelect.isConnected) {
                return;
              }
              if (targetSelect.value !== previousValue) {
                targetSelect.dispatchEvent(
                  new Event("input", { bubbles: true }),
                );
                targetSelect.dispatchEvent(
                  new Event("change", { bubbles: true }),
                );
              }
              targetSelect.blur();
            });
          }
        };
        if (selectLikelyOpen) {
          if (
            event.key === "Enter" ||
            event.key === "NumpadEnter" ||
            event.key === " " ||
            event.key === "Space" ||
            event.key === "Spacebar"
          ) {
            if (
              event.key === " " ||
              event.key === "Space" ||
              event.key === "Spacebar"
            ) {
              event.preventDefault();
              event.stopPropagation();
            }
            closeLikelyOpenSelect();
            return;
          }
          if (event.key === "Escape") {
            clientOptionsLikelyOpenSelectElementsRef.current.delete(
              targetSelect,
            );
            clientOptionsLikelyOpenSelectInitialValueByElementRef.current.delete(
              targetSelect,
            );
            return;
          }
          return;
        }
        const opensSelect =
          event.key === "F4" ||
          event.key === "Enter" ||
          event.key === "NumpadEnter" ||
          event.key === " " ||
          event.key === "Space" ||
          event.key === "Spacebar" ||
          ((event.key === "ArrowDown" || event.key === "ArrowUp") &&
            event.altKey);
        if (opensSelect) {
          clientOptionsLikelyOpenSelectElementsRef.current.add(targetSelect);
          clientOptionsLikelyOpenSelectInitialValueByElementRef.current.set(
            targetSelect,
            targetSelect.value,
          );
          return;
        }
        // Let focused selects keep native keyboard ownership for changing values.
        return;
      }

      const targetInput = target instanceof HTMLInputElement ? target : null;
      const targetInputType = String(targetInput?.type || "").toLowerCase();
      if (targetInputType === "range" && targetInput && !targetInput.disabled) {
        const inputDirection = resolveStartupMenuNavigationDirection(
          event.key,
          event.code,
        );
        if (inputDirection) {
          event.preventDefault();
          event.stopPropagation();
          applyDialogDirectionalNavigation(
            inputDirection,
            event.currentTarget,
            {
              focusedSlider: targetInput,
            },
          );
          return;
        }
      }
      const isTextLikeInput =
        !!targetInput &&
        targetInputType !== "checkbox" &&
        targetInputType !== "radio" &&
        targetInputType !== "range" &&
        targetInputType !== "color" &&
        targetInputType !== "button" &&
        targetInputType !== "submit" &&
        targetInputType !== "reset";
      if (
        target &&
        (isTextLikeInput ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        // Do not hijack keyboard input from editable fields in options forms;
        // keep typing, selection, and caret movement native.
        return;
      }

      if (
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown"
      ) {
        if (
          handleControllerDialogKeyboardScrollKey(
            event.currentTarget,
            event.key,
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (event.key === "Home" || event.key === "End") {
        const focusable = getControllerFocusableElements(event.currentTarget);
        if (focusable.length === 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const targetElement =
          event.key === "End" ? focusable[focusable.length - 1] : focusable[0];
        focusControllerDialogElement(targetElement);
        return;
      }

      const direction = resolveStartupMenuNavigationDirection(
        event.key,
        event.code,
      );
      if (!direction) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      applyDialogDirectionalNavigation(direction, event.currentTarget, {
        stepFocusedSliderOnHorizontal: false,
      });
    },
    [
      applyDialogDirectionalNavigation,
      resolveStartupMenuNavigationDirection,
    ],
  );

  const handleClientOptionsDialogPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      const target = event.target as EventTarget | null;
      if (target instanceof HTMLSelectElement) {
        clientOptionsLikelyOpenSelectElementsRef.current.add(target);
        clientOptionsLikelyOpenSelectInitialValueByElementRef.current.set(
          target,
          target.value,
        );
      } else {
        clientOptionsLikelyOpenSelectElementsRef.current.clear();
        clientOptionsLikelyOpenSelectInitialValueByElementRef.current.clear();
      }
    },
    [],
  );

  const handleClientOptionsDialogBlurCapture = useCallback(
    (event: React.FocusEvent<HTMLDivElement>): void => {
      const target = event.target as EventTarget | null;
      if (target instanceof HTMLSelectElement) {
        clientOptionsLikelyOpenSelectElementsRef.current.delete(target);
        clientOptionsLikelyOpenSelectInitialValueByElementRef.current.delete(
          target,
        );
      }
    },
    [],
  );

  const handleClientOptionsDialogChangeCapture = useCallback(
    (event: React.FormEvent<HTMLDivElement>): void => {
      const target = event.target as EventTarget | null;
      if (target instanceof HTMLSelectElement) {
        clientOptionsLikelyOpenSelectElementsRef.current.delete(target);
        clientOptionsLikelyOpenSelectInitialValueByElementRef.current.delete(
          target,
        );
      }
    },
    [],
  );

  const refreshUserTilesetCatalog = useCallback(
    async (rehydrateFromStorage: boolean): Promise<void> => {
      try {
        const records = await listStoredUserTilesets();
        const normalizedRecords = await normalizeUserTilesetTileSizes(records);
        setUserTilesets(normalizedRecords);
        setNh3dUserTilesets(toUserTilesetRegistrations(normalizedRecords));
        if (rehydrateFromStorage) {
          const persistedOptions =
            await loadPersistedNh3dClientOptionsWithMigration(
              nh3dClientOptionsStorageKey,
            );
          initialPersistedClientOptionsRef.current = persistedOptions;
          const nextOptions =
            resolveInitialClientOptionsFromPersisted(persistedOptions);
          setClientOptions(nextOptions);
          setClientOptionsDraft(nextOptions);
          return;
        }
        setClientOptions((previous) => normalizeNh3dClientOptions(previous));
        setClientOptionsDraft((previous) =>
          normalizeNh3dClientOptions(previous),
        );
      } finally {
        if (rehydrateFromStorage) {
          setHasHydratedUserTilesets(true);
        }
      }
    },
    [],
  );

  const resetTilesetManagerSelectedFile = (): void => {
    setTilesetManagerFile(null);
    if (tilesetManagerFileInputRef.current) {
      tilesetManagerFileInputRef.current.value = "";
    }
  };

  const openTilesetManagerNewEditor = (): void => {
    setTilesetManagerMode("new");
    setTilesetManagerEditPath("");
    setTilesetManagerName("");
    setTilesetManagerTileLayoutVersion(
      activeRuntimeVersion === "slashem"
        ? "slashem"
        : defaultUserTilesetTileLayoutVersion,
    );
    setTilesetManagerAtlasState(createDefaultTileAtlasState());
    setTilesetManagerAtlasImage(null);
    resetTilesetManagerSelectedFile();
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setTilesetManagerError("");
  };

  const openTilesetManagerEditor = (rawTilesetPath: string): void => {
    const tilesetPath = String(rawTilesetPath || "").trim();
    if (!tilesetPath) {
      return;
    }
    const tilesetEntry = findNh3dTilesetByPath(tilesetPath);
    if (!tilesetEntry) {
      return;
    }
    const userRecord = userTilesetRecordByPath.get(tilesetPath);
    const currentEditPath = String(tilesetManagerEditPath || "").trim();
    setTilesetManagerMode("edit");
    setTilesetManagerEditPath(tilesetPath);
    setTilesetManagerName(
      userRecord
        ? stripUserTilesetNameSuffix(userRecord.label)
        : tilesetEntry.label,
    );
    setTilesetManagerTileLayoutVersion(
      userRecord
        ? userRecord.tileLayoutVersion
        : tilesetEntry.tileLayoutVersion === "slashem"
          ? "slashem"
          : tilesetEntry.tileLayoutVersion === "3.4.3"
            ? "3.4.3"
            : tilesetEntry.tileLayoutVersion === "5.0"
              ? "5.0"
              : "3.6.7",
    );
    if (tilesetPath !== currentEditPath) {
      setTilesetManagerAtlasState(createDefaultTileAtlasState());
      setTilesetManagerAtlasImage(null);
    }
    resetTilesetManagerSelectedFile();
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setTilesetManagerError("");
  };

  const openTilesetManager = (): void => {
    const activeTilesetPath = String(
      clientOptionsDraft.tilesetPath || "",
    ).trim();
    const fallbackTilesetPath = tilesetCatalog[0]?.path ?? "";
    const nextEditPath =
      (activeTilesetPath && isNh3dTilesetPathAvailable(activeTilesetPath)
        ? activeTilesetPath
        : "") || fallbackTilesetPath;
    if (nextEditPath) {
      openTilesetManagerEditor(nextEditPath);
    } else {
      openTilesetManagerNewEditor();
    }
    setIsTilesetManagerVisible(true);
  };

  const closeTilesetManager = (): void => {
    setIsTilesetManagerVisible(false);
    setTilesetManagerMode("edit");
    setTilesetManagerEditPath("");
    setTilesetManagerName("");
    setTilesetManagerTileLayoutVersion(defaultUserTilesetTileLayoutVersion);
    setTilesetManagerAtlasState(createDefaultTileAtlasState());
    setTilesetManagerAtlasImage(null);
    resetTilesetManagerSelectedFile();
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setTilesetManagerError("");
  };

  const handleTilesetManagerFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const file = event.target.files?.[0] ?? null;
    setTilesetManagerFile(file);
    if (!file) {
      return;
    }
    const strippedName = String(file.name || "")
      .replace(/\.[^.]+$/g, "")
      .trim();
    if (!tilesetManagerName.trim()) {
      setTilesetManagerName(strippedName || t.tilesets.userTileset);
    }
  };

  const removeUserTileset = async (
    record: StoredUserTilesetRecord,
  ): Promise<void> => {
    const label = String(record.label || t.tilesets.currentSelectionFallback);
    const confirmed = await requestConfirmation({
      title: t.tilesets.deleteUploadedTitle,
      message: t.tilesets.deleteUploadedMessage(label),
      confirmLabel: commonStrings.delete,
      cancelLabel: commonStrings.cancel,
      confirmClassName: "nh3d-menu-action-cancel",
    });
    if (!confirmed) {
      return;
    }
    setTilesetManagerBusy(true);
    setTilesetManagerError("");
    try {
      await deleteStoredUserTileset(record.id);
      await refreshUserTilesetCatalog(false);
      const deletedPath = getNh3dUserTilesetPath(record.id);
      if (selectedTilesetManagerEditPath === deletedPath) {
        const activeTilesetPath = String(
          clientOptionsDraft.tilesetPath || "",
        ).trim();
        const fallbackTilesetPath = tilesetCatalog[0]?.path ?? "";
        const nextEditPath =
          (activeTilesetPath &&
          activeTilesetPath !== deletedPath &&
          isNh3dTilesetPathAvailable(activeTilesetPath)
            ? activeTilesetPath
            : "") || fallbackTilesetPath;
        if (nextEditPath && nextEditPath !== deletedPath) {
          openTilesetManagerEditor(nextEditPath);
        } else {
          openTilesetManagerNewEditor();
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.tilesets.failedToDelete;
      setTilesetManagerError(message);
    } finally {
      setTilesetManagerBusy(false);
    }
  };

  const saveTilesetManagerSettingsDraft = (): void => {
    const next = normalizeNh3dClientOptions({
      ...clientOptions,
      tilesetBackgroundTileIdByTileset:
        clientOptionsDraft.tilesetBackgroundTileIdByTileset,
      tilesetBackgroundRemovalModeByTileset:
        clientOptionsDraft.tilesetBackgroundRemovalModeByTileset,
      tilesetSolidChromaKeyColorHexByTileset:
        clientOptionsDraft.tilesetSolidChromaKeyColorHexByTileset,
      fpsHeldWeaponSpriteFlipXByTileset:
        clientOptionsDraft.fpsHeldWeaponSpriteFlipXByTileset,
    });
    setClientOptions(next);
    setClientOptionsDraft((previous) =>
      normalizeNh3dClientOptions({
        ...previous,
        tilesetBackgroundTileIdByTileset: next.tilesetBackgroundTileIdByTileset,
        tilesetBackgroundRemovalModeByTileset:
          next.tilesetBackgroundRemovalModeByTileset,
        tilesetSolidChromaKeyColorHexByTileset:
          next.tilesetSolidChromaKeyColorHexByTileset,
        tilesetBackgroundTileId: next.tilesetBackgroundTileId,
        tilesetBackgroundRemovalMode: next.tilesetBackgroundRemovalMode,
        tilesetSolidChromaKeyColorHex: next.tilesetSolidChromaKeyColorHex,
        fpsHeldWeaponSpriteFlipX: next.fpsHeldWeaponSpriteFlipX,
        fpsHeldWeaponSpriteFlipXByTileset:
          next.fpsHeldWeaponSpriteFlipXByTileset,
      }),
    );
    controller?.setClientOptions(next);
  };

  const saveTilesetManager = async (): Promise<void> => {
    const file = tilesetManagerFile;
    const label = stripUserTilesetNameSuffix(tilesetManagerName);
    const userLabel = appendUserTilesetNameSuffix(label);
    const tileLayoutVersion = tilesetManagerTileLayoutVersion;
    if (tilesetManagerInNewMode) {
      if (!file) {
        setTilesetManagerError(t.tilesets.chooseFile);
        return;
      }
      if (!label) {
        setTilesetManagerError(t.tilesets.provideName);
        return;
      }
    }
    if (
      !tilesetManagerInNewMode &&
      selectedTilesetManagerEditUserRecord &&
      !label
    ) {
      setTilesetManagerError(t.tilesets.provideName);
      return;
    }

    setTilesetManagerBusy(true);
    setTilesetManagerError("");
    try {
      if (tilesetManagerInNewMode) {
        const tileSize = await inferTilesetTileSizeFromBlob(file as File);
        const savedRecord = await saveStoredUserTileset({
          label: userLabel,
          tileSize,
          tileLayoutVersion,
          fileName: (file as File).name,
          file: file as File,
        });
        await refreshUserTilesetCatalog(false);
        openTilesetManagerEditor(getNh3dUserTilesetPath(savedRecord.id));
        setTilesetManagerName(label);
      } else if (selectedTilesetManagerEditUserRecord) {
        const nextFile = file ?? selectedTilesetManagerEditUserRecord.blob;
        const nextFileName = file
          ? file.name
          : selectedTilesetManagerEditUserRecord.fileName;
        const nextTileSize = file
          ? await inferTilesetTileSizeFromBlob(file)
          : selectedTilesetManagerEditUserRecord.tileSize;
        await saveStoredUserTileset({
          id: selectedTilesetManagerEditUserRecord.id,
          label: userLabel,
          tileSize: nextTileSize,
          tileLayoutVersion,
          fileName: nextFileName,
          file: nextFile,
        });
        await refreshUserTilesetCatalog(false);
        openTilesetManagerEditor(
          getNh3dUserTilesetPath(selectedTilesetManagerEditUserRecord.id),
        );
        setTilesetManagerName(label);
      }
      saveTilesetManagerSettingsDraft();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.tilesets.failedToSave;
      setTilesetManagerError(message);
    } finally {
      setTilesetManagerBusy(false);
    }
  };

  useEffect(() => {
    refreshUserTilesetCatalog(true).catch((error) => {
      console.warn(t.tilesets.failedToLoadUploaded, error);
    });
  }, [refreshUserTilesetCatalog]);

  const confirmControllerSupportPromptChoice = useCallback(
    (enabled: boolean): void => {
      const next = normalizeNh3dClientOptions({
        ...clientOptions,
        controllerEnabled: enabled,
      });
      setClientOptions(next);
      setClientOptionsDraft((previous) =>
        normalizeNh3dClientOptions({
          ...previous,
          controllerEnabled: enabled,
        }),
      );
      controller?.setClientOptions(next);
      setIsControllerSupportPromptVisible(false);
      setHasAskedControllerSupportThisSession(true);
    },
    [clientOptions, controller],
  );

  const openClientOptionsDialog = (): void => {
    setClientOptionsDraft({ ...clientOptions });
    setActiveClientOptionsTab(clientOptionsDefaultTabId);
    setIsClientOptionsVisible(true);
    setIsDarkWallTilePickerVisible(false);
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setIsTilesetManagerVisible(false);
    setIsResetClientOptionsConfirmationVisible(false);
    setIsControllerRemapVisible(false);
    setControllerRemapListening(null);
    controller?.dismissFpsCrosshairContextMenu();
  };

  const persistLocaleSelectionAndReloadIfNeeded = useCallback(
    async (nextOptions: Nh3dClientOptions): Promise<void> => {
      const previousLocale = getCurrentLocale();
      setCurrentLocale(nextOptions.locale);
      if (nextOptions.locale === previousLocale) {
        return;
      }
      try {
        await persistNh3dClientOptionsToIndexedDb(nextOptions);
      } catch (error) {
        console.warn(
          "Failed to persist client options before locale reload:",
          error,
        );
      }
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    },
    [],
  );

  const closeClientOptionsDialog = async (): Promise<void> => {
    const canDiscardSoundPackChanges =
      (await soundPackDialogActionsRef.current?.confirmDiscardIfNeeded()) ??
      true;
    if (!canDiscardSoundPackChanges) {
      return;
    }
    setIsClientOptionsVisible(false);
    setIsDarkWallTilePickerVisible(false);
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setIsTilesetManagerVisible(false);
    setIsResetClientOptionsConfirmationVisible(false);
    setIsControllerRemapVisible(false);
    setControllerRemapListening(null);
    setClientOptionsDraft({ ...clientOptions });
  };

  const confirmClientOptionsDialog = async (): Promise<void> => {
    const didSaveSoundPackChanges =
      (await soundPackDialogActionsRef.current?.saveIfNeeded()) ?? true;
    if (!didSaveSoundPackChanges) {
      return;
    }
    const next = normalizeNh3dClientOptions(clientOptionsDraft);
    setClientOptions(next);
    setClientOptionsDraft(next);
    setIsClientOptionsVisible(false);
    setIsDarkWallTilePickerVisible(false);
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setIsTilesetManagerVisible(false);
    setIsResetClientOptionsConfirmationVisible(false);
    setIsControllerRemapVisible(false);
    setControllerRemapListening(null);
    controller?.setClientOptions(next);
    await persistLocaleSelectionAndReloadIfNeeded(next);
  };

  const requestCloseClientOptionsDialog = (): void => {
    void closeClientOptionsDialog();
  };

  const requestConfirmClientOptionsDialog = (): void => {
    void confirmClientOptionsDialog();
  };

  const openResetClientOptionsConfirmation = (): void => {
    setIsResetClientOptionsConfirmationVisible(true);
  };

  const cancelResetClientOptionsConfirmation = (): void => {
    setIsResetClientOptionsConfirmationVisible(false);
  };

  const confirmResetClientOptionsToDefaults = async (): Promise<void> => {
    const next = normalizeNh3dClientOptions(defaultNh3dClientOptions);
    setClientOptions(next);
    setClientOptionsDraft(next);
    setIsDarkWallTilePickerVisible(false);
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setIsTilesetManagerVisible(false);
    setIsResetClientOptionsConfirmationVisible(false);
    setIsControllerRemapVisible(false);
    setControllerRemapListening(null);
    controller?.setClientOptions(next);
    try {
      await resetNh3dDefaultSoundPackVolumeLevelsToDefaults();
    } catch (error) {
      console.warn(
        "Failed to reset default sound-pack volume levels to defaults:",
        error,
      );
    } finally {
      try {
        await soundPackDialogActionsRef.current?.reloadFromStorage();
      } catch (error) {
        console.warn(
          "Failed to reload sound-pack state after resetting defaults:",
          error,
        );
      }
    }
    await persistLocaleSelectionAndReloadIfNeeded(next);
  };

  const updateClientOptionDraft = <
    K extends
      | ClientOptionToggleKey
      | ClientOptionSelect["key"]
      | ClientOptionSlider["key"]
      | ClientOptionColor["key"],
  >(
    optionKey: K,
    value: Nh3dClientOptions[K],
  ): void => {
    setClientOptionsDraft((previous) => ({
      ...previous,
      [optionKey]: value,
    }));
  };

  const showManualSafeZonePreview = useCallback(
    (side: ManualSafeZonePreview["side"], rawSizePx: number): void => {
      const sizePx = Math.max(0, Math.min(100, Math.round(rawSizePx)));
      setManualSafeZonePreview({ side, sizePx });
      if (typeof window === "undefined") {
        return;
      }
      if (manualSafeZonePreviewTimerRef.current !== null) {
        window.clearTimeout(manualSafeZonePreviewTimerRef.current);
      }
      manualSafeZonePreviewTimerRef.current = window.setTimeout(() => {
        setManualSafeZonePreview(null);
        manualSafeZonePreviewTimerRef.current = null;
      }, 1200);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (
        typeof window !== "undefined" &&
        manualSafeZonePreviewTimerRef.current !== null
      ) {
        window.clearTimeout(manualSafeZonePreviewTimerRef.current);
      }
    };
  }, []);

  const closeControllerRemapDialog = useCallback((): void => {
    setControllerRemapListening(null);
    setIsControllerRemapVisible(false);
  }, []);

  const openControllerRemapDialog = useCallback((): void => {
    setControllerRemapListening(null);
    setIsControllerRemapVisible(true);
  }, []);

  const setControllerBindingSlotDraft = useCallback(
    (
      actionId: Nh3dControllerActionId,
      slotIndex: ControllerRemapSlotIndex,
      nextBinding: Nh3dControllerBinding | null,
    ): void => {
      setClientOptionsDraft((previous) => {
        const nextBindings = normalizeNh3dControllerBindings({
          ...previous.controllerBindings,
        });
        const currentSlots = nextBindings[actionId] ?? [null, null];
        const updatedSlots: [
          Nh3dControllerBinding | null,
          Nh3dControllerBinding | null,
        ] = [currentSlots[0] ?? null, currentSlots[1] ?? null];
        updatedSlots[slotIndex] = nextBinding;
        nextBindings[actionId] = updatedSlots;
        return {
          ...previous,
          controllerBindings: normalizeNh3dControllerBindings(nextBindings),
        };
      });
    },
    [],
  );

  const resetControllerBindingsToDefaultsDraft = useCallback((): void => {
    setClientOptionsDraft((previous) => ({
      ...previous,
      controllerBindings: normalizeNh3dControllerBindings(
        defaultNh3dControllerBindings,
      ),
    }));
    setControllerRemapListening(null);
  }, []);

  const beginControllerBindingCapture = useCallback(
    (
      actionId: Nh3dControllerActionId,
      slotIndex: ControllerRemapSlotIndex,
    ): void => {
      const blockedBindings = sampleActiveControllerBindingCandidates();
      setControllerRemapListening({
        actionId,
        slotIndex,
        startedAtMs: performance.now(),
        blockedBindings,
      });
    },
    [],
  );

  const clearControllerBindingCapture = useCallback((): void => {
    setControllerRemapListening(null);
  }, []);

  useEffect(() => {
    if (!controllerRemapListening || loadingOverlayVisible) {
      return;
    }

    let frameHandle = 0;
    const scan = (): void => {
      const elapsedMs =
        performance.now() - controllerRemapListening.startedAtMs;
      const candidates = sampleActiveControllerBindingCandidates();
      const blockedSet = new Set(controllerRemapListening.blockedBindings);
      const capturedBinding =
        elapsedMs >= controllerCaptureIgnoreDurationMs
          ? (candidates.find((binding) => !blockedSet.has(binding)) ?? null)
          : null;
      if (capturedBinding) {
        setControllerBindingSlotDraft(
          controllerRemapListening.actionId,
          controllerRemapListening.slotIndex,
          capturedBinding,
        );
        setControllerRemapListening(null);
        return;
      }
      frameHandle = window.requestAnimationFrame(scan);
    };

    frameHandle = window.requestAnimationFrame(scan);
    return () => {
      window.cancelAnimationFrame(frameHandle);
    };
  }, [
    controllerRemapListening,
    loadingOverlayVisible,
    setControllerBindingSlotDraft,
  ]);

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

  const updateClientFovDraft = (rawValue: number): void => {
    const clamped = Math.max(45, Math.min(110, Math.round(rawValue)));
    setClientOptionsDraft((previous) => ({
      ...previous,
      fpsFov: clamped,
    }));
  };

  const updateClientLookSensitivityDraft = (
    key: ClientOptionLookSensitivityKey,
    rawValue: number,
  ): void => {
    const clamped = Number(
      Math.max(
        nh3dFpsLookSensitivityMin,
        Math.min(nh3dFpsLookSensitivityMax, rawValue),
      ).toFixed(2),
    );
    setClientOptionsDraft((previous) => ({
      ...previous,
      [key]: clamped,
    }));
  };

  const updateClientSliderDraft = (
    key: ClientOptionSlider["key"],
    rawValue: number,
  ): void => {
    if (key === "fpsFov") {
      updateClientFovDraft(rawValue);
      return;
    }
    if (key === "fpsLookSensitivityX" || key === "fpsLookSensitivityY") {
      updateClientLookSensitivityDraft(key, rawValue);
      return;
    }
    let clamped = rawValue;
    if (key === "brightness") {
      clamped = Math.max(-0.25, Math.min(0.25, rawValue));
    } else if (key === "contrast") {
      clamped = Math.max(-0.25, Math.min(0.25, rawValue));
    } else if (key === "gamma") {
      clamped = Math.max(0.5, Math.min(2.5, rawValue));
    } else if (key === "bloodStrength") {
      clamped = Math.max(1, Math.min(2.5, rawValue));
    } else if (key === "minimapScale") {
      clamped = Math.max(0.6, Math.min(2.2, rawValue));
    } else if (key === "liveMessageDisplayTimeMs") {
      clamped = Math.max(250, Math.min(6000, rawValue));
    } else if (key === "uiFontScale") {
      clamped = Math.max(0.7, Math.min(1.8, rawValue));
    } else if (key === "liveMessageLogFontScale") {
      clamped = Math.max(0.7, Math.min(2.2, rawValue));
    } else if (key === "desktopMessageLogWindowScale") {
      clamped = Math.max(0.33, Math.min(1.5, rawValue));
    } else if (key === "controllerFpsMoveRepeatMs") {
      clamped = Math.max(80, Math.min(900, rawValue));
    } else if (
      key === "manualMobileBottomSafeZoneVerticalPx" ||
      key === "manualMobileBottomSafeZoneHorizontalPx" ||
      key === "manualMobileRightSafeZoneHorizontalPx"
    ) {
      clamped = Math.max(0, Math.min(100, rawValue));
    } else {
      clamped = Math.max(120, Math.min(4000, rawValue));
    }
    if (
      key === "controllerFpsMoveRepeatMs" ||
      key === "liveMessageDisplayTimeMs" ||
      key === "liveMessageFadeOutTimeMs" ||
      key === "manualMobileBottomSafeZoneVerticalPx" ||
      key === "manualMobileBottomSafeZoneHorizontalPx" ||
      key === "manualMobileRightSafeZoneHorizontalPx"
    ) {
      updateClientOptionDraft(key, Math.round(clamped));
      return;
    }
    updateClientOptionDraft(key, Number(clamped.toFixed(2)));
  };

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
      if (isNh3dTilesetBackgroundRemovalModeForcedOff(tilesetPath)) {
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

  useEffect(() => {
    if (!clientOptionsDraft.darkCorridorWallTileOverrideEnabled) {
      setIsDarkWallTilePickerVisible(false);
    }
  }, [clientOptionsDraft.darkCorridorWallTileOverrideEnabled]);

  useEffect(() => {
    if (
      !clientOptionsDraft.darkCorridorWalls367 &&
      !clientOptionsDraft.overrideNh5DarkCorridorWallTiles
    ) {
      setIsDarkWallTilePickerVisible(false);
    }
  }, [
    clientOptionsDraft.darkCorridorWalls367,
    clientOptionsDraft.overrideNh5DarkCorridorWallTiles,
  ]);

  useEffect(() => {
    if (isVultureTilesetSelected) {
      setIsDarkWallTilePickerVisible(false);
    }
  }, [isVultureTilesetSelected]);

  useEffect(() => {
    if (clientOptionsDraft.tilesetMode !== "tiles" || !selectedTilesetEntry) {
      setIsTilesetBackgroundTilePickerVisible(false);
      setIsTilesetSolidColorPickerVisible(false);
      setIsTilesetManagerVisible(false);
    }
  }, [clientOptionsDraft.tilesetMode, selectedTilesetEntry]);

  useEffect(() => {
    if (!isTilesetManagerVisible || !selectedTilesetManagerEditPath) {
      setIsTilesetBackgroundTilePickerVisible(false);
      setIsTilesetSolidColorPickerVisible(false);
      return;
    }
    if (tilesetManagerBackgroundRemovalMode !== "tile") {
      setIsTilesetBackgroundTilePickerVisible(false);
    }
    if (tilesetManagerBackgroundRemovalMode !== "solid") {
      setIsTilesetSolidColorPickerVisible(false);
    }
  }, [
    isTilesetManagerVisible,
    selectedTilesetManagerEditPath,
    tilesetManagerBackgroundRemovalMode,
  ]);

  useEffect(() => {
    if (!isTilesetManagerVisible || tilesetManagerMode !== "edit") {
      return;
    }
    const hasActiveEditTileset =
      selectedTilesetManagerEditPath &&
      isNh3dTilesetPathAvailable(selectedTilesetManagerEditPath);
    if (hasActiveEditTileset) {
      return;
    }
    const activeTilesetPath = String(
      clientOptionsDraft.tilesetPath || "",
    ).trim();
    const fallbackTilesetPath = tilesetCatalog[0]?.path ?? "";
    const nextEditPath =
      (activeTilesetPath && isNh3dTilesetPathAvailable(activeTilesetPath)
        ? activeTilesetPath
        : "") || fallbackTilesetPath;
    if (nextEditPath) {
      openTilesetManagerEditor(nextEditPath);
      return;
    }
    openTilesetManagerNewEditor();
  }, [
    clientOptionsDraft.tilesetPath,
    isTilesetManagerVisible,
    selectedTilesetManagerEditPath,
    tilesetManagerMode,
    tilesetCatalog,
  ]);

  const renderMobileDialogCloseButton = (
    onClick: () => void,
    label = "Close",
  ): JSX.Element | null =>
    isMobileViewport ? (
      <MobileDismissButton
        className="nh3d-mobile-dialog-close"
        label={label}
        onClick={onClick}
      />
    ) : null;

  const focusInventoryItemByAccelerator = useCallback(
    (accelerator: string): void => {
      const normalizedAccelerator = String(accelerator || "").trim();
      if (!normalizedAccelerator) {
        return;
      }
      const focusTargetRow = (): void => {
        let targetRow: HTMLDivElement | null = null;
        for (const rowElement of inventoryRowRefs.current.values()) {
          const rowAccelerator = String(
            rowElement.dataset.nh3dAccelerator || "",
          ).trim();
          if (rowAccelerator === normalizedAccelerator) {
            targetRow = rowElement;
            break;
          }
        }
        if (!targetRow || !targetRow.isConnected) {
          return;
        }
        targetRow.focus({ preventScroll: true });
        targetRow.scrollIntoView({ block: "nearest", inline: "nearest" });
      };
      if (typeof window === "undefined") {
        focusTargetRow();
        return;
      }
      window.requestAnimationFrame(focusTargetRow);
    },
    [],
  );

  const moveInventoryItemFocusByArrowKey = useCallback(
    (
      currentRow: HTMLDivElement,
      direction: "previous" | "next",
    ): HTMLDivElement | null => {
      const focusableRows = Array.from(inventoryRowRefs.current.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([, rowElement]) => rowElement)
        .filter(
          (rowElement) =>
            rowElement.isConnected &&
            !rowElement.classList.contains("nh3d-inventory-item-disabled"),
        );
      if (focusableRows.length === 0) {
        return null;
      }

      const currentIndex = focusableRows.findIndex(
        (rowElement) => rowElement === currentRow,
      );
      const delta = direction === "previous" ? -1 : 1;
      const targetIndex =
        currentIndex < 0
          ? delta > 0
            ? 0
            : focusableRows.length - 1
          : (((currentIndex + delta) % focusableRows.length) +
              focusableRows.length) %
            focusableRows.length;
      const targetRow = focusableRows[targetIndex] ?? null;
      if (!targetRow) {
        return null;
      }
      targetRow.focus({ preventScroll: true });
      targetRow.scrollIntoView({ block: "nearest", inline: "nearest" });
      return targetRow;
    },
    [],
  );

  const closeInventoryContextMenu = useCallback(
    (options?: { restoreItemFocus?: boolean }): void => {
      const shouldRestoreItemFocus = options?.restoreItemFocus === true;
      const activeContextMenu = inventoryContextMenuStateRef.current;
      inventoryContextMenuKeyboardOpenPendingRef.current = false;
      setInventoryContextMenu(null);
      setInventoryDropTypeMenuPosition(null);
      if (shouldRestoreItemFocus && activeContextMenu?.accelerator) {
        focusInventoryItemByAccelerator(activeContextMenu.accelerator);
      }
    },
    [focusInventoryItemByAccelerator],
  );

  const closeInventoryDropTypeMenu = useCallback((): void => {
    setInventoryDropTypeMenuPosition(null);
  }, []);

  const openInventoryDropTypeMenu = useCallback((): void => {
    if (typeof window === "undefined") {
      return;
    }
    const anchorElement = inventoryDropActionButtonRef.current;
    if (!anchorElement) {
      return;
    }
    const anchorRect = anchorElement.getBoundingClientRect();
    const nextPosition = resolveInventoryDropTypeMenuPosition(
      anchorRect,
      inventoryDropTypeMenuEstimatedWidthPx,
      inventoryDropTypeMenuEstimatedHeightPx,
    );
    setInventoryDropTypeMenuPosition((previous) => {
      if (
        previous &&
        Math.abs(previous.x - nextPosition.x) < 0.02 &&
        Math.abs(previous.y - nextPosition.y) < 0.02
      ) {
        return previous;
      }
      return nextPosition;
    });
  }, []);

  const cancelInventoryDropTypeHold = useCallback((): void => {
    if (typeof window === "undefined") {
      inventoryDropTypeHoldStateRef.current = null;
      inventoryDropTypeHoldAnimationFrameRef.current = null;
      return;
    }
    const activeFrame = inventoryDropTypeHoldAnimationFrameRef.current;
    if (activeFrame !== null) {
      window.cancelAnimationFrame(activeFrame);
      inventoryDropTypeHoldAnimationFrameRef.current = null;
    }
    inventoryDropTypeHoldStateRef.current = null;
  }, []);

  const beginInventoryDropTypeHold = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>): void => {
      if (typeof window === "undefined") {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      inventorySuppressDropActionClickRef.current = false;
      cancelInventoryDropTypeHold();
      const holdState = {
        pointerId: event.pointerId,
        startedAtMs: performance.now(),
        triggered: false,
      };
      inventoryDropTypeHoldStateRef.current = holdState;
      const tick = (): void => {
        const activeState = inventoryDropTypeHoldStateRef.current;
        if (!activeState || activeState.pointerId !== holdState.pointerId) {
          inventoryDropTypeHoldAnimationFrameRef.current = null;
          return;
        }
        if (
          performance.now() - activeState.startedAtMs >=
          inventoryDropTypeHoldThresholdMs
        ) {
          activeState.triggered = true;
          inventorySuppressDropActionClickRef.current = true;
          inventoryDropTypeHoldAnimationFrameRef.current = null;
          openInventoryDropTypeMenu();
          return;
        }
        inventoryDropTypeHoldAnimationFrameRef.current =
          window.requestAnimationFrame(tick);
      };
      inventoryDropTypeHoldAnimationFrameRef.current =
        window.requestAnimationFrame(tick);
    },
    [cancelInventoryDropTypeHold, openInventoryDropTypeMenu],
  );

  const completeInventoryDropTypeHold = useCallback(
    (pointerId: number): void => {
      const holdState = inventoryDropTypeHoldStateRef.current;
      if (!holdState || holdState.pointerId !== pointerId) {
        return;
      }
      if (holdState.triggered) {
        inventorySuppressDropActionClickRef.current = true;
      }
      cancelInventoryDropTypeHold();
    },
    [cancelInventoryDropTypeHold],
  );

  const consumeInventoryDropActionClickSuppression =
    useCallback((): boolean => {
      if (!inventorySuppressDropActionClickRef.current) {
        return false;
      }
      inventorySuppressDropActionClickRef.current = false;
      return true;
    }, []);

  const runInventoryDropTypeCommand = useCallback((): void => {
    closeInventoryDropTypeMenu();
    setInventoryContextMenu(null);
    controller?.runExtendedCommand("droptype");
  }, [closeInventoryDropTypeMenu, controller]);

  const closeInventoryDropCountModal = useCallback((): void => {
    setInventoryDropCountDialog(null);
  }, []);

  const openInventoryDropCountModal = useCallback(
    (accelerator: string, itemText: string): void => {
      const stackCount = parseInventoryStackCount(itemText);
      if (!stackCount) {
        return;
      }
      closeInventoryDropTypeMenu();
      setInventoryContextMenu(null);
      setInventoryDropCountDialog({
        accelerator,
        itemText,
        maxCount: stackCount,
      });
      setInventoryDropCountValue(1);
    },
    [closeInventoryDropTypeMenu],
  );

  const clampInventoryDropCountValue = useCallback(
    (nextValue: number): number => {
      const normalized = Number.isFinite(nextValue) ? Math.trunc(nextValue) : 1;
      return Math.max(1, Math.min(inventoryDropCountMaxValue, normalized));
    },
    [inventoryDropCountMaxValue],
  );

  const stepInventoryDropCountValue = useCallback(
    (delta: number): void => {
      if (!Number.isFinite(delta) || delta === 0) {
        return;
      }
      setInventoryDropCountValue((previous) =>
        clampInventoryDropCountValue(previous + Math.trunc(delta)),
      );
    },
    [clampInventoryDropCountValue],
  );

  const submitInventoryDropCount = useCallback((): void => {
    if (!inventoryDropCountDialog) {
      return;
    }
    const amount = clampInventoryDropCountValue(inventoryDropCountValue);
    if (!controller) {
      closeInventoryDropCountModal();
      return;
    }
    controller.runInventoryItemDropCount(
      inventoryDropCountDialog.accelerator,
      amount,
    );
    closeInventoryDropCountModal();
  }, [
    clampInventoryDropCountValue,
    closeInventoryDropCountModal,
    controller,
    inventoryDropCountDialog,
    inventoryDropCountValue,
  ]);

  const resolveInventoryContextNavigationDirection = useCallback(
    (key: string, code?: string): "up" | "down" | "left" | "right" | null => {
      switch (key) {
        case "ArrowUp":
        case "PageUp":
        case "k":
        case "K":
        case "y":
        case "Y":
        case "u":
        case "U":
          return "up";
        case "ArrowDown":
        case "PageDown":
        case "j":
        case "J":
        case "b":
        case "B":
        case "n":
        case "N":
          return "down";
        case "ArrowLeft":
        case "h":
        case "H":
          return "left";
        case "ArrowRight":
        case "l":
        case "L":
          return "right";
        default:
          break;
      }
      switch (code) {
        case "Numpad8":
        case "Numpad7":
        case "Numpad9":
          return "up";
        case "Numpad2":
        case "Numpad1":
        case "Numpad3":
          return "down";
        case "Numpad4":
          return "left";
        case "Numpad6":
          return "right";
        default:
          return null;
      }
    },
    [],
  );

  const moveInventoryContextMenuActionFocus = useCallback(
    (direction: "up" | "down" | "left" | "right"): boolean => {
      const actionButtons =
        inventoryContextMenuRef.current?.querySelectorAll<HTMLButtonElement>(
          ".nh3d-context-menu-button:not(:disabled)",
        ) ?? null;
      if (!actionButtons || actionButtons.length === 0) {
        return false;
      }
      const focusableButtons = Array.from(actionButtons).filter(
        (button) => button.isConnected,
      );
      if (focusableButtons.length === 0) {
        return false;
      }

      const measuredButtons = focusableButtons
        .map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            button,
            centerX: rect.left + rect.width * 0.5,
            centerY: rect.top + rect.height * 0.5,
          };
        })
        .sort((left, right) =>
          left.centerY === right.centerY
            ? left.centerX - right.centerX
            : left.centerY - right.centerY,
        );
      const rows: Array<{
        centerY: number;
        items: Array<{
          button: HTMLButtonElement;
          centerX: number;
          centerY: number;
        }>;
      }> = [];
      const rowTolerancePx = 12;
      for (const measured of measuredButtons) {
        const lastRow = rows[rows.length - 1];
        if (
          lastRow &&
          Math.abs(measured.centerY - lastRow.centerY) <= rowTolerancePx
        ) {
          lastRow.items.push(measured);
          const rowSize = lastRow.items.length;
          lastRow.centerY =
            (lastRow.centerY * (rowSize - 1) + measured.centerY) / rowSize;
        } else {
          rows.push({
            centerY: measured.centerY,
            items: [measured],
          });
        }
      }
      for (const row of rows) {
        row.items.sort((left, right) => left.centerX - right.centerX);
      }

      const activeElement =
        typeof document !== "undefined" &&
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const focusLinear = (delta: -1 | 1): HTMLButtonElement | null => {
        const activeIndex = activeElement
          ? focusableButtons.findIndex((button) => button === activeElement)
          : -1;
        const targetIndex =
          activeIndex < 0
            ? delta > 0
              ? 0
              : focusableButtons.length - 1
            : (((activeIndex + delta) % focusableButtons.length) +
                focusableButtons.length) %
              focusableButtons.length;
        return focusableButtons[targetIndex] ?? null;
      };

      const hasMultipleColumns = rows.some((row) => row.items.length > 1);
      let targetButton: HTMLButtonElement | null = null;
      if (rows.length > 0 && hasMultipleColumns) {
        let activeRowIndex = -1;
        let activeColumnIndex = -1;
        let activeCenterX = Number.NaN;
        if (activeElement) {
          for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
            const columnIndex = rows[rowIndex].items.findIndex(
              (item) => item.button === activeElement,
            );
            if (columnIndex >= 0) {
              activeRowIndex = rowIndex;
              activeColumnIndex = columnIndex;
              activeCenterX = rows[rowIndex].items[columnIndex].centerX;
              break;
            }
          }
        }

        if (activeRowIndex < 0 || activeColumnIndex < 0) {
          if (direction === "up" || direction === "left") {
            const lastRow = rows[rows.length - 1];
            targetButton =
              lastRow.items[lastRow.items.length - 1]?.button ?? null;
          } else {
            targetButton = rows[0].items[0]?.button ?? null;
          }
        } else if (direction === "right") {
          const currentRow = rows[activeRowIndex];
          if (activeColumnIndex < currentRow.items.length - 1) {
            targetButton =
              currentRow.items[activeColumnIndex + 1]?.button ?? null;
          } else if (activeRowIndex < rows.length - 1) {
            targetButton = rows[activeRowIndex + 1].items[0]?.button ?? null;
          } else {
            targetButton = rows[0].items[0]?.button ?? null;
          }
        } else if (direction === "left") {
          const currentRow = rows[activeRowIndex];
          if (activeColumnIndex > 0) {
            targetButton =
              currentRow.items[activeColumnIndex - 1]?.button ?? null;
          } else if (activeRowIndex > 0) {
            const previousRow = rows[activeRowIndex - 1];
            targetButton =
              previousRow.items[previousRow.items.length - 1]?.button ?? null;
          } else {
            const lastRow = rows[rows.length - 1];
            targetButton =
              lastRow.items[lastRow.items.length - 1]?.button ?? null;
          }
        } else {
          const rowDelta = direction === "up" ? -1 : 1;
          let nextRowIndex = activeRowIndex + rowDelta;
          if (nextRowIndex < 0) {
            nextRowIndex = rows.length - 1;
          } else if (nextRowIndex >= rows.length) {
            nextRowIndex = 0;
          }
          const nextRow = rows[nextRowIndex];
          targetButton =
            nextRow.items.reduce<{
              button: HTMLButtonElement;
              distance: number;
            } | null>((best, item) => {
              const distance = Math.abs(item.centerX - activeCenterX);
              if (!best || distance < best.distance) {
                return { button: item.button, distance };
              }
              return best;
            }, null)?.button ?? null;
        }
      }
      if (!targetButton) {
        const linearDelta = direction === "up" || direction === "left" ? -1 : 1;
        targetButton = focusLinear(linearDelta);
      }
      if (!targetButton) {
        return false;
      }
      targetButton.focus({ preventScroll: true });
      targetButton.scrollIntoView({ block: "nearest", inline: "nearest" });
      return true;
    },
    [],
  );

  const openInventoryContextMenu = (
    item: NethackMenuItem,
    clientX: number,
    clientY: number,
    anchorRect?: DOMRect | null,
    options?: { focusMenu?: boolean },
  ): void => {
    inventoryContextMenuKeyboardOpenPendingRef.current =
      options?.focusMenu === true;
    setInventoryDropTypeMenuPosition(null);
    if (!inventoryContextActionsEnabled) {
      return;
    }
    if (typeof item.accelerator !== "string") {
      return;
    }
    const itemAccelerator = item.accelerator.trim();
    if (!itemAccelerator) {
      return;
    }

    const estimatedMenuWidthPx = 220;
    const estimatedMenuHeightPx = 260;
    const pointerOffsetPx = 8;
    let anchorCenterX: number | undefined;
    let anchorLeftX: number | undefined;
    let anchorBottomY: number | undefined;
    let anchorRightX: number | undefined;
    let anchorTopY: number | undefined;

    let initial = clampInventoryContextMenuPosition(
      clientX + pointerOffsetPx,
      clientY + pointerOffsetPx,
      estimatedMenuWidthPx,
      estimatedMenuHeightPx,
    );

    if (anchorRect) {
      const anchorRectLeft = Number.isFinite(anchorRect.left)
        ? anchorRect.left
        : null;
      const anchorRectRight = Number.isFinite(anchorRect.right)
        ? anchorRect.right
        : null;
      if (anchorRectLeft !== null && anchorRectRight !== null) {
        anchorCenterX = Math.min(
          Math.max(clientX, anchorRectLeft),
          anchorRectRight,
        );
      }
      if (Number.isFinite(anchorRect.left)) {
        anchorLeftX = anchorRect.left - inventoryContextMenuAnchorGapPx;
      }
      if (Number.isFinite(anchorRect.right)) {
        anchorRightX = anchorRect.right + inventoryContextMenuAnchorGapPx;
      }
      if (Number.isFinite(anchorRect.top)) {
        anchorTopY = anchorRect.top - inventoryContextMenuAnchorBottomGapPx;
      }
      if (Number.isFinite(anchorRect.bottom)) {
        anchorBottomY =
          anchorRect.bottom + inventoryContextMenuAnchorBottomGapPx;
      }
      const preferredRightX =
        typeof anchorRightX === "number" && Number.isFinite(anchorRightX)
          ? anchorRightX
          : clientX + pointerOffsetPx;
      const preferredRightY =
        typeof anchorBottomY === "number" && Number.isFinite(anchorBottomY)
          ? anchorBottomY
          : clientY + pointerOffsetPx;
      const preferredLeftX =
        typeof anchorCenterX === "number" && Number.isFinite(anchorCenterX)
          ? anchorCenterX - estimatedMenuWidthPx * 0.5
          : preferredRightX;
      const belowCandidate = clampInventoryContextMenuPosition(
        preferredLeftX,
        preferredRightY,
        estimatedMenuWidthPx,
        estimatedMenuHeightPx,
      );

      initial = belowCandidate;
    }
    const initialWithRegionClamp = resolveInventoryContextMenuPosition(
      {
        accelerator: itemAccelerator,
        itemText: String(item.text || t.dialogs.inventory.unknownItem),
        x: initial.x,
        y: initial.y,
        anchorCenterX,
        anchorLeftX,
        anchorBottomY,
        anchorRightX,
        anchorTopY,
      },
      estimatedMenuWidthPx,
      estimatedMenuHeightPx,
      getInventoryContextMenuClampRegion(),
    );

    setInventoryContextMenu({
      accelerator: itemAccelerator,
      itemText: String(item.text || t.dialogs.inventory.unknownItem),
      x: initialWithRegionClamp.x,
      y: initialWithRegionClamp.y,
      anchorCenterX,
      anchorLeftX,
      anchorBottomY,
      anchorRightX,
      anchorTopY,
    });
  };

  const runFpsCrosshairContextAction = (
    action: FpsCrosshairContextState["actions"][number],
  ): void => {
    // Workaround for a race condition in context-menu command submission.
    // TODO: remove once the underlying ordering issue is fixed.
    const contextualSubmitDelayMs = 0;
    const autoDirectionFromFpsAim =
      fpsCrosshairContext?.autoDirectionFromFpsAim === true;
    if (action.kind === "contextual") {
      controller?.runContextualAction(action.value);
      return;
    }
    if (action.kind === "quick") {
      controller?.runQuickAction(action.value, {
        autoDirectionFromFpsAim,
        submitDelayMs: contextualSubmitDelayMs,
      });
      return;
    }
    controller?.runExtendedCommand(action.value, {
      autoDirectionFromFpsAim,
      submitDelayMs: contextualSubmitDelayMs,
    });
  };

  useEffect(() => {
    if (!inventory.visible) {
      setInventoryContextMenu(null);
      setInventoryDropTypeMenuPosition(null);
      setInventoryDropCountDialog(null);
      cancelInventoryDropTypeHold();
      inventorySuppressDropActionClickRef.current = false;
    }
  }, [cancelInventoryDropTypeHold, inventory.visible]);

  useEffect(() => {
    if (inventoryContextMenu) {
      return;
    }
    setInventoryDropTypeMenuPosition(null);
    cancelInventoryDropTypeHold();
    inventorySuppressDropActionClickRef.current = false;
  }, [cancelInventoryDropTypeHold, inventoryContextMenu]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleCloseInventoryContextMenu = (): void => {
      closeInventoryContextMenu({ restoreItemFocus: true });
    };
    window.addEventListener(
      nh3dCloseInventoryContextMenuEventName,
      handleCloseInventoryContextMenu,
    );
    return () => {
      window.removeEventListener(
        nh3dCloseInventoryContextMenuEventName,
        handleCloseInventoryContextMenu,
      );
    };
  }, [closeInventoryContextMenu]);

  useEffect(() => {
    if (!inventory.visible) {
      return;
    }
    scheduleInventoryRowProximityUpdate();
  }, [
    inventory.visible,
    inventoryContextMenu,
    scheduleInventoryRowProximityUpdate,
  ]);

  useEffect(() => {
    if (inventory.visible) {
      scheduleInventoryRowProximityUpdate();
      return;
    }
    inventoryPointerActiveRef.current = false;
    inventoryPointerClientYRef.current = null;
    inventoryRowPressCandidateRef.current = null;
    inventoryRowHoverValueByIndexRef.current.clear();
    for (const rowElement of inventoryRowRefs.current.values()) {
      rowElement.style.setProperty("--nh3d-inv-hover", "0");
    }
  }, [inventory.items, inventory.visible, scheduleInventoryRowProximityUpdate]);

  useEffect(() => {
    if (!inventoryReducedMotionEnabled) {
      return;
    }
    inventoryRowPressCandidateRef.current = null;
    inventoryPointerActiveRef.current = false;
    inventoryPointerClientYRef.current = null;
    for (const rowElement of inventoryRowRefs.current.values()) {
      rowElement.style.setProperty("--nh3d-inv-hover", "0");
    }
  }, [inventoryReducedMotionEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleViewportResize = (): void => {
      if (!inventory.visible) {
        return;
      }
      scheduleInventoryRowProximityUpdate();
    };
    window.addEventListener("resize", handleViewportResize);
    return () => {
      window.removeEventListener("resize", handleViewportResize);
    };
  }, [inventory.visible, scheduleInventoryRowProximityUpdate]);

  useEffect(
    () => () => {
      if (typeof window === "undefined") {
        return;
      }
      clearInventoryTouchFallbackClearTimer();
      if (inventoryRowProximityAnimationFrameRef.current === null) {
        return;
      }
      window.cancelAnimationFrame(
        inventoryRowProximityAnimationFrameRef.current,
      );
      inventoryRowProximityAnimationFrameRef.current = null;
      inventoryRowHoverValueByIndexRef.current.clear();
    },
    [clearInventoryTouchFallbackClearTimer],
  );

  useEffect(
    () => () => {
      cancelInventoryDropTypeHold();
      inventorySuppressDropActionClickRef.current = false;
    },
    [cancelInventoryDropTypeHold],
  );

  useEffect(() => {
    if (inventoryContextActionsEnabled) {
      return;
    }
    setInventoryContextMenu(null);
    setInventoryDropTypeMenuPosition(null);
    setInventoryDropCountDialog(null);
    cancelInventoryDropTypeHold();
    inventorySuppressDropActionClickRef.current = false;
  }, [
    cancelInventoryDropTypeHold,
    inventoryContextActionsEnabled,
    setInventoryDropTypeMenuPosition,
  ]);

  useEffect(() => {
    if (!inventoryDropTypeMenuPosition) {
      return;
    }
    const hasDropAction = inventoryContextMenuActions.some(
      (action) => action.id === "drop",
    );
    if (!hasDropAction) {
      setInventoryDropTypeMenuPosition(null);
    }
  }, [inventoryContextMenuActions, inventoryDropTypeMenuPosition]);

  useEffect(() => {
    if (!inventoryDropTypeMenuPosition || typeof window === "undefined") {
      return;
    }
    const handleViewportResize = (): void => {
      openInventoryDropTypeMenu();
    };
    window.addEventListener("resize", handleViewportResize);
    return () => {
      window.removeEventListener("resize", handleViewportResize);
    };
  }, [inventoryDropTypeMenuPosition, openInventoryDropTypeMenu]);

  useEffect(() => {
    if (!inventoryDropCountDialog || typeof window === "undefined") {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      inventoryDropCountSliderRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [inventoryDropCountDialog]);

  useEffect(() => {
    if (
      !inventory.visible ||
      loadingOverlayVisible ||
      typeof window === "undefined"
    ) {
      inventoryKeyboardActivationKeysDownRef.current.clear();
      return;
    }

    const handleKeyUp = (event: KeyboardEvent): void => {
      const normalizedKey = normalizeInventoryActivationKey(event.key);
      if (!normalizedKey) {
        return;
      }
      inventoryKeyboardActivationKeysDownRef.current.delete(normalizedKey);
    };

    const handleWindowBlur = (): void => {
      inventoryKeyboardActivationKeysDownRef.current.clear();
    };

    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleWindowBlur);
      inventoryKeyboardActivationKeysDownRef.current.clear();
    };
  }, [
    inventory.visible,
    loadingOverlayVisible,
    normalizeInventoryActivationKey,
  ]);

  useEffect(() => {
    if (!newGamePrompt.visible) {
      return;
    }
    setReopenNewGamePromptOnInteraction(false);
    if (
      typeof newGamePrompt.reason === "string" &&
      newGamePrompt.reason.trim().length > 0
    ) {
      setDeferredNewGamePromptReason(newGamePrompt.reason.trim());
    }
  }, [newGamePrompt.reason, newGamePrompt.visible]);

  useEffect(() => {
    if (!gameOver.active || !gameOver.promptReady) {
      return;
    }
    if (
      newGamePrompt.visible ||
      reopenNewGamePromptOnInteraction ||
      loadingOverlayVisible
    ) {
      return;
    }
    if (
      question ||
      infoMenu ||
      textInputRequest ||
      directionQuestion ||
      inventory.visible
    ) {
      return;
    }
    setNewGamePrompt({
      visible: true,
      reason:
        typeof gameOver.deathMessage === "string" &&
        gameOver.deathMessage.trim()
          ? gameOver.deathMessage.trim()
          : t.dialogs.newGamePrompt.reasonFallback,
    });
  }, [
    directionQuestion,
    gameOver.active,
    gameOver.deathMessage,
    gameOver.promptReady,
    infoMenu,
    inventory.visible,
    loadingOverlayVisible,
    newGamePrompt.visible,
    question,
    reopenNewGamePromptOnInteraction,
    setNewGamePrompt,
    textInputRequest,
  ]);

  useEffect(() => {
    if (
      !reopenNewGamePromptOnInteraction ||
      newGamePrompt.visible ||
      loadingOverlayVisible ||
      typeof window === "undefined"
    ) {
      return;
    }
    let handled = false;
    const tapMaxDurationMs = 250;
    const tapMaxMovePx = 12;
    let activeTouchId: number | null = null;
    let touchStartedAtMs = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchTapEligible = false;
    let multiTouchGestureSeen = false;
    const handleFirstInteraction = (): void => {
      if (handled) {
        return;
      }
      handled = true;
      restoreDeferredNewGamePrompt();
    };

    const handleInteractionMouseDown = (event: MouseEvent): void => {
      if (event.button !== 0) {
        return;
      }
      handleFirstInteraction();
    };

    const handleInteractionTouchStart = (event: TouchEvent): void => {
      if (event.touches.length !== 1 || event.changedTouches.length < 1) {
        multiTouchGestureSeen = true;
        touchTapEligible = false;
        activeTouchId = null;
        return;
      }
      const touch = event.changedTouches[0];
      activeTouchId = touch.identifier;
      touchStartedAtMs = performance.now();
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchTapEligible = true;
      multiTouchGestureSeen = false;
    };

    const handleInteractionTouchMove = (event: TouchEvent): void => {
      if (event.touches.length !== 1 || activeTouchId === null) {
        multiTouchGestureSeen = true;
        touchTapEligible = false;
        return;
      }
      const activeTouch = Array.from(event.touches).find(
        (touch) => touch.identifier === activeTouchId,
      );
      if (!activeTouch) {
        touchTapEligible = false;
        return;
      }
      if (
        Math.hypot(
          activeTouch.clientX - touchStartX,
          activeTouch.clientY - touchStartY,
        ) > tapMaxMovePx
      ) {
        touchTapEligible = false;
      }
    };

    const resetInteractionTouchState = (): void => {
      activeTouchId = null;
      touchTapEligible = false;
      multiTouchGestureSeen = false;
      touchStartedAtMs = 0;
    };

    const handleInteractionTouchEnd = (event: TouchEvent): void => {
      if (activeTouchId === null || multiTouchGestureSeen || !touchTapEligible) {
        resetInteractionTouchState();
        return;
      }
      const endedTouch = Array.from(event.changedTouches).find(
        (touch) => touch.identifier === activeTouchId,
      );
      if (!endedTouch) {
        return;
      }
      const tapDurationMs = performance.now() - touchStartedAtMs;
      const tapDistancePx = Math.hypot(
        endedTouch.clientX - touchStartX,
        endedTouch.clientY - touchStartY,
      );
      const shouldHandleTap =
        event.touches.length === 0 &&
        tapDurationMs <= tapMaxDurationMs &&
        tapDistancePx <= tapMaxMovePx;
      resetInteractionTouchState();
      if (shouldHandleTap) {
        handleFirstInteraction();
      }
    };

    const handleInteractionKey = (event: KeyboardEvent): void => {
      if (
        event.key !== "Enter" &&
        event.key !== "NumpadEnter" &&
        event.key !== " " &&
        event.key !== "Space" &&
        event.key !== "Spacebar"
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handleFirstInteraction();
    };

    window.addEventListener("mousedown", handleInteractionMouseDown, true);
    window.addEventListener("touchstart", handleInteractionTouchStart, true);
    window.addEventListener("touchmove", handleInteractionTouchMove, true);
    window.addEventListener("touchend", handleInteractionTouchEnd, true);
    window.addEventListener("touchcancel", resetInteractionTouchState, true);
    window.addEventListener("keydown", handleInteractionKey, true);
    return () => {
      window.removeEventListener(
        "mousedown",
        handleInteractionMouseDown,
        true,
      );
      window.removeEventListener(
        "touchstart",
        handleInteractionTouchStart,
        true,
      );
      window.removeEventListener("touchmove", handleInteractionTouchMove, true);
      window.removeEventListener("touchend", handleInteractionTouchEnd, true);
      window.removeEventListener(
        "touchcancel",
        resetInteractionTouchState,
        true,
      );
      window.removeEventListener("keydown", handleInteractionKey, true);
    };
  }, [
    newGamePrompt.visible,
    reopenNewGamePromptOnInteraction,
    restoreDeferredNewGamePrompt,
    loadingOverlayVisible,
  ]);

  useEffect(() => {
    if (!inventoryContextMenu || loadingOverlayVisible) {
      return;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      const insideContextMenu = Boolean(
        target && inventoryContextMenuRef.current?.contains(target),
      );
      const insideDropTypeMenu = Boolean(
        target && inventoryDropTypeMenuRef.current?.contains(target),
      );
      if (inventoryDropTypeMenuPosition && !insideDropTypeMenu) {
        closeInventoryDropTypeMenu();
        inventorySuppressDropActionClickRef.current = false;
        cancelInventoryDropTypeHold();
        if (insideContextMenu) {
          return;
        }
      }
      if (insideContextMenu || insideDropTypeMenu) {
        return;
      }
      setInventoryDropTypeMenuPosition(null);
      setInventoryContextMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        if (inventoryDropTypeMenuPosition) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          closeInventoryDropTypeMenu();
          inventorySuppressDropActionClickRef.current = false;
          cancelInventoryDropTypeHold();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        closeInventoryContextMenu({ restoreItemFocus: true });
      }
    };

    const handleViewportResize = (): void => {
      setInventoryContextMenu((previous) => {
        if (!previous) {
          return previous;
        }
        const menuElement = inventoryContextMenuRef.current;
        const rect = menuElement?.getBoundingClientRect();
        const clamped = resolveInventoryContextMenuPosition(
          previous,
          rect?.width ?? 220,
          rect?.height ?? 260,
          getInventoryContextMenuClampRegion(),
        );
        if (clamped.x === previous.x && clamped.y === previous.y) {
          return previous;
        }
        return {
          ...previous,
          x: clamped.x,
          y: clamped.y,
        };
      });
    };

    window.addEventListener("mousedown", handlePointerDown, true);
    window.addEventListener("contextmenu", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", handleViewportResize);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown, true);
      window.removeEventListener("contextmenu", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", handleViewportResize);
    };
  }, [
    cancelInventoryDropTypeHold,
    closeInventoryContextMenu,
    closeInventoryDropTypeMenu,
    getInventoryContextMenuClampRegion,
    inventoryContextMenu,
    inventoryDropTypeMenuPosition,
    loadingOverlayVisible,
  ]);

  useLayoutEffect(() => {
    if (!inventoryContextMenu) {
      return;
    }

    const menuElement = inventoryContextMenuRef.current;
    if (!menuElement) {
      return;
    }

    const rect = menuElement.getBoundingClientRect();
    const clamped = resolveInventoryContextMenuPosition(
      inventoryContextMenu,
      rect.width,
      rect.height,
      getInventoryContextMenuClampRegion(),
    );
    if (
      clamped.x === inventoryContextMenu.x &&
      clamped.y === inventoryContextMenu.y
    ) {
      return;
    }

    setInventoryContextMenu((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        x: clamped.x,
        y: clamped.y,
      };
    });
  }, [getInventoryContextMenuClampRegion, inventoryContextMenu]);

  useLayoutEffect(() => {
    if (!inventoryDropTypeMenuPosition) {
      return;
    }
    const menuElement = inventoryDropTypeMenuRef.current;
    const anchorElement = inventoryDropActionButtonRef.current;
    if (!menuElement || !anchorElement) {
      return;
    }
    const menuRect = menuElement.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();
    const clamped = resolveInventoryDropTypeMenuPosition(
      anchorRect,
      menuRect.width,
      menuRect.height,
    );
    if (
      Math.abs(clamped.x - inventoryDropTypeMenuPosition.x) < 0.02 &&
      Math.abs(clamped.y - inventoryDropTypeMenuPosition.y) < 0.02
    ) {
      return;
    }
    setInventoryDropTypeMenuPosition(clamped);
  }, [
    inventoryContextMenu?.x,
    inventoryContextMenu?.y,
    inventoryDropTypeMenuPosition,
  ]);

  useLayoutEffect(() => {
    if (!fpsCrosshairContext) {
      setTileContextMenuPosition(null);
      return;
    }
    const anchorX = fpsCrosshairContext.anchorClientX;
    const anchorY = fpsCrosshairContext.anchorClientY;
    if (
      typeof anchorX !== "number" ||
      typeof anchorY !== "number" ||
      !Number.isFinite(anchorX) ||
      !Number.isFinite(anchorY)
    ) {
      setTileContextMenuPosition(null);
      return;
    }

    const menuElement = fpsCrosshairContextMenuRef.current;
    const rect = menuElement?.getBoundingClientRect();
    const width = rect?.width ?? 260;
    const height = rect?.height ?? 220;
    const unclampedX = anchorX - width / 2;
    const unclampedY = anchorY - height - tileContextMenuAnchorOffsetY;
    const clamped = clampTileContextMenuPosition(
      unclampedX,
      unclampedY,
      width,
      height,
    );
    setTileContextMenuPosition((previous) => {
      if (previous && previous.x === clamped.x && previous.y === clamped.y) {
        return previous;
      }
      return clamped;
    });
  }, [
    fpsCrosshairContext,
    fpsCrosshairContext?.anchorClientX,
    fpsCrosshairContext?.anchorClientY,
  ]);

  useEffect(() => {
    if (!fpsCrosshairContext || loadingOverlayVisible) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null;
      if (target && fpsCrosshairContextMenuRef.current?.contains(target)) {
        return;
      }
      controller?.dismissFpsCrosshairContextMenu();
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        controller?.dismissFpsCrosshairContextMenu();
      }
    };

    const handleViewportResize = (): void => {
      const menuElement = fpsCrosshairContextMenuRef.current;
      const rect = menuElement?.getBoundingClientRect();
      const width = rect?.width ?? 260;
      const height = rect?.height ?? 220;
      const anchorX =
        typeof fpsCrosshairContext.anchorClientX === "number"
          ? fpsCrosshairContext.anchorClientX
          : window.innerWidth * 0.5;
      const anchorY =
        typeof fpsCrosshairContext.anchorClientY === "number"
          ? fpsCrosshairContext.anchorClientY
          : window.innerHeight * 0.5;
      const clamped = clampTileContextMenuPosition(
        anchorX - width / 2,
        anchorY - height - tileContextMenuAnchorOffsetY,
        width,
        height,
      );
      setTileContextMenuPosition((previous) => {
        if (previous && previous.x === clamped.x && previous.y === clamped.y) {
          return previous;
        }
        return clamped;
      });
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", handleViewportResize);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", handleViewportResize);
    };
  }, [controller, fpsCrosshairContext, loadingOverlayVisible]);

  useEffect(() => {
    if (loadingOverlayVisible || typeof window === "undefined") {
      return;
    }

    const handleEscapeForClientOptions = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (toggleDeferredGameOverTombstoneUi()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }
      if (inventoryDropCountDialog) {
        event.preventDefault();
        event.stopPropagation();
        closeInventoryDropCountModal();
        return;
      }
      if (isControllerSupportPromptVisible) {
        event.preventDefault();
        event.stopPropagation();
        confirmControllerSupportPromptChoice(false);
        return;
      }

      if (isPauseMenuVisible) {
        event.preventDefault();
        event.stopPropagation();
        if (isExitConfirmationVisible) {
          setIsExitConfirmationVisible(false);
        } else {
          setIsPauseMenuVisible(false);
        }
        return;
      }

      if (isClientOptionsVisible) {
        event.preventDefault();
        event.stopPropagation();
        if (controllerRemapListening) {
          clearControllerBindingCapture();
          return;
        }
        if (isControllerRemapVisible) {
          closeControllerRemapDialog();
          return;
        }
        if (isResetClientOptionsConfirmationVisible) {
          setIsResetClientOptionsConfirmationVisible(false);
          return;
        }
        if (isTilesetManagerVisible) {
          closeTilesetManager();
          return;
        }
        if (isDarkWallTilePickerVisible) {
          setIsDarkWallTilePickerVisible(false);
          return;
        }
        if (isTilesetBackgroundTilePickerVisible) {
          setIsTilesetBackgroundTilePickerVisible(false);
          return;
        }
        if (isTilesetSolidColorPickerVisible) {
          setIsTilesetSolidColorPickerVisible(false);
          return;
        }
        requestCloseClientOptionsDialog();
        return;
      }

      if (positionInputActive) {
        return;
      }

      if ((!isDesktopGameRunning && !isMobileGameRunning) || hasGameplayOverlayOpen) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openPauseMenu();
    };

    window.addEventListener("keydown", handleEscapeForClientOptions, true);
    return () => {
      window.removeEventListener("keydown", handleEscapeForClientOptions, true);
    };
  }, [
    clientOptions,
    clearControllerBindingCapture,
    closeControllerRemapDialog,
    closeInventoryDropCountModal,
    confirmControllerSupportPromptChoice,
    controller,
    controllerRemapListening,
    hasGameplayOverlayOpen,
    isClientOptionsVisible,
    inventoryDropCountDialog,
    positionInputActive,
    isControllerSupportPromptVisible,
    isControllerRemapVisible,
    isDarkWallTilePickerVisible,
    isTilesetBackgroundTilePickerVisible,
    isTilesetSolidColorPickerVisible,
    isTilesetManagerVisible,
    isResetClientOptionsConfirmationVisible,
    isPauseMenuVisible,
    isExitConfirmationVisible,
    isDesktopGameRunning,
    isMobileGameRunning,
    loadingOverlayVisible,
    openPauseMenu,
    toggleDeferredGameOverTombstoneUi,
  ]);

  const clearStartupControllerCursorHighlight = useCallback((): void => {
    const highlightedElement =
      startupControllerCursorHighlightElementRef.current;
    if (highlightedElement) {
      highlightedElement.classList.remove("nh3d-controller-hover-target");
      startupControllerCursorHighlightElementRef.current = null;
    }
  }, []);

  const ensureStartupControllerCursorOverlay = useCallback((): void => {
    if (
      startupControllerCursorElementRef.current &&
      startupControllerCursorPulseElementRef.current
    ) {
      return;
    }
    const cursor = document.createElement("div");
    cursor.className =
      "nh3d-controller-virtual-cursor nh3d-controller-virtual-cursor-app";
    cursor.setAttribute("aria-hidden", "true");
    cursor.style.display = "none";
    const pulse = document.createElement("div");
    pulse.className =
      "nh3d-controller-virtual-cursor-pulse nh3d-controller-virtual-cursor-pulse-app";
    pulse.setAttribute("aria-hidden", "true");
    pulse.style.display = "none";
    document.body.appendChild(cursor);
    document.body.appendChild(pulse);
    startupControllerCursorElementRef.current = cursor;
    startupControllerCursorPulseElementRef.current = pulse;
  }, []);

  const setStartupControllerCursorVisible = useCallback(
    (visible: boolean): void => {
      ensureStartupControllerCursorOverlay();
      startupControllerCursorVisibleRef.current = visible;
      const cursor = startupControllerCursorElementRef.current;
      if (cursor) {
        cursor.style.display = visible ? "block" : "none";
      }
      if (!visible) {
        clearStartupControllerCursorHighlight();
      }
    },
    [
      clearStartupControllerCursorHighlight,
      ensureStartupControllerCursorOverlay,
    ],
  );

  const updateStartupControllerCursorHighlightAtPoint = useCallback(
    (clientX: number, clientY: number): void => {
      const target = document.elementFromPoint(clientX, clientY);
      const highlightedCandidate =
        target instanceof HTMLElement
          ? ((target.closest(
              "button, summary, [role='button'], a, input:not([tabindex='-1']), select, textarea, label, [tabindex]",
            ) as HTMLElement | null) ?? target)
          : null;
      const previousHighlight =
        startupControllerCursorHighlightElementRef.current;
      if (previousHighlight && previousHighlight !== highlightedCandidate) {
        previousHighlight.classList.remove("nh3d-controller-hover-target");
        startupControllerCursorHighlightElementRef.current = null;
      }
      if (
        highlightedCandidate &&
        highlightedCandidate !== previousHighlight &&
        highlightedCandidate.isConnected
      ) {
        highlightedCandidate.classList.add("nh3d-controller-hover-target");
        startupControllerCursorHighlightElementRef.current =
          highlightedCandidate;
      }
    },
    [],
  );

  const setStartupControllerCursorPosition = useCallback(
    (clientX: number, clientY: number): void => {
      ensureStartupControllerCursorOverlay();
      const clampedX = Math.max(0, Math.min(window.innerWidth, clientX));
      const clampedY = Math.max(0, Math.min(window.innerHeight, clientY));
      startupControllerCursorXRef.current = clampedX;
      startupControllerCursorYRef.current = clampedY;
      const cursor = startupControllerCursorElementRef.current;
      if (cursor) {
        cursor.style.left = `${Math.round(clampedX)}px`;
        cursor.style.top = `${Math.round(clampedY)}px`;
      }
      if (startupControllerCursorVisibleRef.current) {
        updateStartupControllerCursorHighlightAtPoint(clampedX, clampedY);
      }
    },
    [
      ensureStartupControllerCursorOverlay,
      updateStartupControllerCursorHighlightAtPoint,
    ],
  );

  const ensureStartupControllerCursorSeedPosition = useCallback((): void => {
    if (
      Number.isFinite(startupControllerCursorXRef.current) &&
      Number.isFinite(startupControllerCursorYRef.current)
    ) {
      return;
    }
    const topDialog = getTopVisibleControllerDialogElement();
    if (topDialog) {
      const rect = topDialog.getBoundingClientRect();
      setStartupControllerCursorPosition(
        rect.left + rect.width * 0.5,
        rect.top + rect.height * 0.5,
      );
      return;
    }
    setStartupControllerCursorPosition(
      window.innerWidth * 0.5,
      window.innerHeight * 0.5,
    );
  }, [setStartupControllerCursorPosition]);

  const pulseStartupControllerCursor = useCallback((): void => {
    const pulse = startupControllerCursorPulseElementRef.current;
    const x = startupControllerCursorXRef.current;
    const y = startupControllerCursorYRef.current;
    if (!pulse || !Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    pulse.style.left = `${Math.round(x)}px`;
    pulse.style.top = `${Math.round(y)}px`;
    pulse.style.display = "block";
    pulse.classList.remove("is-active");
    void pulse.offsetWidth;
    pulse.classList.add("is-active");
    if (startupControllerCursorPulseTimerRef.current !== null) {
      window.clearTimeout(startupControllerCursorPulseTimerRef.current);
      startupControllerCursorPulseTimerRef.current = null;
    }
    startupControllerCursorPulseTimerRef.current = window.setTimeout(() => {
      pulse.classList.remove("is-active");
      pulse.style.display = "none";
      startupControllerCursorPulseTimerRef.current = null;
    }, 260);
  }, []);

  const resetStartupControllerCursor = useCallback((): void => {
    startupControllerCursorVisibleRef.current = false;
    if (startupControllerCursorElementRef.current) {
      startupControllerCursorElementRef.current.style.display = "none";
    }
    if (startupControllerCursorPulseTimerRef.current !== null) {
      window.clearTimeout(startupControllerCursorPulseTimerRef.current);
      startupControllerCursorPulseTimerRef.current = null;
    }
    if (startupControllerCursorPulseElementRef.current) {
      startupControllerCursorPulseElementRef.current.classList.remove(
        "is-active",
      );
      startupControllerCursorPulseElementRef.current.style.display = "none";
    }
    clearStartupControllerCursorHighlight();
  }, [clearStartupControllerCursorHighlight]);

  const clearStartupControllerActiveSliderVisual = useCallback((): void => {
    const previousSlider = startupControllerActiveSliderElementRef.current;
    if (previousSlider && previousSlider.isConnected) {
      previousSlider.classList.remove("nh3d-controller-slider-active");
    }
    startupControllerActiveSliderElementRef.current = null;
  }, []);

  const setStartupControllerActiveSliderVisual = useCallback(
    (slider: HTMLInputElement | null): void => {
      const previousSlider = startupControllerActiveSliderElementRef.current;
      if (
        previousSlider &&
        previousSlider !== slider &&
        previousSlider.isConnected
      ) {
        previousSlider.classList.remove("nh3d-controller-slider-active");
      }
      startupControllerActiveSliderElementRef.current = slider;
      if (slider && slider.isConnected) {
        slider.classList.add("nh3d-controller-slider-active");
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const startupControllerContextActive =
      startupMenuVisible && !loadingOverlayVisible;
    if (!startupControllerContextActive) {
      startupControllerPreviousActionActiveRef.current = {};
      startupAccordionConfirmReleaseLatchRef.current = false;
      startupControllerSliderInteractionActiveRef.current = false;
      startupControllerSliderStepCarryRef.current = 0;
      clearStartupControllerActiveSliderVisual();
      resetStartupControllerCursor();
      return;
    }

    ensureStartupControllerCursorOverlay();
    let frameHandle = 0;
    let lastFrameAtMs = performance.now();

    const tick = (nowMs: number): void => {
      const deltaSeconds = Math.max(
        0,
        Math.min(0.2, (nowMs - lastFrameAtMs) / 1000),
      );
      lastFrameAtMs = nowMs;

      const sourceOptions = isClientOptionsVisible
        ? clientOptionsDraft
        : clientOptions;
      const controllerSupportEnabled =
        sourceOptions.controllerEnabled === true ||
        isControllerSupportPromptVisible;
      if (!controllerSupportEnabled) {
        startupControllerPreviousActionActiveRef.current = {};
        startupAccordionConfirmReleaseLatchRef.current = false;
        startupControllerSliderInteractionActiveRef.current = false;
        startupControllerSliderStepCarryRef.current = 0;
        clearStartupControllerActiveSliderVisual();
        resetStartupControllerCursor();
        frameHandle = window.requestAnimationFrame(tick);
        return;
      }

      const bindings = normalizeNh3dControllerBindings(
        sourceOptions.controllerBindings,
      );
      const gamepads = getConnectedGamepadsForCapture();
      const previousActionActive =
        startupControllerPreviousActionActiveRef.current;
      const nextActionActive: Partial<Record<Nh3dControllerActionId, boolean>> =
        {};
      const actionPressed: Partial<Record<Nh3dControllerActionId, boolean>> =
        {};
      const actionValues: Partial<Record<Nh3dControllerActionId, number>> = {};

      for (const actionId of startupControllerNavActionIds) {
        const value = getControllerActionValueFromGamepads(
          actionId,
          bindings,
          gamepads,
        );
        actionValues[actionId] = value;
        const isActive = value >= startupControllerActionThreshold;
        const wasActive = previousActionActive[actionId] === true;
        actionPressed[actionId] = isActive && !wasActive;
        nextActionActive[actionId] = isActive;
      }
      startupControllerPreviousActionActiveRef.current = nextActionActive;

      if (controllerRemapListening) {
        startupControllerSliderInteractionActiveRef.current = false;
        startupControllerSliderStepCarryRef.current = 0;
        clearStartupControllerActiveSliderVisual();
        if (actionPressed.cancel_or_context) {
          clearControllerBindingCapture();
        }
        frameHandle = window.requestAnimationFrame(tick);
        return;
      }

      const topDialog = getTopVisibleControllerDialogElement();
      const focusedSlider = getFocusedControllerRangeInput(topDialog);
      if (!focusedSlider) {
        startupControllerSliderInteractionActiveRef.current = false;
        startupControllerSliderStepCarryRef.current = 0;
        clearStartupControllerActiveSliderVisual();
      }

      if (
        focusedSlider &&
        actionPressed.confirm &&
        !startupControllerSliderInteractionActiveRef.current &&
        !startupAccordionConfirmReleaseLatchRef.current
      ) {
        startupControllerSliderInteractionActiveRef.current = true;
        startupControllerSliderStepCarryRef.current = 0;
        startupAccordionConfirmReleaseLatchRef.current = true;
        setStartupControllerActiveSliderVisual(focusedSlider);
        setStartupControllerCursorVisible(false);
        frameHandle = window.requestAnimationFrame(tick);
        return;
      }

      if (startupControllerSliderInteractionActiveRef.current) {
        if (!focusedSlider) {
          startupControllerSliderInteractionActiveRef.current = false;
          startupControllerSliderStepCarryRef.current = 0;
          clearStartupControllerActiveSliderVisual();
        } else {
          setStartupControllerActiveSliderVisual(focusedSlider);
          if (actionPressed.cancel_or_context) {
            startupControllerSliderInteractionActiveRef.current = false;
            startupControllerSliderStepCarryRef.current = 0;
            clearStartupControllerActiveSliderVisual();
            frameHandle = window.requestAnimationFrame(tick);
            return;
          }

          const dpadStepDirection = actionPressed.dpad_right
            ? 1
            : actionPressed.dpad_left
              ? -1
              : 0;
          if (dpadStepDirection !== 0) {
            stepControllerRangeInput(focusedSlider, dpadStepDirection);
          }

          const sliderAxisX =
            (actionValues.left_stick_right ?? 0) -
            (actionValues.left_stick_left ?? 0);
          if (Math.abs(sliderAxisX) > startupControllerCursorDeadzone) {
            const nextStepCarry =
              startupControllerSliderStepCarryRef.current +
              sliderAxisX *
                startupControllerSliderFastStepsPerSec *
                deltaSeconds;
            const fastStepCount =
              nextStepCarry > 0
                ? Math.floor(nextStepCarry)
                : Math.ceil(nextStepCarry);
            startupControllerSliderStepCarryRef.current =
              nextStepCarry - fastStepCount;
            if (fastStepCount !== 0) {
              stepControllerRangeInput(focusedSlider, fastStepCount);
            }
          } else {
            startupControllerSliderStepCarryRef.current = 0;
          }

          frameHandle = window.requestAnimationFrame(tick);
          return;
        }
      }

      let focusDirection: "up" | "down" | "left" | "right" | null = null;
      if (actionPressed.dpad_up) {
        focusDirection = "up";
      } else if (actionPressed.dpad_down) {
        focusDirection = "down";
      } else if (actionPressed.dpad_left) {
        focusDirection = "left";
      } else if (actionPressed.dpad_right) {
        focusDirection = "right";
      }
      if (focusDirection) {
        setStartupControllerCursorVisible(false);
        applyDialogDirectionalNavigation(focusDirection, topDialog, {
          focusedSlider,
        });
      }

      const leftAxisX =
        (actionValues.left_stick_right ?? 0) -
        (actionValues.left_stick_left ?? 0);
      const leftAxisY =
        (actionValues.left_stick_down ?? 0) - (actionValues.left_stick_up ?? 0);
      const leftAxisMagnitude = Math.hypot(leftAxisX, leftAxisY);
      if (leftAxisMagnitude > startupControllerCursorDeadzone) {
        ensureStartupControllerCursorSeedPosition();
        setStartupControllerCursorVisible(true);
        const nextCursorX =
          startupControllerCursorXRef.current +
          leftAxisX * startupControllerCursorSpeedPxPerSec * deltaSeconds;
        const nextCursorY =
          startupControllerCursorYRef.current +
          leftAxisY * startupControllerCursorSpeedPxPerSec * deltaSeconds;
        setStartupControllerCursorPosition(nextCursorX, nextCursorY);
      }

      const scrollAxisY =
        (actionValues.right_stick_down ?? 0) -
        (actionValues.right_stick_up ?? 0);
      if (Math.abs(scrollAxisY) > 0.02) {
        const scrollElement = findControllerScrollableElement(topDialog);
        if (scrollElement) {
          scrollElement.scrollTop +=
            scrollAxisY * startupControllerScrollSpeedPxPerSec * deltaSeconds;
        }
      }

      const confirmValue = actionValues.confirm ?? 0;
      if (confirmValue <= 0.12) {
        startupAccordionConfirmReleaseLatchRef.current = false;
      }

      if (
        actionPressed.confirm &&
        !controllerRemapListening &&
        !startupAccordionConfirmReleaseLatchRef.current
      ) {
        let confirmConsumed = false;
        const clickedElement =
          startupControllerCursorVisibleRef.current &&
          Number.isFinite(startupControllerCursorXRef.current) &&
          Number.isFinite(startupControllerCursorYRef.current)
            ? clickControllerDialogElementAtPoint(
                startupControllerCursorXRef.current,
                startupControllerCursorYRef.current,
              )
            : null;
        if (clickedElement) {
          pulseStartupControllerCursor();
          confirmConsumed = true;
        } else {
          const focusedClickElement = clickFocusedControllerDialogElement();
          if (focusedClickElement) {
            confirmConsumed = true;
          }
        }
        if (confirmConsumed) {
          startupAccordionConfirmReleaseLatchRef.current = true;
        }
      }

      if (actionPressed.cancel_or_context) {
        if (isControllerSupportPromptVisible) {
          confirmControllerSupportPromptChoice(false);
        } else if (controllerRemapListening) {
          clearControllerBindingCapture();
        } else if (isControllerRemapVisible) {
          closeControllerRemapDialog();
        } else if (isClientOptionsVisible) {
          requestCloseClientOptionsDialog();
        } else if (startupFlowStep === "choose") {
          setStartupFlowStep("variant");
        } else if (startupFlowStep !== "variant") {
          setStartupFlowStep("choose");
        }
      }

      frameHandle = window.requestAnimationFrame(tick);
    };

    frameHandle = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameHandle);
      startupControllerPreviousActionActiveRef.current = {};
      startupAccordionConfirmReleaseLatchRef.current = false;
      startupControllerSliderInteractionActiveRef.current = false;
      startupControllerSliderStepCarryRef.current = 0;
      clearStartupControllerActiveSliderVisual();
      resetStartupControllerCursor();
    };
  }, [
    applyDialogDirectionalNavigation,
    characterCreationConfig,
    clearStartupControllerActiveSliderVisual,
    clearControllerBindingCapture,
    clientOptions,
    clientOptionsDraft,
    closeControllerRemapDialog,
    confirmControllerSupportPromptChoice,
    controllerRemapListening,
    ensureStartupControllerCursorOverlay,
    ensureStartupControllerCursorSeedPosition,
    isClientOptionsVisible,
    isControllerSupportPromptVisible,
    isControllerRemapVisible,
    pulseStartupControllerCursor,
    resetStartupControllerCursor,
    requestCloseClientOptionsDialog,
    setStartupControllerActiveSliderVisual,
    setStartupControllerCursorPosition,
    setStartupControllerCursorVisible,
    startup,
    startupFlowStep,
    loadingOverlayVisible,
  ]);

  const renderPauseMenu = () => {
    return (
      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions"
        open={isPauseMenuVisible}
        id="pause-menu-dialog"
      >
        {isExitConfirmationVisible ? (
          <>
            <div className="nh3d-question-text">
              {t.dialogs.pauseMenu.saveBeforeQuit}
            </div>
            <div className="nh3d-menu-actions">
              <button
                className="nh3d-menu-action-button nh3d-menu-action-confirm"
                onClick={() => {
                  controller?.sendInput("S");
                  setIsPauseMenuVisible(false);
                  setIsExitConfirmationVisible(false);
                }}
                type="button"
              >
                {commonStrings.yes}
              </button>
              <button
                className="nh3d-menu-action-button"
                onClick={() => {
                  startNewGameFromPrompt();
                }}
                type="button"
              >
                {commonStrings.no}
              </button>
              <button
                className="nh3d-menu-action-button nh3d-menu-action-cancel"
                onClick={() => setIsExitConfirmationVisible(false)}
                type="button"
              >
                {commonStrings.cancel}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="nh3d-options-title nh3d-pause-menu-title">
              <RuntimeVersionBadge label={activeRuntimeVersionLabel} />
              <span
                className="nh3d-pause-menu-title-separator"
                aria-hidden="true"
              >
                {"\u2014"}
              </span>
              <span className="nh3d-pause-menu-title-text">
                {t.dialogs.pauseMenu.title}
              </span>
            </div>
            <div className="nh3d-overflow-glow-frame">
              <div
                className="nh3d-choice-list"
                data-nh3d-overflow-glow
                data-nh3d-overflow-glow-host="parent"
              >
                <button
                  className="nh3d-choice-button"
                  onClick={() => setIsPauseMenuVisible(false)}
                  type="button"
                >
                  {t.dialogs.pauseMenu.resume}
                </button>
                <button
                  className="nh3d-choice-button"
                  onClick={openClientOptionsDialog}
                  type="button"
                >
                  {t.dialogs.pauseMenu.options}
                </button>
                <button
                  className="nh3d-choice-button"
                  onClick={() => {
                    controller?.sendInput("S");
                    setIsPauseMenuVisible(false);
                  }}
                  type="button"
                >
                  {t.dialogs.pauseMenu.saveGame}
                </button>
                <button
                  className="nh3d-choice-button"
                  onClick={() => setIsExitConfirmationVisible(true)}
                  type="button"
                >
                  {t.dialogs.pauseMenu.exitToMainMenu}
                </button>
                <button
                  className="nh3d-choice-button"
                  onClick={() => {
                    void requestGameQuit();
                  }}
                  type="button"
                >
                  {t.dialogs.pauseMenu.quitGame}
                </button>
              </div>
            </div>
          </>
        )}
      </AnimatedDialog>
    );
  };

  const gameMessageLog = clientOptions.liveMessageLog ? (
    <div
      className="nh3d-message-log-scroll"
      data-nh3d-overflow-glow
      data-nh3d-overflow-glow-host="parent"
      id="game-log"
    >
      {mobileTouchUiVisible && isMobileLogVisible
        ? renderMobileDialogCloseButton(
            () => setIsMobileLogVisible(false),
            t.dialogs.mobileActions.closeMessageLog,
          )
        : null}
      {gameMessages.map((message, index) => (
        <div key={`${index}-${message}`}>{message}</div>
      ))}
    </div>
  ) : null;

  return (
    <>
      <div className="nh3d-canvas-root" ref={canvasRootRef} />
      {renderPauseMenu()}
      {startupMenuVisible ? (
        <>
          <div aria-hidden="true" className="nh3d-startup-background-rain">
            <div className="nh3d-startup-background-rain-field">
              {startupMenuRainParticles.map((particle, index) => (
                <span
                  className="nh3d-startup-background-rain-glyph"
                  key={index}
                  style={{
                    left: `${particle.leftPercent}%`,
                    opacity: particle.opacity,
                    fontSize: `${particle.fontSizePx}px`,
                    filter:
                      particle.blurPx > 0
                        ? `blur(${particle.blurPx}px)`
                        : undefined,
                    animationDelay: `${particle.delayMs}ms`,
                    animationDuration: `${particle.durationMs}ms`,
                  }}
                >
                  {particle.glyphFrames.map((glyphFrame, glyphIndex) => (
                    <span
                      className="nh3d-startup-background-rain-glyph-frame"
                      key={glyphIndex}
                      style={{
                        animationDelay: `${glyphFrame.delayMs}ms`,
                        animationDuration: `${glyphFrame.durationMs}ms`,
                      }}
                    >
                      {glyphFrame.char}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
          <button
            aria-label={t.debugLogs.buildLabelAria(
              nh3dBuildLabel,
              startupBuildLabelClickCount,
              nh3dBuildLabelDebugEnableClickCount,
            )}
            className="nh3d-startup-build-label"
            onClick={handleStartupBuildLabelClick}
            type="button"
          >
            {nh3dBuildLabel}
          </button>
          {startupBuildLabelToastVisible ? (
            <div aria-live="polite" className="nh3d-startup-build-label-toast">
              {t.debugLogs.enabledToast}
            </div>
          ) : null}
          {isDebugSessionLogsLinkVisible ? (
            <button
              className={`nh3d-startup-build-label-link${
                startupBuildLabelToastVisible ? " is-offset" : ""
              }`}
              onClick={openDebugSessionLogsDialog}
              type="button"
            >
              {t.debugLogs.openLink}
            </button>
          ) : null}
        </>
      ) : null}
      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-text nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-debug-log-dialog"
        open={isDebugSessionLogsVisible}
        id="nh3d-debug-log-dialog"
      >
        {isDebugSessionLogsVisible ? (
          <>
            {renderMobileDialogCloseButton(
              () => setIsDebugSessionLogsVisible(false),
              t.dialogs.debugLogs.closeLabel,
            )}
            <div className="nh3d-options-title">
              {t.dialogs.debugLogs.title}
            </div>
            <div className="nh3d-dialog-hint">{t.dialogs.debugLogs.hint}</div>
            {debugSessionLogs.length > 0 ? (
              <>
                <div className="nh3d-debug-log-session-list">
                  {debugSessionLogs.map((session) => (
                    <button
                      className={`nh3d-debug-log-session-button${
                        selectedDebugSessionLog?.id === session.id
                          ? " is-active"
                          : ""
                      }`}
                      key={session.id}
                      onClick={() => setSelectedDebugSessionLogId(session.id)}
                      type="button"
                    >
                      {describeDebugSessionLogSession(session)}
                    </button>
                  ))}
                </div>
                {selectedDebugSessionLog ? (
                  <div className="nh3d-debug-log-session-summary">
                    {t.dialogs.debugLogs.showingEntries(
                      selectedDebugSessionLog.entries.length,
                      formatDebugSessionLogTimestamp(
                        selectedDebugSessionLog.startedAt,
                      ),
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="nh3d-question-text">
                {t.dialogs.debugLogs.noneSaved}
              </div>
            )}
            <div className="nh3d-debug-log-viewer" data-nh3d-overflow-glow>
              <pre className="nh3d-debug-log-viewer-text">
                {selectedDebugSessionLogText}
              </pre>
            </div>
            <div className="nh3d-menu-actions">
              <button
                className="nh3d-menu-action-button"
                onClick={refreshDebugSessionLogs}
                type="button"
              >
                {t.dialogs.debugLogs.refresh}
              </button>
              <button
                className="nh3d-menu-action-button nh3d-menu-action-cancel"
                onClick={() => {
                  clearDebugSessionLogs();
                  enableDebugSessionLogCapture({ buildLabel: nh3dBuildLabel });
                  recordDebugSessionLogEvent("debug-log-clear", [
                    t.debugLogs.clearedLogEntry,
                  ]);
                  refreshDebugSessionLogs();
                }}
                type="button"
              >
                {t.dialogs.debugLogs.clearLogs}
              </button>
              <button
                className="nh3d-menu-action-button"
                onClick={() => setIsDebugSessionLogsVisible(false)}
                type="button"
              >
                {commonStrings.close}
              </button>
            </div>
          </>
        ) : null}
      </AnimatedDialog>
      {asciiLogoVisible && (
        <div className="logo-container">
          <pre className="nethack-ascii-logo">
            {`                
  +$$&&&&&$;         :X$&&&&$X:                       :X$&&&&&$X;     :X&&&&&&&$+                               .;;+X$;                                               
    +X&&&&&$X          X&&&$+                           +X&&&$+:        xX&&&&+:                              .$&&&&&+:                                               
    :x&&&&&&&$:        X$&&X;                           ;X&&&$x.        +X&&&$x.                                X$&&$+:                                               
    :x&&&&&&&&$x       X&&&X;                   x&:     ;X&&&$X.        +X&&&$x.                                X$&&&x:                                               
    :x&&x&&&&&&&$      X&&&X:        _       .$&&+:     ;X&&&$x.        +X&&&$x.                                X$&&&x.                                               
    :X&&x;X&&&&&&&:    X&&&X:   :+$&&&&&+   :&&&&$Xxxx; ;X&&&$X;.:;::::.xX&&&$x.   ;+$&&&&$+        :;+XXXXx;:  X$&&$x.   .XXXX+                                      
    :X&&x::+&&&&&&&x   X$&&x:  X&&$;;X&&&$ ;$&&&&XXXX;  ;x$$$$&&&&&&&&&&&&$$$$x  +&$X+;+$&&&$.    :$&&$x++$&&$+ X$$$$+.   +$$+:                                       
    :X&$x:  ;$&$&&$&&  +$&&x: $&&x:  :X&&x+  $&&&;.     ;+XXXXXXXXXXXXXXXX$$$X+  :+:    ;$$$Xx   X&&$;:   .++:  xX$$X+. ;&$+:                                         
    :X$$x:   ;+$$$$$&&:;X$$+.;X&&x  +$$&&xx  $&&&+.     ;+XXX+;. .. .   ;xXXXX+        :$$$$X+  x$$$;;          xXXXX+:$$Xx;                                          
    :X$Xx:    .;$XXXX$&$XX$+.;X&&&$Xx;:      $&$$;.     :+Xxx+;.        ;xXXxx+    ;XXX++XXXX+  xXXX;:          +XxxxxX$XXxx;                                         
    :+Xx+:      ;XXXXXX&&xX+ ;;$$Xx:         $$XX;.     :+x+++;.        ;+x+++;  ;XX+:. ;xxxx+  +xxX++          +x+++::+XxX++:                                        
    :+X++:       :+xxxxxX+x; .;xXX$$:     ,  XXxX+:     :;x+++;.        ;+++++; ;xx++   ;x++++  ;+x+x++         +x+++:.:;++x++:                                       
    :;x++:        :;x+++++x;  :;+XX$&&$XXX;  ++xx&&X+x; :;+++;;.        ;+++++; ;;++xX;;xx++++: .;;++xXXx;:;;+: ;x+++:. :;+++++;                                      
    X$++X&+         :x++++x;   .::+X$$$+::   .;;XX$+::  xX;;;;+;        xx;;;;+: ::+++;:: ++;;;.  ::;++++x+::.  Xx;;;+:  .:++++++.                                    
  :+;;:::::;x+        ;++X+:       :;;;:        ::;:.  ;::::::::::;   .;::::::::::: ...    ::.       .:::::.  .;::::::::::  ::::::::                                   
                                                                                                                                                                      
                                                                                                                                                                      
                                            ;&&&&&&&&&&&&&&&&&&x   x&&&&&&&&&&&&&$X+:.                                                                                
                                            :;&&&&&&&&&&&&&&&&+:   :;&&&&&$&&&&&&&&&&&&+                                                                              
                                            ;+:::::::::$&&&&$:.    :+&&&&&:.    ::&&&&&&$;                                                                            
                                                      $&&&&X:.      ;X&&&&&:.     :;$&&&&&&                                                                           
                                                    $&&&&X;:;+;:    +$&&&&&:.      ++&&&&&XX                                                                           
                                                  :X$$$$&&&&&&&&&+  ;x&&&&&:.      +X&&&&&+x                                                                           
                                                        .:X&&&&&&$; :+$$$$$:.      +X&$$$&++                                                                           
                                                          :+$$$$$:: :;XxxxX..      xxXXxxX;+                                                                           
                                                          :;XxxxX.. .:x+++x..     :+X++++::                                                                            
                                            x&+         :XX;;;;;.   :+;;;+.     XXx;;;+::                                                                             
                                            :;xx$&&$$XXX$X;:::;:.   .;+;;;++&$&&&x;;;+;:                                                                               
                                             ::::::;;;;;::::::      x+;:::;;;;:::::::                                                                                  
                                                                      `}
          </pre>
          <pre className="nethack-ascii-logo">
            {`                
  +$$&&&&&$;         :X$&&&&$X:                       :X$&&&&&$X;     :X&&&&&&&$+                               .;;+X$;                                               
    +X&&&&&$X          X&&&$+                           +X&&&$+:        xX&&&&+:                              .$&&&&&+:                                               
    :x&&&&&&&$:        X$&&X;                           ;X&&&$x.        +X&&&$x.                                X$&&$+:                                               
    :x&&&&&&&&$x       X&&&X;                   x&:     ;X&&&$X.        +X&&&$x.                                X$&&&x:                                               
    :x&&x&&&&&&&$      X&&&X:        _       .$&&+:     ;X&&&$x.        +X&&&$x.                                X$&&&x.                                               
    :X&&x;X&&&&&&&:    X&&&X:   :+$&&&&&+   :&&&&$Xxxx; ;X&&&$X;.:;::::.xX&&&$x.   ;+$&&&&$+        :;+XXXXx;:  X$&&$x.   .XXXX+                                      
    :X&&x::+&&&&&&&x   X$&&x:  X&&$;;X&&&$ ;$&&&&XXXX;  ;x$$$$&&&&&&&&&&&&$$$$x  +&$X+;+$&&&$.    :$&&$x++$&&$+ X$$$$+.   +$$+:                                       
    :X&$x:  ;$&$&&$&&  +$&&x: $&&x:  :X&&x+  $&&&;.     ;+XXXXXXXXXXXXXXXX$$$X+  :+:    ;$$$Xx   X&&$;:   .++:  xX$$X+. ;&$+:                                         
    :X$$x:   ;+$$$$$&&:;X$$+.;X&&x  +$$&&xx  $&&&+.     ;+XXX+;. .. .   ;xXXXX+        :$$$$X+  x$$$;;          xXXXX+:$$Xx;                                          
    :X$Xx:    .;$XXXX$&$XX$+.;X&&&$Xx;:      $&$$;.     :+Xxx+;.        ;xXXxx+    ;XXX++XXXX+  xXXX;:          +XxxxxX$XXxx;                                         
    :+Xx+:      ;XXXXXX&&xX+ ;;$$Xx:         $$XX;.     :+x+++;.        ;+x+++;  ;XX+:. ;xxxx+  +xxX++          +x+++::+XxX++:                                        
    :+X++:       :+xxxxxX+x; .;xXX$$:     ,  XXxX+:     :;x+++;.        ;+++++; ;xx++   ;x++++  ;+x+x++         +x+++:.:;++x++:                                       
    :;x++:        :;x+++++x;  :;+XX$&&$XXX;  ++xx&&X+x; :;+++;;.        ;+++++; ;;++xX;;xx++++: .;;++xXXx;:;;+: ;x+++:. :;+++++;                                      
    X$++X&+         :x++++x;   .::+X$$$+::   .;;XX$+::  xX;;;;+;        xx;;;;+: ::+++;:: ++;;;.  ::;++++x+::.  Xx;;;+:  .:++++++.                                    
  :+;;:::::;x+        ;++X+:       :;;;:        ::;:.  ;::::::::::;   .;::::::::::: ...    ::.       .:::::.  .;::::::::::  ::::::::                                   
                                                                                                                                                                      
                                                                                                                                                                      
                                            ;&&&&&&&&&&&&&&&&&&x   x&&&&&&&&&&&&&$X+:.                                                                                
                                            :;&&&&&&&&&&&&&&&&+:   :;&&&&&$&&&&&&&&&&&&+                                                                              
                                            ;+:::::::::$&&&&$:.    :+&&&&&:.    ::&&&&&&$;                                                                            
                                                      $&&&&X:.      ;X&&&&&:.     :;$&&&&&&                                                                            
                                                    $&&&&X;:;+;:    +$&&&&&:.      ++&&&&&XX                                                                           
                                                  :X$$$$&&&&&&&&&+  ;x&&&&&:.      +X&&&&&+x                                                                           
                                                        .:X&&&&&&$; :+$$$$$:.      +X&$$$&++                                                                           
                                                          :+$$$$$:: :;XxxxX..      xxXXxxX;+                                                                           
                                                          :;XxxxX.. .:x+++x..     :+X++++::                                                                            
                                            x&+         :XX;;;;;.   :+;;;+.     XXx;;;+::                                                                             
                                            :;xx$&&$$XXX$X;:::;:.   .;+;;;++&$&&&x;;;+;:                                                                               
                                             ::::::;;;;;::::::      x+;:::;;;;:::::::                                                                                  
                                                                      `}
          </pre>
        </div>
      )}

      <AnimatedDialog
        className={`nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions startup nh3d-character-setup-dialog nh3d-startup-update-dialog${
          startupUpdateExpanded ? " nh3d-startup-update-expanded" : ""
        }`}
        disableAnimations={startupInitialLoadingVisible}
        open={startupUpdateDialogOpen}
        id="nh3d-startup-update-dialog"
        onBlurCapture={handleStartupMainMenuBlurCapture}
        onChangeCapture={handleStartupMainMenuChangeCapture}
        onKeyDown={handleStartupMainMenuKeyDown}
        onPointerDownCapture={handleStartupMainMenuPointerDownCapture}
      >
        <div className="nh3d-question-text">
          {startupPendingUpdateCount <= 0
            ? t.dialogs.startupUpdate.maintenanceNotice
            : startupPendingUpdateCount === 1
              ? t.update.oneUpdateAvailable
              : t.update.manyUpdatesAvailable(startupPendingUpdateCount)}
        </div>
        <div className="nh3d-startup-update-progress-pane-meta">
          <span>
            {t.dialogs.startupUpdate.currentVersion(startupCurrentVersionLabel)}
          </span>
          <span>
            {t.dialogs.startupUpdate.latestVersion(startupLatestVersionLabel)}
          </span>
        </div>
        {startupUpdateDetailsVisible ? (
          <div className="nh3d-overflow-glow-frame">
            <div
              className="nh3d-startup-update-details"
              data-nh3d-overflow-glow
              data-nh3d-overflow-glow-host="parent"
            >
              <div className="nh3d-startup-update-details-title">
                {t.dialogs.startupUpdate.pendingUpdates}
              </div>
              <ul className="nh3d-startup-update-details-list">
                {startupPendingUpdateTags.length > 0 ? (
                  startupPendingUpdateTags.map((entry, index) => (
                    <li key={`${entry.name}-${index}`}>
                      {entry.releasePageUrl ? (
                        <a
                          className="nh3d-startup-update-details-release-link"
                          href={entry.releasePageUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {entry.name}
                        </a>
                      ) : (
                        <div className="nh3d-startup-update-details-release-name">
                          {entry.name}
                        </div>
                      )}
                      {entry.releaseNotesMarkdown ? (
                        <UpdateReleaseNotesMarkdown
                          markdown={entry.releaseNotesMarkdown}
                        />
                      ) : null}
                    </li>
                  ))
                ) : (
                  <li>{t.dialogs.startupUpdate.payloadAvailable}</li>
                )}
              </ul>
            </div>
          </div>
        ) : null}
        <div className="nh3d-startup-update-client-warning">
          <label className="nh3d-startup-update-warning-toggle">
            <input
              checked={!clientOptions.showVersionNotificationsOnLaunch}
              onChange={(event) => {
                const showVersionNotificationsOnLaunch = !event.target.checked;
                setClientOptions((previous) =>
                  normalizeNh3dClientOptions({
                    ...previous,
                    showVersionNotificationsOnLaunch,
                  }),
                );
                setClientOptionsDraft((previous) =>
                  normalizeNh3dClientOptions({
                    ...previous,
                    showVersionNotificationsOnLaunch,
                  }),
                );
              }}
              type="checkbox"
            />
            <span>{t.dialogs.startupUpdate.disableAtStartup}</span>
          </label>
          {!clientOptions.showVersionNotificationsOnLaunch ? (
            <div>{t.dialogs.startupUpdate.disabledNotice}</div>
          ) : null}
        </div>
        <div className="nh3d-menu-actions">
          <button
            className="nh3d-menu-action-button nh3d-menu-action-confirm"
            onClick={openGitHubReleases}
            type="button"
          >
            {t.dialogs.clientOptions.updates.openGitHubReleases}
          </button>
          <button
            className="nh3d-menu-action-button"
            disabled={startupPendingUpdateCount <= 0}
            onClick={toggleStartupUpdateDetails}
            type="button"
          >
            {startupUpdateDetailsVisible
              ? t.dialogs.startupUpdate.hideDetails
              : t.dialogs.startupUpdate.moreDetails}
            </button>
          <button
            className="nh3d-menu-action-button nh3d-menu-action-cancel"
            onClick={closeStartupUpdateDialog}
            type="button"
          >
            {commonStrings.later}
          </button>
        </div>
      </AnimatedDialog>

      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions startup nh3d-character-setup-dialog"
        disableAnimations={startupInitialLoadingVisible}
        open={startupVariantDialogVisible}
        id="character-setup-dialog-variant"
        onBlurCapture={handleStartupMainMenuBlurCapture}
        onChangeCapture={handleStartupMainMenuChangeCapture}
        onKeyDown={handleStartupMainMenuKeyDown}
        onPointerDownCapture={handleStartupMainMenuPointerDownCapture}
      >
        <div className="nh3d-question-text">
          {t.dialogs.startup.chooseVariant}
        </div>
        <div className="nh3d-overflow-glow-frame">
          <div
            className="nh3d-choice-list nh3d-choice-list-startup-choose"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
          >
            <button
              className="nh3d-choice-button nh3d-character-setup-choice-button"
              onClick={() => {
                setRuntimeVersion("5.0");
                setStartupFlowStep("choose");
              }}
              type="button"
            >
              NetHack 5.0
            </button>
            <button
              className="nh3d-choice-button nh3d-character-setup-choice-button"
              onClick={() => {
                setRuntimeVersion("3.6.7");
                setStartupFlowStep("choose");
              }}
              type="button"
            >
              NetHack 3.6.7
            </button>
            <button
              className="nh3d-choice-button nh3d-character-setup-choice-button"
              onClick={() => {
                setRuntimeVersion("slashem");
                setStartupFlowStep("choose");
              }}
              type="button"
            >
              SLASH'EM
            </button>
            <button
              className="nh3d-choice-button nh3d-character-setup-choice-button"
              onClick={() => {
                setRuntimeVersion("evilhack");
                setStartupFlowStep("choose");
              }}
              type="button"
            >
              EvilHack
            </button>
            <button
              className="nh3d-choice-button nh3d-character-setup-choice-button"
              onClick={() => {
                void requestGameQuit();
              }}
              type="button"
            >
              {t.dialogs.startup.quitGame}
            </button>
          </div>
        </div>
      </AnimatedDialog>

      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions startup nh3d-character-setup-dialog"
        disableAnimations={startupInitialLoadingVisible}
        open={startupChooseDialogVisible}
        id="character-setup-dialog-choose"
        onBlurCapture={handleStartupMainMenuBlurCapture}
        onChangeCapture={handleStartupMainMenuChangeCapture}
        onKeyDown={handleStartupMainMenuKeyDown}
        onPointerDownCapture={handleStartupMainMenuPointerDownCapture}
      >
        {startupSelectedRuntimeVersionLabel ? (
          <RuntimeVersionBadge
            label={startupSelectedRuntimeVersionLabel}
            startup
          />
        ) : null}
        <div className="nh3d-question-text">
          {t.dialogs.startup.chooseSetup}
        </div>
        <div className="nh3d-overflow-glow-frame">
          <div
            className="nh3d-choice-list nh3d-choice-list-startup-choose"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
          >
            <button
              className="nh3d-choice-button nh3d-character-setup-choice-button"
              onClick={() => setStartupFlowStep("random")}
              type="button"
            >
              {t.dialogs.startup.randomCharacter}
            </button>
            <button
              className="nh3d-choice-button nh3d-character-setup-choice-button"
              onClick={() => setStartupFlowStep("create")}
              type="button"
            >
              {t.dialogs.startup.createCharacter}
            </button>
            <button
              className="nh3d-choice-button nh3d-character-setup-choice-button"
              onClick={handleResumeClick}
              type="button"
            >
              {t.dialogs.startup.loadGame}
            </button>
            <button
              className="nh3d-choice-button nh3d-character-setup-choice-button"
              onClick={openClientOptionsDialog}
              type="button"
            >
              {t.dialogs.startup.options}
            </button>
            <button
              className="nh3d-choice-button nh3d-character-setup-choice-button"
              onClick={() => setStartupFlowStep("variant")}
              type="button"
            >
              {commonStrings.back}
            </button>
          </div>
        </div>
      </AnimatedDialog>

      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions startup nh3d-character-setup-dialog nh3d-character-setup-dialog-resume"
        disableAnimations={startupInitialLoadingVisible}
        open={startupResumeDialogVisible}
        id="character-setup-dialog-resume"
        onBlurCapture={handleStartupMainMenuBlurCapture}
        onChangeCapture={handleStartupMainMenuChangeCapture}
        onKeyDown={handleStartupMainMenuKeyDown}
        onPointerDownCapture={handleStartupMainMenuPointerDownCapture}
      >
        {startupSelectedRuntimeVersionLabel ? (
          <RuntimeVersionBadge
            label={startupSelectedRuntimeVersionLabel}
            startup
          />
        ) : null}
        <div className="nh3d-question-text">
          {t.dialogs.startup.selectSavedGame}
        </div>
        <div className="nh3d-overflow-glow-frame">
          <div
            className="nh3d-choice-list nh3d-choice-list-startup-resume"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
            style={{ width: "100%" }}
          >
            {isLoadingSaves ? (
              <div
                style={{
                  padding: "20px",
                  color: "var(--nh3d-ui-text-muted)",
                }}
              >
                {t.saves.loading}
              </div>
            ) : savedGameSections.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                {savedGameSections.map((section) => (
                  <div
                    key={section.key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        color: "var(--nh3d-ui-text-muted)",
                        fontWeight: "bold",
                        fontSize: "calc(12px * var(--nh3d-ui-font-scale, 1))",
                        paddingLeft: "2px",
                      }}
                    >
                      {section.label}
                    </div>
                    {section.saves.map((save) => (
                      <div
                        key={save.key}
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                          width: "100%",
                        }}
                      >
                        <button
                          className="nh3d-choice-button nh3d-character-setup-choice-button"
                          style={{
                            flex: "1 1 0",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            minWidth: 0,
                            padding: "12px",
                            width: "auto",
                          }}
                          onClick={() => {
                            const currentTilesetPath = String(
                              clientOptions.tilesetPath || "",
                            ).trim();
                            const compatibleTilesetPath =
                              resolveNh3dCompatibleTilesetPathForRuntime(
                                currentTilesetPath,
                                runtimeVersion,
                              );
                            if (
                              compatibleTilesetPath &&
                              compatibleTilesetPath !== currentTilesetPath
                            ) {
                              setClientOptions((previous) =>
                                normalizeNh3dClientOptions({
                                  ...previous,
                                  tilesetPath: compatibleTilesetPath,
                                }),
                              );
                              setClientOptionsDraft((previous) =>
                                normalizeNh3dClientOptions({
                                  ...previous,
                                  tilesetPath: compatibleTilesetPath,
                                }),
                              );
                            }
                            setCharacterCreationConfig({
                              mode: "resume",
                              playMode: clientOptions.fpsMode
                                ? "fps"
                                : "normal",
                              runtimeVersion,
                              name: save.name,
                              initOptions: save.initOptions,
                              resumeCategory: save.category,
                            });
                          }}
                          type="button"
                        >
                          <div style={{ width: "100%" }}>
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize:
                                  "calc(16px * var(--nh3d-ui-font-scale, 1))",
                              }}
                            >
                              {save.displayName}
                            </div>
                            <div
                              style={{
                                fontSize:
                                  "calc(12px * var(--nh3d-ui-font-scale, 1))",
                                color: "var(--nh3d-ui-text-muted)",
                                marginTop: "4px",
                                fontWeight: "normal",
                              }}
                            >
                              {t.saves.savedAt(save.dateFormatted)}
                            </div>
                          </div>
                        </button>
                        <button
                          aria-label={`Delete ${save.displayName}`}
                          className="delete-button"
                          onClick={(e) => handleDeleteSave(e, save)}
                          type="button"
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: "20px",
                  color: "var(--nh3d-ui-text-muted)",
                }}
              >
                {t.saves.noneFound}
              </div>
            )}
          </div>
        </div>
        <div className="nh3d-menu-actions">
          <button
            className="nh3d-menu-action-button nh3d-menu-action-cancel"
            onClick={() => setStartupFlowStep("choose")}
            type="button"
          >
            {commonStrings.back}
          </button>
        </div>
      </AnimatedDialog>

      <AnimatedDialog
        className={`nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions startup nh3d-character-setup-dialog${
          startupInitOptionsExpanded ? " nh3d-startup-init-expanded" : ""
        }`}
        disableAnimations={startupInitialLoadingVisible}
        open={startupRandomDialogVisible}
        id="character-setup-dialog-random"
        onBlurCapture={handleStartupMainMenuBlurCapture}
        onChangeCapture={handleStartupMainMenuChangeCapture}
        onKeyDown={handleStartupMainMenuKeyDown}
        onPointerDownCapture={handleStartupMainMenuPointerDownCapture}
      >
        {startupSelectedRuntimeVersionLabel ? (
          <RuntimeVersionBadge
            label={startupSelectedRuntimeVersionLabel}
            startup
          />
        ) : null}
        <div className="nh3d-question-text">
          {t.dialogs.startup.enterRandomName}
        </div>
        <div className="nh3d-startup-config-grid centered">
          <label className="nh3d-startup-config-field">
            <span>{t.dialogs.startup.name}</span>
            <input
              className="nh3d-startup-config-input"
              maxLength={30}
              onChange={(event) => setRandomCharacterName(event.target.value)}
              placeholder={startupDefaultCharacterName}
              type="text"
              value={randomCharacterName}
            />
          </label>
        </div>
        <StartupInitOptionsAccordion
          expanded={startupInitOptionsExpanded}
          onExpandedChange={setStartupInitOptionsExpanded}
          onOptionValueChange={updateStartupInitOptionValue}
          onResetDefaults={resetStartupInitOptionValues}
          runtimeVersion={runtimeVersion}
          values={startupInitOptionValues}
        />
        <div className="nh3d-menu-actions">
          <button
            className="nh3d-menu-action-button nh3d-menu-action-confirm"
            onClick={() => {
              const randomSelection =
                pickRandomStartupCreateCharacterSelection(
                  runtimeVersion,
                );
              handleStartNewGame({
                mode: "random",
                playMode: clientOptions.fpsMode ? "fps" : "normal",
                runtimeVersion,
                name: normalizeStartupCharacterName(randomCharacterName),
                role: randomSelection.role,
                race: randomSelection.race,
                gender: randomSelection.gender,
                align: randomSelection.align,
                initOptions: startupInitOptionTokens,
              });
            }}
            type="button"
          >
            {t.dialogs.startup.startGame}
          </button>
          <button
            className="nh3d-menu-action-button nh3d-menu-action-cancel"
            onClick={() => setStartupFlowStep("choose")}
            type="button"
          >
            {commonStrings.back}
          </button>
          <button
            className="nh3d-menu-action-button"
            onClick={openClientOptionsDialog}
            type="button"
          >
            {t.dialogs.startup.options}
          </button>
        </div>
      </AnimatedDialog>

      <AnimatedDialog
        className={`nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions startup nh3d-character-setup-dialog${
          startupInitOptionsExpanded ? " nh3d-startup-init-expanded" : ""
        }`}
        disableAnimations={startupInitialLoadingVisible}
        open={startupCreateDialogVisible}
        id="character-setup-dialog-create"
        onBlurCapture={handleStartupMainMenuBlurCapture}
        onChangeCapture={handleStartupMainMenuChangeCapture}
        onKeyDown={handleStartupMainMenuKeyDown}
        onPointerDownCapture={handleStartupMainMenuPointerDownCapture}
      >
        {startupSelectedRuntimeVersionLabel ? (
          <RuntimeVersionBadge
            label={startupSelectedRuntimeVersionLabel}
            startup
          />
        ) : null}
        <div className="nh3d-question-text">
          {t.dialogs.startup.createCharacterPrompt}
        </div>
        <div className="nh3d-startup-config-grid">
          <label className="nh3d-startup-config-field">
            <span>{t.dialogs.startup.name}</span>
            <input
              className="nh3d-startup-config-input"
              maxLength={30}
              onChange={(event) => setCreateCharacterName(event.target.value)}
              placeholder={startupDefaultCharacterName}
              type="text"
              value={createCharacterName}
            />
          </label>
          <label className="nh3d-startup-config-field">
            <span>{t.dialogs.startup.role}</span>
            <select
              className="nh3d-startup-config-select"
              onChange={(event) => setCreateRole(event.target.value)}
              value={normalizedCreateCharacterSelection.role}
            >
              {startupCreateCharacterOptionSet.roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="nh3d-startup-config-field">
            <span>{t.dialogs.startup.race}</span>
            <select
              className="nh3d-startup-config-select"
              onChange={(event) => setCreateRace(event.target.value)}
              value={normalizedCreateCharacterSelection.race}
            >
              {startupCreateCharacterOptionSet.raceOptions.map((race) => (
                <option key={race} value={race}>
                  {race}
                </option>
              ))}
            </select>
          </label>
          <label className="nh3d-startup-config-field">
            <span>{t.dialogs.startup.gender}</span>
            <select
              className="nh3d-startup-config-select"
              onChange={(event) => setCreateGender(event.target.value)}
              value={normalizedCreateCharacterSelection.gender}
            >
              {startupCreateCharacterOptionSet.genderOptions.map((gender) => (
                <option key={gender} value={gender}>
                  {gender}
                </option>
              ))}
            </select>
          </label>
          <label className="nh3d-startup-config-field">
            <span>{t.dialogs.startup.alignment}</span>
            <select
              className="nh3d-startup-config-select"
              onChange={(event) => setCreateAlign(event.target.value)}
              value={normalizedCreateCharacterSelection.align}
            >
              {startupCreateCharacterOptionSet.alignOptions.map((align) => (
                <option key={align} value={align}>
                  {align}
                </option>
              ))}
            </select>
          </label>
        </div>
        <StartupInitOptionsAccordion
          expanded={startupInitOptionsExpanded}
          onExpandedChange={setStartupInitOptionsExpanded}
          onOptionValueChange={updateStartupInitOptionValue}
          onResetDefaults={resetStartupInitOptionValues}
          runtimeVersion={runtimeVersion}
          values={startupInitOptionValues}
        />
        <div className="nh3d-menu-actions">
          <button
            className="nh3d-menu-action-button nh3d-menu-action-confirm"
            onClick={() =>
              handleStartNewGame({
                mode: "create",
                playMode: clientOptions.fpsMode ? "fps" : "normal",
                runtimeVersion,
                name: normalizeStartupCharacterName(createCharacterName),
                role: normalizedCreateCharacterSelection.role,
                race: normalizedCreateCharacterSelection.race,
                gender: normalizedCreateCharacterSelection.gender,
                align: normalizedCreateCharacterSelection.align,
                initOptions: startupInitOptionTokens,
              })
            }
            type="button"
          >
            {t.dialogs.startup.startGame}
          </button>
          <button
            className="nh3d-menu-action-button nh3d-menu-action-cancel"
            onClick={() => setStartupFlowStep("choose")}
            type="button"
          >
            {commonStrings.back}
          </button>
          <button
            className="nh3d-menu-action-button"
            onClick={openClientOptionsDialog}
            type="button"
          >
            {t.dialogs.startup.options}
          </button>
        </div>
      </AnimatedDialog>

      {loadingOverlayVisible && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-atomic="true"
              aria-live="polite"
              className="loading"
              id="loading"
              role="status"
              tabIndex={-1}
            >
              <div>NetHack 3D</div>
              <div className="loading-subtitle">{loadingSubtitle}</div>
            </div>,
            document.body,
          )
        : null}

      {!isMobileViewport && isDesktopGameRunning ? (
        <div className="top-left-ui with-stats">
          <div id="game-status">{statusText}</div>
          {gameMessageLog ? (
            <div className="nh3d-overflow-glow-frame">{gameMessageLog}</div>
          ) : null}
        </div>
      ) : mobileTouchUiVisible &&
        gameMessageLog &&
        (isMobileLogVisible || clientOptions.showPersistentMobileMessageLog) ? (
        <div
          className={`nh3d-mobile-log nh3d-overflow-glow-frame${
            isMobileLogVisible ? "" : " nh3d-mobile-log-collapsed"
          }`}
          style={
            {
              "--nh3d-mobile-log-top": `${statsBarHeight}px`,
            } as React.CSSProperties
          }
        >
          {gameMessageLog}
        </div>
      ) : null}

      <div id="floating-log-message-layer">
        {floatingMessages.map((entry, index) => (
          <div
            className="floating-message-container"
            key={entry.id}
            style={{
              top: `calc(${-index * 30}px * var(--nh3d-live-log-font-scale, 1))`,
            }}
          >
            <div
              className="floating-message-text"
              style={floatingMessageTextStyle}
            >
              {entry.text}
            </div>
          </div>
        ))}
      </div>

      {!startup && !gameOverDialogShowsTombstone && (
        <div id="stats-bar">
          <div className="nh3d-stats-name">
            {playerStats.name}
            <span className="nh3d-stats-name-level">
              {" "}
              (Lvl {playerStats.level})
            </span>
          </div>
          <div className="nh3d-stats-meter">
            <div className="nh3d-stats-meter-label nh3d-stats-meter-label-hp">
              HP: {playerStats.hp}/{playerStats.maxHp}
            </div>
            <div className="nh3d-stats-meter-track">
              <div
                className="nh3d-stats-meter-fill"
                style={{
                  width: `${hpPercentage}%`,
                  backgroundColor: hpColor,
                }}
              />
            </div>
          </div>
          {playerStats.maxPower > 0 ? (
            <div className="nh3d-stats-meter">
              <div className="nh3d-stats-meter-label nh3d-stats-meter-label-pw">
                Pw: {playerStats.power}/{playerStats.maxPower}
              </div>
              <div className="nh3d-stats-meter-track">
                <div
                  className="nh3d-stats-meter-fill nh3d-stats-meter-fill-pw"
                  style={{ width: `${powerPercentage}%` }}
                />
              </div>
            </div>
          ) : null}
          <div className="nh3d-stats-group nh3d-stats-group-core">
            <div className="nh3d-stats-core-row nh3d-stats-core-row-primary">
              <div
                className="nh3d-stats-core"
                style={resolveCoreStatStyle("strength")}
              >
                St:{playerStats.strength}
              </div>
              <div
                className="nh3d-stats-core"
                style={resolveCoreStatStyle("dexterity")}
              >
                Dx:{playerStats.dexterity}
              </div>
              <div
                className="nh3d-stats-core"
                style={resolveCoreStatStyle("constitution")}
              >
                Co:{playerStats.constitution}
              </div>
              <div
                className="nh3d-stats-core"
                style={resolveCoreStatStyle("intelligence")}
              >
                In:{playerStats.intelligence}
              </div>
              <div
                className="nh3d-stats-core"
                style={resolveCoreStatStyle("wisdom")}
              >
                Wi:{playerStats.wisdom}
              </div>
            </div>
            <div className="nh3d-stats-core-row nh3d-stats-core-row-secondary">
              <div
                className="nh3d-stats-core"
                style={resolveCoreStatStyle("charisma")}
              >
                Ch:{playerStats.charisma}
              </div>
              <div
                className="nh3d-stats-secondary-ac nh3d-stats-mobile-inline-secondary"
                style={resolveCoreStatStyle("armor")}
              >
                AC:{playerStats.armor}
                {activeRuntimeVersion === "evilhack" && playerStats.magicCancellation != null && (
                  <> MC:{playerStats.magicCancellation}</>
                )}
                {activeRuntimeVersion === "evilhack" && playerStats.toHit != null && (
                  <> TH:{playerStats.toHit}</>
                )}
              </div>
              <div className="nh3d-stats-secondary-exp nh3d-stats-mobile-inline-secondary">
                Exp:{playerStats.experience}
              </div>
              <div className="nh3d-stats-secondary-time nh3d-stats-mobile-inline-secondary">
                T:{playerStats.time}
              </div>
              <div className="nh3d-stats-secondary-gold nh3d-stats-mobile-inline-secondary">
                $:{playerStats.gold}
              </div>
            </div>
          </div>
          <div className="nh3d-stats-group nh3d-stats-group-secondary">
            <div
              className="nh3d-stats-secondary-ac nh3d-stats-desktop-secondary"
              style={resolveCoreStatStyle("armor")}
            >
              AC:{playerStats.armor}
              {activeRuntimeVersion === "evilhack" && playerStats.magicCancellation != null && (
                <> MC:{playerStats.magicCancellation}</>
              )}
              {activeRuntimeVersion === "evilhack" && playerStats.toHit != null && (
                <> TH:{playerStats.toHit}</>
              )}
            </div>
            <div className="nh3d-stats-secondary-exp nh3d-stats-desktop-secondary">
              Exp:{playerStats.experience}
            </div>
            <div className="nh3d-stats-secondary-gold nh3d-stats-desktop-secondary">
              $:{playerStats.gold}
            </div>
            <div className="nh3d-stats-secondary-time nh3d-stats-desktop-secondary">
              T:{playerStats.time}
            </div>
            <div className="nh3d-stats-hunger nh3d-stats-desktop-secondary">
              <span className="nh3d-stats-status-list">
                {playerStatusBadges.map((status) => (
                  <span
                    className={`nh3d-stats-status-badge is-${status.severity}`}
                    key={`desktop-status-${status.label}`}
                  >
                    {status.label}
                  </span>
                ))}
              </span>
            </div>
          </div>
          <div className="nh3d-stats-location">
            <div className="nh3d-stats-dungeon">
              {visibleLocationLabel}
              {playerStatusBadges.length > 0 ? (
                <span className="nh3d-stats-mobile-location-status">
                  <span className="nh3d-stats-status-list">
                    {playerStatusBadges.map((status) => (
                      <span
                        className={`nh3d-stats-status-badge is-${status.severity}`}
                        key={`mobile-status-${status.label}`}
                      >
                        {status.label}
                      </span>
                    ))}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-options nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close"
        open={isClientOptionsVisible}
        id="nh3d-client-options-dialog"
        onBlurCapture={handleClientOptionsDialogBlurCapture}
        onChangeCapture={handleClientOptionsDialogChangeCapture}
        onKeyDown={handleClientOptionsDialogKeyDown}
        onPointerDownCapture={handleClientOptionsDialogPointerDownCapture}
      >
        {renderMobileDialogCloseButton(
          requestCloseClientOptionsDialog,
          t.dialogs.clientOptions.closeLabel,
        )}
        <div className="nh3d-options-title">
          {t.dialogs.clientOptions.title}
        </div>
        <div className="nh3d-options-layout">
          <div className="nh3d-overflow-glow-frame nh3d-options-nav-shell">
            <div
              aria-label={t.dialogs.clientOptions.categoriesLabel}
              className="nh3d-options-nav"
              data-nh3d-overflow-glow
              data-nh3d-overflow-glow-host="parent"
              role="tablist"
            >
              {clientOptionsTabs.map((tab) => {
                const isSelected = tab.id === selectedClientOptionsTab.id;
                return (
                  <button
                    aria-controls="nh3d-client-options-panel"
                    aria-selected={isSelected}
                    className={`nh3d-options-tab${isSelected ? " is-selected" : ""}`}
                    id={`nh3d-client-options-tab-${tab.id}`}
                    key={tab.id}
                    onClick={() => setActiveClientOptionsTab(tab.id)}
                    role="tab"
                    tabIndex={isSelected ? 0 : -1}
                    type="button"
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="nh3d-overflow-glow-frame nh3d-options-panel-shell">
            <div
              aria-labelledby={`nh3d-client-options-tab-${selectedClientOptionsTab.id}`}
              className="nh3d-options-panel"
              data-nh3d-overflow-glow
              data-nh3d-overflow-glow-host="parent"
              id="nh3d-client-options-panel"
              role="tabpanel"
            >
              <div className="nh3d-options-panel-heading">
                <div className="nh3d-options-panel-title">
                  {selectedClientOptionsTab.label}
                </div>
                <div className="nh3d-options-panel-description">
                  {selectedClientOptionsTab.description}
                </div>
              </div>
              <div className="nh3d-options-list">
                {selectedClientOptionsTab.id === "updates" ? (
                  <>
                    <div className="nh3d-option-row nh3d-option-row-inline-toggle">
                      <div className="nh3d-option-copy">
                        <div className="nh3d-option-label">
                          {t.dialogs.clientOptions.updates.checkOnLaunchLabel}
                        </div>
                        <div className="nh3d-option-description">
                          {
                            t.dialogs.clientOptions.updates
                              .checkOnLaunchDescription
                          }
                        </div>
                      </div>
                      <button
                        aria-checked={
                          clientOptionsDraft.showVersionNotificationsOnLaunch
                        }
                        className={`nh3d-option-switch nh3d-option-inline-switch${
                          clientOptionsDraft.showVersionNotificationsOnLaunch
                            ? " is-on"
                            : ""
                        }`}
                        onClick={() =>
                          updateClientOptionDraft(
                            "showVersionNotificationsOnLaunch",
                            !clientOptionsDraft.showVersionNotificationsOnLaunch,
                          )
                        }
                        role="switch"
                        type="button"
                      >
                        <span className="nh3d-option-switch-thumb" />
                      </button>
                    </div>
                    <div className="nh3d-option-row nh3d-option-row-updates">
                      <div className="nh3d-option-copy">
                        <div className="nh3d-option-label">
                          {t.dialogs.clientOptions.updates.title}
                        </div>
                        <div className="nh3d-option-description">
                          {t.dialogs.clientOptions.updates.description}
                        </div>
                        {optionsUpdateCheckStatus ? (
                          <div className="nh3d-updates-status">
                            {optionsUpdateCheckStatus}
                          </div>
                        ) : (
                          <div className="nh3d-updates-status">
                            {t.dialogs.clientOptions.updates.idle}
                          </div>
                        )}
                        {optionsUpdateCheckResult &&
                        !optionsUpdateCheckResult.error ? (
                          <>
                            <div className="nh3d-updates-status">
                              {t.dialogs.startupUpdate.currentVersion(
                                `v${optionsUpdateCheckResult.currentVersion}`,
                              )}
                            </div>
                            <div className="nh3d-updates-status">
                              {t.dialogs.startupUpdate.latestVersion(
                                optionsUpdateCheckResult.latestVersion ??
                                  optionsUpdateCheckResult.latestTagName ??
                                  commonStrings.none,
                              )}
                            </div>
                          </>
                        ) : null}
                        {optionsUpdateCheckResult &&
                        !optionsUpdateCheckResult.error &&
                        optionsUpdateCheckResult.hasUpdate &&
                        optionsUpdateCheckResult.newerTags.length > 0 ? (
                          <ul className="nh3d-updates-pending-list">
                            {optionsUpdateCheckResult.newerTags.map(
                              (entry, index) => (
                                <li key={`${entry.name}-${index}`}>
                                  {entry.name}
                                </li>
                              ),
                            )}
                          </ul>
                        ) : null}
                      </div>
                      <div className="nh3d-option-select-controls nh3d-option-select-controls-stacked">
                        <button
                          className="nh3d-menu-action-button"
                          disabled={optionsUpdateCheckBusy}
                          onClick={() => {
                            void checkForUpdatesFromOptions();
                          }}
                          type="button"
                        >
                          {optionsUpdateCheckBusy
                            ? commonStrings.checking
                            : t.dialogs.clientOptions.updates.button}
                        </button>
                        <button
                          className="nh3d-menu-action-button"
                          onClick={openGitHubReleases}
                          type="button"
                        >
                          {t.dialogs.clientOptions.updates.openGitHubReleases}
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
                {visibleClientOptions.map((option) => {
                  if (option.developerOnly && !showDeveloperClientSettings) {
                    return null;
                  }
                  if (option.type === "section") {
                    return (
                      <Fragment key={option.key}>
                        <div className="nh3d-options-group-title">
                          {option.label}
                        </div>
                      </Fragment>
                    );
                  }
                  if (option.type === "boolean") {
                    const isInventoryTileOnlyMotionOption =
                      option.key === "inventoryTileOnlyMotion";
                    const isDarkCorridorWallsOption =
                      option.key === "darkCorridorWalls367";
                    const isNh5DarkWallOverrideOption =
                      option.key === "overrideNh5DarkCorridorWallTiles";
                    const isDarkWallTileOverrideOption =
                      option.key === "darkCorridorWallTileOverrideEnabled";
                    const isDarkWallSolidColorOverrideOption =
                      option.key ===
                      "darkCorridorWallSolidColorOverrideEnabled";
                    const isDarkWallOverrideOption =
                      isDarkWallTileOverrideOption ||
                      isDarkWallSolidColorOverrideOption;
                    const darkCorridorOptionSuppressedByVulture =
                      isVultureTilesetSelected &&
                      (isDarkCorridorWallsOption ||
                        isNh5DarkWallOverrideOption ||
                        isDarkWallOverrideOption);
                    const darkCorridorWallsForcedOnByVulture =
                      isVultureTilesetSelected && isDarkCorridorWallsOption;
                    const invertLookOptionDisabledByFpsMode =
                      option.key === "invertLookYAxis" &&
                      !clientOptionsDraft.fpsMode;
                    const darkWallOverrideDisabledByDarkCorridorWalls =
                      isDarkWallOverrideOption &&
                      !clientOptionsDraft.darkCorridorWalls367 &&
                      !clientOptionsDraft.overrideNh5DarkCorridorWallTiles;
                    const enabled = darkCorridorWallsForcedOnByVulture
                      ? true
                      : Boolean(clientOptionsDraft[option.key]);
                    const toggleDisabled =
                      (isInventoryTileOnlyMotionOption &&
                        clientOptionsDraft.reduceInventoryMotion) ||
                      darkCorridorOptionSuppressedByVulture ||
                      darkWallOverrideDisabledByDarkCorridorWalls ||
                      invertLookOptionDisabledByFpsMode;
                    const toggleDisabledHint =
                      darkCorridorWallsForcedOnByVulture
                        ? t.dialogs.clientOptions.hints.darkWallsAlwaysEnabled
                        : darkCorridorOptionSuppressedByVulture
                          ? t.dialogs.clientOptions.hints
                              .darkWallsDisabledByVulture
                          : darkWallOverrideDisabledByDarkCorridorWalls
                            ? t.dialogs.clientOptions.hints.enableDarkWallsFirst
                            : invertLookOptionDisabledByFpsMode
                              ? t.dialogs.clientOptions.hints.enableFpsFirst
                              : "";
                    const darkWallSecondaryControlsDisabled =
                      !enabled || toggleDisabled;
                    const shouldRenderControllerRemapRow =
                      selectedClientOptionsTab.id === "controls" &&
                      option.key === "controllerEnabled";
                    return (
                      <Fragment key={option.key}>
                        <div
                          className={`nh3d-option-row nh3d-option-row-inline-toggle${
                            isDarkWallOverrideOption
                              ? " nh3d-option-row-has-secondary-controls"
                              : ""
                          }${
                            toggleDisabled
                              ? " nh3d-option-row-mode-inactive"
                              : ""
                          }${
                            isDarkWallOverrideOption && !enabled
                              ? " nh3d-option-row-mode-inactive"
                              : ""
                          }`}
                        >
                          <div className="nh3d-option-copy">
                            <div className="nh3d-option-label">
                              {option.label}
                            </div>
                            <div className="nh3d-option-description">
                              {option.description}
                              {toggleDisabledHint}
                            </div>
                          </div>
                          {isDarkWallTileOverrideOption ? (
                            <div className="nh3d-option-toggle-controls nh3d-option-secondary-controls">
                              <button
                                className={`nh3d-option-tile-picker-button${
                                  darkWallSecondaryControlsDisabled
                                    ? " is-disabled"
                                    : ""
                                }`}
                                disabled={darkWallSecondaryControlsDisabled}
                                onClick={() =>
                                  setIsDarkWallTilePickerVisible(true)
                                }
                                type="button"
                              >
                                <span className="nh3d-option-tile-picker-preview">
                                  {renderTilePreviewImageForOptions(
                                    selectedDarkWallTileId,
                                  )}
                                </span>
                                <span className="nh3d-option-tile-picker-copy">
                                  <span className="nh3d-option-tile-picker-glyph">
                                    {selectedDarkWallGlyphLabel}
                                  </span>
                                  <span className="nh3d-option-tile-picker-id">
                                    tile #{selectedDarkWallTileId}
                                  </span>
                                </span>
                              </button>
                            </div>
                          ) : isDarkWallSolidColorOverrideOption ? (
                            <div className="nh3d-option-toggle-controls nh3d-option-secondary-controls">
                              <div className="nh3d-dark-wall-solid-color-controls">
                                <div className="nh3d-dark-wall-solid-color-input-row">
                                  <div className="nh3d-dark-wall-solid-color-input-group">
                                    <label className="nh3d-dark-wall-mode-color">
                                      <span>
                                        {
                                          t.dialogs.clientOptions
                                            .darkWallControls.normal
                                        }
                                      </span>
                                      <input
                                        aria-label={
                                          t.dialogs.clientOptions
                                            .darkWallControls.normalAria
                                        }
                                        className="nh3d-option-solid-color-native-picker"
                                        disabled={
                                          darkWallSecondaryControlsDisabled
                                        }
                                        onChange={(event) =>
                                          updateDarkWallSolidColorHexDraft(
                                            event.target.value,
                                          )
                                        }
                                        type="color"
                                        value={normalizeSolidChromaKeyHex(
                                          selectedDarkWallSolidColorHex,
                                        )}
                                      />
                                    </label>
                                    <label className="nh3d-dark-wall-mode-color">
                                      <span>
                                        {
                                          t.dialogs.clientOptions
                                            .darkWallControls.fps
                                        }
                                      </span>
                                      <input
                                        aria-label={
                                          t.dialogs.clientOptions
                                            .darkWallControls.fpsAria
                                        }
                                        className="nh3d-option-solid-color-native-picker"
                                        disabled={
                                          darkWallSecondaryControlsDisabled
                                        }
                                        onChange={(event) =>
                                          updateDarkWallSolidColorHexFpsDraft(
                                            event.target.value,
                                          )
                                        }
                                        type="color"
                                        value={normalizeSolidChromaKeyHex(
                                          selectedDarkWallSolidColorHexFps,
                                        )}
                                      />
                                    </label>
                                  </div>
                                  <div className="nh3d-dark-wall-solid-color-input-group">
                                    <label className="nh3d-dark-wall-grid-toggle">
                                      <input
                                        checked={
                                          selectedDarkWallSolidColorGridEnabled
                                        }
                                        disabled={
                                          darkWallSecondaryControlsDisabled
                                        }
                                        onChange={(event) =>
                                          updateDarkWallSolidColorGridEnabledDraft(
                                            event.target.checked,
                                          )
                                        }
                                        type="checkbox"
                                      />
                                      <span>
                                        {
                                          t.dialogs.clientOptions
                                            .darkWallControls.gridLines
                                        }
                                      </span>
                                    </label>
                                    <label className="nh3d-dark-wall-grid-darkness">
                                      <span>
                                        {
                                          t.dialogs.clientOptions
                                            .darkWallControls.intensity
                                        }
                                      </span>
                                      <span className="nh3d-dark-wall-grid-darkness-input-wrap">
                                        <input
                                          className="nh3d-dark-wall-grid-darkness-input"
                                          disabled={
                                            darkWallSecondaryControlsDisabled ||
                                            !selectedDarkWallSolidColorGridEnabled
                                          }
                                          max={100}
                                          min={0}
                                          onChange={(event) =>
                                            updateDarkWallSolidColorGridDarknessPercentDraft(
                                              Number(event.target.value),
                                            )
                                          }
                                          step={1}
                                          type="number"
                                          value={
                                            selectedDarkWallSolidColorGridDarknessPercent
                                          }
                                        />
                                        <span
                                          aria-hidden="true"
                                          className="nh3d-dark-wall-grid-darkness-suffix"
                                        >
                                          %
                                        </span>
                                      </span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                          <button
                            aria-checked={enabled}
                            className={`nh3d-option-switch nh3d-option-inline-switch${
                              enabled ? " is-on" : ""
                            }`}
                            disabled={toggleDisabled}
                            onClick={() => {
                              if (toggleDisabled) {
                                return;
                              }
                              if (isDarkWallTileOverrideOption) {
                                updateDarkWallTileOverrideEnabledDraft(
                                  !enabled,
                                );
                                return;
                              }
                              if (isDarkWallSolidColorOverrideOption) {
                                updateDarkWallSolidColorOverrideEnabledDraft(
                                  !enabled,
                                );
                                return;
                              }
                              updateClientOptionDraft(option.key, !enabled);
                            }}
                            role="switch"
                            type="button"
                          >
                            <span className="nh3d-option-switch-thumb" />
                          </button>
                        </div>
                        {shouldRenderControllerRemapRow ? (
                          <div className="nh3d-option-row nh3d-option-row-controller-remap">
                            <div className="nh3d-option-copy">
                              <div className="nh3d-option-label">
                                {t.dialogs.clientOptions.controllerRemap.title}
                              </div>
                              <div className="nh3d-option-description">
                                {t.dialogs.clientOptions.controllerRemap.hint}
                              </div>
                            </div>
                            <div className="nh3d-option-select-controls">
                              <button
                                className="nh3d-menu-action-button"
                                onClick={openControllerRemapDialog}
                                type="button"
                              >
                                {
                                  t.dialogs.clientOptions.buttons
                                    .remapController
                                }
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </Fragment>
                    );
                  }
                  if (option.type === "select") {
                    const isTilesetSelect = option.key === "tilesetPath";
                    const isInventoryFixedTileSizeSelect =
                      option.key === "inventoryFixedTileSize";
                    const isBloodDetailSelect = option.key === "bloodDetail";
                    const selectOptions = isTilesetSelect
                      ? tilesetDropdownOptions
                      : option.options;
                    const tilesetSelectDisabledByDisplayMode =
                      isTilesetSelect &&
                      clientOptionsDraft.tilesetMode !== "tiles";
                    const selectDisabled = isTilesetSelect
                      ? tilesetSelectDisabledByDisplayMode || !hasAnyTilesets
                      : isInventoryFixedTileSizeSelect
                        ? !clientOptionsDraft.reduceInventoryMotion
                        : isBloodDetailSelect
                          ? !clientOptionsDraft.bloodGround
                        : Boolean(option.disabled);
                    return (
                      <div
                        className={`nh3d-option-row${
                          selectDisabled ? " nh3d-option-row-mode-inactive" : ""
                        }`}
                        key={option.key}
                      >
                        <div className="nh3d-option-copy">
                          <div className="nh3d-option-label">
                            {option.label}
                          </div>
                          <div className="nh3d-option-description">
                            {option.description}
                          </div>
                        </div>
                        <div
                          className={`nh3d-option-select-controls${
                            isTilesetSelect
                              ? " nh3d-option-select-controls-tileset"
                              : ""
                          }`}
                        >
                          {isTilesetSelect ? (
                            <button
                              className="nh3d-menu-action-button"
                              onClick={openTilesetManager}
                              type="button"
                            >
                              {t.dialogs.clientOptions.buttons.manageTileSets}
                            </button>
                          ) : null}
                          <select
                            className="nh3d-startup-config-select"
                            disabled={selectDisabled}
                            onChange={(event) => {
                              if (option.key === "locale") {
                                const nextValue =
                                  resolveSupportedLocale(event.target.value) ??
                                  clientOptionsDraft.locale;
                                updateClientOptionDraft(option.key, nextValue);
                                return;
                              }
                              if (option.key === "tilesetMode") {
                                updateClientOptionDraft(
                                  option.key,
                                  event.target.value === "tiles"
                                    ? "tiles"
                                    : "ascii",
                                );
                                return;
                              }
                              if (option.key === "tilesetPath") {
                                updateTilesetPathDraft(event.target.value);
                                return;
                              }
                              if (option.key === "inventoryFixedTileSize") {
                                const nextValue =
                                  event.target.value === "none" ||
                                  event.target.value === "small" ||
                                  event.target.value === "large"
                                    ? event.target.value
                                    : "medium";
                                updateClientOptionDraft(option.key, nextValue);
                                return;
                              }
                              if (option.key === "desktopTouchInterfaceMode") {
                                const nextValue =
                                  event.target.value === "portrait" ||
                                  event.target.value === "landscape"
                                    ? event.target.value
                                    : "off";
                                updateClientOptionDraft(option.key, nextValue);
                                return;
                              }
                              if (option.key === "bloodDetail") {
                                const nextValue =
                                  event.target.value === "veryLow" ||
                                  event.target.value === "low" ||
                                  event.target.value === "high"
                                    ? event.target.value
                                    : "medium";
                                updateClientOptionDraft(option.key, nextValue);
                                return;
                              }
                              updateClientOptionDraft(
                                option.key,
                                event.target.value === "taa" ? "taa" : "fxaa",
                              );
                            }}
                            value={String(clientOptionsDraft[option.key])}
                          >
                            {selectOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  }
                  if (option.type === "slider") {
                    const sliderValue = clientOptionsDraft[option.key];
                    const isManualBottomSafeZoneSlider =
                      option.key === "manualMobileBottomSafeZoneVerticalPx" ||
                      option.key === "manualMobileBottomSafeZoneHorizontalPx";
                    const isManualRightSafeZoneSlider =
                      option.key === "manualMobileRightSafeZoneHorizontalPx";
                    const isManualSafeZoneSlider =
                      isManualBottomSafeZoneSlider ||
                      isManualRightSafeZoneSlider;
                    const sliderDisabledByFpsMode =
                      (option.key === "controllerFpsMoveRepeatMs" ||
                        option.key === "fpsFov" ||
                        option.key === "fpsLookSensitivityX" ||
                        option.key === "fpsLookSensitivityY") &&
                      !clientOptionsDraft.fpsMode;
                    const sliderDisabledByController =
                      option.key === "controllerFpsMoveRepeatMs" &&
                      !clientOptionsDraft.controllerEnabled;
                    const sliderDisabledByBlood =
                      option.key === "bloodStrength" &&
                      !clientOptionsDraft.bloodMist &&
                      !clientOptionsDraft.bloodGround;
                    const sliderDisabledByManualSafeZone =
                      isManualSafeZoneSlider &&
                      !clientOptionsDraft.manualMobileBottomSafeZoneEnabled;
                    const sliderDisabled =
                      sliderDisabledByFpsMode ||
                      sliderDisabledByController ||
                      sliderDisabledByBlood ||
                      sliderDisabledByManualSafeZone;
                    const sliderLabel =
                      option.key === "bloodStrength"
                        ? `${sliderValue.toFixed(2)}x`
                        : option.key === "gamma"
                        ? `${sliderValue.toFixed(2)}x`
                      : option.key === "fpsFov"
                          ? `${Math.round(sliderValue)}\u00b0`
                          : isManualSafeZoneSlider
                            ? `${Math.round(sliderValue)}px`
                          : option.key === "fpsLookSensitivityX" ||
                              option.key === "fpsLookSensitivityY"
                            ? `${sliderValue.toFixed(2)}x`
                            : option.key === "uiFontScale" ||
                                option.key === "liveMessageLogFontScale" ||
                                option.key === "desktopMessageLogWindowScale"
                              ? `${Math.round(sliderValue * 100)}%`
                              : option.key === "controllerFpsMoveRepeatMs" ||
                                  option.key === "liveMessageDisplayTimeMs" ||
                                  option.key === "liveMessageFadeOutTimeMs"
                                ? `${Math.round(sliderValue)}ms`
                                : `${Math.round(sliderValue * 100)}%`;
                    return (
                      <div
                        className={`nh3d-option-row nh3d-option-row-slider${
                          sliderDisabled ? " nh3d-option-row-mode-inactive" : ""
                        }`}
                        key={option.key}
                      >
                        <div className="nh3d-option-copy">
                          <div className="nh3d-option-label">
                            {option.label}
                          </div>
                          <div className="nh3d-option-description">
                            {option.description}
                          </div>
                        </div>
                        <div className="nh3d-option-slider-control">
                          <input
                            aria-label={option.label}
                            className="nh3d-option-slider"
                            disabled={sliderDisabled}
                            max={option.max}
                            min={option.min}
                            onBlur={() => {
                              if (isManualSafeZoneSlider) {
                                setManualSafeZonePreview(null);
                              }
                            }}
                            onFocus={() => {
                              if (isManualBottomSafeZoneSlider) {
                                showManualSafeZonePreview("bottom", sliderValue);
                              } else if (isManualRightSafeZoneSlider) {
                                showManualSafeZonePreview("right", sliderValue);
                              }
                            }}
                            onInput={(event) => {
                              const nextValue = Number(
                                event.currentTarget.value,
                              );
                              updateClientSliderDraft(option.key, nextValue);
                              if (isManualBottomSafeZoneSlider) {
                                showManualSafeZonePreview("bottom", nextValue);
                              } else if (isManualRightSafeZoneSlider) {
                                showManualSafeZonePreview("right", nextValue);
                              }
                            }}
                            onChange={(event) => {
                              const nextValue = Number(
                                event.currentTarget.value,
                              );
                              updateClientSliderDraft(option.key, nextValue);
                              if (isManualBottomSafeZoneSlider) {
                                showManualSafeZonePreview("bottom", nextValue);
                              } else if (isManualRightSafeZoneSlider) {
                                showManualSafeZonePreview("right", nextValue);
                              }
                            }}
                            onPointerDown={() => {
                              if (isManualBottomSafeZoneSlider) {
                                showManualSafeZonePreview("bottom", sliderValue);
                              } else if (isManualRightSafeZoneSlider) {
                                showManualSafeZonePreview("right", sliderValue);
                              }
                            }}
                            step={option.step}
                            type="range"
                            value={sliderValue}
                          />
                          <div className="nh3d-option-slider-value">
                            {sliderLabel}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (option.type === "color") {
                    const colorValue = normalizeSolidChromaKeyHex(
                      String(clientOptionsDraft[option.key] || ""),
                    );
                    const colorDisabled =
                      option.key === "bloodMistColorHex"
                        ? !clientOptionsDraft.bloodMist
                        : !clientOptionsDraft.bloodGround;
                    return (
                      <div
                        className={`nh3d-option-row${
                          colorDisabled ? " nh3d-option-row-mode-inactive" : ""
                        }`}
                        key={option.key}
                      >
                        <div className="nh3d-option-copy">
                          <div className="nh3d-option-label">
                            {option.label}
                          </div>
                          <div className="nh3d-option-description">
                            {option.description}
                          </div>
                        </div>
                        <div className="nh3d-option-select-controls">
                          <input
                            aria-label={option.label}
                            className="nh3d-option-solid-color-native-picker"
                            disabled={colorDisabled}
                            onChange={(event) =>
                              updateClientOptionDraft(
                                option.key,
                                normalizeSolidChromaKeyHex(
                                  event.target.value,
                                  colorValue,
                                ),
                              )
                            }
                            type="color"
                            value={colorValue}
                          />
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
                <SoundPackSettings
                  onDialogActionsChange={(actions) => {
                    soundPackDialogActionsRef.current = actions;
                  }}
                  requestConfirmation={requestConfirmation}
                  visible={selectedClientOptionsTab.id === "sound"}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="nh3d-menu-actions">
          <button
            className="nh3d-menu-action-button nh3d-menu-action-confirm"
            onClick={requestConfirmClientOptionsDialog}
            type="button"
          >
            {commonStrings.confirm}
          </button>
          <button
            className="nh3d-menu-action-button nh3d-menu-action-cancel"
            onClick={requestCloseClientOptionsDialog}
            type="button"
          >
            {commonStrings.cancel}
          </button>
          <button
            className="nh3d-menu-action-button"
            onClick={openResetClientOptionsConfirmation}
            type="button"
          >
            {commonStrings.resetToDefaults}
          </button>
        </div>
      </AnimatedDialog>

      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions"
        open={isClientOptionsVisible && isResetClientOptionsConfirmationVisible}
        id="nh3d-reset-client-options-confirmation-dialog"
      >
        <div className="nh3d-question-text">
          {t.dialogs.clientOptions.resetPrompt}
        </div>
        <div className="nh3d-menu-actions">
          <button
            className="nh3d-menu-action-button nh3d-menu-action-confirm"
            onClick={confirmResetClientOptionsToDefaults}
            type="button"
          >
            {commonStrings.yes}
          </button>
          <button
            className="nh3d-menu-action-button nh3d-menu-action-cancel"
            onClick={cancelResetClientOptionsConfirmation}
            type="button"
          >
            {commonStrings.no}
          </button>
        </div>
      </AnimatedDialog>

      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-options nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-dialog-controller-remap"
        open={isClientOptionsVisible && isControllerRemapVisible}
        id="nh3d-controller-remap-dialog"
      >
        {renderMobileDialogCloseButton(
          closeControllerRemapDialog,
          t.dialogs.clientOptions.controllerRemap.closeLabel,
        )}
        <div className="nh3d-options-title">
          {t.dialogs.clientOptions.controllerRemap.title}
        </div>
        <div className="nh3d-controller-remap-hint">
          {t.dialogs.clientOptions.controllerRemap.hint}
        </div>
        <div className="nh3d-controller-remap-status">
          {controllerRemapListening
            ? t.dialogs.clientOptions.controllerRemap.listeningFor(
                controllerRemapListeningActionLabel,
                controllerRemapListening.slotIndex + 1,
              )
            : connectedControllerCount > 0
              ? translationStrings.controller.controllerDetected(
                  connectedControllerCount,
                )
              : translationStrings.controller.noControllerDetected}
        </div>
        <div className="nh3d-overflow-glow-frame nh3d-controller-remap-list-shell">
          <div
            className="nh3d-controller-remap-list"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
          >
            {controllerActionGroupOrder.map((group) => (
              <section
                className="nh3d-controller-remap-group"
                key={`controller-remap-group-${group}`}
              >
                <div className="nh3d-controller-remap-group-title">
                  {nh3dControllerActionGroupLabels[group]}
                </div>
                {nh3dControllerActionSpecsByGroup[group].map((spec) => {
                  const slots = clientOptionsDraft.controllerBindings[
                    spec.id
                  ] ?? [null, null];
                  return (
                    <div
                      className="nh3d-controller-remap-action-row"
                      key={spec.id}
                    >
                      <div className="nh3d-controller-remap-action-copy">
                        <div className="nh3d-controller-remap-action-label">
                          {spec.label}
                        </div>
                        <div className="nh3d-controller-remap-action-description">
                          {spec.description}
                        </div>
                      </div>
                      <div className="nh3d-controller-remap-slots">
                        {([0, 1] as const).map((slotIndex) => {
                          const binding = slots[slotIndex] ?? null;
                          const listeningForSlot =
                            controllerRemapListening?.actionId === spec.id &&
                            controllerRemapListening?.slotIndex === slotIndex;
                          return (
                            <div
                              className="nh3d-controller-remap-slot"
                              key={`${spec.id}-slot-${slotIndex}`}
                            >
                              <button
                                className={`nh3d-controller-remap-slot-button${
                                  listeningForSlot ? " is-listening" : ""
                                }`}
                                onClick={() =>
                                  beginControllerBindingCapture(
                                    spec.id,
                                    slotIndex,
                                  )
                                }
                                type="button"
                              >
                                <span className="nh3d-controller-remap-slot-label">
                                  {translationStrings.controller.slotLabel(
                                    slotIndex,
                                  )}
                                </span>
                                <span className="nh3d-controller-remap-slot-value">
                                  {listeningForSlot
                                    ? translationStrings.controller.listening
                                    : formatNh3dControllerBindingLabel(binding)}
                                </span>
                              </button>
                              <button
                                className="nh3d-controller-remap-clear-button"
                                onClick={() => {
                                  setControllerBindingSlotDraft(
                                    spec.id,
                                    slotIndex,
                                    null,
                                  );
                                  if (listeningForSlot) {
                                    clearControllerBindingCapture();
                                  }
                                }}
                                type="button"
                              >
                                {translationStrings.controller.clear}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        </div>
        <div className="nh3d-menu-actions">
          <button
            className="nh3d-menu-action-button nh3d-menu-action-confirm"
            onClick={closeControllerRemapDialog}
            type="button"
          >
            {commonStrings.done}
          </button>
          <button
            className="nh3d-menu-action-button"
            onClick={resetControllerBindingsToDefaultsDraft}
            type="button"
          >
            {t.dialogs.clientOptions.buttons.resetControllerDefaults}
          </button>
        </div>
      </AnimatedDialog>

      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-options nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-dialog-tileset-manager"
        open={isClientOptionsVisible && isTilesetManagerVisible}
        id="nh3d-tileset-manager-dialog"
      >
        {renderMobileDialogCloseButton(
          closeTilesetManager,
          t.dialogs.tilesetManager.closeLabel,
        )}
        <div className="nh3d-options-title">
          {t.dialogs.tilesetManager.title}
        </div>
        <div className="nh3d-option-description">
          {t.dialogs.tilesetManager.description}
        </div>
        <div className="nh3d-tileset-manager-content-shell">
          <div className="nh3d-tileset-manager-content">
            <div className="nh3d-overflow-glow-frame nh3d-tileset-manager-editor-shell">
              <div
                className="nh3d-tileset-manager-upload"
                data-nh3d-overflow-glow
                data-nh3d-overflow-glow-host="parent"
              >
                <div className="nh3d-tileset-manager-header">
                  <div className="nh3d-option-label">
                    {tilesetManagerInNewMode
                      ? t.dialogs.tilesetManager.createTitle
                      : selectedTilesetManagerEditEntry
                        ? t.dialogs.tilesetManager.editTitleWithName(
                            selectedTilesetManagerEditEntry.label,
                          )
                        : t.dialogs.tilesetManager.editTitle}
                  </div>
                </div>
                <div className="nh3d-tileset-manager-upload-row">
                  <label
                    className="nh3d-option-label"
                    htmlFor="nh3d-tileset-name"
                  >
                    {t.dialogs.tilesetManager.tileSetName}
                  </label>
                  <input
                    className="nh3d-text-input nh3d-tileset-manager-input"
                    id="nh3d-tileset-name"
                    onChange={(event) =>
                      setTilesetManagerName(event.target.value)
                    }
                    placeholder={t.dialogs.tilesetManager.tileSetPlaceholder}
                    readOnly={tilesetManagerNameInputDisabled}
                    type="text"
                    value={tilesetManagerName}
                  />
                  {tilesetManagerNameInputDisabled ? (
                    <div className="nh3d-option-description">
                      {t.dialogs.tilesetManager.builtInNamesLocked}
                    </div>
                  ) : null}
                </div>
                {tilesetManagerInNewMode ||
                selectedTilesetManagerEditUserRecord ? (
                  <div className="nh3d-tileset-manager-upload-row">
                    <label
                      className="nh3d-option-label"
                      htmlFor="nh3d-tileset-version"
                    >
                      {t.dialogs.tilesetManager.tileLayoutVersion}
                    </label>
                    <select
                      className="nh3d-startup-config-select"
                      id="nh3d-tileset-version"
                      onChange={(event) =>
                        setTilesetManagerTileLayoutVersion(
                          event.target.value === "slashem"
                            ? "slashem"
                            : event.target.value === "5.0"
                              ? "5.0"
                              : event.target.value === "3.4.3"
                                ? "3.4.3"
                                : "3.6.7",
                        )
                      }
                      value={tilesetManagerTileLayoutVersion}
                    >
                      <option value="slashem">Slash&apos;EM layout</option>
                      <option value="3.4.3">NetHack 3.4.3 layout</option>
                      <option value="3.6.7">
                        {t.dialogs.tilesetManager.layout367}
                      </option>
                      <option value="5.0">
                        {t.dialogs.tilesetManager.layout5}
                      </option>
                    </select>
                    <div className="nh3d-option-description">
                      {t.dialogs.tilesetManager.tileLayoutDescription}
                    </div>
                  </div>
                ) : null}
                {tilesetManagerInNewMode ||
                selectedTilesetManagerEditUserRecord ? (
                  <div className="nh3d-tileset-manager-upload-row">
                    <label
                      className="nh3d-option-label"
                      htmlFor="nh3d-tileset-upload-file"
                    >
                      {tilesetManagerInNewMode
                        ? t.dialogs.tilesetManager.tileImage
                        : t.dialogs.tilesetManager.tileImageOptional}
                    </label>
                    <input
                      accept=".png,.bmp,.gif,.jpg,.jpeg,image/*"
                      className="nh3d-tileset-manager-file-input"
                      id="nh3d-tileset-upload-file"
                      onChange={handleTilesetManagerFileChange}
                      ref={tilesetManagerFileInputRef}
                      type="file"
                    />
                    <div className="nh3d-option-description">
                      {tilesetManagerFile
                        ? t.dialogs.tilesetManager.selectedFile(
                            tilesetManagerFile.name,
                          )
                        : tilesetManagerInNewMode
                          ? t.tilesets.chooseFile
                          : t.dialogs.tilesetManager.currentFile(
                              selectedTilesetManagerEditUserRecord?.fileName ||
                                t.dialogs.tilesetManager.uploadedImage,
                            )}
                    </div>
                  </div>
                ) : null}
                {selectedTilesetManagerEditEntry ? (
                  <Fragment>
                    <div className="nh3d-option-row nh3d-option-row-inline-toggle">
                      <div className="nh3d-option-copy">
                        <div className="nh3d-option-label">
                          {t.dialogs.tilesetManager.weaponSpriteFlip}
                        </div>
                        <div className="nh3d-option-description">
                          {
                            t.dialogs.tilesetManager
                              .weaponSpriteFlipDescription
                          }
                        </div>
                      </div>
                      <button
                        aria-checked={tilesetManagerWeaponSpriteFlipX}
                        className={`nh3d-option-switch nh3d-option-inline-switch${
                          tilesetManagerWeaponSpriteFlipX ? " is-on" : ""
                        }`}
                        onClick={() =>
                          updateTilesetWeaponSpriteFlipXDraft(
                            !tilesetManagerWeaponSpriteFlipX,
                            selectedTilesetManagerEditPath,
                          )
                        }
                        role="switch"
                        type="button"
                      >
                        <span className="nh3d-option-switch-thumb" />
                      </button>
                    </div>
                    <div className="nh3d-option-description">
                      {t.dialogs.tilesetManager.backgroundRemovalDescription}
                    </div>
                    <div
                      className={`nh3d-option-row nh3d-option-row-inline-toggle nh3d-option-row-has-secondary-controls${
                        tilesetManagerBackgroundRemovalMode === "tile"
                          ? ""
                          : " nh3d-option-row-mode-inactive"
                      }`}
                    >
                      <div className="nh3d-option-copy">
                        <div className="nh3d-option-label">
                          {t.dialogs.tilesetManager.backgroundTileRemoval}
                        </div>
                        <div className="nh3d-option-description">
                          {
                            t.dialogs.tilesetManager
                              .backgroundTileRemovalDescription
                          }
                        </div>
                      </div>
                      <div className="nh3d-option-toggle-controls nh3d-option-secondary-controls">
                        <button
                          className={`nh3d-option-tile-picker-button${
                            tilesetManagerBackgroundRemovalMode === "tile"
                              ? ""
                              : " is-disabled"
                          }`}
                          disabled={
                            tilesetManagerBackgroundRemovalMode !== "tile"
                          }
                          onClick={() =>
                            setIsTilesetBackgroundTilePickerVisible(true)
                          }
                          type="button"
                        >
                          <span className="nh3d-option-tile-picker-preview">
                            {renderTilesetManagerTilePreviewImage(
                              tilesetManagerBackgroundTileId,
                            )}
                          </span>
                          <span className="nh3d-option-tile-picker-copy">
                            <span className="nh3d-option-tile-picker-glyph">
                              {tilesetManagerBackgroundGlyphLabel}
                            </span>
                            <span className="nh3d-option-tile-picker-id">
                              tile #{tilesetManagerBackgroundTileId}
                            </span>
                          </span>
                        </button>
                      </div>
                      <button
                        aria-checked={
                          tilesetManagerBackgroundRemovalMode === "tile"
                        }
                        className={`nh3d-option-switch nh3d-option-inline-switch${
                          tilesetManagerBackgroundRemovalMode === "tile"
                            ? " is-on"
                            : ""
                        }`}
                        disabled={isNh3dTilesetBackgroundRemovalModeForcedOff(
                          selectedTilesetManagerEditPath,
                        )}
                        onClick={() =>
                          updateTilesetBackgroundRemovalModeDraft(
                            tilesetManagerBackgroundRemovalMode === "tile"
                              ? "none"
                              : "tile",
                            selectedTilesetManagerEditPath,
                          )
                        }
                        role="switch"
                        type="button"
                      >
                        <span className="nh3d-option-switch-thumb" />
                      </button>
                    </div>
                    <div
                      className={`nh3d-option-row nh3d-option-row-inline-toggle nh3d-option-row-has-secondary-controls${
                        tilesetManagerBackgroundRemovalMode === "solid"
                          ? ""
                          : " nh3d-option-row-mode-inactive"
                      }`}
                    >
                      <div className="nh3d-option-copy">
                        <div className="nh3d-option-label">
                          {t.dialogs.tilesetManager.solidChromaKey}
                        </div>
                        <div className="nh3d-option-description">
                          {t.dialogs.tilesetManager.solidChromaKeyDescription}
                        </div>
                      </div>
                      <div className="nh3d-option-toggle-controls nh3d-option-secondary-controls">
                        <button
                          className={`nh3d-option-tile-picker-button${
                            tilesetManagerBackgroundRemovalMode === "solid"
                              ? ""
                              : " is-disabled"
                          }`}
                          disabled={
                            tilesetManagerBackgroundRemovalMode !== "solid"
                          }
                          onClick={() =>
                            setIsTilesetSolidColorPickerVisible(true)
                          }
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            className="nh3d-option-solid-color-preview"
                            style={{
                              backgroundColor: normalizeSolidChromaKeyHex(
                                tilesetManagerSolidChromaKeyColorHex,
                              ),
                            }}
                          />
                          <span className="nh3d-option-tile-picker-copy">
                            <span className="nh3d-option-tile-picker-glyph">
                              {formatSolidChromaKeyHex(
                                tilesetManagerSolidChromaKeyColorHex,
                              )}
                            </span>
                            <span className="nh3d-option-tile-picker-id">
                              {t.dialogs.tilesetManager.clickToPickFromAtlas}
                            </span>
                          </span>
                        </button>
                        <input
                          className="nh3d-option-solid-color-input"
                          readOnly
                          type="text"
                          value={formatSolidChromaKeyHex(
                            tilesetManagerSolidChromaKeyColorHex,
                          )}
                        />
                      </div>
                      <button
                        aria-checked={
                          tilesetManagerBackgroundRemovalMode === "solid"
                        }
                        className={`nh3d-option-switch nh3d-option-inline-switch${
                          tilesetManagerBackgroundRemovalMode === "solid"
                            ? " is-on"
                            : ""
                        }`}
                        disabled={isNh3dTilesetBackgroundRemovalModeForcedOff(
                          selectedTilesetManagerEditPath,
                        )}
                        onClick={() =>
                          updateTilesetBackgroundRemovalModeDraft(
                            tilesetManagerBackgroundRemovalMode === "solid"
                              ? "none"
                              : "solid",
                            selectedTilesetManagerEditPath,
                          )
                        }
                        role="switch"
                        type="button"
                      >
                        <span className="nh3d-option-switch-thumb" />
                      </button>
                    </div>
                  </Fragment>
                ) : (
                  <div className="nh3d-option-description">
                    {t.dialogs.tilesetManager.saveFirstThenEdit}
                  </div>
                )}
                <div className="nh3d-tileset-manager-upload-actions">
                  <button
                    className="nh3d-menu-action-button nh3d-menu-action-confirm"
                    disabled={tilesetManagerBusy}
                    onClick={() => {
                      void saveTilesetManager();
                    }}
                    type="button"
                  >
                    {tilesetManagerInNewMode
                      ? t.dialogs.tilesetManager.createTileSet
                      : selectedTilesetManagerEditUserRecord
                        ? t.dialogs.tilesetManager.saveTileSet
                        : t.dialogs.tilesetManager.saveTileSettings}
                  </button>
                </div>
              </div>
            </div>
            {tilesetManagerError ? (
              <div className="nh3d-tileset-manager-error">
                {tilesetManagerError}
              </div>
            ) : null}
            <div className="nh3d-tileset-manager-divider" />
            <button
              className="nh3d-menu-action-button"
              disabled={tilesetManagerBusy}
              onClick={openTilesetManagerNewEditor}
              type="button"
            >
              {t.dialogs.tilesetManager.importNewTileSet}
            </button>
            <div className="nh3d-overflow-glow-frame nh3d-tileset-manager-list-shell">
              <div
                className="nh3d-tileset-manager-list"
                data-nh3d-overflow-glow
                data-nh3d-overflow-glow-host="parent"
              >
                {tilesetManagerListTilesets.length === 0 ? (
                  <div className="nh3d-option-description">
                    {t.dialogs.tilesetManager.noUploadedTilesets}
                  </div>
                ) : (
                  tilesetManagerListTilesets.map((tileset) => {
                    const tilesetPath = String(tileset.path || "").trim();
                    const isSelected =
                      clientOptionsDraft.tilesetPath === tilesetPath;
                    const isEditing =
                      !tilesetManagerInNewMode &&
                      selectedTilesetManagerEditPath === tilesetPath;
                    const userRecord = userTilesetRecordByPath.get(tilesetPath);
                    const isUserTileset = tileset.source === "user";
                    return (
                      <div
                        className="nh3d-tileset-manager-item"
                        key={tilesetPath}
                      >
                        <div className="nh3d-tileset-manager-item-copy">
                          <div className="nh3d-option-label">
                            {tileset.label}
                            {isSelected
                              ? t.dialogs.tilesetManager.selectedSuffix
                              : ""}
                            {isEditing
                              ? t.dialogs.tilesetManager.editingSuffix
                              : ""}
                          </div>
                          <div className="nh3d-option-description">
                            {isUserTileset
                              ? t.dialogs.tilesetManager.uploadedDetails(
                                  userRecord?.fileName || tilesetPath,
                                  resolveTilesetLayoutShortLabel(
                                    tileset.tileLayoutVersion,
                                  ),
                                )
                              : t.dialogs.tilesetManager.builtInDetails(
                                  resolveTilesetLayoutDisplayLabel(
                                    tileset.tileLayoutVersion,
                                  ),
                                )}
                          </div>
                        </div>
                        <div className="nh3d-tileset-manager-item-actions">
                          <button
                            className="nh3d-menu-action-button"
                            onClick={() =>
                              openTilesetManagerEditor(tilesetPath)
                            }
                            type="button"
                          >
                            {commonStrings.edit}
                          </button>
                          {isUserTileset ? (
                            <button
                              aria-label={`Delete ${tileset.label}`}
                              className="delete-button"
                              disabled={tilesetManagerBusy || !userRecord}
                              onClick={() => {
                                if (!userRecord) {
                                  return;
                                }
                                void removeUserTileset(userRecord);
                              }}
                              type="button"
                            >
                              X
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="nh3d-menu-actions">
          <button
            className="nh3d-menu-action-button"
            onClick={closeTilesetManager}
            type="button"
          >
            {commonStrings.done}
          </button>
        </div>
      </AnimatedDialog>

      <TilesetTilePickerDialog
        closeLabel={t.tilePicker.closeDarkWall}
        defaultTileId={defaultDarkWallTileId}
        dialogId="nh3d-dark-wall-tile-picker-dialog"
        entries={tilePickerEntries}
        onDone={() => setIsDarkWallTilePickerVisible(false)}
        onResetToDefault={() =>
          updateDarkWallTileOverrideTileIdDraft(defaultDarkWallTileId)
        }
        onSelectTile={updateDarkWallTileOverrideTileIdDraft}
        renderMobileCloseButton={renderMobileDialogCloseButton}
        renderTilePreviewImage={renderTilePreviewImageForOptions}
        selectedGlyphLabel={selectedDarkWallGlyphLabel}
        selectedGlyphNumber={selectedDarkWallGlyphNumber}
        selectedTileId={selectedDarkWallTileId}
        showGlyphNumber={showTilePickerGlyphNumber}
        statusText={tilePickerStatusText}
        tileAtlasLoaded={tileAtlasState.loaded}
        title={t.tilePicker.darkWallTitle}
        visible={isClientOptionsVisible && isDarkWallTilePickerVisible}
      />

      <TilesetTilePickerDialog
        closeLabel={t.tilePicker.closeBackground}
        defaultTileId={tilesetManagerDefaultBackgroundTileId}
        dialogId="nh3d-tileset-background-tile-picker-dialog"
        entries={tilesetManagerTilePickerEntries}
        helperText={t.tilePicker.backgroundHelper}
        onDone={() => setIsTilesetBackgroundTilePickerVisible(false)}
        onResetToDefault={() =>
          updateTilesetBackgroundTileIdDraft(
            tilesetManagerDefaultBackgroundTileId,
            selectedTilesetManagerEditPath,
            tilesetManagerAtlasState.tileCount,
          )
        }
        onSelectTile={(tileId) =>
          updateTilesetBackgroundTileIdDraft(
            tileId,
            selectedTilesetManagerEditPath,
            tilesetManagerAtlasState.tileCount,
          )
        }
        renderMobileCloseButton={renderMobileDialogCloseButton}
        renderTilePreviewImage={renderTilesetManagerTilePreviewImage}
        selectedGlyphLabel={tilesetManagerBackgroundGlyphLabel}
        selectedGlyphNumber={tilesetManagerBackgroundGlyphNumber}
        selectedTileId={tilesetManagerBackgroundTileId}
        showGlyphNumber={showTilePickerGlyphNumber}
        statusText={tilesetManagerTilePickerStatusText}
        tileAtlasLoaded={tilesetManagerAtlasState.loaded}
        title={
          selectedTilesetManagerEditEntry
            ? t.tilePicker.backgroundTitleWithLabel(
                selectedTilesetManagerEditEntry.label,
              )
            : t.tilePicker.backgroundTitle
        }
        visible={
          isClientOptionsVisible &&
          isTilesetManagerVisible &&
          Boolean(selectedTilesetManagerEditPath) &&
          isTilesetBackgroundTilePickerVisible
        }
      />

      <TilesetSolidColorPickerDialog
        atlasImage={tilesetManagerAtlasImage}
        atlasWidthPx={
          tilesetManagerAtlasState.columns *
          tilesetManagerAtlasState.tileSourceSize
        }
        closeLabel={t.tilePicker.closeSolidColor}
        dialogId="nh3d-tileset-solid-color-picker-dialog"
        onDone={() => setIsTilesetSolidColorPickerVisible(false)}
        onSelectColorHex={(rawHex) =>
          updateTilesetSolidChromaKeyColorHexDraft(
            rawHex,
            selectedTilesetManagerEditPath,
          )
        }
        renderMobileCloseButton={renderMobileDialogCloseButton}
        selectedColorHex={tilesetManagerSolidChromaKeyColorHex}
        statusText={tilesetManagerTilePickerStatusText}
        tileAtlasLoaded={tilesetManagerAtlasState.loaded}
        tileSourceSize={tilesetManagerAtlasState.tileSourceSize}
        title={
          selectedTilesetManagerEditEntry
            ? t.tilePicker.solidColorTitleWithLabel(
                selectedTilesetManagerEditEntry.label,
              )
            : t.tilePicker.solidColorTitle
        }
        visible={
          isClientOptionsVisible &&
          isTilesetManagerVisible &&
          Boolean(selectedTilesetManagerEditPath) &&
          isTilesetSolidColorPickerVisible
        }
      />

      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-text nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close"
        open={Boolean(textInputRequest)}
        id="text-input-dialog"
      >
        {textInputRequest ? (
          <>
            {renderMobileDialogCloseButton(
              () => submitTextInput(""),
              t.dialogs.textInput.cancelLabel,
            )}
            {textInputRequest.contextMessage ? (
              <div className="nh3d-text-input-context" role="note">
                <div className="nh3d-text-input-context-value">
                  {textInputRequest.contextMessage}
                </div>
              </div>
            ) : null}
            <div className="nh3d-question-text">{textInputRequest.text}</div>
            <input
              className="nh3d-text-input"
              maxLength={textInputRequest.maxLength ?? 256}
              onChange={(event) => setTextInputValue(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitTextInput(textInputValue);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  submitTextInput("");
                }
              }}
              placeholder={
                textInputRequest.placeholder ?? t.dialogs.textInput.placeholder
              }
              ref={textInputRef}
              type="text"
              value={textInputValue}
            />
            <div className="nh3d-menu-actions">
              <button
                className="nh3d-menu-action-button nh3d-menu-action-confirm"
                onClick={() => submitTextInput(textInputValue)}
                type="button"
              >
                {t.dialogs.textInput.ok}
              </button>
              <button
                className="nh3d-menu-action-button nh3d-menu-action-cancel"
                onClick={() => submitTextInput("")}
                type="button"
              >
                {commonStrings.cancel}
              </button>
            </div>
          </>
        ) : null}
      </AnimatedDialog>

      <AnimatedDialog
        className={`nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close${
          question?.menuItems.length === 0 && isYesNoQuestionChoices
            ? " nh3d-dialog-question-yes-no"
            : ""
        }${enhanceMenuData ? " nh3d-dialog-question-enhance" : ""}${
          castMenuData ? " nh3d-dialog-question-cast" : ""
        }${
          useSlashEmLegacyShortcutChoiceDialog
            ? " nh3d-dialog-question-legacy-shortcuts"
            : ""
        }${techniqueMenuData ? " nh3d-dialog-question-technique" : ""}`}
        open={Boolean(question)}
        id="question-dialog"
      >
        {question ? (
          <>
            {renderMobileDialogCloseButton(
              () => controller?.cancelActivePrompt(),
              t.dialogs.question.cancelPrompt,
            )}
            <div
              className={`nh3d-question-text${
                showQuestionAmountControls
                  ? " nh3d-question-text-has-amount"
                  : ""
              }`}
            >
              <span className="nh3d-question-title-label">
                {displayedQuestionText}
              </span>
              {showQuestionAmountControls ? (
                <div className="nh3d-question-amount-controls">
                  <button
                    aria-label={t.dialogs.question.decreaseAmount}
                    className="nh3d-question-amount-button"
                    disabled={displayedQuestionPendingCount === null}
                    onClick={() => controller?.stepQuestionSelectionCount(-1)}
                    title={t.dialogs.question.decreaseAmount}
                    type="button"
                  >
                    <Nh3dIcon icon={Nh3dIconArrowDown} size={13} />
                  </button>
                  <input
                    aria-label={t.dialogs.question.amount}
                    className="nh3d-question-amount-input"
                    inputMode="numeric"
                    max={999999}
                    min={1}
                    onChange={(event) => {
                      const nextValue = Number(event.currentTarget.value);
                      controller?.setQuestionSelectionCount(
                        Number.isFinite(nextValue) ? nextValue : null,
                      );
                    }}
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                    }}
                    type="number"
                    value={displayedQuestionPendingCount ?? 1}
                  />
                  <button
                    aria-label={t.dialogs.question.increaseAmount}
                    className="nh3d-question-amount-button"
                    onClick={() => controller?.stepQuestionSelectionCount(1)}
                    title={t.dialogs.question.increaseAmount}
                    type="button"
                  >
                    <Nh3dIcon icon={Nh3dIconArrowUp} size={13} />
                  </button>
                </div>
              ) : null}
            </div>
            {shouldRenderQuestionMenuItems ? (
              question.isPickupDialog ? (
                <>
                  {displayedQuestionMenuItems.map((item, index) => {
                    if (!isSelectableQuestionMenuItem(item)) {
                      return (
                        <div
                          className={
                            item.isCategory
                              ? "nh3d-menu-category"
                              : "nh3d-menu-row"
                          }
                          key={`cat-${index}`}
                        >
                          {item.text}
                        </div>
                      );
                    }
                    const tileApplicable =
                      tilesUiEnabled && isMenuItemTileApplicable(item);
                    const tileIndex = tileApplicable
                      ? resolveMenuItemTileIndex(item)
                      : null;
                    const tilePreview = renderMenuItemTilePreview(
                      item,
                      tileIndex,
                    );
                    const fallbackGlyph = resolveMenuItemFallbackGlyph(item);
                    const selectionInput = getMenuSelectionInput(item);
                    const selectedCount =
                      question.selectedCounts?.[selectionInput] ?? null;
                    return (
                      <div
                        className={`nh3d-pickup-item${
                          question.selectedAccelerators.includes(
                            String(item.accelerator),
                          )
                            ? " nh3d-pickup-item-selected"
                            : ""
                        }${
                          question.activeMenuSelectionInput ===
                          selectionInput
                            ? " nh3d-pickup-item-active"
                            : ""
                        }`}
                        key={`pickup-${item.accelerator}-${index}`}
                        onClick={() =>
                          controller?.togglePickupChoice(selectionInput)
                        }
                        onFocus={() =>
                          controller?.syncQuestionSelectionFocus(selectionInput)
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key === " " ||
                            event.key === "Space" ||
                            event.key === "Spacebar"
                          ) {
                            event.preventDefault();
                            event.stopPropagation();
                            controller?.togglePickupChoice(selectionInput);
                          }
                        }}
                        role="checkbox"
                        aria-checked={question.selectedAccelerators.includes(
                          String(item.accelerator),
                        )}
                        tabIndex={0}
                      >
                        <input
                          checked={question.selectedAccelerators.includes(
                            String(item.accelerator),
                          )}
                          aria-hidden="true"
                          className="nh3d-pickup-checkbox"
                          readOnly
                          tabIndex={-1}
                          type="checkbox"
                        />
                        <span className="nh3d-question-item-leading">
                          {tileApplicable ? (
                            <span
                              className="nh3d-question-item-icon-shell"
                              aria-hidden="true"
                            >
                              {tilePreview ? (
                                <span className="nh3d-question-item-icon-art">
                                  {tilePreview}
                                </span>
                              ) : (
                                <span className="nh3d-question-item-icon-fallback">
                                  {fallbackGlyph}
                                </span>
                              )}
                            </span>
                          ) : null}
                          <span className="nh3d-pickup-key">
                            {item.accelerator})
                          </span>
                        </span>
                        <span className="nh3d-pickup-text">{item.text}</span>
                        {typeof selectedCount === "number" &&
                        Number.isFinite(selectedCount) &&
                        selectedCount > 0 ? (
                          <span className="nh3d-pickup-count">
                            {`x${selectedCount}`}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  {showPickupActionButtons ? (
                    <div className="nh3d-pickup-actions">
                      <button
                        className={`nh3d-pickup-action-button nh3d-pickup-action-confirm${
                          question.activeActionButton === "confirm"
                            ? " nh3d-action-button-active"
                            : ""
                        }`}
                        autoFocus={question.activeActionButton === "confirm"}
                        onClick={() => controller?.confirmPickupChoices()}
                        onFocus={() =>
                          controller?.syncQuestionActionFocus("confirm")
                        }
                        type="button"
                      >
                        {commonStrings.confirm}
                      </button>
                      {showPickupToggleAllButton ? (
                        <button
                          className={`nh3d-pickup-action-button nh3d-pickup-action-toggle-all${
                            question.activeActionButton === "select-all"
                              ? " nh3d-action-button-active"
                              : ""
                          }`}
                          autoFocus={
                            question.activeActionButton === "select-all"
                          }
                          onClick={() => controller?.toggleAllPickupChoices()}
                          onFocus={() =>
                            controller?.syncQuestionActionFocus("select-all")
                          }
                          type="button"
                        >
                          <span className="nh3d-pickup-action-button-label">
                            {question.allPickupSelected
                              ? t.dialogs.question.deselectAll
                              : t.dialogs.question.selectAll}
                          </span>
                          <span
                            aria-hidden="true"
                            className="nh3d-pickup-action-button-sizer"
                          >
                            {t.dialogs.question.deselectAll}
                          </span>
                        </button>
                      ) : null}
                      <button
                        className={`nh3d-pickup-action-button nh3d-pickup-action-cancel${
                          question.activeActionButton === "cancel"
                            ? " nh3d-action-button-active"
                            : ""
                        }`}
                        autoFocus={question.activeActionButton === "cancel"}
                        onClick={() => controller?.cancelActivePrompt()}
                        onFocus={() =>
                          controller?.syncQuestionActionFocus("cancel")
                        }
                        type="button"
                      >
                        {commonStrings.cancel}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : enhanceMenuData ? (
                <>
                  {renderEnhanceMenuContent(enhanceMenuData, {
                    activeMenuSelectionInput: question.activeMenuSelectionInput,
                    onChooseSelectionInput: (selectionInput) =>
                      controller?.chooseQuestionChoice(selectionInput),
                    onFocusSelectionInput: (selectionInput) =>
                      controller?.syncQuestionSelectionFocus(selectionInput),
                  })}
                  <div className="nh3d-menu-actions">
                    <button
                      className={`nh3d-menu-action-button nh3d-menu-action-cancel${
                        question.activeActionButton === "cancel"
                          ? " nh3d-action-button-active"
                          : ""
                      }`}
                      autoFocus={question.activeActionButton === "cancel"}
                      onClick={() => controller?.cancelActivePrompt()}
                      onFocus={() =>
                        controller?.syncQuestionActionFocus("cancel")
                      }
                      type="button"
                    >
                      {commonStrings.cancel}
                    </button>
                  </div>
                </>
              ) : castMenuData ? (
                <>
                  <CastSpellMenu
                    activeSelectionInput={question.activeMenuSelectionInput}
                    menuData={castMenuData}
                    onFocusSpell={(selectionInput) =>
                      controller?.syncQuestionSelectionFocus(selectionInput)
                    }
                    onChooseSpell={(selectionInput) =>
                      controller?.chooseQuestionChoice(selectionInput)
                    }
                  />
                  <div className="nh3d-menu-actions">
                    <button
                      className={`nh3d-menu-action-button nh3d-menu-action-cancel${
                        question.activeActionButton === "cancel"
                          ? " nh3d-action-button-active"
                          : ""
                      }`}
                      autoFocus={question.activeActionButton === "cancel"}
                      onClick={() => controller?.cancelActivePrompt()}
                      onFocus={() =>
                        controller?.syncQuestionActionFocus("cancel")
                      }
                      type="button"
                    >
                      {commonStrings.cancel}
                    </button>
                  </div>
                </>
              ) : techniqueMenuData ? (
                <>
                  <TechniqueMenu
                    activeSelectionInput={question.activeMenuSelectionInput}
                    menuData={techniqueMenuData}
                    onFocusTechnique={(selectionInput) =>
                      controller?.syncQuestionSelectionFocus(selectionInput)
                    }
                    onChooseTechnique={(selectionInput) =>
                      controller?.chooseQuestionChoice(selectionInput)
                    }
                  />
                  <div className="nh3d-menu-actions">
                    <button
                      className={`nh3d-menu-action-button nh3d-menu-action-cancel${
                        question.activeActionButton === "cancel"
                          ? " nh3d-action-button-active"
                          : ""
                      }`}
                      autoFocus={question.activeActionButton === "cancel"}
                      onClick={() => controller?.cancelActivePrompt()}
                      onFocus={() =>
                        controller?.syncQuestionActionFocus("cancel")
                      }
                      type="button"
                    >
                      {commonStrings.cancel}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {displayedQuestionMenuItems.map((item, index) => {
                    if (!isSelectableQuestionMenuItem(item)) {
                      if (
                        isReadOnlyQuestionOptionMenuItem(item, question.text)
                      ) {
                        return (
                          <button
                            className="nh3d-menu-button nh3d-menu-button-readonly"
                            disabled
                            key={`readonly-${index}`}
                            type="button"
                          >
                            <span className="nh3d-menu-button-key">{"-"}</span>
                            <span className="nh3d-menu-button-label">
                              {String(item.text || "").trimStart()}
                            </span>
                          </button>
                        );
                      }
                      return (
                        <div
                          className={
                            item.isCategory
                              ? "nh3d-menu-category"
                              : "nh3d-menu-row"
                          }
                          key={`cat-${index}`}
                        >
                          {item.text}
                        </div>
                      );
                    }
                    const tileApplicable =
                      tilesUiEnabled && isMenuItemTileApplicable(item);
                    const tileIndex = tileApplicable
                      ? resolveMenuItemTileIndex(item)
                      : null;
                    const tilePreview = renderMenuItemTilePreview(
                      item,
                      tileIndex,
                    );
                    const fallbackGlyph = resolveMenuItemFallbackGlyph(item);
                    const selectionInput = getMenuSelectionInput(item);
                    const isActiveSelection =
                      question.activeActionButton === null &&
                      question.activeMenuSelectionInput === selectionInput;
                    return (
                      <button
                        className={`nh3d-menu-button${
                          isActiveSelection ? " nh3d-menu-button-active" : ""
                        }`}
                        autoFocus={isActiveSelection}
                        key={`menu-${selectionInput}-${index}`}
                        onClick={() =>
                          controller?.chooseQuestionChoice(selectionInput)
                        }
                        onFocus={() =>
                          controller?.syncQuestionSelectionFocus(selectionInput)
                        }
                        type="button"
                      >
                        <span className="nh3d-question-item-leading">
                          {tileApplicable ? (
                            <span
                              className="nh3d-question-item-icon-shell"
                              aria-hidden="true"
                            >
                              {tilePreview ? (
                                <span className="nh3d-question-item-icon-art">
                                  {tilePreview}
                                </span>
                              ) : (
                                <span className="nh3d-question-item-icon-fallback">
                                  {fallbackGlyph}
                                </span>
                              )}
                            </span>
                          ) : null}
                          <span className="nh3d-menu-button-key">
                            {item.accelerator})
                          </span>
                        </span>
                        <span className="nh3d-menu-button-label">
                          {item.text}
                        </span>
                      </button>
                    );
                  })}
                  {questionSelectableMenuItemCount > 0 ? (
                    <div className="nh3d-menu-actions">
                      <button
                        className={`nh3d-menu-action-button nh3d-menu-action-cancel${
                          question.activeActionButton === "cancel"
                            ? " nh3d-action-button-active"
                            : ""
                        }`}
                        autoFocus={question.activeActionButton === "cancel"}
                        onClick={() => controller?.cancelActivePrompt()}
                        onFocus={() =>
                          controller?.syncQuestionActionFocus("cancel")
                        }
                        type="button"
                      >
                        {commonStrings.cancel}
                      </button>
                    </div>
                  ) : null}
                </>
              )
            ) : shouldRenderQuestionTextInput ? (
              <>
                <input
                  aria-label={
                    displayedQuestionText || t.dialogs.textInput.placeholder
                  }
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                  autoFocus
                  className="nh3d-text-input nh3d-question-text-input"
                  inputMode="text"
                  maxLength={1}
                  onChange={(event) =>
                    setQuestionTextInputValue(event.target.value)
                  }
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitQuestionTextInput();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      controller?.cancelActivePrompt();
                    }
                  }}
                  placeholder={t.dialogs.textInput.placeholder}
                  ref={questionTextInputRef}
                  spellCheck={false}
                  type="text"
                  value={questionTextInputValue}
                />
                <div className="nh3d-menu-actions">
                  <button
                    className="nh3d-menu-action-button nh3d-menu-action-confirm"
                    onClick={submitQuestionTextInput}
                    type="button"
                  >
                    {t.dialogs.textInput.ok}
                  </button>
                  <button
                    className="nh3d-menu-action-button nh3d-menu-action-cancel"
                    onClick={() => controller?.cancelActivePrompt()}
                    type="button"
                  >
                    {commonStrings.cancel}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="nh3d-overflow-glow-frame">
                  <div
                    className={`nh3d-choice-list${
                      useCompactQuestionChoiceLayout ? " is-compact" : ""
                    }${isYesNoQuestionChoices ? " is-yes-no" : ""}${
                      useSlashEmLegacyShortcutChoiceDialog
                        ? " nh3d-choice-list-legacy-shortcuts"
                        : ""
                    }`}
                    data-nh3d-overflow-glow
                    data-nh3d-overflow-glow-host="parent"
                  >
                    {orderedQuestionChoices.map((choice, index) => {
                      const normalizedChoice = choice.trim();
                      const choiceSourceItem = useInventoryChoiceLabels
                        ? getInventoryItemForQuestionChoice(
                            normalizedChoice,
                            questionChoiceSourceItems,
                          )
                        : null;
                      const choiceSourceItemTileApplicable =
                        Boolean(choiceSourceItem) &&
                        isMenuItemTileApplicable(choiceSourceItem);
                      const legacyChoicePreviewTileIndex =
                        useSlashEmLegacyShortcutChoiceDialog &&
                        normalizedChoice === "."
                          ? controller?.resolveLegacyQuestionChoicePreviewTileIndex(
                              normalizedChoice,
                            ) ?? null
                          : null;
                      const resolvedChoiceTileIndex =
                        legacyChoicePreviewTileIndex ??
                        (choiceSourceItemTileApplicable && choiceSourceItem
                          ? resolveMenuItemTileIndex(choiceSourceItem)
                          : null);
                      const tileApplicable =
                        tilesUiEnabled &&
                        (choiceSourceItemTileApplicable ||
                          legacyChoicePreviewTileIndex !== null);
                      const tileIndex = tileApplicable
                        ? resolvedChoiceTileIndex
                        : null;
                      const tilePreview = renderMenuItemTilePreview(
                        choiceSourceItem,
                        tileIndex,
                      );
                      const fallbackGlyph = resolveMenuItemFallbackGlyph(
                        choiceSourceItem,
                        normalizedChoice.charAt(0) || "?",
                      );
                      return (
                        <button
                          className={`nh3d-choice-button${
                            choice === question.defaultChoice
                              ? " nh3d-choice-button-default"
                              : ""
                          }${
                            tileApplicable ? " nh3d-choice-button-with-tile" : ""
                          }`}
                          autoFocus={
                            question.activeActionButton === null &&
                            (choice === question.defaultChoice ||
                              (question.defaultChoice === "" && index === 0))
                          }
                          data-nh3d-choice-value={choice}
                          key={choice}
                          onClick={() =>
                            controller?.chooseQuestionChoice(choice)
                          }
                          type="button"
                        >
                          {tileApplicable ? (
                            <span
                              className="nh3d-question-item-icon-shell"
                              aria-hidden="true"
                            >
                              {tilePreview ? (
                                <span className="nh3d-question-item-icon-art">
                                  {tilePreview}
                                </span>
                              ) : (
                                <span className="nh3d-question-item-icon-fallback">
                                  {fallbackGlyph}
                                </span>
                              )}
                            </span>
                          ) : null}
                          <span className="nh3d-choice-button-item-label">
                            {getQuestionChoiceLabel(
                              question.text,
                              normalizedChoice,
                              questionChoiceSourceItems,
                              activeRuntimeVersion,
                              useInventoryChoiceLabels,
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {showQuestionCancelButton ? (
                  <div className="nh3d-menu-actions">
                    <button
                      className={`nh3d-menu-action-button nh3d-menu-action-cancel${
                        question.activeActionButton === "cancel"
                          ? " nh3d-action-button-active"
                          : ""
                      }`}
                      autoFocus={question.activeActionButton === "cancel"}
                      onClick={() => controller?.cancelActivePrompt()}
                      onFocus={() =>
                        controller?.syncQuestionActionFocus("cancel")
                      }
                      type="button"
                    >
                      {commonStrings.cancel}
                    </button>
                  </div>
                ) : null}
              </>
            )}
            {question.menuItems.length > 0 && questionMenuPageCount > 1 ? (
              <div className="nh3d-question-pagination">
                <button
                  className="nh3d-question-page-button"
                  disabled={questionMenuPageIndex <= 0}
                  onClick={() => controller?.goToPreviousQuestionMenuPage()}
                  type="button"
                >
                  {"<"}
                </button>
                <div className="nh3d-question-page-indicator">
                  {t.dialogs.question.page(
                    questionMenuPageIndex + 1,
                    questionMenuPageCount,
                  )}
                </div>
                <button
                  className="nh3d-question-page-button"
                  disabled={questionMenuPageIndex >= questionMenuPageCount - 1}
                  onClick={() => controller?.goToNextQuestionMenuPage()}
                  type="button"
                >
                  {">"}
                </button>
              </div>
            ) : null}
            <div className="nh3d-dialog-hint">
              {question.menuItems.length > 0 && questionMenuPageCount > 1
                ? t.dialogs.question.pageHintMultiple
                : t.dialogs.question.pageHintSingle}
            </div>
          </>
        ) : null}
      </AnimatedDialog>

      {/* Keep startup failures pinned in a real dialog so update/runtime
          initialization errors remain readable even after the loading overlay
          is dismissed. */}
      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-dialog-runtime-start-error"
        open={
          runtimeInitializationErrorVisible &&
          !newGamePrompt.visible &&
          !infoMenu &&
          !question
        }
        id="runtime-start-error-dialog"
      >
        {renderMobileDialogCloseButton(
          startNewGameFromPrompt,
          t.dialogs.runtimeStartError.closeLabel,
        )}
        <div className="nh3d-question-text">
          {t.dialogs.runtimeStartError.title}
        </div>
        <div className="nh3d-runtime-start-error-copy">
          {runtimeInitializationErrorMessage}
        </div>
        <div className="nh3d-menu-actions">
          <button
            className="nh3d-menu-action-button nh3d-menu-action-confirm"
            onClick={startNewGameFromPrompt}
            type="button"
          >
            {t.dialogs.runtimeStartError.returnToMainMenu}
          </button>
        </div>
      </AnimatedDialog>

      <AnimatedDialog
        className={`nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-dialog-new-game${
          gameOverDialogShowsTombstone ? " nh3d-dialog-below-logo" : ""
        }`}
        open={newGameDialogVisible}
        id="new-game-dialog"
        onKeyDown={handleNewGamePromptKeyDown}
      >
        {renderMobileDialogCloseButton(
          () => setNewGamePrompt({ visible: false, reason: null }),
          t.dialogs.newGamePrompt.closeLabel,
        )}
        <div className="nh3d-question-text">
          {t.dialogs.newGamePrompt.title}
        </div>
        {gameOverTombstoneLines.length > 0 ? (
          <pre className="nh3d-game-over-tombstone">
            {gameOverTombstoneLines.join("\n")}
          </pre>
        ) : null}
        <div className="nh3d-menu-actions">
          <button
            className="nh3d-menu-action-button nh3d-menu-action-confirm"
            onClick={startNewGameFromPrompt}
            ref={newGamePromptYesButtonRef}
            type="button"
          >
            {commonStrings.yes}
          </button>
          <button
            className="nh3d-menu-action-button nh3d-menu-action-cancel"
            onClick={dismissNewGamePromptUntilInteraction}
            ref={newGamePromptNoButtonRef}
            type="button"
          >
            {commonStrings.no}
          </button>
        </div>
      </AnimatedDialog>

      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-direction nh3d-dialog-direction-fps nh3d-dialog-has-mobile-close"
        open={Boolean(directionQuestion)}
        id="direction-dialog"
        onClick={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("button")) {
            return;
          }
          controller?.confirmActiveDirectionQuestion();
        }}
      >
        {directionQuestion ? (
          <>
            {renderMobileDialogCloseButton(
              () => controller?.cancelActivePrompt(),
              t.dialogs.direction.cancelLabel,
            )}
            <div className="nh3d-direction-text">{directionQuestion}</div>
            <div className="nh3d-direction-fps-hint">
              {isFpsPlayMode
                ? t.directionHelp.fps
                : getDirectionHelpText(
                    numberPadModeEnabled,
                    clientOptions.controllerEnabled,
                  )}
            </div>
          </>
        ) : null}
      </AnimatedDialog>

      <AnimatedDialog
        className={`nh3d-dialog ${
          isCharacterSheetVisible ? "nh3d-dialog-character" : "nh3d-dialog-info"
        }${infoEnhanceMenuData ? " nh3d-dialog-info-enhance" : ""} nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-overflow-glow-frame`}
        open={Boolean(infoMenu)}
        id={isCharacterSheetVisible ? "character-dialog" : "info-menu-dialog"}
        onKeyDown={handleInfoMenuDialogKeyDown}
      >
        {displayedInfoMenu ? (
          <>
            {renderMobileDialogCloseButton(
              closeInfoMenuDialog,
              isCharacterSheetVisible
                ? t.dialogs.info.closeCharacter
                : t.dialogs.info.closeInformation,
            )}
            {isCharacterSheetVisible && characterSheet ? (
              <>
                <div
                  className="nh3d-character-sheet-scroll"
                  data-nh3d-overflow-glow
                  data-nh3d-overflow-glow-host="parent"
                >
                  <div className="nh3d-info-title">
                    {t.dialogs.info.characterTitle}
                  </div>
                  <div className="nh3d-character-xp-block nh3d-character-xp-block-top">
                    <div className="nh3d-character-xp-header">
                      <span>{t.dialogs.info.experienceProgress}</span>
                      <span>
                        {t.dialogs.info.levelLabel(
                          characterExperienceProgress.level,
                        )}
                      </span>
                    </div>
                    <div className="nh3d-character-xp-track">
                      <div
                        className="nh3d-character-xp-fill"
                        style={{
                          width: `${characterExperienceProgress.progressPercent}%`,
                        }}
                      />
                    </div>
                    <div className="nh3d-character-xp-meta">
                      {characterExperienceProgress.isMaxLevel ? (
                        <>
                          {t.dialogs.info.xpAtMaxLevel(
                            formatCharacterNumber(
                              characterExperienceProgress.experiencePoints,
                            ),
                          )}
                        </>
                      ) : (
                        <>
                          {t.dialogs.info.xpToNextLevel(
                            formatCharacterNumber(
                              characterExperienceProgress.experiencePoints,
                            ),
                            formatCharacterNumber(
                              characterExperienceProgress.nextLevelThreshold,
                            ),
                            formatCharacterNumber(
                              characterExperienceProgress.toNextLevel,
                            ),
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="nh3d-character-grid">
                    {isLegacySlashEmBaseAttributesSheet ? (
                      <>
                        <div className="nh3d-character-legacy-summary-row">
                          <section className="nh3d-character-panel nh3d-character-panel-legacy-summary">
                            <div className="nh3d-character-panel-title">
                              Starting
                            </div>
                            {renderCharacterSheetFieldRows(
                              characterSheet.backgroundLines,
                              "character-legacy-starting",
                              { showBadges: false },
                            )}
                          </section>

                          <section className="nh3d-character-panel nh3d-character-panel-legacy-summary">
                            <div className="nh3d-character-panel-title">
                              Current
                            </div>
                            {renderCharacterSheetFieldRows(
                              characterSheet.characteristicsLines,
                              "character-legacy-current",
                              { showBadges: false },
                            )}
                          </section>

                          {showLegacySlashEmDeitiesPanel ? (
                            <section className="nh3d-character-panel nh3d-character-panel-legacy-summary nh3d-character-panel-legacy-deities">
                              <div className="nh3d-character-panel-title">
                                Deities
                              </div>
                              {renderCharacterSheetFieldRows(
                                characterSheet.deityLines,
                                "character-legacy-deities",
                                {
                                  showBadges: false,
                                  highlightCurrent: true,
                                },
                              )}
                            </section>
                          ) : null}
                        </div>

                        <section className="nh3d-character-panel nh3d-character-panel-characteristics">
                          <div className="nh3d-character-panel-title">
                            {t.dialogs.info.characteristics}
                          </div>
                          <div className="nh3d-character-stat-grid">
                            {displayedCharacterStatEntries.map((entry) => (
                              <div
                                className="nh3d-character-stat"
                                key={`character-legacy-stat-${entry.id}`}
                              >
                                <div className="nh3d-character-stat-label">
                                  {entry.label}
                                </div>
                                <div className="nh3d-character-stat-value">
                                  <span className="nh3d-character-stat-current">
                                    {entry.currentValue ||
                                      entry.rawValue ||
                                      "--"}
                                  </span>
                                </div>
                                <div className="nh3d-character-stat-description">
                                  {characterStatDescriptionById[entry.id]}
                                </div>
                              </div>
                            ))}
                            <div className="nh3d-character-stat">
                              <div className="nh3d-character-stat-label">
                                {t.dialogs.info.armorClass}
                              </div>
                              <div className="nh3d-character-stat-value">
                                <span className="nh3d-character-stat-current">
                                  {playerStats.armor}
                                </span>
                              </div>
                              <div className="nh3d-character-stat-description">
                                {armorClassDescription}
                              </div>
                            </div>
                          </div>
                        </section>

                        {renderCharacterCurrentStatusPanel(
                          characterSheet.statusLines,
                          playerStatusBadges,
                        )}

                        {characterSheet.attributeLines.length > 0
                          ? renderCharacterCurrentAttributesPanel(
                              characterSheet.attributeLines,
                            )
                          : null}

                        <section className="nh3d-character-panel nh3d-character-panel-actions">
                          <div className="nh3d-character-panel-title">
                            {t.dialogs.info.characterActions}
                          </div>
                          <div className="nh3d-character-actions-grid">
                            <button
                              className="nh3d-character-action-button"
                              onClick={() =>
                                controller?.toggleInventoryDialog()
                              }
                              type="button"
                            >
                              <span className="nh3d-character-action-label">
                                {t.dialogs.info.inventory}
                              </span>
                              <span className="nh3d-character-action-detail">
                                {t.dialogs.info.inventoryDetail}
                              </span>
                            </button>
                            {characterCommandActions.map((action) => (
                              <button
                                className="nh3d-character-action-button"
                                key={`character-action-${action.id}`}
                                onClick={() =>
                                  runCharacterExtendedCommand(action.command)
                                }
                                type="button"
                              >
                                <span className="nh3d-character-action-label">
                                  {action.label}
                                </span>
                                <span className="nh3d-character-action-detail">
                                  {action.detail}
                                </span>
                              </button>
                            ))}
                          </div>
                        </section>
                      </>
                    ) : (
                      <>
                        <section className="nh3d-character-panel">
                          <div className="nh3d-character-panel-title">
                            {
                              translationStrings.characterSheet.sectionTitles
                                .background
                            }
                          </div>
                          <div className="nh3d-character-line-stack">
                            {characterSheet.backgroundLines.length > 0 ? (
                              characterSheet.backgroundLines.map(
                                (line, index) => (
                                  <div
                                    className="nh3d-character-line"
                                    key={`character-bg-${index}`}
                                  >
                                    {line}
                                  </div>
                                ),
                              )
                            ) : characterSheet.identityLine ? (
                              <div className="nh3d-character-line">
                                {characterSheet.identityLine}
                              </div>
                            ) : null}
                          </div>
                        </section>

                        <section className="nh3d-character-panel">
                          <div className="nh3d-character-panel-title">
                            {t.dialogs.info.vitals}
                          </div>
                          <div className="nh3d-character-line-stack">
                            {characterSheet.hitPointsLine ? (
                              <div className="nh3d-character-line">
                                {characterSheet.hitPointsLine}
                              </div>
                            ) : null}
                            {characterSheet.energyLine ? (
                              <div className="nh3d-character-line">
                                {characterSheet.energyLine}
                              </div>
                            ) : null}
                            {characterSheet.armorClassLine ? (
                              <div className="nh3d-character-line">
                                {characterSheet.armorClassLine}
                              </div>
                            ) : null}
                            {characterSheet.experienceLine ? (
                              <div className="nh3d-character-line">
                                {characterSheet.experienceLine}
                              </div>
                            ) : null}
                            {characterSheet.scoreLine ? (
                              <div className="nh3d-character-line">
                                {characterSheet.scoreLine}
                              </div>
                            ) : null}
                            {characterSheet.walletLine ? (
                              <div className="nh3d-character-line">
                                {characterSheet.walletLine}
                              </div>
                            ) : null}
                            {characterSheet.autopickupLine ? (
                              <div className="nh3d-character-line">
                                {characterSheet.autopickupLine}
                              </div>
                            ) : null}
                          </div>
                        </section>

                        <section className="nh3d-character-panel nh3d-character-panel-characteristics">
                          <div className="nh3d-character-panel-title">
                            {t.dialogs.info.characteristics}
                          </div>
                          {hasCharacterStatValues ? (
                            <div className="nh3d-character-stat-grid">
                              {hasCharacterStatLimits ? (
                                <div className="nh3d-character-stat-grid-hint">
                                  {t.dialogs.info.currentLimit}
                                </div>
                              ) : null}
                              {displayedCharacterStatEntries.map((entry) => (
                                <div
                                  className="nh3d-character-stat"
                                  key={`character-stat-${entry.id}`}
                                >
                                  <div className="nh3d-character-stat-label">
                                    {entry.label}
                                  </div>
                                  <div className="nh3d-character-stat-value">
                                    <span className="nh3d-character-stat-current">
                                      {entry.currentValue ||
                                        entry.rawValue ||
                                        "--"}
                                    </span>
                                    {entry.limitValue ? (
                                      <>
                                        <span className="nh3d-character-stat-divider">
                                          /
                                        </span>
                                        <span className="nh3d-character-stat-limit">
                                          {entry.limitValue}
                                        </span>
                                      </>
                                    ) : null}
                                  </div>
                                  <div className="nh3d-character-stat-description">
                                    {characterStatDescriptionById[entry.id]}
                                  </div>
                                </div>
                              ))}
                              <div className="nh3d-character-stat">
                                <div className="nh3d-character-stat-label">
                                  {t.dialogs.info.armorClass}
                                </div>
                                <div className="nh3d-character-stat-value">
                                  <span className="nh3d-character-stat-current">
                                    {playerStats.armor}
                                  </span>
                                </div>
                                <div className="nh3d-character-stat-description">
                                  {armorClassDescription}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="nh3d-character-line-stack">
                              {characterSheet.characteristicsLines.map(
                                (line, index) => (
                                  <div
                                    className="nh3d-character-line"
                                    key={`character-characteristics-${index}`}
                                  >
                                    {line}
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                        </section>

                        {renderCharacterCurrentStatusPanel(
                          characterSheet.statusLines,
                        )}

                        {renderCharacterCurrentAttributesPanel(
                          characterSheet.attributeLines,
                        )}

                        <section className="nh3d-character-panel nh3d-character-panel-actions">
                          <div className="nh3d-character-panel-title">
                            {t.dialogs.info.characterActions}
                          </div>
                          <div className="nh3d-character-actions-grid">
                            <button
                              className="nh3d-character-action-button"
                              onClick={() =>
                                controller?.toggleInventoryDialog()
                              }
                              type="button"
                            >
                              <span className="nh3d-character-action-label">
                                {t.dialogs.info.inventory}
                              </span>
                              <span className="nh3d-character-action-detail">
                                {t.dialogs.info.inventoryDetail}
                              </span>
                            </button>
                            {characterCommandActions.map((action) => (
                              <button
                                className="nh3d-character-action-button"
                                key={`character-action-${action.id}`}
                                onClick={() =>
                                  runCharacterExtendedCommand(action.command)
                                }
                                type="button"
                              >
                                <span className="nh3d-character-action-label">
                                  {action.label}
                                </span>
                                <span className="nh3d-character-action-detail">
                                  {action.detail}
                                </span>
                              </button>
                            ))}
                          </div>
                        </section>

                        {characterSheet.extraSections.map(
                          (section, sectionIndex) => (
                            <section
                              className="nh3d-character-panel"
                              key={`character-extra-${section.title}-${sectionIndex}`}
                            >
                              <div className="nh3d-character-panel-title">
                                {section.title}
                              </div>
                              <div className="nh3d-character-line-stack">
                                {section.lines.map((line, lineIndex) => (
                                  <div
                                    className="nh3d-character-line"
                                    key={`character-extra-line-${sectionIndex}-${lineIndex}`}
                                  >
                                    {line}
                                  </div>
                                ))}
                              </div>
                            </section>
                          ),
                        )}
                      </>
                    )}
                  </div>

                  <div className="nh3d-info-hint">
                    {t.dialogs.info.closeHint}
                  </div>
                </div>
                <div className="nh3d-menu-actions">
                  {showMessageHistoryNavigation ? (
                    <>
                      <button
                        aria-label="Show earliest NetHack message"
                        className="nh3d-menu-action-button nh3d-message-history-nav-button"
                        disabled={!canShowPreviousCachedMessage}
                        onClick={showEarliestCachedMessageInfoMenu}
                        type="button"
                      >
                        {"<<"}
                      </button>
                      <button
                        aria-label="Show previous NetHack message"
                        className="nh3d-menu-action-button nh3d-message-history-nav-button"
                        disabled={!canShowPreviousCachedMessage}
                        onClick={showPreviousCachedMessageInfoMenu}
                        type="button"
                      >
                        {"<"}
                      </button>
                      <button
                        className="nh3d-menu-action-button nh3d-menu-action-cancel"
                        onClick={closeInfoMenuDialog}
                        type="button"
                      >
                        {commonStrings.close}
                      </button>
                      <button
                        aria-label="Show next NetHack message"
                        className="nh3d-menu-action-button nh3d-message-history-nav-button"
                        disabled={!canShowNextCachedMessage}
                        onClick={showNextCachedMessageInfoMenu}
                        type="button"
                      >
                        {">"}
                      </button>
                      <button
                        aria-label="Show latest NetHack message"
                        className="nh3d-menu-action-button nh3d-message-history-nav-button"
                        disabled={!canShowNextCachedMessage}
                        onClick={showLatestCachedMessageInfoMenu}
                        type="button"
                      >
                        {">>"}
                      </button>
                    </>
                  ) : (
                    <button
                      className="nh3d-menu-action-button nh3d-menu-action-cancel"
                      onClick={closeInfoMenuDialog}
                      type="button"
                    >
                      {commonStrings.close}
                    </button>
                  )}
                </div>
              </>
            ) : infoEnhanceMenuData ? (
              <>
                <div
                  className="nh3d-dialog-info-scroll"
                  data-nh3d-overflow-glow
                  data-nh3d-overflow-glow-host="parent"
                >
                  <div className="nh3d-question-text">
                    {infoEnhanceMenuData.prompt ||
                      displayedInfoMenu.title ||
                      t.dialogs.info.infoTitleFallback}
                  </div>
                  {renderEnhanceMenuContent(infoEnhanceMenuData)}
                </div>
                <div className="nh3d-menu-actions">
                  {showMessageHistoryNavigation ? (
                    <>
                      <button
                        aria-label="Show earliest NetHack message"
                        className="nh3d-menu-action-button nh3d-message-history-nav-button"
                        disabled={!canShowPreviousCachedMessage}
                        onClick={showEarliestCachedMessageInfoMenu}
                        type="button"
                      >
                        {"<<"}
                      </button>
                      <button
                        aria-label="Show previous NetHack message"
                        className="nh3d-menu-action-button nh3d-message-history-nav-button"
                        disabled={!canShowPreviousCachedMessage}
                        onClick={showPreviousCachedMessageInfoMenu}
                        type="button"
                      >
                        {"<"}
                      </button>
                      <button
                        className="nh3d-menu-action-button nh3d-menu-action-cancel"
                        onClick={closeInfoMenuDialog}
                        type="button"
                      >
                        {commonStrings.close}
                      </button>
                      <button
                        aria-label="Show next NetHack message"
                        className="nh3d-menu-action-button nh3d-message-history-nav-button"
                        disabled={!canShowNextCachedMessage}
                        onClick={showNextCachedMessageInfoMenu}
                        type="button"
                      >
                        {">"}
                      </button>
                      <button
                        aria-label="Show latest NetHack message"
                        className="nh3d-menu-action-button nh3d-message-history-nav-button"
                        disabled={!canShowNextCachedMessage}
                        onClick={showLatestCachedMessageInfoMenu}
                        type="button"
                      >
                        {">>"}
                      </button>
                    </>
                  ) : (
                    <button
                      className="nh3d-menu-action-button nh3d-menu-action-cancel"
                      onClick={closeInfoMenuDialog}
                      type="button"
                    >
                      {commonStrings.close}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div
                  className="nh3d-dialog-info-scroll"
                  data-nh3d-overflow-glow
                  data-nh3d-overflow-glow-host="parent"
                >
                  <div className="nh3d-info-title">
                    {displayedInfoMenu.title || t.dialogs.info.infoTitleFallback}
                  </div>
                  <div className="nh3d-info-body">
                    {displayedInfoMenu.lines.length > 0
                      ? displayedInfoMenu.lines.join("\n")
                      : t.dialogs.info.noDetails}
                  </div>
                  <div className="nh3d-info-hint">
                    {t.dialogs.info.closeHint}
                  </div>
                </div>
                <div className="nh3d-menu-actions">
                  {showMessageHistoryNavigation ? (
                    <>
                      <button
                        aria-label="Show earliest NetHack message"
                        className="nh3d-menu-action-button nh3d-message-history-nav-button"
                        disabled={!canShowPreviousCachedMessage}
                        onClick={showEarliestCachedMessageInfoMenu}
                        type="button"
                      >
                        {"<<"}
                      </button>
                      <button
                        aria-label="Show previous NetHack message"
                        className="nh3d-menu-action-button nh3d-message-history-nav-button"
                        disabled={!canShowPreviousCachedMessage}
                        onClick={showPreviousCachedMessageInfoMenu}
                        type="button"
                      >
                        {"<"}
                      </button>
                      <button
                        className="nh3d-menu-action-button nh3d-menu-action-cancel"
                        onClick={closeInfoMenuDialog}
                        type="button"
                      >
                        {commonStrings.close}
                      </button>
                      <button
                        aria-label="Show next NetHack message"
                        className="nh3d-menu-action-button nh3d-message-history-nav-button"
                        disabled={!canShowNextCachedMessage}
                        onClick={showNextCachedMessageInfoMenu}
                        type="button"
                      >
                        {">"}
                      </button>
                      <button
                        aria-label="Show latest NetHack message"
                        className="nh3d-menu-action-button nh3d-message-history-nav-button"
                        disabled={!canShowNextCachedMessage}
                        onClick={showLatestCachedMessageInfoMenu}
                        type="button"
                      >
                        {">>"}
                      </button>
                    </>
                  ) : (
                    <button
                      className="nh3d-menu-action-button nh3d-menu-action-cancel"
                      onClick={closeInfoMenuDialog}
                      type="button"
                    >
                      {commonStrings.close}
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        ) : null}
      </AnimatedDialog>

      <AnimatedDialog
        className={`nh3d-dialog nh3d-dialog-inventory nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close${
          inventoryReducedMotionEnabled
            ? " nh3d-dialog-inventory-reduced-motion"
            : ""
        }${inventoryAsciiModeEnabled ? " nh3d-dialog-inventory-ascii" : ""}${
          inventoryTileOnlyMotionEnabled
            ? " nh3d-dialog-inventory-tile-motion-only"
            : ""
        }`}
        open={inventory.visible}
        id="inventory-dialog"
        ref={inventoryDialogRef}
      >
        {renderMobileDialogCloseButton(
          () => controller?.closeInventoryDialog(),
          t.dialogs.inventory.closeLabel,
        )}
        <div className="nh3d-inventory-title">{t.dialogs.inventory.title}</div>
        <div className="nh3d-overflow-glow-frame nh3d-overflow-glow-shell-fill">
          <div
            className={`nh3d-inventory-items${
              inventoryReducedMotionEnabled
                ? " nh3d-inventory-items-fixed-size"
                : ""
            }`}
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
            data-nh3d-inv-fixed-size={inventoryFixedTileSizeMode}
            onPointerDownCapture={
              inventoryReducedMotionEnabled
                ? undefined
                : handleInventoryRowPointerDownCapture
            }
            onPointerDown={
              inventoryReducedMotionEnabled
                ? undefined
                : handleInventoryPointerUpdate
            }
            onPointerEnter={
              inventoryReducedMotionEnabled
                ? undefined
                : handleInventoryPointerUpdate
            }
            onPointerCancel={
              inventoryReducedMotionEnabled
                ? undefined
                : handleInventoryPointerCancel
            }
            onPointerLeave={
              inventoryReducedMotionEnabled
                ? undefined
                : handleInventoryPointerLeave
            }
            onPointerMove={
              inventoryReducedMotionEnabled
                ? undefined
                : handleInventoryPointerUpdate
            }
            onPointerUp={
              inventoryReducedMotionEnabled
                ? undefined
                : handleInventoryPointerUp
            }
            onTouchStartCapture={
              inventoryReducedMotionEnabled
                ? undefined
                : handleInventoryRowTouchStartCapture
            }
            onTouchStart={
              inventoryReducedMotionEnabled
                ? undefined
                : handleInventoryTouchUpdate
            }
            onTouchMove={
              inventoryReducedMotionEnabled
                ? undefined
                : handleInventoryTouchMove
            }
            onTouchEnd={
              inventoryReducedMotionEnabled
                ? undefined
                : handleInventoryTouchEnd
            }
            onTouchCancel={
              inventoryReducedMotionEnabled
                ? undefined
                : handleInventoryTouchCancel
            }
            onScroll={
              inventoryReducedMotionEnabled
                ? undefined
                : handleInventoryItemsScroll
            }
            ref={inventoryItemsContainerRef}
            style={
              inventoryReducedMotionEnabled
                ? ({
                    "--nh3d-inv-fixed-icon-size-px": `${inventoryFixedIconSizePx}px`,
                  } as CSSProperties)
                : undefined
            }
          >
            {inventory.items.length === 0 ? (
              <div className="nh3d-inventory-empty">
                {t.dialogs.inventory.empty}
              </div>
            ) : (
              inventory.items.map((item, index) => {
                if (item.isCategory) {
                  return (
                    <div
                      className={`nh3d-inventory-category${
                        index === 0 ? " nh3d-inventory-category-first" : ""
                      }`}
                      key={`cat-${index}`}
                    >
                      {item.text}
                    </div>
                  );
                }

                const tileApplicable = isMenuItemTileApplicable(item);
                const tileIndex =
                  tilesUiEnabled && tileApplicable
                    ? resolveMenuItemTileIndex(item)
                    : null;
                const tilePreview = renderMenuItemTilePreview(item, tileIndex);
                const fallbackGlyph = resolveMenuItemFallbackGlyph(item);
                const itemAccelerator =
                  typeof item.accelerator === "string"
                    ? item.accelerator.trim()
                    : "";
                const isContextMenuItemActive =
                  inventoryContextMenu?.accelerator === itemAccelerator;
                const showInventoryTileIcon =
                  tilesUiEnabled &&
                  tileApplicable &&
                  (!inventoryReducedMotionEnabled ||
                    inventoryFixedTileSizeMode !== "none");

                return (
                  <div
                    className={`nh3d-inventory-item${
                      !inventoryContextActionsEnabled
                        ? " nh3d-inventory-item-disabled"
                        : ""
                    }${
                      isContextMenuItemActive
                        ? " nh3d-inventory-item-active"
                        : ""
                    }`}
                    data-nh3d-accelerator={itemAccelerator}
                    key={`item-${index}`}
                    ref={(element) => {
                      setInventoryRowRef(index, element);
                    }}
                    style={
                      inventoryTileOnlyMotionEnabled
                        ? ({
                            "--nh3d-inv-row-order": String(index + 1),
                          } as CSSProperties)
                        : undefined
                    }
                    onPointerDown={(event) => {
                      if (!inventoryUsesFullRowAnimation) {
                        return;
                      }
                      if (event.pointerType === "mouse" && event.button !== 0) {
                        return;
                      }
                      beginInventoryRowPressCandidate(
                        "pointer",
                        event.pointerId,
                        item,
                        itemAccelerator,
                        event.currentTarget,
                        event.clientX,
                        event.clientY,
                      );
                    }}
                    onTouchStart={(event) => {
                      if (!inventoryUsesFullRowAnimation) {
                        return;
                      }
                      const primaryTouch =
                        event.changedTouches[0] ?? event.touches[0];
                      if (!primaryTouch) {
                        return;
                      }
                      beginInventoryRowPressCandidate(
                        "touch",
                        primaryTouch.identifier,
                        item,
                        itemAccelerator,
                        event.currentTarget,
                        primaryTouch.clientX,
                        primaryTouch.clientY,
                      );
                    }}
                    onClick={(event) => {
                      if (!inventoryContextActionsEnabled) {
                        return;
                      }
                      if (isContextMenuItemActive) {
                        setInventoryContextMenu(null);
                        return;
                      }
                      const targetRect =
                        event.currentTarget.getBoundingClientRect();
                      openInventoryContextMenu(
                        item,
                        event.clientX,
                        event.clientY,
                        targetRect,
                      );
                    }}
                    onContextMenu={(event) => {
                      if (!inventoryContextActionsEnabled) {
                        return;
                      }
                      event.preventDefault();
                      const targetRect =
                        event.currentTarget.getBoundingClientRect();
                      openInventoryContextMenu(
                        item,
                        event.clientX,
                        event.clientY,
                        targetRect,
                      );
                    }}
                    onKeyDown={(event) => {
                      if (!inventoryContextActionsEnabled) {
                        return;
                      }
                      const moveDirection =
                        resolveInventoryContextNavigationDirection(
                          event.key,
                          event.code,
                        );
                      if (moveDirection) {
                        event.preventDefault();
                        event.stopPropagation();
                        if (inventoryContextMenu) {
                          moveInventoryContextMenuActionFocus(moveDirection);
                          return;
                        }
                        moveInventoryItemFocusByArrowKey(
                          event.currentTarget,
                          moveDirection === "up" || moveDirection === "left"
                            ? "previous"
                            : "next",
                        );
                        return;
                      }

                      const activationKey = normalizeInventoryActivationKey(
                        event.key,
                      );
                      if (!activationKey) {
                        return;
                      }

                      if (
                        inventoryKeyboardActivationKeysDownRef.current.has(
                          activationKey,
                        )
                      ) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                      }
                      inventoryKeyboardActivationKeysDownRef.current.add(
                        activationKey,
                      );
                      event.preventDefault();
                      event.stopPropagation();

                      const target =
                        event.currentTarget.getBoundingClientRect();
                      openInventoryContextMenu(
                        item,
                        target.right,
                        target.top + target.height / 2,
                        target,
                        { focusMenu: true },
                      );
                    }}
                    role={inventoryContextActionsEnabled ? "button" : undefined}
                    tabIndex={inventoryContextActionsEnabled ? 0 : -1}
                  >
                    <span className="nh3d-inventory-item-leading">
                      {showInventoryTileIcon ? (
                        <span
                          className="nh3d-inventory-icon-anchor"
                          aria-hidden="true"
                        >
                          <span className="nh3d-inventory-icon-shell">
                            {tilePreview ? (
                              <span className="nh3d-inventory-icon-art">
                                {tilePreview}
                              </span>
                            ) : (
                              <span className="nh3d-inventory-icon-fallback">
                                {fallbackGlyph}
                              </span>
                            )}
                          </span>
                        </span>
                      ) : null}
                      <span className="nh3d-inventory-key">
                        {item.accelerator || "?"})
                      </span>
                    </span>
                    <span className={item.className as string}>
                      {item.text || t.dialogs.inventory.unknownItem}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="nh3d-inventory-close">
          {inventoryCloseInstructionText}
        </div>
        <div className="nh3d-menu-actions">
          <button
            className="nh3d-menu-action-button nh3d-menu-action-cancel"
            onClick={() => controller?.closeInventoryDialog()}
            type="button"
          >
            {commonStrings.close}
          </button>
        </div>
      </AnimatedDialog>

      <AnimatedDialog
        className="nh3d-context-menu nh3d-inventory-context-menu nh3d-overflow-glow-frame"
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          const moveDirection = resolveInventoryContextNavigationDirection(
            event.key,
            event.code,
          );
          if (moveDirection) {
            event.preventDefault();
            event.stopPropagation();
            moveInventoryContextMenuActionFocus(moveDirection);
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (inventoryDropTypeMenuPosition) {
              closeInventoryDropTypeMenu();
              inventorySuppressDropActionClickRef.current = false;
              cancelInventoryDropTypeHold();
              return;
            }
            closeInventoryContextMenu({ restoreItemFocus: true });
          }
        }}
        open={inventoryContextMenuOpen}
        ref={inventoryContextMenuRef}
        style={
          inventoryContextMenuRenderState
            ? {
                left: `${inventoryContextMenuRenderState.x}px`,
                top: `${inventoryContextMenuRenderState.y}px`,
              }
            : undefined
        }
      >
        {inventoryContextMenuRenderState ? (
          <div
            className="nh3d-inventory-context-menu-scroll"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
          >
            <div
              className={`nh3d-context-menu-title${
                inventoryContextTitleScroll.shouldScroll
                  ? " nh3d-context-menu-title-scroll"
                  : ""
              }`}
              ref={inventoryContextTitleScroll.containerRef}
              style={inventoryContextTitleScroll.style}
            >
              {inventoryContextTitleScroll.shouldScroll ? (
                <span
                  className="nh3d-context-menu-title-scroll-track"
                  key={inventoryContextTitleAnimationKey}
                >
                  <span ref={inventoryContextTitleScroll.primaryTextRef}>
                    {inventoryContextTitle}
                  </span>
                  <span aria-hidden="true">{inventoryContextTitle}</span>
                </span>
              ) : (
                <span
                  className="nh3d-context-menu-title-text"
                  ref={inventoryContextTitleScroll.primaryTextRef}
                >
                  {inventoryContextTitle}
                </span>
              )}
            </div>
            <div className="nh3d-context-menu-actions nh3d-context-menu-actions-inventory">
              {inventoryContextMenuActions.map((action) => {
                const isDropAction = action.id === "drop";
                return (
                  <button
                    aria-haspopup={isDropAction ? "menu" : undefined}
                    className={`nh3d-context-menu-button${
                      isDropAction && inventoryDropTypeMenuPosition
                        ? " is-drop-type-open"
                        : ""
                    }`}
                    key={`inventory-${inventoryContextMenuRenderState.accelerator}-${action.id}`}
                    onClick={() => {
                      if (
                        isDropAction &&
                        consumeInventoryDropActionClickSuppression()
                      ) {
                        return;
                      }
                      closeInventoryDropTypeMenu();
                      if (action.kind === "extended" && action.value) {
                        if (action.armInventorySelection !== false) {
                          // Use the special prefix to ensure the runtime intercepts it and reliably
                          // applies it to the next inventory prompt menu without race conditions.
                          controller?.sendInput(
                            `__INVCTX_SELECT__:${inventoryContextMenuRenderState.accelerator}:${action.id}`,
                          );
                        }
                        controller?.runExtendedCommand(action.value, {
                          forceHashSubmission: true,
                        });
                      } else {
                        controller?.runInventoryItemAction(
                          action.id,
                          inventoryContextMenuRenderState.accelerator,
                        );
                      }
                      setInventoryContextMenu(null);
                    }}
                    onMouseEnter={
                      isDropAction
                        ? () => openInventoryDropTypeMenu()
                        : undefined
                    }
                    onPointerCancel={
                      isDropAction
                        ? (event) => {
                            completeInventoryDropTypeHold(event.pointerId);
                          }
                        : undefined
                    }
                    onPointerDown={
                      isDropAction
                        ? (event) => {
                            beginInventoryDropTypeHold(event);
                          }
                        : undefined
                    }
                    onPointerLeave={
                      isDropAction
                        ? (event) => {
                            const holdState =
                              inventoryDropTypeHoldStateRef.current;
                            if (
                              holdState &&
                              holdState.pointerId === event.pointerId
                            ) {
                              cancelInventoryDropTypeHold();
                            }
                          }
                        : undefined
                    }
                    onPointerUp={
                      isDropAction
                        ? (event) => {
                            completeInventoryDropTypeHold(event.pointerId);
                          }
                        : undefined
                    }
                    ref={
                      isDropAction
                        ? (element) => {
                            inventoryDropActionButtonRef.current = element;
                          }
                        : undefined
                    }
                    type="button"
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </AnimatedDialog>

      {inventoryContextMenuOpen &&
      inventoryDropTypeMenuPosition &&
      typeof document !== "undefined"
        ? createPortal(
            <div
              className="nh3d-context-menu nh3d-inventory-drop-type-menu"
              onContextMenu={(event) => event.preventDefault()}
              ref={inventoryDropTypeMenuRef}
              style={{
                left: `${inventoryDropTypeMenuPosition.x}px`,
                top: `${inventoryDropTypeMenuPosition.y}px`,
              }}
            >
              <div className="nh3d-context-menu-title">
                {t.dialogs.inventoryDropMenu.title}
              </div>
              <div className="nh3d-context-menu-actions">
                <button
                  className="nh3d-context-menu-button"
                  onClick={() => runInventoryDropTypeCommand()}
                  type="button"
                >
                  {t.dialogs.inventoryDropMenu.dropType}
                </button>
                <button
                  className="nh3d-context-menu-button"
                  disabled={
                    !inventoryContextSupportsDropAmount ||
                    !inventoryContextMenuRenderState
                  }
                  onClick={() => {
                    if (!inventoryContextMenuRenderState) {
                      return;
                    }
                    openInventoryDropCountModal(
                      inventoryContextMenuRenderState.accelerator,
                      inventoryContextMenuRenderState.itemText,
                    );
                  }}
                  title={
                    inventoryContextSupportsDropAmount
                      ? t.dialogs.inventoryDropMenu.dropSpecificAmount
                      : t.dialogs.inventoryDropMenu.onlyStackedItems
                  }
                  type="button"
                >
                  {t.dialogs.inventoryDropMenu.dropAmount}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}

      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions"
        id="nh3d-inventory-drop-count-dialog"
        open={Boolean(inventoryDropCountDialog)}
        onContextMenu={(event) => event.preventDefault()}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            closeInventoryDropCountModal();
            return;
          }
          if (event.key !== "Enter" && event.key !== "NumpadEnter") {
            return;
          }
          const target = event.target as HTMLElement | null;
          if (target?.tagName === "BUTTON") {
            return;
          }
          event.preventDefault();
          submitInventoryDropCount();
        }}
        onKeyUp={(event) => {
          event.stopPropagation();
        }}
      >
        {inventoryDropCountDialog ? (
          <>
            <div className="nh3d-question-text">
              {t.dialogs.inventoryDropCount.title}
            </div>
            <div className="nh3d-inventory-drop-count-description">
              {inventoryDropCountDialog.itemText}
            </div>
            <div className="nh3d-inventory-drop-count-hint">
              {t.dialogs.inventoryDropCount.chooseAmount(
                inventoryDropCountMaxValue,
              )}
            </div>
            <div className="nh3d-inventory-drop-count-controls">
              <div className="nh3d-option-slider-control nh3d-inventory-drop-count-slider-control">
                <input
                  aria-label={t.dialogs.inventoryDropCount.ariaLabel}
                  className="nh3d-option-slider"
                  max={inventoryDropCountMaxValue}
                  min={1}
                  onInput={(event: ChangeEvent<HTMLInputElement>) => {
                    setInventoryDropCountValue(
                      clampInventoryDropCountValue(
                        Number(event.currentTarget.value),
                      ),
                    );
                  }}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setInventoryDropCountValue(
                      clampInventoryDropCountValue(
                        Number(event.currentTarget.value),
                      ),
                    );
                  }}
                  ref={inventoryDropCountSliderRef}
                  step={1}
                  type="range"
                  value={inventoryDropCountValue}
                />
                <div className="nh3d-option-slider-value">
                  {inventoryDropCountValue} / {inventoryDropCountMaxValue}
                </div>
              </div>
              <div className="nh3d-inventory-drop-count-step-actions">
                <button
                  aria-label={t.dialogs.inventoryDropCount.setMinimum}
                  className="nh3d-menu-action-button nh3d-inventory-drop-count-step-button"
                  disabled={inventoryDropCountValue <= 1}
                  onClick={() => {
                    setInventoryDropCountValue(1);
                  }}
                  type="button"
                >
                  {"<<"}
                </button>
                <button
                  aria-label={t.dialogs.inventoryDropCount.decrease}
                  className="nh3d-menu-action-button nh3d-inventory-drop-count-step-button"
                  disabled={inventoryDropCountValue <= 1}
                  onClick={() => {
                    stepInventoryDropCountValue(-1);
                  }}
                  type="button"
                >
                  {"<"}
                </button>
                <button
                  aria-label={t.dialogs.inventoryDropCount.increase}
                  className="nh3d-menu-action-button nh3d-inventory-drop-count-step-button"
                  disabled={
                    inventoryDropCountValue >= inventoryDropCountMaxValue
                  }
                  onClick={() => {
                    stepInventoryDropCountValue(1);
                  }}
                  type="button"
                >
                  {">"}
                </button>
                <button
                  aria-label={t.dialogs.inventoryDropCount.setMaximum}
                  className="nh3d-menu-action-button nh3d-inventory-drop-count-step-button"
                  disabled={
                    inventoryDropCountValue >= inventoryDropCountMaxValue
                  }
                  onClick={() => {
                    setInventoryDropCountValue(inventoryDropCountMaxValue);
                  }}
                  type="button"
                >
                  {">>"}
                </button>
              </div>
            </div>
            <div className="nh3d-menu-actions">
              <button
                className="nh3d-menu-action-button nh3d-menu-action-confirm"
                onClick={submitInventoryDropCount}
                type="button"
              >
                {t.dialogs.inventoryDropMenu.title}
              </button>
              <button
                className="nh3d-menu-action-button nh3d-menu-action-cancel"
                onClick={closeInventoryDropCountModal}
                type="button"
              >
                {commonStrings.cancel}
              </button>
            </div>
          </>
        ) : null}
      </AnimatedDialog>

      {isFpsPlayMode &&
      characterCreationConfig !== null &&
      connectionState === "running" &&
      !positionInputActive &&
      !loadingVisible ? (
        <div aria-hidden="true" className="nh3d-fps-crosshair">
          <div className="nh3d-fps-crosshair-dot" />
        </div>
      ) : null}

      <AnimatedDialog
        className={`nh3d-context-menu ${
          isFpsPlayMode &&
          fpsCrosshairContextRenderState?.autoDirectionFromFpsAim !== false &&
          tileContextMenuRenderPosition === null
            ? "nh3d-fps-crosshair-context"
            : "nh3d-tile-context-menu"
        }`}
        open={Boolean(fpsCrosshairContext)}
        ref={fpsCrosshairContextMenuRef}
        style={
          tileContextMenuRenderPosition
            ? {
                left: `${tileContextMenuRenderPosition.x}px`,
                top: `${tileContextMenuRenderPosition.y}px`,
              }
            : undefined
        }
      >
        {fpsCrosshairContextRenderState ? (
          <>
            <div
              className={`nh3d-context-menu-title${
                fpsContextTitleScroll.shouldScroll
                  ? " nh3d-context-menu-title-scroll"
                  : ""
              }`}
              ref={fpsContextTitleScroll.containerRef}
              style={fpsContextTitleScroll.style}
            >
              {fpsContextTitleScroll.shouldScroll ? (
                <span
                  className="nh3d-context-menu-title-scroll-track"
                  key={fpsContextTitleAnimationKey}
                >
                  <span ref={fpsContextTitleScroll.primaryTextRef}>
                    {fpsContextTitle}
                  </span>
                  <span aria-hidden="true">{fpsContextTitle}</span>
                </span>
              ) : (
                <span
                  className="nh3d-context-menu-title-text"
                  ref={fpsContextTitleScroll.primaryTextRef}
                >
                  {fpsContextTitle}
                </span>
              )}
            </div>
            <div className="nh3d-context-menu-actions">
              {fpsCrosshairContextRenderState.actions.map((action) => (
                <button
                  className="nh3d-context-menu-button"
                  key={`crosshair-${action.kind}-${action.id}-${action.value}`}
                  onClick={() => runFpsCrosshairContextAction(action)}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </AnimatedDialog>

      <AnimatedDialog
        className={`nh3d-dialog nh3d-controller-action-wheel-dialog ${
          controllerActionWheelMode === "quick" ? "is-quick" : "is-extended"
        }`}
        open={isControllerActionWheelVisible}
        id="nh3d-controller-action-wheel-dialog"
        ref={controllerActionWheelDialogRef}
      >
        {controllerActionWheelMode === "quick" ? (
          <div
            className="nh3d-controller-action-wheel-ring is-on"
            data-chosen={String(controllerActionWheelChosenIndex + 1)}
            data-count={String(controllerActionWheelEntries.length)}
          >
            {controllerActionWheelEntries.map((action) => {
              const isChosen =
                controllerActionWheelChosenIndex === action.index;
              const arcStyle = {
                clipPath: action.clipPath,
                ["--nh3d-wheel-stagger-delay" as string]: `${(action.index % 2) * 15}ms`,
              } as CSSProperties;
              const labelStyle: CSSProperties = {
                left: `${action.labelXPercent.toFixed(2)}%`,
                top: `${action.labelYPercent.toFixed(2)}%`,
              };
              return (
                <button
                  aria-label={action.label}
                  className={`nh3d-controller-action-wheel-arc${
                    isChosen ? " is-chosen" : ""
                  }`}
                  data-nh3d-wheel-angle={action.angleDeg.toFixed(2)}
                  data-nh3d-wheel-index={String(action.index)}
                  key={`controller-wheel-${action.id}`}
                  onClick={() => runControllerWheelEntry(action)}
                  onFocus={() =>
                    setControllerActionWheelChosenIndex(action.index)
                  }
                  onMouseEnter={() =>
                    setControllerActionWheelChosenIndex(action.index)
                  }
                  style={arcStyle}
                  type="button"
                >
                  <span
                    className="nh3d-controller-action-wheel-arc-label"
                    style={labelStyle}
                  >
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <Fragment>
            <div className="nh3d-controller-action-wheel-title-row">
              <div className="nh3d-controller-action-wheel-title">
                {t.dialogs.mobileActions.extendedCommands}
              </div>
            </div>
            <div className="nh3d-overflow-glow-frame nh3d-controller-action-wheel-extended-shell">
              <div
                className="nh3d-mobile-actions-sections nh3d-controller-action-wheel-extended"
                data-nh3d-overflow-glow
                data-nh3d-overflow-glow-host="parent"
              >
                {mobileCommonExtendedCommandNames.length > 0 ? (
                  <div className="nh3d-mobile-actions-section">
                    <div className="nh3d-mobile-actions-subheader">
                      {t.dialogs.mobileActions.commonCommands}
                    </div>
                    <div className="nh3d-mobile-actions-grid is-extended">
                      {mobileCommonExtendedCommandNames.map((command) => (
                        <button
                          className="nh3d-mobile-actions-button"
                          key={`wheel-common-${command}`}
                          onClick={() =>
                            runControllerWheelExtendedCommand(command)
                          }
                          type="button"
                        >
                          {command}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="nh3d-mobile-actions-section">
                  <div className="nh3d-mobile-actions-subheader">
                    {t.dialogs.mobileActions.allCommands}
                  </div>
                  <div className="nh3d-mobile-actions-grid is-extended">
                    {mobileExtendedCommandNames.map((command) => (
                      <button
                        className="nh3d-mobile-actions-button"
                        key={`wheel-all-${command}`}
                        onClick={() =>
                          runControllerWheelExtendedCommand(command)
                        }
                        type="button"
                      >
                        {command}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Fragment>
        )}
      </AnimatedDialog>

      {mobileTouchUiVisible && isMobileActionSheetVisible ? (
        <div className="nh3d-mobile-actions-sheet">
          <div className="nh3d-mobile-actions-title-row">
            <div className="nh3d-mobile-actions-title">
              {mobileActionSheetMode === "quick"
                ? t.dialogs.mobileActions.actions
                : t.dialogs.mobileActions.extendedCommands}
            </div>
            <div className="nh3d-mobile-actions-controls">
              {mobileActionSheetMode === "extended" ? (
                <button
                  className="nh3d-mobile-actions-back"
                  onClick={() => setMobileActionSheetMode("quick")}
                  type="button"
                >
                  {commonStrings.back}
                </button>
              ) : null}

              <div className="nh3d-mobile-actions-divider" />

              <button
                className="nh3d-mobile-actions-back"
                onClick={openPauseMenu}
                type="button"
              >
                {t.dialogs.mobileActions.menu}
              </button>

              <button
                className="nh3d-mobile-actions-close"
                onClick={() => {
                  setIsMobileActionSheetVisible(false);
                  setMobileActionSheetMode("quick");
                }}
                type="button"
              >
                {t.dialogs.mobileActions.close}
              </button>
            </div>
          </div>
          {mobileActionSheetMode === "quick" ? (
            <div className="nh3d-overflow-glow-frame">
              <div
                className="nh3d-mobile-actions-grid is-fixed-layout"
                data-nh3d-overflow-glow
                data-nh3d-overflow-glow-host="parent"
              >
                {mobileActions.map((action) => (
                  <button
                    className="nh3d-mobile-actions-button"
                    key={action.id}
                    onClick={() => {
                      controller?.dismissFpsCrosshairContextMenu();
                      if (action.id === "extended") {
                        setMobileActionSheetMode("extended");
                        return;
                      }
                      if (action.kind === "quick") {
                        controller?.runQuickAction(action.value);
                      } else {
                        controller?.runExtendedCommand(action.value);
                      }
                      setIsMobileActionSheetVisible(false);
                      setMobileActionSheetMode("quick");
                    }}
                    type="button"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="nh3d-overflow-glow-frame">
              <div
                className="nh3d-mobile-actions-sections"
                data-nh3d-overflow-glow
                data-nh3d-overflow-glow-host="parent"
              >
                {mobileCommonExtendedCommandNames.length > 0 ? (
                  <div className="nh3d-mobile-actions-section">
                    <div className="nh3d-mobile-actions-subheader">
                      {t.dialogs.mobileActions.commonCommands}
                    </div>
                    <div className="nh3d-mobile-actions-grid is-extended">
                      {mobileCommonExtendedCommandNames.map((command) => (
                        <button
                          className="nh3d-mobile-actions-button"
                          key={`common-${command}`}
                          onClick={() => {
                            controller?.dismissFpsCrosshairContextMenu();
                            controller?.runExtendedCommand(command);
                            setIsMobileActionSheetVisible(false);
                            setMobileActionSheetMode("quick");
                          }}
                          type="button"
                        >
                          {command}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="nh3d-mobile-actions-section">
                  <div className="nh3d-mobile-actions-subheader">
                    {t.dialogs.mobileActions.allCommands}
                  </div>
                  <div className="nh3d-mobile-actions-grid is-extended">
                    {mobileExtendedCommandNames.map((command) => (
                      <button
                        className="nh3d-mobile-actions-button"
                        key={`all-${command}`}
                        onClick={() => {
                          controller?.dismissFpsCrosshairContextMenu();
                          controller?.runExtendedCommand(command);
                          setIsMobileActionSheetVisible(false);
                          setMobileActionSheetMode("quick");
                        }}
                        type="button"
                      >
                        {command}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {wizardCommandsSupported &&
      isWizardCommandsVisible &&
      (isDesktopGameRunning || mobileTouchUiVisible) ? (
        <div
          className={`nh3d-wizard-commands-sheet is-visible ${
            isMobileGameRunning ? "is-mobile" : "is-desktop"
          }`}
          ref={wizardCommandsSheetRef}
        >
          <div className="nh3d-mobile-actions-title-row">
            <div className="nh3d-mobile-actions-title">
              {t.dialogs.mobileActions.wizardCommands}
            </div>
            <div className="nh3d-mobile-actions-controls">
              <button
                className="nh3d-mobile-actions-close"
                onClick={closeWizardCommands}
                type="button"
              >
                {t.dialogs.mobileActions.close}
              </button>
            </div>
          </div>
          <div className="nh3d-overflow-glow-frame">
            <div
              className="nh3d-mobile-actions-sections nh3d-wizard-commands-sections"
              data-nh3d-overflow-glow
              data-nh3d-overflow-glow-host="parent"
              onTouchMove={(event) => {
                event.stopPropagation();
              }}
              onWheel={(event) => {
                event.stopPropagation();
              }}
            >
              <div className="nh3d-mobile-actions-section">
                <div className="nh3d-wizard-commands-list">
                  {wizardExtendedCommandNames.map((command) => {
                    const commandCopy = getWizardCommandCopy(command);
                    const rawExtendedCommand = `#${command}`;
                    return (
                      <button
                        aria-label={`${commandCopy.name} (${rawExtendedCommand}): ${commandCopy.description}`}
                        className="nh3d-wizard-command-button"
                        key={`wizard-${command}`}
                        onClick={() => runWizardExtendedCommand(command)}
                        type="button"
                      >
                        <span className="nh3d-wizard-command-name">
                          {commandCopy.name}
                          <span className="nh3d-wizard-command-raw">
                            {" "}
                            ({rawExtendedCommand})
                          </span>
                        </span>
                        <span className="nh3d-wizard-command-description">
                          {commandCopy.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {wizardCommandsSupported && mobileTouchUiVisible ? (
        <button
          className={`nh3d-wizard-commands-button${
            isWizardCommandsVisible ? " is-active" : ""
          }`}
          onClick={toggleWizardCommands}
          ref={wizardCommandsButtonRef}
          type="button"
        >
          {t.dialogs.mobileActions.wizard}
        </button>
      ) : null}

      {mobileTouchUiVisible && repeatActionVisible ? (
        <button
          className="nh3d-mobile-repeat-button"
          onClick={() => {
            controller?.dismissFpsCrosshairContextMenu();
            controller?.repeatLastAction();
          }}
          type="button"
        >
          {t.dialogs.mobileActions.repeat}
        </button>
      ) : null}

      {manualSafeZonePreview ? (
        <div
          aria-hidden="true"
          className={`nh3d-mobile-safe-zone-preview is-${manualSafeZonePreview.side}`}
          style={
            {
              "--nh3d-mobile-safe-zone-preview-size": `${manualSafeZonePreview.sizePx}px`,
            } as CSSProperties
          }
        >
          <span>
            {manualSafeZonePreview.side === "right"
              ? t.clientOptions.config.manualMobileRightSafeZonePreview
              : t.clientOptions.config.manualMobileBottomSafeZonePreview}
          </span>
        </div>
      ) : null}

      {isDesktopGameRunning && !clientOptions.controllerEnabled ? (
        <div className="nh3d-desktop-bottom-actions">
          {wizardCommandsSupported ? (
            <button
              className={`nh3d-desktop-bottom-button${
                isWizardCommandsVisible ? " is-active" : ""
              }`}
              onClick={toggleWizardCommands}
              ref={wizardCommandsButtonRef}
              type="button"
            >
              {t.dialogs.mobileActions.wizard}
            </button>
          ) : null}
          <button
            className={`nh3d-desktop-bottom-button${
              isCharacterSheetVisible ? " is-active" : ""
            }`}
            onClick={openCharacterDialog}
            type="button"
          >
            {t.dialogs.mobileActions.character}
          </button>
          <button
            className={`nh3d-desktop-bottom-button${
              inventory.visible ? " is-active" : ""
            }`}
            onClick={() => {
              controller?.dismissFpsCrosshairContextMenu();
              closeWizardCommands();
              controller?.toggleInventoryDialog();
            }}
            type="button"
          >
            {t.dialogs.mobileActions.inventory}
          </button>
        </div>
      ) : null}

      {mobileTouchUiVisible ? (
        <div className="nh3d-mobile-bottom-bar">
          <button
            className={`nh3d-mobile-bottom-button${
              isCharacterSheetVisible ? " is-active" : ""
            }`}
            onClick={openCharacterDialog}
            type="button"
          >
            {t.dialogs.mobileActions.character}
          </button>
          <button
            className={`nh3d-mobile-bottom-button${
              inventory.visible ? " is-active" : ""
            }`}
            onClick={() => {
              controller?.dismissFpsCrosshairContextMenu();
              closeWizardCommands();
              controller?.toggleInventoryDialog();
            }}
            type="button"
          >
            {t.dialogs.mobileActions.inventory}
          </button>
          <button
            aria-expanded={isMobileLogVisible}
            className={`nh3d-mobile-bottom-button${
              isMobileLogVisible ? " is-active" : ""
            }`}
            disabled={!clientOptions.liveMessageLog}
            onClick={() => {
              controller?.dismissFpsCrosshairContextMenu();
              if (!clientOptions.liveMessageLog) {
                return;
              }
              setIsMobileLogVisible((visible) => {
                const next = !visible;
                if (next) {
                  setIsMobileActionSheetVisible(false);
                  setMobileActionSheetMode("quick");
                  closeWizardCommands();
                }
                return next;
              });
            }}
            type="button"
          >
            {t.dialogs.mobileActions.log}
          </button>
          <button
            className="nh3d-mobile-bottom-button"
            onClick={() => {
              controller?.dismissFpsCrosshairContextMenu();
              controller?.runQuickAction("pickup");
            }}
            type="button"
          >
            {t.dialogs.mobileActions.pickUp}
          </button>
          <button
            className="nh3d-mobile-bottom-button"
            onClick={() => {
              controller?.dismissFpsCrosshairContextMenu();
              controller?.runQuickAction("search");
            }}
            type="button"
          >
            {t.dialogs.mobileActions.search}
          </button>
          <button
            aria-label={`${t.dialogs.mobileActions.menu} / ${t.dialogs.mobileActions.actions}`}
            className={`nh3d-mobile-bottom-button${
              isMobileActionSheetVisible ? " is-active" : ""
            }`}
            onClick={() => {
              controller?.dismissFpsCrosshairContextMenu();
              setIsMobileActionSheetVisible((visible) => {
                const next = !visible;
                if (next) {
                  setMobileActionSheetMode("quick");
                  setIsMobileLogVisible(false);
                  closeWizardCommands();
                }
                return next;
              });
            }}
            type="button"
          >
            {t.dialogs.mobileActions.menu} /
            <br />
            {t.dialogs.mobileActions.actions}
          </button>
        </div>
      ) : null}

      <div
        className={[
          positionDialogVisible ? "is-visible" : "",
          "nh3d-overflow-glow-frame",
        ]
          .filter(Boolean)
          .join(" ")}
        id="position-dialog"
      >
        <div
          className="nh3d-position-dialog-scroll"
          data-nh3d-overflow-glow
          data-nh3d-overflow-glow-host="parent"
        >
          {isMobileViewport && positionDialogVisible ? (
            <MobileDismissButton
              className="nh3d-position-dialog-close"
              label={t.dialogs.positionPrompt.closeLabel}
              onClick={() => {
                controller?.cancelActivePrompt();
                setPositionRequest(null);
              }}
            />
          ) : null}
          {positionRequest ? (
            <div className="nh3d-position-dialog-request">
              {positionRequest}
            </div>
          ) : null}
          {positionInputInstruction ? (
            <div className="nh3d-position-dialog-hint">
              {positionInputInstruction}
            </div>
          ) : null}
        </div>
      </div>

      <AnimatedDialog
        className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions"
        open={isControllerSupportPromptVisible}
        id="nh3d-controller-support-dialog"
      >
        <div className="nh3d-question-text">
          {t.dialogs.controllerSupport.prompt}
        </div>
        <div className="nh3d-menu-actions">
          <button
            className="nh3d-menu-action-button nh3d-menu-action-confirm"
            onClick={() => confirmControllerSupportPromptChoice(true)}
            type="button"
          >
            {commonStrings.yes}
          </button>
          <button
            className="nh3d-menu-action-button nh3d-menu-action-cancel"
            onClick={() => confirmControllerSupportPromptChoice(false)}
            type="button"
          >
            {commonStrings.no}
          </button>
        </div>
      </AnimatedDialog>

      <ConfirmationModal
        dialog={globalConfirmationDialog}
        dialogId="nh3d-global-confirmation-dialog"
        onCancel={() => resolveConfirmation(false)}
        onConfirm={() => resolveConfirmation(true)}
      />
    </>
  );
}
