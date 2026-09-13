import { expect, it, vi } from "vitest";
import { ControllerGameplay } from "./controller-gameplay";
vi.mock("../../ui-types", () => ({ nh3dCloseControllerActionWheelEventName: "close", nh3dToggleControllerActionWheelEventName: "toggle" }));

it("releases flat controller state without polling when XR owns input", () => {
  const clear = vi.fn();
  const poll = vi.fn(() => { throw new Error("Flat controller must not poll in XR"); });
  const owner = {
    dependencies: {
      engineState: { clientOptions: { controllerEnabled: true } },
      controllerDialogs: { clearControllerDialogDpadRepeat: clear, clearControllerDialogSliderInteraction: clear, resetControllerVirtualCursor: clear },
    },
    getConnectedGamepads: poll,
    clearControllerDirectionPromptPreview: clear, clearControllerMovePreview: clear,
    finishControllerZoomCameraRotation: clear,
    controllerPreviousActionState: { confirm: true }, controllerConfirmRearmPending: true,
  };
  ControllerGameplay.prototype.updateControllerInput.call(owner as unknown as ControllerGameplay, 1 / 90, false);
  expect(poll).not.toHaveBeenCalled();
  expect(clear).toHaveBeenCalled();
  expect(Object.values(owner.controllerPreviousActionState).every((pressed) => !pressed)).toBe(true);
  expect(owner.controllerConfirmRearmPending).toBe(false);
});
