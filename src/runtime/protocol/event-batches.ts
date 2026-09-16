import type { RuntimeEvent } from "../types";
import { runtimeProtocolVersion, type RuntimeBoundary, type RuntimeEventBatch, type RuntimeLevelIdentity, type RuntimeObservationScope } from "./types";

/** A task checkpoint spans WASM callback microtasks without waiting for a render frame. */
export function createTaskCheckpoint(flush: () => void): { schedule(): void; dispose(): void } {
  if (typeof MessageChannel !== "function") {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    return {
      schedule: () => {
        if (disposed || timer !== null) return;
        timer = setTimeout(() => { timer = null; if (!disposed) flush(); }, 0);
      },
      dispose: () => {
        disposed = true;
        if (timer !== null) clearTimeout(timer);
        timer = null;
      },
    };
  }
  const channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return { schedule: () => channel.port2.postMessage(0), dispose: () => { channel.port1.close(); channel.port2.close(); } };
}

/** Batches already-normalized observations; never drops or reorders records. */
export class RuntimeEventBatchPublisher {
  private events: RuntimeEvent[] = [];
  private sequence = 0;
  private batchId = 0;
  private scheduled = false;
  private disposed = false;
  private levelKey: string | null = null;
  private scope: RuntimeObservationScope = { presentationGeneration: 0, levelGeneration: 0, level: null };

  constructor(
    private readonly sessionId: string,
    private readonly post: (batch: RuntimeEventBatch) => void,
    private readonly schedule: () => void,
    private readonly maxRecords = 128,
  ) {}

  enqueue(event: RuntimeEvent, level: RuntimeLevelIdentity | null = null): void {
    if (this.disposed) return;
    const key = level ? `${level.dnum}:${level.dlevel}` : null;
    if (key !== null && key !== this.levelKey) {
      this.flush("level-change");
      this.levelKey = key;
      this.scope = { ...this.scope, levelGeneration: this.scope.levelGeneration + 1, level: { ...level! } };
    } else if ((level === null) !== (this.scope.level === null)) {
      this.flush("level-change");
      this.scope = { ...this.scope, level: level ? { ...level } : null };
    }
    if (event.type === "clear_scene") {
      this.flush("presentation-reset");
      this.scope = { ...this.scope, presentationGeneration: this.scope.presentationGeneration + 1 };
    }
    // postMessage used to take this snapshot immediately. Queued menus,
    // inventories and nested snapshot records must not retain mutable owners.
    this.events.push(structuredClone(event.type === "refresh_result"
      ? { ...event, observedThroughSequence: this.sequence + this.events.length } : event));
    if (event.type === "runtime_boundary") this.flush(event.reason as RuntimeBoundary);
    else if (this.events.length >= this.maxRecords) this.flush("size");
    else if (event.type === "question" || event.type === "direction_question" ||
      event.type === "text_request" || event.type === "name_request" || event.type === "position_request" ||
      event.type === "info_menu" || event.type === "runtime_terminated" || event.type === "runtime_error") this.flush("control");
    else if (!this.scheduled) { this.scheduled = true; this.schedule(); }
  }

  flush(boundary: RuntimeBoundary = "task"): void {
    this.scheduled = false;
    if (this.events.length === 0 || this.disposed) return;
    const events = this.events;
    this.events = [];
    const sequenceStart = this.sequence + 1;
    this.sequence += events.length;
    this.post({ type: "runtime_events", protocolVersion: runtimeProtocolVersion, sessionId: this.sessionId,
      batchId: ++this.batchId, sequenceStart, sequenceEnd: this.sequence, scope: { ...this.scope }, boundary, events });
  }

  dispose(): void { this.flush("shutdown"); this.disposed = true; this.events = []; }
}

/** One session, one contiguous stream. Replays through the established engine handlers. */
export class RuntimeEventBatchReceiver {
  lastProcessedSequence = 0;
  private batchId = 0;
  private failed = false;
  scope: RuntimeObservationScope = { presentationGeneration: 0, levelGeneration: 0, level: null };

  get hasFailed(): boolean { return this.failed; }

  constructor(private readonly sessionId: string, private readonly deliver: (event: RuntimeEvent) => void,
    private readonly fail: (reason: string) => void) {}

  receive(batch: RuntimeEventBatch): void {
    if (this.failed || batch.sessionId !== this.sessionId) return;
    if (batch.protocolVersion !== runtimeProtocolVersion || !Array.isArray(batch.events) || !batch.events.length ||
      batch.batchId !== this.batchId + 1 || batch.sequenceStart !== this.lastProcessedSequence + 1 ||
      batch.sequenceEnd !== batch.sequenceStart + batch.events.length - 1 ||
      !batch.scope || !Number.isSafeInteger(batch.scope.presentationGeneration) || !Number.isSafeInteger(batch.scope.levelGeneration) ||
      batch.scope.presentationGeneration < 0 || batch.scope.levelGeneration < 0 ||
      (batch.scope.level !== null && (
        !Number.isSafeInteger(batch.scope.level?.dnum) || batch.scope.level.dnum < 0 ||
        !Number.isSafeInteger(batch.scope.level?.dlevel) || batch.scope.level.dlevel <= 0
      )) ||
      batch.scope.presentationGeneration < this.scope.presentationGeneration || batch.scope.levelGeneration < this.scope.levelGeneration ||
      batch.events.some(event => !event || typeof event.type !== "string")) {
      this.failed = true; this.fail("Runtime observation stream is incompatible or discontinuous; restart the session."); return;
    }
    this.batchId = batch.batchId;
    this.scope = batch.scope;
    for (const event of batch.events) {
      try {
        this.deliver(event);
        this.lastProcessedSequence++;
      } catch {
        this.failed = true;
        this.fail("Runtime observation delivery failed; restart the session.");
        return;
      }
    }
  }
}
