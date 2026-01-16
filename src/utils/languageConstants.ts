import { languageService } from "@/services/languageService";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CODES,
  LANGUAGE_NAMES,
  isValidLanguageCode as validateLanguageCodeFormat,
  normalizeLanguageCode as normalizeCode,
  getLanguageName as getNameByCode,
  getLanguageCode as getCodeByName,
} from "@/constants/languageConstants";

/**
 * Centralized Language Constants and Utilities
 * All language-related constants and helpers should be imported from here
 *
 * @deprecated Use @/constants/languageConstants for new code
 * This file is kept for backward compatibility
 */

// Re-export from constants for backward compatibility
export const DEFAULT_LANGUAGE_CODE = DEFAULT_LANGUAGE.CODE;
export const DEFAULT_LANGUAGE_NAME = DEFAULT_LANGUAGE.NAME;

/**
 * Get language query validation schema (for Joi)
 * Validates against configured languages dynamically
 */
export const getLanguageQuerySchema = async () => {
  const allLanguages = await languageService.getAllLanguages();
  return {
    lang: {
      type: "string",
      valid: allLanguages,
      optional: true,
      default: DEFAULT_LANGUAGE_CODE,
    },
  };
};

/**
 * Get language validation for Joi schema
 * Use this in validation schemas instead of hardcoded .valid("en", "nl", ...)
 */
export const createLanguageValidationSchema = () => {
  // Return a Joi schema that validates against active languages
  // This is async, so we need to handle it differently
  return {
    // For synchronous use, we'll use a custom validator
    custom: async (value: string, helpers: any) => {
      const isValid = await languageService.isValidLanguage(value);
      if (!isValid) {
        return helpers.error("any.invalid");
      }
      return value;
    },
    messages: {
      "any.invalid": "Invalid language code. Must be a configured language.",
    },
  };
};

/**
 * Language name to code mapping (for backward compatibility)
 * This should be dynamically generated from languageService
 */
export const getLanguageNameToCodeMap = async (): Promise<
  Record<string, string>
> => {
  const languages = await languageService.getLanguageSettings();
  const map: Record<string, string> = {};

  languages.forEach((lang) => {
    const normalizedName = lang.name.toLowerCase().trim();
    map[normalizedName] = lang.code.toLowerCase();
  });

  // Add common mappings for backward compatibility
  map["english"] = "en";
  map["dutch"] = "nl";
  map["german"] = "de";
  map["french"] = "fr";
  map["spanish"] = "es";
  map["italian"] = "it";
  map["portuguese"] = "pt";

  return map;
};

/**
 * Convert language name to code
 * @param languageName - Language name (e.g., "English", "Dutch")
 * @returns Language code (e.g., "en", "nl")
 */
export const getLanguageCodeFromName = async (
  languageName?: string | null
): Promise<string> => {
  if (!languageName) {
    return DEFAULT_LANGUAGE.CODE;
  }

  // First try to get from constants
  const codeFromConstants = getCodeByName(languageName);
  if (codeFromConstants) {
    return codeFromConstants;
  }

  // Fallback to languageService
  const map = await getLanguageNameToCodeMap();
  const normalized = languageName.toLowerCase().trim();
  return map[normalized] || DEFAULT_LANGUAGE.CODE;
};

/**
 * Get all language codes (synchronous fallback)
 * Returns default languages if service is not available
 */
export const getDefaultLanguageCodes = (): string[] => {
  return Object.values(LANGUAGE_CODES).map((code) => code.toLowerCase());
};

/**
 * Check if a language code is valid (synchronous check for common languages)
 * For full validation, use languageService.isValidLanguage()
 */
export const isCommonLanguageCode = (code: string): boolean => {
  const normalized = normalizeCode(code);
  return Object.values(LANGUAGE_CODES).some(
    (c) => c.toLowerCase() === normalized
  );
};

/**
 * Get language codes for Joi validation
 * Returns a function that can be used in Joi.valid()
 * Note: This is for backward compatibility. For new code, use createLanguageValidationSchema()
 */
export const getLanguageCodesForValidation = async (): Promise<string[]> => {
  try {
    const allLanguages = await languageService.getAllLanguages();
    return allLanguages;
  } catch (error) {
    // Fallback to default languages
    return getDefaultLanguageCodes();
  }
};

/**
 * Language validation helper for Joi
 * Creates a Joi schema that validates against configured languages
 * This uses a custom validator that checks against languageService
 */
export const createJoiLanguageSchema = (
  options: { required?: boolean; default?: string } = {}
) => {
  const Joi = require("joi");
  const { required = false, default: defaultValue = DEFAULT_LANGUAGE_CODE } =
    options;

  let schema = Joi.string()
    .custom(async (value: string, helpers: any) => {
      if (!value) {
        return defaultValue;
      }

      const isValid = await languageService.isValidLanguage(value);
      if (!isValid) {
        // Fallback: check if it's a common language (for backward compatibility)
        if (isCommonLanguageCode(value)) {
          return value;
        }
        return helpers.error("any.invalid");
      }
      return value;
    })
    .messages({
      "any.invalid": "Invalid language code. Must be a configured language.",
    });

  if (required) {
    schema = schema.required();
  } else {
    schema = schema.optional();
  }

  if (defaultValue) {
    schema = schema.default(defaultValue);
  }

  return schema;
};

/**
 * Get language codes array for Joi.valid()
 * This is a synchronous version that returns common languages
 * For full dynamic validation, use createJoiLanguageSchema() instead
 */
export const getLanguageCodesForJoiValid = (): string[] => {
  // Return common languages for backward compatibility
  // Full validation happens in createJoiLanguageSchema via custom validator
  return getDefaultLanguageCodes();
};

/**
 * Re-export constants from @/constants/languageConstants
 */
export { LANGUAGE_CODES, LANGUAGE_NAMES, DEFAULT_LANGUAGE };

// Re-export helper functions with original names
export const isValidLanguageCode = validateLanguageCodeFormat;
export const normalizeLanguageCode = normalizeCode;
export const getLanguageName = getNameByCode;
export const getLanguageCode = getCodeByName;
