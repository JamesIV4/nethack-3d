import type {
  NethackMenuItem
} from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  t
} from "../shared/translations";

/** Question parsing, legacy runtime choice layouts and inventory selections. */
export const getDirectionHelpText = (
  numberPadModeEnabled: boolean,
  controllerEnabled: boolean,
) =>
  numberPadModeEnabled
    ? controllerEnabled
      ? t.directionHelp.controller
      : t.directionHelp.numpad
    : controllerEnabled
      ? t.directionHelp.controller
      : t.directionHelp.viKeys;

export function expandChoiceSpec(spec: string): string[] {
  const normalized = String(spec || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+or\s+/gi, " ")
    .replace(/[,/|]/g, " ")
    .replace(/\s+/g, "")
    .replace(/[\[\]]/g, "");

  if (!normalized) {
    return [];
  }

  const expanded: string[] = [];
  const seen = new Set<string>();
  const addChoice = (value: string): void => {
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    expanded.push(value);
  };

  const canExpandRange = (start: string, end: string): boolean => {
    const isLower = (value: string) => value >= "a" && value <= "z";
    const isUpper = (value: string) => value >= "A" && value <= "Z";
    const isDigit = (value: string) => value >= "0" && value <= "9";
    return (
      (isLower(start) && isLower(end)) ||
      (isUpper(start) && isUpper(end)) ||
      (isDigit(start) && isDigit(end))
    );
  };

  for (let i = 0; i < normalized.length; i += 1) {
    const current = normalized[i];
    const hasRangeEnd = i + 2 < normalized.length && normalized[i + 1] === "-";

    if (hasRangeEnd) {
      const end = normalized[i + 2];
      if (canExpandRange(current, end)) {
        const startCode = current.charCodeAt(0);
        const endCode = end.charCodeAt(0);
        const step = startCode <= endCode ? 1 : -1;
        for (
          let code = startCode;
          step > 0 ? code <= endCode : code >= endCode;
          code += step
        ) {
          addChoice(String.fromCharCode(code));
        }
        i += 2;
        continue;
      }
    }

    if (current !== "-") {
      addChoice(current);
    }
  }

  return expanded;
}

export function parseQuestionChoices(question: string, choices: string): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  const addChoice = (value: string): void => {
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    merged.push(value);
  };

  for (const choice of expandChoiceSpec(choices)) {
    addChoice(choice);
  }

  const bracketMatch = String(question || "").match(/\[([^\]]+)\]/);
  if (bracketMatch && bracketMatch[1]) {
    for (const choice of expandChoiceSpec(bracketMatch[1])) {
      addChoice(choice);
    }
  }

  return merged;
}

export function isSymbolLookupTextQuestion(
  questionText: string,
  choices: string,
): boolean {
  if (String(choices || "").trim().length > 0) {
    return false;
  }
  const normalizedQuestion = String(questionText || "")
    .trim()
    .toLowerCase();
  return (
    normalizedQuestion === "what do you look for?" ||
    normalizedQuestion === "what do you look for"
  );
}

export function getQuestionBracketChoiceSpec(question: string): string {
  const bracketMatch = String(question || "").match(/\[([^\]]+)\]/);
  return typeof bracketMatch?.[1] === "string"
    ? bracketMatch[1].trim().toLowerCase()
    : "";
}

export function isAdjustLetterQuestionPrompt(questionText: string): boolean {
  return /^adjust letter to what\b/i.test(String(questionText || "").trim());
}

export function isLegacyQuestionChoiceRuntime(
  runtimeVersion: NethackRuntimeVersion,
): boolean {
  return runtimeVersion !== "5.0";
}

export function orderQuestionChoicesForDisplay(
  parsedChoices: string[],
  runtimeVersion: NethackRuntimeVersion,
): string[] {
  if (
    !isLegacyQuestionChoiceRuntime(runtimeVersion) ||
    !parsedChoices.some((choice) => choice.trim() === ".")
  ) {
    return parsedChoices;
  }

  const localActionChoices = parsedChoices.filter(
    (choice) => choice.trim() === ".",
  );
  const remainingChoices = parsedChoices.filter(
    (choice) => choice.trim() !== ".",
  );
  return [...localActionChoices, ...remainingChoices];
}

export function isLegacyInventoryQuestionChoicePrompt(
  questionText: string,
  parsedChoices: string[],
  runtimeVersion: NethackRuntimeVersion,
  isYesNoPrompt: boolean,
): boolean {
  if (isYesNoPrompt || !isLegacyQuestionChoiceRuntime(runtimeVersion)) {
    return false;
  }
  const bracketChoiceSpec = getQuestionBracketChoiceSpec(questionText);
  if (
    bracketChoiceSpec.includes(".") ||
    bracketChoiceSpec.includes(",") ||
    bracketChoiceSpec.includes("?") ||
    bracketChoiceSpec.includes("*")
  ) {
    return true;
  }
  return parsedChoices.some((choice) => {
    const normalizedChoice = choice.trim();
    return (
      normalizedChoice === "." ||
      normalizedChoice === "," ||
      normalizedChoice === "?" ||
      normalizedChoice === "*"
    );
  });
}

export function shouldUseCompactQuestionChoiceLayout(
  questionText: string,
  parsedChoices: string[],
  runtimeVersion: NethackRuntimeVersion,
  isYesNoPrompt: boolean,
): boolean {
  if (
    !Array.isArray(parsedChoices) ||
    parsedChoices.length === 0 ||
    !parsedChoices.every((choice) => choice.trim().length === 1)
  ) {
    return false;
  }
  if (isYesNoPrompt) {
    return true;
  }
  if (isAdjustLetterQuestionPrompt(questionText)) {
    return true;
  }
  if (
    isLegacyInventoryQuestionChoicePrompt(
      questionText,
      parsedChoices,
      runtimeVersion,
      isYesNoPrompt,
    )
  ) {
    return false;
  }
  return parsedChoices.length <= 4;
}

