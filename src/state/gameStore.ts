import { create } from "zustand";
import { shallow } from "zustand/shallow";
import type {
  GameOverState,
  InfoMenuState,
  InventoryDialogState,
  Nethack3DEngineController,
  NethackConnectionState,
  FpsCrosshairContextState,
  NewGamePromptState,
  PlayerStatsSnapshot,
  QuestionDialogState,
  TextInputRequestState,
} from "../game/ui-types";
import {
  createEmptyGameOverPostmortemReports,
  createEmptyRunTelemetrySnapshot,
} from "../game/ui-types";

export type FloatingMessage = {
  id: number;
  text: string;
};

export const defaultPlayerStats: PlayerStatsSnapshot = {
  name: "Adventurer",
  hp: 10,
  maxHp: 10,
  power: 0,
  maxPower: 0,
  level: 1,
  experience: 0,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  armor: 10,
  dungeon: "Dungeons of Doom",
  dlevel: 1,
  locationLabel: "",
  gold: 0,
  alignment: "Neutral",
  hunger: "Not Hungry",
  encumbrance: "",
  conditionMask: 0,
  time: 1,
  score: 0,
};

type GameStore = {
  loadingVisible: boolean;
  uiBlockingVisible: boolean;
  statusText: string;
  connectionState: NethackConnectionState;
  connectionText: string;
  gameMessages: string[];
  floatingMessages: FloatingMessage[];
  floatingMessageFadeDelayMs: number;
  floatingMessageFadeDurationMs: number;
  playerStats: PlayerStatsSnapshot;
  question: QuestionDialogState | null;
  directionQuestion: string | null;
  numberPadModeEnabled: boolean;
  infoMenu: InfoMenuState | null;
  inventory: InventoryDialogState;
  textInput: TextInputRequestState | null;
  fpsCrosshairContext: FpsCrosshairContextState | null;
  repeatActionVisible: boolean;
  extendedCommands: string[];
  positionRequest: string | null;
  positionInputActive: boolean;
  positionInputOrigin: string | null;
  newGamePrompt: NewGamePromptState;
  gameOver: GameOverState;
  engineController: Nethack3DEngineController | null;
  nextFloatingMessageId: number;
  setLoadingVisible: (visible: boolean) => void;
  setUiBlockingVisible: (visible: boolean) => void;
  setStatusText: (text: string) => void;
  setConnectionStatus: (text: string, state: NethackConnectionState) => void;
  setGameMessages: (messages: string[]) => void;
  pushFloatingMessage: (message: string) => void;
  removeFloatingMessage: (id: number) => void;
  setFloatingMessageTiming: (delayMs: number, durationMs: number) => void;
  setPlayerStats: (stats: PlayerStatsSnapshot) => void;
  setQuestion: (question: QuestionDialogState | null) => void;
  setDirectionQuestion: (text: string | null) => void;
  setNumberPadModeEnabled: (enabled: boolean) => void;
  setInfoMenu: (menu: InfoMenuState | null) => void;
  setInventory: (inventory: InventoryDialogState) => void;
  setTextInput: (input: TextInputRequestState | null) => void;
  setFpsCrosshairContext: (context: FpsCrosshairContextState | null) => void;
  setRepeatActionVisible: (visible: boolean) => void;
  setExtendedCommands: (commands: string[]) => void;
  setPositionRequest: (text: string | null) => void;
  setPositionInputActive: (active: boolean, origin?: string | null) => void;
  setNewGamePrompt: (prompt: NewGamePromptState) => void;
  setGameOver: (state: GameOverState) => void;
  setEngineController: (controller: Nethack3DEngineController | null) => void;
};

const defaultFloatingMessageFadeDelayMs = 1500;
const defaultFloatingMessageFadeDurationMs = 520;
const floatingMessageLifetimeBufferMs = 80;
const maxFloatingMessages = 12;

