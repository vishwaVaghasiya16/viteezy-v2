import { translationService } from "@/services/translationService";
import { logger } from "@/utils/logger";

/**
 * Helper to get nested value from object using dot notation path
 */
const getNestedValue = (obj: any, path: string): any => {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[key];
  }
  return current;
};

/**
 * Helper to set nested value in object using dot notation path
 */
const setNestedValue = (obj: any, path: string, value: any): void => {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
};

/**
 * Translate a field value (string or I18n object) to I18n object
 */
const translateField = async (
  fieldValue: any,
  isText: boolean = false
): Promise<any> => {
  if (fieldValue === undefined || fieldValue === null) {
    return undefined;
  }

  // Check if translation service is enabled
  if (!translationService.isEnabled()) {
    logger.warn("Translation service is disabled. Returning placeholder format for all languages.");
    
    // Get English text
    const englishText = typeof fieldValue === "string" 
      ? fieldValue.trim() 
      : (typeof fieldValue === "object" && !Array.isArray(fieldValue) && fieldValue.en 
          ? fieldValue.en.trim() 
          : "");
    
    if (!englishText) {
      // If no English text, return empty object or existing object
      if (typeof fieldValue === "object" && !Array.isArray(fieldValue)) {
        return fieldValue;
      }
      return {};
    }
    
    // Return I18n object with English and placeholder format for other languages
    // Format: [NL] text, [DE] text, [FR] text, [ES] text
    return {
      en: englishText,
      nl: `[NL] ${englishText}`,
      de: `[DE] ${englishText}`,
      fr: `[FR] ${englishText}`,
      es: `[ES] ${englishText}`,
    };
  }

  try {
    // If it's already an I18n object with English, translate it
    if (
      typeof fieldValue === "object" &&
      !Array.isArray(fieldValue) &&
      fieldValue.en
    ) {
      logger.debug("Translating I18n object", {
        fieldValue,
        keys: Object.keys(fieldValue),
      });
      const translated = isText
        ? await translationService.translateI18nText(fieldValue)
        : await translationService.translateI18nString(fieldValue);
      logger.debug("Translation result", {
        translated,
        keys: Object.keys(translated),
      });
      return translated;
    }
    // If it's a plain string, convert to I18n and translate
    else if (typeof fieldValue === "string" && fieldValue.trim()) {
      logger.debug("Translating plain string", { fieldValue });
      const translated = isText
        ? await translationService.translateI18nText(fieldValue)
        : await translationService.translateI18nString(fieldValue);
      logger.debug("Translation result", {
        translated,
        keys: Object.keys(translated),
      });
      return translated;
    }
    // If it's an empty object, return as is
    else if (
      typeof fieldValue === "object" &&
      !Array.isArray(fieldValue) &&
      Object.keys(fieldValue).length === 0
    ) {
      return fieldValue;
    }
  } catch (error: any) {
    logger.error("Error in translateField", {
      error: error.message,
      stack: error.stack,
      fieldValue,
      isText,
    });
    // If translation fails and it's a string, return I18n object with English only
    if (typeof fieldValue === "string" && fieldValue.trim()) {
      return { en: fieldValue };
    }
    // If it's already an object with en, return as is
    if (
      typeof fieldValue === "object" &&
      !Array.isArray(fieldValue) &&
      fieldValue.en
    ) {
      return fieldValue;
    }
  }

  // Fallback: return original value or empty object
  return fieldValue;
};

/**
 * Prepare Membership CMS data for translation - handles all text fields including membershipBenefits array
 */
