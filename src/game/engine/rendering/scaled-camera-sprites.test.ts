import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { ScaledCameraSprites } from "./scaled-camera-sprites";
import { createTrackingToGame } from "./webxr-rig";
import { gameFrameTime } from "./frame-time";

describe("scaled XR camera rendering", () => {
  it("matches sprite footprint to the mesh tile at tabletop scale", () => {
    const rig = createTrackingToGame("tabletop", new THREE.Vector3(), new THREE.Vector3(0, 1.6, 0), new THREE.Quaternion(), 1, 0.62);
    const view = rig.matrix.clone().invert();
    const cameraScale = new THREE.Vector3().setFromMatrixColumn(view, 0).length();
    expect(cameraScale).toBeCloseTo(0.11);
    const tileWidth = new THREE.Vector3(1, 0, 0).transformDirection(view).multiplyScalar(rig.scale).length();
    expect(1 * cameraScale).toBeCloseTo(tileWidth);
  });
  it("preserves existing material shader hooks and dynamic cache keys", () => {
    const material = new THREE.SpriteMaterial();
    let revision = 1;
    material.customProgramCacheKey = () => "lighting-" + revision;
    const previous = vi.fn((shader) => { shader.vertexShader += "\n// existing-lighting"; });
    material.onBeforeCompile = previous;
    const patcher = new ScaledCameraSprites();
    patcher.patch(material);
    const shader = { vertexShader: THREE.ShaderLib.sprite.vertexShader, uniforms: {} } as Parameters<THREE.Material["onBeforeCompile"]>[0];
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(previous).toHaveBeenCalledTimes(1);
    expect(shader.vertexShader).toContain("// existing-lighting");
    expect(shader.vertexShader).toContain("scale *= length( viewMatrix[ 0 ].xyz )");
    revision = 2;
    expect(material.customProgramCacheKey()).toContain("lighting-2");
    const hook = material.onBeforeCompile, version = material.version;
    patcher.patch(material);
    expect(material.onBeforeCompile).toBe(hook);
    expect(material.version).toBe(version);
  });
  it("keeps game effect age continuous when Gecko starts a new XR clock", () => {
    const revealStarted = 19_000;
    expect(gameFrameTime(25, true, 19_120) - revealStarted).toBe(120);
    expect(gameFrameTime(19_200, false, 19_202) - revealStarted).toBe(200);
  });
});
