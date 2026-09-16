import type { NethackRuntimeVersion } from "./types";
import { isLoggingEnabled } from "../logging";
import { extractRuntimeNumberPadModeEnabled } from "./number-pad-mode";
import { createRuntimeSystems, type RuntimeSystems } from "./local/create-runtime-systems";
import type { RuntimeEventHandler, RuntimeStartupOptions, RuntimeEvent } from "./types";
import { RuntimeProtocolSession } from "./protocol/session";
import type {
  RuntimeCell,
  RuntimeCommandIdentity,
  RuntimeLevelIdentity,
  RuntimeObservationScope,
  RuntimeProtocolHandshake,
} from "./protocol/types";

/** Public worker commands, callback dispatch and coordinated runtime lifecycle. */
class LocalNetHackRuntime {
  declare runtimeVersion: NethackRuntimeVersion;
  declare eventHandler: RuntimeEventHandler;
  declare startupOptions: RuntimeStartupOptions;
  declare isClosed: boolean;
  declare nethackInstance: any;
  declare nethackModule: any;
  declare ready: Promise<void>;
  declare runtimeTerminationEmitted: boolean;

  private readonly systems: RuntimeSystems;
  readonly protocol: RuntimeProtocolSession;
  readonly runtimeSourceUrl = import.meta.url;

  constructor(eventHandler: RuntimeEventHandler, startupOptions: RuntimeStartupOptions | null = null) {
    this.runtimeVersion = "3.6.7";
    this.eventHandler = eventHandler;
    this.startupOptions =
      startupOptions && typeof startupOptions === "object"
        ? startupOptions
        : {};
    this.isClosed = false;
    this.nethackInstance = null;
    this.runtimeTerminationEmitted = false;
    this.protocol = new RuntimeProtocolSession(
      this.startupOptions.protocolVersion === 1,
      event => {
        if (typeof this.eventHandler === "function") this.eventHandler(event);
      },
      () => this.getProtocolLevelIdentity(),
    );
    this.systems = createRuntimeSystems(this);
    this.ready = this.systems.bootstrap.initializeNetHack();
  }

  async start(): Promise<void> {
    await this.ready;
    this.systems.globalSnapshots.emitStartupObjectTileMap();
    this.systems.globalSnapshots.sendReconnectSnapshot();
    this.requestRuntimeGlobalsSnapshot();
  }

  sendInput(input: string, identity?: RuntimeCommandIdentity): void {
    this.protocol.dispatchCommand(identity, () => this.systems.inputDispatch.handleClientInput(input));
  }

  sendInputSequence(inputs: string[], identity?: RuntimeCommandIdentity): void {
    this.protocol.dispatchCommand(identity, () => this.systems.inputDispatch.handleClientInputSequence(inputs));
  }

  sendMouseInput(x: number, y: number, button: number, identity?: RuntimeCommandIdentity): void {
    this.protocol.dispatchCommand(identity, () => this.systems.inputDispatch.handleClientMouseInput(x, y, button));
  }

  getProtocolHandshake(sessionId: string): RuntimeProtocolHandshake {
    const root = (globalThis as typeof globalThis & { nethackGlobal?: any }).nethackGlobal;
    const helpers = root?.helpers, constants = root?.constants;
    const columns = constants?.COLNO, rows = constants?.ROWNO;
    // COLNO/ROWNO are compile-time constants (80/21) in every staged source;
    // use exported values when an artifact publishes them.
    const mapDimensions = Number.isSafeInteger(columns) &&
      Number.isSafeInteger(rows) &&
      columns > 0 &&
      rows > 0
      ? { columns, rows }
      : { columns: 80, rows: 21 };
    const pointerContract = this.systems.pointerContract.getRuntimePointerContract();
    const pointerAbi = pointerContract.abiTag || (
      this.runtimeVersion === "5.0"
        ? "nh5-pointer-v1"
        : this.runtimeVersion === "slashem"
          ? "slashem-pointer-v1"
          : "nh367-pointer-v1"
    );
    return { protocolVersion: 1, sessionId, runtimeVersion: this.runtimeVersion,
      artifactTag: this.systems.assets.readRuntimeBuildTag() || null,
      pointerAbi,
      pointerAbiValidated: this.systems.pointerContract.runtimePointerContractValidated,
      mapDimensions,
      capabilities: { orderedBatches: true, refreshSets: true, inputRequestIdentity: true,
        synchronousGlyphCallbacks: root?.nh3dSynchronousGlyphCallbacks === 1,
        glyphQuery: typeof helpers?.glyphAtHelper === "function", floorQuery: typeof helpers?.floorGlyphAtHelper === "function",
        underPlayerItemQuery: typeof helpers?.topItemGlyphUnderPlayer === "function" } };
  }

