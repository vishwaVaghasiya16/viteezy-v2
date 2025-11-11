/**
 * @fileoverview Logger configuration and setup
 * @description Winston logger configuration with file and console transports
 * @module utils/logger
 */

import winston from "winston";
import path from "path";
import fs from "fs";
import { config } from "@/config";

/**
 * Log file size limit (5MB)
 * @constant {number} MAX_LOG_FILE_SIZE
 */
const MAX_LOG_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Maximum number of log files to keep
 * @constant {number} MAX_LOG_FILES
 */
const MAX_LOG_FILES = 5;

/**
 * Logs directory path
 * @constant {string} LOGS_DIR
 */
const LOGS_DIR = path.join(process.cwd(), "logs");

/**
 * Create logs directory if it doesn't exist
 * @function ensureLogsDirectory
 * @description Creates the logs directory if it doesn't exist
 * @returns {void}
 */
const ensureLogsDirectory = (): void => {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
};

/**
 * Log format for file transports
 * @constant {winston.Logform.Format} logFormat
 * @description JSON format with timestamp and error stack traces
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Console format for development
 * @constant {winston.Logform.Format} consoleFormat
 * @description Colorized console output with timestamp and metadata
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : "";
    return `${timestamp} [${level}]: ${message} ${metaString}`;
  })
);

/**
 * Winston logger instance
 * @constant {winston.Logger} logger
 * @description Configured logger with file and console transports
 */
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: {
    service: "viteezy-phase-2",
    environment: config.server.nodeEnv,
  },
  transports: [
    // Error log file - only logs errors
    new winston.transports.File({
      filename: path.join(LOGS_DIR, "error.log"),
      level: "error",
      maxsize: MAX_LOG_FILE_SIZE,
      maxFiles: MAX_LOG_FILES,
      handleExceptions: true,
      handleRejections: true,
    }),
    // Combined log file - logs all levels
    new winston.transports.File({
      filename: path.join(LOGS_DIR, "combined.log"),
      maxsize: MAX_LOG_FILE_SIZE,
      maxFiles: MAX_LOG_FILES,
    }),
  ],
  // Exit on error
  exitOnError: false,
});

// Ensure logs directory exists
ensureLogsDirectory();

// Add console transport in non-production environments
if (config.server.nodeEnv !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true,
    })
  );
}

/**
 * Stream interface for Morgan HTTP logger
 * @constant {object} stream
 * @description Allows Winston to be used as Morgan's stream
 */
export const stream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};
