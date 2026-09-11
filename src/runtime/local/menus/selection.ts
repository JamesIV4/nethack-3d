// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.
const process =
  typeof globalThis !== "undefined" && globalThis.process
    ? globalThis.process
    : { env: {} };
import type { RuntimeTileRefresh } from "../world/tile-refresh";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimePostActionRefresh } from "../world/post-action-refresh";
import type { RuntimeInputRequests } from "../input/input-requests";
import type { RuntimePositionInput } from "../input/position-selection";
import type { RuntimeMemory } from "../abi/memory";
import type { RuntimePointerContract } from "../abi/pointer-contract";
import type { RuntimeInventoryContext } from "./inventory-context";
import type { RuntimeInventorySnapshots } from "./inventory-snapshots";
import type { RuntimeGameOver } from "../lifecycle/game-over";

export interface RuntimeMenuSelectionDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
    | "nethackModule"
    | "runtimeVersion"
  >;
  readonly gameOver: Pick<
    RuntimeGameOver,
    "pendingGameOverPossessionsInventoryFlow"
  >;
  readonly inputRequests: Pick<
    RuntimeInputRequests,
    "awaitingQuestionInput"
    | "enqueueInputKeys"
    | "inputBroker"
    | "waitForQuestionInput"
  >;
  readonly inventoryContext: Pick<
    RuntimeInventoryContext,
    "clearPendingInventoryContextSelection"
    | "consumePendingInventoryContextSelection"
    | "hasPendingInventoryContextSelection"
    | "pendingInventoryContextSelection"
    | "tryAutoRoutePendingInventoryContextSelectionThroughListEverything"
  >;
  readonly inventorySnapshots: Pick<
    RuntimeInventorySnapshots,
    "lastEndedInventoryMenuKind"
  >;
  readonly memory: Pick<
    RuntimeMemory,
    "normalizeWasmPointer"
    | "readPointerSlotValue"
  >;
  readonly pointerContract: Pick<
    RuntimePointerContract,
    "getRuntimePointerContract"
    | "notePointerContractViolation"
  >;
  readonly positionInput: Pick<
    RuntimePositionInput,
    "isFloorTargetPositionMenuSelection"
    | "isLookAtMapMenuSelection"
    | "isMonsterTargetPositionMenuSelection"
    | "pendingLookMenuFarLookArm"
  >;
  readonly postActionRefresh: Pick<
    RuntimePostActionRefresh,
    "armPendingPostActionPlayerTileRefreshForMenuInteraction"
  >;
  readonly tileRefresh: Pick<
    RuntimeTileRefresh,
    "maybeFlushDeferredTileRefreshes"
  >;
}

/** Menu selection identity/count encoding, isolated menu waiter resolution, automatic selection and ABI result buffers. */
export class RuntimeMenuSelection {
  declare currentMenuItems: any[];
  declare currentWindow: any;
  declare currentMenuQuestionText: string;
  declare menuSelections: Map<any, any>;
  declare isInMultiPickup: boolean;
  declare pendingMenuSelection: any;
  declare menuSelectionReadyCount: any;
  declare lastEndedMenuWindow: any;
  declare lastEndedMenuHadQuestion: boolean;
  declare lastMenuInteractionCancelled: boolean;
  declare menuSelectionInputPrefix: string;

  constructor(private readonly deps: RuntimeMenuSelectionDependencies) {
    this.currentMenuItems = [];
    this.currentWindow = null;
    this.currentMenuQuestionText = "";
    // Multi-pickup selection tracking
    this.menuSelections = new Map();
    // Track selected items: key=menuChar, value={menuChar, originalAccelerator, menuIndex}
    this.isInMultiPickup = false;
    this.pendingMenuSelection = null;
    this.menuSelectionReadyCount = null;
    this.lastEndedMenuWindow = null;
    this.lastEndedMenuHadQuestion = false;
    this.lastMenuInteractionCancelled = false;
    this.menuSelectionInputPrefix = "__MENU_SELECT__:";
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
      this.deps.tileRefresh.maybeFlushDeferredTileRefreshes();
      return;
    }

