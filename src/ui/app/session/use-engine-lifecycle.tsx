import {
  useEffect, useRef
} from "react";
import {
  Nethack3DEngine
} from "../../../game";
import type { CharacterCreationConfig, Nh3dClientOptions, Nethack3DEngineUIAdapter, Nethack3DEngineController } from "../../../game/ui-types";
import {
  registerDebugHelpers
} from "../../../app";
import type * as React from "react";
import { isWebXrHost } from "../../../quest/webxr/host";

export interface UseEngineLifecycleDependencies {
  readonly canvasRootRef: React.MutableRefObject<HTMLDivElement | null>;
  readonly characterCreationConfig: CharacterCreationConfig | null;
  readonly adapter: Nethack3DEngineUIAdapter;
  readonly clientOptions: Nh3dClientOptions;
  readonly setEngineController: (controller: Nethack3DEngineController | null) => void;
}

/** The XR front end and game share a renderer and immersive session. */
export function useEngineLifecycle(dependencies: UseEngineLifecycleDependencies) {
  const {
    canvasRootRef,
    characterCreationConfig,
    adapter,
    clientOptions,
    setEngineController,
  } = dependencies;

  const live = useRef<{ engine: Nethack3DEngine; config: CharacterCreationConfig | null } | null>(null);
  useEffect(() => () => {
    live.current?.engine.dispose();
    live.current = null;
    setEngineController(null);
  }, [adapter, setEngineController]);

  useEffect(() => {
    if (!canvasRootRef.current) return;
    if (live.current?.config === characterCreationConfig) return;
    if (live.current && !characterCreationConfig && isWebXrHost()) {
      live.current.engine.returnToStartupMenu();
      live.current.config = null;
      setEngineController(null);
      return;
    }
    if (live.current && !live.current.config && characterCreationConfig) {
      live.current.engine.startGame(characterCreationConfig, clientOptions);
      live.current.config = characterCreationConfig;
      setEngineController(live.current.engine);
      return;
    }
    live.current?.engine.dispose();
    live.current = null;
    setEngineController(null);
    if (!characterCreationConfig && !isWebXrHost()) return;
    const engine = new Nethack3DEngine({
      mountElement: canvasRootRef.current,
      uiAdapter: adapter,
      characterCreationConfig: characterCreationConfig ?? undefined,
      startupOnly: !characterCreationConfig,
      clientOptions,
    });
    live.current = { engine, config: characterCreationConfig };
    if (characterCreationConfig) setEngineController(engine);
    registerDebugHelpers(engine);
  }, [adapter, characterCreationConfig, setEngineController]);

}