export async function prepareMembershipCmsDataForTranslation(
  data: Record<string, any>
): Promise<Record<string, any>> {
  const result = { ...data };

  try {
    // Define I18nString fields (top level)
    const i18nStringFields = ["heading", "ctaButtonText"];

    // Define I18nText fields (top level)
    const i18nTextFields = ["description", "note"];

    // Process I18nString fields
    for (const field of i18nStringFields) {
      const fieldValue = result[field];
      if (fieldValue !== undefined && fieldValue !== null) {
        const translatedValue = await translateField(fieldValue, false);
        if (translatedValue !== undefined) {
          result[field] = translatedValue;
        }
      }
    }

    // Process I18nText fields
    for (const field of i18nTextFields) {
      const fieldValue = result[field];
      if (fieldValue !== undefined && fieldValue !== null) {
        const translatedValue = await translateField(fieldValue, true);
        if (translatedValue !== undefined) {
          result[field] = translatedValue;
        }
      }
    }

    // Handle membershipBenefits array (special case)
    // First, parse if it's a JSON string (from form-data)
    if (result.membershipBenefits !== undefined && result.membershipBenefits !== null) {
      // If it's a string, try to parse it as JSON
      if (typeof result.membershipBenefits === "string") {
        try {
          const parsed = JSON.parse(result.membershipBenefits.trim());
          if (Array.isArray(parsed)) {
            result.membershipBenefits = parsed;
          }
        } catch (error: any) {
          logger.warn("Failed to parse membershipBenefits as JSON string", {
            error: error.message,
            value: result.membershipBenefits,
          });
          // If parsing fails, set to empty array
          result.membershipBenefits = [];
        }
      }
    }

    if (
      result.membershipBenefits &&
      Array.isArray(result.membershipBenefits)
    ) {
      logger.info("Processing membershipBenefits array for translation", {
        count: result.membershipBenefits.length,
      });

      const translatedBenefits = await Promise.all(
        result.membershipBenefits.map(async (benefit: any, index: number) => {
          const translatedBenefit = { ...benefit };

          // Translate title (I18nString)
          if (translatedBenefit.title !== undefined && translatedBenefit.title !== null) {
            try {
              logger.info(`Translating benefit ${index} title`, {
                title: translatedBenefit.title,
                type: typeof translatedBenefit.title,
                isObject: typeof translatedBenefit.title === "object",
                keys: typeof translatedBenefit.title === "object" ? Object.keys(translatedBenefit.title) : [],
              });
              
              const translatedTitle = await translateField(
                translatedBenefit.title,
                false
              );
              
              logger.info(`Translated benefit ${index} title result`, {
                translatedTitle,
                type: typeof translatedTitle,
                isObject: typeof translatedTitle === "object",
                keys: typeof translatedTitle === "object" ? Object.keys(translatedTitle) : [],
                hasAllLanguages: typeof translatedTitle === "object" && translatedTitle ? 
                  ["en", "nl", "de", "fr", "es"].every(lang => translatedTitle[lang]) : false,
              });
              
              // Ensure we have an I18n object (fallback to English only if translation fails)
              if (translatedTitle !== undefined && translatedTitle !== null) {
                translatedBenefit.title = translatedTitle;
              } else if (typeof translatedBenefit.title === "string") {
                // If translation failed but we have a string, create I18n object with English
                translatedBenefit.title = { en: translatedBenefit.title };
                logger.warn(`Translation returned undefined for benefit ${index} title, using English only`);
              } else if (typeof translatedBenefit.title === "object" && translatedBenefit.title.en) {
                // If translation failed but we have an object with en, keep it
                logger.warn(`Translation returned undefined for benefit ${index} title, keeping original object`);
              }
            } catch (error: any) {
              logger.error("Failed to translate benefit title", {
                error: error.message,
                stack: error.stack,
                title: translatedBenefit.title,
                index,
              });
              // Fallback: convert string to I18n object with English only
              if (typeof translatedBenefit.title === "string") {
                translatedBenefit.title = { en: translatedBenefit.title };
              } else if (typeof translatedBenefit.title === "object" && translatedBenefit.title.en) {
                // Keep the object if it has en
                logger.warn(`Keeping original title object after translation error`);
              }
            }
          } else {
            translatedBenefit.title = {};
          }

          // Translate subtitle (I18nString)
          if (translatedBenefit.subtitle !== undefined && translatedBenefit.subtitle !== null) {
            try {
              logger.info(`Translating benefit ${index} subtitle`, {
                subtitle: translatedBenefit.subtitle,
                type: typeof translatedBenefit.subtitle,
                isObject: typeof translatedBenefit.subtitle === "object",
                keys: typeof translatedBenefit.subtitle === "object" ? Object.keys(translatedBenefit.subtitle) : [],
              });
              
              const translatedSubtitle = await translateField(
                translatedBenefit.subtitle,
                false
              );
              
              logger.info(`Translated benefit ${index} subtitle result`, {
                translatedSubtitle,
                type: typeof translatedSubtitle,
                isObject: typeof translatedSubtitle === "object",
                keys: typeof translatedSubtitle === "object" ? Object.keys(translatedSubtitle) : [],
                hasAllLanguages: typeof translatedSubtitle === "object" && translatedSubtitle ? 
                  ["en", "nl", "de", "fr", "es"].every(lang => translatedSubtitle[lang]) : false,
              });
              
              // Ensure we have an I18n object (fallback to English only if translation fails)
              if (translatedSubtitle !== undefined && translatedSubtitle !== null) {
                translatedBenefit.subtitle = translatedSubtitle;
              } else if (typeof translatedBenefit.subtitle === "string") {
                // If translation failed but we have a string, create I18n object with English
                translatedBenefit.subtitle = { en: translatedBenefit.subtitle };
                logger.warn(`Translation returned undefined for benefit ${index} subtitle, using English only`);
              } else if (typeof translatedBenefit.subtitle === "object" && translatedBenefit.subtitle.en) {
                // If translation failed but we have an object with en, keep it
                logger.warn(`Translation returned undefined for benefit ${index} subtitle, keeping original object`);
              }
            } catch (error: any) {
              logger.error("Failed to translate benefit subtitle", {
                error: error.message,
                stack: error.stack,
                subtitle: translatedBenefit.subtitle,
                index,
              });
              // Fallback: convert string to I18n object with English only
              if (typeof translatedBenefit.subtitle === "string") {
                translatedBenefit.subtitle = { en: translatedBenefit.subtitle };
              } else if (typeof translatedBenefit.subtitle === "object" && translatedBenefit.subtitle.en) {
                // Keep the object if it has en
                logger.warn(`Keeping original subtitle object after translation error`);
              }
            }
          } else {
            translatedBenefit.subtitle = {};
          }

          return translatedBenefit;
        })
      );

      result.membershipBenefits = translatedBenefits;
      logger.info("Completed translation of membershipBenefits array", {
        count: translatedBenefits.length,
        firstBenefit: translatedBenefits[0],
        firstBenefitTitle: translatedBenefits[0]?.title,
        firstBenefitTitleKeys: translatedBenefits[0]?.title ? Object.keys(translatedBenefits[0].title) : [],
      });
    }

    logger.info(
      "Membership CMS data prepared for translation - all text fields processed",
      {
        membershipBenefitsCount: result.membershipBenefits?.length || 0,
        translationServiceEnabled: translationService.isEnabled(),
      }
    );
  } catch (error: any) {
    logger.error("Error preparing Membership CMS data for translation", {
      error: error.message,
      stack: error.stack,
    });
    // Return original data if translation fails
    return data;
  }

  return result;
}

