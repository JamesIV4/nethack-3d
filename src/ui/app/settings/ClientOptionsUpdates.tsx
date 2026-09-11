import { commonStrings, t } from "../shared/translations";
import { OptionLabelWithInfo } from "./OptionLabelWithInfo";
import type { ClientOptionsDialogProps } from "./ClientOptionsDialog";

type ClientOptionsUpdatesProps = Pick<ClientOptionsDialogProps,
  | "clientOptionsDraft"
  | "updateClientOptionDraft"
  | "optionsUpdateCheckStatus"
  | "optionsUpdateCheckResult"
  | "optionsUpdateCheckBusy"
  | "checkForUpdatesFromOptions"
  | "openGitHubReleases"
>;

export function ClientOptionsUpdates({
  clientOptionsDraft,
  updateClientOptionDraft,
  optionsUpdateCheckStatus,
  optionsUpdateCheckResult,
  optionsUpdateCheckBusy,
  checkForUpdatesFromOptions,
  openGitHubReleases,
}: ClientOptionsUpdatesProps): JSX.Element {
  return ((
    <>
      <div className="nh3d-option-row nh3d-option-row-inline-toggle">
        <div className="nh3d-option-copy">
          <OptionLabelWithInfo
            label={
              t.dialogs.clientOptions.updates.checkOnLaunchLabel
            }
            description={
              t.dialogs.clientOptions.updates
                .checkOnLaunchDescription
            }
          />
        </div>
        <button
          aria-checked={
            clientOptionsDraft.showVersionNotificationsOnLaunch
          }
          className={`nh3d-option-switch nh3d-option-inline-switch${clientOptionsDraft.showVersionNotificationsOnLaunch
            ? " is-on"
            : ""
            }`}
          onClick={() =>
            updateClientOptionDraft(
              "showVersionNotificationsOnLaunch",
              !clientOptionsDraft.showVersionNotificationsOnLaunch,
            )
          }
          role="switch"
          type="button"
        >
          <span className="nh3d-option-switch-thumb" />
        </button>
      </div>
      <div className="nh3d-option-row nh3d-option-row-updates">
        <div className="nh3d-option-copy">
          <OptionLabelWithInfo
            label={t.dialogs.clientOptions.updates.title}
            description={
              t.dialogs.clientOptions.updates.description
            }
          />
          {optionsUpdateCheckStatus ? (
            <div className="nh3d-updates-status">
              {optionsUpdateCheckStatus}
            </div>
          ) : (
            <div className="nh3d-updates-status">
              {t.dialogs.clientOptions.updates.idle}
            </div>
          )}
          {optionsUpdateCheckResult &&
            !optionsUpdateCheckResult.error ? (
            <>
              <div className="nh3d-updates-status">
                {t.dialogs.startupUpdate.currentVersion(
                  `v${optionsUpdateCheckResult.currentVersion}`,
                )}
              </div>
              <div className="nh3d-updates-status">
                {t.dialogs.startupUpdate.latestVersion(
                  optionsUpdateCheckResult.latestVersion ??
                  optionsUpdateCheckResult.latestTagName ??
                  commonStrings.none,
                )}
              </div>
            </>
          ) : null}
          {optionsUpdateCheckResult &&
            !optionsUpdateCheckResult.error &&
            optionsUpdateCheckResult.hasUpdate &&
            optionsUpdateCheckResult.newerTags.length > 0 ? (
            <ul className="nh3d-updates-pending-list">
              {optionsUpdateCheckResult.newerTags.map(
                (entry, index) => (
                  <li key={`${entry.name}-${index}`}>
                    {entry.name}
                  </li>
                ),
              )}
            </ul>
          ) : null}
        </div>
        <div className="nh3d-option-select-controls nh3d-option-select-controls-stacked">
          <button
            className="nh3d-menu-action-button"
            disabled={optionsUpdateCheckBusy}
            onClick={() => {
              void checkForUpdatesFromOptions();
            }}
            type="button"
          >
            {optionsUpdateCheckBusy
              ? commonStrings.checking
              : t.dialogs.clientOptions.updates.button}
          </button>
          <button
            className="nh3d-menu-action-button"
            onClick={openGitHubReleases}
            type="button"
          >
            {t.dialogs.clientOptions.updates.openGitHubReleases}
          </button>
        </div>
      </div>
    </>
  ));
}
