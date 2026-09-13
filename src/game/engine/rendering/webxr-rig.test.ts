import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createTrackingToGame, tabletopClippingPlanes } from "./webxr-rig";

const player = new THREE.Vector3(30, -10, 0);
const anchor = new THREE.Vector3(2, 1.7, 4);
const heading = new THREE.Quaternion();
function near(actual: THREE.Vector3, expected: THREE.Vector3): void {
  expect(actual.distanceTo(expected)).toBeLessThan(0.00001);
}
describe("direct WebXR tracking rig", () => {
  it("snap-turns right by 45 degrees without translating a room-scale viewer", () => {
    const viewer = anchor.clone().add(new THREE.Vector3(0.3, 0, 0.2));
    const before = createTrackingToGame("first-person", player, anchor, heading, 1, 0.62);
    const rotated = new THREE.Vector3(anchor.x - viewer.x, 0, anchor.z - viewer.z)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
    const nextAnchor = new THREE.Vector3(viewer.x + rotated.x, anchor.y, viewer.z + rotated.z);
    const after = createTrackingToGame("first-person", player, nextAnchor, heading, 1, 0.62, 0, Math.PI / 4);
    near(viewer.clone().applyMatrix4(before.matrix), viewer.clone().applyMatrix4(after.matrix));
    const facing = new THREE.Vector3(0, 0, -1).transformDirection(after.matrix);
    expect(facing.x).toBeCloseTo(Math.SQRT1_2); expect(facing.y).toBeCloseTo(Math.SQRT1_2);
  });
  it("raises the far edge of the board at a 45 degree pitch", () => {
    const rig = createTrackingToGame("tabletop", player, anchor, heading, 1, 0.62, Math.PI / 4);
    const world = rig.matrix.clone().invert();
    const far = player.clone().add(new THREE.Vector3(0, 1, 0)).applyMatrix4(world).sub(rig.tabletop);
    const nearEdge = player.clone().add(new THREE.Vector3(0, -1, 0)).applyMatrix4(world).sub(rig.tabletop);
    expect(far.y).toBeCloseTo(0.11 / Math.sqrt(2));
    expect(nearEdge.y).toBeCloseTo(-0.11 / Math.sqrt(2));
    expect(far.z).toBeLessThan(0);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(world);
    const backingTop = rig.tabletop.clone().addScaledVector(normal, -0.002);
    expect(rig.tabletop.clone().sub(backingTop).dot(normal)).toBeCloseTo(0.002);
  });
  it("places the FPS player at the real floor below the recentered head", () => {
    const rig = createTrackingToGame("first-person", player, anchor, heading, 1, 0.62);
    const gameToTracking = rig.matrix.clone().invert();
    near(player.clone().applyMatrix4(gameToTracking), new THREE.Vector3(2, 0, 4));
    near(anchor.clone().applyMatrix4(rig.matrix), new THREE.Vector3(30, -10, 0.62));
  });
  it("places a miniature horizontal board in front without flattening its depth", () => {
    const rig = createTrackingToGame("tabletop", player, anchor, heading, 1, 0.62);
    const world = rig.matrix.clone().invert();
    near(player.clone().applyMatrix4(world), rig.tabletop);
    const east = player.clone().add(new THREE.Vector3(1, 0, 0)).applyMatrix4(world).sub(rig.tabletop);
    const north = player.clone().add(new THREE.Vector3(0, 1, 0)).applyMatrix4(world).sub(rig.tabletop);
    const up = player.clone().add(new THREE.Vector3(0, 0, 1)).applyMatrix4(world).sub(rig.tabletop);
    near(east, new THREE.Vector3(0.11, 0, 0));
    near(north, new THREE.Vector3(0, 0, -0.11));
    near(up, new THREE.Vector3(0, 0.11, 0));
  });
  it("preserves stereo eye separation and room-scale translation through the camera rig", () => {
    const rig = createTrackingToGame("tabletop", player, anchor, heading, 1, 0.62);
    const left = anchor.clone().add(new THREE.Vector3(-0.032, 0, 0)).applyMatrix4(rig.matrix);
    const right = anchor.clone().add(new THREE.Vector3(0.032, 0, 0)).applyMatrix4(rig.matrix);
    expect(left.distanceTo(right) * rig.scale).toBeCloseTo(0.064);
    expect(left.z).toBeCloseTo(right.z);
  });
  it("recenters heading without mirroring the dungeon", () => {
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const rig = createTrackingToGame("first-person", player, anchor, yaw, 1, 0.62);
    expect(rig.matrix.determinant()).toBeGreaterThan(0);
    const world = rig.matrix.clone().invert();
    const north = player.clone().add(new THREE.Vector3(0, 1, 0)).applyMatrix4(world);
    expect(north.x).toBeLessThan(anchor.x);
    expect(north.y).toBeCloseTo(0);
  });
  it("moves the player under the same anchor without depending on a flat camera", () => {
    const a = createTrackingToGame("tabletop", player, anchor, heading, 1, 0.62);
    const next = player.clone().add(new THREE.Vector3(1, 0, 0));
    const b = createTrackingToGame("tabletop", next, anchor, heading, 1, 0.62);
    near(player.clone().applyMatrix4(a.matrix.clone().invert()), next.applyMatrix4(b.matrix.clone().invert()));
  });
  it("bounds tabletop rendering with GPU clipping planes while preserving vertical walls", () => {
    const planes = tabletopClippingPlanes(player, 1);
    expect(planes.every((plane) => plane.distanceToPoint(player) > 0)).toBe(true);
    expect(planes.every((plane) => plane.distanceToPoint(player.clone().add(new THREE.Vector3(0, 0, 50))) > 0)).toBe(true);
    expect(planes.some((plane) => plane.distanceToPoint(player.clone().add(new THREE.Vector3(13, 0, 0))) < 0)).toBe(true);
  });
});
