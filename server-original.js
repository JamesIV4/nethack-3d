const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

class NetHackSession {
  constructor(ws) {
    this.ws = ws;
    this.nethackInstance = null;
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
        console.log("NetHack starting menu:", args);
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

        // Send this to the web client
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "menu_item",
              text: menuStr,
              accelerator: menuChar,
              window: menuWinid,
            })
          );
        }

        return 0;

      case "shim_putstr":
        const [win, textAttr, textStr] = args;
        console.log(`💬 TEXT [Win ${win}]: "${textStr}"`);

        // Send text to web client
        if (this.ws && this.ws.readyState === 1) {
          this.ws.send(
            JSON.stringify({
              type: "text",
              text: textStr,
              window: win,
            })
          );
        }

        return 0;

      case "shim_print_glyph":
        const [printWin, x, y, printGlyph] = args;
        console.log(`🎨 GLYPH [Win ${printWin}] at (${x},${y}): ${printGlyph}`);
        return 0;

      case "shim_get_nh_event":
        console.log("Getting NetHack event");
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
    if (this.nethackModule && this.nethackModule.ccall) {
      try {
        // Try to send input to NetHack
        this.nethackModule.ccall("shim_input_available", null, [], []);
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
