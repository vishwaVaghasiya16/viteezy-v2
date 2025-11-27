import Joi from "joi";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";

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

export const addWishlistItemSchema = Joi.object(
  withFieldLabels({
    productId: objectIdSchema.required().messages({
      "any.required": "Valid productId is required",
    }),
    notes: Joi.string().allow(null, "").max(500).optional(),
  })
).label("AddWishlistItemPayload");

export const updateWishlistItemBodySchema = Joi.object(
  withFieldLabels({
    notes: Joi.string().allow(null, "").max(500).optional(),
  })
)
  .min(1)
  .label("UpdateWishlistItemPayload");

export const wishlistPaginationQuerySchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    includeProduct: Joi.boolean().optional(),
  })
)
  .default({})
  .label("WishlistQuery");

export const wishlistItemParamsSchema = Joi.object(
  withFieldLabels({
    id: objectIdSchema.required(),
  })
).label("WishlistParams");
