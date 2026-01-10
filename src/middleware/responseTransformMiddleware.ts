import { Request, Response, NextFunction } from "express";
import {
  transformI18nObject,
  getUserLanguageCode,
} from "@/utils/translationUtils";
import { User } from "@/models/core";
import { SupportedLanguage, DEFAULT_LANGUAGE } from "@/models/common.model";
import { logger } from "@/utils/logger";

/**
 * Authenticated Request Interface
 */
interface AuthenticatedRequest extends Request {
  user?: {
    _id?: string;
    id?: string;
    userId?: string;
    [key: string]: any;
  };
  userLanguage?: SupportedLanguage; // Cached user language
}

/**
 * Translation field mappings for each model
 */
const MODEL_I18N_FIELDS: Record<
  string,
  { i18nString: string[]; i18nText: string[] }
> = {
  aboutUs: {
    i18nString: [
      "banner_title",
      "banner_button_text",
      "founder_name",
      "founder_position",
      "meet_brains_title",
      "timeline_section_title",
      "title",
      "subtitle",
    ],
    i18nText: [
      "banner_description",
      "founder_heading",
      "founder_description",
      "note",
      "meet_brains_subtitle",
      "description",
      "timeline_section_description",
    ],
  },
  blogs: {
    i18nString: ["title", "description"],
    i18nText: [],
  },
  blogBanners: {
    i18nString: ["heading"],
    i18nText: ["description"],
  },
  blogCategories: {
    i18nString: ["title"],
    i18nText: [],
  },
  faqs: {
    i18nString: ["question"],
    i18nText: ["answer"],
  },
  faqCategories: {
    i18nString: ["title"],
    i18nText: [],
  },
  landingPage: {
    i18nString: [
      "label",
      "title",
      "highlightedText",
      "subTitle",
      "title",
      "subTitle",
      "label",
      "title",
      "subTitle",
      "title",
      "question",
      "title",
    ],
    i18nText: [
      "description",
      "description",
      "description",
      "description",
      "description",
      "description",
      "answer",
      "description",
    ],
  },
  ourTeamPage: {
    i18nString: ["title"],
    i18nText: ["subtitle"],
  },
  pages: {
    i18nString: ["title"],
    i18nText: ["content"],
  },
  reviews: {
    i18nString: ["title"],
    i18nText: ["content"],
  },
  staticPages: {
    i18nString: ["title"],
    i18nText: ["content"],
  },
  teamMembers: {
    i18nString: ["name", "designation"],
    i18nText: ["content"],
  },
  campaigns: {
    i18nString: ["title"],
    i18nText: ["description", "terms"],
  },
  categories: {
    i18nString: ["name"],
    i18nText: ["description"],
  },
  coupons: {
    i18nString: ["name", "description"],
    i18nText: [],
  },
  membershipPlans: {
    i18nString: ["shortDescription"],
    i18nText: ["description"],
  },
  productFaqs: {
    i18nString: ["question"],
    i18nText: ["answer"],
  },
  productIngredients: {
    i18nString: ["name"],
    i18nText: ["description"],
  },
  productVariants: {
    i18nString: ["name"],
    i18nText: [],
  },
  products: {
    i18nString: ["title"],
    i18nText: ["description", "nutritionInfo", "howToUse"],
  },
  generalSettings: {
    i18nString: ["tagline"],
    i18nText: [],
  },
  avatarJobs: {
    i18nString: [],
    i18nText: [],
  },
  experts: {
    i18nString: [],
    i18nText: ["bio"],
  },
};

/**
 * Get user language from request
 * Priority: 1. Cached language in req, 2. User's language from database, 3. Query parameter, 4. Default
 */
const getUserLanguage = async (
  req: AuthenticatedRequest
): Promise<SupportedLanguage> => {
  // Return cached language if available
  if (req.userLanguage) {
    return req.userLanguage;
  }

  // Check query parameter (for backward compatibility)
  const queryLang = req.query.lang as string;
  if (queryLang && ["en", "nl", "de", "fr", "es"].includes(queryLang)) {
    req.userLanguage = queryLang as SupportedLanguage;
    return req.userLanguage;
  }

  // Get user ID from request (prioritize req.userId set by authMiddleware)
  const userId =
    (req as any).userId || req.user?._id || req.user?.id || req.user?.userId;

  // Get user language from authenticated user
  if (userId) {
    try {
      const user = await User.findById(userId).select("language").lean();
      if (user && user.language) {
        const lang = getUserLanguageCode(user.language);
        req.userLanguage = lang; // Cache it

        // Log for debugging
        if (process.env.NODE_ENV === "development") {
          logger.debug("User language detected", {
            userId: userId.toString(),
            userLanguage: user.language,
            detectedLang: lang,
          });
        }

        return lang;
      } else {
        // Log if user found but no language set
        if (process.env.NODE_ENV === "development") {
          logger.debug("User found but no language set", {
            userId: userId.toString(),
            hasUser: !!user,
            userLanguage: user?.language || null,
          });
        }
      }
    } catch (error: any) {
      // If user fetch fails, continue with default
      if (process.env.NODE_ENV === "development") {
        logger.error("Failed to fetch user language", {
          userId: userId.toString(),
          error: error.message,
        });
      }
    }
  } else {
    // Log if no user ID found
    if (process.env.NODE_ENV === "development") {
      logger.debug("No user ID found in request", {
        hasUser: !!req.user,
        userId: req.user?._id || req.user?.id || null,
        reqUserId: (req as any).userId || null,
      });
    }
  }

  req.userLanguage = DEFAULT_LANGUAGE; // Cache default
  return DEFAULT_LANGUAGE;
};

/**
 * Middleware to transform I18n objects in responses to single language values
 * @param modelName - Name of the model
 */
