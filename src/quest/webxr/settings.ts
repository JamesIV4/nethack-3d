export interface XrSettings { resolution: number; area: number; scale: number }
const key = "nh3d-webxr-settings";
export function normalizeXrSettings(value: Partial<XrSettings>): XrSettings {
  const limit = (n: unknown, min: number, max: number, fallback: number) => typeof n === "number" && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  return { resolution: limit(value.resolution, .5, 2, 1.5), area: limit(value.area, 1, 2, 1), scale: limit(value.scale, .5, 2, 1) };
}
let current = normalizeXrSettings({});
try { current = normalizeXrSettings(JSON.parse(localStorage.getItem(key) ?? "{}") ?? {}); } catch { /* Use defaults. */ }
const listeners = new Set<() => void>();
export const getXrSettings = (): XrSettings => current;
export function subscribeXrSettings(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function setXrSettings(value: Partial<XrSettings>): void {
  current = normalizeXrSettings({ ...current, ...value });
  try { localStorage.setItem(key, JSON.stringify(current)); } catch { /* Session settings still work. */ }
  listeners.forEach(fn => fn());
}
