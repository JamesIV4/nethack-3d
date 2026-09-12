import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestNativeBridge, splitQuestScene, type QuestSceneEnvelope, type QuestWebMessagePort } from "./bridge";

afterEach(() => vi.useRealTimers());
function fixture() {
  const sent: Record<string, unknown>[] = [];
  const port: QuestWebMessagePort = { onmessage: null, postMessage: (json) => sent.push(JSON.parse(json)) };
  const bridge = new QuestNativeBridge(port);
  const receive = (message: Record<string, unknown>) => port.onmessage?.({ data: JSON.stringify({ version: 1, ...message }) });
  const ack = (packet = sent[sent.length - 1]!) => receive({ type: "scene-ack", session: packet.session, sequence: packet.sequence, index: packet.index });
  return { bridge, port, sent, receive, ack };
}
const frame = (data = ""): QuestSceneEnvelope & { data: string } => ({ version: 1, type: "scene", session: "test-session", sequence: 1, data });

describe("native Quest transport", () => {
  it("chunks escaped Unicode under the packet byte limit without damaging characters", () => {
    const json = JSON.stringify({ text: '"\\日🦄'.repeat(800) });
    const chunks = splitQuestScene(json, 1024);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(json);
    for (const [index, data] of chunks.entries()) {
      const packet = JSON.stringify({ version: 1, type: "scene-chunk", session: "a".repeat(128), sequence: Number.MAX_SAFE_INTEGER, index, count: chunks.length, data });
      expect(new TextEncoder().encode(packet).byteLength).toBeLessThanOrEqual(1024);
    }
  });

  it("sends only one chunk at a time and ignores stale acknowledgements", async () => {
    const f = fixture();
    const sending = f.bridge.sendScene(frame("x".repeat(400_000)));
    expect(f.sent).toHaveLength(1);
    f.receive({ type: "scene-ack", session: "other", sequence: 1, index: 0 });
    f.receive({ type: "scene-ack", session: "test-session", sequence: 1, index: 1 });
    await Promise.resolve();
    expect(f.sent).toHaveLength(1);
    const count = f.sent[0].count as number;
    for (let index = 0; index < count; index += 1) {
      expect(f.sent).toHaveLength(index + 1);
      f.ack();
      await Promise.resolve();
    }
    await sending;
    expect(f.sent.map((packet) => packet.data).join("")).toBe(JSON.stringify(frame("x".repeat(400_000))));
    f.bridge.dispose();
  });

  it("registers acknowledgement before a synchronous native reply", async () => {
    const port: QuestWebMessagePort = {
      onmessage: null,
      postMessage(json) {
        const packet = JSON.parse(json);
        port.onmessage?.({ data: JSON.stringify({ ...packet, type: "scene-ack", data: undefined }) });
      },
    };
    const bridge = new QuestNativeBridge(port);
    await expect(bridge.sendScene(frame())).resolves.toBeUndefined();
    bridge.dispose();
  });

  it("rejects overlapping scenes without replacing the pending frame", async () => {
    const f = fixture();
    const first = f.bridge.sendScene(frame());
    await expect(f.bridge.sendScene(frame())).rejects.toThrow("already in flight");
    f.ack();
    await first;
    f.bridge.dispose();
  });

  it("rejects a cancelled transfer and can start a fresh scene", async () => {
    const f = fixture();
    const first = f.bridge.sendScene(frame());
    const rejection = expect(first).rejects.toThrow("reset");
    f.receive({ type: "reset" });
    await rejection;
    const second = f.bridge.sendScene({ ...frame(), sequence: 2 });
    f.ack();
    await second;
    f.bridge.dispose();
  });

  it("rejects a matching native scene error and restores the flat canvas state", async () => {
    const f = fixture();
    f.receive({ type: "state", mode: "immersive", ready: true });
    const sending = f.bridge.sendScene(frame());
    const rejection = expect(sending).rejects.toThrow("texture rejected");
    f.receive({ type: "scene-error", session: "test-session", sequence: 1, error: "texture rejected" });
    await rejection;
    expect(f.bridge.getState()).toEqual({ mode: "immersive", ready: false });
    f.bridge.dispose();
  });

  it("releases backpressure after a stalled native acknowledgement", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const sending = f.bridge.sendScene(frame());
    const rejection = expect(sending).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(15_000);
    await rejection;
    f.bridge.dispose();
  });

  it("uses only validated native mode/readiness messages", () => {
    const f = fixture();
    const states: unknown[] = [];
    f.bridge.subscribeState((state) => states.push(state));
    f.receive({ version: 2, type: "state", mode: "immersive", ready: true });
    f.receive({ type: "state", mode: "immersive", ready: "true" });
    f.receive({ type: "state", mode: "invalid", ready: true });
    expect(states).toHaveLength(1);
    f.receive({ type: "state", mode: "immersive", ready: true });
    expect(states[states.length - 1]).toEqual({ mode: "immersive", ready: true });
    f.bridge.dispose();
  });

  it("clears listeners and the pending scene on disposal", async () => {
    const f = fixture();
    const sending = f.bridge.sendScene(frame());
    const rejection = expect(sending).rejects.toThrow("page closed");
    f.bridge.dispose();
    await rejection;
    expect(f.port.onmessage).toBeNull();
    await expect(f.bridge.sendScene(frame())).rejects.toThrow("disposed");
  });
});
