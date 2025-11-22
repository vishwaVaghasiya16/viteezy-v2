/**
 * @fileoverview Blog Validation Schemas
 * @description Joi validation schemas for blog-related endpoints
 * @module validation/blogValidation
 */

import Joi from "joi";
import { withFieldLabels } from "./helpers";

/**
 * Get Blogs Query Validation Schema
 * @constant {Joi.ObjectSchema} getBlogsSchema
 * @description Validates query parameters for getting paginated blogs
 */
export const getBlogsSchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sort: Joi.string().optional(),
    order: Joi.string().valid("asc", "desc").optional(),
    category: Joi.string().optional(),
    tag: Joi.string().optional(),
    search: Joi.string().optional(),
    lang: Joi.string().valid("en", "nl").optional(),
  })
)
  .unknown(false)
  .label("BlogListQuery");

/**
 * Get Blog Details Params Validation Schema
 * @constant {Joi.ObjectSchema} getBlogDetailsSchema
 * @description Validates path parameters for getting blog details
 */
export const getBlogDetailsSchema = Joi.object(
  withFieldLabels({
    slugOrId: Joi.string().required().messages({
      "any.required": "Blog slug or ID is required",
    }),
  })
)
  .unknown(false)
  .label("BlogDetailsParams");

/**
 * Get Blog Details Query Validation Schema
 * @constant {Joi.ObjectSchema} getBlogDetailsQuerySchema
 * @description Validates query parameters for getting blog details
 */
export const getBlogDetailsQuerySchema = Joi.object(
  withFieldLabels({
    lang: Joi.string().valid("en", "nl").optional(),
  })
)
  .unknown(false)
  .label("BlogDetailsQuery");

/**
 * Get Blog Categories Query Validation Schema
 */
export const getBlogCategoriesQuerySchema = Joi.object(
  withFieldLabels({
    status: Joi.string().valid("active", "all").default("active"),
    lang: Joi.string().valid("en", "nl").default("en"),
  })
)
  .unknown(false)
  .label("BlogCategoriesQuery");

/**
 * Get Popular Blogs Query Validation Schema
 * @constant {Joi.ObjectSchema} getPopularBlogsSchema
 * @description Validates query parameters for getting popular/latest blogs
 */
export const getPopularBlogsSchema = Joi.object(
  withFieldLabels({
    limit: Joi.number().integer().min(3).max(5).optional(),
    type: Joi.string().valid("popular", "latest").optional(),
    lang: Joi.string().valid("en", "nl").optional(),
  })
)
  .unknown(false)
  .label("PopularBlogsQuery");

/**
 * Increment Blog Views Params Validation Schema
 * @constant {Joi.ObjectSchema} incrementBlogViewsSchema
 * @description Validates path parameters for incrementing blog views
 */
export const incrementBlogViewsSchema = Joi.object(
  withFieldLabels({
    slugOrId: Joi.string().required().messages({
      "any.required": "Blog slug or ID is required",
    }),
  })
)
  .unknown(false)
  .label("IncrementBlogViewsParams");
