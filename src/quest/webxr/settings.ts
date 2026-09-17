export interface XrSettings { resolution: number; depth: number; area: number; scale: number; swipeSensitivity: number; swipeAttacks: boolean; instantMovement: boolean; rainCount: number; rainFallSpeed: number; rainChangeRate: number }
/** Kept separate from the saved preference so VR attacks can be paused globally. */
export const WEBXR_WEAPON_ATTACKS_ENABLED = false;
const key = "nh3d-webxr-settings";
export function normalizeXrSettings(value: Partial<XrSettings>): XrSettings {
  const limit = (n: unknown, min: number, max: number, fallback: number) => typeof n === "number" && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  return { resolution: limit(value.resolution, .5, 2, 1.5), depth: limit(value.depth, .5, 1.5, 1), area: limit(value.area, 1, 2, 1), scale: limit(value.scale, .5, 2, 1), swipeSensitivity: limit(value.swipeSensitivity, .5, 2.5, 1), swipeAttacks: value.swipeAttacks !== false, instantMovement: value.instantMovement === true,
    rainCount: Math.round(limit(value.rainCount, 0, 12000, 1000)),
    rainFallSpeed: limit(value.rainFallSpeed, .1, 8, 1.5),
    rainChangeRate: limit(value.rainChangeRate, 0, 10, .3),
  };
}
let current = normalizeXrSettings({});
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? "{}") ?? {};
  if (typeof saved.rainCount === "number") {
    if ((saved.rainLayoutVersion ?? 1) < 2) saved.rainCount /= 2;
    if ((saved.rainLayoutVersion ?? 1) < 3) saved.rainCount /= 3;
  }
  current = normalizeXrSettings(saved);
  localStorage.setItem(key, JSON.stringify({ ...current, rainLayoutVersion: 3 }));
} catch { /* Use defaults. */ }
const listeners = new Set<() => void>();
export const getXrSettings = (): XrSettings => current;
export function subscribeXrSettings(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function setXrSettings(value: Partial<XrSettings>): void {
  current = normalizeXrSettings({ ...current, ...value });
  try { localStorage.setItem(key, JSON.stringify({ ...current, rainLayoutVersion: 3 })); } catch { /* Session settings still work. */ }
  listeners.forEach(fn => fn());
}
