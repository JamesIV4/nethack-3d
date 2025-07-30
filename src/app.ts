/*
 * Main entry point for the NetHack 3D client.
 * This module relies on the NetHack WASM runtime (nethack.js) and Three.js.
 * It defines a game engine class that handles rendering, input, and
 * communication with the NetHack core via a UI callback interface.
 */

// Import Three.js from a CDN. It's a modern and efficient way to include libraries.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

// --- TYPE DEFINITIONS ---

// TypeScript needs to know about the global `Module` object from nethack.js
declare const Module: any;

// A map to store meshes for each tile, keyed by "x,y" coordinates
type TileMap = Map<string, THREE.Mesh>;

// Defines the structure for a key press that we queue for NetHack
interface Keypress {
  key: string;
  resolve: (value: number) => void;
}

// A map for NetHack's directional keys
const DIRECTION_MAP: { [key: string]: string } = {
  ArrowUp: "k",
  ArrowDown: "j",
  ArrowLeft: "h",
  ArrowRight: "l",
};

// --- CONSTANTS ---
const TILE_SIZE = 10; // The size of each tile in 3D space
const WALL_HEIGHT = 10; // How tall wall blocks are

/**
 * The main game engine class. It encapsulates all the logic for the 3D client.
 */
class Nethack3DEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private tileMap: TileMap = new Map();
  private heroPos = { x: 0, y: 0 };
  private messageLog: string[] = [];

  private keyQueue: Keypress[] = [];

  // Pre-create geometries and a basic material to improve performance
  private floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
  private wallGeometry = new THREE.BoxGeometry(
    TILE_SIZE,
    TILE_SIZE,
    WALL_HEIGHT
  );
  private basicMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });

  constructor() {
    // --- Basic Three.js setup ---
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x1a1a1a);
    document.body.appendChild(this.renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x606060);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(1, 1, 1).normalize();
    this.scene.add(directionalLight);

    // --- Event Listeners ---
    window.addEventListener("resize", this.onWindowResize.bind(this), false);
    window.addEventListener("keydown", this.handleKeyDown.bind(this), false);
  }

  /**
   * Starts the engine by initializing the animation loop and then waiting for
   * the NetHack WASM module to be ready before starting the game.
   */
  public start(): void {
    this.animate();

    console.log("Waiting for NetHack WASM module to load...");
    Module.ready.then((nethackModule: any) => {
      console.log("NetHack WASM module is ready.");
      if (typeof nethackModule.nethackStart !== "function") {
        this.updateMessageOverlay(
          "Error: nethackStart is not available. Check nethack.js."
        );
        return;
      }

      try {
        this.updateMessageOverlay("Starting NetHack...");
        nethackModule.nethackStart(this.uiCallback.bind(this), {
          nethackOptions: { name: "3DHero", autoquiver: true },
        });
        console.log("NetHack game started.");
      } catch (err) {
        console.error("An error occurred when starting NetHack:", err);
        this.updateMessageOverlay(`Error starting NetHack: ${err}`);
      }
    });
  }

  /**
   * The core UI callback function passed to the NetHack engine.
   * NetHack calls this function whenever it needs to interact with the UI.
   */
  private async uiCallback(name: string, ...args: any[]): Promise<any> {
    switch (name) {
      // --- Window Management ---
      case "shim_create_nhwindow":
        // For simplicity, we ignore window creation and just render to the main scene.
        return 0; // Return a dummy window ID
      case "shim_display_nhwindow":
      case "shim_clear_nhwindow":
        // We handle rendering in real-time, so these can be ignored.
        return;

      // --- Rendering ---
      case "shim_print_glyph": {
        const [win, x, y, glyph] = args;
        this.updateTile(x, y, glyph);
        return;
      }

      // --- Text & Messages ---
      case "shim_putstr": {
        const [win, attr, str] = args;
        this.messageLog.unshift(str); // Add new messages to the top
        if (this.messageLog.length > 50) this.messageLog.pop(); // Keep log from growing too large
        this.updateMessageOverlay(this.messageLog.join("\n"));
        return;
      }

      // --- Input ---
      case "shim_nhgetch":
        return new Promise<number>((resolve) => {
          // If a key is already queued, resolve immediately.
          const queuedKey = this.keyQueue.shift();
          if (queuedKey) {
            resolve(queuedKey.key.charCodeAt(0));
          } else {
            // Otherwise, add the resolver to the queue to be fulfilled by the next key press.
            this.keyQueue.push({ key: "", resolve });
          }
        });

      // --- Simple Prompts ---
      case "shim_yn_function":
        // Automatically answer 'yes' to simple yes/no prompts to speed up gameplay.
        return "y".charCodeAt(0);

      default:
        // Log any unhandled UI calls for debugging purposes.
        // console.log('Unhandled UI callback:', name, args);
        return;
    }
  }

  /**
   * Creates or updates a 3D mesh for a specific tile on the map.
   * This is optimized to reuse existing meshes and materials.
   */
  private updateTile(x: number, y: number, glyph: number): void {
    const key = `${x},${y}`;
    let mesh = this.tileMap.get(key);

    // Use the mapglyph helper provided by NetHack to decode the glyph
    const glyphInfo = Module.nethackOptions.mapglyphHelper(glyph, x, y, 0);
    const char = glyphInfo.char;
    const color = new THREE.Color(glyphInfo.color);

    let isWall = false;
    if (char === "|" || char === "-" || char === "+") {
      isWall = true;
    } else if (char === "@") {
      // This is our hero!
      this.heroPos = { x, y };
    }

    if (!mesh) {
      // Create a new mesh if one doesn't exist for these coordinates
      const geometry = isWall ? this.wallGeometry : this.floorGeometry;
      const material = this.basicMaterial.clone();
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        x * TILE_SIZE,
        -y * TILE_SIZE,
        isWall ? WALL_HEIGHT / 2 : 0
      );
      this.scene.add(mesh);
      this.tileMap.set(key, mesh);
    }

    // Update the mesh's properties
    (mesh.material as THREE.MeshLambertMaterial).color.set(color);
    (mesh.material as THREE.MeshLambertMaterial).emissive.set(0x000000);

    // Make special characters (like the hero) glow slightly
    if (char === "@" || char === "$" || char === "<" || char === ">") {
      (mesh.material as THREE.MeshLambertMaterial).emissive
        .set(color)
        .multiplyScalar(0.5);
    }

    // Switch geometry if a floor becomes a wall or vice-versa
    if (isWall && mesh.geometry !== this.wallGeometry) {
      mesh.geometry = this.wallGeometry;
      mesh.position.z = WALL_HEIGHT / 2;
    } else if (!isWall && mesh.geometry !== this.floorGeometry) {
      mesh.geometry = this.floorGeometry;
      mesh.position.z = 0;
    }
  }

  /**
   * Handles keyboard input, mapping keys to NetHack commands and queuing them.
   */
  private handleKeyDown(event: KeyboardEvent): void {
    let key = DIRECTION_MAP[event.key] || event.key;
    if (key.length !== 1) return; // Only handle single character keys

    const queuedResolver = this.keyQueue.shift();
    if (queuedResolver) {
      // If NetHack is waiting for a key, resolve the promise.
      queuedResolver.resolve(key.charCodeAt(0));
    } else {
      // Otherwise, queue the key for the next time NetHack asks.
      this.keyQueue.push({ key, resolve: () => {} });
    }
  }

  /**
   * Updates the HTML overlay with new messages.
   */
  private updateMessageOverlay(text: string): void {
    const overlay = document.getElementById("overlay");
    if (overlay) {
      overlay.textContent = text;
    }
  }

  /**
   * Keeps the camera focused on the hero's position.
   */
  private updateCamera(): void {
    const { x, y } = this.heroPos;
    const targetX = x * TILE_SIZE;
    const targetY = -y * TILE_SIZE;

    // Position the camera behind and above the hero for a classic RPG view
    this.camera.position.x = targetX;
    this.camera.position.y = targetY - TILE_SIZE * 5;
    this.camera.position.z = TILE_SIZE * 6;
    this.camera.lookAt(targetX, targetY, 0);
  }

  /**
   * Handles window resizing to keep the viewport correct.
   */
  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * The main render loop, called via requestAnimationFrame.
   */
  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }
}

// --- APPLICATION ENTRY POINT ---
const game = new Nethack3DEngine();
game.start();
