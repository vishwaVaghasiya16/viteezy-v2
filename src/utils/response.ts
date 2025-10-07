import { Response } from "express";
import { ApiResponse, PaginationQuery } from "@/types";
import { HTTP_STATUS } from "@/constants";

export class ResponseHelper {
  /**
   * Send success response
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
   * Send created response
   */
  static created<T>(
    res: Response,
    data?: T,
    message: string = "Resource created successfully"
  ): Response<ApiResponse<T>> {
    return this.success(res, data, message, HTTP_STATUS.CREATED);
  }

  /**
   * Send no content response
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
    message: string = "Data retrieved successfully"
  ): Response<ApiResponse<T[]>> {
    const response: ApiResponse<T[]> = {
      success: true,
      message,
      data,
      pagination,
    };

    return res.status(HTTP_STATUS.OK).json(response);
  }

  /**
   * Send error response
   */
  static error(
    res: Response,
    message: string = "Internal Server Error",
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    error?: string
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      error,
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send validation error response
   */
  static validationError(
    res: Response,
    message: string = "Validation failed",
    errors?: any[]
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      error: errors,
    };

    return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(response);
  }

  /**
   * Send not found response
   */
  static notFound(
    res: Response,
    message: string = "Resource not found"
  ): Response<ApiResponse> {
    return this.error(res, message, HTTP_STATUS.NOT_FOUND);
  }

  /**
   * Send unauthorized response
   */
  static unauthorized(
    res: Response,
    message: string = "Unauthorized access"
  ): Response<ApiResponse> {
    return this.error(res, message, HTTP_STATUS.UNAUTHORIZED);
  }

  /**
   * Send forbidden response
   */
  static forbidden(
    res: Response,
    message: string = "Access forbidden"
  ): Response<ApiResponse> {
    return this.error(res, message, HTTP_STATUS.FORBIDDEN);
  }

  /**
   * Send conflict response
   */
  static conflict(
    res: Response,
    message: string = "Resource conflict"
  ): Response<ApiResponse> {
    return this.error(res, message, HTTP_STATUS.CONFLICT);
  }

  /**
   * Send bad request response
   */
  static badRequest(
    res: Response,
    message: string = "Bad request",
    errors?: any[]
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      error: errors,
    };

    return res.status(HTTP_STATUS.BAD_REQUEST).json(response);
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
