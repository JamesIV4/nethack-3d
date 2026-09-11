import type {
  PlayerStatsSnapshot
} from "../../../game/ui-types";
import {
  defaultPlayerStats
} from "../../../state/gameStore";

/** Core stat tracking and module-time initial stat baselines. */
export type CoreStatKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma"
  | "armor";

export type CoreStatSnapshot = {
  turn: number;
  playerName: string;
  values: Record<CoreStatKey, number>;
};

export const trackedCoreStatKeys: CoreStatKey[] = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
  "armor",
];

export const getCoreStatValuesFromSnapshot = (
  stats: PlayerStatsSnapshot,
): Record<CoreStatKey, number> => ({
  strength: Number(stats.strength) || 0,
  dexterity: Number(stats.dexterity) || 0,
  constitution: Number(stats.constitution) || 0,
  intelligence: Number(stats.intelligence) || 0,
  wisdom: Number(stats.wisdom) || 0,
  charisma: Number(stats.charisma) || 0,
  armor: Number(stats.armor) || 0,
});

export const defaultCoreStatValues = getCoreStatValuesFromSnapshot(defaultPlayerStats);

export const defaultCoreStatBaselineTurn = Number.isFinite(defaultPlayerStats.time)
  ? Math.trunc(defaultPlayerStats.time)
  : 0;

export const defaultCoreStatBaselineName = String(defaultPlayerStats.name || "");

export const isBootstrapCoreStatSnapshot = (snapshot: CoreStatSnapshot): boolean => {
  if (snapshot.turn !== defaultCoreStatBaselineTurn) {
    return false;
  }
  if (snapshot.playerName !== defaultCoreStatBaselineName) {
    return false;
  }
  return trackedCoreStatKeys.every(
    (key) => snapshot.values[key] === defaultCoreStatValues[key],
  );
};
