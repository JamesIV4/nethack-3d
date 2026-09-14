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
  it("shares the headset center between eyes and restores flat sprite facing", () => {
    const material = new THREE.SpriteMaterial(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    scene.add(new THREE.Sprite(material)); camera.position.set(2, 3, 4); camera.updateMatrixWorld();
    const patcher = new ScaledCameraSprites(); patcher.prepare(scene, camera);
    const shader = { vertexShader: THREE.ShaderLib.sprite.vertexShader, uniforms: {} } as Parameters<THREE.Material["onBeforeCompile"]>[0];
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.uniforms.nh3dXrOrigin.value.toArray()).toEqual([2, 3, 4]);
    expect(shader.uniforms.nh3dXrFacing.value).toBe(true);
    patcher.disable(); expect(shader.uniforms.nh3dXrFacing.value).toBe(false);
  });
  it("raycasts the spherical billboard plane and restores the caller's camera", () => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial()), scene = new THREE.Scene();
    sprite.position.set(2, 0, 0); scene.add(sprite); scene.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(); camera.position.z = 3; camera.updateMatrixWorld();
    const patcher = new ScaledCameraSprites(); patcher.prepare(scene, camera);
    const raycaster = new THREE.Raycaster(); raycaster.camera = camera;
    const right = new THREE.Vector3(3, 0, 2).normalize();
    const target = sprite.position.clone().addScaledVector(right, .3);
    raycaster.ray.set(camera.position, target.clone().sub(camera.position).normalize());
    const hit = raycaster.intersectObject(sprite)[0];
    expect(hit.point.distanceTo(target)).toBeLessThan(1e-6);
    expect(raycaster.camera).toBe(camera);
    patcher.disable();
    expect(raycaster.intersectObject(sprite)[0].point.z).toBeCloseTo(0);
  });
  it("keeps world-up and sprite hit geometry unchanged when the headset rolls", () => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial()), scene = new THREE.Scene();
    sprite.position.set(2, 1, 0); scene.add(sprite); scene.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, -3, 2); camera.up.set(0, 0, 1);
    camera.lookAt(sprite.position); camera.updateMatrixWorld();
    const patcher = new ScaledCameraSprites(); patcher.prepare(scene, camera);
    const shader = { vertexShader: THREE.ShaderLib.sprite.vertexShader, uniforms: {} } as Parameters<THREE.Material["onBeforeCompile"]>[0];
    sprite.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    const caster = new THREE.Raycaster(camera.position, sprite.position.clone().sub(camera.position).normalize()); caster.camera = camera;
    const point = caster.intersectObject(sprite)[0].point.clone();
    camera.rotateZ(Math.PI / 3); camera.updateMatrixWorld(); patcher.prepare(scene, camera);
    expect(shader.uniforms.nh3dXrUp.value.toArray()).toEqual([0, 0, 1]);
    expect(caster.intersectObject(sprite)[0].point.distanceTo(point)).toBeLessThan(1e-6);
  });
});
