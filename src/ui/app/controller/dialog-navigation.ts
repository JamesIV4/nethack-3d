/** Controller dialog focus, directional movement, clicking, range input and scrolling. */
export function getTopVisibleControllerDialogElement(): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".nh3d-dialog.is-visible, #position-dialog.is-visible",
    ),
  );
  if (candidates.length === 0) {
    return null;
  }
  let best = candidates[0];
  let bestZIndex =
    Number.parseInt(window.getComputedStyle(best).zIndex, 10) || 0;
  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const zIndex =
      Number.parseInt(window.getComputedStyle(candidate).zIndex, 10) || 0;
    if (zIndex > bestZIndex || (zIndex === bestZIndex && index > 0)) {
      best = candidate;
      bestZIndex = zIndex;
    }
  }
  return best;
}

export function getControllerFocusableElements(root: HTMLElement): HTMLElement[] {
  const selector = [
    "button:not(:disabled)",
    "summary",
    "a[href]",
    "input:not(:disabled):not([tabindex='-1'])",
    "select:not(:disabled)",
    "textarea:not(:disabled)",
    '[role="button"][tabindex]:not([tabindex="-1"])',
    "[tabindex]:not([tabindex='-1'])",
  ].join(", ");
  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
  return elements.filter((element) => {
    if (!element.isConnected) {
      return false;
    }
    let current: HTMLElement | null = element;
    while (current && current !== root) {
      const parentElement: HTMLElement | null = current.parentElement;
      if (parentElement instanceof HTMLDetailsElement && !parentElement.open) {
        const isSummaryOfClosedDetails =
          current.tagName === "SUMMARY" &&
          current.parentElement === parentElement;
        if (!isSummaryOfClosedDetails) {
          return false;
        }
      }
      current = parentElement;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    return element.getClientRects().length > 0;
  });
}

export function isControllerScrollableElement(element: HTMLElement): boolean {
  if (element.scrollHeight <= element.clientHeight + 2) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return (
    style.overflowY === "auto" ||
    style.overflowY === "scroll" ||
    style.overflowY === "overlay"
  );
}

export function findNearestControllerScrollableAncestor(
  element: HTMLElement,
  boundary: HTMLElement,
): HTMLElement | null {
  let current: HTMLElement | null = element;
  while (current && current !== boundary) {
    if (isControllerScrollableElement(current)) {
      return current;
    }
    current = current.parentElement;
  }
  if (isControllerScrollableElement(boundary)) {
    return boundary;
  }
  return null;
}

export function getControllerDialogFixedActionButtons(
  dialogRoot: HTMLElement,
): HTMLElement[] {
  const selector = [
    ".nh3d-menu-actions button:not(:disabled)",
    ".nh3d-pickup-actions button:not(:disabled)",
    ".nh3d-menu-actions [role='button'][tabindex]:not([tabindex='-1'])",
    ".nh3d-pickup-actions [role='button'][tabindex]:not([tabindex='-1'])",
  ].join(", ");
  const candidates = Array.from(
    dialogRoot.querySelectorAll<HTMLElement>(selector),
  );
  return candidates.filter((candidate) => {
    if (!candidate.isConnected) {
      return false;
    }
    const style = window.getComputedStyle(candidate);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    return candidate.getClientRects().length > 0;
  });
}

export function focusControllerDialogElement(target: HTMLElement): void {
  target.focus();
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
}

export function findDirectionalControllerFocusTarget(
  source: HTMLElement,
  candidates: readonly HTMLElement[],
  direction: "left" | "right",
): HTMLElement | null {
  const sourceRect = source.getBoundingClientRect();
  const sourceCenterX = sourceRect.left + sourceRect.width * 0.5;
  const sourceCenterY = sourceRect.top + sourceRect.height * 0.5;
  const minHorizontalDelta = 8;
  let bestTarget: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate === source) {
      continue;
    }
    const rect = candidate.getBoundingClientRect();
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.5;
    const dx = centerX - sourceCenterX;
    if (direction === "right" && dx <= minHorizontalDelta) {
      continue;
    }
    if (direction === "left" && dx >= -minHorizontalDelta) {
      continue;
    }
    const horizontalDistance = Math.abs(dx);
    const verticalDistance = Math.abs(centerY - sourceCenterY);
    const score = horizontalDistance + verticalDistance * 2;
    if (score < bestScore) {
      bestScore = score;
      bestTarget = candidate;
    }
  }

  return bestTarget;
}

