// src/game/Nethack3DEngine.ts
import * as THREE from "./three.module.js";

// src/runtime/LocalNetHackRuntime.ts
var process = typeof globalThis !== "undefined" && globalThis.process ? globalThis.process : { env: {} };

// src/runtime/WorkerRuntimeBridge.ts
var WorkerRuntimeBridge = class {
  constructor(onEvent) {
    this.startPromise = null;
    this.startResolve = null;
    this.startReject = null;
    this.onEvent = onEvent;
    this.worker = new Worker("runtime-worker.js");
    this.worker.onmessage = (message) => {
      this.handleWorkerMessage(message.data);
    };
    this.worker.onerror = (error) => {
      if (this.startReject) {
        this.startReject(error);
      }
      console.error("Runtime worker error:", error);
    };
  }
  start() {
    if (this.startPromise) {
      return this.startPromise;
    }
    this.startPromise = new Promise((resolve, reject) => {
      this.startResolve = resolve;
      this.startReject = reject;
      this.postCommand({ type: "start" });
    });
    return this.startPromise;
  }
  sendInput(input) {
    this.postCommand({ type: "send_input", input });
  }
  requestTileUpdate(x, y) {
    this.postCommand({ type: "request_tile_update", x, y });
  }
  requestAreaUpdate(centerX, centerY, radius) {
    this.postCommand({
      type: "request_area_update",
      centerX,
      centerY,
      radius
    });
  }
  postCommand(command) {
    this.worker.postMessage(command);
  }
  handleWorkerMessage(message) {
    switch (message.type) {
      case "runtime_ready":
        if (this.startResolve) {
          this.startResolve();
          this.startResolve = null;
          this.startReject = null;
        }
        break;
      case "runtime_error":
        if (this.startReject) {
          this.startReject(new Error(message.error));
          this.startResolve = null;
          this.startReject = null;
        } else {
          console.error("Runtime error:", message.error);
        }
        break;
      case "runtime_event":
        this.onEvent(message.event);
        break;
      default:
        break;
    }
  }
};

// src/game/constants.ts
var TILE_SIZE = 1;
var WALL_HEIGHT = 1;

// src/game/glyphs/overrides.ts
var glyphOverrides = /* @__PURE__ */ new Map();
var kindOverrides = /* @__PURE__ */ new Map();
function setGlyphOverride(glyph, override) {
  glyphOverrides.set(glyph, { ...override });
}
function clearGlyphOverride(glyph) {
  glyphOverrides.delete(glyph);
}
function setGlyphKindOverride(kind, override) {
  kindOverrides.set(kind, { ...override });
}
function clearGlyphKindOverride(kind) {
  kindOverrides.delete(kind);
}
function getMergedGlyphOverride(glyph, kind) {
  const byKind = kindOverrides.get(kind);
  const byGlyph = glyphOverrides.get(glyph);
  if (!byKind && !byGlyph) {
    return null;
  }
  return {
    ...byKind || {},
    ...byGlyph || {}
  };
}
function clearAllGlyphOverrides() {
  glyphOverrides.clear();
  kindOverrides.clear();
}
function getAllGlyphOverrides() {
  const byGlyph = {};
  const byKind = {};
  for (const [glyph, override] of glyphOverrides.entries()) {
    byGlyph[glyph] = { ...override };
  }
  for (const [kind, override] of kindOverrides.entries()) {
    byKind[kind] = { ...override };
  }
  return { byGlyph, byKind };
}

