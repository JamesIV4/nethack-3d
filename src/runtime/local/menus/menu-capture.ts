// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeMenuSelection } from "./selection";
import type { RuntimeQuestionInput } from "../input/questions";
import type { RuntimeInventorySnapshots } from "./inventory-snapshots";
import type { RuntimeWindowText } from "../messages/window-text";
import type { RuntimeWindows } from "../messages/windows";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimePointerContract } from "../abi/pointer-contract";
import type { RuntimeMemory } from "../abi/memory";
import type { RuntimeGlyphs } from "../world/glyphs";
import type { RuntimeTileContextMenus } from "./tile-context";
import type { RuntimeInventoryContext } from "./inventory-context";
import type { RuntimeInputRequests } from "../input/input-requests";
import type { RuntimePostActionRefresh } from "../world/post-action-refresh";

export interface RuntimeMenuCaptureDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
    | "runtimeVersion"
  >;
  readonly inputRequests: Pick<
    RuntimeInputRequests,
    "waitForQuestionInput"
  >;
  readonly inventoryContext: Pick<
    RuntimeInventoryContext,
    "tryAutoHandlePendingInventoryContextSelection"
  >;
  readonly inventorySnapshots: Pick<
    RuntimeInventorySnapshots,
    "classifyInventoryWindowMenu"
    | "inferQuestionlessInventoryCategories"
    | "lastEndedInventoryMenuKind"
    | "latestInventoryItems"
  >;
  readonly memory: Pick<
    RuntimeMemory,
    "decodeGlyphInfoPointer"
    | "readPointerSlotValue"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "currentMenuItems"
    | "currentMenuQuestionText"
    | "currentWindow"
    | "getPrintableAcceleratorCharacter"
    | "isInMultiPickup"
    | "isLegacyMenuAcceleratorRuntime"
    | "isMultiSelectLootQuestion"
    | "lastEndedMenuHadQuestion"
    | "lastEndedMenuWindow"
    | "lastMenuInteractionCancelled"
    | "menuSelectionReadyCount"
    | "menuSelections"
    | "pendingMenuSelection"
  >;
  readonly pointerContract: Pick<
    RuntimePointerContract,
    "getRuntimePointerContract"
  >;
  readonly postActionRefresh: Pick<
    RuntimePostActionRefresh,
    "maybeRefreshPendingPostActionPlayerTile"
    | "pendingPostActionPlayerTileRefreshReason"
    | "pendingPostActionPlayerTileRefreshTarget"
  >;
  readonly questionInput: Pick<
    RuntimeQuestionInput,
    "lastQuestionText"
  >;
  readonly runtimeGlyphs: Pick<
    RuntimeGlyphs,
    "getNoGlyphValue"
  >;
  readonly tileContextMenus: Pick<
    RuntimeTileContextMenus,
    "tryAutoPickRuntime5TileContextMenuItem"
  >;
  readonly windows: Pick<
    RuntimeWindows,
    "getRuntimeWindowTypeLabels"
    | "isInventoryWindow"
  >;
  readonly windowText: Pick<
    RuntimeWindowText,
    "resetWindowTextBuffer"
  >;
}

/** Menu row decoding, capture and inventory/question publication. */
export class RuntimeMenuCapture {
  declare hasShownCharacterSelection: boolean;

  constructor(private readonly deps: RuntimeMenuCaptureDependencies) {
    this.hasShownCharacterSelection = false;
  }

  handleShimStartMenu(args) {
    const [menuWinId, menuOptions] = args;
    console.log("NetHack starting menu:", args);
    this.deps.menuSelection.currentMenuItems = []; // Clear previous menu items
    this.deps.menuSelection.currentWindow = menuWinId;
    this.deps.menuSelection.currentMenuQuestionText = "";
    this.deps.questionInput.lastQuestionText = null; // Clear any previous question text when starting new menu
    this.deps.menuSelection.lastEndedMenuWindow = null;
    this.deps.menuSelection.lastEndedMenuHadQuestion = false;
    this.deps.inventorySnapshots.lastEndedInventoryMenuKind = null;
    this.deps.menuSelection.lastMenuInteractionCancelled = false;
    this.deps.windowText.resetWindowTextBuffer(menuWinId);

    // Reset selection tracking for new menus
    this.deps.menuSelection.menuSelections.clear();
    this.deps.menuSelection.isInMultiPickup = false;
    this.deps.menuSelection.menuSelectionReadyCount = null;

    if (this.deps.menuSelection.pendingMenuSelection) {
      console.log("Clearing previous pending menu selection resolver");
      this.deps.menuSelection.pendingMenuSelection = null;
    }

    // Log window type for debugging
    const windowTypes = this.deps.windows.getRuntimeWindowTypeLabels(this.deps.coordinator.runtimeVersion);
    console.log(
      `📋 Starting menu for window ${menuWinId} (${windowTypes[menuWinId] || "UNKNOWN"
      })`,
    );
    return 0;
  }

