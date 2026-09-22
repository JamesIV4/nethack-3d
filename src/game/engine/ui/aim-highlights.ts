import * as THREE from "three";
import { TILE_SIZE, WALL_HEIGHT } from "../../constants";
import { MINIMAP_WIDTH_TILES, MINIMAP_HEIGHT_TILES } from "../shared/constants";
import type { Camera } from "../camera/camera";
import type { DirectionPrompts } from "./direction-prompts";
import type { EntityBillboards } from "../rendering/entity-billboards";
import type { MovementInput } from "../input/movement-input";
import type { PlayerMovement } from "../world/player-movement";
import type { PositionSelection } from "../input/position-selection";
import type { PromptDialogs } from "./prompt-dialogs";
import type { QuestionMenus } from "./question-menus";
import type { RenderPipeline } from "../rendering/render-pipeline";
import type { TileRendering } from "../rendering/tile-rendering";
import type { TilesetAssets } from "../rendering/tileset-assets";
import type { WallOverlays } from "../rendering/wall-overlays";

export interface AimHighlightsDependencies {
  readonly camera: Pick<
    Camera,
    "getFpsAimDirectionFromCamera"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
  >;
  readonly entityBillboards: Pick<
    EntityBillboards,
    "vultureBillboardRenderOrder"
  >;
  readonly movementInput: Pick<
    MovementInput,
    "isFpsMode"
    | "shouldUseFpsSelfTileDirectionTarget"
  >;
  readonly playerMovement: Pick<
    PlayerMovement,
    "playerPos"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "isFpsFarLookViewActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "isAnyModalVisible"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "isInQuestion"
  >;
  readonly renderPipeline: Pick<
    RenderPipeline,
    "scene"
  >;
  readonly tileRendering: Pick<
    TileRendering,
    "tileMap"
  >;
  readonly tilesetAssets: Pick<
    TilesetAssets,
    "resolveTextureAnisotropyLevel"
    | "shouldUseVultureTiles"
  >;
  readonly wallOverlays: Pick<
    WallOverlays,
    "vultureFrontWallPlaneRenderOrder"
  >;
}

/** FPS aim and selection highlight resources and display configuration. */
export class AimHighlights {
  constructor(private readonly dependencies: AimHighlightsDependencies) {}

  fpsForwardHighlight: THREE.Mesh | null = null;

  fpsForwardHighlightMaterial: THREE.MeshBasicMaterial | null = null;

  fpsForwardHighlightTexture: THREE.CanvasTexture | null = null;

  fpsAimLinePulseUntilMs: number = 0;
  private xrActive = false;
  private xrTarget: {x:number;y:number} | null = null;
  private xrSelection = false;
  private xrHeadset = false;
  setXrTarget(active: boolean, target: {x:number;y:number} | null, selection=false, headset=false): void {
    this.xrActive=active;this.xrTarget=target;this.xrSelection=selection;this.xrHeadset=headset;
  }