// src/game/glyphs/glyph-catalog.generated.ts
var GLYPH_CATALOG = [
  { glyph: 0, kind: "mon", ch: 97, color: 8, special: 0 },
  { glyph: 1, kind: "mon", ch: 97, color: 8, special: 0 },
  { glyph: 2, kind: "mon", ch: 97, color: 8, special: 0 },
  { glyph: 3, kind: "mon", ch: 97, color: 8, special: 0 },
  { glyph: 4, kind: "mon", ch: 97, color: 8, special: 0 },
  { glyph: 5, kind: "mon", ch: 97, color: 8, special: 0 },
  { glyph: 6, kind: "mon", ch: 98, color: 8, special: 0 },
  { glyph: 7, kind: "mon", ch: 98, color: 8, special: 0 },
  { glyph: 8, kind: "mon", ch: 98, color: 8, special: 0 },
  { glyph: 9, kind: "mon", ch: 99, color: 8, special: 0 },
  { glyph: 10, kind: "mon", ch: 99, color: 8, special: 0 },
  { glyph: 11, kind: "mon", ch: 99, color: 8, special: 0 },
  { glyph: 12, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 13, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 14, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 15, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 16, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 17, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 18, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 19, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 20, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 21, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 22, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 23, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 24, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 25, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 26, kind: "mon", ch: 100, color: 8, special: 0 },
  { glyph: 27, kind: "mon", ch: 101, color: 8, special: 0 },
  { glyph: 28, kind: "mon", ch: 101, color: 8, special: 0 },
  { glyph: 29, kind: "mon", ch: 101, color: 8, special: 0 },
  { glyph: 30, kind: "mon", ch: 101, color: 8, special: 0 },
  { glyph: 31, kind: "mon", ch: 101, color: 8, special: 0 },
  { glyph: 32, kind: "mon", ch: 102, color: 8, special: 0 },
  { glyph: 33, kind: "mon", ch: 102, color: 8, special: 0 },
  { glyph: 34, kind: "mon", ch: 102, color: 8, special: 0 },
  { glyph: 35, kind: "mon", ch: 102, color: 8, special: 0 },
  { glyph: 36, kind: "mon", ch: 102, color: 8, special: 0 },
  { glyph: 37, kind: "mon", ch: 102, color: 8, special: 0 },
  { glyph: 38, kind: "mon", ch: 102, color: 8, special: 0 },
  { glyph: 39, kind: "mon", ch: 102, color: 8, special: 0 },
  { glyph: 40, kind: "mon", ch: 103, color: 8, special: 0 },
  { glyph: 41, kind: "mon", ch: 103, color: 8, special: 0 },
  { glyph: 42, kind: "mon", ch: 103, color: 8, special: 0 },
  { glyph: 43, kind: "mon", ch: 104, color: 8, special: 0 },
  { glyph: 44, kind: "mon", ch: 104, color: 8, special: 0 },
  { glyph: 45, kind: "mon", ch: 104, color: 8, special: 0 },
  { glyph: 46, kind: "mon", ch: 104, color: 8, special: 0 },
  { glyph: 47, kind: "mon", ch: 104, color: 8, special: 0 },
  { glyph: 48, kind: "mon", ch: 104, color: 8, special: 0 },
  { glyph: 49, kind: "mon", ch: 104, color: 8, special: 0 },
  { glyph: 50, kind: "mon", ch: 105, color: 8, special: 0 },
  { glyph: 51, kind: "mon", ch: 105, color: 8, special: 0 },
  { glyph: 52, kind: "mon", ch: 105, color: 8, special: 0 },
  { glyph: 53, kind: "mon", ch: 105, color: 8, special: 0 },
  { glyph: 54, kind: "mon", ch: 105, color: 8, special: 0 },
  { glyph: 55, kind: "mon", ch: 105, color: 8, special: 0 },
  { glyph: 56, kind: "mon", ch: 106, color: 8, special: 0 },
  { glyph: 57, kind: "mon", ch: 106, color: 8, special: 0 },
  { glyph: 58, kind: "mon", ch: 106, color: 8, special: 0 },
  { glyph: 59, kind: "mon", ch: 107, color: 8, special: 0 },
  { glyph: 60, kind: "mon", ch: 107, color: 8, special: 0 },
  { glyph: 61, kind: "mon", ch: 107, color: 8, special: 0 },
  { glyph: 62, kind: "mon", ch: 107, color: 8, special: 0 },
  { glyph: 63, kind: "mon", ch: 108, color: 8, special: 0 },
  { glyph: 64, kind: "mon", ch: 109, color: 8, special: 0 },
  { glyph: 65, kind: "mon", ch: 109, color: 8, special: 0 },
  { glyph: 66, kind: "mon", ch: 109, color: 8, special: 0 },
  { glyph: 67, kind: "mon", ch: 110, color: 8, special: 0 },
  { glyph: 68, kind: "mon", ch: 110, color: 8, special: 0 },
  { glyph: 69, kind: "mon", ch: 110, color: 8, special: 0 },
  { glyph: 70, kind: "mon", ch: 111, color: 8, special: 0 },
  { glyph: 71, kind: "mon", ch: 111, color: 8, special: 0 },
  { glyph: 72, kind: "mon", ch: 111, color: 8, special: 0 },
  { glyph: 73, kind: "mon", ch: 111, color: 8, special: 0 },
  { glyph: 74, kind: "mon", ch: 111, color: 8, special: 0 },
  { glyph: 75, kind: "mon", ch: 111, color: 8, special: 0 },
  { glyph: 76, kind: "mon", ch: 111, color: 8, special: 0 },
  { glyph: 77, kind: "mon", ch: 111, color: 8, special: 0 },
  { glyph: 78, kind: "mon", ch: 112, color: 8, special: 0 },
  { glyph: 79, kind: "mon", ch: 112, color: 8, special: 0 },
  { glyph: 80, kind: "mon", ch: 112, color: 8, special: 0 },
  { glyph: 81, kind: "mon", ch: 113, color: 8, special: 0 },
  { glyph: 82, kind: "mon", ch: 113, color: 8, special: 0 },
  { glyph: 83, kind: "mon", ch: 113, color: 8, special: 0 },
  { glyph: 84, kind: "mon", ch: 113, color: 8, special: 0 },
  { glyph: 85, kind: "mon", ch: 113, color: 8, special: 0 },
  { glyph: 86, kind: "mon", ch: 113, color: 8, special: 0 },
  { glyph: 87, kind: "mon", ch: 113, color: 8, special: 0 },
  { glyph: 88, kind: "mon", ch: 114, color: 8, special: 0 },
  { glyph: 89, kind: "mon", ch: 114, color: 8, special: 0 },
  { glyph: 90, kind: "mon", ch: 114, color: 8, special: 0 },
  { glyph: 91, kind: "mon", ch: 114, color: 8, special: 0 },
  { glyph: 92, kind: "mon", ch: 114, color: 8, special: 0 },
  { glyph: 93, kind: "mon", ch: 114, color: 8, special: 0 },
  { glyph: 94, kind: "mon", ch: 115, color: 8, special: 0 },
  { glyph: 95, kind: "mon", ch: 115, color: 8, special: 0 },
  { glyph: 96, kind: "mon", ch: 115, color: 8, special: 0 },
  { glyph: 97, kind: "mon", ch: 115, color: 8, special: 0 },
  { glyph: 98, kind: "mon", ch: 116, color: 8, special: 0 },
  { glyph: 99, kind: "mon", ch: 116, color: 8, special: 0 },
  { glyph: 100, kind: "mon", ch: 117, color: 8, special: 0 },
  { glyph: 101, kind: "mon", ch: 117, color: 8, special: 0 },
  { glyph: 102, kind: "mon", ch: 117, color: 8, special: 0 },
  { glyph: 103, kind: "mon", ch: 117, color: 8, special: 0 },
  { glyph: 104, kind: "mon", ch: 117, color: 8, special: 0 },
  { glyph: 105, kind: "mon", ch: 117, color: 8, special: 0 },
  { glyph: 106, kind: "mon", ch: 118, color: 8, special: 0 },
  { glyph: 107, kind: "mon", ch: 118, color: 8, special: 0 },
  { glyph: 108, kind: "mon", ch: 118, color: 8, special: 0 },
  { glyph: 109, kind: "mon", ch: 118, color: 8, special: 0 },
  { glyph: 110, kind: "mon", ch: 118, color: 8, special: 0 },
  { glyph: 111, kind: "mon", ch: 118, color: 8, special: 0 },
  { glyph: 112, kind: "mon", ch: 119, color: 8, special: 0 },
  { glyph: 113, kind: "mon", ch: 119, color: 8, special: 0 },
  { glyph: 114, kind: "mon", ch: 119, color: 8, special: 0 },
  { glyph: 115, kind: "mon", ch: 119, color: 8, special: 0 },
  { glyph: 116, kind: "mon", ch: 120, color: 8, special: 0 },
  { glyph: 117, kind: "mon", ch: 120, color: 8, special: 0 },
  { glyph: 118, kind: "mon", ch: 121, color: 8, special: 0 },
  { glyph: 119, kind: "mon", ch: 121, color: 8, special: 0 },
  { glyph: 120, kind: "mon", ch: 122, color: 8, special: 0 },
  { glyph: 121, kind: "mon", ch: 65, color: 8, special: 0 },
  { glyph: 122, kind: "mon", ch: 65, color: 8, special: 0 },
  { glyph: 123, kind: "mon", ch: 65, color: 8, special: 0 },
  { glyph: 124, kind: "mon", ch: 65, color: 8, special: 0 },
  { glyph: 125, kind: "mon", ch: 65, color: 8, special: 0 },
  { glyph: 126, kind: "mon", ch: 66, color: 8, special: 0 },
  { glyph: 127, kind: "mon", ch: 66, color: 8, special: 0 },
  { glyph: 128, kind: "mon", ch: 66, color: 8, special: 0 },
  { glyph: 129, kind: "mon", ch: 66, color: 8, special: 0 },
  { glyph: 130, kind: "mon", ch: 67, color: 8, special: 0 },
  { glyph: 131, kind: "mon", ch: 67, color: 8, special: 0 },
  { glyph: 132, kind: "mon", ch: 67, color: 8, special: 0 },
  { glyph: 133, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 134, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 135, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 136, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 137, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 138, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 139, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 140, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 141, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 142, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 143, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 144, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 145, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 146, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 147, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 148, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 149, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 150, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 151, kind: "mon", ch: 69, color: 8, special: 0 },
  { glyph: 152, kind: "mon", ch: 69, color: 8, special: 0 },
  { glyph: 153, kind: "mon", ch: 69, color: 8, special: 0 },
  { glyph: 154, kind: "mon", ch: 69, color: 8, special: 0 },
  { glyph: 155, kind: "mon", ch: 69, color: 8, special: 0 },
  { glyph: 156, kind: "mon", ch: 70, color: 8, special: 0 },
  { glyph: 157, kind: "mon", ch: 70, color: 8, special: 0 },
  { glyph: 158, kind: "mon", ch: 70, color: 8, special: 0 },
  { glyph: 159, kind: "mon", ch: 70, color: 8, special: 0 },
  { glyph: 160, kind: "mon", ch: 70, color: 8, special: 0 },
  { glyph: 161, kind: "mon", ch: 70, color: 8, special: 0 },
  { glyph: 162, kind: "mon", ch: 70, color: 8, special: 0 },
  { glyph: 163, kind: "mon", ch: 71, color: 8, special: 0 },
  { glyph: 164, kind: "mon", ch: 71, color: 8, special: 0 },
  { glyph: 165, kind: "mon", ch: 71, color: 8, special: 0 },
  { glyph: 166, kind: "mon", ch: 71, color: 8, special: 0 },
  { glyph: 167, kind: "mon", ch: 72, color: 8, special: 0 },
  { glyph: 168, kind: "mon", ch: 72, color: 8, special: 0 },
  { glyph: 169, kind: "mon", ch: 72, color: 8, special: 0 },
  { glyph: 170, kind: "mon", ch: 72, color: 8, special: 0 },
  { glyph: 171, kind: "mon", ch: 72, color: 8, special: 0 },
  { glyph: 172, kind: "mon", ch: 72, color: 8, special: 0 },
  { glyph: 173, kind: "mon", ch: 72, color: 8, special: 0 },
  { glyph: 174, kind: "mon", ch: 72, color: 8, special: 0 },
  { glyph: 175, kind: "mon", ch: 72, color: 8, special: 0 },
  { glyph: 176, kind: "mon", ch: 74, color: 8, special: 0 },
  { glyph: 177, kind: "mon", ch: 75, color: 8, special: 0 },
  { glyph: 178, kind: "mon", ch: 75, color: 8, special: 0 },
  { glyph: 179, kind: "mon", ch: 75, color: 8, special: 0 },
  { glyph: 180, kind: "mon", ch: 75, color: 8, special: 0 },
  { glyph: 181, kind: "mon", ch: 76, color: 8, special: 0 },
  { glyph: 182, kind: "mon", ch: 76, color: 8, special: 0 },
  { glyph: 183, kind: "mon", ch: 76, color: 8, special: 0 },
  { glyph: 184, kind: "mon", ch: 76, color: 8, special: 0 },
  { glyph: 185, kind: "mon", ch: 77, color: 8, special: 0 },
  { glyph: 186, kind: "mon", ch: 77, color: 8, special: 0 },
  { glyph: 187, kind: "mon", ch: 77, color: 8, special: 0 },
  { glyph: 188, kind: "mon", ch: 77, color: 8, special: 0 },
  { glyph: 189, kind: "mon", ch: 77, color: 8, special: 0 },
  { glyph: 190, kind: "mon", ch: 77, color: 8, special: 0 },
  { glyph: 191, kind: "mon", ch: 77, color: 8, special: 0 },
  { glyph: 192, kind: "mon", ch: 77, color: 8, special: 0 },
  { glyph: 193, kind: "mon", ch: 78, color: 8, special: 0 },
  { glyph: 194, kind: "mon", ch: 78, color: 8, special: 0 },
  { glyph: 195, kind: "mon", ch: 78, color: 8, special: 0 },
  { glyph: 196, kind: "mon", ch: 78, color: 8, special: 0 },
  { glyph: 197, kind: "mon", ch: 78, color: 8, special: 0 },
  { glyph: 198, kind: "mon", ch: 78, color: 8, special: 0 },
  { glyph: 199, kind: "mon", ch: 78, color: 8, special: 0 },
  { glyph: 200, kind: "mon", ch: 78, color: 8, special: 0 },
  { glyph: 201, kind: "mon", ch: 79, color: 8, special: 0 },
  { glyph: 202, kind: "mon", ch: 79, color: 8, special: 0 },
  { glyph: 203, kind: "mon", ch: 79, color: 8, special: 0 },
  { glyph: 204, kind: "mon", ch: 80, color: 8, special: 0 },
  { glyph: 205, kind: "mon", ch: 80, color: 8, special: 0 },
  { glyph: 206, kind: "mon", ch: 80, color: 8, special: 0 },
  { glyph: 207, kind: "mon", ch: 80, color: 8, special: 0 },
  { glyph: 208, kind: "mon", ch: 81, color: 8, special: 0 },
  { glyph: 209, kind: "mon", ch: 81, color: 8, special: 0 },
  { glyph: 210, kind: "mon", ch: 82, color: 8, special: 0 },
  { glyph: 211, kind: "mon", ch: 82, color: 8, special: 0 },
  { glyph: 212, kind: "mon", ch: 83, color: 8, special: 0 },
  { glyph: 213, kind: "mon", ch: 83, color: 8, special: 0 },
  { glyph: 214, kind: "mon", ch: 83, color: 8, special: 0 },
  { glyph: 215, kind: "mon", ch: 83, color: 8, special: 0 },
  { glyph: 216, kind: "mon", ch: 83, color: 8, special: 0 },
  { glyph: 217, kind: "mon", ch: 83, color: 8, special: 0 },
  { glyph: 218, kind: "mon", ch: 84, color: 8, special: 0 },
  { glyph: 219, kind: "mon", ch: 84, color: 8, special: 0 },
  { glyph: 220, kind: "mon", ch: 84, color: 8, special: 0 },
  { glyph: 221, kind: "mon", ch: 84, color: 8, special: 0 },
  { glyph: 222, kind: "mon", ch: 84, color: 8, special: 0 },
  { glyph: 223, kind: "mon", ch: 85, color: 8, special: 0 },
  { glyph: 224, kind: "mon", ch: 86, color: 8, special: 0 },
  { glyph: 225, kind: "mon", ch: 86, color: 8, special: 0 },
  { glyph: 226, kind: "mon", ch: 86, color: 8, special: 0 },
  { glyph: 227, kind: "mon", ch: 87, color: 8, special: 0 },
  { glyph: 228, kind: "mon", ch: 87, color: 8, special: 0 },
  { glyph: 229, kind: "mon", ch: 87, color: 8, special: 0 },
  { glyph: 230, kind: "mon", ch: 88, color: 8, special: 0 },
  { glyph: 231, kind: "mon", ch: 89, color: 8, special: 0 },
  { glyph: 232, kind: "mon", ch: 89, color: 8, special: 0 },
  { glyph: 233, kind: "mon", ch: 89, color: 8, special: 0 },
  { glyph: 234, kind: "mon", ch: 89, color: 8, special: 0 },
  { glyph: 235, kind: "mon", ch: 89, color: 8, special: 0 },
  { glyph: 236, kind: "mon", ch: 89, color: 8, special: 0 },
  { glyph: 237, kind: "mon", ch: 90, color: 8, special: 0 },
  { glyph: 238, kind: "mon", ch: 90, color: 8, special: 0 },
  { glyph: 239, kind: "mon", ch: 90, color: 8, special: 0 },
  { glyph: 240, kind: "mon", ch: 90, color: 8, special: 0 },
  { glyph: 241, kind: "mon", ch: 90, color: 8, special: 0 },
  { glyph: 242, kind: "mon", ch: 90, color: 8, special: 0 },
  { glyph: 243, kind: "mon", ch: 90, color: 8, special: 0 },
  { glyph: 244, kind: "mon", ch: 90, color: 8, special: 0 },
  { glyph: 245, kind: "mon", ch: 90, color: 8, special: 0 },
  { glyph: 246, kind: "mon", ch: 90, color: 8, special: 0 },
  { glyph: 247, kind: "mon", ch: 39, color: 8, special: 0 },
  { glyph: 248, kind: "mon", ch: 39, color: 8, special: 0 },
  { glyph: 249, kind: "mon", ch: 39, color: 8, special: 0 },
  { glyph: 250, kind: "mon", ch: 39, color: 8, special: 0 },
  { glyph: 251, kind: "mon", ch: 39, color: 8, special: 0 },
  { glyph: 252, kind: "mon", ch: 39, color: 8, special: 0 },
  { glyph: 253, kind: "mon", ch: 39, color: 8, special: 0 },
  { glyph: 254, kind: "mon", ch: 39, color: 8, special: 0 },
  { glyph: 255, kind: "mon", ch: 39, color: 8, special: 0 },
  { glyph: 256, kind: "mon", ch: 39, color: 8, special: 0 },
  { glyph: 257, kind: "mon", ch: 39, color: 8, special: 0 },
  { glyph: 258, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 259, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 260, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 261, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 262, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 263, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 264, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 265, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 266, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 267, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 268, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 269, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 270, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 271, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 272, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 273, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 274, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 275, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 276, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 277, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 278, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 279, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 280, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 281, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 282, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 283, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 284, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 285, kind: "mon", ch: 32, color: 8, special: 0 },
  { glyph: 286, kind: "mon", ch: 32, color: 8, special: 0 },
  { glyph: 287, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 288, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 289, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 290, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 291, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 292, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 293, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 294, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 295, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 296, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 297, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 298, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 299, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 300, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 301, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 302, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 303, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 304, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 305, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 306, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 307, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 308, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 309, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 310, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 311, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 312, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 313, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 314, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 315, kind: "mon", ch: 59, color: 8, special: 0 },
  { glyph: 316, kind: "mon", ch: 59, color: 8, special: 0 },
  { glyph: 317, kind: "mon", ch: 59, color: 8, special: 0 },
  { glyph: 318, kind: "mon", ch: 59, color: 8, special: 0 },
  { glyph: 319, kind: "mon", ch: 59, color: 8, special: 0 },
  { glyph: 320, kind: "mon", ch: 59, color: 8, special: 0 },
  { glyph: 321, kind: "mon", ch: 58, color: 8, special: 0 },
  { glyph: 322, kind: "mon", ch: 58, color: 8, special: 0 },
  { glyph: 323, kind: "mon", ch: 58, color: 8, special: 0 },
  { glyph: 324, kind: "mon", ch: 58, color: 8, special: 0 },
  { glyph: 325, kind: "mon", ch: 58, color: 8, special: 0 },
  { glyph: 326, kind: "mon", ch: 58, color: 8, special: 0 },
  { glyph: 327, kind: "mon", ch: 58, color: 8, special: 0 },
  { glyph: 328, kind: "mon", ch: 58, color: 8, special: 0 },
  { glyph: 329, kind: "mon", ch: 126, color: 8, special: 0 },
  { glyph: 330, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 331, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 332, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 333, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 334, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 335, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 336, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 337, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 338, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 339, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 340, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 341, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 342, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 343, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 344, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 345, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 346, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 347, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 348, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 349, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 350, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 351, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 352, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 353, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 354, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 355, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 356, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 357, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 358, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 359, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 360, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 361, kind: "mon", ch: 72, color: 8, special: 0 },
  { glyph: 362, kind: "mon", ch: 68, color: 8, special: 0 },
  { glyph: 363, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 364, kind: "mon", ch: 38, color: 8, special: 0 },
  { glyph: 365, kind: "mon", ch: 115, color: 8, special: 0 },
  { glyph: 366, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 367, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 368, kind: "mon", ch: 72, color: 8, special: 0 },
  { glyph: 369, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 370, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 371, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 372, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 373, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 374, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 375, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 376, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 377, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 378, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 379, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 380, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 381, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 382, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 383, kind: "mon", ch: 64, color: 8, special: 0 },
  { glyph: 384, kind: "pet", ch: 97, color: 8, special: 8 },
  { glyph: 385, kind: "pet", ch: 97, color: 8, special: 8 },
  { glyph: 386, kind: "pet", ch: 97, color: 8, special: 8 },
  { glyph: 387, kind: "pet", ch: 97, color: 8, special: 8 },
  { glyph: 388, kind: "pet", ch: 97, color: 8, special: 8 },
  { glyph: 389, kind: "pet", ch: 97, color: 8, special: 8 },
  { glyph: 390, kind: "pet", ch: 98, color: 8, special: 8 },
  { glyph: 391, kind: "pet", ch: 98, color: 8, special: 8 },
  { glyph: 392, kind: "pet", ch: 98, color: 8, special: 8 },
  { glyph: 393, kind: "pet", ch: 99, color: 8, special: 8 },
  { glyph: 394, kind: "pet", ch: 99, color: 8, special: 8 },
  { glyph: 395, kind: "pet", ch: 99, color: 8, special: 8 },
  { glyph: 396, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 397, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 398, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 399, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 400, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 401, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 402, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 403, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 404, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 405, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 406, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 407, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 408, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 409, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 410, kind: "pet", ch: 100, color: 8, special: 8 },
  { glyph: 411, kind: "pet", ch: 101, color: 8, special: 8 },
  { glyph: 412, kind: "pet", ch: 101, color: 8, special: 8 },
  { glyph: 413, kind: "pet", ch: 101, color: 8, special: 8 },
  { glyph: 414, kind: "pet", ch: 101, color: 8, special: 8 },
  { glyph: 415, kind: "pet", ch: 101, color: 8, special: 8 },
  { glyph: 416, kind: "pet", ch: 102, color: 8, special: 8 },
  { glyph: 417, kind: "pet", ch: 102, color: 8, special: 8 },
  { glyph: 418, kind: "pet", ch: 102, color: 8, special: 8 },
  { glyph: 419, kind: "pet", ch: 102, color: 8, special: 8 },
  { glyph: 420, kind: "pet", ch: 102, color: 8, special: 8 },
  { glyph: 421, kind: "pet", ch: 102, color: 8, special: 8 },
  { glyph: 422, kind: "pet", ch: 102, color: 8, special: 8 },
  { glyph: 423, kind: "pet", ch: 102, color: 8, special: 8 },
  { glyph: 424, kind: "pet", ch: 103, color: 8, special: 8 },
  { glyph: 425, kind: "pet", ch: 103, color: 8, special: 8 },
  { glyph: 426, kind: "pet", ch: 103, color: 8, special: 8 },
  { glyph: 427, kind: "pet", ch: 104, color: 8, special: 8 },
  { glyph: 428, kind: "pet", ch: 104, color: 8, special: 8 },
  { glyph: 429, kind: "pet", ch: 104, color: 8, special: 8 },
  { glyph: 430, kind: "pet", ch: 104, color: 8, special: 8 },
  { glyph: 431, kind: "pet", ch: 104, color: 8, special: 8 },
  { glyph: 432, kind: "pet", ch: 104, color: 8, special: 8 },
  { glyph: 433, kind: "pet", ch: 104, color: 8, special: 8 },
  { glyph: 434, kind: "pet", ch: 105, color: 8, special: 8 },
  { glyph: 435, kind: "pet", ch: 105, color: 8, special: 8 },
  { glyph: 436, kind: "pet", ch: 105, color: 8, special: 8 },
  { glyph: 437, kind: "pet", ch: 105, color: 8, special: 8 },
  { glyph: 438, kind: "pet", ch: 105, color: 8, special: 8 },
  { glyph: 439, kind: "pet", ch: 105, color: 8, special: 8 },
  { glyph: 440, kind: "pet", ch: 106, color: 8, special: 8 },
  { glyph: 441, kind: "pet", ch: 106, color: 8, special: 8 },
  { glyph: 442, kind: "pet", ch: 106, color: 8, special: 8 },
  { glyph: 443, kind: "pet", ch: 107, color: 8, special: 8 },
  { glyph: 444, kind: "pet", ch: 107, color: 8, special: 8 },
  { glyph: 445, kind: "pet", ch: 107, color: 8, special: 8 },
  { glyph: 446, kind: "pet", ch: 107, color: 8, special: 8 },
  { glyph: 447, kind: "pet", ch: 108, color: 8, special: 8 },
  { glyph: 448, kind: "pet", ch: 109, color: 8, special: 8 },
  { glyph: 449, kind: "pet", ch: 109, color: 8, special: 8 },
  { glyph: 450, kind: "pet", ch: 109, color: 8, special: 8 },
  { glyph: 451, kind: "pet", ch: 110, color: 8, special: 8 },
  { glyph: 452, kind: "pet", ch: 110, color: 8, special: 8 },
  { glyph: 453, kind: "pet", ch: 110, color: 8, special: 8 },
  { glyph: 454, kind: "pet", ch: 111, color: 8, special: 8 },
  { glyph: 455, kind: "pet", ch: 111, color: 8, special: 8 },
  { glyph: 456, kind: "pet", ch: 111, color: 8, special: 8 },
  { glyph: 457, kind: "pet", ch: 111, color: 8, special: 8 },
  { glyph: 458, kind: "pet", ch: 111, color: 8, special: 8 },
  { glyph: 459, kind: "pet", ch: 111, color: 8, special: 8 },
  { glyph: 460, kind: "pet", ch: 111, color: 8, special: 8 },
  { glyph: 461, kind: "pet", ch: 111, color: 8, special: 8 },
  { glyph: 462, kind: "pet", ch: 112, color: 8, special: 8 },
  { glyph: 463, kind: "pet", ch: 112, color: 8, special: 8 },
  { glyph: 464, kind: "pet", ch: 112, color: 8, special: 8 },
  { glyph: 465, kind: "pet", ch: 113, color: 8, special: 8 },
  { glyph: 466, kind: "pet", ch: 113, color: 8, special: 8 },
  { glyph: 467, kind: "pet", ch: 113, color: 8, special: 8 },
  { glyph: 468, kind: "pet", ch: 113, color: 8, special: 8 },
  { glyph: 469, kind: "pet", ch: 113, color: 8, special: 8 },
  { glyph: 470, kind: "pet", ch: 113, color: 8, special: 8 },
  { glyph: 471, kind: "pet", ch: 113, color: 8, special: 8 },
  { glyph: 472, kind: "pet", ch: 114, color: 8, special: 8 },
  { glyph: 473, kind: "pet", ch: 114, color: 8, special: 8 },
  { glyph: 474, kind: "pet", ch: 114, color: 8, special: 8 },
  { glyph: 475, kind: "pet", ch: 114, color: 8, special: 8 },
  { glyph: 476, kind: "pet", ch: 114, color: 8, special: 8 },
  { glyph: 477, kind: "pet", ch: 114, color: 8, special: 8 },
  { glyph: 478, kind: "pet", ch: 115, color: 8, special: 8 },
  { glyph: 479, kind: "pet", ch: 115, color: 8, special: 8 },
  { glyph: 480, kind: "pet", ch: 115, color: 8, special: 8 },
  { glyph: 481, kind: "pet", ch: 115, color: 8, special: 8 },
  { glyph: 482, kind: "pet", ch: 116, color: 8, special: 8 },
  { glyph: 483, kind: "pet", ch: 116, color: 8, special: 8 },
  { glyph: 484, kind: "pet", ch: 117, color: 8, special: 8 },
  { glyph: 485, kind: "pet", ch: 117, color: 8, special: 8 },
  { glyph: 486, kind: "pet", ch: 117, color: 8, special: 8 },
  { glyph: 487, kind: "pet", ch: 117, color: 8, special: 8 },
  { glyph: 488, kind: "pet", ch: 117, color: 8, special: 8 },
  { glyph: 489, kind: "pet", ch: 117, color: 8, special: 8 },
  { glyph: 490, kind: "pet", ch: 118, color: 8, special: 8 },
  { glyph: 491, kind: "pet", ch: 118, color: 8, special: 8 },
  { glyph: 492, kind: "pet", ch: 118, color: 8, special: 8 },
  { glyph: 493, kind: "pet", ch: 118, color: 8, special: 8 },
  { glyph: 494, kind: "pet", ch: 118, color: 8, special: 8 },
  { glyph: 495, kind: "pet", ch: 118, color: 8, special: 8 },
  { glyph: 496, kind: "pet", ch: 119, color: 8, special: 8 },
  { glyph: 497, kind: "pet", ch: 119, color: 8, special: 8 },
  { glyph: 498, kind: "pet", ch: 119, color: 8, special: 8 },
  { glyph: 499, kind: "pet", ch: 119, color: 8, special: 8 },
  { glyph: 500, kind: "pet", ch: 120, color: 8, special: 8 },
  { glyph: 501, kind: "pet", ch: 120, color: 8, special: 8 },
  { glyph: 502, kind: "pet", ch: 121, color: 8, special: 8 },
  { glyph: 503, kind: "pet", ch: 121, color: 8, special: 8 },
  { glyph: 504, kind: "pet", ch: 122, color: 8, special: 8 },
  { glyph: 505, kind: "pet", ch: 65, color: 8, special: 8 },
  { glyph: 506, kind: "pet", ch: 65, color: 8, special: 8 },
  { glyph: 507, kind: "pet", ch: 65, color: 8, special: 8 },
  { glyph: 508, kind: "pet", ch: 65, color: 8, special: 8 },
  { glyph: 509, kind: "pet", ch: 65, color: 8, special: 8 },
  { glyph: 510, kind: "pet", ch: 66, color: 8, special: 8 },
  { glyph: 511, kind: "pet", ch: 66, color: 8, special: 8 },
  { glyph: 512, kind: "pet", ch: 66, color: 8, special: 8 },
  { glyph: 513, kind: "pet", ch: 66, color: 8, special: 8 },
  { glyph: 514, kind: "pet", ch: 67, color: 8, special: 8 },
  { glyph: 515, kind: "pet", ch: 67, color: 8, special: 8 },
  { glyph: 516, kind: "pet", ch: 67, color: 8, special: 8 },
  { glyph: 517, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 518, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 519, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 520, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 521, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 522, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 523, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 524, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 525, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 526, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 527, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 528, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 529, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 530, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 531, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 532, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 533, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 534, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 535, kind: "pet", ch: 69, color: 8, special: 8 },
  { glyph: 536, kind: "pet", ch: 69, color: 8, special: 8 },
  { glyph: 537, kind: "pet", ch: 69, color: 8, special: 8 },
  { glyph: 538, kind: "pet", ch: 69, color: 8, special: 8 },
  { glyph: 539, kind: "pet", ch: 69, color: 8, special: 8 },
  { glyph: 540, kind: "pet", ch: 70, color: 8, special: 8 },
  { glyph: 541, kind: "pet", ch: 70, color: 8, special: 8 },
  { glyph: 542, kind: "pet", ch: 70, color: 8, special: 8 },
  { glyph: 543, kind: "pet", ch: 70, color: 8, special: 8 },
  { glyph: 544, kind: "pet", ch: 70, color: 8, special: 8 },
  { glyph: 545, kind: "pet", ch: 70, color: 8, special: 8 },
  { glyph: 546, kind: "pet", ch: 70, color: 8, special: 8 },
  { glyph: 547, kind: "pet", ch: 71, color: 8, special: 8 },
  { glyph: 548, kind: "pet", ch: 71, color: 8, special: 8 },
  { glyph: 549, kind: "pet", ch: 71, color: 8, special: 8 },
  { glyph: 550, kind: "pet", ch: 71, color: 8, special: 8 },
  { glyph: 551, kind: "pet", ch: 72, color: 8, special: 8 },
  { glyph: 552, kind: "pet", ch: 72, color: 8, special: 8 },
  { glyph: 553, kind: "pet", ch: 72, color: 8, special: 8 },
  { glyph: 554, kind: "pet", ch: 72, color: 8, special: 8 },
  { glyph: 555, kind: "pet", ch: 72, color: 8, special: 8 },
  { glyph: 556, kind: "pet", ch: 72, color: 8, special: 8 },
  { glyph: 557, kind: "pet", ch: 72, color: 8, special: 8 },
  { glyph: 558, kind: "pet", ch: 72, color: 8, special: 8 },
  { glyph: 559, kind: "pet", ch: 72, color: 8, special: 8 },
  { glyph: 560, kind: "pet", ch: 74, color: 8, special: 8 },
  { glyph: 561, kind: "pet", ch: 75, color: 8, special: 8 },
  { glyph: 562, kind: "pet", ch: 75, color: 8, special: 8 },
  { glyph: 563, kind: "pet", ch: 75, color: 8, special: 8 },
  { glyph: 564, kind: "pet", ch: 75, color: 8, special: 8 },
  { glyph: 565, kind: "pet", ch: 76, color: 8, special: 8 },
  { glyph: 566, kind: "pet", ch: 76, color: 8, special: 8 },
  { glyph: 567, kind: "pet", ch: 76, color: 8, special: 8 },
  { glyph: 568, kind: "pet", ch: 76, color: 8, special: 8 },
  { glyph: 569, kind: "pet", ch: 77, color: 8, special: 8 },
  { glyph: 570, kind: "pet", ch: 77, color: 8, special: 8 },
  { glyph: 571, kind: "pet", ch: 77, color: 8, special: 8 },
  { glyph: 572, kind: "pet", ch: 77, color: 8, special: 8 },
  { glyph: 573, kind: "pet", ch: 77, color: 8, special: 8 },
  { glyph: 574, kind: "pet", ch: 77, color: 8, special: 8 },
  { glyph: 575, kind: "pet", ch: 77, color: 8, special: 8 },
  { glyph: 576, kind: "pet", ch: 77, color: 8, special: 8 },
  { glyph: 577, kind: "pet", ch: 78, color: 8, special: 8 },
  { glyph: 578, kind: "pet", ch: 78, color: 8, special: 8 },
  { glyph: 579, kind: "pet", ch: 78, color: 8, special: 8 },
  { glyph: 580, kind: "pet", ch: 78, color: 8, special: 8 },
  { glyph: 581, kind: "pet", ch: 78, color: 8, special: 8 },
  { glyph: 582, kind: "pet", ch: 78, color: 8, special: 8 },
  { glyph: 583, kind: "pet", ch: 78, color: 8, special: 8 },
  { glyph: 584, kind: "pet", ch: 78, color: 8, special: 8 },
  { glyph: 585, kind: "pet", ch: 79, color: 8, special: 8 },
  { glyph: 586, kind: "pet", ch: 79, color: 8, special: 8 },
  { glyph: 587, kind: "pet", ch: 79, color: 8, special: 8 },
  { glyph: 588, kind: "pet", ch: 80, color: 8, special: 8 },
  { glyph: 589, kind: "pet", ch: 80, color: 8, special: 8 },
  { glyph: 590, kind: "pet", ch: 80, color: 8, special: 8 },
  { glyph: 591, kind: "pet", ch: 80, color: 8, special: 8 },
  { glyph: 592, kind: "pet", ch: 81, color: 8, special: 8 },
  { glyph: 593, kind: "pet", ch: 81, color: 8, special: 8 },
  { glyph: 594, kind: "pet", ch: 82, color: 8, special: 8 },
  { glyph: 595, kind: "pet", ch: 82, color: 8, special: 8 },
  { glyph: 596, kind: "pet", ch: 83, color: 8, special: 8 },
  { glyph: 597, kind: "pet", ch: 83, color: 8, special: 8 },
  { glyph: 598, kind: "pet", ch: 83, color: 8, special: 8 },
  { glyph: 599, kind: "pet", ch: 83, color: 8, special: 8 },
  { glyph: 600, kind: "pet", ch: 83, color: 8, special: 8 },
  { glyph: 601, kind: "pet", ch: 83, color: 8, special: 8 },
  { glyph: 602, kind: "pet", ch: 84, color: 8, special: 8 },
  { glyph: 603, kind: "pet", ch: 84, color: 8, special: 8 },
  { glyph: 604, kind: "pet", ch: 84, color: 8, special: 8 },
  { glyph: 605, kind: "pet", ch: 84, color: 8, special: 8 },
  { glyph: 606, kind: "pet", ch: 84, color: 8, special: 8 },
  { glyph: 607, kind: "pet", ch: 85, color: 8, special: 8 },
  { glyph: 608, kind: "pet", ch: 86, color: 8, special: 8 },
  { glyph: 609, kind: "pet", ch: 86, color: 8, special: 8 },
  { glyph: 610, kind: "pet", ch: 86, color: 8, special: 8 },
  { glyph: 611, kind: "pet", ch: 87, color: 8, special: 8 },
  { glyph: 612, kind: "pet", ch: 87, color: 8, special: 8 },
  { glyph: 613, kind: "pet", ch: 87, color: 8, special: 8 },
  { glyph: 614, kind: "pet", ch: 88, color: 8, special: 8 },
  { glyph: 615, kind: "pet", ch: 89, color: 8, special: 8 },
  { glyph: 616, kind: "pet", ch: 89, color: 8, special: 8 },
  { glyph: 617, kind: "pet", ch: 89, color: 8, special: 8 },
  { glyph: 618, kind: "pet", ch: 89, color: 8, special: 8 },
  { glyph: 619, kind: "pet", ch: 89, color: 8, special: 8 },
  { glyph: 620, kind: "pet", ch: 89, color: 8, special: 8 },
  { glyph: 621, kind: "pet", ch: 90, color: 8, special: 8 },
  { glyph: 622, kind: "pet", ch: 90, color: 8, special: 8 },
  { glyph: 623, kind: "pet", ch: 90, color: 8, special: 8 },
  { glyph: 624, kind: "pet", ch: 90, color: 8, special: 8 },
  { glyph: 625, kind: "pet", ch: 90, color: 8, special: 8 },
  { glyph: 626, kind: "pet", ch: 90, color: 8, special: 8 },
  { glyph: 627, kind: "pet", ch: 90, color: 8, special: 8 },
  { glyph: 628, kind: "pet", ch: 90, color: 8, special: 8 },
  { glyph: 629, kind: "pet", ch: 90, color: 8, special: 8 },
  { glyph: 630, kind: "pet", ch: 90, color: 8, special: 8 },
  { glyph: 631, kind: "pet", ch: 39, color: 8, special: 8 },
  { glyph: 632, kind: "pet", ch: 39, color: 8, special: 8 },
  { glyph: 633, kind: "pet", ch: 39, color: 8, special: 8 },
  { glyph: 634, kind: "pet", ch: 39, color: 8, special: 8 },
  { glyph: 635, kind: "pet", ch: 39, color: 8, special: 8 },
  { glyph: 636, kind: "pet", ch: 39, color: 8, special: 8 },
  { glyph: 637, kind: "pet", ch: 39, color: 8, special: 8 },
  { glyph: 638, kind: "pet", ch: 39, color: 8, special: 8 },
  { glyph: 639, kind: "pet", ch: 39, color: 8, special: 8 },
  { glyph: 640, kind: "pet", ch: 39, color: 8, special: 8 },
  { glyph: 641, kind: "pet", ch: 39, color: 8, special: 8 },
  { glyph: 642, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 643, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 644, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 645, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 646, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 647, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 648, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 649, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 650, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 651, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 652, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 653, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 654, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 655, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 656, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 657, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 658, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 659, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 660, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 661, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 662, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 663, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 664, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 665, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 666, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 667, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 668, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 669, kind: "pet", ch: 32, color: 8, special: 8 },
  { glyph: 670, kind: "pet", ch: 32, color: 8, special: 8 },
  { glyph: 671, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 672, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 673, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 674, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 675, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 676, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 677, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 678, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 679, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 680, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 681, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 682, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 683, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 684, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 685, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 686, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 687, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 688, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 689, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 690, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 691, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 692, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 693, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 694, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 695, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 696, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 697, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 698, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 699, kind: "pet", ch: 59, color: 8, special: 8 },
  { glyph: 700, kind: "pet", ch: 59, color: 8, special: 8 },
  { glyph: 701, kind: "pet", ch: 59, color: 8, special: 8 },
  { glyph: 702, kind: "pet", ch: 59, color: 8, special: 8 },
  { glyph: 703, kind: "pet", ch: 59, color: 8, special: 8 },
  { glyph: 704, kind: "pet", ch: 59, color: 8, special: 8 },
  { glyph: 705, kind: "pet", ch: 58, color: 8, special: 8 },
  { glyph: 706, kind: "pet", ch: 58, color: 8, special: 8 },
  { glyph: 707, kind: "pet", ch: 58, color: 8, special: 8 },
  { glyph: 708, kind: "pet", ch: 58, color: 8, special: 8 },
  { glyph: 709, kind: "pet", ch: 58, color: 8, special: 8 },
  { glyph: 710, kind: "pet", ch: 58, color: 8, special: 8 },
  { glyph: 711, kind: "pet", ch: 58, color: 8, special: 8 },
  { glyph: 712, kind: "pet", ch: 58, color: 8, special: 8 },
  { glyph: 713, kind: "pet", ch: 126, color: 8, special: 8 },
  { glyph: 714, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 715, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 716, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 717, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 718, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 719, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 720, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 721, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 722, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 723, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 724, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 725, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 726, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 727, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 728, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 729, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 730, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 731, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 732, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 733, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 734, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 735, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 736, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 737, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 738, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 739, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 740, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 741, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 742, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 743, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 744, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 745, kind: "pet", ch: 72, color: 8, special: 8 },
  { glyph: 746, kind: "pet", ch: 68, color: 8, special: 8 },
  { glyph: 747, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 748, kind: "pet", ch: 38, color: 8, special: 8 },
  { glyph: 749, kind: "pet", ch: 115, color: 8, special: 8 },
  { glyph: 750, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 751, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 752, kind: "pet", ch: 72, color: 8, special: 8 },
  { glyph: 753, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 754, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 755, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 756, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 757, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 758, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 759, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 760, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 761, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 762, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 763, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 764, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 765, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 766, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 767, kind: "pet", ch: 64, color: 8, special: 8 },
  { glyph: 768, kind: "invis", ch: 73, color: 8, special: 2 },
  { glyph: 769, kind: "detect", ch: 97, color: 8, special: 4 },
  { glyph: 770, kind: "detect", ch: 97, color: 8, special: 4 },
  { glyph: 771, kind: "detect", ch: 97, color: 8, special: 4 },
  { glyph: 772, kind: "detect", ch: 97, color: 8, special: 4 },
  { glyph: 773, kind: "detect", ch: 97, color: 8, special: 4 },
  { glyph: 774, kind: "detect", ch: 97, color: 8, special: 4 },
  { glyph: 775, kind: "detect", ch: 98, color: 8, special: 4 },
  { glyph: 776, kind: "detect", ch: 98, color: 8, special: 4 },
  { glyph: 777, kind: "detect", ch: 98, color: 8, special: 4 },
  { glyph: 778, kind: "detect", ch: 99, color: 8, special: 4 },
  { glyph: 779, kind: "detect", ch: 99, color: 8, special: 4 },
  { glyph: 780, kind: "detect", ch: 99, color: 8, special: 4 },
  { glyph: 781, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 782, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 783, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 784, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 785, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 786, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 787, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 788, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 789, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 790, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 791, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 792, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 793, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 794, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 795, kind: "detect", ch: 100, color: 8, special: 4 },
  { glyph: 796, kind: "detect", ch: 101, color: 8, special: 4 },
  { glyph: 797, kind: "detect", ch: 101, color: 8, special: 4 },
  { glyph: 798, kind: "detect", ch: 101, color: 8, special: 4 },
  { glyph: 799, kind: "detect", ch: 101, color: 8, special: 4 },
  { glyph: 800, kind: "detect", ch: 101, color: 8, special: 4 },
  { glyph: 801, kind: "detect", ch: 102, color: 8, special: 4 },
  { glyph: 802, kind: "detect", ch: 102, color: 8, special: 4 },
  { glyph: 803, kind: "detect", ch: 102, color: 8, special: 4 },
  { glyph: 804, kind: "detect", ch: 102, color: 8, special: 4 },
  { glyph: 805, kind: "detect", ch: 102, color: 8, special: 4 },
  { glyph: 806, kind: "detect", ch: 102, color: 8, special: 4 },
  { glyph: 807, kind: "detect", ch: 102, color: 8, special: 4 },
  { glyph: 808, kind: "detect", ch: 102, color: 8, special: 4 },
  { glyph: 809, kind: "detect", ch: 103, color: 8, special: 4 },
  { glyph: 810, kind: "detect", ch: 103, color: 8, special: 4 },
  { glyph: 811, kind: "detect", ch: 103, color: 8, special: 4 },
  { glyph: 812, kind: "detect", ch: 104, color: 8, special: 4 },
  { glyph: 813, kind: "detect", ch: 104, color: 8, special: 4 },
  { glyph: 814, kind: "detect", ch: 104, color: 8, special: 4 },
  { glyph: 815, kind: "detect", ch: 104, color: 8, special: 4 },
  { glyph: 816, kind: "detect", ch: 104, color: 8, special: 4 },
  { glyph: 817, kind: "detect", ch: 104, color: 8, special: 4 },
  { glyph: 818, kind: "detect", ch: 104, color: 8, special: 4 },
  { glyph: 819, kind: "detect", ch: 105, color: 8, special: 4 },
  { glyph: 820, kind: "detect", ch: 105, color: 8, special: 4 },
  { glyph: 821, kind: "detect", ch: 105, color: 8, special: 4 },
  { glyph: 822, kind: "detect", ch: 105, color: 8, special: 4 },
  { glyph: 823, kind: "detect", ch: 105, color: 8, special: 4 },
  { glyph: 824, kind: "detect", ch: 105, color: 8, special: 4 },
  { glyph: 825, kind: "detect", ch: 106, color: 8, special: 4 },
  { glyph: 826, kind: "detect", ch: 106, color: 8, special: 4 },
  { glyph: 827, kind: "detect", ch: 106, color: 8, special: 4 },
  { glyph: 828, kind: "detect", ch: 107, color: 8, special: 4 },
  { glyph: 829, kind: "detect", ch: 107, color: 8, special: 4 },
  { glyph: 830, kind: "detect", ch: 107, color: 8, special: 4 },
  { glyph: 831, kind: "detect", ch: 107, color: 8, special: 4 },
  { glyph: 832, kind: "detect", ch: 108, color: 8, special: 4 },
  { glyph: 833, kind: "detect", ch: 109, color: 8, special: 4 },
  { glyph: 834, kind: "detect", ch: 109, color: 8, special: 4 },
  { glyph: 835, kind: "detect", ch: 109, color: 8, special: 4 },
  { glyph: 836, kind: "detect", ch: 110, color: 8, special: 4 },
  { glyph: 837, kind: "detect", ch: 110, color: 8, special: 4 },
  { glyph: 838, kind: "detect", ch: 110, color: 8, special: 4 },
  { glyph: 839, kind: "detect", ch: 111, color: 8, special: 4 },
  { glyph: 840, kind: "detect", ch: 111, color: 8, special: 4 },
  { glyph: 841, kind: "detect", ch: 111, color: 8, special: 4 },
  { glyph: 842, kind: "detect", ch: 111, color: 8, special: 4 },
  { glyph: 843, kind: "detect", ch: 111, color: 8, special: 4 },
  { glyph: 844, kind: "detect", ch: 111, color: 8, special: 4 },
  { glyph: 845, kind: "detect", ch: 111, color: 8, special: 4 },
  { glyph: 846, kind: "detect", ch: 111, color: 8, special: 4 },
  { glyph: 847, kind: "detect", ch: 112, color: 8, special: 4 },
  { glyph: 848, kind: "detect", ch: 112, color: 8, special: 4 },
  { glyph: 849, kind: "detect", ch: 112, color: 8, special: 4 },
  { glyph: 850, kind: "detect", ch: 113, color: 8, special: 4 },
  { glyph: 851, kind: "detect", ch: 113, color: 8, special: 4 },
  { glyph: 852, kind: "detect", ch: 113, color: 8, special: 4 },
  { glyph: 853, kind: "detect", ch: 113, color: 8, special: 4 },
  { glyph: 854, kind: "detect", ch: 113, color: 8, special: 4 },
  { glyph: 855, kind: "detect", ch: 113, color: 8, special: 4 },
  { glyph: 856, kind: "detect", ch: 113, color: 8, special: 4 },
  { glyph: 857, kind: "detect", ch: 114, color: 8, special: 4 },
  { glyph: 858, kind: "detect", ch: 114, color: 8, special: 4 },
  { glyph: 859, kind: "detect", ch: 114, color: 8, special: 4 },
  { glyph: 860, kind: "detect", ch: 114, color: 8, special: 4 },
  { glyph: 861, kind: "detect", ch: 114, color: 8, special: 4 },
  { glyph: 862, kind: "detect", ch: 114, color: 8, special: 4 },
  { glyph: 863, kind: "detect", ch: 115, color: 8, special: 4 },
  { glyph: 864, kind: "detect", ch: 115, color: 8, special: 4 },
  { glyph: 865, kind: "detect", ch: 115, color: 8, special: 4 },
  { glyph: 866, kind: "detect", ch: 115, color: 8, special: 4 },
  { glyph: 867, kind: "detect", ch: 116, color: 8, special: 4 },
  { glyph: 868, kind: "detect", ch: 116, color: 8, special: 4 },
  { glyph: 869, kind: "detect", ch: 117, color: 8, special: 4 },
  { glyph: 870, kind: "detect", ch: 117, color: 8, special: 4 },
  { glyph: 871, kind: "detect", ch: 117, color: 8, special: 4 },
  { glyph: 872, kind: "detect", ch: 117, color: 8, special: 4 },
  { glyph: 873, kind: "detect", ch: 117, color: 8, special: 4 },
  { glyph: 874, kind: "detect", ch: 117, color: 8, special: 4 },
  { glyph: 875, kind: "detect", ch: 118, color: 8, special: 4 },
  { glyph: 876, kind: "detect", ch: 118, color: 8, special: 4 },
  { glyph: 877, kind: "detect", ch: 118, color: 8, special: 4 },
  { glyph: 878, kind: "detect", ch: 118, color: 8, special: 4 },
  { glyph: 879, kind: "detect", ch: 118, color: 8, special: 4 },
  { glyph: 880, kind: "detect", ch: 118, color: 8, special: 4 },
  { glyph: 881, kind: "detect", ch: 119, color: 8, special: 4 },
  { glyph: 882, kind: "detect", ch: 119, color: 8, special: 4 },
  { glyph: 883, kind: "detect", ch: 119, color: 8, special: 4 },
  { glyph: 884, kind: "detect", ch: 119, color: 8, special: 4 },
  { glyph: 885, kind: "detect", ch: 120, color: 8, special: 4 },
  { glyph: 886, kind: "detect", ch: 120, color: 8, special: 4 },
  { glyph: 887, kind: "detect", ch: 121, color: 8, special: 4 },
  { glyph: 888, kind: "detect", ch: 121, color: 8, special: 4 },
  { glyph: 889, kind: "detect", ch: 122, color: 8, special: 4 },
  { glyph: 890, kind: "detect", ch: 65, color: 8, special: 4 },
  { glyph: 891, kind: "detect", ch: 65, color: 8, special: 4 },
  { glyph: 892, kind: "detect", ch: 65, color: 8, special: 4 },
  { glyph: 893, kind: "detect", ch: 65, color: 8, special: 4 },
  { glyph: 894, kind: "detect", ch: 65, color: 8, special: 4 },
  { glyph: 895, kind: "detect", ch: 66, color: 8, special: 4 },
  { glyph: 896, kind: "detect", ch: 66, color: 8, special: 4 },
  { glyph: 897, kind: "detect", ch: 66, color: 8, special: 4 },
  { glyph: 898, kind: "detect", ch: 66, color: 8, special: 4 },
  { glyph: 899, kind: "detect", ch: 67, color: 8, special: 4 },
  { glyph: 900, kind: "detect", ch: 67, color: 8, special: 4 },
  { glyph: 901, kind: "detect", ch: 67, color: 8, special: 4 },
  { glyph: 902, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 903, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 904, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 905, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 906, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 907, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 908, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 909, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 910, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 911, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 912, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 913, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 914, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 915, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 916, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 917, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 918, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 919, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 920, kind: "detect", ch: 69, color: 8, special: 4 },
  { glyph: 921, kind: "detect", ch: 69, color: 8, special: 4 },
  { glyph: 922, kind: "detect", ch: 69, color: 8, special: 4 },
  { glyph: 923, kind: "detect", ch: 69, color: 8, special: 4 },
  { glyph: 924, kind: "detect", ch: 69, color: 8, special: 4 },
  { glyph: 925, kind: "detect", ch: 70, color: 8, special: 4 },
  { glyph: 926, kind: "detect", ch: 70, color: 8, special: 4 },
  { glyph: 927, kind: "detect", ch: 70, color: 8, special: 4 },
  { glyph: 928, kind: "detect", ch: 70, color: 8, special: 4 },
  { glyph: 929, kind: "detect", ch: 70, color: 8, special: 4 },
  { glyph: 930, kind: "detect", ch: 70, color: 8, special: 4 },
  { glyph: 931, kind: "detect", ch: 70, color: 8, special: 4 },
  { glyph: 932, kind: "detect", ch: 71, color: 8, special: 4 },
  { glyph: 933, kind: "detect", ch: 71, color: 8, special: 4 },
  { glyph: 934, kind: "detect", ch: 71, color: 8, special: 4 },
  { glyph: 935, kind: "detect", ch: 71, color: 8, special: 4 },
  { glyph: 936, kind: "detect", ch: 72, color: 8, special: 4 },
  { glyph: 937, kind: "detect", ch: 72, color: 8, special: 4 },
  { glyph: 938, kind: "detect", ch: 72, color: 8, special: 4 },
  { glyph: 939, kind: "detect", ch: 72, color: 8, special: 4 },
  { glyph: 940, kind: "detect", ch: 72, color: 8, special: 4 },
  { glyph: 941, kind: "detect", ch: 72, color: 8, special: 4 },
  { glyph: 942, kind: "detect", ch: 72, color: 8, special: 4 },
  { glyph: 943, kind: "detect", ch: 72, color: 8, special: 4 },
  { glyph: 944, kind: "detect", ch: 72, color: 8, special: 4 },
  { glyph: 945, kind: "detect", ch: 74, color: 8, special: 4 },
  { glyph: 946, kind: "detect", ch: 75, color: 8, special: 4 },
  { glyph: 947, kind: "detect", ch: 75, color: 8, special: 4 },
  { glyph: 948, kind: "detect", ch: 75, color: 8, special: 4 },
  { glyph: 949, kind: "detect", ch: 75, color: 8, special: 4 },
  { glyph: 950, kind: "detect", ch: 76, color: 8, special: 4 },
  { glyph: 951, kind: "detect", ch: 76, color: 8, special: 4 },
  { glyph: 952, kind: "detect", ch: 76, color: 8, special: 4 },
  { glyph: 953, kind: "detect", ch: 76, color: 8, special: 4 },
  { glyph: 954, kind: "detect", ch: 77, color: 8, special: 4 },
  { glyph: 955, kind: "detect", ch: 77, color: 8, special: 4 },
  { glyph: 956, kind: "detect", ch: 77, color: 8, special: 4 },
  { glyph: 957, kind: "detect", ch: 77, color: 8, special: 4 },
  { glyph: 958, kind: "detect", ch: 77, color: 8, special: 4 },
  { glyph: 959, kind: "detect", ch: 77, color: 8, special: 4 },
  { glyph: 960, kind: "detect", ch: 77, color: 8, special: 4 },
  { glyph: 961, kind: "detect", ch: 77, color: 8, special: 4 },
  { glyph: 962, kind: "detect", ch: 78, color: 8, special: 4 },
  { glyph: 963, kind: "detect", ch: 78, color: 8, special: 4 },
  { glyph: 964, kind: "detect", ch: 78, color: 8, special: 4 },
  { glyph: 965, kind: "detect", ch: 78, color: 8, special: 4 },
  { glyph: 966, kind: "detect", ch: 78, color: 8, special: 4 },
  { glyph: 967, kind: "detect", ch: 78, color: 8, special: 4 },
  { glyph: 968, kind: "detect", ch: 78, color: 8, special: 4 },
  { glyph: 969, kind: "detect", ch: 78, color: 8, special: 4 },
  { glyph: 970, kind: "detect", ch: 79, color: 8, special: 4 },
  { glyph: 971, kind: "detect", ch: 79, color: 8, special: 4 },
  { glyph: 972, kind: "detect", ch: 79, color: 8, special: 4 },
  { glyph: 973, kind: "detect", ch: 80, color: 8, special: 4 },
  { glyph: 974, kind: "detect", ch: 80, color: 8, special: 4 },
  { glyph: 975, kind: "detect", ch: 80, color: 8, special: 4 },
  { glyph: 976, kind: "detect", ch: 80, color: 8, special: 4 },
  { glyph: 977, kind: "detect", ch: 81, color: 8, special: 4 },
  { glyph: 978, kind: "detect", ch: 81, color: 8, special: 4 },
  { glyph: 979, kind: "detect", ch: 82, color: 8, special: 4 },
  { glyph: 980, kind: "detect", ch: 82, color: 8, special: 4 },
  { glyph: 981, kind: "detect", ch: 83, color: 8, special: 4 },
  { glyph: 982, kind: "detect", ch: 83, color: 8, special: 4 },
  { glyph: 983, kind: "detect", ch: 83, color: 8, special: 4 },
  { glyph: 984, kind: "detect", ch: 83, color: 8, special: 4 },
  { glyph: 985, kind: "detect", ch: 83, color: 8, special: 4 },
  { glyph: 986, kind: "detect", ch: 83, color: 8, special: 4 },
  { glyph: 987, kind: "detect", ch: 84, color: 8, special: 4 },
  { glyph: 988, kind: "detect", ch: 84, color: 8, special: 4 },
  { glyph: 989, kind: "detect", ch: 84, color: 8, special: 4 },
  { glyph: 990, kind: "detect", ch: 84, color: 8, special: 4 },
  { glyph: 991, kind: "detect", ch: 84, color: 8, special: 4 },
  { glyph: 992, kind: "detect", ch: 85, color: 8, special: 4 },
  { glyph: 993, kind: "detect", ch: 86, color: 8, special: 4 },
  { glyph: 994, kind: "detect", ch: 86, color: 8, special: 4 },
  { glyph: 995, kind: "detect", ch: 86, color: 8, special: 4 },
  { glyph: 996, kind: "detect", ch: 87, color: 8, special: 4 },
  { glyph: 997, kind: "detect", ch: 87, color: 8, special: 4 },
  { glyph: 998, kind: "detect", ch: 87, color: 8, special: 4 },
  { glyph: 999, kind: "detect", ch: 88, color: 8, special: 4 },
  { glyph: 1e3, kind: "detect", ch: 89, color: 8, special: 4 },
  { glyph: 1001, kind: "detect", ch: 89, color: 8, special: 4 },
  { glyph: 1002, kind: "detect", ch: 89, color: 8, special: 4 },
  { glyph: 1003, kind: "detect", ch: 89, color: 8, special: 4 },
  { glyph: 1004, kind: "detect", ch: 89, color: 8, special: 4 },
  { glyph: 1005, kind: "detect", ch: 89, color: 8, special: 4 },
  { glyph: 1006, kind: "detect", ch: 90, color: 8, special: 4 },
  { glyph: 1007, kind: "detect", ch: 90, color: 8, special: 4 },
  { glyph: 1008, kind: "detect", ch: 90, color: 8, special: 4 },
  { glyph: 1009, kind: "detect", ch: 90, color: 8, special: 4 },
  { glyph: 1010, kind: "detect", ch: 90, color: 8, special: 4 },
  { glyph: 1011, kind: "detect", ch: 90, color: 8, special: 4 },
  { glyph: 1012, kind: "detect", ch: 90, color: 8, special: 4 },
  { glyph: 1013, kind: "detect", ch: 90, color: 8, special: 4 },
  { glyph: 1014, kind: "detect", ch: 90, color: 8, special: 4 },
  { glyph: 1015, kind: "detect", ch: 90, color: 8, special: 4 },
  { glyph: 1016, kind: "detect", ch: 39, color: 8, special: 4 },
  { glyph: 1017, kind: "detect", ch: 39, color: 8, special: 4 },
  { glyph: 1018, kind: "detect", ch: 39, color: 8, special: 4 },
  { glyph: 1019, kind: "detect", ch: 39, color: 8, special: 4 },
  { glyph: 1020, kind: "detect", ch: 39, color: 8, special: 4 },
  { glyph: 1021, kind: "detect", ch: 39, color: 8, special: 4 },
  { glyph: 1022, kind: "detect", ch: 39, color: 8, special: 4 },
  { glyph: 1023, kind: "detect", ch: 39, color: 8, special: 4 },
  { glyph: 1024, kind: "detect", ch: 39, color: 8, special: 4 },
  { glyph: 1025, kind: "detect", ch: 39, color: 8, special: 4 },
  { glyph: 1026, kind: "detect", ch: 39, color: 8, special: 4 },
  { glyph: 1027, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1028, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1029, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1030, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1031, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1032, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1033, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1034, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1035, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1036, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1037, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1038, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1039, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1040, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1041, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1042, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1043, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1044, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1045, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1046, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1047, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1048, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1049, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1050, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1051, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1052, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1053, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1054, kind: "detect", ch: 32, color: 8, special: 4 },
  { glyph: 1055, kind: "detect", ch: 32, color: 8, special: 4 },
  { glyph: 1056, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1057, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1058, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1059, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1060, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1061, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1062, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1063, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1064, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1065, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1066, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1067, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1068, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1069, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1070, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1071, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1072, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1073, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1074, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1075, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1076, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1077, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1078, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1079, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1080, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1081, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1082, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1083, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1084, kind: "detect", ch: 59, color: 8, special: 4 },
  { glyph: 1085, kind: "detect", ch: 59, color: 8, special: 4 },
  { glyph: 1086, kind: "detect", ch: 59, color: 8, special: 4 },
  { glyph: 1087, kind: "detect", ch: 59, color: 8, special: 4 },
  { glyph: 1088, kind: "detect", ch: 59, color: 8, special: 4 },
  { glyph: 1089, kind: "detect", ch: 59, color: 8, special: 4 },
  { glyph: 1090, kind: "detect", ch: 58, color: 8, special: 4 },
  { glyph: 1091, kind: "detect", ch: 58, color: 8, special: 4 },
  { glyph: 1092, kind: "detect", ch: 58, color: 8, special: 4 },
  { glyph: 1093, kind: "detect", ch: 58, color: 8, special: 4 },
  { glyph: 1094, kind: "detect", ch: 58, color: 8, special: 4 },
  { glyph: 1095, kind: "detect", ch: 58, color: 8, special: 4 },
  { glyph: 1096, kind: "detect", ch: 58, color: 8, special: 4 },
  { glyph: 1097, kind: "detect", ch: 58, color: 8, special: 4 },
  { glyph: 1098, kind: "detect", ch: 126, color: 8, special: 4 },
  { glyph: 1099, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1100, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1101, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1102, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1103, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1104, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1105, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1106, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1107, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1108, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1109, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1110, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1111, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1112, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1113, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1114, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1115, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1116, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1117, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1118, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1119, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1120, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1121, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1122, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1123, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1124, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1125, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1126, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1127, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1128, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1129, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 1130, kind: "detect", ch: 72, color: 8, special: 4 },
  { glyph: 1131, kind: "detect", ch: 68, color: 8, special: 4 },
  { glyph: 1132, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1133, kind: "detect", ch: 38, color: 8, special: 4 },
  { glyph: 1134, kind: "detect", ch: 115, color: 8, special: 4 },
  { glyph: 1135, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1136, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1137, kind: "detect", ch: 72, color: 8, special: 4 },
  { glyph: 1138, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1139, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1140, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1141, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1142, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1143, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1144, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1145, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1146, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1147, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1148, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1149, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1150, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1151, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1152, kind: "detect", ch: 64, color: 8, special: 4 },
  { glyph: 1153, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1154, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1155, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1156, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1157, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1158, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1159, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1160, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1161, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1162, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1163, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1164, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1165, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1166, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1167, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1168, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1169, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1170, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1171, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1172, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1173, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1174, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1175, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1176, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1177, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1178, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1179, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1180, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1181, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1182, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1183, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1184, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1185, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1186, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1187, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1188, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1189, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1190, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1191, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1192, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1193, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1194, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1195, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1196, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1197, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1198, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1199, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1200, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1201, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1202, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1203, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1204, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1205, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1206, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1207, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1208, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1209, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1210, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1211, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1212, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1213, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1214, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1215, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1216, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1217, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1218, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1219, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1220, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1221, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1222, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1223, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1224, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1225, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1226, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1227, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1228, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1229, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1230, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1231, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1232, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1233, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1234, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1235, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1236, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1237, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1238, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1239, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1240, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1241, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1242, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1243, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1244, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1245, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1246, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1247, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1248, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1249, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1250, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1251, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1252, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1253, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1254, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1255, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1256, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1257, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1258, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1259, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1260, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1261, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1262, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1263, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1264, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1265, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1266, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1267, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1268, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1269, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1270, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1271, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1272, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1273, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1274, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1275, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1276, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1277, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1278, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1279, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1280, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1281, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1282, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1283, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1284, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1285, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1286, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1287, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1288, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1289, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1290, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1291, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1292, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1293, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1294, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1295, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1296, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1297, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1298, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1299, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1300, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1301, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1302, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1303, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1304, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1305, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1306, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1307, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1308, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1309, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1310, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1311, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1312, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1313, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1314, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1315, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1316, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1317, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1318, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1319, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1320, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1321, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1322, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1323, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1324, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1325, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1326, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1327, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1328, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1329, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1330, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1331, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1332, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1333, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1334, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1335, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1336, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1337, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1338, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1339, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1340, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1341, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1342, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1343, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1344, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1345, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1346, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1347, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1348, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1349, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1350, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1351, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1352, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1353, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1354, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1355, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1356, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1357, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1358, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1359, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1360, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1361, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1362, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1363, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1364, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1365, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1366, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1367, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1368, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1369, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1370, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1371, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1372, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1373, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1374, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1375, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1376, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1377, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1378, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1379, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1380, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1381, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1382, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1383, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1384, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1385, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1386, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1387, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1388, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1389, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1390, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1391, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1392, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1393, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1394, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1395, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1396, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1397, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1398, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1399, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1400, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1401, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1402, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1403, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1404, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1405, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1406, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1407, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1408, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1409, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1410, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1411, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1412, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1413, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1414, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1415, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1416, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1417, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1418, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1419, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1420, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1421, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1422, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1423, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1424, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1425, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1426, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1427, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1428, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1429, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1430, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1431, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1432, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1433, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1434, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1435, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1436, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1437, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1438, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1439, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1440, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1441, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1442, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1443, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1444, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1445, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1446, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1447, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1448, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1449, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1450, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1451, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1452, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1453, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1454, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1455, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1456, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1457, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1458, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1459, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1460, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1461, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1462, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1463, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1464, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1465, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1466, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1467, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1468, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1469, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1470, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1471, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1472, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1473, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1474, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1475, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1476, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1477, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1478, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1479, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1480, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1481, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1482, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1483, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1484, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1485, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1486, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1487, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1488, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1489, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1490, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1491, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1492, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1493, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1494, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1495, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1496, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1497, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1498, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1499, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1500, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1501, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1502, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1503, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1504, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1505, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1506, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1507, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1508, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1509, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1510, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1511, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1512, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1513, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1514, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1515, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1516, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1517, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1518, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1519, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1520, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1521, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1522, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1523, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1524, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1525, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1526, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1527, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1528, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1529, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1530, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1531, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1532, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1533, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1534, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1535, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1536, kind: "body", ch: 37, color: 8, special: 1 },
  { glyph: 1537, kind: "ridden", ch: 97, color: 8, special: 16 },
  { glyph: 1538, kind: "ridden", ch: 97, color: 8, special: 16 },
  { glyph: 1539, kind: "ridden", ch: 97, color: 8, special: 16 },
  { glyph: 1540, kind: "ridden", ch: 97, color: 8, special: 16 },
  { glyph: 1541, kind: "ridden", ch: 97, color: 8, special: 16 },
  { glyph: 1542, kind: "ridden", ch: 97, color: 8, special: 16 },
  { glyph: 1543, kind: "ridden", ch: 98, color: 8, special: 16 },
  { glyph: 1544, kind: "ridden", ch: 98, color: 8, special: 16 },
  { glyph: 1545, kind: "ridden", ch: 98, color: 8, special: 16 },
  { glyph: 1546, kind: "ridden", ch: 99, color: 8, special: 16 },
  { glyph: 1547, kind: "ridden", ch: 99, color: 8, special: 16 },
  { glyph: 1548, kind: "ridden", ch: 99, color: 8, special: 16 },
  { glyph: 1549, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1550, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1551, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1552, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1553, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1554, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1555, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1556, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1557, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1558, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1559, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1560, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1561, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1562, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1563, kind: "ridden", ch: 100, color: 8, special: 16 },
  { glyph: 1564, kind: "ridden", ch: 101, color: 8, special: 16 },
  { glyph: 1565, kind: "ridden", ch: 101, color: 8, special: 16 },
  { glyph: 1566, kind: "ridden", ch: 101, color: 8, special: 16 },
  { glyph: 1567, kind: "ridden", ch: 101, color: 8, special: 16 },
  { glyph: 1568, kind: "ridden", ch: 101, color: 8, special: 16 },
  { glyph: 1569, kind: "ridden", ch: 102, color: 8, special: 16 },
  { glyph: 1570, kind: "ridden", ch: 102, color: 8, special: 16 },
  { glyph: 1571, kind: "ridden", ch: 102, color: 8, special: 16 },
  { glyph: 1572, kind: "ridden", ch: 102, color: 8, special: 16 },
  { glyph: 1573, kind: "ridden", ch: 102, color: 8, special: 16 },
  { glyph: 1574, kind: "ridden", ch: 102, color: 8, special: 16 },
  { glyph: 1575, kind: "ridden", ch: 102, color: 8, special: 16 },
  { glyph: 1576, kind: "ridden", ch: 102, color: 8, special: 16 },
  { glyph: 1577, kind: "ridden", ch: 103, color: 8, special: 16 },
  { glyph: 1578, kind: "ridden", ch: 103, color: 8, special: 16 },
  { glyph: 1579, kind: "ridden", ch: 103, color: 8, special: 16 },
  { glyph: 1580, kind: "ridden", ch: 104, color: 8, special: 16 },
  { glyph: 1581, kind: "ridden", ch: 104, color: 8, special: 16 },
  { glyph: 1582, kind: "ridden", ch: 104, color: 8, special: 16 },
  { glyph: 1583, kind: "ridden", ch: 104, color: 8, special: 16 },
  { glyph: 1584, kind: "ridden", ch: 104, color: 8, special: 16 },
  { glyph: 1585, kind: "ridden", ch: 104, color: 8, special: 16 },
  { glyph: 1586, kind: "ridden", ch: 104, color: 8, special: 16 },
  { glyph: 1587, kind: "ridden", ch: 105, color: 8, special: 16 },
  { glyph: 1588, kind: "ridden", ch: 105, color: 8, special: 16 },
  { glyph: 1589, kind: "ridden", ch: 105, color: 8, special: 16 },
  { glyph: 1590, kind: "ridden", ch: 105, color: 8, special: 16 },
  { glyph: 1591, kind: "ridden", ch: 105, color: 8, special: 16 },
  { glyph: 1592, kind: "ridden", ch: 105, color: 8, special: 16 },
  { glyph: 1593, kind: "ridden", ch: 106, color: 8, special: 16 },
  { glyph: 1594, kind: "ridden", ch: 106, color: 8, special: 16 },
  { glyph: 1595, kind: "ridden", ch: 106, color: 8, special: 16 },
  { glyph: 1596, kind: "ridden", ch: 107, color: 8, special: 16 },
  { glyph: 1597, kind: "ridden", ch: 107, color: 8, special: 16 },
  { glyph: 1598, kind: "ridden", ch: 107, color: 8, special: 16 },
  { glyph: 1599, kind: "ridden", ch: 107, color: 8, special: 16 },
  { glyph: 1600, kind: "ridden", ch: 108, color: 8, special: 16 },
  { glyph: 1601, kind: "ridden", ch: 109, color: 8, special: 16 },
  { glyph: 1602, kind: "ridden", ch: 109, color: 8, special: 16 },
  { glyph: 1603, kind: "ridden", ch: 109, color: 8, special: 16 },
  { glyph: 1604, kind: "ridden", ch: 110, color: 8, special: 16 },
  { glyph: 1605, kind: "ridden", ch: 110, color: 8, special: 16 },
  { glyph: 1606, kind: "ridden", ch: 110, color: 8, special: 16 },
  { glyph: 1607, kind: "ridden", ch: 111, color: 8, special: 16 },
  { glyph: 1608, kind: "ridden", ch: 111, color: 8, special: 16 },
  { glyph: 1609, kind: "ridden", ch: 111, color: 8, special: 16 },
  { glyph: 1610, kind: "ridden", ch: 111, color: 8, special: 16 },
  { glyph: 1611, kind: "ridden", ch: 111, color: 8, special: 16 },
  { glyph: 1612, kind: "ridden", ch: 111, color: 8, special: 16 },
  { glyph: 1613, kind: "ridden", ch: 111, color: 8, special: 16 },
  { glyph: 1614, kind: "ridden", ch: 111, color: 8, special: 16 },
  { glyph: 1615, kind: "ridden", ch: 112, color: 8, special: 16 },
  { glyph: 1616, kind: "ridden", ch: 112, color: 8, special: 16 },
  { glyph: 1617, kind: "ridden", ch: 112, color: 8, special: 16 },
  { glyph: 1618, kind: "ridden", ch: 113, color: 8, special: 16 },
  { glyph: 1619, kind: "ridden", ch: 113, color: 8, special: 16 },
  { glyph: 1620, kind: "ridden", ch: 113, color: 8, special: 16 },
  { glyph: 1621, kind: "ridden", ch: 113, color: 8, special: 16 },
  { glyph: 1622, kind: "ridden", ch: 113, color: 8, special: 16 },
  { glyph: 1623, kind: "ridden", ch: 113, color: 8, special: 16 },
  { glyph: 1624, kind: "ridden", ch: 113, color: 8, special: 16 },
  { glyph: 1625, kind: "ridden", ch: 114, color: 8, special: 16 },
  { glyph: 1626, kind: "ridden", ch: 114, color: 8, special: 16 },
  { glyph: 1627, kind: "ridden", ch: 114, color: 8, special: 16 },
  { glyph: 1628, kind: "ridden", ch: 114, color: 8, special: 16 },
  { glyph: 1629, kind: "ridden", ch: 114, color: 8, special: 16 },
  { glyph: 1630, kind: "ridden", ch: 114, color: 8, special: 16 },
  { glyph: 1631, kind: "ridden", ch: 115, color: 8, special: 16 },
  { glyph: 1632, kind: "ridden", ch: 115, color: 8, special: 16 },
  { glyph: 1633, kind: "ridden", ch: 115, color: 8, special: 16 },
  { glyph: 1634, kind: "ridden", ch: 115, color: 8, special: 16 },
  { glyph: 1635, kind: "ridden", ch: 116, color: 8, special: 16 },
  { glyph: 1636, kind: "ridden", ch: 116, color: 8, special: 16 },
  { glyph: 1637, kind: "ridden", ch: 117, color: 8, special: 16 },
  { glyph: 1638, kind: "ridden", ch: 117, color: 8, special: 16 },
  { glyph: 1639, kind: "ridden", ch: 117, color: 8, special: 16 },
  { glyph: 1640, kind: "ridden", ch: 117, color: 8, special: 16 },
  { glyph: 1641, kind: "ridden", ch: 117, color: 8, special: 16 },
  { glyph: 1642, kind: "ridden", ch: 117, color: 8, special: 16 },
  { glyph: 1643, kind: "ridden", ch: 118, color: 8, special: 16 },
  { glyph: 1644, kind: "ridden", ch: 118, color: 8, special: 16 },
  { glyph: 1645, kind: "ridden", ch: 118, color: 8, special: 16 },
  { glyph: 1646, kind: "ridden", ch: 118, color: 8, special: 16 },
  { glyph: 1647, kind: "ridden", ch: 118, color: 8, special: 16 },
  { glyph: 1648, kind: "ridden", ch: 118, color: 8, special: 16 },
  { glyph: 1649, kind: "ridden", ch: 119, color: 8, special: 16 },
  { glyph: 1650, kind: "ridden", ch: 119, color: 8, special: 16 },
  { glyph: 1651, kind: "ridden", ch: 119, color: 8, special: 16 },
  { glyph: 1652, kind: "ridden", ch: 119, color: 8, special: 16 },
  { glyph: 1653, kind: "ridden", ch: 120, color: 8, special: 16 },
  { glyph: 1654, kind: "ridden", ch: 120, color: 8, special: 16 },
  { glyph: 1655, kind: "ridden", ch: 121, color: 8, special: 16 },
  { glyph: 1656, kind: "ridden", ch: 121, color: 8, special: 16 },
  { glyph: 1657, kind: "ridden", ch: 122, color: 8, special: 16 },
  { glyph: 1658, kind: "ridden", ch: 65, color: 8, special: 16 },
  { glyph: 1659, kind: "ridden", ch: 65, color: 8, special: 16 },
  { glyph: 1660, kind: "ridden", ch: 65, color: 8, special: 16 },
  { glyph: 1661, kind: "ridden", ch: 65, color: 8, special: 16 },
  { glyph: 1662, kind: "ridden", ch: 65, color: 8, special: 16 },
  { glyph: 1663, kind: "ridden", ch: 66, color: 8, special: 16 },
  { glyph: 1664, kind: "ridden", ch: 66, color: 8, special: 16 },
  { glyph: 1665, kind: "ridden", ch: 66, color: 8, special: 16 },
  { glyph: 1666, kind: "ridden", ch: 66, color: 8, special: 16 },
  { glyph: 1667, kind: "ridden", ch: 67, color: 8, special: 16 },
  { glyph: 1668, kind: "ridden", ch: 67, color: 8, special: 16 },
  { glyph: 1669, kind: "ridden", ch: 67, color: 8, special: 16 },
  { glyph: 1670, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1671, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1672, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1673, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1674, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1675, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1676, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1677, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1678, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1679, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1680, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1681, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1682, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1683, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1684, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1685, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1686, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1687, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1688, kind: "ridden", ch: 69, color: 8, special: 16 },
  { glyph: 1689, kind: "ridden", ch: 69, color: 8, special: 16 },
  { glyph: 1690, kind: "ridden", ch: 69, color: 8, special: 16 },
  { glyph: 1691, kind: "ridden", ch: 69, color: 8, special: 16 },
  { glyph: 1692, kind: "ridden", ch: 69, color: 8, special: 16 },
  { glyph: 1693, kind: "ridden", ch: 70, color: 8, special: 16 },
  { glyph: 1694, kind: "ridden", ch: 70, color: 8, special: 16 },
  { glyph: 1695, kind: "ridden", ch: 70, color: 8, special: 16 },
  { glyph: 1696, kind: "ridden", ch: 70, color: 8, special: 16 },
  { glyph: 1697, kind: "ridden", ch: 70, color: 8, special: 16 },
  { glyph: 1698, kind: "ridden", ch: 70, color: 8, special: 16 },
  { glyph: 1699, kind: "ridden", ch: 70, color: 8, special: 16 },
  { glyph: 1700, kind: "ridden", ch: 71, color: 8, special: 16 },
  { glyph: 1701, kind: "ridden", ch: 71, color: 8, special: 16 },
  { glyph: 1702, kind: "ridden", ch: 71, color: 8, special: 16 },
  { glyph: 1703, kind: "ridden", ch: 71, color: 8, special: 16 },
  { glyph: 1704, kind: "ridden", ch: 72, color: 8, special: 16 },
  { glyph: 1705, kind: "ridden", ch: 72, color: 8, special: 16 },
  { glyph: 1706, kind: "ridden", ch: 72, color: 8, special: 16 },
  { glyph: 1707, kind: "ridden", ch: 72, color: 8, special: 16 },
  { glyph: 1708, kind: "ridden", ch: 72, color: 8, special: 16 },
  { glyph: 1709, kind: "ridden", ch: 72, color: 8, special: 16 },
  { glyph: 1710, kind: "ridden", ch: 72, color: 8, special: 16 },
  { glyph: 1711, kind: "ridden", ch: 72, color: 8, special: 16 },
  { glyph: 1712, kind: "ridden", ch: 72, color: 8, special: 16 },
  { glyph: 1713, kind: "ridden", ch: 74, color: 8, special: 16 },
  { glyph: 1714, kind: "ridden", ch: 75, color: 8, special: 16 },
  { glyph: 1715, kind: "ridden", ch: 75, color: 8, special: 16 },
  { glyph: 1716, kind: "ridden", ch: 75, color: 8, special: 16 },
  { glyph: 1717, kind: "ridden", ch: 75, color: 8, special: 16 },
  { glyph: 1718, kind: "ridden", ch: 76, color: 8, special: 16 },
  { glyph: 1719, kind: "ridden", ch: 76, color: 8, special: 16 },
  { glyph: 1720, kind: "ridden", ch: 76, color: 8, special: 16 },
  { glyph: 1721, kind: "ridden", ch: 76, color: 8, special: 16 },
  { glyph: 1722, kind: "ridden", ch: 77, color: 8, special: 16 },
  { glyph: 1723, kind: "ridden", ch: 77, color: 8, special: 16 },
  { glyph: 1724, kind: "ridden", ch: 77, color: 8, special: 16 },
  { glyph: 1725, kind: "ridden", ch: 77, color: 8, special: 16 },
  { glyph: 1726, kind: "ridden", ch: 77, color: 8, special: 16 },
  { glyph: 1727, kind: "ridden", ch: 77, color: 8, special: 16 },
  { glyph: 1728, kind: "ridden", ch: 77, color: 8, special: 16 },
  { glyph: 1729, kind: "ridden", ch: 77, color: 8, special: 16 },
  { glyph: 1730, kind: "ridden", ch: 78, color: 8, special: 16 },
  { glyph: 1731, kind: "ridden", ch: 78, color: 8, special: 16 },
  { glyph: 1732, kind: "ridden", ch: 78, color: 8, special: 16 },
  { glyph: 1733, kind: "ridden", ch: 78, color: 8, special: 16 },
  { glyph: 1734, kind: "ridden", ch: 78, color: 8, special: 16 },
  { glyph: 1735, kind: "ridden", ch: 78, color: 8, special: 16 },
  { glyph: 1736, kind: "ridden", ch: 78, color: 8, special: 16 },
  { glyph: 1737, kind: "ridden", ch: 78, color: 8, special: 16 },
  { glyph: 1738, kind: "ridden", ch: 79, color: 8, special: 16 },
  { glyph: 1739, kind: "ridden", ch: 79, color: 8, special: 16 },
  { glyph: 1740, kind: "ridden", ch: 79, color: 8, special: 16 },
  { glyph: 1741, kind: "ridden", ch: 80, color: 8, special: 16 },
  { glyph: 1742, kind: "ridden", ch: 80, color: 8, special: 16 },
  { glyph: 1743, kind: "ridden", ch: 80, color: 8, special: 16 },
  { glyph: 1744, kind: "ridden", ch: 80, color: 8, special: 16 },
  { glyph: 1745, kind: "ridden", ch: 81, color: 8, special: 16 },
  { glyph: 1746, kind: "ridden", ch: 81, color: 8, special: 16 },
  { glyph: 1747, kind: "ridden", ch: 82, color: 8, special: 16 },
  { glyph: 1748, kind: "ridden", ch: 82, color: 8, special: 16 },
  { glyph: 1749, kind: "ridden", ch: 83, color: 8, special: 16 },
  { glyph: 1750, kind: "ridden", ch: 83, color: 8, special: 16 },
  { glyph: 1751, kind: "ridden", ch: 83, color: 8, special: 16 },
  { glyph: 1752, kind: "ridden", ch: 83, color: 8, special: 16 },
  { glyph: 1753, kind: "ridden", ch: 83, color: 8, special: 16 },
  { glyph: 1754, kind: "ridden", ch: 83, color: 8, special: 16 },
  { glyph: 1755, kind: "ridden", ch: 84, color: 8, special: 16 },
  { glyph: 1756, kind: "ridden", ch: 84, color: 8, special: 16 },
  { glyph: 1757, kind: "ridden", ch: 84, color: 8, special: 16 },
  { glyph: 1758, kind: "ridden", ch: 84, color: 8, special: 16 },
  { glyph: 1759, kind: "ridden", ch: 84, color: 8, special: 16 },
  { glyph: 1760, kind: "ridden", ch: 85, color: 8, special: 16 },
  { glyph: 1761, kind: "ridden", ch: 86, color: 8, special: 16 },
  { glyph: 1762, kind: "ridden", ch: 86, color: 8, special: 16 },
  { glyph: 1763, kind: "ridden", ch: 86, color: 8, special: 16 },
  { glyph: 1764, kind: "ridden", ch: 87, color: 8, special: 16 },
  { glyph: 1765, kind: "ridden", ch: 87, color: 8, special: 16 },
  { glyph: 1766, kind: "ridden", ch: 87, color: 8, special: 16 },
  { glyph: 1767, kind: "ridden", ch: 88, color: 8, special: 16 },
  { glyph: 1768, kind: "ridden", ch: 89, color: 8, special: 16 },
  { glyph: 1769, kind: "ridden", ch: 89, color: 8, special: 16 },
  { glyph: 1770, kind: "ridden", ch: 89, color: 8, special: 16 },
  { glyph: 1771, kind: "ridden", ch: 89, color: 8, special: 16 },
  { glyph: 1772, kind: "ridden", ch: 89, color: 8, special: 16 },
  { glyph: 1773, kind: "ridden", ch: 89, color: 8, special: 16 },
  { glyph: 1774, kind: "ridden", ch: 90, color: 8, special: 16 },
  { glyph: 1775, kind: "ridden", ch: 90, color: 8, special: 16 },
  { glyph: 1776, kind: "ridden", ch: 90, color: 8, special: 16 },
  { glyph: 1777, kind: "ridden", ch: 90, color: 8, special: 16 },
  { glyph: 1778, kind: "ridden", ch: 90, color: 8, special: 16 },
  { glyph: 1779, kind: "ridden", ch: 90, color: 8, special: 16 },
  { glyph: 1780, kind: "ridden", ch: 90, color: 8, special: 16 },
  { glyph: 1781, kind: "ridden", ch: 90, color: 8, special: 16 },
  { glyph: 1782, kind: "ridden", ch: 90, color: 8, special: 16 },
  { glyph: 1783, kind: "ridden", ch: 90, color: 8, special: 16 },
  { glyph: 1784, kind: "ridden", ch: 39, color: 8, special: 16 },
  { glyph: 1785, kind: "ridden", ch: 39, color: 8, special: 16 },
  { glyph: 1786, kind: "ridden", ch: 39, color: 8, special: 16 },
  { glyph: 1787, kind: "ridden", ch: 39, color: 8, special: 16 },
  { glyph: 1788, kind: "ridden", ch: 39, color: 8, special: 16 },
  { glyph: 1789, kind: "ridden", ch: 39, color: 8, special: 16 },
  { glyph: 1790, kind: "ridden", ch: 39, color: 8, special: 16 },
  { glyph: 1791, kind: "ridden", ch: 39, color: 8, special: 16 },
  { glyph: 1792, kind: "ridden", ch: 39, color: 8, special: 16 },
  { glyph: 1793, kind: "ridden", ch: 39, color: 8, special: 16 },
  { glyph: 1794, kind: "ridden", ch: 39, color: 8, special: 16 },
  { glyph: 1795, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1796, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1797, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1798, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1799, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1800, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1801, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1802, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1803, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1804, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1805, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1806, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1807, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1808, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1809, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1810, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1811, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1812, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1813, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1814, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1815, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1816, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1817, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1818, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1819, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1820, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1821, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1822, kind: "ridden", ch: 32, color: 8, special: 16 },
  { glyph: 1823, kind: "ridden", ch: 32, color: 8, special: 16 },
  { glyph: 1824, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1825, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1826, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1827, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1828, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1829, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1830, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1831, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1832, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1833, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1834, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1835, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1836, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1837, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1838, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1839, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1840, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1841, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1842, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1843, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1844, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1845, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1846, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1847, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1848, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1849, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1850, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1851, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1852, kind: "ridden", ch: 59, color: 8, special: 16 },
  { glyph: 1853, kind: "ridden", ch: 59, color: 8, special: 16 },
  { glyph: 1854, kind: "ridden", ch: 59, color: 8, special: 16 },
  { glyph: 1855, kind: "ridden", ch: 59, color: 8, special: 16 },
  { glyph: 1856, kind: "ridden", ch: 59, color: 8, special: 16 },
  { glyph: 1857, kind: "ridden", ch: 59, color: 8, special: 16 },
  { glyph: 1858, kind: "ridden", ch: 58, color: 8, special: 16 },
  { glyph: 1859, kind: "ridden", ch: 58, color: 8, special: 16 },
  { glyph: 1860, kind: "ridden", ch: 58, color: 8, special: 16 },
  { glyph: 1861, kind: "ridden", ch: 58, color: 8, special: 16 },
  { glyph: 1862, kind: "ridden", ch: 58, color: 8, special: 16 },
  { glyph: 1863, kind: "ridden", ch: 58, color: 8, special: 16 },
  { glyph: 1864, kind: "ridden", ch: 58, color: 8, special: 16 },
  { glyph: 1865, kind: "ridden", ch: 58, color: 8, special: 16 },
  { glyph: 1866, kind: "ridden", ch: 126, color: 8, special: 16 },
  { glyph: 1867, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1868, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1869, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1870, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1871, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1872, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1873, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1874, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1875, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1876, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1877, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1878, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1879, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1880, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1881, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1882, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1883, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1884, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1885, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1886, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1887, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1888, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1889, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1890, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1891, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1892, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1893, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1894, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1895, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1896, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1897, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1898, kind: "ridden", ch: 72, color: 8, special: 16 },
  { glyph: 1899, kind: "ridden", ch: 68, color: 8, special: 16 },
  { glyph: 1900, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1901, kind: "ridden", ch: 38, color: 8, special: 16 },
  { glyph: 1902, kind: "ridden", ch: 115, color: 8, special: 16 },
  { glyph: 1903, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1904, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1905, kind: "ridden", ch: 72, color: 8, special: 16 },
  { glyph: 1906, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1907, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1908, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1909, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1910, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1911, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1912, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1913, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1914, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1915, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1916, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1917, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1918, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1919, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1920, kind: "ridden", ch: 64, color: 8, special: 16 },
  { glyph: 1921, kind: "obj", ch: 93, color: 8, special: 0 },
  { glyph: 1922, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1923, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1924, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1925, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1926, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1927, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1928, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1929, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1930, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1931, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1932, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1933, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1934, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1935, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1936, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1937, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1938, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1939, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1940, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1941, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1942, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1943, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1944, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1945, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1946, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1947, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1948, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1949, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1950, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1951, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1952, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1953, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1954, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1955, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1956, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1957, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1958, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1959, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1960, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1961, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1962, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1963, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1964, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1965, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1966, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1967, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1968, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1969, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1970, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1971, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1972, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1973, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1974, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1975, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1976, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1977, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1978, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1979, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1980, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1981, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1982, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1983, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1984, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1985, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1986, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1987, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1988, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1989, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1990, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1991, kind: "obj", ch: 41, color: 8, special: 0 },
  { glyph: 1992, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 1993, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 1994, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 1995, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 1996, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 1997, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 1998, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 1999, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2e3, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2001, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2002, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2003, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2004, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2005, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2006, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2007, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2008, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2009, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2010, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2011, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2012, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2013, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2014, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2015, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2016, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2017, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2018, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2019, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2020, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2021, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2022, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2023, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2024, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2025, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2026, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2027, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2028, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2029, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2030, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2031, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2032, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2033, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2034, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2035, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2036, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2037, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2038, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2039, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2040, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2041, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2042, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2043, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2044, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2045, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2046, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2047, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2048, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2049, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2050, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2051, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2052, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2053, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2054, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2055, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2056, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2057, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2058, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2059, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2060, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2061, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2062, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2063, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2064, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2065, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2066, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2067, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2068, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2069, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2070, kind: "obj", ch: 91, color: 8, special: 0 },
  { glyph: 2071, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2072, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2073, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2074, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2075, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2076, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2077, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2078, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2079, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2080, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2081, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2082, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2083, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2084, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2085, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2086, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2087, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2088, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2089, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2090, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2091, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2092, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2093, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2094, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2095, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2096, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2097, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2098, kind: "obj", ch: 61, color: 8, special: 0 },
  { glyph: 2099, kind: "obj", ch: 34, color: 8, special: 0 },
  { glyph: 2100, kind: "obj", ch: 34, color: 8, special: 0 },
  { glyph: 2101, kind: "obj", ch: 34, color: 8, special: 0 },
  { glyph: 2102, kind: "obj", ch: 34, color: 8, special: 0 },
  { glyph: 2103, kind: "obj", ch: 34, color: 8, special: 0 },
  { glyph: 2104, kind: "obj", ch: 34, color: 8, special: 0 },
  { glyph: 2105, kind: "obj", ch: 34, color: 8, special: 0 },
  { glyph: 2106, kind: "obj", ch: 34, color: 8, special: 0 },
  { glyph: 2107, kind: "obj", ch: 34, color: 8, special: 0 },
  { glyph: 2108, kind: "obj", ch: 34, color: 8, special: 0 },
  { glyph: 2109, kind: "obj", ch: 34, color: 8, special: 0 },
  { glyph: 2110, kind: "obj", ch: 34, color: 8, special: 0 },
  { glyph: 2111, kind: "obj", ch: 34, color: 8, special: 0 },
  { glyph: 2112, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2113, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2114, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2115, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2116, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2117, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2118, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2119, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2120, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2121, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2122, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2123, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2124, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2125, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2126, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2127, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2128, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2129, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2130, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2131, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2132, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2133, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2134, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2135, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2136, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2137, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2138, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2139, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2140, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2141, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2142, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2143, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2144, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2145, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2146, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2147, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2148, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2149, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2150, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2151, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2152, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2153, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2154, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2155, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2156, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2157, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2158, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2159, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2160, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2161, kind: "obj", ch: 40, color: 8, special: 0 },
  { glyph: 2162, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2163, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2164, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2165, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2166, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2167, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2168, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2169, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2170, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2171, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2172, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2173, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2174, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2175, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2176, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2177, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2178, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2179, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2180, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2181, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2182, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2183, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2184, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2185, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2186, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2187, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2188, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2189, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2190, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2191, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2192, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2193, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2194, kind: "obj", ch: 37, color: 8, special: 0 },
  { glyph: 2195, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2196, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2197, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2198, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2199, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2200, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2201, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2202, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2203, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2204, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2205, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2206, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2207, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2208, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2209, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2210, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2211, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2212, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2213, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2214, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2215, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2216, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2217, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2218, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2219, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2220, kind: "obj", ch: 33, color: 8, special: 0 },
  { glyph: 2221, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2222, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2223, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2224, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2225, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2226, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2227, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2228, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2229, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2230, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2231, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2232, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2233, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2234, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2235, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2236, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2237, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2238, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2239, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2240, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2241, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2242, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2243, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2244, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2245, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2246, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2247, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2248, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2249, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2250, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2251, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2252, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2253, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2254, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2255, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2256, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2257, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2258, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2259, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2260, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2261, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2262, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2263, kind: "obj", ch: 63, color: 8, special: 0 },
  { glyph: 2264, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2265, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2266, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2267, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2268, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2269, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2270, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2271, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2272, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2273, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2274, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2275, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2276, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2277, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2278, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2279, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2280, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2281, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2282, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2283, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2284, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2285, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2286, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2287, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2288, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2289, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2290, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2291, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2292, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2293, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2294, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2295, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2296, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2297, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2298, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2299, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2300, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2301, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2302, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2303, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2304, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2305, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2306, kind: "obj", ch: 43, color: 8, special: 0 },
  { glyph: 2307, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2308, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2309, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2310, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2311, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2312, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2313, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2314, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2315, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2316, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2317, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2318, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2319, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2320, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2321, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2322, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2323, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2324, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2325, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2326, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2327, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2328, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2329, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2330, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2331, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2332, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2333, kind: "obj", ch: 47, color: 8, special: 0 },
  { glyph: 2334, kind: "obj", ch: 36, color: 8, special: 0 },
  { glyph: 2335, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2336, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2337, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2338, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2339, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2340, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2341, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2342, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2343, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2344, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2345, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2346, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2347, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2348, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2349, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2350, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2351, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2352, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2353, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2354, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2355, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2356, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2357, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2358, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2359, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2360, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2361, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2362, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2363, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2364, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2365, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2366, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2367, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2368, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2369, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2370, kind: "obj", ch: 42, color: 8, special: 0 },
  { glyph: 2371, kind: "obj", ch: 96, color: 8, special: 0 },
  { glyph: 2372, kind: "obj", ch: 96, color: 8, special: 0 },
  { glyph: 2373, kind: "obj", ch: 48, color: 8, special: 0 },
  { glyph: 2374, kind: "obj", ch: 95, color: 8, special: 0 },
  { glyph: 2375, kind: "obj", ch: 46, color: 8, special: 0 },
  { glyph: 2376, kind: "obj", ch: 46, color: 8, special: 0 },
  { glyph: 2377, kind: "cmap", ch: 32, color: 8, special: 0 },
  { glyph: 2378, kind: "cmap", ch: 124, color: 8, special: 0 },
  { glyph: 2379, kind: "cmap", ch: 45, color: 8, special: 0 },
  { glyph: 2380, kind: "cmap", ch: 45, color: 8, special: 0 },
  { glyph: 2381, kind: "cmap", ch: 45, color: 8, special: 0 },
  { glyph: 2382, kind: "cmap", ch: 45, color: 8, special: 0 },
  { glyph: 2383, kind: "cmap", ch: 45, color: 8, special: 0 },
  { glyph: 2384, kind: "cmap", ch: 45, color: 8, special: 0 },
  { glyph: 2385, kind: "cmap", ch: 45, color: 8, special: 0 },
  { glyph: 2386, kind: "cmap", ch: 45, color: 8, special: 0 },
  { glyph: 2387, kind: "cmap", ch: 124, color: 8, special: 0 },
  { glyph: 2388, kind: "cmap", ch: 124, color: 8, special: 0 },
  { glyph: 2389, kind: "cmap", ch: 46, color: 8, special: 0 },
  { glyph: 2390, kind: "cmap", ch: 45, color: 8, special: 0 },
  { glyph: 2391, kind: "cmap", ch: 124, color: 8, special: 0 },
  { glyph: 2392, kind: "cmap", ch: 43, color: 8, special: 0 },
  { glyph: 2393, kind: "cmap", ch: 43, color: 8, special: 0 },
  { glyph: 2394, kind: "cmap", ch: 35, color: 8, special: 0 },
  { glyph: 2395, kind: "cmap", ch: 35, color: 8, special: 0 },
  { glyph: 2396, kind: "cmap", ch: 46, color: 8, special: 0 },
  { glyph: 2397, kind: "cmap", ch: 32, color: 8, special: 0 },
  { glyph: 2398, kind: "cmap", ch: 35, color: 8, special: 0 },
  { glyph: 2399, kind: "cmap", ch: 35, color: 8, special: 0 },
  { glyph: 2400, kind: "cmap", ch: 60, color: 8, special: 0 },
  { glyph: 2401, kind: "cmap", ch: 62, color: 8, special: 0 },
  { glyph: 2402, kind: "cmap", ch: 60, color: 8, special: 0 },
  { glyph: 2403, kind: "cmap", ch: 62, color: 8, special: 0 },
  { glyph: 2404, kind: "cmap", ch: 95, color: 8, special: 0 },
  { glyph: 2405, kind: "cmap", ch: 124, color: 8, special: 0 },
  { glyph: 2406, kind: "cmap", ch: 92, color: 8, special: 0 },
  { glyph: 2407, kind: "cmap", ch: 35, color: 8, special: 0 },
  { glyph: 2408, kind: "cmap", ch: 123, color: 8, special: 0 },
  { glyph: 2409, kind: "cmap", ch: 125, color: 8, special: 0 },
  { glyph: 2410, kind: "cmap", ch: 46, color: 8, special: 256 },
  { glyph: 2411, kind: "cmap", ch: 125, color: 8, special: 128 },
  { glyph: 2412, kind: "cmap", ch: 46, color: 8, special: 0 },
  { glyph: 2413, kind: "cmap", ch: 46, color: 8, special: 0 },
  { glyph: 2414, kind: "cmap", ch: 35, color: 8, special: 0 },
  { glyph: 2415, kind: "cmap", ch: 35, color: 8, special: 0 },
  { glyph: 2416, kind: "cmap", ch: 32, color: 8, special: 0 },
  { glyph: 2417, kind: "cmap", ch: 35, color: 8, special: 0 },
  { glyph: 2418, kind: "cmap", ch: 125, color: 8, special: 0 },
  { glyph: 2419, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2420, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2421, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2422, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2423, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2424, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2425, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2426, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2427, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2428, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2429, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2430, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2431, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2432, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2433, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2434, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2435, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2436, kind: "cmap", ch: 34, color: 8, special: 0 },
  { glyph: 2437, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2438, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2439, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2440, kind: "cmap", ch: 94, color: 8, special: 0 },
  { glyph: 2441, kind: "cmap", ch: 126, color: 8, special: 0 },
  { glyph: 2442, kind: "cmap", ch: 124, color: 8, special: 0 },
  { glyph: 2443, kind: "cmap", ch: 45, color: 8, special: 0 },
  { glyph: 2444, kind: "cmap", ch: 92, color: 8, special: 0 },
  { glyph: 2445, kind: "cmap", ch: 47, color: 8, special: 0 },
  { glyph: 2446, kind: "cmap", ch: 42, color: 8, special: 0 },
  { glyph: 2447, kind: "cmap", ch: 33, color: 8, special: 0 },
  { glyph: 2448, kind: "cmap", ch: 41, color: 8, special: 0 },
  { glyph: 2449, kind: "cmap", ch: 40, color: 8, special: 0 },
  { glyph: 2450, kind: "cmap", ch: 48, color: 8, special: 0 },
  { glyph: 2451, kind: "cmap", ch: 35, color: 8, special: 0 },
  { glyph: 2452, kind: "cmap", ch: 64, color: 8, special: 0 },
  { glyph: 2453, kind: "cmap", ch: 42, color: 8, special: 0 },
  { glyph: 2454, kind: "cmap", ch: 35, color: 8, special: 0 },
  { glyph: 2455, kind: "cmap", ch: 63, color: 8, special: 0 },
  { glyph: 2456, kind: "cmap", ch: 47, color: 8, special: 0 },
  { glyph: 2457, kind: "cmap", ch: 45, color: 8, special: 0 },
  { glyph: 2458, kind: "cmap", ch: 92, color: 8, special: 0 },
  { glyph: 2459, kind: "cmap", ch: 124, color: 8, special: 0 },
  { glyph: 2460, kind: "cmap", ch: 124, color: 8, special: 0 },
  { glyph: 2461, kind: "cmap", ch: 92, color: 8, special: 0 },
  { glyph: 2462, kind: "cmap", ch: 45, color: 8, special: 0 },
  { glyph: 2463, kind: "cmap", ch: 47, color: 8, special: 0 },
  { glyph: 2464, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2465, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2466, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2467, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2468, kind: "explode", ch: 32, color: 8, special: 0 },
  { glyph: 2469, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2470, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2471, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2472, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2473, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2474, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2475, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2476, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2477, kind: "explode", ch: 32, color: 8, special: 0 },
  { glyph: 2478, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2479, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2480, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2481, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2482, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2483, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2484, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2485, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2486, kind: "explode", ch: 32, color: 8, special: 0 },
  { glyph: 2487, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2488, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2489, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2490, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2491, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2492, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2493, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2494, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2495, kind: "explode", ch: 32, color: 8, special: 0 },
  { glyph: 2496, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2497, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2498, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2499, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2500, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2501, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2502, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2503, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2504, kind: "explode", ch: 32, color: 8, special: 0 },
  { glyph: 2505, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2506, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2507, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2508, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2509, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2510, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2511, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2512, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2513, kind: "explode", ch: 32, color: 8, special: 0 },
  { glyph: 2514, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2515, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2516, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2517, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2518, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2519, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2520, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2521, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2522, kind: "explode", ch: 32, color: 8, special: 0 },
  { glyph: 2523, kind: "explode", ch: 124, color: 8, special: 0 },
  { glyph: 2524, kind: "explode", ch: 92, color: 8, special: 0 },
  { glyph: 2525, kind: "explode", ch: 45, color: 8, special: 0 },
  { glyph: 2526, kind: "explode", ch: 47, color: 8, special: 0 },
  { glyph: 2527, kind: "zap", ch: 124, color: 8, special: 0 },
  { glyph: 2528, kind: "zap", ch: 45, color: 8, special: 0 },
  { glyph: 2529, kind: "zap", ch: 92, color: 8, special: 0 },
  { glyph: 2530, kind: "zap", ch: 47, color: 8, special: 0 },
  { glyph: 2531, kind: "zap", ch: 124, color: 8, special: 0 },
  { glyph: 2532, kind: "zap", ch: 45, color: 8, special: 0 },
  { glyph: 2533, kind: "zap", ch: 92, color: 8, special: 0 },
  { glyph: 2534, kind: "zap", ch: 47, color: 8, special: 0 },
  { glyph: 2535, kind: "zap", ch: 124, color: 8, special: 0 },
  { glyph: 2536, kind: "zap", ch: 45, color: 8, special: 0 },
  { glyph: 2537, kind: "zap", ch: 92, color: 8, special: 0 },
  { glyph: 2538, kind: "zap", ch: 47, color: 8, special: 0 },
  { glyph: 2539, kind: "zap", ch: 124, color: 8, special: 0 },
  { glyph: 2540, kind: "zap", ch: 45, color: 8, special: 0 },
  { glyph: 2541, kind: "zap", ch: 92, color: 8, special: 0 },
  { glyph: 2542, kind: "zap", ch: 47, color: 8, special: 0 },
  { glyph: 2543, kind: "zap", ch: 124, color: 8, special: 0 },
  { glyph: 2544, kind: "zap", ch: 45, color: 8, special: 0 },
  { glyph: 2545, kind: "zap", ch: 92, color: 8, special: 0 },
  { glyph: 2546, kind: "zap", ch: 47, color: 8, special: 0 },
  { glyph: 2547, kind: "zap", ch: 124, color: 8, special: 0 },
  { glyph: 2548, kind: "zap", ch: 45, color: 8, special: 0 },
  { glyph: 2549, kind: "zap", ch: 92, color: 8, special: 0 },
  { glyph: 2550, kind: "zap", ch: 47, color: 8, special: 0 },
  { glyph: 2551, kind: "zap", ch: 124, color: 8, special: 0 },
  { glyph: 2552, kind: "zap", ch: 45, color: 8, special: 0 },
  { glyph: 2553, kind: "zap", ch: 92, color: 8, special: 0 },
  { glyph: 2554, kind: "zap", ch: 47, color: 8, special: 0 },
  { glyph: 2555, kind: "zap", ch: 124, color: 8, special: 0 },
  { glyph: 2556, kind: "zap", ch: 45, color: 8, special: 0 },
  { glyph: 2557, kind: "zap", ch: 92, color: 8, special: 0 },
  { glyph: 2558, kind: "zap", ch: 47, color: 8, special: 0 },
  { glyph: 2559, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2560, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2561, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2562, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2563, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2564, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2565, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2566, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2567, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2568, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2569, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2570, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2571, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2572, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2573, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2574, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2575, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2576, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2577, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2578, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2579, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2580, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2581, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2582, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2583, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2584, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2585, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2586, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2587, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2588, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2589, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2590, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2591, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2592, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2593, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2594, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2595, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2596, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2597, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2598, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2599, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2600, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2601, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2602, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2603, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2604, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2605, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2606, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2607, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2608, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2609, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2610, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2611, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2612, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2613, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2614, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2615, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2616, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2617, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2618, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2619, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2620, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2621, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2622, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2623, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2624, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2625, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2626, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2627, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2628, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2629, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2630, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2631, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2632, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2633, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2634, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2635, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2636, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2637, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2638, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2639, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2640, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2641, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2642, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2643, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2644, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2645, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2646, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2647, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2648, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2649, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2650, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2651, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2652, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2653, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2654, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2655, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2656, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2657, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2658, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2659, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2660, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2661, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2662, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2663, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2664, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2665, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2666, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2667, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2668, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2669, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2670, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2671, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2672, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2673, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2674, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2675, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2676, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2677, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2678, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2679, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2680, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2681, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2682, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2683, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2684, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2685, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2686, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2687, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2688, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2689, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2690, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2691, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2692, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2693, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2694, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2695, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2696, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2697, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2698, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2699, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2700, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2701, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2702, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2703, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2704, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2705, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2706, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2707, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2708, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2709, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2710, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2711, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2712, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2713, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2714, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2715, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2716, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2717, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2718, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2719, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2720, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2721, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2722, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2723, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2724, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2725, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2726, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2727, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2728, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2729, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2730, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2731, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2732, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2733, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2734, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2735, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2736, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2737, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2738, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2739, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2740, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2741, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2742, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2743, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2744, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2745, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2746, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2747, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2748, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2749, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2750, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2751, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2752, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2753, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2754, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2755, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2756, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2757, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2758, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2759, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2760, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2761, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2762, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2763, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2764, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2765, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2766, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2767, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2768, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2769, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2770, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2771, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2772, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2773, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2774, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2775, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2776, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2777, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2778, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2779, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2780, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2781, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2782, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2783, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2784, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2785, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2786, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2787, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2788, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2789, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2790, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2791, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2792, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2793, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2794, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2795, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2796, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2797, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2798, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2799, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2800, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2801, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2802, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2803, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2804, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2805, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2806, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2807, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2808, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2809, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2810, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2811, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2812, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2813, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2814, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2815, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2816, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2817, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2818, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2819, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2820, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2821, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2822, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2823, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2824, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2825, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2826, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2827, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2828, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2829, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2830, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2831, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2832, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2833, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2834, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2835, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2836, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2837, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2838, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2839, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2840, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2841, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2842, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2843, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2844, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2845, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2846, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2847, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2848, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2849, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2850, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2851, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2852, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2853, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2854, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2855, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2856, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2857, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2858, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2859, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2860, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2861, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2862, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2863, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2864, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2865, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2866, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2867, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2868, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2869, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2870, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2871, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2872, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2873, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2874, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2875, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2876, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2877, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2878, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2879, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2880, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2881, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2882, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2883, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2884, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2885, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2886, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2887, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2888, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2889, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2890, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2891, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2892, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2893, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2894, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2895, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2896, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2897, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2898, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2899, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2900, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2901, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2902, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2903, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2904, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2905, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2906, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2907, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2908, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2909, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2910, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2911, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2912, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2913, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2914, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2915, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2916, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2917, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2918, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2919, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2920, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2921, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2922, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2923, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2924, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2925, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2926, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2927, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2928, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2929, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2930, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2931, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2932, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2933, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2934, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2935, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2936, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2937, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2938, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2939, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2940, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2941, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2942, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2943, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2944, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2945, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2946, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2947, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2948, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2949, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2950, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2951, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2952, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2953, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2954, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2955, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2956, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2957, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2958, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2959, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2960, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2961, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2962, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2963, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2964, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2965, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2966, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2967, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2968, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2969, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2970, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2971, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2972, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2973, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2974, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2975, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2976, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2977, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2978, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2979, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2980, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2981, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2982, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2983, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2984, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2985, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2986, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2987, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2988, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2989, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2990, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2991, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2992, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2993, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2994, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2995, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 2996, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 2997, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 2998, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 2999, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3e3, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3001, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3002, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3003, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3004, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3005, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3006, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3007, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3008, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3009, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3010, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3011, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3012, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3013, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3014, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3015, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3016, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3017, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3018, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3019, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3020, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3021, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3022, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3023, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3024, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3025, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3026, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3027, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3028, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3029, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3030, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3031, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3032, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3033, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3034, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3035, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3036, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3037, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3038, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3039, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3040, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3041, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3042, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3043, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3044, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3045, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3046, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3047, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3048, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3049, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3050, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3051, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3052, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3053, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3054, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3055, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3056, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3057, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3058, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3059, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3060, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3061, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3062, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3063, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3064, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3065, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3066, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3067, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3068, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3069, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3070, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3071, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3072, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3073, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3074, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3075, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3076, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3077, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3078, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3079, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3080, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3081, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3082, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3083, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3084, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3085, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3086, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3087, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3088, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3089, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3090, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3091, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3092, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3093, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3094, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3095, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3096, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3097, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3098, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3099, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3100, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3101, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3102, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3103, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3104, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3105, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3106, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3107, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3108, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3109, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3110, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3111, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3112, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3113, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3114, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3115, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3116, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3117, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3118, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3119, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3120, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3121, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3122, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3123, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3124, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3125, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3126, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3127, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3128, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3129, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3130, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3131, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3132, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3133, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3134, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3135, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3136, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3137, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3138, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3139, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3140, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3141, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3142, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3143, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3144, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3145, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3146, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3147, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3148, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3149, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3150, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3151, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3152, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3153, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3154, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3155, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3156, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3157, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3158, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3159, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3160, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3161, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3162, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3163, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3164, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3165, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3166, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3167, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3168, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3169, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3170, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3171, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3172, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3173, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3174, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3175, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3176, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3177, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3178, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3179, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3180, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3181, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3182, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3183, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3184, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3185, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3186, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3187, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3188, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3189, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3190, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3191, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3192, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3193, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3194, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3195, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3196, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3197, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3198, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3199, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3200, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3201, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3202, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3203, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3204, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3205, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3206, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3207, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3208, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3209, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3210, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3211, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3212, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3213, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3214, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3215, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3216, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3217, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3218, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3219, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3220, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3221, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3222, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3223, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3224, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3225, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3226, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3227, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3228, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3229, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3230, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3231, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3232, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3233, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3234, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3235, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3236, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3237, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3238, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3239, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3240, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3241, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3242, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3243, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3244, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3245, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3246, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3247, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3248, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3249, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3250, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3251, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3252, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3253, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3254, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3255, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3256, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3257, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3258, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3259, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3260, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3261, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3262, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3263, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3264, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3265, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3266, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3267, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3268, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3269, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3270, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3271, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3272, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3273, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3274, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3275, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3276, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3277, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3278, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3279, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3280, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3281, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3282, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3283, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3284, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3285, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3286, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3287, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3288, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3289, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3290, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3291, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3292, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3293, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3294, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3295, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3296, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3297, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3298, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3299, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3300, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3301, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3302, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3303, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3304, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3305, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3306, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3307, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3308, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3309, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3310, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3311, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3312, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3313, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3314, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3315, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3316, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3317, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3318, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3319, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3320, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3321, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3322, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3323, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3324, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3325, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3326, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3327, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3328, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3329, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3330, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3331, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3332, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3333, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3334, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3335, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3336, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3337, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3338, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3339, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3340, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3341, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3342, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3343, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3344, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3345, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3346, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3347, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3348, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3349, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3350, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3351, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3352, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3353, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3354, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3355, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3356, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3357, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3358, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3359, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3360, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3361, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3362, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3363, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3364, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3365, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3366, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3367, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3368, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3369, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3370, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3371, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3372, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3373, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3374, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3375, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3376, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3377, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3378, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3379, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3380, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3381, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3382, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3383, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3384, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3385, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3386, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3387, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3388, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3389, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3390, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3391, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3392, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3393, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3394, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3395, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3396, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3397, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3398, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3399, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3400, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3401, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3402, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3403, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3404, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3405, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3406, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3407, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3408, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3409, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3410, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3411, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3412, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3413, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3414, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3415, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3416, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3417, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3418, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3419, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3420, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3421, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3422, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3423, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3424, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3425, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3426, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3427, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3428, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3429, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3430, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3431, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3432, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3433, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3434, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3435, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3436, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3437, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3438, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3439, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3440, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3441, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3442, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3443, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3444, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3445, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3446, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3447, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3448, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3449, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3450, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3451, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3452, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3453, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3454, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3455, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3456, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3457, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3458, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3459, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3460, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3461, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3462, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3463, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3464, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3465, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3466, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3467, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3468, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3469, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3470, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3471, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3472, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3473, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3474, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3475, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3476, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3477, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3478, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3479, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3480, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3481, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3482, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3483, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3484, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3485, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3486, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3487, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3488, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3489, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3490, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3491, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3492, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3493, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3494, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3495, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3496, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3497, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3498, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3499, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3500, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3501, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3502, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3503, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3504, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3505, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3506, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3507, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3508, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3509, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3510, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3511, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3512, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3513, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3514, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3515, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3516, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3517, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3518, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3519, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3520, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3521, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3522, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3523, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3524, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3525, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3526, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3527, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3528, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3529, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3530, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3531, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3532, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3533, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3534, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3535, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3536, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3537, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3538, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3539, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3540, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3541, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3542, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3543, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3544, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3545, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3546, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3547, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3548, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3549, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3550, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3551, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3552, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3553, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3554, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3555, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3556, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3557, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3558, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3559, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3560, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3561, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3562, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3563, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3564, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3565, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3566, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3567, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3568, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3569, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3570, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3571, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3572, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3573, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3574, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3575, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3576, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3577, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3578, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3579, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3580, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3581, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3582, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3583, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3584, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3585, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3586, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3587, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3588, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3589, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3590, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3591, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3592, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3593, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3594, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3595, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3596, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3597, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3598, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3599, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3600, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3601, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3602, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3603, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3604, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3605, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3606, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3607, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3608, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3609, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3610, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3611, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3612, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3613, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3614, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3615, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3616, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3617, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3618, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3619, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3620, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3621, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3622, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3623, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3624, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3625, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3626, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3627, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3628, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3629, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3630, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3631, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3632, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3633, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3634, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3635, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3636, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3637, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3638, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3639, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3640, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3641, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3642, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3643, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3644, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3645, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3646, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3647, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3648, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3649, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3650, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3651, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3652, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3653, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3654, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3655, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3656, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3657, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3658, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3659, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3660, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3661, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3662, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3663, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3664, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3665, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3666, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3667, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3668, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3669, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3670, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3671, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3672, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3673, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3674, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3675, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3676, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3677, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3678, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3679, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3680, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3681, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3682, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3683, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3684, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3685, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3686, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3687, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3688, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3689, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3690, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3691, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3692, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3693, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3694, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3695, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3696, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3697, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3698, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3699, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3700, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3701, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3702, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3703, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3704, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3705, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3706, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3707, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3708, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3709, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3710, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3711, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3712, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3713, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3714, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3715, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3716, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3717, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3718, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3719, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3720, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3721, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3722, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3723, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3724, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3725, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3726, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3727, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3728, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3729, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3730, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3731, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3732, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3733, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3734, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3735, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3736, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3737, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3738, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3739, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3740, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3741, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3742, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3743, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3744, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3745, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3746, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3747, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3748, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3749, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3750, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3751, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3752, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3753, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3754, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3755, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3756, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3757, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3758, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3759, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3760, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3761, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3762, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3763, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3764, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3765, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3766, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3767, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3768, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3769, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3770, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3771, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3772, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3773, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3774, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3775, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3776, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3777, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3778, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3779, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3780, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3781, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3782, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3783, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3784, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3785, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3786, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3787, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3788, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3789, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3790, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3791, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3792, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3793, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3794, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3795, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3796, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3797, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3798, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3799, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3800, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3801, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3802, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3803, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3804, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3805, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3806, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3807, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3808, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3809, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3810, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3811, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3812, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3813, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3814, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3815, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3816, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3817, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3818, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3819, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3820, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3821, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3822, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3823, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3824, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3825, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3826, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3827, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3828, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3829, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3830, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3831, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3832, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3833, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3834, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3835, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3836, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3837, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3838, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3839, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3840, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3841, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3842, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3843, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3844, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3845, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3846, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3847, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3848, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3849, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3850, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3851, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3852, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3853, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3854, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3855, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3856, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3857, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3858, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3859, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3860, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3861, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3862, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3863, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3864, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3865, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3866, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3867, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3868, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3869, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3870, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3871, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3872, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3873, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3874, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3875, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3876, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3877, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3878, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3879, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3880, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3881, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3882, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3883, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3884, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3885, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3886, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3887, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3888, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3889, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3890, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3891, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3892, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3893, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3894, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3895, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3896, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3897, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3898, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3899, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3900, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3901, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3902, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3903, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3904, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3905, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3906, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3907, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3908, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3909, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3910, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3911, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3912, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3913, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3914, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3915, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3916, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3917, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3918, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3919, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3920, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3921, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3922, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3923, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3924, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3925, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3926, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3927, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3928, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3929, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3930, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3931, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3932, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3933, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3934, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3935, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3936, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3937, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3938, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3939, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3940, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3941, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3942, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3943, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3944, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3945, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3946, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3947, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3948, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3949, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3950, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3951, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3952, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3953, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3954, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3955, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3956, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3957, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3958, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3959, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3960, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3961, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3962, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3963, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3964, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3965, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3966, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3967, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3968, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3969, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3970, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3971, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3972, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3973, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3974, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3975, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3976, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3977, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3978, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3979, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3980, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3981, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3982, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3983, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3984, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3985, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3986, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3987, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3988, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3989, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3990, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3991, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3992, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3993, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3994, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3995, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 3996, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 3997, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 3998, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 3999, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4e3, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4001, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4002, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4003, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4004, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4005, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4006, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4007, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4008, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4009, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4010, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4011, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4012, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4013, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4014, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4015, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4016, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4017, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4018, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4019, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4020, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4021, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4022, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4023, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4024, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4025, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4026, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4027, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4028, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4029, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4030, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4031, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4032, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4033, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4034, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4035, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4036, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4037, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4038, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4039, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4040, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4041, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4042, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4043, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4044, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4045, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4046, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4047, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4048, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4049, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4050, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4051, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4052, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4053, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4054, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4055, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4056, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4057, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4058, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4059, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4060, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4061, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4062, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4063, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4064, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4065, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4066, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4067, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4068, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4069, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4070, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4071, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4072, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4073, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4074, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4075, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4076, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4077, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4078, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4079, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4080, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4081, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4082, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4083, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4084, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4085, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4086, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4087, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4088, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4089, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4090, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4091, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4092, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4093, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4094, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4095, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4096, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4097, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4098, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4099, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4100, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4101, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4102, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4103, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4104, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4105, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4106, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4107, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4108, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4109, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4110, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4111, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4112, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4113, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4114, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4115, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4116, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4117, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4118, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4119, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4120, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4121, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4122, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4123, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4124, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4125, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4126, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4127, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4128, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4129, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4130, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4131, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4132, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4133, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4134, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4135, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4136, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4137, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4138, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4139, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4140, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4141, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4142, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4143, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4144, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4145, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4146, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4147, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4148, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4149, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4150, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4151, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4152, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4153, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4154, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4155, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4156, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4157, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4158, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4159, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4160, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4161, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4162, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4163, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4164, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4165, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4166, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4167, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4168, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4169, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4170, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4171, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4172, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4173, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4174, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4175, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4176, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4177, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4178, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4179, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4180, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4181, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4182, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4183, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4184, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4185, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4186, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4187, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4188, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4189, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4190, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4191, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4192, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4193, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4194, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4195, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4196, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4197, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4198, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4199, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4200, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4201, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4202, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4203, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4204, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4205, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4206, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4207, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4208, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4209, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4210, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4211, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4212, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4213, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4214, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4215, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4216, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4217, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4218, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4219, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4220, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4221, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4222, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4223, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4224, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4225, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4226, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4227, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4228, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4229, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4230, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4231, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4232, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4233, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4234, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4235, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4236, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4237, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4238, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4239, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4240, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4241, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4242, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4243, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4244, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4245, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4246, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4247, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4248, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4249, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4250, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4251, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4252, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4253, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4254, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4255, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4256, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4257, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4258, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4259, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4260, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4261, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4262, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4263, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4264, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4265, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4266, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4267, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4268, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4269, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4270, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4271, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4272, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4273, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4274, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4275, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4276, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4277, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4278, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4279, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4280, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4281, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4282, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4283, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4284, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4285, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4286, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4287, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4288, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4289, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4290, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4291, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4292, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4293, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4294, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4295, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4296, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4297, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4298, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4299, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4300, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4301, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4302, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4303, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4304, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4305, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4306, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4307, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4308, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4309, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4310, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4311, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4312, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4313, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4314, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4315, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4316, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4317, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4318, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4319, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4320, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4321, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4322, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4323, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4324, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4325, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4326, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4327, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4328, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4329, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4330, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4331, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4332, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4333, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4334, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4335, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4336, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4337, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4338, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4339, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4340, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4341, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4342, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4343, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4344, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4345, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4346, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4347, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4348, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4349, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4350, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4351, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4352, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4353, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4354, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4355, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4356, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4357, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4358, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4359, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4360, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4361, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4362, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4363, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4364, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4365, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4366, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4367, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4368, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4369, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4370, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4371, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4372, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4373, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4374, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4375, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4376, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4377, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4378, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4379, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4380, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4381, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4382, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4383, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4384, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4385, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4386, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4387, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4388, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4389, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4390, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4391, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4392, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4393, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4394, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4395, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4396, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4397, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4398, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4399, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4400, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4401, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4402, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4403, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4404, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4405, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4406, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4407, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4408, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4409, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4410, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4411, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4412, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4413, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4414, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4415, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4416, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4417, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4418, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4419, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4420, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4421, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4422, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4423, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4424, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4425, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4426, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4427, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4428, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4429, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4430, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4431, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4432, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4433, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4434, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4435, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4436, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4437, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4438, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4439, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4440, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4441, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4442, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4443, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4444, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4445, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4446, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4447, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4448, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4449, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4450, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4451, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4452, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4453, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4454, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4455, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4456, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4457, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4458, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4459, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4460, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4461, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4462, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4463, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4464, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4465, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4466, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4467, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4468, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4469, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4470, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4471, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4472, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4473, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4474, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4475, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4476, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4477, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4478, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4479, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4480, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4481, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4482, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4483, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4484, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4485, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4486, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4487, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4488, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4489, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4490, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4491, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4492, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4493, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4494, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4495, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4496, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4497, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4498, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4499, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4500, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4501, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4502, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4503, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4504, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4505, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4506, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4507, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4508, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4509, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4510, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4511, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4512, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4513, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4514, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4515, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4516, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4517, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4518, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4519, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4520, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4521, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4522, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4523, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4524, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4525, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4526, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4527, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4528, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4529, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4530, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4531, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4532, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4533, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4534, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4535, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4536, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4537, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4538, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4539, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4540, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4541, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4542, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4543, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4544, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4545, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4546, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4547, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4548, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4549, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4550, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4551, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4552, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4553, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4554, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4555, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4556, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4557, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4558, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4559, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4560, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4561, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4562, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4563, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4564, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4565, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4566, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4567, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4568, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4569, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4570, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4571, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4572, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4573, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4574, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4575, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4576, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4577, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4578, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4579, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4580, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4581, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4582, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4583, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4584, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4585, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4586, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4587, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4588, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4589, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4590, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4591, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4592, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4593, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4594, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4595, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4596, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4597, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4598, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4599, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4600, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4601, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4602, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4603, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4604, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4605, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4606, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4607, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4608, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4609, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4610, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4611, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4612, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4613, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4614, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4615, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4616, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4617, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4618, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4619, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4620, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4621, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4622, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4623, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4624, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4625, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4626, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4627, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4628, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4629, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4630, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4631, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4632, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4633, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4634, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4635, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4636, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4637, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4638, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4639, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4640, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4641, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4642, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4643, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4644, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4645, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4646, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4647, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4648, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4649, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4650, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4651, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4652, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4653, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4654, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4655, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4656, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4657, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4658, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4659, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4660, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4661, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4662, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4663, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4664, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4665, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4666, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4667, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4668, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4669, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4670, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4671, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4672, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4673, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4674, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4675, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4676, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4677, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4678, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4679, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4680, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4681, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4682, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4683, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4684, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4685, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4686, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4687, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4688, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4689, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4690, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4691, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4692, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4693, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4694, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4695, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4696, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4697, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4698, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4699, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4700, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4701, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4702, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4703, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4704, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4705, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4706, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4707, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4708, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4709, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4710, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4711, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4712, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4713, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4714, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4715, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4716, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4717, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4718, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4719, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4720, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4721, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4722, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4723, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4724, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4725, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4726, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4727, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4728, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4729, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4730, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4731, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4732, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4733, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4734, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4735, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4736, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4737, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4738, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4739, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4740, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4741, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4742, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4743, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4744, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4745, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4746, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4747, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4748, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4749, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4750, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4751, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4752, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4753, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4754, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4755, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4756, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4757, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4758, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4759, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4760, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4761, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4762, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4763, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4764, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4765, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4766, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4767, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4768, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4769, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4770, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4771, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4772, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4773, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4774, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4775, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4776, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4777, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4778, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4779, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4780, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4781, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4782, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4783, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4784, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4785, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4786, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4787, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4788, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4789, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4790, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4791, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4792, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4793, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4794, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4795, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4796, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4797, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4798, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4799, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4800, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4801, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4802, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4803, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4804, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4805, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4806, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4807, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4808, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4809, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4810, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4811, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4812, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4813, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4814, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4815, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4816, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4817, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4818, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4819, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4820, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4821, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4822, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4823, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4824, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4825, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4826, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4827, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4828, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4829, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4830, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4831, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4832, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4833, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4834, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4835, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4836, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4837, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4838, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4839, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4840, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4841, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4842, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4843, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4844, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4845, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4846, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4847, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4848, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4849, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4850, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4851, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4852, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4853, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4854, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4855, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4856, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4857, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4858, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4859, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4860, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4861, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4862, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4863, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4864, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4865, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4866, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4867, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4868, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4869, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4870, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4871, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4872, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4873, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4874, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4875, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4876, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4877, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4878, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4879, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4880, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4881, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4882, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4883, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4884, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4885, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4886, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4887, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4888, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4889, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4890, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4891, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4892, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4893, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4894, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4895, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4896, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4897, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4898, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4899, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4900, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4901, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4902, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4903, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4904, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4905, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4906, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4907, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4908, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4909, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4910, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4911, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4912, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4913, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4914, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4915, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4916, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4917, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4918, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4919, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4920, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4921, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4922, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4923, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4924, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4925, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4926, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4927, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4928, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4929, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4930, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4931, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4932, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4933, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4934, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4935, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4936, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4937, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4938, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4939, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4940, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4941, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4942, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4943, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4944, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4945, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4946, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4947, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4948, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4949, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4950, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4951, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4952, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4953, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4954, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4955, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4956, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4957, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4958, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4959, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4960, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4961, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4962, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4963, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4964, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4965, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4966, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4967, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4968, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4969, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4970, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4971, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4972, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4973, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4974, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4975, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4976, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4977, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4978, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4979, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4980, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4981, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4982, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4983, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4984, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4985, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4986, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4987, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4988, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4989, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4990, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4991, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4992, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4993, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4994, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4995, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 4996, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 4997, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 4998, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 4999, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5e3, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5001, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5002, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5003, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5004, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5005, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5006, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5007, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5008, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5009, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5010, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5011, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5012, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5013, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5014, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5015, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5016, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5017, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5018, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5019, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5020, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5021, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5022, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5023, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5024, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5025, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5026, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5027, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5028, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5029, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5030, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5031, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5032, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5033, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5034, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5035, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5036, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5037, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5038, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5039, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5040, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5041, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5042, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5043, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5044, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5045, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5046, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5047, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5048, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5049, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5050, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5051, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5052, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5053, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5054, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5055, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5056, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5057, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5058, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5059, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5060, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5061, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5062, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5063, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5064, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5065, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5066, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5067, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5068, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5069, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5070, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5071, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5072, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5073, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5074, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5075, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5076, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5077, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5078, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5079, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5080, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5081, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5082, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5083, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5084, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5085, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5086, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5087, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5088, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5089, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5090, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5091, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5092, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5093, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5094, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5095, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5096, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5097, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5098, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5099, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5100, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5101, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5102, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5103, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5104, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5105, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5106, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5107, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5108, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5109, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5110, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5111, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5112, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5113, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5114, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5115, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5116, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5117, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5118, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5119, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5120, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5121, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5122, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5123, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5124, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5125, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5126, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5127, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5128, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5129, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5130, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5131, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5132, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5133, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5134, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5135, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5136, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5137, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5138, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5139, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5140, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5141, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5142, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5143, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5144, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5145, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5146, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5147, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5148, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5149, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5150, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5151, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5152, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5153, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5154, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5155, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5156, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5157, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5158, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5159, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5160, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5161, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5162, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5163, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5164, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5165, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5166, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5167, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5168, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5169, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5170, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5171, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5172, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5173, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5174, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5175, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5176, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5177, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5178, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5179, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5180, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5181, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5182, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5183, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5184, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5185, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5186, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5187, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5188, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5189, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5190, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5191, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5192, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5193, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5194, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5195, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5196, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5197, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5198, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5199, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5200, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5201, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5202, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5203, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5204, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5205, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5206, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5207, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5208, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5209, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5210, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5211, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5212, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5213, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5214, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5215, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5216, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5217, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5218, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5219, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5220, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5221, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5222, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5223, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5224, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5225, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5226, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5227, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5228, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5229, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5230, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5231, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5232, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5233, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5234, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5235, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5236, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5237, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5238, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5239, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5240, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5241, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5242, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5243, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5244, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5245, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5246, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5247, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5248, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5249, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5250, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5251, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5252, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5253, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5254, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5255, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5256, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5257, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5258, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5259, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5260, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5261, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5262, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5263, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5264, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5265, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5266, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5267, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5268, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5269, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5270, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5271, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5272, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5273, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5274, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5275, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5276, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5277, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5278, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5279, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5280, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5281, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5282, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5283, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5284, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5285, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5286, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5287, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5288, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5289, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5290, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5291, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5292, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5293, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5294, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5295, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5296, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5297, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5298, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5299, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5300, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5301, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5302, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5303, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5304, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5305, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5306, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5307, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5308, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5309, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5310, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5311, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5312, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5313, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5314, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5315, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5316, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5317, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5318, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5319, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5320, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5321, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5322, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5323, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5324, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5325, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5326, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5327, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5328, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5329, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5330, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5331, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5332, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5333, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5334, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5335, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5336, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5337, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5338, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5339, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5340, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5341, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5342, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5343, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5344, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5345, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5346, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5347, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5348, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5349, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5350, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5351, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5352, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5353, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5354, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5355, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5356, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5357, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5358, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5359, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5360, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5361, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5362, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5363, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5364, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5365, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5366, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5367, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5368, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5369, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5370, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5371, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5372, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5373, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5374, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5375, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5376, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5377, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5378, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5379, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5380, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5381, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5382, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5383, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5384, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5385, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5386, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5387, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5388, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5389, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5390, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5391, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5392, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5393, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5394, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5395, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5396, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5397, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5398, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5399, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5400, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5401, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5402, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5403, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5404, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5405, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5406, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5407, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5408, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5409, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5410, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5411, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5412, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5413, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5414, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5415, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5416, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5417, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5418, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5419, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5420, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5421, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5422, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5423, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5424, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5425, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5426, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5427, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5428, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5429, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5430, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5431, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5432, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5433, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5434, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5435, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5436, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5437, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5438, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5439, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5440, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5441, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5442, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5443, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5444, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5445, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5446, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5447, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5448, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5449, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5450, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5451, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5452, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5453, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5454, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5455, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5456, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5457, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5458, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5459, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5460, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5461, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5462, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5463, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5464, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5465, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5466, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5467, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5468, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5469, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5470, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5471, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5472, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5473, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5474, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5475, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5476, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5477, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5478, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5479, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5480, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5481, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5482, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5483, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5484, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5485, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5486, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5487, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5488, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5489, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5490, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5491, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5492, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5493, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5494, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5495, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5496, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5497, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5498, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5499, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5500, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5501, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5502, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5503, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5504, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5505, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5506, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5507, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5508, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5509, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5510, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5511, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5512, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5513, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5514, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5515, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5516, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5517, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5518, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5519, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5520, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5521, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5522, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5523, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5524, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5525, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5526, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5527, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5528, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5529, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5530, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5531, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5532, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5533, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5534, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5535, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5536, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5537, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5538, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5539, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5540, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5541, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5542, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5543, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5544, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5545, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5546, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5547, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5548, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5549, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5550, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5551, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5552, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5553, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5554, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5555, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5556, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5557, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5558, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5559, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5560, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5561, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5562, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5563, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5564, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5565, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5566, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5567, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5568, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5569, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5570, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5571, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5572, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5573, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5574, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5575, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5576, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5577, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5578, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5579, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5580, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5581, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5582, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5583, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5584, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5585, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5586, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5587, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5588, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5589, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5590, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5591, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5592, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5593, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5594, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5595, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5596, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5597, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5598, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5599, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5600, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5601, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5602, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5603, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5604, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5605, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5606, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5607, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5608, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5609, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5610, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5611, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5612, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5613, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5614, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5615, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5616, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5617, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5618, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5619, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5620, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5621, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5622, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5623, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5624, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5625, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5626, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5627, kind: "swallow", ch: 124, color: 8, special: 0 },
  { glyph: 5628, kind: "swallow", ch: 92, color: 8, special: 0 },
  { glyph: 5629, kind: "swallow", ch: 45, color: 8, special: 0 },
  { glyph: 5630, kind: "swallow", ch: 47, color: 8, special: 0 },
  { glyph: 5631, kind: "warning", ch: 48, color: 8, special: 0 },
  { glyph: 5632, kind: "warning", ch: 49, color: 8, special: 0 },
  { glyph: 5633, kind: "warning", ch: 50, color: 8, special: 0 },
  { glyph: 5634, kind: "warning", ch: 51, color: 8, special: 0 },
  { glyph: 5635, kind: "warning", ch: 52, color: 8, special: 0 },
  { glyph: 5636, kind: "warning", ch: 53, color: 8, special: 0 },
  { glyph: 5637, kind: "statue", ch: 97, color: 8, special: 32 },
  { glyph: 5638, kind: "statue", ch: 97, color: 8, special: 32 },
  { glyph: 5639, kind: "statue", ch: 97, color: 8, special: 32 },
  { glyph: 5640, kind: "statue", ch: 97, color: 8, special: 32 },
  { glyph: 5641, kind: "statue", ch: 97, color: 8, special: 32 },
  { glyph: 5642, kind: "statue", ch: 97, color: 8, special: 32 },
  { glyph: 5643, kind: "statue", ch: 98, color: 8, special: 32 },
  { glyph: 5644, kind: "statue", ch: 98, color: 8, special: 32 },
  { glyph: 5645, kind: "statue", ch: 98, color: 8, special: 32 },
  { glyph: 5646, kind: "statue", ch: 99, color: 8, special: 32 },
  { glyph: 5647, kind: "statue", ch: 99, color: 8, special: 32 },
  { glyph: 5648, kind: "statue", ch: 99, color: 8, special: 32 },
  { glyph: 5649, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5650, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5651, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5652, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5653, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5654, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5655, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5656, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5657, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5658, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5659, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5660, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5661, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5662, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5663, kind: "statue", ch: 100, color: 8, special: 32 },
  { glyph: 5664, kind: "statue", ch: 101, color: 8, special: 32 },
  { glyph: 5665, kind: "statue", ch: 101, color: 8, special: 32 },
  { glyph: 5666, kind: "statue", ch: 101, color: 8, special: 32 },
  { glyph: 5667, kind: "statue", ch: 101, color: 8, special: 32 },
  { glyph: 5668, kind: "statue", ch: 101, color: 8, special: 32 },
  { glyph: 5669, kind: "statue", ch: 102, color: 8, special: 32 },
  { glyph: 5670, kind: "statue", ch: 102, color: 8, special: 32 },
  { glyph: 5671, kind: "statue", ch: 102, color: 8, special: 32 },
  { glyph: 5672, kind: "statue", ch: 102, color: 8, special: 32 },
  { glyph: 5673, kind: "statue", ch: 102, color: 8, special: 32 },
  { glyph: 5674, kind: "statue", ch: 102, color: 8, special: 32 },
  { glyph: 5675, kind: "statue", ch: 102, color: 8, special: 32 },
  { glyph: 5676, kind: "statue", ch: 102, color: 8, special: 32 },
  { glyph: 5677, kind: "statue", ch: 103, color: 8, special: 32 },
  { glyph: 5678, kind: "statue", ch: 103, color: 8, special: 32 },
  { glyph: 5679, kind: "statue", ch: 103, color: 8, special: 32 },
  { glyph: 5680, kind: "statue", ch: 104, color: 8, special: 32 },
  { glyph: 5681, kind: "statue", ch: 104, color: 8, special: 32 },
  { glyph: 5682, kind: "statue", ch: 104, color: 8, special: 32 },
  { glyph: 5683, kind: "statue", ch: 104, color: 8, special: 32 },
  { glyph: 5684, kind: "statue", ch: 104, color: 8, special: 32 },
  { glyph: 5685, kind: "statue", ch: 104, color: 8, special: 32 },
  { glyph: 5686, kind: "statue", ch: 104, color: 8, special: 32 },
  { glyph: 5687, kind: "statue", ch: 105, color: 8, special: 32 },
  { glyph: 5688, kind: "statue", ch: 105, color: 8, special: 32 },
  { glyph: 5689, kind: "statue", ch: 105, color: 8, special: 32 },
  { glyph: 5690, kind: "statue", ch: 105, color: 8, special: 32 },
  { glyph: 5691, kind: "statue", ch: 105, color: 8, special: 32 },
  { glyph: 5692, kind: "statue", ch: 105, color: 8, special: 32 },
  { glyph: 5693, kind: "statue", ch: 106, color: 8, special: 32 },
  { glyph: 5694, kind: "statue", ch: 106, color: 8, special: 32 },
  { glyph: 5695, kind: "statue", ch: 106, color: 8, special: 32 },
  { glyph: 5696, kind: "statue", ch: 107, color: 8, special: 32 },
  { glyph: 5697, kind: "statue", ch: 107, color: 8, special: 32 },
  { glyph: 5698, kind: "statue", ch: 107, color: 8, special: 32 },
  { glyph: 5699, kind: "statue", ch: 107, color: 8, special: 32 },
  { glyph: 5700, kind: "statue", ch: 108, color: 8, special: 32 },
  { glyph: 5701, kind: "statue", ch: 109, color: 8, special: 32 },
  { glyph: 5702, kind: "statue", ch: 109, color: 8, special: 32 },
  { glyph: 5703, kind: "statue", ch: 109, color: 8, special: 32 },
  { glyph: 5704, kind: "statue", ch: 110, color: 8, special: 32 },
  { glyph: 5705, kind: "statue", ch: 110, color: 8, special: 32 },
  { glyph: 5706, kind: "statue", ch: 110, color: 8, special: 32 },
  { glyph: 5707, kind: "statue", ch: 111, color: 8, special: 32 },
  { glyph: 5708, kind: "statue", ch: 111, color: 8, special: 32 },
  { glyph: 5709, kind: "statue", ch: 111, color: 8, special: 32 },
  { glyph: 5710, kind: "statue", ch: 111, color: 8, special: 32 },
  { glyph: 5711, kind: "statue", ch: 111, color: 8, special: 32 },
  { glyph: 5712, kind: "statue", ch: 111, color: 8, special: 32 },
  { glyph: 5713, kind: "statue", ch: 111, color: 8, special: 32 },
  { glyph: 5714, kind: "statue", ch: 111, color: 8, special: 32 },
  { glyph: 5715, kind: "statue", ch: 112, color: 8, special: 32 },
  { glyph: 5716, kind: "statue", ch: 112, color: 8, special: 32 },
  { glyph: 5717, kind: "statue", ch: 112, color: 8, special: 32 },
  { glyph: 5718, kind: "statue", ch: 113, color: 8, special: 32 },
  { glyph: 5719, kind: "statue", ch: 113, color: 8, special: 32 },
  { glyph: 5720, kind: "statue", ch: 113, color: 8, special: 32 },
  { glyph: 5721, kind: "statue", ch: 113, color: 8, special: 32 },
  { glyph: 5722, kind: "statue", ch: 113, color: 8, special: 32 },
  { glyph: 5723, kind: "statue", ch: 113, color: 8, special: 32 },
  { glyph: 5724, kind: "statue", ch: 113, color: 8, special: 32 },
  { glyph: 5725, kind: "statue", ch: 114, color: 8, special: 32 },
  { glyph: 5726, kind: "statue", ch: 114, color: 8, special: 32 },
  { glyph: 5727, kind: "statue", ch: 114, color: 8, special: 32 },
  { glyph: 5728, kind: "statue", ch: 114, color: 8, special: 32 },
  { glyph: 5729, kind: "statue", ch: 114, color: 8, special: 32 },
  { glyph: 5730, kind: "statue", ch: 114, color: 8, special: 32 },
  { glyph: 5731, kind: "statue", ch: 115, color: 8, special: 32 },
  { glyph: 5732, kind: "statue", ch: 115, color: 8, special: 32 },
  { glyph: 5733, kind: "statue", ch: 115, color: 8, special: 32 },
  { glyph: 5734, kind: "statue", ch: 115, color: 8, special: 32 },
  { glyph: 5735, kind: "statue", ch: 116, color: 8, special: 32 },
  { glyph: 5736, kind: "statue", ch: 116, color: 8, special: 32 },
  { glyph: 5737, kind: "statue", ch: 117, color: 8, special: 32 },
  { glyph: 5738, kind: "statue", ch: 117, color: 8, special: 32 },
  { glyph: 5739, kind: "statue", ch: 117, color: 8, special: 32 },
  { glyph: 5740, kind: "statue", ch: 117, color: 8, special: 32 },
  { glyph: 5741, kind: "statue", ch: 117, color: 8, special: 32 },
  { glyph: 5742, kind: "statue", ch: 117, color: 8, special: 32 },
  { glyph: 5743, kind: "statue", ch: 118, color: 8, special: 32 },
  { glyph: 5744, kind: "statue", ch: 118, color: 8, special: 32 },
  { glyph: 5745, kind: "statue", ch: 118, color: 8, special: 32 },
  { glyph: 5746, kind: "statue", ch: 118, color: 8, special: 32 },
  { glyph: 5747, kind: "statue", ch: 118, color: 8, special: 32 },
  { glyph: 5748, kind: "statue", ch: 118, color: 8, special: 32 },
  { glyph: 5749, kind: "statue", ch: 119, color: 8, special: 32 },
  { glyph: 5750, kind: "statue", ch: 119, color: 8, special: 32 },
  { glyph: 5751, kind: "statue", ch: 119, color: 8, special: 32 },
  { glyph: 5752, kind: "statue", ch: 119, color: 8, special: 32 },
  { glyph: 5753, kind: "statue", ch: 120, color: 8, special: 32 },
  { glyph: 5754, kind: "statue", ch: 120, color: 8, special: 32 },
  { glyph: 5755, kind: "statue", ch: 121, color: 8, special: 32 },
  { glyph: 5756, kind: "statue", ch: 121, color: 8, special: 32 },
  { glyph: 5757, kind: "statue", ch: 122, color: 8, special: 32 },
  { glyph: 5758, kind: "statue", ch: 65, color: 8, special: 32 },
  { glyph: 5759, kind: "statue", ch: 65, color: 8, special: 32 },
  { glyph: 5760, kind: "statue", ch: 65, color: 8, special: 32 },
  { glyph: 5761, kind: "statue", ch: 65, color: 8, special: 32 },
  { glyph: 5762, kind: "statue", ch: 65, color: 8, special: 32 },
  { glyph: 5763, kind: "statue", ch: 66, color: 8, special: 32 },
  { glyph: 5764, kind: "statue", ch: 66, color: 8, special: 32 },
  { glyph: 5765, kind: "statue", ch: 66, color: 8, special: 32 },
  { glyph: 5766, kind: "statue", ch: 66, color: 8, special: 32 },
  { glyph: 5767, kind: "statue", ch: 67, color: 8, special: 32 },
  { glyph: 5768, kind: "statue", ch: 67, color: 8, special: 32 },
  { glyph: 5769, kind: "statue", ch: 67, color: 8, special: 32 },
  { glyph: 5770, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5771, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5772, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5773, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5774, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5775, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5776, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5777, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5778, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5779, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5780, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5781, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5782, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5783, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5784, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5785, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5786, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5787, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5788, kind: "statue", ch: 69, color: 8, special: 32 },
  { glyph: 5789, kind: "statue", ch: 69, color: 8, special: 32 },
  { glyph: 5790, kind: "statue", ch: 69, color: 8, special: 32 },
  { glyph: 5791, kind: "statue", ch: 69, color: 8, special: 32 },
  { glyph: 5792, kind: "statue", ch: 69, color: 8, special: 32 },
  { glyph: 5793, kind: "statue", ch: 70, color: 8, special: 32 },
  { glyph: 5794, kind: "statue", ch: 70, color: 8, special: 32 },
  { glyph: 5795, kind: "statue", ch: 70, color: 8, special: 32 },
  { glyph: 5796, kind: "statue", ch: 70, color: 8, special: 32 },
  { glyph: 5797, kind: "statue", ch: 70, color: 8, special: 32 },
  { glyph: 5798, kind: "statue", ch: 70, color: 8, special: 32 },
  { glyph: 5799, kind: "statue", ch: 70, color: 8, special: 32 },
  { glyph: 5800, kind: "statue", ch: 71, color: 8, special: 32 },
  { glyph: 5801, kind: "statue", ch: 71, color: 8, special: 32 },
  { glyph: 5802, kind: "statue", ch: 71, color: 8, special: 32 },
  { glyph: 5803, kind: "statue", ch: 71, color: 8, special: 32 },
  { glyph: 5804, kind: "statue", ch: 72, color: 8, special: 32 },
  { glyph: 5805, kind: "statue", ch: 72, color: 8, special: 32 },
  { glyph: 5806, kind: "statue", ch: 72, color: 8, special: 32 },
  { glyph: 5807, kind: "statue", ch: 72, color: 8, special: 32 },
  { glyph: 5808, kind: "statue", ch: 72, color: 8, special: 32 },
  { glyph: 5809, kind: "statue", ch: 72, color: 8, special: 32 },
  { glyph: 5810, kind: "statue", ch: 72, color: 8, special: 32 },
  { glyph: 5811, kind: "statue", ch: 72, color: 8, special: 32 },
  { glyph: 5812, kind: "statue", ch: 72, color: 8, special: 32 },
  { glyph: 5813, kind: "statue", ch: 74, color: 8, special: 32 },
  { glyph: 5814, kind: "statue", ch: 75, color: 8, special: 32 },
  { glyph: 5815, kind: "statue", ch: 75, color: 8, special: 32 },
  { glyph: 5816, kind: "statue", ch: 75, color: 8, special: 32 },
  { glyph: 5817, kind: "statue", ch: 75, color: 8, special: 32 },
  { glyph: 5818, kind: "statue", ch: 76, color: 8, special: 32 },
  { glyph: 5819, kind: "statue", ch: 76, color: 8, special: 32 },
  { glyph: 5820, kind: "statue", ch: 76, color: 8, special: 32 },
  { glyph: 5821, kind: "statue", ch: 76, color: 8, special: 32 },
  { glyph: 5822, kind: "statue", ch: 77, color: 8, special: 32 },
  { glyph: 5823, kind: "statue", ch: 77, color: 8, special: 32 },
  { glyph: 5824, kind: "statue", ch: 77, color: 8, special: 32 },
  { glyph: 5825, kind: "statue", ch: 77, color: 8, special: 32 },
  { glyph: 5826, kind: "statue", ch: 77, color: 8, special: 32 },
  { glyph: 5827, kind: "statue", ch: 77, color: 8, special: 32 },
  { glyph: 5828, kind: "statue", ch: 77, color: 8, special: 32 },
  { glyph: 5829, kind: "statue", ch: 77, color: 8, special: 32 },
  { glyph: 5830, kind: "statue", ch: 78, color: 8, special: 32 },
  { glyph: 5831, kind: "statue", ch: 78, color: 8, special: 32 },
  { glyph: 5832, kind: "statue", ch: 78, color: 8, special: 32 },
  { glyph: 5833, kind: "statue", ch: 78, color: 8, special: 32 },
  { glyph: 5834, kind: "statue", ch: 78, color: 8, special: 32 },
  { glyph: 5835, kind: "statue", ch: 78, color: 8, special: 32 },
  { glyph: 5836, kind: "statue", ch: 78, color: 8, special: 32 },
  { glyph: 5837, kind: "statue", ch: 78, color: 8, special: 32 },
  { glyph: 5838, kind: "statue", ch: 79, color: 8, special: 32 },
  { glyph: 5839, kind: "statue", ch: 79, color: 8, special: 32 },
  { glyph: 5840, kind: "statue", ch: 79, color: 8, special: 32 },
  { glyph: 5841, kind: "statue", ch: 80, color: 8, special: 32 },
  { glyph: 5842, kind: "statue", ch: 80, color: 8, special: 32 },
  { glyph: 5843, kind: "statue", ch: 80, color: 8, special: 32 },
  { glyph: 5844, kind: "statue", ch: 80, color: 8, special: 32 },
  { glyph: 5845, kind: "statue", ch: 81, color: 8, special: 32 },
  { glyph: 5846, kind: "statue", ch: 81, color: 8, special: 32 },
  { glyph: 5847, kind: "statue", ch: 82, color: 8, special: 32 },
  { glyph: 5848, kind: "statue", ch: 82, color: 8, special: 32 },
  { glyph: 5849, kind: "statue", ch: 83, color: 8, special: 32 },
  { glyph: 5850, kind: "statue", ch: 83, color: 8, special: 32 },
  { glyph: 5851, kind: "statue", ch: 83, color: 8, special: 32 },
  { glyph: 5852, kind: "statue", ch: 83, color: 8, special: 32 },
  { glyph: 5853, kind: "statue", ch: 83, color: 8, special: 32 },
  { glyph: 5854, kind: "statue", ch: 83, color: 8, special: 32 },
  { glyph: 5855, kind: "statue", ch: 84, color: 8, special: 32 },
  { glyph: 5856, kind: "statue", ch: 84, color: 8, special: 32 },
  { glyph: 5857, kind: "statue", ch: 84, color: 8, special: 32 },
  { glyph: 5858, kind: "statue", ch: 84, color: 8, special: 32 },
  { glyph: 5859, kind: "statue", ch: 84, color: 8, special: 32 },
  { glyph: 5860, kind: "statue", ch: 85, color: 8, special: 32 },
  { glyph: 5861, kind: "statue", ch: 86, color: 8, special: 32 },
  { glyph: 5862, kind: "statue", ch: 86, color: 8, special: 32 },
  { glyph: 5863, kind: "statue", ch: 86, color: 8, special: 32 },
  { glyph: 5864, kind: "statue", ch: 87, color: 8, special: 32 },
  { glyph: 5865, kind: "statue", ch: 87, color: 8, special: 32 },
  { glyph: 5866, kind: "statue", ch: 87, color: 8, special: 32 },
  { glyph: 5867, kind: "statue", ch: 88, color: 8, special: 32 },
  { glyph: 5868, kind: "statue", ch: 89, color: 8, special: 32 },
  { glyph: 5869, kind: "statue", ch: 89, color: 8, special: 32 },
  { glyph: 5870, kind: "statue", ch: 89, color: 8, special: 32 },
  { glyph: 5871, kind: "statue", ch: 89, color: 8, special: 32 },
  { glyph: 5872, kind: "statue", ch: 89, color: 8, special: 32 },
  { glyph: 5873, kind: "statue", ch: 89, color: 8, special: 32 },
  { glyph: 5874, kind: "statue", ch: 90, color: 8, special: 32 },
  { glyph: 5875, kind: "statue", ch: 90, color: 8, special: 32 },
  { glyph: 5876, kind: "statue", ch: 90, color: 8, special: 32 },
  { glyph: 5877, kind: "statue", ch: 90, color: 8, special: 32 },
  { glyph: 5878, kind: "statue", ch: 90, color: 8, special: 32 },
  { glyph: 5879, kind: "statue", ch: 90, color: 8, special: 32 },
  { glyph: 5880, kind: "statue", ch: 90, color: 8, special: 32 },
  { glyph: 5881, kind: "statue", ch: 90, color: 8, special: 32 },
  { glyph: 5882, kind: "statue", ch: 90, color: 8, special: 32 },
  { glyph: 5883, kind: "statue", ch: 90, color: 8, special: 32 },
  { glyph: 5884, kind: "statue", ch: 39, color: 8, special: 32 },
  { glyph: 5885, kind: "statue", ch: 39, color: 8, special: 32 },
  { glyph: 5886, kind: "statue", ch: 39, color: 8, special: 32 },
  { glyph: 5887, kind: "statue", ch: 39, color: 8, special: 32 },
  { glyph: 5888, kind: "statue", ch: 39, color: 8, special: 32 },
  { glyph: 5889, kind: "statue", ch: 39, color: 8, special: 32 },
  { glyph: 5890, kind: "statue", ch: 39, color: 8, special: 32 },
  { glyph: 5891, kind: "statue", ch: 39, color: 8, special: 32 },
  { glyph: 5892, kind: "statue", ch: 39, color: 8, special: 32 },
  { glyph: 5893, kind: "statue", ch: 39, color: 8, special: 32 },
  { glyph: 5894, kind: "statue", ch: 39, color: 8, special: 32 },
  { glyph: 5895, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5896, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5897, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5898, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5899, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5900, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5901, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5902, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5903, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5904, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5905, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5906, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5907, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5908, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5909, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5910, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5911, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5912, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5913, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5914, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5915, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5916, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5917, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5918, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5919, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5920, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5921, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5922, kind: "statue", ch: 32, color: 8, special: 32 },
  { glyph: 5923, kind: "statue", ch: 32, color: 8, special: 32 },
  { glyph: 5924, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5925, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5926, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5927, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5928, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5929, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5930, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5931, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5932, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5933, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5934, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5935, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5936, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5937, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5938, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5939, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5940, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5941, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5942, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5943, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5944, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5945, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5946, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5947, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5948, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5949, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5950, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5951, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5952, kind: "statue", ch: 59, color: 8, special: 32 },
  { glyph: 5953, kind: "statue", ch: 59, color: 8, special: 32 },
  { glyph: 5954, kind: "statue", ch: 59, color: 8, special: 32 },
  { glyph: 5955, kind: "statue", ch: 59, color: 8, special: 32 },
  { glyph: 5956, kind: "statue", ch: 59, color: 8, special: 32 },
  { glyph: 5957, kind: "statue", ch: 59, color: 8, special: 32 },
  { glyph: 5958, kind: "statue", ch: 58, color: 8, special: 32 },
  { glyph: 5959, kind: "statue", ch: 58, color: 8, special: 32 },
  { glyph: 5960, kind: "statue", ch: 58, color: 8, special: 32 },
  { glyph: 5961, kind: "statue", ch: 58, color: 8, special: 32 },
  { glyph: 5962, kind: "statue", ch: 58, color: 8, special: 32 },
  { glyph: 5963, kind: "statue", ch: 58, color: 8, special: 32 },
  { glyph: 5964, kind: "statue", ch: 58, color: 8, special: 32 },
  { glyph: 5965, kind: "statue", ch: 58, color: 8, special: 32 },
  { glyph: 5966, kind: "statue", ch: 126, color: 8, special: 32 },
  { glyph: 5967, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5968, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5969, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5970, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5971, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5972, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5973, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5974, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5975, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5976, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5977, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5978, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5979, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5980, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5981, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5982, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5983, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5984, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5985, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5986, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5987, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5988, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5989, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5990, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5991, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5992, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5993, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5994, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5995, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 5996, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 5997, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 5998, kind: "statue", ch: 72, color: 8, special: 32 },
  { glyph: 5999, kind: "statue", ch: 68, color: 8, special: 32 },
  { glyph: 6e3, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6001, kind: "statue", ch: 38, color: 8, special: 32 },
  { glyph: 6002, kind: "statue", ch: 115, color: 8, special: 32 },
  { glyph: 6003, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6004, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6005, kind: "statue", ch: 72, color: 8, special: 32 },
  { glyph: 6006, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6007, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6008, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6009, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6010, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6011, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6012, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6013, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6014, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6015, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6016, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6017, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6018, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6019, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6020, kind: "statue", ch: 64, color: 8, special: 32 },
  { glyph: 6021, kind: "unexplored", ch: 32, color: 8, special: 1024 },
  { glyph: 6022, kind: "nothing", ch: 32, color: 8, special: 512 }
];

