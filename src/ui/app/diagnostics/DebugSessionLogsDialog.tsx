import AnimatedDialog from "../../modals/AnimatedDialog";
import {
  clearDebugSessionLogs,
  enableDebugSessionLogCapture,
  recordDebugSessionLogEvent,
  type DebugSessionLogSession
} from "../../../debug-session-log";
import type * as React from "react";
import {
  commonStrings,
  t
} from "../shared/translations";
import {
  describeDebugSessionLogSession,
  formatDebugSessionLogTimestamp
} from "../shared/debug-log-format";
import {
  nh3dBuildLabel
} from "../shared/build-info";

export interface DebugSessionLogsDialogProps {
  isDebugSessionLogsVisible: boolean;
  renderMobileDialogCloseButton: (onClick: () => void, label?: string) => JSX.Element | null;
  setIsDebugSessionLogsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  debugSessionLogs: DebugSessionLogSession[];
  selectedDebugSessionLog: DebugSessionLogSession;
  setSelectedDebugSessionLogId: React.Dispatch<React.SetStateAction<string>>;
  selectedDebugSessionLogText: string;
  refreshDebugSessionLogs: () => void;
}

export function DebugSessionLogsDialog({
  isDebugSessionLogsVisible,
  renderMobileDialogCloseButton,
  setIsDebugSessionLogsVisible,
  debugSessionLogs,
  selectedDebugSessionLog,
  setSelectedDebugSessionLogId,
  selectedDebugSessionLogText,
  refreshDebugSessionLogs,
}: DebugSessionLogsDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-text nh3d-dialog-fixed-actions nh3d-dialog-has-mobile-close nh3d-debug-log-dialog"
      open={isDebugSessionLogsVisible}
      id="nh3d-debug-log-dialog"
    >
      {isDebugSessionLogsVisible ? (
        <>
          {renderMobileDialogCloseButton(
            () => setIsDebugSessionLogsVisible(false),
            t.dialogs.debugLogs.closeLabel,
          )}
          <div className="nh3d-options-title">
            {t.dialogs.debugLogs.title}
          </div>
          <div className="nh3d-dialog-hint">{t.dialogs.debugLogs.hint}</div>
          {debugSessionLogs.length > 0 ? (
            <>
              <div className="nh3d-debug-log-session-list">
                {debugSessionLogs.map((session) => (
                  <button
                    className={`nh3d-debug-log-session-button${selectedDebugSessionLog?.id === session.id
                      ? " is-active"
                      : ""
                      }`}
                    key={session.id}
                    onClick={() => setSelectedDebugSessionLogId(session.id)}
                    type="button"
                  >
                    {describeDebugSessionLogSession(session)}
                  </button>
                ))}
              </div>
              {selectedDebugSessionLog ? (
                <div className="nh3d-debug-log-session-summary">
                  {t.dialogs.debugLogs.showingEntries(
                    selectedDebugSessionLog.entries.length,
                    formatDebugSessionLogTimestamp(
                      selectedDebugSessionLog.startedAt,
                    ),
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <div className="nh3d-question-text">
              {t.dialogs.debugLogs.noneSaved}
            </div>
          )}
          <div className="nh3d-debug-log-viewer" data-nh3d-overflow-glow>
            <pre className="nh3d-debug-log-viewer-text">
              {selectedDebugSessionLogText}
            </pre>
          </div>
          <div className="nh3d-menu-actions">
            <button
              className="nh3d-menu-action-button"
              onClick={refreshDebugSessionLogs}
              type="button"
            >
              {t.dialogs.debugLogs.refresh}
            </button>
            <button
              className="nh3d-menu-action-button nh3d-menu-action-cancel"
              onClick={() => {
                clearDebugSessionLogs();
                enableDebugSessionLogCapture({ buildLabel: nh3dBuildLabel });
                recordDebugSessionLogEvent("debug-log-clear", [
                  t.debugLogs.clearedLogEntry,
                ]);
                refreshDebugSessionLogs();
              }}
              type="button"
            >
              {t.dialogs.debugLogs.clearLogs}
            </button>
            <button
              className="nh3d-menu-action-button"
              onClick={() => setIsDebugSessionLogsVisible(false)}
              type="button"
            >
              {commonStrings.close}
            </button>
          </div>
        </>
      ) : null}
    </AnimatedDialog>
  );
}