export function isYesNoChoicePrompt(parsedChoices: string[]): boolean {
  if (!Array.isArray(parsedChoices) || parsedChoices.length === 0) {
    return false;
  }

  const normalized = parsedChoices
    .map((choice) =>
      String(choice || "")
        .trim()
        .toLowerCase(),
    )
    .filter((choice) => choice.length > 0);
  if (normalized.length === 0) {
    return false;
  }

  // Include common yes/no prompt auxiliaries so we never map these to inventory labels.
  const allowedChoices = new Set(["y", "n", "a", "q", "#", "?"]);
  const hasYes = normalized.includes("y");
  const hasNo = normalized.includes("n");
  const onlySimpleChoices = normalized.every(
    (choice) => choice.length === 1 && allowedChoices.has(choice),
  );
  return hasYes && hasNo && onlySimpleChoices;
}

export function getInventoryItemForQuestionChoice(
  choice: string,
  inventoryItems: NethackMenuItem[],
): NethackMenuItem | null {
  const normalizedChoice = choice.trim();
  if (!normalizedChoice) {
    return null;
  }
  return (
    inventoryItems.find((item) => {
      if (!item || item.isCategory || typeof item.accelerator !== "string") {
        return false;
      }
      return (
        item.accelerator === normalizedChoice ||
        item.accelerator.toLowerCase() === normalizedChoice.toLowerCase()
      );
    }) ?? null
  );
}

export function buildLegacyInventoryQuestionMenuItems(
  questionText: string,
  parsedChoices: string[],
  inventoryItems: NethackMenuItem[],
  runtimeVersion: NethackRuntimeVersion,
  isYesNoPrompt: boolean,
): NethackMenuItem[] {
  if (
    !isLegacyInventoryQuestionChoicePrompt(
      questionText,
      parsedChoices,
      runtimeVersion,
      isYesNoPrompt,
    )
  ) {
    return [];
  }

  const syntheticMenuItems: NethackMenuItem[] = [];
  for (const choice of parsedChoices) {
    const normalizedChoice = String(choice || "").trim();
    if (normalizedChoice.length !== 1) {
      return [];
    }

    const inventoryItem = getInventoryItemForQuestionChoice(
      normalizedChoice,
      inventoryItems,
    );
    if (!inventoryItem) {
      return [];
    }

    syntheticMenuItems.push({
      ...inventoryItem,
      accelerator: normalizedChoice,
      originalAccelerator:
        inventoryItem.originalAccelerator ?? normalizedChoice,
      selectionInput: normalizedChoice,
      isSelectable: true,
      isCategory: false,
    });
  }

  return syntheticMenuItems;
}

export function getQuestionChoiceLabel(
  questionText: string,
  choice: string,
  inventoryItems: NethackMenuItem[],
  runtimeVersion: NethackRuntimeVersion,
  useInventoryLabels = true,
): string {
  const normalizedChoice = choice.trim();
  if (questionText.includes("Which ring-finger")) {
    if (normalizedChoice === "l") {
      return `l) ${t.dialogs.question.choices.leftRingFinger}`;
    }
    if (normalizedChoice === "r") {
      return `r) ${t.dialogs.question.choices.rightRingFinger}`;
    }
  }

  if (!normalizedChoice) {
    return choice;
  }
  if (isLegacyQuestionChoiceRuntime(runtimeVersion)) {
    if (normalizedChoice === ".") {
      return `.) ${t.dialogs.question.choices.here}`;
    }
    if (normalizedChoice === ",") {
      return `,) ${t.dialogs.question.choices.onGround}`;
    }
    if (normalizedChoice === "?") {
      return `?) ${t.dialogs.question.choices.eligibleItems}`;
    }
    if (normalizedChoice === "*") {
      return `*) ${t.dialogs.question.choices.allInventory}`;
    }
  }
  if (!useInventoryLabels) {
    return normalizedChoice;
  }
  const inventoryItem = getInventoryItemForQuestionChoice(
    normalizedChoice,
    inventoryItems,
  );
  if (!inventoryItem || typeof inventoryItem.text !== "string") {
    return normalizedChoice;
  }
  return `${normalizedChoice}) ${inventoryItem.text.trim()}`;
}

export function getMenuSelectionInput(item: NethackMenuItem): string {
  if (typeof item.selectionInput === "string" && item.selectionInput.trim()) {
    return item.selectionInput;
  }
  return typeof item.accelerator === "string" ? item.accelerator : "";
}

export function isSelectableQuestionMenuItem(item: NethackMenuItem): boolean {
  if (!item || item.isCategory) {
    return false;
  }
  if (typeof item.isSelectable === "boolean") {
    return item.isSelectable;
  }
  if (typeof item.identifier === "number") {
    return item.identifier !== 0;
  }
  return getMenuSelectionInput(item).trim().length > 0;
}

export function isReadOnlyQuestionOptionMenuItem(
  item: NethackMenuItem | null | undefined,
  questionText: string,
): boolean {
  if (!item || item.isCategory || isSelectableQuestionMenuItem(item)) {
    return false;
  }
  const normalizedQuestion = String(questionText || "")
    .trim()
    .toLowerCase();
  if (normalizedQuestion !== "set what options?") {
    return false;
  }
  const menuText = String(item.text || "");
  if (menuText.trim().length === 0) {
    return false;
  }
  // NetHack emits non-modifiable options with indentation and [value] suffix.
  return /^\s{2,}\S.*\[[^\]]+\]\s*$/.test(menuText);
}
