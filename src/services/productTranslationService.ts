import { googleTranslateService, TranslateLanguageCode } from "./googleTranslateService";
import { logger } from "../utils/logger";
import { SupportedLanguage, DEFAULT_LANGUAGE } from "../models/common.model";

/**
 * In-memory cache for translations
 * Key format: `${text}_${targetLanguage}`
 */
interface CacheEntry {
  translation: string;
  timestamp: number;
}

const translationCache = new Map<string, CacheEntry>();
const CACHE_MAX_SIZE = 10000; // Max 10k cached translations
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached translation or null if not found/expired
 */
function getCachedTranslation(text: string, targetLanguage: TranslateLanguageCode): string | null {
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
function cacheTranslation(text: string, targetLanguage: TranslateLanguageCode, translation: string): void {
  // If cache is too large, remove oldest entries
  if (translationCache.size >= CACHE_MAX_SIZE) {
    const entries = Array.from(translationCache.entries());
    // Remove 20% of oldest entries
    entries
      .sort((a, b) => (a[1] as CacheEntry).timestamp - (b[1] as CacheEntry).timestamp)
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
 * Map SupportedLanguage to Google Translate language code
 */
function mapLanguageToTranslateCode(lang: SupportedLanguage): TranslateLanguageCode {
  const mapping: Record<SupportedLanguage, TranslateLanguageCode> = {
    en: "en",
    nl: "nl",
    de: "de",
    fr: "fr",
    es: "es",
  };
  return mapping[lang] || "en";
}

/**
 * Translate a product and all its nested fields
 */
export async function translateProduct(
  product: any,
  targetLanguage: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<any> {
  // If target language is English, return original product
  if (targetLanguage === "en") {
    return product;
  }

  const translateCode = mapLanguageToTranslateCode(targetLanguage);
  
  try {
    // Extract English text fields from product
    const textFields: {
      title?: string;
      description?: string;
      shortDescription?: string;
      nutritionInfo?: string;
      howToUse?: string;
      benefits?: string[];
      healthGoals?: string[];
    } = {};

    // Get English text from I18n objects
    if (product.title) {
      textFields.title = typeof product.title === "string" 
        ? product.title 
        : product.title.en || "";
    }
    if (product.description) {
      textFields.description = typeof product.description === "string"
        ? product.description
        : product.description.en || "";
    }
    if (product.shortDescription) {
      textFields.shortDescription = typeof product.shortDescription === "string"
        ? product.shortDescription
        : product.shortDescription.en || "";
    }
    if (product.nutritionInfo) {
      textFields.nutritionInfo = typeof product.nutritionInfo === "string"
        ? product.nutritionInfo
        : product.nutritionInfo.en || "";
    }
    if (product.howToUse) {
      textFields.howToUse = typeof product.howToUse === "string"
        ? product.howToUse
        : product.howToUse.en || "";
    }
    if (product.benefits && Array.isArray(product.benefits)) {
      textFields.benefits = product.benefits.map((benefit: any) => {
        return typeof benefit === "string" ? benefit : (benefit.en || benefit || "");
      });
    }
    if (product.healthGoals && Array.isArray(product.healthGoals)) {
      textFields.healthGoals = product.healthGoals.map((goal: any) => {
        return typeof goal === "string" ? goal : (goal.en || goal || "");
      });
    }

    // Translate all text fields in parallel
    const translationPromises: Promise<any>[] = [];
    if (textFields.title) {
      translationPromises.push(
        googleTranslateService.translateText(textFields.title, translateCode)
      );
    } else {
      translationPromises.push(Promise.resolve(""));
    }
    if (textFields.description) {
      translationPromises.push(
        googleTranslateService.translateText(textFields.description, translateCode)
      );
    } else {
      translationPromises.push(Promise.resolve(""));
    }
    if (textFields.nutritionInfo) {
      translationPromises.push(
        googleTranslateService.translateText(textFields.nutritionInfo, translateCode)
      );
    } else {
      translationPromises.push(Promise.resolve(""));
    }
    if (textFields.howToUse) {
      translationPromises.push(
        googleTranslateService.translateText(textFields.howToUse, translateCode)
      );
    } else {
      translationPromises.push(Promise.resolve(""));
    }
    if (textFields.benefits && textFields.benefits.length > 0) {
      translationPromises.push(
        googleTranslateService.translateTexts(textFields.benefits, translateCode)
      );
    } else {
      translationPromises.push(Promise.resolve([]));
    }
    if (textFields.shortDescription) {
      translationPromises.push(
        googleTranslateService.translateText(textFields.shortDescription, translateCode)
      );
    } else {
      translationPromises.push(Promise.resolve(""));
    }
    if (textFields.healthGoals && textFields.healthGoals.length > 0) {
      translationPromises.push(
        googleTranslateService.translateTexts(textFields.healthGoals, translateCode)
      );
    } else {
      translationPromises.push(Promise.resolve([]));
    }

    const [
      translatedTitle,
      translatedDescription,
      translatedNutritionInfo,
      translatedHowToUse,
      translatedBenefits,
      translatedShortDescription,
      translatedHealthGoals,
    ] = await Promise.all(translationPromises);

    // Translate ingredients
    let translatedIngredients = product.ingredients || [];
    if (Array.isArray(translatedIngredients) && translatedIngredients.length > 0) {
      const ingredientTranslationPromises = translatedIngredients.map(
        async (ingredient: any) => {
          if (!ingredient) return ingredient;
          
          const ingredientName = typeof ingredient.name === "string"
            ? ingredient.name
            : ingredient.name?.en || "";
          const ingredientDescription = typeof ingredient.description === "string"
            ? ingredient.description
            : ingredient.description?.en || "";

          const [translatedIngredientName, translatedIngredientDescription] =
            await Promise.all([
              ingredientName
                ? googleTranslateService.translateText(ingredientName, translateCode)
                : Promise.resolve(""),
              ingredientDescription
                ? googleTranslateService.translateText(
                    ingredientDescription,
                    translateCode
                  )
                : Promise.resolve(""),
            ]);

          return {
            ...ingredient,
            name: translatedIngredientName || ingredientName,
            description: translatedIngredientDescription || ingredientDescription,
          };
        }
      );

      translatedIngredients = await Promise.all(ingredientTranslationPromises);
    }

    // Translate categories
    let translatedCategories = product.categories || [];
    if (Array.isArray(translatedCategories) && translatedCategories.length > 0) {
      const categoryTranslationPromises = translatedCategories.map(
        async (category: any) => {
          if (!category) return category;

          const categoryName = typeof category.name === "string"
            ? category.name
            : category.name?.en || "";
          const categoryDescription = typeof category.description === "string"
            ? category.description
            : category.description?.en || "";

          const [translatedCategoryName, translatedCategoryDescription] =
            await Promise.all([
              categoryName
                ? googleTranslateService.translateText(categoryName, translateCode)
                : Promise.resolve(""),
              categoryDescription
                ? googleTranslateService.translateText(
                    categoryDescription,
                    translateCode
                  )
                : Promise.resolve(""),
            ]);

          return {
            ...category,
            name: translatedCategoryName || categoryName,
            description:
              translatedCategoryDescription || categoryDescription,
          };
        }
      );

      translatedCategories = await Promise.all(categoryTranslationPromises);
    }

    // Translate FAQs
    let translatedFaqs = product.faqs || [];
    if (Array.isArray(translatedFaqs) && translatedFaqs.length > 0) {
      const faqTranslationPromises = translatedFaqs.map(async (faq: any) => {
        if (!faq) return faq;

        const faqQuestion = typeof faq.question === "string"
          ? faq.question
          : faq.question?.en || "";
        const faqAnswer = typeof faq.answer === "string"
          ? faq.answer
          : faq.answer?.en || "";

        const [translatedFaqQuestion, translatedFaqAnswer] = await Promise.all([
          faqQuestion
            ? googleTranslateService.translateText(faqQuestion, translateCode)
            : Promise.resolve(""),
          faqAnswer
            ? googleTranslateService.translateText(faqAnswer, translateCode)
            : Promise.resolve(""),
        ]);

        return {
          ...faq,
          question: translatedFaqQuestion || faqQuestion,
          answer: translatedFaqAnswer || faqAnswer,
        };
      });

      translatedFaqs = await Promise.all(faqTranslationPromises);
    }

    // Translate productIngredientDetails (if present)
    let translatedProductIngredientDetails = product.productIngredientDetails || [];
    if (Array.isArray(translatedProductIngredientDetails) && translatedProductIngredientDetails.length > 0) {
      const ingredientDetailPromises = translatedProductIngredientDetails.map(async (ingredient: any) => {
        if (!ingredient) return ingredient;

        const ingredientName = typeof ingredient.name === "string"
          ? ingredient.name
          : ingredient.name?.en || "";
        const ingredientDescription = typeof ingredient.description === "string"
          ? ingredient.description
          : ingredient.description?.en || "";

        const [translatedIngredientName, translatedIngredientDescription] = await Promise.all([
          ingredientName
            ? googleTranslateService.translateText(ingredientName, translateCode)
            : Promise.resolve(""),
          ingredientDescription
            ? googleTranslateService.translateText(ingredientDescription, translateCode)
            : Promise.resolve(""),
        ]);

        return {
          ...ingredient,
          name: translatedIngredientName || ingredientName,
          description: translatedIngredientDescription || ingredientDescription,
        };
      });

      translatedProductIngredientDetails = await Promise.all(ingredientDetailPromises);
    }

    // Translate comparisonSection
    let translatedComparisonSection = product.comparisonSection;
    if (translatedComparisonSection) {
      const comparisonTitle = translatedComparisonSection.title || "";
      const comparisonColumns = translatedComparisonSection.columns || [];
      const comparisonRows = translatedComparisonSection.rows || [];

      const [translatedComparisonTitle, translatedComparisonColumns] = await Promise.all([
        comparisonTitle
          ? googleTranslateService.translateText(comparisonTitle, translateCode)
          : Promise.resolve(""),
        comparisonColumns.length > 0
          ? googleTranslateService.translateTexts(comparisonColumns, translateCode)
          : Promise.resolve([]),
      ]);

      // Translate row labels
      const rowLabelPromises = comparisonRows.map(async (row: any) => {
        if (!row || !row.label) return row;
        const translatedLabel = await googleTranslateService.translateText(row.label, translateCode);
        return {
          ...row,
          label: translatedLabel || row.label,
        };
      });
      const translatedComparisonRows = await Promise.all(rowLabelPromises);

      translatedComparisonSection = {
        ...translatedComparisonSection,
        title: translatedComparisonTitle || comparisonTitle,
        columns: Array.isArray(translatedComparisonColumns) && translatedComparisonColumns.length > 0
          ? translatedComparisonColumns
          : comparisonColumns,
        rows: translatedComparisonRows,
      };
    }

    // Translate specification
    let translatedSpecification = product.specification;
    if (translatedSpecification) {
      const specTitle = translatedSpecification.main_title || "";
      const specItems = translatedSpecification.items || [];

      const translatedSpecTitle = specTitle
        ? await googleTranslateService.translateText(specTitle, translateCode)
        : "";

      // Translate specification items
      const specItemPromises = specItems.map(async (item: any) => {
        if (!item) return item;
        const itemTitle = item.title || "";
        const itemDescr = item.descr || "";

        const [translatedItemTitle, translatedItemDescr] = await Promise.all([
          itemTitle
            ? googleTranslateService.translateText(itemTitle, translateCode)
            : Promise.resolve(""),
          itemDescr
            ? googleTranslateService.translateText(itemDescr, translateCode)
            : Promise.resolve(""),
        ]);

        return {
          ...item,
          title: translatedItemTitle || itemTitle,
          descr: translatedItemDescr || itemDescr,
        };
      });

      const translatedSpecItems = await Promise.all(specItemPromises);

      translatedSpecification = {
        ...translatedSpecification,
        main_title: translatedSpecTitle || specTitle,
        items: translatedSpecItems,
      };
    }

    // Translate sachetPrices features and standupPouchPrice features
    let translatedSachetPrices = product.sachetPrices;
    if (translatedSachetPrices) {
      const priceFields = ["thirtyDays", "sixtyDays", "ninetyDays", "oneEightyDays"];
      for (const field of priceFields) {
        if (translatedSachetPrices[field] && Array.isArray(translatedSachetPrices[field].features)) {
          const features = translatedSachetPrices[field].features;
          const translatedFeatures = await googleTranslateService.translateTexts(features, translateCode);
          translatedSachetPrices[field] = {
            ...translatedSachetPrices[field],
            features: Array.isArray(translatedFeatures) && translatedFeatures.length > 0
              ? translatedFeatures
              : features,
          };
        }
      }
    }

    let translatedStandupPouchPrice = product.standupPouchPrice;
    if (translatedStandupPouchPrice) {
      const pouchFields = ["count30", "count60"];
      for (const field of pouchFields) {
        if (translatedStandupPouchPrice[field] && Array.isArray(translatedStandupPouchPrice[field].features)) {
          const features = translatedStandupPouchPrice[field].features;
          const translatedFeatures = await googleTranslateService.translateTexts(features, translateCode);
          translatedStandupPouchPrice[field] = {
            ...translatedStandupPouchPrice[field],
            features: Array.isArray(translatedFeatures) && translatedFeatures.length > 0
              ? translatedFeatures
              : features,
          };
        }
      }
    }

    // Build translated product (keep all non-text fields unchanged)
    const translatedProduct = {
      ...product,
      title: translatedTitle || textFields.title || product.title,
      description: translatedDescription || textFields.description || product.description,
      shortDescription: translatedShortDescription || textFields.shortDescription || product.shortDescription,
      nutritionInfo:
        translatedNutritionInfo || textFields.nutritionInfo || product.nutritionInfo,
      howToUse: translatedHowToUse || textFields.howToUse || product.howToUse,
      benefits: Array.isArray(translatedBenefits) && translatedBenefits.length > 0
        ? translatedBenefits
        : product.benefits,
      healthGoals: Array.isArray(translatedHealthGoals) && translatedHealthGoals.length > 0
        ? translatedHealthGoals
        : product.healthGoals,
      ingredients: translatedIngredients,
      categories: translatedCategories,
      faqs: translatedFaqs,
      productIngredientDetails: translatedProductIngredientDetails,
      comparisonSection: translatedComparisonSection,
      specification: translatedSpecification,
      sachetPrices: translatedSachetPrices,
      standupPouchPrice: translatedStandupPouchPrice,
    };

    return translatedProduct;
  } catch (error: any) {
    logger.error(
      `[Product Translation] Error translating product: ${error.message}`,
      error
    );
    // Return original product if translation fails
    return product;
  }
}

/**
 * Translate multiple products (optimized with batching)
 */
export async function translateProducts(
  products: any[],
  targetLanguage: SupportedLanguage = DEFAULT_LANGUAGE
): Promise<any[]> {
  // If target language is English, return original products
  if (targetLanguage === "en" || products.length === 0) {
    return products;
  }

  try {
    const translateCode = mapLanguageToTranslateCode(targetLanguage);
    
    // Collect all texts to translate in batches
    const allTexts: string[] = [];
    const textMap: Map<string, { productIndex: number; field: string; originalValue: any }[]> = new Map();
    
    // Extract all texts from all products
    products.forEach((product, productIndex) => {
      // Title
      const title = typeof product.title === "string" ? product.title : product.title?.en || "";
      if (title) {
        const key = `title_${productIndex}`;
        if (!textMap.has(title)) textMap.set(title, []);
        textMap.get(title)!.push({ productIndex, field: "title", originalValue: title });
        if (!allTexts.includes(title)) allTexts.push(title);
      }
      
      // Description
      const description = typeof product.description === "string" ? product.description : product.description?.en || "";
      if (description) {
        if (!textMap.has(description)) textMap.set(description, []);
        textMap.get(description)!.push({ productIndex, field: "description", originalValue: description });
        if (!allTexts.includes(description)) allTexts.push(description);
      }
      
      // Other fields similarly...
    });
    
    // Batch translate all unique texts at once
    const translatedTextsMap = new Map<string, string>();
    if (allTexts.length > 0) {
      const translations = await googleTranslateService.translateTexts(allTexts, translateCode);
      allTexts.forEach((text, index) => {
        translatedTextsMap.set(text, translations[index] || text);
      });
    }
    
    // Apply translations to products
    const translatedProducts = products.map((product, productIndex) => {
      const translated = { ...product };
      
      // Apply cached translations
      const title = typeof product.title === "string" ? product.title : product.title?.en || "";
      if (title && translatedTextsMap.has(title)) {
        translated.title = translatedTextsMap.get(title);
      }
      
      const description = typeof product.description === "string" ? product.description : product.description?.en || "";
      if (description && translatedTextsMap.has(description)) {
        translated.description = translatedTextsMap.get(description);
      }
      
      // For now, use the original translateProduct for nested fields (ingredients, categories, FAQs)
      // This is still fast because of caching
      return translated;
    });
    
    // Translate nested fields (ingredients, categories, FAQs) in batches to avoid overwhelming API
    // Optimized: Increased batch size and reduced delay for faster response
    const BATCH_SIZE = 5; // Process 5 products at a time (increased from 3)
    const BATCH_DELAY = 200; // 200ms delay between batches (reduced from 500ms)
    
    const finalProducts: any[] = [];
    
    for (let i = 0; i < translatedProducts.length; i += BATCH_SIZE) {
      const batch = translatedProducts.slice(i, i + BATCH_SIZE);
      
      // Translate batch in parallel (all at once for speed)
      const batchResults = await Promise.all(
        batch.map((product) => translateProduct(product, targetLanguage))
      );
      
      finalProducts.push(...batchResults);
      
      // Add minimal delay between batches only if not the last batch
      if (i + BATCH_SIZE < translatedProducts.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    return finalProducts;
  } catch (error: any) {
    logger.error(
      `[Product Translation] Error translating products: ${error.message}`,
      error
    );
    // Return original products if translation fails
    return products;
  }
}

