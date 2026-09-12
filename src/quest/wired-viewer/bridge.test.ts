import { afterEach, describe, expect, it, vi } from "vitest";
import { WiredBridge, type WiredInput } from "./bridge";

type CapturedRequest = {
  path: string;
  body: unknown;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
};

function captureRequests() {
  const requests: CapturedRequest[] = [];
  const waiting = new Map<number, (request: CapturedRequest) => void>();
  vi.stubGlobal("fetch", vi.fn((path: string, options: RequestInit) => (
    new Promise<Response>((resolve, reject) => {
      const request = {
        path,
        body: options.body ? JSON.parse(String(options.body)) as unknown : undefined,
        resolve,
        reject,
      };
      const index = requests.push(request) - 1;
      waiting.get(index)?.(request);
      waiting.delete(index);
    })
  )));
  return {
    requests,
    next(index: number): Promise<CapturedRequest> {
      const request = requests[index];
      return request ? Promise.resolve(request) : new Promise((resolve) => {
        waiting.set(index, resolve);
      });
    },
  };
}

function complete(request: CapturedRequest): void {
  request.resolve(new Response("{}", { status: 200 }));
}

afterEach(() => vi.unstubAllGlobals());

describe("WiredBridge input ordering", () => {
  it("coalesces adjacent moves without moving them across a press or release", async () => {
    const capture = captureRequests();
    const bridge = new WiredBridge("test-token", vi.fn());
    bridge.input({ type: "key", key: "Tab" });
    const blocked = await capture.next(0);

    const events: WiredInput[] = [
      { type: "move", x: 10, y: 10 },
      { type: "down", x: 10, y: 10 },
      { type: "move", x: 20, y: 20 },
      { type: "move", x: 30, y: 30 },
      { type: "up", x: 30, y: 30 },
      { type: "move", x: 40, y: 40 },
      { type: "move", x: 50, y: 50 },
      { type: "key", key: "Enter" },
    ];
    events.forEach((event) => bridge.input(event));
    expect(capture.requests).toHaveLength(1);
    complete(blocked);

    const expected = [events[0], events[1], events[3], events[4], events[6], events[7]];
    for (let index = 0; index < expected.length; index += 1) {
      const request = await capture.next(index + 1);
      expect(request.path).toBe("/__wired/input");
      expect(request.body).toEqual(expected[index]);
      complete(request);
    }
  });

  it("cancels an unsent drag move before accepting later hover movement", async () => {
    const capture = captureRequests();
    const bridge = new WiredBridge("test-token", vi.fn());
    bridge.input({ type: "down", x: 10, y: 10 });
    const blocked = await capture.next(0);
    bridge.input({ type: "move", x: 30, y: 30 });
    bridge.release();
    bridge.input({ type: "move", x: 80, y: 80 });
    bridge.input({ type: "key", key: "Escape" });
    complete(blocked);

    const cancelled = await capture.next(1);
    expect(cancelled.path).toBe("/__wired/release");
    expect(cancelled.body).toEqual({});
    complete(cancelled);
    const hover = await capture.next(2);
    expect(hover.body).toEqual({ type: "move", x: 80, y: 80 });
    complete(hover);
    const key = await capture.next(3);
    expect(key.body).toEqual({ type: "key", key: "Escape" });
    complete(key);
  });

  it("cancels before navigation even while a pointer request is in flight", async () => {
    const capture = captureRequests();
    const bridge = new WiredBridge("test-token", vi.fn());
    bridge.input({ type: "down", x: 10, y: 10 });
    const blocked = await capture.next(0);
    bridge.input({ type: "move", x: 30, y: 30 });
    bridge.navigate("game");
    complete(blocked);

    const cancelled = await capture.next(1);
    expect(cancelled.path).toBe("/__wired/release");
    complete(cancelled);
    const navigation = await capture.next(2);
    expect(navigation.path).toBe("/__wired/navigate");
    expect(navigation.body).toEqual({ page: "game" });
    complete(navigation);
  });

  it("does not dispatch queued or new presses after its unload cancellation", async () => {
    const capture = captureRequests();
    const bridge = new WiredBridge("test-token", vi.fn());
    bridge.input({ type: "move", x: 10, y: 10 });
    const blocked = await capture.next(0);
    bridge.input({ type: "down", x: 10, y: 10 });
    bridge.input({ type: "move", x: 30, y: 30 });
    bridge.releaseOnUnload();
    bridge.input({ type: "down", x: 50, y: 50 });

    const cancelled = await capture.next(1);
    expect(cancelled.path).toBe("/__wired/release");
    complete(cancelled);
    complete(blocked);
    // Let every promise continuation run after the pending transport completes.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(capture.requests).toHaveLength(2);
  });
  it("still cancels input after a failed request", async () => {
    const capture = captureRequests();
    const reportError = vi.fn();
    const bridge = new WiredBridge("test-token", reportError);
    bridge.input({ type: "down", x: 10, y: 10 });
    const blocked = await capture.next(0);
    bridge.release();
    blocked.reject(new Error("Lost local connection"));
    const cancelled = await capture.next(1);
    expect(reportError).toHaveBeenCalledWith("Lost local connection");
    expect(cancelled.path).toBe("/__wired/release");
    complete(cancelled);
  });
});
