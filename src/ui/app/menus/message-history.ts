import type {
  InfoMenuState
} from "../../../game/ui-types";

/** NetHack message-menu history identity and cache limit. */
export const messageInfoMenuCacheLimit = 50;

export type MessageInfoMenuHistoryState = {
  entries: InfoMenuState[];
  index: number;
};

export function isNetHackMessageInfoMenuTitle(
  title: string | null | undefined,
): boolean {
  return String(title ?? "").trim().toLowerCase() === "nethack message";
}

export function getInfoMenuHistoryEntryKey(menu: InfoMenuState): string {
  return JSON.stringify([
    String(menu.title ?? "").trim(),
    Array.isArray(menu.lines) ? menu.lines : [],
  ]);
}
