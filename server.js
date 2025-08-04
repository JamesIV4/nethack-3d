const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

class NetHackSession {
  constructor(ws) {
    this.ws = ws;
    this.nethackInstance = null;
    this.gameMap = new Map();
    this.playerPosition = { x: 0, y: 0 };
    this.gameMessages = [];
    this.currentMenuItems = [];
    this.currentWindow = null;
    this.hasShownCharacterSelection = false;

    // Simplified input handling with async support
    this.latestInput = null;
    this.waitingForInput = false;
    this.waitingForPosition = false;
    this.inputResolver = null;
    this.positionResolver = null;

    // Add cooldown for position requests
    this.lastInputTime = 0;
    this.inputCooldown = 100; // 100ms cooldown

    this.initializeNetHack();
  }

  // Handle incoming input from the client
  handleClientInput(input) {
    console.log("🎮 Received client input:", input);

    // Store the input for potential reuse
    this.latestInput = input;
    this.lastInputTime = Date.now();

    // If we're waiting for general input, resolve the promise immediately
    if (this.waitingForInput && this.inputResolver) {
      console.log("🎮 Resolving waiting input promise with:", input);
      this.waitingForInput = false;
      const resolver = this.inputResolver;
      this.inputResolver = null;
      resolver(this.processKey(input));
      return;
    }

    // If we're waiting for position input, resolve that promise
    if (this.waitingForPosition && this.positionResolver) {
      console.log("🎮 Resolving waiting position promise with:", input);
      this.waitingForPosition = false;
      const resolver = this.positionResolver;
      this.positionResolver = null;
      resolver(this.processKey(input));
      return;
    }

    // Otherwise, just store for later use (for synchronous phases like character creation)
    console.log("🎮 Storing input for later use:", input);
  }

  // Helper method for key processing
  processKey(key) {
    if (key === "ArrowLeft" || key === "h") return "h".charCodeAt(0);
    if (key === "ArrowRight" || key === "l") return "l".charCodeAt(0);
    if (key === "ArrowUp" || key === "k") return "k".charCodeAt(0);
    if (key === "ArrowDown" || key === "j") return "j".charCodeAt(0);
    if (key === "Escape") return 27;
    if (key.length > 0) return key.charCodeAt(0);
    return 0; // Default for empty/unknown input
  }

