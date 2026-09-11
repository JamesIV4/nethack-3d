import type * as React from "react";
import {
  t
} from "../shared/translations";
import {
  mobileActions
} from "../menus/mobile-actions";
import {
  getWizardCommandCopy
} from "../menus/extended-commands";

export interface WizardCommandsSheetProps {
  wizardCommandsSupported: boolean;
  isWizardCommandsVisible: boolean;
  isDesktopGameRunning: boolean;
  mobileTouchUiVisible: boolean;
  isMobileGameRunning: boolean;
  wizardCommandsSheetRef: React.MutableRefObject<HTMLDivElement | null>;
  closeWizardCommands: () => void;
  wizardExtendedCommandNames: string[];
  runWizardExtendedCommand: (command: string) => void;
}

export function WizardCommandsSheet({
  wizardCommandsSupported,
  isWizardCommandsVisible,
  isDesktopGameRunning,
  mobileTouchUiVisible,
  isMobileGameRunning,
  wizardCommandsSheetRef,
  closeWizardCommands,
  wizardExtendedCommandNames,
  runWizardExtendedCommand,
}: WizardCommandsSheetProps) {
  return (
    wizardCommandsSupported &&
      isWizardCommandsVisible &&
      (isDesktopGameRunning || mobileTouchUiVisible) ? (
      <div
        className={`nh3d-wizard-commands-sheet is-visible ${isMobileGameRunning ? "is-mobile" : "is-desktop"
          }`}
        ref={wizardCommandsSheetRef}
      >
        <div className="nh3d-mobile-actions-title-row">
          <div className="nh3d-mobile-actions-title">
            {t.dialogs.mobileActions.wizardCommands}
          </div>
          <div className="nh3d-mobile-actions-controls">
            <button
              className="nh3d-mobile-actions-close"
              onClick={closeWizardCommands}
              type="button"
            >
              {t.dialogs.mobileActions.close}
            </button>
          </div>
        </div>
        <div className="nh3d-overflow-glow-frame">
          <div
            className="nh3d-mobile-actions-sections nh3d-wizard-commands-sections"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
            onTouchMove={(event) => {
              event.stopPropagation();
            }}
            onWheel={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="nh3d-mobile-actions-section">
              <div className="nh3d-wizard-commands-list">
                {wizardExtendedCommandNames.map((command) => {
                  const commandCopy = getWizardCommandCopy(command);
                  const rawExtendedCommand = `#${command}`;
                  return (
                    <button
                      aria-label={`${commandCopy.name} (${rawExtendedCommand}): ${commandCopy.description}`}
                      className="nh3d-wizard-command-button"
                      key={`wizard-${command}`}
                      onClick={() => runWizardExtendedCommand(command)}
                      type="button"
                    >
                      <span className="nh3d-wizard-command-name">
                        {commandCopy.name}
                        <span className="nh3d-wizard-command-raw">
                          {" "}
                          ({rawExtendedCommand})
                        </span>
                      </span>
                      <span className="nh3d-wizard-command-description">
                        {commandCopy.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null
  );
}
