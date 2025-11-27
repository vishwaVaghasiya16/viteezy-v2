import Joi from "joi";
import { PaymentMethod } from "../models/enums";
import { AppError } from "@/utils/AppError";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";

// Common validation patterns
const objectIdSchema = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .required()
  .messages({
    "any.invalid": "Invalid ID format",
    "any.required": "ID is required",
  });

const objectIdOptionalSchema = Joi.string()
  .custom((value, helpers) => {
    if (value && !mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .optional()
  .allow("")
  .messages({
    "any.invalid": "Invalid ID format",
  });

const paymentMethodSchema = Joi.string()
  .valid(...Object.values(PaymentMethod))
  .required()
  .messages({
    "any.only": `Payment method must be one of: ${Object.values(
      PaymentMethod
    ).join(", ")}`,
    "any.required": "Payment method is required",
  });

const currencySchema = Joi.string().length(3).uppercase().required().messages({
  "string.length": "Currency must be a 3-letter code (e.g., USD, EUR)",
  "any.required": "Currency is required",
});

const amountValueSchema = Joi.number().positive().required().messages({
  "number.base": "Amount must be a number",
  "number.positive": "Amount must be greater than 0",
  "any.required": "Amount value is required",
});

const amountSchema = Joi.object(
  withFieldLabels({
    value: amountValueSchema,
    currency: currencySchema,
  })
)
  .required()
  .messages({
    "any.required": "Amount is required",
  });

const urlSchema = Joi.string().uri().optional().allow("").messages({
  "string.uri": "Please provide a valid URL",
});

const descriptionSchema = Joi.string().max(500).optional().allow("").messages({
  "string.max": "Description cannot exceed 500 characters",
});

const metadataSchema = Joi.object()
  .pattern(Joi.string(), Joi.string().max(100))
  .optional()
  .messages({
    "object.base": "Metadata must be an object",
  });

const refundAmountSchema = Joi.number().positive().optional().messages({
  "number.base": "Refund amount must be a number",
  "number.positive": "Refund amount must be greater than 0",
});

const refundReasonSchema = Joi.string().max(255).optional().allow("").messages({
  "string.max": "Refund reason cannot exceed 255 characters",
});

const gatewayTransactionIdSchema = Joi.string().required().messages({
  "any.required": "Gateway transaction ID is required",
});

const gatewayTransactionIdOptionalSchema = Joi.string()
  .optional()
  .allow("")
  .messages({});

// Validation schemas
export const createPaymentSchema = Joi.object(
  withFieldLabels({
    orderId: objectIdSchema.messages({
      "any.required": "Order ID is required",
    }),
    paymentMethod: paymentMethodSchema,
    amount: amountSchema,
    description: descriptionSchema,
    metadata: metadataSchema,
    returnUrl: urlSchema,
    webhookUrl: urlSchema,
  })
).label("CreatePaymentPayload");

export const verifyPaymentSchema = Joi.object(
  withFieldLabels({
    paymentId: objectIdSchema.messages({
      "any.required": "Payment ID is required",
    }),
    gatewayTransactionId: gatewayTransactionIdSchema,
  })
).label("VerifyPaymentPayload");

export const createPaymentIntentSchema = Joi.object(
  withFieldLabels({
    orderId: objectIdSchema.messages({
      "any.required": "Order ID is required",
    }),
    paymentMethod: paymentMethodSchema,
    returnUrl: urlSchema,
    cancelUrl: urlSchema,
  })
).label("CreatePaymentIntentPayload");

export const verifyPaymentCallbackSchema = Joi.object(
  withFieldLabels({
    paymentId: objectIdSchema.messages({
      "any.required": "Payment ID is required",
    }),
    gatewayTransactionId: gatewayTransactionIdOptionalSchema,
  })
).label("VerifyPaymentCallbackPayload");

export const refundPaymentSchema = Joi.object(
  withFieldLabels({
    paymentId: objectIdSchema.messages({
      "any.required": "Payment ID is required",
    }),
    amount: refundAmountSchema,
    reason: refundReasonSchema,
    metadata: metadataSchema,
  })
).label("RefundPaymentPayload");

export const cancelPaymentSchema = Joi.object(
  withFieldLabels({
    paymentId: objectIdSchema.messages({
      "any.required": "Payment ID is required",
    }),
  })
).label("CancelPaymentPayload");

// Params validation schemas
export const paymentIdParamsSchema = Joi.object(
  withFieldLabels({
    paymentId: objectIdSchema.messages({
      "any.required": "Payment ID is required",
    }),
  })
).label("PaymentIdParams");

export const orderIdParamsSchema = Joi.object(
  withFieldLabels({
    orderId: objectIdSchema.messages({
      "any.required": "Order ID is required",
    }),
  })
).label("OrderIdParams");

// Validation middleware for body
export const validatePayment = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
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
      throw appErr;
    }

    req.body = value;
    next();
  };
};

// Validation middleware for params
export const validatePaymentParams = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.params, {
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
      throw appErr;
    }

    req.params = value;
    next();
  };
};
