import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import {
  PANEL_WIDTH, PANEL_HEIGHT, MAX_BODY_BYTES, WIRED_ORIGIN,
  createInputController, isAuthorized, isLocalRequest, isSourceNavigation,
  readJson, validateInput, validateNavigation,
} from "./protocol.mjs";

function capture() {
  const commands = [];
  const input = createInputController(async (method, params) => commands.push({ method, params }));
  return { commands, input };
}

function request(body, headers = {}) {
  const stream = Readable.from([body]);
  stream.headers = { "content-type": "application/json", ...headers };
  return stream;
}

test("only the exact loopback Host and local Origin are allowed", () => {
  assert.equal(isLocalRequest({ host: "127.0.0.1:5175" }), true);
  assert.equal(isLocalRequest({ host: "127.0.0.1:5175", origin: WIRED_ORIGIN }), true);
  for (const headers of [
    { host: "localhost:5175" }, { host: "example.org" },
    { host: "127.0.0.1:5175", origin: "https://example.org" },
    { host: "127.0.0.1:5175", origin: "null" },
  ]) assert.equal(isLocalRequest(headers), false);
});

test("capability token must match exactly", () => {
  assert.equal(isAuthorized({ authorization: "Bearer secret" }, "secret"), true);
  for (const authorization of [undefined, "secret", "Bearer other", "Bearer secret ", ["Bearer secret"]]) {
    assert.equal(isAuthorized({ authorization }, "secret"), false);
  }
});

test("source navigation is limited to the two local entry points", () => {
  assert.equal(isSourceNavigation(`${WIRED_ORIGIN}/index.html?x=1#menu`), true);
  assert.equal(isSourceNavigation(`${WIRED_ORIGIN}/quest-ui-probe.html`), true);
  assert.equal(isSourceNavigation(`${WIRED_ORIGIN}/`), true);
  for (const url of ["https://example.org", "file:///x", "javascript:alert(1)", `${WIRED_ORIGIN}/quest-wired.html`, `${WIRED_ORIGIN}/__wired/input`, "broken"]) {
    assert.equal(isSourceNavigation(url), false);
  }
  assert.equal(validateNavigation({ page: "game" }), "game");
  for (const value of [null, [], { page: "constructor" }, { page: "https://example.org" }, { page: "game", url: "extra" }]) {
    assert.throws(() => validateNavigation(value), TypeError);
  }
});

test("pointer validation clamps coordinates and rejects unbounded commands", () => {
  assert.deepEqual(validateInput({ type: "move", x: -50, y: PANEL_HEIGHT + 1 }), { type: "move", x: 0, y: PANEL_HEIGHT - 1 });
  for (const value of [
    null, [], { type: "unknown" }, { type: "down", x: NaN, y: 2 },
    { type: "up", x: Infinity, y: 0 }, { type: "move", x: 1000001, y: 0 },
    { type: "down", x: "1", y: 2 }, { type: "down", x: 1, y: 2, button: "right" },
    { type: "wheel", x: 1, y: 2, deltaY: 1001 },
    { type: "wheel", x: 1, y: 2, deltaY: NaN },
  ]) assert.throws(() => validateInput(value), TypeError);
});

test("only named keys and a single printable ASCII character are accepted", () => {
  assert.deepEqual(validateInput({ type: "key", key: "Escape" }), { type: "key", key: "Escape", shift: false });
  assert.deepEqual(validateInput({ type: "key", key: "Q", shift: true }), { type: "key", key: "Q", shift: true });
  for (const value of [
    { type: "key", key: "F12" }, { type: "key", key: "Alt" },
    { type: "key", key: "Enter", ctrl: true }, { type: "key", key: "q", shift: "yes" },
    { type: "key", key: "\n" }, { type: "key", key: "ab" },
  ]) assert.throws(() => validateInput(value), TypeError);
});

test("text paste is bounded and remains plain text", () => {
  const value = { type: "text", text: "<script>not executable</script>" };
  assert.deepEqual(validateInput(value), value);
  for (const text of ["", "x".repeat(513), "a\0b", 42]) {
    assert.throws(() => validateInput({ type: "text", text }), TypeError);
  }
});

test("JSON mutation bodies enforce type and size, including chunked requests", async () => {
  assert.deepEqual(await readJson(request('{"page":"probe"}')), { page: "probe" });
  await assert.rejects(readJson(request("{}", { "content-type": "text/plain" })), /Content-Type/);
  await assert.rejects(readJson(request("{")), /valid JSON/);
  await assert.rejects(readJson(request("{}", { "content-length": String(MAX_BODY_BYTES + 1) })), /too large/);
  await assert.rejects(readJson(request("x".repeat(MAX_BODY_BYTES + 1))), /too large/);
});

