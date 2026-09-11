import {
  useEffect,
  useRef,
  useState
} from "react";
import type * as React from "react";
import type { TextInputRequestState, Nethack3DEngineController } from "../../../game/ui-types";

/** Text entry state, reset, focus and submission */
export function useTextInputRef() {
  const textInputRef = useRef<HTMLInputElement | null>(null);
  return {
    textInputRef,
  } as const;
}

/** Text entry state, reset, focus and submission */
export function useTextInputState() {
  const [textInputValue, setTextInputValue] = useState("");
  return {
    textInputValue,
    setTextInputValue,
  } as const;
}

export interface UseTextInputResetDependencies {
  readonly textInputRequest: TextInputRequestState | null;
  readonly setTextInputValue: React.Dispatch<React.SetStateAction<string>>;
  readonly textInputRef: React.MutableRefObject<HTMLInputElement | null>;
}

/** Text entry state, reset, focus and submission */
export function useTextInputReset(dependencies: UseTextInputResetDependencies) {
  const {
    textInputRequest,
    setTextInputValue,
    textInputRef,
  } = dependencies;

  useEffect(() => {
    if (!textInputRequest) {
      return;
    }
    setTextInputValue("");
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        textInputRef.current?.focus();
      }, 0);
    }
  }, [textInputRequest]);

}

export interface UseTextInputSubmitDependencies {
  readonly controller: Nethack3DEngineController | null;
  readonly setTextInputValue: React.Dispatch<React.SetStateAction<string>>;
}

/** Text entry state, reset, focus and submission */
export function useTextInputSubmit(dependencies: UseTextInputSubmitDependencies) {
  const {
    controller,
    setTextInputValue,
  } = dependencies;

  const submitTextInput = (value: string): void => {
    controller?.submitTextInput(value);
    setTextInputValue("");
  };
  return {
    submitTextInput,
  } as const;
}