    if (selectionCount <= 0) {
      this.menuSelections.clear();
    }
  }

  isPrintableAccelerator(code) {
    return this.getPrintableAcceleratorCharacter(code).length === 1;
  }

  isLegacyMenuAcceleratorRuntime() {
    return this.deps.coordinator.runtimeVersion === "3.6.7" || this.deps.coordinator.runtimeVersion === "slashem";
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

  normalizeQuestionText(question) {
    if (typeof question !== "string") {
      return "";
    }
    return question.trim().toLowerCase();
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
    this.deps.postActionRefresh.armPendingPostActionPlayerTileRefreshForMenuInteraction(
      menuQuestion,
      menuItem,
      `for auto-selected menu item via ${reason}`,
    );
    return true;
  }

  wakeAwaitingQuestionInputForAutoSelection(source = "system") {
    if (
      !this.deps.inputRequests.awaitingQuestionInput ||
      !this.deps.inputRequests.inputBroker ||
      !this.deps.inputRequests.inputBroker.hasPendingRequests("event")
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
    this.deps.inputRequests.enqueueInputKeys([wakeInput], source, ["event"]);
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
    if (this.deps.positionInput.isLookAtMapMenuSelection(menuItem)) {
      this.deps.positionInput.pendingLookMenuFarLookArm = true;
      console.log(
        "Look menu map selection detected; using ';' wake input to arm far-look mode",
      );
      return ";";
    }

    if (this.deps.positionInput.isFloorTargetPositionMenuSelection(menuItem)) {
      this.deps.positionInput.pendingLookMenuFarLookArm = true;
      console.log(
        "Floor-target naming selection detected; using ';' wake input to arm far-look mode",
      );
      return ";";
    }

    if (this.deps.positionInput.isMonsterTargetPositionMenuSelection(menuItem)) {
      this.deps.positionInput.pendingLookMenuFarLookArm = true;
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
    if (!this.deps.coordinator.nethackModule || !menuListPtrPtr) {
      return;
    }

    const normalizedMenuListPtrPtr = this.deps.memory.normalizeWasmPointer(menuListPtrPtr, {
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
      const menuItemContract = this.deps.pointerContract.getRuntimePointerContract()?.menuItem || {};
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
        this.deps.pointerContract.notePointerContractViolation(
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
        this.deps.coordinator.nethackModule.setValue(normalizedMenuListPtrPtr, 0, "*");
        console.log(
          `Menu selection write: cleared output pointer at menuListPtrPtr=${normalizedMenuListPtrPtr}`,
        );
        return;
      }

      const priorOutPtr = this.deps.coordinator.nethackModule.getValue(
        normalizedMenuListPtrPtr,
        "*",
      );
      // NetHack's select_menu contract makes the caller responsible for
      // freeing any previously returned menu_item array. Do not free a
      // non-zero priorOutPtr here: many call sites free the old buffer but do
      // not null the local afterward, so reclaiming it in the JS bridge would
      // turn a leak into a use-after-free/double-free.
      const outPtr = this.deps.coordinator.nethackModule._malloc(
        selectionCount * bytesPerMenuItem,
      );
      this.deps.coordinator.nethackModule.setValue(normalizedMenuListPtrPtr, outPtr, "*");
      if (this.deps.coordinator.nethackModule.HEAPU8 && bytesPerMenuItem > 0) {
        // Clear all bytes to avoid stale data in optional struct fields.
        this.deps.coordinator.nethackModule.HEAPU8.fill(
          0,
          outPtr,
          outPtr + selectionCount * bytesPerMenuItem,
        );
      }
      const confirmOutPtr = this.deps.coordinator.nethackModule.getValue(
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

        this.deps.coordinator.nethackModule.setValue(structOffset, itemIdentifier, "i32");
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

        this.deps.coordinator.nethackModule.setValue(structOffset + countOffset, countValue, "i32");
        if (itemFlagsOffset !== null && canWriteFieldAt(itemFlagsOffset)) {
          this.deps.coordinator.nethackModule.setValue(structOffset + itemFlagsOffset, 0, "i32");
        }
        const debugItem = this.deps.coordinator.nethackModule.getValue(structOffset, "i32");
        const debugCountPrimary = canWriteFieldAt(countOffset)
          ? this.deps.coordinator.nethackModule.getValue(
            structOffset + countOffset,
            "i32",
          )
          : null;
        const debugItemFlags =
          itemFlagsOffset !== null &&
            canWriteFieldAt(itemFlagsOffset)
            ? this.deps.coordinator.nethackModule.getValue(structOffset + itemFlagsOffset, "i32")
            : null;
        console.log(
          `Wrote menu_item[${i}] => item=${debugItem}, countPrimary=${debugCountPrimary}, itemFlags=${debugItemFlags}, countMode=${countMode}, countValue=${countValue}`,
        );
      }
      const dumpBytes = Math.min(selectionCount * bytesPerMenuItem, 64);
      const dump = [];
      for (let i = 0; i < dumpBytes; i++) {
        const b = this.deps.coordinator.nethackModule.getValue(outPtr + i, "i8") & 0xff;
        dump.push(b.toString(16).padStart(2, "0"));
      }
      console.log(
        `menu_item buffer dump (${dumpBytes} bytes): ${dump.join(" ")}`,
      );
    } catch (error) {
      console.log("Error writing selections to NetHack memory:", error);
    }
  }

  handleShimSelectMenu(args) {
    const [menuSelectWinid, menuSelectHow, menuPtrArg] = args;
    const consumeMenuInteractionCancelled = () => {
      const cancelled = this.lastMenuInteractionCancelled;
      this.lastMenuInteractionCancelled = false;
      if (cancelled) {
        this.deps.inventoryContext.clearPendingInventoryContextSelection(
          "menu interaction cancelled",
        );
      }
      return cancelled;
    };
    const ptrMode = "direct";
    const menuListPtrPtr =
      this.deps.memory.normalizeWasmPointer(menuPtrArg, {
        label: "shim_select_menu_list_ptr_ptr",
        minBytes: 4,
        alignment: 4,
      }) || 0;
    const menuListCurrentOutPtr =
      menuListPtrPtr > 0
        ? this.deps.memory.readPointerSlotValue(
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
      this.deps.inventorySnapshots.lastEndedInventoryMenuKind === "inventory" &&
      this.menuSelections.size === 0 &&
      Array.isArray(this.currentMenuItems) &&
      this.currentMenuItems.some((item) => item && !item.isCategory);

    if (shouldAwaitQuestionlessInventoryPickOne) {
      if (this.deps.gameOver.pendingGameOverPossessionsInventoryFlow) {
        console.log(
          "Suppressing questionless WIN_INVEN PICK_ONE prompt during game-over possessions flow; returning 0",
        );
        this.deps.gameOver.pendingGameOverPossessionsInventoryFlow = false;
        this.writeMenuSelectionResult(menuListPtrPtr, 0);
        this.menuSelections.clear();
        this.isInMultiPickup = false;
        return 0;
      }

      if (!this.deps.inventoryContext.hasPendingInventoryContextSelection()) {
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
        this.deps.inventoryContext.consumePendingInventoryContextSelection(
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
        this.deps.inventoryContext.tryAutoRoutePendingInventoryContextSelectionThroughListEverything(
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
      if (this.deps.inventoryContext.hasPendingInventoryContextSelection()) {
        const pending =
          this.deps.inventoryContext.pendingInventoryContextSelection &&
            typeof this.deps.inventoryContext.pendingInventoryContextSelection === "object"
            ? this.deps.inventoryContext.pendingInventoryContextSelection
            : null;
        this.deps.inventoryContext.clearPendingInventoryContextSelection(
          pending?.listEverythingFallbackUsed === true
            ? "no matching menu item after * list everything fallback (questionless PICK_ONE)"
            : "no matching menu item for questionless PICK_ONE",
        );
      }

      console.log(
        "PICK_ONE for questionless WIN_INVEN menu - waiting for async selection...",
      );
      if (this.deps.coordinator.eventHandler) {
        this.currentMenuQuestionText = "Choose an inventory item:";
        this.deps.coordinator.emit({
          type: "question",
          text: "Choose an inventory item:",
          choices: "",
          default: "",
          menuItems: this.currentMenuItems,
        });
      }

      const pendingSelection = this.deps.inputRequests.waitForQuestionInput();
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
  }
}
