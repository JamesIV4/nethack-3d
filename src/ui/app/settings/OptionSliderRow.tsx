import type { ReactNode } from "react";
import { OptionLabelWithInfo } from "./OptionLabelWithInfo";

/** Shared layout for option sliders, regardless of the settings store. */
export function OptionSliderRow({label, description, valueLabel, disabled = false, children}: {
  label: string; description: string; valueLabel: string; disabled?: boolean; children: ReactNode;
}): JSX.Element {
  return <div className={`nh3d-option-row nh3d-option-row-slider${disabled ? " nh3d-option-row-mode-inactive" : ""}`}>
    <div className="nh3d-option-copy"><OptionLabelWithInfo label={label} description={description} /></div>
    <div className="nh3d-option-slider-control">
      {children}
      <div className="nh3d-option-slider-value">{valueLabel}</div>
    </div>
  </div>;
}
