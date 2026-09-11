
import type { JSX } from "react/jsx-runtime";
export interface TerminalMessageGutterProps {
  terminalDesktopGutterVisible: boolean;
  desktopGameMessageLog: JSX.Element | null;
}

export function TerminalMessageGutter({
  terminalDesktopGutterVisible,
  desktopGameMessageLog,
}: TerminalMessageGutterProps) {
  return (
    terminalDesktopGutterVisible ? (
      <div className="nh3d-terminal-log-gutter">
        {desktopGameMessageLog}
      </div>
    ) : null
  );
}
