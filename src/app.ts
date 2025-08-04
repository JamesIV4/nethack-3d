/*
 * Main entry point for the NetHack 3D client.
 * This module connects to our NetHack WebSocket server and renders the game in 3D using Three.js.
 */

import * as THREE from "three";

// --- TYPE DEFINITIONS ---

// A map to store meshes for each tile, keyed by "x,y" coordinates
type TileMap = Map<string, THREE.Mesh>;
// A map to store text sprites for glyph numbers, keyed by "x,y" coordinates
type TextSpriteMap = Map<string, THREE.Sprite>;

// --- CONSTANTS ---
const TILE_SIZE = 1; // The size of each tile in 3D space
const WALL_HEIGHT = 1; // How tall wall blocks are

/**
 * The main game engine class. It encapsulates all the logic for the 3D client.
 */
class Nethack3DEngine {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private tileMap: TileMap = new Map();
  private textSpriteMap: TextSpriteMap = new Map();
  private playerPos = { x: 0, y: 0 };
  private gameMessages: string[] = [];
  private currentInventory: any[] = []; // Store current inventory items
  private pendingInventoryDialog: boolean = false; // Flag to show inventory dialog after update

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

  private ws: WebSocket | null = null;

  // Camera controls
  private cameraDistance: number = 20;
  private cameraAngleX: number = 0.5; // Vertical rotation around X axis
  private cameraAngleY: number = 0.5; // Horizontal rotation around Y axis
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

  // Pre-create geometries and materials
  private floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
  private wallGeometry = new THREE.BoxGeometry(
    TILE_SIZE,
    TILE_SIZE,
    WALL_HEIGHT
  );

  // Materials for different glyph types
  private materials = {
    floor: new THREE.MeshLambertMaterial({ color: 0x8b4513 }), // Brown floor
    wall: new THREE.MeshLambertMaterial({ color: 0x666666 }), // Gray wall
    door: new THREE.MeshLambertMaterial({ color: 0x8b4513 }), // Brown door
    dark: new THREE.MeshLambertMaterial({ color: 0x000055 }), // Dark blue for unseen areas
    fountain: new THREE.MeshLambertMaterial({ color: 0x0088ff }), // Light blue for water fountains
    player: new THREE.MeshLambertMaterial({
      color: 0x00ff00,
      emissive: 0x004400,
    }), // Green glowing player
    monster: new THREE.MeshLambertMaterial({
      color: 0xff0000,
      emissive: 0x440000,
    }), // Red glowing monster
    item: new THREE.MeshLambertMaterial({
      color: 0x0080ff,
      emissive: 0x001144,
    }), // Blue glowing item
    default: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  };

  constructor() {
    this.initThreeJS();
    this.initUI();
    this.connectToServer();

    // Set initial camera position for better viewing
    this.cameraDistance = 15;
    this.cameraAngleX = 0.8; // Look down at an angle
    this.cameraAngleY = 0; // Start facing north
  }

  private initThreeJS(): void {
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
    this.renderer.setClearColor(0x000011); // Dark blue background
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    document.body.appendChild(this.renderer.domElement);

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

    // Mouse controls for camera
    window.addEventListener("wheel", this.handleMouseWheel.bind(this), false);
    window.addEventListener(
      "mousedown",
      this.handleMouseDown.bind(this),
      false
    );
    window.addEventListener(
      "mousemove",
      this.handleMouseMove.bind(this),
      false
    );
    window.addEventListener("mouseup", this.handleMouseUp.bind(this), false);
    window.addEventListener("contextmenu", (e) => e.preventDefault(), false); // Prevent right-click menu

    // Start render loop
    this.animate();
  }

