import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InputCommands, type InputCommandsDependencies } from "./input-commands";
import { PositionSelection, type PositionSelectionDependencies } from "./position-selection";
import { QuestionMenus, type QuestionMenusDependencies } from "../ui/question-menus";

// This module's default options read window.matchMedia during import; command
// lifecycle tests only need its character-sheet event constant.
vi.mock("../../ui-types", () => ({
  nh3dOpenCharacterSheetEventName: "nh3d:open-character-sheet",
}));

afterEach(() => vi.restoreAllMocks());

function positionFixture() {
  const camera = {
    camera: new THREE.PerspectiveCamera(),
    cameraYaw: 0.4,
    cameraPitch: 0.2,
    fpsPositionCursorCameraCurrent: new THREE.Vector3(),
    fpsPositionCursorLookCurrent: new THREE.Vector3(),
    fpsPositionCursorCameraInitialized: false,
    fpsPositionCursorManualOverrideUntilMs: 0,
    fpsPositionCursorReturnActive: false,
    fpsPositionCursorEntryCameraYaw: null as number | null,
    fpsPositionCursorEntryCameraPitch: null as number | null,
    fpsPositionCursorOrbitYaw: 0,
    fpsPositionCursorOrbitPitch: 0,
    minCameraPitch: -1,
    maxCameraPitch: 1,
    positionCursorFarLookDefaultPitch: 0.5,
    positionCursorFarLookOrbitDistance: 4,
    wrapAngle: (angle: number) => angle,
  };
  const setPositionInputActive = vi.fn();
  const setPositionRequest = vi.fn();
  const syncFpsPointerLockForUiState = vi.fn();
  const requestPlayerTileRefresh = vi.fn();
  const refreshCurrentPlayerTileVisualFromStateCache = vi.fn();
  const tileContextActions = { fpsCrosshairGlancePending: null as { sawPositionInput: boolean; positionResolvedAtMs: number | null } | null };
  // Only browser/rendering boundaries used by these lifecycle paths are stubbed.
  const dependencies = {
    camera,
    engineState: { uiAdapter: { setPositionInputActive, setPositionRequest } },
    movementInput: { isFpsMode: () => true },
    playerMovement: { playerPos: { x: 5, y: 6 } },
    pointerLock: { syncFpsPointerLockForUiState },
    tileContextActions,
    tileUpdates: { requestPlayerTileRefresh, refreshCurrentPlayerTileVisualFromStateCache },
  } as unknown as PositionSelectionDependencies;
  const position = new PositionSelection(dependencies);
  vi.spyOn(position, "updatePositionCursorOutline").mockImplementation(() => {});
  return { position, camera, setPositionInputActive, setPositionRequest, syncFpsPointerLockForUiState, requestPlayerTileRefresh, tileContextActions };
}

describe("position selection lifecycle", () => {
  it("preserves an early runtime cursor when the active-state event arrives", () => {
    const f = positionFixture();
    f.position.setPositionCursorPosition(12, 9);
    f.position.setPositionInputMode(true, "far-look");

    expect(f.position.positionCursor).toEqual({ x: 12, y: 9 });
    expect(f.position.hasRuntimePositionCursor).toBe(true);
    expect(f.setPositionInputActive).toHaveBeenCalledWith(true, "far-look");
    expect(f.syncFpsPointerLockForUiState).toHaveBeenCalledWith(false);
    expect(f.requestPlayerTileRefresh).toHaveBeenCalledWith("fps-far-look-enter", { forceRuntime: true });

    f.position.setPositionInputMode(true, "travel");
    expect(f.position.positionInputOrigin).toBe("travel");
    expect(f.requestPlayerTileRefresh).toHaveBeenCalledTimes(1);
  });

  it("clears position state before reacquiring pointer lock and retains the camera return pose", () => {
    const f = positionFixture();
    f.tileContextActions.fpsCrosshairGlancePending = { sawPositionInput: false, positionResolvedAtMs: null };
    f.position.setPositionInputMode(true, "far-look");
    expect(f.position.positionCursor).toEqual({ x: 5, y: 6 });
    f.position.positionCursorOutline = new THREE.Group();
    f.position.positionCursorOutline.visible = true;
    f.camera.camera.position.set(2, 3, 4);
    f.syncFpsPointerLockForUiState.mockImplementation((acquire: boolean) => {
      if (acquire) {
        expect(f.position.positionInputModeActive).toBe(false);
        expect(f.position.hasRuntimePositionCursor).toBe(false);
        expect(f.position.positionCursorOutline?.visible).toBe(false);
      }
    });

    f.position.setPositionInputMode(false);

    expect(f.position.positionInputOrigin).toBeNull();
    expect(f.camera.fpsPositionCursorReturnActive).toBe(true);
    expect(f.camera.fpsPositionCursorEntryCameraYaw).toBe(0.4);
    expect(f.camera.fpsPositionCursorCameraCurrent.toArray()).toEqual([2, 3, 4]);
    expect(f.tileContextActions.fpsCrosshairGlancePending.positionResolvedAtMs).not.toBeNull();
    expect(f.setPositionRequest).toHaveBeenCalledWith(null);
    expect(f.syncFpsPointerLockForUiState).toHaveBeenLastCalledWith(true);
  });
});

