/**
 * @fileoverview Main application entry point for Viteezy Phase 2 API Server
 * @description This file initializes the Express application, configures middleware,
 * sets up routes, and handles server startup and graceful shutdown.
 * @author Viteezy Development Team
 * @version 2.0.0
 */

import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";

// Internal imports
import { connectDatabase, disconnectDatabase } from "@/config/database";
import { config } from "@/config";
import { errorHandler } from "@/middleware/errorHandler";
import { notFoundHandler } from "@/middleware/notFoundHandler";
import { responseMiddleware } from "@/middleware/responseMiddleware";
import { logger } from "@/utils/logger";
import apiRoutes from "@/routes";
import { swaggerSpec } from "@/docs/swagger";

// Load environment variables from .env file
dotenv.config();

/**
 * Application Constants
 * @constant {number} BODY_SIZE_LIMIT - Maximum size for request body (10MB)
 * @constant {string} API_VERSION - API version prefix for routes
 * @constant {string} HEALTH_CHECK_PATH - Health check endpoint path
 * @constant {string} API_DOCS_PATH - Swagger documentation endpoint path
 */
const BODY_SIZE_LIMIT = "10mb";
const API_VERSION = "/api/v1";
const HEALTH_CHECK_PATH = "/health";
const API_DOCS_PATH = "/api-docs";

/**
 * Create Express application instance
 * @type {Application}
 */
const app: Application = express();

/**
 * Server Configuration
 * Uses centralized config from @/config for consistency
 */
const PORT: number = config.server.port;
const HOST: string = config.server.host;
const NODE_ENV: string = config.server.nodeEnv;

/**
 * ============================================================================
 * MIDDLEWARE CONFIGURATION
 * ============================================================================
 * Middleware order is critical for proper request handling
 * Order: Security → CORS → Rate Limiting → Body Parsing → Compression → Logging → Response Helpers
 */

/**
 * Security Middleware
 * Helmet helps secure Express apps by setting various HTTP headers
 * Protects against common vulnerabilities like XSS, clickjacking, etc.
 */
app.use(helmet());

/**
 * CORS (Cross-Origin Resource Sharing) Configuration
 * Allows requests from configured origins with credentials support
 */
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true, // Allow cookies and authentication headers
  })
);

/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting the number of requests from a single IP
 * Configured via environment variables with sensible defaults
 */
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // Time window in milliseconds (15 minutes default)
  max: config.rateLimit.maxRequests, // Maximum requests per window per IP
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});
app.use(limiter);

/**
 * Body Parsing Middleware
 * Parses incoming request bodies in JSON and URL-encoded formats
 * Limits body size to prevent DoS attacks via large payloads
 */
app.use(express.json({ limit: BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));

/**
 * Compression Middleware
 * Compresses response bodies for all requests that traverse through the middleware
 * Reduces bandwidth usage and improves response times
 */
app.use(compression());

/**
 * HTTP Request Logging Middleware
 * Logs HTTP requests using morgan with winston logger integration
 * Uses 'combined' format which includes more detailed information
 */
app.use(
  morgan("combined", {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  })
);

/**
 * Response Middleware
 * Adds custom response helper methods (apiSuccess, apiError, etc.)
 * Must be registered before routes to be available in route handlers
 */
app.use(responseMiddleware);

/**
 * ============================================================================
 * ROUTE CONFIGURATION
 * ============================================================================
 */

/**
 * Health Check Endpoint
 * Returns server status, uptime, and environment information
 * Useful for monitoring and load balancer health checks
 * @route GET /health
 */
app.get(HEALTH_CHECK_PATH, (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
  });
});

/**
 * API Documentation (Swagger UI)
 * Serves interactive API documentation at /api-docs
 * Allows developers to test API endpoints directly from the browser
 */
app.use(
  API_DOCS_PATH,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true, // Enable API explorer
    customCss: ".swagger-ui .topbar { display: none }", // Hide Swagger topbar
    customSiteTitle: "Viteezy Phase 2 API Documentation",
  })
);

/**
 * API Routes
 * All API endpoints are prefixed with /api/v1
 * Routes are organized in separate files for better maintainability
 */
app.use(API_VERSION, apiRoutes);

/**
 * ============================================================================
 * ERROR HANDLING MIDDLEWARE
 * ============================================================================
 * Error handlers must be registered after all routes
 * Order: 404 Handler → Global Error Handler
 */

/**
 * 404 Not Found Handler
 * Catches all requests that don't match any route
 * Must be registered before the global error handler
 */
app.use(notFoundHandler);

/**
 * Global Error Handler
 * Handles all errors thrown in the application
 * Provides consistent error response format
 * Must be the last middleware
 */
app.use(errorHandler);

/**
 * ============================================================================
 * SERVER STARTUP AND SHUTDOWN
 * ============================================================================
 */

/**
 * Server instance reference for graceful shutdown
 * @type {import('http').Server | null}
 */
let server: ReturnType<typeof app.listen> | null = null;

/**
 * Start the server and initialize database connection
 * @async
 * @function startServer
 * @throws {Error} If database connection or server startup fails
 */
const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB database
    await connectDatabase();

    // Start HTTP server and listen on configured port and host
    server = app.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running on http://${HOST}:${PORT}`);
      logger.info(`📊 Environment: ${NODE_ENV}`);
      logger.info(
        `📚 API Documentation: http://${HOST}:${PORT}${API_DOCS_PATH}`
      );
      logger.info(
        `❤️  Health Check: http://${HOST}:${PORT}${HEALTH_CHECK_PATH}`
      );
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

/**
 * Graceful Shutdown Handler
 * Closes server and database connections gracefully
 * @async
 * @function gracefulShutdown
 * @param {string} signal - Process signal received (SIGTERM, SIGINT)
 */
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received, shutting down gracefully...`);

  // Close HTTP server and stop accepting new requests
  if (server) {
    server.close(async () => {
      logger.info("HTTP server closed");

      // Close database connection
      try {
        await disconnectDatabase();
        logger.info("Database connection closed");
        process.exit(0);
      } catch (error) {
        logger.error("Error during database disconnection:", error);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

/**
 * ============================================================================
 * PROCESS EVENT HANDLERS
 * ============================================================================
 * Handle uncaught exceptions and unhandled promise rejections
 * These handlers prevent the server from crashing silently
 */

/**
 * Uncaught Exception Handler
 * Catches synchronous errors that are not handled anywhere
 * Logs error and exits process to prevent undefined state
 */
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

/**
 * Unhandled Promise Rejection Handler
 * Catches async errors in promises that are not handled
 * Logs error and exits process to prevent memory leaks
 */
process.on(
  "unhandledRejection",
  (reason: unknown, promise: Promise<unknown>) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
  }
);

/**
 * SIGTERM Signal Handler
 * Handles termination signal from process manager (e.g., PM2, Docker)
 * Initiates graceful shutdown
 */
process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM");
});

/**
 * SIGINT Signal Handler
 * Handles interrupt signal (Ctrl+C)
 * Initiates graceful shutdown
 */
process.on("SIGINT", () => {
  gracefulShutdown("SIGINT");
});

/**
 * Start the application
 * Initializes server and begins listening for requests
 */
startServer();
