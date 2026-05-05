import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearPersistedTilesetBatchPickerImages,
  clearPersistedTilesetBatchPickerSession,
  deletePersistedTilesetBatchPickerImage,
  loadPersistedTilesetBatchPickerImages,
  loadPersistedTilesetBatchPickerSession,
  savePersistedTilesetBatchPickerImage,
  savePersistedTilesetBatchPickerSession,
  type PersistedTilesetBatchPickerBackgroundRemovalSettings,
  type PersistedTilesetBatchPickerCropInsets,
  type PersistedTilesetBatchPickerImageMeta,
  type PersistedTilesetBatchPickerOffset,
  type PersistedTilesetBatchPickerRemovalSeed,
} from "../storage/tileset-batch-picker-storage";
import "../styles/tileset-batch-picker.scss";

const defaultCompileMapUrl = `${
  import.meta.env.BASE_URL
}assets/tools/nethack-5-ai-tileset-compile-map.json`;
const previewTileSize = 16;
const previewZoomModes = ["fit", "step-1", "step-2", "step-3", "full"] as const;
const maxSelectionOffset = 1;
const minCropSpan = 0.1;
const dragThresholdPx = 3;
const defaultBackgroundRemovalTolerance = 57;
const defaultBackgroundRemovalEdgeSoftness = 100;
const defaultBackgroundRemovalMatteFalloff = 100;
const defaultBackgroundRemovalUnmixStrength = 100;
const defaultBackgroundRemovalScreenColorMode = "auto";
const defaultBackgroundRemovalEdgeSpillRange = 4;
const defaultBackgroundRemovalEdgeSpillStrength = 66;
const defaultBackgroundRemovalSpillLimitMode = "average";
const defaultBackgroundRemovalEdgeDesaturation = 100;
const pixelZoomRadius = 5;
const pixelZoomScale = 10;
const pixelZoomGridSize = pixelZoomRadius * 2 + 1;
const pixelZoomPanelOffset = 18;
const pixelZoomPanelWidth = pixelZoomGridSize * pixelZoomScale + 18;
const pixelZoomPanelHeight = pixelZoomGridSize * pixelZoomScale + 54;

type PreviewZoomMode = (typeof previewZoomModes)[number];
type BackgroundRemovalScreenColorMode =
  PersistedTilesetBatchPickerBackgroundRemovalSettings["screenColorMode"];
type BackgroundRemovalSpillLimitMode =
  PersistedTilesetBatchPickerBackgroundRemovalSettings["spillLimitMode"];

type PromptSheetsMeta = {
  columns: number;
  rows: number;
  tileSize: number;
  sheetCount: number;
};

type FinalAtlasMeta = {
  columns: number;
  rows: number;
  tileSize: number;
  usedSlotCount: number;
  tileCount: number;
};

type GeneratedTilePlacement = {
  generatedIndex: number;
  subject: string;
  sheetIndex: number;
  sheetTileIndex: number;
  sheetColumn: number;
  sheetRow: number;
};

type FinalSlotPlacement = {
  slotIndex: number;
  operation: "copy" | "stone-statue" | string;
  generatedIndex: number;
  generatedSubject: string;
  finalColumn: number;
  finalRow: number;
};

type CompileMap = {
  versionLabel: string;
  generatedTileCount: number;
  promptSheets: PromptSheetsMeta;
  finalAtlas: FinalAtlasMeta;
  generatedTiles: GeneratedTilePlacement[];
  finalSlots: FinalSlotPlacement[];
};

type UploadedBatchImage = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  width: number;
  height: number;
  image: HTMLImageElement | null;
  processedCanvas: HTMLCanvasElement | null;
  backgroundRemovalSignature: string;
  isReady: boolean;
  createdAt: number;
  updatedAt: number;
};

type BatchImagesByIndex = Record<number, UploadedBatchImage[]>;
type SelectedImageByGeneratedIndex = Record<number, string>;
type SelectedOffsetByGeneratedIndex = Record<number, PersistedTilesetBatchPickerOffset>;
type SelectedCropInsetsByGeneratedIndex = Record<
  number,
  PersistedTilesetBatchPickerCropInsets
>;
type EditorMode = "arrange" | "background-remove";
type BackgroundRemovalByImageId = Record<
  string,
  PersistedTilesetBatchPickerBackgroundRemovalSettings
>;
type ActiveAdjustmentDrag = {
  generatedIndex: number;
  imageId: string;
  mode: "offset" | "left" | "right" | "top" | "bottom";
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  startCropLeft: number;
  startCropRight: number;
  startCropTop: number;
  startCropBottom: number;
  cellWidth: number;
  cellHeight: number;
  sourceTileWidth: number;
  sourceTileHeight: number;
  moved: boolean;
};

type SampledPixel = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
};

type SheetPreviewProps = {
  uploadedImage: UploadedBatchImage;
  pixelPerfect?: boolean;
};

type ActivePixelZoom = {
  imageId: string;
  frameX: number;
  frameY: number;
  frameWidth: number;
  frameHeight: number;
  pixel: SampledPixel;
};

function isCompileMap(value: unknown): value is CompileMap {
  const candidate = value as Partial<CompileMap>;
  return (
    !!candidate &&
    typeof candidate === "object" &&
    Number.isInteger(candidate.generatedTileCount) &&
    Number.isInteger(candidate.promptSheets?.columns) &&
    Number.isInteger(candidate.promptSheets?.rows) &&
    Number.isInteger(candidate.promptSheets?.sheetCount) &&
    Number.isInteger(candidate.finalAtlas?.columns) &&
    Number.isInteger(candidate.finalAtlas?.rows) &&
    Array.isArray(candidate.generatedTiles) &&
    Array.isArray(candidate.finalSlots)
  );
}

function formatBatchLabel(sheetIndex: number): string {
  return `Batch ${String(sheetIndex + 1).padStart(2, "0")}`;
}

function getBatchTileCount(compileMap: CompileMap): number {
  return compileMap.promptSheets.columns * compileMap.promptSheets.rows;
}

function getBatchPlan(
  compileMap: CompileMap,
  sheetIndex: number,
): {
  count: number;
  firstGeneratedIndex: number;
  lastGeneratedIndex: number;
  firstSubject: string;
  lastSubject: string;
} {
  const batchTileCount = getBatchTileCount(compileMap);
  const firstGeneratedIndex = sheetIndex * batchTileCount;
  const endExclusive = Math.min(
    firstGeneratedIndex + batchTileCount,
    compileMap.generatedTileCount,
  );
  const lastGeneratedIndex = Math.max(firstGeneratedIndex, endExclusive - 1);

  return {
    count: Math.max(0, endExclusive - firstGeneratedIndex),
    firstGeneratedIndex,
    lastGeneratedIndex,
    firstSubject: compileMap.generatedTiles[firstGeneratedIndex]?.subject ?? "",
    lastSubject: compileMap.generatedTiles[lastGeneratedIndex]?.subject ?? "",
  };
}

function formatBatchTileRange(compileMap: CompileMap, sheetIndex: number): string {
  const plan = getBatchPlan(compileMap, sheetIndex);
  if (plan.count <= 0) {
    return "No generated tiles";
  }
  if (plan.firstGeneratedIndex === plan.lastGeneratedIndex) {
    return `Generated tile ${plan.firstGeneratedIndex + 1}`;
  }
  return `Generated tiles ${plan.firstGeneratedIndex + 1}-${plan.lastGeneratedIndex + 1}`;
}

