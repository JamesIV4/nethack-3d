/*
 * Main entry point for the NetHack 3D client.
 * This module communicates with a Node.js backend that runs the NetHack WASM.
 * It handles 3D rendering, input, and WebSocket communication.
 */
// Import Three.js from a CDN
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
  ws = null;
  connected = false;

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
   * Starts the engine by initializing the animation loop and WebSocket connection.
   */
  start() {
    this.animate();
    this.connectWebSocket();
    console.log("Engine started, connecting to NetHack server...");
  }

  /**
   * Establish WebSocket connection to the NetHack backend
   */
  connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;

    this.updateMessageOverlay("Connecting to NetHack server...");

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("Connected to NetHack server");
      this.connected = true;
      this.updateMessageOverlay("Connected! Starting NetHack...");
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleServerMessage(message);
      } catch (err) {
        console.error("Error parsing server message:", err);
      }
    };

    this.ws.onclose = () => {
      console.log("Disconnected from NetHack server");
      this.connected = false;
      this.updateMessageOverlay(
        "Disconnected from server. Attempting to reconnect..."
      );

      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (!this.connected) {
          this.connectWebSocket();
        }
      }, 3000);
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.updateMessageOverlay("Connection error. Please refresh the page.");
    };
  }

  /**
   * Handle messages from the NetHack server
   */
  handleServerMessage(message) {
    switch (message.type) {
      case "game_started":
        this.updateMessageOverlay(message.message);
        break;

      case "print_glyph":
        const { x, y, glyph } = message.data;
        this.updateTile(x, y, glyph);
        break;

      case "message":
        const { str } = message.data;
        this.messageLog.unshift(str);
        if (this.messageLog.length > 50) this.messageLog.pop();
        this.updateMessageOverlay(this.messageLog.join("\n"));
        break;

      case "request_key":
        // Server is waiting for key input - we'll handle this in handleKeyDown
        break;

      case "error":
        console.error("Server error:", message.message);
        this.updateMessageOverlay(`Error: ${message.message}`);
        break;

      case "pong":
        // Server responded to ping
        break;

      default:
        console.log("Unknown message type:", message.type);
    }
  }

  /**
   * Send a message to the NetHack server
   */
  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Creates or updates a 3D mesh for a specific tile on the map.
   * This now uses basic glyph-to-character mapping since we don't have direct access to mapglyphHelper
   */
  updateTile(x, y, glyph) {
    const key = `${x},${y}`;
    let mesh = this.tileMap.get(key);

    // Basic glyph to character mapping (we'll improve this later)
    const char = this.glyphToChar(glyph);
    const color = this.getColorForGlyph(glyph);

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
   * Basic glyph to character conversion (simplified)
   */
  glyphToChar(glyph) {
    // This is a simplified mapping - the real NetHack has hundreds of glyphs
    const basicGlyphs = {
      0: " ", // GLYPH_NOTHING
      1: ".", // floor
      2: "#", // wall (corridor)
      3: "|", // wall (vertical)
      4: "-", // wall (horizontal)
      5: "+", // door
      6: "@", // player
      7: "$", // gold
      8: "<", // staircase up
      9: ">", // staircase down
    };

    return basicGlyphs[glyph] || "?";
  }

  /**
   * Get color for glyph (simplified)
   */
  getColorForGlyph(glyph) {
    const char = this.glyphToChar(glyph);

    switch (char) {
      case "@":
        return new THREE.Color(0xffffff); // white for player
      case "#":
      case "|":
      case "-":
        return new THREE.Color(0x666666); // gray for walls
      case "+":
        return new THREE.Color(0x8b4513); // brown for doors
      case "$":
        return new THREE.Color(0xffd700); // gold
      case "<":
      case ">":
        return new THREE.Color(0x808080); // gray for stairs
      case ".":
        return new THREE.Color(0x444444); // dark gray for floor
      default:
        return new THREE.Color(0x888888); // default gray
    }
  }

  /**
   * Handles keyboard input and sends it to the server
   */
  handleKeyDown(event) {
    let key = DIRECTION_MAP[event.key] || event.key;
    if (key.length !== 1) return; // Only handle single character keys

    // Send key to server
    this.sendMessage({
      type: "key_input",
      key: key,
    });
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
game.start();
