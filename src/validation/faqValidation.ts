import Joi from "joi";
import { withFieldLabels } from "./helpers";
import { getLanguageQuerySchema } from "@/utils/i18nValidationHelper";

export const getFaqsQuerySchema = Joi.object(
  withFieldLabels({
    search: Joi.string().trim().min(1).optional(),
    category: Joi.string().trim().optional(),
    lang: getLanguageQuerySchema({ default: "en" }),
  })
)
  .unknown(false)
  .label("FaqListQuery");

export const getFaqsBodySchema = Joi.object(
  withFieldLabels({
    search: Joi.string().trim().min(1).optional(),
    category: Joi.string().trim().optional(),
    lang: getLanguageQuerySchema({ default: "en" }),
  })
)
  .unknown(false)
  .label("FaqListBody");

export const getFaqCategoriesQuerySchema = Joi.object(
  withFieldLabels({
    status: Joi.string().valid("active", "all").default("active"),
    lang: getLanguageQuerySchema({ default: "en" }),
  })
)
  .unknown(false)
  .label("FaqCategoriesQuery");

export const getFaqCategoriesBodySchema = Joi.object(
  withFieldLabels({
    status: Joi.string().valid("active", "all").default("active"),
    lang: getLanguageQuerySchema({ default: "en" }),
    title: Joi.string().trim().optional(),
  })
)
  .unknown(false)
  .label("FaqCategoriesBody");