describe("question menu lifecycle", () => {
  it("submits pickup confirmation before clearing selection state and releasing the prompt", () => {
    const events: string[] = [];
    let question: QuestionMenus;
    const dependencies = {
      inputCommands: { sendInput: (key: string) => {
        expect(question.isInQuestion).toBe(true);
        expect(question.activePickupSelectionCounts.get("menu-index:4")).toBe(3);
        events.push(key);
      } },
      tileUpdates: { requestPlayerTileRefresh: (reason: string) => events.push(reason) },
      engineState: { uiAdapter: { setQuestion: () => events.push("hide") } },
      pointerLock: { syncFpsPointerLockForUiState: () => {
        expect(question.isInQuestion).toBe(false);
        expect(question.activePickupSelections.size).toBe(0);
        expect(question.activePickupSelectionCounts.size).toBe(0);
        expect(question.activeQuestionPendingCountInput).toBe("");
        events.push("pointer-lock");
      } },
      gameOver: { flushDeferredGameOverUiReveal: () => events.push("game-over") },
    } as unknown as QuestionMenusDependencies;
    question = new QuestionMenus(dependencies);
    question.isInQuestion = true;
    question.activeQuestionIsPickupDialog = true;
    question.activePickupSelections.add("menu-index:4");
    question.activePickupSelectionCounts.set("menu-index:4", 3);
    question.activeQuestionPendingCountInput = "7";
    question.activeQuestionMenuPageIndex = 2;
    question.activeQuestionPageSelectionMap.set("a", "__MENU_SELECT__:4");

    question.confirmPickupChoices();

    expect(events).toEqual(["Enter", "pickup-confirm", "hide", "pointer-lock", "game-over"]);
    expect(question.activeQuestionPageSelectionMap.size).toBe(0);
    expect(question.activeQuestionMenuPageIndex).toBe(0);
    question.confirmPickupChoices();
    expect(events).toHaveLength(5);
  });
});

function commandFixture() {
  const sendInput = vi.fn();
  const sendInputSequence = vi.fn();
  const armPendingPlayerFootstepSound = vi.fn();
  const setFpsPredictedPlayerTileFromMovementInput = vi.fn();
  const armPendingFpsHeldWeaponMeleeSwipeFromMovementInput = vi.fn();
  const armPlayerCliparoundInputCooldown = vi.fn();
  const requestPlayerTileRefresh = vi.fn();
  const directionPrompts = { isInDirectionQuestion: false, hideDirectionQuestion: vi.fn() };
  const positionSelection = { positionInputModeActive: false, cancelPositionInputMode: vi.fn() };
  const questionMenus = { isInQuestion: false, activeQuestionText: "", hideQuestion: vi.fn() };
  const camera = { lastManualDirectionalInputAtMs: 0, lastRunLikeInputAtMs: 0, fpsAutoMoveDirection: null, fpsAutoTurnTargetYaw: null };
  const dependencies = {
    audioHapticsPlatform: { armPendingPlayerFootstepSound, clearPendingThrownWeaponDirectionSound: vi.fn() },
    camera,
    combatAttribution: { pendingPointerAttackTargetContext: null, updateDirectionalAttackContext: vi.fn(), armPendingFpsHeldWeaponMeleeSwipeFromMovementInput },
    darkCorridorInference: { shouldEnableBlindDarkCorridorInferenceForInput: () => false, beginDarkCorridorDiscoveryWindowFromPlayerInput: vi.fn() },
    directionPrompts,
    engineMessages: { logNameInputTrace: vi.fn() },
    engineState: { session: { sendInput, sendInputSequence } },
    gameOver: { gameOverState: { active: false } },
    movementInput: { isMovementInput: (key: string) => /^[hyn]$/.test(key), isRunMovementInput: () => false, isNumpadRunPrefixInput: () => false, isRunPrefixInput: (key: string) => key === "5", armPlayerCliparoundInputCooldown },
    playerMovement: { hasPlayerMovedOnce: true, setFpsPredictedPlayerTileFromMovementInput },
    positionSelection,
    promptDialogs: { isTextInputActive: false },
    questionMenus,
    runTelemetry: { recentSpellKillAttribution: null },
    tileContextActions: { closeAnyTileContextMenu: vi.fn() },
    tileUpdates: { getPlayerTileRefreshReasonForItemCommandInput: (key: string) => key === "," ? "pickup-input" : null, requestPlayerTileRefresh },
  } as unknown as InputCommandsDependencies;
  return { commands: new InputCommands(dependencies), sendInput, sendInputSequence, armPendingPlayerFootstepSound, setFpsPredictedPlayerTileFromMovementInput, armPendingFpsHeldWeaponMeleeSwipeFromMovementInput, armPlayerCliparoundInputCooldown, requestPlayerTileRefresh, directionPrompts, positionSelection, questionMenus, camera };
}

