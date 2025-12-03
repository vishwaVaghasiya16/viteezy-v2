import Joi from "joi";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const createProductIngredientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required().label("Ingredient name"),
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(slugPattern)
    .optional()
    .label("Slug"),
  description: Joi.string().trim().allow("", null).label("Description"),
  benefits: Joi.string().trim().allow("", null).label("Benefits"),
  precautions: Joi.string().trim().allow("", null).label("Precautions"),
  isActive: Joi.boolean().optional().label("Is active"),
});

export const updateProductIngredientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional().label("Ingredient name"),
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(slugPattern)
    .optional()
    .label("Slug"),
  description: Joi.string().trim().allow("", null).label("Description"),
  benefits: Joi.string().trim().allow("", null).label("Benefits"),
  precautions: Joi.string().trim().allow("", null).label("Precautions"),
  isActive: Joi.boolean().optional().label("Is active"),
}).min(1);

export const productIngredientIdParamsSchema = Joi.object({
  id: Joi.string().pattern(objectIdPattern).required().label("Ingredient id"),
});

export const listProductIngredientQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().label("Page"),
  limit: Joi.number().integer().min(1).max(100).optional().label("Limit"),
  sort: Joi.string()
    .valid("name", "slug", "createdAt", "updatedAt")
    .optional()
    .label("Sort field"),
  order: Joi.string().valid("asc", "desc").optional().label("Sort order"),
  search: Joi.string().trim().allow("", null).label("Search"),
  isActive: Joi.boolean().optional().label("Is active filter"),
});
