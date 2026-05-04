import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearPersistedTilesetBatchPickerImages,
  clearPersistedTilesetBatchPickerSession,
  deletePersistedTilesetBatchPickerImage,
  loadPersistedTilesetBatchPickerImages,
  loadPersistedTilesetBatchPickerSession,
  savePersistedTilesetBatchPickerImage,
  savePersistedTilesetBatchPickerSession,
  type PersistedTilesetBatchPickerImageMeta,
} from "../storage/tileset-batch-picker-storage";
import "../styles/tileset-batch-picker.scss";

const defaultCompileMapUrl = `${
  import.meta.env.BASE_URL
}assets/tools/nethack-5-ai-tileset-compile-map.json`;
const previewTileSize = 16;
const previewZoomModes = ["fit", "step-1", "step-2", "full"] as const;

type PreviewZoomMode = (typeof previewZoomModes)[number];

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
  isReady: boolean;
  createdAt: number;
  updatedAt: number;
};

type BatchImagesByIndex = Record<number, UploadedBatchImage[]>;
type SelectedImageByGeneratedIndex = Record<number, string>;

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

function getCropRect(
  image: HTMLImageElement,
  placement: GeneratedTilePlacement,
  compileMap: CompileMap,
): { sourceX: number; sourceY: number; sourceWidth: number; sourceHeight: number } {
  const sourceWidth = image.naturalWidth / compileMap.promptSheets.columns;
  const sourceHeight = image.naturalHeight / compileMap.promptSheets.rows;
  return {
    sourceX: placement.sheetColumn * sourceWidth,
    sourceY: placement.sheetRow * sourceHeight,
    sourceWidth,
    sourceHeight,
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
  batchImages,
  tileSize,
}: {
  canvas: HTMLCanvasElement;
  compileMap: CompileMap;
  selectedImages: SelectedImageByGeneratedIndex;
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
  context.fillStyle = "#101419";
  context.fillRect(0, 0, width, height);

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
    const generatedTile = generatedTileByIndex.get(slot.generatedIndex);
    if (!generatedTile) {
      continue;
    }

    const crop = getCropRect(uploadedImage.image, generatedTile, compileMap);
    const targetX = slot.finalColumn * tileSize;
    const targetY = slot.finalRow * tileSize;
    context.drawImage(
      uploadedImage.image,
      crop.sourceX,
      crop.sourceY,
      crop.sourceWidth,
      crop.sourceHeight,
      targetX,
      targetY,
      tileSize,
      tileSize,
    );
    if (slot.operation === "stone-statue") {
      applyStoneTint(context, targetX, targetY, tileSize, tileSize);
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

export default function TilesetBatchPicker(): JSX.Element {
  const [compileMap, setCompileMap] = useState<CompileMap | null>(null);
  const [mapLabel, setMapLabel] = useState("NetHack 5 compile map");
  const [mapStatus, setMapStatus] = useState("Loading");
  const [batchImages, setBatchImages] = useState<BatchImagesByIndex>({});
  const [selectedImages, setSelectedImages] =
    useState<SelectedImageByGeneratedIndex>({});
  const [draggedBatchIndex, setDraggedBatchIndex] = useState<number | null>(
    null,
  );
  const [exportStatus, setExportStatus] = useState("");
  const [previewZoomIndex, setPreviewZoomIndex] = useState(0);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const [previewViewportWidth, setPreviewViewportWidth] = useState(0);

  const resetObjectUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current.clear();
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
            const batchIndex = Number(batchKey);
            restoredBatchImages[batchIndex] = images.flatMap((image) => {
              const persistedImage = persistedImageById[image.id];
              if (!persistedImage) {
                return [];
              }
              restoredImageIds.add(image.id);
              const url = URL.createObjectURL(persistedImage.blob);
              objectUrlsRef.current.add(url);
              return [
                createBatchImageState({
                  sheetIndex: batchIndex,
                  id: image.id,
                  name: image.name,
                  url,
                  mimeType: image.mimeType,
                  width: image.width,
                  height: image.height,
                  createdAt: image.createdAt,
                  updatedAt: image.updatedAt,
                }),
              ];
            });
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
    if (!compileMap) {
      return;
    }
    void savePersistedTilesetBatchPickerSession({
      compileMap,
      mapLabel,
      selectedImages: selectedImages as Record<string, string>,
      batchImages: toPersistedBatchImages(batchImages),
    }).catch((error) => {
      console.warn("Failed to persist batch picker session:", error);
    });
  }, [batchImages, compileMap, mapLabel, selectedImages]);

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
      return fitPreviewScale + (1 - fitPreviewScale) / 3;
    }
    if (previewZoomMode === "step-2") {
      return fitPreviewScale + ((1 - fitPreviewScale) * 2) / 3;
    }
    return 1;
  }, [compileMap, fitPreviewScale, previewZoomMode]);
  const previewZoomLabel =
    previewZoomMode === "fit"
      ? "Fit"
      : previewZoomMode === "full"
        ? "1:1"
        : `${Math.max(1, Math.round(previewDisplayScale * 100))}%`;
  const previewCanvasStyle = useMemo(() => {
    if (!compileMap) {
      return {
        width: "100%",
        height: "auto",
      };
    }
    return {
      width: `${Math.round(finalAtlasPixelWidth * previewDisplayScale)}px`,
      height: `${Math.round(finalAtlasPixelHeight * previewDisplayScale)}px`,
      maxWidth: "none",
    };
  }, [compileMap, finalAtlasPixelHeight, finalAtlasPixelWidth, previewDisplayScale]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !compileMap) {
      return;
    }
    drawCompiledTileset({
      canvas,
      compileMap,
      selectedImages,
      batchImages,
      tileSize: previewTileSize,
    });
  }, [batchImages, compileMap, selectedImages]);

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
    void deletePersistedTilesetBatchPickerImage(imageId).catch((error) => {
      console.warn("Failed to delete persisted batch picker image:", error);
    });
  }, []);

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
  }, [batchImages, compileMap, selectedImages]);

  const renderBatchSheet = (
    sheetIndex: number,
    uploadedImage: UploadedBatchImage,
  ): JSX.Element => {
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
      const subject = compileMap.generatedTiles[generatedIndex]?.subject ?? "";
      return (
        <button
          aria-label={`Select ${subject || `tile ${tileIndex + 1}`} from ${uploadedImage.name}`}
          className={[
            "tileset-batch-picker__cell",
            isSelected ? "tileset-batch-picker__cell--selected" : "",
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
          style={{
            left: `${(tileIndex % compileMap.promptSheets.columns) * (100 / compileMap.promptSheets.columns)}%`,
            top: `${Math.floor(tileIndex / compileMap.promptSheets.columns) * (100 / compileMap.promptSheets.rows)}%`,
            width: `${100 / compileMap.promptSheets.columns}%`,
            height: `${100 / compileMap.promptSheets.rows}%`,
          }}
          title={subject}
          type="button"
        />
      );
    });

    return (
      <div className="tileset-batch-picker__sheet" key={uploadedImage.id}>
        <div className="tileset-batch-picker__sheet-header">
          <span>{uploadedImage.name}</span>
          <button
            className="tileset-batch-picker__small-button"
            onClick={() => removeBatchImage(sheetIndex, uploadedImage.id)}
            type="button"
          >
            Remove
          </button>
        </div>
        <div
          className="tileset-batch-picker__sheet-frame"
          style={{
            aspectRatio: `${compileMap?.promptSheets.columns ?? 6} / ${
              compileMap?.promptSheets.rows ?? 4
            }`,
          }}
        >
          <img alt="" draggable={false} src={uploadedImage.url} />
          <div className="tileset-batch-picker__cell-layer">{cells}</div>
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
          </header>

          <div className="tileset-batch-picker__batches">
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
            <button
              className="tileset-batch-picker__small-button tileset-batch-picker__zoom-button"
              disabled={!compileMap}
              onClick={() => {
                setPreviewZoomIndex(
                  (currentIndex) => (currentIndex + 1) % previewZoomModes.length,
                );
              }}
              type="button"
            >
              Zoom: {previewZoomLabel}
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
            <div className="tileset-batch-picker__preview-stage">
              <canvas ref={previewCanvasRef} style={previewCanvasStyle} />
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
