import Joi from "joi";

export const createReminderValidation = Joi.object({
  time: Joi.string().required().example("09:00 AM"),
  note: Joi.string().allow("").optional(),
});

export const updateReminderValidation = Joi.object({
  time: Joi.string().optional(),
  note: Joi.string().allow("").optional(),
  isActive: Joi.boolean().optional(),
});