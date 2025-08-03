/*
 * Main entry point for the NetHack 3D client.
 * This module connects to our NetHack WebSocket server and renders the game in 3D using Three.js.
 */
import * as THREE from "three";
// --- CONSTANTS ---
const TILE_SIZE = 1; // The size of each tile in 3D space
const WALL_HEIGHT = 1; // How tall wall blocks are
/**
 * The main game engine class. It encapsulates all the logic for the 3D client.
 */
class Nethack3DEngine {
  constructor() {
    this.tileMap = new Map();
    this.playerPos = { x: 0, y: 0 };
    this.gameMessages = [];
    this.ws = null;
    // Pre-create geometries and materials
    this.floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    this.wallGeometry = new THREE.BoxGeometry(
      TILE_SIZE,
      TILE_SIZE,
      WALL_HEIGHT
    );
    // Materials for different glyph types
    this.materials = {
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
    this.initThreeJS();
    this.initUI();
    this.connectToServer();
  }
  initThreeJS() {
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
    // Start render loop
    this.animate();
  }
  initUI() {
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
  connectToServer() {
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
  handleServerMessage(data) {
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
      case "question":
        this.showQuestion(
          data.text,
          data.choices,
          data.default,
          data.menuItems
        );
        break;
      case "position_request":
        this.showQuestion(data.text, "Escape", 0, []);
        break;
      case "menu_item":
        this.addMenuOption(data.text, data.accelerator, data.window);
        break;
      default:
        console.log("Unknown message type:", data.type, data);
    }
  }
  updateTile(x, y, glyph) {
    const key = `${x},${y}`;
    let mesh = this.tileMap.get(key);
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
  }
  addGameMessage(message) {
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
  updateStatus(status) {
    const statusElement = document.getElementById("game-status");
    if (statusElement) {
      statusElement.innerHTML = status;
    }
  }

  showQuestion(question, choices, defaultChoice, menuItems) {
    this.addGameMessage(`Question: ${question}`);

    const questionUI = document.getElementById("question-ui");
    const questionText = document.getElementById("question-text");
    const questionOptions = document.getElementById("question-options");

    if (!questionUI || !questionText || !questionOptions) return;

    questionText.textContent = question;
    questionOptions.innerHTML = "";

    // Use menu items if provided, otherwise use current menu items
    const itemsToShow =
      menuItems && menuItems.length > 0 ? menuItems : this.currentMenuItems;

    // Create options from available menu items
    if (itemsToShow && itemsToShow.length > 0) {
      itemsToShow.forEach((item) => {
        if (item.text && item.accelerator && item.accelerator.trim()) {
          const button = document.createElement("button");
          button.className = "option-button";
          button.textContent = `${item.accelerator}: ${item.text}`;
          button.onclick = () => this.selectOption(item.accelerator);
          questionOptions.appendChild(button);
        }
      });
    } else {
      // Create basic options from choices string
      const choiceChars = choices.replace(/[\[\]]/g, "").split("");
      choiceChars.forEach((char) => {
        if (char.trim()) {
          const button = document.createElement("button");
          button.className = "option-button";
          button.textContent = char === "?" ? "? (Help)" : char;
          button.onclick = () => this.selectOption(char);
          questionOptions.appendChild(button);
        }
      });
    }

    // Add cancel option
    const cancelButton = document.createElement("button");
    cancelButton.className = "option-button";
    cancelButton.textContent = "Esc (Cancel)";
    cancelButton.onclick = () => this.selectOption("q");
    questionOptions.appendChild(cancelButton);

    questionUI.style.display = "block";
  }

  hideQuestion() {
    const questionUI = document.getElementById("question-ui");
    if (questionUI) {
      questionUI.style.display = "none";
    }
    this.currentMenuItems = [];
  }

  selectOption(choice) {
    this.hideQuestion();
    this.sendInput(choice);
  }

  addMenuOption(text, accelerator, window) {
    // Store menu items for current question
    this.currentMenuItems = this.currentMenuItems || [];
    this.currentMenuItems.push({
      text: text,
      accelerator: accelerator,
      window: window,
    });

    // Also add to game log
    this.addGameMessage(`${accelerator}: ${text}`);
  }

  sendInput(input) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "input",
          input: input,
        })
      );
    }
  }
  updateConnectionStatus(status, color) {
    const connElement = document.getElementById("connection-status");
    if (connElement) {
      connElement.innerHTML = status;
      connElement.style.backgroundColor = color;
    }
  }
  handleKeyDown(event) {
    // If question UI is showing, let it handle the input
    const questionUI = document.getElementById("question-ui");
    if (questionUI && questionUI.style.display !== "none") {
      // Handle keyboard shortcuts for questions
      this.selectOption(event.key);
      return;
    }

    // Send input to server for normal gameplay
    this.sendInput(event.key);
  }
  updateCamera() {
    const { x, y } = this.playerPos;
    const targetX = x * TILE_SIZE;
    const targetY = -y * TILE_SIZE;
    // Position the camera behind and above the player for an isometric view
    this.camera.position.x = targetX + 10;
    this.camera.position.y = targetY - 10;
    this.camera.position.z = 15;
    this.camera.lookAt(targetX, targetY, 0);
  }
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }
}
// --- APPLICATION ENTRY POINT ---
const game = new Nethack3DEngine();
export default game;
