import type {
  NethackMenuItem,
  RunTelemetryBreakdownEntry,
  RunTelemetryHiddenFindEvent,
  RunTelemetryLootEvent,
  RunTelemetryPetKillEvent,
  RunTelemetrySnapshot,
  RunTelemetrySpellLearnedEvent,
  RunTelemetryTrapEvent
} from "../../ui-types";
import {
  createEmptyGameOverPostmortemReports,
  createEmptyRunTelemetrySnapshot
} from "../../ui-types";
import type { ParsedLootTelemetryMessage, PendingRunKillAttribution } from "../shared/types";
import type { GameOver } from "../ui/game-over";
import type { HeldWeapon } from "../rendering/held-weapon";
import type { PlayerStatus } from "../ui/player-status";
import type { RuntimeEntityTracking } from "./runtime-entity-tracking";

export interface RunTelemetryDependencies {
  readonly gameOver: Pick<
    GameOver,
    "pendingSuppressedGameOverReportKind"
    | "postmortemReports"
  >;
  readonly heldWeapon: Pick<
    HeldWeapon,
    "findHeldWeaponInventoryItem"
  >;
  readonly playerStatus: Pick<
    PlayerStatus,
    "playerStats"
  >;
  readonly runtimeEntityTracking: Pick<
    RuntimeEntityTracking,
    "normalizeRuntimeTargetEntityId"
    | "resolveRuntimeMonsterLastSeenStateById"
  >;
}

/** Run counters, event history, inventory labels, spell and weapon kill attribution. */
export class RunTelemetry {
  constructor(private readonly dependencies: RunTelemetryDependencies) {}

  runTelemetry: RunTelemetrySnapshot =
    createEmptyRunTelemetrySnapshot();

  readonly runTelemetryWeaponKillCounts: Map<
    string,
    RunTelemetryBreakdownEntry
  > = new Map();

  readonly runTelemetrySpellKillCounts: Map<
    string,
    RunTelemetryBreakdownEntry
  > = new Map();

  readonly runTelemetryPetKillCounts: Map<
    string,
    RunTelemetryBreakdownEntry
  > = new Map();

  readonly runTelemetryKnownSpellNames: Set<string> = new Set();

  readonly runTelemetryTrapSignatures: Set<string> = new Set();

  readonly runTelemetryHiddenFindSignatures: Set<string> = new Set();

  recentSpellKillAttribution: PendingRunKillAttribution | null = null;

  cloneRunTelemetrySnapshot(
    telemetry: RunTelemetrySnapshot | null | undefined,
  ): RunTelemetrySnapshot {
    const source = telemetry ?? createEmptyRunTelemetrySnapshot();
    return {
      searches:
        typeof source.searches === "number" && Number.isFinite(source.searches)
          ? Math.max(0, Math.trunc(source.searches))
          : 0,
      lootEvents: Array.isArray(source.lootEvents)
        ? source.lootEvents.map((event) => ({ ...event }))
        : [],
      trapEvents: Array.isArray(source.trapEvents)
        ? source.trapEvents.map((event) => ({ ...event }))
        : [],
      searchEvents: Array.isArray(source.searchEvents)
        ? source.searchEvents.map((event) => ({ ...event }))
        : [],
      hiddenFindEvents: Array.isArray(source.hiddenFindEvents)
        ? source.hiddenFindEvents.map((event) => ({ ...event }))
        : [],
      spellLearnedEvents: Array.isArray(source.spellLearnedEvents)
        ? source.spellLearnedEvents.map((event) => ({ ...event }))
        : [],
      petKillEvents: Array.isArray(source.petKillEvents)
        ? source.petKillEvents.map((event) => ({ ...event }))
        : [],
      weaponKills: Array.isArray(source.weaponKills)
        ? source.weaponKills.map((entry) => ({ ...entry }))
        : [],
      spellKills: Array.isArray(source.spellKills)
        ? source.spellKills.map((entry) => ({ ...entry }))
        : [],
      petKills: Array.isArray(source.petKills)
        ? source.petKills.map((entry) => ({ ...entry }))
        : [],
    };
  }

  resetRunTelemetryTracking(): void {
    this.runTelemetry = createEmptyRunTelemetrySnapshot();
    this.runTelemetryWeaponKillCounts.clear();
    this.runTelemetrySpellKillCounts.clear();
    this.runTelemetryPetKillCounts.clear();
    this.runTelemetryKnownSpellNames.clear();
    this.runTelemetryTrapSignatures.clear();
    this.runTelemetryHiddenFindSignatures.clear();
    this.recentSpellKillAttribution = null;
    this.dependencies.gameOver.postmortemReports = createEmptyGameOverPostmortemReports();
    this.dependencies.gameOver.pendingSuppressedGameOverReportKind = null;
  }

