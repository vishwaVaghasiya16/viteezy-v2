import mongoose from "mongoose";
import { logger } from "@/utils/logger";
import { normalizeLanguageCode } from "@/constants/languageConstants";

/**
 * Language Migration Service
 * Handles cleanup and migration of language data when languages are added/removed
 */
class LanguageMigrationService {
  /**
   * Remove a language code from all I18n fields in all collections
   * This is called when a language is deleted from GeneralSettings
   * 
   * @param languageCode - Language code to remove (e.g., "it", "nl")
   * @param options - Migration options
   */
  async removeLanguageFromAllCollections(
    languageCode: string,
    options: {
      dryRun?: boolean; // If true, only report what would be changed
      collections?: string[]; // Specific collections to update, or all if undefined
    } = {}
  ): Promise<{
    affectedCollections: string[];
    totalDocuments: number;
    dryRun: boolean;
  }> {
    const { dryRun = false, collections } = options;
    const normalizedCode = normalizeLanguageCode(languageCode).toLowerCase();
    
    logger.info(`Starting language removal migration for: ${normalizedCode}`, {
      dryRun,
      collections,
    });

    const affectedCollections: string[] = [];
    let totalDocuments = 0;

    // Define all collections that have I18n fields
    const allCollections = collections || [
      "blogs",
      "blog_categories",
      "blog_banner",
      "faqs",
      "faq_categories",
      "about_us",
      "static_pages",
      "team_members",
      "our_team_page",
      "product_categories",
      "coupons",
      "product_ingredients",
      "product_faqs",
      "membership_plans",
      "reviews",
      "pages",
      "campaigns",
      "product_variants",
      "header_banner",
      "general_settings",
    ];

    for (const collectionName of allCollections) {
      try {
        const collection = mongoose.connection.db?.collection(collectionName);
        if (!collection) {
          logger.warn(`Collection ${collectionName} not found, skipping`);
          continue;
        }

        // Build update query to unset the language field from all I18n objects
        // This uses MongoDB's $unset operator with dot notation
        const updateResult = dryRun
          ? await this.dryRunRemoveLanguage(collection, normalizedCode)
          : await this.removeLanguageFromCollection(collection, normalizedCode);

        if (updateResult.modifiedCount > 0 || updateResult.matchedCount > 0) {
          affectedCollections.push(collectionName);
          totalDocuments += updateResult.modifiedCount || updateResult.matchedCount;
          
          logger.info(`Updated ${collectionName}`, {
            matched: updateResult.matchedCount,
            modified: updateResult.modifiedCount,
            dryRun,
          });
        }
      } catch (error: any) {
        logger.error(`Error updating collection ${collectionName}`, {
          error: error.message,
          collection: collectionName,
        });
      }
    }

    logger.info(`Language removal migration completed`, {
      languageCode: normalizedCode,
      affectedCollections: affectedCollections.length,
      totalDocuments,
      dryRun,
    });

    return {
      affectedCollections,
      totalDocuments,
      dryRun,
    };
  }

  /**
   * Remove language from a specific collection
   */
  private async removeLanguageFromCollection(
    collection: mongoose.mongo.Collection,
    languageCode: string
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    // Get all documents that might have this language
    const documents = await collection.find({}).toArray();
    let matchedCount = 0;
    let modifiedCount = 0;

    for (const doc of documents) {
      let modified = false;
      const updateFields: Record<string, any> = {};

      // Recursively find and remove language fields
      this.removeLanguageFromObject(doc, languageCode, "", updateFields);

      if (Object.keys(updateFields).length > 0) {
        matchedCount++;
        await collection.updateOne(
          { _id: doc._id },
          { $unset: updateFields }
        );
        modifiedCount++;
        modified = true;
      }
    }

    return { matchedCount, modifiedCount };
  }

  /**
   * Dry run - only report what would be changed
   */
  private async dryRunRemoveLanguage(
    collection: mongoose.mongo.Collection,
    languageCode: string
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const documents = await collection.find({}).toArray();
    let matchedCount = 0;
    let modifiedCount = 0;

    for (const doc of documents) {
      const updateFields: Record<string, any> = {};
      this.removeLanguageFromObject(doc, languageCode, "", updateFields);

      if (Object.keys(updateFields).length > 0) {
        matchedCount++;
        modifiedCount++;
      }
    }

    return { matchedCount, modifiedCount };
  }

