import {
  t
} from "../shared/translations";
import type { Nethack3DEngineController } from "../../../game/ui-types";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { getWebXrState, subscribeWebXr } from "../../../quest/webxr/presentation";


export interface RepeatActionButtonProps {
  mobileTouchUiVisible: boolean;
  repeatActionVisible: boolean;
  controller: Nethack3DEngineController | null;
}

/** VR needs the same repeat command even when the touch-only chrome is hidden. */
export function isRepeatActionButtonVisible(
  mobileTouchUiVisible: boolean,
  repeatActionVisible: boolean,
  immersiveActive: boolean,
): boolean {
  return repeatActionVisible && (mobileTouchUiVisible || immersiveActive);
}

export function RepeatActionButton({
  mobileTouchUiVisible,
  repeatActionVisible,
  controller,
}: RepeatActionButtonProps) {
  const immersiveActive = useSyncExternalStore(subscribeWebXr, getWebXrState, getWebXrState).active;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!immersiveActive || !button) return;
    const bars = [...document.querySelectorAll<HTMLElement>(".nh3d-mobile-bottom-bar,.nh3d-desktop-bottom-actions")];
    const position = () => {
      const bar = bars.find(node => node.getBoundingClientRect().height > 0 && getComputedStyle(node).visibility === "visible");
      if (bar) button.style.setProperty("--nh3d-xr-repeat-bottom", `${innerHeight-bar.getBoundingClientRect().top+8}px`);
    };
    const observer = new ResizeObserver(position); bars.forEach(bar=>observer.observe(bar));
    window.addEventListener("resize",position); position();
    return () => { observer.disconnect(); window.removeEventListener("resize",position); button.style.removeProperty("--nh3d-xr-repeat-bottom"); };
  }, [immersiveActive,repeatActionVisible,mobileTouchUiVisible]);
  return (
    isRepeatActionButtonVisible(mobileTouchUiVisible, repeatActionVisible, immersiveActive) ? (
      <button
        ref={buttonRef}
        className="nh3d-mobile-repeat-button"
        onClick={() => {
          controller?.dismissFpsCrosshairContextMenu();
          controller?.repeatLastAction();
        }}
        type="button"
      >
        {t.dialogs.mobileActions.repeat}
      </button>
    ) : null
  );
}
