import * as THREE from "three";
import { type VultureTileLookup } from "../../vulture/translation";
import type {
  VultureWallFaceSlot,
  VultureProjectionDebugFamily,
  VultureDoorProjectionSide,
  VultureWallProjectionCornerId,
  VultureWallProjectionPoint,
  VultureWallProjectionQuad
} from "../shared/types";
import type { EngineState } from "../runtime/engine-state";
import type { TilesetAssets } from "../rendering/tileset-assets";
import type { TileUpdates } from "../world/tile-updates";
import type { VultureProjection } from "../rendering/vulture-projection";

export interface VultureProjectionDebugDependencies {
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
    | "mountElement"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "invalidateTilesetDependentCaches"
    | "shouldUseVultureTiles"
    | "vultureTilesetTranslator"
  >;
  readonly tileUpdates: Pick<
    TileUpdates,
    "refreshTilesFromStateCache"
  >;
  readonly vultureProjection: Pick<
    VultureProjection,
    "createDefaultVultureWallProjectionQuad"
    | "getVultureBillboardScaleFactor"
    | "getVultureDoorProjectionRotationDegrees"
    | "getVultureDoorProjectionSideRotationDegrees"
    | "getVultureFloorProjectionRotationDegrees"
    | "getVultureWallProjectionQuad"
    | "getVultureWallProjectionRotationDegrees"
    | "shouldUseVulturePrebakedProjectionTextures"
    | "vultureBillboardScaleFactor"
    | "vultureDoorClosedProjectionQuadEW"
    | "vultureDoorClosedProjectionQuadSN"
    | "vultureDoorOpenProjectionQuadEW"
    | "vultureDoorOpenProjectionQuadSN"
    | "vultureDoorProjectionRotationByStateSide"
    | "vultureFloorProjectionQuad"
    | "vultureFloorProjectionRotationDegrees"
    | "vultureWallProjectionQuadEW"
    | "vultureWallProjectionQuadSN"
    | "vultureWallProjectionRotationByFace"
  >;
}

/** Projection calibration panel, corner dragging, rotation controls and clipboard export. */
export class VultureProjectionDebug {
  constructor(private readonly dependencies: VultureProjectionDebugDependencies) {}

  vultureWallProjectionDebugPanel: HTMLDivElement | null = null;

  vultureWallProjectionDebugCanvasEW: HTMLCanvasElement | null = null;

  vultureWallProjectionDebugCanvasSN: HTMLCanvasElement | null = null;

  vultureWallProjectionDebugCanvasFloor: HTMLCanvasElement | null =
    null;

  vultureWallProjectionDebugCanvasDoorOpenEW: HTMLCanvasElement | null =
    null;

  vultureWallProjectionDebugCanvasDoorOpenSN: HTMLCanvasElement | null =
    null;

  vultureWallProjectionDebugCanvasDoorClosedEW: HTMLCanvasElement | null =
    null;

  vultureWallProjectionDebugCanvasDoorClosedSN: HTMLCanvasElement | null =
    null;

  vultureWallProjectionDebugSourceCanvasEW: HTMLCanvasElement | null =
    null;

  vultureWallProjectionDebugSourceCanvasSN: HTMLCanvasElement | null =
    null;

  vultureWallProjectionDebugSourceCanvasFloor: HTMLCanvasElement | null =
    null;

  vultureWallProjectionDebugSourceCanvasDoorOpenEW: HTMLCanvasElement | null =
    null;

  vultureWallProjectionDebugSourceCanvasDoorOpenSN: HTMLCanvasElement | null =
    null;

  vultureWallProjectionDebugSourceCanvasDoorClosedEW: HTMLCanvasElement | null =
    null;

  vultureWallProjectionDebugSourceCanvasDoorClosedSN: HTMLCanvasElement | null =
    null;

  vultureWallProjectionDebugFamilySelect: HTMLSelectElement | null =
    null;

  vultureWallProjectionDebugFamilySections: Partial<
    Record<VultureProjectionDebugFamily, HTMLDivElement>
  > = {};

  vultureWallProjectionDebugSelectedFamily: VultureProjectionDebugFamily =
    "door_closed_sn";

  vultureWallProjectionRotationButtons: Partial<
    Record<VultureWallFaceSlot, HTMLButtonElement>
  > = {};

  vultureFloorProjectionRotationButton: HTMLButtonElement | null = null;

  vultureDoorProjectionRotationButtons: Partial<
    Record<VultureDoorProjectionSide, HTMLButtonElement>
  > = {};

  vultureBillboardScaleInput: HTMLInputElement | null = null;

  vultureWallProjectionDebugStatusLabel: HTMLDivElement | null = null;

  vultureWallProjectionDebugDrag: {
    family: VultureProjectionDebugFamily;
    cornerId: VultureWallProjectionCornerId;
  } | null = null;

  vultureWallProjectionRefreshScheduled = false;

