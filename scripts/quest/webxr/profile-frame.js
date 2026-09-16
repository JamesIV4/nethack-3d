// Evaluate through device-rdp.mjs twice: start, then collect after six seconds.
// Wrappers preserve receivers/results and restore themselves automatically.
JSON.stringify((() => {
  const previous = window.__nh3dFrameProfile;
  if (previous) {
    if (!previous.result) return { pending: true };
    delete window.__nh3dFrameProfile;
    return previous.result;
  }
  const systems = window.nethackGame?.systems;
  if (!systems?.webXrPresentation.active) return { error: "Select the active game tab with an immersive session." };
  const renderer = systems.renderPipeline.renderer, values = {}, restorers = [], intervals = [], calls = [];
  let previousFrame = 0;
  const wrap = (owner, key, name, frame = false) => {
    if (!owner || typeof owner[key] !== "function") return;
    const original = owner[key], samples = values[name] = [];
    const wrapped = function (...args) {
      const start = performance.now();
      try { return original.apply(this, args); }
      finally {
        samples.push(performance.now() - start);
        if (frame) {
          if (previousFrame) intervals.push(start - previousFrame);
          previousFrame = start; calls.push(renderer.info.render.calls);
        }
      }
    };
    owner[key] = wrapped;
    restorers.push(() => { if (owner[key] === wrapped) owner[key] = original; });
  };
  for (const [owner, key] of [
    ["webXrPresentation", "updateCamera"], ["webXrPresentation", "updateInput"],
    ["webXrPresentation", "prepareRender"], ["entityBillboards", "updateMonsterBillboardPitchLockState"],
    ["camera", "updateCamera"], ["minimap", "renderMinimapViewportOverlay"],
    ["damageNumbers", "updateDamageEffects"], ["tileRendering", "updateEffectAnimations"],
    ["tileUpdates", "flushSettledDarkCorridorInference"],
  ]) wrap(systems[owner], key, owner + "." + key);
  wrap(systems.webXrPresentation.input?.caster, "intersectObjects", "controllerRaycast");
  wrap(systems.webXrPresentation.htmlPanel, "update", "htmlPanel");
  wrap(systems.renderPipeline.scene, "updateMatrixWorld", "sceneMatrices");
  const hasXrRender = typeof systems.webXrPresentation.render === "function";
  wrap(renderer, "render", "rendererSubmission", !hasXrRender);
  wrap(systems.webXrPresentation, "render", "xrWorldIncludingPreparation", true);
  const stats = samples => {
    const sorted = samples.slice().sort((a, b) => a - b);
    return { count: sorted.length, mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0,
      median: sorted[Math.floor(sorted.length * 0.5)] ?? 0, p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0 };
  };
  const state = window.__nh3dFrameProfile = {};
  setTimeout(() => {
    restorers.reverse().forEach(restore => restore());
    const session = renderer.xr.getSession();
    state.result = {
      runtime: systems.engineState.characterCreationConfig.runtimeVersion,
      mode: systems.engineState.playMode, player: { ...systems.playerMovement.playerPos },
      tiles: systems.tileRendering.tileMap.size, visibility: session?.visibilityState,
      frameIntervalMs: stats(intervals), stereoDrawCalls: stats(calls),
      cpuMs: Object.fromEntries(Object.entries(values).map(([key, samples]) => [key, stats(samples)])),
      memory: { ...renderer.info.memory },
      framebuffer: { width: session?.renderState?.baseLayer?.framebufferWidth, height: session?.renderState?.baseLayer?.framebufferHeight },
    };
  }, 6000);
  return { started: true, durationSeconds: 6, tiles: systems.tileRendering.tileMap.size };
})());