  private initUI(): void {
    // Use existing game log and status elements from HTML instead of creating new ones
    const statusElement = document.getElementById("game-status");
    if (statusElement) {
      statusElement.innerHTML = "Connecting to NetHack server...";
    }

    // Create connection status (smaller, top-right corner)
    const connStatus = document.createElement("div");
    connStatus.id = "connection-status";
    connStatus.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(255, 0, 0, 0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 3px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 1000;
    `;
    connStatus.innerHTML = "Disconnected";
    document.body.appendChild(connStatus);
  }

  private connectToServer(): void {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log("Connecting to NetHack server at:", wsUrl);

    // Clean up any existing WebSocket
    if (this.ws) {
      console.log("Cleaning up existing WebSocket connection");
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
    }

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("Connected to NetHack server");
      this.updateConnectionStatus("Connected", "#00aa00");
      this.updateStatus("Connected to NetHack - Game starting...");
      this.addGameMessage("Connected to NetHack - Game starting...");

      // Hide loading screen
      const loading = document.getElementById("loading");
      if (loading) {
        loading.style.display = "none";
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleServerMessage(data);
      } catch (error) {
        console.error("Error parsing server message:", error);
      }
    };

    this.ws.onclose = () => {
      console.log("Disconnected from NetHack server");
      this.updateConnectionStatus("Disconnected", "#aa0000");

      // Silently attempt to reconnect after 3 seconds
      setTimeout(() => {
        console.log("Attempting to reconnect...");
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
          console.log("WebSocket is closed, starting reconnection");
          this.connectToServer();
        } else {
          console.log(
            `WebSocket state: ${this.ws.readyState}, skipping reconnection`
          );
        }
      }, 3000);
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.updateConnectionStatus("Error", "#aa0000");
    };
  }

  private handleServerMessage(data: any): void {
    switch (data.type) {
      case "map_glyph":
        // Check if this is a refresh vs new data
        if (data.isRefresh) {
          console.log(`🔄 Processing tile refresh for (${data.x}, ${data.y})`);
        }
        this.updateTile(data.x, data.y, data.glyph, data.char, data.color);
        break;

      case "player_position":
        console.log(
          `🎯 Received player position update: (${data.x}, ${data.y})`
        );
        const oldPos = { ...this.playerPos };
        this.playerPos = { x: data.x, y: data.y };
        console.log(
          `🎯 Player position changed from (${oldPos.x}, ${oldPos.y}) to (${data.x}, ${data.y})`
        );
        this.updateStatus(`Player at (${data.x}, ${data.y}) - NetHack 3D`);
        break;

      case "force_player_redraw":
        // Force update player visual position when NetHack doesn't send map updates
        console.log(
          `🎯 Force redraw player from (${data.oldPosition.x}, ${data.oldPosition.y}) to (${data.newPosition.x}, ${data.newPosition.y})`
        );

        // Update the player position first
        this.playerPos = { x: data.newPosition.x, y: data.newPosition.y };

        // Clear the old player visual position by redrawing it as floor
        const oldKey = `${data.oldPosition.x},${data.oldPosition.y}`;
        const oldSprite = this.textSpriteMap.get(oldKey);
        if (oldSprite) {
          console.log(
            `🎯 Clearing old player sprite at (${data.oldPosition.x}, ${data.oldPosition.y})`
          );
          // Remove the old sprite and redraw as floor
          this.scene.remove(oldSprite);
          this.textSpriteMap.delete(oldKey);

          // Redraw the old position as floor (assuming it's walkable since player was there)
          this.updateTile(data.oldPosition.x, data.oldPosition.y, 2396, ".", 0);
        }

        // Create a fake player glyph at the new position to ensure visual update
        // Use a typical player glyph number (around 331-360 range)
        this.updateTile(data.newPosition.x, data.newPosition.y, 331, "@", 0);
        console.log(
          `🎯 Player visual updated to position (${data.newPosition.x}, ${data.newPosition.y})`
        );
        break;

      case "text":
        this.addGameMessage(data.text);
        break;

      case "raw_print":
        this.addGameMessage(data.text);
        break;

      // case "menu_item":
      //   this.addGameMessage(`Menu: ${data.text} (${data.accelerator})`);
      //   break;

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
          data.menuItems
        );
        break;

      case "inventory_update":
        // Handle inventory updates without showing dialog
        const itemCount = data.items ? data.items.length : 0;
        const actualItems = data.items
          ? data.items.filter((item: any) => !item.isCategory)
          : [];
        console.log(
          `📦 Received inventory update with ${itemCount} total items (${actualItems.length} actual items)`
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

        // Add a message to the log about inventory update (optional)
        if (actualItems.length > 0) {
          this.addGameMessage(`Inventory: ${actualItems.length} items`);
        }
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
          `🔄 Area refresh completed: ${data.tilesRefreshed} tiles refreshed around (${data.centerX}, ${data.centerY})`
        );
        this.addGameMessage(
          `Refreshed ${data.tilesRefreshed} tiles around (${data.centerX}, ${data.centerY})`
        );
        break;

      case "tile_not_found":
        console.log(
          `⚠️ Tile not found at (${data.x}, ${data.y}): ${data.message}`
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
        console.log(`📊 Status update: field ${data.field} = "${data.value}"`);
        this.updatePlayerStats(data.field, data.value, data);
        break;

      default:
        console.log("Unknown message type:", data.type, data);
    }
  }

  /**
   * Request a view update for a specific tile from the server
   * @param x The x coordinate of the tile
   * @param y The y coordinate of the tile
   */
  public requestTileUpdate(x: number, y: number): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(`🔄 Requesting tile update for (${x}, ${y})`);
      this.ws.send(
        JSON.stringify({
          type: "request_tile_update",
          x: x,
          y: y,
        })
      );
    } else {
      console.log("⚠️ Cannot request tile update - WebSocket not connected");
    }
  }

  /**
   * Request a view update for an area around a center point
   * @param centerX The x coordinate of the center
   * @param centerY The y coordinate of the center
   * @param radius The radius around the center point (default: 3)
   */
  public requestAreaUpdate(
    centerX: number,
    centerY: number,
    radius: number = 3
  ): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(
        `🔄 Requesting area update centered at (${centerX}, ${centerY}) with radius ${radius}`
      );
      this.ws.send(
        JSON.stringify({
          type: "request_area_update",
          centerX: centerX,
          centerY: centerY,
          radius: radius,
        })
      );
    } else {
      console.log("⚠️ Cannot request area update - WebSocket not connected");
    }
  }

  /**
   * Request a view update for the area around the player
   * @param radius The radius around the player (default: 5)
   */
  public requestPlayerAreaUpdate(radius: number = 5): void {
    this.requestAreaUpdate(this.playerPos.x, this.playerPos.y, radius);
  }

  private createTextSprite(
    text: string,
    size: number = 128,
    textColor: string = "yellow"
  ): THREE.Sprite {
    // Create a canvas to draw text on
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;

    // Set canvas size (larger for better readability)
    canvas.width = size;
    canvas.height = size;

    // Configure text rendering
    context.fillStyle = textColor;
    context.font = "bold 24px monospace"; // Larger, monospace font
    context.textAlign = "center";
    context.textBaseline = "middle";

    // Clear canvas with transparent background
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Add semi-transparent background for better visibility
    context.fillStyle = "rgba(0, 0, 0, 0.7)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the text
    context.fillStyle = textColor;
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Create sprite material
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });

    // Create and return sprite
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1.0, 1.0, 1); // Make it larger and more readable

    return sprite;
  }

  private glyphToChar(glyph: number): string {
    // Convert NetHack glyph numbers to ASCII characters
    // This is a fallback for when the server doesn't provide the proper character
    // Based on NetHack's glyph system

    // Floor glyphs (2395-2397)
    if (glyph >= 2395 && glyph <= 2397) return ".";

    // Wall glyphs (2378-2394)
    if (glyph >= 2378 && glyph <= 2394) {
      switch (glyph) {
        case 2378:
          return "|"; // vertical wall
        case 2379:
          return "-"; // horizontal wall
        case 2380:
          return "-"; // top-left corner
        case 2381:
          return "-"; // top-right corner
        case 2382:
          return "-"; // bottom-left corner
        case 2383:
          return "-"; // bottom-right corner
        case 2389:
          return "+"; // door
        case 2390:
          return "+"; // open door
        default:
          return "#"; // generic wall
      }
    }

    // Player character (broad range to cover all classes/races/genders)
    // NetHack player glyphs are typically in the range 331-360+
    if (glyph >= 331 && glyph <= 360) return "@";

    // Monster glyphs (approximate ranges)
    if (glyph >= 400 && glyph <= 500) {
      // Common monsters
      if (glyph >= 400 && glyph <= 410) return "d"; // dogs
      if (glyph >= 411 && glyph <= 420) return "k"; // kobolds
      if (glyph >= 421 && glyph <= 430) return "o"; // orcs
      return "M"; // generic monster
    }

    // Item glyphs
    if (glyph >= 1900 && glyph <= 2400) {
      if (glyph >= 1920 && glyph <= 1930) return ")"; // weapons
      if (glyph >= 2000 && glyph <= 2100) return "["; // armor
      if (glyph >= 2180 && glyph <= 2220) return "%"; // food
      if (glyph >= 2220 && glyph <= 2260) return "("; // tools
      return "*"; // generic item
    }

    // Special terrain
    if (glyph === 237) return "<"; // stairs up
    if (glyph === 238) return ">"; // stairs down
    if (glyph === 2334) return "#"; // solid rock
    if (glyph === 2223) return "\\"; // throne

    // Fallback: For unknown glyphs, show a generic character instead of the number
    return "?";
  }

  private clearScene(): void {
    console.log("🧹 Clearing all tiles and sprites from 3D scene");

    // Clear all tile meshes
    this.tileMap.forEach((mesh, key) => {
      this.scene.remove(mesh);
    });
    this.tileMap.clear();

    // Clear all text sprites
    this.textSpriteMap.forEach((sprite, key) => {
      this.scene.remove(sprite);
    });
    this.textSpriteMap.clear();

    console.log("🧹 Scene cleared - ready for new level");
  }

  private updateTile(
    x: number,
    y: number,
    glyph: number,
    char?: string,
    color?: number
  ): void {
    // Debug logging to see what character data we're receiving
    console.log(
      `🎨 updateTile(${x},${y}) glyph=${glyph} char="${char}" color=${color}`
    );

    const key = `${x},${y}`;
    let mesh = this.tileMap.get(key);
    let textSprite = this.textSpriteMap.get(key);

    // Check if this is the player glyph and update player position
    // Use glyph range as the primary indicator (more reliable than character)
    // Only consider "@" characters that are within the player glyph range
    const isPlayerGlyph =
      glyph >= 331 && glyph <= 360 && (char === "@" || !char);
    if (isPlayerGlyph) {
      console.log(
        `🎯 Player detected at position (${x}, ${y}) with glyph ${glyph}, char: "${char}"`
      );
      this.playerPos = { x, y };
      this.updateStatus(`Player at (${x}, ${y}) - NetHack 3D`);
    }

    // Determine tile type based on character first, then fall back to glyph ID ranges
    let material = this.materials.default;
    let geometry = this.floorGeometry;
    let isWall = false;

    // Prioritize the character provided by NetHack over glyph number
    // BUT check for special cases first (like doors) where glyph number is more reliable
    if (char) {
      console.log(`🔤 Using character-based detection: "${char}"`);

      // Special case: Check for door glyphs, but respect the character
      if (glyph === 2389 || glyph === 2390) {
        // Door glyphs - but the character tells us the actual state
        if (char === ".") {
          // Open doorway - character "." means it's passable floor
          console.log(`  -> Open doorway (glyph ${glyph}, char ".")`);
          material = this.materials.floor;
          geometry = this.floorGeometry;
          isWall = false;
        } else if (char === "+") {
          // Closed door - character "+" means it's blocking
          console.log(`  -> Closed door (glyph ${glyph}, char "+")`);
          material = this.materials.door;
          geometry = this.wallGeometry;
          isWall = true;
        } else {
          // Other door states - default to open
          console.log(
            `  -> Door with character "${char}" - defaulting to open`
          );
          material = this.materials.floor;
          geometry = this.floorGeometry;
          isWall = false;
        }
      } else if (char === ".") {
        // Floor/corridor
        console.log(`  -> Floor/corridor`);
        material = this.materials.floor;
        geometry = this.floorGeometry;
        isWall = false;
      } else if (char === " ") {
        // Blank space - in NetHack this typically represents dark/unseen areas (walls)
        console.log(`  -> Dark area/unseen wall`);
        material = this.materials.wall;
        geometry = this.wallGeometry;
        isWall = true;
      } else if (char === "#") {
        // In NetHack, # represents dark/unexplored areas (flat floor, not walls)
        console.log(`  -> Dark area (flat)`);
        material = this.materials.dark; // Dark blue for unseen areas
        geometry = this.floorGeometry; // Should be flat, not wall blocks
        isWall = false;
      } else if (char === "|" || char === "-") {
        // Explicit wall characters (but not doors, which were checked above)
        console.log(`  -> Wall`);
        material = this.materials.wall;
        geometry = this.wallGeometry;
        isWall = true;
      } else if (isPlayerGlyph) {
        // Player character (based on glyph range + "@" char)
        console.log(`  -> Player`);
        material = this.materials.player;
        geometry = this.floorGeometry;
        isWall = false;
      } else if (char === "@") {
        // Non-player "@" character (shopkeeper, NPC, etc.)
        console.log(`  -> NPC/Shopkeeper`);
        material = this.materials.monster; // Treat as monster/NPC
        geometry = this.floorGeometry;
        isWall = false;
      } else if (char === "{") {
        // Water fountain
        console.log(`  -> Water fountain`);
        material = this.materials.fountain;
        geometry = this.floorGeometry;
        isWall = false;
      } else if (char.match(/[a-zA-Z]/)) {
        // Letters are usually monsters
        console.log(`  -> Monster`);
        material = this.materials.monster;
        geometry = this.floorGeometry;
        isWall = false;
      } else if (char.match(/[)(\[%*$?!=/\\<>]/)) {
        // Items and special characters
        console.log(`  -> Item`);
        material = this.materials.item;
        geometry = this.floorGeometry;
        isWall = false;
      } else {
        // Default to floor for unknown characters
        console.log(`  -> Default to floor`);
        material = this.materials.floor;
        geometry = this.floorGeometry;
        isWall = false;
      }
    } else {
      console.log(`🔢 Using glyph-based detection: ${glyph}`);
      // Fall back to glyph ID ranges when no character is provided
      if (glyph >= 2378 && glyph <= 2394) {
        // Wall glyphs
        material = this.materials.wall;
        geometry = this.wallGeometry;
        isWall = true;
      } else if (glyph >= 2395 && glyph <= 2397) {
        // Floor glyphs
        material = this.materials.floor;
        geometry = this.floorGeometry;
      } else if (isPlayerGlyph) {
        // Player glyphs (using broader range)
        material = this.materials.player;
        geometry = this.floorGeometry;
      } else if (glyph >= 400 && glyph <= 500) {
        // Monster glyphs (approximate range)
        material = this.materials.monster;
        geometry = this.floorGeometry;
      } else if (glyph >= 1900 && glyph <= 2400) {
        // Item glyphs (approximate range)
        material = this.materials.item;
        geometry = this.floorGeometry;
      } else {
        // Default floor for unknown glyphs
        material = this.materials.floor;
        geometry = this.floorGeometry;
      }
    }

    if (!mesh) {
      // Create a new mesh
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        x * TILE_SIZE,
        -y * TILE_SIZE,
        isWall ? WALL_HEIGHT / 2 : 0
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.tileMap.set(key, mesh);
    } else {
      // Update existing mesh
      mesh.material = material;
      mesh.geometry = geometry;
      mesh.position.z = isWall ? WALL_HEIGHT / 2 : 0;
    }

    // Create or update text sprite showing glyph character
    // Use the character provided by NetHack's mapglyph function if available
    const glyphChar = char || this.glyphToChar(glyph);

    // Determine text color based on glyph type (more comprehensive and robust)
    let textColor = "yellow"; // Default color

    // NetHack glyph categories (based on NetHack source code glyph ranges)
    if (glyph >= 2378 && glyph <= 2399) {
      // Structural glyphs: walls, floors, corridors, doors
      // This includes: walls (2378-2394), floors (2395-2397), corridors (2398-2399)
      textColor = "white";
    } else if (glyph === 2408) {
      // Water fountain (specific glyph) - override structural color
      textColor = "lightblue";
    } else if (glyph >= 331 && glyph <= 360) {
      // Player glyphs
      textColor = "lime"; // Bright green for player
    } else if (glyph >= 400 && glyph <= 600) {
      // Monster glyphs (expanded range for better coverage)
      textColor = "red";
    } else if (glyph >= 1900 && glyph < 2378) {
      // Item glyphs (excluding structural elements)
      textColor = "cyan";
    } else if (glyph >= 2400 && glyph <= 2500) {
      // Special terrain and features
      textColor = "magenta";
    } else if (glyph >= 1 && glyph <= 330) {
      // Miscellaneous objects and terrain
      textColor = "white";
    }

    if (!textSprite) {
      textSprite = this.createTextSprite(glyphChar, 128, textColor);
      this.scene.add(textSprite);
      this.textSpriteMap.set(key, textSprite);
    } else {
      // Update existing sprite with new glyph character
      const newSprite = this.createTextSprite(glyphChar, 128, textColor);
      this.scene.remove(textSprite);
      textSprite = newSprite;
      this.scene.add(textSprite);
      this.textSpriteMap.set(key, textSprite);
    }

    // Position the text sprite above the tile
    textSprite.position.set(
      x * TILE_SIZE,
      -y * TILE_SIZE,
      isWall ? WALL_HEIGHT + 0.3 : 0.3
    );
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
      connElement.style.backgroundColor = color;
    }
  }

  private updatePlayerStats(field: number, value: string | null, data: any): void {
    // NetHack status field mapping (based on NetHack source code)
    // Reference: https://github.com/NetHack/NetHack/blob/NetHack-3.6/include/botl.h
    const statusFields: { [key: number]: string } = {
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

    const fieldName = statusFields[field];
    
    if (fieldName && value !== null && !value.startsWith('ptr:')) {
      console.log(`📊 Updating ${fieldName}: "${value}"`);
      
      // Parse values intelligently based on field type and content
      let parsedValue: any = value;
      
      // Handle numeric fields
      if (fieldName.match(/^(hp|maxhp|power|maxpower|level|experience|time|armor|score|gold|dlevel)$/)) {
        // For pure numbers, try to parse directly
        if (typeof value === 'string') {
          // Remove any leading/trailing whitespace
          const cleanValue = value.trim();
          
          // Try to extract a number from the string
          const match = cleanValue.match(/^(\d+)/);
          if (match) {
            parsedValue = parseInt(match[1], 10);
          } else {
            console.log(`⚠️ Could not parse numeric value for ${fieldName}: "${value}"`);
            return; // Skip update if we can't parse the number
          }
        }
      }
      
      // Handle attribute fields (strength can be like "18/01")
      else if (fieldName.match(/^(strength|dexterity|constitution|intelligence|wisdom|charisma)$/)) {
        if (typeof value === 'string') {
          const cleanValue = value.trim();
          
          // Handle special strength format like "18/01" or just "18"
          if (fieldName === 'strength') {
            const strengthMatch = cleanValue.match(/^(\d+)/);
            if (strengthMatch) {
              parsedValue = parseInt(strengthMatch[1], 10);
            } else {
              console.log(`⚠️ Could not parse strength value: "${value}"`);
              return;
            }
          } else {
            // For other attributes, just get the first number
            const attrMatch = cleanValue.match(/^(\d+)/);
            if (attrMatch) {
              parsedValue = parseInt(attrMatch[1], 10);
            } else {
              console.log(`⚠️ Could not parse attribute value for ${fieldName}: "${value}"`);
              return;
            }
          }
        }
      }
      
      // Handle string fields (keep as-is)
      else if (fieldName.match(/^(name|alignment|hunger|encumbrance|dungeon)$/)) {
        // Keep as string, just trim whitespace
        parsedValue = typeof value === 'string' ? value.trim() : String(value);
      }
      
      // Update the stats object
      if (fieldName === "maxhp") {
        this.playerStats.maxHp = parsedValue;
      } else if (fieldName === "maxpower") {
        this.playerStats.maxPower = parsedValue;
      } else if (fieldName === "dlevel") {
        this.playerStats.dlevel = parsedValue;
      } else {
        (this.playerStats as any)[fieldName] = parsedValue;
      }
      
      // Update the stats display
      this.updateStatsDisplay();
    } else if (value && value.startsWith('ptr:')) {
      console.log(`📊 Skipping pointer value for field ${field}: ${value}`);
    } else {
      console.log(`📊 Unknown status field ${field} or null/invalid value: "${value}"`);
    }
  }

  private updateStatsDisplay(): void {
    // Update or create the stats bar
    let statsBar = document.getElementById("stats-bar");
    if (!statsBar) {
      // Create the stats bar at the top of the screen
      statsBar = document.createElement("div");
      statsBar.id = "stats-bar";
      statsBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: linear-gradient(180deg, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.7) 100%);
        color: white;
        padding: 8px 15px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        z-index: 1500;
        border-bottom: 2px solid #00ff00;
        display: flex;
        align-items: center;
        gap: 20px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
      `;
      document.body.appendChild(statsBar);
      
      // Adjust the game log position to accommodate the stats bar
      const gameLogContainer = document.querySelector('.top-left-ui') as HTMLElement;
      if (gameLogContainer) {
        gameLogContainer.style.top = '70px'; // Move down below stats bar
      }
    }

    // Create HP bar component
    const hpPercentage = this.playerStats.maxHp > 0 ? (this.playerStats.hp / this.playerStats.maxHp) * 100 : 0;
    const hpColor = hpPercentage > 60 ? '#00ff00' : hpPercentage > 30 ? '#ffaa00' : '#ff0000';
    
    const hpBar = `
      <div style="display: flex; flex-direction: column; min-width: 120px;">
        <div style="font-weight: bold; color: #ff6666; margin-bottom: 2px;">
          HP: ${this.playerStats.hp}/${this.playerStats.maxHp}
        </div>
        <div style="background: #333; height: 8px; border-radius: 4px; border: 1px solid #666;">
          <div style="
            background: ${hpColor}; 
            height: 100%; 
            width: ${hpPercentage}%; 
            border-radius: 3px;
            transition: width 0.3s ease;
          "></div>
        </div>
      </div>
    `;

    // Create Power bar component (if the player has magical power)
    let powerBar = '';
    if (this.playerStats.maxPower > 0) {
      const powerPercentage = (this.playerStats.power / this.playerStats.maxPower) * 100;
      powerBar = `
        <div style="display: flex; flex-direction: column; min-width: 120px;">
          <div style="font-weight: bold; color: #6666ff; margin-bottom: 2px;">
            Pw: ${this.playerStats.power}/${this.playerStats.maxPower}
          </div>
          <div style="background: #333; height: 8px; border-radius: 4px; border: 1px solid #666;">
            <div style="
              background: #6666ff; 
              height: 100%; 
              width: ${powerPercentage}%; 
              border-radius: 3px;
              transition: width 0.3s ease;
            "></div>
          </div>
        </div>
      `;
    }

    // Build the complete stats display
    statsBar.innerHTML = `
      <!-- Player Name and Level -->
      <div style="font-weight: bold; color: #00ff00; min-width: 150px;">
        ${this.playerStats.name} (Lvl ${this.playerStats.level})
      </div>
      
      <!-- HP Bar -->
      ${hpBar}
      
      <!-- Power Bar (if applicable) -->
      ${powerBar}
      
      <!-- Core Stats -->
      <div style="display: flex; gap: 15px; font-size: 11px;">
        <div style="color: #ffaa00;">St:${this.playerStats.strength}</div>
        <div style="color: #ffaa00;">Dx:${this.playerStats.dexterity}</div>
        <div style="color: #ffaa00;">Co:${this.playerStats.constitution}</div>
        <div style="color: #ffaa00;">In:${this.playerStats.intelligence}</div>
        <div style="color: #ffaa00;">Wi:${this.playerStats.wisdom}</div>
        <div style="color: #ffaa00;">Ch:${this.playerStats.charisma}</div>
      </div>
      
      <!-- Secondary Stats -->
      <div style="display: flex; gap: 15px; font-size: 11px;">
        <div style="color: #aaaaff;">AC:${this.playerStats.armor}</div>
        <div style="color: #ffff66;">$:${this.playerStats.gold}</div>
        <div style="color: #66ffff;">T:${this.playerStats.time}</div>
      </div>
      
      <!-- Location and Status -->
      <div style="display: flex; flex-direction: column; gap: 2px; font-size: 11px; flex: 1; text-align: right;">
        <div style="color: #cccccc;">${this.playerStats.dungeon} ${this.playerStats.dlevel}</div>
        <div style="color: #ffaaff;">${this.playerStats.hunger}${this.playerStats.encumbrance ? ' ' + this.playerStats.encumbrance : ''}</div>
      </div>
    `;
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

  private showQuestion(
    question: string,
    choices: string,
    defaultChoice: string,
    menuItems: any[]
  ): void {
    // Temporarily disable automatic "?" expansion to debug menu issues
    // TODO: Re-enable with better logic later
    const needsExpansion = false;

    if (needsExpansion) {
      console.log(
        "🔍 Question includes '?' option, automatically expanding options..."
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
      questionDialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 20px;
        border: 2px solid #00ff00;
        border-radius: 10px;
        z-index: 2000;
        font-family: 'Courier New', monospace;
        text-align: center;
        min-width: 300px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
      `;
      document.body.appendChild(questionDialog);
    }

    // Clear previous content
    questionDialog.innerHTML = "";

    // Add question text
    const questionText = document.createElement("div");
    questionText.style.cssText = `
      font-size: 16px;
      margin-bottom: 15px;
      line-height: 1.4;
    `;
    questionText.textContent = question;
    questionDialog.appendChild(questionText);

    // Add menu items if available
    if (menuItems && menuItems.length > 0) {
      // Check if this is a multi-pickup dialog
      const isPickupDialog =
        question &&
        (question.toLowerCase().includes("pick up what") ||
          question.toLowerCase().includes("pick up") ||
          question.toLowerCase().includes("what do you want to pick up"));

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
      choiceContainer.style.cssText = `
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-top: 15px;
      `;

      if (choices && choices.length > 0) {
        for (const choice of choices) {
          const button = document.createElement("button");
          button.style.cssText = `
            padding: 8px 16px;
            background: ${choice === defaultChoice ? "#00aa00" : "#333"};
            color: white;
            border: 1px solid #666;
            border-radius: 3px;
            cursor: pointer;
            font-family: 'Courier New', monospace;
          `;
          button.textContent = choice.toUpperCase();
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
    escapeText.style.cssText = `
      font-size: 12px;
      color: #aaa;
      margin-top: 15px;
    `;
    escapeText.textContent = "Press ESC to cancel";
    questionDialog.appendChild(escapeText);

    // Show the dialog
    questionDialog.style.display = "block";
  }

  private showDirectionQuestion(question: string): void {
    // Set direction question state to pause movement
    this.isInDirectionQuestion = true;

    // Create or get direction dialog
    let directionDialog = document.getElementById("direction-dialog");
    if (!directionDialog) {
      directionDialog = document.createElement("div");
      directionDialog.id = "direction-dialog";
      directionDialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: #ffff00;
        padding: 20px;
        border: 2px solid #ffff00;
        border-radius: 10px;
        z-index: 2000;
        font-family: 'Courier New', monospace;
        text-align: center;
        min-width: 350px;
      `;
      document.body.appendChild(directionDialog);
    }

    // Clear previous content
    directionDialog.innerHTML = "";

    // Add question text
    const questionText = document.createElement("div");
    questionText.style.cssText = `
      font-size: 16px;
      margin-bottom: 20px;
      line-height: 1.4;
      color: #ffff00;
    `;
    questionText.textContent = question;
    directionDialog.appendChild(questionText);

    // Add direction buttons
    const directionsContainer = document.createElement("div");
    directionsContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 80px);
      gap: 5px;
      justify-content: center;
      margin: 20px 0;
    `;

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
      button.style.cssText = `
        width: 80px;
        height: 80px;
        background: #444;
        color: #ffff00;
        border: 2px solid #666;
        border-radius: 5px;
        cursor: pointer;
        font-family: 'Courier New', monospace;
        font-size: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
        line-height: 1.2;
      `;

      button.innerHTML = `<div style="font-size: 24px; margin-bottom: 2px;">${dir.label}</div><div style="font-size: 14px;">${dir.key}</div>`;

      button.onmouseover = () => {
        button.style.backgroundColor = "#666";
      };

      button.onmouseout = () => {
        button.style.backgroundColor = "#444";
      };

      button.onclick = () => {
        this.sendInput(dir.key);
        this.hideDirectionQuestion();
      };

      directionsContainer.appendChild(button);
    });

    directionDialog.appendChild(directionsContainer);

    // Add escape instruction
    const escapeText = document.createElement("div");
    escapeText.style.cssText = `
      font-size: 12px;
      color: #aaa;
      margin-top: 15px;
    `;
    escapeText.textContent =
      "Use numpad (1-9), arrow keys, or click a direction. Press ESC to cancel";
    directionDialog.appendChild(escapeText);

    // Show the dialog
    directionDialog.style.display = "block";
  }

  private hideDirectionQuestion(): void {
    this.isInDirectionQuestion = false;
    this.isInQuestion = false; // Clear general question state
    const directionDialog = document.getElementById("direction-dialog");
    if (directionDialog) {
      directionDialog.style.display = "none";
    }
  }

  private showInventoryDialog(): void {
    // Create or get inventory dialog
    let inventoryDialog = document.getElementById("inventory-dialog");
    if (!inventoryDialog) {
      inventoryDialog = document.createElement("div");
      inventoryDialog.id = "inventory-dialog";
      inventoryDialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 20px;
        border: 2px solid #00ff00;
        border-radius: 10px;
        z-index: 2000;
        font-family: 'Courier New', monospace;
        min-width: 450px;
        max-width: 600px;
        max-height: 95vh;
        overflow-y: auto;
      `;
      document.body.appendChild(inventoryDialog);
    }

    // Clear previous content
    inventoryDialog.innerHTML = "";

    // Add title
    const title = document.createElement("div");
    title.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      color: #00ff00;
      margin-bottom: 15px;
      text-align: center;
      border-bottom: 2px solid #00ff00;
      padding-bottom: 8px;
    `;
    title.textContent = "📦 INVENTORY";
    inventoryDialog.appendChild(title);

    // Add inventory items
    const itemsContainer = document.createElement("div");
    itemsContainer.style.cssText = `
      margin-bottom: 20px;
      max-height: 70vh;
      overflow-y: auto;
    `;

    if (this.currentInventory.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.style.cssText = `
        text-align: center;
        color: #aaa;
        font-style: italic;
        padding: 20px;
      `;
      emptyMessage.textContent = "Your inventory is empty.";
      itemsContainer.appendChild(emptyMessage);
    } else {
      // Display both categories and items (don't filter out categories)
      this.currentInventory.forEach((item: any, index: number) => {
        if (item.isCategory) {
          // This is a category header
          const categoryHeader = document.createElement("div");
          categoryHeader.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            color: #ffff00;
            margin: ${index === 0 ? "10px" : "15px"} 0 8px 0;
            text-align: left;
            border-bottom: 1px solid #666;
            padding-bottom: 4px;
            text-transform: uppercase;
          `;
          categoryHeader.textContent = item.text;
          itemsContainer.appendChild(categoryHeader);
        } else {
          // This is an actual item
          const itemDiv = document.createElement("div");
          itemDiv.style.cssText = `
            padding: 4px 10px;
            margin: 1px 0;
            background: rgba(255, 255, 255, 0.03);
            border-left: 2px solid #00ff00;
            line-height: 1.3;
            display: flex;
            align-items: center;
            margin-left: 10px;
          `;

          const keySpan = document.createElement("span");
          keySpan.style.cssText = `
            color: #00ff00;
            font-weight: bold;
            margin-right: 8px;
            min-width: 20px;
            font-size: 13px;
          `;
          keySpan.textContent = `${item.accelerator || "?"})`;

          const textSpan = document.createElement("span");
          textSpan.style.cssText = `
            color: #ffffff;
            flex: 1;
            font-size: 13px;
          `;
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
    keybindsTitle.style.cssText = `
      font-size: 13px;
      font-weight: bold;
      color: #ffff00;
      margin-bottom: 8px;
      border-top: 1px solid #444;
      padding-top: 12px;
    `;
    keybindsTitle.textContent = "🎮 ITEM COMMANDS";
    inventoryDialog.appendChild(keybindsTitle);

    // Create commands container
    const keybindsContainer = document.createElement("div");
    keybindsContainer.style.cssText = `
      font-size: 11px;
      line-height: 1.2;
      margin-bottom: 10px;
      padding: 8px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 4px;
      border: 1px solid #333;
    `;

    // Create highlighted command list with color-coded keys
    const commandText = `<span style="color: #88ff88;">a</span>)pply <span style="color: #88ff88;">d</span>)rop <span style="color: #88ff88;">e</span>)at <span style="color: #88ff88;">q</span>)uaff <span style="color: #88ff88;">r</span>)ead <span style="color: #88ff88;">t</span>)hrow <span style="color: #88ff88;">w</span>)ield <span style="color: #88ff88;">W</span>)ear <span style="color: #88ff88;">T</span>)ake-off <span style="color: #88ff88;">P</span>)ut-on <span style="color: #88ff88;">R</span>)emove <span style="color: #88ff88;">z</span>)ap <span style="color: #88ff88;">Z</span>)cast
    Special: <span style="color: #88ff88;">"</span>)weapons <span style="color: #88ff88;">[</span>)armor <span style="color: #88ff88;">=</span>)rings <span style="color: #88ff88;">"</span>)amulets <span style="color: #88ff88;">(</span>)tools`;

    keybindsContainer.innerHTML = `<div style="color: #cccccc; white-space: pre-line;">${commandText}</div>`;
    inventoryDialog.appendChild(keybindsContainer);

    // Add close instructions
    const closeText = document.createElement("div");
    closeText.style.cssText = `
      font-size: 12px;
      color: #aaa;
      text-align: center;
      margin-top: 10px;
      border-top: 1px solid #444;
      padding-top: 10px;
    `;
    closeText.textContent = "Press ESC or 'i' to close";
    inventoryDialog.appendChild(closeText);

    // Show the dialog
    inventoryDialog.style.display = "block";
  }

