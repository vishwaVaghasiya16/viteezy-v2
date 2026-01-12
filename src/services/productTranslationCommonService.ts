/**
 * Common Product Translation Service
 * Reusable service for translating products across all APIs
 * Handles language detection from user token/profile and Google Translate integration
 */

import { translateProduct, translateProducts } from "./productTranslationService";
import { transformProductForLanguage } from "./productEnrichmentService";
import { SupportedLanguage, DEFAULT_LANGUAGE } from "../models/common.model";
import { logger } from "../utils/logger";

interface AuthenticatedRequest {
  user?: {
    language?: string;
    _id?: string;
    id?: string;
  };
  userId?: string;
}

/**
 * Map user language name to language code
 */
const mapLanguageToCode = (language?: string): SupportedLanguage => {
  const languageMap: Record<string, SupportedLanguage> = {
    English: "en",
    Spanish: "es",
    French: "fr",
    Dutch: "nl",
    German: "de",
  };

  if (!language) {
    return DEFAULT_LANGUAGE; // Default to English
  }

  return languageMap[language] || DEFAULT_LANGUAGE;
};

/**
 * Get user language from request (from token if authenticated, otherwise default to English)
 */
const getUserLanguage = (req: AuthenticatedRequest): SupportedLanguage => {
  // Check if user is authenticated and has language preference
  if (req.user?.language) {
    return mapLanguageToCode(req.user.language);
  }

  // Default to English if not authenticated or no language preference
  return DEFAULT_LANGUAGE;
};

/**
 * Common function to translate a single product
 * Automatically detects language from user token/profile
 * 
 * @param product - Product object to translate
 * @param req - Express request object (for getting user language from token)
 * @param useGoogleTranslate - Whether to use Google Translate (default: true)
 * @returns Translated product
 * 
 * @example
 * ```typescript
 * const translatedProduct = await translateProductForUser(product, req);
 * ```
 */
export async function translateProductForUser(
  product: any,
  req: AuthenticatedRequest,
  useGoogleTranslate: boolean = true
): Promise<any> {
  // Get target language from user's token/profile, default to English
  const targetLanguage: SupportedLanguage = getUserLanguage(req);

  // Fast path: If English, return immediately with simple transformation (no async translation needed)
  if (targetLanguage === "en" || !useGoogleTranslate) {
    return transformProductForLanguage(product, targetLanguage);
  }

  // For non-English languages, use Google Translate
  try {
    // First get English text from product using transformProductForLanguage
    const englishProduct = transformProductForLanguage(product, "en");
    // Then translate using Google Translate (with caching)
    const translatedProduct = await translateProduct(englishProduct, targetLanguage);
    return translatedProduct;
  } catch (error: any) {
    // On error, return with simple transformation (fast fallback)
    logger.warn(
      `[Product Translation Common] Translation failed, using fallback: ${error.message}`
    );
    return transformProductForLanguage(product, targetLanguage);
  }
}

/**
 * Common function to translate multiple products
 * Automatically detects language from user token/profile
 * Uses batching to optimize performance
 * 
 * @param products - Array of products to translate
 * @param req - Express request object (for getting user language from token)
 * @param useGoogleTranslate - Whether to use Google Translate (default: true)
 * @returns Array of translated products
 * 
 * @example
 * ```typescript
 * const translatedProducts = await translateProductsForUser(products, req);
 * ```
 */
export async function translateProductsForUser(
  products: any[],
  req: AuthenticatedRequest,
  useGoogleTranslate: boolean = true
): Promise<any[]> {
  // Fast path: Early return for empty array
  if (products.length === 0) {
    return [];
  }

  // Get target language from user's token/profile, default to English
  const targetLanguage: SupportedLanguage = getUserLanguage(req);

  // Fast path: If English, return immediately with simple transformation (no async translation needed)
  if (targetLanguage === "en" || !useGoogleTranslate) {
    // Use parallel processing for multiple products (faster than sequential map)
    return Promise.all(
      products.map((product) => transformProductForLanguage(product, targetLanguage))
    );
  }

  // For non-English languages, use Google Translate with batching
  try {
    // First get English text from all products (parallel processing)
    const englishProducts = products.map((product) =>
      transformProductForLanguage(product, "en")
    );
    // Then translate using Google Translate (with batching and caching optimization)
    const translatedProducts = await translateProducts(englishProducts, targetLanguage);
    return translatedProducts;
  } catch (error: any) {
    // On error, return with simple transformation (fast fallback)
    logger.warn(
      `[Product Translation Common] Translation failed, using fallback: ${error.message}`
    );
    // Use parallel processing for fallback
    return Promise.all(
      products.map((product) => transformProductForLanguage(product, targetLanguage))
    );
  }
}

/**
 * Common function to get user language from request
 * Can be used independently if needed
 * 
 * @param req - Express request object
 * @returns SupportedLanguage code
 * 
 * @example
 * ```typescript
 * const userLang = getUserLanguageFromRequest(req);
 * ```
 */
export function getUserLanguageFromRequest(
  req: AuthenticatedRequest
): SupportedLanguage {
  return getUserLanguage(req);
}

