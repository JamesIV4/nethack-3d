import * as THREE from "three";
import { TILE_SIZE } from "../../constants";
import { isTerminalVoidGridTargetAdjacentToPlayer } from "../../terminal/terminal-display";
import type { Camera } from "../camera/camera";
import type { EngineState } from "../runtime/engine-state";
import type { EntityBillboards } from "../rendering/entity-billboards";
import type { PlayerMovement } from "../world/player-movement";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { TerminalRendering } from "../rendering/terminal-rendering";
import type { TileContextActions } from "../ui/tile-context-actions";
import type { TileRendering } from "../rendering/tile-rendering";
import type { TilesetAssets } from "../rendering/tileset-assets";

export interface PointerTargetingDependencies {
  readonly camera: Pick<
    Camera,
    "getActiveCamera"
  >;
  readonly engineState: Pick<
    EngineState,
    "clientOptions"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "monsterBillboards"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "renderer"
  >;
  readonly terminalRendering: Pick<
    TerminalRendering,
    "isTerminalDisplayMode"
  >;
  readonly tileContextActions: Pick<
    TileContextActions,
    "vultureMouseHoverHighlightTile"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "shouldUseVultureTiles"
  >;
}

/** Opaque sprite raycasts and tile targeting with terminal and wall-side corrections. */
export class PointerTargeting {
  constructor(private readonly dependencies: PointerTargetingDependencies) {}

  readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  readonly pointerRaycaster = new THREE.Raycaster();

  readonly pointerRaycastFrustum = new THREE.Frustum();

  readonly pointerRaycastProjectionMatrix = new THREE.Matrix4();

  readonly pointerRaycastCandidates: THREE.Object3D[] = [];

  readonly pointerNdc = new THREE.Vector2();

  readonly pointerIntersection = new THREE.Vector3();

  private readonly pointerUv = new THREE.Vector2();

  private readonly spriteAlphaCache = new WeakMap<THREE.Texture, {
    image: HTMLCanvasElement;
    width: number;
    height: number;
    version: number;
    sourceVersion: number;
    alpha: Uint8Array;
  }>();

  getTileUnderFpsCrosshair(): {
    key: string;
    x: number;
    y: number;
    mesh: THREE.Mesh;
  } | null {
    return this.getTileTargetFromPointerNdc(0, 0, true);
  }

  isOpaqueSpriteIntersection(
    intersection: THREE.Intersection<THREE.Object3D>,
  ): boolean {
    const sprite = intersection.object;
    if (!(sprite instanceof THREE.Sprite)) {
      return true;
    }

    const material = sprite.material;
    if (!(material instanceof THREE.SpriteMaterial)) {
      return true;
    }

    const texture = material.map;
    if (!texture || !intersection.uv) {
      return true;
    }

    const image = texture.image;
    if (!(image instanceof HTMLCanvasElement)) {
      return true;
    }

    const width = image.width;
    const height = image.height;
    if (width <= 0 || height <= 0) {
      return false;
    }

    const uv = this.pointerUv.copy(intersection.uv);
    texture.transformUv(uv);
    const u = THREE.MathUtils.clamp(uv.x, 0, 0.999999);
    const v = THREE.MathUtils.clamp(uv.y, 0, 0.999999);
    const px = Math.floor(u * width);
    const py = Math.floor(THREE.MathUtils.clamp(1 - v, 0, 0.999999) * height);
    let cached = this.spriteAlphaCache.get(texture);
    if (!cached || cached.image !== image || cached.width !== width ||
      cached.height !== height || cached.version !== texture.version ||
      cached.sourceVersion !== texture.source.version) {
      const context = image.getContext("2d", { willReadFrequently: true });
      if (!context) return true;
      // Read once per published texture revision, rather than synchronously
      // reading a canvas on every mouse/controller/XR raycast. Weak ownership
      // lets level and tileset disposal release the cached alpha alongside it.
      const pixels = context.getImageData(0, 0, width, height).data;
      const alpha = new Uint8Array(width * height);
      for (let index = 0; index < alpha.length; index++) alpha[index] = pixels[index * 4 + 3];
      cached = { image, width, height, version: texture.version, sourceVersion: texture.source.version, alpha };
      this.spriteAlphaCache.set(texture, cached);
    }

    const alpha = cached.alpha[py * width + px];
    const alphaThreshold = Math.max(
      1,
      Math.round((material.alphaTest || 0) * 255),
    );
    return alpha >= alphaThreshold;
  }

