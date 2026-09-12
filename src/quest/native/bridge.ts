export type QuestNativeMode = "flat" | "windowed" | "immersive";
export type QuestNativeState = Readonly<{ mode: QuestNativeMode; ready: boolean }>;
export interface QuestSceneEnvelope {
  version: 1;
  type: "scene";
  session: string;
  sequence: number;
}
export interface QuestWebMessagePort {
  postMessage(message: string): void;
  onmessage: ((event: { data: string }) => void) | null;
}
declare global {
  interface Window { nh3dQuest?: QuestWebMessagePort }
}
export const QUEST_MAX_PACKET_BYTES = 128 * 1024;
export const QUEST_MAX_SCENE_BYTES = 32 * 1024 * 1024;
export const QUEST_MAX_SCENE_CHUNKS = 512;
const ACK_DEADLINE_MS = 15_000;
const initialState: QuestNativeState = Object.freeze({ mode: "windowed", ready: false });
type NativeMessage = Record<string, unknown>;
type PendingAck = {
  session: string; sequence: number; index: number;
  resolve: () => void; reject: (error: Error) => void;
};

function object(value: unknown): value is NativeMessage {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Count bytes of the escaped data field, so even Unicode/quote-heavy resources
// stay below the native packet limit. Slice only at complete Unicode characters.
export function splitQuestScene(json: string, maxPacketBytes = QUEST_MAX_PACKET_BYTES): string[] {
  const budget = maxPacketBytes - 512;
  if (budget < 8) throw new Error("Quest packet limit is too small.");
  const chunks: string[] = [];
  let chunkStart = 0, chunkBytes = 0, totalBytes = 0;
  for (let index = 0; index < json.length;) {
    const point = json.codePointAt(index)!;
    const width = point > 0xffff ? 2 : 1;
    const bytes = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    const escapedBytes = point === 34 || point === 92 ? 2 : point < 32 ? 6 : bytes;
    totalBytes += bytes;
    if (totalBytes > QUEST_MAX_SCENE_BYTES) throw new Error("Quest scene exceeds 32 MiB.");
    if (chunkBytes + escapedBytes > budget) {
      chunks.push(json.slice(chunkStart, index));
      chunkStart = index;
      chunkBytes = 0;
    }
    chunkBytes += escapedBytes;
    index += width;
  }
  if (chunkStart < json.length) chunks.push(json.slice(chunkStart));
  if (chunks.length > QUEST_MAX_SCENE_CHUNKS) throw new Error("Quest scene exceeds 512 chunks.");
  return chunks;
}

export class QuestNativeBridge {
  private state: QuestNativeState = initialState;
  private readonly stateListeners = new Set<(state: QuestNativeState) => void>();
  private readonly messageListeners = new Set<(message: NativeMessage) => void>();
  private pending: PendingAck | null = null;
  private sending = false;
  private generation = 0;
  private disposed = false;
  private readonly receive = (event: { data: string }): void => {
    if (typeof event.data !== "string" || event.data.length > 16_384) return;
    let message: unknown;
    try { message = JSON.parse(event.data); } catch { return; }
    if (!object(message) || message.version !== 1 || typeof message.type !== "string") return;
    if (message.type === "scene-ack") {
      if (this.pending && message.session === this.pending.session &&
          message.sequence === this.pending.sequence && message.index === this.pending.index) {
        this.pending.resolve();
      }
      return;
    }
    if (message.type === "scene-error") {
      if (this.pending && message.session === this.pending.session && message.sequence === this.pending.sequence) {
        this.pending.reject(new Error(typeof message.error === "string" ? message.error : "Native scene rejected."));
        this.updateState({ ...this.state, ready: false });
      }
      return;
    }
    if (message.type === "reset") {
      this.cancelScene("Native renderer reset.");
      this.updateState({ ...this.state, ready: false });
    }
    if (message.type === "state") {
      if (!["flat", "windowed", "immersive"].includes(String(message.mode)) || typeof message.ready !== "boolean") return;
      this.updateState({ mode: message.mode as QuestNativeMode, ready: message.ready });
    }
    for (const listener of this.messageListeners) listener(message);
  };

  constructor(private readonly port: QuestWebMessagePort) {
    port.onmessage = this.receive;
  }

  getState(): QuestNativeState { return this.state; }

  subscribeState(listener: (state: QuestNativeState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => { this.stateListeners.delete(listener); };
  }

  subscribeMessage(listener: (message: NativeMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => { this.messageListeners.delete(listener); };
  }

  post(message: NativeMessage): boolean {
    if (this.disposed) return false;
    try { this.port.postMessage(JSON.stringify(message)); return true; }
    catch { return false; }
  }

  private updateState(state: QuestNativeState): void {
    if (state.mode === this.state.mode && state.ready === this.state.ready) return;
    this.state = Object.freeze(state);
    for (const listener of this.stateListeners) listener(this.state);
  }

  cancelScene(reason: string): void {
    this.generation += 1;
    this.pending?.reject(new Error(reason));
  }

  private sendChunk(packet: NativeMessage & { session: string; sequence: number; index: number }): Promise<void> {
    return new Promise((resolve, reject) => {
      const finish = (error?: Error): void => {
        clearTimeout(deadline);
        if (this.pending === pending) this.pending = null;
        if (error) reject(error); else resolve();
      };
      const pending: PendingAck = {
        session: packet.session, sequence: packet.sequence, index: packet.index,
        resolve: () => finish(), reject: (error) => finish(error),
      };
      // A deadline is necessary: a suspended/crashed WebView/native consumer
      // must release frame backpressure instead of retaining resources forever.
      const deadline = setTimeout(() => {
        this.updateState({ ...this.state, ready: false });
        finish(new Error("Native scene acknowledgement timed out."));
      }, ACK_DEADLINE_MS);
      this.pending = pending;
      if (!this.post(packet)) finish(new Error("Native Quest bridge is unavailable."));
    });
  }

  async sendScene(envelope: QuestSceneEnvelope): Promise<void> {
    if (this.disposed) throw new Error("Native Quest bridge is disposed.");
    if (this.sending) throw new Error("A Quest scene is already in flight.");
    if (envelope.version !== 1 || envelope.type !== "scene" ||
        typeof envelope.session !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(envelope.session) ||
        !Number.isSafeInteger(envelope.sequence) || envelope.sequence < 0) {
      throw new Error("Invalid Quest scene identity.");
    }
    const chunks = splitQuestScene(JSON.stringify(envelope));
    this.sending = true;
    const generation = this.generation;
    try {
      for (let index = 0; index < chunks.length; index += 1) {
        if (generation !== this.generation) throw new Error("Quest scene transfer was cancelled.");
        await this.sendChunk({
          version: 1, type: "scene-chunk", session: envelope.session,
          sequence: envelope.sequence, index, count: chunks.length, data: chunks[index],
        });
      }
    } finally { this.sending = false; }
  }

  dispose(): void {
    this.disposed = true;
    this.cancelScene("Quest page closed.");
    if (this.port.onmessage === this.receive) this.port.onmessage = null;
    this.stateListeners.clear();
    this.messageListeners.clear();
  }
}

let client: QuestNativeBridge | null = null;
let currentPort: QuestWebMessagePort | undefined;
function getBridge(): QuestNativeBridge | null {
  const port = typeof window === "undefined" ? undefined : window.nh3dQuest;
  if (!port || typeof port.postMessage !== "function") return null;
  if (port !== currentPort) {
    client?.dispose();
    currentPort = port;
    client = new QuestNativeBridge(port);
  }
  return client;
}
export function isQuestNativeAvailable(): boolean { return getBridge() !== null; }
export function getQuestNativeState(): QuestNativeState { return getBridge()?.getState() ?? initialState; }
export function subscribeQuestNativeState(listener: (state: QuestNativeState) => void): () => void {
  return getBridge()?.subscribeState(listener) ?? (() => undefined);
}
export function subscribeQuestNativeMessages(listener: (message: NativeMessage) => void): () => void {
  return getBridge()?.subscribeMessage(listener) ?? (() => undefined);
}
export function postQuestNativeMessage(message: NativeMessage): boolean { return getBridge()?.post(message) ?? false; }
export function cancelQuestScene(reason: string): void { getBridge()?.cancelScene(reason); }
export function sendQuestScene(envelope: QuestSceneEnvelope): Promise<void> {
  return getBridge()?.sendScene(envelope) ?? Promise.reject(new Error("Native Quest bridge is unavailable."));
}