  async initializeNetHack() {
    try {
      console.log("Starting NetHack session...");
      const factory = require("./public/nethack.js");
      const wasmPath = path.join(__dirname, "public", "nethack.wasm");
      console.log("Loading WASM from:", wasmPath);
      const wasmBinary = fs.readFileSync(wasmPath);
      console.log("WASM binary loaded, size:", wasmBinary.length);

      globalThis.nethackCallback = (name, ...args) => {
        return this.handleUICallback(name, args);
      };

      if (!globalThis.nethackGlobal) {
        console.log("🌐 Setting up globalThis.nethackGlobal...");
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
              if (type === "s" && this.nethackModule) {
                return this.nethackModule.UTF8ToString(ptr);
              }
              return ptr;
            },
          },
          globals: { WIN_MAP: 2, WIN_INVEN: 4, WIN_STATUS: 3, WIN_MESSAGE: 1 },
        };
        console.log("✅ globalThis.nethackGlobal set up");
      }

      const Module = {
        wasmBinary: wasmBinary,
        ENV: { NETHACKOPTIONS: 'pickup_types:$"=/!?+' },
        locateFile: (path, scriptDirectory) => {
          console.log(
            "locateFile called with:",
            path,
            "scriptDirectory:",
            scriptDirectory
          );
          if (path.endsWith(".wasm")) {
            return wasmPath;
          }
          return path;
        },
        preRun: [
          () => {
            console.log("PreRun: Setting up NETHACKOPTIONS");
            Module.ENV.NETHACKOPTIONS = "";
          },
        ],
        onRuntimeInitialized: async () => {
          console.log("NetHack WASM runtime initialized!");
          this.nethackModule = Module;
          try {
            console.log("Setting up graphics callback...");
            await Module.ccall(
              "shim_graphics_set_callback",
              null,
              ["string"],
              ["nethackCallback"],
              { async: true }
            );
            console.log("Graphics callback set up successfully");

            // Don't call main() automatically - wait for it to be called naturally
            console.log("Waiting for NetHack to start naturally...");
          } catch (error) {
            console.error("Error setting up NetHack:", error);
          }
        },
      };

      console.log("Starting NetHack with original factory...");
      this.nethackInstance = await factory(Module);
      console.log(
        "NetHack factory completed, instance:",
        typeof this.nethackInstance
      );
    } catch (error) {
      console.error("Error initializing NetHack:", error);
    }
  }

  handleUICallback(name, args) {
    console.log(`🎮 UI Callback: ${name}`, args);

    const processKey = (key) => {
      return this.processKey(key);
    };

    switch (name) {
      case "shim_get_nh_event":
        // Check if we have recent input available (within input window)
        const timeSinceInput = Date.now() - this.lastInputTime;
        if (this.latestInput && timeSinceInput < this.inputCooldown) {
          const input = this.latestInput;
          this.latestInput = null; // Clear it after use
          console.log(
            `🎮 Reusing recent input for event: ${input} (${timeSinceInput}ms ago)`
          );
          return processKey(input);
        }

        // We're now in gameplay mode - use Asyncify to wait for real user input
        console.log("🎮 Waiting for player input (async)...");
        return new Promise((resolve) => {
          this.inputResolver = resolve;
          this.waitingForInput = true;
          // No timeout - wait for real user input via WebSocket
        });

      case "shim_yn_function":
        const [question, choices, defaultChoice] = args;
        console.log(
          `🤔 Y/N Question: "${question}" choices: "${choices}" default: ${defaultChoice}`
        );

        // Send question to web client with available menu items
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "question",
              text: question,
              choices: choices,
              default: defaultChoice,
              menuItems: this.currentMenuItems,
            })
          );
        }

        // For now, return default but we'll improve this later
        const defaultChar = defaultChoice || "n";
        console.log(`Returning default choice: ${defaultChar}`);

        // Clear menu items after use
        this.currentMenuItems = [];

        return defaultChar.charCodeAt(0);

      case "shim_nh_poskey":
        const [xPtr, yPtr, modPtr] = args;
        console.log("🎮 NetHack requesting position key");

        // Check if we have recent input available (within input window)
        const timeSincePositionInput = Date.now() - this.lastInputTime;
        if (this.latestInput && timeSincePositionInput < this.inputCooldown) {
          const input = this.latestInput;
          // Don't clear it yet - let shim_get_nh_event potentially reuse it
          console.log(
            `🎮 Using recent input for position: ${input} (${timeSincePositionInput}ms ago)`
          );
          return processKey(input);
        }

        // We're now in gameplay mode - use Asyncify to wait for real user input
        console.log("🎮 Waiting for position input (async)...");
        return new Promise((resolve) => {
          this.positionResolver = resolve;
          this.waitingForPosition = true;
          // No timeout - wait for real user input via WebSocket
        });

      case "shim_init_nhwindows":
        console.log("Initializing NetHack windows");
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "name_request",
              text: "What is your name, adventurer?",
              maxLength: 30,
            })
          );
        }
        return 1;
      case "shim_create_nhwindow":
        const [windowType] = args;
        console.log(
          `Creating window [ ${windowType} ] returning ${windowType}`
        );
        return windowType;
      case "shim_status_init":
        console.log("Initializing status display");
        return 0;
      case "shim_start_menu":
        const [menuWinId, menuOptions] = args;
        console.log("NetHack starting menu:", args);
        this.currentMenuItems = [];
        this.currentWindow = menuWinId;
        return 0;
      case "shim_end_menu":
        console.log("NetHack ending menu:", args);
        return 0;
      case "shim_display_nhwindow":
        const [winid, blocking] = args;
        console.log(`🖥️ DISPLAY WINDOW [Win ${winid}], blocking: ${blocking}`);
        return 0;
      case "shim_add_menu":
        const [
          menuWinid,
          menuGlyph,
          accelerator,
          groupacc,
          menuAttr,
          menuStr,
          preselected,
        ] = args;
        const menuChar = String.fromCharCode(accelerator || 32);
        console.log(`📋 MENU ITEM: "${menuStr}" (key: ${menuChar})`);

        // Store menu item for current question
        if (this.currentWindow === menuWinid && menuStr && menuChar.trim()) {
          this.currentMenuItems.push({
            text: menuStr,
            accelerator: menuChar,
            window: menuWinid,
            glyph: menuGlyph,
          });
        }

        // Send menu item to web client
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "menu_item",
              text: menuStr,
              accelerator: menuChar,
              window: menuWinid,
              glyph: menuGlyph,
              menuItems: this.currentMenuItems,
            })
          );
        }

        return 0;
      case "shim_putstr":
        const [win, textAttr, textStr] = args;
        console.log(`💬 TEXT [Win ${win}]: "${textStr}"`);
        this.gameMessages.push({
          text: textStr,
          window: win,
          timestamp: Date.now(),
          attr: textAttr,
        });
        if (this.gameMessages.length > 100) {
          this.gameMessages.shift();
        }
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "text",
              text: textStr,
              window: win,
              attr: textAttr,
            })
          );
        }
        return 0;
      case "shim_print_glyph":
        const [printWin, x, y, printGlyph] = args;
        console.log(`🎨 GLYPH [Win ${printWin}] at (${x},${y}): ${printGlyph}`);
        if (printWin === 3) {
          const key = `${x},${y}`;
          this.gameMap.set(key, {
            x: x,
            y: y,
            glyph: printGlyph,
            timestamp: Date.now(),
          });
          if (this.ws && this.ws.readyState === 1) {
            this.ws.send(
              JSON.stringify({
                type: "map_glyph",
                x: x,
                y: y,
                glyph: printGlyph,
                window: printWin,
              })
            );
          }
          // Comment out automatic character selection prompts for now
          // if (!this.hasShownCharacterSelection) {
          //   this.hasShownCharacterSelection = true;
          //   console.log(
          //     "🎯 Game started - showing interactive character selection"
          //   );
          //   if (this.ws && this.ws.readyState === 1) {
          //     this.ws.send(
          //       JSON.stringify({
          //         type: "question",
          //         text: "Welcome to NetHack! Would you like to create a new character?",
          //         choices: "yn",
          //         default: "y",
          //         menuItems: [
          //           {
          //             accelerator: "y",
          //             text: "Yes - Choose character class and race",
          //           },
          //           {
          //             accelerator: "n",
          //             text: "No - Continue with current character",
          //           },
          //         ],
          //       })
          //     );
          //   }
          // }
        }
        return 0;
      case "shim_player_selection":
        console.log("NetHack player selection started");
        // Comment out character selection UI for automatic play
        // if (this.ws && this.ws.readyState === 1) {
        //   this.ws.send(
        //     JSON.stringify({
        //       type: "question",
        //       text: "Choose your character class:",
        //       choices: "",
        //       default: "",
        //       menuItems: [
        //         { accelerator: "a", text: "Archeologist" },
        //         { accelerator: "b", text: "Barbarian" },
        //         { accelerator: "c", text: "Caveman" },
        //         { accelerator: "h", text: "Healer" },
        //         { accelerator: "k", text: "Knight" },
        //         { accelerator: "m", text: "Monk" },
        //         { accelerator: "p", text: "Priest" },
        //         { accelerator: "r", text: "Rogue" },
        //         { accelerator: "s", text: "Samurai" },
        //         { accelerator: "t", text: "Tourist" },
        //         { accelerator: "v", text: "Valkyrie" },
        //         { accelerator: "w", text: "Wizard" },
        //       ],
        //     })
        //   );
        // }
        return 0;
      case "shim_raw_print":
        const [rawText] = args;
        console.log(`📢 RAW PRINT: "${rawText}"`);
        return 0;
      case "shim_wait_synch":
        console.log("NetHack waiting for synchronization");
        return 0;
      case "shim_select_menu":
        const [menuSelectWinid, menuSelectHow, menuPtr] = args;
        console.log(
          `📋 Menu selection request for window ${menuSelectWinid}, how: ${menuSelectHow}, ptr: ${menuPtr}`
        );

        // Try returning 0 (no selection) to avoid segfault
        console.log("Returning 0 (no selection) to skip this step");
        return 0;

      case "shim_askname":
        console.log("NetHack is asking for player name, args:", args);
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "name_request",
              text: "What is your name?",
              maxLength: 30,
            })
          );
        }

        if (this.latestInput) {
          const name = this.latestInput;
          this.latestInput = null;
          console.log(`Using player name from input: ${name}`);
          return name;
        }

        console.log("No name provided, using default");
        return "Player";
      case "shim_mark_synch":
        console.log("NetHack marking synchronization");
        return 0;

      case "shim_getmsghistory":
        const [init] = args;
        console.log(`Getting message history, init: ${init}`);
        // Return empty string for message history
        return "";

      case "shim_putmsghistory":
        const [msg, is_restoring] = args;
        console.log(
          `Putting message history: "${msg}", restoring: ${is_restoring}`
        );
        return 0;

      case "shim_exit_nhwindows":
        console.log("Exiting NetHack windows");
        return 0;
      default:
        console.log(`Unknown callback: ${name}`, args);
        return 0;
    }
  }
}

