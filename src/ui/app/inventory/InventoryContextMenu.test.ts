import { expect, it } from "vitest";
import { shouldOpenInventoryDropTypeMenuOnHover } from "./InventoryContextMenu";

it("keeps desktop Drop hover but disables the overlapping popup in WebXR", () => {
  expect(shouldOpenInventoryDropTypeMenuOnHover({ classList: { contains: () => false } } as unknown as HTMLElement)).toBe(true);
  expect(shouldOpenInventoryDropTypeMenuOnHover({ classList: { contains: (name: string) => name === "nh3d-webxr-active" } } as unknown as HTMLElement)).toBe(false);
});
