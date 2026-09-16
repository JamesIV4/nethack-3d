import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { WorldRaycast } from "./world-raycast";

describe("XR board ray ranges", () => {
  function fixture() {
    const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
    const caster = new THREE.Raycaster(new THREE.Vector3(-5, 0, 0), new THREE.Vector3(1, 0, 0), 0, 20);
    const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 1), new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1)];
    const raycast = new WorldRaycast();
    const add = (x: number, parent: THREE.Object3D = scene) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      mesh.rotation.y = Math.PI / 2; mesh.position.x = x; parent.add(mesh); return mesh;
    };
    const hit = () => { scene.updateMatrixWorld(true); return raycast.intersect(caster, scene, root, planes); };
    return { scene, root, caster, planes, add, hit };
  }

  it("selects the first unclipped hit and restores the original ray range", () => {
    const f = fixture();
    f.add(-3); const wanted = f.add(0); f.add(3);
    expect(f.hit()?.object).toBe(wanted);
    expect(f.caster.near).toBe(0); expect(f.caster.far).toBe(20);
    f.caster.near = 5.5;
    expect(f.hit()).toBeNull();
    expect(f.caster.near).toBe(5.5);
  });

  it("avoids scene raycasts when the controller points away from the board", () => {
    const f = fixture(), raycast = vi.spyOn(f.caster, "intersectObjects");
    f.caster.ray.direction.set(-1, 0, 0);
    expect(f.hit()).toBeNull();
    f.caster.ray.direction.set(0, 1, 0);
    expect(f.hit()).toBeNull();
    expect(raycast).not.toHaveBeenCalled();
    expect(f.caster.near).toBe(0); expect(f.caster.far).toBe(20);
  });

  it("keeps exact boundary hits and first-person picking without clip planes", () => {
    const f = fixture(), boundary = f.add(-1);
    expect(f.hit()?.object).toBe(boundary);
    const outside = f.add(-3); f.planes.length = 0;
    expect(f.hit()?.object).toBe(outside);
  });

  it("omits hidden hierarchies and tracking UI and clears targets on scene changes", () => {
    const f = fixture(), hidden = new THREE.Group(); hidden.visible = false; f.scene.add(hidden);
    const hiddenMesh = f.add(-0.5, hidden), ui = f.add(-0.25, f.root), wanted = f.add(0);
    const hiddenRaycast = vi.spyOn(hiddenMesh, "raycast"), uiRaycast = vi.spyOn(ui, "raycast");
    expect(f.hit()?.object).toBe(wanted);
    expect(hiddenRaycast).not.toHaveBeenCalled(); expect(uiRaycast).not.toHaveBeenCalled();
    f.scene.remove(wanted);
    expect(f.hit()).toBeNull();
    hidden.visible = true;
    expect(f.hit()?.object).toBe(hiddenMesh);
    f.scene.visible = false;
    expect(f.hit()).toBeNull();
  });

  it("restores near/far if a custom raycast throws", () => {
    const f = fixture();
    vi.spyOn(f.caster, "intersectObjects").mockImplementation(() => { throw new Error("raycast failed"); });
    expect(f.hit).toThrow("raycast failed");
    expect(f.caster.near).toBe(0); expect(f.caster.far).toBe(20);
  });
});
