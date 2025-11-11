/**
 * @fileoverview Express Validator Middleware
 * @description Middleware for validating request data using express-validator
 * @module middleware/validation
 */

import { Request, Response, NextFunction } from "express";
import { validationResult, ValidationError } from "express-validator";
import { AppError } from "@/utils/AppError";
import { HTTP_STATUS } from "@/constants";

/**
 * Validate Request Middleware
 * @function validateRequest
 * @description Validates request data using express-validator rules
 * Throws AppError if validation fails
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @throws {AppError} If validation fails
 * @returns {void}
 */
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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
