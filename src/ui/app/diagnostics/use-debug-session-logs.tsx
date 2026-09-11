import {
  useCallback,
  useEffect,
  useMemo
} from "react";
import {
  setLoggingEnabled
} from "../../../logging";
import {
  enableDebugSessionLogCapture,
  formatDebugSessionLogSession,
  readDebugSessionLogs,
  recordDebugSessionLogEvent,
  type DebugSessionLogSession
} from "../../../debug-session-log";
import type * as React from "react";
import {
  nh3dBuildLabel,
  nh3dBuildLabelDebugEnableClickCount
} from "../shared/build-info";
import {
  t
} from "../shared/translations";

export interface UseDebugSessionLogsDependencies {
  readonly startupBuildLabelToastTimerRef: React.MutableRefObject<number | null>;
  readonly setDebugSessionLogs: React.Dispatch<React.SetStateAction<DebugSessionLogSession[]>>;
  readonly setSelectedDebugSessionLogId: React.Dispatch<React.SetStateAction<string>>;
  readonly setIsDebugSessionLogsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly debugSessionLogsEnabled: boolean;
  readonly setStartupBuildLabelClickCount: React.Dispatch<React.SetStateAction<number>>;
  readonly setDebugSessionLogsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsDebugSessionLogsLinkVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setStartupBuildLabelToastVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly debugSessionLogs: DebugSessionLogSession[];
  readonly selectedDebugSessionLogId: string;
}

/** Enables debug logging and loads, selects and formats session logs. */
export function useDebugSessionLogs(dependencies: UseDebugSessionLogsDependencies) {
  const {
    startupBuildLabelToastTimerRef,
    setDebugSessionLogs,
    setSelectedDebugSessionLogId,
    setIsDebugSessionLogsVisible,
    debugSessionLogsEnabled,
    setStartupBuildLabelClickCount,
    setDebugSessionLogsEnabled,
    setIsDebugSessionLogsLinkVisible,
    setStartupBuildLabelToastVisible,
    debugSessionLogs,
    selectedDebugSessionLogId,
  } = dependencies;

  useEffect(() => {
    return () => {
      if (startupBuildLabelToastTimerRef.current !== null) {
        window.clearTimeout(startupBuildLabelToastTimerRef.current);
        startupBuildLabelToastTimerRef.current = null;
      }
    };
  }, []);

  const refreshDebugSessionLogs = useCallback((): void => {
    const nextLogs = readDebugSessionLogs();
    setDebugSessionLogs(nextLogs);
    setSelectedDebugSessionLogId((previous) => {
      if (previous && nextLogs.some((session) => session.id === previous)) {
        return previous;
      }
      return nextLogs[0]?.id || "";
    });
  }, []);

  const openDebugSessionLogsDialog = useCallback((): void => {
    refreshDebugSessionLogs();
    setIsDebugSessionLogsVisible(true);
  }, [refreshDebugSessionLogs]);

  useEffect(() => {
    if (!debugSessionLogsEnabled) {
      return;
    }
    setLoggingEnabled(true);
    enableDebugSessionLogCapture({ buildLabel: nh3dBuildLabel });
    refreshDebugSessionLogs();
  }, [debugSessionLogsEnabled, refreshDebugSessionLogs]);

  const handleStartupBuildLabelClick = useCallback((): void => {
    setStartupBuildLabelClickCount((previous) => {
      const next = previous + 1;
      if (next < nh3dBuildLabelDebugEnableClickCount) {
        return next;
      }
      setLoggingEnabled(true);
      enableDebugSessionLogCapture({ buildLabel: nh3dBuildLabel });
      recordDebugSessionLogEvent("debug-log-toggle", [
        t.debugLogs.enabledLogEntry,
      ]);
      setDebugSessionLogsEnabled(true);
      setIsDebugSessionLogsLinkVisible(true);
      refreshDebugSessionLogs();
      setStartupBuildLabelToastVisible(true);
      if (startupBuildLabelToastTimerRef.current !== null) {
        window.clearTimeout(startupBuildLabelToastTimerRef.current);
      }
      startupBuildLabelToastTimerRef.current = window.setTimeout(() => {
        setStartupBuildLabelToastVisible(false);
        startupBuildLabelToastTimerRef.current = null;
      }, 2200);
      return 0;
    });
  }, [refreshDebugSessionLogs]);

  const selectedDebugSessionLog = useMemo(
    () =>
      debugSessionLogs.find(
        (session) => session.id === selectedDebugSessionLogId,
      ) ||
      debugSessionLogs[0] ||
      null,
    [debugSessionLogs, selectedDebugSessionLogId],
  );

  const selectedDebugSessionLogText = useMemo(
    () =>
      selectedDebugSessionLog
        ? formatDebugSessionLogSession(selectedDebugSessionLog)
        : t.dialogs.debugLogs.noneSaved,
    [selectedDebugSessionLog],
  );
  return {
    refreshDebugSessionLogs,
    openDebugSessionLogsDialog,
    handleStartupBuildLabelClick,
    selectedDebugSessionLog,
    selectedDebugSessionLogText,
  } as const;
}
