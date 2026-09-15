import { describe, expect, it } from "vitest";
import { resolveBoundedQuestionAnswer } from "./question-answer";

describe("bounded yes/no question answers", () => {
  it.each(["yn", "ynq", "ynaq"])("validates %s without inventing answers", choices => {
    for (const input of ["t", "D", "2", "ArrowUp", "Numpad7", "Unidentified"]) {
      expect(resolveBoundedQuestionAnswer(input, choices, "n")).toBeNull();
    }
    for (const input of choices) {
      expect(resolveBoundedQuestionAnswer(input, choices, "n")).toBe(input);
      expect(resolveBoundedQuestionAnswer(input.toUpperCase(), choices, "n")).toBe(input);
    }
  });

  it("preserves explicit uppercase choices before considering lowercase", () => {
    expect(resolveBoundedQuestionAnswer("Y", "yYnN", "n")).toBe("Y");
    expect(resolveBoundedQuestionAnswer("N", "yYnN", "n")).toBe("N");
  });

  it.each(["Enter", "NumpadEnter", "\r", "\n", " ", "Space", "Spacebar"])(
    "%j selects only an available explicit default",
    key => {
      expect(resolveBoundedQuestionAnswer(key, "ynq", "n")).toBe("n");
      expect(resolveBoundedQuestionAnswer(key, "ynq", 121)).toBe("y");
      expect(resolveBoundedQuestionAnswer(key, "ynq", "")).toBeNull();
      expect(resolveBoundedQuestionAnswer(key, "ynq", 0)).toBeNull();
    },
  );

  it.each(["Escape", "\x1b"])("preserves %j for runtime cancellation handling", key => {
    expect(resolveBoundedQuestionAnswer(key, "ynq", "n")).toBe(key);
  });

  it.each(["", "a-zA-Z", "Dd", "yn#", "hjklyubn", "0123456789"])(
    "leaves non-boolean question %j inputs unchanged", choices => {
      for (const key of ["D", "d", "2", "ArrowUp", "Enter"]) {
        expect(resolveBoundedQuestionAnswer(key, choices, "")).toBe(key);
      }
    },
  );
});
