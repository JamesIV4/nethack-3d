import {
  useMemo
} from "react";
import type {
  SaveGameRecord
} from "./saved-games";
import {
  t
} from "../shared/translations";

export interface UseSavedGameSectionsDependencies {
  readonly savedGames: SaveGameRecord[];
}

/** Groups resumable saved games into manual-save and autosave sections. */
export function useSavedGameSections(dependencies: UseSavedGameSectionsDependencies) {
  const {
    savedGames,
  } = dependencies;

  const resumableSavedGames = useMemo(
    () => savedGames.filter((save) => save.isResumable),
    [savedGames],
  );

  // Checkpoint-only autosaves become actionable only when the selected wasm
  // build exposes the browser-side checkpoint resume bridge. The low-level
  // recover_savefile() export alone is not enough because libnhmain can still
  // reach unixunix.c/getlock() before the web host can prepare recovery.
  const savedGameSections = useMemo(
    () =>
      [
        {
          key: "manual" as const,
          label: t.saves.sections.manual,
          saves: resumableSavedGames.filter(
            (save) => save.category === "manual",
          ),
        },
        {
          key: "autosave" as const,
          label: t.saves.sections.autosave,
          saves: resumableSavedGames.filter(
            (save) => save.category === "autosave",
          ),
        },
      ].filter((section) => section.saves.length > 0),
    [resumableSavedGames],
  );
  return {
    savedGameSections,
  } as const;
}