export function moveClientOptionsDialogFocus(
  dialogRoot: HTMLElement,
  activeElement: HTMLElement,
  direction: "up" | "down" | "left" | "right",
): boolean {
  if (direction !== "left" && direction !== "right") {
    return false;
  }
  if (dialogRoot.id !== "nh3d-client-options-dialog") {
    return false;
  }

  const nav = dialogRoot.querySelector<HTMLElement>(".nh3d-options-nav");
  const panel = dialogRoot.querySelector<HTMLElement>(".nh3d-options-panel");
  if (!nav || !panel) {
    return false;
  }

  const navTabs = getControllerFocusableElements(nav).filter((element) =>
    element.classList.contains("nh3d-options-tab"),
  );
  const panelFocusable = getControllerFocusableElements(panel).filter(
    (element) =>
      !element.classList.contains("nh3d-mobile-dialog-close") &&
      !element.closest(".nh3d-options-panel-heading"),
  );
  if (navTabs.length === 0 || panelFocusable.length === 0) {
    return false;
  }

  if (direction === "right" && nav.contains(activeElement)) {
    const target =
      findDirectionalControllerFocusTarget(
        activeElement,
        panelFocusable,
        "right",
      ) ?? panelFocusable[0];
    if (!target) {
      return false;
    }
    focusControllerDialogElement(target);
    return true;
  }

  if (direction === "left" && panel.contains(activeElement)) {
    const leftTarget = findDirectionalControllerFocusTarget(
      activeElement,
      panelFocusable,
      "left",
    );
    if (leftTarget) {
      focusControllerDialogElement(leftTarget);
      return true;
    }
    const selectedTab =
      nav.querySelector<HTMLElement>(".nh3d-options-tab.is-selected") ??
      navTabs[0];
    if (!selectedTab) {
      return false;
    }
    focusControllerDialogElement(selectedTab);
    return true;
  }

  return false;
}

export function moveControllerDialogFocus(
  direction: "up" | "down" | "left" | "right",
): boolean {
  const topDialog = getTopVisibleControllerDialogElement();
  if (!topDialog) {
    return false;
  }
  const focusable = getControllerFocusableElements(topDialog);
  if (focusable.length === 0) {
    return false;
  }
  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const activeInDialog =
    activeElement && topDialog.contains(activeElement) ? activeElement : null;
  if (
    activeInDialog &&
    moveClientOptionsDialogFocus(topDialog, activeInDialog, direction)
  ) {
    return true;
  }
  const fixedActionButtons = getControllerDialogFixedActionButtons(topDialog);
  const activeIsFixedAction =
    !!activeInDialog &&
    fixedActionButtons.some((button) => button === activeInDialog);

  if (
    activeIsFixedAction &&
    (direction === "left" || direction === "right") &&
    fixedActionButtons.length > 0
  ) {
    const activeFixedIndex = activeInDialog
      ? fixedActionButtons.findIndex((button) => button === activeInDialog)
      : -1;
    const fixedDelta = direction === "left" ? -1 : 1;
    const targetFixedIndex =
      activeFixedIndex < 0
        ? fixedDelta > 0
          ? 0
          : fixedActionButtons.length - 1
        : (((activeFixedIndex + fixedDelta) % fixedActionButtons.length) +
          fixedActionButtons.length) %
        fixedActionButtons.length;
    const targetFixedButton = fixedActionButtons[targetFixedIndex];
    if (targetFixedButton) {
      focusControllerDialogElement(targetFixedButton);
      return true;
    }
  }

  if (
    (direction === "down" || direction === "right") &&
    activeInDialog &&
    !activeIsFixedAction &&
    fixedActionButtons.length > 0
  ) {
    const nearestScrollable = findNearestControllerScrollableAncestor(
      activeInDialog,
      topDialog,
    );
    const atScrollableEnd =
      !!nearestScrollable &&
      nearestScrollable.scrollTop + nearestScrollable.clientHeight >=
      nearestScrollable.scrollHeight - 2;
    const atLastScrollableFocusable =
      !!nearestScrollable &&
      (() => {
        const scrollableFocusable = getControllerFocusableElements(
          nearestScrollable,
        ).filter(
          (element) => !fixedActionButtons.some((button) => button === element),
        );
        if (scrollableFocusable.length === 0) {
          return false;
        }
        return (
          scrollableFocusable[scrollableFocusable.length - 1] === activeInDialog
        );
      })();
    if (atScrollableEnd && atLastScrollableFocusable) {
      const targetButton = fixedActionButtons[0];
      focusControllerDialogElement(targetButton);
      return true;
    }
  }

  if (direction === "up" && activeIsFixedAction) {
    const topScrollable = findControllerScrollableElement(topDialog);
    if (topScrollable) {
      const scrollableFocusable = getControllerFocusableElements(
        topScrollable,
      ).filter(
        (element) => !fixedActionButtons.some((button) => button === element),
      );
      const fallbackTarget =
        scrollableFocusable[scrollableFocusable.length - 1] ??
        focusable[focusable.length - 1];
      if (fallbackTarget) {
        focusControllerDialogElement(fallbackTarget);
        return true;
      }
    }
  }

  const activeIndex = activeInDialog ? focusable.indexOf(activeInDialog) : -1;
  const delta = direction === "up" || direction === "left" ? -1 : 1;
  let nextIndex: number;
  if (activeIndex < 0) {
    nextIndex = delta > 0 ? 0 : focusable.length - 1;
  } else {
    nextIndex =
      (((activeIndex + delta) % focusable.length) + focusable.length) %
      focusable.length;
  }
  const nextElement = focusable[nextIndex];
  if (nextElement) {
    focusControllerDialogElement(nextElement);
  }
  return true;
}

