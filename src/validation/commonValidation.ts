import Joi from "joi";
import { withFieldLabels } from "./helpers";

export const paginationQuerySchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional().label("Page"),
    limit: Joi.number().integer().min(1).max(100).optional().label("Limit"),
    sort: Joi.string().trim().optional().label("Sort field"),
    order: Joi.string().valid("asc", "desc").optional().label("Sort order"),
    search: Joi.string().trim().allow("", null).optional().label("Search term"),
    status: Joi.string().trim().optional().label("Status filter"),
    categoryId: Joi.string().trim().optional().label("Category filter"),
  })
).label("PaginationQuery");
