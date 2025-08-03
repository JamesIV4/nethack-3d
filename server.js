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
    this.nethackModule = null; // Store reference to the Module for direct calls

    // Start NetHack with our callback
    this.startNetHack();
  }

  // Function to read window content directly from NetHack
  readWindowContent(winId) {
    try {
      if (!this.nethackModule || !this.nethackModule.ccall) {
        console.log(`❌ Cannot read window ${winId}: Module not available`);
        return null;
      }

      console.log(`📖 Attempting to read content of window ${winId}...`);

      // Try to get window info - these are common NetHack internal functions
      const windowFunctions = [
        "_get_window_content",
        "_get_window_text",
        "_dump_window",
        "_window_get_string",
        "_nhwindow_content",
      ];

      for (const funcName of windowFunctions) {
        try {
          if (this.nethackModule[funcName]) {
            console.log(`   🔍 Trying ${funcName}...`);
            const result = this.nethackModule.ccall(
              funcName,
              "string",
              ["number"],
              [winId]
            );
            if (result) {
              console.log(`   ✅ ${funcName} returned: "${result}"`);
              return result;
            }
          }
        } catch (e) {
          console.log(`   ❌ ${funcName} failed:`, e.message);
        }
      }

      // Try to read memory directly if we can get window pointers
      console.log(
        `   📋 Available module functions:`,
        Object.keys(this.nethackModule).filter(
          (k) => k.includes("window") || k.includes("text")
        )
      );

      return null;
    } catch (error) {
      console.error(`Error reading window ${winId}:`, error);
      return null;
    }
  }

  // Function to dump all available NetHack functions that might help us read content
  exploreNetHackFunctions() {
    if (!this.nethackModule) return;

    console.log("🔍 Exploring NetHack WASM functions...");
    const allFunctions = Object.keys(this.nethackModule);

    const relevantFunctions = allFunctions.filter(
      (name) =>
        name.includes("window") ||
        name.includes("text") ||
        name.includes("str") ||
        name.includes("content") ||
        name.includes("display") ||
        name.includes("menu") ||
        name.includes("get") ||
        name.includes("read")
    );

    console.log("📋 Relevant functions found:", relevantFunctions);
    return relevantFunctions;
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
        arguments: [], // NetHack command line arguments
        preRun: [
          function () {
            // Set up NetHack environment variables for automatic play
            console.log("Setting up NetHack environment...");
            Module.ENV = Module.ENV || {};
            // Set NetHack options to skip some prompts
            Module.ENV.NETHACKOPTIONS =
              "name:Hero,role:Knight,race:Human,gender:male,align:lawful";
          },
        ],
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

          // Store reference to Module for direct function calls
          this.nethackModule = Module;

          // Set up the missing globalThis.nethackGlobal context that the original shim expects
          if (!globalThis.nethackGlobal) {
            console.log("🌐 Setting up missing globalThis.nethackGlobal...");
            globalThis.nethackGlobal = {
              constants: {
                WIN_TYPE: {
                  1: "WIN_MESSAGE",
                  2: "WIN_MAP",
                  3: "WIN_STATUS",
                  4: "WIN_INVEN",
                },
                STATUS_FIELD: {},
                MENU_SELECT: { PICK_NONE: 0, PICK_ONE: 1, PICK_ANY: 2 },
              },
              helpers: {
                getPointerValue: (name, ptr, type) => {
                  if (type === "s") {
                    return Module.UTF8ToString(ptr);
                  }
                  return ptr;
                },
              },
              globals: {
                WIN_MAP: 2,
                WIN_INVEN: 4,
                WIN_STATUS: 3,
                WIN_MESSAGE: 1,
              },
            };
            console.log("✅ globalThis.nethackGlobal set up");
          }

          // Try calling createContext to see what it does
          console.log("🔧 Investigating createContext function...");
          try {
            if (Module.createContext) {
              console.log("   📞 Calling Module.createContext()...");
              const context = Module.createContext();
              console.log("   ✅ createContext returned:", context);
            } else {
              console.log("   ❌ createContext not available");
            }
          } catch (e) {
            console.log("   ❌ createContext error:", e.message);
          }

          // Set up the global callback first
          console.log("Setting up global nethackCallback...");
          globalThis.nethackCallback = this.uiCallback.bind(this);
          console.log(
            "Global callback set up:",
            typeof globalThis.nethackCallback
          );

          // Explore available functions
          this.exploreNetHackFunctions();

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

                  // After starting main, try to send some input to continue past intro
                  setTimeout(() => {
                    console.log(
                      "Attempting to send input to continue past intro..."
                    );
                    try {
                      // Try to simulate pressing space or enter to continue
                      if (Module.ccall && Module._shim_input_available) {
                        console.log("Trying to send space key...");
                        Module.ccall("shim_input_available", null, [], []);
                      }
                    } catch (inputError) {
                      console.log(
                        "Input method not available:",
                        inputError.message
                      );
                    }
                  }, 500);
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
    console.log(`🔔 UI Callback: ${name}`, args);

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
        console.log("NetHack starting menu:", args);
        return 0;

      case "shim_end_menu":
        console.log("NetHack ending menu:", args);
        return 0;

      case "shim_add_menu": {
        const [winid, glyph, accelerator, groupacc, attr, str, preselected] =
          args;
        console.log(
          `📋 MENU ITEM [Win ${winid}]: "${str}" (key: ${String.fromCharCode(
            accelerator || 32
          )})`
        );
        return 0;
      }

      case "shim_select_menu": {
        const [winid, how] = args;
        console.log(`🔍 MENU SELECTION REQUEST [Win ${winid}], how: ${how}`);
        // For character creation, typically select the first option (like Human Knight)
        // Return a simple selection - this might need adjustment based on NetHack's expectations
        return 1; // Select first item
      }

      case "shim_player_selection":
        // Return a default player selection (let's pick a Knight)
        console.log("🎭 PLAYER SELECTION - returning default Knight");
        // Return some default player class - this might need adjustment
        return 0; // or try different values if this doesn't work

      case "shim_display_nhwindow":
        const [winId, blocking] = args;
        console.log(`📺 DISPLAY WINDOW [Win ${winId}], blocking: ${blocking}`);

        // Try to read the actual content of this window
        console.log(`📖 Reading content of window ${winId}...`);
        const content = this.readWindowContent(winId);
        if (content) {
          console.log(`📄 WINDOW ${winId} CONTENT:\n${content}`);
        } else {
          console.log(`❓ No content found for window ${winId}`);
        }

        // If this is a blocking display, NetHack might be waiting for acknowledgment
        if (blocking) {
          console.log(
            `⏸️  Window ${winId} is blocking - NetHack waiting for input`
          );
          // Try to signal that we've displayed the window
          setTimeout(() => {
            console.log(
              `⚡ Triggering continuation after displaying window ${winId}`
            );
            // We might need to call some NetHack function to continue
          }, 100);
        }

        return 0;

      case "shim_clear_nhwindow":
        console.log(`🧹 CLEAR WINDOW [Win ${args[0]}]`);
        return 0;

      case "shim_print_glyph": {
        const [win, x, y, glyph] = args;
        console.log(`🗺️  GLYPH [Win ${win}] at (${x},${y}): glyph ${glyph}`);
        // Send glyph data to client for 3D rendering
        this.sendMessage({
          type: "print_glyph",
          data: { win, x, y, glyph },
        });
        return;
      }

      case "shim_putstr": {
        const [win, attr, str] = args;
        console.log(`💬 TEXT [Win ${win}]: "${str}" (attr: ${attr})`);
        console.log(`   📝 CAPTURED TEXT: "${str}"`);

        // Send message to client
        this.sendMessage({
          type: "message",
          data: { win, attr, str },
        });
        return;
      }

      case "shim_getlin": {
        const [prompt] = args;
        console.log(`⌨️  LINE INPUT REQUEST: "${prompt}"`);
        // For character name, return a default name
        if (prompt && prompt.toLowerCase().includes("name")) {
          console.log("   → Providing default character name: Hero");
          return "Hero"; // Default character name
        }
        console.log("   → Providing empty response");
        return ""; // Default empty response for other line inputs
      }

      case "shim_nhgetch":
        // Wait for key input from client
        console.log(
          "🎯 KEY INPUT REQUEST - sending automatic response to continue"
        );
        // For now, send a space key to continue past initial screens
        return 32; // Space key

      // Original code for future WebSocket input:
      // return new Promise((resolve) => {
      //   this.keyResolvers.push(resolve);
      //   this.sendMessage({
      //     type: "request_key",
      //   });
      // });

      case "shim_yn_function":
        console.log("❓ YES/NO QUESTION - answering yes");
        // For now, automatically answer 'yes' to questions
        return "y".charCodeAt(0);

      case "shim_message_menu":
        console.log("📝 MESSAGE MENU - returning y");
        return 121; // return 'y' to all questions

      case "shim_nh_poskey":
        console.log("🎯 POSITION KEY REQUEST - returning space");
        return 32; // Space key to continue

      default:
        console.log(`❌ UNHANDLED UI CALLBACK: ${name}`, args);
        console.log(`   📋 Available methods: ${Object.keys(this).join(", ")}`);
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
