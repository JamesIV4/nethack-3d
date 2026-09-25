import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

test("profiles loading and movement, sums all render passes, and restores wrapped methods", () => {
  const script = readFileSync(new URL("profile-frame.js", import.meta.url), "utf8");
  let now = 0, finish;
  const renderer = { xr: { isPresenting: true, getSession: () => ({ frameRate: 72 }) },
    info: { autoReset: true, render: { calls: 0 }, memory: {} },
    render(draws) { now += 2; this.info.render.calls = draws; } };
  const systems = {
    renderPipeline: { renderer, scene: {} },
    engineState: { characterCreationConfig: { runtimeVersion: "5.0" }, playMode: "fps" },
    playerMovement: { playerPos: { x: 1, y: 2 } },
    promptDialogs: { runtimeLoadingVisible: true }, tilesetAssets: {},
    camera: { fpsStepCameraActive: false }, entityMovement: { activeEntityMoveTransitions: new Map() },
    tileRendering: { tileMap: new Map() },
    tileUpdates: { pendingTileUpdates: new Map(), pendingTileFlushQueue: [], pendingTileFlushQueueIndex: 0 },
    webXrPresentation: {},
  };
  const engine = { systems, animate() { renderer.render(100); renderer.render(5); }, handleRuntimeEvent() {} };
  const original = engine.animate, originalRender = renderer.render;
  const context = vm.createContext({ window: { nethackGame: engine }, document: { visibilityState: "visible" },
    performance: { now: () => now }, setTimeout: callback => { finish = callback; } });
  assert.equal(JSON.parse(vm.runInContext(script, context)).durationSeconds, 30);
  for (let i = 0; i < 3; i++) { now += 10; engine.animate(); }
  systems.promptDialogs.runtimeLoadingVisible = false;
  systems.camera.fpsStepCameraActive = true;
  for (let i = 0; i < 3; i++) { now += 10; engine.animate(); }
  engine.handleRuntimeEvent({ type: "player_position" });
  finish();
  assert.equal(engine.animate, original); assert.equal(renderer.render, originalRender);
  const report = JSON.parse(vm.runInContext(script, context));
  assert.equal(report.totalDrawCallsPerFrame.mean, 105);
  assert.equal(report.phases.loading.cpuMs.count, 3);
  assert.equal(report.phases.moving.cpuMs.count, 3);
  assert.equal(report.cpuMs.wholeFrame.mean, 4);
  assert.equal(report.positionEvents, 1);
  assert.equal(report.requestedRefreshHz, 72);
});
