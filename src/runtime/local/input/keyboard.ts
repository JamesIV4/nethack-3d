// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeMapCallbacks } from "../world/map-callbacks";
import type { RuntimeMenuSelection } from "../menus/selection";
import type { RuntimeQuestionInput } from "./questions";
import type { RuntimeCoordinator } from "../runtime-coordinator";

export interface RuntimeKeyboardInputDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
  >;
  readonly mapCallbacks: Pick<
    RuntimeMapCallbacks,
    "playerPosition"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "normalizeQuestionText"
  >;
  readonly questionInput: Pick<
    RuntimeQuestionInput,
    "lastQuestionText"
  >;
}

/** Key encoding, numeric keypad mode and movement-target resolution. */
export class RuntimeKeyboardInput {
  declare numberPadModeEnabled: boolean;
  declare metaInputPrefix: string;
  declare ctrlInputPrefix: string;

  constructor(private readonly deps: RuntimeKeyboardInputDependencies) {
    this.numberPadModeEnabled = true;
    this.metaInputPrefix = "__META__:";
    this.ctrlInputPrefix = "__CTRL__:";
  }

  normalizeInputKey(input) {
    if (input === "\r" || input === "\n") {
      return "Enter";
    }
    return input;
  }

  // Helper method for key processing
  processKey(key) {
    if (
      key === " " ||
      key === "Space" ||
      key === "Spacebar" ||
      key === "." ||
      key === "Period" ||
      key === "Decimal" ||
      key === "NumpadDecimal"
    ) {
      return ".".charCodeAt(0);
    }

    // Translate directional keys based on number_pad mode.
    if (key === "ArrowLeft")
      return (this.numberPadModeEnabled ? "4" : "h").charCodeAt(0);
    if (key === "ArrowRight")
      return (this.numberPadModeEnabled ? "6" : "l").charCodeAt(0);
    if (key === "ArrowUp")
      return (this.numberPadModeEnabled ? "8" : "k").charCodeAt(0);
    if (key === "ArrowDown")
      return (this.numberPadModeEnabled ? "2" : "j").charCodeAt(0);
    if (key === "Numpad1")
      return (this.numberPadModeEnabled ? "1" : "b").charCodeAt(0);
    if (key === "Numpad2")
      return (this.numberPadModeEnabled ? "2" : "j").charCodeAt(0);
    if (key === "Numpad3")
      return (this.numberPadModeEnabled ? "3" : "n").charCodeAt(0);
    if (key === "Numpad4")
      return (this.numberPadModeEnabled ? "4" : "h").charCodeAt(0);
    if (key === "Numpad5")
      return (this.numberPadModeEnabled ? "5" : ".").charCodeAt(0);
    if (key === "Numpad6")
      return (this.numberPadModeEnabled ? "6" : "l").charCodeAt(0);
    if (key === "Numpad7")
      return (this.numberPadModeEnabled ? "7" : "y").charCodeAt(0);
    if (key === "Numpad8")
      return (this.numberPadModeEnabled ? "8" : "k").charCodeAt(0);
    if (key === "Numpad9")
      return (this.numberPadModeEnabled ? "9" : "u").charCodeAt(0);
    if (key === "Enter") return 13;
    if (key === "Escape") return 27;
    if (key.length > 0) return key.charCodeAt(0);
    return 0; // Default for empty/unknown input
  }

  isMetaInput(key) {
    return (
      typeof key === "string" &&
      key.startsWith(this.metaInputPrefix) &&
      key.length > this.metaInputPrefix.length
    );
  }

  isCtrlInput(key) {
    return (
      typeof key === "string" &&
      key.startsWith(this.ctrlInputPrefix) &&
      key.length > this.ctrlInputPrefix.length
    );
  }

