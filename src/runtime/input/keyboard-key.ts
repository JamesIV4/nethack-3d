// Named keys that the game input routes understand. Other DOM key names (for
// example AltGraph, Unidentified, Dead or media keys) are neither commands nor
// text submissions. Text is sent separately using __TEXT_INPUT__:.
const gameInputKeys = new Set([
  "Enter", "Escape", "Backspace",
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "Home", "End", "PageUp", "PageDown",
  "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5",
  "Numpad6", "Numpad7", "Numpad8", "Numpad9", "NumpadDecimal",
  "Space", "Spacebar", "Period", "Decimal",
]);

export function isGameInputKey(input: string): boolean {
  return input.length === 1 || gameInputKeys.has(input);
}
