import * as THREE from "three";
import { BloodGround, type BloodGroundDependencies } from "../../src/game/engine/effects/blood-ground";
import { LevelTerrainCache, type LevelTerrainCacheDependencies } from "../../src/game/engine/world/level-terrain-cache";
import { Lighting, type LightingDependencies } from "../../src/game/engine/rendering/lighting";
import { normalizeNh3dClientOptions, type Nh3dBloodDetailMode } from "../../src/game/ui-types";
import { createEngineSystems } from "../../src/game/engine/create-engine-systems";
import type { EngineCoordinator } from "../../src/game/engine/engine-coordinator";

const output = document.querySelector<HTMLPreElement>("#results")!;
const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")];
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(640, 360);
document.querySelector("#preview")!.append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(45, 640 / 360, 0.1, 100);
camera.position.set(36, -10, 8);
camera.up.set(0, 1, 0);
camera.lookAt(36, -10, 0);

function hash(data: ArrayLike<number>): number {
  let value = 2166136261;
  for (let i = 0; i < data.length; i++) value = Math.imul(value ^ data[i], 16777619) >>> 0;
  return value;
}

async function compareBlood(android: boolean) {
  const baselineUrl = "/.wired-dev/performance/blood-ground.ts";
  const { BloodGround: Baseline } = await import(/* @vite-ignore */ baselineUrl);
  const results: Record<string, unknown>[] = [];
  const detail = document.querySelector<HTMLSelectElement>("#detail")!.value as Nh3dBloodDetailMode;
  for (const [label, Ground] of [["baseline", Baseline], ["current", BloodGround], ["current", BloodGround], ["baseline", Baseline]] as const) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#727882");
    const clientOptions = normalizeNh3dClientOptions({ bloodDetail: detail, bloodGround: true });
    const lighting = new Lighting({ engineState: { clientOptions }, bloodGround: { bloodGroundSpecularReferenceStrength: 2.5 } } as LightingDependencies);
    lighting.vignetteUniforms.uLightingCenter.value.set(36, -10, 0);
    const ground: BloodGround = new Ground({
      engineState: { clientOptions },
      audioHapticsPlatform: { getNativeCapacitorPlatform: () => android ? "android" : null },
      levelTerrainCache: { levelTerrainCachesByName: new Map(), pendingLevelCacheTransition: null },
      lighting, renderPipeline: { scene },
      terminalRendering: { isTerminalDisplayMode: () => false },
      tilesetAssets: { resolveTextureAnisotropyLevel: () => 1 },
    } as BloodGroundDependencies);
    // The explicit path selector also works when this fixture runs on Android.
    ground.shouldUseBloodGroundCompatibilityMode = () => android;
    ground.ensureBloodGroundOverlayResources();
    let canvasCopyBytes = 0;
    const context = ground.bloodGroundUploadContext;
    if (context) {
      const original = context.putImageData.bind(context);
      context.putImageData = (image: ImageData, x: number, y: number, dirtyX?: number, dirtyY?: number, width?: number, height?: number) => {
        if (dirtyX !== undefined && dirtyY !== undefined && width !== undefined && height !== undefined) {
          canvasCopyBytes += width * height * 4;
          original(image, x, y, dirtyX, dirtyY, width, height);
        } else {
          canvasCopyBytes += image.width * image.height * 4;
          original(image, x, y);
        }
      };
    }
    let rasterMs = 0, syncMs = 0, renderSubmitMs = 0, uploadBytes = 0;
    let seed = 0x12345678;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const originalRandom = Math.random;
    try {
      for (let frame = 0; frame < 120; frame++) {
        Math.random = random;
        const beforePaint = performance.now();
        if (frame % 30 === 0) {
          for (let kill = 0; kill < 3; kill++) ground.paintBloodGroundFromDirectHit(35 + kill, 10, 17, "defeat", 1, -0.5);
        }
        if (frame % 30 < 15) {
          for (let impact = 0; impact < 8; impact++) {
            ground.paintBloodGroundFromParticleImpact(35 + impact * 0.3, -10 + frame % 5 * 0.03, 1.2, -0.7, 3, 0.1, 0);
          }
        }
        const beforeSync = performance.now();
        const texture = ground.bloodGroundOverlayTexture!;
        const oldVersion = texture.version;
        ground.syncBloodGroundTexture();
        const beforeRender = performance.now();
        if (texture.version !== oldVersion) {
          uploadBytes += texture.updateRanges.length
            ? texture.updateRanges.reduce((sum, range) => sum + range.count, 0)
            : ground.bloodGroundWidthPx * ground.bloodGroundHeightPx * 4;
        }
        renderer.render(scene, camera);
        rasterMs += beforeSync - beforePaint;
        syncMs += beforeRender - beforeSync;
        renderSubmitMs += performance.now() - beforeRender;
        Math.random = originalRandom;
        if (frame % 30 === 29) await new Promise(requestAnimationFrame);
      }
      results.push({ label, path: android ? "Android canvas" : "desktop DataTexture", detail, frames: 120,
        rasterMs: +rasterMs.toFixed(2), syncMs: +syncMs.toFixed(2), renderSubmitMs: +renderSubmitMs.toFixed(2),
        uploadMiB: +(uploadBytes / 1048576).toFixed(3), canvasCopyMiB: +(canvasCopyBytes / 1048576).toFixed(3),
        densityHash: hash(ground.bloodGroundDensity!), rgbaHash: hash(ground.bloodGroundPixelData!),
      });
    } finally {
      Math.random = originalRandom;
      ground.disposeBloodGroundOverlayResources();
      ground.bloodGroundPlaneGeometry.dispose();
    }
    output.textContent = JSON.stringify(results, null, 2);
  }
  if (results.some(result => result.densityHash !== results[0].densityHash || result.rgbaHash !== results[0].rgbaHash)) {
    throw new Error(`Blood output mismatch:\n${JSON.stringify(results, null, 2)}`);
  }
}

