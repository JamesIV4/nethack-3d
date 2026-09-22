import * as THREE from "three";
import { afterAll, afterEach, expect, it, vi } from "vitest";
vi.hoisted(() => vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { protocol: "http:", hostname: "localhost" } }));
import { createEngineSystems } from "../create-engine-systems";
import type { EngineCoordinator } from "../engine-coordinator";
import { getGlyphCatalogRanges } from "../../glyphs/registry";
import { getDefaultFloorGlyph, classifyTileBehavior } from "../../glyphs/behavior";
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllGlobals());

it.each(["prediction", "step"])("keeps known loot standing during %s when flattening is disabled", mode => {
  const s = createEngineSystems({} as EngineCoordinator);
  s.engineState.playMode = "fps";
  s.engineState.clientOptions.tilesetMode = "tiles";
  s.engineState.clientOptions.fpsFlattenEntityBillboards = false;
  s.playerMovement.hasSeenPlayerPosition = true; s.playerMovement.playerPos = { x: 20, y: 8 };
  s.renderPipeline.scene = new THREE.Scene();
  vi.spyOn(s.glyphTextures, "createTileTexture").mockImplementation(() => new THREE.CanvasTexture({} as HTMLCanvasElement));
  const ensure = vi.spyOn(s.entityBillboards, "ensureMonsterBillboard").mockImplementation(() => {});
  vi.spyOn(s.minimap, "queueMinimapTileUpdate").mockImplementation(() => {});
  const loot = getGlyphCatalogRanges().find(range => range.kind === "obj")!.start;
  expect(s.worldClassification.isLootLikeBehavior(classifyTileBehavior({glyph:loot,priorTerrain:null}))).toBe(true);
  s.levelTerrainCache.lastKnownTerrain.set("21,8", { glyph: getDefaultFloorGlyph(), char: ".", color: 7 });
  s.tileRendering.updateTile(21,8,loot);
  expect(ensure).toHaveBeenCalled(); ensure.mockClear();
  if (mode === "prediction") s.playerMovement.fpsPredictedPlayerTile = { x: 21, y: 8, expiresAtMs: Date.now()+1000 };
  else { s.camera.fpsStepCameraTargetTile = { x: 21, y: 8 }; s.camera.fpsStepCameraActive = true; }
  s.tileRendering.updateTile(21,8,loot);
  expect(ensure.mock.calls.some(call => call[0] === "21,8" && call[6] === "loot")).toBe(true);
  expect(s.tileRendering.tileMap.get("21,8")!.userData.tileTextureSourceGlyph).not.toBe(loot);
  // Explicit player glyphs still cannot turn into a duplicate player billboard.
  ensure.mockClear();
  const player = getGlyphCatalogRanges().find(range => range.kind === "mon")!.start;
  s.tileRendering.updateTile(21,8,player,"@",15,{ runtimeTrackedEntityId: 0 });
  expect(ensure.mock.calls.some(call => call[0] === "21,8")).toBe(false);
});
