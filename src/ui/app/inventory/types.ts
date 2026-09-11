import type {
  NethackMenuItem
} from "../../../game/ui-types";

/** Inventory action, row gesture and context menu state contracts. */
export type InventoryContextAction = {
  id: string;
  label: string;
  kind?: "quick" | "extended";
  value?: string;
  armInventorySelection?: boolean;
};

export type InventoryContextMenuState = {
  accelerator: string;
  itemText: string;
  x: number;
  y: number;
  anchorCenterX?: number;
  anchorLeftX?: number;
  anchorBottomY?: number;
  anchorRightX?: number;
  anchorTopY?: number;
};

export type InventoryDropCountDialogState = {
  accelerator: string;
  itemText: string;
  maxCount: number;
};

export type InventoryRowPressCandidate = {
  source: "pointer" | "touch";
  pointerId: number;
  accelerator: string;
  item: NethackMenuItem;
  rowElement: HTMLDivElement | null;
  startClientX: number;
  startClientY: number;
  startedAtMs: number;
};

export type InventoryCategoryId =
  | "illegal_objects"
  | "weapons"
  | "armor"
  | "rings"
  | "amulets"
  | "tools"
  | "comestibles"
  | "potions"
  | "scrolls"
  | "spellbooks"
  | "wands"
  | "coins"
  | "gems_stones"
  | "boulders_statues"
  | "iron_balls"
  | "chains"
  | "venoms"
  | "bagged_boxed_items";
