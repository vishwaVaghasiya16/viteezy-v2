import Joi from "joi";

export const getFaqsQuerySchema = Joi.object({
  search: Joi.string().trim().min(1).optional(),
  category: Joi.string().trim().optional(),
  lang: Joi.string().valid("en", "nl").default("en"),
}).unknown(false);

export const getFaqCategoriesQuerySchema = Joi.object({
  status: Joi.string().valid("active", "all").default("active"),
  lang: Joi.string().valid("en", "nl").default("en"),
}).unknown(false);
