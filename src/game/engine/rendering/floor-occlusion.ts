import * as THREE from "three";
import { TileNeighborBatch } from "./tile-neighbor-batch";
import { TILE_SIZE } from "../../constants";
import { getOpenDoorGlyphFrom, isDoorwayCmapGlyph } from "../../glyphs/behavior";
import type { TileMaterialKind } from "../../glyphs";
import type { EngineState } from "../runtime/engine-state";
import type { Lighting } from "./lighting";
import type { MovementInput } from "../input/movement-input";
import type { RenderPipeline } from "./render-pipeline";
import type { TileRendering } from "./tile-rendering";
import type { WallGeometry } from "./wall-geometry";

export interface FloorOcclusionDependencies {
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly lighting: Pick<
    Lighting,
    "patchMaterialForVignette"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "scene"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "floorGeometry"
    | "tileMap"
    | "tileVisualScaleFps"
  >;
  readonly wallGeometry: Pick<
    WallGeometry,
    "fpsWallChamferFloorMeshes"
    | "getFpsClosedDoorChamferTransform"
  >;
}

/** Wall and door contact occlusion masks, textures and floor overlays */
export class FloorOcclusion {
  constructor(private readonly dependencies: FloorOcclusionDependencies) {}

  private readonly floorBatch = new TileNeighborBatch((x, y) => this.updateFloorBlockAmbientOcclusionAt(x, y));
  private readonly chamferBatch = new TileNeighborBatch((x, y) => this.updateFpsWallChamferFloorAmbientOcclusionAt(x, y));

  beginTileBatch(): void { this.floorBatch.begin(); this.chamferBatch.begin(); }
  flushTileBatch(): void { this.floorBatch.flush(); this.chamferBatch.flush(); }
  endTileBatch(): void { try { this.floorBatch.end(); } finally { this.chamferBatch.end(); } }

  floorBlockAmbientOcclusionTextureCache: Map<
    number,
    THREE.CanvasTexture
  > = new Map();

  floorBlockAmbientOcclusionOverlays: Map<string, THREE.Mesh> =
    new Map();

  trimmedDoorInsetAmbientOcclusionOverlays: Map<string, THREE.Group> =
    new Map();

  readonly floorBlockAmbientOcclusionOverlayZ: number = 0.014;

  fpsWallChamferFloorAmbientOcclusionOverlays: Map<string, THREE.Mesh> =
    new Map();

  readonly fpsWallChamferFloorAmbientOcclusionOverlayZ: number = 0.014;

  isWallTileAt(tileX: number, tileY: number): boolean {
    const neighbor = this.dependencies.tileRendering.tileMap.get(`${tileX},${tileY}`);
    return Boolean(neighbor?.userData?.isWall);
  }

  getClosedDoorGlyphFromMesh(mesh: THREE.Mesh): number | null {
    const sourceGlyph =
      typeof mesh.userData?.sourceGlyph === "number" &&
      Number.isFinite(mesh.userData.sourceGlyph)
        ? Math.trunc(mesh.userData.sourceGlyph)
        : null;
    const tileTextureSourceGlyph =
      typeof mesh.userData?.tileTextureSourceGlyph === "number" &&
      Number.isFinite(mesh.userData.tileTextureSourceGlyph)
        ? Math.trunc(mesh.userData.tileTextureSourceGlyph)
        : null;
    const glyphCandidates = [sourceGlyph, tileTextureSourceGlyph];
    for (const candidate of glyphCandidates) {
      if (candidate === null || !isDoorwayCmapGlyph(candidate)) {
        continue;
      }
      if (getOpenDoorGlyphFrom(candidate) === candidate) {
        continue;
      }
      return candidate;
    }
    return null;
  }

  getFpsDoorTrimTransformFromMesh(
    mesh: THREE.Mesh,
    tileX: number,
    tileY: number,
  ): {
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
  } | null {
    if (!this.dependencies.movementInput.isFpsMode()) {
      return null;
    }
    if (!mesh.userData?.isWall) {
      return null;
    }
    const visualScale = this.dependencies.tileRendering.tileVisualScaleFps;
    const rawScaleX =
      typeof mesh.scale?.x === "number" && Number.isFinite(mesh.scale.x)
        ? mesh.scale.x
        : visualScale;
    const rawScaleY =
      typeof mesh.scale?.y === "number" && Number.isFinite(mesh.scale.y)
        ? mesh.scale.y
        : visualScale;
    const safeScaleX =
      Math.abs(visualScale) > 0.0001 ? rawScaleX / visualScale : 1;
    const safeScaleY =
      Math.abs(visualScale) > 0.0001 ? rawScaleY / visualScale : 1;
    const offsetX = mesh.position.x - tileX * TILE_SIZE;
    const offsetY = mesh.position.y + tileY * TILE_SIZE;
    if (safeScaleX >= 0.9999 && safeScaleY >= 0.9999) {
      return null;
    }
    return {
      scaleX: safeScaleX,
      scaleY: safeScaleY,
      offsetX,
      offsetY,
    };
  }

