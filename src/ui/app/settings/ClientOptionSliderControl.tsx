import { useSyncExternalStore } from "react";
import { getWebXrState, subscribeWebXr } from "../../../quest/webxr/presentation";
import { getXrSettings, subscribeXrSettings } from "../../../quest/webxr/settings";
import { OptionSliderRow } from "./OptionSliderRow";
import type { ClientOptionsDialogProps } from "./ClientOptionsDialog";
import type { ClientOptionSlider } from "./types";

type ClientOptionSliderControlProps = Pick<ClientOptionsDialogProps,
  | "clientOptionsDraft"
  | "setManualSafeZonePreview"
  | "showManualSafeZonePreview"
  | "updateClientSliderDraft"
> & { option: ClientOptionSlider };

export function ClientOptionSliderControl({
  option,
  clientOptionsDraft,
  setManualSafeZonePreview,
  showManualSafeZonePreview,
  updateClientSliderDraft,
}: ClientOptionSliderControlProps): JSX.Element {
  const xr = useSyncExternalStore(subscribeWebXr, getWebXrState, getWebXrState);
  const xrSettings = useSyncExternalStore(subscribeXrSettings, getXrSettings, getXrSettings);

  const sliderValue = clientOptionsDraft[option.key];
  const isManualBottomSafeZoneSlider =
    option.key === "manualMobileBottomSafeZoneVerticalPx" ||
    option.key === "manualMobileBottomSafeZoneHorizontalPx";
  const isManualRightSafeZoneSlider =
    option.key === "manualMobileRightSafeZoneHorizontalPx";
  const isManualSafeZoneSlider =
    isManualBottomSafeZoneSlider ||
    isManualRightSafeZoneSlider;
  const sliderDisabledByFpsMode =
    (option.key === "controllerFpsMoveRepeatMs" ||
      option.key === "fpsFov" ||
      option.key === "fpsLookSensitivityX" ||
      option.key === "fpsLookSensitivityY") &&
    !(xr.active ? xrSettings.fpsMode : clientOptionsDraft.fpsMode);
  const sliderDisabledByController =
    option.key === "controllerFpsMoveRepeatMs" &&
    !clientOptionsDraft.controllerEnabled;
  const sliderDisabledByBlood =
    option.key === "bloodStrength" &&
    !clientOptionsDraft.bloodMist &&
    !clientOptionsDraft.bloodGround;
  const sliderDisabledByManualSafeZone =
    isManualSafeZoneSlider &&
    !clientOptionsDraft.manualMobileBottomSafeZoneEnabled;
  const sliderDisabled =
    sliderDisabledByFpsMode ||
    sliderDisabledByController ||
    sliderDisabledByBlood ||
    sliderDisabledByManualSafeZone;
  const sliderLabel =
    option.key === "bloodStrength"
      ? `${sliderValue.toFixed(2)}x`
      : option.key === "gamma"
        ? `${sliderValue.toFixed(2)}x`
        : option.key === "fpsFov"
          ? `${Math.round(sliderValue)}\u00b0`
          : isManualSafeZoneSlider
            ? `${Math.round(sliderValue)}px`
            : option.key === "fpsLookSensitivityX" ||
              option.key === "fpsLookSensitivityY"
              ? `${sliderValue.toFixed(2)}x`
              : option.key === "uiFontScale" ||
                option.key === "liveMessageLogFontScale" ||
                option.key === "desktopMessageLogWindowScale"
                ? `${Math.round(sliderValue * 100)}%`
                : option.key === "controllerFpsMoveRepeatMs" ||
                  option.key === "liveMessageDisplayTimeMs" ||
                  option.key === "liveMessageFadeOutTimeMs"
                  ? `${Math.round(sliderValue)}ms`
                  : `${Math.round(sliderValue * 100)}%`;
  return (
    <OptionSliderRow label={option.label} description={option.description} valueLabel={sliderLabel} disabled={sliderDisabled}>
        <input
          aria-label={option.label}
          className="nh3d-option-slider"
          disabled={sliderDisabled}
          max={option.max}
          min={option.min}
          onBlur={() => {
            if (isManualSafeZoneSlider) {
              setManualSafeZonePreview(null);
            }
          }}
          onFocus={() => {
            if (isManualBottomSafeZoneSlider) {
              showManualSafeZonePreview("bottom", sliderValue);
            } else if (isManualRightSafeZoneSlider) {
              showManualSafeZonePreview("right", sliderValue);
            }
          }}
          onInput={(event) => {
            const nextValue = Number(
              event.currentTarget.value,
            );
            updateClientSliderDraft(option.key, nextValue);
            if (isManualBottomSafeZoneSlider) {
              showManualSafeZonePreview("bottom", nextValue);
            } else if (isManualRightSafeZoneSlider) {
              showManualSafeZonePreview("right", nextValue);
            }
          }}
          onChange={(event) => {
            const nextValue = Number(
              event.currentTarget.value,
            );
            updateClientSliderDraft(option.key, nextValue);
            if (isManualBottomSafeZoneSlider) {
              showManualSafeZonePreview("bottom", nextValue);
            } else if (isManualRightSafeZoneSlider) {
              showManualSafeZonePreview("right", nextValue);
            }
          }}
          onPointerDown={() => {
            if (isManualBottomSafeZoneSlider) {
              showManualSafeZonePreview("bottom", sliderValue);
            } else if (isManualRightSafeZoneSlider) {
              showManualSafeZonePreview("right", sliderValue);
            }
          }}
          step={option.step}
          type="range"
          value={sliderValue}
        />
    </OptionSliderRow>
  );
}
