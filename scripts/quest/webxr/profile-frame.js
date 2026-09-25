// Evaluate in a development console (desktop/Android/Quest), or device-rdp.mjs.
// First call starts a 30-second sample; the second collects it. No game input is sent.
JSON.stringify((() => {
  const previous = window.__nh3dFrameProfile;
  if (previous) {
    if (!previous.result) return { pending: true };
    delete window.__nh3dFrameProfile;
    return previous.result;
  }
  const engine = window.nethackGame, systems = engine?.systems;
  if (!systems) return { error: "Select the active NetHack 3D page." };
  const renderer = systems.renderPipeline.renderer, values = {}, restorers = [], intervals = [], calls = [];
  const phases = {}, longTasks = [], startPlayer = { ...systems.playerMovement.playerPos };
  let previousFrame = 0, previousPhase = "", frameDrawCalls = 0, positionEvents = 0;
  const phase = () => engine.startupOnly ? "menu" :
    systems.promptDialogs.runtimeLoadingVisible || systems.tilesetAssets.tilesetCompilationLoadingVisible ? "loading" :
    systems.camera.fpsStepCameraActive || systems.entityMovement.activeEntityMoveTransitions.size ? "moving" : "idle";
  const wrap = (owner, key, name, frame = false) => {
    if (!owner || typeof owner[key] !== "function") return;
    const original = owner[key], samples = values[name] = [];
    const wrapped = function (...args) {
      const start = performance.now(), currentPhase = frame ? phase() : "";
      const priorCalls = renderer.info.render.calls;
      if (frame) frameDrawCalls = 0;
      if (key === "handleRuntimeEvent" && args[0]?.type === "player_position") positionEvents++;
      try { return original.apply(this, args); }
      finally {
        const elapsed = performance.now() - start;
        samples.push(elapsed);
        if (owner === renderer && key === "render") {
          frameDrawCalls += renderer.info.autoReset ? renderer.info.render.calls : renderer.info.render.calls - priorCalls;
        }
        if (frame) {
          const group = phases[currentPhase] ??= { intervals: [], cpu: [], draws: [], queue: [] };
          if (previousFrame) {
            const interval = start - previousFrame;
            intervals.push(interval);
            if (previousPhase === currentPhase) group.intervals.push(interval);
          }
          previousFrame = start; previousPhase = currentPhase;
          calls.push(frameDrawCalls); group.draws.push(frameDrawCalls); group.cpu.push(elapsed);
          group.queue.push(systems.tileUpdates.pendingTileUpdates.size +
            systems.tileUpdates.pendingTileFlushQueue.length - systems.tileUpdates.pendingTileFlushQueueIndex +
            (systems.tileUpdates.pendingTileVisualRefreshKeys?.size ?? 0));
        }
      }
    };
    owner[key] = wrapped;
    restorers.push(() => { if (owner[key] === wrapped) owner[key] = original; });
  };
  for (const [owner, key] of [
    ["webXrPresentation", "updateCamera"], ["webXrPresentation", "updateInput"],
    ["webXrPresentation", "prepareRender"], ["webXrPresentation", "render"], ["webXrPresentation", "renderStartupFrame"],
    ["entityBillboards", "updateMonsterBillboardPitchLockState"], ["camera", "updateCamera"],
    ["minimap", "renderMinimapViewportOverlay"], ["damageNumbers", "updateDamageEffects"],
    ["tileRendering", "updateEffectAnimations"], ["tileRendering", "updateTile"],
    ["tileUpdates", "flushPendingTileUpdates"], ["tileUpdates", "flushPendingTileUpdatesForPlayerPositionReconcile"],
    ["tileUpdates", "flushPendingDarkCorridorInference"], ["tileUpdates", "refreshTilesFromStateCache"],
    ["wallGeometry", "flushTileBatch"], ["floorOcclusion", "flushTileBatch"],
  ]) wrap(systems[owner], key, owner + "." + key);
  wrap(systems.webXrPresentation.input?.caster, "intersectObjects", "controllerRaycast");
  wrap(systems.webXrPresentation.htmlPanel, "update", "htmlPanel");
  wrap(systems.renderPipeline.scene, "updateMatrixWorld", "sceneMatrices");
  wrap(renderer, "render", "rendererSubmission");
  wrap(engine, "handleRuntimeEvent", "runtimeEvent");
  wrap(engine, "animate", "wholeFrame", true);
  let observer;
  if (typeof PerformanceObserver === "function" && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
    observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => entry.duration)));
    observer.observe({ type: "longtask" });
  }
  const stats = samples => {
    const sorted = samples.slice().sort((a, b) => a - b);
    return { count: sorted.length, mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0,
      median: sorted[Math.floor(sorted.length * .5)] ?? 0, p95: sorted[Math.floor(sorted.length * .95)] ?? 0,
      p99: sorted[Math.floor(sorted.length * .99)] ?? 0, max: sorted.at(-1) ?? 0 };
  };
  const state = window.__nh3dFrameProfile = {};
  setTimeout(() => {
    restorers.reverse().forEach(restore => restore()); observer?.disconnect();
    const session = renderer.xr.getSession();
    state.result = {
      warning: "Instrumented JS/CPU timings, not GPU completion or VRC acceptance. Timings are nested; do not add them. Phase labels are heuristic.",
      runtime: systems.engineState.characterCreationConfig.runtimeVersion,
      mode: systems.engineState.playMode, xr: renderer.xr.isPresenting, startPlayer,
      endPlayer: { ...systems.playerMovement.playerPos }, positionEvents,
      tiles: systems.tileRendering.tileMap.size, visibility: session?.visibilityState ?? document.visibilityState,
      requestedRefreshHz: session?.frameRate ?? null,
      frameIntervalMs: stats(intervals), totalDrawCallsPerFrame: stats(calls),
      framesOver16_67Ms: intervals.filter(value => value > 1000/60).length,
      phases: Object.fromEntries(Object.entries(phases).map(([key, group]) => [key, {
        frameIntervalMs: stats(group.intervals), cpuMs: stats(group.cpu), draws: stats(group.draws), queuedTiles: stats(group.queue),
      }])),
      cpuMs: Object.fromEntries(Object.entries(values).map(([key, samples]) => [key, stats(samples)])),
      longTasks: observer ? stats(longTasks) : "unsupported by this browser",
      memory: { ...renderer.info.memory },
      framebuffer: { width: session?.renderState?.baseLayer?.framebufferWidth, height: session?.renderState?.baseLayer?.framebufferHeight },
    };
  }, 30000);
  return { started: true, durationSeconds: 30, phase: phase(), tiles: systems.tileRendering.tileMap.size };
})());