  /**
   * Recursively find I18n objects and build $unset paths
   */
  private removeLanguageFromObject(
    obj: any,
    languageCode: string,
    path: string,
    updateFields: Record<string, any>
  ): void {
    if (!obj || typeof obj !== "object") {
      return;
    }

    // Check if this looks like an I18n object (has language keys)
    const keys = Object.keys(obj);
    const hasLanguageKeys = keys.some(
      (key) => key.length === 2 && /^[a-z]{2}$/.test(key)
    );
    const hasTargetLanguage = languageCode in obj;

    if (hasLanguageKeys && hasTargetLanguage) {
      // This is an I18n object with the target language
      const fieldPath = path ? `${path}.${languageCode}` : languageCode;
      updateFields[fieldPath] = "";
      return;
    }

    // Recursively process nested objects and arrays
    for (const key of keys) {
      const value = obj[key];
      const newPath = path ? `${path}.${key}` : key;

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === "object" && item !== null) {
            this.removeLanguageFromObject(
              item,
              languageCode,
              `${newPath}.${index}`,
              updateFields
            );
          }
        });
      } else if (typeof value === "object" && value !== null) {
        // Skip MongoDB special fields
        if (key === "_id" || key === "__v") {
          continue;
        }
        this.removeLanguageFromObject(value, languageCode, newPath, updateFields);
      }
    }
  }

  /**
   * Get statistics about language usage across collections
   * Useful for understanding impact before deletion
   */
  async getLanguageUsageStats(
    languageCode: string
  ): Promise<{
    languageCode: string;
    collections: Array<{
      name: string;
      documentCount: number;
      fieldsWithLanguage: number;
    }>;
    totalDocuments: number;
  }> {
    const normalizedCode = normalizeLanguageCode(languageCode).toLowerCase();
    const collections: Array<{
      name: string;
      documentCount: number;
      fieldsWithLanguage: number;
    }> = [];

    const allCollections = [
      "blogs",
      "blog_categories",
      "blog_banner",
      "faqs",
      "faq_categories",
      "about_us",
      "static_pages",
      "team_members",
      "our_team_page",
      "product_categories",
      "coupons",
      "product_ingredients",
      "product_faqs",
      "membership_plans",
      "reviews",
      "pages",
      "campaigns",
      "product_variants",
      "header_banner",
      "general_settings",
    ];

    let totalDocuments = 0;

    for (const collectionName of allCollections) {
      try {
        const collection = mongoose.connection.db?.collection(collectionName);
        if (!collection) {
          continue;
        }

        const documents = await collection.find({}).toArray();
        let fieldsWithLanguage = 0;

        for (const doc of documents) {
          const hasLanguage = this.hasLanguageInObject(doc, normalizedCode);
          if (hasLanguage) {
            fieldsWithLanguage++;
          }
        }

        if (fieldsWithLanguage > 0) {
          collections.push({
            name: collectionName,
            documentCount: documents.length,
            fieldsWithLanguage,
          });
          totalDocuments += fieldsWithLanguage;
        }
      } catch (error: any) {
        logger.error(`Error checking collection ${collectionName}`, {
          error: error.message,
        });
      }
    }

    return {
      languageCode: normalizedCode,
      collections,
      totalDocuments,
    };
  }

  /**
   * Check if an object contains the specified language code
   */
  private hasLanguageInObject(obj: any, languageCode: string): boolean {
    if (!obj || typeof obj !== "object") {
      return false;
    }

    // Check if this is an I18n object with the language
    if (languageCode in obj && typeof obj[languageCode] === "string") {
      return true;
    }

    // Recursively check nested objects and arrays
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (this.hasLanguageInObject(item, languageCode)) {
            return true;
          }
        }
      } else if (typeof value === "object" && value !== null) {
        if (this.hasLanguageInObject(value, languageCode)) {
          return true;
        }
      }
    }

    return false;
  }
}

export const languageMigrationService = new LanguageMigrationService();