function preventDropDefaults(event: React.DragEvent<HTMLElement>): void {
  event.preventDefault();
  event.stopPropagation();
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function getGeneratedIndexForCell(
  compileMap: CompileMap,
  sheetIndex: number,
  tileIndex: number,
): number {
  return (
    sheetIndex * compileMap.promptSheets.columns * compileMap.promptSheets.rows +
    tileIndex
  );
}

function createImageId(sheetIndex: number, file: File): string {
  return `${sheetIndex}-${file.name}-${file.lastModified}-${crypto.randomUUID()}`;
}

function toPersistedBatchImages(
  batchImages: BatchImagesByIndex,
): Record<string, PersistedTilesetBatchPickerImageMeta[]> {
  const persisted: Record<string, PersistedTilesetBatchPickerImageMeta[]> = {};
  for (const [batchIndex, images] of Object.entries(batchImages)) {
    persisted[batchIndex] = images.map((image) => ({
      id: image.id,
      batchIndex: Number(batchIndex),
      name: image.name,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    }));
  }
  return persisted;
}

function clampSelectionOffset(value: number): number {
  return Math.max(-maxSelectionOffset, Math.min(maxSelectionOffset, value));
}

function toPersistedSelectedOffsets(
  selectedOffsets: SelectedOffsetByGeneratedIndex,
): Record<string, PersistedTilesetBatchPickerOffset> {
  const persisted: Record<string, PersistedTilesetBatchPickerOffset> = {};
  for (const [generatedIndex, offset] of Object.entries(selectedOffsets)) {
    const x = clampSelectionOffset(offset.x);
    const y = clampSelectionOffset(offset.y);
    if (x === 0 && y === 0) {
      continue;
    }
    persisted[generatedIndex] = { x, y };
  }
  return persisted;
}

function getDefaultCropInsets(): PersistedTilesetBatchPickerCropInsets {
  return {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  };
}

function normalizeBackgroundRemovalScreenColorMode(
  value: unknown,
): BackgroundRemovalScreenColorMode {
  if (
    value === "auto" ||
    value === "red" ||
    value === "green" ||
    value === "blue"
  ) {
    return value;
  }
  return defaultBackgroundRemovalScreenColorMode;
}

function normalizeBackgroundRemovalSpillLimitMode(
  value: unknown,
): BackgroundRemovalSpillLimitMode {
  return value === "max" ? "max" : defaultBackgroundRemovalSpillLimitMode;
}

function clampCropInset(
  value: number,
  opposingInset: number,
): number {
  return Math.max(-1, Math.min(1 - minCropSpan - opposingInset, value));
}

function toPersistedSelectedCropInsets(
  selectedCropInsets: SelectedCropInsetsByGeneratedIndex,
): Record<string, PersistedTilesetBatchPickerCropInsets> {
  const persisted: Record<string, PersistedTilesetBatchPickerCropInsets> = {};
  for (const [generatedIndex, crop] of Object.entries(selectedCropInsets)) {
    const left = clampCropInset(crop.left, crop.right);
    const right = clampCropInset(crop.right, left);
    const top = clampCropInset(crop.top, crop.bottom);
    const bottom = clampCropInset(crop.bottom, top);
    if (left === 0 && right === 0 && top === 0 && bottom === 0) {
      continue;
    }
    persisted[generatedIndex] = { left, right, top, bottom };
  }
  return persisted;
}

function getDefaultBackgroundRemovalSettings(): PersistedTilesetBatchPickerBackgroundRemovalSettings {
  return {
    tolerance: defaultBackgroundRemovalTolerance,
    edgeSoftness: defaultBackgroundRemovalEdgeSoftness,
    matteFalloff: defaultBackgroundRemovalMatteFalloff,
    unmixStrength: defaultBackgroundRemovalUnmixStrength,
    screenColorMode: defaultBackgroundRemovalScreenColorMode,
    edgeSpillRange: defaultBackgroundRemovalEdgeSpillRange,
    edgeSpillStrength: defaultBackgroundRemovalEdgeSpillStrength,
    spillLimitMode: defaultBackgroundRemovalSpillLimitMode,
    edgeDesaturation: defaultBackgroundRemovalEdgeDesaturation,
    nonContiguous: false,
    seeds: [],
  };
}

function toPersistedBackgroundRemovalByImageId(
  backgroundRemovalByImageId: BackgroundRemovalByImageId,
): Record<string, PersistedTilesetBatchPickerBackgroundRemovalSettings> {
  const persisted: Record<
    string,
    PersistedTilesetBatchPickerBackgroundRemovalSettings
  > = {};
  for (const [imageId, settings] of Object.entries(backgroundRemovalByImageId)) {
    const normalizedImageId = String(imageId).trim();
    if (!normalizedImageId) {
      continue;
    }
    persisted[normalizedImageId] = {
      tolerance: Math.max(0, Math.min(255, Math.round(settings.tolerance))),
      edgeSoftness: Math.max(0, Math.min(100, Math.round(settings.edgeSoftness))),
      matteFalloff: Math.max(
        0,
        Math.min(100, Math.round(settings.matteFalloff)),
      ),
      unmixStrength: Math.max(
        0,
        Math.min(100, Math.round(settings.unmixStrength)),
      ),
      screenColorMode: normalizeBackgroundRemovalScreenColorMode(
        settings.screenColorMode,
      ),
      edgeSpillRange: Math.max(
        0,
        Math.min(64, Math.round(settings.edgeSpillRange)),
      ),
      edgeSpillStrength: Math.max(
        0,
        Math.min(100, Math.round(settings.edgeSpillStrength)),
      ),
      spillLimitMode: normalizeBackgroundRemovalSpillLimitMode(
        settings.spillLimitMode,
      ),
      edgeDesaturation: Math.max(
        0,
        Math.min(100, Math.round(settings.edgeDesaturation)),
      ),
      nonContiguous: settings.nonContiguous === true,
      seeds: settings.seeds.map((seed) => ({
        x: Math.max(0, Math.round(seed.x)),
        y: Math.max(0, Math.round(seed.y)),
        r: Math.max(0, Math.min(255, Math.round(seed.r))),
        g: Math.max(0, Math.min(255, Math.round(seed.g))),
        b: Math.max(0, Math.min(255, Math.round(seed.b))),
        a: Math.max(0, Math.min(255, Math.round(seed.a))),
        nonContiguous: seed.nonContiguous === true,
      })),
    };
  }
  return persisted;
}

function getBackgroundRemovalSignature(
  settings: PersistedTilesetBatchPickerBackgroundRemovalSettings,
): string {
  if (settings.seeds.length <= 0) {
    return "";
  }
  return JSON.stringify({
    tolerance: Math.max(0, Math.min(255, Math.round(settings.tolerance))),
    edgeSoftness: Math.max(0, Math.min(100, Math.round(settings.edgeSoftness))),
    matteFalloff: Math.max(
      0,
      Math.min(100, Math.round(settings.matteFalloff)),
    ),
    unmixStrength: Math.max(
      0,
      Math.min(100, Math.round(settings.unmixStrength)),
    ),
    screenColorMode: normalizeBackgroundRemovalScreenColorMode(
      settings.screenColorMode,
    ),
    edgeSpillRange: Math.max(
      0,
      Math.min(64, Math.round(settings.edgeSpillRange)),
    ),
    edgeSpillStrength: Math.max(
      0,
      Math.min(100, Math.round(settings.edgeSpillStrength)),
    ),
    spillLimitMode: normalizeBackgroundRemovalSpillLimitMode(
      settings.spillLimitMode,
    ),
    edgeDesaturation: Math.max(
      0,
      Math.min(100, Math.round(settings.edgeDesaturation)),
    ),
    nonContiguous: settings.nonContiguous === true,
    seeds: settings.seeds.map((seed) => ({
      x: Math.max(0, Math.round(seed.x)),
      y: Math.max(0, Math.round(seed.y)),
      r: Math.max(0, Math.min(255, Math.round(seed.r))),
      g: Math.max(0, Math.min(255, Math.round(seed.g))),
      b: Math.max(0, Math.min(255, Math.round(seed.b))),
      a: Math.max(0, Math.min(255, Math.round(seed.a))),
      nonContiguous: seed.nonContiguous === true,
    })),
  });
}

type RgbTuple = [number, number, number];
type ChromaKeyModel = {
  seedSrgbColors: RgbTuple[];
  screenColor: RgbTuple;
  screenChannel: 0 | 1 | 2;
  fullDistance: number;
  falloffDistance: number;
  unmixStrength: number;
};

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampCanvasChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }
  const t = clampUnit((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function srgbToLinearChannel(value: number): number {
  const channel = clampUnit(value);
  if (channel <= 0.04045) {
    return channel / 12.92;
  }
  return ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgbChannel(value: number): number {
  const channel = Math.max(0, value);
  if (channel <= 0.0031308) {
    return clampUnit(channel * 12.92);
  }
  return clampUnit(1.055 * channel ** (1 / 2.4) - 0.055);
}

function getOtherChromaChannels(
  screenChannel: 0 | 1 | 2,
): [0 | 1 | 2, 0 | 1 | 2] {
  if (screenChannel === 0) {
    return [1, 2];
  }
  if (screenChannel === 1) {
    return [0, 2];
  }
  return [0, 1];
}

function getPixelSrgbColor(
  data: Uint8ClampedArray,
  pixelIndex: number,
): RgbTuple {
  return [
    data[pixelIndex] / 255,
    data[pixelIndex + 1] / 255,
    data[pixelIndex + 2] / 255,
  ];
}

function srgbToLinearColor(color: RgbTuple): RgbTuple {
  return [
    srgbToLinearChannel(color[0]),
    srgbToLinearChannel(color[1]),
    srgbToLinearChannel(color[2]),
  ];
}

function getDominantScreenChannel(color: RgbTuple): 0 | 1 | 2 {
  const channelScores: RgbTuple = [
    color[0] - (color[1] + color[2]) / 2,
    color[1] - (color[0] + color[2]) / 2,
    color[2] - (color[0] + color[1]) / 2,
  ];
  if (
    channelScores[1] >= channelScores[0] &&
    channelScores[1] >= channelScores[2]
  ) {
    return 1;
  }
  return channelScores[2] > channelScores[0] ? 2 : 0;
}

function getScreenChannelForMode(
  mode: BackgroundRemovalScreenColorMode,
  screenColor: RgbTuple,
): 0 | 1 | 2 {
  if (mode === "red") {
    return 0;
  }
  if (mode === "green") {
    return 1;
  }
  if (mode === "blue") {
    return 2;
  }
  return getDominantScreenChannel(screenColor);
}

function getBestSeedDistance(color: RgbTuple, seedColors: RgbTuple[]): number {
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const seedColor of seedColors) {
    bestDistance = Math.min(
      bestDistance,
      Math.max(
        Math.abs(color[0] - seedColor[0]),
        Math.abs(color[1] - seedColor[1]),
        Math.abs(color[2] - seedColor[2]),
      ),
    );
  }
  return Number.isFinite(bestDistance) ? bestDistance : 1;
}

function createChromaKeyModel(
  settings: PersistedTilesetBatchPickerBackgroundRemovalSettings,
  seeds: PersistedTilesetBatchPickerRemovalSeed[],
): ChromaKeyModel {
  const seedSrgbColors = seeds.map<RgbTuple>((seed) => [
    seed.r / 255,
    seed.g / 255,
    seed.b / 255,
  ]);
  const seedLinearColors = seedSrgbColors.map((seedColor) =>
    srgbToLinearColor(seedColor),
  );
  const screenColor = seedLinearColors.reduce<RgbTuple>(
    (sum, seedColor) => [
      sum[0] + seedColor[0] / seedLinearColors.length,
      sum[1] + seedColor[1] / seedLinearColors.length,
      sum[2] + seedColor[2] / seedLinearColors.length,
    ],
    [0, 0, 0],
  );
  const fullDistance = Math.max(
    1 / 255,
    Math.min(1, Math.round(settings.tolerance) / 255),
  );
  const matteFalloff = Math.max(
    0,
    Math.min(100, Math.round(settings.matteFalloff)),
  );
  const falloffDistance = Math.max(
    2 / 255,
    fullDistance * 0.15,
    (matteFalloff / 100) * 0.12,
  );
  const screenColorMode = normalizeBackgroundRemovalScreenColorMode(
    settings.screenColorMode,
  );

  return {
    seedSrgbColors,
    screenColor,
    screenChannel: getScreenChannelForMode(screenColorMode, screenColor),
    fullDistance,
    falloffDistance,
    unmixStrength: Math.max(
      0,
      Math.min(1, settings.unmixStrength / 100),
    ),
  };
}

function createChromaKeyModels(
  settings: PersistedTilesetBatchPickerBackgroundRemovalSettings,
): ChromaKeyModel[] {
  return settings.seeds.map((seed) => createChromaKeyModel(settings, [seed]));
}

function getBackgroundRemovalSeedCounts(
  seeds: PersistedTilesetBatchPickerRemovalSeed[],
): { contiguous: number; nonContiguous: number } {
  let contiguous = 0;
  let nonContiguous = 0;
  for (const seed of seeds) {
    if (seed.nonContiguous) {
      nonContiguous += 1;
    } else {
      contiguous += 1;
    }
  }
  return { contiguous, nonContiguous };
}

function getScreenExcessCoverage(
  color: RgbTuple,
  model: ChromaKeyModel,
): number {
  const [otherA, otherB] = getOtherChromaChannels(model.screenChannel);
  const screenLimit = (model.screenColor[otherA] + model.screenColor[otherB]) / 2;
  const maxScreenExcess = Math.max(
    0.08,
    model.screenColor[model.screenChannel] - screenLimit,
  );
  const limit = (color[otherA] + color[otherB]) / 2;
  return clampUnit(
    Math.max(0, color[model.screenChannel] - limit) / maxScreenExcess,
  );
}

function getChromaKeyBackgroundCoverage(
  data: Uint8ClampedArray,
  pixelIndex: number,
  model: ChromaKeyModel,
): number {
  const srgbColor = getPixelSrgbColor(data, pixelIndex);
  const seedDistance = getBestSeedDistance(srgbColor, model.seedSrgbColors);
  const fullKeyCoverage =
    1 -
    smoothstep(
      model.fullDistance,
      model.fullDistance + model.falloffDistance,
      seedDistance,
    );

  const linearColor = srgbToLinearColor(srgbColor);
  const proximity =
    1 -
    smoothstep(
      model.fullDistance + model.falloffDistance,
      model.fullDistance + model.falloffDistance * 2.5,
      seedDistance,
    );
  const screenExcessCoverage =
    getScreenExcessCoverage(linearColor, model) * proximity;
  return clampUnit(Math.max(fullKeyCoverage, screenExcessCoverage));
}

function unmixScreenColor(
  color: RgbTuple,
  backgroundCoverage: number,
  screenColor: RgbTuple,
): RgbTuple {
  const foregroundCoverage = Math.max(0.001, 1 - backgroundCoverage);
  return [
    clampUnit((color[0] - backgroundCoverage * screenColor[0]) / foregroundCoverage),
    clampUnit((color[1] - backgroundCoverage * screenColor[1]) / foregroundCoverage),
    clampUnit((color[2] - backgroundCoverage * screenColor[2]) / foregroundCoverage),
  ];
}

function applyChromaKeyMatte(
  data: Uint8ClampedArray,
  keyCoverage: Float32Array,
  keyModelIndexByPixel: Int16Array,
  removedMask: Uint8Array,
  models: ChromaKeyModel[],
): void {
  for (let maskIndex = 0; maskIndex < keyCoverage.length; maskIndex += 1) {
    const backgroundCoverage = clampUnit(keyCoverage[maskIndex]);
    if (backgroundCoverage <= 0) {
      continue;
    }
    const pixelIndex = maskIndex * 4;
    const originalAlpha = data[pixelIndex + 3] / 255;
    const foregroundAlpha = originalAlpha * (1 - backgroundCoverage);

    if (backgroundCoverage >= 0.5) {
      removedMask[maskIndex] = 1;
    }
    if (foregroundAlpha <= 0.002) {
      data[pixelIndex + 3] = 0;
      continue;
    }
    const model = models[keyModelIndexByPixel[maskIndex]];
    if (!model) {
      data[pixelIndex + 3] = clampCanvasChannel(foregroundAlpha * 255);
      continue;
    }

    const originalLinearColor = srgbToLinearColor(
      getPixelSrgbColor(data, pixelIndex),
    );
    const unmixed = unmixScreenColor(
      originalLinearColor,
      backgroundCoverage,
      model.screenColor,
    );
    const outputColor: RgbTuple =
      model.unmixStrength >= 1
        ? unmixed
        : [
            originalLinearColor[0] * (1 - model.unmixStrength) +
              unmixed[0] * model.unmixStrength,
            originalLinearColor[1] * (1 - model.unmixStrength) +
              unmixed[1] * model.unmixStrength,
            originalLinearColor[2] * (1 - model.unmixStrength) +
              unmixed[2] * model.unmixStrength,
          ];
    data[pixelIndex] = clampCanvasChannel(
      linearToSrgbChannel(outputColor[0]) * 255,
    );
    data[pixelIndex + 1] = clampCanvasChannel(
      linearToSrgbChannel(outputColor[1]) * 255,
    );
    data[pixelIndex + 2] = clampCanvasChannel(
      linearToSrgbChannel(outputColor[2]) * 255,
    );
    data[pixelIndex + 3] = clampCanvasChannel(foregroundAlpha * 255);
  }
}

function applyBackgroundRemovalAntialiasing(
  data: Uint8ClampedArray,
  removedMask: Uint8Array,
  width: number,
  height: number,
  edgeSoftness: number,
): void {
  const strength = Math.max(0, Math.min(1, edgeSoftness / 100));
  if (strength <= 0) {
    return;
  }
  const nextAlpha = new Uint8ClampedArray(width * height);
  const cardinalWeight = 1;
  const diagonalWeight = 0.7;
  const maxRemovedWeight = cardinalWeight * 4 + diagonalWeight * 4;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const maskIndex = y * width + x;
      const pixelIndex = maskIndex * 4;
      const originalAlpha = data[pixelIndex + 3];
      if (removedMask[maskIndex] || originalAlpha <= 0) {
        continue;
      }

      let removedWeight = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const sampleY = y + offsetY;
        if (sampleY < 0 || sampleY >= height) {
          continue;
        }
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) {
            continue;
          }
          const sampleX = x + offsetX;
          if (sampleX < 0 || sampleX >= width) {
            continue;
          }
          if (!removedMask[sampleY * width + sampleX]) {
            continue;
          }
          removedWeight +=
            offsetX === 0 || offsetY === 0 ? cardinalWeight : diagonalWeight;
        }
      }

      if (removedWeight <= 0) {
        continue;
      }

      const retainedCoverage = Math.max(
        0.35,
        1 - removedWeight / maxRemovedWeight,
      );
      const adjustedCoverage = 1 - strength * (1 - retainedCoverage);
      nextAlpha[maskIndex] = Math.max(
        1,
        Math.min(255, Math.round(originalAlpha * adjustedCoverage)),
      );
    }
  }

  for (let index = 0; index < nextAlpha.length; index += 1) {
    if (nextAlpha[index] <= 0) {
      continue;
    }
    data[index * 4 + 3] = nextAlpha[index];
  }
}