  isDirectionalMovementInput(input) {
    if (typeof input !== "string" || input.length === 0) {
      return false;
    }

    if (input.length === 1) {
      const isViDirectionKey = /^[hjklyubn]$/i.test(input);
      if (isViDirectionKey && this.numberPadModeEnabled) {
        return false;
      }

      return (
        input === "h" ||
        input === "j" ||
        input === "k" ||
        input === "l" ||
        input === "y" ||
        input === "u" ||
        input === "b" ||
        input === "n" ||
        input === "H" ||
        input === "J" ||
        input === "K" ||
        input === "L" ||
        input === "Y" ||
        input === "U" ||
        input === "B" ||
        input === "N" ||
        (this.numberPadModeEnabled &&
          (input === "1" ||
            input === "2" ||
            input === "3" ||
            input === "4" ||
            input === "6" ||
            input === "7" ||
            input === "8" ||
            input === "9"))
      );
    }

    return (
      input === "ArrowLeft" ||
      input === "ArrowRight" ||
      input === "ArrowUp" ||
      input === "ArrowDown" ||
      input === "Home" ||
      input === "End" ||
      input === "PageUp" ||
      input === "PageDown" ||
      input === "Numpad1" ||
      input === "Numpad2" ||
      input === "Numpad3" ||
      input === "Numpad4" ||
      input === "Numpad6" ||
      input === "Numpad7" ||
      input === "Numpad8" ||
      input === "Numpad9"
    );
  }

  resolveMovementTargetPositionFromInput(input) {
    const normalized = this.normalizeInputKey(input);
    const originX = Number(this.deps.mapCallbacks.playerPosition?.x);
    const originY = Number(this.deps.mapCallbacks.playerPosition?.y);
    if (!Number.isFinite(originX) || !Number.isFinite(originY)) {
      return null;
    }

    let deltaX = 0;
    let deltaY = 0;
    switch (normalized) {
      case "h":
      case "H":
      case "ArrowLeft":
      case "Numpad4":
      case "4":
        deltaX = -1;
        break;
      case "l":
      case "L":
      case "ArrowRight":
      case "Numpad6":
      case "6":
        deltaX = 1;
        break;
      case "k":
      case "K":
      case "ArrowUp":
      case "Numpad8":
      case "8":
        deltaY = -1;
        break;
      case "j":
      case "J":
      case "ArrowDown":
      case "Numpad2":
      case "2":
        deltaY = 1;
        break;
      case "y":
      case "Y":
      case "Home":
      case "Numpad7":
      case "7":
        deltaX = -1;
        deltaY = -1;
        break;
      case "u":
      case "U":
      case "PageUp":
      case "Numpad9":
      case "9":
        deltaX = 1;
        deltaY = -1;
        break;
      case "b":
      case "B":
      case "End":
      case "Numpad1":
      case "1":
        deltaX = -1;
        deltaY = 1;
        break;
      case "n":
      case "N":
      case "PageDown":
      case "Numpad3":
      case "3":
        deltaX = 1;
        deltaY = 1;
        break;
      default:
        return null;
    }

    return {
      x: Math.trunc(originX) + deltaX,
      y: Math.trunc(originY) + deltaY,
    };
  }

  isNumberPadModeQuestion(question) {
    const normalized = this.deps.menuSelection.normalizeQuestionText(question);
    if (!normalized) {
      return false;
    }
    return normalized.startsWith("select number_pad mode");
  }

  updateNumberPadModeFromInput(input) {
    if (!this.isNumberPadModeQuestion(this.deps.questionInput.lastQuestionText)) {
      return;
    }
    const normalized =
      typeof input === "string" && input.startsWith("Numpad")
        ? input.slice("Numpad".length)
        : input;
    if (normalized === "0") {
      this.numberPadModeEnabled = false;
      return;
    }
    if (normalized === "1" || normalized === "2") {
      this.numberPadModeEnabled = true;
    }
  }

  handleShimNumberPad(args) {
    const [numberPadMode] = args;
    this.numberPadModeEnabled = Number(numberPadMode) !== 0;
    console.log(
      `Number pad mode callback: ${numberPadMode} (enabled=${this.numberPadModeEnabled})`,
    );
    if (this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
        type: "number_pad_mode",
        enabled: this.numberPadModeEnabled,
        mode: numberPadMode,
      });
    }
    return 0;
  }
}
