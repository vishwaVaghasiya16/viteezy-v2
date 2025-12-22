/**
 * @fileoverview API Types and Interfaces
 * @description TypeScript interfaces and types for API requests, responses, and configurations
 * @module types/api
 */

import { Request } from "express";

/**
 * Extended Request interface with custom properties
 * @interface ApiRequest
 * @extends Request
 * @description Extended Express Request with user, pagination, and filter data
 */
export interface ApiRequest extends Request {
  /** Authenticated user object */
  user?: any;
  /** User ID from authentication token */
  userId?: string;
  /** Pagination options parsed from query parameters */
  pagination?: {
    /** Current page number */
    page: number;
    /** Number of items per page */
    limit: number;
    /** Number of items to skip */
    skip: number;
    /** Sort configuration (field: 1 for ascending, -1 for descending) */
    sort: Record<string, 1 | -1>;
  };
  /** Filter options for querying data */
  filters?: Record<string, any>;
  /** Search query string */
  search?: string;
}

/**
 * Standard API Response interface
 * @interface ApiResponse
 * @template T - Type of response data
 * @description Standardized API response format
 */
export interface ApiResponse<T = any> {
  /** Whether the request was successful */
  success: boolean;
  /** Response message */
  message: string;
  /** Error object (only present on errors) */
  error?: {
    /** Error code/type */
    code: string;
    /** Error message */
    message: string;
  };
  /** Response data (always present, null on errors or when no data) */
  data?: T | null;
  /** Pagination metadata (only present for paginated responses) - deprecated, use meta.pagination */
  pagination?: PaginationMeta;
  /** Additional response metadata */
  meta?: {
    /** Pagination metadata (for paginated responses) */
    pagination?: PaginationMeta;
    /** Response timestamp */
    timestamp?: string;
    /** Request ID for tracking */
    requestId?: string;
    /** API version */
    version?: string;
  };
}

/**
 * Pagination Metadata Interface
 * @interface PaginationMeta
 * @description Metadata about paginated results
 */
export interface PaginationMeta {
  /** Current page number */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  pages: number;
  /** Whether there is a next page */
  hasNext: boolean;
  /** Whether there is a previous page */
  hasPrev: boolean;
}

/**
 * API Error Interface
 * @interface ApiError
 * @description Standardized error format for API responses
 */
export interface ApiError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Additional error details */
  details?: any;
  /** Field name (for validation errors) */
  field?: string;
}

/**
 * Validation Error Interface
 * @interface ValidationError
 * @description Error format for validation failures
 */
export interface ValidationError {
  /** Field name that failed validation */
  field: string;
  /** Validation error message */
  message: string;
  /** Invalid value that was provided */
  value?: any;
  /** Validation error code */
  code?: string;
}

/**
 * Success Response Data Interface
 * @interface SuccessResponse
 * @template T - Type of response data
 * @description Format for successful API responses
 */
export interface SuccessResponse<T = any> {
  /** Response data */
  data: T;
  /** Success message */
  message: string;
  /** HTTP status code */
  statusCode: number;
}

/**
 * Paginated Response Data Interface
 * @interface PaginatedResponse
 * @template T - Type of items in the paginated array
 * @description Format for paginated API responses
 */
export interface PaginatedResponse<T = any> {
  /** Array of items for current page */
  data: T[];
  /** Pagination metadata */
  pagination: PaginationMeta;
  /** Success message */
  message: string;
  /** HTTP status code */
  statusCode: number;
}

/**
 * API Endpoint Configuration Interface
 * @interface ApiEndpoint
 * @description Configuration for API endpoints
 */
export interface ApiEndpoint {
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** Endpoint path */
  path: string;
  /** Request handler function */
  handler: Function;
  /** Middleware functions to apply */
  middleware?: Function[];
  /** Validation rules */
  validation?: any[];
  /** Endpoint description */
  description?: string;
  /** API tags for documentation */
  tags?: string[];
  /** Response schemas for different status codes */
  responses?: {
    [statusCode: number]: {
      /** Response description */
      description: string;
      /** Response schema */
      schema?: any;
    };
  };
}

/**
 * API Version Configuration Interface
 * @interface ApiVersion
 * @description Configuration for API versioning
 */
export interface ApiVersion {
  /** API version number */
  version: string;
  /** Base path for the API version */
  basePath: string;
  /** List of endpoints in this version */
  endpoints: ApiEndpoint[];
  /** Middleware to apply to all endpoints in this version */
  middleware?: Function[];
}

/**
 * Request Context Interface
 * @interface RequestContext
 * @description Context information about the current request
 */
export interface RequestContext {
  /** Unique request ID */
  requestId: string;
  /** User ID (if authenticated) */
  userId?: string;
  /** Client IP address */
  ip: string;
  /** User agent string */
  userAgent: string;
  /** Request timestamp */
  timestamp: Date;
  /** HTTP method */
  method: string;
  /** Request URL */
  url: string;
}

/**
 * Response Metadata Interface
 * @interface ResponseMetadata
 * @description Metadata about the API response
 */
export interface ResponseMetadata {
  /** Request ID for tracking */
  requestId: string;
  /** Request processing time in milliseconds */
  processingTime: number;
  /** Response timestamp */
  timestamp: string;
  /** API version */
  version: string;
  /** Environment (development, production, etc.) */
  environment: string;
}
