import {
  getSupportedLocaleOptions,
  getTranslationStrings
} from "../../../i18n/core";

/** Module-time translation snapshot shared by all app features. */
export const translationStrings = getTranslationStrings();

export const commonStrings = translationStrings.common;

export const t = translationStrings.app;

export const supportedLocaleOptions = getSupportedLocaleOptions();
