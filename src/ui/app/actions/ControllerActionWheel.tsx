import { formatActionLabel } from "./action-catalog";
import {
  Fragment,
  type CSSProperties
} from "react";
import AnimatedDialog from "../../modals/AnimatedDialog";
import type * as React from "react";
import type {
  MobileActionSheetMode
} from "../menus/mobile-actions";
import type {
  ControllerActionWheelEntry
} from "../controller/action-wheel";
import {
  t
} from "../shared/translations";
import {
  mobileActions
} from "../menus/mobile-actions";

export interface ControllerActionWheelProps {
  controllerActionWheelMode: MobileActionSheetMode;
  isControllerActionWheelVisible: boolean;
  controllerActionWheelDialogRef: React.MutableRefObject<HTMLDivElement | null>;
  controllerActionWheelChosenIndex: number;
  controllerActionWheelEntries: ControllerActionWheelEntry[];
  runControllerWheelEntry: (action: ControllerActionWheelEntry) => void;
  setControllerActionWheelChosenIndex: React.Dispatch<React.SetStateAction<number>>;
  mobileCommonExtendedCommandNames: string[];
  runControllerWheelExtendedCommand: (command: string) => void;
  mobileExtendedCommandNames: string[];
}

export function ControllerActionWheel({
  controllerActionWheelMode,
  isControllerActionWheelVisible,
  controllerActionWheelDialogRef,
  controllerActionWheelChosenIndex,
  controllerActionWheelEntries,
  runControllerWheelEntry,
  setControllerActionWheelChosenIndex,
  mobileCommonExtendedCommandNames,
  runControllerWheelExtendedCommand,
  mobileExtendedCommandNames,
}: ControllerActionWheelProps) {
  return (
    <AnimatedDialog
      className={`nh3d-dialog nh3d-controller-action-wheel-dialog ${controllerActionWheelMode === "quick" ? "is-quick" : "is-extended"
        }`}
      open={isControllerActionWheelVisible}
      id="nh3d-controller-action-wheel-dialog"
      ref={controllerActionWheelDialogRef}
    >
      {controllerActionWheelMode === "quick" ? (
        <div
          className="nh3d-controller-action-wheel-ring is-on"
          data-chosen={String(controllerActionWheelChosenIndex + 1)}
          data-count={String(controllerActionWheelEntries.length)}
        >
          {controllerActionWheelEntries.map((action) => {
            const isChosen =
              controllerActionWheelChosenIndex === action.index;
            const arcStyle = {
              clipPath: action.clipPath,
              ["--nh3d-wheel-stagger-delay" as string]: `${(action.index % 2) * 15}ms`,
            } as CSSProperties;
            const labelStyle: CSSProperties = {
              left: `${action.labelXPercent.toFixed(2)}%`,
              top: `${action.labelYPercent.toFixed(2)}%`,
            };
            return (
              <button
                aria-label={action.label}
                className={`nh3d-controller-action-wheel-arc${isChosen ? " is-chosen" : ""
                  }`}
                data-nh3d-wheel-angle={action.angleDeg.toFixed(2)}
                data-nh3d-wheel-index={String(action.index)}
                key={`controller-wheel-${action.id}`}
                onClick={() => runControllerWheelEntry(action)}
                onFocus={() =>
                  setControllerActionWheelChosenIndex(action.index)
                }
                onMouseEnter={() =>
                  setControllerActionWheelChosenIndex(action.index)
                }
                style={arcStyle}
                type="button"
              >
                <span
                  className="nh3d-controller-action-wheel-arc-label"
                  style={labelStyle}
                >
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <Fragment>
          <div className="nh3d-controller-action-wheel-title-row">
            <div className="nh3d-controller-action-wheel-title">
              {t.dialogs.mobileActions.extendedCommands}
            </div>
          </div>
          <div className="nh3d-overflow-glow-frame nh3d-controller-action-wheel-extended-shell">
            <div
              className="nh3d-mobile-actions-sections nh3d-controller-action-wheel-extended"
              data-nh3d-overflow-glow
              data-nh3d-overflow-glow-host="parent"
            >
              {mobileCommonExtendedCommandNames.length > 0 ? (
                <div className="nh3d-mobile-actions-section">
                  <div className="nh3d-mobile-actions-subheader">
                    {t.dialogs.mobileActions.commonCommands}
                  </div>
                  <div className="nh3d-mobile-actions-grid is-extended">
                    {mobileCommonExtendedCommandNames.map((command) => (
                      <button
                        className="nh3d-mobile-actions-button"
                        key={`wheel-common-${formatActionLabel(command)}`}
                        onClick={() =>
                          runControllerWheelExtendedCommand(command)
                        }
                        type="button"
                      >
                        {formatActionLabel(command)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="nh3d-mobile-actions-section">
                <div className="nh3d-mobile-actions-subheader">
                  {t.dialogs.mobileActions.allCommands}
                </div>
                <div className="nh3d-mobile-actions-grid is-extended">
                  {mobileExtendedCommandNames.map((command) => (
                    <button
                      className="nh3d-mobile-actions-button"
                      key={`wheel-all-${formatActionLabel(command)}`}
                      onClick={() =>
                        runControllerWheelExtendedCommand(command)
                      }
                      type="button"
                    >
                      {formatActionLabel(command)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Fragment>
      )}
    </AnimatedDialog>
  );
}
