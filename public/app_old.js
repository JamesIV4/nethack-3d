/*
 * Main entry point for the NetHack 3D client.
 * This module relies on the NetHack WASM runtime (nethack.js) and Three.js.
 * It defines a game engine class that handles rendering, input, and
 * communication with the NetHack core via a UI callback interface.
 */
// Import Three.js from a CDN. It's a modern and efficient way to include libraries.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
// A map for NetHack's directional keys
const DIRECTION_MAP = {
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
  renderer;
  scene;
  camera;
  tileMap = new Map();
  heroPos = { x: 0, y: 0 };
  messageLog = [];
  keyQueue = [];
  // Pre-create geometries and a basic material to improve performance
  floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
  wallGeometry = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE, WALL_HEIGHT);
  basicMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
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
   * Starts the engine by initializing the animation loop.
   * The NetHack game itself will be started by the `onRuntimeInitialized` callback.
   */
  start() {
    this.animate();
    console.log("Engine started, waiting for NetHack WASM module to load...");
  }

  /**
   * Initializes the NetHack game after the WASM module is ready.
   */
  initializeNethack() {
    console.log("Initializing NetHack...");

    // Wait for the Module to be ready, then start NetHack
    if (window.Module && window.Module.ready) {
      window.Module.ready
        .then((moduleInstance) => {
          console.log("NetHack WASM module is ready.");

          // Set up global NetHack callback that the WASM module will call
          globalThis.nethackCallback = (name, ...args) => {
            return this.uiCallback(name, ...args);
          };

          try {
            this.updateMessageOverlay("Starting NetHack...");

            // Set up the graphics callback
            if (typeof moduleInstance.ccall === "function") {
              moduleInstance.ccall(
                "shim_graphics_set_callback",
                null,
                ["string"],
                ["nethackCallback"],
                { async: true }
              );

              // Start the game main loop
              moduleInstance.ccall("main", null, [], [], { async: true });
              console.log("NetHack game started.");
            } else {
              this.updateMessageOverlay(
                "Error: ccall not available on module instance."
              );
            }
          } catch (err) {
            console.error("An error occurred when starting NetHack:", err);
            this.updateMessageOverlay(`Error starting NetHack: ${err}`);
          }
        })
        .catch((err) => {
          console.error("Failed to initialize NetHack module:", err);
          this.updateMessageOverlay(
            `Failed to initialize NetHack module: ${err}`
          );
        });
    } else {
      this.updateMessageOverlay("Error: NetHack module not found.");
    }
  }

  /**
   * The core UI callback function passed to the NetHack engine.
   * NetHack calls this function whenever it needs to interact with the UI.
   */
  async uiCallback(name, ...args) {
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
        return new Promise((resolve) => {
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
  updateTile(x, y, glyph) {
    // The nethack.js runtime makes the helper functions available globally
    if (
      !globalThis.nethackGlobal ||
      !globalThis.nethackGlobal.helpers ||
      typeof globalThis.nethackGlobal.helpers.mapglyphHelper !== "function"
    ) {
      return; // Not ready yet, skip this render update.
    }

    const key = `${x},${y}`;
    let mesh = this.tileMap.get(key);

    const glyphInfo = globalThis.nethackGlobal.helpers.mapglyphHelper(
      glyph,
      x,
      y,
      0
    );
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
    mesh.material.color.set(color);
    mesh.material.emissive.set(0x000000);
    // Make special characters (like the hero) glow slightly
    if (char === "@" || char === "$" || char === "<" || char === ">") {
      mesh.material.emissive.set(color).multiplyScalar(0.5);
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
  handleKeyDown(event) {
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
  updateMessageOverlay(text) {
    const overlay = document.getElementById("overlay");
    if (overlay) {
      overlay.textContent = text;
    }
  }

  /**
   * Keeps the camera focused on the hero's position.
   */
  updateCamera() {
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
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * The main render loop, called via requestAnimationFrame.
   */
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }
}

// --- APPLICATION ENTRY POINT ---
const game = new Nethack3DEngine();

// Start the game engine (this will begin the render loop)
game.start();

// Wait a moment for the nethack.js script to load, then initialize NetHack
setTimeout(() => {
  game.initializeNethack();
}, 100);
