import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { TAARenderPass } from "three/examples/jsm/postprocessing/TAARenderPass.js";
import { recordDebugSessionLogEvent } from "../../../debug-session-log";
import { toneAdjustShader } from "../shared/constants";
import type { Camera } from "../camera/camera";
import type { EngineState } from "../runtime/engine-state";
import type { HeldWeaponAnimationDebug } from "../diagnostics/held-weapon-animation-debug";
import type { Minimap } from "../ui/minimap";

export interface RenderPipelineDependencies {
  readonly camera: Pick<
    Camera,
    "camera"
    | "recenterCameraOnPlayerIfNeeded"
  >;
  readonly engineState: Pick<
    EngineState,
    "characterCreationConfig"
    | "clientOptions"
    | "mountElement"
  >;
  readonly heldWeaponAnimationDebug: Pick<
    HeldWeaponAnimationDebug,
    "syncFpsHeldWeaponAnimationDebugPanelPosition"
  >;
  readonly minimap: Pick<
    Minimap,
    "scheduleMinimapActionRailOverlapSync"
  >;
}

/** Three.js renderer, viewport resolution and antialiasing postprocessing */
export class RenderPipeline {
  constructor(private readonly dependencies: RenderPipelineDependencies) {}

  renderer!: THREE.WebGLRenderer;

  composer: EffectComposer | null = null;

  taaRenderPass: TAARenderPass | null = null;

  fxaaPass: FXAAPass | null = null;

  toneAdjustPass: ShaderPass | null = null;

  scene!: THREE.Scene;

  readonly maxRendererPixelRatio: number = 2;

  readonly desktopTaaSampleLevel: number = 1;

  readonly handleWebGlContextLost = (): void => {
    const renderInfo = this.renderer?.info;
    recordDebugSessionLogEvent("webglcontextlost", {
      runtimeVersion: this.dependencies.engineState.characterCreationConfig.runtimeVersion ?? "3.6.7",
      antialiasing: this.dependencies.engineState.clientOptions.antialiasing,
      tilesetPath: this.dependencies.engineState.clientOptions.tilesetPath,
      renderMemory: renderInfo
        ? {
            geometries: renderInfo.memory.geometries,
            textures: renderInfo.memory.textures,
          }
        : null,
      renderCalls: renderInfo?.render.calls ?? null,
    });
  };

  readonly handleWebGlContextRestored = (): void => {
    recordDebugSessionLogEvent("webglcontextrestored", {
      runtimeVersion: this.dependencies.engineState.characterCreationConfig.runtimeVersion ?? "3.6.7",
      antialiasing: this.dependencies.engineState.clientOptions.antialiasing,
    });
  };

  updateRendererResolution(): void {
    if (this.renderer.xr.isPresenting) return;
    const viewport = this.getRendererViewportSize();
    const pixelRatio = THREE.MathUtils.clamp(
      window.devicePixelRatio || 1,
      1,
      this.maxRendererPixelRatio,
    );
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(viewport.width, viewport.height, false);
    // Keep CSS presentation size aligned with logical viewport when updateStyle=false.
    this.renderer.domElement.style.width = `${viewport.width}px`;
    this.renderer.domElement.style.height = `${viewport.height}px`;
    if (this.composer) {
      this.composer.setPixelRatio(pixelRatio);
      this.composer.setSize(viewport.width, viewport.height);
      if (this.taaRenderPass) {
        this.taaRenderPass.accumulate = false;
      }
    }
  }

  onWindowResize(): void {
    const viewport = this.getRendererViewportSize();
    this.dependencies.camera.camera.aspect = viewport.width / viewport.height;
    this.dependencies.camera.camera.updateProjectionMatrix();
    this.updateRendererResolution();
    this.dependencies.camera.recenterCameraOnPlayerIfNeeded();
    this.dependencies.minimap.scheduleMinimapActionRailOverlapSync();
    this.dependencies.heldWeaponAnimationDebug.syncFpsHeldWeaponAnimationDebugPanelPosition();
  }

  getRendererViewportSize(): { width: number; height: number } {
    const hostWidth = this.dependencies.engineState.mountElement?.clientWidth ?? 0;
    const hostHeight = this.dependencies.engineState.mountElement?.clientHeight ?? 0;
    const width = hostWidth > 0 ? hostWidth : window.innerWidth;
    const height = hostHeight > 0 ? hostHeight : window.innerHeight;
    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
  }

  disposeAntialiasingPipeline(): void {
    this.taaRenderPass?.dispose();
    this.fxaaPass?.dispose();
    this.toneAdjustPass?.dispose();
    this.composer?.dispose();
    this.taaRenderPass = null;
    this.fxaaPass = null;
    this.toneAdjustPass = null;
    this.composer = null;
  }

  initAntialiasingPipeline(): void {
    this.disposeAntialiasingPipeline();
    const composer = new EffectComposer(this.renderer);
    composer.addPass(
      new RenderPass(
        this.scene,
        this.dependencies.camera.camera,
        undefined,
        new THREE.Color(0x000000),
        0,
      ),
    );
    if (this.dependencies.engineState.clientOptions.antialiasing === "taa") {
      const taaRenderPass = new TAARenderPass(this.scene, this.dependencies.camera.camera);
      taaRenderPass.sampleLevel = this.desktopTaaSampleLevel;
      taaRenderPass.unbiased = true;
      // Keep TAA in non-accumulating mode so animated scene content continues updating.
      taaRenderPass.accumulate = false;
      composer.addPass(taaRenderPass);
      this.taaRenderPass = taaRenderPass;
      this.fxaaPass = null;
    } else {
      const fxaaPass = new FXAAPass();
      composer.addPass(fxaaPass);
      this.fxaaPass = fxaaPass;
      this.taaRenderPass = null;
    }
    const toneAdjustPass = new ShaderPass(toneAdjustShader);
    composer.addPass(toneAdjustPass);
    this.toneAdjustPass = toneAdjustPass;
    this.updateToneAdjustPostProcess();
    this.composer = composer;
  }

  updateToneAdjustPostProcess(): void {
    if (!this.toneAdjustPass) {
      return;
    }
    this.toneAdjustPass.uniforms["brightness"].value =
      this.dependencies.engineState.clientOptions.brightness;
    this.toneAdjustPass.uniforms["contrast"].value =
      this.dependencies.engineState.clientOptions.contrast;
    this.toneAdjustPass.uniforms["gamma"].value = this.dependencies.engineState.clientOptions.gamma;
  }

  updateTaaState(): void {
    const taaRenderPass = this.taaRenderPass;
    if (!taaRenderPass) {
      return;
    }
    taaRenderPass.accumulate = false;
  }
}
