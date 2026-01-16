import Joi from "joi";
import { languageService } from "@/services/languageService";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_SUPPORTED_LANGUAGES,
} from "@/constants/languageConstants";

/**
 * Helper to create dynamic I18n validation schemas
 * This allows validation to work with any languages configured in GeneralSettings
 */

/**
 * Get base I18n string schema (requires English, optional other languages)
 * This is used for validation that accepts either a plain string or I18n object
 */
export const getI18nStringSchema = (
  options: {
    required?: boolean;
    maxLength?: number;
    minLength?: number;
    allowEmpty?: boolean;
  } = {}
): Joi.Schema => {
  const {
    required = false,
    maxLength,
    minLength = 1,
    allowEmpty = false,
  } = options;

  // Base schema for I18n object - dynamically built from active languages
  const buildI18nObjectSchema = async () => {
    const allLanguages = await languageService.getAllLanguages();
    const activeLanguages = await languageService.getActiveLanguages();

    const schemaObj: Record<string, Joi.Schema> = {};

    // English is always required
    schemaObj.en = Joi.string()
      .trim()
      .min(minLength)
      .required()
      .messages({
        "any.required": "English content is required",
        "string.min": `English content must be at least ${minLength} character(s)`,
      });

    if (
      maxLength &&
      typeof schemaObj.en === "object" &&
      "max" in schemaObj.en
    ) {
      schemaObj.en = (schemaObj.en as Joi.StringSchema).max(maxLength);
    }

    // Other languages are optional
    allLanguages.forEach((lang) => {
      if (lang !== "en") {
        let langSchema = Joi.string().trim();
        if (maxLength) {
          langSchema = langSchema.max(maxLength);
        }
        if (allowEmpty) {
          langSchema = langSchema.allow("", null);
        }
        schemaObj[lang] = langSchema.optional();
      }
    });

    return Joi.object(schemaObj);
  };

  // Return schema that accepts either plain string or I18n object
  return Joi.alternatives()
    .try(
      // Plain string (before auto-translation)
      allowEmpty
        ? Joi.string().trim().allow("", null)
        : Joi.string().trim().min(minLength),
      // I18n object (after auto-translation middleware)
      // Use custom validation to allow any language keys dynamically
      Joi.object()
        .unknown(true) // CRITICAL: Allow any keys (for dynamic languages like zh, pt, etc.)
        .custom((value, helpers) => {
          // Validate that English is present and meets requirements
          if (!value || typeof value !== "object") {
            return value;
          }

          // Validate English requirement
          if (!value.en || typeof value.en !== "string") {
            return helpers.error("any.required", {
              message: "English content is required",
            });
          }

          const enValue = String(value.en).trim();
          if (enValue.length < minLength) {
            return helpers.error("string.min", {
              message: `English content must be at least ${minLength} character(s)`,
            });
          }

          if (maxLength && enValue.length > maxLength) {
            return helpers.error("string.max", {
              message: `English content must not exceed ${maxLength} characters`,
            });
          }

          // Validate all other language values are strings (if present)
          for (const [key, val] of Object.entries(value)) {
            if (
              key !== "en" &&
              val !== null &&
              val !== undefined &&
              val !== ""
            ) {
              if (typeof val !== "string") {
                return helpers.error("any.invalid", {
                  message: `${key} must be a string`,
                });
              }
              const trimmedVal = String(val).trim();
              if (maxLength && trimmedVal.length > maxLength) {
                return helpers.error("string.max", {
                  message: `${key} must not exceed ${maxLength} characters`,
                });
              }
            }
          }

          return value;
        })
        .messages({
          "any.required": "English content is required",
          "string.min": `English content must be at least ${minLength} character(s)`,
          "string.max": `English content must not exceed ${maxLength} characters`,
        })
    )
    .when("$required", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .allow(null);
};

/**
 * Get base I18n text schema (all languages optional, English recommended)
 */
export const getI18nTextSchema = (
  options: {
    required?: boolean;
    maxLength?: number;
    allowEmpty?: boolean;
  } = {}
): Joi.Schema => {
  const { required = false, maxLength, allowEmpty = true } = options;

  // Base schema for I18n object - dynamically built from active languages
  const buildI18nObjectSchema = async () => {
    const allLanguages = await languageService.getAllLanguages();

    const schemaObj: Record<string, Joi.Schema> = {};

    // All languages are optional for text fields
    allLanguages.forEach((lang) => {
      let langSchema = Joi.string().trim();
      if (maxLength) {
        langSchema = langSchema.max(maxLength);
      }
      if (allowEmpty) {
        langSchema = langSchema.allow("", null);
      }
      schemaObj[lang] = langSchema.optional();
    });

    return Joi.object(schemaObj);
  };

  // Return schema that accepts either plain string or I18n object
  return Joi.alternatives()
    .try(
      // Plain string (before auto-translation)
      allowEmpty ? Joi.string().trim().allow("", null) : Joi.string().trim(),
      // I18n object (after auto-translation middleware)
      // Use unknown(true) to allow any language keys dynamically
      Joi.object()
        .unknown(true) // CRITICAL: Allow any keys (for dynamic languages like zh, pt, etc.)
        .custom((value, helpers) => {
          // Validate all values are strings (if present)
          if (!value || typeof value !== "object") {
            return value;
          }

          for (const [key, val] of Object.entries(value)) {
            if (val !== null && val !== undefined && val !== "") {
              if (typeof val !== "string") {
                return helpers.error("any.invalid", {
                  message: `${key} must be a string`,
                });
              }
              const trimmedVal = String(val).trim();
              if (maxLength && trimmedVal.length > maxLength) {
                return helpers.error("string.max", {
                  message: `${key} must not exceed ${maxLength} characters`,
                });
              }
            }
          }

          return value;
        })
    )
    .when("$required", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .allow(null);
};

/**
 * Get language validation schema for query parameters
 * Validates against active languages dynamically
 */
export const getLanguageQuerySchema = (
  options: { required?: boolean; default?: string } = {}
): Joi.Schema => {
  const { required = false, default: defaultValue } = options;

  let schema = Joi.string()
    .custom(async (value, helpers) => {
      if (!value && defaultValue) {
        return defaultValue;
      }
      if (!value) {
        return value; // Allow empty/undefined if not required
      }

      const isValid = await languageService.isValidLanguage(value);
      if (!isValid) {
        // Fallback: check common languages for backward compatibility
        const normalized = value.toLowerCase();
        if (DEFAULT_SUPPORTED_LANGUAGES.includes(normalized)) {
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
 * Create a static I18n schema (for backward compatibility)
 * This uses a fallback list of common languages
 */
export const createStaticI18nStringSchema = (
  options: {
    required?: boolean;
    maxLength?: number;
    minLength?: number;
    allowEmpty?: boolean;
  } = {}
): Joi.Schema => {
  const {
    required = false,
    maxLength,
    minLength = 1,
    allowEmpty = false,
  } = options;

  const baseSchema: Record<string, Joi.Schema> = {
    en: Joi.string()
      .trim()
      .min(minLength)
      .required()
      .messages({
        "any.required": "English content is required",
        "string.min": `English content must be at least ${minLength} character(s)`,
      }),
    nl: Joi.string().trim().allow("", null).optional(),
    de: Joi.string().trim().allow("", null).optional(),
    fr: Joi.string().trim().allow("", null).optional(),
    es: Joi.string().trim().allow("", null).optional(),
  };

  if (maxLength) {
    Object.keys(baseSchema).forEach((key) => {
      baseSchema[key] = (baseSchema[key] as Joi.StringSchema).max(maxLength);
    });
  }

  return Joi.alternatives()
    .try(
      allowEmpty
        ? Joi.string().trim().allow("", null)
        : Joi.string().trim().min(minLength),
      Joi.object(baseSchema)
    )
    .when("$required", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .allow(null);
};

/**
 * Create a static I18n text schema (for backward compatibility)
 */
export const createStaticI18nTextSchema = (
  options: {
    required?: boolean;
    maxLength?: number;
    allowEmpty?: boolean;
  } = {}
): Joi.Schema => {
  const { required = false, maxLength, allowEmpty = true } = options;

  const baseSchema: Record<string, Joi.Schema> = {
    en: Joi.string().trim().allow("", null).optional(),
    nl: Joi.string().trim().allow("", null).optional(),
    de: Joi.string().trim().allow("", null).optional(),
    fr: Joi.string().trim().allow("", null).optional(),
    es: Joi.string().trim().allow("", null).optional(),
  };

  if (maxLength) {
    Object.keys(baseSchema).forEach((key) => {
      baseSchema[key] = (baseSchema[key] as Joi.StringSchema).max(maxLength);
    });
  }

  return Joi.alternatives()
    .try(
      allowEmpty ? Joi.string().trim().allow("", null) : Joi.string().trim(),
      Joi.object(baseSchema)
    )
    .when("$required", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .allow(null);
};