// src/game/glyphs/registry.ts
function normalizeRuntimeChar(runtimeChar) {
  if (typeof runtimeChar !== "string" || runtimeChar.length === 0) {
    return null;
  }
  return runtimeChar.charAt(0);
}
function normalizeRuntimeColor(runtimeColor) {
  return typeof runtimeColor === "number" && Number.isFinite(runtimeColor) ? runtimeColor : null;
}
function codePointToChar(codePoint) {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 1114111) {
    return null;
  }
  return String.fromCodePoint(codePoint);
}
function getGlyphCatalogEntry(glyph) {
  if (!Number.isInteger(glyph) || glyph < 0 || glyph >= GLYPH_CATALOG.length) {
    return null;
  }
  return GLYPH_CATALOG[glyph] || null;
}
function resolveGlyph(glyph, runtimeChar, runtimeColor) {
  const entry = getGlyphCatalogEntry(glyph);
  const normalizedRuntimeChar = normalizeRuntimeChar(runtimeChar);
  const normalizedRuntimeColor = normalizeRuntimeColor(runtimeColor);
  if (!entry) {
    return {
      glyph,
      kind: "unknown",
      char: normalizedRuntimeChar,
      color: normalizedRuntimeColor,
      special: null,
      isKnown: false
    };
  }
  const catalogChar = codePointToChar(entry.ch);
  return {
    glyph,
    kind: entry.kind,
    char: catalogChar ?? normalizedRuntimeChar,
    color: typeof entry.color === "number" ? entry.color : normalizedRuntimeColor,
    special: typeof entry.special === "number" ? entry.special : null,
    isKnown: true
  };
}

