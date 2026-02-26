import { translationService } from "@/services/translationService";
import { logger } from "@/utils/logger";
import { I18nStringType, I18nTextType } from "@/models/common.model";

/**
 * Translate an array of strings to I18n array
 * Each string in the array becomes an I18n object
 */
async function translateStringArray(
  stringArray: (string | I18nStringType)[]
): Promise<I18nStringType[]> {
  if (!Array.isArray(stringArray) || stringArray.length === 0) {
    return [];
  }

  // Translate all strings in parallel
  const translatedArrays = await Promise.all(
    stringArray.map(async (str) => {
      if (typeof str === "string" && str.trim()) {
        return await translationService.translateI18nString(str);
      }
      // If already I18n object, return as is or translate if incomplete
      if (typeof str === "object" && str !== null && !Array.isArray(str)) {
        const i18nObj = str as I18nStringType;
        if (i18nObj.en) {
          return await translationService.translateI18nString(i18nObj);
        }
      }
      return { en: String(str || "") };
    })
  );

  return translatedArrays;
}

/**
 * Prepare product data for translation - handles all text fields including arrays and nested structures
 */
export async function prepareProductDataForTranslation(
  data: Record<string, any>
): Promise<Record<string, any>> {
  const result = { ...data };

  try {
    // 1. Translate simple I18nString fields
    if (result.title && typeof result.title === "string" && result.title.trim()) {
      result.title = await translationService.translateI18nString(result.title);
    }

    // 2. Translate simple I18nText fields
    const textFields = ["description", "nutritionInfo", "howToUse"];
    for (const field of textFields) {
      if (result[field] && typeof result[field] === "string" && result[field].trim()) {
        result[field] = await translationService.translateI18nText(result[field]);
      }
    }

    // 3. Translate shortDescription (I18nString)
    if (
      result.shortDescription &&
      typeof result.shortDescription === "string" &&
      result.shortDescription.trim()
    ) {
      result.shortDescription = await translationService.translateI18nString(
        result.shortDescription
      );
    }

    // 4. Translate benefits array (array of I18nString)
    if (result.benefits && Array.isArray(result.benefits) && result.benefits.length > 0) {
      result.benefits = await translateStringArray(result.benefits);
    }

    // 5. Translate healthGoals array (array of I18nString)
    if (
      result.healthGoals &&
      Array.isArray(result.healthGoals) &&
      result.healthGoals.length > 0
    ) {
      result.healthGoals = await translateStringArray(result.healthGoals);
    }

    // 6. Translate comparisonSection
    if (result.comparisonSection && typeof result.comparisonSection === "object") {
      const comparison = { ...result.comparisonSection };

      // Translate title
      if (comparison.title && typeof comparison.title === "string" && comparison.title.trim()) {
        comparison.title = await translationService.translateI18nString(comparison.title);
      }

      // Translate columns array
      if (
        comparison.columns &&
        Array.isArray(comparison.columns) &&
        comparison.columns.length > 0
      ) {
        comparison.columns = await translateStringArray(comparison.columns);
      }

      // Translate rows (array of objects with label)
      if (comparison.rows && Array.isArray(comparison.rows) && comparison.rows.length > 0) {
        comparison.rows = await Promise.all(
          comparison.rows.map(async (row: any) => {
            if (row.label && typeof row.label === "string" && row.label.trim()) {
              return {
                ...row,
                label: await translationService.translateI18nString(row.label),
              };
            }
            return row;
          })
        );
      }

      result.comparisonSection = comparison;
    }

    // 7. Translate specification
    if (result.specification && typeof result.specification === "object") {
      const spec = { ...result.specification };

      // Translate main_title
      if (spec.main_title && typeof spec.main_title === "string" && spec.main_title.trim()) {
        spec.main_title = await translationService.translateI18nString(spec.main_title);
      }

      // Translate items array (array of objects with title and descr)
      if (spec.items && Array.isArray(spec.items) && spec.items.length > 0) {
        spec.items = await Promise.all(
          spec.items.map(async (item: any) => {
            const translatedItem = { ...item };

            // Translate title
            if (item.title && typeof item.title === "string" && item.title.trim()) {
              translatedItem.title = await translationService.translateI18nString(item.title);
            }

            // Translate descr
            if (item.descr && typeof item.descr === "string" && item.descr.trim()) {
              translatedItem.descr = await translationService.translateI18nText(item.descr);
            }

            return translatedItem;
          })
        );
      }

      result.specification = spec;
    }

    // 8. Translate sachetPrices features (nested arrays)
    if (result.sachetPrices && typeof result.sachetPrices === "object") {
      const sachetPrices = { ...result.sachetPrices };

      // Translate features in subscription periods
      const periods = ["thirtyDays", "sixtyDays", "ninetyDays", "oneEightyDays"];
      for (const period of periods) {
        if (
          sachetPrices[period] &&
          sachetPrices[period].features &&
          Array.isArray(sachetPrices[period].features) &&
          sachetPrices[period].features.length > 0
        ) {
          sachetPrices[period] = {
            ...sachetPrices[period],
            features: await translateStringArray(sachetPrices[period].features),
          };
        }
      }

      result.sachetPrices = sachetPrices;
    }

    // 9. Translate standupPouchPrice features (plan_0 / plan_1)
    if (result.standupPouchPrice && typeof result.standupPouchPrice === "object") {
      const standupPouch = { ...result.standupPouchPrice } as any;
      if (standupPouch.plan_0?.features && Array.isArray(standupPouch.plan_0.features) && standupPouch.plan_0.features.length > 0) {
        standupPouch.plan_0 = { ...standupPouch.plan_0, features: await translateStringArray(standupPouch.plan_0.features) };
      }
      if (standupPouch.plan_1?.features && Array.isArray(standupPouch.plan_1.features) && standupPouch.plan_1.features.length > 0) {
        standupPouch.plan_1 = { ...standupPouch.plan_1, features: await translateStringArray(standupPouch.plan_1.features) };
      }
      result.standupPouchPrice = standupPouch;
    }

    logger.info("Product data prepared for translation - all text fields processed");
  } catch (error: any) {
    logger.error("Error preparing product data for translation", {
      error: error.message,
      stack: error.stack,
    });
    // Return original data if translation fails
    return data;
  }

  return result;
}

