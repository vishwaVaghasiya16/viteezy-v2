import Joi from "joi";
import {
  ProductStatus,
  ProductVariant,
  PRODUCT_STATUS_VALUES,
  PRODUCT_VARIANT_VALUES,
  CURRENCY_VALUES,
} from "../models/enums";
import { AppError } from "../utils/AppError";

// Common validation patterns
const titleSchema = Joi.string().trim().min(2).max(200).required().messages({
  "string.min": "Title must be at least 2 characters long",
  "string.max": "Title cannot exceed 200 characters",
  "any.required": "Title is required",
});

const slugSchema = Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .optional()
  .messages({
    "string.pattern.base":
      "Slug must be a valid URL-friendly string (lowercase letters, numbers, and hyphens only)",
  });

const descriptionSchema = Joi.string().trim().required().messages({
  "any.required": "Description is required",
});

const productImageSchema = Joi.string().trim().uri().required().messages({
  "string.uri": "Product image must be a valid URL",
  "any.required": "Product image is required",
});

const benefitsSchema = Joi.array()
  .items(Joi.string().trim())
  .optional()
  .messages({
    "array.base": "Benefits must be an array of strings",
  });

const ingredientsSchema = Joi.array()
  .items(Joi.string().trim())
  .optional()
  .messages({
    "array.base": "Ingredients must be an array of strings",
  });

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const productIngredientIdsSchema = Joi.array()
  .items(
    Joi.string()
      .trim()
      .pattern(objectIdRegex)
      .message("Each product ingredient id must be a valid object id")
  )
  .optional()
  .messages({
    "array.base": "Product ingredients must be an array of ids",
  });

const categoriesSchema = Joi.array()
  .items(Joi.string().trim())
  .optional()
  .messages({
    "array.base": "Categories must be an array of strings",
  });

const healthGoalsSchema = Joi.array()
  .items(Joi.string().trim())
  .optional()
  .messages({
    "array.base": "Health goals must be an array of strings",
  });

const nutritionInfoSchema = Joi.string().trim().optional().allow("").messages({
  "string.base": "Nutrition info must be a string",
});

const nutritionTableSchema = Joi.array()
  .items(
    Joi.object({
      nutrient: Joi.string().trim().required(),
      amount: Joi.string().trim().required(),
      unit: Joi.string().trim().optional(),
      dailyValue: Joi.string().trim().optional(),
    })
  )
  .optional()
  .messages({
    "array.base": "Nutrition table must be an array",
  });

const metaSchema = Joi.object({
  title: Joi.string().trim().optional(),
  description: Joi.string().trim().optional(),
  keywords: Joi.string().trim().optional(),
  ogImage: Joi.string().trim().uri().optional(),
  hreflang: Joi.array()
    .items(
      Joi.object({
        lang: Joi.string().trim().required(),
        url: Joi.string().trim().uri().required(),
      })
    )
    .optional(),
}).optional();

const sourceInfoSchema = Joi.object({
  manufacturer: Joi.string().trim().optional(),
  countryOfOrigin: Joi.string().trim().optional(),
  certification: Joi.array().items(Joi.string().trim()).optional(),
  batchNumber: Joi.string().trim().optional(),
  expiryDate: Joi.date().optional(),
}).optional();

const howToUseSchema = Joi.string().trim().optional().allow("").messages({
  "string.base": "How to use must be a string",
});

const statusSchema = Joi.string()
  .valid(...PRODUCT_STATUS_VALUES)
  .optional()
  .messages({
    "any.only": `Status must be one of: ${PRODUCT_STATUS_VALUES.join(", ")}`,
  });

const priceSchema = Joi.object({
  currency: Joi.string()
    .valid(...CURRENCY_VALUES)
    .required()
    .messages({
      "any.only": `Currency must be one of: ${CURRENCY_VALUES.join(", ")}`,
      "any.required": "Currency is required",
    }),
  amount: Joi.number().min(0).required().messages({
    "number.min": "Amount must be greater than or equal to 0",
    "any.required": "Amount is required",
  }),
  taxRate: Joi.number().min(0).max(1).optional().default(0).messages({
    "number.min": "Tax rate must be greater than or equal to 0",
    "number.max": "Tax rate must be less than or equal to 1",
  }),
})
  .required()
  .messages({
    "any.required": "Price is required",
  });