  getProtocolLevelIdentity(): RuntimeLevelIdentity | null {
    try {
      const root = (globalThis as typeof globalThis & { nethackGlobal?: any })
        .nethackGlobal?.globals;
      const level = (root?.u ?? root?.g?.u)?.uz;
      const dnum = this.systems?.memory.normalizeRuntimeInteger(level?.dnum);
      const dlevel = this.systems?.memory.normalizeRuntimeInteger(level?.dlevel);
      return dnum !== null &&
        dlevel !== null &&
        Number.isSafeInteger(dnum) &&
        Number.isSafeInteger(dlevel) &&
        dnum >= 0 &&
        dlevel > 0
        ? { dnum, dlevel }
        : null;
    } catch {
      return null;
    }
  }

  requestTileUpdate(x: number, y: number): void {
    this.systems.tileRefresh.handleTileUpdateRequest(x, y);
  }

  requestAreaUpdate(centerX: number, centerY: number, radius: number): void {
    this.systems.tileRefresh.handleAreaUpdateRequest(centerX, centerY, radius);
  }

  requestCells(
    refreshId: number,
    cells: readonly RuntimeCell[],
    scope: RuntimeObservationScope,
    includeUnderPlayer = false,
  ): void {
    this.systems.tileRefresh.handleCellRefreshSet(refreshId, cells, scope, includeUnderPlayer);
  }

  requestRuntimeGlobalsSnapshot(): void {
    const snapshot = this.systems.globalSnapshots.buildRuntimeGlobalsSnapshot();
    const restoredNumberPadMode =
      extractRuntimeNumberPadModeEnabled(snapshot);
    if (restoredNumberPadMode !== null) {
      this.systems.keyboardInput.numberPadModeEnabled = restoredNumberPadMode;
    }
    this.emit({
      type: "runtime_globals_snapshot",
      snapshot,
    });
  }

  shutdown(reason = "session shutdown"): void {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;
    this.protocol.shutdown();
    this.systems.tileRefresh.cancelPendingRefreshSets();
    console.log(`Shutting down NetHack session: ${reason}`);
    this.systems.inputRequests.inputBroker.drain();
    this.systems.inputRequests.silentInventoryRefreshPending = false;
    this.systems.inputRequests.commandInputContinuation = "none";
    this.systems.textInput.pendingTextResponses = [];
    this.systems.textInput.pendingStdinByteQueue = [];
    this.systems.recovery.didAutoQueueRawRecoverChoice = false;
    this.systems.positionInput.farLookMode = "none";
    this.systems.positionInput.farLookOrigin = null;
    this.systems.positionInput.pendingLookMenuFarLookArm = false;
    this.systems.positionInput.pendingLegacySlashEmCursorPromptFarLook = false;
    this.systems.positionInput.pendingTravelPositionInputArm = false;
    this.systems.contextualLook.contextualGlanceProbeMouseDeadlineMs = 0;
    this.systems.contextualLook.contextualGlanceAutoCancelPositionUntilMs = 0;
    this.systems.contextualLook.contextualLookInfoProbeMouseDeadlineMs = 0;
    this.systems.contextualLook.pendingContextualLookMapRouteSelection = false;
    this.systems.contextualLook.contextualLookInfoAutoFlowStage = "none";
    this.systems.contextualLook.contextualLookInfoAutoFlowUntilMs = 0;
    this.systems.questionInput.legacyAutoHelpYnPromptSignature = "";
    this.systems.questionInput.legacyAutoHelpYnPromptUntilMs = 0;
    this.systems.postActionRefresh.pendingPostActionPlayerTileRefreshReason = null;
    this.systems.postActionRefresh.pendingPostActionPlayerTileRefreshTarget = null;
    this.systems.postActionRefresh.pendingPostActionPlayerTileRefreshSnapshot = null;
    this.systems.positionInput.setPositionInputActive(false);
    this.systems.inputRequests.activeInputRequest = null;
    this.systems.menuSelection.menuSelections.clear();
    this.systems.extendedCommands.pendingExtendedCommand = null;
    this.systems.extendedCommands.extendedCommandTriggerQueued = false;
    this.systems.extendedCommands.resolvePendingExtendedCommandRequest(-1);
    this.systems.inventoryContext.pendingInventoryContextSelection = null;
    this.systems.inputRequests.awaitingQuestionInput = false;
    this.systems.windowText.windowTextBuffers.clear();
    this.systems.promptContext.lastPromptContextMessage = "";
    this.systems.promptContext.lastPromptContextEntry = null;
    this.systems.promptContext.promptContextHistory = [];
    this.systems.menuSelection.lastMenuInteractionCancelled = false;
    this.systems.gameOver.gameOverSequenceActive = false;
    this.systems.gameOver.gameOverEmptyRawPrintCount = 0;
    this.systems.gameOver.lastGameOverHow = null;
    this.systems.gameOver.lastGameOverWhen = null;

    if (this.systems.menuSelection.pendingMenuSelection && this.systems.menuSelection.pendingMenuSelection.resolver) {
      const resolver = this.systems.menuSelection.pendingMenuSelection.resolver;
      this.systems.menuSelection.pendingMenuSelection = null;
      this.systems.menuSelection.menuSelectionReadyCount = null;
      try {
        resolver(0);
      } catch (error) {
        console.log("Menu selection resolver shutdown error:", error);
      }
    }

    this.systems.inputRequests.inputBroker.cancelAll(27);
  }

