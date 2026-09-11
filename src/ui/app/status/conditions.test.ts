import { describe, expect, it } from "vitest";

import type { PlayerStatsSnapshot } from "../../../game/ui-types";
import {
  buildPlayerStatusBadges,
  resolveCharacterStatusLineSeverity,
  resolveConditionStatusBadges,
  resolveConditionStatusLineSeverity,
  resolveEncumbranceStatusBadge,
  resolveHungerStatusBadge,
} from "./conditions";

const sampleStats: PlayerStatsSnapshot = {
  name: "Status test", hp: 10, maxHp: 10, power: 4, maxPower: 4,
  level: 1, experience: 0, strength: 10, dexterity: 10, constitution: 10,
  intelligence: 10, wisdom: 10, charisma: 10, armor: 10,
  dungeon: "Dungeons of Doom", dlevel: 1, gold: 0, alignment: "neutral",
  hunger: "", encumbrance: "", conditionMask: 0, time: 1, score: 0,
};

describe("runtime-specific player status presentation", () => {
  it("interprets the same condition bit according to its runtime", () => {
    // Bit 1 is petrification in 3.6.7, levitation in Slash'EM and bare hands in 5.0.
    expect(resolveConditionStatusBadges(1, "3.6.7")).toEqual([
      expect.objectContaining({ severity: "danger" }),
    ]);
    expect(resolveConditionStatusBadges(1, "slashem")).toEqual([
      expect.objectContaining({ severity: "good" }),
    ]);
    expect(resolveConditionStatusLineSeverity("You are levitating.", 1, "slashem"))
      .toBe("good");
    expect(resolveConditionStatusLineSeverity("You are levitating.", 1, "3.6.7"))
      .toBeNull();
    expect(resolveConditionStatusLineSeverity("You are turning to stone.", 1, "3.6.7"))
      .toBe("danger");
    expect(resolveConditionStatusLineSeverity("You are turning to stone.", 1, "5.0"))
      .toBeNull();
  });

  it("ignores malformed condition masks and bits absent from the runtime", () => {
    for (const mask of [undefined, null, "1", Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveConditionStatusBadges(mask, "3.6.7")).toEqual([]);
    }
    expect(resolveConditionStatusBadges(0x20000000, "3.6.7")).toEqual([]);
    expect(resolveConditionStatusBadges(0x20000000, "5.0")).toHaveLength(1);
  });

  it("distinguishes normal hunger, satiation and critical hunger", () => {
    expect(resolveHungerStatusBadge(" not hungry ")).toBeNull();
    expect(resolveHungerStatusBadge("Satiated")).toEqual({
      label: "Satiated", severity: "good",
    });
    expect(resolveHungerStatusBadge("Hungry")?.severity).toBe("warning");
    for (const label of ["Weak", "Fainting", "Fainted", "Starved"]) {
      expect(resolveHungerStatusBadge(label)?.severity).toBe("danger");
    }
  });

  it("keeps unencumbered separate from burdened and critical load", () => {
    expect(resolveEncumbranceStatusBadge("Unencumbered")?.severity).toBe("good");
    expect(resolveEncumbranceStatusBadge("Burdened")?.severity).toBe("warning");
    expect(resolveEncumbranceStatusBadge("Overloaded")?.severity).toBe("danger");
  });

  it("highlights only status lines whose condition is currently active", () => {
    const stats = {
      ...sampleStats,
      hunger: "Weak",
      encumbrance: "Burdened",
      conditionMask: 0x20,
    };
    expect(resolveCharacterStatusLineSeverity("  You are\n weak. ", stats, "3.6.7"))
      .toBe("danger");
    expect(resolveCharacterStatusLineSeverity("You are burdened.", stats, "3.6.7"))
      .toBe("warning");
    expect(resolveCharacterStatusLineSeverity("You are blind.", stats, "3.6.7"))
      .toBe("warning");
    expect(resolveCharacterStatusLineSeverity("You are stunned.", stats, "3.6.7"))
      .toBeNull();
    expect(resolveCharacterStatusLineSeverity("Your weakness has passed.", stats, "3.6.7"))
      .toBeNull();
  });

  it("keeps hunger then load then runtime-condition badge order", () => {
    const stats = {
      ...sampleStats,
      hunger: "Weak",
      encumbrance: "Burdened",
      conditionMask: 0x20,
    };
    expect(buildPlayerStatusBadges(stats, "3.6.7")).toEqual([
      { label: "Weak", severity: "danger" },
      { label: "Burdened", severity: "warning" },
      ...resolveConditionStatusBadges(0x20, "3.6.7"),
    ]);
  });
});
