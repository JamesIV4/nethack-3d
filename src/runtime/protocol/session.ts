import type { RuntimeEvent } from "../types";
import type { InputToken } from "../input/RuntimeInputBroker";
import type {
  RuntimeCommandIdentity,
  RuntimeInputPurpose,
  RuntimeLevelIdentity,
  RuntimeObservationScope,
} from "./types";

const purposes: Record<string, RuntimeInputPurpose> = {
  shim_nh_poskey: "command-or-position",
  shim_nhgetch: "command-or-position",
  shim_yn_function: "question",
  shim_select_menu: "menu",
  shim_getlin: "text",
  shim_get_ext_cmd: "extended-command",
  shim_display_nhwindow: "unknown",
  shim_display_file: "unknown",
};
const promptEvents = new Set([
  "question",
  "direction_question",
  "info_menu",
  "text_request",
  "position_request",
]);

interface Wait {
  id: number;
  callback: string;
  purpose: RuntimeInputPurpose;
  consumed: boolean;
  prompts: RuntimeEvent[];
}

/** Observes the existing wait/queue owners; it is not another input queue. */
export class RuntimeProtocolSession {
  private nextWait = 0;
  private callback: Wait | null = null;
  private readonly waits = new Map<number, Wait>();
  private readonly promiseWaits = new WeakMap<object, Wait>();
  private command: (RuntimeCommandIdentity & { nextToken: number }) | null = null;
  private lastLevelKey: string | null = null;
  private levelNeedsMapCheck = true;
  scope: RuntimeObservationScope = {
    presentationGeneration: 0,
    levelGeneration: 0,
    level: null,
  };

  constructor(
    readonly enabled: boolean,
    private readonly emitRaw: (event: RuntimeEvent) => void,
    private readonly readLevel: () => RuntimeLevelIdentity | null = readRuntimeLevelIdentity,
  ) {}

  tracksCallback(name: string): boolean {
    return this.enabled && Object.prototype.hasOwnProperty.call(purposes, name);
  }

