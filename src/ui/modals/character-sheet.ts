import type { InfoMenuState } from "../../game/ui-types";
import type { NethackRuntimeVersion } from "../../runtime/types";
import { getTranslationStrings } from "../../i18n/core";

export type CharacterSheetSectionId =
  | "background"
  | "basics"
  | "characteristics"
  | "status"
  | "attributes"
  | "misc";

export type CharacterSheetSection = {
  id: CharacterSheetSectionId;
  title: string;
  lines: string[];
};

export type CharacterSheetStatKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

export type CharacterSheetStat = {
  id: CharacterSheetStatKey;
  label: string;
  rawValue: string | null;
  currentValue: string | null;
  limitValue: string | null;
};

export type CharacterSheetData = {
  variant: "default" | "slashem_base_attributes";
  title: string;
  sections: CharacterSheetSection[];
  extraSections: CharacterSheetSection[];
  backgroundLines: string[];
  basicsLines: string[];
  characteristicsLines: string[];
  statusLines: string[];
  attributeLines: string[];
  deityLines: string[];
  identityLine: string | null;
  alignmentLine: string | null;
  locationLine: string | null;
  timelineLine: string | null;
  worldStateLine: string | null;
  experienceLine: string | null;
  scoreLine: string | null;
  hitPointsLine: string | null;
  energyLine: string | null;
  armorClassLine: string | null;
  walletLine: string | null;
  autopickupLine: string | null;
  statEntries: CharacterSheetStat[];
};

const characterSheetStrings = getTranslationStrings().characterSheet;

const sectionTitleById: Record<
  Exclude<CharacterSheetSectionId, "misc">,
  string
> = {
  background: characterSheetStrings.sectionTitles.background,
  basics: characterSheetStrings.sectionTitles.basics,
  characteristics: characterSheetStrings.sectionTitles.characteristics,
  status: characterSheetStrings.sectionTitles.status,
  attributes: characterSheetStrings.sectionTitles.attributes,
};

const sectionIdByHeading: Record<string, CharacterSheetSectionId> = {
  background: "background",
  basics: "basics",
  characteristics: "characteristics",
  "current characteristics": "characteristics",
  "final characteristics": "characteristics",
  status: "status",
  "current status": "status",
  "final status": "status",
  attributes: "attributes",
  "current attributes": "attributes",
  "final attributes": "attributes",
  miscellaneous: "misc",
};

const orderedPrimarySectionIds: Exclude<CharacterSheetSectionId, "misc">[] = [
  "background",
  "basics",
  "characteristics",
  "status",
  "attributes",
];

