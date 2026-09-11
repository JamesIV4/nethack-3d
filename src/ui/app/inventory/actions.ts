import type {
  InventoryCategoryId,
  InventoryContextAction
} from "./types";
import {
  t
} from "../shared/translations";

/** Inventory category eligibility, context actions and stack count parsing. */
export const inventoryContextActions: InventoryContextAction[] = [
  { id: "apply", label: t.inventoryContextActions.apply },
  {
    id: "invoke",
    label: t.inventoryContextActions.invoke,
    kind: "extended",
    value: "invoke",
  },
  {
    id: "tip",
    label: t.inventoryContextActions.tip,
    kind: "extended",
    value: "tip",
  },
  {
    id: "loot",
    label: t.inventoryContextActions.loot,
    kind: "extended",
    value: "loot",
    armInventorySelection: false,
  },
  { id: "drop", label: t.inventoryContextActions.drop },
  { id: "eat", label: t.inventoryContextActions.eat },
  { id: "quaff", label: t.inventoryContextActions.quaff },
  { id: "read", label: t.inventoryContextActions.read },
  {
    id: "rub",
    label: t.inventoryContextActions.rub,
    kind: "extended",
    value: "rub",
  },
  { id: "throw", label: t.inventoryContextActions.throw },
  { id: "wield", label: t.inventoryContextActions.wield },
  { id: "quiver", label: t.inventoryContextActions.quiver },
  { id: "wear", label: t.inventoryContextActions.wear },
  { id: "take-off", label: t.inventoryContextActions.takeOff },
  { id: "put-on", label: t.inventoryContextActions.putOn },
  { id: "remove", label: t.inventoryContextActions.remove },
  { id: "zap", label: t.inventoryContextActions.zap },
  {
    id: "untrap",
    label: t.inventoryContextActions.untrap,
    kind: "extended",
    value: "untrap",
    armInventorySelection: false,
  },
  {
    id: "offer",
    label: t.inventoryContextActions.offer,
    kind: "extended",
    value: "offer",
    armInventorySelection: false,
  },
  {
    id: "name",
    label: t.inventoryContextActions.name,
    kind: "extended",
    value: "name",
  },
  {
    id: "call",
    label: t.inventoryContextActions.call,
    kind: "extended",
    value: "call",
  },
  {
    id: "adjust",
    label: t.inventoryContextActions.adjust,
    kind: "extended",
    value: "adjust",
  },
  {
    id: "engrave",
    label: t.inventoryContextActions.engrave,
    kind: "extended",
    value: "engrave",
  },
  {
    id: "dip",
    label: t.inventoryContextActions.dip,
    kind: "extended",
    value: "dip",
  },
  { id: "info", label: t.inventoryContextActions.info },
];

export const emptyInventoryActionIdSet: ReadonlySet<string> = new Set<string>();

export const inventoryCategoryActionBlocklist: Record<
  InventoryCategoryId,
  ReadonlySet<string>
> = {
  illegal_objects: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
  ]),
  weapons: new Set([
    "quaff",
    "eat",
    "read",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
  ]),
  armor: new Set([
    "quaff",
    "eat",
    "read",
    "engrave",
    "put-on",
    "remove",
    "zap",
    "wield",
  ]),
  rings: new Set(["quaff", "wear", "take-off", "zap", "read", "eat", "wield"]),
  amulets: new Set([
    "quaff",
    "wear",
    "take-off",
    "zap",
    "read",
    "eat",
    "wield",
  ]),
  tools: new Set([
    "quaff",
    "wear",
    "take-off",
    "zap",
    "read",
    "put-on",
    "remove",
    "eat",
  ]),
  comestibles: new Set([
    "quaff",
    "read",
    "engrave",
    "wield",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
  ]),
  potions: new Set([
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "read",
    "eat",
  ]),
  scrolls: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "eat",
    "wield",
  ]),
  spellbooks: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "eat",
    "wield",
  ]),
  wands: new Set(["quaff", "wear", "take-off", "put-on", "remove", "wield"]),
  coins: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "read",
    "dip",
    "wield",
  ]),
  gems_stones: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "eat",
    "read",
    "wield",
  ]),
  boulders_statues: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "eat",
    "wield",
  ]),
  iron_balls: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "eat",
    "read",
    "wield",
  ]),
  chains: new Set([
    "quaff",
    "wear",
    "take-off",
    "put-on",
    "remove",
    "zap",
    "engrave",
    "read",
    "wield",
  ]),
  venoms: new Set(["wear", "take-off", "put-on", "remove", "zap"]),
  // Mixed contents; keep this category permissive.
  bagged_boxed_items: emptyInventoryActionIdSet,
};

