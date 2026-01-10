import {
  I18nStringType,
  I18nTextType,
  SupportedLanguage,
  DEFAULT_LANGUAGE,
} from "@/models/common.model";
import { translationService } from "@/services/translationService";
import { logger } from "@/utils/logger";

/**
 * Get translated string from I18nStringType based on language
 * @param i18nString - I18nString object or plain string
 * @param lang - Target language (default: en)
 * @returns Translated string or fallback to English
 */
export const getTranslatedString = (
  i18nString: I18nStringType | string | null | undefined,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): string => {
  if (!i18nString) {
    return "";
  }

  // If it's a plain string, return as is
  if (typeof i18nString === "string") {
    return i18nString;
  }

  // Return the requested language or fallback to English
  return i18nString[lang] || i18nString.en || "";
};

/**
 * Get translated text from I18nTextType based on language
 * @param i18nText - I18nText object or plain string
 * @param lang - Target language (default: en)
 * @returns Translated text or fallback to English
 */
export const getTranslatedText = (
  i18nText: I18nTextType | string | null | undefined,
  lang: SupportedLanguage = DEFAULT_LANGUAGE
): string => {
  if (!i18nText) {
    return "";
  }

  // If it's a plain string, return as is
  if (typeof i18nText === "string") {
    return i18nText;
  }

  // Return the requested language or fallback to English
  return i18nText[lang] || i18nText.en || "";
};

/**
 * Convert user language string to SupportedLanguage code
 * @param userLanguage - User language from database (e.g., "English", "Dutch")
 * @returns SupportedLanguage code (e.g., "en", "nl")
 */
export const getUserLanguageCode = (
  userLanguage?: string | null
): SupportedLanguage => {
  if (!userLanguage) {
    return DEFAULT_LANGUAGE;
  }

  const languageMap: Record<string, SupportedLanguage> = {
    english: "en",
    dutch: "nl",
    german: "de",
    french: "fr",
    spanish: "es",
  };

  const normalized = userLanguage.toLowerCase().trim();
  return languageMap[normalized] || DEFAULT_LANGUAGE;
};

/**
 * Transform object with I18n fields to single language values
 * @param data - Object with I18n fields
 * @param lang - Target language
 * @param i18nStringFields - Array of field names that are I18nString
 * @param i18nTextFields - Array of field names that are I18nText
 * @returns Transformed object with single language values
 */
