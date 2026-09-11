// @ts-nocheck
// Legacy dynamic WASM integration; dependency membership is checked by assembly.

import type { RuntimeCoordinator } from "../runtime-coordinator";
import type { RuntimeMemory } from "../abi/memory";
import type { RuntimePointerContract } from "../abi/pointer-contract";
import type { RuntimeKeyboardInput } from "./keyboard";
import type { RuntimeTileRefresh } from "../world/tile-refresh";
import type { RuntimePromptContext } from "../messages/prompt-context";

export interface RuntimeTextInputDependencies {
  readonly coordinator: Pick<
    RuntimeCoordinator,
    "emit"
    | "eventHandler"
    | "nethackModule"
  >;
  readonly keyboardInput: Pick<
    RuntimeKeyboardInput,
    "isCtrlInput"
    | "isMetaInput"
  >;
  readonly memory: Pick<
    RuntimeMemory,
    "normalizeWasmPointer"
  >;
  readonly pointerContract: Pick<
    RuntimePointerContract,
    "getRuntimePointerContract"
    | "notePointerContractViolation"
  >;
  readonly promptContext: Pick<
    RuntimePromptContext,
    "getGetlinPromptContextMessage"
  >;
  readonly tileRefresh: Pick<
    RuntimeTileRefresh,
    "maybeFlushDeferredTileRefreshes"
  >;
}

/** Literal text and stdin queues, text-buffer encoding and getlin request lifecycle. */
export class RuntimeTextInput {
  declare pendingTextResponses: any[];
  declare pendingStdinByteQueue: any[];
  declare pendingTextRequest: any;
  declare textInputPrefix: string;
  declare textInputMaxLength: number;

  constructor(private readonly deps: RuntimeTextInputDependencies) {
    this.pendingTextResponses = [];
    this.pendingStdinByteQueue = [];
    this.textInputPrefix = "__TEXT_INPUT__:";
    this.pendingTextRequest = null;
    this.textInputMaxLength = 256;
  }

  queueStdinTextInput(text, reason = "runtime") {
    const normalized = typeof text === "string" ? text : String(text ?? "");
    if (!normalized) {
      return;
    }
    const bytes = [];
    for (const ch of normalized) {
      bytes.push(ch.charCodeAt(0) & 0xff);
    }
    if (bytes.length <= 0) {
      return;
    }
    this.pendingStdinByteQueue.push(...bytes);
    console.log(
      `Queued ${bytes.length} stdin byte(s) for ${reason} (queue=${this.pendingStdinByteQueue.length})`,
    );
  }

  consumeStdinByte() {
    if (
      !Array.isArray(this.pendingStdinByteQueue) ||
      this.pendingStdinByteQueue.length <= 0
    ) {
      return null;
    }
    const next = this.pendingStdinByteQueue.shift();
    if (typeof next !== "number" || !Number.isFinite(next)) {
      return null;
    }
    return Math.max(0, Math.min(255, Math.trunc(next)));
  }

  resolveTextInputBufferPointer(ptr) {
    if (!this.deps.coordinator.nethackModule) {
      return null;
    }

    const resolvedPtr = this.deps.memory.normalizeWasmPointer(ptr, {
      label: "shim_getlin_buffer_ptr",
      minBytes: 1,
      alignment: 1,
    });
    if (!resolvedPtr) {
      console.log(
        `Unable to resolve getlin buffer pointer (raw=${ptr})`,
      );
      return null;
    }

    const callbackMode =
      this.deps.pointerContract.getRuntimePointerContract()?.callbackModes?.shim_getlin || null;
    if (callbackMode && callbackMode.pointerArgsAreDirect !== true) {
      this.deps.pointerContract.notePointerContractViolation(
        "getlin-mode",
        "shim_getlin pointer mode is not configured as direct pointers.",
      );
      return null;
    }

    // Pointer contract: winshim.c exposes shim_getlin as "vsp"; local_callback
    // forwards "p" arguments as raw pointer values (direct writable char*).
    return resolvedPtr;
  }

  isLikelyNameInputForDebug(input) {
    const trimmed = String(input || "").trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      return false;
    }
    if (trimmed.startsWith("__") || trimmed.includes(":")) {
      return false;
    }
    return /^[A-Za-z][A-Za-z0-9 _'-]*$/.test(trimmed);
  }

  isLiteralTextInput(input) {
    if (typeof input !== "string" || input.length <= 1) {
      return false;
    }
    if (this.deps.keyboardInput.isMetaInput(input)) {
      return false;
    }
    if (this.deps.keyboardInput.isCtrlInput(input)) {
      return false;
    }

    const nonTextInputs = new Set([
      "Enter",
      "Escape",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Numpad1",
      "Numpad2",
      "Numpad3",
      "Numpad4",
      "Numpad5",
      "Numpad6",
      "Numpad7",
      "Numpad8",
      "Numpad9",
      "NumpadDecimal",
      "Backspace",
      "Space",
      "Spacebar",
      "Tab",
      "Insert",
      "Delete",
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12",
    ]);

    return !nonTextInputs.has(input);
  }