describe("shared input command routing", () => {
  it.each(["y", "n"])("sends shop answer %s unchanged without arming movement effects", answer => {
    const f = commandFixture();
    f.questionMenus.isInQuestion = true;
    f.questionMenus.activeQuestionText = "Will you accept 10 gold pieces for your dagger?";

    f.commands.sendInput(answer);

    expect(f.sendInput).toHaveBeenCalledExactlyOnceWith(answer, { delayMs: undefined });
    expect(f.armPendingPlayerFootstepSound).not.toHaveBeenCalled();
    expect(f.setFpsPredictedPlayerTileFromMovementInput).not.toHaveBeenCalled();
    expect(f.armPendingFpsHeldWeaponMeleeSwipeFromMovementInput).not.toHaveBeenCalled();
    expect(f.camera.lastManualDirectionalInputAtMs).toBe(0);

    f.questionMenus.isInQuestion = false;
    f.commands.sendInput(answer);
    expect(f.sendInput).toHaveBeenLastCalledWith(answer, { delayMs: undefined });
    expect(f.armPendingPlayerFootstepSound).toHaveBeenCalledOnce();
    expect(f.setFpsPredictedPlayerTileFromMovementInput).toHaveBeenCalledExactlyOnceWith(answer);
    expect(f.armPendingFpsHeldWeaponMeleeSwipeFromMovementInput).toHaveBeenCalledExactlyOnceWith(answer);
    expect(f.camera.lastManualDirectionalInputAtMs).toBeGreaterThan(0);
  });

  it.each(["position", "direction"])("does not predict player movement for %s selection keys", (mode) => {
    const f = commandFixture();
    f.positionSelection.positionInputModeActive = mode === "position";
    f.directionPrompts.isInDirectionQuestion = mode === "direction";

    f.commands.sendInput("h");
    f.commands.sendInput(",");

    expect(f.sendInput.mock.calls.map(([key]) => key)).toEqual(["h", ","]);
    expect(f.armPendingPlayerFootstepSound).not.toHaveBeenCalled();
    expect(f.setFpsPredictedPlayerTileFromMovementInput).not.toHaveBeenCalled();
    expect(f.armPendingFpsHeldWeaponMeleeSwipeFromMovementInput).not.toHaveBeenCalled();
    expect(f.requestPlayerTileRefresh).not.toHaveBeenCalled();
    expect(f.camera.lastManualDirectionalInputAtMs).toBe(0);
  });

  it("keeps a forced direction sequence atomic and arms motion before worker submission", () => {
    const f = commandFixture();
    f.sendInputSequence.mockImplementation(() => {
      expect(f.armPendingPlayerFootstepSound).toHaveBeenCalledTimes(1);
      expect(f.setFpsPredictedPlayerTileFromMovementInput).toHaveBeenCalledWith("h");
      expect(f.camera.lastManualDirectionalInputAtMs).toBeGreaterThan(0);
    });

    f.commands.sendForcedDirectionalInput("h");

    expect(f.sendInputSequence).toHaveBeenCalledExactlyOnceWith(["5", "h"], { delayMs: undefined });
    expect(f.sendInput).not.toHaveBeenCalled();
  });

  it("routes position cancellation to its owner without also dismissing question state", () => {
    const f = commandFixture();
    f.positionSelection.positionInputModeActive = true;
    f.questionMenus.isInQuestion = true;

    f.commands.cancelActivePrompt();

    expect(f.positionSelection.cancelPositionInputMode).toHaveBeenCalledExactlyOnceWith("active prompt cancel");
    expect(f.questionMenus.hideQuestion).not.toHaveBeenCalled();
    expect(f.directionPrompts.hideDirectionQuestion).not.toHaveBeenCalled();
    expect(f.sendInput).not.toHaveBeenCalled();
  });
});
