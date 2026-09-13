import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BoardTilt } from "./board-tilt";

function aim(mesh: THREE.Object3D, angle: number, radius = 0.18): THREE.Ray {
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
  const point = new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0).applyQuaternion(mesh.quaternion).add(mesh.position);
  return new THREE.Ray(point.add(normal), normal.negate());
}

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
    const mesh = root.children[0] as THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
    const ray = aim(mesh, 0);
    expect(control.pitch).toBeCloseTo(Math.PI / 4);
    expect(control.hit(ray)).not.toBeNull();
    expect(mesh.geometry.parameters.radius).toBe(0.18);
    expect(new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion).distanceTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(0.00001);
    expect(mesh.material.opacity).toBe(0.2);
    control.hover(source, true); expect(mesh.material.opacity).toBe(0.9);
    control.begin(source, ray);
    control.move(source, aim(mesh, 0.3));
    expect(control.pitch).toBeGreaterThan(Math.PI / 4);
    control.end(source);
    const stopped = control.pitch;
    control.move(source, aim(mesh, 0.6));
    expect(control.pitch).toBe(stopped); expect(mesh.material.opacity).toBe(0.2);
    control.dispose(); expect(root.children).toHaveLength(0);
  });
  it("ignores the ring hole and prevents pitch from overturning", () => {
    const root = new THREE.Group(), control = new BoardTilt(root);
    const source = {} as XRInputSource;
    control.place(new THREE.Vector3(0, 1, -1.5), new THREE.Quaternion(), true);
    const ray = aim(root.children[0], 0, 0);
    expect(control.hit(ray)).toBeNull();
    control.begin(source, aim(root.children[0], 0));
    control.move(source, aim(root.children[0], 2));
    expect(control.pitch).toBeCloseTo(Math.PI * 0.45);
    control.place(new THREE.Vector3(), new THREE.Quaternion(), false);
    expect(control.hit(ray)).toBeNull();
    control.dispose();
  });
});
