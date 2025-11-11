/**
 * @fileoverview Pagination utility functions
 * @description Helper functions for handling pagination in API requests
 * @module utils/pagination
 */

import { Request } from "express";
import { PaginationQuery } from "@/types";
import { PAGINATION } from "@/constants";

/**
 * Pagination Options Interface
 * @interface PaginationOptions
 * @description Options for paginating database queries
 */
export interface PaginationOptions {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Number of items to skip */
  skip: number;
  /** Sort options (field: 1 for ascending, -1 for descending) */
  sort: Record<string, 1 | -1>;
}

/**
 * Pagination Metadata Interface
 * @interface PaginationMeta
 * @description Metadata about pagination results
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
 * Get pagination options from request query parameters
 * @function getPaginationOptions
 * @description Extracts and validates pagination parameters from request query
 * @param {Request} req - Express request object
 * @returns {PaginationOptions} Pagination options object
 * @example
 * ```typescript
 * const options = getPaginationOptions(req);
 * // { page: 1, limit: 10, skip: 0, sort: { createdAt: -1 } }
 * ```
 */
export const getPaginationOptions = (req: Request): PaginationOptions => {
  // Parse and validate page number (must be >= 1)
  const page = Math.max(
    1,
    parseInt(req.query.page as string, 10) || PAGINATION.DEFAULT_PAGE
  );

  // Parse and validate limit (must be between MIN_LIMIT and MAX_LIMIT)
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(
      PAGINATION.MIN_LIMIT,
      parseInt(req.query.limit as string, 10) || PAGINATION.DEFAULT_LIMIT
    )
  );

  // Calculate number of items to skip
  const skip = (page - 1) * limit;

  // Parse sort field and order
  const sortField = (req.query.sort as string) || "createdAt";
  const sortOrder = (req.query.order as string) === "asc" ? 1 : -1;
  const sort: Record<string, 1 | -1> = { [sortField]: sortOrder };

  return { page, limit, skip, sort };
};

/**
 * Get pagination metadata for response
 * @function getPaginationMeta
 * @description Calculates pagination metadata from page, limit, and total count
 * @param {number} page - Current page number
 * @param {number} limit - Number of items per page
 * @param {number} total - Total number of items
 * @returns {PaginationMeta} Pagination metadata object
 * @example
 * ```typescript
 * const meta = getPaginationMeta(1, 10, 100);
 * // { page: 1, limit: 10, total: 100, pages: 10, hasNext: true, hasPrev: false }
 * ```
 */
export const getPaginationMeta = (
  page: number,
  limit: number,
  total: number
): PaginationMeta => {
  // Calculate total number of pages
  const pages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1,
  };
};

/**
 * Validate pagination parameters
 * @function validatePaginationParams
 * @description Validates pagination parameters and returns sanitized values
 * @param {number} page - Page number to validate
 * @param {number} limit - Limit to validate
 * @returns {{ page: number; limit: number }} Validated pagination parameters
 */
export const validatePaginationParams = (
  page: number,
  limit: number
): { page: number; limit: number } => {
  const validatedPage = Math.max(1, page || PAGINATION.DEFAULT_PAGE);
  const validatedLimit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(PAGINATION.MIN_LIMIT, limit || PAGINATION.DEFAULT_LIMIT)
  );

  return {
    page: validatedPage,
    limit: validatedLimit,
  };
};
