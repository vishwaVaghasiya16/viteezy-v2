/**
 * @fileoverview Application configuration management
 * @description Centralized configuration for the entire application
 * Loads environment variables and provides type-safe configuration object
 * @module config
 */

import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration Constants
 * @constant {object} DEFAULT_VALUES - Default configuration values
 */
const DEFAULT_VALUES = {
  PORT: 3000,
  HOST: "localhost",
  NODE_ENV: "development",
  MONGODB_URI: "mongodb://localhost:27017/viteezy-phase-2",
  MONGODB_TEST_URI: "mongodb://localhost:27017/viteezy-phase-2-test",
  JWT_SECRET: "your-super-secret-jwt-key-here",
  JWT_EXPIRE: "7d",
  JWT_REFRESH_SECRET: "your-refresh-secret-key-here",
  JWT_REFRESH_EXPIRE: "30d",
  EMAIL_HOST: "smtp.gmail.com",
  EMAIL_PORT: 587,
  MAX_FILE_SIZE: 5242880, // 5MB in bytes
  UPLOAD_PATH: "uploads/",
  RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes in milliseconds
  RATE_LIMIT_MAX_REQUESTS: 100,
  CORS_ORIGIN: "http://localhost:3000",
  LOG_LEVEL: "info",
  LOG_FILE: "logs/app.log",
  DO_SPACES_ENDPOINT: "",
  DO_SPACES_REGION: "ams3",
  DO_SPACES_BUCKET: "",
  DO_SPACES_ACCESS_KEY: "",
  DO_SPACES_SECRET_KEY: "",
  DO_SPACES_CDN_BASE_URL: "",
  POSTNL_URL: "https://api.postnl.nl/address/national/v1/validate",
  POSTNL_TIMEOUT_MS: 5000,
} as const;

/**
 * Application Configuration Object
 * @constant {object} config
 * @description Centralized configuration for server, database, JWT, email, etc.
 * All configuration values are loaded from environment variables with fallback defaults
 */
