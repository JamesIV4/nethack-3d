import {
  MobileDismissButton
} from "../../MobileDismissButton";

export interface UseMobileDialogCloseButtonDependencies {
  readonly isMobileViewport: boolean;
}

/** Renders mobile dialog close buttons for the active viewport. */
export function useMobileDialogCloseButton(dependencies: UseMobileDialogCloseButtonDependencies) {
  const {
    isMobileViewport,
  } = dependencies;

  const renderMobileDialogCloseButton = (
    onClick: () => void,
    label = "Close",
  ): JSX.Element | null =>
    isMobileViewport ? (
      <MobileDismissButton
        className="nh3d-mobile-dialog-close"
        label={label}
        onClick={onClick}
      />
    ) : null;
  return {
    renderMobileDialogCloseButton,
  } as const;
}
