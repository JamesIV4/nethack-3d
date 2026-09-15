import { expect, it } from "vitest";
import * as THREE from "three";
import { normalizeXrSettings } from "./settings";
import { createTrackingToGame, tabletopClippingPlanes } from "../../game/engine/rendering/webxr-rig";
it("defaults to 150% resolution and bounds persisted values", () => {
  expect(normalizeXrSettings({})).toEqual({ resolution: 1.5, area: 1, scale: 1, swipeSensitivity: 1, swipeAttacks: true });
  expect(normalizeXrSettings({ resolution: NaN, area: 99, scale: -1 })).toEqual({ resolution: 1.5, area: 2, scale: .5, swipeSensitivity: 1, swipeAttacks: true });
});
it("map area expands the clip boundary independently of tile and world scale", () => {
  const player = new THREE.Vector3(), edge = new THREE.Vector3(20, 0, 0);
  expect(tabletopClippingPlanes(player, 1).every(p => p.distanceToPoint(edge) >= 0)).toBe(false);
  expect(tabletopClippingPlanes(player, 1, 2).every(p => p.distanceToPoint(edge) >= 0)).toBe(true);
  const rig = (scale: number) => createTrackingToGame("tabletop", player, new THREE.Vector3(0, 1.6, 0), new THREE.Quaternion(), 1, .6, Math.PI / 4, 0, scale);
  expect(rig(2).scale).toBe(rig(1).scale * 2);
  expect(rig(2).tabletop).toEqual(rig(1).tabletop);
});
