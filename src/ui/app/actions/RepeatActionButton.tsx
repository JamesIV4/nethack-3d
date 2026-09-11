import {
  t
} from "../shared/translations";
import {
  mobileActions
} from "../menus/mobile-actions";
import type { Nethack3DEngineController } from "../../../game/ui-types";


export interface RepeatActionButtonProps {
  mobileTouchUiVisible: boolean;
  repeatActionVisible: boolean;
  controller: Nethack3DEngineController | null;
}

export function RepeatActionButton({
  mobileTouchUiVisible,
  repeatActionVisible,
  controller,
}: RepeatActionButtonProps) {
  return (
    mobileTouchUiVisible && repeatActionVisible ? (
      <button
        className="nh3d-mobile-repeat-button"
        onClick={() => {
          controller?.dismissFpsCrosshairContextMenu();
          controller?.repeatLastAction();
        }}
        type="button"
      >
        {t.dialogs.mobileActions.repeat}
      </button>
    ) : null
  );
}
