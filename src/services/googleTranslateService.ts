import fetch from "node-fetch";
import { logger } from "../utils/logger";

const GOOGLE_TRANSLATE_API_KEY = "AIzaSyD4cLsqW4q0ukFliEoiZ6KmQqrBJxen7u8";
const GOOGLE_TRANSLATE_API_URL = "https://translation.googleapis.com/language/translate/v2";

// Supported language codes
export type TranslateLanguageCode = "en" | "nl" | "fr" | "es" | "de";

interface TranslateResponse {
  data: {
    translations: Array<{
      translatedText: string;
      detectedSourceLanguage?: string;
    }>;
  };
}

interface TranslateError {
  error: {
    code: number;
    message: string;
  };
}

// In-memory cache for translations
interface CacheEntry {
  translation: string;
  timestamp: number;
}

const translationCache = new Map<string, CacheEntry>();
const CACHE_MAX_SIZE = 50000; // Max 50k cached translations
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

class GoogleTranslateService {
  /**
   * Get cached translation or null if not found/expired
   */
  private getCachedTranslation(text: string, targetLanguage: TranslateLanguageCode): string | null {
    const key = `${text}_${targetLanguage}`;
    const cached = translationCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.translation;
    }
    
    // Remove expired entry
    if (cached) {
      translationCache.delete(key);
    }
    
