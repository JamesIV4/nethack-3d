import {
  MobileDismissButton
} from "../../MobileDismissButton";
import {
  t
} from "../shared/translations";
import type { Nethack3DEngineController } from "../../../game/ui-types";


export interface PositionDialogProps {
  positionDialogVisible: boolean;
  isMobileViewport: boolean;
  controller: Nethack3DEngineController | null;
  setPositionRequest: (text: string | null) => void;
  positionRequest: string | null;
  positionInputInstruction: string | null;
}

export function PositionDialog({
  positionDialogVisible,
  isMobileViewport,
  controller,
  setPositionRequest,
  positionRequest,
  positionInputInstruction,
}: PositionDialogProps) {
  return (
    <div
      className={[
        positionDialogVisible ? "is-visible" : "",
        "nh3d-overflow-glow-frame",
      ]
        .filter(Boolean)
        .join(" ")}
      id="position-dialog"
    >
      <div
        className="nh3d-position-dialog-scroll"
        data-nh3d-overflow-glow
        data-nh3d-overflow-glow-host="parent"
      >
        {isMobileViewport && positionDialogVisible ? (
          <MobileDismissButton
            className="nh3d-position-dialog-close"
            label={t.dialogs.positionPrompt.closeLabel}
            onClick={() => {
              controller?.cancelActivePrompt();
              setPositionRequest(null);
            }}
          />
        ) : null}
        {positionRequest ? (
          <div className="nh3d-position-dialog-request">
            {positionRequest}
          </div>
        ) : null}
        {positionInputInstruction ? (
          <div className="nh3d-position-dialog-hint">
            {positionInputInstruction}
          </div>
        ) : null}
      </div>
    </div>
  );
}
