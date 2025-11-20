import { query, param, body } from "express-validator";
import { USER_ROLE_VALUES } from "@/models/enums";

const ROLE_QUERY_VALUES = USER_ROLE_VALUES.map((role) => role.toLowerCase());

export const adminGetUserByIdValidation = [
  param("id").isMongoId().withMessage("Invalid user ID format"),
];

export const adminUpdateUserStatusValidation = [
  param("id").isMongoId().withMessage("Invalid user ID format"),
  body("isActive").isBoolean().withMessage("isActive must be a boolean value"),
];

export const adminGetAllUsersValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("search")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),
  query("role")
    .optional()
    .isIn(ROLE_QUERY_VALUES)
    .withMessage(`Role must be one of: ${ROLE_QUERY_VALUES.join(", ")}`),
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
  query("sort")
    .optional()
    .isIn(["name", "email", "createdAt", "updatedAt"])
    .withMessage("Sort field must be name, email, createdAt, or updatedAt"),
  query("order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Order must be asc or desc"),
];
