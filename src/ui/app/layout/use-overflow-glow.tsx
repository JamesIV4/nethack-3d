import {
  useEffect
} from "react";
import {
  clearOverflowGlowState,
  overflowGlowTargetSelector,
  updateOverflowGlowState
} from "../shared/overflow-glow";

/** Tracks scrollable elements and updates their overflow glow. */
export function useOverflowGlow() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const trackedElements = new Map<HTMLElement, () => void>();
    let refreshRafId: number | null = null;

    const refreshOverflowGlowTargets = (): void => {
      const activeElements = new Set<HTMLElement>();
      const candidates = document.querySelectorAll<HTMLElement>(
        overflowGlowTargetSelector,
      );
      for (const element of candidates) {
        if (!element.isConnected) {
          continue;
        }
        const hasOverflowGlow = updateOverflowGlowState(element);
        if (!hasOverflowGlow) {
          continue;
        }
        activeElements.add(element);
        if (trackedElements.has(element)) {
          continue;
        }
        const onScroll = (): void => {
          updateOverflowGlowState(element);
        };
        element.addEventListener("scroll", onScroll, { passive: true });
        trackedElements.set(element, onScroll);
      }

      for (const [element, onScroll] of trackedElements.entries()) {
        if (activeElements.has(element) && element.isConnected) {
          continue;
        }
        element.removeEventListener("scroll", onScroll);
        trackedElements.delete(element);
        clearOverflowGlowState(element);
      }
    };

    const scheduleOverflowGlowRefresh = (): void => {
      if (refreshRafId !== null) {
        return;
      }
      refreshRafId = window.requestAnimationFrame(() => {
        refreshRafId = null;
        refreshOverflowGlowTargets();
      });
    };

    scheduleOverflowGlowRefresh();

    const mutationObserver = new MutationObserver(() => {
      scheduleOverflowGlowRefresh();
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("resize", scheduleOverflowGlowRefresh);
    window.addEventListener("orientationchange", scheduleOverflowGlowRefresh);

    return () => {
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleOverflowGlowRefresh);
      window.removeEventListener(
        "orientationchange",
        scheduleOverflowGlowRefresh,
      );
      if (refreshRafId !== null) {
        window.cancelAnimationFrame(refreshRafId);
      }
      for (const [element, onScroll] of trackedElements.entries()) {
        element.removeEventListener("scroll", onScroll);
        clearOverflowGlowState(element);
      }
      trackedElements.clear();
    };
  }, []);

}
