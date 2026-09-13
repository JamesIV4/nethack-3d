export class SnapTurnLatch {
  private armed = true;
  update(x: number, enabled: boolean): -1 | 0 | 1 {
    if (!Number.isFinite(x)) return 0;
    if (Math.abs(x) < 0.25) this.armed = true;
    if (!enabled) { if (Math.abs(x) >= 0.25) this.armed = false; return 0; }
    if (!this.armed || Math.abs(x) < 0.7) return 0;
    this.armed = false;
    return x > 0 ? 1 : -1;
  }
}

export class WorldClickGesture {
  private started: number | null = null;
  private held = false;
  press(time: number): void { this.started = time; this.held = false; }
  update(time: number): boolean {
    if (this.started === null || this.held || time - this.started < 450) return false;
    this.held = true; return true;
  }
  release(time: number): "primary" | "secondary" | null {
    if (this.started === null) return null;
    const result = this.held ? null : time - this.started >= 450 ? "secondary" : "primary";
    this.cancel(); return result;
  }
  cancel(): void { this.started = null; this.held = false; }
}
