import {
  useEffect,
  useRef,
  useState
} from "react";
import type { CharacterCreationConfig, InfoMenuState, NethackConnectionState, NewGamePromptState, QuestionDialogState, GameOverState } from "../../../game/ui-types";
import type * as React from "react";

/** Viewport media, stat sizing and mobile zoom prevention */
export function useMobileLayoutState() {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  return {
    isMobileViewport,
    setIsMobileViewport,
  } as const;
}

/** Viewport media, stat sizing and mobile zoom prevention */
export function useMobileLayoutScaleRef() {
  const refreshMobileStatsCoreRowScaleRef = useRef<(() => void) | null>(null);
  return {
    refreshMobileStatsCoreRowScaleRef,
  } as const;
}

export interface UseMobileLayoutEffectsDependencies {
  readonly setIsMobileViewport: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setStatsBarHeight: React.Dispatch<React.SetStateAction<number>>;
  readonly characterCreationConfig: CharacterCreationConfig | null;
  readonly connectionState: NethackConnectionState;
  readonly loadingVisible: boolean;
  readonly isMobileViewport: boolean;
  readonly newGamePrompt: NewGamePromptState;
  readonly infoMenu: InfoMenuState | null;
  readonly question: QuestionDialogState | null;
  readonly gameOver: GameOverState;
  readonly statsBarHeight: number;
  readonly refreshMobileStatsCoreRowScaleRef: React.MutableRefObject<(() => void) | null>;
}