// HTTP Server for serving static files
const server = http.createServer((req, res) => {
  let filePath = req.url === "/" ? "/index.html" : req.url;
  const extname = path.extname(filePath);

  let contentType = "text/html";
  switch (extname) {
    case ".js":
      contentType = "text/javascript";
      break;
    case ".css":
      contentType = "text/css";
      break;
    case ".json":
      contentType = "application/json";
      break;
    case ".png":
      contentType = "image/png";
      break;
    case ".jpg":
      contentType = "image/jpg";
      break;
    case ".wav":
      contentType = "audio/wav";
      break;
  }

  const fullPath = path.join(__dirname, "public", filePath);

  fs.readFile(fullPath, (error, content) => {
    if (error) {
      if (error.code == "ENOENT") {
        res.writeHead(404);
        res.end("404 - File Not Found");
      } else {
        res.writeHead(500);
        res.end("500 - Internal Server Error");
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

// WebSocket Server
const wss = new WebSocket.Server({ server });
let sessionCount = 0;

wss.on("connection", (ws) => {
  console.log("New WebSocket connection");
  sessionCount++;

  const session = new NetHackSession(ws);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Received:", data);

      if (data.type === "input") {
        session.handleClientInput(data.input);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
    sessionCount--;
  });
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`NetHack 3D Server running on http://localhost:${PORT}`);
  console.log(`Game sessions: ${sessionCount}`);
});
