import Joi from "joi";

const compositionQuantityJoi = Joi.alternatives()
  .try(Joi.string().trim().min(1), Joi.number().custom((n) => String(n)))
  .required()
  .messages({
    "string.empty": "Quantity cannot be empty",
    "any.required": "Quantity is required",
  });

const compositionQuantityJoiOptional = Joi.alternatives()
  .try(Joi.string().trim().min(1), Joi.number().custom((n) => String(n)))
  .optional();

// Base validation schema for ingredient composition
const baseCompositionSchema = {
  product: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/).messages({
    "string.pattern.base": "Invalid product ID format",
    "any.required": "Product ID is required",
  }),
  ingredient: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/).messages({
    "string.pattern.base": "Invalid ingredient ID format",
    "any.required": "Ingredient ID is required",
  }),
  quantity: compositionQuantityJoi,
  driPercentage: Joi.alternatives().try(
    Joi.number().min(0).messages({
      "number.base": "DRI percentage must be a number",
      "number.min": "DRI percentage cannot be negative",
    }),
    Joi.string().valid("*", "**").messages({
      "any.only": "DRI percentage string must be '*' or '**'",
    })
  ).required().messages({
    "any.required": "DRI percentage is required",
  }),
};

// Create ingredient composition validation
export const createCompositionSchema = Joi.object({
  ...baseCompositionSchema,
});

// Update ingredient composition validation (all fields optional)
export const updateCompositionSchema = Joi.object({
  product: Joi.string().optional().pattern(/^[0-9a-fA-F]{24}$/).messages({
    "string.pattern.base": "Invalid product ID format",
  }),
  ingredient: Joi.string().optional().pattern(/^[0-9a-fA-F]{24}$/).messages({
    "string.pattern.base": "Invalid ingredient ID format",
  }),
  quantity: compositionQuantityJoiOptional,
  driPercentage: Joi.alternatives().try(
    Joi.number().min(0).messages({
      "number.base": "DRI percentage must be a number",
      "number.min": "DRI percentage cannot be negative",
    }),
    Joi.string().valid("*", "**").messages({
      "any.only": "DRI percentage string must be '*' or '**'",
    })
  ).optional(),
});

// Bulk update compositions validation
export const bulkUpdateCompositionsSchema = Joi.object({
  compositions: Joi.array().items(
    Joi.object({
      ingredient: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/).messages({
        "string.pattern.base": "Invalid ingredient ID format",
        "any.required": "Ingredient ID is required",
      }),
      quantity: compositionQuantityJoi,
      driPercentage: Joi.alternatives().try(
        Joi.number().min(0).messages({
          "number.base": "DRI percentage must be a number",
          "number.min": "DRI percentage cannot be negative",
        }),
        Joi.string().valid("*", "**").messages({
          "any.only": "DRI percentage string must be '*' or '**'",
        })
      ).required().messages({
        "any.required": "DRI percentage is required",
      }),
    })
  ).min(1).required().messages({
    "array.min": "At least one composition is required",
    "any.required": "Compositions array is required",
  }),
});

// Query parameter validation for listing compositions
export const listCompositionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),
  limit: Joi.number().integer().min(1).max(100).optional().default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  productId: Joi.string().optional().pattern(/^[0-9a-fA-F]{24}$/).messages({
    "string.pattern.base": "Invalid product ID format",
  }),
  ingredientId: Joi.string().optional().pattern(/^[0-9a-fA-F]{24}$/).messages({
    "string.pattern.base": "Invalid ingredient ID format",
  }),
});

// MongoDB ObjectId validation
export const objectIdSchema = Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/).messages({
  "string.pattern.base": "Invalid ID format",
  "any.required": "ID is required",
});