  collectVisiblePointerRaycastTargets(): THREE.Object3D[] {
    const candidates = this.pointerRaycastCandidates;
    candidates.length = 0;

    const activeCamera = this.dependencies.camera.getActiveCamera();
    activeCamera.updateMatrixWorld();
    this.pointerRaycastProjectionMatrix.multiplyMatrices(
      activeCamera.projectionMatrix,
      activeCamera.matrixWorldInverse,
    );
    this.pointerRaycastFrustum.setFromProjectionMatrix(
      this.pointerRaycastProjectionMatrix,
    );

    for (const sprite of this.dependencies.entityBillboards.monsterBillboards.values()) {
      if (!sprite.visible) {
        continue;
      }
      if (
        sprite.frustumCulled !== false &&
        !this.pointerRaycastFrustum.intersectsSprite(sprite)
      ) {
        continue;
      }
      candidates.push(sprite);
    }

    for (const mesh of this.dependencies.tileRendering.tileMap.values()) {
      if (!mesh.visible) {
        continue;
      }
      if (
        mesh.frustumCulled !== false &&
        !this.pointerRaycastFrustum.intersectsObject(mesh)
      ) {
        continue;
      }
      candidates.push(mesh);
    }

    return candidates;
  }

  getTileTargetFromPointerNdc(
    ndcX: number,
    ndcY: number,
    requireMesh: boolean,
  ): {
    key: string;
    x: number;
    y: number;
    mesh: THREE.Mesh;
  } | null {
    const candidates = this.collectVisiblePointerRaycastTargets();
    if (candidates.length === 0) {
      return null;
    }

    this.pointerNdc.set(ndcX, ndcY);
    this.pointerRaycaster.setFromCamera(this.pointerNdc, this.dependencies.camera.getActiveCamera());
    const intersections = this.pointerRaycaster.intersectObjects(
      candidates,
      false,
    );
    if (intersections.length === 0) {
      return null;
    }

    for (
      let intersectionIndex = 0;
      intersectionIndex < intersections.length;
      intersectionIndex += 1
    ) {
      const intersection = intersections[intersectionIndex];
      const object = intersection.object;
      if (object instanceof THREE.Sprite) {
        if (!this.isOpaqueSpriteIntersection(intersection)) {
          continue;
        }
        const spriteTileX = Number(object.userData?.tileX);
        const spriteTileY = Number(object.userData?.tileY);
        const x = Number.isFinite(spriteTileX)
          ? Math.round(spriteTileX)
          : Math.round(object.position.x / TILE_SIZE);
        const y = Number.isFinite(spriteTileY)
          ? Math.round(spriteTileY)
          : Math.round(-object.position.y / TILE_SIZE);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          continue;
        }
        const key = `${x},${y}`;
        const mesh = this.dependencies.tileRendering.tileMap.get(key) ?? null;
        if (!mesh && requireMesh) {
          continue;
        }
        if (mesh) {
          return { key, x, y, mesh };
        }
        continue;
      }

      if (!(object instanceof THREE.Mesh)) {
        continue;
      }

      const preferredFloorMesh = this.resolvePreferredTilesModeFloorMeshTarget({
        mesh: object,
        intersection,
        intersections,
        intersectionIndex,
      });
      const resolvedMesh = preferredFloorMesh ?? object;
      const resolvedTarget = this.getTileTargetFromMesh(resolvedMesh);
      if (!resolvedTarget) {
        continue;
      }
      return resolvedTarget;
    }

