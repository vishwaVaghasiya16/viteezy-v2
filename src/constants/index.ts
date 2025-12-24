/**
 * @fileoverview Application constants and configuration values
 * @description Centralized constants for HTTP status codes, user roles, messages, validation rules, etc.
 * @module constants
 */

/**
 * HTTP Status Codes
 * @constant {object} HTTP_STATUS
 * @description Standard HTTP status codes used throughout the application
 */
export const HTTP_STATUS = {
  /** 200 OK - Request succeeded */
  OK: 200,
  /** 201 Created - Resource created successfully */
  CREATED: 201,
  /** 204 No Content - Request succeeded but no content to return */
  NO_CONTENT: 204,
  /** 400 Bad Request - Invalid request syntax */
  BAD_REQUEST: 400,
  /** 401 Unauthorized - Authentication required */
  UNAUTHORIZED: 401,
  /** 403 Forbidden - You are not authorized to perform this action. */
  FORBIDDEN: 403,
  /** 404 Not Found - Resource not found */
  NOT_FOUND: 404,
  /** 409 Conflict - Resource conflict (e.g., duplicate entry) */
  CONFLICT: 409,
  /** 422 Unprocessable Entity - Validation error */
  UNPROCESSABLE_ENTITY: 422,
  /** 500 Internal Server Error - Server error */
  INTERNAL_SERVER_ERROR: 500,
  /** 503 Service Unavailable - Service temporarily unavailable */
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * User Roles
 * @constant {object} USER_ROLES
 * @description Available user roles in the system
 */
export const USER_ROLES = {
  /** Standard user role */
  USER: "user",
  /** Administrator role with full access */
  ADMIN: "admin",
  /** Moderator role with limited administrative access */
  MODERATOR: "moderator",
} as const;

/**
 * API Response Messages
 * @constant {object} MESSAGES
 * @description Standardized success and error messages for API responses
 */
export const MESSAGES = {
  /** Success messages */
  SUCCESS: {
    USER_REGISTERED: "User registered successfully",
    USER_LOGGED_IN: "Login successful",
    USER_LOGGED_OUT: "Logout successful",
    PROFILE_UPDATED: "Profile updated successfully",
    TOKEN_REFRESHED: "Token refreshed successfully",
    DATA_RETRIEVED: "Data retrieved successfully",
    PASSWORD_RESET: "Password reset successful",
    EMAIL_VERIFIED: "Email verified successfully",
    RESOURCE_CREATED: "Resource created successfully",
    RESOURCE_UPDATED: "Resource updated successfully",
    RESOURCE_DELETED: "Resource deleted successfully",
  },
  /** Error messages */
  ERROR: {
    INVALID_CREDENTIALS: "Invalid email or password",
    USER_NOT_FOUND: "User not found",
    USER_ALREADY_EXISTS: "User with this email already exists",
    INVALID_TOKEN: "Invalid token",
    TOKEN_EXPIRED: "Token expired",
    INSUFFICIENT_PERMISSIONS: "You are not authorized to perform this action.",
    ACCOUNT_DEACTIVATED: "Account is deactivated",
    VALIDATION_FAILED: "Validation failed",
    INTERNAL_SERVER_ERROR: "Internal Server Error",
    ROUTE_NOT_FOUND: "Route not found",
    UNAUTHORIZED_ACCESS: "Unauthorized access",
    RESOURCE_NOT_FOUND: "Resource not found",
    DUPLICATE_ENTRY: "Duplicate entry",
    INVALID_INPUT: "Invalid input",
  },
} as const;

/**
 * Validation Rules
 * @constant {object} VALIDATION
 * @description Validation rules for form inputs and data validation
 */
export const VALIDATION = {
  /** Password validation rules */
  PASSWORD: {
    /** Minimum password length */
    MIN_LENGTH: 6,
    /** Maximum password length */
    MAX_LENGTH: 128,
    /** Password pattern: must contain at least one lowercase, one uppercase, and one digit */
    PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
  },
  /** First name validation rules */
  FIRST_NAME: {
    /** Minimum first name length */
    MIN_LENGTH: 1,
    /** Maximum first name length */
    MAX_LENGTH: 50,
  },
  /** Last name validation rules */
  LAST_NAME: {
    /** Minimum last name length */
    MIN_LENGTH: 1,
    /** Maximum last name length */
    MAX_LENGTH: 50,
  },
  /** Email validation rules */
  EMAIL: {
    /** Email pattern: standard email format validation */
    PATTERN: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
  },
  /** Phone number validation rules */
  PHONE: {
    /** Minimum phone number length */
    MIN_LENGTH: 10,
    /** Maximum phone number length */
    MAX_LENGTH: 15,
    /** Phone number pattern: digits, spaces, dashes, and parentheses */
    PATTERN: /^[\d\s\-()]+$/,
  },
} as const;

/**
 * Pagination Configuration
 * @constant {object} PAGINATION
 * @description Default pagination settings for list endpoints
 */
export const PAGINATION = {
  /** Default page number (starts from 1) */
  DEFAULT_PAGE: 1,
  /** Default number of items per page */
  DEFAULT_LIMIT: 10,
  /** Maximum number of items per page */
  MAX_LIMIT: 100,
  /** Minimum number of items per page */
  MIN_LIMIT: 1,
} as const;

/**
 * File Upload Configuration
 * @constant {object} FILE_UPLOAD
 * @description File upload constraints and settings
 */
export const FILE_UPLOAD = {
  /** Maximum file size in bytes (5MB) */
  MAX_SIZE: 5 * 1024 * 1024,
  /** Allowed MIME types for image uploads */
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  /** Default upload directory path */
  UPLOAD_PATH: "uploads/",
  /** Maximum number of files per upload */
  MAX_FILES: 10,
} as const;

/**
 * Rate Limiting Configuration
 * @constant {object} RATE_LIMIT
 * @description Rate limiting settings for API endpoints
 */
export const RATE_LIMIT = {
  /** Time window in milliseconds (15 minutes) */
  WINDOW_MS: 15 * 60 * 1000,
  /** Maximum number of requests per window per IP */
  MAX_REQUESTS: 100,
  /** Rate limit message */
  MESSAGE: "Too many requests from this IP, please try again later.",
} as const;

/**
 * JWT Token Configuration
 * @constant {object} JWT
 * @description JWT token settings
 */
export const JWT = {
  /** Default token expiration time (7 days) */
  DEFAULT_EXPIRES_IN: "7d",
  /** Refresh token expiration time (30 days) */
  REFRESH_EXPIRES_IN: "30d",
  /** Token algorithm */
  ALGORITHM: "HS256",
} as const;

/**
 * Date and Time Constants
 * @constant {object} DATE_TIME
 * @description Date and time related constants
 */
export const DATE_TIME = {
  /** Milliseconds in a second */
  SECOND_MS: 1000,
  /** Milliseconds in a minute */
  MINUTE_MS: 60 * 1000,
  /** Milliseconds in an hour */
  HOUR_MS: 60 * 60 * 1000,
  /** Milliseconds in a day */
  DAY_MS: 24 * 60 * 60 * 1000,
  /** Date format for display */
  DATE_FORMAT: "YYYY-MM-DD",
  /** DateTime format for display */
  DATETIME_FORMAT: "YYYY-MM-DD HH:mm:ss",
} as const;
