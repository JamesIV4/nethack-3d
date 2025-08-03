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
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private minDistance: number = 5;
  private maxDistance: number = 50;

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
    // Create game log overlay
    const logContainer = document.createElement("div");
    logContainer.id = "game-log";
    logContainer.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      width: 400px;
      height: 200px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 10px;
      border: 1px solid #333;
      border-radius: 5px;
      overflow-y: auto;
      z-index: 1000;
      pointer-events: none;
    `;
    document.body.appendChild(logContainer);

    // Create status overlay
    const statusContainer = document.createElement("div");
    statusContainer.id = "game-status";
    statusContainer.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #ffffff;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      padding: 10px;
      border: 1px solid #333;
      border-radius: 5px;
      z-index: 1000;
      pointer-events: none;
    `;
    statusContainer.innerHTML = "Connecting to NetHack server...";
    document.body.appendChild(statusContainer);

    // Create connection status
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
        this.updateTile(data.x, data.y, data.glyph);
        break;

      case "player_position":
        this.playerPos = { x: data.x, y: data.y };
        break;

      case "text":
        this.addGameMessage(data.text);
        break;

      case "menu_item":
        this.addGameMessage(`Menu: ${data.text} (${data.accelerator})`);
        break;

      case "question":
        this.showQuestion(
          data.text,
          data.choices,
          data.default,
          data.menuItems
        );
        break;

      case "position_request":
        // Only show meaningful position requests, filter out spam
        if (data.text && data.text.trim() && 
            !data.text.includes("cursor") && 
            !data.text.includes("Select a position")) {
          this.showPositionRequest(data.text);
        }
        break;

      case "name_request":
        this.showNameRequest(data.text, data.maxLength);
        break;

      default:
        console.log("Unknown message type:", data.type, data);
    }
  }

  private createTextSprite(text: string, size: number = 128): THREE.Sprite {
    // Create a canvas to draw text on
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;

    // Set canvas size (larger for better readability)
    canvas.width = size;
    canvas.height = size;

    // Configure text rendering
    context.fillStyle = "yellow";
    context.font = "bold 24px monospace"; // Larger, monospace font
    context.textAlign = "center";
    context.textBaseline = "middle";

    // Clear canvas with transparent background
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Add semi-transparent background for better visibility
    context.fillStyle = "rgba(0, 0, 0, 0.7)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the text
    context.fillStyle = "yellow";
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

    // Player character (specific glyph numbers for player)
    if (glyph === 342 || glyph === 339 || glyph === 331) return "@";

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

    // Default: show glyph number for debugging
    return glyph.toString();
  }

  private updateTile(x: number, y: number, glyph: number): void {
    const key = `${x},${y}`;
    let mesh = this.tileMap.get(key);
    let textSprite = this.textSpriteMap.get(key);

    // Determine tile type based on glyph ID ranges (these are NetHack-specific)
    let material = this.materials.default;
    let geometry = this.floorGeometry;
    let isWall = false;

    if (glyph >= 2378 && glyph <= 2394) {
      // Wall glyphs
      material = this.materials.wall;
      geometry = this.wallGeometry;
      isWall = true;
    } else if (glyph >= 2395 && glyph <= 2397) {
      // Floor glyphs
      material = this.materials.floor;
      geometry = this.floorGeometry;
    } else if (glyph === 342) {
      // Player glyph
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
    const glyphChar = this.glyphToChar(glyph);
    if (!textSprite) {
      textSprite = this.createTextSprite(glyphChar);
      this.scene.add(textSprite);
      this.textSpriteMap.set(key, textSprite);
    } else {
      // Update existing sprite with new glyph character
      const newSprite = this.createTextSprite(glyphChar);
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
      const posDialog = document.getElementById("position-dialog");
      if (posDialog) {
        posDialog.style.display = "none";
      }
    }

    // Send input to server
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
    const targetX = x * TILE_SIZE;
    const targetY = -y * TILE_SIZE;

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

    this.camera.position.x = targetX + sphericalX;
    this.camera.position.y = targetY + sphericalY;
    this.camera.position.z = sphericalZ;
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
      // Middle mouse button
      event.preventDefault();
      this.isMiddleMouseDown = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this.isMiddleMouseDown) {
      event.preventDefault();
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;

      const rotationSpeed = 0.01;
      this.cameraAngleY += deltaX * rotationSpeed;
      this.cameraAngleX += deltaY * rotationSpeed;

      // Clamp vertical rotation to prevent camera flipping
      this.cameraAngleX = Math.max(
        -Math.PI / 2 + 0.1,
        Math.min(Math.PI / 2 - 0.1, this.cameraAngleX)
      );

      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    if (event.button === 1) {
      // Middle mouse button
      this.isMiddleMouseDown = false;
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
