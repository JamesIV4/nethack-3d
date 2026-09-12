import { useGameStore } from "../../state/gameStore";
import {
  getTopVisibleControllerDialogElement, getControllerFocusableElements, moveControllerDialogFocus,
  clickFocusedControllerDialogElement, getFocusedControllerRangeInput, stepControllerRangeInput,
} from "../../ui/app/controller/dialog-navigation";
import {
  isQuestNativeAvailable, postQuestNativeMessage, subscribeQuestNativeMessages,
  subscribeQuestNativeState, cancelQuestScene,
} from "./bridge";
import { parseQuestCommand, routeQuestCommand } from "./input";

function editable(element: Element | null): boolean {
  return element instanceof HTMLElement && element.getClientRects().length > 0 &&
    (element.isContentEditable || element.matches("input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select"));
}

export function dispatchQuestKey(key: string): void {
  const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
  const down = new KeyboardEvent("keydown", { key, code: key === " " ? "Space" : key, bubbles: true, cancelable: true });
  target.dispatchEvent(down);
  target.dispatchEvent(new KeyboardEvent("keyup", { key, code: down.code, bubbles: true, cancelable: true }));
  if (down.defaultPrevented) return;
  const dialog = getTopVisibleControllerDialogElement();
  // Synthetic events have no browser default action. Reuse the game's existing
  // controller helpers for focus, button activation and sliders when unhandled.
  if ((key === "Enter" || key === " ") && dialog && !editable(target)) {
    if (!dialog.contains(target) || target === document.body) getControllerFocusableElements(dialog)[0]?.focus();
    clickFocusedControllerDialogElement();
  } else if ((key === "ArrowLeft" || key === "ArrowRight") && getFocusedControllerRangeInput(dialog)) {
    stepControllerRangeInput(getFocusedControllerRangeInput(dialog)!, key === "ArrowLeft" ? -1 : 1);
  } else if (dialog && !editable(target)) {
    const directions: Record<string, "up" | "down" | "left" | "right"> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Tab: "down" };
    const direction = directions[key];
    if (direction) moveControllerDialogFocus(direction);
  }
}

let disposeCurrent: (() => void) | null = null;
export function initializeQuestNative(): () => void {
  if (disposeCurrent) return disposeCurrent;
  if (!isQuestNativeAvailable()) return () => undefined;
  const abort = new AbortController();
  const ready = (): void => {
    postQuestNativeMessage({ version: 1, type: "ready", page: "game" });
  };
  const unsubscribeState = subscribeQuestNativeState((state) => {
    const active = state.ready && state.mode !== "flat";
    document.documentElement.classList.toggle("nh3d-quest-stereo-active", active);
    document.documentElement.dataset.questMode = state.mode;
    const mount = document.querySelector(".nh3d-canvas-root");
    if (active && mount) {
      const canvas = mount.querySelector("canvas");
      console.info("[QuestStereo] UI pane handoff", {
        mode: state.mode,
        background: getComputedStyle(mount).backgroundColor,
        canvasVisibility: canvas ? getComputedStyle(canvas).visibility : "not-mounted",
      });
    }
  });
  const unsubscribeMessages = subscribeQuestNativeMessages((message) => {
    if (message.type !== "command") return;
    const command = parseQuestCommand(message.command);
    const state = useGameStore.getState();
    const result = document.visibilityState === "hidden" ? { accepted: false, reason: "The game is suspended." } :
      command ? routeQuestCommand(command, state, {
        hasBlockingOverlay: Boolean(document.querySelector(
          ".nh3d-dialog.is-visible:not(#direction-dialog):not(#inventory-dialog), .nh3d-mobile-actions-sheet, .nh3d-wizard-commands-sheet.is-visible, .nh3d-mobile-log:not(.nh3d-mobile-log-collapsed)",
        )),
        editableFocused: editable(document.activeElement),
        dispatchKey: dispatchQuestKey,
      }) : { accepted: false, reason: "Unsupported Quest command." };
    postQuestNativeMessage({
      version: 1, type: "command-result", ...result,
      ...(typeof message.id === "string" && message.id.length <= 128 ? { id: message.id } : {}),
    });
  });
  window.addEventListener("pageshow", ready, { signal: abort.signal });
  window.addEventListener("pagehide", () => cancelQuestScene("Quest page hidden."), { signal: abort.signal });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") ready();
    else cancelQuestScene("Quest app suspended.");
  }, { signal: abort.signal });
  ready();
  disposeCurrent = () => {
    abort.abort(); unsubscribeState(); unsubscribeMessages();
    cancelQuestScene("Quest bootstrap disposed.");
    document.documentElement.classList.remove("nh3d-quest-stereo-active");
    delete document.documentElement.dataset.questMode;
    disposeCurrent = null;
  };
  return disposeCurrent;
}
