import * as THREE from "three";
import { nh3dCloseInventoryContextMenuEventName } from "../../ui-types";
import type { ControllerActionSnapshot } from "../shared/types";
import type { ControllerGameplay } from "./controller-gameplay";
import type { DirectionPrompts } from "../ui/direction-prompts";
import type { PositionSelection } from "./position-selection";
import type { PromptDialogs } from "../ui/prompt-dialogs";
import type { QuestionMenus } from "../ui/question-menus";
import type { TileContextActions } from "../ui/tile-context-actions";

export interface ControllerDialogsDependencies {
  readonly controllerGameplay: Pick<
    ControllerGameplay,
    "armControllerFpsDirectionPromptUi"
    | "clearControllerDirectionPromptPreview"
    | "clearControllerMovePreview"
    | "consumeControllerCancelUntilRelease"
    | "consumeControllerConfirmUntilRelease"
    | "controllerAxisDeadzone"
    | "controllerFpsLeftStickLastMoveInput"
    | "controllerFpsLeftStickNextMoveAtMs"
    | "dispatchControllerActionWheelCloseRequest"
    | "dispatchControllerKeyDown"
    | "getControllerActionWheelOverlayElement"
    | "handleControllerDirectionQuestionInput"
    | "highlightControllerActionWheelFromSticks"
  >;
  readonly directionPrompts: Pick<
    DirectionPrompts,
    "isInDirectionQuestion"
  >;
  readonly positionSelection: Pick<
    PositionSelection,
    "positionInputModeActive"
  >;
  readonly promptDialogs: Pick<
    PromptDialogs,
    "isInventoryDialogOpen"
  >;
  readonly questionMenus: Pick<
    QuestionMenus,
    "isInQuestion"
  >;
  readonly tileContextActions: Pick<
    TileContextActions,
    "closeAnyTileContextMenu"
    | "fpsCrosshairContextMenuOpen"
    | "normalTileContextMenuOpen"
  >;
}

/** Controller dialog focus, sliders, scrolling, D-pad repeat and virtual cursor ownership. */
export class ControllerDialogs {
  constructor(private readonly dependencies: ControllerDialogsDependencies) {}

  controllerDialogDpadRepeatDirection:
    | "up"
    | "down"
    | "left"
    | "right"
    | null = null;

  controllerDialogDpadRepeatNextAtMs: number = 0;

  readonly controllerDialogDpadRepeatStartDelayMs: number = 260;

  readonly controllerDialogDpadRepeatIntervalMs: number = 95;

  controllerDialogSliderInteractionActive: boolean = false;

  controllerDialogSliderStepCarry: number = 0;

  controllerDialogActiveSliderElement: HTMLInputElement | null = null;

  controllerVirtualCursorElement: HTMLDivElement | null = null;

  controllerVirtualCursorPulseElement: HTMLDivElement | null = null;

  controllerVirtualCursorPulseHideTimerId: number | null = null;

  controllerVirtualCursorVisible: boolean = false;

  controllerVirtualCursorX: number = Number.NaN;

  controllerVirtualCursorY: number = Number.NaN;

  readonly controllerDialogCursorDeadzone: number = 0.21;

  readonly controllerDialogScrollPxPerSec: number = 1200;

  readonly controllerDialogCursorPxPerSec: number = 820;

  readonly controllerDialogSliderFastStepsPerSec: number = 13;

  ensureControllerVirtualCursorOverlay(): void {
    if (
      this.controllerVirtualCursorElement &&
      this.controllerVirtualCursorPulseElement
    ) {
      return;
    }

    const cursor = document.createElement("div");
    cursor.className = "nh3d-controller-virtual-cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.style.display = "none";

    const pulse = document.createElement("div");
    pulse.className = "nh3d-controller-virtual-cursor-pulse";
    pulse.setAttribute("aria-hidden", "true");
    pulse.style.display = "none";

    document.body.appendChild(cursor);
    document.body.appendChild(pulse);

    this.controllerVirtualCursorElement = cursor;
    this.controllerVirtualCursorPulseElement = pulse;
  }

  setControllerVirtualCursorVisible(visible: boolean): void {
    this.ensureControllerVirtualCursorOverlay();
    this.controllerVirtualCursorVisible = visible;
    const cursor = this.controllerVirtualCursorElement;
    if (!cursor) {
      return;
    }
    cursor.style.display = visible ? "block" : "none";
  }

