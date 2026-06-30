import { en, type TranslationDictionary } from "./locales/en";
import { deOverrides } from "./locales/de";
import { esOverrides } from "./locales/es";
import { fi } from "./locales/fi";
import { fr } from "./locales/fr";
import { ja } from "./locales/ja";
import { ko } from "./locales/ko";
import { ptBrOverrides } from "./locales/pt-br";
import { ru } from "./locales/ru";
import { zhCnOverrides } from "./locales/zh-cn";
import { mergeTranslations } from "./locale-helpers";

export type SupportedLocale =
  | "de"
  | "en"
  | "es"
  | "fi"
  | "fr"
  | "ja"
  | "ko"
  | "pt-br"
  | "ru"
  | "zh-cn";

const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  de: mergeTranslations(en, deOverrides),
  en,
  es: mergeTranslations(en, esOverrides),
  fi: mergeTranslations(en, fi),
  fr: mergeTranslations(en, fr),
  ja: mergeTranslations(en, ja),
  ko: mergeTranslations(en, ko),
  "pt-br": mergeTranslations(en, ptBrOverrides),
  ru,
  "zh-cn": mergeTranslations(en, zhCnOverrides),
};

const localeStorageKey = "nh3d-locale";

const localeLabels: Record<SupportedLocale, string> = {
  de: "Deutsch",
  en: "English",
  es: "Espa\u00f1ol",
  fi: "Suomi",
  fr: "Français",
  ja: "\u65e5\u672c\u8a9e",
  ko: "\ud55c\uad6d\uc5b4",
  "pt-br": "Portugu\u00eas (Brasil)",
  ru: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439",
  "zh-cn": "\u7b80\u4f53\u4e2d\u6587",
};

const supportedLocales = Object.keys(dictionaries) as SupportedLocale[];

function normalizeLocaleTag(value: string): string {
  return String(value || "")
    .trim()
    .replace(/_/g, "-")
    .toLowerCase();
}

const localeAliases: Record<string, SupportedLocale> = {
  de: "de",
  "de-de": "de",
  "de-at": "de",
  "de-ch": "de",
  es: "es",
  "es-es": "es",
  "es-mx": "es",
  "es-419": "es",
  "es-us": "es",
  fi: "fi",
  "fi-fi": "fi",
  fr: "fr",
  "fr-fr": "fr",
  "fr-ca": "fr",
  "fr-be": "fr",
  "fr-ch": "fr",
  ja: "ja",
  "ja-jp": "ja",
  ko: "ko",
  "ko-kr": "ko",
  pt: "pt-br",
  "pt-br": "pt-br",
  "pt-pt": "pt-br",
  ru: "ru",
  "ru-ru": "ru",
  zh: "zh-cn",
  "zh-cn": "zh-cn",
  "zh-hans": "zh-cn",
  "zh-hans-cn": "zh-cn",
};

export function resolveSupportedLocale(
  value: string | null | undefined,
): SupportedLocale | null {
  const normalized = normalizeLocaleTag(value || "");
  if (!normalized) {
    return null;
  }
  const alias = localeAliases[normalized];
  if (alias) {
    return alias;
  }
  if (supportedLocales.includes(normalized as SupportedLocale)) {
    return normalized as SupportedLocale;
  }
  const languageCode = normalized.split("-")[0];
  if (supportedLocales.includes(languageCode as SupportedLocale)) {
    return languageCode as SupportedLocale;
  }
  return null;
}

function readStoredLocale(): SupportedLocale | null {
  if (
    typeof window === "undefined" ||
    typeof window.localStorage === "undefined"
  ) {
    return null;
  }
  try {
    return resolveSupportedLocale(window.localStorage.getItem(localeStorageKey));
  } catch {
    return null;
  }
}

export function resolveSystemLocale(): SupportedLocale {
  const preferredLocaleCandidates =
    typeof navigator === "undefined"
      ? []
      : Array.isArray(navigator.languages) && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language];
  for (const candidate of preferredLocaleCandidates) {
    const matchedLocale = resolveSupportedLocale(candidate);
    if (matchedLocale) {
      return matchedLocale;
    }
  }
  return "en";
}

function resolveInitialLocale(): SupportedLocale {
  return readStoredLocale() ?? resolveSystemLocale();
}

let currentLocale: SupportedLocale = resolveInitialLocale();

export function getCurrentLocale(): SupportedLocale {
  return currentLocale;
}

export function setCurrentLocale(locale: SupportedLocale): SupportedLocale {
  currentLocale = resolveSupportedLocale(locale) ?? "en";
  if (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  ) {
    try {
      window.localStorage.setItem(localeStorageKey, currentLocale);
    } catch {
      // Ignore localStorage write failures and keep the in-memory locale.
    }
  }
  return currentLocale;
}

export function getTranslationStrings(
  locale: SupportedLocale = currentLocale,
): TranslationDictionary {
  return dictionaries[locale] ?? en;
}

export function getSupportedLocaleOptions(): Array<{
  value: SupportedLocale;
  label: string;
}> {
  return supportedLocales.map((locale) => ({
    value: locale,
    label: localeLabels[locale],
  }));
}

export { en, type TranslationDictionary };