  buildSortedRunTelemetryBreakdown(
    source: ReadonlyMap<string, RunTelemetryBreakdownEntry>,
  ): RunTelemetryBreakdownEntry[] {
    return Array.from(source.values())
      .map((entry) => ({
        label: String(entry.label || "").trim(),
        count:
          typeof entry.count === "number" && Number.isFinite(entry.count)
            ? Math.max(0, Math.trunc(entry.count))
            : 0,
        detail:
          typeof entry.detail === "string" && entry.detail.trim()
            ? entry.detail.trim()
            : undefined,
      }))
      .filter((entry) => entry.label && entry.count > 0)
      .sort(
        (left, right) =>
          right.count - left.count || left.label.localeCompare(right.label),
      );
  }

  buildRunTelemetrySnapshot(): RunTelemetrySnapshot {
    return {
      ...this.cloneRunTelemetrySnapshot(this.runTelemetry),
      weaponKills: this.buildSortedRunTelemetryBreakdown(
        this.runTelemetryWeaponKillCounts,
      ),
      spellKills: this.buildSortedRunTelemetryBreakdown(
        this.runTelemetrySpellKillCounts,
      ),
      petKills: this.buildSortedRunTelemetryBreakdown(
        this.runTelemetryPetKillCounts,
      ),
    };
  }

  resolveRunTelemetryTurn(offset = 0): number {
    const baseTurn =
      typeof this.dependencies.playerStatus.playerStats.time === "number" &&
      Number.isFinite(this.dependencies.playerStatus.playerStats.time)
        ? Math.trunc(this.dependencies.playerStatus.playerStats.time)
        : 0;
    return Math.max(0, baseTurn + offset);
  }

  resolveRunTelemetryLocation(): string | undefined {
    const locationLabel = String(this.dependencies.playerStatus.playerStats.locationLabel || "").trim();
    if (locationLabel) {
      return locationLabel;
    }
    const dungeon = String(this.dependencies.playerStatus.playerStats.dungeon || "").trim();
    const dlevel =
      typeof this.dependencies.playerStatus.playerStats.dlevel === "number" &&
      Number.isFinite(this.dependencies.playerStatus.playerStats.dlevel)
        ? Math.trunc(this.dependencies.playerStatus.playerStats.dlevel)
        : null;
    if (dungeon && dlevel !== null) {
      return `${dungeon} ${dlevel}`;
    }
    if (dungeon) {
      return dungeon;
    }
    if (dlevel !== null) {
      return `Depth ${dlevel}`;
    }
    return undefined;
  }

