import * as THREE from "three";
import { afterAll, afterEach, expect, it, vi } from "vitest";
vi.hoisted(() => vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { protocol: "http:", hostname: "localhost" } }));
import { createEngineSystems } from "../create-engine-systems";
import type { EngineCoordinator } from "../engine-coordinator";
import { getDefaultDarkWallGlyph, getDefaultFloorGlyph } from "../../glyphs/behavior";

afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllGlobals());

it.each(["step", "prediction"])("does not flatten an inferred wall into a walkable floor during %s", mode => {
  const s = createEngineSystems({} as EngineCoordinator);
  s.engineState.playMode = "fps";
  s.engineState.clientOptions.tilesetMode = "tiles";
  s.playerMovement.hasSeenPlayerPosition = true;
  s.playerMovement.playerPos = { x: 20, y: 8 };
  if (mode === "step") {
    s.camera.fpsStepCameraTargetTile = { x: 21, y: 8 };
    s.camera.fpsStepCameraActive = true;
  } else {
    s.playerMovement.fpsPredictedPlayerTile = { x: 21, y: 8, expiresAtMs: Date.now() + 220 };
  }
  s.renderPipeline.scene = new THREE.Scene();
  vi.spyOn(s.tileMaterials, "getInferredDarkWallSolidColorMaterial").mockReturnValue(new THREE.MeshLambertMaterial());
  vi.spyOn(s.glyphTextures, "createTileTexture").mockImplementation(() => new THREE.CanvasTexture({} as HTMLCanvasElement));
  vi.spyOn(s.entityBillboards, "ensureMonsterBillboard").mockImplementation(() => {});
  vi.spyOn(s.minimap, "queueMinimapTileUpdate").mockImplementation(() => {});
  s.tileRendering.updateTile(21, 8, getDefaultDarkWallGlyph(), " ", undefined, { inferredDarkCorridorWall: true });
  const wall = s.tileRendering.tileMap.get("21,8")!;
  expect(wall.userData.isInferredDarkCorridorWall).toBe(true);
  expect(wall.userData.isWall).toBe(true);
  wall.geometry.computeBoundingBox();
  expect(wall.geometry.boundingBox!.max.z - wall.geometry.boundingBox!.min.z).toBeGreaterThan(0);
  // The movement glow uses this same isWall flag. It must be hidden in this
  // frame, not repaired by another turn after prediction/animation expires.
  vi.spyOn(s.camera, "getFpsAimDirectionFromCamera").mockReturnValue({ dx: 1, dy: 0, input: "6" });
  vi.spyOn(s.movementInput, "shouldUseFpsSelfTileDirectionTarget").mockReturnValue(false);
  vi.spyOn(s.promptDialogs, "isAnyModalVisible").mockReturnValue(false);
  vi.spyOn(s.aimHighlights, "ensureFpsAimVisuals").mockImplementation(() => {});
  s.aimHighlights.fpsForwardHighlight = new THREE.Mesh();
  s.aimHighlights.fpsForwardHighlight.visible = true;
  s.aimHighlights.updateFpsAimVisuals(0);
  expect(s.aimHighlights.fpsForwardHighlight.visible).toBe(false);
  // Real map data must still replace a speculative wall when the player can
  // actually enter that cell. Do not make inferred walls permanent obstacles.
  s.tileRendering.updateTile(21, 8, getDefaultFloorGlyph(), ".", 7);
  const floor = s.tileRendering.tileMap.get("21,8")!;
  expect(floor.userData.isInferredDarkCorridorWall).toBe(false);
  expect(floor.userData.isWall).toBe(false);
});
