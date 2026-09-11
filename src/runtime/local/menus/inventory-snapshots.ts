// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeMenuSelection } from "./selection";

export interface RuntimeInventorySnapshotsDependencies {
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "isPrintableAccelerator"
  >;
}

/** Inventory window classification, snapshot eligibility and questionless category inference. */
export class RuntimeInventorySnapshots {
  declare latestInventoryItems: any[];
  declare lastEndedInventoryMenuKind: any;

  constructor(private readonly deps: RuntimeInventorySnapshotsDependencies) {
    this.latestInventoryItems = [];
    this.lastEndedInventoryMenuKind = null;
  }

  hasSelectableInventoryWindowEntries(menuItems) {
    const items = Array.isArray(menuItems) ? menuItems : [];
    const nonCategoryItems = items.filter((item) => item && !item.isCategory);
    return nonCategoryItems.some(
      (item) =>
        this.deps.menuSelection.isPrintableAccelerator(item.originalAccelerator) ||
        (typeof item.identifier === "number" && item.identifier !== 0),
    );
  }

  classifyInventoryWindowMenu(menuItems, menuQuestion = "") {
    const items = Array.isArray(menuItems) ? menuItems : [];
    const nonCategoryItems = items.filter((item) => !item.isCategory);
    const hasSelectableEntries =
      this.hasSelectableInventoryWindowEntries(menuItems);
    const normalizedMenuQuestion =
      typeof menuQuestion === "string" ? menuQuestion.trim() : "";

    if (items.length === 0) {
      return { kind: "inventory", lines: [] };
    }

    const normalizeInfoMenuLine = (value) =>
      String(value || "")
        .replace(/\r/g, "")
        .trimEnd();

    // Help menu's "List of extended commands." flow sometimes arrives as
    // WIN_INVEN with selectable identifiers. Treat it as informational text.
    const normalizedLines = nonCategoryItems
      .map((item) =>
        String(item.text || "")
          .trim()
          .toLowerCase(),
      )
      .filter((text) => text.length > 0);
    const isExtendedCommandsReport = normalizedLines.some((line) =>
      line.includes("extended commands list"),
    );
    if (isExtendedCommandsReport) {
      const lines = nonCategoryItems
        .map((item) => normalizeInfoMenuLine(item.text))
        .filter((text) => text.length > 0);
      return {
        kind: "info_menu",
        title: "NetHack Message",
        lines,
      };
    }

    if (hasSelectableEntries) {
      return { kind: "inventory", lines: [] };
    }

    const orderedLines = items
      .map((item) => normalizeInfoMenuLine(item?.text))
      .filter((text) => text.length > 0);
    const categoryLines = items
      .filter((item) => item && item.isCategory)
      .map((item) => normalizeInfoMenuLine(item.text))
      .filter((text) => text.length > 0);

    if (normalizedMenuQuestion) {
      return {
        kind: "info_menu",
        title: normalizedMenuQuestion,
        lines: orderedLines,
      };
    }

    // NetHack 5.0 routes reports like Ctrl+O dungeon overview through WIN_INVEN
    // even though none of the rows are actually selectable. Preserve category
    // headers for those informational panels instead of treating them as
    // inventory snapshots.
    if (categoryLines.length > 0) {
      if (
        categoryLines.length === 1 &&
        orderedLines.length > 1 &&
        orderedLines[0] === categoryLines[0]
      ) {
        return {
          kind: "info_menu",
          title: categoryLines[0],
          lines: orderedLines.slice(1),
        };
      }
      return {
        kind: "info_menu",
        title: "NetHack Information",
        lines: orderedLines,
      };
    }

    // WIN_INVEN is also used by NetHack for reports like self-knowledge.
    // If entries are non-selectable metadata rows, treat as informational.
    const lines = nonCategoryItems
      .map((item) => normalizeInfoMenuLine(item.text))
      .filter((text) => text.length > 0);
    return { kind: "info_menu", lines };
  }

  isInventorySnapshotEntry(menuItem) {
    if (!menuItem || typeof menuItem !== "object" || menuItem.isCategory) {
      return false;
    }
    if (menuItem.isSelectable === true) {
      return true;
    }
    if (this.deps.menuSelection.isPrintableAccelerator(menuItem.originalAccelerator)) {
      return true;
    }
    if (
      typeof menuItem.identifier === "number" &&
      Number.isFinite(menuItem.identifier) &&
      menuItem.identifier !== 0
    ) {
      return true;
    }
    if (menuItem.isTileApplicable === true) {
      return true;
    }
    if (
      typeof menuItem.tileIndex === "number" &&
      Number.isFinite(menuItem.tileIndex)
    ) {
      return true;
    }
    return false;
  }

  inferQuestionlessInventoryCategories(menuItems) {
    const items = Array.isArray(menuItems) ? menuItems : [];
    if (items.length === 0 || items.some((item) => item && item.isCategory)) {
      return items;
    }

    let didInferCategory = false;
    const inferredItems = items.map((item, index) => {
      if (!item || typeof item !== "object") {
        return item;
      }
      const rawText =
        typeof item.text === "string" ? item.text.replace(/\u0000/g, "") : "";
      if (!rawText.trim()) {
        return item;
      }
      if (rawText.trimStart() !== rawText) {
        return item;
      }
      if (this.isInventorySnapshotEntry(item)) {
        return item;
      }
      const nextVisibleItem = items
        .slice(index + 1)
        .find(
          (candidate) =>
            candidate &&
            typeof candidate.text === "string" &&
            candidate.text.replace(/\u0000/g, "").trim().length > 0,
        );
      if (!this.isInventorySnapshotEntry(nextVisibleItem)) {
        return item;
      }
      didInferCategory = true;
      return {
        ...item,
        isCategory: true,
        isSelectable: false,
        isTileApplicable: false,
        tileIndex: undefined,
      };
    });

    return didInferCategory ? inferredItems : items;
  }
}
