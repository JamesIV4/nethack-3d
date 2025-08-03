const express = require("express");
const WebSocket = require("ws");
const http = require("http");
const path = require("path");
const fs = require("fs");

// Add fetch polyfill if not available
if (!globalThis.fetch) {
  const fetch = require("node-fetch");
  globalThis.fetch = fetch;
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from public directory
app.use(express.static("public"));

// Store active game sessions
const gameSessions = new Map();

class NetHackSession {
  constructor(ws) {
    this.ws = ws;
    this.gameStarted = false;
    this.winCount = 0;
    this.keyResolvers = [];
    this.nethackInstance = null;

    // Start NetHack with our callback
    this.startNetHack();
  }

  startNetHack() {
    try {
      console.log("Starting NetHack session...");

      // Load the WASM file manually from public folder
      const wasmPath = path.join(__dirname, "public", "nethack.wasm");
      console.log("Loading WASM from:", wasmPath);
      const wasmBinary = fs.readFileSync(wasmPath);
      console.log("WASM binary loaded, size:", wasmBinary.length);

      // Use the public folder's nethack.js instead of the npm package
      const nethackFactory = require(path.join(
        __dirname,
        "public",
        "nethack.js"
      ));

      // Configure module to use the pre-loaded WASM
      const Module = {
        wasmBinary: wasmBinary,
        locateFile: (path, scriptDirectory) => {
          console.log(
            "locateFile called with:",
            path,
            "scriptDirectory:",
            scriptDirectory
          );
          if (path.endsWith(".wasm")) {
            const wasmPath = require("path").join(__dirname, "public", path);
            console.log("Using WASM path:", wasmPath);
            return wasmPath;
          }
          return path;
        },
        onRuntimeInitialized: () => {
          console.log("NetHack WASM runtime initialized!");

          // Set up the global callback first
          console.log("Setting up global nethackCallback...");
          globalThis.nethackCallback = this.uiCallback.bind(this);
          console.log(
            "Global callback set up:",
            typeof globalThis.nethackCallback
          );

          // At this point, the Module object should have all the WASM functions
          console.log("Module ccall available:", typeof Module.ccall);

          if (Module.ccall) {
            try {
              console.log("Setting up graphics callback with Module...");
              Module.ccall(
                "shim_graphics_set_callback",
                null,
                ["string"],
                ["nethackCallback"],
                { async: true }
              );
              console.log("Graphics callback set up successfully");

              // Don't call main immediately - let the callback setup complete first
              console.log("Waiting before starting NetHack main...");
              setTimeout(() => {
                try {
                  console.log("Now starting NetHack main...");
                  Module.ccall("main", "number", [], [], { async: true });
                  console.log("NetHack main called successfully");
                } catch (mainError) {
                  console.error("Error calling NetHack main:", mainError);
                }
              }, 100);
            } catch (callbackError) {
              console.error(
                "Error setting up NetHack callbacks:",
                callbackError
              );
            }
          }

          this.gameStarted = true;
          this.sendMessage({
            type: "game_started",
            message: "NetHack game started successfully!",
          });
        },
      };

      // Set up global callback
      // globalThis.nethackCallback = this.uiCallback.bind(this); // Moved to onRuntimeInitialized

      console.log("Starting NetHack with factory...");
      this.nethackInstance = nethackFactory(Module);
      console.log(
        "NetHack factory called, instance:",
        typeof this.nethackInstance
      );
      console.log(
        "NetHack instance has ready:",
        "ready" in this.nethackInstance
      );
      console.log(
        "NetHack instance ready type:",
        typeof this.nethackInstance.ready
      );

      // Wait for the module to be ready if it has a ready promise
      if (this.nethackInstance && this.nethackInstance.ready) {
        console.log("Waiting for NetHack module ready promise...");
        this.nethackInstance.ready
          .then((module) => {
            console.log("NetHack module is now ready!");
            console.log("Module methods:", Object.keys(module));
            this.handleModuleReady(module);
          })
          .catch((error) => {
            console.error("Error waiting for NetHack module:", error);
          });
      } else {
        console.log("No ready promise found, trying direct approach");
        // Try using the instance directly after a short delay
        setTimeout(() => {
          console.log("Checking instance after delay...");
          console.log(
            "Instance methods after delay:",
            Object.keys(this.nethackInstance)
          );
          if (this.nethackInstance.ccall) {
            this.handleModuleReady(this.nethackInstance);
          }
        }, 1000);
      }
    } catch (err) {
      console.error("Error starting NetHack:", err);
      this.sendMessage({
        type: "error",
        message: `Failed to start NetHack: ${err.message}`,
      });
    }
  }

  // Handle when the NetHack module is fully ready
  handleModuleReady(module) {
    try {
      console.log("Setting up NetHack with ready module...");
      console.log("Module ccall available:", typeof module.ccall);

      if (module.ccall) {
        console.log("Setting up graphics callback...");
        module.ccall(
          "shim_graphics_set_callback",
          null,
          ["string"],
          ["nethackCallback"],
          { async: true }
        );
        console.log("Graphics callback set up successfully");

        // Start the actual NetHack game
        console.log("Starting NetHack main...");
        module.ccall("main", "number", [], []);
        console.log("NetHack main called");
      }

      this.gameStarted = true;
      this.sendMessage({
        type: "game_started",
        message: "NetHack game started and ready for input!",
      });
    } catch (error) {
      console.error("Error in handleModuleReady:", error);
      this.sendMessage({
        type: "error",
        message: `Failed to start NetHack game: ${error.message}`,
      });
    }
  }

  // UI callback function that NetHack will call
  async uiCallback(name, ...args) {
    console.log(`UI Callback: ${name}`, args);

    switch (name) {
      case "shim_init_nhwindows":
        // Initialize the window system
        console.log("Initializing NetHack windows");
        return 0;

      case "shim_create_nhwindow":
        this.winCount++;
        console.log("creating window", args, "returning", this.winCount);
        return this.winCount;

      case "shim_status_init":
        // Initialize status display
        console.log("Initializing status display");
        return 0;

      case "shim_start_menu":
      case "shim_end_menu":
        // Menu operations can be ignored for now
        return 0;

      case "shim_player_selection":
        // Return a default player selection (let's pick a Knight)
        console.log("Player selection - returning default Knight");
        // Return some default player class - this might need adjustment
        return 0; // or try different values if this doesn't work

      case "shim_display_nhwindow":
      case "shim_clear_nhwindow":
        // These can be ignored for our 3D implementation
        return;

      case "shim_print_glyph": {
        const [win, x, y, glyph] = args;
        // Send glyph data to client for 3D rendering
        this.sendMessage({
          type: "print_glyph",
          data: { win, x, y, glyph },
        });
        return;
      }

      case "shim_putstr": {
        const [win, attr, str] = args;
        // Send message to client
        this.sendMessage({
          type: "message",
          data: { win, attr, str },
        });
        return;
      }

      case "shim_nhgetch":
        // Wait for key input from client
        return new Promise((resolve) => {
          this.keyResolvers.push(resolve);
          this.sendMessage({
            type: "request_key",
          });
        });

      case "shim_yn_function":
        // For now, automatically answer 'yes' to questions
        return "y".charCodeAt(0);

      case "shim_message_menu":
        return 121; // return 'y' to all questions

      case "shim_nh_poskey":
        return 0; // simulates a mouse click

      default:
        console.log("Unhandled UI callback:", name, args);
        return 0;
    }
  }

  // Send message to WebSocket client
  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // Handle key input from client
  handleKeyInput(key) {
    if (this.keyResolvers.length > 0) {
      const resolve = this.keyResolvers.shift();
      resolve(key.charCodeAt(0));
    }
  }

  // Clean up session
  cleanup() {
    // Resolve any pending key requests
    this.keyResolvers.forEach((resolve) => resolve(27)); // ESC key
    this.keyResolvers = [];
  }
}

// WebSocket connection handler
wss.on("connection", (ws) => {
  console.log("New WebSocket connection");

  const sessionId = Date.now().toString();
  const session = new NetHackSession(ws);
  gameSessions.set(sessionId, session);

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);
      console.log("Received message:", message);

      switch (message.type) {
        case "key_input":
          session.handleKeyInput(message.key);
          break;

        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;

        default:
          console.log("Unknown message type:", message.type);
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
    session.cleanup();
    gameSessions.delete(sessionId);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    session.cleanup();
    gameSessions.delete(sessionId);
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`NetHack 3D Server running on http://localhost:${PORT}`);
  console.log(`Game sessions: ${gameSessions.size}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down server...");
  gameSessions.forEach((session) => session.cleanup());
  server.close(() => {
    process.exit(0);
  });
});
