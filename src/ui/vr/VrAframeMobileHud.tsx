import { useEffect, useMemo, useState } from "react";
import type {
  MobileActionEntry,
  MobileActionSheetMode,
} from "../mobile/mobile-actions";

type VrAframeMobileHudProps = {
  visible: boolean;
  repeatActionVisible: boolean;
  actionSheetVisible: boolean;
  actionSheetMode: MobileActionSheetMode;
  quickActions: MobileActionEntry[];
  commonExtendedCommandNames: string[];
  extendedCommandNames: string[];
  logEnabled: boolean;
  logVisible: boolean;
  tiltDegrees: number;
  onOpenInventory: () => void;
  onToggleLog: () => void;
  onPickup: () => void;
  onSearch: () => void;
  onToggleActionSheet: () => void;
  onRepeatAction: () => void;
  onShowPauseMenu: () => void;
  onCloseActionSheet: () => void;
  onSetActionSheetMode: (mode: MobileActionSheetMode) => void;
  onSelectAction: (action: MobileActionEntry) => void;
  onRunExtendedCommand: (command: string) => void;
  onAdjustTilt: (deltaDegrees: number) => void;
};

type VrHudButtonTone = "default" | "primary" | "warn";

type VrHudButtonProps = {
  id: string;
  label: string;
  position: string;
  width: number;
  height: number;
  tone?: VrHudButtonTone;
  disabled?: boolean;
  textWidth?: number;
  wrapCount?: number;
  onClick: () => void;
};