test("pointer drag maintains pressed state and normal up uses the target", async () => {
  const { input, commands } = capture();
  await input.dispatch({ type: "down", x: 10, y: 20 });
  await input.dispatch({ type: "down", x: 10, y: 20 });
  await input.dispatch({ type: "move", x: 30, y: 40 });
  await input.dispatch({ type: "up", x: 50, y: 60 });
  await input.dispatch({ type: "up", x: 50, y: 60 });
  assert.equal(commands.length, 3);
  assert.deepEqual(commands.map(({ params }) => [params.type, params.buttons, params.x, params.y]), [
    ["mousePressed", 1, 10, 20], ["mouseMoved", 1, 30, 40], ["mouseReleased", 0, 50, 60],
  ]);
});

test("cancel moves and releases outside the source instead of clicking the pressed element", async () => {
  const { input, commands } = capture();
  await input.dispatch({ type: "down", x: 10, y: 20 });
  await input.release();
  await input.release();
  assert.deepEqual(commands.map(({ params }) => [params.type, params.buttons, params.x, params.y]), [
    ["mousePressed", 1, 10, 20], ["mouseMoved", 1, -1, -1], ["mouseReleased", 0, -1, -1],
  ]);
  await input.dispatch({ type: "move", x: 30, y: 40 });
  assert.equal(commands.at(-1).params.buttons, 0);
});

test("cancel still releases if moving outside fails", async () => {
  const commands = [];
  const input = createInputController(async (method, params) => {
    commands.push({ method, params });
    if (params.type === "mouseMoved") throw new Error("move failed");
  });
  await input.dispatch({ type: "down", x: 0, y: 0 });
  await assert.rejects(input.release(), /move failed/);
  assert.equal(commands.at(-1).params.type, "mouseReleased");
});

test("wheel and inserted text only use their dedicated debugger commands", async () => {
  const { input, commands } = capture();
  await input.dispatch({ type: "wheel", x: PANEL_WIDTH, y: 10, deltaY: -240 });
  await input.dispatch({ type: "text", text: "character name" });
  assert.equal(commands[0].method, "Input.dispatchMouseEvent");
  assert.deepEqual(commands[0].params, { type: "mouseWheel", x: PANEL_WIDTH - 1, y: 10, button: "none", buttons: 0, deltaX: 0, deltaY: -240 });
  assert.deepEqual(commands[1], { method: "Input.insertText", params: { text: "character name" } });
});

test("printable keys emit keydown, text and keyup for both forms and game commands", async () => {
  const { input, commands } = capture();
  await input.dispatch({ type: "key", key: "Q", shift: true });
  assert.equal(commands[0].params.type, "keyDown");
  assert.equal(commands[0].params.text, "Q");
  assert.equal(commands[0].params.key, "Q");
  assert.equal(commands[0].params.code, "KeyQ");
  assert.equal(commands[0].params.modifiers, 8);
  assert.equal(commands[1].params.type, "keyUp");
  assert.equal(commands[1].params.text, undefined);
  await input.dispatch({ type: "key", key: "Tab", shift: true });
  assert.equal(commands[2].params.windowsVirtualKeyCode, 9);
  assert.equal(commands[2].params.modifiers, 8);
  assert.equal(commands[2].params.text, undefined);
});

test("a failed keydown still attempts keyup", async () => {
  const types = [];
  const input = createInputController(async (_method, params) => {
    types.push(params.type);
    if (params.type === "keyDown") throw new Error("key failed");
  });
  await assert.rejects(input.dispatch({ type: "key", key: "Enter" }), /key failed/);
  assert.deepEqual(types, ["keyDown", "keyUp"]);
});

test("punctuation uses physical key codes rather than navigation virtual keys", async () => {
  const { input, commands } = capture();
  await input.dispatch({ type: "key", key: "#", shift: true });
  await input.dispatch({ type: "key", key: ">", shift: true });
  assert.equal(commands[0].params.code, "Digit3");
  assert.equal(commands[0].params.windowsVirtualKeyCode, 51);
  assert.equal(commands[0].params.text, "#");
  assert.equal(commands[0].params.unmodifiedText, "3");
  assert.equal(commands[2].params.code, "Period");
  assert.equal(commands[2].params.windowsVirtualKeyCode, 190);
});
