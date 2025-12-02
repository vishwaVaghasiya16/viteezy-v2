import Joi from "joi";
import mongoose from "mongoose";
import { ProductStatus, ProductVariant, PRODUCT_STATUS_VALUES, PRODUCT_VARIANT_VALUES, CURRENCY_VALUES } from "../models/enums";
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
    "string.pattern.base": "Slug must be a valid URL-friendly string (lowercase letters, numbers, and hyphens only)",
  });

const descriptionSchema = Joi.string().trim().required().messages({
  "any.required": "Description is required",
});

const shortDescriptionSchema = Joi.string().trim().optional().allow("").messages({
  "string.base": "Short description must be a string",
});

const productImageSchema = Joi.string().trim().uri().required().messages({
  "string.uri": "Product image must be a valid URL",
  "any.required": "Product image is required",
});

const galleryImagesSchema = Joi.array()
  .items(Joi.string().trim().uri())
  .optional()
  .messages({
    "array.base": "Gallery images must be an array of image URLs",
  });

const benefitsSchema = Joi.array().items(Joi.string().trim()).optional().messages({
  "array.base": "Benefits must be an array of strings",
});

// ObjectId validation helper
const objectIdSchema = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.invalid": "Invalid ingredient ID format",
  });

const ingredientsSchema = Joi.array()
  .items(objectIdSchema)
  .optional()
  .messages({
    "array.base": "Ingredients must be an array of ingredient IDs",
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
}).required().messages({
  "any.required": "Price is required",
});

// Extended price schema for subscription periods with additional metadata
// amount is optional if totalAmount is provided
const subscriptionPriceSchema = priceSchema.keys({
  amount: Joi.number().min(0).optional().messages({
    "number.min": "Amount must be greater than or equal to 0",
  }),
  totalAmount: Joi.number().min(0).optional().messages({
    "number.min": "Total amount must be greater than or equal to 0",
  }),
  durationDays: Joi.number().min(1).optional().messages({
    "number.min": "Duration days must be greater than or equal to 1",
  }),
  capsuleCount: Joi.number().min(0).optional().messages({
    "number.min": "Capsule count must be greater than or equal to 0",
  }),
  savingsPercentage: Joi.number().min(0).max(100).optional().messages({
    "number.min": "Savings percentage must be greater than or equal to 0",
    "number.max": "Savings percentage must be less than or equal to 100",
  }),
  features: Joi.array().items(Joi.string().trim()).optional().messages({
    "array.base": "Features must be an array of strings",
  }),
  icon: Joi.string().trim().uri().optional().messages({
    "string.uri": "Icon must be a valid URL",
  }),
}).or("amount", "totalAmount").messages({
  "object.missing": "Either amount or totalAmount must be provided",
});

const variantSchema = Joi.string()
  .valid(...PRODUCT_VARIANT_VALUES)
  .required()
  .messages({
    "any.only": `Variant must be one of: ${PRODUCT_VARIANT_VALUES.join(", ")}`,
    "any.required": "Variant is required",
  });

const hasStandupPouchSchema = Joi.boolean().optional().default(false);

// Sachet one-time capsule options (30 count, 60 count)
const sachetOneTimeCapsuleOptionsSchema = Joi.object({
  count30: priceSchema.keys({
    capsuleCount: Joi.number().min(0).optional().messages({
      "number.min": "Capsule count must be greater than or equal to 0",
    }),
  }).required(),
  count60: priceSchema.keys({
    capsuleCount: Joi.number().min(0).optional().messages({
      "number.min": "Capsule count must be greater than or equal to 0",
    }),
  }).required(),
});

// Sachet prices (subscription + one-time with capsule options)
const sachetPricesSchema = Joi.object({
  thirtyDays: subscriptionPriceSchema.required(),
  sixtyDays: subscriptionPriceSchema.required(),
  ninetyDays: subscriptionPriceSchema.required(),
  oneEightyDays: subscriptionPriceSchema.required(),
  oneTime: sachetOneTimeCapsuleOptionsSchema.required(),
}).optional();

// Sachet images schema
const sachetImagesSchema = Joi.array()
  .items(Joi.string().trim().uri())
  .optional()
  .messages({
    "array.base": "Sachet images must be an array of image URLs",
  });

// Stand-up pouch: can be simple price, oneTime structure with count30/count60, or wrapped in oneTime
const standupPouchPriceWithOneTimeSchema = Joi.object({
  oneTime: sachetOneTimeCapsuleOptionsSchema.required(),
});

// Stand-up pouch: can be simple price or oneTime structure with count30/count60 (with or without oneTime wrapper)
const standupPouchPriceSchema = Joi.alternatives().try(
  priceSchema,
  sachetOneTimeCapsuleOptionsSchema,
  standupPouchPriceWithOneTimeSchema
).when("hasStandupPouch", {
  is: true,
  then: Joi.required().messages({
    "any.required": "standupPouchPrice is required when hasStandupPouch is true",
  }),
  otherwise: Joi.optional(),
});

// Stand-up pouch images
const standupPouchImagesSchema = Joi.array()
  .items(Joi.string().trim().uri())
  .optional()
  .messages({
    "array.base": "Stand-up pouch images must be an array of URLs",
  });

// Legacy subscription price schema (kept for backward compatibility)
const legacySubscriptionPriceSchema = Joi.object({
  oneTime: priceSchema,
  thirtyDays: priceSchema,
  sixtyDays: priceSchema,
  ninetyDays: priceSchema,
  oneEightyDays: priceSchema,
});

const standupPouchPricesSchema = legacySubscriptionPriceSchema.when("hasStandupPouch", {
  is: true,
  then: Joi.optional(), // Legacy field, optional now
  otherwise: Joi.optional(),
});