export const transformResponseMiddleware = (modelName: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { i18nString, i18nText } = MODEL_I18N_FIELDS[modelName] || {
      i18nString: [],
      i18nText: [],
    };

    // If no I18n fields, skip transformation
    if (i18nString.length === 0 && i18nText.length === 0) {
      return next();
    }

    // Pre-fetch user language and cache it in req
    try {
      const detectedLang = await getUserLanguage(req);

      // Log for debugging
      if (process.env.NODE_ENV === "development") {
        logger.debug("Language detected for transformation", {
          model: modelName,
          language: detectedLang,
          userId: (req as any).userId || req.user?._id || "unknown",
        });
      }
    } catch (error: any) {
      // If language fetch fails, continue with default
      req.userLanguage = DEFAULT_LANGUAGE;
      if (process.env.NODE_ENV === "development") {
        logger.error("Failed to detect user language", {
          error: error.message,
          model: modelName,
        });
      }
    }

    // Store original methods
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);

    // Override status() to also intercept status().json() calls
    res.status = function (code: number): Response {
      const statusRes = originalStatus(code);
      const originalStatusJson = statusRes.json.bind(statusRes);

      // Override json on the status response
      statusRes.json = function (data: any): Response {
        try {
          const lang = req.userLanguage || DEFAULT_LANGUAGE;

          // Log for debugging
          if (process.env.NODE_ENV === "development") {
            logger.debug("Transforming response with status().json()", {
              model: modelName,
              language: lang,
              hasData: !!data,
              dataKeys:
                data && typeof data === "object" ? Object.keys(data) : [],
            });
          }

          // Transform the entire response object
          // Handle nested data structure: { success, message, data: { blogs, blogBanners }, pagination }
          let transformed = data;

          // If data has a nested structure with arrays, transform them
          if (data && typeof data === "object" && data.data) {
            // CRITICAL: Check if data.data is directly an array OR an array-like object (numeric keys)
            // This handles cases where data: result.landingPages (array) instead of data: { landingPages: [...] }
            let dataData = data.data;

            // Check if it's an array-like object (object with only numeric keys) and convert to array
            if (
              !Array.isArray(dataData) &&
              typeof dataData === "object" &&
              dataData !== null
            ) {
              const keys = Object.keys(dataData);
              const isArrayLikeObject =
                keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
              if (isArrayLikeObject) {
                // Convert object with numeric keys back to array
                dataData = Object.keys(dataData)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map((key) => dataData[key]);
              }
            }

            if (Array.isArray(dataData)) {
              // Transform the array of landing pages directly
              const landingPageFields = MODEL_I18N_FIELDS["landingPage"] || {
                i18nString: [],
                i18nText: [],
              };
              const transformedArray = transformI18nObject(
                dataData,
                lang,
                landingPageFields.i18nString,
                landingPageFields.i18nText
              );

              // Ensure it's still an array after transformation
              const finalArray = Array.isArray(transformedArray)
                ? transformedArray
                : Object.keys(transformedArray)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((key) => transformedArray[key]);

              // Create transformed response with array
              transformed = { ...data, data: finalArray };
            } else {
              // Create a copy to avoid mutating the original (data.data is an object)
              transformed = { ...data, data: { ...data.data } };
            }

            // Transform data.blogs if it exists
            if (
              transformed.data.blogs &&
              Array.isArray(transformed.data.blogs)
            ) {
              transformed.data.blogs = transformI18nObject(
                transformed.data.blogs,
                lang,
                MODEL_I18N_FIELDS["blogs"]?.i18nString || [],
                MODEL_I18N_FIELDS["blogs"]?.i18nText || []
              );
            }

            // Transform data.blogBanners if it exists
            if (
              transformed.data.blogBanners &&
              Array.isArray(transformed.data.blogBanners)
            ) {
              const blogBannerFields = MODEL_I18N_FIELDS["blogBanners"] || {
                i18nString: [],
                i18nText: [],
              };

              // Log for debugging
              if (process.env.NODE_ENV === "development") {
                logger.debug("Transforming blogBanners", {
                  count: transformed.data.blogBanners.length,
                  lang,
                  fields: blogBannerFields,
                  sampleBanner: transformed.data.blogBanners[0]
                    ? {
                        heading: transformed.data.blogBanners[0].heading,
                        description:
                          transformed.data.blogBanners[0].description,
                      }
                    : null,
                });
              }

              // Transform blogBanners array - this should convert I18n objects to single language strings
              const transformedBanners = transformI18nObject(
                transformed.data.blogBanners,
                lang,
                blogBannerFields.i18nString, // ["heading"]
                blogBannerFields.i18nText // ["description"]
              );

              // Ensure we're assigning the transformed array
              transformed.data.blogBanners = transformedBanners;

              // Log after transformation
              if (
                process.env.NODE_ENV === "development" &&
                transformed.data.blogBanners[0]
              ) {
                logger.debug("After transformation blogBanners", {
                  sampleBanner: {
                    heading: transformed.data.blogBanners[0].heading,
                    description: transformed.data.blogBanners[0].description,
                  },
                });
              }
            }

            // Transform other fields in data.data (like single blog)
            if (
              transformed.data.blog &&
              typeof transformed.data.blog === "object"
            ) {
              transformed.data.blog = transformI18nObject(
                transformed.data.blog,
                lang,
                i18nString,
                i18nText
              );
            }

            // Transform data.blogBanner if it exists (single blog banner)
            if (
              transformed.data.blogBanner &&
              typeof transformed.data.blogBanner === "object"
            ) {
              const blogBannerFields = MODEL_I18N_FIELDS["blogBanners"] || {
                i18nString: [],
                i18nText: [],
              };
              transformed.data.blogBanner = transformI18nObject(
                transformed.data.blogBanner,
                lang,
                blogBannerFields.i18nString, // ["heading"]
                blogBannerFields.i18nText // ["description"]
              );
            }

            // Transform data.category if it exists (single product category)
            if (
              transformed.data.category &&
              typeof transformed.data.category === "object"
            ) {
              const categoryFields = MODEL_I18N_FIELDS["categories"] || {
                i18nString: [],
                i18nText: [],
              };
              transformed.data.category = transformI18nObject(
                transformed.data.category,
                lang,
                categoryFields.i18nString, // ["name"]
                categoryFields.i18nText // ["description"]
              );
            }

            // Transform data.ingredient if it exists (single product ingredient)
            if (
              transformed.data.ingredient &&
              typeof transformed.data.ingredient === "object"
            ) {
              const ingredientFields = MODEL_I18N_FIELDS[
                "productIngredients"
              ] || {
                i18nString: [],
                i18nText: [],
              };
              transformed.data.ingredient = transformI18nObject(
                transformed.data.ingredient,
                lang,
                ingredientFields.i18nString, // ["name"]
                ingredientFields.i18nText // ["description"]
              );
            }

            // Transform data.testimonial if it exists (single product testimonial)
            if (
              transformed.data.testimonial &&
              typeof transformed.data.testimonial === "object"
            ) {
              const testimonialFields = MODEL_I18N_FIELDS[
                "productTestimonials"
              ] || {
                i18nString: [],
                i18nText: [],
              };
              transformed.data.testimonial = transformI18nObject(
                transformed.data.testimonial,
                lang,
                testimonialFields.i18nString,
                testimonialFields.i18nText
              );
            }

            // Transform data.testimonials if it exists (array of product testimonials)
            if (
              transformed.data.testimonials &&
              Array.isArray(transformed.data.testimonials)
            ) {
              const testimonialFields = MODEL_I18N_FIELDS[
                "productTestimonials"
              ] || {
                i18nString: [],
                i18nText: [],
              };
              const transformedTestimonials = transformI18nObject(
                transformed.data.testimonials,
                lang,
                testimonialFields.i18nString,
                testimonialFields.i18nText
              );
              // Ensure it's still an array
              transformed.data.testimonials = Array.isArray(
                transformedTestimonials
              )
                ? transformedTestimonials
                : Object.keys(transformedTestimonials)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((key) => transformedTestimonials[key]);
            }

            // Transform data.plan if it exists (single membership plan)
            if (
              transformed.data.plan &&
              typeof transformed.data.plan === "object"
            ) {
              const planFields = MODEL_I18N_FIELDS["membershipPlans"] || {
                i18nString: [],
                i18nText: [],
              };
              transformed.data.plan = transformI18nObject(
                transformed.data.plan,
                lang,
                planFields.i18nString, // ["shortDescription"]
                planFields.i18nText // ["description"]
              );
            }

            // Transform data.productFaq if it exists (single product FAQ)
            if (
              transformed.data.productFaq &&
              typeof transformed.data.productFaq === "object"
            ) {
              const productFaqFields = MODEL_I18N_FIELDS["productFaqs"] || {
                i18nString: [],
                i18nText: [],
              };
              transformed.data.productFaq = transformI18nObject(
                transformed.data.productFaq,
                lang,
                productFaqFields.i18nString, // ["question"]
                productFaqFields.i18nText // ["answer"]
              );
            }

            // Transform data.productFaqs if it exists (array of product FAQs)
            if (
              transformed.data.productFaqs &&
              Array.isArray(transformed.data.productFaqs)
            ) {
              const productFaqFields = MODEL_I18N_FIELDS["productFaqs"] || {
                i18nString: [],
                i18nText: [],
              };
              const transformedProductFaqs = transformI18nObject(
                transformed.data.productFaqs,
                lang,
                productFaqFields.i18nString, // ["question"]
                productFaqFields.i18nText // ["answer"]
              );
              // Ensure it's still an array
              transformed.data.productFaqs = Array.isArray(
                transformedProductFaqs
              )
                ? transformedProductFaqs
                : Object.keys(transformedProductFaqs)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((key) => transformedProductFaqs[key]);
            }

            // Transform data.recentUsages if it exists (array of coupon usage history with nested coupon data)
            if (
              transformed.data.recentUsages &&
              Array.isArray(transformed.data.recentUsages)
            ) {
              const couponFields = MODEL_I18N_FIELDS["coupons"] || {
                i18nString: [],
                i18nText: [],
              };
              // Transform the array - this will recursively transform nested couponId.name fields
              const transformedRecentUsages = transformI18nObject(
                transformed.data.recentUsages,
                lang,
                couponFields.i18nString, // ["name", "description"]
                couponFields.i18nText // []
              );
              // Ensure it's still an array
              transformed.data.recentUsages = Array.isArray(
                transformedRecentUsages
              )
                ? transformedRecentUsages
                : Object.keys(transformedRecentUsages)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((key) => transformedRecentUsages[key]);
            }

            // Transform data.couponUsageData if it exists (single coupon usage with nested coupon data)
            if (
              transformed.data.couponUsageData &&
              typeof transformed.data.couponUsageData === "object"
            ) {
              const couponFields = MODEL_I18N_FIELDS["coupons"] || {
                i18nString: [],
                i18nText: [],
              };
              // Transform the object - this will recursively transform nested couponId.name fields
              transformed.data.couponUsageData = transformI18nObject(
                transformed.data.couponUsageData,
                lang,
                couponFields.i18nString, // ["name", "description"]
                couponFields.i18nText // []
              );
            }

            // Transform data.settings if it exists (general settings)
            if (
              transformed.data.settings &&
              typeof transformed.data.settings === "object"
            ) {
              const generalSettingsFields = MODEL_I18N_FIELDS[
                "generalSettings"
              ] || {
                i18nString: [],
                i18nText: [],
              };
              transformed.data.settings = transformI18nObject(
                transformed.data.settings,
                lang,
                generalSettingsFields.i18nString, // ["tagline"]
                generalSettingsFields.i18nText // []
              );
            }

            // Transform data.staticPage if it exists (single static page)
            if (
              transformed.data.staticPage &&
              typeof transformed.data.staticPage === "object"
            ) {
              const staticPageFields = MODEL_I18N_FIELDS["staticPages"] || {
                i18nString: [],
                i18nText: [],
              };
              transformed.data.staticPage = transformI18nObject(
                transformed.data.staticPage,
                lang,
                staticPageFields.i18nString, // ["title"]
                staticPageFields.i18nText // ["content"]
              );
            }

            // Transform data.teamMember if it exists (single team member)
            if (
              transformed.data.teamMember &&
              typeof transformed.data.teamMember === "object"
            ) {
              const teamMemberFields = MODEL_I18N_FIELDS["teamMembers"] || {
                i18nString: [],
                i18nText: [],
              };
              transformed.data.teamMember = transformI18nObject(
                transformed.data.teamMember,
                lang,
                teamMemberFields.i18nString, // ["name", "designation"]
                teamMemberFields.i18nText // ["content"]
              );
            }

            // Transform data.teamMembers if it exists (array of team members)
            if (
              transformed.data.teamMembers &&
              Array.isArray(transformed.data.teamMembers)
            ) {
              const teamMemberFields = MODEL_I18N_FIELDS["teamMembers"] || {
                i18nString: [],
                i18nText: [],
              };
              const transformedTeamMembers = transformI18nObject(
                transformed.data.teamMembers,
                lang,
                teamMemberFields.i18nString, // ["name", "designation"]
                teamMemberFields.i18nText // ["content"]
              );
              // Ensure it's still an array
              transformed.data.teamMembers = Array.isArray(
                transformedTeamMembers
              )
                ? transformedTeamMembers
                : Object.keys(transformedTeamMembers)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((key) => transformedTeamMembers[key]);
            }

            // Transform data.banner if it exists (Our Team Page banner section)
            if (
              transformed.data.banner &&
              typeof transformed.data.banner === "object"
            ) {
              const ourTeamPageFields = MODEL_I18N_FIELDS["ourTeamPage"] || {
                i18nString: [],
                i18nText: [],
              };
              transformed.data.banner = transformI18nObject(
                transformed.data.banner,
                lang,
                ourTeamPageFields.i18nString, // ["title"]
                ourTeamPageFields.i18nText // ["subtitle"]
              );
            }

            // Transform data.staticPages if it exists (array of static pages)
            if (
              transformed.data.staticPages &&
              Array.isArray(transformed.data.staticPages)
            ) {
              const staticPageFields = MODEL_I18N_FIELDS["staticPages"] || {
                i18nString: [],
                i18nText: [],
              };
              const transformedStaticPages = transformI18nObject(
                transformed.data.staticPages,
                lang,
                staticPageFields.i18nString, // ["title"]
                staticPageFields.i18nText // ["content"]
              );
              // Ensure it's still an array
              transformed.data.staticPages = Array.isArray(
                transformedStaticPages
              )
                ? transformedStaticPages
                : Object.keys(transformedStaticPages)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((key) => transformedStaticPages[key]);
            }

            // Transform data.landingPage if it exists (single landing page)
            if (
              transformed.data.landingPage &&
              typeof transformed.data.landingPage === "object"
            ) {
              const landingPageFields = MODEL_I18N_FIELDS["landingPage"] || {
                i18nString: [],
                i18nText: [],
              };
              transformed.data.landingPage = transformI18nObject(
                transformed.data.landingPage,
                lang,
                landingPageFields.i18nString,
                landingPageFields.i18nText
              );
            }

            // Transform data.landingPages if it exists (array of landing pages)
            if (
              transformed.data.landingPages &&
              Array.isArray(transformed.data.landingPages)
            ) {
              const landingPageFields = MODEL_I18N_FIELDS["landingPage"] || {
                i18nString: [],
                i18nText: [],
              };
              const transformedLandingPages = transformI18nObject(
                transformed.data.landingPages,
                lang,
                landingPageFields.i18nString,
                landingPageFields.i18nText
              );
              // Ensure it's still an array
              transformed.data.landingPages = Array.isArray(
                transformedLandingPages
              )
                ? transformedLandingPages
                : Object.keys(transformedLandingPages)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((key) => transformedLandingPages[key]);
            }
          } else {
            // Transform the entire data object
            transformed = transformI18nObject(data, lang, i18nString, i18nText);
          }

          return originalStatusJson(transformed);
        } catch (error: any) {
          logger.error("Error transforming response", {
            error: error.message,
            model: modelName,
            stack: error.stack,
          });
          return originalStatusJson(data);
        }
      };

      return statusRes;
    };

    // Override json method to transform response synchronously
    res.json = function (data: any): Response {
      try {
        // Use cached language (already fetched in middleware)
        const lang = req.userLanguage || DEFAULT_LANGUAGE;

        // Transform the entire response object
        // Handle nested data structure: { success, message, data: { blogs, blogBanners }, pagination }
        let transformed = data;

        // CRITICAL: Handle apiPaginated response structure: { success, message, data: T[], pagination }
        // Check if this is a paginated response with data as array (or object with numeric keys)
        if (
          data &&
          typeof data === "object" &&
          data.data !== undefined &&
          data.pagination
        ) {
          // This is likely an apiPaginated response
          // Ensure data.data is an array, not an object with numeric keys
          let dataArray = data.data;

          // Check if data.data is an object with numeric keys (converted array)
          if (
            !Array.isArray(dataArray) &&
            typeof dataArray === "object" &&
            dataArray !== null
          ) {
            const keys = Object.keys(dataArray);
            const allNumericKeys =
              keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
            if (allNumericKeys) {
              // Convert object with numeric keys back to array
              const sortedKeys = keys.sort((a, b) => parseInt(a) - parseInt(b));
              dataArray = sortedKeys.map((key) => dataArray[key]);
            }
          }

          // If dataArray is an array, transform it
          if (Array.isArray(dataArray)) {
            const transformedData = transformI18nObject(
              dataArray,
              lang,
              i18nString,
              i18nText
            );

            // Ensure transformed result is still an array
            let finalData: any[];
            if (Array.isArray(transformedData)) {
              finalData = transformedData;
            } else if (transformedData && typeof transformedData === "object") {
              // Double check - if it's still an object with numeric keys, convert again
              const keys = Object.keys(transformedData);
              const allNumericKeys =
                keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
              if (allNumericKeys) {
                const sortedKeys = keys.sort(
                  (a, b) => parseInt(a) - parseInt(b)
                );
                finalData = sortedKeys.map((key) => transformedData[key]);
              } else {
                // Fallback: convert to array
                finalData = Object.values(transformedData);
              }
            } else {
              // Fallback: wrap in array
              finalData = [transformedData];
            }

            // Create new response object with transformed array
            transformed = {
              ...data,
              data: finalData,
            };

            return originalJson(transformed);
          }
        }

        // If data has a nested structure with arrays, transform them
        if (data && typeof data === "object" && data.data) {
          // CRITICAL: Check if data.data is directly an array OR an array-like object (numeric keys)
          let dataData = data.data;

          // Check if it's an array-like object (object with only numeric keys) and convert to array
          if (
            !Array.isArray(dataData) &&
            typeof dataData === "object" &&
            dataData !== null
          ) {
            const keys = Object.keys(dataData);
            const isArrayLikeObject =
              keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
            if (isArrayLikeObject) {
              // Convert object with numeric keys back to array
              dataData = Object.keys(dataData)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map((key) => dataData[key]);
            }
          }

          if (Array.isArray(dataData)) {
            // Transform the array of landing pages directly
            const landingPageFields = MODEL_I18N_FIELDS["landingPage"] || {
              i18nString: [],
              i18nText: [],
            };
            const transformedArray = transformI18nObject(
              dataData,
              lang,
              landingPageFields.i18nString,
              landingPageFields.i18nText
            );

            // Ensure it's still an array after transformation
            const finalArray = Array.isArray(transformedArray)
              ? transformedArray
              : Object.keys(transformedArray)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map((key) => transformedArray[key]);

            // Create transformed response with array
            transformed = { ...data, data: finalArray };
          } else {
            // Create a copy to avoid mutating the original (data.data is an object)
            transformed = { ...data, data: { ...data.data } };
          }

          // Transform data.blogs if it exists
          if (transformed.data.blogs && Array.isArray(transformed.data.blogs)) {
            const transformedBlogs = transformI18nObject(
              transformed.data.blogs,
              lang,
              MODEL_I18N_FIELDS["blogs"]?.i18nString || [],
              MODEL_I18N_FIELDS["blogs"]?.i18nText || []
            );
            // Ensure it's still an array
            transformed.data.blogs = Array.isArray(transformedBlogs)
              ? transformedBlogs
              : Object.keys(transformedBlogs)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map((key) => transformedBlogs[key]);
          }

          // Transform data.blogBanners if it exists
          if (
            transformed.data.blogBanners &&
            Array.isArray(transformed.data.blogBanners)
          ) {
            const blogBannerFields = MODEL_I18N_FIELDS["blogBanners"] || {
              i18nString: [],
              i18nText: [],
            };

            // Transform blogBanners array - this should convert I18n objects to single language strings
            const transformedBanners = transformI18nObject(
              transformed.data.blogBanners,
              lang,
              blogBannerFields.i18nString, // ["heading"]
              blogBannerFields.i18nText // ["description"]
            );

            // Ensure we're assigning the transformed array (not an object)
            transformed.data.blogBanners = Array.isArray(transformedBanners)
              ? transformedBanners
              : Object.keys(transformedBanners)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map((key) => transformedBanners[key]);
          }

          // Transform other fields in data.data (like single blog)
          if (
            transformed.data.blog &&
            typeof transformed.data.blog === "object"
          ) {
            transformed.data.blog = transformI18nObject(
              transformed.data.blog,
              lang,
              i18nString,
              i18nText
            );
          }

          // Transform data.blogBanner if it exists (single blog banner)
          if (
            transformed.data.blogBanner &&
            typeof transformed.data.blogBanner === "object"
          ) {
            const blogBannerFields = MODEL_I18N_FIELDS["blogBanners"] || {
              i18nString: [],
              i18nText: [],
            };
            transformed.data.blogBanner = transformI18nObject(
              transformed.data.blogBanner,
              lang,
              blogBannerFields.i18nString, // ["heading"]
              blogBannerFields.i18nText // ["description"]
            );
          }

          // Transform data.category if it exists (single product category)
          if (
            transformed.data.category &&
            typeof transformed.data.category === "object"
          ) {
            const categoryFields = MODEL_I18N_FIELDS["categories"] || {
              i18nString: [],
              i18nText: [],
            };
            transformed.data.category = transformI18nObject(
              transformed.data.category,
              lang,
              categoryFields.i18nString, // ["name"]
              categoryFields.i18nText // ["description"]
            );
          }

          // Transform data.ingredient if it exists (single product ingredient)
          if (
            transformed.data.ingredient &&
            typeof transformed.data.ingredient === "object"
          ) {
            const ingredientFields = MODEL_I18N_FIELDS[
              "productIngredients"
            ] || {
              i18nString: [],
              i18nText: [],
            };
            transformed.data.ingredient = transformI18nObject(
              transformed.data.ingredient,
              lang,
              ingredientFields.i18nString, // ["name"]
              ingredientFields.i18nText // ["description"]
            );
          }

          // Transform data.testimonial if it exists (single product testimonial)
          if (
            transformed.data.testimonial &&
            typeof transformed.data.testimonial === "object"
          ) {
            const testimonialFields = MODEL_I18N_FIELDS[
              "productTestimonials"
            ] || {
              i18nString: [],
              i18nText: [],
            };
            transformed.data.testimonial = transformI18nObject(
              transformed.data.testimonial,
              lang,
              testimonialFields.i18nString,
              testimonialFields.i18nText
            );
          }

          // Transform data.testimonials if it exists (array of product testimonials)
          if (
            transformed.data.testimonials &&
            Array.isArray(transformed.data.testimonials)
          ) {
            const testimonialFields = MODEL_I18N_FIELDS[
              "productTestimonials"
            ] || {
              i18nString: [],
              i18nText: [],
            };
            const transformedTestimonials = transformI18nObject(
              transformed.data.testimonials,
              lang,
              testimonialFields.i18nString,
              testimonialFields.i18nText
            );
            // Ensure it's still an array
            transformed.data.testimonials = Array.isArray(
              transformedTestimonials
            )
              ? transformedTestimonials
              : Object.keys(transformedTestimonials)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map((key) => transformedTestimonials[key]);
          }

          // Transform data.plan if it exists (single membership plan)
          if (
            transformed.data.plan &&
            typeof transformed.data.plan === "object"
          ) {
            const planFields = MODEL_I18N_FIELDS["membershipPlans"] || {
              i18nString: [],
              i18nText: [],
            };
            transformed.data.plan = transformI18nObject(
              transformed.data.plan,
              lang,
              planFields.i18nString, // ["shortDescription"]
              planFields.i18nText // ["description"]
            );
          }

          // Transform data.productFaq if it exists (single product FAQ)
          if (
            transformed.data.productFaq &&
            typeof transformed.data.productFaq === "object"
          ) {
            const productFaqFields = MODEL_I18N_FIELDS["productFaqs"] || {
              i18nString: [],
              i18nText: [],
            };
            transformed.data.productFaq = transformI18nObject(
              transformed.data.productFaq,
              lang,
              productFaqFields.i18nString, // ["question"]
              productFaqFields.i18nText // ["answer"]
            );
          }

          // Transform data.productFaqs if it exists (array of product FAQs)
          if (
            transformed.data.productFaqs &&
            Array.isArray(transformed.data.productFaqs)
          ) {
            const productFaqFields = MODEL_I18N_FIELDS["productFaqs"] || {
              i18nString: [],
              i18nText: [],
            };
            const transformedProductFaqs = transformI18nObject(
              transformed.data.productFaqs,
              lang,
              productFaqFields.i18nString, // ["question"]
              productFaqFields.i18nText // ["answer"]
            );
            // Ensure it's still an array
            transformed.data.productFaqs = Array.isArray(transformedProductFaqs)
              ? transformedProductFaqs
              : Object.keys(transformedProductFaqs)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map((key) => transformedProductFaqs[key]);
          }

          // Transform data.settings if it exists (general settings)
          if (
            transformed.data.settings &&
            typeof transformed.data.settings === "object"
          ) {
            const generalSettingsFields = MODEL_I18N_FIELDS[
              "generalSettings"
            ] || {
              i18nString: [],
              i18nText: [],
            };
            transformed.data.settings = transformI18nObject(
              transformed.data.settings,
              lang,
              generalSettingsFields.i18nString, // ["tagline"]
              generalSettingsFields.i18nText // []
            );
          }

          // Transform data.staticPage if it exists (single static page)
          if (
            transformed.data.staticPage &&
            typeof transformed.data.staticPage === "object"
          ) {
            const staticPageFields = MODEL_I18N_FIELDS["staticPages"] || {
              i18nString: [],
              i18nText: [],
            };
            transformed.data.staticPage = transformI18nObject(
              transformed.data.staticPage,
              lang,
              staticPageFields.i18nString, // ["title"]
              staticPageFields.i18nText // ["content"]
            );
          }

          // Transform data.teamMember if it exists (single team member)
          if (
            transformed.data.teamMember &&
            typeof transformed.data.teamMember === "object"
          ) {
            const teamMemberFields = MODEL_I18N_FIELDS["teamMembers"] || {
              i18nString: [],
              i18nText: [],
            };
            transformed.data.teamMember = transformI18nObject(
              transformed.data.teamMember,
              lang,
              teamMemberFields.i18nString, // ["name", "designation"]
              teamMemberFields.i18nText // ["content"]
            );
          }

          // Transform data.teamMembers if it exists (array of team members)
          if (
            transformed.data.teamMembers &&
            Array.isArray(transformed.data.teamMembers)
          ) {
            const teamMemberFields = MODEL_I18N_FIELDS["teamMembers"] || {
              i18nString: [],
              i18nText: [],
            };
            const transformedTeamMembers = transformI18nObject(
              transformed.data.teamMembers,
              lang,
              teamMemberFields.i18nString, // ["name", "designation"]
              teamMemberFields.i18nText // ["content"]
            );
            // Ensure it's still an array
            transformed.data.teamMembers = Array.isArray(transformedTeamMembers)
              ? transformedTeamMembers
              : Object.keys(transformedTeamMembers)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map((key) => transformedTeamMembers[key]);
          }

          // Transform data.banner if it exists (Our Team Page banner section)
          if (
            transformed.data.banner &&
            typeof transformed.data.banner === "object"
          ) {
            const ourTeamPageFields = MODEL_I18N_FIELDS["ourTeamPage"] || {
              i18nString: [],
              i18nText: [],
            };
            transformed.data.banner = transformI18nObject(
              transformed.data.banner,
              lang,
              ourTeamPageFields.i18nString, // ["title"]
              ourTeamPageFields.i18nText // ["subtitle"]
            );
          }

          // Transform data.staticPages if it exists (array of static pages)
          if (
            transformed.data.staticPages &&
            Array.isArray(transformed.data.staticPages)
          ) {
            const staticPageFields = MODEL_I18N_FIELDS["staticPages"] || {
              i18nString: [],
              i18nText: [],
            };
            const transformedStaticPages = transformI18nObject(
              transformed.data.staticPages,
              lang,
              staticPageFields.i18nString, // ["title"]
              staticPageFields.i18nText // ["content"]
            );
            // Ensure it's still an array
            transformed.data.staticPages = Array.isArray(transformedStaticPages)
              ? transformedStaticPages
              : Object.keys(transformedStaticPages)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map((key) => transformedStaticPages[key]);
          }

          // Transform data.landingPage if it exists (single landing page)
          if (
            transformed.data.landingPage &&
            typeof transformed.data.landingPage === "object"
          ) {
            const landingPageFields = MODEL_I18N_FIELDS["landingPage"] || {
              i18nString: [],
              i18nText: [],
            };
            transformed.data.landingPage = transformI18nObject(
              transformed.data.landingPage,
              lang,
              landingPageFields.i18nString,
              landingPageFields.i18nText
            );
          }

          // Transform data.landingPages if it exists (array of landing pages)
          if (
            transformed.data.landingPages &&
            Array.isArray(transformed.data.landingPages)
          ) {
            const landingPageFields = MODEL_I18N_FIELDS["landingPage"] || {
              i18nString: [],
              i18nText: [],
            };
            const transformedLandingPages = transformI18nObject(
              transformed.data.landingPages,
              lang,
              landingPageFields.i18nString,
              landingPageFields.i18nText
            );
            // Ensure it's still an array
            transformed.data.landingPages = Array.isArray(
              transformedLandingPages
            )
              ? transformedLandingPages
              : Object.keys(transformedLandingPages)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map((key) => transformedLandingPages[key]);
          }

          // Transform data.recentUsages if it exists (array of coupon usage history with nested coupon data)
          if (
            transformed.data.recentUsages &&
            Array.isArray(transformed.data.recentUsages)
          ) {
            const couponFields = MODEL_I18N_FIELDS["coupons"] || {
              i18nString: [],
              i18nText: [],
            };
            // Transform the array - this will recursively transform nested couponId.name fields
            const transformedRecentUsages = transformI18nObject(
              transformed.data.recentUsages,
              lang,
              couponFields.i18nString, // ["name", "description"]
              couponFields.i18nText // []
            );
            // Ensure it's still an array
            transformed.data.recentUsages = Array.isArray(
              transformedRecentUsages
            )
              ? transformedRecentUsages
              : Object.keys(transformedRecentUsages)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map((key) => transformedRecentUsages[key]);
          }

          // Transform data.couponUsageData if it exists (single coupon usage with nested coupon data)
          if (
            transformed.data.couponUsageData &&
            typeof transformed.data.couponUsageData === "object"
          ) {
            const couponFields = MODEL_I18N_FIELDS["coupons"] || {
              i18nString: [],
              i18nText: [],
            };
            // Transform the object - this will recursively transform nested couponId.name fields
            transformed.data.couponUsageData = transformI18nObject(
              transformed.data.couponUsageData,
              lang,
              couponFields.i18nString, // ["name", "description"]
              couponFields.i18nText // []
            );
          }
        } else {
          // Transform the entire data object
          transformed = transformI18nObject(data, lang, i18nString, i18nText);
        }

        return originalJson(transformed);
      } catch (error: any) {
        logger.error("Error transforming response in res.json", {
          error: error.message,
          model: modelName,
        });
        // On error, return original response
        return originalJson(data);
      }
    };

    // Also override apiSuccess and apiPaginated if they exist
    if (res.apiSuccess) {
      const originalApiSuccess = res.apiSuccess.bind(res);
      res.apiSuccess = function <T>(
        data?: T,
        message?: string,
        statusCode?: number
      ): void {
        try {
          const lang = req.userLanguage || DEFAULT_LANGUAGE;
          let transformed: T = data as T;

          // Handle nested data structure with blogs and blogBanners
          if (data && typeof data === "object" && (data as any).data) {
            let dataObj = (data as any).data;

            // CRITICAL: Check if data.data is directly an array OR an array-like object (numeric keys)
            // Check if it's an array-like object (object with only numeric keys) and convert to array
            if (
              !Array.isArray(dataObj) &&
              typeof dataObj === "object" &&
              dataObj !== null
            ) {
              const keys = Object.keys(dataObj);
              const isArrayLikeObject =
                keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
              if (isArrayLikeObject) {
                // Convert object with numeric keys back to array
                dataObj = Object.keys(dataObj)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map((key) => dataObj[key]);
              }
            }

            if (Array.isArray(dataObj)) {
              // Transform the array of landing pages directly
              const landingPageFields = MODEL_I18N_FIELDS["landingPage"] || {
                i18nString: [],
                i18nText: [],
              };
              const transformedArray = transformI18nObject(
                dataObj,
                lang,
                landingPageFields.i18nString,
                landingPageFields.i18nText
              );

              // Ensure it's still an array after transformation
              const finalArray = Array.isArray(transformedArray)
                ? transformedArray
                : Object.keys(transformedArray)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((key) => transformedArray[key]);

              // Update the data object with transformed array
              (data as any).data = finalArray;
              transformed = data;
            } else {
              // data.data is an object, continue with normal processing

              // Transform data.blogs if it exists
              if (dataObj.blogs && Array.isArray(dataObj.blogs)) {
                const transformedBlogs = transformI18nObject(
                  dataObj.blogs,
                  lang,
                  MODEL_I18N_FIELDS["blogs"]?.i18nString || [],
                  MODEL_I18N_FIELDS["blogs"]?.i18nText || []
                );
                // Ensure it's still an array
                dataObj.blogs = Array.isArray(transformedBlogs)
                  ? transformedBlogs
                  : Object.keys(transformedBlogs)
                      .sort((a, b) => parseInt(a) - parseInt(b))
                      .map((key) => transformedBlogs[key]);
              }

              // Transform data.blogBanners if it exists
              if (dataObj.blogBanners && Array.isArray(dataObj.blogBanners)) {
                const transformedBanners = transformI18nObject(
                  dataObj.blogBanners,
                  lang,
                  MODEL_I18N_FIELDS["blogBanners"]?.i18nString || [],
                  MODEL_I18N_FIELDS["blogBanners"]?.i18nText || []
                );
                // Ensure it's still an array
                dataObj.blogBanners = Array.isArray(transformedBanners)
                  ? transformedBanners
                  : Object.keys(transformedBanners)
                      .sort((a, b) => parseInt(a) - parseInt(b))
                      .map((key) => transformedBanners[key]);
              }

              // Transform other fields in data.data (like single blog)
              if (dataObj.blog && typeof dataObj.blog === "object") {
                dataObj.blog = transformI18nObject(
                  dataObj.blog,
                  lang,
                  i18nString,
                  i18nText
                );
              }

              // Transform data.blogBanner if it exists (single blog banner)
              if (
                dataObj.blogBanner &&
                typeof dataObj.blogBanner === "object"
              ) {
                const blogBannerFields = MODEL_I18N_FIELDS["blogBanners"] || {
                  i18nString: [],
                  i18nText: [],
                };
                dataObj.blogBanner = transformI18nObject(
                  dataObj.blogBanner,
                  lang,
                  blogBannerFields.i18nString, // ["heading"]
                  blogBannerFields.i18nText // ["description"]
                );
              }

              // Transform data.category if it exists (single product category)
              if (dataObj.category && typeof dataObj.category === "object") {
                const categoryFields = MODEL_I18N_FIELDS["categories"] || {
                  i18nString: [],
                  i18nText: [],
                };
                dataObj.category = transformI18nObject(
                  dataObj.category,
                  lang,
                  categoryFields.i18nString, // ["name"]
                  categoryFields.i18nText // ["description"]
                );
              }

              // Transform data.ingredient if it exists (single product ingredient)
              if (
                dataObj.ingredient &&
                typeof dataObj.ingredient === "object"
              ) {
                const ingredientFields = MODEL_I18N_FIELDS[
                  "productIngredients"
                ] || {
                  i18nString: [],
                  i18nText: [],
                };
                dataObj.ingredient = transformI18nObject(
                  dataObj.ingredient,
                  lang,
                  ingredientFields.i18nString, // ["name"]
                  ingredientFields.i18nText // ["description"]
                );
              }

              // Transform data.testimonial if it exists (single product testimonial)
              if (
                dataObj.testimonial &&
                typeof dataObj.testimonial === "object"
              ) {
                const testimonialFields = MODEL_I18N_FIELDS[
                  "productTestimonials"
                ] || {
                  i18nString: [],
                  i18nText: [],
                };
                dataObj.testimonial = transformI18nObject(
                  dataObj.testimonial,
                  lang,
                  testimonialFields.i18nString,
                  testimonialFields.i18nText
                );
              }

              // Transform data.plan if it exists (single membership plan)
              if (dataObj.plan && typeof dataObj.plan === "object") {
                const planFields = MODEL_I18N_FIELDS["membershipPlans"] || {
                  i18nString: [],
                  i18nText: [],
                };
                dataObj.plan = transformI18nObject(
                  dataObj.plan,
                  lang,
                  planFields.i18nString, // ["shortDescription"]
                  planFields.i18nText // ["description"]
                );
              }

              // Transform data.productFaq if it exists (single product FAQ)
              if (
                dataObj.productFaq &&
                typeof dataObj.productFaq === "object"
              ) {
                const productFaqFields = MODEL_I18N_FIELDS["productFaqs"] || {
                  i18nString: [],
                  i18nText: [],
                };
                dataObj.productFaq = transformI18nObject(
                  dataObj.productFaq,
                  lang,
                  productFaqFields.i18nString, // ["question"]
                  productFaqFields.i18nText // ["answer"]
                );
              }

              // Transform data.productFaqs if it exists (array of product FAQs)
              if (dataObj.productFaqs && Array.isArray(dataObj.productFaqs)) {
                const productFaqFields = MODEL_I18N_FIELDS["productFaqs"] || {
                  i18nString: [],
                  i18nText: [],
                };
                const transformedProductFaqs = transformI18nObject(
                  dataObj.productFaqs,
                  lang,
                  productFaqFields.i18nString, // ["question"]
                  productFaqFields.i18nText // ["answer"]
                );
                // Ensure it's still an array
                dataObj.productFaqs = Array.isArray(transformedProductFaqs)
                  ? transformedProductFaqs
                  : Object.keys(transformedProductFaqs)
                      .sort((a, b) => parseInt(a) - parseInt(b))
                      .map((key) => transformedProductFaqs[key]);
              }

              // Transform data.settings if it exists (general settings)
              if (dataObj.settings && typeof dataObj.settings === "object") {
                const generalSettingsFields = MODEL_I18N_FIELDS[
                  "generalSettings"
                ] || {
                  i18nString: [],
                  i18nText: [],
                };
                dataObj.settings = transformI18nObject(
                  dataObj.settings,
                  lang,
                  generalSettingsFields.i18nString, // ["tagline"]
                  generalSettingsFields.i18nText // []
                );
              }

              // Transform data.staticPage if it exists (single static page)
              if (
                dataObj.staticPage &&
                typeof dataObj.staticPage === "object"
              ) {
                const staticPageFields = MODEL_I18N_FIELDS["staticPages"] || {
                  i18nString: [],
                  i18nText: [],
                };
                dataObj.staticPage = transformI18nObject(
                  dataObj.staticPage,
                  lang,
                  staticPageFields.i18nString, // ["title"]
                  staticPageFields.i18nText // ["content"]
                );
              }

              // Transform data.teamMember if it exists (single team member)
              if (
                dataObj.teamMember &&
                typeof dataObj.teamMember === "object"
              ) {
                const teamMemberFields = MODEL_I18N_FIELDS["teamMembers"] || {
                  i18nString: [],
                  i18nText: [],
                };
                dataObj.teamMember = transformI18nObject(
                  dataObj.teamMember,
                  lang,
                  teamMemberFields.i18nString, // ["name", "designation"]
                  teamMemberFields.i18nText // ["content"]
                );
              }

              // Transform data.teamMembers if it exists (array of team members)
              if (dataObj.teamMembers && Array.isArray(dataObj.teamMembers)) {
                const teamMemberFields = MODEL_I18N_FIELDS["teamMembers"] || {
                  i18nString: [],
                  i18nText: [],
                };
                const transformedTeamMembers = transformI18nObject(
                  dataObj.teamMembers,
                  lang,
                  teamMemberFields.i18nString, // ["name", "designation"]
                  teamMemberFields.i18nText // ["content"]
                );
                // Ensure it's still an array
                dataObj.teamMembers = Array.isArray(transformedTeamMembers)
                  ? transformedTeamMembers
                  : Object.keys(transformedTeamMembers)
                      .sort((a, b) => parseInt(a) - parseInt(b))
                      .map((key) => transformedTeamMembers[key]);
              }

              // Transform data.banner if it exists (Our Team Page banner section)
              if (dataObj.banner && typeof dataObj.banner === "object") {
                const ourTeamPageFields = MODEL_I18N_FIELDS["ourTeamPage"] || {
                  i18nString: [],
                  i18nText: [],
                };
                dataObj.banner = transformI18nObject(
                  dataObj.banner,
                  lang,
                  ourTeamPageFields.i18nString, // ["title"]
                  ourTeamPageFields.i18nText // ["subtitle"]
                );
              }

              // Transform data.staticPages if it exists (array of static pages)
              if (dataObj.staticPages && Array.isArray(dataObj.staticPages)) {
                const staticPageFields = MODEL_I18N_FIELDS["staticPages"] || {
                  i18nString: [],
                  i18nText: [],
                };
                const transformedStaticPages = transformI18nObject(
                  dataObj.staticPages,
                  lang,
                  staticPageFields.i18nString, // ["title"]
                  staticPageFields.i18nText // ["content"]
                );
                // Ensure it's still an array
                dataObj.staticPages = Array.isArray(transformedStaticPages)
                  ? transformedStaticPages
                  : Object.keys(transformedStaticPages)
                      .sort((a, b) => parseInt(a) - parseInt(b))
                      .map((key) => transformedStaticPages[key]);
              }

              // Transform data.landingPage if it exists (single landing page)
              if (
                dataObj.landingPage &&
                typeof dataObj.landingPage === "object"
              ) {
                const landingPageFields = MODEL_I18N_FIELDS["landingPage"] || {
                  i18nString: [],
                  i18nText: [],
                };
                dataObj.landingPage = transformI18nObject(
                  dataObj.landingPage,
                  lang,
                  landingPageFields.i18nString,
                  landingPageFields.i18nText
                );
              }

              // Transform data.landingPages if it exists (array of landing pages)
              if (dataObj.landingPages && Array.isArray(dataObj.landingPages)) {
                const landingPageFields = MODEL_I18N_FIELDS["landingPage"] || {
                  i18nString: [],
                  i18nText: [],
                };
                const transformedLandingPages = transformI18nObject(
                  dataObj.landingPages,
                  lang,
                  landingPageFields.i18nString,
                  landingPageFields.i18nText
                );
                // Ensure it's still an array
                dataObj.landingPages = Array.isArray(transformedLandingPages)
                  ? transformedLandingPages
                  : Object.keys(transformedLandingPages)
                      .sort((a, b) => parseInt(a) - parseInt(b))
                      .map((key) => transformedLandingPages[key]);
              }

              // Transform data.recentUsages if it exists (array of coupon usage history with nested coupon data)
              if (dataObj.recentUsages && Array.isArray(dataObj.recentUsages)) {
                const couponFields = MODEL_I18N_FIELDS["coupons"] || {
                  i18nString: [],
                  i18nText: [],
                };
                // Transform the array - this will recursively transform nested couponId.name fields
                const transformedRecentUsages = transformI18nObject(
                  dataObj.recentUsages,
                  lang,
                  couponFields.i18nString, // ["name", "description"]
                  couponFields.i18nText // []
                );
                // Ensure it's still an array
                dataObj.recentUsages = Array.isArray(transformedRecentUsages)
                  ? transformedRecentUsages
                  : Object.keys(transformedRecentUsages)
                      .sort((a, b) => parseInt(a) - parseInt(b))
                      .map((key) => transformedRecentUsages[key]);
              }

              // Transform data.couponUsageData if it exists (single coupon usage with nested coupon data)
              if (
                dataObj.couponUsageData &&
                typeof dataObj.couponUsageData === "object"
              ) {
                const couponFields = MODEL_I18N_FIELDS["coupons"] || {
                  i18nString: [],
                  i18nText: [],
                };
                // Transform the object - this will recursively transform nested couponId.name fields
                dataObj.couponUsageData = transformI18nObject(
                  dataObj.couponUsageData,
                  lang,
                  couponFields.i18nString, // ["name", "description"]
                  couponFields.i18nText // []
                );
              }

              transformed = data as T;
            }
          } else if (data && typeof data === "object") {
            // Handle direct data structure (e.g., { settings: {...} } instead of { data: { settings: {...} } })
            const dataObj = data as any;

            // Transform settings if it exists directly in data
            if (dataObj.settings && typeof dataObj.settings === "object") {
              const generalSettingsFields = MODEL_I18N_FIELDS[
                "generalSettings"
              ] || {
                i18nString: [],
                i18nText: [],
              };
              dataObj.settings = transformI18nObject(
                dataObj.settings,
                lang,
                generalSettingsFields.i18nString, // ["tagline"]
                generalSettingsFields.i18nText // []
              );
            }

            transformed = data as T;
          } else {
            transformed = transformI18nObject(
              data,
              lang,
              i18nString,
              i18nText
            ) as T;
          }

          originalApiSuccess(transformed, message, statusCode);
        } catch (error: any) {
          logger.error("Error transforming response in apiSuccess", {
            error: error.message,
            model: modelName,
          });
          originalApiSuccess(data, message, statusCode);
        }
      };
    }

    if (res.apiPaginated) {
      const originalApiPaginated = res.apiPaginated.bind(res);
      res.apiPaginated = function <T>(
        data: T[],
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        },
        message?: string
      ): void {
        try {
          const lang = req.userLanguage || DEFAULT_LANGUAGE;

          // Ensure data is an array before transforming
          if (!Array.isArray(data)) {
            originalApiPaginated(data, pagination, message);
            return;
          }

          // Check if data is already an object with numeric keys (converted array)
          // Convert it back to array before transforming
          let dataToTransform: T[] = data;
          if (!Array.isArray(data) && typeof data === "object") {
            const keys = Object.keys(data);
            const allNumericKeys =
              keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
            if (allNumericKeys) {
              // This is an object with numeric keys, convert to array
              dataToTransform = Object.values(data) as T[];
            }
          }

          // Transform each item in the array, ensuring result is still an array
          const transformed = transformI18nObject(
            dataToTransform,
            lang,
            i18nString,
            i18nText
          );

          // CRITICAL: Ensure transformed result is always an array (not an object with numeric keys)
          // transformI18nObject should return an array when given an array, but double-check
          let transformedArray: T[];
          if (Array.isArray(transformed)) {
            transformedArray = transformed;
          } else if (transformed && typeof transformed === "object") {
            // Check if it's an object with numeric keys (converted array)
            const keys = Object.keys(transformed);
            const allNumericKeys =
              keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
            if (allNumericKeys) {
              // Convert object with numeric keys back to array
              // Sort keys numerically to maintain order
              const sortedKeys = keys.sort((a, b) => parseInt(a) - parseInt(b));
              transformedArray = sortedKeys.map(
                (key) => transformed[key]
              ) as T[];
            } else {
              // It's a regular object, wrap in array (shouldn't happen for apiPaginated)
              transformedArray = [transformed] as T[];
            }
          } else {
            // Fallback: wrap in array
            transformedArray = [transformed] as T[];
          }

          // FINAL SAFETY CHECK: Ensure we're passing a proper array
          // Double-check that transformedArray is actually an array
          if (!Array.isArray(transformedArray)) {
            logger.error(
              "transformedArray is not an array before calling originalApiPaginated",
              {
                type: typeof transformedArray,
                isArray: Array.isArray(transformedArray),
                keys:
                  typeof transformedArray === "object"
                    ? Object.keys(transformedArray)
                    : [],
              }
            );
            // Force convert to array
            if (transformedArray && typeof transformedArray === "object") {
              const keys = Object.keys(transformedArray);
              const sortedKeys = keys.sort((a, b) => parseInt(a) - parseInt(b));
              transformedArray = sortedKeys.map(
                (key) => (transformedArray as any)[key]
              ) as T[];
            } else {
              transformedArray = [transformedArray] as T[];
            }
          }

          originalApiPaginated(transformedArray, pagination, message);
        } catch (error: any) {
          logger.error("Error transforming response in apiPaginated", {
            error: error.message,
            model: modelName,
          });
          originalApiPaginated(data, pagination, message);
        }
      };
    }

    next();
  };
};

/**
 * Helper function to transform response data based on user language
 * Use this in controllers when you need to transform data manually
 */
export const transformResponseData = async (
  data: any,
  req: AuthenticatedRequest,
  modelName: string
): Promise<any> => {
  const { i18nString, i18nText } = MODEL_I18N_FIELDS[modelName] || {
    i18nString: [],
    i18nText: [],
  };

  if (i18nString.length === 0 && i18nText.length === 0) {
    return data;
  }

  const lang = await getUserLanguage(req);
  const transformed = transformI18nObject(data, lang, i18nString, i18nText);

  // Log for debugging (remove in production)
  if (process.env.NODE_ENV === "development") {
    logger.debug(`Transformed ${modelName} data for language: ${lang}`, {
      model: modelName,
      language: lang,
      hasData: !!data,
      isArray: Array.isArray(data),
    });
  }

  return transformed;
};
