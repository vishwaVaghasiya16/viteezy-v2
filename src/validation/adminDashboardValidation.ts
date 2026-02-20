import Joi from "joi";
import { withFieldLabels } from "./helpers";

export const revenueOverviewQuerySchema = Joi.object(
  withFieldLabels({
    period: Joi.string()
      .valid("daily", "weekly", "monthly")
      .optional()
      .default("monthly")
      .label("Period"),
    startDate: Joi.date().iso().optional().label("Start date"),
    endDate: Joi.date().iso().optional().label("End date"),
  })
).label("RevenueOverviewQuery");

export const topSellingPlansQuerySchema = Joi.object(
  withFieldLabels({
    date: Joi.date().iso().optional().label("Date"),
    month: Joi.string()
      .pattern(/^\d{4}-\d{2}$/)
      .optional()
      .label("Month")
      .messages({
        "string.pattern.base":
          "Month must be in YYYY-MM format (e.g., 2025-01)",
      }),
    startDate: Joi.date().iso().optional().label("Start date"),
    endDate: Joi.date()
      .iso()
      .optional()
      .label("End date")
      .when("startDate", {
        is: Joi.exist(),
        then: Joi.required(),
        otherwise: Joi.optional(),
      })
      .messages({
        "any.required": "End date is required when start date is provided",
      }),
  })
).label("TopSellingPlansQuery");

export const topSellingProductsQuerySchema = Joi.object(
  withFieldLabels({
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .label("Limit"),
    date: Joi.date().iso().optional().label("Date"),
    month: Joi.string()
      .pattern(/^\d{4}-\d{2}$/)
      .optional()
      .label("Month")
      .messages({
        "string.pattern.base":
          "Month must be in YYYY-MM format (e.g., 2025-01)",
      }),
    startDate: Joi.date().iso().optional().label("Start date"),
    endDate: Joi.date()
      .iso()
      .optional()
      .label("End date")
      .when("startDate", {
        is: Joi.exist(),
        then: Joi.required(),
        otherwise: Joi.optional(),
      })
      .messages({
        "any.required": "End date is required when start date is provided",
      }),
  })
).label("TopSellingProductsQuery");
