import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  TileContextActions,
  type TileContextActionsDependencies,
} from "./tile-context-actions";

function fixture() {
  const selfTile = new THREE.Mesh();
  selfTile.userData.isLootLikeCharacter = true;
  const rayTile = new THREE.Mesh();
  const crosshairTile = new THREE.Mesh();
  const setFpsCrosshairContext = vi.fn();
  const sendInput = vi.fn();
  const sendMouseInput = vi.fn();
  const dependencies = {
    aimHighlights: {},
    camera: { getFpsAimDirectionFromCamera: vi.fn(() => ({ dx: 1, dy: 0 })) },
    controllerGameplay: {},
    darkCorridorInference: { getKnownTerrainSnapshotForInferenceAtKey: vi.fn(() => null) },
    directionPrompts: { isInDirectionQuestion: false },
    engineMessages: { logClickLookTileDebug: vi.fn() },
    engineState: { session: {}, uiAdapter: { setFpsCrosshairContext } },
    entityBillboards: { monsterBillboards: new Map() },
    extendedCommands: { metaCommandModeActive: false },
    inputCommands: {
      clearAutomaticGlancePendingState: vi.fn(),
      contextualGlanceProbePrefix: "__CTX_GLANCE_PROBE__",
      executeQuickAction: vi.fn(),
      sendInput,
      sendInputSequence: vi.fn(),
      sendMouseInput,
      shouldUseLegacyTileContextLookProbe: vi.fn(() => false),
      skipNextMobileFpsClickLookPromptMessage: false,
    },
    levelTerrainCache: { parseTileStateSignature: vi.fn() },
    movementInput: { isFpsMode: vi.fn(() => true), shouldUseFpsSelfTileDirectionTarget: vi.fn(() => false) },
    playerMovement: { playerPos: { x: 4, y: 6 } },
    pointerLock: { syncFpsPointerLockForUiState: vi.fn() },
    pointerTargeting: {
      getTilePositionFromClientCoordinates: vi.fn(),
      getTileUnderFpsCrosshair: vi.fn(() => ({ key: "9,9", x: 9, y: 9, mesh: crosshairTile })),
    },
    positionSelection: { isFpsFarLookViewActive: vi.fn(() => false), positionInputModeActive: false },
    promptDialogs: {
      isAnyModalVisible: vi.fn(() => false),
      isInfoDialogOpen: vi.fn(() => false),
      isInventoryDialogOpen: vi.fn(() => false),
      isTextInputActive: false,
    },
    questionMenus: { isInQuestion: false },
    renderPipeline: { renderer: {} },
    terminalRendering: { resolveSlashEmTerminalCmapIndex: vi.fn(), terminalRenderOptionStates: {} },
    tileFaceTextureRotationDebug: { cycleRotation: vi.fn(), isEnabled: vi.fn(() => false) },
    tileRendering: { tileMap: new Map([["4,6", selfTile], ["7,6", rayTile], ["9,9", crosshairTile]]) },
    tileUpdates: { tileStateCache: new Map() },
    tilesetAssets: { getWorldTileScaleX: vi.fn(() => 1), resolveRuntimeVersion: vi.fn(), shouldUseVultureTiles: vi.fn(() => false) },
    worldClassification: { isLootLikeBehavior: vi.fn(() => false), isMonsterLikeBehavior: vi.fn(() => false) },
  } as unknown as TileContextActionsDependencies;
  return {
    context: new TileContextActions(dependencies),
    dependencies,
    sendInput,
    sendMouseInput,
    setFpsCrosshairContext,
  };
}

describe("immersive FPS context target", () => {
  it("keeps an explicit ray target through updates and probes instead of following the head crosshair", () => {
    const f = fixture();

    f.context.openFpsCrosshairContextMenu({ x: 4, y: 6 });
    f.context.updateFpsCrosshairContextMenu();

    expect(f.dependencies.pointerTargeting.getTileUnderFpsCrosshair).not.toHaveBeenCalled();
    expect(f.context.activeContextActionTile).toEqual({ x: 4, y: 6 });
    expect(f.sendInput).toHaveBeenCalledExactlyOnceWith(":", { keepContextMenuOpen: true });
    expect(f.sendMouseInput).not.toHaveBeenCalled();
    expect(f.setFpsCrosshairContext).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tileX: 4,
        tileY: 6,
        actions: expect.arrayContaining([expect.objectContaining({ id: "eat" })]),
      }),
    );
  });

  it("probes a remote explicit ray target, then restores desktop crosshair targeting after close", () => {
    const f = fixture();

    f.context.openFpsCrosshairContextMenu({ x: 7, y: 6 });

    expect(f.context.activeContextActionTile).toEqual({ x: 7, y: 6 });
    expect(f.dependencies.pointerTargeting.getTileUnderFpsCrosshair).not.toHaveBeenCalled();
    expect(f.sendMouseInput).toHaveBeenCalledExactlyOnceWith(7, 6, 0, {
      keepContextMenuOpen: true,
    });
    f.context.closeFpsCrosshairContextMenu(false);
    f.context.openFpsCrosshairContextMenu();

    expect(f.dependencies.pointerTargeting.getTileUnderFpsCrosshair).toHaveBeenCalledOnce();
    expect(f.context.activeContextActionTile).toEqual({ x: 9, y: 9 });
  });
});
