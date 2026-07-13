import { useCallback, useEffect, useRef, useState } from "react";
import { getTranslationStrings } from "../../i18n/core";

export type ConfirmationDialogChoice = "confirm" | "cancel" | "extra";

export type ConfirmationDialogRequest = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmClassName?: string;
  /**
   * Optional third action. When a non-empty label is provided the dialog
   * renders an additional button that resolves the request with "extra".
   */
  extraLabel?: string;
  extraClassName?: string;
};

export type ConfirmationDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmClassName: string;
  extraLabel: string;
  extraClassName: string;
};

export function useConfirmationDialog() {
  const commonStrings = getTranslationStrings().common;
  const [dialog, setDialog] = useState<ConfirmationDialogState | null>(null);
  const resolveRef = useRef<((choice: ConfirmationDialogChoice) => void) | null>(
    null,
  );

  const resolveConfirmation = useCallback(
    (choice: ConfirmationDialogChoice): void => {
      setDialog(null);
      const resolve = resolveRef.current;
      resolveRef.current = null;
      resolve?.(choice);
    },
    [],
  );

  const requestConfirmationChoice = useCallback(
    (request: ConfirmationDialogRequest): Promise<ConfirmationDialogChoice> => {
      const normalized: ConfirmationDialogState = {
        title: String(request.title || "").trim(),
        message: String(request.message || "").trim(),
        confirmLabel:
          String(request.confirmLabel || commonStrings.confirm).trim() ||
          commonStrings.confirm,
        cancelLabel:
          String(request.cancelLabel || commonStrings.cancel).trim() ||
          commonStrings.cancel,
        confirmClassName:
          String(request.confirmClassName || "nh3d-menu-action-confirm").trim() ||
          "nh3d-menu-action-confirm",
        extraLabel: String(request.extraLabel || "").trim(),
        extraClassName:
          String(request.extraClassName || "nh3d-menu-action-confirm").trim() ||
          "nh3d-menu-action-confirm",
      };
      if (!normalized.message) {
        return Promise.resolve("cancel");
      }
      if (resolveRef.current) {
        resolveRef.current("cancel");
      }
      return new Promise<ConfirmationDialogChoice>((resolve) => {
        resolveRef.current = resolve;
        setDialog(normalized);
      });
    },
    [commonStrings.cancel, commonStrings.confirm],
  );

  const requestConfirmation = useCallback(
    (request: ConfirmationDialogRequest): Promise<boolean> =>
      requestConfirmationChoice(request).then((choice) => choice === "confirm"),
    [requestConfirmationChoice],
  );

  useEffect(() => {
    return () => {
      const resolve = resolveRef.current;
      resolveRef.current = null;
      resolve?.("cancel");
    };
  }, []);

  return {
    dialog,
    requestConfirmation,
    requestConfirmationChoice,
    resolveConfirmation,
  };
}
