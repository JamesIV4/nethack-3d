import { expect, it } from "vitest";
import { shouldOpenInventoryDropTypeMenuOnHover } from "./InventoryContextMenu";

it("opens Drop choices on hover in both desktop and WebXR", () => {
  expect(shouldOpenInventoryDropTypeMenuOnHover({ classList: { contains: () => false } } as unknown as HTMLElement)).toBe(true);
  expect(shouldOpenInventoryDropTypeMenuOnHover({ classList: { contains: (name: string) => name === "nh3d-webxr-active" } } as unknown as HTMLElement)).toBe(true);
});
