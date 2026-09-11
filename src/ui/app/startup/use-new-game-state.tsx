import {
  useRef,
  useState
} from "react";

/** Owns deferred replay-prompt state and its action-button refs. */
export function useNewGameState() {
  const [
    reopenNewGamePromptOnInteraction,
    setReopenNewGamePromptOnInteraction,
  ] = useState(false);

  const [deferredNewGamePromptReason, setDeferredNewGamePromptReason] =
    useState<string | null>(null);

  const newGamePromptYesButtonRef = useRef<HTMLButtonElement | null>(null);

  const newGamePromptNoButtonRef = useRef<HTMLButtonElement | null>(null);

  const startupLikelyOpenSelectElementsRef = useRef<Set<HTMLSelectElement>>(
    new Set(),
  );

  const startupLikelyOpenSelectInitialValueByElementRef = useRef<
    Map<HTMLSelectElement, string>
  >(new Map());
  return {
    reopenNewGamePromptOnInteraction,
    setReopenNewGamePromptOnInteraction,
    deferredNewGamePromptReason,
    setDeferredNewGamePromptReason,
    newGamePromptYesButtonRef,
    newGamePromptNoButtonRef,
    startupLikelyOpenSelectElementsRef,
    startupLikelyOpenSelectInitialValueByElementRef,
  } as const;
}
