
import type { ControllerDialogs } from "../input/controller-dialogs";
import type { DirectionPrompts } from "./direction-prompts";
import type { PromptDialogs } from "./prompt-dialogs";
import type { QuestionMenus } from "./question-menus";

export interface ModalNavigationDependencies {
  readonly controllerDialogs: Pick<
    ControllerDialogs,
    "findControllerScrollableElement"
    | "focusControllerDialogElement"
    | "getControllerFocusableElements"
    | "getTopControllerOverlayElement"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "isAnyModalVisible"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "activePickupFocusIndex"
    | "activeQuestionDefaultChoice"
    | "activeQuestionIsPickupDialog"
    | "activeQuestionMenuFocusIndex"
    | "activeQuestionMenuItems"
    | "clearQuestionActionFocus"
    | "getActiveQuestionActionButtons"
    | "getVisiblePickupSelectableMenuItems"
    | "isInQuestion"
    | "isQuestionActionFocused"
    | "setQuestionActionFocusIndex"
    | "updatePickupFocusVisualState"
    | "updateQuestionMenuFocusVisualState"
  >;
}

/** DOM focus, scroll and keyboard navigation in dialogs. */
export class ModalNavigation {
  constructor(private readonly dependencies: ModalNavigationDependencies) {}

  handleModalPageScrollKeyDown(event: KeyboardEvent): boolean {
    if (event.key !== "PageUp" && event.key !== "PageDown") {
      return false;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    if (!this.dependencies.promptDialogs.isAnyModalVisible()) {
      return false;
    }

    const overlay = this.dependencies.controllerDialogs.getTopControllerOverlayElement();
    if (!overlay) {
      return false;
    }

    const isScrollableElement = (element: HTMLElement): boolean => {
      if (element.scrollHeight <= element.clientHeight + 2) {
        return false;
      }
      const style = window.getComputedStyle(element);
      return (
        style.overflowY === "auto" ||
        style.overflowY === "scroll" ||
        style.overflowY === "overlay"
      );
    };

    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    let scrollElement: HTMLElement | null = null;
    if (activeElement && overlay.contains(activeElement)) {
      let ancestor: HTMLElement | null = activeElement;
      while (ancestor && ancestor !== overlay) {
        if (isScrollableElement(ancestor)) {
          scrollElement = ancestor;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (!scrollElement && isScrollableElement(overlay)) {
        scrollElement = overlay;
      }
    }
    if (!scrollElement) {
      scrollElement = this.dependencies.controllerDialogs.findControllerScrollableElement(overlay);
    }
    if (!scrollElement) {
      return false;
    }

    event.preventDefault();
    const scrollDirection: "up" | "down" =
      event.key === "PageDown" ? "down" : "up";
    const pageDeltaPx = Math.max(
      96,
      Math.round(scrollElement.clientHeight * 0.9),
    );
    const scrollDelta = scrollDirection === "down" ? pageDeltaPx : -pageDeltaPx;
    const previousScrollTop = scrollElement.scrollTop;
    scrollElement.scrollTop += scrollDelta;
    if (Math.abs(scrollElement.scrollTop - previousScrollTop) >= 0.5) {
      this.maintainFocusAfterKeyboardPageScroll(scrollElement, scrollDirection);
    }
    return true;
  }

  maintainFocusAfterKeyboardPageScroll(
    scrollElement: HTMLElement,
    direction: "up" | "down",
  ): void {
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!activeElement || !scrollElement.contains(activeElement)) {
      return;
    }

    const activeRect = activeElement.getBoundingClientRect();
    const scrollRect = scrollElement.getBoundingClientRect();
    const isVisibleInScrollFrame =
      activeRect.bottom > scrollRect.top + 2 &&
      activeRect.top < scrollRect.bottom - 2;
    if (isVisibleInScrollFrame) {
      return;
    }

    const focusableInScrollElement =
      this.dependencies.controllerDialogs.getControllerFocusableElements(scrollElement);
    if (focusableInScrollElement.length === 0) {
      return;
    }

    const visibleFocusable = focusableInScrollElement.filter((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.bottom > scrollRect.top + 2 && rect.top < scrollRect.bottom - 2
      );
    });
    if (visibleFocusable.length === 0) {
      return;
    }

    const targetElement =
      direction === "down"
        ? visibleFocusable[0]
        : visibleFocusable[visibleFocusable.length - 1];
    if (targetElement && targetElement !== activeElement) {
      this.dependencies.controllerDialogs.focusControllerDialogElement(targetElement);
    }
  }

  getModalNavigationDirection(
    event: KeyboardEvent,
  ): "up" | "down" | "left" | "right" | null {
    // Reserve letter keys for NetHack prompt/menu input so vi keys and FPS
    // movement bindings do not hijack menu accelerators while a dialog is open.
    switch (event.key) {
      case "ArrowUp":
        return "up";
      case "ArrowDown":
        return "down";
      case "ArrowLeft":
        return "left";
      case "ArrowRight":
        return "right";
      default:
        break;
    }

    if (!event.code.startsWith("Numpad")) {
      return null;
    }

    switch (event.code) {
      case "Numpad8":
      case "Numpad7":
      case "Numpad9":
        return "up";
      case "Numpad2":
      case "Numpad1":
      case "Numpad3":
        return "down";
      case "Numpad4":
        return "left";
      case "Numpad6":
        return "right";
      default:
        return null;
    }
  }

  getSimpleQuestionChoiceButtons(): HTMLButtonElement[] {
    if (!this.dependencies.questionMenus.isInQuestion || this.dependencies.questionMenus.activeQuestionMenuItems.length > 0) {
      return [];
    }

    const questionDialog = document.querySelector<HTMLElement>(
      "#question-dialog.nh3d-dialog.is-visible",
    );
    if (!questionDialog) {
      return [];
    }

    return Array.from(
      questionDialog.querySelectorAll<HTMLButtonElement>(
        ".nh3d-choice-list .nh3d-choice-button[data-nh3d-choice-value]:not(:disabled)",
      ),
    );
  }

  getSimpleQuestionDefaultChoiceValue(
    choiceButtons: readonly HTMLButtonElement[],
  ): string | null {
    if (choiceButtons.length === 0) {
      return null;
    }
    const rawDefault = String(this.dependencies.questionMenus.activeQuestionDefaultChoice ?? "").trim();
    if (rawDefault.length === 0) {
      return null;
    }

    const candidates: string[] = [rawDefault];
    if (/^-?\d+$/.test(rawDefault) && rawDefault.length > 1) {
      const parsed = Number.parseInt(rawDefault, 10);
      if (Number.isInteger(parsed) && parsed > 0 && parsed <= 0xffff) {
        candidates.unshift(String.fromCharCode(parsed));
      }
    }

    for (const candidate of candidates) {
      const match = choiceButtons.find(
        (button) => button.dataset.nh3dChoiceValue === candidate,
      );
      if (match) {
        return candidate;
      }
    }
    return null;
  }

  getFocusedSimpleQuestionChoiceValue(): string | null {
    const choiceButtons = this.getSimpleQuestionChoiceButtons();
    if (choiceButtons.length === 0) {
      return null;
    }

    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (activeElement) {
      const focusedButton = choiceButtons.find(
        (button) => button === activeElement,
      );
      const focusedValue = focusedButton?.dataset.nh3dChoiceValue;
      if (focusedValue) {
        return focusedValue;
      }
    }

    const defaultChoice =
      this.getSimpleQuestionDefaultChoiceValue(choiceButtons);
    if (defaultChoice) {
      return defaultChoice;
    }
    return choiceButtons[0]?.dataset.nh3dChoiceValue ?? null;
  }

  moveSimpleQuestionChoiceFocus(direction: "left" | "right"): boolean {
    const choiceButtons = this.getSimpleQuestionChoiceButtons();
    if (choiceButtons.length === 0) {
      return false;
    }

    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    let activeIndex = activeElement
      ? choiceButtons.findIndex((button) => button === activeElement)
      : -1;
    if (activeIndex < 0) {
      const defaultChoice =
        this.getSimpleQuestionDefaultChoiceValue(choiceButtons);
      if (defaultChoice) {
        activeIndex = choiceButtons.findIndex(
          (button) => button.dataset.nh3dChoiceValue === defaultChoice,
        );
      }
    }

    let targetIndex = 0;
    if (activeIndex < 0) {
      targetIndex = direction === "left" ? choiceButtons.length - 1 : 0;
    } else {
      const delta = direction === "left" ? -1 : 1;
      targetIndex =
        (((activeIndex + delta) % choiceButtons.length) +
          choiceButtons.length) %
        choiceButtons.length;
    }

    const targetButton = choiceButtons[targetIndex];
    if (!targetButton) {
      return false;
    }
    this.dependencies.controllerDialogs.focusControllerDialogElement(targetButton);
    return true;
  }

  handleQuestionHomeEndKeyDown(event: KeyboardEvent): boolean {
    if (!this.dependencies.questionMenus.isInQuestion || this.dependencies.directionPrompts.isInDirectionQuestion) {
      return false;
    }
    if (event.key !== "Home" && event.key !== "End") {
      return false;
    }

    const focusLast = event.key === "End";
    if (this.dependencies.questionMenus.activeQuestionMenuItems.length === 0) {
      const choiceButtons = this.getSimpleQuestionChoiceButtons();
      const targetButton = focusLast
        ? choiceButtons[choiceButtons.length - 1]
        : choiceButtons[0];
      if (!targetButton) {
        return false;
      }
      event.preventDefault();
      this.dependencies.controllerDialogs.focusControllerDialogElement(targetButton);
      return true;
    }

    const actionButtons = this.dependencies.questionMenus.getActiveQuestionActionButtons();
    if (this.dependencies.questionMenus.isQuestionActionFocused()) {
      if (actionButtons.length === 0) {
        return false;
      }
      event.preventDefault();
      this.dependencies.questionMenus.setQuestionActionFocusIndex(
        focusLast ? actionButtons.length - 1 : 0,
      );
      return true;
    }

    const selectableItems = this.dependencies.questionMenus.getVisiblePickupSelectableMenuItems();
    if (selectableItems.length > 0) {
      event.preventDefault();
      if (this.dependencies.questionMenus.activeQuestionIsPickupDialog) {
        this.dependencies.questionMenus.activePickupFocusIndex = focusLast
          ? selectableItems.length - 1
          : 0;
        this.dependencies.questionMenus.clearQuestionActionFocus();
        this.dependencies.questionMenus.updatePickupFocusVisualState();
      } else {
        this.dependencies.questionMenus.activeQuestionMenuFocusIndex = focusLast
          ? selectableItems.length - 1
          : 0;
        this.dependencies.questionMenus.clearQuestionActionFocus();
        this.dependencies.questionMenus.updateQuestionMenuFocusVisualState();
      }
      return true;
    }

    if (actionButtons.length > 0) {
      event.preventDefault();
      this.dependencies.questionMenus.setQuestionActionFocusIndex(
        focusLast ? actionButtons.length - 1 : 0,
      );
      return true;
    }

    return false;
  }

  isEditableModalKeyboardTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    if (target.isContentEditable) {
      return true;
    }
    if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
      return true;
    }
    if (target.tagName !== "INPUT") {
      return false;
    }
    const inputType = String(
      (target as HTMLInputElement).type || "",
    ).toLowerCase();
    switch (inputType) {
      case "checkbox":
      case "radio":
      case "button":
      case "submit":
      case "reset":
      case "file":
      case "image":
        return false;
      default:
        return true;
    }
  }

  resolveModalFocusedListContainer(
    overlay: HTMLElement,
    activeElement: HTMLElement | null,
  ): HTMLElement | null {
    const listSelector = [
      ".nh3d-choice-list",
      ".nh3d-menu-actions",
      ".nh3d-pickup-actions",
      ".nh3d-context-menu-actions-inventory",
      ".nh3d-context-menu-actions",
      ".nh3d-enhance-skill-grid",
      ".nh3d-mobile-actions-grid",
      ".nh3d-mobile-actions-sections",
      ".nh3d-options-nav",
      ".nh3d-options-panel",
      ".nh3d-controller-action-wheel-extended",
    ].join(", ");

    if (activeElement && overlay.contains(activeElement)) {
      const directListContainer =
        activeElement.closest<HTMLElement>(listSelector);
      if (
        directListContainer instanceof HTMLElement &&
        overlay.contains(directListContainer)
      ) {
        return directListContainer;
      }

      let ancestor: HTMLElement | null = activeElement.parentElement;
      while (ancestor && ancestor !== overlay) {
        const focusableInAncestor =
          this.dependencies.controllerDialogs.getControllerFocusableElements(ancestor);
        if (
          focusableInAncestor.length > 1 &&
          focusableInAncestor.some((element) => element === activeElement)
        ) {
          return ancestor;
        }
        ancestor = ancestor.parentElement;
      }
    }

    const listContainers = Array.from(
      overlay.querySelectorAll<HTMLElement>(listSelector),
    );
    for (const listContainer of listContainers) {
      if (this.dependencies.controllerDialogs.getControllerFocusableElements(listContainer).length > 0) {
        return listContainer;
      }
    }

    return this.dependencies.controllerDialogs.getControllerFocusableElements(overlay).length > 0
      ? overlay
      : null;
  }

  handleModalHomeEndFocusKeyDown(event: KeyboardEvent): boolean {
    if (event.key !== "Home" && event.key !== "End") {
      return false;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    if (this.handleQuestionHomeEndKeyDown(event)) {
      return true;
    }

    const overlay = this.dependencies.controllerDialogs.getTopControllerOverlayElement();
    if (!overlay) {
      return false;
    }

    if (this.isEditableModalKeyboardTarget(event.target)) {
      return false;
    }

    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const listContainer = this.resolveModalFocusedListContainer(
      overlay,
      activeElement,
    );
    if (!listContainer) {
      return false;
    }

    const focusableElements =
      this.dependencies.controllerDialogs.getControllerFocusableElements(listContainer);
    if (focusableElements.length === 0) {
      return false;
    }

    const targetElement =
      event.key === "End"
        ? focusableElements[focusableElements.length - 1]
        : focusableElements[0];
    if (!targetElement) {
      return false;
    }

    event.preventDefault();
    this.dependencies.controllerDialogs.focusControllerDialogElement(targetElement);
    return true;
  }
}