  handleUICallback(name: string, args: any[]): any {
    if (this.isClosed) {
      return 0;
    }
    this.systems.startupDiagnostics.uiCallbackCount += 1;
    this.systems.startupDiagnostics.clearStartupNoCallbackTimer();
    let shouldLogUiCallback = true;
    if (name === "shim_print_glyph") {
      // Avoid duplicate callback-level spam for map glyph traffic.
      shouldLogUiCallback = false;
    }
    if (shouldLogUiCallback && isLoggingEnabled()) {
      console.log(`UI Callback: ${name}`, args);
    }
    this.systems.promptContext.recordRecentUICallback(name, args);
    if (!this.systems.pointerContract.validateCallbackPointerContract(name, args)) {
      return this.systems.pointerContract.getSafeCallbackDefaultReturn(name);
    }
    const isRawPrintCallback = this.systems.promptContext.isRawPrintCallbackName(name);
    if (
      this.systems.gameOver.gameOverSequenceActive &&
      this.systems.gameOver.gameOverEmptyRawPrintCount > 0 &&
      !isRawPrintCallback
    ) {
      this.systems.gameOver.gameOverEmptyRawPrintCount = 0;
    }

    return this.protocol.tracksCallback(name)
      ? this.protocol.invokeCallback(name, () => this.dispatchUICallback(name, args))
      : this.dispatchUICallback(name, args);
  }