const variantSchema = Joi.string()
  .valid(...PRODUCT_VARIANT_VALUES)
  .required()
  .messages({
    "any.only": `Variant must be one of: ${PRODUCT_VARIANT_VALUES.join(", ")}`,
    "any.required": "Variant is required",
  });

const hasStandupPouchSchema = Joi.boolean().optional().default(false);

const subscriptionPriceSchema = Joi.object({
  oneTime: priceSchema,
  thirtyDays: priceSchema,
  sixtyDays: priceSchema,
  ninetyDays: priceSchema,
  oneEightyDays: priceSchema,
});

const standupPouchPricesSchema = subscriptionPriceSchema.when(
  "hasStandupPouch",
  {
    is: true,
    then: Joi.required().messages({
      "any.required":
        "standupPouchPrices is required when hasStandupPouch is true",
    }),
    otherwise: Joi.optional(),
  }
);

// Create product schema
export const createProductSchema = Joi.object({
  title: titleSchema,
  slug: slugSchema.optional(),
  description: descriptionSchema,
  productImage: productImageSchema,
  benefits: benefitsSchema,
  ingredients: ingredientsSchema,
  productIngredients: productIngredientIdsSchema,
  categories: categoriesSchema,
  healthGoals: healthGoalsSchema,
  nutritionInfo: nutritionInfoSchema,
  nutritionTable: nutritionTableSchema,
  howToUse: howToUseSchema,
  status: statusSchema.default(ProductStatus.DRAFT),
  meta: metaSchema,
  sourceInfo: sourceInfoSchema,
  price: priceSchema,
  variant: variantSchema,
  hasStandupPouch: hasStandupPouchSchema,
  standupPouchPrices: standupPouchPricesSchema,
}).custom((value, helpers) => {
  // Custom validation: if hasStandupPouch is true, standupPouchPrices must be provided
  if (value.hasStandupPouch === true && !value.standupPouchPrices) {
    return helpers.error("any.custom", {
      message: "standupPouchPrices is required when hasStandupPouch is true",
    });
  }
  return value;
});

// Update product schema (all fields optional except validation rules)
export const updateProductSchema = Joi.object({
  title: titleSchema.optional(),
  slug: slugSchema.optional(),
  description: descriptionSchema.optional(),
  productImage: productImageSchema.optional(),
  benefits: benefitsSchema,
  ingredients: ingredientsSchema,
  productIngredients: productIngredientIdsSchema,
  categories: categoriesSchema,
  healthGoals: healthGoalsSchema,
  nutritionInfo: nutritionInfoSchema,
  nutritionTable: nutritionTableSchema,
  howToUse: howToUseSchema,
  status: statusSchema,
  meta: metaSchema,
  sourceInfo: sourceInfoSchema,
  price: priceSchema.optional(),
  variant: variantSchema.optional(),
  hasStandupPouch: hasStandupPouchSchema,
  standupPouchPrices: standupPouchPricesSchema,
}).custom((value, helpers) => {
  // Custom validation: if hasStandupPouch is true, standupPouchPrices must be provided
  if (value.hasStandupPouch === true && !value.standupPouchPrices) {
    return helpers.error("any.custom", {
      message: "standupPouchPrices is required when hasStandupPouch is true",
    });
  }
  return value;
});

// Validation middleware
export const validateProduct = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    if (error) {
      const first = error.details[0];
      const firstMessage = first?.message || "Validation error";
      const appErr: any = new AppError("Validation error", 400);
      appErr.errorType = "Validation error";
      appErr.error = firstMessage;
      throw appErr;
    }

    req.body = value;
    next();
  };
};