  private isVoidEdgeTarget(x: number, y: number): boolean {
    if (x<0 || y<0 || x>=MINIMAP_WIDTH_TILES || y>=MINIMAP_HEIGHT_TILES) return false;
    for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
      if (!dx && !dy) continue;
      const neighbor=this.dependencies.tileRendering.tileMap.get(`${x+dx},${y+dy}`);
      if (neighbor?.visible && !neighbor.userData.isWall) return true;
    }
    return false;
  }

  ensureFpsForwardHighlightTexture(): THREE.CanvasTexture {
    if (this.fpsForwardHighlightTexture) {
      return this.fpsForwardHighlightTexture;
    }

    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Failed to create FPS forward highlight texture context");
    }

    context.clearRect(0, 0, size, size);
    const imageData = context.createImageData(size, size);
    const data = imageData.data;
    const center = size * 0.5;
    const smoothstep = (edge0: number, edge1: number, x: number): number => {
      const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
      return t * t * (3 - 2 * t);
    };

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const edgeDistance = Math.min(px, py, size - px, size - py);
        const edgeNorm = edgeDistance / center;

        const outerFeather = smoothstep(0.0, 0.2, edgeNorm);
        const inwardFade = 1 - smoothstep(0.16, 0.84, edgeNorm);
        // Slightly lower intensity than previous square profile.
        const alpha = THREE.MathUtils.clamp(
          outerFeather * inwardFade * 0.58,
          0,
          1,
        );

        const i = (y * size + x) * 4;
        data[i] = 255;
        data[i + 1] = 238;
        data[i + 2] = 118;
        data[i + 3] = Math.round(alpha * 255);
      }
    }

    context.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = this.dependencies.tilesetAssets.resolveTextureAnisotropyLevel();
    this.fpsForwardHighlightTexture = texture;
    return texture;
  }

  ensureFpsAimVisuals(): void {
    if (this.fpsForwardHighlight) {
      this.fpsForwardHighlight.renderOrder =
        this.resolveContextHighlightRenderOrder();
      return;
    }

    if (!this.fpsForwardHighlight) {
      const geometry = new THREE.PlaneGeometry(
        TILE_SIZE * 0.9,
        TILE_SIZE * 0.9,
      );
      const material = new THREE.MeshBasicMaterial({
        map: this.ensureFpsForwardHighlightTexture(),
        color: 0xfff6a8,
        transparent: true,
        opacity: 0.46,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.nh3dIgnoreWorldRay = true;
      // Keep highlight above floor/shadow layers while still beneath
      // dominant wall/billboard overlays.
      mesh.renderOrder = this.resolveContextHighlightRenderOrder();
      this.dependencies.renderPipeline.scene.add(mesh);
      this.fpsForwardHighlight = mesh;
      this.fpsForwardHighlightMaterial = material;
    }
  }

  resolveContextHighlightRenderOrder(): number {
    if (this.dependencies.tilesetAssets.shouldUseVultureTiles()) {
      // Door floor overlays draw at frontWall-1, so draw above that but below
      // front wall and billboards.
      return this.dependencies.wallOverlays.vultureFrontWallPlaneRenderOrder - 0.5;
    }
    return 907;
  }

  resolveHighlightTargetZ(targetTile: THREE.Mesh | null): number {
    if (!targetTile) {
      return 0.03;
    }
    if (
      this.dependencies.tilesetAssets.shouldUseVultureTiles() &&
      (targetTile.userData?.materialKind === "door" ||
        targetTile.userData?.vultureDoorPlaneOverlay)
    ) {
      return 0.03;
    }
    return targetTile.userData?.isWall ? WALL_HEIGHT + 0.02 : 0.03;
  }

  applyContextHighlightRenderConfig(
    targetTile: THREE.Mesh | null,
  ): void {
    if (!this.fpsForwardHighlight) {
      return;
    }
    let renderOrder = this.resolveContextHighlightRenderOrder();
    if (
      this.dependencies.tilesetAssets.shouldUseVultureTiles() &&
      targetTile &&
      (targetTile.userData?.materialKind === "door" ||
        targetTile.userData?.vultureDoorPlaneOverlay)
    ) {
      // Keep door-tile highlight visible regardless of which side of the door
      // currently renders in front.
      renderOrder = this.dependencies.entityBillboards.vultureBillboardRenderOrder - 0.1;
    }
    this.fpsForwardHighlight.renderOrder = renderOrder;
  }

  updateFpsAimVisuals(timeMs: number): void {
    if (!this.dependencies.movementInput.isFpsMode() && !this.xrActive) {
      if (this.fpsForwardHighlight) {
        this.fpsForwardHighlight.visible = false;
      }
      return;
    }

    if (this.dependencies.positionSelection.isFpsFarLookViewActive() && !this.xrActive) {
      if (this.fpsForwardHighlight) {
        this.fpsForwardHighlight.visible = false;
      }
      return;
    }

    if (
      this.dependencies.promptDialogs.isAnyModalVisible() ||
      this.dependencies.questionMenus.isInQuestion ||
      this.dependencies.directionPrompts.isInDirectionQuestion
    ) {
      if (this.fpsForwardHighlight) {
        this.fpsForwardHighlight.visible = false;
      }
      return;
    }

    const useLaser = this.xrActive && !this.xrHeadset;
    const aim = useLaser ? null : this.dependencies.camera.getFpsAimDirectionFromCamera();
    if (useLaser ? !this.xrTarget : !aim) {
      if (this.fpsForwardHighlight) {
        this.fpsForwardHighlight.visible = false;
      }
      return;
    }
    this.ensureFpsAimVisuals();

    let targetX = useLaser ? this.xrTarget!.x : this.dependencies.playerMovement.playerPos.x + aim!.dx;
    let targetY = useLaser ? this.xrTarget!.y : this.dependencies.playerMovement.playerPos.y + aim!.dy;
    let targetTile = this.dependencies.tileRendering.tileMap.get(`${targetX},${targetY}`) ?? null;
    if (!useLaser && this.dependencies.movementInput.shouldUseFpsSelfTileDirectionTarget()) {
      const playerTile =
        this.dependencies.tileRendering.tileMap.get(`${this.dependencies.playerMovement.playerPos.x},${this.dependencies.playerMovement.playerPos.y}`) ?? null;
      if (playerTile) {
        targetX = this.dependencies.playerMovement.playerPos.x;
        targetY = this.dependencies.playerMovement.playerPos.y;
        targetTile = playerTile;
      }
    }
    const isDiscoveredPassableTarget =
      Boolean(targetTile) && !Boolean(targetTile?.userData?.isWall);
    const isVoidEdge = this.xrActive && !targetTile && this.isVoidEdgeTarget(targetX,targetY);
    if (!isDiscoveredPassableTarget && !isVoidEdge && !(this.xrActive && this.xrSelection && targetTile)) {
      if (this.fpsForwardHighlight) {
        this.fpsForwardHighlight.visible = false;
      }
      return;
    }
    const targetZ = this.resolveHighlightTargetZ(targetTile);

    if (this.fpsForwardHighlight) {
      this.applyContextHighlightRenderConfig(targetTile);
      this.fpsForwardHighlight.position.set(
        targetX * TILE_SIZE,
        -targetY * TILE_SIZE,
        targetZ,
      );
      this.fpsForwardHighlight.visible = true;
      if (this.fpsForwardHighlightMaterial) {
        const pulse = timeMs <= this.fpsAimLinePulseUntilMs ? 1 : 0.45;
        this.fpsForwardHighlightMaterial.opacity = 0.2 + pulse * 0.32;
      }
    }
  }
}
