import Joi from "joi";
import { GENDER_VALUES } from "@/models/enums";
import { withFieldLabels } from "./helpers";
import { languageService } from "@/services/languageService";

export const updateCurrentUserSchema = Joi.object(
  withFieldLabels({
    firstName: Joi.string().trim().min(1).max(50).optional(),
    lastName: Joi.string().trim().min(1).max(50).optional(),
    phone: Joi.string()
      .pattern(/^[+]?[1-9]\d{1,14}$/)
      .message("Phone must be a valid E.164 number")
      .optional(),
    countryCode: Joi.string().optional().allow(null, "").label("Country Code"),
    profileImage: Joi.string().uri().allow(null, "").optional(),
    avatar: Joi.string().uri().allow(null, "").optional(),
    gender: Joi.string()
      .allow(null, "")
      .valid(...GENDER_VALUES)
      .optional(),
    age: Joi.number().integer().min(1).max(150).allow(null).optional(),
    language: Joi.string()
      .custom(async (value, helpers) => {
        if (!value) {
          return value; // Allow empty/undefined
        }
        
        // Get all configured languages from languageService
        const languageSettings = await languageService.getLanguageSettings();
        const validNames = languageSettings.map((lang) => lang.name);
        
        // Also include common language names for backward compatibility
        const commonNames = ["English", "Dutch", "German", "French", "Spanish", "Italian", "Portuguese"];
        const allValidNames = [...new Set([...validNames, ...commonNames])];
        
        if (!allValidNames.includes(value)) {
          return helpers.error("any.invalid");
        }
        return value;
      })
      .optional()
      .label("Language")
      .messages({
        "any.invalid": "Invalid language name. Must be a configured language.",
      }),
  })
)
  .min(1)
  .label("UserUpdatePayload");