  private dispatchUICallback(name: string, args: any[]): any {
    switch (name) {
      case "shim_get_nh_event": return this.systems.inputRequests.handleShimGetNhEvent();
      case "shim_nhgetch": return this.systems.inputRequests.handleShimNhGetch();
      case "shim_yn_function": return this.systems.questionInput.handleShimYnFunction(args);
      case "shim_nh_poskey": return this.systems.positionInput.handleShimNhPoskey(args);
      case "shim_getlin": return this.systems.textInput.handleShimGetlin(args);
      case "shim_get_ext_cmd":
        return this.systems.extendedCommands.handleShimGetExtCmd();

      case "shim_init_nhwindows":
        return this.systems.startupOptions.handleShimInitNhwindows(args);
      case "shim_create_nhwindow":
        return this.systems.windowText.handleShimCreateNhwindow(args);
      case "shim_status_init":
        console.log("Initializing status display");
        return 0;
      case "shim_start_menu":
        return this.systems.menuCapture.handleShimStartMenu(args);
      case "shim_end_menu":
        return this.systems.menuCapture.handleShimEndMenu(args);
      case "shim_display_nhwindow":
        return this.systems.windowText.handleShimDisplayNhwindow(args);
      case "shim_display_file":
        return this.systems.windowText.handleShimDisplayFile(args);
      case "shim_add_menu":
        return this.systems.menuCapture.handleShimAddMenu(args);
      case "shim_putstr":
        return this.systems.messages.handleShimPutstr(args);
      case "shim_print_glyph":
        return this.systems.mapCallbacks.handleShimPrintGlyph(args);

      case "shim_monster_attack":
        return this.systems.mapCallbacks.handleShimMonsterAttack(args);

      case "shim_monster_killed":
        return this.systems.mapCallbacks.handleShimMonsterKilled(args);

      case "shim_player_selection":
        console.log("NetHack player selection started");
        // TO-DO: Is it OK we ignore this?
        return 0;
      case "shim_raw_print":
        return this.systems.messages.handleShimRawPrint(args);
      case "shim_raw_print_bold":
        return this.systems.messages.handleShimRawPrintBold(args);
      case "shim_message_menu":
        return this.systems.messages.handleShimMessageMenu(args);
      case "shim_update_inventory":
        return this.systems.menuCapture.handleShimUpdateInventory();
      case "shim_wait_synch":
        console.log("NetHack waiting for synchronization");
        return 0;
      case "shim_nhbell":
        console.log("NetHack requested bell");
        return 0;
      case "shim_select_menu":
        return this.systems.menuSelection.handleShimSelectMenu(args);

      case "shim_askname":
        return this.systems.startupOptions.handleShimAskname(args);
      case "shim_mark_synch":
        console.log("NetHack marking synchronization");
        return 0;

      case "shim_cliparound":
        return this.systems.mapCallbacks.handleShimCliparound(args);

      case "shim_clear_nhwindow":
        return this.systems.windowText.handleShimClearNhwindow(args);

      case "shim_update_positionbar":
        // Positionbar is tty-era UI; map/cliparound events already drive view state.
        return 0;
      case "shim_getmsghistory":
        return this.systems.messages.handleShimGetmsghistory(args);

      case "shim_putmsghistory":
        return this.systems.messages.handleShimPutmsghistory(args);

      case "shim_doprev_message":
        return this.systems.messages.handleShimDoprevMessage();

      case "shim_exit_nhwindows":
        return this.systems.gameOver.handleShimExitNhwindows(args);
      case "shim_suspend_nhwindows":
        console.log("Suspending NetHack windows");
        return 0;
      case "shim_resume_nhwindows":
        console.log("Resuming NetHack windows");
        return 0;
      case "shim_destroy_nhwindow":
        return this.systems.windowText.handleShimDestroyNhwindow(args);
      case "shim_curs":
        return this.systems.mapCallbacks.handleShimCurs(args);

      case "shim_status_update":
        return this.systems.status.handleShimStatusUpdate(args);

      case "shim_status_enablefield":
        return this.systems.status.handleShimStatusEnablefield(args);
      case "shim_number_pad":
        return this.systems.keyboardInput.handleShimNumberPad(args);

      case "shim_delay_output":
        return this.systems.travel.handleShimDelayOutput();

      case "shim_change_color":
        // Dynamic color remapping is not used by this client renderer.
        return 0;
      case "shim_change_background":
        return 0;
      case "set_shim_font_name":
        return 0;
      case "shim_get_color_string":
        // 3.6.7 shim marshalling for string returns writes into ret_ptr directly.
        // Keep this empty to avoid corrupting the stack frame.
        return "";
      case "shim_start_screen":
        console.log("NetHack start_screen (no-op)");
        return 0;
      case "shim_end_screen":
        console.log("NetHack end_screen (no-op)");
        return 0;
      case "shim_outrip":
        return this.systems.gameOver.handleShimOutrip(args);

      case "shim_preference_update":
        // Preferences are already controlled via options/init in this client.
        return 0;
      case "shim_player_selection_cb":
        return true;

      default:
        console.log(`Unknown callback: ${name}`, args);
        return 0;
    }
  }

  emitRuntimeTerminated(reason: string, exitCode: number): void {
    if (this.runtimeTerminationEmitted) {
      return;
    }
    this.runtimeTerminationEmitted = true;
    this.emit({
      type: "runtime_terminated",
      reason: reason || "Program terminated with exit(0)",
      exitCode: Number.isFinite(exitCode) ? Number(exitCode) : 0,
    });
  }

  emit(payload: RuntimeEvent): void {
    const previousPresentationGeneration = this.protocol.scope.presentationGeneration;
    const previousLevelGeneration = this.protocol.scope.levelGeneration;
    this.protocol.publish(payload);
    if (
      this.systems?.tileRefresh &&
      (this.protocol.scope.presentationGeneration !== previousPresentationGeneration ||
        this.protocol.scope.levelGeneration !== previousLevelGeneration)
    ) {
      this.systems.tileRefresh.identifiedRequests.cancelObsolete();
    }
  }
}

export default LocalNetHackRuntime;
