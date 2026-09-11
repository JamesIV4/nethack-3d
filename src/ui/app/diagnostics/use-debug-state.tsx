import {
  useState
} from "react";
import {
  type DebugSessionLogSession
} from "../../../debug-session-log";

/** Owns debug activation, log visibility and selected-session state. */
export function useDebugState() {
  const [startupBuildLabelClickCount, setStartupBuildLabelClickCount] =
    useState(0);

  const [startupBuildLabelToastVisible, setStartupBuildLabelToastVisible] =
    useState(false);

  const [debugSessionLogsEnabled, setDebugSessionLogsEnabled] = useState(false);

  const [isDebugSessionLogsVisible, setIsDebugSessionLogsVisible] =
    useState(false);

  const [debugSessionLogs, setDebugSessionLogs] = useState<
    DebugSessionLogSession[]
  >([]);

  const [selectedDebugSessionLogId, setSelectedDebugSessionLogId] =
    useState("");
  return {
    startupBuildLabelClickCount,
    setStartupBuildLabelClickCount,
    startupBuildLabelToastVisible,
    setStartupBuildLabelToastVisible,
    debugSessionLogsEnabled,
    setDebugSessionLogsEnabled,
    isDebugSessionLogsVisible,
    setIsDebugSessionLogsVisible,
    debugSessionLogs,
    setDebugSessionLogs,
    selectedDebugSessionLogId,
    setSelectedDebugSessionLogId,
  } as const;
}