async function compareSignatures() {
  const baselineUrl = "/.wired-dev/performance/level-terrain-cache.ts";
  const { LevelTerrainCache: Baseline } = await import(/* @vite-ignore */ baselineUrl);
  const results = [];
  const signatures = Array.from({ length: 100 }, (_, index) => `${1000 + index}|%40|7|ti:50|si:12|gf:8`);
  for (const [label, Cache] of [["baseline", Baseline], ["current", LevelTerrainCache], ["current", LevelTerrainCache], ["baseline", Baseline]] as const) {
    const cache: LevelTerrainCache = new Cache({} as LevelTerrainCacheDependencies);
    let sum = 0;
    const start = performance.now();
    for (let i = 0; i < 100000; i++) sum += cache.parseTileStateSignature(signatures[i % signatures.length])!.glyph;
    results.push({ label, decodes: 100000, ms: +(performance.now() - start).toFixed(2), checksum: sum });
    await new Promise(requestAnimationFrame);
  }
  output.textContent = JSON.stringify(results, null, 2);
}

function bind(id: string, run: () => Promise<void>) {
  document.getElementById(id)!.addEventListener("click", async () => {
    buttons.forEach(button => button.disabled = true);
    output.textContent = "Running...";
    try { await run(); } catch (error) { output.textContent = String(error); }
    finally { buttons.forEach(button => button.disabled = false); }
  });
}

async function checkPlanarRendering() {
  const systems = createEngineSystems({} as EngineCoordinator);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#243145");
  systems.renderPipeline.scene = scene;
  const view = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
  view.position.set(0, 0, 4);
  view.lookAt(0, 0, 0);
  systems.camera.camera = view;
  const pixels = new Uint8Array(16 * 16 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels.set([230, 25, 55, (i / 4 % 7) * 40], i);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels), 16, 16), 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, alphaTest: 0.1, opacity: 0.7, depthWrite: false }));
  const standing = systems.entityBillboards.ensureMonsterBillboardPitchLockedProxyMesh(sprite)!;
  const flat = systems.entityBillboards.ensureMonsterBillboardFlatProxyMesh(sprite)!;
  standing.position.set(-0.4, 0.15, 0);
  flat.position.set(0.3, -0.2, 0.15);
  flat.rotation.y = 0.3;
  systems.billboardShatter.spawnMonsterBillboardShardParticlesFromDescriptors(sprite, Array.from({ length: 3 }, (_, i) => ({
    texture: texture.clone(), centerU: 0.3 + i * 0.2, centerV: 0.5, widthRatio: 0.5, heightRatio: 0.8, areaRatio: 0.3,
  })));
  const planeMaterials = [standing.material, flat.material, ...systems.bloodParticles.monsterBillboardShardParticles.map(particle => particle.mesh.material)];
  if (planeMaterials.some(material => !material.forceSinglePass)) throw new Error("Effect owner did not select a single pass");
  const occluder = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.5), new THREE.MeshBasicMaterial({ color: "#ccddee" }));
  occluder.position.set(0.2, 0, 0.2);
  scene.add(occluder);
  const target = new THREE.WebGLRenderTarget(128, 128);
  const before = new Uint8Array(128 * 128 * 4);
  const after = new Uint8Array(before.length);
  const results = [];
  try {
    renderer.setRenderTarget(target);
    for (const position of [[0, 0, 4], [0, 0, -4], [3, 2, 4], [-3, -2, -4]]) {
      view.position.set(...position as [number, number, number]);
      view.lookAt(0, 0, 0);
      planeMaterials.forEach(material => { material.forceSinglePass = false; });
      renderer.render(scene, view);
      const previousCalls = renderer.info.render.calls;
      renderer.readRenderTargetPixels(target, 0, 0, 128, 128, before);
      planeMaterials.forEach(material => { material.forceSinglePass = true; });
      renderer.render(scene, view);
      const currentCalls = renderer.info.render.calls;
      renderer.readRenderTargetPixels(target, 0, 0, 128, 128, after);
      let differingBytes = 0, visiblePixels = 0;
      for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) differingBytes++;
      for (let i = 0; i < before.length; i += 4) {
        if (before[i] !== before[0] || before[i + 1] !== before[1] || before[i + 2] !== before[2]) visiblePixels++;
      }
      results.push({ camera: position, previousCalls, currentCalls, differingBytes, visiblePixels });
      if (differingBytes || visiblePixels < 20) throw new Error(`Planar rendering mismatch: ${JSON.stringify(results)}`);
    }
    output.textContent = JSON.stringify(results, null, 2);
  } finally {
    renderer.setRenderTarget(null);
    target.dispose();
    systems.bloodParticles.clearMonsterBillboardShardParticles();
    systems.entityBillboards.disposeMonsterBillboardPitchLockedProxyMesh(sprite);
    systems.entityBillboards.disposeMonsterBillboardFlatProxyMesh(sprite);
    systems.entityBillboards.fpsPitchLockedBillboardGeometry.dispose();
    sprite.material.dispose();
    texture.dispose();
    occluder.geometry.dispose();
    occluder.material.dispose();
  }
}

bind("desktop", () => compareBlood(false));
bind("android", () => compareBlood(true));
bind("signatures", compareSignatures);
bind("planes", checkPlanarRendering);
