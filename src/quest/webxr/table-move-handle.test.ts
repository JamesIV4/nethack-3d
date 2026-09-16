import * as THREE from "three";
import { expect, it } from "vitest";
import { TableMoveHandle } from "./table-move-handle";

it("moves freely at twice hand displacement and cancels without losing placement", () => {
  const root = new THREE.Group(), handle = new TableMoveHandle(root), hand = {} as XRInputSource;
  handle.begin(hand,new THREE.Vector3(1,2,3));
  handle.move(hand,new THREE.Vector3(1.2,1.5,4));
  expect(handle.offset.x).toBeCloseTo(.4); expect(handle.offset.y).toBeCloseTo(-1); expect(handle.offset.z).toBeCloseTo(2);
  handle.end(hand); handle.move(hand,new THREE.Vector3(99,99,99));
  expect(handle.offset.z).toBeCloseTo(2);
  handle.reset(); expect(handle.offset.length()).toBe(0);
  handle.dispose(); expect(root.children).toHaveLength(0);
});

it("places a horizontal capsule between the board edge and controls without changing table pitch", () => {
  const root = new THREE.Group(), handle = new TableMoveHandle(root);
  const center = new THREE.Vector3(0,1,-1.55), heading = new THREE.Quaternion(), pitch = Math.PI/3;
  handle.place(center,heading,pitch,true);
  const mesh = root.children[0];
  const local = mesh.position.clone().sub(center).applyAxisAngle(new THREE.Vector3(1,0,0),-pitch);
  expect(local.z).toBeGreaterThan(.99); expect(local.z).toBeLessThan(1.29);
  expect(new THREE.Vector3(0,1,0).applyQuaternion(mesh.quaternion).y).toBeCloseTo(0);
  expect(handle.hit(new THREE.Ray(mesh.position.clone().add(new THREE.Vector3(0,0,1)),new THREE.Vector3(0,0,-1)))).not.toBeNull();
  handle.place(center,heading,pitch,false); expect(handle.hit(new THREE.Ray())).toBeNull();
  handle.dispose();
});
