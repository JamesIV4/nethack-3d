// Simple test to see if nethack can initialize using the public folder files
const path = require("path");

// Add fetch polyfill if not available
if (!globalThis.fetch) {
  const fetch = require("node-fetch");
  globalThis.fetch = fetch;
}

// Use the public folder's nethack.js instead of the npm package
const publicPath = path.join(__dirname, "public");
const nethackFactory = require(path.join(publicPath, "nethack.js"));

console.log("Starting NetHack test...");

function testCallback(name, ...args) {
  console.log(`NetHack callback: ${name}`, args);

  switch (name) {
    case "shim_create_nhwindow":
      console.log("Creating window, returning 1");
      return 1;
    case "shim_yn_function":
    case "shim_message_menu":
      console.log("Yes/no question, returning 'y'");
      return 121; // return 'y' to all questions
    case "shim_nhgetch":
    case "shim_nh_poskey":
      console.log("Getting key, returning 0");
      return 0; // simulates a mouse click on "exit up the stairs"
    default:
      console.log("Default case, returning 0");
      return 0;
  }
}

try {
  console.log("Creating Module...");
  const fs = require("fs");

  // Load the WASM file manually
  const wasmPath = path.join(__dirname, "public", "nethack.wasm");
  console.log("Loading WASM from:", wasmPath);
  const wasmBinary = fs.readFileSync(wasmPath);
  console.log("WASM binary loaded, size:", wasmBinary.length);

  // Configure module to use the pre-loaded WASM
  const Module = {
    wasmBinary: wasmBinary,
    locateFile: function (path, scriptDirectory) {
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
    onRuntimeInitialized: function () {
      console.log("NetHack WASM runtime initialized!");
    },
  };

  console.log("Starting NetHack with factory...");
  const instance = nethackFactory(Module);
  console.log("NetHack factory called, instance:", typeof instance);
} catch (error) {
  console.error("Error starting NetHack:", error);
}
