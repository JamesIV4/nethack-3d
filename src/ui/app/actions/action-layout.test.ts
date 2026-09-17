import { afterEach, expect, it, vi } from "vitest";
import { defaultActionLayout, moveAction, normalizeActionLayout } from "./action-layout";
import { actionCatalog, runCustomCommand } from "./action-catalog";
import type { Nethack3DEngineController } from "../../../game/ui-types";
afterEach(() => vi.unstubAllGlobals());

it("restores the original default buttons in their original order", () => {
  expect(normalizeActionLayout(null)).toEqual(defaultActionLayout);
  expect(defaultActionLayout.mobileHotbar).toEqual(["character", "inventory", "log", "pickup", "search", "menu"]);
  expect(defaultActionLayout.desktopHotbar).toEqual(["character", "inventory"]);
  expect(defaultActionLayout.menuActions).toEqual(["wait", "command:zap", "command:cast", "command:kick", "command:read", "command:quaff", "command:eat", "command:glance", "loot", "open", "command:wield", "command:wear", "command:puton", "command:takeoff", "extended"]);
});
it("keeps removals and unavailable commands while rejecting malformed or duplicate saved buttons", () => {
  const value = normalizeActionLayout({ mobileHotbar: [], desktopHotbar: ["command:future", "command:future", null, "bad", "menu"], menuActions: ["inventory", "command:cast", "wait"] });
  expect(value.mobileHotbar).toEqual([]);
  expect(value.desktopHotbar).toEqual(["command:future"]);
  expect(value.menuActions).toEqual(["command:cast", "wait"]);
});
it("reorders without modifying other layouts or overrunning the ends", () => {
  const source = ["search", "command:cast", "menu"];
  expect(moveAction(source, 1, -1)).toEqual(["command:cast", "search", "menu"]);
  expect(moveAction(source, 0, -1)).toEqual(source);
  expect(moveAction(source, 2, 1)).toEqual(source);
  expect(source).toEqual(["search", "command:cast", "menu"]);
});
it("saves layout changes across reloads and persists Restore Defaults", async () => {
  let stored: string | null = null;
  vi.stubGlobal("localStorage", { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } });
  vi.resetModules();
  let store = await import("./action-layout");
  store.setActionLayout({ ...store.getActionLayout(), mobileHotbar: ["command:cast", "menu"], menuActions: [] });
  vi.resetModules(); store = await import("./action-layout");
  expect(store.getActionLayout().mobileHotbar).toEqual(["command:cast", "menu"]);
  expect(store.getActionLayout().menuActions).toEqual([]);
  store.setActionLayout(defaultActionLayout);
  expect(JSON.parse(stored!)).toEqual(defaultActionLayout);
});
it("runs the selected command through existing engine handlers and filters invalid names", () => {
  const catalog = actionCatalog(["CAST", "cast", "zap", "?", "#"]);
  expect(catalog.filter(a => a.id === "command:cast")).toHaveLength(1);
  const controller = { runExtendedCommand: vi.fn(), runQuickAction: vi.fn(), dismissFpsCrosshairContextMenu: vi.fn() };
  runCustomCommand(controller as unknown as Nethack3DEngineController, catalog.find(a => a.id === "command:cast")!);
  expect(controller.runExtendedCommand).toHaveBeenCalledExactlyOnceWith("cast");
  runCustomCommand(controller as unknown as Nethack3DEngineController, catalog.find(a => a.id === "pickup")!);
  expect(controller.runQuickAction).toHaveBeenCalledExactlyOnceWith("pickup");
});
