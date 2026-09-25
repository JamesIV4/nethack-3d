import { afterEach, expect, it, vi } from "vitest";
import { TileUpdates, type TileUpdatesDependencies } from "./tile-updates";
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  const reconcile = vi.fn(), movement = new Map<string, unknown>(), camera = {fpsStepCameraActive:false};
  const recordDiscovery=vi.fn();
  const xr = { isPresenting: false };
  const tileBatch={beginTileBatch:vi.fn(),flushTileBatch:vi.fn(),endTileBatch:vi.fn()};
  const deps = new Proxy({camera, floorOcclusion:tileBatch,wallGeometry:tileBatch,entityMovement:{activeEntityMoveTransitions:movement}, darkCorridorInference:{invalidateInferredWallVisuals:vi.fn(),requestInferredDarkCorridorWallReconcile:reconcile,recordNewlyDiscoveredDarkCorridorTileForCurrentInput:recordDiscovery}, worldClassification:{seedTerrainCacheFromSupersededPendingUpdate:vi.fn()}, minimap:{flushPendingMinimapTileUpdates:vi.fn()}, vultureWalls:{flushPendingVultureWallMaterialRefreshes:vi.fn(),collectPendingVultureRoomDecorReconcileKeys:vi.fn(),flushPendingVultureRoomDecorReconcile:vi.fn()},runtimeEntityTracking:{finalizePendingRuntimeMonsterVacatedTracking:vi.fn()}}, { get:(o,k)=>Reflect.get(o,k)??new Proxy({}, {get:()=>vi.fn()}) });
  Object.assign(deps, {
    renderPipeline: { renderer: { xr } },
    entityBillboards: { monsterBillboards: new Map() },
    tileRendering: { tileMap: new Map() },
    worldClassification: { seedTerrainCacheFromSupersededPendingUpdate: vi.fn(), classifyTilePayload: (tile: { kind?: string }) => ({ materialKind: tile.kind ?? "floor" }) },
  });
  const updates = new TileUpdates(deps as unknown as TileUpdatesDependencies);
  updates.processPendingTileUpdate = vi.fn();
  return {updates,reconcile,movement,camera,recordDiscovery,tileBatch,xr,deps};
}

it("keeps actor and feature removal immediate even when replaced by distant terrain", () => {
  const {updates,deps}=fixture();
  (deps as any).entityBillboards.monsterBillboards.set("30,10",{});
  (deps as any).tileRendering.tileMap.set("31,10",{userData:{materialKind:"door"}});
  updates.enqueueTileUpdate({x:30,y:10,glyph:1});
  updates.enqueueTileUpdate({x:31,y:10,glyph:2});
  updates.flushPendingTileUpdatesForPlayerPositionReconcile(4,5,5,5);
  expect(updates.processPendingTileUpdate).toHaveBeenCalledTimes(2);
  expect(updates.pendingTileFlushQueue).toEqual([]);
});

it("reads current cached glyph flags after a queued refresh and skips cleared cells", () => {
  const {updates,deps}=fixture();
  updates.tileStateCache.set("1,2","old"); updates.tileStateCache.set("2,2","old");
  updates.refreshTilesFromStateCache();
  const parse=vi.fn(()=>({glyph:42,char:".",color:7,tileIndex:12,glyphFlags:8}));
  const updateTile=vi.fn();
  (deps as any).levelTerrainCache={parseTileStateSignature:parse};
  (deps as any).entityMovement.isEntityVisualUpdateDeferred=()=>false;
  (deps as any).tileRendering.updateTile=updateTile;
  updates.tileStateCache.set("1,2","new"); updates.tileStateCache.delete("2,2");
  updates.flushPendingTileUpdates();
  expect(parse).toHaveBeenCalledExactlyOnceWith("new");
  expect(updateTile).toHaveBeenCalledExactlyOnceWith(1,2,42,".",7,{runtimeTileIndex:12,runtimeGlyphFlags:8});
});

it("does not spend a document RAF budget after XR takes ownership of queued work", () => {
  const {updates,xr}=fixture(); const callbacks: FrameRequestCallback[]=[];
  vi.stubGlobal("requestAnimationFrame",(callback: FrameRequestCallback)=>{callbacks.push(callback);return callbacks.length;});
  updates.enqueueTileUpdate({x:1,y:2,glyph:1});
  xr.isPresenting=true; callbacks[0](0);
  expect(updates.processPendingTileUpdate).not.toHaveBeenCalled();
  updates.flushPendingTileUpdatesForFrame();
  callbacks[0](0);
  expect(updates.processPendingTileUpdate).toHaveBeenCalledOnce();
});

