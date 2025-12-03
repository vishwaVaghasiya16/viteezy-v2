import axios from "axios";
import { logger } from "@/utils/logger";
import { SupportedLanguage, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@/models/common.model";

interface TranslationConfig {
  apiKey?: string;
  apiUrl?: string;
  provider?: "google" | "deepl" | "microsoft";
  enabled: boolean;
}

class TranslationService {
  private config: TranslationConfig;
  private isConfigured: boolean;

  constructor() {
    this.config = {
      apiKey: process.env.TRANSLATION_API_KEY,
      apiUrl: process.env.TRANSLATION_API_URL || "https://api-free.deepl.com/v2/translate",
      provider: (process.env.TRANSLATION_PROVIDER as "google" | "deepl" | "microsoft") || "deepl",
      enabled: process.env.TRANSLATION_ENABLED === "true",
    };
    this.isConfigured = Boolean(this.config.apiKey && this.config.enabled);
  }

  /**
   * Translate text from source language to target language
   */
  async translateText(
    text: string,
    targetLang: SupportedLanguage,
    sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
  ): Promise<string> {
    if (!text || !text.trim()) {
      return text;
    }

    // Don't translate if source and target are the same
    if (sourceLang === targetLang) {
      return text;
    }

    // In development/test mode without API key, return placeholder
    if (!this.isConfigured) {
      logger.info(
        `[DEV MODE] Translation skipped: "${text.substring(0, 50)}..." (${sourceLang} -> ${targetLang})`
      );
      return `[${targetLang.toUpperCase()}] ${text}`;
    }

    try {
      let translatedText: string;

      switch (this.config.provider) {
        case "deepl":
          translatedText = await this.translateWithDeepL(text, targetLang, sourceLang);
          break;
        case "google":
          translatedText = await this.translateWithGoogle(text, targetLang, sourceLang);
          break;
        case "microsoft":
          translatedText = await this.translateWithMicrosoft(text, targetLang, sourceLang);
          break;
        default:
          throw new Error(`Unsupported translation provider: ${this.config.provider}`);
      }

      logger.info(
        `Translation successful: "${text.substring(0, 50)}..." (${sourceLang} -> ${targetLang})`
      );
      return translatedText;
    } catch (error: any) {
      logger.error("Translation failed:", {
        text: text.substring(0, 100),
        sourceLang,
        targetLang,
        error: error?.message,
      });
      // Return original text on error (fail gracefully)
      return text;
    }
  }

  /**
   * Translate multiple texts in parallel
   */
  async translateBatch(
    texts: string[],
    targetLang: SupportedLanguage,
    sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
  ): Promise<string[]> {
    if (!texts || texts.length === 0) {
      return texts;
    }

    // Filter out empty texts
    const validTexts = texts.filter((t) => t && t.trim());
    if (validTexts.length === 0) {
      return texts;
    }

    // Don't translate if source and target are the same
    if (sourceLang === targetLang) {
      return texts;
    }

    // In development/test mode without API key
    if (!this.isConfigured) {
      logger.info(
        `[DEV MODE] Batch translation skipped: ${validTexts.length} texts (${sourceLang} -> ${targetLang})`
      );
      return texts.map((t) => (t ? `[${targetLang.toUpperCase()}] ${t}` : t));
    }

    try {
      // Translate all texts in parallel
      const translations = await Promise.all(
        validTexts.map((text) => this.translateText(text, targetLang, sourceLang))
      );

      // Map back to original array structure
      let translationIndex = 0;
      return texts.map((text) => {
        if (!text || !text.trim()) {
          return text;
        }
        return translations[translationIndex++];
      });
    } catch (error: any) {
      logger.error("Batch translation failed:", {
        count: texts.length,
        sourceLang,
        targetLang,
        error: error?.message,
      });
      // Return original texts on error
      return texts;
    }
  }

  /**
   * Translate an I18nString object to all supported languages
   */
  async translateI18nString(
    i18nString: { en?: string; nl?: string; de?: string; fr?: string; es?: string },
    languages: SupportedLanguage[] = SUPPORTED_LANGUAGES
  ): Promise<{ en?: string; nl?: string; de?: string; fr?: string; es?: string }> {
    const sourceText = i18nString.en || "";
    if (!sourceText) {
      return i18nString;
    }

    const result: any = { ...i18nString };

    // Translate to each target language if not already present
    const languagesToTranslate = languages.filter(
      (lang) => lang !== DEFAULT_LANGUAGE && !i18nString[lang]
    );

    if (languagesToTranslate.length === 0) {
      return result;
    }

    // Translate to all target languages in parallel
    const translations = await Promise.all(
      languagesToTranslate.map((lang) => this.translateText(sourceText, lang))
    );

    languagesToTranslate.forEach((lang, index) => {
      result[lang] = translations[index];
    });

    return result;
  }

  /**
   * Translate an I18nText object to all supported languages
   */
  async translateI18nText(
    i18nText: { en?: string; nl?: string; de?: string; fr?: string; es?: string },
    languages: SupportedLanguage[] = SUPPORTED_LANGUAGES
  ): Promise<{ en?: string; nl?: string; de?: string; fr?: string; es?: string }> {
    return this.translateI18nString(i18nText, languages);
  }

  /**
   * Translate an array of strings (e.g., benefits, ingredients)
   */
  async translateStringArray(
    strings: string[],
    targetLang: SupportedLanguage,
    sourceLang: SupportedLanguage = DEFAULT_LANGUAGE
  ): Promise<string[]> {
    if (!strings || strings.length === 0) {
      return strings;
    }

    return this.translateBatch(strings, targetLang, sourceLang);
  }

  /**
   * DeepL Translation API
   */
  private async translateWithDeepL(
    text: string,
    targetLang: SupportedLanguage,
    sourceLang: SupportedLanguage
  ): Promise<string> {
    const deepLLangMap: Record<SupportedLanguage, string> = {
      en: "EN",
      nl: "NL",
      de: "DE",
      fr: "FR",
      es: "ES",
    };

    const response = await axios.post(
      this.config.apiUrl!,
      {
        text: [text],
        target_lang: deepLLangMap[targetLang],
        source_lang: deepLLangMap[sourceLang],
      },
      {
        headers: {
          Authorization: `DeepL-Auth-Key ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    return response.data.translations[0].text;
  }

  /**
   * Google Translate API
   */
  private async translateWithGoogle(
    text: string,
    targetLang: SupportedLanguage,
    sourceLang: SupportedLanguage
  ): Promise<string> {
    const googleLangMap: Record<SupportedLanguage, string> = {
      en: "en",
      nl: "nl",
      de: "de",
      fr: "fr",
      es: "es",
    };

    const response = await axios.post(
      `https://translation.googleapis.com/language/translate/v2?key=${this.config.apiKey}`,
      {
        q: text,
        target: googleLangMap[targetLang],
        source: googleLangMap[sourceLang],
      },
      {
        timeout: 10000,
      }
    );

    return response.data.data.translations[0].translatedText;
  }

  /**
   * Microsoft Translator API
   */
  private async translateWithMicrosoft(
    text: string,
    targetLang: SupportedLanguage,
    sourceLang: SupportedLanguage
  ): Promise<string> {
    const msLangMap: Record<SupportedLanguage, string> = {
      en: "en",
      nl: "nl",
      de: "de",
      fr: "fr",
      es: "es",
    };

    // First get access token
    const tokenResponse = await axios.post(
      `https://api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      null,
      {
        headers: {
          "Ocp-Apim-Subscription-Key": this.config.apiKey,
        },
        timeout: 5000,
      }
    );

    const accessToken = tokenResponse.data;

    // Then translate
    const response = await axios.post(
      `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${msLangMap[targetLang]}&from=${msLangMap[sourceLang]}`,
      [{ Text: text }],
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    return response.data[0].translations[0].text;
  }
}

export const translationService = new TranslationService();