/** Viewport media, stat sizing and mobile zoom prevention */
export function useMobileLayoutEffects(dependencies: UseMobileLayoutEffectsDependencies) {
  const {
    setIsMobileViewport,
    setStatsBarHeight,
    characterCreationConfig,
    connectionState,
    loadingVisible,
    isMobileViewport,
    newGamePrompt,
    infoMenu,
    question,
    gameOver,
    statsBarHeight,
    refreshMobileStatsCoreRowScaleRef,
  } = dependencies;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const handleMediaQueryChange = (): void => {
      setIsMobileViewport(mediaQuery.matches);
    };

    handleMediaQueryChange();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaQueryChange);
    } else {
      mediaQuery.addListener(handleMediaQueryChange);
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleMediaQueryChange);
      } else {
        mediaQuery.removeListener(handleMediaQueryChange);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const statsBar = document.getElementById("stats-bar");
    if (!statsBar) {
      setStatsBarHeight(0);
      return;
    }

    const updateHeight = (): void => {
      setStatsBarHeight(statsBar.getBoundingClientRect().height);
    };

    updateHeight();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(statsBar);
    }

    window.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [
    characterCreationConfig,
    connectionState,
    loadingVisible,
    isMobileViewport,
    newGamePrompt.visible,
    infoMenu,
    question,
    gameOver.tombstoneLines,
  ]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      !window.matchMedia
    ) {
      return;
    }

    const root = document.documentElement;
    if (!isMobileViewport) {
      root.classList.remove("nh3d-mobile-browser-mode");
      return;
    }

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)");
    const minimalUiQuery = window.matchMedia("(display-mode: minimal-ui)");

    const updateMobileBrowserModeClass = (): void => {
      const iOSStandalone =
        typeof (window.navigator as { standalone?: boolean }).standalone ===
        "boolean" &&
        Boolean((window.navigator as { standalone?: boolean }).standalone);
      const isStandaloneDisplayMode =
        iOSStandalone ||
        standaloneQuery.matches ||
        fullscreenQuery.matches ||
        minimalUiQuery.matches;
      root.classList.toggle(
        "nh3d-mobile-browser-mode",
        !isStandaloneDisplayMode,
      );
    };

    updateMobileBrowserModeClass();

    const queries = [standaloneQuery, fullscreenQuery, minimalUiQuery];
    const addChangeListener = (query: MediaQueryList): void => {
      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", updateMobileBrowserModeClass);
      } else {
        query.addListener(updateMobileBrowserModeClass);
      }
    };
    const removeChangeListener = (query: MediaQueryList): void => {
      if (typeof query.removeEventListener === "function") {
        query.removeEventListener("change", updateMobileBrowserModeClass);
      } else {
        query.removeListener(updateMobileBrowserModeClass);
      }
    };

    for (const query of queries) {
      addChangeListener(query);
    }

    return () => {
      for (const query of queries) {
        removeChangeListener(query);
      }
      root.classList.remove("nh3d-mobile-browser-mode");
    };
  }, [isMobileViewport]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    if (!isMobileViewport) {
      root.style.removeProperty("--nh3d-mobile-visible-height");
      root.style.removeProperty("--nh3d-mobile-visible-top-offset");
      root.style.removeProperty("--nh3d-mobile-visible-bottom-offset");
      return;
    }

    const updateMobileVisibleViewportMetrics = (): void => {
      const visualViewport = window.visualViewport;
      const layoutViewportHeight = window.innerHeight;
      const viewportOffsetTop = visualViewport ? visualViewport.offsetTop : 0;
      const viewportBottomOffset = visualViewport
        ? Math.max(
          0,
          layoutViewportHeight -
          (visualViewport.height + visualViewport.offsetTop),
        )
        : 0;

      root.style.setProperty(
        "--nh3d-mobile-visible-height",
        `${Math.max(0, Math.round(layoutViewportHeight))}px`,
      );
      root.style.setProperty(
        "--nh3d-mobile-visible-top-offset",
        `${Math.max(0, Math.round(viewportOffsetTop))}px`,
      );
      root.style.setProperty(
        "--nh3d-mobile-visible-bottom-offset",
        `${Math.max(0, Math.round(viewportBottomOffset))}px`,
      );
    };

    updateMobileVisibleViewportMetrics();
    window.addEventListener("resize", updateMobileVisibleViewportMetrics);
    const orientationRefreshTimeoutIds: number[] = [];
    const handleOrientationViewportRefresh = (): void => {
      updateMobileVisibleViewportMetrics();
      const triggerResize = () => {
        updateMobileVisibleViewportMetrics();
        window.dispatchEvent(new Event("resize"));
      };
      orientationRefreshTimeoutIds.push(window.setTimeout(triggerResize, 120));
      orientationRefreshTimeoutIds.push(window.setTimeout(triggerResize, 280));
    };
    window.addEventListener(
      "orientationchange",
      handleOrientationViewportRefresh,
    );

    const visualViewport = window.visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener(
        "resize",
        updateMobileVisibleViewportMetrics,
      );
      visualViewport.addEventListener(
        "scroll",
        updateMobileVisibleViewportMetrics,
      );
    }
    const screenOrientation = window.screen?.orientation;
    if (
      screenOrientation &&
      typeof screenOrientation.addEventListener === "function"
    ) {
      screenOrientation.addEventListener(
        "change",
        handleOrientationViewportRefresh,
      );
    }

    return () => {
      window.removeEventListener("resize", updateMobileVisibleViewportMetrics);
      window.removeEventListener(
        "orientationchange",
        handleOrientationViewportRefresh,
      );
      if (visualViewport) {
        visualViewport.removeEventListener(
          "resize",
          updateMobileVisibleViewportMetrics,
        );
        visualViewport.removeEventListener(
          "scroll",
          updateMobileVisibleViewportMetrics,
        );
      }
      if (
        screenOrientation &&
        typeof screenOrientation.removeEventListener === "function"
      ) {
        screenOrientation.removeEventListener(
          "change",
          handleOrientationViewportRefresh,
        );
      }
      for (const timeoutId of orientationRefreshTimeoutIds) {
        window.clearTimeout(timeoutId);
      }
      root.style.removeProperty("--nh3d-mobile-visible-height");
      root.style.removeProperty("--nh3d-mobile-visible-top-offset");
      root.style.removeProperty("--nh3d-mobile-visible-bottom-offset");
    };
  }, [isMobileViewport]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.style.setProperty("--nh3d-stats-bar-height", `${statsBarHeight}px`);
    return () => {
      root.style.removeProperty("--nh3d-stats-bar-height");
    };
  }, [statsBarHeight]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      !window.matchMedia
    ) {
      return;
    }

    const statsBar = document.getElementById("stats-bar");
    if (!statsBar) {
      refreshMobileStatsCoreRowScaleRef.current = null;
      return;
    }

    const mobilePortraitQuery = window.matchMedia(
      "(orientation: portrait) and (pointer: coarse)",
    );
    const maxScale = 1;
    const minScale = 8 / 13;
    const groupSelector = ".nh3d-stats-group-core";
    const rowSelector =
      ".nh3d-stats-core-row-primary, .nh3d-stats-core-row-secondary";
    const scaleCssVar = "--nh3d-mobile-stats-core-scale";
    const wrapFallbackClass = "nh3d-mobile-stats-wrap-fallback";

    const refreshScale = (): void => {
      if (!mobilePortraitQuery.matches) {
        statsBar.classList.remove(wrapFallbackClass);
        statsBar.style.setProperty(scaleCssVar, String(maxScale));
        return;
      }

      statsBar.classList.remove(wrapFallbackClass);

      const group = statsBar.querySelector<HTMLElement>(groupSelector);
      const rows = Array.from(
        statsBar.querySelectorAll<HTMLElement>(rowSelector),
      );
      if (!group || rows.length === 0) {
        statsBar.style.setProperty(scaleCssVar, String(maxScale));
        return;
      }

      for (const row of rows) {
        row.style.flexWrap = "nowrap";
      }

      let targetScale = maxScale;
      const applyScale = (): void => {
        statsBar.style.setProperty(scaleCssVar, targetScale.toFixed(4));
      };
      const measureGroupFitRatio = (): number => {
        const availableWidth = group.clientWidth;
        const requiredWidth = group.scrollWidth;
        if (availableWidth <= 0 || requiredWidth <= 0) {
          return 1;
        }
        return availableWidth / requiredWidth;
      };

      // Keep both stat rows on one line by shrinking both rows together uniformly.
      for (let pass = 0; pass < 6; pass += 1) {
        applyScale();
        const fitRatio = measureGroupFitRatio();
        if (fitRatio >= 0.999) {
          break;
        }
        const nextScale = Math.max(minScale, targetScale * fitRatio * 0.985);
        if (nextScale >= targetScale - 0.0005) {
          break;
        }
        targetScale = nextScale;
        if (targetScale <= minScale + 0.0005) {
          break;
        }
      }
      applyScale();

      const finalFitRatio = measureGroupFitRatio();
      const hitMinScale = targetScale <= minScale + 0.0005;
      if (finalFitRatio < 0.999 && hitMinScale) {
        statsBar.classList.add(wrapFallbackClass);
      }
    };

    refreshMobileStatsCoreRowScaleRef.current = refreshScale;
    refreshScale();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(refreshScale);
      const observedElements = [
        statsBar,
        statsBar.querySelector<HTMLElement>(groupSelector),
        ...Array.from(statsBar.querySelectorAll<HTMLElement>(rowSelector)),
      ].filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element.isConnected,
      );
      for (const element of observedElements) {
        resizeObserver.observe(element);
      }
    }
    let mutationObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(refreshScale);
      mutationObserver.observe(statsBar, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    const handleViewportChange = (): void => {
      refreshScale();
    };
    if (typeof mobilePortraitQuery.addEventListener === "function") {
      mobilePortraitQuery.addEventListener("change", handleViewportChange);
    } else {
      mobilePortraitQuery.addListener(handleViewportChange);
    }
    window.addEventListener("resize", handleViewportChange);

    return () => {
      refreshMobileStatsCoreRowScaleRef.current = null;
      if (typeof mobilePortraitQuery.removeEventListener === "function") {
        mobilePortraitQuery.removeEventListener("change", handleViewportChange);
      } else {
        mobilePortraitQuery.removeListener(handleViewportChange);
      }
      window.removeEventListener("resize", handleViewportChange);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      statsBar.classList.remove(wrapFallbackClass);
      statsBar.style.removeProperty(scaleCssVar);
    };
  }, [isMobileViewport, statsBarHeight]);

}
