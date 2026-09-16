// Read-only verification of the JavaScript inside the three native EM_JS bridges.
// This does not compile WASM or modify/stage game artifacts.
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { test } from "node:test";

const variants = [
  ["3.6.7", process.env.NH3D_SOURCE_367 ?? "/home/james/Repos/forked/neth4ck-monorepo/packages/wasm-367/NetHack", "viiiiiii", [3, 4, 5, 100, 0, 42, 0]],
  ["5.0", process.env.NH3D_SOURCE_5 ?? "/home/james/Repos/forked/neth4ck-monorepo/packages/wasm-5/NetHack", "viiippii", [3, 4, 5, 128, 192, 42, 0]],
  ["slashem", process.env.NH3D_SOURCE_SLASHEM ?? "/home/james/Repos/slashem-wasm/slashem-0.0.7E7F3", "viiiiii", [3, 4, 5, 100, 42, 0]],
];

for (const [version, root, format, args] of variants) {
  const sourcePath = (process.platform === "win32" && root.startsWith("/home/") ? "//wsl.localhost/Ubuntu" : "") + root + "/win/shim/winshim.c";
  const source = readFileSync(sourcePath, "utf8");
  const declaration = source.lastIndexOf("EM_JS(void, local_callback,");
  assert.ok(declaration >= 0, version + ": callback definition missing");
  const start = source.indexOf("{", declaration) + 1, end = source.indexOf("\n})", start);
  assert.ok(end > start, version + ": callback body end missing");
  const invoke = new Function("cb_name", "shim_name", "ret_ptr", "fmt_str", "args", "Asyncify", "UTF8ToString", "getValue", "globalThis", source.slice(start, end));

  for (const asynchronous of [false, true]) test(`${version}: ${asynchronous ? "Promise" : "synchronous"} glyph return preserves arguments, result and guard order`, async () => {
    const calls = [], writes = [], lifecycle = [];
    let resolve, wakes = 0;
    const result = asynchronous ? new Promise(done => { resolve = done; }) : 0;
    const scope = { nethackGlobal: { helpers: {
      getPointerValue: (_name, value) => value,
      setPointerValue: (name, pointer, type, value) => {
        assert.equal(scope.nethackGlobal.shimFunctionRunning, "shim_print_glyph");
        writes.push([name, pointer, type, value]); lifecycle.push("result");
      },
    } }, callback(name, ...values) {
      calls.push([name, ...values]);
      assert.equal(this.tag, "receiver");
      assert.equal(scope.nethackGlobal.nh3dSynchronousGlyphCallbacks, 1);
      return result;
    } };
    const asyncify = { handleSleep(startAsync) { startAsync(() => {
      assert.equal(scope.nethackGlobal.shimFunctionRunning, null);
      lifecycle.push("wake"); wakes++;
    }); } };
    invoke.call({ tag: "receiver" }, "callback", "shim_print_glyph", 0, format, 100, asyncify, value => value, pointer => args[(pointer - 100) / 4], scope);
    assert.deepEqual(calls, [["shim_print_glyph", ...args]]);
    assert.equal(wakes, asynchronous ? 0 : 1);
    if (asynchronous) { resolve(0); await result; await Promise.resolve(); }
    assert.equal(wakes, 1);
    assert.deepEqual(writes, [["shim_print_glyph", 0, "v", 0]]);
    assert.deepEqual(lifecycle, ["result", "wake"]);
  });

  test(`${version}: inventory and combat notifications remain ahead of the glyph callback`, () => {
    const calls = [];
    const scope = { nethackGlobal: { pendingInventoryUpdate: true,
      pendingShimNotifications: [["shim_monster_attack", 42, 0], ["shim_monster_killed", 42]],
      helpers: { getPointerValue: (_name, value) => value, setPointerValue() {} },
    }, callback(name) { calls.push(name); return 0; } };
    invoke("callback", "shim_print_glyph", 0, format, 100, { handleSleep: startAsync => startAsync(() => {}) }, value => value, pointer => args[(pointer - 100) / 4], scope);
    assert.deepEqual(calls, ["shim_update_inventory", "shim_monster_attack", "shim_monster_killed", "shim_print_glyph"]);
    assert.equal(scope.nethackGlobal.pendingInventoryUpdate, false);
    assert.deepEqual(scope.nethackGlobal.pendingShimNotifications, []);
  });
}
