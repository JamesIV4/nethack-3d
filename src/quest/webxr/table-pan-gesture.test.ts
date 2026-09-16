import * as THREE from "three";
import { expect, it } from "vitest";
import { TablePanGesture } from "./table-pan-gesture";

it("uses a physical deadzone and keeps the press plane stable as the rendered rig pans", () => {
  const pan = new TablePanGesture();
  const transform = new THREE.Matrix4().makeScale(10, 10, 10);
  const ray = new THREE.Ray(new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1));
  pan.begin(ray, transform);
  ray.origin.x = .01; expect(pan.update(ray)).toBeNull();
  ray.origin.x = .02; expect(pan.update(ray)?.x).toBeCloseTo(.2);
  transform.makeTranslation(99, 99, 0);
  ray.origin.x = .03; expect(pan.update(ray)?.x).toBeCloseTo(.1);
  expect(pan.dragged).toBe(true);
  pan.cancel(); expect(pan.update(ray)).toBeNull(); expect(pan.dragged).toBe(false);
});

it("does not jump when the pointer becomes parallel to the board", () => {
  const pan = new TablePanGesture();
  const ray = new THREE.Ray(new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1));
  pan.begin(ray, new THREE.Matrix4());
  ray.direction.set(1,0,0); expect(pan.update(ray)).toBeNull();
  expect(pan.dragged).toBe(false);
});
