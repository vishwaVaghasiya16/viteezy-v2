import Joi from "joi";
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
    "any.required": "English name is required",
    "string.min": "English name must be at least 1 character",
  }),
  nl: Joi.string().trim().allow("", null),
  de: Joi.string().trim().allow("", null),
  fr: Joi.string().trim().allow("", null),
  es: Joi.string().trim().allow("", null),
});

const baseI18nTextSchema = Joi.object({
  en: Joi.string().trim().allow("", null),
  nl: Joi.string().trim().allow("", null),
  de: Joi.string().trim().allow("", null),
  fr: Joi.string().trim().allow("", null),
  es: Joi.string().trim().allow("", null),
});

const i18nStringSchema = withJsonSupport(baseI18nStringSchema).required();
const i18nTextSchema = withJsonSupport(baseI18nTextSchema, {
  allowEmpty: true,
}).optional();

export const createIngredientSchema = Joi.object(
  withFieldLabels({
    name: i18nStringSchema.label("Ingredient name"),
    description: i18nTextSchema.label("Ingredient description"),
    isActive: Joi.boolean().optional().label("Active status"),
  })
).label("CreateIngredientPayload");

export const updateIngredientSchema = Joi.object(
  withFieldLabels({
    name: i18nStringSchema.label("Ingredient name").optional(),
    description: i18nTextSchema.label("Ingredient description").optional(),
    isActive: Joi.boolean().optional().label("Active status"),
  })
)
  .label("UpdateIngredientPayload")
  .min(1);

export const ingredientIdParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid ingredient ID",
      "any.required": "Ingredient ID is required",
    }),
  })
);

export const updateIngredientStatusSchema = Joi.object(
  withFieldLabels({
    isActive: Joi.boolean().required().label("Active status"),
  })
).label("UpdateIngredientStatusPayload");

/**
 * Get Ingredients Query Validation Schema
 */
export const getIngredientsSchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sort: Joi.string().optional(),
    order: Joi.string().valid("asc", "desc").optional(),
    search: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
  })
)
  .unknown(false)
  .label("IngredientListQuery");
