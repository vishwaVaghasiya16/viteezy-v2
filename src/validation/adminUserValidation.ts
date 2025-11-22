import Joi from "joi";
import mongoose from "mongoose";
import { USER_ROLE_VALUES } from "@/models/enums";
import { withFieldLabels } from "./helpers";

const ROLE_QUERY_VALUES = USER_ROLE_VALUES.map((role) => role.toLowerCase());

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
    id: objectIdSchema.required(),
  })
).label("AdminUserParams");

export const adminUpdateUserStatusSchema = Joi.object(
  withFieldLabels({
    isActive: Joi.boolean().required().messages({
      "any.required": "Is active is required",
    }),
  })
).label("AdminUpdateUserStatusPayload");

export const adminGetAllUsersQuerySchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().trim().min(1).max(100).optional(),
    role: Joi.string()
      .valid(...ROLE_QUERY_VALUES)
      .optional(),
    isActive: Joi.boolean().optional(),
    sort: Joi.string()
      .valid("name", "email", "createdAt", "updatedAt")
      .optional(),
    order: Joi.string().valid("asc", "desc").optional(),
  })
)
  .default({})
  .label("AdminGetUsersQuery");
