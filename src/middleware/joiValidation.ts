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
  stripUnknown: true, // Remove unknown fields from the validated object
  allowUnknown: false, // Don't allow unknown fields
  convert: true, // Convert types where possible
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
  const firstMessage = firstError?.message || "Validation error";

  const appErr = new AppError(
    "Validation error",
    HTTP_STATUS.BAD_REQUEST,
    true,
    "Validation Error"
  );

  (appErr as any).error = firstMessage;
  (appErr as any).errors = error.details.map((detail) => ({
    field: detail.path.join("."),
    message: detail.message,
    value: detail.context?.value,
  }));

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
