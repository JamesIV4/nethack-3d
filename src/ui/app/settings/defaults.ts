import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  defaultNh3dClientOptions,
  normalizeNh3dClientOptions
} from "../../../game/ui-types";

/** Device defaults, persisted client option hydration and storage key. */
export const mobileDefaultFpsLookSensitivity = 1.35;

export const nh3dClientOptionsStorageKey = "nh3d-client-options:v1";

export function resolveDeviceDefaultClientOptions(): Nh3dClientOptions {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  ) {
    return normalizeNh3dClientOptions({
      ...defaultNh3dClientOptions,
      fpsLookSensitivityX: mobileDefaultFpsLookSensitivity,
      fpsLookSensitivityY: mobileDefaultFpsLookSensitivity,
    });
  }
  return normalizeNh3dClientOptions(defaultNh3dClientOptions);
}

export function resolveInitialClientOptionsFromPersisted(
  persisted: Partial<Nh3dClientOptions> | null,
): Nh3dClientOptions {
  const deviceDefaults = resolveDeviceDefaultClientOptions();
  if (!persisted) {
    return deviceDefaults;
  }
  const hydrated = normalizeNh3dClientOptions({
    ...deviceDefaults,
    ...persisted,
  });
  hydrated.controllerEnabled = false;
  return hydrated;
}
