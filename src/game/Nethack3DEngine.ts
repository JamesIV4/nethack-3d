/*
 * Main entry point for the NetHack 3D client.
 * This module runs NetHack WASM locally in-browser and renders the game in 3D using Three.js.
 */

import * as THREE from "three";
import { WorkerRuntimeBridge } from "../runtime";
import type { RuntimeBridge, RuntimeEvent } from "../runtime";
import { TILE_SIZE, WALL_HEIGHT } from "./constants";
import { classifyTileBehavior } from "./glyphs/behavior";
import type {
  TileBehaviorResult,
  TileEffectKind,
  TileMaterialKind,
} from "./glyphs";
import type {
  GlyphOverlay,
  GlyphOverlayMap,
  TerrainSnapshot,
  TileMap,
} from "./types";

type LightingGrid = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  blocked: Uint8Array;
};

type FloatingMessageEntry = {
  container: HTMLDivElement;
  text: HTMLDivElement;
  fadeTimerId: number;
  removeTimerId: number;
};

type MetaCommandOverlay = {
  container: HTMLDivElement;
  text: HTMLDivElement;
};

type PendingCharacterDamage = {
  amount: number;
  createdAtMs: number;
};

type GlyphDamageFlashState = {
  key: string;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  elapsedMs: number;
  durationMs: number;
  baseColorHex: string;
  glyphChar: string;
  darkenFactor: number;
};

type DamageNumberParticle = {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  ageMs: number;
  lifetimeMs: number;
  radius: number;
  baseScale: THREE.Vector2;
};

type TileRevealFadeState = {
  elapsedMs: number;
  durationMs: number;
  opacity: number;
};

/**
 * The main game engine class. It encapsulates all the logic for the 3D client.
 */
class Nethack3DEngine {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private tileMap: TileMap = new Map();
  private glyphOverlayMap: GlyphOverlayMap = new Map();
  private tileStateCache: Map<string, string> = new Map();
  private lastKnownTerrain: Map<string, TerrainSnapshot> = new Map();
  private glyphTextureCache: Map<
    string,
    { texture: THREE.CanvasTexture; refCount: number }
  > = new Map();
  private pendingTileUpdates: Map<string, any> = new Map();
  private tileFlushScheduled: boolean = false;
  private playerPos = { x: 0, y: 0 };
  private gameMessages: string[] = [];
  private floatingMessageLayer: HTMLDivElement | null = null;
  private floatingMessageEntries: FloatingMessageEntry[] = [];
  private metaCommandOverlay: MetaCommandOverlay | null = null;
  private hasSeenPlayerPosition: boolean = false;
  private hasPlayerMovedOnce: boolean = false;
  private lastMovementInputAtMs: number = 0;
  private readonly maxFloatingMessages: number = 12;
  private readonly movementUnlockWindowMs: number = 5000;
  private readonly floatingMessageStackSpacingPx: number = 30;
  private readonly floatingMessageFadeDelayMs: number = 1500;
  private readonly floatingMessageFadeDurationMs: number = 520;
  private readonly floatingMessageRisePx: number = 44;
  private statusDebugHistory: any[] = [];
  private currentInventory: any[] = []; // Store current inventory items
  private pendingInventoryDialog: boolean = false; // Flag to show inventory dialog after update
  private lastInfoMenu: { title: string; lines: string[] } | null = null;

  // Player stats tracking
  private playerStats = {
    name: "Adventurer",
    hp: 10,
    maxHp: 10,
    power: 0,
    maxPower: 0,
    level: 1,
    experience: 0,
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    armor: 10,
    dungeon: "Dungeons of Doom",
    dlevel: 1,
    gold: 0,
    alignment: "Neutral",
    hunger: "Not Hungry",
    encumbrance: "",
    time: 1,
    score: 0,
  };

  private session: RuntimeBridge | null = null;
  private readonly metaInputPrefix = "__META__:";
  private isInMetaCommandInput: boolean = false;
  private metaCommandBuffer: string = "";
  private altOrMetaHeld: boolean = false;

  // Camera controls
  private cameraDistance: number = 20;
  private cameraPitch: number = Math.PI / 2 - 0.3; // Elevation above the board (0 = horizon)
  private cameraYaw: number = 0; // Azimuth around the board (0 = facing north)
  private readonly minCameraPitch: number = 0.2;
  private readonly maxCameraPitch: number = Math.PI / 2 - 0.01;
  private readonly rotationSpeed: number = 0.01;
  private isMiddleMouseDown: boolean = false;
  private isRightMouseDown: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private minDistance: number = 5;
  private maxDistance: number = 50;

  // Direction question handling
  private isInDirectionQuestion: boolean = false;

  // General question handling (pauses all movement)
  private isInQuestion: boolean = false;

  // Camera panning
  private cameraPanX: number = 0;
  private cameraPanY: number = 0;
  private cameraFollowHalfLifeMs: number = 85;
  private cameraFollowInitialized: boolean = false;
  private cameraFollowTarget = new THREE.Vector3();
  private cameraFollowCurrent = new THREE.Vector3();
  private lastFrameTimeMs: number | null = null;
  private hasReceivedHpStatus: boolean = false;
  private pendingCharacterDamageQueue: PendingCharacterDamage[] = [];
  private readonly pendingCharacterDamageMaxAgeMs: number = 420;
  private readonly glyphDamageFlashDurationMs: number = 180;
  private readonly glyphDamageFlashTextureSize: number = 256;
  private readonly glyphDamageFlashRed = new THREE.Color("#ff2d2d");
  private readonly glyphDamageFlashWhite = new THREE.Color("#ffffff");
  private readonly glyphDamageFlashColor = new THREE.Color("#ffffff");
  private glyphDamageFlashes: Map<string, GlyphDamageFlashState> = new Map();
  private damageParticles: DamageNumberParticle[] = [];
  private lastParsedDamageMessage: string = "";
  private lastParsedDamageAtMs: number = 0;
  private readonly damageParticleLifetimeMs: number = 1860;
  private readonly damageParticleGravity: number = 18.4;
  private readonly damageParticleFloorZ: number = 0.02;
  private readonly damageParticleWallBounce: number = 0.35;
  private readonly tileRevealFadeDurationMs: number = 240;
  private tileRevealFades: Map<string, TileRevealFadeState> = new Map();

  // Pre-create geometries and materials
  private floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
  private wallGeometry = new THREE.BoxGeometry(
    TILE_SIZE,
    TILE_SIZE,
    WALL_HEIGHT,
  );

