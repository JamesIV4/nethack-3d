import {
  useCallback,
  useEffect
} from "react";
import type {
  Nh3dClientOptions
} from "../../../game/ui-types";
import {
  defaultNh3dControllerBindings,
  normalizeNh3dControllerBindings,
  type Nh3dControllerActionId,
  type Nh3dControllerBinding
} from "../../../game/controller-bindings";
import type * as React from "react";
import type {
  ControllerRemapListeningState,
  ControllerRemapSlotIndex
} from "../controller/binding-capture";
import {
  controllerCaptureIgnoreDurationMs,
  sampleActiveControllerBindingCandidates
} from "../controller/binding-capture";

export interface UseControllerRemappingDependencies {
  readonly setControllerRemapListening: React.Dispatch<React.SetStateAction<ControllerRemapListeningState | null>>;
  readonly setIsControllerRemapVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setClientOptionsDraft: React.Dispatch<React.SetStateAction<Nh3dClientOptions>>;
  readonly controllerRemapListening: ControllerRemapListeningState | null;
  readonly loadingOverlayVisible: boolean;
}

/** Edits controller bindings and captures gamepad input for remapping. */
export function useControllerRemapping(dependencies: UseControllerRemappingDependencies) {
  const {
    setControllerRemapListening,
    setIsControllerRemapVisible,
    setClientOptionsDraft,
    controllerRemapListening,
    loadingOverlayVisible,
  } = dependencies;

  const closeControllerRemapDialog = useCallback((): void => {
    setControllerRemapListening(null);
    setIsControllerRemapVisible(false);
  }, []);

  const openControllerRemapDialog = useCallback((): void => {
    setControllerRemapListening(null);
    setIsControllerRemapVisible(true);
  }, []);

  const setControllerBindingSlotDraft = useCallback(
    (
      actionId: Nh3dControllerActionId,
      slotIndex: ControllerRemapSlotIndex,
      nextBinding: Nh3dControllerBinding | null,
    ): void => {
      setClientOptionsDraft((previous) => {
        const nextBindings = normalizeNh3dControllerBindings({
          ...previous.controllerBindings,
        });
        const currentSlots = nextBindings[actionId] ?? [null, null];
        const updatedSlots: [
          Nh3dControllerBinding | null,
          Nh3dControllerBinding | null,
        ] = [currentSlots[0] ?? null, currentSlots[1] ?? null];
        updatedSlots[slotIndex] = nextBinding;
        nextBindings[actionId] = updatedSlots;
        return {
          ...previous,
          controllerBindings: normalizeNh3dControllerBindings(nextBindings),
        };
      });
    },
    [],
  );

  const resetControllerBindingsToDefaultsDraft = useCallback((): void => {
    setClientOptionsDraft((previous) => ({
      ...previous,
      controllerBindings: normalizeNh3dControllerBindings(
        defaultNh3dControllerBindings,
      ),
    }));
    setControllerRemapListening(null);
  }, []);

  const beginControllerBindingCapture = useCallback(
    (
      actionId: Nh3dControllerActionId,
      slotIndex: ControllerRemapSlotIndex,
    ): void => {
      const blockedBindings = sampleActiveControllerBindingCandidates();
      setControllerRemapListening({
        actionId,
        slotIndex,
        startedAtMs: performance.now(),
        blockedBindings,
      });
    },
    [],
  );

  const clearControllerBindingCapture = useCallback((): void => {
    setControllerRemapListening(null);
  }, []);

  useEffect(() => {
    if (!controllerRemapListening || loadingOverlayVisible) {
      return;
    }

    let frameHandle = 0;
    const scan = (): void => {
      const elapsedMs =
        performance.now() - controllerRemapListening.startedAtMs;
      const candidates = sampleActiveControllerBindingCandidates();
      const blockedSet = new Set(controllerRemapListening.blockedBindings);
      const capturedBinding =
        elapsedMs >= controllerCaptureIgnoreDurationMs
          ? (candidates.find((binding) => !blockedSet.has(binding)) ?? null)
          : null;
      if (capturedBinding) {
        setControllerBindingSlotDraft(
          controllerRemapListening.actionId,
          controllerRemapListening.slotIndex,
          capturedBinding,
        );
        setControllerRemapListening(null);
        return;
      }
      frameHandle = window.requestAnimationFrame(scan);
    };

    frameHandle = window.requestAnimationFrame(scan);
    return () => {
      window.cancelAnimationFrame(frameHandle);
    };
  }, [
    controllerRemapListening,
    loadingOverlayVisible,
    setControllerBindingSlotDraft,
  ]);
  return {
    closeControllerRemapDialog,
    openControllerRemapDialog,
    setControllerBindingSlotDraft,
    resetControllerBindingsToDefaultsDraft,
    beginControllerBindingCapture,
    clearControllerBindingCapture,
  } as const;
}
