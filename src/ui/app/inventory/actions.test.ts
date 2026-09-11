import { describe, expect, it } from "vitest";
import { classifyInventoryCategory, getBlockedInventoryActionIdsForCategory, inventoryItemSupportsContextAction, parseInventoryStackCount } from "./actions";

describe("inventory context action eligibility", () => {
  it("recognizes runtime category headings and safely accepts unknown categories", () => {
    expect(classifyInventoryCategory("  Gems and stones:  ")).toBe("gems_stones");
    expect(classifyInventoryCategory("Bagged/Boxed items")).toBe("bagged_boxed_items");
    expect(getBlockedInventoryActionIdsForCategory("Unrecognized category").size).toBe(0);
  });

  it("offers rub for lamps and graystones while rejecting unrelated tools and gems", () => {
    expect(inventoryItemSupportsContextAction("rub", "tools", "a brass lantern")).toBe(true);
    expect(inventoryItemSupportsContextAction("rub", "gems_stones", "2 gray stones")).toBe(true);
    expect(inventoryItemSupportsContextAction("rub", "tools", "a pick-axe")).toBe(false);
    expect(inventoryItemSupportsContextAction("rub", "gems_stones", "a ruby")).toBe(false);
  });

  it("distinguishes container looting from horn tipping", () => {
    expect(inventoryItemSupportsContextAction("loot", "tools", "a bag of holding")).toBe(true);
    expect(inventoryItemSupportsContextAction("tip", "tools", "a horn of plenty")).toBe(true);
    expect(inventoryItemSupportsContextAction("loot", "tools", "a horn of plenty")).toBe(false);
    expect(inventoryItemSupportsContextAction("loot", "weapons", "a chest")).toBe(false);
  });

  it("limits sacrifice and untrap actions to supported item descriptions", () => {
    expect(inventoryItemSupportsContextAction("offer", "comestibles", "a newt corpse")).toBe(true);
    expect(inventoryItemSupportsContextAction("offer", "comestibles", "a food ration")).toBe(false);
    expect(inventoryItemSupportsContextAction("untrap", "potions", "2 potions of oil")).toBe(true);
    expect(inventoryItemSupportsContextAction("untrap", "potions", "a potion of healing")).toBe(false);
  });

  it("allows naming and adjusting regardless of category while restricting call", () => {
    expect(inventoryItemSupportsContextAction("name", null, "unknown object")).toBe(true);
    expect(inventoryItemSupportsContextAction("adjust", "coins", "10 gold pieces")).toBe(true);
    expect(inventoryItemSupportsContextAction("call", "potions", "a smoky potion")).toBe(true);
    expect(inventoryItemSupportsContextAction("call", "coins", "10 gold pieces")).toBe(false);
  });

  it("opens a drop-count choice only for a numeric stack larger than one", () => {
    expect(parseInventoryStackCount("  12 uncursed arrows")).toBe(12);
    for (const text of ["1 arrow", "0 arrows", "an arrow", "+2 arrows", "2d6 dice", ""]) {
      expect(parseInventoryStackCount(text)).toBeNull();
    }
  });
});
