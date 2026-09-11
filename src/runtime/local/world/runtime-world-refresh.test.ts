import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocalNetHackRuntime from "../../LocalNetHackRuntime";
import type { RuntimeEvent } from "../../types";
import type { RuntimeSystems } from "../create-runtime-systems";
import { RuntimeBootstrap } from "../startup/bootstrap";

let runtime: LocalNetHackRuntime;
let systems: RuntimeSystems;
let events: RuntimeEvent[];

beforeEach(() => {
  vi.spyOn(RuntimeBootstrap.prototype, "initializeNetHack").mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  events = [];
  runtime = new LocalNetHackRuntime(event => events.push(event));
  systems = (runtime as unknown as { systems: RuntimeSystems }).systems;
});

afterEach(() => {
  runtime.shutdown("test complete");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("assembled runtime world refresh ordering", () => {
  it("resends cached tiles while input is suspended, then refreshes deduplicated areas and tiles after the wait", async () => {
    const glyphAtHelper = vi.fn(() => 110);
    vi.stubGlobal("nethackGlobal", {
      helpers: { glyphAtHelper, mapglyphHelper: () => ({ ch: 43, color: 7, tileidx: 12 }) },
    });
    systems.mapCallbacks.gameMap.set("4,5", { x: 4, y: 5, glyph: 101, char: "!", color: 2, glyphFlags: 8 });
    const input = systems.inputRequests.requestInputCode("event");
    runtime.requestTileUpdate(4, 5);
    runtime.requestTileUpdate(4, 5);
    runtime.requestAreaUpdate(7, 8, 0);
    runtime.requestAreaUpdate(7, 8, 0);
    expect(glyphAtHelper).not.toHaveBeenCalled();
    expect(events).toContainEqual(expect.objectContaining({ type: "map_glyph", x: 4, y: 5, glyph: 101, glyphFlags: 8 }));
    expect(systems.tileRefresh.deferredTileRefreshKeys.size).toBe(1);
    expect(systems.tileRefresh.deferredAreaRefreshRequests.size).toBe(1);
    systems.inputRequests.enqueueInputKeys(["i"], "user", ["event"]);
    expect(await input).toBe(105);
    expect(glyphAtHelper.mock.calls).toEqual([[7, 8], [4, 5]]);
    expect(systems.tileRefresh.deferredTileRefreshKeys.size).toBe(0);
    expect(systems.tileRefresh.deferredAreaRefreshRequests.size).toBe(0);
    expect(systems.mapCallbacks.gameMap.get("4,5")?.glyph).toBe(110);
  });

  it("keeps refreshes queued until both text and menu selectors have released their WASM waits", () => {
    systems.textInput.pendingTextRequest = { bufferPtr: 0, resolve: vi.fn(), maxLength: 20 };
    systems.menuSelection.pendingMenuSelection = { resolver: vi.fn(), menuListPtrPtr: 0 };
    systems.tileRefresh.deferTileRefreshRequest(4, 5);
    systems.tileRefresh.flushDeferredTileRefreshesNow();
    expect(systems.tileRefresh.deferredTileRefreshKeys.size).toBe(1);
    systems.textInput.pendingTextRequest = null;
    systems.tileRefresh.flushDeferredTileRefreshesNow();
    expect(systems.tileRefresh.deferredTileRefreshKeys.size).toBe(1);
    systems.menuSelection.pendingMenuSelection = null;
    systems.tileRefresh.flushDeferredTileRefreshesNow();
    expect(systems.tileRefresh.deferredTileRefreshKeys.size).toBe(0);
  });

  it("retains a destination item snapshot until arrival and can display it while WASM helpers are suspended", async () => {
    const topItemGlyphUnderPlayer = vi.fn(() => 105);
    vi.stubGlobal("nethackGlobal", { helpers: { topItemGlyphUnderPlayer } });
    const snapshot = { glyph: 105, char: "!", color: 3, tileIndex: 25, symidx: 8 };
    systems.mapCallbacks.playerPosition = { x: 2, y: 3 };
    systems.mapCallbacks.gameMap.set("4,5", { ...snapshot, x: 4, y: 5 });
    systems.postActionRefresh.armPendingPostActionPlayerTileRefreshByReason("move-onto-lootlike-tile", "test move", { x: 4, y: 5 }, snapshot);
    const input = systems.inputRequests.requestInputCode("event");
    expect(systems.postActionRefresh.maybeRefreshPendingPostActionPlayerTile("before arrival")).toBe(false);
    expect(events).toEqual([]);
    systems.mapCallbacks.playerPosition = { x: 4, y: 5 };
    expect(systems.postActionRefresh.maybeRefreshPendingPostActionPlayerTile("arrival")).toBe(true);
    expect(topItemGlyphUnderPlayer).not.toHaveBeenCalled();
    expect(events).toContainEqual({ type: "under_player_item_glyph", x: 4, y: 5, ...snapshot });
    systems.inputRequests.enqueueInputKeys(["i"], "user", ["event"]);
    await input;
  });

  it("confirms a pushed boulder only after its snapshot moves from the destination to an adjacent tile", () => {
    const snapshot = { glyph: 105, char: "0", color: 7, tileIndex: 35, symidx: 9 };
    systems.mapCallbacks.playerPosition = { x: 4, y: 5 };
    systems.mapCallbacks.gameMap.set("4,5", { ...snapshot, x: 4, y: 5 });
    systems.mapCallbacks.gameMap.set("5,5", { ...snapshot, x: 5, y: 5 });
    systems.postActionRefresh.armPendingPostActionPlayerTileRefreshByReason("move-onto-lootlike-tile", "test push", { x: 4, y: 5 }, snapshot);
    expect(systems.underPlayerItems.maybeEmitConfirmedBoulderPushEventFromRuntimeMap()).toBe(false);
    systems.mapCallbacks.gameMap.set("4,5", { glyph: 220, char: ".", tileIndex: 40, x: 4, y: 5 });
    expect(systems.postActionRefresh.maybeRefreshPendingPostActionPlayerTile("map changed")).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ type: "confirmed_boulder_push", fromX: 4, fromY: 5, toX: 5, toY: 5, ...snapshot }));
    expect(events).toContainEqual({ type: "under_player_item_glyph_cleared", x: 4, y: 5 });
    expect(systems.postActionRefresh.pendingPostActionPlayerTileRefreshReason).toBeNull();
    expect(systems.postActionRefresh.pendingPostActionPlayerTileRefreshSnapshot).toBeNull();
  });

  it("protects a pending pickup from a lower-priority monster refresh, then clears it when the next movement target differs", () => {
    const snapshot = { glyph: 105, char: "!", tileIndex: 25 };
    systems.postActionRefresh.armPendingPostActionPlayerTileRefreshByReason("pickup-current-player-tile", "pickup", { x: 4, y: 5 }, snapshot);
    systems.postActionRefresh.armPendingPostActionPlayerTileRefreshByReason("monster-like-vacated-tile", "monster moved", { x: 8, y: 8 });
    expect(systems.postActionRefresh.pendingPostActionPlayerTileRefreshTarget).toEqual({ x: 4, y: 5 });
    expect(systems.postActionRefresh.pendingPostActionPlayerTileRefreshSnapshot).toEqual(snapshot);
    systems.postActionRefresh.clearPendingCurrentPlayerPickupRefreshIfTargetDiffers(4, 5, "same tile");
    expect(systems.postActionRefresh.pendingPostActionPlayerTileRefreshReason).toBe("pickup-current-player-tile");
    systems.postActionRefresh.clearPendingCurrentPlayerPickupRefreshIfTargetDiffers(5, 5, "new tile");
    expect(systems.postActionRefresh.pendingPostActionPlayerTileRefreshReason).toBeNull();
    expect(systems.postActionRefresh.pendingPostActionPlayerTileRefreshTarget).toBeNull();
    expect(systems.postActionRefresh.pendingPostActionPlayerTileRefreshSnapshot).toBeNull();
  });
});
