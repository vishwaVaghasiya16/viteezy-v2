import Joi from "joi";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError";
import { ProductVariant } from "../models/enums";

const productIdSchema = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid", {
        message: "Invalid product ID format",
      });
    }
    return value;
  })
  .messages({
    "any.invalid": "Product ID must be a valid MongoDB ObjectId",
  });

const variantTypeSchema = Joi.string()
  .valid(ProductVariant.SACHETS, ProductVariant.STAND_UP_POUCH)
  .messages({
    "any.only": "Variant type must be either SACHETS or STAND_UP_POUCH",
  });

// Add item to cart schema (supports single and multiple items)
export const addCartItemSchema = Joi.object({
  productId: productIdSchema.optional(),
  variantType: variantTypeSchema.optional(),
})
  .pattern(/^productId_\d+$/, productIdSchema)
  .pattern(/^variantType_\d+$/, variantTypeSchema)
  .custom((value, helpers) => {
    const hasBaseProduct = !!value.productId;
    const hasBaseVariant = !!value.variantType;

    if (hasBaseProduct !== hasBaseVariant) {
      return helpers.error("any.custom", {
        message: "productId and variantType are required",
      });
    }

    const indexSet = new Set<number>();
    Object.keys(value).forEach((key) => {
      const productMatch = key.match(/^productId_(\d+)$/);
      const variantMatch = key.match(/^variantType_(\d+)$/);
      if (productMatch) indexSet.add(Number(productMatch[1]));
      if (variantMatch) indexSet.add(Number(variantMatch[1]));
    });

    let hasAny = hasBaseProduct;
    for (const index of indexSet) {
      const productKey = `productId_${index}`;
      const variantKey = `variantType_${index}`;
      const hasProduct = !!value[productKey];
      const hasVariant = !!value[variantKey];

      if (hasProduct !== hasVariant) {
        return helpers.error("any.custom", {
          message: `${productKey} and ${variantKey} are required`,
        });
      }
      if (hasProduct && hasVariant) {
        hasAny = true;
      }
    }

    if (!hasAny) {
      return helpers.error("any.custom", {
        message: "productId and variantType are required",
      });
    }

    return value;
  })
  .messages({
    "any.custom": "{{#message}}",
  })
  .label("AddCartItemPayload");

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
