import {
  createAxisBinding,
  createButtonBinding,
  parseNh3dControllerBinding,
  type Nh3dControllerActionId,
  type Nh3dControllerActionGroupId,
  type Nh3dControllerBinding,
  type Nh3dControllerBindings
} from "../../../game/controller-bindings";

/** Gamepad samples, binding values, remap state and capture thresholds. */
export type ControllerRemapSlotIndex = 0 | 1;

export type ControllerRemapListeningState = {
  actionId: Nh3dControllerActionId;
  slotIndex: ControllerRemapSlotIndex;
  startedAtMs: number;
  blockedBindings: Nh3dControllerBinding[];
};

export const controllerCaptureButtonThreshold = 0.7;

export const controllerCaptureAxisThreshold = 0.72;

export const controllerCaptureIgnoreDurationMs = 150;

export const startupControllerActionThreshold = 0.5;

export const startupControllerScrollSpeedPxPerSec = 1150;

export const startupControllerCursorDeadzone = 0.2;

export const startupControllerCursorSpeedPxPerSec = 820;

export const startupControllerSliderFastStepsPerSec = 13;

export const controllerActionGroupOrder: Nh3dControllerActionGroupId[] = [
  "movement",
  "lookAndCamera",
  "actions",
  "dialogs",
  "system",
];

export const startupControllerNavActionIds: readonly Nh3dControllerActionId[] = [
  "dpad_up",
  "dpad_down",
  "dpad_left",
  "dpad_right",
  "left_stick_up",
  "left_stick_down",
  "left_stick_left",
  "left_stick_right",
  "right_stick_up",
  "right_stick_down",
  "confirm",
  "cancel_or_context",
];

export function getConnectedGamepadsForCapture(): Gamepad[] {
  if (typeof navigator === "undefined" || !navigator.getGamepads) {
    return [];
  }
  const gamepads = navigator.getGamepads();
  if (!gamepads || gamepads.length === 0) {
    return [];
  }
  const connected: Gamepad[] = [];
  for (const gamepad of gamepads) {
    if (gamepad && gamepad.connected) {
      connected.push(gamepad);
    }
  }
  return connected;
}

export function sampleActiveControllerBindingCandidates(
  buttonThreshold: number = controllerCaptureButtonThreshold,
  axisThreshold: number = controllerCaptureAxisThreshold,
): Nh3dControllerBinding[] {
  const gamepads = getConnectedGamepadsForCapture();
  if (gamepads.length === 0) {
    return [];
  }
  const maxMagnitudeByBinding = new Map<Nh3dControllerBinding, number>();
  for (const gamepad of gamepads) {
    const buttons = Array.isArray(gamepad.buttons) ? gamepad.buttons : [];
    for (let buttonIndex = 0; buttonIndex < buttons.length; buttonIndex += 1) {
      const button = buttons[buttonIndex];
      if (!button) {
        continue;
      }
      const rawValue = button.pressed ? 1 : button.value;
      const value =
        typeof rawValue === "number" && Number.isFinite(rawValue)
          ? Math.max(0, Math.min(1, rawValue))
          : 0;
      if (value < buttonThreshold) {
        continue;
      }
      const binding = createButtonBinding(buttonIndex);
      const previousMagnitude = maxMagnitudeByBinding.get(binding) ?? 0;
      if (value > previousMagnitude) {
        maxMagnitudeByBinding.set(binding, value);
      }
    }

    const axes = Array.isArray(gamepad.axes) ? gamepad.axes : [];
    for (let axisIndex = 0; axisIndex < axes.length; axisIndex += 1) {
      const rawAxisValue = axes[axisIndex];
      if (!Number.isFinite(rawAxisValue)) {
        continue;
      }
      const magnitude = Math.abs(rawAxisValue);
      if (magnitude < axisThreshold) {
        continue;
      }
      const direction: -1 | 1 = rawAxisValue < 0 ? -1 : 1;
      const binding = createAxisBinding(axisIndex, direction);
      const previousMagnitude = maxMagnitudeByBinding.get(binding) ?? 0;
      if (magnitude > previousMagnitude) {
        maxMagnitudeByBinding.set(binding, magnitude);
      }
    }
  }
  return [...maxMagnitudeByBinding.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([binding]) => binding);
}

export function getControllerBindingValueFromGamepad(
  gamepad: Gamepad,
  binding: Nh3dControllerBinding | null | undefined,
  axisDeadzone: number = 0.35,
): number {
  if (!binding) {
    return 0;
  }
  const parsedBinding = parseNh3dControllerBinding(binding);
  if (!parsedBinding) {
    return 0;
  }
  if (parsedBinding.kind === "button") {
    const button = gamepad.buttons[parsedBinding.index];
    if (!button) {
      return 0;
    }
    const rawButtonValue = button.pressed ? 1 : button.value;
    if (!Number.isFinite(rawButtonValue)) {
      return 0;
    }
    return Math.max(0, Math.min(1, rawButtonValue));
  }
  const rawAxisValue = gamepad.axes[parsedBinding.index];
  if (!Number.isFinite(rawAxisValue)) {
    return 0;
  }
  const directionalValue = rawAxisValue * parsedBinding.direction;
  if (directionalValue <= axisDeadzone) {
    return 0;
  }
  const normalizedValue =
    (directionalValue - axisDeadzone) / (1 - axisDeadzone);
  return Math.max(0, Math.min(1, normalizedValue));
}

export function getControllerActionValueFromGamepads(
  actionId: Nh3dControllerActionId,
  bindings: Nh3dControllerBindings,
  gamepads: readonly Gamepad[],
): number {
  const slots = bindings[actionId];
  if (!slots) {
    return 0;
  }
  let maxValue = 0;
  for (const gamepad of gamepads) {
    const firstValue = getControllerBindingValueFromGamepad(gamepad, slots[0]);
    const secondValue = getControllerBindingValueFromGamepad(gamepad, slots[1]);
    maxValue = Math.max(maxValue, firstValue, secondValue);
    if (maxValue >= 1) {
      return 1;
    }
  }
  return Math.max(0, Math.min(1, maxValue));
}
