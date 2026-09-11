import {
  useEffect
} from "react";
import type {
  Nh3dClientOptions
} from "../../../game/ui-types";

export interface UseClientOptionsCssEffectsDependencies {
  readonly clientOptions: Nh3dClientOptions;
}

/** Applies UI scale, safe-zone and animation settings to document styles. */
export function useClientOptionsCssEffects(dependencies: UseClientOptionsCssEffectsDependencies) {
  const {
    clientOptions,
  } = dependencies;

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.style.setProperty(
      "--nh3d-ui-font-scale",
      String(clientOptions.uiFontScale),
    );
    root.style.setProperty(
      "--nh3d-live-log-font-scale",
      String(clientOptions.liveMessageLogFontScale),
    );
    root.style.setProperty(
      "--nh3d-desktop-log-window-scale",
      String(clientOptions.desktopMessageLogWindowScale),
    );
    root.style.setProperty(
      "--nh3d-minimap-scale",
      String(clientOptions.minimapScale),
    );
    return () => {
      root.style.removeProperty("--nh3d-ui-font-scale");
      root.style.removeProperty("--nh3d-live-log-font-scale");
      root.style.removeProperty("--nh3d-desktop-log-window-scale");
      root.style.removeProperty("--nh3d-minimap-scale");
    };
  }, [
    clientOptions.uiFontScale,
    clientOptions.liveMessageLogFontScale,
    clientOptions.desktopMessageLogWindowScale,
    clientOptions.minimapScale,
  ]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.classList.toggle(
      "nh3d-manual-mobile-bottom-safe-zone",
      clientOptions.manualMobileBottomSafeZoneEnabled,
    );
    root.style.setProperty(
      "--nh3d-manual-mobile-bottom-safe-zone-vertical",
      `${Math.round(clientOptions.manualMobileBottomSafeZoneVerticalPx)}px`,
    );
    root.style.setProperty(
      "--nh3d-manual-mobile-bottom-safe-zone-horizontal",
      `${Math.round(clientOptions.manualMobileBottomSafeZoneHorizontalPx)}px`,
    );
    root.style.setProperty(
      "--nh3d-manual-mobile-right-safe-zone-horizontal",
      `${Math.round(clientOptions.manualMobileRightSafeZoneHorizontalPx)}px`,
    );
    return () => {
      root.classList.remove("nh3d-manual-mobile-bottom-safe-zone");
      root.style.removeProperty(
        "--nh3d-manual-mobile-bottom-safe-zone-vertical",
      );
      root.style.removeProperty(
        "--nh3d-manual-mobile-bottom-safe-zone-horizontal",
      );
      root.style.removeProperty(
        "--nh3d-manual-mobile-right-safe-zone-horizontal",
      );
    };
  }, [
    clientOptions.manualMobileBottomSafeZoneEnabled,
    clientOptions.manualMobileBottomSafeZoneVerticalPx,
    clientOptions.manualMobileBottomSafeZoneHorizontalPx,
    clientOptions.manualMobileRightSafeZoneHorizontalPx,
  ]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.classList.toggle(
      "nh3d-disable-animated-transitions",
      clientOptions.disableAnimatedTransitions,
    );
    return () => {
      root.classList.remove("nh3d-disable-animated-transitions");
    };
  }, [clientOptions.disableAnimatedTransitions]);

}
