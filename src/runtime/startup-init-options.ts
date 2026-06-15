import type { NethackRuntimeVersion } from "./types";

type StartupInitOptionSupport = {
  supportedRuntimeVersions?: readonly NethackRuntimeVersion[];
};
import { getTranslationStrings } from "../i18n/core";

export type StartupInitOptionBooleanDefinition = {
  key: string;
  label: string;
  description: string;
  control: "boolean";
  defaultValue: boolean;
} & StartupInitOptionSupport;

export type StartupInitOptionSelectDefinition = {
  key: string;
  label: string;
  description: string;
  control: "select";
  defaultValue: string;
  options: ReadonlyArray<{
    value: string;
    label: string;
  }>;
} & StartupInitOptionSupport;

export type StartupInitOptionTextDefinition = {
  key: string;
  label: string;
  description: string;
  control: "text";
  defaultValue: string;
  maxLength: number;
  placeholder?: string;
} & StartupInitOptionSupport;

export type StartupInitOptionNumberDefinition = {
  key: string;
  label: string;
  description: string;
  control: "number";
  defaultValue: number;
  min: number;
  max: number;
  step: number;
} & StartupInitOptionSupport;

export type StartupInitOptionDefinition =
  | StartupInitOptionBooleanDefinition
  | StartupInitOptionSelectDefinition
  | StartupInitOptionTextDefinition
  | StartupInitOptionNumberDefinition;

export type StartupInitOptionValue = boolean | string | number;
export type StartupInitOptionValues = Record<string, StartupInitOptionValue>;
const startupStrings = getTranslationStrings().startupInitOptions;

type StartupInitPassthroughDefinition = {
  key: string;
  value: string;
  supportedRuntimeVersions?: readonly NethackRuntimeVersion[];
};

const automaticRuntimeInitOptionTokensByVersion: Readonly<
  Record<NethackRuntimeVersion, readonly string[]>
> = {
  "3.6.7": [
    "mouse_support",
    "runmode:walk",
    "time",
    "showexp",
    "showscore",
    "statushilites",
    "force_invmenu",
    "boulder:0",
    "clicklook",
  ],
  "5.0": [
    "mouse_support",
    "runmode:walk",
    "time",
    "showexp",
    "showscore",
    "statushilites",
    "force_invmenu",
    "boulder:0",
    "!bones",
  ],
  slashem: [
    "mouse_support",
    "runmode:walk",
    "time",
    "showexp",
    "showscore",
    "boulder:0",
  ],
  evilhack: [
    "number_pad:1",
    "mouse_support",
    "runmode:walk",
    "time",
    "showexp",
    "showscore",
    "statushilites",
    "boulder:0",
    // NOTE: do NOT set "player_selection:prompts" here. With prompts mode EvilHack
    // forces interactive y/n/getlin role/race/gender/align prompting on stdin and
    // ignores pre-set NETHACKOPTIONS tokens, which causes the engine to block
    // silently inside player_selection() waiting for stdin we never feed.
    // Default (VIA_DIALOG) routes through shim_player_selection (handled in
    // LocalNetHackRuntime) and honors role/race/gender/align/name tokens.
  ],
};

const requiredStartupInitOptionTokensByVersion: Readonly<
  Record<NethackRuntimeVersion, readonly string[]>
> = {
  "3.6.7": ["checkpoint"],
  "5.0": ["checkpoint"],
  slashem: ["checkpoint"],
  evilhack: ["checkpoint"],
};

