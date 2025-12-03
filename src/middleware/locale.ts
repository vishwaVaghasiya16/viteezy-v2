import { Request, Response, NextFunction } from "express";
import { SupportedLanguage, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@/models/common.model";

export interface LocaleRequest extends Request {
  locale?: SupportedLanguage;
}

/**
 * Middleware to detect and set locale from URL query parameter
 * Usage: ?lang=en, ?lang=nl, etc.
 * Defaults to English if not provided or invalid
 */
export const localeMiddleware = (
  req: LocaleRequest,
  res: Response,
  next: NextFunction
): void => {
  const langParam = (req.query.lang as string)?.toLowerCase();

  // Validate language parameter
  if (langParam && SUPPORTED_LANGUAGES.includes(langParam as SupportedLanguage)) {
    req.locale = langParam as SupportedLanguage;
  } else {
    req.locale = DEFAULT_LANGUAGE;
  }

  next();
};

/**
 * Helper function to get localized value from I18n object
 */
export function getLocalizedValue<T extends { [key: string]: any }>(
  i18nObject: T | undefined | null,
  locale: SupportedLanguage = DEFAULT_LANGUAGE
): string | undefined {
  if (!i18nObject) {
    return undefined;
  }

  // Return value for requested locale, fallback to English, then any available value
  return i18nObject[locale] || i18nObject[DEFAULT_LANGUAGE] || Object.values(i18nObject)[0];
}

/**
 * Helper function to get localized value from I18n object with fallback
 */
export function getLocalizedValueWithFallback<T extends { [key: string]: any }>(
  i18nObject: T | undefined | null,
  locale: SupportedLanguage = DEFAULT_LANGUAGE,
  fallback: string = ""
): string {
  const value = getLocalizedValue(i18nObject, locale);
  return value || fallback;
}

/**
 * Helper function to transform I18n object to single value based on locale
 */
export function transformI18nToLocale<T extends Record<string, any>>(
  obj: T,
  locale: SupportedLanguage = DEFAULT_LANGUAGE
): any {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  const result: any = {};

  for (const [key, value] of Object.entries(obj)) {
    // If value is an I18n object (has language keys), extract localized value
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      (SUPPORTED_LANGUAGES.some((lang) => lang in value))
    ) {
      result[key] = getLocalizedValue(value, locale);
    } else if (Array.isArray(value)) {
      // Handle arrays - check if items are I18n objects
      result[key] = value.map((item) => {
        if (
          item &&
          typeof item === "object" &&
          !(item instanceof Date) &&
          SUPPORTED_LANGUAGES.some((lang) => lang in item)
        ) {
          return getLocalizedValue(item, locale);
        }
        return item;
      });
    } else {
      result[key] = value;
    }
  }

  return result;
}

