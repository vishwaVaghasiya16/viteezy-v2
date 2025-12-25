/**
 * @fileoverview Joi Validation Middleware
 * @description Middleware for validating request data using Joi schemas
 * @module middleware/joiValidation
 */

import { Request, Response, NextFunction } from "express";
import Joi, { ObjectSchema, ValidationError as JoiValidationError } from "joi";
import { AppError } from "@/utils/AppError";
import { HTTP_STATUS } from "@/constants";

/**
 * Joi Validation Options
 * @constant {object} VALIDATION_OPTIONS
 */
const VALIDATION_OPTIONS: Joi.ValidationOptions = {
  abortEarly: false, // Return all validation errors, not just the first
  stripUnknown: false, // Don't remove unknown fields - throw error instead
  allowUnknown: false, // Don't allow unknown fields - throw error if found
  convert: true, // Convert types where possible
};

/**
 * Clean Joi error message by removing quotes from labels
 * @function cleanErrorMessage
 * @description Removes quotes from field labels in Joi error messages
 * @param {string} message - Original Joi error message
 * @returns {string} Cleaned error message without quotes
 * @example
 * '"ID" is required' -> 'ID is required'
 * '"Order ID" must be a valid date' -> 'Order ID must be a valid date'
 */
const cleanErrorMessage = (message: string): string => {
  // Remove quotes around field labels (e.g., "ID" -> ID)
  // Pattern: matches quoted strings at the start of the message or after certain words
  return message
    .replace(/"([^"]+)"/g, "$1") // Remove all quotes around labels
    .trim();
};

/**
 * Create validation error from Joi error
 * @function createValidationError
 * @description Creates an AppError from Joi validation error
 * @param {JoiValidationError} error - Joi validation error
 * @returns {AppError} AppError instance with validation details
 */
const createValidationError = (error: JoiValidationError): AppError => {
  const firstError = error.details[0];

  // Try multiple ways to extract the error message
  // 1. Check context.message (for custom validation errors)
  // 2. Check message directly (which may contain the custom message)
  // 3. Fallback to default
  const contextMessage = (firstError?.context as any)?.message;
  const errorMessage = firstError?.message || "Validation error";

  // For custom validation errors, the message might be in the errorMessage itself
  // Check if errorMessage contains our custom messages
  let rawMessage = contextMessage || errorMessage;

  // If the message contains custom validation text, use it directly
  if (
    errorMessage.includes("Token is not allowed") ||
    errorMessage.includes("OTP is not allowed") ||
    errorMessage.includes("OTP is required") ||
    errorMessage.includes("Reset token is required") ||
    errorMessage.includes("deviceInfo must be")
  ) {
    rawMessage = errorMessage;
  }

  // Check if error is about unknown field (but not our custom validation)
  const isUnknownField =
    rawMessage.includes("is not allowed") &&
    !rawMessage.includes("Token is not allowed") &&
    !rawMessage.includes("OTP is not allowed");

  // Format error message
  let cleanedMessage = cleanErrorMessage(rawMessage);
  if (isUnknownField) {
    const fieldName = firstError?.path?.join(".") || "field";
    cleanedMessage = `${fieldName} is not allowed`;
  }

  const appErr = new AppError(
    cleanedMessage, // Use the cleaned message as the main error message
    HTTP_STATUS.BAD_REQUEST,
    true,
    "Validation Error"
  );

  (appErr as any).error = cleanedMessage;
  (appErr as any).errors = error.details.map((detail) => {
    const detailContextMessage = (detail.context as any)?.message;
    const detailMessage = detail.message || "Validation error";

    // Check if this is a custom validation message
    const isCustomMessage =
      detailMessage.includes("Token is not allowed") ||
      detailMessage.includes("OTP is not allowed") ||
      detailMessage.includes("OTP is required") ||
      detailMessage.includes("Reset token is required") ||
      detailMessage.includes("deviceInfo must be");

    const isUnknown =
      detailMessage.includes("is not allowed") && !isCustomMessage;
    const fieldName = detail.path.join(".") || "validation";

    // Prioritize custom message from context, then custom message in detailMessage, then default
    let message: string;
    if (detailContextMessage) {
      message = cleanErrorMessage(detailContextMessage);
    } else if (isCustomMessage) {
      message = cleanErrorMessage(detailMessage);
    } else if (isUnknown) {
      message = `${fieldName} is not allowed`;
    } else {
      message = cleanErrorMessage(detailMessage);
    }

    return {
      field: fieldName,
      message: message,
      value: detail.context?.value,
    };
  });

  return appErr;
};

/**
 * Generic Joi validation middleware for request body
 * @function validateJoi
 * @description Validates request body using Joi schema
 * @param {ObjectSchema} schema - Joi validation schema
 * @returns {Function} Express middleware function
 * @example
 * ```typescript
 * router.post('/users', validateJoi(userSchema), userController.create);
 * ```
 */
export const validateJoi = (schema: ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Validate request body against schema
    const { error, value } = schema.validate(req.body, VALIDATION_OPTIONS);

    // If validation fails, throw error
    if (error) {
      throw createValidationError(error);
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

/**
 * Joi validation middleware for request query parameters
 * @function validateQuery
 * @description Validates request query parameters using Joi schema
 * @param {ObjectSchema} schema - Joi validation schema
 * @returns {Function} Express middleware function
 * @example
 * ```typescript
 * router.get('/users', validateQuery(paginationSchema), userController.list);
 * ```
 */
export const validateQuery = (schema: ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Validate request query against schema
    const { error, value } = schema.validate(req.query, VALIDATION_OPTIONS);

    // If validation fails, throw error
    if (error) {
      throw createValidationError(error);
    }

    // Replace req.query with validated and sanitized data
    req.query = value;
    next();
  };
};

/**
 * Joi validation middleware for request route parameters
 * @function validateParams
 * @description Validates request route parameters using Joi schema
 * @param {ObjectSchema} schema - Joi validation schema
 * @returns {Function} Express middleware function
 * @example
 * ```typescript
 * router.get('/users/:id', validateParams(idSchema), userController.getById);
 * ```
 */
export const validateParams = (schema: ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Validate request params against schema
    const { error, value } = schema.validate(req.params, VALIDATION_OPTIONS);

    // If validation fails, throw error
    if (error) {
      throw createValidationError(error);
    }

    // Replace req.params with validated and sanitized data
    req.params = value;
    next();
  };
};

/**
 * Combined Joi validation middleware for params, query, and body
 * @function validate
 * @description Validates request params, query, and body using a combined Joi schema
 * @param {ObjectSchema} schema - Joi validation schema with params, query, and/or body properties
 * @returns {Function} Express middleware function
 * @example
 * ```typescript
 * const schema = Joi.object({
 *   params: Joi.object({ id: Joi.string().required() }),
 *   query: Joi.object({ page: Joi.number().optional() }),
 *   body: Joi.object({ name: Joi.string().required() })
 * });
 * router.post('/users/:id', validate(schema), userController.update);
 * ```
 */
export const validate = (schema: ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Validate entire request object (params, query, body)
    const { error, value } = schema.validate(
      {
        params: req.params,
        query: req.query,
        body: req.body,
      },
      VALIDATION_OPTIONS
    );

    // If validation fails, throw error
    if (error) {
      throw createValidationError(error);
    }

    // Replace request properties with validated and sanitized data
    if (value.params) req.params = value.params;
    if (value.query) req.query = value.query;
    if (value.body) req.body = value.body;

    next();
  };
};
