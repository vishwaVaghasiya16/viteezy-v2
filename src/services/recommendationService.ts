/**
 * @fileoverview AI Recommendation Service
 * @description Service for profile-based AI product recommendations
 * @module services/recommendationService
 */

import { AppError } from "../utils/AppError";
import { commerceContextService } from "./commerceContextService";
import { Products } from "../models/commerce";
import { logger } from "../utils/logger";
import {
  getCachedRecommendations,
  setCachedRecommendations,
  invalidateProfileRecommendations,
} from "../utils/familyCache";
import mongoose from "mongoose";

// ============================================================================
// INTERFACES
// ============================================================================

export interface RecommendationCriteria {
  age?: number;
  gender?: string;
  concerns?: string[];
  preferences?: string[];
  membershipStatus?: string;
}

export interface ProductRecommendation {
  productId: string;
  product: any;
  score: number;
  reason: string;
  category: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface RecommendationResult {
  profileId: string;
  recommendations: ProductRecommendation[];
  criteria: RecommendationCriteria;
  generatedAt: Date;
  totalCount: number;
}

// ============================================================================
// AI RECOMMENDATION SERVICE
// ============================================================================

class RecommendationService {
  /**
   * Get AI recommendations for a specific profile
   * @param profileId - Profile ID to get recommendations for
   * @param options - Optional filtering options
   * @returns Promise<RecommendationResult>
   */
  async getRecommendations(
    profileId: string,
    options: {
      limit?: number;
      categories?: string[];
      includeInactive?: boolean;
    } = {}
  ): Promise<RecommendationResult> {
    const { limit = 10, categories, includeInactive = false } = options;
    
    const context = {
      action: "getRecommendations",
      profileId,
      limit,
      categories,
      includeInactive,
    };

    logger.info("Getting AI recommendations", context);

    try {
      // Try cache first
      const cacheKey = this.generateCacheKey(profileId, options);
      const cachedRecommendations = getCachedRecommendations(cacheKey);
      if (cachedRecommendations) {
        logger.info("Using cached recommendations", context);
        return cachedRecommendations;
      }

      // Get effective profile data
      const effectiveProfile = await commerceContextService.getEffectiveProfile(
        profileId,
        profileId
      );

      // Build recommendation criteria
      const criteria = this.buildRecommendationCriteria(effectiveProfile.profileData);

      // Get product recommendations
      const recommendations = await this.generateRecommendations(criteria, {
        limit,
        categories,
        includeInactive,
      });

      const result: RecommendationResult = {
        profileId,
        recommendations,
        criteria,
        generatedAt: new Date(),
        totalCount: recommendations.length,
      };

      // Cache the result
      setCachedRecommendations(cacheKey, result);

      logger.info("AI recommendations generated successfully", {
        ...context,
        recommendationCount: recommendations.length,
        topScore: recommendations[0]?.score,
      });

      return result;

    } catch (error) {
      logger.error("Failed to get AI recommendations", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get recommendations for commerce context
   * @param selectedBy - User ID doing the shopping
   * @param selectedProfileId - Profile ID being shopped for
   * @param options - Optional filtering options
   * @returns Promise<RecommendationResult>
   */
  async getRecommendationsForContext(
    selectedBy: string,
    selectedProfileId: string,
    options: {
      limit?: number;
      categories?: string[];
      includeInactive?: boolean;
    } = {}
  ): Promise<RecommendationResult> {
    const context = {
      action: "getRecommendationsForContext",
      selectedBy,
      selectedProfileId,
      options,
    };

    logger.info("Getting recommendations for commerce context", context);

    try {
      // Validate commerce context
      const validation = await commerceContextService.validateContext(
        selectedBy,
        selectedProfileId
      );

      if (!validation.allowed) {
        throw new AppError(
          validation.reason || "Invalid commerce context for recommendations",
          403,
          true,
          "INVALID_COMMERCE_CONTEXT"
        );
      }

      // Get recommendations for the selected profile
      return await this.getRecommendations(selectedProfileId, options);

    } catch (error) {
      logger.error("Failed to get recommendations for context", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Invalidate recommendations cache for profile
   * @param profileId - Profile ID to invalidate cache for
   * @returns Promise<void>
   */
  async invalidateRecommendationsCache(profileId: string): Promise<void> {
    try {
      invalidateProfileRecommendations(profileId);
      logger.info("Recommendations cache invalidated", { profileId });
    } catch (error) {
      logger.error("Failed to invalidate recommendations cache", {
        profileId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get personalized product suggestions
   * @param profileId - Profile ID
   * @param productIds - Array of product IDs to check against
   * @returns Promise<ProductRecommendation[]>
   */
  async getProductSuggestions(
    profileId: string,
    productIds: string[]
  ): Promise<ProductRecommendation[]> {
    const context = {
      action: "getProductSuggestions",
      profileId,
      productCount: productIds.length,
    };

    logger.info("Getting product suggestions", context);

    try {
      // Get effective profile data
      const effectiveProfile = await commerceContextService.getEffectiveProfile(
        profileId,
        profileId
      );

      // Build recommendation criteria
      const criteria = this.buildRecommendationCriteria(effectiveProfile.profileData);

      // Get products
      const products = await Products.find({
        _id: { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) },
        isDeleted: false,
      }).lean();

      // Score each product
      const suggestions: ProductRecommendation[] = products.map(product => ({
        productId: product._id.toString(),
        product,
        score: this.calculateProductScore(product, criteria),
        reason: this.generateRecommendationReason(product, criteria),
        category: this.getProductCategory(product),
        priority: this.determinePriority(product, criteria),
      })).sort((a, b) => b.score - a.score);

      logger.info("Product suggestions generated", {
        ...context,
        suggestionCount: suggestions.length,
        topScore: suggestions[0]?.score,
      });

      return suggestions;

    } catch (error) {
      logger.error("Failed to get product suggestions", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Build recommendation criteria from profile data
   */
  private buildRecommendationCriteria(profileData: any): RecommendationCriteria {
    return {
      age: profileData.age,
      gender: profileData.gender,
      concerns: [], // TODO: Extract from user's concern data
      preferences: [], // TODO: Extract from user's preferences
      membershipStatus: profileData.membershipStatus,
    };
  }

  /**
   * Generate AI recommendations based on criteria
   */
  private async generateRecommendations(
    criteria: RecommendationCriteria,
    options: {
      limit?: number;
      categories?: string[];
      includeInactive?: boolean;
    }
  ): Promise<ProductRecommendation[]> {
    const { limit = 10, categories, includeInactive = false } = options;

    // Build product query
    const query: any = {
      isDeleted: false,
    };

    if (categories && categories.length > 0) {
      query.category = { $in: categories };
    }

    if (!includeInactive) {
      query.isActive = true;
    }

    // Get products
    const products = await Products.find(query)
      .limit(limit * 2) // Get more to allow for filtering
      .lean();

    // Score and rank products
    const recommendations: ProductRecommendation[] = products.map(product => ({
      productId: product._id.toString(),
      product,
      score: this.calculateProductScore(product, criteria),
      reason: this.generateRecommendationReason(product, criteria),
      category: this.getProductCategory(product),
      priority: this.determinePriority(product, criteria),
    }))
    .filter(rec => rec.score > 0) // Only include products with positive scores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

    return recommendations;
  }

  /**
   * Calculate product score based on criteria
   */
  private calculateProductScore(product: any, criteria: RecommendationCriteria): number {
    let score = 0;

    // Base score
    score += product.baseScore || 50;

    // Age-based scoring
    if (criteria.age) {
      if (product.targetAgeRange) {
        const [minAge, maxAge] = product.targetAgeRange;
        if (criteria.age >= minAge && criteria.age <= maxAge) {
          score += 20;
        }
      }

      // Age-specific products
      if (product.ageGroup) {
        if (criteria.age < 25 && product.ageGroup === "YOUNG") score += 15;
        if (criteria.age >= 25 && criteria.age < 50 && product.ageGroup === "ADULT") score += 15;
        if (criteria.age >= 50 && product.ageGroup === "SENIOR") score += 15;
      }
    }

    // Gender-based scoring
    if (criteria.gender && product.targetGender) {
      if (product.targetGender === criteria.gender) {
        score += 10;
      } else if (product.targetGender === "UNISEX") {
        score += 5;
      }
    }

    // Category-based scoring
    if (criteria.concerns && product.concerns) {
      const matchingConcerns = criteria.concerns.filter(concern => 
        product.concerns.includes(concern)
      );
      score += matchingConcerns.length * 8;
    }

    // Membership bonus
    if (criteria.membershipStatus === "ACTIVE" && product.memberExclusive) {
      score += 15;
    }

    // Popularity bonus
    if (product.popularityScore) {
      score += product.popularityScore * 0.1;
    }

    // Rating bonus
    if (product.averageRating) {
      score += product.averageRating * 2;
    }

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Generate recommendation reason
   */
  private generateRecommendationReason(product: any, criteria: RecommendationCriteria): string {
    const reasons = [];

    if (criteria.age && product.ageGroup) {
      reasons.push(`Suitable for ${product.ageGroup.toLowerCase()} users`);
    }

    if (criteria.gender && product.targetGender === criteria.gender) {
      reasons.push(`Designed for ${criteria.gender.toLowerCase()} users`);
    }

    if (product.concerns && criteria.concerns) {
      const matchingConcerns = criteria.concerns.filter(concern => 
        product.concerns.includes(concern)
      );
      if (matchingConcerns.length > 0) {
        reasons.push(`Addresses ${matchingConcerns.join(', ')}`);
      }
    }

    if (product.memberExclusive && criteria.membershipStatus === "ACTIVE") {
      reasons.push("Member exclusive product");
    }

    if (product.averageRating && product.averageRating >= 4.5) {
      reasons.push("Highly rated by customers");
    }

    return reasons.length > 0 ? reasons.join('. ') : "Recommended based on your profile";
  }

  /**
   * Determine recommendation priority
   */
  private determinePriority(product: any, criteria: RecommendationCriteria): "HIGH" | "MEDIUM" | "LOW" {
    const score = this.calculateProductScore(product, criteria);
    
    if (score >= 80) return "HIGH";
    if (score >= 60) return "MEDIUM";
    return "LOW";
  }

  /**
   * Generate cache key for recommendations
   */
  private generateCacheKey(profileId: string, options: any): string {
    const optionsStr = JSON.stringify(options || {});
    return `recommendations:${profileId}:${Buffer.from(optionsStr).toString('base64')}`;
  }

  /**
   * Get product category from product data
   */
  private getProductCategory(product: any): string {
    // Try to get category from categories array
    if (product.categories && product.categories.length > 0) {
      return "CATEGORIZED";
    }
    
    // Try to determine from variant type
    if (product.variant === "SACHETS") {
      return "SACHETS";
    }
    
    if (product.variant === "STAND_UP_POUCH") {
      return "STAND_UP_POUCH";
    }
    
    // Default fallback
    return "GENERAL";
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const recommendationService = new RecommendationService();