  ensureVultureWallProjectionDebugPanel(): void {
    if (this.dependencies.vultureProjection.shouldUseVulturePrebakedProjectionTextures()) {
      return;
    }

    if (this.vultureWallProjectionDebugPanel) {
      for (const family of [
        "ew",
        "sn",
        "floor",
        "door_open_ew",
        "door_open_sn",
        "door_closed_ew",
        "door_closed_sn",
      ] as const) {
        this.renderVultureWallProjectionDebugCanvas(family);
      }
      return;
    }

    const host = this.dependencies.engineState.mountElement ?? document.body;
    const panel = document.createElement("div");
    panel.className = "nh3d-vulture-wall-projection-debug";
    panel.style.position = "fixed";
    panel.style.top = "150px";
    panel.style.right = "8px";
    panel.style.zIndex = "2147483647";
    panel.style.padding = "8px";
    panel.style.border = "1px solid rgba(255, 255, 255, 0.35)";
    panel.style.borderRadius = "4px";
    panel.style.background = "rgba(0, 0, 0, 0.78)";
    panel.style.color = "#f3f3f3";
    panel.style.font = "12px monospace";
    panel.style.lineHeight = "1.25";
    panel.style.display = "none";
    panel.style.userSelect = "none";
    panel.style.pointerEvents = "auto";
    panel.style.width = "214px";

    const headerRow = document.createElement("div");
    headerRow.style.display = "flex";
    headerRow.style.justifyContent = "space-between";
    headerRow.style.alignItems = "center";
    headerRow.style.marginBottom = "6px";

    const title = document.createElement("div");
    title.textContent = "Vulture Quad";
    title.style.fontWeight = "700";
    headerRow.appendChild(title);

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Copy Values";
    copyButton.style.font = "11px monospace";
    copyButton.style.padding = "1px 4px";
    copyButton.addEventListener("click", () => {
      void this.copyVultureWallProjectionValuesToClipboard();
    });
    headerRow.appendChild(copyButton);
    panel.appendChild(headerRow);

    const rotationRow = document.createElement("div");
    rotationRow.style.display = "grid";
    rotationRow.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
    rotationRow.style.columnGap = "4px";
    rotationRow.style.marginBottom = "8px";
    const createRotationButton = (
      face: VultureWallFaceSlot,
    ): HTMLButtonElement => {
      const button = document.createElement("button");
      button.type = "button";
      button.style.font = "11px monospace";
      button.style.padding = "2px 0";
      button.addEventListener("click", () => {
        this.cycleVultureWallProjectionRotation(face);
      });
      rotationRow.appendChild(button);
      this.vultureWallProjectionRotationButtons[face] = button;
      return button;
    };
    createRotationButton("north");
    createRotationButton("east");
    createRotationButton("south");
    createRotationButton("west");
    panel.appendChild(rotationRow);

    const floorRotationRow = document.createElement("div");
    floorRotationRow.style.display = "flex";
    floorRotationRow.style.justifyContent = "space-between";
    floorRotationRow.style.alignItems = "center";
    floorRotationRow.style.marginBottom = "8px";

    const floorRotationLabel = document.createElement("span");
    floorRotationLabel.textContent = "Floor";
    floorRotationRow.appendChild(floorRotationLabel);

    const floorRotationButton = document.createElement("button");
    floorRotationButton.type = "button";
    floorRotationButton.style.font = "11px monospace";
    floorRotationButton.style.padding = "1px 4px";
    floorRotationButton.addEventListener("click", () => {
      this.cycleVultureFloorProjectionRotation();
    });
    floorRotationRow.appendChild(floorRotationButton);
    this.vultureFloorProjectionRotationButton = floorRotationButton;
    panel.appendChild(floorRotationRow);

    const billboardScaleRow = document.createElement("div");
    billboardScaleRow.style.display = "flex";
    billboardScaleRow.style.justifyContent = "space-between";
    billboardScaleRow.style.alignItems = "center";
    billboardScaleRow.style.marginBottom = "8px";

    const billboardScaleLabel = document.createElement("span");
    billboardScaleLabel.textContent = "Billboard Scale";
    billboardScaleRow.appendChild(billboardScaleLabel);

    const billboardScaleInput = document.createElement("input");
    billboardScaleInput.type = "number";
    billboardScaleInput.step = "0.05";
    billboardScaleInput.min = "0.1";
    billboardScaleInput.style.width = "72px";
    billboardScaleInput.style.font = "11px monospace";
    billboardScaleInput.style.padding = "1px 4px";
    billboardScaleInput.addEventListener("change", () => {
      const parsed = Number.parseFloat(billboardScaleInput.value);
      if (!Number.isFinite(parsed)) {
        this.syncVultureBillboardScaleInputValue();
        return;
      }
      this.setVultureBillboardScaleFactor(parsed);
    });
    billboardScaleInput.addEventListener("blur", () => {
      this.syncVultureBillboardScaleInputValue();
    });
    billboardScaleRow.appendChild(billboardScaleInput);
    this.vultureBillboardScaleInput = billboardScaleInput;
    panel.appendChild(billboardScaleRow);

    const doorRotationGrid = document.createElement("div");
    doorRotationGrid.style.display = "grid";
    doorRotationGrid.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
    doorRotationGrid.style.columnGap = "4px";
    doorRotationGrid.style.rowGap = "4px";
    doorRotationGrid.style.marginBottom = "8px";
    const createDoorRotationButton = (
      side: VultureDoorProjectionSide,
    ): HTMLButtonElement => {
      const button = document.createElement("button");
      button.type = "button";
      button.style.font = "11px monospace";
      button.style.padding = "2px 0";
      button.addEventListener("click", () => {
        this.cycleVultureDoorProjectionSideRotation(side);
      });
      doorRotationGrid.appendChild(button);
      this.vultureDoorProjectionRotationButtons[side] = button;
      return button;
    };
    createDoorRotationButton("front");
    createDoorRotationButton("back");
    panel.appendChild(doorRotationGrid);

    const familyRow = document.createElement("div");
    familyRow.style.display = "flex";
    familyRow.style.justifyContent = "space-between";
    familyRow.style.alignItems = "center";
    familyRow.style.marginBottom = "8px";

    const familyLabel = document.createElement("span");
    familyLabel.textContent = "Preview";
    familyRow.appendChild(familyLabel);

    const familySelect = document.createElement("select");
    familySelect.style.font = "11px monospace";
    familySelect.style.padding = "1px 4px";
    const addFamilyOption = (
      value: VultureProjectionDebugFamily,
      label: string,
    ): void => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      familySelect.appendChild(option);
    };
    addFamilyOption("ew", "E/W Wall");
    addFamilyOption("sn", "S/N Wall");
    addFamilyOption("floor", "Floor");
    addFamilyOption("door_open_ew", "Door Open E/W");
    addFamilyOption("door_open_sn", "Door Open N/S");
    addFamilyOption("door_closed_ew", "Door Closed E/W");
    addFamilyOption("door_closed_sn", "Door Closed N/S");
    familySelect.value = this.vultureWallProjectionDebugSelectedFamily;
    familySelect.addEventListener("change", () => {
      const value = familySelect.value;
      if (
        value === "ew" ||
        value === "sn" ||
        value === "floor" ||
        value === "door_open_ew" ||
        value === "door_open_sn" ||
        value === "door_closed_ew" ||
        value === "door_closed_sn"
      ) {
        this.vultureWallProjectionDebugSelectedFamily = value;
        this.syncVultureWallProjectionDebugFamilySectionVisibility();
      }
    });
    familyRow.appendChild(familySelect);
    this.vultureWallProjectionDebugFamilySelect = familySelect;
    panel.appendChild(familyRow);

