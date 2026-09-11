import {
  useMemo
} from "react";
import {
  createEngineUiAdapter
} from "../../../state/engineUiAdapter";
import {
  useGameStore
} from "../../../state/gameStore";

/** Creates the engine UI adapter and subscribes to game state. */
export function useGameSessionState() {
  const adapter = useMemo(() => createEngineUiAdapter(), []);

  const setEngineController = useGameStore(
    (state) => state.setEngineController,
  );

  const setPositionRequest = useGameStore((state) => state.setPositionRequest);

  const setFloatingMessageTiming = useGameStore(
    (state) => state.setFloatingMessageTiming,
  );

  const setNewGamePrompt = useGameStore((state) => state.setNewGamePrompt);

  const setGameOver = useGameStore((state) => state.setGameOver);

  const loadingVisible = useGameStore((state) => state.loadingVisible);

  const statusText = useGameStore((state) => state.statusText);

  const gameMessages = useGameStore((state) => state.gameMessages);

  const floatingMessages = useGameStore((state) => state.floatingMessages);

  const playerStats = useGameStore((state) => state.playerStats);

  const question = useGameStore((state) => state.question);

  const directionQuestion = useGameStore((state) => state.directionQuestion);

  const numberPadModeEnabled = useGameStore(
    (state) => state.numberPadModeEnabled,
  );

  const infoMenu = useGameStore((state) => state.infoMenu);

  const inventory = useGameStore((state) => state.inventory);

  const textInputRequest = useGameStore((state) => state.textInput);

  const fpsCrosshairContext = useGameStore(
    (state) => state.fpsCrosshairContext,
  );

  const repeatActionVisible = useGameStore(
    (state) => state.repeatActionVisible,
  );

  const positionRequest = useGameStore((state) => state.positionRequest);

  const positionInputActive = useGameStore(
    (state) => state.positionInputActive,
  );

  const positionInputOrigin = useGameStore(
    (state) => state.positionInputOrigin,
  );

  const connectionState = useGameStore((state) => state.connectionState);

  const extendedCommands = useGameStore((state) => state.extendedCommands);

  const controller = useGameStore((state) => state.engineController);

  const newGamePrompt = useGameStore((state) => state.newGamePrompt);

  const gameOver = useGameStore((state) => state.gameOver);
  return {
    adapter,
    setEngineController,
    setPositionRequest,
    setFloatingMessageTiming,
    setNewGamePrompt,
    setGameOver,
    loadingVisible,
    statusText,
    gameMessages,
    floatingMessages,
    playerStats,
    question,
    directionQuestion,
    numberPadModeEnabled,
    infoMenu,
    inventory,
    textInputRequest,
    fpsCrosshairContext,
    repeatActionVisible,
    positionRequest,
    positionInputActive,
    positionInputOrigin,
    connectionState,
    extendedCommands,
    controller,
    newGamePrompt,
    gameOver,
  } as const;
}