function escapeAframeTextValue(value: string): string {
  return String(value || "")
    .replace(/[;\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function VrHudButton({
  id,
  label,
  position,
  width,
  height,
  tone = "default",
  disabled = false,
  textWidth = 1.2,
  wrapCount = 22,
  onClick,
}: VrHudButtonProps): JSX.Element {
  const textColor = disabled ? "#6f8295" : "#eef7ff";
  return (
    <a-entity
      className="raycastable"
      geometry={`primitive: plane; width: ${width}; height: ${height}`}
      key={id}
      material="color: #132237; opacity: 0.96; shader: flat"
      nh3d-ui-button={`disabled: ${disabled}; tone: ${tone}`}
      onClick={() => {
        if (disabled) {
          return;
        }
        onClick();
      }}
      position={position}
    >
      <a-entity
        position="0 0 0.01"
        text={`align: center; anchor: center; color: ${textColor}; value: ${escapeAframeTextValue(
          label,
        )}; width: ${textWidth}; wrapCount: ${wrapCount}`}
      />
    </a-entity>
  );
}

export default function VrAframeMobileHud({
  visible,
  repeatActionVisible,
  actionSheetVisible,
  actionSheetMode,
  quickActions,
  commonExtendedCommandNames,
  extendedCommandNames,
  logEnabled,
  logVisible,
  tiltDegrees,
  onOpenInventory,
  onToggleLog,
  onPickup,
  onSearch,
  onToggleActionSheet,
  onRepeatAction,
  onShowPauseMenu,
  onCloseActionSheet,
  onSetActionSheetMode,
  onSelectAction,
  onRunExtendedCommand,
  onAdjustTilt,
}: VrAframeMobileHudProps): JSX.Element | null {
  const [extendedPageIndex, setExtendedPageIndex] = useState(0);
  const extendedCommandsPerPage = 12;
  const extendedPageCount = Math.max(
    1,
    Math.ceil(extendedCommandNames.length / extendedCommandsPerPage),
  );
  const currentTiltDegrees = Number.isFinite(tiltDegrees)
    ? Math.round(tiltDegrees * 2) / 2
    : 0;
  const pagedExtendedCommands = useMemo(() => {
    const start = extendedPageIndex * extendedCommandsPerPage;
    return extendedCommandNames.slice(start, start + extendedCommandsPerPage);
  }, [extendedCommandNames, extendedPageIndex]);
  const commonCommands = useMemo(
    () => commonExtendedCommandNames.slice(0, 8),
    [commonExtendedCommandNames],
  );

  useEffect(() => {
    if (!actionSheetVisible || actionSheetMode !== "extended") {
      setExtendedPageIndex(0);
    }
  }, [actionSheetMode, actionSheetVisible]);

  useEffect(() => {
    setExtendedPageIndex((previous) => Math.min(previous, extendedPageCount - 1));
  }, [extendedPageCount]);

  if (!visible) {
    return null;
  }

  const panelHeight = actionSheetMode === "quick" ? 0.98 : 1.28;
  const panelTopY = panelHeight * 0.5;
  const headerY = panelTopY - 0.09;
  const quickGridColumns = 5;
  const quickButtonStartX = -0.66;
  const quickButtonStartY = 0.2;
  const quickButtonSpacingX = 0.33;
  const quickButtonSpacingY = 0.14;
  const extendedGridColumns = 4;
  const extendedButtonStartX = -0.57;
  const extendedButtonSpacingX = 0.38;
  const extendedButtonSpacingY = 0.14;

  return (
    <a-entity id="nh3d-vr-touch-hud" position="0 0 -1.08">
      {actionSheetVisible ? (
        <a-entity position="0 0.22 0">
          <a-entity
            geometry={`primitive: plane; width: 1.78; height: ${panelHeight}`}
            material="color: #08121f; opacity: 0.95; shader: flat"
            position="0 0 -0.01"
          />
          <a-entity
            geometry="primitive: plane; width: 1.78; height: 0.16"
            material="color: #10263f; opacity: 0.96; shader: flat"
            position={`0 ${headerY} 0`}
          />
          <a-entity
            position={`-0.62 ${headerY} 0.01`}
            text={`align: left; anchor: left; color: #fff6a8; value: ${escapeAframeTextValue(
              actionSheetMode === "quick" ? "Actions" : "Extended Commands",
            )}; width: 2.05; wrapCount: 30`}
          />
          {actionSheetMode === "extended" ? (
            <VrHudButton
              height={0.08}
              id="action-sheet-back"
              label="Back"
              onClick={() => onSetActionSheetMode("quick")}
              position={`0.12 ${headerY} 0.02`}
              textWidth={0.5}
              width={0.24}
            />
          ) : null}
          <VrHudButton
            height={0.08}
            id="action-sheet-menu"
            label="Menu"
            onClick={onShowPauseMenu}
            position={`0.4 ${headerY} 0.02`}
            textWidth={0.55}
            width={0.24}
          />
          <VrHudButton
            height={0.08}
            id="action-sheet-close"
            label="Close"
            onClick={onCloseActionSheet}
            position={`0.68 ${headerY} 0.02`}
            textWidth={0.55}
            tone="warn"
            width={0.24}
          />

          {actionSheetMode === "quick"
            ? quickActions.map((action, index) => {
                const column = index % quickGridColumns;
                const row = Math.floor(index / quickGridColumns);
                const x = quickButtonStartX + column * quickButtonSpacingX;
                const y = quickButtonStartY - row * quickButtonSpacingY;
                return (
                  <VrHudButton
                    height={0.1}
                    id={`quick-${action.id}`}
                    key={`quick-${action.id}`}
                    label={action.label}
                    onClick={() => onSelectAction(action)}
                    position={`${x} ${y} 0.02`}
                    textWidth={0.54}
                    width={0.29}
                    wrapCount={18}
                  />
                );
              })
            : (
              <>
                {commonCommands.length > 0 ? (
                  <>
                    <a-entity
                      position="-0.62 0.33 0.01"
                      text="align: left; anchor: left; color: #9db7cf; value: Common commands; width: 1.8; wrapCount: 30"
                    />
                    {commonCommands.map((command, index) => {
                      const column = index % extendedGridColumns;
                      const row = Math.floor(index / extendedGridColumns);
                      const x = extendedButtonStartX + column * extendedButtonSpacingX;
                      const y = 0.21 - row * 0.12;
                      return (
                        <VrHudButton
                          height={0.09}
                          id={`common-${command}`}
                          key={`common-${command}`}
                          label={command}
                          onClick={() => onRunExtendedCommand(command)}
                          position={`${x} ${y} 0.02`}
                          textWidth={0.64}
                          width={0.34}
                          wrapCount={18}
                        />
                      );
                    })}
                  </>
                ) : null}
                <a-entity
                  position="-0.62 -0.06 0.01"
                  text="align: left; anchor: left; color: #9db7cf; value: All commands; width: 1.8; wrapCount: 30"
                />
                {pagedExtendedCommands.map((command, index) => {
                  const column = index % extendedGridColumns;
                  const row = Math.floor(index / extendedGridColumns);
                  const x = extendedButtonStartX + column * extendedButtonSpacingX;
                  const y = -0.17 - row * extendedButtonSpacingY;
                  return (
                    <VrHudButton
                      height={0.1}
                      id={`all-${command}`}
                      key={`all-${command}`}
                      label={command}
                      onClick={() => onRunExtendedCommand(command)}
                      position={`${x} ${y} 0.02`}
                      textWidth={0.64}
                      width={0.34}
                      wrapCount={18}
                    />
                  );
                })}
                <VrHudButton
                  disabled={extendedPageIndex <= 0}
                  height={0.08}
                  id="extended-page-prev"
                  label="Prev"
                  onClick={() =>
                    setExtendedPageIndex((previous) =>
                      Math.max(0, previous - 1),
                    )
                  }
                  position="-0.48 -0.56 0.02"
                  textWidth={0.52}
                  width={0.24}
                />
                <a-entity
                  position="0 -0.56 0.01"
                  text={`align: center; anchor: center; color: #dbe9ff; value: ${extendedPageIndex + 1}/${extendedPageCount}; width: 0.9; wrapCount: 14`}
                />
                <VrHudButton
                  disabled={extendedPageIndex >= extendedPageCount - 1}
                  height={0.08}
                  id="extended-page-next"
                  label="Next"
                  onClick={() =>
                    setExtendedPageIndex((previous) =>
                      Math.min(extendedPageCount - 1, previous + 1),
                    )
                  }
                  position="0.48 -0.56 0.02"
                  textWidth={0.52}
                  width={0.24}
                />
              </>
            )}
        </a-entity>
      ) : null}

      {repeatActionVisible ? (
        <VrHudButton
          height={0.09}
          id="repeat-action"
          label="Repeat"
          onClick={onRepeatAction}
          position="-0.68 -0.25 0.02"
          textWidth={0.6}
          width={0.28}
        />
      ) : null}

      <a-entity position="0.68 -0.25 0">
        <a-entity
          geometry="primitive: plane; width: 0.5; height: 0.2"
          material="color: #0f1f31; opacity: 0.95; shader: flat"
          position="0 0 -0.01"
        />
        <a-entity
          position="0 0.06 0.01"
          text="align: center; anchor: center; color: #dbe9ff; value: Board tilt; width: 0.9; wrapCount: 16"
        />
        <VrHudButton
          height={0.08}
          id="tilt-minus"
          label="-"
          onClick={() => onAdjustTilt(-0.5)}
          position="-0.16 -0.04 0.02"
          textWidth={0.3}
          width={0.12}
          wrapCount={4}
        />
        <a-entity
          position="0 -0.04 0.01"
          text={`align: center; anchor: center; color: #fff6a8; value: ${Math.round(
            currentTiltDegrees,
          )}deg; width: 0.6; wrapCount: 14`}
        />
        <VrHudButton
          height={0.08}
          id="tilt-plus"
          label="+"
          onClick={() => onAdjustTilt(0.5)}
          position="0.16 -0.04 0.02"
          textWidth={0.3}
          width={0.12}
          wrapCount={4}
        />
      </a-entity>

      <a-entity position="0 -0.47 0">
        <a-entity
          geometry="primitive: plane; width: 1.78; height: 0.18"
          material="color: #0f1f31; opacity: 0.96; shader: flat"
          position="0 0 -0.01"
        />
        <VrHudButton
          height={0.11}
          id="mobile-bar-inventory"
          label="Inventory"
          onClick={onOpenInventory}
          position="-0.68 0 0.02"
          textWidth={0.66}
          width={0.3}
          wrapCount={16}
        />
        <VrHudButton
          disabled={!logEnabled}
          height={0.11}
          id="mobile-bar-log"
          label="Log"
          onClick={onToggleLog}
          position="-0.34 0 0.02"
          textWidth={0.54}
          tone={logVisible ? "primary" : "default"}
          width={0.3}
          wrapCount={16}
        />
        <VrHudButton
          height={0.11}
          id="mobile-bar-pickup"
          label="Pick Up"
          onClick={onPickup}
          position="0 0 0.02"
          textWidth={0.62}
          width={0.3}
          wrapCount={16}
        />
        <VrHudButton
          height={0.11}
          id="mobile-bar-search"
          label="Search"
          onClick={onSearch}
          position="0.34 0 0.02"
          textWidth={0.62}
          width={0.3}
          wrapCount={16}
        />
        <VrHudButton
          height={0.11}
          id="mobile-bar-actions"
          label="Actions"
          onClick={onToggleActionSheet}
          position="0.68 0 0.02"
          textWidth={0.62}
          tone={actionSheetVisible ? "primary" : "default"}
          width={0.3}
          wrapCount={16}
        />
      </a-entity>
    </a-entity>
  );
}
