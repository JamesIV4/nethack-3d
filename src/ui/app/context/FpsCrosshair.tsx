import type { CharacterCreationConfig, NethackConnectionState } from "../../../game/ui-types";

export interface FpsCrosshairProps {
  isFpsPlayMode: boolean;
  characterCreationConfig: CharacterCreationConfig | null;
  connectionState: NethackConnectionState;
  positionInputActive: boolean;
  loadingVisible: boolean;
}

export function FpsCrosshair({
  isFpsPlayMode,
  characterCreationConfig,
  connectionState,
  positionInputActive,
  loadingVisible,
}: FpsCrosshairProps) {
  return (
    isFpsPlayMode &&
      characterCreationConfig !== null &&
      connectionState === "running" &&
      !positionInputActive &&
      !loadingVisible ? (
      <div aria-hidden="true" className="nh3d-fps-crosshair">
        <div className="nh3d-fps-crosshair-dot" />
      </div>
    ) : null
  );
}
