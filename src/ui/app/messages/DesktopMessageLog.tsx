
import type { JSX } from "react/jsx-runtime";
export interface DesktopMessageLogProps {
  terminalDesktopGutterVisible: boolean;
  desktopGameMessageLog: JSX.Element | null;
}

export function DesktopMessageLog({
  terminalDesktopGutterVisible,
  desktopGameMessageLog,
}: DesktopMessageLogProps) {
  return (
    !terminalDesktopGutterVisible ? desktopGameMessageLog : null
  );
}