    return null;
  }

  getTileTargetFromMesh(mesh: THREE.Mesh): {
    key: string;
    x: number;
    y: number;
    mesh: THREE.Mesh;
  } | null {
    const tileX =
      typeof mesh.userData?.tileX === "number" &&
      Number.isFinite(mesh.userData.tileX)
        ? Math.trunc(mesh.userData.tileX)
        : Math.round(mesh.position.x / TILE_SIZE);
    const tileY =
      typeof mesh.userData?.tileY === "number" &&
      Number.isFinite(mesh.userData.tileY)
        ? Math.trunc(mesh.userData.tileY)
        : Math.round(-mesh.position.y / TILE_SIZE);
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
      return null;
    }
    return {
      key: `${tileX},${tileY}`,
      x: tileX,
      y: tileY,
      mesh,
    };
  }

  shouldApplyTilesModeRaycastTargetingRules(): boolean {
    return this.dependencies.engineState.clientOptions.tilesetMode === "tiles";
  }

  resolvePreferredTilesModeFloorMeshTarget(params: {
    mesh: THREE.Mesh;
    intersection: THREE.Intersection<THREE.Object3D>;
    intersections: Array<THREE.Intersection<THREE.Object3D>>;
    intersectionIndex: number;
  }): THREE.Mesh | null {
    if (
      !this.shouldApplyTilesModeRaycastTargetingRules() ||
      !params.mesh.userData?.isWall
    ) {
      return null;
    }
    if (this.isTilesModeClosedDoorWallMesh(params.mesh)) {
      // Closed-door wall blocks should stay targetable as door tiles and should
      // not remap to neighboring floor tiles.
      return null;
    }
    const wallTileTarget = this.getTileTargetFromMesh(params.mesh);
    if (!wallTileTarget) {
      return null;
    }

    const worldFaceNormal = this.getIntersectionWorldFaceNormal(
      params.intersection,
      params.mesh,
    );
    const isTopWallFaceHit =
      worldFaceNormal !== null && worldFaceNormal.z >= 0.55;

    if (isTopWallFaceHit) {
      const passThroughMeshBehindWall =
        this.findPassThroughTargetMeshIntersectionAfterIndex(
          params.intersections,
          params.intersectionIndex,
        );
      if (passThroughMeshBehindWall) {
        return passThroughMeshBehindWall;
      }
    }

    // Side wall hit handling differs for inner vs outer faces.
    const isSideWallFaceHit =
      worldFaceNormal === null || Math.abs(worldFaceNormal.z) < 0.55;
    if (!isSideWallFaceHit) {
      return null;
    }
    const passThroughMeshBehindSide =
      this.findPassThroughTargetMeshIntersectionAfterIndex(
        params.intersections,
        params.intersectionIndex,
      );
    if (this.isTilesModeWallCornerHit(params.intersection, params.mesh)) {
      if (passThroughMeshBehindSide) {
        return passThroughMeshBehindSide;
      }
    }
    const isInnerSideHit =
      worldFaceNormal === null
        ? true
        : this.isTilesModeInnerWallSideHit(
            wallTileTarget.x,
            wallTileTarget.y,
            worldFaceNormal,
          );
    if (!isInnerSideHit) {
      // Outer side hits use top-hit behavior: pass through to a target behind
      // (floor or closed door), otherwise keep the wall hit.
      return passThroughMeshBehindSide;
    }
    return this.findNearestAdjacentFloorMesh(
      wallTileTarget.x,
      wallTileTarget.y,
      {
        worldX: params.intersection.point.x,
        worldY: params.intersection.point.y,
      },
    );
  }

  isTilesModeClosedDoorWallMesh(mesh: THREE.Mesh): boolean {
    return (
      mesh.userData?.isWall === true && mesh.userData?.materialKind === "door"
    );
  }

  isTilesModeInnerWallSideHit(
    wallTileX: number,
    wallTileY: number,
    worldFaceNormal: THREE.Vector3,
  ): boolean {
    const sideNeighborOffset =
      this.resolveWallSideNeighborOffsetFromFaceNormal(worldFaceNormal);
    if (!sideNeighborOffset) {
      return true;
    }
    const neighborMesh = this.dependencies.tileRendering.tileMap.get(
      `${wallTileX + sideNeighborOffset.dx},${wallTileY + sideNeighborOffset.dy}`,
    );
    return Boolean(neighborMesh) && !Boolean(neighborMesh?.userData?.isWall);
  }

  resolveWallSideNeighborOffsetFromFaceNormal(
    worldFaceNormal: THREE.Vector3,
  ): { dx: number; dy: number } | null {
    const absX = Math.abs(worldFaceNormal.x);
    const absY = Math.abs(worldFaceNormal.y);
    if (!Number.isFinite(absX) || !Number.isFinite(absY)) {
      return null;
    }
    if (absX < 0.0001 && absY < 0.0001) {
      return null;
    }
    if (absX >= absY) {
      return {
        dx: worldFaceNormal.x >= 0 ? 1 : -1,
        dy: 0,
      };
    }
    return {
      dx: 0,
      dy: worldFaceNormal.y >= 0 ? -1 : 1,
    };
  }

  isTilesModeWallCornerHit(
    intersection: THREE.Intersection<THREE.Object3D>,
    mesh: THREE.Mesh,
  ): boolean {
    const localPoint = mesh.worldToLocal(intersection.point.clone());
    const halfTileSize = TILE_SIZE * 0.5;
    const cornerEpsilon = TILE_SIZE * 0.14;
    const nearXEdge =
      Math.abs(Math.abs(localPoint.x) - halfTileSize) <= cornerEpsilon;
    const nearYEdge =
      Math.abs(Math.abs(localPoint.y) - halfTileSize) <= cornerEpsilon;
    return nearXEdge && nearYEdge;
  }

  getIntersectionWorldFaceNormal(
    intersection: THREE.Intersection<THREE.Object3D>,
    mesh: THREE.Mesh,
  ): THREE.Vector3 | null {
    if (!intersection.face) {
      return null;
    }
    const worldNormal = intersection.face.normal.clone();
    worldNormal.transformDirection(mesh.matrixWorld);
    if (
      !Number.isFinite(worldNormal.x) ||
      !Number.isFinite(worldNormal.y) ||
      !Number.isFinite(worldNormal.z)
    ) {
      return null;
    }
    return worldNormal;
  }

  findPassThroughTargetMeshIntersectionAfterIndex(
    intersections: Array<THREE.Intersection<THREE.Object3D>>,
    startIndex: number,
  ): THREE.Mesh | null {
    for (let index = startIndex + 1; index < intersections.length; index += 1) {
      const nextObject = intersections[index]?.object;
      if (!(nextObject instanceof THREE.Mesh)) {
        continue;
      }
      if (!this.isTilesModePassThroughTargetMesh(nextObject)) {
        continue;
      }
      return nextObject;
    }
    return null;
  }

  isTilesModePassThroughTargetMesh(mesh: THREE.Mesh): boolean {
    if (this.isTilesModeClosedDoorWallMesh(mesh)) {
      return true;
    }
    return !Boolean(mesh.userData?.isWall);
  }

  findNearestAdjacentFloorMesh(
    wallTileX: number,
    wallTileY: number,
    hitPoint: { worldX: number; worldY: number },
  ): THREE.Mesh | null {
    const neighborOffsets = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 },
    ];
    let bestMesh: THREE.Mesh | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const offset of neighborOffsets) {
      const mesh =
        this.dependencies.tileRendering.tileMap.get(`${wallTileX + offset.dx},${wallTileY + offset.dy}`) ??
        null;
      if (!mesh || mesh.userData?.isWall) {
        continue;
      }
      const centerX = (wallTileX + offset.dx) * TILE_SIZE;
      const centerY = -(wallTileY + offset.dy) * TILE_SIZE;
      const distance = Math.hypot(
        hitPoint.worldX - centerX,
        hitPoint.worldY - centerY,
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMesh = mesh;
      }
    }
    return bestMesh;
  }

  getTilePositionFromClientCoordinates(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null {
    const canvas = this.dependencies.renderPipeline.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const target = this.getTileTargetFromPointerNdc(
      this.pointerNdc.x,
      this.pointerNdc.y,
      false,
    );
    if (!target) {
      return null;
    }
    return { x: target.x, y: target.y };
  }

  getGridPositionFromClientCoordinates(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null {
    const canvas = this.dependencies.renderPipeline.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.pointerRaycaster.setFromCamera(this.pointerNdc, this.dependencies.camera.getActiveCamera());

    const hit = this.pointerRaycaster.ray.intersectPlane(
      this.groundPlane,
      this.pointerIntersection,
    );
    if (!hit) {
      return null;
    }

    return {
      x: this.pointerIntersection.x / TILE_SIZE,
      y: -this.pointerIntersection.y / TILE_SIZE,
    };
  }

  getClickedTilePosition(
    event: MouseEvent,
  ): { x: number; y: number } | null {
    return this.resolvePointerTargetTileFromClientCoordinates(
      event.clientX,
      event.clientY,
    );
  }

  shouldSearchAdjacentTerminalVoid(gridTarget: {
    x: number;
    y: number;
  }): boolean {
    return (
      this.dependencies.terminalRendering.isTerminalDisplayMode() &&
      isTerminalVoidGridTargetAdjacentToPlayer({
        gridX: gridTarget.x,
        gridY: gridTarget.y,
        playerX: this.dependencies.playerMovement.playerPos.x,
        playerY: this.dependencies.playerMovement.playerPos.y,
      })
    );
  }

  resolvePointerTargetTileFromClientCoordinates(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null {
    const directTarget = this.getTilePositionFromClientCoordinates(
      clientX,
      clientY,
    );
    if (directTarget) {
      return directTarget;
    }
    return this.getVisualTargetTileForPointerInputFallback();
  }

  getVisualTargetTileForPointerInputFallback(): {
    x: number;
    y: number;
  } | null {
    if (!this.dependencies.tilesetAssets.shouldUseVultureTiles() || !this.dependencies.tileContextActions.vultureMouseHoverHighlightTile) {
      return null;
    }
    const candidate = this.dependencies.tileContextActions.vultureMouseHoverHighlightTile;
    if (!this.dependencies.tileRendering.tileMap.has(`${candidate.x},${candidate.y}`)) {
      return null;
    }
    return { x: candidate.x, y: candidate.y };
  }
}