  invokeCallback(name: string, invoke: () => unknown): unknown {
    const previous = this.callback;
    const wait: Wait = {
      id: ++this.nextWait,
      callback: name,
      purpose: purposes[name] ?? "unknown",
      consumed: false,
      prompts: [],
    };
    this.callback = wait;
    try {
      const result = invoke();
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        const sharedWait = this.promiseWaits.get(result as object);
        if (sharedWait) {
          // Same-kind input calls deliberately reuse the existing Promise.
          for (const prompt of wait.prompts) {
            this.emitRaw(promptEvents.has(prompt.type) ? { ...prompt, inputRequestId: sharedWait.id } : prompt);
          }
          return result;
        }
        this.promiseWaits.set(result as object, wait);
        this.waits.set(wait.id, wait);
        this.emitRaw({
          type: "input_wait",
          requestId: wait.id,
          callback: name,
          purpose: wait.purpose,
          state: "waiting",
        });
        for (const prompt of wait.prompts) {
          this.emitRaw(promptEvents.has(prompt.type) ? { ...prompt, inputRequestId: wait.id } : prompt);
        }
        // Observe completion without wrapping/replacing the owner's Promise.
        void (result as Promise<unknown>).then(
          () => this.closeWait(wait, wait.consumed ? "consumed" : "cancelled"),
          () => this.closeWait(wait, "cancelled"),
        );
      } else {
        // Synchronous prompts (for example startup name notices) are not waits.
        for (const prompt of wait.prompts) this.emitRaw(prompt);
      }
      return result;
    } finally {
      this.callback = previous;
    }
  }

  private closeWait(wait: Wait, state: "consumed" | "cancelled"): void {
    if (!this.waits.delete(wait.id)) return;
    this.emitRaw({
      type: "input_wait",
      requestId: wait.id,
      callback: wait.callback,
      purpose: wait.purpose,
      state,
    });
  }

  publish(event: RuntimeEvent): void {
    if (this.enabled) {
      const isMapObservation = event.type === "map_glyph" || event.type === "map_glyph_batch";
      const shouldReadLevel =
        this.scope.level === null ||
        event.type === "clear_scene" ||
        event.type === "player_position" ||
        (isMapObservation && this.levelNeedsMapCheck);
      if (event.type === "clear_scene") this.levelNeedsMapCheck = true;
      if (shouldReadLevel) {
        const level = this.readLevel();
        const key = level ? `${level.dnum}:${level.dlevel}` : null;
        if (key !== null && key !== this.lastLevelKey) {
          this.lastLevelKey = key;
          this.scope = {
            ...this.scope,
            levelGeneration: this.scope.levelGeneration + 1,
          };
        }
        this.scope = { ...this.scope, level };
      }
      if (isMapObservation || event.type === "player_position") this.levelNeedsMapCheck = false;
      this.scope = {
        ...this.scope,
        presentationGeneration:
          this.scope.presentationGeneration + (event.type === "clear_scene" ? 1 : 0),
      };
    }
    // Once a prompt is held for its wait identity, later observations in this
    // callback must follow it. Holding only the prompt would reorder messages.
    if (this.enabled && this.callback && (promptEvents.has(event.type) || this.callback.prompts.length > 0)) {
      this.callback.prompts.push(structuredClone(event));
      return;
    }
    this.emitRaw(event);
  }

  dispatchCommand(
    identity: RuntimeCommandIdentity | undefined,
    dispatch: () => void,
  ): boolean {
    if (!this.enabled || !identity) {
      dispatch();
      return true;
    }
    if (identity.requestId !== undefined) {
      const wait = this.waits.get(identity.requestId);
      if (!wait || wait.consumed) {
        this.emitRaw({
          type: "command_result",
          commandId: identity.commandId,
          status: "rejected",
          reason: "input-request-closed",
          requestId: identity.requestId,
        });
        return false;
      }
    }
    const previous = this.command;
    this.command = { ...identity, nextToken: 0 };
    this.emitRaw({
      type: "command_result",
      commandId: identity.commandId,
      status: "received",
    });
    try {
      dispatch();
      return true;
    } finally {
      this.command = previous;
    }
  }

  tagToken(token: InputToken): InputToken {
    if (!this.command || token.commandId !== undefined) return token;
    return {
      ...token,
      commandId: this.command.commandId,
      tokenIndex: this.command.nextToken++,
    };
  }

  consumed(token?: InputToken, callbacks?: readonly string[]): void {
    if (!this.enabled) return;
    const matches = (wait: Wait): boolean =>
      !wait.consumed && (!callbacks || callbacks.includes(wait.callback));
    const wait = this.callback && matches(this.callback)
      ? this.callback
      : Array.from(this.waits.values()).find(matches);
    if (wait) wait.consumed = true;
    const commandId = token?.commandId ?? this.command?.commandId;
    if (commandId !== undefined) {
      this.emitRaw({
        type: "input_consumed",
        commandId,
        ...(token?.tokenIndex !== undefined ? { tokenIndex: token.tokenIndex } : {}),
        requestId: wait?.id ?? null,
      });
    }
  }

  cancelWait(callbacks?: readonly string[]): void {
    if (!this.enabled) return;
    const matches = (wait: Wait): boolean =>
      !callbacks || callbacks.includes(wait.callback);
    const wait = this.callback && matches(this.callback)
      ? this.callback
      : Array.from(this.waits.values()).find(matches);
    if (wait) this.closeWait(wait, "cancelled");
  }

  boundary(reason: string): void {
    if (this.enabled) this.publish({ type: "runtime_boundary", reason });
  }

  shutdown(): void {
    for (const wait of [...this.waits.values()]) {
      this.closeWait(wait, "cancelled");
    }
  }
}

/** Read exported values only; this does not invoke or re-enter WASM helpers. */
export function readRuntimeLevelIdentity(): RuntimeLevelIdentity | null {
  try {
    const globals = (
      globalThis as typeof globalThis & { nethackGlobal?: { globals?: any } }
    ).nethackGlobal?.globals;
    const level = (globals?.u ?? globals?.g?.u)?.uz;
    return Number.isSafeInteger(level?.dnum) &&
      level.dnum >= 0 &&
      Number.isSafeInteger(level?.dlevel) &&
      level.dlevel > 0
      ? { dnum: level.dnum, dlevel: level.dlevel }
      : null;
  } catch {
    return null;
  }
}
