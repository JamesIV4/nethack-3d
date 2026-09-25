import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { Minimap, type MinimapDependencies } from "./minimap";

it("repaints the FPS minimap only when its visible inputs change, including after reset", () => {
  const context = new Proxy({ canvas: { width: 80, height: 21 }, clearRect: vi.fn() }, {
    get: (object, key) => Reflect.get(object, key) ?? vi.fn(),
  }) as unknown as CanvasRenderingContext2D;
  const camera = { camera: new THREE.PerspectiveCamera(75, 1), cameraYaw: 0 };
  let fps = true, player = { x: 4, y: 5 };
  const minimap = new Minimap({ camera, movementInput: { isFpsMode: () => fps },
    engineState: { clientOptions: { minimapColorMode: "nethack-3d", disableAnimatedTransitions: false } },
  } as MinimapDependencies);
  minimap.minimapViewportContext = context;
  minimap.computeMinimapViewportRect = () => ({ minX: 0, minY: 0, width: 20, height: 15 });
  minimap.resolveMinimapPlayerTile = () => player;
  for (let i = 0; i < 60; i++) minimap.renderMinimapViewportOverlay(i * 16);
  expect(context.clearRect).toHaveBeenCalledOnce();
  player = { x: 5, y: 5 }; minimap.renderMinimapViewportOverlay();
  camera.cameraYaw = .1; minimap.renderMinimapViewportOverlay();
  camera.camera.fov = 80; minimap.renderMinimapViewportOverlay();
  camera.camera.aspect = 2; minimap.renderMinimapViewportOverlay();
  context.canvas.width = 160; minimap.renderMinimapViewportOverlay();
  expect(context.clearRect).toHaveBeenCalledTimes(6);
  minimap.stopMinimapDrag = vi.fn();
  minimap.resolveMinimapBackgroundColor = () => "#000000";
  minimap.resetMinimap();
  vi.mocked(context.clearRect).mockClear();
  minimap.renderMinimapViewportOverlay();
  expect(context.clearRect).toHaveBeenCalledOnce();
  fps = false;
  minimap.renderMinimapViewportOverlay(100); minimap.renderMinimapViewportOverlay(200);
  expect(context.clearRect).toHaveBeenCalledTimes(3);
  fps = true; minimap.renderMinimapViewportOverlay();
  expect(context.clearRect).toHaveBeenCalledTimes(4);
});