  setControllerVirtualCursorPosition(
    clientX: number,
    clientY: number,
  ): void {
    this.ensureControllerVirtualCursorOverlay();
    const clampedX = THREE.MathUtils.clamp(clientX, 0, window.innerWidth);
    const clampedY = THREE.MathUtils.clamp(clientY, 0, window.innerHeight);
    this.controllerVirtualCursorX = clampedX;
    this.controllerVirtualCursorY = clampedY;
    if (!this.controllerVirtualCursorElement) {
      return;
    }
    this.controllerVirtualCursorElement.style.left = `${Math.round(clampedX)}px`;
    this.controllerVirtualCursorElement.style.top = `${Math.round(clampedY)}px`;
  }

  ensureControllerVirtualCursorSeedPosition(): void {
    if (
      Number.isFinite(this.controllerVirtualCursorX) &&
      Number.isFinite(this.controllerVirtualCursorY)
    ) {
      return;
    }
    const overlay = this.getTopControllerOverlayElement();
    if (overlay) {
      const rect = overlay.getBoundingClientRect();
      this.setControllerVirtualCursorPosition(
        rect.left + rect.width * 0.5,
        rect.top + rect.height * 0.5,
      );
      return;
    }
    this.setControllerVirtualCursorPosition(
      window.innerWidth * 0.5,
      window.innerHeight * 0.5,
    );
  }

  pulseControllerVirtualCursor(): void {
    if (
      !Number.isFinite(this.controllerVirtualCursorX) ||
      !Number.isFinite(this.controllerVirtualCursorY)
    ) {
      return;
    }
    this.ensureControllerVirtualCursorOverlay();
    const pulse = this.controllerVirtualCursorPulseElement;
    if (!pulse) {
      return;
    }
    pulse.style.left = `${Math.round(this.controllerVirtualCursorX)}px`;
    pulse.style.top = `${Math.round(this.controllerVirtualCursorY)}px`;
    pulse.style.display = "block";
    pulse.classList.remove("is-active");
    void pulse.offsetWidth;
    pulse.classList.add("is-active");
    if (this.controllerVirtualCursorPulseHideTimerId !== null) {
      window.clearTimeout(this.controllerVirtualCursorPulseHideTimerId);
      this.controllerVirtualCursorPulseHideTimerId = null;
    }
    this.controllerVirtualCursorPulseHideTimerId = window.setTimeout(() => {
      pulse.classList.remove("is-active");
      pulse.style.display = "none";
      this.controllerVirtualCursorPulseHideTimerId = null;
    }, 260);
  }

  resetControllerVirtualCursor(): void {
    this.controllerVirtualCursorVisible = false;
    if (this.controllerVirtualCursorElement) {
      this.controllerVirtualCursorElement.style.display = "none";
    }
    if (this.controllerVirtualCursorPulseHideTimerId !== null) {
      window.clearTimeout(this.controllerVirtualCursorPulseHideTimerId);
      this.controllerVirtualCursorPulseHideTimerId = null;
    }
    if (this.controllerVirtualCursorPulseElement) {
      this.controllerVirtualCursorPulseElement.classList.remove("is-active");
      this.controllerVirtualCursorPulseElement.style.display = "none";
    }
  }

  isInventoryContextMenuOpen(): boolean {
    if (typeof document === "undefined") {
      return false;
    }
    return document.querySelector(".nh3d-inventory-context-menu") !== null;
  }

  requestCloseInventoryContextMenu(): void {
    if (typeof window === "undefined") {
      return;
    }
    const event = new CustomEvent(nh3dCloseInventoryContextMenuEventName, {
      bubbles: true,
      cancelable: false,
    });
    window.dispatchEvent(event);
  }

  clearControllerDialogSliderInteraction(): void {
    this.controllerDialogSliderInteractionActive = false;
    this.controllerDialogSliderStepCarry = 0;
    this.clearControllerDialogSliderVisual();
  }

  clearControllerDialogSliderVisual(): void {
    const previousSlider = this.controllerDialogActiveSliderElement;
    if (previousSlider && previousSlider.isConnected) {
      previousSlider.classList.remove("nh3d-controller-slider-active");
    }
    this.controllerDialogActiveSliderElement = null;
  }

  setControllerDialogSliderVisual(
    slider: HTMLInputElement | null,
  ): void {
    const previousSlider = this.controllerDialogActiveSliderElement;
    if (
      previousSlider &&
      previousSlider !== slider &&
      previousSlider.isConnected
    ) {
      previousSlider.classList.remove("nh3d-controller-slider-active");
    }
    this.controllerDialogActiveSliderElement = slider;
    if (slider && slider.isConnected) {
      slider.classList.add("nh3d-controller-slider-active");
    }
  }

