import { expect, it, vi } from "vitest";
import { QuestionMenus, type QuestionMenusDependencies } from "./question-menus";
import type { NethackRuntimeVersion } from "../../../runtime/types";

function fixture(version: NethackRuntimeVersion = "3.6.7") {
  const sendInput = vi.fn(), sendInputSequence = vi.fn();
  const questions = new QuestionMenus({
    tilesetAssets: { resolveRuntimeVersion: () => version },
    inputCommands: { menuSelectionInputPrefix: "__MENU_SELECT__:", sendInput, sendInputSequence, updateNumberPadModeFromChoice: vi.fn() },
    audioHapticsPlatform: { maybePlayDrinkSoundForQuestionAnswer: vi.fn() },
  } as unknown as QuestionMenusDependencies);
  questions.isInQuestion = true;
  questions.activeQuestionText = "What do you want to drop?";
  questions.activeQuestionChoices = "ab";
  vi.spyOn(questions, "syncQuestionDialogState").mockImplementation(() => {});
  vi.spyOn(questions, "hideQuestion").mockImplementation(() => {});
  return { questions, sendInput, sendInputSequence };
}

it("steps from no count to one and back to no count", () => {
  const { questions } = fixture();
  expect(questions.getActiveQuestionPendingCount()).toBeNull();
  questions.stepQuestionSelectionCount(1);
  expect(questions.getActiveQuestionPendingCount()).toBe(1);
  questions.stepQuestionSelectionCount(1);
  expect(questions.getActiveQuestionPendingCount()).toBe(2);
  questions.stepQuestionSelectionCount(-1);
  expect(questions.getActiveQuestionPendingCount()).toBe(1);
  questions.stepQuestionSelectionCount(-1);
  expect(questions.getActiveQuestionPendingCount()).toBeNull();
  questions.stepQuestionSelectionCount(-1);
  expect(questions.getActiveQuestionPendingCount()).toBeNull();
});

it.each(["step", "typed"])("submits an explicit one from %s input to the runtime", method => {
  const { questions, sendInput, sendInputSequence } = fixture();
  if (method === "step") questions.stepQuestionSelectionCount(1);
  else questions.setQuestionSelectionCount(1);
  expect(questions.trySubmitSimpleQuestionAnswer("a")).toBe(true);
  expect(sendInputSequence).toHaveBeenCalledExactlyOnceWith(["1", "a"]);
  expect(sendInput).not.toHaveBeenCalled();
  expect(questions.getActiveQuestionPendingCount()).toBeNull();
});

it("encodes one for item menus and removes the prefix when minus clears it", () => {
  const { questions, sendInput, sendInputSequence } = fixture();
  questions.stepQuestionSelectionCount(1);
  expect(questions.encodeMenuSelectionInputWithCount("__MENU_SELECT__:4", questions.consumeActiveQuestionPendingCount())).toBe("__MENU_SELECT__:4:1");
  questions.setQuestionSelectionCount(1);
  questions.stepQuestionSelectionCount(-1);
  questions.trySubmitSimpleQuestionAnswer("a");
  expect(sendInput).toHaveBeenCalledExactlyOnceWith("a");
  expect(sendInputSequence).not.toHaveBeenCalled();
});

it.each(["Pick up what?", "What would you like to pick up?", "What do you want to drop?", "What would you like to drop?",
  "Put in what?", "Take out what?", "What do you want to throw?", "What do you want to charge?",
  "What do you want to ready?", "What do you want to wield?", "What do you want to adjust?", "What do you want to stash?"])("offers quantity for %s", text => {
  expect(fixture().questions.isCountableInventorySelectionQuestion(text)).toBe(true);
});
it.each(["What type of objects?", "Drop what type of items?", "What do you want to eat?", "What do you want to read?", "Choose a role", "Really quit?"])("does not offer an unsupported quantity for %s", text => {
  expect(fixture().questions.isCountableInventorySelectionQuestion(text)).toBe(false);
});
it("respects count support differences between bundled games", () => {
  const slashem = fixture("slashem").questions;
  for (const verb of ["ready", "wield", "adjust", "stash", "fire"]) expect(slashem.isCountableInventorySelectionQuestion(`What do you want to ${verb}?`)).toBe(false);
  expect(slashem.isCountableInventorySelectionQuestion("What do you want to pawn?")).toBe(true);
  expect(fixture("5.0").questions.isCountableInventorySelectionQuestion("What do you want to fire?")).toBe(true);
  expect(fixture().questions.isCountableInventorySelectionQuestion("What do you want to fire?")).toBe(false);
});
