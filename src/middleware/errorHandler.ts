/**
 * @fileoverview Global Error Handler Middleware
 * @description Handles all errors in the application and sends standardized error responses
 * @module middleware/errorHandler
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";
import { ApiResponse } from "@/types";
import { HTTP_STATUS } from "@/constants";

/**
 * Sensitive fields to redact from error logs
 * @constant {string[]} SENSITIVE_FIELDS
 */
const SENSITIVE_FIELDS = [
  "password",
  "otp",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "apiKey",
  "apiSecret",
];

/**
 * Mask sensitive data in objects
 * @function maskSensitiveData
 * @description Recursively redacts sensitive fields from objects before logging
 * @param {any} obj - Object to mask
 * @returns {any} Object with sensitive fields redacted
 */
const maskSensitiveData = (obj: any): any => {
  try {
    // Deep clone the object to avoid mutating the original
    const clone = JSON.parse(JSON.stringify(obj || {}));

    /**
     * Recursive function to redact sensitive fields
     * @param {any} o - Object to process
     * @returns {any} Object with sensitive fields redacted
     */
    const redact = (o: any): any => {
      if (!o || typeof o !== "object") {
        return o;
      }

      // Process all keys in the object
      for (const key of Object.keys(o)) {
        // Redact sensitive fields
        if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
          o[key] = "[REDACTED]";
        }
        // Recursively process nested objects
        else if (o[key] && typeof o[key] === "object") {
          redact(o[key]);
        }
      }

      return o;
    };

    return redact(clone);
  } catch {
    // Return empty object if masking fails
    return {};
  }
};

/**
 * Handle Mongoose validation errors
 * @function handleValidationError
 * @param {any} error - Mongoose validation error
 * @returns {{ statusCode: number; message: string; errorType: string; errorText: string }}
 */
const handleValidationError = (
  error: any
): {
  statusCode: number;
  message: string;
  errorType: string;
  errorText: string;
} => {
  const errorMessages = Object.values(error.errors).map(
    (err: any) => err.message
  );

  return {
    statusCode: HTTP_STATUS.BAD_REQUEST,
    message: "Validation error",
    errorType: "Validation Error",
    errorText: errorMessages.join(", "),
  };
};

/**
 * Handle Mongoose duplicate key errors
 * @function handleDuplicateKeyError
 * @param {any} error - Mongoose duplicate key error
 * @returns {{ statusCode: number; message: string; errorType: string; errorText: string }}
 */
const handleDuplicateKeyError = (
  error: any
): {
  statusCode: number;
  message: string;
  errorType: string;
  errorText: string;
} => {
  const field = Object.keys(error.keyValue || {})[0] || "field";

  return {
    statusCode: HTTP_STATUS.CONFLICT,
    message: "Duplicate entry",
    errorType: "Duplicate Key Error",
    errorText: `${field} already exists`,
  };
};

/**
 * Handle JWT authentication errors
 * @function handleJWTError
 * @param {Error} error - JWT error
 * @returns {{ statusCode: number; message: string; errorType: string; errorText: string }}
 */
const handleJWTError = (
  error: Error
): {
  statusCode: number;
  message: string;
  errorType: string;
  errorText: string;
} => {
  if (error.name === "TokenExpiredError") {
    return {
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      message: "Authentication failed",
      errorType: "Authentication Error",
      errorText: "Token expired",
    };
  }

  return {
    statusCode: HTTP_STATUS.UNAUTHORIZED,
    message: "Authentication failed",
    errorType: "Authentication Error",
    errorText: "Invalid token",
  };
};

/**
 * Global Error Handler Middleware
 * @function errorHandler
 * @description Centralized error handling middleware that processes all errors
 * and sends standardized error responses to the client
 * @param {Error} error - The error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {void}
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Default error values
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = "Internal Server Error";
  let errorType = "Server Error";
  let errorText: string | undefined;

  // Handle AppError instances (custom application errors)
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    errorType = error.errorType || errorType;
    errorText = error.message; // Use the error message as error text
  }
  // Handle Mongoose validation errors
  else if (error.name === "ValidationError") {
    const errorInfo = handleValidationError(error as any);
    statusCode = errorInfo.statusCode;
    message = errorInfo.message;
    errorType = errorInfo.errorType;
    errorText = errorInfo.errorText;
  }
  // Handle Mongoose duplicate key errors (MongoDB error code 11000)
  else if ((error as any).code === 11000) {
    const errorInfo = handleDuplicateKeyError(error as any);
    statusCode = errorInfo.statusCode;
    message = errorInfo.message;
    errorType = errorInfo.errorType;
    errorText = errorInfo.errorText;
  }
  // Handle JWT errors
  else if (
    error.name === "JsonWebTokenError" ||
    error.name === "TokenExpiredError"
  ) {
    const errorInfo = handleJWTError(error);
    statusCode = errorInfo.statusCode;
    message = errorInfo.message;
    errorType = errorInfo.errorType;
    errorText = errorInfo.errorText;
  }
  // Handle CastError (invalid ObjectId format)
  else if (error.name === "CastError") {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = "Validation error";
    errorType = "Validation Error";
    errorText = "Invalid ID format";
  }
  // Handle Multer errors (file upload errors)
  else if (error.name === "MulterError") {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = "File upload error";
    errorType = "File Upload Error";

    const multerError = error as any;
    switch (multerError.code) {
      case "LIMIT_UNEXPECTED_FILE":
        errorText = "Only one file is allowed. Please upload a single file.";
        break;
      case "LIMIT_FILE_SIZE":
        errorText = `File size too large. Maximum allowed size is ${Math.round(
          (req as any).uploadLimit || 5
        )}MB.`;
        break;
      case "LIMIT_FILE_COUNT":
        errorText = "Too many files. Only one file is allowed.";
        break;
      case "LIMIT_FIELD_KEY":
        errorText = "Invalid field name for file upload.";
        break;
      default:
        errorText = multerError.message || "File upload failed.";
    }
  }
  // Handle other unexpected errors
  else {
    // Log unexpected errors for debugging
    logger.error("Unexpected error:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }

  // Log error with masked sensitive data
  logger.error("Error occurred:", {
    message: error.message,
    stack: error.stack,
    statusCode,
    errorType,
    error: errorText,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    body: maskSensitiveData(req.body),
    params: maskSensitiveData(req.params),
    query: maskSensitiveData(req.query),
  });

  // Send standardized error response
  const response: ApiResponse = {
    success: false,
    message,
    errorType: errorType || "Server Error",
    error: errorText || message,
    data: null,
  };

  res.status(statusCode).json(response);
};
