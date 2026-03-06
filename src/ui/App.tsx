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
} from "react";
import { createPortal } from "react-dom";
import { Nethack3DEngine } from "../game";
import type {
  CharacterCreationConfig,
  FpsCrosshairContextState,
  Nh3dClientOptions,
  NethackMenuItem,
  PlayerStatsSnapshot,
} from "../game/ui-types";
import {
  defaultNh3dClientOptions,
  nh3dFpsLookSensitivityMax,
  nh3dFpsLookSensitivityMin,
  normalizeNh3dClientOptions,
} from "../game/ui-types";
import { registerDebugHelpers } from "../app";
import { createEngineUiAdapter } from "../state/engineUiAdapter";
import { useGameStore } from "../state/gameStore";
import type { NethackRuntimeVersion } from "../runtime/types";
import { GLYPH_CATALOG as GLYPH_CATALOG_367 } from "../game/glyphs/glyph-catalog.367.generated";
import {
  findNh3dTilesetByPath,
  inferNh3dTilesetTileSizeFromAtlasWidth,
  isNh3dTilesetPathAvailable,
  nh3dTilesetAtlasTileColumns,
  getNh3dTilesetCatalog,
  getNh3dUserTilesetPath,
  resolveDefaultNh3dTilesetBackgroundTileId,
  resolveDefaultNh3dTilesetSolidChromaKeyColorHex,
  resolveNh3dTilesetAssetUrl,
  setNh3dUserTilesets,
} from "../game/tilesets";
import {
  deleteStoredUserTileset,
  listStoredUserTilesets,
  saveStoredUserTileset,
  type StoredUserTilesetRecord,
} from "../game/user-tileset-storage";
import {
  loadPersistedNh3dClientOptionsWithMigration,
  persistNh3dClientOptionsToIndexedDb,
} from "../storage/client-options-storage";
import { resetNh3dDefaultSoundPackVolumeLevelsToDefaults } from "../audio/sound-pack-storage";
import SoundPackSettings, {
  type SoundPackDialogActions,
} from "./SoundPackSettings";
import {
  mobileActions,
  resolveMobileCommonExtendedCommandNames,
  resolveMobileExtendedCommandNames,
  type MobileActionEntry,
  type MobileActionSheetMode,
} from "./mobile/mobile-actions";
import VrAframeHudFrame from "./vr/VrAframeHudFrame";

type DirectionChoice = {
  key?: string;
  label?: string;
  spacer?: boolean;
};

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

const trackedCoreStatKeys: CoreStatKey[] = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
  "armor",
];

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

const numpadDirectionChoices: DirectionChoice[] = [
  { key: "7", label: "\u2196" },
  { key: "8", label: "\u2191" },
  { key: "9", label: "\u2197" },
  { key: "4", label: "\u2190" },
  { spacer: true },
  { key: "6", label: "\u2192" },
  { key: "1", label: "\u2199" },
  { key: "2", label: "\u2193" },
  { key: "3", label: "\u2198" },
];

const viDirectionChoices: DirectionChoice[] = [
  { key: "y", label: "\u2196" },
  { key: "k", label: "\u2191" },
  { key: "u", label: "\u2197" },
  { key: "h", label: "\u2190" },
  { spacer: true },
  { key: "l", label: "\u2192" },
  { key: "b", label: "\u2199" },
  { key: "j", label: "\u2193" },
  { key: "n", label: "\u2198" },
];

const getDirectionChoices = (numberPadModeEnabled: boolean) =>
  numberPadModeEnabled ? numpadDirectionChoices : viDirectionChoices;

const directionAuxChoices = [
  { key: "<", label: "UP" },
  { key: "s", label: "SELF" },
  { key: ">", label: "DOWN" },
];

const getDirectionHelpText = (numberPadModeEnabled: boolean) =>
  numberPadModeEnabled
    ? "Use numpad (1-4,6-9), arrow keys, <, >, or s. Press ESC to cancel"
    : "Use hjkl/yubn, arrow keys, <, >, or s. Press ESC to cancel";

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

function getQuestionChoiceLabel(
  questionText: string,
  choice: string,
  inventoryItems: NethackMenuItem[],
  useInventoryLabels = true,
): string {
  const normalizedChoice = choice.trim();
  if (questionText.includes("Which ring-finger")) {
    if (normalizedChoice === "l") {
      return "l) Left ring-finger";
    }
    if (normalizedChoice === "r") {
      return "r) Right ring-finger";
    }
  }

  if (!normalizedChoice) {
    return choice;
  }
  if (!useInventoryLabels) {
    return normalizedChoice;
  }
  const inventoryItem = inventoryItems.find((item) => {
    if (!item || item.isCategory || typeof item.accelerator !== "string") {
      return false;
    }
    return (
      item.accelerator === normalizedChoice ||
      item.accelerator.toLowerCase() === normalizedChoice.toLowerCase()
    );
  });
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
  return getMenuSelectionInput(item).trim().length > 0;
}

type TileAtlasState = {
  loaded: boolean;
  failed: boolean;
  tileSourceSize: number;
  columns: number;
  rows: number;
  tileCount: number;
};

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
            Selected: tile #{selectedTileId}
            {selectedTileId === defaultTileId ? " (default)" : ""}
          </div>
          <div className="nh3d-option-description">
            Glyph {selectedGlyphLabel}
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
                    Glyph {entry.glyphLabel}
                    {showGlyphNumber && typeof entry.glyphNumber === "number"
                      ? ` (${entry.glyphNumber})`
                      : ""}
                  </span>
                  <span className="nh3d-dark-wall-tile-card-id">
                    Tile {entry.tileId}
                  </span>
                  {isDefault ? (
                    <span className="nh3d-dark-wall-tile-card-default">
                      Default
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
          Reset to default
        </button>
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
  return canvas.toDataURL("image/png");
}

const startupRoleOptions = [
  "Archeologist",
  "Barbarian",
  "Caveman",
  "Healer",
  "Knight",
  "Monk",
  "Priest",
  "Ranger",
  "Rogue",
  "Samurai",
  "Tourist",
  "Valkyrie",
  "Wizard",
];

const startupRaceOptions = ["human", "elf", "dwarf", "gnome", "orc"];
const startupGenderOptions = ["male", "female"];
const startupAlignOptions = ["lawful", "neutral", "chaotic"];
type StartupFlowStep = "choose" | "create" | "random" | "resume";

function pickRandomStartupRole(): string {
  if (startupRoleOptions.length === 0) {
    return "";
  }
  const randomIndex = Math.floor(Math.random() * startupRoleOptions.length);
  return startupRoleOptions[randomIndex] ?? "";
}

function pickRandomStartupGender(role: string): string {
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase();
  if (normalizedRole === "valkyrie") {
    return "female";
  }
  if (startupGenderOptions.length === 0) {
    return "male";
  }
  const randomIndex = Math.floor(Math.random() * startupGenderOptions.length);
  return startupGenderOptions[randomIndex] ?? "male";
}

type InventoryContextAction = {
  id: string;
  label: string;
  kind?: "quick" | "extended";
  value?: string;
};
type InventoryContextMenuState = {
  accelerator: string;
  itemText: string;
  x: number;
  y: number;
};
type TilesetBackgroundRemovalMode =
  Nh3dClientOptions["tilesetBackgroundRemovalMode"];
type ClientOptionToggle = {
  key: ClientOptionToggleKey;
  label: string;
  description: string;
  type: "boolean";
};

type ClientOptionSelect = {
  key:
    | "tilesetMode"
    | "tilesetPath"
    | "antialiasing"
    | "vrPreferredPointerHand";
  label: string;
  description: string;
  type: "select";
  disabled?: boolean;
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
    | "liveMessageDisplayTimeMs"
    | "liveMessageFadeOutTimeMs";
  label: string;
  description: string;
  type: "slider";
  min: number;
  max: number;
  step: number;
};

type ClientOptionGroupHeader = {
  key: string;
  label: string;
  type: "group";
};

type ClientOption =
  | ClientOptionGroupHeader
  | ClientOptionToggle
  | ClientOptionSelect
  | ClientOptionSlider;

type ClientOptionsTabId =
  | "controls"
  | "display"
  | "sound"
  | "mobile"
  | "combat"
  | "compatibility";

type ClientOptionsTab = {
  id: ClientOptionsTabId;
  label: string;
  description: string;
  groupKey: string;
};

type ClientOptionToggleKey =
  | "fpsMode"
  | "vrOfferOnSupportedDevice"
  | "vrFollowPlayer"
  | "vrShowLevelBoundaries"
  | "invertLookYAxis"
  | "invertTouchPanningDirection"
  | "minimap"
  | "damageNumbers"
  | "displayStatChangesAbovePlayer"
  | "displayXpGainsAbovePlayer"
  | "tileShakeOnHit"
  | "blood"
  | "monsterShatter"
  | "monsterShatterBloodBorders"
  | "liveMessageLog"
  | "soundEnabled"
  | "blockAmbientOcclusion"
  | "darkCorridorWalls367"
  | "darkCorridorWallTileOverrideEnabled"
  | "darkCorridorWallSolidColorOverrideEnabled";

type ClientOptionLookSensitivityKey =
  | "fpsLookSensitivityX"
  | "fpsLookSensitivityY";

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
  { id: "apply", label: "Apply" },
  { id: "drop", label: "Drop" },
  { id: "eat", label: "Eat" },
  { id: "quaff", label: "Quaff" },
  { id: "read", label: "Read" },
  { id: "throw", label: "Throw" },
  { id: "wield", label: "Wield" },
  { id: "wear", label: "Wear" },
  { id: "take-off", label: "Take Off" },
  { id: "put-on", label: "Put On" },
  { id: "remove", label: "Remove" },
  { id: "zap", label: "Zap" },
  { id: "engrave", label: "Engrave", kind: "extended", value: "engrave" },
  { id: "dip", label: "Dip", kind: "extended", value: "dip" },
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
  weapons: new Set(["quaff", "wear", "take-off", "put-on", "remove", "zap"]),
  armor: new Set(["quaff", "put-on", "remove", "zap"]),
  rings: new Set(["quaff", "wear", "take-off", "zap"]),
  amulets: new Set(["quaff", "wear", "take-off", "zap"]),
  tools: new Set(["quaff", "wear", "take-off", "zap"]),
  comestibles: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
  ]),
  potions: new Set(["wear", "take-off", "put-on", "remove", "zap", "engrave"]),
  scrolls: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
  ]),
  spellbooks: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
  ]),
  wands: new Set(["quaff", "wear", "take-off", "put-on", "remove"]),
  coins: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
  ]),
  gems_stones: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
  ]),
  boulders_statues: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
  ]),
  iron_balls: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
  ]),
  chains: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
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

const mobileDefaultFpsLookSensitivity = 1.35;
const nh3dClientOptionsStorageKey = "nh3d-client-options:v1";

