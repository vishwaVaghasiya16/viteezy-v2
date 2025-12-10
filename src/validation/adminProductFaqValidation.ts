import Joi from "joi";
import { FAQ_STATUS_VALUES } from "@/models/enums";
import { withFieldLabels } from "./helpers";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const withJsonSupport = <T extends Joi.Schema>(
  schema: T,
  options: { allowEmpty?: boolean } = {}
) =>
  Joi.alternatives().try(
    schema,
    Joi.string().custom((value, helpers) => {
      if (value === undefined || value === null) {
        return undefined;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        if (options.allowEmpty) {
          return undefined;
        }
        return helpers.error("any.required");
      }

      try {
        const parsed = JSON.parse(trimmed);
        const { error, value: validated } = schema.validate(parsed, {
          abortEarly: false,
          allowUnknown: true,
        });

        if (error) {
          return helpers.error("any.invalid", { message: error.message });
        }

        return validated;
      } catch (err) {
        return helpers.error("any.invalid");
      }
    })
  );

const baseI18nStringSchema = Joi.object({
  en: Joi.string().trim().min(1).required().messages({
    "any.required": "English question is required",
    "string.min": "English question must be at least 1 character",
  }),
  nl: Joi.string().trim().allow("", null),
  de: Joi.string().trim().allow("", null),
  fr: Joi.string().trim().allow("", null),
  es: Joi.string().trim().allow("", null),
});

const baseI18nTextSchema = Joi.object({
  en: Joi.string().trim().min(1).required().messages({
    "any.required": "English answer is required",
    "string.min": "English answer must be at least 1 character",
  }),
  nl: Joi.string().trim().allow("", null),
  de: Joi.string().trim().allow("", null),
  fr: Joi.string().trim().allow("", null),
  es: Joi.string().trim().allow("", null),
});

const i18nStringSchema = withJsonSupport(baseI18nStringSchema).required();
const i18nTextSchema = withJsonSupport(baseI18nTextSchema).required();

export const createProductFaqSchema = Joi.object(
  withFieldLabels({
    productId: Joi.string()
      .pattern(objectIdRegex)
      .required()
      .label("Product ID")
      .messages({ "string.pattern.base": "Invalid product ID" }),
    question: i18nStringSchema.label("Question"),
    answer: i18nTextSchema.label("Answer"),
    sortOrder: Joi.number().integer().min(0).optional().label("Sort order"),
    status: Joi.string()
      .valid(...FAQ_STATUS_VALUES)
      .optional()
      .label("Status"),
    isActive: Joi.boolean().optional().label("Active status"),
  })
).label("CreateProductFaqPayload");

export const updateProductFaqSchema = Joi.object(
  withFieldLabels({
    question: i18nStringSchema.label("Question").optional(),
    answer: i18nTextSchema.label("Answer").optional(),
    sortOrder: Joi.number().integer().min(0).optional().label("Sort order"),
    status: Joi.string()
      .valid(...FAQ_STATUS_VALUES)
      .optional()
      .label("Status"),
    isActive: Joi.boolean().optional().label("Active status"),
  })
)
  .label("UpdateProductFaqPayload")
  .min(1);

export const productFaqIdParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid product FAQ ID",
      "any.required": "Product FAQ ID is required",
    }),
  })
);

/**
 * Get Product FAQs Query Validation Schema
 */
export const getProductFaqsSchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sort: Joi.string().optional(),
    order: Joi.string().valid("asc", "desc").optional(),
    search: Joi.string().optional(),
    status: Joi.string()
      .valid(...FAQ_STATUS_VALUES)
      .optional(),
    isActive: Joi.boolean().optional(),
  })
)
  .unknown(false)
  .label("ProductFaqListQuery");

export const productIdParamsSchema = Joi.object(
  withFieldLabels({
    productId: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid product ID",
      "any.required": "Product ID is required",
    }),
  })
);
