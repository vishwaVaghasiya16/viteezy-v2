import Joi from "joi";
import { FREQUENCY_TYPE_VALUES } from "@/models/enums";

export const createReminderValidation = Joi.object({
  time: Joi.date()
    .iso()
    .required()
    .messages({
      "date.base": "Time must be a valid date",
      "date.format": "Time must be in ISO format (e.g., 2026-04-16T03:30:00.000Z)",
      "any.required": "Time is required",
    }),

  note: Joi.string().allow("").optional(),

  frequency: Joi.string()
    .valid(...FREQUENCY_TYPE_VALUES)
    .optional()
    .default("Daily"),
});

export const updateReminderValidation = Joi.object({
  time: Joi.date()
    .iso()
    .optional()
    .messages({
      "date.format": "Time must be in ISO format (e.g., 2026-04-16T03:30:00.000Z)",
    }),

  note: Joi.string().allow("").optional(),
  isActive: Joi.boolean().optional(),

  frequency: Joi.string()
    .valid(...FREQUENCY_TYPE_VALUES)
    .optional(),
});

export const bulkCreateRemindersValidation = Joi.object({
  reminders: Joi.array()
    .items(
      Joi.object({
        time: Joi.date()
          .iso()
          .required()
          .messages({
            "date.format": "Time must be ISO format",
          }),

        note: Joi.string().allow("").optional(),

        frequency: Joi.string()
          .valid(...FREQUENCY_TYPE_VALUES)
          .optional(),
      })
    )
    .min(1)
    .required(),
});