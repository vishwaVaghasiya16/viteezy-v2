/**
 * @fileoverview Express Validator Middleware
 * @description Middleware for validating request data using express-validator
 * @module middleware/validation
 */

import { Request, Response, NextFunction } from "express";
import {
  validationResult,
  ValidationError,
  matchedData,
} from "express-validator";
import { AppError } from "@/utils/AppError";
import { HTTP_STATUS } from "@/constants";

/**
 * Validate Request Middleware
 * @function validateRequest
 * @description Validates request data using express-validator rules and checks for unknown fields
 * Throws AppError if validation fails or unknown fields are found
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @throws {AppError} If validation fails or unknown fields are found
 * @returns {void}
 */
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // First check for unknown fields (fields not in validation rules)
  checkUnknownFields(req);

  // Get validation results
  const errors = validationResult(req);

  // If validation fails, throw error with first error message
  if (!errors.isEmpty()) {
    const errorArray = errors.array();
    const firstError: ValidationError = errorArray[0];
    const firstMessage = firstError?.msg || "Validation error";

    // Create AppError with validation details
    const appErr = new AppError(
      "Validation error",
      HTTP_STATUS.BAD_REQUEST,
      true,
      "ValidationError"
    );
    (appErr as any).error = firstMessage;
    (appErr as any).errors = errorArray;

    throw appErr;
  }

  // Continue to next middleware if validation passes
  next();
};

/**
 * Check for unknown fields in request body
 * @function checkUnknownFields
 * @description Checks if request body contains fields not defined in validation rules
 * Uses matchedData to get only fields that were validated
 * @param {Request} req - Express request object
 * @throws {AppError} If unknown fields are found
 * @returns {void}
 */
const checkUnknownFields = (req: Request): void => {
  if (!req.body || typeof req.body !== "object") {
    return;
  }

  // Get only the data that matched validation rules
  const matched = matchedData(req, {
    locations: ["body"],
    includeOptionals: true,
  });

  const allowedFields = Object.keys(matched);
  const bodyKeys = Object.keys(req.body);
  const unknownFields = bodyKeys.filter((key) => !allowedFields.includes(key));

  if (unknownFields.length > 0) {
    const fieldNames = unknownFields.join(", ");
    const errorMessage =
      unknownFields.length === 1
        ? `Field '${fieldNames}' is not allowed`
        : `Fields '${fieldNames}' are not allowed`;

    const appErr = new AppError(
      errorMessage,
      HTTP_STATUS.BAD_REQUEST,
      true,
      "ValidationError"
    );
    (appErr as any).error = errorMessage;
    (appErr as any).errors = unknownFields.map((field) => ({
      field,
      message: `Field '${field}' is not allowed`,
      value: req.body[field],
    }));

    throw appErr;
  }
};

/**
 * Get formatted validation errors
 * @function getValidationErrors
 * @description Formats validation errors into a readable structure
 * @param {Request} req - Express request object
 * @returns {Array<{field: string; message: string; value?: any}>} Formatted validation errors
 */
export const getValidationErrors = (
  req: Request
): Array<{
  field: string;
  message: string;
  value?: any;
}> => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return [];
  }

  return errors.array().map((error: ValidationError) => ({
    field: error.type === "field" ? error.path : "unknown",
    message: error.msg,
    value: (error as any).value,
  }));
};
