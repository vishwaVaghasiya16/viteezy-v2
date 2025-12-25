/**
 * @fileoverview Main application entry point for Viteezy Phase 2 API Server
 * @description This file initializes the Express application, configures middleware,
 * sets up routes, and handles server startup and graceful shutdown.
 * @author Viteezy Development Team
 * @version 2.0.0
 */
// Note: Module aliases are handled by:
// - Development: tsconfig-paths/register (via nodemon exec)
// - Production: module-alias/register (via npm start script)
import express, { Application, Request, Response } from "express";
import { IncomingMessage, ServerResponse } from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { createProxyMiddleware, Options } from "http-proxy-middleware";

// Internal imports
import { connectDatabase, disconnectDatabase } from "@/config/database";
import { config } from "@/config";
import { errorHandler } from "@/middleware/errorHandler";
import { notFoundHandler } from "@/middleware/notFoundHandler";
import { responseMiddleware } from "@/middleware/responseMiddleware";
import { localeMiddleware } from "@/middleware/locale";
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
 * Trust Proxy Configuration
 * Only set trust proxy if explicitly configured via environment variable
 * This prevents rate limiter warnings when not behind a proxy
 * Set BEHIND_PROXY=true in .env if running behind nginx, load balancer, etc.
 * In production behind a proxy, set to 1 to trust the first proxy (more secure than true)
 */
if (process.env.BEHIND_PROXY === "true" || process.env.TRUST_PROXY === "true") {
  // Set to 1 to trust only the first proxy (more secure than true)
  // For multiple proxies, set TRUST_PROXY to the number of proxies
  const proxyCount = process.env.TRUST_PROXY
    ? parseInt(process.env.TRUST_PROXY, 10)
    : 1;
  app.set("trust proxy", isNaN(proxyCount) ? 1 : proxyCount);
  console.log(`ℹ️ Trust proxy enabled: ${app.get("trust proxy")}`);
}

/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting the number of requests from a single IP
 * Configured via environment variables with sensible defaults
 * Note: Webhook routes are excluded from rate limiting (registered before this middleware)
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
 * IMPORTANT: Webhook routes must be registered BEFORE JSON parser
 * Stripe webhooks require raw body for signature verification
 */
import { paymentController } from "@/controllers/paymentController";
import { PaymentMethod } from "@/models/enums";

// Register webhook routes with raw body parser (BEFORE JSON parser)
// Add logging middleware to track incoming requests
app.post(
  `${API_VERSION}/payments/webhook/stripe`,
  (req: any, res: any, next: any) => {
    console.log(
      "🔵 [WEBHOOK ROUTE] ========== Stripe Webhook Route Hit =========="
    );
    console.log("🔵 [WEBHOOK ROUTE] Method:", req.method);
    console.log("🔵 [WEBHOOK ROUTE] URL:", req.url);
    console.log("🔵 [WEBHOOK ROUTE] Headers:", {
      "content-type": req.headers["content-type"],
      "stripe-signature": req.headers["stripe-signature"]
        ? "present"
        : "missing",
      "user-agent": req.headers["user-agent"],
    });
    console.log("🔵 [WEBHOOK ROUTE] IP:", req.ip);
    next();
  },
  express.raw({ type: "application/json", limit: BODY_SIZE_LIMIT }),
  (req: any, res: any, next: any) => {
    console.log(
      "🔵 [WEBHOOK ROUTE] Raw body received, length:",
      req.body?.length || 0
    );
    // Store raw body for signature verification
    if (req.body && Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
      // Parse JSON for easier access in controllers
      try {
        req.body = JSON.parse(req.body.toString());
        console.log("🔵 [WEBHOOK ROUTE] Body parsed successfully");
      } catch (e) {
        // If parsing fails, keep raw body
        console.warn("⚠️ [WEBHOOK ROUTE] Body parsing failed:", e);
        req.body = {};
      }
    }
    next();
  },
  paymentController.processStripeWebhook
);