const clientOptionsConfig: ClientOption[] = [
  {
    key: "group-controls",
    label: "First-person mode",
    type: "group",
  },
  {
    key: "fpsMode",
    label: "FPS mode",
    description: "Use first-person controls and mouselook.",
    type: "boolean",
  },
  {
    key: "vrOfferOnSupportedDevice",
    label: "Offer VR mode",
    description:
      "Show VR entry controls on supported browsers and Quest-class devices.",
    type: "boolean",
  },
  {
    key: "vrFollowPlayer",
    label: "VR tabletop follow player",
    description:
      "Keep the tabletop board centered on the player when not gripping it.",
    type: "boolean",
  },
  {
    key: "vrShowLevelBoundaries",
    label: "VR level boundaries",
    description:
      "Show the level footprint outline while using tabletop VR mode.",
    type: "boolean",
  },
  {
    key: "vrPreferredPointerHand",
    label: "VR primary hand",
    description: "Choose which controller ray is treated as the primary pointer.",
    type: "select",
    options: [
      { value: "right", label: "Right" },
      { value: "left", label: "Left" },
    ],
  },
  {
    key: "invertLookYAxis",
    label: "Invert Y-axis look",
    description: "Invert vertical mouselook and touch-look direction.",
    type: "boolean",
  },
  {
    key: "group-display",
    label: "Interface & display",
    type: "group",
  },
  {
    key: "uiFontScale",
    label: "UI font scale",
    description: "Scale all game UI font sizes from their defaults.",
    type: "slider",
    min: 0.7,
    max: 1.8,
    step: 0.01,
  },
  {
    key: "tilesetMode",
    label: "Display",
    description: "Use graphical tiles instead of ASCII.",
    type: "select",
    options: [
      { value: "ascii", label: "ASCII" },
      { value: "tiles", label: "Tiles" },
    ],
  },
  {
    key: "tilesetPath",
    label: "Tileset",
    description: "Built-in and uploaded tilesets.",
    type: "select",
    options: [],
    disabled: false,
  },
  {
    key: "antialiasing",
    label: "Antialiasing",
    description: "Edge smoothing mode for 3D rendering.",
    type: "select",
    options: [
      { value: "taa", label: "TAA" },
      { value: "fxaa", label: "FXAA" },
    ],
  },
  {
    key: "brightness",
    label: "Brightness",
    description: "Adjust overall scene brightness.",
    type: "slider",
    min: -0.25,
    max: 0.25,
    step: 0.01,
  },
  {
    key: "contrast",
    label: "Contrast",
    description: "Adjust global contrast of rendered scene content.",
    type: "slider",
    min: -0.25,
    max: 0.25,
    step: 0.01,
  },
  {
    key: "gamma",
    label: "Gamma",
    description: "Adjust display gamma for rendered scene content.",
    type: "slider",
    min: 0.5,
    max: 2.5,
    step: 0.01,
  },
  {
    key: "minimap",
    label: "Minimap",
    description: "Show or hide the dungeon minimap.",
    type: "boolean",
  },
  {
    key: "minimapScale",
    label: "Minimap scale",
    description: "Scale the minimap size from its default.",
    type: "slider",
    min: 0.6,
    max: 2.2,
    step: 0.01,
  },
  {
    key: "liveMessageLog",
    label: "Live message log",
    description: "Display the scrolling in-game message log.",
    type: "boolean",
  },
  {
    key: "liveMessageLogFontScale",
    label: "Live message font scale",
    description:
      "Scale the fade-up floating action messages from their default size.",
    type: "slider",
    min: 0.7,
    max: 2.2,
    step: 0.01,
  },
  {
    key: "liveMessageDisplayTimeMs",
    label: "Live message display time",
    description: "Time a floating message stays fully visible before fading.",
    type: "slider",
    min: 250,
    max: 6000,
    step: 50,
  },
  {
    key: "liveMessageFadeOutTimeMs",
    label: "Live message fade-out time",
    description: "Duration of floating message fade-out animation.",
    type: "slider",
    min: 120,
    max: 4000,
    step: 20,
  },
  {
    key: "blockAmbientOcclusion",
    label: "Ambient occlusion",
    description: "Adds subtle contact shadowing between floor and wall blocks.",
    type: "boolean",
  },
  {
    key: "group-sound",
    label: "Sound",
    type: "group",
  },
  {
    key: "soundEnabled",
    label: "Enable sound",
    description:
      "Turn FMOD audio on or off. Disabling reduces audio processing overhead on lower-end devices.",
    type: "boolean",
  },
  {
    key: "group-mobile-controls",
    label: "Mobile controls",
    type: "group",
  },
  {
    key: "invertTouchPanningDirection",
    label: "Invert touch panning direction",
    description:
      "Reverse drag direction for touch panning after hold-to-pan starts.",
    type: "boolean",
  },
  {
    key: "group-combat",
    label: "Combat feedback",
    type: "group",
  },
  {
    key: "damageNumbers",
    label: "Damage numbers",
    description: "Show floating damage and healing numbers.",
    type: "boolean",
  },
  {
    key: "displayStatChangesAbovePlayer",
    label: "Display stat changes above player",
    description: "Show floating labels for stat changes such as Strength and AC.",
    type: "boolean",
  },
  {
    key: "displayXpGainsAbovePlayer",
    label: "Display XP gains above player",
    description: "Show floating XP gain labels when experience increases.",
    type: "boolean",
  },
  {
    key: "tileShakeOnHit",
    label: "Tile shake on hit",
    description: "Shake impact tiles when combat lands.",
    type: "boolean",
  },
  {
    key: "blood",
    label: "Blood",
    description: "Render blood mist particle effects on hits.",
    type: "boolean",
  },
  {
    key: "monsterShatter",
    label: "Monster shatter",
    description:
      "Split defeated monster billboards into physical shard pieces.",
    type: "boolean",
  },
  {
    key: "monsterShatterBloodBorders",
    label: "Shatter blood borders",
    description:
      "Tint shard pixels near split lines with randomized blood-red edging.",
    type: "boolean",
  },
  {
    key: "group-compatibility",
    label: "Runtime compatibility",
    type: "group",
  },
  {
    key: "darkCorridorWalls367",
    label: "NetHack 3.6.7 dark corridor walls",
    description:
      "Infer and cache dark corridor wall tiles (NetHack 3.6.7 behavior).",
    type: "boolean",
  },
  {
    key: "darkCorridorWallTileOverrideEnabled",
    label: "Override inferred dark wall tile",
    description:
      "Use a custom atlas tile for inferred dark corridor walls, saved per tileset.",
    type: "boolean",
  },
  {
    key: "darkCorridorWallSolidColorOverrideEnabled",
    label: "Use solid color for inferred dark walls",
    description: "Use a picked RGB color instead of a tileset tile.",
    type: "boolean",
  },
];

const clientOptionsDefaultTabId: ClientOptionsTabId = "display";

const clientOptionsTabs: ClientOptionsTab[] = [
  {
    id: "controls",
    label: "Controls",
    description: "Mouselook, perspective, and first-person behavior.",
    groupKey: "group-controls",
  },
  {
    id: "display",
    label: "Display",
    description: "Interface layout, tileset rendering, and visual effects.",
    groupKey: "group-display",
  },
  {
    id: "sound",
    label: "Sound",
    description: "Audio output and performance-related sound controls.",
    groupKey: "group-sound",
  },
  {
    id: "mobile",
    label: "Mobile",
    description: "Touch and drag behavior on mobile devices.",
    groupKey: "group-mobile-controls",
  },
  {
    id: "combat",
    label: "Combat",
    description: "Combat impact feedback and visual response.",
    groupKey: "group-combat",
  },
  {
    id: "compatibility",
    label: "Compatibility",
    description: "Runtime compatibility and NetHack behavior toggles.",
    groupKey: "group-compatibility",
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
  const padding = 8;
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 220;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 260;
  const maxX = Math.max(padding, window.innerWidth - safeWidth - padding);
  const maxY = Math.max(padding, window.innerHeight - safeHeight - padding);
  return {
    x: Math.min(Math.max(x, padding), maxX),
    y: Math.min(Math.max(y, padding), maxY),
  };
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
      rootStyle.getPropertyValue("--nh3d-modal-safe-right-inset"),
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
  return normalizeNh3dClientOptions({
    ...deviceDefaults,
    ...persisted,
  });
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
  return normalized ? `${normalized} (user)` : "User Tileset (user)";
}

function toUserTilesetRegistrations(
  records: ReadonlyArray<StoredUserTilesetRecord>,
): ReadonlyArray<{
  id: string;
  label: string;
  tileSize: number;
  blob: Blob;
}> {
  return records.map((record) => ({
    id: record.id,
    label: record.label,
    tileSize: record.tileSize,
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
        resolve(inferNh3dTilesetTileSizeFromAtlasWidth(image.naturalWidth));
      image.onerror = () => reject(new Error("Failed to read tileset image."));
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
  filename: string;
  timestamp: Date;
  dateFormatted: string;
};

async function fetchSavedGames(): Promise<SaveGameRecord[]> {
  const saves: SaveGameRecord[] = [];
  const dbNames = ["/save", "/nethack/save"];

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

        // Ignore structural/metadata files used by NetHack
        const knownNonSaves = [
          "record",
          "logfile",
          "xlogfile",
          "perm",
          "timestamp",
          ".keep",
        ];
        if (knownNonSaves.includes(filename)) continue;
        if (filename.includes("level") || filename.includes("lock")) continue;

        // NetHack prepends a user ID (usually 0) to save files, e.g. "0Web_user". Strip it.
        const name = filename.replace(/^\d+/, "");
        if (name && value && value.timestamp) {
          saves.push({
            key,
            name,
            filename,
            timestamp: new Date(value.timestamp),
            dateFormatted: new Date(value.timestamp).toLocaleString(),
          });
        }
      }

      db.close();
    } catch (e) {
      console.warn(`Could not read IndexedDB ${dbName}:`, e);
    }
  }

  // Deduplicate by name and sort by newest first
  const uniqueSaves = new Map<string, SaveGameRecord>();
  for (const save of saves) {
    const existing = uniqueSaves.get(save.name);
    if (!existing || existing.timestamp < save.timestamp) {
      uniqueSaves.set(save.name, save);
    }
  }

  return Array.from(uniqueSaves.values()).sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  );
}

async function deleteSavedGame(filename: string): Promise<void> {
  const dbNames = ["/save", "/nethack/save"];

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

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(["FILE_DATA"], "readwrite");
        const store = transaction.objectStore("FILE_DATA");

        // Emscripten IDBFS uses the absolute path as the object store key
        const fullKey = `${dbName}/${filename}`;

        const request = store.delete(fullKey);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();
    } catch (e) {
      console.warn(`Could not delete from IndexedDB ${dbName}:`, e);
    }
  }
}

