import type { RuntimeBridge } from "../../../runtime";
import type {
  CharacterCreationConfig,
  Nh3dClientOptions,
  Nethack3DEngineUIAdapter,
  PlayMode
} from "../../ui-types";
import { normalizeNh3dClientOptions } from "../../ui-types";
import type { EngineCoordinator } from "../engine-coordinator";

export interface EngineStateDependencies {
  readonly coordinator: Pick<
    EngineCoordinator,
    "animate"
  >;
}

/** Session configuration and engine lifecycle shared by presentation systems. */
export class EngineState {
  constructor(private readonly dependencies: EngineStateDependencies) {}

  mountElement!: HTMLElement | null;

  uiAdapter!: Nethack3DEngineUIAdapter;

  session: RuntimeBridge | null = null;

  characterCreationConfig: CharacterCreationConfig = {
    mode: "create",
    playMode: "normal",
  };

  clientOptions: Nh3dClientOptions = normalizeNh3dClientOptions();

  playMode: PlayMode = "normal";

  lastFrameTimeMs: number | null = null;

  disposed = false;

  animationFrameId: number | null = null;

  readonly domEventAbortController = new AbortController();

  readonly animateFrameCallback = (timeMs: number): void => {
    this.dependencies.coordinator.animate(timeMs);
  };
}
