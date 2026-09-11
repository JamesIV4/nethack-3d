import {
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from "react";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import type {
  Nh3dVersionCheckResult
} from "../../../update/types";
import {
  resolveStartupCreateCharacterOptionSet
} from "../../../game/helpers/startup-character-constraints";
import type * as React from "react";
import type {
  SaveGameRecord
} from "./saved-games";
import type {
  StartupFlowStep
} from "./character-preferences";
import {
  commonStrings,
  t
} from "../shared/translations";
import {
  deleteSavedGame,
  fetchSavedGames
} from "./saved-games";
import type { ConfirmationDialogRequest } from "../../modals/useConfirmationDialog";


export interface UseStartupSelectionDependencies {
  readonly createRole: string;
  readonly createRace: string;
  readonly createGender: string;
  readonly createAlign: string;
  readonly runtimeVersion: NethackRuntimeVersion;
  readonly requestConfirmation: (request: ConfirmationDialogRequest) => Promise<boolean>;
  readonly setSavedGames: React.Dispatch<React.SetStateAction<SaveGameRecord[]>>;
  readonly setStartupFlowStep: React.Dispatch<React.SetStateAction<StartupFlowStep>>;
}

/** Resolves valid character choices and coordinates startup selections. */
export function useStartupSelection(dependencies: UseStartupSelectionDependencies) {
  const {
    createRole,
    createRace,
    createGender,
    createAlign,
    runtimeVersion,
    setSavedGames,
    setStartupFlowStep,
  } = dependencies;

  const [isLoadingSaves, setIsLoadingSaves] = useState(false);

  const startupUpdateCheckStartedRef = useRef(false);

  const [startupUpdateCheck, setStartupUpdateCheck] =
    useState<Nh3dVersionCheckResult | null>(null);

  const [isStartupUpdateDialogVisible, setIsStartupUpdateDialogVisible] =
    useState(false);

  const [startupUpdateDetailsVisible, setStartupUpdateDetailsVisible] =
    useState(false);

  const startupCreateCharacterOptionSet = useMemo(
    () =>
      resolveStartupCreateCharacterOptionSet(
        {
          role: createRole,
          race: createRace,
          gender: createGender,
          align: createAlign,
        },
        runtimeVersion,
      ),
    [createRole, createRace, createGender, createAlign, runtimeVersion],
  );

  const normalizedCreateCharacterSelection =
    startupCreateCharacterOptionSet.selection;

  const handleDeleteSave = async (
    e: ReactMouseEvent<HTMLButtonElement>,
    save: SaveGameRecord,
  ) => {
    e.stopPropagation();
    const confirmed = await dependencies.requestConfirmation({
      title: t.saves.deleteTitle,
      message: t.saves.deleteMessage(save.displayName),
      confirmLabel: commonStrings.delete,
      cancelLabel: commonStrings.cancel,
      confirmClassName: "nh3d-menu-action-cancel",
    });
    if (!confirmed) {
      return;
    }
    await deleteSavedGame(save);
    setSavedGames((prev) => prev.filter((s) => s.key !== save.key));
  };

  const handleResumeClick = async () => {
    setStartupFlowStep("resume");
    setIsLoadingSaves(true);
    try {
      const saves = await fetchSavedGames(runtimeVersion);
      setSavedGames(saves);
    } catch (e) {
      console.error(t.saves.errorLoading, e);
    } finally {
      setIsLoadingSaves(false);
    }
  };
  return {
    isLoadingSaves,
    startupUpdateCheckStartedRef,
    startupUpdateCheck,
    setStartupUpdateCheck,
    isStartupUpdateDialogVisible,
    setIsStartupUpdateDialogVisible,
    startupUpdateDetailsVisible,
    setStartupUpdateDetailsVisible,
    startupCreateCharacterOptionSet,
    normalizedCreateCharacterSelection,
    handleDeleteSave,
    handleResumeClick,
  } as const;
}