export const useGameStore = create<GameStore>((set, get) => ({
  loadingVisible: true,
  uiBlockingVisible: false,
  statusText: "",
  connectionState: "disconnected",
  connectionText: "Disconnected",
  gameMessages: [],
  floatingMessages: [],
  floatingMessageFadeDelayMs: defaultFloatingMessageFadeDelayMs,
  floatingMessageFadeDurationMs: defaultFloatingMessageFadeDurationMs,
  playerStats: { ...defaultPlayerStats },
  question: null,
  directionQuestion: null,
  numberPadModeEnabled: true,
  infoMenu: null,
  inventory: {
    visible: false,
    items: [],
    contextActionsEnabled: true,
  },
  textInput: null,
  fpsCrosshairContext: null,
  repeatActionVisible: false,
  extendedCommands: [],
  positionRequest: null,
  positionInputActive: false,
  positionInputOrigin: null,
  newGamePrompt: { visible: false, reason: null },
  gameOver: {
    active: false,
    deathMessage: null,
    promptReady: false,
    tombstoneLines: null,
    postmortemReports: createEmptyGameOverPostmortemReports(),
    telemetry: createEmptyRunTelemetrySnapshot(),
  },
  engineController: null,
  nextFloatingMessageId: 1,
  setLoadingVisible: (visible) => {
    if (get().loadingVisible === visible) return;
    set({ loadingVisible: visible });
  },
  setUiBlockingVisible: (visible) => {
    if (get().uiBlockingVisible === visible) return;
    set({ uiBlockingVisible: visible });
  },
  setStatusText: (text) => {
    if (get().statusText === text) return;
    set({ statusText: text });
  },
  setConnectionStatus: (text, state) => {
    if (get().connectionText === text && get().connectionState === state) return;
    set({
      connectionText: text,
      connectionState: state,
    });
  },
  setGameMessages: (messages) => {
    if (shallow(get().gameMessages, messages)) return;
    set({ gameMessages: messages });
  },
  pushFloatingMessage: (message) => {
    const trimmed = (message || "").replace(/\s+/g, " ").trim();
    if (!trimmed) {
      return;
    }
    const id = get().nextFloatingMessageId;
    set((state) => ({
      nextFloatingMessageId: id + 1,
      floatingMessages: [
        { id, text: trimmed },
        ...state.floatingMessages,
      ].slice(0, maxFloatingMessages),
    }));
    if (typeof window !== "undefined") {
      const fadeDelayMs = Math.max(250, Math.round(get().floatingMessageFadeDelayMs));
      const fadeDurationMs = Math.max(
        120,
        Math.round(get().floatingMessageFadeDurationMs),
      );
      const lifetimeMs =
        fadeDelayMs + fadeDurationMs + floatingMessageLifetimeBufferMs;
      window.setTimeout(() => {
        get().removeFloatingMessage(id);
      }, lifetimeMs);
    }
  },
  removeFloatingMessage: (id) => {
    if (!get().floatingMessages.some(entry => entry.id === id)) return;
    set((state) => ({
      floatingMessages: state.floatingMessages.filter(
        (entry) => entry.id !== id,
      ),
    }));
  },
  setFloatingMessageTiming: (delayMs, durationMs) => {
    const normalizedDelayMs = Math.max(250, Math.round(delayMs));
    const normalizedDurationMs = Math.max(120, Math.round(durationMs));
    set({
      floatingMessageFadeDelayMs: normalizedDelayMs,
      floatingMessageFadeDurationMs: normalizedDurationMs,
    });
  },
  setPlayerStats: (stats) => {
    // Runtime callbacks still run synchronously in full. Identical HUD values
    // retain their reference so the App hooks and layout effects can stay idle.
    if (shallow(get().playerStats, stats)) return;
    set({ playerStats: stats });
  },
  setQuestion: (question) => {
    set({ question });
  },
  setDirectionQuestion: (text) => {
    if (get().directionQuestion === text) return;
    set({ directionQuestion: text });
  },
  setNumberPadModeEnabled: (enabled) => {
    if (get().numberPadModeEnabled === Boolean(enabled)) return;
    set({ numberPadModeEnabled: Boolean(enabled) });
  },
  setInfoMenu: (menu) => {
    set({ infoMenu: menu });
  },
  setInventory: (inventory) => {
    set({ inventory });
  },
  setTextInput: (input) => {
    set({ textInput: input });
  },
  setFpsCrosshairContext: (context) => {
    set({ fpsCrosshairContext: context });
  },
  setRepeatActionVisible: (visible) => {
    if (get().repeatActionVisible === Boolean(visible)) return;
    set({ repeatActionVisible: Boolean(visible) });
  },
  setExtendedCommands: (commands) => {
    if (shallow(get().extendedCommands, commands)) return;
    set({ extendedCommands: commands });
  },
  setPositionRequest: (text) => {
    if (get().positionRequest === text) return;
    set({ positionRequest: text });
  },
  setPositionInputActive: (active, origin = null) => {
    const normalized = Boolean(active);
    const normalizedOrigin = normalized && typeof origin === "string" ? origin : null;
    if (get().positionInputActive === normalized && get().positionInputOrigin === normalizedOrigin) return;
    set({
      positionInputActive: normalized,
      positionInputOrigin: normalizedOrigin,
    });
  },
  setNewGamePrompt: (prompt) => {
    set({ newGamePrompt: prompt });
  },
  setGameOver: (state) => {
    set({ gameOver: state });
  },
  setEngineController: (controller) => {
    set({ engineController: controller });
  },
}));
