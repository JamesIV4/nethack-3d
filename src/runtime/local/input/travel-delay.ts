// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeStatus } from "../status/status";
import type { RuntimeMapCallbacks } from "../world/map-callbacks";
import type { RuntimeMouseInput } from "./mouse-poskey";

export interface RuntimeTravelDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
    | "runtimeVersion"
  >;
  readonly mapCallbacks: Pick<
    RuntimeMapCallbacks,
    "playerPosition"
    | "playerPositionMovementSerial"
  >;
  readonly mouseInput: Pick<
    RuntimeMouseInput,
    "beginClickMoveBlockWindow"
  >;
  readonly status: Pick<
    RuntimeStatus,
    "readLatestStatusInteger"
  >;
}

/** Travel delay and movement deduplication state. */
export class RuntimeTravel {
  declare travelSpeedDelayMs: number;
  declare lastAppliedDelayOutputTurn: any;
  declare lastAppliedDelayOutputPosition: any;
  declare lastAppliedDelayOutputAtMs: any;
  declare lastAppliedDelayOutputMovementSerial: any;

  constructor(private readonly deps: RuntimeTravelDependencies) {
    this.travelSpeedDelayMs = 60;
    this.lastAppliedDelayOutputTurn = null;
    this.lastAppliedDelayOutputPosition = null;
    this.lastAppliedDelayOutputAtMs = null;
    this.lastAppliedDelayOutputMovementSerial = null;
  }

  handleShimDelayOutput() {
    if (this.deps.coordinator.runtimeVersion === "5.0") {
      const nowMs = Date.now();
      const latestTurn = this.deps.status.readLatestStatusInteger("BL_TIME");
      const posX = Number.isFinite(this.deps.mapCallbacks.playerPosition?.x)
        ? Math.trunc(Number(this.deps.mapCallbacks.playerPosition.x))
        : null;
      const posY = Number.isFinite(this.deps.mapCallbacks.playerPosition?.y)
        ? Math.trunc(Number(this.deps.mapCallbacks.playerPosition.y))
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
        this.deps.mapCallbacks.playerPositionMovementSerial,
      )
        ? this.deps.mapCallbacks.playerPositionMovementSerial
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
      if (this.deps.coordinator.eventHandler) {
        this.deps.coordinator.emit({
          type: "travel_step_delay",
          delayMs: 0,
        });
      }
      return 0; // No delay for instant
    }
    this.deps.mouseInput.beginClickMoveBlockWindow();
    console.log(
      `NetHack requesting output delay for travel (${this.travelSpeedDelayMs}ms).`,
    );
    if (this.deps.coordinator.eventHandler) {
      this.deps.coordinator.emit({
        type: "travel_step_delay",
        delayMs: this.travelSpeedDelayMs,
      });
    }
    return new Promise((resolve) =>
      setTimeout(resolve, this.travelSpeedDelayMs),
    );
  }
}
