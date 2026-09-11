import { isLoggingEnabled } from "../../../logging";
import type { EngineState } from "../runtime/engine-state";
import type { PointerLock } from "../input/pointer-lock";
import type { RenderPipeline } from "../rendering/render-pipeline";

export interface FpsDiagnosticsDependencies {
  readonly engineState: Pick<
    EngineState,
    "lastFrameTimeMs"
  >;
  readonly pointerLock: Pick<
    PointerLock,
    "fpsPointerLockActive"
    | "syncFpsPointerLockForUiState"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "renderer"
  >;
}

/** Frame metrics, render rate override and player tile trace logging. */
export class FpsDiagnostics {
  constructor(private readonly dependencies: FpsDiagnosticsDependencies) {}

  readonly asciiPlayerTileDebugLogThrottleMs: number = 120;

  asciiPlayerTileDebugLastLogAtByKey: Map<string, number> = new Map();

  fpsDebugDisplayVisible: boolean = false;

  fpsDebugDisplayElement: HTMLDivElement | null = null;

  fpsDebugDisplayMetricsElement: HTMLDivElement | null = null;

  fpsDebugDisplayOverrideInput: HTMLInputElement | null = null;

  fpsDebugDisplayOverrideFps: number | null = null;

  fpsDebugDisplaySmoothedFps: number | null = null;

  fpsDebugDisplaySmoothedFrameTimeMs: number | null = null;

  fpsDebugDisplaySmoothedRenderTimeMs: number | null = null;

  fpsDebugDisplayLastRenderedSignature: string | null = null;

  readonly fpsDebugDisplaySmoothingFactor: number = 0.16;

  shouldEmitAsciiPlayerTileDebugLog(
    debugKey: string,
    nowMs: number,
  ): boolean {
    if (!isLoggingEnabled()) {
      return false;
    }
    const lastLoggedAtMs =
      this.asciiPlayerTileDebugLastLogAtByKey.get(debugKey) ?? 0;
    if (nowMs - lastLoggedAtMs < this.asciiPlayerTileDebugLogThrottleMs) {
      return false;
    }
    this.asciiPlayerTileDebugLastLogAtByKey.set(debugKey, nowMs);
    if (this.asciiPlayerTileDebugLastLogAtByKey.size > 256) {
      const cutoffMs = nowMs - this.asciiPlayerTileDebugLogThrottleMs * 6;
      for (const [key, loggedAtMs] of this.asciiPlayerTileDebugLastLogAtByKey) {
        if (loggedAtMs < cutoffMs) {
          this.asciiPlayerTileDebugLastLogAtByKey.delete(key);
        }
      }
    }
    return true;
  }

  logAsciiPlayerTileDebug(
    event: string,
    tileX: number,
    tileY: number,
    payload: Record<string, unknown>,
  ): void {
    const nowMs = Date.now();
    const debugKey = `${event}:${tileX},${tileY}`;
    if (!this.shouldEmitAsciiPlayerTileDebugLog(debugKey, nowMs)) {
      return;
    }
    console.log(`[ASCII_PLAYER_TILE_DEBUG] ${event}`, {
      nowMs,
      tileX,
      tileY,
      ...payload,
    });
  }

  handleFpsDebugShortcutKeyDown(event: KeyboardEvent): boolean {
    if (event.metaKey) {
      return false;
    }
    if (!event.ctrlKey || !event.altKey || !event.shiftKey) {
      return false;
    }
    const isFKey =
      event.code === "KeyF" ||
      (typeof event.key === "string" && event.key.toLowerCase() === "f");
    if (!isFKey) {
      return false;
    }

    event.preventDefault();
    if (event.repeat) {
      return true;
    }
    this.setFpsDebugDisplayVisible(!this.fpsDebugDisplayVisible);
    return true;
  }

