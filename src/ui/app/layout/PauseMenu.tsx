
import type { JSX } from "react/jsx-runtime";
export interface PauseMenuProps {
  renderPauseMenu: () => JSX.Element;
}

export function PauseMenu({
  renderPauseMenu,
}: PauseMenuProps) {
  return (
    renderPauseMenu()
  );
}
