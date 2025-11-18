/**
 * @fileoverview Blog Validation Schemas
 * @description Joi validation schemas for blog-related endpoints
 * @module validation/blogValidation
 */

import Joi from "joi";

/**
 * Get Blogs Query Validation Schema
 * @constant {Joi.ObjectSchema} getBlogsSchema
 * @description Validates query parameters for getting paginated blogs
 */
export const getBlogsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().optional(),
  order: Joi.string().valid("asc", "desc").optional(),
  category: Joi.string().optional(),
  tag: Joi.string().optional(),
  search: Joi.string().optional(),
  lang: Joi.string().valid("en", "nl").optional(),
}).unknown(false);

/**
 * Get Blog Details Params Validation Schema
 * @constant {Joi.ObjectSchema} getBlogDetailsSchema
 * @description Validates path parameters for getting blog details
 */
export const getBlogDetailsSchema = Joi.object({
  slugOrId: Joi.string().required().messages({
    "any.required": "Blog slug or ID is required",
  }),
}).unknown(false);

/**
 * Get Blog Details Query Validation Schema
 * @constant {Joi.ObjectSchema} getBlogDetailsQuerySchema
 * @description Validates query parameters for getting blog details
 */
export const getBlogDetailsQuerySchema = Joi.object({
  lang: Joi.string().valid("en", "nl").optional(),
}).unknown(false);

/**
 * Get Popular Blogs Query Validation Schema
 * @constant {Joi.ObjectSchema} getPopularBlogsSchema
 * @description Validates query parameters for getting popular/latest blogs
 */
export const getPopularBlogsSchema = Joi.object({
  limit: Joi.number().integer().min(3).max(5).optional(),
  type: Joi.string().valid("popular", "latest").optional(),
  lang: Joi.string().valid("en", "nl").optional(),
}).unknown(false);

/**
 * Increment Blog Views Params Validation Schema
 * @constant {Joi.ObjectSchema} incrementBlogViewsSchema
 * @description Validates path parameters for incrementing blog views
 */
export const incrementBlogViewsSchema = Joi.object({
  slugOrId: Joi.string().required().messages({
    "any.required": "Blog slug or ID is required",
  }),
}).unknown(false);