export const startupInitOptionDefinitions: ReadonlyArray<StartupInitOptionDefinition> =
  [
    {
      key: "playmode",
      label: startupStrings.options.playmode.label,
      description: startupStrings.options.playmode.description,
      control: "select",
      defaultValue: "normal",
      options: [
        {
          value: "normal",
          label: startupStrings.options.playmode.options.normal,
        },
        {
          value: "explore",
          label: startupStrings.options.playmode.options.explore,
        },
        {
          value: "debug",
          label: startupStrings.options.playmode.options.debug,
        },
      ],
      supportedRuntimeVersions: ["3.6.7", "5.0", "evilhack"],
    },
    {
      key: "number_pad",
      label: startupStrings.options.number_pad.label,
      description: startupStrings.options.number_pad.description,
      control: "select",
      defaultValue: "1",
      options: [
        {
          value: "1",
          label: startupStrings.options.number_pad.options.numeric,
        },
        { value: "0", label: startupStrings.options.number_pad.options.vi },
      ],
    },
    {
      key: "autopickup",
      label: startupStrings.options.autopickup.label,
      description: startupStrings.options.autopickup.description,
      control: "boolean",
      defaultValue: true,
    },
    {
      key: "pickup_types",
      label: startupStrings.options.pickup_types.label,
      description: startupStrings.options.pickup_types.description,
      control: "text",
      defaultValue: "$",
      maxLength: 20,
      placeholder: startupStrings.options.pickup_types.placeholder,
    },
    {
      key: "pickup_thrown",
      label: startupStrings.options.pickup_thrown.label,
      description: startupStrings.options.pickup_thrown.description,
      control: "boolean",
      defaultValue: true,
    },
    {
      key: "pickup_burden",
      label: startupStrings.options.pickup_burden.label,
      description: startupStrings.options.pickup_burden.description,
      control: "select",
      defaultValue: "n",
      options: [
        { value: "u", label: startupStrings.options.pickup_burden.options.u },
        { value: "b", label: startupStrings.options.pickup_burden.options.b },
        { value: "s", label: startupStrings.options.pickup_burden.options.s },
        { value: "n", label: startupStrings.options.pickup_burden.options.n },
        { value: "t", label: startupStrings.options.pickup_burden.options.t },
        { value: "l", label: startupStrings.options.pickup_burden.options.l },
      ],
    },
    {
      key: "pile_limit",
      label: startupStrings.options.pile_limit.label,
      description: startupStrings.options.pile_limit.description,
      control: "number",
      defaultValue: 5,
      min: 0,
      max: 50,
      step: 1,
      supportedRuntimeVersions: ["3.6.7", "5.0"],
    },
    {
      key: "autoquiver",
      label: startupStrings.options.autoquiver.label,
      description: startupStrings.options.autoquiver.description,
      control: "boolean",
      defaultValue: false,
    },
    {
      key: "autoopen",
      label: startupStrings.options.autoopen.label,
      description: startupStrings.options.autoopen.description,
      control: "boolean",
      defaultValue: true,
      supportedRuntimeVersions: ["3.6.7", "5.0"],
    },
    {
      key: "autodig",
      label: startupStrings.options.autodig.label,
      description: startupStrings.options.autodig.description,
      control: "boolean",
      defaultValue: false,
    },
    {
      key: "cmdassist",
      label: startupStrings.options.cmdassist.label,
      description: startupStrings.options.cmdassist.description,
      control: "boolean",
      defaultValue: true,
    },
    {
      key: "confirm",
      label: startupStrings.options.confirm.label,
      description: startupStrings.options.confirm.description,
      control: "boolean",
      defaultValue: true,
    },
    {
      key: "safe_pet",
      label: startupStrings.options.safe_pet.label,
      description: startupStrings.options.safe_pet.description,
      control: "boolean",
      defaultValue: true,
    },
    {
      key: "help",
      label: startupStrings.options.help.label,
      description: startupStrings.options.help.description,
      control: "boolean",
      defaultValue: true,
    },
    {
      key: "legacy",
      label: startupStrings.options.legacy.label,
      description: startupStrings.options.legacy.description,
      control: "boolean",
      defaultValue: true,
    },
    {
      key: "rest_on_space",
      label: startupStrings.options.rest_on_space.label,
      description: startupStrings.options.rest_on_space.description,
      control: "boolean",
      defaultValue: false,
    },
    {
      key: "pushweapon",
      label: startupStrings.options.pushweapon.label,
      description: startupStrings.options.pushweapon.description,
      control: "boolean",
      defaultValue: false,
    },
    {
      key: "extmenu",
      label: startupStrings.options.extmenu.label,
      description: startupStrings.options.extmenu.description,
      control: "boolean",
      defaultValue: false,
    },
    {
      key: "fixinv",
      label: startupStrings.options.fixinv.label,
      description: startupStrings.options.fixinv.description,
      control: "boolean",
      defaultValue: true,
    },
    {
      key: "implicit_uncursed",
      label: startupStrings.options.implicit_uncursed.label,
      description: startupStrings.options.implicit_uncursed.description,
      control: "boolean",
      defaultValue: true,
      supportedRuntimeVersions: ["3.6.7", "5.0"],
    },
    {
      key: "mention_walls",
      label: startupStrings.options.mention_walls.label,
      description: startupStrings.options.mention_walls.description,
      control: "boolean",
      defaultValue: false,
      supportedRuntimeVersions: ["3.6.7", "5.0"],
    },
    // {
    //   key: "news",
    //   label: "Startup News",
    //   description: "Show NetHack news text at startup when available.",
    //   control: "boolean",
    //   defaultValue: true,
    // },
    {
      key: "sortloot",
      label: startupStrings.options.sortloot.label,
      description: startupStrings.options.sortloot.description,
      control: "select",
      defaultValue: "l",
      options: [
        { value: "f", label: startupStrings.options.sortloot.options.f },
        { value: "l", label: startupStrings.options.sortloot.options.l },
        { value: "n", label: startupStrings.options.sortloot.options.n },
      ],
      supportedRuntimeVersions: ["3.6.7", "5.0"],
    },
    {
      key: "sortpack",
      label: startupStrings.options.sortpack.label,
      description: startupStrings.options.sortpack.description,
      control: "boolean",
      defaultValue: true,
    },
    {
      key: "msghistory",
      label: startupStrings.options.msghistory.label,
      description: startupStrings.options.msghistory.description,
      control: "number",
      defaultValue: 20,
      min: 20,
      max: 500,
      step: 1,
    },
    {
      key: "dogname",
      label: startupStrings.options.dogname.label,
      description: startupStrings.options.dogname.description,
      control: "text",
      defaultValue: "",
      maxLength: 30,
      placeholder: startupStrings.options.dogname.placeholder,
    },
    {
      key: "catname",
      label: startupStrings.options.catname.label,
      description: startupStrings.options.catname.description,
      control: "text",
      defaultValue: "",
      maxLength: 30,
      placeholder: startupStrings.options.catname.placeholder,
    },
    {
      key: "horsename",
      label: startupStrings.options.horsename.label,
      description: startupStrings.options.horsename.description,
      control: "text",
      defaultValue: "",
      maxLength: 30,
      placeholder: startupStrings.options.horsename.placeholder,
    },
    {
      key: "pettype",
      label: startupStrings.options.pettype.label,
      description: startupStrings.options.pettype.description,
      control: "select",
      defaultValue: "",
      options: [
        { value: "", label: startupStrings.options.pettype.options.default },
        { value: "cat", label: startupStrings.options.pettype.options.cat },
        { value: "dog", label: startupStrings.options.pettype.options.dog },
        { value: "horse", label: startupStrings.options.pettype.options.horse },
        { value: "none", label: startupStrings.options.pettype.options.none },
      ],
    },
    {
      key: "fruit",
      label: startupStrings.options.fruit.label,
      description: startupStrings.options.fruit.description,
      control: "text",
      defaultValue: "",
      maxLength: 31,
      placeholder: startupStrings.options.fruit.placeholder,
    },
    {
      key: "packorder",
      label: startupStrings.options.packorder.label,
      description: startupStrings.options.packorder.description,
      control: "text",
      defaultValue: "",
      maxLength: 20,
      placeholder: startupStrings.options.packorder.placeholder,
    },
    {
      key: "paranoid_confirmation",
      label: startupStrings.options.paranoid_confirmation.label,
      description: startupStrings.options.paranoid_confirmation.description,
      control: "text",
      defaultValue: "",
      maxLength: 64,
      placeholder: "startupStrings.options.paranoid_confirmation.placeholder",
      supportedRuntimeVersions: ["3.6.7", "5.0"],
    },
    {
      key: "sparkle",
      label: startupStrings.options.sparkle.label,
      description: startupStrings.options.sparkle.description,
      control: "boolean",
      defaultValue: true,
    },
    {
      key: "standout",
      label: startupStrings.options.standout.label,
      description: startupStrings.options.standout.description,
      control: "boolean",
      defaultValue: false,
    },
    {
      key: "tombstone",
      label: startupStrings.options.tombstone.label,
      description: startupStrings.options.tombstone.description,
      control: "boolean",
      defaultValue: true,
    },
    {
      key: "verbose",
      label: startupStrings.options.verbose.label,
      description: startupStrings.options.verbose.description,
      control: "boolean",
      defaultValue: true,
    },
  ];

