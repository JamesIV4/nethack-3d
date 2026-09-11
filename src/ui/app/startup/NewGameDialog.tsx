import AnimatedDialog from "../../modals/AnimatedDialog";
import type * as React from "react";
import {
  commonStrings,
  t
} from "../shared/translations";
import type { NewGamePromptState } from "../../../game/ui-types";


export interface NewGameDialogProps {
  gameOverDialogShowsTombstone: boolean;
  newGameDialogVisible: boolean;
  handleNewGamePromptKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  setNewGamePrompt: (prompt: NewGamePromptState) => void;
  gameOverTombstoneLines: string[];
  startNewGameFromPrompt: () => void;
  newGamePromptYesButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  dismissNewGamePromptUntilInteraction: () => void;
  newGamePromptNoButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
}

export function NewGameDialog({
  gameOverDialogShowsTombstone,
  newGameDialogVisible,
  handleNewGamePromptKeyDown,
  renderMobileDialogCloseButton,
  setNewGamePrompt,
  gameOverTombstoneLines,
  startNewGameFromPrompt,
  newGamePromptYesButtonRef,
  dismissNewGamePromptUntilInteraction,
  newGamePromptNoButtonRef,
}: NewGameDialogProps) {
  return (
    <AnimatedDialog
      className={`nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-dialog-new-game${gameOverDialogShowsTombstone ? " nh3d-dialog-below-logo" : ""
        }`}
      open={newGameDialogVisible}
      id="new-game-dialog"
      onKeyDown={handleNewGamePromptKeyDown}
    >
      {renderMobileDialogCloseButton(
        () => setNewGamePrompt({ visible: false, reason: null }),
        t.dialogs.newGamePrompt.closeLabel,
      )}
      <div className="nh3d-question-text">
        {t.dialogs.newGamePrompt.title}
      </div>
      {gameOverTombstoneLines.length > 0 ? (
        <pre className="nh3d-game-over-tombstone">
          {gameOverTombstoneLines.join("\n")}
        </pre>
      ) : null}
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button nh3d-menu-action-confirm"
          onClick={startNewGameFromPrompt}
          ref={newGamePromptYesButtonRef}
          type="button"
        >
          {commonStrings.yes}
        </button>
        <button
          className="nh3d-menu-action-button nh3d-menu-action-cancel"
          onClick={dismissNewGamePromptUntilInteraction}
          ref={newGamePromptNoButtonRef}
          type="button"
        >
          {commonStrings.no}
        </button>
      </div>
    </AnimatedDialog>
  );
}
