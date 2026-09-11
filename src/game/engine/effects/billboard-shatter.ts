import * as THREE from "three";
import { TILE_SIZE } from "../../constants";
import type {
  BillboardShardDescriptor,
  MonsterBillboardShatterOptions,
  RuntimeMonsterBillboardAppearance
} from "../shared/types";
import type { BloodParticles } from "./blood-particles";
import type { Camera } from "../camera/camera";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "../rendering/entity-billboards";
import type { Lighting } from "../rendering/lighting";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { RuntimeEntityTracking } from "../world/runtime-entity-tracking";
import type { TilesetAssets } from "../rendering/tileset-assets";

export interface BillboardShatterDependencies {
  readonly bloodParticles: Pick<
    BloodParticles,
    "monsterBillboardShardBaseHorizontalSpeed"
    | "monsterBillboardShardBoundaryRed2x2ChancePercent"
    | "monsterBillboardShardBoundaryRedBleedChancePercent"
    | "monsterBillboardShardBoundaryRedChancePercent"
    | "monsterBillboardShardFadeStartMs"
    | "monsterBillboardShardHorizontalVariance"
    | "monsterBillboardShardImpulseTowardPlayer"
    | "monsterBillboardShardLifetimeMs"
    | "monsterBillboardShardMaxPieces"
    | "monsterBillboardShardParticles"
    | "monsterBillboardShardVerticalBaseSpeed"
    | "monsterBillboardShardVerticalVariance"
  >;
  readonly camera: Pick<
    Camera,
    "camera"
    | "cameraYaw"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "detachMonsterBillboard"
    | "disposeDetachedMonsterBillboard"
    | "ensureMonsterBillboard"
    | "monsterBillboards"
  >;
  readonly lighting: Pick<
    Lighting,
    "patchMaterialForVignette"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "scene"
  >;
  readonly runtimeEntityTracking: Pick<
    RuntimeEntityTracking,
    "normalizeRuntimeMonsterId"
    | "resolveRuntimeMonsterBillboardAppearanceById"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "resolveTextureAnisotropyLevel"
  >;
}

/** Billboard fracture masks and shard construction for defeat effects */
export class BillboardShatter {
  constructor(private readonly dependencies: BillboardShatterDependencies) {}

  resolveMonsterBillboardTextureSource(texture: THREE.Texture): {
    source: CanvasImageSource;
    width: number;
    height: number;
  } | null {
    const imageLike = texture.image as
      | (CanvasImageSource & { width?: number; height?: number })
      | undefined;
    if (!imageLike) {
      return null;
    }
    const width = Math.max(0, Math.trunc(Number(imageLike.width) || 0));
    const height = Math.max(0, Math.trunc(Number(imageLike.height) || 0));
    if (width <= 0 || height <= 0) {
      return null;
    }
    return {
      source: imageLike,
      width,
      height,
    };
  }

  resolveMonsterBillboardSplitGridAxisSize(axisPixels: number): number {
    const normalized = Math.max(2, Math.trunc(axisPixels));
    const maxCells = Math.max(2, Math.min(40, normalized));
    const minCells = Math.max(2, Math.min(8, maxCells));

    for (let cells = maxCells; cells >= minCells; cells -= 1) {
      if (normalized % cells === 0) {
        return cells;
      }
    }

    const approx = Math.round(normalized / 8);
    return THREE.MathUtils.clamp(approx, minCells, maxCells);
  }

  pickRandomMonsterBillboardSplitEdgeTarget(
    gridWidth: number,
    gridHeight: number,
  ): { x: number; y: number } {
    const edge = THREE.MathUtils.randInt(0, 3);
    switch (edge) {
      case 0:
        return { x: 0, y: THREE.MathUtils.randInt(0, gridHeight - 1) };
      case 1:
        return {
          x: gridWidth - 1,
          y: THREE.MathUtils.randInt(0, gridHeight - 1),
        };
      case 2:
        return { x: THREE.MathUtils.randInt(0, gridWidth - 1), y: 0 };
      default:
        return {
          x: THREE.MathUtils.randInt(0, gridWidth - 1),
          y: gridHeight - 1,
        };
    }
  }

