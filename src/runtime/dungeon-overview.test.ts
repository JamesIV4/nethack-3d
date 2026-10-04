import { afterEach, expect, it, vi } from "vitest";
vi.hoisted(() => vi.stubGlobal("window", {
  location: new URL("http://localhost/"), matchMedia: () => ({ matches: false }),
}));
afterEach(() => vi.unstubAllGlobals());
import { resolveArchivedDungeonOverview } from "./dungeon-overview";
import type { TopScoreTimelineEvent } from "./top-score-storage";
import { GameOver, type GameOverDependencies } from "../game/engine/ui/game-over";

const visit = (location: string, turn: number): TopScoreTimelineEvent => ({
  id: `${location}-${turn}`, kind: "location", label: "Reached new depth", summary: `Reached ${location}.`, location, turn,
});

it("recovers recorded visits from old or Slash'EM snapshots without inventing level details", () => {
  expect(resolveArchivedDungeonOverview(null, [visit("Sokoban 3", 16000), visit("Dlvl:1", 1), visit("Dlvl:1", 50)])).toEqual([
    "Recorded dungeon visits",
    "From this run's timeline; the native dungeon overview was not available.",
    "Turn 1: Dlvl:1", "Turn 16000: Sokoban 3",
  ]);
  expect(resolveArchivedDungeonOverview(null, [])).toBeNull();
});

it("preserves native overview details and indentation", () => {
  const native = ["The Dungeons of Doom: levels 1 to 6", "   Level 6:", "      A fountain."];
  expect(resolveArchivedDungeonOverview(native, [visit("Dlvl:1", 1)])).toEqual(native);
});

it.each(["The Dungeons of Doom: levels 1 to 6", "Sokoban: levels 6 up to 3", "The Gnomish Mines: level 4"])("recognizes native branch heading %s", title => {
  const gameOver = new GameOver({} as GameOverDependencies);
  expect(gameOver.resolveGameOverPostmortemReportKindFromInfoMenu(title, ["   Level 4:", "      You died here."])).toBe("dungeonOverview");
});

it("does not classify an ordinary level-up message as an overview", () => {
  const gameOver = new GameOver({} as GameOverDependencies);
  expect(gameOver.resolveGameOverPostmortemReportKindFromInfoMenu("NetHack Message", ["Welcome to experience level 4."])).toBeNull();
});

it("archives a confirmed overview and clears both report-selection flags", () => {
  const gameOver = new GameOver({
    promptDialogs: {
      normalizeInfoMenuLines: (lines: string[]) => [...lines],
      isNetHackMessageInfoMenuTitle: (title: string) => title === "NetHack Information",
    },
  } as unknown as GameOverDependencies);
  gameOver.pendingGameOverReportKind = "dungeonOverview";
  const lines = ["The Dungeons of Doom: levels 1 to 6", "   Level 6:"];
  gameOver.captureGameOverPostmortemReport("dungeonOverview", "NetHack Information", lines);
  expect(gameOver.postmortemReports.dungeonOverview).toEqual(lines);
  expect(gameOver.pendingGameOverReportKind).toBeNull();
  expect(gameOver.pendingSuppressedGameOverReportKind).toBeNull();
});
