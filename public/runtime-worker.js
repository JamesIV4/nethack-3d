"use strict";
(() => {
  // src/runtime/factory-loader.ts
  function getGlobal() {
    return globalThis;
  }
  async function loadNethackFactory() {
    const g = getGlobal();
    if (typeof g.__nethackFactory === "function") {
      return g.__nethackFactory;
    }
    if (typeof g.Module === "function") {
      g.__nethackFactory = g.Module;
      return g.__nethackFactory;
    }
    if (typeof importScripts === "function") {
      try {
        importScripts("nethack.js");
      } catch (error) {
        throw new Error(`Failed loading nethack.js in worker: ${String(error)}`);
      }
      if (typeof g.Module === "function") {
        g.__nethackFactory = g.Module;
        return g.__nethackFactory;
      }
      throw new Error("nethack.js loaded in worker but factory was not found on globalThis.Module");
    }
    await new Promise((resolve, reject) => {
      const existing = document.querySelector(
        "script[data-nethack-factory='1']"
      );
      if (existing) {
        if (typeof g.Module === "function") {
          g.__nethackFactory = g.Module;
          resolve();
          return;
        }
        existing.addEventListener("load", () => {
          if (typeof g.Module === "function") {
            g.__nethackFactory = g.Module;
            resolve();
            return;
          }
          reject(
            new Error(
              "nethack.js loaded but factory was not found on globalThis.Module"
            )
          );
        });
        existing.addEventListener("error", () => {
          reject(new Error("Failed loading nethack.js"));
        });
        return;
      }
      const script = document.createElement("script");
      script.src = "nethack.js";
      script.async = true;
      script.dataset.nethackFactory = "1";
      script.addEventListener("load", () => {
        if (typeof g.Module === "function") {
          g.__nethackFactory = g.Module;
          resolve();
          return;
        }
        reject(
          new Error(
            "nethack.js loaded but factory was not found on globalThis.Module"
          )
        );
      });
      script.addEventListener("error", () => {
        reject(new Error("Failed loading nethack.js"));
      });
      document.head.appendChild(script);
    });
    if (typeof g.__nethackFactory !== "function") {
      throw new Error("NetHack factory is unavailable after script load");
    }
    return g.__nethackFactory;
  }

  // src/runtime/LocalNetHackRuntime.ts
  var process = typeof globalThis !== "undefined" && globalThis.process ? globalThis.process : { env: {} };
  var LocalNetHackRuntime = class {
    constructor(eventHandler) {
      this.eventHandler = eventHandler;
      this.isClosed = false;
      this.nethackInstance = null;
      this.gameMap = /* @__PURE__ */ new Map();
      this.playerPosition = { x: 0, y: 0 };
      this.gameMessages = [];
      this.latestInventoryItems = [];
      this.latestStatusUpdates = /* @__PURE__ */ new Map();
      this.currentMenuItems = [];
      this.currentWindow = null;
      this.hasShownCharacterSelection = false;
      this.lastQuestionText = null;
      this.menuSelections = /* @__PURE__ */ new Map();
      this.isInMultiPickup = false;
      this.waitingForMenuSelection = false;
      this.menuSelectionResolver = null;
      this.multiPickupReadyToConfirm = false;
      this.pendingMenuListPtrPtr = 0;
      this.queuedInputs = [];
      this.queuedEventInputs = [];
      this.queuedRawKeyCodes = [];
      this.latestInput = null;
      this.waitingForInput = false;
      this.waitingForPosition = false;
      this.inputResolver = null;
      this.positionResolver = null;
      this.lastInputTime = 0;
      this.inputCooldown = 100;
      this.metaInputPrefix = "__META__:";
      this.pendingMapGlyphs = [];
      this.mapGlyphFlushTimer = null;
      this.mapGlyphBatchWindowMs = Number(process.env.NH_MAP_BATCH_MS || 16);
      this.ready = this.initializeNetHack();
    }
    sendReconnectSnapshot() {
      if (!this.eventHandler) {
        return;
      }
      this.emit({
        type: "clear_scene",
        message: "Reconnected - restoring game state"
      });
      const tiles = Array.from(this.gameMap.values());
      const chunkSize = 500;
      for (let i = 0; i < tiles.length; i += chunkSize) {
        this.emit({
          type: "map_glyph_batch",
          tiles: tiles.slice(i, i + chunkSize)
        });
      }
      this.emit({
        type: "player_position",
        x: this.playerPosition.x,
        y: this.playerPosition.y
      });
      for (const payload of this.latestStatusUpdates.values()) {
        this.emit(payload);
      }
      if (this.latestInventoryItems.length > 0) {
        this.emit({
          type: "inventory_update",
          items: this.latestInventoryItems,
          window: 4
        });
      }
      const recentMessages = this.gameMessages.slice(-30);
      for (const msg of recentMessages) {
        this.emit({
          type: "text",
          text: msg.text,
          window: msg.window,
          attr: msg.attr
        });
      }
    }
    async start() {
      await this.ready;
      this.sendReconnectSnapshot();
    }
    sendInput(input) {
      this.handleClientInput(input);
    }
    requestTileUpdate(x, y) {
      this.handleTileUpdateRequest(x, y);
    }
    requestAreaUpdate(centerX, centerY, radius) {
      this.handleAreaUpdateRequest(centerX, centerY, radius);
    }
    shutdown(reason = "session shutdown") {
      if (this.isClosed) {
        return;
      }
      this.isClosed = true;
      console.log(`Shutting down NetHack session: ${reason}`);
      if (this.mapGlyphFlushTimer) {
        clearTimeout(this.mapGlyphFlushTimer);
        this.mapGlyphFlushTimer = null;
      }
      this.pendingMapGlyphs = [];
      this.latestInput = null;
      this.queuedInputs = [];
      this.queuedEventInputs = [];
      this.queuedRawKeyCodes = [];
      this.menuSelections.clear();
      if (this.waitingForMenuSelection && this.menuSelectionResolver) {
        const resolver = this.menuSelectionResolver;
        this.waitingForMenuSelection = false;
        this.menuSelectionResolver = null;
        this.pendingMenuListPtrPtr = 0;
        try {
          resolver(0);
        } catch (error) {
          console.log("Menu selection resolver shutdown error:", error);
        }
      }
      if (this.waitingForInput && this.inputResolver) {
        const resolver = this.inputResolver;
        this.waitingForInput = false;
        this.inputResolver = null;
        try {
          resolver(27);
        } catch (error) {
          console.log("Input resolver shutdown error:", error);
        }
      }
      if (this.waitingForPosition && this.positionResolver) {
        const resolver = this.positionResolver;
        this.waitingForPosition = false;
        this.positionResolver = null;
        try {
          resolver(27);
        } catch (error) {
          console.log("Position resolver shutdown error:", error);
        }
      }
    }
    queueMapGlyphUpdate(tile) {
      if (this.isClosed || !tile || !this.eventHandler) {
        return;
      }
      this.pendingMapGlyphs.push(tile);
      if (this.mapGlyphFlushTimer) {
        return;
      }
      this.mapGlyphFlushTimer = setTimeout(() => {
        this.flushMapGlyphUpdates();
      }, this.mapGlyphBatchWindowMs);
    }
    flushMapGlyphUpdates() {
      if (this.mapGlyphFlushTimer) {
        clearTimeout(this.mapGlyphFlushTimer);
        this.mapGlyphFlushTimer = null;
      }
      if (this.isClosed || !this.pendingMapGlyphs.length || !this.eventHandler) {
        this.pendingMapGlyphs = [];
        return;
      }
      const batch = this.pendingMapGlyphs;
      this.pendingMapGlyphs = [];
      this.emit({
        type: "map_glyph_batch",
        tiles: batch
      });
    }
    // Handle incoming input from the client
    handleClientInput(input) {
      if (this.isClosed) {
        return;
      }
      console.log("\u{1F3AE} Received client input:", input);
      if (this.isMetaInput(input)) {
        const metaKey = input.slice(this.metaInputPrefix.length).charAt(0);
        if (!metaKey) {
          return;
        }
        const escCode = 27;
        const metaCharCode = metaKey.charCodeAt(0);
        this.lastInputTime = Date.now();
        this.latestInput = null;
        if (this.waitingForInput && this.inputResolver) {
          console.log("Meta input routed to event resolver");
          this.waitingForInput = false;
          const resolver = this.inputResolver;
          this.inputResolver = null;
          this.enqueueRawKeyCode(metaCharCode);
          resolver(escCode);
          return;
        }
        this.enqueueRawKeyCode(escCode);
        this.enqueueRawKeyCode(metaCharCode);
        if (this.waitingForPosition && this.positionResolver) {
          console.log("Meta input routed via position resolver with Escape");
          this.waitingForPosition = false;
          const resolver = this.positionResolver;
          this.positionResolver = null;
          resolver(this.queuedRawKeyCodes.shift());
        }
        return;
      }
      this.latestInput = input;
      this.lastInputTime = Date.now();
      if (!this.isInMultiPickup && this.waitingForInput && typeof input === "string" && input.length === 1 && Array.isArray(this.currentMenuItems) && this.currentMenuItems.length > 0) {
        const menuItem = this.currentMenuItems.find(
          (item) => item.accelerator === input && !item.isCategory
        );
        if (menuItem) {
          this.menuSelections.clear();
          this.menuSelections.set(input, {
            menuChar: input,
            originalAccelerator: menuItem.originalAccelerator,
            identifier: menuItem.identifier,
            menuIndex: menuItem.menuIndex,
            text: menuItem.text
          });
          console.log(
            `Recorded single menu selection: ${input} (${menuItem.text})`
          );
        }
      }
      if (this.isInMultiPickup && typeof input === "string" && input.length === 1 && input !== "\r" && input !== "\n") {
        const menuItem = this.currentMenuItems.find(
          (item) => item.accelerator === input && !item.isCategory
        );
        if (menuItem) {
          if (this.menuSelections.has(input)) {
            this.menuSelections.delete(input);
            console.log(
              `Deselected item: ${input} (${menuItem.text}). Current selections:`,
              Array.from(this.menuSelections.keys())
            );
          } else {
            this.menuSelections.set(input, {
              menuChar: input,
              originalAccelerator: menuItem.originalAccelerator,
              identifier: menuItem.identifier,
              menuIndex: menuItem.menuIndex,
              text: menuItem.text
            });
            console.log(
              `Selected item: ${input} (${menuItem.text}). Current selections:`,
              Array.from(this.menuSelections.keys())
            );
          }
        } else {
          console.log(`No menu item found for accelerator '${input}'`);
        }
        console.log("Multi-pickup item selection updated");
        return;
      } else if (this.isInMultiPickup && (input === "Enter" || input === "\r" || input === "\n")) {
        const selectedItems = Array.from(this.menuSelections.values()).map(
          (item) => `${item.menuChar}:${item.text}`
        );
        console.log("Confirming multi-pickup with selections:", selectedItems);
        if (this.waitingForMenuSelection && this.menuSelectionResolver) {
          this.waitingForMenuSelection = false;
          const resolver = this.menuSelectionResolver;
          this.menuSelectionResolver = null;
          const menuListPtrPtr = this.pendingMenuListPtrPtr || 0;
          this.pendingMenuListPtrPtr = 0;
          const selectionCount = this.menuSelections.size;
          this.writeMenuSelectionResult(menuListPtrPtr, selectionCount);
          this.isInMultiPickup = false;
          resolver(selectionCount);
          return;
        }
        this.multiPickupReadyToConfirm = true;
        if (this.waitingForInput && this.inputResolver) {
          this.waitingForInput = false;
          const resolver = this.inputResolver;
          this.inputResolver = null;
          resolver(this.processKey("Enter"));
          return;
        }
        return;
      } else if (this.isInMultiPickup && input === "Escape") {
        this.menuSelections.clear();
        this.multiPickupReadyToConfirm = false;
        if (this.waitingForMenuSelection && this.menuSelectionResolver) {
          this.waitingForMenuSelection = false;
          const resolver = this.menuSelectionResolver;
          this.menuSelectionResolver = null;
          const menuListPtrPtr = this.pendingMenuListPtrPtr || 0;
          this.pendingMenuListPtrPtr = 0;
          this.writeMenuSelectionResult(menuListPtrPtr, 0);
          this.isInMultiPickup = false;
          resolver(0);
          return;
        }
        this.isInMultiPickup = false;
        return;
      }
      if (this.waitingForInput && this.inputResolver) {
        console.log("\u{1F3AE} Resolving waiting input promise with:", input);
        this.waitingForInput = false;
        const resolver = this.inputResolver;
        this.inputResolver = null;
        this.latestInput = null;
        resolver(this.processKey(input));
        return;
      }
      if (this.waitingForPosition && this.positionResolver) {
        console.log("\u{1F3AE} Resolving waiting position promise with:", input);
        this.waitingForPosition = false;
        const resolver = this.positionResolver;
        this.positionResolver = null;
        this.latestInput = null;
        resolver(this.processKey(input));
        return;
      }
      console.log("\u{1F3AE} Storing input for later use:", input);
    }
    // Handle request for tile update from client
    handleTileUpdateRequest(x, y) {
      if (this.isClosed) {
        return;
      }
      console.log(`\u{1F504} Client requested tile update for (${x}, ${y})`);
      const key = `${x},${y}`;
      const tileData = this.gameMap.get(key);
      if (tileData) {
        console.log(`\u{1F4E4} Resending tile data for (${x}, ${y}):`, tileData);
        if (this.eventHandler) {
          this.queueMapGlyphUpdate({
            type: "map_glyph",
            x: tileData.x,
            y: tileData.y,
            glyph: tileData.glyph,
            char: tileData.char,
            color: tileData.color,
            window: 2,
            // WIN_MAP
            isRefresh: true
            // Mark this as a refresh to distinguish from new data
          });
        }
      } else {
        console.log(
          `\u26A0\uFE0F No tile data found for (${x}, ${y}) - tile may not be explored yet`
        );
        if (this.eventHandler) {
          this.emit({
            type: "tile_not_found",
            x,
            y,
            message: "Tile data not available - may not be explored yet"
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
        `\u{1F504} Client requested area update centered at (${centerX}, ${centerY}) with radius ${radius}`
      );
      let tilesRefreshed = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const x = centerX + dx;
          const y = centerY + dy;
          const key = `${x},${y}`;
          const tileData = this.gameMap.get(key);
          if (tileData) {
            if (this.eventHandler) {
              this.queueMapGlyphUpdate({
                type: "map_glyph",
                x: tileData.x,
                y: tileData.y,
                glyph: tileData.glyph,
                char: tileData.char,
                color: tileData.color,
                window: 2,
                // WIN_MAP
                isRefresh: true,
                isAreaRefresh: true
              });
            }
            tilesRefreshed++;
          }
        }
      }
      console.log(
        `\u{1F4E4} Refreshed ${tilesRefreshed} tiles in area around (${centerX}, ${centerY})`
      );
      this.flushMapGlyphUpdates();
      if (this.eventHandler) {
        this.emit({
          type: "area_refresh_complete",
          centerX,
          centerY,
          radius,
          tilesRefreshed
        });
      }
    }
    // Helper method for key processing
    processKey(key) {
      if (typeof key === "string" && key.startsWith(this.metaInputPrefix) && key.length > this.metaInputPrefix.length) {
        const metaKey = key.slice(this.metaInputPrefix.length);
        const primaryKey = metaKey.charAt(0);
        if (!primaryKey) {
          return 0;
        }
        this.enqueueRawKeyCode(primaryKey.charCodeAt(0));
        return 27;
      }
      if (key === " " || key === "Space" || key === "Spacebar" || key === "." || key === "Period" || key === "Decimal" || key === "NumpadDecimal") {
        return ".".charCodeAt(0);
      }
      if (key === "ArrowLeft") return "4".charCodeAt(0);
      if (key === "ArrowRight") return "6".charCodeAt(0);
      if (key === "ArrowUp") return "8".charCodeAt(0);
      if (key === "ArrowDown") return "2".charCodeAt(0);
      if (key === "Enter") return 13;
      if (key === "Escape") return 27;
      if (key.length > 0) return key.charCodeAt(0);
      return 0;
    }
    isMetaInput(key) {
      return typeof key === "string" && key.startsWith(this.metaInputPrefix) && key.length > this.metaInputPrefix.length;
    }
    isPrintableAccelerator(code) {
      return typeof code === "number" && code > 32 && code < 127;
    }
    classifyInventoryWindowMenu(menuItems) {
      const items = Array.isArray(menuItems) ? menuItems : [];
      const nonCategoryItems = items.filter((item) => !item.isCategory);
      const hasCategoryHeaders = items.some((item) => item.isCategory);
      const hasSelectableEntries = nonCategoryItems.some(
        (item) => this.isPrintableAccelerator(item.originalAccelerator) || typeof item.identifier === "number" && item.identifier > 0
      );
      if (items.length === 0) {
        return { kind: "inventory", lines: [] };
      }
      if (hasCategoryHeaders || hasSelectableEntries) {
        return { kind: "inventory", lines: [] };
      }
      const lines = nonCategoryItems.map((item) => String(item.text || "").trim()).filter((text) => text.length > 0);
      return { kind: "info_menu", lines };
    }
    normalizeQuestionText(question) {
      if (typeof question !== "string") {
        return "";
      }
      return question.trim().toLowerCase();
    }
    isContainerLootTypeQuestion(question) {
      const normalized = this.normalizeQuestionText(question);
      const asksObjectTypes = normalized.includes("what types of objects") || normalized.includes("what type of objects");
      const isContainerTransferQuestion = normalized.includes("take out") || normalized.includes("put in");
      return asksObjectTypes && isContainerTransferQuestion;
    }
    isMultiSelectLootQuestion(question) {
      const normalized = this.normalizeQuestionText(question);
      return normalized.includes("pick up what") || normalized.includes("what do you want to pick up") || normalized.includes("take out what") || normalized.includes("put in what") || normalized.includes("what do you want to put in") || normalized.includes("put in, then take out what");
    }
    enqueueInput(input) {
      if (input === void 0 || input === null) {
        return;
      }
      this.queuedInputs.push(input);
      console.log(
        `Queued synthetic input: ${input} (queue size=${this.queuedInputs.length})`
      );
    }
    enqueueEventInput(input) {
      if (input === void 0 || input === null) {
        return;
      }
      this.queuedEventInputs.push(input);
      console.log(
        `Queued event-only input: ${input} (queue size=${this.queuedEventInputs.length})`
      );
    }
    enqueueRawKeyCode(code) {
      if (typeof code !== "number") {
        return;
      }
      this.queuedRawKeyCodes.push(code);
      console.log(
        `Queued raw keycode: ${code} (queue size=${this.queuedRawKeyCodes.length})`
      );
    }
    getStatusFieldName(field) {
      const fallback = {
        0: "BL_TITLE",
        1: "BL_STR",
        2: "BL_DX",
        3: "BL_CO",
        4: "BL_IN",
        5: "BL_WI",
        6: "BL_CH",
        7: "BL_ALIGN",
        8: "BL_SCORE",
        9: "BL_HP",
        10: "BL_HPMAX",
        11: "BL_ENE",
        12: "BL_ENEMAX",
        13: "BL_AC",
        14: "BL_XP",
        15: "BL_EXP",
        16: "BL_TIME",
        17: "BL_HUNGER",
        18: "BL_CAP",
        19: "BL_DNUM",
        20: "BL_DLEVEL",
        21: "BL_GOLD",
        22: "BL_CONDITION",
        23: "BL_FLUSH",
        24: "BL_RESET",
        25: "BL_CHARACTERISTICS"
      };
      if (typeof field !== "number") return String(field);
      const constants = globalThis.nethackGlobal && globalThis.nethackGlobal.constants ? globalThis.nethackGlobal.constants : null;
      if (constants && constants.STATUS_FIELD && constants.STATUS_FIELD[field] !== void 0) {
        return String(constants.STATUS_FIELD[field]);
      }
      return fallback[field] || `FIELD_${field}`;
    }
    decodeShimArgValue(name, ptrToArg, type) {
      if (!this.nethackModule || typeof this.nethackModule.getValue !== "function" || !globalThis.nethackGlobal || !globalThis.nethackGlobal.helpers || typeof globalThis.nethackGlobal.helpers.getPointerValue !== "function") {
        return null;
      }
      const argPtr = this.nethackModule.getValue(ptrToArg, "*");
      return globalThis.nethackGlobal.helpers.getPointerValue(name, argPtr, type);
    }
    decodeStatusValue(fieldName, ptrToArg) {
      const rawPointerFields = /* @__PURE__ */ new Set([
        "BL_CONDITION",
        "BL_RESET",
        "BL_FLUSH",
        "BL_CHARACTERISTICS"
      ]);
      const primaryType = rawPointerFields.has(fieldName) ? "p" : "s";
      const fallbackType = primaryType === "s" ? "p" : "s";
      try {
        const primary = this.decodeShimArgValue(
          "shim_status_update",
          ptrToArg,
          primaryType
        );
        if (primary !== null && primary !== void 0) {
          return {
            value: primary,
            valueType: primaryType,
            usedFallback: false
          };
        }
      } catch (error) {
        console.log(
          `Status decode failed (${fieldName}, ${primaryType})`,
          error && error.message ? error.message : error
        );
      }
      try {
        const fallback = this.decodeShimArgValue(
          "shim_status_update",
          ptrToArg,
          fallbackType
        );
        if (fallback !== null && fallback !== void 0) {
          return {
            value: fallback,
            valueType: fallbackType,
            usedFallback: true
          };
        }
      } catch (error) {
        console.log(
          `Status decode fallback failed (${fieldName}, ${fallbackType})`,
          error && error.message ? error.message : error
        );
      }
      return { value: null, valueType: "unknown", usedFallback: false };
    }
    shouldUseAllCountForMenuItem(item) {
      if (!item || typeof item.text !== "string") {
        return false;
      }
      const text = item.text.trim();
      if (!text) {
        return false;
      }
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
      const heapSize = this.nethackModule.HEAPU8 && this.nethackModule.HEAPU8.length ? this.nethackModule.HEAPU8.length : 0;
      const isAlignedPtr = Number.isInteger(menuListPtrPtr) && menuListPtrPtr > 0 && (menuListPtrPtr & 3) === 0;
      const isInBounds = !heapSize || menuListPtrPtr + 4 <= heapSize;
      if (!isAlignedPtr || !isInBounds) {
        console.log(
          `Skipping menu selection write: invalid menuListPtrPtr=${menuListPtrPtr} (aligned=${isAlignedPtr}, inBounds=${isInBounds}, heapSize=${heapSize})`
        );
        return;
      }
      try {
        const selectedItems = Array.from(this.menuSelections.values());
        const bytesPerMenuItem = Number(process.env.NH_MENU_ITEM_STRIDE || 12);
        const configuredCountOffset = process.env.NH_MENU_COUNT_OFFSET;
        const countOffsetPrimary = configuredCountOffset !== void 0 ? Number(configuredCountOffset) : 4;
        const configuredItemFlagsOffset = process.env.NH_MENU_ITEMFLAGS_OFFSET;
        const itemFlagsOffset = configuredItemFlagsOffset !== void 0 ? Number(configuredItemFlagsOffset) : 8;
        const canWriteCountAt = (offset) => Number.isInteger(offset) && offset >= 0 && offset + 4 <= bytesPerMenuItem;
        if (selectionCount <= 0) {
          this.nethackModule.setValue(menuListPtrPtr, 0, "*");
          console.log(
            `Menu selection write: cleared output pointer at menuListPtrPtr=${menuListPtrPtr}`
          );
          return;
        }
        const priorOutPtr = this.nethackModule.getValue(menuListPtrPtr, "*");
        const outPtr = this.nethackModule._malloc(selectionCount * bytesPerMenuItem);
        this.nethackModule.setValue(menuListPtrPtr, outPtr, "*");
        if (this.nethackModule.HEAPU8 && bytesPerMenuItem > 0) {
          this.nethackModule.HEAPU8.fill(
            0,
            outPtr,
            outPtr + selectionCount * bytesPerMenuItem
          );
        }
        const confirmOutPtr = this.nethackModule.getValue(menuListPtrPtr, "*");
        console.log(
          `Writing ${selectionCount} selections at outPtr=${outPtr} (menuListPtrPtr=${menuListPtrPtr}, priorOutPtr=${priorOutPtr}, confirmOutPtr=${confirmOutPtr}, stride=${bytesPerMenuItem}, countOffsetPrimary=${countOffsetPrimary}, itemFlagsOffset=${itemFlagsOffset})`
        );
        for (let i = 0; i < selectedItems.length; i++) {
          const item = selectedItems[i];
          const structOffset = outPtr + i * bytesPerMenuItem;
          let itemIdentifier = typeof item.identifier === "number" ? item.identifier : item.originalAccelerator;
          if (typeof itemIdentifier !== "number" && typeof item.menuChar === "string" && item.menuChar.length === 1) {
            itemIdentifier = item.menuChar.charCodeAt(0);
          }
          if (typeof itemIdentifier !== "number") {
            console.log(
              `Skipping item ${i} because identifier is not numeric:`,
              itemIdentifier
            );
            continue;
          }
          this.nethackModule.setValue(structOffset, itemIdentifier, "i32");
          const countMode = process.env.NH_MENU_COUNT_MODE || "auto";
          const countValue = countMode === "all" ? -1 : countMode === "one" ? 1 : this.shouldUseAllCountForMenuItem(item) ? -1 : 1;
          if (canWriteCountAt(countOffsetPrimary)) {
            this.nethackModule.setValue(
              structOffset + countOffsetPrimary,
              countValue,
              "i32"
            );
          }
          if (canWriteCountAt(itemFlagsOffset) && itemFlagsOffset !== countOffsetPrimary) {
            this.nethackModule.setValue(
              structOffset + itemFlagsOffset,
              0,
              "i32"
            );
          }
          const debugItem = this.nethackModule.getValue(structOffset, "i32");
          const debugCountPrimary = canWriteCountAt(countOffsetPrimary) ? this.nethackModule.getValue(structOffset + countOffsetPrimary, "i32") : null;
          const debugItemFlags = canWriteCountAt(itemFlagsOffset) && itemFlagsOffset !== countOffsetPrimary ? this.nethackModule.getValue(
            structOffset + itemFlagsOffset,
            "i32"
          ) : null;
          console.log(
            `Wrote menu_item[${i}] => item=${debugItem}, countPrimary=${debugCountPrimary}, itemFlags=${debugItemFlags}, countMode=${countMode}`
          );
        }
        const dumpBytes = Math.min(selectionCount * bytesPerMenuItem, 64);
        const dump = [];
        for (let i = 0; i < dumpBytes; i++) {
          const b = this.nethackModule.getValue(outPtr + i, "i8") & 255;
          dump.push(b.toString(16).padStart(2, "0"));
        }
        console.log(`menu_item buffer dump (${dumpBytes} bytes): ${dump.join(" ")}`);
      } catch (error) {
        console.log("Error writing selections to NetHack memory:", error);
      }
    }
    async initializeNetHack() {
      try {
        console.log("Starting local NetHack session...");
        const factory = await loadNethackFactory();
        globalThis.nethackCallback = (name, ...args) => {
          return this.handleUICallback(name, args);
        };
        if (!globalThis.nethackGlobal) {
          globalThis.nethackGlobal = {
            constants: {
              WIN_TYPE: {
                1: "WIN_MESSAGE",
                2: "WIN_MAP",
                3: "WIN_STATUS",
                4: "WIN_INVEN"
              },
              STATUS_FIELD: {},
              MENU_SELECT: { PICK_NONE: 0, PICK_ONE: 1, PICK_ANY: 2 }
            },
            helpers: {
              getPointerValue: (name, ptr, type) => {
                if (!this.nethackModule) {
                  return ptr;
                }
                switch (type) {
                  case "s":
                    return this.nethackModule.UTF8ToString(ptr);
                  case "p":
                    if (!ptr) return 0;
                    return this.nethackModule.getValue(ptr, "*");
                  case "c":
                    return String.fromCharCode(this.nethackModule.getValue(ptr, "i8"));
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
                  case "s":
                    this.nethackModule.stringToUTF8(String(value), ptr, 1024);
                    break;
                  case "i":
                    this.nethackModule.setValue(ptr, value, "i32");
                    break;
                  case "c":
                    this.nethackModule.setValue(ptr, value, "i8");
                    break;
                  case "f":
                    this.nethackModule.setValue(ptr, value, "float");
                    break;
                  case "d":
                    this.nethackModule.setValue(ptr, value, "double");
                    break;
                  case "v":
                    break;
                  default:
                    break;
                }
              }
            },
            globals: { WIN_MAP: 2, WIN_INVEN: 4, WIN_STATUS: 3, WIN_MESSAGE: 1 }
          };
        }
        let moduleConfig = null;
        moduleConfig = {
          locateFile: (assetPath) => {
            if (assetPath.endsWith(".wasm")) {
              return "nethack.wasm";
            }
            return assetPath;
          },
          preRun: [
            () => {
              if (!moduleConfig.ENV) {
                moduleConfig.ENV = {};
              }
              moduleConfig.ENV.NETHACKOPTIONS = "pickup_types:$,number_pad:1";
            }
          ],
          onRuntimeInitialized: async () => {
            this.nethackModule = moduleConfig;
            try {
              await moduleConfig.ccall(
                "shim_graphics_set_callback",
                null,
                ["string"],
                ["nethackCallback"],
                { async: true }
              );
              if (moduleConfig.js_helpers_init) {
                moduleConfig.js_helpers_init();
              }
            } catch (error) {
              console.error("Error setting up local NetHack runtime:", error);
            }
          }
        };
        this.nethackInstance = await factory(moduleConfig);
      } catch (error) {
        console.error("Error initializing local NetHack:", error);
        throw error;
      }
    }
    handleUICallback(name, args) {
      if (this.isClosed) {
        return 0;
      }
      console.log(`\u{1F3AE} UI Callback: ${name}`, args);
      const processKey = (key) => {
        return this.processKey(key);
      };
      switch (name) {
        case "shim_get_nh_event":
          if (this.queuedRawKeyCodes.length > 0) {
            const rawCode = this.queuedRawKeyCodes.shift();
            console.log(`Using queued raw keycode for event: ${rawCode}`);
            return rawCode;
          }
          if (this.queuedEventInputs.length > 0) {
            const queuedEvent = this.queuedEventInputs.shift();
            console.log(`Using queued event-only input: ${queuedEvent}`);
            return processKey(queuedEvent);
          }
          if (this.queuedInputs.length > 0) {
            const queued = this.queuedInputs.shift();
            console.log(`Using queued input for event: ${queued}`);
            return processKey(queued);
          }
          const timeSinceInput = Date.now() - this.lastInputTime;
          if (this.latestInput && timeSinceInput < this.inputCooldown) {
            const input = this.latestInput;
            this.latestInput = null;
            console.log(
              `\u{1F3AE} Reusing recent input for event: ${input} (${timeSinceInput}ms ago)`
            );
            return processKey(input);
          }
          console.log("\u{1F3AE} Waiting for player input (async)...");
          return new Promise((resolve) => {
            this.inputResolver = resolve;
            this.waitingForInput = true;
          });
        case "shim_yn_function":
          const [question, choices, defaultChoice] = args;
          console.log(
            `\u{1F914} Y/N Question: "${question}" choices: "${choices}" default: ${defaultChoice}`
          );
          this.lastQuestionText = question;
          if (this.isContainerLootTypeQuestion(question)) {
            console.log('Auto-answering container loot type question with "a"');
            return processKey("a");
          }
          if (question && question.toLowerCase().includes("direction")) {
            console.log(
              "\u{1F9ED} Direction question detected - waiting for user input"
            );
            if (this.eventHandler) {
              this.emit({
                type: "direction_question",
                text: question,
                choices,
                default: defaultChoice
              });
            }
            console.log("\u{1F9ED} Waiting for direction input (async)...");
            return new Promise((resolve) => {
              this.inputResolver = resolve;
              this.waitingForInput = true;
            });
          }
          if (this.eventHandler) {
            this.emit({
              type: "question",
              text: question,
              choices,
              default: defaultChoice,
              // Only include menuItems if this is actually a menu question, not a simple Y/N
              menuItems: []
            });
          }
          console.log("\u{1F914} Y/N Question - waiting for user input (async)...");
          return new Promise((resolve) => {
            this.inputResolver = resolve;
            this.waitingForInput = true;
          });
        case "shim_nh_poskey":
          const [xPtr, yPtr, modPtr] = args;
          console.log("\u{1F3AE} NetHack requesting position key");
          if (this.queuedRawKeyCodes.length > 0) {
            const rawCode = this.queuedRawKeyCodes.shift();
            console.log(`Using queued raw keycode for position: ${rawCode}`);
            return rawCode;
          }
          if (this.queuedInputs.length > 0) {
            const queued = this.queuedInputs.shift();
            console.log(`Using queued input for position: ${queued}`);
            return processKey(queued);
          }
          const timeSincePositionInput = Date.now() - this.lastInputTime;
          if (this.latestInput && !this.isMetaInput(this.latestInput) && timeSincePositionInput < this.inputCooldown) {
            const input = this.latestInput;
            if (input === ";") {
              console.log(
                "\u{1F3AE} Ignoring recent ';' for position input to keep far-look active"
              );
            } else {
              this.latestInput = null;
              console.log(
                `\u{1F3AE} Using recent input for position: ${input} (${timeSincePositionInput}ms ago)`
              );
              return processKey(input);
            }
          }
          console.log("\u{1F3AE} Waiting for position input (async)...");
          return new Promise((resolve) => {
            this.positionResolver = resolve;
            this.waitingForPosition = true;
          });
        case "shim_init_nhwindows":
          console.log("Initializing NetHack windows");
          if (this.eventHandler) {
            this.emit({
              type: "name_request",
              text: "What is your name, adventurer?",
              maxLength: 30
            });
          }
          return 1;
        case "shim_create_nhwindow":
          const [windowType] = args;
          console.log(
            `Creating window [ ${windowType} ] returning ${windowType}`
          );
          return windowType;
        case "shim_status_init":
          console.log("Initializing status display");
          return 0;
        case "shim_start_menu":
          const [menuWinId, menuOptions] = args;
          console.log("NetHack starting menu:", args);
          this.currentMenuItems = [];
          this.currentWindow = menuWinId;
          this.lastQuestionText = null;
          this.menuSelections.clear();
          this.isInMultiPickup = false;
          this.multiPickupReadyToConfirm = false;
          if (this.waitingForMenuSelection && this.menuSelectionResolver) {
            console.log("\u{1F4CB} Clearing previous menu selection resolver");
            this.waitingForMenuSelection = false;
            this.menuSelectionResolver = null;
          }
          const windowTypes = {
            1: "WIN_MESSAGE",
            2: "WIN_MAP",
            3: "WIN_STATUS",
            4: "WIN_INVEN"
          };
          console.log(
            `\u{1F4CB} Starting menu for window ${menuWinId} (${windowTypes[menuWinId] || "UNKNOWN"})`
          );
          return 0;
        case "shim_end_menu":
          const [endMenuWinid, menuQuestion] = args;
          console.log("NetHack ending menu:", args);
          const isInventoryWindow = endMenuWinid === 4;
          const hasMenuQuestion = menuQuestion && menuQuestion.trim();
          console.log(
            `\u{1F4CB} Menu ending - Window: ${endMenuWinid}, Question: "${menuQuestion}", Items: ${this.currentMenuItems.length}`
          );
          if (isInventoryWindow && !hasMenuQuestion) {
            const classification = this.classifyInventoryWindowMenu(
              this.currentMenuItems
            );
            const actualItems = this.currentMenuItems.filter(
              (item) => !item.isCategory
            );
            const categoryHeaders = this.currentMenuItems.filter(
              (item) => item.isCategory
            );
            console.log(
              `WIN_INVEN no-question menu classified as ${classification.kind} (${actualItems.length} items, ${categoryHeaders.length} categories)`
            );
            if (this.eventHandler) {
              if (classification.kind === "inventory") {
                this.latestInventoryItems = [...this.currentMenuItems];
                this.emit({
                  type: "inventory_update",
                  items: this.currentMenuItems,
                  window: endMenuWinid
                });
              } else {
                const infoLines = classification.lines;
                const infoTitle = infoLines.length > 0 ? infoLines[0] : "NetHack Information";
                const infoBody = infoLines.length > 1 ? infoLines.slice(1) : infoLines;
                this.emit({
                  type: "info_menu",
                  title: infoTitle,
                  lines: infoBody,
                  window: endMenuWinid
                });
              }
            }
            return 0;
          }
          if (isInventoryWindow && hasMenuQuestion) {
            console.log(
              `\u{1F4CB} Inventory action question detected: "${menuQuestion}" with ${this.currentMenuItems.length} items`
            );
            const isMultiSelectQuestion = this.isMultiSelectLootQuestion(menuQuestion);
            if (isMultiSelectQuestion) {
              console.log("Multi-select loot dialog detected");
              this.isInMultiPickup = true;
            }
            if (this.eventHandler) {
              this.emit({
                type: "question",
                text: menuQuestion,
                choices: "",
                default: "",
                menuItems: this.currentMenuItems
              });
            }
            console.log("\u{1F4CB} Waiting for inventory action selection (async)...");
            return new Promise((resolve) => {
              this.inputResolver = resolve;
              this.waitingForInput = true;
            });
          }
          if (hasMenuQuestion && this.currentMenuItems.length > 0) {
            console.log(
              `\u{1F4CB} Menu question detected: "${menuQuestion}" with ${this.currentMenuItems.length} items`
            );
            if (this.isMultiSelectLootQuestion(menuQuestion)) {
              console.log("Multi-select loot menu detected");
              this.isInMultiPickup = true;
            }
            if (this.eventHandler) {
              this.emit({
                type: "question",
                text: menuQuestion,
                choices: "",
                default: "",
                menuItems: this.currentMenuItems
              });
            }
            console.log("\u{1F4CB} Waiting for menu selection (async)...");
            return new Promise((resolve) => {
              this.inputResolver = resolve;
              this.waitingForInput = true;
            });
          }
          if (this.currentMenuItems.length > 0 && !hasMenuQuestion && !isInventoryWindow) {
            console.log(
              `\u{1F4CB} Menu expansion detected with ${this.currentMenuItems.length} items (window ${endMenuWinid})`
            );
            let contextualQuestion = "Please select an option:";
            const selectableItems = this.currentMenuItems.filter(
              (item) => !item.isCategory
            );
            console.log(
              `\u{1F4CB} Found ${selectableItems.length} selectable items out of ${this.currentMenuItems.length} total`
            );
            if (selectableItems.some(
              (item) => item.text && typeof item.text === "string" && (item.text.includes("gold pieces") || item.text.includes("corpse") || item.text.includes("here"))
            )) {
              contextualQuestion = "What would you like to pick up?";
            } else if (selectableItems.some(
              (item) => item.text && typeof item.text === "string" && (item.text.includes("spell") || item.text.includes("magic"))
            )) {
              contextualQuestion = "Which spell would you like to cast?";
            } else if (selectableItems.some(
              (item) => item.text && typeof item.text === "string" && (item.text.includes("wear") || item.text.includes("wield") || item.text.includes("armor"))
            )) {
              contextualQuestion = "What would you like to use?";
            }
            if (selectableItems.length > 0) {
              if (this.isMultiSelectLootQuestion(contextualQuestion)) {
                console.log("Expanded multi-select loot menu detected");
                this.isInMultiPickup = true;
              }
              if (this.eventHandler) {
                this.emit({
                  type: "question",
                  text: contextualQuestion,
                  choices: "",
                  default: "",
                  menuItems: this.currentMenuItems
                });
              }
              console.log("\u{1F4CB} Waiting for expanded menu selection (async)...");
              return new Promise((resolve) => {
                this.inputResolver = resolve;
                this.waitingForInput = true;
              });
            } else {
              console.log(
                "\u{1F4CB} Menu has no selectable items - treating as informational"
              );
            }
          }
          return 0;
        case "shim_display_nhwindow":
          const [winid, blocking] = args;
          console.log(`\u{1F5A5}\uFE0F DISPLAY WINDOW [Win ${winid}], blocking: ${blocking}`);
          return 0;
        case "shim_add_menu":
          const [
            menuWinid,
            menuGlyph,
            identifier,
            accelerator,
            groupacc,
            menuAttr,
            menuStr,
            preselected
          ] = args;
          const menuText = String(args[6] || "");
          const isCategory = menuAttr === 7;
          let menuChar = "";
          let glyphChar = "";
          if (menuGlyph && globalThis.nethackGlobal && globalThis.nethackGlobal.helpers && globalThis.nethackGlobal.helpers.mapglyphHelper) {
            try {
              const glyphInfo = globalThis.nethackGlobal.helpers.mapglyphHelper(
                menuGlyph,
                0,
                0,
                0
                // x, y, and other params not needed for menu items
              );
              if (glyphInfo && glyphInfo.ch !== void 0) {
                glyphChar = String.fromCharCode(glyphInfo.ch);
              }
            } catch (error) {
              console.log(
                `\u26A0\uFE0F Error getting glyph info for menu glyph ${menuGlyph}:`,
                error
              );
            }
          }
          if (!isCategory) {
            if (typeof accelerator === "number" && accelerator > 32 && accelerator < 127) {
              menuChar = String.fromCharCode(accelerator);
            } else {
              const existingItems = this.currentMenuItems.filter(
                (item) => !item.isCategory
              );
              const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
              if (existingItems.length < alphabet.length) {
                menuChar = alphabet[existingItems.length];
              } else {
                menuChar = "?";
              }
            }
            console.log(
              `\u{1F4CB} MENU ITEM: "${menuText}" (key: ${menuChar}) glyph: ${menuGlyph} -> "${glyphChar}" - accelerator code: ${accelerator}`
            );
          } else {
            console.log(
              `\u{1F4CB} CATEGORY HEADER: "${menuText}" - accelerator code: ${accelerator}`
            );
          }
          if (this.currentWindow === menuWinid && menuText) {
            this.currentMenuItems.push({
              text: menuText,
              accelerator: menuChar,
              originalAccelerator: accelerator,
              // Store the original accelerator code
              identifier,
              // NetHack menu identifier used by shim_select_menu
              window: menuWinid,
              glyph: menuGlyph,
              glyphChar,
              // Add the visual character representation
              isCategory,
              menuIndex: this.currentMenuItems.length
              // Store the menu item index
            });
          }
          if (this.eventHandler) {
            this.emit({
              type: "menu_item",
              text: menuText,
              accelerator: menuChar,
              window: menuWinid,
              glyph: menuGlyph,
              glyphChar,
              // Include glyph character in client message
              isCategory,
              menuItems: this.currentMenuItems
            });
          }
          return 0;
        case "shim_putstr":
          const [win, textAttr, textStr] = args;
          console.log(`\u{1F4AC} TEXT [Win ${win}]: "${textStr}"`);
          this.gameMessages.push({
            text: textStr,
            window: win,
            timestamp: Date.now(),
            attr: textAttr
          });
          if (this.gameMessages.length > 100) {
            this.gameMessages.shift();
          }
          if (this.eventHandler) {
            this.emit({
              type: "text",
              text: textStr,
              window: win,
              attr: textAttr
            });
          }
          return 0;
        case "shim_print_glyph":
          const [printWin, x, y, printGlyph] = args;
          console.log(`\u{1F3A8} GLYPH [Win ${printWin}] at (${x},${y}): ${printGlyph}`);
          if (printWin === 3) {
            const key = `${x},${y}`;
            let glyphChar2 = null;
            let glyphColor = null;
            if (globalThis.nethackGlobal && globalThis.nethackGlobal.helpers && globalThis.nethackGlobal.helpers.mapglyphHelper) {
              try {
                const glyphInfo = globalThis.nethackGlobal.helpers.mapglyphHelper(
                  printGlyph,
                  x,
                  y,
                  0
                );
                console.log(
                  `\u{1F50D} Raw glyphInfo for glyph ${printGlyph}:`,
                  glyphInfo
                );
                if (glyphInfo && glyphInfo.ch !== void 0) {
                  glyphChar2 = String.fromCharCode(glyphInfo.ch);
                  glyphColor = glyphInfo.color;
                  console.log(
                    `\u{1F524} Glyph ${printGlyph} -> "${glyphChar2}" (ASCII ${glyphInfo.ch}) color ${glyphColor}`
                  );
                } else {
                  console.log(
                    `\u26A0\uFE0F No character info for glyph ${printGlyph}, glyphInfo:`,
                    glyphInfo
                  );
                }
              } catch (error) {
                console.log(
                  `\u26A0\uFE0F Error getting glyph info for ${printGlyph}:`,
                  error
                );
              }
            } else {
              console.log(`\u26A0\uFE0F mapglyphHelper not available`);
            }
            this.gameMap.set(key, {
              x,
              y,
              glyph: printGlyph,
              char: glyphChar2,
              color: glyphColor,
              timestamp: Date.now()
            });
            if (this.eventHandler) {
              this.queueMapGlyphUpdate({
                type: "map_glyph",
                x,
                y,
                glyph: printGlyph,
                char: glyphChar2,
                color: glyphColor,
                window: printWin
              });
            }
          }
          return 0;
        case "shim_player_selection":
          console.log("NetHack player selection started");
        // Comment out character selection UI for automatic play        return 0;
        case "shim_raw_print":
          const [rawText] = args;
          console.log(`\u{1F4E2} RAW PRINT: "${rawText}"`);
          if (this.eventHandler && rawText && rawText.trim()) {
            this.emit({
              type: "raw_print",
              text: rawText.trim()
            });
          }
          return 0;
        case "shim_wait_synch":
          console.log("NetHack waiting for synchronization");
          return 0;
        case "shim_select_menu":
          const [menuSelectWinid, menuSelectHow, menuPtrArg] = args;
          let ptrArgSlot = 0;
          let ptrArgValue = 0;
          let ptrResolvedValue = 0;
          if (this.nethackModule && typeof this.nethackModule.getValue === "function") {
            ptrArgSlot = menuPtrArg;
            try {
              ptrArgValue = this.nethackModule.getValue(menuPtrArg, "*");
              if (ptrArgValue > 0) {
                ptrResolvedValue = this.nethackModule.getValue(ptrArgValue, "*");
              }
            } catch (error) {
              console.log("Pointer decode error in shim_select_menu:", error);
            }
          }
          const isPlausiblePtr = (ptr) => Number.isInteger(ptr) && ptr > 0 && (ptr & 3) === 0;
          const ptrMode = isPlausiblePtr(ptrArgValue) ? "arg" : isPlausiblePtr(ptrResolvedValue) ? "resolved_fallback" : "invalid";
          const menuListPtrPtr = isPlausiblePtr(ptrArgValue) ? ptrArgValue : isPlausiblePtr(ptrResolvedValue) ? ptrResolvedValue : 0;
          console.log(
            `\u{1F4CB} Menu selection request for window ${menuSelectWinid}, how: ${menuSelectHow}, argPtr: ${menuPtrArg}, ptrArgSlot=${ptrArgSlot}, ptrArgValue=${ptrArgValue}, ptrResolvedValue=${ptrResolvedValue}, ptrMode=${ptrMode}, menuListPtrPtr=${menuListPtrPtr}`
          );
          if (menuSelectHow === 2 && this.isInMultiPickup) {
            if (this.multiPickupReadyToConfirm) {
              console.log(
                "\u{1F4CB} Multi-pickup already confirmed - returning selection count immediately"
              );
              const selectionCount = this.menuSelections.size;
              this.writeMenuSelectionResult(menuListPtrPtr, selectionCount);
              this.menuSelections.clear();
              this.isInMultiPickup = false;
              this.multiPickupReadyToConfirm = false;
              return selectionCount;
            }
            console.log(
              "\u{1F4CB} Multi-pickup menu - waiting for completion (async)..."
            );
            this.pendingMenuListPtrPtr = menuListPtrPtr;
            return new Promise((resolve) => {
              this.menuSelectionResolver = resolve;
              this.waitingForMenuSelection = true;
            });
          }
          if (menuSelectHow === 1 && this.menuSelections.size > 0) {
            const selectedItems = Array.from(this.menuSelections.values());
            const selectedItem = selectedItems[0];
            if (selectedItems.length > 1) {
              console.log(
                `PICK_ONE had ${selectedItems.length} selections; using first item only`
              );
            }
            console.log(
              `Returning single menu selection count: 1 (${selectedItem.menuChar} ${selectedItem.text})`
            );
            this.menuSelections = /* @__PURE__ */ new Map([[selectedItem.menuChar, selectedItem]]);
            this.writeMenuSelectionResult(menuListPtrPtr, 1);
            this.menuSelections.clear();
            this.isInMultiPickup = false;
            this.multiPickupReadyToConfirm = false;
            return 1;
          }
          if (menuSelectHow === 1) {
            console.log("PICK_ONE requested with no selection; returning 0");
            this.writeMenuSelectionResult(menuListPtrPtr, 0);
            this.menuSelections.clear();
            this.isInMultiPickup = false;
            this.multiPickupReadyToConfirm = false;
            return 0;
          }
          if (menuSelectHow === 2 && this.menuSelections.size > 0) {
            const selectedItems = Array.from(this.menuSelections.values());
            console.log(
              `?? Returning ${this.menuSelections.size} selected items:`,
              selectedItems.map((item) => `${item.menuChar}:${item.text}`)
            );
            const selectionCount = this.menuSelections.size;
            this.writeMenuSelectionResult(menuListPtrPtr, selectionCount);
            this.menuSelections.clear();
            this.isInMultiPickup = false;
            this.multiPickupReadyToConfirm = false;
            return selectionCount;
          }
          console.log("Returning 0 (no selection)");
          this.writeMenuSelectionResult(menuListPtrPtr, 0);
          this.menuSelections.clear();
          this.multiPickupReadyToConfirm = false;
          return 0;
        case "shim_askname":
          console.log("NetHack is asking for player name, args:", args);
          if (this.eventHandler) {
            this.emit({
              type: "name_request",
              text: "What is your name?",
              maxLength: 30
            });
          }
          if (this.latestInput) {
            const name2 = this.latestInput;
            this.latestInput = null;
            console.log(`Using player name from input: ${name2}`);
            return name2;
          }
          console.log("No name provided, using default");
          return "Player";
        case "shim_mark_synch":
          console.log("NetHack marking synchronization");
          return 0;
        case "shim_cliparound":
          const [clipX, clipY] = args;
          console.log(
            `\u{1F3AF} Cliparound request for position (${clipX}, ${clipY}) - updating player position`
          );
          const oldPlayerPos = { ...this.playerPosition };
          this.playerPosition = { x: clipX, y: clipY };
          if (this.eventHandler) {
            this.emit({
              type: "player_position",
              x: clipX,
              y: clipY
            });
            this.emit({
              type: "force_player_redraw",
              oldPosition: oldPlayerPos,
              newPosition: { x: clipX, y: clipY }
            });
          }
          return 0;
        case "shim_clear_nhwindow":
          const [clearWinId] = args;
          console.log(`\u{1F5D1}\uFE0F Clearing window ${clearWinId}`);
          if (clearWinId === 2 || clearWinId === 3) {
            console.log("Map window cleared - clearing 3D scene");
            this.emit({
              type: "clear_scene",
              message: "Level transition - clearing display"
            });
          }
          return 0;
        case "shim_getmsghistory":
          const [init] = args;
          console.log(`Getting message history, init: ${init}`);
          return "";
        case "shim_putmsghistory":
          const [msg, is_restoring] = args;
          console.log(
            `Putting message history: "${msg}", restoring: ${is_restoring}`
          );
          return 0;
        case "shim_exit_nhwindows":
          console.log("Exiting NetHack windows");
          return 0;
        case "shim_destroy_nhwindow":
          const [destroyWinId] = args;
          console.log(`\u{1F5D1}\uFE0F Destroying window ${destroyWinId}`);
          return 0;
        case "shim_curs":
          const [cursWin, cursX, cursY] = args;
          console.log(
            `\u{1F5B1}\uFE0F Setting cursor for window ${cursWin} to (${cursX}, ${cursY})`
          );
          return 0;
        case "shim_status_update":
          const [field, ptrToArg, chg, percent, color, colormask] = args;
          const fieldName = this.getStatusFieldName(field);
          const decoded = this.decodeStatusValue(fieldName, ptrToArg);
          const statusPayload = {
            type: "status_update",
            field,
            fieldName,
            value: decoded.value,
            valueType: decoded.valueType,
            ptrToArg,
            usedFallback: decoded.usedFallback,
            chg,
            percent,
            color,
            colormask
          };
          this.latestStatusUpdates.set(field, statusPayload);
          console.log(
            `Status update ${fieldName} (${field}) => ${decoded.value} [type=${decoded.valueType}, fallback=${decoded.usedFallback}]`
          );
          if (this.eventHandler) {
            this.emit(statusPayload);
          }
          return 0;
        default:
          console.log(`Unknown callback: ${name}`, args);
          return 0;
      }
    }
    emit(payload) {
      if (typeof this.eventHandler === "function") {
        this.eventHandler(payload);
      }
    }
  };
  var LocalNetHackRuntime_default = LocalNetHackRuntime;

  // src/runtime/runtime-worker.ts
  var runtime = null;
  var started = false;
  function postEnvelope(envelope) {
    self.postMessage(envelope);
  }
  function ensureRuntime() {
    if (!runtime) {
      runtime = new LocalNetHackRuntime_default((event) => {
        postEnvelope({ type: "runtime_event", event });
      });
    }
    return runtime;
  }
  self.onmessage = async (message) => {
    try {
      const command = message.data;
      const instance = ensureRuntime();
      switch (command.type) {
        case "start":
          if (!started) {
            await instance.start();
            started = true;
          }
          postEnvelope({ type: "runtime_ready" });
          return;
        case "send_input":
          instance.sendInput(command.input);
          return;
        case "request_tile_update":
          instance.requestTileUpdate(command.x, command.y);
          return;
        case "request_area_update":
          instance.requestAreaUpdate(
            command.centerX,
            command.centerY,
            command.radius
          );
          return;
        default:
          return;
      }
    } catch (error) {
      postEnvelope({
        type: "runtime_error",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };
})();