  getFocusedControllerDialogSlider(
    overlay: HTMLElement | null,
  ): HTMLInputElement | null {
    if (!overlay) {
      return null;
    }
    const activeElement =
      document.activeElement instanceof HTMLInputElement
        ? document.activeElement
        : null;
    if (!activeElement || !overlay.contains(activeElement)) {
      return null;
    }
    if (activeElement.type !== "range" || activeElement.disabled) {
      return null;
    }
    return activeElement;
  }

  stepControllerDialogSliderInput(
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
    const nextValue = THREE.MathUtils.clamp(
      low + (currentIndex + normalizedStepCount) * step,
      low,
      high,
    );
    if (Math.abs(nextValue - current) < step * 0.001) {
      return false;
    }
    slider.value = String(nextValue);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  handleControllerDialogSliderInput(
    snapshot: ControllerActionSnapshot,
    deltaSeconds: number,
  ): boolean {
    const overlay = this.getTopControllerOverlayElement();
    const focusedSlider = this.getFocusedControllerDialogSlider(overlay);
    if (!focusedSlider) {
      this.clearControllerDialogSliderInteraction();
      return false;
    }

    if (!this.controllerDialogSliderInteractionActive) {
      if (snapshot.pressed.confirm) {
        this.controllerDialogSliderInteractionActive = true;
        this.controllerDialogSliderStepCarry = 0;
        this.setControllerDialogSliderVisual(focusedSlider);
        this.setControllerVirtualCursorVisible(false);
        return true;
      }
      return false;
    }

    this.setControllerDialogSliderVisual(focusedSlider);

    if (snapshot.pressed.cancel_or_context) {
      this.clearControllerDialogSliderInteraction();
      return true;
    }

    const dpadStepDirection = snapshot.pressed.dpad_right
      ? 1
      : snapshot.pressed.dpad_left
        ? -1
        : 0;
    if (dpadStepDirection !== 0) {
      this.stepControllerDialogSliderInput(focusedSlider, dpadStepDirection);
    }

    const sliderAxisX =
      snapshot.values.left_stick_right - snapshot.values.left_stick_left;
    if (Math.abs(sliderAxisX) > this.dependencies.controllerGameplay.controllerAxisDeadzone) {
      const nextCarry =
        this.controllerDialogSliderStepCarry +
        sliderAxisX * this.controllerDialogSliderFastStepsPerSec * deltaSeconds;
      const fastStepCount =
        nextCarry > 0 ? Math.floor(nextCarry) : Math.ceil(nextCarry);
      this.controllerDialogSliderStepCarry = nextCarry - fastStepCount;
      if (fastStepCount !== 0) {
        this.stepControllerDialogSliderInput(focusedSlider, fastStepCount);
      }
    } else {
      this.controllerDialogSliderStepCarry = 0;
    }

    return true;
  }

  clearControllerDialogDpadRepeat(): void {
    this.controllerDialogDpadRepeatDirection = null;
    this.controllerDialogDpadRepeatNextAtMs = 0;
  }

  getPressedControllerDpadDirection(
    snapshot: ControllerActionSnapshot,
  ): "up" | "down" | "left" | "right" | null {
    if (snapshot.pressed.dpad_up) {
      return "up";
    }
    if (snapshot.pressed.dpad_down) {
      return "down";
    }
    if (snapshot.pressed.dpad_left) {
      return "left";
    }
    if (snapshot.pressed.dpad_right) {
      return "right";
    }
    return null;
  }

  getActiveControllerDpadDirection(
    snapshot: ControllerActionSnapshot,
  ): "up" | "down" | "left" | "right" | null {
    if (snapshot.active.dpad_up) {
      return "up";
    }
    if (snapshot.active.dpad_down) {
      return "down";
    }
    if (snapshot.active.dpad_left) {
      return "left";
    }
    if (snapshot.active.dpad_right) {
      return "right";
    }
    return null;
  }

  getControllerDialogDpadDirectionWithRepeat(
    snapshot: ControllerActionSnapshot,
  ): "up" | "down" | "left" | "right" | null {
    const nowMs = Date.now();
    const pressedDirection = this.getPressedControllerDpadDirection(snapshot);
    if (pressedDirection) {
      this.controllerDialogDpadRepeatDirection = pressedDirection;
      this.controllerDialogDpadRepeatNextAtMs =
        nowMs + this.controllerDialogDpadRepeatStartDelayMs;
      return pressedDirection;
    }

    const activeDirection = this.getActiveControllerDpadDirection(snapshot);
    if (!activeDirection) {
      this.clearControllerDialogDpadRepeat();
      return null;
    }

    if (this.controllerDialogDpadRepeatDirection !== activeDirection) {
      this.controllerDialogDpadRepeatDirection = activeDirection;
      this.controllerDialogDpadRepeatNextAtMs =
        nowMs + this.controllerDialogDpadRepeatStartDelayMs;
      return activeDirection;
    }

    if (nowMs < this.controllerDialogDpadRepeatNextAtMs) {
      return null;
    }
    this.controllerDialogDpadRepeatNextAtMs =
      nowMs + this.controllerDialogDpadRepeatIntervalMs;
    return activeDirection;
  }

  getTopControllerOverlayElement(): HTMLElement | null {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".nh3d-dialog.is-visible, #position-dialog.is-visible, .nh3d-context-menu.is-visible, .nh3d-fps-crosshair-context.is-visible, .nh3d-mobile-actions-sheet",
      ),
    );
    if (candidates.length === 0) {
      return null;
    }
    let bestElement = candidates[0];
    let bestZIndex =
      Number.parseInt(window.getComputedStyle(bestElement).zIndex, 10) || 0;
    let bestOrder = 0;
    for (let index = 1; index < candidates.length; index += 1) {
      const element = candidates[index];
      const zIndex =
        Number.parseInt(window.getComputedStyle(element).zIndex, 10) || 0;
      if (zIndex > bestZIndex || (zIndex === bestZIndex && index > bestOrder)) {
        bestElement = element;
        bestZIndex = zIndex;
        bestOrder = index;
      }
    }
    return bestElement;
  }

  getControllerFocusableElements(root: HTMLElement): HTMLElement[] {
    const selector = [
      "button:not(:disabled)",
      "summary",
      "a[href]",
      "input:not(:disabled)",
      "select:not(:disabled)",
      "textarea:not(:disabled)",
      '[role="button"][tabindex]:not([tabindex="-1"])',
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector));
    return nodes.filter((node) => {
      if (!node.isConnected) {
        return false;
      }
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      return node.getClientRects().length > 0;
    });
  }

  getControllerGridNavigationContainer(
    overlay: HTMLElement,
    focusable: HTMLElement[],
    activeElement: HTMLElement | null,
  ): HTMLElement | null {
    const selector =
      ".nh3d-context-menu-actions-inventory, .nh3d-context-menu-actions, .nh3d-controller-action-wheel-extended";
    if (activeElement && overlay.contains(activeElement)) {
      const activeContainer = activeElement.closest(selector);
      if (
        activeContainer instanceof HTMLElement &&
        overlay.contains(activeContainer)
      ) {
        return activeContainer;
      }
    }
    for (const element of focusable) {
      const container = element.closest(selector);
      if (container instanceof HTMLElement && overlay.contains(container)) {
        return container;
      }
    }
    return null;
  }

  buildControllerFocusableRows(elements: HTMLElement[]): Array<{
    centerY: number;
    items: Array<{ element: HTMLElement; centerX: number; centerY: number }>;
  }> {
    const measuredElements = elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
        };
      })
      .sort((first, second) =>
        first.centerY === second.centerY
          ? first.centerX - second.centerX
          : first.centerY - second.centerY,
      );
    const rows: Array<{
      centerY: number;
      items: Array<{ element: HTMLElement; centerX: number; centerY: number }>;
    }> = [];
    const rowTolerancePx = 12;
    for (const measured of measuredElements) {
      const lastRow = rows[rows.length - 1];
      if (
        lastRow &&
        Math.abs(measured.centerY - lastRow.centerY) <= rowTolerancePx
      ) {
        lastRow.items.push(measured);
        const rowSize = lastRow.items.length;
        lastRow.centerY =
          (lastRow.centerY * (rowSize - 1) + measured.centerY) / rowSize;
      } else {
        rows.push({
          centerY: measured.centerY,
          items: [measured],
        });
      }
    }
    for (const row of rows) {
      row.items.sort((first, second) => first.centerX - second.centerX);
    }
    return rows;
  }

  resolveControllerGridFocusTarget(
    overlay: HTMLElement,
    focusable: HTMLElement[],
    activeElement: HTMLElement | null,
    direction: "up" | "down" | "left" | "right",
  ): HTMLElement | null {
    const gridContainer = this.getControllerGridNavigationContainer(
      overlay,
      focusable,
      activeElement,
    );
    if (!gridContainer) {
      return null;
    }
    const gridFocusable = focusable.filter((element) =>
      gridContainer.contains(element),
    );
    if (gridFocusable.length < 2) {
      return null;
    }
    const rows = this.buildControllerFocusableRows(gridFocusable);
    const hasMultipleColumns = rows.some((row) => row.items.length > 1);
    if (!hasMultipleColumns || rows.length === 0) {
      return null;
    }

    let activeRowIndex = -1;
    let activeColumnIndex = -1;
    let activeCenterX = Number.NaN;
    if (activeElement && gridContainer.contains(activeElement)) {
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const columnIndex = rows[rowIndex].items.findIndex(
          (item) => item.element === activeElement,
        );
        if (columnIndex >= 0) {
          activeRowIndex = rowIndex;
          activeColumnIndex = columnIndex;
          activeCenterX = rows[rowIndex].items[columnIndex].centerX;
          break;
        }
      }
    }

    if (activeRowIndex < 0 || activeColumnIndex < 0) {
      if (direction === "up" || direction === "left") {
        const lastRow = rows[rows.length - 1];
        return lastRow.items[lastRow.items.length - 1]?.element ?? null;
      }
      return rows[0].items[0]?.element ?? null;
    }

    if (direction === "right") {
      const currentRow = rows[activeRowIndex];
      if (activeColumnIndex < currentRow.items.length - 1) {
        return currentRow.items[activeColumnIndex + 1]?.element ?? null;
      }
      if (activeRowIndex < rows.length - 1) {
        return rows[activeRowIndex + 1].items[0]?.element ?? null;
      }
      return rows[0].items[0]?.element ?? null;
    }

    if (direction === "left") {
      const currentRow = rows[activeRowIndex];
      if (activeColumnIndex > 0) {
        return currentRow.items[activeColumnIndex - 1]?.element ?? null;
      }
      if (activeRowIndex > 0) {
        const previousRow = rows[activeRowIndex - 1];
        return previousRow.items[previousRow.items.length - 1]?.element ?? null;
      }
      const lastRow = rows[rows.length - 1];
      return lastRow.items[lastRow.items.length - 1]?.element ?? null;
    }

    const rowDelta = direction === "up" ? -1 : 1;
    let nextRowIndex = activeRowIndex + rowDelta;
    if (nextRowIndex < 0) {
      nextRowIndex = rows.length - 1;
    } else if (nextRowIndex >= rows.length) {
      nextRowIndex = 0;
    }
    const nextRow = rows[nextRowIndex];
    if (!nextRow || nextRow.items.length === 0) {
      return null;
    }
    let nearestColumnIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < nextRow.items.length; index += 1) {
      const distance = Math.abs(nextRow.items[index].centerX - activeCenterX);
      if (distance < nearestDistance) {
        nearestColumnIndex = index;
        nearestDistance = distance;
      }
    }
    return nextRow.items[nearestColumnIndex]?.element ?? null;
  }

  focusControllerDialogElement(element: HTMLElement): void {
    element.focus();
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  findDirectionalControllerFocusTarget(
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

  moveClientOptionsDialogFocus(
    overlay: HTMLElement,
    activeElement: HTMLElement,
    direction: "up" | "down" | "left" | "right",
  ): boolean {
    if (direction !== "left" && direction !== "right") {
      return false;
    }
    if (overlay.id !== "nh3d-client-options-dialog") {
      return false;
    }

    const nav = overlay.querySelector<HTMLElement>(".nh3d-options-nav");
    const panel = overlay.querySelector<HTMLElement>(".nh3d-options-panel");
    if (!nav || !panel) {
      return false;
    }

    const navTabs = this.getControllerFocusableElements(nav).filter((element) =>
      element.classList.contains("nh3d-options-tab"),
    );
    const panelFocusable = this.getControllerFocusableElements(panel).filter(
      (element) =>
        !element.classList.contains("nh3d-mobile-dialog-close") &&
        !element.closest(".nh3d-options-panel-heading"),
    );
    if (navTabs.length === 0 || panelFocusable.length === 0) {
      return false;
    }

    if (direction === "right" && nav.contains(activeElement)) {
      const target =
        this.findDirectionalControllerFocusTarget(
          activeElement,
          panelFocusable,
          "right",
        ) ?? panelFocusable[0];
      if (!target) {
        return false;
      }
      this.focusControllerDialogElement(target);
      return true;
    }

    if (direction === "left" && panel.contains(activeElement)) {
      const leftTarget = this.findDirectionalControllerFocusTarget(
        activeElement,
        panelFocusable,
        "left",
      );
      if (leftTarget) {
        this.focusControllerDialogElement(leftTarget);
        return true;
      }
      const selectedTab =
        nav.querySelector<HTMLElement>(".nh3d-options-tab.is-selected") ??
        navTabs[0];
      if (!selectedTab) {
        return false;
      }
      this.focusControllerDialogElement(selectedTab);
      return true;
    }

    return false;
  }

  moveControllerDialogFocus(
    direction: "up" | "down" | "left" | "right",
  ): boolean {
    const overlay = this.getTopControllerOverlayElement();
    if (!overlay) {
      return false;
    }
    const focusable = this.getControllerFocusableElements(overlay);
    if (focusable.length === 0) {
      return false;
    }
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const activeInOverlay =
      activeElement && overlay.contains(activeElement) ? activeElement : null;
    if (
      activeInOverlay &&
      this.moveClientOptionsDialogFocus(overlay, activeInOverlay, direction)
    ) {
      return true;
    }
    const gridTarget = this.resolveControllerGridFocusTarget(
      overlay,
      focusable,
      activeInOverlay,
      direction,
    );
    if (gridTarget) {
      this.focusControllerDialogElement(gridTarget);
      return true;
    }
    const activeIndex = activeInOverlay
      ? focusable.indexOf(activeInOverlay)
      : -1;
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
      this.focusControllerDialogElement(nextElement);
    }
    return true;
  }

  findControllerScrollableElement(
    overlay: HTMLElement | null,
  ): HTMLElement | null {
    if (!overlay) {
      return null;
    }
    const isScrollable = (element: HTMLElement): boolean => {
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
    if (isScrollable(overlay)) {
      return overlay;
    }
    const descendants = Array.from(overlay.querySelectorAll<HTMLElement>("*"));
    for (const descendant of descendants) {
      if (isScrollable(descendant)) {
        return descendant;
      }
    }
    return null;
  }

  scrollControllerDialogOverlay(
    scrollAxisY: number,
    deltaSeconds: number,
  ): void {
    if (
      !Number.isFinite(scrollAxisY) ||
      Math.abs(scrollAxisY) <= this.dependencies.controllerGameplay.controllerAxisDeadzone
    ) {
      return;
    }
    const overlay = this.getTopControllerOverlayElement();
    const scrollElement = this.findControllerScrollableElement(overlay);
    if (!scrollElement) {
      return;
    }
    const scrollDelta =
      scrollAxisY * this.controllerDialogScrollPxPerSec * deltaSeconds;
    if (!Number.isFinite(scrollDelta) || Math.abs(scrollDelta) < 0.01) {
      return;
    }
    const previousScrollTop = scrollElement.scrollTop;
    scrollElement.scrollTop += scrollDelta;
    if (
      !overlay ||
      Math.abs(scrollElement.scrollTop - previousScrollTop) < 0.01
    ) {
      return;
    }
    this.maintainControllerFocusAfterDialogScroll(
      overlay,
      scrollElement,
      scrollDelta > 0 ? "down" : "up",
    );
  }

  maintainControllerFocusAfterDialogScroll(
    overlay: HTMLElement,
    scrollElement: HTMLElement,
    direction: "up" | "down",
  ): void {
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (
      !activeElement ||
      !overlay.contains(activeElement) ||
      !scrollElement.contains(activeElement)
    ) {
      return;
    }
    const activeRect = activeElement.getBoundingClientRect();
    const scrollRect = scrollElement.getBoundingClientRect();
    const fellAboveViewport = activeRect.bottom < scrollRect.top + 2;
    const fellBelowViewport = activeRect.top > scrollRect.bottom - 2;
    if (direction === "down" && fellAboveViewport) {
      this.moveControllerDialogFocus("down");
      return;
    }
    if (direction === "up" && fellBelowViewport) {
      this.moveControllerDialogFocus("up");
    }
  }

  moveControllerVirtualCursorByAxes(
    axisX: number,
    axisY: number,
    deltaSeconds: number,
  ): boolean {
    if (
      !Number.isFinite(axisX) ||
      !Number.isFinite(axisY) ||
      (Math.abs(axisX) <= this.controllerDialogCursorDeadzone &&
        Math.abs(axisY) <= this.controllerDialogCursorDeadzone)
    ) {
      return false;
    }

    this.ensureControllerVirtualCursorSeedPosition();
    this.setControllerVirtualCursorVisible(true);
    const nextX =
      this.controllerVirtualCursorX +
      axisX * this.controllerDialogCursorPxPerSec * deltaSeconds;
    const nextY =
      this.controllerVirtualCursorY +
      axisY * this.controllerDialogCursorPxPerSec * deltaSeconds;
    this.setControllerVirtualCursorPosition(nextX, nextY);
    return true;
  }

  tryClickFocusedControllerOverlayElement(): boolean {
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (activeElement && typeof activeElement.click === "function") {
      this.dependencies.controllerGameplay.armControllerFpsDirectionPromptUi();
      activeElement.click();
      return true;
    }
    const overlay = this.getTopControllerOverlayElement();
    if (!overlay) {
      return false;
    }
    const focusable = this.getControllerFocusableElements(overlay);
    const first = focusable[0];
    if (!first) {
      return false;
    }
    first.focus();
    this.dependencies.controllerGameplay.armControllerFpsDirectionPromptUi();
    first.click();
    return true;
  }

  clickControllerVirtualCursorTarget(): boolean {
    if (
      this.controllerVirtualCursorVisible &&
      Number.isFinite(this.controllerVirtualCursorX) &&
      Number.isFinite(this.controllerVirtualCursorY)
    ) {
      const target = document.elementFromPoint(
        this.controllerVirtualCursorX,
        this.controllerVirtualCursorY,
      );
      if (target instanceof HTMLElement) {
        const clickable =
          target.closest(
            "button, summary, [role='button'], a, input, select, textarea, label, [tabindex]",
          ) ?? target;
        if (clickable instanceof HTMLElement) {
          clickable.focus();
          this.dependencies.controllerGameplay.armControllerFpsDirectionPromptUi();
          clickable.click();
          this.pulseControllerVirtualCursor();
          return true;
        }
      }
    }
    return this.tryClickFocusedControllerOverlayElement();
  }

  focusFirstControllerOverlayActionSoon(): void {
    window.setTimeout(() => {
      const overlay = this.getTopControllerOverlayElement();
      if (!overlay) {
        return;
      }
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (activeElement && overlay.contains(activeElement)) {
        return;
      }
      const focusable = this.getControllerFocusableElements(overlay);
      const first = focusable[0];
      if (!first) {
        return;
      }
      first.focus({ preventScroll: true });
    }, 0);
  }

  handleControllerDialogInput(
    snapshot: ControllerActionSnapshot,
    deltaSeconds: number,
  ): void {
    this.dependencies.controllerGameplay.controllerFpsLeftStickLastMoveInput = null;
    this.dependencies.controllerGameplay.controllerFpsLeftStickNextMoveAtMs = 0;

    if (snapshot.pressed.pause_menu) {
      this.dependencies.controllerGameplay.dispatchControllerKeyDown("Escape", "Escape");
    }

    if (this.handleControllerDialogSliderInput(snapshot, deltaSeconds)) {
      return;
    }

    if (
      snapshot.pressed.action_menu &&
      this.dependencies.controllerGameplay.getControllerActionWheelOverlayElement()
    ) {
      this.dependencies.controllerGameplay.dispatchControllerActionWheelCloseRequest();
      return;
    }

    if (snapshot.pressed.cancel_or_context) {
      if (this.dependencies.promptDialogs.isInventoryDialogOpen() && this.isInventoryContextMenuOpen()) {
        this.requestCloseInventoryContextMenu();
        this.dependencies.controllerGameplay.consumeControllerCancelUntilRelease();
        return;
      }
      if (this.dependencies.tileContextActions.fpsCrosshairContextMenuOpen || this.dependencies.tileContextActions.normalTileContextMenuOpen) {
        this.dependencies.tileContextActions.closeAnyTileContextMenu(true);
      } else if (this.dependencies.controllerGameplay.getControllerActionWheelOverlayElement()) {
        this.dependencies.controllerGameplay.dispatchControllerActionWheelCloseRequest();
        return;
      } else {
        this.dependencies.controllerGameplay.dispatchControllerKeyDown("Escape", "Escape");
      }
    }

    if (this.dependencies.directionPrompts.isInDirectionQuestion) {
      this.clearControllerDialogDpadRepeat();
      this.setControllerVirtualCursorVisible(false);
      this.dependencies.controllerGameplay.handleControllerDirectionQuestionInput(snapshot, deltaSeconds);
      return;
    }

    this.dependencies.controllerGameplay.clearControllerDirectionPromptPreview();
    this.dependencies.controllerGameplay.clearControllerMovePreview();
    const controllerActionWheelOverlay =
      this.dependencies.controllerGameplay.getControllerActionWheelOverlayElement();
    const controllerActionWheelIsQuick = Boolean(
      controllerActionWheelOverlay?.classList.contains("is-quick"),
    );
    const controllerActionWheelIsExtended = Boolean(
      controllerActionWheelOverlay?.classList.contains("is-extended"),
    );

    let dpadDirection: "up" | "down" | "left" | "right" | null = null;
    if (controllerActionWheelIsExtended) {
      dpadDirection = this.getControllerDialogDpadDirectionWithRepeat(snapshot);
    } else {
      this.clearControllerDialogDpadRepeat();
      dpadDirection = this.getPressedControllerDpadDirection(snapshot);
    }

    if (dpadDirection) {
      this.setControllerVirtualCursorVisible(false);
      const arrowKey =
        dpadDirection === "up"
          ? "ArrowUp"
          : dpadDirection === "down"
            ? "ArrowDown"
            : dpadDirection === "left"
              ? "ArrowLeft"
              : "ArrowRight";
      if (
        this.dependencies.questionMenus.isInQuestion ||
        this.dependencies.directionPrompts.isInDirectionQuestion ||
        this.dependencies.positionSelection.positionInputModeActive
      ) {
        this.dependencies.controllerGameplay.dispatchControllerKeyDown(arrowKey, arrowKey);
      } else {
        this.moveControllerDialogFocus(dpadDirection);
      }
    }

    if (controllerActionWheelOverlay) {
      if (controllerActionWheelIsQuick) {
        const didHighlight = this.dependencies.controllerGameplay.highlightControllerActionWheelFromSticks(
          snapshot,
          controllerActionWheelOverlay,
        );
        if (didHighlight) {
          this.setControllerVirtualCursorVisible(false);
        }
        if (snapshot.pressed.confirm) {
          this.dependencies.controllerGameplay.consumeControllerConfirmUntilRelease();
          const didClick = this.tryClickFocusedControllerOverlayElement();
          if (!didClick) {
            this.dependencies.controllerGameplay.dispatchControllerKeyDown("Enter", "Enter");
          }
        }
        return;
      }

      const scrollAxisY =
        snapshot.values.right_stick_down - snapshot.values.right_stick_up;
      this.scrollControllerDialogOverlay(scrollAxisY, deltaSeconds);

      const cursorAxisX =
        snapshot.values.left_stick_right - snapshot.values.left_stick_left;
      const cursorAxisY =
        snapshot.values.left_stick_down - snapshot.values.left_stick_up;
      const movedCursor = this.moveControllerVirtualCursorByAxes(
        cursorAxisX,
        cursorAxisY,
        deltaSeconds,
      );
      if (movedCursor) {
        this.setControllerVirtualCursorVisible(true);
      }

      if (snapshot.pressed.confirm) {
        this.dependencies.controllerGameplay.consumeControllerConfirmUntilRelease();
        const didClick = this.clickControllerVirtualCursorTarget();
        if (!didClick) {
          this.dependencies.controllerGameplay.dispatchControllerKeyDown("Enter", "Enter");
        }
      }
      return;
    }

    const scrollAxisY =
      snapshot.values.right_stick_down - snapshot.values.right_stick_up;
    this.scrollControllerDialogOverlay(scrollAxisY, deltaSeconds);

    const cursorAxisX =
      snapshot.values.left_stick_right - snapshot.values.left_stick_left;
    const cursorAxisY =
      snapshot.values.left_stick_down - snapshot.values.left_stick_up;
    const movedCursor = this.moveControllerVirtualCursorByAxes(
      cursorAxisX,
      cursorAxisY,
      deltaSeconds,
    );
    if (movedCursor) {
      this.setControllerVirtualCursorVisible(true);
    }

    if (snapshot.pressed.confirm) {
      this.dependencies.controllerGameplay.consumeControllerConfirmUntilRelease();
      const didClick = this.clickControllerVirtualCursorTarget();
      if (!didClick) {
        this.dependencies.controllerGameplay.dispatchControllerKeyDown("Enter", "Enter");
      }
    }
  }
}
