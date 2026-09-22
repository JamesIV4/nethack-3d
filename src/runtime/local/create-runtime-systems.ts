import { RuntimeInputDispatch } from "./input/client-dispatch";
import { RuntimeInputRequests } from "./input/input-requests";
import { RuntimeKeyboardInput } from "./input/keyboard";
import { RuntimeMouseInput } from "./input/mouse-poskey";
import { RuntimeTextInput } from "./input/text-input";
import { RuntimePositionInput } from "./input/position-selection";
import { RuntimeQuestionInput } from "./input/questions";
import { RuntimeContextualLook } from "./input/contextual-look";
import { RuntimeTileContextMenus } from "./menus/tile-context";
import { RuntimePostActionRefresh } from "./world/post-action-refresh";
import { RuntimeUnderPlayerItems } from "./world/under-player-items";
import { RuntimeTileRefresh } from "./world/tile-refresh";
import { RuntimeGlyphs } from "./world/glyphs";
import { RuntimePromptContext } from "./messages/prompt-context";
import { RuntimeWindowText } from "./messages/window-text";
import { RuntimeInventorySnapshots } from "./menus/inventory-snapshots";
import { RuntimeMenuSelection } from "./menus/selection";
import { RuntimeInventoryContext } from "./menus/inventory-context";
import { RuntimeExtendedCommands } from "./input/extended-commands";
import { RuntimeExtendedCommandCatalog } from "./input/extended-command-catalog";
import { RuntimeStatus } from "./status/status";
import { RuntimeGlobalSnapshots } from "./world/global-snapshots";
import { RuntimeGameOver } from "./lifecycle/game-over";
import { RuntimeAssets } from "./startup/runtime-assets";
import { RuntimeStartupConfiguration } from "./startup/startup-configuration";
import { RuntimeBootstrap } from "./startup/bootstrap";
import { RuntimeStartupDiagnostics } from "./diagnostics/startup-diagnostics";
import { RuntimePointerContract } from "./abi/pointer-contract";
import { RuntimeMemory } from "./abi/memory";
import { RuntimeCheckpoints } from "./persistence/checkpoint-files";
import { RuntimeCheckpointRecovery } from "./persistence/checkpoint-recovery";
import { RuntimeSlashEmLocks } from "./persistence/slashem-locks";
import { RuntimePersistence } from "./persistence/startup-persistence";
import { RuntimeMapCallbacks } from "./world/map-callbacks";
import { RuntimeMessages } from "./messages/message-callbacks";
import { RuntimeMenuCapture } from "./menus/menu-capture";
import { RuntimeWindows } from "./messages/windows";
import { RuntimeTravel } from "./input/travel-delay";
import type { RuntimeCoordinator } from "./runtime-coordinator";

export interface RuntimeSystems {
  readonly inputDispatch: RuntimeInputDispatch;
  readonly inputRequests: RuntimeInputRequests;
  readonly keyboardInput: RuntimeKeyboardInput;
  readonly mouseInput: RuntimeMouseInput;
  readonly textInput: RuntimeTextInput;
  readonly positionInput: RuntimePositionInput;
  readonly questionInput: RuntimeQuestionInput;
  readonly contextualLook: RuntimeContextualLook;
  readonly tileContextMenus: RuntimeTileContextMenus;
  readonly postActionRefresh: RuntimePostActionRefresh;
  readonly underPlayerItems: RuntimeUnderPlayerItems;
  readonly tileRefresh: RuntimeTileRefresh;
  readonly runtimeGlyphs: RuntimeGlyphs;
  readonly promptContext: RuntimePromptContext;
  readonly windowText: RuntimeWindowText;
  readonly inventorySnapshots: RuntimeInventorySnapshots;
  readonly menuSelection: RuntimeMenuSelection;
  readonly inventoryContext: RuntimeInventoryContext;
  readonly extendedCommands: RuntimeExtendedCommands;
  readonly extendedCommandCatalog: RuntimeExtendedCommandCatalog;
  readonly status: RuntimeStatus;
  readonly globalSnapshots: RuntimeGlobalSnapshots;
  readonly gameOver: RuntimeGameOver;
  readonly assets: RuntimeAssets;
  readonly startupOptions: RuntimeStartupConfiguration;
  readonly bootstrap: RuntimeBootstrap;
  readonly startupDiagnostics: RuntimeStartupDiagnostics;
  readonly pointerContract: RuntimePointerContract;
  readonly memory: RuntimeMemory;
  readonly checkpoints: RuntimeCheckpoints;
  readonly recovery: RuntimeCheckpointRecovery;
  readonly slashEmLocks: RuntimeSlashEmLocks;
  readonly persistence: RuntimePersistence;
  readonly mapCallbacks: RuntimeMapCallbacks;
  readonly messages: RuntimeMessages;
  readonly menuCapture: RuntimeMenuCapture;
  readonly windows: RuntimeWindows;
  readonly travel: RuntimeTravel;
}

