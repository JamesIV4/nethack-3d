import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { QuestSceneExport, type QuestSceneExportDependencies } from "./quest-scene-export-system";
import { normalizeNh3dClientOptions } from "../../ui-types";
import { sendQuestScene } from "../../../quest/native/bridge";

vi.hoisted(() => vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { protocol: "http:", hostname: "localhost" } }));
afterAll(() => vi.unstubAllGlobals());

const native = vi.hoisted(() => ({ available: true, mode: "windowed", ready: false }));
vi.mock("../../../quest/native/bridge", () => ({
  isQuestNativeAvailable: () => native.available,
  getQuestNativeState: () => native,
  postQuestNativeMessage: vi.fn(),
  cancelQuestScene: vi.fn(),
  sendQuestScene: vi.fn(() => Promise.resolve()),
}));
beforeEach(() => { vi.clearAllMocks(); native.available = true; native.mode = "windowed"; native.ready = false; });

function fixture(start = true) {
  const deps: QuestSceneExportDependencies = {
    camera: { getActiveCamera: () => new THREE.Camera(), playModeCameraTransitionActive: false, firstPersonEyeHeight: 0.62 },
    coordinator: { applyPlayMode: vi.fn((mode) => {
      deps.engineState.playMode = mode;
      deps.engineState.clientOptions.fpsMode = mode === "fps";
      deps.engineState.characterCreationConfig.playMode = mode;
      deps.camera.playModeCameraTransitionActive = true;
    }) },
    engineState: { clientOptions: normalizeNh3dClientOptions(), characterCreationConfig: { mode: "create", playMode: "normal" }, playMode: "normal" },
    lighting: { vignetteUniforms: {
      uLightingCenter: { value: new THREE.Vector3() }, uLightingRadius: { value: 20 },
      uFalloffPower: { value: 1 }, uMaxDarkAlpha: { value: 1 }, uIsFpsMode: { value: false },
      uBloodGroundStrength: { value: 1 }, uBloodGroundSpecularReferenceStrength: { value: 1 },
    } },
    playerMovement: { playerPos: { x: 5, y: 8 } },
    renderPipeline: { scene: new THREE.Scene() },
    terminalRendering: { isTerminalDisplayMode: vi.fn(() => false) },
  };
  const system = new QuestSceneExport(deps);
  if (start) system.start();
  return { deps, system };
}

describe("Quest native engine presentation", () => {
  it("keeps native mode changes, capture and renderer handoff inactive until engine startup completes", () => {
    const { system, deps } = fixture(false);
    native.mode = "immersive"; native.ready = true;
    system.syncPlayMode();
    system.update(0);
    expect(deps.coordinator.applyPlayMode).not.toHaveBeenCalled();
    expect(sendQuestScene).not.toHaveBeenCalled();
    expect(system.usesNativeRenderer()).toBe(false);
    system.start();
    system.syncPlayMode();
    system.update(100);
    expect(deps.coordinator.applyPlayMode).toHaveBeenCalledWith("fps");
    expect(sendQuestScene).toHaveBeenCalledWith(expect.objectContaining({ eyeHeight: 0.62 }));
    expect(system.usesNativeRenderer()).toBe(true);
  });
  it("uses existing FPS geometry in immersive and restores the user's windowed play mode without changing preferences", () => {
    const { system, deps } = fixture();
    native.mode = "immersive";
    system.syncPlayMode();
    expect(deps.engineState.playMode).toBe("fps");
    expect(deps.engineState.clientOptions.fpsMode).toBe(false);
    expect(deps.engineState.characterCreationConfig.playMode).toBe("normal");
    expect(deps.camera.playModeCameraTransitionActive).toBe(false);
    system.syncPlayMode();
    expect(deps.coordinator.applyPlayMode).toHaveBeenCalledTimes(1);
    native.mode = "windowed";
    system.syncPlayMode();
    expect(deps.engineState.playMode).toBe("normal");
    expect(deps.coordinator.applyPlayMode).toHaveBeenCalledTimes(2);
  });

  it("restores a preference changed while in immersive and preserves terminal presentation", () => {
    const { system, deps } = fixture();
    native.mode = "immersive"; system.syncPlayMode();
    deps.engineState.clientOptions.fpsMode = true;
    native.mode = "windowed"; system.syncPlayMode();
    expect(deps.engineState.playMode).toBe("fps");
    vi.mocked(deps.terminalRendering.isTerminalDisplayMode).mockReturnValue(true);
    native.mode = "immersive"; system.syncPlayMode();
    expect(deps.engineState.playMode).toBe("normal");
    expect(deps.engineState.clientOptions.fpsMode).toBe(true);
  });

  it("does no scene serialization in flat mode and resynchronizes on stereo return", async () => {
    const { system, deps } = fixture();
    vi.mocked(sendQuestScene).mockClear();
    deps.renderPipeline.scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    native.mode = "flat";
    system.update(0);
    system.update(100);
    expect(sendQuestScene).not.toHaveBeenCalled();
    native.mode = "windowed";
    system.update(200);
    expect(sendQuestScene).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendQuestScene).mock.calls[0][0]).toMatchObject({ reset: true });
  });
  it("keeps the browser renderer until native is ready and for flat fallback mode", () => {
    const { system } = fixture();
    expect(system.usesNativeRenderer()).toBe(false);
    native.ready = true;
    expect(system.usesNativeRenderer()).toBe(true);
    native.mode = "flat";
    expect(system.usesNativeRenderer()).toBe(false);
    native.mode = "immersive"; native.available = false;
    expect(system.usesNativeRenderer()).toBe(false);
  });
});
