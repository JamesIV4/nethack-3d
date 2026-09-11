import {
  useState
} from "react";

/** Owns pause and exit-confirmation visibility. */
export function useOverlayState() {
  const [isPauseMenuVisible, setIsPauseMenuVisible] = useState(false);

  const [isExitConfirmationVisible, setIsExitConfirmationVisible] =
    useState(false);
  return {
    isPauseMenuVisible,
    setIsPauseMenuVisible,
    isExitConfirmationVisible,
    setIsExitConfirmationVisible,
  } as const;
}

/** Owns visibility of the debug session-log link. */
export function useOverlayState2() {
  const [isDebugSessionLogsLinkVisible, setIsDebugSessionLogsLinkVisible] =
    useState(false);
  return {
    isDebugSessionLogsLinkVisible,
    setIsDebugSessionLogsLinkVisible,
  } as const;
}
