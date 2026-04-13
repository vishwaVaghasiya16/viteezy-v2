/**
 * @fileoverview Database Index Verification Script
 * @description Verifies and creates required indexes for Family Linking System
 * @module scripts/verifyFamilyLinkingIndexes
 */

import mongoose from "mongoose";
import { User } from "../models/core";
import { FamilyMapping } from "../models/core/familyMapping.model";
import { logger } from "../utils/logger";
import { config } from "../config";

/**
 * Verify and create required indexes for Family Linking System
 * @async
 * @function verifyFamilyLinkingIndexes
 * @description Ensures all required indexes exist for production safety
 */
export async function verifyFamilyLinkingIndexes(): Promise<void> {
  try {
    logger.info("Starting Family Linking index verification");

    // 1. Verify User collection indexes
    const userIndexes = await User.collection.getIndexes();
    logger.info("Current User collection indexes:", Object.keys(userIndexes));

    // Check if memberId unique sparse index exists
    if (!userIndexes.memberId_1) {
      logger.warn("memberId unique sparse index not found, creating...");
      await User.collection.createIndex(
        { memberId: 1 }, 
        { 
          unique: true, 
          sparse: true,
          name: "memberId_1"
        }
      );
      logger.info("memberId unique sparse index created successfully");
    } else {
      logger.info("✅ memberId unique sparse index exists");
    }

    // Check if parentMemberId index exists
    if (!userIndexes.parentMemberId_1) {
      logger.warn("parentMemberId index not found, creating...");
      await User.collection.createIndex(
        { parentMemberId: 1 }, 
        { 
          name: "parentMemberId_1"
        }
      );
      logger.info("parentMemberId index created successfully");
    } else {
      logger.info("✅ parentMemberId index exists");
    }

    // 2. Verify FamilyMapping collection indexes
    const familyMappingIndexes = await FamilyMapping.collection.getIndexes();
    logger.info("Current FamilyMapping collection indexes:", Object.keys(familyMappingIndexes));

    // Check if mainMemberId index exists
    if (!familyMappingIndexes.mainMemberId_1) {
      logger.warn("mainMemberId index not found, creating...");
      await FamilyMapping.collection.createIndex(
        { mainMemberId: 1 }, 
        { 
          name: "mainMemberId_1"
        }
      );
      logger.info("mainMemberId index created successfully");
    } else {
      logger.info("✅ mainMemberId index exists");
    }

    // Check if subMemberId unique index exists
    if (!familyMappingIndexes.subMemberId_1) {
      logger.warn("subMemberId unique index not found, creating...");
      await FamilyMapping.collection.createIndex(
        { subMemberId: 1 }, 
        { 
          unique: true,
          name: "subMemberId_1"
        }
      );
      logger.info("subMemberId unique index created successfully");
    } else {
      logger.info("✅ subMemberId unique index exists");
    }

    // Check if composite (mainMemberId, subMemberId) index exists
    if (!familyMappingIndexes.mainMemberId_1_subMemberId_1) {
      logger.warn("Composite (mainMemberId, subMemberId) index not found, creating...");
      await FamilyMapping.collection.createIndex(
        { mainMemberId: 1, subMemberId: 1 }, 
        { 
          name: "mainMemberId_1_subMemberId_1"
        }
      );
      logger.info("Composite (mainMemberId, subMemberId) index created successfully");
    } else {
      logger.info("✅ Composite (mainMemberId, subMemberId) index exists");
    }

    logger.info("✅ All Family Linking indexes verified successfully");

  } catch (error) {
    logger.error("Failed to verify Family Linking indexes", { error: (error as Error).message });
    throw error;
  }
}

/**
 * Run index verification if called directly
 */
if (require.main === module) {
  const runIndexVerification = async () => {
    try {
      // Connect to MongoDB (assuming connection string is in environment)
      await mongoose.connect(config.database.mongodbUri);
      
      await verifyFamilyLinkingIndexes();
      
      logger.info("Index verification completed successfully");
      process.exit(0);
    } catch (error) {
      logger.error("Index verification failed", { error: (error as Error).message });
      process.exit(1);
    }
  };

  runIndexVerification();
}
