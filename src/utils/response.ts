/**
 * @fileoverview Response helper utilities
 * @description Helper class for sending standardized API responses
 * @module utils/response
 */

import { Response } from "express";
import { ApiResponse } from "@/types";
import { HTTP_STATUS } from "@/constants";

/**
 * Response Helper Class
 * @class ResponseHelper
 * @description Utility class for sending standardized API responses
 * Provides methods for success, error, and paginated responses
 */
export class ResponseHelper {
  /**
   * Send success response
   * @static
   * @method success
   * @template T - Type of response data
   * @param {Response} res - Express response object
   * @param {T} data - Response data (optional)
   * @param {string} message - Success message (default: "Success")
   * @param {number} statusCode - HTTP status code (default: 200)
   * @returns {Response<ApiResponse<T>>} Express response with JSON data
   */
  static success<T>(
    res: Response,
    data?: T,
    message: string = "Success",
    statusCode: number = HTTP_STATUS.OK
  ): Response<ApiResponse<T>> {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send created response (201)
   * @static
   * @method created
   * @template T - Type of response data
   * @param {Response} res - Express response object
   * @param {T} data - Created resource data (optional)
   * @param {string} message - Success message (default: "Resource created successfully")
   * @returns {Response<ApiResponse<T>>} Express response with JSON data
   */
  static created<T>(
    res: Response,
    data?: T,
    message: string = "Resource created successfully"
  ): Response<ApiResponse<T>> {
    return this.success(res, data, message, HTTP_STATUS.CREATED);
  }

  /**
   * Send no content response (204)
   * @static
   * @method noContent
   * @param {Response} res - Express response object
   * @param {string} message - Success message (default: "No content")
   * @returns {Response<ApiResponse>} Express response with JSON data
   */
  static noContent(
    res: Response,
    message: string = "No content"
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: true,
      message,
    };

    return res.status(HTTP_STATUS.NO_CONTENT).json(response);
  }

  /**
   * Send paginated response
   * @static
   * @method paginated
   * @template T - Type of items in the paginated array
   * @param {Response} res - Express response object
   * @param {T[]} data - Array of items for current page
   * @param {object} pagination - Pagination metadata
   * @param {number} pagination.page - Current page number
   * @param {number} pagination.limit - Items per page
   * @param {number} pagination.total - Total number of items
   * @param {number} pagination.pages - Total number of pages
   * @param {string} message - Success message (default: "")
   * @returns {Response<ApiResponse<T[]>>} Express response with JSON data
   */
  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    },
    message: string = ""
  ): Response<ApiResponse<T[]>> {
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

    return res.status(HTTP_STATUS.OK).json(response);
  }

  /**
   * Send error response
   * @static
   * @method error
   * @param {Response} res - Express response object
   * @param {string} message - Error message (default: "Internal Server Error")
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {string} error - Error details (optional)
   * @returns {Response<ApiResponse>} Express response with JSON error data
   */
  static error(
    res: Response,
    message: string = "Internal Server Error",
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode?: string,
    errorMessage?: string
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      errorType: errorCode || "Server Error",
      error: errorMessage || message,
      data: null,
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send validation error response (422)
   * @static
   * @method validationError
   * @param {Response} res - Express response object
   * @param {string} message - Error message (default: "Validation failed")
   * @param {any[]} errors - Array of validation errors (optional)
   * @returns {Response<ApiResponse>} Express response with JSON error data
   */
  static validationError(
    res: Response,
    message: string = "Validation failed",
    errorMessage?: string
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      errorType: "Validation Error",
      error: errorMessage || message,
      data: null,
    };

    return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(response);
  }

  /**
   * Send not found response (404)
   * @static
   * @method notFound
   * @param {Response} res - Express response object
   * @param {string} message - Error message (default: "Resource not found")
   * @returns {Response<ApiResponse>} Express response with JSON error data
   */
  static notFound(
    res: Response,
    message: string = "Resource not found"
  ): Response<ApiResponse> {
    return this.error(
      res,
      message,
      HTTP_STATUS.NOT_FOUND,
      "Not Found Error",
      message
    );
  }

  /**
   * Send unauthorized response (401)
   * @static
   * @method unauthorized
   * @param {Response} res - Express response object
   * @param {string} message - Error message (default: "Unauthorized access")
   * @returns {Response<ApiResponse>} Express response with JSON error data
   */
  static unauthorized(
    res: Response,
    message: string = "Unauthorized access"
  ): Response<ApiResponse> {
    return this.error(
      res,
      message,
      HTTP_STATUS.UNAUTHORIZED,
      "Authentication Error",
      message
    );
  }

  /**
   * Send forbidden response (403)
   * @static
   * @method forbidden
   * @param {Response} res - Express response object
   * @param {string} message - Error message (default: "Access forbidden")
   * @returns {Response<ApiResponse>} Express response with JSON error data
   */
  static forbidden(
    res: Response,
    message: string = "Access forbidden"
  ): Response<ApiResponse> {
    return this.error(
      res,
      message,
      HTTP_STATUS.FORBIDDEN,
      "Authorization Error",
      message
    );
  }

  /**
   * Send conflict response (409)
   * @static
   * @method conflict
   * @param {Response} res - Express response object
   * @param {string} message - Error message (default: "Resource conflict")
   * @returns {Response<ApiResponse>} Express response with JSON error data
   */
  static conflict(
    res: Response,
    message: string = "Resource conflict"
  ): Response<ApiResponse> {
    return this.error(
      res,
      message,
      HTTP_STATUS.CONFLICT,
      "Conflict Error",
      message
    );
  }

  /**
   * Send bad request response (400)
   * @static
   * @method badRequest
   * @param {Response} res - Express response object
   * @param {string} message - Error message (default: "Bad request")
   * @param {string} errorMessage - Error message details (optional)
   * @returns {Response<ApiResponse>} Express response with JSON error data
   */
  static badRequest(
    res: Response,
    message: string = "Bad request",
    errorMessage?: string
  ): Response<ApiResponse> {
    return this.error(
      res,
      message,
      HTTP_STATUS.BAD_REQUEST,
      "Bad Request",
      errorMessage || message
    );
  }
}

// Export individual methods for easier use
export const {
  success,
  created,
  noContent,
  paginated,
  error,
  validationError,
  notFound,
  unauthorized,
  forbidden,
  conflict,
  badRequest,
} = ResponseHelper;