  traceMonsterBillboardLightningSplitPath(
    splitMask: Uint8Array,
    gridWidth: number,
    gridHeight: number,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    branchBudget: number,
  ): void {
    let x = THREE.MathUtils.clamp(Math.trunc(startX), 0, gridWidth - 1);
    let y = THREE.MathUtils.clamp(Math.trunc(startY), 0, gridHeight - 1);
    const clampedTargetX = THREE.MathUtils.clamp(
      Math.trunc(targetX),
      0,
      gridWidth - 1,
    );
    const clampedTargetY = THREE.MathUtils.clamp(
      Math.trunc(targetY),
      0,
      gridHeight - 1,
    );
    const maxSteps = (gridWidth + gridHeight) * 4;

    for (let step = 0; step < maxSteps; step += 1) {
      splitMask[y * gridWidth + x] = 1;
      if (x === clampedTargetX && y === clampedTargetY) {
        break;
      }

      const remainingX = clampedTargetX - x;
      const remainingY = clampedTargetY - y;
      let stepX = Math.sign(remainingX);
      let stepY = Math.sign(remainingY);
      const preferX = Math.abs(remainingX) >= Math.abs(remainingY);
      const jitterRoll = Math.random();

      if (jitterRoll < 0.42) {
        if (preferX) {
          stepY += THREE.MathUtils.randInt(-1, 1);
        } else {
          stepX += THREE.MathUtils.randInt(-1, 1);
        }
      } else if (jitterRoll < 0.57) {
        if (preferX) {
          stepX = Math.sign(remainingX);
          stepY = remainingY === 0 ? THREE.MathUtils.randInt(-1, 1) : 0;
        } else {
          stepY = Math.sign(remainingY);
          stepX = remainingX === 0 ? THREE.MathUtils.randInt(-1, 1) : 0;
        }
      }

      stepX = THREE.MathUtils.clamp(stepX, -1, 1);
      stepY = THREE.MathUtils.clamp(stepY, -1, 1);
      if (stepX === 0 && stepY === 0) {
        if (Math.abs(remainingX) >= Math.abs(remainingY)) {
          stepX = Math.sign(remainingX) || (Math.random() < 0.5 ? -1 : 1);
        } else {
          stepY = Math.sign(remainingY) || (Math.random() < 0.5 ? -1 : 1);
        }
      }

      const nextX = THREE.MathUtils.clamp(x + stepX, 0, gridWidth - 1);
      const nextY = THREE.MathUtils.clamp(y + stepY, 0, gridHeight - 1);
      if (nextX === x && nextY === y) {
        break;
      }

      if (branchBudget > 0 && step > 2 && Math.random() < 0.085) {
        const branchTarget = this.pickRandomMonsterBillboardSplitEdgeTarget(
          gridWidth,
          gridHeight,
        );
        this.traceMonsterBillboardLightningSplitPath(
          splitMask,
          gridWidth,
          gridHeight,
          x,
          y,
          branchTarget.x,
          branchTarget.y,
          branchBudget - 1,
        );
      }

      x = nextX;
      y = nextY;
    }

    splitMask[clampedTargetY * gridWidth + clampedTargetX] = 1;
  }

  buildMonsterBillboardLightningSplitMask(
    gridWidth: number,
    gridHeight: number,
    startX: number,
    startY: number,
    targetCountOverride?: number,
  ): Uint8Array {
    const splitMask = new Uint8Array(gridWidth * gridHeight);
    const targetCount = Math.max(
      1,
      Number.isFinite(targetCountOverride)
        ? Math.trunc(targetCountOverride ?? 1)
        : 8,
    );
    const targets: { x: number; y: number }[] = [];
    const uniqueTargetKeys = new Set(
      targets.map((target) => `${target.x},${target.y}`),
    );
    let uniqueAttempts = 0;
    while (targets.length < targetCount && uniqueAttempts < targetCount * 8) {
      const candidate = this.pickRandomMonsterBillboardSplitEdgeTarget(
        gridWidth,
        gridHeight,
      );
      const key = `${candidate.x},${candidate.y}`;
      if (!uniqueTargetKeys.has(key)) {
        targets.push(candidate);
        uniqueTargetKeys.add(key);
      }
      uniqueAttempts += 1;
    }
    while (targets.length < targetCount) {
      targets.push(
        this.pickRandomMonsterBillboardSplitEdgeTarget(gridWidth, gridHeight),
      );
    }

    for (const target of targets) {
      this.traceMonsterBillboardLightningSplitPath(
        splitMask,
        gridWidth,
        gridHeight,
        startX,
        startY,
        target.x,
        target.y,
        1,
      );
    }
    splitMask[startY * gridWidth + startX] = 1;

    return splitMask;
  }

