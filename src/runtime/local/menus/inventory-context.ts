// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeMenuSelection } from "./selection";
import type { RuntimePositionInput } from "../input/position-selection";
import type { RuntimeContextualLook } from "../input/contextual-look";

export interface RuntimeInventoryContextDependencies {
  readonly contextualLook: Pick<
    RuntimeContextualLook,
    "clearContextualLookInfoAutoFlow"
    | "contextualLookInfoProbeMouseDeadlineMs"
    | "pendingContextualLookMapRouteSelection"
  >;
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "runtimeVersion"
  >;
  readonly menuSelection: Pick<
    RuntimeMenuSelection,
    "currentMenuQuestionText"
    | "getPrintableAcceleratorCharacter"
    | "normalizeQuestionText"
    | "tryAutoSelectMenuItem"
  >;
  readonly positionInput: Pick<
    RuntimePositionInput,
    "isLookAtMapMenuSelection"
  >;
}

/** Pending inventory context commands, accelerator/count routing and nested inventory-action menu selection. */
export class RuntimeInventoryContext {
  declare pendingInventoryContextSelection: any;
  declare inventoryContextSelectionPrefix: string;
  declare inventoryContextSelectionCountPrefix: string;

  constructor(private readonly deps: RuntimeInventoryContextDependencies) {
    this.inventoryContextSelectionPrefix = "__INVCTX_SELECT__:";
    this.inventoryContextSelectionCountPrefix = "__INVCTX_SELECT_COUNT__:";
    this.pendingInventoryContextSelection = null;
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
        `Armed inventory context selection accelerator with count: "${accelerator}" x${count}${actionId ? ` (action=${actionId})` : ""
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
        `Armed inventory context selection accelerator: "${accelerator}"${actionId ? ` (action=${actionId})` : ""
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
        this.deps.coordinator.runtimeVersion === "5.0" &&
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
        this.deps.coordinator.runtimeVersion === "5.0" &&
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
      const originalAcceleratorChar = this.deps.menuSelection.getPrintableAcceleratorCharacter(
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
    menuQuestion = this.deps.menuSelection.currentMenuQuestionText,
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
      this.deps.menuSelection.tryAutoSelectMenuItem(
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

  isLookAtMenuQuestion(question) {
    const normalized = this.deps.menuSelection.normalizeQuestionText(question);
    return normalized.includes("what do you want to look at");
  }

  isNameRootQuestion(question) {
    const normalized = this.deps.menuSelection.normalizeQuestionText(question);
    if (!normalized) {
      return false;
    }
    return normalized.startsWith("what do you want to name");
  }

  isCallRootQuestion(question) {
    const normalized = this.deps.menuSelection.normalizeQuestionText(question);
    if (!normalized) {
      return false;
    }
    return (
      normalized.startsWith("what do you want to call") ||
      normalized.startsWith("call what")
    );
  }

  isInventoryActionChoiceQuestion(question) {
    const normalized = this.deps.menuSelection.normalizeQuestionText(question);
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
    if (!normalizedActionId || this.deps.coordinator.runtimeVersion !== "5.0") {
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
        const originalAccelerator = this.deps.menuSelection.getPrintableAcceleratorCharacter(
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
      menuItems.find((item) => this.deps.positionInput.isLookAtMapMenuSelection(item)) || null
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
      this.deps.contextualLook.pendingContextualLookMapRouteSelection;
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
          this.deps.menuSelection.tryAutoSelectMenuItem(
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
          this.deps.menuSelection.tryAutoSelectMenuItem(
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
        this.deps.contextualLook.pendingContextualLookMapRouteSelection &&
        this.deps.contextualLook.contextualLookInfoProbeMouseDeadlineMs > 0 &&
        Date.now() <= this.deps.contextualLook.contextualLookInfoProbeMouseDeadlineMs
      ) {
        const lookMapRouteItem = this.resolveLookMapRouteMenuItem(menuItems);
        if (
          lookMapRouteItem &&
          this.deps.menuSelection.tryAutoSelectMenuItem(
            lookMapRouteItem,
            `${reason} (look map route)`,
          )
        ) {
          return true;
        }
        this.deps.contextualLook.clearContextualLookInfoAutoFlow("look map route unavailable");
      } else if (this.deps.contextualLook.pendingContextualLookMapRouteSelection) {
        this.deps.contextualLook.clearContextualLookInfoAutoFlow("look map route expired");
      }
      const lookInventoryRouteItem =
        this.resolveLookInventoryRouteMenuItem(menuItems);
      if (
        lookInventoryRouteItem &&
        this.deps.menuSelection.tryAutoSelectMenuItem(
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
          this.deps.menuSelection.tryAutoSelectMenuItem(
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

    return this.deps.menuSelection.tryAutoSelectMenuItem(
      directInventorySelection.menuItem,
      reason,
      directInventorySelection.selectionCount,
    );
  }
}