const isFeaturedSchema = Joi.boolean().optional().default(false);

const comparisonRowSchema = Joi.object({
  label: Joi.string().trim().required(),
  values: Joi.array()
    .items(Joi.boolean())
    .min(1)
    .required(),
});

const comparisonSectionSchema = Joi.object({
  title: Joi.string().trim().required(),
  columns: Joi.array().items(Joi.string().trim().required()).min(1).required(),
  rows: Joi.array().items(comparisonRowSchema).min(1).required(),
})
  .optional()
  .messages({
    "object.base": "Comparison section must be an object",
  });

// Create product schema
export const createProductSchema = Joi.object({
  title: titleSchema,
  slug: slugSchema.optional(),
  description: descriptionSchema,
  productImage: productImageSchema,
  shortDescription: shortDescriptionSchema,
  galleryImages: galleryImagesSchema,
  benefits: benefitsSchema,
  ingredients: ingredientsSchema,
  categories: categoriesSchema,
  healthGoals: healthGoalsSchema,
  nutritionInfo: nutritionInfoSchema,
  nutritionTable: nutritionTableSchema,
  howToUse: howToUseSchema,
  status: statusSchema.default(ProductStatus.DRAFT),
  meta: metaSchema,
  sourceInfo: sourceInfoSchema,
  price: priceSchema.optional(), // Optional - can be derived from sachetPrices
  variant: variantSchema,
  hasStandupPouch: hasStandupPouchSchema,
  sachetPrices: sachetPricesSchema,
  sachetImages: sachetImagesSchema,
  standupPouchPrice: standupPouchPriceSchema,
  standupPouchImages: standupPouchImagesSchema,
  standupPouchPrices: standupPouchPricesSchema, // Legacy field
  isFeatured: isFeaturedSchema,
  comparisonSection: comparisonSectionSchema,
}).custom((value, helpers) => {
  // Custom validation: if hasStandupPouch is true, standupPouchPrice must be provided
  if (value.hasStandupPouch === true && !value.standupPouchPrice) {
    return helpers.error("any.custom", {
      message: "standupPouchPrice is required when hasStandupPouch is true",
    });
  }
  // Sachets (default variant) should have sachetPrices
  if (value.variant === "SACHETS" && !value.sachetPrices) {
    return helpers.error("any.custom", {
      message: "sachetPrices is required for SACHETS variant",
    });
  }
  // If price is not provided and sachetPrices exists, set price from sachetPrices.thirtyDays
  if (!value.price && value.sachetPrices && value.sachetPrices.thirtyDays) {
    value.price = {
      currency: value.sachetPrices.thirtyDays.currency || "EUR",
      amount: value.sachetPrices.thirtyDays.amount || value.sachetPrices.thirtyDays.totalAmount || 0,
      taxRate: value.sachetPrices.thirtyDays.taxRate || 0,
    };
  }
  return value;
});

// Update product schema (all fields optional - can update single or multiple fields)
export const updateProductSchema = Joi.object({
  title: titleSchema.optional(),
  slug: slugSchema.optional(),
  description: descriptionSchema.optional(),
  productImage: productImageSchema.optional(),
  shortDescription: shortDescriptionSchema.optional(),
  galleryImages: galleryImagesSchema.optional(),
  benefits: benefitsSchema.optional(),
  ingredients: ingredientsSchema.optional(),
  categories: categoriesSchema.optional(),
  healthGoals: healthGoalsSchema.optional(),
  nutritionInfo: nutritionInfoSchema.optional(),
  nutritionTable: nutritionTableSchema.optional(),
  howToUse: howToUseSchema.optional(),
  status: statusSchema.optional(),
  meta: metaSchema.optional(),
  sourceInfo: sourceInfoSchema.optional(),
  price: priceSchema.optional(),
  variant: variantSchema.optional(),
  hasStandupPouch: hasStandupPouchSchema.optional(),
  sachetPrices: sachetPricesSchema.optional(),
  sachetImages: sachetImagesSchema.optional(),
  standupPouchPrice: standupPouchPriceSchema.optional(),
  standupPouchImages: standupPouchImagesSchema.optional(),
  standupPouchPrices: standupPouchPricesSchema.optional(), // Legacy field
  isFeatured: isFeaturedSchema.optional(),
  comparisonSection: comparisonSectionSchema.optional(),
}).custom((value, helpers) => {
  // Custom validation: if hasStandupPouch is being set to true, standupPouchPrice must be provided
  // Only validate if hasStandupPouch is explicitly being updated to true
  if (value.hasStandupPouch === true && value.standupPouchPrice === undefined && !value.standupPouchPrices) {
    return helpers.error("any.custom", {
      message: "standupPouchPrice is required when hasStandupPouch is true",
    });
  }
  // If price is not provided and sachetPrices is being updated, derive price from sachetPrices.thirtyDays
  if (!value.price && value.sachetPrices && value.sachetPrices.thirtyDays) {
    value.price = {
      currency: value.sachetPrices.thirtyDays.currency || "EUR",
      amount: value.sachetPrices.thirtyDays.amount || value.sachetPrices.thirtyDays.totalAmount || 0,
      taxRate: value.sachetPrices.thirtyDays.taxRate || 0,
    };
  }
  return value;
});

// Update product status schema (for enable/disable) - Simple boolean
export const updateProductStatusSchema = Joi.object({
  enabled: Joi.boolean().required().messages({
    "boolean.base": "enabled must be a boolean value",
    "any.required": "enabled is required",
  }),
}).required().messages({
  "object.base": "Request body must be an object",
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