  private hideInventoryDialog(): void {
    const inventoryDialog = document.getElementById("inventory-dialog");
    if (inventoryDialog) {
      inventoryDialog.style.display = "none";
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
      posDialog.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: #ffff00;
        padding: 10px 20px;
        border: 1px solid #ffff00;
        border-radius: 5px;
        z-index: 2000;
        font-family: 'Courier New', monospace;
        text-align: center;
      `;
      document.body.appendChild(posDialog);
    }

    posDialog.textContent = text;
    posDialog.style.display = "block";

    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (posDialog) {
        posDialog.style.display = "none";
      }
    }, 3000);
  }

  private showNameRequest(text: string, maxLength: number): void {
    // Create or get name dialog
    let nameDialog = document.getElementById("name-dialog");
    if (!nameDialog) {
      nameDialog = document.createElement("div");
      nameDialog.id = "name-dialog";
      nameDialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 20px;
        border: 2px solid #00ff00;
        border-radius: 10px;
        z-index: 2000;
        font-family: 'Courier New', monospace;
        text-align: center;
        min-width: 300px;
      `;
      document.body.appendChild(nameDialog);
    }

    // Clear previous content
    nameDialog.innerHTML = "";

    // Add question text
    const questionText = document.createElement("div");
    questionText.style.cssText = `
      font-size: 16px;
      margin-bottom: 15px;
    `;
    questionText.textContent = text;
    nameDialog.appendChild(questionText);

    // Add input field
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.maxLength = maxLength;
    nameInput.placeholder = "Enter your name";
    nameInput.style.cssText = `
      width: 200px;
      padding: 8px;
      background: #333;
      color: white;
      border: 1px solid #666;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      margin-bottom: 15px;
    `;
    nameDialog.appendChild(nameInput);

    // Add submit button
    const submitButton = document.createElement("button");
    submitButton.textContent = "OK";
    submitButton.style.cssText = `
      padding: 8px 20px;
      background: #00aa00;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      margin-left: 10px;
    `;

    const submitName = () => {
      const name = nameInput.value.trim() || "Adventurer";
      this.sendInput(name);
      nameDialog.style.display = "none";
    };

    submitButton.onclick = submitName;
    nameInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        submitName();
      }
    };

    nameDialog.appendChild(submitButton);

    // Show dialog and focus input
    nameDialog.style.display = "block";
    nameInput.focus();
  }

  private hideQuestion(): void {
    this.isInQuestion = false; // Clear general question state
    const questionDialog = document.getElementById("question-dialog");
    if (questionDialog) {
      questionDialog.style.display = "none";
      questionDialog.innerHTML = ""; // Clear content to prevent retention
      // Clear pickup dialog flags
      (questionDialog as any).isPickupDialog = false;
      (questionDialog as any).menuItems = null;
    }
  }

  private createPickupDialog(
    questionDialog: HTMLElement,
    menuItems: any[],
    question: string
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
        categoryHeader.style.cssText = `
          font-size: 14px;
          font-weight: bold;
          color: #ffff00;
          margin: 15px 0 5px 0;
          text-align: left;
          border-bottom: 1px solid #444;
          padding-bottom: 3px;
        `;
        categoryHeader.textContent = item.text;
        questionDialog.appendChild(categoryHeader);
      } else {
        // Selectable item with checkbox
        const itemContainer = document.createElement("div");
        itemContainer.style.cssText = `
          display: flex;
          align-items: center;
          margin: 3px 0;
          padding: 8px;
          background: #333;
          border: 1px solid #666;
          border-radius: 3px;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          line-height: 1.3;
        `;

        // Checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `pickup-${item.accelerator}`;
        checkbox.style.cssText = `
          margin-right: 8px;
          transform: scale(1.2);
        `;

        // Key label
        const keyPart = document.createElement("span");
        keyPart.style.cssText = `
          color: #00ff00;
          font-weight: bold;
          margin-right: 8px;
          min-width: 30px;
        `;
        keyPart.textContent = `${item.accelerator})`;

        // Item text
        const textPart = document.createElement("span");
        textPart.style.cssText = `
          color: white;
          flex: 1;
        `;
        textPart.textContent = item.text;

        // Toggle function
        const toggleItem = () => {
          checkbox.checked = !checkbox.checked;
          if (checkbox.checked) {
            selectedItems.add(item.accelerator);
            itemContainer.style.backgroundColor = "#444";
          } else {
            selectedItems.delete(item.accelerator);
            itemContainer.style.backgroundColor = "#333";
          }
          // Send the key to NetHack to keep game state in sync
          this.sendInput(item.accelerator);
        };

        // Click handlers
        itemContainer.onclick = (e) => {
          e.preventDefault();
          toggleItem();
        };

        checkbox.onchange = (e) => {
          e.stopPropagation();
          // Checkbox state already changed, just update selection tracking
          if (checkbox.checked) {
            selectedItems.add(item.accelerator);
            itemContainer.style.backgroundColor = "#444";
          } else {
            selectedItems.delete(item.accelerator);
            itemContainer.style.backgroundColor = "#333";
          }
          // Send the key to NetHack to keep game state in sync
          this.sendInput(item.accelerator);
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
    confirmInstruction.style.cssText = `
      margin-top: 15px;
      padding: 10px;
      background: rgba(0, 255, 0, 0.1);
      border: 1px solid #00ff00;
      border-radius: 3px;
      text-align: center;
      color: #00ff00;
      font-weight: bold;
    `;
    confirmInstruction.textContent =
      "Press ENTER to confirm pickup, or ESC to cancel";
    questionDialog.appendChild(confirmInstruction);

    // Store that this is a pickup dialog for keyboard handling
    (questionDialog as any).isPickupDialog = true;
    (questionDialog as any).menuItems = menuItems;
  }

  private createStandardMenu(
    questionDialog: HTMLElement,
    menuItems: any[]
  ): void {
    menuItems.forEach((item) => {
      if (
        item.isCategory ||
        !item.accelerator ||
        item.accelerator.trim() === ""
      ) {
        // Category header
        const categoryHeader = document.createElement("div");
        categoryHeader.style.cssText = `
          font-size: 14px;
          font-weight: bold;
          color: #ffff00;
          margin: 15px 0 5px 0;
          text-align: left;
          border-bottom: 1px solid #444;
          padding-bottom: 3px;
        `;
        categoryHeader.textContent = item.text;
        questionDialog.appendChild(categoryHeader);
      } else {
        // Standard single-selection button
        const menuButton = document.createElement("button");
        menuButton.style.cssText = `
          display: block;
          width: 100%;
          margin: 3px 0;
          padding: 8px;
          background: #333;
          color: white;
          border: 1px solid #666;
          border-radius: 3px;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          text-align: left;
          line-height: 1.3;
        `;

        // Format the button text with key and description
        const keyPart = document.createElement("span");
        keyPart.style.cssText = `
          color: #00ff00;
          font-weight: bold;
        `;
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "input",
          input: input,
        })
      );
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Handle escape key to close dialogs
    if (event.key === "Escape") {
      // Check if inventory dialog is open and close it
      const inventoryDialog = document.getElementById("inventory-dialog");
      if (inventoryDialog && inventoryDialog.style.display !== "none") {
        this.hideInventoryDialog();
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
        posDialog.style.display = "none";
      }
      // Clear question states when escape is pressed
      this.isInQuestion = false;
      this.isInDirectionQuestion = false;
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
            `Refreshing tile at (${this.playerPos.x}, ${this.playerPos.y})...`
          );
          return;
      }
    }

    // Handle inventory display (before other key processing)
    if (event.key === "i" || event.key === "I") {
      event.preventDefault();

      // Check if inventory dialog is already open
      const inventoryDialog = document.getElementById("inventory-dialog");
      if (inventoryDialog && inventoryDialog.style.display !== "none") {
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
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: "input",
              input: mappedKey,
            })
          );
        }
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

          // Space or period for wait (center/5)
          case " ":
          case ".":
            keyToSend = "5";
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
            (item: any) => item.accelerator === event.key && !item.isCategory
          );

          if (matchingItem) {
            // Find the corresponding item container and toggle it
            const containers = questionDialog.querySelectorAll(
              'div[style*="display: flex"]'
            );
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

    // Send input to server for normal gameplay
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "input",
          input: event.key,
        })
      );
    }
  }

  private updateCamera(): void {
    const { x, y } = this.playerPos;
    const targetX = x * TILE_SIZE + this.cameraPanX;
    const targetY = -y * TILE_SIZE + this.cameraPanY;

    // Use spherical coordinates for camera positioning
    const sphericalX =
      this.cameraDistance *
      Math.cos(this.cameraAngleX) *
      Math.cos(this.cameraAngleY);
    const sphericalY =
      this.cameraDistance *
      Math.cos(this.cameraAngleX) *
      Math.sin(this.cameraAngleY);
    const sphericalZ = this.cameraDistance * Math.sin(this.cameraAngleX);

    // Position camera relative to player (with panning offset)
    this.camera.position.x = targetX + sphericalX;
    this.camera.position.y = targetY + sphericalY;
    this.camera.position.z = sphericalZ;

    // Always look at the target position (player + pan offset)
    this.camera.lookAt(targetX, targetY, 0);
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
      Math.min(this.maxDistance, this.cameraDistance + delta)
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

      const rotationSpeed = 0.01;
      this.cameraAngleY += deltaY * rotationSpeed;
      this.cameraAngleX += deltaX * rotationSpeed;

      // Clamp vertical rotation to prevent camera flipping
      this.cameraAngleX = Math.max(
        -Math.PI / 2 + 0.1,
        Math.min(Math.PI / 2 - 0.1, this.cameraAngleX)
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

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }
}

