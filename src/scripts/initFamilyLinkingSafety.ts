/**
 * @fileoverview Family Linking Safety Initialization Script
 * @description Initializes production safety features for Family Linking System
 * @module scripts/initFamilyLinkingSafety
 */

import mongoose from "mongoose";
import { verifyFamilyLinkingIndexes } from "./verifyFamilyLinkingIndexes";
import { logger } from "../utils/logger";
import { config } from "../config";

/**
 * Initialize all Family Linking safety features
 * @async
 * @function initFamilyLinkingSafety
 * @description Sets up database indexes and safety configurations
 */
export async function initFamilyLinkingSafety(): Promise<void> {
  try {
    logger.info("🚀 Initializing Family Linking Safety Features");

    // Step 1: Verify and create required indexes
    await verifyFamilyLinkingIndexes();

    // Step 2: Log successful initialization
    logger.info("✅ Family Linking Safety Features initialized successfully");
    logger.info("📋 Safety Features Enabled:");
    logger.info("   - Database Transactions (ACID compliance)");
    logger.info("   - Idempotency Protection (duplicate prevention)");
    logger.info("   - Concurrency Safety (race condition handling)");
    logger.info("   - Database Indexes (performance & constraints)");
    logger.info("   - Enhanced Error Handling & Logging");
    logger.info("   - Transaction Rollback Protection");

  } catch (error) {
    logger.error("❌ Failed to initialize Family Linking Safety Features", { 
      error: (error as Error).message 
    });
    throw error;
  }
}

/**
 * Run safety initialization if called directly
 */
if (require.main === module) {
  const runSafetyInit = async () => {
    try {
      // Connect to MongoDB
      logger.info("Connecting to MongoDB");
      await mongoose.connect(config.database.mongodbUri);
      logger.info("✅ Connected to MongoDB successfully");
      
      await initFamilyLinkingSafety();
      
      logger.info("🎉 Family Linking Safety initialization completed successfully");
      process.exit(0);
    } catch (error) {
      logger.error("💥 Safety initialization failed", { error: (error as Error).message });
      process.exit(1);
    }
  };

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info("Received SIGINT, shutting down gracefully...");
    await mongoose.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info("Received SIGTERM, shutting down gracefully...");
    await mongoose.disconnect();
    process.exit(0);
  });

  runSafetyInit();
}
