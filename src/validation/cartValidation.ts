import Joi from "joi";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError";

// Add item to cart schema
export const addCartItemSchema = Joi.object({
  productId: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid", { message: "Invalid product ID format" });
      }
      return value;
    })
    .messages({
      "any.required": "Product ID is required",
      "any.invalid": "Product ID must be a valid MongoDB ObjectId",
    }),
  variantId: Joi.string()
    .optional()
    .custom((value, helpers) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid", { message: "Invalid variant ID format" });
      }
      return value;
    })
    .messages({
      "any.invalid": "Variant ID must be a valid MongoDB ObjectId",
    }),
  quantity: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      "number.base": "Quantity must be a number",
      "number.integer": "Quantity must be an integer",
      "number.min": "Quantity must be at least 1",
      "any.required": "Quantity is required",
    }),
});

// Update cart item schema
export const updateCartItemSchema = Joi.object({
  quantity: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      "number.base": "Quantity must be a number",
      "number.integer": "Quantity must be an integer",
      "number.min": "Quantity must be at least 1",
      "any.required": "Quantity is required",
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

