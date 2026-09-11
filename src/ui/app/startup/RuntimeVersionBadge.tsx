import type {
  NethackRuntimeVersion
} from "../../../runtime/types";

/** Runtime version label and badge. */
export function resolveRuntimeVersionDisplayLabel(
  runtimeVersion: NethackRuntimeVersion,
): string {
  switch (runtimeVersion) {
    case "5.0":
      return "NetHack 5.0";
    case "slashem":
      return "Slash'EM";
    case "3.6.7":
    default:
      return "NetHack 3.6.7";
  }
}

export function RuntimeVersionBadge({
  label,
  startup = false,
}: {
  label: string;
  startup?: boolean;
}): JSX.Element {
  return (
    <div
      className={`nh3d-dialog-context-label${startup ? " nh3d-dialog-context-label-startup" : ""
        }`}
    >
      <span className="nh3d-dialog-context-label-text">{label}</span>
    </div>
  );
}