export const config = {
  /**
   * Server Configuration
   * @property {number} port - Server port number
   * @property {string} host - Server host address
   * @property {string} nodeEnv - Node.js environment (development, production, test)
   */
  server: {
    port: parseInt(process.env.PORT || String(DEFAULT_VALUES.PORT), 10),
    host: process.env.HOST || DEFAULT_VALUES.HOST,
    nodeEnv: process.env.NODE_ENV || DEFAULT_VALUES.NODE_ENV,
  },

  /**
   * Database Configuration
   * @property {string} mongodbUri - MongoDB connection URI for production
   * @property {string} mongodbTestUri - MongoDB connection URI for testing
   */
  database: {
    mongodbUri: process.env.MONGODB_URI || DEFAULT_VALUES.MONGODB_URI,
    mongodbTestUri:
      process.env.MONGODB_TEST_URI || DEFAULT_VALUES.MONGODB_TEST_URI,
  },

  /**
   * JWT (JSON Web Token) Configuration
   * @property {string} secret - Secret key for signing JWT tokens
   * @property {string} expiresIn - Token expiration time (e.g., "7d" for 7 days)
   * @property {string} refreshSecret - Secret key for signing refresh tokens
   * @property {string} refreshExpiresIn - Refresh token expiration time
   */
  jwt: {
    secret: process.env.JWT_SECRET || DEFAULT_VALUES.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRE || DEFAULT_VALUES.JWT_EXPIRE,
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || DEFAULT_VALUES.JWT_REFRESH_SECRET,
    refreshExpiresIn:
      process.env.JWT_REFRESH_EXPIRE || DEFAULT_VALUES.JWT_REFRESH_EXPIRE,
  },

  /**
   * Email Configuration
   * @property {string} host - SMTP server host
   * @property {number} port - SMTP server port
   * @property {string} user - SMTP username/email
   * @property {string} pass - SMTP password
   */
  email: {
    host: process.env.EMAIL_HOST || DEFAULT_VALUES.EMAIL_HOST,
    port: parseInt(
      process.env.EMAIL_PORT || String(DEFAULT_VALUES.EMAIL_PORT),
      10
    ),
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASS || "",
  },

  /**
   * File Upload Configuration
   * @property {number} maxFileSize - Maximum file size in bytes (default: 5MB)
   * @property {string} uploadPath - Directory path for uploaded files
   */
  upload: {
    maxFileSize: parseInt(
      process.env.MAX_FILE_SIZE || String(DEFAULT_VALUES.MAX_FILE_SIZE),
      10
    ),
    uploadPath: process.env.UPLOAD_PATH || DEFAULT_VALUES.UPLOAD_PATH,
  },

  /**
   * Rate Limiting Configuration
   * @property {number} windowMs - Time window in milliseconds (default: 15 minutes)
   * @property {number} maxRequests - Maximum number of requests per window per IP
   */
  rateLimit: {
    windowMs: parseInt(
      process.env.RATE_LIMIT_WINDOW_MS ||
        String(DEFAULT_VALUES.RATE_LIMIT_WINDOW_MS),
      10
    ),
    maxRequests: parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS ||
        String(DEFAULT_VALUES.RATE_LIMIT_MAX_REQUESTS),
      10
    ),
  },

  /**
   * CORS (Cross-Origin Resource Sharing) Configuration
   * @property {string} origin - Allowed origin for CORS requests
   */
  cors: {
    origin: process.env.CORS_ORIGIN || DEFAULT_VALUES.CORS_ORIGIN,
  },

  /**
   * Logging Configuration
   * @property {string} level - Log level (error, warn, info, debug)
   * @property {string} file - Log file path
   */
  logging: {
    level: process.env.LOG_LEVEL || DEFAULT_VALUES.LOG_LEVEL,
    file: process.env.LOG_FILE || DEFAULT_VALUES.LOG_FILE,
  },

  /**
   * DigitalOcean Spaces / S3 compatible storage configuration
   */
  spaces: {
    endpoint:
      process.env.DO_SPACES_ENDPOINT ||
      process.env.DIGITALOCEAN_CALLBACK_URL ||
      DEFAULT_VALUES.DO_SPACES_ENDPOINT,
    region:
      process.env.DO_SPACES_REGION ||
      process.env.DIGITALOCEAN_RESION ||
      DEFAULT_VALUES.DO_SPACES_REGION,
    bucket:
      process.env.DO_SPACES_BUCKET ||
      process.env.DIGITALOCEAN_BUCKET_NAME ||
      DEFAULT_VALUES.DO_SPACES_BUCKET,
    accessKeyId:
      process.env.DO_SPACES_ACCESS_KEY ||
      process.env.DIGITALOCEAN_ACCESS_KEY ||
      DEFAULT_VALUES.DO_SPACES_ACCESS_KEY,
    secretAccessKey:
      process.env.DO_SPACES_SECRET_KEY ||
      process.env.DIGITALOCEAN_CLIENT_SECRET ||
      DEFAULT_VALUES.DO_SPACES_SECRET_KEY,
    cdnBaseUrl:
      process.env.DO_SPACES_CDN_BASE_URL ||
      DEFAULT_VALUES.DO_SPACES_CDN_BASE_URL,
  },
  postnl: {
    addressValidationUrl: process.env.POSTNL_URL || DEFAULT_VALUES.POSTNL_URL,
    apiKey: process.env.POSTNL_API_KEY || "",
    shipmentApiKey: process.env.POSTNL_SHIPMENT_API_KEY || "",
    timeoutMs: parseInt(
      process.env.POSTNL_TIMEOUT_MS || String(DEFAULT_VALUES.POSTNL_TIMEOUT_MS),
      10
    ),
  },
} as const;

/**
 * Check if application is in production mode
 * @function isProduction
 * @returns {boolean} True if NODE_ENV is 'production'
 */
export const isProduction = (): boolean => {
  return config.server.nodeEnv === "production";
};

/**
 * Check if application is in development mode
 * @function isDevelopment
 * @returns {boolean} True if NODE_ENV is 'development'
 */
export const isDevelopment = (): boolean => {
  return config.server.nodeEnv === "development";
};

/**
 * Check if application is in test mode
 * @function isTest
 * @returns {boolean} True if NODE_ENV is 'test'
 */
export const isTest = (): boolean => {
  return config.server.nodeEnv === "test";
};
