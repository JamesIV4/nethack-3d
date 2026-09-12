export type WiredPoint = { x: number; y: number };
export type WiredInput =
  | ({ type: "move" | "down" | "up" } & WiredPoint)
  | ({ type: "wheel"; deltaY: number } & WiredPoint)
  | { type: "key"; key: string; shift?: boolean }
  | { type: "text"; text: string };
export interface WiredInfo { width: number; height: number; frameId: number; page: string; ready: boolean; error?: string }

/** Ordered input for our own offscreen window; never exposes arbitrary CDP. */
export class WiredBridge {
  private chain: Promise<void> = Promise.resolve();
  private closed = false;
  private move: { point: WiredPoint | null } | null = null;

  constructor(private readonly token: string, private readonly reportError: (error: string) => void) {}
  async request(path: string, body?: unknown): Promise<Response> {
    const response = await fetch(`/__wired/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${this.token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Local UI host returned ${response.status}: ${await response.text()}`);
    return response;
  }
  async info(): Promise<WiredInfo> { return (await this.request("info")).json() as Promise<WiredInfo>; }
  private enqueue(action: () => Promise<unknown>): void {
    if (this.closed) return;
    this.chain = this.chain.then(() => this.closed ? undefined : action()).then(() => undefined).catch((error: unknown) => {
      this.reportError(error instanceof Error ? error.message : String(error));
    });
  }
  input(input: WiredInput): void {
    if (this.closed) return;
    if (input.type === "move") {
      const point = { x: input.x, y: input.y };
      if (this.move) { this.move.point = point; return; }
      const batch: { point: WiredPoint | null } = { point };
      this.move = batch;
      this.enqueue(() => {
        // Only adjacent moves share a batch. A down/up/key event seals the
        // batch so later movement cannot jump across that event in the queue.
        if (this.move === batch) this.move = null;
        const point = batch.point;
        return point ? this.request("input", { type: "move", ...point }) : Promise.resolve();
      });
      return;
    }
    this.move = null;
    this.enqueue(() => this.request("input", input));
  }
  navigate(page: "probe" | "game"): void { this.release(); this.enqueue(() => this.request("navigate", { page })); }
  release(): void {
    // A cancelled drag must not apply its last unsent movement on the way out.
    if (this.move) this.move.point = null;
    this.move = null;
    this.enqueue(() => this.request("release", {}));
  }
  releaseOnUnload(): void {
    // Unload uses a keepalive request, so invalidate queued actions that could
    // otherwise arrive after that cancellation and press the source again.
    if (this.closed) return;
    this.closed = true;
    if (this.move) this.move.point = null;
    this.move = null;
    void fetch("/__wired/release", { method: "POST", headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" }, body: "{}", keepalive: true }).catch(() => undefined);
  }
}
