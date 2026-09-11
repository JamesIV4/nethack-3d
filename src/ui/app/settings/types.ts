import type {
  Nh3dClientOptions
} from "../../../game/ui-types";

/** Client option descriptors, keys, tabs and safe-zone preview contracts. */
export type TilesetBackgroundRemovalMode =
  Nh3dClientOptions["tilesetBackgroundRemovalMode"];

export type ClientOptionToggle = {
  key: ClientOptionToggleKey;
  label: string;
  description: string;
  type: "boolean";
  developerOnly?: boolean;
};

export type ClientOptionSelect = {
  key:
  | "locale"
  | "tilesetMode"
  | "asciiColorMode"
  | "minimapColorMode"
  | "tilesetPath"
  | "antialiasing"
  | "inventoryFixedTileSize"
  | "desktopTouchInterfaceMode"
  | "bloodDetail";
  label: string;
  description: string;
  type: "select";
  disabled?: boolean;
  developerOnly?: boolean;
  options: {
    value: string;
    label: string;
  }[];
};

export type ClientOptionSlider = {
  key:
  | "brightness"
  | "contrast"
  | "gamma"
  | "minimapScale"
  | "uiFontScale"
  | "liveMessageLogFontScale"
  | "desktopMessageLogWindowScale"
  | "controllerFpsMoveRepeatMs"
  | "fpsFov"
  | "fpsLookSensitivityX"
  | "fpsLookSensitivityY"
  | "bloodStrength"
  | "liveMessageDisplayTimeMs"
  | "liveMessageFadeOutTimeMs"
  | "manualMobileBottomSafeZoneVerticalPx"
  | "manualMobileBottomSafeZoneHorizontalPx"
  | "manualMobileRightSafeZoneHorizontalPx";
  label: string;
  description: string;
  type: "slider";
  min: number;
  max: number;
  step: number;
  developerOnly?: boolean;
};

export type ClientOptionColor = {
  key: "bloodColorLightHex" | "bloodColorDarkHex" | "bloodMistColorHex";
  label: string;
  description: string;
  type: "color";
  developerOnly?: boolean;
};

export type ClientOptionGroupHeader = {
  key: string;
  label: string;
  type: "group";
  developerOnly?: boolean;
};

export type ClientOptionSectionHeader = {
  key: string;
  label: string;
  type: "section";
  developerOnly?: boolean;
};

export type ClientOption =
  | ClientOptionGroupHeader
  | ClientOptionSectionHeader
  | ClientOptionToggle
  | ClientOptionSelect
  | ClientOptionSlider
  | ClientOptionColor;

export type ClientOptionsTabId =
  | "display"
  | "mobile"
  | "controls"
  | "sound"
  | "combat"
  | "compatibility"
  | "updates";

export type ClientOptionsTab = {
  id: ClientOptionsTabId;
  label: string;
  description: string;
  groupKey: string;
};

export type ManualSafeZonePreview = {
  side: "bottom" | "right";
  sizePx: number;
};

export type ClientOptionToggleKey =
  | "fpsMode"
  | "lightingEnabled"
  | "fpsFlattenEntityBillboards"
  | "fpsHeldWeaponVisible"
  | "fpsWasdKeyboardMovementEnabled"
  | "showItemsUnderPlayerInOverheadTilesMode"
  | "controllerEnabled"
  | "invertLookYAxis"
  | "cameraRelativeMovement"
  | "snapCameraYawToNearest45"
  | "invertTouchPanningDirection"
  | "animatedMovement"
  | "disableAnimatedTransitions"
  | "uiTileBackgroundRemoval"
  | "minimap"
  | "reduceInventoryMotion"
  | "inventoryTileOnlyMotion"
  | "damageNumbers"
  | "displayStatChangesAbovePlayer"
  | "displayXpGainsAbovePlayer"
  | "tileShakeOnHit"
  | "bloodMist"
  | "bloodGround"
  | "monsterShatter"
  | "monsterShatterBloodBorders"
  | "liveMessageLog"
  | "showPersistentMobileMessageLog"
  | "rumbleEnabled"
  | "manualMobileBottomSafeZoneEnabled"
  | "showVersionNotificationsOnLaunch"
  | "soundEnabled"
  | "blockAmbientOcclusion"
  | "darkCorridorWalls367"
  | "overrideNh5DarkCorridorWallTiles"
  | "darkCorridorWallTileOverrideEnabled"
  | "darkCorridorWallSolidColorOverrideEnabled";

export type ClientOptionLookSensitivityKey =
  | "fpsLookSensitivityX"
  | "fpsLookSensitivityY";
