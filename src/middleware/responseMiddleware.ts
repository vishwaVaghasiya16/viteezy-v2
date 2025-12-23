/**
 * @fileoverview Response Middleware
 * @description Adds custom response helper methods to Express Response object
 * @module middleware/responseMiddleware
 */

import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "@/types";
import { HTTP_STATUS } from "@/constants";

/**
 * Extended Express Response Interface
 * @namespace Express
 * @interface Response
 * @description Adds custom API response methods to Express Response
 */
declare global {
  namespace Express {
    interface Response {
      /** Send success response */
      apiSuccess: <T>(data?: T, message?: string, statusCode?: number) => void;
      /** Send created response (201) */
      apiCreated: <T>(data?: T, message?: string) => void;
      /** Send no content response (204) */
      apiNoContent: (message?: string) => void;
      /** Send paginated response */
      apiPaginated: <T>(
        data: T[],
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        },
        message?: string
      ) => void;
      /** Send error response */
      apiError: (
        message?: string,
        statusCode?: number,
        errorCode?: string,
        errorMessage?: string
      ) => void;
      /** Send validation error response (422) */
      apiValidationError: (message?: string, errorMessage?: string) => void;
      /** Send not found response (404) */
      apiNotFound: (message?: string) => void;
      /** Send unauthorized response (401) */
      apiUnauthorized: (message?: string) => void;
      /** Send forbidden response (403) */
      apiForbidden: (message?: string) => void;
      /** Send conflict response (409) */
      apiConflict: (message?: string) => void;
      /** Send bad request response (400) */
      apiBadRequest: (message?: string, errorMessage?: string) => void;
    }
  }
}

/**
 * Response Middleware
 * @function responseMiddleware
 * @description Adds custom response helper methods to Express Response object
 * Must be registered before routes to be available in route handlers
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {void}
 */
export const responseMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  /**
   * Send success response
   * @method apiSuccess
   * @template T - Type of response data
   * @param {T} data - Response data (optional)
   * @param {string} message - Success message (default: "Success")
   * @param {number} statusCode - HTTP status code (default: 200)
   */
  res.apiSuccess = <T>(
    data?: T,
    message: string = "Success",
    statusCode: number = HTTP_STATUS.OK
  ): void => {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data: (data !== undefined ? data : null) as T | null,
    };
    res.status(statusCode).json(response);
  };

  /**
   * Send created response (201)
   * @method apiCreated
   * @template T - Type of response data
   * @param {T} data - Created resource data (optional)
   * @param {string} message - Success message (default: "Resource created successfully")
   */
  res.apiCreated = <T>(
    data?: T,
    message: string = "Resource created successfully"
  ): void => {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data: (data !== undefined ? data : null) as T | null,
    };
    res.status(HTTP_STATUS.CREATED).json(response);
  };

  /**
   * Send no content response (204)
   * @method apiNoContent
   * @param {string} message - Success message (default: "No content")
   */
  res.apiNoContent = (message: string = "No content"): void => {
    const response: ApiResponse = {
      success: true,
      message,
      data: null,
    };
    res.status(HTTP_STATUS.NO_CONTENT).json(response);
  };

  /**
   * Send paginated response
   * @method apiPaginated
   * @template T - Type of items in the array
   * @param {T[]} data - Array of items for current page
   * @param {object} pagination - Pagination metadata
   * @param {number} pagination.page - Current page number
   * @param {number} pagination.limit - Items per page
   * @param {number} pagination.total - Total number of items
   * @param {number} pagination.pages - Total number of pages
   * @param {string} message - Success message (default: "")
   */
  res.apiPaginated = <T>(
    data: T[],
    pagination: { page: number; limit: number; total: number; pages: number },
    message: string = ""
  ): void => {
    // Calculate hasNext and hasPrev for PaginationMeta
    const paginationMeta = {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: pagination.pages,
      hasNext: pagination.page < pagination.pages,
      hasPrev: pagination.page > 1,
    };

    const response: ApiResponse<T[]> = {
      success: true,
      message,
      data,
      pagination: paginationMeta,
    };
    res.status(HTTP_STATUS.OK).json(response);
  };

  /**
   * Send error response
   * @method apiError
   * @param {string} message - Error message (default: "Internal Server Error")
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {string} error - Error details (optional)
   */
  res.apiError = (
    message: string = "Internal Server Error",
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode?: string,
    errorMessage?: string
  ): void => {
    const response: ApiResponse = {
      success: false,
      message,
      error: {
        code: errorCode || "Server Error",
        message: errorMessage || message,
      },
      data: null,
    };
    res.status(statusCode).json(response);
  };

  /**
   * Send validation error response (422)
   * @method apiValidationError
   * @param {string} message - Error message (default: "Validation failed")
   * @param {any[]} errors - Array of validation errors (optional)
   */
  res.apiValidationError = (
    message: string = "Validation failed",
    errorMessage?: string
  ): void => {
    const response: ApiResponse = {
      success: false,
      message,
      error: {
        code: "Validation Error",
        message: errorMessage || message,
      },
      data: null,
    };
    res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(response);
  };

  /**
   * Send not found response (404)
   * @method apiNotFound
   * @param {string} message - Error message (default: "Resource not found")
   */
  res.apiNotFound = (message: string = "Resource not found"): void => {
    const response: ApiResponse = {
      success: false,
      message,
      error: {
        code: "Not Found Error",
        message: message,
      },
      data: null,
    };
    res.status(HTTP_STATUS.NOT_FOUND).json(response);
  };

  /**
   * Send unauthorized response (401)
   * @method apiUnauthorized
   * @param {string} message - Error message (default: "Unauthorized access")
   */
  res.apiUnauthorized = (message: string = "Unauthorized access"): void => {
    const response: ApiResponse = {
      success: false,
      message,
      error: {
        code: "Authentication Error",
        message: message,
      },
      data: null,
    };
    res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
  };

  /**
   * Send forbidden response (403)
   * @method apiForbidden
   * @param {string} message - Error message (default: "Access forbidden")
   */
  res.apiForbidden = (message: string = "Access forbidden"): void => {
    const response: ApiResponse = {
      success: false,
      message,
      error: {
        code: "Authorization Error",
        message: message,
      },
      data: null,
    };
    res.status(HTTP_STATUS.FORBIDDEN).json(response);
  };

  /**
   * Send conflict response (409)
   * @method apiConflict
   * @param {string} message - Error message (default: "Resource conflict")
   */
  res.apiConflict = (message: string = "Resource conflict"): void => {
    const response: ApiResponse = {
      success: false,
      message,
      error: {
        code: "Conflict Error",
        message: message,
      },
      data: null,
    };
    res.status(HTTP_STATUS.CONFLICT).json(response);
  };

  /**
   * Send bad request response (400)
   * @method apiBadRequest
   * @param {string} message - Error message (default: "Bad request")
   * @param {any[]} errors - Array of error details (optional)
   */
  res.apiBadRequest = (
    message: string = "Bad request",
    errorMessage?: string
  ): void => {
    const response: ApiResponse = {
      success: false,
      message,
      error: {
        code: "Bad Request",
        message: errorMessage || message,
      },
      data: null,
    };
    res.status(HTTP_STATUS.BAD_REQUEST).json(response);
  };

  // Continue to next middleware
  next();
};