const startupInitOptionDefinitionByKey = new Map<
  string,
  StartupInitOptionDefinition
>(
  startupInitOptionDefinitions.map((definition) => [
    definition.key.toLowerCase(),
    definition,
  ]),
);

const supportedPassthroughStartupInitOptionDefinitions: ReadonlyArray<StartupInitPassthroughDefinition> =
  [
    {
      key: "getpos.autodescribe",
      value: "nothing",
      supportedRuntimeVersions: ["3.6.7", "5.0"],
    },
  ];

const supportedPassthroughStartupInitOptionDefinitionByKey = new Map<
  string,
  StartupInitPassthroughDefinition
>(
  supportedPassthroughStartupInitOptionDefinitions.map((definition) => [
    definition.key,
    definition,
  ]),
);

function isRuntimeVersionSupported(
  runtimeVersion?: NethackRuntimeVersion,
  supportedRuntimeVersions?: readonly NethackRuntimeVersion[],
): boolean {
  if (!runtimeVersion || !supportedRuntimeVersions?.length) {
    return true;
  }
  return supportedRuntimeVersions.includes(runtimeVersion);
}

function isStartupInitOptionDefinitionSupported(
  definition: StartupInitOptionDefinition,
  runtimeVersion?: NethackRuntimeVersion,
): boolean {
  return isRuntimeVersionSupported(
    runtimeVersion,
    definition.supportedRuntimeVersions,
  );
}

