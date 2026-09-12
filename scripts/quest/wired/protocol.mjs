import { timingSafeEqual } from "node:crypto";

export const PANEL_WIDTH = 1600;
export const PANEL_HEIGHT = 1000;
export const PANEL_FRAME_RATE = 20;
export const WIRED_ORIGIN = "http://127.0.0.1:5175";
export const MAX_BODY_BYTES = 4096;
export const SOURCE_PAGES = Object.freeze({
  probe: "/quest-ui-probe.html",
  game: "/index.html",
});

const keyCodes = Object.freeze({
  Enter: 13,
  Escape: 27,
  Backspace: 8,
  Tab: 9,
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
});


function printableKeyDescriptor(key) {
  if (/^[a-z]$/i.test(key)) return { code: 'Key' + key.toUpperCase(), virtualKey: key.toUpperCase().charCodeAt(0), plain: key.toLowerCase() };
  if (key === " ") return { code: "Space", virtualKey: 32, plain: " " };
  const physicalKeys = [
    ["Digit1", 49, "1!"], ["Digit2", 50, "2@"], ["Digit3", 51, "3#"],
    ["Digit4", 52, "4$"], ["Digit5", 53, "5%"], ["Digit6", 54, "6^"],
    ["Digit7", 55, "7&"], ["Digit8", 56, "8*"], ["Digit9", 57, "9("], ["Digit0", 48, "0)"],
    ["Semicolon", 186, ";:"], ["Equal", 187, "=+"], ["Comma", 188, ",<"],
    ["Minus", 189, "-_"], ["Period", 190, ".>"], ["Slash", 191, "/?"],
    ["Backquote", 192, String.fromCharCode(96, 126)], ["BracketLeft", 219, "[{"],
    ["Backslash", 220, String.fromCharCode(92, 124)], ["BracketRight", 221, "]}"],
    ["Quote", 222, String.fromCharCode(39, 34)],
  ];
  const [code, virtualKey, characters] = physicalKeys.find(([, , characters]) => characters.includes(key));
  return { code, virtualKey, plain: characters[0] };
}

function fail(message) {
  throw new TypeError(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnly(value, keys) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function coordinate(value, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1_000_000) {
    fail("Pointer coordinates must be finite numbers.");
  }
  // External coordinates stay inside the source; cancellation uses /release.
  return Math.max(0, Math.min(maximum - 1, value));
}

export function validateInput(value) {
  if (!isObject(value)) fail("Input must be an object.");
  if (["move", "down", "up", "wheel"].includes(value.type)) {
    const keys = value.type === "wheel" ? ["type", "x", "y", "deltaY"] : ["type", "x", "y"];
    if (!hasOnly(value, keys)) fail("Unexpected pointer input property.");
    const x = coordinate(value.x, PANEL_WIDTH);
    const y = coordinate(value.y, PANEL_HEIGHT);
    if (value.type === "wheel") {
      if (typeof value.deltaY !== "number" || !Number.isFinite(value.deltaY) || Math.abs(value.deltaY) > 1000) {
        fail("Wheel delta must be a finite number from -1000 to 1000.");
      }
      return { type: "wheel", x, y, deltaY: value.deltaY };
    }
    return { type: value.type, x, y };
  }
  if (value.type === "key") {
    if (!hasOnly(value, ["type", "key", "shift"]) ||
        typeof value.key !== "string" ||
        (!Object.hasOwn(keyCodes, value.key) && !/^[\x20-\x7e]$/.test(value.key)) ||
        (value.shift !== undefined && typeof value.shift !== "boolean")) {
      fail("Unsupported key.");
    }
    return { type: "key", key: value.key, shift: value.shift ?? false };
  }
  if (value.type === "text") {
    if (!hasOnly(value, ["type", "text"]) || typeof value.text !== "string" || value.text.length < 1 || value.text.length > 512 || value.text.includes("\0")) {
      fail("Text must contain 1 to 512 characters without NUL bytes.");
    }
    return { type: "text", text: value.text };
  }
  fail("Unsupported input type.");
}

export function validateNavigation(value) {
  if (!isObject(value) || !hasOnly(value, ["page"]) || !Object.hasOwn(SOURCE_PAGES, value.page)) {
    fail("Page must be probe or game.");
  }
  return value.page;
}

export function isLocalRequest(headers) {
  return headers.host === new URL(WIRED_ORIGIN).host &&
    (headers.origin === undefined || headers.origin === WIRED_ORIGIN);
}

export function isAuthorized(headers, token) {
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(typeof headers.authorization === "string" ? headers.authorization : "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isSourceNavigation(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname === "/" ? SOURCE_PAGES.game : parsed.pathname;
    return parsed.origin === WIRED_ORIGIN && Object.values(SOURCE_PAGES).includes(pathname);
  } catch {
    return false;
  }
}

export async function readJson(request) {
  if (request.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    fail("Use Content-Type: application/json.");
  }
  const length = request.headers["content-length"];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    fail("Request body is too large.");
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY_BYTES) fail("Request body is too large.");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    fail("Request body must contain valid JSON.");
  }
}

// The only debugger commands exposed by the host are these bounded UI actions.
// Calls must be serialized by the host so a release cannot race a pending press.
export function createInputController(sendCommand) {
  let pressed = false;
  let pointer = { x: PANEL_WIDTH / 2, y: PANEL_HEIGHT / 2 };

  async function finishPointer(cancel) {
    if (!pressed) return;
    pressed = false;
    if (cancel) pointer = { x: -1, y: -1 };
    try {
      if (cancel) await sendCommand("Input.dispatchMouseEvent", {
        type: "mouseMoved", ...pointer, button: "left", buttons: 1,
      });
    } finally {
      await sendCommand("Input.dispatchMouseEvent", {
        type: "mouseReleased", ...pointer, button: "left", buttons: 0, clickCount: 1,
      });
    }
  }

  async function release() {
    await finishPointer(true);
  }

  async function dispatch(rawInput) {
    const input = validateInput(rawInput);
    if (input.type === "text") {
      await sendCommand("Input.insertText", { text: input.text });
      return;
    }
    if (input.type === "key") {
      const printable = input.key.length === 1;
      const descriptor = printable ? printableKeyDescriptor(input.key) :
        { code: input.key, virtualKey: keyCodes[input.key] };
      const key = {
        key: input.key,
        code: descriptor.code,
        windowsVirtualKeyCode: descriptor.virtualKey,
        modifiers: input.shift ? 8 : 0,
      };
      try {
        await sendCommand("Input.dispatchKeyEvent", {
          type: "keyDown", ...key, ...(printable ? { text: input.key, unmodifiedText: descriptor.plain } : {}),
        });
      } finally {
        await sendCommand("Input.dispatchKeyEvent", { type: "keyUp", ...key });
      }
      return;
    }
    pointer = { x: input.x, y: input.y };
    if (input.type === "up") {
      await finishPointer(false);
      return;
    }
    if (input.type === "down") {
      if (pressed) return;
      pressed = true;
      await sendCommand("Input.dispatchMouseEvent", {
        type: "mousePressed", ...pointer, button: "left", buttons: 1, clickCount: 1,
      });
      return;
    }
    await sendCommand("Input.dispatchMouseEvent", {
      type: input.type === "wheel" ? "mouseWheel" : "mouseMoved",
      ...pointer,
      button: pressed ? "left" : "none",
      buttons: pressed ? 1 : 0,
      ...(input.type === "wheel" ? { deltaX: 0, deltaY: input.deltaY } : {}),
    });
  }

  return { dispatch, release };
}
