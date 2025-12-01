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
  })
).label("TopSellingProductsQuery");