function getRequiredStartupInitOptionTokens(
  runtimeVersion?: NethackRuntimeVersion,
): readonly string[] {
  if (runtimeVersion) {
    return requiredStartupInitOptionTokensByVersion[runtimeVersion] ?? [];
  }
  const tokenByKey = new Map<string, string>();
  for (const tokens of Object.values(
    requiredStartupInitOptionTokensByVersion,
  )) {
    for (const token of tokens) {
      tokenByKey.set(extractOptionKey(token), token);
    }
  }
  return Array.from(tokenByKey.values());
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getStepDecimalPlaces(step: number): number {
  const text = String(step);
  const dotIndex = text.indexOf(".");
  return dotIndex < 0 ? 0 : Math.max(0, text.length - dotIndex - 1);
}

function normalizeNumberValue(
  definition: StartupInitOptionNumberDefinition,
  rawValue: unknown,
): number {
  const numeric =
    typeof rawValue === "number" && Number.isFinite(rawValue)
      ? rawValue
      : Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return definition.defaultValue;
  }
  const clamped = clampNumber(numeric, definition.min, definition.max);
  const step = Math.max(0.000001, definition.step);
  const stepsFromMin = Math.round((clamped - definition.min) / step);
  const snapped = definition.min + stepsFromMin * step;
  const decimals = getStepDecimalPlaces(step);
  return Number(
    clampNumber(snapped, definition.min, definition.max).toFixed(decimals),
  );
}