  collectMonsterBillboardSplitRegions(
    gridWidth: number,
    gridHeight: number,
    splitMask: Uint8Array,
    occupiedMask: Uint8Array,
  ): number[][] {
    const regionCells: number[][] = [];
    const visited = new Uint8Array(gridWidth * gridHeight);
    const queue: number[] = [];

    for (let y = 0; y < gridHeight; y += 1) {
      for (let x = 0; x < gridWidth; x += 1) {
        const startIndex = y * gridWidth + x;
        if (
          splitMask[startIndex] === 1 ||
          visited[startIndex] === 1 ||
          occupiedMask[startIndex] === 0
        ) {
          continue;
        }

        queue.length = 0;
        queue.push(startIndex);
        visited[startIndex] = 1;
        const region: number[] = [];

        while (queue.length > 0) {
          const current = queue.pop();
          if (current === undefined) {
            continue;
          }
          region.push(current);

          const currentX = current % gridWidth;
          const currentY = Math.floor(current / gridWidth);
          const neighbors = [
            currentX > 0 ? current - 1 : -1,
            currentX < gridWidth - 1 ? current + 1 : -1,
            currentY > 0 ? current - gridWidth : -1,
            currentY < gridHeight - 1 ? current + gridWidth : -1,
          ];

          for (const neighbor of neighbors) {
            if (neighbor < 0) {
              continue;
            }
            if (
              splitMask[neighbor] === 1 ||
              visited[neighbor] === 1 ||
              occupiedMask[neighbor] === 0
            ) {
              continue;
            }
            visited[neighbor] = 1;
            queue.push(neighbor);
          }
        }

        if (region.length > 0) {
          regionCells.push(region);
        }
      }
    }

    return regionCells;
  }

  sampleMonsterBillboardSplitOccupancyMask(
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    gridWidth: number,
    gridHeight: number,
  ): Uint8Array | null {
    const canvas = document.createElement("canvas");
    canvas.width = gridWidth;
    canvas.height = gridHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.clearRect(0, 0, gridWidth, gridHeight);
    context.imageSmoothingEnabled = false;
    context.drawImage(
      source,
      0,
      0,
      sourceWidth,
      sourceHeight,
      0,
      0,
      gridWidth,
      gridHeight,
    );
    const sampled = context.getImageData(0, 0, gridWidth, gridHeight).data;
    const occupied = new Uint8Array(gridWidth * gridHeight);

    for (let i = 0; i < occupied.length; i += 1) {
      const alpha = sampled[i * 4 + 3];
      occupied[i] = alpha >= 12 ? 1 : 0;
    }

    return occupied;
  }

