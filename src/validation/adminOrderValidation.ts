import Joi from "joi";
import { withFieldLabels } from "./helpers";
import {
  OrderStatus,
  PaymentStatus,
  OrderPlanType,
  ORDER_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  ORDER_PLAN_TYPE_VALUES,
} from "@/models/enums";
import { paginationQuerySchema } from "./commonValidation";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const orderIdParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid order ID",
      "any.required": "Order ID is required",
    }),
  })
);

export const updateOrderStatusSchema = Joi.object(
  withFieldLabels({
    status: Joi.string()
      .valid(...ORDER_STATUS_VALUES)
      .required()
      .label("Order status"),
  })
).label("UpdateOrderStatusPayload");

export const updatePaymentStatusSchema = Joi.object(
  withFieldLabels({
    paymentStatus: Joi.string()
      .valid(...PAYMENT_STATUS_VALUES)
      .required()
      .label("Payment status"),
  })
).label("UpdatePaymentStatusPayload");

export const updateTrackingNumberSchema = Joi.object(
  withFieldLabels({
    trackingNumber: Joi.string()
      .trim()
      .min(1)
      .max(200)
      .required()
      .label("Tracking number"),
  })
).label("UpdateTrackingNumberPayload");

export const getAllOrdersQuerySchema = paginationQuerySchema.keys(
  withFieldLabels({
    search: Joi.string().trim().optional().label("Search query"),
    status: Joi.string()
      .valid(...ORDER_STATUS_VALUES)
      .optional()
      .label("Order status"),
    paymentStatus: Joi.string()
      .valid(...PAYMENT_STATUS_VALUES)
      .optional()
      .label("Payment status"),
    planType: Joi.string()
      .valid(...ORDER_PLAN_TYPE_VALUES)
      .optional()
      .label("Plan type"),
    startDate: Joi.date().iso().optional().label("Start date"),
    endDate: Joi.date()
      .iso()
      .optional()
      .label("End date")
      .when("startDate", {
        is: Joi.exist(),
        then: Joi.date().greater(Joi.ref("startDate")),
        otherwise: Joi.date(),
      }),
    customerId: Joi.string()
      .pattern(objectIdRegex)
      .optional()
      .messages({
        "string.pattern.base": "Invalid customer ID format",
      })
      .label("Customer ID"),
  })
).label("GetAllOrdersQuery");

