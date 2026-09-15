import { describe, expect, it, vi } from "vitest";
import { QuestionMenus, type QuestionMenusDependencies } from "./question-menus";

function fixture(choices = "ynq", defaultChoice = "n") {
  const sendInput = vi.fn();
  const setQuestion = vi.fn();
  const feedback = vi.fn();
  const question = new QuestionMenus({
    inputCommands: {
      sendInput,
      menuSelectionInputPrefix: "__MENU_SELECT__:",
      updateNumberPadModeFromChoice: vi.fn(),
    },
    audioHapticsPlatform: { maybePlayDrinkSoundForQuestionAnswer: feedback },
    engineState: { uiAdapter: { setQuestion } },
    pointerLock: { syncFpsPointerLockForUiState: vi.fn() },
    gameOver: { flushDeferredGameOverUiReveal: vi.fn() },
  } as unknown as QuestionMenusDependencies);
  question.isInQuestion = true;
  question.activeQuestionText = "There is a cave dweller corpse here; eat it?";
  question.activeQuestionChoices = choices;
  question.activeQuestionDefaultChoice = defaultChoice;
  return { question, sendInput, setQuestion, feedback };
}

describe("simple question dialog answer lifecycle", () => {
  it.each(["y", "n", "q"])("keeps the same prompt after invalid keys until %s", answer => {
    const f = fixture();
    for (const key of ["t", "t", "2", "ArrowUp"]) {
      expect(f.question.trySubmitSimpleQuestionAnswer(key)).toBe(false);
      expect(f.question.isInQuestion).toBe(true);
      expect(f.question.activeQuestionText).toBe("There is a cave dweller corpse here; eat it?");
    }
    expect(f.sendInput).not.toHaveBeenCalled();
    expect(f.setQuestion).not.toHaveBeenCalled();
    expect(f.feedback).not.toHaveBeenCalled();
    expect(f.question.trySubmitSimpleQuestionAnswer(answer)).toBe(true);
    expect(f.sendInput).toHaveBeenCalledExactlyOnceWith(answer);
    expect(f.question.isInQuestion).toBe(false);
    expect(f.setQuestion).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("applies the same validation to choice-button/controller submissions", () => {
    const f = fixture();
    f.question.chooseQuestionChoice("t");
    expect(f.question.isInQuestion).toBe(true);
    expect(f.sendInput).not.toHaveBeenCalled();
    f.question.chooseQuestionChoice("Y");
    expect(f.sendInput).toHaveBeenCalledExactlyOnceWith("y");
    expect(f.question.isInQuestion).toBe(false);
  });

  it.each(["Enter", " "])("uses the default for %j", key => {
    const f = fixture();
    expect(f.question.trySubmitSimpleQuestionAnswer(key)).toBe(true);
    expect(f.sendInput).toHaveBeenCalledExactlyOnceWith("n");
  });

  it("keeps waiting on Enter when there is no default", () => {
    const f = fixture("yn", "");
    expect(f.question.trySubmitSimpleQuestionAnswer("Enter")).toBe(false);
    expect(f.question.isInQuestion).toBe(true);
    expect(f.sendInput).not.toHaveBeenCalled();
  });

  it("forwards Escape for the existing runtime cancellation policy", () => {
    const f = fixture();
    expect(f.question.trySubmitSimpleQuestionAnswer("Escape")).toBe(true);
    expect(f.sendInput).toHaveBeenCalledExactlyOnceWith("Escape");
  });

  it.each(["D", "d"])("preserves raw inventory answer %s", answer => {
    const f = fixture("a-zA-Z", "");
    f.question.chooseQuestionChoice(answer);
    expect(f.sendInput).toHaveBeenCalledExactlyOnceWith(answer);
  });

  it("does not submit through the simple-answer path while an inventory menu is active", () => {
    const f = fixture();
    f.question.activeQuestionMenuItems = [{ accelerator: "D", text: "a gem" }];
    expect(f.question.trySubmitSimpleQuestionAnswer("D")).toBe(false);
    expect(f.question.isInQuestion).toBe(true);
    expect(f.sendInput).not.toHaveBeenCalled();
  });
});