export default function App(): JSX.Element {
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  const vrDomOverlayRootRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const [characterCreationConfig, setCharacterCreationConfig] =
    useState<CharacterCreationConfig | null>(null);
  const [startupFlowStep, setStartupFlowStep] =
    useState<StartupFlowStep>("choose");
  const [runtimeVersion, setRuntimeVersion] =
    useState<NethackRuntimeVersion>("3.6.7");
  const [createRole, setCreateRole] = useState(startupRoleOptions[0]);
  const [createRace, setCreateRace] = useState(startupRaceOptions[0]);
  const [createGender, setCreateGender] = useState(startupGenderOptions[0]);
  const [createAlign, setCreateAlign] = useState(startupAlignOptions[0]);
  const [createName, setCreateName] = useState("Web_user");
  const [savedGames, setSavedGames] = useState<SaveGameRecord[]>([]);
  const [isLoadingSaves, setIsLoadingSaves] = useState(false);

  const handleDeleteSave = async (
    e: ReactMouseEvent<HTMLButtonElement>,
    save: SaveGameRecord,
  ) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete ${save.name}?`)) {
      await deleteSavedGame(save.filename);
      setSavedGames((prev) => prev.filter((s) => s.filename !== save.filename));
    }
  };

  const handleResumeClick = async () => {
    setStartupFlowStep("resume");
    setIsLoadingSaves(true);
    try {
      const saves = await fetchSavedGames();
      setSavedGames(saves);
    } catch (e) {
      console.error("Error loading saves", e);
    } finally {
      setIsLoadingSaves(false);
    }
  };

  const handleStartNewGame = async (config: CharacterCreationConfig) => {
    if (config.mode === "random" || config.mode === "create") {
      try {
        const saves = await fetchSavedGames();
        const configName = config.name || "Web_user";
        const existingSave = saves.find((s) => s.name === configName);
        if (existingSave) {
          const confirmed = window.confirm(
            `A saved game named "${configName}" already exists.\n\nDo you want to overwrite it with a new character?`,
          );
          if (!confirmed) {
            return;
          }
          await deleteSavedGame(existingSave.filename);
        }
      } catch (e) {
        console.warn("Failed to check for existing saves:", e);
      }
    }
    setCharacterCreationConfig(config);
  };

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
  const [hasHydratedUserTilesets, setHasHydratedUserTilesets] = useState(false);
  const [isClientOptionsVisible, setIsClientOptionsVisible] = useState(false);
  const [activeClientOptionsTab, setActiveClientOptionsTab] =
    useState<ClientOptionsTabId>(clientOptionsDefaultTabId);
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
  const [userTilesets, setUserTilesets] = useState<StoredUserTilesetRecord[]>(
    [],
  );
  const [tilesetManagerMode, setTilesetManagerMode] = useState<"edit" | "new">(
    "edit",
  );
  const [tilesetManagerName, setTilesetManagerName] = useState("");
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
  const [tileAtlasState, setTileAtlasState] = useState<TileAtlasState>({
    loaded: false,
    failed: false,
    tileSourceSize: 32,
    columns: 0,
    rows: 0,
    tileCount: 0,
  });
  const [tilesetManagerAtlasImage, setTilesetManagerAtlasImage] =
    useState<HTMLImageElement | null>(null);
  const [tilesetManagerAtlasState, setTilesetManagerAtlasState] =
    useState<TileAtlasState>({
      loaded: false,
      failed: false,
      tileSourceSize: 32,
      columns: 0,
      rows: 0,
      tileCount: 0,
    });
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileActionSheetVisible, setIsMobileActionSheetVisible] =
    useState(false);
  const [mobileActionSheetMode, setMobileActionSheetMode] =
    useState<MobileActionSheetMode>("quick");
  const [isMobileLogVisible, setIsMobileLogVisible] = useState(false);
  const [statsBarHeight, setStatsBarHeight] = useState(0);
  const [coreStatBoldUntilTurn, setCoreStatBoldUntilTurn] = useState<
    Partial<Record<CoreStatKey, number>>
  >({});
  const previousCoreStatSnapshotRef = useRef<CoreStatSnapshot | null>(null);
  const [textInputValue, setTextInputValue] = useState("");
  const soundPackDialogActionsRef = useRef<SoundPackDialogActions | null>(null);
  const adapter = useMemo(() => createEngineUiAdapter(), []);
  const setEngineController = useGameStore(
    (state) => state.setEngineController,
  );
  const setPositionRequest = useGameStore((state) => state.setPositionRequest);
  const setFloatingMessageTiming = useGameStore(
    (state) => state.setFloatingMessageTiming,
  );
  const setNewGamePrompt = useGameStore((state) => state.setNewGamePrompt);

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
  const connectionState = useGameStore((state) => state.connectionState);
  const extendedCommands = useGameStore((state) => state.extendedCommands);
  const controller = useGameStore((state) => state.engineController);
  const newGamePrompt = useGameStore((state) => state.newGamePrompt);
  const xrAvailability = useGameStore((state) => state.xrAvailability);
  const xrSessionState = useGameStore((state) => state.xrSessionState);
  const vrQuickPanelVisible = useGameStore(
    (state) => state.vrQuickPanelVisible,
  );
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
      "--nh3d-minimap-scale",
      String(clientOptions.minimapScale),
    );
    return () => {
      root.style.removeProperty("--nh3d-ui-font-scale");
      root.style.removeProperty("--nh3d-live-log-font-scale");
      root.style.removeProperty("--nh3d-minimap-scale");
    };
  }, [
    clientOptions.uiFontScale,
    clientOptions.liveMessageLogFontScale,
    clientOptions.minimapScale,
  ]);
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    const immersive = xrSessionState === "immersive";
    root.classList.toggle("nh3d-vr-active", immersive);
    return () => {
      root.classList.remove("nh3d-vr-active");
    };
  }, [xrSessionState]);
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
  const tilesetCatalog = useMemo(() => getNh3dTilesetCatalog(), [userTilesets]);
  const showBuiltInTilesetsInTilesetManagerList = useMemo(
    () => isRunningOnLocalhost(),
    [],
  );
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
  const tilesetDropdownOptions = useMemo(
    () =>
      hasAnyTilesets
        ? tilesetCatalog.map((tileset) => ({
            value: tileset.path,
            label: tileset.label,
          }))
        : [{ value: "", label: "No tilesets found" }],
    [hasAnyTilesets, tilesetCatalog],
  );
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
  const isFpsPlayMode = clientOptions.fpsMode;
  const fpsContextTitle = String(fpsCrosshairContext?.title || "");
  const shouldScrollFpsContextTitle = fpsContextTitle.length > 0;
  const fpsContextTitleDurationSec = Math.max(
    6,
    Math.min(20, fpsContextTitle.length * 0.14),
  );
  const fpsContextTitleStyle: CSSProperties | undefined =
    shouldScrollFpsContextTitle
      ? ({
          "--nh3d-context-title-scroll-duration": `${fpsContextTitleDurationSec}s`,
        } as CSSProperties)
      : undefined;
  const fpsCrosshairContextMenuRef = useRef<HTMLDivElement | null>(null);
  const [tileContextMenuPosition, setTileContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const inventoryItemActions = inventoryContextActions;
  const inventoryContextMenuRef = useRef<HTMLDivElement | null>(null);
  const [inventoryContextMenu, setInventoryContextMenu] =
    useState<InventoryContextMenuState | null>(null);
  const inventoryContextTitle = inventoryContextMenu
    ? `${inventoryContextMenu.itemText} (${inventoryContextMenu.accelerator})`
    : "";
  const shouldScrollInventoryContextTitle = inventoryContextTitle.length > 36;
  const inventoryContextTitleDurationSec = Math.max(
    6,
    Math.min(20, inventoryContextTitle.length * 0.14),
  );
  const inventoryContextTitleStyle: CSSProperties | undefined =
    shouldScrollInventoryContextTitle
      ? ({
          "--nh3d-context-title-scroll-duration": `${inventoryContextTitleDurationSec}s`,
        } as CSSProperties)
      : undefined;
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
  const inventoryContextMenuActions = useMemo(() => {
    const blocked = getBlockedInventoryActionIdsForCategory(
      inventoryContextCategory,
    );
    const visibleActions = blocked.size
      ? inventoryItemActions.filter((action) => !blocked.has(action.id))
      : inventoryItemActions;
    const selectedItemText = String(inventoryContextMenu?.itemText || "");
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
    inventoryContextMenu?.itemText,
    inventoryItemActions,
  ]);
  const representativeGlyphByTileId = useMemo(
    () => buildRepresentativeGlyphByTileId(GLYPH_CATALOG_367),
    [],
  );
  const representativeGlyphNumberByTileId = useMemo(
    () => buildRepresentativeGlyphNumberByTileId(GLYPH_CATALOG_367),
    [],
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
    const mappedMode = tilesetPath
      ? clientOptionsDraft.tilesetBackgroundRemovalModeByTileset[tilesetPath]
      : undefined;
    if (mappedMode === "solid" || mappedMode === "tile") {
      return mappedMode;
    }
    return "tile";
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
  const tilePickerStatusText = !selectedTilesetEntry
    ? "No tileset atlas available."
    : tileAtlasState.failed
      ? "Unable to load tile atlas."
      : "Loading tile atlas...";
  const tilePreviewDataUrlById = useMemo(() => {
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
    tileAtlasState.loaded,
    tileAtlasState.tileCount,
    tileAtlasState.tileSourceSize,
  ]);
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
  const renderTilePreviewImage = (tileId: number): JSX.Element | null => {
    const tilePreviewDataUrl = getTilePreviewDataUrl(tileId);
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
    ? "No tileset atlas available."
    : tilesetManagerAtlasState.failed
      ? "Unable to load tile atlas."
      : "Loading tile atlas...";
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
    tilesetManagerAtlasState.loaded,
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
      vrDomOverlayRoot: vrDomOverlayRootRef.current,
      uiAdapter: adapter,
      characterCreationConfig,
      clientOptions,
    });
    setEngineController(engine);
    registerDebugHelpers(engine);
    return () => {
      engine.destroy();
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
    if (!hasHydratedUserTilesets) {
      return;
    }
    persistNh3dClientOptionsToIndexedDb(clientOptions).catch((error) => {
      console.warn("Failed to persist client options to IndexedDB:", error);
    });
  }, [clientOptions, hasHydratedUserTilesets]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!selectedTilesetEntry) {
      setTileAtlasState({
        loaded: false,
        failed: false,
        tileSourceSize: 32,
        columns: 0,
        rows: 0,
        tileCount: 0,
      });
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
      const tileSourceSize =
        inferNh3dTilesetTileSizeFromAtlasWidth(naturalWidth);
      const height = Math.max(0, Math.trunc(atlasImage.naturalHeight));
      const columns = nh3dTilesetAtlasTileColumns;
      const rows = Math.max(0, Math.floor(height / tileSourceSize));
      const tileCount = columns > 0 && rows > 0 ? columns * rows : 0;
      setTileAtlasState({
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
        loaded: false,
        failed: true,
        tileSourceSize: 32,
        columns: 0,
        rows: 0,
        tileCount: 0,
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
  }, [selectedTilesetEntry]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!selectedTilesetManagerEditEntry) {
      setTilesetManagerAtlasState({
        loaded: false,
        failed: false,
        tileSourceSize: 32,
        columns: 0,
        rows: 0,
        tileCount: 0,
      });
      setTilesetManagerAtlasImage(null);
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
      const tileSourceSize =
        inferNh3dTilesetTileSizeFromAtlasWidth(naturalWidth);
      const height = Math.max(0, Math.trunc(atlasImage.naturalHeight));
      const columns = nh3dTilesetAtlasTileColumns;
      const rows = Math.max(0, Math.floor(height / tileSourceSize));
      const tileCount = columns > 0 && rows > 0 ? columns * rows : 0;
      setTilesetManagerAtlasState({
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
        loaded: false,
        failed: true,
        tileSourceSize: 32,
        columns: 0,
        rows: 0,
        tileCount: 0,
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
  }, [selectedTilesetManagerEditEntry]);

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

  const isVrImmersiveSession = xrSessionState === "immersive";
  const showVrTouchControls = isVrImmersiveSession && !isFpsPlayMode;
  const shouldUseMobileGameplayLayout = isMobileViewport || showVrTouchControls;
  const isMobileGameRunning =
    shouldUseMobileGameplayLayout &&
    characterCreationConfig !== null &&
    connectionState === "running" &&
    !loadingVisible;
  const shouldRenderDomMobileTouchHud =
    isMobileGameRunning && !showVrTouchControls;

  const isDesktopGameRunning =
    !isMobileGameRunning &&
    characterCreationConfig !== null &&
    connectionState === "running" &&
    !loadingVisible;

  const startup = !isMobileGameRunning && !isDesktopGameRunning;

  useLayoutEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (!startup) {
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
  }, [startup]);

  const hasGameplayOverlayOpen =
    Boolean(question) ||
    Boolean(directionQuestion) ||
    Boolean(infoMenu) ||
    inventory.visible ||
    Boolean(textInputRequest) ||
    Boolean(positionRequest) ||
    Boolean(inventoryContextMenu) ||
    Boolean(fpsCrosshairContext) ||
    newGamePrompt.visible;

  useEffect(() => {
    if (!isMobileGameRunning) {
      setIsMobileActionSheetVisible(false);
      setMobileActionSheetMode("quick");
      setIsMobileLogVisible(false);
    }
  }, [isMobileGameRunning]);

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
    const currentTurn = Number.isFinite(playerStats.time)
      ? Math.trunc(playerStats.time)
      : 0;
    const nextSnapshot: CoreStatSnapshot = {
      turn: currentTurn,
      playerName: String(playerStats.name || ""),
      values: getCoreStatValuesFromSnapshot(playerStats),
    };
    const previousSnapshot = previousCoreStatSnapshotRef.current;
    if (
      !previousSnapshot ||
      nextSnapshot.turn < previousSnapshot.turn ||
      nextSnapshot.playerName !== previousSnapshot.playerName
    ) {
      previousCoreStatSnapshotRef.current = nextSnapshot;
      setCoreStatBoldUntilTurn({});
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
  }, [playerStats]);

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
  const locationStatusText = [playerStats.hunger, playerStats.encumbrance]
    .filter((value) => Boolean(value))
    .join(" ");
  const parsedQuestionChoices = question
    ? parseQuestionChoices(question.text, question.choices)
    : [];
  const isYesNoQuestionChoices = isYesNoChoicePrompt(parsedQuestionChoices);
  const useInventoryChoiceLabels = !isYesNoQuestionChoices;
  const questionMenuPageIndex = question?.menuPageIndex ?? 0;
  const questionMenuPageCount = Math.max(1, question?.menuPageCount ?? 1);
  const questionSelectableMenuItemCount = question
    ? question.menuItems.filter((item) => isSelectableQuestionMenuItem(item))
        .length
    : 0;
  const showPickupActionButtons =
    Boolean(question?.isPickupDialog) &&
    (questionSelectableMenuItemCount > 1 || isMobileGameRunning);
  const inventoryContextActionsEnabled =
    inventory.contextActionsEnabled !== false;
  const inventoryCloseInstructionText = inventoryContextActionsEnabled
    ? "Select an item to open contextual commands. Press ENTER, ESC, or 'i' to close"
    : "Press ENTER, ESC, or 'i' to close.";

  useLayoutEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const visibleDialogs = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".nh3d-dialog.is-visible, #position-dialog.is-visible",
      ),
    );
    if (visibleDialogs.length === 0) {
      return;
    }

    const selectableButtonSelector = [
      "button:not(:disabled):not(.nh3d-mobile-dialog-close)",
      '[role="button"][tabindex="0"]',
    ].join(", ");

    const topDialog = visibleDialogs[visibleDialogs.length - 1];
    if (topDialog.id === "text-input-dialog") {
      return;
    }

    const explicitActiveTarget = topDialog.querySelector<HTMLElement>(
      ".nh3d-menu-button.nh3d-menu-button-active, .nh3d-menu-action-button.nh3d-action-button-active, .nh3d-pickup-action-button.nh3d-action-button-active",
    );
    const firstSelectableButton = topDialog.querySelector<HTMLElement>(
      selectableButtonSelector,
    );
    const activeElement =
      typeof document.activeElement === "object" &&
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const activeElementInDialog =
      activeElement &&
      topDialog.contains(activeElement) &&
      activeElement.matches(selectableButtonSelector)
        ? activeElement
        : null;
    const targetButton =
      activeElementInDialog ?? explicitActiveTarget ?? firstSelectableButton;
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
    isDarkWallTilePickerVisible,
    isTilesetBackgroundTilePickerVisible,
    isTilesetManagerVisible,
    isTilesetSolidColorPickerVisible,
    newGamePrompt.visible,
    question,
    textInputRequest,
  ]);

  const mobileExtendedCommandNames = useMemo(
    () => resolveMobileExtendedCommandNames(extendedCommands),
    [extendedCommands],
  );
  const mobileCommonExtendedCommandNames = useMemo(
    () =>
      resolveMobileCommonExtendedCommandNames(mobileExtendedCommandNames),
    [mobileExtendedCommandNames],
  );

  const submitTextInput = (value: string): void => {
    controller?.submitTextInput(value);
    setTextInputValue("");
  };

  const startNewGameFromPrompt = (): void => {
    if (typeof window === "undefined") {
      return;
    }
    window.location.reload();
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
    setTilesetManagerMode("edit");
    setTilesetManagerEditPath(tilesetPath);
    setTilesetManagerName(
      userRecord
        ? stripUserTilesetNameSuffix(userRecord.label)
        : tilesetEntry.label,
    );
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
      setTilesetManagerName(strippedName || "User Tileset");
    }
  };

  const removeUserTileset = async (
    record: StoredUserTilesetRecord,
  ): Promise<void> => {
    const label = String(record.label || "this tileset");
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete '${label}' from uploaded tilesets?`)
    ) {
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
        const fallbackTilesetPath = getNh3dTilesetCatalog()[0]?.path ?? "";
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
        error instanceof Error ? error.message : "Failed to delete tileset.";
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
      }),
    );
    controller?.setClientOptions(next);
  };

  const saveTilesetManager = async (): Promise<void> => {
    const file = tilesetManagerFile;
    const label = stripUserTilesetNameSuffix(tilesetManagerName);
    const userLabel = appendUserTilesetNameSuffix(label);
    if (tilesetManagerInNewMode) {
      if (!file) {
        setTilesetManagerError("Choose a PNG/BMP/GIF/JPEG tileset file.");
        return;
      }
      if (!label) {
        setTilesetManagerError("Provide a name for this tileset.");
        return;
      }
    }
    if (
      !tilesetManagerInNewMode &&
      selectedTilesetManagerEditUserRecord &&
      !label
    ) {
      setTilesetManagerError("Provide a name for this tileset.");
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
        error instanceof Error ? error.message : "Failed to save tileset.";
      setTilesetManagerError(message);
    } finally {
      setTilesetManagerBusy(false);
    }
  };

  useEffect(() => {
    refreshUserTilesetCatalog(true).catch((error) => {
      console.warn("Failed to load uploaded tilesets:", error);
    });
  }, [refreshUserTilesetCatalog]);

  const openClientOptionsDialog = (): void => {
    setClientOptionsDraft({ ...clientOptions });
    setActiveClientOptionsTab(clientOptionsDefaultTabId);
    setIsClientOptionsVisible(true);
    setIsDarkWallTilePickerVisible(false);
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setIsTilesetManagerVisible(false);
    setIsResetClientOptionsConfirmationVisible(false);
    controller?.dismissFpsCrosshairContextMenu();
  };

  const closeClientOptionsDialog = async (): Promise<void> => {
    const canDiscardSoundPackChanges =
      soundPackDialogActionsRef.current?.confirmDiscardIfNeeded() ?? true;
    if (!canDiscardSoundPackChanges) {
      return;
    }
    setIsClientOptionsVisible(false);
    setIsDarkWallTilePickerVisible(false);
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setIsTilesetManagerVisible(false);
    setIsResetClientOptionsConfirmationVisible(false);
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
    controller?.setClientOptions(next);
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

  const confirmResetClientOptionsToDefaults = (): void => {
    const next = normalizeNh3dClientOptions(defaultNh3dClientOptions);
    setClientOptions(next);
    setClientOptionsDraft(next);
    setIsDarkWallTilePickerVisible(false);
    setIsTilesetBackgroundTilePickerVisible(false);
    setIsTilesetSolidColorPickerVisible(false);
    setIsTilesetManagerVisible(false);
    setIsResetClientOptionsConfirmationVisible(false);
    controller?.setClientOptions(next);
    void (async () => {
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
    })();
  };

  const updateClientOptionDraft = <
    K extends
      | ClientOptionToggleKey
      | ClientOptionSelect["key"]
      | ClientOptionSlider["key"],
  >(
    optionKey: K,
    value: Nh3dClientOptions[K],
  ): void => {
    setClientOptionsDraft((previous) => ({
      ...previous,
      [optionKey]: value,
    }));
  };

  const updateTilesetPathDraft = (rawTilesetPath: string): void => {
    const tilesetPath = String(rawTilesetPath || "").trim();
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
        mappedBackgroundRemovalMode === "solid" ? "solid" : "tile";
      const nextSolidColorHex = normalizeSolidChromaKeyHex(
        typeof mappedSolidColorHex === "string"
          ? mappedSolidColorHex
          : resolveDefaultNh3dTilesetSolidChromaKeyColorHex(tilesetPath),
      );
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
    let clamped = rawValue;
    if (key === "brightness") {
      clamped = Math.max(-0.25, Math.min(0.25, rawValue));
    } else if (key === "contrast") {
      clamped = Math.max(-0.25, Math.min(0.25, rawValue));
    } else if (key === "gamma") {
      clamped = Math.max(0.5, Math.min(2.5, rawValue));
    } else if (key === "minimapScale") {
      clamped = Math.max(0.6, Math.min(2.2, rawValue));
    } else if (key === "liveMessageDisplayTimeMs") {
      clamped = Math.max(250, Math.min(6000, rawValue));
    } else if (key === "uiFontScale") {
      clamped = Math.max(0.7, Math.min(1.8, rawValue));
    } else if (key === "liveMessageLogFontScale") {
      clamped = Math.max(0.7, Math.min(2.2, rawValue));
    } else {
      clamped = Math.max(120, Math.min(4000, rawValue));
    }
    if (
      key === "liveMessageDisplayTimeMs" ||
      key === "liveMessageFadeOutTimeMs"
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
      mode === "solid" ? "solid" : "tile";
    setClientOptionsDraft((previous) => {
      const selectedTilesetPath = String(previous.tilesetPath || "").trim();
      const tilesetPath = String(rawTilesetPath || selectedTilesetPath).trim();
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

  useEffect(() => {
    if (!clientOptionsDraft.darkCorridorWallTileOverrideEnabled) {
      setIsDarkWallTilePickerVisible(false);
    }
  }, [clientOptionsDraft.darkCorridorWallTileOverrideEnabled]);

  useEffect(() => {
    if (!clientOptionsDraft.darkCorridorWalls367) {
      setIsDarkWallTilePickerVisible(false);
    }
  }, [clientOptionsDraft.darkCorridorWalls367]);

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
      <button
        aria-label={label}
        className="nh3d-mobile-dialog-close"
        onClick={onClick}
        type="button"
      >
        {"\u00D7"}
      </button>
    ) : null;

  const openInventoryContextMenu = (
    item: NethackMenuItem,
    clientX: number,
    clientY: number,
  ): void => {
    if (!inventoryContextActionsEnabled) {
      return;
    }
    if (typeof item.accelerator !== "string") {
      return;
    }

    const initial = clampInventoryContextMenuPosition(
      clientX + 8,
      clientY + 8,
      220,
      260,
    );

    setInventoryContextMenu({
      accelerator: item.accelerator,
      itemText: String(item.text || "Unknown item"),
      x: initial.x,
      y: initial.y,
    });
  };

  const runFpsCrosshairContextAction = (
    action: FpsCrosshairContextState["actions"][number],
  ): void => {
    // Workaround for a race condition in context-menu command submission.
    // TODO: remove once the underlying ordering issue is fixed.
    const contextualSubmitDelayMs = 50;
    const autoDirectionFromFpsAim =
      fpsCrosshairContext?.autoDirectionFromFpsAim === true;
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

  const updateLiveClientOptions = useCallback(
    (updater: (current: Nh3dClientOptions) => Nh3dClientOptions): void => {
      setClientOptions((current) => {
        const next = normalizeNh3dClientOptions(updater(current));
        setClientOptionsDraft(next);
        controller?.setClientOptions(next);
        return next;
      });
    },
    [controller],
  );

  const handleVrSessionAction = useCallback((): void => {
    void controller?.toggleVr();
  }, [controller]);

  const handleVrExitToFlat = useCallback((): void => {
    void controller?.exitVr();
  }, [controller]);

  const handleVrToggleQuickPanel = useCallback((): void => {
    controller?.toggleVrQuickPanel();
  }, [controller]);

  const handleVrTogglePlayMode = useCallback((): void => {
    updateLiveClientOptions((current) => ({
      ...current,
      fpsMode: !current.fpsMode,
    }));
  }, [updateLiveClientOptions]);

  const handleVrToggleFollowPlayer = useCallback((): void => {
    updateLiveClientOptions((current) => ({
      ...current,
      vrFollowPlayer: !current.vrFollowPlayer,
    }));
  }, [updateLiveClientOptions]);

  const handleVrToggleBoundaries = useCallback((): void => {
    updateLiveClientOptions((current) => ({
      ...current,
      vrShowLevelBoundaries: !current.vrShowLevelBoundaries,
    }));
  }, [updateLiveClientOptions]);

  const handleMobileSelectAction = useCallback(
    (action: MobileActionEntry): void => {
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
    },
    [controller],
  );

  const handleMobileRunExtendedCommand = useCallback(
    (command: string): void => {
      controller?.dismissFpsCrosshairContextMenu();
      controller?.runExtendedCommand(command);
      setIsMobileActionSheetVisible(false);
      setMobileActionSheetMode("quick");
    },
    [controller],
  );

  const handleMobileOpenPauseMenu = useCallback((): void => {
    setIsMobileActionSheetVisible(false);
    setMobileActionSheetMode("quick");
    setIsPauseMenuVisible(true);
  }, []);

  const handleMobileCloseActionSheet = useCallback((): void => {
    setIsMobileActionSheetVisible(false);
    setMobileActionSheetMode("quick");
  }, []);

  const handleMobileOpenInventory = useCallback((): void => {
    controller?.dismissFpsCrosshairContextMenu();
    controller?.toggleInventoryDialog();
  }, [controller]);

  const handleMobileToggleLog = useCallback((): void => {
    controller?.dismissFpsCrosshairContextMenu();
    if (!clientOptions.liveMessageLog) {
      return;
    }
    setIsMobileLogVisible((visible) => {
      const next = !visible;
      if (next) {
        setIsMobileActionSheetVisible(false);
        setMobileActionSheetMode("quick");
      }
      return next;
    });
  }, [clientOptions.liveMessageLog, controller]);

  const handleMobilePickup = useCallback((): void => {
    controller?.dismissFpsCrosshairContextMenu();
    controller?.runQuickAction("pickup");
  }, [controller]);

  const handleMobileSearch = useCallback((): void => {
    controller?.dismissFpsCrosshairContextMenu();
    controller?.runQuickAction("search");
  }, [controller]);

  const handleMobileToggleActionSheet = useCallback((): void => {
    controller?.dismissFpsCrosshairContextMenu();
    setIsMobileActionSheetVisible((visible) => {
      const next = !visible;
      if (next) {
        setMobileActionSheetMode("quick");
        setIsMobileLogVisible(false);
      }
      return next;
    });
  }, [controller]);

  const handleMobileRepeatAction = useCallback((): void => {
    controller?.dismissFpsCrosshairContextMenu();
    controller?.repeatLastAction();
  }, [controller]);

  const handleVrAdjustTilt = useCallback(
    (deltaDegrees: number): void => {
      if (!Number.isFinite(deltaDegrees)) {
        return;
      }
      updateLiveClientOptions((current) => {
        const nextTiltDegrees =
          (Number.isFinite(current.vrTabletopTiltDegrees)
            ? current.vrTabletopTiltDegrees
            : 0) + deltaDegrees;
        const clampedTiltDegrees = Math.max(0, Math.min(45, nextTiltDegrees));
        const roundedTiltDegrees = Math.round(clampedTiltDegrees * 2) / 2;
        return {
          ...current,
          vrTabletopTiltDegrees: roundedTiltDegrees,
        };
      });
    },
    [updateLiveClientOptions],
  );

  useEffect(() => {
    if (!inventory.visible) {
      setInventoryContextMenu(null);
    }
  }, [inventory.visible]);

  useEffect(() => {
    if (inventoryContextActionsEnabled) {
      return;
    }
    setInventoryContextMenu(null);
  }, [inventoryContextActionsEnabled]);

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
    if (
      !reopenNewGamePromptOnInteraction ||
      newGamePrompt.visible ||
      typeof window === "undefined"
    ) {
      return;
    }
    let handled = false;
    const handleFirstInteraction = (): void => {
      if (handled) {
        return;
      }
      handled = true;
      setReopenNewGamePromptOnInteraction(false);
      setNewGamePrompt({
        visible: true,
        reason: deferredNewGamePromptReason,
      });
    };
    const handleEnterKey = (event: KeyboardEvent): void => {
      if (event.key !== "Enter" && event.key !== "NumpadEnter") {
        return;
      }
      handleFirstInteraction();
    };
    window.addEventListener("pointerdown", handleFirstInteraction, true);
    window.addEventListener("keydown", handleEnterKey, true);
    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction, true);
      window.removeEventListener("keydown", handleEnterKey, true);
    };
  }, [
    deferredNewGamePromptReason,
    newGamePrompt.visible,
    reopenNewGamePromptOnInteraction,
    setNewGamePrompt,
  ]);

  useEffect(() => {
    if (!inventoryContextMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (target && inventoryContextMenuRef.current?.contains(target)) {
        return;
      }
      setInventoryContextMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setInventoryContextMenu(null);
      }
    };

    const handleViewportResize = (): void => {
      setInventoryContextMenu((previous) => {
        if (!previous) {
          return previous;
        }
        const menuElement = inventoryContextMenuRef.current;
        const rect = menuElement?.getBoundingClientRect();
        const clamped = clampInventoryContextMenuPosition(
          previous.x,
          previous.y,
          rect?.width ?? 220,
          rect?.height ?? 260,
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
  }, [inventoryContextMenu]);

  useLayoutEffect(() => {
    if (!inventoryContextMenu) {
      return;
    }

    const menuElement = inventoryContextMenuRef.current;
    if (!menuElement) {
      return;
    }

    const rect = menuElement.getBoundingClientRect();
    const clamped = clampInventoryContextMenuPosition(
      inventoryContextMenu.x,
      inventoryContextMenu.y,
      rect.width,
      rect.height,
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
  }, [inventoryContextMenu]);

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
    if (!fpsCrosshairContext) {
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
  }, [controller, fpsCrosshairContext]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleEscapeForClientOptions = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || isMobileViewport) {
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

      if (isPauseMenuVisible) {
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

      if (!isDesktopGameRunning || hasGameplayOverlayOpen) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setIsPauseMenuVisible(true);
    };

    window.addEventListener("keydown", handleEscapeForClientOptions, true);
    return () => {
      window.removeEventListener("keydown", handleEscapeForClientOptions, true);
    };
  }, [
    clientOptions,
    controller,
    hasGameplayOverlayOpen,
    isClientOptionsVisible,
    isDarkWallTilePickerVisible,
    isTilesetBackgroundTilePickerVisible,
    isTilesetSolidColorPickerVisible,
    isTilesetManagerVisible,
    isResetClientOptionsConfirmationVisible,
    isPauseMenuVisible,
    isExitConfirmationVisible,
    isDesktopGameRunning,
    isMobileViewport,
  ]);

  const renderPauseMenu = () => {
    if (!isPauseMenuVisible) {
      return null;
    }

    if (isExitConfirmationVisible) {
      return (
        <div
          className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions is-visible"
          id="exit-confirmation-dialog"
        >
          <div className="nh3d-question-text">
            Do you want to save before quitting?
          </div>
          <div className="nh3d-menu-actions">
            <button
              className="nh3d-menu-action-button nh3d-menu-action-confirm"
              onClick={() => {
                controller?.sendInput("S");
                setTimeout(() => window.location.reload(), 1000);
              }}
              type="button"
            >
              Yes
            </button>
            <button
              className="nh3d-menu-action-button"
              onClick={() => {
                window.location.reload();
              }}
              type="button"
            >
              No
            </button>
            <button
              className="nh3d-menu-action-button nh3d-menu-action-cancel"
              onClick={() => setIsExitConfirmationVisible(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions is-visible"
        id="pause-menu-dialog"
      >
        <div className="nh3d-options-title">Game Paused</div>
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
              Resume
            </button>
            <button
              className="nh3d-choice-button"
              onClick={openClientOptionsDialog}
              type="button"
            >
              Options
            </button>
            <button
              className="nh3d-choice-button"
              onClick={() => {
                controller?.sendInput("S");
                setIsPauseMenuVisible(false);
              }}
              type="button"
            >
              Save game
            </button>
            <button
              className="nh3d-choice-button"
              onClick={() => setIsExitConfirmationVisible(true)}
              type="button"
            >
              Exit to main menu
            </button>
            <button
              className="nh3d-choice-button"
              onClick={() => {
                window.close();
              }}
              type="button"
            >
              Quit Game
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="nh3d-canvas-root" ref={canvasRootRef} />
      <div
        className={`nh3d-dom-overlay-root${
          xrSessionState === "immersive" ? " nh3d-vr-overlay-active" : ""
        }`}
        id="nh3d-vr-dom-overlay-root"
        ref={vrDomOverlayRootRef}
      >
        <VrAframeHudFrame
          availability={xrAvailability}
          clientOptions={clientOptions}
          offerEnabled={clientOptions.vrOfferOnSupportedDevice}
          onExitVr={handleVrExitToFlat}
          onSessionAction={handleVrSessionAction}
          onToggleBoundaries={handleVrToggleBoundaries}
          onToggleFollowPlayer={handleVrToggleFollowPlayer}
          onTogglePlayMode={handleVrTogglePlayMode}
          onToggleQuickPanel={handleVrToggleQuickPanel}
          quickPanelVisible={vrQuickPanelVisible}
          sessionState={xrSessionState}
          touchHud={{
            actionSheetMode: mobileActionSheetMode,
            actionSheetVisible: isMobileActionSheetVisible,
            commonExtendedCommandNames: mobileCommonExtendedCommandNames,
            extendedCommandNames: mobileExtendedCommandNames,
            logEnabled: clientOptions.liveMessageLog,
            logVisible: isMobileLogVisible,
            onAdjustTilt: handleVrAdjustTilt,
            onCloseActionSheet: handleMobileCloseActionSheet,
            onOpenInventory: handleMobileOpenInventory,
            onPickup: handleMobilePickup,
            onRepeatAction: handleMobileRepeatAction,
            onRunExtendedCommand: handleMobileRunExtendedCommand,
            onSearch: handleMobileSearch,
            onSelectAction: handleMobileSelectAction,
            onSetActionSheetMode: setMobileActionSheetMode,
            onShowPauseMenu: handleMobileOpenPauseMenu,
            onToggleActionSheet: handleMobileToggleActionSheet,
            onToggleLog: handleMobileToggleLog,
            quickActions: mobileActions,
            repeatActionVisible,
            tiltDegrees: clientOptions.vrTabletopTiltDegrees,
            visible: isMobileGameRunning && showVrTouchControls,
          }}
        />
      {renderPauseMenu()}
      {startup && (
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

      {characterCreationConfig === null ? (
        <>
          <div
            className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions is-visible startup"
            id="character-setup-dialog"
          >
            {startupFlowStep === "choose" ? (
              <>
                <div className="nh3d-question-text">
                  Choose your character setup:
                </div>
                <div className="nh3d-overflow-glow-frame">
                  <div
                    className="nh3d-choice-list nh3d-choice-list-startup-choose"
                    data-nh3d-overflow-glow
                    data-nh3d-overflow-glow-host="parent"
                  >
                    <div className="nh3d-startup-config-grid centered">
                      <label className="nh3d-startup-config-field">
                        <span>NetHack Version</span>
                        <select
                          className="nh3d-startup-config-select"
                          onChange={(event) =>
                            setRuntimeVersion(
                              event.target.value as NethackRuntimeVersion,
                            )
                          }
                          value={runtimeVersion}
                        >
                          <option value="3.6.7">3.6.x (3.6.7)</option>
                          {import.meta.env.DEV && (
                            <option value="3.7">3.7</option>
                          )}
                        </select>
                      </label>
                    </div>
                    <button
                      className="nh3d-choice-button nh3d-character-setup-choice-button"
                      onClick={() => setStartupFlowStep("random")}
                      type="button"
                    >
                      Random character
                    </button>
                    <button
                      className="nh3d-choice-button nh3d-character-setup-choice-button"
                      onClick={() => setStartupFlowStep("create")}
                      type="button"
                    >
                      Create character
                    </button>
                    <button
                      className="nh3d-choice-button nh3d-character-setup-choice-button"
                      onClick={handleResumeClick}
                      type="button"
                    >
                      Load game
                    </button>
                    <button
                      className="nh3d-choice-button nh3d-character-setup-choice-button"
                      onClick={openClientOptionsDialog}
                      type="button"
                    >
                      NetHack 3D Options
                    </button>
                    <button
                      className="nh3d-choice-button nh3d-character-setup-choice-button"
                      onClick={() => window.close()}
                      type="button"
                    >
                      Quit Game
                    </button>
                  </div>
                </div>
              </>
            ) : startupFlowStep === "resume" ? (
              <>
                <div className="nh3d-question-text">Select a saved game:</div>
                <div className="nh3d-overflow-glow-frame">
                  <div
                    className="nh3d-choice-list"
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
                        Loading saves...
                      </div>
                    ) : savedGames.length > 0 ? (
                      savedGames.map((save) => (
                      <button
                        key={save.name}
                        className="nh3d-choice-button nh3d-character-setup-choice-button"
                        style={{
                          flexDirection: "column",
                          alignItems: "flex-start",
                          padding: "12px",
                          width: "100%",
                        }}
                        onClick={() => {
                          setCharacterCreationConfig({
                            mode: "resume" as any,
                            playMode: clientOptions.fpsMode ? "fps" : "normal",
                            runtimeVersion,
                            name: save.name,
                          });
                        }}
                        type="button"
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            width: "100%",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize:
                                  "calc(16px * var(--nh3d-ui-font-scale, 1))",
                              }}
                            >
                              {save.name}
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
                              Saved: {save.dateFormatted}
                            </div>
                          </div>
                          <button
                            className="delete-button"
                            onClick={(e) => handleDeleteSave(e, save)}
                          >
                            X
                          </button>
                        </div>
                      </button>
                      ))
                    ) : (
                      <div
                        style={{
                          padding: "20px",
                          color: "var(--nh3d-ui-text-muted)",
                        }}
                      >
                        No saved games found.
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
                    Back
                  </button>
                </div>
              </>
            ) : startupFlowStep === "random" ? (
              <>
                <div className="nh3d-question-text">
                  Enter a name for your random character:
                </div>
                <div className="nh3d-startup-config-grid centered">
                  <label className="nh3d-startup-config-field">
                    <span>Name</span>
                    <input
                      className="nh3d-startup-config-input"
                      maxLength={30}
                      onChange={(event) => setCreateName(event.target.value)}
                      placeholder="Web_user"
                      type="text"
                      value={createName}
                    />
                  </label>
                </div>
                <div className="nh3d-menu-actions">
                  <button
                    className="nh3d-menu-action-button nh3d-menu-action-confirm"
                    onClick={() => {
                      const randomRole = pickRandomStartupRole();
                      const randomGender = pickRandomStartupGender(randomRole);
                      handleStartNewGame({
                        mode: "random",
                        playMode: clientOptions.fpsMode ? "fps" : "normal",
                        runtimeVersion,
                        name: normalizeStartupCharacterName(createName),
                        role: randomRole,
                        gender: randomGender,
                      });
                    }}
                    type="button"
                  >
                    Start game
                  </button>
                  <button
                    className="nh3d-menu-action-button nh3d-menu-action-cancel"
                    onClick={() => setStartupFlowStep("choose")}
                    type="button"
                  >
                    Back
                  </button>
                  <button
                    className="nh3d-menu-action-button"
                    onClick={openClientOptionsDialog}
                    type="button"
                  >
                    NetHack 3D Options
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="nh3d-question-text">Create your character:</div>
                <div className="nh3d-startup-config-grid">
                  <label className="nh3d-startup-config-field">
                    <span>Name</span>
                    <input
                      className="nh3d-startup-config-input"
                      maxLength={30}
                      onChange={(event) => setCreateName(event.target.value)}
                      placeholder="Web_user"
                      type="text"
                      value={createName}
                    />
                  </label>
                  <label className="nh3d-startup-config-field">
                    <span>Role</span>
                    <select
                      className="nh3d-startup-config-select"
                      onChange={(event) => setCreateRole(event.target.value)}
                      value={createRole}
                    >
                      {startupRoleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="nh3d-startup-config-field">
                    <span>Race</span>
                    <select
                      className="nh3d-startup-config-select"
                      onChange={(event) => setCreateRace(event.target.value)}
                      value={createRace}
                    >
                      {startupRaceOptions.map((race) => (
                        <option key={race} value={race}>
                          {race}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="nh3d-startup-config-field">
                    <span>Gender</span>
                    <select
                      className="nh3d-startup-config-select"
                      onChange={(event) => setCreateGender(event.target.value)}
                      value={createGender}
                    >
                      {startupGenderOptions.map((gender) => (
                        <option key={gender} value={gender}>
                          {gender}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="nh3d-startup-config-field">
                    <span>Alignment</span>
                    <select
                      className="nh3d-startup-config-select"
                      onChange={(event) => setCreateAlign(event.target.value)}
                      value={createAlign}
                    >
                      {startupAlignOptions.map((align) => (
                        <option key={align} value={align}>
                          {align}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="nh3d-menu-actions">
                  <button
                    className="nh3d-menu-action-button nh3d-menu-action-confirm"
                    onClick={() =>
                      handleStartNewGame({
                        mode: "create",
                        playMode: clientOptions.fpsMode ? "fps" : "normal",
                        runtimeVersion,
                        name: normalizeStartupCharacterName(createName),
                        role: createRole,
                        race: createRace,
                        gender: createGender,
                        align: createAlign,
                      })
                    }
                    type="button"
                  >
                    Start game
                  </button>
                  <button
                    className="nh3d-menu-action-button nh3d-menu-action-cancel"
                    onClick={() => setStartupFlowStep("choose")}
                    type="button"
                  >
                    Back
                  </button>
                  <button
                    className="nh3d-menu-action-button"
                    onClick={openClientOptionsDialog}
                    type="button"
                  >
                    NetHack 3D Options
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : null}

      <div
        className={`loading${
          loadingVisible && characterCreationConfig !== null ? "" : " is-hidden"
        }`}
        id="loading"
      >
        <div>NetHack 3D</div>
        <div className="loading-subtitle">Starting local runtime...</div>
      </div>

      {!isMobileViewport && isDesktopGameRunning ? (
        <div className="top-left-ui with-stats">
          <div id="game-status">{statusText}</div>
          {clientOptions.liveMessageLog ? (
            <div className="nh3d-overflow-glow-frame">
              <div
                data-nh3d-overflow-glow
                data-nh3d-overflow-glow-host="parent"
                id="game-log"
              >
                {gameMessages.map((message, index) => (
                  <div key={`${index}-${message}`}>{message}</div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : isMobileGameRunning && clientOptions.liveMessageLog ? (
        <div
          className={`nh3d-mobile-log nh3d-overflow-glow-frame${
            isMobileLogVisible ? "" : " nh3d-mobile-log-hidden"
          }`}
          style={
            {
              "--nh3d-mobile-log-top": `${statsBarHeight}px`,
            } as React.CSSProperties
          }
        >
          <div
            className="nh3d-mobile-log-scroll"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
            id="game-log"
          >
            {renderMobileDialogCloseButton(
              () => setIsMobileLogVisible(false),
              "Close message log",
            )}
            {gameMessages.map((message, index) => (
              <div key={`${index}-${message}`}>{message}</div>
            ))}
          </div>
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

      {!startup && (
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
              {playerStats.hunger}
              {playerStats.encumbrance ? ` ${playerStats.encumbrance}` : ""}
            </div>
          </div>
          <div className="nh3d-stats-location">
            <div className="nh3d-stats-dungeon">
              {playerStats.dungeon} {playerStats.dlevel}
              {locationStatusText ? (
                <span className="nh3d-stats-mobile-location-status">
                  {locationStatusText}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {isClientOptionsVisible ? (
        <div
          className={`nh3d-dialog nh3d-dialog-options nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close is-visible`}
          id="nh3d-client-options-dialog"
        >
          {renderMobileDialogCloseButton(
            requestCloseClientOptionsDialog,
            "Close NetHack 3D options",
          )}
          <div className="nh3d-options-title">NetHack 3D Client Options</div>
          <div className="nh3d-options-layout">
            <div className="nh3d-overflow-glow-frame nh3d-options-nav-shell">
              <div
                aria-label="Settings categories"
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
                  {visibleClientOptions.map((option) => {
              if (
                option.type === "boolean" &&
                option.key === "invertLookYAxis" &&
                !clientOptionsDraft.fpsMode
              ) {
                return null;
              }
              if (
                option.type === "boolean" &&
                (option.key === "darkCorridorWallTileOverrideEnabled" ||
                  option.key === "darkCorridorWallSolidColorOverrideEnabled") &&
                !clientOptionsDraft.darkCorridorWalls367
              ) {
                return null;
              }
              if (
                option.type === "select" &&
                option.key === "tilesetPath" &&
                clientOptionsDraft.tilesetMode !== "tiles"
              ) {
                return null;
              }
              if (option.type === "boolean") {
                const enabled = Boolean(clientOptionsDraft[option.key]);
                const isDarkWallTileOverrideOption =
                  option.key === "darkCorridorWallTileOverrideEnabled";
                const isDarkWallSolidColorOverrideOption =
                  option.key === "darkCorridorWallSolidColorOverrideEnabled";
                const isDarkWallOverrideOption =
                  isDarkWallTileOverrideOption ||
                  isDarkWallSolidColorOverrideOption;
                return (
                  <Fragment key={option.key}>
                    <div
                      className={`nh3d-option-row nh3d-option-row-inline-toggle${
                        isDarkWallOverrideOption
                          ? " nh3d-option-row-has-secondary-controls"
                          : ""
                      }${
                        isDarkWallOverrideOption && !enabled
                          ? " nh3d-option-row-mode-inactive"
                          : ""
                      }`}
                    >
                      <div className="nh3d-option-copy">
                        <div className="nh3d-option-label">{option.label}</div>
                        <div className="nh3d-option-description">
                          {option.description}
                        </div>
                      </div>
                      {isDarkWallTileOverrideOption ? (
                        <div className="nh3d-option-toggle-controls nh3d-option-secondary-controls">
                          <button
                            className={`nh3d-option-tile-picker-button${
                              enabled ? "" : " is-disabled"
                            }`}
                            disabled={!enabled}
                            onClick={() => setIsDarkWallTilePickerVisible(true)}
                            type="button"
                          >
                            <span className="nh3d-option-tile-picker-preview">
                              {renderTilePreviewImage(selectedDarkWallTileId)}
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
                                  <span>Normal</span>
                                  <input
                                    aria-label="Dark wall solid color (normal mode)"
                                    className="nh3d-option-solid-color-native-picker"
                                    disabled={!enabled}
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
                                  <span>FPS</span>
                                  <input
                                    aria-label="Dark wall solid color (FPS mode)"
                                    className="nh3d-option-solid-color-native-picker"
                                    disabled={!enabled}
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
                                    disabled={!enabled}
                                    onChange={(event) =>
                                      updateDarkWallSolidColorGridEnabledDraft(
                                        event.target.checked,
                                      )
                                    }
                                    type="checkbox"
                                  />
                                  <span>Grid lines</span>
                                </label>
                                <label className="nh3d-dark-wall-grid-darkness">
                                  <span>Intensity</span>
                                  <span className="nh3d-dark-wall-grid-darkness-input-wrap">
                                    <input
                                      className="nh3d-dark-wall-grid-darkness-input"
                                      disabled={
                                        !enabled ||
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
                        onClick={() => {
                          if (isDarkWallTileOverrideOption) {
                            updateDarkWallTileOverrideEnabledDraft(!enabled);
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
                    {option.key === "fpsMode" && clientOptionsDraft.fpsMode ? (
                      <>
                        <div className="nh3d-option-row nh3d-option-row-slider">
                          <div className="nh3d-option-copy">
                            <div className="nh3d-option-label">
                              FPS Field of View
                            </div>
                            <div className="nh3d-option-description">
                              Adjust first-person camera FOV.
                            </div>
                          </div>
                          <div className="nh3d-option-slider-control">
                            <input
                              aria-label="FPS Field of View"
                              className="nh3d-option-slider"
                              max={110}
                              min={45}
                              onChange={(event) =>
                                updateClientFovDraft(Number(event.target.value))
                              }
                              step={1}
                              type="range"
                              value={clientOptionsDraft.fpsFov}
                            />
                            <div className="nh3d-option-slider-value">
                              {clientOptionsDraft.fpsFov}
                              {"\u00b0"}
                            </div>
                          </div>
                        </div>

                        <div className="nh3d-option-row nh3d-option-row-slider">
                          <div className="nh3d-option-copy">
                            <div className="nh3d-option-label">
                              Look Sensitivity X
                            </div>
                            <div className="nh3d-option-description">
                              Horizontal mouselook/touch-look sensitivity.
                            </div>
                          </div>
                          <div className="nh3d-option-slider-control">
                            <input
                              aria-label="Look Sensitivity X"
                              className="nh3d-option-slider"
                              max={nh3dFpsLookSensitivityMax}
                              min={nh3dFpsLookSensitivityMin}
                              onChange={(event) =>
                                updateClientLookSensitivityDraft(
                                  "fpsLookSensitivityX",
                                  Number(event.target.value),
                                )
                              }
                              step={0.01}
                              type="range"
                              value={clientOptionsDraft.fpsLookSensitivityX}
                            />
                            <div className="nh3d-option-slider-value">
                              {clientOptionsDraft.fpsLookSensitivityX.toFixed(
                                2,
                              )}
                              x
                            </div>
                          </div>
                        </div>

                        <div className="nh3d-option-row nh3d-option-row-slider">
                          <div className="nh3d-option-copy">
                            <div className="nh3d-option-label">
                              Look Sensitivity Y
                            </div>
                            <div className="nh3d-option-description">
                              Vertical mouselook/touch-look sensitivity.
                            </div>
                          </div>
                          <div className="nh3d-option-slider-control">
                            <input
                              aria-label="Look Sensitivity Y"
                              className="nh3d-option-slider"
                              max={nh3dFpsLookSensitivityMax}
                              min={nh3dFpsLookSensitivityMin}
                              onChange={(event) =>
                                updateClientLookSensitivityDraft(
                                  "fpsLookSensitivityY",
                                  Number(event.target.value),
                                )
                              }
                              step={0.01}
                              type="range"
                              value={clientOptionsDraft.fpsLookSensitivityY}
                            />
                            <div className="nh3d-option-slider-value">
                              {clientOptionsDraft.fpsLookSensitivityY.toFixed(
                                2,
                              )}
                              x
                            </div>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </Fragment>
                );
              }
              if (option.type === "select") {
                const isTilesetSelect = option.key === "tilesetPath";
                const selectOptions = isTilesetSelect
                  ? tilesetDropdownOptions
                  : option.options;
                const selectDisabled = isTilesetSelect
                  ? !hasAnyTilesets
                  : Boolean(option.disabled);
                return (
                  <div className="nh3d-option-row" key={option.key}>
                    <div className="nh3d-option-copy">
                      <div className="nh3d-option-label">{option.label}</div>
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
                          Manage Tile Sets
                        </button>
                      ) : null}
                      <select
                        className="nh3d-startup-config-select"
                        disabled={selectDisabled}
                        onChange={(event) => {
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
                          if (option.key === "vrPreferredPointerHand") {
                            updateClientOptionDraft(
                              option.key,
                              event.target.value === "left" ? "left" : "right",
                            );
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
                const sliderLabel =
                  option.key === "gamma"
                    ? `${sliderValue.toFixed(2)}x`
                    : option.key === "uiFontScale" ||
                        option.key === "liveMessageLogFontScale"
                      ? `${Math.round(sliderValue * 100)}%`
                      : option.key === "liveMessageDisplayTimeMs" ||
                          option.key === "liveMessageFadeOutTimeMs"
                        ? `${Math.round(sliderValue)}ms`
                        : `${Math.round(sliderValue * 100)}%`;
                return (
                  <div
                    className="nh3d-option-row nh3d-option-row-slider"
                    key={option.key}
                  >
                    <div className="nh3d-option-copy">
                      <div className="nh3d-option-label">{option.label}</div>
                      <div className="nh3d-option-description">
                        {option.description}
                      </div>
                    </div>
                    <div className="nh3d-option-slider-control">
                      <input
                        aria-label={option.label}
                        className="nh3d-option-slider"
                        max={option.max}
                        min={option.min}
                        onChange={(event) =>
                          updateClientSliderDraft(
                            option.key,
                            Number(event.target.value),
                          )
                        }
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
              return null;
            })}
                  <SoundPackSettings
                    onDialogActionsChange={(actions) => {
                      soundPackDialogActionsRef.current = actions;
                    }}
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
              Confirm
            </button>
            <button
              className="nh3d-menu-action-button nh3d-menu-action-cancel"
              onClick={requestCloseClientOptionsDialog}
              type="button"
            >
              Cancel
            </button>
            <button
              className="nh3d-menu-action-button"
              onClick={openResetClientOptionsConfirmation}
              type="button"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      ) : null}

      {isClientOptionsVisible && isResetClientOptionsConfirmationVisible ? (
        <div
          className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions is-visible"
          id="nh3d-reset-client-options-confirmation-dialog"
        >
          <div className="nh3d-question-text">
            Reset NetHack 3D options to defaults? Custom tile sets will be kept.
          </div>
          <div className="nh3d-menu-actions">
            <button
              className="nh3d-menu-action-button nh3d-menu-action-confirm"
              onClick={confirmResetClientOptionsToDefaults}
              type="button"
            >
              Yes
            </button>
            <button
              className="nh3d-menu-action-button nh3d-menu-action-cancel"
              onClick={cancelResetClientOptionsConfirmation}
              type="button"
            >
              No
            </button>
          </div>
        </div>
      ) : null}

      {isClientOptionsVisible && isTilesetManagerVisible ? (
        <div
          className="nh3d-dialog nh3d-dialog-options nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close is-visible nh3d-dialog-tileset-manager"
          id="nh3d-tileset-manager-dialog"
        >
          {renderMobileDialogCloseButton(
            closeTilesetManager,
            "Close tileset manager",
          )}
          <div className="nh3d-options-title">Manage Tile Sets</div>
          <div className="nh3d-option-description">
            Add tile sets and edit per-tileset background/chroma settings.
          </div>
          <div className="nh3d-overflow-glow-frame">
            <div
              className="nh3d-tileset-manager-upload"
              data-nh3d-overflow-glow
              data-nh3d-overflow-glow-host="parent"
            >
            <div className="nh3d-tileset-manager-header">
              <div className="nh3d-option-label">
                {tilesetManagerInNewMode
                  ? "Create New Tile Set"
                  : selectedTilesetManagerEditEntry
                    ? `Edit Tile Set: ${selectedTilesetManagerEditEntry.label}`
                    : "Edit Tile Set"}
              </div>
            </div>
            <div className="nh3d-tileset-manager-upload-row">
              <label className="nh3d-option-label" htmlFor="nh3d-tileset-name">
                Tile Set Name
              </label>
              <input
                className="nh3d-text-input nh3d-tileset-manager-input"
                id="nh3d-tileset-name"
                onChange={(event) => setTilesetManagerName(event.target.value)}
                placeholder="My Tileset"
                readOnly={tilesetManagerNameInputDisabled}
                type="text"
                value={tilesetManagerName}
              />
              {tilesetManagerNameInputDisabled ? (
                <div className="nh3d-option-description">
                  Built-in tile set names cannot be changed.
                </div>
              ) : null}
            </div>
            {tilesetManagerInNewMode || selectedTilesetManagerEditUserRecord ? (
              <div className="nh3d-tileset-manager-upload-row">
                <label
                  className="nh3d-option-label"
                  htmlFor="nh3d-tileset-upload-file"
                >
                  {tilesetManagerInNewMode
                    ? "Tileset Image"
                    : "Tileset Image (optional replacement)"}
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
                    ? `Selected: ${tilesetManagerFile.name}`
                    : tilesetManagerInNewMode
                      ? "Choose a tileset image file."
                      : `Current: ${selectedTilesetManagerEditUserRecord?.fileName || "uploaded image"}`}
                </div>
              </div>
            ) : null}
            {selectedTilesetManagerEditEntry ? (
              <Fragment>
                <div className="nh3d-option-description">
                  Configure billboard background removal for this tileset.
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
                      Background Tile Removal
                    </div>
                    <div className="nh3d-option-description">
                      Use a selected atlas tile for billboard background
                      removal.
                    </div>
                  </div>
                  <div className="nh3d-option-toggle-controls nh3d-option-secondary-controls">
                    <button
                      className={`nh3d-option-tile-picker-button${
                        tilesetManagerBackgroundRemovalMode === "tile"
                          ? ""
                          : " is-disabled"
                      }`}
                      disabled={tilesetManagerBackgroundRemovalMode !== "tile"}
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
                    onClick={() =>
                      updateTilesetBackgroundRemovalModeDraft(
                        "tile",
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
                      Solid Color Chroma Key
                    </div>
                    <div className="nh3d-option-description">
                      Use a single solid RGB color for billboard background
                      removal.
                    </div>
                  </div>
                  <div className="nh3d-option-toggle-controls nh3d-option-secondary-controls">
                    <button
                      className={`nh3d-option-tile-picker-button${
                        tilesetManagerBackgroundRemovalMode === "solid"
                          ? ""
                          : " is-disabled"
                      }`}
                      disabled={tilesetManagerBackgroundRemovalMode !== "solid"}
                      onClick={() => setIsTilesetSolidColorPickerVisible(true)}
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
                          click to pick from atlas
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
                    onClick={() =>
                      updateTilesetBackgroundRemovalModeDraft(
                        "solid",
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
                Save the new tile set first, then edit background/chroma
                settings.
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
                  ? "Create Tile Set"
                  : selectedTilesetManagerEditUserRecord
                    ? "Save Tile Set"
                    : "Save Tile Settings"}
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
            + Import New Tile Set
          </button>
          <div className="nh3d-overflow-glow-frame">
            <div
              className="nh3d-tileset-manager-list"
              data-nh3d-overflow-glow
              data-nh3d-overflow-glow-host="parent"
            >
            {tilesetManagerListTilesets.length === 0 ? (
              <div className="nh3d-option-description">
                No uploaded tilesets available.
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
                  <div className="nh3d-tileset-manager-item" key={tilesetPath}>
                    <div className="nh3d-tileset-manager-item-copy">
                      <div className="nh3d-option-label">
                        {tileset.label}
                        {isSelected ? " (selected)" : ""}
                        {isEditing ? " (editing)" : ""}
                      </div>
                      <div className="nh3d-option-description">
                        {isUserTileset
                          ? `${userRecord?.fileName || tilesetPath} | uploaded`
                          : `${tilesetPath} | built-in`}
                      </div>
                    </div>
                    <div className="nh3d-tileset-manager-item-actions">
                      <button
                        className="nh3d-menu-action-button"
                        onClick={() => openTilesetManagerEditor(tilesetPath)}
                        type="button"
                      >
                        Edit
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
          <div className="nh3d-menu-actions">
            <button
              className="nh3d-menu-action-button"
              onClick={closeTilesetManager}
              type="button"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      <TilesetTilePickerDialog
        closeLabel="Close dark wall tile picker"
        defaultTileId={defaultDarkWallTileId}
        dialogId="nh3d-dark-wall-tile-picker-dialog"
        entries={tilePickerEntries}
        onDone={() => setIsDarkWallTilePickerVisible(false)}
        onResetToDefault={() =>
          updateDarkWallTileOverrideTileIdDraft(defaultDarkWallTileId)
        }
        onSelectTile={updateDarkWallTileOverrideTileIdDraft}
        renderMobileCloseButton={renderMobileDialogCloseButton}
        renderTilePreviewImage={renderTilePreviewImage}
        selectedGlyphLabel={selectedDarkWallGlyphLabel}
        selectedGlyphNumber={selectedDarkWallGlyphNumber}
        selectedTileId={selectedDarkWallTileId}
        showGlyphNumber={showTilePickerGlyphNumber}
        statusText={tilePickerStatusText}
        tileAtlasLoaded={tileAtlasState.loaded}
        title="Dark Wall Tile Picker"
        visible={isClientOptionsVisible && isDarkWallTilePickerVisible}
      />

      <TilesetTilePickerDialog
        closeLabel="Close tileset background tile picker"
        defaultTileId={tilesetManagerDefaultBackgroundTileId}
        dialogId="nh3d-tileset-background-tile-picker-dialog"
        entries={tilesetManagerTilePickerEntries}
        helperText="Used for removing shared tileset background from monster/loot billboards."
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
            ? `Tileset Background Tile Picker: ${selectedTilesetManagerEditEntry.label}`
            : "Tileset Background Tile Picker"
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
        closeLabel="Close solid chroma key color picker"
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
            ? `Solid Color Chroma Key Picker: ${selectedTilesetManagerEditEntry.label}`
            : "Solid Color Chroma Key Picker"
        }
        visible={
          isClientOptionsVisible &&
          isTilesetManagerVisible &&
          Boolean(selectedTilesetManagerEditPath) &&
          isTilesetSolidColorPickerVisible
        }
      />

      {textInputRequest ? (
        <div
          className="nh3d-dialog nh3d-dialog-text nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close is-visible"
          id="text-input-dialog"
        >
          {renderMobileDialogCloseButton(
            () => submitTextInput(""),
            "Cancel text input",
          )}
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
            placeholder={textInputRequest.placeholder ?? "Enter text"}
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
              OK
            </button>
            <button
              className="nh3d-menu-action-button nh3d-menu-action-cancel"
              onClick={() => submitTextInput("")}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {question ? (
        <div
          className={`nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close is-visible${
            question.menuItems.length === 0 && isYesNoQuestionChoices
              ? " nh3d-dialog-question-yes-no"
              : ""
          }`}
          id="question-dialog"
        >
          {renderMobileDialogCloseButton(
            () => controller?.cancelActivePrompt(),
            "Cancel prompt",
          )}
          <div className="nh3d-question-text">{question.text}</div>
          {question.menuItems.length > 0 ? (
            question.isPickupDialog ? (
              <>
                {question.menuItems.map((item, index) =>
                  item.isCategory ||
                  !item.accelerator ||
                  !String(item.accelerator).trim() ? (
                    <div className="nh3d-menu-category" key={`cat-${index}`}>
                      {item.text}
                    </div>
                  ) : (
                    <div
                      className={`nh3d-pickup-item${
                        question.selectedAccelerators.includes(
                          String(item.accelerator),
                        )
                          ? " nh3d-pickup-item-selected"
                          : ""
                      }${
                        question.activeMenuSelectionInput ===
                        getMenuSelectionInput(item)
                          ? " nh3d-pickup-item-active"
                          : ""
                      }`}
                      key={`pickup-${item.accelerator}-${index}`}
                      onClick={() =>
                        controller?.togglePickupChoice(
                          getMenuSelectionInput(item),
                        )
                      }
                    >
                      <input
                        checked={question.selectedAccelerators.includes(
                          String(item.accelerator),
                        )}
                        className="nh3d-pickup-checkbox"
                        onClick={(event) => event.stopPropagation()}
                        onChange={() =>
                          controller?.togglePickupChoice(
                            getMenuSelectionInput(item),
                          )
                        }
                        type="checkbox"
                      />
                      <span className="nh3d-pickup-key">
                        {item.accelerator})
                      </span>
                      <span className="nh3d-pickup-text">{item.text}</span>
                    </div>
                  ),
                )}
                {showPickupActionButtons ? (
                  <div className="nh3d-pickup-actions">
                    <button
                      className={`nh3d-pickup-action-button nh3d-pickup-action-confirm${
                        question.activeActionButton === "confirm"
                          ? " nh3d-action-button-active"
                          : ""
                      }`}
                      onClick={() => controller?.confirmPickupChoices()}
                      type="button"
                    >
                      Confirm
                    </button>
                    <button
                      className={`nh3d-pickup-action-button nh3d-pickup-action-cancel${
                        question.activeActionButton === "cancel"
                          ? " nh3d-action-button-active"
                          : ""
                      }`}
                      onClick={() => controller?.cancelActivePrompt()}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {question.menuItems.map((item, index) =>
                  item.isCategory ||
                  !item.accelerator ||
                  !String(item.accelerator).trim() ? (
                    <div className="nh3d-menu-category" key={`cat-${index}`}>
                      {item.text}
                    </div>
                  ) : (
                    <button
                      className={`nh3d-menu-button${
                        question.activeMenuSelectionInput ===
                        getMenuSelectionInput(item)
                          ? " nh3d-menu-button-active"
                          : ""
                      }`}
                      key={`menu-${item.accelerator}-${index}`}
                      onClick={() =>
                        controller?.chooseQuestionChoice(
                          getMenuSelectionInput(item),
                        )
                      }
                      type="button"
                    >
                      <span className="nh3d-menu-button-key">
                        {item.accelerator}){" "}
                      </span>
                      <span>{item.text}</span>
                    </button>
                  ),
                )}
                {questionSelectableMenuItemCount > 1 ? (
                  <div className="nh3d-menu-actions">
                    <button
                      className={`nh3d-menu-action-button nh3d-menu-action-cancel${
                        question.activeActionButton === "cancel"
                          ? " nh3d-action-button-active"
                          : ""
                      }`}
                      onClick={() => controller?.cancelActivePrompt()}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </>
            )
          ) : (
            <div className="nh3d-overflow-glow-frame">
              <div
                className={`nh3d-choice-list${
                  parsedQuestionChoices.length > 0 &&
                  parsedQuestionChoices.every(
                    (choice) => choice.trim().length === 1,
                  )
                    ? " is-compact"
                    : ""
                }${isYesNoQuestionChoices ? " is-yes-no" : ""}`}
                data-nh3d-overflow-glow
                data-nh3d-overflow-glow-host="parent"
              >
                {parsedQuestionChoices.map((choice) => (
                  <button
                    className={`nh3d-choice-button${
                      choice === question.defaultChoice
                        ? " nh3d-choice-button-default"
                        : ""
                    }`}
                    key={choice}
                    onClick={() => controller?.chooseQuestionChoice(choice)}
                    type="button"
                  >
                    {getQuestionChoiceLabel(
                      question.text,
                      choice,
                      inventory.items,
                      useInventoryChoiceLabels,
                    )}
                  </button>
                ))}
              </div>
            </div>
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
                Page {questionMenuPageIndex + 1} / {questionMenuPageCount}
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
              ? "Use < and > to change pages. Press ESC to cancel"
              : "Press ESC to cancel"}
          </div>
        </div>
      ) : null}

      {newGamePrompt.visible && !infoMenu && !question ? (
        <div
          className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-dialog-new-game is-visible"
          id="new-game-dialog"
        >
          {renderMobileDialogCloseButton(
            () => setNewGamePrompt({ visible: false, reason: null }),
            "Close new game prompt",
          )}
          <div className="nh3d-question-text">Start a new game?</div>
          <div className="nh3d-menu-actions">
            <button
              className="nh3d-menu-action-button nh3d-menu-action-confirm"
              onClick={startNewGameFromPrompt}
              type="button"
            >
              Yes
            </button>
            <button
              className="nh3d-menu-action-button nh3d-menu-action-cancel"
              onClick={dismissNewGamePromptUntilInteraction}
              type="button"
            >
              No
            </button>
          </div>
        </div>
      ) : null}

      {directionQuestion ? (
        isFpsPlayMode ? (
          <div
            className="nh3d-dialog nh3d-dialog-direction nh3d-dialog-direction-fps nh3d-dialog-has-mobile-close is-visible"
            id="direction-dialog"
          >
            {renderMobileDialogCloseButton(
              () => controller?.cancelActivePrompt(),
              "Cancel direction prompt",
            )}
            <div className="nh3d-direction-text">{directionQuestion}</div>
            <div className="nh3d-direction-fps-hint">
              Look to aim. Left-click or W confirms. S targets self. A/D or
              right-click cancels.
            </div>
          </div>
        ) : (
          <div
            className="nh3d-dialog nh3d-dialog-direction nh3d-dialog-has-mobile-close is-visible"
            id="direction-dialog"
          >
            {renderMobileDialogCloseButton(
              () => controller?.cancelActivePrompt(),
              "Cancel direction prompt",
            )}
            <div className="nh3d-direction-text">{directionQuestion}</div>
            <div className="nh3d-direction-grid">
              {getDirectionChoices(numberPadModeEnabled).map(
                (direction, index) => {
                  if (direction.spacer || !direction.key || !direction.label) {
                    return (
                      <div
                        aria-hidden="true"
                        className="nh3d-direction-spacer"
                        key={`spacer-${index}`}
                      />
                    );
                  }

                  return (
                    <button
                      className="nh3d-direction-button"
                      key={direction.key}
                      onClick={() =>
                        controller?.chooseDirection(direction.key!)
                      }
                      type="button"
                    >
                      <div className="nh3d-direction-symbol">
                        {direction.label}
                      </div>
                      <div className="nh3d-direction-key">{direction.key}</div>
                    </button>
                  );
                },
              )}
            </div>
            <div className="nh3d-direction-extra-row">
              {directionAuxChoices.map((direction) => (
                <button
                  className="nh3d-direction-button nh3d-direction-button-extra"
                  key={direction.key}
                  onClick={() => controller?.chooseDirection(direction.key)}
                  type="button"
                >
                  <div className="nh3d-direction-symbol">{direction.label}</div>
                  <div className="nh3d-direction-key">{direction.key}</div>
                </button>
              ))}
            </div>
            <div className="nh3d-dialog-hint">
              {getDirectionHelpText(numberPadModeEnabled)}
            </div>
            <div className="nh3d-menu-actions">
              <button
                className="nh3d-menu-action-button nh3d-menu-action-cancel"
                onClick={() => controller?.cancelActivePrompt()}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        )
      ) : null}

      {infoMenu ? (
        <div
          className="nh3d-dialog nh3d-dialog-info nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close is-visible nh3d-overflow-glow-frame"
          id="info-menu-dialog"
        >
          {renderMobileDialogCloseButton(
            () => controller?.closeInfoMenuDialog(),
            "Close information window",
          )}
          <div
            className="nh3d-dialog-info-scroll"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
          >
            <div className="nh3d-info-title">
              {infoMenu.title || "NetHack Information"}
            </div>
            <div className="nh3d-info-body">
              {infoMenu.lines.length > 0
                ? infoMenu.lines.join("\n")
                : "(No details)"}
            </div>
            <div className="nh3d-info-hint">
              Press SPACE, ENTER, or ESC to close. Press Ctrl+M to reopen.
            </div>
          </div>
          <div className="nh3d-menu-actions">
            <button
              className="nh3d-menu-action-button nh3d-menu-action-cancel"
              onClick={() => controller?.closeInfoMenuDialog()}
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {inventory.visible ? (
        <div
          className="nh3d-dialog nh3d-dialog-inventory nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close is-visible"
          id="inventory-dialog"
        >
          {renderMobileDialogCloseButton(
            () => controller?.closeInventoryDialog(),
            "Close inventory",
          )}
          <div className="nh3d-inventory-title">INVENTORY</div>
          <div className="nh3d-overflow-glow-frame nh3d-overflow-glow-shell-fill">
            <div
              className="nh3d-inventory-items"
              data-nh3d-overflow-glow
              data-nh3d-overflow-glow-host="parent"
            >
              {inventory.items.length === 0 ? (
                <div className="nh3d-inventory-empty">
                  Your inventory is empty.
                </div>
              ) : (
                inventory.items.map((item, index) =>
                  item.isCategory ? (
                    <div
                      className={`nh3d-inventory-category${
                        index === 0 ? " nh3d-inventory-category-first" : ""
                      }`}
                      key={`cat-${index}`}
                    >
                      {item.text}
                    </div>
                  ) : (
                    <div
                      className={`nh3d-inventory-item${
                        !inventoryContextActionsEnabled
                          ? " nh3d-inventory-item-disabled"
                          : ""
                      }${
                        inventoryContextMenu?.accelerator === item.accelerator
                          ? " nh3d-inventory-item-active"
                          : ""
                      }`}
                      key={`item-${index}`}
                      onClick={(event) => {
                        if (!inventoryContextActionsEnabled) {
                          return;
                        }
                        openInventoryContextMenu(
                          item,
                          event.clientX,
                          event.clientY,
                        );
                      }}
                      onContextMenu={(event) => {
                        if (!inventoryContextActionsEnabled) {
                          return;
                        }
                        event.preventDefault();
                        openInventoryContextMenu(
                          item,
                          event.clientX,
                          event.clientY,
                        );
                      }}
                      onKeyDown={(event) => {
                        if (!inventoryContextActionsEnabled) {
                          return;
                        }
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          const target =
                            event.currentTarget.getBoundingClientRect();
                          openInventoryContextMenu(
                            item,
                            target.right,
                            target.top + target.height / 2,
                          );
                        }
                      }}
                      role={
                        inventoryContextActionsEnabled ? "button" : undefined
                      }
                      tabIndex={inventoryContextActionsEnabled ? 0 : -1}
                    >
                      <span className="nh3d-inventory-key">
                        {item.accelerator || "?"})
                      </span>
                      <span className={item.className as string}>
                        {item.text || "Unknown item"}
                      </span>
                    </div>
                  ),
                )
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
              Close
            </button>
          </div>
        </div>
      ) : null}

      {inventoryContextMenu && inventoryContextActionsEnabled ? (
        <div
          className="nh3d-context-menu nh3d-inventory-context-menu nh3d-overflow-glow-frame"
          onContextMenu={(event) => event.preventDefault()}
          ref={inventoryContextMenuRef}
          style={{
            left: `${inventoryContextMenu.x}px`,
            top: `${inventoryContextMenu.y}px`,
          }}
        >
          <div
            className="nh3d-inventory-context-menu-scroll"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
          >
            <div
              className={`nh3d-context-menu-title${
                shouldScrollInventoryContextTitle
                  ? " nh3d-context-menu-title-scroll"
                  : ""
              }`}
              style={inventoryContextTitleStyle}
            >
              {shouldScrollInventoryContextTitle ? (
                <span className="nh3d-context-menu-title-scroll-track">
                  <span>{inventoryContextTitle}</span>
                  <span aria-hidden="true">{inventoryContextTitle}</span>
                </span>
              ) : (
                inventoryContextTitle
              )}
            </div>
            <div className="nh3d-context-menu-actions nh3d-context-menu-actions-inventory">
              {inventoryContextMenuActions.map((action) => (
                <button
                  className="nh3d-context-menu-button"
                  key={`inventory-${inventoryContextMenu.accelerator}-${action.id}`}
                  onClick={() => {
                    if (action.kind === "extended" && action.value) {
                      // Use the special prefix to ensure the runtime intercepts it and reliably
                      // applies it to the next inventory prompt menu without race conditions
                      controller?.sendInput(
                        `__INVCTX_SELECT__:${inventoryContextMenu.accelerator}`,
                      );
                      controller?.runExtendedCommand(action.value);
                    } else {
                      controller?.runInventoryItemAction(
                        action.id,
                        inventoryContextMenu.accelerator,
                      );
                    }
                    setInventoryContextMenu(null);
                  }}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {isFpsPlayMode &&
      characterCreationConfig !== null &&
      connectionState === "running" &&
      !loadingVisible ? (
        <div aria-hidden="true" className="nh3d-fps-crosshair">
          <div className="nh3d-fps-crosshair-dot" />
        </div>
      ) : null}

      {fpsCrosshairContext ? (
        <div
          className={`nh3d-context-menu ${
            isFpsPlayMode &&
            fpsCrosshairContext.autoDirectionFromFpsAim !== false &&
            tileContextMenuPosition === null
              ? "nh3d-fps-crosshair-context"
              : "nh3d-tile-context-menu"
          }`}
          ref={fpsCrosshairContextMenuRef}
          style={
            tileContextMenuPosition
              ? {
                  left: `${tileContextMenuPosition.x}px`,
                  top: `${tileContextMenuPosition.y}px`,
                }
              : undefined
          }
        >
          <div
            className={`nh3d-context-menu-title${
              shouldScrollFpsContextTitle
                ? " nh3d-context-menu-title-scroll"
                : ""
            }`}
            style={fpsContextTitleStyle}
          >
            {shouldScrollFpsContextTitle ? (
              <span className="nh3d-context-menu-title-scroll-track">
                <span>{fpsContextTitle}</span>
                <span aria-hidden="true">{fpsContextTitle}</span>
              </span>
            ) : (
              fpsContextTitle
            )}
          </div>
          <div className="nh3d-context-menu-actions">
            {fpsCrosshairContext.actions.map((action) => (
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
        </div>
      ) : null}

      {shouldRenderDomMobileTouchHud && isMobileActionSheetVisible ? (
        <div className="nh3d-mobile-actions-sheet">
          <div className="nh3d-mobile-actions-title-row">
            <div className="nh3d-mobile-actions-title">
              {mobileActionSheetMode === "quick"
                ? "Actions"
                : "Extended Commands"}
            </div>
            <div className="nh3d-mobile-actions-controls">
              {mobileActionSheetMode === "extended" ? (
                <button
                  className="nh3d-mobile-actions-back"
                  onClick={() => setMobileActionSheetMode("quick")}
                  type="button"
                >
                  Back
                </button>
              ) : null}

              <div className="nh3d-mobile-actions-divider" />

              <button
                className="nh3d-mobile-actions-back"
                onClick={handleMobileOpenPauseMenu}
                type="button"
              >
                Menu
              </button>

              <button
                className="nh3d-mobile-actions-close"
                onClick={handleMobileCloseActionSheet}
                type="button"
              >
                Close
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
                    onClick={() => handleMobileSelectAction(action)}
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
                      Common commands
                    </div>
                    <div
                      className="nh3d-mobile-actions-grid is-extended"
                    >
                      {mobileCommonExtendedCommandNames.map((command) => (
                        <button
                          className="nh3d-mobile-actions-button"
                          key={`common-${command}`}
                          onClick={() =>
                            handleMobileRunExtendedCommand(command)
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
                    All commands
                  </div>
                  <div
                    className="nh3d-mobile-actions-grid is-extended"
                  >
                    {mobileExtendedCommandNames.map((command) => (
                      <button
                        className="nh3d-mobile-actions-button"
                        key={`all-${command}`}
                        onClick={() =>
                          handleMobileRunExtendedCommand(command)
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
          )}
        </div>
      ) : null}

      {shouldRenderDomMobileTouchHud && repeatActionVisible ? (
        <button
          className="nh3d-mobile-repeat-button"
          onClick={handleMobileRepeatAction}
          type="button"
        >
          Repeat
        </button>
      ) : null}

      {shouldRenderDomMobileTouchHud ? (
        <div
          className={`nh3d-mobile-bottom-bar${showVrTouchControls ? " is-vr-touch" : ""}`}
        >
          <button
            className="nh3d-mobile-bottom-button"
            onClick={handleMobileOpenInventory}
            type="button"
          >
            Inventory
          </button>
          <button
            className="nh3d-mobile-bottom-button"
            disabled={!clientOptions.liveMessageLog}
            onClick={handleMobileToggleLog}
            type="button"
          >
            Log
          </button>
          <button
            className="nh3d-mobile-bottom-button"
            onClick={handleMobilePickup}
            type="button"
          >
            Pick Up
          </button>
          <button
            className="nh3d-mobile-bottom-button"
            onClick={handleMobileSearch}
            type="button"
          >
            Search
          </button>
          <button
            className={`nh3d-mobile-bottom-button${
              isMobileActionSheetVisible ? " is-active" : ""
            }`}
            onClick={handleMobileToggleActionSheet}
            type="button"
          >
            Actions
          </button>
        </div>
      ) : null}

      <div
        className={`${positionRequest ? "is-visible" : ""} nh3d-overflow-glow-frame`.trim()}
        id="position-dialog"
      >
        <div
          className="nh3d-position-dialog-scroll"
          data-nh3d-overflow-glow
          data-nh3d-overflow-glow-host="parent"
        >
          {isMobileGameRunning && positionRequest ? (
            <button
              aria-label="Close position prompt"
              className="nh3d-position-dialog-close"
              onClick={() => {
                controller?.cancelActivePrompt();
                setPositionRequest(null);
              }}
              type="button"
            >
              {"\u00D7"}
            </button>
          ) : null}
          {positionRequest}
        </div>
      </div>
      </div>
    </>
  );
}