export function normalizeInventoryCategoryLabel(raw: unknown): string {
  return String(raw || "")
    .replace(/[\s:]+$/g, "")
    .trim();
}

export function classifyInventoryCategory(
  categoryLabel: string,
): InventoryCategoryId | null {
  const normalized =
    normalizeInventoryCategoryLabel(categoryLabel).toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("illegal object")) {
    return "illegal_objects";
  }
  if (normalized.startsWith("weapon")) {
    return "weapons";
  }
  if (normalized.startsWith("armor")) {
    return "armor";
  }
  if (normalized.startsWith("ring")) {
    return "rings";
  }
  if (normalized.startsWith("amulet")) {
    return "amulets";
  }
  if (normalized.startsWith("tool")) {
    return "tools";
  }
  if (normalized.startsWith("comestible")) {
    return "comestibles";
  }
  if (normalized.startsWith("potion")) {
    return "potions";
  }
  if (normalized.startsWith("scroll")) {
    return "scrolls";
  }
  if (normalized.startsWith("spellbook")) {
    return "spellbooks";
  }
  if (normalized.startsWith("wand")) {
    return "wands";
  }
  if (normalized.startsWith("coin")) {
    return "coins";
  }
  if (normalized.includes("gem") || normalized.includes("stone")) {
    return "gems_stones";
  }
  if (normalized.includes("boulder") || normalized.includes("statue")) {
    return "boulders_statues";
  }
  if (normalized.includes("iron ball")) {
    return "iron_balls";
  }
  if (normalized.includes("chain")) {
    return "chains";
  }
  if (normalized.includes("venom")) {
    return "venoms";
  }
  if (normalized.includes("bagged") || normalized.includes("boxed")) {
    return "bagged_boxed_items";
  }
  return null;
}

export function getBlockedInventoryActionIdsForCategory(
  categoryLabel: string,
): ReadonlySet<string> {
  const categoryId = classifyInventoryCategory(categoryLabel);
  if (!categoryId) {
    return emptyInventoryActionIdSet;
  }
  return (
    inventoryCategoryActionBlocklist[categoryId] ?? emptyInventoryActionIdSet
  );
}

// NetHack 3.6.7 #rub accepts:
// - TOOL_CLASS: oil lamp, magic lamp, brass lantern
// - GEM_CLASS: graystones (luckstone/loadstone/touchstone/flint, including "gray stone")
export function inventoryItemSupportsRub(
  categoryId: InventoryCategoryId | null,
  itemText: string,
): boolean {
  const normalizedText = String(itemText || "")
    .trim()
    .toLowerCase();
  if (!normalizedText) {
    return false;
  }

  const isLampOrLantern =
    /\b(?:oil lamp|magic lamp|brass lantern|lamp|lantern)s?\b/i.test(
      normalizedText,
    );
  const isGraystone =
    /\b(?:gray stone(?:s)?|luckstone(?:s)?|loadstone(?:s)?|touchstone(?:s)?|flint(?: stones?)?)\b/i.test(
      normalizedText,
    );

  if (categoryId === "tools") {
    return isLampOrLantern;
  }
  if (categoryId === "gems_stones") {
    return isGraystone;
  }
  if (categoryId === "bagged_boxed_items" || !categoryId) {
    return isLampOrLantern || isGraystone;
  }
  return false;
}

