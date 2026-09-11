import {
  useState
} from "react";
import type {
  ControllerRemapListeningState
} from "../controller/binding-capture";

/** Owns controller remapping, support prompts and settings reset confirmation. */
export function useControllerSettingsState() {
  const [
    isResetClientOptionsConfirmationVisible,
    setIsResetClientOptionsConfirmationVisible,
  ] = useState(false);

  const [isControllerRemapVisible, setIsControllerRemapVisible] =
    useState(false);

  const [controllerRemapListening, setControllerRemapListening] =
    useState<ControllerRemapListeningState | null>(null);

  const [
    hasAskedControllerSupportThisSession,
    setHasAskedControllerSupportThisSession,
  ] = useState(false);

  const [
    isControllerSupportPromptVisible,
    setIsControllerSupportPromptVisible,
  ] = useState(false);
  return {
    isResetClientOptionsConfirmationVisible,
    setIsResetClientOptionsConfirmationVisible,
    isControllerRemapVisible,
    setIsControllerRemapVisible,
    controllerRemapListening,
    setControllerRemapListening,
    hasAskedControllerSupportThisSession,
    setHasAskedControllerSupportThisSession,
    isControllerSupportPromptVisible,
    setIsControllerSupportPromptVisible,
  } as const;
}
