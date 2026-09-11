import {
  type DebugSessionLogSession
} from "../../../debug-session-log";
import {
  t
} from "./translations";

/** Debug session log labels. */
export function formatDebugSessionLogTimestamp(value: string): string {
  if (!value) {
    return t.unknownTime;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export function describeDebugSessionLogSession(
  session: DebugSessionLogSession,
): string {
  const closeReason =
    session.closeReason === "abrupt-stop"
      ? t.debugSession.possibleCrash
      : session.closeReason === "active"
        ? t.debugSession.active
        : session.closeReason.replace(/-/g, " ");
  return `${formatDebugSessionLogTimestamp(session.startedAt)} - ${closeReason}`;
}