  handleShimAddMenu(args) {
    const pointerContract = this.deps.pointerContract.getRuntimePointerContract();
    const addMenuMode = pointerContract?.callbackModes?.shim_add_menu || {};
    const menuTextArgIndex = Number.isInteger(addMenuMode.menuTextArgIndex)
      ? addMenuMode.menuTextArgIndex
      : this.deps.coordinator.runtimeVersion === "5.0"
        ? 7
        : 6;
    const itemFlagsArgIndex = Number.isInteger(addMenuMode.itemFlagsArgIndex)
      ? addMenuMode.itemFlagsArgIndex
      : this.deps.coordinator.runtimeVersion === "5.0"
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
        this.deps.menuSelection.isLegacyMenuAcceleratorRuntime()
        ? rawAccelerator
        : Number.isFinite(Number(rawAccelerator))
          ? Math.trunc(Number(rawAccelerator))
          : rawAccelerator;
    const groupAccelerator =
      typeof rawGroupAccelerator === "string" &&
        this.deps.menuSelection.isLegacyMenuAcceleratorRuntime()
        ? rawGroupAccelerator
        : Number.isFinite(Number(rawGroupAccelerator))
          ? Math.trunc(Number(rawGroupAccelerator))
          : rawGroupAccelerator;
    const printableGroupAccelerator =
      this.deps.menuSelection.getPrintableAcceleratorCharacter(groupAccelerator);
    const menuAttr = Number(args[5]);
    const menuText = String((args[menuTextArgIndex] ?? "") || "");
    const menuItemFlags = Number(args[itemFlagsArgIndex] ?? 0);

    // In this callback shape, category headers are identified by menuAttr=7.
    const isCategory = menuAttr === 7;
    const identifierValue =
      identifierMode === "pointer_slot"
        ? this.deps.memory.readPointerSlotValue(identifier, "menu_identifier_ptr")
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
    const noGlyphValue = this.deps.runtimeGlyphs.getNoGlyphValue();

    // Convert glyph to visual character and tile index using runtime helpers.
    if (menuGlyph) {
      let finalGlyph = Number.isFinite(Number(menuGlyph))
        ? Math.trunc(Number(menuGlyph))
        : menuGlyph;
      if (glyphArgMode === "glyphinfo_ptr") {
        const decodedGlyphInfo = this.deps.memory.decodeGlyphInfoPointer(
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
      const mapHelper = this.deps.coordinator.runtimeVersion === "5.0"
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
        this.deps.menuSelection.getPrintableAcceleratorCharacter(accelerator);
      if (isSelectable && printableAccelerator) {
        // Preserve runtime-provided printable menu accelerators as-is.
        menuChar = printableAccelerator;
      } else if (isSelectable) {
        // Curses-style fallback for selectable rows with no accelerator.
        const existingItems = this.deps.menuSelection.currentMenuItems.filter(
          (item) => !item.isCategory && item.isSelectable,
        );
        const alphabet =
          "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        menuChar = alphabet[existingItems.length % alphabet.length];
      }

      console.log(
        `📋 MENU ITEM: "${menuText}" (key: ${menuChar}) glyph: ${resolvedMenuGlyph} -> "${glyphChar}" tile: ${menuItemTileIndex !== null ? menuItemTileIndex : "n/a"
        } - accelerator code: ${accelerator}, itemflags: ${menuItemFlags}`,
      );
    } else {
      console.log(
        `📋 CATEGORY HEADER: "${menuText}" - accelerator code: ${accelerator}, itemflags: ${menuItemFlags}`,
      );
    }

    // Store menu item for current question (only store non-category items or all items for display)
    if (this.deps.menuSelection.currentWindow === menuWinid && menuText) {
      this.deps.menuSelection.currentMenuItems.push({
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
        menuIndex: this.deps.menuSelection.currentMenuItems.length, // Store the menu item index
      });
    }

    // Send menu item to web client
    if (this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
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
        menuItems: this.deps.menuSelection.currentMenuItems,
      });
    }

    return 0;
  }