/** Assemble all owners before starting WASM; getters defer peer lookup until use. */
export function createRuntimeSystems(coordinator: RuntimeCoordinator): RuntimeSystems {
  const inputDispatch: RuntimeInputDispatch = new RuntimeInputDispatch({
    get contextualLook() { return contextualLook; },
    get coordinator() { return coordinator; },
    get extendedCommandCatalog() { return extendedCommandCatalog; },
    get extendedCommands() { return extendedCommands; },
    get gameOver() { return gameOver; },
    get inputRequests() { return inputRequests; },
    get inventoryContext() { return inventoryContext; },
    get inventorySnapshots() { return inventorySnapshots; },
    get keyboardInput() { return keyboardInput; },
    get mapCallbacks() { return mapCallbacks; },
    get menuSelection() { return menuSelection; },
    get mouseInput() { return mouseInput; },
    get positionInput() { return positionInput; },
    get postActionRefresh() { return postActionRefresh; },
    get questionInput() { return questionInput; },
    get textInput() { return textInput; },
  });
  const inputRequests: RuntimeInputRequests = new RuntimeInputRequests({
    get contextualLook() { return contextualLook; },
    get coordinator() { return coordinator; },
    get extendedCommands() { return extendedCommands; },
    get inventoryContext() { return inventoryContext; },
    get keyboardInput() { return keyboardInput; },
    get menuSelection() { return menuSelection; },
    get mouseInput() { return mouseInput; },
    get positionInput() { return positionInput; },
    get questionInput() { return questionInput; },
    get tileRefresh() { return tileRefresh; },
  });
  const keyboardInput: RuntimeKeyboardInput = new RuntimeKeyboardInput({
    get coordinator() { return coordinator; },
    get mapCallbacks() { return mapCallbacks; },
    get menuSelection() { return menuSelection; },
    get questionInput() { return questionInput; },
  });
  const mouseInput: RuntimeMouseInput = new RuntimeMouseInput({
    get coordinator() { return coordinator; },
    get inputRequests() { return inputRequests; },
    get memory() { return memory; },
    get pointerContract() { return pointerContract; },
    get tileContextMenus() { return tileContextMenus; },
    get travel() { return travel; },
  });
  const textInput: RuntimeTextInput = new RuntimeTextInput({
    get coordinator() { return coordinator; },
    get keyboardInput() { return keyboardInput; },
    get memory() { return memory; },
    get pointerContract() { return pointerContract; },
    get promptContext() { return promptContext; },
    get tileRefresh() { return tileRefresh; },
  });
  const positionInput: RuntimePositionInput = new RuntimePositionInput({
    get contextualLook() { return contextualLook; },
    get coordinator() { return coordinator; },
    get inputRequests() { return inputRequests; },
    get inventoryContext() { return inventoryContext; },
    get keyboardInput() { return keyboardInput; },
    get mapCallbacks() { return mapCallbacks; },
    get menuSelection() { return menuSelection; },
    get postActionRefresh() { return postActionRefresh; },
  });
  const questionInput: RuntimeQuestionInput = new RuntimeQuestionInput({
    get contextualLook() { return contextualLook; },
    get coordinator() { return coordinator; },
    get gameOver() { return gameOver; },
    get inputRequests() { return inputRequests; },
    get inventorySnapshots() { return inventorySnapshots; },
    get keyboardInput() { return keyboardInput; },
    get menuSelection() { return menuSelection; },
    get positionInput() { return positionInput; },
    get recovery() { return recovery; },
  });
  const contextualLook: RuntimeContextualLook = new RuntimeContextualLook({
    get coordinator() { return coordinator; },
    get menuSelection() { return menuSelection; },
    get questionInput() { return questionInput; },
  });
  const tileContextMenus: RuntimeTileContextMenus = new RuntimeTileContextMenus({
    get coordinator() { return coordinator; },
    get inventoryContext() { return inventoryContext; },
    get menuSelection() { return menuSelection; },
  });
  const postActionRefresh: RuntimePostActionRefresh = new RuntimePostActionRefresh({
    get coordinator() { return coordinator; },
    get inputRequests() { return inputRequests; },
    get mapCallbacks() { return mapCallbacks; },
    get menuSelection() { return menuSelection; },
    get positionInput() { return positionInput; },
    get questionInput() { return questionInput; },
    get runtimeGlyphs() { return runtimeGlyphs; },
    get tileRefresh() { return tileRefresh; },
    get underPlayerItems() { return underPlayerItems; },
  });
  const underPlayerItems: RuntimeUnderPlayerItems = new RuntimeUnderPlayerItems({
    get coordinator() { return coordinator; },
    get mapCallbacks() { return mapCallbacks; },
    get postActionRefresh() { return postActionRefresh; },
    get runtimeGlyphs() { return runtimeGlyphs; },
    get tileRefresh() { return tileRefresh; },
  });
  const tileRefresh: RuntimeTileRefresh = new RuntimeTileRefresh({
    get coordinator() { return coordinator; },
    get inputRequests() { return inputRequests; },
    get mapCallbacks() { return mapCallbacks; },
    get menuSelection() { return menuSelection; },
    get runtimeGlyphs() { return runtimeGlyphs; },
    get textInput() { return textInput; },
    get underPlayerItems() { return underPlayerItems; },
    get windows() { return windows; },
  });
  const runtimeGlyphs: RuntimeGlyphs = new RuntimeGlyphs({

  });
  const promptContext: RuntimePromptContext = new RuntimePromptContext({
    get menuSelection() { return menuSelection; },
    get messages() { return messages; },
    get positionInput() { return positionInput; },
    get windows() { return windows; },
  });
  const windowText: RuntimeWindowText = new RuntimeWindowText({
    get coordinator() { return coordinator; },
    get gameOver() { return gameOver; },
    get inputRequests() { return inputRequests; },
    get messages() { return messages; },
    get promptContext() { return promptContext; },
    get windows() { return windows; },
  });
  const inventorySnapshots: RuntimeInventorySnapshots = new RuntimeInventorySnapshots({
    get menuSelection() { return menuSelection; },
  });
  const menuSelection: RuntimeMenuSelection = new RuntimeMenuSelection({
    get coordinator() { return coordinator; },
    get gameOver() { return gameOver; },
    get inputRequests() { return inputRequests; },
    get inventoryContext() { return inventoryContext; },
    get inventorySnapshots() { return inventorySnapshots; },
    get memory() { return memory; },
    get pointerContract() { return pointerContract; },
    get positionInput() { return positionInput; },
    get postActionRefresh() { return postActionRefresh; },
    get tileRefresh() { return tileRefresh; },
  });
  const inventoryContext: RuntimeInventoryContext = new RuntimeInventoryContext({
    get contextualLook() { return contextualLook; },
    get coordinator() { return coordinator; },
    get menuSelection() { return menuSelection; },
    get positionInput() { return positionInput; },
  });
  const extendedCommandCatalog: RuntimeExtendedCommandCatalog = new RuntimeExtendedCommandCatalog({
    get coordinator() { return coordinator; },
    get memory() { return memory; },
    get pointerContract() { return pointerContract; },
  });
  const status: RuntimeStatus = new RuntimeStatus({
    get coordinator() { return coordinator; },
    get gameOver() { return gameOver; },
    get globalSnapshots() { return globalSnapshots; },
  });
  const globalSnapshots: RuntimeGlobalSnapshots = new RuntimeGlobalSnapshots({
    get coordinator() { return coordinator; },
    get extendedCommandCatalog() { return extendedCommandCatalog; },
    get inventorySnapshots() { return inventorySnapshots; },
    get mapCallbacks() { return mapCallbacks; },
    get memory() { return memory; },
    get messages() { return messages; },
    get runtimeGlyphs() { return runtimeGlyphs; },
    get startupOptions() { return startupOptions; },
    get status() { return status; },
  });
  const gameOver: RuntimeGameOver = new RuntimeGameOver({
    get checkpoints() { return checkpoints; },
    get coordinator() { return coordinator; },
    get memory() { return memory; },
    get menuSelection() { return menuSelection; },
    get promptContext() { return promptContext; },
    get startupOptions() { return startupOptions; },
    get windowText() { return windowText; },
  });
  const assets: RuntimeAssets = new RuntimeAssets({
    get coordinator() { return coordinator; },
  });
  const startupOptions: RuntimeStartupConfiguration = new RuntimeStartupConfiguration({
    get coordinator() { return coordinator; },
    get gameOver() { return gameOver; },
    get inputRequests() { return inputRequests; },
    get textInput() { return textInput; },
  });
  const extendedCommands: RuntimeExtendedCommands = new RuntimeExtendedCommands({
    get coordinator() { return coordinator; },
    get extendedCommandCatalog() { return extendedCommandCatalog; },
    get inputRequests() { return inputRequests; },
    get inventoryContext() { return inventoryContext; },
    get keyboardInput() { return keyboardInput; },
    get menuSelection() { return menuSelection; },
    get positionInput() { return positionInput; },
    get startupOptions() { return startupOptions; },
    get textInput() { return textInput; },
  });
  const bootstrap: RuntimeBootstrap = new RuntimeBootstrap({
    get assets() { return assets; },
    get coordinator() { return coordinator; },
    get memory() { return memory; },
    get persistence() { return persistence; },
    get pointerContract() { return pointerContract; },
    get recovery() { return recovery; },
    get slashEmLocks() { return slashEmLocks; },
    get startupDiagnostics() { return startupDiagnostics; },
    get startupOptions() { return startupOptions; },
    get status() { return status; },
    get textInput() { return textInput; },
    get windows() { return windows; },
  });
  const startupDiagnostics: RuntimeStartupDiagnostics = new RuntimeStartupDiagnostics({
    get coordinator() { return coordinator; },
    get startupOptions() { return startupOptions; },
  });
  const pointerContract: RuntimePointerContract = new RuntimePointerContract({
    get coordinator() { return coordinator; },
    get memory() { return memory; },
  });
  const memory: RuntimeMemory = new RuntimeMemory({
    get coordinator() { return coordinator; },
    get pointerContract() { return pointerContract; },
  });
  const checkpoints: RuntimeCheckpoints = new RuntimeCheckpoints({
    get coordinator() { return coordinator; },
    get gameOver() { return gameOver; },
    get memory() { return memory; },
    get recovery() { return recovery; },
    get startupOptions() { return startupOptions; },
  });
  const recovery: RuntimeCheckpointRecovery = new RuntimeCheckpointRecovery({
    get checkpoints() { return checkpoints; },
    get coordinator() { return coordinator; },
    get menuSelection() { return menuSelection; },
    get startupOptions() { return startupOptions; },
  });
  const slashEmLocks: RuntimeSlashEmLocks = new RuntimeSlashEmLocks({
    get coordinator() { return coordinator; },
  });
  const persistence: RuntimePersistence = new RuntimePersistence({
    get checkpoints() { return checkpoints; },
  });
  const mapCallbacks: RuntimeMapCallbacks = new RuntimeMapCallbacks({
    get coordinator() { return coordinator; },
    get memory() { return memory; },
    get pointerContract() { return pointerContract; },
    get positionInput() { return positionInput; },
    get postActionRefresh() { return postActionRefresh; },
    get runtimeGlyphs() { return runtimeGlyphs; },
    get tileRefresh() { return tileRefresh; },
    get underPlayerItems() { return underPlayerItems; },
    get windows() { return windows; },
  });
  const messages: RuntimeMessages = new RuntimeMessages({
    get contextualLook() { return contextualLook; },
    get coordinator() { return coordinator; },
    get gameOver() { return gameOver; },
    get positionInput() { return positionInput; },
    get postActionRefresh() { return postActionRefresh; },
    get promptContext() { return promptContext; },
    get recovery() { return recovery; },
    get textInput() { return textInput; },
    get windowText() { return windowText; },
    get windows() { return windows; },
  });
  const menuCapture: RuntimeMenuCapture = new RuntimeMenuCapture({
    get contextualLook() { return contextualLook; },
    get coordinator() { return coordinator; },
    get inputRequests() { return inputRequests; },
    get inventoryContext() { return inventoryContext; },
    get inventorySnapshots() { return inventorySnapshots; },
    get memory() { return memory; },
    get menuSelection() { return menuSelection; },
    get pointerContract() { return pointerContract; },
    get postActionRefresh() { return postActionRefresh; },
    get questionInput() { return questionInput; },
    get runtimeGlyphs() { return runtimeGlyphs; },
    get tileContextMenus() { return tileContextMenus; },
    get windowText() { return windowText; },
    get windows() { return windows; },
  });
  const windows: RuntimeWindows = new RuntimeWindows({
    get coordinator() { return coordinator; },
  });
  const travel: RuntimeTravel = new RuntimeTravel({
    get coordinator() { return coordinator; },
    get mapCallbacks() { return mapCallbacks; },
    get mouseInput() { return mouseInput; },
    get status() { return status; },
  });
  return {
    inputDispatch,
    inputRequests,
    keyboardInput,
    mouseInput,
    textInput,
    positionInput,
    questionInput,
    contextualLook,
    tileContextMenus,
    postActionRefresh,
    underPlayerItems,
    tileRefresh,
    runtimeGlyphs,
    promptContext,
    windowText,
    inventorySnapshots,
    menuSelection,
    inventoryContext,
    extendedCommands,
    extendedCommandCatalog,
    status,
    globalSnapshots,
    gameOver,
    assets,
    startupOptions,
    bootstrap,
    startupDiagnostics,
    pointerContract,
    memory,
    checkpoints,
    recovery,
    slashEmLocks,
    persistence,
    mapCallbacks,
    messages,
    menuCapture,
    windows,
    travel,
  };
}
