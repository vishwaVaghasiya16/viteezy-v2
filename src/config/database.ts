/**
 * @fileoverview Database configuration and connection management
 * @description Handles MongoDB connection, disconnection, and connection event monitoring
 * @module config/database
 */

import mongoose, { ConnectOptions } from "mongoose";
import { logger } from "@/utils/logger";
import { config } from "./index";

/**
 * MongoDB Connection Options
 * @constant {ConnectOptions}
 * @description Configuration options for MongoDB connection
 * - maxPoolSize: Maximum number of socket connections (default: 10)
 * - serverSelectionTimeoutMS: Time to wait for server selection (default: 5000ms)
 * - socketTimeoutMS: Time before closing idle sockets (default: 45000ms)
 */
const MONGODB_OPTIONS: ConnectOptions = {
  maxPoolSize: 10, // Maximum number of socket connections in the connection pool
  serverSelectionTimeoutMS: 5000, // How long to wait for server selection before timing out
  socketTimeoutMS: 45000, // How long to wait for a socket to be established before timing out
  connectTimeoutMS: 10000, // How long to wait for initial connection
};

/**
 * Setup MongoDB connection event handlers
 * @function setupConnectionHandlers
 * @description Registers event listeners for MongoDB connection events
 * @returns {void}
 */
const setupConnectionHandlers = (): void => {
  // Handle connection errors
  mongoose.connection.on("error", (error: Error) => {
    logger.error("MongoDB connection error:", error);
  });

  // Handle disconnection events
  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected - attempting to reconnect...");
  });

  // Handle reconnection events
  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB reconnected successfully");
  });

  // Handle connection open event
  mongoose.connection.on("open", () => {
    logger.info("MongoDB connection opened");
  });

  // Handle connection close event
  mongoose.connection.on("close", () => {
    logger.info("MongoDB connection closed");
  });
};

/**
 * Connect to MongoDB database
 * @async
 * @function connectDatabase
 * @description Establishes connection to MongoDB using configured URI and options
 * @throws {Error} If database connection fails
 * @returns {Promise<void>}
 * @example
 * ```typescript
 * await connectDatabase();
 * ```
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    // Get MongoDB URI from config
    const MONGODB_URI = config.database.mongodbUri;

    // Setup connection event handlers before connecting
    setupConnectionHandlers();

    // Establish connection to MongoDB
    await mongoose.connect(MONGODB_URI, MONGODB_OPTIONS);

    logger.info("✅ Connected to MongoDB successfully");
    logger.info(`📊 Database: ${mongoose.connection.name}`);
    logger.info(
      `🌐 Host: ${mongoose.connection.host}:${mongoose.connection.port}`
    );
  } catch (error) {
    logger.error("❌ Failed to connect to MongoDB:", error);
    throw error;
  }
};

/**
 * Disconnect from MongoDB database
 * @async
 * @function disconnectDatabase
 * @description Closes the MongoDB connection gracefully
 * @throws {Error} If database disconnection fails
 * @returns {Promise<void>}
 * @example
 * ```typescript
 * await disconnectDatabase();
 * ```
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    // Close all connections in the connection pool
    await mongoose.disconnect();
    logger.info("✅ Disconnected from MongoDB successfully");
  } catch (error) {
    logger.error("❌ Error disconnecting from MongoDB:", error);
    throw error;
  }
};

/**
 * Get MongoDB connection status
 * @function getConnectionStatus
 * @description Returns the current state of the MongoDB connection
 * @returns {string} Connection state (connected, disconnected, connecting, etc.)
 */
export const getConnectionStatus = (): string => {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
};

/**
 * Check if database is connected
 * @function isConnected
 * @description Checks if the MongoDB connection is active
 * @returns {boolean} True if connected, false otherwise
 */
export const isConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};
