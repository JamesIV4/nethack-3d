import { mobileActions } from "../menus/mobile-actions";
import { fallbackExtendedCommandNames } from "../menus/extended-commands";
import { t } from "../shared/translations";
import type { Nethack3DEngineController } from "../../../game/ui-types";

export type CustomAction = { id: string; label: string; kind: "ui" | "quick" | "extended"; value: string };
export function formatActionLabel(label: string): string {
  return label.replace(/(^|[\s/_-])(\p{L})/gu, (_match, separator: string, letter: string) => separator + letter.toLocaleUpperCase());
}
export function actionCatalog(commands: readonly string[]): CustomAction[] {
  const special: CustomAction[] = [
    { id: "character", label: t.dialogs.mobileActions.character, kind: "ui", value: "character" },
    { id: "inventory", label: t.dialogs.mobileActions.inventory, kind: "ui", value: "inventory" },
    { id: "log", label: t.dialogs.mobileActions.log, kind: "ui", value: "log" },
    { id: "menu", label: `${t.dialogs.mobileActions.menu} / ${t.dialogs.mobileActions.actions}`, kind: "ui", value: "menu" },
    { id: "pickup", label: t.dialogs.mobileActions.pickUp, kind: "quick", value: "pickup" },
    { id: "search", label: t.dialogs.mobileActions.search, kind: "quick", value: "search" },
    ...mobileActions.filter(a => a.kind === "quick"),
  ];
  const labels = new Map(mobileActions.filter(a => a.kind === "extended").map(a => [a.value, a.label]));
  // Existing quick-sheet commands are engine-supported aliases even when a
  // runtime's extended-command catalog omits them. Keep defaults available.
  const names = [...new Set([...(commands.length ? commands : fallbackExtendedCommandNames), ...labels.keys()].map(n => n.trim().toLowerCase()))].filter(n => /^[a-z][a-z0-9_-]*$/.test(n));
  return [...special, ...names.map(value => ({ id: `command:${value}`, label: labels.get(value) ?? value, kind: "extended" as const, value }))].map(a => ({ ...a, label: formatActionLabel(a.label) }));
}
export function runCustomCommand(controller: Nethack3DEngineController | null, action: CustomAction): void {
  controller?.dismissFpsCrosshairContextMenu();
  if (action.kind === "quick") controller?.runQuickAction(action.value);
  else if (action.kind === "extended") controller?.runExtendedCommand(action.value);
}
