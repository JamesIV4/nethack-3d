import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  nh3dFpsLookSensitivityMax,
  nh3dFpsLookSensitivityMin
} from "../../../game/ui-types";
import type * as React from "react";
import type {
  ClientOptionColor,
  ClientOptionLookSensitivityKey,
  ClientOptionSelect,
  ClientOptionSlider,
  ClientOptionToggleKey
} from "./types";

export interface UseClientSliderDraftDependencies {
  readonly setClientOptionsDraft: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  readonly updateClientOptionDraft: <K extends ClientOptionToggleKey | ClientOptionSelect["key"] | ClientOptionSlider["key"] | ClientOptionColor["key"]>(optionKey: K, value: Nh3dClientOptions[K]) => void;
}

/** Clamps client sliders and applies draft values. */
export function useClientSliderDraft(dependencies: UseClientSliderDraftDependencies) {
  const {
    setClientOptionsDraft,
    updateClientOptionDraft,
  } = dependencies;

  const updateClientFovDraft = (rawValue: number): void => {
    const clamped = Math.max(45, Math.min(110, Math.round(rawValue)));
    setClientOptionsDraft((previous) => ({
      ...previous,
      fpsFov: clamped,
    }));
  };

  const updateClientLookSensitivityDraft = (
    key: ClientOptionLookSensitivityKey,
    rawValue: number,
  ): void => {
    const clamped = Number(
      Math.max(
        nh3dFpsLookSensitivityMin,
        Math.min(nh3dFpsLookSensitivityMax, rawValue),
      ).toFixed(2),
    );
    setClientOptionsDraft((previous) => ({
      ...previous,
      [key]: clamped,
    }));
  };

  const updateClientSliderDraft = (
    key: ClientOptionSlider["key"],
    rawValue: number,
  ): void => {
    if (key === "fpsFov") {
      updateClientFovDraft(rawValue);
      return;
    }
    if (key === "fpsLookSensitivityX" || key === "fpsLookSensitivityY") {
      updateClientLookSensitivityDraft(key, rawValue);
      return;
    }
    let clamped = rawValue;
    if (key === "brightness") {
      clamped = Math.max(-0.25, Math.min(0.25, rawValue));
    } else if (key === "contrast") {
      clamped = Math.max(-0.25, Math.min(0.25, rawValue));
    } else if (key === "gamma") {
      clamped = Math.max(0.5, Math.min(2.5, rawValue));
    } else if (key === "bloodStrength") {
      clamped = Math.max(1, Math.min(2.5, rawValue));
    } else if (key === "minimapScale") {
      clamped = Math.max(0.6, Math.min(2.2, rawValue));
    } else if (key === "liveMessageDisplayTimeMs") {
      clamped = Math.max(250, Math.min(6000, rawValue));
    } else if (key === "uiFontScale") {
      clamped = Math.max(0.7, Math.min(1.8, rawValue));
    } else if (key === "liveMessageLogFontScale") {
      clamped = Math.max(0.7, Math.min(2.2, rawValue));
    } else if (key === "desktopMessageLogWindowScale") {
      clamped = Math.max(0.33, Math.min(1.5, rawValue));
    } else if (key === "controllerFpsMoveRepeatMs") {
      clamped = Math.max(80, Math.min(900, rawValue));
    } else if (
      key === "manualMobileBottomSafeZoneVerticalPx" ||
      key === "manualMobileBottomSafeZoneHorizontalPx" ||
      key === "manualMobileRightSafeZoneHorizontalPx"
    ) {
      clamped = Math.max(0, Math.min(100, rawValue));
    } else {
      clamped = Math.max(120, Math.min(4000, rawValue));
    }
    if (
      key === "controllerFpsMoveRepeatMs" ||
      key === "liveMessageDisplayTimeMs" ||
      key === "liveMessageFadeOutTimeMs" ||
      key === "manualMobileBottomSafeZoneVerticalPx" ||
      key === "manualMobileBottomSafeZoneHorizontalPx" ||
      key === "manualMobileRightSafeZoneHorizontalPx"
    ) {
      updateClientOptionDraft(key, Math.round(clamped));
      return;
    }
    updateClientOptionDraft(key, Number(clamped.toFixed(2)));
  };
  return {
    updateClientSliderDraft,
  } as const;
}
