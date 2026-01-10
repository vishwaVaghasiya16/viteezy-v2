import axios from "axios";
import { logger } from "@/utils/logger";
import { I18nStringType, I18nTextType, SupportedLanguage, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@/models/common.model";

/**
 * Translation Service
 * Handles automatic translation using Google Translate API
 */
class TranslationService {
  private apiKey: string | null;
  private enabled: boolean;
  private baseUrl: string = "https://translation.googleapis.com/language/translate/v2";

  constructor() {
    this.apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || null;
    this.enabled = process.env.TRANSLATION_ENABLED === "true" && !!this.apiKey;

    if (!this.enabled) {
      logger.warn("Translation service is disabled. Set TRANSLATION_ENABLED=true and GOOGLE_TRANSLATE_API_KEY in .env");
    }
  }

  /**
   * Translate a single text string
   * @param text - Text to translate
   * @param targetLang - Target language code (nl, de, fr, es)
   * @param sourceLang - Source language code (default: en)
   * @returns Translated text or original text if translation fails
   */
  async translateText(
    text: string,
    targetLang: SupportedLanguage,
    sourceLang: SupportedLanguage = "en"
  ): Promise<string> {
    if (!text || !text.trim()) {
      return text;
    }

    // Don't translate if target is same as source
    if (targetLang === sourceLang) {
      return text;
    }

    // If translation is disabled, return placeholder
    if (!this.enabled) {
      return `[${targetLang.toUpperCase()}] ${text}`;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}?key=${this.apiKey}`,
        {
          q: text,
          target: targetLang,
          source: sourceLang,
          format: "text",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000, // 10 seconds timeout
        }
      );

      const translatedText = response.data?.data?.translations?.[0]?.translatedText;
      
      if (translatedText) {
        return translatedText;
      }

      logger.warn(`Translation API returned empty result for text: ${text.substring(0, 50)}...`);
      return text;
    } catch (error: any) {
      logger.error(`Translation failed for text: ${text.substring(0, 50)}...`, {
        error: error.message,
        targetLang,
        sourceLang,
      });
      // Return original text on error
      return text;
    }
  }

  /**
   * Translate multiple texts in batch
   * @param texts - Array of texts to translate
   * @param targetLang - Target language code
   * @param sourceLang - Source language code (default: en)
   * @returns Array of translated texts
   */
  async translateBatch(
    texts: string[],
    targetLang: SupportedLanguage,
    sourceLang: SupportedLanguage = "en"
  ): Promise<string[]> {
    if (!texts || texts.length === 0) {
      return texts;
    }

    // Don't translate if target is same as source
    if (targetLang === sourceLang) {
      return texts;
    }

    // If translation is disabled, return placeholders
    if (!this.enabled) {
      return texts.map((text) => `[${targetLang.toUpperCase()}] ${text}`);
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}?key=${this.apiKey}`,
        {
          q: texts,
          target: targetLang,
          source: sourceLang,
          format: "text",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 15000, // 15 seconds timeout for batch
        }
      );

      const translations = response.data?.data?.translations || [];
      return translations.map((t: any) => t.translatedText || "");
    } catch (error: any) {
      logger.error(`Batch translation failed`, {
        error: error.message,
        targetLang,
        sourceLang,
        count: texts.length,
      });
      // Return original texts on error
      return texts;
    }
  }

  /**
   * Translate an I18nString object (translates from English to all other languages)
   * @param i18nString - I18nString object with English text
   * @returns I18nString object with all translations
   */
  async translateI18nString(i18nString: I18nStringType | string): Promise<I18nStringType> {
    // If it's already a full I18n object with all languages, return as is
    if (typeof i18nString !== "string") {
      const keys = Object.keys(i18nString);
      // If it has English and at least one other language, assume it's already translated
      if (i18nString.en && keys.length > 1) {
        return i18nString as I18nStringType;
      }
    }

    // Get English text
    const englishText = typeof i18nString === "string" ? i18nString : (i18nString.en || "");

    if (!englishText || !englishText.trim()) {
      return typeof i18nString === "string" ? { en: englishText } : (i18nString as I18nStringType);
    }

    const result: I18nStringType = {
      en: englishText,
    };

    // Translate to all other languages
    const targetLanguages: SupportedLanguage[] = SUPPORTED_LANGUAGES.filter((lang) => lang !== "en");

    // Translate each language sequentially (Google Translate API handles one target at a time)
    for (const lang of targetLanguages) {
      try {
        result[lang] = await this.translateText(englishText, lang, "en");
      } catch (error) {
        logger.warn(`Failed to translate to ${lang}, keeping English`);
        result[lang] = englishText; // Fallback to English
      }
    }

    return result;
  }

  /**
   * Translate an I18nText object (translates from English to all other languages)
   * @param i18nText - I18nText object with English text
   * @returns I18nText object with all translations
   */
  async translateI18nText(i18nText: I18nTextType | string): Promise<I18nTextType> {
    // If it's already a full I18n object with all languages, return as is
    if (typeof i18nText !== "string") {
      const keys = Object.keys(i18nText);
      // If it has English and at least one other language, assume it's already translated
      if (i18nText.en && keys.length > 1) {
        return i18nText as I18nTextType;
      }
    }

    // Get English text
    const englishText = typeof i18nText === "string" ? i18nText : (i18nText.en || "");

    if (!englishText || !englishText.trim()) {
      return typeof i18nText === "string" ? { en: englishText } : (i18nText as I18nTextType);
    }

    const result: I18nTextType = {
      en: englishText,
    };

    // Translate to all other languages
    const targetLanguages: SupportedLanguage[] = SUPPORTED_LANGUAGES.filter((lang) => lang !== "en");

    // Translate each language sequentially
    for (const lang of targetLanguages) {
      try {
        result[lang] = await this.translateText(englishText, lang, "en");
      } catch (error) {
        logger.warn(`Failed to translate to ${lang}, keeping English`);
        result[lang] = englishText; // Fallback to English
      }
    }

    return result;
  }

  /**
   * Translate an object with I18n fields
   * @param data - Object containing I18n fields
   * @param i18nFields - Array of field names that are I18n types
   * @returns Object with translated I18n fields
   */
  async translateObject(
    data: Record<string, any>,
    i18nStringFields: string[] = [],
    i18nTextFields: string[] = []
  ): Promise<Record<string, any>> {
    const result = { ...data };

    // Translate I18nString fields
    for (const field of i18nStringFields) {
      if (data[field] !== undefined && data[field] !== null) {
        result[field] = await this.translateI18nString(data[field]);
      }
    }

    // Translate I18nText fields
    for (const field of i18nTextFields) {
      if (data[field] !== undefined && data[field] !== null) {
        result[field] = await this.translateI18nText(data[field]);
      }
    }

    return result;
  }

  /**
   * Check if translation service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

export const translationService = new TranslationService();

