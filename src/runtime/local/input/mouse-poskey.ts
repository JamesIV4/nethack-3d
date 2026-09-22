// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeTravel } from "./travel-delay";
import type { RuntimeInputRequests } from "./input-requests";
import type { RuntimeMemory } from "../abi/memory";
import type { RuntimePointerContract } from "../abi/pointer-contract";
import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeTileContextMenus } from "../menus/tile-context";

export interface RuntimeMouseInputDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "logRoutine"
    | "nethackModule"
    | "runtimeVersion"
  >;
  readonly inputRequests: Pick<
    RuntimeInputRequests,
    "inputBroker"
  >;
  readonly memory: Pick<
    RuntimeMemory,
    "normalizeWasmPointer"
  >;
  readonly pointerContract: Pick<
    RuntimePointerContract,
    "getRuntimePointerContract"
    | "notePointerContractViolation"
  >;
  readonly tileContextMenus: Pick<
    RuntimeTileContextMenus,
    "runtime5TileContextAutoPickFirstUntilMs"
    | "runtime5TileContextAutoPickFirstWindowMs"
  >;
  readonly travel: Pick<
    RuntimeTravel,
    "travelSpeedDelayMs"
  >;
}

/** Click throttling, mouse-token queues and ABI-aware writes to position input pointers. */
export class RuntimeMouseInput {
  declare mouseInputTokenKey: string;
  declare mouseClickPrimaryMod: number;
  declare mouseClickSecondaryMod: number;
  declare travelClickMoveBlockExtraMs: number;
  declare clickMoveBlockedUntilMs: number;

  constructor(private readonly deps: RuntimeMouseInputDependencies) {
    this.mouseInputTokenKey = "__MOUSE_INPUT__";
    this.mouseClickPrimaryMod = 1;
    // CLICK_1 (left click)
    this.mouseClickSecondaryMod = 2;
    // Default to normal
    this.travelClickMoveBlockExtraMs = 5;
    this.clickMoveBlockedUntilMs = 0;
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
    const baseDelayMs = Number(this.deps.travel.travelSpeedDelayMs);
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
    this.deps.inputRequests.inputBroker.enqueueTokens([
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
    const resolvedPtr = this.deps.memory.normalizeWasmPointer(ptr, {
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
      this.deps.pointerContract.getRuntimePointerContract()?.callbackModes?.shim_nh_poskey || null;
    if (callbackMode && callbackMode.pointerArgsAreDirect !== true) {
      this.deps.pointerContract.notePointerContractViolation(
        "nh_poskey-mode",
        "shim_nh_poskey pointer mode is not configured as direct pointers.",
      );
      return null;
    }

    // Pointer contract: winshim.c exposes shim_nh_poskey as "ippp"; local_callback
    // forwards each "p" argument as the raw pointer value (no implicit deref).
    return resolvedPtr;
  }

  getPoskeyCoordStoreType() {
    const callbackMode =
      this.deps.pointerContract.getRuntimePointerContract()?.callbackModes?.shim_nh_poskey || null;
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
    return this.deps.coordinator.runtimeVersion === "5.0" ? "i16" : "i32";
  }

  writePoskeyTargetValue(targetPtr, value, label, storeType = "i32") {
    if (
      !this.deps.coordinator.nethackModule ||
      typeof this.deps.coordinator.nethackModule.setValue !== "function" ||
      !Number.isInteger(targetPtr) ||
      targetPtr <= 0
    ) {
      console.log(
        `Skipping nh_poskey ${label} write (target=${targetPtr}, value=${value})`,
      );
      return false;
    }

    this.deps.coordinator.nethackModule.setValue(targetPtr, value, storeType);
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
    this.deps.coordinator.logRoutine(
      `Delivered mouse input to nh_poskey: (${mouseX}, ${mouseY}) mod=${mouseMod} (xPtr=${xTargetPtr}, yPtr=${yTargetPtr}, modPtr=${modTargetPtr}, coordType=${coordStoreType})`,
    );
    if (this.deps.coordinator.runtimeVersion === "5.0" && mouseMod > 0) {
      this.deps.tileContextMenus.runtime5TileContextAutoPickFirstUntilMs =
        Date.now() + this.deps.tileContextMenus.runtime5TileContextAutoPickFirstWindowMs;
    }
    return true;
  }
}
