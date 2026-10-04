import { TextEntryDialog } from "../../modals/TextEntryDialog";
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
    <TextEntryDialog
      open={Boolean(textInputRequest)}
      id="text-input-dialog"
      className="nh3d-dialog-text nh3d-dialog-has-mobile-close"
      prompt={textInputRequest?.text ?? ""}
      focusKey={textInputRequest}
      value={textInputValue}
      onChange={setTextInputValue}
      onSubmit={submitTextInput}
      onCancel={() => submitTextInput("")}
      confirmLabel={t.dialogs.textInput.ok}
      cancelLabel={commonStrings.cancel}
      placeholder={textInputRequest?.placeholder ?? t.dialogs.textInput.placeholder}
      maxLength={textInputRequest?.maxLength}
      inputRef={textInputRef}
      closeButton={renderMobileDialogCloseButton(
        () => submitTextInput(""), t.dialogs.textInput.cancelLabel,
      )}
      context={textInputRequest?.contextMessage ? (
        <div className="nh3d-text-input-context" role="note">
          <div className="nh3d-text-input-context-value">{textInputRequest.contextMessage}</div>
        </div>
      ) : null}
    />
  );
}