it("renders existing XR terrain while distant changes wait for the frame budget", () => {
  const {updates,xr}=fixture(); xr.isPresenting=true;
  updates.tileStateCache.set("30,10", "previously rendered");
  const near={x:5,y:5,glyph:1}, distant={x:30,y:10,glyph:2}, actor={x:31,y:10,glyph:3,monsterId:42};
  for(const tile of [near,distant,actor])updates.enqueueTileUpdate(tile);
  updates.flushPendingTileUpdatesForPlayerPositionReconcile(4,5,5,5);
  expect(vi.mocked(updates.processPendingTileUpdate).mock.calls.map(call=>call[0])).toEqual([near,actor]);
  expect(updates.pendingTileFlushQueue).toEqual([distant]);
  expect(requestAnimationFrame).not.toHaveBeenCalled();
  updates.flushPendingTileUpdatesForFrame();
  expect(updates.processPendingTileUpdate).toHaveBeenLastCalledWith(distant);
});

it("counts neighbor rebuilds against the XR budget and resumes document RAF on exit", () => {
  const {updates,xr,tileBatch}=fixture(); xr.isPresenting=true;
  let now=0; vi.stubGlobal("performance", {now:()=>now});
  tileBatch.flushTileBatch.mockImplementation(()=>{now+=1;});
  for(let x=0;x<100;x++)updates.enqueueTileUpdate({x,y:10,glyph:1});
  updates.flushPendingTileUpdatesForFrame();
  expect(updates.processPendingTileUpdate).toHaveBeenCalledTimes(4);
  expect(updates.tileFlushScheduled).toBe(true);
  expect(requestAnimationFrame).not.toHaveBeenCalled();
  xr.isPresenting=false;
  updates.flushPendingTileUpdatesForFrame();
  expect(requestAnimationFrame).toHaveBeenCalledOnce();
});

it("coalesces newer arrivals into an unfinished batch before rebuilding visuals", () => {
  const {updates,xr}=fixture(); xr.isPresenting=true;
  updates.pendingTileFlushQueue=[{x:30,y:10,glyph:1}];
  updates.enqueueTileUpdate({x:30,y:10,glyph:2});
  updates.flushPendingTileUpdatesForFrame();
  expect(updates.processPendingTileUpdate).toHaveBeenCalledExactlyOnceWith({x:30,y:10,glyph:2});
});

it.each([false,true])("paces a full cached level refresh (XR=%s)", presenting => {
  const {updates,xr}=fixture(); xr.isPresenting=presenting;
  vi.stubGlobal("performance",{now:()=>0});
  for(let x=0;x<100;x++)updates.tileStateCache.set(`${x},10`,"old");
  const refresh=vi.spyOn(updates as any,"refreshQueuedTileVisual").mockImplementation(()=>{});
  updates.refreshTilesFromStateCache();
  expect(refresh).not.toHaveBeenCalled();
  updates.flushPendingTileUpdates();
  const count=presenting?12:updates.tileFlushMaxPerFrame;
  expect(refresh).toHaveBeenCalledTimes(count);
  expect(updates.pendingTileVisualRefreshKeys.size).toBe(100-count);
  expect(updates.tileFlushScheduled).toBe(true);
});
it("applies movement-near arrivals at the player-position fence and leaves discovery budgeted", () => {
  const {updates,tileBatch}=fixture();
  updates.pendingTileFlushQueue=[{x:1,y:1,glyph:1},{x:2,y:1,glyph:2},{x:20,y:20,glyph:8}]; updates.pendingTileFlushQueueIndex=1;
  updates.enqueueTileUpdate({x:2,y:1,glyph:3}); updates.enqueueTileUpdate({x:3,y:1,glyph:4});
  updates.enqueueTileUpdate({x:21,y:20,glyph:9});
  updates.flushPendingTileUpdatesForPlayerPositionReconcile(1,1,2,1);
  expect(vi.mocked(updates.processPendingTileUpdate).mock.calls.map(c=>c[0])).toEqual([{x:2,y:1,glyph:3},{x:3,y:1,glyph:4}]);
  expect(updates.pendingTileUpdates.size).toBe(0);
  expect(updates.pendingTileFlushQueue).toEqual([{x:20,y:20,glyph:8},{x:21,y:20,glyph:9}]);
  expect(updates.tileFlushScheduled).toBe(true);
  expect(tileBatch.beginTileBatch).toHaveBeenCalledTimes(2);
  expect(tileBatch.endTileBatch).toHaveBeenCalledTimes(2);
});

it("bounds a large discovery burst even when player position arrives", () => {
  const {updates,recordDiscovery}=fixture();
  for(let i=0;i<500;i++)updates.enqueueTileUpdate({x:30+i%50,y:30+Math.floor(i/50),glyph:i});
  updates.enqueueTileUpdate({x:5,y:5,glyph:999});
  updates.flushPendingTileUpdatesForPlayerPositionReconcile(4,5,5,5);
  expect(updates.processPendingTileUpdate).toHaveBeenCalledTimes(1);
  expect(updates.pendingTileFlushQueue).toHaveLength(500);
  expect(recordDiscovery).toHaveBeenCalledTimes(501);
  expect(updates.hasPendingTileUpdateAtKey("30,30")).toBe(true);
  expect(updates.hasPendingTileUpdateAtKey("5,5")).toBe(false);
});

