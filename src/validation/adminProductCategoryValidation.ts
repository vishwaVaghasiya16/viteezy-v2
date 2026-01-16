import Joi from "joi";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";
import { getI18nStringSchema, getI18nTextSchema } from "@/utils/i18nValidationHelper";

const objectIdSchema = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.invalid": "Invalid ID format",
  });

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Use dynamic I18n schemas that support any configured languages
const i18nStringSchema = getI18nStringSchema({
  required: true,
  minLength: 1,
});

const i18nTextSchema = getI18nTextSchema({
  required: false,
  allowEmpty: true,
});

const mediaSchema = Joi.alternatives()
  .try(
    Joi.object({
      type: Joi.string().optional().allow(null),
      url: Joi.string().uri().optional().allow(null, ""),
      sortOrder: Joi.number().integer().min(0).optional(),
    }),
    Joi.string().allow(null, ""), // Allow JSON string in form-data
    Joi.valid(null, "") // Allow null/empty
  )
  .optional()
  .allow(null);

const seoSchema = Joi.object({
  title: Joi.string().trim().optional().allow(null, ""),
  description: Joi.string().trim().optional().allow(null, ""),
  keywords: Joi.string().trim().optional().allow(null, ""),
  ogImage: Joi.string().uri().optional().allow(null, ""),
  hreflang: Joi.array()
    .items(
      Joi.object({
        lang: Joi.string().trim(),
        url: Joi.string().uri(),
      })
    )
    .optional(),
}).optional();

export const createProductCategorySchema = Joi.object(
  withFieldLabels({
    name: i18nStringSchema.label("Category Name"),
    slug: Joi.string()
      .trim()
      .lowercase()
      .pattern(slugRegex)
      .optional()
      .label("Slug")
      .messages({
        "string.pattern.base":
          "Slug must contain only lowercase letters, numbers, and hyphens",
      }),
    description: i18nTextSchema.label("Description"),
    sortOrder: Joi.number()
      .integer()
      .min(0)
      .optional()
      .default(0)
      .label("Sort Order"),
    icon: Joi.string().trim().optional().allow(null, "").label("Icon"),
    image: mediaSchema.label("Image"),
    seo: seoSchema.label("SEO"),
    isActive: Joi.boolean().optional().default(true).label("Is Active"),
  })
).label("CreateProductCategoryPayload");

export const updateProductCategorySchema = Joi.object(
  withFieldLabels({
    name: i18nStringSchema.optional().label("Category Name"),
    slug: Joi.string()
      .trim()
      .lowercase()
      .pattern(slugRegex)
      .optional()
      .label("Slug")
      .messages({
        "string.pattern.base":
          "Slug must contain only lowercase letters, numbers, and hyphens",
      }),
    description: i18nTextSchema.label("Description"),
    sortOrder: Joi.number().integer().min(0).optional().label("Sort Order"),
    icon: Joi.string().trim().optional().allow(null, "").label("Icon"),
    image: mediaSchema.label("Image"),
    seo: seoSchema.label("SEO"),
    isActive: Joi.boolean().optional().label("Is Active"),
  })
)
  .min(1)
  .label("UpdateProductCategoryPayload");

export const productCategoryIdParamsSchema = Joi.object(
  withFieldLabels({
    id: objectIdSchema.required().label("Category ID"),
  })
).label("ProductCategoryParams");

export const getProductCategoriesQuerySchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional().default(1).label("Page"),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .label("Limit"),
    search: Joi.string().trim().optional().label("Search"),
    isActive: Joi.boolean().optional().label("Is Active"),
  })
).label("GetProductCategoriesQuery");