  isTextInputCommand(input) {
    return typeof input === "string" && input.startsWith(this.textInputPrefix);
  }

  handleTextInputResponse(text, source = "user") {
    const normalized = typeof text === "string" ? text : String(text ?? "");
    if (this.pendingTextRequest) {
      const pending = this.pendingTextRequest;
      this.pendingTextRequest = null;
      this.writeTextInputBuffer(
        pending.bufferPtr,
        normalized,
        pending.maxLength,
      );
      if (typeof pending.resolve === "function") {
        pending.resolve(0);
      }
      this.deps.tileRefresh.maybeFlushDeferredTileRefreshes();
      return;
    }

    if (normalized.length === 0) {
      return;
    }

    const queueBefore = this.pendingTextResponses.length;
    this.pendingTextResponses.push(normalized);
    console.log(`Queued text response input: "${normalized}"`, {
      source,
      queueBefore,
      queueAfter: this.pendingTextResponses.length,
      isLikelyNameInput: this.isLikelyNameInputForDebug(normalized),
    });
  }

  writeTextInputBuffer(bufferPtr, text, maxLength = 256) {
    if (!this.deps.coordinator.nethackModule || !bufferPtr) {
      return;
    }
    const normalizedBufferPtr = Math.trunc(Number(bufferPtr));
    if (!Number.isFinite(normalizedBufferPtr) || normalizedBufferPtr <= 0) {
      return;
    }
    const safeText = typeof text === "string" ? text : String(text ?? "");
    const limit = Math.max(1, Math.floor(maxLength));
    const truncated = safeText.slice(0, Math.max(0, limit - 1));

    let bytes = null;
    if (typeof TextEncoder !== "undefined") {
      bytes = new TextEncoder().encode(truncated);
    } else {
      const encoded = unescape(encodeURIComponent(truncated));
      const legacyBytes = new Uint8Array(encoded.length);
      for (let i = 0; i < encoded.length; i += 1) {
        legacyBytes[i] = encoded.charCodeAt(i);
      }
      bytes = legacyBytes;
    }

    const heap = this.deps.coordinator.nethackModule.HEAPU8;
    if (!heap || normalizedBufferPtr + 1 > heap.length) {
      if (typeof this.deps.coordinator.nethackModule.setValue !== "function") {
        return;
      }
      try {
        const maxBytes = Math.max(0, limit - 1);
        const writeLength = Math.min(bytes.length, maxBytes);
        for (let i = 0; i < writeLength; i += 1) {
          this.deps.coordinator.nethackModule.setValue(
            normalizedBufferPtr + i,
            bytes[i],
            "i8",
          );
        }
        this.deps.coordinator.nethackModule.setValue(normalizedBufferPtr + writeLength, 0, "i8");
      } catch (error) {
        console.log(
          `Text input pointer write fallback failed at ${normalizedBufferPtr}:`,
          error,
        );
      }
      return;
    }
    const maxBytes = Math.max(0, limit - 1);
    const available = Math.max(0, heap.length - normalizedBufferPtr - 1);
    const length = Math.min(bytes.length, maxBytes, available);
    if (length > 0) {
      heap.set(bytes.slice(0, length), normalizedBufferPtr);
    }
    heap[normalizedBufferPtr + length] = 0;
  }

  handleShimGetlin(args) {
    const [question, bufferPtr] = args;
    const normalizedQuestion =
      typeof question === "string" ? question : String(question ?? "");
    const promptContextMessage =
      this.deps.promptContext.getGetlinPromptContextMessage(normalizedQuestion);
    console.log(`Text input requested: "${normalizedQuestion}"`);
    if (promptContextMessage) {
      console.log(
        `Text input context for Call prompt: "${promptContextMessage}"`,
      );
    }
    const resolvedBufferPtr = this.resolveTextInputBufferPointer(bufferPtr);
    if (!resolvedBufferPtr) {
      console.log(
        `Unable to resolve getlin buffer pointer (raw=${bufferPtr}); returning empty response`,
      );
      return 0;
    }

    if (this.pendingTextResponses.length > 0) {
      const queued = String(this.pendingTextResponses.shift() || "");
      this.writeTextInputBuffer(
        resolvedBufferPtr,
        queued,
        this.textInputMaxLength,
      );
      return 0;
    }

    if (!this.deps.coordinator.eventHandler) {
      this.writeTextInputBuffer(resolvedBufferPtr, "", this.textInputMaxLength);
      return 0;
    }

    if (this.pendingTextRequest) {
      this.handleTextInputResponse("\x1b", "system");
    }

    this.deps.coordinator.emit({
      type: "text_request",
      text: normalizedQuestion,
      contextMessage: promptContextMessage || undefined,
      maxLength: this.textInputMaxLength,
    });

    return new Promise((resolve) => {
      this.pendingTextRequest = {
        bufferPtr: resolvedBufferPtr,
        resolve,
        maxLength: this.textInputMaxLength,
      };
    });
  }
}