function sanitizeTextValue(rawValue: unknown, maxLength: number): string {
  if (typeof rawValue !== "string") {
    return "";
  }
  const sanitized = rawValue
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized.slice(0, Math.max(0, maxLength));
}

function normalizeSelectValue(
  definition: StartupInitOptionSelectDefinition,
  rawValue: unknown,
): string {
  if (typeof rawValue !== "string") {
    return definition.defaultValue;
  }
  const normalized = rawValue.trim().toLowerCase();
  const allowedValue = definition.options.find(
    (option) => option.value.toLowerCase() === normalized,
  );
  return allowedValue ? allowedValue.value : definition.defaultValue;
}

function normalizeOptionValue(
  definition: StartupInitOptionDefinition,
  rawValue: unknown,
): StartupInitOptionValue {
  switch (definition.control) {
    case "boolean":
      return typeof rawValue === "boolean" ? rawValue : definition.defaultValue;
    case "select":
      return normalizeSelectValue(definition, rawValue);
    case "text":
      return sanitizeTextValue(rawValue, definition.maxLength);
    case "number":
      return normalizeNumberValue(definition, rawValue);
    default:
      return "";
  }
}

function extractOptionKey(token: string): string {
  const withoutNegation = token.startsWith("!") ? token.slice(1) : token;
  const separatorIndex = withoutNegation.indexOf(":");
  if (separatorIndex < 0) {
    return withoutNegation.toLowerCase();
  }
  return withoutNegation.slice(0, separatorIndex).toLowerCase();
}

function sanitizePassthroughStartupInitOptionToken(
  optionKey: string,
  rawValue: string,
  runtimeVersion?: NethackRuntimeVersion,
): string | null {
  const definition =
    supportedPassthroughStartupInitOptionDefinitionByKey.get(optionKey);
  if (
    !definition ||
    !isRuntimeVersionSupported(
      runtimeVersion,
      definition.supportedRuntimeVersions,
    )
  ) {
    return null;
  }
  const normalizedValue = String(rawValue || "")
    .trim()
    .toLowerCase();
  if (normalizedValue !== definition.value) {
    return null;
  }
  return `${definition.key}:${definition.value}`;
}

export function getStartupInitOptionDefinitions(
  runtimeVersion?: NethackRuntimeVersion,
): ReadonlyArray<StartupInitOptionDefinition> {
  if (!runtimeVersion) {
    return startupInitOptionDefinitions;
  }
  return startupInitOptionDefinitions.filter((definition) =>
    isStartupInitOptionDefinitionSupported(definition, runtimeVersion),
  );
}

export function isStartupInitOptionSupported(
  optionKey: string,
  runtimeVersion?: NethackRuntimeVersion,
): boolean {
  const normalizedKey = String(optionKey || "")
    .trim()
    .toLowerCase();
  const definition = startupInitOptionDefinitionByKey.get(normalizedKey);
  if (!definition) {
    return false;
  }
  return isStartupInitOptionDefinitionSupported(definition, runtimeVersion);
}

export function getAutomaticRuntimeInitOptionTokens(
  runtimeVersion: NethackRuntimeVersion,
): string[] {
  return [...(automaticRuntimeInitOptionTokensByVersion[runtimeVersion] ?? [])];
}

export function createDefaultStartupInitOptionValues(): StartupInitOptionValues {
  const values: StartupInitOptionValues = {};
  for (const definition of startupInitOptionDefinitions) {
    values[definition.key] = definition.defaultValue;
  }
  return values;
}

export function normalizeStartupInitOptionValues(
  rawValues: unknown,
): StartupInitOptionValues {
  const source =
    rawValues && typeof rawValues === "object"
      ? (rawValues as Record<string, unknown>)
      : {};
  const normalized = createDefaultStartupInitOptionValues();
  for (const definition of startupInitOptionDefinitions) {
    normalized[definition.key] = normalizeOptionValue(
      definition,
      source[definition.key],
    );
  }
  return normalized;
}