  isTrimmedDoorTransformBlockingFloorAmbientOcclusionEdge(
    transform: {
      scaleX: number;
      scaleY: number;
      offsetX: number;
      offsetY: number;
    },
    edgeDirectionFromCenter: "north" | "east" | "south" | "west",
  ): boolean {
    const hasTrim = transform.scaleX < 0.9999 || transform.scaleY < 0.9999;
    if (!hasTrim) {
      return true;
    }

    const half = TILE_SIZE / 2;
    const epsilon = TILE_SIZE * 0.005;
    const minX = -half * transform.scaleX + transform.offsetX;
    const maxX = half * transform.scaleX + transform.offsetX;
    const minY = -half * transform.scaleY + transform.offsetY;
    const maxY = half * transform.scaleY + transform.offsetY;
    if (edgeDirectionFromCenter === "north") {
      // Neighbor is north of center, so center-adjacent side is neighbor south (minY).
      return minY <= -half + epsilon;
    }
    if (edgeDirectionFromCenter === "south") {
      // Neighbor is south of center, so center-adjacent side is neighbor north (maxY).
      return maxY >= half - epsilon;
    }
    if (edgeDirectionFromCenter === "east") {
      // Neighbor is east of center, so center-adjacent side is neighbor west (minX).
      return minX <= -half + epsilon;
    }
    // Neighbor is west of center, so center-adjacent side is neighbor east (maxX).
    return maxX >= half - epsilon;
  }

  isWallTileBlockingFloorAmbientOcclusionEdge(
    tileX: number,
    tileY: number,
    edgeDirectionFromCenter: "north" | "east" | "south" | "west",
  ): boolean {
    const neighbor = this.dependencies.tileRendering.tileMap.get(`${tileX},${tileY}`);
    if (!neighbor?.userData?.isWall) {
      return false;
    }
    if (!this.dependencies.movementInput.isFpsMode()) {
      return true;
    }

    const appliedTransform = this.getFpsDoorTrimTransformFromMesh(
      neighbor,
      tileX,
      tileY,
    );
    if (appliedTransform) {
      return this.isTrimmedDoorTransformBlockingFloorAmbientOcclusionEdge(
        appliedTransform,
        edgeDirectionFromCenter,
      );
    }

    const closedDoorGlyph = this.getClosedDoorGlyphFromMesh(neighbor);
    const materialKind =
      typeof neighbor.userData?.materialKind === "string"
        ? (neighbor.userData.materialKind as TileMaterialKind)
        : null;
    if (closedDoorGlyph === null && materialKind !== "door") {
      return true;
    }

    const transform = this.dependencies.wallGeometry.getFpsClosedDoorChamferTransform(
      tileX,
      tileY,
      closedDoorGlyph,
    );
    return this.isTrimmedDoorTransformBlockingFloorAmbientOcclusionEdge(
      transform,
      edgeDirectionFromCenter,
    );
  }

  getWallChamferMaskAt(tileX: number, tileY: number): number {
    const mesh = this.dependencies.tileRendering.tileMap.get(`${tileX},${tileY}`);
    if (!mesh?.userData?.isWall) {
      return 0;
    }
    if (typeof mesh.userData?.fpsWallChamferMask !== "number") {
      return 0;
    }
    return Math.max(
      0,
      Math.min(15, Math.trunc(mesh.userData.fpsWallChamferMask)),
    );
  }

  computeFloorBlockAmbientOcclusionMasks(
    tileX: number,
    tileY: number,
  ): {
    edgeMask: number;
    cornerMask: number;
    edgeCutMask: number;
    edgeTerminalMask: number;
  } {
    let edgeMask = 0;
    // Bit layout: 1 = north, 2 = east, 4 = south, 8 = west.
    const hasNorth = this.isWallTileBlockingFloorAmbientOcclusionEdge(
      tileX,
      tileY - 1,
      "north",
    );
    const hasEast = this.isWallTileBlockingFloorAmbientOcclusionEdge(
      tileX + 1,
      tileY,
      "east",
    );
    const hasSouth = this.isWallTileBlockingFloorAmbientOcclusionEdge(
      tileX,
      tileY + 1,
      "south",
    );
    const hasWest = this.isWallTileBlockingFloorAmbientOcclusionEdge(
      tileX - 1,
      tileY,
      "west",
    );
    if (hasNorth) {
      edgeMask |= 1;
    }
    if (hasEast) {
      edgeMask |= 2;
    }
    if (hasSouth) {
      edgeMask |= 4;
    }
    if (hasWest) {
      edgeMask |= 8;
    }
    const hasNorthWest = this.isWallTileAt(tileX - 1, tileY - 1);
    const hasNorthEast = this.isWallTileAt(tileX + 1, tileY - 1);
    const hasSouthEast = this.isWallTileAt(tileX + 1, tileY + 1);
    const hasSouthWest = this.isWallTileAt(tileX - 1, tileY + 1);

    const northChamferMask = hasNorth
      ? this.getWallChamferMaskAt(tileX, tileY - 1)
      : 0;
    const eastChamferMask = hasEast
      ? this.getWallChamferMaskAt(tileX + 1, tileY)
      : 0;
    const southChamferMask = hasSouth
      ? this.getWallChamferMaskAt(tileX, tileY + 1)
      : 0;
    const westChamferMask = hasWest
      ? this.getWallChamferMaskAt(tileX - 1, tileY)
      : 0;

    // Bit layout:
    // 1 = north-left, 2 = north-right,
    // 4 = east-top, 8 = east-bottom,
    // 16 = south-right, 32 = south-left,
    // 64 = west-bottom, 128 = west-top.
    let edgeCutMask = 0;
    if (northChamferMask & 8) {
      edgeCutMask |= 1;
    }
    if (northChamferMask & 4) {
      edgeCutMask |= 2;
    }
    if (eastChamferMask & 1) {
      edgeCutMask |= 4;
    }
    if (eastChamferMask & 8) {
      edgeCutMask |= 8;
    }
    if (southChamferMask & 2) {
      edgeCutMask |= 16;
    }
    if (southChamferMask & 1) {
      edgeCutMask |= 32;
    }
    if (westChamferMask & 4) {
      edgeCutMask |= 64;
    }
    if (westChamferMask & 2) {
      edgeCutMask |= 128;
    }

    let cornerMask = 0;
    // Bit layout: 1 = NW, 2 = NE, 4 = SE, 8 = SW.
    if (
      hasNorth &&
      hasWest &&
      (edgeCutMask & 1) === 0 &&
      (edgeCutMask & 128) === 0
    ) {
      cornerMask |= 1;
    }
    if (
      hasNorth &&
      hasEast &&
      (edgeCutMask & 2) === 0 &&
      (edgeCutMask & 4) === 0
    ) {
      cornerMask |= 2;
    }
    if (
      hasSouth &&
      hasEast &&
      (edgeCutMask & 16) === 0 &&
      (edgeCutMask & 8) === 0
    ) {
      cornerMask |= 4;
    }
    if (
      hasSouth &&
      hasWest &&
      (edgeCutMask & 32) === 0 &&
      (edgeCutMask & 64) === 0
    ) {
      cornerMask |= 8;
    }

    // Bit layout matches edgeCutMask endpoint bits so texture generation can
    // apply smooth falloff to true segment endpoints without breaking runs.
    let edgeTerminalMask = 0;
    if (hasNorth && !hasWest && !hasNorthWest && (edgeCutMask & 1) === 0) {
      edgeTerminalMask |= 1;
    }
    if (hasNorth && !hasEast && !hasNorthEast && (edgeCutMask & 2) === 0) {
      edgeTerminalMask |= 2;
    }
    if (hasEast && !hasNorth && !hasNorthEast && (edgeCutMask & 4) === 0) {
      edgeTerminalMask |= 4;
    }
    if (hasEast && !hasSouth && !hasSouthEast && (edgeCutMask & 8) === 0) {
      edgeTerminalMask |= 8;
    }
    if (hasSouth && !hasEast && !hasSouthEast && (edgeCutMask & 16) === 0) {
      edgeTerminalMask |= 16;
    }
    if (hasSouth && !hasWest && !hasSouthWest && (edgeCutMask & 32) === 0) {
      edgeTerminalMask |= 32;
    }
    if (hasWest && !hasSouth && !hasSouthWest && (edgeCutMask & 64) === 0) {
      edgeTerminalMask |= 64;
    }
    if (hasWest && !hasNorth && !hasNorthWest && (edgeCutMask & 128) === 0) {
      edgeTerminalMask |= 128;
    }

    return { edgeMask, cornerMask, edgeCutMask, edgeTerminalMask };
  }

