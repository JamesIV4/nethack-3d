/** Validate ordinary yes/no prompts without changing inventory, direction or
 * numeric-count question contracts. null means keep waiting for an answer. */
export function resolveBoundedQuestionAnswer(
  input: string,
  choices: string,
  defaultChoice: string | number,
): string | null {
  const lowerChoices = choices.toLowerCase();
  if (!/^[ynqa]+$/i.test(choices) || !lowerChoices.includes("y") || !lowerChoices.includes("n")) {
    return input;
  }
  // Cancellation remains the responsibility of the runtime's existing
  // default/no/quit policy.
  if (input === "Escape" || input === "\x1b") {
    return input;
  }
  let answer = input;
  if (["Enter", "NumpadEnter", "\r", "\n", " ", "Space", "Spacebar"].includes(input)) {
    answer = typeof defaultChoice === "number"
      ? (defaultChoice > 0 ? String.fromCharCode(defaultChoice) : "")
      : defaultChoice;
  }
  if (answer.length !== 1) {
    return null;
  }
  if (choices.includes(answer)) {
    return answer;
  }
  const lowerAnswer = answer.toLowerCase();
  return choices.includes(lowerAnswer) ? lowerAnswer : null;
}
