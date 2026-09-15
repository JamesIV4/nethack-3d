import { TILE_SIZE } from "../../constants";
import {
  cancelQuestScene,
  getQuestNativeState,
  isQuestNativeAvailable,
  postQuestNativeMessage,
  sendQuestScene,
} from "../../../quest/native/bridge";
import type { Camera } from "../camera/camera";
import type { EngineCoordinator } from "../engine-coordinator";
import type { EngineState } from "../runtime/engine-state";
import type { PlayerMovement } from "../world/player-movement";
import type { Lighting } from "./lighting";
import type { RenderPipeline } from "./render-pipeline";
import type { TerminalRendering } from "./terminal-rendering";
import { QuestSceneExporter } from "./quest-scene-export";

export interface QuestSceneExportDependencies {
  readonly camera: Pick<Camera, "getActiveCamera" | "playModeCameraTransitionActive" | "firstPersonEyeHeight">;
  readonly coordinator: Pick<EngineCoordinator, "applyPlayMode">;
  readonly engineState: Pick<EngineState, "clientOptions" | "characterCreationConfig" | "playMode">;
  readonly lighting: Pick<Lighting, "vignetteUniforms">;
  readonly playerMovement: Pick<PlayerMovement, "playerPos">;
  readonly renderPipeline: Pick<RenderPipeline, "scene">;
  readonly terminalRendering: Pick<TerminalRendering, "isTerminalDisplayMode">;
}

/** Native presentation participates in the existing engine frame and lifecycle. */
export class QuestSceneExport {
  private started = false;
  private wasNativeReady = false;
  private wasFlat = false;
  private readonly exporter = new QuestSceneExporter({
    available: isQuestNativeAvailable,
    send: (frame) => sendQuestScene({ ...frame }),
    clear: (session) => { cancelQuestScene("Game engine disposed."); postQuestNativeMessage({ version: 1, type: "scene-clear", session }); },
    onError: (error) => console.warn("Quest scene transfer failed; retrying a complete snapshot.", error),
  });

  constructor(private readonly dependencies: QuestSceneExportDependencies) {}

  start(): void { this.started = true; }

  syncPlayMode(): void {
    if (!this.started || !isQuestNativeAvailable()) return;
    const state = this.dependencies.engineState;
    const immersive = getQuestNativeState().mode === "immersive";
    const desired = (immersive || state.clientOptions.fpsMode) && !this.dependencies.terminalRendering.isTerminalDisplayMode()
      ? "fps" : "normal";
    if (desired === state.playMode) return;
    // applyPlayMode owns geometry rebuilding, player suppression, camera and
    // prompt cleanup. Preserve the user's stored window/FPS choice around its
    // temporary native override; React preferences are never updated here.
    const preferredFps = state.clientOptions.fpsMode;
    const preferredStartupMode = state.characterCreationConfig.playMode;
    this.dependencies.coordinator.applyPlayMode(desired);
    state.clientOptions.fpsMode = preferredFps;
    state.characterCreationConfig.playMode = preferredStartupMode;
    this.dependencies.camera.playModeCameraTransitionActive = false;
  }

  update(timeMs: number): void {
    if (!this.started || !isQuestNativeAvailable()) return;
    const nativeState = getQuestNativeState();
    const flat = nativeState.mode === "flat";
    if (flat !== this.wasFlat) {
      cancelQuestScene("Quest presentation changed.");
      this.exporter.invalidate();
      this.wasFlat = flat;
    }
    if (flat) { this.wasNativeReady = false; return; }
    const nativeReady = nativeState.ready;
    if (this.wasNativeReady && !nativeReady) this.exporter.invalidate();
    this.wasNativeReady = nativeReady;
    const uniforms = this.dependencies.lighting.vignetteUniforms;
    const player = this.dependencies.playerMovement.playerPos;
    this.exporter.update({
      scene: this.dependencies.renderPipeline.scene,
      camera: this.dependencies.camera.getActiveCamera(),
      player: [player.x * TILE_SIZE * this.dependencies.renderPipeline.scene.scale.x, -player.y * TILE_SIZE, 0],
      tileSize: TILE_SIZE,
      eyeHeight: this.dependencies.camera.firstPersonEyeHeight,
      lighting: {
        center: uniforms.uLightingCenter.value.toArray(),
        radius: uniforms.uLightingRadius.value,
        falloffPower: uniforms.uFalloffPower.value,
        maxDarkAlpha: uniforms.uMaxDarkAlpha.value,
        isFpsMode: uniforms.uIsFpsMode.value,
      },
    }, timeMs);
  }

  usesNativeRenderer(): boolean {
    const state = getQuestNativeState();
    return this.started && isQuestNativeAvailable() && state.ready && state.mode !== "flat";
  }

  dispose(): void { this.started = false; this.exporter.dispose(); }
}
