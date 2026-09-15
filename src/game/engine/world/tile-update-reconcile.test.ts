import { afterEach, expect, it, vi } from "vitest";
import { TileUpdates, type TileUpdatesDependencies } from "./tile-updates";
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  const reconcile = vi.fn(), movement = new Map<string, unknown>(), camera = {fpsStepCameraActive:false};
  const deps = new Proxy({camera, entityMovement:{activeEntityMoveTransitions:movement}, darkCorridorInference:{requestInferredDarkCorridorWallReconcile:reconcile}}, { get:(o,k)=>Reflect.get(o,k)??new Proxy({}, {get:()=>vi.fn()}) });
  const updates = new TileUpdates(deps as unknown as TileUpdatesDependencies);
  updates.processPendingTileUpdate = vi.fn();
  return {updates,reconcile,movement,camera};
}
it("includes new arrivals behind a partial batch at the player-position fence", () => {
  const {updates}=fixture();
  updates.pendingTileFlushQueue=[{x:1,y:1,glyph:1},{x:2,y:1,glyph:2}]; updates.pendingTileFlushQueueIndex=1;
  updates.enqueueTileUpdate({x:2,y:1,glyph:3}); updates.enqueueTileUpdate({x:3,y:1,glyph:4});
  updates.flushPendingTileUpdatesForPlayerPositionReconcile();
  expect(vi.mocked(updates.processPendingTileUpdate).mock.calls.map(c=>c[0])).toEqual([{x:2,y:1,glyph:3},{x:3,y:1,glyph:4}]);
  expect(updates.pendingTileUpdates.size).toBe(0);
});
it("reconciles late corridor data on a settled frame, never mid-batch or mid-step", () => {
  const {updates,reconcile,camera,movement}=fixture();
  updates.enqueueTileUpdate({x:2,y:3,glyph:4}); updates.flushSettledDarkCorridorInference(); expect(reconcile).not.toHaveBeenCalled();
  updates.flushPendingTileUpdates(true); camera.fpsStepCameraActive=true;
  updates.flushSettledDarkCorridorInference(); expect(reconcile).not.toHaveBeenCalled();
  camera.fpsStepCameraActive=false; movement.set("player",{});
  updates.flushSettledDarkCorridorInference(); expect(reconcile).not.toHaveBeenCalled();
  movement.clear(); updates.flushSettledDarkCorridorInference(); updates.flushSettledDarkCorridorInference(); expect(reconcile).toHaveBeenCalledOnce();
  updates.enqueueTileUpdate({x:3,y:3,glyph:5}); updates.flushPendingTileUpdates(true);
  updates.flushSettledDarkCorridorInference(); expect(reconcile).toHaveBeenCalledTimes(2);
});