  ensureFpsDebugDisplayElement(): HTMLDivElement {
    if (this.fpsDebugDisplayElement) {
      return this.fpsDebugDisplayElement;
    }

    const element = document.createElement("div");
    const metrics = document.createElement("div");
    const controls = document.createElement("label");
    const controlsText = document.createElement("span");
    const overrideInput = document.createElement("input");
    element.className = "nh3d-fps-debug-display";
    element.style.position = "fixed";
    element.style.right = "12px";
    element.style.bottom = "12px";
    element.style.display = "none";
    element.style.flexDirection = "column";
    element.style.gap = "6px";
    element.style.padding = "6px 8px";
    element.style.borderRadius = "6px";
    element.style.border = "1px solid rgba(196, 255, 208, 0.45)";
    element.style.background = "rgba(2, 10, 8, 0.82)";
    element.style.color = "#ecfff0";
    element.style.fontFamily =
      "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    element.style.fontSize = "12px";
    element.style.fontWeight = "600";
    element.style.lineHeight = "1.2";
    element.style.letterSpacing = "0.03em";
    element.style.pointerEvents = "auto";
    element.style.userSelect = "text";
    element.style.zIndex = "4200";
    element.style.boxShadow = "0 10px 24px rgba(0, 0, 0, 0.28)";
    element.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    element.addEventListener("pointerup", (event) => {
      event.stopPropagation();
    });
    element.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    element.addEventListener("focusin", () => {
      if (document.pointerLockElement === this.dependencies.renderPipeline.renderer.domElement) {
        document.exitPointerLock?.();
      }
      this.dependencies.pointerLock.fpsPointerLockActive = false;
    });
    element.addEventListener("focusout", () => {
      this.dependencies.pointerLock.syncFpsPointerLockForUiState(true);
    });

    metrics.textContent = this.getFpsDebugDisplayMetricsText();
    metrics.style.whiteSpace = "nowrap";

    controls.style.display = "flex";
    controls.style.alignItems = "center";
    controls.style.gap = "6px";
    controls.style.whiteSpace = "nowrap";
    controls.style.cursor = "text";

    controlsText.textContent = "Override FPS";
    controlsText.style.opacity = "0.88";

    overrideInput.type = "number";
    overrideInput.min = "1";
    overrideInput.max = "240";
    overrideInput.step = "1";
    overrideInput.inputMode = "numeric";
    overrideInput.placeholder = "auto";
    overrideInput.value =
      this.fpsDebugDisplayOverrideFps === null
        ? ""
        : String(this.fpsDebugDisplayOverrideFps);
    overrideInput.style.width = "68px";
    overrideInput.style.padding = "2px 4px";
    overrideInput.style.borderRadius = "4px";
    overrideInput.style.border = "1px solid rgba(196, 255, 208, 0.45)";
    overrideInput.style.background = "rgba(10, 28, 20, 0.96)";
    overrideInput.style.color = "#ecfff0";
    overrideInput.style.font = "inherit";
    overrideInput.style.fontWeight = "600";
    overrideInput.style.letterSpacing = "inherit";
    overrideInput.style.outline = "none";
    overrideInput.title = "Leave blank to use the real frame rate.";
    overrideInput.addEventListener("input", () => {
      this.setFpsDebugDisplayOverrideFpsFromInputValue(overrideInput.value);
    });
    overrideInput.addEventListener("blur", () => {
      this.syncFpsDebugDisplayOverrideInputValue();
    });
    overrideInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        overrideInput.blur();
      }
    });
    overrideInput.addEventListener("keyup", (event) => {
      event.stopPropagation();
    });

    controls.appendChild(controlsText);
    controls.appendChild(overrideInput);
    element.appendChild(metrics);
    element.appendChild(controls);
    document.body.appendChild(element);
    this.fpsDebugDisplayElement = element;
    this.fpsDebugDisplayMetricsElement = metrics;
    this.fpsDebugDisplayOverrideInput = overrideInput;
    return element;
  }

  setFpsDebugDisplayVisible(visible: boolean): void {
    this.fpsDebugDisplayVisible = visible;
    const element = visible
      ? this.ensureFpsDebugDisplayElement()
      : this.fpsDebugDisplayElement;
    if (!element) {
      return;
    }

    element.style.display = visible ? "flex" : "none";
    if (!visible) {
      if (
        document.activeElement instanceof HTMLElement &&
        element.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }
      this.dependencies.pointerLock.syncFpsPointerLockForUiState(true);
      return;
    }
    this.fpsDebugDisplaySmoothedFps = null;
    this.fpsDebugDisplaySmoothedFrameTimeMs = null;
    this.fpsDebugDisplaySmoothedRenderTimeMs = null;
    this.fpsDebugDisplayLastRenderedSignature = null;
    if (this.fpsDebugDisplayMetricsElement) {
      this.fpsDebugDisplayMetricsElement.textContent =
        this.getFpsDebugDisplayMetricsText();
    }
    this.syncFpsDebugDisplayOverrideInputValue();
  }

  getFpsDebugDisplayMetricsText(
    smoothedFps: number | null = null,
    smoothedFrameTimeMs: number | null = null,
    smoothedRenderTimeMs: number | null = null,
  ): string {
    const overrideSuffix =
      this.fpsDebugDisplayOverrideFps === null
        ? ""
        : ` | OVR: ${this.fpsDebugDisplayOverrideFps}`;
    if (
      smoothedFps === null ||
      smoothedFrameTimeMs === null ||
      smoothedRenderTimeMs === null
    ) {
      return `FPS: -- | FT: -- ms | RT: -- ms${overrideSuffix}`;
    }
    return `FPS: ${Math.max(0, Math.round(smoothedFps))} | FT: ${smoothedFrameTimeMs.toFixed(2)} ms | RT: ${smoothedRenderTimeMs.toFixed(2)} ms${overrideSuffix}`;
  }

  syncFpsDebugDisplayOverrideInputValue(): void {
    const input = this.fpsDebugDisplayOverrideInput;
    if (!input) {
      return;
    }
    input.value =
      this.fpsDebugDisplayOverrideFps === null
        ? ""
        : String(this.fpsDebugDisplayOverrideFps);
  }

  setFpsDebugDisplayOverrideFpsFromInputValue(rawValue: string): void {
    const trimmed = String(rawValue || "").trim();
    if (trimmed.length === 0) {
      this.fpsDebugDisplayOverrideFps = null;
      this.fpsDebugDisplayLastRenderedSignature = null;
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return;
    }
    this.fpsDebugDisplayOverrideFps = Math.max(
      1,
      Math.min(240, Math.round(parsed)),
    );
    this.fpsDebugDisplayLastRenderedSignature = null;
  }

  getFpsDebugDisplayOverrideFrameIntervalMs(): number | null {
    const overrideFps = this.fpsDebugDisplayOverrideFps;
    if (
      overrideFps === null ||
      !Number.isFinite(overrideFps) ||
      overrideFps <= 0
    ) {
      return null;
    }
    return 1000 / overrideFps;
  }

  shouldSkipFrameForFpsDebugOverride(timeMs: number): boolean {
    const intervalMs = this.getFpsDebugDisplayOverrideFrameIntervalMs();
    if (intervalMs === null || this.dependencies.engineState.lastFrameTimeMs === null) {
      return false;
    }
    const elapsedMs = timeMs - this.dependencies.engineState.lastFrameTimeMs;
    return elapsedMs < intervalMs - 0.25;
  }

  updateFpsDebugDisplay(
    rawDeltaMs: number,
    renderDurationMs: number,
  ): void {
    if (!this.fpsDebugDisplayVisible || !Number.isFinite(rawDeltaMs)) {
      return;
    }
    if (rawDeltaMs <= 0 || !Number.isFinite(renderDurationMs)) {
      return;
    }
    const metricsElement = this.fpsDebugDisplayMetricsElement;
    if (!metricsElement) {
      return;
    }

    const instantaneousFps = 1000 / rawDeltaMs;
    const previousSmoothed = this.fpsDebugDisplaySmoothedFps;
    const smoothedFps =
      previousSmoothed === null
        ? instantaneousFps
        : previousSmoothed +
          (instantaneousFps - previousSmoothed) *
            this.fpsDebugDisplaySmoothingFactor;
    this.fpsDebugDisplaySmoothedFps = smoothedFps;

    const previousFrameTime = this.fpsDebugDisplaySmoothedFrameTimeMs;
    const smoothedFrameTimeMs =
      previousFrameTime === null
        ? rawDeltaMs
        : previousFrameTime +
          (rawDeltaMs - previousFrameTime) *
            this.fpsDebugDisplaySmoothingFactor;
    this.fpsDebugDisplaySmoothedFrameTimeMs = smoothedFrameTimeMs;

    const previousRenderTime = this.fpsDebugDisplaySmoothedRenderTimeMs;
    const smoothedRenderTimeMs =
      previousRenderTime === null
        ? renderDurationMs
        : previousRenderTime +
          (renderDurationMs - previousRenderTime) *
            this.fpsDebugDisplaySmoothingFactor;
    this.fpsDebugDisplaySmoothedRenderTimeMs = smoothedRenderTimeMs;

    const signature = this.getFpsDebugDisplayMetricsText(
      smoothedFps,
      smoothedFrameTimeMs,
      smoothedRenderTimeMs,
    );
    if (signature === this.fpsDebugDisplayLastRenderedSignature) {
      return;
    }
    this.fpsDebugDisplayLastRenderedSignature = signature;
    metricsElement.textContent = signature;
  }

  removeFpsDebugDisplay(): void {
    this.fpsDebugDisplayElement?.remove();
    this.fpsDebugDisplayElement = null;
    this.fpsDebugDisplayMetricsElement = null;
    this.fpsDebugDisplayOverrideInput = null;
    this.fpsDebugDisplayVisible = false;
    this.fpsDebugDisplaySmoothedFps = null;
    this.fpsDebugDisplaySmoothedFrameTimeMs = null;
    this.fpsDebugDisplaySmoothedRenderTimeMs = null;
    this.fpsDebugDisplayLastRenderedSignature = null;
  }

  isFpsDebugDisplayInputFocused(): boolean {
    const element = this.fpsDebugDisplayElement;
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return Boolean(element && activeElement && element.contains(activeElement));
  }
}
