import type { NethackRuntimeVersion } from "./types";
import { extractRuntimeNumberPadModeEnabled } from "./number-pad-mode";
import { createRuntimeSystems, type RuntimeSystems } from "./local/create-runtime-systems";
import type { RuntimeEventHandler, RuntimeStartupOptions, RuntimeEvent } from "./types";

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
    this.systems = createRuntimeSystems(this);
    this.ready = this.systems.bootstrap.initializeNetHack();
  }

  async start(): Promise<void> {
    await this.ready;
    this.systems.globalSnapshots.emitStartupObjectTileMap();
    this.systems.globalSnapshots.sendReconnectSnapshot();
    this.requestRuntimeGlobalsSnapshot();
  }

  sendInput(input: string): void {
    this.systems.inputDispatch.handleClientInput(input);
  }

  sendInputSequence(inputs: string[]): void {
    this.systems.inputDispatch.handleClientInputSequence(inputs);
  }

  sendMouseInput(x: number, y: number, button: number): void {
    this.systems.inputDispatch.handleClientMouseInput(x, y, button);
  }

  requestTileUpdate(x: number, y: number): void {
    this.systems.tileRefresh.handleTileUpdateRequest(x, y);
  }

  requestAreaUpdate(centerX: number, centerY: number, radius: number): void {
    this.systems.tileRefresh.handleAreaUpdateRequest(centerX, centerY, radius);
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
    console.log(`Shutting down NetHack session: ${reason}`);
    this.systems.inputRequests.inputBroker.drain();
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
    if (shouldLogUiCallback) {
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

    const inputCallbackHandlers: Record<string, () => any> = {
      shim_get_nh_event: () => this.systems.inputRequests.handleShimGetNhEvent(),
      shim_nhgetch: () => this.systems.inputRequests.handleShimNhGetch(),
      shim_yn_function: () => this.systems.questionInput.handleShimYnFunction(args),
      shim_nh_poskey: () => this.systems.positionInput.handleShimNhPoskey(args),
      shim_getlin: () => this.systems.textInput.handleShimGetlin(args),
    };
    const mappedInputHandler = inputCallbackHandlers[name];
    if (mappedInputHandler) {
      return mappedInputHandler();
    }

    switch (name) {
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
    if (typeof this.eventHandler === "function") {
      this.eventHandler(payload);
    }
  }
}

export default LocalNetHackRuntime;
