import {
  I18nStringType,
  I18nTextType,
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
} from "@/models/common.model";
import { translationService } from "@/services/translationService";

/**
 * Translate I18nString object to all supported languages
 */
export async function translateI18nString(
  i18nString: I18nStringType,
  languages: SupportedLanguage[] = SUPPORTED_LANGUAGES
): Promise<I18nStringType> {
  if (!i18nString?.en) {
    return i18nString;
  }

  return translationService.translateI18nString(i18nString, languages);
}

/**
 * Translate I18nText object to all supported languages
 */
export async function translateI18nText(
  i18nText: I18nTextType,
  languages: SupportedLanguage[] = SUPPORTED_LANGUAGES
): Promise<I18nTextType> {
  if (!i18nText?.en) {
    return i18nText;
  }

  return translationService.translateI18nText(i18nText, languages);
}

/**
 * Translate array of strings (e.g., benefits, ingredients)
 */
export async function translateStringArray(
  strings: string[],
  languages: SupportedLanguage[] = SUPPORTED_LANGUAGES
): Promise<string[]> {
  if (!strings || strings.length === 0) {
    return strings;
  }

  // Translate to all languages and store as array
  // For now, we'll translate to the first target language (nl)
  // In the future, we might want to store translations differently
  const targetLang = languages.find((lang) => lang !== "en") || "nl";
  return translationService.translateStringArray(strings, targetLang);
}

/**
 * Translate product fields that need translation
 */
export async function translateProductFields(data: {
  title?: string;
  description?: string;
  benefits?: string[];
  ingredients?: string[];
  howToUse?: string;
}): Promise<{
  title?: I18nStringType;
  description?: I18nTextType;
  benefits?: string[];
  ingredients?: string[];
  howToUse?: I18nTextType;
}> {
  const result: any = {};

  // Translate title
  if (data.title) {
    result.title = await translateI18nString({ en: data.title });
  }

  // Translate description
  if (data.description) {
    result.description = await translateI18nText({ en: data.description });
  }

  // Translate benefits array
  if (data.benefits && data.benefits.length > 0) {
    // For arrays, we'll keep them as strings for now
    // In the future, we might want to convert to I18nString[]
    result.benefits = data.benefits;
  }

  // Translate ingredients array
  if (data.ingredients && data.ingredients.length > 0) {
    result.ingredients = data.ingredients;
  }

  // Translate howToUse
  if (data.howToUse) {
    result.howToUse = await translateI18nText({ en: data.howToUse });
  }

  return result;
}
