import { useLayoutEffect, useRef } from "react";

/** Keep portrait overlays above the actual wrapped hotbar, including safe-area changes. */
export function useHotbarHeight(visible: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const bar = ref.current;
    if (!visible || !bar || typeof ResizeObserver === "undefined") return;
    const stats = document.getElementById("stats-bar");
    const update = () => {
      const rect = bar.getBoundingClientRect();
      const statsRect = stats?.getBoundingClientRect();
      const top = statsRect && statsRect.height > 0 ? Math.max(8, statsRect.bottom + 8) : 8;
      bar.style.setProperty("--nh3d-hotbar-available-height", `${Math.max(0, rect.bottom - top)}px`);
      document.documentElement.style.setProperty("--nh3d-mobile-hotbar-height", `${bar.getBoundingClientRect().height}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(bar); if (stats) observer.observe(stats);
    window.addEventListener("resize", update); update();
    return () => { observer.disconnect(); window.removeEventListener("resize", update); document.documentElement.style.removeProperty("--nh3d-mobile-hotbar-height"); };
  }, [visible]);
  return ref;
}
