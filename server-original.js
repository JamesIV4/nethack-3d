const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

class NetHackSession {
  constructor(ws) {
    this.ws = ws;
    this.nethackInstance = null;
    this.gameMap = new Map(); // Store map glyphs by coordinates
    this.playerPosition = { x: 0, y: 0 };
    this.gameMessages = [];
    this.pendingInput = null; // Store pending input for callbacks
    this.waitingForInput = false; // Flag to indicate if we're waiting for user input
    this.currentMenuItems = []; // Store current menu items
    this.currentWindow = null; // Track current window for menu items
    this.initializeNetHack();
  }

  async initializeNetHack() {
    try {
      console.log("Starting NetHack session with original package files...");

      // Use the original package files directly
      const factory = require("./public/nethack-original.js");
      const wasmPath = path.join(__dirname, "public", "nethack-original.wasm");

      console.log("Loading original WASM from:", wasmPath);
      const wasmBinary = fs.readFileSync(wasmPath);
      console.log("Original WASM binary loaded, size:", wasmBinary.length);

      // Set up global callback first
      globalThis.nethackCallback = (name, ...args) => {
        return this.handleUICallback(name, args);
      };

      // Set up globalThis.nethackGlobal like the original expects
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
          globals: {
            WIN_MAP: 2,
            WIN_INVEN: 4,
            WIN_STATUS: 3,
            WIN_MESSAGE: 1,
          },
        };
        console.log("✅ globalThis.nethackGlobal set up");
      }