function applyEdgeSpillRemoval(
  data: Uint8ClampedArray,
  removedMask: Uint8Array,
  keyModelIndexByPixel: Int16Array,
  width: number,
  height: number,
  settings: PersistedTilesetBatchPickerBackgroundRemovalSettings,
  models: ChromaKeyModel[],
): void {
  const range = Math.max(0, Math.min(64, Math.round(settings.edgeSpillRange)));
  const baseStrength = Math.max(
    0,
    Math.min(1, settings.edgeSpillStrength / 100),
  );
  const baseDesaturation = Math.max(
    0,
    Math.min(1, settings.edgeDesaturation / 100),
  );
  if (
    range <= 0 ||
    (baseStrength <= 0 && baseDesaturation <= 0) ||
    settings.seeds.length <= 0
  ) {
    return;
  }
  const pixelCount = width * height;
  const distanceFromCutout = new Uint8Array(pixelCount);
  const distanceModelIndexByPixel = new Int16Array(pixelCount);
  distanceModelIndexByPixel.fill(-1);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  for (let index = 0; index < pixelCount; index += 1) {
    if (!removedMask[index]) {
      continue;
    }
    distanceFromCutout[index] = 1;
    distanceModelIndexByPixel[index] = keyModelIndexByPixel[index];
    queue[tail] = index;
    tail += 1;
  }

  while (head < tail) {
    const currentIndex = queue[head];
    head += 1;
    const currentDistance = distanceFromCutout[currentIndex];
    if (currentDistance > range) {
      continue;
    }

    const x = currentIndex % width;
    const y = Math.floor(currentIndex / width);
    const nextDistance = currentDistance + 1;
    const neighbors = [
      x > 0 ? currentIndex - 1 : -1,
      x + 1 < width ? currentIndex + 1 : -1,
      y > 0 ? currentIndex - width : -1,
      y + 1 < height ? currentIndex + width : -1,
    ];

    for (const neighborIndex of neighbors) {
      if (
        neighborIndex < 0 ||
        distanceFromCutout[neighborIndex] > 0 ||
        data[neighborIndex * 4 + 3] <= 0
      ) {
        continue;
      }
      distanceFromCutout[neighborIndex] = nextDistance;
      distanceModelIndexByPixel[neighborIndex] =
        distanceModelIndexByPixel[currentIndex];
      queue[tail] = neighborIndex;
      tail += 1;
    }
  }

  for (let maskIndex = 0; maskIndex < pixelCount; maskIndex += 1) {
    if (removedMask[maskIndex]) {
      continue;
    }
    const storedDistance = distanceFromCutout[maskIndex];
    if (storedDistance <= 1) {
      continue;
    }

    const pixelIndex = maskIndex * 4;
    if (data[pixelIndex + 3] <= 0) {
      continue;
    }

    const edgeDistance = storedDistance - 1;
    const edgeWeight = Math.max(0, 1 - (edgeDistance - 1) / range);
    if (edgeWeight <= 0) {
      continue;
    }

    if (baseStrength > 0) {
      const model = models[distanceModelIndexByPixel[maskIndex]];
      if (model) {
        const screenChannel = model.screenChannel;
        const [otherA, otherB] = getOtherChromaChannels(screenChannel);
        const spillStrength = baseStrength * edgeWeight;
        const screen = srgbToLinearChannel(
          data[pixelIndex + screenChannel] / 255,
        );
        const a = srgbToLinearChannel(data[pixelIndex + otherA] / 255);
        const b = srgbToLinearChannel(data[pixelIndex + otherB] / 255);
        const limit =
          normalizeBackgroundRemovalSpillLimitMode(settings.spillLimitMode) ===
          "max"
            ? Math.max(a, b)
            : (a + b) / 2;
        const spillAmount = Math.max(0, screen - limit) * spillStrength;
        if (spillAmount > 0) {
          data[pixelIndex + screenChannel] = clampCanvasChannel(
            linearToSrgbChannel(screen - spillAmount) * 255,
          );
          data[pixelIndex + otherA] = clampCanvasChannel(
            linearToSrgbChannel(a + spillAmount * 0.5) * 255,
          );
          data[pixelIndex + otherB] = clampCanvasChannel(
            linearToSrgbChannel(b + spillAmount * 0.5) * 255,
          );
        }
      }
    }

    const desaturationStrength = baseDesaturation * edgeWeight;
    if (desaturationStrength <= 0) {
      continue;
    }

    const r = srgbToLinearChannel(data[pixelIndex] / 255);
    const g = srgbToLinearChannel(data[pixelIndex + 1] / 255);
    const b = srgbToLinearChannel(data[pixelIndex + 2] / 255);
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    data[pixelIndex] = clampCanvasChannel(
      linearToSrgbChannel(
        r * (1 - desaturationStrength) + luminance * desaturationStrength,
      ) * 255,
    );
    data[pixelIndex + 1] = clampCanvasChannel(
      linearToSrgbChannel(
        g * (1 - desaturationStrength) + luminance * desaturationStrength,
      ) * 255,
    );
    data[pixelIndex + 2] = clampCanvasChannel(
      linearToSrgbChannel(
        b * (1 - desaturationStrength) + luminance * desaturationStrength,
      ) * 255,
    );
  }
}

function renderBackgroundRemovedCanvas(
  image: HTMLImageElement,
  settings: PersistedTilesetBatchPickerBackgroundRemovalSettings,
): HTMLCanvasElement | null {
  if (!image.naturalWidth || !image.naturalHeight || settings.seeds.length <= 0) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const baseData = new Uint8ClampedArray(imageData.data);
  const workingData = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  const keyModels = createChromaKeyModels(settings);
  const keyCoverage = new Float32Array(width * height);
  const keyModelIndexByPixel = new Int16Array(width * height);
  keyModelIndexByPixel.fill(-1);
  const removedMask = new Uint8Array(width * height);
  const minTraversalCoverage = 0.01;

  for (let modelIndex = 0; modelIndex < keyModels.length; modelIndex += 1) {
    const seed = settings.seeds[modelIndex];
    const keyModel = keyModels[modelIndex];
    if (!seed || !keyModel) {
      continue;
    }
    if (seed.nonContiguous) {
      for (let maskIndex = 0; maskIndex < keyCoverage.length; maskIndex += 1) {
        const pixelIndex = maskIndex * 4;
        const coverage = getChromaKeyBackgroundCoverage(
          baseData,
          pixelIndex,
          keyModel,
        );
        if (coverage > keyCoverage[maskIndex]) {
          keyCoverage[maskIndex] = coverage;
          keyModelIndexByPixel[maskIndex] = modelIndex;
        }
      }
      continue;
    }

    if (seed.x < 0 || seed.x >= width || seed.y < 0 || seed.y >= height) {
      continue;
    }

    const visited = new Uint8Array(keyCoverage.length);
    const queue = new Int32Array(keyCoverage.length);
    const seedIndex = seed.y * width + seed.x;
    let head = 0;
    let tail = 0;
    queue[tail] = seedIndex;
    visited[seedIndex] = 1;
    tail += 1;

    while (head < tail) {
      const visitIndex = queue[head];
      head += 1;
      const pixelIndex = visitIndex * 4;
      const coverage = getChromaKeyBackgroundCoverage(
        baseData,
        pixelIndex,
        keyModel,
      );
      if (coverage <= minTraversalCoverage) {
        continue;
      }
      if (coverage > keyCoverage[visitIndex]) {
        keyCoverage[visitIndex] = coverage;
        keyModelIndexByPixel[visitIndex] = modelIndex;
      }

      const x = visitIndex % width;
      const y = Math.floor(visitIndex / width);
      if (x > 0 && !visited[visitIndex - 1]) {
        visited[visitIndex - 1] = 1;
        queue[tail] = visitIndex - 1;
        tail += 1;
      }
      if (x + 1 < width && !visited[visitIndex + 1]) {
        visited[visitIndex + 1] = 1;
        queue[tail] = visitIndex + 1;
        tail += 1;
      }
      if (y > 0 && !visited[visitIndex - width]) {
        visited[visitIndex - width] = 1;
        queue[tail] = visitIndex - width;
        tail += 1;
      }
      if (y + 1 < height && !visited[visitIndex + width]) {
        visited[visitIndex + width] = 1;
        queue[tail] = visitIndex + width;
      tail += 1;
      }
    }
  }

  applyChromaKeyMatte(
    workingData,
    keyCoverage,
    keyModelIndexByPixel,
    removedMask,
    keyModels,
  );
  applyBackgroundRemovalAntialiasing(
    workingData,
    removedMask,
    width,
    height,
    Math.max(0, Math.min(100, Math.round(settings.edgeSoftness))),
  );
  applyEdgeSpillRemoval(
    workingData,
    removedMask,
    keyModelIndexByPixel,
    width,
    height,
    settings,
    keyModels,
  );
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function sampleImagePixel(
  image: HTMLImageElement,
  x: number,
  y: number,
): SampledPixel | null {
  if (!image.naturalWidth || !image.naturalHeight) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0);
  const pixel = context.getImageData(
    Math.max(0, Math.min(image.naturalWidth - 1, Math.round(x))),
    Math.max(0, Math.min(image.naturalHeight - 1, Math.round(y))),
    1,
    1,
  ).data;
  return {
    x: Math.max(0, Math.min(image.naturalWidth - 1, Math.round(x))),
    y: Math.max(0, Math.min(image.naturalHeight - 1, Math.round(y))),
    r: pixel[0],
    g: pixel[1],
    b: pixel[2],
    a: pixel[3],
  };
}

function formatPixelColor(
  seed:
    | PersistedTilesetBatchPickerRemovalSeed
    | SampledPixel
    | null,
): string {
  if (!seed) {
    return "None";
  }
  return `rgba(${seed.r}, ${seed.g}, ${seed.b}, ${(seed.a / 255).toFixed(2)})`;
}

function getSheetSource(uploadedImage: UploadedBatchImage): HTMLCanvasElement | HTMLImageElement | null {
  return uploadedImage.processedCanvas ?? uploadedImage.image;
}

function sampleCanvasPixel(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): SampledPixel | null {
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  const clampedX = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
  const clampedY = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
  const pixel = context.getImageData(clampedX, clampedY, 1, 1).data;
  return {
    x: clampedX,
    y: clampedY,
    r: pixel[0],
    g: pixel[1],
    b: pixel[2],
    a: pixel[3],
  };
}

function sampleDisplayedPixel(
  uploadedImage: UploadedBatchImage,
  x: number,
  y: number,
): SampledPixel | null {
  const source = getSheetSource(uploadedImage);
  if (!source) {
    return null;
  }
  if (source instanceof HTMLCanvasElement) {
    return sampleCanvasPixel(source, x, y);
  }
  return sampleImagePixel(source, x, y);
}

function getCropRect(
  image: HTMLImageElement,
  placement: GeneratedTilePlacement,
  compileMap: CompileMap,
  offset: PersistedTilesetBatchPickerOffset,
  cropInsets: PersistedTilesetBatchPickerCropInsets,
): {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  baseSourceWidth: number;
  baseSourceHeight: number;
} {
  const sourceWidth = image.naturalWidth / compileMap.promptSheets.columns;
  const sourceHeight = image.naturalHeight / compileMap.promptSheets.rows;
  const maxSourceX = Math.max(0, image.naturalWidth - sourceWidth);
  const maxSourceY = Math.max(0, image.naturalHeight - sourceHeight);
  const cropLeft = clampCropInset(cropInsets.left, cropInsets.right);
  const cropRight = clampCropInset(cropInsets.right, cropLeft);
  const cropTop = clampCropInset(cropInsets.top, cropInsets.bottom);
  const cropBottom = clampCropInset(cropInsets.bottom, cropTop);
  const adjustedSourceWidth = Math.max(
    sourceWidth * minCropSpan,
    sourceWidth * (1 - cropLeft - cropRight),
  );
  const adjustedSourceHeight = Math.max(
    sourceHeight * minCropSpan,
    sourceHeight * (1 - cropTop - cropBottom),
  );
  return {
    sourceX: Math.max(
      0,
      Math.min(
        Math.max(0, image.naturalWidth - adjustedSourceWidth),
        placement.sheetColumn * sourceWidth +
          (offset.x + cropLeft) * sourceWidth,
      ),
    ),
    sourceY: Math.max(
      0,
      Math.min(
        Math.max(0, image.naturalHeight - adjustedSourceHeight),
        placement.sheetRow * sourceHeight +
          (offset.y + cropTop) * sourceHeight,
      ),
    ),
    sourceWidth: adjustedSourceWidth,
    sourceHeight: adjustedSourceHeight,
    baseSourceWidth: sourceWidth,
    baseSourceHeight: sourceHeight,
  };
}

function applyStoneTint(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const imageData = context.getImageData(x, y, width, height);
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) {
      continue;
    }
    const luminance =
      data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    data[index] = Math.max(0, Math.min(255, Math.round(luminance * 0.72 + 42)));
    data[index + 1] = Math.max(
      0,
      Math.min(255, Math.round(luminance * 0.76 + 42)),
    );
    data[index + 2] = Math.max(
      0,
      Math.min(255, Math.round(luminance * 0.82 + 50)),
    );
  }
  context.putImageData(imageData, x, y);
}

