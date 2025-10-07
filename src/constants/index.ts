// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// User Roles
export const USER_ROLES = {
  USER: "user",
  ADMIN: "admin",
  MODERATOR: "moderator",
} as const;

// API Response Messages
export const MESSAGES = {
  SUCCESS: {
    USER_REGISTERED: "User registered successfully",
    USER_LOGGED_IN: "Login successful",
    USER_LOGGED_OUT: "Logout successful",
    PROFILE_UPDATED: "Profile updated successfully",
    TOKEN_REFRESHED: "Token refreshed successfully",
    DATA_RETRIEVED: "Data retrieved successfully",
  },
  ERROR: {
    INVALID_CREDENTIALS: "Invalid email or password",
    USER_NOT_FOUND: "User not found",
    USER_ALREADY_EXISTS: "User with this email already exists",
    INVALID_TOKEN: "Invalid token",
    TOKEN_EXPIRED: "Token expired",
    INSUFFICIENT_PERMISSIONS: "Insufficient permissions",
    ACCOUNT_DEACTIVATED: "Account is deactivated",
    VALIDATION_FAILED: "Validation failed",
    INTERNAL_SERVER_ERROR: "Internal Server Error",
    ROUTE_NOT_FOUND: "Route not found",
  },
} as const;

// Validation Rules
export const VALIDATION = {
  PASSWORD: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 128,
    PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
  },
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50,
  },
  EMAIL: {
    PATTERN: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
  },
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  UPLOAD_PATH: "uploads/",
} as const;

// Rate Limiting
export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
} as const;