// src/game/glyphs/behavior.ts
var PLAYER_GLYPH_MIN = 331;
var PLAYER_GLYPH_MAX = 360;
var DARK_OVERLAY_GLYPHS = /* @__PURE__ */ new Set([2377, 2397, 2398]);
var CMAP_SEMANTICS = {};
function setCmapSemanticRange(start, endInclusive, semantic) {
  for (let glyph = start; glyph <= endInclusive; glyph++) {
    CMAP_SEMANTICS[glyph] = semantic;
  }
}
setCmapSemanticRange(2378, 2388, "wall");
setCmapSemanticRange(2419, 2440, "trap");
setCmapSemanticRange(2442, 2463, "feature");
Object.assign(CMAP_SEMANTICS, {
  2377: "dark_wall",
  2389: "door_closed",
  2390: "door_open",
  2391: "door_open",
  2392: "door_closed",
  2393: "door_closed",
  2394: "wall",
  2395: "wall",
  2396: "floor",
  2397: "dark_floor",
  2398: "dark_floor",
  2399: "floor",
  2400: "stairs_up",
  2401: "stairs_down",
  2402: "stairs_up",
  2403: "stairs_down",
  2404: "feature",
  2405: "feature",
  2406: "feature",
  2407: "floor",
  2408: "fountain",
  2409: "door_open",
  2410: "door_open",
  2411: "door_closed",
  2412: "door_closed",
  2413: "floor",
  2414: "floor",
  2415: "floor",
  2416: "wall",
  2417: "floor",
  2418: "feature",
  2441: "water"
});
function isPlayerGlyph(glyph, runtimeChar) {
  if (glyph < PLAYER_GLYPH_MIN || glyph > PLAYER_GLYPH_MAX) {
    return false;
  }
  return runtimeChar === "@" || !runtimeChar;
}
function fallbackGlyphChar(glyph, resolved) {
  if (resolved.char && resolved.char.length > 0) {
    return resolved.char;
  }
  return glyph >= 0 ? "?" : " ";
}
function inferDisposition(effective, isPlayer) {
  if (isPlayer) {
    return "friendly";
  }
  switch (effective.kind) {
    case "pet":
    case "ridden":
      return "friendly";
    case "mon":
    case "warning":
    case "explode":
    case "zap":
    case "swallow":
      return "hostile";
    case "detect":
    case "statue":
    case "invis":
      return "neutral";
    default:
      return "unknown";
  }
}
function textColorFor(disposition, effective, effectKind) {
  if (effectKind === "warning") return "#FFF9E8";
  if (effectKind === "zap") return "#F3FBFF";
  if (effectKind === "explode") return "#FFF4EC";
  if (effectKind === "swallow") return "#FAF2FF";
  switch (effective.kind) {
    case "obj":
    case "body":
      return "#FFF7D6";
    case "cmap":
      return "#F4F4F4";
    case "unexplored":
    case "nothing":
      return "#D9DDE8";
    default:
      break;
  }
  switch (disposition) {
    case "friendly":
      return "#F7FFF9";
    case "hostile":
      return "#FFF5F5";
    case "neutral":
      return "#F3F8FF";
    default:
      return "#F4F4F4";
  }
}
function applyCmapSemantic(semantic) {
  switch (semantic) {
    case "wall":
      return {
        materialKind: "wall",
        geometryKind: "wall",
        isWall: true,
        effectKind: null
      };
    case "dark_wall":
      return {
        materialKind: "dark_wall",
        geometryKind: "wall",
        isWall: true,
        effectKind: null
      };
    case "door_closed":
      return {
        materialKind: "door",
        geometryKind: "wall",
        isWall: true,
        effectKind: null
      };
    case "door_open":
      return {
        materialKind: "door",
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
    case "stairs_up":
      return {
        materialKind: "stairs_up",
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
    case "stairs_down":
      return {
        materialKind: "stairs_down",
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
    case "floor":
      return {
        materialKind: "floor",
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
    case "dark_floor":
      return {
        materialKind: "dark",
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
    case "fountain":
      return {
        materialKind: "fountain",
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
    case "water":
      return {
        materialKind: "water",
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
    case "trap":
      return {
        materialKind: "trap",
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
    case "feature":
    default:
      return {
        materialKind: "feature",
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
  }
}
function baseMaterialForDisposition(disposition) {
  switch (disposition) {
    case "friendly":
      return "monster_friendly";
    case "hostile":
      return "monster_hostile";
    case "neutral":
      return "monster_neutral";
    default:
      return "monster_hostile";
  }
}
function classifyByKind(effective, isPlayer) {
  if (isPlayer) {
    return {
      materialKind: "player",
      geometryKind: "floor",
      isWall: false,
      effectKind: null
    };
  }
  switch (effective.kind) {
    case "cmap": {
      const semantic = CMAP_SEMANTICS[effective.glyph] || "feature";
      return applyCmapSemantic(semantic);
    }
    case "obj":
    case "body":
      return {
        materialKind: "item",
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
    case "warning":
      return {
        materialKind: "effect_warning",
        geometryKind: "floor",
        isWall: false,
        effectKind: "warning"
      };
    case "zap":
      return {
        materialKind: "effect_zap",
        geometryKind: "floor",
        isWall: false,
        effectKind: "zap"
      };
    case "explode":
      return {
        materialKind: "effect_explode",
        geometryKind: "floor",
        isWall: false,
        effectKind: "explode"
      };
    case "swallow":
      return {
        materialKind: "effect_swallow",
        geometryKind: "floor",
        isWall: false,
        effectKind: "swallow"
      };
    case "unexplored":
    case "nothing":
      return {
        materialKind: "dark",
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
    case "statue":
      return {
        materialKind: "monster_neutral",
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
    case "mon":
    case "pet":
    case "detect":
    case "ridden":
    case "invis":
      return {
        materialKind: baseMaterialForDisposition(inferDisposition(effective, false)),
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
    default:
      return {
        materialKind: "default",
        geometryKind: "floor",
        isWall: false,
        effectKind: null
      };
  }
}
function classifyTileBehavior(input) {
  const runtimeChar = typeof input.runtimeChar === "string" && input.runtimeChar.length > 0 ? input.runtimeChar.charAt(0) : null;
  const resolved = resolveGlyph(input.glyph, runtimeChar, input.runtimeColor);
  const resolvedCmapSemantic = resolved.kind === "cmap" ? CMAP_SEMANTICS[resolved.glyph] ?? null : null;
  const isDeterministicDarkCmap = resolvedCmapSemantic === "dark_floor" || resolvedCmapSemantic === "dark_wall";
  const isDarkOverlay = DARK_OVERLAY_GLYPHS.has(input.glyph) || resolved.kind === "unexplored" || resolved.kind === "nothing";
  const isPlayer = isPlayerGlyph(input.glyph, runtimeChar);
  let effective = resolved;
  let darkenFactor = 1;
  if (isDarkOverlay && !isDeterministicDarkCmap) {
    if (input.priorTerrain) {
      effective = resolveGlyph(
        input.priorTerrain.glyph,
        input.priorTerrain.char ?? null,
        input.priorTerrain.color ?? null
      );
    }
    darkenFactor = input.glyph === 2398 ? 0.45 : 0.6;
  }
  const disposition = inferDisposition(effective, isPlayer);
  const byKind = classifyByKind(effective, isPlayer);
  let materialKind = byKind.materialKind;
  let geometryKind = byKind.geometryKind;
  let isWall = byKind.isWall;
  let effectKind = byKind.effectKind;
  let glyphChar = isDarkOverlay ? fallbackGlyphChar(input.glyph, resolved) : fallbackGlyphChar(effective.glyph, effective);
  let textColor = textColorFor(disposition, effective, effectKind);
  let resolvedDisposition = disposition;
  const override = getMergedGlyphOverride(input.glyph, effective.kind);
  if (override) {
    if (override.materialKind) materialKind = override.materialKind;
    if (override.geometryKind) geometryKind = override.geometryKind;
    if (typeof override.isWall === "boolean") isWall = override.isWall;
    if (typeof override.glyphChar === "string" && override.glyphChar.length > 0) {
      glyphChar = override.glyphChar.charAt(0);
    }
    if (typeof override.textColor === "string" && override.textColor.length > 0) {
      textColor = override.textColor;
    }
    if (typeof override.darkenFactor === "number") {
      darkenFactor = override.darkenFactor;
    }
    if (override.disposition) {
      resolvedDisposition = override.disposition;
      if (!override.textColor) {
        textColor = textColorFor(resolvedDisposition, effective, effectKind);
      }
    }
    if (override.effectKind !== void 0) {
      effectKind = override.effectKind;
      if (!override.textColor) {
        textColor = textColorFor(resolvedDisposition, effective, effectKind);
      }
    }
  }
  if (glyphChar.trim() === ".") {
    if (materialKind === "wall" || materialKind === "dark_wall") {
      materialKind = "floor";
    }
    geometryKind = "floor";
    isWall = false;
  }
  return {
    resolved,
    effective,
    materialKind,
    geometryKind,
    isWall,
    isPlayerGlyph: isPlayer,
    isDarkOverlay,
    darkenFactor,
    glyphChar,
    textColor,
    disposition: resolvedDisposition,
    effectKind
  };
}

// src/game/Nethack3DEngine.ts
var Nethack3DEngine = class {
  constructor() {
    this.tileMap = /* @__PURE__ */ new Map();
    this.glyphOverlayMap = /* @__PURE__ */ new Map();
    this.tileStateCache = /* @__PURE__ */ new Map();
    this.lastKnownTerrain = /* @__PURE__ */ new Map();
    this.glyphTextureCache = /* @__PURE__ */ new Map();
    this.pendingTileUpdates = /* @__PURE__ */ new Map();
    this.tileFlushScheduled = false;
    this.playerPos = { x: 0, y: 0 };
    this.gameMessages = [];
    this.floatingMessageLayer = null;
    this.floatingMessageEntries = [];
    this.metaCommandOverlay = null;
    this.hasSeenPlayerPosition = false;
    this.hasPlayerMovedOnce = false;
    this.lastMovementInputAtMs = 0;
    this.maxFloatingMessages = 12;
    this.movementUnlockWindowMs = 5e3;
    this.floatingMessageStackSpacingPx = 30;
    this.floatingMessageFadeDelayMs = 1500;
    this.floatingMessageFadeDurationMs = 520;
    this.floatingMessageRisePx = 44;
    this.statusDebugHistory = [];
    this.currentInventory = [];
    // Store current inventory items
    this.pendingInventoryDialog = false;
    // Flag to show inventory dialog after update
    this.lastInfoMenu = null;
    // Player stats tracking
    this.playerStats = {
      name: "Adventurer",
      hp: 10,
      maxHp: 10,
      power: 0,
      maxPower: 0,
      level: 1,
      experience: 0,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      armor: 10,
      dungeon: "Dungeons of Doom",
      dlevel: 1,
      gold: 0,
      alignment: "Neutral",
      hunger: "Not Hungry",
      encumbrance: "",
      time: 1,
      score: 0
    };
    this.session = null;
    this.metaInputPrefix = "__META__:";
    this.isInMetaCommandInput = false;
    this.metaCommandBuffer = "";
    this.altOrMetaHeld = false;
    // Camera controls
    this.cameraDistance = 20;
    this.cameraPitch = Math.PI / 2 - 0.3;
    // Elevation above the board (0 = horizon)
    this.cameraYaw = 0;
    // Azimuth around the board (0 = facing north)
    this.minCameraPitch = 0.2;
    this.maxCameraPitch = Math.PI / 2 - 0.01;
    this.rotationSpeed = 0.01;
    this.isMiddleMouseDown = false;
    this.isRightMouseDown = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.minDistance = 5;
    this.maxDistance = 50;
    // Direction question handling
    this.isInDirectionQuestion = false;
    // General question handling (pauses all movement)
    this.isInQuestion = false;
    // Camera panning
    this.cameraPanX = 0;
    this.cameraPanY = 0;
    this.cameraFollowHalfLifeMs = 85;
    this.cameraFollowInitialized = false;
    this.cameraFollowTarget = new THREE.Vector3();
    this.cameraFollowCurrent = new THREE.Vector3();
    this.lastFrameTimeMs = null;
    this.hasReceivedHpStatus = false;
    this.pendingCharacterDamageQueue = [];
    this.pendingCharacterDamageMaxAgeMs = 420;
    this.glyphDamageFlashDurationMs = 180;
    this.glyphDamageFlashTextureSize = 256;
    this.glyphDamageFlashRed = new THREE.Color("#ff2d2d");
    this.glyphDamageFlashWhite = new THREE.Color("#ffffff");
    this.glyphDamageFlashColor = new THREE.Color("#ffffff");
    this.glyphDamageFlashes = /* @__PURE__ */ new Map();
    this.damageParticles = [];
    this.lastParsedDamageMessage = "";
    this.lastParsedDamageAtMs = 0;
    this.damageParticleLifetimeMs = 1860;
    this.damageParticleGravity = 18.4;
    this.damageParticleFloorZ = 0.02;
    this.damageParticleWallBounce = 0.35;
    this.tileRevealFadeDurationMs = 240;
    this.tileRevealFades = /* @__PURE__ */ new Map();
    // Pre-create geometries and materials
    this.floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    this.wallGeometry = new THREE.BoxGeometry(
      TILE_SIZE,
      TILE_SIZE,
      WALL_HEIGHT
    );
    // Materials for different glyph types
    this.materials = {
      floor: new THREE.MeshLambertMaterial({ color: 6966568 }),
      stairs_up: new THREE.MeshLambertMaterial({
        color: 4163411,
        emissive: 1388573
      }),
      stairs_down: new THREE.MeshLambertMaterial({
        color: 8215752,
        emissive: 2431802
      }),
      wall: new THREE.MeshLambertMaterial({ color: 6252403 }),
      dark_wall: new THREE.MeshLambertMaterial({ color: 4870240 }),
      door: new THREE.MeshLambertMaterial({
        color: 5913378,
        emissive: 1774090
      }),
      dark: new THREE.MeshLambertMaterial({ color: 1521759 }),
      water: new THREE.MeshLambertMaterial({
        color: 1732030,
        emissive: 533823
      }),
      trap: new THREE.MeshLambertMaterial({
        color: 11299886,
        emissive: 3810063
      }),
      feature: new THREE.MeshLambertMaterial({ color: 7566987 }),
      fountain: new THREE.MeshLambertMaterial({
        color: 3057919,
        emissive: 733005
      }),
      player: new THREE.MeshLambertMaterial({
        color: 3800968,
        emissive: 1133866
      }),
      monster_hostile: new THREE.MeshLambertMaterial({
        color: 10433588,
        emissive: 3215376
      }),
      monster_friendly: new THREE.MeshLambertMaterial({
        color: 3116879,
        emissive: 1191964
      }),
      monster_neutral: new THREE.MeshLambertMaterial({
        color: 3108776,
        emissive: 1058362
      }),
      item: new THREE.MeshLambertMaterial({
        color: 11042586,
        emissive: 3483399
      }),
      effect_warning: new THREE.MeshLambertMaterial({
        color: 10317343,
        emissive: 3154185
      }),
      effect_zap: new THREE.MeshLambertMaterial({
        color: 3113616,
        emissive: 927536
      }),
      effect_explode: new THREE.MeshLambertMaterial({
        color: 10967085,
        emissive: 3414799
      }),
      effect_swallow: new THREE.MeshLambertMaterial({
        color: 6833818,
        emissive: 2234163
      }),
      default: new THREE.MeshLambertMaterial({ color: 16777215 })
    };
    this.effectColors = {
      warning: new THREE.Color(16765286),
      zap: new THREE.Color(8255999),
      explode: new THREE.Color(16757867),
      swallow: new THREE.Color(14199039)
    };
    this.lightingOverlayMesh = null;
    this.lightingOverlayTexture = null;
    this.lightingOverlayCanvas = null;
    this.lightingOverlayContext = null;
    this.lightingOverlayGridMeta = null;
    this.lightingDirty = true;
    this.lightingRadiusTiles = 14;
    this.lightingTilePixels = 30;
    this.lightingFloorFalloffPower = 1.08;
    this.lightingMaxDarkAlpha = 0.82;
    this.lightingDitherStrength = 0.05;
    this.lightingBayer4 = [
      0,
      8,
      2,
      10,
      12,
      4,
      14,
      6,
      3,
      11,
      1,
      9,
      15,
      7,
      13,
      5
    ].map((value) => (value + 0.5) / 16);
    this.initThreeJS();
    this.initUI();
    this.connectToRuntime();
    this.cameraDistance = 15;
    this.cameraPitch = THREE.MathUtils.clamp(
      Math.PI / 2 - 0.2,
      this.minCameraPitch,
      this.maxCameraPitch
    );
    this.cameraYaw = Math.PI;
  }
  isPersistentTerrainKind(kind) {
    switch (kind) {
      case "cmap":
      case "obj":
      case "body":
      case "statue":
      case "unexplored":
      case "nothing":
        return true;
      default:
        return false;
    }
  }
  markLightingDirty() {
    this.lightingDirty = true;
  }
  isUndiscoveredKind(kind) {
    return kind === "unexplored" || kind === "nothing";
  }
  stopTileRevealFade(key) {
    this.tileRevealFades.delete(key);
    const overlay = this.glyphOverlayMap.get(key);
    if (overlay) {
      overlay.material.opacity = 1;
      overlay.material.needsUpdate = true;
    }
  }
  startTileRevealFade(key) {
    const overlay = this.glyphOverlayMap.get(key);
    if (!overlay) {
      return;
    }
    const state = {
      elapsedMs: 0,
      durationMs: this.tileRevealFadeDurationMs,
      opacity: 0
    };
    this.tileRevealFades.set(key, state);
    overlay.material.opacity = state.opacity;
    overlay.material.needsUpdate = true;
  }
  updateTileRevealFades(deltaSeconds) {
    if (!this.tileRevealFades.size) {
      return;
    }
    const deltaMs = deltaSeconds * 1e3;
    const entries = Array.from(this.tileRevealFades.entries());
    for (const [key, state] of entries) {
      const overlay = this.glyphOverlayMap.get(key);
      if (!overlay || !this.tileMap.has(key)) {
        this.tileRevealFades.delete(key);
        continue;
      }
      state.elapsedMs += deltaMs;
      const progress = THREE.MathUtils.clamp(
        state.elapsedMs / state.durationMs,
        0,
        1
      );
      const eased = 1 - Math.pow(1 - progress, 2);
      state.opacity = eased;
      overlay.material.opacity = state.opacity;
      overlay.material.needsUpdate = true;
      if (progress >= 1) {
        this.tileRevealFades.delete(key);
        overlay.material.opacity = 1;
      }
    }
  }
  clearTileRevealFades() {
    const keys = Array.from(this.tileRevealFades.keys());
    this.tileRevealFades.clear();
    for (const key of keys) {
      const overlay = this.glyphOverlayMap.get(key);
      if (overlay) {
        overlay.material.opacity = 1;
      }
    }
  }
  parseTileKey(key) {
    const commaIndex = key.indexOf(",");
    if (commaIndex < 0) {
      return null;
    }
    const x = Number(key.slice(0, commaIndex));
    const y = Number(key.slice(commaIndex + 1));
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { x, y };
  }
  buildLightingGrid() {
    if (this.tileMap.size === 0) {
      return null;
    }
    const cells = [];
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    this.tileMap.forEach((mesh, key) => {
      const parsed = this.parseTileKey(key);
      if (!parsed) {
        return;
      }
      const { x, y } = parsed;
      cells.push({
        x,
        y,
        isWall: Boolean(mesh.userData?.isWall)
      });
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    if (!cells.length) {
      return null;
    }
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const blocked = new Uint8Array(width * height);
    for (const cell of cells) {
      const index = (cell.y - minY) * width + (cell.x - minX);
      blocked[index] = cell.isWall ? 1 : 0;
    }
    return { minX, maxX, minY, maxY, width, height, blocked };
  }
  worldToLightingPixel(grid, worldX, worldY) {
    const tilePixels = this.lightingTilePixels;
    return {
      x: (worldX - (grid.minX - 0.5)) * tilePixels,
      y: (worldY - (grid.minY - 0.5)) * tilePixels
    };
  }
  disposeLightingOverlay() {
    if (this.lightingOverlayMesh) {
      this.scene.remove(this.lightingOverlayMesh);
      this.lightingOverlayMesh.geometry.dispose();
      const material = this.lightingOverlayMesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
      this.lightingOverlayMesh = null;
    }
    if (this.lightingOverlayTexture) {
      this.lightingOverlayTexture.dispose();
      this.lightingOverlayTexture = null;
    }
    this.lightingOverlayCanvas = null;
    this.lightingOverlayContext = null;
    this.lightingOverlayGridMeta = null;
  }
  ensureLightingOverlayResources(grid) {
    const tilePixels = this.lightingTilePixels;
    const widthPixels = Math.max(1, grid.width * tilePixels);
    const heightPixels = Math.max(1, grid.height * tilePixels);
    const shouldRebuild = !this.lightingOverlayMesh || !this.lightingOverlayTexture || !this.lightingOverlayCanvas || !this.lightingOverlayContext || !this.lightingOverlayGridMeta || this.lightingOverlayGridMeta.minX !== grid.minX || this.lightingOverlayGridMeta.maxX !== grid.maxX || this.lightingOverlayGridMeta.minY !== grid.minY || this.lightingOverlayGridMeta.maxY !== grid.maxY || this.lightingOverlayGridMeta.width !== grid.width || this.lightingOverlayGridMeta.height !== grid.height || this.lightingOverlayGridMeta.tilePixels !== tilePixels;
    if (shouldRebuild) {
      this.disposeLightingOverlay();
      const canvas = document.createElement("canvas");
      canvas.width = widthPixels;
      canvas.height = heightPixels;
      const context = canvas.getContext("2d");
      if (!context) {
        return false;
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.generateMipmaps = false;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;
      const geometry = new THREE.PlaneGeometry(
        grid.width * TILE_SIZE,
        grid.height * TILE_SIZE
      );
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        (grid.minX + grid.maxX) * TILE_SIZE / 2,
        (-grid.minY - grid.maxY) * TILE_SIZE / 2,
        WALL_HEIGHT + 0.08
      );
      mesh.renderOrder = 900;
      this.scene.add(mesh);
      this.lightingOverlayMesh = mesh;
      this.lightingOverlayTexture = texture;
      this.lightingOverlayCanvas = canvas;
      this.lightingOverlayContext = context;
      this.lightingOverlayGridMeta = {
        minX: grid.minX,
        maxX: grid.maxX,
        minY: grid.minY,
        maxY: grid.maxY,
        width: grid.width,
        height: grid.height,
        tilePixels
      };
    }
    return Boolean(
      this.lightingOverlayTexture && this.lightingOverlayCanvas && this.lightingOverlayContext
    );
  }
  renderLightingOverlay(grid) {
    if (!this.lightingOverlayTexture || !this.lightingOverlayCanvas || !this.lightingOverlayContext) {
      return;
    }
    const canvas = this.lightingOverlayCanvas;
    const context = this.lightingOverlayContext;
    const widthPixels = canvas.width;
    const heightPixels = canvas.height;
    context.clearRect(0, 0, widthPixels, heightPixels);
    context.globalCompositeOperation = "source-over";
    context.fillStyle = `rgba(0, 0, 0, ${this.lightingMaxDarkAlpha})`;
    context.fillRect(0, 0, widthPixels, heightPixels);
    const playerPixel = this.worldToLightingPixel(
      grid,
      this.playerPos.x,
      this.playerPos.y
    );
    const radiusPixels = this.lightingRadiusTiles * this.lightingTilePixels;
    context.globalCompositeOperation = "destination-out";
    const radial = context.createRadialGradient(
      playerPixel.x,
      playerPixel.y,
      0,
      playerPixel.x,
      playerPixel.y,
      radiusPixels
    );
    const stops = 16;
    for (let i = 0; i <= stops; i++) {
      const t = i / stops;
      const alpha = Math.pow(
        Math.max(0, 1 - t),
        this.lightingFloorFalloffPower
      );
      radial.addColorStop(t, `rgba(0, 0, 0, ${alpha})`);
    }
    context.fillStyle = radial;
    context.beginPath();
    context.arc(playerPixel.x, playerPixel.y, radiusPixels, 0, Math.PI * 2);
    context.fill();
    const imageData = context.getImageData(0, 0, widthPixels, heightPixels);
    const data = imageData.data;
    for (let y = 0; y < heightPixels; y++) {
      for (let x = 0; x < widthPixels; x++) {
        const index = (y * widthPixels + x) * 4;
        const alpha = data[index + 3] / 255;
        const dither = (this.lightingBayer4[(x & 3) + ((y & 3) << 2)] - 0.5) * this.lightingDitherStrength;
        const adjusted = THREE.MathUtils.clamp(alpha + dither, 0, 1);
        data[index + 3] = Math.round(adjusted * 255);
      }
    }
    context.putImageData(imageData, 0, 0);
    context.globalCompositeOperation = "source-over";
    this.lightingOverlayTexture.needsUpdate = true;
  }
  updateLightingOverlay() {
    if (!this.lightingDirty) {
      return;
    }
    this.lightingDirty = false;
    const grid = this.buildLightingGrid();
    if (!grid) {
      this.disposeLightingOverlay();
      return;
    }
    if (!this.ensureLightingOverlayResources(grid)) {
      this.lightingDirty = true;
      return;
    }
    this.renderLightingOverlay(grid);
  }
  initThreeJS() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1e3
    );
    this.camera.up.set(0, 0, 1);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(17);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);
    this.loadCameraSmoothingFromCSS();
    const ambientLight = new THREE.AmbientLight(4210752, 0.4);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(16777215, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
    window.addEventListener("resize", this.onWindowResize.bind(this), false);
    window.addEventListener("keydown", this.handleKeyDown.bind(this), false);
    window.addEventListener("keyup", this.handleKeyUp.bind(this), false);
    window.addEventListener("blur", this.handleWindowBlur.bind(this), false);
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
    window.addEventListener("contextmenu", (e) => e.preventDefault(), false);
    this.animate();
  }
  loadCameraSmoothingFromCSS() {
    const cssValue = getComputedStyle(document.documentElement).getPropertyValue("--camera-follow-half-life-ms").trim();
    const parsed = Number.parseFloat(cssValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      this.cameraFollowHalfLifeMs = parsed;
    }
  }
  initUI() {
    const statusElement = document.getElementById("game-status");
    if (statusElement) {
      statusElement.innerHTML = "Starting local NetHack runtime...";
    }
    const connStatus = document.createElement("div");
    connStatus.id = "connection-status";
    connStatus.setAttribute("data-state", "disconnected");
    connStatus.innerHTML = "Disconnected";
    document.body.appendChild(connStatus);
    const floatingMessageLayer = document.createElement("div");
    floatingMessageLayer.id = "floating-log-message-layer";
    document.body.appendChild(floatingMessageLayer);
    this.floatingMessageLayer = floatingMessageLayer;
  }
  async connectToRuntime() {
    console.log("Starting local NetHack runtime");
    this.updateConnectionStatus("Starting", "#4444aa");
    this.session = new WorkerRuntimeBridge((payload) => {
      this.handleRuntimeEvent(payload);
    });
    try {
      await this.session.start();
      this.updateConnectionStatus("Running", "#00aa00");
      this.updateStatus("Local NetHack runtime started");
      this.addGameMessage("Local NetHack runtime started");
      const loading = document.getElementById("loading");
      if (loading) {
        loading.classList.add("is-hidden");
      }
    } catch (error) {
      console.error("Failed to start local NetHack runtime:", error);
      this.updateConnectionStatus("Error", "#aa0000");
      this.updateStatus("Failed to start local NetHack runtime");
      this.addGameMessage("Failed to start local NetHack runtime");
    }
  }
  handleRuntimeEvent(data) {
    switch (data.type) {
      case "map_glyph":
        this.tryResolvePendingCharacterDamage(data);
        this.enqueueTileUpdate(data);
        break;
      case "map_glyph_batch":
        if (Array.isArray(data.tiles)) {
          for (const tile of data.tiles) {
            this.tryResolvePendingCharacterDamage(tile);
            this.enqueueTileUpdate(tile);
          }
        }
        break;
      case "player_position":
        console.log(
          `\u{1F3AF} Received player position update: (${data.x}, ${data.y})`
        );
        const oldPos = { ...this.playerPos };
        this.recordPlayerMovement(oldPos.x, oldPos.y, data.x, data.y);
        this.playerPos = { x: data.x, y: data.y };
        this.markLightingDirty();
        console.log(
          `\u{1F3AF} Player position changed from (${oldPos.x}, ${oldPos.y}) to (${data.x}, ${data.y})`
        );
        this.updateStatus(`Player at (${data.x}, ${data.y}) - NetHack 3D`);
        break;
      case "force_player_redraw":
        console.log(
          `\u{1F3AF} Force redraw player from (${data.oldPosition.x}, ${data.oldPosition.y}) to (${data.newPosition.x}, ${data.newPosition.y})`
        );
        this.recordPlayerMovement(
          data.oldPosition.x,
          data.oldPosition.y,
          data.newPosition.x,
          data.newPosition.y
        );
        this.playerPos = { x: data.newPosition.x, y: data.newPosition.y };
        this.markLightingDirty();
        const oldKey = `${data.oldPosition.x},${data.oldPosition.y}`;
        const oldOverlay = this.glyphOverlayMap.get(oldKey);
        if (oldOverlay) {
          console.log(
            `\u{1F3AF} Clearing old player overlay at (${data.oldPosition.x}, ${data.oldPosition.y})`
          );
          this.disposeGlyphOverlay(oldOverlay);
          this.glyphOverlayMap.delete(oldKey);
        }
        const oldTerrain = this.lastKnownTerrain.get(oldKey);
        if (oldTerrain) {
          this.updateTile(
            data.oldPosition.x,
            data.oldPosition.y,
            oldTerrain.glyph,
            oldTerrain.char,
            oldTerrain.color
          );
        } else {
          this.requestTileUpdate(data.oldPosition.x, data.oldPosition.y);
        }
        this.updateTile(data.newPosition.x, data.newPosition.y, 331, "@", 0);
        console.log(
          `\u{1F3AF} Player visual updated to position (${data.newPosition.x}, ${data.newPosition.y})`
        );
        break;
      case "text":
        this.captureDamageFromMessage(data.text);
        this.addGameMessage(data.text);
        break;
      case "raw_print":
        this.captureDamageFromMessage(data.text);
        this.addGameMessage(data.text);
        break;
      case "menu_item":
        break;
      case "direction_question":
        this.isInQuestion = true;
        this.showDirectionQuestion(data.text);
        break;
      case "question":
        if (data.text && (data.text.includes("character") || data.text.includes("class") || data.text.includes("race") || data.text.includes("gender") || data.text.includes("alignment"))) {
          console.log("Auto-handling character creation:", data.text);
          if (data.menuItems && data.menuItems.length > 0) {
            this.sendInput(data.menuItems[0].accelerator);
          } else if (data.default) {
            this.sendInput(data.default);
          } else {
            this.sendInput("a");
          }
          return;
        }
        this.isInQuestion = true;
        this.showQuestion(
          data.text,
          data.choices,
          data.default,
          data.menuItems
        );
        break;
      case "inventory_update":
        const itemCount = data.items ? data.items.length : 0;
        const actualItems = data.items ? data.items.filter((item) => !item.isCategory) : [];
        console.log(
          `\u{1F4E6} Received inventory update with ${itemCount} total items (${actualItems.length} actual items)`
        );
        this.currentInventory = data.items || [];
        if (this.pendingInventoryDialog) {
          console.log("\u{1F4E6} Showing inventory dialog with fresh data");
          this.pendingInventoryDialog = false;
          this.showInventoryDialog();
        }
        this.updateInventoryDisplay(data.items);
        break;
      case "info_menu":
        this.lastInfoMenu = {
          title: String(data.title || "NetHack Information"),
          lines: Array.isArray(data.lines) ? data.lines : []
        };
        this.showInfoMenuDialog(
          this.lastInfoMenu.title,
          this.lastInfoMenu.lines
        );
        break;
      case "position_request":
        if (data.text && data.text.trim() && !data.text.includes("cursor") && !data.text.includes("Select a position")) {
          this.showPositionRequest(data.text);
        }
        break;
      case "name_request":
        console.log("Auto-providing default name for:", data.text);
        this.sendInput("Player");
        break;
      case "area_refresh_complete":
        console.log(
          `\u{1F504} Area refresh completed: ${data.tilesRefreshed} tiles refreshed around (${data.centerX}, ${data.centerY})`
        );
        this.addGameMessage(
          `Refreshed ${data.tilesRefreshed} tiles around (${data.centerX}, ${data.centerY})`
        );
        break;
      case "tile_not_found":
        console.log(
          `\u26A0\uFE0F Tile not found at (${data.x}, ${data.y}): ${data.message}`
        );
        break;
      case "clear_scene":
        console.log("\u{1F9F9} Clearing 3D scene for level transition");
        this.clearScene();
        if (data.message) {
          this.addGameMessage(data.message);
        }
        break;
      case "status_update":
        console.log(
          `Status update: ${data.fieldName || data.field} = "${data.value}" (type=${data.valueType || "unknown"})`
        );
        this.updatePlayerStats(data.field, data.value, data);
        break;
      case "damage_event":
        if (typeof data.x === "number" && typeof data.y === "number" && typeof data.amount === "number") {
          this.triggerDamageEffectsAtTile(data.x, data.y, data.amount);
        }
        break;
      default:
        console.log("Unknown message type:", data.type, data);
    }
  }
  isDamageFlashableBehavior(behavior) {
    if (behavior.isPlayerGlyph) {
      return true;
    }
    switch (behavior.effective.kind) {
      case "mon":
      case "pet":
      case "ridden":
      case "detect":
      case "invis":
        return true;
      default:
        return false;
    }
  }
  classifyTilePayload(tile) {
    if (!tile || typeof tile.x !== "number" || typeof tile.y !== "number" || typeof tile.glyph !== "number") {
      return null;
    }
    const key = `${tile.x},${tile.y}`;
    return classifyTileBehavior({
      glyph: tile.glyph,
      runtimeChar: typeof tile.char === "string" ? tile.char : null,
      runtimeColor: typeof tile.color === "number" ? tile.color : null,
      priorTerrain: this.lastKnownTerrain.get(key) ?? null
    });
  }
  extractDamageAmountFromMessage(message) {
    const patterns = [
      /\bfor\s+(-?\d+)\s+damage\b/i,
      /\btakes?\s+(-?\d+)\s+damage\b/i,
      /\bdeals?\s+(-?\d+)\s+damage\b/i,
      /\b(-?\d+)\s+points?\s+of\s+damage\b/i
    ];
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (!match || !match[1]) {
        continue;
      }
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed !== 0) {
        return Math.abs(parsed);
      }
    }
    return null;
  }
  isCombatDamageMessage(message) {
    if (/\b(?:hits?|bites?|kicks?|claws?|slashes?|strikes?|punches?|shoots?|zaps?|burns?|stings?|mauls?|wounds?)\b/i.test(
      message
    )) {
      return true;
    }
    if (/\byou\s+(?:hit|bite|kick|slash|strike|punch|shoot|zap)\b/i.test(message)) {
      return true;
    }
    return /\btakes?\s+-?\d+\s+damage\b/i.test(message);
  }
  isPlayerDamageVictimMessage(message) {
    if (/\b(?:hits?|bites?|kicks?|claws?|slashes?|strikes?|punches?|shoots?|zaps?|burns?|stings?|mauls?|wounds?)\s+you\b/i.test(
      message
    )) {
      return true;
    }
    if (/\byou\s+(?:take|suffer|receive|lose)\s+-?\d+\s+damage\b/i.test(message)) {
      return true;
    }
    return /\byou are (?:hit|burned|zapped|injured|wounded)\b/i.test(message);
  }
  queuePendingCharacterDamage(amount) {
    const sanitized = Math.max(1, Math.round(Math.abs(amount)));
    this.pendingCharacterDamageQueue.push({
      amount: sanitized,
      createdAtMs: Date.now()
    });
    if (this.pendingCharacterDamageQueue.length > 8) {
      this.pendingCharacterDamageQueue.splice(
        0,
        this.pendingCharacterDamageQueue.length - 8
      );
    }
  }
  prunePendingCharacterDamage(nowMs) {
    this.pendingCharacterDamageQueue = this.pendingCharacterDamageQueue.filter(
      (entry) => nowMs - entry.createdAtMs <= this.pendingCharacterDamageMaxAgeMs
    );
  }
  captureDamageFromMessage(messageLike) {
    if (typeof messageLike !== "string") {
      return;
    }
    const normalized = messageLike.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return;
    }
    const amount = this.extractDamageAmountFromMessage(normalized);
    if (!amount || !this.isCombatDamageMessage(normalized)) {
      return;
    }
    if (this.isPlayerDamageVictimMessage(normalized)) {
      return;
    }
    const now = Date.now();
    if (normalized === this.lastParsedDamageMessage && now - this.lastParsedDamageAtMs < 120) {
      return;
    }
    this.lastParsedDamageMessage = normalized;
    this.lastParsedDamageAtMs = now;
    this.queuePendingCharacterDamage(amount);
  }
  tryResolvePendingCharacterDamage(tile) {
    if (!this.pendingCharacterDamageQueue.length) {
      return;
    }
    const now = Date.now();
    this.prunePendingCharacterDamage(now);
    if (!this.pendingCharacterDamageQueue.length) {
      return;
    }
    const behavior = this.classifyTilePayload(tile);
    if (!behavior || behavior.isPlayerGlyph || !this.isDamageFlashableBehavior(behavior)) {
      return;
    }
    const nextDamage = this.pendingCharacterDamageQueue.shift();
    if (!nextDamage || typeof tile.x !== "number" || typeof tile.y !== "number") {
      return;
    }
    this.triggerDamageEffectsAtTile(tile.x, tile.y, nextDamage.amount);
  }
  triggerDamageEffectsAtTile(x, y, amount) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(amount)) {
      return;
    }
    const damage = Math.max(1, Math.round(Math.abs(amount)));
    const key = `${x},${y}`;
    this.startGlyphDamageFlash(key);
    this.spawnDamageNumberParticle(x, y, damage);
  }
  enqueueTileUpdate(tile) {
    if (!tile || typeof tile.x !== "number" || typeof tile.y !== "number") {
      return;
    }
    const key = `${tile.x},${tile.y}`;
    this.pendingTileUpdates.set(key, tile);
    if (this.tileFlushScheduled) {
      return;
    }
    this.tileFlushScheduled = true;
    requestAnimationFrame(() => this.flushPendingTileUpdates());
  }
  flushPendingTileUpdates() {
    this.tileFlushScheduled = false;
    if (!this.pendingTileUpdates.size) {
      return;
    }
    const updates = Array.from(this.pendingTileUpdates.values());
    this.pendingTileUpdates.clear();
    for (const tile of updates) {
      const key = `${tile.x},${tile.y}`;
      const signature = `${tile.glyph}|${tile.char ?? ""}|${tile.color ?? ""}`;
      if (this.tileStateCache.get(key) === signature) {
        continue;
      }
      this.tileStateCache.set(key, signature);
      this.updateTile(tile.x, tile.y, tile.glyph, tile.char, tile.color);
    }
  }
  /**
   * Request a view update for a specific tile from the local runtime
   * @param x The x coordinate of the tile
   * @param y The y coordinate of the tile
   */
  requestTileUpdate(x, y) {
    if (this.session) {
      console.log(`Requesting tile update for (${x}, ${y})`);
      this.session.requestTileUpdate(x, y);
    } else {
      console.log("Cannot request tile update - runtime not started");
    }
  }
  requestAreaUpdate(centerX, centerY, radius = 3) {
    if (this.session) {
      console.log(
        `Requesting area update centered at (${centerX}, ${centerY}) with radius ${radius}`
      );
      this.session.requestAreaUpdate(centerX, centerY, radius);
    } else {
      console.log("Cannot request area update - runtime not started");
    }
  }
  requestPlayerAreaUpdate(radius = 5) {
    this.requestAreaUpdate(this.playerPos.x, this.playerPos.y, radius);
  }
  acquireGlyphTexture(textureKey, factory) {
    const cached = this.glyphTextureCache.get(textureKey);
    if (cached) {
      cached.refCount += 1;
      return cached.texture;
    }
    const texture = factory();
    this.glyphTextureCache.set(textureKey, { texture, refCount: 1 });
    return texture;
  }
  releaseGlyphTexture(textureKey) {
    if (!textureKey) {
      return;
    }
    const cached = this.glyphTextureCache.get(textureKey);
    if (!cached) {
      return;
    }
    cached.refCount -= 1;
    if (cached.refCount <= 0) {
      cached.texture.dispose();
      this.glyphTextureCache.delete(textureKey);
    }
  }
  disposeGlyphOverlay(overlay) {
    this.releaseGlyphTexture(overlay.textureKey);
    overlay.texture = null;
    overlay.textureKey = "";
    overlay.material.dispose();
  }
  toneColor(hex, factor) {
    const color = new THREE.Color(`#${hex}`);
    color.multiplyScalar(THREE.MathUtils.clamp(factor, 0, 1));
    return color.getHexString();
  }
  relativeLuminance(color) {
    const channel = (value) => {
      if (value <= 0.03928) return value / 12.92;
      return Math.pow((value + 0.055) / 1.055, 2.4);
    };
    const r = channel(color.r);
    const g = channel(color.g);
    const b = channel(color.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  contrastRatio(background, text) {
    const l1 = this.relativeLuminance(background);
    const l2 = this.relativeLuminance(text);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }
  ensureTextContrast(tonedBackgroundHex, textColor, minContrast = 4.5) {
    const background = new THREE.Color(`#${tonedBackgroundHex}`);
    const text = new THREE.Color();
    text.set(textColor || "#ffffff");
    if (this.contrastRatio(background, text) >= minContrast) {
      return background.getHexString();
    }
    for (let i = 0; i < 6; i++) {
      background.multiplyScalar(0.85);
      if (this.contrastRatio(background, text) >= minContrast) {
        return background.getHexString();
      }
    }
    return background.getHexString();
  }
  ensureGlyphOverlay(key, baseMaterial) {
    const baseColorHex = baseMaterial.color.getHexString();
    let overlay = this.glyphOverlayMap.get(key);
    const needsNewOverlay = !overlay || overlay.baseColorHex !== baseColorHex || overlay.material instanceof THREE.MeshLambertMaterial === true;
    if (needsNewOverlay) {
      if (overlay) {
        this.disposeGlyphOverlay(overlay);
      }
      const materialClone = new THREE.MeshBasicMaterial({
        color: 14540253,
        transparent: true,
        opacity: 1
      });
      overlay = {
        texture: null,
        material: materialClone,
        baseColorHex,
        textureKey: ""
      };
      this.glyphOverlayMap.set(key, overlay);
    }
    return overlay;
  }
  createGlyphTexture(baseColorHex, glyphChar, textColor, darkenFactor = 1, size = 256) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create glyph texture canvas context");
    }
    this.drawGlyphTextureToCanvas(
      context,
      size,
      baseColorHex,
      glyphChar,
      textColor,
      darkenFactor
    );
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = Math.min(
      4,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
  }
  drawGlyphTextureToCanvas(context, size, baseColorHex, glyphChar, textColor, darkenFactor = 1) {
    context.clearRect(0, 0, size, size);
    const tonedBackground = this.toneColor(
      baseColorHex,
      0.8 * THREE.MathUtils.clamp(darkenFactor, 0, 1)
    );
    const contrastBackground = this.ensureTextContrast(
      tonedBackground,
      textColor
    );
    context.fillStyle = `#${contrastBackground}`;
    context.fillRect(0, 0, size, size);
    const trimmed = glyphChar.trim();
    if (trimmed.length === 0) {
      return;
    }
    const fontSize = Math.floor(size * 0.6);
    context.font = `bold ${fontSize}px monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = textColor;
    context.fillText(trimmed, size / 2, size / 2);
  }
  startGlyphDamageFlash(key) {
    const mesh = this.tileMap.get(key);
    const overlay = this.glyphOverlayMap.get(key);
    if (!mesh || !overlay || !overlay.texture || !mesh.userData || !mesh.userData.isDamageFlashableCharacter) {
      return;
    }
    const glyphChar = typeof mesh.userData.glyphChar === "string" ? mesh.userData.glyphChar : "";
    if (!glyphChar.trim()) {
      return;
    }
    const baseColorHex = typeof mesh.userData.glyphBaseColorHex === "string" && mesh.userData.glyphBaseColorHex ? mesh.userData.glyphBaseColorHex : overlay.baseColorHex;
    const darkenFactor = typeof mesh.userData.glyphDarkenFactor === "number" ? THREE.MathUtils.clamp(mesh.userData.glyphDarkenFactor, 0, 1) : 1;
    let state = this.glyphDamageFlashes.get(key);
    if (!state) {
      const canvas = document.createElement("canvas");
      const size = this.glyphDamageFlashTextureSize;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      texture.anisotropy = Math.min(
        4,
        this.renderer.capabilities.getMaxAnisotropy()
      );
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      state = {
        key,
        canvas,
        context,
        texture,
        elapsedMs: 0,
        durationMs: this.glyphDamageFlashDurationMs,
        baseColorHex,
        glyphChar,
        darkenFactor
      };
      this.glyphDamageFlashes.set(key, state);
    } else {
      state.elapsedMs = 0;
      state.baseColorHex = baseColorHex;
      state.glyphChar = glyphChar;
      state.darkenFactor = darkenFactor;
    }
    overlay.material.map = state.texture;
    overlay.material.needsUpdate = true;
    this.renderGlyphDamageFlash(state, 1);
  }
  renderGlyphDamageFlash(state, intensity) {
    const clamped = THREE.MathUtils.clamp(intensity, 0, 1);
    this.glyphDamageFlashColor.copy(this.glyphDamageFlashWhite).lerp(this.glyphDamageFlashRed, clamped);
    const flashTextColor = `#${this.glyphDamageFlashColor.getHexString()}`;
    this.drawGlyphTextureToCanvas(
      state.context,
      state.canvas.width,
      state.baseColorHex,
      state.glyphChar,
      flashTextColor,
      state.darkenFactor
    );
    state.texture.needsUpdate = true;
  }
  stopGlyphDamageFlash(key) {
    const state = this.glyphDamageFlashes.get(key);
    if (!state) {
      return;
    }
    const overlay = this.glyphOverlayMap.get(key);
    if (overlay) {
      overlay.material.map = overlay.texture;
      overlay.material.needsUpdate = true;
    }
    state.texture.dispose();
    this.glyphDamageFlashes.delete(key);
  }
  updateGlyphDamageFlashes(deltaSeconds) {
    if (this.glyphDamageFlashes.size === 0) {
      return;
    }
    const deltaMs = deltaSeconds * 1e3;
    const entries = Array.from(this.glyphDamageFlashes.entries());
    for (const [key, state] of entries) {
      if (!this.tileMap.has(key) || !this.glyphOverlayMap.has(key)) {
        this.stopGlyphDamageFlash(key);
        continue;
      }
      state.elapsedMs += deltaMs;
      const progress = THREE.MathUtils.clamp(
        state.elapsedMs / state.durationMs,
        0,
        1
      );
      const intensity = Math.exp(-8.5 * progress);
      this.renderGlyphDamageFlash(state, intensity);
      const overlay = this.glyphOverlayMap.get(key);
      if (overlay) {
        overlay.material.map = state.texture;
      }
      if (progress >= 1) {
        this.stopGlyphDamageFlash(key);
      }
    }
  }
  createDamageNumberTexture(label) {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create damage number canvas context");
    }
    context.clearRect(0, 0, size, size);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `900 ${Math.floor(size * 0.52)}px "Segoe UI", "Segoe UI Variable", sans-serif`;
    context.lineWidth = Math.max(3, Math.floor(size * 0.045));
    context.strokeStyle = "rgba(18, 0, 0, 0.95)";
    context.fillStyle = "#ff3a3a";
    context.strokeText(label, size / 2, size / 2);
    context.fillText(label, size / 2, size / 2);
    const measured = context.measureText(label).width;
    const aspectRatio = THREE.MathUtils.clamp(
      measured / (size * 0.42),
      0.6,
      2.3
    );
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.anisotropy = Math.min(
      4,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return { texture, aspectRatio };
  }
  spawnDamageNumberParticle(tileX, tileY, damage) {
    const label = `-${Math.max(1, Math.round(Math.abs(damage)))}`;
    const { texture, aspectRatio } = this.createDamageNumberTexture(label);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false
    });
    material.opacity = 1;
    const sprite = new THREE.Sprite(material);
    const scaleMultiplier = 2.5;
    const scaleY = 0.42 * scaleMultiplier;
    const widthTighten = 0.72;
    const scaleX = THREE.MathUtils.clamp(
      scaleY * aspectRatio * widthTighten,
      0.26 * scaleMultiplier,
      0.92 * scaleMultiplier
    );
    const baseScale = new THREE.Vector2(scaleX, scaleY);
    sprite.scale.set(baseScale.x, baseScale.y, 1);
    sprite.position.set(
      tileX * TILE_SIZE,
      -tileY * TILE_SIZE,
      this.damageParticleFloorZ + 0.28
    );
    sprite.renderOrder = 940;
    this.scene.add(sprite);
    const launchSpeed = (1.95 + Math.random() * 0.45) * 5;
    const launchAngleRad = THREE.MathUtils.degToRad(10);
    const launchAzimuthRad = Math.random() * Math.PI * 2;
    const horizontalSpeed = launchSpeed * Math.sin(launchAngleRad);
    const verticalSpeed = launchSpeed * Math.cos(launchAngleRad);
    this.damageParticles.push({
      sprite,
      velocity: new THREE.Vector3(
        Math.cos(launchAzimuthRad) * horizontalSpeed,
        Math.sin(launchAzimuthRad) * horizontalSpeed,
        verticalSpeed
      ),
      ageMs: 0,
      lifetimeMs: this.damageParticleLifetimeMs,
      radius: 0.09,
      baseScale
    });
  }
  disposeDamageParticle(index) {
    if (index < 0 || index >= this.damageParticles.length) {
      return;
    }
    const [particle] = this.damageParticles.splice(index, 1);
    this.scene.remove(particle.sprite);
    const material = particle.sprite.material;
    if (material instanceof THREE.SpriteMaterial) {
      if (material.map) {
        material.map.dispose();
      }
      material.dispose();
    }
  }
  resolveDamageParticleAgainstWallTile(particle, tileX, tileY) {
    const position = particle.sprite.position;
    const half = TILE_SIZE / 2;
    const centerX = tileX * TILE_SIZE;
    const centerY = -tileY * TILE_SIZE;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;
    const radius = particle.radius;
    const closestX = THREE.MathUtils.clamp(position.x, minX, maxX);
    const closestY = THREE.MathUtils.clamp(position.y, minY, maxY);
    let nx = position.x - closestX;
    let ny = position.y - closestY;
    const distSq = nx * nx + ny * ny;
    if (distSq >= radius * radius) {
      return false;
    }
    let penetration = 0;
    if (distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      nx /= dist;
      ny /= dist;
      penetration = radius - dist;
    } else {
      const toLeft = position.x - minX;
      const toRight = maxX - position.x;
      const toBottom = position.y - minY;
      const toTop = maxY - position.y;
      const minPenetration = Math.min(toLeft, toRight, toBottom, toTop);
      if (minPenetration === toLeft) {
        nx = -1;
        ny = 0;
        penetration = toLeft + radius;
      } else if (minPenetration === toRight) {
        nx = 1;
        ny = 0;
        penetration = toRight + radius;
      } else if (minPenetration === toBottom) {
        nx = 0;
        ny = -1;
        penetration = toBottom + radius;
      } else {
        nx = 0;
        ny = 1;
        penetration = toTop + radius;
      }
    }
    position.x += nx * penetration;
    position.y += ny * penetration;
    const velocityIntoWall = particle.velocity.x * nx + particle.velocity.y * ny;
    if (velocityIntoWall < 0) {
      const bounce = (1 + this.damageParticleWallBounce) * velocityIntoWall;
      particle.velocity.x -= bounce * nx;
      particle.velocity.y -= bounce * ny;
      particle.velocity.x *= 0.78;
      particle.velocity.y *= 0.78;
    }
    return true;
  }
  resolveDamageParticleWallCollision(particle) {
    if (particle.sprite.position.z > WALL_HEIGHT + 0.22) {
      return;
    }
    const approxTileX = Math.round(particle.sprite.position.x / TILE_SIZE);
    const approxTileY = Math.round(-particle.sprite.position.y / TILE_SIZE);
    for (let x = approxTileX - 1; x <= approxTileX + 1; x += 1) {
      for (let y = approxTileY - 1; y <= approxTileY + 1; y += 1) {
        const wall = this.tileMap.get(`${x},${y}`);
        if (!wall || !wall.userData?.isWall) {
          continue;
        }
        this.resolveDamageParticleAgainstWallTile(particle, x, y);
      }
    }
  }
  updateDamageParticles(deltaSeconds) {
    if (!this.damageParticles.length) {
      return;
    }
    const deltaMs = deltaSeconds * 1e3;
    const drag = Math.exp(-2.4 * deltaSeconds);
    for (let i = this.damageParticles.length - 1; i >= 0; i -= 1) {
      const particle = this.damageParticles[i];
      particle.ageMs += deltaMs;
      particle.velocity.z -= this.damageParticleGravity * deltaSeconds;
      particle.velocity.x *= drag;
      particle.velocity.y *= drag;
      particle.sprite.position.x += particle.velocity.x * deltaSeconds;
      particle.sprite.position.y += particle.velocity.y * deltaSeconds;
      particle.sprite.position.z += particle.velocity.z * deltaSeconds;
      this.resolveDamageParticleWallCollision(particle);
      if (particle.sprite.position.z < this.damageParticleFloorZ) {
        particle.sprite.position.z = this.damageParticleFloorZ;
        if (particle.velocity.z < 0) {
          particle.velocity.z *= -0.22;
        }
        particle.velocity.x *= 0.82;
        particle.velocity.y *= 0.82;
      }
      const material = particle.sprite.material;
      if (!(material instanceof THREE.SpriteMaterial)) {
        this.disposeDamageParticle(i);
        continue;
      }
      const lifeT = THREE.MathUtils.clamp(
        particle.ageMs / particle.lifetimeMs,
        0,
        1
      );
      material.opacity = Math.max(0, 1 - lifeT * lifeT);
      const scaleBoost = 1 + (1 - lifeT) * 0.08;
      particle.sprite.scale.set(
        particle.baseScale.x * scaleBoost,
        particle.baseScale.y * scaleBoost,
        1
      );
      if (lifeT >= 1 || material.opacity <= 0.01) {
        this.disposeDamageParticle(i);
      }
    }
  }
  updateDamageEffects(deltaSeconds) {
    this.updateGlyphDamageFlashes(deltaSeconds);
    this.updateDamageParticles(deltaSeconds);
    this.prunePendingCharacterDamage(Date.now());
  }
  clearDamageEffects() {
    const flashKeys = Array.from(this.glyphDamageFlashes.keys());
    for (const key of flashKeys) {
      this.stopGlyphDamageFlash(key);
    }
    for (let i = this.damageParticles.length - 1; i >= 0; i -= 1) {
      this.disposeDamageParticle(i);
    }
    this.pendingCharacterDamageQueue = [];
    this.lastParsedDamageMessage = "";
    this.lastParsedDamageAtMs = 0;
  }
  applyGlyphMaterial(key, mesh, baseMaterial, glyphChar, textColor, isWall, darkenFactor = 1) {
    const overlay = this.ensureGlyphOverlay(key, baseMaterial);
    const baseColorHex = baseMaterial.color.getHexString();
    const clampedDarken = THREE.MathUtils.clamp(darkenFactor, 0, 1);
    const textureKey = `${baseColorHex}|${glyphChar}|${textColor}|${clampedDarken.toFixed(3)}`;
    if (overlay.textureKey !== textureKey) {
      if (overlay.textureKey) {
        this.releaseGlyphTexture(overlay.textureKey);
      }
      overlay.baseColorHex = baseColorHex;
      overlay.material.color.set("#ffffff");
      overlay.texture = this.acquireGlyphTexture(
        textureKey,
        () => this.createGlyphTexture(
          baseColorHex,
          glyphChar,
          textColor,
          clampedDarken
        )
      );
      overlay.material.map = overlay.texture;
      overlay.material.needsUpdate = true;
      overlay.textureKey = textureKey;
    }
    overlay.material.color.set("#ffffff");
    const flashState = this.glyphDamageFlashes.get(key);
    if (flashState) {
      flashState.baseColorHex = baseColorHex;
      flashState.glyphChar = glyphChar;
      flashState.darkenFactor = clampedDarken;
      overlay.material.map = flashState.texture;
      overlay.material.needsUpdate = true;
    }
    const revealState = this.tileRevealFades.get(key);
    if (revealState) {
      overlay.material.opacity = revealState.opacity;
      overlay.material.needsUpdate = true;
    } else {
      overlay.material.opacity = 1;
    }
    if (isWall) {
      mesh.material = [
        baseMaterial,
        baseMaterial,
        baseMaterial,
        baseMaterial,
        overlay.material,
        baseMaterial
      ];
    } else {
      mesh.material = overlay.material;
    }
  }
  getMaterialByKind(kind) {
    switch (kind) {
      case "floor":
        return this.materials.floor;
      case "stairs_up":
        return this.materials.stairs_up;
      case "stairs_down":
        return this.materials.stairs_down;
      case "wall":
        return this.materials.wall;
      case "dark_wall":
        return this.materials.dark_wall;
      case "door":
        return this.materials.door;
      case "dark":
        return this.materials.dark;
      case "water":
        return this.materials.water;
      case "trap":
        return this.materials.trap;
      case "feature":
        return this.materials.feature;
      case "fountain":
        return this.materials.fountain;
      case "player":
        return this.materials.player;
      case "monster_hostile":
        return this.materials.monster_hostile;
      case "monster_friendly":
        return this.materials.monster_friendly;
      case "monster_neutral":
        return this.materials.monster_neutral;
      case "item":
        return this.materials.item;
      case "effect_warning":
        return this.materials.effect_warning;
      case "effect_zap":
        return this.materials.effect_zap;
      case "effect_explode":
        return this.materials.effect_explode;
      case "effect_swallow":
        return this.materials.effect_swallow;
      default:
        return this.materials.default;
    }
  }
  clearScene() {
    this.clearDamageEffects();
    this.clearTileRevealFades();
    console.log("\u{1F9F9} Clearing all tiles and glyph overlays from 3D scene");
    this.tileMap.forEach((mesh, key) => {
      this.scene.remove(mesh);
    });
    this.tileMap.clear();
    this.glyphOverlayMap.forEach((overlay) => {
      this.disposeGlyphOverlay(overlay);
    });
    this.glyphOverlayMap.clear();
    this.glyphTextureCache.forEach(({ texture }) => texture.dispose());
    this.glyphTextureCache.clear();
    this.disposeLightingOverlay();
    this.tileStateCache.clear();
    this.lastKnownTerrain.clear();
    this.pendingTileUpdates.clear();
    this.tileFlushScheduled = false;
    this.markLightingDirty();
    console.log("\u{1F9F9} Scene cleared - ready for new level");
  }
  updateTile(x, y, glyph, char, color) {
    const key = `${x},${y}`;
    let mesh = this.tileMap.get(key);
    const hadMesh = Boolean(mesh);
    const wasUndiscovered = mesh ? Boolean(mesh.userData?.isUndiscovered) : true;
    const behavior = classifyTileBehavior({
      glyph,
      runtimeChar: char ?? null,
      runtimeColor: typeof color === "number" ? color : null,
      priorTerrain: this.lastKnownTerrain.get(key) ?? null
    });
    const isUndiscovered = this.isUndiscoveredKind(behavior.effective.kind);
    const shouldRevealFade = !isUndiscovered && (!hadMesh || wasUndiscovered);
    if (!behavior.isPlayerGlyph) {
      if (this.isPersistentTerrainKind(behavior.resolved.kind)) {
        this.lastKnownTerrain.set(key, {
          glyph,
          char: behavior.resolved.char ?? void 0,
          color: behavior.resolved.color ?? void 0
        });
      }
    } else {
      const oldPos = { ...this.playerPos };
      this.recordPlayerMovement(oldPos.x, oldPos.y, x, y);
      this.playerPos = { x, y };
      this.updateStatus(`Player at (${x}, ${y}) - NetHack 3D`);
    }
    const material = this.getMaterialByKind(behavior.materialKind);
    const geometry = behavior.geometryKind === "wall" ? this.wallGeometry : this.floorGeometry;
    const targetZ = behavior.isWall ? WALL_HEIGHT / 2 : 0;
    if (!mesh) {
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x * TILE_SIZE, -y * TILE_SIZE, targetZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.tileMap.set(key, mesh);
    } else {
      mesh.geometry = geometry;
      mesh.position.set(x * TILE_SIZE, -y * TILE_SIZE, targetZ);
    }
    mesh.userData.isWall = behavior.isWall;
    mesh.userData.effectKind = behavior.effectKind;
    mesh.userData.disposition = behavior.disposition;
    mesh.userData.isDamageFlashableCharacter = this.isDamageFlashableBehavior(behavior);
    mesh.userData.glyphChar = behavior.glyphChar;
    mesh.userData.glyphTextColor = behavior.textColor;
    mesh.userData.glyphDarkenFactor = behavior.darkenFactor;
    mesh.userData.glyphBaseColorHex = material.color.getHexString();
    mesh.userData.isUndiscovered = isUndiscovered;
    this.applyGlyphMaterial(
      key,
      mesh,
      material,
      behavior.glyphChar,
      behavior.textColor,
      behavior.isWall,
      behavior.darkenFactor
    );
    if (isUndiscovered) {
      this.stopTileRevealFade(key);
    } else if (shouldRevealFade) {
      this.startTileRevealFade(key);
    }
    this.markLightingDirty();
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
      logElement.scrollTop = 0;
    }
    if (this.hasPlayerMovedOnce) {
      this.showFloatingGameMessage(message);
    }
  }
  recordPlayerMovement(fromX, fromY, toX, toY) {
    const moved = fromX !== toX || fromY !== toY;
    if (!this.hasSeenPlayerPosition) {
      this.hasSeenPlayerPosition = true;
      return;
    }
    const hasRecentMovementInput = Date.now() - this.lastMovementInputAtMs <= this.movementUnlockWindowMs;
    if (!this.hasPlayerMovedOnce && moved && hasRecentMovementInput) {
      this.hasPlayerMovedOnce = true;
    }
  }
  showFloatingGameMessage(message) {
    if (!this.floatingMessageLayer || !document.body.contains(this.floatingMessageLayer)) {
      return;
    }
    const text = message.replace(/\s+/g, " ").trim();
    if (text.length === 0) {
      return;
    }
    const messageContainer = document.createElement("div");
    messageContainer.className = "floating-message-container";
    const floatingText = document.createElement("div");
    floatingText.textContent = text;
    floatingText.className = "floating-message-text";
    messageContainer.appendChild(floatingText);
    this.floatingMessageLayer.appendChild(messageContainer);
    const entry = {
      container: messageContainer,
      text: floatingText,
      fadeTimerId: 0,
      removeTimerId: 0
    };
    this.floatingMessageEntries.unshift(entry);
    while (this.floatingMessageEntries.length > this.maxFloatingMessages) {
      const oldest = this.floatingMessageEntries[this.floatingMessageEntries.length - 1];
      this.removeFloatingMessageEntry(oldest, false);
    }
    this.relayoutFloatingMessages();
    entry.fadeTimerId = window.setTimeout(() => {
      floatingText.style.transform = `translateY(-${this.floatingMessageRisePx}px)`;
      floatingText.style.opacity = "0";
    }, this.floatingMessageFadeDelayMs);
    entry.removeTimerId = window.setTimeout(
      () => {
        this.removeFloatingMessageEntry(entry);
      },
      this.floatingMessageFadeDelayMs + this.floatingMessageFadeDurationMs + 80
    );
  }
  relayoutFloatingMessages() {
    const offsetIndex = this.metaCommandOverlay ? 1 : 0;
    for (let i = 0; i < this.floatingMessageEntries.length; i += 1) {
      const entry = this.floatingMessageEntries[i];
      const stackIndex = i + offsetIndex;
      entry.container.style.top = `${-stackIndex * this.floatingMessageStackSpacingPx}px`;
    }
  }
  removeFloatingMessageEntry(entry, relayout = true) {
    window.clearTimeout(entry.fadeTimerId);
    window.clearTimeout(entry.removeTimerId);
    const index = this.floatingMessageEntries.indexOf(entry);
    if (index >= 0) {
      this.floatingMessageEntries.splice(index, 1);
    }
    entry.container.remove();
    if (relayout) {
      this.relayoutFloatingMessages();
    }
  }
  beginMetaCommandInput() {
    if (this.isInQuestion || this.isInDirectionQuestion) {
      return;
    }
    this.isInMetaCommandInput = true;
    this.metaCommandBuffer = "";
    this.renderMetaCommandOverlay();
  }
  endMetaCommandInput() {
    this.isInMetaCommandInput = false;
    this.metaCommandBuffer = "";
    if (this.metaCommandOverlay) {
      this.metaCommandOverlay.container.remove();
      this.metaCommandOverlay = null;
    }
    this.relayoutFloatingMessages();
  }
  renderMetaCommandOverlay() {
    if (!this.floatingMessageLayer || !document.body.contains(this.floatingMessageLayer)) {
      return;
    }
    if (!this.metaCommandOverlay) {
      const messageContainer = document.createElement("div");
      messageContainer.className = "floating-message-container floating-message-container-persistent";
      messageContainer.style.top = "0px";
      const floatingText = document.createElement("div");
      floatingText.className = "floating-message-text floating-message-text-persistent";
      messageContainer.appendChild(floatingText);
      this.floatingMessageLayer.appendChild(messageContainer);
      this.metaCommandOverlay = {
        container: messageContainer,
        text: floatingText
      };
    }
    this.metaCommandOverlay.text.textContent = `#${this.metaCommandBuffer}`;
    this.relayoutFloatingMessages();
  }
  submitMetaCommandInput() {
    this.sendInput("#");
    for (const char of this.metaCommandBuffer) {
      this.sendInput(char);
    }
    this.sendInput("Enter");
    this.endMetaCommandInput();
  }
  cancelMetaCommandInput() {
    this.endMetaCommandInput();
  }
  updateStatus(status) {
    const statusElement = document.getElementById("game-status");
    if (statusElement) {
      statusElement.innerHTML = status;
    }
  }
  updateConnectionStatus(status, color) {
    const connElement = document.getElementById("connection-status");
    if (connElement) {
      connElement.innerHTML = status;
      connElement.setAttribute("data-state", status.toLowerCase());
    }
  }
  updatePlayerStats(field, value, data) {
    const legacyByIndex = {
      0: "name",
      1: "strength",
      2: "dexterity",
      3: "constitution",
      4: "intelligence",
      5: "wisdom",
      6: "charisma",
      7: "alignment",
      8: "score",
      9: "hp",
      10: "maxhp",
      11: "power",
      12: "maxpower",
      13: "armor",
      14: "level",
      15: "experience",
      16: "time",
      17: "hunger",
      18: "encumbrance",
      19: "dungeon",
      20: "dlevel",
      21: "gold"
    };
    const byName = {
      BL_TITLE: "name",
      BL_STR: "strength",
      BL_DX: "dexterity",
      BL_CO: "constitution",
      BL_IN: "intelligence",
      BL_WI: "wisdom",
      BL_CH: "charisma",
      BL_ALIGN: "alignment",
      BL_SCORE: "score",
      BL_HP: "hp",
      BL_HPMAX: "maxhp",
      BL_ENE: "power",
      BL_ENEMAX: "maxpower",
      BL_AC: "armor",
      BL_XP: "level",
      BL_EXP: "experience",
      BL_TIME: "time",
      BL_HUNGER: "hunger",
      BL_CAP: "encumbrance",
      BL_DNUM: "dungeon",
      BL_DLEVEL: "dlevel",
      BL_GOLD: "gold"
    };
    const rawFieldName = typeof data?.fieldName === "string" ? data.fieldName : null;
    const mappedField = rawFieldName && byName[rawFieldName] || legacyByIndex[field] || null;
    this.statusDebugHistory.unshift({
      ts: Date.now(),
      field,
      fieldName: rawFieldName,
      mappedField,
      value,
      valueType: data?.valueType,
      chg: data?.chg,
      percent: data?.percent,
      color: data?.color,
      colormask: data?.colormask
    });
    if (this.statusDebugHistory.length > 200) {
      this.statusDebugHistory.pop();
    }
    if (!mappedField || value === null || value === void 0) {
      console.log(
        `Skipping status update: field=${field}, fieldName=${rawFieldName}, value=${value}`
      );
      return;
    }
    const numericFields = /* @__PURE__ */ new Set([
      "hp",
      "maxhp",
      "power",
      "maxpower",
      "level",
      "experience",
      "time",
      "armor",
      "score",
      "gold",
      "dlevel",
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma"
    ]);
    let parsedValue = value;
    if (numericFields.has(mappedField)) {
      if (typeof value === "number") {
        parsedValue = value;
      } else {
        const clean = String(value).trim();
        const match = clean.match(/^-?\d+/);
        if (!match) {
          console.log(
            `Could not parse numeric status ${mappedField} from "${value}"`
          );
          return;
        }
        parsedValue = parseInt(match[0], 10);
      }
    } else {
      parsedValue = String(value).trim();
    }
    console.log(`Updating status ${mappedField}: ${parsedValue}`);
    const previousHp = this.playerStats.hp;
    let playerDamageTaken = null;
    if (mappedField === "hp" && typeof parsedValue === "number") {
      const parsedChange = Number(data?.chg);
      if (this.hasReceivedHpStatus) {
        if (Number.isFinite(parsedChange) && parsedChange < 0) {
          playerDamageTaken = Math.round(Math.abs(parsedChange));
        } else if (parsedValue < previousHp) {
          playerDamageTaken = Math.round(previousHp - parsedValue);
        }
      }
    }
    if (mappedField === "maxhp") {
      this.playerStats.maxHp = parsedValue;
    } else if (mappedField === "maxpower") {
      this.playerStats.maxPower = parsedValue;
    } else if (mappedField === "dlevel") {
      this.playerStats.dlevel = parsedValue;
    } else {
      this.playerStats[mappedField] = parsedValue;
    }
    if (mappedField === "hp") {
      this.hasReceivedHpStatus = true;
      if (playerDamageTaken && playerDamageTaken > 0) {
        this.triggerDamageEffectsAtTile(
          this.playerPos.x,
          this.playerPos.y,
          playerDamageTaken
        );
      }
    }
    this.updateStatsDisplay();
  }
  updateStatsDisplay() {
    let statsBar = document.getElementById("stats-bar");
    if (!statsBar) {
      statsBar = document.createElement("div");
      statsBar.id = "stats-bar";
      document.body.appendChild(statsBar);
      const gameLogContainer = document.querySelector(
        ".top-left-ui"
      );
      if (gameLogContainer) {
        gameLogContainer.classList.add("with-stats");
      }
    }
    const hpPercentage = this.playerStats.maxHp > 0 ? this.playerStats.hp / this.playerStats.maxHp * 100 : 0;
    const hpColor = hpPercentage > 60 ? "#00ff00" : hpPercentage > 30 ? "#ffaa00" : "#ff0000";
    statsBar.innerHTML = `
      <div class="nh3d-stats-name">
        ${this.playerStats.name} (Lvl ${this.playerStats.level})
      </div>

      <div class="nh3d-stats-meter">
        <div class="nh3d-stats-meter-label nh3d-stats-meter-label-hp">
          HP: ${this.playerStats.hp}/${this.playerStats.maxHp}
        </div>
        <div class="nh3d-stats-meter-track">
          <div class="nh3d-stats-meter-fill" id="nh3d-stats-hp-fill"></div>
        </div>
      </div>

      ${this.playerStats.maxPower > 0 ? `<div class="nh3d-stats-meter">
               <div class="nh3d-stats-meter-label nh3d-stats-meter-label-pw">
                 Pw: ${this.playerStats.power}/${this.playerStats.maxPower}
               </div>
               <div class="nh3d-stats-meter-track">
                 <div class="nh3d-stats-meter-fill nh3d-stats-meter-fill-pw" id="nh3d-stats-pw-fill"></div>
               </div>
             </div>` : ""}

      <div class="nh3d-stats-group">
        <div class="nh3d-stats-core">St:${this.playerStats.strength}</div>
        <div class="nh3d-stats-core">Dx:${this.playerStats.dexterity}</div>
        <div class="nh3d-stats-core">Co:${this.playerStats.constitution}</div>
        <div class="nh3d-stats-core">In:${this.playerStats.intelligence}</div>
        <div class="nh3d-stats-core">Wi:${this.playerStats.wisdom}</div>
        <div class="nh3d-stats-core">Ch:${this.playerStats.charisma}</div>
      </div>

      <div class="nh3d-stats-group">
        <div class="nh3d-stats-secondary-ac">AC:${this.playerStats.armor}</div>
        <div class="nh3d-stats-secondary-gold">$:${this.playerStats.gold}</div>
        <div class="nh3d-stats-secondary-time">T:${this.playerStats.time}</div>
      </div>

      <div class="nh3d-stats-location">
        <div class="nh3d-stats-dungeon">${this.playerStats.dungeon} ${this.playerStats.dlevel}</div>
        <div class="nh3d-stats-hunger">${this.playerStats.hunger}${this.playerStats.encumbrance ? " " + this.playerStats.encumbrance : ""}</div>
      </div>
    `;
    const hpFill = statsBar.querySelector("#nh3d-stats-hp-fill");
    if (hpFill) {
      hpFill.style.width = `${THREE.MathUtils.clamp(hpPercentage, 0, 100)}%`;
      hpFill.style.backgroundColor = hpColor;
    }
    if (this.playerStats.maxPower > 0) {
      const powerPercentage = this.playerStats.power / this.playerStats.maxPower * 100;
      const pwFill = statsBar.querySelector("#nh3d-stats-pw-fill");
      if (pwFill) {
        pwFill.style.width = `${THREE.MathUtils.clamp(powerPercentage, 0, 100)}%`;
      }
    }
  }
  updateInventoryDisplay(items) {
    if (!items || items.length === 0) {
      console.log("\u{1F4E6} Inventory is empty");
      return;
    }
    console.log("\u{1F4E6} Current inventory:");
    items.forEach((item, index) => {
      if (item.isCategory) {
        console.log(`  \u{1F4C1} ${item.text}`);
      } else {
        console.log(`  ${item.accelerator || "?"}) ${item.text}`);
      }
    });
  }
  isMultiSelectLootQuestion(question) {
    if (typeof question !== "string") {
      return false;
    }
    const normalizedQuestion = question.trim().toLowerCase();
    return normalizedQuestion.includes("pick up what") || normalizedQuestion.includes("what do you want to pick up") || normalizedQuestion.includes("take out what") || normalizedQuestion.includes("put in what") || normalizedQuestion.includes("what do you want to put in") || normalizedQuestion.includes("put in, then take out what");
  }
  showQuestion(question, choices, defaultChoice, menuItems) {
    const needsExpansion = false;
    if (needsExpansion) {
      console.log(
        "\u{1F50D} Question includes '?' option, automatically expanding options..."
      );
      this.sendInput("?");
      return;
    }
    let questionDialog = document.getElementById("question-dialog");
    if (!questionDialog) {
      questionDialog = document.createElement("div");
      questionDialog.id = "question-dialog";
      questionDialog.className = "nh3d-dialog nh3d-dialog-question";
      document.body.appendChild(questionDialog);
    }
    questionDialog.innerHTML = "";
    const questionText = document.createElement("div");
    questionText.className = "nh3d-question-text";
    questionText.textContent = question;
    questionDialog.appendChild(questionText);
    if (menuItems && menuItems.length > 0) {
      const isPickupDialog = this.isMultiSelectLootQuestion(question);
      if (isPickupDialog) {
        this.createPickupDialog(questionDialog, menuItems, question);
      } else {
        this.createStandardMenu(questionDialog, menuItems);
      }
    } else {
      const choiceContainer = document.createElement("div");
      choiceContainer.className = "nh3d-choice-list";
      const parsedChoices = this.parseQuestionChoices(question, choices);
      const useCompactChoiceLayout = parsedChoices.length > 0 && parsedChoices.every((choice) => choice.trim().length === 1);
      if (useCompactChoiceLayout) {
        choiceContainer.classList.add("is-compact");
      }
      if (parsedChoices.length > 0) {
        for (const choice of parsedChoices) {
          const button = document.createElement("button");
          button.className = "nh3d-choice-button";
          if (choice === defaultChoice) {
            button.classList.add("nh3d-choice-button-default");
          }
          button.textContent = this.getQuestionChoiceLabel(choice);
          button.onclick = () => {
            this.sendInput(choice);
            this.hideQuestion();
          };
          choiceContainer.appendChild(button);
        }
      }
      questionDialog.appendChild(choiceContainer);
    }
    const escapeText = document.createElement("div");
    escapeText.className = "nh3d-dialog-hint";
    escapeText.textContent = "Press ESC to cancel";
    questionDialog.appendChild(escapeText);
    questionDialog.classList.add("is-visible");
  }
  parseQuestionChoices(question, choices) {
    const merged = [];
    const seen = /* @__PURE__ */ new Set();
    const addChoice = (choice) => {
      if (!choice || seen.has(choice)) {
        return;
      }
      seen.add(choice);
      merged.push(choice);
    };
    for (const choice of this.expandChoiceSpec(choices)) {
      addChoice(choice);
    }
    const bracketMatch = question ? question.match(/\[([^\]]+)\]/) : null;
    if (bracketMatch && bracketMatch[1]) {
      for (const choice of this.expandChoiceSpec(bracketMatch[1])) {
        addChoice(choice);
      }
    }
    return merged;
  }
  expandChoiceSpec(spec) {
    const normalized = (spec || "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+or\s+/gi, " ").replace(/[,/|]/g, " ").replace(/\s+/g, "").replace(/[\[\]]/g, "");
    if (!normalized) {
      return [];
    }
    const expanded = [];
    const seen = /* @__PURE__ */ new Set();
    const addChoice = (value) => {
      if (!value || seen.has(value)) {
        return;
      }
      seen.add(value);
      expanded.push(value);
    };
    for (let i = 0; i < normalized.length; i += 1) {
      const current = normalized[i];
      const hasRangeEnd = i + 2 < normalized.length && normalized[i + 1] === "-";
      if (hasRangeEnd) {
        const end = normalized[i + 2];
        if (this.canExpandChoiceRange(current, end)) {
          const startCode = current.charCodeAt(0);
          const endCode = end.charCodeAt(0);
          const step = startCode <= endCode ? 1 : -1;
          for (let code = startCode; step > 0 ? code <= endCode : code >= endCode; code += step) {
            addChoice(String.fromCharCode(code));
          }
          i += 2;
          continue;
        }
      }
      if (current !== "-") {
        addChoice(current);
      }
    }
    return expanded;
  }
  canExpandChoiceRange(start, end) {
    const isLower = (value) => value >= "a" && value <= "z";
    const isUpper = (value) => value >= "A" && value <= "Z";
    const isDigit = (value) => value >= "0" && value <= "9";
    return isLower(start) && isLower(end) || isUpper(start) && isUpper(end) || isDigit(start) && isDigit(end);
  }
  getQuestionChoiceLabel(choice) {
    const normalizedChoice = choice.trim();
    if (!normalizedChoice) {
      return choice;
    }
    const inventoryItem = this.currentInventory.find((item) => {
      if (!item || item.isCategory) {
        return false;
      }
      const accelerator = typeof item.accelerator === "string" ? item.accelerator.trim() : "";
      if (!accelerator) {
        return false;
      }
      return accelerator === normalizedChoice || accelerator.toLowerCase() === normalizedChoice.toLowerCase();
    });
    if (!inventoryItem || typeof inventoryItem.text !== "string") {
      return normalizedChoice;
    }
    const itemText = inventoryItem.text.trim();
    if (!itemText) {
      return normalizedChoice;
    }
    return `${normalizedChoice}) ${itemText}`;
  }
  showDirectionQuestion(question) {
    this.isInDirectionQuestion = true;
    let directionDialog = document.getElementById("direction-dialog");
    if (!directionDialog) {
      directionDialog = document.createElement("div");
      directionDialog.id = "direction-dialog";
      directionDialog.className = "nh3d-dialog nh3d-dialog-direction";
      document.body.appendChild(directionDialog);
    }
    directionDialog.innerHTML = "";
    const questionText = document.createElement("div");
    questionText.className = "nh3d-direction-text";
    questionText.textContent = question;
    directionDialog.appendChild(questionText);
    const directionsContainer = document.createElement("div");
    directionsContainer.className = "nh3d-direction-grid";
    const directions = [
      { key: "7", label: "\u2196", name: "NW" },
      { key: "8", label: "\u2191", name: "N" },
      { key: "9", label: "\u2197", name: "NE" },
      { key: "4", label: "\u2190", name: "W" },
      { key: "5", label: "\u2022", name: "Wait" },
      { key: "6", label: "\u2192", name: "E" },
      { key: "1", label: "\u2199", name: "SW" },
      { key: "2", label: "\u2193", name: "S" },
      { key: "3", label: "\u2198", name: "SE" }
    ];
    directions.forEach((dir) => {
      const button = document.createElement("button");
      button.className = "nh3d-direction-button";
      button.innerHTML = `<div class="nh3d-direction-symbol">${dir.label}</div><div class="nh3d-direction-key">${dir.key}</div>`;
      button.onclick = () => {
        this.sendInput(dir.key);
        this.hideDirectionQuestion();
      };
      directionsContainer.appendChild(button);
    });
    directionDialog.appendChild(directionsContainer);
    const escapeText = document.createElement("div");
    escapeText.className = "nh3d-dialog-hint";
    escapeText.textContent = "Use numpad (1-9), arrow keys, or click a direction. Press ESC to cancel";
    directionDialog.appendChild(escapeText);
    directionDialog.classList.add("is-visible");
  }
  hideDirectionQuestion() {
    this.isInDirectionQuestion = false;
    this.isInQuestion = false;
    const directionDialog = document.getElementById("direction-dialog");
    if (directionDialog) {
      directionDialog.classList.remove("is-visible");
    }
  }
  showInfoMenuDialog(title, lines) {
    let infoDialog = document.getElementById("info-menu-dialog");
    if (!infoDialog) {
      infoDialog = document.createElement("div");
      infoDialog.id = "info-menu-dialog";
      infoDialog.className = "nh3d-dialog nh3d-dialog-info";
      document.body.appendChild(infoDialog);
    }
    infoDialog.innerHTML = "";
    const titleEl = document.createElement("div");
    titleEl.className = "nh3d-info-title";
    titleEl.textContent = title || "NetHack Information";
    infoDialog.appendChild(titleEl);
    const body = document.createElement("div");
    body.className = "nh3d-info-body";
    body.textContent = lines && lines.length > 0 ? lines.join("\n") : "(No details)";
    infoDialog.appendChild(body);
    const hint = document.createElement("div");
    hint.className = "nh3d-info-hint";
    hint.textContent = "Press ESC to close. Press Ctrl+M to reopen.";
    infoDialog.appendChild(hint);
    infoDialog.classList.add("is-visible");
  }
  hideInfoMenuDialog() {
    const infoDialog = document.getElementById("info-menu-dialog");
    if (infoDialog) {
      infoDialog.classList.remove("is-visible");
    }
  }
  toggleInfoMenuDialog() {
    const infoDialog = document.getElementById("info-menu-dialog");
    if (infoDialog && infoDialog.classList.contains("is-visible")) {
      this.hideInfoMenuDialog();
      return;
    }
    if (this.lastInfoMenu) {
      this.showInfoMenuDialog(this.lastInfoMenu.title, this.lastInfoMenu.lines);
    } else {
      this.addGameMessage("No recent information panel to reopen.");
    }
  }
  showInventoryDialog() {
    let inventoryDialog = document.getElementById("inventory-dialog");
    if (!inventoryDialog) {
      inventoryDialog = document.createElement("div");
      inventoryDialog.id = "inventory-dialog";
      inventoryDialog.className = "nh3d-dialog nh3d-dialog-inventory";
      document.body.appendChild(inventoryDialog);
    }
    inventoryDialog.innerHTML = "";
    const title = document.createElement("div");
    title.className = "nh3d-inventory-title";
    title.textContent = "\u{1F4E6} INVENTORY";
    inventoryDialog.appendChild(title);
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "nh3d-inventory-items";
    if (this.currentInventory.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "nh3d-inventory-empty";
      emptyMessage.textContent = "Your inventory is empty.";
      itemsContainer.appendChild(emptyMessage);
    } else {
      this.currentInventory.forEach((item, index) => {
        if (item.isCategory) {
          const categoryHeader = document.createElement("div");
          categoryHeader.className = "nh3d-inventory-category";
          if (index === 0) {
            categoryHeader.classList.add("nh3d-inventory-category-first");
          }
          categoryHeader.textContent = item.text;
          itemsContainer.appendChild(categoryHeader);
        } else {
          const itemDiv = document.createElement("div");
          itemDiv.className = "nh3d-inventory-item";
          const keySpan = document.createElement("span");
          keySpan.className = "nh3d-inventory-key";
          keySpan.textContent = `${item.accelerator || "?"})`;
          const textSpan = document.createElement("span");
          textSpan.className = "nh3d-inventory-text";
          textSpan.textContent = item.text || "Unknown item";
          itemDiv.appendChild(keySpan);
          itemDiv.appendChild(textSpan);
          itemsContainer.appendChild(itemDiv);
        }
      });
    }
    inventoryDialog.appendChild(itemsContainer);
    const keybindsTitle = document.createElement("div");
    keybindsTitle.className = "nh3d-inventory-keybinds-title";
    keybindsTitle.textContent = "\u{1F3AE} ITEM COMMANDS";
    inventoryDialog.appendChild(keybindsTitle);
    const keybindsContainer = document.createElement("div");
    keybindsContainer.className = "nh3d-inventory-keybinds";
    const commandText = `<span class="nh3d-inventory-command-key">a</span>)pply <span class="nh3d-inventory-command-key">d</span>)rop <span class="nh3d-inventory-command-key">e</span>)at <span class="nh3d-inventory-command-key">q</span>)uaff <span class="nh3d-inventory-command-key">r</span>)ead <span class="nh3d-inventory-command-key">t</span>)hrow <span class="nh3d-inventory-command-key">w</span>)ield <span class="nh3d-inventory-command-key">W</span>)ear <span class="nh3d-inventory-command-key">T</span>)ake-off <span class="nh3d-inventory-command-key">P</span>)ut-on <span class="nh3d-inventory-command-key">R</span>)emove <span class="nh3d-inventory-command-key">z</span>)ap <span class="nh3d-inventory-command-key">Z</span>)cast
    Special: <span class="nh3d-inventory-command-key">"</span>)weapons <span class="nh3d-inventory-command-key">[</span>)armor <span class="nh3d-inventory-command-key">=</span>)rings <span class="nh3d-inventory-command-key">"</span>)amulets <span class="nh3d-inventory-command-key">(</span>)tools`;
    keybindsContainer.innerHTML = `<div class="nh3d-inventory-keybinds-text">${commandText}</div>`;
    inventoryDialog.appendChild(keybindsContainer);
    const closeText = document.createElement("div");
    closeText.className = "nh3d-inventory-close";
    closeText.textContent = "Press ESC or 'i' to close";
    inventoryDialog.appendChild(closeText);
    inventoryDialog.classList.add("is-visible");
  }
  hideInventoryDialog() {
    const inventoryDialog = document.getElementById("inventory-dialog");
    if (inventoryDialog) {
      inventoryDialog.classList.remove("is-visible");
    }
    this.pendingInventoryDialog = false;
  }
  showPositionRequest(text) {
    let posDialog = document.getElementById("position-dialog");
    if (!posDialog) {
      posDialog = document.createElement("div");
      posDialog.id = "position-dialog";
      document.body.appendChild(posDialog);
    }
    posDialog.textContent = text;
    posDialog.classList.add("is-visible");
    setTimeout(() => {
      if (posDialog) {
        posDialog.classList.remove("is-visible");
      }
    }, 3e3);
  }
  showNameRequest(text, maxLength) {
    let nameDialog = document.getElementById("name-dialog");
    if (!nameDialog) {
      nameDialog = document.createElement("div");
      nameDialog.id = "name-dialog";
      nameDialog.className = "nh3d-dialog nh3d-dialog-name";
      document.body.appendChild(nameDialog);
    }
    nameDialog.innerHTML = "";
    const questionText = document.createElement("div");
    questionText.className = "nh3d-name-question";
    questionText.textContent = text;
    nameDialog.appendChild(questionText);
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.maxLength = maxLength;
    nameInput.placeholder = "Enter your name";
    nameInput.className = "nh3d-name-input";
    nameDialog.appendChild(nameInput);
    const submitButton = document.createElement("button");
    submitButton.textContent = "OK";
    submitButton.className = "nh3d-name-submit";
    const submitName = () => {
      const name = nameInput.value.trim() || "Adventurer";
      this.sendInput(name);
      nameDialog.classList.remove("is-visible");
    };
    submitButton.onclick = submitName;
    nameInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        submitName();
      }
    };
    nameDialog.appendChild(submitButton);
    nameDialog.classList.add("is-visible");
    nameInput.focus();
  }
  hideQuestion() {
    this.isInQuestion = false;
    const questionDialog = document.getElementById("question-dialog");
    if (questionDialog) {
      questionDialog.classList.remove("is-visible");
      questionDialog.innerHTML = "";
      questionDialog.isPickupDialog = false;
      questionDialog.menuItems = null;
    }
  }
  createPickupDialog(questionDialog, menuItems, question) {
    const selectedItems = /* @__PURE__ */ new Set();
    menuItems.forEach((item) => {
      if (item.isCategory || !item.accelerator || item.accelerator.trim() === "") {
        const categoryHeader = document.createElement("div");
        categoryHeader.className = "nh3d-menu-category";
        categoryHeader.textContent = item.text;
        questionDialog.appendChild(categoryHeader);
      } else {
        const itemContainer = document.createElement("div");
        itemContainer.className = "nh3d-pickup-item";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `pickup-${item.accelerator}`;
        checkbox.className = "nh3d-pickup-checkbox";
        const keyPart = document.createElement("span");
        keyPart.className = "nh3d-pickup-key";
        keyPart.textContent = `${item.accelerator})`;
        const textPart = document.createElement("span");
        textPart.className = "nh3d-pickup-text";
        textPart.textContent = item.text;
        const applySelectionState = (isSelected, shouldSendInput) => {
          checkbox.checked = isSelected;
          if (isSelected) {
            selectedItems.add(item.accelerator);
            itemContainer.classList.add("nh3d-pickup-item-selected");
          } else {
            selectedItems.delete(item.accelerator);
            itemContainer.classList.remove("nh3d-pickup-item-selected");
          }
          if (shouldSendInput) {
            this.sendInput(item.accelerator);
          }
        };
        const toggleItem = () => {
          applySelectionState(!checkbox.checked, true);
        };
        itemContainer.onclick = (e) => {
          e.preventDefault();
          toggleItem();
        };
        checkbox.onclick = (e) => {
          e.stopPropagation();
        };
        checkbox.onchange = (e) => {
          e.stopPropagation();
          applySelectionState(checkbox.checked, true);
        };
        itemContainer.toggleItem = toggleItem;
        itemContainer.accelerator = item.accelerator;
        itemContainer.appendChild(checkbox);
        itemContainer.appendChild(keyPart);
        itemContainer.appendChild(textPart);
        questionDialog.appendChild(itemContainer);
      }
    });
    const confirmInstruction = document.createElement("div");
    confirmInstruction.className = "nh3d-pickup-confirm";
    confirmInstruction.textContent = "Press ENTER to confirm selection, or ESC to cancel";
    questionDialog.appendChild(confirmInstruction);
    questionDialog.isPickupDialog = true;
    questionDialog.menuItems = menuItems;
  }
  createStandardMenu(questionDialog, menuItems) {
    menuItems.forEach((item) => {
      if (item.isCategory || !item.accelerator || item.accelerator.trim() === "") {
        const categoryHeader = document.createElement("div");
        categoryHeader.className = "nh3d-menu-category";
        categoryHeader.textContent = item.text;
        questionDialog.appendChild(categoryHeader);
      } else {
        const menuButton = document.createElement("button");
        menuButton.className = "nh3d-menu-button";
        const keyPart = document.createElement("span");
        keyPart.className = "nh3d-menu-button-key";
        keyPart.textContent = `${item.accelerator}) `;
        const textPart = document.createElement("span");
        textPart.textContent = item.text;
        menuButton.appendChild(keyPart);
        menuButton.appendChild(textPart);
        menuButton.onclick = () => {
          this.sendInput(item.accelerator);
          this.hideQuestion();
        };
        questionDialog.appendChild(menuButton);
      }
    });
  }
  sendInput(input) {
    if (!this.hasPlayerMovedOnce && !this.isInQuestion && !this.isInDirectionQuestion && this.isMovementInput(input)) {
      this.lastMovementInputAtMs = Date.now();
    }
    if (this.session) {
      this.session.sendInput(input);
    }
  }
  isMovementInput(input) {
    if (input.length === 1) {
      switch (input) {
        case "h":
        case "j":
        case "k":
        case "l":
        case "y":
        case "u":
        case "b":
        case "n":
        case "H":
        case "J":
        case "K":
        case "L":
        case "Y":
        case "U":
        case "B":
        case "N":
        case "1":
        case "2":
        case "3":
        case "4":
        case "6":
        case "7":
        case "8":
        case "9":
          return true;
        default:
          return false;
      }
    }
    switch (input) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
      case "Home":
      case "End":
      case "PageUp":
      case "PageDown":
        return true;
      default:
        return false;
    }
  }
  getModifiedInput(event) {
    const hasMetaModifier = event.altKey || event.metaKey || this.altOrMetaHeld;
    if (!hasMetaModifier) {
      return null;
    }
    if (event.key === "Alt" || event.key === "Meta" || event.key === "Control" || event.key === "Shift") {
      return null;
    }
    const normalizedKey = this.getMetaPrimaryKey(event);
    if (!normalizedKey) {
      return null;
    }
    return `${this.metaInputPrefix}${normalizedKey}`;
  }
  getMetaPrimaryKey(event) {
    if (event.code.startsWith("Key") && event.code.length === 4) {
      return event.code.slice(3).toLowerCase();
    }
    if (event.code.startsWith("Digit") && event.code.length === 6) {
      return event.code.slice(5);
    }
    if (event.key.length === 1) {
      return event.key.toLowerCase();
    }
    return null;
  }
  handleKeyUp(event) {
    if (event.key === "Alt" || event.key === "Meta") {
      this.altOrMetaHeld = false;
    }
  }
  handleWindowBlur() {
    this.altOrMetaHeld = false;
  }
  normalizeWaitKey(event) {
    if (event.key === ">") {
      return null;
    }
    if (event.key === "." || event.key === " " || event.key === "Spacebar" || event.key === "Space" || event.key === "Decimal" || event.key === "NumpadDecimal" || event.code === "NumpadDecimal" || event.code === "Space") {
      return ".";
    }
    return null;
  }
  handleKeyDown(event) {
    if (event.key === "Alt" || event.key === "Meta") {
      this.altOrMetaHeld = true;
      event.preventDefault();
      return;
    }
    if (!this.isInMetaCommandInput && event.key === "#" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      this.beginMetaCommandInput();
      return;
    }
    if (this.isInMetaCommandInput) {
      if (event.key === "Escape") {
        event.preventDefault();
        this.cancelMetaCommandInput();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        this.submitMetaCommandInput();
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        if (this.metaCommandBuffer.length > 0) {
          this.metaCommandBuffer = this.metaCommandBuffer.slice(0, -1);
          this.renderMetaCommandOverlay();
        }
        return;
      }
      if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        this.metaCommandBuffer += event.key.toLowerCase();
        this.renderMetaCommandOverlay();
        return;
      }
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      const inventoryDialog = document.getElementById("inventory-dialog");
      if (inventoryDialog && inventoryDialog.classList.contains("is-visible")) {
        this.hideInventoryDialog();
        return;
      }
      const infoDialog = document.getElementById("info-menu-dialog");
      if (infoDialog && infoDialog.classList.contains("is-visible")) {
        this.hideInfoMenuDialog();
        return;
      }
      if (this.isInQuestion || this.isInDirectionQuestion) {
        console.log("\u{1F504} Sending Escape to NetHack to cancel question");
        this.sendInput("Escape");
      }
      this.hideQuestion();
      this.hideDirectionQuestion();
      const posDialog = document.getElementById("position-dialog");
      if (posDialog) {
        posDialog.classList.remove("is-visible");
      }
      this.isInQuestion = false;
      this.isInDirectionQuestion = false;
      return;
    }
    const modifiedInput = this.getModifiedInput(event);
    if (modifiedInput) {
      event.preventDefault();
      this.sendInput(modifiedInput);
      return;
    }
    if (event.ctrlKey) {
      switch (event.key.toLowerCase()) {
        case "r":
          if (event.shiftKey) {
            event.preventDefault();
            console.log("\u{1F504} Manual refresh requested for large player area");
            this.requestPlayerAreaUpdate(10);
            this.addGameMessage("Refreshing large area around player...");
            return;
          } else {
            event.preventDefault();
            console.log("\u{1F504} Manual refresh requested for player area");
            this.requestPlayerAreaUpdate(5);
            this.addGameMessage("Refreshing area around player...");
            return;
          }
        case "t":
          event.preventDefault();
          console.log("\u{1F504} Manual refresh requested for player tile");
          this.requestTileUpdate(this.playerPos.x, this.playerPos.y);
          this.addGameMessage(
            `Refreshing tile at (${this.playerPos.x}, ${this.playerPos.y})...`
          );
          return;
        case "m":
          event.preventDefault();
          this.toggleInfoMenuDialog();
          return;
      }
    }
    if ((event.key === "i" || event.key === "I") && !this.isInQuestion && !this.isInDirectionQuestion) {
      event.preventDefault();
      this.hideInfoMenuDialog();
      const inventoryDialog = document.getElementById("inventory-dialog");
      if (inventoryDialog && inventoryDialog.classList.contains("is-visible")) {
        console.log("\u{1F4E6} Closing inventory dialog");
        this.hideInventoryDialog();
      } else {
        if (this.currentInventory && this.currentInventory.length > 0) {
          console.log("\u{1F4E6} Showing inventory dialog with existing data");
          this.showInventoryDialog();
        } else {
          console.log("\u{1F4E6} Requesting current inventory from NetHack...");
          this.sendInput("i");
          this.pendingInventoryDialog = true;
        }
      }
      return;
    }
    const modifierKeys = [
      "Shift",
      "Control",
      "Alt",
      "Meta",
      "CapsLock",
      "NumLock",
      "ScrollLock",
      "Tab",
      "Insert",
      "Delete",
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12"
    ];
    if (modifierKeys.indexOf(event.key) !== -1) {
      console.log(`\u{1F6AB} Filtering out modifier key: ${event.key}`);
      return;
    }
    const normalizedWaitKey = this.normalizeWaitKey(event);
    if (normalizedWaitKey) {
      event.preventDefault();
      if (this.isInDirectionQuestion) {
        this.sendInput(normalizedWaitKey);
        this.hideDirectionQuestion();
      } else {
        this.sendInput(normalizedWaitKey);
      }
      return;
    }
    if (!this.isInQuestion && !this.isInDirectionQuestion) {
      let mappedKey = null;
      switch (event.key) {
        case "Home":
          mappedKey = "7";
          console.log("\u{1F504} Mapping Home to numpad 7 (Northwest)");
          break;
        case "PageUp":
          mappedKey = "9";
          console.log("\u{1F504} Mapping PageUp to numpad 9 (Northeast)");
          break;
        case "End":
          mappedKey = "1";
          console.log("\u{1F504} Mapping End to numpad 1 (Southwest)");
          break;
        case "PageDown":
          mappedKey = "3";
          console.log("\u{1F504} Mapping PageDown to numpad 3 (Southeast)");
          break;
      }
      if (mappedKey) {
        this.sendInput(mappedKey);
        return;
      }
    }
    if (this.isInQuestion || this.isInDirectionQuestion) {
      if (this.isInDirectionQuestion) {
        let keyToSend = null;
        switch (event.key) {
          // Arrow keys - map to numpad equivalents
          case "ArrowUp":
            keyToSend = "8";
            break;
          case "ArrowDown":
            keyToSend = "2";
            break;
          case "ArrowLeft":
            keyToSend = "4";
            break;
          case "ArrowRight":
            keyToSend = "6";
            break;
          // Diagonal movement with Home/End/PageUp/PageDown
          case "Home":
            keyToSend = "7";
            break;
          case "PageUp":
            keyToSend = "9";
            break;
          case "End":
            keyToSend = "1";
            break;
          case "PageDown":
            keyToSend = "3";
            break;
          // Numpad keys - pass through directly (includes diagonals)
          case "1":
          // Southwest
          case "2":
          // South
          case "3":
          // Southeast
          case "4":
          // West
          case "5":
          // Wait/rest
          case "6":
          // East
          case "7":
          // Northwest
          case "8":
          // North
          case "9":
            keyToSend = event.key;
            break;
          // Vertical directions and self-direction for target prompts
          case "<":
          case ",":
            keyToSend = "<";
            break;
          case ">":
            keyToSend = ">";
            break;
          case "s":
          case "S":
            keyToSend = "s";
            break;
          // Space or period for self/wait direction
          case " ":
          case "Spacebar":
          case "Space":
          case ".":
          case "Decimal":
          case "NumpadDecimal":
            keyToSend = ".";
            break;
        }
        if (keyToSend) {
          this.sendInput(keyToSend);
          this.hideDirectionQuestion();
        }
        return;
      }
      const questionDialog = document.getElementById("question-dialog");
      if (questionDialog && questionDialog.isPickupDialog) {
        if (event.key === "Enter") {
          this.sendInput("Enter");
          this.hideQuestion();
        } else if (event.key === "Escape") {
          this.sendInput("Escape");
          this.hideQuestion();
        } else {
          const menuItems = questionDialog.menuItems || [];
          const matchingItem = menuItems.find(
            (item) => item.accelerator === event.key && !item.isCategory
          );
          if (matchingItem) {
            const containers = questionDialog.querySelectorAll(".nh3d-pickup-item");
            containers.forEach((container) => {
              if (container.accelerator === event.key && container.toggleItem) {
                container.toggleItem();
              }
            });
          } else {
            this.sendInput(event.key);
          }
        }
      } else {
        this.sendInput(event.key);
        this.hideQuestion();
      }
      return;
    }
    this.sendInput(event.key);
  }
  updateCamera(deltaSeconds) {
    const { x, y } = this.playerPos;
    const targetX = x * TILE_SIZE + this.cameraPanX;
    const targetY = -y * TILE_SIZE + this.cameraPanY;
    this.cameraFollowTarget.set(targetX, targetY, 0);
    if (!this.cameraFollowInitialized) {
      this.cameraFollowCurrent.copy(this.cameraFollowTarget);
      this.cameraFollowInitialized = true;
    } else {
      const alpha = 1 - Math.exp(
        -Math.LN2 * deltaSeconds * 1e3 / this.cameraFollowHalfLifeMs
      );
      this.cameraFollowCurrent.lerp(this.cameraFollowTarget, alpha);
    }
    const followX = this.cameraFollowCurrent.x;
    const followY = this.cameraFollowCurrent.y;
    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);
    const offsetX = this.cameraDistance * cosPitch * sinYaw;
    const offsetY = this.cameraDistance * cosPitch * cosYaw;
    const offsetZ = this.cameraDistance * sinPitch;
    this.camera.position.x = followX + offsetX;
    this.camera.position.y = followY + offsetY;
    this.camera.position.z = offsetZ;
    this.camera.lookAt(followX, followY, 0);
  }
  wrapAngle(angle) {
    const twoPi = Math.PI * 2;
    angle = (angle % twoPi + twoPi) % twoPi;
    return angle > Math.PI ? angle - twoPi : angle;
  }
  handleMouseWheel(event) {
    const gameLog = document.getElementById("game-log");
    if (gameLog) {
      const rect = gameLog.getBoundingClientRect();
      const mouseX = event.clientX;
      const mouseY = event.clientY;
      if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
        return;
      }
    }
    event.preventDefault();
    const zoomSpeed = 1;
    const delta = event.deltaY > 0 ? zoomSpeed : -zoomSpeed;
    this.cameraDistance = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this.cameraDistance + delta)
    );
  }
  handleMouseDown(event) {
    if (event.button === 1) {
      event.preventDefault();
      this.isMiddleMouseDown = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (event.button === 2) {
      event.preventDefault();
      this.isRightMouseDown = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }
  handleMouseMove(event) {
    if (this.isMiddleMouseDown) {
      event.preventDefault();
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;
      this.cameraYaw = this.wrapAngle(
        this.cameraYaw - deltaX * this.rotationSpeed
      );
      this.cameraPitch = THREE.MathUtils.clamp(
        this.cameraPitch - deltaY * this.rotationSpeed,
        this.minCameraPitch,
        this.maxCameraPitch
      );
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (this.isRightMouseDown) {
      event.preventDefault();
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;
      const panSpeed = 0.05;
      this.cameraPanX += deltaX * panSpeed;
      this.cameraPanY -= deltaY * panSpeed;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }
  handleMouseUp(event) {
    if (event.button === 1) {
      this.isMiddleMouseDown = false;
    } else if (event.button === 2) {
      this.isRightMouseDown = false;
    }
  }
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  getMeshOverlayMaterial(mesh) {
    const material = mesh.material;
    if (Array.isArray(material)) {
      const top = material[4];
      return top instanceof THREE.MeshBasicMaterial ? top : null;
    }
    return material instanceof THREE.MeshBasicMaterial ? material : null;
  }
  updateEffectAnimations(timeMs) {
    const phaseBase = timeMs / 240;
    this.tileMap.forEach((mesh) => {
      const effectKind = mesh.userData.effectKind;
      const overlayMaterial = this.getMeshOverlayMaterial(mesh);
      if (!overlayMaterial) {
        return;
      }
      if (!effectKind) {
        overlayMaterial.color.set("#ffffff");
        return;
      }
      const wave = 0.72 + 0.28 * Math.sin(phaseBase + mesh.position.x * 0.2 + mesh.position.y * 0.2);
      const pulse = this.effectColors[effectKind].clone().multiplyScalar(THREE.MathUtils.clamp(wave, 0.4, 1.2));
      overlayMaterial.color.copy(pulse);
    });
  }
  animate(timeMs = performance.now()) {
    requestAnimationFrame(this.animate.bind(this));
    const rawDeltaMs = this.lastFrameTimeMs === null ? 1e3 / 60 : timeMs - this.lastFrameTimeMs;
    this.lastFrameTimeMs = timeMs;
    const deltaSeconds = Math.max(0, Math.min(rawDeltaMs, 250)) / 1e3;
    this.updateCamera(deltaSeconds);
    this.updateLightingOverlay();
    this.updateTileRevealFades(deltaSeconds);
    this.updateEffectAnimations(timeMs);
    this.updateDamageEffects(deltaSeconds);
    this.renderer.render(this.scene, this.camera);
  }
};
var Nethack3DEngine_default = Nethack3DEngine;

// src/app.ts
var game = new Nethack3DEngine_default();
window.nethackGame = game;
window.refreshTile = (x, y) => {
  game.requestTileUpdate(x, y);
};
window.refreshArea = (centerX, centerY, radius = 3) => {
  game.requestAreaUpdate(centerX, centerY, radius);
};
window.refreshPlayerArea = (radius = 5) => {
  game.requestPlayerAreaUpdate(radius);
};
window.dumpStatusDebug = () => {
  return game.statusDebugHistory;
};
window.toggleInfoMenu = () => {
  game.toggleInfoMenuDialog();
};
window.setGlyphOverride = (glyph, override) => {
  setGlyphOverride(glyph, override);
};
window.clearGlyphOverride = (glyph) => {
  clearGlyphOverride(glyph);
};
window.setGlyphKindOverride = (kind, override) => {
  setGlyphKindOverride(kind, override);
};
window.clearGlyphKindOverride = (kind) => {
  clearGlyphKindOverride(kind);
};
window.clearGlyphOverrides = () => {
  clearAllGlyphOverrides();
};
window.dumpGlyphOverrides = () => {
  return getAllGlyphOverrides();
};
console.log("NetHack 3D debugging helpers available:");
console.log("  refreshTile(x, y) - Refresh a specific tile");
console.log("  refreshArea(x, y, radius) - Refresh an area");
console.log("  refreshPlayerArea(radius) - Refresh around player");
console.log("  dumpStatusDebug() - Get recent status_update payloads");
console.log("  setGlyphOverride(glyph, override) - Manual glyph-level render override");
console.log("  setGlyphKindOverride(kind, override) - Manual kind-level render override");
console.log("  clearGlyphOverride(glyph), clearGlyphKindOverride(kind), clearGlyphOverrides()");
console.log("  dumpGlyphOverrides() - Inspect active glyph overrides");
console.log("  Ctrl+T - Refresh player tile");
console.log("  Ctrl+R - Refresh player area (radius 5)");
console.log("  Ctrl+Shift+R - Refresh large player area (radius 10)");
console.log("Movement controls:");
console.log("  Arrow keys - Cardinal directions (N/S/E/W)");
console.log("  Numpad 1-9 - All directions including diagonals");
console.log("  Home/PgUp/End/PgDn - Diagonal movement (NW/NE/SW/SE)");
console.log("  Numpad 5 or Space - Wait/rest");
console.log("Interface controls:");
console.log("  'i' - Open/close inventory dialog");
console.log("  ESC - Close dialogs or cancel actions");
console.log("  Ctrl+M - Toggle latest information panel");
var app_default = game;
export {
  app_default as default
};