export function inventoryItemLooksLikeContainer(itemText: string): boolean {
  return /\b(?:sack|bag|box|chest|ice box|large box|bag of holding|oilskin sack)s?\b/i.test(
    itemText,
  );
}

export function inventoryItemSupportsTip(
  categoryId: InventoryCategoryId | null,
  itemText: string,
): boolean {
  const normalizedText = String(itemText || "")
    .trim()
    .toLowerCase();
  if (!normalizedText) {
    return false;
  }

  const isHornOfPlenty = /\bhorn of plenty\b/i.test(normalizedText);
  if (isHornOfPlenty) {
    return true;
  }

  if (categoryId === "tools" || categoryId === "bagged_boxed_items") {
    return inventoryItemLooksLikeContainer(normalizedText);
  }
  return false;
}

export function inventoryItemSupportsLoot(
  categoryId: InventoryCategoryId | null,
  itemText: string,
): boolean {
  if (categoryId !== "tools" && categoryId !== "bagged_boxed_items") {
    return false;
  }
  return inventoryItemLooksLikeContainer(String(itemText || "").toLowerCase());
}

export function inventoryItemSupportsUntrap(itemText: string): boolean {
  const normalizedText = String(itemText || "")
    .trim()
    .toLowerCase();
  if (!normalizedText) {
    return false;
  }
  return /\b(?:can of grease|potion(?:s)? of oil)\b/i.test(normalizedText);
}

export function inventoryItemSupportsOffer(itemText: string): boolean {
  const normalizedText = String(itemText || "")
    .trim()
    .toLowerCase();
  if (!normalizedText) {
    return false;
  }
  return /\b(?:corpse|(?:fake )?amulet of yendor)\b/i.test(normalizedText);
}

export function inventoryItemSupportsInvoke(
  categoryId: InventoryCategoryId | null,
  itemText: string,
): boolean {
  const normalizedText = String(itemText || "")
    .trim()
    .toLowerCase();
  if (!normalizedText) {
    return false;
  }

  if (
    /\b(?:crystal ball|magic lamp|oil lamp|brass lantern|mirror|bell of opening|candelabrum of invocation|book of the dead|(?:fake )?amulet of yendor)\b/i.test(
      normalizedText,
    )
  ) {
    return true;
  }

  return (
    categoryId === "weapons" ||
    categoryId === "armor" ||
    categoryId === "rings" ||
    categoryId === "amulets" ||
    categoryId === "tools" ||
    categoryId === "spellbooks"
  );
}

export function inventoryItemSupportsCall(
  categoryId: InventoryCategoryId | null,
): boolean {
  return (
    categoryId === "scrolls" ||
    categoryId === "potions" ||
    categoryId === "wands" ||
    categoryId === "rings" ||
    categoryId === "amulets" ||
    categoryId === "gems_stones" ||
    categoryId === "spellbooks" ||
    categoryId === "armor" ||
    categoryId === "tools"
  );
}

export function parseInventoryStackCount(itemText: string): number | null {
  const normalized = String(itemText || "").trim();
  if (!normalized) {
    return null;
  }
  const match = normalized.match(/^(\d+)\b/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed <= 1) {
    return null;
  }
  return parsed;
}

export function inventoryItemSupportsContextAction(
  actionId: string,
  categoryId: InventoryCategoryId | null,
  itemText: string,
): boolean {
  switch (actionId) {
    case "rub":
      return inventoryItemSupportsRub(categoryId, itemText);
    case "tip":
      return inventoryItemSupportsTip(categoryId, itemText);
    case "loot":
      return inventoryItemSupportsLoot(categoryId, itemText);
    case "invoke":
      return inventoryItemSupportsInvoke(categoryId, itemText);
    case "offer":
      return inventoryItemSupportsOffer(itemText);
    case "untrap":
      return inventoryItemSupportsUntrap(itemText);
    case "call":
      return inventoryItemSupportsCall(categoryId);
    case "name":
    case "adjust":
      return true;
    default:
      return true;
  }
}
