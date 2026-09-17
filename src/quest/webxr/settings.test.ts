import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { normalizeXrSettings, WEBXR_WEAPON_ATTACKS_ENABLED } from "./settings";
import { createTrackingToGame, tabletopClippingPlanes } from "../../game/engine/rendering/webxr-rig";
it("defaults to 150% resolution and bounds persisted values", () => {
  expect(normalizeXrSettings({})).toEqual({ resolution: 1.5, depth: 1, area: 1, scale: 1, swipeSensitivity: 1, swipeAttacks: true, instantMovement: false, rainCount: 1000, rainFallSpeed: 1.5, rainChangeRate: .3 });
  expect(normalizeXrSettings({ resolution: NaN, area: 99, scale: -1, instantMovement: true })).toMatchObject({ resolution: 1.5, area: 2, scale: .5, swipeSensitivity: 1, swipeAttacks: true, instantMovement: true });
});
it("bounds rain counts and rates while allowing an empty field and unchanging letters", () => {
  expect(normalizeXrSettings({ rainCount: 100000, rainFallSpeed: -1, rainChangeRate: NaN })).toMatchObject({ rainCount: 12000, rainFallSpeed: .1, rainChangeRate: .3 });
  expect(normalizeXrSettings({ rainCount: 0, rainChangeRate: 0 })).toMatchObject({ rainCount: 0, rainChangeRate: 0 });
});
it("globally keeps VR weapon attacks disabled independently of saved preferences", () => {
  expect(WEBXR_WEAPON_ATTACKS_ENABLED).toBe(false);
  expect(normalizeXrSettings({ swipeAttacks: true }).swipeAttacks).toBe(true);
});
it.each([{ rainCount: 6000 }, { rainCount: 3000, rainLayoutVersion: 2 }])("reduces saved rain density once and preserves subsequent user changes", async saved => {
  let stored = JSON.stringify(saved);
  vi.stubGlobal("localStorage", { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } });
  try {
    vi.resetModules();
    const settings = await import("./settings");
    expect(settings.getXrSettings().rainCount).toBe(1000);
    settings.setXrSettings({ rainCount: 1500 });
    vi.resetModules();
    expect((await import("./settings")).getXrSettings().rainCount).toBe(1500);
  } finally { vi.unstubAllGlobals(); }
});
it("map area expands the clip boundary independently of tile and world scale", () => {
  const player = new THREE.Vector3(), edge = new THREE.Vector3(20, 0, 0);
  expect(tabletopClippingPlanes(player, 1).every(p => p.distanceToPoint(edge) >= 0)).toBe(false);
  expect(tabletopClippingPlanes(player, 1, 2).every(p => p.distanceToPoint(edge) >= 0)).toBe(true);
  const rig = (scale: number) => createTrackingToGame("tabletop", player, new THREE.Vector3(0, 1.6, 0), new THREE.Quaternion(), 1, .6, Math.PI / 4, 0, scale);
  expect(rig(2).scale).toBe(rig(1).scale * 2);
  expect(rig(2).tabletop).toEqual(rig(1).tabletop);
});
