import Joi from "joi";
import mongoose from "mongoose";
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

const shortDescriptionSchema = Joi.string()
  .trim()
  .optional()
  .allow("")
  .messages({
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

const benefitsSchema = Joi.array()
  .items(Joi.string().trim())
  .optional()
  .messages({
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

// productIngredientIdsSchema removed - relationship is reversed (productIngredients have products array)

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

const howToUseSchema = Joi.string().trim().optional().allow("").messages({
  "string.base": "How to use must be a string",
});

const statusSchema = Joi.boolean().optional().messages({
  "boolean.base": "Status must be true or false",
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
  taxRate: Joi.number().min(0).optional().default(0).messages({
    "number.min": "Tax rate must be greater than or equal to 0",
  }),
})
  .required()
  .messages({
    "any.required": "Price is required",
  });

// Extended price schema for subscription periods with additional metadata
const subscriptionPriceSchema = priceSchema.keys({
  amount: Joi.number().min(0).required().messages({
    "number.min": "Amount must be greater than or equal to 0",
    "any.required": "Amount is required",
  }),
  discountedPrice: Joi.number().min(0).optional().messages({
    "number.min": "Discounted price must be greater than or equal to 0",
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
});

const variantSchema = Joi.string()
  .valid(...PRODUCT_VARIANT_VALUES)
  .optional()
  .default("SACHETS")
  .messages({
    "any.only": `Variant must be one of: ${PRODUCT_VARIANT_VALUES.join(", ")}`,
  });

const hasStandupPouchSchema = Joi.boolean().optional().default(false);

// Sachet one-time capsule options (30 count, 60 count)
const sachetOneTimeCapsuleOptionsSchema = Joi.object({
  count30: priceSchema
    .keys({
      discountedPrice: Joi.number().min(0).optional().messages({
        "number.min": "Discounted price must be greater than or equal to 0",
      }),
      capsuleCount: Joi.number().min(0).optional().messages({
        "number.min": "Capsule count must be greater than or equal to 0",
      }),
      features: Joi.array().items(Joi.string().trim()).optional(),
    })
    .required(),
  count60: priceSchema
    .keys({
      discountedPrice: Joi.number().min(0).optional().messages({
        "number.min": "Discounted price must be greater than or equal to 0",
      }),
      capsuleCount: Joi.number().min(0).optional().messages({
        "number.min": "Capsule count must be greater than or equal to 0",
      }),
      features: Joi.array().items(Joi.string().trim()).optional(),
    })
    .required(),
});

// Sachet prices (subscription + one-time with capsule options)
const sachetPricesSchema = Joi.object({
  thirtyDays: subscriptionPriceSchema.required(),
  sixtyDays: subscriptionPriceSchema.required(),
  ninetyDays: subscriptionPriceSchema.required(),
  oneEightyDays: subscriptionPriceSchema.required(),
  oneTime: sachetOneTimeCapsuleOptionsSchema.required(),
}).optional();

// Stand-up pouch: can be simple price, oneTime structure with count30/count60, or wrapped in oneTime
const standupPouchPriceWithOneTimeSchema = Joi.object({
  oneTime: sachetOneTimeCapsuleOptionsSchema.required(),
});

// Stand-up pouch: can be simple price or oneTime structure with count30/count60 (with or without oneTime wrapper)
const standupPouchPriceSchema = Joi.alternatives()
  .try(
    priceSchema,
    sachetOneTimeCapsuleOptionsSchema,
    standupPouchPriceWithOneTimeSchema
  )
  .when("hasStandupPouch", {
    is: true,
    then: Joi.required().messages({
      "any.required":
        "standupPouchPrice is required when hasStandupPouch is true",
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

const standupPouchPricesSchema = legacySubscriptionPriceSchema.when(
  "hasStandupPouch",
  {
    is: true,
    then: Joi.optional(), // Legacy field, optional now
    otherwise: Joi.optional(),
  }
);

const isFeaturedSchema = Joi.boolean().optional().default(false);

const comparisonRowSchema = Joi.object({
  label: Joi.string().trim().required(),
  values: Joi.array().items(Joi.boolean()).min(1).required(),
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

const specificationItemSchema = Joi.object({
  title: Joi.string().trim().required(),
  descr: Joi.string().trim().required(),
  image: Joi.string().trim().uri().optional(), // Optional - will be set from uploaded file
  imageMobile: Joi.string().trim().uri().optional(), // Optional - will be set from uploaded file
});

const specificationSchema = Joi.object({
  main_title: Joi.string().trim().required(),
  bg_image: Joi.string().trim().uri().optional(), // Optional - will be set from uploaded file
  items: Joi.array().items(specificationItemSchema).min(1).max(4).optional(),
  // Individual item fields (title1, descr1, etc.) - will be converted to items array
  title1: Joi.string().trim().optional(),
  descr1: Joi.string().trim().optional(),
  title2: Joi.string().trim().optional(),
  descr2: Joi.string().trim().optional(),
  title3: Joi.string().trim().optional(),
  descr3: Joi.string().trim().optional(),
  title4: Joi.string().trim().optional(),
  descr4: Joi.string().trim().optional(),
})
  .optional()
  .messages({
    "object.base": "Specification must be an object",
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
  howToUse: howToUseSchema,
  status: statusSchema.default(true),
  price: priceSchema.optional(), // Optional - can be derived from sachetPrices
  variant: variantSchema,
  hasStandupPouch: hasStandupPouchSchema,
  sachetPrices: sachetPricesSchema,
  standupPouchPrice: standupPouchPriceSchema,
  standupPouchImages: standupPouchImagesSchema,
  isFeatured: isFeaturedSchema,
  comparisonSection: comparisonSectionSchema,
  specification: specificationSchema,
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
    const thirtyDays = value.sachetPrices.thirtyDays;
    const baseAmount =
      thirtyDays.discountedPrice !== undefined
        ? thirtyDays.discountedPrice
        : thirtyDays.amount || thirtyDays.totalAmount || 0;
    value.price = {
      currency: thirtyDays.currency || "EUR",
      amount: baseAmount,
      taxRate: thirtyDays.taxRate || 0,
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
  howToUse: howToUseSchema.optional(),
  status: statusSchema.optional(),
  price: priceSchema.optional(),
  variant: variantSchema.optional(),
  hasStandupPouch: hasStandupPouchSchema.optional(),
  sachetPrices: sachetPricesSchema.optional(),
  standupPouchPrice: standupPouchPriceSchema.optional(),
  standupPouchImages: standupPouchImagesSchema.optional(),
  isFeatured: isFeaturedSchema.optional(),
  comparisonSection: comparisonSectionSchema.optional(),
  specification: specificationSchema.optional(),
}).custom((value, helpers) => {
  // Custom validation: if hasStandupPouch is being set to true, standupPouchPrice must be provided
  // Only validate if hasStandupPouch is explicitly being updated to true
  if (value.hasStandupPouch === true && value.standupPouchPrice === undefined) {
    return helpers.error("any.custom", {
      message: "standupPouchPrice is required when hasStandupPouch is true",
    });
  }
  // If price is not provided and sachetPrices is being updated, derive price from sachetPrices.thirtyDays
  if (!value.price && value.sachetPrices && value.sachetPrices.thirtyDays) {
    const thirtyDays = value.sachetPrices.thirtyDays;
    const baseAmount =
      thirtyDays.discountedPrice !== undefined
        ? thirtyDays.discountedPrice
        : thirtyDays.amount || thirtyDays.totalAmount || 0;
    value.price = {
      currency: thirtyDays.currency || "EUR",
      amount: baseAmount,
      taxRate: thirtyDays.taxRate || 0,
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
})
  .required()
  .messages({
    "object.base": "Request body must be an object",
  });

// Get product categories query schema
export const getProductCategoriesSchema = Joi.object({
  lang: Joi.string().valid("en", "nl").optional().default("en").messages({
    "any.only": "Language must be either 'en' or 'nl'",
  }),
})
  .unknown(false)
  .label("ProductCategoriesQuery");

// Get product categories list with products query schema (for navbar)
export const listProductCategoriesSchema = Joi.object({
  lan: Joi.string().valid("en", "nl", "de", "fr", "es").optional().messages({
    "any.only": "Language must be one of: en, nl, de, fr, es",
  }),
})
  .unknown(false)
  .label("ListProductCategoriesQuery");

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