  // Materials for different glyph types
  private materials = {
    floor: new THREE.MeshLambertMaterial({ color: 0x6a4d28 }),
    stairs_up: new THREE.MeshLambertMaterial({
      color: 0x3f8753,
      emissive: 0x15301d,
    }),
    stairs_down: new THREE.MeshLambertMaterial({
      color: 0x7d5cc8,
      emissive: 0x251b3a,
    }),
    wall: new THREE.MeshLambertMaterial({ color: 0x5f6773 }),
    dark_wall: new THREE.MeshLambertMaterial({ color: 0x4a5060 }),
    door: new THREE.MeshLambertMaterial({
      color: 0x5a3b22,
      emissive: 0x1b120a,
    }),
    dark: new THREE.MeshLambertMaterial({ color: 0x17385f }),
    water: new THREE.MeshLambertMaterial({
      color: 0x1a6dbe,
      emissive: 0x08253f,
    }),
    trap: new THREE.MeshLambertMaterial({
      color: 0xac6c2e,
      emissive: 0x3a230f,
    }),
    feature: new THREE.MeshLambertMaterial({ color: 0x73768b }),
    fountain: new THREE.MeshLambertMaterial({
      color: 0x2ea8ff,
      emissive: 0x0b2f4d,
    }),
    player: new THREE.MeshLambertMaterial({
      color: 0x39ff88,
      emissive: 0x114d2a,
    }),
    monster_hostile: new THREE.MeshLambertMaterial({
      color: 0x9f3434,
      emissive: 0x311010,
    }),
    monster_friendly: new THREE.MeshLambertMaterial({
      color: 0x2f8f4f,
      emissive: 0x12301c,
    }),
    monster_neutral: new THREE.MeshLambertMaterial({
      color: 0x2f6fa8,
      emissive: 0x10263a,
    }),
    item: new THREE.MeshLambertMaterial({
      color: 0xa87f1a,
      emissive: 0x352707,
    }),
    effect_warning: new THREE.MeshLambertMaterial({
      color: 0x9d6e1f,
      emissive: 0x302109,
    }),
    effect_zap: new THREE.MeshLambertMaterial({
      color: 0x2f8290,
      emissive: 0x0e2730,
    }),
    effect_explode: new THREE.MeshLambertMaterial({
      color: 0xa7582d,
      emissive: 0x341b0f,
    }),
    effect_swallow: new THREE.MeshLambertMaterial({
      color: 0x68469a,
      emissive: 0x221733,
    }),
    default: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  };
  private effectColors: Record<TileEffectKind, THREE.Color> = {
    warning: new THREE.Color(0xffd166),
    zap: new THREE.Color(0x7df9ff),
    explode: new THREE.Color(0xffb46b),
    swallow: new THREE.Color(0xd8a8ff),
  };
  private lightingOverlayMesh: THREE.Mesh | null = null;
  private lightingOverlayTexture: THREE.CanvasTexture | null = null;
  private lightingOverlayCanvas: HTMLCanvasElement | null = null;
  private lightingOverlayContext: CanvasRenderingContext2D | null = null;
  private lightingOverlayGridMeta: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
    tilePixels: number;
  } | null = null;
  private lightingDirty: boolean = true;
  private readonly lightingRadiusTiles: number = 14;
  private readonly lightingTilePixels: number = 30;
  private readonly lightingFloorFalloffPower: number = 1.08;
  private readonly lightingMaxDarkAlpha: number = 0.82;
  private readonly lightingDitherStrength: number = 0.05;
  private readonly lightingBayer4: number[] = [
    0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
  ].map((value) => (value + 0.5) / 16);

  private isPersistentTerrainKind(kind: string): boolean {
    switch (kind) {
      case "cmap":
      case "obj":
      case "body":
      case "statue":
      case "unexplored":
      case "nothing":
        return true;
      default:
        return false;
    }
  }

  private markLightingDirty(): void {
    this.lightingDirty = true;
  }

  private isUndiscoveredKind(kind: string): boolean {
    return kind === "unexplored" || kind === "nothing";
  }

  private stopTileRevealFade(key: string): void {
    this.tileRevealFades.delete(key);
    const overlay = this.glyphOverlayMap.get(key);
    if (overlay) {
      overlay.material.opacity = 1;
      overlay.material.needsUpdate = true;
    }
  }

  private startTileRevealFade(key: string): void {
    const overlay = this.glyphOverlayMap.get(key);
    if (!overlay) {
      return;
    }

    const state: TileRevealFadeState = {
      elapsedMs: 0,
      durationMs: this.tileRevealFadeDurationMs,
      opacity: 0,
    };
    this.tileRevealFades.set(key, state);
    overlay.material.opacity = state.opacity;
    overlay.material.needsUpdate = true;
  }

  private updateTileRevealFades(deltaSeconds: number): void {
    if (!this.tileRevealFades.size) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const entries = Array.from(this.tileRevealFades.entries());

    for (const [key, state] of entries) {
      const overlay = this.glyphOverlayMap.get(key);
      if (!overlay || !this.tileMap.has(key)) {
        this.tileRevealFades.delete(key);
        continue;
      }

      state.elapsedMs += deltaMs;
      const progress = THREE.MathUtils.clamp(
        state.elapsedMs / state.durationMs,
        0,
        1,
      );
      const eased = 1 - Math.pow(1 - progress, 2);
      state.opacity = eased;
      overlay.material.opacity = state.opacity;
      overlay.material.needsUpdate = true;

      if (progress >= 1) {
        this.tileRevealFades.delete(key);
        overlay.material.opacity = 1;
      }
    }
  }

  private clearTileRevealFades(): void {
    const keys = Array.from(this.tileRevealFades.keys());
    this.tileRevealFades.clear();

    for (const key of keys) {
      const overlay = this.glyphOverlayMap.get(key);
      if (overlay) {
        overlay.material.opacity = 1;
      }
    }
  }

  private parseTileKey(key: string): { x: number; y: number } | null {
    const commaIndex = key.indexOf(",");
    if (commaIndex < 0) {
      return null;
    }
    const x = Number(key.slice(0, commaIndex));
    const y = Number(key.slice(commaIndex + 1));
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { x, y };
  }

  private buildLightingGrid(): LightingGrid | null {
    if (this.tileMap.size === 0) {
      return null;
    }

    const cells: Array<{ x: number; y: number; isWall: boolean }> = [];
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    this.tileMap.forEach((mesh, key) => {
      const parsed = this.parseTileKey(key);
      if (!parsed) {
        return;
      }

      const { x, y } = parsed;
      cells.push({
        x,
        y,
        isWall: Boolean(mesh.userData?.isWall),
      });

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    if (!cells.length) {
      return null;
    }

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const blocked = new Uint8Array(width * height);

    for (const cell of cells) {
      const index = (cell.y - minY) * width + (cell.x - minX);
      blocked[index] = cell.isWall ? 1 : 0;
    }

    return { minX, maxX, minY, maxY, width, height, blocked };
  }

  private worldToLightingPixel(
    grid: LightingGrid,
    worldX: number,
    worldY: number,
  ): { x: number; y: number } {
    const tilePixels = this.lightingTilePixels;
    return {
      x: (worldX - (grid.minX - 0.5)) * tilePixels,
      y: (worldY - (grid.minY - 0.5)) * tilePixels,
    };
  }

  private disposeLightingOverlay(): void {
    if (this.lightingOverlayMesh) {
      this.scene.remove(this.lightingOverlayMesh);
      this.lightingOverlayMesh.geometry.dispose();
      const material = this.lightingOverlayMesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
      this.lightingOverlayMesh = null;
    }

    if (this.lightingOverlayTexture) {
      this.lightingOverlayTexture.dispose();
      this.lightingOverlayTexture = null;
    }

    this.lightingOverlayCanvas = null;
    this.lightingOverlayContext = null;
    this.lightingOverlayGridMeta = null;
  }

  private ensureLightingOverlayResources(grid: LightingGrid): boolean {
    const tilePixels = this.lightingTilePixels;
    const widthPixels = Math.max(1, grid.width * tilePixels);
    const heightPixels = Math.max(1, grid.height * tilePixels);

    const shouldRebuild =
      !this.lightingOverlayMesh ||
      !this.lightingOverlayTexture ||
      !this.lightingOverlayCanvas ||
      !this.lightingOverlayContext ||
      !this.lightingOverlayGridMeta ||
      this.lightingOverlayGridMeta.minX !== grid.minX ||
      this.lightingOverlayGridMeta.maxX !== grid.maxX ||
      this.lightingOverlayGridMeta.minY !== grid.minY ||
      this.lightingOverlayGridMeta.maxY !== grid.maxY ||
      this.lightingOverlayGridMeta.width !== grid.width ||
      this.lightingOverlayGridMeta.height !== grid.height ||
      this.lightingOverlayGridMeta.tilePixels !== tilePixels;

    if (shouldRebuild) {
      this.disposeLightingOverlay();

      const canvas = document.createElement("canvas");
      canvas.width = widthPixels;
      canvas.height = heightPixels;
      const context = canvas.getContext("2d");
      if (!context) {
        return false;
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.generateMipmaps = false;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;

      const geometry = new THREE.PlaneGeometry(
        grid.width * TILE_SIZE,
        grid.height * TILE_SIZE,
      );
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        ((grid.minX + grid.maxX) * TILE_SIZE) / 2,
        ((-grid.minY - grid.maxY) * TILE_SIZE) / 2,
        WALL_HEIGHT + 0.08,
      );
      mesh.renderOrder = 900;
      this.scene.add(mesh);

      this.lightingOverlayMesh = mesh;
      this.lightingOverlayTexture = texture;
      this.lightingOverlayCanvas = canvas;
      this.lightingOverlayContext = context;
      this.lightingOverlayGridMeta = {
        minX: grid.minX,
        maxX: grid.maxX,
        minY: grid.minY,
        maxY: grid.maxY,
        width: grid.width,
        height: grid.height,
        tilePixels,
      };
    }

    return Boolean(
      this.lightingOverlayTexture &&
      this.lightingOverlayCanvas &&
      this.lightingOverlayContext,
    );
  }

  private renderLightingOverlay(grid: LightingGrid): void {
    if (
      !this.lightingOverlayTexture ||
      !this.lightingOverlayCanvas ||
      !this.lightingOverlayContext
    ) {
      return;
    }

    const canvas = this.lightingOverlayCanvas;
    const context = this.lightingOverlayContext;
    const widthPixels = canvas.width;
    const heightPixels = canvas.height;

    context.clearRect(0, 0, widthPixels, heightPixels);

    context.globalCompositeOperation = "source-over";
    context.fillStyle = `rgba(0, 0, 0, ${this.lightingMaxDarkAlpha})`;
    context.fillRect(0, 0, widthPixels, heightPixels);

    const playerPixel = this.worldToLightingPixel(
      grid,
      this.playerPos.x,
      this.playerPos.y,
    );
    const radiusPixels = this.lightingRadiusTiles * this.lightingTilePixels;

    context.globalCompositeOperation = "destination-out";
    const radial = context.createRadialGradient(
      playerPixel.x,
      playerPixel.y,
      0,
      playerPixel.x,
      playerPixel.y,
      radiusPixels,
    );
    const stops = 16;
    for (let i = 0; i <= stops; i++) {
      const t = i / stops;
      const alpha = Math.pow(
        Math.max(0, 1 - t),
        this.lightingFloorFalloffPower,
      );
      radial.addColorStop(t, `rgba(0, 0, 0, ${alpha})`);
    }
    context.fillStyle = radial;
    context.beginPath();
    context.arc(playerPixel.x, playerPixel.y, radiusPixels, 0, Math.PI * 2);
    context.fill();

    const imageData = context.getImageData(0, 0, widthPixels, heightPixels);
    const data = imageData.data;
    for (let y = 0; y < heightPixels; y++) {
      for (let x = 0; x < widthPixels; x++) {
        const index = (y * widthPixels + x) * 4;
        const alpha = data[index + 3] / 255;
        const dither =
          (this.lightingBayer4[(x & 3) + ((y & 3) << 2)] - 0.5) *
          this.lightingDitherStrength;
        const adjusted = THREE.MathUtils.clamp(alpha + dither, 0, 1);
        data[index + 3] = Math.round(adjusted * 255);
      }
    }
    context.putImageData(imageData, 0, 0);

    context.globalCompositeOperation = "source-over";
    this.lightingOverlayTexture.needsUpdate = true;
  }

  private updateLightingOverlay(): void {
    if (!this.lightingDirty) {
      return;
    }
    this.lightingDirty = false;

    const grid = this.buildLightingGrid();
    if (!grid) {
      this.disposeLightingOverlay();
      return;
    }

    if (!this.ensureLightingOverlayResources(grid)) {
      this.lightingDirty = true;
      return;
    }

    this.renderLightingOverlay(grid);
  }

  constructor() {
    this.initThreeJS();
    this.initUI();
    this.connectToRuntime();

    // Set initial camera position looking straight down with a slight tilt
    this.cameraDistance = 15;
    this.cameraPitch = THREE.MathUtils.clamp(
      Math.PI / 2 - 0.2,
      this.minCameraPitch,
      this.maxCameraPitch,
    );
    // Yaw is in radians; start at 180 degrees to face the board correctly.
    this.cameraYaw = Math.PI;
  }

  private initThreeJS(): void {
    // --- Basic Three.js setup ---
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.up.set(0, 0, 1);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000011); // Dark blue background
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    document.body.appendChild(this.renderer.domElement);
    this.loadCameraSmoothingFromCSS();

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    // --- Event Listeners ---
    window.addEventListener("resize", this.onWindowResize.bind(this), false);
    window.addEventListener("keydown", this.handleKeyDown.bind(this), false);
    window.addEventListener("keyup", this.handleKeyUp.bind(this), false);
    window.addEventListener("blur", this.handleWindowBlur.bind(this), false);

    // Mouse controls for camera
    window.addEventListener("wheel", this.handleMouseWheel.bind(this), false);
    window.addEventListener(
      "mousedown",
      this.handleMouseDown.bind(this),
      false,
    );
    window.addEventListener(
      "mousemove",
      this.handleMouseMove.bind(this),
      false,
    );
    window.addEventListener("mouseup", this.handleMouseUp.bind(this), false);
    window.addEventListener("contextmenu", (e) => e.preventDefault(), false); // Prevent right-click menu

    // Start render loop
    this.animate();
  }

  private loadCameraSmoothingFromCSS(): void {
    const cssValue = getComputedStyle(document.documentElement)
      .getPropertyValue("--camera-follow-half-life-ms")
      .trim();
    const parsed = Number.parseFloat(cssValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      this.cameraFollowHalfLifeMs = parsed;
    }
  }

  private initUI(): void {
    // Use existing game log and status elements from HTML instead of creating new ones
    const statusElement = document.getElementById("game-status");
    if (statusElement) {
      statusElement.innerHTML = "Starting local NetHack runtime...";
    }

    // Create connection status (smaller, top-right corner)
    const connStatus = document.createElement("div");
    connStatus.id = "connection-status";
    connStatus.setAttribute("data-state", "disconnected");
    connStatus.innerHTML = "Disconnected";
    document.body.appendChild(connStatus);

    const floatingMessageLayer = document.createElement("div");
    floatingMessageLayer.id = "floating-log-message-layer";
    document.body.appendChild(floatingMessageLayer);
    this.floatingMessageLayer = floatingMessageLayer;
  }

  private async connectToRuntime(): Promise<void> {
    console.log("Starting local NetHack runtime");
    this.updateConnectionStatus("Starting", "#4444aa");

    this.session = new WorkerRuntimeBridge((payload: RuntimeEvent) => {
      this.handleRuntimeEvent(payload);
    });

    try {
      await this.session.start();
      this.updateConnectionStatus("Running", "#00aa00");
      this.updateStatus("Local NetHack runtime started");
      this.addGameMessage("Local NetHack runtime started");

      const loading = document.getElementById("loading");
      if (loading) {
        loading.classList.add("is-hidden");
      }
    } catch (error) {
      console.error("Failed to start local NetHack runtime:", error);
      this.updateConnectionStatus("Error", "#aa0000");
      this.updateStatus("Failed to start local NetHack runtime");
      this.addGameMessage("Failed to start local NetHack runtime");
    }
  }

  private handleRuntimeEvent(data: RuntimeEvent): void {
    switch (data.type) {
      case "map_glyph":
        this.tryResolvePendingCharacterDamage(data);
        this.enqueueTileUpdate(data);
        break;

      case "map_glyph_batch":
        if (Array.isArray(data.tiles)) {
          for (const tile of data.tiles) {
            this.tryResolvePendingCharacterDamage(tile);
            this.enqueueTileUpdate(tile);
          }
        }
        break;

      case "player_position":
        console.log(
          `🎯 Received player position update: (${data.x}, ${data.y})`,
        );
        const oldPos = { ...this.playerPos };
        this.recordPlayerMovement(oldPos.x, oldPos.y, data.x, data.y);
        this.playerPos = { x: data.x, y: data.y };
        this.markLightingDirty();
        console.log(
          `🎯 Player position changed from (${oldPos.x}, ${oldPos.y}) to (${data.x}, ${data.y})`,
        );
        this.updateStatus(`Player at (${data.x}, ${data.y}) - NetHack 3D`);
        break;

      case "force_player_redraw":
        // Force update player visual position when NetHack doesn't send map updates
        console.log(
          `🎯 Force redraw player from (${data.oldPosition.x}, ${data.oldPosition.y}) to (${data.newPosition.x}, ${data.newPosition.y})`,
        );

        // Update the player position first
        this.recordPlayerMovement(
          data.oldPosition.x,
          data.oldPosition.y,
          data.newPosition.x,
          data.newPosition.y,
        );
        this.playerPos = { x: data.newPosition.x, y: data.newPosition.y };
        this.markLightingDirty();

        // Clear the old player visual position by redrawing it as floor
        const oldKey = `${data.oldPosition.x},${data.oldPosition.y}`;
        const oldOverlay = this.glyphOverlayMap.get(oldKey);
        if (oldOverlay) {
          console.log(
            `🎯 Clearing old player overlay at (${data.oldPosition.x}, ${data.oldPosition.y})`,
          );
          this.disposeGlyphOverlay(oldOverlay);
          this.glyphOverlayMap.delete(oldKey);
        }

        // Redraw the old player position using last known terrain to avoid color flicker.
        const oldTerrain = this.lastKnownTerrain.get(oldKey);
        if (oldTerrain) {
          this.updateTile(
            data.oldPosition.x,
            data.oldPosition.y,
            oldTerrain.glyph,
            oldTerrain.char,
            oldTerrain.color,
          );
        } else {
          // Don't guess terrain when cache is missing; request authoritative tile data.
          this.requestTileUpdate(data.oldPosition.x, data.oldPosition.y);
        }

        // Create a fake player glyph at the new position to ensure visual update
        // Use a typical player glyph number (around 331-360 range)
        this.updateTile(data.newPosition.x, data.newPosition.y, 331, "@", 0);
        console.log(
          `🎯 Player visual updated to position (${data.newPosition.x}, ${data.newPosition.y})`,
        );
        break;

      case "text":
        this.captureDamageFromMessage(data.text);
        this.addGameMessage(data.text);
        break;

      case "raw_print":
        this.captureDamageFromMessage(data.text);
        this.addGameMessage(data.text);
        break;

      case "menu_item":
        // Menu rows are accumulated and delivered with question/inventory events.
        // Ignore incremental item updates to avoid noisy unknown-type logs.
        break;

      case "direction_question":
        // Special handling for direction questions - show UI and pause movement
        this.isInQuestion = true;
        this.showDirectionQuestion(data.text);
        break;

      case "question":
        // Auto-handle character creation questions to avoid user interaction
        if (
          data.text &&
          (data.text.includes("character") ||
            data.text.includes("class") ||
            data.text.includes("race") ||
            data.text.includes("gender") ||
            data.text.includes("alignment"))
        ) {
          console.log("Auto-handling character creation:", data.text);
          // Send default character choices
          if (data.menuItems && data.menuItems.length > 0) {
            // Pick the first available option
            this.sendInput(data.menuItems[0].accelerator);
          } else if (data.default) {
            this.sendInput(data.default);
          } else {
            this.sendInput("a"); // Default to 'a' (often Archeologist)
          }
          return; // Don't show the dialog
        }

        // For non-character creation questions, show normal dialog and pause movement
        this.isInQuestion = true;
        this.showQuestion(
          data.text,
          data.choices,
          data.default,
          data.menuItems,
        );
        break;

      case "inventory_update":
        // Handle inventory updates without showing dialog
        const itemCount = data.items ? data.items.length : 0;
        const actualItems = data.items
          ? data.items.filter((item: any) => !item.isCategory)
          : [];
        console.log(
          `📦 Received inventory update with ${itemCount} total items (${actualItems.length} actual items)`,
        );

        // Store the current inventory for later display
        this.currentInventory = data.items || [];

        // If we have a pending inventory dialog request, show it now
        if (this.pendingInventoryDialog) {
          console.log("📦 Showing inventory dialog with fresh data");
          this.pendingInventoryDialog = false;
          this.showInventoryDialog();
        }

        // Update inventory display if we have an inventory UI element
        this.updateInventoryDisplay(data.items);

        break;

      case "info_menu":
        this.lastInfoMenu = {
          title: String(data.title || "NetHack Information"),
          lines: Array.isArray(data.lines) ? data.lines : [],
        };
        this.showInfoMenuDialog(
          this.lastInfoMenu.title,
          this.lastInfoMenu.lines,
        );
        break;

      case "position_request":
        // Only show meaningful position requests, filter out spam
        if (
          data.text &&
          data.text.trim() &&
          !data.text.includes("cursor") &&
          !data.text.includes("Select a position")
        ) {
          this.showPositionRequest(data.text);
        }
        break;

      case "name_request":
        // Auto-provide a default name to avoid user interaction
        console.log("Auto-providing default name for:", data.text);
        this.sendInput("Player");
        break;

      case "area_refresh_complete":
        console.log(
          `🔄 Area refresh completed: ${data.tilesRefreshed} tiles refreshed around (${data.centerX}, ${data.centerY})`,
        );
        this.addGameMessage(
          `Refreshed ${data.tilesRefreshed} tiles around (${data.centerX}, ${data.centerY})`,
        );
        break;

      case "tile_not_found":
        console.log(
          `⚠️ Tile not found at (${data.x}, ${data.y}): ${data.message}`,
        );
        break;

      case "clear_scene":
        console.log("🧹 Clearing 3D scene for level transition");
        this.clearScene();
        if (data.message) {
          this.addGameMessage(data.message);
        }
        break;

      case "status_update":
        console.log(
          `Status update: ${data.fieldName || data.field} = "${data.value}" (type=${data.valueType || "unknown"})`,
        );
        this.updatePlayerStats(data.field, data.value, data);
        break;

      case "damage_event":
        if (
          typeof data.x === "number" &&
          typeof data.y === "number" &&
          typeof data.amount === "number"
        ) {
          this.triggerDamageEffectsAtTile(data.x, data.y, data.amount);
        }
        break;

      default:
        console.log("Unknown message type:", data.type, data);
    }
  }

  private isDamageFlashableBehavior(behavior: TileBehaviorResult): boolean {
    if (behavior.isPlayerGlyph) {
      return true;
    }

    switch (behavior.effective.kind) {
      case "mon":
      case "pet":
      case "ridden":
      case "detect":
      case "invis":
        return true;
      default:
        return false;
    }
  }

  private classifyTilePayload(tile: any): TileBehaviorResult | null {
    if (
      !tile ||
      typeof tile.x !== "number" ||
      typeof tile.y !== "number" ||
      typeof tile.glyph !== "number"
    ) {
      return null;
    }

    const key = `${tile.x},${tile.y}`;
    return classifyTileBehavior({
      glyph: tile.glyph,
      runtimeChar: typeof tile.char === "string" ? tile.char : null,
      runtimeColor: typeof tile.color === "number" ? tile.color : null,
      priorTerrain: this.lastKnownTerrain.get(key) ?? null,
    });
  }

  private extractDamageAmountFromMessage(message: string): number | null {
    const patterns = [
      /\bfor\s+(-?\d+)\s+damage\b/i,
      /\btakes?\s+(-?\d+)\s+damage\b/i,
      /\bdeals?\s+(-?\d+)\s+damage\b/i,
      /\b(-?\d+)\s+points?\s+of\s+damage\b/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (!match || !match[1]) {
        continue;
      }

      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed !== 0) {
        return Math.abs(parsed);
      }
    }

    return null;
  }

  private isCombatDamageMessage(message: string): boolean {
    if (
      /\b(?:hits?|bites?|kicks?|claws?|slashes?|strikes?|punches?|shoots?|zaps?|burns?|stings?|mauls?|wounds?)\b/i.test(
        message,
      )
    ) {
      return true;
    }
    if (
      /\byou\s+(?:hit|bite|kick|slash|strike|punch|shoot|zap)\b/i.test(message)
    ) {
      return true;
    }
    return /\btakes?\s+-?\d+\s+damage\b/i.test(message);
  }

  private isPlayerDamageVictimMessage(message: string): boolean {
    if (
      /\b(?:hits?|bites?|kicks?|claws?|slashes?|strikes?|punches?|shoots?|zaps?|burns?|stings?|mauls?|wounds?)\s+you\b/i.test(
        message,
      )
    ) {
      return true;
    }
    if (
      /\byou\s+(?:take|suffer|receive|lose)\s+-?\d+\s+damage\b/i.test(message)
    ) {
      return true;
    }
    return /\byou are (?:hit|burned|zapped|injured|wounded)\b/i.test(message);
  }

  private queuePendingCharacterDamage(amount: number): void {
    const sanitized = Math.max(1, Math.round(Math.abs(amount)));
    this.pendingCharacterDamageQueue.push({
      amount: sanitized,
      createdAtMs: Date.now(),
    });

    if (this.pendingCharacterDamageQueue.length > 8) {
      this.pendingCharacterDamageQueue.splice(
        0,
        this.pendingCharacterDamageQueue.length - 8,
      );
    }
  }

  private prunePendingCharacterDamage(nowMs: number): void {
    this.pendingCharacterDamageQueue = this.pendingCharacterDamageQueue.filter(
      (entry) =>
        nowMs - entry.createdAtMs <= this.pendingCharacterDamageMaxAgeMs,
    );
  }

  private captureDamageFromMessage(messageLike: unknown): void {
    if (typeof messageLike !== "string") {
      return;
    }

    const normalized = messageLike.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return;
    }

    const amount = this.extractDamageAmountFromMessage(normalized);
    if (!amount || !this.isCombatDamageMessage(normalized)) {
      return;
    }

    if (this.isPlayerDamageVictimMessage(normalized)) {
      return;
    }

    const now = Date.now();
    if (
      normalized === this.lastParsedDamageMessage &&
      now - this.lastParsedDamageAtMs < 120
    ) {
      return;
    }
    this.lastParsedDamageMessage = normalized;
    this.lastParsedDamageAtMs = now;

    this.queuePendingCharacterDamage(amount);
  }

  private tryResolvePendingCharacterDamage(tile: any): void {
    if (!this.pendingCharacterDamageQueue.length) {
      return;
    }

    const now = Date.now();
    this.prunePendingCharacterDamage(now);
    if (!this.pendingCharacterDamageQueue.length) {
      return;
    }

    const behavior = this.classifyTilePayload(tile);
    if (
      !behavior ||
      behavior.isPlayerGlyph ||
      !this.isDamageFlashableBehavior(behavior)
    ) {
      return;
    }

    const nextDamage = this.pendingCharacterDamageQueue.shift();
    if (
      !nextDamage ||
      typeof tile.x !== "number" ||
      typeof tile.y !== "number"
    ) {
      return;
    }

    this.triggerDamageEffectsAtTile(tile.x, tile.y, nextDamage.amount);
  }

  private triggerDamageEffectsAtTile(
    x: number,
    y: number,
    amount: number,
  ): void {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(amount)
    ) {
      return;
    }

    const damage = Math.max(1, Math.round(Math.abs(amount)));
    const key = `${x},${y}`;
    this.startGlyphDamageFlash(key);
    this.spawnDamageNumberParticle(x, y, damage);
  }

  private enqueueTileUpdate(tile: any): void {
    if (!tile || typeof tile.x !== "number" || typeof tile.y !== "number") {
      return;
    }

    const key = `${tile.x},${tile.y}`;
    this.pendingTileUpdates.set(key, tile);

    if (this.tileFlushScheduled) {
      return;
    }

    this.tileFlushScheduled = true;
    requestAnimationFrame(() => this.flushPendingTileUpdates());
  }

  private flushPendingTileUpdates(): void {
    this.tileFlushScheduled = false;
    if (!this.pendingTileUpdates.size) {
      return;
    }

    const updates = Array.from(this.pendingTileUpdates.values());
    this.pendingTileUpdates.clear();

    for (const tile of updates) {
      const key = `${tile.x},${tile.y}`;
      const signature = `${tile.glyph}|${tile.char ?? ""}|${tile.color ?? ""}`;
      if (this.tileStateCache.get(key) === signature) {
        continue;
      }

      this.tileStateCache.set(key, signature);
      this.updateTile(tile.x, tile.y, tile.glyph, tile.char, tile.color);
    }
  }

  /**
   * Request a view update for a specific tile from the local runtime
   * @param x The x coordinate of the tile
   * @param y The y coordinate of the tile
   */
  public requestTileUpdate(x: number, y: number): void {
    if (this.session) {
      console.log(`Requesting tile update for (${x}, ${y})`);
      this.session.requestTileUpdate(x, y);
    } else {
      console.log("Cannot request tile update - runtime not started");
    }
  }
  public requestAreaUpdate(
    centerX: number,
    centerY: number,
    radius: number = 3,
  ): void {
    if (this.session) {
      console.log(
        `Requesting area update centered at (${centerX}, ${centerY}) with radius ${radius}`,
      );
      this.session.requestAreaUpdate(centerX, centerY, radius);
    } else {
      console.log("Cannot request area update - runtime not started");
    }
  }
  public requestPlayerAreaUpdate(radius: number = 5): void {
    this.requestAreaUpdate(this.playerPos.x, this.playerPos.y, radius);
  }

  private acquireGlyphTexture(
    textureKey: string,
    factory: () => THREE.CanvasTexture,
  ): THREE.CanvasTexture {
    const cached = this.glyphTextureCache.get(textureKey);
    if (cached) {
      cached.refCount += 1;
      return cached.texture;
    }

    const texture = factory();
    this.glyphTextureCache.set(textureKey, { texture, refCount: 1 });
    return texture;
  }

  private releaseGlyphTexture(textureKey: string): void {
    if (!textureKey) {
      return;
    }
    const cached = this.glyphTextureCache.get(textureKey);
    if (!cached) {
      return;
    }

    cached.refCount -= 1;
    if (cached.refCount <= 0) {
      cached.texture.dispose();
      this.glyphTextureCache.delete(textureKey);
    }
  }

  private disposeGlyphOverlay(overlay: GlyphOverlay): void {
    this.releaseGlyphTexture(overlay.textureKey);
    overlay.texture = null;
    overlay.textureKey = "";
    overlay.material.dispose();
  }

  private toneColor(hex: string, factor: number): string {
    const color = new THREE.Color(`#${hex}`);
    color.multiplyScalar(THREE.MathUtils.clamp(factor, 0, 1));
    return color.getHexString();
  }

  private relativeLuminance(color: THREE.Color): number {
    const channel = (value: number): number => {
      if (value <= 0.03928) return value / 12.92;
      return Math.pow((value + 0.055) / 1.055, 2.4);
    };
    const r = channel(color.r);
    const g = channel(color.g);
    const b = channel(color.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private contrastRatio(background: THREE.Color, text: THREE.Color): number {
    const l1 = this.relativeLuminance(background);
    const l2 = this.relativeLuminance(text);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  private ensureTextContrast(
    tonedBackgroundHex: string,
    textColor: string,
    minContrast: number = 4.5,
  ): string {
    const background = new THREE.Color(`#${tonedBackgroundHex}`);
    const text = new THREE.Color();
    text.set(textColor || "#ffffff");

    if (this.contrastRatio(background, text) >= minContrast) {
      return background.getHexString();
    }

    for (let i = 0; i < 6; i++) {
      background.multiplyScalar(0.85);
      if (this.contrastRatio(background, text) >= minContrast) {
        return background.getHexString();
      }
    }

    return background.getHexString();
  }

  private ensureGlyphOverlay(
    key: string,
    baseMaterial: THREE.MeshLambertMaterial,
  ): GlyphOverlay {
    const baseColorHex = baseMaterial.color.getHexString();
    let overlay = this.glyphOverlayMap.get(key);
    const needsNewOverlay =
      !overlay ||
      overlay.baseColorHex !== baseColorHex ||
      overlay.material instanceof THREE.MeshLambertMaterial === true;

    if (needsNewOverlay) {
      if (overlay) {
        this.disposeGlyphOverlay(overlay);
      }

      const materialClone = new THREE.MeshBasicMaterial({
        color: 0xdddddd,
        transparent: true,
        opacity: 1,
      });
      overlay = {
        texture: null,
        material: materialClone,
        baseColorHex,
        textureKey: "",
      };
      this.glyphOverlayMap.set(key, overlay);
    }

    return overlay!;
  }

  private createGlyphTexture(
    baseColorHex: string,
    glyphChar: string,
    textColor: string,
    darkenFactor: number = 1,
    size: number = 256,
  ): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create glyph texture canvas context");
    }
    this.drawGlyphTextureToCanvas(
      context,
      size,
      baseColorHex,
      glyphChar,
      textColor,
      darkenFactor,
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = Math.min(
      4,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;

    return texture;
  }

  private drawGlyphTextureToCanvas(
    context: CanvasRenderingContext2D,
    size: number,
    baseColorHex: string,
    glyphChar: string,
    textColor: string,
    darkenFactor: number = 1,
  ): void {
    context.clearRect(0, 0, size, size);

    const tonedBackground = this.toneColor(
      baseColorHex,
      0.8 * THREE.MathUtils.clamp(darkenFactor, 0, 1),
    );
    const contrastBackground = this.ensureTextContrast(
      tonedBackground,
      textColor,
    );
    context.fillStyle = `#${contrastBackground}`;
    context.fillRect(0, 0, size, size);

    const trimmed = glyphChar.trim();
    if (trimmed.length === 0) {
      return;
    }

    const fontSize = Math.floor(size * 0.6);
    context.font = `bold ${fontSize}px monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = textColor;
    context.fillText(trimmed, size / 2, size / 2);
  }

  private startGlyphDamageFlash(key: string): void {
    const mesh = this.tileMap.get(key);
    const overlay = this.glyphOverlayMap.get(key);
    if (
      !mesh ||
      !overlay ||
      !overlay.texture ||
      !mesh.userData ||
      !mesh.userData.isDamageFlashableCharacter
    ) {
      return;
    }

    const glyphChar =
      typeof mesh.userData.glyphChar === "string"
        ? mesh.userData.glyphChar
        : "";
    if (!glyphChar.trim()) {
      return;
    }

    const baseColorHex =
      typeof mesh.userData.glyphBaseColorHex === "string" &&
      mesh.userData.glyphBaseColorHex
        ? mesh.userData.glyphBaseColorHex
        : overlay.baseColorHex;
    const darkenFactor =
      typeof mesh.userData.glyphDarkenFactor === "number"
        ? THREE.MathUtils.clamp(mesh.userData.glyphDarkenFactor, 0, 1)
        : 1;

    let state = this.glyphDamageFlashes.get(key);
    if (!state) {
      const canvas = document.createElement("canvas");
      const size = this.glyphDamageFlashTextureSize;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      texture.anisotropy = Math.min(
        4,
        this.renderer.capabilities.getMaxAnisotropy(),
      );
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;

      state = {
        key,
        canvas,
        context,
        texture,
        elapsedMs: 0,
        durationMs: this.glyphDamageFlashDurationMs,
        baseColorHex,
        glyphChar,
        darkenFactor,
      };
      this.glyphDamageFlashes.set(key, state);
    } else {
      state.elapsedMs = 0;
      state.baseColorHex = baseColorHex;
      state.glyphChar = glyphChar;
      state.darkenFactor = darkenFactor;
    }

    overlay.material.map = state.texture;
    overlay.material.needsUpdate = true;
    this.renderGlyphDamageFlash(state, 1);
  }

  private renderGlyphDamageFlash(
    state: GlyphDamageFlashState,
    intensity: number,
  ): void {
    const clamped = THREE.MathUtils.clamp(intensity, 0, 1);
    this.glyphDamageFlashColor
      .copy(this.glyphDamageFlashWhite)
      .lerp(this.glyphDamageFlashRed, clamped);
    const flashTextColor = `#${this.glyphDamageFlashColor.getHexString()}`;

    this.drawGlyphTextureToCanvas(
      state.context,
      state.canvas.width,
      state.baseColorHex,
      state.glyphChar,
      flashTextColor,
      state.darkenFactor,
    );
    state.texture.needsUpdate = true;
  }

  private stopGlyphDamageFlash(key: string): void {
    const state = this.glyphDamageFlashes.get(key);
    if (!state) {
      return;
    }

    const overlay = this.glyphOverlayMap.get(key);
    if (overlay) {
      overlay.material.map = overlay.texture;
      overlay.material.needsUpdate = true;
    }

    state.texture.dispose();
    this.glyphDamageFlashes.delete(key);
  }

  private updateGlyphDamageFlashes(deltaSeconds: number): void {
    if (this.glyphDamageFlashes.size === 0) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const entries = Array.from(this.glyphDamageFlashes.entries());

    for (const [key, state] of entries) {
      if (!this.tileMap.has(key) || !this.glyphOverlayMap.has(key)) {
        this.stopGlyphDamageFlash(key);
        continue;
      }

      state.elapsedMs += deltaMs;
      const progress = THREE.MathUtils.clamp(
        state.elapsedMs / state.durationMs,
        0,
        1,
      );
      const intensity = Math.exp(-8.5 * progress);
      this.renderGlyphDamageFlash(state, intensity);

      const overlay = this.glyphOverlayMap.get(key);
      if (overlay) {
        overlay.material.map = state.texture;
      }

      if (progress >= 1) {
        this.stopGlyphDamageFlash(key);
      }
    }
  }

  private createDamageNumberTexture(label: string): {
    texture: THREE.CanvasTexture;
    aspectRatio: number;
  } {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create damage number canvas context");
    }

    context.clearRect(0, 0, size, size);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `900 ${Math.floor(size * 0.52)}px "Segoe UI", "Segoe UI Variable", sans-serif`;
    context.lineWidth = Math.max(3, Math.floor(size * 0.045));
    context.strokeStyle = "rgba(18, 0, 0, 0.95)";
    context.fillStyle = "#ff3a3a";
    context.strokeText(label, size / 2, size / 2);
    context.fillText(label, size / 2, size / 2);

    const measured = context.measureText(label).width;
    const aspectRatio = THREE.MathUtils.clamp(
      measured / (size * 0.42),
      0.6,
      2.3,
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = Math.min(
      4,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;

    return { texture, aspectRatio };
  }

  private spawnDamageNumberParticle(
    tileX: number,
    tileY: number,
    damage: number,
  ): void {
    const label = `-${Math.max(1, Math.round(Math.abs(damage)))}`;
    const { texture, aspectRatio } = this.createDamageNumberTexture(label);

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    material.opacity = 1;

    const sprite = new THREE.Sprite(material);
    const scaleMultiplier = 2.5;
    const scaleY = 0.42 * scaleMultiplier;
    const widthTighten = 0.72;
    const scaleX = THREE.MathUtils.clamp(
      scaleY * aspectRatio * widthTighten,
      0.26 * scaleMultiplier,
      0.92 * scaleMultiplier,
    );
    const baseScale = new THREE.Vector2(scaleX, scaleY);
    sprite.scale.set(baseScale.x, baseScale.y, 1);
    sprite.position.set(
      tileX * TILE_SIZE,
      -tileY * TILE_SIZE,
      this.damageParticleFloorZ + 0.28,
    );
    sprite.renderOrder = 940;
    this.scene.add(sprite);

    const launchSpeed = (1.95 + Math.random() * 0.45) * 5;
    const launchAngleRad = THREE.MathUtils.degToRad(10);
    const launchAzimuthRad = Math.random() * Math.PI * 2;
    const horizontalSpeed = launchSpeed * Math.sin(launchAngleRad);
    const verticalSpeed = launchSpeed * Math.cos(launchAngleRad);

    this.damageParticles.push({
      sprite,
      velocity: new THREE.Vector3(
        Math.cos(launchAzimuthRad) * horizontalSpeed,
        Math.sin(launchAzimuthRad) * horizontalSpeed,
        verticalSpeed,
      ),
      ageMs: 0,
      lifetimeMs: this.damageParticleLifetimeMs,
      radius: 0.09,
      baseScale,
    });
  }

  private disposeDamageParticle(index: number): void {
    if (index < 0 || index >= this.damageParticles.length) {
      return;
    }

    const [particle] = this.damageParticles.splice(index, 1);
    this.scene.remove(particle.sprite);

    const material = particle.sprite.material;
    if (material instanceof THREE.SpriteMaterial) {
      if (material.map) {
        material.map.dispose();
      }
      material.dispose();
    }
  }

  private resolveDamageParticleAgainstWallTile(
    particle: DamageNumberParticle,
    tileX: number,
    tileY: number,
  ): boolean {
    const position = particle.sprite.position;
    const half = TILE_SIZE / 2;
    const centerX = tileX * TILE_SIZE;
    const centerY = -tileY * TILE_SIZE;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;
    const radius = particle.radius;

    const closestX = THREE.MathUtils.clamp(position.x, minX, maxX);
    const closestY = THREE.MathUtils.clamp(position.y, minY, maxY);
    let nx = position.x - closestX;
    let ny = position.y - closestY;
    const distSq = nx * nx + ny * ny;

    if (distSq >= radius * radius) {
      return false;
    }

    let penetration = 0;
    if (distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      nx /= dist;
      ny /= dist;
      penetration = radius - dist;
    } else {
      const toLeft = position.x - minX;
      const toRight = maxX - position.x;
      const toBottom = position.y - minY;
      const toTop = maxY - position.y;
      const minPenetration = Math.min(toLeft, toRight, toBottom, toTop);

      if (minPenetration === toLeft) {
        nx = -1;
        ny = 0;
        penetration = toLeft + radius;
      } else if (minPenetration === toRight) {
        nx = 1;
        ny = 0;
        penetration = toRight + radius;
      } else if (minPenetration === toBottom) {
        nx = 0;
        ny = -1;
        penetration = toBottom + radius;
      } else {
        nx = 0;
        ny = 1;
        penetration = toTop + radius;
      }
    }

    position.x += nx * penetration;
    position.y += ny * penetration;

    const velocityIntoWall =
      particle.velocity.x * nx + particle.velocity.y * ny;
    if (velocityIntoWall < 0) {
      const bounce = (1 + this.damageParticleWallBounce) * velocityIntoWall;
      particle.velocity.x -= bounce * nx;
      particle.velocity.y -= bounce * ny;
      particle.velocity.x *= 0.78;
      particle.velocity.y *= 0.78;
    }

    return true;
  }

  private resolveDamageParticleWallCollision(
    particle: DamageNumberParticle,
  ): void {
    if (particle.sprite.position.z > WALL_HEIGHT + 0.22) {
      return;
    }

    const approxTileX = Math.round(particle.sprite.position.x / TILE_SIZE);
    const approxTileY = Math.round(-particle.sprite.position.y / TILE_SIZE);

    for (let x = approxTileX - 1; x <= approxTileX + 1; x += 1) {
      for (let y = approxTileY - 1; y <= approxTileY + 1; y += 1) {
        const wall = this.tileMap.get(`${x},${y}`);
        if (!wall || !wall.userData?.isWall) {
          continue;
        }
        this.resolveDamageParticleAgainstWallTile(particle, x, y);
      }
    }
  }

  private updateDamageParticles(deltaSeconds: number): void {
    if (!this.damageParticles.length) {
      return;
    }

    const deltaMs = deltaSeconds * 1000;
    const drag = Math.exp(-2.4 * deltaSeconds);

    for (let i = this.damageParticles.length - 1; i >= 0; i -= 1) {
      const particle = this.damageParticles[i];
      particle.ageMs += deltaMs;
      particle.velocity.z -= this.damageParticleGravity * deltaSeconds;
      particle.velocity.x *= drag;
      particle.velocity.y *= drag;

      particle.sprite.position.x += particle.velocity.x * deltaSeconds;
      particle.sprite.position.y += particle.velocity.y * deltaSeconds;
      particle.sprite.position.z += particle.velocity.z * deltaSeconds;

      this.resolveDamageParticleWallCollision(particle);

      if (particle.sprite.position.z < this.damageParticleFloorZ) {
        particle.sprite.position.z = this.damageParticleFloorZ;
        if (particle.velocity.z < 0) {
          particle.velocity.z *= -0.22;
        }
        particle.velocity.x *= 0.82;
        particle.velocity.y *= 0.82;
      }

      const material = particle.sprite.material;
      if (!(material instanceof THREE.SpriteMaterial)) {
        this.disposeDamageParticle(i);
        continue;
      }

      const lifeT = THREE.MathUtils.clamp(
        particle.ageMs / particle.lifetimeMs,
        0,
        1,
      );
      material.opacity = Math.max(0, 1 - lifeT * lifeT);

      const scaleBoost = 1 + (1 - lifeT) * 0.08;
      particle.sprite.scale.set(
        particle.baseScale.x * scaleBoost,
        particle.baseScale.y * scaleBoost,
        1,
      );

      if (lifeT >= 1 || material.opacity <= 0.01) {
        this.disposeDamageParticle(i);
      }
    }
  }

  private updateDamageEffects(deltaSeconds: number): void {
    this.updateGlyphDamageFlashes(deltaSeconds);
    this.updateDamageParticles(deltaSeconds);
    this.prunePendingCharacterDamage(Date.now());
  }

  private clearDamageEffects(): void {
    const flashKeys = Array.from(this.glyphDamageFlashes.keys());
    for (const key of flashKeys) {
      this.stopGlyphDamageFlash(key);
    }

    for (let i = this.damageParticles.length - 1; i >= 0; i -= 1) {
      this.disposeDamageParticle(i);
    }

    this.pendingCharacterDamageQueue = [];
    this.lastParsedDamageMessage = "";
    this.lastParsedDamageAtMs = 0;
  }

  private applyGlyphMaterial(
    key: string,
    mesh: THREE.Mesh,
    baseMaterial: THREE.MeshLambertMaterial,
    glyphChar: string,
    textColor: string,
    isWall: boolean,
    darkenFactor: number = 1,
  ): void {
    const overlay = this.ensureGlyphOverlay(key, baseMaterial);
    const baseColorHex = baseMaterial.color.getHexString();
    const clampedDarken = THREE.MathUtils.clamp(darkenFactor, 0, 1);
    const textureKey = `${baseColorHex}|${glyphChar}|${textColor}|${clampedDarken.toFixed(3)}`;

    if (overlay.textureKey !== textureKey) {
      if (overlay.textureKey) {
        this.releaseGlyphTexture(overlay.textureKey);
      }

      overlay.baseColorHex = baseColorHex;
      overlay.material.color.set("#ffffff");
      overlay.texture = this.acquireGlyphTexture(textureKey, () =>
        this.createGlyphTexture(
          baseColorHex,
          glyphChar,
          textColor,
          clampedDarken,
        ),
      );
      overlay.material.map = overlay.texture;
      overlay.material.needsUpdate = true;
      overlay.textureKey = textureKey;
    }
    overlay.material.color.set("#ffffff");

    const flashState = this.glyphDamageFlashes.get(key);
    if (flashState) {
      flashState.baseColorHex = baseColorHex;
      flashState.glyphChar = glyphChar;
      flashState.darkenFactor = clampedDarken;
      overlay.material.map = flashState.texture;
      overlay.material.needsUpdate = true;
    }

    const revealState = this.tileRevealFades.get(key);
    if (revealState) {
      overlay.material.opacity = revealState.opacity;
      overlay.material.needsUpdate = true;
    } else {
      overlay.material.opacity = 1;
    }

    if (isWall) {
      mesh.material = [
        baseMaterial,
        baseMaterial,
        baseMaterial,
        baseMaterial,
        overlay.material,
        baseMaterial,
      ];
    } else {
      mesh.material = overlay.material;
    }
  }

  private getMaterialByKind(kind: TileMaterialKind): THREE.MeshLambertMaterial {
    switch (kind) {
      case "floor":
        return this.materials.floor;
      case "stairs_up":
        return this.materials.stairs_up;
      case "stairs_down":
        return this.materials.stairs_down;
      case "wall":
        return this.materials.wall;
      case "dark_wall":
        return this.materials.dark_wall;
      case "door":
        return this.materials.door;
      case "dark":
        return this.materials.dark;
      case "water":
        return this.materials.water;
      case "trap":
        return this.materials.trap;
      case "feature":
        return this.materials.feature;
      case "fountain":
        return this.materials.fountain;
      case "player":
        return this.materials.player;
      case "monster_hostile":
        return this.materials.monster_hostile;
      case "monster_friendly":
        return this.materials.monster_friendly;
      case "monster_neutral":
        return this.materials.monster_neutral;
      case "item":
        return this.materials.item;
      case "effect_warning":
        return this.materials.effect_warning;
      case "effect_zap":
        return this.materials.effect_zap;
      case "effect_explode":
        return this.materials.effect_explode;
      case "effect_swallow":
        return this.materials.effect_swallow;
      default:
        return this.materials.default;
    }
  }

  private clearScene(): void {
    this.clearDamageEffects();
    this.clearTileRevealFades();
    console.log("🧹 Clearing all tiles and glyph overlays from 3D scene");

    // Clear all tile meshes
    this.tileMap.forEach((mesh, key) => {
      this.scene.remove(mesh);
    });
    this.tileMap.clear();

    // Clear glyph overlays and dispose textures/materials
    this.glyphOverlayMap.forEach((overlay) => {
      this.disposeGlyphOverlay(overlay);
    });
    this.glyphOverlayMap.clear();
    this.glyphTextureCache.forEach(({ texture }) => texture.dispose());
    this.glyphTextureCache.clear();
    this.disposeLightingOverlay();
    this.tileStateCache.clear();
    this.lastKnownTerrain.clear();
    this.pendingTileUpdates.clear();
    this.tileFlushScheduled = false;
    this.markLightingDirty();

    console.log("🧹 Scene cleared - ready for new level");
  }

  private updateTile(
    x: number,
    y: number,
    glyph: number,
    char?: string,
    color?: number,
  ): void {
    const key = `${x},${y}`;
    let mesh = this.tileMap.get(key);
    const hadMesh = Boolean(mesh);
    const wasUndiscovered = mesh
      ? Boolean(mesh.userData?.isUndiscovered)
      : true;
    const behavior = classifyTileBehavior({
      glyph,
      runtimeChar: char ?? null,
      runtimeColor: typeof color === "number" ? color : null,
      priorTerrain: this.lastKnownTerrain.get(key) ?? null,
    });
    const isUndiscovered = this.isUndiscoveredKind(behavior.effective.kind);
    const shouldRevealFade = !isUndiscovered && (!hadMesh || wasUndiscovered);

    if (!behavior.isPlayerGlyph) {
      if (this.isPersistentTerrainKind(behavior.resolved.kind)) {
        this.lastKnownTerrain.set(key, {
          glyph,
          char: behavior.resolved.char ?? undefined,
          color: behavior.resolved.color ?? undefined,
        });
      }
    } else {
      const oldPos = { ...this.playerPos };
      this.recordPlayerMovement(oldPos.x, oldPos.y, x, y);
      this.playerPos = { x, y };
      this.updateStatus(`Player at (${x}, ${y}) - NetHack 3D`);
    }

    const material = this.getMaterialByKind(behavior.materialKind);
    const geometry =
      behavior.geometryKind === "wall" ? this.wallGeometry : this.floorGeometry;
    const targetZ = behavior.isWall ? WALL_HEIGHT / 2 : 0;

    if (!mesh) {
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x * TILE_SIZE, -y * TILE_SIZE, targetZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.tileMap.set(key, mesh);
    } else {
      mesh.geometry = geometry;
      mesh.position.set(x * TILE_SIZE, -y * TILE_SIZE, targetZ);
    }

    mesh.userData.isWall = behavior.isWall;
    mesh.userData.effectKind = behavior.effectKind;
    mesh.userData.disposition = behavior.disposition;
    mesh.userData.isDamageFlashableCharacter =
      this.isDamageFlashableBehavior(behavior);
    mesh.userData.glyphChar = behavior.glyphChar;
    mesh.userData.glyphTextColor = behavior.textColor;
    mesh.userData.glyphDarkenFactor = behavior.darkenFactor;
    mesh.userData.glyphBaseColorHex = material.color.getHexString();
    mesh.userData.isUndiscovered = isUndiscovered;

    this.applyGlyphMaterial(
      key,
      mesh,
      material,
      behavior.glyphChar,
      behavior.textColor,
      behavior.isWall,
      behavior.darkenFactor,
    );
    if (isUndiscovered) {
      this.stopTileRevealFade(key);
    } else if (shouldRevealFade) {
      this.startTileRevealFade(key);
    }
    this.markLightingDirty();
  }
  private addGameMessage(message: string): void {
    if (!message || message.trim() === "") return;

    this.gameMessages.unshift(message);
    if (this.gameMessages.length > 100) {
      this.gameMessages.pop();
    }

    const logElement = document.getElementById("game-log");
    if (logElement) {
      logElement.innerHTML = this.gameMessages.join("<br>");
      logElement.scrollTop = 0; // Keep newest messages at top
    }

    if (this.hasPlayerMovedOnce) {
      this.showFloatingGameMessage(message);
    }
  }

  private recordPlayerMovement(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    const moved = fromX !== toX || fromY !== toY;

    if (!this.hasSeenPlayerPosition) {
      this.hasSeenPlayerPosition = true;
      return;
    }

    const hasRecentMovementInput =
      Date.now() - this.lastMovementInputAtMs <= this.movementUnlockWindowMs;

    if (!this.hasPlayerMovedOnce && moved && hasRecentMovementInput) {
      this.hasPlayerMovedOnce = true;
    }
  }

  private showFloatingGameMessage(message: string): void {
    if (
      !this.floatingMessageLayer ||
      !document.body.contains(this.floatingMessageLayer)
    ) {
      return;
    }

    const text = message.replace(/\s+/g, " ").trim();
    if (text.length === 0) {
      return;
    }

    const messageContainer = document.createElement("div");
    messageContainer.className = "floating-message-container";

    const floatingText = document.createElement("div");
    floatingText.textContent = text;
    floatingText.className = "floating-message-text";
    messageContainer.appendChild(floatingText);
    this.floatingMessageLayer.appendChild(messageContainer);

    const entry: FloatingMessageEntry = {
      container: messageContainer,
      text: floatingText,
      fadeTimerId: 0,
      removeTimerId: 0,
    };
    this.floatingMessageEntries.unshift(entry);

    while (this.floatingMessageEntries.length > this.maxFloatingMessages) {
      const oldest =
        this.floatingMessageEntries[this.floatingMessageEntries.length - 1];
      this.removeFloatingMessageEntry(oldest, false);
    }
    this.relayoutFloatingMessages();

    entry.fadeTimerId = window.setTimeout(() => {
      floatingText.style.transform = `translateY(-${this.floatingMessageRisePx}px)`;
      floatingText.style.opacity = "0";
    }, this.floatingMessageFadeDelayMs);

    entry.removeTimerId = window.setTimeout(
      () => {
        this.removeFloatingMessageEntry(entry);
      },
      this.floatingMessageFadeDelayMs + this.floatingMessageFadeDurationMs + 80,
    );
  }

  private relayoutFloatingMessages(): void {
    const offsetIndex = this.metaCommandOverlay ? 1 : 0;

    for (let i = 0; i < this.floatingMessageEntries.length; i += 1) {
      const entry = this.floatingMessageEntries[i];
      const stackIndex = i + offsetIndex;
      entry.container.style.top = `${-stackIndex * this.floatingMessageStackSpacingPx}px`;
    }
  }

  private removeFloatingMessageEntry(
    entry: FloatingMessageEntry,
    relayout: boolean = true,
  ): void {
    window.clearTimeout(entry.fadeTimerId);
    window.clearTimeout(entry.removeTimerId);

    const index = this.floatingMessageEntries.indexOf(entry);
    if (index >= 0) {
      this.floatingMessageEntries.splice(index, 1);
    }

    entry.container.remove();

    if (relayout) {
      this.relayoutFloatingMessages();
    }
  }

  private beginMetaCommandInput(): void {
    if (this.isInQuestion || this.isInDirectionQuestion) {
      return;
    }
    this.isInMetaCommandInput = true;
    this.metaCommandBuffer = "";
    this.renderMetaCommandOverlay();
  }

  private endMetaCommandInput(): void {
    this.isInMetaCommandInput = false;
    this.metaCommandBuffer = "";

    if (this.metaCommandOverlay) {
      this.metaCommandOverlay.container.remove();
      this.metaCommandOverlay = null;
    }

    this.relayoutFloatingMessages();
  }

  private renderMetaCommandOverlay(): void {
    if (
      !this.floatingMessageLayer ||
      !document.body.contains(this.floatingMessageLayer)
    ) {
      return;
    }

    if (!this.metaCommandOverlay) {
      const messageContainer = document.createElement("div");
      messageContainer.className =
        "floating-message-container floating-message-container-persistent";
      messageContainer.style.top = "0px";

      const floatingText = document.createElement("div");
      floatingText.className =
        "floating-message-text floating-message-text-persistent";

      messageContainer.appendChild(floatingText);
      this.floatingMessageLayer.appendChild(messageContainer);

      this.metaCommandOverlay = {
        container: messageContainer,
        text: floatingText,
      };
    }

    this.metaCommandOverlay.text.textContent = `#${this.metaCommandBuffer}`;
    this.relayoutFloatingMessages();
  }

  private submitMetaCommandInput(): void {
    this.sendInput("#");

    for (const char of this.metaCommandBuffer) {
      this.sendInput(char);
    }

    this.sendInput("Enter");
    this.endMetaCommandInput();
  }

  private cancelMetaCommandInput(): void {
    this.endMetaCommandInput();
  }

  private updateStatus(status: string): void {
    const statusElement = document.getElementById("game-status");
    if (statusElement) {
      statusElement.innerHTML = status;
    }
  }

  private updateConnectionStatus(status: string, color: string): void {
    const connElement = document.getElementById("connection-status");
    if (connElement) {
      connElement.innerHTML = status;
      connElement.setAttribute("data-state", status.toLowerCase());
    }
  }

  private updatePlayerStats(
    field: number,
    value: string | number | null,
    data: any,
  ): void {
    const legacyByIndex: { [key: number]: string } = {
      0: "name",
      1: "strength",
      2: "dexterity",
      3: "constitution",
      4: "intelligence",
      5: "wisdom",
      6: "charisma",
      7: "alignment",
      8: "score",
      9: "hp",
      10: "maxhp",
      11: "power",
      12: "maxpower",
      13: "armor",
      14: "level",
      15: "experience",
      16: "time",
      17: "hunger",
      18: "encumbrance",
      19: "dungeon",
      20: "dlevel",
      21: "gold",
    };

    const byName: { [key: string]: string } = {
      BL_TITLE: "name",
      BL_STR: "strength",
      BL_DX: "dexterity",
      BL_CO: "constitution",
      BL_IN: "intelligence",
      BL_WI: "wisdom",
      BL_CH: "charisma",
      BL_ALIGN: "alignment",
      BL_SCORE: "score",
      BL_HP: "hp",
      BL_HPMAX: "maxhp",
      BL_ENE: "power",
      BL_ENEMAX: "maxpower",
      BL_AC: "armor",
      BL_XP: "level",
      BL_EXP: "experience",
      BL_TIME: "time",
      BL_HUNGER: "hunger",
      BL_CAP: "encumbrance",
      BL_DNUM: "dungeon",
      BL_DLEVEL: "dlevel",
      BL_GOLD: "gold",
    };

    const rawFieldName =
      typeof data?.fieldName === "string" ? data.fieldName : null;
    const mappedField =
      (rawFieldName && byName[rawFieldName]) || legacyByIndex[field] || null;

    // Keep a rolling debug history for runtime inspection from devtools.
    this.statusDebugHistory.unshift({
      ts: Date.now(),
      field,
      fieldName: rawFieldName,
      mappedField,
      value,
      valueType: data?.valueType,
      chg: data?.chg,
      percent: data?.percent,
      color: data?.color,
      colormask: data?.colormask,
    });
    if (this.statusDebugHistory.length > 200) {
      this.statusDebugHistory.pop();
    }

    if (!mappedField || value === null || value === undefined) {
      console.log(
        `Skipping status update: field=${field}, fieldName=${rawFieldName}, value=${value}`,
      );
      return;
    }

    const numericFields = new Set([
      "hp",
      "maxhp",
      "power",
      "maxpower",
      "level",
      "experience",
      "time",
      "armor",
      "score",
      "gold",
      "dlevel",
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma",
    ]);

    let parsedValue: any = value;
    if (numericFields.has(mappedField)) {
      if (typeof value === "number") {
        parsedValue = value;
      } else {
        const clean = String(value).trim();
        const match = clean.match(/^-?\d+/);
        if (!match) {
          console.log(
            `Could not parse numeric status ${mappedField} from "${value}"`,
          );
          return;
        }
        parsedValue = parseInt(match[0], 10);
      }
    } else {
      parsedValue = String(value).trim();
    }

    console.log(`Updating status ${mappedField}: ${parsedValue}`);
    const previousHp = this.playerStats.hp;
    let playerDamageTaken: number | null = null;
    if (mappedField === "hp" && typeof parsedValue === "number") {
      const parsedChange = Number(data?.chg);
      if (this.hasReceivedHpStatus) {
        if (Number.isFinite(parsedChange) && parsedChange < 0) {
          playerDamageTaken = Math.round(Math.abs(parsedChange));
        } else if (parsedValue < previousHp) {
          playerDamageTaken = Math.round(previousHp - parsedValue);
        }
      }
    }

    if (mappedField === "maxhp") {
      this.playerStats.maxHp = parsedValue;
    } else if (mappedField === "maxpower") {
      this.playerStats.maxPower = parsedValue;
    } else if (mappedField === "dlevel") {
      this.playerStats.dlevel = parsedValue;
    } else {
      (this.playerStats as any)[mappedField] = parsedValue;
    }

    if (mappedField === "hp") {
      this.hasReceivedHpStatus = true;
      if (playerDamageTaken && playerDamageTaken > 0) {
        this.triggerDamageEffectsAtTile(
          this.playerPos.x,
          this.playerPos.y,
          playerDamageTaken,
        );
      }
    }

    this.updateStatsDisplay();
  }

  private updateStatsDisplay(): void {
    // Update or create the stats bar
    let statsBar = document.getElementById("stats-bar");
    if (!statsBar) {
      // Create the stats bar at the top of the screen
      statsBar = document.createElement("div");
      statsBar.id = "stats-bar";
      document.body.appendChild(statsBar);

      // Adjust the game log position to accommodate the stats bar
      const gameLogContainer = document.querySelector(
        ".top-left-ui",
      ) as HTMLElement;
      if (gameLogContainer) {
        gameLogContainer.classList.add("with-stats");
      }
    }

    // Create HP bar component
    const hpPercentage =
      this.playerStats.maxHp > 0
        ? (this.playerStats.hp / this.playerStats.maxHp) * 100
        : 0;
    const hpColor =
      hpPercentage > 60 ? "#00ff00" : hpPercentage > 30 ? "#ffaa00" : "#ff0000";

    // Build the complete stats display
    statsBar.innerHTML = `
      <div class="nh3d-stats-name">
        ${this.playerStats.name} (Lvl ${this.playerStats.level})
      </div>

      <div class="nh3d-stats-meter">
        <div class="nh3d-stats-meter-label nh3d-stats-meter-label-hp">
          HP: ${this.playerStats.hp}/${this.playerStats.maxHp}
        </div>
        <div class="nh3d-stats-meter-track">
          <div class="nh3d-stats-meter-fill" id="nh3d-stats-hp-fill"></div>
        </div>
      </div>

      ${
        this.playerStats.maxPower > 0
          ? `<div class="nh3d-stats-meter">
               <div class="nh3d-stats-meter-label nh3d-stats-meter-label-pw">
                 Pw: ${this.playerStats.power}/${this.playerStats.maxPower}
               </div>
               <div class="nh3d-stats-meter-track">
                 <div class="nh3d-stats-meter-fill nh3d-stats-meter-fill-pw" id="nh3d-stats-pw-fill"></div>
               </div>
             </div>`
          : ""
      }

      <div class="nh3d-stats-group">
        <div class="nh3d-stats-core">St:${this.playerStats.strength}</div>
        <div class="nh3d-stats-core">Dx:${this.playerStats.dexterity}</div>
        <div class="nh3d-stats-core">Co:${this.playerStats.constitution}</div>
        <div class="nh3d-stats-core">In:${this.playerStats.intelligence}</div>
        <div class="nh3d-stats-core">Wi:${this.playerStats.wisdom}</div>
        <div class="nh3d-stats-core">Ch:${this.playerStats.charisma}</div>
      </div>

      <div class="nh3d-stats-group">
        <div class="nh3d-stats-secondary-ac">AC:${this.playerStats.armor}</div>
        <div class="nh3d-stats-secondary-gold">$:${this.playerStats.gold}</div>
        <div class="nh3d-stats-secondary-time">T:${this.playerStats.time}</div>
      </div>

      <div class="nh3d-stats-location">
        <div class="nh3d-stats-dungeon">${this.playerStats.dungeon} ${
          this.playerStats.dlevel
        }</div>
        <div class="nh3d-stats-hunger">${this.playerStats.hunger}${
          this.playerStats.encumbrance ? " " + this.playerStats.encumbrance : ""
        }</div>
      </div>
    `;

    const hpFill = statsBar.querySelector<HTMLElement>("#nh3d-stats-hp-fill");
    if (hpFill) {
      hpFill.style.width = `${THREE.MathUtils.clamp(hpPercentage, 0, 100)}%`;
      hpFill.style.backgroundColor = hpColor;
    }

    if (this.playerStats.maxPower > 0) {
      const powerPercentage =
        (this.playerStats.power / this.playerStats.maxPower) * 100;
      const pwFill = statsBar.querySelector<HTMLElement>("#nh3d-stats-pw-fill");
      if (pwFill) {
        pwFill.style.width = `${THREE.MathUtils.clamp(powerPercentage, 0, 100)}%`;
      }
    }
  }

  private updateInventoryDisplay(items: any[]): void {
    // Update inventory display without showing a dialog
    // This is for informational inventory updates from NetHack

    if (!items || items.length === 0) {
      console.log("📦 Inventory is empty");
      return;
    }

    // Log inventory items for debugging
    console.log("📦 Current inventory:");
    items.forEach((item, index) => {
      if (item.isCategory) {
        console.log(`  📁 ${item.text}`);
      } else {
        console.log(`  ${item.accelerator || "?"}) ${item.text}`);
      }
    });

    // TODO: If we add an inventory panel to the UI in the future, update it here
    // For now, we just log the inventory and don't show any dialog
  }

  private isMultiSelectLootQuestion(question: string): boolean {
    if (typeof question !== "string") {
      return false;
    }

    const normalizedQuestion = question.trim().toLowerCase();
    return (
      normalizedQuestion.includes("pick up what") ||
      normalizedQuestion.includes("what do you want to pick up") ||
      normalizedQuestion.includes("take out what") ||
      normalizedQuestion.includes("put in what") ||
      normalizedQuestion.includes("what do you want to put in") ||
      normalizedQuestion.includes("put in, then take out what")
    );
  }

  private showQuestion(
    question: string,
    choices: string,
    defaultChoice: string,
    menuItems: any[],
  ): void {
    // Temporarily disable automatic "?" expansion to debug menu issues
    // TODO: Re-enable with better logic later
    const needsExpansion = false;

    if (needsExpansion) {
      console.log(
        "🔍 Question includes '?' option, automatically expanding options...",
      );
      // Send "?" to get detailed menu items
      this.sendInput("?");
      // Don't show the dialog yet - wait for expanded menu items
      return;
    }

    // Create or get question dialog
    let questionDialog = document.getElementById("question-dialog");
    if (!questionDialog) {
      questionDialog = document.createElement("div");
      questionDialog.id = "question-dialog";
      questionDialog.className = "nh3d-dialog nh3d-dialog-question";
      document.body.appendChild(questionDialog);
    }

    // Clear previous content
    questionDialog.innerHTML = "";

    // Add question text
    const questionText = document.createElement("div");
    questionText.className = "nh3d-question-text";
    questionText.textContent = question;
    questionDialog.appendChild(questionText);

    // Add menu items if available
    if (menuItems && menuItems.length > 0) {
      // Use multi-select UI for floor pickup and container looting menus.
      const isPickupDialog = this.isMultiSelectLootQuestion(question);

      if (isPickupDialog) {
        // Create multi-selection pickup dialog
        this.createPickupDialog(questionDialog, menuItems, question);
      } else {
        // Create standard single-selection menu
        this.createStandardMenu(questionDialog, menuItems);
      }
    } else {
      // Add choice buttons for simple y/n questions
      const choiceContainer = document.createElement("div");
      choiceContainer.className = "nh3d-choice-list";

      const parsedChoices = this.parseQuestionChoices(question, choices);
      const useCompactChoiceLayout =
        parsedChoices.length > 0 &&
        parsedChoices.every((choice) => choice.trim().length === 1);
      if (useCompactChoiceLayout) {
        choiceContainer.classList.add("is-compact");
      }
      if (parsedChoices.length > 0) {
        for (const choice of parsedChoices) {
          const button = document.createElement("button");
          button.className = "nh3d-choice-button";
          if (choice === defaultChoice) {
            button.classList.add("nh3d-choice-button-default");
          }
          button.textContent = this.getQuestionChoiceLabel(choice);
          button.onclick = () => {
            this.sendInput(choice);
            this.hideQuestion();
          };
          choiceContainer.appendChild(button);
        }
      }

      questionDialog.appendChild(choiceContainer);
    }

    // Add escape instruction
    const escapeText = document.createElement("div");
    escapeText.className = "nh3d-dialog-hint";
    escapeText.textContent = "Press ESC to cancel";
    questionDialog.appendChild(escapeText);

    // Show the dialog
    questionDialog.classList.add("is-visible");
  }

  private parseQuestionChoices(question: string, choices: string): string[] {
    const merged: string[] = [];
    const seen = new Set<string>();

    const addChoice = (choice: string): void => {
      if (!choice || seen.has(choice)) {
        return;
      }
      seen.add(choice);
      merged.push(choice);
    };

    for (const choice of this.expandChoiceSpec(choices)) {
      addChoice(choice);
    }

    const bracketMatch = question ? question.match(/\[([^\]]+)\]/) : null;
    if (bracketMatch && bracketMatch[1]) {
      for (const choice of this.expandChoiceSpec(bracketMatch[1])) {
        addChoice(choice);
      }
    }

    return merged;
  }

  private expandChoiceSpec(spec: string): string[] {
    const normalized = (spec || "")
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

    for (let i = 0; i < normalized.length; i += 1) {
      const current = normalized[i];
      const hasRangeEnd =
        i + 2 < normalized.length && normalized[i + 1] === "-";

      if (hasRangeEnd) {
        const end = normalized[i + 2];
        if (this.canExpandChoiceRange(current, end)) {
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

  private canExpandChoiceRange(start: string, end: string): boolean {
    const isLower = (value: string) => value >= "a" && value <= "z";
    const isUpper = (value: string) => value >= "A" && value <= "Z";
    const isDigit = (value: string) => value >= "0" && value <= "9";

    return (
      (isLower(start) && isLower(end)) ||
      (isUpper(start) && isUpper(end)) ||
      (isDigit(start) && isDigit(end))
    );
  }

  private getQuestionChoiceLabel(choice: string): string {
    const normalizedChoice = choice.trim();
    if (!normalizedChoice) {
      return choice;
    }

    const inventoryItem = this.currentInventory.find((item) => {
      if (!item || item.isCategory) {
        return false;
      }

      const accelerator =
        typeof item.accelerator === "string" ? item.accelerator.trim() : "";
      if (!accelerator) {
        return false;
      }

      return (
        accelerator === normalizedChoice ||
        accelerator.toLowerCase() === normalizedChoice.toLowerCase()
      );
    });

    if (!inventoryItem || typeof inventoryItem.text !== "string") {
      return normalizedChoice;
    }

    const itemText = inventoryItem.text.trim();
    if (!itemText) {
      return normalizedChoice;
    }

    return `${normalizedChoice}) ${itemText}`;
  }

  private showDirectionQuestion(question: string): void {
    // Set direction question state to pause movement
    this.isInDirectionQuestion = true;

    // Create or get direction dialog
    let directionDialog = document.getElementById("direction-dialog");
    if (!directionDialog) {
      directionDialog = document.createElement("div");
      directionDialog.id = "direction-dialog";
      directionDialog.className = "nh3d-dialog nh3d-dialog-direction";
      document.body.appendChild(directionDialog);
    }

    // Clear previous content
    directionDialog.innerHTML = "";

    // Add question text
    const questionText = document.createElement("div");
    questionText.className = "nh3d-direction-text";
    questionText.textContent = question;
    directionDialog.appendChild(questionText);

    // Add direction buttons
    const directionsContainer = document.createElement("div");
    directionsContainer.className = "nh3d-direction-grid";

    const directions = [
      { key: "7", label: "↖", name: "NW" },
      { key: "8", label: "↑", name: "N" },
      { key: "9", label: "↗", name: "NE" },
      { key: "4", label: "←", name: "W" },
      { key: "5", label: "•", name: "Wait" },
      { key: "6", label: "→", name: "E" },
      { key: "1", label: "↙", name: "SW" },
      { key: "2", label: "↓", name: "S" },
      { key: "3", label: "↘", name: "SE" },
    ];

    directions.forEach((dir) => {
      const button = document.createElement("button");
      button.className = "nh3d-direction-button";
      button.innerHTML = `<div class="nh3d-direction-symbol">${dir.label}</div><div class="nh3d-direction-key">${dir.key}</div>`;

      button.onclick = () => {
        this.sendInput(dir.key);
        this.hideDirectionQuestion();
      };

      directionsContainer.appendChild(button);
    });

    directionDialog.appendChild(directionsContainer);

    // Add escape instruction
    const escapeText = document.createElement("div");
    escapeText.className = "nh3d-dialog-hint";
    escapeText.textContent =
      "Use numpad (1-9), arrow keys, or click a direction. Press ESC to cancel";
    directionDialog.appendChild(escapeText);

    // Show the dialog
    directionDialog.classList.add("is-visible");
  }

  private hideDirectionQuestion(): void {
    this.isInDirectionQuestion = false;
    this.isInQuestion = false; // Clear general question state
    const directionDialog = document.getElementById("direction-dialog");
    if (directionDialog) {
      directionDialog.classList.remove("is-visible");
    }
  }

  private showInfoMenuDialog(title: string, lines: string[]): void {
    let infoDialog = document.getElementById("info-menu-dialog");
    if (!infoDialog) {
      infoDialog = document.createElement("div");
      infoDialog.id = "info-menu-dialog";
      infoDialog.className = "nh3d-dialog nh3d-dialog-info";
      document.body.appendChild(infoDialog);
    }

    infoDialog.innerHTML = "";

    const titleEl = document.createElement("div");
    titleEl.className = "nh3d-info-title";
    titleEl.textContent = title || "NetHack Information";
    infoDialog.appendChild(titleEl);

    const body = document.createElement("div");
    body.className = "nh3d-info-body";
    body.textContent =
      lines && lines.length > 0 ? lines.join("\n") : "(No details)";
    infoDialog.appendChild(body);

    const hint = document.createElement("div");
    hint.className = "nh3d-info-hint";
    hint.textContent = "Press ESC to close. Press Ctrl+M to reopen.";
    infoDialog.appendChild(hint);

    infoDialog.classList.add("is-visible");
  }

  private hideInfoMenuDialog(): void {
    const infoDialog = document.getElementById("info-menu-dialog");
    if (infoDialog) {
      infoDialog.classList.remove("is-visible");
    }
  }

  private toggleInfoMenuDialog(): void {
    const infoDialog = document.getElementById("info-menu-dialog");
    if (infoDialog && infoDialog.classList.contains("is-visible")) {
      this.hideInfoMenuDialog();
      return;
    }

    if (this.lastInfoMenu) {
      this.showInfoMenuDialog(this.lastInfoMenu.title, this.lastInfoMenu.lines);
    } else {
      this.addGameMessage("No recent information panel to reopen.");
    }
  }

  private showInventoryDialog(): void {
    // Create or get inventory dialog
    let inventoryDialog = document.getElementById("inventory-dialog");
    if (!inventoryDialog) {
      inventoryDialog = document.createElement("div");
      inventoryDialog.id = "inventory-dialog";
      inventoryDialog.className = "nh3d-dialog nh3d-dialog-inventory";
      document.body.appendChild(inventoryDialog);
    }

    // Clear previous content
    inventoryDialog.innerHTML = "";

    // Add title
    const title = document.createElement("div");
    title.className = "nh3d-inventory-title";
    title.textContent = "📦 INVENTORY";
    inventoryDialog.appendChild(title);

    // Add inventory items
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "nh3d-inventory-items";

    if (this.currentInventory.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "nh3d-inventory-empty";
      emptyMessage.textContent = "Your inventory is empty.";
      itemsContainer.appendChild(emptyMessage);
    } else {
      // Display both categories and items (don't filter out categories)
      this.currentInventory.forEach((item: any, index: number) => {
        if (item.isCategory) {
          // This is a category header
          const categoryHeader = document.createElement("div");
          categoryHeader.className = "nh3d-inventory-category";
          if (index === 0) {
            categoryHeader.classList.add("nh3d-inventory-category-first");
          }
          categoryHeader.textContent = item.text;
          itemsContainer.appendChild(categoryHeader);
        } else {
          // This is an actual item
          const itemDiv = document.createElement("div");
          itemDiv.className = "nh3d-inventory-item";

          const keySpan = document.createElement("span");
          keySpan.className = "nh3d-inventory-key";
          keySpan.textContent = `${item.accelerator || "?"})`;

          const textSpan = document.createElement("span");
          textSpan.className = "nh3d-inventory-text";
          textSpan.textContent = item.text || "Unknown item";

          itemDiv.appendChild(keySpan);
          itemDiv.appendChild(textSpan);
          itemsContainer.appendChild(itemDiv);
        }
      });
    }

    inventoryDialog.appendChild(itemsContainer);

    // Add compact NetHack item handling keybinds
    const keybindsTitle = document.createElement("div");
    keybindsTitle.className = "nh3d-inventory-keybinds-title";
    keybindsTitle.textContent = "🎮 ITEM COMMANDS";
    inventoryDialog.appendChild(keybindsTitle);

    // Create commands container
    const keybindsContainer = document.createElement("div");
    keybindsContainer.className = "nh3d-inventory-keybinds";

    // Create highlighted command list with color-coded keys
    const commandText = `<span class="nh3d-inventory-command-key">a</span>)pply <span class="nh3d-inventory-command-key">d</span>)rop <span class="nh3d-inventory-command-key">e</span>)at <span class="nh3d-inventory-command-key">q</span>)uaff <span class="nh3d-inventory-command-key">r</span>)ead <span class="nh3d-inventory-command-key">t</span>)hrow <span class="nh3d-inventory-command-key">w</span>)ield <span class="nh3d-inventory-command-key">W</span>)ear <span class="nh3d-inventory-command-key">T</span>)ake-off <span class="nh3d-inventory-command-key">P</span>)ut-on <span class="nh3d-inventory-command-key">R</span>)emove <span class="nh3d-inventory-command-key">z</span>)ap <span class="nh3d-inventory-command-key">Z</span>)cast
    Special: <span class="nh3d-inventory-command-key">"</span>)weapons <span class="nh3d-inventory-command-key">[</span>)armor <span class="nh3d-inventory-command-key">=</span>)rings <span class="nh3d-inventory-command-key">"</span>)amulets <span class="nh3d-inventory-command-key">(</span>)tools`;

    keybindsContainer.innerHTML = `<div class="nh3d-inventory-keybinds-text">${commandText}</div>`;
    inventoryDialog.appendChild(keybindsContainer);

    // Add close instructions
    const closeText = document.createElement("div");
    closeText.className = "nh3d-inventory-close";
    closeText.textContent = "Press ESC or 'i' to close";
    inventoryDialog.appendChild(closeText);

    // Show the dialog
    inventoryDialog.classList.add("is-visible");
  }

  private hideInventoryDialog(): void {
    const inventoryDialog = document.getElementById("inventory-dialog");
    if (inventoryDialog) {
      inventoryDialog.classList.remove("is-visible");
    }
    // Clear any pending inventory dialog flag
    this.pendingInventoryDialog = false;
  }

  private showPositionRequest(text: string): void {
    // Create or get position dialog
    let posDialog = document.getElementById("position-dialog");
    if (!posDialog) {
      posDialog = document.createElement("div");
      posDialog.id = "position-dialog";
      document.body.appendChild(posDialog);
    }

    posDialog.textContent = text;
    posDialog.classList.add("is-visible");

    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (posDialog) {
        posDialog.classList.remove("is-visible");
      }
    }, 3000);
  }

  private showNameRequest(text: string, maxLength: number): void {
    // Create or get name dialog
    let nameDialog = document.getElementById("name-dialog");
    if (!nameDialog) {
      nameDialog = document.createElement("div");
      nameDialog.id = "name-dialog";
      nameDialog.className = "nh3d-dialog nh3d-dialog-name";
      document.body.appendChild(nameDialog);
    }

    // Clear previous content
    nameDialog.innerHTML = "";

    // Add question text
    const questionText = document.createElement("div");
    questionText.className = "nh3d-name-question";
    questionText.textContent = text;
    nameDialog.appendChild(questionText);

    // Add input field
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.maxLength = maxLength;
    nameInput.placeholder = "Enter your name";
    nameInput.className = "nh3d-name-input";
    nameDialog.appendChild(nameInput);

    // Add submit button
    const submitButton = document.createElement("button");
    submitButton.textContent = "OK";
    submitButton.className = "nh3d-name-submit";

    const submitName = () => {
      const name = nameInput.value.trim() || "Adventurer";
      this.sendInput(name);
      nameDialog.classList.remove("is-visible");
    };

    submitButton.onclick = submitName;
    nameInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        submitName();
      }
    };

    nameDialog.appendChild(submitButton);

    // Show dialog and focus input
    nameDialog.classList.add("is-visible");
    nameInput.focus();
  }

  private hideQuestion(): void {
    this.isInQuestion = false; // Clear general question state
    const questionDialog = document.getElementById("question-dialog");
    if (questionDialog) {
      questionDialog.classList.remove("is-visible");
      questionDialog.innerHTML = ""; // Clear content to prevent retention
      // Clear pickup dialog flags
      (questionDialog as any).isPickupDialog = false;
      (questionDialog as any).menuItems = null;
    }
  }

  private createPickupDialog(
    questionDialog: HTMLElement,
    menuItems: any[],
    question: string,
  ): void {
    // Track selected items for multi-pickup
    const selectedItems = new Set<string>();

    menuItems.forEach((item) => {
      if (
        item.isCategory ||
        !item.accelerator ||
        item.accelerator.trim() === ""
      ) {
        // Category header
        const categoryHeader = document.createElement("div");
        categoryHeader.className = "nh3d-menu-category";
        categoryHeader.textContent = item.text;
        questionDialog.appendChild(categoryHeader);
      } else {
        // Selectable item with checkbox
        const itemContainer = document.createElement("div");
        itemContainer.className = "nh3d-pickup-item";

        // Checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `pickup-${item.accelerator}`;
        checkbox.className = "nh3d-pickup-checkbox";

        // Key label
        const keyPart = document.createElement("span");
        keyPart.className = "nh3d-pickup-key";
        keyPart.textContent = `${item.accelerator})`;

        // Item text
        const textPart = document.createElement("span");
        textPart.className = "nh3d-pickup-text";
        textPart.textContent = item.text;

        const applySelectionState = (
          isSelected: boolean,
          shouldSendInput: boolean,
        ) => {
          checkbox.checked = isSelected;
          if (isSelected) {
            selectedItems.add(item.accelerator);
            itemContainer.classList.add("nh3d-pickup-item-selected");
          } else {
            selectedItems.delete(item.accelerator);
            itemContainer.classList.remove("nh3d-pickup-item-selected");
          }
          if (shouldSendInput) {
            // Send the key to NetHack to keep game state in sync
            this.sendInput(item.accelerator);
          }
        };

        // Toggle function
        const toggleItem = () => {
          applySelectionState(!checkbox.checked, true);
        };

        // Click handlers
        itemContainer.onclick = (e) => {
          e.preventDefault();
          toggleItem();
        };

        checkbox.onclick = (e) => {
          // Prevent checkbox clicks from triggering the row click handler.
          e.stopPropagation();
        };

        checkbox.onchange = (e) => {
          e.stopPropagation();
          // Checkbox state is already updated by the browser click action.
          applySelectionState(checkbox.checked, true);
        };

        // Store toggle function for keyboard access
        (itemContainer as any).toggleItem = toggleItem;
        (itemContainer as any).accelerator = item.accelerator;

        itemContainer.appendChild(checkbox);
        itemContainer.appendChild(keyPart);
        itemContainer.appendChild(textPart);
        questionDialog.appendChild(itemContainer);
      }
    });

    // Add confirmation instruction
    const confirmInstruction = document.createElement("div");
    confirmInstruction.className = "nh3d-pickup-confirm";
    confirmInstruction.textContent =
      "Press ENTER to confirm selection, or ESC to cancel";
    questionDialog.appendChild(confirmInstruction);

    // Store that this is a pickup dialog for keyboard handling
    (questionDialog as any).isPickupDialog = true;
    (questionDialog as any).menuItems = menuItems;
  }

  private createStandardMenu(
    questionDialog: HTMLElement,
    menuItems: any[],
  ): void {
    menuItems.forEach((item) => {
      if (
        item.isCategory ||
        !item.accelerator ||
        item.accelerator.trim() === ""
      ) {
        // Category header
        const categoryHeader = document.createElement("div");
        categoryHeader.className = "nh3d-menu-category";
        categoryHeader.textContent = item.text;
        questionDialog.appendChild(categoryHeader);
      } else {
        // Standard single-selection button
        const menuButton = document.createElement("button");
        menuButton.className = "nh3d-menu-button";

        // Format the button text with key and description
        const keyPart = document.createElement("span");
        keyPart.className = "nh3d-menu-button-key";
        keyPart.textContent = `${item.accelerator}) `;

        const textPart = document.createElement("span");
        textPart.textContent = item.text;

        menuButton.appendChild(keyPart);
        menuButton.appendChild(textPart);

        menuButton.onclick = () => {
          this.sendInput(item.accelerator);
          this.hideQuestion();
        };
        questionDialog.appendChild(menuButton);
      }
    });
  }

  private sendInput(input: string): void {
    if (
      !this.hasPlayerMovedOnce &&
      !this.isInQuestion &&
      !this.isInDirectionQuestion &&
      this.isMovementInput(input)
    ) {
      this.lastMovementInputAtMs = Date.now();
    }

    if (this.session) {
      this.session.sendInput(input);
    }
  }

  private isMovementInput(input: string): boolean {
    if (input.length === 1) {
      switch (input) {
        case "h":
        case "j":
        case "k":
        case "l":
        case "y":
        case "u":
        case "b":
        case "n":
        case "H":
        case "J":
        case "K":
        case "L":
        case "Y":
        case "U":
        case "B":
        case "N":
        case "1":
        case "2":
        case "3":
        case "4":
        case "6":
        case "7":
        case "8":
        case "9":
          return true;
        default:
          return false;
      }
    }

    switch (input) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
      case "Home":
      case "End":
      case "PageUp":
      case "PageDown":
        return true;
      default:
        return false;
    }
  }
  private getModifiedInput(event: KeyboardEvent): string | null {
    // NetHack meta commands are represented as ESC + key in the runtime bridge.
    const hasMetaModifier = event.altKey || event.metaKey || this.altOrMetaHeld;
    if (!hasMetaModifier) {
      return null;
    }
    if (
      event.key === "Alt" ||
      event.key === "Meta" ||
      event.key === "Control" ||
      event.key === "Shift"
    ) {
      return null;
    }
    const normalizedKey = this.getMetaPrimaryKey(event);
    if (!normalizedKey) {
      return null;
    }
    return `${this.metaInputPrefix}${normalizedKey}`;
  }

  private getMetaPrimaryKey(event: KeyboardEvent): string | null {
    if (event.code.startsWith("Key") && event.code.length === 4) {
      return event.code.slice(3).toLowerCase();
    }
    if (event.code.startsWith("Digit") && event.code.length === 6) {
      return event.code.slice(5);
    }
    if (event.key.length === 1) {
      return event.key.toLowerCase();
    }
    return null;
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.key === "Alt" || event.key === "Meta") {
      this.altOrMetaHeld = false;
    }
  }

  private handleWindowBlur(): void {
    this.altOrMetaHeld = false;
  }

  private normalizeWaitKey(event: KeyboardEvent): string | null {
    if (event.key === ">") {
      return null;
    }
    if (
      event.key === "." ||
      event.key === " " ||
      event.key === "Spacebar" ||
      event.key === "Space" ||
      event.key === "Decimal" ||
      event.key === "NumpadDecimal" ||
      event.code === "NumpadDecimal" ||
      event.code === "Space"
    ) {
      return ".";
    }
    return null;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Alt" || event.key === "Meta") {
      this.altOrMetaHeld = true;
      event.preventDefault();
      return;
    }

    if (
      !this.isInMetaCommandInput &&
      event.key === "#" &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      this.beginMetaCommandInput();
      return;
    }

    if (this.isInMetaCommandInput) {
      if (event.key === "Escape") {
        event.preventDefault();
        this.cancelMetaCommandInput();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        this.submitMetaCommandInput();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        if (this.metaCommandBuffer.length > 0) {
          this.metaCommandBuffer = this.metaCommandBuffer.slice(0, -1);
          this.renderMetaCommandOverlay();
        }
        return;
      }

      if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        this.metaCommandBuffer += event.key.toLowerCase();
        this.renderMetaCommandOverlay();
        return;
      }

      event.preventDefault();
      return;
    }

    // Handle escape key to close dialogs
    if (event.key === "Escape") {
      // Check if inventory dialog is open and close it
      const inventoryDialog = document.getElementById("inventory-dialog");
      if (inventoryDialog && inventoryDialog.classList.contains("is-visible")) {
        this.hideInventoryDialog();
        return;
      }

      // Check if info dialog is open and close it
      const infoDialog = document.getElementById("info-menu-dialog");
      if (infoDialog && infoDialog.classList.contains("is-visible")) {
        this.hideInfoMenuDialog();
        return;
      }

      // If we're in a question, send escape to NetHack to cancel the question
      if (this.isInQuestion || this.isInDirectionQuestion) {
        console.log("🔄 Sending Escape to NetHack to cancel question");
        this.sendInput("Escape");
      }

      // Clear UI dialogs and states
      this.hideQuestion();
      this.hideDirectionQuestion();
      const posDialog = document.getElementById("position-dialog");
      if (posDialog) {
        posDialog.classList.remove("is-visible");
      }
      // Clear question states when escape is pressed
      this.isInQuestion = false;
      this.isInDirectionQuestion = false;
      return;
    }

    const modifiedInput = this.getModifiedInput(event);
    if (modifiedInput) {
      event.preventDefault();
      this.sendInput(modifiedInput);
      return;
    }

    // Handle tile refresh shortcuts (Ctrl + key combinations)
    if (event.ctrlKey) {
      switch (event.key.toLowerCase()) {
        case "r":
          if (event.shiftKey) {
            // Ctrl+Shift+R: Refresh larger area around player
            event.preventDefault();
            console.log("🔄 Manual refresh requested for large player area");
            this.requestPlayerAreaUpdate(10);
            this.addGameMessage("Refreshing large area around player...");
            return;
          } else {
            // Ctrl+R: Refresh area around player
            event.preventDefault();
            console.log("🔄 Manual refresh requested for player area");
            this.requestPlayerAreaUpdate(5);
            this.addGameMessage("Refreshing area around player...");
            return;
          }

        case "t":
          // Ctrl+T: Refresh tile at player position
          event.preventDefault();
          console.log("🔄 Manual refresh requested for player tile");
          this.requestTileUpdate(this.playerPos.x, this.playerPos.y);
          this.addGameMessage(
            `Refreshing tile at (${this.playerPos.x}, ${this.playerPos.y})...`,
          );
          return;

        case "m":
          event.preventDefault();
          this.toggleInfoMenuDialog();
          return;
      }
    }

    // Handle inventory display only during normal gameplay.
    // Question dialogs must take precedence over global inventory hotkey behavior.
    if (
      (event.key === "i" || event.key === "I") &&
      !this.isInQuestion &&
      !this.isInDirectionQuestion
    ) {
      event.preventDefault();
      this.hideInfoMenuDialog();

      // Check if inventory dialog is already open
      const inventoryDialog = document.getElementById("inventory-dialog");
      if (inventoryDialog && inventoryDialog.classList.contains("is-visible")) {
        console.log("📦 Closing inventory dialog");
        this.hideInventoryDialog();
      } else {
        // If we already have inventory data, show it immediately
        if (this.currentInventory && this.currentInventory.length > 0) {
          console.log("📦 Showing inventory dialog with existing data");
          this.showInventoryDialog();
        } else {
          console.log("📦 Requesting current inventory from NetHack...");
          // First send "i" to NetHack to fetch current inventory
          this.sendInput("i");
          // Set a flag to show dialog when inventory update arrives
          this.pendingInventoryDialog = true;
        }
      }
      return;
    }

    // Filter out modifier keys that shouldn't be sent to NetHack
    // Note: Home, End, PageUp, PageDown are NOT filtered as they can be used for diagonal movement
    const modifierKeys = [
      "Shift",
      "Control",
      "Alt",
      "Meta",
      "CapsLock",
      "NumLock",
      "ScrollLock",
      "Tab",
      "Insert",
      "Delete",
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12",
    ];

    if (modifierKeys.indexOf(event.key) !== -1) {
      console.log(`🚫 Filtering out modifier key: ${event.key}`);
      return;
    }

    const normalizedWaitKey = this.normalizeWaitKey(event);
    if (normalizedWaitKey) {
      event.preventDefault();
      if (this.isInDirectionQuestion) {
        this.sendInput(normalizedWaitKey);
        this.hideDirectionQuestion();
      } else {
        this.sendInput(normalizedWaitKey);
      }
      return;
    }

    // Handle diagonal movement keys during regular gameplay
    // Map navigation keys to numpad equivalents for NetHack
    if (!this.isInQuestion && !this.isInDirectionQuestion) {
      let mappedKey = null;

      switch (event.key) {
        case "Home":
          mappedKey = "7"; // Northwest
          console.log("🔄 Mapping Home to numpad 7 (Northwest)");
          break;
        case "PageUp":
          mappedKey = "9"; // Northeast
          console.log("🔄 Mapping PageUp to numpad 9 (Northeast)");
          break;
        case "End":
          mappedKey = "1"; // Southwest
          console.log("🔄 Mapping End to numpad 1 (Southwest)");
          break;
        case "PageDown":
          mappedKey = "3"; // Southeast
          console.log("🔄 Mapping PageDown to numpad 3 (Southeast)");
          break;
      }

      if (mappedKey) {
        // Send the mapped key instead of the original
        this.sendInput(mappedKey);
        return;
      }
    }

    // If we're in any question, handle input specially and don't allow normal movement
    if (this.isInQuestion || this.isInDirectionQuestion) {
      // If it's a direction question, handle direction input
      if (this.isInDirectionQuestion) {
        // With number_pad:1 option, we can pass numpad keys and arrow keys directly
        let keyToSend = null;

        switch (event.key) {
          // Arrow keys - map to numpad equivalents
          case "ArrowUp":
            keyToSend = "8";
            break;
          case "ArrowDown":
            keyToSend = "2";
            break;
          case "ArrowLeft":
            keyToSend = "4";
            break;
          case "ArrowRight":
            keyToSend = "6";
            break;

          // Diagonal movement with Home/End/PageUp/PageDown
          case "Home":
            keyToSend = "7"; // Northwest
            break;
          case "PageUp":
            keyToSend = "9"; // Northeast
            break;
          case "End":
            keyToSend = "1"; // Southwest
            break;
          case "PageDown":
            keyToSend = "3"; // Southeast
            break;

          // Numpad keys - pass through directly (includes diagonals)
          case "1": // Southwest
          case "2": // South
          case "3": // Southeast
          case "4": // West
          case "5": // Wait/rest
          case "6": // East
          case "7": // Northwest
          case "8": // North
          case "9": // Northeast
            keyToSend = event.key;
            break;

          // Vertical directions and self-direction for target prompts
          case "<":
          case ",":
            keyToSend = "<";
            break;
          case ">":
            keyToSend = ">";
            break;
          case "s":
          case "S":
            keyToSend = "s";
            break;

          // Space or period for self/wait direction
          case " ":
          case "Spacebar":
          case "Space":
          case ".":
          case "Decimal":
          case "NumpadDecimal":
            keyToSend = ".";
            break;
        }

        if (keyToSend) {
          this.sendInput(keyToSend);
          this.hideDirectionQuestion();
        }
        return; // Don't send other keys when in direction question mode
      }

      // For other questions, handle pickup dialogs specially
      const questionDialog = document.getElementById("question-dialog");
      if (questionDialog && (questionDialog as any).isPickupDialog) {
        // This is a pickup dialog - handle multi-selection
        if (event.key === "Enter") {
          // Confirm pickup and close dialog
          this.sendInput("Enter");
          this.hideQuestion();
        } else if (event.key === "Escape") {
          // Cancel pickup
          this.sendInput("Escape");
          this.hideQuestion();
        } else {
          // Toggle item selection - find matching item and toggle it
          const menuItems = (questionDialog as any).menuItems || [];
          const matchingItem = menuItems.find(
            (item: any) => item.accelerator === event.key && !item.isCategory,
          );

          if (matchingItem) {
            // Find the corresponding item container and toggle it
            const containers =
              questionDialog.querySelectorAll(".nh3d-pickup-item");
            containers.forEach((container: Element) => {
              if (
                (container as any).accelerator === event.key &&
                (container as any).toggleItem
              ) {
                (container as any).toggleItem();
              }
            });
          } else {
            // Send the key anyway in case it's a valid NetHack command
            this.sendInput(event.key);
          }
        }
      } else {
        // Standard single-selection dialog - send key and close
        this.sendInput(event.key);
        this.hideQuestion();
      }
      return; // Don't allow normal movement during questions
    }

    // Send input to local runtime for normal gameplay
    this.sendInput(event.key);
  }

  private updateCamera(deltaSeconds: number): void {
    const { x, y } = this.playerPos;
    const targetX = x * TILE_SIZE + this.cameraPanX;
    const targetY = -y * TILE_SIZE + this.cameraPanY;
    this.cameraFollowTarget.set(targetX, targetY, 0);

    if (!this.cameraFollowInitialized) {
      this.cameraFollowCurrent.copy(this.cameraFollowTarget);
      this.cameraFollowInitialized = true;
    } else {
      // Exponential smoothing for camera follow: immediate movement with natural fade-out.
      const alpha =
        1 -
        Math.exp(
          (-Math.LN2 * deltaSeconds * 1000) / this.cameraFollowHalfLifeMs,
        );
      this.cameraFollowCurrent.lerp(this.cameraFollowTarget, alpha);
    }

    const followX = this.cameraFollowCurrent.x;
    const followY = this.cameraFollowCurrent.y;

    // Use spherical coordinates for camera positioning
    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);

    const offsetX = this.cameraDistance * cosPitch * sinYaw;
    const offsetY = this.cameraDistance * cosPitch * cosYaw;
    const offsetZ = this.cameraDistance * sinPitch;

    // Position camera relative to player (with panning offset)
    this.camera.position.x = followX + offsetX;
    this.camera.position.y = followY + offsetY;
    this.camera.position.z = offsetZ;

    // Always look at the target position (player + pan offset)
    this.camera.lookAt(followX, followY, 0);
  }

  private wrapAngle(angle: number): number {
    const twoPi = Math.PI * 2;
    angle = ((angle % twoPi) + twoPi) % twoPi;
    return angle > Math.PI ? angle - twoPi : angle;
  }

  private handleMouseWheel(event: WheelEvent): void {
    // Check if the mouse is over the game log element
    const gameLog = document.getElementById("game-log");
    if (gameLog) {
      const rect = gameLog.getBoundingClientRect();
      const mouseX = event.clientX;
      const mouseY = event.clientY;

      // If mouse is over the game log, allow normal scrolling and don't zoom camera
      if (
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom
      ) {
        // Don't prevent default - allow the log to scroll naturally
        return;
      }
    }

    // If not over game log, handle camera zooming
    event.preventDefault();
    const zoomSpeed = 1.0;
    const delta = event.deltaY > 0 ? zoomSpeed : -zoomSpeed;
    this.cameraDistance = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this.cameraDistance + delta),
    );
  }

  private handleMouseDown(event: MouseEvent): void {
    if (event.button === 1) {
      // Middle mouse button - rotation
      event.preventDefault();
      this.isMiddleMouseDown = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (event.button === 2) {
      // Right mouse button - panning
      event.preventDefault();
      this.isRightMouseDown = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this.isMiddleMouseDown) {
      // Middle mouse - rotate camera
      event.preventDefault();
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;

      this.cameraYaw = this.wrapAngle(
        this.cameraYaw - deltaX * this.rotationSpeed,
      );
      this.cameraPitch = THREE.MathUtils.clamp(
        this.cameraPitch - deltaY * this.rotationSpeed,
        this.minCameraPitch,
        this.maxCameraPitch,
      );

      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (this.isRightMouseDown) {
      // Right mouse - pan camera
      event.preventDefault();
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;

      const panSpeed = 0.05;
      this.cameraPanX += deltaX * panSpeed;
      this.cameraPanY -= deltaY * panSpeed; // Invert Y for intuitive panning

      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    if (event.button === 1) {
      // Middle mouse button
      this.isMiddleMouseDown = false;
    } else if (event.button === 2) {
      // Right mouse button
      this.isRightMouseDown = false;
    }
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private getMeshOverlayMaterial(
    mesh: THREE.Mesh,
  ): THREE.MeshBasicMaterial | null {
    const material = mesh.material;
    if (Array.isArray(material)) {
      const top = material[4];
      return top instanceof THREE.MeshBasicMaterial ? top : null;
    }
    return material instanceof THREE.MeshBasicMaterial ? material : null;
  }

  private updateEffectAnimations(timeMs: number): void {
    const phaseBase = timeMs / 240;
    this.tileMap.forEach((mesh) => {
      const effectKind = mesh.userData.effectKind as
        | TileEffectKind
        | null
        | undefined;
      const overlayMaterial = this.getMeshOverlayMaterial(mesh);
      if (!overlayMaterial) {
        return;
      }

      if (!effectKind) {
        overlayMaterial.color.set("#ffffff");
        return;
      }

      const wave =
        0.72 +
        0.28 *
          Math.sin(phaseBase + mesh.position.x * 0.2 + mesh.position.y * 0.2);
      const pulse = this.effectColors[effectKind]
        .clone()
        .multiplyScalar(THREE.MathUtils.clamp(wave, 0.4, 1.2));
      overlayMaterial.color.copy(pulse);
    });
  }

  private animate(timeMs: number = performance.now()): void {
    requestAnimationFrame(this.animate.bind(this));
    const rawDeltaMs =
      this.lastFrameTimeMs === null ? 1000 / 60 : timeMs - this.lastFrameTimeMs;
    this.lastFrameTimeMs = timeMs;
    const deltaSeconds = Math.max(0, Math.min(rawDeltaMs, 250)) / 1000;

    this.updateCamera(deltaSeconds);
    this.updateLightingOverlay();
    this.updateTileRevealFades(deltaSeconds);
    this.updateEffectAnimations(timeMs);
    this.updateDamageEffects(deltaSeconds);
    this.renderer.render(this.scene, this.camera);
  }
}

export default Nethack3DEngine;
