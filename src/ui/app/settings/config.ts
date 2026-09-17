import {
  nh3dFpsLookSensitivityMax,
  nh3dFpsLookSensitivityMin
} from "../../../game/ui-types";
import type {
  ClientOption,
  ClientOptionsTab,
  ClientOptionsTabId
} from "./types";
import {
  supportedLocaleOptions,
  t
} from "../shared/translations";

/** Ordered option descriptors and tabs with module-time labels and catalog choices. */
export const clientOptionsConfig: ClientOption[] = [
  {
    key: "group-controls",
    label: t.clientOptions.config.groupControls,
    type: "group",
  },
  {
    key: "section-controls-controller",
    label: t.clientOptions.config.sectionControlsController,
    type: "section",
  },
  {
    key: "controllerEnabled",
    label: t.clientOptions.config.controllerEnabled.label,
    description: t.clientOptions.config.controllerEnabled.description,
    type: "boolean",
  },
  {
    key: "section-controls-look",
    label: t.clientOptions.config.sectionControlsLook,
    type: "section",
  },
  {
    key: "invertLookYAxis",
    label: t.clientOptions.config.invertLookYAxis.label,
    description: t.clientOptions.config.invertLookYAxis.description,
    type: "boolean",
  },
  {
    key: "invertTouchPanningDirection",
    label: t.clientOptions.config.invertTouchPanningDirection.label,
    description: t.clientOptions.config.invertTouchPanningDirection.description,
    type: "boolean",
  },
  {
    key: "fpsLookSensitivityX",
    label: t.clientOptions.config.fpsLookSensitivityX.label,
    description: t.clientOptions.config.fpsLookSensitivityX.description,
    type: "slider",
    min: nh3dFpsLookSensitivityMin,
    max: nh3dFpsLookSensitivityMax,
    step: 0.01,
  },
  {
    key: "fpsLookSensitivityY",
    label: t.clientOptions.config.fpsLookSensitivityY.label,
    description: t.clientOptions.config.fpsLookSensitivityY.description,
    type: "slider",
    min: nh3dFpsLookSensitivityMin,
    max: nh3dFpsLookSensitivityMax,
    step: 0.01,
  },
  {
    key: "snapCameraYawToNearest45",
    label: t.clientOptions.config.snapCameraYawToNearest45.label,
    description: t.clientOptions.config.snapCameraYawToNearest45.description,
    type: "boolean",
  },
  {
    key: "section-controls-movement",
    label: t.clientOptions.config.sectionControlsMovement,
    type: "section",
  },
  {
    key: "cameraRelativeMovement",
    label: t.clientOptions.config.cameraRelativeMovement.label,
    description: t.clientOptions.config.cameraRelativeMovement.description,
    type: "boolean",
  },
  {
    key: "fpsWasdKeyboardMovementEnabled",
    label: t.clientOptions.config.fpsWasdKeyboardMovementEnabled.label,
    description:
      t.clientOptions.config.fpsWasdKeyboardMovementEnabled.description,
    type: "boolean",
  },
  {
    key: "controllerFpsMoveRepeatMs",
    label: t.clientOptions.config.controllerFpsMoveRepeatMs.label,
    description: t.clientOptions.config.controllerFpsMoveRepeatMs.description,
    type: "slider",
    min: 80,
    max: 900,
    step: 10,
  },
  {
    key: "group-interface",
    label: t.clientOptions.config.groupInterface,
    type: "group",
  },
  {
    key: "locale",
    label: t.clientOptions.config.locale.label,
    description: t.clientOptions.config.locale.description,
    type: "select",
    options: supportedLocaleOptions,
  },
  {
    key: "section-display-camera",
    label: t.clientOptions.config.sectionDisplayCamera,
    type: "section",
  },
  {
    key: "fpsMode",
    label: t.clientOptions.config.fpsMode.label,
    description: t.clientOptions.config.fpsMode.description,
    type: "boolean",
  },

  {
    key: "fpsFlattenEntityBillboards",
    label: t.clientOptions.config.fpsFlattenEntityBillboards.label,
    description: t.clientOptions.config.fpsFlattenEntityBillboards.description,
    type: "boolean",
  },
  {
    key: "fpsHeldWeaponVisible",
    label: t.clientOptions.config.fpsHeldWeaponVisible.label,
    description: t.clientOptions.config.fpsHeldWeaponVisible.description,
    type: "boolean",
  },
  {
    key: "showItemsUnderPlayerInOverheadTilesMode",
    label: t.clientOptions.config.showItemsUnderPlayerInOverheadTilesMode.label,
    description:
      t.clientOptions.config.showItemsUnderPlayerInOverheadTilesMode
        .description,
    type: "boolean",
  },
  {
    key: "fpsFov",
    label: t.clientOptions.config.fpsFov.label,
    description: t.clientOptions.config.fpsFov.description,
    type: "slider",
    min: 45,
    max: 110,
    step: 1,
  },
  {
    key: "section-display-graphics",
    label: t.clientOptions.config.sectionDisplayGraphics,
    type: "section",
  },
  {
    key: "tilesetMode",
    label: t.clientOptions.config.tilesetMode.label,
    description: t.clientOptions.config.tilesetMode.description,
    type: "select",
    options: [
      {
        value: "ascii",
        label: t.clientOptions.config.tilesetMode.options.ascii,
      },
      {
        value: "tiles",
        label: t.clientOptions.config.tilesetMode.options.tiles,
      },
      {
        value: "terminal",
        label: t.clientOptions.config.tilesetMode.options.terminal,
      },
    ],
  },
  {
    key: "asciiColorMode",
    label: t.clientOptions.config.asciiColorMode.label,
    description: t.clientOptions.config.asciiColorMode.description,
    type: "select",
    options: [
      {
        value: "nethack-3d",
        label: t.clientOptions.config.asciiColorMode.options.nethack3d,
      },
      {
        value: "classic",
        label: t.clientOptions.config.asciiColorMode.options.classic,
      },
      {
        value: "terminal",
        label: t.clientOptions.config.asciiColorMode.options.terminal,
      },
    ],
  },
  {
    key: "tilesetPath",
    label: t.clientOptions.config.tilesetPath.label,
    description: t.clientOptions.config.tilesetPath.description,
    type: "select",
    options: [],
    disabled: false,
  },
  {
    key: "tilesetUseTileAspectRatio",
    label: t.clientOptions.config.tilesetUseTileAspectRatio.label,
    description: t.clientOptions.config.tilesetUseTileAspectRatio.description,
    type: "boolean",
  },
  {
    key: "antialiasing",
    label: t.clientOptions.config.antialiasing.label,
    description: t.clientOptions.config.antialiasing.description,
    type: "select",
    options: [
      {
        value: "taa",
        label: t.clientOptions.config.antialiasing.options.taa,
      },
      {
        value: "fxaa",
        label: t.clientOptions.config.antialiasing.options.fxaa,
      },
    ],
  },
  {
    key: "lightingEnabled",
    label: t.clientOptions.config.lightingEnabled.label,
    description: t.clientOptions.config.lightingEnabled.description,
    type: "boolean",
  },
  {
    key: "blockAmbientOcclusion",
    label: t.clientOptions.config.blockAmbientOcclusion.label,
    description: t.clientOptions.config.blockAmbientOcclusion.description,
    type: "boolean",
  },
  {
    key: "brightness",
    label: t.clientOptions.config.brightness.label,
    description: t.clientOptions.config.brightness.description,
    type: "slider",
    min: -0.25,
    max: 0.25,
    step: 0.01,
  },
  {
    key: "contrast",
    label: t.clientOptions.config.contrast.label,
    description: t.clientOptions.config.contrast.description,
    type: "slider",
    min: -0.25,
    max: 0.25,
    step: 0.01,
  },
  {
    key: "gamma",
    label: t.clientOptions.config.gamma.label,
    description: t.clientOptions.config.gamma.description,
    type: "slider",
    min: 0.5,
    max: 2.5,
    step: 0.01,
  },
  {
    key: "section-display-interface",
    label: t.clientOptions.config.sectionDisplayInterface,
    type: "section",
  },
  {
    key: "uiFontScale",
    label: t.clientOptions.config.uiFontScale.label,
    description: t.clientOptions.config.uiFontScale.description,
    type: "slider",
    min: 0.7,
    max: 1.8,
    step: 0.01,
  },
  {
    key: "animatedMovement",
    label: t.clientOptions.config.animatedMovement.label,
    description: t.clientOptions.config.animatedMovement.description,
    type: "boolean",
  },
  {
    key: "disableAnimatedTransitions",
    label: t.clientOptions.config.disableAnimatedTransitions.label,
    description: t.clientOptions.config.disableAnimatedTransitions.description,
    type: "boolean",
  },
  {
    key: "uiTileBackgroundRemoval",
    label: t.clientOptions.config.uiTileBackgroundRemoval.label,
    description: t.clientOptions.config.uiTileBackgroundRemoval.description,
    type: "boolean",
  },
  {
    key: "desktopTouchInterfaceMode",
    label: t.clientOptions.config.desktopTouchInterfaceMode.label,
    description: t.clientOptions.config.desktopTouchInterfaceMode.description,
    type: "select",
    options: [
      {
        value: "off",
        label: t.clientOptions.config.desktopTouchInterfaceMode.options.off,
      },
      {
        value: "portrait",
        label:
          t.clientOptions.config.desktopTouchInterfaceMode.options.portrait,
      },
      {
        value: "landscape",
        label:
          t.clientOptions.config.desktopTouchInterfaceMode.options.landscape,
      },
    ],
  },
  {
    key: "section-display-messages",
    label: t.clientOptions.config.sectionDisplayMessages,
    type: "section",
  },
  {
    key: "desktopMessageLogWindowScale",
    label: t.clientOptions.config.desktopMessageLogWindowScale.label,
    description:
      t.clientOptions.config.desktopMessageLogWindowScale.description,
    type: "slider",
    min: 0.33,
    max: 1.5,
    step: 0.01,
  },
  {
    key: "liveMessageLog",
    label: t.clientOptions.config.liveMessageLog.label,
    description: t.clientOptions.config.liveMessageLog.description,
    type: "boolean",
  },
  {
    key: "liveMessageDisplayTimeMs",
    label: t.clientOptions.config.liveMessageDisplayTimeMs.label,
    description: t.clientOptions.config.liveMessageDisplayTimeMs.description,
    type: "slider",
    min: 250,
    max: 6000,
    step: 50,
  },
  {
    key: "liveMessageFadeOutTimeMs",
    label: t.clientOptions.config.liveMessageFadeOutTimeMs.label,
    description: t.clientOptions.config.liveMessageFadeOutTimeMs.description,
    type: "slider",
    min: 120,
    max: 4000,
    step: 20,
  },
  {
    key: "liveMessageLogFontScale",
    label: t.clientOptions.config.liveMessageLogFontScale.label,
    description: t.clientOptions.config.liveMessageLogFontScale.description,
    type: "slider",
    min: 0.7,
    max: 2.2,
    step: 0.01,
  },
  {
    key: "section-display-minimap",
    label: t.clientOptions.config.sectionDisplayMinimap,
    type: "section",
  },
  {
    key: "minimap",
    label: t.clientOptions.config.minimap.label,
    description: t.clientOptions.config.minimap.description,
    type: "boolean",
  },
  {
    key: "minimapColorMode",
    label: t.clientOptions.config.minimapColorMode.label,
    description: t.clientOptions.config.minimapColorMode.description,
    type: "select",
    options: [
      {
        value: "nethack-3d",
        label: t.clientOptions.config.minimapColorMode.options.nethack3d,
      },
      {
        value: "terminal",
        label: t.clientOptions.config.minimapColorMode.options.terminal,
      },
    ],
  },
  {
    key: "minimapScale",
    label: t.clientOptions.config.minimapScale.label,
    description: t.clientOptions.config.minimapScale.description,
    type: "slider",
    min: 0.6,
    max: 2.2,
    step: 0.01,
  },
  {
    key: "section-display-inventory",
    label: t.clientOptions.config.sectionDisplayInventory,
    type: "section",
  },
  {
    key: "reduceInventoryMotion",
    label: t.clientOptions.config.reduceInventoryMotion.label,
    description: t.clientOptions.config.reduceInventoryMotion.description,
    type: "boolean",
  },
  {
    key: "inventoryTileOnlyMotion",
    label: t.clientOptions.config.inventoryTileOnlyMotion.label,
    description: t.clientOptions.config.inventoryTileOnlyMotion.description,
    type: "boolean",
  },
  {
    key: "inventoryFixedTileSize",
    label: t.clientOptions.config.inventoryFixedTileSize.label,
    description: t.clientOptions.config.inventoryFixedTileSize.description,
    type: "select",
    options: [
      {
        value: "none",
        label: t.clientOptions.config.inventoryFixedTileSize.options.none,
      },
      {
        value: "small",
        label: t.clientOptions.config.inventoryFixedTileSize.options.small,
      },
      {
        value: "medium",
        label: t.clientOptions.config.inventoryFixedTileSize.options.medium,
      },
      {
        value: "large",
        label: t.clientOptions.config.inventoryFixedTileSize.options.large,
      },
    ],
  },
  {
    key: "group-mobile",
    label: t.clientOptions.config.groupMobileControls,
    type: "group",
  },
  {
    key: "section-mobile-messages",
    label: t.clientOptions.config.sectionDisplayMessages,
    type: "section",
  },
  {
    key: "showPersistentMobileMessageLog",
    label: t.clientOptions.config.showPersistentMobileMessageLog.label,
    description:
      t.clientOptions.config.showPersistentMobileMessageLog.description,
    type: "boolean",
  },
  {
    key: "rumbleEnabled",
    label: t.clientOptions.config.rumbleEnabled.label,
    description: t.clientOptions.config.rumbleEnabled.description,
    type: "boolean",
  },
  {
    key: "section-mobile-safe-zone",
    label: t.clientOptions.config.sectionMobileSafeZone,
    type: "section",
  },
  {
    key: "manualMobileBottomSafeZoneEnabled",
    label: t.clientOptions.config.manualMobileBottomSafeZoneEnabled.label,
    description:
      t.clientOptions.config.manualMobileBottomSafeZoneEnabled.description,
    type: "boolean",
  },
  {
    key: "manualMobileBottomSafeZoneVerticalPx",
    label: t.clientOptions.config.manualMobileBottomSafeZoneVerticalPx.label,
    description:
      t.clientOptions.config.manualMobileBottomSafeZoneVerticalPx.description,
    type: "slider",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "manualMobileBottomSafeZoneHorizontalPx",
    label: t.clientOptions.config.manualMobileBottomSafeZoneHorizontalPx.label,
    description:
      t.clientOptions.config.manualMobileBottomSafeZoneHorizontalPx.description,
    type: "slider",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "manualMobileRightSafeZoneHorizontalPx",
    label: t.clientOptions.config.manualMobileRightSafeZoneHorizontalPx.label,
    description:
      t.clientOptions.config.manualMobileRightSafeZoneHorizontalPx.description,
    type: "slider",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "group-sound",
    label: t.clientOptions.config.groupSound,
    type: "group",
  },
  {
    key: "soundEnabled",
    label: t.clientOptions.config.soundEnabled.label,
    description: t.clientOptions.config.soundEnabled.description,
    type: "boolean",
  },
  {
    key: "group-combat",
    label: t.clientOptions.config.groupCombat,
    type: "group",
  },
  {
    key: "damageNumbers",
    label: t.clientOptions.config.damageNumbers.label,
    description: t.clientOptions.config.damageNumbers.description,
    type: "boolean",
  },
  {
    key: "displayStatChangesAbovePlayer",
    label: t.clientOptions.config.displayStatChangesAbovePlayer.label,
    description:
      t.clientOptions.config.displayStatChangesAbovePlayer.description,
    type: "boolean",
  },
  {
    key: "displayXpGainsAbovePlayer",
    label: t.clientOptions.config.displayXpGainsAbovePlayer.label,
    description: t.clientOptions.config.displayXpGainsAbovePlayer.description,
    type: "boolean",
  },
  {
    key: "tileShakeOnHit",
    label: t.clientOptions.config.tileShakeOnHit.label,
    description: t.clientOptions.config.tileShakeOnHit.description,
    type: "boolean",
  },
  {
    key: "sectionCombatBlood",
    label: t.clientOptions.config.sectionCombatBlood,
    type: "section",
  },
  {
    key: "bloodMist",
    label: t.clientOptions.config.bloodMist.label,
    description: t.clientOptions.config.bloodMist.description,
    type: "boolean",
  },
  {
    key: "bloodGround",
    label: t.clientOptions.config.bloodGround.label,
    description: t.clientOptions.config.bloodGround.description,
    type: "boolean",
  },
  {
    key: "bloodStrength",
    label: t.clientOptions.config.bloodStrength.label,
    description: t.clientOptions.config.bloodStrength.description,
    type: "slider",
    min: 1,
    max: 2.5,
    step: 0.05,
  },
  {
    key: "bloodDetail",
    label: t.clientOptions.config.bloodDetail.label,
    description: t.clientOptions.config.bloodDetail.description,
    type: "select",
    options: [
      {
        value: "veryLow",
        label: t.clientOptions.config.bloodDetail.options.veryLow,
      },
      {
        value: "low",
        label: t.clientOptions.config.bloodDetail.options.low,
      },
      {
        value: "medium",
        label: t.clientOptions.config.bloodDetail.options.medium,
      },
      {
        value: "high",
        label: t.clientOptions.config.bloodDetail.options.high,
      },
    ],
  },
  {
    key: "bloodColorLightHex",
    label: t.clientOptions.config.bloodColorLightHex.label,
    description: t.clientOptions.config.bloodColorLightHex.description,
    type: "color",
  },
  {
    key: "bloodColorDarkHex",
    label: t.clientOptions.config.bloodColorDarkHex.label,
    description: t.clientOptions.config.bloodColorDarkHex.description,
    type: "color",
  },
  {
    key: "bloodMistColorHex",
    label: t.clientOptions.config.bloodMistColorHex.label,
    description: t.clientOptions.config.bloodMistColorHex.description,
    type: "color",
  },
  {
    key: "monsterShatter",
    label: t.clientOptions.config.monsterShatter.label,
    description: t.clientOptions.config.monsterShatter.description,
    type: "boolean",
  },
  {
    key: "monsterShatterBloodBorders",
    label: t.clientOptions.config.monsterShatterBloodBorders.label,
    description: t.clientOptions.config.monsterShatterBloodBorders.description,
    type: "boolean",
  },
  {
    key: "group-compatibility",
    label: t.clientOptions.config.groupCompatibility,
    type: "group",
  },
  {
    key: "darkCorridorWalls367",
    label: t.clientOptions.config.darkCorridorWalls367.label,
    description: t.clientOptions.config.darkCorridorWalls367.description,
    type: "boolean",
  },
  {
    key: "overrideNh5DarkCorridorWallTiles",
    label: t.clientOptions.config.overrideNh5DarkCorridorWallTiles.label,
    description:
      t.clientOptions.config.overrideNh5DarkCorridorWallTiles.description,
    type: "boolean",
  },
  {
    key: "darkCorridorWallTileOverrideEnabled",
    label: t.clientOptions.config.darkCorridorWallTileOverrideEnabled.label,
    description:
      t.clientOptions.config.darkCorridorWallTileOverrideEnabled.description,
    type: "boolean",
  },
  {
    key: "darkCorridorWallSolidColorOverrideEnabled",
    label:
      t.clientOptions.config.darkCorridorWallSolidColorOverrideEnabled.label,
    description:
      t.clientOptions.config.darkCorridorWallSolidColorOverrideEnabled
        .description,
    type: "boolean",
  },
  { key: "group-vr", label: "Virtual reality", type: "group" },
  {
    key: "vrPassthrough",
    label: "Mixed reality in VR",
    description: "Show your room around the board or dungeon. Takes effect the next time you enter VR.",
    type: "boolean",
  },
];