export const transformI18nObject = (
  data: any,
  lang: SupportedLanguage,
  i18nStringFields: string[] = [],
  i18nTextFields: string[] = []
): any => {
  // Handle primitives
  if (!data || typeof data !== "object") {
    return data;
  }

  // Handle Mongoose ObjectId buffer (convert to string) - check this BEFORE array check
  if (data.buffer && Array.isArray(data.buffer)) {
    // This is a Mongoose ObjectId in buffer format
    return data.toString ? data.toString() : String(data);
  }

  // CRITICAL: Check for array-like objects (objects with only numeric keys) BEFORE processing
  // This must be done BEFORE Array.isArray check to catch converted arrays
  if (!Array.isArray(data) && typeof data === "object") {
    const keys = Object.keys(data);
    // Check if all keys are numeric (indicating this is a converted array)
    if (keys.length > 0 && keys.every((key) => /^\d+$/.test(key))) {
      // This is an array-like object, convert to array and recurse
      const sortedKeys = keys.sort((a, b) => parseInt(a) - parseInt(b));
      const arrayFromObject = sortedKeys.map((key) => data[key]);
      // Recursively transform the array
      return transformI18nObject(
        arrayFromObject,
        lang,
        i18nStringFields,
        i18nTextFields
      );
    }
  }

  // Handle arrays - create new array with transformed items
  // IMPORTANT: Always return an array, never convert to object
  if (Array.isArray(data)) {
    // Use map to ensure we always return an array
    const transformedArray: any[] = [];
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      // Create a copy of the item before transforming to avoid mutating read-only properties
      let itemCopy: any = item;
      if (item && typeof item === "object" && !Array.isArray(item)) {
        try {
          // Try to create a shallow copy
          itemCopy = { ...item };
        } catch (error) {
          // If copying fails (read-only properties), use JSON parse/stringify
          try {
            itemCopy = JSON.parse(JSON.stringify(item));
          } catch (e) {
            // If that also fails, use the item as is
            itemCopy = item;
          }
        }
      }
      transformedArray.push(
        transformI18nObject(itemCopy, lang, i18nStringFields, i18nTextFields)
      );
    }

    // CRITICAL: transformedArray is created using push, so it's guaranteed to be an array
    // But add safety check just in case
    if (!Array.isArray(transformedArray)) {
      logger.warn("Array transformation returned non-array, converting back", {
        type: typeof transformedArray,
        isArray: Array.isArray(transformedArray),
      });
      // Convert back to array
      return Object.keys(transformedArray)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((key) => transformedArray[key]);
    }

    return transformedArray;
  }

  // Handle regular objects (not arrays, not array-like)
  const result: any = {};

  // Use Object.keys instead of Object.entries to have more control
  const keys = Object.keys(data);
  for (const key of keys) {
    const value = data[key];

    // Skip __v and other internal fields
    if (key === "__v") {
      continue;
    }

    // Convert _id buffer to string if needed
    if (key === "_id") {
      if (value && typeof value === "object" && (value as any).buffer) {
        result[key] = (value as any).toString
          ? (value as any).toString()
          : String(value);
      } else if (value && typeof value === "object" && (value as any)._id) {
        // Nested _id
        result[key] = transformI18nObject(
          value,
          lang,
          i18nStringFields,
          i18nTextFields
        );
      } else {
        result[key] = value;
      }
      continue;
    }

    // Handle audit fields (createdBy, updatedBy) - convert ObjectId buffers to strings
    if (key === "createdBy" || key === "updatedBy") {
      if (value && typeof value === "object") {
        const auditValue = value as any;
        // Priority: use _id if it exists (it's already a string in the response)
        if (auditValue._id !== undefined && auditValue._id !== null) {
          result[key] =
            typeof auditValue._id === "string"
              ? auditValue._id
              : auditValue._id.toString
              ? auditValue._id.toString()
              : String(auditValue._id);
        } else if (auditValue.buffer) {
          // If it has buffer but no _id, convert buffer to string
          if (auditValue.toString) {
            result[key] = auditValue.toString();
          } else {
            result[key] = String(auditValue);
          }
        } else {
          // If it's already a string or other type, keep it
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
      continue;
    }

    // Transform I18nString fields
    if (i18nStringFields.includes(key)) {
      // Get the translated string (single language value)
      // This converts I18n object {en: "...", nl: "...", de: "..."} to single string
      const translated = getTranslatedString(value as I18nStringType, lang);
      result[key] = translated; // Store as string, not object
    }
    // Transform I18nText fields
    else if (i18nTextFields.includes(key)) {
      // Get the translated text (single language value)
      // This converts I18n object {en: "...", nl: "...", de: "..."} to single string
      const translated = getTranslatedText(value as I18nTextType, lang);
      result[key] = translated; // Store as string, not object
    }
    // Handle nested objects (like categoryId, authorId, etc.)
    else if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      // Create a copy of the nested object to avoid mutating read-only properties
      const nestedValue = value as any;

      // Convert to plain object if it's a Mongoose document
      let nestedCopy: any;
      try {
        // Try to create a copy - if it fails, use the value as is
        nestedCopy = { ...nestedValue };

        // Handle _id in nested objects (convert buffer to string if needed)
        if (nestedValue._id) {
          if (nestedValue._id.buffer && Array.isArray(nestedValue._id.buffer)) {
            // This is a Mongoose ObjectId in buffer format
            nestedCopy._id = nestedValue._id.toString
              ? nestedValue._id.toString()
              : String(nestedValue._id);
          } else if (
            typeof nestedValue._id === "object" &&
            nestedValue._id.toString
          ) {
            nestedCopy._id = nestedValue._id.toString();
          } else {
            nestedCopy._id = nestedValue._id;
          }
        }

        // Handle audit fields (createdBy, updatedBy) in nested objects
        if (nestedValue.createdBy) {
          if (
            typeof nestedValue.createdBy === "object" &&
            nestedValue.createdBy._id
          ) {
            nestedCopy.createdBy =
              typeof nestedValue.createdBy._id === "string"
                ? nestedValue.createdBy._id
                : nestedValue.createdBy._id.toString
                ? nestedValue.createdBy._id.toString()
                : String(nestedValue.createdBy._id);
          } else if (typeof nestedValue.createdBy === "string") {
            nestedCopy.createdBy = nestedValue.createdBy;
          } else {
            nestedCopy.createdBy = nestedValue.createdBy?.toString
              ? nestedValue.createdBy.toString()
              : String(nestedValue.createdBy || "");
          }
        }
        if (nestedValue.updatedBy) {
          if (
            typeof nestedValue.updatedBy === "object" &&
            nestedValue.updatedBy._id
          ) {
            nestedCopy.updatedBy =
              typeof nestedValue.updatedBy._id === "string"
                ? nestedValue.updatedBy._id
                : nestedValue.updatedBy._id.toString
                ? nestedValue.updatedBy._id.toString()
                : String(nestedValue.updatedBy._id);
          } else if (typeof nestedValue.updatedBy === "string") {
            nestedCopy.updatedBy = nestedValue.updatedBy;
          } else {
            nestedCopy.updatedBy = nestedValue.updatedBy?.toString
              ? nestedValue.updatedBy.toString()
              : String(nestedValue.updatedBy || "");
          }
        }
      } catch (error) {
        // If copying fails (read-only properties), use JSON parse/stringify
        try {
          nestedCopy = JSON.parse(JSON.stringify(nestedValue));
        } catch (e) {
          // If that also fails, just use the value as is
          nestedCopy = nestedValue;
        }
      }

      // Check for common I18n fields in nested objects (title, name, description)
      // This handles cases like categoryId.title, couponId.name, etc.
      let hasI18nFields = false;

      // Check for title field (for categories, blogCategories, etc.)
      if (
        nestedValue.title &&
        typeof nestedValue.title === "object" &&
        !Array.isArray(nestedValue.title) &&
        !(nestedValue.title instanceof Date)
      ) {
        nestedCopy.title = getTranslatedString(nestedValue.title, lang);
        hasI18nFields = true;
      }

      // Check for name field (for coupons, productIngredients, etc.)
      if (
        nestedValue.name &&
        typeof nestedValue.name === "object" &&
        !Array.isArray(nestedValue.name) &&
        !(nestedValue.name instanceof Date)
      ) {
        nestedCopy.name = getTranslatedString(nestedValue.name, lang);
        hasI18nFields = true;
      }

      // Check for description field (for various models)
      if (
        nestedValue.description &&
        typeof nestedValue.description === "object" &&
        !Array.isArray(nestedValue.description) &&
        !(nestedValue.description instanceof Date)
      ) {
        nestedCopy.description = getTranslatedText(
          nestedValue.description,
          lang
        );
        hasI18nFields = true;
      }

      // If we found and transformed I18n fields, also recursively transform the rest
      if (hasI18nFields) {
        // Recursively transform other fields in the nested object
        result[key] = transformI18nObject(
          nestedCopy,
          lang,
          i18nStringFields,
          i18nTextFields
        );
      } else {
        // Recursively transform nested objects
        result[key] = transformI18nObject(
          nestedCopy,
          lang,
          i18nStringFields,
          i18nTextFields
        );
      }
    }
    // Keep other values as is
    else {
      result[key] = value;
    }
  }

  return result;
};

