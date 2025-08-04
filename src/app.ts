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
      this.updateStatus("Disconnected from server");
      this.addGameMessage("Disconnected from server");

      // Show loading screen
      const loading = document.getElementById("loading");
      if (loading) {
        loading.style.display = "block";
        loading.innerHTML =
          '<div>NetHack 3D</div><div style="font-size: 14px; margin-top: 10px;">Reconnecting...</div>';
      }

      // Try to reconnect after 3 seconds
      setTimeout(() => {
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
          this.connectToServer();
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
        this.updateTile(data.x, data.y, data.glyph, data.char, data.color);
        break;

      case "player_position":
        this.playerPos = { x: data.x, y: data.y };
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

        // For non-character creation questions, show normal dialog
        this.showQuestion(
          data.text,
          data.choices,
          data.default,
          data.menuItems
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

      default:
        console.log("Unknown message type:", data.type, data);
    }
  }

  private createTextSprite(text: string, size: number = 128, textColor: string = "yellow"): THREE.Sprite {
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

  private updateTile(
    x: number,
    y: number,
    glyph: number,
    char?: string,
    color?: number
  ): void {
    // Debug logging to see what character data we're receiving
    console.log(`🎨 updateTile(${x},${y}) glyph=${glyph} char="${char}" color=${color}`);
    
    const key = `${x},${y}`;
    let mesh = this.tileMap.get(key);
    let textSprite = this.textSpriteMap.get(key);

    // Check if this is the player glyph and update player position
    // Use the provided char if available, otherwise fall back to glyph range detection
    const isPlayerGlyph = char === "@" || (glyph >= 331 && glyph <= 360);
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
          console.log(`  -> Door with character "${char}" - defaulting to open`);
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
      } else if (char === "@") {
        // Player character
        console.log(`  -> Player`);
        material = this.materials.player;
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

  private showQuestion(
    question: string,
    choices: string,
    defaultChoice: string,
    menuItems: any[]
  ): void {
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
        max-width: 500px;
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
      menuItems.forEach((item) => {
        const menuButton = document.createElement("button");
        menuButton.style.cssText = `
          display: block;
          width: 100%;
          margin: 5px 0;
          padding: 8px;
          background: #333;
          color: white;
          border: 1px solid #666;
          border-radius: 3px;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          text-align: left;
        `;
        menuButton.textContent = `${item.accelerator}) ${item.text}`;
        menuButton.onclick = () => {
          this.sendInput(item.accelerator);
          this.hideQuestion();
        };
        questionDialog.appendChild(menuButton);
      });
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
      { key: '7', label: '↖', name: 'NW' },
      { key: '8', label: '↑', name: 'N' },
      { key: '9', label: '↗', name: 'NE' },
      { key: '4', label: '←', name: 'W' },
      { key: '5', label: '•', name: 'Wait' },
      { key: '6', label: '→', name: 'E' },
      { key: '1', label: '↙', name: 'SW' },
      { key: '2', label: '↓', name: 'S' },
      { key: '3', label: '↘', name: 'SE' }
    ];

    directions.forEach(dir => {
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
    escapeText.textContent = "Use numpad (1-9), arrow keys, or click a direction. Press ESC to cancel";
    directionDialog.appendChild(escapeText);

    // Show the dialog
    directionDialog.style.display = "block";
  }

  private hideDirectionQuestion(): void {
    this.isInDirectionQuestion = false;
    const directionDialog = document.getElementById("direction-dialog");
    if (directionDialog) {
      directionDialog.style.display = "none";
    }
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
    const questionDialog = document.getElementById("question-dialog");
    if (questionDialog) {
      questionDialog.style.display = "none";
    }
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
      this.hideQuestion();
      this.hideDirectionQuestion();
      const posDialog = document.getElementById("position-dialog");
      if (posDialog) {
        posDialog.style.display = "none";
      }
      return;
    }

    // If we're in a direction question, handle direction input specially
    if (this.isInDirectionQuestion) {
      // With number_pad:1 option, we can pass numpad keys and arrow keys directly
      let keyToSend = null;
      
      switch (event.key) {
        // Arrow keys - map to numpad equivalents
        case 'ArrowUp':
          keyToSend = '8';
          break;
        case 'ArrowDown':
          keyToSend = '2';
          break;
        case 'ArrowLeft':
          keyToSend = '4';
          break;
        case 'ArrowRight':
          keyToSend = '6';
          break;
        
        // Numpad keys - pass through directly
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          keyToSend = event.key;
          break;
        
        // Space or period for wait (center/5)
        case ' ':
        case '.':
          keyToSend = '5';
          break;
      }
      
      if (keyToSend) {
        this.sendInput(keyToSend);
        this.hideDirectionQuestion();
      }
      return; // Don't send other keys when in direction question mode
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

export default game;