  addRunTelemetryBreakdownCount(
    target: Map<string, RunTelemetryBreakdownEntry>,
    label: string,
    detail?: string,
  ): void {
    const normalizedLabel = String(label || "").trim();
    if (!normalizedLabel) {
      return;
    }
    const key = normalizedLabel.toLowerCase();
    const existing = target.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.detail && detail) {
        existing.detail = detail;
      }
      return;
    }
    target.set(key, {
      label: normalizedLabel,
      count: 1,
      detail: detail?.trim() || undefined,
    });
  }

  addRunTelemetryPetKillEvent(label: string, detail?: string): void {
    const normalizedLabel = String(label || "").trim();
    if (!normalizedLabel) {
      return;
    }
    const turn = this.resolveRunTelemetryTurn();
    const location = this.resolveRunTelemetryLocation();
    const event: RunTelemetryPetKillEvent = {
      id: `pet-kill-${turn}-${this.runTelemetry.petKillEvents.length + 1}`,
      turn,
      label: normalizedLabel,
      count: 1,
      detail: String(detail || "").trim() || undefined,
      location,
    };
    this.runTelemetry = {
      ...this.runTelemetry,
      petKillEvents: [...this.runTelemetry.petKillEvents, event],
    };
  }

  addRunTelemetryHiddenFindEvent(
    label: string,
    category: RunTelemetryHiddenFindEvent["category"],
    detail?: string,
  ): void {
    const normalizedLabel = String(label || "").trim();
    if (!normalizedLabel) {
      return;
    }
    const turn = this.resolveRunTelemetryTurn();
    const location = this.resolveRunTelemetryLocation();
    const normalizedDetail = String(detail || "")
      .replace(/\s+/g, " ")
      .trim();
    const signature = [
      turn,
      normalizedLabel.toLowerCase(),
      category,
      normalizedDetail.toLowerCase(),
    ].join("|");
    if (this.runTelemetryHiddenFindSignatures.has(signature)) {
      return;
    }
    this.runTelemetryHiddenFindSignatures.add(signature);
    const event: RunTelemetryHiddenFindEvent = {
      id: `hidden-find-${turn}-${this.runTelemetry.hiddenFindEvents.length + 1}`,
      turn,
      label: normalizedLabel,
      category,
      detail: normalizedDetail || undefined,
      location,
    };
    this.runTelemetry = {
      ...this.runTelemetry,
      hiddenFindEvents: [...this.runTelemetry.hiddenFindEvents, event],
    };
  }

  addRunTelemetryTrapEvent(label: string, detail?: string): void {
    const normalizedLabel = String(label || "").trim();
    if (!normalizedLabel) {
      return;
    }
    const turn = this.resolveRunTelemetryTurn();
    const normalizedDetail = String(detail || "")
      .replace(/\s+/g, " ")
      .trim();
    const signature = [
      turn,
      normalizedLabel.toLowerCase(),
      normalizedDetail.toLowerCase(),
    ].join("|");
    if (this.runTelemetryTrapSignatures.has(signature)) {
      return;
    }
    this.runTelemetryTrapSignatures.add(signature);
    const location = this.resolveRunTelemetryLocation();
    const event: RunTelemetryTrapEvent = {
      id: `trap-${turn}-${this.runTelemetry.trapEvents.length + 1}`,
      turn,
      label: normalizedLabel,
      detail: normalizedDetail || undefined,
      location,
    };
    this.runTelemetry = {
      ...this.runTelemetry,
      trapEvents: [...this.runTelemetry.trapEvents, event],
    };
  }

  addRunTelemetryLootEvent(
    label: string,
    quantity: number,
    category?: string | null,
    detail?: string,
  ): void {
    const normalizedLabel = String(label || "").trim();
    const normalizedQuantity = Math.max(1, Math.trunc(quantity || 0));
    if (!normalizedLabel || normalizedQuantity <= 0) {
      return;
    }
    if (this.isGoldLootTelemetryLabel(normalizedLabel)) {
      return;
    }
    const turn = this.resolveRunTelemetryTurn();
    const location = this.resolveRunTelemetryLocation();
    const event: RunTelemetryLootEvent = {
      id: `loot-${turn}-${this.runTelemetry.lootEvents.length + 1}`,
      turn,
      label: normalizedLabel,
      quantity: normalizedQuantity,
      category: category?.trim() || undefined,
      detail: detail?.trim() || undefined,
      location,
    };
    this.runTelemetry = {
      ...this.runTelemetry,
      lootEvents: [...this.runTelemetry.lootEvents, event],
    };
  }

  addRunTelemetrySpellLearnedEvent(
    spell: string,
    detail?: string,
  ): void {
    const normalizedSpell = String(spell || "").trim();
    if (!normalizedSpell) {
      return;
    }
    const spellKey = normalizedSpell.toLowerCase();
    if (this.runTelemetryKnownSpellNames.has(spellKey)) {
      return;
    }
    this.runTelemetryKnownSpellNames.add(spellKey);
    const turn = this.resolveRunTelemetryTurn();
    const location = this.resolveRunTelemetryLocation();
    const event: RunTelemetrySpellLearnedEvent = {
      id: `spell-${turn}-${this.runTelemetry.spellLearnedEvents.length + 1}`,
      turn,
      spell: normalizedSpell,
      detail: detail?.trim() || undefined,
      location,
    };
    this.runTelemetry = {
      ...this.runTelemetry,
      spellLearnedEvents: [...this.runTelemetry.spellLearnedEvents, event],
    };
  }

  isGoldLootTelemetryLabel(label: string): boolean {
    return /\b(?:gold pieces?|zorkmids?|coins?)\b/i.test(label);
  }

  parseLootTelemetryLabel(
    rawLabel: string,
  ): ParsedLootTelemetryMessage | null {
    const normalizedLabel = String(rawLabel || "")
      .replace(/\s+/g, " ")
      .replace(/[.?!]\s*$/, "")
      .trim();
    if (!normalizedLabel || this.isGoldLootTelemetryLabel(normalizedLabel)) {
      return null;
    }

    const quantityMatch = normalizedLabel.match(/^(\d+)\s+(.+)$/);
    const articleMatch = normalizedLabel.match(/^(?:an?|the)\s+(.+)$/i);
    const quantity = quantityMatch
      ? Math.max(1, Number.parseInt(quantityMatch[1]!, 10))
      : 1;
    const label = quantityMatch
      ? quantityMatch[2]!.trim()
      : articleMatch
        ? articleMatch[1]!.trim()
        : normalizedLabel;
    if (!label || this.isGoldLootTelemetryLabel(label)) {
      return null;
    }
    return { label, quantity };
  }

  resolveLootTelemetryFromMessage(
    messageLike: unknown,
  ): ParsedLootTelemetryMessage | null {
    if (typeof messageLike !== "string") {
      return null;
    }
    const normalized = messageLike.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return null;
    }

    const assignmentMatch = normalized.match(/^[^\s] - (.+)$/);
    if (assignmentMatch?.[1]) {
      const parsed = this.parseLootTelemetryLabel(assignmentMatch[1]);
      return parsed
        ? { ...parsed, detail: "Picked up from inventory assignment." }
        : null;
    }

    const pickupMatch = normalized.match(
      /\byou\s+(?:pick up|pickup|collect|take)\s+(.+)$/i,
    );
    if (!pickupMatch?.[1]) {
      return null;
    }
    const parsed = this.parseLootTelemetryLabel(pickupMatch[1]);
    return parsed ? { ...parsed, detail: normalized } : null;
  }

  resolveTrapTelemetryFromMessage(
    messageLike: unknown,
  ): { label: string; detail?: string } | null {
    if (typeof messageLike !== "string") {
      return null;
    }
    const normalized = messageLike.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return null;
    }
    if (!/\byou\b/i.test(normalized)) {
      return null;
    }
    if (/\byou\s+escape\b/i.test(normalized)) {
      return null;
    }
    if (
      /\b(?:still|stuck|trapped in|caught in a bear trap|already on the edge|can't reach|cannot reach|prevents you|free your)\b/i.test(
        normalized,
      )
    ) {
      return null;
    }

    const trapPatterns: Array<{ regex: RegExp; label: string }> = [
      {
        regex:
          /\b(?:fall|plunge|dive|stumble|move|step|land)s?\s+(?:over debris\s+)?(?:into|in|on)\s+(?:an? |the |your )?(?:spiked )?pit\b/i,
        label: "Pit trap",
      },
      { regex: /\byou stumble over debris\b/i, label: "Pit trap" },
      {
        regex: /\bpit (?:full of spikes )?opens up under you\b/i,
        label: "Pit trap",
      },
      {
        regex:
          /\btrap door opens up under you\b|\bfall through .* trap door\b/i,
        label: "Trap door",
      },
      { regex: /\bbear trap closes\b/i, label: "Bear trap" },
      {
        regex: /\b(?:triggered|sets?|set) .*land mine\b|\bkaablamm\b/i,
        label: "Land mine",
      },
      { regex: /\brolling boulder trap\b/i, label: "Rolling boulder trap" },
      { regex: /\bdart trap\b/i, label: "Dart trap" },
      { regex: /\barrow trap\b/i, label: "Arrow trap" },
      { regex: /\bteleport(?:ation)? trap\b/i, label: "Teleport trap" },
      { regex: /\bmagic trap\b/i, label: "Magic trap" },
      { regex: /\banti-magic trap\b/i, label: "Anti-magic trap" },
      { regex: /\bsqueaky board\b/i, label: "Squeaky board" },
      {
        regex: /\b(?:caught in|stuck to|walk(?:ed)? into).*\bweb\b/i,
        label: "Web trap",
      },
      { regex: /\bpolymorph trap\b/i, label: "Polymorph trap" },
      { regex: /\bsleeping gas trap\b/i, label: "Sleeping gas trap" },
      { regex: /\brust trap\b/i, label: "Rust trap" },
      { regex: /\bfire trap\b/i, label: "Fire trap" },
      { regex: /\bice trap\b/i, label: "Ice trap" },
      { regex: /\bboard beneath you squeaks\b/i, label: "Squeaky board" },
    ];
    for (const pattern of trapPatterns) {
      if (pattern.regex.test(normalized)) {
        return { label: pattern.label, detail: normalized };
      }
    }

    if (
      /\btrap\b/i.test(normalized) &&
      /\b(?:trigger(?:ed|s)?|set off|sprung|opens? up under you|closes? on your|puts you|hits? you|enveloped|covered)\b/i.test(
        normalized,
      )
    ) {
      return { label: "Trap triggered", detail: normalized };
    }
    return null;
  }

  resolveHiddenFindTelemetryFromMessage(
    messageLike: unknown,
  ): {
    label: string;
    category: RunTelemetryHiddenFindEvent["category"];
    detail?: string;
  } | null {
    if (typeof messageLike !== "string") {
      return null;
    }
    const normalized = messageLike.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return null;
    }

    if (/^you find a hidden door\.$/i.test(normalized)) {
      return {
        label: "Hidden door",
        category: "door",
        detail: normalized,
      };
    }
    if (/^you find a hidden passage\.$/i.test(normalized)) {
      return {
        label: "Hidden passage",
        category: "passage",
        detail: normalized,
      };
    }

    const trapNames = [
      "arrow trap",
      "dart trap",
      "falling rock trap",
      "squeaky board",
      "bear trap",
      "land mine",
      "rolling boulder trap",
      "sleeping gas trap",
      "rust trap",
      "fire trap",
      "pit",
      "spiked pit",
      "hole",
      "trap door",
      "teleportation trap",
      "level teleporter",
      "magic portal",
      "web",
      "statue trap",
      "magic trap",
      "anti-magic field",
      "polymorph trap",
      "vibrating square",
    ];
    for (const trapName of trapNames) {
      const escapedTrapName = trapName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const trapFindPattern = new RegExp(
        `^you find an? ${escapedTrapName}\\.$`,
        "i",
      );
      if (trapFindPattern.test(normalized)) {
        return {
          label: this.capitalizeRunTelemetryLabel(trapName),
          category: "trap",
          detail: normalized,
        };
      }
    }

    return null;
  }

  capitalizeRunTelemetryLabel(label: string): string {
    const normalized = String(label || "").trim();
    if (!normalized) {
      return "";
    }
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  captureRunTelemetryFromMessage(messageLike: unknown): void {
    if (typeof messageLike !== "string") {
      return;
    }
    const normalized = messageLike.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return;
    }

    const lootEvent = this.resolveLootTelemetryFromMessage(normalized);
    if (lootEvent) {
      this.addRunTelemetryLootEvent(
        lootEvent.label,
        lootEvent.quantity,
        null,
        lootEvent.detail,
      );
    }

    const hiddenFindEvent =
      this.resolveHiddenFindTelemetryFromMessage(normalized);
    if (hiddenFindEvent) {
      this.addRunTelemetryHiddenFindEvent(
        hiddenFindEvent.label,
        hiddenFindEvent.category,
        hiddenFindEvent.detail,
      );
      return;
    }

    const trapEvent = this.resolveTrapTelemetryFromMessage(normalized);
    if (trapEvent) {
      this.addRunTelemetryTrapEvent(trapEvent.label, trapEvent.detail);
    }

    const spellLearnMatch =
      normalized.match(
        /\b(?:learn|learned|memorize|memorized)\s+["']([^"']+)["']/i,
      ) ??
      normalized.match(
        /\b(?:learn|learned|memorize|memorized)\s+(?:the\s+)?([A-Za-z][A-Za-z' -]+?)\s+spell\b/i,
      ) ??
      normalized.match(
        /\b(?:added|add)\s+["']([^"']+)["']\s+to your repertoire\b/i,
      );
    if (spellLearnMatch?.[1]) {
      this.addRunTelemetrySpellLearnedEvent(
        spellLearnMatch[1],
        "Learned from an in-game message.",
      );
    }
  }

  resolveHeldWeaponTelemetryLabel(): string {
    const heldWeapon = this.dependencies.heldWeapon.findHeldWeaponInventoryItem();
    const normalizedLabel = this.stripInventoryTelemetryStateSuffixes(
      heldWeapon?.text,
    );
    return normalizedLabel || "Unarmed / other";
  }

  recordRunKillTelemetryFromRuntimeEvent(rawKillerId: unknown): void {
    const normalizedKillerId = this.dependencies.runtimeEntityTracking.normalizeRuntimeTargetEntityId(rawKillerId);
    if (normalizedKillerId === 0) {
      const spellLabel = this.resolveRecentSpellKillAttribution();
      if (spellLabel) {
        this.addRunTelemetryBreakdownCount(
          this.runTelemetrySpellKillCounts,
          spellLabel,
          "kills",
        );
        return;
      }
      this.addRunTelemetryBreakdownCount(
        this.runTelemetryWeaponKillCounts,
        this.resolveHeldWeaponTelemetryLabel(),
        "kills",
      );
      return;
    }

    const killerState =
      this.dependencies.runtimeEntityTracking.resolveRuntimeMonsterLastSeenStateById(normalizedKillerId);
    if (killerState?.relationship === "pet") {
      this.addRunTelemetryBreakdownCount(
        this.runTelemetryPetKillCounts,
        "Pet ally",
        "kills witnessed by the player",
      );
      this.addRunTelemetryPetKillEvent(
        "Pet ally",
        "Kill witnessed by the player",
      );
    }
  }

  stripInventoryTelemetryStateSuffixes(textLike: unknown): string {
    let normalized = String(textLike ?? "")
      .replace(/\r/g, "")
      .replace(/\s+/g, " ")
      .trim();
    while (/\s+\([^)]*\)\s*$/.test(normalized)) {
      normalized = normalized.replace(/\s+\([^)]*\)\s*$/, "").trim();
    }
    return normalized;
  }

  singularizeInventoryTelemetryLabel(
    label: string,
    quantity: number,
  ): string {
    const normalized = String(label || "").trim();
    if (!normalized || quantity === 1) {
      return normalized;
    }
    const lower = normalized.toLowerCase();
    if (lower.endsWith("gold pieces")) {
      return `${normalized.slice(0, -"gold pieces".length)}gold piece`.trim();
    }
    const exceptionSuffixes = [
      "boots",
      "gauntlets",
      "breeches",
      "glasses",
      "scales",
      "scissors",
      "trousers",
    ];
    const parts = normalized.split(" ");
    const lastWord = parts[parts.length - 1] || "";
    const lowerLastWord = lastWord.toLowerCase();
    if (exceptionSuffixes.includes(lowerLastWord)) {
      return normalized;
    }
    let singular = lastWord;
    if (/ies$/i.test(lastWord)) {
      singular = `${lastWord.slice(0, -3)}y`;
    } else if (/(ches|shes|sses|xes|zes)$/i.test(lastWord)) {
      singular = lastWord.slice(0, -2);
    } else if (/s$/i.test(lastWord) && !/ss$/i.test(lastWord)) {
      singular = lastWord.slice(0, -1);
    }
    if (!singular || singular === lastWord) {
      return normalized;
    }
    parts[parts.length - 1] = singular;
    return parts.join(" ");
  }

  isSpellCastQuestionText(questionText: string): boolean {
    const normalized = String(questionText || "")
      .trim()
      .toLowerCase();
    return normalized.includes("spell") && normalized.includes("cast");
  }

  extractSpellNameFromMenuItemText(textLike: unknown): string {
    const rawText = String(textLike ?? "").replace(/\r/g, "");
    const tabColumns = rawText
      .split("\t")
      .map((column) => column.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (tabColumns.length > 0) {
      return tabColumns[0];
    }

    const normalized = rawText.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return "";
    }

    const spellRowMatch = normalized.match(
      /^(.+?)\s+\d+\*?\s+[A-Za-z][A-Za-z_-]*\s+\d+%(?:\s+.+)?$/,
    );
    if (spellRowMatch?.[1]) {
      return spellRowMatch[1].trim();
    }
    return normalized;
  }

  captureKnownSpellsFromQuestionMenu(
    questionText: string,
    menuItems: readonly NethackMenuItem[],
  ): void {
    if (
      !this.isSpellCastQuestionText(questionText) ||
      !Array.isArray(menuItems)
    ) {
      return;
    }
    for (const item of menuItems) {
      if (!item || item.isCategory) {
        continue;
      }
      const spellName = this.extractSpellNameFromMenuItemText(item.text);
      if (!spellName || /\[sort spells]/i.test(spellName)) {
        continue;
      }
      this.addRunTelemetrySpellLearnedEvent(
        spellName,
        "First seen in the spellbook list.",
      );
    }
  }

  armRecentSpellKillAttribution(spellName: string): void {
    const normalizedSpell = String(spellName || "").trim();
    if (!normalizedSpell) {
      return;
    }
    this.recentSpellKillAttribution = {
      kind: "spell",
      label: normalizedSpell,
      expiresAtMs: Date.now() + 12000,
    };
  }

  resolveRecentSpellKillAttribution(): string | null {
    if (
      !this.recentSpellKillAttribution ||
      Date.now() > this.recentSpellKillAttribution.expiresAtMs
    ) {
      this.recentSpellKillAttribution = null;
      return null;
    }
    return this.recentSpellKillAttribution.label;
  }
}
