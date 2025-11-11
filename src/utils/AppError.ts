/**
 * @fileoverview Custom Application Error Class
 * @description Extended Error class for application-specific errors with status codes
 * @module utils/AppError
 */

/**
 * Custom Application Error Class
 * @class AppError
 * @extends Error
 * @description Custom error class for handling application-specific errors
 * Includes status code and operational flag for error handling
 */
export class AppError extends Error {
  /** HTTP status code for the error */
  public readonly statusCode: number;

  /** Whether the error is operational (expected) or programming error */
  public readonly isOperational: boolean;

  /** Error type/category */
  public readonly errorType?: string;

  /**
   * Creates an instance of AppError
   * @constructor
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {boolean} isOperational - Whether error is operational (default: true)
   * @param {string} errorType - Error type/category (optional)
   */
  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    errorType?: string
  ) {
    super(message);

    // Set error properties
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorType = errorType;

    // Set error name to class name
    this.name = this.constructor.name;

    // Maintains proper stack trace for where our error was thrown
    // Only available in V8 engines (Node.js, Chrome)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON format
   * @method toJSON
   * @returns {object} JSON representation of the error
   */
  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      errorType: this.errorType,
      stack: this.stack,
    };
  }
}

/**
 * Create a Bad Request error (400)
 * @function createBadRequestError
 * @param {string} message - Error message
 * @returns {AppError} Bad request error instance
 */
export const createBadRequestError = (message: string): AppError => {
  return new AppError(message, 400, true, "BadRequest");
};

/**
 * Create an Unauthorized error (401)
 * @function createUnauthorizedError
 * @param {string} message - Error message
 * @returns {AppError} Unauthorized error instance
 */
export const createUnauthorizedError = (message: string): AppError => {
  return new AppError(message, 401, true, "Unauthorized");
};

/**
 * Create a Forbidden error (403)
 * @function createForbiddenError
 * @param {string} message - Error message
 * @returns {AppError} Forbidden error instance
 */
export const createForbiddenError = (message: string): AppError => {
  return new AppError(message, 403, true, "Forbidden");
};

/**
 * Create a Not Found error (404)
 * @function createNotFoundError
 * @param {string} message - Error message
 * @returns {AppError} Not found error instance
 */
export const createNotFoundError = (message: string): AppError => {
  return new AppError(message, 404, true, "NotFound");
};

/**
 * Create a Conflict error (409)
 * @function createConflictError
 * @param {string} message - Error message
 * @returns {AppError} Conflict error instance
 */
export const createConflictError = (message: string): AppError => {
  return new AppError(message, 409, true, "Conflict");
};

/**
 * Create a Validation error (422)
 * @function createValidationError
 * @param {string} message - Error message
 * @returns {AppError} Validation error instance
 */
export const createValidationError = (message: string): AppError => {
  return new AppError(message, 422, true, "ValidationError");
};

/**
 * Create an Internal Server error (500)
 * @function createInternalServerError
 * @param {string} message - Error message
 * @returns {AppError} Internal server error instance
 */
export const createInternalServerError = (message: string): AppError => {
  return new AppError(message, 500, false, "InternalServerError");
};
