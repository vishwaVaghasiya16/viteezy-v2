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

    // Existing range date filters
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

    // 🔥 NEW: Exact single date filter
    date: Joi.date().iso().optional().label("Exact order date"),

    // 🔥 NEW: Order total range
    minTotal: Joi.number()
      .min(0)
      .optional()
      .label("Minimum order total"),

    maxTotal: Joi.number()
      .min(0)
      .optional()
      .label("Maximum order total")
      .when("minTotal", {
        is: Joi.exist(),
        then: Joi.number().greater(Joi.ref("minTotal")),
        otherwise: Joi.number(),
      }),

    // 🔥 NEW: Product name search
    productName: Joi.string()
      .trim()
      .optional()
      .label("Product name"),

    customerId: Joi.string()
      .pattern(objectIdRegex)
      .optional()
      .messages({
        "string.pattern.base": "Invalid customer ID format",
      })
      .label("Customer ID"),
  })
).label("GetAllOrdersQuery");

// Manual Order Creation Schema
const orderItemSchema = Joi.object({
  productId: Joi.string()
    .pattern(objectIdRegex)
    .required()
    .messages({
      "string.pattern.base": "Invalid product ID format",
      "any.required": "Product ID is required",
    })
    .label("Product ID"),
  variantType: Joi.string()
    .valid("SACHETS", "STAND_UP_POUCH")
    .required()
    .label("Variant Type"),
  quantity: Joi.number().integer().min(1).optional().default(1).label("Quantity"),
  planDays: Joi.number()
    .integer()
    .valid(30, 60, 90, 180)
    .optional()
    .label("Plan Days"),
  capsuleCount: Joi.number()
    .integer()
    .valid(30, 60)
    .optional()
    .label("Capsule Count"),
});

export const createManualOrderSchema = Joi.object(
  withFieldLabels({
    userId: Joi.string()
      .pattern(objectIdRegex)
      .required()
      .messages({
        "string.pattern.base": "Invalid user ID format",
        "any.required": "User ID is required",
      })
      .label("User ID"),
    orderType: Joi.string()
      .valid("already_paid", "pending_payment")
      .required()
      .label("Order Type"),
    items: Joi.array()
      .items(orderItemSchema)
      .min(1)
      .required()
      .label("Order Items"),
    shippingAddressId: Joi.string()
      .pattern(objectIdRegex)
      .required()
      .messages({
        "string.pattern.base": "Invalid shipping address ID format",
        "any.required": "Shipping address ID is required",
      })
      .label("Shipping Address ID"),
    billingAddressId: Joi.string()
      .pattern(objectIdRegex)
      .optional()
      .messages({
        "string.pattern.base": "Invalid billing address ID format",
      })
      .label("Billing Address ID"),
    subTotal: Joi.number().min(0).required().label("Sub Total"),
    discountedPrice: Joi.number().min(0).required().label("Discounted Price"),
    couponDiscountAmount: Joi.number()
      .min(0)
      .default(0)
      .label("Coupon Discount Amount"),
    membershipDiscountAmount: Joi.number()
      .min(0)
      .default(0)
      .label("Membership Discount Amount"),
    subscriptionPlanDiscountAmount: Joi.number()
      .min(0)
      .default(0)
      .label("Subscription Plan Discount Amount"),
    taxAmount: Joi.number().min(0).default(0).label("Tax Amount"),
    grandTotal: Joi.number().min(0).required().label("Grand Total"),
    currency: Joi.string()
      .trim()
      .uppercase()
      .min(3)
      .max(5)
      .default("EUR")
      .label("Currency"),
    couponCode: Joi.string().trim().uppercase().optional().label("Coupon Code"),
    paymentMethod: Joi.string()
      .trim()
      .optional()
      .allow(null, "")
      .label("Payment Method"),
    notes: Joi.string().trim().optional().allow(null, "").label("Notes"),
    planType: Joi.string()
      .valid(...ORDER_PLAN_TYPE_VALUES)
      .required()
      .label("Plan Type"),
    isOneTime: Joi.boolean().required().label("Is One Time"),
    variantType: Joi.string()
      .valid("SACHETS", "STAND_UP_POUCH")
      .optional()
      .label("Variant Type"),
    selectedPlanDays: Joi.number()
      .integer()
      .valid(30, 60, 90, 180)
      .optional()
      .label("Selected Plan Days"),
  })
).label("CreateManualOrderPayload");

