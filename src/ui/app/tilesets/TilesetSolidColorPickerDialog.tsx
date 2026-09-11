import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent
} from "react";
import {
  createPortal
} from "react-dom";

/** Solid chroma key dialog, color conversion and pixel hover state. */
export type TilesetSolidColorPickerDialogProps = {
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

export type SolidColorPickerHoverState = {
  clientX: number;
  clientY: number;
  sourceX: number;
  sourceY: number;
  hexColor: string;
};

export const defaultSolidChromaKeyHex = "#466d6c";

export function normalizeSolidChromaKeyHex(
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

export function formatSolidChromaKeyHex(rawValue: string): string {
  return normalizeSolidChromaKeyHex(rawValue).toUpperCase();
}

export function rgbToSolidChromaKeyHex(r: number, g: number, b: number): string {
  const toHex = (value: number) =>
    Math.max(0, Math.min(255, Math.trunc(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function TilesetSolidColorPickerDialog({
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
