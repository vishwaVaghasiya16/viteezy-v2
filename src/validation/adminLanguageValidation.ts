import Joi from "joi";
import { withFieldLabels } from "./helpers";
import { LANGUAGE_VALIDATION } from "@/constants/languageConstants";

export const addLanguageSchema = Joi.object(
  withFieldLabels({
    code: Joi.string()
      .pattern(LANGUAGE_VALIDATION.CODE_PATTERN)
      .required()
      .label("Language Code")
      .messages({
        "string.pattern.base":
          "Language code must be a valid 2-letter ISO 639-1 code (e.g., EN, NL, DE, FR, ES, IT, PT, etc.)",
      }),
    name: Joi.string().trim().min(2).max(50).required().label("Language Name"),
    isEnabled: Joi.boolean().optional().default(false).label("Is Enabled"),
  })
).label("AddLanguagePayload");

export const updateLanguageSchema = Joi.object(
  withFieldLabels({
    name: Joi.string().trim().min(2).max(50).optional().label("Language Name"),
    isEnabled: Joi.boolean().optional().label("Is Enabled"),
  })
)
  .min(1)
  .label("UpdateLanguagePayload");

export const languageCodeParamsSchema = Joi.object(
  withFieldLabels({
    code: Joi.string()
      .pattern(/^[A-Z]{2}$/i)
      .required()
      .label("Language Code")
      .messages({
        "string.pattern.base":
          "Language code must be a valid 2-letter ISO 639-1 code",
      }),
  })
).label("LanguageCodeParams");

