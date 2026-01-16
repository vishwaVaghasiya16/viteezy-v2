/**
 * Enterprise-Level Language Constants
 * All language-related constants centralized here
 * @module constants/languageConstants
 */

/**
 * ISO 639-1 Language Codes
 * Standard 2-letter language codes
 */
export const LANGUAGE_CODES = {
  ENGLISH: "en",
  DUTCH: "nl",
  GERMAN: "de",
  FRENCH: "fr",
  SPANISH: "es",
  ITALIAN: "it",
  PORTUGUESE: "pt",
  RUSSIAN: "ru",
  CHINESE: "zh",
  JAPANESE: "ja",
  KOREAN: "ko",
  ARABIC: "ar",
  HINDI: "hi",
  TURKISH: "tr",
  POLISH: "pl",
  SWEDISH: "sv",
  NORWEGIAN: "no",
  DANISH: "da",
  FINNISH: "fi",
  GREEK: "el",
  CZECH: "cs",
  ROMANIAN: "ro",
  HUNGARIAN: "hu",
  BULGARIAN: "bg",
  CROATIAN: "hr",
  SERBIAN: "sr",
  SLOVAK: "sk",
  SLOVENIAN: "sl",
} as const;

/**
 * Language Names (Display Names)
 * Standard language names in English
 */
export const LANGUAGE_NAMES = {
  [LANGUAGE_CODES.ENGLISH]: "English",
  [LANGUAGE_CODES.DUTCH]: "Dutch",
  [LANGUAGE_CODES.GERMAN]: "German",
  [LANGUAGE_CODES.FRENCH]: "French",
  [LANGUAGE_CODES.SPANISH]: "Spanish",
  [LANGUAGE_CODES.ITALIAN]: "Italian",
  [LANGUAGE_CODES.PORTUGUESE]: "Portuguese",
  [LANGUAGE_CODES.RUSSIAN]: "Russian",
  [LANGUAGE_CODES.CHINESE]: "Chinese",
  [LANGUAGE_CODES.JAPANESE]: "Japanese",
  [LANGUAGE_CODES.KOREAN]: "Korean",
  [LANGUAGE_CODES.ARABIC]: "Arabic",
  [LANGUAGE_CODES.HINDI]: "Hindi",
  [LANGUAGE_CODES.TURKISH]: "Turkish",
  [LANGUAGE_CODES.POLISH]: "Polish",
  [LANGUAGE_CODES.SWEDISH]: "Swedish",
  [LANGUAGE_CODES.NORWEGIAN]: "Norwegian",
  [LANGUAGE_CODES.DANISH]: "Danish",
  [LANGUAGE_CODES.FINNISH]: "Finnish",
  [LANGUAGE_CODES.GREEK]: "Greek",
  [LANGUAGE_CODES.CZECH]: "Czech",
  [LANGUAGE_CODES.ROMANIAN]: "Romanian",
  [LANGUAGE_CODES.HUNGARIAN]: "Hungarian",
  [LANGUAGE_CODES.BULGARIAN]: "Bulgarian",
  [LANGUAGE_CODES.CROATIAN]: "Croatian",
  [LANGUAGE_CODES.SERBIAN]: "Serbian",
  [LANGUAGE_CODES.SLOVAK]: "Slovak",
  [LANGUAGE_CODES.SLOVENIAN]: "Slovenian",
} as const;

/**
 * Default Language Configuration
 */
export const DEFAULT_LANGUAGE = {
  CODE: LANGUAGE_CODES.ENGLISH,
  NAME: LANGUAGE_NAMES[LANGUAGE_CODES.ENGLISH],
} as const;

/**
 * Default Supported Languages (Initial Setup)
 * These are the languages that come pre-configured
 */
export const DEFAULT_SUPPORTED_LANGUAGES = [
  LANGUAGE_CODES.ENGLISH,
  LANGUAGE_CODES.DUTCH,
  LANGUAGE_CODES.GERMAN,
  LANGUAGE_CODES.FRENCH,
  LANGUAGE_CODES.SPANISH,
  LANGUAGE_CODES.ITALIAN,
] as const;

/**
 * Language Code to Name Mapping
 */
export const LANGUAGE_CODE_TO_NAME: Record<string, string> = LANGUAGE_NAMES;

/**
 * Language Name to Code Mapping (Case-insensitive)
 */
export const LANGUAGE_NAME_TO_CODE: Record<string, string> = Object.entries(
  LANGUAGE_NAMES
).reduce((acc, [code, name]) => {
  acc[name.toLowerCase()] = code;
  return acc;
}, {} as Record<string, string>);

