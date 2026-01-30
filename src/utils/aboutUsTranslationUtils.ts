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

  // If it's already an I18n object with English, translate it
  if (
    typeof fieldValue === "object" &&
    !Array.isArray(fieldValue) &&
    fieldValue.en
  ) {
    return isText
      ? await translationService.translateI18nText(fieldValue)
      : await translationService.translateI18nString(fieldValue);
  }
  // If it's a plain string, convert to I18n and translate
  else if (typeof fieldValue === "string" && fieldValue.trim()) {
    return isText
      ? await translationService.translateI18nText(fieldValue)
      : await translationService.translateI18nString(fieldValue);
  }

  return fieldValue;
};

/**
 * Prepare About Us data for translation - handles all text fields including timeline events arrays
 */
export async function prepareAboutUsDataForTranslation(
  data: Record<string, any>
): Promise<Record<string, any>> {
  const result = { ...data };

  try {
    // Define I18nString fields (nested paths)
    const i18nStringFields = [
      "banner.banner_title",
      "banner.banner_button_text",
      "founderNote.headline",
      "meetBrains.meet_brains_title",
      "timeline.timeline_section_title",
      "people.title",
    ];

    // Define I18nText fields (nested paths)
    const i18nTextFields = [
      "banner.banner_description",
      "founderNote.description",
      "meetBrains.meet_brains_subtitle",
      "timeline.timeline_section_description",
      "people.subtitle",
    ];

    // Process I18nString fields
    for (const field of i18nStringFields) {
      const fieldValue = getNestedValue(result, field);
      if (fieldValue !== undefined && fieldValue !== null) {
        const translatedValue = await translateField(fieldValue, false);
        if (translatedValue !== undefined) {
          setNestedValue(result, field, translatedValue);
        }
      }
    }

    // Process I18nText fields
    for (const field of i18nTextFields) {
      const fieldValue = getNestedValue(result, field);
      if (fieldValue !== undefined && fieldValue !== null) {
        const translatedValue = await translateField(fieldValue, true);
        if (translatedValue !== undefined) {
          setNestedValue(result, field, translatedValue);
        }
      }
    }

    // Handle timeline events array (special case)
    if (
      result.timeline &&
      result.timeline.timeline_events &&
      Array.isArray(result.timeline.timeline_events)
    ) {
      const translatedEvents = await Promise.all(
        result.timeline.timeline_events.map(async (event: any) => {
          const translatedEvent = { ...event };

          // Translate title (I18nString)
          if (translatedEvent.title) {
            translatedEvent.title = await translateField(
              translatedEvent.title,
              false
            );
          }

          // Translate description (I18nText)
          if (translatedEvent.description) {
            translatedEvent.description = await translateField(
              translatedEvent.description,
              true
            );
          }

          return translatedEvent;
        })
      );

      result.timeline.timeline_events = translatedEvents;
    }

    logger.info("About Us data prepared for translation - all text fields processed");
  } catch (error: any) {
    logger.error("Error preparing About Us data for translation", {
      error: error.message,
      stack: error.stack,
    });
    // Return original data if translation fails
    return data;
  }

  return result;
}

