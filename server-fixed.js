const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

class NetHackSession {
  constructor(ws) {
    this.ws = ws;
    this.nethackInstance = null;
    this.nethackModule = null;
    this.initializeNetHack();
  }

  setupGlobalNethackContext() {
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
  }

  async initializeNetHack() {
    try {
      console.log("Starting NetHack session...");

      // Load the NetHack WASM factory
      const factory = require("./public/nethack.js");
      const wasmPath = path.join(__dirname, "public", "nethack.wasm");

      console.log("Loading WASM from:", wasmPath);
      const wasmBinary = fs.readFileSync(wasmPath);
      console.log("WASM binary loaded, size:", wasmBinary.length);

      // Set up global callback first
      globalThis.nethackCallback = (name, ...args) => {
        return this.handleUICallback(name, args);
      };

      // Configure the module like the original package does
      const Module = {
        wasmBinary: wasmBinary,
        ENV: {
          NETHACKOPTIONS: "name:Player",
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
        onRuntimeInitialized: () => {
          console.log("NetHack WASM runtime initialized!");

          this.nethackModule = Module;
          this.setupGlobalNethackContext();

          // Set up graphics callback like the original package
          try {
            Module.ccall(
              "shim_graphics_set_callback",
              null,
              ["string"],
              ["nethackCallback"],
              { async: true }
            );
            console.log("Graphics callback set up successfully");
          } catch (error) {
            console.error("Error setting up graphics callback:", error);
          }

          // Start NetHack main - no async to avoid segfault
          console.log("Starting NetHack main...");
          try {
            Module.ccall("main", "number", [], []);
            console.log("NetHack main started successfully");
          } catch (error) {
            console.error("Error starting NetHack main:", error);
          }
        },
      };

      // Load and run the module
      console.log("Starting NetHack with factory...");
      this.nethackInstance = await factory(Module);
      console.log("NetHack factory completed");
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
          `creating window [ ${windowType} ] returning ${windowType}`
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
        this.readWindowContent(winid);
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
        console.log(
          `📋 MENU ITEM: "${menuStr}" (key: ${String.fromCharCode(
            accelerator || 32
          )})`
        );
        return 0;

      case "shim_select_menu":
        console.log("Menu selection request");
        return 1;

      case "shim_putstr":
        const [win, textAttr, textStr] = args;
        console.log(`💬 TEXT [Win ${win}]: "${textStr}"`);
        return 0;

      case "shim_print_glyph":
        const [printWin, x, y, printGlyph] = args;
        console.log(`🎨 GLYPH [Win ${printWin}] at (${x},${y}): ${printGlyph}`);
        return 0;

      case "shim_get_nh_event":
        console.log("Getting NetHack event");
        return 0;

      case "shim_exit_nhwindows":
        console.log("Exiting NetHack windows");
        return 0;

      default:
        console.log(`Unknown callback: ${name}`, args);
        return 0;
    }
  }

  readWindowContent(winid) {
    console.log(`📖 Reading content of window ${winid}...`);
    console.log(`📖 Attempting to read content of window ${winid}...`);

    if (!this.nethackModule) {
      console.log("❓ No nethackModule available for reading window content");
      return;
    }

    // Try to find window content reading functions
    const possibleFunctions = Object.getOwnPropertyNames(
      this.nethackModule
    ).filter(
      (name) =>
        name.includes("window") ||
        name.includes("text") ||
        name.includes("str") ||
        name.includes("content")
    );

    console.log(
      `   🔍 Available module functions:`,
      possibleFunctions.slice(0, 3)
    );
    console.log(`❓ No content found for window ${winid}`);
  }

  sendInput(input) {
    console.log("Sending input:", input);
    // TODO: Implement input sending
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
