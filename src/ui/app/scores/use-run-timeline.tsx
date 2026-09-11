import {
  useCallback,
  useEffect,
  useRef
} from "react";
import type { CharacterCreationConfig, PlayerStatsSnapshot, GameOverState, InventoryDialogState } from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";
import {
  supportsRuntimeTopScores
} from "../../../runtime/runtime-capabilities";
import {
  saveTopScoreDetailSnapshot,
  type TopScoreTimelineEvent
} from "../../../runtime/top-score-storage";
import type * as React from "react";
import {
  extractPrependedMessages,
  isTopScoreKillMessage,
  isTopScoreTrapEscapeMessage,
  normalizeTopScoreTimelineTurn,
  resolveTopScoreLiveLocationKey,
  resolveTopScoreLiveLocationLabel
} from "./live-timeline";
import {
  capitalizeFirstLetter
} from "../shared/text";

/** Capture gameplay status/message/death telemetry and persist scores */
export function useRunTimelineState() {
  const persistedTopScoreSignatureRef = useRef("");

  const persistedTopScoreSnapshotIdRef = useRef("");

  const topScoreTimelineEventsRef = useRef<TopScoreTimelineEvent[]>([]);

  const previousTopScoreTimelineStatsRef = useRef<PlayerStatsSnapshot | null>(
    null,
  );

  const previousTopScoreTimelineMessagesRef = useRef<string[]>([]);

  const seenTopScoreTimelineSignaturesRef = useRef<Set<string>>(new Set());

  const visitedTopScoreLocationsRef = useRef<Set<string>>(new Set());
  return {
    persistedTopScoreSignatureRef,
    persistedTopScoreSnapshotIdRef,
    topScoreTimelineEventsRef,
    previousTopScoreTimelineStatsRef,
    previousTopScoreTimelineMessagesRef,
    seenTopScoreTimelineSignaturesRef,
    visitedTopScoreLocationsRef,
  } as const;
}

export interface UseRunTimelineTrackingDependencies {
  readonly seenTopScoreTimelineSignaturesRef: React.MutableRefObject<Set<string>>;
  readonly topScoreTimelineEventsRef: React.MutableRefObject<TopScoreTimelineEvent[]>;
  readonly persistedTopScoreSignatureRef: React.MutableRefObject<string>;
  readonly persistedTopScoreSnapshotIdRef: React.MutableRefObject<string>;
  readonly previousTopScoreTimelineStatsRef: React.MutableRefObject<PlayerStatsSnapshot | null>;
  readonly previousTopScoreTimelineMessagesRef: React.MutableRefObject<string[]>;
  readonly visitedTopScoreLocationsRef: React.MutableRefObject<Set<string>>;
  readonly activeRuntimeVersion: NethackRuntimeVersion;
  readonly characterCreationConfig: CharacterCreationConfig | null;
  readonly playerStats: PlayerStatsSnapshot;
  readonly gameMessages: string[];
  readonly gameOver: GameOverState;
  readonly inventory: InventoryDialogState;
}