function drawCompiledTileset({
  canvas,
  compileMap,
  selectedImages,
  selectedOffsets,
  selectedCropInsets,
  batchImages,
  tileSize,
}: {
  canvas: HTMLCanvasElement;
  compileMap: CompileMap;
  selectedImages: SelectedImageByGeneratedIndex;
  selectedOffsets: SelectedOffsetByGeneratedIndex;
  selectedCropInsets: SelectedCropInsetsByGeneratedIndex;
  batchImages: BatchImagesByIndex;
  tileSize: number;
}): void {
  const width = compileMap.finalAtlas.columns * tileSize;
  const height = compileMap.finalAtlas.rows * tileSize;
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = false;

  const generatedTileByIndex = new Map(
    compileMap.generatedTiles.map((tile) => [tile.generatedIndex, tile]),
  );
  const imageById = new Map<string, UploadedBatchImage>();
  for (const images of Object.values(batchImages)) {
    for (const image of images) {
      imageById.set(image.id, image);
    }
  }

  for (const slot of compileMap.finalSlots) {
    const selectedImageId = selectedImages[slot.generatedIndex];
    if (!selectedImageId) {
      continue;
    }
    const uploadedImage = imageById.get(selectedImageId);
    if (!uploadedImage?.image) {
      continue;
    }
    const sheetSource = getSheetSource(uploadedImage) ?? uploadedImage.image;
    const generatedTile = generatedTileByIndex.get(slot.generatedIndex);
    if (!generatedTile) {
      continue;
    }

    const crop = getCropRect(
      uploadedImage.image,
      generatedTile,
      compileMap,
      selectedOffsets[slot.generatedIndex] ?? { x: 0, y: 0 },
      selectedCropInsets[slot.generatedIndex] ?? getDefaultCropInsets(),
    );
    const targetX = slot.finalColumn * tileSize;
    const targetY = slot.finalRow * tileSize;
    const widthRatio = crop.sourceWidth / crop.baseSourceWidth;
    const heightRatio = crop.sourceHeight / crop.baseSourceHeight;
    const drawWidth = Math.max(1, Math.round(tileSize * widthRatio));
    const drawHeight = Math.max(1, Math.round(tileSize * heightRatio));
    const drawX = targetX + Math.floor((tileSize - drawWidth) / 2);
    const drawY = targetY + Math.floor((tileSize - drawHeight) / 2);
    context.drawImage(
      sheetSource,
      crop.sourceX,
      crop.sourceY,
      crop.sourceWidth,
      crop.sourceHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    );
    if (slot.operation === "stone-statue") {
      applyStoneTint(context, drawX, drawY, drawWidth, drawHeight);
    }
  }

  context.strokeStyle = "rgba(255, 255, 255, 0.06)";
  context.lineWidth = 1;
  for (let column = 0; column <= compileMap.finalAtlas.columns; column += 1) {
    const x = column * tileSize + 0.5;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let row = 0; row <= compileMap.finalAtlas.rows; row += 1) {
    const y = row * tileSize + 0.5;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function SheetPreview({
  uploadedImage,
  pixelPerfect = false,
}: SheetPreviewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const source = getSheetSource(uploadedImage);
    if (!canvas || !source) {
      return;
    }

    const width = Math.max(1, uploadedImage.width || uploadedImage.image?.naturalWidth || 1);
    const height = Math.max(
      1,
      uploadedImage.height || uploadedImage.image?.naturalHeight || 1,
    );
    if (canvas.width !== width) {
      canvas.width = width;
    }
    if (canvas.height !== height) {
      canvas.height = height;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = false;
    context.drawImage(source, 0, 0, width, height);
  }, [
    uploadedImage.height,
    uploadedImage.image,
    uploadedImage.processedCanvas,
    uploadedImage.width,
  ]);

  if (!uploadedImage.image) {
    return (
      <img
        alt=""
        className={[
          "tileset-batch-picker__sheet-preview",
          pixelPerfect ? "tileset-batch-picker__sheet-preview--pixel-perfect" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        draggable={false}
        src={uploadedImage.url}
      />
    );
  }

  return (
    <canvas
      className={[
        "tileset-batch-picker__sheet-preview",
        pixelPerfect ? "tileset-batch-picker__sheet-preview--pixel-perfect" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      height={Math.max(1, uploadedImage.height || 1)}
      ref={canvasRef}
      width={Math.max(1, uploadedImage.width || 1)}
    />
  );
}

function PixelZoomPreview({
  uploadedImage,
  zoom,
}: {
  uploadedImage: UploadedBatchImage;
  zoom: ActivePixelZoom;
}): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const source = getSheetSource(uploadedImage);
    if (!canvas || !source) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const drawSize = pixelZoomGridSize * pixelZoomScale;
    if (canvas.width !== drawSize) {
      canvas.width = drawSize;
    }
    if (canvas.height !== drawSize) {
      canvas.height = drawSize;
    }

    context.clearRect(0, 0, drawSize, drawSize);
    context.imageSmoothingEnabled = false;

    for (let row = 0; row < pixelZoomGridSize; row += 1) {
      for (let column = 0; column < pixelZoomGridSize; column += 1) {
        const sampleX = Math.max(
          0,
          Math.min(
            uploadedImage.width - 1,
            zoom.pixel.x + column - pixelZoomRadius,
          ),
        );
        const sampleY = Math.max(
          0,
          Math.min(
            uploadedImage.height - 1,
            zoom.pixel.y + row - pixelZoomRadius,
          ),
        );
        context.drawImage(
          source,
          sampleX,
          sampleY,
          1,
          1,
          column * pixelZoomScale,
          row * pixelZoomScale,
          pixelZoomScale,
          pixelZoomScale,
        );
      }
    }

    context.strokeStyle = "rgba(255, 255, 255, 0.14)";
    context.lineWidth = 1;
    for (let index = 0; index <= pixelZoomGridSize; index += 1) {
      const offset = index * pixelZoomScale + 0.5;
      context.beginPath();
      context.moveTo(offset, 0);
      context.lineTo(offset, drawSize);
      context.stroke();
      context.beginPath();
      context.moveTo(0, offset);
      context.lineTo(drawSize, offset);
      context.stroke();
    }

    context.strokeStyle = "#ffd54f";
    context.lineWidth = 2;
    context.strokeRect(
      pixelZoomRadius * pixelZoomScale + 1,
      pixelZoomRadius * pixelZoomScale + 1,
      pixelZoomScale - 2,
      pixelZoomScale - 2,
    );
  }, [uploadedImage, zoom]);

  const preferredRight = zoom.frameX + pixelZoomPanelOffset;
  const preferredLeft =
    zoom.frameX - pixelZoomPanelWidth - pixelZoomPanelOffset;
  const left =
    preferredRight + pixelZoomPanelWidth <= zoom.frameWidth - 8
      ? preferredRight
      : preferredLeft >= 8
        ? preferredLeft
        : Math.max(
            8,
            Math.min(
              zoom.frameWidth - pixelZoomPanelWidth - 8,
              preferredRight,
            ),
          );
  const preferredBottom = zoom.frameY + pixelZoomPanelOffset;
  const preferredTop =
    zoom.frameY - pixelZoomPanelHeight - pixelZoomPanelOffset;
  const top =
    preferredBottom + pixelZoomPanelHeight <= zoom.frameHeight - 8
      ? preferredBottom
      : preferredTop >= 8
        ? preferredTop
        : Math.max(
            8,
            Math.min(
              zoom.frameHeight - pixelZoomPanelHeight - 8,
              preferredBottom,
            ),
          );

  return (
    <div
      className="tileset-batch-picker__pixel-zoom"
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      <canvas
        className="tileset-batch-picker__pixel-zoom-canvas"
        height={pixelZoomGridSize * pixelZoomScale}
        ref={canvasRef}
        width={pixelZoomGridSize * pixelZoomScale}
      />
      <div className="tileset-batch-picker__pixel-zoom-label">
        <span>
          {zoom.pixel.x}, {zoom.pixel.y}
        </span>
        <span>{formatPixelColor(zoom.pixel)}</span>
      </div>
    </div>
  );
}

export default function TilesetBatchPicker(): JSX.Element {
  const [compileMap, setCompileMap] = useState<CompileMap | null>(null);
  const [mapLabel, setMapLabel] = useState("NetHack 5 compile map");
  const [mapStatus, setMapStatus] = useState("Loading");
  const [batchImages, setBatchImages] = useState<BatchImagesByIndex>({});
  const [selectedImages, setSelectedImages] =
    useState<SelectedImageByGeneratedIndex>({});
  const [selectedOffsets, setSelectedOffsets] =
    useState<SelectedOffsetByGeneratedIndex>({});
  const [selectedCropInsets, setSelectedCropInsets] =
    useState<SelectedCropInsetsByGeneratedIndex>({});
  const [backgroundRemovalByImageId, setBackgroundRemovalByImageId] =
    useState<BackgroundRemovalByImageId>({});
  const [editorMode, setEditorMode] = useState<EditorMode>("arrange");
  const [activePixelZoom, setActivePixelZoom] = useState<ActivePixelZoom | null>(
    null,
  );
  const [showTransparencyPreview, setShowTransparencyPreview] = useState(false);
  const [showBackgroundRemovalPoints, setShowBackgroundRemovalPoints] =
    useState(true);
  const [leftTransparencyTheme, setLeftTransparencyTheme] = useState<
    "dark" | "light"
  >("dark");
  const [modeSwitchAnchorImageId, setModeSwitchAnchorImageId] =
    useState<string | null>(null);
  const [draggedBatchIndex, setDraggedBatchIndex] = useState<number | null>(
    null,
  );
  const [exportStatus, setExportStatus] = useState("");
  const [previewZoomIndex, setPreviewZoomIndex] = useState(0);
  const batchesViewportRef = useRef<HTMLDivElement | null>(null);
  const batchSheetRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const visibleSheetImageIdRef = useRef<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const activeAdjustmentDragRef = useRef<ActiveAdjustmentDrag | null>(null);
  const sessionSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [previewViewportWidth, setPreviewViewportWidth] = useState(0);
  const [activeDraggedGeneratedIndex, setActiveDraggedGeneratedIndex] =
    useState<number | null>(null);

  const resetObjectUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current.clear();
  }, []);

  const updateVisibleSheetAnchor = useCallback(() => {
    const viewport = batchesViewportRef.current;
    if (!viewport) {
      return null;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const viewportCenterY = viewportRect.top + viewportRect.height / 2;
    let bestImageId: string | null = null;
    let bestVisibleHeight = -1;
    let bestCenterDistance = Number.POSITIVE_INFINITY;

    for (const [imageId, element] of Object.entries(batchSheetRefs.current)) {
      if (!element) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, viewportRect.top);
      const visibleBottom = Math.min(rect.bottom, viewportRect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      if (visibleHeight <= 0) {
        continue;
      }

      const centerY = rect.top + rect.height / 2;
      const centerDistance = Math.abs(centerY - viewportCenterY);
      if (
        visibleHeight > bestVisibleHeight ||
        (visibleHeight === bestVisibleHeight &&
          centerDistance < bestCenterDistance)
      ) {
        bestImageId = imageId;
        bestVisibleHeight = visibleHeight;
        bestCenterDistance = centerDistance;
      }
    }

    visibleSheetImageIdRef.current = bestImageId;
    return bestImageId;
  }, []);

  const queueImageLoad = useCallback(
    (sheetIndex: number, imageId: string, url: string) => {
      const imageElement = new Image();
      imageElement.onload = () => {
        setBatchImages((current) => ({
          ...current,
          [sheetIndex]: (current[sheetIndex] ?? []).map((existing) =>
            existing.id === imageId
              ? {
                  ...existing,
                  width: imageElement.naturalWidth,
                  height: imageElement.naturalHeight,
                  image: imageElement,
                  isReady: true,
                }
              : existing,
          ),
        }));
      };
      imageElement.src = url;
    },
    [],
  );

  const createBatchImageState = useCallback(
    ({
      sheetIndex,
      id,
      name,
      url,
      mimeType,
      width,
      height,
      createdAt,
      updatedAt,
    }: {
      sheetIndex: number;
      id: string;
      name: string;
      url: string;
      mimeType: string;
      width: number;
      height: number;
      createdAt: number;
      updatedAt: number;
    }): UploadedBatchImage => {
      queueImageLoad(sheetIndex, id, url);
      return {
        id,
        name,
        url,
        mimeType,
        width,
        height,
        image: null,
        processedCanvas: null,
        backgroundRemovalSignature: "",
        isReady: false,
        createdAt,
        updatedAt,
      };
    },
    [queueImageLoad],
  );

  const loadDefaultCompileMap = useCallback(async () => {
    const response = await fetch(defaultCompileMapUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json();
    if (!isCompileMap(json)) {
      throw new Error("Invalid compile map");
    }
    return json;
  }, []);

  const applyCompileMap = useCallback(
    (nextCompileMap: CompileMap, label: string) => {
      resetObjectUrls();
      setCompileMap(nextCompileMap);
      setMapLabel(label);
      setMapStatus("Ready");
      setBatchImages({});
      setSelectedImages({});
      setSelectedOffsets({});
      setSelectedCropInsets({});
      setBackgroundRemovalByImageId({});
      setModeSwitchAnchorImageId(null);
      visibleSheetImageIdRef.current = null;
      void clearPersistedTilesetBatchPickerImages().catch((error) => {
        console.warn("Failed to clear persisted batch picker images:", error);
      });
    },
    [resetObjectUrls],
  );

  useEffect(() => {
    let cancelled = false;
    const restoreSession = async (): Promise<void> => {
      try {
        const persisted = await loadPersistedTilesetBatchPickerSession();
        if (cancelled) {
          return;
        }
        if (persisted && isCompileMap(persisted.compileMap)) {
          const imageIds = Array.from(
            new Set(
              Object.values(persisted.batchImages).flatMap((images) =>
                images.map((image) => image.id),
              ),
            ),
          );
          const persistedImageById =
            await loadPersistedTilesetBatchPickerImages(imageIds);
          if (cancelled) {
            return;
          }

          const restoredBatchImages: BatchImagesByIndex = {};
          const restoredImageIds = new Set<string>();
          for (const [batchKey, images] of Object.entries(persisted.batchImages)) {
            const fallbackBatchIndex = Math.max(
              0,
              Math.trunc(Number(batchKey) || 0),
            );
            for (const image of images) {
              const persistedImage = persistedImageById[image.id];
              if (!persistedImage) {
                continue;
              }
              const batchIndex = Math.max(
                0,
                Math.trunc(
                  Number.isFinite(persistedImage.batchIndex)
                    ? persistedImage.batchIndex
                    : fallbackBatchIndex,
                ),
              );
              restoredImageIds.add(image.id);
              const url = URL.createObjectURL(persistedImage.blob);
              objectUrlsRef.current.add(url);
              restoredBatchImages[batchIndex] = [
                ...(restoredBatchImages[batchIndex] ?? []),
                createBatchImageState({
                  sheetIndex: batchIndex,
                  id: image.id,
                  name: image.name,
                  url,
                  mimeType: image.mimeType,
                  width: persistedImage.width || image.width,
                  height: persistedImage.height || image.height,
                  createdAt: persistedImage.createdAt || image.createdAt,
                  updatedAt: persistedImage.updatedAt || image.updatedAt,
                }),
              ];
            }
          }

          setCompileMap(persisted.compileMap);
          setMapLabel(persisted.mapLabel);
          setMapStatus("Ready");
          setSelectedImages(
            Object.fromEntries(
              Object.entries(persisted.selectedImages).filter(([, imageId]) =>
                restoredImageIds.has(imageId),
              ),
            ) as SelectedImageByGeneratedIndex,
          );
          setSelectedOffsets(
            persisted.selectedOffsets as SelectedOffsetByGeneratedIndex,
          );
          setSelectedCropInsets(
            persisted.selectedCropInsets as SelectedCropInsetsByGeneratedIndex,
          );
          setBackgroundRemovalByImageId(
            Object.fromEntries(
              Object.entries(persisted.backgroundRemovalByImageId).filter(
                ([imageId]) => restoredImageIds.has(imageId),
              ),
            ),
          );
          setBatchImages(restoredBatchImages);
          return;
        }
        if (persisted) {
          await clearPersistedTilesetBatchPickerSession();
        }
      } catch (error) {
        console.warn("Failed to restore batch picker session:", error);
      }

      try {
        const nextCompileMap = await loadDefaultCompileMap();
        if (!cancelled) {
          applyCompileMap(nextCompileMap, "NetHack 5 compile map");
        }
      } catch {
        if (!cancelled) {
          setMapStatus("Load map");
        }
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [applyCompileMap, createBatchImageState, loadDefaultCompileMap]);

  useEffect(() => {
    return () => {
      resetObjectUrls();
    };
  }, [resetObjectUrls]);

  useEffect(() => {
    const previewViewport = previewViewportRef.current;
    if (!previewViewport || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateSize = (): void => {
      setPreviewViewportWidth(previewViewport.clientWidth);
    };

    updateSize();
    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(previewViewport);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    setBatchImages((current) => {
      let didChange = false;
      const nextBatchImages: BatchImagesByIndex = {};

      for (const [batchKey, images] of Object.entries(current)) {
        nextBatchImages[Number(batchKey)] = images.map((image) => {
          const settings = backgroundRemovalByImageId[image.id];
          const signature = settings ? getBackgroundRemovalSignature(settings) : "";

          if (!image.image || !image.isReady || !signature) {
            if (!image.processedCanvas && image.backgroundRemovalSignature === "") {
              return image;
            }
            didChange = true;
            return {
              ...image,
              processedCanvas: null,
              backgroundRemovalSignature: "",
            };
          }

          if (
            image.processedCanvas &&
            image.backgroundRemovalSignature === signature
          ) {
            return image;
          }

          didChange = true;
          return {
            ...image,
            processedCanvas: renderBackgroundRemovedCanvas(image.image, settings),
            backgroundRemovalSignature: signature,
          };
        });
      }

      return didChange ? nextBatchImages : current;
    });
  }, [backgroundRemovalByImageId, batchImages]);

  useEffect(() => {
    if (editorMode !== "background-remove" && activePixelZoom) {
      setActivePixelZoom(null);
    }
  }, [activePixelZoom, editorMode]);

  useEffect(() => {
    const viewport = batchesViewportRef.current;
    if (!viewport) {
      return;
    }

    const handleViewportChange = (): void => {
      updateVisibleSheetAnchor();
    };

    handleViewportChange();
    viewport.addEventListener("scroll", handleViewportChange, {
      passive: true,
    });
    window.addEventListener("resize", handleViewportChange);
    return () => {
      viewport.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [batchImages, updateVisibleSheetAnchor]);

  useEffect(() => {
    if (!modeSwitchAnchorImageId) {
      return;
    }
    if (!batchesViewportRef.current) {
      return;
    }
    const anchorSheet = batchSheetRefs.current[modeSwitchAnchorImageId];
    if (!anchorSheet) {
      return;
    }
    let frameId = 0;
    let frameId2 = 0;
    frameId = window.requestAnimationFrame(() => {
      frameId2 = window.requestAnimationFrame(() => {
        anchorSheet.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "auto",
        });
      });
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(frameId2);
    };
  }, [editorMode, modeSwitchAnchorImageId]);

  useEffect(() => {
    if (!compileMap) {
      return;
    }
    const sessionSnapshot = {
      compileMap,
      mapLabel,
      selectedImages: selectedImages as Record<string, string>,
      selectedOffsets: toPersistedSelectedOffsets(selectedOffsets),
      selectedCropInsets: toPersistedSelectedCropInsets(selectedCropInsets),
      backgroundRemovalByImageId: toPersistedBackgroundRemovalByImageId(
        backgroundRemovalByImageId,
      ),
      batchImages: toPersistedBatchImages(batchImages),
    };
    sessionSaveQueueRef.current = sessionSaveQueueRef.current
      .catch(() => {
        // Keep later autosaves moving even if an earlier IndexedDB write failed.
      })
      .then(() => savePersistedTilesetBatchPickerSession(sessionSnapshot));
    void sessionSaveQueueRef.current.catch((error) => {
      console.warn("Failed to persist batch picker session:", error);
    });
  }, [
    batchImages,
    compileMap,
    backgroundRemovalByImageId,
    mapLabel,
    selectedCropInsets,
    selectedImages,
    selectedOffsets,
  ]);

  const sheetTileCount = compileMap
    ? compileMap.promptSheets.columns * compileMap.promptSheets.rows
    : 0;
  const selectedCount = useMemo(() => {
    if (!compileMap) {
      return 0;
    }
    return compileMap.generatedTiles.filter(
      (tile) => selectedImages[tile.generatedIndex],
    ).length;
  }, [compileMap, selectedImages]);

  const filledFinalSlotCount = useMemo(() => {
    if (!compileMap) {
      return 0;
    }
    return compileMap.finalSlots.filter((slot) => selectedImages[slot.generatedIndex])
      .length;
  }, [compileMap, selectedImages]);
  const previewZoomMode: PreviewZoomMode = previewZoomModes[previewZoomIndex];
  const finalAtlasPixelWidth = compileMap
    ? compileMap.finalAtlas.columns * compileMap.finalAtlas.tileSize
    : 0;
  const finalAtlasPixelHeight = compileMap
    ? compileMap.finalAtlas.rows * compileMap.finalAtlas.tileSize
    : 0;
  const fitPreviewScale =
    finalAtlasPixelWidth > 0 && previewViewportWidth > 0
      ? Math.min(previewViewportWidth / finalAtlasPixelWidth, 1)
      : 1;
  const previewDisplayScale = useMemo(() => {
    if (!compileMap) {
      return 1;
    }
    if (previewZoomMode === "fit") {
      return fitPreviewScale;
    }
    if (previewZoomMode === "step-1") {
      return fitPreviewScale + (1 - fitPreviewScale) / 4;
    }
    if (previewZoomMode === "step-2") {
      return fitPreviewScale + ((1 - fitPreviewScale) * 2) / 4;
    }
    if (previewZoomMode === "step-3") {
      return fitPreviewScale + ((1 - fitPreviewScale) * 3) / 4;
    }
    return 1;
  }, [compileMap, fitPreviewScale, previewZoomMode]);
  const previewRenderTileSize = compileMap
    ? Math.min(
        compileMap.finalAtlas.tileSize,
        Math.max(
          previewTileSize,
          previewZoomMode === "full"
            ? compileMap.finalAtlas.tileSize
            : Math.floor(compileMap.finalAtlas.tileSize * previewDisplayScale),
        ),
      )
    : previewTileSize;
  const previewRenderedPixelWidth = compileMap
    ? compileMap.finalAtlas.columns * previewRenderTileSize
    : 0;
  const previewRenderedPixelHeight = compileMap
    ? compileMap.finalAtlas.rows * previewRenderTileSize
    : 0;
  const previewZoomOptions = useMemo(
    () =>
      previewZoomModes.map((mode) => {
        if (mode === "fit") {
          return { mode, label: "Fit" };
        }
        if (mode === "full") {
          return { mode, label: "1:1" };
        }
        const step =
          mode === "step-1"
            ? 1
            : mode === "step-2"
              ? 2
              : 3;
        const scale = fitPreviewScale + ((1 - fitPreviewScale) * step) / 4;
        return {
          mode,
          label: `${Math.max(1, Math.round(scale * 100))}%`,
        };
      }),
    [fitPreviewScale],
  );
  const previewCanvasStyle = useMemo(() => {
    if (!compileMap) {
      return {
        width: "100%",
        height: "auto",
      };
    }
    return {
      width: `${previewRenderedPixelWidth}px`,
      height: `${previewRenderedPixelHeight}px`,
      maxWidth: "none",
    };
  }, [compileMap, previewRenderedPixelHeight, previewRenderedPixelWidth]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !compileMap) {
      return;
    }
    drawCompiledTileset({
      canvas,
      compileMap,
      selectedImages,
      selectedOffsets,
      selectedCropInsets,
      batchImages,
      tileSize: previewRenderTileSize,
    });
  }, [
    batchImages,
    compileMap,
    previewRenderTileSize,
    selectedCropInsets,
    selectedImages,
    selectedOffsets,
  ]);

  const addImagesToBatch = useCallback((sheetIndex: number, files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(isImageFile);
    if (imageFiles.length <= 0) {
      return;
    }

    const nextImages = imageFiles.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      const id = createImageId(sheetIndex, file);
      const createdAt = Date.now();
      const image = createBatchImageState({
        sheetIndex,
        id,
        name: file.name,
        url,
        mimeType: file.type || "application/octet-stream",
        width: 0,
        height: 0,
        createdAt,
        updatedAt: createdAt,
      });
      void savePersistedTilesetBatchPickerImage({
        id,
        batchIndex: sheetIndex,
        name: file.name,
        width: 0,
        height: 0,
        mimeType: file.type || "application/octet-stream",
        createdAt,
        updatedAt: createdAt,
        blob: file,
      }).catch((error) => {
        console.warn("Failed to persist batch picker image:", error);
      });
      return image;
    });

    setBatchImages((current) => ({
      ...current,
      [sheetIndex]: [...(current[sheetIndex] ?? []), ...nextImages],
    }));
  }, [createBatchImageState]);

  const removeBatchImage = useCallback((sheetIndex: number, imageId: string) => {
    setBatchImages((current) => {
      const nextBatchImages = (current[sheetIndex] ?? []).filter((image) => {
        if (image.id === imageId) {
          URL.revokeObjectURL(image.url);
          objectUrlsRef.current.delete(image.url);
          return false;
        }
        return true;
      });
      return {
        ...current,
        [sheetIndex]: nextBatchImages,
      };
    });
    setSelectedImages((current) => {
      const nextSelectedImages = { ...current };
      for (const [generatedIndex, selectedImageId] of Object.entries(current)) {
        if (selectedImageId === imageId) {
          delete nextSelectedImages[Number(generatedIndex)];
        }
      }
      return nextSelectedImages;
    });
    setBackgroundRemovalByImageId((current) => {
      if (!current[imageId]) {
        return current;
      }
      const nextSettings = { ...current };
      delete nextSettings[imageId];
      return nextSettings;
    });
    batchSheetRefs.current[imageId] = null;
    if (visibleSheetImageIdRef.current === imageId) {
      visibleSheetImageIdRef.current = null;
    }
    setModeSwitchAnchorImageId((current) => (current === imageId ? null : current));
    void deletePersistedTilesetBatchPickerImage(imageId).catch((error) => {
      console.warn("Failed to delete persisted batch picker image:", error);
    });
  }, []);

  const resetImagePositions = useCallback((imageId: string) => {
    const selectedGeneratedIndexes = new Set<number>();
    for (const [generatedIndex, selectedImageId] of Object.entries(
      selectedImages,
    )) {
      if (selectedImageId === imageId) {
        selectedGeneratedIndexes.add(Number(generatedIndex));
      }
    }
    if (selectedGeneratedIndexes.size <= 0) {
      return;
    }

    setSelectedOffsets((current) => {
      let didChange = false;
      const nextOffsets = { ...current };
      for (const generatedIndex of selectedGeneratedIndexes) {
        if (generatedIndex in nextOffsets) {
          delete nextOffsets[generatedIndex];
          didChange = true;
        }
      }
      return didChange ? nextOffsets : current;
    });

    setSelectedCropInsets((current) => {
      let didChange = false;
      const nextCropInsets = { ...current };
      for (const generatedIndex of selectedGeneratedIndexes) {
        if (generatedIndex in nextCropInsets) {
          delete nextCropInsets[generatedIndex];
          didChange = true;
        }
      }
      return didChange ? nextCropInsets : current;
    });
  }, [selectedImages]);

  const handleMapFiles = useCallback(
    async (files: FileList | File[]) => {
      const mapFile = Array.from(files).find((file) =>
        file.name.toLowerCase().endsWith(".json"),
      );
      if (!mapFile) {
        return;
      }
      try {
        const json = JSON.parse(await mapFile.text());
        if (!isCompileMap(json)) {
          throw new Error("Invalid compile map");
        }
        applyCompileMap(json, mapFile.name);
      } catch {
        setMapStatus("Invalid map");
      }
    },
    [applyCompileMap],
  );

  const selectTile = useCallback(
    (sheetIndex: number, tileIndex: number, imageId: string) => {
      if (!compileMap) {
        return;
      }
      const generatedIndex = getGeneratedIndexForCell(
        compileMap,
        sheetIndex,
        tileIndex,
      );
      if (generatedIndex >= compileMap.generatedTileCount) {
        return;
      }
      setSelectedImages((current) => ({
        ...current,
        [generatedIndex]: imageId,
      }));
    },
    [compileMap],
  );

  const beginAdjustmentDrag = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      generatedIndex: number,
      imageId: string,
      mode: ActiveAdjustmentDrag["mode"],
      sourceTileWidth: number,
      sourceTileHeight: number,
    ) => {
      if (selectedImages[generatedIndex] !== imageId) {
        return;
      }
      const cellBounds = event.currentTarget.getBoundingClientRect();
      const currentOffset = selectedOffsets[generatedIndex] ?? { x: 0, y: 0 };
      const currentCropInsets =
        selectedCropInsets[generatedIndex] ?? getDefaultCropInsets();
      activeAdjustmentDragRef.current = {
        generatedIndex,
        imageId,
        mode,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOffsetX: currentOffset.x,
        startOffsetY: currentOffset.y,
        startCropLeft: currentCropInsets.left,
        startCropRight: currentCropInsets.right,
        startCropTop: currentCropInsets.top,
        startCropBottom: currentCropInsets.bottom,
        cellWidth: Math.max(1, cellBounds.width),
        cellHeight: Math.max(1, cellBounds.height),
        sourceTileWidth: Math.max(1, sourceTileWidth),
        sourceTileHeight: Math.max(1, sourceTileHeight),
        moved: false,
      };
      setActiveDraggedGeneratedIndex(generatedIndex);
      event.preventDefault();
    },
    [selectedCropInsets, selectedImages, selectedOffsets],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent): void => {
      const activeDrag = activeAdjustmentDragRef.current;
      if (!activeDrag) {
        return;
      }

      const deltaX =
        (event.clientX - activeDrag.startClientX) / activeDrag.sourceTileWidth;
      const deltaY =
        (event.clientY - activeDrag.startClientY) / activeDrag.sourceTileHeight;
      if (
        !activeDrag.moved &&
        (Math.abs(event.clientX - activeDrag.startClientX) >= dragThresholdPx ||
          Math.abs(event.clientY - activeDrag.startClientY) >= dragThresholdPx)
      ) {
        activeDrag.moved = true;
      }

      if (activeDrag.mode === "offset") {
        setSelectedOffsets((current) => ({
          ...current,
          [activeDrag.generatedIndex]: {
            x: clampSelectionOffset(activeDrag.startOffsetX + deltaX),
            y: clampSelectionOffset(activeDrag.startOffsetY + deltaY),
          },
        }));
        return;
      }

      setSelectedCropInsets((current) => {
        const previous =
          current[activeDrag.generatedIndex] ?? getDefaultCropInsets();
        let nextCropInsets = previous;
        if (activeDrag.mode === "left") {
          nextCropInsets = {
            ...previous,
            left: clampCropInset(
              activeDrag.startCropLeft + deltaX,
              activeDrag.startCropRight,
            ),
          };
        } else if (activeDrag.mode === "right") {
          nextCropInsets = {
            ...previous,
            right: clampCropInset(
              activeDrag.startCropRight - deltaX,
              activeDrag.startCropLeft,
            ),
          };
        } else if (activeDrag.mode === "top") {
          nextCropInsets = {
            ...previous,
            top: clampCropInset(
              activeDrag.startCropTop + deltaY,
              activeDrag.startCropBottom,
            ),
          };
        } else if (activeDrag.mode === "bottom") {
          nextCropInsets = {
            ...previous,
            bottom: clampCropInset(
              activeDrag.startCropBottom - deltaY,
              activeDrag.startCropTop,
            ),
          };
        }
        return {
          ...current,
          [activeDrag.generatedIndex]: nextCropInsets,
        };
      });
    };

    const endPointerDrag = (): void => {
      if (!activeAdjustmentDragRef.current) {
        return;
      }
      activeAdjustmentDragRef.current = null;
      setActiveDraggedGeneratedIndex(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endPointerDrag);
    window.addEventListener("pointercancel", endPointerDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endPointerDrag);
      window.removeEventListener("pointercancel", endPointerDrag);
    };
  }, []);

  const setBackgroundRemovalTolerance = useCallback(
    (imageId: string, tolerance: number) => {
      setBackgroundRemovalByImageId((current) => {
        const previous = current[imageId] ?? getDefaultBackgroundRemovalSettings();
        return {
          ...current,
          [imageId]: {
            ...previous,
            tolerance: Math.max(0, Math.min(255, Math.round(tolerance))),
          },
        };
      });
    },
    [],
  );

  const setBackgroundRemovalEdgeSoftness = useCallback(
    (imageId: string, edgeSoftness: number) => {
      setBackgroundRemovalByImageId((current) => {
        const previous = current[imageId] ?? getDefaultBackgroundRemovalSettings();
        return {
          ...current,
          [imageId]: {
            ...previous,
            edgeSoftness: Math.max(0, Math.min(100, Math.round(edgeSoftness))),
          },
        };
      });
    },
    [],
  );

  const setBackgroundRemovalMatteFalloff = useCallback(
    (imageId: string, matteFalloff: number) => {
      setBackgroundRemovalByImageId((current) => {
        const previous = current[imageId] ?? getDefaultBackgroundRemovalSettings();
        return {
          ...current,
          [imageId]: {
            ...previous,
            matteFalloff: Math.max(
              0,
              Math.min(100, Math.round(matteFalloff)),
            ),
          },
        };
      });
    },
    [],
  );

  const setBackgroundRemovalUnmixStrength = useCallback(
    (imageId: string, unmixStrength: number) => {
      setBackgroundRemovalByImageId((current) => {
        const previous = current[imageId] ?? getDefaultBackgroundRemovalSettings();
        return {
          ...current,
          [imageId]: {
            ...previous,
            unmixStrength: Math.max(
              0,
              Math.min(100, Math.round(unmixStrength)),
            ),
          },
        };
      });
    },
    [],
  );

  const setBackgroundRemovalScreenColorMode = useCallback(
    (imageId: string, screenColorMode: BackgroundRemovalScreenColorMode) => {
      setBackgroundRemovalByImageId((current) => {
        const previous = current[imageId] ?? getDefaultBackgroundRemovalSettings();
        return {
          ...current,
          [imageId]: {
            ...previous,
            screenColorMode:
              normalizeBackgroundRemovalScreenColorMode(screenColorMode),
          },
        };
      });
    },
    [],
  );

  const setBackgroundRemovalEdgeSpillRange = useCallback(
    (imageId: string, edgeSpillRange: number) => {
      setBackgroundRemovalByImageId((current) => {
        const previous = current[imageId] ?? getDefaultBackgroundRemovalSettings();
        return {
          ...current,
          [imageId]: {
            ...previous,
            edgeSpillRange: Math.max(
              0,
              Math.min(64, Math.round(edgeSpillRange)),
            ),
          },
        };
      });
    },
    [],
  );

  const setBackgroundRemovalEdgeSpillStrength = useCallback(
    (imageId: string, edgeSpillStrength: number) => {
      setBackgroundRemovalByImageId((current) => {
        const previous = current[imageId] ?? getDefaultBackgroundRemovalSettings();
        return {
          ...current,
          [imageId]: {
            ...previous,
            edgeSpillStrength: Math.max(
              0,
              Math.min(100, Math.round(edgeSpillStrength)),
            ),
          },
        };
      });
    },
    [],
  );

  const setBackgroundRemovalSpillLimitMode = useCallback(
    (imageId: string, spillLimitMode: BackgroundRemovalSpillLimitMode) => {
      setBackgroundRemovalByImageId((current) => {
        const previous = current[imageId] ?? getDefaultBackgroundRemovalSettings();
        return {
          ...current,
          [imageId]: {
            ...previous,
            spillLimitMode:
              normalizeBackgroundRemovalSpillLimitMode(spillLimitMode),
          },
        };
      });
    },
    [],
  );

  const setBackgroundRemovalEdgeDesaturation = useCallback(
    (imageId: string, edgeDesaturation: number) => {
      setBackgroundRemovalByImageId((current) => {
        const previous = current[imageId] ?? getDefaultBackgroundRemovalSettings();
        return {
          ...current,
          [imageId]: {
            ...previous,
            edgeDesaturation: Math.max(
              0,
              Math.min(100, Math.round(edgeDesaturation)),
            ),
          },
        };
      });
    },
    [],
  );

  const setBackgroundRemovalNonContiguous = useCallback(
    (imageId: string, nonContiguous: boolean) => {
      setBackgroundRemovalByImageId((current) => {
        const previous = current[imageId] ?? getDefaultBackgroundRemovalSettings();
        return {
          ...current,
          [imageId]: {
            ...previous,
            nonContiguous,
          },
        };
      });
    },
    [],
  );

  const sampleBackgroundRemovalSeed = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, uploadedImage: UploadedBatchImage) => {
      if (!uploadedImage.image || uploadedImage.width <= 0 || uploadedImage.height <= 0) {
        return;
      }
      const frameBounds = event.currentTarget.getBoundingClientRect();
      if (frameBounds.width <= 0 || frameBounds.height <= 0) {
        return;
      }

  const sample = sampleImagePixel(
        uploadedImage.image,
        ((event.clientX - frameBounds.left) / frameBounds.width) * uploadedImage.width,
        ((event.clientY - frameBounds.top) / frameBounds.height) * uploadedImage.height,
      );
      if (!sample) {
        return;
      }

      setBackgroundRemovalByImageId((current) => {
        const previous = current[uploadedImage.id] ?? getDefaultBackgroundRemovalSettings();
        const nextSeed: PersistedTilesetBatchPickerRemovalSeed = {
          ...sample,
          nonContiguous: previous.nonContiguous,
        };
        return {
          ...current,
          [uploadedImage.id]: {
            ...previous,
            seeds: [...previous.seeds, nextSeed],
          },
        };
      });
    },
    [],
  );

  const undoBackgroundRemovalSeed = useCallback((imageId: string) => {
    setBackgroundRemovalByImageId((current) => {
      const previous = current[imageId];
      if (!previous || previous.seeds.length <= 0) {
        return current;
      }

      const nextSeeds = previous.seeds.slice(0, -1);
      if (
        nextSeeds.length <= 0 &&
        previous.tolerance === defaultBackgroundRemovalTolerance &&
        previous.edgeSoftness === defaultBackgroundRemovalEdgeSoftness &&
        previous.matteFalloff === defaultBackgroundRemovalMatteFalloff &&
        previous.unmixStrength === defaultBackgroundRemovalUnmixStrength &&
        previous.screenColorMode === defaultBackgroundRemovalScreenColorMode &&
        previous.edgeSpillRange === defaultBackgroundRemovalEdgeSpillRange &&
        previous.edgeSpillStrength ===
          defaultBackgroundRemovalEdgeSpillStrength &&
        previous.spillLimitMode === defaultBackgroundRemovalSpillLimitMode &&
        previous.edgeDesaturation === defaultBackgroundRemovalEdgeDesaturation &&
        previous.nonContiguous === false
      ) {
        const nextSettings = { ...current };
        delete nextSettings[imageId];
        return nextSettings;
      }

      return {
        ...current,
        [imageId]: {
          ...previous,
          seeds: nextSeeds,
        },
      };
    });
  }, []);

  const clearBackgroundRemoval = useCallback((imageId: string) => {
    setBackgroundRemovalByImageId((current) => {
      if (!current[imageId]) {
        return current;
      }
      const nextSettings = { ...current };
      delete nextSettings[imageId];
      return nextSettings;
    });
  }, []);

  const removeBackgroundRemovalSeed = useCallback(
    (imageId: string, seedIndex: number) => {
      setBackgroundRemovalByImageId((current) => {
        const previous = current[imageId];
        if (
          !previous ||
          seedIndex < 0 ||
          seedIndex >= previous.seeds.length
        ) {
          return current;
        }

        const nextSeeds = previous.seeds.filter(
          (_, index) => index !== seedIndex,
        );
        if (
          nextSeeds.length <= 0 &&
          previous.tolerance === defaultBackgroundRemovalTolerance &&
          previous.edgeSoftness === defaultBackgroundRemovalEdgeSoftness &&
          previous.matteFalloff === defaultBackgroundRemovalMatteFalloff &&
          previous.unmixStrength === defaultBackgroundRemovalUnmixStrength &&
          previous.screenColorMode === defaultBackgroundRemovalScreenColorMode &&
          previous.edgeSpillRange === defaultBackgroundRemovalEdgeSpillRange &&
          previous.edgeSpillStrength ===
            defaultBackgroundRemovalEdgeSpillStrength &&
          previous.spillLimitMode === defaultBackgroundRemovalSpillLimitMode &&
          previous.edgeDesaturation === defaultBackgroundRemovalEdgeDesaturation &&
          previous.nonContiguous === false
        ) {
          const nextSettings = { ...current };
          delete nextSettings[imageId];
          return nextSettings;
        }

        return {
          ...current,
          [imageId]: {
            ...previous,
            seeds: nextSeeds,
          },
        };
      });
    },
    [],
  );

  const updateBackgroundRemovalZoom = useCallback(
    (
      event: React.PointerEvent<HTMLButtonElement>,
      uploadedImage: UploadedBatchImage,
    ) => {
      if (!uploadedImage.isReady || uploadedImage.width <= 0 || uploadedImage.height <= 0) {
        setActivePixelZoom(null);
        return;
      }

      const frameBounds = event.currentTarget.getBoundingClientRect();
      if (frameBounds.width <= 0 || frameBounds.height <= 0) {
        setActivePixelZoom(null);
        return;
      }

      const frameX = event.clientX - frameBounds.left;
      const frameY = event.clientY - frameBounds.top;
      const sourceX = (frameX / frameBounds.width) * uploadedImage.width;
      const sourceY = (frameY / frameBounds.height) * uploadedImage.height;
      const pixel = sampleDisplayedPixel(uploadedImage, sourceX, sourceY);
      if (!pixel) {
        setActivePixelZoom(null);
        return;
      }

      setActivePixelZoom({
        imageId: uploadedImage.id,
        frameX,
        frameY,
        frameWidth: frameBounds.width,
        frameHeight: frameBounds.height,
        pixel,
      });
    },
    [],
  );

  const exportCompiledPng = useCallback(() => {
    if (!compileMap) {
      return;
    }
    setExportStatus("Rendering");
    window.setTimeout(() => {
      try {
        const canvas = document.createElement("canvas");
        drawCompiledTileset({
          canvas,
          compileMap,
          selectedImages,
          selectedOffsets,
          selectedCropInsets,
          batchImages,
          tileSize: compileMap.finalAtlas.tileSize,
        });
        canvas.toBlob((blob) => {
          if (!blob) {
            setExportStatus("Export failed");
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "ai-nethack-5-tileset.png";
          link.click();
          URL.revokeObjectURL(url);
          setExportStatus("Exported");
        }, "image/png");
      } catch {
        setExportStatus("Export failed");
      }
    }, 0);
  }, [
    batchImages,
    compileMap,
    selectedCropInsets,
    selectedImages,
    selectedOffsets,
  ]);

  const renderBatchSheet = (
    sheetIndex: number,
    uploadedImage: UploadedBatchImage,
  ): JSX.Element => {
    const removalSettings =
      backgroundRemovalByImageId[uploadedImage.id] ??
      getDefaultBackgroundRemovalSettings();
    const lastRemovalSeed =
      removalSettings.seeds.length > 0
        ? removalSettings.seeds[removalSettings.seeds.length - 1]
        : null;
    const removalSeedCounts = getBackgroundRemovalSeedCounts(
      removalSettings.seeds,
    );
    const hasAdjustedPositions = Object.entries(selectedImages).some(
      ([generatedIndex, selectedImageId]) => {
        if (selectedImageId !== uploadedImage.id) {
          return false;
        }
        return (
          selectedOffsets[Number(generatedIndex)] !== undefined ||
          selectedCropInsets[Number(generatedIndex)] !== undefined
        );
      },
    );
    const isZoomingThisSheet = activePixelZoom?.imageId === uploadedImage.id;
    const backgroundRemovalWidth =
      uploadedImage.width > 0
        ? uploadedImage.width
        : (compileMap?.promptSheets.columns ?? 6) *
          (compileMap?.promptSheets.tileSize ?? 256);
    const backgroundRemovalHeight =
      uploadedImage.height > 0
        ? uploadedImage.height
        : (compileMap?.promptSheets.rows ?? 4) *
          (compileMap?.promptSheets.tileSize ?? 256);
    const sourceTileWidth = compileMap
      ? uploadedImage.width > 0
        ? uploadedImage.width / compileMap.promptSheets.columns
        : compileMap.promptSheets.tileSize
      : 1;
    const sourceTileHeight = compileMap
      ? uploadedImage.height > 0
        ? uploadedImage.height / compileMap.promptSheets.rows
        : compileMap.promptSheets.tileSize
      : 1;
    const cells = Array.from({ length: sheetTileCount }, (_, tileIndex) => {
      if (!compileMap) {
        return null;
      }
      const generatedIndex = getGeneratedIndexForCell(
        compileMap,
        sheetIndex,
        tileIndex,
      );
      const isAvailable = generatedIndex < compileMap.generatedTileCount;
      const selectedImageId = selectedImages[generatedIndex];
      const isSelected = selectedImageId === uploadedImage.id;
      const isSelectedElsewhere = !!selectedImageId && !isSelected;
      const selectedOffset = selectedOffsets[generatedIndex] ?? { x: 0, y: 0 };
      const selectedCrop = selectedCropInsets[generatedIndex] ?? getDefaultCropInsets();
      const hasOffset = selectedOffset.x !== 0 || selectedOffset.y !== 0;
      const hasCropInsets =
        selectedCrop.left !== 0 ||
        selectedCrop.right !== 0 ||
        selectedCrop.top !== 0 ||
        selectedCrop.bottom !== 0;
      const isDraggingOffset = activeDraggedGeneratedIndex === generatedIndex;
      const subject = compileMap.generatedTiles[generatedIndex]?.subject ?? "";
      return (
        <button
          aria-label={`${isSelected ? "Adjust" : "Select"} ${subject || `tile ${tileIndex + 1}`} from ${uploadedImage.name}`}
          className={[
            "tileset-batch-picker__cell",
            isSelected ? "tileset-batch-picker__cell--selected" : "",
            isSelected ? "tileset-batch-picker__cell--draggable" : "",
            hasOffset || hasCropInsets ? "tileset-batch-picker__cell--offset" : "",
            isDraggingOffset ? "tileset-batch-picker__cell--dragging" : "",
            isSelectedElsewhere
              ? "tileset-batch-picker__cell--selected-elsewhere"
              : "",
            !isAvailable ? "tileset-batch-picker__cell--disabled" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          disabled={!isAvailable}
          key={tileIndex}
          onClick={() => selectTile(sheetIndex, tileIndex, uploadedImage.id)}
          onPointerDown={(event) =>
            beginAdjustmentDrag(
              event,
              generatedIndex,
              uploadedImage.id,
              "offset",
              sourceTileWidth,
              sourceTileHeight,
            )
          }
          style={{
            left: `${(tileIndex % compileMap.promptSheets.columns) * (100 / compileMap.promptSheets.columns)}%`,
            top: `${Math.floor(tileIndex / compileMap.promptSheets.columns) * (100 / compileMap.promptSheets.rows)}%`,
            width: `${100 / compileMap.promptSheets.columns}%`,
            height: `${100 / compileMap.promptSheets.rows}%`,
          }}
          title={
            isSelected
              ? `${subject} | drag to nudge crop`
              : subject
          }
          type="button"
        >
          {isSelected ? (
            <span className="tileset-batch-picker__cell-offset-frame">
              <span
                className="tileset-batch-picker__cell-offset-body"
                style={{
                  left: `${(selectedOffset.x + selectedCrop.left) * 100}%`,
                  right: `${(selectedCrop.right - selectedOffset.x) * 100}%`,
                  top: `${(selectedOffset.y + selectedCrop.top) * 100}%`,
                  bottom: `${(selectedCrop.bottom - selectedOffset.y) * 100}%`,
                }}
              >
                <span
                  className="tileset-batch-picker__cell-offset-handle tileset-batch-picker__cell-offset-handle--left"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    beginAdjustmentDrag(
                      event,
                      generatedIndex,
                      uploadedImage.id,
                      "left",
                      sourceTileWidth,
                      sourceTileHeight,
                    );
                  }}
                />
                <span
                  className="tileset-batch-picker__cell-offset-handle tileset-batch-picker__cell-offset-handle--right"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    beginAdjustmentDrag(
                      event,
                      generatedIndex,
                      uploadedImage.id,
                      "right",
                      sourceTileWidth,
                      sourceTileHeight,
                    );
                  }}
                />
                <span
                  className="tileset-batch-picker__cell-offset-handle tileset-batch-picker__cell-offset-handle--top"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    beginAdjustmentDrag(
                      event,
                      generatedIndex,
                      uploadedImage.id,
                      "top",
                      sourceTileWidth,
                      sourceTileHeight,
                    );
                  }}
                />
                <span
                  className="tileset-batch-picker__cell-offset-handle tileset-batch-picker__cell-offset-handle--bottom"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    beginAdjustmentDrag(
                      event,
                      generatedIndex,
                      uploadedImage.id,
                      "bottom",
                      sourceTileWidth,
                      sourceTileHeight,
                    );
                  }}
                />
              </span>
            </span>
          ) : null}
        </button>
      );
    });

    return (
      <div
        className="tileset-batch-picker__sheet"
        key={uploadedImage.id}
        ref={(element) => {
          batchSheetRefs.current[uploadedImage.id] = element;
        }}
      >
        <div className="tileset-batch-picker__sheet-header">
          <span>{uploadedImage.name}</span>
          <div className="tileset-batch-picker__sheet-header-actions">
            {editorMode === "arrange" ? (
              <button
                className="tileset-batch-picker__small-button"
                disabled={!hasAdjustedPositions}
                onClick={() => resetImagePositions(uploadedImage.id)}
                type="button"
              >
                Reset positions
              </button>
            ) : null}
            <button
              className="tileset-batch-picker__small-button"
              onClick={() => removeBatchImage(sheetIndex, uploadedImage.id)}
              type="button"
            >
              Remove
            </button>
          </div>
        </div>
        {editorMode === "background-remove" ? (
          <div className="tileset-batch-picker__sheet-controls">
            <label className="tileset-batch-picker__sheet-slider">
              <span>Fuzzy range: {removalSettings.tolerance}</span>
              <input
                max={255}
                min={0}
                onChange={(event) => {
                  setBackgroundRemovalTolerance(
                    uploadedImage.id,
                    Number(event.target.value),
                  );
                }}
                type="range"
                value={removalSettings.tolerance}
              />
            </label>
            <label className="tileset-batch-picker__sheet-slider">
              <span>Screen color</span>
              <select
                className="tileset-batch-picker__sheet-select"
                onChange={(event) => {
                  setBackgroundRemovalScreenColorMode(
                    uploadedImage.id,
                    event.target.value as BackgroundRemovalScreenColorMode,
                  );
                }}
                value={removalSettings.screenColorMode}
              >
                <option value="auto">Auto</option>
                <option value="green">Green</option>
                <option value="blue">Blue</option>
                <option value="red">Red</option>
              </select>
            </label>
            <label className="tileset-batch-picker__sheet-slider">
              <span>Matte falloff: {removalSettings.matteFalloff}</span>
              <input
                max={100}
                min={0}
                onChange={(event) => {
                  setBackgroundRemovalMatteFalloff(
                    uploadedImage.id,
                    Number(event.target.value),
                  );
                }}
                type="range"
                value={removalSettings.matteFalloff}
              />
            </label>
            <label className="tileset-batch-picker__sheet-slider">
              <span>Screen unmix: {removalSettings.unmixStrength}</span>
              <input
                max={100}
                min={0}
                onChange={(event) => {
                  setBackgroundRemovalUnmixStrength(
                    uploadedImage.id,
                    Number(event.target.value),
                  );
                }}
                type="range"
                value={removalSettings.unmixStrength}
              />
            </label>
            <label className="tileset-batch-picker__sheet-slider">
              <span>Edge smoothing: {removalSettings.edgeSoftness}</span>
              <input
                max={100}
                min={0}
                onChange={(event) => {
                  setBackgroundRemovalEdgeSoftness(
                    uploadedImage.id,
                    Number(event.target.value),
                  );
                }}
                type="range"
                value={removalSettings.edgeSoftness}
              />
            </label>
            <label className="tileset-batch-picker__sheet-slider">
              <span>Edge spill range: {removalSettings.edgeSpillRange}px</span>
              <input
                max={64}
                min={0}
                onChange={(event) => {
                  setBackgroundRemovalEdgeSpillRange(
                    uploadedImage.id,
                    Number(event.target.value),
                  );
                }}
                type="range"
                value={removalSettings.edgeSpillRange}
              />
            </label>
            <label className="tileset-batch-picker__sheet-slider">
              <span>Edge spill cleanup: {removalSettings.edgeSpillStrength}</span>
              <input
                max={100}
                min={0}
                onChange={(event) => {
                  setBackgroundRemovalEdgeSpillStrength(
                    uploadedImage.id,
                    Number(event.target.value),
                  );
                }}
                type="range"
                value={removalSettings.edgeSpillStrength}
              />
            </label>
            <label className="tileset-batch-picker__sheet-slider">
              <span>Spill limit</span>
              <select
                className="tileset-batch-picker__sheet-select"
                onChange={(event) => {
                  setBackgroundRemovalSpillLimitMode(
                    uploadedImage.id,
                    event.target.value as BackgroundRemovalSpillLimitMode,
                  );
                }}
                value={removalSettings.spillLimitMode}
              >
                <option value="average">Average</option>
                <option value="max">Max</option>
              </select>
            </label>
            <label className="tileset-batch-picker__sheet-slider">
              <span>Edge desaturation: {removalSettings.edgeDesaturation}</span>
              <input
                max={100}
                min={0}
                onChange={(event) => {
                  setBackgroundRemovalEdgeDesaturation(
                    uploadedImage.id,
                    Number(event.target.value),
                  );
                }}
                type="range"
                value={removalSettings.edgeDesaturation}
              />
            </label>
            <div className="tileset-batch-picker__removal-mode-toggle">
              <button
                className={[
                  "tileset-batch-picker__removal-mode-button",
                  !removalSettings.nonContiguous
                    ? "tileset-batch-picker__removal-mode-button--active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() =>
                  setBackgroundRemovalNonContiguous(uploadedImage.id, false)
                }
                type="button"
              >
                Contiguous
              </button>
              <button
                className={[
                  "tileset-batch-picker__removal-mode-button",
                  removalSettings.nonContiguous
                    ? "tileset-batch-picker__removal-mode-button--active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() =>
                  setBackgroundRemovalNonContiguous(uploadedImage.id, true)
                }
                type="button"
              >
                Everywhere
              </button>
            </div>
            <div className="tileset-batch-picker__sheet-removal-meta">
              <span className="tileset-batch-picker__sheet-color">
                <span
                  className="tileset-batch-picker__sheet-color-swatch"
                  style={{
                    backgroundColor: lastRemovalSeed
                      ? `rgba(${lastRemovalSeed.r}, ${lastRemovalSeed.g}, ${lastRemovalSeed.b}, ${lastRemovalSeed.a / 255})`
                      : "transparent",
                  }}
                />
                {formatPixelColor(lastRemovalSeed)}
              </span>
              <span>{removalSeedCounts.contiguous} contiguous</span>
              <span>{removalSeedCounts.nonContiguous} everywhere</span>
              <button
                className="tileset-batch-picker__small-button"
                disabled={removalSettings.seeds.length <= 0}
                onClick={() => undoBackgroundRemovalSeed(uploadedImage.id)}
                type="button"
              >
                Undo
              </button>
              <button
                className="tileset-batch-picker__small-button"
                disabled={removalSettings.seeds.length <= 0}
                onClick={() => clearBackgroundRemoval(uploadedImage.id)}
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
        <div
          className={[
            "tileset-batch-picker__sheet-frame",
            leftTransparencyTheme === "light"
              ? "tileset-batch-picker__sheet-frame--light"
              : "tileset-batch-picker__sheet-frame--dark",
            editorMode === "background-remove"
              ? "tileset-batch-picker__sheet-frame--background-remove"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            editorMode === "background-remove"
              ? undefined
              : {
                  aspectRatio: `${compileMap?.promptSheets.columns ?? 6} / ${
                    compileMap?.promptSheets.rows ?? 4
                  }`,
                }
          }
        >
          {editorMode === "background-remove" ? (
            <div className="tileset-batch-picker__sheet-frame-scroll">
              <div
                className="tileset-batch-picker__sheet-frame-content"
                style={{
                  width: `${backgroundRemovalWidth}px`,
                  height: `${backgroundRemovalHeight}px`,
                }}
              >
                <SheetPreview pixelPerfect uploadedImage={uploadedImage} />
                <button
                  className="tileset-batch-picker__background-hit-target"
                  disabled={!uploadedImage.isReady}
                  onClick={(event) =>
                    sampleBackgroundRemovalSeed(event, uploadedImage)
                  }
                  onPointerLeave={() => {
                    setActivePixelZoom((current) =>
                      current?.imageId === uploadedImage.id ? null : current,
                    );
                  }}
                  onPointerMove={(event) =>
                    updateBackgroundRemovalZoom(event, uploadedImage)
                  }
                  type="button"
                />
                {isZoomingThisSheet && activePixelZoom ? (
                  <PixelZoomPreview
                    uploadedImage={uploadedImage}
                    zoom={activePixelZoom}
                  />
                ) : null}
                {showBackgroundRemovalPoints ? (
                  <div className="tileset-batch-picker__seed-layer">
                    {removalSettings.seeds.map((seed, seedIndex) =>
                      seed.nonContiguous === removalSettings.nonContiguous ? (
                        <button
                          aria-label={`Remove ${
                            seed.nonContiguous ? "everywhere" : "contiguous"
                          } background point ${seedIndex + 1}`}
                          className={[
                            "tileset-batch-picker__seed-marker",
                            seed.nonContiguous
                              ? "tileset-batch-picker__seed-marker--non-contiguous"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={`${seed.x}-${seed.y}-${seedIndex}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            removeBackgroundRemovalSeed(
                              uploadedImage.id,
                              seedIndex,
                            );
                          }}
                          style={{
                            left: `${(seed.x / Math.max(1, uploadedImage.width)) * 100}%`,
                            top: `${(seed.y / Math.max(1, uploadedImage.height)) * 100}%`,
                          }}
                          type="button"
                        />
                      ) : null,
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <SheetPreview uploadedImage={uploadedImage} />
              <div className="tileset-batch-picker__cell-layer">{cells}</div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderBatch = (sheetIndex: number): JSX.Element => {
    if (!compileMap) {
      throw new Error("Cannot render a batch before the compile map is loaded.");
    }

    const images = batchImages[sheetIndex] ?? [];
    const inputId = `tileset-batch-picker-upload-${sheetIndex}`;
    const batchLabel = formatBatchLabel(sheetIndex);
    const batchPlan = getBatchPlan(compileMap, sheetIndex);
    const batchTileRange = formatBatchTileRange(compileMap, sheetIndex);
    const batchImageLabel =
      images.length === 1 ? "1 image" : `${images.length} images`;

    return (
      <section className="tileset-batch-picker__batch" key={sheetIndex}>
        <div className="tileset-batch-picker__batch-heading">
          <div>
            <h2>{batchLabel}</h2>
            <p>
              {batchTileRange}
              {batchPlan.count > 0
                ? ` | ${batchPlan.count} planned ${batchPlan.count === 1 ? "tile" : "tiles"}`
                : ""}
            </p>
          </div>
          <span>{batchImageLabel}</span>
        </div>
        <label
          className={[
            "tileset-batch-picker__dropzone",
            draggedBatchIndex === sheetIndex
              ? "tileset-batch-picker__dropzone--active"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          htmlFor={inputId}
          onDragEnter={(event) => {
            preventDropDefaults(event);
            setDraggedBatchIndex(sheetIndex);
          }}
          onDragLeave={(event) => {
            preventDropDefaults(event);
            setDraggedBatchIndex(null);
          }}
          onDragOver={preventDropDefaults}
          onDrop={(event) => {
            preventDropDefaults(event);
            setDraggedBatchIndex(null);
            addImagesToBatch(sheetIndex, event.dataTransfer.files);
          }}
        >
          <strong>{`Drop ${batchLabel} images here`}</strong>
          <span>
            {compileMap.promptSheets.columns} x {compileMap.promptSheets.rows} sheet,
            {` ${compileMap.promptSheets.tileSize}px tiles`}
          </span>
          <input
            accept="image/*"
            id={inputId}
            multiple
            onChange={(event) => {
              if (event.target.files) {
                addImagesToBatch(sheetIndex, event.target.files);
                event.target.value = "";
              }
            }}
            type="file"
          />
        </label>
        {batchPlan.count > 0 ? (
          <div className="tileset-batch-picker__batch-subjects">
            <span>{batchPlan.firstSubject}</span>
            {batchPlan.lastSubject && batchPlan.lastSubject !== batchPlan.firstSubject ? (
              <span>{batchPlan.lastSubject}</span>
            ) : null}
          </div>
        ) : null}
        <div className="tileset-batch-picker__sheet-stack">
          {images.length > 0 ? (
            images.map((image) => renderBatchSheet(sheetIndex, image))
          ) : (
            <div className="tileset-batch-picker__empty-batch">
              Waiting for generated batch images.
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <main className="tileset-batch-picker">
      <section className="tileset-batch-picker__workspace">
        <div className="tileset-batch-picker__left">
          <header className="tileset-batch-picker__toolbar">
            <div className="tileset-batch-picker__toolbar-main">
              <div>
                <h1>Tileset Batch Picker</h1>
                <p>{mapLabel}</p>
              </div>
              <label
                className="tileset-batch-picker__map-drop"
                onDragOver={preventDropDefaults}
                onDrop={(event) => {
                  preventDropDefaults(event);
                  void handleMapFiles(event.dataTransfer.files);
                }}
              >
                <span>{mapStatus}</span>
                <input
                  accept="application/json,.json"
                  onChange={(event) => {
                    if (event.target.files) {
                      void handleMapFiles(event.target.files);
                      event.target.value = "";
                    }
                  }}
                  type="file"
                />
              </label>
            </div>
            {compileMap ? (
              <div className="tileset-batch-picker__toolbar-controls">
                <div className="tileset-batch-picker__editor-controls">
                  <div className="tileset-batch-picker__editor-toggle">
                    <button
                      className={[
                        "tileset-batch-picker__editor-toggle-button",
                        editorMode === "arrange"
                          ? "tileset-batch-picker__editor-toggle-button--active"
                          : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      onClick={() => {
                        const anchorImageId =
                          updateVisibleSheetAnchor() ??
                          visibleSheetImageIdRef.current;
                        setModeSwitchAnchorImageId(anchorImageId);
                        setEditorMode("arrange");
                      }}
                      type="button"
                    >
                      Arrange
                    </button>
                    <button
                      className={[
                        "tileset-batch-picker__editor-toggle-button",
                        editorMode === "background-remove"
                          ? "tileset-batch-picker__editor-toggle-button--active"
                          : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      onClick={() => {
                        const anchorImageId =
                          updateVisibleSheetAnchor() ??
                          visibleSheetImageIdRef.current;
                        setModeSwitchAnchorImageId(anchorImageId);
                        setEditorMode("background-remove");
                      }}
                      type="button"
                    >
                      Remove BG
                    </button>
                  </div>
                  <button
                    className="tileset-batch-picker__small-button"
                    onClick={() => {
                      setLeftTransparencyTheme((current) =>
                        current === "dark" ? "light" : "dark",
                      );
                    }}
                    type="button"
                  >
                    Left BG: {leftTransparencyTheme === "dark" ? "Dark" : "Light"}
                  </button>
                  <button
                    className="tileset-batch-picker__small-button"
                    onClick={() => {
                      setShowBackgroundRemovalPoints((current) => !current);
                    }}
                    type="button"
                  >
                    BG Points: {showBackgroundRemovalPoints ? "On" : "Off"}
                  </button>
                </div>
                <p className="tileset-batch-picker__editor-hint">
                  {editorMode === "arrange"
                    ? "Click a tile to assign it, then drag the selected frame to nudge or crop it."
                    : "Click any background area to flood-remove that contiguous color region for just this sheet."}
                </p>
              </div>
            ) : null}
          </header>

          <div className="tileset-batch-picker__batches" ref={batchesViewportRef}>
            {compileMap ? (
              <>
                <div className="tileset-batch-picker__batch-list-header">
                  <div>
                    <h2>NetHack 5 Batch Uploads</h2>
                    <p>
                      {compileMap.promptSheets.sheetCount} planned batches,
                      {` ${compileMap.promptSheets.columns} x ${compileMap.promptSheets.rows} each`}
                    </p>
                  </div>
                </div>
                {Array.from(
                  { length: compileMap.promptSheets.sheetCount },
                  (_, sheetIndex) => renderBatch(sheetIndex),
                )}
              </>
            ) : (
              <div className="tileset-batch-picker__map-placeholder">
                Drop a compile map to show planned batches.
              </div>
            )}
          </div>
        </div>

        <aside className="tileset-batch-picker__right">
          <div className="tileset-batch-picker__summary">
            <div>
              <span>Tiles</span>
              <strong>
                {selectedCount}
                {compileMap ? ` / ${compileMap.generatedTileCount}` : ""}
              </strong>
            </div>
            <div>
              <span>Slots</span>
              <strong>
                {filledFinalSlotCount}
                {compileMap ? ` / ${compileMap.finalSlots.length}` : ""}
              </strong>
            </div>
            <label className="tileset-batch-picker__summary-select">
              <span>Zoom</span>
              <select
                disabled={!compileMap}
                onChange={(event) => {
                  const nextIndex = previewZoomModes.indexOf(
                    event.target.value as PreviewZoomMode,
                  );
                  setPreviewZoomIndex(Math.max(0, nextIndex));
                }}
                value={previewZoomMode}
              >
                {previewZoomOptions.map((option) => (
                  <option key={option.mode} value={option.mode}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="tileset-batch-picker__small-button tileset-batch-picker__zoom-button"
              disabled={!compileMap}
              onClick={() => {
                setShowTransparencyPreview((current) => !current);
              }}
              type="button"
            >
              Alpha: {showTransparencyPreview ? "On" : "Off"}
            </button>
            <button
              className="tileset-batch-picker__export-button"
              disabled={!compileMap || selectedCount <= 0}
              onClick={exportCompiledPng}
              type="button"
            >
              Export PNG
            </button>
          </div>
          {exportStatus ? (
            <div className="tileset-batch-picker__export-status">
              {exportStatus}
            </div>
          ) : null}
          <div className="tileset-batch-picker__preview" ref={previewViewportRef}>
            <div
              className={[
                "tileset-batch-picker__preview-stage",
                showTransparencyPreview
                  ? "tileset-batch-picker__preview-stage--transparency"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className="tileset-batch-picker__preview-frame"
                style={previewCanvasStyle}
              >
                <canvas
                  ref={previewCanvasRef}
                  style={{
                    width: "100%",
                    height: "100%",
                    maxWidth: "none",
                  }}
                />
                {showTransparencyPreview && compileMap ? (
                  <div
                    className="tileset-batch-picker__preview-alpha-grid"
                    style={
                      {
                        "--tileset-batch-picker-preview-tile-size": `${previewRenderTileSize}px`,
                      } as React.CSSProperties
                    }
                  />
                ) : null}
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
