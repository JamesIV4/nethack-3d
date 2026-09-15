/** Runs one cancellable asset load at a time, only in browser idle time. */
export class VultureIdlePreloader {
  private idleId: number | null = null;
  private lastActivity = performance.now();
  private disposed = false;
  private readonly events = ["keydown", "pointerdown", "pointermove", "wheel", "touchstart", "touchmove", "input"];

  constructor(private readonly startOne: () => void, private readonly cancelLoad: () => void) {
    for (const event of this.events) globalThis.addEventListener?.(event, this.pause, { capture: true, passive: true });
  }

  readonly pause = (): void => {
    this.lastActivity = performance.now();
    if (this.idleId !== null) globalThis.cancelIdleCallback?.(this.idleId);
    this.idleId = null;
    this.cancelLoad();
  };

  tick(): void {
    if (this.disposed) return;
    const gamepads = typeof navigator !== "undefined" ? navigator.getGamepads?.() : null;
    if (Array.from(gamepads ?? []).some(pad => pad &&
      (pad.buttons.some(button => button.pressed) || pad.axes.some(axis => Math.abs(axis) > 0.15)))) {
      this.pause();
      return;
    }
    if (typeof document !== "undefined" && document.hidden) { this.pause(); return; }
    if (this.idleId !== null || performance.now() - this.lastActivity < 750 ||
        typeof globalThis.requestIdleCallback !== "function") return;
    this.idleId = globalThis.requestIdleCallback(deadline => {
      this.idleId = null;
      if (!this.disposed && performance.now() - this.lastActivity >= 750 && deadline.timeRemaining() >= 4) {
        this.startOne();
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    this.pause();
    for (const event of this.events) globalThis.removeEventListener?.(event, this.pause, true);
  }
}