    const createSection = (
      family: VultureProjectionDebugFamily,
      labelText: string,
    ): HTMLCanvasElement => {
      const section = document.createElement("div");
      section.style.marginBottom = "8px";
      this.vultureWallProjectionDebugFamilySections[family] = section;

      const labelRow = document.createElement("div");
      labelRow.style.display = "flex";
      labelRow.style.justifyContent = "space-between";
      labelRow.style.alignItems = "center";
      labelRow.style.marginBottom = "3px";

      const label = document.createElement("span");
      label.textContent = labelText;
      labelRow.appendChild(label);

      const resetButton = document.createElement("button");
      resetButton.type = "button";
      resetButton.textContent = "Reset";
      resetButton.style.font = "11px monospace";
      resetButton.style.padding = "1px 4px";
      resetButton.addEventListener("click", () => {
        this.resetVultureWallProjectionQuad(family);
      });
      labelRow.appendChild(resetButton);
      section.appendChild(labelRow);

      const canvas = document.createElement("canvas");
      canvas.width = 192;
      canvas.height = 192;
      canvas.style.width = "192px";
      canvas.style.height = "192px";
      canvas.style.display = "block";
      canvas.style.border = "1px solid rgba(255, 255, 255, 0.2)";
      canvas.style.touchAction = "none";
      canvas.addEventListener("pointerdown", (event) => {
        this.handleVultureWallProjectionPointerDown(event, family);
      });
      canvas.addEventListener("pointermove", (event) => {
        this.handleVultureWallProjectionPointerMove(event, family);
      });
      canvas.addEventListener("pointerup", (event) => {
        this.handleVultureWallProjectionPointerEnd(event, family);
      });
      canvas.addEventListener("pointercancel", (event) => {
        this.handleVultureWallProjectionPointerEnd(event, family);
      });
      section.appendChild(canvas);

      panel.appendChild(section);
      return canvas;
    };

