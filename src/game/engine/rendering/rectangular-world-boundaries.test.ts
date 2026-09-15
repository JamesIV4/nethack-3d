import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PointerTargeting, type PointerTargetingDependencies } from "../input/pointer-targeting";
import { EntityBillboards, type EntityBillboardsDependencies } from "./entity-billboards";
import { Lighting, type LightingDependencies } from "./lighting";
import { DirectionPromptOverlay } from "../../DirectionPromptOverlay";

afterEach(() => vi.restoreAllMocks());

describe("rectangular world coordinate boundaries", () => {
  it.each([0.6, 1, 2])("maps ground hits back to logical tile coordinates at X scale %s", scale => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(3 * scale, -4, 10);
    camera.lookAt(3 * scale, -4, 0); camera.updateMatrixWorld(true);
    const picker = new PointerTargeting({
      camera: { getActiveCamera: () => camera },
      renderPipeline: { renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) } } },
      tilesetAssets: { getWorldTileScaleX: () => scale },
    } as unknown as PointerTargetingDependencies);
    const result = picker.getGridPositionFromClientCoordinates(50, 50)!;
    expect(result.x).toBeCloseTo(3); expect(result.y).toBeCloseTo(4);
  });

  it("uses logical wall-hit coordinates when choosing the neighboring floor", () => {
    const picker = new PointerTargeting({ tilesetAssets: { getWorldTileScaleX: () => 0.6 } } as unknown as PointerTargetingDependencies);
    vi.spyOn(picker, "shouldApplyTilesModeRaycastTargetingRules").mockReturnValue(true);
    vi.spyOn(picker, "getTileTargetFromMesh").mockReturnValue({ x: 3, y: 4 } as any);
    vi.spyOn(picker, "getIntersectionWorldFaceNormal").mockReturnValue(null);
    vi.spyOn(picker, "findPassThroughTargetMeshIntersectionAfterIndex").mockReturnValue(null);
    vi.spyOn(picker, "isTilesModeWallCornerHit").mockReturnValue(false);
    const nearest = vi.spyOn(picker, "findNearestAdjacentFloorMesh").mockReturnValue(null);
    const mesh = new THREE.Mesh(); mesh.userData.isWall = true;
    picker.resolvePreferredTilesModeFloorMeshTarget({ mesh, intersection: { point: new THREE.Vector3(1.8, -4, 0.5) } as any, intersections: [], intersectionIndex: 0 });
    expect(nearest).toHaveBeenCalledWith(3, 4, { worldX: 3, worldY: -4 });
  });

  it("keeps vignette centers and distances in logical coordinates for meshes and sprites", () => {
    const scene = new THREE.Scene(); scene.scale.x = 0.6;
    const lighting = new Lighting({
      renderPipeline: { scene }, engineState: { clientOptions: { bloodStrength: 1 } },
      bloodGround: { bloodGroundSpecularReferenceStrength: 1 }, movementInput: { isFpsMode: () => false },
      playerMovement: { playerPos: { x: 3, y: 4 } },
    } as unknown as LightingDependencies);
    lighting.updateLightingCenter(0);
    expect(lighting.vignetteUniforms.uLightingCenter.value.toArray()).toEqual([3, -4, 0]);
    expect(lighting.vignetteUniforms.uWorldTileScaleX.value).toBe(0.6);
    for (const material of [new THREE.MeshBasicMaterial(), new THREE.SpriteMaterial()]) {
      const base = material instanceof THREE.SpriteMaterial ? THREE.ShaderLib.sprite : THREE.ShaderLib.basic;
      const shader = { uniforms: {}, vertexShader: base.vertexShader, fragmentShader: base.fragmentShader } as Parameters<THREE.Material["onBeforeCompile"]>[0];
      lighting.patchMaterialForVignette(material); material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
      expect(shader.uniforms.uWorldTileScaleX).toBe(lighting.vignetteUniforms.uWorldTileScaleX);
      expect(shader.fragmentShader).toContain("vWorldPos.x / max(uWorldTileScaleX, 0.000001)");
      material.dispose();
    }
    scene.scale.x = 1; lighting.updateLightingCenter(0);
    expect(lighting.vignetteUniforms.uWorldTileScaleX.value).toBe(1);
  });

  it.each([[0.6, 2, -1], [0.6, 0, -1], [0.6, 1, 0], [2, 2, 1], [1, 2, -1]])("faces standing proxies without changing pixel aspect for scale %s and direction %s,%s", (scale, dx, dy) => {
    const scene = new THREE.Scene(); scene.scale.x = scale;
    const billboards = new EntityBillboards({ tilesetAssets: { getWorldTileScaleX: () => scale } } as unknown as EntityBillboardsDependencies);
    const proxy = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
    proxy.position.set(5, -3, 0.5); proxy.up.set(0, 0, 1); scene.add(proxy); scene.updateMatrixWorld(true);
    billboards.faceStandingBillboardProxy(proxy, new THREE.Vector3(dx, dy, 0).normalize());
    scene.updateMatrixWorld(true);
    const normal = new THREE.Vector3(0, 0, 1).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(proxy.matrixWorld));
    expect(normal.distanceTo(new THREE.Vector3(dx * scale, dy, 0).normalize())).toBeLessThan(1e-6);
    const width = new THREE.Vector3(1, 0, 0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(proxy.matrixWorld)).length();
    expect(width).toBeCloseTo(scale);
    proxy.geometry.dispose(); proxy.material.dispose(); billboards.fpsPitchLockedBillboardGeometry.dispose();
  });
});


describe("rectangular-world direction labels", () => {
  it("keeps billboard labels orthonormal while ground indicators follow cell spacing", () => {
    vi.spyOn(DirectionPromptOverlay.prototype as any, "ensureTexturesLoaded").mockResolvedValue(undefined);
    const scene = new THREE.Scene();
    const overlay = new DirectionPromptOverlay(scene);
    const state = overlay as any;
    state.textures = {}; state.visible = true;
    const camera = new THREE.PerspectiveCamera(); camera.position.set(4, -5, 7); camera.lookAt(0, 0, 0);
    const groundMarker = new THREE.Object3D(); groundMarker.position.set(4, -4, 0); state.groundButtonGroup.add(groundMarker);
    overlay.update(camera, 3, 4); scene.updateMatrixWorld(true);
    const before = state.billboardButtonGroup.getWorldPosition(new THREE.Vector3());
    scene.scale.x = 0.6;
    overlay.update(camera, 3, 4, 0.6); scene.updateMatrixWorld(true);
    const matrix = state.billboardButtonGroup.matrixWorld as THREE.Matrix4;
    const right = new THREE.Vector3().setFromMatrixColumn(matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(matrix, 1);
    expect(right.length()).toBeCloseTo(1); expect(up.length()).toBeCloseTo(1); expect(right.dot(up)).toBeCloseTo(0);
    expect(right.distanceTo(new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion))).toBeLessThan(1e-6);
    const after = state.billboardButtonGroup.getWorldPosition(new THREE.Vector3());
    expect(after.x - before.x).toBeCloseTo(3 * 0.6 - 3); expect(after.y).toBeCloseTo(before.y);
    expect(groundMarker.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(2.4);
    scene.scale.x = 1; overlay.update(camera, 3, 4); scene.updateMatrixWorld(true);
    expect(state.billboardButtonGroup.matrixAutoUpdate).toBe(true);
    expect(state.billboardButtonGroup.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(1e-6);
  });
});