// Mollie webhook route - supports both GET (verification) and POST (notifications)
// Register GET route separately for verification
app.get(
  `${API_VERSION}/payments/webhook/mollie`,
  (req: any, res: any, next: any) => {
    console.log(
      "🔵 [WEBHOOK ROUTE] ========== Mollie Webhook GET (Verification) =========="
    );
    console.log("🔵 [WEBHOOK ROUTE] Method:", req.method);
    console.log("🔵 [WEBHOOK ROUTE] URL:", req.url);
    console.log("🔵 [WEBHOOK ROUTE] Query:", req.query);
    console.log("🔵 [WEBHOOK ROUTE] IP:", req.ip);
    req.body = {}; // No body for GET requests
    next();
  },
  paymentController.processMollieWebhook
);

// Register POST route for actual webhook notifications
app.post(
  `${API_VERSION}/payments/webhook/mollie`,
  (req: any, res: any, next: any) => {
    console.log(
      "🔵 [WEBHOOK ROUTE] ========== Mollie Webhook POST (Notification) =========="
    );
    console.log("🔵 [WEBHOOK ROUTE] Method:", req.method);
    console.log("🔵 [WEBHOOK ROUTE] URL:", req.url);
    console.log("🔵 [WEBHOOK ROUTE] Full URL:", req.originalUrl);
    console.log("🔵 [WEBHOOK ROUTE] Query:", req.query);
    console.log("🔵 [WEBHOOK ROUTE] Headers:", {
      "content-type": req.headers["content-type"],
      "user-agent": req.headers["user-agent"],
    });
    console.log("🔵 [WEBHOOK ROUTE] IP:", req.ip);
    next();
  },
  express.raw({ type: "application/json", limit: BODY_SIZE_LIMIT }),
  (req: any, res: any, next: any) => {
    console.log(
      "🔵 [WEBHOOK ROUTE] Raw body received, length:",
      req.body?.length || 0
    );
    // Store raw body if needed
    if (req.body && Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
      const bodyString = req.body.toString();
      // Only parse if body is not empty
      if (bodyString.trim().length > 0) {
        try {
          req.body = JSON.parse(bodyString);
          console.log("🔵 [WEBHOOK ROUTE] Body parsed successfully");
        } catch (e) {
          console.warn("⚠️ [WEBHOOK ROUTE] Body parsing failed:", e);
          req.body = {};
        }
      } else {
        // Empty body - set to empty object
        console.log(
          "ℹ️ [WEBHOOK ROUTE] Empty body received, setting to empty object"
        );
        req.body = {};
      }
    } else {
      // No body at all
      req.body = {};
    }
    next();
  },
  paymentController.processMollieWebhook
);

/**
 * Body Parsing Middleware
 * Parses incoming request bodies in JSON and URL-encoded formats
 * Limits body size to prevent DoS attacks via large payloads
 */
/**
 * Capture raw request body (needed for other routes that might need it)
 */
const captureRawBody = (req: any, _res: any, buf: Buffer): void => {
  if (buf && buf.length) {
    req.rawBody = Buffer.from(buf);
  }
};

app.use(
  express.json({
    limit: BODY_SIZE_LIMIT,
    verify: captureRawBody,
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: BODY_SIZE_LIMIT,
    verify: captureRawBody,
  })
);

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
 * Locale Detection Middleware
 * Detects language from ?lang= query parameter
 * Must be before routes to set req.locale
 */
app.use(localeMiddleware);

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
 * Webhook Test Endpoint
 * Test if webhook endpoint is accessible
 * @route GET /api/v1/payments/webhook/test
 */
app.get(`${API_VERSION}/payments/webhook/test`, (req, res) => {
  console.log("✅ [WEBHOOK TEST] Test endpoint hit");
  res.status(200).json({
    success: true,
    message: "Webhook endpoint is accessible",
    timestamp: new Date().toISOString(),
    endpoint: `${API_VERSION}/payments/webhook/stripe`,
  });
});