  handleShimEndMenu(args) {
    const [endMenuWinid, menuQuestion] = args;
    console.log("NetHack ending menu:", args);

    // Check if this is just an inventory update vs an actual question
    const isInventoryWindow = this.deps.windows.isInventoryWindow(endMenuWinid);
    const normalizedMenuQuestion =
      typeof menuQuestion === "string" ? menuQuestion : "";
    const hasMenuQuestion = normalizedMenuQuestion.trim().length > 0;
    this.deps.menuSelection.currentMenuQuestionText = hasMenuQuestion
      ? normalizedMenuQuestion
      : "";
    this.deps.menuSelection.lastEndedMenuWindow = endMenuWinid;
    this.deps.menuSelection.lastEndedMenuHadQuestion = hasMenuQuestion;
    this.deps.inventorySnapshots.lastEndedInventoryMenuKind = null;

    // Log the menu details for debugging
    console.log(
      `📋 Menu ending - Window: ${endMenuWinid}, Question: "${menuQuestion}", Items: ${this.deps.menuSelection.currentMenuItems.length}`,
    );

    // WIN_INVEN is used for both real inventory and informational reports.
    if (isInventoryWindow && !hasMenuQuestion) {
      const classification = this.deps.inventorySnapshots.classifyInventoryWindowMenu(
        this.deps.menuSelection.currentMenuItems,
        normalizedMenuQuestion,
      );
      this.deps.inventorySnapshots.lastEndedInventoryMenuKind = classification.kind;
      if (classification.kind === "inventory") {
        this.deps.menuSelection.currentMenuItems = this.deps.inventorySnapshots.inferQuestionlessInventoryCategories(
          this.deps.menuSelection.currentMenuItems,
        );
      }
      const actualItems = this.deps.menuSelection.currentMenuItems.filter(
        (item) => !item.isCategory,
      );
      const categoryHeaders = this.deps.menuSelection.currentMenuItems.filter(
        (item) => item.isCategory,
      );
      console.log(
        `WIN_INVEN no-question menu classified as ${classification.kind} (${actualItems.length} items, ${categoryHeaders.length} categories)`,
      );

      if (this.deps.coordinator.eventHandler) {
        if (classification.kind === "inventory") {
          this.deps.inventorySnapshots.latestInventoryItems = this.deps.menuSelection.currentMenuItems.map((item) => ({
            ...item,
          }));
          this.deps.coordinator.emit({
            type: "inventory_update",
            items: this.deps.inventorySnapshots.latestInventoryItems.map((item) => ({ ...item })),
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
          this.deps.coordinator.emit({
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
      const classification = this.deps.inventorySnapshots.classifyInventoryWindowMenu(
        this.deps.menuSelection.currentMenuItems,
        normalizedMenuQuestion,
      );
      if (classification.kind === "info_menu") {
        this.deps.inventorySnapshots.lastEndedInventoryMenuKind = classification.kind;
        console.log(
          `WIN_INVEN question menu classified as ${classification.kind} (${this.deps.menuSelection.currentMenuItems.length} items, title="${normalizedMenuQuestion}")`,
        );
        if (this.deps.coordinator.eventHandler) {
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
          this.deps.coordinator.emit({
            type: "info_menu",
            title: infoTitle,
            lines: infoBody,
            window: endMenuWinid,
          });
        }
        return 0;
      }

      if (
        this.deps.tileContextMenus.tryAutoPickRuntime5TileContextMenuItem(
          menuQuestion,
          this.deps.menuSelection.currentMenuItems,
        )
      ) {
        return 0;
      }

      this.deps.inventorySnapshots.lastEndedInventoryMenuKind = "inventory";
      console.log(
        `📋 Inventory action question detected: "${menuQuestion}" with ${this.deps.menuSelection.currentMenuItems.length} items`,
      );
      // Contextual inventory actions can arm a pending accelerator. For #name,
      // this auto-routes through "a particular object in inventory" first, then
      // applies the selected item accelerator on the follow-up menu.
      if (
        this.deps.inventoryContext.tryAutoHandlePendingInventoryContextSelection(
          menuQuestion,
          this.deps.menuSelection.currentMenuItems,
          { reason: "context action" },
        )
      ) {
        // Skip question emission/wait so the clicked action resolves immediately.
        return 0;
      }

      const isMultiSelectQuestion =
        this.deps.menuSelection.isMultiSelectLootQuestion(menuQuestion);
      if (isMultiSelectQuestion) {
        console.log("Multi-select loot dialog detected");
        this.deps.menuSelection.isInMultiPickup = true;
      }
      // Send the inventory question to web client
      if (this.deps.coordinator.eventHandler) {
        this.deps.coordinator.emit({
          type: "question",
          text: menuQuestion,
          choices: "",
          default: "",
          menuItems: this.deps.menuSelection.currentMenuItems,
        });
      }

      // Wait for actual user input for inventory questions
      console.log("📋 Waiting for inventory action selection (async)...");
      return this.deps.inputRequests.waitForQuestionInput();
    }

    // If there's a menu question (like "Pick up what?"), send it to the client
    if (hasMenuQuestion && this.deps.menuSelection.currentMenuItems.length > 0) {
      if (
        this.deps.inventoryContext.tryAutoHandlePendingInventoryContextSelection(
          menuQuestion,
          this.deps.menuSelection.currentMenuItems,
          { reason: "context action (generic menu question)" },
        )
      ) {
        // Skip question emission/wait so the clicked action resolves immediately.
        return 0;
      }
      console.log(
        `📋 Menu question detected: "${menuQuestion}" with ${this.deps.menuSelection.currentMenuItems.length} items`,
      );

      if (this.deps.menuSelection.isMultiSelectLootQuestion(menuQuestion)) {
        console.log("Multi-select loot menu detected");
        this.deps.menuSelection.isInMultiPickup = true;
      }

      // Send menu question to web client
      if (this.deps.coordinator.eventHandler) {
        this.deps.coordinator.emit({
          type: "question",
          text: menuQuestion,
          choices: "",
          default: "",
          menuItems: this.deps.menuSelection.currentMenuItems,
        });
      }

      // Wait for actual user input for menu questions
      console.log("📋 Waiting for menu selection (async)...");
      return this.deps.inputRequests.waitForQuestionInput();
    }

    // Check if we have menu items but no explicit question - could be a pickup or action menu
    if (
      this.deps.menuSelection.currentMenuItems.length > 0 &&
      !hasMenuQuestion &&
      !isInventoryWindow
    ) {
      console.log(
        `📋 Menu expansion detected with ${this.deps.menuSelection.currentMenuItems.length} items (window ${endMenuWinid})`,
      );

      // Determine the appropriate question based on context and window type
      let contextualQuestion = "Please select an option:";

      // Count non-category items to get actual selectable items
      const selectableItems = this.deps.menuSelection.currentMenuItems.filter(
        (item) => !item.isCategory,
      );
      console.log(
        `📋 Found ${selectableItems.length} selectable items out of ${this.deps.menuSelection.currentMenuItems.length} total`,
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
        if (this.deps.menuSelection.isMultiSelectLootQuestion(contextualQuestion)) {
          console.log("Expanded multi-select loot menu detected");
          this.deps.menuSelection.isInMultiPickup = true;
        }

        // Send expanded question to web client
        if (this.deps.coordinator.eventHandler) {
          this.deps.menuSelection.currentMenuQuestionText = contextualQuestion;
          this.deps.coordinator.emit({
            type: "question",
            text: contextualQuestion,
            choices: "",
            default: "",
            menuItems: this.deps.menuSelection.currentMenuItems,
          });
        }

        // Wait for actual user input for expanded questions
        console.log("📋 Waiting for expanded menu selection (async)...");
        return this.deps.inputRequests.waitForQuestionInput();
      } else {
        console.log(
          "📋 Menu has no selectable items - treating as informational",
        );
      }
    }

    return 0;
  }

  handleShimUpdateInventory() {
    console.log("NetHack update inventory callback received");
    // This callback is usually triggered after inventory changes.
    // We can use it to signal the UI to refresh its inventory display if needed.
    if (this.deps.postActionRefresh.maybeRefreshPendingPostActionPlayerTile("inventory_update")) {
      this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshReason = null;
      this.deps.postActionRefresh.pendingPostActionPlayerTileRefreshTarget = null;
    }
    if (this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
        type: "inventory_updated_signal",
      });
    }
    return 0;
  }
}
