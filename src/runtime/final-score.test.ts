import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseFinalScoreSummary } from "./final-score";
import LocalNetHackRuntime from "./LocalNetHackRuntime";
import { RuntimeBootstrap } from "./local/startup/bootstrap";
import type { RuntimeSystems } from "./local/create-runtime-systems";
import type { RuntimeEvent } from "./types";

it.each([
  [["You died in Sokoban on dungeon level 6 with 42100 points,"], 42100],
  [["You died in The Dungeons of Doom on dungeon level 2", "with 1 point,"], 1],
  [["You escaped from the dungeon with 42,100 points,"], 42100],
  [["You and Fido", "went to your reward with 1234567 points,"], 1234567],
  [["You quit with 0 points,"], 0],
  [["You were level 11 with a maximum of 79 hit points when you died."], null],
  [["an artifact (worth 400 gold pieces and 1000 points)"], null],
  [["a - a dagger named with 999999 points"], null],
] as const)("reads the final summary %j", (lines, expected) => {
  expect(parseFinalScoreSummary(lines)).toBe(expected);
});

describe("runtime final score capture", () => {
  let runtime: LocalNetHackRuntime;
  let systems: RuntimeSystems;
  let events: RuntimeEvent[];
  beforeEach(() => {
    vi.spyOn(RuntimeBootstrap.prototype, "initializeNetHack").mockResolvedValue(undefined);
    vi.spyOn(console, "log").mockImplementation(() => {});
    events = [];
    runtime = new LocalNetHackRuntime(event => events.push(event));
    systems = (runtime as unknown as { systems: RuntimeSystems }).systems;
  });
  afterEach(() => { runtime.shutdown("test complete"); vi.restoreAllMocks(); });

  it.each(["3.6.7", "5.0", "slashem"] as const)("captures %s summary points even when a death line precedes them", version => {
    runtime.runtimeVersion = version;
    systems.gameOver.beginGameOverSequence("possessions-question");
    for (const text of ["Goodbye Alan18 the Rogue...", "Killed by an energy vortex.", "You died in Sokoban on dungeon level 6 with 42100 points,"]) {
      systems.messages.handleShimPutstr([5, 0, text]);
    }
    systems.windowText.handleShimDisplayNhwindow([5, false]);
    expect(events.filter(event => event.type === "game_over_score")).toEqual([{ type: "game_over_score", points: 42100 }]);
    systems.messages.handleShimRawPrint(["You died with 42100 points,"]);
    expect(events.filter(event => event.type === "game_over_score")).toHaveLength(1);
  });

  it("does not treat ordinary gameplay text as a final score", () => {
    systems.messages.handleShimRawPrint(["You escaped with 50 points."]);
    expect(events.filter(event => event.type === "game_over_score")).toEqual([]);
  });
});