export function serializeStartupInitOptionTokens(
  values: StartupInitOptionValues,
  runtimeVersion?: NethackRuntimeVersion,
): string[] {
  const tokens: string[] = [];
  for (const definition of getStartupInitOptionDefinitions(runtimeVersion)) {
    const normalizedValue = normalizeOptionValue(
      definition,
      values[definition.key],
    );
    if (definition.control === "boolean") {
      tokens.push(normalizedValue ? definition.key : `!${definition.key}`);
      continue;
    }
    const serializedValue = String(normalizedValue ?? "").trim();
    if (!serializedValue) {
      continue;
    }
    tokens.push(`${definition.key}:${serializedValue}`);
  }
  return tokens;
}

export function sanitizeStartupInitOptionToken(
  rawToken: unknown,
  runtimeVersion?: NethackRuntimeVersion,
): string | null {
  if (typeof rawToken !== "string") {
    return null;
  }
  const trimmedToken = rawToken.trim();
  if (!trimmedToken || trimmedToken.includes(",")) {
    return null;
  }
  const negated = trimmedToken.startsWith("!");
  const withoutNegation = negated ? trimmedToken.slice(1).trim() : trimmedToken;
  if (!withoutNegation) {
    return null;
  }
  const separatorIndex = withoutNegation.indexOf(":");
  const optionKey = (
    separatorIndex < 0
      ? withoutNegation
      : withoutNegation.slice(0, separatorIndex)
  )
    .trim()
    .toLowerCase();
  const definition = startupInitOptionDefinitionByKey.get(optionKey);
  if (!definition) {
    if (negated || separatorIndex < 0) {
      return null;
    }
    const rawValue = withoutNegation.slice(separatorIndex + 1);
    return sanitizePassthroughStartupInitOptionToken(
      optionKey,
      rawValue,
      runtimeVersion,
    );
  }
  if (!isStartupInitOptionDefinitionSupported(definition, runtimeVersion)) {
    return null;
  }
  if (definition.control === "boolean") {
    if (separatorIndex >= 0) {
      return null;
    }
    return negated ? `!${definition.key}` : definition.key;
  }
  if (negated || separatorIndex < 0) {
    return null;
  }
  const rawValue = withoutNegation.slice(separatorIndex + 1);
  const normalizedValue = normalizeOptionValue(definition, rawValue);
  const serializedValue = String(normalizedValue ?? "").trim();
  if (!serializedValue) {
    return null;
  }
  return `${definition.key}:${serializedValue}`;
}

export function sanitizeStartupInitOptionTokens(
  rawTokens: unknown,
  runtimeVersion?: NethackRuntimeVersion,
): string[] {
  if (!Array.isArray(rawTokens) || rawTokens.length === 0) {
    return [];
  }
  const tokenByKey = new Map<string, string>();
  for (const rawToken of rawTokens) {
    const sanitizedToken = sanitizeStartupInitOptionToken(
      rawToken,
      runtimeVersion,
    );
    if (!sanitizedToken) {
      continue;
    }
    tokenByKey.set(extractOptionKey(sanitizedToken), sanitizedToken);
  }
  return Array.from(tokenByKey.values());
}

export function appendRequiredStartupInitOptionTokens(
  rawTokens: unknown,
  runtimeVersion?: NethackRuntimeVersion,
): string[] {
  const tokenByKey = new Map<string, string>();
  for (const token of sanitizeStartupInitOptionTokens(
    rawTokens,
    runtimeVersion,
  )) {
    tokenByKey.set(extractOptionKey(token), token);
  }
  for (const requiredToken of getRequiredStartupInitOptionTokens(
    runtimeVersion,
  )) {
    tokenByKey.set(extractOptionKey(requiredToken), requiredToken);
  }
  return Array.from(tokenByKey.values());
}