    return null;
  }

  /**
   * Cache a translation
   */
  private cacheTranslation(text: string, targetLanguage: TranslateLanguageCode, translation: string): void {
    // If cache is too large, remove oldest entries
    if (translationCache.size >= CACHE_MAX_SIZE) {
      const entries = Array.from(translationCache.entries()) as [string, CacheEntry][];
      // Remove 20% of oldest entries
      entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, Math.floor(CACHE_MAX_SIZE * 0.2))
        .forEach(([key]) => translationCache.delete(key));
    }
    
    const key = `${text}_${targetLanguage}`;
    translationCache.set(key, {
      translation,
      timestamp: Date.now(),
    });
  }

  /**
   * Translate text from English to target language
   * @param text - Text to translate
   * @param targetLanguage - Target language code (nl, fr, es, de)
   * @param useCache - Whether to use cache (default: true)
   * @returns Translated text or original text if translation fails
   */
  async translateText(
    text: string,
    targetLanguage: TranslateLanguageCode,
    useCache: boolean = true
  ): Promise<string> {
    // If target language is English, return original text
    if (targetLanguage === "en" || !text || text.trim() === "") {
      return text;
    }

    // Check cache first (if enabled)
    if (useCache) {
      const cached = this.getCachedTranslation(text, targetLanguage);
      if (cached !== null) {
        return cached;
      }
    }

    // Define these outside try block so they're accessible in catch/retry
    const url = `${GOOGLE_TRANSLATE_API_URL}?key=${GOOGLE_TRANSLATE_API_KEY}`;
    const TIMEOUT_MS = 30000;
    
    // Google Translate API expects form data or URL-encoded params
    const params = new URLSearchParams();
    params.append("q", text);
    params.append("source", "en"); // Source language is always English
    params.append("target", targetLanguage);
    params.append("format", "text");
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = (await response.json()) as TranslateError;
          logger.error(
            `[Google Translate] API error: ${errorData.error.message}`
          );
          // Return original text if translation fails
          return text;
        }

        const data = (await response.json()) as TranslateResponse;
        
        if (
          data.data?.translations?.length > 0 &&
          data.data.translations[0].translatedText
        ) {
          const translated = data.data.translations[0].translatedText;
          // Cache the translation
          if (useCache) {
            this.cacheTranslation(text, targetLanguage, translated);
          }
          return translated;
        }

        // Return original text if no translation found
        return text;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error: any) {
      // Check if it's a retryable error (ECONNRESET, ETIMEDOUT, network errors)
      const isRetryable = 
        error.name === "AbortError" || 
        error.code === "ETIMEDOUT" || 
        error.code === "ECONNRESET" ||
        error.code === "ECONNREFUSED" ||
        error.message?.includes("ECONNRESET") ||
        error.message?.includes("ETIMEDOUT");

      if (isRetryable) {
        // Retry once with exponential backoff
        try {
          logger.warn(
            `[Google Translate] Retryable error (${error.code || error.name}), retrying once...`
          );
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          
          // Create new controller for retry
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), TIMEOUT_MS);
          
          const retryResponse = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
            signal: retryController.signal,
          });
          
          clearTimeout(retryTimeoutId);
          
          if (retryResponse.ok) {
            const retryData = (await retryResponse.json()) as TranslateResponse;
            if (retryData.data?.translations?.length > 0 && retryData.data.translations[0].translatedText) {
              const translated = retryData.data.translations[0].translatedText;
              if (useCache) {
                this.cacheTranslation(text, targetLanguage, translated);
              }
              return translated;
            }
          }
        } catch (retryError: any) {
          logger.warn(
            `[Google Translate] Retry also failed. Returning original text.`
          );
        }
      } else {
        logger.error(
          `[Google Translate] Error translating text: ${error.message}`,
          error
        );
      }
      // Return original text if translation fails
      return text;
    }
  }

  /**
   * Translate multiple texts in parallel
   * @param texts - Array of texts to translate
   * @param targetLanguage - Target language code
   * @returns Array of translated texts
   */
  async translateTexts(
    texts: string[],
    targetLanguage: TranslateLanguageCode,
    useCache: boolean = true
  ): Promise<string[]> {
    // If target language is English, return original texts
    if (targetLanguage === "en" || texts.length === 0) {
      return texts;
    }

    // Filter out empty texts
    const validTexts = texts.filter((text) => text && text.trim() !== "");
    
    if (validTexts.length === 0) {
      return texts;
    }

    // Check cache for all texts first
    const cacheResults: Map<number, string> = new Map();
    const textsToTranslate: { text: string; originalIndex: number }[] = [];
    
    if (useCache) {
      validTexts.forEach((text, index) => {
        const cached = this.getCachedTranslation(text, targetLanguage);
        if (cached !== null) {
          cacheResults.set(index, cached);
        } else {
          textsToTranslate.push({ text, originalIndex: index });
        }
      });
    } else {
      validTexts.forEach((text, index) => {
        textsToTranslate.push({ text, originalIndex: index });
      });
    }

    // If all texts are cached, return immediately
    if (textsToTranslate.length === 0) {
      const result: string[] = [];
      let validTextIndex = 0;
      for (let i = 0; i < texts.length; i++) {
        if (texts[i] && texts[i].trim() !== "") {
          result.push(cacheResults.get(validTextIndex) || texts[i]);
          validTextIndex++;
        } else {
          result.push(texts[i]);
        }
      }
      return result;
    }

    // Define these outside try block so they're accessible in catch/retry
    const textsToTranslateArray = textsToTranslate.map((item) => item.text);
    const url = `${GOOGLE_TRANSLATE_API_URL}?key=${GOOGLE_TRANSLATE_API_KEY}`;
    const TIMEOUT_MS = 45000;
    
    // Google Translate API expects form data or URL-encoded params
    const params = new URLSearchParams();
    textsToTranslateArray.forEach((text) => params.append("q", text));
    params.append("source", "en");
    params.append("target", targetLanguage);
    params.append("format", "text");
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = (await response.json()) as TranslateError;
          logger.error(
            `[Google Translate] API error for batch translation: ${errorData.error.message}`
          );
          // Return original texts if translation fails
          return texts;
        }

        const data = (await response.json()) as TranslateResponse;
        
        if (data.data?.translations?.length > 0) {
          const translations = data.data.translations.map(
            (t) => t.translatedText
          );
          
          // Cache the new translations
          if (useCache) {
            textsToTranslate.forEach((item, idx) => {
              if (translations[idx]) {
                this.cacheTranslation(item.text, targetLanguage, translations[idx]);
              }
            });
          }
          
          // Map translations back to original array positions (handling empty texts and cached results)
          const result: string[] = [];
          let validTextIndex = 0;
          
          for (let i = 0; i < texts.length; i++) {
            if (texts[i] && texts[i].trim() !== "") {
              // Check if this text was cached
              const cached = cacheResults.get(validTextIndex);
              if (cached !== undefined) {
                result.push(cached);
              } else {
                // Find the translation index for this text
                const translateItem = textsToTranslate.find((item) => item.originalIndex === validTextIndex);
                if (translateItem) {
                  const translateIdx = textsToTranslate.indexOf(translateItem);
                  result.push(translations[translateIdx] || texts[i]);
                } else {
                  result.push(texts[i]);
                }
              }
              validTextIndex++;
            } else {
              result.push(texts[i]);
            }
          }
          
          return result;
        }

        // Return original texts if no translation found
        return texts;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error: any) {
      // Check if it's a retryable error
      const isRetryable = 
        error.name === "AbortError" || 
        error.code === "ETIMEDOUT" || 
        error.code === "ECONNRESET" ||
        error.code === "ECONNREFUSED" ||
        error.message?.includes("ECONNRESET") ||
        error.message?.includes("ETIMEDOUT");

      if (isRetryable) {
        // Retry once with exponential backoff
        try {
          logger.warn(
            `[Google Translate] Retryable error (${error.code || error.name}) for batch translation, retrying once...`
          );
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for batch
          
          // Create new controller for retry
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), TIMEOUT_MS);
          
          const retryResponse = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
            signal: retryController.signal,
          });
          
          clearTimeout(retryTimeoutId);
          
          if (retryResponse.ok) {
            const retryData = (await retryResponse.json()) as TranslateResponse;
            if (retryData.data?.translations?.length > 0) {
              const translations = retryData.data.translations.map((t) => t.translatedText);
              
              // Cache the new translations
              if (useCache) {
                textsToTranslate.forEach((item, idx) => {
                  if (translations[idx]) {
                    this.cacheTranslation(item.text, targetLanguage, translations[idx]);
                  }
                });
              }
              
              // Map translations back
              const result: string[] = [];
              let validTextIndex = 0;
              
              for (let i = 0; i < texts.length; i++) {
                if (texts[i] && texts[i].trim() !== "") {
                  const cached = cacheResults.get(validTextIndex);
                  if (cached !== undefined) {
                    result.push(cached);
                  } else {
                    const translateItem = textsToTranslate.find((item) => item.originalIndex === validTextIndex);
                    if (translateItem) {
                      const translateIdx = textsToTranslate.indexOf(translateItem);
                      result.push(translations[translateIdx] || texts[i]);
                    } else {
                      result.push(texts[i]);
                    }
                  }
                  validTextIndex++;
                } else {
                  result.push(texts[i]);
                }
              }
              
              return result;
            }
          }
        } catch (retryError: any) {
          logger.warn(
            `[Google Translate] Retry also failed for batch. Returning original texts.`
          );
        }
      } else {
        logger.error(
          `[Google Translate] Error translating texts: ${error.message}`,
          error
        );
      }
      // Return original texts if translation fails
      return texts;
    }
  }
}

export const googleTranslateService = new GoogleTranslateService();

