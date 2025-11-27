import Joi from "joi";
import mongoose from "mongoose";

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

export const productReviewParamsSchema = Joi.object({
  productId: objectIdSchema.required().label("Product ID"),
});

export const reviewIdParamsSchema = Joi.object({
  reviewId: objectIdSchema.required().label("Review ID"),
});

export const createProductReviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required().label("Rating"),
  title: Joi.string().trim().allow("").optional().label("Title"),
  content: Joi.string().trim().allow("").optional().label("Content"),
  images: Joi.array().items(Joi.string().uri().trim()).max(5).optional(),
}).label("CreateProductReviewPayload");

export const updateProductReviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).optional().label("Rating"),
  title: Joi.string().trim().allow("").optional().label("Title"),
  content: Joi.string().trim().allow("").optional().label("Content"),
  images: Joi.array().items(Joi.string().uri().trim()).max(5).optional(),
})
  .min(1)
  .label("UpdateProductReviewPayload");
