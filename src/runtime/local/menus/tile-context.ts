// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeInventoryContext } from "./inventory-context";
import type { RuntimeMenuSelection } from "./selection";

export interface RuntimeTileContextMenusDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "runtimeVersion"
  >;
  readonly inventoryContext: Pick<
    RuntimeInventoryContext,
    "hasPendingInventoryContextSelection"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "normalizeQuestionText"
    | "tryAutoSelectMenuItem"
  >;
}

/** NetHack 5 tile-context action selection and mandatory question exceptions. */
export class RuntimeTileContextMenus {
  declare runtime5TileContextAutoPickFirstUntilMs: number;
  declare runtime5TileContextAutoPickFirstWindowMs: number;

  constructor(private readonly deps: RuntimeTileContextMenusDependencies) {
    this.runtime5TileContextAutoPickFirstUntilMs = 0;
    this.runtime5TileContextAutoPickFirstWindowMs = 2000;
  }

  shouldAutoPickFirstRuntime5TileContextAction(menuQuestion, menuItems) {
    if (this.deps.coordinator.runtimeVersion !== "5.0") {
      return false;
    }
    if (this.deps.inventoryContext.hasPendingInventoryContextSelection()) {
      return false;
    }
    if (
      !Number.isFinite(this.runtime5TileContextAutoPickFirstUntilMs) ||
      Date.now() > this.runtime5TileContextAutoPickFirstUntilMs
    ) {
      return false;
    }

    const normalizedQuestion = this.deps.menuSelection.normalizeQuestionText(menuQuestion);
    if (!normalizedQuestion.includes("what do you want to do")) {
      return false;
    }

    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      return false;
    }

    const selectableItems = menuItems.filter((item) => item && !item.isCategory);
    return selectableItems.length > 0;
  }

  doesMenuItemTextContain(menuItem, text) {
    if (!menuItem || typeof text !== "string" || text.length === 0) {
      return false;
    }
    const itemText =
      typeof menuItem.text === "string" ? menuItem.text.toLowerCase() : "";
    return itemText.includes(text.toLowerCase());
  }

  resolveRuntime5TileContextSpecialAutoPickMenuItem(selectableItems) {
    const autoPickRules = [
      {
        requiredTexts: ["Talk to ", "Swap places with "],
        preferredText: "Swap places with ",
      },
    ];

    for (const rule of autoPickRules) {
      const hasRequiredItems = rule.requiredTexts.every((text) =>
        selectableItems.some((item) => this.doesMenuItemTextContain(item, text)),
      );
      if (!hasRequiredItems) {
        continue;
      }

      const preferredItem = selectableItems.find((item) =>
        this.doesMenuItemTextContain(item, rule.preferredText),
      );
      if (preferredItem) {
        return preferredItem;
      }
    }

    return null;
  }

  shouldShowRuntime5TileContextQuestion(selectableItems) {
    const modalRequiredTexts = ["Examine trap"];
    return modalRequiredTexts.some((text) =>
      selectableItems.some((item) => this.doesMenuItemTextContain(item, text)),
    );
  }

  resolveRuntime5TileContextAutoPickMenuItem(menuQuestion, menuItems) {
    if (
      !this.shouldAutoPickFirstRuntime5TileContextAction(
        menuQuestion,
        menuItems,
      )
    ) {
      return null;
    }

    const selectableItems = menuItems.filter((item) => item && !item.isCategory);
    if (this.shouldShowRuntime5TileContextQuestion(selectableItems)) {
      return null;
    }

    const specialPick =
      this.resolveRuntime5TileContextSpecialAutoPickMenuItem(selectableItems);
    return specialPick || selectableItems[0] || null;
  }

  tryAutoPickRuntime5TileContextMenuItem(menuQuestion, menuItems) {
    const autoPickItem = this.resolveRuntime5TileContextAutoPickMenuItem(
      menuQuestion,
      menuItems,
    );
    if (!autoPickItem) {
      return false;
    }

    this.runtime5TileContextAutoPickFirstUntilMs = 0;
    return this.deps.menuSelection.tryAutoSelectMenuItem(
      autoPickItem,
      "runtime 5.0 tile context menu auto-pick",
    );
  }
}