// --- APPLICATION ENTRY POINT ---
const game = new Nethack3DEngine();

// Make game instance available globally for debugging
(window as any).nethackGame = game;

// Add some debugging helpers to the window object
(window as any).refreshTile = (x: number, y: number) => {
  game.requestTileUpdate(x, y);
};

(window as any).refreshArea = (
  centerX: number,
  centerY: number,
  radius: number = 3
) => {
  game.requestAreaUpdate(centerX, centerY, radius);
};

(window as any).refreshPlayerArea = (radius: number = 5) => {
  game.requestPlayerAreaUpdate(radius);
};

console.log("🎮 NetHack 3D debugging helpers available:");
console.log("  refreshTile(x, y) - Refresh a specific tile");
console.log("  refreshArea(x, y, radius) - Refresh an area");
console.log("  refreshPlayerArea(radius) - Refresh around player");
console.log("  Ctrl+T - Refresh player tile");
console.log("  Ctrl+R - Refresh player area (radius 5)");
console.log("  Ctrl+Shift+R - Refresh large player area (radius 10)");
console.log("🕹️ Movement controls:");
console.log("  Arrow keys - Cardinal directions (N/S/E/W)");
console.log("  Numpad 1-9 - All directions including diagonals");
console.log("  Home/PgUp/End/PgDn - Diagonal movement (NW/NE/SW/SE)");
console.log("  Numpad 5 or Space - Wait/rest");
console.log("📦 Interface controls:");
console.log("  'i' - Open/close inventory dialog");
console.log("  ESC - Close dialogs or cancel actions");

export default game;
