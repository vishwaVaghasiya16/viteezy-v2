import { GeneralSettings } from "@/models/cms/generalSettings.model";
import { logger } from "@/utils/logger";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_LANGUAGE_CONFIG,
  LANGUAGE_CACHE,
  isValidLanguageCode as validateLanguageCodeFormat,
  normalizeLanguageCode,
  getLanguageName,
} from "@/constants/languageConstants";

/**
 * Language Service
 * Manages dynamic language configuration from GeneralSettings
 */
class LanguageService {
  private cache: {
    allLanguages: string[];
    activeLanguages: string[];
    defaultLanguage: string;
    lastUpdated: Date | null;
  } = {
    allLanguages: [],
    activeLanguages: [],
    defaultLanguage: DEFAULT_LANGUAGE.CODE,
    lastUpdated: null,
  };

  private readonly CACHE_TTL = LANGUAGE_CACHE.TTL;

  /**
   * Get all languages (enabled and disabled) from GeneralSettings
   */
  async getAllLanguages(): Promise<string[]> {
    try {
      const settings = await GeneralSettings.findOne({
        isDeleted: { $ne: true },
      }).lean();

      if (!settings || !settings.languages || settings.languages.length === 0) {
        // Return default languages if settings don't exist
        return DEFAULT_LANGUAGE_CONFIG.map((lang) => lang.code.toLowerCase());
      }

      return settings.languages.map((lang) => lang.code.toLowerCase());
    } catch (error: any) {
      logger.error("Error fetching all languages", { error: error.message });
      // Fallback to default languages
      return ["en", "nl", "de", "fr", "es"];
    }
  }

  /**
   * Get only active (enabled) languages from GeneralSettings
   */
  async getActiveLanguages(): Promise<string[]> {
    // Check cache first
    if (
      this.cache.lastUpdated &&
      Date.now() - this.cache.lastUpdated.getTime() < this.CACHE_TTL &&
      this.cache.activeLanguages.length > 0
    ) {
      return this.cache.activeLanguages;
    }

    try {
      const settings = await GeneralSettings.findOne({
        isDeleted: { $ne: true },
      }).lean();

      if (!settings || !settings.languages || settings.languages.length === 0) {
        // Return default active languages if settings don't exist
        const defaultActive = DEFAULT_LANGUAGE_CONFIG.filter(
          (lang) => lang.isEnabled
        ).map((lang) => lang.code.toLowerCase());
        this.cache.activeLanguages = defaultActive;
        this.cache.defaultLanguage = DEFAULT_LANGUAGE.CODE;
        this.cache.lastUpdated = new Date();
        return defaultActive;
      }

      const active = settings.languages
        .filter((lang) => lang.isEnabled)
        .map((lang) => lang.code.toLowerCase())
        .sort();

      // Ensure default language is always included and first
      if (!active.includes(DEFAULT_LANGUAGE.CODE)) {
        active.unshift(DEFAULT_LANGUAGE.CODE);
      }

      // Update cache
      this.cache.activeLanguages = active;
      this.cache.allLanguages = settings.languages.map((lang) =>
        normalizeLanguageCode(lang.code)
      );
      this.cache.defaultLanguage = DEFAULT_LANGUAGE.CODE;
      this.cache.lastUpdated = new Date();

      return active;
    } catch (error: any) {
      logger.error("Error fetching active languages", {
        error: error.message,
      });
      // Fallback to default active languages
      const defaultActive = DEFAULT_LANGUAGE_CONFIG.filter(
        (lang) => lang.isEnabled
      ).map((lang) => lang.code.toLowerCase());
      this.cache.activeLanguages = defaultActive;
      this.cache.defaultLanguage = DEFAULT_LANGUAGE.CODE;
      this.cache.lastUpdated = new Date();
      return defaultActive;
    }
  }

  /**
   * Get default language (always English)
   */
  getDefaultLanguage(): string {
    return DEFAULT_LANGUAGE.CODE;
  }

  /**
   * Check if a language code is valid (exists in GeneralSettings)
   */
  async isValidLanguage(code: string): Promise<boolean> {
    const allLanguages = await this.getAllLanguages();
    return allLanguages.includes(code.toLowerCase());
  }

  /**
   * Check if a language is active (enabled)
   */
  async isLanguageActive(code: string): Promise<boolean> {
    const activeLanguages = await this.getActiveLanguages();
    return activeLanguages.includes(code.toLowerCase());
  }

  /**
   * Get language name by code
   */
  async getLanguageName(code: string): Promise<string | null> {
    try {
      const settings = await GeneralSettings.findOne({
        isDeleted: { $ne: true },
      }).lean();

      if (!settings || !settings.languages) {
        return null;
      }

      const lang = settings.languages.find(
        (l) => l.code.toLowerCase() === code.toLowerCase()
      );

      return lang?.name || null;
    } catch (error: any) {
      logger.error("Error fetching language name", { error: error.message });
      return null;
    }
  }

  /**
   * Clear cache (call this after language updates)
   */
  clearCache(): void {
    this.cache = {
      allLanguages: [],
      activeLanguages: [],
      defaultLanguage: "en",
      lastUpdated: null,
    };
  }

  /**
   * Get language settings with metadata
   */
  async getLanguageSettings(): Promise<
    Array<{ code: string; name: string; isEnabled: boolean }>
  > {
    try {
      const settings = await GeneralSettings.findOne({
        isDeleted: { $ne: true },
      }).lean();

      if (!settings || !settings.languages || settings.languages.length === 0) {
        // Return default language configuration
        return DEFAULT_LANGUAGE_CONFIG.map((lang) => ({
          code: lang.code.toLowerCase(),
          name: lang.name,
          isEnabled: lang.isEnabled,
        }));
      }

      return settings.languages.map((lang) => ({
        code: lang.code.toLowerCase(),
        name: lang.name,
        isEnabled: lang.isEnabled,
      }));
    } catch (error: any) {
      logger.error("Error fetching language settings", {
        error: error.message,
      });
      // Return default enabled languages
      return DEFAULT_LANGUAGE_CONFIG.filter((lang) => lang.isEnabled).map(
        (lang) => ({
          code: lang.code.toLowerCase(),
          name: lang.name,
          isEnabled: lang.isEnabled,
        })
      );
    }
  }
}

export const languageService = new LanguageService();
