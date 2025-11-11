/**
 * @fileoverview Application Types and Interfaces
 * @description TypeScript interfaces and types for the application
 * @module types
 */

import { Request } from "express";
import { Document } from "mongoose";

// Re-export API types
export * from "./api";

/**
 * User Interface
 * @interface IUser
 * @extends Document
 * @description User document interface for MongoDB
 */
export interface IUser extends Document {
  /** User ID */
  _id: string;
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
  /** Hashed password */
  password: string;
  /** User role */
  role: "user" | "admin" | "moderator";
  /** Whether the user account is active */
  isActive: boolean;
  /** Whether the user's email is verified */
  isEmailVerified: boolean;
  /** User's avatar URL */
  avatar?: string;
  /** Last login timestamp */
  lastLogin?: Date;
  /** Document creation timestamp */
  createdAt: Date;
  /** Document update timestamp */
  updatedAt: Date;
}

/**
 * JWT Payload Interface
 * @interface JWTPayload
 * @description Payload structure for JWT tokens
 */
export interface JWTPayload {
  /** User ID */
  userId: string;
  /** User email */
  email: string;
  /** User role */
  role: string;
  /** Token issued at timestamp */
  iat?: number;
  /** Token expiration timestamp */
  exp?: number;
}

/**
 * Authenticated Request Interface
 * @interface AuthenticatedRequest
 * @extends Request
 * @description Extended Express Request with authenticated user data
 */
export interface AuthenticatedRequest extends Request {
  /** Authenticated user object */
  user?: IUser;
  /** User ID from authentication token */
  userId?: string;
}

/**
 * Pagination Query Interface
 * @interface PaginationQuery
 * @description Query parameters for pagination
 */
export interface PaginationQuery {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  limit?: number;
  /** Field to sort by */
  sort?: string;
  /** Sort order (ascending or descending) */
  order?: "asc" | "desc";
}

/**
 * Search Query Interface
 * @interface SearchQuery
 * @extends PaginationQuery
 * @description Query parameters for search with pagination
 */
export interface SearchQuery extends PaginationQuery {
  /** Search query string */
  search?: string;
  /** Filter options */
  filter?: Record<string, any>;
}

/**
 * Application Error Interface
 * @interface AppError
 * @extends Error
 * @description Extended Error interface with status code and operational flag
 */
export interface AppError extends Error {
  /** HTTP status code */
  statusCode: number;
  /** Whether the error is operational (expected) */
  isOperational: boolean;
}
