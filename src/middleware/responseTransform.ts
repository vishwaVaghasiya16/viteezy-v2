import mongoose from "mongoose";
import { Response, NextFunction } from "express";
import { LocaleRequest } from "./locale";
import { SupportedLanguage, DEFAULT_LANGUAGE } from "@/models/common.model";

/**
 * Response transformation middleware
 * Transforms I18n objects in response data to single values based on locale
 */
export const responseTransformMiddleware = (
  req: LocaleRequest,
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json.bind(res);
  const locale = req.locale || DEFAULT_LANGUAGE;

  res.json = function (data: any): Response {
    const transformedData = transformResponseData(data, locale);
    return originalJson(transformedData);
  };

  next();
};

/**
 * Recursively transform response data to replace I18n objects with localized values
 */
function transformResponseData(data: any, locale: SupportedLanguage): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => transformResponseData(item, locale));
  }

  // Handle objects
  if (
    typeof data === "object" &&
    !(data instanceof Date) &&
    !(data instanceof mongoose.Types.ObjectId)
  ) {
    // Check if this is an I18n object (has language keys)
    if (isI18nObject(data)) {
      return getLocalizedValueFromI18n(data, locale);
    }

    // Transform nested objects
    const transformed: any = {};
    for (const [key, value] of Object.entries(data)) {
      transformed[key] = transformResponseData(value, locale);
    }
    return transformed;
  }

  return data;
}

/**
 * Check if an object is an I18n object (has language keys)
 */
function isI18nObject(obj: any): boolean {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return false;
  }

  const languageKeys = ["en", "nl", "de", "fr", "es"];
  const hasLanguageKeys = languageKeys.some((key) => key in obj);

  // If it has language keys and not too many other keys, it's likely an I18n object
  if (hasLanguageKeys) {
    const otherKeys = Object.keys(obj).filter(
      (key) => !languageKeys.includes(key)
    );
    return otherKeys.length <= 2; // Allow for some metadata keys
  }

  return false;
}

/**
 * Get localized value from I18n object
 */
function getLocalizedValueFromI18n(
  i18nObject: { [key: string]: any },
  locale: SupportedLanguage
): string | undefined {
  // Return value for requested locale, fallback to English, then any available value
  return (
    i18nObject[locale] ||
    i18nObject[DEFAULT_LANGUAGE] ||
    i18nObject["nl"] ||
    i18nObject["de"] ||
    i18nObject["fr"] ||
    i18nObject["es"] ||
    Object.values(i18nObject)[0]
  );
}