  createMonsterBillboardShardDescriptors(
    texture: THREE.Texture,
    options: MonsterBillboardShatterOptions = {},
  ): BillboardShardDescriptor[] {
    const sourceInfo = this.resolveMonsterBillboardTextureSource(texture);
    if (!sourceInfo) {
      return [];
    }

    const sourceWidth = sourceInfo.width;
    const sourceHeight = sourceInfo.height;
    const gridWidth =
      this.resolveMonsterBillboardSplitGridAxisSize(sourceWidth);
    const gridHeight =
      this.resolveMonsterBillboardSplitGridAxisSize(sourceHeight);
    if (gridWidth < 2 || gridHeight < 2) {
      return [];
    }

    const source = sourceInfo.source;
    const occupiedMask = this.sampleMonsterBillboardSplitOccupancyMask(
      source,
      sourceWidth,
      sourceHeight,
      gridWidth,
      gridHeight,
    );
    if (!occupiedMask) {
      return [];
    }

    const occupiedIndices: number[] = [];
    for (let i = 0; i < occupiedMask.length; i += 1) {
      if (occupiedMask[i] === 1) {
        occupiedIndices.push(i);
      }
    }
    if (!occupiedIndices.length) {
      return [];
    }

    const insetMinX = Math.floor(gridWidth * 0.25);
    const insetMaxXExclusive = Math.max(
      insetMinX + 1,
      Math.ceil(gridWidth * 0.75),
    );
    const insetMinY = Math.floor(gridHeight * 0.25);
    const insetMaxYExclusive = Math.max(
      insetMinY + 1,
      Math.ceil(gridHeight * 0.75),
    );
    const insetOccupiedIndices = occupiedIndices.filter((index) => {
      const x = index % gridWidth;
      const y = Math.floor(index / gridWidth);
      return (
        x >= insetMinX &&
        x < insetMaxXExclusive &&
        y >= insetMinY &&
        y < insetMaxYExclusive
      );
    });
    const seedCandidates =
      insetOccupiedIndices.length > 0 ? insetOccupiedIndices : occupiedIndices;
    const startIndex =
      seedCandidates[THREE.MathUtils.randInt(0, seedCandidates.length - 1)];
    const startX = startIndex % gridWidth;
    const startY = Math.floor(startIndex / gridWidth);
    const splitMask = this.buildMonsterBillboardLightningSplitMask(
      gridWidth,
      gridHeight,
      startX,
      startY,
      options.splitTargetCountOverride,
    );
    const regions = this.collectMonsterBillboardSplitRegions(
      gridWidth,
      gridHeight,
      splitMask,
      occupiedMask,
    );
    if (regions.length <= 1) {
      return [];
    }

    regions.sort((a, b) => b.length - a.length);
    const limitedRegions = regions.slice(
      0,
      this.dependencies.bloodParticles.monsterBillboardShardMaxPieces,
    );

    const cellX = new Int32Array(gridWidth + 1);
    const cellY = new Int32Array(gridHeight + 1);
    for (let x = 0; x <= gridWidth; x += 1) {
      cellX[x] = Math.floor((x * sourceWidth) / gridWidth);
    }
    for (let y = 0; y <= gridHeight; y += 1) {
      cellY[y] = Math.floor((y * sourceHeight) / gridHeight);
    }

    const descriptors: BillboardShardDescriptor[] = [];
    for (
      let regionIndex = 0;
      regionIndex < limitedRegions.length;
      regionIndex += 1
    ) {
      const region = limitedRegions[regionIndex];
      let minPixelX = sourceWidth;
      let minPixelY = sourceHeight;
      let maxPixelX = 0;
      let maxPixelY = 0;
      let weightedCenterX = 0;
      let weightedCenterY = 0;
      let weightedArea = 0;

      for (const cellIndex of region) {
        const cellXIndex = cellIndex % gridWidth;
        const cellYIndex = Math.floor(cellIndex / gridWidth);
        const x0 = cellX[cellXIndex];
        const x1 = cellX[cellXIndex + 1];
        const y0 = cellY[cellYIndex];
        const y1 = cellY[cellYIndex + 1];
        const width = x1 - x0;
        const height = y1 - y0;
        if (width <= 0 || height <= 0) {
          continue;
        }

        minPixelX = Math.min(minPixelX, x0);
        minPixelY = Math.min(minPixelY, y0);
        maxPixelX = Math.max(maxPixelX, x1);
        maxPixelY = Math.max(maxPixelY, y1);
        const area = width * height;
        weightedArea += area;
        weightedCenterX += (x0 + x1) * 0.5 * area;
        weightedCenterY += (y0 + y1) * 0.5 * area;
      }

      if (weightedArea <= 0) {
        continue;
      }

      const shardWidth = maxPixelX - minPixelX;
      const shardHeight = maxPixelY - minPixelY;
      if (shardWidth <= 0 || shardHeight <= 0) {
        continue;
      }

      const canvas = document.createElement("canvas");
      canvas.width = shardWidth;
      canvas.height = shardHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        continue;
      }

      context.clearRect(0, 0, shardWidth, shardHeight);
      context.imageSmoothingEnabled = false;
      const boundaryCells: Array<{
        cellIndex: number;
        towardSplitSteps: Array<{ dx: number; dy: number }>;
      }> = [];
      for (const cellIndex of region) {
        const cellXIndex = cellIndex % gridWidth;
        const cellYIndex = Math.floor(cellIndex / gridWidth);
        const left = cellXIndex > 0 ? cellIndex - 1 : -1;
        const rightNeighbor = cellXIndex < gridWidth - 1 ? cellIndex + 1 : -1;
        const up = cellYIndex > 0 ? cellIndex - gridWidth : -1;
        const down = cellYIndex < gridHeight - 1 ? cellIndex + gridWidth : -1;
        const towardSplitSteps: Array<{ dx: number; dy: number }> = [];
        if (left >= 0 && splitMask[left] === 1) {
          towardSplitSteps.push({ dx: -1, dy: 0 });
        }
        if (rightNeighbor >= 0 && splitMask[rightNeighbor] === 1) {
          towardSplitSteps.push({ dx: 1, dy: 0 });
        }
        if (up >= 0 && splitMask[up] === 1) {
          towardSplitSteps.push({ dx: 0, dy: -1 });
        }
        if (down >= 0 && splitMask[down] === 1) {
          towardSplitSteps.push({ dx: 0, dy: 1 });
        }
        if (towardSplitSteps.length > 0) {
          boundaryCells.push({ cellIndex, towardSplitSteps });
        }
      }
      for (const cellIndex of region) {
        const cellXIndex = cellIndex % gridWidth;
        const cellYIndex = Math.floor(cellIndex / gridWidth);
        const sourceX = cellX[cellXIndex];
        const sourceY = cellY[cellYIndex];
        const sourceWidthPixels = cellX[cellXIndex + 1] - sourceX;
        const sourceHeightPixels = cellY[cellYIndex + 1] - sourceY;
        if (sourceWidthPixels <= 0 || sourceHeightPixels <= 0) {
          continue;
        }
        context.drawImage(
          source,
          sourceX,
          sourceY,
          sourceWidthPixels,
          sourceHeightPixels,
          sourceX - minPixelX,
          sourceY - minPixelY,
          sourceWidthPixels,
          sourceHeightPixels,
        );
      }
      const boundaryRedChance = this.dependencies.engineState.clientOptions.monsterShatterBloodBorders
        ? THREE.MathUtils.clamp(
            this.dependencies.bloodParticles.monsterBillboardShardBoundaryRedChancePercent / 100,
            0,
            1,
          )
        : 0;
      const boundaryRedBleedChance = this.dependencies.engineState.clientOptions
        .monsterShatterBloodBorders
        ? THREE.MathUtils.clamp(
            this.dependencies.bloodParticles.monsterBillboardShardBoundaryRedBleedChancePercent / 100,
            0,
            1,
          )
        : 0;
      // The first region is the largest (sorted above) and acts as the master shard.
      const masterShardBoundaryRed2x2Chance = this.dependencies.engineState.clientOptions
        .monsterShatterBloodBorders
        ? regionIndex === 0
          ? THREE.MathUtils.clamp(
              this.dependencies.bloodParticles.monsterBillboardShardBoundaryRed2x2ChancePercent / 100,
              0,
              1,
            )
          : 0
        : 0;
      if (boundaryCells.length > 0 && boundaryRedChance > 0) {
        const imageData = context.getImageData(0, 0, shardWidth, shardHeight);
        const data = imageData.data;
        const paintBoundaryBloodPixel = (
          x: number,
          y: number,
          use2x2: boolean,
        ): void => {
          const paintPixel = (pixelX: number, pixelY: number): void => {
            if (
              pixelX < 0 ||
              pixelX >= shardWidth ||
              pixelY < 0 ||
              pixelY >= shardHeight
            ) {
              return;
            }
            const baseIndex = (pixelY * shardWidth + pixelX) * 4;
            const alphaIndex = baseIndex + 3;
            if (data[alphaIndex] === 0) {
              return;
            }
            data[baseIndex] = 255;
            data[baseIndex + 1] = 30;
            data[baseIndex + 2] = 30;
          };
          paintPixel(x, y);
          if (!use2x2) {
            return;
          }
          paintPixel(x + 1, y);
          paintPixel(x, y + 1);
          paintPixel(x + 1, y + 1);
        };
        for (const boundaryCell of boundaryCells) {
          const { cellIndex, towardSplitSteps } = boundaryCell;
          const cellXIndex = cellIndex % gridWidth;
          const cellYIndex = Math.floor(cellIndex / gridWidth);
          const sourceX = cellX[cellXIndex];
          const sourceY = cellY[cellYIndex];
          const sourceWidthPixels = cellX[cellXIndex + 1] - sourceX;
          const sourceHeightPixels = cellY[cellYIndex + 1] - sourceY;
          if (sourceWidthPixels <= 0 || sourceHeightPixels <= 0) {
            continue;
          }
          const localX = sourceX - minPixelX;
          const localY = sourceY - minPixelY;
          for (let py = 0; py < sourceHeightPixels; py += 1) {
            const pixelY = localY + py;
            if (pixelY < 0 || pixelY >= shardHeight) {
              continue;
            }
            for (let px = 0; px < sourceWidthPixels; px += 1) {
              const pixelX = localX + px;
              if (pixelX < 0 || pixelX >= shardWidth) {
                continue;
              }
              const baseIndex = (pixelY * shardWidth + pixelX) * 4;
              const alphaIndex = baseIndex + 3;
              if (data[alphaIndex] === 0) {
                continue;
              }
              if (Math.random() > boundaryRedChance) {
                continue;
              }
              const useMasterShard2x2 =
                masterShardBoundaryRed2x2Chance > 0 &&
                Math.random() <= masterShardBoundaryRed2x2Chance;
              paintBoundaryBloodPixel(pixelX, pixelY, useMasterShard2x2);
              if (
                boundaryRedBleedChance <= 0 ||
                towardSplitSteps.length === 0 ||
                Math.random() > boundaryRedBleedChance
              ) {
                continue;
              }
              const towardStep =
                towardSplitSteps[
                  THREE.MathUtils.randInt(0, towardSplitSteps.length - 1)
                ];
              const bleedPixelX = pixelX + towardStep.dx;
              const bleedPixelY = pixelY + towardStep.dy;
              if (
                bleedPixelX < 0 ||
                bleedPixelX >= shardWidth ||
                bleedPixelY < 0 ||
                bleedPixelY >= shardHeight
              ) {
                continue;
              }
              const bleedBaseIndex =
                (bleedPixelY * shardWidth + bleedPixelX) * 4;
              if (data[bleedBaseIndex + 3] === 0) {
                continue;
              }
              paintBoundaryBloodPixel(
                bleedPixelX,
                bleedPixelY,
                useMasterShard2x2,
              );
            }
          }
        }
        context.putImageData(imageData, 0, 0);
      }

      const shardTexture = new THREE.CanvasTexture(canvas);
      shardTexture.needsUpdate = true;
      shardTexture.magFilter = texture.magFilter;
      shardTexture.minFilter = texture.minFilter;
      shardTexture.generateMipmaps = false;
      shardTexture.anisotropy = this.dependencies.tilesetAssets.resolveTextureAnisotropyLevel();

      const areaRatio = THREE.MathUtils.clamp(
        weightedArea / (sourceWidth * sourceHeight),
        0.0001,
        1,
      );
      if (areaRatio < 0.0014) {
        shardTexture.dispose();
        continue;
      }

      descriptors.push({
        texture: shardTexture,
        centerU: weightedCenterX / (weightedArea * sourceWidth),
        centerV: weightedCenterY / (weightedArea * sourceHeight),
        widthRatio: shardWidth / sourceWidth,
        heightRatio: shardHeight / sourceHeight,
        areaRatio,
      });
    }

