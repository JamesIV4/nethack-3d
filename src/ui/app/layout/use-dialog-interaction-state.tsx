import { useRef } from "react";
import type { Nh3dControllerActionId } from "../../../game/controller-bindings";
import type { SoundPackDialogActions } from "../../SoundPackSettings";
import { useConfirmationDialog } from "../../modals/useConfirmationDialog";

/** Owns confirmation dialogs, sound-pack actions and startup controller refs. */
export function useDialogInteractionState() {
  const soundPackDialogActionsRef = useRef<SoundPackDialogActions | null>(null);

  const {
    dialog: globalConfirmationDialog,
    requestConfirmation,
    requestConfirmationChoice,
    resolveConfirmation,
  } = useConfirmationDialog();

  const startupControllerPreviousActionActiveRef = useRef<
    Partial<Record<Nh3dControllerActionId, boolean>>
  >({});

  const startupAccordionConfirmReleaseLatchRef = useRef(false);

  const startupControllerSliderInteractionActiveRef = useRef(false);

  const startupControllerSliderStepCarryRef = useRef(0);

  const startupControllerActiveSliderElementRef =
    useRef<HTMLInputElement | null>(null);

  const startupControllerCursorElementRef = useRef<HTMLDivElement | null>(null);

  const startupControllerCursorPulseElementRef = useRef<HTMLDivElement | null>(
    null,
  );

  const startupControllerCursorHighlightElementRef = useRef<HTMLElement | null>(
    null,
  );

  const startupControllerCursorPulseTimerRef = useRef<number | null>(null);

  const startupBuildLabelToastTimerRef = useRef<number | null>(null);
  return {
    soundPackDialogActionsRef,
    globalConfirmationDialog,
    requestConfirmation,
    requestConfirmationChoice,
    resolveConfirmation,
    startupControllerPreviousActionActiveRef,
    startupAccordionConfirmReleaseLatchRef,
    startupControllerSliderInteractionActiveRef,
    startupControllerSliderStepCarryRef,
    startupControllerActiveSliderElementRef,
    startupControllerCursorElementRef,
    startupControllerCursorPulseElementRef,
    startupControllerCursorHighlightElementRef,
    startupControllerCursorPulseTimerRef,
    startupBuildLabelToastTimerRef,
  } as const;
}
