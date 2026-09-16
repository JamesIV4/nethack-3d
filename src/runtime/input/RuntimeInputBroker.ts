export type InputSource = "user" | "synthetic" | "meta" | "system";

export type InputRequestKind = "event" | "position" | "menu";

export type InputTargetKinds = "any" | ReadonlyArray<InputRequestKind>;

export interface InputToken {
  commandId?: number;
  tokenIndex?: number;
  key: string;
  source: InputSource;
  createdAt: number;
  targetKinds?: InputTargetKinds;
  mouseX?: number;
  mouseY?: number;
  mouseMod?: number;
}

export interface PendingInputRequest {
  kind: InputRequestKind;
  createdAt: number;
  resolve: (result: InputConsumeResult) => void;
}

export interface InputConsumeResult {
  requestKind: InputRequestKind;
  token: InputToken | null;
  cancelled: boolean;
  cancelCode: number | null;
  consumedFromQueue: boolean;
}

export default class RuntimeInputBroker {
  private static readonly DEFAULT_MAX_QUEUE_SIZE = 256;

  private readonly queue: InputToken[] = [];

  private readonly pendingRequests: PendingInputRequest[] = [];

  private readonly maxQueueSize: number;

  constructor(maxQueueSize: number = RuntimeInputBroker.DEFAULT_MAX_QUEUE_SIZE,
    private readonly prepareToken: (token: InputToken) => InputToken = token => token) {
    const normalized =
      Number.isInteger(maxQueueSize) && maxQueueSize > 0
        ? maxQueueSize
        : RuntimeInputBroker.DEFAULT_MAX_QUEUE_SIZE;
    this.maxQueueSize = normalized;
  }

  enqueueTokens(tokens: InputToken[]): void {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return;
    }

    for (const rawToken of tokens) {
      const token = this.normalizeToken(rawToken);
      if (!token) {
        continue;
      }

      const pendingIndex = this.pendingRequests.findIndex((pending) =>
        this.canSatisfyRequest(token, pending.kind),
      );
      if (pendingIndex >= 0) {
        const [pending] = this.pendingRequests.splice(pendingIndex, 1);
        if (!pending) {
          continue;
        }
        pending.resolve({
          requestKind: pending.kind,
          token,
          cancelled: false,
          cancelCode: null,
          consumedFromQueue: false,
        });
        continue;
      }

      if (this.queue.length >= this.maxQueueSize) {
        console.log(
          `RuntimeInputBroker queue full (${this.maxQueueSize}); dropping input token "${token.key}"`,
        );
        continue;
      }
      this.queue.push(token);
    }
  }

  requestNext(
    requestKind: InputRequestKind,
  ): InputConsumeResult | Promise<InputConsumeResult> {
    const queuedIndex = this.queue.findIndex((token) =>
      this.canSatisfyRequest(token, requestKind),
    );
    if (queuedIndex >= 0) {
      const [queued] = this.queue.splice(queuedIndex, 1);
      return {
        requestKind,
        token: queued || null,
        cancelled: false,
        cancelCode: null,
        consumedFromQueue: true,
      };
    }

    return new Promise((resolve) => {
      this.pendingRequests.push({
        kind: requestKind,
        createdAt: Date.now(),
        resolve,
      });
    });
  }

  cancelAll(cancelCode: number): void {
    while (this.pendingRequests.length > 0) {
      const pending = this.pendingRequests.shift();
      if (!pending) {
        continue;
      }
      pending.resolve({
        requestKind: pending.kind,
        token: null,
        cancelled: true,
        cancelCode,
        consumedFromQueue: false,
      });
    }
  }

  drain(): InputToken[] {
    if (this.queue.length === 0) {
      return [];
    }
    const tokens = [...this.queue];
    this.queue.length = 0;
    return tokens;
  }

  dequeueToken(requestKind: InputRequestKind = "event"): InputToken | null {
    const queuedIndex = this.queue.findIndex((token) =>
      this.canSatisfyRequest(token, requestKind),
    );
    if (queuedIndex < 0) {
      return null;
    }
    const [queued] = this.queue.splice(queuedIndex, 1);
    return queued || null;
  }

  prependToken(token: InputToken): void {
    const normalizedToken = this.normalizeToken(token);
    if (!normalizedToken) {
      return;
    }
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.pop();
    }
    this.queue.unshift(normalizedToken);
  }

  hasPendingRequests(requestKind?: InputRequestKind): boolean {
    if (!requestKind) {
      return this.pendingRequests.length > 0;
    }
    return this.pendingRequests.some((pending) => pending.kind === requestKind);
  }

  private normalizeToken(token: InputToken | null | undefined): InputToken | null {
    if (!token || typeof token.key !== "string" || token.key.length === 0) {
      return null;
    }
    if (
      token.targetKinds !== undefined &&
      token.targetKinds !== "any" &&
      (!Array.isArray(token.targetKinds) || token.targetKinds.length === 0)
    ) {
      return this.prepareToken({
        ...token,
        targetKinds: "any",
      });
    }
    return this.prepareToken({
      ...token,
      targetKinds: token.targetKinds ?? "any",
    });
  }

  private canSatisfyRequest(
    token: InputToken,
    requestKind: InputRequestKind,
  ): boolean {
    const targetKinds = token.targetKinds ?? "any";
    if (targetKinds === "any") {
      return true;
    }
    return targetKinds.includes(requestKind);
  }
}
