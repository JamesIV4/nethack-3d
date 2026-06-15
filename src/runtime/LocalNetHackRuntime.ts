// @ts-nocheck
import RuntimeInputBroker from "./input/RuntimeInputBroker";
import { getBundledDisplayFile } from "./displayFileCatalog";
import type { NethackRuntimeVersion } from "./types";
import {
  appendRequiredStartupInitOptionTokens,
  getAutomaticRuntimeInitOptionTokens,
  sanitizeStartupInitOptionTokens,
} from "./startup-init-options";
import {
  hasRuntimeCheckpointRecoveryPrimitiveExport,
  supportsRuntimeCheckpointRecovery,
} from "./runtime-capabilities";
import {
  getRuntimeSaveDbName,
  getRuntimeSaveMountDir,
  isRecoverableCheckpointLevelZeroByteLength,
} from "./save-storage";
import { STATUS_FIELD_MAP_367, STATUS_FIELD_MAP_5, STATUS_FIELD_MAP_EVILHACK } from "./status-map";

const process =
  typeof globalThis !== "undefined" && globalThis.process
    ? globalThis.process
    : { env: {} };

const SLASHEM_META_EXTENDED_COMMAND_NAME_BY_KEY = Object.freeze({
  a: "adjust",
  b: "borrow",
  c: "chat",
  d: "dip",
  e: "enhance",
  f: "force",
  i: "invoke",
  j: "jump",
  l: "loot",
  m: "monster",
  n: "name",
  o: "offer",
  p: "pray",
  q: "quit",
  r: "rub",
  s: "sit",
  t: "technique",
  u: "untrap",
  v: "version",
  w: "wipe",
  y: "youpoly",
});

class LocalNetHackRuntime {
  constructor(eventHandler, startupOptions = null) {
    this.runtimeVersion = "3.6.7";
    this.eventHandler = eventHandler;
    this.startupOptions =
      startupOptions && typeof startupOptions === "object"
        ? startupOptions
        : {};
    this.isClosed = false;
    this.nethackInstance = null;
    this.gameMap = new Map();
    this.playerPosition = { x: 0, y: 0 };
    this.gameMessages = [];
    this.lastPromptContextMessage = "";
    this.lastPromptContextEntry = null;
    this.promptContextHistory = [];
    this.recentUICallbackHistory = [];
    this.latestInventoryItems = [];
    this.latestStatusUpdates = new Map();
    this.currentMenuItems = [];
    this.currentWindow = null;
    this.currentMenuQuestionText = "";
    this.hasShownCharacterSelection = false;
    this.lastQuestionText = null; // Store the last question for menu expansion
    this.activeYnPrompt = null;
    this.legacyAutoHelpYnPromptSignature = "";
    this.legacyAutoHelpYnPromptUntilMs = 0;

    // Multi-pickup selection tracking
    this.menuSelections = new Map(); // Track selected items: key=menuChar, value={menuChar, originalAccelerator, menuIndex}
    this.isInMultiPickup = false;
    this.pendingMenuSelection = null;
    this.menuSelectionReadyCount = null;
    this.lastEndedMenuWindow = null;
    this.lastEndedMenuHadQuestion = false;
    this.lastEndedInventoryMenuKind = null;
    this.lastMenuInteractionCancelled = false;
    this.windowTextBuffers = new Map();
    this.messageHistorySnapshot = [];
    this.messageHistorySnapshotIndex = 0;
    this.pendingGameOverPossessionsInventoryFlow = false;
    this.gameOverSequenceActive = false;
    this.gameOverEmptyRawPrintCount = 0;
    this.lastGameOverHow = null;
    this.lastGameOverWhen = null;
    this.runtimeTerminationEmitted = false;
    this.lastGameOverDeathSummary = "";
    this.lastKnownPlayerName = "";
    this.lastKnownGold = null;

    this.inputBroker = new RuntimeInputBroker();
    this.farLookMode = "none"; // none | armed | active
    this.farLookOrigin = null; // null | "direct" | "look_menu" | "floor_target_menu" | "legacy_cursor_prompt" | "travel"
    this.pendingLookMenuFarLookArm = false;
    this.pendingLegacySlashEmCursorPromptFarLook = false;
    this.pendingTravelPositionInputArm = false;
    this.pendingTextResponses = [];
    this.pendingStdinByteQueue = [];
    this.didAutoQueueRawRecoverChoice = false;
    this.positionInputActive = false;
    this.positionCursor = null;
    this.activeInputRequest = null;
    this.awaitingQuestionInput = false;
    this.numberPadModeEnabled = true;
    this.metaInputPrefix = "__META__:";
    this.ctrlInputPrefix = "__CTRL__:";
    this.menuSelectionInputPrefix = "__MENU_SELECT__:";
    this.textInputPrefix = "__TEXT_INPUT__:";
    this.inventoryContextSelectionPrefix = "__INVCTX_SELECT__:";
    this.inventoryContextSelectionCountPrefix = "__INVCTX_SELECT_COUNT__:";
    this.contextualGlanceProbePrefix = "__CTX_GLANCE_PROBE__";
    this.contextualLookInfoProbePrefix = "__CTX_LOOK_INFO_PROBE__";
    this.contextualGlanceProbeMouseDeadlineMs = 0;
    this.contextualGlanceAutoCancelPositionUntilMs = 0;
    this.contextualGlanceAutoCancelPositionWindowMs = 450;
    this.contextualLookInfoProbeMouseDeadlineMs = 0;
    this.contextualLookInfoProbeMouseWindowMs = 5000;
    this.pendingContextualLookMapRouteSelection = false;
    this.contextualLookInfoAutoFlowStage = "none";
    this.contextualLookInfoAutoFlowUntilMs = 0;
    this.runtime5TileContextAutoPickFirstUntilMs = 0;
    this.runtime5TileContextAutoPickFirstWindowMs = 2000;
    this.pendingPostActionPlayerTileRefreshReason = null;
    this.pendingPostActionPlayerTileRefreshTarget = null;
    this.pendingPostActionPlayerTileRefreshSnapshot = null;
    this.pendingInventoryContextSelection = null;
    this.pendingTextRequest = null;
    this.deferredTileRefreshKeys = new Set();
    this.deferredAreaRefreshRequests = new Map();
    this.deferredTileRefreshFlushScheduled = false;
    this.textInputMaxLength = 256;
    this.mouseInputTokenKey = "__MOUSE_INPUT__";
    this.mouseClickPrimaryMod = 1; // CLICK_1 (left click)
    this.mouseClickSecondaryMod = 2; // CLICK_2 (right click)
    this.extendedCommandEntries = null;
    this.pendingExtendedCommand = null;
    this.extendedCommandTriggerQueued = false;
    this.pendingExtendedCommandRequest = null;
    this.startupExtmenuEnabled = this.resolveStartupExtmenuEnabled(
      this.startupOptions?.initOptions,
    );
    this.statusPending = new Map();
    this.nameRequestDebugCounter = 0;
    this.nameInitDebugCounter = 0;
    this.travelSpeedDelayMs = 60; // Default to normal
    this.travelClickMoveBlockExtraMs = 5;
    this.clickMoveBlockedUntilMs = 0;
    this.playerPositionMovementSerial = 0;
    this.lastAppliedDelayOutputTurn = null;
    this.lastAppliedDelayOutputPosition = null;
    this.lastAppliedDelayOutputAtMs = null;
    this.lastAppliedDelayOutputMovementSerial = null;
    this.didLogMissingLevelIdentityGlobals = false;
    this.checkpointRecoverySupported = false;
    this.resumeCheckpointSave = null;
    this.runtimePointerContract = null;
    this.runtimePointerContractValidated = false;
    this.pointerContractViolationKeys = new Set();
    this.uiCallbackCount = 0;
    this.startupNoCallbackTimer = null;
    this.lastConfiguredNethackOptions = "";

    this.ready = this.initializeNetHack();
  }

  normalizeRuntimeVersion(value) {
    return value === "5.0" || value === "slashem" || value === "evilhack" ? value : "3.6.7";
  }

  getDefaultRuntimeWindowGlobals(runtimeVersion = this.runtimeVersion) {
    return {
      WIN_MESSAGE: 1,
      WIN_STATUS: 2,
      WIN_MAP: 3,
      WIN_INVEN: 4,
    };
  }

  getRuntimeWindowGlobals() {
    const defaults = this.getDefaultRuntimeWindowGlobals(this.runtimeVersion);
    const globals =
      globalThis.nethackGlobal &&
      globalThis.nethackGlobal.globals &&
      typeof globalThis.nethackGlobal.globals === "object"
        ? globalThis.nethackGlobal.globals
        : null;
    if (!globals) {
      return defaults;
    }

    const merged = { ...defaults };
    for (const [name, fallback] of Object.entries(defaults)) {
      const candidate = Number(globals[name]);
      if (Number.isInteger(candidate)) {
        merged[name] = candidate;
      } else if (Number.isInteger(fallback)) {
        merged[name] = fallback;
      }
    }
    return merged;
  }

  getRuntimeWindowTypeLabels(runtimeVersion = this.runtimeVersion) {
    const globals = this.getDefaultRuntimeWindowGlobals(runtimeVersion);
    return Object.fromEntries(
      Object.entries(globals).map(([name, id]) => [id, name]),
    );
  }

  getRuntimeWindowId(name) {
    const globals = this.getRuntimeWindowGlobals();
    const candidate = Number(globals?.[name]);
    if (Number.isInteger(candidate)) {
      return candidate;
    }
    const fallback = Number(
      this.getDefaultRuntimeWindowGlobals(this.runtimeVersion)?.[name],
    );
    return Number.isInteger(fallback) ? fallback : null;
  }

  isMessageWindow(winId) {
    return Number(winId) === this.getRuntimeWindowId("WIN_MESSAGE");
  }

  isStatusWindow(winId) {
    return Number(winId) === this.getRuntimeWindowId("WIN_STATUS");
  }

  shouldSuppressRedundantStatusWindowText(winId) {
    return (this.runtimeVersion === "slashem" || this.runtimeVersion === "evilhack") && this.isStatusWindow(winId);
  }

  isMapWindow(winId) {
    return Number(winId) === this.getRuntimeWindowId("WIN_MAP");
  }

  isInventoryWindow(winId) {
    return Number(winId) === this.getRuntimeWindowId("WIN_INVEN");
  }

  getRuntimeModuleAssetPath(runtimeVersion = this.runtimeVersion) {
    if (runtimeVersion === "5.0") {
      return "nethack-5.js";
    }
    if (runtimeVersion === "slashem") {
      return "slashem.js";
    }
    if (runtimeVersion === "evilhack") {
      return "evilhack.js";
    }
    return "nethack-367.js";
  }

  getRuntimeWasmAssetPath(runtimeVersion = this.runtimeVersion) {
    if (runtimeVersion === "5.0") {
      return "nethack-5.wasm";
    }
    if (runtimeVersion === "slashem") {
      return "slashem.wasm";
    }
    if (runtimeVersion === "evilhack") {
      return "evilhack.wasm";
    }
    return "nethack-367.wasm";
  }

  readRuntimeBuildTag(runtimeVersion = this.runtimeVersion) {
    const rawValue =
      runtimeVersion === "5.0"
        ? import.meta.env.VITE_NH3D_WASM_5_RUNTIME_BUILD_TAG
        : runtimeVersion === "slashem"
          ? import.meta.env.VITE_NH3D_WASM_SLASHEM_RUNTIME_BUILD_TAG
        : runtimeVersion === "evilhack"
          ? import.meta.env.VITE_NH3D_WASM_EVILHACK_RUNTIME_BUILD_TAG
        : import.meta.env.VITE_NH3D_WASM_367_RUNTIME_BUILD_TAG;
    const runtimeBuildTag =
      typeof rawValue === "string" ? rawValue.trim() : "";
    const rawDevSessionTag = import.meta.env.VITE_NH3D_DEV_SESSION_TAG;
    const devSessionTag =
      import.meta.env.DEV && typeof rawDevSessionTag === "string"
        ? rawDevSessionTag.trim()
        : "";
    if (!devSessionTag) {
      return runtimeBuildTag;
    }
    return runtimeBuildTag
      ? `${runtimeBuildTag}.${devSessionTag}`
      : devSessionTag;
  }

  appendRuntimeBuildTagToUrl(rawUrl, runtimeVersion = this.runtimeVersion) {
    const normalizedUrl = String(rawUrl ?? "").trim();
    if (!normalizedUrl) {
      return normalizedUrl;
    }

    const runtimeBuildTag = this.readRuntimeBuildTag(runtimeVersion);
    if (!runtimeBuildTag || normalizedUrl.startsWith("file:")) {
      return normalizedUrl;
    }

    const referenceUrl =
      typeof globalThis.location?.href === "string" && globalThis.location.href
        ? globalThis.location.href
        : import.meta.url;
    try {
      const taggedUrl = new URL(normalizedUrl, referenceUrl);
      taggedUrl.searchParams.set("nh3d_rt", runtimeBuildTag);
      return taggedUrl.href;
    } catch {
      return normalizedUrl;
    }
  }

  normalizePointerAbiTag(value, fallback = "") {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || fallback;
  }

  readConfiguredPointerAbiTag(runtimeVersion = this.runtimeVersion) {
    const fallback =
      runtimeVersion === "5.0"
        ? "nh5-pointer-v1"
        : runtimeVersion === "slashem"
          ? "slashem-pointer-v1"
          : runtimeVersion === "evilhack"
            ? "evilhack-pointer-v1"
            : "nh367-pointer-v1";
    const rawValue =
      runtimeVersion === "5.0"
        ? import.meta.env.VITE_NH3D_WASM_5_POINTER_ABI_TAG
        : runtimeVersion === "slashem"
          ? import.meta.env.VITE_NH3D_WASM_SLASHEM_POINTER_ABI_TAG
        : runtimeVersion === "evilhack"
          ? import.meta.env.VITE_NH3D_WASM_EVILHACK_POINTER_ABI_TAG
        : import.meta.env.VITE_NH3D_WASM_367_POINTER_ABI_TAG;
    return this.normalizePointerAbiTag(rawValue, fallback);
  }

  readRuntimeExportedPointerAbiTag() {
    const root =
      globalThis.nethackGlobal && typeof globalThis.nethackGlobal === "object"
        ? globalThis.nethackGlobal
        : null;
    if (!root) {
      return "";
    }

    const constants =
      root.constants && typeof root.constants === "object"
        ? root.constants
        : null;
    const nh3dConstants =
      constants &&
      constants.NH3D &&
      typeof constants.NH3D === "object"
        ? constants.NH3D
        : null;
    const rawValue =
      (nh3dConstants &&
        (nh3dConstants.POINTER_ABI_TAG ?? nh3dConstants.pointer_abi_tag)) ||
      root.pointerAbiTag ||
      root.pointerAbi ||
      "";
    return this.normalizePointerAbiTag(rawValue, "");
  }

  buildDefaultRuntimePointerContract(runtimeVersion = this.runtimeVersion) {
    const is5 = runtimeVersion === "5.0";
    const isSlashEm = runtimeVersion === "slashem";
    const isEvilHack = runtimeVersion === "evilhack";
    const addMenuArgCounts = is5 ? [9] : [8];
    // 5.0:      [win, x, y, ptrToGlyphInfo] or [..., extra] (5 or 7)
    // EvilHack: [win, x, y, glyph, monster_id, attacking_target_id] (6)
    // SlashEm:  [win, x, y, glyph] or [..., bkglyph] (4 or 6)
    // 3.6.7:    [win, x, y, glyph] / [..., bkglyph] / [..., extra] (4, 5, or 7)
    const printGlyphArgCounts = is5
      ? [5, 7]
      : isEvilHack
        ? [6]
        : isSlashEm
          ? [4, 6]
          : [4, 5, 7];
    return {
      abiTag: this.readConfiguredPointerAbiTag(runtimeVersion),
      callbackArgCounts: {
        shim_nh_poskey: [3],
        shim_getlin: [2],
        shim_select_menu: [3],
        shim_add_menu: addMenuArgCounts,
        // Forked wasm-367 emits [win, x, y, glyph, bkglyph] (5 args) and the
        // tracked build extends that to [win, x, y, glyph, bkglyph,
        // monsterId, attackingTargetId] (7 args), where monsterId is >0 for
        // tracked monsters and 0 for the player tile when supported.
        // Slash'EM emits [win, x, y, glyph] (4 args) and the tracked build
        // extends that to [win, x, y, glyph, monsterId, attackingTargetId]
        // (6 args), because this shim signature has no background glyph arg.
        // 5.0 emits [win, x, y, glyphinfo_ptr, bkglyphinfo_ptr] (5 args),
        // and the tracked build extends that to [win, x, y, glyphinfo_ptr,
        // bkglyphinfo_ptr, monsterId, attackingTargetId] (7 args), where
        // monsterId is >0 for tracked monsters and 0 for the player tile.
        // Keep 4-arg compatibility only for alternate 3.6.7 builds.
        shim_print_glyph: printGlyphArgCounts,
        shim_monster_attack: [4],
        shim_monster_killed: [4],
        shim_status_update: [6],
      },
      callbackPointers: {
        shim_nh_poskey: [
          { index: 0, label: "x_ptr", bytes: 4, alignment: 1, required: true },
          { index: 1, label: "y_ptr", bytes: 4, alignment: 1, required: true },
          {
            index: 2,
            label: "mod_ptr",
            bytes: 4,
            alignment: 1,
            required: true,
          },
        ],
        shim_getlin: [
          {
            index: 1,
            label: "text_buffer_ptr",
            bytes: 1,
            alignment: 1,
            required: true,
          },
        ],
        shim_select_menu: [
          {
            index: 2,
            label: "menu_list_ptr_ptr",
            bytes: 4,
            alignment: 4,
            required: true,
          },
        ],
        ...(is5
          ? {
              shim_add_menu: [
                {
                  index: 1,
                  label: "menu_glyphinfo_ptr",
                  bytes: 36,
                  alignment: 4,
                  required: false,
                },
              ],
              shim_print_glyph: [
                {
                  index: 3,
                  label: "print_glyphinfo_ptr",
                  bytes: 36,
                  alignment: 4,
                  required: true,
                },
              ],
            }
          : {
              shim_add_menu: [
                {
                  index: 2,
                  label: "menu_identifier_ptr",
                  bytes: 4,
                  alignment: 4,
                  required: false,
                },
              ],
            }),
        shim_status_update: [
          {
            index: 1,
            label: "status_ptr_to_arg",
            bytes: 1,
            alignment: 1,
            required: false,
          },
        ],
      },
      callbackModes: {
        shim_nh_poskey: {
          pointerArgsAreDirect: true,
          coordArgType: is5 ? "i16" : "i32",
        },
        shim_getlin: {
          pointerArgsAreDirect: true,
        },
        shim_select_menu: {
          pointerArgsAreDirect: true,
          menuListMode: "pointer_to_pointer",
        },
        shim_add_menu: {
          identifierMode: is5 ? "value" : "pointer_slot",
          menuTextArgIndex: is5 ? 7 : 6,
          itemFlagsArgIndex: is5 ? 8 : 7,
          glyphArgMode: is5 ? "glyphinfo_ptr" : "glyph_value",
        },
        shim_print_glyph: {
          glyphArgMode: is5 ? "glyphinfo_ptr" : "glyph_value",
          trackedEntityArgIndex: is5 ? 5 : isSlashEm ? 4 : 5,
          attackingTargetArgIndex: is5 ? 6 : isSlashEm ? 5 : 6,
        },
      },
      extcmd: {
        exportedPointerName: "extcmdlist",
        exportedPointerMode: "direct_or_slot",
        // SlashEM ext_func_tab: { char *ef_txt, int (*ef_funct)(), int flags, char *ef_desc } = 16 bytes
        // EvilHack ext_func_tab: { uchar key, char *ef_txt, char *ef_desc, int (*ef_funct)(), int flags, char *f_text }
        //   = 1(key)+3(pad)+4+4+4+4+4 = 24 bytes; textPtr at +4, flags at +16
        stride: isSlashEm ? 16 : isEvilHack ? 24 : 24,
        textPtrOffset: isSlashEm ? 0 : isEvilHack ? 4 : 4,
        flagsOffset: isSlashEm ? 12 : isEvilHack ? 16 : 16,
        maxEntries: 512,
        minEntries: isSlashEm || isEvilHack ? 20 : 10,
        // SlashEM names its two-weapon toggle "2weapon"; EvilHack 0.9.3
        // (cmd.c extcmdlist[]) calls it "twoweapon". Mismatched required
        // names cause validateExtendedCommandEntries() to drop the whole
        // table and emit an empty extcmd list (breaks `#kick`, `#pray`, ...).
        requiredNames: isSlashEm
          ? ["2weapon", "pray"]
          : isEvilHack
            ? ["twoweapon", "pray"]
            : ["#", "pray"],
      },
      menuItem: {
        // NetHack 5.0's `anything` union includes int64/uint64 members, so
        // `struct mi` (menu_item) is widened versus 3.6.x on wasm32.
        // Layout used by select_menu() output in wasm-5:
        //   item @ +0, count @ +8, itemflags @ +12, sizeof(menu_item) == 16.
        stride: is5 ? 16 : 8,
        countOffset: is5 ? 8 : 4,
        itemFlagsOffset: is5 ? 12 : null,
      },
      glyphInfo: is5
        ? {
            minBytes: 36,
            glyphOffset: 0,
            ttyCharOffset: 4,
            colorOffset: 16,
            tileIndexOffset: 30,
            tileIndexType: "i16",
            pointerAlignment: 4,
          }
        : null,
    };
  }

  resolveRuntimePointerContract() {
    const defaults = this.buildDefaultRuntimePointerContract(this.runtimeVersion);
    return defaults;
  }

  getRuntimePointerContract() {
    if (!this.runtimePointerContract) {
      this.runtimePointerContract = this.resolveRuntimePointerContract();
    }
    return this.runtimePointerContract;
  }

  validateRuntimePointerContract() {
    if (this.runtimePointerContractValidated) {
      return true;
    }

    const contract = this.getRuntimePointerContract();
    if (!contract || typeof contract !== "object") {
      throw new Error("Missing runtime pointer contract.");
    }

    const configuredAbiTag = this.readConfiguredPointerAbiTag(this.runtimeVersion);
    const runtimeAbiTag = this.readRuntimeExportedPointerAbiTag();
    if (
      runtimeAbiTag &&
      configuredAbiTag &&
      runtimeAbiTag !== configuredAbiTag
    ) {
      throw new Error(
        `WASM pointer ABI tag mismatch (runtime=${runtimeAbiTag}, configured=${configuredAbiTag}).`,
      );
    }

    const extcmd = contract.extcmd || {};
    const extcmdStride = Number(extcmd.stride);
    const extcmdTextPtrOffset = Number(extcmd.textPtrOffset);
    const extcmdFlagsOffset = Number(extcmd.flagsOffset);
    if (
      !Number.isInteger(extcmdStride) ||
      extcmdStride < 8 ||
      !Number.isInteger(extcmdTextPtrOffset) ||
      extcmdTextPtrOffset < 0 ||
      extcmdTextPtrOffset + 4 > extcmdStride ||
      !Number.isInteger(extcmdFlagsOffset) ||
      extcmdFlagsOffset < 0 ||
      extcmdFlagsOffset + 4 > extcmdStride
    ) {
      throw new Error("Invalid extcmd layout in pointer contract.");
    }

    const menuItem = contract.menuItem || {};
    const menuStride = Number(menuItem.stride);
    const menuCountOffset = Number(menuItem.countOffset);
    const menuItemFlagsOffset =
      menuItem.itemFlagsOffset === null || menuItem.itemFlagsOffset === undefined
        ? null
        : Number(menuItem.itemFlagsOffset);
    if (
      !Number.isInteger(menuStride) ||
      menuStride < 8 ||
      !Number.isInteger(menuCountOffset) ||
      menuCountOffset < 0 ||
      menuCountOffset + 4 > menuStride ||
      (menuItemFlagsOffset !== null &&
        (!Number.isInteger(menuItemFlagsOffset) ||
          menuItemFlagsOffset < 0 ||
          menuItemFlagsOffset + 4 > menuStride))
    ) {
      throw new Error("Invalid menu_item layout in pointer contract.");
    }

    const poskeyMode = contract.callbackModes?.shim_nh_poskey || null;
    if (
      poskeyMode &&
      poskeyMode.coordArgType !== undefined &&
      poskeyMode.coordArgType !== "i8" &&
      poskeyMode.coordArgType !== "i16" &&
      poskeyMode.coordArgType !== "i32"
    ) {
      throw new Error("Invalid nh_poskey coord type in pointer contract.");
    }

    const glyphInfo = contract.glyphInfo;
    if (glyphInfo && typeof glyphInfo === "object") {
      const minBytes = Number(glyphInfo.minBytes);
      const glyphOffset = Number(glyphInfo.glyphOffset);
      const pointerAlignment =
        glyphInfo.pointerAlignment === undefined
          ? 1
          : Number(glyphInfo.pointerAlignment);
      if (
        !Number.isInteger(minBytes) ||
        minBytes < 8 ||
        !Number.isInteger(glyphOffset) ||
        glyphOffset < 0 ||
        glyphOffset + 4 > minBytes ||
        !Number.isInteger(pointerAlignment) ||
        pointerAlignment <= 0
      ) {
        throw new Error("Invalid glyphInfo layout in pointer contract.");
      }
    }

    this.runtimePointerContractValidated = true;
    console.log(
      `Pointer contract ready (runtime=${this.runtimeVersion}, abi=${contract.abiTag || configuredAbiTag})`,
    );
    return true;
  }

   notePointerContractViolation(key, message, details = null) {
    if (!key || this.pointerContractViolationKeys.has(key)) {
      return;
    }
    this.pointerContractViolationKeys.add(key);
    if (details) {
      console.warn(`[POINTER_CONTRACT] ${message}`, details);
      return;
    }
    console.warn(`[POINTER_CONTRACT] ${message}`);
  }

  normalizeWasmPointer(
    value,
    {
      allowZero = false,
      alignment = 1,
      minBytes = 1,
      enforceBounds = true,
      label = "pointer",
    } = {},
  ) {
    if (!this.nethackModule) {
      return null;
    }

    const asNumber =
      typeof value === "bigint"
        ? Number(value)
        : Number.isFinite(Number(value))
          ? Number(value)
          : NaN;
    if (!Number.isFinite(asNumber)) {
      return null;
    }
    const ptr = Math.trunc(asNumber);
    if (ptr === 0) {
      return allowZero ? 0 : null;
    }
    if (ptr < 0) {
      return null;
    }
    if (Number.isInteger(alignment) && alignment > 1 && ptr % alignment !== 0) {
      return null;
    }

    const heapSize =
      this.nethackModule.HEAPU8 && this.nethackModule.HEAPU8.length
        ? this.nethackModule.HEAPU8.length
        : 0;
    if (
      enforceBounds &&
      heapSize &&
      Number.isInteger(minBytes) &&
      minBytes > 0 &&
      ptr + minBytes > heapSize
    ) {
      return null;
    }
    return ptr;
  }

  readPointerSlotValue(
    ptr,
    label = "pointer_slot",
    normalizeValueAsPointer = false,
  ) {
    if (
      !this.nethackModule ||
      typeof this.nethackModule.getValue !== "function"
    ) {
      return null;
    }
    const slotPtr = this.normalizeWasmPointer(ptr, {
      label,
      minBytes: 4,
      alignment: 4,
    });
    if (!slotPtr) {
      return null;
    }
    const rawValue = this.readRuntimeValue(slotPtr, "*", {
      label: `${label}_raw`,
      minBytes: 4,
      alignment: 4,
    });
    if (rawValue === null || rawValue === undefined) {
      return null;
    }
    if (!normalizeValueAsPointer) {
      const normalizedValue =
        typeof rawValue === "bigint"
          ? Number(rawValue)
          : Number.isFinite(Number(rawValue))
            ? Number(rawValue)
            : NaN;
      return Number.isFinite(normalizedValue)
        ? Math.trunc(normalizedValue)
        : null;
    }
    return this.normalizeWasmPointer(rawValue, {
      allowZero: true,
      label: `${label}_value`,
    });
  }

  readRuntimeValue(
    ptr,
    valueType,
    { label = "runtime_value", minBytes = 1, alignment = 1 } = {},
  ) {
    if (
      !this.nethackModule ||
      typeof this.nethackModule.getValue !== "function"
    ) {
      return null;
    }
    const normalizedPtr = this.normalizeWasmPointer(ptr, {
      label,
      minBytes,
      alignment,
      // Some wasm bundles do not expose HEAP* arrays on the module object.
      // In that case we cannot do local bounds checks and must rely on getValue.
      enforceBounds: true,
    });
    if (!normalizedPtr) {
      return null;
    }
    try {
      return this.nethackModule.getValue(normalizedPtr, valueType);
    } catch (_error) {
      return null;
    }
  }

  readRuntimeI8(ptr, label = "i8", unsigned = false) {
    const rawValue = this.readRuntimeValue(ptr, "i8", {
      label,
      minBytes: 1,
      alignment: 1,
    });
    if (rawValue === null || rawValue === undefined) {
      return null;
    }
    const normalizedValue =
      typeof rawValue === "bigint"
        ? Number(rawValue)
        : Number.isFinite(Number(rawValue))
          ? Number(rawValue)
          : NaN;
    if (!Number.isFinite(normalizedValue)) {
      return null;
    }
    const coerced = Math.trunc(normalizedValue);
    return unsigned ? (coerced & 0xff) : coerced;
  }

  readRuntimeI16(ptr, label = "i16", unsigned = false) {
    const rawValue = this.readRuntimeValue(ptr, "i16", {
      label,
      minBytes: 2,
      alignment: 1,
    });
    if (rawValue === null || rawValue === undefined) {
      return null;
    }
    const normalizedValue =
      typeof rawValue === "bigint"
        ? Number(rawValue)
        : Number.isFinite(Number(rawValue))
          ? Number(rawValue)
          : NaN;
    if (!Number.isFinite(normalizedValue)) {
      return null;
    }
    const coerced = Math.trunc(normalizedValue);
    return unsigned ? (coerced & 0xffff) : coerced;
  }

  readRuntimeI32(ptr, label = "i32") {
    const rawValue = this.readRuntimeValue(ptr, "i32", {
      label,
      minBytes: 4,
      alignment: 1,
    });
    if (rawValue === null || rawValue === undefined) {
      return null;
    }
    const normalizedValue =
      typeof rawValue === "bigint"
        ? Number(rawValue)
        : Number.isFinite(Number(rawValue))
          ? Number(rawValue)
          : NaN;
    if (!Number.isFinite(normalizedValue)) {
      return null;
    }
    return Math.trunc(normalizedValue);
  }

  decodeGlyphInfoPointer(ptr, contextLabel = "glyphinfo") {
    const contract = this.getRuntimePointerContract();
    const glyphInfo = contract?.glyphInfo;
    if (!glyphInfo) {
      return null;
    }

    const pointer = this.normalizeWasmPointer(ptr, {
      label: `${contextLabel}_ptr`,
      minBytes: Number(glyphInfo.minBytes) || 1,
      alignment:
        Number.isInteger(glyphInfo.pointerAlignment) &&
        glyphInfo.pointerAlignment > 0
          ? glyphInfo.pointerAlignment
          : 1,
    });
    if (!pointer) {
      return null;
    }

    const glyphOffset = Number(glyphInfo.glyphOffset) || 0;
    const ttyCharOffset = Number(glyphInfo.ttyCharOffset);
    const colorOffset = Number(glyphInfo.colorOffset);
    const tileIndexOffset = Number(glyphInfo.tileIndexOffset);
    const tileIndexType =
      glyphInfo.tileIndexType === "i32" ? "i32" : "i16";

    const readI32At = (offset) => {
      if (!Number.isInteger(offset)) {
        return null;
      }
      const address = pointer + offset;
      return this.readRuntimeI32(address, `${contextLabel}_i32_${offset}`);
    };

    const glyph = readI32At(glyphOffset);
    if (!Number.isFinite(glyph)) {
      return null;
    }
    const glyphValue = Math.trunc(Number(glyph));
    if (glyphValue < 0 || glyphValue > 1000000) {
      return null;
    }

    const ttychar = readI32At(ttyCharOffset);
    const color = readI32At(colorOffset);
    let tileIndex = null;
    if (Number.isInteger(tileIndexOffset)) {
      const tileAddress = pointer + tileIndexOffset;
      if (tileIndexType === "i32") {
        const tile32 = readI32At(tileIndexOffset);
        if (Number.isFinite(tile32)) {
          tileIndex = tile32;
        }
      } else {
        const tile16 = this.readRuntimeI16(
          tileAddress,
          `${contextLabel}_tile_i16_${tileIndexOffset}`,
          true,
        );
        if (Number.isFinite(tile16)) {
          tileIndex = tile16;
        }
      }
    }

    return {
      pointer,
      glyph: glyphValue,
      ttychar: Number.isFinite(ttychar) ? Math.trunc(Number(ttychar)) : null,
      color: Number.isFinite(color) ? Math.trunc(Number(color)) : null,
      tileIndex:
        Number.isFinite(tileIndex) && Number(tileIndex) >= 0
          ? Math.trunc(Number(tileIndex))
          : null,
    };
  }

  validateCallbackPointerContract(name, args) {
    const contract = this.getRuntimePointerContract();
    if (!contract) {
      return true;
    }

    const expectedCounts = Array.isArray(contract.callbackArgCounts?.[name])
      ? contract.callbackArgCounts[name]
      : [];
    if (expectedCounts.length > 0 && !expectedCounts.includes(args.length)) {
      this.notePointerContractViolation(
        `arg-count-${name}`,
        `${name} received unexpected arg count ${args.length} (expected ${expectedCounts.join(", ")}).`,
      );
      console.warn(`[CONTRACT_REJECT] ${name}: got ${args.length} args, expected [${expectedCounts.join(", ")}] — callback DROPPED`);
      return false;
    }

    const pointerSpecs = Array.isArray(contract.callbackPointers?.[name])
      ? contract.callbackPointers[name]
      : [];
    for (const pointerSpec of pointerSpecs) {
      const ptrValue = args[pointerSpec.index];
      const normalized = this.normalizeWasmPointer(ptrValue, {
        allowZero: !pointerSpec.required,
        alignment:
          Number.isInteger(pointerSpec.alignment) && pointerSpec.alignment > 0
            ? pointerSpec.alignment
            : 1,
        minBytes:
          Number.isInteger(pointerSpec.bytes) && pointerSpec.bytes > 0
            ? pointerSpec.bytes
            : 1,
        label: `${name}:${pointerSpec.label || pointerSpec.index}`,
      });
      if (pointerSpec.required && !normalized) {
        this.notePointerContractViolation(
          `arg-pointer-${name}-${pointerSpec.index}`,
          `${name} received invalid pointer at arg ${pointerSpec.index} (${pointerSpec.label || "pointer"}).`,
        );
        return false;
      }
    }

    return true;
  }

  getSafeCallbackDefaultReturn(name) {
    switch (name) {
      case "shim_get_ext_cmd":
        return -1;
      case "shim_nh_poskey":
      case "shim_nhgetch":
      case "shim_yn_function":
        return 27;
      default:
        return 0;
    }
  }

  getRuntimeStatusFieldMap() {
    if (this.runtimeVersion === "5.0") return STATUS_FIELD_MAP_5;
    if (this.runtimeVersion === "evilhack") return STATUS_FIELD_MAP_EVILHACK;
    return STATUS_FIELD_MAP_367;
  }

  seedRuntimeStatusFieldConstants() {
    const constants =
      globalThis.nethackGlobal &&
      globalThis.nethackGlobal.constants &&
      typeof globalThis.nethackGlobal.constants === "object"
        ? globalThis.nethackGlobal.constants
        : null;
    if (!constants) {
      return;
    }

    const existing =
      constants.STATUS_FIELD && typeof constants.STATUS_FIELD === "object"
        ? constants.STATUS_FIELD
        : {};
    const merged = { ...existing };
    const runtimeMap = this.getRuntimeStatusFieldMap();

    for (const [rawIndex, rawName] of Object.entries(runtimeMap || {})) {
      const index = Number(rawIndex);
      if (!Number.isFinite(index)) {
        continue;
      }
      const fieldName = String(rawName ?? "").trim();
      if (!fieldName) {
        continue;
      }
      merged[index] = fieldName;
      if (merged[fieldName] === undefined) {
        merged[fieldName] = index;
      }
    }

    merged[-1] = "BL_FLUSH";
    merged[-2] = "BL_RESET";
    merged[-3] = "BL_CHARACTERISTICS";
    if (merged.BL_FLUSH === undefined) {
      merged.BL_FLUSH = -1;
    }
    if (merged.BL_RESET === undefined) {
      merged.BL_RESET = -2;
    }
    if (merged.BL_CHARACTERISTICS === undefined) {
      merged.BL_CHARACTERISTICS = -3;
    }

    constants.STATUS_FIELD = merged;
  }

  resolveStatusFieldIndex(fieldName) {
    const normalizedFieldName = String(fieldName || "").trim();
    if (!normalizedFieldName) {
      return null;
    }

    const constants =
      globalThis.nethackGlobal && globalThis.nethackGlobal.constants
        ? globalThis.nethackGlobal.constants
        : null;
    const statusFieldConstants =
      constants &&
      constants.STATUS_FIELD &&
      typeof constants.STATUS_FIELD === "object"
        ? constants.STATUS_FIELD
        : null;
    if (statusFieldConstants) {
      const direct = Number(statusFieldConstants[normalizedFieldName]);
      if (Number.isFinite(direct)) {
        return Math.trunc(direct);
      }
    }

    const fallback = this.getRuntimeStatusFieldMap();
    for (const [rawIndex, rawFieldName] of Object.entries(fallback || {})) {
      if (String(rawFieldName || "").trim() !== normalizedFieldName) {
        continue;
      }
      const parsedIndex = Number(rawIndex);
      if (Number.isFinite(parsedIndex)) {
        return Math.trunc(parsedIndex);
      }
    }

    return null;
  }

  private unpackGlyphArgs(args: number[]) {
    // Default (older runtimes): [win, x, y, glyph]
    const [win, x, y, a, b] = args;

    if (this.runtimeVersion !== "5.0") {
      return { win, x, y, glyph: a, mgflags: 0, extra: b };
    }

    // 5.0: callback often comes as [win, x, y, packed, extra]
    // packed: hi16 = flags, lo16 = glyph
    let glyph = a;
    let mgflags = 0;

    if (glyph > 0xffff) {
      mgflags = (glyph >>> 16) & 0xffff;
      glyph = glyph & 0xffff;
    }

    return { win, x, y, glyph, mgflags, extra: b };
  }

  async loadRuntimeFactory(version) {
    const importFactoryFromUrl = async (moduleUrl, source) => {
      console.log("Loading NetHack runtime factory", {
        runtimeVersion: version,
        source,
        moduleUrl,
        runtimeBuildTag: this.readRuntimeBuildTag(version) || null,
      });
      try {
        const imported = await import(/* @vite-ignore */ moduleUrl);
        console.log("Module imported successfully", {
          runtimeVersion: version,
          hasDefault: !!imported.default,
          defaultType: typeof imported.default,
          keys: Object.keys(imported).slice(0, 10),
        });
        const { default: factory } = imported;
        if (typeof factory !== "function") {
          console.error("Module default export is not a function", {
            runtimeVersion: version,
            defaultType: typeof factory,
            defaultValue: String(factory).substring(0, 100),
          });
          throw new Error(`Module default export is not a function (got ${typeof factory})`);
        }
        return factory;
      } catch (error) {
        console.error("Failed to load/import runtime factory", {
          runtimeVersion: version,
          moduleUrl,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }
    };

    const moduleUrl = this.resolveWasmAssetUrl(
      this.getRuntimeModuleAssetPath(version),
      version,
    );
    return importFactoryFromUrl(moduleUrl, "public-runtime");
  }

  normalizeCharacterOptionValue(value) {
    if (typeof value !== "string") {
      return "";
    }
    const normalized = value.trim();
    if (!normalized) {
      return "";
    }
    return normalized;
  }

  normalizeCharacterNameValue(value) {
    if (typeof value !== "string") {
      return "";
    }
    const normalized = value.replace(/,/g, " ").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return "";
    }
    return normalized.slice(0, 30);
  }

  buildCheckpointLockBaseName(name) {
    const normalized = this.normalizeCharacterNameValue(name);
    if (!normalized) {
      return "";
    }
    return `0${normalized.replace(/[./ ]/g, "_")}`;
  }

  isWizardDebugStartupRequested() {
    const startupTokens = this.buildStartupInitRuntimeOptions().map((token) =>
      String(token || "")
        .trim()
        .toLowerCase(),
    );
    return startupTokens.includes("playmode:debug");
  }

  getStartupCheckpointLockBaseNameCandidates() {
    const candidates = [];
    const candidateNames = [
      this.startupOptions?.characterCreation?.name,
      this.lastKnownPlayerName,
    ];
    if (this.isWizardDebugStartupRequested()) {
      // In wizard/debug playmode NetHack can normalize the effective lockname
      // to "wizard" regardless of the configured startup name.
      candidateNames.push("wizard");
    }

    const seen = new Set();
    for (const candidateName of candidateNames) {
      const lockBaseName = this.buildCheckpointLockBaseName(candidateName);
      if (!lockBaseName || seen.has(lockBaseName)) {
        continue;
      }
      seen.add(lockBaseName);
      candidates.push(lockBaseName);
    }
    return candidates;
  }

  getTemporaryRuntimeLockBaseNames() {
    const candidates = [];
    for (let index = 0; index < 26; index += 1) {
      candidates.push(`${String.fromCharCode(97 + index)}lock`);
    }
    return candidates;
  }

  shouldCleanupCheckpointShardsBeforeStartup() {
    if (!this.buildStartupInitRuntimeOptions().includes("checkpoint")) {
      return false;
    }
    const characterCreation = this.startupOptions?.characterCreation;
    if (characterCreation?.mode !== "resume") {
      return false;
    }
    // Autosave resume needs checkpoint shards intact so the wasm bridge can
    // recover them into a real save before startup.
    if (characterCreation.resumeCategory === "autosave") {
      return false;
    }
    // Manual-save resume should discard stale checkpoint shards to avoid
    // lock-file prompts before the normal UI callback path is ready.
    return this.getStartupCheckpointLockBaseNameCandidates().length > 0;
  }

  shouldCleanupTemporaryRuntimeLocksBeforeStartup() {
    const characterCreation = this.startupOptions?.characterCreation;
    return characterCreation?.mode === "resume";
  }

  removeCheckpointShardsByLockBaseName(mod, saveDir, lockBaseName, reason) {
    if (!mod?.FS || !saveDir || !lockBaseName) {
      return 0;
    }

    const escapedLockBaseName = lockBaseName.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const checkpointShardPattern = new RegExp(
      `^${escapedLockBaseName}\\.\\d+$`,
    );

    let entries = [];
    try {
      entries = mod.FS.readdir(saveDir);
    } catch (error) {
      console.warn(
        `Failed to enumerate ${saveDir} for save-shard cleanup (${reason}):`,
        error,
      );
      return 0;
    }

    const shardPaths = entries
      .filter((entry) => checkpointShardPattern.test(String(entry)))
      .map((entry) => `${saveDir}/${entry}`);

    if (shardPaths.length === 0) {
      return 0;
    }

    console.log(
      `Removing ${shardPaths.length} save shard(s) for "${lockBaseName}" (${reason})`,
    );

    let removedCount = 0;
    for (const shardPath of shardPaths) {
      try {
        mod.FS.unlink(shardPath);
        removedCount += 1;
      } catch (error) {
        console.warn(
          `Failed to remove save shard ${shardPath} (${reason}):`,
          error,
        );
      }
    }

    return removedCount;
  }

  resolveCurrentCheckpointLockBaseName() {
    const resolvedName =
      this.normalizeCharacterNameValue(this.lastKnownPlayerName) ||
      this.normalizeCharacterNameValue(
        String(this.readGlobalValue(["plname"]) || ""),
      ) ||
      this.normalizeCharacterNameValue(
        this.startupOptions?.characterCreation?.name,
      );
    return this.buildCheckpointLockBaseName(resolvedName);
  }

  cleanupAndFlushCheckpointShardsAfterGameOver(onComplete) {
    const done = () => {
      if (typeof onComplete === "function") {
        onComplete();
      }
    };

    const mod = this.nethackModule;
    if (!mod?.FS) {
      done();
      return;
    }

    const cwd =
      typeof mod.FS.cwd === "function"
        ? String(mod.FS.cwd() || "/")
        : String(this.nethackModule?.FS?.cwd?.() || "/");
    const saveDir = getRuntimeSaveMountDir(this.runtimeVersion, cwd);
    const lockBaseName = this.resolveCurrentCheckpointLockBaseName();
    if (lockBaseName) {
      this.removeCheckpointShardsByLockBaseName(
        mod,
        saveDir,
        lockBaseName,
        "after game over",
      );
    }

    if (typeof mod.FS.syncfs !== "function") {
      done();
      return;
    }

    try {
      mod.FS.syncfs(false, (error) => {
        if (error) {
          console.warn("IDBFS sync after game-over checkpoint cleanup failed:", error);
        }
        done();
      });
    } catch (error) {
      console.warn("IDBFS sync exception after game-over checkpoint cleanup:", error);
      done();
    }
  }

  cleanupStaleCheckpointShardsBeforeStartup(mod, saveDir) {
    if (!mod?.FS || !this.shouldCleanupCheckpointShardsBeforeStartup()) {
      return 0;
    }

    const lockBaseNames = this.getStartupCheckpointLockBaseNameCandidates();
    if (lockBaseNames.length <= 0) {
      return 0;
    }
    let removedCount = 0;
    for (const lockBaseName of lockBaseNames) {
      removedCount += this.removeCheckpointShardsByLockBaseName(
        mod,
        saveDir,
        lockBaseName,
        "before startup",
      );
    }
    return removedCount;
  }

  cleanupStaleTemporaryRuntimeLocksBeforeStartup(mod, saveDir) {
    if (!mod?.FS || !this.shouldCleanupTemporaryRuntimeLocksBeforeStartup()) {
      return 0;
    }

    let removedCount = 0;
    for (const lockBaseName of this.getTemporaryRuntimeLockBaseNames()) {
      removedCount += this.removeCheckpointShardsByLockBaseName(
        mod,
        saveDir,
        lockBaseName,
        "before startup (temporary runtime lock)",
      );
    }
    return removedCount;
  }

  getRecoverableSaveArtifactNames(lockBaseName) {
    if (!lockBaseName) {
      return [];
    }
    return [
      lockBaseName,
      `${lockBaseName}.e`,
      `${lockBaseName}.e;1`,
      `${lockBaseName}.gz`,
      `${lockBaseName}.Z`,
    ];
  }

  getCheckpointLevelZeroArtifactSizeBytes(mod, saveDir, lockBaseName) {
    if (!mod?.FS || !saveDir || !lockBaseName) {
      return null;
    }

    const checkpointLevelZeroPath = `${saveDir}/${lockBaseName}.0`;
    try {
      if (!mod.FS.analyzePath(checkpointLevelZeroPath)?.exists) {
        return null;
      }
      if (typeof mod.FS.stat !== "function") {
        return null;
      }
      const statResult = mod.FS.stat(checkpointLevelZeroPath);
      if (
        !statResult ||
        typeof statResult.size !== "number" ||
        !Number.isFinite(statResult.size)
      ) {
        return null;
      }
      return Math.trunc(statResult.size);
    } catch {
      return null;
    }
  }

  logAutosaveCheckpointArtifactsBeforeStartup() {
    if (!this.isAutosaveResumeRequested()) {
      return;
    }

    const mod = this.nethackModule;
    if (!mod?.FS || typeof mod.FS.readdir !== "function") {
      return;
    }

    const cwd =
      typeof mod.FS.cwd === "function"
        ? String(mod.FS.cwd() || "/")
        : "/";
    const saveDir = getRuntimeSaveMountDir(this.runtimeVersion, cwd);
    const lockBaseNames = this.getStartupCheckpointLockBaseNameCandidates();
    if (lockBaseNames.length <= 0) {
      return;
    }

    try {
      const entries = mod.FS.readdir(saveDir);
      for (const lockBaseName of lockBaseNames) {
        const escapedLockBaseName = lockBaseName.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );
        const shardPattern = new RegExp(`^${escapedLockBaseName}\\.\\d+$`);
        const shardDiagnostics = entries
          .filter((entry) => shardPattern.test(String(entry)))
          .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
          .map((entry) => {
            const artifactPath = `${saveDir}/${entry}`;
            let byteLength = null;
            try {
              if (typeof mod.FS.stat === "function") {
                const statResult = mod.FS.stat(artifactPath);
                if (
                  statResult &&
                  typeof statResult.size === "number" &&
                  Number.isFinite(statResult.size)
                ) {
                  byteLength = Math.trunc(statResult.size);
                }
              }
            } catch {
              byteLength = null;
            }
            return {
              path: artifactPath,
              byteLength,
            };
          });
        if (shardDiagnostics.length > 0) {
          console.log("Autosave checkpoint artifacts before startup", shardDiagnostics);
        }
      }
    } catch (error) {
      console.warn("Failed to inspect autosave checkpoint artifacts before startup:", error);
    }
  }

  ensureAutosaveResumeHasRecoverableCheckpoint() {
    if (!this.isAutosaveResumeRequested()) {
      return;
    }

    const mod = this.nethackModule;
    if (!mod?.FS) {
      return;
    }

    const cwd =
      typeof mod.FS.cwd === "function"
        ? String(mod.FS.cwd() || "/")
        : "/";
    const saveDir = getRuntimeSaveMountDir(this.runtimeVersion, cwd);
    const lockBaseNames = this.getStartupCheckpointLockBaseNameCandidates();
    if (lockBaseNames.length <= 0) {
      return;
    }

    const invalidCheckpointPaths = [];
    for (const lockBaseName of lockBaseNames) {
      const byteLength = this.getCheckpointLevelZeroArtifactSizeBytes(
        mod,
        saveDir,
        lockBaseName,
      );
      if (isRecoverableCheckpointLevelZeroByteLength(byteLength)) {
        return;
      }
      if (byteLength !== null) {
        invalidCheckpointPaths.push(`${saveDir}/${lockBaseName}.0 (${byteLength} bytes)`);
      }
    }

    const playerName =
      this.normalizeCharacterNameValue(this.startupOptions?.characterCreation?.name) ||
      "selected autosave";
    if (invalidCheckpointPaths.length > 0) {
      throw new Error(
        `Autosave "${playerName}" has only lock-file checkpoint data (${invalidCheckpointPaths.join(", ")}). NetHack has not written a recoverable checkpoint yet.`,
      );
    }
    throw new Error(
      `Autosave "${playerName}" does not have a recoverable checkpoint file yet.`,
    );
  }

  removeStaleRecoverableSaveArtifactsBeforeAutosaveResume(mod, saveDir) {
    if (!mod?.FS || !this.isAutosaveResumeRequested()) {
      return 0;
    }
    const lockBaseNames = this.getStartupCheckpointLockBaseNameCandidates();
    if (lockBaseNames.length <= 0) {
      return 0;
    }

    let preparedCount = 0;
    for (const lockBaseName of lockBaseNames) {
      for (const artifactName of this.getRecoverableSaveArtifactNames(
        lockBaseName,
      )) {
        const artifactPath = `${saveDir}/${artifactName}`;
        let exists = false;
        try {
          exists = Boolean(mod.FS.analyzePath(artifactPath)?.exists);
        } catch {
          exists = false;
        }
        if (!exists) {
          continue;
        }

        let artifactSize = null;
        try {
          if (typeof mod.FS.stat === "function") {
            const statResult = mod.FS.stat(artifactPath);
            if (
              statResult &&
              typeof statResult.size === "number" &&
              Number.isFinite(statResult.size)
            ) {
              artifactSize = Math.trunc(statResult.size);
            }
          }
        } catch (error) {
          console.warn(`Failed to stat recoverable save artifact ${artifactPath}:`, error);
        }

        try {
          // NetHack's SELF_RECOVER path treats a too-short "<lock>.0" as a
          // potentially interrupted prior recover attempt. If a stale regular
          // save file still exists, recover_savefile() returns success and
          // restore_saved_game() will try to load that artifact instead of
          // rebuilding it from the checkpoint shards.
          mod.FS.unlink(artifactPath);
          preparedCount += 1;
          console.log(
            `Removed stale recoverable save artifact for autosave resume: ${artifactPath}${
              artifactSize !== null ? ` (${artifactSize} bytes)` : ""
            }`,
          );
        } catch (error) {
          console.warn(
            `Failed to remove stale recoverable save artifact ${artifactPath} before autosave resume:`,
            error,
          );
        }
      }
    }

    return preparedCount;
  }

  setRuntimePlayerName(name) {
    const normalized = this.normalizeCharacterNameValue(name);
    if (!normalized) {
      return false;
    }

    const globals =
      globalThis.nethackGlobal &&
      globalThis.nethackGlobal.globals &&
      typeof globalThis.nethackGlobal.globals === "object"
        ? globalThis.nethackGlobal.globals
        : null;
    if (!globals) {
      return false;
    }

    try {
      if (Object.prototype.hasOwnProperty.call(globals, "plname")) {
        globals.plname = normalized;
        this.lastKnownPlayerName = normalized;
        return true;
      }
      if (
        globals.g &&
        typeof globals.g === "object" &&
        Object.prototype.hasOwnProperty.call(globals.g, "plname")
      ) {
        globals.g.plname = normalized;
        this.lastKnownPlayerName = normalized;
        return true;
      }
    } catch (error) {
      console.log("Failed to write runtime player name:", error);
    }

    return false;
  }

  buildCharacterCreationRuntimeOptions() {
    const config =
      this.startupOptions &&
      this.startupOptions.characterCreation &&
      typeof this.startupOptions.characterCreation === "object"
        ? this.startupOptions.characterCreation
        : null;

    if (!config) {
      return [];
    }

    const name = this.normalizeCharacterNameValue(config.name);

    // If we're resuming, omit role/race/gender/align.
    // Supplying just the name instructs NetHack to bypass character creation
    // and seamlessly load the matching save file from the virtual file system.
    if (config.mode === "resume") {
      return name ? [`name:${name}`] : [];
    }

    const role = this.normalizeCharacterOptionValue(config.role);
    const race = this.normalizeCharacterOptionValue(config.race);
    const gender = this.normalizeCharacterOptionValue(config.gender);
    const align = this.normalizeCharacterOptionValue(config.align);

    if (config.mode === "random") {
      const randomOptions = [
        role ? `role:${role}` : "role:random",
        race ? `race:${race}` : "race:random",
        gender ? `gender:${gender}` : "gender:random",
        align ? `align:${align}` : "align:random",
      ];
      if (name) {
        randomOptions.push(`name:${name}`);
      }
      return randomOptions;
    }

    const options = [];
    if (role) {
      options.push(`role:${role}`);
    }
    if (race) {
      options.push(`race:${race}`);
    }
    if (gender) {
      options.push(`gender:${gender}`);
    }
    if (align) {
      options.push(`align:${align}`);
    }
    if (name) {
      options.push(`name:${name}`);
    }
    return options;
  }

  buildStartupInitRuntimeOptions() {
    const tokens = appendRequiredStartupInitOptionTokens(
      this.startupOptions?.initOptions,
      this.runtimeVersion,
    );
    if (
      this.runtimeVersion !== "3.6.7" &&
      !supportsRuntimeCheckpointRecovery(this.runtimeVersion)
    ) {
      return tokens.filter((token) => !/^!?checkpoint(?:$|:)/i.test(token));
    }
    return tokens;
  }

  resolveStartupExtmenuEnabled(rawTokens) {
    const tokens = sanitizeStartupInitOptionTokens(
      rawTokens,
      this.runtimeVersion,
    );
    return tokens.includes("extmenu");
  }

  sendReconnectSnapshot() {
    if (!this.eventHandler) {
      return;
    }

    // Start from a clean client scene before replaying cached state.
    this.emit({
      type: "clear_scene",
      // message: "Reconnected - restoring game state",
    });
    this.emitExtendedCommands("snapshot");

    const tiles = Array.from(this.gameMap.values());
    const chunkSize = 500;
    for (let i = 0; i < tiles.length; i += chunkSize) {
      this.emit({
        type: "map_glyph_batch",
        tiles: tiles.slice(i, i + chunkSize),
      });
    }

    this.emit({
      type: "player_position",
      x: this.playerPosition.x,
      y: this.playerPosition.y,
    });

    for (const payload of this.latestStatusUpdates.values()) {
      this.emit(payload);
    }

    this.emit({
      type: "inventory_update",
      items: this.latestInventoryItems.map((item) => ({ ...item })),
      window: 4,
    });

    const recentMessages = this.gameMessages.slice(-30);
    for (const msg of recentMessages) {
      this.emit({
        type: "text",
        text: msg.text,
        window: msg.window,
        attr: msg.attr,
      });
    }
  }

  async start() {
    await this.ready;
    this.emitStartupObjectTileMap();
    this.sendReconnectSnapshot();
    this.requestRuntimeGlobalsSnapshot();
  }

  emitStartupObjectTileMap() {
    const objectTileIndexByObjectId =
      this.buildObjectTileIndexByObjectIdSnapshot();
    if (!Array.isArray(objectTileIndexByObjectId)) {
      return;
    }
    this.emit({
      type: "runtime_object_tile_map",
      objectTileIndexByObjectId,
    });
  }

  sendInput(input) {
    this.handleClientInput(input);
  }

  queueStdinTextInput(text, reason = "runtime") {
    const normalized = typeof text === "string" ? text : String(text ?? "");
    if (!normalized) {
      return;
    }
    const bytes = [];
    for (const ch of normalized) {
      bytes.push(ch.charCodeAt(0) & 0xff);
    }
    if (bytes.length <= 0) {
      return;
    }
    this.pendingStdinByteQueue.push(...bytes);
    console.log(
      `Queued ${bytes.length} stdin byte(s) for ${reason} (queue=${this.pendingStdinByteQueue.length})`,
    );
  }

  consumeStdinByte() {
    if (
      !Array.isArray(this.pendingStdinByteQueue) ||
      this.pendingStdinByteQueue.length <= 0
    ) {
      return null;
    }
    const next = this.pendingStdinByteQueue.shift();
    if (typeof next !== "number" || !Number.isFinite(next)) {
      return null;
    }
    return Math.max(0, Math.min(255, Math.trunc(next)));
  }

  sendInputSequence(inputs) {
    this.handleClientInputSequence(inputs);
  }

  sendMouseInput(x, y, button) {
    this.handleClientMouseInput(x, y, button);
  }

  requestTileUpdate(x, y) {
    this.handleTileUpdateRequest(x, y);
  }

  requestAreaUpdate(centerX, centerY, radius) {
    this.handleAreaUpdateRequest(centerX, centerY, radius);
  }

  requestRuntimeGlobalsSnapshot() {
    this.emit({
      type: "runtime_globals_snapshot",
      snapshot: this.buildRuntimeGlobalsSnapshot(),
    });
  }

  shutdown(reason = "session shutdown") {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;
    console.log(`Shutting down NetHack session: ${reason}`);
    this.inputBroker.drain();
    this.pendingTextResponses = [];
    this.pendingStdinByteQueue = [];
    this.didAutoQueueRawRecoverChoice = false;
    this.farLookMode = "none";
    this.farLookOrigin = null;
    this.pendingLookMenuFarLookArm = false;
    this.pendingLegacySlashEmCursorPromptFarLook = false;
    this.pendingTravelPositionInputArm = false;
    this.contextualGlanceProbeMouseDeadlineMs = 0;
    this.contextualGlanceAutoCancelPositionUntilMs = 0;
    this.contextualLookInfoProbeMouseDeadlineMs = 0;
    this.pendingContextualLookMapRouteSelection = false;
    this.contextualLookInfoAutoFlowStage = "none";
    this.contextualLookInfoAutoFlowUntilMs = 0;
    this.legacyAutoHelpYnPromptSignature = "";
    this.legacyAutoHelpYnPromptUntilMs = 0;
    this.pendingPostActionPlayerTileRefreshReason = null;
    this.pendingPostActionPlayerTileRefreshTarget = null;
    this.pendingPostActionPlayerTileRefreshSnapshot = null;
    this.setPositionInputActive(false);
    this.activeInputRequest = null;
    this.menuSelections.clear();
    this.pendingExtendedCommand = null;
    this.extendedCommandTriggerQueued = false;
    this.resolvePendingExtendedCommandRequest(-1);
    this.pendingInventoryContextSelection = null;
    this.awaitingQuestionInput = false;
    this.windowTextBuffers.clear();
    this.lastPromptContextMessage = "";
    this.lastPromptContextEntry = null;
    this.promptContextHistory = [];
    this.lastMenuInteractionCancelled = false;
    this.gameOverSequenceActive = false;
    this.gameOverEmptyRawPrintCount = 0;
    this.lastGameOverHow = null;
    this.lastGameOverWhen = null;

    if (this.pendingMenuSelection && this.pendingMenuSelection.resolver) {
      const resolver = this.pendingMenuSelection.resolver;
      this.pendingMenuSelection = null;
      this.menuSelectionReadyCount = null;
      try {
        resolver(0);
      } catch (error) {
        console.log("Menu selection resolver shutdown error:", error);
      }
    }

    this.inputBroker.cancelAll(27);
  }

  queueMapGlyphUpdate(tile) {
    if (this.isClosed || !tile || !this.eventHandler) {
      return;
    }
    this.emit(tile);
  }

  handleClientInputSequence(inputs) {
    if (this.isClosed || !Array.isArray(inputs) || inputs.length === 0) {
      return;
    }

    const normalized = inputs.filter(
      (input) => typeof input === "string" && input.length > 0,
    );
    if (normalized.length === 0) {
      return;
    }

    console.log("Received client input sequence:", normalized);
    const extendedCommandText =
      this.extractExtendedCommandSubmission(normalized);
    if (extendedCommandText !== null) {
      if (
        this.resolvePendingExtendedCommandRequestFromText(extendedCommandText)
      ) {
        return;
      }
      const queued = this.queueExtendedCommandSubmission(
        extendedCommandText,
        "synthetic",
      );
      if (!queued) {
        // Fall back to normal key processing when command submission cannot
        // start (for example while NetHack is waiting on a prompt answer).
        for (const input of normalized) {
          this.handleClientInput(input, "synthetic");
        }
      }
      return;
    }

    for (const input of normalized) {
      this.handleClientInput(input, "synthetic");
    }
  }

  handleClientMouseInput(x, y, button, source = "user") {
    if (this.isClosed) {
      return;
    }

    const tileX = Math.trunc(Number(x));
    const tileY = Math.trunc(Number(y));
    const clickButton = Math.trunc(Number(button));
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
      return;
    }

    const clickMod = this.resolveMouseClickMod(clickButton);
    if (clickMod === null) {
      return;
    }
    if (clickButton === 0 && this.isClickMoveBlocked()) {
      console.log(
        `Discarding click-move during travel overlap window: button=${clickButton} tile=(${tileX}, ${tileY})`,
      );
      return;
    }

    console.log(
      `Received client mouse input: button=${clickButton} tile=(${tileX}, ${tileY}) mod=${clickMod}`,
    );

    // If NetHack is stuck waiting for an unrelated async selector flow, cancel
    // it and allow mouse movement/clicklook input to reach nh_poskey.
    if (this.pendingExtendedCommandRequest) {
      console.log(
        "Cancelling pending extended-command request due mouse input",
      );
      this.resolvePendingExtendedCommandRequest(-1);
    }
    if (this.pendingMenuSelection && this.isInMultiPickup) {
      console.log("Cancelling pending multi-pickup selection due mouse input");
      this.resolveMenuSelection(-1);
    }
    if (this.pendingTextRequest) {
      console.log("Cancelling pending text request due mouse input");
      this.handleTextInputResponse("\x1b", "system");
    }
    if (source === "user" && this.hasPendingInventoryContextSelection()) {
      this.clearPendingInventoryContextSelection("new user mouse input");
    }

    if (clickButton === 0) {
      if (
        this.activeInputRequest?.kind === "position" &&
        this.farLookMode === "active" &&
        !this.shouldPreserveFarLookAfterMouseSelection()
      ) {
        this.farLookMode = "none";
        this.farLookOrigin = null;
        this.setPositionInputActive(false);
      }
      const legacyCursorPromptMouseExamineActive =
        this.runtimeVersion === "slashem" &&
        this.activeInputRequest?.kind === "position" &&
        this.farLookMode === "active" &&
        this.farLookOrigin === "legacy_cursor_prompt";
      const playerX = Number(this.playerPosition?.x);
      const playerY = Number(this.playerPosition?.y);
      const clickedCurrentPlayerTile =
        Number.isFinite(playerX) &&
        Number.isFinite(playerY) &&
        tileX === Math.trunc(playerX) &&
        tileY === Math.trunc(playerY);
      if (legacyCursorPromptMouseExamineActive) {
        console.log(
          `Preserving legacy Slash'EM cursor far-look mouse examine at (${tileX}, ${tileY})`,
        );
      } else if (clickedCurrentPlayerTile) {
        this.maybeArmPendingPostActionPlayerTileRefreshForCurrentPlayerLoot(
          `for mouse pickup intent on current player tile (${tileX}, ${tileY})`,
        );
      } else {
        this.maybeArmPendingPostActionPlayerTileRefreshForLootMoveTarget(
          tileX,
          tileY,
          `for mouse movement intent onto (${tileX}, ${tileY})`,
        );
      }
    }

    this.enqueueMouseInput(tileX, tileY, clickMod, source);
  }

  // Handle incoming input from the client
  handleClientInput(input, source = "user") {
    if (this.isClosed) {
      return;
    }
    if (typeof input !== "string" || input.length === 0) {
      return;
    }
    if (input === this.contextualGlanceProbePrefix) {
      // Arms auto-cancel for synthetic contextual tile probes driven by
      // the modern #glance flow.
      this.contextualGlanceProbeMouseDeadlineMs = Date.now() + 1200;
      this.contextualGlanceAutoCancelPositionUntilMs = 0;
      return;
    }
    if (input === this.contextualLookInfoProbePrefix) {
      // Arms a synthetic map-routed "/what is" probe which should choose the
      // map target, then request verbose info and exit the follow-up loop.
      this.pendingContextualLookMapRouteSelection = true;
      this.contextualLookInfoProbeMouseDeadlineMs =
        Date.now() + this.contextualLookInfoProbeMouseWindowMs;
      this.contextualLookInfoAutoFlowStage =
        this.runtimeVersion === "slashem"
          ? "await_cursor_confirm"
          : "await_mouse_target";
      this.contextualLookInfoAutoFlowUntilMs = Date.now() + 15000;
      return;
    }

    console.log("Received client input:", input, {
      source,
      awaitingQuestionInput: this.awaitingQuestionInput,
      pendingTextResponses: this.pendingTextResponses.length,
      activeInputRequestType: this.activeInputRequest?.kind || null,
      pendingExtendedCommandRequest: Boolean(
        this.pendingExtendedCommandRequest,
      ),
      pendingMenuSelection: Boolean(this.pendingMenuSelection),
      isInMultiPickup: this.isInMultiPickup,
      hasPendingTextRequest: Boolean(this.pendingTextRequest),
    });

    if (
      this.activeInputRequest?.kind === "position" &&
      (this.positionInputActive || this.isFarLookPositionRequest()) &&
      !this.isPositionRequestContinuationInput(input)
    ) {
      console.log(
        `Cancelling active position request before command input "${input}"`,
      );
      this.enqueueInputKeys(["Escape"], "system", ["position"]);
    }

    if (
      this.hasPendingInventoryContextSelection() &&
      !this.isAnyInventoryContextSelectionInput(input) &&
      !this.awaitingQuestionInput
    ) {
      // Preserve freshly-armed contextual inventory selections through the
      // immediate command key (for example "__INVCTX_SELECT__:i" + "N").
      // Clear only if the pending state has gone stale.
      const pending =
        this.pendingInventoryContextSelection &&
        typeof this.pendingInventoryContextSelection === "object"
          ? this.pendingInventoryContextSelection
          : null;
      const armedAtMs =
        pending && Number.isFinite(pending.armedAtMs)
          ? Math.trunc(Number(pending.armedAtMs))
          : 0;
      const staleWindowMs = 3000;
      const nowMs = Date.now();
      if (armedAtMs > 0 && nowMs - armedAtMs > staleWindowMs) {
        this.clearPendingInventoryContextSelection("stale after user input");
      } else {
        const issuedAtMs =
          pending && Number.isFinite(pending.commandIssuedAtMs)
            ? Math.trunc(Number(pending.commandIssuedAtMs))
            : 0;
        if (source === "system") {
          // Internal synthetic/system keys should not extend contextual
          // selection lifetime.
        } else if (issuedAtMs <= 0 && pending) {
          pending.commandIssuedAtMs = nowMs;
        } else if (issuedAtMs > 0) {
          this.clearPendingInventoryContextSelection(
            "superseded by subsequent user input",
          );
        }
      }
    }

    if (
      this.pendingMenuSelection &&
      this.isInMultiPickup &&
      this.isDirectionalMovementInput(input) &&
      !this.awaitingQuestionInput
    ) {
      console.log(
        `Cancelling pending multi-pickup selection due directional input "${input}"`,
      );
      this.resolveMenuSelection(-1);
    }
    if (this.pendingTextRequest && this.isDirectionalMovementInput(input)) {
      console.log(
        `Cancelling pending text request due directional input "${input}"`,
      );
      this.handleTextInputResponse("\x1b", "system");
    }

    if (this.tryConsumePendingExtendedCommandInput(input)) {
      return;
    }

    if (this.isTextInputCommand(input)) {
      const text = input.slice(this.textInputPrefix.length);
      this.handleTextInputResponse(text, source);
      return;
    }

    if (this.armInventoryContextSelectionFromInput(input)) {
      if (
        this.awaitingQuestionInput &&
        Array.isArray(this.currentMenuItems) &&
        this.currentMenuItems.some((item) => item && !item.isCategory)
      ) {
        const didAutoSelect =
          this.tryAutoHandlePendingInventoryContextSelection(
            this.currentMenuQuestionText,
            this.currentMenuItems,
            {
              reason: "context action (armed during active menu wait)",
            },
          );
        if (didAutoSelect) {
          this.wakeAwaitingQuestionInputForAutoSelection(source);
        }
      }
      return;
    }

    if (this.isMetaInput(input)) {
      const metaKey = input.slice(this.metaInputPrefix.length).charAt(0);
      if (!metaKey) {
        return;
      }

      const mappedExtCommand =
        this.resolveMetaBoundExtendedCommandName(metaKey);
      if (mappedExtCommand) {
        if (!this.canQueueExtendedCommandSubmission()) {
          console.log(
            `Meta extended command "${mappedExtCommand}" blocked by active prompt state; forwarding "${metaKey}" as normal event input`,
          );
          this.clearQueuedExtendedCommandSubmission(
            "blocked meta extended command",
          );
          this.enqueueInputKeys([metaKey], "meta", ["event"]);
          return;
        }
        console.log(
          `Meta input Alt+${metaKey.toLowerCase()} mapped to extended command "${mappedExtCommand}"`,
        );
        this.queueExtendedCommandSubmission(mappedExtCommand, "meta");
        return;
      }

      this.enqueueInputKeys(["Escape", metaKey], "meta", ["event"]);
      return;
    }

    if (this.isCtrlInput(input)) {
      const ctrlKey = input.slice(this.ctrlInputPrefix.length).charAt(0);
      if (!ctrlKey) {
        return;
      }
      // NetHack expects control-byte keycodes: C(c) = (0x1f & c).
      const controlCode = ctrlKey.charCodeAt(0) & 0x1f;
      if (controlCode <= 0) {
        return;
      }
      this.enqueueInputKeys([String.fromCharCode(controlCode)], "ctrl");
      return;
    }

    const selectedMenuItem = this.resolveMenuItemFromSelectionInput(input);
    if (selectedMenuItem) {
      const selectionCount = this.decodeMenuSelectionCount(input);
      const selectionEntry =
        this.createSelectionEntryFromMenuItem(selectedMenuItem, selectionCount);
      if (!selectionEntry) {
        return;
      }
      const selectionKey = this.getMenuSelectionKey(selectionEntry);

      if (this.isInMultiPickup) {
        if (this.menuSelections.has(selectionKey)) {
          if (Number.isFinite(selectionCount) && Number(selectionCount) > 0) {
            this.menuSelections.set(selectionKey, selectionEntry);
            console.log(
              `Updated selected item count: ${selectionEntry.menuChar} (${selectionEntry.text}) x${selectionEntry.count}. Current selections:`,
              Array.from(this.menuSelections.values()).map(
                (item) =>
                  `${item.menuChar}:${item.text}${
                    Number.isFinite(item.count) ? ` x${item.count}` : ""
                  }`,
              ),
            );
          } else {
            this.menuSelections.delete(selectionKey);
            console.log(
              `Deselected item: ${selectionEntry.menuChar} (${selectionEntry.text}). Current selections:`,
              Array.from(this.menuSelections.values()).map(
                (item) => `${item.menuChar}:${item.text}`,
              ),
            );
          }
        } else {
          this.menuSelections.set(selectionKey, selectionEntry);
          console.log(
            `Selected item: ${selectionEntry.menuChar} (${selectionEntry.text}). Current selections:`,
            Array.from(this.menuSelections.values()).map(
              (item) =>
                `${item.menuChar}:${item.text}${
                  Number.isFinite(item.count) ? ` x${item.count}` : ""
                }`,
            ),
          );
        }
        return;
      }

      this.menuSelections.clear();
      this.menuSelections.set(selectionKey, selectionEntry);
      this.lastMenuInteractionCancelled = false;
      console.log(
        `Recorded single menu selection by index: ${selectionEntry.menuIndex} (${selectionEntry.menuChar} ${selectionEntry.text})`,
      );

      if (this.awaitingQuestionInput) {
        this.armPendingPostActionPlayerTileRefreshForQuestion(
          this.resolvePostActionPlayerTileRefreshQuestionContext(
            this.currentMenuQuestionText,
          ),
        );
        const wakeInput = this.getMenuSelectionWakeInput(selectedMenuItem);
        this.enqueueInputKeys([wakeInput], source, ["event"]);
      }
      return;
    }

    if (this.isLiteralTextInput(input)) {
      this.handleTextInputResponse(input, source);
      return;
    }

    const normalizedInput = this.normalizeInputKey(input);
    if (
      !this.isInMultiPickup &&
      normalizedInput === "Escape" &&
      this.awaitingQuestionInput &&
      Array.isArray(this.currentMenuItems) &&
      this.currentMenuItems.some((item) => item && !item.isCategory)
    ) {
      this.lastMenuInteractionCancelled = true;
      this.clearPendingInventoryContextSelection("menu interaction cancelled");
    }
    if (
      this.pendingGameOverPossessionsInventoryFlow &&
      this.isGameOverPossessionsIdentifyQuestion(this.lastQuestionText)
    ) {
      const normalizedYesNoInput = String(normalizedInput || "")
        .trim()
        .toLowerCase();
      if (normalizedYesNoInput !== "y") {
        this.pendingGameOverPossessionsInventoryFlow = false;
      }
    }

    if (
      !this.isInMultiPickup &&
      this.awaitingQuestionInput &&
      typeof normalizedInput === "string" &&
      normalizedInput.length === 1 &&
      Array.isArray(this.currentMenuItems) &&
      this.currentMenuItems.length > 0
    ) {
      const suppressSyntheticSelectionOverride =
        source === "synthetic" &&
        this.menuSelections.size > 0 &&
        this.hasPendingInventoryContextSelection() &&
        this.lastEndedMenuWindow === 4 &&
        !this.lastEndedMenuHadQuestion &&
        this.lastEndedInventoryMenuKind === "inventory";
      if (suppressSyntheticSelectionOverride) {
        console.log(
          `Ignoring synthetic menu accelerator "${normalizedInput}" while preserving contextual inventory auto-selection`,
        );
      } else {
        const menuItem = this.currentMenuItems.find(
          (item) => item.accelerator === normalizedInput && !item.isCategory,
        );
        if (menuItem) {
          this.menuSelections.clear();
          const selectionEntry = this.createSelectionEntryFromMenuItem(menuItem);
          if (!selectionEntry) {
            return;
          }
          const selectionKey = this.getMenuSelectionKey(selectionEntry);
          this.menuSelections.set(selectionKey, selectionEntry);
          this.lastMenuInteractionCancelled = false;
          console.log(
            `Recorded single menu selection: ${normalizedInput} (${menuItem.text})`,
          );
          this.armPendingPostActionPlayerTileRefreshForQuestion(
            this.resolvePostActionPlayerTileRefreshQuestionContext(
              this.currentMenuQuestionText,
            ),
          );
          if (this.isLookAtMapMenuSelection(menuItem)) {
            this.enqueueInputKeys([";"], source, ["event"]);
            return;
          }
        }
      }
    }

    if (
      this.isInMultiPickup &&
      typeof normalizedInput === "string" &&
      normalizedInput.length === 1 &&
      normalizedInput !== "\r" &&
      normalizedInput !== "\n" &&
      normalizedInput !== "Escape"
    ) {
      const menuItem = this.currentMenuItems.find(
        (item) => item.accelerator === normalizedInput && !item.isCategory,
      );
      if (menuItem) {
        const selectionEntry = this.createSelectionEntryFromMenuItem(menuItem);
        if (!selectionEntry) {
          return;
        }
        const selectionKey = this.getMenuSelectionKey(selectionEntry);
        if (this.menuSelections.has(selectionKey)) {
          this.menuSelections.delete(selectionKey);
          console.log(
            `Deselected item: ${normalizedInput} (${menuItem.text}). Current selections:`,
            Array.from(this.menuSelections.values()).map(
              (item) => `${item.menuChar}:${item.text}`,
            ),
          );
        } else {
          this.menuSelections.set(selectionKey, selectionEntry);
          console.log(
            `Selected item: ${normalizedInput} (${menuItem.text}). Current selections:`,
            Array.from(this.menuSelections.values()).map(
              (item) => `${item.menuChar}:${item.text}`,
            ),
          );
        }
      } else {
        console.log(`No menu item found for accelerator '${normalizedInput}'`);
      }
      console.log("Multi-pickup item selection updated");
      return;
    }

    if (
      this.isInMultiPickup &&
      (normalizedInput === "Enter" ||
        normalizedInput === "\r" ||
        normalizedInput === "\n")
    ) {
      const selectedItems = Array.from(this.menuSelections.values()).map(
        (item) => `${item.menuChar}:${item.text}`,
      );
      console.log("Confirming multi-pickup with selections:", selectedItems);
      this.armPendingPostActionPlayerTileRefreshForQuestion(
        this.resolvePostActionPlayerTileRefreshQuestionContext(
          this.currentMenuQuestionText,
        ),
      );
      this.lastMenuInteractionCancelled = false;
      this.resolveMenuSelection(this.menuSelections.size);
      if (this.inputBroker.hasPendingRequests("event")) {
        this.enqueueInputKeys(["Enter"], source, ["event"]);
      }
      return;
    }

    if (this.isInMultiPickup && normalizedInput === "Escape") {
      this.menuSelections.clear();
      this.resolveMenuSelection(-1);
      this.clearPendingInventoryContextSelection(
        "multi-select menu interaction cancelled",
      );
      if (this.inputBroker.hasPendingRequests("event")) {
        this.enqueueInputKeys(["Escape"], source, ["event"]);
      }
      return;
    }

    const normalizedAnsweredYnInput = String(normalizedInput || "")
      .trim()
      .toLowerCase();
    if (this.awaitingQuestionInput && this.pendingLegacySlashEmCursorPromptFarLook) {
      if (normalizedAnsweredYnInput === "y") {
        console.log(
          'Arming far-look mode for legacy Slash\'EM cursor prompt on answered "y"',
        );
        this.farLookMode = "armed";
        this.farLookOrigin = "legacy_cursor_prompt";
        this.pendingLookMenuFarLookArm = false;
      }
      this.pendingLegacySlashEmCursorPromptFarLook = false;
    }
    if (this.awaitingQuestionInput && this.activeYnPrompt) {
      this.armPendingPostActionPlayerTileRefreshForAnsweredYnQuestion(
        this.lastQuestionText,
        normalizedInput,
      );
    }
    if (normalizedInput === ",") {
      this.maybeArmPendingPostActionPlayerTileRefreshForCurrentPlayerLoot(
        'for explicit pickup input "," on current player tile',
      );
    }
    if (this.isDirectionalMovementInput(normalizedInput)) {
      const movementTarget =
        this.resolveMovementTargetPositionFromInput(normalizedInput);
      if (movementTarget) {
        this.maybeArmPendingPostActionPlayerTileRefreshForLootMoveTarget(
          movementTarget.x,
          movementTarget.y,
          `for keyboard movement intent "${normalizedInput}" onto (${movementTarget.x}, ${movementTarget.y})`,
        );
      }
    }

    this.enqueueInputKeys([normalizedInput], source);
  }

  enqueueInputKeys(keys, source = "user", targetKinds = "any") {
    const now = Date.now();
    const tokens = [];
    for (const key of keys) {
      if (typeof key !== "string" || key.length === 0) {
        continue;
      }
      tokens.push({
        key,
        source,
        createdAt: now,
        targetKinds,
      });
    }
    if (tokens.length > 0) {
      this.inputBroker.enqueueTokens(tokens);
    }
  }

  resolveMouseClickMod(button) {
    if (button === 0) {
      return this.mouseClickPrimaryMod;
    }
    if (button === 2) {
      return this.mouseClickSecondaryMod;
    }
    return null;
  }

  getClickMoveBlockDurationMs() {
    const baseDelayMs = Number(this.travelSpeedDelayMs);
    if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
      return this.travelClickMoveBlockExtraMs;
    }
    return baseDelayMs + this.travelClickMoveBlockExtraMs;
  }

  beginClickMoveBlockWindow() {
    this.clickMoveBlockedUntilMs =
      Date.now() + this.getClickMoveBlockDurationMs();
  }

  isClickMoveBlocked() {
    return Date.now() < this.clickMoveBlockedUntilMs;
  }

  enqueueMouseInput(x, y, mod, source = "user") {
    this.inputBroker.enqueueTokens([
      {
        key: this.mouseInputTokenKey,
        source,
        createdAt: Date.now(),
        targetKinds: ["position"],
        mouseX: x,
        mouseY: y,
        mouseMod: mod,
      },
    ]);
  }

  resolvePoskeyTargetPointer(ptr, label) {
    const resolvedPtr = this.normalizeWasmPointer(ptr, {
      label: `nh_poskey_${label}_ptr`,
      minBytes: 4,
      alignment: 1,
    });
    if (!resolvedPtr) {
      console.log(
        `Skipping nh_poskey ${label} pointer resolve (ptr=${ptr}): invalid pointer`,
      );
      return null;
    }

    const callbackMode =
      this.getRuntimePointerContract()?.callbackModes?.shim_nh_poskey || null;
    if (callbackMode && callbackMode.pointerArgsAreDirect !== true) {
      this.notePointerContractViolation(
        "nh_poskey-mode",
        "shim_nh_poskey pointer mode is not configured as direct pointers.",
      );
      return null;
    }

    // Pointer contract: winshim.c exposes shim_nh_poskey as "ippp"; local_callback
    // forwards each "p" argument as the raw pointer value (no implicit deref).
    return resolvedPtr;
  }

  resolveTextInputBufferPointer(ptr) {
    if (!this.nethackModule) {
      return null;
    }

    const resolvedPtr = this.normalizeWasmPointer(ptr, {
      label: "shim_getlin_buffer_ptr",
      minBytes: 1,
      alignment: 1,
    });
    if (!resolvedPtr) {
      console.log(
        `Unable to resolve getlin buffer pointer (raw=${ptr})`,
      );
      return null;
    }

    const callbackMode =
      this.getRuntimePointerContract()?.callbackModes?.shim_getlin || null;
    if (callbackMode && callbackMode.pointerArgsAreDirect !== true) {
      this.notePointerContractViolation(
        "getlin-mode",
        "shim_getlin pointer mode is not configured as direct pointers.",
      );
      return null;
    }

    // Pointer contract: winshim.c exposes shim_getlin as "vsp"; local_callback
    // forwards "p" arguments as raw pointer values (direct writable char*).
    return resolvedPtr;
  }

  getPoskeyCoordStoreType() {
    const callbackMode =
      this.getRuntimePointerContract()?.callbackModes?.shim_nh_poskey || null;
    const contractType =
      callbackMode &&
      (callbackMode.coordArgType === "i8" ||
        callbackMode.coordArgType === "i16" ||
        callbackMode.coordArgType === "i32")
        ? callbackMode.coordArgType
        : null;
    if (contractType) {
      return contractType;
    }

    // NetHack 3.6.7 exposes nh_poskey(int*, int*, int*), while 5.0 uses
    // nh_poskey(coordxy*, coordxy*, int*) with coordxy=int16_t. Never infer
    // the write width from pointer spacing because stack layout varies by
    // build/platform and can turn a safe write into stack corruption.
    return this.runtimeVersion === "5.0" ? "i16" : "i32";
  }

  writePoskeyTargetValue(targetPtr, value, label, storeType = "i32") {
    if (
      !this.nethackModule ||
      typeof this.nethackModule.setValue !== "function" ||
      !Number.isInteger(targetPtr) ||
      targetPtr <= 0
    ) {
      console.log(
        `Skipping nh_poskey ${label} write (target=${targetPtr}, value=${value})`,
      );
      return false;
    }

    this.nethackModule.setValue(targetPtr, value, storeType);
    return true;
  }

  applyMouseTokenToPoskeyRequest(token, requestContext) {
    if (!token) {
      return false;
    }

    const mouseX = Math.trunc(Number(token.mouseX));
    const mouseY = Math.trunc(Number(token.mouseY));
    const mouseMod = Math.trunc(Number(token.mouseMod));
    if (
      !Number.isFinite(mouseX) ||
      !Number.isFinite(mouseY) ||
      !Number.isFinite(mouseMod)
    ) {
      return false;
    }
    if (!requestContext) {
      return false;
    }

    const xTargetPtr = this.resolvePoskeyTargetPointer(
      requestContext.xPtr,
      "x",
    );
    const yTargetPtr = this.resolvePoskeyTargetPointer(
      requestContext.yPtr,
      "y",
    );
    const modTargetPtr = this.resolvePoskeyTargetPointer(
      requestContext.modPtr,
      "mod",
    );
    if (!xTargetPtr || !yTargetPtr || !modTargetPtr) {
      return false;
    }

    const coordStoreType = this.getPoskeyCoordStoreType();
    this.writePoskeyTargetValue(xTargetPtr, mouseX, "x", coordStoreType);
    this.writePoskeyTargetValue(yTargetPtr, mouseY, "y", coordStoreType);
    this.writePoskeyTargetValue(modTargetPtr, mouseMod, "mod", "i32");
    console.log(
      `Delivered mouse input to nh_poskey: (${mouseX}, ${mouseY}) mod=${mouseMod} (xPtr=${xTargetPtr}, yPtr=${yTargetPtr}, modPtr=${modTargetPtr}, coordType=${coordStoreType})`,
    );
    if (this.runtimeVersion === "5.0" && mouseMod > 0) {
      this.runtime5TileContextAutoPickFirstUntilMs =
        Date.now() + this.runtime5TileContextAutoPickFirstWindowMs;
    }
    return true;
  }

  normalizeInputKey(input) {
    if (input === "\r" || input === "\n") {
      return "Enter";
    }
    return input;
  }

  shouldAutoPickFirstRuntime5TileContextAction(menuQuestion, menuItems) {
    if (this.runtimeVersion !== "5.0") {
      return false;
    }
    if (this.hasPendingInventoryContextSelection()) {
      return false;
    }
    if (
      !Number.isFinite(this.runtime5TileContextAutoPickFirstUntilMs) ||
      Date.now() > this.runtime5TileContextAutoPickFirstUntilMs
    ) {
      return false;
    }

    const normalizedQuestion = this.normalizeQuestionText(menuQuestion);
    if (!normalizedQuestion.includes("what do you want to do")) {
      return false;
    }

    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      return false;
    }

    const selectableItems = menuItems.filter((item) => item && !item.isCategory);
    return selectableItems.length > 0;
  }

  doesMenuItemTextContain(menuItem, text) {
    if (!menuItem || typeof text !== "string" || text.length === 0) {
      return false;
    }
    const itemText =
      typeof menuItem.text === "string" ? menuItem.text.toLowerCase() : "";
    return itemText.includes(text.toLowerCase());
  }

  resolveRuntime5TileContextSpecialAutoPickMenuItem(selectableItems) {
    const autoPickRules = [
      {
        requiredTexts: ["Talk to ", "Swap places with "],
        preferredText: "Swap places with ",
      },
    ];

    for (const rule of autoPickRules) {
      const hasRequiredItems = rule.requiredTexts.every((text) =>
        selectableItems.some((item) => this.doesMenuItemTextContain(item, text)),
      );
      if (!hasRequiredItems) {
        continue;
      }

      const preferredItem = selectableItems.find((item) =>
        this.doesMenuItemTextContain(item, rule.preferredText),
      );
      if (preferredItem) {
        return preferredItem;
      }
    }

    return null;
  }

  shouldShowRuntime5TileContextQuestion(selectableItems) {
    const modalRequiredTexts = ["Examine trap"];
    return modalRequiredTexts.some((text) =>
      selectableItems.some((item) => this.doesMenuItemTextContain(item, text)),
    );
  }

  resolveRuntime5TileContextAutoPickMenuItem(menuQuestion, menuItems) {
    if (
      !this.shouldAutoPickFirstRuntime5TileContextAction(
        menuQuestion,
        menuItems,
      )
    ) {
      return null;
    }

    const selectableItems = menuItems.filter((item) => item && !item.isCategory);
    if (this.shouldShowRuntime5TileContextQuestion(selectableItems)) {
      return null;
    }

    const specialPick =
      this.resolveRuntime5TileContextSpecialAutoPickMenuItem(selectableItems);
    return specialPick || selectableItems[0] || null;
  }

  tryAutoPickRuntime5TileContextMenuItem(menuQuestion, menuItems) {
    const autoPickItem = this.resolveRuntime5TileContextAutoPickMenuItem(
      menuQuestion,
      menuItems,
    );
    if (!autoPickItem) {
      return false;
    }

    this.runtime5TileContextAutoPickFirstUntilMs = 0;
    return this.tryAutoSelectMenuItem(
      autoPickItem,
      "runtime 5.0 tile context menu auto-pick",
    );
  }

  getPostActionPlayerTileRefreshReasonForMenuItem(menuItem) {
    if (!menuItem || typeof menuItem !== "object") {
      return null;
    }
    const normalizedText =
      typeof menuItem.text === "string"
        ? menuItem.text.trim().toLowerCase()
        : "";
    if (!normalizedText) {
      return null;
    }
    if (normalizedText.startsWith("pick up")) {
      return "pickup-auto-menu";
    }
    if (
      normalizedText.startsWith("drop ") ||
      normalizedText === "drop items"
    ) {
      return "drop-auto-menu";
    }
    if (normalizedText.startsWith("eat ")) {
      return "eat-auto-menu";
    }
    return null;
  }

  getPostActionPlayerTileRefreshReasonForQuestion(question) {
    const normalizedQuestion = this.normalizeQuestionText(question);
    if (!normalizedQuestion) {
      return null;
    }
    if (
      normalizedQuestion.includes("pick up what") ||
      normalizedQuestion.includes("what do you want to pick up") ||
      normalizedQuestion.includes("what would you like to pick up")
    ) {
      return "pickup-question";
    }
    if (
      normalizedQuestion.includes("drop what") ||
      normalizedQuestion.includes("what do you want to drop") ||
      normalizedQuestion.includes("what would you like to drop") ||
      normalizedQuestion.includes("drop what type of items")
    ) {
      return "drop-question";
    }
    if (
      normalizedQuestion.includes("eat what") ||
      normalizedQuestion.includes("what do you want to eat") ||
      normalizedQuestion.includes("what would you like to eat")
    ) {
      return "eat-question";
    }
    return null;
  }

  getPostActionPlayerTileRefreshReasonForAnsweredYnQuestion(question, input) {
    const normalizedQuestion = this.normalizeQuestionText(question);
    const normalizedInput = String(input ?? "").trim().toLowerCase();
    if (!normalizedQuestion || normalizedInput !== "y") {
      return null;
    }
    if (normalizedQuestion.includes("eat it")) {
      return "eat-confirm-question";
    }
    return null;
  }

  getPostActionPlayerTileRefreshReasonPriority(refreshReason) {
    switch (String(refreshReason || "").trim()) {
      case "move-onto-lootlike-tile":
      case "pickup-current-player-tile":
      case "autopickup-raw-print":
        return 100;
      case "pickup-question":
      case "pickup-auto-menu":
      case "eat-question":
      case "eat-auto-menu":
      case "eat-confirm-question":
      case "drop-question":
      case "drop-auto-menu":
        return 80;
      case "monster-like-vacated-tile":
        return 20;
      default:
        return 50;
    }
  }

  armPendingPostActionPlayerTileRefreshByReason(
    refreshReason,
    sourceLabel,
    target = null,
    snapshot = null,
  ) {
    const normalizedReason =
      typeof refreshReason === "string" ? refreshReason.trim() : "";
    if (!normalizedReason) {
      return;
    }
    const existingReason =
      typeof this.pendingPostActionPlayerTileRefreshReason === "string"
        ? this.pendingPostActionPlayerTileRefreshReason.trim()
        : "";
    if (existingReason) {
      const existingPriority =
        this.getPostActionPlayerTileRefreshReasonPriority(existingReason);
      const nextPriority =
        this.getPostActionPlayerTileRefreshReasonPriority(normalizedReason);
      if (existingPriority > nextPriority) {
        console.log(
          `Keeping existing post-action top-item check (${existingReason}) instead of lower-priority (${normalizedReason}) ${sourceLabel}`,
        );
        return;
      }
    }
    this.pendingPostActionPlayerTileRefreshReason = normalizedReason;
    this.pendingPostActionPlayerTileRefreshTarget =
      target &&
      Number.isFinite(target.x) &&
      Number.isFinite(target.y)
        ? { x: Math.trunc(Number(target.x)), y: Math.trunc(Number(target.y)) }
        : null;
    this.pendingPostActionPlayerTileRefreshSnapshot =
      snapshot && typeof snapshot === "object" ? { ...snapshot } : null;
    console.log(
      `Armed post-action top-item check (${normalizedReason}) ${sourceLabel}`,
      this.pendingPostActionPlayerTileRefreshTarget,
    );
  }

  clearPendingPostActionPlayerTileRefreshByReason(refreshReason, sourceLabel) {
    const normalizedReason =
      typeof refreshReason === "string" ? refreshReason.trim() : "";
    const existingReason =
      typeof this.pendingPostActionPlayerTileRefreshReason === "string"
        ? this.pendingPostActionPlayerTileRefreshReason.trim()
        : "";
    if (!normalizedReason || existingReason !== normalizedReason) {
      return;
    }
    this.pendingPostActionPlayerTileRefreshReason = null;
    this.pendingPostActionPlayerTileRefreshTarget = null;
    this.pendingPostActionPlayerTileRefreshSnapshot = null;
    console.log(
      `Cleared post-action top-item check (${normalizedReason}) ${sourceLabel}`,
    );
  }

  clearPendingPostActionPlayerTileRefresh(sourceLabel) {
    const existingReason =
      typeof this.pendingPostActionPlayerTileRefreshReason === "string"
        ? this.pendingPostActionPlayerTileRefreshReason.trim()
        : "";
    if (!existingReason) {
      return;
    }
    this.pendingPostActionPlayerTileRefreshReason = null;
    this.pendingPostActionPlayerTileRefreshTarget = null;
    this.pendingPostActionPlayerTileRefreshSnapshot = null;
    console.log(
      `Cleared post-action top-item check (${existingReason}) ${sourceLabel}`,
    );
  }

  clearPendingCurrentPlayerPickupRefreshIfTargetDiffers(
    targetX,
    targetY,
    sourceLabel,
  ) {
    const pendingReason =
      typeof this.pendingPostActionPlayerTileRefreshReason === "string"
        ? this.pendingPostActionPlayerTileRefreshReason.trim()
        : "";
    if (pendingReason !== "pickup-current-player-tile") {
      return;
    }
    const pendingTarget =
      this.pendingPostActionPlayerTileRefreshTarget &&
      Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.x) &&
      Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.y)
        ? {
            x: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.x)),
            y: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.y)),
          }
        : null;
    if (!pendingTarget) {
      this.clearPendingPostActionPlayerTileRefreshByReason(
        "pickup-current-player-tile",
        `${sourceLabel} (missing target)`,
      );
      return;
    }
    const normalizedTargetX = Math.trunc(Number(targetX));
    const normalizedTargetY = Math.trunc(Number(targetY));
    if (
      normalizedTargetX === pendingTarget.x &&
      normalizedTargetY === pendingTarget.y
    ) {
      return;
    }
    this.clearPendingPostActionPlayerTileRefreshByReason(
      "pickup-current-player-tile",
      `${sourceLabel} (new target ${normalizedTargetX},${normalizedTargetY} differs from ${pendingTarget.x},${pendingTarget.y})`,
    );
  }

  buildUnderPlayerItemSnapshotFromRuntimeMapTile(tileData) {
    if (!tileData || typeof tileData !== "object") {
      return null;
    }
    const glyph =
      typeof tileData.glyph === "number" && Number.isFinite(tileData.glyph)
        ? Math.trunc(tileData.glyph)
        : null;
    if (glyph === null || !this.isLootLikeGlyph(glyph)) {
      return null;
    }
    return {
      glyph,
      char:
        typeof tileData.char === "string" && tileData.char.length > 0
          ? tileData.char
          : null,
      color:
        typeof tileData.color === "number" && Number.isFinite(tileData.color)
          ? Math.trunc(tileData.color)
          : null,
      tileIndex:
        typeof tileData.tileIndex === "number" && Number.isFinite(tileData.tileIndex)
          ? Math.trunc(tileData.tileIndex)
          : null,
      symidx:
        typeof tileData.symidx === "number" && Number.isFinite(tileData.symidx)
          ? Math.trunc(tileData.symidx)
          : null,
    };
  }

  doesRuntimeMapTileMatchUnderPlayerSnapshot(tileData, snapshot) {
    if (
      !tileData ||
      typeof tileData !== "object" ||
      !snapshot ||
      typeof snapshot !== "object"
    ) {
      return false;
    }
    const tileGlyph =
      typeof tileData.glyph === "number" && Number.isFinite(tileData.glyph)
        ? Math.trunc(tileData.glyph)
        : null;
    const snapshotGlyph =
      typeof snapshot.glyph === "number" && Number.isFinite(snapshot.glyph)
        ? Math.trunc(snapshot.glyph)
        : null;
    if (tileGlyph === null || snapshotGlyph === null || tileGlyph !== snapshotGlyph) {
      return false;
    }

    const tileTileIndex =
      typeof tileData.tileIndex === "number" && Number.isFinite(tileData.tileIndex)
        ? Math.trunc(tileData.tileIndex)
        : null;
    const snapshotTileIndex =
      typeof snapshot.tileIndex === "number" && Number.isFinite(snapshot.tileIndex)
        ? Math.trunc(snapshot.tileIndex)
        : null;
    if (
      tileTileIndex !== null &&
      snapshotTileIndex !== null &&
      tileTileIndex !== snapshotTileIndex
    ) {
      return false;
    }

    const tileSymidx =
      typeof tileData.symidx === "number" && Number.isFinite(tileData.symidx)
        ? Math.trunc(tileData.symidx)
        : null;
    const snapshotSymidx =
      typeof snapshot.symidx === "number" && Number.isFinite(snapshot.symidx)
        ? Math.trunc(snapshot.symidx)
        : null;
    if (tileSymidx !== null && snapshotSymidx !== null && tileSymidx !== snapshotSymidx) {
      return false;
    }

    return true;
  }

  findAdjacentRuntimeMapTileMatchingUnderPlayerSnapshot(target, snapshot) {
    if (
      !target ||
      typeof target !== "object" ||
      !Number.isFinite(target.x) ||
      !Number.isFinite(target.y) ||
      !snapshot ||
      typeof snapshot !== "object"
    ) {
      return null;
    }

    const originX = Math.trunc(Number(target.x));
    const originY = Math.trunc(Number(target.y));
    const matches = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const tileX = originX + dx;
        const tileY = originY + dy;
        const tileData = this.gameMap.get(`${tileX},${tileY}`) ?? null;
        if (!this.doesRuntimeMapTileMatchUnderPlayerSnapshot(tileData, snapshot)) {
          continue;
        }
        matches.push({ x: tileX, y: tileY });
      }
    }

    if (matches.length !== 1) {
      return null;
    }
    return matches[0];
  }

  maybeEmitConfirmedBoulderPushEventFromRuntimeMap(trigger = "unknown") {
    const pendingReason =
      typeof this.pendingPostActionPlayerTileRefreshReason === "string" &&
      this.pendingPostActionPlayerTileRefreshReason.trim().length > 0
        ? this.pendingPostActionPlayerTileRefreshReason.trim()
        : "";
    if (pendingReason !== "move-onto-lootlike-tile") {
      return false;
    }

    const pendingTarget =
      this.pendingPostActionPlayerTileRefreshTarget &&
      Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.x) &&
      Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.y)
        ? {
            x: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.x)),
            y: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.y)),
          }
        : null;
    const snapshot =
      this.pendingPostActionPlayerTileRefreshSnapshot &&
      typeof this.pendingPostActionPlayerTileRefreshSnapshot === "object"
        ? this.pendingPostActionPlayerTileRefreshSnapshot
        : null;
    if (!pendingTarget || !snapshot) {
      return false;
    }

    const shiftedTarget = this.findAdjacentRuntimeMapTileMatchingUnderPlayerSnapshot(
      pendingTarget,
      snapshot,
    );
    if (!shiftedTarget) {
      return false;
    }

    const moveDx = shiftedTarget.x - pendingTarget.x;
    const moveDy = shiftedTarget.y - pendingTarget.y;
    if (
      (moveDx === 0 && moveDy === 0) ||
      Math.abs(moveDx) > 1 ||
      Math.abs(moveDy) > 1
    ) {
      return false;
    }

    const targetKey = `${pendingTarget.x},${pendingTarget.y}`;
    const targetTileData = this.gameMap.get(targetKey) ?? null;
    const targetStillMatchesSnapshot = this.doesRuntimeMapTileMatchUnderPlayerSnapshot(
      targetTileData,
      snapshot,
    );
    if (targetStillMatchesSnapshot) {
      return false;
    }

    if (this.eventHandler) {
      this.emit({
        type: "confirmed_boulder_push",
        fromX: pendingTarget.x,
        fromY: pendingTarget.y,
        toX: shiftedTarget.x,
        toY: shiftedTarget.y,
        glyph:
          Number.isFinite(snapshot.glyph) ? Math.trunc(Number(snapshot.glyph)) : null,
        char:
          typeof snapshot.char === "string" && snapshot.char.length > 0
            ? snapshot.char
            : null,
        color:
          typeof snapshot.color === "number" && Number.isFinite(snapshot.color)
            ? Math.trunc(Number(snapshot.color))
            : null,
        tileIndex:
          typeof snapshot.tileIndex === "number" &&
          Number.isFinite(snapshot.tileIndex)
            ? Math.trunc(Number(snapshot.tileIndex))
            : null,
        symidx:
          typeof snapshot.symidx === "number" && Number.isFinite(snapshot.symidx)
            ? Math.trunc(Number(snapshot.symidx))
            : null,
      });
    }

    const didRefreshLiveUnderPlayerGlyph = this.canQueryWasmHelpers()
      ? this.emitUnderPlayerItemGlyphIfAvailableAt(
          pendingTarget.x,
          pendingTarget.y,
          null,
          null,
          true,
          `confirmed-boulder-push-runtime-map:${trigger}`,
        )
      : false;
    if (!didRefreshLiveUnderPlayerGlyph) {
      this.emitUnderPlayerItemGlyphClearedForPendingTarget(
        `confirmed-boulder-push-runtime-map:${trigger}`,
      );
    }
    this.clearPendingPostActionPlayerTileRefresh(
      `confirmed boulder push runtime-map [trigger=${trigger}]`,
    );
    return true;
  }

  emitUnderPlayerItemGlyphFromPendingSnapshot(trigger = "unknown") {
    if (!this.eventHandler) {
      return false;
    }
    const target =
      this.pendingPostActionPlayerTileRefreshTarget &&
      Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.x) &&
      Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.y)
        ? {
            x: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.x)),
            y: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.y)),
          }
        : null;
    const snapshot =
      this.pendingPostActionPlayerTileRefreshSnapshot &&
      typeof this.pendingPostActionPlayerTileRefreshSnapshot === "object"
        ? this.pendingPostActionPlayerTileRefreshSnapshot
        : null;
    if (!target || !snapshot || !Number.isFinite(snapshot.glyph)) {
      return false;
    }
    console.log(
      `Applying pending under-player item snapshot at (${target.x}, ${target.y}) [trigger=${trigger}] glyph=${snapshot.glyph}`,
    );
    this.emit({
      type: "under_player_item_glyph",
      x: target.x,
      y: target.y,
      glyph: Math.trunc(Number(snapshot.glyph)),
      char:
        typeof snapshot.char === "string" && snapshot.char.length > 0
          ? snapshot.char
          : null,
      color:
        typeof snapshot.color === "number" && Number.isFinite(snapshot.color)
          ? Math.trunc(snapshot.color)
          : null,
      tileIndex:
        typeof snapshot.tileIndex === "number" &&
        Number.isFinite(snapshot.tileIndex)
          ? Math.trunc(snapshot.tileIndex)
          : null,
      symidx:
        typeof snapshot.symidx === "number" && Number.isFinite(snapshot.symidx)
          ? Math.trunc(snapshot.symidx)
          : null,
    });
    return true;
  }

  emitUnderPlayerItemGlyphClearedForPendingTarget(trigger = "unknown") {
    if (!this.eventHandler) {
      return false;
    }
    const target =
      this.pendingPostActionPlayerTileRefreshTarget &&
      Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.x) &&
      Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.y)
        ? {
            x: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.x)),
            y: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.y)),
          }
        : null;
    if (!target) {
      return false;
    }
    console.log(
      `Clearing pending under-player item target at (${target.x}, ${target.y}) [trigger=${trigger}]`,
    );
    this.emit({
      type: "under_player_item_glyph_cleared",
      x: target.x,
      y: target.y,
    });
    return true;
  }

  emitUnderPlayerItemGlyphClearedForTarget(
    x,
    y,
    trigger = "unknown",
  ) {
    if (!this.eventHandler || !Number.isFinite(x) || !Number.isFinite(y)) {
      return false;
    }
    const tileX = Math.trunc(Number(x));
    const tileY = Math.trunc(Number(y));
    console.log(
      `Clearing under-player item target at (${tileX}, ${tileY}) [trigger=${trigger}]`,
    );
    this.emit({
      type: "under_player_item_glyph_cleared",
      x: tileX,
      y: tileY,
    });
    return true;
  }

  maybeArmPendingPostActionPlayerTileRefreshForLootMoveTarget(
    targetX,
    targetY,
    sourceLabel,
  ) {
    if (
      !Number.isFinite(targetX) ||
      !Number.isFinite(targetY) ||
      this.awaitingQuestionInput ||
      this.positionInputActive ||
      this.isFarLookPositionRequest()
    ) {
      return;
    }
    const tileX = Math.trunc(Number(targetX));
    const tileY = Math.trunc(Number(targetY));
    this.clearPendingCurrentPlayerPickupRefreshIfTargetDiffers(
      tileX,
      tileY,
      sourceLabel,
    );
    const destinationTileData = this.gameMap.get(`${tileX},${tileY}`);
    const destinationSnapshot =
      this.buildUnderPlayerItemSnapshotFromRuntimeMapTile(destinationTileData);
    if (!this.isLootLikeRuntimeMapTile(destinationTileData)) {
      this.clearPendingPostActionPlayerTileRefreshByReason(
        "move-onto-lootlike-tile",
        `${sourceLabel} (target is not loot-like)`,
      );
      return;
    }
    this.armPendingPostActionPlayerTileRefreshByReason(
      "move-onto-lootlike-tile",
      sourceLabel,
      { x: tileX, y: tileY },
      destinationSnapshot,
    );
  }

  maybeArmPendingPostActionPlayerTileRefreshForCurrentPlayerLoot(sourceLabel) {
    const playerX = Number(this.playerPosition?.x);
    const playerY = Number(this.playerPosition?.y);
    if (
      !Number.isFinite(playerX) ||
      !Number.isFinite(playerY) ||
      this.awaitingQuestionInput ||
      this.positionInputActive ||
      this.isFarLookPositionRequest()
    ) {
      return;
    }

    const normalizedPlayerX = Math.trunc(playerX);
    const normalizedPlayerY = Math.trunc(playerY);

    if (!this.canQueryWasmHelpers()) {
      this.armPendingPostActionPlayerTileRefreshByReason(
        "pickup-current-player-tile",
        `${sourceLabel} (optimistic arm while helpers unavailable)`,
        { x: normalizedPlayerX, y: normalizedPlayerY },
      );
      return;
    }

    const helpers =
      globalThis.nethackGlobal && globalThis.nethackGlobal.helpers
        ? globalThis.nethackGlobal.helpers
        : null;
    const topItemGlyphUnderPlayer =
      helpers && typeof helpers.topItemGlyphUnderPlayer === "function"
        ? helpers.topItemGlyphUnderPlayer
        : null;
    if (!topItemGlyphUnderPlayer) {
      return;
    }

    try {
      const topGlyph = Number(topItemGlyphUnderPlayer());
      if (!Number.isFinite(topGlyph) || !this.isLootLikeGlyph(topGlyph)) {
        this.clearPendingPostActionPlayerTileRefreshByReason(
          "pickup-current-player-tile",
          `${sourceLabel} (no loot-like top item under player)`,
        );
        return;
      }
    } catch (error) {
      console.log(
        "[WARN] maybeArmPendingPostActionPlayerTileRefreshForCurrentPlayerLoot failed:",
        error,
      );
      return;
    }

    this.armPendingPostActionPlayerTileRefreshByReason(
      "pickup-current-player-tile",
      sourceLabel,
      { x: normalizedPlayerX, y: normalizedPlayerY },
    );
  }

  armPendingPostActionPlayerTileRefresh(menuItem) {
    const refreshReason =
      this.getPostActionPlayerTileRefreshReasonForMenuItem(menuItem);
    if (!refreshReason) {
      return;
    }
    this.armPendingPostActionPlayerTileRefreshByReason(
      refreshReason,
      `for auto-selected menu item "${menuItem.text}"`,
    );
  }

  armPendingPostActionPlayerTileRefreshForQuestion(question) {
    const refreshReason =
      this.getPostActionPlayerTileRefreshReasonForQuestion(question);
    if (!refreshReason) {
      return;
    }
    this.armPendingPostActionPlayerTileRefreshByReason(
      refreshReason,
      `for question "${question}"`,
    );
  }

  armPendingPostActionPlayerTileRefreshForMenuInteraction(
    question,
    menuItem,
    sourceLabel,
  ) {
    const questionReason =
      this.getPostActionPlayerTileRefreshReasonForQuestion(question);
    if (questionReason) {
      this.armPendingPostActionPlayerTileRefreshByReason(
        questionReason,
        `${sourceLabel} via question "${question}"`,
      );
      return;
    }

    const menuItemReason =
      this.getPostActionPlayerTileRefreshReasonForMenuItem(menuItem);
    if (!menuItemReason) {
      return;
    }
    this.armPendingPostActionPlayerTileRefreshByReason(
      menuItemReason,
      `${sourceLabel} via menu item "${menuItem?.text ?? ""}"`,
    );
  }

  armPendingPostActionPlayerTileRefreshForAnsweredYnQuestion(question, input) {
    const refreshReason =
      this.getPostActionPlayerTileRefreshReasonForAnsweredYnQuestion(
        question,
        input,
      );
    if (!refreshReason) {
      return;
    }
    this.armPendingPostActionPlayerTileRefreshByReason(
      refreshReason,
      `for answered Y/N question "${question}" with input "${input}"`,
    );
  }

  isAutopickupInventoryAssignmentRawPrint(text) {
    if (typeof text !== "string") {
      return false;
    }
    const normalizedText = text.trim();
    if (normalizedText.length < 5) {
      return false;
    }
    if (
      this.runtimeVersion === "slashem" &&
      /^(?:\d+|a|an)\s+gold piece(?:s)?\.$/i.test(normalizedText)
    ) {
      return true;
    }
    return /^[^\s] - \S/.test(normalizedText);
  }

  armPendingPostActionPlayerTileRefreshForAutopickupRawPrint(text) {
    if (!this.isAutopickupInventoryAssignmentRawPrint(text)) {
      return;
    }

    const pendingTarget =
      this.pendingPostActionPlayerTileRefreshTarget &&
      Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.x) &&
      Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.y)
        ? {
            x: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.x)),
            y: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.y)),
          }
        : null;
    const playerX = Number(this.playerPosition?.x);
    const playerY = Number(this.playerPosition?.y);
    const currentPlayerTarget =
      Number.isFinite(playerX) && Number.isFinite(playerY)
        ? { x: Math.trunc(playerX), y: Math.trunc(playerY) }
        : null;
    const refreshTarget = pendingTarget ?? currentPlayerTarget;

    if (
      refreshTarget &&
      currentPlayerTarget &&
      refreshTarget.x === currentPlayerTarget.x &&
      refreshTarget.y === currentPlayerTarget.y &&
      this.canQueryWasmHelpers()
    ) {
      const didRefresh = this.emitUnderPlayerItemGlyphIfAvailableAt(
        refreshTarget.x,
        refreshTarget.y,
        null,
        null,
        true,
        `inventory-assignment:${text}`,
      );
      if (didRefresh) {
        this.clearPendingPostActionPlayerTileRefresh(
          `inventory-assignment raw_print "${text}" (immediate helper refresh)`,
        );
        return;
      }
    }

    if (refreshTarget) {
      this.armPendingPostActionPlayerTileRefreshByReason(
        "autopickup-raw-print",
        `for inventory-assignment raw_print "${text}"`,
        refreshTarget,
        null,
      );
      return;
    }
  }

  emitUnderPlayerItemGlyphIfAvailableAt(
    x,
    y,
    helpers = null,
    mapHelper = null,
    canQueryWasmHelpers = true,
    trigger = "unknown",
  ) {
    if (
      !this.eventHandler ||
      !canQueryWasmHelpers ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return false;
    }

    const tileX = Math.trunc(Number(x));
    const tileY = Math.trunc(Number(y));
    const isPlayerTile =
      this.playerPosition &&
      tileX === this.playerPosition.x &&
      tileY === this.playerPosition.y;
    if (!isPlayerTile) {
      return false;
    }

    const resolvedHelpers =
      helpers ||
      (globalThis.nethackGlobal && globalThis.nethackGlobal.helpers
        ? globalThis.nethackGlobal.helpers
        : null);
    const topItemGlyphUnderPlayer =
      resolvedHelpers &&
      typeof resolvedHelpers.topItemGlyphUnderPlayer === "function"
        ? resolvedHelpers.topItemGlyphUnderPlayer
        : null;
    if (!topItemGlyphUnderPlayer) {
      return false;
    }

    const topItemTileIndexUnderPlayer =
      resolvedHelpers &&
      typeof resolvedHelpers.topItemTileIndexUnderPlayer === "function"
        ? resolvedHelpers.topItemTileIndexUnderPlayer
        : null;
    const resolvedMapHelper =
      mapHelper ||
      (resolvedHelpers
        ? this.runtimeVersion === "5.0"
          ? typeof resolvedHelpers.mapGlyphInfoHelper === "function"
            ? resolvedHelpers.mapGlyphInfoHelper
            : null
          : typeof resolvedHelpers.mapglyphHelper === "function"
            ? resolvedHelpers.mapglyphHelper
            : null
        : null);

    try {
      const topGlyphRaw = topItemGlyphUnderPlayer();
      const topGlyph = Number(topGlyphRaw);
      if (!Number.isFinite(topGlyph) || topGlyph < 0) {
        console.log(
          `🧹 Under-player top item glyph cleared at (${tileX}, ${tileY}) [trigger=${trigger}]`,
        );
        this.emit({
          type: "under_player_item_glyph_cleared",
          x: tileX,
          y: tileY,
        });
        return true;
      }

      const normalizedGlyph = Math.trunc(topGlyph);
      let decodedChar = null;
      let decodedColor = null;
      let decodedTileIndex = null;
      let decodedSymidx = null;
      let decodedGlyphFlags = null;

      if (topItemTileIndexUnderPlayer) {
        try {
          const tileIndexRaw = topItemTileIndexUnderPlayer();
          const tileIndex = Number(tileIndexRaw);
          if (Number.isFinite(tileIndex) && tileIndex >= 0) {
            decodedTileIndex = Math.trunc(tileIndex);
          }
        } catch (error) {
          console.log("[WARN] topItemTileIndexUnderPlayer failed:", error);
        }
      }

      if (resolvedMapHelper) {
        try {
          const glyphInfo = resolvedMapHelper(normalizedGlyph, tileX, tileY, 0);
          if (glyphInfo) {
            if (glyphInfo.ch !== undefined) {
              decodedChar =
                typeof glyphInfo.ch === "number"
                  ? String.fromCharCode(glyphInfo.ch)
                  : String(glyphInfo.ch);
            }
            if (
              typeof glyphInfo.color === "number" &&
              Number.isFinite(glyphInfo.color)
            ) {
              decodedColor = Math.trunc(glyphInfo.color);
            }
            if (decodedTileIndex === null) {
              const resolvedTileIndex =
                this.extractGlyphInfoTileIndex(glyphInfo);
              if (resolvedTileIndex !== null) {
                decodedTileIndex = resolvedTileIndex;
              }
            }
            decodedSymidx = this.extractGlyphInfoSymidx(glyphInfo);
            decodedGlyphFlags = this.extractGlyphInfoGlyphFlags(glyphInfo);
          }
        } catch (error) {
          console.log("[WARN] Error decoding under-player item glyph:", error);
        }
      }

      console.log(
        `🎒 Under-player top item glyph at (${tileX}, ${tileY}) => ${normalizedGlyph} (tileIndex=${decodedTileIndex ?? "n/a"}) [trigger=${trigger}]`,
      );
      this.emit({
        type: "under_player_item_glyph",
        x: tileX,
        y: tileY,
        glyph: normalizedGlyph,
        char: decodedChar,
        color: decodedColor,
        tileIndex: decodedTileIndex,
        symidx: decodedSymidx,
        glyphFlags: decodedGlyphFlags,
        kind: "obj",
      });
      return true;
    } catch (error) {
      console.log("[WARN] topItemGlyphUnderPlayer failed:", error);
      return false;
    }
  }

  maybeRefreshPendingPostActionPlayerTile(trigger = "unknown") {
    const pendingReason =
      typeof this.pendingPostActionPlayerTileRefreshReason === "string" &&
      this.pendingPostActionPlayerTileRefreshReason.trim().length > 0
        ? this.pendingPostActionPlayerTileRefreshReason.trim()
        : "";
    if (!pendingReason) {
      return false;
    }
    const pendingTarget =
      this.pendingPostActionPlayerTileRefreshTarget &&
      Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.x) &&
      Number.isFinite(this.pendingPostActionPlayerTileRefreshTarget.y)
        ? {
            x: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.x)),
            y: Math.trunc(Number(this.pendingPostActionPlayerTileRefreshTarget.y)),
          }
        : null;

    const tileX = Number(this.playerPosition?.x);
    const tileY = Number(this.playerPosition?.y);
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
      return false;
    }

    const normalizedTileX = Math.trunc(Number(tileX));
    const normalizedTileY = Math.trunc(Number(tileY));
    if (
      pendingTarget &&
      (normalizedTileX !== pendingTarget.x || normalizedTileY !== pendingTarget.y)
    ) {
      console.log(
        `Waiting to refresh pending action (${pendingReason}) until player reaches (${pendingTarget.x}, ${pendingTarget.y}) [trigger=${trigger}, current=(${normalizedTileX}, ${normalizedTileY})]`,
      );
      return false;
    }

    if (
      pendingReason === "move-onto-lootlike-tile" &&
      this.pendingPostActionPlayerTileRefreshSnapshot
    ) {
      const pendingTargetTileData =
        pendingTarget ? this.gameMap.get(`${pendingTarget.x},${pendingTarget.y}`) ?? null : null;
      const pendingTargetStillMatchesSnapshot =
        pendingTarget &&
        this.doesRuntimeMapTileMatchUnderPlayerSnapshot(
          pendingTargetTileData,
          this.pendingPostActionPlayerTileRefreshSnapshot,
        );
      if (pendingTargetStillMatchesSnapshot) {
        return this.emitUnderPlayerItemGlyphFromPendingSnapshot(
          `post-action:${pendingReason}:${trigger}`,
        );
      }
      if (this.maybeEmitConfirmedBoulderPushEventFromRuntimeMap(trigger)) {
        return true;
      }
    }

    if (!this.canQueryWasmHelpers()) {
      console.log(
        `Deferring post-action top-item check (${pendingReason}) until helpers are queryable [trigger=${trigger}]`,
      );
      return false;
    }

    console.log(
      `Checking under-player top item after pending action (${pendingReason}) [trigger=${trigger}] at (${normalizedTileX}, ${normalizedTileY})`,
    );
    return this.emitUnderPlayerItemGlyphIfAvailableAt(
      normalizedTileX,
      normalizedTileY,
      null,
      null,
      true,
      `post-action:${pendingReason}:${trigger}`,
    );
  }

  isLikelyNameInputForDebug(input) {
    const trimmed = String(input || "").trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      return false;
    }
    if (trimmed.startsWith("__") || trimmed.includes(":")) {
      return false;
    }
    return /^[A-Za-z][A-Za-z0-9 _'-]*$/.test(trimmed);
  }

  isExtendedCommandSubmitToken(input) {
    return input === "Enter" || input === "\r" || input === "\n";
  }

  extractExtendedCommandSubmission(inputs) {
    if (!Array.isArray(inputs) || inputs.length < 2) {
      return null;
    }

    const first = inputs[0];
    const last = inputs[inputs.length - 1];
    if (first !== "#" || !this.isExtendedCommandSubmitToken(last)) {
      return null;
    }

    let commandText = "";
    for (let i = 1; i < inputs.length - 1; i += 1) {
      const token = inputs[i];
      if (token === "Backspace") {
        commandText = commandText.slice(0, -1);
        continue;
      }
      if (token === "#") {
        continue;
      }
      if (typeof token === "string" && token.length === 1) {
        if (/^[A-Za-z0-9_?-]$/.test(token)) {
          commandText += token.toLowerCase();
          continue;
        }
      }
      return null;
    }

    return commandText;
  }

  queueExtendedCommandSubmission(commandText, source = "synthetic") {
    if (!this.canQueueExtendedCommandSubmission()) {
      console.log(
        `Skipping extended command submission while prompt input is active (command="${commandText}")`,
      );
      this.clearQueuedExtendedCommandSubmission(
        "prompt input active during queue request",
      );
      return false;
    }
    const normalizedCommand =
      typeof commandText === "string" ? commandText : "";
    if (this.resolvePendingExtendedCommandRequestFromText(normalizedCommand)) {
      return true;
    }
    this.pendingExtendedCommand = normalizedCommand;
    // Do not gate trigger injection on previous attempts. If a prior "#"
    // trigger was consumed without reaching shim_get_ext_cmd, we still need to
    // enqueue a fresh trigger to avoid command deadlock.
    this.extendedCommandTriggerQueued = true;
    // Route "#" through the normal input path so whichever callback is active
    // can kick NetHack into extended-command resolution.
    this.enqueueInputKeys(["#"], source);
    return true;
  }

  canQueueExtendedCommandSubmission() {
    return (
      !this.awaitingQuestionInput &&
      !this.pendingTextRequest &&
      !this.pendingMenuSelection &&
      !this.isInMultiPickup
    );
  }

  clearQueuedExtendedCommandSubmission(reason = "reset") {
    const hadQueuedTrigger = this.extendedCommandTriggerQueued;
    const hadPendingCommand =
      this.pendingExtendedCommand !== null &&
      this.pendingExtendedCommand !== undefined;
    if (!hadQueuedTrigger && !hadPendingCommand) {
      return;
    }
    console.log(`Clearing queued extended command submission (${reason})`, {
      hadQueuedTrigger,
      pendingCommand:
        typeof this.pendingExtendedCommand === "string"
          ? this.pendingExtendedCommand
          : null,
    });
    this.pendingExtendedCommand = null;
    this.extendedCommandTriggerQueued = false;
  }

  dequeuePendingExtendedCommandSubmission() {
    const pending = this.pendingExtendedCommand;
    this.pendingExtendedCommand = null;
    this.extendedCommandTriggerQueued = false;
    if (pending === null || pending === undefined) {
      return undefined;
    }
    return pending;
  }

  buildExtendedCommandPromptMenuItems() {
    const entries = this.getExtendedCommandEntries();
    const menuItems = [];
    let menuIndex = 0;
    for (const entry of entries) {
      const commandName = String(entry?.name || "")
        .trim()
        .toLowerCase();
      if (!commandName || commandName === "#" || commandName === "?") {
        continue;
      }
      menuItems.push({
        menuIndex,
        commandIndex: entry.index,
        accelerator: "",
        text: commandName,
        isCategory: false,
      });
      menuIndex += 1;
    }
    return menuItems;
  }

  requestExtendedCommandSelectionFromUi() {
    if (
      this.pendingExtendedCommandRequest &&
      this.pendingExtendedCommandRequest.promise
    ) {
      return this.pendingExtendedCommandRequest.promise;
    }

    const menuItems = this.buildExtendedCommandPromptMenuItems();
    if (!menuItems.length || !this.eventHandler) {
      return Promise.resolve(-1);
    }

    const menuIndexToCommandIndex = new Map();
    for (const item of menuItems) {
      if (
        Number.isInteger(item.menuIndex) &&
        Number.isInteger(item.commandIndex)
      ) {
        menuIndexToCommandIndex.set(item.menuIndex, item.commandIndex);
      }
    }

    let resolveSelection = null;
    const requestPromise = new Promise((resolve) => {
      resolveSelection = resolve;
    });
    this.pendingExtendedCommandRequest = {
      resolve: resolveSelection,
      promise: requestPromise,
      commandBuffer: "",
      menuIndexToCommandIndex,
    };

    this.emit({
      type: "question",
      text: "What extended command?",
      choices: "",
      default: "",
      menuItems,
      source: "shim_get_ext_cmd",
    });

    return requestPromise;
  }

  resolvePendingExtendedCommandRequest(commandIndex) {
    const pending = this.pendingExtendedCommandRequest;
    this.pendingExtendedCommandRequest = null;
    if (!pending || typeof pending.resolve !== "function") {
      return;
    }
    this.armFarLookForExtendedCommandIndex(commandIndex);
    pending.resolve(Number.isInteger(commandIndex) ? commandIndex : -1);
  }

  resolvePendingExtendedCommandRequestFromText(commandText) {
    if (!this.pendingExtendedCommandRequest) {
      return false;
    }

    const normalized = String(commandText || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      this.resolvePendingExtendedCommandRequest(-1);
      this.clearPendingInventoryContextSelection(
        "extended command submission cancelled",
      );
      return true;
    }

    const extCommandIndex = this.resolveExtendedCommandIndex(normalized);
    if (extCommandIndex < 0) {
      console.log(
        `Unknown extended command "${normalized}" while awaiting shim_get_ext_cmd; canceling`,
      );
      this.resolvePendingExtendedCommandRequest(-1);
      this.clearPendingInventoryContextSelection(
        "unknown extended command submission",
      );
      return true;
    }

    this.resolvePendingExtendedCommandRequest(extCommandIndex);
    return true;
  }

  tryConsumePendingExtendedCommandInput(input) {
    const pending = this.pendingExtendedCommandRequest;
    if (!pending) {
      return false;
    }

    if (this.isMenuSelectionInput(input)) {
      const menuIndex = this.decodeMenuSelectionIndex(input);
      const extCommandIndex = Number.isInteger(menuIndex)
        ? pending.menuIndexToCommandIndex.get(menuIndex)
        : undefined;
      if (Number.isInteger(extCommandIndex)) {
        this.resolvePendingExtendedCommandRequest(extCommandIndex);
      } else {
        this.resolvePendingExtendedCommandRequest(-1);
        this.clearPendingInventoryContextSelection(
          "extended command menu selection cancelled",
        );
      }
      return true;
    }

    const normalizedInput = this.normalizeInputKey(input);
    if (normalizedInput === "Escape") {
      this.resolvePendingExtendedCommandRequest(-1);
      this.clearPendingInventoryContextSelection(
        "extended command prompt cancelled",
      );
      return true;
    }
    if (this.isExtendedCommandSubmitToken(normalizedInput)) {
      this.resolvePendingExtendedCommandRequestFromText(pending.commandBuffer);
      return true;
    }
    if (normalizedInput === "Backspace") {
      pending.commandBuffer = pending.commandBuffer.slice(0, -1);
      return true;
    }
    if (
      typeof normalizedInput === "string" &&
      normalizedInput.length === 1 &&
      /^[A-Za-z0-9_?-]$/.test(normalizedInput)
    ) {
      pending.commandBuffer += normalizedInput.toLowerCase();
      return true;
    }

    // Unrelated keys should cancel stale ext-command waits so gameplay input
    // can flow back through normal nh_poskey handling.
    this.resolvePendingExtendedCommandRequest(-1);
    this.clearPendingInventoryContextSelection(
      "extended command input changed",
    );
    return false;
  }

  isLiteralTextInput(input) {
    if (typeof input !== "string" || input.length <= 1) {
      return false;
    }
    if (this.isMetaInput(input)) {
      return false;
    }
    if (this.isCtrlInput(input)) {
      return false;
    }

    const nonTextInputs = new Set([
      "Enter",
      "Escape",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Numpad1",
      "Numpad2",
      "Numpad3",
      "Numpad4",
      "Numpad5",
      "Numpad6",
      "Numpad7",
      "Numpad8",
      "Numpad9",
      "NumpadDecimal",
      "Backspace",
      "Space",
      "Spacebar",
      "Tab",
      "Insert",
      "Delete",
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12",
    ]);

    return !nonTextInputs.has(input);
  }

  isTextInputCommand(input) {
    return typeof input === "string" && input.startsWith(this.textInputPrefix);
  }

  isInventoryContextSelectionInput(input) {
    return (
      typeof input === "string" &&
      input.startsWith(this.inventoryContextSelectionPrefix) &&
      input.length > this.inventoryContextSelectionPrefix.length
    );
  }

  isInventoryContextSelectionWithCountInput(input) {
    return (
      typeof input === "string" &&
      input.startsWith(this.inventoryContextSelectionCountPrefix) &&
      input.length > this.inventoryContextSelectionCountPrefix.length
    );
  }

  isAnyInventoryContextSelectionInput(input) {
    return (
      this.isInventoryContextSelectionInput(input) ||
      this.isInventoryContextSelectionWithCountInput(input)
    );
  }

  armInventoryContextSelectionFromInput(input) {
    if (this.isInventoryContextSelectionWithCountInput(input)) {
      const raw = input
        .slice(this.inventoryContextSelectionCountPrefix.length)
        .trim();
      const parts = raw.split(":");
      if (parts.length < 2) {
        return false;
      }
      const accelerator = String(parts.shift() || "").trim();
      const countRaw = String(parts.shift() || "").trim();
      const actionIdRaw = parts.join(":").trim();
      const actionId = /^[a-z0-9_-]+$/i.test(actionIdRaw)
        ? actionIdRaw.toLowerCase()
        : "";
      if (accelerator.length !== 1 || !/^\d+$/.test(countRaw)) {
        return false;
      }
      const count = Number.parseInt(countRaw, 10);
      if (!Number.isFinite(count) || count < 1) {
        return false;
      }
      this.pendingInventoryContextSelection = {
        accelerator,
        count,
        actionId: actionId || null,
        listEverythingFallbackUsed: false,
        armedAtMs: Date.now(),
        commandIssuedAtMs: 0,
      };
      console.log(
        `Armed inventory context selection accelerator with count: "${accelerator}" x${count}${
          actionId ? ` (action=${actionId})` : ""
        }`,
      );
      return true;
    }

    if (this.isInventoryContextSelectionInput(input)) {
      const raw = input
        .slice(this.inventoryContextSelectionPrefix.length)
        .trim();
      const separatorIndex = raw.indexOf(":");
      const accelerator =
        separatorIndex >= 0 ? raw.slice(0, separatorIndex).trim() : raw;
      const actionIdRaw =
        separatorIndex >= 0 ? raw.slice(separatorIndex + 1).trim() : "";
      const actionId = /^[a-z0-9_-]+$/i.test(actionIdRaw)
        ? actionIdRaw.toLowerCase()
        : "";
      if (accelerator.length !== 1) {
        return false;
      }

      this.pendingInventoryContextSelection = {
        accelerator,
        actionId: actionId || null,
        listEverythingFallbackUsed: false,
        armedAtMs: Date.now(),
        commandIssuedAtMs: 0,
      };
      console.log(
        `Armed inventory context selection accelerator: "${accelerator}"${
          actionId ? ` (action=${actionId})` : ""
        }`,
      );
      return true;
    }

    return false;
  }

  hasPendingInventoryContextSelection() {
    const pending = this.pendingInventoryContextSelection;
    if (!pending) {
      return false;
    }
    const accelerator = String(pending.accelerator || "");
    return accelerator.length === 1;
  }

  getPendingInventoryContextActionId() {
    const pending = this.pendingInventoryContextSelection;
    if (!pending) {
      return "";
    }
    const actionId =
      typeof pending.actionId === "string" ? pending.actionId.trim() : "";
    return actionId ? actionId.toLowerCase() : "";
  }

  clearPendingInventoryContextSelection(reason = "") {
    if (!this.pendingInventoryContextSelection) {
      return;
    }
    this.pendingInventoryContextSelection = null;
    if (reason) {
      console.log(`Cleared pending inventory context selection: ${reason}`);
    }
  }

  consumePendingInventoryContextSelection(menuItems, options = {}) {
    const { clearOnMiss = true, preserveActionRoute = false } = options;
    const pending = this.pendingInventoryContextSelection;

    if (!pending || !Array.isArray(menuItems) || menuItems.length === 0) {
      return null;
    }

    const accelerator = String(pending.accelerator || "");
    const pendingCount =
      Number.isFinite(pending.count) && Number(pending.count) > 0
        ? Math.trunc(Number(pending.count))
        : 0;
    if (accelerator.length !== 1) {
      if (clearOnMiss) {
        this.clearPendingInventoryContextSelection("invalid accelerator");
      }
      return null;
    }

    const exact = menuItems.find(
      (item) =>
        item &&
        !item.isCategory &&
        typeof item.accelerator === "string" &&
        item.accelerator === accelerator,
    );
    if (exact) {
      const shouldPreservePendingAction =
        preserveActionRoute &&
        this.runtimeVersion === "5.0" &&
        typeof pending.actionId === "string" &&
        pending.actionId.trim().length > 0;
      if (!shouldPreservePendingAction) {
        this.clearPendingInventoryContextSelection("consumed exact match");
      } else {
        console.log(
          "Preserving pending inventory context selection after exact item match for 5.0 action routing",
        );
      }
      return {
        menuItem: exact,
        selectionCount: pendingCount > 0 ? pendingCount : undefined,
      };
    }

    const caseInsensitive = menuItems.find(
      (item) =>
        item &&
        !item.isCategory &&
        typeof item.accelerator === "string" &&
        item.accelerator.toLowerCase() === accelerator.toLowerCase(),
    );
    if (caseInsensitive) {
      const shouldPreservePendingAction =
        preserveActionRoute &&
        this.runtimeVersion === "5.0" &&
        typeof pending.actionId === "string" &&
        pending.actionId.trim().length > 0;
      if (!shouldPreservePendingAction) {
        this.clearPendingInventoryContextSelection(
          "consumed case-insensitive match",
        );
      } else {
        console.log(
          "Preserving pending inventory context selection after case-insensitive item match for 5.0 action routing",
        );
      }
      return {
        menuItem: caseInsensitive,
        selectionCount: pendingCount > 0 ? pendingCount : undefined,
      };
    }
    if (clearOnMiss) {
      this.clearPendingInventoryContextSelection("no matching menu item");
    }
    return null;
  }

  resolveInventoryListEverythingMenuItem(menuItems) {
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      return null;
    }

    const byAccelerator = menuItems.find((item) => {
      if (!item || item.isCategory) {
        return false;
      }
      const accelerator = String(item.accelerator || "").trim();
      if (accelerator === "*") {
        return true;
      }
      const originalAcceleratorChar = this.getPrintableAcceleratorCharacter(
        item.originalAccelerator,
      );
      if (originalAcceleratorChar === "*") {
        return true;
      }
      return false;
    });
    if (byAccelerator) {
      return byAccelerator;
    }

    return (
      menuItems.find((item) => {
        if (!item || item.isCategory || typeof item.text !== "string") {
          return false;
        }
        const normalizedText = item.text.trim().toLowerCase();
        return (
          normalizedText === "(list everything)" ||
          normalizedText.includes("list everything")
        );
      }) || null
    );
  }

  tryAutoRoutePendingInventoryContextSelectionThroughListEverything(
    menuItems,
    reason = "context action",
    menuQuestion = this.currentMenuQuestionText,
  ) {
    const pending = this.pendingInventoryContextSelection;
    if (!pending) {
      return false;
    }
    if (pending.listEverythingFallbackUsed === true) {
      return false;
    }

    const listEverythingItem =
      this.resolveInventoryListEverythingMenuItem(menuItems);
    if (!listEverythingItem) {
      return false;
    }

    pending.listEverythingFallbackUsed = true;
    console.log(
      `Routing pending inventory context selection through * list everything fallback via ${reason}`,
    );
    if (
      this.tryAutoSelectMenuItem(
        listEverythingItem,
        `${reason} (* list everything fallback)`,
        undefined,
        menuQuestion,
      )
    ) {
      return true;
    }

    this.clearPendingInventoryContextSelection(
      "* list everything fallback unavailable",
    );
    return false;
  }

  handleTextInputResponse(text, source = "user") {
    const normalized = typeof text === "string" ? text : String(text ?? "");
    if (this.pendingTextRequest) {
      const pending = this.pendingTextRequest;
      this.pendingTextRequest = null;
      this.writeTextInputBuffer(
        pending.bufferPtr,
        normalized,
        pending.maxLength,
      );
      if (typeof pending.resolve === "function") {
        pending.resolve(0);
      }
      this.maybeFlushDeferredTileRefreshes();
      return;
    }

    if (normalized.length === 0) {
      return;
    }

    const queueBefore = this.pendingTextResponses.length;
    this.pendingTextResponses.push(normalized);
    console.log(`Queued text response input: "${normalized}"`, {
      source,
      queueBefore,
      queueAfter: this.pendingTextResponses.length,
      isLikelyNameInput: this.isLikelyNameInputForDebug(normalized),
    });
  }

  writeTextInputBuffer(bufferPtr, text, maxLength = 256) {
    if (!this.nethackModule || !bufferPtr) {
      return;
    }
    const normalizedBufferPtr = Math.trunc(Number(bufferPtr));
    if (!Number.isFinite(normalizedBufferPtr) || normalizedBufferPtr <= 0) {
      return;
    }
    const safeText = typeof text === "string" ? text : String(text ?? "");
    const limit = Math.max(1, Math.floor(maxLength));
    const truncated = safeText.slice(0, Math.max(0, limit - 1));

    let bytes = null;
    if (typeof TextEncoder !== "undefined") {
      bytes = new TextEncoder().encode(truncated);
    } else {
      const encoded = unescape(encodeURIComponent(truncated));
      const legacyBytes = new Uint8Array(encoded.length);
      for (let i = 0; i < encoded.length; i += 1) {
        legacyBytes[i] = encoded.charCodeAt(i);
      }
      bytes = legacyBytes;
    }

    const heap = this.nethackModule.HEAPU8;
    if (!heap || normalizedBufferPtr + 1 > heap.length) {
      if (typeof this.nethackModule.setValue !== "function") {
        return;
      }
      try {
        const maxBytes = Math.max(0, limit - 1);
        const writeLength = Math.min(bytes.length, maxBytes);
        for (let i = 0; i < writeLength; i += 1) {
          this.nethackModule.setValue(
            normalizedBufferPtr + i,
            bytes[i],
            "i8",
          );
        }
        this.nethackModule.setValue(normalizedBufferPtr + writeLength, 0, "i8");
      } catch (error) {
        console.log(
          `Text input pointer write fallback failed at ${normalizedBufferPtr}:`,
          error,
        );
      }
      return;
    }
    const maxBytes = Math.max(0, limit - 1);
    const available = Math.max(0, heap.length - normalizedBufferPtr - 1);
    const length = Math.min(bytes.length, maxBytes, available);
    if (length > 0) {
      heap.set(bytes.slice(0, length), normalizedBufferPtr);
    }
    heap[normalizedBufferPtr + length] = 0;
  }

  resolveMenuSelection(selectionCount) {
    this.menuSelectionReadyCount = selectionCount;
    this.isInMultiPickup = false;

    if (
      this.pendingMenuSelection &&
      typeof this.pendingMenuSelection.resolver === "function"
    ) {
      const { resolver, menuListPtrPtr } = this.pendingMenuSelection;
      this.pendingMenuSelection = null;
      this.writeMenuSelectionResult(menuListPtrPtr || 0, selectionCount);
      if (selectionCount <= 0) {
        this.menuSelections.clear();
      }
      resolver(selectionCount);
      this.menuSelectionReadyCount = null;
      this.maybeFlushDeferredTileRefreshes();
      return;
    }

    if (selectionCount <= 0) {
      this.menuSelections.clear();
    }
  }

  consumeInputResult(result, requestKind, requestContext = null) {
    if (!result || result.cancelled) {
      return typeof result?.cancelCode === "number" ? result.cancelCode : 27;
    }

    const token = result.token;
    if (
      requestKind === "position" &&
      this.applyMouseTokenToPoskeyRequest(token, requestContext)
    ) {
      if (this.contextualLookInfoProbeMouseDeadlineMs > 0) {
        const nowMs = Date.now();
        if (nowMs <= this.contextualLookInfoProbeMouseDeadlineMs) {
          if (this.runtimeVersion === "slashem") {
            console.log(
              'Queueing contextual tile info follow-up input ["Escape"] for legacy /what is map probe',
            );
            this.enqueueInputKeys(["Escape"], "synthetic", ["position"]);
            this.contextualLookInfoAutoFlowStage = "await_more_info";
            this.contextualLookInfoAutoFlowUntilMs = nowMs + 30000;
          } else {
            console.log(
              'Queueing contextual tile info follow-up inputs [":", "Escape"] for /what is map probe',
            );
            this.enqueueInputKeys([":", "Escape"], "synthetic", ["position"]);
            this.contextualLookInfoAutoFlowStage = "await_exit";
            this.contextualLookInfoAutoFlowUntilMs = nowMs + 30000;
          }
        } else {
          this.clearContextualLookInfoAutoFlow("mouse target expired");
        }
        this.contextualLookInfoProbeMouseDeadlineMs = 0;
        this.pendingContextualLookMapRouteSelection = false;
      }
      if (this.contextualGlanceProbeMouseDeadlineMs > 0) {
        const nowMs = Date.now();
        if (nowMs <= this.contextualGlanceProbeMouseDeadlineMs) {
          this.contextualGlanceAutoCancelPositionUntilMs =
            nowMs + this.contextualGlanceAutoCancelPositionWindowMs;
        }
        this.contextualGlanceProbeMouseDeadlineMs = 0;
      }
      // "/" -> "/" look mode can stay active after a click while NetHack asks
      // for additional description details. Keep UI position mode aligned.
      if (
        this.farLookMode === "active" &&
        !this.shouldPreserveFarLookAfterMouseSelection()
      ) {
        this.farLookMode = "none";
        this.farLookOrigin = null;
        this.setPositionInputActive(false);
      }
      return 0;
    }

    const rawKey = token && typeof token.key === "string" ? token.key : "";
    let key =
      requestKind === "position"
        ? this.normalizeFarLookPositionInput(rawKey)
        : rawKey;
    if (!key) {
      return 0;
    }

    if (
      token &&
      token.source === "synthetic" &&
      requestKind === "position" &&
      key === "Escape" &&
      this.isContextualLookInfoAutoFlowActive()
    ) {
      this.clearContextualLookInfoAutoFlow("synthetic escape consumed");
    }

    if (requestKind === "event" && key === "Escape") {
      const replacement = this.resolveEscapeForActiveYnPrompt();
      if (replacement) {
        console.log(
          `Mapping Escape to "${replacement}" for active yn_function prompt`,
          {
            choices: this.activeYnPrompt?.choices || "",
            defaultChoice: this.activeYnPrompt?.defaultChoice ?? 0,
          },
        );
        key = replacement;
      }
    }

    if (this.farLookMode === "none" && this.isPositionModeInitiatorInput(key)) {
      // ";" can be consumed through either event or position requests.
      const armedFromNameOrCallFloorTarget =
        this.pendingLookMenuFarLookArm &&
        (this.isNameRootQuestion(this.currentMenuQuestionText) ||
          this.isCallRootQuestion(this.currentMenuQuestionText));
      this.farLookMode = "armed";
      this.farLookOrigin = this.pendingLookMenuFarLookArm
        ? armedFromNameOrCallFloorTarget
          ? "floor_target_menu"
          : "look_menu"
        : "direct";
      this.pendingLookMenuFarLookArm = false;
    } else if (
      requestKind === "event" &&
      this.farLookMode === "armed" &&
      this.farLookOrigin !== "legacy_cursor_prompt"
    ) {
      this.farLookMode = "none";
      this.farLookOrigin = null;
      this.pendingLookMenuFarLookArm = false;
    } else if (this.pendingLookMenuFarLookArm) {
      this.pendingLookMenuFarLookArm = false;
    }

    if (requestKind === "position" && this.farLookMode === "active") {
      const shouldExitFarLook =
        this.isFarLookExitInput(key) ||
        !this.isFarLookContinuationInput(key);
      if (shouldExitFarLook) {
        this.farLookMode = "none";
        this.farLookOrigin = null;
        this.setPositionInputActive(false);
      }
    }

    if (this.awaitingQuestionInput) {
      this.updateNumberPadModeFromInput(key);
    }

    return this.processKey(key);
  }

  requestInputCode(requestKind, requestContext = null) {
    if (this.activeInputRequest && this.activeInputRequest.promise) {
      if (this.activeInputRequest.kind === requestKind) {
        return this.activeInputRequest.promise;
      }

      console.log(
        `Deferring ${requestKind} input request until pending ${this.activeInputRequest.kind} request completes`,
      );
      return this.activeInputRequest.promise.then(() =>
        this.requestInputCode(requestKind, requestContext),
      );
    }

    const requested = this.inputBroker.requestNext(requestKind);
    if (requested && typeof requested.then === "function") {
      let pendingPromise = null;
      pendingPromise = requested
        .then((result) =>
          this.consumeInputResult(result, requestKind, requestContext),
        )
        .finally(() => {
          if (
            this.activeInputRequest &&
            this.activeInputRequest.promise === pendingPromise
          ) {
            this.activeInputRequest = null;
          }
          this.flushDeferredTileRefreshesNow();
          this.maybeFlushDeferredTileRefreshes();
        });
      this.activeInputRequest = {
        kind: requestKind,
        promise: pendingPromise,
      };
      return pendingPromise;
    }
    return this.consumeInputResult(requested, requestKind, requestContext);
  }

  canQueryWasmHelpers() {
    return (
      !this.activeInputRequest &&
      !this.pendingTextRequest &&
      !this.pendingMenuSelection
    );
  }

  deferTileRefreshRequest(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    this.deferredTileRefreshKeys.add(`${x},${y}`);
  }

  deferAreaRefreshRequest(centerX, centerY, radius) {
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) {
      return;
    }
    const normalizedRadius =
      Number.isFinite(radius) && Number(radius) >= 0
        ? Math.trunc(Number(radius))
        : 0;
    const key = `${centerX},${centerY},${normalizedRadius}`;
    this.deferredAreaRefreshRequests.set(key, {
      centerX,
      centerY,
      radius: normalizedRadius,
    });
  }

  maybeFlushDeferredTileRefreshes() {
    if (this.deferredTileRefreshFlushScheduled) {
      return;
    }
    if (!this.canQueryWasmHelpers()) {
      return;
    }
    if (
      this.deferredTileRefreshKeys.size === 0 &&
      this.deferredAreaRefreshRequests.size === 0
    ) {
      return;
    }

    this.deferredTileRefreshFlushScheduled = true;
    const schedule =
      typeof setTimeout === "function"
        ? setTimeout
        : (callback) => callback();

    schedule(() => {
      this.deferredTileRefreshFlushScheduled = false;
      this.flushDeferredTileRefreshesNow();
    }, 0);
  }

  flushDeferredTileRefreshesNow() {
    if (!this.canQueryWasmHelpers()) {
      return;
    }
    if (
      this.deferredTileRefreshKeys.size === 0 &&
      this.deferredAreaRefreshRequests.size === 0
    ) {
      return;
    }

    const pendingAreas = Array.from(this.deferredAreaRefreshRequests.values());
    const pendingTiles = Array.from(this.deferredTileRefreshKeys);
    this.deferredAreaRefreshRequests.clear();
    this.deferredTileRefreshKeys.clear();

    for (const area of pendingAreas) {
      this.handleAreaUpdateRequest(area.centerX, area.centerY, area.radius);
    }

    for (const key of pendingTiles) {
      const [xRaw, yRaw] = key.split(",");
      const x = Number(xRaw);
      const y = Number(yRaw);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      this.handleTileUpdateRequest(x, y);
    }
  }

  extractGlyphInfoTileIndex(glyphInfo) {
    if (!glyphInfo || typeof glyphInfo !== "object") {
      return null;
    }
    const tileIndexCandidate =
      typeof glyphInfo.tileidx === "number"
        ? glyphInfo.tileidx
        : glyphInfo.tileIdx;
    if (
      typeof tileIndexCandidate === "number" &&
      Number.isFinite(tileIndexCandidate) &&
      tileIndexCandidate >= 0
    ) {
      return Math.trunc(tileIndexCandidate);
    }
    return null;
  }

  extractGlyphInfoSymidx(glyphInfo) {
    if (!glyphInfo || typeof glyphInfo !== "object") {
      return null;
    }
    const symidxCandidate =
      typeof glyphInfo.symidx === "number"
        ? glyphInfo.symidx
        : glyphInfo.symIdx;
    if (
      typeof symidxCandidate === "number" &&
      Number.isFinite(symidxCandidate) &&
      symidxCandidate >= 0
    ) {
      return Math.trunc(symidxCandidate);
    }
    return null;
  }

  extractGlyphInfoGlyphFlags(glyphInfo) {
    if (!glyphInfo || typeof glyphInfo !== "object") {
      return null;
    }
    const glyphFlagsCandidate =
      typeof glyphInfo.glyphflags === "number"
        ? glyphInfo.glyphflags
        : glyphInfo.glyphFlags;
    if (
      typeof glyphFlagsCandidate === "number" &&
      Number.isFinite(glyphFlagsCandidate)
    ) {
      return Math.trunc(glyphFlagsCandidate);
    }
    return null;
  }

  getGlyphConstants() {
    return globalThis.nethackGlobal &&
      globalThis.nethackGlobal.constants &&
      globalThis.nethackGlobal.constants.GLYPH &&
      typeof globalThis.nethackGlobal.constants.GLYPH === "object"
      ? globalThis.nethackGlobal.constants.GLYPH
      : null;
  }

  getGlyphConstantValue(...keys) {
    const glyphConstants = this.getGlyphConstants();
    if (!glyphConstants || !Array.isArray(keys) || keys.length === 0) {
      return null;
    }
    for (const key of keys) {
      if (!key || !Object.prototype.hasOwnProperty.call(glyphConstants, key)) {
        continue;
      }
      const value = this.normalizeNonNegativeInteger(glyphConstants[key]);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }

  isUndiscoveredOrNothingGlyph(glyph, glyphFlags = null) {
    if (typeof glyph !== "number" || !Number.isFinite(glyph) || glyph < 0) {
      return false;
    }

    const normalizedGlyph = Math.trunc(glyph);
    const unexploredGlyph = this.getGlyphConstantValue(
      "GLYPH_UNEXPLORED",
      "GLYPH_UNEXPLORED_OFF",
    );
    if (unexploredGlyph !== null && normalizedGlyph === unexploredGlyph) {
      return true;
    }

    const nothingGlyph = this.getGlyphConstantValue(
      "GLYPH_NOTHING",
      "GLYPH_NOTHING_OFF",
    );
    if (nothingGlyph !== null && normalizedGlyph === nothingGlyph) {
      return true;
    }

    const normalizedGlyphFlags = this.normalizeNonNegativeInteger(glyphFlags);
    if (normalizedGlyphFlags !== null) {
      // NetHack 5.0 mapglyph flags: MG_UNEXPLORED=0x0800, MG_NOTHING=0x0400.
      if ((normalizedGlyphFlags & 0x0800) !== 0) {
        return true;
      }
      if ((normalizedGlyphFlags & 0x0400) !== 0) {
        return true;
      }
    }

    return false;
  }

  isRenderableRuntimeMapTile(tileData) {
    if (!tileData || typeof tileData !== "object") {
      return false;
    }
    const glyph =
      typeof tileData.glyph === "number" && Number.isFinite(tileData.glyph)
        ? Math.trunc(tileData.glyph)
        : null;
    if (glyph === null || glyph < 0) {
      return false;
    }
    const glyphFlags =
      typeof tileData.glyphFlags === "number" &&
      Number.isFinite(tileData.glyphFlags)
        ? Math.trunc(tileData.glyphFlags)
        : null;
    return !this.isUndiscoveredOrNothingGlyph(glyph, glyphFlags);
  }

  normalizeRuntimeMonsterId(rawValue) {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return null;
    }
    const normalized = Math.trunc(rawValue);
    return normalized > 0 ? normalized : null;
  }

  normalizeRuntimeTrackedEntityId(rawValue) {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return null;
    }
    const normalized = Math.trunc(rawValue);
    return normalized >= 0 ? normalized : null;
  }

  normalizeRuntimeAttackTargetId(rawValue) {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      return null;
    }
    const normalized = Math.trunc(rawValue);
    return normalized >= 0 ? normalized : null;
  }

  getTrackedMonsterIdFromRuntimeTile(tileData) {
    return this.normalizeRuntimeTrackedEntityId(tileData?.monsterId);
  }

  isMonsterLikeGlyph(glyph) {
    if (typeof glyph !== "number" || !Number.isFinite(glyph) || glyph < 0) {
      return false;
    }

    const normalizedGlyph = Math.trunc(glyph);
    const monGlyphOff = this.getGlyphConstantValue("GLYPH_MON_OFF");
    const bodyGlyphOff = this.getGlyphConstantValue(
      "GLYPH_BODY_OFF",
      "GLYPH_OBJ_OFF",
      "GLYPH_CMAP_OFF",
    );
    if (monGlyphOff === null || bodyGlyphOff === null) {
      return false;
    }

    return (
      normalizedGlyph >= monGlyphOff && normalizedGlyph < bodyGlyphOff
    );
  }

  isMonsterLikeRuntimeMapTile(tileData) {
    if (!tileData || typeof tileData !== "object") {
      return false;
    }
    const glyph =
      typeof tileData.glyph === "number" && Number.isFinite(tileData.glyph)
        ? Math.trunc(tileData.glyph)
        : null;
    if (glyph === null) {
      return false;
    }
    return this.isMonsterLikeGlyph(glyph);
  }

  isLootLikeGlyph(glyph) {
    if (typeof glyph !== "number" || !Number.isFinite(glyph) || glyph < 0) {
      return false;
    }

    const normalizedGlyph = Math.trunc(glyph);
    const objGlyphOff = this.getGlyphConstantValue("GLYPH_OBJ_OFF");
    const cmapGlyphOff = this.getGlyphConstantValue(
      "GLYPH_CMAP_OFF",
      "GLYPH_EXPLODE_OFF",
      "GLYPH_WARNING_OFF",
    );
    if (objGlyphOff === null || cmapGlyphOff === null) {
      return false;
    }

    return normalizedGlyph >= objGlyphOff && normalizedGlyph < cmapGlyphOff;
  }

  isLootLikeRuntimeMapTile(tileData) {
    if (!tileData || typeof tileData !== "object") {
      return false;
    }
    const glyph =
      typeof tileData.glyph === "number" && Number.isFinite(tileData.glyph)
        ? Math.trunc(tileData.glyph)
        : null;
    if (glyph === null) {
      return false;
    }
    return this.isLootLikeGlyph(glyph);
  }

  decodeFloorUnderlayAtPosition(
    x,
    y,
    helpers,
    mapHelper,
    canQueryWasmHelpers = true,
  ) {
    if (!canQueryWasmHelpers) {
      return null;
    }
    if (
      !helpers ||
      typeof helpers.floorGlyphAtHelper !== "function" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return null;
    }

    let floorGlyph = -1;
    try {
      const raw = helpers.floorGlyphAtHelper(Math.trunc(x), Math.trunc(y));
      floorGlyph = Number(raw);
    } catch (error) {
      console.log("[WARN] floorGlyphAtHelper failed:", error);
      return null;
    }

    if (!Number.isFinite(floorGlyph) || floorGlyph < 0) {
      return null;
    }

    const normalizedFloorGlyph = Math.trunc(floorGlyph);
    let floorChar = null;
    let floorColor = null;
    let floorTileIndex = null;
    let floorSymidx = null;

    if (mapHelper) {
      try {
        const glyphInfo = mapHelper(normalizedFloorGlyph, x, y, 0);
        if (glyphInfo) {
          if (glyphInfo.ch !== undefined) {
            floorChar =
              typeof glyphInfo.ch === "number"
                ? String.fromCharCode(glyphInfo.ch)
                : String(glyphInfo.ch);
          }
          if (
            typeof glyphInfo.color === "number" &&
            Number.isFinite(glyphInfo.color)
          ) {
            floorColor = Math.trunc(glyphInfo.color);
          }
          floorTileIndex = this.extractGlyphInfoTileIndex(glyphInfo);
          floorSymidx = this.extractGlyphInfoSymidx(glyphInfo);
        }
      } catch (error) {
        console.log("[WARN] floor underlay mapGlyph decode failed:", error);
      }
    }

    if (
      floorTileIndex === null &&
      typeof helpers.tileIndexForGlyph === "function"
    ) {
      try {
        const fallbackTileIndex = Number(
          helpers.tileIndexForGlyph(normalizedFloorGlyph),
        );
        if (Number.isFinite(fallbackTileIndex) && fallbackTileIndex >= 0) {
          floorTileIndex = Math.trunc(fallbackTileIndex);
        }
      } catch (error) {
        console.log("[WARN] floor underlay tileIndexForGlyph failed:", error);
      }
    }

    return {
      glyph: normalizedFloorGlyph,
      char: floorChar,
      color: floorColor,
      tileIndex: floorTileIndex,
      symidx: floorSymidx,
    };
  }
  // Handle request for tile update from client
  handleTileUpdateRequest(x, y) {
    if (this.isClosed) {
      return;
    }
    console.log(`🔄 Client requested tile update for (${x}, ${y})`);

    const canQueryWasmHelpers = this.canQueryWasmHelpers();
    if (!canQueryWasmHelpers) {
      this.deferTileRefreshRequest(x, y);
    }
    const key = `${x},${y}`;
    const tileData = this.gameMap.get(key);
    const isPlayerTile =
      this.playerPosition &&
      x === this.playerPosition.x &&
      y === this.playerPosition.y;
    const helpers =
      globalThis.nethackGlobal && globalThis.nethackGlobal.helpers
        ? globalThis.nethackGlobal.helpers
        : null;
    const glyphAtHelper =
      canQueryWasmHelpers && helpers && typeof helpers.glyphAtHelper === "function"
        ? helpers.glyphAtHelper
        : null;
    const topItemGlyphUnderPlayer =
      canQueryWasmHelpers &&
      helpers &&
      typeof helpers.topItemGlyphUnderPlayer === "function"
        ? helpers.topItemGlyphUnderPlayer
        : null;
    const topItemTileIndexUnderPlayer =
      canQueryWasmHelpers &&
      helpers &&
      typeof helpers.topItemTileIndexUnderPlayer === "function"
        ? helpers.topItemTileIndexUnderPlayer
        : null;
    const mapHelper = helpers
      ? this.runtimeVersion === "5.0"
        ? typeof helpers.mapGlyphInfoHelper === "function"
          ? canQueryWasmHelpers
            ? helpers.mapGlyphInfoHelper
            : null
          : null
        : typeof helpers.mapglyphHelper === "function"
          ? canQueryWasmHelpers
            ? helpers.mapglyphHelper
            : null
          : null
      : null;

    const updateTileFromGlyph = (glyph) => {
      if (!Number.isFinite(glyph)) {
        return false;
      }
      const normalizedGlyph = Math.trunc(Number(glyph));
      let decodedChar = tileData ? tileData.char : "";
      let decodedColor = tileData ? tileData.color : null;
      let decodedTileIndex = tileData ? tileData.tileIndex : null;
      let decodedSymidx =
        tileData && Number.isFinite(Number(tileData.symidx))
          ? Math.trunc(Number(tileData.symidx))
          : null;
      const trackedMonsterId = this.getTrackedMonsterIdFromRuntimeTile(tileData);
      let decodedGlyphFlags = null;
      let floorUnderlay = null;
      if (this.isUndiscoveredOrNothingGlyph(normalizedGlyph)) {
        const hadRenderableTile = this.isRenderableRuntimeMapTile(tileData);
        this.gameMap.delete(key);
        if (hadRenderableTile && this.eventHandler) {
          this.queueMapGlyphUpdate({
            type: "map_glyph",
            x,
            y,
            glyph: normalizedGlyph,
            char: decodedChar,
            color: decodedColor,
            tileIndex: decodedTileIndex,
            symidx: decodedSymidx,
            floorUnderlayGlyph: null,
            floorUnderlayChar: null,
            floorUnderlayColor: null,
            floorUnderlayTileIndex: null,
            floorUnderlaySymidx: null,
            monsterId: trackedMonsterId,
            attackingTargetId: null,
            window: this.getRuntimeWindowId("WIN_MAP"),
            isRefresh: true,
            isRuntimeUndiscoveredClear: true,
          });
        }
        return true;
      }

      if (mapHelper) {
        try {
          const mgflags = 0;
          const glyphInfo = mapHelper(glyph, x, y, mgflags);
          if (glyphInfo) {
            if (glyphInfo.ch !== undefined) {
              decodedChar =
                typeof glyphInfo.ch === "number"
                  ? String.fromCharCode(glyphInfo.ch)
                  : String(glyphInfo.ch);
            }
            if (
              typeof glyphInfo.color === "number" &&
              Number.isFinite(glyphInfo.color)
            ) {
              decodedColor = glyphInfo.color;
            }
            decodedTileIndex = this.extractGlyphInfoTileIndex(glyphInfo);
            decodedSymidx = this.extractGlyphInfoSymidx(glyphInfo);
            decodedGlyphFlags = this.extractGlyphInfoGlyphFlags(glyphInfo);
          }
        } catch (error) {
          console.log("⚠️ Error decoding glyph for refresh:", error);
        }
      }

      floorUnderlay = this.decodeFloorUnderlayAtPosition(
        x,
        y,
        helpers,
        mapHelper,
        canQueryWasmHelpers,
      );

      const isUndiscoveredOrNothingGlyph = this.isUndiscoveredOrNothingGlyph(
        normalizedGlyph,
        decodedGlyphFlags,
      );
      if (isUndiscoveredOrNothingGlyph) {
        const hadRenderableTile = this.isRenderableRuntimeMapTile(tileData);
        this.gameMap.delete(key);
        if (hadRenderableTile && this.eventHandler) {
          this.queueMapGlyphUpdate({
            type: "map_glyph",
            x,
            y,
            glyph: normalizedGlyph,
            char: decodedChar,
            color: decodedColor,
            tileIndex: decodedTileIndex,
            symidx: decodedSymidx,
            floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
            floorUnderlayChar: floorUnderlay?.char ?? null,
            floorUnderlayColor: floorUnderlay?.color ?? null,
            floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
            floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
            monsterId: trackedMonsterId,
            attackingTargetId: null,
            window: this.getRuntimeWindowId("WIN_MAP"),
            isRefresh: true,
            isRuntimeUndiscoveredClear: true,
          });
        }
        return true;
      }

      this.gameMap.set(key, {
        x,
        y,
        glyph: normalizedGlyph,
        glyphFlags: decodedGlyphFlags,
        char: decodedChar,
        color: decodedColor,
        tileIndex: decodedTileIndex,
        symidx: decodedSymidx,
        floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
        floorUnderlayChar: floorUnderlay?.char ?? null,
        floorUnderlayColor: floorUnderlay?.color ?? null,
        floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
        floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
        monsterId: trackedMonsterId,
        timestamp: Date.now(),
      });

      if (this.eventHandler) {
        this.queueMapGlyphUpdate({
          type: "map_glyph",
          x,
          y,
          glyph: normalizedGlyph,
          char: decodedChar,
          color: decodedColor,
          tileIndex: decodedTileIndex,
          symidx: decodedSymidx,
          floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
          floorUnderlayChar: floorUnderlay?.char ?? null,
          floorUnderlayColor: floorUnderlay?.color ?? null,
          floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
          floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
          monsterId: trackedMonsterId,
          attackingTargetId: null,
          window: this.getRuntimeWindowId("WIN_MAP"),
          isRefresh: true,
        });
      }
      return true;
    };

    const emitUnderPlayerItemGlyphIfAvailable = () => {
      this.emitUnderPlayerItemGlyphIfAvailableAt(
        x,
        y,
        helpers,
        mapHelper,
        canQueryWasmHelpers &&
          Boolean(isPlayerTile && topItemGlyphUnderPlayer && this.eventHandler),
        "tile-update",
      );
    };

    if (glyphAtHelper) {
      try {
        const glyph = glyphAtHelper(x, y);
        if (updateTileFromGlyph(glyph)) {
          emitUnderPlayerItemGlyphIfAvailable();
          return;
        }
      } catch (error) {
        console.log("[WARN] glyphAtHelper refresh failed:", error);
      }
    }

    emitUnderPlayerItemGlyphIfAvailable();

    if (tileData) {
      console.log(`📤 Resending tile data for (${x}, ${y}):`, tileData);

      if (this.eventHandler) {
        this.queueMapGlyphUpdate({
          type: "map_glyph",
          x: tileData.x,
          y: tileData.y,
          glyph: tileData.glyph,
          char: tileData.char,
          color: tileData.color,
          tileIndex: tileData.tileIndex,
          symidx: tileData.symidx,
          floorUnderlayGlyph: tileData.floorUnderlayGlyph ?? null,
          floorUnderlayChar: tileData.floorUnderlayChar ?? null,
          floorUnderlayColor: tileData.floorUnderlayColor ?? null,
          floorUnderlayTileIndex: tileData.floorUnderlayTileIndex ?? null,
          floorUnderlaySymidx: tileData.floorUnderlaySymidx ?? null,
          window: this.getRuntimeWindowId("WIN_MAP"),
          isRefresh: true, // Mark this as a refresh to distinguish from new data
        });
      }
    } else {
      console.log(
        `⚠️ No tile data found for (${x}, ${y}) - tile may not be explored yet`,
      );

      // Optionally, we could send a "blank" tile or request NetHack to redraw the area
      if (this.eventHandler) {
        this.emit({
          type: "tile_not_found",
          x: x,
          y: y,
          message: "Tile data not available - may not be explored yet",
        });
      }
    }
  }

  // Handle request for area update from client
  handleAreaUpdateRequest(centerX, centerY, radius = 3) {
    if (this.isClosed) {
      return;
    }
    console.log(
      `🔄 Client requested area update centered at (${centerX}, ${centerY}) with radius ${radius}`,
    );

    const canQueryWasmHelpers = this.canQueryWasmHelpers();
    if (!canQueryWasmHelpers) {
      this.deferAreaRefreshRequest(centerX, centerY, radius);
    }
    let tilesRefreshed = 0;
    const helpers =
      globalThis.nethackGlobal && globalThis.nethackGlobal.helpers
        ? globalThis.nethackGlobal.helpers
        : null;
    const glyphAtHelper =
      canQueryWasmHelpers && helpers && typeof helpers.glyphAtHelper === "function"
        ? helpers.glyphAtHelper
        : null;
    const mapHelper = helpers
      ? this.runtimeVersion === "5.0"
        ? typeof helpers.mapGlyphInfoHelper === "function"
          ? canQueryWasmHelpers
            ? helpers.mapGlyphInfoHelper
            : null
          : null
        : typeof helpers.mapglyphHelper === "function"
          ? canQueryWasmHelpers
            ? helpers.mapglyphHelper
            : null
          : null
      : null;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const key = `${x},${y}`;
        const tileData = this.gameMap.get(key);

        if (glyphAtHelper) {
          try {
            const glyph = glyphAtHelper(x, y);
            if (Number.isFinite(glyph)) {
              const normalizedGlyph = Math.trunc(Number(glyph));
              let decodedChar = tileData ? tileData.char : "";
              let decodedColor = tileData ? tileData.color : null;
              let decodedTileIndex = tileData ? tileData.tileIndex : null;
              let decodedSymidx =
                tileData && Number.isFinite(Number(tileData.symidx))
                  ? Math.trunc(Number(tileData.symidx))
                  : null;
              const trackedMonsterId =
                this.getTrackedMonsterIdFromRuntimeTile(tileData);
              let decodedGlyphFlags = null;
              let floorUnderlay = null;
              if (this.isUndiscoveredOrNothingGlyph(normalizedGlyph)) {
                const hadRenderableTile =
                  this.isRenderableRuntimeMapTile(tileData);
                this.gameMap.delete(key);
                if (hadRenderableTile && this.eventHandler) {
                  this.queueMapGlyphUpdate({
                    type: "map_glyph",
                    x,
                    y,
                    glyph: normalizedGlyph,
                    char: decodedChar,
                    color: decodedColor,
                    tileIndex: decodedTileIndex,
                    symidx: decodedSymidx,
                    floorUnderlayGlyph: null,
                    floorUnderlayChar: null,
                    floorUnderlayColor: null,
                    floorUnderlayTileIndex: null,
                    floorUnderlaySymidx: null,
                    monsterId: trackedMonsterId,
                    attackingTargetId: null,
                    window: this.getRuntimeWindowId("WIN_MAP"),
                    isRefresh: true,
                    isAreaRefresh: true,
                    isRuntimeUndiscoveredClear: true,
                  });
                }
                tilesRefreshed++;
                continue;
              }

              if (mapHelper) {
                try {
                  const mgflags = 0;
                  const glyphInfo = mapHelper(glyph, x, y, mgflags);
                  if (glyphInfo) {
                    if (glyphInfo.ch !== undefined) {
                      decodedChar =
                        typeof glyphInfo.ch === "number"
                          ? String.fromCharCode(glyphInfo.ch)
                          : String(glyphInfo.ch);
                    }
                    if (
                      typeof glyphInfo.color === "number" &&
                      Number.isFinite(glyphInfo.color)
                    ) {
                      decodedColor = glyphInfo.color;
                    }
                    decodedTileIndex = this.extractGlyphInfoTileIndex(glyphInfo);
                    decodedSymidx = this.extractGlyphInfoSymidx(glyphInfo);
                    decodedGlyphFlags = this.extractGlyphInfoGlyphFlags(glyphInfo);
                  }
                } catch (error) {
                  console.log(
                    "⚠️ Error decoding glyph for area refresh:",
                    error,
                  );
                }
              }

              floorUnderlay = this.decodeFloorUnderlayAtPosition(
                x,
                y,
                helpers,
                mapHelper,
                canQueryWasmHelpers,
              );

              const isUndiscoveredOrNothingGlyph =
                this.isUndiscoveredOrNothingGlyph(
                  normalizedGlyph,
                  decodedGlyphFlags,
                );
              if (isUndiscoveredOrNothingGlyph) {
                const hadRenderableTile =
                  this.isRenderableRuntimeMapTile(tileData);
                this.gameMap.delete(key);
                if (hadRenderableTile && this.eventHandler) {
                  this.queueMapGlyphUpdate({
                    type: "map_glyph",
                    x,
                    y,
                    glyph: normalizedGlyph,
                    char: decodedChar,
                    color: decodedColor,
                    tileIndex: decodedTileIndex,
                    symidx: decodedSymidx,
                    floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
                    floorUnderlayChar: floorUnderlay?.char ?? null,
                    floorUnderlayColor: floorUnderlay?.color ?? null,
                    floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
                    floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
                    monsterId: trackedMonsterId,
                    attackingTargetId: null,
                    window: this.getRuntimeWindowId("WIN_MAP"),
                    isRefresh: true,
                    isAreaRefresh: true,
                    isRuntimeUndiscoveredClear: true,
                  });
                }
                tilesRefreshed++;
                continue;
              }

              this.gameMap.set(key, {
                x,
                y,
                glyph: normalizedGlyph,
                glyphFlags: decodedGlyphFlags,
                char: decodedChar,
                color: decodedColor,
                tileIndex: decodedTileIndex,
                symidx: decodedSymidx,
                floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
                floorUnderlayChar: floorUnderlay?.char ?? null,
                floorUnderlayColor: floorUnderlay?.color ?? null,
                floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
                floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
                monsterId: trackedMonsterId,
                timestamp: Date.now(),
              });

              if (this.eventHandler) {
                this.queueMapGlyphUpdate({
                  type: "map_glyph",
                  x,
                  y,
                  glyph: normalizedGlyph,
                  char: decodedChar,
                  color: decodedColor,
                  tileIndex: decodedTileIndex,
                  symidx: decodedSymidx,
                  floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
                  floorUnderlayChar: floorUnderlay?.char ?? null,
                  floorUnderlayColor: floorUnderlay?.color ?? null,
                  floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
                  floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
                  monsterId: trackedMonsterId,
                  attackingTargetId: null,
                  window: this.getRuntimeWindowId("WIN_MAP"),
                  isRefresh: true,
                  isAreaRefresh: true,
                });
              }
              tilesRefreshed++;
              continue;
            }
          } catch (error) {
            console.log("⚠️ glyphAtHelper area refresh failed:", error);
          }
        }

        if (tileData) {
          if (this.eventHandler) {
            this.queueMapGlyphUpdate({
              type: "map_glyph",
              x: tileData.x,
              y: tileData.y,
              glyph: tileData.glyph,
              char: tileData.char,
              color: tileData.color,
              tileIndex: tileData.tileIndex,
              symidx: tileData.symidx,
              floorUnderlayGlyph: tileData.floorUnderlayGlyph ?? null,
              floorUnderlayChar: tileData.floorUnderlayChar ?? null,
              floorUnderlayColor: tileData.floorUnderlayColor ?? null,
              floorUnderlayTileIndex: tileData.floorUnderlayTileIndex ?? null,
              floorUnderlaySymidx: tileData.floorUnderlaySymidx ?? null,
              monsterId: this.getTrackedMonsterIdFromRuntimeTile(tileData),
              attackingTargetId: null,
              window: this.getRuntimeWindowId("WIN_MAP"),
              isRefresh: true,
              isAreaRefresh: true,
            });
          }
          tilesRefreshed++;
        }
      }
    }

    console.log(
      `📤 Refreshed ${tilesRefreshed} tiles in area around (${centerX}, ${centerY})`,
    );

    // Send completion message
    if (this.eventHandler) {
      this.emit({
        type: "area_refresh_complete",
        centerX: centerX,
        centerY: centerY,
        radius: radius,
        tilesRefreshed: tilesRefreshed,
      });
    }
  }

  // Helper method for key processing
  processKey(key) {
    if (
      key === " " ||
      key === "Space" ||
      key === "Spacebar" ||
      key === "." ||
      key === "Period" ||
      key === "Decimal" ||
      key === "NumpadDecimal"
    ) {
      return ".".charCodeAt(0);
    }

    // Translate directional keys based on number_pad mode.
    if (key === "ArrowLeft")
      return (this.numberPadModeEnabled ? "4" : "h").charCodeAt(0);
    if (key === "ArrowRight")
      return (this.numberPadModeEnabled ? "6" : "l").charCodeAt(0);
    if (key === "ArrowUp")
      return (this.numberPadModeEnabled ? "8" : "k").charCodeAt(0);
    if (key === "ArrowDown")
      return (this.numberPadModeEnabled ? "2" : "j").charCodeAt(0);
    if (key === "Numpad1")
      return (this.numberPadModeEnabled ? "1" : "b").charCodeAt(0);
    if (key === "Numpad2")
      return (this.numberPadModeEnabled ? "2" : "j").charCodeAt(0);
    if (key === "Numpad3")
      return (this.numberPadModeEnabled ? "3" : "n").charCodeAt(0);
    if (key === "Numpad4")
      return (this.numberPadModeEnabled ? "4" : "h").charCodeAt(0);
    if (key === "Numpad5")
      return (this.numberPadModeEnabled ? "5" : ".").charCodeAt(0);
    if (key === "Numpad6")
      return (this.numberPadModeEnabled ? "6" : "l").charCodeAt(0);
    if (key === "Numpad7")
      return (this.numberPadModeEnabled ? "7" : "y").charCodeAt(0);
    if (key === "Numpad8")
      return (this.numberPadModeEnabled ? "8" : "k").charCodeAt(0);
    if (key === "Numpad9")
      return (this.numberPadModeEnabled ? "9" : "u").charCodeAt(0);
    if (key === "Enter") return 13;
    if (key === "Escape") return 27;
    if (key.length > 0) return key.charCodeAt(0);
    return 0; // Default for empty/unknown input
  }

  isMetaInput(key) {
    return (
      typeof key === "string" &&
      key.startsWith(this.metaInputPrefix) &&
      key.length > this.metaInputPrefix.length
    );
  }

  isCtrlInput(key) {
    return (
      typeof key === "string" &&
      key.startsWith(this.ctrlInputPrefix) &&
      key.length > this.ctrlInputPrefix.length
    );
  }

  setPositionInputActive(active) {
    const normalized = Boolean(active);
    if (this.positionInputActive === normalized) {
      return;
    }

    this.positionInputActive = normalized;
    if (!normalized) {
      this.positionCursor = null;
    }

    if (this.eventHandler) {
      this.emit({
        type: "position_input_state",
        active: normalized,
        origin: normalized ? this.farLookOrigin : null,
      });
    }
  }

  emitPositionCursor(windowId, x, y, source = "curs") {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    this.positionCursor = { x, y, window: windowId };
    if (this.eventHandler) {
      this.emit({
        type: "position_cursor",
        x: x,
        y: y,
        window: windowId,
        source: source,
      });
    }
  }

  isPositionModeInitiatorInput(input) {
    return input === ";";
  }

  isFarLookPositionRequest() {
    return this.farLookMode === "armed" || this.farLookMode === "active";
  }

  isTravelDestinationPrompt(text) {
    const normalized =
      typeof text === "string" ? text.trim().toLowerCase() : "";
    return normalized === "where do you want to travel to?";
  }

  armPendingTravelPositionInput(text) {
    if (!this.isTravelDestinationPrompt(text)) {
      return;
    }
    this.pendingTravelPositionInputArm = true;
    console.log("Arming travel position input mode from travel prompt");
    this.activateTravelPositionInputMode("travel prompt");
  }

  activateTravelPositionInputMode(reason = "unknown") {
    if (this.farLookMode === "active" && this.farLookOrigin === "travel") {
      return;
    }
    console.log(`Activating travel position input mode (${reason})`);
    this.farLookMode = "active";
    this.farLookOrigin = "travel";
    this.pendingTravelPositionInputArm = false;
    this.pendingLookMenuFarLookArm = false;
    this.setPositionInputActive(true);
    if (!this.positionCursor) {
      this.emitPositionCursor(
        null,
        this.playerPosition.x,
        this.playerPosition.y,
        "travel_position_start",
      );
    }
  }

  isTravelPositionOrigin() {
    return this.farLookOrigin === "travel";
  }

  isTravelPositionSelectionInput(input) {
    const normalized = this.normalizeInputKey(input);
    return (
      normalized === "Enter" ||
      normalized === "\r" ||
      normalized === "\n" ||
      normalized === "." ||
      normalized === "," ||
      normalized === ";" ||
      normalized === ":"
    );
  }

  isTravelPositionRequestInput(input) {
    const normalized = this.normalizeInputKey(input);
    if (typeof normalized !== "string" || normalized.length === 0) {
      return false;
    }
    if (this.isFarLookExitInput(normalized)) {
      return true;
    }
    if (this.isDirectionalMovementInput(normalized)) {
      return true;
    }
    if (this.isTravelPositionSelectionInput(normalized)) {
      return true;
    }
    return normalized.length === 1 && normalized.charCodeAt(0) >= 32;
  }

  isDirectionalMovementInput(input) {
    if (typeof input !== "string" || input.length === 0) {
      return false;
    }

    if (input.length === 1) {
      const isViDirectionKey = /^[hjklyubn]$/i.test(input);
      if (isViDirectionKey && this.numberPadModeEnabled) {
        return false;
      }

      return (
        input === "h" ||
        input === "j" ||
        input === "k" ||
        input === "l" ||
        input === "y" ||
        input === "u" ||
        input === "b" ||
        input === "n" ||
        input === "H" ||
        input === "J" ||
        input === "K" ||
        input === "L" ||
        input === "Y" ||
        input === "U" ||
        input === "B" ||
        input === "N" ||
        (this.numberPadModeEnabled &&
          (input === "1" ||
            input === "2" ||
            input === "3" ||
            input === "4" ||
            input === "6" ||
            input === "7" ||
            input === "8" ||
            input === "9"))
      );
    }

    return (
      input === "ArrowLeft" ||
      input === "ArrowRight" ||
      input === "ArrowUp" ||
      input === "ArrowDown" ||
      input === "Home" ||
      input === "End" ||
      input === "PageUp" ||
      input === "PageDown" ||
      input === "Numpad1" ||
      input === "Numpad2" ||
      input === "Numpad3" ||
      input === "Numpad4" ||
      input === "Numpad6" ||
      input === "Numpad7" ||
      input === "Numpad8" ||
      input === "Numpad9"
    );
  }

  resolveMovementTargetPositionFromInput(input) {
    const normalized = this.normalizeInputKey(input);
    const originX = Number(this.playerPosition?.x);
    const originY = Number(this.playerPosition?.y);
    if (!Number.isFinite(originX) || !Number.isFinite(originY)) {
      return null;
    }

    let deltaX = 0;
    let deltaY = 0;
    switch (normalized) {
      case "h":
      case "H":
      case "ArrowLeft":
      case "Numpad4":
      case "4":
        deltaX = -1;
        break;
      case "l":
      case "L":
      case "ArrowRight":
      case "Numpad6":
      case "6":
        deltaX = 1;
        break;
      case "k":
      case "K":
      case "ArrowUp":
      case "Numpad8":
      case "8":
        deltaY = -1;
        break;
      case "j":
      case "J":
      case "ArrowDown":
      case "Numpad2":
      case "2":
        deltaY = 1;
        break;
      case "y":
      case "Y":
      case "Home":
      case "Numpad7":
      case "7":
        deltaX = -1;
        deltaY = -1;
        break;
      case "u":
      case "U":
      case "PageUp":
      case "Numpad9":
      case "9":
        deltaX = 1;
        deltaY = -1;
        break;
      case "b":
      case "B":
      case "End":
      case "Numpad1":
      case "1":
        deltaX = -1;
        deltaY = 1;
        break;
      case "n":
      case "N":
      case "PageDown":
      case "Numpad3":
      case "3":
        deltaX = 1;
        deltaY = 1;
        break;
      default:
        return null;
    }

    return {
      x: Math.trunc(originX) + deltaX,
      y: Math.trunc(originY) + deltaY,
    };
  }

  isFarLookExitInput(input) {
    return (
      input === "Escape" ||
      input === "Enter" ||
      input === "\r" ||
      input === "\n"
    );
  }

  isPositionRequestContinuationInput(input) {
    const normalized = this.normalizeInputKey(input);
    if (typeof normalized !== "string" || normalized.length === 0) {
      return false;
    }
    if (
      this.isTravelPositionOrigin() &&
      this.isTravelPositionRequestInput(normalized)
    ) {
      return true;
    }
    if (this.isFarLookContinuationInput(normalized)) {
      return true;
    }
    if (this.isFarLookExitInput(normalized)) {
      return true;
    }
    return false;
  }

  isFarLookContinuationInput(input) {
    const normalized = this.normalizeInputKey(input);
    if (typeof normalized !== "string" || normalized.length === 0) {
      return false;
    }
    if (
      this.isTravelPositionOrigin() &&
      this.isTravelPositionRequestInput(normalized) &&
      !this.isTravelPositionSelectionInput(normalized)
    ) {
      return true;
    }
    if (
      this.isTravelPositionOrigin() &&
      this.isTravelPositionSelectionInput(normalized)
    ) {
      return false;
    }
    if (this.isDirectionalMovementInput(normalized)) {
      return true;
    }
    return (
      normalized === "," ||
      normalized === "." ||
      normalized === "5" ||
      normalized === "Numpad5"
    );
  }

  shouldPreserveFarLookAfterMouseSelection() {
    return (
      this.farLookOrigin === "look_menu" ||
      this.farLookOrigin === "legacy_cursor_prompt"
    );
  }

  normalizeFarLookPositionInput(input) {
    if (this.farLookMode !== "active") {
      return input;
    }

    // NetHack look mode uses ';' for detailed object description.
    // Treat Enter as that confirm key to avoid leaving far-look in a bad state.
    if (
      this.farLookOrigin !== "floor_target_menu" &&
      this.farLookOrigin !== "legacy_cursor_prompt" &&
      (input === "Enter" || input === "\r" || input === "\n")
    ) {
      return ";";
    }

    return input;
  }

  isPrintableAccelerator(code) {
    return this.getPrintableAcceleratorCharacter(code).length === 1;
  }

  isLegacyMenuAcceleratorRuntime() {
    return this.runtimeVersion === "3.6.7" || this.runtimeVersion === "slashem";
  }

  getPrintableAcceleratorCharacter(code) {
    if (typeof code === "string" && this.isLegacyMenuAcceleratorRuntime()) {
      const normalized = code.replace(/[\u0000-\u001f\u007f]/g, "");
      if (normalized.length !== 1) {
        return "";
      }
      const charCode = normalized.charCodeAt(0);
      return charCode > 32 && charCode < 127 ? normalized : "";
    }
    if (typeof code === "number" && Number.isFinite(code)) {
      const normalized = Math.trunc(code);
      if (normalized > 32 && normalized < 127) {
        return String.fromCharCode(normalized);
      }
    }
    return "";
  }

  normalizeNonNegativeInteger(value) {
    const numeric =
      typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : value;
    if (
      typeof numeric !== "number" ||
      !Number.isFinite(numeric) ||
      numeric < 0
    ) {
      return null;
    }
    return Math.trunc(numeric);
  }

  getNoGlyphValue() {
    const glyphConstants = this.getGlyphConstants();
    if (!glyphConstants) {
      return null;
    }
    const explicitNoGlyph = this.normalizeNonNegativeInteger(
      glyphConstants.NO_GLYPH,
    );
    if (explicitNoGlyph !== null) {
      return explicitNoGlyph;
    }
    return this.normalizeNonNegativeInteger(glyphConstants.MAX_GLYPH);
  }

  shouldCaptureWindowTextForDialog(winId) {
    return winId === 4 || winId === 5 || winId === 6;
  }

  normalizePromptContextMessage(text) {
    if (typeof text !== "string") {
      return "";
    }
    return text.replace(/\u0000/g, "").trim();
  }

  normalizePromptContextSource(source) {
    const normalized =
      typeof source === "string" ? source.trim().toLowerCase() : "";
    return normalized || "unknown";
  }

  isCurrentMenuQuestionText(text) {
    const normalized = this.normalizePromptContextMessage(text).toLowerCase();
    if (!normalized) {
      return false;
    }
    const currentMenuQuestion = this.normalizePromptContextMessage(
      this.currentMenuQuestionText,
    ).toLowerCase();
    return Boolean(currentMenuQuestion) && normalized === currentMenuQuestion;
  }

  derivePromptContextSource(text, source = "unknown") {
    const normalizedSource = this.normalizePromptContextSource(source);
    if (this.isCurrentMenuQuestionText(text)) {
      return "menu_question_echo";
    }
    return normalizedSource;
  }

  isMenuRelatedPromptContextSource(source) {
    const normalizedSource = this.normalizePromptContextSource(source);
    return (
      normalizedSource === "menu_question" ||
      normalizedSource === "menu_question_echo" ||
      normalizedSource === "inventory_menu_question"
    );
  }

  rememberPromptContextMessage(text, source = "unknown") {
    const normalized = this.normalizePromptContextMessage(text);
    if (!normalized) {
      return;
    }
    const resolvedSource = this.derivePromptContextSource(normalized, source);
    const entry = {
      text: normalized,
      source: resolvedSource,
      timestamp: Date.now(),
    };
    this.lastPromptContextMessage = normalized;
    this.lastPromptContextEntry = entry;
    this.promptContextHistory.push(entry);
    if (this.promptContextHistory.length > 120) {
      this.promptContextHistory.shift();
    }
  }

  isRawPrintCallbackName(name) {
    return name === "shim_raw_print" || name === "shim_raw_print_bold";
  }

  isPlayerMovementCallbackName(name) {
    if (name !== "shim_cliparound") {
      return false;
    }
    return !this.positionInputActive && !this.isFarLookPositionRequest();
  }

  recordRecentUICallback(name, args) {
    const entry = {
      name: typeof name === "string" ? name : String(name ?? ""),
      text: "",
      isPlayerMovement: false,
    };
    if (this.isRawPrintCallbackName(entry.name) && Array.isArray(args)) {
      entry.text = this.normalizePromptContextMessage(args[0]);
    }
    entry.isPlayerMovement = this.isPlayerMovementCallbackName(entry.name);
    this.recentUICallbackHistory.push(entry);
    if (this.recentUICallbackHistory.length > 80) {
      this.recentUICallbackHistory.shift();
    }
  }

  getRecentRawPrintContextMessage() {
    if (!Array.isArray(this.recentUICallbackHistory)) {
      return "";
    }

    let latestRawPrintIndex = -1;
    for (
      let index = this.recentUICallbackHistory.length - 1;
      index >= 0;
      index -= 1
    ) {
      const entry = this.recentUICallbackHistory[index];
      if (!entry || entry.name === "shim_getlin") {
        continue;
      }
      if (entry.isPlayerMovement) {
        break;
      }
      if (this.isRawPrintCallbackName(entry.name) && entry.text) {
        latestRawPrintIndex = index;
        break;
      }
    }

    if (latestRawPrintIndex < 0) {
      return "";
    }

    const collectedLines = [];
    for (let index = latestRawPrintIndex; index >= 0; index -= 1) {
      const entry = this.recentUICallbackHistory[index];
      if (!entry || entry.isPlayerMovement) {
        break;
      }
      if (!this.isRawPrintCallbackName(entry.name)) {
        break;
      }
      if (entry.text) {
        collectedLines.unshift(entry.text);
      }
    }

    return collectedLines.join("\n");
  }

  getMostRecentToplineMessage() {
    for (
      let index = this.promptContextHistory.length - 1;
      index >= 0;
      index -= 1
    ) {
      const entry = this.promptContextHistory[index];
      if (!entry) {
        continue;
      }
      const text = this.normalizePromptContextMessage(entry.text);
      if (!text) {
        continue;
      }
      if (this.isMenuRelatedPromptContextSource(entry.source)) {
        continue;
      }
      return text;
    }

    const latestRemembered = this.normalizePromptContextMessage(
      this.lastPromptContextMessage,
    );
    if (latestRemembered && !this.isCurrentMenuQuestionText(latestRemembered)) {
      return latestRemembered;
    }

    for (let index = this.gameMessages.length - 1; index >= 0; index -= 1) {
      const entry = this.gameMessages[index];
      if (!entry || !this.isMessageWindow(entry.window)) {
        continue;
      }
      const text = this.normalizePromptContextMessage(entry.text);
      if (text && !this.isCurrentMenuQuestionText(text)) {
        return text;
      }
    }

    return "";
  }

  shouldAppendPreviousMessageToGetlinPrompt(question) {
    return /^call\b/i.test(String(question || "").trim());
  }

  getGetlinPromptContextMessage(question) {
    if (!this.shouldAppendPreviousMessageToGetlinPrompt(question)) {
      return "";
    }

    const context =
      this.getRecentRawPrintContextMessage() ||
      this.getMostRecentToplineMessage();
    if (!context) {
      return "";
    }
    if (this.isCurrentMenuQuestionText(context)) {
      return "";
    }

    const normalizedQuestion = this.normalizePromptContextMessage(
      String(question || ""),
    );
    if (
      normalizedQuestion &&
      context.toLowerCase() === normalizedQuestion.toLowerCase()
    ) {
      return "";
    }

    return context;
  }

  scheduleEvilhackHangDiagnostic(reason) {
    console.warn(
      `[EVILHACK_HANG_DIAG] scheduleEvilhackHangDiagnostic ENTERED reason="${reason}" alreadyScheduled=${Boolean(
        (this as any).__evilhackHangDiagScheduled,
      )} runtimeVersion=${this.runtimeVersion} uiCallbackCount=${this.uiCallbackCount}`,
    );
    if ((this as any).__evilhackHangDiagScheduled) {
      return;
    }
    (this as any).__evilhackHangDiagScheduled = true;
    const startCallbackCount = this.uiCallbackCount;
    const delayMs = 1500;
    console.warn(
      `[EVILHACK_HANG_DIAG] arming ${delayMs}ms timer (reason="${reason}")`,
    );
    setTimeout(() => {
      console.warn(
        `[EVILHACK_HANG_DIAG] timer FIRED (reason="${reason}") — collecting diagnostic...`,
      );
      try {
        const mod: any = this.nethackInstance || {};
        const FS = mod.FS;
        const dumpedFs: any = {};
        let rootEntries: any = null;
        if (FS && typeof FS.readdir === "function") {
          try {
            rootEntries = FS.readdir("/").filter(
              (n: string) => n !== "." && n !== "..",
            );
          } catch (e) {
            rootEntries = `readdir error: ${String((e as any)?.message || e)}`;
          }
          for (const f of [
            "nhdat",
            "nhshare",
            "dungeon",
            "quest.dat",
            "data",
            "rumors",
            "oracles",
            "license",
            "sysconf",
            "serverseed",
            "vaults.dat",
          ]) {
            try {
              const st = FS.stat("/" + f);
              dumpedFs[f] = { present: true, size: st?.size };
            } catch {
              dumpedFs[f] = { present: false };
            }
          }
        }
        const callbacksSince = this.uiCallbackCount - startCallbackCount;
        const recentNames = Array.isArray((this as any).recentUICallbacks)
          ? (this as any).recentUICallbacks
              .slice(-5)
              .map((c: any) => c?.name || "<?>")
          : null;
        console.warn(
          `[EVILHACK_HANG_DIAG] ${reason} — ${delayMs}ms later:`,
          {
            runtimeVersion: this.runtimeVersion,
            calledMain: mod.calledMain,
            exitStatus: mod.exitStatus,
            noExitRuntime: (() => {
              try { return mod.noExitRuntime; } catch { return "<not-exported>"; }
            })(),
            remainingRunDeps:
              typeof mod.getRunDependencies === "function"
                ? mod.getRunDependencies()
                : null,
            uiCallbackCountSinceMark: callbacksSince,
            totalUiCallbacks: this.uiCallbackCount,
            recentCallbacks: recentNames,
            rootEntries,
            dumpedFs,
            isClosed: this.isClosed,
          },
        );
      } catch (e) {
        console.warn("[EVILHACK_HANG_DIAG] diagnostic failed:", e);
      }
    }, delayMs);
  }

  handleShimDisplayFile(args) {
    const [rawName, complain] = Array.isArray(args) ? args : [];
    const fileName =
      typeof rawName === "string"
        ? rawName.trim()
        : String(rawName ?? "").trim();
    const mustExist = Boolean(complain);
    console.log(
      `DISPLAY FILE request: "${fileName || "<empty>"}" (mustExist=${mustExist})`,
    );
    const bundled = getBundledDisplayFile(fileName);
    if (bundled && bundled.lines.length > 0) {
      if (this.eventHandler) {
        this.emit({
          type: "info_menu",
          title: bundled.title,
          lines: bundled.lines,
          source: "display_file",
          file: bundled.canonicalName,
          mustExist,
        });
      }
      return 0;
    }

    if (!mustExist && fileName.toLowerCase() === "news") {
      console.log(
        'DISPLAY FILE optional startup "news" file is not bundled; continuing without it.',
      );
      this.scheduleEvilhackHangDiagnostic("after display_file news");
      return 0;
    }

    const fallbackMessage = fileName
      ? `No bundled help text available for "${fileName}".`
      : "No help file name was provided.";
    console.warn(`DISPLAY FILE unavailable: ${fallbackMessage}`);
    if (mustExist && this.eventHandler) {
      this.emit({
        type: "text",
        text: fallbackMessage,
        window: 5,
        attr: 0,
        source: "display_file",
      });
    }
    return 0;
  }

  shouldLogWindowTextInsteadOfDialog(lines) {
    if (!Array.isArray(lines) || lines.length === 0) {
      return false;
    }
    const normalizedNonEmptyLines = lines
      .map((line) =>
        String(line || "")
          .trim()
          .toLowerCase(),
      )
      .filter((line) => line.length > 0);
    if (normalizedNonEmptyLines.length === 0) {
      return false;
    }
    const firstNonEmptyLine = normalizedNonEmptyLines[0];
    if (firstNonEmptyLine.startsWith("things that are here:")) {
      return true;
    }
    if (!firstNonEmptyLine.startsWith("there is a doorway here.")) {
      return false;
    }
    return normalizedNonEmptyLines.some((line) =>
      line.startsWith("things that are here:"),
    );
  }

  emitWindowTextLinesToLog(lines, winId, source = "display_nhwindow") {
    const normalizedLines = Array.isArray(lines) ? lines : [];
    for (const rawLine of normalizedLines) {
      const text = String(rawLine || "").replace(/\u0000/g, "");
      if (!text.trim()) {
        continue;
      }
      if (this.shouldSuppressRedundantStatusWindowText(winId)) {
        continue;
      }
      if (this.isMessageWindow(winId)) {
        this.rememberPromptContextMessage(text, "message_window");
      }
      this.gameMessages.push({
        text: text,
        window: winId,
        timestamp: Date.now(),
        attr: 0,
      });
      if (this.gameMessages.length > 100) {
        this.gameMessages.shift();
      }
      if (this.eventHandler) {
        this.emit({
          type: "text",
          text: text,
          window: winId,
          attr: 0,
          source: source,
        });
      }
    }
  }

  resetWindowTextBuffer(winId) {
    if (!Number.isInteger(winId)) {
      return;
    }
    this.windowTextBuffers.set(winId, []);
  }

  appendWindowTextBuffer(winId, text) {
    if (!Number.isInteger(winId)) {
      return;
    }
    const normalized = typeof text === "string" ? text : String(text ?? "");
    const existing = this.windowTextBuffers.get(winId);
    if (Array.isArray(existing)) {
      existing.push(normalized);
      return;
    }
    this.windowTextBuffers.set(winId, [normalized]);
  }

  consumeWindowTextBuffer(winId) {
    if (!Number.isInteger(winId)) {
      return [];
    }
    const existing = this.windowTextBuffers.get(winId);
    this.windowTextBuffers.set(winId, []);
    if (!Array.isArray(existing)) {
      return [];
    }
    return existing;
  }

  getWindowTextDialogTitle(winId) {
    if (winId === 4) {
      return "NetHack Message";
    }
    if (winId === 5) {
      return "NetHack Message";
    }
    if (winId === 6) {
      return "NetHack Information";
    }
    return "NetHack Information";
  }

  getRecallableMessageHistoryLines(maxLines = 200) {
    const normalizedMax = Number.isFinite(maxLines)
      ? Math.max(1, Math.trunc(maxLines))
      : 200;
    const lines = [];
    for (const entry of this.gameMessages) {
      if (!entry || typeof entry.text !== "string") {
        continue;
      }
      const text = entry.text.replace(/\u0000/g, "");
      if (!text) {
        continue;
      }
      const win = Number(entry.window);
      // Recall should mirror the top-line message stream (WIN_MESSAGE).
      if (!this.isMessageWindow(win)) {
        continue;
      }
      lines.push(text);
    }
    if (lines.length <= normalizedMax) {
      return lines;
    }
    return lines.slice(lines.length - normalizedMax);
  }

  hasSelectableInventoryWindowEntries(menuItems) {
    const items = Array.isArray(menuItems) ? menuItems : [];
    const nonCategoryItems = items.filter((item) => item && !item.isCategory);
    return nonCategoryItems.some(
      (item) =>
        this.isPrintableAccelerator(item.originalAccelerator) ||
        (typeof item.identifier === "number" && item.identifier !== 0),
    );
  }

  classifyInventoryWindowMenu(menuItems, menuQuestion = "") {
    const items = Array.isArray(menuItems) ? menuItems : [];
    const nonCategoryItems = items.filter((item) => !item.isCategory);
    const hasSelectableEntries =
      this.hasSelectableInventoryWindowEntries(menuItems);
    const normalizedMenuQuestion =
      typeof menuQuestion === "string" ? menuQuestion.trim() : "";

    if (items.length === 0) {
      return { kind: "inventory", lines: [] };
    }

    // Help menu's "List of extended commands." flow sometimes arrives as
    // WIN_INVEN with selectable identifiers. Treat it as informational text.
    const normalizedLines = nonCategoryItems
      .map((item) =>
        String(item.text || "")
          .trim()
          .toLowerCase(),
      )
      .filter((text) => text.length > 0);
    const isExtendedCommandsReport = normalizedLines.some((line) =>
      line.includes("extended commands list"),
    );
    if (isExtendedCommandsReport) {
      const lines = nonCategoryItems
        .map((item) => String(item.text || "").trim())
        .filter((text) => text.length > 0);
      return {
        kind: "info_menu",
        title: "NetHack Message",
        lines,
      };
    }

    if (hasSelectableEntries) {
      return { kind: "inventory", lines: [] };
    }

    const orderedLines = items
      .map((item) => String(item?.text || "").trim())
      .filter((text) => text.length > 0);
    const categoryLines = items
      .filter((item) => item && item.isCategory)
      .map((item) => String(item.text || "").trim())
      .filter((text) => text.length > 0);

    if (normalizedMenuQuestion) {
      return {
        kind: "info_menu",
        title: normalizedMenuQuestion,
        lines: orderedLines,
      };
    }

    // NetHack 5.0 routes reports like Ctrl+O dungeon overview through WIN_INVEN
    // even though none of the rows are actually selectable. Preserve category
    // headers for those informational panels instead of treating them as
    // inventory snapshots.
    if (categoryLines.length > 0) {
      if (
        categoryLines.length === 1 &&
        orderedLines.length > 1 &&
        orderedLines[0] === categoryLines[0]
      ) {
        return {
          kind: "info_menu",
          title: categoryLines[0],
          lines: orderedLines.slice(1),
        };
      }
      return {
        kind: "info_menu",
        title: "NetHack Information",
        lines: orderedLines,
      };
    }

    // WIN_INVEN is also used by NetHack for reports like self-knowledge.
    // If entries are non-selectable metadata rows, treat as informational.
    const lines = nonCategoryItems
      .map((item) => String(item.text || "").trim())
      .filter((text) => text.length > 0);
    return { kind: "info_menu", lines };
  }

  isInventorySnapshotEntry(menuItem) {
    if (!menuItem || typeof menuItem !== "object" || menuItem.isCategory) {
      return false;
    }
    if (menuItem.isSelectable === true) {
      return true;
    }
    if (this.isPrintableAccelerator(menuItem.originalAccelerator)) {
      return true;
    }
    if (
      typeof menuItem.identifier === "number" &&
      Number.isFinite(menuItem.identifier) &&
      menuItem.identifier !== 0
    ) {
      return true;
    }
    if (menuItem.isTileApplicable === true) {
      return true;
    }
    if (
      typeof menuItem.tileIndex === "number" &&
      Number.isFinite(menuItem.tileIndex)
    ) {
      return true;
    }
    return false;
  }

  inferQuestionlessInventoryCategories(menuItems) {
    const items = Array.isArray(menuItems) ? menuItems : [];
    if (items.length === 0 || items.some((item) => item && item.isCategory)) {
      return items;
    }

    let didInferCategory = false;
    const inferredItems = items.map((item, index) => {
      if (!item || typeof item !== "object") {
        return item;
      }
      const rawText =
        typeof item.text === "string" ? item.text.replace(/\u0000/g, "") : "";
      if (!rawText.trim()) {
        return item;
      }
      if (rawText.trimStart() !== rawText) {
        return item;
      }
      if (this.isInventorySnapshotEntry(item)) {
        return item;
      }
      const nextVisibleItem = items
        .slice(index + 1)
        .find(
          (candidate) =>
            candidate &&
            typeof candidate.text === "string" &&
            candidate.text.replace(/\u0000/g, "").trim().length > 0,
        );
      if (!this.isInventorySnapshotEntry(nextVisibleItem)) {
        return item;
      }
      didInferCategory = true;
      return {
        ...item,
        isCategory: true,
        isSelectable: false,
        isTileApplicable: false,
        tileIndex: undefined,
      };
    });

    return didInferCategory ? inferredItems : items;
  }

  normalizeQuestionText(question) {
    if (typeof question !== "string") {
      return "";
    }
    return question.trim().toLowerCase();
  }

  resolvePostActionPlayerTileRefreshQuestionContext(question = "") {
    const explicitQuestion =
      typeof question === "string" ? question.trim() : "";
    if (explicitQuestion) {
      return question;
    }

    if (
      this.awaitingQuestionInput &&
      this.activeYnPrompt &&
      typeof this.lastQuestionText === "string" &&
      this.lastQuestionText.trim().length > 0
    ) {
      return this.lastQuestionText;
    }

    return "";
  }

  clearContextualLookInfoAutoFlow(reason = "") {
    if (reason) {
      console.log(`Clearing contextual tile info auto-flow: ${reason}`);
    }
    this.contextualLookInfoProbeMouseDeadlineMs = 0;
    this.pendingContextualLookMapRouteSelection = false;
    this.contextualLookInfoAutoFlowStage = "none";
    this.contextualLookInfoAutoFlowUntilMs = 0;
  }

  isContextualLookInfoAutoFlowActive() {
    if (this.contextualLookInfoAutoFlowStage === "none") {
      return false;
    }
    if (
      !Number.isFinite(this.contextualLookInfoAutoFlowUntilMs) ||
      Date.now() > this.contextualLookInfoAutoFlowUntilMs
    ) {
      this.clearContextualLookInfoAutoFlow("expired");
      return false;
    }
    return true;
  }

  shouldSuppressLegacyContextualLookInfoRawPrint() {
    return (
      this.runtimeVersion === "slashem" &&
      this.isContextualLookInfoAutoFlowActive()
    );
  }

  normalizeYnDefaultChoice(defaultChoice) {
    if (typeof defaultChoice === "string" && defaultChoice.length > 0) {
      return defaultChoice.trim().charAt(0).toLowerCase();
    }
    if (
      typeof defaultChoice === "number" &&
      Number.isFinite(defaultChoice) &&
      defaultChoice > 0
    ) {
      return String.fromCharCode(Math.trunc(defaultChoice)).toLowerCase();
    }
    return "";
  }

  getQuestionBracketChoiceSpec(question) {
    const bracketMatch = String(question || "").match(/\[([^\]]+)\]/);
    return typeof bracketMatch?.[1] === "string"
      ? bracketMatch[1].trim().toLowerCase()
      : "";
  }

  expandLegacyQuestionChoiceSpec(spec) {
    const normalized = String(spec || "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+or\s+/gi, " ")
      .replace(/[,/|]/g, " ")
      .replace(/\s+/g, "")
      .replace(/[\[\]]/g, "");

    if (!normalized) {
      return [];
    }

    const expanded = [];
    const seen = new Set();
    const addChoice = (value) => {
      if (!value || seen.has(value)) {
        return;
      }
      seen.add(value);
      expanded.push(value);
    };

    const canExpandRange = (start, end) => {
      const isLower = (value) => value >= "a" && value <= "z";
      const isUpper = (value) => value >= "A" && value <= "Z";
      const isDigit = (value) => value >= "0" && value <= "9";
      return (
        (isLower(start) && isLower(end)) ||
        (isUpper(start) && isUpper(end)) ||
        (isDigit(start) && isDigit(end))
      );
    };

    for (let i = 0; i < normalized.length; i += 1) {
      const current = normalized[i];
      const hasRangeEnd =
        i + 2 < normalized.length && normalized[i + 1] === "-";

      if (hasRangeEnd) {
        const end = normalized[i + 2];
        if (canExpandRange(current, end)) {
          const startCode = current.charCodeAt(0);
          const endCode = end.charCodeAt(0);
          const step = startCode <= endCode ? 1 : -1;
          for (
            let code = startCode;
            step > 0 ? code <= endCode : code >= endCode;
            code += step
          ) {
            addChoice(String.fromCharCode(code));
          }
          i += 2;
          continue;
        }
      }

      if (current !== "-") {
        addChoice(current);
      }
    }

    return expanded;
  }

  buildLegacySlashEmInventoryQuestionMenuItems(question, choices) {
    if (this.runtimeVersion !== "slashem") {
      return [];
    }

    const inventoryItems = Array.isArray(this.latestInventoryItems)
      ? this.latestInventoryItems
      : [];
    if (inventoryItems.length === 0) {
      return [];
    }

    const bracketChoiceSpec = this.getQuestionBracketChoiceSpec(question);
    const effectiveChoiceSpec = `${String(choices || "")} ${bracketChoiceSpec}`
      .trim()
      .toLowerCase();
    if (
      !effectiveChoiceSpec ||
      (!effectiveChoiceSpec.includes("?") && !effectiveChoiceSpec.includes("*"))
    ) {
      return [];
    }

    const requestedChoices = this.expandLegacyQuestionChoiceSpec(
      effectiveChoiceSpec,
    ).filter((choice) => choice !== "?" && choice !== "*");
    if (requestedChoices.length === 0) {
      return [];
    }

    const requestedChoiceSet = new Set(requestedChoices);
    const matchedChoices = new Set();
    const filteredItems = [];
    let pendingCategory = null;

    for (const item of inventoryItems) {
      if (!item || typeof item !== "object") {
        continue;
      }
      if (item.isCategory) {
        pendingCategory = item;
        continue;
      }

      const accelerator = String(item.accelerator || "").trim();
      if (!accelerator || !requestedChoiceSet.has(accelerator)) {
        continue;
      }

      if (pendingCategory) {
        filteredItems.push({ ...pendingCategory });
        pendingCategory = null;
      }
      filteredItems.push({ ...item });
      matchedChoices.add(accelerator);
    }

    if (matchedChoices.size !== requestedChoiceSet.size) {
      return [];
    }

    return filteredItems;
  }

  resolveLegacyAutoHelpYnPromptAnswer(question, choices) {
    if (this.runtimeVersion !== "slashem") {
      return null;
    }

    const normalizedQuestion = this.normalizeQuestionText(question);
    const normalizedChoices =
      typeof choices === "string" ? choices.trim().toLowerCase() : "";
    const bracketMatch = String(question || "").match(/\[([^\]]+)\]/);
    const normalizedBracketChoices =
      typeof bracketMatch?.[1] === "string"
        ? bracketMatch[1].trim().toLowerCase()
        : "";
    const effectiveChoices = `${normalizedChoices}${normalizedBracketChoices}`;
    const autoChoice = effectiveChoices.includes(",")
      ? ","
      : effectiveChoices.includes("*")
        ? "*"
        : null;
    if (!autoChoice) {
      return null;
    }

    const signature = `${normalizedQuestion}|${effectiveChoices}`;
    const nowMs = Date.now();
    if (
      this.legacyAutoHelpYnPromptSignature === signature &&
      nowMs <= this.legacyAutoHelpYnPromptUntilMs
    ) {
      return null;
    }

    this.legacyAutoHelpYnPromptSignature = signature;
    this.legacyAutoHelpYnPromptUntilMs = nowMs + 2500;
    console.log(
      `Auto-answering legacy yn_function inventory prompt with "${autoChoice}"`,
      {
      question: normalizedQuestion,
      choices: effectiveChoices,
      },
    );
    return autoChoice;
  }

  resolveContextualLookInfoAutoAnswer(question, choices, defaultChoice) {
    if (!this.isContextualLookInfoAutoFlowActive()) {
      return null;
    }

    const normalizedQuestion = this.normalizeQuestionText(question);
    const normalizedChoices =
      typeof choices === "string" ? choices.trim().toLowerCase() : "";
    const normalizedDefaultChoice =
      this.normalizeYnDefaultChoice(defaultChoice);
    const stage = this.contextualLookInfoAutoFlowStage;

    if (this.runtimeVersion === "slashem") {
      const isCursorPrompt =
        stage === "await_cursor_confirm" &&
        normalizedQuestion.includes("cursor") &&
        normalizedChoices.includes("y") &&
        normalizedChoices.includes("q") &&
        normalizedDefaultChoice === "q";
      if (isCursorPrompt) {
        console.log(
          'Auto-answering contextual tile info cursor prompt with "y"',
        );
        this.contextualLookInfoAutoFlowStage = "await_mouse_target";
        return "y";
      }

      const isMoreInfoPrompt =
        stage === "await_more_info" &&
        normalizedQuestion.includes("more info") &&
        normalizedChoices.includes("y") &&
        normalizedChoices.includes("n") &&
        normalizedDefaultChoice === "n";
      if (isMoreInfoPrompt) {
        console.log('Auto-answering contextual tile info "More info?" with "y"');
        this.contextualLookInfoAutoFlowStage = "await_exit";
        this.contextualLookInfoAutoFlowUntilMs = Date.now() + 30000;
        return "y";
      }
    }

    if (stage !== "none") {
      console.log(
        "Unexpected prompt during contextual tile info auto-flow; using Escape failsafe",
        {
          question: normalizedQuestion,
          choices: normalizedChoices,
          defaultChoice: normalizedDefaultChoice,
          stage,
        },
      );
      this.clearContextualLookInfoAutoFlow("unexpected prompt");
      return "Escape";
    }

    return null;
  }

  isLegacySlashEmCursorPromptQuestion(question, choices, defaultChoice) {
    if (this.runtimeVersion !== "slashem") {
      return false;
    }

    const normalizedQuestion = this.normalizeQuestionText(question);
    if (normalizedQuestion !== "specify unknown object by cursor?") {
      return false;
    }

    const normalizedChoices =
      typeof choices === "string" ? choices.trim().toLowerCase() : "";
    const normalizedDefaultChoice =
      this.normalizeYnDefaultChoice(defaultChoice);
    return normalizedChoices === "ynq" && normalizedDefaultChoice === "q";
  }

  isGameOverPossessionsIdentifyQuestion(question) {
    const normalized = this.normalizeQuestionText(question);
    if (!normalized) {
      return false;
    }
    return (
      normalized.includes("do you want your possessions identified") ||
      normalized.startsWith("do you want to see what you had when you ")
    );
  }

  beginGameOverSequence(source = "unknown") {
    if (this.gameOverSequenceActive) {
      return;
    }
    this.gameOverSequenceActive = true;
    this.gameOverEmptyRawPrintCount = 0;
    this.lastGameOverDeathSummary = "";
    if (this.eventHandler) {
      this.emit({
        type: "game_over_started",
        source,
      });
    }
    console.log(`Game-over sequence armed (${source}).`);
  }

  resetGameOverSequence(reason = "reset") {
    if (!this.gameOverSequenceActive) {
      return;
    }
    this.gameOverSequenceActive = false;
    this.gameOverEmptyRawPrintCount = 0;
    this.lastGameOverDeathSummary = "";
    console.log(`Game-over sequence reset (${reason}).`);
  }

  readGlobalValue(path) {
    const globals =
      globalThis.nethackGlobal && typeof globalThis.nethackGlobal === "object"
        ? globalThis.nethackGlobal.globals
        : null;
    if (!globals || typeof globals !== "object") {
      return null;
    }
    const globalsRoot =
      globals.g && typeof globals.g === "object" ? globals.g : globals;
    const readFrom = (root) => {
      if (!root || typeof root !== "object") {
        return null;
      }
      let current = root;
      for (const key of path) {
        if (!current || typeof current !== "object") {
          return null;
        }
        current = current[key];
      }
      return current;
    };
    const direct = readFrom(globals);
    if (direct !== null && direct !== undefined) {
      return direct;
    }
    if (globalsRoot !== globals) {
      const nested = readFrom(globalsRoot);
      if (nested !== null && nested !== undefined) {
        return nested;
      }
    }
    return null;
  }

  recordLastKnownGold(fieldName, value) {
    if (fieldName !== "BL_GOLD") {
      return;
    }
    const parsed = this.normalizeRuntimeInteger(value);
    if (parsed === null) {
      return;
    }
    this.lastKnownGold = parsed;
  }

  extractGameOverDeathSummary(line) {
    const normalized = this.normalizePromptContextMessage(line);
    if (!normalized) {
      return "";
    }
    const lower = normalized.toLowerCase();
    const patterns = [
      "killed by ",
      "choked on ",
      "poisoned by ",
      "died of ",
      "drowned in ",
      "burned by ",
      "dissolved in ",
      "crushed to death by ",
      "petrified by ",
      "turned to slime by ",
    ];
    for (const pattern of patterns) {
      const index = lower.indexOf(pattern);
      if (index >= 0) {
        const summary = normalized
          .slice(index)
          .replace(/[.!]+$/g, "")
          .trim();
        return summary;
      }
    }
    return "";
  }

  captureGameOverSummaryFromLines(lines, source = "unknown") {
    if (!this.gameOverSequenceActive || !Array.isArray(lines)) {
      return;
    }
    for (const line of lines) {
      const summary = this.extractGameOverDeathSummary(line);
      if (summary) {
        this.lastGameOverDeathSummary = summary;
        console.log(`Captured game-over death summary (${source}): ${summary}`);
        return;
      }
    }
  }

  resolveGameOverDeathText() {
    const summary = this.normalizePromptContextMessage(
      this.lastGameOverDeathSummary,
    );
    if (summary) {
      return summary;
    }
    const rawContext = this.getRecentRawPrintContextMessage();
    if (rawContext) {
      return rawContext;
    }
    const topline = this.getMostRecentToplineMessage();
    if (topline) {
      return topline;
    }
    return "";
  }

  buildTombstoneLines(how, when) {
    const normalizeLine = (value, width) => {
      const raw = String(value ?? "")
        .replace(/\u0000/g, "")
        .trim();
      if (!raw) {
        return "";
      }
      const trimmed = raw.slice(0, width);
      const leftPad = Math.floor((width - trimmed.length) / 2);
      const rightPad = Math.max(0, width - trimmed.length - leftPad);
      return `${" ".repeat(leftPad)}${trimmed}${" ".repeat(rightPad)}`;
    };

    const applyCenteredLine = (line, content) => {
      const start = line.indexOf("|");
      const end = line.lastIndexOf("|");
      if (start < 0 || end <= start + 1) {
        return line;
      }
      const width = end - start - 1;
      if (width <= 0) {
        return line;
      }
      const payload = normalizeLine(content, width);
      if (!payload) {
        return line;
      }
      return `${line.slice(0, start + 1)}${payload}${line.slice(end)}`;
    };

    const wrapStoneLines = (text, maxLines) => {
      const width = 16;
      const normalized = String(text ?? "")
        .replace(/\u0000/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!normalized) {
        return [];
      }
      const words = normalized.split(" ");
      const lines = [];
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= width) {
          current = candidate;
          continue;
        }
        if (current) {
          lines.push(current);
          current = word;
        } else {
          lines.push(word.slice(0, width));
          current = word.slice(width);
        }
        if (lines.length >= maxLines) {
          return lines.slice(0, maxLines);
        }
      }
      if (current) {
        lines.push(current);
      }
      return lines.slice(0, maxLines);
    };

    const withIndefiniteArticle = (value) => {
      const trimmed = String(value ?? "").trim();
      if (!trimmed) {
        return "";
      }
      const firstChar = trimmed[0]?.toLowerCase() ?? "";
      const article =
        firstChar === "a" ||
        firstChar === "e" ||
        firstChar === "i" ||
        firstChar === "o" ||
        firstChar === "u"
          ? "an"
          : "a";
      return `${article} ${trimmed}`;
    };

    const resolvedHow = Number.isFinite(how)
      ? Math.trunc(how)
      : Number.isFinite(this.lastGameOverHow)
        ? Math.trunc(this.lastGameOverHow)
        : 0;
    const resolvedWhen = Number.isFinite(when)
      ? Math.trunc(when)
      : Number.isFinite(this.lastGameOverWhen)
        ? Math.trunc(this.lastGameOverWhen)
        : Math.floor(Date.now() / 1000);

    const playerName =
      this.normalizeCharacterNameValue(
        this.startupOptions?.characterCreation?.name,
      ) ||
      this.lastKnownPlayerName ||
      String(this.readGlobalValue(["plname"]) || "").trim() ||
      "Player";
    const doneMoney = Number(this.readGlobalValue(["done_money"]));
    const fallbackMoney =
      typeof this.lastKnownGold === "number" &&
      Number.isFinite(this.lastKnownGold)
        ? this.lastKnownGold
        : NaN;
    const goldText = Number.isFinite(doneMoney)
      ? `${Math.max(0, Math.trunc(doneMoney))} Au`
      : Number.isFinite(fallbackMoney)
        ? `${Math.max(0, Math.trunc(fallbackMoney))} Au`
        : "";

    const killerName = String(this.readGlobalValue(["killer", "name"]) || "")
      .replace(/\u0000/g, "")
      .trim();
    const killerFormat = Number(this.readGlobalValue(["killer", "format"]));
    const killedByPrefix = [
      "killed by ",
      "choked on ",
      "poisoned by ",
      "died of ",
      "drowned in ",
      "burned by ",
      "dissolved in ",
      "crushed to death by ",
      "petrified by ",
      "turned to slime by ",
      "killed by ",
      "",
      "",
      "",
      "",
      "",
    ];
    const prefix = killedByPrefix[resolvedHow] ?? "";
    const deathTextBase = killerName
      ? killerFormat === 2
        ? killerName
        : killerFormat === 0
          ? `${prefix}${withIndefiniteArticle(killerName)}`
          : `${prefix}${killerName}`
      : "";
    const deathText = deathTextBase || this.resolveGameOverDeathText() || "";

    const year =
      new Date(resolvedWhen * 1000).getFullYear() || new Date().getFullYear();

    const tombstoneText = [
      "               ----------",
      "              /          \\",
      "             /    REST    \\",
      "            /      IN      \\",
      "           /     PEACE      \\",
      "          /                  \\",
      "          |                  |",
      "          |                  |",
      "          |                  |",
      "          |                  |",
      "          |                  |",
      "          |                  |",
      "          |       1001       |",
      "         *|     *  *  *      | *",
      "_________)/\\\\_//(\\/(/\\)/\\//\\/|_)_______",
    ];

    const nameLineIndex = 6;
    const goldLineIndex = 7;
    const deathLineStartIndex = 8;
    const yearLineIndex = 12;

    tombstoneText[nameLineIndex] = applyCenteredLine(
      tombstoneText[nameLineIndex],
      playerName,
    );
    if (goldText) {
      tombstoneText[goldLineIndex] = applyCenteredLine(
        tombstoneText[goldLineIndex],
        goldText,
      );
    }
    const deathLines = wrapStoneLines(deathText, 4);
    for (let i = 0; i < deathLines.length; i += 1) {
      const lineIndex = deathLineStartIndex + i;
      if (lineIndex >= tombstoneText.length) {
        break;
      }
      tombstoneText[lineIndex] = applyCenteredLine(
        tombstoneText[lineIndex],
        deathLines[i],
      );
    }
    tombstoneText[yearLineIndex] = applyCenteredLine(
      tombstoneText[yearLineIndex],
      String(year),
    );

    return tombstoneText;
  }

  emitGameOverComplete(how, when) {
    if (!this.eventHandler) {
      this.resetGameOverSequence("no-handler");
      return;
    }
    const tombstoneLines = this.buildTombstoneLines(how, when);
    const killerName = String(this.readGlobalValue(["killer", "name"]) || "")
      .replace(/\u0000/g, "")
      .trim();
    const deathMessage =
      killerName || this.resolveGameOverDeathText() || "Game over";
    this.cleanupAndFlushCheckpointShardsAfterGameOver(() => {
      this.emit({
        type: "game_over_complete",
        tombstoneLines,
        deathMessage,
      });
      this.resetGameOverSequence("complete");
    });
  }

  isNumberPadModeQuestion(question) {
    const normalized = this.normalizeQuestionText(question);
    if (!normalized) {
      return false;
    }
    return normalized.startsWith("select number_pad mode");
  }

  isDestroyOldGameQuestion(question) {
    const normalized = this.normalizeQuestionText(question);
    if (!normalized) {
      return false;
    }
    return (
      (normalized.includes(
        "there is already a game in progress under your name",
      ) ||
        normalized.includes(
          "there are files from a game in progress under your name",
        )) &&
      normalized.includes("destroy old game")
    );
  }

  shouldAutoConfirmCheckpointCleanup(question) {
    if (this.startupOptions?.characterCreation?.mode === "resume") {
      return false;
    }
    if (!this.buildStartupInitRuntimeOptions().includes("checkpoint")) {
      return false;
    }
    return this.isDestroyOldGameQuestion(question);
  }

  isRecoverInterruptedGameQuestion(question) {
    const normalized = this.normalizeQuestionText(question);
    if (!normalized) {
      return false;
    }
    return (
      (normalized.includes(
        "there is already a game in progress under your name",
      ) ||
        normalized.includes(
          "there are files from a game in progress under your name",
        ) ||
        // NetHack 5.0's SELF_RECOVER prompt is shorter:
        // "Old game in progress. Destroy [y], Recover [r], or Cancel [n]?"
        normalized.includes("old game in progress")) &&
      normalized.includes("recover")
    );
  }

  shouldAutoRecoverCheckpointResume(question) {
    const characterCreation = this.startupOptions?.characterCreation;
    if (
      !characterCreation ||
      characterCreation.mode !== "resume" ||
      characterCreation.resumeCategory !== "autosave"
    ) {
      return false;
    }
    return this.isRecoverInterruptedGameQuestion(question);
  }

  isAutosaveResumeRequested() {
    const characterCreation = this.startupOptions?.characterCreation;
    return (
      characterCreation?.mode === "resume" &&
      characterCreation?.resumeCategory === "autosave"
    );
  }

  buildCheckpointAutosaveResumeUnsupportedReason(
    runtimeVersion = this.runtimeVersion,
  ) {
    if (hasRuntimeCheckpointRecoveryPrimitiveExport(runtimeVersion)) {
      return "Checkpoint autosave resume is disabled for this wasm build. It exports recover_savefile(), but it does not expose a working browser-side resume_checkpoint_save bridge needed before unixunix.c/getlock().";
    }
    return "Checkpoint autosave resume is unavailable for this wasm build.";
  }

  patchSlashEmLockLinkFallback(mod) {
    if (this.runtimeVersion !== "slashem") {
      return;
    }
    if (!mod?.FS) {
      console.warn(
        "[Slash'EM startup FS] Skipping lock fallback install because FS is unavailable.",
      );
      return;
    }
    if (typeof mod.FS.link !== "function") {
      console.warn(
        "[Slash'EM startup FS] Skipping lock fallback install because FS.link is unavailable.",
        {
          availableFsKeys: Object.keys(mod.FS).slice(0, 40),
        },
      );
      return;
    }
    if (mod.FS.__nh3dSlashEmLockLinkFallbackPatched) {
      console.log(
        "[Slash'EM startup FS] Lock fallback already installed on this module instance.",
      );
      return;
    }

    const logPrefix = "[Slash'EM startup FS]";
    const originalLink = mod.FS.link.bind(mod.FS);
    const safeCwd = () => {
      try {
        return typeof mod.FS.cwd === "function" ? mod.FS.cwd() : null;
      } catch (error) {
        return `cwd-error:${String(error ?? "")}`;
      }
    };
    const normalizePath = (rawPath) =>
      String(rawPath ?? "")
        .replace(/\\/g, "/")
        .trim();
    const readBaseName = (rawPath) => {
      const normalizedPath = normalizePath(rawPath);
      if (!normalizedPath) {
        return "";
      }
      const lastSlashIndex = normalizedPath.lastIndexOf("/");
      return lastSlashIndex >= 0
        ? normalizedPath.slice(lastSlashIndex + 1)
        : normalizedPath;
    };
    const summarizeError = (error) => ({
      message:
        error instanceof Error && error.message
          ? error.message
          : String(error ?? ""),
      errno: Number.isFinite(Number(error?.errno)) ? Number(error.errno) : null,
      code:
        typeof error?.code === "string" || typeof error?.code === "number"
          ? error.code
          : null,
    });
    const listDirEntries = (rawPath) => {
      if (!mod?.FS || typeof mod.FS.readdir !== "function") {
        return null;
      }
      try {
        return mod.FS
          .readdir(rawPath)
          .filter((entry) => entry !== "." && entry !== "..")
          .slice(0, 20);
      } catch (error) {
        return [`readdir-error:${String(error ?? "")}`];
      }
    };
    const describePathState = (rawPath) => {
      const normalizedPath = normalizePath(rawPath);
      if (!normalizedPath || typeof mod.FS.analyzePath !== "function") {
        return {
          path: normalizedPath || String(rawPath ?? ""),
          exists: null,
        };
      }
      try {
        const analyzed = mod.FS.analyzePath(normalizedPath);
        const objectMode = analyzed?.object?.mode;
        return {
          path: normalizedPath,
          exists: Boolean(analyzed?.exists),
          objectMode: Number.isFinite(Number(objectMode))
            ? Number(objectMode)
            : null,
          isDir:
            analyzed?.exists &&
            typeof mod.FS.isDir === "function" &&
            Number.isFinite(Number(objectMode))
              ? Boolean(mod.FS.isDir(objectMode))
              : null,
          isFile:
            analyzed?.exists &&
            typeof mod.FS.isFile === "function" &&
            Number.isFinite(Number(objectMode))
              ? Boolean(mod.FS.isFile(objectMode))
              : null,
        };
      } catch (error) {
        return {
          path: normalizedPath,
          exists: null,
          analyzeError:
            error instanceof Error && error.message
              ? error.message
              : String(error ?? ""),
        };
      }
    };
    const isStartupDiagnosticPath = (rawPath) => {
      const baseName = readBaseName(rawPath).toLowerCase();
      return (
        baseName === "perm" ||
        baseName === "record" ||
        baseName.endsWith("_lock")
      );
    };
    const isLockLinkPath = (rawPath) => {
      const normalizedPath = normalizePath(rawPath).toLowerCase();
      if (!normalizedPath) {
        return false;
      }
      const lastSlashIndex = normalizedPath.lastIndexOf("/");
      const baseName =
        lastSlashIndex >= 0
          ? normalizedPath.slice(lastSlashIndex + 1)
          : normalizedPath;
      return baseName.endsWith("_lock");
    };
    const isTooManyLinksError = (error) => {
      const normalizedErrno = Number(error?.errno);
      const normalizedMessage = String(error?.message ?? error ?? "")
        .trim()
        .toLowerCase();
      return (
        normalizedErrno === 31 ||
        normalizedErrno === 34 ||
        normalizedMessage.includes("too many links") ||
        normalizedMessage.includes("emlink")
      );
    };
    const tryCreateLockLinkFallback = (sourcePath, targetPath) => {
      if (
        typeof mod.FS.analyzePath !== "function" ||
        typeof mod.FS.readFile !== "function" ||
        typeof mod.FS.writeFile !== "function"
      ) {
        console.warn(`${logPrefix} Lock fallback prerequisites are unavailable.`, {
          hasAnalyzePath: typeof mod.FS.analyzePath === "function",
          hasReadFile: typeof mod.FS.readFile === "function",
          hasWriteFile: typeof mod.FS.writeFile === "function",
        });
        return false;
      }
      const sourceInfo = mod.FS.analyzePath(sourcePath);
      const targetInfo = mod.FS.analyzePath(targetPath);
      if (!sourceInfo?.exists || targetInfo?.exists) {
        console.warn(`${logPrefix} Lock fallback cannot proceed because source/target state is incompatible.`, {
          sourcePath: describePathState(sourcePath),
          targetPath: describePathState(targetPath),
        });
        return false;
      }
      if (typeof mod.FS.symlink === "function") {
        try {
          mod.FS.symlink(sourcePath, targetPath);
          return "symlink";
        } catch (error) {
          console.warn(
            `${logPrefix} Lock-file symlink fallback failed for ${sourcePath} -> ${targetPath}:`,
            summarizeError(error),
          );
        }
      }
      const sourceBytes = mod.FS.readFile(sourcePath);
      mod.FS.writeFile(targetPath, sourceBytes, { canOwn: true });
      return "copy";
    };
    const wrapPathTraceMethod = (methodName, pathIndexes) => {
      const originalMethod = mod.FS[methodName];
      if (
        typeof originalMethod !== "function" ||
        mod.FS[`__nh3dSlashEmStartupTrace_${methodName}`]
      ) {
        return;
      }
      mod.FS[methodName] = function (...args) {
        const tracedPaths = pathIndexes
          .map((index) => args[index])
          .filter((value) => isStartupDiagnosticPath(value));
        if (tracedPaths.length > 0) {
          console.log(`${logPrefix} ${methodName}() attempt`, {
            cwd: safeCwd(),
            args: pathIndexes.reduce((result, index) => {
              result[`arg${index}`] = normalizePath(args[index]);
              return result;
            }, {}),
            pathStates: tracedPaths.map((path) => describePathState(path)),
          });
        }
        try {
          const result = originalMethod.apply(this, args);
          if (tracedPaths.length > 0) {
            console.log(`${logPrefix} ${methodName}() success`, {
              cwd: safeCwd(),
              pathStates: tracedPaths.map((path) => describePathState(path)),
            });
          }
          return result;
        } catch (error) {
          if (tracedPaths.length > 0) {
            console.warn(`${logPrefix} ${methodName}() failed`, {
              cwd: safeCwd(),
              error: summarizeError(error),
              pathStates: tracedPaths.map((path) => describePathState(path)),
            });
          }
          throw error;
        }
      };
      mod.FS[`__nh3dSlashEmStartupTrace_${methodName}`] = true;
    };

    console.log(`${logPrefix} Installing lock fallback diagnostics.`, {
      cwd: safeCwd(),
      hasSymlink: typeof mod.FS.symlink === "function",
      hasOpen: typeof mod.FS.open === "function",
      hasUnlink: typeof mod.FS.unlink === "function",
      rootEntries: listDirEntries("/"),
      saveEntries: listDirEntries("/save"),
      permState: describePathState("perm"),
      permLockState: describePathState("perm_lock"),
    });
    wrapPathTraceMethod("open", [0]);
    wrapPathTraceMethod("unlink", [0]);

    mod.FS.link = (oldpath, newpath) => {
      const shouldTraceLink =
        isStartupDiagnosticPath(oldpath) || isStartupDiagnosticPath(newpath);
      if (shouldTraceLink) {
        console.log(`${logPrefix} link() attempt`, {
          cwd: safeCwd(),
          sourcePath: describePathState(oldpath),
          targetPath: describePathState(newpath),
        });
      }
      try {
        const result = originalLink(oldpath, newpath);
        if (shouldTraceLink) {
          console.log(`${logPrefix} link() success`, {
            cwd: safeCwd(),
            sourcePath: describePathState(oldpath),
            targetPath: describePathState(newpath),
          });
        }
        return result;
      } catch (error) {
        if (shouldTraceLink) {
          console.warn(`${logPrefix} link() failed`, {
            cwd: safeCwd(),
            error: summarizeError(error),
            sourcePath: describePathState(oldpath),
            targetPath: describePathState(newpath),
          });
        }
        if (!isLockLinkPath(newpath) || !isTooManyLinksError(error)) {
          throw error;
        }
        const fallbackMode = tryCreateLockLinkFallback(oldpath, newpath);
        if (!fallbackMode) {
          console.warn(`${logPrefix} link() fallback could not create replacement lock artifact.`, {
            cwd: safeCwd(),
            sourcePath: describePathState(oldpath),
            targetPath: describePathState(newpath),
          });
          throw error;
        }
        console.warn(
          `${logPrefix} Applied ${fallbackMode} fallback for lock-file link: ${oldpath} -> ${newpath}`,
        );
        console.log(`${logPrefix} link() fallback success`, {
          cwd: safeCwd(),
          fallbackMode,
          sourcePath: describePathState(oldpath),
          targetPath: describePathState(newpath),
        });
      }
    };
    mod.FS.__nh3dSlashEmLockLinkFallbackPatched = true;
  }

  updateCheckpointRecoverySupport() {
    this.checkpointRecoverySupported = false;
    this.resumeCheckpointSave = null;

    const buildHintSupportsBridge = supportsRuntimeCheckpointRecovery(
      this.runtimeVersion,
    );
    if (!buildHintSupportsBridge) {
      console.log(
        `Checkpoint recovery support unavailable for runtime ${this.runtimeVersion}`,
      );
      return;
    }

    if (
      !this.nethackInstance ||
      typeof this.nethackInstance.cwrap !== "function"
    ) {
      return;
    }

    try {
      let wrappedResumeCheckpointSave = null;
      if (typeof this.nethackInstance.cwrap === "function") {
        try {
          wrappedResumeCheckpointSave = this.nethackInstance.cwrap(
            "resume_checkpoint_save",
            "number",
            ["string"],
          );
        } catch (error) {
          console.warn(
            "Failed to bind cwrap resume_checkpoint_save bridge from NetHack runtime:",
            error,
          );
        }
      }

      if (typeof wrappedResumeCheckpointSave === "function") {
        this.resumeCheckpointSave = (playerName) => {
          const normalizedName = this.normalizeCharacterNameValue(playerName);
          if (!normalizedName) {
            return 0;
          }
          return Number(wrappedResumeCheckpointSave(normalizedName));
        };
      }

      const directResumeCheckpointSave =
        typeof this.nethackInstance._resume_checkpoint_save === "function"
          ? this.nethackInstance._resume_checkpoint_save
          : null;
      const malloc =
        typeof this.nethackInstance._malloc === "function"
          ? this.nethackInstance._malloc
          : null;
      const free =
        typeof this.nethackInstance._free === "function"
          ? this.nethackInstance._free
          : null;
      const stringToUtf8 =
        typeof this.nethackInstance.stringToUTF8 === "function"
          ? this.nethackInstance.stringToUTF8
          : null;

      if (
        !this.resumeCheckpointSave &&
        directResumeCheckpointSave &&
        malloc &&
        free &&
        stringToUtf8
      ) {
        this.resumeCheckpointSave = (playerName) => {
          const normalizedName = this.normalizeCharacterNameValue(playerName);
          if (!normalizedName) {
            return 0;
          }
          const bufferSize = normalizedName.length * 4 + 1;
          const playerNamePtr = malloc(bufferSize);
          try {
            stringToUtf8(normalizedName, playerNamePtr, bufferSize);
            return Number(directResumeCheckpointSave(playerNamePtr));
          } finally {
            free(playerNamePtr);
          }
        };
      }

      this.checkpointRecoverySupported =
        typeof this.resumeCheckpointSave === "function";
      console.log(
        `Checkpoint recovery support ${
          this.checkpointRecoverySupported ? "enabled" : "unavailable"
        } for runtime ${this.runtimeVersion}`,
      );
      if (!this.checkpointRecoverySupported) {
        if (buildHintSupportsBridge) {
          console.warn(
            `Checkpoint recovery build hint was enabled for runtime ${this.runtimeVersion}, but the instantiated module could not bind resume_checkpoint_save. Treating recovery as unavailable.`,
          );
        } else if (
          hasRuntimeCheckpointRecoveryPrimitiveExport(this.runtimeVersion)
        ) {
          console.log(
            `Checkpoint recovery primitive detected for runtime ${this.runtimeVersion}, but the instantiated module still lacks a working browser-side resume bridge.`,
          );
        }
      }
    } catch (error) {
      console.warn(
        "Failed to bind direct resume_checkpoint_save bridge from NetHack runtime:",
        error,
      );
    }
  }

  queueCheckpointAutosaveResumeBeforeStartup() {
    if (!this.isAutosaveResumeRequested()) {
      return;
    }

    this.logAutosaveCheckpointArtifactsBeforeStartup();
    this.ensureAutosaveResumeHasRecoverableCheckpoint();

    if (this.runtimeVersion === "5.0") {
      // NetHack 5.0's SELF_RECOVER path is wired through getlock().
      // Calling resume_checkpoint_save() directly before startup has proven
      // unstable in this build (function signature mismatch + partial side
      // effects), so defer to getlock() and auto-answer "r".
      console.log(
        "Deferring checkpoint autosave resume to getlock() prompt flow for runtime 5.0",
      );
      return;
    }

    if (
      !this.checkpointRecoverySupported ||
      typeof this.resumeCheckpointSave !== "function"
    ) {
      throw new Error(this.buildCheckpointAutosaveResumeUnsupportedReason());
    }

    const playerName = this.normalizeCharacterNameValue(
      this.startupOptions?.characterCreation?.name,
    );
    if (!playerName) {
      throw new Error(
        "Checkpoint autosave resume requires a character name to identify the save.",
      );
    }

    let didRecover = 0;
    try {
      didRecover = Number(this.resumeCheckpointSave(playerName));
    } catch (error) {
      const errorText =
        error instanceof Error && error.message
          ? error.message
          : String(error ?? "");
      // Some builds can still recover through getlock()'s SELF_RECOVER prompt
      // even when direct pre-main bridge invocation fails.
      if (
        /function signature mismatch/i.test(errorText) ||
        /runtimeerror/i.test(errorText)
      ) {
        console.warn(
          `Direct checkpoint resume bridge failed before startup (${errorText}). Falling back to getlock() recovery prompt.`,
          error,
        );
        return;
      }
      throw error;
    }
    if (didRecover !== 1) {
      throw new Error(
        `Failed to queue checkpoint autosave resume for "${playerName}" before startup.`,
      );
    }

    console.log(
      `Queued checkpoint autosave resume for "${playerName}" before NetHack startup`,
    );
  }

  updateNumberPadModeFromInput(input) {
    if (!this.isNumberPadModeQuestion(this.lastQuestionText)) {
      return;
    }
    const normalized =
      typeof input === "string" && input.startsWith("Numpad")
        ? input.slice("Numpad".length)
        : input;
    if (normalized === "0") {
      this.numberPadModeEnabled = false;
      return;
    }
    if (normalized === "1" || normalized === "2") {
      this.numberPadModeEnabled = true;
    }
  }

  isLookAtMenuQuestion(question) {
    const normalized = this.normalizeQuestionText(question);
    return normalized.includes("what do you want to look at");
  }

  isNameRootQuestion(question) {
    const normalized = this.normalizeQuestionText(question);
    if (!normalized) {
      return false;
    }
    return normalized.startsWith("what do you want to name");
  }

  isCallRootQuestion(question) {
    const normalized = this.normalizeQuestionText(question);
    if (!normalized) {
      return false;
    }
    return (
      normalized.startsWith("what do you want to call") ||
      normalized.startsWith("call what")
    );
  }

  isInventoryActionChoiceQuestion(question) {
    const normalized = this.normalizeQuestionText(question);
    if (!normalized) {
      return false;
    }
    return (
      normalized.includes("do what with") ||
      normalized.includes("what do you want to do with") ||
      normalized.includes("what would you like to do with")
    );
  }

  getInventoryContextActionAccelerator(actionId) {
    switch (String(actionId || "").trim().toLowerCase()) {
      case "apply":
        return "a";
      case "invoke":
        return "V";
      case "tip":
        return "T";
      case "loot":
        return "l";
      case "drop":
        return "d";
      case "eat":
        return "e";
      case "quaff":
        return "q";
      case "read":
        return "r";
      case "rub":
        return "R";
      case "throw":
        return "t";
      case "wield":
      case "unwield":
        return "w";
      case "wear":
        return "W";
      case "take-off":
        return "T";
      case "put-on":
        return "P";
      case "remove":
        return "R";
      case "zap":
        return "z";
      case "cast":
        return "Z";
      case "quiver":
        return "Q";
      case "untrap":
        return "u";
      case "offer":
        return "O";
      case "name":
        return "c";
      case "call":
        return "C";
      case "adjust":
        return "i";
      case "engrave":
        return "E";
      case "dip":
        return "a";
      case "info":
        return "/";
      default:
        return "";
    }
  }

  getInventoryContextActionIdentifier(actionId) {
    const normalizedActionId = String(actionId || "")
      .trim()
      .toLowerCase();
    if (!normalizedActionId || this.runtimeVersion !== "5.0") {
      return null;
    }

    // NetHack 5.0 `src/iactions.c` enum item_action_actions values.
    const actionIdentifierMap = {
      unwield: 1, // IA_UNWIELD
      apply: 2, // IA_APPLY_OBJ
      dip: 3, // IA_DIP_OBJ
      name: 4, // IA_NAME_OBJ
      call: 5, // IA_NAME_OTYP
      drop: 6, // IA_DROP_OBJ
      eat: 7, // IA_EAT_OBJ
      engrave: 8, // IA_ENGRAVE_OBJ
      quaff: 14, // IA_QUAFF_OBJ
      quiver: 15, // IA_QUIVER_OBJ
      read: 16, // IA_READ_OBJ
      rub: 17, // IA_RUB_OBJ
      throw: 18, // IA_THROW_OBJ
      "take-off": 19, // IA_TAKEOFF_OBJ
      remove: 19, // IA_TAKEOFF_OBJ
      tip: 20, // IA_TIP_CONTAINER
      invoke: 21, // IA_INVOKE_OBJ
      wield: 22, // IA_WIELD_OBJ
      wear: 23, // IA_WEAR_OBJ
      "put-on": 23, // IA_WEAR_OBJ
      zap: 26, // IA_ZAP_OBJ
      info: 27, // IA_WHATIS_OBJ
      offer: 12, // IA_SACRIFICE
      adjust: 10, // IA_ADJUST_OBJ
    };

    const mapped = actionIdentifierMap[normalizedActionId];
    return Number.isInteger(mapped) ? mapped : null;
  }

  resolvePendingInventoryActionMenuItem(actionId, menuQuestion, menuItems) {
    const normalizedActionId = String(actionId || "")
      .trim()
      .toLowerCase();
    if (
      !normalizedActionId ||
      !Array.isArray(menuItems) ||
      menuItems.length === 0 ||
      !this.isInventoryActionChoiceQuestion(menuQuestion)
    ) {
      return null;
    }

    const expectedIdentifier =
      this.getInventoryContextActionIdentifier(normalizedActionId);
    if (Number.isInteger(expectedIdentifier)) {
      const byIdentifier = menuItems.find((item) => {
        if (!item || item.isCategory) {
          return false;
        }
        const identifier = Number(item.identifier);
        return Number.isInteger(identifier) && identifier === expectedIdentifier;
      });
      if (byIdentifier) {
        return byIdentifier;
      }
    }

    const expectedAccelerator =
      this.getInventoryContextActionAccelerator(normalizedActionId);
    if (expectedAccelerator) {
      const byExactAccelerator = menuItems.find((item) => {
        if (!item || item.isCategory) {
          return false;
        }
        const accel = String(item.accelerator || "").trim();
        if (accel && accel === expectedAccelerator) {
          return true;
        }
        const originalAccelerator = this.getPrintableAcceleratorCharacter(
          item.originalAccelerator,
        );
        if (originalAccelerator) {
          return originalAccelerator === expectedAccelerator;
        }
        return false;
      });
      if (byExactAccelerator) {
        return byExactAccelerator;
      }
    }

    const textFragmentsByAction = {
      apply: ["apply", "use"],
      invoke: ["invoke"],
      tip: ["tip"],
      loot: ["loot"],
      drop: ["drop"],
      eat: ["eat"],
      quaff: ["quaff", "drink"],
      read: ["read"],
      rub: ["rub"],
      throw: ["throw"],
      wield: ["wield"],
      unwield: ["unwield", "wield"],
      wear: ["wear"],
      "take-off": ["take off", "remove"],
      "put-on": ["put on"],
      remove: ["remove"],
      zap: ["zap"],
      cast: ["cast"],
      quiver: ["quiver"],
      untrap: ["untrap"],
      offer: ["offer"],
      name: ["rename", "name"],
      call: ["the type for", "re-call", "un-call"],
      adjust: ["adjust inventory", "assigning new letter", "splitting this stack"],
      engrave: ["engrave"],
      dip: ["dip"],
      info: ["look up information", "information"],
    };
    const textFragments = Array.isArray(textFragmentsByAction[normalizedActionId])
      ? textFragmentsByAction[normalizedActionId]
      : [];
    if (textFragments.length === 0) {
      return null;
    }

    return (
      menuItems.find((item) => {
        if (!item || item.isCategory || typeof item.text !== "string") {
          return false;
        }
        const normalizedText = item.text.trim().toLowerCase();
        if (!normalizedText) {
          return false;
        }
        return textFragments.some((fragment) =>
          normalizedText.includes(fragment),
        );
      }) || null
    );
  }

  resolveNameInventoryRouteMenuItem(menuItems) {
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      return null;
    }

    const byText = menuItems.find(
      (item) =>
        item &&
        !item.isCategory &&
        typeof item.text === "string" &&
        item.text.toLowerCase().includes("particular object in inventory"),
    );
    if (byText) {
      return byText;
    }

    const normalizedEntries = menuItems
      .filter((item) => item && !item.isCategory)
      .map((item) =>
        typeof item.text === "string" ? item.text.trim().toLowerCase() : "",
      )
      .filter((text) => text.length > 0);
    if (normalizedEntries.length === 0) {
      return null;
    }

    const rootMarkers = [
      "a monster",
      "the type of an object in inventory",
      "the type of an object upon the floor",
      "the type of an object on discoveries list",
      "record an annotation for the current level",
    ];
    const matchedRootMarkers = rootMarkers.filter((marker) =>
      normalizedEntries.some((text) => text.includes(marker)),
    );
    if (matchedRootMarkers.length < 2) {
      return null;
    }

    return (
      menuItems.find(
        (item) =>
          item &&
          !item.isCategory &&
          typeof item.accelerator === "string" &&
          item.accelerator.toLowerCase() === "i",
      ) || null
    );
  }

  resolveCallInventoryRouteMenuItem(menuItems) {
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      return null;
    }

    const byText = menuItems.find((item) => {
      if (!item || item.isCategory || typeof item.text !== "string") {
        return false;
      }
      const normalizedText = item.text.toLowerCase();
      if (normalizedText.includes("type of an object in inventory")) {
        return true;
      }
      return (
        normalizedText.includes("inventory") &&
        normalizedText.includes("type") &&
        normalizedText.includes("object")
      );
    });
    if (byText) {
      return byText;
    }

    const normalizedEntries = menuItems
      .filter((item) => item && !item.isCategory)
      .map((item) =>
        typeof item.text === "string" ? item.text.trim().toLowerCase() : "",
      )
      .filter((text) => text.length > 0);
    if (normalizedEntries.length === 0) {
      return null;
    }

    const rootMarkers = [
      "a monster",
      "a particular object in inventory",
      "the type of an object upon the floor",
      "the type of an object on discoveries list",
      "record an annotation for the current level",
    ];
    const matchedRootMarkers = rootMarkers.filter((marker) =>
      normalizedEntries.some((text) => text.includes(marker)),
    );
    if (matchedRootMarkers.length < 2) {
      return null;
    }

    return (
      menuItems.find(
        (item) =>
          item &&
          !item.isCategory &&
          typeof item.accelerator === "string" &&
          item.accelerator.toLowerCase() === "o",
      ) || null
    );
  }

  resolveLookInventoryRouteMenuItem(menuItems) {
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      return null;
    }

    const byText = menuItems.find(
      (item) =>
        item &&
        !item.isCategory &&
        typeof item.text === "string" &&
        item.text.toLowerCase().includes("something you're carrying"),
    );
    if (byText) {
      return byText;
    }

    const normalizedEntries = menuItems
      .filter((item) => item && !item.isCategory)
      .map((item) =>
        typeof item.text === "string" ? item.text.trim().toLowerCase() : "",
      )
      .filter((text) => text.length > 0);
    if (normalizedEntries.length === 0) {
      return null;
    }

    const rootMarkers = [
      "something on the map",
      "something else (by symbol or name)",
    ];
    const matchedRootMarkers = rootMarkers.filter((marker) =>
      normalizedEntries.some((text) => text.includes(marker)),
    );
    if (matchedRootMarkers.length < 2) {
      return null;
    }

    return (
      menuItems.find(
        (item) =>
          item &&
          !item.isCategory &&
          typeof item.accelerator === "string" &&
          item.accelerator.toLowerCase() === "i",
      ) || null
    );
  }

  resolveLookMapRouteMenuItem(menuItems) {
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      return null;
    }

    const byText = menuItems.find(
      (item) =>
        item &&
        !item.isCategory &&
        typeof item.text === "string" &&
        item.text.toLowerCase().includes("something on the map"),
    );
    if (byText) {
      return byText;
    }

    return (
      menuItems.find((item) => this.isLookAtMapMenuSelection(item)) || null
    );
  }

  tryAutoHandlePendingInventoryContextSelection(
    menuQuestion,
    menuItems,
    options = {},
  ) {
    const reason =
      typeof options.reason === "string" && options.reason.trim()
        ? options.reason.trim()
        : "context action";
    const shouldRouteContextualLookMapSelection =
      this.isLookAtMenuQuestion(menuQuestion) &&
      this.pendingContextualLookMapRouteSelection;
    if (
      !this.hasPendingInventoryContextSelection() &&
      !shouldRouteContextualLookMapSelection
    ) {
      return false;
    }

    const pendingActionId = this.getPendingInventoryContextActionId();

    const shouldRouteAsCall =
      pendingActionId === "call" || this.isCallRootQuestion(menuQuestion);
    if (shouldRouteAsCall) {
      const callInventoryRouteItem =
        this.resolveCallInventoryRouteMenuItem(menuItems);
      if (callInventoryRouteItem) {
        if (
          this.tryAutoSelectMenuItem(
            callInventoryRouteItem,
            `${reason} (#call inventory route)`,
          )
        ) {
          return true;
        }
        this.clearPendingInventoryContextSelection(
          "#call routing option unavailable",
        );
        return false;
      }
    }

    if (this.isNameRootQuestion(menuQuestion)) {
      const nameInventoryRouteItem =
        this.resolveNameInventoryRouteMenuItem(menuItems);
      if (nameInventoryRouteItem) {
        if (
          this.tryAutoSelectMenuItem(
            nameInventoryRouteItem,
            `${reason} (#name inventory route)`,
          )
        ) {
          return true;
        }
        this.clearPendingInventoryContextSelection(
          "#name routing option unavailable",
        );
        return false;
      }
    }

    if (this.isLookAtMenuQuestion(menuQuestion)) {
      if (
        this.pendingContextualLookMapRouteSelection &&
        this.contextualLookInfoProbeMouseDeadlineMs > 0 &&
        Date.now() <= this.contextualLookInfoProbeMouseDeadlineMs
      ) {
        const lookMapRouteItem = this.resolveLookMapRouteMenuItem(menuItems);
        if (
          lookMapRouteItem &&
          this.tryAutoSelectMenuItem(
            lookMapRouteItem,
            `${reason} (look map route)`,
          )
        ) {
          return true;
        }
        this.clearContextualLookInfoAutoFlow("look map route unavailable");
      } else if (this.pendingContextualLookMapRouteSelection) {
        this.clearContextualLookInfoAutoFlow("look map route expired");
      }
      const lookInventoryRouteItem =
        this.resolveLookInventoryRouteMenuItem(menuItems);
      if (
        lookInventoryRouteItem &&
        this.tryAutoSelectMenuItem(
          lookInventoryRouteItem,
          `${reason} (look inventory route)`,
        )
      ) {
        return true;
      }
    }

    if (pendingActionId) {
      const actionMenuItem = this.resolvePendingInventoryActionMenuItem(
        pendingActionId,
        menuQuestion,
        menuItems,
      );
      if (actionMenuItem) {
        this.clearPendingInventoryContextSelection(
          `${pendingActionId} action route selected`,
        );
        if (
          this.tryAutoSelectMenuItem(
            actionMenuItem,
            `${reason} (#${pendingActionId} action route)`,
          )
        ) {
          return true;
        }
        return false;
      }
      if (this.isInventoryActionChoiceQuestion(menuQuestion)) {
        this.clearPendingInventoryContextSelection(
          `${pendingActionId} action route unavailable on inventory action menu`,
        );
        return false;
      }
    }

    const directInventorySelection = this.consumePendingInventoryContextSelection(
      menuItems,
      { clearOnMiss: false },
    );
    if (!directInventorySelection) {
      if (
        this.tryAutoRoutePendingInventoryContextSelectionThroughListEverything(
          menuItems,
          reason,
          menuQuestion,
        )
      ) {
        return true;
      }
      const pending =
        this.pendingInventoryContextSelection &&
        typeof this.pendingInventoryContextSelection === "object"
          ? this.pendingInventoryContextSelection
          : null;
      const noMatchReason =
        pending?.listEverythingFallbackUsed === true
          ? "no matching menu item after * list everything fallback"
          : "no matching menu item";
      this.clearPendingInventoryContextSelection(noMatchReason);
      return false;
    }

    return this.tryAutoSelectMenuItem(
      directInventorySelection.menuItem,
      reason,
      directInventorySelection.selectionCount,
    );
  }

  tryAutoSelectMenuItem(
    menuItem,
    reason = "context action",
    selectionCount,
    menuQuestion = this.currentMenuQuestionText,
  ) {
    const selectionEntry = this.createSelectionEntryFromMenuItem(
      menuItem,
      selectionCount,
    );
    if (!selectionEntry) {
      return false;
    }

    this.menuSelections.clear();
    const selectionKey = this.getMenuSelectionKey(selectionEntry);
    this.menuSelections.set(selectionKey, selectionEntry);
    this.isInMultiPickup = false;
    this.lastMenuInteractionCancelled = false;
    console.log(
      `Auto-selected menu item via ${reason}: ${selectionEntry.menuChar} (${selectionEntry.text})`,
    );
    this.armPendingPostActionPlayerTileRefreshForMenuInteraction(
      menuQuestion,
      menuItem,
      `for auto-selected menu item via ${reason}`,
    );
    return true;
  }

  wakeAwaitingQuestionInputForAutoSelection(source = "system") {
    if (
      !this.awaitingQuestionInput ||
      !this.inputBroker ||
      !this.inputBroker.hasPendingRequests("event")
    ) {
      return;
    }
    const firstSelection = Array.from(this.menuSelections.values())[0];
    if (!firstSelection) {
      return;
    }

    const selectedMenuItem = Array.isArray(this.currentMenuItems)
      ? this.currentMenuItems.find(
          (item) =>
            item &&
            !item.isCategory &&
            Number.isInteger(item.menuIndex) &&
            item.menuIndex === firstSelection.menuIndex,
        )
      : null;
    let wakeInput = "Enter";
    if (selectedMenuItem) {
      wakeInput = this.getMenuSelectionWakeInput(selectedMenuItem);
    } else if (
      typeof firstSelection.menuChar === "string" &&
      firstSelection.menuChar.length === 1
    ) {
      wakeInput = firstSelection.menuChar;
    } else {
      const originalWakeInput = this.getPrintableAcceleratorCharacter(
        firstSelection.originalAccelerator,
      );
      if (originalWakeInput) {
        wakeInput = originalWakeInput;
      }
    }

    console.log(
      `Waking pending menu input after auto-selection with "${wakeInput}"`,
    );
    this.enqueueInputKeys([wakeInput], source, ["event"]);
  }

  isLookAtMapMenuSelection(menuItem) {
    if (!menuItem || menuItem.isCategory) {
      return false;
    }

    const accelerator =
      typeof menuItem.accelerator === "string" ? menuItem.accelerator : "";
    const originalAccelerator = menuItem.originalAccelerator;
    const identifier = menuItem.identifier;
    const originalAcceleratorChar =
      this.getPrintableAcceleratorCharacter(originalAccelerator);
    const selectsMapTarget =
      accelerator === "/" ||
      originalAccelerator === 47 ||
      originalAcceleratorChar === "/" ||
      identifier === 47;
    if (!selectsMapTarget) {
      return false;
    }

    if (this.isLookAtMenuQuestion(this.currentMenuQuestionText)) {
      return true;
    }

    const text = String(menuItem.text || "")
      .trim()
      .toLowerCase();
    return text === "something on the map";
  }

  isFloorTargetPositionMenuSelection(menuItem) {
    if (!menuItem || menuItem.isCategory) {
      return false;
    }

    if (
      !this.isNameRootQuestion(this.currentMenuQuestionText) &&
      !this.isCallRootQuestion(this.currentMenuQuestionText)
    ) {
      return false;
    }

    const text = String(menuItem.text || "")
      .trim()
      .toLowerCase();
    return (
      text === "the type of an object upon the floor" ||
      text.includes("object upon the floor")
    );
  }

  isMonsterTargetPositionMenuSelection(menuItem) {
    if (!menuItem || menuItem.isCategory) {
      return false;
    }

    if (
      !this.isNameRootQuestion(this.currentMenuQuestionText) &&
      !this.isCallRootQuestion(this.currentMenuQuestionText)
    ) {
      return false;
    }

    const text = String(menuItem.text || "")
      .trim()
      .toLowerCase();
    return text === "a monster" || text.includes("monster");
  }

  isMenuSelectionInput(input) {
    return (
      typeof input === "string" &&
      input.startsWith(this.menuSelectionInputPrefix) &&
      input.length > this.menuSelectionInputPrefix.length
    );
  }

  decodeMenuSelectionIndex(input) {
    if (!this.isMenuSelectionInput(input)) {
      return null;
    }
    const raw = input
      .slice(this.menuSelectionInputPrefix.length)
      .trim()
      .split(":")[0];
    if (!/^-?\d+$/.test(raw)) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : null;
  }

  decodeMenuSelectionCount(input) {
    if (!this.isMenuSelectionInput(input)) {
      return undefined;
    }
    const raw = input.slice(this.menuSelectionInputPrefix.length).trim();
    const parts = raw.split(":");
    if (parts.length < 2 || !/^\d+$/.test(parts[1])) {
      return undefined;
    }
    const parsed = Number.parseInt(parts[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
  }

  getMenuSelectionKey(item) {
    const menuIndex = Number.isInteger(item?.menuIndex) ? item.menuIndex : -1;
    return `menu-index:${menuIndex}`;
  }

  createSelectionEntryFromMenuItem(menuItem, selectionCount) {
    if (!menuItem) {
      return null;
    }
    const normalizedSelectionCount =
      Number.isFinite(selectionCount) && Number(selectionCount) > 0
        ? Math.trunc(Number(selectionCount))
        : undefined;
    return {
      menuChar: menuItem.accelerator,
      originalAccelerator: menuItem.originalAccelerator,
      identifier: menuItem.identifier,
      menuIndex: menuItem.menuIndex,
      text: menuItem.text,
      count: normalizedSelectionCount,
    };
  }

  getMenuSelectionWakeInput(menuItem) {
    if (this.isLookAtMapMenuSelection(menuItem)) {
      this.pendingLookMenuFarLookArm = true;
      console.log(
        "Look menu map selection detected; using ';' wake input to arm far-look mode",
      );
      return ";";
    }

    if (this.isFloorTargetPositionMenuSelection(menuItem)) {
      this.pendingLookMenuFarLookArm = true;
      console.log(
        "Floor-target naming selection detected; using ';' wake input to arm far-look mode",
      );
      return ";";
    }

    if (this.isMonsterTargetPositionMenuSelection(menuItem)) {
      this.pendingLookMenuFarLookArm = true;
      console.log(
        "Monster-target naming/calling selection detected; using ';' wake input to arm far-look mode",
      );
      return ";";
    }

    if (
      menuItem &&
      typeof menuItem.accelerator === "string" &&
      menuItem.accelerator.length === 1
    ) {
      return menuItem.accelerator;
    }

    const original = this.getPrintableAcceleratorCharacter(
      menuItem?.originalAccelerator,
    );
    if (original) {
      return original;
    }
    return "Enter";
  }

  resolveMenuItemFromSelectionInput(input) {
    const menuIndex = this.decodeMenuSelectionIndex(input);
    if (!Number.isInteger(menuIndex)) {
      return null;
    }
    if (
      !Array.isArray(this.currentMenuItems) ||
      this.currentMenuItems.length === 0
    ) {
      return null;
    }
    return (
      this.currentMenuItems.find(
        (item) =>
          item &&
          !item.isCategory &&
          Number.isInteger(item.menuIndex) &&
          item.menuIndex === menuIndex,
      ) || null
    );
  }

  isContainerLootTypeQuestion(question) {
    const normalized = this.normalizeQuestionText(question);
    const asksObjectTypes =
      normalized.includes("what types of objects") ||
      normalized.includes("what type of objects");
    const isContainerTransferQuestion =
      normalized.includes("take out") || normalized.includes("put in");
    return asksObjectTypes && isContainerTransferQuestion;
  }

  isMultiSelectLootQuestion(question) {
    const normalized = this.normalizeQuestionText(question);
    return (
      normalized.includes("pick up what") ||
      normalized.includes("what do you want to pick up") ||
      normalized.includes("what would you like to drop") ||
      normalized.includes("drop what type of items") ||
      normalized.includes("take out what") ||
      normalized.includes("what do you want to take out") ||
      normalized.includes("what would you like to take out") ||
      normalized.includes("put in what") ||
      normalized.includes("what do you want to put in") ||
      normalized.includes("what would you like to put in") ||
      normalized.includes("put in, then take out what") ||
      normalized.includes("take out, then put in what")
    );
  }

  consumeQueuedExtendedCommandInput() {
    let commandText = "";

    while (true) {
      const nextToken = this.inputBroker.dequeueToken("event");
      if (!nextToken) {
        break;
      }

      const nextInput = nextToken.key;
      if (nextInput === undefined || nextInput === null) {
        continue;
      }

      if (nextInput === "Escape") {
        return null;
      }
      if (nextInput === "Enter" || nextInput === "\r" || nextInput === "\n") {
        break;
      }
      if (nextInput === "Backspace") {
        commandText = commandText.slice(0, -1);
        continue;
      }

      let token = null;
      if (typeof nextInput === "string" && nextInput.length === 1) {
        token = nextInput;
      } else {
        // Preserve non-command input for the normal callback path.
        this.inputBroker.prependToken(nextToken);
        break;
      }

      if (!token || token === "#") {
        continue;
      }
      if (/^[A-Za-z0-9_?-]$/.test(token)) {
        commandText += token.toLowerCase();
        continue;
      }

      // Preserve unexpected input for regular processing.
      this.inputBroker.prependToken(nextToken);
      break;
    }

    return commandText;
  }

  resolveExtendedCommandIndex(commandText) {
    const normalized = String(commandText || "")
      .trim()
      .toLowerCase()
      .replace(/^#+/, "");
    if (!normalized) {
      return -1;
    }

    const entries = this.getExtendedCommandEntries();
    if (entries.length) {
      const exact = entries.find((entry) => entry.name === normalized);
      if (exact) {
        return exact.index;
      }

      const prefixMatches = entries.filter((entry) =>
        entry.name.startsWith(normalized),
      );
      if (prefixMatches.length === 1) {
        return prefixMatches[0].index;
      }
      return -1;
    }

    return -1;
  }

  resolveExtendedCommandNameByIndex(commandIndex) {
    if (!Number.isInteger(commandIndex) || commandIndex < 0) {
      return null;
    }
    const entry = this.getExtendedCommandEntries().find(
      (candidate) => candidate && candidate.index === commandIndex,
    );
    return entry && typeof entry.name === "string" ? entry.name : null;
  }

  armFarLookForExtendedCommandIndex(commandIndex) {
    const commandName = this.resolveExtendedCommandNameByIndex(commandIndex);
    if (commandName !== "glance") {
      return;
    }
    console.log("Arming far-look mode for #glance extended command");
    this.farLookMode = "armed";
    this.farLookOrigin = "direct";
    this.pendingLookMenuFarLookArm = false;
  }

  resolveMetaBoundExtendedCommandName(metaKey) {
    if (typeof metaKey !== "string" || metaKey.length === 0) {
      return null;
    }

    const normalized = metaKey.charAt(0).toLowerCase();
    if (!/^[a-z]$/.test(normalized)) {
      return null;
    }

    const entries = this.getExtendedCommandEntries();
    if (this.runtimeVersion === "slashem") {
      // Slash'EM's extcmdlist does not store meta accelerators; those live in
      // the regular command table. Prefer the source-defined Alt bindings when
      // the corresponding extended command is available.
      const slashEmCommandName =
        SLASHEM_META_EXTENDED_COMMAND_NAME_BY_KEY[normalized];
      if (
        typeof slashEmCommandName === "string" &&
        entries.some((entry) => entry.name === slashEmCommandName)
      ) {
        return slashEmCommandName;
      }
    }

    const metaKeyCode = normalized.charCodeAt(0) | 0x80;
    const keyedEntries = entries.filter(
      (entry) => entry.keyCode === metaKeyCode,
    );
    if (keyedEntries.length === 0) {
      return null;
    }

    const preferred =
      keyedEntries.find((entry) => entry.name !== "#" && entry.name !== "?") ||
      keyedEntries[0];
    return preferred && typeof preferred.name === "string"
      ? preferred.name
      : null;
  }

  getExtendedCommandEntries() {
    if (
      Array.isArray(this.extendedCommandEntries) &&
      this.extendedCommandEntries.length > 0
    ) {
      return this.extendedCommandEntries;
    }

    const wasEmpty =
      !Array.isArray(this.extendedCommandEntries) ||
      this.extendedCommandEntries.length === 0;

    const extracted = this.extractExtendedCommandEntriesFromMemory();
    if (extracted.length > 0) {
      this.extendedCommandEntries = extracted;
      // First successful extraction after a startup-time empty snapshot:
      // re-emit so the engine's autocomplete picks up the list. Without
      // this, EvilHack's `#` prompt has no completions because the extcmd
      // table wasn't yet linked when sendReconnectSnapshot fired.
      if (wasEmpty && !this.extendedCommandsEmitFromLazyLoad) {
        this.extendedCommandsEmitFromLazyLoad = true;
        try {
          this.emitExtendedCommands("lazy_load");
        } catch (error) {
          console.warn("Failed to emit extended commands on lazy load", error);
        }
      }
      return extracted;
    }

    // Fail closed instead of inventing an inferred/fallback table that can
    // misroute commands after a wasm update.
    this.extendedCommandEntries = [];
    return this.extendedCommandEntries;
  }

  emitExtendedCommands(source = "runtime") {
    if (!this.eventHandler) {
      return;
    }

    const entries = this.getExtendedCommandEntries();
    const uniqueNames = [];
    const seen = new Set();
    for (const entry of entries) {
      const name = String(entry?.name || "")
        .trim()
        .toLowerCase();
      if (!name || name === "#" || name === "?" || seen.has(name)) {
        continue;
      }
      seen.add(name);
      uniqueNames.push(name);
    }

    this.emit({
      type: "extended_commands",
      commands: uniqueNames,
      source,
    });
  }

  extractExtendedCommandEntriesFromMemory() {
    if (
      !this.nethackModule ||
      typeof this.nethackModule.getValue !== "function"
    ) {
      return [];
    }

    const extcmdContract = this.getRuntimePointerContract()?.extcmd || {};
    const exportedPointerName =
      typeof extcmdContract.exportedPointerName === "string" &&
      extcmdContract.exportedPointerName.trim()
        ? extcmdContract.exportedPointerName.trim()
        : "extcmdlist";
    const exportedPointerValue = this.resolveRuntimeExportedPointer(
      exportedPointerName,
    );
    if (!exportedPointerValue) {
      console.log(
        `Missing runtime pointer contract export "${exportedPointerName}"; extended commands are unavailable for this wasm build.`,
      );
      return [];
    }

    const exportedPointerMode =
      extcmdContract.exportedPointerMode === "slot"
        ? "slot"
        : extcmdContract.exportedPointerMode === "direct"
          ? "direct"
          : "direct_or_slot";
    const candidateBases = [];
    const pushCandidateBase = (value) => {
      const normalized = this.normalizeWasmPointer(value, {
        label: `${exportedPointerName}_candidate_base`,
        minBytes: 1,
        alignment: 4,
      });
      if (!normalized || candidateBases.includes(normalized)) {
        return;
      }
      candidateBases.push(normalized);
    };
    if (exportedPointerMode !== "slot") {
      pushCandidateBase(exportedPointerValue);
    }
    if (exportedPointerMode !== "direct") {
      const slotValue = this.readPointerSlotValue(
        exportedPointerValue,
        `${exportedPointerName}_slot`,
        true,
      );
      pushCandidateBase(slotValue);
    }
    if (candidateBases.length === 0) {
      console.log(
        `No valid extcmd table base candidates for exported pointer "${exportedPointerName}" (${exportedPointerValue})`,
      );
      return [];
    }

    const candidateResults = [];
    for (const basePtr of candidateBases) {
      const entries = this.readExtendedCommandEntriesFromBase(
        basePtr,
        extcmdContract,
      );
      const looksValid = this.validateExtendedCommandEntries(
        entries,
        extcmdContract,
      );
      candidateResults.push({
        basePtr,
        entriesLength: entries.length,
        looksValid,
      });
      if (!looksValid) {
        continue;
      }
      console.log(
        `Resolved extended command table from exported pointer "${exportedPointerName}"`,
        {
          entries: entries.length,
          base: basePtr,
          mode: exportedPointerMode,
          commands: entries.map((entry) => entry.name),
        },
      );
      return entries;
    }

    console.log(
      `Extcmd pointer contract validation failed for all bases derived from "${exportedPointerName}"`,
      candidateResults,
    );
    return [];
  }

  readExtendedCommandEntriesFromBase(extcmdlistPtr, extcmdContract = {}) {
    if (
      !this.nethackModule ||
      typeof this.nethackModule.getValue !== "function"
    ) {
      return [];
    }
    const stride = Number(extcmdContract.stride);
    const textPtrOffset = Number(extcmdContract.textPtrOffset);
    const flagsOffset = Number(extcmdContract.flagsOffset);
    const maxEntries = Number(extcmdContract.maxEntries) || 512;
    if (
      !Number.isInteger(stride) ||
      stride < 8 ||
      !Number.isInteger(textPtrOffset) ||
      textPtrOffset < 0 ||
      textPtrOffset + 4 > stride ||
      !Number.isInteger(flagsOffset) ||
      flagsOffset < 0 ||
      flagsOffset + 4 > stride
    ) {
      this.notePointerContractViolation(
        "extcmd-layout-invalid",
        "Extended command layout is invalid in the runtime pointer contract.",
        { stride, textPtrOffset, flagsOffset },
      );
      return [];
    }

    const entries = [];
    for (let index = 0; index < maxEntries; index++) {
      const offset = extcmdlistPtr + index * stride;
      if (!Number.isFinite(offset) || offset <= 0) {
        break;
      }

      const keyCode = this.readRuntimeI8(
        offset,
        `extcmd_${index}_key`,
        true,
      );
      const textPtr = this.readRuntimeI32(
        offset + textPtrOffset,
        `extcmd_${index}_text_ptr`,
      );
      if (!Number.isInteger(textPtr) || textPtr <= 0) {
        // Sentinel row has ef_txt == NULL.
        break;
      }

      const name = this.readHeapCString(textPtr, 64);
      if (!this.isLikelyExtendedCommandName(name)) {
        if (index === 0) {
          return [];
        }
        break;
      }

      const flags = this.readRuntimeI32(
        offset + flagsOffset,
        `extcmd_${index}_flags`,
      );
      entries.push({
        index,
        name: name.toLowerCase(),
        keyCode: Number.isInteger(keyCode) ? keyCode : 0,
        flags: Number.isInteger(flags) ? flags : 0,
      });
    }

    return entries;
  }

  validateExtendedCommandEntries(entries, extcmdContract = {}) {
    const minEntries = Number(extcmdContract.minEntries) || 10;
    const requiredNames = Array.isArray(extcmdContract.requiredNames)
      ? extcmdContract.requiredNames
      : ["#", "pray"];
    const normalizedRequiredNames = requiredNames
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => value.length > 0);
    const looksValid =
      entries.length >= minEntries &&
      normalizedRequiredNames.every((requiredName) =>
        entries.some((entry) => entry.name === requiredName),
      );
    return looksValid;
  }

  resolveRuntimeExportedPointer(name) {
    if (!name) {
      return null;
    }

    const pointers =
      globalThis.nethackGlobal &&
      globalThis.nethackGlobal.pointers &&
      typeof globalThis.nethackGlobal.pointers === "object"
        ? globalThis.nethackGlobal.pointers
        : null;
    if (!pointers) {
      return null;
    }

    const raw = pointers[name];
    return this.normalizeWasmPointer(raw, {
      label: `exported_pointer_${name}`,
      minBytes: 1,
      alignment: 1,
    });
  }

  readHeapCString(ptr, maxLength = 128) {
    if (
      !this.nethackModule ||
      !Number.isInteger(ptr) ||
      ptr <= 0
    ) {
      return "";
    }

    const normalizedPtr = this.normalizeWasmPointer(ptr, {
      label: "heap_cstring_ptr",
      minBytes: 1,
      alignment: 1,
      enforceBounds: true,
    });
    if (!normalizedPtr) {
      return "";
    }

    let text = "";
    if (typeof this.nethackModule.UTF8ToString === "function") {
      try {
        text = String(this.nethackModule.UTF8ToString(normalizedPtr, maxLength) || "");
      } catch (_error) {
        text = "";
      }
    }
    if (!text && this.nethackModule.HEAPU8) {
      const heap = this.nethackModule.HEAPU8;
      if (normalizedPtr < heap.length) {
        const end = Math.min(heap.length, normalizedPtr + maxLength);
        let fallbackText = "";
        for (let i = normalizedPtr; i < end; i++) {
          const code = heap[i];
          if (code === 0) {
            break;
          }
          fallbackText += String.fromCharCode(code);
        }
        text = fallbackText;
      }
    }
    if (!text) {
      return "";
    }

    const truncated = text.slice(0, maxLength);
    for (let i = 0; i < truncated.length; i += 1) {
      const code = truncated.charCodeAt(i);
      if (code < 32 || code > 126) {
        return "";
      }
    }
    return truncated;
  }

  isLikelyExtendedCommandName(name) {
    return (
      typeof name === "string" &&
      name.length > 0 &&
      name.length <= 32 &&
      /^[A-Za-z0-9_?#-]+$/.test(name)
    );
  }

  getStatusFieldName(field) {
    if (typeof field !== "number") return String(field);
    if (field === -1) {
      return "BL_FLUSH";
    }
    if (field === -2) {
      return "BL_RESET";
    }
    if (field === -3) {
      return "BL_CHARACTERISTICS";
    }
    // Fields 23/24/25 are flush/reset/characteristics signals only in vanilla 3.7.
    // EvilHack uses these indices for real data (BL_LEVELDESC/BL_EXP/BL_CONDITION).
    if (this.runtimeVersion !== "evilhack") {
      if (field === 23) {
        return "BL_FLUSH";
      }
      if (field === 24) {
        return "BL_RESET";
      }
      if (field === 25) {
        return "BL_CHARACTERISTICS";
      }
    }

    const constants =
      globalThis.nethackGlobal && globalThis.nethackGlobal.constants
        ? globalThis.nethackGlobal.constants
        : null;
    if (
      constants &&
      constants.STATUS_FIELD &&
      constants.STATUS_FIELD[field] !== undefined
    ) {
      return String(constants.STATUS_FIELD[field]);
    }

    const fallback = this.getRuntimeStatusFieldMap();
    if (fallback && fallback[field] !== undefined) {
      return String(fallback[field]);
    }

    return `FIELD_${field}`;
  }

  decodeShimArgValue(name, ptrToArg, type) {
    if (
      !this.nethackModule ||
      typeof this.nethackModule.getValue !== "function" ||
      !globalThis.nethackGlobal ||
      !globalThis.nethackGlobal.helpers ||
      typeof globalThis.nethackGlobal.helpers.getPointerValue !== "function"
    ) {
      return null;
    }

    const argPtr = this.nethackModule.getValue(ptrToArg, "*");
    return globalThis.nethackGlobal.helpers.getPointerValue(name, argPtr, type);
  }

  decodeStatusValue(fieldName, ptrToArg) {
    // These are signals, ptrToArg value is not used.
    const signalFields = new Set([
      "BL_RESET",
      "BL_FLUSH",
      "BL_CHARACTERISTICS",
    ]);
    if (signalFields.has(fieldName)) {
      return { value: 0, valueType: "i" };
    }

    if (fieldName === "BL_CONDITION") {
      // This is a pointer to the bitmask value
      try {
        const value = this.nethackModule.getValue(ptrToArg, "i32");
        return { value: value, valueType: "i" };
      } catch (e) {
        console.log(
          `Status int decode failed for ${fieldName} at ptr ${ptrToArg}`,
          e,
        );
        return { value: 0, valueType: "i" };
      }
    }

    // For all other fields, NetHack provides a pre-formatted string.
    try {
      return {
        value: this.nethackModule.UTF8ToString(ptrToArg),
        valueType: "s",
      };
    } catch (e) {
      return { value: "", valueType: "s" };
    }
  }

  normalizeRuntimeInteger(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    const clean = String(value ?? "").trim();
    if (!clean) {
      return null;
    }
    if (/^-?\d+$/.test(clean)) {
      const parsed = Number.parseInt(clean, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  cloneRuntimeValueForSnapshot(value, depth = 0, seen = new WeakSet()) {
    if (value === null || value === undefined) {
      return value ?? null;
    }

    const valueType = typeof value;
    if (
      valueType === "string" ||
      valueType === "number" ||
      valueType === "boolean"
    ) {
      return value;
    }
    if (valueType === "bigint") {
      return String(value);
    }
    if (valueType === "function") {
      const fnName =
        typeof value.name === "string" && value.name.trim()
          ? value.name.trim()
          : "anonymous";
      return `[Function ${fnName}]`;
    }
    if (valueType !== "object") {
      return String(value);
    }
    if (seen.has(value)) {
      return "[Circular]";
    }
    if (depth >= 6) {
      return "[MaxDepth]";
    }

    seen.add(value);

    if (Array.isArray(value)) {
      const maxItems = 300;
      const clonedItems = value
        .slice(0, maxItems)
        .map((item) =>
          this.cloneRuntimeValueForSnapshot(item, depth + 1, seen),
        );
      if (value.length > maxItems) {
        clonedItems.push(`[Truncated ${value.length - maxItems} items]`);
      }
      return clonedItems;
    }

    const output = {};
    const keys = Object.keys(value);
    const maxEntries = 400;
    for (let i = 0; i < keys.length && i < maxEntries; i += 1) {
      const key = keys[i];
      try {
        output[key] = this.cloneRuntimeValueForSnapshot(
          value[key],
          depth + 1,
          seen,
        );
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : String(error);
        output[key] = `[ReadError: ${message}]`;
      }
    }
    if (keys.length > maxEntries) {
      output.__truncatedKeys = keys.length - maxEntries;
    }
    return output;
  }

  buildRuntimeGlobalsSnapshot() {
    const root =
      globalThis.nethackGlobal && typeof globalThis.nethackGlobal === "object"
        ? globalThis.nethackGlobal
        : null;

    if (!root) {
      return {
        capturedAtMs: Date.now(),
        configuredNethackOptions: this.lastConfiguredNethackOptions,
        runtimeVersion: this.runtimeVersion,
        nethackGlobal: null,
      };
    }

    const helperKeys =
      root.helpers && typeof root.helpers === "object"
        ? Object.keys(root.helpers).sort()
        : [];

    const objectTileIndexByObjectId =
      this.buildObjectTileIndexByObjectIdSnapshot();

    return {
      capturedAtMs: Date.now(),
      configuredNethackOptions: this.lastConfiguredNethackOptions,
      runtimeVersion: this.runtimeVersion,
      objectTileIndexByObjectId,
      nethackGlobal: {
        keys: Object.keys(root).sort(),
        globals: this.cloneRuntimeValueForSnapshot(root.globals),
        constants: this.cloneRuntimeValueForSnapshot(root.constants),
        pointers: this.cloneRuntimeValueForSnapshot(root.pointers),
        helperKeys,
      },
    };
  }

  buildObjectTileIndexByObjectIdSnapshot() {
    const root =
      globalThis.nethackGlobal && typeof globalThis.nethackGlobal === "object"
        ? globalThis.nethackGlobal
        : null;
    if (!root) {
      return null;
    }

    const constants =
      root.constants && typeof root.constants === "object"
        ? root.constants
        : null;
    const glyphConstants =
      constants && constants.GLYPH && typeof constants.GLYPH === "object"
        ? constants.GLYPH
        : null;
    if (!glyphConstants) {
      return null;
    }

    const glyphObjOffset = this.normalizeNonNegativeInteger(
      glyphConstants.GLYPH_OBJ_OFF,
    );
    const glyphCmapOffset = this.normalizeNonNegativeInteger(
      glyphConstants.GLYPH_CMAP_OFF,
    );
    if (
      glyphObjOffset === null ||
      glyphCmapOffset === null ||
      glyphCmapOffset <= glyphObjOffset
    ) {
      return null;
    }

    const objectCount = glyphCmapOffset - glyphObjOffset;
    if (objectCount <= 0 || objectCount > 8192) {
      return null;
    }

    const helpers =
      root.helpers && typeof root.helpers === "object" ? root.helpers : null;
    const tileIndexForGlyph =
      helpers && typeof helpers.tileIndexForGlyph === "function"
        ? helpers.tileIndexForGlyph
        : null;
    if (!tileIndexForGlyph) {
      return null;
    }

    const tileIndexes = new Array(objectCount).fill(-1);
    for (let objectId = 0; objectId < objectCount; objectId += 1) {
      const glyph = glyphObjOffset + objectId;
      try {
        const rawTileIndex = tileIndexForGlyph(glyph);
        if (
          typeof rawTileIndex === "number" &&
          Number.isFinite(rawTileIndex) &&
          rawTileIndex >= 0
        ) {
          tileIndexes[objectId] = Math.trunc(rawTileIndex);
        }
      } catch {
        tileIndexes[objectId] = -1;
      }
    }

    return tileIndexes;
  }

  resolveDungeonByIndex(dungeons, dnum) {
    if (Array.isArray(dungeons)) {
      return dungeons[dnum] ?? null;
    }
    if (dungeons && typeof dungeons === "object") {
      if (Object.prototype.hasOwnProperty.call(dungeons, dnum)) {
        return dungeons[dnum];
      }
      const key = String(dnum);
      if (Object.prototype.hasOwnProperty.call(dungeons, key)) {
        return dungeons[key];
      }
    }
    return null;
  }

  resolveRuntimeBranchTag(dnum, topology) {
    if (!topology || typeof topology !== "object") {
      return null;
    }
    const minesDnum = this.normalizeRuntimeInteger(topology.d_mines_dnum);
    const questDnum = this.normalizeRuntimeInteger(topology.d_quest_dnum);
    const sokobanDnum = this.normalizeRuntimeInteger(topology.d_sokoban_dnum);
    const towerDnum = this.normalizeRuntimeInteger(topology.d_tower_dnum);
    const astralDnum = this.normalizeRuntimeInteger(
      topology.d_astral_level?.dnum,
    );

    if (dnum === 0) {
      return "dungeons_of_doom";
    }
    if (dnum === minesDnum) {
      return "mines";
    }
    if (dnum === questDnum) {
      return "quest";
    }
    if (dnum === sokobanDnum) {
      return "sokoban";
    }
    if (dnum === towerDnum) {
      return "vlads_tower";
    }
    if (dnum === astralDnum) {
      return "endgame";
    }
    return null;
  }

  resolveRuntimeLevelIdentity() {
    const globals =
      globalThis.nethackGlobal &&
      globalThis.nethackGlobal.globals &&
      typeof globalThis.nethackGlobal.globals === "object"
        ? globalThis.nethackGlobal.globals
        : null;
    if (!globals) {
      return null;
    }

    try {
      const globalsRoot =
        globals.g && typeof globals.g === "object" ? globals.g : null;
      const u = globals.u ?? globalsRoot?.u;
      const uz = u && typeof u === "object" ? u.uz : null;
      const dnum =
        uz && typeof uz === "object"
          ? this.normalizeRuntimeInteger(uz.dnum)
          : null;
      const dlevel =
        uz && typeof uz === "object"
          ? this.normalizeRuntimeInteger(uz.dlevel)
          : null;
      if (dnum === null || dlevel === null) {
        this.logMissingRuntimeLevelIdentityGlobals(globals);
        return null;
      }

      const dungeons = globals.dungeons ?? globalsRoot?.dungeons;
      const dungeonEntry = this.resolveDungeonByIndex(dungeons, dnum);
      const dungeonName =
        dungeonEntry &&
        typeof dungeonEntry === "object" &&
        typeof dungeonEntry.dname === "string"
          ? dungeonEntry.dname.trim() || null
          : null;
      const ledgerStart =
        dungeonEntry && typeof dungeonEntry === "object"
          ? this.normalizeRuntimeInteger(dungeonEntry.ledger_start)
          : null;
      const depthStart =
        dungeonEntry && typeof dungeonEntry === "object"
          ? this.normalizeRuntimeInteger(dungeonEntry.depth_start)
          : null;

      const ledgerNo =
        ledgerStart !== null ? Math.trunc(dlevel + ledgerStart) : null;
      const depth =
        depthStart !== null ? Math.trunc(depthStart + dlevel - 1) : null;

      const topology =
        globals.dungeon_topology && typeof globals.dungeon_topology === "object"
          ? globals.dungeon_topology
          : globalsRoot?.dungeon_topology &&
              typeof globalsRoot.dungeon_topology === "object"
            ? globalsRoot.dungeon_topology
            : null;
      const branchTag = this.resolveRuntimeBranchTag(dnum, topology);
      return {
        dnum,
        dlevel,
        ledgerNo,
        depth,
        dungeonName,
        branchTag,
      };
    } catch (error) {
      console.log("Failed to resolve runtime level identity:", error);
      return null;
    }
  }

  logMissingRuntimeLevelIdentityGlobals(globals) {
    if (this.didLogMissingLevelIdentityGlobals) {
      return;
    }
    this.didLogMissingLevelIdentityGlobals = true;
    const topLevelKeys =
      globals && typeof globals === "object" ? Object.keys(globals).sort() : [];
    const nestedKeys =
      globals &&
      typeof globals === "object" &&
      globals.g &&
      typeof globals.g === "object"
        ? Object.keys(globals.g).sort()
        : [];
    console.warn(
      "[LEVEL_IDENTITY_DEBUG] Runtime globals missing exported level identity fields (expected u.uz/dungeons/dungeon_topology).",
      {
        topLevelKeys,
        nestedGKeys: nestedKeys,
      },
    );
  }

  shouldUseAllCountForMenuItem(item) {
    if (!item || typeof item.text !== "string") {
      return false;
    }

    const text = item.text.trim();
    if (!text) {
      return false;
    }

    // Common NetHack stacked-item patterns.
    if (/^\d+\s+/.test(text)) {
      return true;
    }
    if (/\(\d+\)\s*$/.test(text)) {
      return true;
    }
    if (/\bgold pieces?\b/i.test(text)) {
      return true;
    }

    return false;
  }

  writeMenuSelectionResult(menuListPtrPtr, selectionCount) {
    if (!this.nethackModule || !menuListPtrPtr) {
      return;
    }

    const normalizedMenuListPtrPtr = this.normalizeWasmPointer(menuListPtrPtr, {
      label: "menu_list_ptr_ptr",
      minBytes: 4,
      alignment: 4,
    });
    if (!normalizedMenuListPtrPtr) {
      console.log(
        `Skipping menu selection write: invalid menuListPtrPtr=${menuListPtrPtr}`,
      );
      return;
    }

    try {
      const selectedItems = Array.from(this.menuSelections.values());
      const menuItemContract = this.getRuntimePointerContract()?.menuItem || {};
      const bytesPerMenuItem = Number(menuItemContract.stride) || 0;
      const countOffset = Number(menuItemContract.countOffset);
      const itemFlagsOffset =
        menuItemContract.itemFlagsOffset === null ||
        menuItemContract.itemFlagsOffset === undefined
          ? null
          : Number(menuItemContract.itemFlagsOffset);
      const canWriteFieldAt = (offset) =>
        Number.isInteger(offset) &&
        offset >= 0 &&
        offset + 4 <= bytesPerMenuItem;
      if (
        !Number.isInteger(bytesPerMenuItem) ||
        bytesPerMenuItem < 8 ||
        !canWriteFieldAt(countOffset)
      ) {
        this.notePointerContractViolation(
          "menu-item-layout-write",
          "menu_item layout is invalid; skipping menu selection write.",
          {
            bytesPerMenuItem,
            countOffset,
            itemFlagsOffset,
          },
        );
        return;
      }

      if (selectionCount <= 0) {
        this.nethackModule.setValue(normalizedMenuListPtrPtr, 0, "*");
        console.log(
          `Menu selection write: cleared output pointer at menuListPtrPtr=${normalizedMenuListPtrPtr}`,
        );
        return;
      }

      const priorOutPtr = this.nethackModule.getValue(
        normalizedMenuListPtrPtr,
        "*",
      );
      // NetHack's select_menu contract makes the caller responsible for
      // freeing any previously returned menu_item array. Do not free a
      // non-zero priorOutPtr here: many call sites free the old buffer but do
      // not null the local afterward, so reclaiming it in the JS bridge would
      // turn a leak into a use-after-free/double-free.
      const outPtr = this.nethackModule._malloc(
        selectionCount * bytesPerMenuItem,
      );
      this.nethackModule.setValue(normalizedMenuListPtrPtr, outPtr, "*");
      if (this.nethackModule.HEAPU8 && bytesPerMenuItem > 0) {
        // Clear all bytes to avoid stale data in optional struct fields.
        this.nethackModule.HEAPU8.fill(
          0,
          outPtr,
          outPtr + selectionCount * bytesPerMenuItem,
        );
      }
      const confirmOutPtr = this.nethackModule.getValue(
        normalizedMenuListPtrPtr,
        "*",
      );
      console.log(
        `Writing ${selectionCount} selections at outPtr=${outPtr} (menuListPtrPtr=${normalizedMenuListPtrPtr}, priorOutPtr=${priorOutPtr}, confirmOutPtr=${confirmOutPtr}, stride=${bytesPerMenuItem}, countOffset=${countOffset}, itemFlagsOffset=${itemFlagsOffset})`,
      );

      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        const structOffset = outPtr + i * bytesPerMenuItem;
        let itemIdentifier =
          typeof item.identifier === "number"
            ? item.identifier
            : item.originalAccelerator;
        if (
          typeof itemIdentifier !== "number" &&
          typeof item.menuChar === "string" &&
          item.menuChar.length === 1
        ) {
          itemIdentifier = item.menuChar.charCodeAt(0);
        }

        if (typeof itemIdentifier !== "number") {
          console.log(
            `Skipping item ${i} because identifier is not numeric:`,
            itemIdentifier,
          );
          continue;
        }

        this.nethackModule.setValue(structOffset, itemIdentifier, "i32");
        // Some ports use -1 for "all" stack count semantics, others accept 1.
        // Default behavior is "auto": stacked items select all by default.
        const countMode = process.env.NH_MENU_COUNT_MODE || "auto";
        const useAllCount =
          countMode === "all" ||
          (countMode === "auto" && this.shouldUseAllCountForMenuItem(item));
        const explicitCount =
          Number.isFinite(item?.count) && Number(item.count) > 0
            ? Math.trunc(Number(item.count))
            : null;
        const countValue =
          explicitCount !== null ? explicitCount : useAllCount ? -1 : 1;

        this.nethackModule.setValue(structOffset + countOffset, countValue, "i32");
        if (itemFlagsOffset !== null && canWriteFieldAt(itemFlagsOffset)) {
          this.nethackModule.setValue(structOffset + itemFlagsOffset, 0, "i32");
        }
        const debugItem = this.nethackModule.getValue(structOffset, "i32");
        const debugCountPrimary = canWriteFieldAt(countOffset)
          ? this.nethackModule.getValue(
              structOffset + countOffset,
              "i32",
            )
          : null;
        const debugItemFlags =
          itemFlagsOffset !== null &&
          canWriteFieldAt(itemFlagsOffset)
            ? this.nethackModule.getValue(structOffset + itemFlagsOffset, "i32")
            : null;
        console.log(
          `Wrote menu_item[${i}] => item=${debugItem}, countPrimary=${debugCountPrimary}, itemFlags=${debugItemFlags}, countMode=${countMode}, countValue=${countValue}`,
        );
      }
      const dumpBytes = Math.min(selectionCount * bytesPerMenuItem, 64);
      const dump = [];
      for (let i = 0; i < dumpBytes; i++) {
        const b = this.nethackModule.getValue(outPtr + i, "i8") & 0xff;
        dump.push(b.toString(16).padStart(2, "0"));
      }
      console.log(
        `menu_item buffer dump (${dumpBytes} bytes): ${dump.join(" ")}`,
      );
    } catch (error) {
      console.log("Error writing selections to NetHack memory:", error);
    }
  }

  resolveWasmAssetUrl(assetPath, runtimeVersion = this.runtimeVersion) {
    const normalizedAsset = String(assetPath || "").replace(/^\/+/, "");
    const baseUrl =
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      typeof import.meta.env.BASE_URL === "string"
        ? import.meta.env.BASE_URL
        : "/";

    // In packaged Electron (file://), Vite worker bundles are emitted into
    // dist/assets while wasm files are copied to dist/. A BASE_URL of "./"
    // would otherwise resolve relative to dist/assets and miss the wasm file.
    const workerLocationHref =
      typeof globalThis !== "undefined" &&
      globalThis.location &&
      typeof globalThis.location.href === "string"
        ? globalThis.location.href
        : "";
    const isFileWorker = workerLocationHref.startsWith("file:");
    if (isFileWorker && (baseUrl === "./" || baseUrl === ".")) {
      try {
        return this.appendRuntimeBuildTagToUrl(
          new URL(`../${normalizedAsset}`, workerLocationHref).toString(),
          runtimeVersion,
        );
      } catch {
        // Fall through to default base handling.
      }
    }

    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return this.appendRuntimeBuildTagToUrl(
      `${normalizedBase}${normalizedAsset}`,
      runtimeVersion,
    );
  }

  clearStartupNoCallbackTimer() {
    if (this.startupNoCallbackTimer !== null) {
      clearTimeout(this.startupNoCallbackTimer);
      this.startupNoCallbackTimer = null;
    }
  }

  scheduleStartupNoCallbackDiagnostic() {
    this.clearStartupNoCallbackTimer();
    if (this.uiCallbackCount > 0 || this.isClosed) {
      return;
    }
    this.startupNoCallbackTimer = setTimeout(() => {
      this.startupNoCallbackTimer = null;
      if (this.uiCallbackCount > 0 || this.isClosed) {
        return;
      }
      const helpers =
        globalThis.nethackGlobal && globalThis.nethackGlobal.helpers
          ? globalThis.nethackGlobal.helpers
          : null;
      const globals =
        globalThis.nethackGlobal && globalThis.nethackGlobal.globals
          ? globalThis.nethackGlobal.globals
          : null;
      const helperNames = helpers ? Object.keys(helpers) : [];
      const windowInited =
        globals &&
        globals.iflags &&
        typeof globals.iflags.window_inited !== "undefined"
          ? globals.iflags.window_inited
          : null;

      console.warn(
        "No shim UI callbacks received after startup. Runtime may be using a non-shim window port (for example tty), or callback wiring is broken.",
      );
      console.warn("Startup diagnostics:", {
        runtimeVersion: this.runtimeVersion,
        configuredNethackOptions: this.lastConfiguredNethackOptions,
        helperCount: helperNames.length,
        helperNamesSample: helperNames.slice(0, 12),
        windowInited,
      });
    }, 3000);
  }

  async initializeNetHack() {
    try {
      console.log("Starting local NetHack session...");

      globalThis.nethackCallback = async (name, ...args) => {
        // Lightweight ring-buffer of recent callback names for hang diagnosis.
        const ring = ((globalThis as any).__nh_cb_ring ||= []);
        ring.push({ t: performance.now(), name });
        if (ring.length > 200) ring.shift();
        (globalThis as any).__nh_cb_total =
          ((globalThis as any).__nh_cb_total || 0) + 1;
        return this.handleUICallback(name, args);
      };

      this.runtimeVersion = this.normalizeRuntimeVersion(
        this.startupOptions?.runtimeVersion,
      );

      /** @type {NethackRuntimeVersion} */
      const runtimeVersion = this.normalizeRuntimeVersion(
        this.startupOptions?.runtimeVersion,
      );
      const wasmAssetPath = this.getRuntimeWasmAssetPath(runtimeVersion);
      const startupHookLabel = `[WASM startup:${runtimeVersion}]`;
      let startupModule = null;
      let lastObservedRunDependencyCount = Number.NaN;
      const listDirectoryEntries = (mod, dirPath) => {
        if (!mod?.FS || typeof mod.FS.readdir !== "function") {
          return null;
        }
        try {
          return mod.FS
            .readdir(dirPath)
            .filter((entry) => entry !== "." && entry !== "..")
            .slice(0, 20);
        } catch (error) {
          return [`readdir-error:${String(error ?? "")}`];
        }
      };
      const summarizeModuleState = (mod) => {
        const activeModule = mod || startupModule;
        if (!activeModule) {
          return {
            hasModule: false,
          };
        }
        let cwd = null;
        if (activeModule.FS && typeof activeModule.FS.cwd === "function") {
          try {
            cwd = activeModule.FS.cwd();
          } catch (error) {
            cwd = `cwd-error:${String(error ?? "")}`;
          }
        }
        return {
          hasModule: true,
          hasFS: Boolean(activeModule.FS),
          hasIDBFS: Boolean(
            activeModule.IDBFS || activeModule.FS?.filesystems?.IDBFS,
          ),
          cwd,
          runDependencies: Number.isFinite(Number(activeModule.runDependencies))
            ? Number(activeModule.runDependencies)
            : null,
          calledRun:
            typeof activeModule.calledRun === "boolean"
              ? activeModule.calledRun
              : null,
        };
      };
      const logStartupHook = (hookName, mod, extraDetails = null) => {
        console.log(`${startupHookLabel} ${hookName}`, {
          ...summarizeModuleState(mod),
          ...(extraDetails && typeof extraDetails === "object"
            ? extraDetails
            : {}),
        });
      };

      if (!globalThis.nethackGlobal) {
        const runtimeWindowGlobals =
          this.getDefaultRuntimeWindowGlobals(runtimeVersion);
        globalThis.nethackGlobal = {
          constants: {
            WIN_TYPE: this.getRuntimeWindowTypeLabels(runtimeVersion),
            STATUS_FIELD: {},
            MENU_SELECT: { PICK_NONE: 0, PICK_ONE: 1, PICK_ANY: 2 },
          },
          helpers: {
            getPointerValue: (name, ptr, type) => {
              if (!this.nethackModule) {
                return ptr;
              }

              switch (type) {
                case "s":
                  if (!ptr) return "";
                  return this.nethackModule.UTF8ToString(ptr);
                case "p":
                  if (!ptr) return 0;
                  return this.nethackModule.getValue(ptr, "*");
                case "c":
                  return String.fromCharCode(
                    this.nethackModule.getValue(ptr, "i8"),
                  );
                case "b":
                  return this.nethackModule.getValue(ptr, "i8") !== 0;
                case "0":
                  return this.nethackModule.getValue(ptr, "i8");
                case "1":
                  return this.nethackModule.getValue(ptr, "i16");
                case "2":
                case "i":
                case "n":
                  return this.nethackModule.getValue(ptr, "i32");
                case "f":
                  return this.nethackModule.getValue(ptr, "float");
                case "d":
                  return this.nethackModule.getValue(ptr, "double");
                case "o":
                  return ptr;
                default:
                  return ptr;
              }
            },
            setPointerValue: (name, ptr, type, value = 0) => {
              if (!this.nethackModule) {
                return;
              }

              switch (type) {
                case "p":
                  this.nethackModule.setValue(ptr, value, "*");
                  break;
                case "s":
                  this.nethackModule.stringToUTF8(String(value), ptr, 1024);
                  break;
                case "i":
                  this.nethackModule.setValue(ptr, value, "i32");
                  break;
                case "1":
                  this.nethackModule.setValue(ptr, value, "i16");
                  break;
                case "c":
                  this.nethackModule.setValue(ptr, value, "i8");
                  break;
                case "b":
                  this.nethackModule.setValue(ptr, value ? 1 : 0, "i8");
                  break;
                case "f":
                case "d":
                  this.nethackModule.setValue(ptr, value, "double");
                  break;
                case "v":
                  break;
                default:
                  break;
              }
            },
          },
          globals: runtimeWindowGlobals,
        };
      }
      this.seedRuntimeStatusFieldConstants();

      const runtimeOptions = getAutomaticRuntimeInitOptionTokens(runtimeVersion);
      const characterRuntimeOptions =
        this.buildCharacterCreationRuntimeOptions();
      if (characterRuntimeOptions.length > 0) {
        runtimeOptions.push(...characterRuntimeOptions);
      }
      const startupInitRuntimeOptions = this.buildStartupInitRuntimeOptions();
      if (startupInitRuntimeOptions.length > 0) {
        runtimeOptions.push(...startupInitRuntimeOptions);
      }
      // NetHack parses NETHACKOPTIONS right-to-left, so put windowtype last
      // to ensure it is applied first.
      runtimeOptions.push("windowtype:shim");
      const checkpointStartupOptionEnabled = runtimeOptions.includes("checkpoint");
      if (runtimeOptions.includes("checkpoint")) {
        console.log("Checkpoint startup option is enabled.");
      }

      const resolvedWasmAssetUrl = this.resolveWasmAssetUrl(
        wasmAssetPath,
        runtimeVersion,
      );
      console.log("Resolved NetHack wasm asset URL", {
        runtimeVersion,
        wasmAssetPath,
        resolvedWasmAssetUrl,
        runtimeBuildTag: this.readRuntimeBuildTag(runtimeVersion) || null,
      });

      const createModule = await this.loadRuntimeFactory(runtimeVersion);

      console.log("About to call createModule", {
        runtimeVersion,
        createModuleType: typeof createModule,
        createModuleIsFunction: typeof createModule === "function",
      });

      this.nethackInstance = await createModule({
        noInitialRun: true,
        preInit: [
          (mod) => {
            startupModule = mod || startupModule;
            logStartupHook("preInit", mod, {
              rootEntries: listDirectoryEntries(mod, "/"),
              saveEntries: listDirectoryEntries(mod, "/save"),
            });
          },
        ],
        locateFile: (assetPath) => {
          const resolvedAssetPath = assetPath.endsWith(".wasm")
            ? resolvedWasmAssetUrl
            : this.resolveWasmAssetUrl(assetPath, runtimeVersion);
          logStartupHook("locateFile", startupModule, {
            assetPath,
            resolvedAssetPath,
          });
          return resolvedAssetPath;
        },
        stdin: () => this.consumeStdinByte(),
        print: (...args) => {
          console.log("[WASM stdout]", ...args);
        },
        printErr: (...args) => {
          console.warn("[WASM stderr]", ...args);
        },
        quit: (status, toThrow) => {
          const exitCode = Number.isFinite(status) ? Number(status) : 0;
          const exitReason =
            toThrow && typeof toThrow === "object" && toThrow.message
              ? String(toThrow.message)
              : `Program terminated with exit(${exitCode})`;
          logStartupHook("quit", startupModule, {
            exitCode,
            exitReason,
          });

          this.emitRuntimeTerminated(exitReason, exitCode);

          if (toThrow) {
            throw toThrow; // Emscripten expects this exception to unwind its execution stack
          }
        },
        onExit: (status) => {
          const exitCode = Number.isFinite(status) ? Number(status) : 0;
          logStartupHook("onExit", startupModule, {
            exitCode,
          });

          this.emitRuntimeTerminated(
            `Program terminated with exit(${exitCode})`,
            exitCode,
          );
        },
        onAbort: (reason) => {
          const errorText =
            typeof reason === "string" && reason.trim()
              ? reason.trim()
              : String(reason ?? "Runtime aborted");
          logStartupHook("onAbort", startupModule, {
            reason: errorText,
          });
          this.emit({
            type: "runtime_error",
            error: errorText,
          });
        },
        monitorRunDependencies: (remainingDependencies) => {
          const normalizedRemaining = Number(remainingDependencies);
          if (normalizedRemaining === lastObservedRunDependencyCount) {
            return;
          }
          lastObservedRunDependencyCount = normalizedRemaining;
          logStartupHook("runDependencies", startupModule, {
            remainingDependencies: Number.isFinite(normalizedRemaining)
              ? normalizedRemaining
              : remainingDependencies,
          });
        },
        onRuntimeInitialized: () => {
          logStartupHook("onRuntimeInitialized", startupModule, {
            rootEntries: listDirectoryEntries(startupModule, "/"),
            saveEntries: listDirectoryEntries(startupModule, "/save"),
          });
        },
        preRun: [
          (mod) => {
            startupModule = mod || startupModule;
            logStartupHook("preRun:start", mod, {
              rootEntries: listDirectoryEntries(mod, "/"),
              saveEntries: listDirectoryEntries(mod, "/save"),
            });
            mod.ENV = mod.ENV || {};
            const existingOptions =
              typeof mod.ENV.NETHACKOPTIONS === "string"
                ? mod.ENV.NETHACKOPTIONS.trim()
                : "";
            mod.ENV.NETHACKOPTIONS = existingOptions
              ? `${existingOptions},${runtimeOptions.join(",")}`
              : runtimeOptions.join(",");
            // EvilHack reads EVILHACKOPTIONS (fallback HACKOPTIONS) rather than
            // NETHACKOPTIONS, so mirror the same string under those names too.
            mod.ENV.EVILHACKOPTIONS = mod.ENV.NETHACKOPTIONS;
            mod.ENV.HACKOPTIONS = mod.ENV.NETHACKOPTIONS;
            this.lastConfiguredNethackOptions = mod.ENV.NETHACKOPTIONS;
            console.log(`Configured NETHACKOPTIONS // EVILHACKOPTIONS: ${mod.ENV.EVILHACKOPTIONS}`);

            // Ensure NetHack chdirs into a valid data root inside the wasm FS.
            // If HACKDIR/NETHACKDIR points at a host path, main() will abort
            // before js_helpers_init/js_constants_init run.
            const fallbackHackDir = "/";
            if (!mod.ENV.HACKDIR) {
              mod.ENV.HACKDIR = fallbackHackDir;
            }
            if (!mod.ENV.NETHACKDIR) {
              mod.ENV.NETHACKDIR = fallbackHackDir;
            }
            const resolvedHackDir = mod.ENV.NETHACKDIR || mod.ENV.HACKDIR;
            logStartupHook("preRun:env-configured", mod, {
              resolvedHackDir,
              configuredNethackOptions: mod.ENV.NETHACKOPTIONS,
            });
            if (mod.FS && typeof mod.FS.analyzePath === "function") {
              const exists = mod.FS.analyzePath(resolvedHackDir).exists;
              if (!exists) {
                console.warn(
                  `HACKDIR/NETHACKDIR does not exist in wasm FS: ${resolvedHackDir}`,
                );
              }
            }

            // Slash'EM 3.4.3 still uses Unix hard-link lock files.
            // Browser-backed FS implementations can reject link() with EMLINK,
            // so install a narrow fallback before startup touches perm_lock.
            this.patchSlashEmLockLinkFallback(mod);
            logStartupHook("preRun:slash-em-lock-hook", mod, {
              lockFallbackInstalled: Boolean(
                mod.FS?.__nh3dSlashEmLockLinkFallbackPatched,
              ),
            });

            // EvilHack 0.9.3 currently hangs in a tight openat() loop after
            // shim_display_file("news") (suspected load_qtlist / mklev path).
            // Install a narrow FS.open instrumentation that:
            //   - logs the first few unique paths opened (one line per path)
            //   - detects "spin" patterns (>=8 opens of same path within 500ms)
            //     and logs a single warning per path
            // Never touches Module.Asyncify. EvilHack-only to keep other
            // runtimes quiet.
            if (
              runtimeVersion === "evilhack" &&
              mod.FS &&
              typeof mod.FS.open === "function" &&
              !mod.FS.__nh3dEvilHackOpenProbeInstalled
            ) {
              const originalOpen = mod.FS.open.bind(mod.FS);
              const seenPaths = new Set<string>();
              const recentOpens = new Map<
                string,
                { count: number; windowStartMs: number; reported: boolean }
              >();
              const MAX_LOGGED_UNIQUE = 80;
              const SPIN_WINDOW_MS = 500;
              const SPIN_THRESHOLD = 8;
              let totalOpens = 0;

              mod.FS.open = function (
                path: string,
                ...args: unknown[]
              ): unknown {
                totalOpens += 1;
                const pathStr = typeof path === "string" ? path : String(path);
                if (
                  seenPaths.size < MAX_LOGGED_UNIQUE &&
                  !seenPaths.has(pathStr)
                ) {
                  seenPaths.add(pathStr);
                  console.log(
                    `[EVILHACK_FS_OPEN #${totalOpens}] path="${pathStr}"`,
                  );
                }
                const nowMs =
                  typeof performance !== "undefined" &&
                  typeof performance.now === "function"
                    ? performance.now()
                    : Date.now();
                let bucket = recentOpens.get(pathStr);
                if (!bucket || nowMs - bucket.windowStartMs > SPIN_WINDOW_MS) {
                  bucket = { count: 1, windowStartMs: nowMs, reported: false };
                  recentOpens.set(pathStr, bucket);
                } else {
                  bucket.count += 1;
                  if (bucket.count >= SPIN_THRESHOLD && !bucket.reported) {
                    bucket.reported = true;
                    console.warn(
                      `[EVILHACK_FS_OPEN_SPIN] path="${pathStr}" opened ${bucket.count}x within ${Math.round(
                        nowMs - bucket.windowStartMs,
                      )}ms (total opens so far: ${totalOpens})`,
                    );
                  }
                }
                return originalOpen(path, ...(args as []));
              };
              mod.FS.__nh3dEvilHackOpenProbeInstalled = true;
              logStartupHook("preRun:evilhack-fs-open-probe", mod, {
                maxLoggedUnique: MAX_LOGGED_UNIQUE,
                spinThreshold: SPIN_THRESHOLD,
                spinWindowMs: SPIN_WINDOW_MS,
              });
            }

            // Setup IndexedDB file system for persisting saves
            const IDBFS =
              mod.FS && mod.FS.filesystems && mod.FS.filesystems.IDBFS
                ? mod.FS.filesystems.IDBFS
                : mod.IDBFS;
            if (mod.FS && IDBFS) {
              // Dynamically locate the CWD so we mount IDBFS exactly where NetHack writes
              const cwd = mod.FS.cwd();
              const saveDir = getRuntimeSaveMountDir(runtimeVersion, cwd);
              const saveDbName = getRuntimeSaveDbName(runtimeVersion, cwd);
              const checkpointLevelFilePattern = /^[^/\\]+\.\d+$/;
              const normalizedCwd = cwd.replace(/\/+$/, "") || "/";
              const normalizedSaveDir =
                saveDir.replace(/\/+$/, "") ||
                getRuntimeSaveMountDir(runtimeVersion);

              const patchIdbfsDbNameResolution = () => {
                if (!IDBFS || typeof IDBFS.getDB !== "function") {
                  return;
                }
                if (!(IDBFS.__nh3dDbNameByMountPoint instanceof Map)) {
                  IDBFS.__nh3dDbNameByMountPoint = new Map();
                }
                IDBFS.__nh3dDbNameByMountPoint.set(saveDir, saveDbName);
                if (IDBFS.__nh3dGetDbPatched) {
                  return;
                }
                const originalGetDb = IDBFS.getDB.bind(IDBFS);
                IDBFS.getDB = function (name, callback) {
                  const mappedName =
                    this.__nh3dDbNameByMountPoint instanceof Map
                      ? this.__nh3dDbNameByMountPoint.get(name) || name
                      : name;
                  return originalGetDb(mappedName, callback);
                };
                IDBFS.__nh3dGetDbPatched = true;
              };
              patchIdbfsDbNameResolution();

              if (!mod.FS.analyzePath(saveDir).exists) {
                try {
                  mod.FS.mkdir(saveDir);
                } catch (e) {
                  console.warn(`Failed to create ${saveDir}`, e);
                }
              }

              let scheduleCheckpointSync = () => {};
              if (checkpointStartupOptionEnabled) {
                // NetHack checkpointing writes level snapshots as
                // "<lockname>.<level>" in the current working directory.
                // Redirect those files into IDBFS only for runtimes that
                // explicitly opted into checkpoint mode.
                const remapCheckpointLevelPath = (rawPath) => {
                  if (typeof rawPath !== "string" || !rawPath) {
                    return rawPath;
                  }

                  const slashNormalized = rawPath.replace(/\\/g, "/").trim();
                  if (!slashNormalized) {
                    return rawPath;
                  }
                  const withoutDotPrefix = slashNormalized.startsWith("./")
                    ? slashNormalized.slice(2)
                    : slashNormalized;

                  const lastSlashIndex = withoutDotPrefix.lastIndexOf("/");
                  const baseName =
                    lastSlashIndex >= 0
                      ? withoutDotPrefix.slice(lastSlashIndex + 1)
                      : withoutDotPrefix;
                  if (!checkpointLevelFilePattern.test(baseName)) {
                    return rawPath;
                  }

                  if (withoutDotPrefix.startsWith(`${normalizedSaveDir}/`)) {
                    return rawPath;
                  }

                  let shouldRemap = false;
                  if (lastSlashIndex < 0) {
                    shouldRemap = true;
                  } else {
                    const parentPath =
                      withoutDotPrefix.slice(0, lastSlashIndex) || "/";
                    if (
                      parentPath === "/" ||
                      parentPath === normalizedCwd ||
                      parentPath === "."
                    ) {
                      shouldRemap = true;
                    }
                  }

                  if (!shouldRemap) {
                    return rawPath;
                  }

                  const remappedPath = `${normalizedSaveDir}/${baseName}`;
                  if (remappedPath !== rawPath) {
                    console.log(
                      `Remapping checkpoint level file path: ${rawPath} -> ${remappedPath}`,
                    );
                  }
                  return remappedPath;
                };

                const wrapFsPathMethod = (methodName) => {
                  const originalMethod = mod.FS[methodName];
                  if (typeof originalMethod !== "function") {
                    return;
                  }
                  mod.FS[methodName] = function (path, ...args) {
                    return originalMethod.call(
                      this,
                      remapCheckpointLevelPath(path),
                      ...args,
                    );
                  };
                };
                wrapFsPathMethod("open");
                wrapFsPathMethod("unlink");
              }

              const originalSyncfs =
                typeof mod.FS.syncfs === "function"
                  ? mod.FS.syncfs.bind(mod.FS)
                  : null;
              if (originalSyncfs) {
                const syncfsQueue = [];
                let syncfsInFlight = false;

                const queueSyncfs = (populate, callback) => {
                  syncfsQueue.push({
                    populate: Boolean(populate),
                    callback: typeof callback === "function" ? callback : null,
                  });
                  if (syncfsInFlight) {
                    return;
                  }

                  const runNext = () => {
                    const next = syncfsQueue.shift();
                    if (!next) {
                      syncfsInFlight = false;
                      return;
                    }
                    syncfsInFlight = true;
                    originalSyncfs(next.populate, (err) => {
                      try {
                        if (next.callback) {
                          next.callback(err);
                        }
                      } finally {
                        runNext();
                      }
                    });
                  };

                  runNext();
                };

                mod.FS.syncfs = function (populateOrCallback, maybeCallback) {
                  if (typeof populateOrCallback === "function") {
                    queueSyncfs(false, populateOrCallback);
                    return;
                  }
                  queueSyncfs(populateOrCallback, maybeCallback);
                };
              }

              if (checkpointStartupOptionEnabled) {
                let checkpointSyncInFlight = false;
                let checkpointSyncQueued = false;
                let checkpointSyncTimer = 0;
                const checkpointSyncDebounceMs = 150;
                const flushCheckpointSync = () => {
                  if (checkpointSyncInFlight) {
                    checkpointSyncQueued = true;
                    return;
                  }
                  checkpointSyncInFlight = true;
                  mod.FS.syncfs(false, (err) => {
                    if (err) {
                      console.warn("IDBFS checkpoint sync error:", err);
                    }
                    checkpointSyncInFlight = false;
                    if (checkpointSyncQueued) {
                      checkpointSyncQueued = false;
                      flushCheckpointSync();
                    }
                  });
                };
                scheduleCheckpointSync = () => {
                  if (checkpointSyncTimer) {
                    clearTimeout(checkpointSyncTimer);
                  }
                  checkpointSyncTimer = globalThis.setTimeout(() => {
                    checkpointSyncTimer = 0;
                    flushCheckpointSync();
                  }, checkpointSyncDebounceMs);
                };

                const originalClose = mod.FS.close;
                if (typeof originalClose === "function") {
                  mod.FS.close = function (stream, ...args) {
                    const streamPath =
                      stream && typeof stream.path === "string"
                        ? stream.path
                        : "";
                    const shouldSyncCheckpoint =
                      streamPath.startsWith(`${normalizedSaveDir}/`) &&
                      /\/[^/]+\.\d+$/.test(streamPath);
                    const result = originalClose.call(this, stream, ...args);
                    if (shouldSyncCheckpoint) {
                      scheduleCheckpointSync();
                    }
                    return result;
                  };
                }
              }

              try {
                mod.FS.mount(IDBFS, { dbName: saveDbName }, saveDir);
                logStartupHook("preRun:idbfs-mounted", mod, {
                  saveDir,
                  saveDbName,
                  rootEntries: listDirectoryEntries(mod, "/"),
                  saveEntries: listDirectoryEntries(mod, saveDir),
                });
                mod.addRunDependency("idbfs_sync");
                mod.FS.syncfs(true, (err) => {
                  if (err) {
                    console.warn("IDBFS load syncfs error:", err);
                    logStartupHook("preRun:idbfs-sync-error", mod, {
                      saveDir,
                      saveDbName,
                      error:
                        err instanceof Error && err.message
                          ? err.message
                          : String(err ?? ""),
                    });
                    mod.removeRunDependency("idbfs_sync");
                    return;
                  }

                  console.log(`IDBFS mounted and synced at ${saveDir}`);
                  logStartupHook("preRun:idbfs-synced", mod, {
                    saveDir,
                    saveDbName,
                    rootEntries: listDirectoryEntries(mod, "/"),
                    saveEntries: listDirectoryEntries(mod, saveDir),
                  });
                  try {
                    const sysconfPath = "/sysconf";
                    if (
                      mod.FS.analyzePath(sysconfPath).exists &&
                      typeof mod.FS.readFile === "function"
                    ) {
                      const sysconfRaw = String(
                        mod.FS.readFile(sysconfPath, { encoding: "utf8" }) || "",
                      );
                      const maxPlayersLine =
                        sysconfRaw
                          .split(/\r?\n/)
                          .find((line) => /^MAXPLAYERS=/i.test(line.trim())) ||
                        "";
                      if (maxPlayersLine) {
                        console.log(
                          `Embedded runtime sysconf ${maxPlayersLine.trim()}`,
                        );
                      }
                    }
                  } catch (error) {
                    console.warn("Failed to inspect embedded /sysconf:", error);
                  }
                  const removedCheckpointShardCount =
                    this.cleanupStaleCheckpointShardsBeforeStartup(
                      mod,
                      saveDir,
                    );
                  const removedTemporaryLockShardCount =
                    this.cleanupStaleTemporaryRuntimeLocksBeforeStartup(
                      mod,
                      saveDir,
                    );
                  const removedRecoverableSaveArtifactCount =
                    this.removeStaleRecoverableSaveArtifactsBeforeAutosaveResume(
                      mod,
                      saveDir,
                    );
                  if (
                    removedCheckpointShardCount +
                      removedTemporaryLockShardCount +
                      removedRecoverableSaveArtifactCount >
                    0
                  ) {
                    mod.FS.syncfs(false, (syncErr) => {
                      if (syncErr) {
                        console.warn(
                          "IDBFS stale checkpoint cleanup sync error:",
                          syncErr,
                        );
                      }
                      mod.removeRunDependency("idbfs_sync");
                    });
                    return;
                  }

                  mod.removeRunDependency("idbfs_sync");
                });
              } catch (e) {
                console.warn(`Failed to mount IDBFS at ${saveDir}`, e);
                logStartupHook("preRun:idbfs-mount-error", mod, {
                  saveDir,
                  saveDbName,
                  error:
                    e instanceof Error && e.message
                      ? e.message
                      : String(e ?? ""),
                });
              }
            }
            logStartupHook("preRun:complete", mod, {
              rootEntries: listDirectoryEntries(mod, "/"),
              saveEntries: listDirectoryEntries(mod, "/save"),
            });
          },
        ],
        postRun: [
          (mod) => {
            startupModule = mod || startupModule;
            logStartupHook("postRun", mod, {
              rootEntries: listDirectoryEntries(mod, "/"),
              saveEntries: listDirectoryEntries(mod, "/save"),
            });
          },
        ],
      });

      startupModule = this.nethackInstance;
      logStartupHook("module-ready", this.nethackInstance, {
        rootEntries: listDirectoryEntries(this.nethackInstance, "/"),
        saveEntries: listDirectoryEntries(this.nethackInstance, "/save"),
        hasMain: typeof this.nethackInstance?._main === "function",
        hasSetCallback:
          typeof this.nethackInstance?._shim_graphics_set_callback ===
          "function",
      });
      this.nethackModule = this.nethackInstance;
      this.runtimePointerContract = null;
      this.runtimePointerContractValidated = false;
      this.updateCheckpointRecoverySupport();

      // Register the UI callback and start the game loop
      const setCallback = this.nethackInstance.cwrap(
        "shim_graphics_set_callback",
        null,
        ["string"],
      );
      console.log("Registering shim callback", {
        callbackName: "nethackCallback",
        callbackType: typeof globalThis.nethackCallback,
      });
      setCallback("nethackCallback");
      console.log("shim_graphics_set_callback invoked");

      // NetHack's generated helper may reject "v" (void) arg types in
      // local_callback argument decoding (observed in shim_get_ext_cmd).
      // Treat those as a no-op value to avoid worker crashes.
      this.installHelperCompatibilityShims();
      this.validateRuntimePointerContract();

      // Start the game — ASYNCIFY pauses/resumes at each async callback boundary.
      // Pass a valid argc/argv block instead of _main(0, 0) to avoid undefined
      // behavior in main() when it reads argv[0].
      this.queueCheckpointAutosaveResumeBeforeStartup();
      const programName = "nethack";
      const argv0Ptr = this.nethackInstance._malloc(programName.length + 1);
      this.nethackInstance.stringToUTF8(
        programName,
        argv0Ptr,
        programName.length + 1,
      );
      const argvPtr = this.nethackInstance._malloc(8);
      this.nethackInstance.setValue(argvPtr, argv0Ptr, "*");
      this.nethackInstance.setValue(argvPtr + 4, 0, "*");
      logStartupHook("before-main", this.nethackInstance, {
        argc: 1,
        argv0: programName,
        rootEntries: listDirectoryEntries(this.nethackInstance, "/"),
        saveEntries: listDirectoryEntries(this.nethackInstance, "/save"),
      });
      const mainReturn = this.nethackInstance._main(1, argvPtr);
      const helperNamesAfterMain =
        globalThis.nethackGlobal && globalThis.nethackGlobal.helpers
          ? Object.keys(globalThis.nethackGlobal.helpers)
          : [];
      console.log("NetHack _main invoked", {
        returnValue: mainReturn,
        argc: 1,
        argv0: programName,
        helperCountAfterMain: helperNamesAfterMain.length,
        helperNamesSample: helperNamesAfterMain.slice(0, 12),
      });
      this.scheduleStartupNoCallbackDiagnostic();
    } catch (error) {
      console.error("Error initializing local NetHack:", error);
      throw error;
    }
  }

  installHelperCompatibilityShims() {
    if (
      !globalThis.nethackGlobal ||
      !globalThis.nethackGlobal.helpers ||
      typeof globalThis.nethackGlobal.helpers.getPointerValue !== "function"
    ) {
      return;
    }

    const helpers = globalThis.nethackGlobal.helpers;
    const existing = helpers.getPointerValue;
    if (existing && existing.__nh3dVoidCompatPatched) {
      return;
    }

    const wrapped = (name, ptr, type) => {
      if (type === "v") {
        return 0;
      }
      return existing(name, ptr, type);
    };
    wrapped.__nh3dVoidCompatPatched = true;
    helpers.getPointerValue = wrapped;
  }

  waitForQuestionInput() {
    // A question prompt consumes single-key answers; queued extended command
    // triggers are stale in this mode and can poison later command dispatch.
    this.resolvePendingExtendedCommandRequest(-1);
    this.clearQueuedExtendedCommandSubmission("question input requested");
    this.awaitingQuestionInput = true;
    const requested = this.requestInputCode("event");
    if (requested && typeof requested.then === "function") {
      return requested.finally(() => {
        this.awaitingQuestionInput = false;
      });
    }
    this.awaitingQuestionInput = false;
    return requested;
  }

  handleShimGetNhEvent() {
    // NetHack's get_nh_event is a non-blocking event pump hook.
    // It should not consume command input; nh_poskey/nhgetch own key waits.
    return 0;
  }

  handleShimNhGetch() {
    return this.requestInputCode("event");
  }

  handleShimYnFunction(args) {
    const [question, choices, defaultChoice] = args;
    const normalizedChoices =
      typeof choices === "string" ? choices : String(choices ?? "");
    const normalizedDefaultChoice =
      typeof defaultChoice === "number" && Number.isFinite(defaultChoice)
        ? Math.trunc(defaultChoice)
        : 0;
    console.log(
      `Y/N Question: "${question}" choices: "${choices}" default: ${defaultChoice}`,
    );

    this.lastQuestionText = question;
    this.activeYnPrompt = null;
    this.pendingGameOverPossessionsInventoryFlow =
      this.isGameOverPossessionsIdentifyQuestion(question);
    if (this.pendingGameOverPossessionsInventoryFlow) {
      this.beginGameOverSequence("possessions-question");
    }

    if (this.shouldAutoRecoverCheckpointResume(question)) {
      // Autosave rows in the load-game UI represent explicit recovery of
      // checkpoint-only runs. Once the wasm package exposes a full browser-side
      // checkpoint resume bridge, accept NetHack's follow-up recover prompt
      // automatically so resume goes straight into the recovered save without
      // asking the player twice.
      const recoveryChoice = /r/i.test(normalizedChoices) ? "r" : "y";
      console.log(
        `Auto-confirming checkpoint recovery with "${recoveryChoice}" during autosave resume`,
      );
      return this.processKey(recoveryChoice);
    }

    if (this.shouldAutoConfirmCheckpointCleanup(question)) {
      // Unsupported wasm builds cannot recover checkpoint shards into a proper
      // save file. For those builds, auto-confirm stale cleanup during
      // fresh-game startup instead of surfacing an unusable prompt.
      console.log(
        'Auto-confirming stale checkpoint cleanup with "y" during fresh-game startup',
      );
      return this.processKey("y");
    }

    if (this.isContainerLootTypeQuestion(question)) {
      console.log('Auto-answering container loot type question with "a"');
      return this.processKey("a");
    }

    const legacyAutoHelpYnPromptAnswer =
      this.resolveLegacyAutoHelpYnPromptAnswer(question, normalizedChoices);
    if (legacyAutoHelpYnPromptAnswer) {
      return this.processKey(legacyAutoHelpYnPromptAnswer);
    }

    const contextualLookInfoAutoAnswer =
      this.resolveContextualLookInfoAutoAnswer(
        question,
        normalizedChoices,
        defaultChoice,
      );
    if (contextualLookInfoAutoAnswer) {
      return this.processKey(contextualLookInfoAutoAnswer);
    }

    this.pendingLegacySlashEmCursorPromptFarLook =
      this.isLegacySlashEmCursorPromptQuestion(
        question,
        normalizedChoices,
        defaultChoice,
      );
    if (this.pendingLegacySlashEmCursorPromptFarLook) {
      console.log(
        "Tracking legacy Slash'EM cursor yn prompt for far-look activation",
      );
    }

    if (question && question.toLowerCase().includes("direction")) {
      this.activeYnPrompt = {
        choices: normalizedChoices,
        defaultChoice: normalizedDefaultChoice,
      };
      if (this.eventHandler) {
        this.emit({
          type: "direction_question",
          text: question,
          choices: choices,
          default: defaultChoice,
        });
      }
      const requested = this.waitForQuestionInput();
      if (requested && typeof requested.then === "function") {
        return requested.finally(() => {
          this.activeYnPrompt = null;
        });
      }
      this.activeYnPrompt = null;
      return requested;
    }

    this.activeYnPrompt = {
      choices: normalizedChoices,
      defaultChoice: normalizedDefaultChoice,
    };
    const legacySlashEmInventoryPromptMenuItems =
      this.buildLegacySlashEmInventoryQuestionMenuItems(
        question,
        normalizedChoices,
      );
    if (legacySlashEmInventoryPromptMenuItems.length > 0) {
      console.log(
        `Routing legacy Slash'EM inventory yn prompt through menu dialog (${legacySlashEmInventoryPromptMenuItems.length} items)`,
        {
          question: String(question || ""),
          choices: `${normalizedChoices} ${this.getQuestionBracketChoiceSpec(question)}`.trim(),
        },
      );
    }
    if (this.eventHandler) {
      this.emit({
        type: "question",
        text: question,
        choices: choices,
        default: defaultChoice,
        menuItems: legacySlashEmInventoryPromptMenuItems,
      });
    }

    const requested = this.waitForQuestionInput();
    if (requested && typeof requested.then === "function") {
      return requested.finally(() => {
        this.activeYnPrompt = null;
      });
    }
    this.activeYnPrompt = null;
    return requested;
  }

  resolveEscapeForActiveYnPrompt() {
    const prompt = this.activeYnPrompt;
    if (!prompt || typeof prompt !== "object") {
      return null;
    }

    const choices =
      typeof prompt.choices === "string" ? prompt.choices : String(prompt.choices ?? "");
    if (!choices) {
      return null;
    }
    const choicesLower = choices.toLowerCase();

    const defaultCode =
      typeof prompt.defaultChoice === "number" &&
      Number.isFinite(prompt.defaultChoice)
        ? Math.trunc(prompt.defaultChoice)
        : 0;
    const defaultChar =
      defaultCode > 0 && defaultCode <= 255
        ? String.fromCharCode(defaultCode).toLowerCase()
        : "";
    if (defaultChar && choicesLower.includes(defaultChar)) {
      return defaultChar;
    }
    if (choicesLower.includes("n")) {
      return "n";
    }
    if (choicesLower.includes("q")) {
      return "q";
    }
    return null;
  }

  handleShimNhPoskey(args) {
    const [xPtr, yPtr, modPtr] = args;
    console.log("NetHack requesting position key");
    if (this.maybeRefreshPendingPostActionPlayerTile("nh_poskey")) {
      this.pendingPostActionPlayerTileRefreshReason = null;
      this.pendingPostActionPlayerTileRefreshTarget = null;
    }
    if (this.contextualGlanceAutoCancelPositionUntilMs > 0) {
      const nowMs = Date.now();
      if (nowMs <= this.contextualGlanceAutoCancelPositionUntilMs) {
        console.log(
          "Auto-canceling contextual look/glance follow-up position request",
        );
        this.contextualGlanceAutoCancelPositionUntilMs = 0;
        this.setPositionInputActive(false);
        return this.processKey("Escape");
      }
      this.contextualGlanceAutoCancelPositionUntilMs = 0;
    }

    if (this.farLookMode === "none" && this.pendingTravelPositionInputArm) {
      this.activateTravelPositionInputMode("nh_poskey fallback");
    }

    if (this.farLookMode === "armed") {
      this.farLookMode = "active";
      this.setPositionInputActive(true);
      if (!this.positionCursor) {
        this.emitPositionCursor(
          null,
          this.playerPosition.x,
          this.playerPosition.y,
          "nh_poskey_start",
        );
      }
    } else if (this.farLookMode === "active") {
      this.setPositionInputActive(true);
    } else {
      this.setPositionInputActive(false);
    }

    return this.requestInputCode("position", { xPtr, yPtr, modPtr });
  }

  handleShimGetlin(args) {
    const [question, bufferPtr] = args;
    const normalizedQuestion =
      typeof question === "string" ? question : String(question ?? "");
    const promptContextMessage =
      this.getGetlinPromptContextMessage(normalizedQuestion);
    console.log(`Text input requested: "${normalizedQuestion}"`);
    if (promptContextMessage) {
      console.log(
        `Text input context for Call prompt: "${promptContextMessage}"`,
      );
    }
    const resolvedBufferPtr = this.resolveTextInputBufferPointer(bufferPtr);
    if (!resolvedBufferPtr) {
      console.log(
        `Unable to resolve getlin buffer pointer (raw=${bufferPtr}); returning empty response`,
      );
      return 0;
    }

    if (this.pendingTextResponses.length > 0) {
      const queued = String(this.pendingTextResponses.shift() || "");
      this.writeTextInputBuffer(
        resolvedBufferPtr,
        queued,
        this.textInputMaxLength,
      );
      return 0;
    }

    if (!this.eventHandler) {
      this.writeTextInputBuffer(resolvedBufferPtr, "", this.textInputMaxLength);
      return 0;
    }

    if (this.pendingTextRequest) {
      this.handleTextInputResponse("\x1b", "system");
    }

    this.emit({
      type: "text_request",
      text: normalizedQuestion,
      contextMessage: promptContextMessage || undefined,
      maxLength: this.textInputMaxLength,
    });

    return new Promise((resolve) => {
      this.pendingTextRequest = {
        bufferPtr: resolvedBufferPtr,
        resolve,
        maxLength: this.textInputMaxLength,
      };
    });
  }
  handleUICallback(name, args) {
    if (this.isClosed) {
      return 0;
    }
    this.uiCallbackCount += 1;
    this.clearStartupNoCallbackTimer();
    let shouldLogUiCallback = true;
    if (name === "shim_print_glyph") {
      // Temporarily log first few to diagnose black map
      if (!((this as any).__loggedGlyphCallbackCount)) (this as any).__loggedGlyphCallbackCount = 0;
      (this as any).__loggedGlyphCallbackCount++;
      shouldLogUiCallback = (this as any).__loggedGlyphCallbackCount <= 3;
    }
    if (shouldLogUiCallback) {
      console.log(`UI Callback: ${name}`, args);
    }
    this.recordRecentUICallback(name, args);
    if (!this.validateCallbackPointerContract(name, args)) {
      return this.getSafeCallbackDefaultReturn(name);
    }
    const isRawPrintCallback = this.isRawPrintCallbackName(name);
    if (
      this.gameOverSequenceActive &&
      this.gameOverEmptyRawPrintCount > 0 &&
      !isRawPrintCallback
    ) {
      this.gameOverEmptyRawPrintCount = 0;
    }

    const inputCallbackHandlers = {
      shim_get_nh_event: () => this.handleShimGetNhEvent(),
      shim_nhgetch: () => this.handleShimNhGetch(),
      shim_yn_function: () => this.handleShimYnFunction(args),
      shim_nh_poskey: () => this.handleShimNhPoskey(args),
      shim_getlin: () => this.handleShimGetlin(args),
    };
    const mappedInputHandler = inputCallbackHandlers[name];
    if (mappedInputHandler) {
      return mappedInputHandler();
    }

    switch (name) {
      case "shim_get_ext_cmd":
        const queuedExtendedCommandText =
          this.dequeuePendingExtendedCommandSubmission();
        const extCommandText =
          queuedExtendedCommandText !== undefined
            ? queuedExtendedCommandText
            : this.consumeQueuedExtendedCommandInput();
        if (extCommandText === null) {
          console.log("Extended command cancelled before submission");
          return -1;
        }

        if (!extCommandText) {
          if (this.startupExtmenuEnabled) {
            console.log(
              "Extended command submission was empty; awaiting extmenu selection",
            );
            return this.requestExtendedCommandSelectionFromUi();
          }
          console.log("Extended command submission was empty");
          return -1;
        }

        const extCommandIndex =
          this.resolveExtendedCommandIndex(extCommandText);
        if (extCommandIndex < 0) {
          console.log(
            `Unknown extended command "${extCommandText}" (canceling command)`,
          );
          return -1;
        }

        console.log(
          `Resolved extended command "${extCommandText}" to index ${extCommandIndex}`,
        );
        console.log(`[EXTCMD_DEBUG] Returning index ${extCommandIndex} for "${extCommandText}" — watching for next callback...`);
        this.armFarLookForExtendedCommandIndex(extCommandIndex);
        return extCommandIndex;

      case "shim_init_nhwindows": {
        this.nameInitDebugCounter += 1;
        const initConfiguredName = this.normalizeCharacterNameValue(
          this.startupOptions?.characterCreation?.name,
        );
        console.log("[NAME_DEBUG] shim_init_nhwindows", {
          callId: this.nameInitDebugCounter,
          args,
          pendingTextResponses: this.pendingTextResponses.length,
          configuredName: initConfiguredName,
        });
        // Only prompt the UI for a name when neither a configured name nor a
        // queued text response is available; otherwise shim_askname will
        // resolve silently and the spurious dialog blocks the user.
        const hasNameAlready =
          initConfiguredName.length > 0 ||
          this.pendingTextResponses.length > 0;
        if (this.eventHandler && !hasNameAlready) {
          this.emit({
            type: "name_request",
            text: "What is your name, adventurer?",
            maxLength: 30,
            source: "init_nhwindows",
            callId: this.nameInitDebugCounter,
          });
        } else if (hasNameAlready) {
          console.log(
            "[NAME_DEBUG] shim_init_nhwindows skipping name_request emit — name already available (configured or queued)",
          );
        }
        return 1;
      }
      case "shim_create_nhwindow":
        const [windowType] = args;
        this.resetWindowTextBuffer(windowType);
        console.log(
          `Creating window [ ${windowType} ] returning ${windowType}`,
        );
        return windowType;
      case "shim_status_init":
        console.log("Initializing status display");
        return 0;
      case "shim_start_menu":
        const [menuWinId, menuOptions] = args;
        console.log("NetHack starting menu:", args);
        this.currentMenuItems = []; // Clear previous menu items
        this.currentWindow = menuWinId;
        this.currentMenuQuestionText = "";
        this.lastQuestionText = null; // Clear any previous question text when starting new menu
        this.lastEndedMenuWindow = null;
        this.lastEndedMenuHadQuestion = false;
        this.lastEndedInventoryMenuKind = null;
        this.lastMenuInteractionCancelled = false;
        this.resetWindowTextBuffer(menuWinId);

        // Reset selection tracking for new menus
        this.menuSelections.clear();
        this.isInMultiPickup = false;
        this.menuSelectionReadyCount = null;

        if (this.pendingMenuSelection) {
          console.log("Clearing previous pending menu selection resolver");
          this.pendingMenuSelection = null;
        }

        // Log window type for debugging
        const windowTypes = this.getRuntimeWindowTypeLabels(this.runtimeVersion);
        console.log(
          `📋 Starting menu for window ${menuWinId} (${
            windowTypes[menuWinId] || "UNKNOWN"
          })`,
        );
        return 0;
      case "shim_end_menu":
        const [endMenuWinid, menuQuestion] = args;
        console.log("NetHack ending menu:", args);

        // Check if this is just an inventory update vs an actual question
        const isInventoryWindow = this.isInventoryWindow(endMenuWinid);
        const normalizedMenuQuestion =
          typeof menuQuestion === "string" ? menuQuestion : "";
        const hasMenuQuestion = normalizedMenuQuestion.trim().length > 0;
        this.currentMenuQuestionText = hasMenuQuestion
          ? normalizedMenuQuestion
          : "";
        this.lastEndedMenuWindow = endMenuWinid;
        this.lastEndedMenuHadQuestion = hasMenuQuestion;
        this.lastEndedInventoryMenuKind = null;

        // Log the menu details for debugging
        console.log(
          `📋 Menu ending - Window: ${endMenuWinid}, Question: "${menuQuestion}", Items: ${this.currentMenuItems.length}`,
        );

        // WIN_INVEN is used for both real inventory and informational reports.
        if (isInventoryWindow && !hasMenuQuestion) {
          const classification = this.classifyInventoryWindowMenu(
            this.currentMenuItems,
            normalizedMenuQuestion,
          );
          this.lastEndedInventoryMenuKind = classification.kind;
          if (classification.kind === "inventory") {
            this.currentMenuItems = this.inferQuestionlessInventoryCategories(
              this.currentMenuItems,
            );
          }
          const actualItems = this.currentMenuItems.filter(
            (item) => !item.isCategory,
          );
          const categoryHeaders = this.currentMenuItems.filter(
            (item) => item.isCategory,
          );
          console.log(
            `WIN_INVEN no-question menu classified as ${classification.kind} (${actualItems.length} items, ${categoryHeaders.length} categories)`,
          );

          if (this.eventHandler) {
            if (classification.kind === "inventory") {
              this.latestInventoryItems = this.currentMenuItems.map((item) => ({
                ...item,
              }));
              this.emit({
                type: "inventory_update",
                items: this.latestInventoryItems.map((item) => ({ ...item })),
                window: endMenuWinid,
              });
            } else {
              const infoLines = classification.lines;
              const explicitInfoTitle =
                typeof classification.title === "string" &&
                classification.title.trim().length > 0
                  ? classification.title.trim()
                  : "";
              const infoTitle = explicitInfoTitle
                ? explicitInfoTitle
                : infoLines.length > 0
                  ? infoLines[0]
                  : "NetHack Information";
              const infoBody = explicitInfoTitle
                ? infoLines
                : infoLines.length > 1
                  ? infoLines.slice(1)
                  : infoLines;
              this.emit({
                type: "info_menu",
                title: infoTitle,
                lines: infoBody,
                window: endMenuWinid,
              });
            }
          }

          return 0;
        }
        // Special handling for inventory window WITH questions (like drop, wear, etc.)
        if (isInventoryWindow && hasMenuQuestion) {
          const classification = this.classifyInventoryWindowMenu(
            this.currentMenuItems,
            normalizedMenuQuestion,
          );
          if (classification.kind === "info_menu") {
            this.lastEndedInventoryMenuKind = classification.kind;
            console.log(
              `WIN_INVEN question menu classified as ${classification.kind} (${this.currentMenuItems.length} items, title="${normalizedMenuQuestion}")`,
            );
            if (this.eventHandler) {
              const infoLines = classification.lines;
              const explicitInfoTitle =
                typeof classification.title === "string" &&
                classification.title.trim().length > 0
                  ? classification.title.trim()
                  : "";
              const infoTitle = explicitInfoTitle
                ? explicitInfoTitle
                : infoLines.length > 0
                  ? infoLines[0]
                  : "NetHack Information";
              const infoBody = explicitInfoTitle
                ? infoLines
                : infoLines.length > 1
                  ? infoLines.slice(1)
                  : infoLines;
              this.emit({
                type: "info_menu",
                title: infoTitle,
                lines: infoBody,
                window: endMenuWinid,
              });
            }
            return 0;
          }

          if (
            this.tryAutoPickRuntime5TileContextMenuItem(
              menuQuestion,
              this.currentMenuItems,
            )
          ) {
            return 0;
          }

          this.lastEndedInventoryMenuKind = "inventory";
          console.log(
            `📋 Inventory action question detected: "${menuQuestion}" with ${this.currentMenuItems.length} items`,
          );
          // Contextual inventory actions can arm a pending accelerator. For #name,
          // this auto-routes through "a particular object in inventory" first, then
          // applies the selected item accelerator on the follow-up menu.
          if (
            this.tryAutoHandlePendingInventoryContextSelection(
              menuQuestion,
              this.currentMenuItems,
              { reason: "context action" },
            )
          ) {
            // Skip question emission/wait so the clicked action resolves immediately.
            return 0;
          }

          const isMultiSelectQuestion =
            this.isMultiSelectLootQuestion(menuQuestion);
          if (isMultiSelectQuestion) {
            console.log("Multi-select loot dialog detected");
            this.isInMultiPickup = true;
          }
          // Send the inventory question to web client
          if (this.eventHandler) {
            this.emit({
              type: "question",
              text: menuQuestion,
              choices: "",
              default: "",
              menuItems: this.currentMenuItems,
            });
          }

          // Wait for actual user input for inventory questions
          console.log("📋 Waiting for inventory action selection (async)...");
          return this.waitForQuestionInput();
        }

        // If there's a menu question (like "Pick up what?"), send it to the client
        if (hasMenuQuestion && this.currentMenuItems.length > 0) {
          if (
            this.tryAutoHandlePendingInventoryContextSelection(
              menuQuestion,
              this.currentMenuItems,
              { reason: "context action (generic menu question)" },
            )
          ) {
            // Skip question emission/wait so the clicked action resolves immediately.
            return 0;
          }
          console.log(
            `📋 Menu question detected: "${menuQuestion}" with ${this.currentMenuItems.length} items`,
          );

          if (this.isMultiSelectLootQuestion(menuQuestion)) {
            console.log("Multi-select loot menu detected");
            this.isInMultiPickup = true;
          }

          // Send menu question to web client
          if (this.eventHandler) {
            this.emit({
              type: "question",
              text: menuQuestion,
              choices: "",
              default: "",
              menuItems: this.currentMenuItems,
            });
          }

          // Wait for actual user input for menu questions
          console.log("📋 Waiting for menu selection (async)...");
          return this.waitForQuestionInput();
        }

        // Check if we have menu items but no explicit question - could be a pickup or action menu
        if (
          this.currentMenuItems.length > 0 &&
          !hasMenuQuestion &&
          !isInventoryWindow
        ) {
          console.log(
            `📋 Menu expansion detected with ${this.currentMenuItems.length} items (window ${endMenuWinid})`,
          );

          // Determine the appropriate question based on context and window type
          let contextualQuestion = "Please select an option:";

          // Count non-category items to get actual selectable items
          const selectableItems = this.currentMenuItems.filter(
            (item) => !item.isCategory,
          );
          console.log(
            `📋 Found ${selectableItems.length} selectable items out of ${this.currentMenuItems.length} total`,
          );

          // Try to infer the action from the menu items and context
          if (
            selectableItems.some(
              (item) =>
                item.text &&
                typeof item.text === "string" &&
                (item.text.includes("gold pieces") ||
                  item.text.includes("corpse") ||
                  item.text.includes("here")),
            )
          ) {
            contextualQuestion = "What would you like to pick up?";
          } else if (
            selectableItems.some(
              (item) =>
                item.text &&
                typeof item.text === "string" &&
                (item.text.includes("spell") || item.text.includes("magic")),
            )
          ) {
            contextualQuestion = "Which spell would you like to cast?";
          } else if (
            selectableItems.some(
              (item) =>
                item.text &&
                typeof item.text === "string" &&
                (item.text.includes("wear") ||
                  item.text.includes("wield") ||
                  item.text.includes("armor")),
            )
          ) {
            contextualQuestion = "What would you like to use?";
          }

          // Only show dialog if we have actual selectable items
          if (selectableItems.length > 0) {
            if (this.isMultiSelectLootQuestion(contextualQuestion)) {
              console.log("Expanded multi-select loot menu detected");
              this.isInMultiPickup = true;
            }

            // Send expanded question to web client
            if (this.eventHandler) {
              this.currentMenuQuestionText = contextualQuestion;
              this.emit({
                type: "question",
                text: contextualQuestion,
                choices: "",
                default: "",
                menuItems: this.currentMenuItems,
              });
            }

            // Wait for actual user input for expanded questions
            console.log("📋 Waiting for expanded menu selection (async)...");
            return this.waitForQuestionInput();
          } else {
            console.log(
              "📋 Menu has no selectable items - treating as informational",
            );
          }
        }

        return 0;
      case "shim_display_nhwindow":
        const [winid, blocking] = args;
        console.log(`DISPLAY WINDOW [Win ${winid}], blocking: ${blocking}`);
        const displayLines = this.consumeWindowTextBuffer(winid);
        const hasDisplayText = displayLines.some(
          (line) => String(line || "").trim().length > 0,
        );
        let didEmitInfoDialog = false;
        if (hasDisplayText && this.shouldCaptureWindowTextForDialog(winid)) {
          const normalizedLines = displayLines.map((line) =>
            String(line || "").replace(/\u0000/g, ""),
          );
          this.captureGameOverSummaryFromLines(
            normalizedLines,
            "display_nhwindow",
          );
          if (this.shouldLogWindowTextInsteadOfDialog(normalizedLines)) {
            console.log(
              `Routing window ${winid} text to message log (${normalizedLines.length} lines)`,
            );
            this.emitWindowTextLinesToLog(normalizedLines, winid);
            return 0;
          }
          if (!this.eventHandler) {
            return 0;
          }
          console.log(
            `Emitting info dialog for window ${winid} with ${normalizedLines.length} lines`,
          );
          this.emit({
            type: "info_menu",
            title: this.getWindowTextDialogTitle(winid),
            lines: normalizedLines,
            window: winid,
            blocking: blocking,
            source: "display_nhwindow",
          });
          didEmitInfoDialog = true;
        }
        if (blocking && didEmitInfoDialog) {
          return this.waitForQuestionInput();
        }
        return 0;
      case "shim_display_file":
        return this.handleShimDisplayFile(args);
      case "shim_add_menu":
        const pointerContract = this.getRuntimePointerContract();
        const addMenuMode = pointerContract?.callbackModes?.shim_add_menu || {};
        const menuTextArgIndex = Number.isInteger(addMenuMode.menuTextArgIndex)
          ? addMenuMode.menuTextArgIndex
          : this.runtimeVersion === "5.0"
            ? 7
            : 6;
        const itemFlagsArgIndex = Number.isInteger(addMenuMode.itemFlagsArgIndex)
          ? addMenuMode.itemFlagsArgIndex
          : this.runtimeVersion === "5.0"
            ? 8
            : 7;
        const identifierMode =
          addMenuMode.identifierMode === "pointer_slot"
            ? "pointer_slot"
            : "value";
        const glyphArgMode =
          addMenuMode.glyphArgMode === "glyphinfo_ptr"
            ? "glyphinfo_ptr"
            : "glyph_value";
        const menuWinid = Number(args[0]);
        const menuGlyph = args[1];
        const identifier = args[2];
        const rawAccelerator = args[3];
        const rawGroupAccelerator = args[4];
        const accelerator =
          typeof rawAccelerator === "string" &&
          this.isLegacyMenuAcceleratorRuntime()
            ? rawAccelerator
            : Number.isFinite(Number(rawAccelerator))
              ? Math.trunc(Number(rawAccelerator))
              : rawAccelerator;
        const groupAccelerator =
          typeof rawGroupAccelerator === "string" &&
          this.isLegacyMenuAcceleratorRuntime()
            ? rawGroupAccelerator
            : Number.isFinite(Number(rawGroupAccelerator))
              ? Math.trunc(Number(rawGroupAccelerator))
              : rawGroupAccelerator;
        const printableGroupAccelerator =
          this.getPrintableAcceleratorCharacter(groupAccelerator);
        const menuAttr = Number(args[5]);
        const menuText = String((args[menuTextArgIndex] ?? "") || "");
        const menuItemFlags = Number(args[itemFlagsArgIndex] ?? 0);

        // In this callback shape, category headers are identified by menuAttr=7.
        const isCategory = menuAttr === 7;
        const identifierValue =
          identifierMode === "pointer_slot"
            ? this.readPointerSlotValue(identifier, "menu_identifier_ptr")
            : Number.isFinite(Number(identifier))
              ? Math.trunc(Number(identifier))
              : null;
        const isSelectable =
          !isCategory &&
          typeof identifierValue === "number" &&
          identifierValue !== 0;
        let menuChar = "";
        let glyphChar = "";
        let menuItemTileIndex = null;
        let resolvedMenuGlyph = menuGlyph;
        let isTileApplicable = false;
        const noGlyphValue = this.getNoGlyphValue();

        // Convert glyph to visual character and tile index using runtime helpers.
        if (menuGlyph) {
          let finalGlyph = Number.isFinite(Number(menuGlyph))
            ? Math.trunc(Number(menuGlyph))
            : menuGlyph;
          if (glyphArgMode === "glyphinfo_ptr") {
            const decodedGlyphInfo = this.decodeGlyphInfoPointer(
              menuGlyph,
              "shim_add_menu",
            );
            if (decodedGlyphInfo) {
              finalGlyph = decodedGlyphInfo.glyph;
              if (menuItemTileIndex === null && decodedGlyphInfo.tileIndex !== null) {
                menuItemTileIndex = decodedGlyphInfo.tileIndex;
              }
              console.log(
                `Decoded menu glyphinfo pointer: ptr=0x${decodedGlyphInfo.pointer.toString(
                  16,
                )} -> glyph=${decodedGlyphInfo.glyph}`,
              );
            } else {
              console.log(
                `Could not decode menu glyphinfo pointer for value ${menuGlyph}`,
              );
            }
          }
          resolvedMenuGlyph = finalGlyph;

          const helpers = globalThis.nethackGlobal?.helpers;
          const mapHelper = this.runtimeVersion === "5.0"
            ? helpers?.mapGlyphInfoHelper
            : helpers?.mapglyphHelper;
          const tileIndexForGlyphHelper =
            typeof helpers?.tileIndexForGlyph === "function"
              ? helpers.tileIndexForGlyph
              : null;

          if (
            typeof finalGlyph === "number" &&
            Number.isFinite(finalGlyph) &&
            finalGlyph >= 0
          ) {
            isTileApplicable = true;
            if (
              noGlyphValue !== null &&
              Math.trunc(finalGlyph) === noGlyphValue
            ) {
              isTileApplicable = false;
            }

            if (isTileApplicable && tileIndexForGlyphHelper) {
              try {
                const helperTileIndex = tileIndexForGlyphHelper(finalGlyph);
                if (
                  typeof helperTileIndex === "number" &&
                  Number.isFinite(helperTileIndex) &&
                  helperTileIndex >= 0
                ) {
                  menuItemTileIndex = Math.trunc(helperTileIndex);
                }
              } catch (error) {
                console.log(
                  `Warning: tileIndexForGlyph helper failed for glyph ${finalGlyph}:`,
                  error,
                );
              }
            }

            if (mapHelper) {
              try {
                const glyphInfo = mapHelper(
                  finalGlyph,
                  0,
                  0,
                  0, // x, y, and other params not needed for menu items
                );
                if (glyphInfo && glyphInfo.ch !== undefined) {
                  if (typeof glyphInfo.ch === "number") {
                    glyphChar = String.fromCharCode(glyphInfo.ch);
                  } else {
                    glyphChar = String(glyphInfo.ch).charAt(0);
                  }
                }

                if (menuItemTileIndex === null) {
                  const tileIndexCandidate =
                    typeof glyphInfo?.tileidx === "number"
                      ? glyphInfo.tileidx
                      : glyphInfo?.tileIdx;
                  if (
                    typeof tileIndexCandidate === "number" &&
                    Number.isFinite(tileIndexCandidate) &&
                    tileIndexCandidate >= 0
                  ) {
                    menuItemTileIndex = Math.trunc(tileIndexCandidate);
                  }
                }
              } catch (error) {
                console.log(
                  `Warning: Error getting glyph info for menu glyph ${finalGlyph} (from ptr ${menuGlyph}):`,
                  error,
                );
              }
            }
          }
        }

        if (
          typeof glyphChar === "string" &&
          glyphChar.length > 0 &&
          glyphChar.trim().length === 0
        ) {
          // NO_GLYPH rows map to a blank symbol in NetHack menus.
          isTileApplicable = false;
        }

        if (menuItemTileIndex === null) {
          // Only treat a row as tile-applicable when NetHack/helpers resolve
          // a concrete tile index. This avoids false-positive tile shells for
          // NO_GLYPH/text-only rows in options/help menus.
          isTileApplicable = false;
        }

        if (!isTileApplicable) {
          menuItemTileIndex = null;
        }

        const tileApplicableForRow = !isCategory && isTileApplicable;

        if (!isCategory) {
          // For non-category items, determine the accelerator key
          const printableAccelerator =
            this.getPrintableAcceleratorCharacter(accelerator);
          if (isSelectable && printableAccelerator) {
            // Preserve runtime-provided printable menu accelerators as-is.
            menuChar = printableAccelerator;
          } else if (isSelectable) {
            // Curses-style fallback for selectable rows with no accelerator.
            const existingItems = this.currentMenuItems.filter(
              (item) => !item.isCategory && item.isSelectable,
            );
            const alphabet =
              "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            menuChar = alphabet[existingItems.length % alphabet.length];
          }

          console.log(
            `📋 MENU ITEM: "${menuText}" (key: ${menuChar}) glyph: ${resolvedMenuGlyph} -> "${glyphChar}" tile: ${
              menuItemTileIndex !== null ? menuItemTileIndex : "n/a"
            } - accelerator code: ${accelerator}, itemflags: ${menuItemFlags}`,
          );
        } else {
          console.log(
            `📋 CATEGORY HEADER: "${menuText}" - accelerator code: ${accelerator}, itemflags: ${menuItemFlags}`,
          );
        }

        // Store menu item for current question (only store non-category items or all items for display)
        if (this.currentWindow === menuWinid && menuText) {
          this.currentMenuItems.push({
            text: menuText,
            accelerator: menuChar,
            originalAccelerator: accelerator, // Store the original accelerator code
            groupAccelerator: printableGroupAccelerator,
            originalGroupAccelerator: groupAccelerator,
            identifier: identifierValue, // NetHack menu identifier used by shim_select_menu
            window: menuWinid,
            glyph: resolvedMenuGlyph,
            glyphChar: glyphChar, // Add the visual character representation
            tileIndex:
              tileApplicableForRow && menuItemTileIndex !== null
                ? menuItemTileIndex
                : undefined,
            isTileApplicable: tileApplicableForRow,
            isCategory: isCategory,
            isSelectable,
            menuIndex: this.currentMenuItems.length, // Store the menu item index
          });
        }

        // Send menu item to web client
        if (this.eventHandler) {
          this.emit({
            type: "menu_item",
            text: menuText,
            accelerator: menuChar,
            groupAccelerator: printableGroupAccelerator,
            window: menuWinid,
            glyph: resolvedMenuGlyph,
            glyphChar: glyphChar, // Include glyph character in client message
            tileIndex:
              tileApplicableForRow && menuItemTileIndex !== null
                ? menuItemTileIndex
                : undefined,
            isTileApplicable: tileApplicableForRow,
            isCategory: isCategory,
            isSelectable,
            menuItems: this.currentMenuItems,
          });
        }

        return 0;
      case "shim_putstr":
        const [win, textAttr, textStr] = args;
        console.log(`💬 TEXT [Win ${win}]: "${textStr}"`);
        if (this.shouldSuppressRedundantStatusWindowText(win)) {
          return 0;
        }
        this.appendWindowTextBuffer(win, textStr);
        if (this.isMessageWindow(win)) {
          this.rememberPromptContextMessage(textStr, "message_window");
        }

        if (!this.shouldCaptureWindowTextForDialog(win)) {
          this.gameMessages.push({
            text: textStr,
            window: win,
            timestamp: Date.now(),
            attr: textAttr,
          });
          if (this.gameMessages.length > 100) {
            this.gameMessages.shift();
          }
          if (this.eventHandler) {
            this.emit({
              type: "text",
              text: textStr,
              window: win,
              attr: textAttr,
            });
          }
        }
        return 0;
      case "shim_print_glyph": {
        // 3.6.7/SlashEM: args = [win, x, y, glyph] (or [..., bkglyph])
        // 3.7:           args = [win, x, y, ptrToGlyphInfo, extra]
        // EvilHack:      args = [win, x, y, glyph, monster_id, attacking_target_id]
        // Runtime-specific shapes are validated against the pointer contract
        // before we get here; do not infer layout from arg count.
        const [printWin, x, y, a, b] = args as number[];

        // DEBUG: count arriving glyphs to diagnose black map (all versions)
        if (!((this as any).__evGlyphCount)) (this as any).__evGlyphCount = 0;
        (this as any).__evGlyphCount++;
        if ((this as any).__evGlyphCount <= 5 || (this as any).__evGlyphCount % 200 === 0) {
          console.log(`[GLYPH_DEBUG #${(this as any).__evGlyphCount}] rv=${this.runtimeVersion} win=${printWin} x=${x} y=${y} glyph=${a} isMapWin=${this.isMapWindow(printWin)}`);
        }

        let printGlyph = a;
        // Use local names to avoid colliding with existing glyphChar/glyphColor in your file
        let decodedChar: string | null = null;
        let decodedColor: number | null = null;
        let decodedTileIndex: number | null = null;
        let decodedSymidx: number | null = null;
        let shouldLogPrintGlyph = true;

        const printGlyphMode =
          this.getRuntimePointerContract()?.callbackModes?.shim_print_glyph || {};
        const glyphArgMode =
          printGlyphMode.glyphArgMode === "glyphinfo_ptr"
            ? "glyphinfo_ptr"
            : "glyph_value";
        const trackedEntityArgIndex = Number.isInteger(
          printGlyphMode.trackedEntityArgIndex,
        )
          ? printGlyphMode.trackedEntityArgIndex
          : null;
        const attackingTargetArgIndex = Number.isInteger(
          printGlyphMode.attackingTargetArgIndex,
        )
          ? printGlyphMode.attackingTargetArgIndex
          : null;
        const rawMonsterId =
          trackedEntityArgIndex !== null ? args[trackedEntityArgIndex] : null;
        const rawAttackingTargetId =
          attackingTargetArgIndex !== null
            ? args[attackingTargetArgIndex]
            : null;
        const monsterId = this.normalizeRuntimeTrackedEntityId(rawMonsterId);
        const attackingTargetId =
          this.normalizeRuntimeAttackTargetId(rawAttackingTargetId);
        const glyphDebugSuffix = [
          monsterId !== null ? `monsterId=${monsterId}` : "",
          attackingTargetId !== null
            ? `attackingTargetId=${attackingTargetId}`
            : "",
        ]
          .filter(Boolean)
          .join(" ");
        if (glyphArgMode === "glyphinfo_ptr" && args.length >= 5) {
          const extra = b;
          const decodedGlyphInfo = this.decodeGlyphInfoPointer(
            a,
            "shim_print_glyph",
          );
          if (decodedGlyphInfo) {
            printGlyph = decodedGlyphInfo.glyph;
            if (
              Number.isFinite(decodedGlyphInfo.ttychar) &&
              decodedGlyphInfo.ttychar !== null
            ) {
              decodedChar = String.fromCharCode(decodedGlyphInfo.ttychar & 0xff);
            }
            if (
              Number.isFinite(decodedGlyphInfo.color) &&
              decodedGlyphInfo.color !== null
            ) {
              decodedColor = decodedGlyphInfo.color;
            }
            if (decodedGlyphInfo.tileIndex !== null) {
              decodedTileIndex = decodedGlyphInfo.tileIndex;
            }
            shouldLogPrintGlyph = !this.isUndiscoveredOrNothingGlyph(printGlyph);
            if (shouldLogPrintGlyph) console.log(
              `🎨 GLYPH [Win ${printWin}] at (${x},${y}): ptr=0x${decodedGlyphInfo.pointer.toString(
                16,
              )} glyph=${printGlyph} extra=0x${Number(extra || 0).toString(16)}`,
            );
          } else {
            console.log(
              `🎨 GLYPH [Win ${printWin}] at (${x},${y}): ptr=${a} [pointer decode failed]`,
            );
          }
        } else {
          shouldLogPrintGlyph = !this.isUndiscoveredOrNothingGlyph(printGlyph);
          if (shouldLogPrintGlyph) console.log(
            `🎨 GLYPH [Win ${printWin}] at (${x},${y}): ${printGlyph}`,
          );
        }

        if (false && shouldLogPrintGlyph && glyphDebugSuffix) {
          console.log(
            `ðŸŽ¨ GLYPH [Win ${printWin}] at (${x},${y}): ${glyphDebugSuffix}`,
          );
        }

        if (shouldLogPrintGlyph && glyphDebugSuffix) {
          console.log(
            `[GLYPH DEBUG] [Win ${printWin}] at (${x},${y}): ${glyphDebugSuffix}`,
          );
        }

        if (this.isMapWindow(printWin)) {
          const key = `${x},${y}`;
          const previousTileData = this.gameMap.get(key);
          const previousMonsterId =
            this.getTrackedMonsterIdFromRuntimeTile(previousTileData);
          if (this.isUndiscoveredOrNothingGlyph(printGlyph)) {
            const hadRenderableTile =
              this.isRenderableRuntimeMapTile(previousTileData);
            this.gameMap.delete(key);
            if (hadRenderableTile && this.eventHandler) {
              this.queueMapGlyphUpdate({
                type: "map_glyph",
                x,
                y,
                glyph: printGlyph,
                char: decodedChar,
                color: decodedColor,
                tileIndex: decodedTileIndex,
                symidx: decodedSymidx,
                floorUnderlayGlyph: null,
                floorUnderlayChar: null,
                floorUnderlayColor: null,
                floorUnderlayTileIndex: null,
                floorUnderlaySymidx: null,
                monsterId: previousMonsterId,
                attackingTargetId: null,
                window: printWin,
                isRuntimeUndiscoveredClear: true,
              });
            }
            return 0;
          }

          const helpers = (globalThis as any).nethackGlobal?.helpers;
          const mapHelper =
            this.runtimeVersion === "5.0"
              ? helpers?.mapGlyphInfoHelper
              : helpers?.mapglyphHelper;
          let decodedGlyphFlags = null;
          let floorUnderlay = null;

          // DEBUG: log once to show mapHelper availability
          if (!(this as any).__evMapHelperLogged) {
            (this as any).__evMapHelperLogged = true;
            console.log(`[MAPHELPER_DEBUG] rv=${this.runtimeVersion} mapglyphHelper=${typeof helpers?.mapglyphHelper} mapGlyphInfoHelper=${typeof helpers?.mapGlyphInfoHelper} mapHelper=${typeof mapHelper}`);
          }

          if (mapHelper) {
            try {
              // IMPORTANT: for 5.0 we now pass the decoded glyph (not the pointer)
              const glyphInfo = mapHelper(
                printGlyph,
                x,
                y,
                0,
              );

              // DEBUG: log first mapHelper result
              if (!(this as any).__evFirstGlyphLogged) {
                (this as any).__evFirstGlyphLogged = true;
                console.log(`[MAPHELPER_RESULT] rv=${this.runtimeVersion} glyph=${printGlyph} result=`, glyphInfo, `tileIdx=${this.extractGlyphInfoTileIndex(glyphInfo)}`);
              }

              if (glyphInfo) {
                if (glyphInfo.ch !== undefined) {
                  // Depending on build, glyphInfo.ch might already be a string char.
                  // Handle both.
                  if (typeof glyphInfo.ch === "number") {
                    decodedChar = String.fromCharCode(glyphInfo.ch);
                  } else {
                    decodedChar = String(glyphInfo.ch);
                  }
                }
                if (
                  typeof glyphInfo.color === "number" &&
                  Number.isFinite(glyphInfo.color)
                ) {
                  decodedColor = glyphInfo.color;
                }
                decodedTileIndex = this.extractGlyphInfoTileIndex(glyphInfo);
                decodedSymidx = this.extractGlyphInfoSymidx(glyphInfo);
                decodedGlyphFlags = this.extractGlyphInfoGlyphFlags(glyphInfo);
              }
            } catch (error) {
              console.log(
                `⚠️ Error getting glyph info for ${printGlyph}:`,
                error,
              );
            }
          }

          floorUnderlay = this.decodeFloorUnderlayAtPosition(
            x,
            y,
            helpers,
            mapHelper,
            true,
          );

          const isUndiscoveredOrNothingGlyph =
            this.isUndiscoveredOrNothingGlyph(printGlyph, decodedGlyphFlags);
          if (isUndiscoveredOrNothingGlyph) {
            const hadRenderableTile =
              this.isRenderableRuntimeMapTile(previousTileData);
            this.gameMap.delete(key);
            if (hadRenderableTile && this.eventHandler) {
              this.queueMapGlyphUpdate({
                type: "map_glyph",
                x,
                y,
                glyph: printGlyph,
                char: decodedChar,
                color: decodedColor,
                tileIndex: decodedTileIndex,
                symidx: decodedSymidx,
                floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
                floorUnderlayChar: floorUnderlay?.char ?? null,
                floorUnderlayColor: floorUnderlay?.color ?? null,
                floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
                floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
                monsterId: previousMonsterId,
                attackingTargetId: null,
                window: printWin,
                isRuntimeUndiscoveredClear: true,
              });
            }
            return 0;
          }

          this.gameMap.set(key, {
            x,
            y,
            glyph: printGlyph, // decoded glyph for 5.0
            glyphFlags: decodedGlyphFlags,
            char: decodedChar,
            color: decodedColor,
            tileIndex: decodedTileIndex,
            symidx: decodedSymidx,
            floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
            floorUnderlayChar: floorUnderlay?.char ?? null,
            floorUnderlayColor: floorUnderlay?.color ?? null,
            floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
            floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
            monsterId,
            timestamp: Date.now(),
          });

          // keep your original repaint/event flow
          if (this.eventHandler) {
            this.queueMapGlyphUpdate({
              type: "map_glyph",
              x,
              y,
              glyph: printGlyph, // decoded glyph for 5.0
              char: decodedChar,
              color: decodedColor,
              tileIndex: decodedTileIndex,
              symidx: decodedSymidx,
              floorUnderlayGlyph: floorUnderlay?.glyph ?? null,
              floorUnderlayChar: floorUnderlay?.char ?? null,
              floorUnderlayColor: floorUnderlay?.color ?? null,
              floorUnderlayTileIndex: floorUnderlay?.tileIndex ?? null,
              floorUnderlaySymidx: floorUnderlay?.symidx ?? null,
              monsterId,
              attackingTargetId,
              window: printWin,
            });
          }
        }

        return 0;
      }

      case "shim_monster_attack": {
        const [rawAttackerId, rawTargetId, rawTargetX, rawTargetY] =
          args as number[];
        const attackerId = this.normalizeRuntimeMonsterId(rawAttackerId);
        const targetId = this.normalizeRuntimeAttackTargetId(rawTargetId);
        const targetX =
          typeof rawTargetX === "number" && Number.isFinite(rawTargetX)
            ? Math.trunc(rawTargetX)
            : null;
        const targetY =
          typeof rawTargetY === "number" && Number.isFinite(rawTargetY)
            ? Math.trunc(rawTargetY)
            : null;
        if (this.eventHandler) {
          this.emit({
            type: "monster_attack",
            attackerId,
            targetId,
            targetX,
            targetY,
          });
        }
        return 0;
      }

      case "shim_monster_killed": {
        const [rawMonsterId, rawKillerId, rawX, rawY] = args as number[];
        const monsterId = this.normalizeRuntimeMonsterId(rawMonsterId);
        const killerId = this.normalizeRuntimeAttackTargetId(rawKillerId);
        const x =
          typeof rawX === "number" && Number.isFinite(rawX)
            ? Math.trunc(rawX)
            : null;
        const y =
          typeof rawY === "number" && Number.isFinite(rawY)
            ? Math.trunc(rawY)
            : null;
        if (this.eventHandler) {
          this.emit({
            type: "monster_killed",
            monsterId,
            killerId,
            x,
            y,
          });
        }
        return 0;
      }

      case "shim_player_selection":
        console.log("NetHack player selection started");
        // TO-DO: Is it OK we ignore this?
        return 0;
      case "shim_raw_print":
        const [rawText] = args;
        const suppressLegacyContextualLookInfoRawPrint =
          this.shouldSuppressLegacyContextualLookInfoRawPrint();
        if (!suppressLegacyContextualLookInfoRawPrint) {
          console.log(`📢 RAW PRINT: "${rawText}"`);
        }
        const normalizedRawText = this.normalizePromptContextMessage(rawText);
        if (normalizedRawText) {
          this.captureGameOverSummaryFromLines(
            [normalizedRawText],
            "raw_print",
          );
        }
        if (!normalizedRawText && this.gameOverSequenceActive) {
          this.gameOverEmptyRawPrintCount += 1;
          console.log(
            `Game-over empty raw_print (${this.gameOverEmptyRawPrintCount}/3)`,
          );
          if (this.gameOverEmptyRawPrintCount >= 3) {
            this.emitGameOverComplete(
              this.lastGameOverHow,
              this.lastGameOverWhen,
            );
          }
          return 0;
        }
        if (this.gameOverSequenceActive) {
          this.gameOverEmptyRawPrintCount = 0;
        }
        if (normalizedRawText) {
          this.rememberPromptContextMessage(normalizedRawText, "raw_print");
          this.armPendingTravelPositionInput(normalizedRawText);
          this.armPendingPostActionPlayerTileRefreshForAutopickupRawPrint(
            normalizedRawText,
          );
        }
        if (
          normalizedRawText &&
          this.runtimeVersion === "5.0" &&
          this.isAutosaveResumeRequested() &&
          !this.didAutoQueueRawRecoverChoice
        ) {
          const loweredRawText = normalizedRawText.toLowerCase();
          const isRawRecoverPrompt =
            (loweredRawText.includes(
              "there is already a game in progress under your name",
            ) ||
              loweredRawText.includes(
                "there are files from a game in progress under your name",
              )) &&
            loweredRawText.includes("do what");
          if (isRawRecoverPrompt) {
            this.queueStdinTextInput("r", "autosave raw recover prompt");
            this.didAutoQueueRawRecoverChoice = true;
            console.log(
              'Auto-queued "r" for raw startup recovery prompt during autosave resume',
            );
          }
        }

        // Send raw print messages to the UI log
        if (
          this.eventHandler &&
          normalizedRawText &&
          !suppressLegacyContextualLookInfoRawPrint
        ) {
          this.emit({
            type: "raw_print",
            text: normalizedRawText,
          });
        }
        return 0;
      case "shim_raw_print_bold":
        const [rawBoldText] = args;
        console.log(`RAW PRINT BOLD: "${rawBoldText}"`);
        const normalizedRawBoldText =
          this.normalizePromptContextMessage(rawBoldText);
        if (normalizedRawBoldText) {
          this.captureGameOverSummaryFromLines(
            [normalizedRawBoldText],
            "raw_print_bold",
          );
        }
        if (normalizedRawBoldText) {
          this.rememberPromptContextMessage(
            normalizedRawBoldText,
            "raw_print_bold",
          );
        }
        if (this.eventHandler && normalizedRawBoldText) {
          this.emit({
            type: "raw_print",
            text: normalizedRawBoldText,
            bold: true,
          });
        }
        return 0;
      case "shim_message_menu":
        const [menuLet, menuHow, menuMessage] = args;
        console.log(
          `NetHack message_menu: let=${menuLet}, how=${menuHow}, message="${menuMessage}"`,
        );
        if (this.eventHandler && menuMessage && String(menuMessage).trim()) {
          this.rememberPromptContextMessage(String(menuMessage), "message_menu");
          this.emit({
            type: "text",
            text: String(menuMessage),
            window: this.getRuntimeWindowId("WIN_MESSAGE"),
            attr: 0,
            source: "message_menu",
          });
        }
        // force_invmenu keeps this path rare; default to "no choice".
        return 0;
      case "shim_update_inventory":
        console.log("NetHack update inventory callback received");
        // This callback is usually triggered after inventory changes.
        // We can use it to signal the UI to refresh its inventory display if needed.
        if (this.maybeRefreshPendingPostActionPlayerTile("inventory_update")) {
          this.pendingPostActionPlayerTileRefreshReason = null;
          this.pendingPostActionPlayerTileRefreshTarget = null;
        }
        if (this.eventHandler) {
          this.emit({
            type: "inventory_updated_signal",
          });
        }
        return 0;
      case "shim_wait_synch":
        console.log("NetHack waiting for synchronization");
        return 0;
      case "shim_nhbell":
        console.log("NetHack requested bell");
        return 0;
      case "shim_select_menu":
        const [menuSelectWinid, menuSelectHow, menuPtrArg] = args;
        const consumeMenuInteractionCancelled = () => {
          const cancelled = this.lastMenuInteractionCancelled;
          this.lastMenuInteractionCancelled = false;
          if (cancelled) {
            this.clearPendingInventoryContextSelection(
              "menu interaction cancelled",
            );
          }
          return cancelled;
        };
        const ptrMode = "direct";
        const menuListPtrPtr =
          this.normalizeWasmPointer(menuPtrArg, {
            label: "shim_select_menu_list_ptr_ptr",
            minBytes: 4,
            alignment: 4,
          }) || 0;
        const menuListCurrentOutPtr =
          menuListPtrPtr > 0
            ? this.readPointerSlotValue(
                menuListPtrPtr,
                "shim_select_menu_list_ptr_ptr",
                true,
              )
            : null;

        console.log(
          `Menu selection request for window ${menuSelectWinid}, how: ${menuSelectHow}, argPtr: ${menuPtrArg}, ptrMode=${ptrMode}, menuListPtrPtr=${menuListPtrPtr}, currentOutPtr=${menuListCurrentOutPtr}`,
        );

        if (menuSelectHow === 2) {
          if (Number.isInteger(this.menuSelectionReadyCount)) {
            const selectionCount = this.menuSelectionReadyCount;
            this.menuSelectionReadyCount = null;
            this.writeMenuSelectionResult(menuListPtrPtr, selectionCount);
            this.menuSelections.clear();
            this.isInMultiPickup = false;
            this.lastMenuInteractionCancelled = false;
            return selectionCount;
          }

          if (this.menuSelections.size > 0 && !this.isInMultiPickup) {
            const selectionCount = this.menuSelections.size;
            this.writeMenuSelectionResult(menuListPtrPtr, selectionCount);
            this.menuSelections.clear();
            this.lastMenuInteractionCancelled = false;
            return selectionCount;
          }

          if (this.isInMultiPickup) {
            console.log(
              "Multi-pickup menu - waiting for completion (async)...",
            );
            this.pendingMenuSelection = {
              resolver: null,
              menuListPtrPtr,
            };
            return new Promise((resolve) => {
              this.pendingMenuSelection = {
                resolver: resolve,
                menuListPtrPtr,
              };
            });
          }
        }

        if (menuSelectHow === 1 && this.menuSelections.size > 0) {
          const selectedItems = Array.from(this.menuSelections.values());
          const selectedItem = selectedItems[0];
          if (selectedItems.length > 1) {
            console.log(
              `PICK_ONE had ${selectedItems.length} selections; using first item only`,
            );
          }
          console.log(
            `Returning single menu selection count: 1 (${selectedItem.menuChar} ${selectedItem.text})`,
          );
          this.menuSelections = new Map([
            [selectedItem.menuChar, selectedItem],
          ]);
          this.writeMenuSelectionResult(menuListPtrPtr, 1);
          this.menuSelections.clear();
          this.isInMultiPickup = false;
          this.lastMenuInteractionCancelled = false;
          return 1;
        }

        const shouldAwaitQuestionlessInventoryPickOne =
          menuSelectHow === 1 &&
          menuSelectWinid === 4 &&
          this.lastEndedMenuWindow === menuSelectWinid &&
          !this.lastEndedMenuHadQuestion &&
          this.lastEndedInventoryMenuKind === "inventory" &&
          this.menuSelections.size === 0 &&
          Array.isArray(this.currentMenuItems) &&
          this.currentMenuItems.some((item) => item && !item.isCategory);

        if (shouldAwaitQuestionlessInventoryPickOne) {
          if (this.pendingGameOverPossessionsInventoryFlow) {
            console.log(
              "Suppressing questionless WIN_INVEN PICK_ONE prompt during game-over possessions flow; returning 0",
            );
            this.pendingGameOverPossessionsInventoryFlow = false;
            this.writeMenuSelectionResult(menuListPtrPtr, 0);
            this.menuSelections.clear();
            this.isInMultiPickup = false;
            return 0;
          }

          if (!this.hasPendingInventoryContextSelection()) {
            console.log(
              "Suppressing questionless WIN_INVEN PICK_ONE prompt for passive inventory refresh; returning 0",
            );
            this.writeMenuSelectionResult(menuListPtrPtr, 0);
            this.menuSelections.clear();
            this.isInMultiPickup = false;
            this.lastMenuInteractionCancelled = false;
            return 0;
          }

          const directInventorySelection =
            this.consumePendingInventoryContextSelection(
              this.currentMenuItems,
              {
                clearOnMiss: false,
                preserveActionRoute: true,
              },
            );
          if (directInventorySelection) {
            if (
              this.tryAutoSelectMenuItem(
                directInventorySelection.menuItem,
                "context action (questionless PICK_ONE)",
                directInventorySelection.selectionCount,
              )
            ) {
              const selectedItems = Array.from(this.menuSelections.values());
              const selectedItem = selectedItems[0];
              if (selectedItem) {
                console.log(
                  `Returning single menu selection count (questionless auto): 1 (${selectedItem.menuChar} ${selectedItem.text})`,
                );
              }
              this.writeMenuSelectionResult(menuListPtrPtr, 1);
              this.menuSelections.clear();
              this.isInMultiPickup = false;
              this.lastMenuInteractionCancelled = false;
              return 1;
            }
          }
          if (
            this.tryAutoRoutePendingInventoryContextSelectionThroughListEverything(
              this.currentMenuItems,
              "context action (questionless PICK_ONE)",
              this.currentMenuQuestionText,
            )
          ) {
            const selectedItems = Array.from(this.menuSelections.values());
            const selectedItem = selectedItems[0];
            if (selectedItem) {
              console.log(
                `Returning single menu selection count (questionless auto via *): 1 (${selectedItem.menuChar} ${selectedItem.text})`,
              );
            }
            this.writeMenuSelectionResult(menuListPtrPtr, 1);
            this.menuSelections.clear();
            this.isInMultiPickup = false;
            this.lastMenuInteractionCancelled = false;
            return 1;
          }
          if (this.hasPendingInventoryContextSelection()) {
            const pending =
              this.pendingInventoryContextSelection &&
              typeof this.pendingInventoryContextSelection === "object"
                ? this.pendingInventoryContextSelection
                : null;
            this.clearPendingInventoryContextSelection(
              pending?.listEverythingFallbackUsed === true
                ? "no matching menu item after * list everything fallback (questionless PICK_ONE)"
                : "no matching menu item for questionless PICK_ONE",
            );
          }

          console.log(
            "PICK_ONE for questionless WIN_INVEN menu - waiting for async selection...",
          );
          if (this.eventHandler) {
            this.currentMenuQuestionText = "Choose an inventory item:";
            this.emit({
              type: "question",
              text: "Choose an inventory item:",
              choices: "",
              default: "",
              menuItems: this.currentMenuItems,
            });
          }

          const pendingSelection = this.waitForQuestionInput();
          const finalizeSelection = () => {
            if (this.menuSelections.size > 0) {
              const selectedItems = Array.from(this.menuSelections.values());
              const selectedItem = selectedItems[0];
              if (selectedItems.length > 1) {
                console.log(
                  `PICK_ONE had ${selectedItems.length} selections after async wait; using first item only`,
                );
              }
              console.log(
                `Returning single menu selection count after async wait: 1 (${selectedItem.menuChar} ${selectedItem.text})`,
              );
              this.menuSelections = new Map([
                [selectedItem.menuChar, selectedItem],
              ]);
              this.writeMenuSelectionResult(menuListPtrPtr, 1);
              this.menuSelections.clear();
              this.isInMultiPickup = false;
              this.lastMenuInteractionCancelled = false;
              return 1;
            }

            if (consumeMenuInteractionCancelled()) {
              console.log(
                "Questionless WIN_INVEN PICK_ONE cancelled; returning -1",
              );
              this.writeMenuSelectionResult(menuListPtrPtr, -1);
              this.menuSelections.clear();
              this.isInMultiPickup = false;
              return -1;
            }

            console.log(
              "Questionless WIN_INVEN PICK_ONE completed with no selection; returning 0",
            );
            this.writeMenuSelectionResult(menuListPtrPtr, 0);
            this.menuSelections.clear();
            this.isInMultiPickup = false;
            return 0;
          };

          if (pendingSelection && typeof pendingSelection.then === "function") {
            return pendingSelection.then(() => finalizeSelection());
          }
          return finalizeSelection();
        }

        if (menuSelectHow === 1) {
          if (consumeMenuInteractionCancelled()) {
            console.log("PICK_ONE cancelled; returning -1");
            this.writeMenuSelectionResult(menuListPtrPtr, -1);
            this.menuSelections.clear();
            this.isInMultiPickup = false;
            return -1;
          }
          console.log("PICK_ONE requested with no selection; returning 0");
          this.writeMenuSelectionResult(menuListPtrPtr, 0);
          this.menuSelections.clear();
          this.isInMultiPickup = false;
          return 0;
        }

        if (menuSelectHow === 2 && this.menuSelections.size > 0) {
          const selectedItems = Array.from(this.menuSelections.values());
          console.log(
            `Returning ${this.menuSelections.size} selected items:`,
            selectedItems.map((item) => `${item.menuChar}:${item.text}`),
          );

          const selectionCount = this.menuSelections.size;
          this.writeMenuSelectionResult(menuListPtrPtr, selectionCount);
          this.menuSelections.clear();
          this.isInMultiPickup = false;
          this.lastMenuInteractionCancelled = false;
          return selectionCount;
        }

        if (menuSelectHow === 2 && consumeMenuInteractionCancelled()) {
          console.log("PICK_ANY cancelled; returning -1");
          this.writeMenuSelectionResult(menuListPtrPtr, -1);
          this.menuSelections.clear();
          this.isInMultiPickup = false;
          return -1;
        }

        console.log("Returning 0 (no selection)");
        this.writeMenuSelectionResult(menuListPtrPtr, 0);
        this.menuSelections.clear();
        return 0;

      case "shim_askname":
        this.nameRequestDebugCounter += 1;
        const askNameCallId = this.nameRequestDebugCounter;
        const configuredName = this.normalizeCharacterNameValue(
          this.startupOptions?.characterCreation?.name,
        );
        console.log("[NAME_DEBUG] shim_askname entered", {
          callId: askNameCallId,
          args,
          pendingTextResponses: this.pendingTextResponses.length,
          configuredName,
          awaitingQuestionInput: this.awaitingQuestionInput,
          activeInputRequestType: this.activeInputRequest?.kind || null,
        });
        if (this.eventHandler) {
          this.emit({
            type: "name_request",
            text: "What is your name?",
            maxLength: 30,
            source: "askname",
            callId: askNameCallId,
            pendingTextResponses: this.pendingTextResponses.length,
          });
        }

        let resolvedName = "";
        if (this.pendingTextResponses.length > 0) {
          const queueBefore = this.pendingTextResponses.length;
          const queuedName = this.normalizeCharacterNameValue(
            String(this.pendingTextResponses.shift() || ""),
          );
          console.log("[NAME_DEBUG] shim_askname consumed queued input", {
            callId: askNameCallId,
            name: queuedName,
            queueBefore,
            queueAfter: this.pendingTextResponses.length,
          });
          if (queuedName.length > 0) {
            resolvedName = queuedName;
          }
        }

        if (!resolvedName && configuredName.length > 0) {
          console.log("[NAME_DEBUG] shim_askname using configured name", {
            callId: askNameCallId,
            configuredName,
          });
          resolvedName = configuredName;
        }

        if (!resolvedName) {
          console.log(
            "[NAME_DEBUG] shim_askname falling back to default Web_user",
            {
              callId: askNameCallId,
            },
          );
          resolvedName = "Web_user";
        }

        const wrotePlayerName = this.setRuntimePlayerName(resolvedName);
        if (!wrotePlayerName) {
          console.log(
            "[NAME_DEBUG] shim_askname could not write player name to runtime globals",
            {
              callId: askNameCallId,
              resolvedName,
            },
          );
        }
        return resolvedName;
      case "shim_mark_synch":
        console.log(`NetHack marking synchronization — glyphs received so far: ${(this as any).__evGlyphCount ?? 0}`);
        return 0;

      case "shim_cliparound":
        const [clipX, clipY] = args;
        console.log(
          `🎯 Cliparound request for position (${clipX}, ${clipY}) - updating player position — total glyphs: ${(this as any).__evGlyphCount ?? 0}`,
        );

        if (this.positionInputActive || this.isFarLookPositionRequest()) {
          console.log(
            `🎯 Cliparound in position-input mode; routing to cursor at (${clipX}, ${clipY})`,
          );
          this.emitPositionCursor(null, clipX, clipY, "cliparound");
          return 0;
        }

        // Update player position when NetHack requests clipping around a position
        const oldPlayerPos = { ...this.playerPosition };
        const didMove =
          oldPlayerPos.x !== clipX || oldPlayerPos.y !== clipY;
        const destinationTileData = this.gameMap.get(`${clipX},${clipY}`);
        const movedOntoMonsterLikeOccupant =
          didMove && this.isMonsterLikeRuntimeMapTile(destinationTileData);
        const movedOntoLootLikeTile =
          didMove && this.isLootLikeRuntimeMapTile(destinationTileData);
        this.playerPosition = { x: clipX, y: clipY };
        if (didMove) {
          this.playerPositionMovementSerial += 1;
        }

        // Send updated player position to client
        if (this.eventHandler) {
          this.emit({
            type: "player_position",
            x: clipX,
            y: clipY,
          });
        }
        if (movedOntoLootLikeTile) {
          this.emitUnderPlayerItemGlyphIfAvailableAt(
            clipX,
            clipY,
            null,
            null,
            true,
            "cliparound-move-onto-loot",
          );
        }
        if (movedOntoMonsterLikeOccupant) {
          this.armPendingPostActionPlayerTileRefreshByReason(
            "monster-like-vacated-tile",
            `after moving onto monster-like occupied tile at (${clipX}, ${clipY}) in case loot was underneath`,
          );
        }
        return 0;

      case "shim_clear_nhwindow":
        const [clearWinId] = args;
        console.log(`🗑️ Clearing window ${clearWinId}`);
        this.resetWindowTextBuffer(clearWinId);

        // If clearing the map window, clear the 3D scene
        if (this.isMapWindow(clearWinId)) {
          console.log("Map window cleared - clearing 3D scene");
          this.emit({
            type: "clear_scene",
            // message: "Level transition - clearing display",
          });
        }
        return 0;

      case "shim_update_positionbar":
        // Positionbar is tty-era UI; map/cliparound events already drive view state.
        return 0;
      case "shim_getmsghistory":
        const [init] = args;
        console.log(`Getting message history, init: ${init}`);
        if (init) {
          this.messageHistorySnapshot = [];
          this.messageHistorySnapshotIndex = 0;
        }
        // Keep this callback non-invasive. The runtime helper's "s" return
        // marshalling expects a writable destination, so we must return empty.
        return "";

      case "shim_putmsghistory":
        const [msg, is_restoring] = args;
        console.log(
          `Putting message history: "${msg}", restoring: ${is_restoring}`,
        );
        if (typeof msg === "string" && msg.trim()) {
          const text = msg.replace(/\u0000/g, "").trim();
          if (text) {
            this.rememberPromptContextMessage(text, "putmsghistory");
            this.gameMessages.push({
              text,
              window: this.getRuntimeWindowId("WIN_MESSAGE"),
              timestamp: Date.now(),
              attr: 0,
            });
            if (this.gameMessages.length > 100) {
              this.gameMessages.shift();
            }
          }
        } else if (is_restoring) {
          // End-of-restore marker from NetHack; reset any active snapshot iteration.
          this.messageHistorySnapshot = [];
          this.messageHistorySnapshotIndex = 0;
        }
        return 0;

      case "shim_doprev_message":
        console.log("Handling previous-message request");
        if (this.eventHandler) {
          const historyLines = this.getRecallableMessageHistoryLines();
          if (historyLines.length > 0) {
            console.log(
              `Emitting info_menu for previous-message request (${historyLines.length} lines)`,
            );
            this.emit({
              type: "info_menu",
              title: "Message History",
              lines: historyLines,
              source: "doprev_message",
            });
          }
        }
        return 0;

      case "shim_exit_nhwindows":
        const [exitMessage] = args;
        const normalizedExitMessage =
          typeof exitMessage === "string"
            ? this.normalizePromptContextMessage(exitMessage)
            : "";
        console.log("Exiting NetHack windows");
        if (normalizedExitMessage && this.eventHandler) {
          this.rememberPromptContextMessage(
            normalizedExitMessage,
            "exit_nhwindows",
          );
          this.emit({
            type: "raw_print",
            text: normalizedExitMessage,
          });
        }
        if (
          (normalizedExitMessage.toLowerCase() === "be seeing you..." ||
            normalizedExitMessage.toLowerCase() === "well... bye.") &&
          !this.runtimeTerminationEmitted
        ) {
          // Manual save/quit can reach exit_nhwindows before the Emscripten
          // quit/onExit hooks fire. Emit a termination fallback so the UI can
          // transition and the worker can flush IDBFS. Stock NetHack/SlashEM
          // use "Be seeing you..."; EvilHack save.c uses "Well... bye.".
          this.emitRuntimeTerminated(normalizedExitMessage, 0);
        }
        return 0;
      case "shim_suspend_nhwindows":
        console.log("Suspending NetHack windows");
        return 0;
      case "shim_resume_nhwindows":
        console.log("Resuming NetHack windows");
        return 0;
      case "shim_destroy_nhwindow":
        const [destroyWinId] = args;
        console.log(`🗑️ Destroying window ${destroyWinId}`);
        this.resetWindowTextBuffer(destroyWinId);
        return 0;
      case "shim_curs":
        const [cursWin, cursX, cursY] = args;
        console.log(
          `🖱️ Setting cursor for window ${cursWin} to (${cursX}, ${cursY})`,
        );
        if (this.positionInputActive || this.isFarLookPositionRequest()) {
          this.emitPositionCursor(cursWin, cursX, cursY, "curs");
        } else if (
          this.eventHandler &&
          Number.isFinite(cursX) &&
          Number.isFinite(cursY) &&
          this.isMapWindow(cursWin)
        ) {
          this.emit({
            type: "map_cursor",
            x: cursX,
            y: cursY,
            window: cursWin,
            source: "curs",
          });
        }
        return 0;

      case "shim_status_update":
        const [field, ptrToArg, chg, percent, color, colormask] = args;
        const fieldName = this.getStatusFieldName(field);
        const isFlushSignal =
          fieldName === "BL_FLUSH" ||
          fieldName === "BL_RESET" ||
          fieldName === "BL_CHARACTERISTICS";
        if (isFlushSignal) {
          this.flushPendingStatusUpdates(fieldName);
          return 0;
        }

        const decoded = this.decodeStatusValue(fieldName, ptrToArg);
        this.recordLastKnownGold(fieldName, decoded.value);
        const statusPayload = {
          type: "status_update",
          field: field,
          fieldName: fieldName,
          value: decoded.value,
          valueType: decoded.valueType,
          ptrToArg: ptrToArg,
          usedFallback: decoded.usedFallback,
          chg: chg,
          percent: percent,
          color: color,
          colormask: colormask,
          levelIdentity: this.resolveRuntimeLevelIdentity(),
        };
        this.statusPending.set(field, statusPayload);
        this.latestStatusUpdates.set(field, statusPayload);
        console.log(
          `Queued status update ${fieldName} (${field}) => ${decoded.value} [type=${decoded.valueType}, fallback=${decoded.usedFallback}]`,
        );
        return 0;

      case "shim_status_enablefield":
        const [
          enabledFieldIndex,
          enabledFieldName,
          enabledFieldFormat,
          enabled,
        ] = args;
        console.log(
          "Status field enable callback:",
          enabledFieldIndex,
          enabledFieldName,
          enabledFieldFormat,
          enabled,
        );
        return 0;
      case "shim_number_pad":
        const [numberPadMode] = args;
        this.numberPadModeEnabled = Number(numberPadMode) !== 0;
        console.log(
          `Number pad mode callback: ${numberPadMode} (enabled=${this.numberPadModeEnabled})`,
        );
        if (this.eventHandler) {
          this.emit({
            type: "number_pad_mode",
            enabled: this.numberPadModeEnabled,
            mode: numberPadMode,
          });
        }
        return 0;

      case "shim_delay_output":
        if (this.runtimeVersion === "5.0") {
          const nowMs = Date.now();
          const latestTurn = this.readLatestStatusInteger("BL_TIME");
          const posX = Number.isFinite(this.playerPosition?.x)
            ? Math.trunc(Number(this.playerPosition.x))
            : null;
          const posY = Number.isFinite(this.playerPosition?.y)
            ? Math.trunc(Number(this.playerPosition.y))
            : null;
          const sameTurn =
            Number.isInteger(latestTurn) &&
            Number.isInteger(this.lastAppliedDelayOutputTurn) &&
            latestTurn === this.lastAppliedDelayOutputTurn;
          const samePosition =
            this.lastAppliedDelayOutputPosition &&
            Number.isInteger(posX) &&
            Number.isInteger(posY) &&
            posX === this.lastAppliedDelayOutputPosition.x &&
            posY === this.lastAppliedDelayOutputPosition.y;
          const movementSerial = Number.isInteger(
            this.playerPositionMovementSerial,
          )
            ? this.playerPositionMovementSerial
            : null;
          const sameMovementStep =
            Number.isInteger(movementSerial) &&
            Number.isInteger(this.lastAppliedDelayOutputMovementSerial) &&
            movementSerial === this.lastAppliedDelayOutputMovementSerial;
          const recentDuplicateWindowMs = Math.max(
            25,
            Number(this.travelSpeedDelayMs) + 40,
          );
          const recentlyAppliedAtSamePosition =
            samePosition &&
            Number.isFinite(this.lastAppliedDelayOutputAtMs) &&
            nowMs - this.lastAppliedDelayOutputAtMs <=
              recentDuplicateWindowMs;
          const oneTurnDriftSamePosition =
            recentlyAppliedAtSamePosition &&
            Number.isInteger(latestTurn) &&
            Number.isInteger(this.lastAppliedDelayOutputTurn) &&
            latestTurn === this.lastAppliedDelayOutputTurn + 1;
          const duplicateTravelDelayAtSameTile =
            samePosition && (sameMovementStep || sameTurn);
          if (duplicateTravelDelayAtSameTile || oneTurnDriftSamePosition) {
            console.log(
              `Skipping duplicate 5.0 travel delay at (${posX}, ${posY}) turn ${latestTurn} (lastTurn=${this.lastAppliedDelayOutputTurn}, movementSerial=${movementSerial}, lastMovementSerial=${this.lastAppliedDelayOutputMovementSerial})`,
            );
            return 0;
          }
          this.lastAppliedDelayOutputTurn = Number.isInteger(latestTurn)
            ? latestTurn
            : null;
          this.lastAppliedDelayOutputPosition =
            Number.isInteger(posX) && Number.isInteger(posY)
              ? { x: posX, y: posY }
              : null;
          this.lastAppliedDelayOutputAtMs = nowMs;
          this.lastAppliedDelayOutputMovementSerial = movementSerial;
        }
        if (this.travelSpeedDelayMs <= 0) {
          if (this.eventHandler) {
            this.emit({
              type: "travel_step_delay",
              delayMs: 0,
            });
          }
          return 0; // No delay for instant
        }
        this.beginClickMoveBlockWindow();
        console.log(
          `NetHack requesting output delay for travel (${this.travelSpeedDelayMs}ms).`,
        );
        if (this.eventHandler) {
          this.emit({
            type: "travel_step_delay",
            delayMs: this.travelSpeedDelayMs,
          });
        }
        return new Promise((resolve) =>
          setTimeout(resolve, this.travelSpeedDelayMs),
        );

      case "shim_change_color":
        // Dynamic color remapping is not used by this client renderer.
        return 0;
      case "shim_change_background":
        return 0;
      case "set_shim_font_name":
        return 0;
      case "shim_get_color_string":
        // 3.6.7 shim marshalling for string returns writes into ret_ptr directly.
        // Keep this empty to avoid corrupting the stack frame.
        return "";
      case "shim_start_screen":
        console.log("NetHack start_screen (no-op)");
        return 0;
      case "shim_end_screen":
        console.log("NetHack end_screen (no-op)");
        return 0;
      case "shim_outrip": {
        const [ripWinId, how, when] = args;
        const winId = Number.isFinite(ripWinId) ? Math.trunc(ripWinId) : null;
        console.log("NetHack outrip (tombstone)", args);
        this.lastGameOverHow = Number.isFinite(how)
          ? Math.trunc(how)
          : this.lastGameOverHow;
        this.lastGameOverWhen = Number.isFinite(when)
          ? Math.trunc(when)
          : this.lastGameOverWhen;
        this.beginGameOverSequence("outrip");

        const tombstoneText = this.buildTombstoneLines(how, when);

        if (winId !== null) {
          this.resetWindowTextBuffer(winId);
          for (const line of tombstoneText) {
            this.appendWindowTextBuffer(winId, line);
          }
        }

        if (this.eventHandler) {
          this.emit({
            type: "outrip",
            args: args,
          });
        }
        return 0;
      }

      case "shim_preference_update":
        // Preferences are already controlled via options/init in this client.
        return 0;
      case "shim_player_selection_cb":
        return true;

      default:
        console.log(`Unknown callback: ${name}`, args);
        return 0;
    }
  }

  flushPendingStatusUpdates(reason = "flush") {
    if (this.statusPending.size === 0) {
      return;
    }

    const orderedUpdates = Array.from(this.statusPending.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, payload]) => payload);
    this.statusPending.clear();

    console.log(
      `Flushing ${orderedUpdates.length} pending status updates (reason=${reason})`,
    );

    for (const payload of orderedUpdates) {
      if (payload && typeof payload.field === "number") {
        this.latestStatusUpdates.set(payload.field, payload);
      }
      if (this.eventHandler) {
        this.emit(payload);
      }
    }
  }

  readLatestStatusInteger(fieldName) {
    const target = String(fieldName || "").trim();
    if (!target) {
      return null;
    }
    let latestPayload = null;
    for (const payload of this.latestStatusUpdates.values()) {
      if (payload && payload.fieldName === target) {
        latestPayload = payload;
      }
    }
    if (!latestPayload) {
      return null;
    }
    const parsed = Number.parseInt(String(latestPayload.value ?? "").trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  emitRuntimeTerminated(reason, exitCode) {
    if (this.runtimeTerminationEmitted) {
      return;
    }
    this.runtimeTerminationEmitted = true;
    this.emit({
      type: "runtime_terminated",
      reason: reason || "Program terminated with exit(0)",
      exitCode: Number.isFinite(exitCode) ? Number(exitCode) : 0,
    });
  }

  emit(payload) {
    if (typeof this.eventHandler === "function") {
      this.eventHandler(payload);
    }
  }
}

export default LocalNetHackRuntime;