  computeTrimmedDoorUnderlayAmbientOcclusionMasks(
    tileX: number,
    tileY: number,
    doorTransform: {
      scaleX: number;
      scaleY: number;
      offsetX: number;
      offsetY: number;
    },
  ): {
    edgeMask: number;
    cornerMask: number;
    edgeCutMask: number;
    edgeTerminalMask: number;
  } {
    let edgeMask = 0;
    let edgeCutMask = 0;
    let edgeTerminalMask = 0;

    const trimmedAlongX = doorTransform.scaleX < 0.9999;
    const trimmedAlongY = doorTransform.scaleY < 0.9999;

    if (trimmedAlongX) {
      const hasEast = this.isWallTileAt(tileX + 1, tileY);
      const hasWest = this.isWallTileAt(tileX - 1, tileY);
      if (hasEast) {
        edgeMask |= 2;
      }
      if (hasWest) {
        edgeMask |= 8;
      }
      const eastChamferMask = hasEast
        ? this.getWallChamferMaskAt(tileX + 1, tileY)
        : 0;
      const westChamferMask = hasWest
        ? this.getWallChamferMaskAt(tileX - 1, tileY)
        : 0;
      if (eastChamferMask & 1) {
        edgeCutMask |= 4;
      }
      if (eastChamferMask & 8) {
        edgeCutMask |= 8;
      }
      if (westChamferMask & 4) {
        edgeCutMask |= 64;
      }
      if (westChamferMask & 2) {
        edgeCutMask |= 128;
      }
      if (
        hasEast &&
        !this.isWallTileAt(tileX + 1, tileY - 1) &&
        (edgeCutMask & 4) === 0
      ) {
        edgeTerminalMask |= 4;
      }
      if (
        hasEast &&
        !this.isWallTileAt(tileX + 1, tileY + 1) &&
        (edgeCutMask & 8) === 0
      ) {
        edgeTerminalMask |= 8;
      }
      if (
        hasWest &&
        !this.isWallTileAt(tileX - 1, tileY + 1) &&
        (edgeCutMask & 64) === 0
      ) {
        edgeTerminalMask |= 64;
      }
      if (
        hasWest &&
        !this.isWallTileAt(tileX - 1, tileY - 1) &&
        (edgeCutMask & 128) === 0
      ) {
        edgeTerminalMask |= 128;
      }
    }

    if (trimmedAlongY) {
      const hasNorth = this.isWallTileAt(tileX, tileY - 1);
      const hasSouth = this.isWallTileAt(tileX, tileY + 1);
      if (hasNorth) {
        edgeMask |= 1;
      }
      if (hasSouth) {
        edgeMask |= 4;
      }
      const northChamferMask = hasNorth
        ? this.getWallChamferMaskAt(tileX, tileY - 1)
        : 0;
      const southChamferMask = hasSouth
        ? this.getWallChamferMaskAt(tileX, tileY + 1)
        : 0;
      if (northChamferMask & 8) {
        edgeCutMask |= 1;
      }
      if (northChamferMask & 4) {
        edgeCutMask |= 2;
      }
      if (southChamferMask & 2) {
        edgeCutMask |= 16;
      }
      if (southChamferMask & 1) {
        edgeCutMask |= 32;
      }
      if (
        hasNorth &&
        !this.isWallTileAt(tileX - 1, tileY - 1) &&
        (edgeCutMask & 1) === 0
      ) {
        edgeTerminalMask |= 1;
      }
      if (
        hasNorth &&
        !this.isWallTileAt(tileX + 1, tileY - 1) &&
        (edgeCutMask & 2) === 0
      ) {
        edgeTerminalMask |= 2;
      }
      if (
        hasSouth &&
        !this.isWallTileAt(tileX + 1, tileY + 1) &&
        (edgeCutMask & 16) === 0
      ) {
        edgeTerminalMask |= 16;
      }
      if (
        hasSouth &&
        !this.isWallTileAt(tileX - 1, tileY + 1) &&
        (edgeCutMask & 32) === 0
      ) {
        edgeTerminalMask |= 32;
      }
    }

    return {
      edgeMask,
      cornerMask: 0,
      edgeCutMask,
      edgeTerminalMask,
    };
  }

