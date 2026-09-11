import { OptionLabelWithInfo } from "./OptionLabelWithInfo";
import { normalizeSolidChromaKeyHex } from "../tilesets/TilesetSolidColorPickerDialog";
import type { ClientOptionsDialogProps } from "./ClientOptionsDialog";
import type { ClientOptionColor } from "./types";

type ClientOptionColorControlProps = Pick<ClientOptionsDialogProps,
  | "clientOptionsDraft"
  | "updateClientOptionDraft"
> & { option: ClientOptionColor };

export function ClientOptionColorControl({
  option,
  clientOptionsDraft,
  updateClientOptionDraft,
}: ClientOptionColorControlProps): JSX.Element {

  const colorValue = normalizeSolidChromaKeyHex(
    String(clientOptionsDraft[option.key] || ""),
  );
  const colorDisabled =
    option.key === "bloodMistColorHex"
      ? !clientOptionsDraft.bloodMist
      : !clientOptionsDraft.bloodGround;
  return (
    <div
      className={`nh3d-option-row${colorDisabled ? " nh3d-option-row-mode-inactive" : ""
        }`}
      key={option.key}
    >
      <div className="nh3d-option-copy">
        <OptionLabelWithInfo
          label={option.label}
          description={option.description}
        />
      </div>
      <div className="nh3d-option-select-controls">
        <input
          aria-label={option.label}
          className="nh3d-option-solid-color-native-picker"
          disabled={colorDisabled}
          onChange={(event) =>
            updateClientOptionDraft(
              option.key,
              normalizeSolidChromaKeyHex(
                event.target.value,
                colorValue,
              ),
            )
          }
          type="color"
          value={colorValue}
        />
      </div>
    </div>
  );
}
