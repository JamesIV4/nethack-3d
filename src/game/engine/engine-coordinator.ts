import type { RuntimeEvent } from "../../runtime";
import type { Nh3dClientOptions, PlayMode } from "../ui-types";

/** Ordered lifecycle operations supplied by the engine, without exposing engine internals. */
export interface EngineCoordinator {
  initThreeJS(): void;
  initUI(): void;
  connectToRuntime(): Promise<void>;
  handleRuntimeEvent(event: RuntimeEvent): void;
  animate(timeMs?: number ): void;
  dispose(): void;
  applyClientOptions(nextOptions: Nh3dClientOptions): void;
  applyPlayMode(nextPlayMode: PlayMode): void;
  clearScene(): void;
  setClientOptions(options: Nh3dClientOptions): void;
}