    this.vultureWallProjectionDebugCanvasEW = createSection("ew", "E/W");
    this.vultureWallProjectionDebugCanvasSN = createSection("sn", "S/N");
    this.vultureWallProjectionDebugCanvasFloor = createSection(
      "floor",
      "Floor",
    );
    this.vultureWallProjectionDebugCanvasDoorOpenEW = createSection(
      "door_open_ew",
      "Door Open E/W",
    );
    this.vultureWallProjectionDebugCanvasDoorOpenSN = createSection(
      "door_open_sn",
      "Door Open N/S",
    );
    this.vultureWallProjectionDebugCanvasDoorClosedEW = createSection(
      "door_closed_ew",
      "Door Closed E/W",
    );
    this.vultureWallProjectionDebugCanvasDoorClosedSN = createSection(
      "door_closed_sn",
      "Door Closed N/S",
    );

    const note = document.createElement("div");
    note.textContent = "Drag corners to remap";
    note.style.opacity = "0.76";
    panel.appendChild(note);

    const status = document.createElement("div");
    status.textContent = "";
    status.style.opacity = "0.85";
    status.style.minHeight = "14px";
    status.style.marginTop = "2px";
    panel.appendChild(status);

    host.appendChild(panel);
    this.vultureWallProjectionDebugPanel = panel;
    this.vultureWallProjectionDebugStatusLabel = status;
    this.syncVultureWallProjectionRotationButtonLabels();
    this.syncVultureBillboardScaleInputValue();
    for (const family of [
      "ew",
      "sn",
      "floor",
      "door_open_ew",
      "door_open_sn",
      "door_closed_ew",
      "door_closed_sn",
    ] as const) {
      this.renderVultureWallProjectionDebugCanvas(family);
    }
    this.syncVultureWallProjectionDebugFamilySectionVisibility();
    this.syncVultureWallProjectionDebugPanelVisibility();
  }

  setVultureWallProjectionDebugStatus(message: string): void {
    if (this.vultureWallProjectionDebugStatusLabel) {
      this.vultureWallProjectionDebugStatusLabel.textContent = message;
    }
  }

  syncVultureBillboardScaleInputValue(): void {
    if (!this.vultureBillboardScaleInput) {
      return;
    }
    this.vultureBillboardScaleInput.value =
      this.dependencies.vultureProjection.getVultureBillboardScaleFactor().toFixed(2);
  }

  setVultureBillboardScaleFactor(rawValue: number): void {
    const next = THREE.MathUtils.clamp(rawValue, 0.1, 8);
    if (Math.abs(next - this.dependencies.vultureProjection.vultureBillboardScaleFactor) < 0.0001) {
      this.syncVultureBillboardScaleInputValue();
      return;
    }
    this.dependencies.vultureProjection.vultureBillboardScaleFactor = next;
    this.syncVultureBillboardScaleInputValue();
    this.scheduleVultureWallProjectionRefresh();
  }

  syncVultureWallProjectionRotationButtonLabels(): void {
    const labelByFace: Record<VultureWallFaceSlot, string> = {
      north: "N",
      east: "E",
      south: "S",
      west: "W",
    };
    for (const face of ["north", "east", "south", "west"] as const) {
      const button = this.vultureWallProjectionRotationButtons[face];
      if (!button) {
        continue;
      }
      const rotation = this.dependencies.vultureProjection.getVultureWallProjectionRotationDegrees(face);
      button.textContent = `${labelByFace[face]} ${rotation}deg`;
    }
    if (this.vultureFloorProjectionRotationButton) {
      const rotation = this.dependencies.vultureProjection.getVultureFloorProjectionRotationDegrees();
      this.vultureFloorProjectionRotationButton.textContent = `${rotation}deg`;
    }
    for (const side of ["front", "back"] as const) {
      const button = this.vultureDoorProjectionRotationButtons[side];
      if (!button) {
        continue;
      }
      const rotation = this.dependencies.vultureProjection.getVultureDoorProjectionSideRotationDegrees(side);
      const sideLabel = side === "front" ? "Door N" : "Door S";
      button.textContent = `${sideLabel} ${rotation}deg`;
    }
  }

  syncVultureWallProjectionDebugFamilySectionVisibility(): void {
    const selectedFamily = this.vultureWallProjectionDebugSelectedFamily;
    if (this.vultureWallProjectionDebugFamilySelect) {
      this.vultureWallProjectionDebugFamilySelect.value = selectedFamily;
    }
    for (const family of [
      "ew",
      "sn",
      "floor",
      "door_open_ew",
      "door_open_sn",
      "door_closed_ew",
      "door_closed_sn",
    ] as const) {
      const section = this.vultureWallProjectionDebugFamilySections[family];
      if (!section) {
        continue;
      }
      section.style.display = family === selectedFamily ? "block" : "none";
    }
    this.renderVultureWallProjectionDebugCanvas(selectedFamily);
  }

  cycleVultureWallProjectionRotation(face: VultureWallFaceSlot): void {
    const current = this.dependencies.vultureProjection.getVultureWallProjectionRotationDegrees(face);
    const next = (current + 90) % 360;
    this.dependencies.vultureProjection.vultureWallProjectionRotationByFace[face] = next;
    this.syncVultureWallProjectionRotationButtonLabels();
    this.scheduleVultureWallProjectionRefresh();
  }

  cycleVultureFloorProjectionRotation(): void {
    const current = this.dependencies.vultureProjection.getVultureFloorProjectionRotationDegrees();
    const next = (current + 90) % 360;
    this.dependencies.vultureProjection.vultureFloorProjectionRotationDegrees = next;
    this.syncVultureWallProjectionRotationButtonLabels();
    this.scheduleVultureWallProjectionRefresh();
  }

  cycleVultureDoorProjectionSideRotation(
    side: VultureDoorProjectionSide,
  ): void {
    const current = this.dependencies.vultureProjection.getVultureDoorProjectionSideRotationDegrees(side);
    const next = (current + 90) % 360;
    for (const state of ["open", "closed"] as const) {
      this.dependencies.vultureProjection.vultureDoorProjectionRotationByStateSide[state][side] = next;
    }
    this.syncVultureWallProjectionRotationButtonLabels();
    this.scheduleVultureWallProjectionRefresh();
  }

  copyVultureWallProjectionValues(): string {
    const roundPoint = (
      point: VultureWallProjectionPoint,
    ): VultureWallProjectionPoint => ({
      x: Number(point.x.toFixed(4)),
      y: Number(point.y.toFixed(4)),
    });
    const roundQuad = (
      quad: VultureWallProjectionQuad,
    ): VultureWallProjectionQuad => ({
      topLeft: roundPoint(quad.topLeft),
      topRight: roundPoint(quad.topRight),
      bottomRight: roundPoint(quad.bottomRight),
      bottomLeft: roundPoint(quad.bottomLeft),
    });
    const payload = {
      ew: roundQuad(this.dependencies.vultureProjection.vultureWallProjectionQuadEW),
      sn: roundQuad(this.dependencies.vultureProjection.vultureWallProjectionQuadSN),
      floor: roundQuad(this.dependencies.vultureProjection.vultureFloorProjectionQuad),
      door_open_ew: roundQuad(this.dependencies.vultureProjection.vultureDoorOpenProjectionQuadEW),
      door_open_sn: roundQuad(this.dependencies.vultureProjection.vultureDoorOpenProjectionQuadSN),
      door_closed_ew: roundQuad(this.dependencies.vultureProjection.vultureDoorClosedProjectionQuadEW),
      door_closed_sn: roundQuad(this.dependencies.vultureProjection.vultureDoorClosedProjectionQuadSN),
      previewFamily: this.vultureWallProjectionDebugSelectedFamily,
      billboardScale: Number(this.dependencies.vultureProjection.getVultureBillboardScaleFactor().toFixed(2)),
      rotation: {
        north: this.dependencies.vultureProjection.getVultureWallProjectionRotationDegrees("north"),
        east: this.dependencies.vultureProjection.getVultureWallProjectionRotationDegrees("east"),
        south: this.dependencies.vultureProjection.getVultureWallProjectionRotationDegrees("south"),
        west: this.dependencies.vultureProjection.getVultureWallProjectionRotationDegrees("west"),
        floor: this.dependencies.vultureProjection.getVultureFloorProjectionRotationDegrees(),
      },
      doorRotation: {
        open: {
          front: this.dependencies.vultureProjection.getVultureDoorProjectionRotationDegrees("open", "front"),
          back: this.dependencies.vultureProjection.getVultureDoorProjectionRotationDegrees("open", "back"),
        },
        closed: {
          front: this.dependencies.vultureProjection.getVultureDoorProjectionRotationDegrees(
            "closed",
            "front",
          ),
          back: this.dependencies.vultureProjection.getVultureDoorProjectionRotationDegrees("closed", "back"),
        },
      },
    };
    return JSON.stringify(payload, null, 2);
  }

  async copyVultureWallProjectionValuesToClipboard(): Promise<void> {
    const payload = this.copyVultureWallProjectionValues();
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(payload);
        this.setVultureWallProjectionDebugStatus("Copied values to clipboard.");
        return;
      }
    } catch (_error) {
      // Fallback to textarea copy path below.
    }
    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = payload;
      textarea.style.position = "fixed";
      textarea.style.left = "-10000px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (copied) {
        this.setVultureWallProjectionDebugStatus("Copied values to clipboard.");
      } else {
        this.setVultureWallProjectionDebugStatus(
          "Copy failed. Open console and copy manually.",
        );
        console.log(payload);
      }
      return;
    }
    this.setVultureWallProjectionDebugStatus(
      "Copy unavailable. Open console and copy manually.",
    );
    console.log(payload);
  }

  getVultureWallProjectionDebugCanvas(
    family: VultureProjectionDebugFamily,
  ): HTMLCanvasElement | null {
    if (family === "ew") {
      return this.vultureWallProjectionDebugCanvasEW;
    }
    if (family === "sn") {
      return this.vultureWallProjectionDebugCanvasSN;
    }
    if (family === "door_open_ew") {
      return this.vultureWallProjectionDebugCanvasDoorOpenEW;
    }
    if (family === "door_open_sn") {
      return this.vultureWallProjectionDebugCanvasDoorOpenSN;
    }
    if (family === "door_closed_ew") {
      return this.vultureWallProjectionDebugCanvasDoorClosedEW;
    }
    if (family === "door_closed_sn") {
      return this.vultureWallProjectionDebugCanvasDoorClosedSN;
    }
    return this.vultureWallProjectionDebugCanvasFloor;
  }

  getVultureWallProjectionDebugSourceCanvas(
    family: VultureProjectionDebugFamily,
  ): HTMLCanvasElement | null {
    if (family === "ew") {
      return this.vultureWallProjectionDebugSourceCanvasEW;
    }
    if (family === "sn") {
      return this.vultureWallProjectionDebugSourceCanvasSN;
    }
    if (family === "door_open_ew") {
      return this.vultureWallProjectionDebugSourceCanvasDoorOpenEW;
    }
    if (family === "door_open_sn") {
      return this.vultureWallProjectionDebugSourceCanvasDoorOpenSN;
    }
    if (family === "door_closed_ew") {
      return this.vultureWallProjectionDebugSourceCanvasDoorClosedEW;
    }
    if (family === "door_closed_sn") {
      return this.vultureWallProjectionDebugSourceCanvasDoorClosedSN;
    }
    return this.vultureWallProjectionDebugSourceCanvasFloor;
  }

  ensureVultureWallProjectionDebugSourceCanvas(
    family: VultureProjectionDebugFamily,
    size: number,
  ): HTMLCanvasElement {
    let canvas = this.getVultureWallProjectionDebugSourceCanvas(family);
    if (!canvas) {
      canvas = document.createElement("canvas");
      if (family === "ew") {
        this.vultureWallProjectionDebugSourceCanvasEW = canvas;
      } else if (family === "sn") {
        this.vultureWallProjectionDebugSourceCanvasSN = canvas;
      } else if (family === "door_open_ew") {
        this.vultureWallProjectionDebugSourceCanvasDoorOpenEW = canvas;
      } else if (family === "door_open_sn") {
        this.vultureWallProjectionDebugSourceCanvasDoorOpenSN = canvas;
      } else if (family === "door_closed_ew") {
        this.vultureWallProjectionDebugSourceCanvasDoorClosedEW = canvas;
      } else if (family === "door_closed_sn") {
        this.vultureWallProjectionDebugSourceCanvasDoorClosedSN = canvas;
      } else {
        this.vultureWallProjectionDebugSourceCanvasFloor = canvas;
      }
    }
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    return canvas;
  }

  syncVultureWallProjectionDebugPanelVisibility(): void {
    if (!this.vultureWallProjectionDebugPanel) {
      return;
    }
    this.syncVultureWallProjectionRotationButtonLabels();
    this.syncVultureBillboardScaleInputValue();
    const wasVisible =
      this.vultureWallProjectionDebugPanel.style.display === "block";
    const visible = this.dependencies.tilesetAssets.shouldUseVultureTiles();
    this.vultureWallProjectionDebugPanel.style.display = visible
      ? "block"
      : "none";
    if (visible) {
      if (!wasVisible) {
        this.scheduleVultureWallProjectionRefresh();
      }
      for (const family of [
        "ew",
        "sn",
        "floor",
        "door_open_ew",
        "door_open_sn",
        "door_closed_ew",
        "door_closed_sn",
      ] as const) {
        this.renderVultureWallProjectionDebugCanvas(family);
      }
      this.syncVultureWallProjectionDebugFamilySectionVisibility();
    }
  }

  handleVultureWallProjectionPointerDown(
    event: PointerEvent,
    family: VultureProjectionDebugFamily,
  ): void {
    const canvas = event.currentTarget;
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }
    const pointer = this.resolveVultureWallProjectionPointerPosition(
      canvas,
      event,
    );
    if (!pointer) {
      return;
    }
    const cornerId = this.findNearestVultureWallProjectionCorner(
      family,
      pointer,
    );
    if (!cornerId) {
      return;
    }
    this.vultureWallProjectionDebugDrag = { family, cornerId };
    canvas.setPointerCapture(event.pointerId);
    this.updateVultureWallProjectionCorner(
      family,
      cornerId,
      pointer.x,
      pointer.y,
    );
    event.preventDefault();
  }

  handleVultureWallProjectionPointerMove(
    event: PointerEvent,
    family: VultureProjectionDebugFamily,
  ): void {
    const drag = this.vultureWallProjectionDebugDrag;
    if (!drag || drag.family !== family) {
      return;
    }
    const canvas = event.currentTarget;
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }
    const pointer = this.resolveVultureWallProjectionPointerPosition(
      canvas,
      event,
    );
    if (!pointer) {
      return;
    }
    this.updateVultureWallProjectionCorner(
      family,
      drag.cornerId,
      pointer.x,
      pointer.y,
    );
    event.preventDefault();
  }

  handleVultureWallProjectionPointerEnd(
    event: PointerEvent,
    family: VultureProjectionDebugFamily,
  ): void {
    const drag = this.vultureWallProjectionDebugDrag;
    if (!drag || drag.family !== family) {
      return;
    }
    const canvas = event.currentTarget;
    if (
      canvas instanceof HTMLCanvasElement &&
      canvas.hasPointerCapture(event.pointerId)
    ) {
      canvas.releasePointerCapture(event.pointerId);
    }
    this.vultureWallProjectionDebugDrag = null;
    this.renderVultureWallProjectionDebugCanvas(family);
  }

  resolveVultureWallProjectionPointerPosition(
    canvas: HTMLCanvasElement,
    event: PointerEvent,
  ): VultureWallProjectionPoint | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    const xPx =
      ((event.clientX - rect.left) / rect.width) *
      Math.max(1, canvas.width - 1);
    const yPx =
      ((event.clientY - rect.top) / rect.height) *
      Math.max(1, canvas.height - 1);
    return {
      x: THREE.MathUtils.clamp(xPx / Math.max(1, canvas.width - 1), 0, 1),
      y: THREE.MathUtils.clamp(yPx / Math.max(1, canvas.height - 1), 0, 1),
    };
  }

  findNearestVultureWallProjectionCorner(
    family: VultureProjectionDebugFamily,
    point: VultureWallProjectionPoint,
  ): VultureWallProjectionCornerId | null {
    const canvas = this.getVultureWallProjectionDebugCanvas(family);
    if (!canvas) {
      return null;
    }
    const quad = this.dependencies.vultureProjection.getVultureWallProjectionQuad(family);
    const pxX = point.x * Math.max(1, canvas.width - 1);
    const pxY = point.y * Math.max(1, canvas.height - 1);
    const maxDistanceSq = 14 * 14;
    const cornerOrder: VultureWallProjectionCornerId[] = [
      "topLeft",
      "topRight",
      "bottomRight",
      "bottomLeft",
    ];
    let nearestCorner: VultureWallProjectionCornerId | null = null;
    let nearestDistanceSq = maxDistanceSq;
    for (const cornerId of cornerOrder) {
      const corner = quad[cornerId];
      const cornerPxX = corner.x * Math.max(1, canvas.width - 1);
      const cornerPxY = corner.y * Math.max(1, canvas.height - 1);
      const dx = cornerPxX - pxX;
      const dy = cornerPxY - pxY;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > nearestDistanceSq) {
        continue;
      }
      nearestDistanceSq = distanceSq;
      nearestCorner = cornerId;
    }
    return nearestCorner;
  }

  updateVultureWallProjectionCorner(
    family: VultureProjectionDebugFamily,
    cornerId: VultureWallProjectionCornerId,
    x: number,
    y: number,
  ): void {
    const quad = this.dependencies.vultureProjection.getVultureWallProjectionQuad(family);
    const corner = quad[cornerId];
    const nextX = THREE.MathUtils.clamp(x, 0, 1);
    const nextY = THREE.MathUtils.clamp(y, 0, 1);
    if (
      Math.abs(corner.x - nextX) < 0.0001 &&
      Math.abs(corner.y - nextY) < 0.0001
    ) {
      return;
    }
    corner.x = nextX;
    corner.y = nextY;
    this.renderVultureWallProjectionDebugCanvas(family);
    this.scheduleVultureWallProjectionRefresh();
  }

  resetVultureWallProjectionQuad(
    family: VultureProjectionDebugFamily,
  ): void {
    const nextQuad = this.dependencies.vultureProjection.createDefaultVultureWallProjectionQuad(family);
    if (family === "ew") {
      this.dependencies.vultureProjection.vultureWallProjectionQuadEW = nextQuad;
    } else if (family === "sn") {
      this.dependencies.vultureProjection.vultureWallProjectionQuadSN = nextQuad;
    } else if (family === "door_open_ew") {
      this.dependencies.vultureProjection.vultureDoorOpenProjectionQuadEW = nextQuad;
    } else if (family === "door_open_sn") {
      this.dependencies.vultureProjection.vultureDoorOpenProjectionQuadSN = nextQuad;
    } else if (family === "door_closed_ew") {
      this.dependencies.vultureProjection.vultureDoorClosedProjectionQuadEW = nextQuad;
    } else if (family === "door_closed_sn") {
      this.dependencies.vultureProjection.vultureDoorClosedProjectionQuadSN = nextQuad;
    } else {
      this.dependencies.vultureProjection.vultureFloorProjectionQuad = nextQuad;
    }
    this.renderVultureWallProjectionDebugCanvas(family);
    this.scheduleVultureWallProjectionRefresh();
  }

  scheduleVultureWallProjectionRefresh(): void {
    if (this.vultureWallProjectionRefreshScheduled) {
      return;
    }
    this.vultureWallProjectionRefreshScheduled = true;
    requestAnimationFrame(() => {
      this.vultureWallProjectionRefreshScheduled = false;
      if (
        this.dependencies.tilesetAssets.vultureTilesetTranslator === null ||
        this.dependencies.engineState.clientOptions.tilesetMode !== "tiles"
      ) {
        return;
      }
      this.dependencies.tilesetAssets.invalidateTilesetDependentCaches();
      this.dependencies.tileUpdates.refreshTilesFromStateCache();
    });
  }

  renderVultureWallProjectionDebugCanvas(
    family: VultureProjectionDebugFamily,
  ): void {
    const canvas = this.getVultureWallProjectionDebugCanvas(family);
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const sourceCanvas = this.getVultureWallProjectionDebugSourceCanvas(family);
    context.clearRect(0, 0, canvas.width, canvas.height);
    this.drawVultureWallProjectionPreviewBackground(
      context,
      canvas.width,
      canvas.height,
    );
    if (sourceCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
      context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    } else {
      context.fillStyle = "rgba(255, 255, 255, 0.6)";
      context.font = "11px monospace";
      context.fillText("Waiting for sample...", 10, 20);
    }

    const quad = this.dependencies.vultureProjection.getVultureWallProjectionQuad(family);
    const corners: Array<{
      id: VultureWallProjectionCornerId;
      label: string;
    }> = [
      { id: "topLeft", label: "TL" },
      { id: "topRight", label: "TR" },
      { id: "bottomRight", label: "BR" },
      { id: "bottomLeft", label: "BL" },
    ];
    const dragCornerId =
      this.vultureWallProjectionDebugDrag?.family === family
        ? this.vultureWallProjectionDebugDrag.cornerId
        : null;

    context.strokeStyle = "rgba(74, 255, 170, 0.95)";
    context.lineWidth = 2;
    context.beginPath();
    for (let index = 0; index < corners.length; index += 1) {
      const corner = quad[corners[index].id];
      const x = corner.x * Math.max(1, canvas.width - 1);
      const y = corner.y * Math.max(1, canvas.height - 1);
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    const firstCorner = quad[corners[0].id];
    context.lineTo(
      firstCorner.x * Math.max(1, canvas.width - 1),
      firstCorner.y * Math.max(1, canvas.height - 1),
    );
    context.stroke();

    context.font = "10px monospace";
    for (const cornerDescriptor of corners) {
      const corner = quad[cornerDescriptor.id];
      const x = corner.x * Math.max(1, canvas.width - 1);
      const y = corner.y * Math.max(1, canvas.height - 1);
      const active = dragCornerId === cornerDescriptor.id;
      context.fillStyle = active ? "#ffb347" : "#ffffff";
      context.beginPath();
      context.arc(x, y, 4.5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(0, 0, 0, 0.7)";
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = "#000000";
      context.fillText(cornerDescriptor.label, x + 6, y - 6);
    }
  }

  drawVultureWallProjectionPreviewBackground(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const step = 12;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const evenCell = ((x / step + y / step) & 1) === 0;
        context.fillStyle = evenCell
          ? "rgba(64, 64, 64, 0.95)"
          : "rgba(34, 34, 34, 0.95)";
        context.fillRect(x, y, step, step);
      }
    }
  }

  captureVultureWallProjectionSourcePreview(
    context: CanvasRenderingContext2D,
    size: number,
    family: VultureProjectionDebugFamily,
    lookup: VultureTileLookup,
  ): void {
    const panelVisible =
      this.vultureWallProjectionDebugPanel?.style.display === "block";
    if (!panelVisible) {
      return;
    }
    const sourceCanvas = this.ensureVultureWallProjectionDebugSourceCanvas(
      family,
      size,
    );
    const sourceContext = sourceCanvas.getContext("2d");
    if (!sourceContext) {
      return;
    }
    let drewRawPreview = false;
    if (this.dependencies.tilesetAssets.vultureTilesetTranslator) {
      drewRawPreview = this.dependencies.tilesetAssets.vultureTilesetTranslator.drawLookupSourcePreview({
        context: sourceContext,
        size,
        lookup,
      });
    }
    if (!drewRawPreview) {
      sourceContext.clearRect(0, 0, size, size);
      sourceContext.drawImage(
        context.canvas,
        0,
        0,
        size,
        size,
        0,
        0,
        size,
        size,
      );
    }
    this.renderVultureWallProjectionDebugCanvas(family);
  }
}
