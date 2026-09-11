import { describe, expect, it } from "vitest";
import type { PlayerStatsSnapshot } from "../../../game/ui-types";
import { extractPrependedMessages, resolveTopScoreLiveLocationKey, resolveTopScoreLiveLocationLabel } from "./live-timeline";

const sampleStats: PlayerStatsSnapshot = {
  name: "Timeline test", hp: 10, maxHp: 10, power: 4, maxPower: 4,
  level: 1, experience: 0, strength: 10, dexterity: 10, constitution: 10,
  intelligence: 10, wisdom: 10, charisma: 10, armor: 10,
  dungeon: "Dungeons of Doom", dlevel: 1, gold: 0, alignment: "neutral",
  hunger: "", encumbrance: "", conditionMask: 0, time: 1, score: 0,
};

describe("live score timeline capture", () => {
  it("captures only newly prepended messages when the history drops its oldest entries", () => {
    expect(extractPrependedMessages(["new", "recent", "old"], ["recent", "old", "oldest"])).toEqual(["new"]);
    expect(extractPrependedMessages(["recent", "old"], ["recent", "old"])).toEqual([]);
  });

  it("handles repeated messages without recording the overlapping history again", () => {
    expect(extractPrependedMessages(["hit", "hit", "wait"], ["hit", "wait", "old"])).toEqual(["hit"]);
  });

  it("captures a replacement history and copies the initial history", () => {
    expect(extractPrependedMessages(["new", "newer"], ["old", "older"])).toEqual(["new", "newer"]);
    const initial = ["start"];
    expect(extractPrependedMessages(initial, [])).toEqual(initial);
    expect(extractPrependedMessages(initial, [])).not.toBe(initial);
    expect(extractPrependedMessages([], initial)).toEqual([]);
  });

  it("deduplicates SLASH-EM location label changes by depth while keeping branches distinct in NetHack", () => {
    const dungeon = { ...sampleStats, dungeon: "Dungeons of Doom", dlevel: 3, locationLabel: "Dlvl:3" };
    const mines = { ...dungeon, dungeon: "Gnomish Mines", locationLabel: "Mines:3" };
    expect(resolveTopScoreLiveLocationKey(dungeon, "slashem", dungeon.locationLabel))
      .toBe(resolveTopScoreLiveLocationKey(mines, "slashem", mines.locationLabel));
    expect(resolveTopScoreLiveLocationKey(dungeon, "3.6.7", dungeon.locationLabel))
      .not.toBe(resolveTopScoreLiveLocationKey(mines, "3.6.7", mines.locationLabel));
    expect(resolveTopScoreLiveLocationLabel(dungeon)).toBe("Dlvl:3");
    expect(resolveTopScoreLiveLocationLabel({ ...dungeon, locationLabel: "" })).toBe("Dungeons of Doom 3");
  });
});