export const clientOptionsDefaultTabId: ClientOptionsTabId = "display";

export const clientOptionsTabs: ClientOptionsTab[] = [
  {
    id: "display",
    label: t.clientOptions.tabs.display.label,
    description: t.clientOptions.tabs.display.description,
    groupKey: "group-interface",
  },
  { id: "buttons", label: "Hotbar", description: "Customize hotbars and Menu / Actions shortcuts.", groupKey: "group-buttons" },
  { id: "vr", label: "VR", description: "Headset presentation and tabletop settings.", groupKey: "group-vr" },
  {
    id: "controls",
    label: t.clientOptions.tabs.controls.label,
    description: t.clientOptions.tabs.controls.description,
    groupKey: "group-controls",
  },
  {
    id: "mobile",
    label: t.clientOptions.tabs.mobile.label,
    description: t.clientOptions.tabs.mobile.description,
    groupKey: "group-mobile",
  },
  {
    id: "sound",
    label: t.clientOptions.tabs.sound.label,
    description: t.clientOptions.tabs.sound.description,
    groupKey: "group-sound",
  },
  {
    id: "combat",
    label: t.clientOptions.tabs.combat.label,
    description: t.clientOptions.tabs.combat.description,
    groupKey: "group-combat",
  },
  {
    id: "compatibility",
    label: t.clientOptions.tabs.compatibility.label,
    description: t.clientOptions.tabs.compatibility.description,
    groupKey: "group-compatibility",
  },
  {
    id: "updates",
    label: t.clientOptions.tabs.updates.label,
    description: t.clientOptions.tabs.updates.description,
    groupKey: "group-updates",
  },
];

export function getClientOptionsForGroup(groupKey: string): ClientOption[] {
  const options: ClientOption[] = [];
  let currentGroupKey = "";
  for (const option of clientOptionsConfig) {
    if (option.type === "group") {
      currentGroupKey = option.key;
      continue;
    }
    if (currentGroupKey === groupKey) {
      options.push(option);
    }
  }
  if (groupKey === "group-vr") {
    const view = clientOptionsConfig.find(option => option.key === "fpsMode");
    if (view) options.unshift(view);
  }
  return options;
}
