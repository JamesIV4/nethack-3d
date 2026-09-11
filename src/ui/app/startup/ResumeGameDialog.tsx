import type {
  CharacterCreationConfig,
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  normalizeNh3dClientOptions
} from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  resolveNh3dCompatibleTilesetPathForRuntime
} from "../../../game/tilesets";
import AnimatedDialog from "../../modals/AnimatedDialog";
import type * as React from "react";
import type {
  SaveGameRecord
} from "./saved-games";
import type {
  StartupFlowStep
} from "./character-preferences";
import {
  RuntimeVersionBadge
} from "./RuntimeVersionBadge";
import {
  commonStrings,
  t
} from "../shared/translations";

export interface ResumeGameDialogProps {
  startupInitialLoadingVisible: boolean;
  startupResumeDialogVisible: boolean;
  handleStartupMainMenuBlurCapture: (event: React.FocusEvent<HTMLDivElement, Element>) => void;
  handleStartupMainMenuChangeCapture: (event: React.FormEvent<HTMLDivElement>) => void;
  handleStartupMainMenuKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  handleStartupMainMenuPointerDownCapture: (event: React.PointerEvent<HTMLDivElement>) => void;
  startupSelectedRuntimeVersionLabel: string | null;
  isLoadingSaves: boolean;
  savedGameSections: ({ key: "manual"; label: string; saves: SaveGameRecord[]; } | { key: "autosave"; label: string; saves: SaveGameRecord[]; })[];
  clientOptions: Nh3dClientOptions;
  runtimeVersion: NethackRuntimeVersion;
  setClientOptions: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  setClientOptionsDraft: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  setCharacterCreationConfig: React.Dispatch<React.SetStateAction<CharacterCreationConfig | null>>;
  handleDeleteSave: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>, save: SaveGameRecord) => Promise<void>;
  setStartupFlowStep: React.Dispatch<React.SetStateAction<StartupFlowStep>>;
}

export function ResumeGameDialog({
  startupInitialLoadingVisible,
  startupResumeDialogVisible,
  handleStartupMainMenuBlurCapture,
  handleStartupMainMenuChangeCapture,
  handleStartupMainMenuKeyDown,
  handleStartupMainMenuPointerDownCapture,
  startupSelectedRuntimeVersionLabel,
  isLoadingSaves,
  savedGameSections,
  clientOptions,
  runtimeVersion,
  setClientOptions,
  setClientOptionsDraft,
  setCharacterCreationConfig,
  handleDeleteSave,
  setStartupFlowStep,
}: ResumeGameDialogProps) {
  return (
    <AnimatedDialog
      className="nh3d-dialog nh3d-dialog-question nh3d-dialog-fixed-actions startup nh3d-character-setup-dialog nh3d-character-setup-dialog-resume"
      disableAnimations={startupInitialLoadingVisible}
      open={startupResumeDialogVisible}
      id="character-setup-dialog-resume"
      onBlurCapture={handleStartupMainMenuBlurCapture}
      onChangeCapture={handleStartupMainMenuChangeCapture}
      onKeyDown={handleStartupMainMenuKeyDown}
      onPointerDownCapture={handleStartupMainMenuPointerDownCapture}
    >
      {startupSelectedRuntimeVersionLabel ? (
        <RuntimeVersionBadge
          label={startupSelectedRuntimeVersionLabel}
          startup
        />
      ) : null}
      <div className="nh3d-question-text">
        {t.dialogs.startup.selectSavedGame}
      </div>
      <div className="nh3d-overflow-glow-frame">
        <div
          className="nh3d-choice-list nh3d-choice-list-startup-resume"
          data-nh3d-overflow-glow
          data-nh3d-overflow-glow-host="parent"
          style={{ width: "100%" }}
        >
          {isLoadingSaves ? (
            <div
              style={{
                padding: "20px",
                color: "var(--nh3d-ui-text-muted)",
              }}
            >
              {t.saves.loading}
            </div>
          ) : savedGameSections.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {savedGameSections.map((section) => (
                <div
                  key={section.key}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      color: "var(--nh3d-ui-text-muted)",
                      fontWeight: "bold",
                      fontSize: "calc(12px * var(--nh3d-ui-font-scale, 1))",
                      paddingLeft: "2px",
                    }}
                  >
                    {section.label}
                  </div>
                  {section.saves.map((save) => (
                    <div
                      key={save.key}
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <button
                        className="nh3d-choice-button nh3d-character-setup-choice-button"
                        style={{
                          flex: "1 1 0",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          minWidth: 0,
                          padding: "12px",
                          width: "auto",
                        }}
                        onClick={() => {
                          const currentTilesetPath = String(
                            clientOptions.tilesetPath || "",
                          ).trim();
                          const compatibleTilesetPath =
                            resolveNh3dCompatibleTilesetPathForRuntime(
                              currentTilesetPath,
                              runtimeVersion,
                            );
                          if (
                            compatibleTilesetPath &&
                            compatibleTilesetPath !== currentTilesetPath
                          ) {
                            setClientOptions((previous) =>
                              normalizeNh3dClientOptions({
                                ...previous,
                                tilesetPath: compatibleTilesetPath,
                              }),
                            );
                            setClientOptionsDraft((previous) =>
                              normalizeNh3dClientOptions({
                                ...previous,
                                tilesetPath: compatibleTilesetPath,
                              }),
                            );
                          }
                          setCharacterCreationConfig({
                            mode: "resume",
                            playMode: clientOptions.fpsMode
                              ? "fps"
                              : "normal",
                            runtimeVersion,
                            name: save.name,
                            initOptions: save.initOptions,
                            resumeCategory: save.category,
                          });
                        }}
                        type="button"
                      >
                        <div style={{ width: "100%" }}>
                          <div
                            style={{
                              fontWeight: "bold",
                              fontSize:
                                "calc(16px * var(--nh3d-ui-font-scale, 1))",
                            }}
                          >
                            {save.displayName}
                          </div>
                          <div
                            style={{
                              fontSize:
                                "calc(12px * var(--nh3d-ui-font-scale, 1))",
                              color: "var(--nh3d-ui-text-muted)",
                              marginTop: "4px",
                              fontWeight: "normal",
                            }}
                          >
                            {t.saves.savedAt(save.dateFormatted)}
                          </div>
                        </div>
                      </button>
                      <button
                        aria-label={`Delete ${save.displayName}`}
                        className="delete-button"
                        onClick={(e) => handleDeleteSave(e, save)}
                        type="button"
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "20px",
                color: "var(--nh3d-ui-text-muted)",
              }}
            >
              {t.saves.noneFound}
            </div>
          )}
        </div>
      </div>
      <div className="nh3d-menu-actions">
        <button
          className="nh3d-menu-action-button nh3d-menu-action-cancel"
          onClick={() => setStartupFlowStep("choose")}
          type="button"
        >
          {commonStrings.back}
        </button>
      </div>
    </AnimatedDialog>
  );
}