/**
 * Get language name by code
 */
export const getLanguageName = (code: string): string => {
  return (
    LANGUAGE_NAMES[code.toLowerCase() as keyof typeof LANGUAGE_NAMES] ||
    code.toUpperCase()
  );
};

/**
 * Get language code by name (case-insensitive)
 */
export const getLanguageCode = (name: string): string | null => {
  const normalized = name.toLowerCase().trim();
  return LANGUAGE_NAME_TO_CODE[normalized] || null;
};

/**
 * Check if language code is valid (ISO 639-1 format)
 */
export const isValidLanguageCode = (code: string): boolean => {
  return /^[a-z]{2}$/i.test(code);
};

/**
 * Normalize language code (lowercase, trim)
 */
export const normalizeLanguageCode = (code: string): string => {
  return code.toLowerCase().trim();
};

/**
 * Get all available language codes
 */
export const getAllLanguageCodes = (): string[] => {
  return Object.values(LANGUAGE_CODES);
};

/**
 * Get all available language names
 */
export const getAllLanguageNames = (): string[] => {
  return Object.values(LANGUAGE_NAMES);
};

/**
 * Language Configuration Type
 */
export interface LanguageConfig {
  code: string;
  name: string;
  isEnabled: boolean;
  isDefault?: boolean;
}

/**
 * Default Language Configuration Array
 */
export const DEFAULT_LANGUAGE_CONFIG: LanguageConfig[] = [
  {
    code: LANGUAGE_CODES.ENGLISH,
    name: LANGUAGE_NAMES[LANGUAGE_CODES.ENGLISH],
    isEnabled: true,
    isDefault: true,
  },
  {
    code: LANGUAGE_CODES.DUTCH,
    name: LANGUAGE_NAMES[LANGUAGE_CODES.DUTCH],
    isEnabled: true,
    isDefault: false,
  },
  {
    code: LANGUAGE_CODES.GERMAN,
    name: LANGUAGE_NAMES[LANGUAGE_CODES.GERMAN],
    isEnabled: false,
    isDefault: false,
  },
  {
    code: LANGUAGE_CODES.FRENCH,
    name: LANGUAGE_NAMES[LANGUAGE_CODES.FRENCH],
    isEnabled: false,
    isDefault: false,
  },
  {
    code: LANGUAGE_CODES.SPANISH,
    name: LANGUAGE_NAMES[LANGUAGE_CODES.SPANISH],
    isEnabled: false,
    isDefault: false,
  },
  {
    code: LANGUAGE_CODES.ITALIAN,
    name: LANGUAGE_NAMES[LANGUAGE_CODES.ITALIAN],
    isEnabled: false,
    isDefault: false,
  },
];

/**
 * Language Validation Constants
 */
export const LANGUAGE_VALIDATION = {
  CODE_PATTERN: /^[A-Z]{2}$/i,
  CODE_MIN_LENGTH: 2,
  CODE_MAX_LENGTH: 2,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
} as const;

/**
 * Language Cache Configuration
 */
export const LANGUAGE_CACHE = {
  TTL: 5 * 60 * 1000, // 5 minutes in milliseconds
  KEY_PREFIX: "lang:",
} as const;

/**
 * Language Translation Constants
 */
export const LANGUAGE_TRANSLATION = {
  SOURCE_LANGUAGE: LANGUAGE_CODES.ENGLISH,
  AUTO_TRANSLATE_ENABLED: true,
  FALLBACK_TO_SOURCE: true,
} as const;

/**
 * Export all constants as a single object for easy import
 */
export const LANGUAGE_CONSTANTS = {
  CODES: LANGUAGE_CODES,
  NAMES: LANGUAGE_NAMES,
  DEFAULT: DEFAULT_LANGUAGE,
  DEFAULT_SUPPORTED: DEFAULT_SUPPORTED_LANGUAGES,
  DEFAULT_CONFIG: DEFAULT_LANGUAGE_CONFIG,
  VALIDATION: LANGUAGE_VALIDATION,
  CACHE: LANGUAGE_CACHE,
  TRANSLATION: LANGUAGE_TRANSLATION,
  // Helper functions
  getLanguageName,
  getLanguageCode,
  isValidLanguageCode,
  normalizeLanguageCode,
  getAllLanguageCodes,
  getAllLanguageNames,
} as const;

export default LANGUAGE_CONSTANTS;
