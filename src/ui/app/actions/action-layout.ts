import { useSyncExternalStore } from "react";
import { mobileActions } from "../menus/mobile-actions";

export type ActionArea = "mobileHotbar" | "desktopHotbar" | "menuActions";
export type ActionLayout = Record<ActionArea, string[]>;
export const defaultActionLayout: ActionLayout = {
  mobileHotbar: ["character", "inventory", "log", "pickup", "search", "menu"],
  desktopHotbar: ["character", "inventory"],
  menuActions: mobileActions.map(a => a.kind === "extended" ? `command:${a.value}` : a.id),
};
const builtins = new Set(["character", "inventory", "log", "pickup", "search", "menu", "wait", "loot", "open", "extended"]);
export function isActionId(id: unknown): id is string {
  return typeof id === "string" && (builtins.has(id) || /^command:[a-z][a-z0-9_-]{0,79}$/.test(id));
}
export function isActionAllowed(area: ActionArea, id: string): boolean {
  if (area === "mobileHotbar") return true;
  if (area === "desktopHotbar") return !["log", "menu", "extended"].includes(id);
  return !["character", "inventory", "log", "menu"].includes(id);
}
export function normalizeActionLayout(value: unknown): ActionLayout {
  const raw = value && typeof value === "object" ? value as Partial<ActionLayout> : {};
  return Object.fromEntries((Object.keys(defaultActionLayout) as ActionArea[]).map(area => {
    const ids = Array.isArray(raw[area]) ? [...new Set(raw[area].filter(isActionId).filter(id => isActionAllowed(area, id)))].slice(0, 128) : [...defaultActionLayout[area]];
    return [area, ids];
  })) as ActionLayout;
}
export function moveAction(ids: readonly string[], index: number, delta: number): string[] {
  const result = [...ids], to = index + delta;
  if (index < 0 || index >= result.length || to < 0 || to >= result.length) return result;
  [result[index], result[to]] = [result[to], result[index]];
  return result;
}
const key = "nh3d-action-layout-v1";
let current = normalizeActionLayout(null);
try { current = normalizeActionLayout(JSON.parse(localStorage.getItem(key) ?? "null")); } catch { /* Defaults when storage is unavailable. */ }
const listeners = new Set<() => void>();
export const getActionLayout = () => current;
export function setActionLayout(value: ActionLayout): void {
  current = normalizeActionLayout(value);
  try { localStorage.setItem(key, JSON.stringify(current)); } catch { /* Session changes remain usable. */ }
  listeners.forEach(fn => fn());
}
export function useActionLayout(): ActionLayout {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, getActionLayout, getActionLayout);
}