    return descriptors;
  }

  spawnMonsterBillboardShardParticlesFromDescriptors(
    sprite: THREE.Sprite,
    descriptors: BillboardShardDescriptor[],
    options: MonsterBillboardShatterOptions = {},
  ): void {
    if (!descriptors.length) {
      return;
    }

    const basePosition = sprite.position;
    const baseScaleX = Math.max(0.02, sprite.scale.x);
    const baseScaleY = Math.max(0.02, sprite.scale.y);
    const toCamera = new THREE.Vector2(
      this.dependencies.camera.camera.position.x - basePosition.x,
      this.dependencies.camera.camera.position.y - basePosition.y,
    );
    if (toCamera.lengthSq() < 1e-6) {
      toCamera.set(-Math.sin(this.dependencies.camera.cameraYaw), -Math.cos(this.dependencies.camera.cameraYaw));
    }
    toCamera.normalize();
    const right = new THREE.Vector2(toCamera.y, -toCamera.x);

    const awayFromImpactOrigin = new THREE.Vector2(
      typeof options.directionX === "number" &&
        Number.isFinite(options.directionX)
        ? options.directionX
        : basePosition.x - this.dependencies.playerMovement.playerPos.x * TILE_SIZE,
      typeof options.directionY === "number" &&
        Number.isFinite(options.directionY)
        ? options.directionY
        : basePosition.y + this.dependencies.playerMovement.playerPos.y * TILE_SIZE,
    );
    if (awayFromImpactOrigin.lengthSq() < 1e-6) {
      const randomAngle = Math.random() * Math.PI * 2;
      awayFromImpactOrigin.set(Math.cos(randomAngle), Math.sin(randomAngle));
    } else {
      awayFromImpactOrigin.normalize();
    }
    const towardImpactOrigin = awayFromImpactOrigin.clone().multiplyScalar(-1);
    if (towardImpactOrigin.lengthSq() < 1e-6) {
      const randomAngle = Math.random() * Math.PI * 2;
      towardImpactOrigin.set(Math.cos(randomAngle), Math.sin(randomAngle));
    } else {
      towardImpactOrigin.normalize();
    }

    const impulseLocalX = (Math.random() - 0.5) * baseScaleX * 0.72;
    const impulseLocalY = (Math.random() - 0.5) * baseScaleY * 0.72;
    const impulseOrigin = new THREE.Vector3(
      basePosition.x +
        right.x * impulseLocalX +
        towardImpactOrigin.x * this.dependencies.bloodParticles.monsterBillboardShardImpulseTowardPlayer,
      basePosition.y +
        right.y * impulseLocalX +
        towardImpactOrigin.y * this.dependencies.bloodParticles.monsterBillboardShardImpulseTowardPlayer,
      basePosition.z + impulseLocalY,
    );

    for (const descriptor of descriptors) {
      const scaleX = Math.max(0.02, baseScaleX * descriptor.widthRatio);
      const scaleY = Math.max(0.02, baseScaleY * descriptor.heightRatio);
      if (scaleX <= 0 || scaleY <= 0) {
        descriptor.texture.dispose();
        continue;
      }

      const localX = (descriptor.centerU - 0.5) * baseScaleX;
      const localY = (0.5 - descriptor.centerV) * baseScaleY;
      const shardPosition = new THREE.Vector3(
        basePosition.x + right.x * localX,
        basePosition.y + right.y * localX,
        basePosition.z + localY,
      );

      const material = new THREE.MeshBasicMaterial({
        map: descriptor.texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
      });
      material.opacity = 0.98;
      this.dependencies.lighting.patchMaterialForVignette(material);

      const geometry = new THREE.PlaneGeometry(1, 1);
      const shardMesh = new THREE.Mesh(geometry, material);
      shardMesh.position.copy(shardPosition);
      shardMesh.scale.set(scaleX, scaleY, 1);
      shardMesh.quaternion.copy(this.dependencies.camera.camera.quaternion);
      shardMesh.renderOrder = 922;
      this.dependencies.renderPipeline.scene.add(shardMesh);

      const radial = new THREE.Vector3().subVectors(
        shardPosition,
        impulseOrigin,
      );
      const radialXY = new THREE.Vector2(radial.x, radial.y);
      if (radialXY.lengthSq() < 1e-8) {
        radialXY.copy(awayFromImpactOrigin);
      } else {
        radialXY.normalize();
      }
      radialXY.lerp(awayFromImpactOrigin, 0.52);
      if (radialXY.lengthSq() < 1e-8) {
        radialXY.copy(awayFromImpactOrigin);
      } else {
        radialXY.normalize();
      }

      const smallness = THREE.MathUtils.clamp(
        1 - Math.sqrt(descriptor.areaRatio),
        0,
        1,
      );
      const horizontalSpeed =
        this.dependencies.bloodParticles.monsterBillboardShardBaseHorizontalSpeed +
        smallness * this.dependencies.bloodParticles.monsterBillboardShardHorizontalVariance +
        Math.random() * 1.6;
      const verticalSpeed =
        this.dependencies.bloodParticles.monsterBillboardShardVerticalBaseSpeed +
        smallness * this.dependencies.bloodParticles.monsterBillboardShardVerticalVariance +
        Math.max(0, radial.z) * 1.25 +
        Math.random() * 1.35;
      const collisionRadius = THREE.MathUtils.clamp(
        Math.max(scaleX, scaleY) * 0.34,
        0.03,
        0.24,
      );
      const angularAxis = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      );
      if (angularAxis.lengthSq() < 1e-8) {
        angularAxis.set(0, 0, 1);
      } else {
        angularAxis.normalize();
      }
      const angularSpeed = 3.2 + Math.random() * 5.1;
      const flatOrientation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        Math.random() * Math.PI * 2,
      );

      this.dependencies.bloodParticles.monsterBillboardShardParticles.push({
        mesh: shardMesh,
        velocity: new THREE.Vector3(
          radialXY.x * horizontalSpeed,
          radialXY.y * horizontalSpeed,
          verticalSpeed,
        ),
        ageMs: 0,
        lifetimeMs: this.dependencies.bloodParticles.monsterBillboardShardLifetimeMs,
        fadeStartMs: this.dependencies.bloodParticles.monsterBillboardShardFadeStartMs,
        radius: collisionRadius,
        baseScale: new THREE.Vector2(scaleX, scaleY),
        angularVelocity: angularAxis.multiplyScalar(angularSpeed),
        floorContactMs: 0,
        settled: false,
        flatOrientation,
        groundImpactCount: 0,
        persistOnGround: options.persistShardsOnGround === true,
      });
    }
  }

  createDetachedRuntimeMonsterBillboardSprite(
    tileX: number,
    tileY: number,
    appearance: RuntimeMonsterBillboardAppearance,
    runtimeMonsterId: number | null = null,
  ): THREE.Sprite | null {
    if (runtimeMonsterId === 0 && this.dependencies.movementInput.isFpsMode()) {
      return null;
    }
    const tempKey = `runtime-monster-shatter:${runtimeMonsterId ?? "unknown"}:${tileX},${tileY}|${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    this.dependencies.entityBillboards.ensureMonsterBillboard(
      tempKey,
      tileX,
      tileY,
      appearance.glyphChar,
      appearance.textColor,
      appearance.tileIndex,
      "monster",
      appearance.isWall,
      appearance.sourceGlyph,
      appearance.materialKind,
      appearance.showPetHeart,
    );
    return this.dependencies.entityBillboards.detachMonsterBillboard(tempKey);
  }

  spawnMonsterBillboardShatterEffectAtTile(
    tileX: number,
    tileY: number,
    options: MonsterBillboardShatterOptions = {},
  ): boolean {
    const key = `${tileX},${tileY}`;
    const runtimeMonsterId = this.dependencies.runtimeEntityTracking.normalizeRuntimeMonsterId(
      options.runtimeMonsterId,
    );
    const cachedAppearance =
      runtimeMonsterId !== null
        ? this.dependencies.runtimeEntityTracking.resolveRuntimeMonsterBillboardAppearanceById(runtimeMonsterId)
        : null;
    const sprite =
      cachedAppearance !== null
        ? this.createDetachedRuntimeMonsterBillboardSprite(
            tileX,
            tileY,
            cachedAppearance,
            runtimeMonsterId,
          )
        : (this.dependencies.entityBillboards.monsterBillboards.get(key) ?? null);
    if (!sprite) {
      return false;
    }

    const shouldDisposeTemporarySprite = cachedAppearance !== null;
    const material = sprite.material;
    if (!(material instanceof THREE.SpriteMaterial)) {
      if (shouldDisposeTemporarySprite) {
        this.dependencies.entityBillboards.disposeDetachedMonsterBillboard(sprite);
      }
      return false;
    }

    const sourceTexture = material.map;
    if (!sourceTexture) {
      if (shouldDisposeTemporarySprite) {
        this.dependencies.entityBillboards.disposeDetachedMonsterBillboard(sprite);
      }
      return false;
    }
    const descriptors = this.createMonsterBillboardShardDescriptors(
      sourceTexture,
      options,
    );
    if (!descriptors.length) {
      if (shouldDisposeTemporarySprite) {
        this.dependencies.entityBillboards.disposeDetachedMonsterBillboard(sprite);
      }
      return false;
    }

    this.spawnMonsterBillboardShardParticlesFromDescriptors(
      sprite,
      descriptors,
      options,
    );
    if (options.removeSourceBillboard) {
      const detached = this.dependencies.entityBillboards.detachMonsterBillboard(key);
      if (detached) {
        this.dependencies.entityBillboards.disposeDetachedMonsterBillboard(detached);
      }
    }
    if (shouldDisposeTemporarySprite) {
      this.dependencies.entityBillboards.disposeDetachedMonsterBillboard(sprite);
    }
    return true;
  }
}