function normalizeInfoLine(rawLine: unknown): string {
  return String(rawLine || "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveCharacterSectionHeading(
  rawLine: string,
): CharacterSheetSectionId | null {
  const headingMatch = rawLine.match(/^([A-Za-z][A-Za-z ]+):$/);
  if (!headingMatch || !headingMatch[1]) {
    return null;
  }

  const normalizedHeading = headingMatch[1].trim().toLowerCase();
  return sectionIdByHeading[normalizedHeading] ?? null;
}

function splitCharacterSections(lines: string[]): CharacterSheetSection[] {
  const sections: CharacterSheetSection[] = [];
  let currentSection: CharacterSheetSection | null = null;

  const ensureOverviewSection = (): CharacterSheetSection => {
    if (currentSection) {
      return currentSection;
    }
    const overviewSection: CharacterSheetSection = {
      id: "misc",
      title: characterSheetStrings.sectionTitles.overview,
      lines: [],
    };
    sections.push(overviewSection);
    currentSection = overviewSection;
    return overviewSection;
  };

  for (const rawLine of lines) {
    const line = normalizeInfoLine(rawLine);
    if (!line) {
      continue;
    }

    const headingMatch = line.match(/^([A-Za-z][A-Za-z ]+):$/);
    if (headingMatch && headingMatch[1]) {
      const rawHeading = headingMatch[1].trim();
      const id = resolveCharacterSectionHeading(line) ?? "misc";
      const section: CharacterSheetSection = {
        id,
        title:
          id === "misc"
            ? rawHeading
            : sectionTitleById[id as Exclude<CharacterSheetSectionId, "misc">],
        lines: [],
      };
      sections.push(section);
      currentSection = section;
      continue;
    }

    ensureOverviewSection().lines.push(line);
  }

  return sections.filter((section) => section.lines.length > 0);
}

function getSectionLinesById(
  sections: CharacterSheetSection[],
  id: CharacterSheetSectionId,
): string[] {
  return sections
    .filter((section) => section.id === id)
    .flatMap((section) => section.lines);
}

function findFirstLine(
  lines: string[],
  predicate: (line: string) => boolean,
): string | null {
  for (const line of lines) {
    if (predicate(line)) {
      return line;
    }
  }
  return null;
}

function extractStatValue(lines: string[], statName: string): string | null {
  const pattern = new RegExp(`^Your ${statName} is (.+?)(?:\\.|$)`, "i");
  for (const line of lines) {
    const match = line.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function parseStatCurrentAndLimit(value: string): {
  currentValue: string | null;
  limitValue: string | null;
} {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return { currentValue: null, limitValue: null };
  }

  const parentheticalMatch = normalized.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (parentheticalMatch) {
    const detailText = parentheticalMatch[2]?.trim() || "";
    const limitMatch = detailText.match(
      /(?:^|[,;])\s*(?:innate\s+)?limit\s*:\s*([^,;]+)/i,
    );
    return {
      currentValue: parentheticalMatch[1]?.trim() || null,
      limitValue: limitMatch?.[1]?.trim() || null,
    };
  }

  return {
    currentValue: normalized,
    limitValue: null,
  };
}

function extractCharacterStat(
  lines: string[],
  id: CharacterSheetStatKey,
  label: string,
): CharacterSheetStat {
  const rawValue = extractStatValue(lines, id);
  const { currentValue, limitValue } = parseStatCurrentAndLimit(rawValue || "");
  return {
    id,
    label,
    rawValue,
    currentValue,
    limitValue,
  };
}

function createEmptyCharacterStatEntries(): CharacterSheetStat[] {
  return [
    {
      id: "strength",
      label: characterSheetStrings.statLabels.strength,
      rawValue: null,
      currentValue: null,
      limitValue: null,
    },
    {
      id: "dexterity",
      label: characterSheetStrings.statLabels.dexterity,
      rawValue: null,
      currentValue: null,
      limitValue: null,
    },
    {
      id: "constitution",
      label: characterSheetStrings.statLabels.constitution,
      rawValue: null,
      currentValue: null,
      limitValue: null,
    },
    {
      id: "intelligence",
      label: characterSheetStrings.statLabels.intelligence,
      rawValue: null,
      currentValue: null,
      limitValue: null,
    },
    {
      id: "wisdom",
      label: characterSheetStrings.statLabels.wisdom,
      rawValue: null,
      currentValue: null,
      limitValue: null,
    },
    {
      id: "charisma",
      label: characterSheetStrings.statLabels.charisma,
      rawValue: null,
      currentValue: null,
      limitValue: null,
    },
  ];
}

function formatLegacyBaseAttributesLine(line: string): string {
  const normalized = normalizeInfoLine(line);
  if (!normalized) {
    return "";
  }
  const fieldMatch = normalized.match(/^([^:]+?)\s*:\s*(.+)$/);
  if (!fieldMatch) {
    return normalized;
  }
  const rawLabel = fieldMatch[1]?.trim() || "";
  const value = fieldMatch[2]?.trim() || "";
  if (!rawLabel || !value) {
    return normalized;
  }
  const label = `${rawLabel.charAt(0).toUpperCase()}${rawLabel.slice(1)}`;
  return `${label}: ${value}`;
}

function parseLegacyBaseAttributesInfoMenu(
  infoMenu: InfoMenuState,
  normalizedTitle: string,
  normalizedLines: string[],
): CharacterSheetData | null {
  if (!normalizedTitle.includes("base attributes")) {
    return null;
  }

  const sections: Array<{ title: string; lines: string[] }> = [];
  let currentSection: { title: string; lines: string[] } | null = null;

  for (const line of normalizedLines) {
    if (/^(starting|current|deities)$/i.test(line)) {
      currentSection = {
        title: line,
        lines: [],
      };
      sections.push(currentSection);
      continue;
    }
    if (!currentSection) {
      continue;
    }
    const formattedLine = formatLegacyBaseAttributesLine(line);
    if (formattedLine) {
      currentSection.lines.push(formattedLine);
    }
  }

  if (!sections.some((section) => section.lines.length > 0)) {
    return null;
  }

  const startingLines =
    sections.find((section) => section.title.toLowerCase() === "starting")
      ?.lines ?? [];
  const currentLines =
    sections.find((section) => section.title.toLowerCase() === "current")
      ?.lines ?? [];
  const deityLines =
    sections.find((section) => section.title.toLowerCase() === "deities")
      ?.lines ?? [];
  const startingAlignmentLine =
    findFirstLine(startingLines, (line) => /^Alignment:/i.test(line)) || null;
  const currentAlignmentLine =
    findFirstLine(currentLines, (line) => /^Alignment:/i.test(line)) || null;

  const primarySections: CharacterSheetSection[] = [];
  if (startingLines.length > 0) {
    primarySections.push({
      id: "background",
      title: sectionTitleById.background,
      lines: startingLines,
    });
  }
  if (currentLines.length > 0) {
    primarySections.push({
      id: "characteristics",
      title: sectionTitleById.characteristics,
      lines: currentLines,
    });
  }

  return {
    variant: "slashem_base_attributes",
    title:
      normalizeInfoLine(infoMenu.title) || characterSheetStrings.titleFallback,
    sections: primarySections,
    extraSections: [],
    backgroundLines: startingLines,
    basicsLines: [],
    characteristicsLines: currentLines,
    statusLines: [],
    attributeLines: [],
    deityLines,
    identityLine: startingLines[0] || null,
    alignmentLine: currentAlignmentLine || startingAlignmentLine,
    locationLine: null,
    timelineLine: null,
    worldStateLine: null,
    experienceLine: null,
    scoreLine: null,
    hitPointsLine: null,
    energyLine: null,
    armorClassLine: null,
    walletLine: null,
    autopickupLine: null,
    statEntries: createEmptyCharacterStatEntries(),
  };
}

export function parseCharacterSheetInfoMenu(
  infoMenu: InfoMenuState | null,
): CharacterSheetData | null {
  if (!infoMenu || !Array.isArray(infoMenu.lines)) {
    return null;
  }

  const normalizedTitle = normalizeInfoLine(infoMenu.title).toLowerCase();
  const normalizedLines = infoMenu.lines
    .map((line) => normalizeInfoLine(line))
    .filter((line) => line.length > 0);

  if (normalizedLines.length === 0) {
    return null;
  }

  const legacyBaseAttributesSheet = parseLegacyBaseAttributesInfoMenu(
    infoMenu,
    normalizedTitle,
    normalizedLines,
  );
  if (legacyBaseAttributesSheet) {
    return legacyBaseAttributesSheet;
  }

  const allText = normalizedLines.join("\n").toLowerCase();
  const hasKnownCharacterHeading = normalizedLines.some(
    (line) => resolveCharacterSectionHeading(line) !== null,
  );
  const hasCoreStats =
    allText.includes("your strength is") &&
    allText.includes("your dexterity is") &&
    allText.includes("your constitution is");
  const hasCharacterIdentitySignals =
    allText.includes("you are ") &&
    (allText.includes("armor class") ||
      allText.includes("experience points") ||
      allText.includes("dungeon"));
  const titleSuggestsCharacterSheet =
    normalizedTitle.includes("attribute") ||
    normalizedTitle.includes("character");

  if (
    !hasKnownCharacterHeading &&
    !(hasCoreStats && hasCharacterIdentitySignals) &&
    !(titleSuggestsCharacterSheet && hasCoreStats)
  ) {
    return null;
  }

  const splitSections = splitCharacterSections(normalizedLines);
  const backgroundLines = getSectionLinesById(splitSections, "background");
  const basicsLines = getSectionLinesById(splitSections, "basics");
  const characteristicsLines = getSectionLinesById(
    splitSections,
    "characteristics",
  );
  const statusLines = getSectionLinesById(splitSections, "status");
  const attributeLines = getSectionLinesById(splitSections, "attributes");

  const backgroundOrAllLines =
    backgroundLines.length > 0 ? backgroundLines : normalizedLines;
  const basicsOrAllLines =
    basicsLines.length > 0 ? basicsLines : normalizedLines;
  const characteristicOrAllLines =
    characteristicsLines.length > 0 ? characteristicsLines : normalizedLines;

  const identityLine = findFirstLine(backgroundOrAllLines, (line) =>
    /^You are (?:a|an|the) /i.test(line),
  );
  const alignmentLine = findFirstLine(backgroundOrAllLines, (line) =>
    /on a mission for/i.test(line),
  );
  const locationLine = findFirstLine(backgroundOrAllLines, (line) =>
    /^You are in the /i.test(line),
  );
  const timelineLine = findFirstLine(backgroundOrAllLines, (line) =>
    /^You entered the dungeon /i.test(line),
  );
  const worldStateLine = findFirstLine(backgroundOrAllLines, (line) =>
    /(in effect|full moon|new moon)/i.test(line),
  );
  const experienceLine = findFirstLine(backgroundOrAllLines, (line) =>
    /experience points/i.test(line),
  );
  const scoreLine = findFirstLine(backgroundOrAllLines, (line) =>
    /^Your score is /i.test(line),
  );

  const hitPointsLine = findFirstLine(basicsOrAllLines, (line) =>
    /hit points/i.test(line),
  );
  const energyLine = findFirstLine(basicsOrAllLines, (line) =>
    /(energy points|spell power)/i.test(line),
  );
  const armorClassLine = findFirstLine(basicsOrAllLines, (line) =>
    /armor class/i.test(line),
  );
  const walletLine = findFirstLine(basicsOrAllLines, (line) =>
    /wallet/i.test(line),
  );
  const autopickupLine = findFirstLine(basicsOrAllLines, (line) =>
    /autopickup/i.test(line),
  );

  const statEntries: CharacterSheetStat[] = [
    extractCharacterStat(
      characteristicOrAllLines,
      "strength",
      characterSheetStrings.statLabels.strength,
    ),
    extractCharacterStat(
      characteristicOrAllLines,
      "dexterity",
      characterSheetStrings.statLabels.dexterity,
    ),
    extractCharacterStat(
      characteristicOrAllLines,
      "constitution",
      characterSheetStrings.statLabels.constitution,
    ),
    extractCharacterStat(
      characteristicOrAllLines,
      "intelligence",
      characterSheetStrings.statLabels.intelligence,
    ),
    extractCharacterStat(
      characteristicOrAllLines,
      "wisdom",
      characterSheetStrings.statLabels.wisdom,
    ),
    extractCharacterStat(
      characteristicOrAllLines,
      "charisma",
      characterSheetStrings.statLabels.charisma,
    ),
  ];

  const primarySections: CharacterSheetSection[] = [];
  for (const id of orderedPrimarySectionIds) {
    const lines = getSectionLinesById(splitSections, id);
    if (lines.length === 0) {
      continue;
    }
    primarySections.push({
      id,
      title: sectionTitleById[id],
      lines,
    });
  }

  const extraSections = splitSections.filter(
    (section) => section.id === "misc",
  );

  return {
    variant: "default",
    title:
      normalizeInfoLine(infoMenu.title) || characterSheetStrings.titleFallback,
    sections: primarySections,
    extraSections,
    backgroundLines,
    basicsLines,
    characteristicsLines,
    statusLines,
    attributeLines,
    deityLines: [],
    identityLine,
    alignmentLine,
    locationLine,
    timelineLine,
    worldStateLine,
    experienceLine,
    scoreLine,
    hitPointsLine,
    energyLine,
    armorClassLine,
    walletLine,
    autopickupLine,
    statEntries,
  };
}

export type CharacterCommandAction = {
  id: string;
  command: string;
  label: string;
  detail: string;
};

const characterCommandCatalog: readonly CharacterCommandAction[] = [
  {
    id: "enhance",
    command: "enhance",
    label: characterSheetStrings.commands.enhance.label,
    detail: characterSheetStrings.commands.enhance.detail,
  },
  {
    id: "technique",
    command: "technique",
    label: characterSheetStrings.commands.technique.label,
    detail: characterSheetStrings.commands.technique.detail,
  },
  {
    id: "conduct",
    command: "conduct",
    label: characterSheetStrings.commands.conduct.label,
    detail: characterSheetStrings.commands.conduct.detail,
  },
  {
    id: "overview",
    command: "overview",
    label: characterSheetStrings.commands.overview.label,
    detail: characterSheetStrings.commands.overview.detail,
  },
  {
    id: "spells",
    command: "spells",
    label: characterSheetStrings.commands.spells.label,
    detail: characterSheetStrings.commands.spells.detail,
  },
  {
    id: "seespells",
    command: "seespells",
    label: characterSheetStrings.commands.seespells.label,
    detail: characterSheetStrings.commands.seespells.detail,
  },
  {
    id: "known",
    command: "known",
    label: characterSheetStrings.commands.known.label,
    detail: characterSheetStrings.commands.known.detail,
  },
  {
    id: "pray",
    command: "pray",
    label: characterSheetStrings.commands.pray.label,
    detail: characterSheetStrings.commands.pray.detail,
  },
];

export function resolveCharacterCommandActions(
  availableExtendedCommands: readonly string[],
  runtimeVersion: NethackRuntimeVersion,
): CharacterCommandAction[] {
  const available = new Set<string>();
  for (const command of availableExtendedCommands) {
    const normalized = String(command || "")
      .trim()
      .toLowerCase();
    if (normalized) {
      available.add(normalized);
    }
  }

  if (runtimeVersion === "slashem" || runtimeVersion === "evilhack") {
    for (const command of [
      "enhance",
      "conduct",
      "known",
      "pray",
      "spells",
      "technique",
    ]) {
      available.add(command);
    }
  }

  return characterCommandCatalog.filter((entry) => {
    if ((runtimeVersion === "slashem" || runtimeVersion === "evilhack") && entry.command === "seespells") {
      return false;
    }
    return available.has(entry.command);
  });
}
