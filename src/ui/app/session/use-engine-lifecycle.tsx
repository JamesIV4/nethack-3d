import {
  useEffect
} from "react";
import {
  Nethack3DEngine
} from "../../../game";
import type { CharacterCreationConfig, Nh3dClientOptions, Nethack3DEngineUIAdapter, Nethack3DEngineController } from "../../../game/ui-types";
import {
  registerDebugHelpers
} from "../../../app";
import type * as React from "react";

export interface UseEngineLifecycleDependencies {
  readonly canvasRootRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly characterCreationConfig: CharacterCreationConfig | null;
  readonly adapter: Nethack3DEngineUIAdapter;
  readonly clientOptions: Nh3dClientOptions;
  readonly setEngineController: (controller: Nethack3DEngineController | null) => void;
}

/** Creates and disposes the engine for the active character configuration. */
export function useEngineLifecycle(dependencies: UseEngineLifecycleDependencies) {
  const {
    canvasRootRef,
    characterCreationConfig,
    adapter,
    clientOptions,
    setEngineController,
  } = dependencies;

  useEffect(() => {
    if (!canvasRootRef.current || !characterCreationConfig) {
      return;
    }
    const engine = new Nethack3DEngine({
      mountElement: canvasRootRef.current,
      uiAdapter: adapter,
      characterCreationConfig,
      clientOptions,
    });
    setEngineController(engine);
    registerDebugHelpers(engine);
    return () => {
      engine.dispose();
      setEngineController(null);
    };
  }, [adapter, characterCreationConfig, setEngineController]);

}