it("includes the second neighbor ring needed by door trims and chamfers", () => {
  const {updates}=fixture();
  const near = {x:7,y:7,glyph:1}, far = {x:8,y:8,glyph:2};
  updates.enqueueTileUpdate(near); updates.enqueueTileUpdate(far);
  updates.flushPendingTileUpdatesForPlayerPositionReconcile(4,5,5,5);
  expect(updates.processPendingTileUpdate).toHaveBeenCalledExactlyOnceWith(near);
  expect(updates.pendingTileFlushQueue).toEqual([far]);
});

it("keeps distant actors and features at the fence while explored terrain stays budgeted", () => {
  const {updates}=fixture();
  updates.tileStateCache.set("30,10", "previously rendered");
  const changed = {x:30,y:10,glyph:1};
  const monster = {x:31,y:10,glyph:2,monsterId:42};
  const feature = {x:32,y:10,glyph:3,kind:"stairs_down"};
  const discovery = {x:33,y:10,glyph:4};
  for (const tile of [changed,monster,feature,discovery]) updates.enqueueTileUpdate(tile);
  updates.flushPendingTileUpdatesForPlayerPositionReconcile(4,5,5,5);
  expect(vi.mocked(updates.processPendingTileUpdate).mock.calls.map(call=>call[0])).toEqual([monster,feature]);
  expect(updates.pendingTileFlushQueue).toEqual([changed,discovery]);
});

it("keeps later discovery frames within the tile-count budget", () => {
  const {updates}=fixture();
  vi.stubGlobal("performance", { now: () => 0 });
  for(let i=0;i<500;i++)updates.enqueueTileUpdate({x:i%50,y:Math.floor(i/50),glyph:i});
  updates.flushPendingTileUpdates(false);
  expect(updates.processPendingTileUpdate).toHaveBeenCalledTimes(updates.tileFlushMaxPerFrame);
  expect(updates.pendingTileFlushQueueIndex).toBe(updates.tileFlushMaxPerFrame);
  expect(updates.tileFlushScheduled).toBe(true);
});

it("uses one completion-backed forced refresh instead of timer retries", () => {
  const {updates}=fixture();
  const requestTileUpdate=vi.fn(() => Promise.resolve({ type:"refresh_result",requestId:1,complete:true,cells:[] }));
  (updates as any).dependencies.engineState={session:{requestTileUpdate}};
  updates.requestTileUpdateWithCompletion(5,6,{forceRuntime:true});
  expect(requestTileUpdate).toHaveBeenCalledExactlyOnceWith(5,6);
  expect(vi.mocked(requestAnimationFrame)).not.toHaveBeenCalled();
});
it("reconciles completed map data while tile work and movement are still active", () => {
  const {updates,reconcile,camera,movement}=fixture();
  camera.fpsStepCameraActive=true; movement.set("player",{});
  updates.pendingTileFlushQueue=[{x:30,y:3,glyph:4}];
  updates.enqueueTileUpdate({x:2,y:3,glyph:4});
  expect(reconcile).not.toHaveBeenCalled();
  updates.flushPendingDarkCorridorInference();
  expect(reconcile).toHaveBeenCalledOnce();
  expect(updates.processPendingTileUpdate).not.toHaveBeenCalled();
  updates.flushPendingDarkCorridorInference();
  expect(reconcile).toHaveBeenCalledOnce();
  updates.enqueueTileUpdate({x:3,y:3,glyph:5});
  updates.flushPendingDarkCorridorInference();
  expect(reconcile).toHaveBeenCalledTimes(2);
  updates.flushPendingDarkCorridorInference(true);
  expect(reconcile).toHaveBeenCalledTimes(3);
});

it("reads the latest complete pending observations without draining visual work", () => {
  const {updates}=fixture();
  updates.pendingTileFlushQueue=[{x:1,y:1,glyph:1},{x:2,y:1,glyph:2}];
  updates.pendingTileFlushQueueIndex=1;
  updates.enqueueTileUpdate({x:2,y:1,glyph:3});
  expect([...updates.collectPendingTileUpdates().values()]).toEqual([{x:2,y:1,glyph:3}]);
  expect(updates.pendingTileFlushQueueIndex).toBe(1);
  expect(updates.pendingTileUpdates.size).toBe(1);
});

it("ignores obsolete animation callbacks after a player-position fence", () => {
  const {updates}=fixture(), callbacks: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callbacks.push(callback); return callbacks.length; });
  updates.enqueueTileUpdate({x:1,y:1,glyph:1});
  updates.flushPendingTileUpdatesForPlayerPositionReconcile(0,0,1,1);
  vi.mocked(updates.processPendingTileUpdate).mockClear();
  updates.enqueueTileUpdate({x:2,y:1,glyph:2});
  expect(callbacks).toHaveLength(2);
  callbacks[0](0);
  expect(updates.processPendingTileUpdate).not.toHaveBeenCalled();
  expect(updates.tileFlushScheduled).toBe(true);
  callbacks[1](0);
  expect(updates.processPendingTileUpdate).toHaveBeenCalledExactlyOnceWith({x:2,y:1,glyph:2});
  expect(updates.tileFlushScheduled).toBe(false);
});
