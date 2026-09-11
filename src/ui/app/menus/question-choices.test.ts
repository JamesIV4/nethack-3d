import { describe, expect, it } from "vitest";
import {
  buildLegacyInventoryQuestionMenuItems,
  getMenuSelectionInput,
  isReadOnlyQuestionOptionMenuItem,
  isSelectableQuestionMenuItem,
  isYesNoChoicePrompt,
  orderQuestionChoicesForDisplay,
  parseQuestionChoices,
  shouldUseCompactQuestionChoiceLayout,
} from "./question-choices";

describe("question choice interaction contracts", () => {
  it("merges runtime and bracket choices without losing range order or case", () => {
    expect(parseQuestionChoices("Choose [a-cC-A0-2?]", "b, c or $"))
      .toEqual(["b", "c", "$", "a", "C", "B", "A", "0", "1", "2", "?"]);
  });

  it("recognizes yes/no auxiliaries without treating inventory letters as yes/no", () => {
    expect(isYesNoChoicePrompt(["Y", "n", "a", "q", "#", "?"])).toBe(true);
    expect(isYesNoChoicePrompt(["y", "n", "b"])).toBe(false);
  });

  it.each(["3.6.7", "slashem"] as const)("prioritizes the local action only for legacy %s", runtime => {
    expect(orderQuestionChoicesForDisplay(["a", "?", "."], runtime))
      .toEqual([".", "a", "?"]);
    expect(shouldUseCompactQuestionChoiceLayout("Use what? [a?]", ["a", "?"], runtime, false))
      .toBe(false);
  });

  it("keeps the current runtime choice ordering and compact presentation", () => {
    expect(orderQuestionChoicesForDisplay(["a", "?", "."], "5.0"))
      .toEqual(["a", "?", "."]);
    expect(shouldUseCompactQuestionChoiceLayout("Use what? [a?]", ["a", "?"], "5.0", false))
      .toBe(true);
  });

  it("keeps adjust-letter and yes/no prompts compact even with many choices", () => {
    expect(shouldUseCompactQuestionChoiceLayout("Adjust letter to what?", ["a", "b", "c", "d", "e"], "3.6.7", false))
      .toBe(true);
    expect(shouldUseCompactQuestionChoiceLayout("Continue?", ["y", "n", "a", "q", "?"], "slashem", true))
      .toBe(true);
  });

  it("preserves inventory tile metadata and original accelerators in legacy synthetic menus", () => {
    const item = { text: "a dagger", accelerator: "a", originalAccelerator: 97, tileIndex: 40, isTileApplicable: true };
    const [synthetic] = buildLegacyInventoryQuestionMenuItems("Use what? [a?]", ["A"], [item], "3.6.7", false);
    expect(synthetic).toEqual({ ...item, accelerator: "A", selectionInput: "A", isSelectable: true, isCategory: false });
    expect(item.accelerator).toBe("a");
  });

  it("falls back to ordinary choices when any synthetic inventory choice is unresolved", () => {
    const inventory = [{ text: "a dagger", accelerator: "a" }];
    expect(buildLegacyInventoryQuestionMenuItems("Use what? [a?]", ["a", "?"], inventory, "3.6.7", false)).toEqual([]);
    expect(buildLegacyInventoryQuestionMenuItems("Use what? [a?]", ["a"], inventory, "5.0", false)).toEqual([]);
    expect(buildLegacyInventoryQuestionMenuItems("Use what? [a?]", ["a"], inventory, "3.6.7", true)).toEqual([]);
  });

  it("preserves explicit runtime selection inputs and nonselectable decisions", () => {
    expect(getMenuSelectionInput({ accelerator: "a", selectionInput: "2a" })).toBe("2a");
    expect(isSelectableQuestionMenuItem({ accelerator: "a", isSelectable: false })).toBe(false);
    expect(isSelectableQuestionMenuItem({ accelerator: "a", identifier: 0 })).toBe(false);
    expect(isSelectableQuestionMenuItem({ accelerator: "a", identifier: 1 })).toBe(true);
    expect(isSelectableQuestionMenuItem({ isCategory: true, isSelectable: true })).toBe(false);
  });

  it("recognizes read-only option rows only in the options menu", () => {
    const row = { text: "  windowtype [nh3d]", isSelectable: false };
    expect(isReadOnlyQuestionOptionMenuItem(row, "Set what options?")).toBe(true);
    expect(isReadOnlyQuestionOptionMenuItem(row, "Choose an item")).toBe(false);
    expect(isReadOnlyQuestionOptionMenuItem({ ...row, isSelectable: true }, "Set what options?")).toBe(false);
  });
});
