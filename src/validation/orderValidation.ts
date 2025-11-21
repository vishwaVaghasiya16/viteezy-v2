import { query, param } from "express-validator";
import { ORDER_STATUS_VALUES, PAYMENT_STATUS_VALUES } from "@/models/enums";

/**
 * Validation rules for getting order history
 */
export const getOrderHistoryValidation = [
  query("status")
    .optional()
    .isIn(ORDER_STATUS_VALUES)
    .withMessage(`Status must be one of: ${ORDER_STATUS_VALUES.join(", ")}`),
  query("paymentStatus")
    .optional()
    .isIn(PAYMENT_STATUS_VALUES)
    .withMessage(
      `Payment status must be one of: ${PAYMENT_STATUS_VALUES.join(", ")}`
    ),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

/**
 * Validation rules for getting order details
 */
export const getOrderDetailsValidation = [
  param("orderId")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Invalid Order ID provided."),
];
