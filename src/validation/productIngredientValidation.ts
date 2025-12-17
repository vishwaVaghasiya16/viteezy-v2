import Joi from "joi";
import { withFieldLabels } from "./helpers";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

// Helper to support JSON strings in multipart/form-data
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

      const trimmed =
        typeof value === "string" ? value.trim() : String(value).trim();
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
  en: Joi.string().trim().min(2).max(120).required().messages({
    "any.required": "English name is required",
    "string.min": "English name must be at least 2 characters",
    "string.max": "English name cannot exceed 120 characters",
  }),
  nl: Joi.string().trim().allow("", null).optional(),
  de: Joi.string().trim().allow("", null).optional(),
  fr: Joi.string().trim().allow("", null).optional(),
  es: Joi.string().trim().allow("", null).optional(),
}).required();

const baseI18nTextSchema = Joi.object({
  en: Joi.string().trim().allow("", null).optional(),
  nl: Joi.string().trim().allow("", null).optional(),
  de: Joi.string().trim().allow("", null).optional(),
  fr: Joi.string().trim().allow("", null).optional(),
  es: Joi.string().trim().allow("", null).optional(),
}).optional();

// Support both object and JSON string (for multipart/form-data)
const i18nStringSchema = withJsonSupport(baseI18nStringSchema).required();
const i18nTextSchema = withJsonSupport(baseI18nTextSchema, {
  allowEmpty: true,
}).optional();

// Helper to support array as JSON string in multipart/form-data
const productsArraySchema = Joi.alternatives()
  .try(
    Joi.array().items(Joi.string().pattern(objectIdPattern)).min(1).required(),
    Joi.string().custom((value, helpers) => {
      if (!value || value.trim() === "") {
        return helpers.error("any.required");
      }
      try {
        const parsed = JSON.parse(value.trim());
        if (!Array.isArray(parsed)) {
          return helpers.error("any.invalid", {
            message: "Products must be an array",
          });
        }
        if (parsed.length === 0) {
          return helpers.error("any.invalid", {
            message: "At least one product is required",
          });
        }
        // Validate each item is a valid ObjectId
        for (const item of parsed) {
          if (!objectIdPattern.test(item)) {
            return helpers.error("any.invalid", {
              message: `Invalid product ID: ${item}`,
            });
          }
        }
        return parsed;
      } catch (err) {
        return helpers.error("any.invalid", {
          message: "Invalid JSON format for products",
        });
      }
    })
  )
  .required();

export const createProductIngredientSchema = Joi.object(
  withFieldLabels({
    name: i18nStringSchema.label("Ingredient name"),
    description: i18nTextSchema.label("Description"),
    products: productsArraySchema.label("Products"),
    isActive: Joi.alternatives()
      .try(
        Joi.boolean(),
        Joi.string()
          .valid("true", "false", "1", "0")
          .custom((value) => {
            return value === "true" || value === "1";
          })
      )
      .optional()
      .label("Is active"),
  })
).label("CreateProductIngredientPayload");

const productsArrayOptionalSchema = Joi.alternatives()
  .try(
    Joi.array().items(Joi.string().pattern(objectIdPattern)).min(1).optional(),
    Joi.string().custom((value, helpers) => {
      if (!value || value.trim() === "") {
        return undefined;
      }
      try {
        const parsed = JSON.parse(value.trim());
        if (!Array.isArray(parsed)) {
          return helpers.error("any.invalid", {
            message: "Products must be an array",
          });
        }
        if (parsed.length === 0) {
          return helpers.error("any.invalid", {
            message: "At least one product is required",
          });
        }
        // Validate each item is a valid ObjectId
        for (const item of parsed) {
          if (!objectIdPattern.test(item)) {
            return helpers.error("any.invalid", {
              message: `Invalid product ID: ${item}`,
            });
          }
        }
        return parsed;
      } catch (err) {
        return helpers.error("any.invalid", {
          message: "Invalid JSON format for products",
        });
      }
    })
  )
  .optional();

export const updateProductIngredientSchema = Joi.object(
  withFieldLabels({
    name: i18nStringSchema.optional().label("Ingredient name"),
    description: i18nTextSchema.label("Description"),
    products: productsArrayOptionalSchema.label("Products"),
    isActive: Joi.alternatives()
      .try(
        Joi.boolean(),
        Joi.string()
          .valid("true", "false", "1", "0")
          .custom((value) => {
            return value === "true" || value === "1";
          })
      )
      .optional()
      .label("Is active"),
  })
)
  .label("UpdateProductIngredientPayload")
  .min(1);

export const productIngredientIdParamsSchema = Joi.object({
  id: Joi.string().pattern(objectIdPattern).required().label("Ingredient id"),
});

export const listProductIngredientQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().label("Page"),
  limit: Joi.number().integer().min(1).max(100).optional().label("Limit"),
  sort: Joi.string()
    .valid("name", "createdAt", "updatedAt")
    .optional()
    .label("Sort field"),
  order: Joi.string().valid("asc", "desc").optional().label("Sort order"),
  search: Joi.string().trim().allow("", null).label("Search"),
  isActive: Joi.boolean().optional().label("Is active filter"),
});
