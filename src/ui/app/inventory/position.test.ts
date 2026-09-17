import { afterEach, expect, it, vi } from "vitest";
import { resolveInventoryContextMenuPosition, resolveInventoryDropTypeMenuPosition } from "./position";
afterEach(() => vi.unstubAllGlobals());
function environment(vr: boolean) {
  vi.stubGlobal("window", { innerWidth: 1600, innerHeight: 1000 });
  vi.stubGlobal("document", { documentElement: { classList: { contains: () => vr } } });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "8px" }));
}
it("places the VR menu above its item even when that extends beyond the inventory scroll region", () => {
  environment(true);
  const result = resolveInventoryContextMenuPosition({ accelerator: "a", itemText: "wand", x: 600, y: 500,
    anchorCenterX: 700, anchorTopY: 400, anchorBottomY: 460 }, 260, 220,
    { left: 400, top: 350, right: 1000, bottom: 850 } as DOMRect);
  expect(result).toEqual({ x: 570, y: 180 });
});
it("preserves desktop placement and keeps hover drop choices clear of their button", () => {
  environment(false);
  expect(resolveInventoryContextMenuPosition({ accelerator: "a", itemText: "wand", x: 600, y: 500,
    anchorCenterX: 700, anchorTopY: 400, anchorBottomY: 460 }, 260, 220)).toEqual({ x: 570, y: 460 });
  const drop = resolveInventoryDropTypeMenuPosition({ left: 600, top: 500, width: 90 } as DOMRect, 220, 160);
  expect(drop.y + 160).toBeLessThan(500);
});
it("flips Drop choices below a button near the viewport ceiling instead of covering it", () => {
  environment(true);
  const result = resolveInventoryDropTypeMenuPosition({ left: 600, right: 690, top: 30, bottom: 70, width: 90 } as DOMRect, 220, 160);
  expect(result.y).toBe(76);
});