/** Capture gameplay status/message/death telemetry and persist scores */
export function useRunTimelineTracking(dependencies: UseRunTimelineTrackingDependencies) {
  const {
    seenTopScoreTimelineSignaturesRef,
    topScoreTimelineEventsRef,
    persistedTopScoreSignatureRef,
    persistedTopScoreSnapshotIdRef,
    previousTopScoreTimelineStatsRef,
    previousTopScoreTimelineMessagesRef,
    visitedTopScoreLocationsRef,
    activeRuntimeVersion,
    characterCreationConfig,
    playerStats,
    gameMessages,
    gameOver,
    inventory,
  } = dependencies;

  const appendTopScoreTimelineEvent = useCallback(
    (
      event: Omit<TopScoreTimelineEvent, "id"> & {
        id?: string | null | undefined;
      },
    ): void => {
      const turn = normalizeTopScoreTimelineTurn(event.turn);
      const label = String(event.label ?? "").trim();
      const summary = String(event.summary ?? "").trim();
      if (!label || !summary) {
        return;
      }

      const detail = String(event.detail ?? "").trim();
      const location = String(event.location ?? "").trim();
      const amount =
        typeof event.amount === "number" && Number.isFinite(event.amount)
          ? Math.trunc(event.amount)
          : undefined;
      const total =
        typeof event.total === "number" && Number.isFinite(event.total)
          ? Math.trunc(event.total)
          : undefined;
      const signature = [
        event.kind,
        turn,
        label.toLowerCase(),
        summary.toLowerCase(),
        detail.toLowerCase(),
        location.toLowerCase(),
        typeof amount === "number" ? String(amount) : "",
        typeof total === "number" ? String(total) : "",
      ].join("|");
      if (seenTopScoreTimelineSignaturesRef.current.has(signature)) {
        return;
      }
      seenTopScoreTimelineSignaturesRef.current.add(signature);

      const nextEvent: TopScoreTimelineEvent = {
        id:
          String(event.id ?? "").trim() ||
          `${event.kind}-${turn}-${topScoreTimelineEventsRef.current.length}`,
        turn,
        kind: event.kind,
        label,
        summary,
        detail: detail || undefined,
        amount,
        total,
        location: location || undefined,
      };
      topScoreTimelineEventsRef.current = [
        ...topScoreTimelineEventsRef.current,
        nextEvent,
      ].sort((left, right) => left.turn - right.turn || left.label.localeCompare(right.label));
    },
    [],
  );

  const resetTopScoreTimelineTracking = useCallback((): void => {
    persistedTopScoreSignatureRef.current = "";
    persistedTopScoreSnapshotIdRef.current = "";
    topScoreTimelineEventsRef.current = [];
    previousTopScoreTimelineStatsRef.current = null;
    previousTopScoreTimelineMessagesRef.current = [];
    seenTopScoreTimelineSignaturesRef.current = new Set();
    visitedTopScoreLocationsRef.current = new Set();
  }, []);

  const captureTopScoreTimelineFromPlayerStats = useCallback(
    (stats: PlayerStatsSnapshot): void => {
      const currentTurn = normalizeTopScoreTimelineTurn(stats.time);
      const playerName = String(stats.name ?? "").trim();
      const currentLocation = resolveTopScoreLiveLocationLabel(stats);
      const previousStats = previousTopScoreTimelineStatsRef.current;

      const rememberLocation = (): void => {
        if (!currentLocation) {
          return;
        }
        const locationKey = resolveTopScoreLiveLocationKey(
          stats,
          activeRuntimeVersion,
          currentLocation,
        );
        if (visitedTopScoreLocationsRef.current.has(locationKey)) {
          return;
        }
        visitedTopScoreLocationsRef.current.add(locationKey);
        appendTopScoreTimelineEvent({
          turn: currentTurn,
          kind: "location",
          label: "Reached new depth",
          summary: `Reached ${currentLocation}.`,
          location: currentLocation,
        });
      };

      if (
        !previousStats ||
        playerName !== String(previousStats.name ?? "").trim() ||
        currentTurn < normalizeTopScoreTimelineTurn(previousStats.time)
      ) {
        rememberLocation();
        previousTopScoreTimelineStatsRef.current = { ...stats };
        return;
      }

      rememberLocation();

      const goldDelta = Math.trunc(stats.gold - previousStats.gold);
      if (goldDelta > 0) {
        appendTopScoreTimelineEvent({
          turn: currentTurn,
          kind: "gold",
          label: `+${goldDelta} gold`,
          summary:
            goldDelta === 1
              ? "Picked up 1 gold piece."
              : `Picked up ${goldDelta} gold pieces.`,
          amount: goldDelta,
          total: stats.gold,
          location: currentLocation || undefined,
        });
      }

      if (stats.level !== previousStats.level) {
        const levelValue = Math.max(1, Math.trunc(stats.level));
        const previousLevelValue = Math.max(1, Math.trunc(previousStats.level));
        const levelDelta = levelValue - previousLevelValue;
        appendTopScoreTimelineEvent({
          turn: currentTurn,
          kind: "experience-level",
          label: `Level ${levelValue}`,
          summary:
            stats.level > previousStats.level
              ? `Reached experience level ${levelValue}.`
              : `Slipped to experience level ${levelValue}.`,
          amount: levelDelta,
          total: levelValue,
          detail: currentLocation || undefined,
          location: currentLocation || undefined,
        });
      }

      previousTopScoreTimelineStatsRef.current = { ...stats };
    },
    [activeRuntimeVersion, appendTopScoreTimelineEvent],
  );

  const captureTopScoreTimelineFromMessages = useCallback(
    (
      messages: ReadonlyArray<string>,
      turn: number,
      location: string,
    ): void => {
      const normalizedMessages = messages
        .map((message) => String(message ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const newMessages = extractPrependedMessages(
        normalizedMessages,
        previousTopScoreTimelineMessagesRef.current,
      );
      previousTopScoreTimelineMessagesRef.current = normalizedMessages;

      for (const message of [...newMessages].reverse()) {
        if (isTopScoreTrapEscapeMessage(message)) {
          appendTopScoreTimelineEvent({
            turn,
            kind: "escape",
            label: "Escaped",
            summary: capitalizeFirstLetter(message),
            detail: location || undefined,
            location: location || undefined,
          });
        }
        if (isTopScoreKillMessage(message)) {
          appendTopScoreTimelineEvent({
            turn,
            kind: "kill",
            label: "Enemy defeated",
            summary: capitalizeFirstLetter(message),
            detail: location || undefined,
            location: location || undefined,
          });
        }
      }
    },
    [appendTopScoreTimelineEvent],
  );

  const captureTopScoreTimelineDeath = useCallback(
    (turn: number, deathMessage: string | null | undefined, location: string): void => {
      const summary =
        capitalizeFirstLetter(String(deathMessage ?? "").trim()) || "Run ended.";
      appendTopScoreTimelineEvent({
        turn,
        kind: "death",
        label: "Run ended",
        summary,
        location: location || undefined,
      });
    },
    [appendTopScoreTimelineEvent],
  );

  useEffect(() => {
    resetTopScoreTimelineTracking();
  }, [activeRuntimeVersion, characterCreationConfig, resetTopScoreTimelineTracking]);

  useEffect(() => {
    if (
      !supportsRuntimeTopScores(activeRuntimeVersion) ||
      !characterCreationConfig
    ) {
      return;
    }
    captureTopScoreTimelineFromPlayerStats(playerStats);
  }, [
    activeRuntimeVersion,
    captureTopScoreTimelineFromPlayerStats,
    characterCreationConfig,
    playerStats,
  ]);

  useEffect(() => {
    if (
      !supportsRuntimeTopScores(activeRuntimeVersion) ||
      !characterCreationConfig
    ) {
      return;
    }
    captureTopScoreTimelineFromMessages(
      gameMessages,
      normalizeTopScoreTimelineTurn(playerStats.time),
      resolveTopScoreLiveLocationLabel(playerStats),
    );
  }, [
    activeRuntimeVersion,
    captureTopScoreTimelineFromMessages,
    characterCreationConfig,
    gameMessages,
    playerStats,
  ]);

  useEffect(() => {
    if (
      !supportsRuntimeTopScores(activeRuntimeVersion) ||
      !gameOver.active ||
      !gameOver.promptReady
    ) {
      return;
    }

    const signature = JSON.stringify([
      activeRuntimeVersion,
      playerStats.name,
      playerStats.score,
      playerStats.time,
      gameOver.deathMessage ?? "",
      gameOver.telemetry ?? null,
      gameOver.postmortemReports ?? null,
    ]);
    if (persistedTopScoreSignatureRef.current === signature) {
      return;
    }
    persistedTopScoreSignatureRef.current = signature;

    const currentTurn = normalizeTopScoreTimelineTurn(playerStats.time);
    const currentLocation = resolveTopScoreLiveLocationLabel(playerStats);
    captureTopScoreTimelineFromPlayerStats(playerStats);
    captureTopScoreTimelineFromMessages(
      gameMessages,
      currentTurn,
      currentLocation,
    );
    captureTopScoreTimelineDeath(
      currentTurn,
      gameOver.deathMessage,
      currentLocation,
    );

    void (async () => {
      try {
        const snapshotId = await saveTopScoreDetailSnapshot({
          id: persistedTopScoreSnapshotIdRef.current || undefined,
          runtimeVersion: activeRuntimeVersion,
          playerStats,
          inventoryItems: inventory.items,
          timeline: topScoreTimelineEventsRef.current,
          deathMessage: gameOver.deathMessage,
          tombstoneLines: gameOver.tombstoneLines,
          telemetry: gameOver.telemetry,
          postmortemReports: gameOver.postmortemReports,
        });
        if (snapshotId) {
          persistedTopScoreSnapshotIdRef.current = snapshotId;
        }
      } catch (error) {
        console.warn("Failed to save top score detail snapshot:", error);
      }
    })();
  }, [
    activeRuntimeVersion,
    captureTopScoreTimelineDeath,
    captureTopScoreTimelineFromMessages,
    captureTopScoreTimelineFromPlayerStats,
    gameOver.active,
    gameOver.deathMessage,
    gameOver.postmortemReports,
    gameOver.promptReady,
    gameOver.telemetry,
    gameOver.tombstoneLines,
    gameMessages,
    inventory.items,
    playerStats,
  ]);

}
