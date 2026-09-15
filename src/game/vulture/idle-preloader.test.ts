import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VultureTilesetTranslator } from "./translation";

let now: number;
let nextId: number;
let callbacks: Map<number, IdleRequestCallback>;
let events: EventTarget;
let translator: VultureTilesetTranslator;
let ready: ReturnType<typeof vi.fn<() => void>>;
class TestImage {
  static images: TestImage[] = [];
  src = "";
  fetchPriority = "auto";
  width = 32;
  height = 32;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { TestImage.images.push(this); }
  removeAttribute() { this.src = ""; }
}
beforeEach(async () => {
  now = 0; nextId = 0; callbacks = new Map(); events = new EventTarget(); TestImage.images = [];
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestIdleCallback", (cb: IdleRequestCallback) => { callbacks.set(++nextId, cb); return nextId; });
  vi.stubGlobal("cancelIdleCallback", (id: number) => callbacks.delete(id));
  vi.stubGlobal("addEventListener", events.addEventListener.bind(events));
  vi.stubGlobal("removeEventListener", events.removeEventListener.bind(events));
  vi.stubGlobal("Image", TestImage);
  vi.stubGlobal("HTMLImageElement", TestImage);
  vi.stubGlobal("navigator", { getGamepads: () => [] });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () =>
    'mon.A = "a.png" 0 0\nmon.B = "b.png" 0 0\nmon.C = "a.png" 0 0' }));
  ready = vi.fn();
  translator = new VultureTilesetTranslator({ dataRootUrl: "assets", onAssetReady: ready });
  translator.ensureAssetLoadingStarted();
  await vi.waitFor(() => expect(ready).toHaveBeenCalled());
  ready.mockClear();
  translator.updateIdlePreloading();
});
afterEach(() => { translator.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function idle(budget = 10) {
  translator.updateIdlePreloading();
  const pending = [...callbacks.values()]; callbacks.clear();
  for (const callback of pending) callback({ didTimeout: false, timeRemaining: () => budget });
}
function requestB() {
  return translator.drawLookupTile({ context: {} as CanvasRenderingContext2D, size: 112,
    lookup: { category: "mon", name: "B", projection: "sprite" }, forBillboard: true });
}

describe("Vulture idle image warming", () => {
  it("waits for quiet and idle budget, loads serially, deduplicates, and avoids scene rebuilds", () => {
    idle(); expect(TestImage.images).toHaveLength(0);
    now = 800; idle(0); expect(TestImage.images).toHaveLength(0);
    idle(); expect(TestImage.images).toHaveLength(1);
    expect(TestImage.images[0].fetchPriority).toBe("low");
    expect(translator.isAssetCompilationInProgress()).toBe(false);
    idle(); expect(TestImage.images).toHaveLength(1);
    TestImage.images[0].onload!(); idle(); expect(TestImage.images).toHaveLength(2);
    TestImage.images[1].onload!(); idle(); expect(TestImage.images).toHaveLength(2);
    expect(ready).not.toHaveBeenCalled();
  });
  it("cancels queued and in-flight preloads on input, then resumes after quiet", () => {
    now = 800; translator.updateIdlePreloading();
    expect(callbacks.size).toBe(1);
    events.dispatchEvent(new Event("keydown")); expect(callbacks.size).toBe(0);
    now = 1600; idle(); const image = TestImage.images[0];
    events.dispatchEvent(new Event("pointerdown")); expect(image.src).toBe("");
    expect(image.onload).toBeNull();
    idle(); expect(TestImage.images).toHaveLength(1);
    now = 2400; idle(); expect(TestImage.images).toHaveLength(2);
  });
  it("promotes a visible sprite's preload without cancelling it or making a duplicate request", () => {
    now = 800; idle(); const image = TestImage.images[0];
    expect(image.src).toBe("assets/b.png");
    expect(requestB()).toBe(false);
    expect(translator.isAssetCompilationInProgress()).toBe(true);
    translator.pauseIdlePreloading(); expect(image.src).toBe("assets/b.png");
    expect(TestImage.images).toHaveLength(1);
    image.onload!(); expect(ready).toHaveBeenCalledTimes(1);
  });
  it("gives foreground loads priority and waits while a controller is active", () => {
    requestB(); now = 800; idle(); expect(TestImage.images).toHaveLength(1);
    TestImage.images[0].onload!();
    vi.stubGlobal("navigator", { getGamepads: () => [{ buttons: [{ pressed: true }], axes: [] }] });
    idle(); expect(TestImage.images).toHaveLength(1);
    vi.stubGlobal("navigator", { getGamepads: () => [] });
    now = 1600; idle(); expect(TestImage.images).toHaveLength(2);
  });
  it("cleans up loads, scheduled work, and input listeners on disposal", () => {
    now = 800; idle(); const image = TestImage.images[0];
    translator.updateIdlePreloading(); translator.dispose();
    expect(callbacks.size).toBe(0); expect(image.src).toBe("");
    events.dispatchEvent(new Event("keydown")); now = 1600; idle();
    expect(TestImage.images).toHaveLength(1);
  });
  it("keeps pending sprite placeholders transparent but retains terrain fallback", () => {
    const context = { clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn() };
    translator.drawFallbackTile(context as unknown as CanvasRenderingContext2D, 112, true);
    expect(context.clearRect).toHaveBeenCalled(); expect(context.fillRect).not.toHaveBeenCalled();
    translator.drawFallbackTile(context as unknown as CanvasRenderingContext2D, 112, false);
    expect(context.fillRect).toHaveBeenCalled();
  });
});
