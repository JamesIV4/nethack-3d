import type {
  PlayerStatsSnapshot
} from "../../../game/ui-types";
import {
  CharacterSheetStatKey
} from "../../modals/character-sheet";
import {
  t
} from "../shared/translations";

/** Character sheet descriptions, experience thresholds and field rendering. */
export const characterStatDescriptionById: Record<CharacterSheetStatKey, string> = {
  strength: t.characterStats.descriptions.strength,
  dexterity: t.characterStats.descriptions.dexterity,
  constitution: t.characterStats.descriptions.constitution,
  intelligence: t.characterStats.descriptions.intelligence,
  wisdom: t.characterStats.descriptions.wisdom,
  charisma: t.characterStats.descriptions.charisma,
};

export const armorClassDescription = t.characterStats.armorClassDescription;

export const maxExperienceLevel = 30;

export function getExperienceThresholdForLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return 0;
  }
  const normalizedLevel = Math.trunc(level);
  if (normalizedLevel < 1) {
    return 0;
  }
  if (normalizedLevel < 10) {
    return 10 * (1 << normalizedLevel);
  }
  if (normalizedLevel < 20) {
    return 10000 * (1 << (normalizedLevel - 10));
  }
  return 10000000 * (normalizedLevel - 19);
}

export function formatCharacterNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Math.max(0, Math.trunc(value)).toLocaleString("en-US");
}

export type CharacterSheetFieldRow = {
  label: string;
  value: string;
  badges: string[];
};

export type CharacterSheetFieldRenderOptions = {
  showBadges?: boolean;
  highlightCurrent?: boolean;
};

export function normalizeCharacterSheetFieldBadges(note: string): string[] {
  const normalized = String(note || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return [];
  }

  if (/^[sc](\s*,\s*[sc])*$/.test(normalized)) {
    return normalized
      .split(",")
      .map((token) => token.trim())
      .filter((token, index, array) => array.indexOf(token) === index)
      .map((token) =>
        token === "s" ? "Starting" : token === "c" ? "Current" : token,
      );
  }

  return [note.trim()];
}

export function parseCharacterSheetFieldRow(
  line: string,
): CharacterSheetFieldRow | null {
  const normalized = String(line || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return null;
  }
  const match = normalized.match(/^([^:]+):\s*(.+)$/);
  if (!match || !match[1] || !match[2]) {
    return null;
  }

  let value = match[2].trim();
  let badges: string[] = [];
  const noteMatch = value.match(/^(.*?)(?:\s+\(([^()]+)\))$/);
  if (noteMatch && noteMatch[1]) {
    value = noteMatch[1].trim();
    badges = normalizeCharacterSheetFieldBadges(noteMatch[2] || "");
  }

  return {
    label: match[1].trim(),
    value,
    badges,
  };
}

export function renderCharacterSheetFieldRows(
  lines: string[],
  keyPrefix: string,
  options: CharacterSheetFieldRenderOptions = {},
): JSX.Element {
  const showBadges = options.showBadges === true;
  const highlightCurrent = options.highlightCurrent === true;
  return (
    <div className="nh3d-character-field-list">
      {lines.map((line, index) => {
        const parsed = parseCharacterSheetFieldRow(line);
        if (!parsed) {
          return (
            <div className="nh3d-character-line" key={`${keyPrefix}-${index}`}>
              {line}
            </div>
          );
        }
        const isCurrent = highlightCurrent && parsed.badges.includes("Current");
        return (
          <div
            className={`nh3d-character-field-row${isCurrent ? " is-current" : ""
              }`}
            key={`${keyPrefix}-${index}`}
          >
            <div className="nh3d-character-field-label">{parsed.label}</div>
            <div className="nh3d-character-field-value-group">
              <span className="nh3d-character-field-value">{parsed.value}</span>
              {showBadges
                ? parsed.badges.map((badge) => (
                  <span
                    className="nh3d-character-field-badge"
                    key={`${keyPrefix}-${index}-${badge}`}
                  >
                    {badge}
                  </span>
                ))
                : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function getLegacyCharacterStatValue(
  id: CharacterSheetStatKey,
  stats: PlayerStatsSnapshot,
): string | null {
  const valueById: Record<CharacterSheetStatKey, unknown> = {
    strength: stats.strength,
    dexterity: stats.dexterity,
    constitution: stats.constitution,
    intelligence: stats.intelligence,
    wisdom: stats.wisdom,
    charisma: stats.charisma,
  };
  const rawValue = valueById[id];
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return String(Math.trunc(rawValue));
  }
  const normalized = String(rawValue ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}
