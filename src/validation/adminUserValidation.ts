import Joi from "joi";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";

const objectIdSchema = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.invalid": "Invalid ID format",
  });

export const adminUserIdParamsSchema = Joi.object(
  withFieldLabels({
    id: objectIdSchema.required().label("User ID"),
  })
).label("AdminUserParams");

export const adminUpdateUserStatusSchema = Joi.object(
  withFieldLabels({
    isActive: Joi.boolean().required().label("Active Status").messages({
      "any.required": "Active status is required",
    }),
  })
).label("AdminUpdateUserStatusPayload");

export const adminGetAllUsersQuerySchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional().default(1).label("Page"),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .label("Limit"),
    search: Joi.string().trim().min(1).max(100).optional().label("Search"),
    isActive: Joi.boolean().optional().label("Active Status"),
    userType: Joi.string()
      .valid("New User", "Recurring User")
      .optional()
      .label("User Type"),
    registrationDate: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .messages({
        "string.pattern.base": "Registration date must be in YYYY-MM-DD format",
      })
      .label("Registration Date"),
  })
).label("AdminGetUsersQuery");