/**
 * Webhook Test POST Endpoint
 * Test POST request to webhook endpoint
 * @route POST /api/v1/payments/webhook/test
 */
app.post(
  `${API_VERSION}/payments/webhook/test`,
  express.raw({ type: "application/json" }),
  (req, res) => {
    console.log("✅ [WEBHOOK TEST] POST test endpoint hit");
    console.log("✅ [WEBHOOK TEST] Body length:", req.body?.length || 0);
    res.status(200).json({
      success: true,
      message: "Webhook POST endpoint is accessible",
      timestamp: new Date().toISOString(),
      bodyLength: req.body?.length || 0,
    });
  }
);

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
 * Python FastAPI Proxy Middleware
 * Proxies specific AI/chat routes to Python FastAPI server (port 8000)
 * These routes are handled by Python FastAPI:
 * - /api/v1/health (Python health check)
 * - /api/v1/sessions (session management)
 * - /api/v1/chat (chat messages)
 * - /api/v1/useridLogin (user login verification)
 * - /api/v1/sessions/* (session operations)
 * - /api/v1/docs (Python FastAPI docs)
 * - /api/v1/redoc (Python FastAPI ReDoc)
 */
const pythonApiProxyOptions: Options<Request, Response> = {
  target: "http://localhost:8000",
  changeOrigin: true,
  pathFilter: (pathname: string, req: IncomingMessage) => {
    // Proxy these specific Python routes
    const pythonRoutes = [
      "/api/v1/health",
      "/api/v1/sessions",
      "/api/v1/chat",
      "/api/v1/useridLogin",
      "/api/v1/docs",
      "/api/v1/redoc",
      "/api/v1/openapi.json",
    ];
    
    // Check exact matches
    if (pythonRoutes.includes(pathname)) {
      return true;
    }
    
    // Check if path starts with /api/v1/sessions/ (for session-specific routes)
    if (pathname.startsWith("/api/v1/sessions/")) {
      return true;
    }
    
    return false;
  },
  onProxyReq: (proxyReq: IncomingMessage, req: IncomingMessage, res: ServerResponse) => {
    const expressReq = req as Request;
    console.log(`[Python Proxy] ${expressReq.method} ${expressReq.url} -> http://localhost:8000${expressReq.url}`);
  },
} as Options<Request, Response>;

const pythonApiProxy = createProxyMiddleware(pythonApiProxyOptions);

// Error handling wrapper for Python proxy
const pythonApiProxyWithErrorHandling = (
  req: Request,
  res: Response,
  next: express.NextFunction
) => {
  pythonApiProxy(req, res, (err: any) => {
    if (err) {
      console.error("Python API Proxy Error:", err.message);
      if (!res.headersSent) {
        res.status(503).json({
          status: "error",
          message: "Python API service is unavailable",
          error_code: "SERVICE_UNAVAILABLE",
        });
      }
    } else {
      next();
    }
  });
};

// Register Python API proxy BEFORE Node.js routes
// This ensures Python routes take precedence
app.use(pythonApiProxyWithErrorHandling);

/**
 * API Routes
 * All API endpoints are prefixed with /api/v1
 * Routes are organized in separate files for better maintainability
 * Node.js routes (auth, users, products, payments, etc.) are handled here
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
    // Use 0.0.0.0 to accept connections from any IP address (public access)
    server = app.listen(PORT, "0.0.0.0", () => {
      logger.info(`🚀 Server running on http://0.0.0.0:${PORT}`);
      logger.info(`📊 Environment: ${NODE_ENV}`);
      logger.info(
        `📚 API Documentation: http://0.0.0.0:${PORT}${API_DOCS_PATH}`
      );
      logger.info(
        `=> Health Check: http://0.0.0.0:${PORT}${HEALTH_CHECK_PATH}`
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