      // Configure the module exactly like the original package does
      const Module = {
        wasmBinary: wasmBinary,
        ENV: {
          NETHACKOPTIONS: "",
        },
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
        onRuntimeInitialized: () => {
          console.log("NetHack WASM runtime initialized!");

          this.nethackModule = Module;

          // Set up graphics callback exactly like the original package
          try {
            console.log("Setting up graphics callback...");
            Module.ccall(
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
            console.error("Error setting up graphics callback:", error);
          }
        },
      };

      // Load and run the module
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

    switch (name) {
      case "shim_init_nhwindows":
        console.log("Initializing NetHack windows");
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

        // Clear previous menu items for this window
        this.currentMenuItems = [];
        this.currentWindow = menuWinId;

        return 0;

      case "shim_end_menu":
        console.log("NetHack ending menu:", args);
        // Menu is ending - current items are ready
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
            })
          );
        }

        return 0;

      case "shim_putstr":
        const [win, textAttr, textStr] = args;
        console.log(`💬 TEXT [Win ${win}]: "${textStr}"`);

        // Store messages for the game log
        this.gameMessages.push({
          text: textStr,
          window: win,
          timestamp: Date.now(),
          attr: textAttr,
        });

        // Keep only last 100 messages
        if (this.gameMessages.length > 100) {
          this.gameMessages.shift();
        }

        // Send text to web client
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

        // Store map data for the 3D visualization
        if (printWin === 3) {
          // WIN_MAP
          const key = `${x},${y}`;
          this.gameMap.set(key, {
            x: x,
            y: y,
            glyph: printGlyph,
            timestamp: Date.now(),
          });

          // Send map update to client
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
        }

        return 0;

      case "shim_get_nh_event":
        console.log("Getting NetHack event");

        // If we have pending input, return it as a key event
        if (this.pendingInput) {
          const input = this.pendingInput;
          this.pendingInput = null;
          console.log(
            `Returning input event: ${input} (${input.charCodeAt(0)})`
          );
          return input.charCodeAt(0);
        }

        // Return a simple event to keep things moving
        return 0;

      case "shim_player_selection":
        console.log("NetHack player selection started");
        return 0;

      case "shim_raw_print":
        const [rawText] = args;
        console.log(`📢 RAW PRINT: "${rawText}"`);
        return 0;

      case "shim_wait_synch":
        console.log("NetHack waiting for synchronization");
        return 0;

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

        // If we have pending input, use it
        if (this.pendingInput) {
          const input = this.pendingInput;
          this.pendingInput = null;
          this.waitingForInput = false;
          console.log(`Using pending input: ${input}`);

          // Clear menu items after use
          this.currentMenuItems = [];

          return input.charCodeAt(0);
        }

        // Otherwise wait for input
        this.waitingForInput = true;
        console.log("Waiting for user input...");

        // Return default for now (this will be handled by the input system)
        return defaultChoice || "n".charCodeAt(0);

      case "shim_nh_poskey":
        const [xPtr, yPtr, modPtr] = args;
        console.log(
          `🖱️ Position key request at pointers: ${xPtr}, ${yPtr}, ${modPtr}`
        );

        // If we have pending input, use it
        if (this.pendingInput) {
          const input = this.pendingInput;
          this.pendingInput = null;
          this.waitingForInput = false;
          console.log(`Using pending input for position: ${input}`);
          return input.charCodeAt(0);
        }

        // Send position request to client
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "position_request",
              text: "Select a position (or press Escape to cancel)",
            })
          );
        }

        // Return Escape key to cancel position selection by default
        // This is safer than 'q' which triggers drinking!
        return 27; // Escape key

      case "shim_select_menu":
        const [menuSelectWinid, menuSelectHow, menuPtr] = args;
        console.log(
          `📋 Menu selection request for window ${menuSelectWinid}, how: ${menuSelectHow}, ptr: ${menuPtr}`
        );

        // Try returning 0 (no selection) to avoid segfault
        console.log("Returning 0 (no selection) to skip this step");
        return 0;

      case "shim_getmsghistory":
        const [init] = args;
        console.log(`Getting message history, init: ${init}`);
        // Return empty string for message history
        return "";

      case "shim_putmsghistory":
        const [msg, attr] = args;
        console.log(`Put message history: "${msg}", attr: ${attr}`);
        return 0;

      case "shim_mark_synch":
        console.log("Mark synchronization");
        return 0;

      case "shim_destroy_nhwindow":
        const [destroyWin] = args;
        console.log(`Destroying window ${destroyWin}`);
        return 0;

      case "shim_clear_nhwindow":
        const [clearWin] = args;
        console.log(`Clearing window ${clearWin}`);
        return 0;

      case "shim_curs":
        const [cursWin, cursX, cursY] = args;
        console.log(
          `Setting cursor in window ${cursWin} to (${cursX}, ${cursY})`
        );

        // Track player position
        if (cursWin === 3) {
          // WIN_MAP
          this.playerPosition = { x: cursX, y: cursY };

          // Send player position to client
          if (this.ws && this.ws.readyState === 1) {
            this.ws.send(
              JSON.stringify({
                type: "player_position",
                x: cursX,
                y: cursY,
              })
            );
          }
        }

        return 0;

      case "shim_cliparound":
        const [clipX, clipY] = args;
        console.log(`Clipping around (${clipX}, ${clipY})`);
        return 0;

      case "shim_status_update":
        const [field, ptr, chg, percent, color, colormasks] = args;
        console.log(`Status update field ${field}, ptr: ${ptr}`);
        return 0;

      case "shim_askname":
        console.log("NetHack is asking for player name, args:", args);
        // Simply return a string name - this should work for askname
        console.log("Returning player name: 'Adventurer'");
        return "Adventurer";

      case "shim_exit_nhwindows":
        console.log("Exiting NetHack windows");
        return 0;

      default:
        console.log(`Unknown callback: ${name}`, args);
        return 0;
    }
  }

  sendInput(input) {
    console.log("Sending input:", input);

    // Store the input for use in callbacks
    this.pendingInput = input;
    this.waitingForInput = false;

    if (this.nethackModule && this.nethackModule.ccall) {
      try {
        // Convert input to character code
        const charCode = input.charCodeAt(0);
        console.log(`Sending character code: ${charCode} for '${input}'`);

        // Try different input methods
        try {
          // Try the main input method
          this.nethackModule.ccall("shim_input_available", null, [], []);
        } catch (error1) {
          console.log(
            "shim_input_available failed, trying alternative:",
            error1
          );

          // Try to trigger NetHack to continue processing
          try {
            this.nethackModule.ccall("main", null, [], []);
          } catch (error2) {
            console.log("main() also failed:", error2);
          }
        }
      } catch (error) {
        console.log("Error sending input:", error);
      }
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
        session.sendInput(data.input);
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
