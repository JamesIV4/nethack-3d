/** Overflow glow host and directional scroll state. */
export const overflowGlowClassName = "nh3d-overflow-glow";

export const overflowGlowStartXClassName = "nh3d-overflow-glow-x-start";

export const overflowGlowEndXClassName = "nh3d-overflow-glow-x-end";

export const overflowGlowStartYClassName = "nh3d-overflow-glow-y-start";

export const overflowGlowEndYClassName = "nh3d-overflow-glow-y-end";

export const overflowGlowAxisThresholdPx = 1;

export const overflowGlowTargetSelector = "[data-nh3d-overflow-glow]";

export function resolveOverflowGlowHost(element: HTMLElement): HTMLElement {
  if (
    element.dataset.nh3dOverflowGlowHost === "parent" &&
    element.parentElement instanceof HTMLElement
  ) {
    return element.parentElement;
  }
  return element;
}

export function supportsScrollableOverflowAxis(value: string): boolean {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return (
    normalized === "auto" || normalized === "scroll" || normalized === "overlay"
  );
}

export function clearOverflowGlowState(element: HTMLElement): void {
  const hostElement = resolveOverflowGlowHost(element);
  hostElement.classList.remove(
    overflowGlowClassName,
    overflowGlowStartXClassName,
    overflowGlowEndXClassName,
    overflowGlowStartYClassName,
    overflowGlowEndYClassName,
  );
  hostElement.style.removeProperty("--nh3d-overflow-existing-shadow");
}

export function updateOverflowGlowState(element: HTMLElement): boolean {
  const hostElement = resolveOverflowGlowHost(element);
  const computedStyle = window.getComputedStyle(element);
  const canOverflowX = supportsScrollableOverflowAxis(computedStyle.overflowX);
  const canOverflowY = supportsScrollableOverflowAxis(computedStyle.overflowY);
  const overflowX = Math.max(0, element.scrollWidth - element.clientWidth);
  const overflowY = Math.max(0, element.scrollHeight - element.clientHeight);
  const hasOverflowX = canOverflowX && overflowX > overflowGlowAxisThresholdPx;
  const hasOverflowY = canOverflowY && overflowY > overflowGlowAxisThresholdPx;

  if (!hasOverflowX && !hasOverflowY) {
    clearOverflowGlowState(element);
    return false;
  }

  if (!hostElement.classList.contains(overflowGlowClassName)) {
    const hostStyle = window.getComputedStyle(hostElement);
    const existingShadow =
      hostStyle.boxShadow && hostStyle.boxShadow !== "none"
        ? hostStyle.boxShadow
        : "none";
    hostElement.style.setProperty(
      "--nh3d-overflow-existing-shadow",
      existingShadow,
    );
    hostElement.classList.add(overflowGlowClassName);
  }

  if (hasOverflowX) {
    hostElement.classList.toggle(
      overflowGlowStartXClassName,
      element.scrollLeft > overflowGlowAxisThresholdPx,
    );
    hostElement.classList.toggle(
      overflowGlowEndXClassName,
      element.scrollLeft < overflowX - overflowGlowAxisThresholdPx,
    );
  } else {
    hostElement.classList.remove(
      overflowGlowStartXClassName,
      overflowGlowEndXClassName,
    );
  }

  if (hasOverflowY) {
    hostElement.classList.toggle(
      overflowGlowStartYClassName,
      element.scrollTop > overflowGlowAxisThresholdPx,
    );
    hostElement.classList.toggle(
      overflowGlowEndYClassName,
      element.scrollTop < overflowY - overflowGlowAxisThresholdPx,
    );
  } else {
    hostElement.classList.remove(
      overflowGlowStartYClassName,
      overflowGlowEndYClassName,
    );
  }

  return true;
}
