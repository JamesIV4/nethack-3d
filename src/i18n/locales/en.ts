export const en = {
  meta: {
    locale: "en-US",
  },
  common: {
    appName: "NetHack 3D",
    confirm: "Confirm",
    cancel: "Cancel",
    close: "Close",
    back: "Back",
    yes: "Yes",
    no: "No",
    delete: "Delete",
    edit: "Edit",
    done: "Done",
    resetToDefaults: "Reset to Defaults",
    later: "Later",
    checking: "Checking...",
    downloading: "Downloading...",
    canceling: "Canceling...",
    none: "None",
    off: "Off",
    normal: "Normal",
    fps: "FPS",
  },
  controller: {
    groups: {
      movement: "Movement",
      lookAndCamera: "Look And Camera",
      actions: "Actions",
      dialogs: "Dialogs",
      system: "System",
    },
    actions: {
      dpad_up: {
        label: "D-Pad Up",
        description: "Navigate upward in dialogs and movement highlight.",
      },
      dpad_down: {
        label: "D-Pad Down",
        description: "Navigate downward in dialogs and movement highlight.",
      },
      dpad_left: {
        label: "D-Pad Left",
        description: "Navigate left in dialogs and movement highlight.",
      },
      dpad_right: {
        label: "D-Pad Right",
        description: "Navigate right in dialogs and movement highlight.",
      },
      left_stick_up: {
        label: "Left Stick Up",
        description: "Movement highlight and virtual cursor up.",
      },
      left_stick_down: {
        label: "Left Stick Down",
        description: "Movement highlight and virtual cursor down.",
      },
      left_stick_left: {
        label: "Left Stick Left",
        description: "Movement highlight and virtual cursor left.",
      },
      left_stick_right: {
        label: "Left Stick Right",
        description: "Movement highlight and virtual cursor right.",
      },
      right_stick_up: {
        label: "Right Stick Up",
        description: "Look, camera pan, and dialog scrolling up.",
      },
      right_stick_down: {
        label: "Right Stick Down",
        description: "Look, camera pan, and dialog scrolling down.",
      },
      right_stick_left: {
        label: "Right Stick Left",
        description: "Look and camera pan left.",
      },
      right_stick_right: {
        label: "Right Stick Right",
        description: "Look and camera pan right.",
      },
      confirm: {
        label: "Confirm / Click",
        description: "Confirm movement and click in dialogs.",
      },
      search: {
        label: "Search",
        description: "Search current tile when no movement preview is active.",
      },
      cancel_or_context: {
        label: "Cancel / Context",
        description: "Open context actions or cancel current dialog.",
      },
      action_menu: {
        label: "Action Menu",
        description: "Open controller radial action menu.",
      },
      run_modifier: {
        label: "Run Modifier",
        description: "Hold to send run prefix before movement.",
      },
      zoom_in: {
        label: "Zoom (Hold)",
        description:
          "Hold, then use left stick up/down to zoom and right stick to rotate the camera.",
      },
      recenter_camera: {
        label: "Recenter Camera",
        description: "Return camera to player center.",
      },
      toggle_large_minimap: {
        label: "Toggle Large Minimap",
        description: "Toggle very large minimap size.",
      },
      pause_menu: {
        label: "Pause Menu",
        description: "Open or close pause menu.",
      },
      open_inventory: {
        label: "Inventory",
        description: "Open inventory window.",
      },
      open_character: {
        label: "Character Sheet",
        description: "Open character sheet window.",
      },
    },
    buttonLabels: {
      0: "A",
      1: "B",
      2: "X",
      3: "Y",
      4: "Left Bumper",
      5: "Right Bumper",
      6: "Left Trigger",
      7: "Right Trigger",
      8: "Back / View",
      9: "Start / Menu",
      10: "Left Stick Click",
      11: "Right Stick Click",
      12: "D-Pad Up",
      13: "D-Pad Down",
      14: "D-Pad Left",
      15: "D-Pad Right",
      16: "Home",
    },
    axisLabels: {
      0: "Left Stick X",
      1: "Left Stick Y",
      2: "Right Stick X",
      3: "Right Stick Y",
    },
    directions: {
      leftStickLeft: "Left Stick Left",
      leftStickRight: "Left Stick Right",
      leftStickUp: "Left Stick Up",
      leftStickDown: "Left Stick Down",
      rightStickLeft: "Right Stick Left",
      rightStickRight: "Right Stick Right",
      rightStickUp: "Right Stick Up",
      rightStickDown: "Right Stick Down",
    },
    unbound: "Unbound",
    axisFallback: (axisIndex: number) => `Axis ${axisIndex}`,
    buttonFallback: (buttonIndex: number) => `Button ${buttonIndex}`,
    slotLabel: (slotIndex: number) => `Slot ${slotIndex + 1}`,
    listening: "Press input...",
    clear: "Clear",
    controllerDetected: (count: number) =>
      `${count} controller${count === 1 ? "" : "s"} detected.`,
    noControllerDetected: "No controller detected.",
  },
  startupInitOptions: {
    accordion: {
      summary: "Initialization options (optional)",
      description:
        "Additional NetHack `OPTIONS` entries applied at startup. Window-port and platform-specific options are intentionally omitted.",
      resetToDefaults: "Reset to defaults",
    },
    options: {
      playmode: {
        label: "Play Mode",
        description:
          "Choose startup mode. Wizard mode is NetHack debug mode (`playmode:debug`).",
        options: {
          normal: "Normal",
          explore: "Explore",
          debug: "Wizard/Debug",
        },
      },
      number_pad: {
        label: "Movement Keys",
        description:
          "Choose whether NetHack movement uses the numeric keypad (`number_pad:1`) or traditional vi keys (`number_pad:0`).",
        options: {
          numeric: "Numeric keypad",
          vi: "vi keys",
        },
      },
      autopickup: {
        label: "Autopickup",
        description:
          "Automatically pick up item classes selected in pickup types.",
      },
      pickup_types: {
        label: "Pickup Types",
        description:
          'Object class symbols to autopickup (example: $"=/!?+). Leave blank for game default.',
        placeholder: '$"=/!?+',
      },
      pickup_thrown: {
        label: "Pickup Thrown Items",
        description: "Automatically pick up thrown items when they land.",
      },
      pickup_burden: {
        label: "Pickup Burden Threshold",
        description:
          "Prompt before pickup when this encumbrance level would be exceeded.",
        options: {
          u: "Unencumbered (u)",
          b: "Burdened (b)",
          s: "Stressed (s)",
          n: "Strained (n)",
          t: "Overtaxed (t)",
          l: "Overloaded (l)",
        },
      },
      pile_limit: {
        label: "Pile Limit",
        description:
          "Item count threshold that triggers a popup list for floor piles.",
      },
      autoquiver: {
        label: "Autoquiver",
        description: "Auto-fill quiver or ready a suitable weapon when firing.",
      },
      autoopen: {
        label: "Autoopen",
        description: "Automatically try to open doors while moving into them.",
      },
      autodig: {
        label: "Autodig",
        description:
          "Automatically dig into walls when able and moving into them.",
      },
      cmdassist: {
        label: "Command Assist",
        description: "Show extra help text when commands are mistyped.",
      },
      confirm: {
        label: "Confirm Attacks",
        description: "Ask before attacking peaceful creatures.",
      },
      safe_pet: {
        label: "Safe Pet",
        description: "Ask before hitting your pet.",
      },
      help: {
        label: "In-Game Help",
        description:
          "Prompt to show extra look/help details when more information exists.",
      },
      legacy: {
        label: "Legacy Intro",
        description: "Show the story intro when a new game begins.",
      },
      rest_on_space: {
        label: "Rest On Space",
        description: "Treat space key as wait/rest.",
      },
      pushweapon: {
        label: "Push Weapon",
        description: "Move currently wielded weapon to offhand when swapping.",
      },
      extmenu: {
        label: "Extended Command Menu",
        description: "Use a menu popup for extended commands.",
      },
      fixinv: {
        label: "Fix Inventory Letters",
        description: "Try to preserve inventory letters as items move.",
      },
      implicit_uncursed: {
        label: "Show Uncursed",
        description:
          "Always include the word 'uncursed' in inventory descriptions.",
      },
      mention_walls: {
        label: "Mention Walls",
        description: "Show a message when moving against a wall.",
      },
      sortloot: {
        label: "Sort Loot Lists",
        description:
          "Sorting behavior for pickup and inventory selection lists.",
        options: {
          f: "Full",
          l: "Loot-only",
          n: "None",
        },
      },
      sortpack: {
        label: "Sort Inventory",
        description: "Sort pack contents by type when showing inventory.",
      },
      msghistory: {
        label: "Message History Size",
        description: "Number of top-line messages retained for recall.",
      },
      dogname: {
        label: "Dog Name",
        description: "Default name for your first dog.",
        placeholder: "Fido",
      },
      catname: {
        label: "Cat Name",
        description: "Default name for your first cat.",
        placeholder: "Morris",
      },
      horsename: {
        label: "Horse Name",
        description: "Default name for your first horse.",
        placeholder: "Silver",
      },
      pettype: {
        label: "Preferred Pet",
        description: "Preferred initial pet type for roles that can vary.",
        options: {
          default: "Game default",
          cat: "Cat",
          dog: "Dog",
          horse: "Horse",
          none: "None",
        },
      },
      fruit: {
        label: "Preferred Fruit",
        description: "Name of the fruit type your character enjoys.",
        placeholder: "slime mold",
      },
      packorder: {
        label: "Pack Order",
        description: "Order of item classes shown in inventory.",
        placeholder: '")[%?+/=!(*0_`',
      },
      paranoid_confirmation: {
        label: "Paranoid Confirmation",
        description:
          "Space-separated extra confirmations (example: confirm quit attack pray).",
        placeholder: "confirm quit attack pray",
      },
      sparkle: {
        label: "Magic Resistance Sparkle",
        description: "Show special sparkle effects for magic resistance.",
      },
      standout: {
        label: "Standout Monsters/More",
        description: "Bold monsters and --More-- prompts.",
      },
      tombstone: {
        label: "Tombstone",
        description: "Show tombstone graphic at death.",
      },
      verbose: {
        label: "Verbose Messages",
        description: "Use fuller status and action message wording.",
      },
    },
  },
  soundEffects: {
    byKey: {
      "player-walk": "Player walk",
      hit: "Hit",
      "monster-killed": "Monster killed (player)",
      "monster-killed-other": "Monster killed (other)",
      "missed-attack": "Missed attack",
      "thrown-weapon": "Thrown weapon",
      "door-opens": "Door opens",
      "door-closes": "Door closes",
      "door-kick": "Door kick",
      "door-smash": "Door smash",
      "door-resists": "Door resists",
      "door-distant": "Door in the distance",
      "walk-down-stairs": "Walk down stairs",
      "walk-up-stairs": "Walk up stairs",
      eating: "Eating",
      drink: "Drink",
      "quaff-potion": "Quaff a potion",
      "pickup-gold": "Pick up gold",
      "pickup-item": "Pick up item",
      "find-hidden": "Find hidden door/passage",
      "level-up": "Level up",
      unlock: "Unlock",
      "boulder-push": "Boulder push",
      "boulder-blocked": "Boulder blocked",
      splash: "Splash",
      searching: "Searching",
      "magic-cast": "Magic cast",
      "magic-heal": "Magic heal",
      "magic-buff": "Magic buff",
    },
  },
  characterSheet: {
    titleFallback: "Character Sheet",
    sectionTitles: {
      overview: "Overview",
      background: "Background",
      basics: "Basics",
      characteristics: "Current Characteristics",
      status: "Current Status",
      attributes: "Current Attributes",
    },
    statLabels: {
      strength: "Strength",
      dexterity: "Dexterity",
      constitution: "Constitution",
      intelligence: "Intelligence",
      wisdom: "Wisdom",
      charisma: "Charisma",
    },
    commands: {
      enhance: {
        label: "Enhance",
        detail: "Level up skills",
      },
      conduct: {
        label: "Conduct",
        detail: "Show challenge progress",
      },
      overview: {
        label: "Overview",
        detail: "Show dungeon progress",
      },
      spells: {
        label: "Spells",
        detail: "Review known spells",
      },
      seespells: {
        label: "Spellbook",
        detail: "List spell inventory",
      },
      technique: {
        label: "Technique",
        detail: "Use role/race abilities",
      },
      known: {
        label: "Discoveries",
        detail: "Known object list",
      },
      pray: {
        label: "Pray",
        detail: "Attempt prayer",
      },
    },
  },
  castMenu: {
    schoolLabel: "School:",
    headings: {
      name: "Name",
      level: "Level",
      category: "Category",
      fail: "Fail",
      retention: "Retention",
    },
    summary: {
      known: (count: number) => `${count} known`,
      castable: (count: number) => `${count} castable`,
      bestSuccess: (percent: number) => `Best success ${percent}%`,
      averageFail: (percent: number) => `Avg fail ${percent}%`,
      schoolCount: (count: number) =>
        `${count} school${count === 1 ? "" : "s"}`,
    },
    retention: {
      unknown: "Unknown",
      gone: "Gone",
      full: "100%",
    },
  },
  enhanceMenu: {
    defaultGroupTitle: "Skills",
    availability: {
      available_now: "Available",
      needs_experience: "Exp/Slots",
      needs_practice: "Practice",
      maxed_out: "Maxed",
    },
    summary: {
      available: (count: number) => `${count} available`,
      gated: (count: number) => `${count} gated by experience/slots`,
      practice: (count: number) => `${count} need practice`,
      maxed: (count: number) => `${count} maxed`,
    },
    maxLabel: "Max",
    slotCount: (count: number) => `${count} slot${count === 1 ? "" : "s"}`,
  },
  app: {
    unknownTime: "Unknown time",
    debugSession: {
      possibleCrash: "possible crash",
      active: "active",
    },
    debugLogs: {
      buildLabelAria: (
        buildLabel: string,
        currentCount: number,
        requiredCount: number,
      ) =>
        `Build ${buildLabel}. Hidden debug logging toggle progress ${currentCount} of ${requiredCount}.`,
      enabledToast: "Debug log enabled",
      enabledLogEntry: "Debug log enabled from startup build label easter egg.",
      openLink: "View debug logs",
      clearedLogEntry: "Stored debug logs cleared by user.",
    },
    statusEffects: {
      turningToStone: "Turning to Stone",
      slimed: "Slimed",
      strangled: "Strangled",
      foodPoisoning: "Food Poisoning",
      terminallyIll: "Terminally Ill",
      blind: "Blind",
      deaf: "Deaf",
      stunned: "Stunned",
      confused: "Confused",
      hallucinating: "Hallucinating",
      levitating: "Levitating",
      flying: "Flying",
      riding: "Riding",
      barehanded: "Barehanded",
      busy: "Busy",
      iron: "Iron",
      glowingHands: "Glowing Hands",
      grabbed: "Grabbed",
      held: "Held",
      icy: "Icy",
      inLava: "In Lava",
      paralyzed: "Paralyzed",
      sleeping: "Sleeping",
      slippery: "Slippery",
      submerged: "Submerged",
      tethered: "Tethered",
      trapped: "Trapped",
      unconscious: "Unconscious",
      woundedLegs: "Wounded Legs",
      holding: "Holding",
    },
    characterStats: {
      descriptions: {
        strength:
          "Affects melee damage, carrying capacity, and forcing actions.",
        dexterity:
          "Affects hit chance, trap interaction, and defensive agility.",
        constitution:
          "Affects HP growth and resistance to poison and drain effects.",
        intelligence:
          "Affects reading and success with many spell-related actions.",
        wisdom: "Affects spell energy growth and spell-casting reliability.",
        charisma:
          "Affects shop interactions, pet handling, and social outcomes.",
      },
      armorClassDescription:
        "Lower is better. Armor Class reduces enemy hit chance against you.",
    },
    directionHelp: {
      controller:
        "Click a direction, or use left stick/DPAD to preview and release to confirm. Center circle targets self. Use < or > for stairs. Press ESC to cancel.",
      numpad:
        "Click a direction. Center circle targets self. You can also use numpad (1-4,6-9), arrow keys, <, >, or s. Press ESC to cancel.",
      viKeys:
        "Click a direction. Center circle targets self. You can also use hjkl/yubn, arrow keys, <, >, or s. Press ESC to cancel.",
      fps: "Look to aim. Left-click or W confirms. S targets self. A/D or right-click cancels.",
    },
    inventoryContextActions: {
      apply: "Apply",
      invoke: "Invoke",
      tip: "Tip",
      loot: "Loot",
      drop: "Drop",
      eat: "Eat",
      quaff: "Quaff",
      read: "Read",
      rub: "Rub",
      throw: "Throw",
      wield: "Wield",
      quiver: "Quiver",
      wear: "Wear",
      takeOff: "Take Off",
      putOn: "Put On",
      remove: "Remove",
      zap: "Zap",
      untrap: "Untrap",
      offer: "Offer",
      name: "Name",
      call: "Call",
      adjust: "Adjust",
      engrave: "Engrave",
      dip: "Dip",
      info: "Info",
      unwield: "Unwield",
    },
    mobileActions: {
      wait: "Wait",
      zap: "Zap",
      cast: "Cast",
      kick: "Kick",
      read: "Read",
      quaff: "Quaff",
      eat: "Eat",
      glance: "Glance",
      loot: "Loot",
      open: "Open",
      wield: "Wield",
      wear: "Wear",
      putOn: "Put On",
      takeOff: "Take Off",
      extended: "Extended",
    },
    clientOptions: {
      config: {
        groupControls: "Controller and first-person mode",
        sectionControlsController: "Controller",
        controllerEnabled: {
          label: "Enable controller support",
          description: "Enable gamepad input for gameplay and UI dialogs.",
        },
        sectionControlsLook: "Look and camera",
        invertLookYAxis: {
          label: "Invert Y-axis look",
          description: "Invert vertical mouselook and touch-look direction.",
        },
        fpsLookSensitivityX: {
          label: "FPS Look Sensitivity X",
          description: "Horizontal mouselook/touch-look sensitivity.",
        },
        fpsLookSensitivityY: {
          label: "FPS Look Sensitivity Y",
          description: "Vertical mouselook/touch-look sensitivity.",
        },
        snapCameraYawToNearest45: {
          label: "Snap camera yaw to 45 degrees",
          description:
            "When camera rotation input is released, smoothly snap yaw to the nearest 45 degree angle.",
        },
        sectionControlsMovement: "Movement behavior",
        cameraRelativeMovement: {
          label: "Camera-relative movement and swipes",
          description:
            "Rotate movement keys and swipe directions based on the camera Y-axis angle.",
        },
        fpsWasdKeyboardMovementEnabled: {
          label: "Enable WASD keyboard movement in FPS mode",
          description:
            "Use W/A/S/D for first-person movement. Disable to let those keys behave like normal NetHack commands.",
        },
        controllerFpsMoveRepeatMs: {
          label: "FPS left-stick move repeat",
          description:
            "Movement repeat delay for left stick in FPS mode (lower is faster).",
        },
        groupInterface: "Interface",
        locale: {
          label: "Language",
          description:
            "Choose the interface language. Defaults to your browser region when supported, with English as the fallback.",
          options: {
            en: "English",
          },
        },
        sectionDisplayCamera: "Camera and perspective",
        fpsMode: {
          label: "First-person mode",
          description: "Use first-person controls and mouselook.",
        },
        fpsFlattenEntityBillboards: {
          label: "Flatten overlapping tile sprites",
          description:
            "Flatten tile sprites for loot or dungeon features when monsters, pets, or the player stand on them. Disable to keep overlapping sprites as standing billboards. Vulture tiles always stay standing.",
        },
        fpsHeldWeaponVisible: {
          label: "Show FPS weapon",
          description: "Display the held weapon sprite in first-person mode.",
        },
        showItemsUnderPlayerInOverheadTilesMode: {
          label: "Show under-player items in overhead tiles",
          description:
            "Show items and floor features under the player in overhead tiles mode using runtime underlay glyph data.",
        },
        fpsFov: {
          label: "FPS Field of View",
          description: "Adjust first-person camera FOV.",
        },
        sectionDisplayGraphics: "Graphics and rendering",
        tilesetMode: {
          label: "Display",
          description: "Use graphical tiles instead of ASCII.",
          options: {
            ascii: "ASCII",
            tiles: "Tiles",
          },
        },
        tilesetPath: {
          label: "Tileset",
          description: "Built-in and uploaded tilesets.",
        },
        antialiasing: {
          label: "Antialiasing",
          description: "Edge smoothing mode for 3D rendering.",
          options: {
            taa: "TAA",
            fxaa: "FXAA",
          },
        },
        lightingEnabled: {
          label: "Lighting",
          description:
            "Enable dynamic scene lighting and dungeon darkening. Turn off for flatter always-lit rendering.",
        },
        blockAmbientOcclusion: {
          label: "Ambient occlusion",
          description:
            "Adds subtle contact shadowing between floor and wall blocks.",
        },
        brightness: {
          label: "Brightness",
          description: "Adjust overall scene brightness.",
        },
        contrast: {
          label: "Contrast",
          description: "Adjust global contrast of rendered scene content.",
        },
        gamma: {
          label: "Gamma",
          description: "Adjust display gamma for rendered scene content.",
        },
        sectionDisplayInterface: "Interface",
        uiFontScale: {
          label: "UI font scale",
          description: "Scale all game UI font sizes from their defaults.",
        },
        disableAnimatedTransitions: {
          label: "Disable animated transitions",
          description:
            "Turn off interface fade, motion, and transition animations for snappier UI changes.",
        },
        uiTileBackgroundRemoval: {
          label: "Remove tile backgrounds in UI",
          description:
            "Apply tile/chroma background removal to tile icons shown in UI panels.",
        },
        desktopTouchInterfaceMode: {
          label: "Desktop touch interface",
          description:
            "Show touch controls on desktop and choose portrait or landscape layout.",
          options: {
            off: "Off",
            portrait: "Use portrait touch UI",
            landscape: "Use landscape touch UI",
          },
        },
        sectionDisplayMessages: "Messages and log",
        desktopMessageLogWindowScale: {
          label: "Desktop message log window scale",
          description:
            "Scale the boxed desktop message log window size without changing font size.",
        },
        liveMessageLog: {
          label: "Live message log",
          description: "Display the scrolling in-game message log.",
        },
        showPersistentMobileMessageLog: {
          label: "Show persistent message log",
          description:
            "Keep the compact mobile message log visible during gameplay. The Log button can still open the larger log.",
        },
        rumbleEnabled: {
          label: "Enable rumble",
          description:
            "Use short haptic vibration feedback for damage dealt and damage taken on supported mobile devices.",
        },
        sectionMobileSafeZone: "Mobile safe zones",
        manualMobileBottomSafeZoneEnabled: {
          label: "Override detected mobile safe zones",
          description:
            "Use manual safe-zone insets when Android handhelds report safe areas incorrectly.",
        },
        manualMobileBottomSafeZoneVerticalPx: {
          label: "Vertical orientation bottom safe zone",
          description:
            "Manual bottom safe zone for portrait or vertical mobile layout.",
        },
        manualMobileBottomSafeZoneHorizontalPx: {
          label: "Horizontal orientation bottom safe zone",
          description:
            "Manual bottom safe zone for landscape or horizontal mobile layout.",
        },
        manualMobileRightSafeZoneHorizontalPx: {
          label: "Horizontal orientation right safe zone",
          description:
            "Manual right-side safe zone for landscape mobile layout.",
        },
        manualMobileBottomSafeZonePreview: "Bottom safe zone",
        manualMobileRightSafeZonePreview: "Right safe zone",
        liveMessageDisplayTimeMs: {
          label: "Live message display time",
          description:
            "Time a floating message stays fully visible before fading.",
        },
        liveMessageFadeOutTimeMs: {
          label: "Live message fade-out time",
          description: "Duration of floating message fade-out animation.",
        },
        liveMessageLogFontScale: {
          label: "Live message font scale",
          description:
            "Scale the fade-up floating action messages from their default size.",
        },
        sectionDisplayMinimap: "Minimap",
        minimap: {
          label: "Minimap",
          description: "Show or hide the dungeon minimap.",
        },
        minimapScale: {
          label: "Minimap scale",
          description: "Scale the minimap size from its default.",
        },
        sectionDisplayInventory: "Inventory presentation",
        reduceInventoryMotion: {
          label: "Reduce inventory motion",
          description:
            "Disable animated inventory row expansion and use simpler interactions.",
        },
        inventoryTileOnlyMotion: {
          label: "Animate inventory tiles only",
          description:
            "Animate icon tiles while keeping inventory row height and spacing fixed.",
        },
        inventoryFixedTileSize: {
          label: "Fixed inventory tile size",
          description:
            "Applies only when Reduce inventory motion is enabled. Choose a fixed icon size.",
          options: {
            none: "None",
            small: "Small",
            medium: "Medium",
            large: "Large",
          },
        },
        groupSound: "Sound",
        soundEnabled: {
          label: "Enable sound",
          description:
            "Turn FMOD audio on or off. Disabling reduces audio processing overhead on lower-end devices.",
        },
        groupMobileControls: "Mobile controls",
        invertTouchPanningDirection: {
          label: "Invert panning direction",
          description: "Reverse drag direction for panning after hold-to-pan starts.",
        },
        groupCombat: "Combat feedback",
        damageNumbers: {
          label: "Damage numbers",
          description: "Show floating damage and healing numbers.",
        },
        displayStatChangesAbovePlayer: {
          label: "Display stat changes above player",
          description:
            "Show floating labels for stat changes such as Strength and AC.",
        },
        displayXpGainsAbovePlayer: {
          label: "Display XP gains above player",
          description:
            "Show floating XP gain labels when experience increases.",
        },
        tileShakeOnHit: {
          label: "Tile shake on hit",
          description: "Shake impact tiles when combat lands.",
        },
        sectionCombatBlood: "Blood effects",
        blood: {
          label: "Blood",
          description: "Render blood mist and ground splat effects on hits.",
        },
        bloodMist: {
          label: "Blood mist",
          description: "Render airborne blood mist particles on hits.",
        },
        bloodGround: {
          label: "Blood splatter",
          description:
            "Render blood splatter on dungeon floor tiles after hits.",
        },
        bloodStrength: {
          label: "Blood strength",
          description: "Control how strongly blood textures and tinting read.",
        },
        bloodDetail: {
          label: "Blood detail",
          description:
            "Choose the blood splat texture resolution per dungeon tile.",
          options: {
            veryLow: "Very Low",
            low: "Low",
            medium: "Medium",
            high: "High",
          },
        },
        bloodColorLightHex: {
          label: "Ground blood fresh tint",
          description:
            "Pick the brighter blood tint used in fresh ground splats.",
        },
        bloodColorDarkHex: {
          label: "Ground blood dark tint",
          description:
            "Pick the darker blood tint used in dense ground blood areas.",
        },
        bloodMistColorHex: {
          label: "Blood mist tint",
          description: "Pick the base tint used for airborne blood mist.",
        },
        monsterShatter: {
          label: "Monster shatter",
          description:
            "Split defeated monster billboards into physical shard pieces.",
        },
        monsterShatterBloodBorders: {
          label: "Shatter blood borders",
          description:
            "Tint shard pixels near split lines with randomized blood-red edges.",
        },
        groupCompatibility: "Runtime compatibility",
        darkCorridorWalls367: {
          label: "Legacy dark corridor walls",
          description:
            "Infer and cache dark corridor wall tiles for legacy NetHack 3.4.3/3.6.x-style runtimes, including Slash'EM.",
        },
        overrideNh5DarkCorridorWallTiles: {
          label: "Override NetHack 5.0 dark wall tiles",
          description:
            "Apply dark wall override settings to NetHack 5.0 dark corridor wall tiles.",
        },
        darkCorridorWallTileOverrideEnabled: {
          label: "Override dark wall tile",
          description:
            "Use a custom atlas tile for dark wall overrides, saved per tileset.",
        },
        darkCorridorWallSolidColorOverrideEnabled: {
          label: "Use solid color for dark walls",
          description: "Use a picked RGB color instead of a tileset tile.",
        },
      },
      tabs: {
        display: {
          label: "Display",
          description: "Interface and display settings.",
        },
        mobile: {
          label: "Mobile",
          description: "Mobile-specific interface and gameplay settings.",
        },
        controls: {
          label: "Controls",
          description: "Controller mappings, FPS mode, and look behavior.",
        },
        sound: {
          label: "Sound",
          description: "Audio output and performance-related sound controls.",
        },
        combat: {
          label: "Combat",
          description: "Combat impact feedback and visual response.",
        },
        compatibility: {
          label: "Compatibility",
          description: "Runtime compatibility and NetHack behavior toggles.",
        },
        updates: {
          label: "Updates",
          description:
            "Check for online game updates and review pending changes.",
        },
      },
    },
    update: {
      loading: {
        startupData: "Loading startup data...",
        tileset: "Loading tileset...",
        runtime: "Starting local runtime...",
      },
      runtimeStoppedBeforeStartup:
        "The local NetHack runtime stopped before startup finished.",
      preparingDownload: "Preparing version check...",
      idleStatus: "Version check is idle.",
      fileProgress: (index: number, count: number) =>
        `File ${index} of ${count}`,
      unexpectedCheckFailure: "Unexpected update check failure.",
      cancelRequested: "Cancel requested.",
      stoppingActiveDownloadTask: "Stopping active download task.",
      unableToCancelDownload: "Unable to cancel update download.",
      noActiveDownloadToCancel: "No active update download to cancel.",
      startingDownload: "Starting game update download.",
      canceled: "Update download was canceled.",
      unableToDownloadAndApply: "Unable to download and apply updates.",
      failed: "Update failed.",
      latestAlreadyInstalled: "Latest update already installed.",
      downloadComplete: "Update download complete.",
      nothingAppliedTryAgain:
        "No updates were applied. Please try checking again.",
      noFilesApplied: "No update files were applied.",
      unexpectedFailure: "Unexpected update failure.",
      checkingForUpdates: "Checking GitHub releases...",
      unsupportedPlatform:
        "GitHub release checks are not available on this platform.",
      latestAlreadyInstalledOptions:
        "You already have the newest game version.",
      oneUpdateAvailable:
        "A newer game version is available. Would you like to update?",
      manyUpdatesAvailable: (count: number) =>
        `${count} newer game versions are available. Would you like to update?`,
      updateCheckFailed: (message: string) =>
        `GitHub release check failed: ${message}`,
    },
    saves: {
      sections: {
        manual: "Manual Saves",
        autosave: "Autosaves",
      },
      deleteTitle: "Delete Saved Game?",
      deleteMessage: (name: string) =>
        `Are you sure you want to delete ${name}?`,
      overwriteTitle: "Overwrite Saved Game?",
      overwriteMessage: (name: string) =>
        `A saved game named "${name}" already exists. Do you want to overwrite it with a new character?`,
      errorLoading: "Error loading saves",
      loading: "Loading saves...",
      noneFound: "No saved games found.",
      savedAt: (date: string) => `Saved: ${date}`,
    },
    tilesets: {
      userTileset: "User Tileset",
      currentSelectionFallback: "this tileset",
      deleteUploadedTitle: "Delete Uploaded Tileset?",
      deleteUploadedMessage: (label: string) =>
        `Delete '${label}' from uploaded tilesets?`,
      failedToDelete: "Failed to delete tileset.",
      chooseFile: "Choose a PNG/BMP/GIF/JPEG tileset file.",
      provideName: "Provide a name for this tileset.",
      failedToSave: "Failed to save tileset.",
      failedToLoadUploaded: "Failed to load uploaded tilesets:",
      userTilesetSuffix: "User Tileset (user)",
      noTilesetsFound: "No tilesets found",
      failedToReadImage: "Failed to read tileset image.",
    },
    tilePicker: {
      noAtlasAvailable: "No tileset atlas available.",
      unableToLoadAtlas: "Unable to load tile atlas.",
      atlasLoaded: "Tile atlas loaded.",
      loadingAtlas: "Loading tile atlas...",
      selectedTile: (tileId: number) => `Selected: tile #${tileId}`,
      glyph: (label: string) => `Glyph ${label}`,
      tile: (tileId: number) => `Tile ${tileId}`,
      defaultBadge: "Default",
      resetToDefault: "Reset to default",
      darkWallTitle: "Dark Wall Tile Picker",
      closeDarkWall: "Close dark wall tile picker",
      closeBackground: "Close tileset background tile picker",
      backgroundHelper:
        "Used for removing shared tileset background from monster/loot billboards.",
      backgroundTitle: "Tileset Background Tile Picker",
      backgroundTitleWithLabel: (label: string) =>
        `Tileset Background Tile Picker: ${label}`,
      closeSolidColor: "Close solid chroma key color picker",
      solidColorTitle: "Solid Color Chroma Key Picker",
      solidColorTitleWithLabel: (label: string) =>
        `Solid Color Chroma Key Picker: ${label}`,
    },
    soundPack: {
      discardChangesTitle: "Discard Sound Pack Changes?",
      discardChangesMessage: "Discard unsaved sound pack changes and continue?",
      discard: "Discard",
      keepEditing: "Keep Editing",
      failedToLoadIndexedDb: "Failed to load sound packs from IndexedDB.",
      failedToSelectRequested: "Failed to select the requested sound pack.",
      provideName: "Provide a sound pack name.",
      created: (name: string) => `Created sound pack '${name}'.`,
      failedToCreate: "Failed to create sound pack.",
      saved: (name: string) => `Saved sound pack '${name}'.`,
      failedToSave: "Failed to save sound pack.",
      failedToExportZip: "Failed to export sound pack ZIP.",
      exported: (name: string) => `Exported '${name}'.`,
      failedToImportZip: "Failed to import sound pack ZIP.",
      imported: (name: string) => `Imported sound pack '${name}'.`,
      deleteTitle: "Delete Sound Pack?",
      deleteMessage: (name: string) =>
        `Delete sound pack '${name}'? This cannot be undone.`,
      deleted: (name: string) => `Deleted sound pack '${name}'.`,
      failedToDelete: "Failed to delete sound pack.",
      noPreviewSource: "No preview source available for this sound.",
      unableToPreview: "Unable to preview this sound.",
      title: "Sound Packs",
      activePack: "Active sound pack",
      activePackDescription:
        "Select the active sound pack used for sound path resolution.",
      createNew: "Create New Sound Pack",
      createDescription: "Create a custom sound pack that overrides defaults.",
      createNameLabel: "New sound pack name",
      createPlaceholder: "My Sound Pack",
      createAndSave: "Create and save",
      packName: "Pack name",
      packNameDescription:
        "Rename this pack and save to update its sound file namespace.",
      savePack: "Save sound pack",
      export: "Export sound pack",
      import: "Import sound pack",
      deletePack: "Delete sound pack",
      stopPreview: "Stop preview",
      loading: "Loading sound packs...",
      pendingSaveSuffix: " (pending save)",
      defaultSuffix: " (default)",
      customSuffix: " (custom)",
      noBundledSound: "No bundled sound",
      enableSoundAria: (label: string) => `Enable ${label}`,
      volumeAria: (label: string) => `Volume for ${label}`,
      play: "Play",
      playing: "Playing...",
      volume: "Volume",
      remove: "Remove",
      replace: "Replace",
      soundFile: "Sound file",
      reset: "Reset",
      attribution: "Attribution",
      attributionAria: (label: string) => `Attribution for ${label}`,
      attributionPlaceholder: "Source, creator, or license details",
      addVariation: "+ Add variation",
    },
    dialogs: {
      pauseMenu: {
        saveBeforeQuit: "Do you want to save before quitting?",
        title: "Game Paused",
        resume: "Resume",
        options: "Options",
        saveGame: "Save game",
        exitToMainMenu: "Exit to main menu",
        quitGame: "Quit Game",
      },
      debugLogs: {
        closeLabel: "Close debug logs",
        title: "Saved Debug Logs",
        hint: "Logs are only captured after the hidden debug log toggle is enabled.",
        showingEntries: (count: number, startedAt: string) =>
          `Showing ${count} entries from ${startedAt}.`,
        noneSaved: "No saved debug logs yet.",
        refresh: "Refresh",
        clearLogs: "Clear Logs",
      },
      startupUpdate: {
        maintenanceNotice: "No newer GitHub releases were found.",
        summaryAvailable:
          "A newer game version is available. Would you like to update?",
        summaryNone: "You already have the newest game version.",
        currentVersion: (version: string) => `Current version: ${version}`,
        latestVersion: (version: string) => `Latest GitHub release: ${version}`,
        disableAtStartup: "Don't show these notifications again at startup.",
        disabledNotice:
          "Startup release notifications are now off. You can re-enable them again in Options.",
        clientUpgradeRequired:
          "A full client upgrade is also required for the newest platform enhancements.",
        progressTitle: "Update Download Status",
        canceling: "Canceling update download...",
        noActiveTransfer: "No active file transfer.",
        waitingForUpdater: "Waiting for updater activity.",
        pendingUpdates: "Pending Updates",
        payloadAvailable: "Update payload is available.",
        downloadUpdates: "Download Updates",
        hideDetails: "Hide Details",
        moreDetails: "More Details",
        cancelDownload: "Cancel Download",
      },
      startup: {
        chooseVariant: "Choose your NetHack variant:",
        options: "NetHack 3D Options",
        quitGame: "Quit Game",
        chooseSetup: "Choose your character setup:",
        randomCharacter: "Random character",
        createCharacter: "Create character",
        loadGame: "Load game",
        selectSavedGame: "Select a saved game:",
        enterRandomName: "Enter a name for your random character:",
        createCharacterPrompt: "Create your character:",
        name: "Name",
        role: "Role",
        race: "Race",
        gender: "Gender",
        alignment: "Alignment",
        startGame: "Start game",
      },
      clientOptions: {
        closeLabel: "Close NetHack 3D options",
        title: "NetHack 3D Client Options",
        categoriesLabel: "Settings categories",
        updates: {
          checkOnLaunchLabel: "Show GitHub release notifications on launch",
          checkOnLaunchDescription:
            "Checks GitHub releases at startup and lets you know when a newer release exists.",
          title: "GitHub Releases",
          description:
            "Compare this build against the published GitHub releases.",
          idle: "Press Check for Updates to compare this build against GitHub releases.",
          button: "Check for Updates",
          openGitHubReleases: "Open GitHub Releases",
        },
        buttons: {
          manageTileSets: "Manage Tile Sets",
          remapController: "Remap Controller",
          resetControllerDefaults: "Reset Controller Defaults",
        },
        hints: {
          darkWallsAlwaysEnabled:
            " Always enabled while Vulture tiles are active.",
          darkWallsDisabledByVulture:
            " Disabled while Vulture tiles are active.",
          enableDarkWallsFirst:
            " Enable legacy dark corridor walls or NetHack 5.0 dark wall overrides first.",
          enableFpsFirst: " Enable First-person mode in Display first.",
        },
        darkWallControls: {
          normal: "Normal",
          fps: "FPS",
          normalAria: "Dark wall solid color (normal mode)",
          fpsAria: "Dark wall solid color (FPS mode)",
          gridLines: "Grid lines",
          intensity: "Intensity",
        },
        controllerRemap: {
          title: "Controller Remap",
          closeLabel: "Close controller remap",
          hint: "Select a slot, then press a button or move a stick. Each action has two slots.",
          listeningFor: (label: string, slot: number) =>
            `Listening for ${label} (slot ${slot}). Press ESC to cancel.`,
        },
        resetPrompt:
          "Reset NetHack 3D options to defaults? Custom tile sets will be kept.",
      },
      tilesetManager: {
        closeLabel: "Close tileset manager",
        title: "Manage Tile Sets",
        description:
          "Add tile sets and edit per-tileset background/chroma settings.",
        createTitle: "Create New Tile Set",
        editTitle: "Edit Tile Set",
        editTitleWithName: (label: string) => `Edit Tile Set: ${label}`,
        tileSetName: "Tile Set Name",
        tileSetPlaceholder: "My Tileset",
        builtInNamesLocked: "Built-in tile set names cannot be changed.",
        tileLayoutVersion: "Tile Layout Version",
        layout367: "NetHack 3.6.7 layout",
        layout5: "NetHack 5.0 layout",
        tileLayoutDescription:
          "Choose the tile index layout used by this uploaded atlas.",
        tileImage: "Tileset Image",
        tileImageOptional: "Tileset Image (optional replacement)",
        selectedFile: (fileName: string) => `Selected: ${fileName}`,
        currentFile: (fileName: string) => `Current: ${fileName}`,
        uploadedImage: "uploaded image",
        weaponSpriteFlip: "Flip FPS Weapon Sprite",
        weaponSpriteFlipDescription:
          "Flip the held weapon sprite horizontally for this tileset. Enabled by default.",
        backgroundRemovalDescription:
          "Configure billboard background removal for this tileset, or leave both modes off to keep atlas backgrounds intact.",
        backgroundTileRemoval: "Background Tile Removal",
        backgroundTileRemovalDescription:
          "Use a selected atlas tile for billboard background removal.",
        solidChromaKey: "Solid Color Chroma Key",
        solidChromaKeyDescription:
          "Use a single solid RGB color for billboard background removal.",
        clickToPickFromAtlas: "click to pick from atlas",
        saveFirstThenEdit:
          "Save the new tile set first, then edit background/chroma settings.",
        createTileSet: "Create Tile Set",
        saveTileSet: "Save Tile Set",
        saveTileSettings: "Save Tile Settings",
        importNewTileSet: "+ Import New Tile Set",
        noUploadedTilesets: "No uploaded tilesets available.",
        selectedSuffix: " (selected)",
        editingSuffix: " (editing)",
        uploadedDetails: (fileName: string, layout: string) =>
          `${fileName} | uploaded | layout ${layout}`,
        builtInDetails: (path: string) => `${path} | built-in`,
      },
      textInput: {
        cancelLabel: "Cancel text input",
        placeholder: "Enter text",
        ok: "OK",
      },
      question: {
        cancelPrompt: "Cancel prompt",
        selectAll: "Select All",
        deselectAll: "Deselect All",
        amount: "Amount",
        amountDefault: "Default",
        clearAmount: "Clear amount",
        decreaseAmount: "Decrease amount by one",
        increaseAmount: "Increase amount by one",
        page: (current: number, total: number) => `Page ${current} / ${total}`,
        pageHintMultiple: "Use < and > to change pages. Press ESC to cancel",
        pageHintSingle: "Press ESC to cancel",
        choices: {
          leftRingFinger: "Left ring-finger",
          rightRingFinger: "Right ring-finger",
          here: "Here",
          onGround: "On ground",
          eligibleItems: "Eligible items",
          allInventory: "All inventory",
        },
      },
      runtimeStartError: {
        closeLabel: "Return to main menu",
        title: "NetHack failed to initialize.",
        returnToMainMenu: "Return to main menu",
      },
      newGamePrompt: {
        closeLabel: "Close new game prompt",
        title: "Return to main menu?",
        reasonFallback: "Game over",
      },
      direction: {
        cancelLabel: "Cancel direction prompt",
      },
      info: {
        closeCharacter: "Close character window",
        closeInformation: "Close information window",
        characterTitle: "Character",
        experienceProgress: "Experience Progress",
        levelLabel: (level: number) => `Level ${level}`,
        xpAtMaxLevel: (xp: string) => `XP ${xp} (max level reached)`,
        xpToNextLevel: (xp: string, next: string, remaining: string) =>
          `XP ${xp} / ${next} • ${remaining} to next level`,
        vitals: "Vitals",
        characteristics: "Characteristics",
        currentLimit: "Current / Limit",
        armorClass: "Armor Class",
        currentStatus: "Current Status",
        noActiveStatus: "No active status.",
        currentAttributes: "Current Attributes",
        noTemporaryAttributes: "No temporary attribute effects.",
        characterActions: "Character Actions",
        inventory: "Inventory",
        inventoryDetail: "Open carried items",
        closeHint:
          "Press SPACE, ENTER, or ESC to close. Press Ctrl+M to reopen.",
        infoTitleFallback: "NetHack Information",
        noDetails: "(No details)",
      },
      inventory: {
        closeLabel: "Close inventory",
        title: "INVENTORY",
        empty: "Your inventory is empty.",
        unknownItem: "Unknown item",
        closeHint: "Press ENTER, ESC, or 'i' to close.",
        closeHintWithContext:
          "Select an item to open contextual commands. Press ENTER, ESC, or 'i' to close",
      },
      inventoryDropMenu: {
        title: "Drop",
        dropType: "Drop Type",
        dropAmount: "Drop Amount",
        dropSpecificAmount: "Drop a specific amount",
        onlyStackedItems: "Only available for stacked items",
      },
      inventoryDropCount: {
        title: "Drop how many from this stack?",
        chooseAmount: (max: number) => `Choose an amount from 1 to ${max}.`,
        ariaLabel: "Drop amount",
        setMinimum: "Set drop amount to minimum",
        decrease: "Decrease drop amount by one",
        increase: "Increase drop amount by one",
        setMaximum: "Set drop amount to maximum",
      },
      mobileActions: {
        extendedCommands: "Extended Commands",
        commonCommands: "Common commands",
        allCommands: "All commands",
        actions: "Actions",
        menu: "Menu",
        close: "Close",
        wizardCommands: "Wizard Commands",
        wizard: "Wizard",
        wizardCommandFallbackDescription: "Run this wizard-only debug command.",
        wizardCommandDetails: {
          levelchange: {
            name: "Level change",
            description: "Set the hero's experience level.",
          },
          lightsources: {
            name: "Light sources",
            description: "Show mobile light sources.",
          },
          migratemons: {
            name: "Migrating monsters",
            description: "Show monsters moving between levels.",
          },
          panic: {
            name: "Panic test",
            description: "Test panic handling and end this game.",
          },
          polyself: {
            name: "Polymorph self",
            description: "Change the hero's current form.",
          },
          seenv: {
            name: "Seen vectors",
            description: "Show the seen-vector debug map.",
          },
          stats: {
            name: "Memory statistics",
            description: "Show runtime memory statistics.",
          },
          timeout: {
            name: "Timeout queue",
            description: "Show timed effects and intrinsics.",
          },
          vanquished: {
            name: "Vanquished monsters",
            description: "Show dead monster counts.",
          },
          vision: {
            name: "Vision array",
            description: "Show the current vision array.",
          },
          wizbury: {
            name: "Bury nearby objects",
            description: "Bury ground objects in a 3x3 area.",
          },
          wizdetect: {
            name: "Detect hidden things",
            description: "Reveal hidden things near the hero.",
          },
          wizgenesis: {
            name: "Create monster",
            description: "Create a monster by name or class.",
          },
          wizidentify: {
            name: "Identify inventory",
            description: "Identify every item in inventory.",
          },
          wizintrinsic: {
            name: "Set intrinsics",
            description: "Adjust selected timed intrinsics.",
          },
          wizlevelport: {
            name: "Level teleport",
            description: "Teleport to another level or branch.",
          },
          wizmakemap: {
            name: "Recreate level",
            description: "Generate the current level again.",
          },
          wizmap: {
            name: "Map level",
            description: "Reveal the level map and traps.",
          },
          wizrumorcheck: {
            name: "Check rumors",
            description: "Validate true and false rumor files.",
          },
          wizsmell: {
            name: "Smell monster",
            description: "Smell a selected monster.",
          },
          wizwhere: {
            name: "Special levels",
            description: "Show where special levels are placed.",
          },
          wizwish: {
            name: "Wish",
            description: "Create an item, trap, or terrain.",
          },
          wmode: {
            name: "Wall modes",
            description: "Show wall-mode debug data.",
          },
        },
        repeat: "Repeat",
        character: "Character",
        inventory: "Inventory",
        log: "Log",
        pickUp: "Pick Up",
        search: "Search",
        closeMessageLog: "Close message log",
      },
      positionPrompt: {
        closeLabel: "Close position prompt",
        desktopHint:
          "Use movement input or click a tile to move the selection. Click the selected tile again or press Enter to confirm.",
        mobileHint:
          "Use movement input or tap a tile to move the selection. Tap the selected tile again or press Enter to confirm.",
        controllerHint:
          "Use movement input to move the selection. Press Enter or Confirm to confirm.",
      },
      controllerSupport: {
        prompt: "Controller detected. Enable controller support?",
      },
    },
  },
} as const;

type WidenTranslationLiterals<T> = T extends (...args: any[]) => any
  ? T
  : T extends string
    ? string
    : T extends number
      ? number
      : T extends boolean
        ? boolean
        : T extends bigint
          ? bigint
          : T extends symbol
            ? symbol
            : T extends readonly (infer U)[]
              ? readonly WidenTranslationLiterals<U>[]
              : T extends object
                ? { readonly [K in keyof T]: WidenTranslationLiterals<T[K]> }
                : T;

export type TranslationDictionary = WidenTranslationLiterals<typeof en>;
