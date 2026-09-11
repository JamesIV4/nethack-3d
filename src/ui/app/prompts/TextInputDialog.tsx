import AnimatedDialog from "../../modals/AnimatedDialog";
import type * as React from "react";
import {
  commonStrings,
  t
} from "../shared/translations";
import type { TextInputRequestState } from "../../../game/ui-types";


export interface TextInputDialogProps {
  textInputRequest: TextInputRequestState | null;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  submitTextInput: (value: string) => void;
  setTextInputValue: React.Dispatch<React.SetStateAction<string>>;
  textInputValue: string;
  textInputRef: React.MutableRefObject<HTMLInputElement | null>;
}

export function TextInputDialog({
  textInputRequest,
  renderMobileDialogCloseButton,
  submitTextInput,
  setTextInputValue,
  textInputValue,
  textInputRef,
}: TextInputDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-text nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close"
      open={Boolean(textInputRequest)}
      id="text-input-dialog"
    >
      {textInputRequest ? (
        <>
          {renderMobileDialogCloseButton(
            () => submitTextInput(""),
            t.dialogs.textInput.cancelLabel,
          )}
          {textInputRequest.contextMessage ? (
            <div className="nh3d-text-input-context" role="note">
              <div className="nh3d-text-input-context-value">
                {textInputRequest.contextMessage}
              </div>
            </div>
          ) : null}
          <div className="nh3d-question-text">{textInputRequest.text}</div>
          <input
            className="nh3d-text-input"
            maxLength={textInputRequest.maxLength ?? 256}
            onChange={(event) => setTextInputValue(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                event.preventDefault();
                submitTextInput(textInputValue);
              } else if (event.key === "Escape") {
                event.preventDefault();
                submitTextInput("");
              }
            }}
            placeholder={
              textInputRequest.placeholder ?? t.dialogs.textInput.placeholder
            }
            ref={textInputRef}
            type="text"
            value={textInputValue}
          />
          <div className="nh3d-menu-actions">
            <button
              className="nh3d-menu-action-button nh3d-menu-action-confirm"
              onClick={() => submitTextInput(textInputValue)}
              type="button"
            >
              {t.dialogs.textInput.ok}
            </button>
            <button
              className="nh3d-menu-action-button nh3d-menu-action-cancel"
              onClick={() => submitTextInput("")}
              type="button"
            >
              {commonStrings.cancel}
            </button>
          </div>
        </>
      ) : null}
    </AnimatedDialog>
  );
}
