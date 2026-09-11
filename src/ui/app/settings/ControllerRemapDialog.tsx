import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  formatNh3dControllerBindingLabel,
  nh3dControllerActionGroupLabels,
  nh3dControllerActionSpecsByGroup,
  type Nh3dControllerActionId
} from "../../../game/controller-bindings";
import AnimatedDialog from "../../modals/AnimatedDialog";
import type {
  ControllerRemapListeningState,
  ControllerRemapSlotIndex
} from "../controller/binding-capture";
import {
  commonStrings,
  t,
  translationStrings
} from "../shared/translations";
import {
  controllerActionGroupOrder
} from "../controller/binding-capture";

export interface ControllerRemapDialogProps {
  isClientOptionsVisible: boolean;
  isControllerRemapVisible: boolean;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  closeControllerRemapDialog: () => void;
  controllerRemapListening: ControllerRemapListeningState | null;
  controllerRemapListeningActionLabel: string;
  connectedControllerCount: number;
  clientOptionsDraft: Nh3dClientOptions;
  beginControllerBindingCapture: (actionId: Nh3dControllerActionId, slotIndex: ControllerRemapSlotIndex) => void;
  setControllerBindingSlotDraft: (actionId: Nh3dControllerActionId, slotIndex: ControllerRemapSlotIndex, nextBinding: string | null) => void;
  clearControllerBindingCapture: () => void;
  resetControllerBindingsToDefaultsDraft: () => void;
}

export function ControllerRemapDialog({
  isClientOptionsVisible,
  isControllerRemapVisible,
  renderMobileDialogCloseButton,
  closeControllerRemapDialog,
  controllerRemapListening,
  controllerRemapListeningActionLabel,
  connectedControllerCount,
  clientOptionsDraft,
  beginControllerBindingCapture,
  setControllerBindingSlotDraft,
  clearControllerBindingCapture,
  resetControllerBindingsToDefaultsDraft,
}: ControllerRemapDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-options nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-dialog-controller-remap"
      open={isClientOptionsVisible && isControllerRemapVisible}
      id="nh3d-controller-remap-dialog"
    >
      {renderMobileDialogCloseButton(
        closeControllerRemapDialog,
        t.dialogs.clientOptions.controllerRemap.closeLabel,
      )}
      <div className="nh3d-options-title">
        {t.dialogs.clientOptions.controllerRemap.title}
      </div>
      <div className="nh3d-controller-remap-hint">
        {t.dialogs.clientOptions.controllerRemap.hint}
      </div>
      <div className="nh3d-controller-remap-status">
        {controllerRemapListening
          ? t.dialogs.clientOptions.controllerRemap.listeningFor(
            controllerRemapListeningActionLabel,
            controllerRemapListening.slotIndex + 1,
          )
          : connectedControllerCount > 0
            ? translationStrings.controller.controllerDetected(
              connectedControllerCount,
            )
            : translationStrings.controller.noControllerDetected}
      </div>
      <div className="nh3d-overflow-glow-frame nh3d-controller-remap-list-shell">
        <div
          className="nh3d-controller-remap-list"
          data-nh3d-overflow-glow
          data-nh3d-overflow-glow-host="parent"
        >
          {controllerActionGroupOrder.map((group) => (
            <section
              className="nh3d-controller-remap-group"
              key={`controller-remap-group-${group}`}
            >
              <div className="nh3d-controller-remap-group-title">
                {nh3dControllerActionGroupLabels[group]}
              </div>
              {nh3dControllerActionSpecsByGroup[group].map((spec) => {
                const slots = clientOptionsDraft.controllerBindings[
                  spec.id
                ] ?? [null, null];
                return (
                  <div
                    className="nh3d-controller-remap-action-row"
                    key={spec.id}
                  >
                    <div className="nh3d-controller-remap-action-copy">
                      <div className="nh3d-controller-remap-action-label">
                        {spec.label}
                      </div>
                      <div className="nh3d-controller-remap-action-description">
                        {spec.description}
                      </div>
                    </div>
                    <div className="nh3d-controller-remap-slots">
                      {([0, 1] as const).map((slotIndex) => {
                        const binding = slots[slotIndex] ?? null;
                        const listeningForSlot =
                          controllerRemapListening?.actionId === spec.id &&
                          controllerRemapListening?.slotIndex === slotIndex;
                        return (
                          <div
                            className="nh3d-controller-remap-slot"
                            key={`${spec.id}-slot-${slotIndex}`}
                          >
                            <button
                              className={`nh3d-controller-remap-slot-button${listeningForSlot ? " is-listening" : ""
                                }`}
                              onClick={() =>
                                beginControllerBindingCapture(
                                  spec.id,
                                  slotIndex,
                                )
                              }
                              type="button"
                            >
                              <span className="nh3d-controller-remap-slot-label">
                                {translationStrings.controller.slotLabel(
                                  slotIndex,
                                )}
                              </span>
                              <span className="nh3d-controller-remap-slot-value">
                                {listeningForSlot
                                  ? translationStrings.controller.listening
                                  : formatNh3dControllerBindingLabel(binding)}
                              </span>
                            </button>
                            <button
                              className="nh3d-controller-remap-clear-button"
                              onClick={() => {
                                setControllerBindingSlotDraft(
                                  spec.id,
                                  slotIndex,
                                  null,
                                );
                                if (listeningForSlot) {
                                  clearControllerBindingCapture();
                                }
                              }}
                              type="button"
                            >
                              {translationStrings.controller.clear}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button nh3d-menu-action-confirm"
          onClick={closeControllerRemapDialog}
          type="button"
        >
          {commonStrings.done}
        </button>
        <button
          className="nh3d-menu-action-button"
          onClick={resetControllerBindingsToDefaultsDraft}
          type="button"
        >
          {t.dialogs.clientOptions.buttons.resetControllerDefaults}
        </button>
      </div>
    </AnimatedDialog>
  );
}
