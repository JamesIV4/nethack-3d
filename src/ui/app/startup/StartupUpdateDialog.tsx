import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  normalizeNh3dClientOptions
} from "../../../game/ui-types";
import AnimatedDialog from "../../modals/AnimatedDialog";
import type * as React from "react";
import {
  commonStrings,
  t
} from "../shared/translations";
import {
  UpdateReleaseNotesMarkdown
} from "../updates/UpdateReleaseNotesMarkdown";
import type { Nh3dVersionTag } from "../../../update/types";


export interface StartupUpdateDialogProps {
  startupUpdateExpanded: boolean;
  startupInitialLoadingVisible: boolean;
  startupUpdateDialogOpen: boolean;
  handleStartupMainMenuBlurCapture: (event: React.FocusEvent<HTMLDivElement, Element>) => void;
  handleStartupMainMenuChangeCapture: (event: React.FormEvent<HTMLDivElement>) => void;
  handleStartupMainMenuKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  handleStartupMainMenuPointerDownCapture: (event: React.PointerEvent<HTMLDivElement>) => void;
  startupPendingUpdateCount: number;
  startupCurrentVersionLabel: string;
  startupLatestVersionLabel: string;
  startupUpdateDetailsVisible: boolean;
  startupPendingUpdateTags: Nh3dVersionTag[];
  clientOptions: Nh3dClientOptions;
  setClientOptions: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  setClientOptionsDraft: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  openGitHubReleases: () => void;
  toggleStartupUpdateDetails: () => void;
  closeStartupUpdateDialog: () => void;
}

export function StartupUpdateDialog({
  startupUpdateExpanded,
  startupInitialLoadingVisible,
  startupUpdateDialogOpen,
  handleStartupMainMenuBlurCapture,
  handleStartupMainMenuChangeCapture,
  handleStartupMainMenuKeyDown,
  handleStartupMainMenuPointerDownCapture,
  startupPendingUpdateCount,
  startupCurrentVersionLabel,
  startupLatestVersionLabel,
  startupUpdateDetailsVisible,
  startupPendingUpdateTags,
  clientOptions,
  setClientOptions,
  setClientOptionsDraft,
  openGitHubReleases,
  toggleStartupUpdateDetails,
  closeStartupUpdateDialog,
}: StartupUpdateDialogProps) {
  return (
    <AnimatedDialog
      className={`nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions startup nh3d-character-setup-dialog nh3d-startup-update-dialog${startupUpdateExpanded ? " nh3d-startup-update-expanded" : ""
        }`}
      disableAnimations={startupInitialLoadingVisible}
      open={startupUpdateDialogOpen}
      id="nh3d-startup-update-dialog"
      onBlurCapture={handleStartupMainMenuBlurCapture}
      onChangeCapture={handleStartupMainMenuChangeCapture}
      onKeyDown={handleStartupMainMenuKeyDown}
      onPointerDownCapture={handleStartupMainMenuPointerDownCapture}
    >
      <div className="nh3d-question-text">
        {startupPendingUpdateCount <= 0
          ? t.dialogs.startupUpdate.maintenanceNotice
          : startupPendingUpdateCount === 1
            ? t.update.oneUpdateAvailable
            : t.update.manyUpdatesAvailable(startupPendingUpdateCount)}
      </div>
      <div className="nh3d-startup-update-progress-pane-meta">
        <span>
          {t.dialogs.startupUpdate.currentVersion(startupCurrentVersionLabel)}
        </span>
        <span>
          {t.dialogs.startupUpdate.latestVersion(startupLatestVersionLabel)}
        </span>
      </div>
      {startupUpdateDetailsVisible ? (
        <div className="nh3d-overflow-glow-frame">
          <div
            className="nh3d-startup-update-details"
            data-nh3d-overflow-glow
            data-nh3d-overflow-glow-host="parent"
          >
            <div className="nh3d-startup-update-details-title">
              {t.dialogs.startupUpdate.pendingUpdates}
            </div>
            <ul className="nh3d-startup-update-details-list">
              {startupPendingUpdateTags.length > 0 ? (
                startupPendingUpdateTags.map((entry, index) => (
                  <li key={`${entry.name}-${index}`}>
                    {entry.releasePageUrl ? (
                      <a
                        className="nh3d-startup-update-details-release-link"
                        href={entry.releasePageUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {entry.name}
                      </a>
                    ) : (
                      <div className="nh3d-startup-update-details-release-name">
                        {entry.name}
                      </div>
                    )}
                    {entry.releaseNotesMarkdown ? (
                      <UpdateReleaseNotesMarkdown
                        markdown={entry.releaseNotesMarkdown}
                      />
                    ) : null}
                  </li>
                ))
              ) : (
                <li>{t.dialogs.startupUpdate.payloadAvailable}</li>
              )}
            </ul>
          </div>
        </div>
      ) : null}
      <div className="nh3d-startup-update-client-warning">
        <label className="nh3d-startup-update-warning-toggle">
          <input
            checked={!clientOptions.showVersionNotificationsOnLaunch}
            onChange={(event) => {
              const showVersionNotificationsOnLaunch = !event.target.checked;
              setClientOptions((previous) =>
                normalizeNh3dClientOptions({
                  ...previous,
                  showVersionNotificationsOnLaunch,
                }),
              );
              setClientOptionsDraft((previous) =>
                normalizeNh3dClientOptions({
                  ...previous,
                  showVersionNotificationsOnLaunch,
                }),
              );
            }}
            type="checkbox"
          />
          <span>{t.dialogs.startupUpdate.disableAtStartup}</span>
        </label>
        {!clientOptions.showVersionNotificationsOnLaunch ? (
          <div>{t.dialogs.startupUpdate.disabledNotice}</div>
        ) : null}
      </div>
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button nh3d-menu-action-confirm"
          onClick={openGitHubReleases}
          type="button"
        >
          {t.dialogs.clientOptions.updates.openGitHubReleases}
        </button>
        <button
          className="nh3d-menu-action-button"
          disabled={startupPendingUpdateCount <= 0}
          onClick={toggleStartupUpdateDetails}
          type="button"
        >
          {startupUpdateDetailsVisible
            ? t.dialogs.startupUpdate.hideDetails
            : t.dialogs.startupUpdate.moreDetails}
        </button>
        <button
          className="nh3d-menu-action-button nh3d-menu-action-cancel"
          onClick={closeStartupUpdateDialog}
          type="button"
        >
          {commonStrings.later}
        </button>
      </div>
    </AnimatedDialog>
  );
}
