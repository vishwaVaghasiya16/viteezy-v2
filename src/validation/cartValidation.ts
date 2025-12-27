import Joi from "joi";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError";
import { ProductVariant } from "../models/enums";

// Add item to cart schema
export const addCartItemSchema = Joi.object({
  productId: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid", {
          message: "Invalid product ID format",
        });
      }
      return value;
    })
    .messages({
      "any.required": "Product ID is required",
      "any.invalid": "Product ID must be a valid MongoDB ObjectId",
    }),
  variantType: Joi.string()
    .required()
    .valid(ProductVariant.SACHETS, ProductVariant.STAND_UP_POUCH)
    .messages({
      "any.required": "Variant type is required",
      "any.only": "Variant type must be either SACHETS or STAND_UP_POUCH",
    }),
}).label("AddCartItemPayload");

// Update cart item schema
export const updateCartItemSchema = Joi.object({
  productId: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid", {
          message: "Invalid product ID format",
        });
      }
      return value;
    })
    .messages({
      "any.required": "Product ID is required",
      "any.invalid": "Product ID must be a valid MongoDB ObjectId",
    }),
});

// Validation middleware
export const validateCart = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    try {
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
        return next(appErr);
      }

      req.body = value;
      next();
    } catch (err) {
      next(err);
    }
  };
};
