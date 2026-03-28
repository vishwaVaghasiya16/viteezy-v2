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

const quantitySchema = Joi.number().integer().min(1).messages({
  "number.base": "Quantity must be a number",
  "number.integer": "Quantity must be an integer",
  "number.min": "Quantity must be at least 1",
});

const isOneTimeSchema = Joi.boolean().messages({
  "boolean.base": "isOneTime must be a boolean",
});

const planDaysSchema = Joi.number()
  .integer()
  .messages({
    "number.base": "Plan days must be a number",
    "number.integer": "Plan days must be an integer",
    // Note: Variant-specific validation (60/120 for STAND_UP_POUCH, not allowed for SACHETS) is handled in custom validation
  });

// Add item to cart schema (supports single and multiple items)
export const addCartItemSchema = Joi.object({
  productId: productIdSchema.optional(),
  variantType: variantTypeSchema.optional(),
  quantity: quantitySchema.optional(),
  isOneTime: isOneTimeSchema.optional(),
  planDays: planDaysSchema.optional(),
})
  .pattern(/^productId_\d+$/, productIdSchema)
  .pattern(/^variantType_\d+$/, variantTypeSchema)
  .pattern(/^quantity_\d+$/, quantitySchema)
  .pattern(/^isOneTime_\d+$/, isOneTimeSchema)
  .pattern(/^planDays_\d+$/, planDaysSchema)
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
      const qtyMatch = key.match(/^quantity_(\d+)$/);
      if (productMatch) indexSet.add(Number(productMatch[1]));
      if (variantMatch) indexSet.add(Number(variantMatch[1]));
      if (qtyMatch) indexSet.add(Number(qtyMatch[1]));
    });

    let hasAny = hasBaseProduct;
    for (const index of indexSet) {
      const productKey = `productId_${index}`;
      const variantKey = `variantType_${index}`;
      const qtyKey = `quantity_${index}`;
      const hasProduct = !!value[productKey];
      const hasVariant = !!value[variantKey];
      const hasQty = value[qtyKey] !== undefined;

      if (hasProduct !== hasVariant) {
        return helpers.error("any.custom", {
          message: `${productKey} and ${variantKey} are required`,
        });
      }
      if (hasProduct && hasVariant) {
        hasAny = true;
      }

      // quantity rules per indexed payload
      if (hasQty) {
        const vt = value[variantKey];
        if (vt === ProductVariant.SACHETS) {
          return helpers.error("any.custom", {
            message: `${qtyKey} is not allowed for SACHETS variantType`,
          });
        }
      }
    }

    if (!hasAny) {
      return helpers.error("any.custom", {
        message: "productId and variantType are required",
      });
    }

    // quantity rules for base payload
    if (value.quantity !== undefined) {
      if (value.variantType === ProductVariant.SACHETS) {
        return helpers.error("any.custom", {
          message: "quantity is not allowed for SACHETS variantType",
        });
      }
    }

    // Validate isOneTime and planDays
    if (value.variantType === ProductVariant.SACHETS) {
      // For SACHETS, isOneTime is NOT allowed (only subscription plans)
      if (value.isOneTime !== undefined) {
        return helpers.error("any.custom", {
          message: "isOneTime is not allowed for SACHETS variantType (only subscription plans are supported)",
        });
      }
      // For SACHETS, planDays is NOT allowed (planDays is only for STAND_UP_POUCH)
      if (value.planDays !== undefined) {
        return helpers.error("any.custom", {
          message: "planDays is not allowed for SACHETS variantType (planDays is only for STAND_UP_POUCH)",
        });
      }
    } else if (value.variantType === ProductVariant.STAND_UP_POUCH) {
      // STAND_UP_POUCH is always one-time, isOneTime is optional (but must be true if provided)
      if (value.isOneTime !== undefined && value.isOneTime !== true) {
        return helpers.error("any.custom", {
          message: "STAND_UP_POUCH is always one-time purchase, isOneTime must be true if provided",
        });
      }
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
  variantType: variantTypeSchema.required().messages({
    "any.required": "Variant type is required",
  }),
  quantity: Joi.alternatives()
    .conditional("variantType", {
      is: ProductVariant.SACHETS,
      then: Joi.forbidden().messages({
        "any.unknown": "quantity is not allowed for SACHETS variantType",
      }),
      otherwise: quantitySchema.optional().default(1),
    })
    .messages({
      "any.unknown": "Invalid quantity",
    }),
  isOneTime: isOneTimeSchema.optional(),
  planDays: planDaysSchema.optional(),
})
  .custom((value, helpers) => {
    // Validate isOneTime and planDays
    if (value.variantType === ProductVariant.SACHETS) {
      // For SACHETS, isOneTime is NOT allowed (only subscription plans)
      if (value.isOneTime !== undefined) {
        return helpers.error("any.custom", {
          message: "isOneTime is not allowed for SACHETS variantType (only subscription plans are supported)",
        });
      }
      // For SACHETS, planDays is NOT allowed (planDays is only for STAND_UP_POUCH)
      if (value.planDays !== undefined) {
        return helpers.error("any.custom", {
          message: "planDays is not allowed for SACHETS variantType (planDays is only for STAND_UP_POUCH)",
        });
      }
    } else if (value.variantType === ProductVariant.STAND_UP_POUCH) {
      // STAND_UP_POUCH is always one-time, isOneTime is optional (but must be true if provided)
      if (value.isOneTime !== undefined && value.isOneTime !== true) {
        return helpers.error("any.custom", {
          message: "STAND_UP_POUCH is always one-time purchase, isOneTime must be true if provided",
        });
      }
      // planDays is optional for STAND_UP_POUCH (treated as capsuleCount)
    }
    return value;
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