  createFloorBlockAmbientOcclusionTexture(
    edgeMask: number,
    cornerMask: number,
    edgeCutMask: number,
    edgeTerminalMask: number,
  ): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, size, size);
      const depth = Math.max(16, Math.floor(size * 0.4));
      // Make ambient occlusion darker in FPS mode
      const maxAlpha = this.dependencies.movementInput.isFpsMode() ? 0.55 : 0.24;
      const edgeTrim = Math.max(24, Math.floor(depth * 0.95));
      const taper = Math.max(24, Math.floor(depth * 1.4));
      const terminalTaper = Math.max(10, Math.floor(depth * 0.5));
      const applyHorizontalEndTaper = (
        startX: number,
        y: number,
        width: number,
        height: number,
        fadeStart: boolean,
      ): void => {
        if (width <= 0 || height <= 0) {
          return;
        }
        context.save();
        context.globalCompositeOperation = "destination-out";
        const gradient = context.createLinearGradient(
          startX,
          0,
          startX + width,
          0,
        );
        if (fadeStart) {
          gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
          gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        } else {
          gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
          gradient.addColorStop(1, "rgba(0, 0, 0, 1)");
        }
        context.fillStyle = gradient;
        context.fillRect(startX, y, width, height);
        context.restore();
      };
      const applyVerticalEndTaper = (
        x: number,
        startY: number,
        width: number,
        height: number,
        fadeStart: boolean,
      ): void => {
        if (width <= 0 || height <= 0) {
          return;
        }
        context.save();
        context.globalCompositeOperation = "destination-out";
        const gradient = context.createLinearGradient(
          0,
          startY,
          0,
          startY + height,
        );
        if (fadeStart) {
          gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
          gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        } else {
          gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
          gradient.addColorStop(1, "rgba(0, 0, 0, 1)");
        }
        context.fillStyle = gradient;
        context.fillRect(x, startY, width, height);
        context.restore();
      };
      if (edgeMask & 1) {
        const leftTrim = edgeCutMask & 1 ? edgeTrim : 0;
        const rightTrim = edgeCutMask & 2 ? edgeTrim : 0;
        const width = size - leftTrim - rightTrim;
        if (width > 0) {
          const northGradient = context.createLinearGradient(0, 0, 0, depth);
          northGradient.addColorStop(0, `rgba(0, 0, 0, ${maxAlpha})`);
          northGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          context.fillStyle = northGradient;
          context.fillRect(leftTrim, 0, width, depth);
          if (leftTrim > 0 || (edgeTerminalMask & 1) !== 0) {
            const taperWidth = Math.min(
              leftTrim > 0 ? taper : terminalTaper,
              width,
            );
            applyHorizontalEndTaper(leftTrim, 0, taperWidth, depth, true);
          }
          if (rightTrim > 0 || (edgeTerminalMask & 2) !== 0) {
            const taperWidth = Math.min(
              rightTrim > 0 ? taper : terminalTaper,
              width,
            );
            applyHorizontalEndTaper(
              leftTrim + width - taperWidth,
              0,
              taperWidth,
              depth,
              false,
            );
          }
        }
      }
      if (edgeMask & 2) {
        const topTrim = edgeCutMask & 4 ? edgeTrim : 0;
        const bottomTrim = edgeCutMask & 8 ? edgeTrim : 0;
        const height = size - topTrim - bottomTrim;
        if (height > 0) {
          const eastGradient = context.createLinearGradient(
            size,
            0,
            size - depth,
            0,
          );
          eastGradient.addColorStop(0, `rgba(0, 0, 0, ${maxAlpha})`);
          eastGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          context.fillStyle = eastGradient;
          context.fillRect(size - depth, topTrim, depth, height);
          if (topTrim > 0 || (edgeTerminalMask & 4) !== 0) {
            const taperHeight = Math.min(
              topTrim > 0 ? taper : terminalTaper,
              height,
            );
            applyVerticalEndTaper(
              size - depth,
              topTrim,
              depth,
              taperHeight,
              true,
            );
          }
          if (bottomTrim > 0 || (edgeTerminalMask & 8) !== 0) {
            const taperHeight = Math.min(
              bottomTrim > 0 ? taper : terminalTaper,
              height,
            );
            applyVerticalEndTaper(
              size - depth,
              topTrim + height - taperHeight,
              depth,
              taperHeight,
              false,
            );
          }
        }
      }
      if (edgeMask & 4) {
        const rightTrim = edgeCutMask & 16 ? edgeTrim : 0;
        const leftTrim = edgeCutMask & 32 ? edgeTrim : 0;
        const width = size - leftTrim - rightTrim;
        if (width > 0) {
          const southGradient = context.createLinearGradient(
            0,
            size,
            0,
            size - depth,
          );
          southGradient.addColorStop(0, `rgba(0, 0, 0, ${maxAlpha})`);
          southGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          context.fillStyle = southGradient;
          context.fillRect(leftTrim, size - depth, width, depth);
          if (leftTrim > 0 || (edgeTerminalMask & 32) !== 0) {
            const taperWidth = Math.min(
              leftTrim > 0 ? taper : terminalTaper,
              width,
            );
            applyHorizontalEndTaper(
              leftTrim,
              size - depth,
              taperWidth,
              depth,
              true,
            );
          }
          if (rightTrim > 0 || (edgeTerminalMask & 16) !== 0) {
            const taperWidth = Math.min(
              rightTrim > 0 ? taper : terminalTaper,
              width,
            );
            applyHorizontalEndTaper(
              leftTrim + width - taperWidth,
              size - depth,
              taperWidth,
              depth,
              false,
            );
          }
        }
      }
      if (edgeMask & 8) {
        const bottomTrim = edgeCutMask & 64 ? edgeTrim : 0;
        const topTrim = edgeCutMask & 128 ? edgeTrim : 0;
        const height = size - topTrim - bottomTrim;
        if (height > 0) {
          const westGradient = context.createLinearGradient(0, 0, depth, 0);
          westGradient.addColorStop(0, `rgba(0, 0, 0, ${maxAlpha})`);
          westGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          context.fillStyle = westGradient;
          context.fillRect(0, topTrim, depth, height);
          if (topTrim > 0 || (edgeTerminalMask & 128) !== 0) {
            const taperHeight = Math.min(
              topTrim > 0 ? taper : terminalTaper,
              height,
            );
            applyVerticalEndTaper(0, topTrim, depth, taperHeight, true);
          }
          if (bottomTrim > 0 || (edgeTerminalMask & 64) !== 0) {
            const taperHeight = Math.min(
              bottomTrim > 0 ? taper : terminalTaper,
              height,
            );
            applyVerticalEndTaper(
              0,
              topTrim + height - taperHeight,
              depth,
              taperHeight,
              false,
            );
          }
        }
      }

      const cornerRadius = Math.max(depth, Math.floor(size * 0.46));
      const cornerAlpha = 0.2;
      if (cornerMask & 1) {
        const nwGradient = context.createRadialGradient(
          0,
          0,
          0,
          0,
          0,
          cornerRadius,
        );
        nwGradient.addColorStop(0, `rgba(0, 0, 0, ${cornerAlpha})`);
        nwGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = nwGradient;
        context.fillRect(0, 0, cornerRadius, cornerRadius);
      }
      if (cornerMask & 2) {
        const neGradient = context.createRadialGradient(
          size,
          0,
          0,
          size,
          0,
          cornerRadius,
        );
        neGradient.addColorStop(0, `rgba(0, 0, 0, ${cornerAlpha})`);
        neGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = neGradient;
        context.fillRect(size - cornerRadius, 0, cornerRadius, cornerRadius);
      }
      if (cornerMask & 4) {
        const seGradient = context.createRadialGradient(
          size,
          size,
          0,
          size,
          size,
          cornerRadius,
        );
        seGradient.addColorStop(0, `rgba(0, 0, 0, ${cornerAlpha})`);
        seGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = seGradient;
        context.fillRect(
          size - cornerRadius,
          size - cornerRadius,
          cornerRadius,
          cornerRadius,
        );
      }
      if (cornerMask & 8) {
        const swGradient = context.createRadialGradient(
          0,
          size,
          0,
          0,
          size,
          cornerRadius,
        );
        swGradient.addColorStop(0, `rgba(0, 0, 0, ${cornerAlpha})`);
        swGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = swGradient;
        context.fillRect(0, size - cornerRadius, cornerRadius, cornerRadius);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  getFloorBlockAmbientOcclusionTexture(
    edgeMask: number,
    cornerMask: number,
    edgeCutMask: number,
    edgeTerminalMask: number,
  ): THREE.CanvasTexture {
    const clampedEdgeMask = Math.max(0, Math.min(15, Math.trunc(edgeMask)));
    const clampedCornerMask = Math.max(0, Math.min(15, Math.trunc(cornerMask)));
    const clampedEdgeCutMask = Math.max(
      0,
      Math.min(255, Math.trunc(edgeCutMask)),
    );
    const clampedEdgeTerminalMask = Math.max(
      0,
      Math.min(255, Math.trunc(edgeTerminalMask)),
    );
    const cacheKey =
      clampedEdgeMask |
      (clampedCornerMask << 4) |
      (clampedEdgeCutMask << 8) |
      (clampedEdgeTerminalMask << 16);
    const cached = this.floorBlockAmbientOcclusionTextureCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const created = this.createFloorBlockAmbientOcclusionTexture(
      clampedEdgeMask,
      clampedCornerMask,
      clampedEdgeCutMask,
      clampedEdgeTerminalMask,
    );
    this.floorBlockAmbientOcclusionTextureCache.set(cacheKey, created);
    return created;
  }

  removeFloorBlockAmbientOcclusionOverlay(key: string): void {
    const overlay = this.floorBlockAmbientOcclusionOverlays.get(key);
    if (!overlay) {
      return;
    }
    this.dependencies.renderPipeline.scene.remove(overlay);
    if (overlay.material instanceof THREE.MeshBasicMaterial) {
      overlay.material.dispose();
    }
    this.floorBlockAmbientOcclusionOverlays.delete(key);
  }

  removeTrimmedDoorInsetAmbientOcclusionOverlay(key: string): void {
    const overlayGroup = this.trimmedDoorInsetAmbientOcclusionOverlays.get(key);
    if (!overlayGroup) {
      return;
    }
    this.dependencies.renderPipeline.scene.remove(overlayGroup);
    for (const child of overlayGroup.children) {
      if (child instanceof THREE.Mesh) {
        if (child.geometry !== this.dependencies.tileRendering.floorGeometry) {
          child.geometry.dispose();
        }
        if (child.material instanceof THREE.MeshBasicMaterial) {
          child.material.dispose();
        }
      }
    }
    this.trimmedDoorInsetAmbientOcclusionOverlays.delete(key);
  }

  createFloorGeometryWithUvWindow(
    uMin: number,
    uMax: number,
    vMin: number,
    vMax: number,
  ): THREE.PlaneGeometry {
    const geometry = this.dependencies.tileRendering.floorGeometry.clone();
    const uv = geometry.getAttribute("uv");
    if (uv instanceof THREE.BufferAttribute) {
      const clampedUMin = THREE.MathUtils.clamp(uMin, 0, 1);
      const clampedUMax = THREE.MathUtils.clamp(uMax, 0, 1);
      const clampedVMin = THREE.MathUtils.clamp(vMin, 0, 1);
      const clampedVMax = THREE.MathUtils.clamp(vMax, 0, 1);
      for (let i = 0; i < uv.count; i += 1) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        uv.setXY(
          i,
          THREE.MathUtils.lerp(clampedUMin, clampedUMax, u),
          THREE.MathUtils.lerp(clampedVMin, clampedVMax, v),
        );
      }
      uv.needsUpdate = true;
    }
    return geometry;
  }

  refreshTrimmedDoorInsetAmbientOcclusionAt(
    tileX: number,
    tileY: number,
    doorTransform: {
      scaleX: number;
      scaleY: number;
      offsetX: number;
      offsetY: number;
    },
  ): void {
    const key = `${tileX},${tileY}`;
    const half = TILE_SIZE / 2;
    const epsilon = TILE_SIZE * 0.005;
    const minX = -half * doorTransform.scaleX + doorTransform.offsetX;
    const maxX = half * doorTransform.scaleX + doorTransform.offsetX;
    const minY = -half * doorTransform.scaleY + doorTransform.offsetY;
    const maxY = half * doorTransform.scaleY + doorTransform.offsetY;
    const strips: Array<{
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      edgeMask: number;
    }> = [];

    const westWidth = minX + half;
    if (westWidth > epsilon) {
      strips.push({
        centerX: (-half + minX) / 2,
        centerY: 0,
        width: westWidth,
        height: TILE_SIZE,
        edgeMask: 2,
      });
    }
    const eastWidth = half - maxX;
    if (eastWidth > epsilon) {
      strips.push({
        centerX: (maxX + half) / 2,
        centerY: 0,
        width: eastWidth,
        height: TILE_SIZE,
        edgeMask: 8,
      });
    }
    const southHeight = minY + half;
    if (southHeight > epsilon) {
      strips.push({
        centerX: 0,
        centerY: (-half + minY) / 2,
        width: TILE_SIZE,
        height: southHeight,
        edgeMask: 1,
      });
    }
    const northHeight = half - maxY;
    if (northHeight > epsilon) {
      strips.push({
        centerX: 0,
        centerY: (maxY + half) / 2,
        width: TILE_SIZE,
        height: northHeight,
        edgeMask: 4,
      });
    }

    if (strips.length === 0) {
      this.removeTrimmedDoorInsetAmbientOcclusionOverlay(key);
      return;
    }

    let overlayGroup = this.trimmedDoorInsetAmbientOcclusionOverlays.get(key);
    if (!overlayGroup) {
      overlayGroup = new THREE.Group();
      this.dependencies.renderPipeline.scene.add(overlayGroup);
      this.trimmedDoorInsetAmbientOcclusionOverlays.set(key, overlayGroup);
    } else {
      for (const child of overlayGroup.children) {
        if (child instanceof THREE.Mesh) {
          if (child.geometry !== this.dependencies.tileRendering.floorGeometry) {
            child.geometry.dispose();
          }
          if (child.material instanceof THREE.MeshBasicMaterial) {
            child.material.dispose();
          }
        }
      }
      overlayGroup.clear();
    }

    for (const strip of strips) {
      const texture = this.getFloorBlockAmbientOcclusionTexture(
        strip.edgeMask,
        0,
        0,
        0,
      );
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      });
      this.dependencies.lighting.patchMaterialForVignette(material);
      const widthFraction = THREE.MathUtils.clamp(
        strip.width / TILE_SIZE,
        0,
        1,
      );
      const heightFraction = THREE.MathUtils.clamp(
        strip.height / TILE_SIZE,
        0,
        1,
      );
      // Match the AO texture's edge-fade footprint (depth ~= 40% of tile).
      // For very narrow strips, sample at least this much UV span so we avoid
      // pulling only the darkest texels across the whole strip.
      const aoDepthFraction = 0.4;
      let uMin = 0;
      let uMax = 1;
      let vMin = 0;
      let vMax = 1;
      if (strip.edgeMask === 2) {
        // West-side exposed strip: sample near AO texture's east edge so AO hugs door.
        const uSpan = Math.max(widthFraction, aoDepthFraction);
        uMin = 1 - uSpan;
        uMax = 1;
      } else if (strip.edgeMask === 8) {
        // East-side exposed strip: sample near AO texture's west edge.
        uMin = 0;
        uMax = Math.max(widthFraction, aoDepthFraction);
      } else if (strip.edgeMask === 1) {
        // South-side exposed strip: sample near AO texture's north edge.
        const vSpan = Math.max(heightFraction, aoDepthFraction);
        vMin = 1 - vSpan;
        vMax = 1;
      } else if (strip.edgeMask === 4) {
        // North-side exposed strip: sample near AO texture's south edge.
        vMin = 0;
        vMax = Math.max(heightFraction, aoDepthFraction);
      }
      const overlayGeometry = this.createFloorGeometryWithUvWindow(
        uMin,
        uMax,
        vMin,
        vMax,
      );
      const overlay = new THREE.Mesh(overlayGeometry, material);
      overlay.castShadow = false;
      overlay.receiveShadow = false;
      overlay.renderOrder = 113;
      overlay.position.set(
        tileX * TILE_SIZE + strip.centerX,
        -tileY * TILE_SIZE + strip.centerY,
        this.fpsWallChamferFloorAmbientOcclusionOverlayZ,
      );
      overlay.scale.set(strip.width / TILE_SIZE, strip.height / TILE_SIZE, 1);
      overlayGroup.add(overlay);
    }
  }

  refreshFloorBlockAmbientOcclusionAt(
    tileX: number,
    tileY: number,
  ): void {
    this.floorBatch.update(tileX, tileY);
  }

  private updateFloorBlockAmbientOcclusionAt(tileX: number, tileY: number): void {
    const key = `${tileX},${tileY}`;
    const mesh = this.dependencies.tileRendering.tileMap.get(key);
    if (!mesh || this.dependencies.engineState.clientOptions.blockAmbientOcclusion !== true) {
      this.removeFloorBlockAmbientOcclusionOverlay(key);
      this.removeTrimmedDoorInsetAmbientOcclusionOverlay(key);
      return;
    }
    const closedDoorGlyph = this.getClosedDoorGlyphFromMesh(mesh);
    const doorTransform =
      closedDoorGlyph !== null
        ? this.dependencies.wallGeometry.getFpsClosedDoorChamferTransform(tileX, tileY, closedDoorGlyph)
        : null;
    const hasTrimmedDoorFloorUnderlay =
      this.dependencies.movementInput.isFpsMode() &&
      Boolean(mesh.userData?.transparentWallGroundPlaneOverlay) &&
      doorTransform !== null &&
      (doorTransform.scaleX < 0.9999 || doorTransform.scaleY < 0.9999);
    if (mesh.userData?.isWall && !hasTrimmedDoorFloorUnderlay) {
      this.removeFloorBlockAmbientOcclusionOverlay(key);
      this.removeTrimmedDoorInsetAmbientOcclusionOverlay(key);
      return;
    }

    const { edgeMask, cornerMask, edgeCutMask, edgeTerminalMask } =
      this.computeFloorBlockAmbientOcclusionMasks(tileX, tileY);
    if (edgeMask === 0 && cornerMask === 0) {
      this.removeFloorBlockAmbientOcclusionOverlay(key);
    } else {
      const texture = this.getFloorBlockAmbientOcclusionTexture(
        edgeMask,
        cornerMask,
        edgeCutMask,
        edgeTerminalMask,
      );
      let overlay = this.floorBlockAmbientOcclusionOverlays.get(key);
      if (!overlay) {
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
        });
        this.dependencies.lighting.patchMaterialForVignette(material);
        overlay = new THREE.Mesh(this.dependencies.tileRendering.floorGeometry, material);
        overlay.castShadow = false;
        overlay.receiveShadow = false;
        overlay.renderOrder = 112;
        this.dependencies.renderPipeline.scene.add(overlay);
        this.floorBlockAmbientOcclusionOverlays.set(key, overlay);
      } else if (
        overlay.material instanceof THREE.MeshBasicMaterial &&
        overlay.material.map !== texture
      ) {
        overlay.material.map = texture;
        overlay.material.needsUpdate = true;
      }

      if (hasTrimmedDoorFloorUnderlay) {
        overlay.position.set(
          tileX * TILE_SIZE,
          -tileY * TILE_SIZE,
          this.fpsWallChamferFloorAmbientOcclusionOverlayZ,
        );
        overlay.scale.set(1, 1, 1);
      } else {
        overlay.position.set(
          mesh.position.x,
          mesh.position.y,
          mesh.position.z + this.floorBlockAmbientOcclusionOverlayZ,
        );
        overlay.scale.copy(mesh.scale);
      }
    }

    if (hasTrimmedDoorFloorUnderlay && doorTransform) {
      this.refreshTrimmedDoorInsetAmbientOcclusionAt(
        tileX,
        tileY,
        doorTransform,
      );
    } else {
      this.removeTrimmedDoorInsetAmbientOcclusionOverlay(key);
    }
  }

  refreshFloorBlockAmbientOcclusionNear(
    tileX: number,
    tileY: number,
  ): void {
    this.refreshFloorBlockAmbientOcclusionAt(tileX, tileY);
    this.refreshFloorBlockAmbientOcclusionAt(tileX, tileY - 1);
    this.refreshFloorBlockAmbientOcclusionAt(tileX + 1, tileY);
    this.refreshFloorBlockAmbientOcclusionAt(tileX, tileY + 1);
    this.refreshFloorBlockAmbientOcclusionAt(tileX - 1, tileY);
    this.refreshFloorBlockAmbientOcclusionAt(tileX - 1, tileY - 1);
    this.refreshFloorBlockAmbientOcclusionAt(tileX + 1, tileY - 1);
    this.refreshFloorBlockAmbientOcclusionAt(tileX + 1, tileY + 1);
    this.refreshFloorBlockAmbientOcclusionAt(tileX - 1, tileY + 1);
  }

  removeFpsWallChamferFloorAmbientOcclusionOverlay(key: string): void {
    const overlay = this.fpsWallChamferFloorAmbientOcclusionOverlays.get(key);
    if (!overlay) {
      return;
    }
    this.dependencies.renderPipeline.scene.remove(overlay);
    if (overlay.material instanceof THREE.MeshBasicMaterial) {
      overlay.material.dispose();
    }
    this.fpsWallChamferFloorAmbientOcclusionOverlays.delete(key);
  }

  refreshFpsWallChamferFloorAmbientOcclusionAt(
    tileX: number,
    tileY: number,
  ): void {
    this.chamferBatch.update(tileX, tileY);
  }

  private updateFpsWallChamferFloorAmbientOcclusionAt(tileX: number, tileY: number): void {
    const key = `${tileX},${tileY}`;
    const chamferFloor = this.dependencies.wallGeometry.fpsWallChamferFloorMeshes.get(key);
    if (
      !chamferFloor ||
      this.dependencies.engineState.clientOptions.blockAmbientOcclusion !== true ||
      !this.dependencies.movementInput.isFpsMode()
    ) {
      this.removeFpsWallChamferFloorAmbientOcclusionOverlay(key);
      return;
    }

    const { edgeMask, cornerMask, edgeCutMask, edgeTerminalMask } =
      this.computeFloorBlockAmbientOcclusionMasks(tileX, tileY);
    if (edgeMask === 0 && cornerMask === 0) {
      this.removeFpsWallChamferFloorAmbientOcclusionOverlay(key);
      return;
    }

    const texture = this.getFloorBlockAmbientOcclusionTexture(
      edgeMask,
      cornerMask,
      edgeCutMask,
      edgeTerminalMask,
    );
    let overlay = this.fpsWallChamferFloorAmbientOcclusionOverlays.get(key);
    if (!overlay) {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      });
      this.dependencies.lighting.patchMaterialForVignette(material);
      overlay = new THREE.Mesh(chamferFloor.geometry, material);
      overlay.castShadow = false;
      overlay.receiveShadow = false;
      overlay.renderOrder = chamferFloor.renderOrder + 1;
      this.dependencies.renderPipeline.scene.add(overlay);
      this.fpsWallChamferFloorAmbientOcclusionOverlays.set(key, overlay);
    } else {
      if (overlay.geometry !== chamferFloor.geometry) {
        overlay.geometry = chamferFloor.geometry;
      }
      if (
        overlay.material instanceof THREE.MeshBasicMaterial &&
        overlay.material.map !== texture
      ) {
        overlay.material.map = texture;
        overlay.material.needsUpdate = true;
      }
    }

    overlay.position.set(
      chamferFloor.position.x,
      chamferFloor.position.y,
      chamferFloor.position.z +
        this.fpsWallChamferFloorAmbientOcclusionOverlayZ,
    );
    overlay.scale.copy(chamferFloor.scale);
  }

  refreshFpsWallChamferFloorAmbientOcclusionNear(
    tileX: number,
    tileY: number,
  ): void {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        this.refreshFpsWallChamferFloorAmbientOcclusionAt(
          tileX + dx,
          tileY + dy,
        );
      }
    }
  }

  refreshAllFloorBlockAmbientOcclusion(): void {
    if (this.dependencies.engineState.clientOptions.blockAmbientOcclusion !== true) {
      for (const key of Array.from(
        this.floorBlockAmbientOcclusionOverlays.keys(),
      )) {
        this.removeFloorBlockAmbientOcclusionOverlay(key);
      }
      for (const key of Array.from(
        this.trimmedDoorInsetAmbientOcclusionOverlays.keys(),
      )) {
        this.removeTrimmedDoorInsetAmbientOcclusionOverlay(key);
      }
      for (const key of Array.from(
        this.fpsWallChamferFloorAmbientOcclusionOverlays.keys(),
      )) {
        this.removeFpsWallChamferFloorAmbientOcclusionOverlay(key);
      }
      return;
    }
    for (const mesh of this.dependencies.tileRendering.tileMap.values()) {
      const tileX =
        typeof mesh.userData?.tileX === "number"
          ? Math.trunc(mesh.userData.tileX)
          : null;
      const tileY =
        typeof mesh.userData?.tileY === "number"
          ? Math.trunc(mesh.userData.tileY)
          : null;
      if (tileX === null || tileY === null) {
        continue;
      }
      this.refreshFloorBlockAmbientOcclusionAt(tileX, tileY);
    }
    for (const key of this.dependencies.wallGeometry.fpsWallChamferFloorMeshes.keys()) {
      const [rawX, rawY] = key.split(",");
      const tileX = Number.parseInt(rawX, 10);
      const tileY = Number.parseInt(rawY, 10);
      if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
        continue;
      }
      this.refreshFpsWallChamferFloorAmbientOcclusionAt(tileX, tileY);
    }
  }

  clearFloorBlockAmbientOcclusion(): void {
    for (const key of Array.from(
      this.floorBlockAmbientOcclusionOverlays.keys(),
    )) {
      this.removeFloorBlockAmbientOcclusionOverlay(key);
    }
    for (const key of Array.from(
      this.trimmedDoorInsetAmbientOcclusionOverlays.keys(),
    )) {
      this.removeTrimmedDoorInsetAmbientOcclusionOverlay(key);
    }
    for (const key of Array.from(
      this.fpsWallChamferFloorAmbientOcclusionOverlays.keys(),
    )) {
      this.removeFpsWallChamferFloorAmbientOcclusionOverlay(key);
    }
    for (const texture of this.floorBlockAmbientOcclusionTextureCache.values()) {
      texture.dispose();
    }
    this.floorBlockAmbientOcclusionTextureCache.clear();
  }
}
