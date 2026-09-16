/**
 * Persists the player's intended Quest presentation separately from the
 * short-lived WebXR session.  A headset suspend ends a session, but it must
 * not turn an intentional immersive choice into a request for flat mode.
 */
export type QuestDesiredPresentationMode = "flat" | "immersive";

export interface QuestPresentationModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface QuestResumeModeDependencies {
  readonly storage?: QuestPresentationModeStorage | null;
  /** The caller supplies the document visibility so this remains DOM-free. */
  readonly isVisible: () => boolean;
  /** True only after the renderer has an active immersive session. */
  readonly isImmersiveActive: () => boolean;
  /** Starts one immersive session. It may reject when the headset is unavailable. */
  readonly enterImmersive: () => Promise<void>;
  /** Ends an active immersive session after an explicit Flat/Exit VR choice. */
  readonly exitImmersive: () => Promise<void>;
}

export const QUEST_DESIRED_PRESENTATION_MODE_KEY = "nh3d-quest-desired-presentation-mode";

function readDesiredMode(storage: QuestPresentationModeStorage | null | undefined): QuestDesiredPresentationMode {
  try {
    return storage?.getItem(QUEST_DESIRED_PRESENTATION_MODE_KEY) === "flat" ? "flat" : "immersive";
  } catch {
    // Private browsing or a process being torn down must not block Quest launch.
    return "immersive";
  }
}

/**
 * Queues mode transitions so visibility/device notifications cannot request
 * overlapping XR sessions.  It deliberately has no timer or self-retry: a
 * later visibility resume is the bounded retry trigger.
 */
export class QuestResumeMode {
  private desiredMode: QuestDesiredPresentationMode;
  private tail: Promise<void> = Promise.resolve();
  // Some runtimes surface `visible` before their old XR session's `end` event.
  // Keep one token for that ordering, never an open-ended re-entry loop.
  private retryAfterVisibleSessionEnd = false;

  constructor(private readonly dependencies: QuestResumeModeDependencies) {
    this.desiredMode = readDesiredMode(dependencies.storage);
  }

  get desired(): QuestDesiredPresentationMode { return this.desiredMode; }

  /** Call only for a player action that chooses Enter VR. */
  chooseImmersive(): Promise<void> {
    this.setDesired("immersive");
    return this.enqueue(() => this.resumeIfNeeded());
  }

  /** Call before ending a session for a player action that chooses Exit VR. */
  chooseFlat(): Promise<void> {
    this.setDesired("flat");
    this.retryAfterVisibleSessionEnd = false;
    return this.enqueue(async () => {
      if (this.dependencies.isImmersiveActive()) await this.dependencies.exitImmersive();
    });
  }

  /**
   * A session end caused by suspend/headset removal is temporary.  Do not
   * write flat here. A visible lifecycle event retries; if it arrives first,
   * the one token above retries after this end event instead.
   */
  onSessionEnded(): Promise<void> {
    if (!this.retryAfterVisibleSessionEnd) return Promise.resolve();
    this.retryAfterVisibleSessionEnd = false;
    return this.enqueue(() => this.resumeIfNeeded());
  }

  /**
   * Dedicated Gecko host entry does not require a DOM user gesture.  The
   * integration should call this for visibilitychange -> visible only there.
   */
  onVisibilityResume(): Promise<void> {
    this.retryAfterVisibleSessionEnd = this.desiredMode === "immersive" && this.dependencies.isImmersiveActive();
    return this.enqueue(() => this.resumeIfNeeded());
  }

  private setDesired(mode: QuestDesiredPresentationMode): void {
    this.desiredMode = mode;
    try { this.dependencies.storage?.setItem(QUEST_DESIRED_PRESENTATION_MODE_KEY, mode); } catch {
      // Keep the current page's deliberate choice even if persistent storage fails.
    }
  }

  private resumeIfNeeded(): Promise<void> | void {
    if (this.desiredMode !== "immersive" || !this.dependencies.isVisible() || this.dependencies.isImmersiveActive()) return;
    return this.dependencies.enterImmersive();
  }

  private enqueue(action: () => Promise<void> | void): Promise<void> {
    const next = this.tail.then(action, action);
    // Keep later transitions usable after a rejected requestSession call while
    // still returning that failure to an explicit caller.
    this.tail = next.catch(() => undefined);
    return next;
  }
}
