import { describe, expect, it, vi } from "vitest";
import { QuestionMenus, type QuestionMenusDependencies } from "./question-menus";

const arrow = { accelerator: "d", menuIndex: 0, text: "an arrow" };
const gem = { accelerator: "D", menuIndex: 1, text: "a gem" };

function fixture() {
  const sendInput = vi.fn();
  const questions = new QuestionMenus({
    inputCommands: { menuSelectionInputPrefix: "__MENU_SELECT__:", sendInput, updateNumberPadModeFromChoice: vi.fn() },
  } as unknown as QuestionMenusDependencies);
  questions.isInQuestion = true;
  return { questions, sendInput };
}

describe("inventory menu accelerator case", () => {
  it.each([["D", arrow], ["d", gem]])("does not choose another object when %s is absent", (key, otherItem) => {
    const { questions, sendInput } = fixture();
    questions.activeQuestionMenuItems = [otherItem];
    questions.chooseQuestionChoice(key);
    expect(sendInput).not.toHaveBeenCalled();
    expect(questions.isInQuestion).toBe(true);
  });

  it("resolves both cases and explicit menu indexes to their own objects", () => {
    const { questions } = fixture();
    questions.activeQuestionMenuItems = [arrow, gem];
    expect(questions.findActiveMenuItemBySelectionInput("d")).toBe(arrow);
    expect(questions.findActiveMenuItemBySelectionInput("D")).toBe(gem);
    expect(questions.findActiveMenuItemBySelectionInput("__MENU_SELECT__:1")).toBe(gem);
  });
});
