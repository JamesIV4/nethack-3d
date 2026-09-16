import { describe, expect, it } from "vitest";
import { RuntimeEventBatchPublisher, RuntimeEventBatchReceiver } from "./event-batches";
import type { RuntimeEventBatch } from "./types";
import type { RuntimeEvent } from "../types";

describe("ordered runtime transport", () => {
  it("retains an explicit snapshot completion even when the last data chunk already flushed", () => {
    const batches: RuntimeEventBatch[] = [];
    const publisher = new RuntimeEventBatchPublisher("s", batch => batches.push(batch), () => {}, 2);
    publisher.enqueue({ type: "map_glyph", x: 1, y: 1 });
    publisher.enqueue({ type: "map_glyph", x: 2, y: 1 });
    expect(batches).toHaveLength(1);
    publisher.enqueue({ type: "runtime_boundary", reason: "snapshot-complete" });
    expect(batches).toHaveLength(2);
    expect(batches[1]).toEqual(expect.objectContaining({
      boundary: "snapshot-complete", sequenceStart: 3, sequenceEnd: 3,
      events: [{ type: "runtime_boundary", reason: "snapshot-complete" }],
    }));
  });
  it("bundles callback microtasks, retains intermediate cells and clones mutable payloads", async () => {
    const batches: RuntimeEventBatch[] = [], tasks: (() => void)[] = [];
    const publisher = new RuntimeEventBatchPublisher("session", batch => batches.push(batch), () => tasks.push(() => publisher.flush()));
    const records = [{ type: "map_glyph", x: 1, y: 2, glyph: 3 }, { type: "map_glyph", x: 1, y: 2, glyph: 4 }];
    publisher.enqueue(records[0]); await Promise.resolve(); publisher.enqueue(records[1]);
    const inventory = { type: "inventory_update", items: [{ count: 2 }] };
    publisher.enqueue(inventory); inventory.items[0].count = 99;
    expect(batches).toHaveLength(0); expect(tasks).toHaveLength(1);
    tasks[0]();
    expect(batches[0].events).toEqual([...records, { type: "inventory_update", items: [{ count: 2 }] }]);
    expect(batches[0].sequenceStart).toBe(1); expect(batches[0].sequenceEnd).toBe(3);
  });

  it("separates size splits, presentation resets and actual level identity", () => {
    const batches: RuntimeEventBatch[] = [];
    const publisher = new RuntimeEventBatchPublisher("s", b => batches.push(b), () => {}, 2);
    publisher.enqueue({ type: "map_glyph" }, { dnum: 0, dlevel: 1 });
    publisher.enqueue({ type: "map_glyph" }, { dnum: 0, dlevel: 1 });
    publisher.enqueue({ type: "clear_scene" }, { dnum: 0, dlevel: 1 });
    publisher.enqueue({ type: "player_position" }, { dnum: 0, dlevel: 2 });
    publisher.enqueue({ type: "question" }, { dnum: 0, dlevel: 2 });
    expect(batches.map(b => b.scope.levelGeneration)).toEqual([1, 1, 2]);
    expect(batches.map(b => b.scope.presentationGeneration)).toEqual([0, 1, 1]);
    expect(batches.map(b => b.boundary)).toEqual(["size", "level-change", "size"]);
  });

  it("replays in order, ignores stale sessions and fails explicitly on a missing record", () => {
    const batches: RuntimeEventBatch[] = [], events: RuntimeEvent[] = [], failures: string[] = [];
    const publisher = new RuntimeEventBatchPublisher("s", b => batches.push(b), () => {});
    publisher.enqueue({ type: "map_glyph" }); publisher.enqueue({ type: "question" });
    const receiver = new RuntimeEventBatchReceiver("s", event => events.push(event), reason => failures.push(reason));
    receiver.receive({ ...batches[0], sessionId: "old" }); expect(events).toEqual([]);
    receiver.receive(batches[0]); expect(events.map(e => e.type)).toEqual(["map_glyph", "question"]);
    expect(receiver.lastProcessedSequence).toBe(2);
    receiver.receive({ ...batches[0], batchId: 2, sequenceStart: 4, sequenceEnd: 5 });
    expect(failures).toHaveLength(1);
    receiver.receive(batches[0]); expect(events).toHaveLength(2);
  });

  it("keeps the explicit boundary in the ordered transport record", () => {
    const batches: RuntimeEventBatch[] = [];
    const publisher = new RuntimeEventBatchPublisher("s", b => batches.push(b), () => {});
    publisher.enqueue({ type: "map_glyph", x: 1, y: 2 });
    publisher.enqueue({ type: "runtime_boundary", reason: "map-display" });
    expect(batches).toHaveLength(1);
    expect(batches[0].boundary).toBe("map-display");
    expect(batches[0].events.map(event => event.type)).toEqual(["map_glyph", "runtime_boundary"]);
  });

  it("fails closed when an established engine handler throws", () => {
    const batches: RuntimeEventBatch[] = [];
    const publisher = new RuntimeEventBatchPublisher("s", batch => batches.push(batch), () => {});
    publisher.enqueue({ type: "map_glyph" });
    publisher.enqueue({ type: "question" });
    const failures: string[] = [];
    const receiver = new RuntimeEventBatchReceiver("s", event => {
      if (event.type === "map_glyph") throw new Error("renderer failed");
    }, reason => failures.push(reason));
    receiver.receive(batches[0]);
    expect(receiver.lastProcessedSequence).toBe(0);
    expect(failures).toEqual([expect.stringContaining("delivery failed")]);
  });
});
