import type {
  PlayerStatsSnapshot
} from "../../../game/ui-types";
import type {
  NethackRuntimeVersion
} from "../../../runtime/types";

/** Live run location, turn and message-delta helpers. */
export function normalizeTopScoreTimelineTurn(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

export function resolveTopScoreLiveLocationLabel(stats: PlayerStatsSnapshot): string {
  const locationLabel = String(stats.locationLabel ?? "").trim();
  if (locationLabel) {
    return locationLabel;
  }
  const dungeon = String(stats.dungeon ?? "").trim();
  const dungeonLevel =
    typeof stats.dlevel === "number" && Number.isFinite(stats.dlevel)
      ? Math.trunc(stats.dlevel)
      : null;
  if (dungeon && dungeonLevel !== null) {
    return `${dungeon} ${dungeonLevel}`;
  }
  if (dungeonLevel !== null) {
    return `Depth ${dungeonLevel}`;
  }
  return dungeon;
}

export function resolveTopScoreLiveLocationKey(
  stats: PlayerStatsSnapshot,
  runtimeVersion: NethackRuntimeVersion,
  locationLabel: string,
): string {
  const dungeonLevel =
    typeof stats.dlevel === "number" && Number.isFinite(stats.dlevel)
      ? Math.trunc(stats.dlevel)
      : null;
  if (runtimeVersion === "slashem" && dungeonLevel !== null) {
    return `slashem-depth:${dungeonLevel}`;
  }
  const dungeon = String(stats.dungeon ?? "").trim().toLowerCase();
  if (dungeon && dungeonLevel !== null) {
    return `${dungeon}:${dungeonLevel}`;
  }
  return String(locationLabel ?? "").trim().toLowerCase();
}

export function isTopScoreKillMessage(message: string): boolean {
  return /^you\s+(?:kill|destroy|defeat|dispatch|smite|slay|annihilate|murder|vaporize|disintegrate)\b/i.test(
    message,
  );
}

export function isTopScoreTrapEscapeMessage(message: string): boolean {
  return /^you\s+escape\b/i.test(message);
}

export function extractPrependedMessages(
  currentMessages: ReadonlyArray<string>,
  previousMessages: ReadonlyArray<string>,
): string[] {
  if (currentMessages.length <= 0) {
    return [];
  }
  if (previousMessages.length <= 0) {
    return [...currentMessages];
  }

  for (
    let prefixLength = 0;
    prefixLength <= currentMessages.length;
    prefixLength += 1
  ) {
    const overlapLength = Math.min(
      previousMessages.length,
      currentMessages.length - prefixLength,
    );
    let matches = true;
    for (let index = 0; index < overlapLength; index += 1) {
      if (currentMessages[prefixLength + index] !== previousMessages[index]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return currentMessages.slice(0, prefixLength);
    }
  }

  return [...currentMessages];
}
