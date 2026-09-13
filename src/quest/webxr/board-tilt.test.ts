import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BoardTilt } from "./board-tilt";

describe("board pitch handle", () => {
  it("provides a hit on empty board space at the separated backing surface", () => {
    const control = new BoardTilt(new THREE.Group());
    const center = new THREE.Vector3(0, 1, -1.5);
    control.place(center, new THREE.Quaternion(), true);
    const normal = new THREE.Vector3(0, Math.SQRT1_2, Math.SQRT1_2);
    const hit = control.surfaceHit(new THREE.Ray(center.clone().add(normal), normal.clone().negate()));
    expect(hit).not.toBeNull();
    expect(hit!.point.clone().sub(center).dot(normal)).toBeCloseTo(-0.002);
    expect(control.surfaceHit(new THREE.Ray(new THREE.Vector3(10, 1, 0), new THREE.Vector3(0, 0, -1)))).toBeNull();
    control.dispose();
  });
  it("starts at 45 degrees and captures a drag until release", () => {
    const root = new THREE.Group(), control = new BoardTilt(root);
    const source = {} as XRInputSource;
    control.place(new THREE.Vector3(0, 1, -1.5), new THREE.Quaternion(), true);
    const ray = new THREE.Ray(new THREE.Vector3(1.62, 1.05, 0), new THREE.Vector3(0, 0, -1));
    expect(control.pitch).toBeCloseTo(Math.PI / 4);
    expect(control.hit(ray)).not.toBeNull();
    const mesh = root.children[0] as THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
    expect(mesh.material.opacity).toBe(0.2);
    control.hover(source, true); expect(mesh.material.opacity).toBe(0.9);
    control.begin(source, ray);
    ray.origin.y += 0.2; control.move(source, ray);
    expect(control.pitch).toBeGreaterThan(Math.PI / 4);
    control.end(source);
    const stopped = control.pitch;
    ray.origin.y += 0.2; control.move(source, ray);
    expect(control.pitch).toBe(stopped); expect(mesh.material.opacity).toBe(0.2);
    control.dispose(); expect(root.children).toHaveLength(0);
  });
  it("ignores the ring hole and prevents pitch from overturning", () => {
    const control = new BoardTilt(new THREE.Group());
    const source = {} as XRInputSource;
    control.place(new THREE.Vector3(0, 1, -1.5), new THREE.Quaternion(), true);
    const ray = new THREE.Ray(new THREE.Vector3(1.53, 1.05, 0), new THREE.Vector3(0, 0, -1));
    expect(control.hit(ray)).toBeNull();
    ray.origin.x += 0.09; control.begin(source, ray);
    ray.origin.y = 20; control.move(source, ray);
    expect(control.pitch).toBeCloseTo(Math.PI * 0.45);
    control.place(new THREE.Vector3(), new THREE.Quaternion(), false);
    expect(control.hit(ray)).toBeNull();
    control.dispose();
  });
});