export function clickFocusedControllerDialogElement(): HTMLElement | null {
  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  if (activeElement && typeof activeElement.click === "function") {
    activeElement.click();
    return activeElement;
  }
  const topDialog = getTopVisibleControllerDialogElement();
  if (!topDialog) {
    return null;
  }
  const focusable = getControllerFocusableElements(topDialog);
  const first = focusable[0];
  if (!first) {
    return null;
  }
  first.focus();
  first.scrollIntoView({ block: "nearest", inline: "nearest" });
  first.click();
  return first;
}

export function clickControllerDialogElementAtPoint(
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const target = document.elementFromPoint(clientX, clientY);
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  const clickableSelector = [
    "button",
    "summary",
    "[role='button']",
    "a",
    "input:not([tabindex='-1'])",
    "select",
    "textarea",
    "label",
    "[tabindex]",
  ].join(", ");
  const clickable = target.closest(clickableSelector) ?? target;
  if (!(clickable instanceof HTMLElement)) {
    return null;
  }
  clickable.focus();
  clickable.scrollIntoView({ block: "nearest", inline: "nearest" });
  clickable.click();
  return clickable;
}

export function getFocusedControllerRangeInput(
  dialogRoot: HTMLElement | null,
): HTMLInputElement | null {
  if (!dialogRoot) {
    return null;
  }
  const activeElement =
    document.activeElement instanceof HTMLInputElement
      ? document.activeElement
      : null;
  if (!activeElement || !dialogRoot.contains(activeElement)) {
    return null;
  }
  if (activeElement.type !== "range" || activeElement.disabled) {
    return null;
  }
  return activeElement;
}

export function stepControllerRangeInput(
  slider: HTMLInputElement,
  stepCount: number,
): boolean {
  if (!Number.isFinite(stepCount) || stepCount === 0 || slider.disabled) {
    return false;
  }
  const minValue = Number.parseFloat(slider.min);
  const maxValue = Number.parseFloat(slider.max);
  const min = Number.isFinite(minValue) ? minValue : 0;
  const max = Number.isFinite(maxValue) ? maxValue : 100;
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const stepValue = Number.parseFloat(slider.step);
  const step = Number.isFinite(stepValue) && stepValue > 0 ? stepValue : 1;
  const currentValue = Number.parseFloat(slider.value);
  const current = Number.isFinite(currentValue) ? currentValue : low;
  const normalizedStepCount =
    stepCount > 0 ? Math.floor(stepCount) : Math.ceil(stepCount);
  if (normalizedStepCount === 0) {
    return false;
  }
  const currentIndex = Math.round((current - low) / step);
  const nextValue = Math.max(
    low,
    Math.min(high, low + (currentIndex + normalizedStepCount) * step),
  );
  if (Math.abs(nextValue - current) < step * 0.001) {
    return false;
  }
  slider.value = String(nextValue);
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  slider.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export function maintainControllerDialogFocusAfterKeyboardScroll(
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
    getControllerFocusableElements(scrollElement);
  if (focusableInScrollElement.length === 0) {
    return;
  }

  const visibleFocusable = focusableInScrollElement.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > scrollRect.top + 2 && rect.top < scrollRect.bottom - 2;
  });
  if (visibleFocusable.length === 0) {
    return;
  }

  const targetElement =
    direction === "down"
      ? visibleFocusable[0]
      : visibleFocusable[visibleFocusable.length - 1];
  if (targetElement && targetElement !== activeElement) {
    focusControllerDialogElement(targetElement);
  }
}

export function handleControllerDialogKeyboardScrollKey(
  dialogRoot: HTMLElement,
  key: string,
): boolean {
  if (
    key !== "Home" &&
    key !== "End" &&
    key !== "PageUp" &&
    key !== "PageDown"
  ) {
    return false;
  }

  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  let scrollElement: HTMLElement | null = null;
  if (activeElement && dialogRoot.contains(activeElement)) {
    scrollElement = findNearestControllerScrollableAncestor(
      activeElement,
      dialogRoot,
    );
  }
  if (!scrollElement) {
    scrollElement = findControllerScrollableElement(dialogRoot);
  }
  if (!scrollElement) {
    return false;
  }

  const direction: "up" | "down" =
    key === "Home" || key === "PageUp" ? "up" : "down";
  if (key === "Home") {
    scrollElement.scrollTop = 0;
  } else if (key === "End") {
    scrollElement.scrollTop = scrollElement.scrollHeight;
  } else {
    const pageDeltaPx = Math.max(
      96,
      Math.round(scrollElement.clientHeight * 0.9),
    );
    const scrollDelta = direction === "down" ? pageDeltaPx : -pageDeltaPx;
    scrollElement.scrollTop += scrollDelta;
  }

  maintainControllerDialogFocusAfterKeyboardScroll(scrollElement, direction);
  return true;
}

export function findControllerScrollableElement(
  root: HTMLElement | null,
): HTMLElement | null {
  if (!root) {
    return null;
  }
  if (isControllerScrollableElement(root)) {
    return root;
  }
  const descendants = Array.from(root.querySelectorAll<HTMLElement>("*"));
  for (const descendant of descendants) {
    if (isControllerScrollableElement(descendant)) {
      return descendant;
    }
  }
  return null;
}
