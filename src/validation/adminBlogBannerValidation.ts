import Joi from "joi";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";
import { MEDIA_TYPE_VALUES } from "@/models/enums";
import { paginationQuerySchema } from "./commonValidation";

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

// Helper function to support JSON strings in form-data
const withJsonSupport = <T extends Joi.Schema>(
  schema: T,
  options: { allowEmpty?: boolean } = {}
): T => {
  return Joi.alternatives()
    .try(
      schema,
      Joi.string().custom((value, helpers) => {
        try {
          const parsed = typeof value === "string" ? JSON.parse(value) : value;
          return schema.validate(parsed).value;
        } catch (err) {
          return helpers.error("any.invalid");
        }
      })
    )
    .optional() as T;
};

const baseI18nStringSchema = Joi.object({
  en: Joi.string().trim().allow("", null).optional(),
  nl: Joi.string().trim().allow("", null).optional(),
  de: Joi.string().trim().allow("", null).optional(),
  fr: Joi.string().trim().allow("", null).optional(),
  es: Joi.string().trim().allow("", null).optional(),
});

const baseI18nTextSchema = Joi.object({
  en: Joi.string().trim().allow("", null).optional(),
  nl: Joi.string().trim().allow("", null).optional(),
  de: Joi.string().trim().allow("", null).optional(),
  fr: Joi.string().trim().allow("", null).optional(),
  es: Joi.string().trim().allow("", null).optional(),
});

const baseMediaSchema = Joi.object({
  type: Joi.string()
    .valid(...MEDIA_TYPE_VALUES)
    .optional(),
  url: Joi.string().uri().trim().allow("", null).optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
});

const i18nStringSchema = withJsonSupport(baseI18nStringSchema, {
  allowEmpty: true,
});
const i18nTextSchema = withJsonSupport(baseI18nTextSchema, {
  allowEmpty: true,
});
const mediaSchema = withJsonSupport(baseMediaSchema, {
  allowEmpty: true,
});

/**
 * Create Blog Banner Schema
 */
export const createBlogBannerSchema = Joi.object(
  withFieldLabels({
    banner_image: mediaSchema.label("Banner Image"),
    heading: i18nStringSchema.required().label("Heading"),
    description: i18nTextSchema.required().label("Description"),
  })
).label("CreateBlogBannerPayload");

/**
 * Update Blog Banner Schema
 */
export const updateBlogBannerSchema = Joi.object(
  withFieldLabels({
    banner_image: mediaSchema.label("Banner Image"),
    heading: i18nStringSchema.optional().label("Heading"),
    description: i18nTextSchema.optional().label("Description"),
  })
)
  .min(1)
  .label("UpdateBlogBannerPayload");

/**
 * Blog Banner ID Params Schema
 */
export const blogBannerIdParamsSchema = Joi.object(
  withFieldLabels({
    id: objectIdSchema.required().label("Blog Banner ID"),
  })
).label("BlogBannerParams");

/**
 * Get All Blog Banners Query Schema
 */
export const getAllBlogBannersQuerySchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).default(1).optional().label("Page"),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10)
      .optional()
      .label("Limit"),
    search: Joi.string().trim().min(1).max(100).optional().label("Search"),
  })
).label("GetAllBlogBannersQuery");
