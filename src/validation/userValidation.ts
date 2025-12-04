import Joi from "joi";
import { GENDER_VALUES } from "@/models/enums";
import { withFieldLabels } from "./helpers";

export const updateCurrentUserSchema = Joi.object(
  withFieldLabels({
    name: Joi.string().trim().min(2).max(50).optional(),
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
      .valid(
        "English",
        "Dutch",
        "German",
        "French",
        "Spanish",
        "Italian",
        "Portuguese"
      )
      .optional()
      .label("Language")
      .messages({
        "any.only":
          "Language must be one of: English, Dutch, German, French, Spanish, Italian, Portuguese",
      }),
  })
)
  .min(1)
  .label("UserUpdatePayload");