/**
 * Helper to get nested value from object using dot notation path
 */
const getNestedValue = (obj: any, path: string): any => {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[key];
  }
  return current;
};

/**
 * Helper to set nested value in object using dot notation path
 */
const setNestedValue = (obj: any, path: string, value: any): void => {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
};

/**
 * Prepare data for translation (convert English strings to I18n objects)
 * @param data - Data object
 * @param i18nStringFields - Fields that should be I18nString (supports dot notation like "banner.title")
 * @param i18nTextFields - Fields that should be I18nText (supports dot notation like "banner.subtitle")
 * @returns Data with I18n objects ready for translation
 */
export const prepareDataForTranslation = async (
  data: Record<string, any>,
  i18nStringFields: string[] = [],
  i18nTextFields: string[] = []
): Promise<Record<string, any>> => {
  const result = { ...data };

  // Process I18nString fields (supports nested paths like "banner.title")
  for (const field of i18nStringFields) {
    const fieldValue = field.includes(".")
      ? getNestedValue(data, field)
      : data[field];

    if (fieldValue !== undefined && fieldValue !== null) {
      let translatedValue: any;

      // If it's already an I18n object with English, translate it
      if (
        typeof fieldValue === "object" &&
        !Array.isArray(fieldValue) &&
        fieldValue.en
      ) {
        translatedValue = await translationService.translateI18nString(
          fieldValue
        );
      }
      // If it's a plain string, convert to I18n and translate
      else if (typeof fieldValue === "string" && fieldValue.trim()) {
        translatedValue = await translationService.translateI18nString(
          fieldValue
        );
      } else {
        continue; // Skip if not a valid value
      }

      // Set the translated value back to the nested path
      if (field.includes(".")) {
        setNestedValue(result, field, translatedValue);
      } else {
        result[field] = translatedValue;
      }
    }
  }

  // Process I18nText fields (supports nested paths like "banner.subtitle")
  for (const field of i18nTextFields) {
    const fieldValue = field.includes(".")
      ? getNestedValue(data, field)
      : data[field];

    if (fieldValue !== undefined && fieldValue !== null) {
      let translatedValue: any;

      // If it's already an I18n object with English, translate it
      if (
        typeof fieldValue === "object" &&
        !Array.isArray(fieldValue) &&
        fieldValue.en
      ) {
        translatedValue = await translationService.translateI18nText(
          fieldValue
        );
      }
      // If it's a plain string, convert to I18n and translate
      else if (typeof fieldValue === "string" && fieldValue.trim()) {
        translatedValue = await translationService.translateI18nText(
          fieldValue
        );
      } else {
        continue; // Skip if not a valid value
      }

      // Set the translated value back to the nested path
      if (field.includes(".")) {
        setNestedValue(result, field, translatedValue);
      } else {
        result[field] = translatedValue;
      }
    }
  }

  return result;
};
