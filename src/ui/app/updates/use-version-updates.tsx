import {
  useCallback,
  useEffect
} from "react";
import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  checkForNh3dGitHubVersionUpdates,
  getNh3dGitHubReleasesPageUrl
} from "../../../update/github-version-checker";
import type {
  Nh3dVersionCheckResult
} from "../../../update/types";
import type * as React from "react";
import type {
  Nh3dWindowBridges
} from "../shared/platform";
import {
  t
} from "../shared/translations";

export interface UseVersionUpdatesDependencies {
  readonly startupUiVisible: boolean;
  readonly startupRenderSignalSentRef: React.MutableRefObject<boolean>;
  readonly startupUpdateCheckStartedRef: React.MutableRefObject<boolean>;
  readonly clientOptions: Nh3dClientOptions;
  readonly setStartupUpdateCheck: React.Dispatch<React.SetStateAction<Nh3dVersionCheckResult | null>>;
  readonly setStartupUpdateDetailsVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setIsStartupUpdateDialogVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly startupUpdateCheck: Nh3dVersionCheckResult | null;
  readonly optionsUpdateCheckResult: Nh3dVersionCheckResult | null;
  readonly optionsUpdateCheckBusy: boolean;
  readonly setOptionsUpdateCheckBusy: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setOptionsUpdateCheckStatus: React.Dispatch<React.SetStateAction<string>>;
  readonly setOptionsUpdateCheckResult: React.Dispatch<React.SetStateAction<Nh3dVersionCheckResult | null>>;
  readonly startupMenuVisible: boolean;
}

/** Checks for client updates and opens release information. */
export function useVersionUpdates(dependencies: UseVersionUpdatesDependencies) {
  const {
    startupUiVisible,
    startupRenderSignalSentRef,
    startupUpdateCheckStartedRef,
    clientOptions,
    setStartupUpdateCheck,
    setStartupUpdateDetailsVisible,
    setIsStartupUpdateDialogVisible,
    startupUpdateCheck,
    optionsUpdateCheckResult,
    optionsUpdateCheckBusy,
    setOptionsUpdateCheckBusy,
    setOptionsUpdateCheckStatus,
    setOptionsUpdateCheckResult,
    startupMenuVisible,
  } = dependencies;

  useEffect(() => {
    if (!startupUiVisible || startupRenderSignalSentRef.current) {
      return;
    }
    const bridgeWindow = window as Nh3dWindowBridges;
    const signalAppRendered = bridgeWindow.nh3dElectron?.signalAppRendered;
    if (typeof signalAppRendered !== "function") {
      startupRenderSignalSentRef.current = true;
      return;
    }
    startupRenderSignalSentRef.current = true;
    signalAppRendered();
  }, [startupUiVisible]);

  useEffect(() => {
    if (!startupUiVisible || startupUpdateCheckStartedRef.current) {
      return;
    }
    startupUpdateCheckStartedRef.current = true;
    if (!clientOptions.showVersionNotificationsOnLaunch) {
      return;
    }
    let canceled = false;
    (async () => {
      try {
        const result = await checkForNh3dGitHubVersionUpdates();
        if (canceled) {
          return;
        }
        if (result.error) {
          console.warn("Failed to check GitHub releases:", result.error);
          return;
        }
        setStartupUpdateCheck(result);
        if (result.hasUpdate) {
          setStartupUpdateDetailsVisible(false);
          setIsStartupUpdateDialogVisible(true);
        }
      } catch (error) {
        if (canceled) {
          return;
        }
        const errorMessage =
          error instanceof Error
            ? error.message
            : t.update.unexpectedCheckFailure;
        console.warn("Failed to check GitHub releases:", errorMessage);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [clientOptions.showVersionNotificationsOnLaunch, startupUiVisible]);

  const closeStartupUpdateDialog = useCallback((): void => {
    setStartupUpdateDetailsVisible(false);
    setIsStartupUpdateDialogVisible(false);
  }, []);

  const toggleStartupUpdateDetails = useCallback((): void => {
    setStartupUpdateDetailsVisible((previous) => !previous);
  }, []);

  const openGitHubReleases = useCallback((): void => {
    const targetUrl =
      startupUpdateCheck?.releasesPageUrl ??
      optionsUpdateCheckResult?.releasesPageUrl ??
      getNh3dGitHubReleasesPageUrl();
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }, [optionsUpdateCheckResult?.releasesPageUrl, startupUpdateCheck?.releasesPageUrl]);

  const checkForUpdatesFromOptions = useCallback(async (): Promise<void> => {
    if (optionsUpdateCheckBusy) {
      return;
    }
    setOptionsUpdateCheckBusy(true);
    setOptionsUpdateCheckStatus(t.update.checkingForUpdates);

    try {
      const result = await checkForNh3dGitHubVersionUpdates();
      setOptionsUpdateCheckResult(result);
      if (result.error) {
        setOptionsUpdateCheckStatus(t.update.updateCheckFailed(result.error));
        return;
      }

      setStartupUpdateCheck(result);
      if (!result.hasUpdate) {
        setOptionsUpdateCheckStatus(t.update.latestAlreadyInstalledOptions);
        if (startupMenuVisible) {
          setStartupUpdateDetailsVisible(false);
          setIsStartupUpdateDialogVisible(false);
        }
        return;
      }

      setOptionsUpdateCheckStatus(
        result.newerTags.length === 1
          ? t.update.oneUpdateAvailable
          : t.update.manyUpdatesAvailable(result.newerTags.length),
      );
      if (startupMenuVisible) {
        setStartupUpdateDetailsVisible(false);
        setIsStartupUpdateDialogVisible(true);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t.update.unexpectedCheckFailure;
      setOptionsUpdateCheckStatus(t.update.updateCheckFailed(errorMessage));
    } finally {
      setOptionsUpdateCheckBusy(false);
    }
  }, [optionsUpdateCheckBusy, startupMenuVisible]);
  return {
    closeStartupUpdateDialog,
    toggleStartupUpdateDetails,
    openGitHubReleases,
    checkForUpdatesFromOptions,
  } as const;
}
