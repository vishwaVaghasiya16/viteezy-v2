import { LandingPages } from "../models/cms/landingPage.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import mongoose from "mongoose";
import { ProductCategory } from "../models/commerce/categories.model";
import { Products } from "../models/commerce/products.model";
import { ProductIngredients } from "../models/commerce/productIngredients.model";
import { ProductTestimonials } from "../models/cms/productTestimonials.model";
import { Blogs } from "../models/cms/blogs.model";
import { FAQs } from "../models/cms/faqs.model";
import { FAQStatus } from "../models/enums";
import { Wishlists } from "../models/commerce/wishlists.model";
import { User } from "../models/core/users.model";
import { cartService } from "./cartService";
import { transformProductForLanguage } from "./productEnrichmentService";
import { translationService } from "./translationService";
import { prepareDataForTranslation } from "../utils/translationUtils";

type SupportedLanguage = "en" | "nl" | "de" | "fr" | "es";

/** In-memory cache for public landing page by lang (TTL 60s) to avoid repeated DB load */
const LANDING_PAGE_CACHE_TTL_MS = 60 * 1000;
const landingPageCache = new Map<
  string,
  { data: { landingPage: any }; expiry: number }
>();

/**
 * Get string for requested language from stored I18n (no runtime translation).
 * Landing page is stored multi-language at create time; we only pick the requested lang key.
 */
const getTranslatedString = (
  i18nString: any,
  lang: SupportedLanguage
): string => {
  if (!i18nString) return "";

  // If it's already a plain string, return it
  if (typeof i18nString === "string") {
    return i18nString;
  }

  // If it's an object with language keys
  if (
    typeof i18nString === "object" &&
    !Array.isArray(i18nString) &&
    i18nString !== null
  ) {
    // Try to get the requested language, fallback to English, then any available language
    if (i18nString[lang]) {
      return String(i18nString[lang]);
    }
    if (i18nString.en) {
      return String(i18nString.en);
    }
    // Try to get any available language value
    const availableLang = Object.keys(i18nString).find(
      (key) => i18nString[key]
    );
    if (availableLang) {
      return String(i18nString[availableLang]);
    }
    return "";
  }

  return "";
};

/**
 * Get text for requested language from stored I18n (no runtime translation).
 */
const getTranslatedText = (i18nText: any, lang: SupportedLanguage): string => {
  if (!i18nText) return "";

  // If it's already a plain string, return it
  if (typeof i18nText === "string") {
    return i18nText;
  }

  // If it's an object with language keys
  if (
    typeof i18nText === "object" &&
    !Array.isArray(i18nText) &&
    i18nText !== null
  ) {
    // Try to get the requested language, fallback to English, then any available language
    if (i18nText[lang]) {
      return String(i18nText[lang]);
    }
    if (i18nText.en) {
      return String(i18nText.en);
    }
    // Try to get any available language value
    const availableLang = Object.keys(i18nText).find((key) => i18nText[key]);
    if (availableLang) {
      return String(i18nText[availableLang]);
    }
    return "";
  }

  return "";
};

/**
 * Transform I18n string array to single language array
 */
const transformI18nStringArray = (
  i18nArray: any[],
  lang: SupportedLanguage
): string[] => {
  if (!Array.isArray(i18nArray)) return [];
  return i18nArray.map((item) => getTranslatedString(item, lang));
};

/**
 * Convert input to I18n format - handles both string and multi-language object
 */
const convertToI18n = (
  input: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string } | undefined
): { en?: string; nl?: string; de?: string; fr?: string; es?: string } | undefined => {
  if (!input) return undefined;
  
  if (typeof input === "string") {
    return { en: input };
  }
  
  if (typeof input === "object" && !Array.isArray(input)) {
    return input;
  }
  
  return { en: String(input) };
};

interface PrimaryCTAInput {
  label: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
  image?: string;
  link?: string;
  order?: number;
}

interface MembershipBenefitInput {
  icon?: string;
  title: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
  description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
  order?: number;
}

interface CommunityMetricInput {
  label: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
  value: string | number;
  order?: number;
}

interface CreateLandingPageData {
  heroSection: {
    media: {
      type: "image" | "video";
      url: string;
      sortOrder?: number;
    };
    imageUrl?: string;
    videoUrl?: string;
    backgroundImage?: string;
    title: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    highlightedText?: (string | { en?: string; nl?: string; de?: string; fr?: string; es?: string })[];
    primaryCTA?: PrimaryCTAInput[];
    isEnabled?: boolean;
    order?: number;
  };
  membershipSection?: {
    backgroundImage: string;
    title: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    benefits?: MembershipBenefitInput[];
    isEnabled?: boolean;
    order?: number;
  };
  howItWorksSection?: {
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    stepsCount?: number;
    steps: Array<{
      image: string;
      title: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  productCategorySection?: {
    title: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    // productCategoryIds removed - categories are fetched dynamically in GET APIs
    isEnabled?: boolean;
    order?: number;
  };
  communitySection?: {
    backgroundImage?: string;
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    metrics?: CommunityMetricInput[];
    isEnabled?: boolean;
    order?: number;
  };
  missionSection?: {
    backgroundImage: string;
    title: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    isEnabled?: boolean;
    order?: number;
  };
  featuresSection?: {
    title: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    features: Array<{
      icon: string;
      title: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  designedByScienceSection?: {
    title: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    steps: Array<{
      image: string;
      title: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  testimonialsSection?: {
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    testimonialIds?: (mongoose.Types.ObjectId | string)[];
    isEnabled?: boolean;
    order?: number;
  };
  customerResultsSection?: {
    title: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    isEnabled?: boolean;
    order?: number;
  };
  blogSection?: {
    title: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    isEnabled?: boolean;
    order?: number;
  };
  faqSection?: {
    title: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    faqs: Array<{
      question: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      answer?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  isActive?: boolean;
  createdBy?: mongoose.Types.ObjectId;
}

interface UpdateLandingPageData {
  heroSection?: {
    media?: {
      type: "image" | "video";
      url: string;
      sortOrder?: number;
    };
    imageUrl?: string;
    videoUrl?: string;
    backgroundImage?: string;
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    highlightedText?: (string | { en?: string; nl?: string; de?: string; fr?: string; es?: string })[];
    primaryCTA?: PrimaryCTAInput[];
    isEnabled?: boolean;
    order?: number;
  };
  membershipSection?: {
    backgroundImage?: string;
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    benefits?: MembershipBenefitInput[];
    isEnabled?: boolean;
    order?: number;
  };
  howItWorksSection?: {
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    stepsCount?: number;
    steps?: Array<{
      image?: string;
      title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  productCategorySection?: {
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    // productCategoryIds removed - categories are fetched dynamically in GET APIs
    isEnabled?: boolean;
    order?: number;
  };
  communitySection?: {
    backgroundImage?: string;
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    metrics?: CommunityMetricInput[];
    isEnabled?: boolean;
    order?: number;
  };
  missionSection?: {
    backgroundImage?: string;
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    isEnabled?: boolean;
    order?: number;
  };
  featuresSection?: {
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    features?: Array<{
      icon?: string;
      title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  designedByScienceSection?: {
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    steps?: Array<{
      image?: string;
      title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  testimonialsSection?: {
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    subTitle?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    testimonialIds?: (mongoose.Types.ObjectId | string)[];
    isEnabled?: boolean;
    order?: number;
  };
  customerResultsSection?: {
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    isEnabled?: boolean;
    order?: number;
  };
  blogSection?: {
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    isEnabled?: boolean;
    order?: number;
  };
  faqSection?: {
    title?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    description?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
    faqs?: Array<{
      question?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      answer?: string | { en?: string; nl?: string; de?: string; fr?: string; es?: string };
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  isActive?: boolean;
  updatedBy?: mongoose.Types.ObjectId;
}

class LandingPageService {
  /**
   * Create new landing page with automatic multi-language translation
   */
  async createLandingPage(
    data: CreateLandingPageData
  ): Promise<{ landingPage: any; message: string }> {
    // Validate that at least one media source is provided
    if (
      !data.heroSection.media &&
      !data.heroSection.imageUrl &&
      !data.heroSection.videoUrl
    ) {
      throw new AppError(
        "Either imageUrl, videoUrl, or media must be provided for hero section",
        400
      );
    }

    logger.info(`[Landing Page Service] Creating landing page with automatic translation`);

    // Define all I18n string and text fields for translation
    const i18nStringFields = [
      "heroSection.title",
      "heroSection.subTitle",
      "heroSection.highlightedText",
      "heroSection.primaryCTA.label",
      "membershipSection.title",
      "membershipSection.subTitle",
      "membershipSection.benefits.title",
      "membershipSection.benefits.description",
      "howItWorksSection.title",
      "howItWorksSection.subTitle",
      "howItWorksSection.steps.title",
      "howItWorksSection.steps.description",
      "productCategorySection.title",
      "productCategorySection.subTitle",
      "communitySection.title",
      "communitySection.subTitle",
      "communitySection.metrics.label",
      "missionSection.title",
      "featuresSection.title",
      "featuresSection.subTitle",
      "featuresSection.features.title",
      "featuresSection.features.description",
      "designedByScienceSection.title",
      "designedByScienceSection.steps.title",
      "designedByScienceSection.steps.description",
      "testimonialsSection.title",
      "testimonialsSection.subTitle",
      "customerResultsSection.title",
      "blogSection.title",
      "faqSection.title"
    ];

    const i18nTextFields = [
      "heroSection.description",
      "membershipSection.description",
      "membershipSection.benefits.description",
      "howItWorksSection.steps.description",
      "productCategorySection.description",
      "communitySection.subTitle",
      "missionSection.description",
      "featuresSection.description",
      "featuresSection.features.description",
      "designedByScienceSection.description",
      "designedByScienceSection.steps.description",
      "customerResultsSection.description",
      "blogSection.description",
      "faqSection.description"
    ];

    // Translate data to all supported languages
    const translatedData = await prepareDataForTranslation(data, i18nStringFields, i18nTextFields);

    // Convert input to I18n format for database (now with translations)
    const landingPageData: any = {
      heroSection: {
        ...translatedData.heroSection,
        imageUrl: translatedData.heroSection.imageUrl,
        videoUrl: translatedData.heroSection.videoUrl,
        backgroundImage: translatedData.heroSection.backgroundImage,
        title: convertToI18n(translatedData.heroSection.title),
        description: convertToI18n(translatedData.heroSection.description),
        subTitle: convertToI18n(translatedData.heroSection.subTitle),
        highlightedText: Array.isArray(translatedData.heroSection.highlightedText)
          ? translatedData.heroSection.highlightedText.map((text: any) => convertToI18n(text))
          : undefined,
        primaryCTA: Array.isArray(translatedData.heroSection.primaryCTA)
          ? translatedData.heroSection.primaryCTA.map((cta: any) => ({
              label: convertToI18n(cta.label),
              image: cta.image,
              link: cta.link,
              order: cta.order ?? 0,
            }))
          : undefined,
        isEnabled:
          translatedData.heroSection.isEnabled !== undefined
            ? translatedData.heroSection.isEnabled
            : true,
        order: translatedData.heroSection.order ?? 0,
        media: translatedData.heroSection.media
          ? {
              ...translatedData.heroSection.media,
            }
          : undefined,
      },
      isActive: translatedData.isActive ?? true,
      createdBy: translatedData.createdBy,
    };

    // Convert membership section strings to I18n format
    if (translatedData.membershipSection) {
      landingPageData.membershipSection = {
        backgroundImage: translatedData.membershipSection.backgroundImage,
        title: convertToI18n(translatedData.membershipSection.title),
        description: convertToI18n(translatedData.membershipSection.description),
        subTitle: convertToI18n(translatedData.membershipSection.subTitle),
        benefits: Array.isArray(translatedData.membershipSection.benefits)
          ? translatedData.membershipSection.benefits.map((benefit: any) => ({
              icon: benefit.icon,
              title: convertToI18n(benefit.title),
              description: convertToI18n(benefit.description),
              order: benefit.order ?? 0,
            }))
          : undefined,
        isEnabled:
          translatedData.membershipSection.isEnabled !== undefined
            ? translatedData.membershipSection.isEnabled
            : true,
        order: translatedData.membershipSection.order ?? 0,
      };
    }

    // Convert how it works section strings to I18n format
    if (translatedData.howItWorksSection && translatedData.howItWorksSection.steps) {
      landingPageData.howItWorksSection = {
        title: convertToI18n(translatedData.howItWorksSection.title),
        subTitle: convertToI18n(translatedData.howItWorksSection.subTitle),
        stepsCount:
          translatedData.howItWorksSection.stepsCount ??
          translatedData.howItWorksSection.steps.length,
        steps: translatedData.howItWorksSection.steps.map((step: any) => ({
          image: step.image,
          title: convertToI18n(step.title),
          description: convertToI18n(step.description),
          order: step.order || 0,
        })),
        isEnabled:
          translatedData.howItWorksSection.isEnabled !== undefined
            ? translatedData.howItWorksSection.isEnabled
            : true,
        order: translatedData.howItWorksSection.order ?? 0,
      };
    }

    // Convert product category section strings to I18n format
    if (translatedData.productCategorySection) {
      const productCategoryIds =
        Array.isArray((translatedData.productCategorySection as any).productCategoryIds) &&
        (translatedData.productCategorySection as any).productCategoryIds.length > 0
          ? (translatedData.productCategorySection as any).productCategoryIds.map(
              (id: string) => new mongoose.Types.ObjectId(id)
            )
          : undefined;
      landingPageData.productCategorySection = {
        title: convertToI18n(translatedData.productCategorySection.title),
        description: convertToI18n(translatedData.productCategorySection.description),
        subTitle: convertToI18n(translatedData.productCategorySection.subTitle),
        ...(productCategoryIds && { productCategoryIds }),
        isEnabled:
          translatedData.productCategorySection.isEnabled !== undefined
            ? translatedData.productCategorySection.isEnabled
            : true,
        order: translatedData.productCategorySection.order ?? 0,
      };
    }

    // Community / Social Proof section
    if (translatedData.communitySection) {
      landingPageData.communitySection = {
        backgroundImage: translatedData.communitySection.backgroundImage,
        title: convertToI18n(translatedData.communitySection.title),
        subTitle: convertToI18n(translatedData.communitySection.subTitle),
        metrics: Array.isArray(translatedData.communitySection.metrics)
          ? translatedData.communitySection.metrics.map((metric: any) => ({
              label: convertToI18n(metric.label),
              value: metric.value,
              order: metric.order ?? 0,
            }))
          : undefined,
        isEnabled:
          translatedData.communitySection.isEnabled !== undefined
            ? translatedData.communitySection.isEnabled
            : true,
        order: translatedData.communitySection.order ?? 0,
      };
    }

    // Convert mission section strings to I18n format
    if (translatedData.missionSection) {
      landingPageData.missionSection = {
        backgroundImage: translatedData.missionSection.backgroundImage,
        title: convertToI18n(translatedData.missionSection.title),
        description: convertToI18n(translatedData.missionSection.description),
        isEnabled:
          translatedData.missionSection.isEnabled !== undefined
            ? translatedData.missionSection.isEnabled
            : true,
        order: translatedData.missionSection.order ?? 0,
      };
    }

    // Convert features section strings to I18n format
    if (translatedData.featuresSection && translatedData.featuresSection.features) {
      landingPageData.featuresSection = {
        title: convertToI18n(translatedData.featuresSection.title),
        description: convertToI18n(translatedData.featuresSection.description),
        subTitle: convertToI18n(translatedData.featuresSection.subTitle),
        features: translatedData.featuresSection.features.map((feature: any) => ({
          icon: feature.icon,
          title: convertToI18n(feature.title),
          description: convertToI18n(feature.description),
          order: feature.order || 0,
        })),
        isEnabled:
          translatedData.featuresSection.isEnabled !== undefined
            ? translatedData.featuresSection.isEnabled
            : true,
        order: translatedData.featuresSection.order ?? 0,
      };
    }

    // Convert designed by science section strings to I18n format
    if (translatedData.designedByScienceSection && translatedData.designedByScienceSection.steps) {
      landingPageData.designedByScienceSection = {
        title: convertToI18n(translatedData.designedByScienceSection.title),
        description: convertToI18n(translatedData.designedByScienceSection.description),
        steps: translatedData.designedByScienceSection.steps.map((step: any) => ({
          image: step.image,
          title: convertToI18n(step.title),
          description: convertToI18n(step.description),
          order: step.order || 0,
        })),
        isEnabled:
          translatedData.designedByScienceSection.isEnabled !== undefined
            ? translatedData.designedByScienceSection.isEnabled
            : true,
        order: translatedData.designedByScienceSection.order ?? 0,
      };
    }

    // Testimonials Section
    if (translatedData.testimonialsSection) {
      landingPageData.testimonialsSection = {
        title: convertToI18n(translatedData.testimonialsSection.title),
        subTitle: convertToI18n(translatedData.testimonialsSection.subTitle),
        // Testimonials are not stored here, they will be fetched dynamically from ProductTestimonials model
        isEnabled:
          translatedData.testimonialsSection.isEnabled !== undefined
            ? translatedData.testimonialsSection.isEnabled
            : true,
        order: translatedData.testimonialsSection.order ?? 0,
      };
    }

    // Convert customer results section strings to I18n format
    if (translatedData.customerResultsSection) {
      landingPageData.customerResultsSection = {
        title: convertToI18n(translatedData.customerResultsSection.title),
        description: convertToI18n(translatedData.customerResultsSection.description),
        isEnabled:
          translatedData.customerResultsSection.isEnabled !== undefined
            ? translatedData.customerResultsSection.isEnabled
            : true,
        order: translatedData.customerResultsSection.order ?? 0,
      };
    }

    // Convert blog section strings to I18n format
    if (translatedData.blogSection) {
      landingPageData.blogSection = {
        title: convertToI18n(translatedData.blogSection.title),
        description: convertToI18n(translatedData.blogSection.description),
        isEnabled:
          translatedData.blogSection.isEnabled !== undefined
            ? translatedData.blogSection.isEnabled
            : true,
        order: translatedData.blogSection.order ?? 0,
      };
    }

    // Convert FAQ section strings to I18n format
    // FAQs will be fetched dynamically from FAQs model (latest 8)
    if (translatedData.faqSection) {
      landingPageData.faqSection = {
        title: convertToI18n(translatedData.faqSection.title),
        description: convertToI18n(translatedData.faqSection.description),
        // FAQs are not stored here, they will be fetched dynamically from FAQs model
        isEnabled:
          translatedData.faqSection.isEnabled !== undefined
            ? translatedData.faqSection.isEnabled
            : true,
        order: translatedData.faqSection.order ?? 0,
      };
    }

    const landingPage = await LandingPages.create(landingPageData);

    logger.info(`Landing page created successfully: ${landingPage._id}`);

    return {
      landingPage: landingPage.toObject(),
      message: "Landing page created successfully",
    };
  }

  /**
   * Get all landing pages with optional filters
   * Returns landing pages with single language (default: English)
   */
  async getAllLandingPages(filters: {
    isActive?: boolean;
  }): Promise<{ landingPages: any[] }> {
    const query: any = {
      isDeleted: { $ne: true },
    };

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    const landingPages = await LandingPages.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Transform each landing page to single language (default: English)
    const transformedLandingPages = landingPages.map((landingPage) =>
      this.transformToLanguage(landingPage, "en")
    );

    return { landingPages: transformedLandingPages };
  }

  /**
   * Get landing page by ID
   */
  async getLandingPageById(
    landingPageId: string
  ): Promise<{ landingPage: any }> {
    const landingPage = await LandingPages.findOne({
      _id: landingPageId,
      isDeleted: { $ne: true },
    }).lean();

    if (!landingPage) {
      throw new AppError("Landing page not found", 404);
    }

    // Fetch FAQs from FAQs model if FAQ section is enabled
    if (landingPage.faqSection && landingPage.faqSection.isEnabled !== false) {
      const recentFaqs = await FAQs.find({
        isDeleted: { $ne: true },
        $or: [
          { status: FAQStatus.ACTIVE },
          { status: { $exists: false }, isActive: { $ne: false } },
        ],
      })
        .select("_id question answer sortOrder")
        .sort({ sortOrder: 1, createdAt: -1 })
        .limit(8) // Max 8 FAQs
        .lean();

      // Map sortOrder to order to maintain same response structure
      // Keep only the fields that match the original structure: _id, question, answer, order
      const mappedFaqs = recentFaqs.map((faq: any) => ({
        _id: faq._id,
        question: faq.question,
        answer: faq.answer,
        order: faq.sortOrder || 0,
      }));

      (landingPage as any).faqSection = {
        ...landingPage.faqSection,
        faqs: mappedFaqs,
      };
    }

    // Fetch Blogs from Blogs model if Blog section is enabled
    if (landingPage.blogSection && landingPage.blogSection.isEnabled !== false) {
      const blogs = await Blogs.find({
        isActive: true,
        isDeleted: { $ne: true },
      })
        .select("_id title description coverImage seo createdAt viewCount authorId")
        .populate("authorId", "firstName lastName")
        .sort({ createdAt: -1 })
        .limit(4) // Max 4 blogs
        .lean();

      // Map authorId to author name (combine firstName and lastName)
      const blogsWithAuthor = blogs.map((blog: any) => {
        let authorName = null;
        if (blog.authorId && typeof blog.authorId === "object") {
          const firstName = blog.authorId.firstName || "";
          const lastName = blog.authorId.lastName || "";
          authorName = `${firstName} ${lastName}`.trim() || null;
        }
        return {
          ...blog,
          author: authorName,
        };
      });

      (landingPage as any).blogSection = {
        ...landingPage.blogSection,
        blogs: blogsWithAuthor,
      };
    }

    // Fetch Testimonials from ProductTestimonials model if Testimonials section is enabled
    if (landingPage.testimonialsSection && landingPage.testimonialsSection.isEnabled !== false) {
      const testimonials = await ProductTestimonials.find({
        isVisibleInLP: true,
        isActive: true,
        isDeleted: { $ne: true },
      })
        .populate({
          path: "products",
          match: { isDeleted: { $ne: true } },
          populate: [
            {
              path: "categories",
              select: "sId slug name description sortOrder icon image productCount",
            },
          ],
        })
        .select("_id videoUrl videoThumbnail products isFeatured displayOrder")
        .sort({ isFeatured: -1, createdAt: -1 }) // isFeatured = true first, then latest
        .limit(6) // Max 6 testimonials
        .lean();

      (landingPage as any).testimonialsSection = {
        ...landingPage.testimonialsSection,
        testimonials: testimonials,
      };
    }

    // Fetch Product Categories from ProductCategory model if ProductCategory section is enabled
    if (landingPage.productCategorySection && landingPage.productCategorySection.isEnabled !== false) {
      // Fetch latest max 10 categories dynamically from product_categories table
      const categories = await ProductCategory.find({
        isActive: true,
        isDeleted: { $ne: true },
      })
        .select("_id slug name description sortOrder icon image productCount")
        .sort({ createdAt: -1 }) // Latest first
        .limit(10) // Max 10 categories
        .lean();

      (landingPage as any).productCategorySection = {
        ...landingPage.productCategorySection,
        productCategories: categories,
      };
    }

    return { landingPage };
  }

  /**
   * Get active landing page (for public use).
   * Populates related data: product categories, testimonials, blogs, FAQs.
   * Filters sections by isEnabled and sorts by order.
   * Returns content in requested language by picking from stored I18n (no runtime translation;
   * landing page is stored in multi-language at create/update time in admin).
   * @param lang - Language code (en, nl, de, fr, es). Defaults to "en"
   * @param userId - Optional user ID for authenticated users (to add is_liked and isInCart fields)
   */
  async getActiveLandingPage(
    lang: SupportedLanguage = "en",
    userId?: string | null
  ): Promise<{ landingPage: any }> {
    // Cache only for public (unauthenticated) requests
    if (!userId) {
      const cached = landingPageCache.get(lang);
      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }
    }

    const t0 = Date.now();
    logger.debug(`[Landing Page Service] Processing with language: ${lang}`);

    const landingPage = await LandingPages.findOne({
      isActive: true,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .lean();
    const t1 = Date.now();
    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Landing Page] DB: LandingPages.findOne took ${t1 - t0}ms`);
    }

    if (!landingPage) {
      throw new AppError("No active landing page found", 404);
    }

    // Fetch categories, blogs, FAQs, and testimonials (first query) in parallel
    const productCategoryEnabled =
      landingPage.productCategorySection?.isEnabled !== false;
    const blogSectionEnabled =
      landingPage.blogSection?.isEnabled !== false;
    const faqSectionEnabled =
      landingPage.faqSection?.isEnabled !== false;
    const testimonialsEnabled =
      landingPage.testimonialsSection?.isEnabled !== false;

    const withTiming = (label: string, p: Promise<any>) => {
      const start = Date.now();
      return p.finally(() => {
        if (process.env.NODE_ENV !== "test") {
          logger.info(`[Landing Page] DB: ${label} took ${Date.now() - start}ms`);
        }
      });
    };

    // Testimonials: fetch without populate to avoid 13s+ nested populate; we populate products/categories in batch later
    const testimonialsQuery = () =>
      ProductTestimonials.find({
        isVisibleInLP: true,
        isActive: true,
        isDeleted: { $ne: true },
      })
        .select("_id videoUrl videoThumbnail products isFeatured displayOrder")
        .sort({ isFeatured: -1, createdAt: -1 })
        .limit(6)
        .lean();

    const [categoriesResult, blogsResult, faqsResult, testimonialsFirst] =
      await Promise.all([
        productCategoryEnabled
          ? withTiming(
              "categories",
              ProductCategory.find({
                isActive: true,
                isDeleted: { $ne: true },
              })
                .select("_id slug name description sortOrder icon image productCount")
                .sort({ createdAt: -1 })
                .limit(10)
                .lean()
            )
          : Promise.resolve([]),
        // Select excerpt (short I18n) for cards; full description only on blog detail — keeps query fast.
        blogSectionEnabled
          ? withTiming(
              "blogs",
              Blogs.find({
                isActive: true,
                isDeleted: { $ne: true },
              })
                .select("_id title excerpt coverImage seo createdAt viewCount authorId")
                .sort({ createdAt: -1 })
                .limit(4)
                .lean()
            )
          : Promise.resolve([]),
        faqSectionEnabled
          ? withTiming(
              "faqs",
              FAQs.find({
                isDeleted: { $ne: true },
                $or: [
                  { status: FAQStatus.ACTIVE },
                  { status: { $exists: false }, isActive: { $ne: false } },
                ],
              })
                .select("_id question answer sortOrder")
                .sort({ sortOrder: 1, createdAt: -1 })
                .limit(8)
                .lean()
            )
          : Promise.resolve([]),
        testimonialsEnabled
          ? withTiming("testimonials", testimonialsQuery())
          : Promise.resolve([]),
      ]);
    const t2 = Date.now();
    if (process.env.NODE_ENV !== "test") {
      logger.info(
        `[Landing Page] DB: Promise.all(categories,blogs,faqs,testimonials) took ${t2 - t1}ms`
      );
    }

    // Filter sections by isEnabled and prepare for sorting
    const processedLandingPage: any = { ...landingPage };

    // Filter and sort Hero Section
    if (
      landingPage.heroSection &&
      landingPage.heroSection.isEnabled !== false
    ) {
      // Sort primaryCTA by order
      if (landingPage.heroSection.primaryCTA) {
        processedLandingPage.heroSection = {
          ...landingPage.heroSection,
          primaryCTA: landingPage.heroSection.primaryCTA
            .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
            .slice(0, 3), // Max 3 CTAs
        };
      }
    } else {
      delete processedLandingPage.heroSection;
    }

    // Filter and process Membership Section
    if (
      landingPage.membershipSection &&
      landingPage.membershipSection.isEnabled !== false
    ) {
      if (landingPage.membershipSection.benefits) {
        processedLandingPage.membershipSection = {
          ...landingPage.membershipSection,
          benefits: landingPage.membershipSection.benefits
            .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
            .slice(0, 5), // Max 5 benefits
        };
      }
    } else {
      delete processedLandingPage.membershipSection;
    }

    // Filter and process How It Works Section
    if (
      landingPage.howItWorksSection &&
      landingPage.howItWorksSection.isEnabled !== false
    ) {
      const stepsCount = landingPage.howItWorksSection.stepsCount || 3; // Default 3
      processedLandingPage.howItWorksSection = {
        ...landingPage.howItWorksSection,
        steps: landingPage.howItWorksSection.steps
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
          .slice(0, stepsCount),
      };
    } else {
      delete processedLandingPage.howItWorksSection;
    }

    // Product Category Section (use pre-fetched categoriesResult)
    if (
      landingPage.productCategorySection &&
      landingPage.productCategorySection.isEnabled !== false
    ) {
      processedLandingPage.productCategorySection = {
        ...landingPage.productCategorySection,
        productCategories: categoriesResult,
      };
    } else {
      delete processedLandingPage.productCategorySection;
    }

    // Filter and process Community Section
    if (
      landingPage.communitySection &&
      landingPage.communitySection.isEnabled !== false
    ) {
      if (landingPage.communitySection.metrics) {
        processedLandingPage.communitySection = {
          ...landingPage.communitySection,
          metrics: landingPage.communitySection.metrics
            .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
            .slice(0, 6), // Max 6 metrics
        };
      }
    } else {
      delete processedLandingPage.communitySection;
    }

    // Filter Mission Section
    if (
      landingPage.missionSection &&
      landingPage.missionSection.isEnabled === false
    ) {
      delete processedLandingPage.missionSection;
    }

    // Filter and process Features Section (Why Choose Viteezy)
    if (
      landingPage.featuresSection &&
      landingPage.featuresSection.isEnabled !== false
    ) {
      if (landingPage.featuresSection.features) {
        processedLandingPage.featuresSection = {
          ...landingPage.featuresSection,
          features: landingPage.featuresSection.features
            .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
            .slice(0, 4), // Max 4 features
        };
      }
    } else {
      delete processedLandingPage.featuresSection;
    }

    // Filter and process Designed By Science Section
    if (
      landingPage.designedByScienceSection &&
      landingPage.designedByScienceSection.isEnabled !== false
    ) {
      processedLandingPage.designedByScienceSection = {
        ...landingPage.designedByScienceSection,
        steps: landingPage.designedByScienceSection.steps
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
          .slice(0, 4), // Max 4 pillars
      };
    } else {
      delete processedLandingPage.designedByScienceSection;
    }

    // Testimonials Section (use pre-fetched testimonialsFirst; fallback query only if empty)
    if (
      landingPage.testimonialsSection &&
      landingPage.testimonialsSection.isEnabled !== false
    ) {
      let testimonials = Array.isArray(testimonialsFirst) ? testimonialsFirst : [];

      if (testimonials.length === 0) {
        testimonials = await ProductTestimonials.find({
          isActive: true,
          isDeleted: { $ne: true },
        })
          .select("_id videoUrl videoThumbnail products isFeatured displayOrder")
          .sort({ isFeatured: -1, createdAt: -1 })
          .limit(6)
          .lean();
      }

      // Batch populate products + categories (one query instead of nested populate)
      const productIds = new Set<string>();
      for (const t of testimonials) {
        const list = (t as any).products;
        if (Array.isArray(list)) {
          list.forEach((id: any) => {
            if (id && mongoose.Types.ObjectId.isValid(id)) {
              productIds.add(id.toString());
            }
          });
        }
      }
      let productsMap = new Map<string, any>();
      if (productIds.size > 0) {
        const products = await Products.find({
          _id: { $in: Array.from(productIds).map((id) => new mongoose.Types.ObjectId(id)) },
          isDeleted: { $ne: true },
        })
          .populate("categories", "sId slug name description sortOrder icon image productCount")
          .lean();
        products.forEach((p: any) => {
          productsMap.set(p._id.toString(), p);
        });
      }
      for (const t of testimonials) {
        const list = (t as any).products;
        if (Array.isArray(list)) {
          (t as any).products = list
            .map((id: any) => {
              const key = id?.toString?.() ?? id;
              return productsMap.get(key) ?? null;
            })
            .filter(Boolean);
        }
      }

        // Manually populate ingredients for all products (since ingredients is string array, not ref)
        // Collect all unique ingredient IDs from all products
        const allIngredientIds = new Set<string>();
        for (const testimonial of testimonials) {
          if (testimonial.products && Array.isArray(testimonial.products)) {
            for (const product of testimonial.products) {
              const productObj = product as any;
              if (productObj.ingredients && Array.isArray(productObj.ingredients) && productObj.ingredients.length > 0) {
                productObj.ingredients.forEach((id: any) => {
                  if (mongoose.Types.ObjectId.isValid(id)) {
                    allIngredientIds.add(id.toString());
                  }
                });
              }
            }
          }
        }

        // Batch fetch all ingredients
        let ingredientsMap = new Map<string, any>();
        if (allIngredientIds.size > 0) {
          const ingredientObjectIds = Array.from(allIngredientIds).map(
            (id) => new mongoose.Types.ObjectId(id)
          );
          const ingredients = await ProductIngredients.find({
            _id: { $in: ingredientObjectIds },
            isDeleted: { $ne: true },
          })
            .select("sId slug name description sortOrder icon image _id")
            .lean();

          // Create a map for quick lookup
          ingredients.forEach((ingredient: any) => {
            ingredientsMap.set(ingredient._id.toString(), ingredient);
          });
        }

        // Wishlist/cart only for authenticated users (saves 2 DB calls for public requests)
        let userWishlistProductIds: Set<string> = new Set();
        let cartProductIds: Set<string> = new Set();
        if (userId) {
          try {
            const [wishlistItems, cartIds] = await Promise.all([
              Wishlists.find({ userId: new mongoose.Types.ObjectId(userId) })
                .select("productId")
                .lean(),
              cartService.getCartProductIds(userId),
            ]);
            userWishlistProductIds = new Set(
              wishlistItems.map((item: any) => item.productId.toString())
            );
            cartProductIds = cartIds;
          } catch (error) {
            logger.warn("Failed to fetch wishlist or cart for landing page", error);
          }
        }

        // Replace ingredient IDs with populated objects and transform products to single language
        for (const testimonial of testimonials) {
          if (testimonial.products && Array.isArray(testimonial.products)) {
            testimonial.products = testimonial.products.map((product: any) => {
              const productObj = product as any;

              // 1) Populate ingredients using the pre-fetched ingredientsMap
              if (
                productObj.ingredients &&
                Array.isArray(productObj.ingredients) &&
                productObj.ingredients.length > 0
              ) {
                const populatedIngredients = productObj.ingredients
                  .map((id: any) => {
                    const idStr = id.toString();
                    return ingredientsMap.get(idStr) || null;
                  })
                  .filter((ingredient: any) => ingredient !== null)
                  .map((ingredient: any) => ({
                    _id: ingredient._id,
                    sId: ingredient.sId,
                    slug: ingredient.slug,
                    name: getTranslatedString(ingredient.name, lang),
                    description: getTranslatedText(ingredient.description, lang),
                    sortOrder: ingredient.sortOrder,
                    icon: ingredient.icon || null,
                    image: ingredient.image || null,
                  }));

                productObj.ingredients = populatedIngredients;
              }

              // 2) Transform the entire product to a single language
              //    This handles:
              //    - title, description, shortDescription
              //    - benefits, healthGoals
              //    - nutritionInfo, howToUse
              //    - comparisonSection (title, columns, rows.label)
              //    - specification (main_title, items.title, items.descr)
              //    - any other I18n fields handled by transformProductForLanguage
              const translatedProduct = transformProductForLanguage(
                productObj,
                lang
              );

              // 3) Ensure categories names/descriptions are also flattened
              if (
                translatedProduct.categories &&
                Array.isArray(translatedProduct.categories) &&
                translatedProduct.categories.length > 0
              ) {
                translatedProduct.categories = translatedProduct.categories.map(
                  (category: any) => ({
                    ...category,
                    name: getTranslatedString(category.name, lang),
                    description: getTranslatedText(category.description, lang),
                  })
                );
              }

              // 4) Add is_liked and isInCart flags based on user context
              const isLiked =
                !!userId &&
                userWishlistProductIds.has(translatedProduct._id.toString());
              const isInCart =
                !!userId && cartProductIds.has(translatedProduct._id.toString());

              return {
                ...translatedProduct,
                is_liked: isLiked,
                isInCart,
              };
            });
          }
        }

      processedLandingPage.testimonialsSection = {
        ...landingPage.testimonialsSection,
        testimonials: testimonials,
      };
    } else {
      delete processedLandingPage.testimonialsSection;
    }

    // Filter Customer Results Section
    if (
      landingPage.customerResultsSection &&
      landingPage.customerResultsSection.isEnabled === false
    ) {
      delete processedLandingPage.customerResultsSection;
    }

    // Blogs Section (use pre-fetched blogsResult; batch-fetch authors to avoid slow populate)
    if (
      landingPage.blogSection &&
      landingPage.blogSection.isEnabled !== false
    ) {
      const authorIds = (blogsResult as any[])
        .map((b) => b.authorId)
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id));
      const uniqueAuthorIds = Array.from(new Set(authorIds.map((id: any) => id.toString())));
      let authorMap = new Map<string, { firstName?: string; lastName?: string }>();
      if (uniqueAuthorIds.length > 0) {
        const authors = await User.find({
          _id: { $in: uniqueAuthorIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select("firstName lastName")
          .lean();
        authors.forEach((a: any) => {
          authorMap.set(a._id.toString(), a);
        });
      }
      const blogsWithAuthor = (blogsResult as any[]).map((blog: any) => {
        let authorName: string | null = null;
        if (blog.authorId) {
          const a = authorMap.get(blog.authorId.toString?.() ?? blog.authorId);
          if (a) {
            authorName = `${a.firstName || ""} ${a.lastName || ""}`.trim() || null;
          }
        }
        return {
          ...blog,
          author: authorName,
        };
      });

      processedLandingPage.blogSection = {
        ...landingPage.blogSection,
        blogs: blogsWithAuthor,
      };
    } else {
      delete processedLandingPage.blogSection;
    }

    // FAQs Section (use pre-fetched faqsResult)
    if (landingPage.faqSection && landingPage.faqSection.isEnabled !== false) {
      const mappedFaqs = faqsResult.map((faq: any) => ({
        _id: faq._id,
        question: faq.question,
        answer: faq.answer,
        order: faq.sortOrder || 0,
      }));

      processedLandingPage.faqSection = {
        ...landingPage.faqSection,
        faqs: mappedFaqs,
      };
    } else {
      delete processedLandingPage.faqSection;
    }

    // Sort all sections by order
    const sections: Array<{ name: string; order: number }> = [];
    if (processedLandingPage.heroSection) {
      sections.push({
        name: "heroSection",
        order: processedLandingPage.heroSection.order || 0,
      });
    }
    if (processedLandingPage.membershipSection) {
      sections.push({
        name: "membershipSection",
        order: processedLandingPage.membershipSection.order || 0,
      });
    }
    if (processedLandingPage.howItWorksSection) {
      sections.push({
        name: "howItWorksSection",
        order: processedLandingPage.howItWorksSection.order || 0,
      });
    }
    if (processedLandingPage.productCategorySection) {
      sections.push({
        name: "productCategorySection",
        order: processedLandingPage.productCategorySection.order || 0,
      });
    }
    if (processedLandingPage.communitySection) {
      sections.push({
        name: "communitySection",
        order: processedLandingPage.communitySection.order || 0,
      });
    }
    if (processedLandingPage.missionSection) {
      sections.push({
        name: "missionSection",
        order: processedLandingPage.missionSection.order || 0,
      });
    }
    if (processedLandingPage.featuresSection) {
      sections.push({
        name: "featuresSection",
        order: processedLandingPage.featuresSection.order || 0,
      });
    }
    if (processedLandingPage.designedByScienceSection) {
      sections.push({
        name: "designedByScienceSection",
        order: processedLandingPage.designedByScienceSection.order || 0,
      });
    }
    if (processedLandingPage.testimonialsSection) {
      sections.push({
        name: "testimonialsSection",
        order: processedLandingPage.testimonialsSection.order || 0,
      });
    }
    if (processedLandingPage.customerResultsSection) {
      sections.push({
        name: "customerResultsSection",
        order: processedLandingPage.customerResultsSection.order || 0,
      });
    }
    if (processedLandingPage.blogSection) {
      sections.push({
        name: "blogSection",
        order: processedLandingPage.blogSection.order || 0,
      });
    }
    if (processedLandingPage.faqSection) {
      sections.push({
        name: "faqSection",
        order: processedLandingPage.faqSection.order || 0,
      });
    }

    // Sort sections by order
    sections.sort((a, b) => a.order - b.order);

    // Add sectionOrder array to indicate display order
    processedLandingPage.sectionOrder = sections.map((s) => s.name);

    const t3 = Date.now();
    if (process.env.NODE_ENV !== "test") {
      logger.info(
        `[Landing Page] Sections build (testimonials/ingredients/wishlist) took ${t3 - t2}ms`
      );
    }

    // Pick requested language from stored I18n (no translation API)
    const transformedLandingPage = this.transformToLanguage(
      processedLandingPage,
      lang
    );

    const t4 = Date.now();
    if (process.env.NODE_ENV !== "test") {
      logger.info(
        `[Landing Page] transformToLanguage took ${t4 - t3}ms | total ${t4 - t0}ms`
      );
    }

    const result = { landingPage: transformedLandingPage };
    if (!userId) {
      landingPageCache.set(lang, {
        data: result,
        expiry: Date.now() + LANDING_PAGE_CACHE_TTL_MS,
      });
    }
    return result;
  }

  /**
   * Pick requested language from stored I18n for each field (no runtime translation).
   */
  private transformToLanguage(landingPage: any, lang: SupportedLanguage): any {
    logger.debug(`[Transform] Starting transformation to language: ${lang}`);

    const transformed: any = {
      _id: landingPage._id,
      isActive: landingPage.isActive,
      sectionOrder: landingPage.sectionOrder,
      createdAt: landingPage.createdAt,
      updatedAt: landingPage.updatedAt,
    };

    // Transform Hero Section
    if (landingPage.heroSection) {
      const heroTitle = getTranslatedString(
        landingPage.heroSection.title,
        lang
      );

      transformed.heroSection = {
        imageUrl: landingPage.heroSection.imageUrl,
        videoUrl: landingPage.heroSection.videoUrl,
        backgroundImage: landingPage.heroSection.backgroundImage,
        title: heroTitle,
        highlightedText: transformI18nStringArray(
          landingPage.heroSection.highlightedText || [],
          lang
        ),
        subTitle: getTranslatedString(landingPage.heroSection.subTitle, lang),
        description: getTranslatedText(
          landingPage.heroSection.description,
          lang
        ),
        primaryCTA: (landingPage.heroSection.primaryCTA || []).map(
          (cta: any) => ({
            label: getTranslatedString(cta.label, lang),
            image: cta.image,
            link: cta.link,
            order: cta.order,
          })
        ),
        isEnabled: landingPage.heroSection.isEnabled,
        order: landingPage.heroSection.order,
      };
    }

    // Transform Membership Section
    if (landingPage.membershipSection) {
      transformed.membershipSection = {
        backgroundImage: landingPage.membershipSection.backgroundImage,
        title: getTranslatedString(landingPage.membershipSection.title, lang),
        description: getTranslatedText(
          landingPage.membershipSection.description,
          lang
        ),
        benefits: (landingPage.membershipSection.benefits || []).map(
          (benefit: any) => ({
            icon: benefit.icon,
            title: getTranslatedString(benefit.title, lang),
            description: getTranslatedText(benefit.description, lang),
            order: benefit.order,
          })
        ),
        isEnabled: landingPage.membershipSection.isEnabled,
        order: landingPage.membershipSection.order,
      };
    }

    // Transform How It Works Section
    if (landingPage.howItWorksSection) {
      transformed.howItWorksSection = {
        title: getTranslatedString(landingPage.howItWorksSection.title, lang),
        subTitle: getTranslatedString(
          landingPage.howItWorksSection.subTitle,
          lang
        ),
        stepsCount: landingPage.howItWorksSection.stepsCount,
        steps: (landingPage.howItWorksSection.steps || []).map((step: any) => ({
          image: step.image,
          title: getTranslatedString(step.title, lang),
          description: getTranslatedText(step.description, lang),
          order: step.order,
        })),
        isEnabled: landingPage.howItWorksSection.isEnabled,
        order: landingPage.howItWorksSection.order,
      };
    }

    // Transform Product Category Section
    if (landingPage.productCategorySection) {
      transformed.productCategorySection = {
        title: getTranslatedString(
          landingPage.productCategorySection.title,
          lang
        ),
        description: getTranslatedText(
          landingPage.productCategorySection.description,
          lang
        ),
        productCategories: (
          landingPage.productCategorySection.productCategories || []
        ).map((cat: any) => ({
          _id: cat._id,
          slug: cat.slug,
          name: getTranslatedString(cat.name, lang),
          description: getTranslatedText(cat.description, lang),
          sortOrder: cat.sortOrder,
          icon: cat.icon,
          image: cat.image,
          productCount: cat.productCount,
        })),
        isEnabled: landingPage.productCategorySection.isEnabled,
        order: landingPage.productCategorySection.order,
      };
    }

    // Transform Community Section
    if (landingPage.communitySection) {
      transformed.communitySection = {
        backgroundImage: landingPage.communitySection.backgroundImage,
        title: getTranslatedString(landingPage.communitySection.title, lang),
        subTitle: getTranslatedString(
          landingPage.communitySection.subTitle,
          lang
        ),
        metrics: (landingPage.communitySection.metrics || []).map(
          (metric: any) => ({
            label: getTranslatedString(metric.label, lang),
            value: metric.value,
            order: metric.order,
          })
        ),
        isEnabled: landingPage.communitySection.isEnabled,
        order: landingPage.communitySection.order,
      };
    }

    // Transform Mission Section
    if (landingPage.missionSection) {
      transformed.missionSection = {
        backgroundImage: landingPage.missionSection.backgroundImage,
        title: getTranslatedString(landingPage.missionSection.title, lang),
        description: getTranslatedText(
          landingPage.missionSection.description,
          lang
        ),
        isEnabled: landingPage.missionSection.isEnabled,
        order: landingPage.missionSection.order,
      };
    }

    // Transform Features Section
    if (landingPage.featuresSection) {
      transformed.featuresSection = {
        title: getTranslatedString(landingPage.featuresSection.title, lang),
        description: getTranslatedText(
          landingPage.featuresSection.description,
          lang
        ),
        features: (landingPage.featuresSection.features || []).map(
          (feature: any) => ({
            icon: feature.icon,
            title: getTranslatedString(feature.title, lang),
            description: getTranslatedText(feature.description, lang),
            order: feature.order,
          })
        ),
        isEnabled: landingPage.featuresSection.isEnabled,
        order: landingPage.featuresSection.order,
      };
    }

    // Transform Designed By Science Section
    if (landingPage.designedByScienceSection) {
      transformed.designedByScienceSection = {
        title: getTranslatedString(
          landingPage.designedByScienceSection.title,
          lang
        ),
        description: getTranslatedText(
          landingPage.designedByScienceSection.description,
          lang
        ),
        steps: (landingPage.designedByScienceSection.steps || []).map(
          (step: any) => ({
            image: step.image,
            title: getTranslatedString(step.title, lang),
            description: getTranslatedText(step.description, lang),
            order: step.order,
          })
        ),
        isEnabled: landingPage.designedByScienceSection.isEnabled,
        order: landingPage.designedByScienceSection.order,
      };
    }

    // Transform Testimonials Section
    if (landingPage.testimonialsSection) {
      transformed.testimonialsSection = {
        title: getTranslatedString(landingPage.testimonialsSection.title, lang),
        subTitle: getTranslatedString(
          landingPage.testimonialsSection.subTitle,
          lang
        ),
        testimonials: landingPage.testimonialsSection.testimonials || [],
        isEnabled: landingPage.testimonialsSection.isEnabled,
        order: landingPage.testimonialsSection.order,
      };
    }

    // Transform Customer Results Section
    if (landingPage.customerResultsSection) {
      transformed.customerResultsSection = {
        title: getTranslatedString(
          landingPage.customerResultsSection.title,
          lang
        ),
        description: getTranslatedText(
          landingPage.customerResultsSection.description,
          lang
        ),
        isEnabled: landingPage.customerResultsSection.isEnabled,
        order: landingPage.customerResultsSection.order,
      };
    }

    // Transform Blog Section
    if (landingPage.blogSection) {
      transformed.blogSection = {
        title: getTranslatedString(landingPage.blogSection.title, lang),
        description: getTranslatedText(
          landingPage.blogSection.description,
          lang
        ),
        blogs: (landingPage.blogSection.blogs || []).map((blog: any) => ({
          _id: blog._id,
          title: getTranslatedString(blog.title, lang),
          description: getTranslatedText(blog.excerpt ?? blog.description, lang),
          coverImage: blog.coverImage,
          seo: blog.seo,
          createdAt: blog.createdAt,
          viewCount: blog.viewCount,
          author: blog.author || null,
        })),
        isEnabled: landingPage.blogSection.isEnabled,
        order: landingPage.blogSection.order,
      };
    }

    // Transform FAQ Section
    if (landingPage.faqSection) {
      transformed.faqSection = {
        title: getTranslatedString(landingPage.faqSection.title, lang),
        description: getTranslatedText(
          landingPage.faqSection.description,
          lang
        ),
        faqs: (landingPage.faqSection.faqs || []).map((faq: any) => ({
          _id: faq._id,
          question: getTranslatedString(faq.question, lang),
          answer: getTranslatedText(faq.answer, lang),
          order: faq.order,
        })),
        isEnabled: landingPage.faqSection.isEnabled,
        order: landingPage.faqSection.order,
      };
    }

    return transformed;
  }

  /**
   * Update landing page with automatic multi-language translation
   */
  async updateLandingPage(
    landingPageId: string,
    data: UpdateLandingPageData
  ): Promise<{ landingPage: any; message: string }> {
    const landingPage = await LandingPages.findOne({
      _id: landingPageId,
      isDeleted: { $ne: true },
    });

    if (!landingPage) {
      throw new AppError("Landing page not found", 404);
    }

    logger.info(`[Landing Page Service] Updating landing page with automatic translation: ${landingPageId}`);

    // Define all I18n string and text fields for translation (same as create)
    const i18nStringFields = [
      "heroSection.title",
      "heroSection.subTitle",
      "heroSection.highlightedText",
      "heroSection.primaryCTA.label",
      "membershipSection.title",
      "membershipSection.subTitle",
      "membershipSection.benefits.title",
      "membershipSection.benefits.description",
      "howItWorksSection.title",
      "howItWorksSection.subTitle",
      "howItWorksSection.steps.title",
      "howItWorksSection.steps.description",
      "productCategorySection.title",
      "productCategorySection.subTitle",
      "communitySection.title",
      "communitySection.subTitle",
      "communitySection.metrics.label",
      "missionSection.title",
      "featuresSection.title",
      "featuresSection.subTitle",
      "featuresSection.features.title",
      "featuresSection.features.description",
      "designedByScienceSection.title",
      "designedByScienceSection.steps.title",
      "designedByScienceSection.steps.description",
      "testimonialsSection.title",
      "testimonialsSection.subTitle",
      "customerResultsSection.title",
      "blogSection.title",
      "faqSection.title"
    ];

    const i18nTextFields = [
      "heroSection.description",
      "membershipSection.description",
      "membershipSection.benefits.description",
      "howItWorksSection.steps.description",
      "productCategorySection.description",
      "communitySection.subTitle",
      "missionSection.description",
      "featuresSection.description",
      "featuresSection.features.description",
      "designedByScienceSection.description",
      "designedByScienceSection.steps.description",
      "customerResultsSection.description",
      "blogSection.description",
      "faqSection.description"
    ];

    // Translate data to all supported languages
    const translatedData = await prepareDataForTranslation(data, i18nStringFields, i18nTextFields);

    // Update fields
    // Rule: Non-image fields that are NOT in request -> empty/remove
    // Image fields that are NOT in request -> preserve existing
    if (data.heroSection && translatedData.heroSection) {
      // Image fields: only update if explicitly provided
      if (data.heroSection.media !== undefined) {
        if (data.heroSection.media) {
          const mediaUpdate: any = {
            type: data.heroSection.media.type,
            url: data.heroSection.media.url,
            sortOrder: data.heroSection.media.sortOrder,
          };
          (landingPage.heroSection.media as any) = {
            ...(landingPage.heroSection.media as any),
            ...mediaUpdate,
          };
        }
      }
      if (data.heroSection.imageUrl !== undefined) {
        (landingPage.heroSection as any).imageUrl = data.heroSection.imageUrl ?? "";
      }
      if (data.heroSection.videoUrl !== undefined) {
        (landingPage.heroSection as any).videoUrl = data.heroSection.videoUrl ?? "";
      }
      if (data.heroSection.backgroundImage !== undefined) {
        (landingPage.heroSection as any).backgroundImage = data.heroSection.backgroundImage ?? "";
      }
      
      // Non-image fields: update if provided, else empty (now using translated data)
      if (data.heroSection.title !== undefined) {
        if (translatedData.heroSection.title) {
          const convertedTitle = convertToI18n(translatedData.heroSection.title);
          (landingPage.heroSection.title as any) = convertedTitle || {};
        } else {
          (landingPage.heroSection.title as any) = {};
        }
      }
      if (data.heroSection.description !== undefined) {
        if (translatedData.heroSection.description) {
          const convertedDesc = convertToI18n(translatedData.heroSection.description);
          (landingPage.heroSection.description as any) = convertedDesc || {};
        } else {
          (landingPage.heroSection.description as any) = {};
        }
      }
      if (data.heroSection.subTitle !== undefined) {
        if (translatedData.heroSection.subTitle) {
          const convertedSubTitle = convertToI18n(translatedData.heroSection.subTitle);
          (landingPage.heroSection.subTitle as any) = convertedSubTitle || {};
        } else {
          (landingPage.heroSection.subTitle as any) = {};
        }
      }
      if (data.heroSection.highlightedText !== undefined) {
        (landingPage.heroSection.highlightedText as any) = Array.isArray(translatedData.heroSection.highlightedText)
          ? translatedData.heroSection.highlightedText.map((text: any) => convertToI18n(text))
          : [];
      }
      if (data.heroSection.isEnabled !== undefined) {
        (landingPage.heroSection as any).isEnabled = data.heroSection.isEnabled;
      }
      if (data.heroSection.order !== undefined) {
        (landingPage.heroSection as any).order = data.heroSection.order;
      }
      
      // Primary CTA: update if provided, preserve images if not provided (using translated data)
      if (Array.isArray(data.heroSection.primaryCTA)) {
        const existingCTA = (landingPage.heroSection as any).primaryCTA || [];
        const maxLen = Math.max(existingCTA.length, data.heroSection.primaryCTA.length, 3);
        const updatedCTA: any[] = [];
        for (let index = 0; index < maxLen; index++) {
          const cta = data.heroSection.primaryCTA[index];
          const translatedCTA = translatedData.heroSection.primaryCTA?.[index];
          const existing = existingCTA[index] || {};
          if (cta === undefined) {
            updatedCTA.push(existing);
            continue;
          }
          // Non-image fields: update if provided, else empty (using translated data)
          const label =
            cta.label !== undefined
              ? translatedCTA?.label
                ? convertToI18n(translatedCTA.label)
                : {}
              : {};
          const link = cta.link !== undefined ? cta.link : "";
          const order = cta.order !== undefined ? cta.order : index;
          // Image field: update if provided, else preserve existing
          const image = cta.image !== undefined ? (cta.image == null ? "" : cta.image) : (existing.image ?? "");
          updatedCTA.push({ label, image, link, order });
        }
        (landingPage.heroSection as any).primaryCTA = updatedCTA.slice(0, 3);
      }
    }

    // Update membership section
    if (data.membershipSection) {
      if (!landingPage.membershipSection) {
        (landingPage as any).membershipSection = {};
      }

      // Image fields: only update if explicitly provided
      if (data.membershipSection.backgroundImage !== undefined) {
        (landingPage.membershipSection as any).backgroundImage =
          data.membershipSection.backgroundImage ?? "";
      }

      // Non-image fields: update if provided, else empty
      if (data.membershipSection.title !== undefined) {
        if (data.membershipSection.title) {
          const existingTitle = (landingPage.membershipSection as any)?.title;
          const titleObj =
            existingTitle &&
            typeof existingTitle === "object" &&
            !Array.isArray(existingTitle)
              ? (existingTitle as Record<string, any>)
              : {};
          (landingPage.membershipSection as any).title =
            typeof data.membershipSection.title === "string"
              ? { ...titleObj, en: data.membershipSection.title }
              : {
                  ...titleObj,
                  ...(data.membershipSection.title as Record<string, any>),
                };
        } else {
          (landingPage.membershipSection as any).title = {};
        }
      }

      if (data.membershipSection.description !== undefined) {
        if (data.membershipSection.description) {
          const existingDesc = (landingPage.membershipSection as any)
            ?.description;
          const descObj =
            existingDesc &&
            typeof existingDesc === "object" &&
            !Array.isArray(existingDesc)
              ? (existingDesc as Record<string, any>)
              : {};
          (landingPage.membershipSection as any).description =
            typeof data.membershipSection.description === "string"
              ? { ...descObj, en: data.membershipSection.description }
              : {
                  ...descObj,
                  ...(data.membershipSection.description as Record<string, any>),
                };
        } else {
          (landingPage.membershipSection as any).description = {};
        }
      }

      if (data.membershipSection.isEnabled !== undefined) {
        (landingPage.membershipSection as any).isEnabled = data.membershipSection.isEnabled;
      }

      if (data.membershipSection.order !== undefined) {
        (landingPage.membershipSection as any).order = data.membershipSection.order;
      }

      // Benefits: update if provided, preserve images if not provided
      if (Array.isArray(data.membershipSection.benefits)) {
        const existingBenefits = (landingPage.membershipSection as any).benefits || [];
        const maxLen = Math.max(existingBenefits.length, data.membershipSection.benefits.length);
        const updatedBenefits: any[] = [];
        for (let index = 0; index < maxLen; index++) {
          const benefit = data.membershipSection.benefits[index];
          const existing = existingBenefits[index] || {};
          if (benefit === undefined) {
            updatedBenefits.push(existing);
            continue;
          }
          // Image field: update if provided, else preserve existing
          const icon = benefit.icon !== undefined ? (benefit.icon == null ? "" : benefit.icon) : (existing.icon ?? "");
          // Non-image fields: update if provided, else empty
          const title = benefit.title !== undefined
            ? (typeof benefit.title === "string" ? { en: benefit.title } : (benefit as any).title ?? {})
            : {};
          const description =
            benefit.description !== undefined
              ? typeof benefit.description === "string"
                ? { en: benefit.description }
                : ((benefit as any).description || {})
              : {};
          const order = benefit.order !== undefined ? benefit.order : index;
          updatedBenefits.push({ icon, title, description, order });
        }
        (landingPage.membershipSection as any).benefits = updatedBenefits.slice(0, 5);
      }
    }

    // Update how it works section
    if (data.howItWorksSection) {
      if (!landingPage.howItWorksSection) {
        (landingPage as any).howItWorksSection = {};
      }

      // Non-image fields: update if provided, else empty
      if (data.howItWorksSection.title !== undefined) {
        if (data.howItWorksSection.title) {
          const existingTitle = (landingPage.howItWorksSection as any)?.title;
          const titleObj =
            existingTitle &&
            typeof existingTitle === "object" &&
            !Array.isArray(existingTitle)
              ? (existingTitle as Record<string, any>)
              : {};
          (landingPage.howItWorksSection as any).title =
            typeof data.howItWorksSection.title === "string"
              ? { ...titleObj, en: data.howItWorksSection.title }
              : {
                  ...titleObj,
                  ...(data.howItWorksSection.title as Record<string, any>),
                };
        } else {
          (landingPage.howItWorksSection as any).title = {};
        }
      }

      if (data.howItWorksSection.subTitle !== undefined) {
        if (data.howItWorksSection.subTitle) {
          const existingSubTitle = (landingPage.howItWorksSection as any)?.subTitle;
          const subTitleObj =
            existingSubTitle &&
            typeof existingSubTitle === "object" &&
            !Array.isArray(existingSubTitle)
              ? (existingSubTitle as Record<string, any>)
              : {};
          (landingPage.howItWorksSection as any).subTitle =
            typeof data.howItWorksSection.subTitle === "string"
              ? { ...subTitleObj, en: data.howItWorksSection.subTitle }
              : {
                  ...subTitleObj,
                  ...(data.howItWorksSection.subTitle as Record<string, any>),
                };
        } else {
          (landingPage.howItWorksSection as any).subTitle = {};
        }
      }

      if (data.howItWorksSection.description !== undefined) {
        if (data.howItWorksSection.description) {
          const existingDesc = (landingPage.howItWorksSection as any)?.description;
          const descObj =
            existingDesc &&
            typeof existingDesc === "object" &&
            !Array.isArray(existingDesc)
              ? (existingDesc as Record<string, any>)
              : {};
          (landingPage.howItWorksSection as any).description =
            typeof data.howItWorksSection.description === "string"
              ? { ...descObj, en: data.howItWorksSection.description }
              : {
                  ...descObj,
                  ...(data.howItWorksSection.description as Record<string, any>),
                };
        } else {
          (landingPage.howItWorksSection as any).description = {};
        }
      }

      if (data.howItWorksSection.isEnabled !== undefined) {
        (landingPage.howItWorksSection as any).isEnabled = data.howItWorksSection.isEnabled;
      }

      if (data.howItWorksSection.order !== undefined) {
        (landingPage.howItWorksSection as any).order = data.howItWorksSection.order;
      }

      // Steps: update if provided, preserve images if not provided
      if (Array.isArray(data.howItWorksSection.steps)) {
        const existingSteps =
          (landingPage.howItWorksSection as any)?.steps || [];
        const updatedSteps = data.howItWorksSection.steps.map((step, index) => {
          const existingStep: any = existingSteps[index] || {};
          
          // Image field: update if provided, else preserve existing
          const image =
            step.image !== undefined ? (step.image == null ? "" : step.image) : (existingStep.image ?? "");
          
          // Non-image fields: update if provided, else empty
          const title = step.title !== undefined
            ? (typeof step.title === "string"
                ? { en: step.title }
                : (step.title as Record<string, any>))
            : {};
          const description =
            step.description !== undefined
              ? (typeof step.description === "string"
                  ? { en: step.description }
                  : (step.description as Record<string, any>))
              : {};
          const order =
            step.order !== undefined
              ? step.order
              : index;

          return { image, title, description, order };
        });

        (landingPage as any).howItWorksSection = {
          ...(landingPage.howItWorksSection as any),
          steps: updatedSteps,
        };
      }
    }

    // Update product category section
    if (data.productCategorySection) {
      if (!landingPage.productCategorySection) {
        (landingPage as any).productCategorySection = {};
      }

      // Non-image fields: update if provided, else empty
      if (data.productCategorySection.title !== undefined) {
        if (data.productCategorySection.title) {
          const existingTitle = (landingPage.productCategorySection as any)
            ?.title;
          const titleObj =
            existingTitle &&
            typeof existingTitle === "object" &&
            !Array.isArray(existingTitle)
              ? (existingTitle as Record<string, any>)
              : {};
          (landingPage.productCategorySection as any).title =
            typeof data.productCategorySection.title === "string"
              ? { ...titleObj, en: data.productCategorySection.title }
              : {
                  ...titleObj,
                  ...(data.productCategorySection.title as Record<string, any>),
                };
        } else {
          (landingPage.productCategorySection as any).title = {};
        }
      }

      if (data.productCategorySection.description !== undefined) {
        if (data.productCategorySection.description) {
          const existingDesc = (landingPage.productCategorySection as any)
            ?.description;
          const descObj =
            existingDesc &&
            typeof existingDesc === "object" &&
            !Array.isArray(existingDesc)
              ? (existingDesc as Record<string, any>)
              : {};
          (landingPage.productCategorySection as any).description =
            typeof data.productCategorySection.description === "string"
              ? { ...descObj, en: data.productCategorySection.description }
              : {
                  ...descObj,
                  ...(data.productCategorySection.description as Record<
                    string,
                    any
                  >),
                };
        } else {
          (landingPage.productCategorySection as any).description = {};
        }
      }

      if (
        (data.productCategorySection as any).productCategoryIds !== undefined
      ) {
        const ids = (data.productCategorySection as any).productCategoryIds;
        (landingPage.productCategorySection as any).productCategoryIds =
          Array.isArray(ids) && ids.length > 0
            ? ids.map((id: string) => new mongoose.Types.ObjectId(id))
            : [];
      }

      if (data.productCategorySection.isEnabled !== undefined) {
        (landingPage.productCategorySection as any).isEnabled = data.productCategorySection.isEnabled;
      }

      if (data.productCategorySection.order !== undefined) {
        (landingPage.productCategorySection as any).order = data.productCategorySection.order;
      }
    }

    // Update mission section
    if (data.missionSection) {
      if (!landingPage.missionSection) {
        (landingPage as any).missionSection = {};
      }

      // Image fields: only update if explicitly provided
      if (data.missionSection.backgroundImage !== undefined) {
        (landingPage.missionSection as any).backgroundImage =
          data.missionSection.backgroundImage ?? "";
      }

      // Non-image fields: update if provided, else empty
      if (data.missionSection.title !== undefined) {
        if (data.missionSection.title) {
          const existingTitle = (landingPage.missionSection as any)?.title;
          const titleObj =
            existingTitle &&
            typeof existingTitle === "object" &&
            !Array.isArray(existingTitle)
              ? (existingTitle as Record<string, any>)
              : {};
          (landingPage.missionSection as any).title =
            typeof data.missionSection.title === "string"
              ? { ...titleObj, en: data.missionSection.title }
              : {
                  ...titleObj,
                  ...(data.missionSection.title as Record<string, any>),
                };
        } else {
          (landingPage.missionSection as any).title = {};
        }
      }

      if (data.missionSection.description !== undefined) {
        if (data.missionSection.description) {
          const existingDesc = (landingPage.missionSection as any)?.description;
          const descObj =
            existingDesc &&
            typeof existingDesc === "object" &&
            !Array.isArray(existingDesc)
              ? (existingDesc as Record<string, any>)
              : {};
          (landingPage.missionSection as any).description =
            typeof data.missionSection.description === "string"
              ? { ...descObj, en: data.missionSection.description }
              : {
                  ...descObj,
                  ...(data.missionSection.description as Record<string, any>),
                };
        } else {
          (landingPage.missionSection as any).description = {};
        }
      }

      if (data.missionSection.isEnabled !== undefined) {
        (landingPage.missionSection as any).isEnabled = data.missionSection.isEnabled;
      }

      if (data.missionSection.order !== undefined) {
        (landingPage.missionSection as any).order = data.missionSection.order;
      }
    }

    // Update community section
    if (data.communitySection) {
      if (!landingPage.communitySection) {
        (landingPage as any).communitySection = {};
      }
      
      // Image fields: only update if explicitly provided
      if (data.communitySection.backgroundImage !== undefined) {
        (landingPage.communitySection as any).backgroundImage =
          data.communitySection.backgroundImage ?? "";
      }
      
      // Non-image fields: update if provided, else empty
      if (data.communitySection.title !== undefined) {
        if (data.communitySection.title) {
          const existingTitle = (landingPage.communitySection as any)?.title;
          const titleObj =
            existingTitle &&
            typeof existingTitle === "object" &&
            !Array.isArray(existingTitle)
              ? (existingTitle as Record<string, any>)
              : {};
          (landingPage.communitySection as any).title =
            typeof data.communitySection.title === "string"
              ? { ...titleObj, en: data.communitySection.title }
              : {
                  ...titleObj,
                  ...(data.communitySection.title as Record<string, any>),
                };
        } else {
          (landingPage.communitySection as any).title = {};
        }
      }
      if (data.communitySection.subTitle !== undefined) {
        if (data.communitySection.subTitle) {
          const existingSub = (landingPage.communitySection as any)?.subTitle;
          const subObj =
            existingSub &&
            typeof existingSub === "object" &&
            !Array.isArray(existingSub)
              ? (existingSub as Record<string, any>)
              : {};
          (landingPage.communitySection as any).subTitle =
            typeof data.communitySection.subTitle === "string"
              ? { ...subObj, en: data.communitySection.subTitle }
              : {
                  ...subObj,
                  ...(data.communitySection.subTitle as Record<string, any>),
                };
        } else {
          (landingPage.communitySection as any).subTitle = {};
        }
      }
      if (Array.isArray(data.communitySection.metrics)) {
        (landingPage.communitySection as any).metrics = data.communitySection.metrics.map(
          (metric: any, index: number) => ({
            label:
              typeof metric.label === "string"
                ? { en: metric.label }
                : (metric as any).label ?? {},
            value: metric.value ?? "",
            order: metric.order ?? index,
          })
        );
      } else if (data.communitySection.metrics !== undefined) {
        // If metrics is explicitly set to null/empty, clear it
        (landingPage.communitySection as any).metrics = [];
      }
      if (data.communitySection.isEnabled !== undefined) {
        (landingPage.communitySection as any).isEnabled = data.communitySection.isEnabled;
      }
      if (data.communitySection.order !== undefined) {
        (landingPage.communitySection as any).order = data.communitySection.order;
      }
    }

    // Update features section
    if (data.featuresSection) {
      if (!landingPage.featuresSection) {
        (landingPage as any).featuresSection = {};
      }

      // Non-image fields: update if provided, else empty
      if (data.featuresSection.title !== undefined) {
        if (data.featuresSection.title) {
          const existingTitle = (landingPage.featuresSection as any)?.title;
          const titleObj =
            existingTitle &&
            typeof existingTitle === "object" &&
            !Array.isArray(existingTitle)
              ? (existingTitle as Record<string, any>)
              : {};
          (landingPage.featuresSection as any).title =
            typeof data.featuresSection.title === "string"
              ? { ...titleObj, en: data.featuresSection.title }
              : {
                  ...titleObj,
                  ...(data.featuresSection.title as Record<string, any>),
                };
        } else {
          (landingPage.featuresSection as any).title = {};
        }
      }

      if (data.featuresSection.description !== undefined) {
        if (data.featuresSection.description) {
          const existingDesc = (landingPage.featuresSection as any)?.description;
          const descObj =
            existingDesc &&
            typeof existingDesc === "object" &&
            !Array.isArray(existingDesc)
              ? (existingDesc as Record<string, any>)
              : {};
          (landingPage.featuresSection as any).description =
            typeof data.featuresSection.description === "string"
              ? { ...descObj, en: data.featuresSection.description }
              : {
                  ...descObj,
                  ...(data.featuresSection.description as Record<string, any>),
                };
        } else {
          (landingPage.featuresSection as any).description = {};
        }
      }

      if (data.featuresSection.isEnabled !== undefined) {
        (landingPage.featuresSection as any).isEnabled = data.featuresSection.isEnabled;
      }

      if (data.featuresSection.order !== undefined) {
        (landingPage.featuresSection as any).order = data.featuresSection.order;
      }

      // Features array: update if provided, preserve images if not provided
      if (Array.isArray(data.featuresSection.features)) {
        const existingFeatures =
          (landingPage.featuresSection as any)?.features || [];
        const updatedFeatures = data.featuresSection.features.map(
          (feature, index) => {
            const existingFeature: any = existingFeatures[index] || {};
            
            // Image field: update if provided, else preserve existing
            const icon =
              feature.icon !== undefined
                ? (feature.icon == null ? "" : feature.icon)
                : (existingFeature.icon ?? "");
            
            // Non-image fields: update if provided, else empty
            const title = feature.title !== undefined
              ? (typeof feature.title === "string"
                  ? { en: feature.title }
                  : (feature.title as Record<string, any>))
              : {};
            const description =
              feature.description !== undefined
                ? (typeof feature.description === "string"
                    ? { en: feature.description }
                    : (feature.description as Record<string, any>))
                : {};
            const order =
              feature.order !== undefined
                ? feature.order
                : index;

            return { icon, title, description, order };
          }
        );

        (landingPage.featuresSection as any).features = updatedFeatures;
      } else if (data.featuresSection.features !== undefined) {
        // If features is explicitly set to null/empty, clear it
        (landingPage.featuresSection as any).features = [];
      }
    }

    // Update designed by science section
    if (data.designedByScienceSection) {
      if (!landingPage.designedByScienceSection) {
        (landingPage as any).designedByScienceSection = {};
      }

      // Non-image fields: update if provided, else empty
      if (data.designedByScienceSection.title !== undefined) {
        if (data.designedByScienceSection.title) {
          const existingTitle = (landingPage.designedByScienceSection as any)
            ?.title;
          const titleObj =
            existingTitle &&
            typeof existingTitle === "object" &&
            !Array.isArray(existingTitle)
              ? (existingTitle as Record<string, any>)
              : {};
          (landingPage.designedByScienceSection as any).title =
            typeof data.designedByScienceSection.title === "string"
              ? { ...titleObj, en: data.designedByScienceSection.title }
              : {
                  ...titleObj,
                  ...(data.designedByScienceSection.title as Record<string, any>),
                };
        } else {
          (landingPage.designedByScienceSection as any).title = {};
        }
      }

      if (data.designedByScienceSection.description !== undefined) {
        if (data.designedByScienceSection.description) {
          const existingDesc = (landingPage.designedByScienceSection as any)
            ?.description;
          const descObj =
            existingDesc &&
            typeof existingDesc === "object" &&
            !Array.isArray(existingDesc)
              ? (existingDesc as Record<string, any>)
              : {};
          (landingPage.designedByScienceSection as any).description =
            typeof data.designedByScienceSection.description === "string"
              ? { ...descObj, en: data.designedByScienceSection.description }
              : {
                  ...descObj,
                  ...(data.designedByScienceSection.description as Record<
                    string,
                    any
                  >),
                };
        } else {
          (landingPage.designedByScienceSection as any).description = {};
        }
      }

      if (data.designedByScienceSection.isEnabled !== undefined) {
        (landingPage.designedByScienceSection as any).isEnabled = data.designedByScienceSection.isEnabled;
      }

      if (data.designedByScienceSection.order !== undefined) {
        (landingPage.designedByScienceSection as any).order = data.designedByScienceSection.order;
      }

      // Steps: update if provided, preserve images if not provided
      if (Array.isArray(data.designedByScienceSection.steps)) {
        const existingSteps =
          (landingPage.designedByScienceSection as any)?.steps || [];
        const updatedSteps = data.designedByScienceSection.steps.map(
          (step, index) => {
            const existingStep: any = existingSteps[index] || {};
            
            // Image field: update if provided, else preserve existing
            const image =
              step.image !== undefined
                ? (step.image == null ? "" : step.image)
                : (existingStep.image ?? "");
            
            // Non-image fields: update if provided, else empty
            const title = step.title !== undefined
              ? (typeof step.title === "string"
                  ? { en: step.title }
                  : (step.title as Record<string, any>))
              : {};
            const description =
              step.description !== undefined
                ? (typeof step.description === "string"
                    ? { en: step.description }
                    : (step.description as Record<string, any>))
                : {};
            const order =
              step.order !== undefined
                ? step.order
                : index;

            return { image, title, description, order };
          }
        );

        if (!landingPage.designedByScienceSection) {
          (landingPage as any).designedByScienceSection = {};
        }
        (landingPage.designedByScienceSection as any).steps = updatedSteps;
      }
    }

    // Update customer results section
    if (data.customerResultsSection) {
      if (!landingPage.customerResultsSection) {
        (landingPage as any).customerResultsSection = {};
      }

      // Non-image fields: update if provided, else empty
      if (data.customerResultsSection.title !== undefined) {
        if (data.customerResultsSection.title) {
          const existingTitle = (landingPage.customerResultsSection as any)
            ?.title;
          const titleObj =
            existingTitle &&
            typeof existingTitle === "object" &&
            !Array.isArray(existingTitle)
              ? (existingTitle as Record<string, any>)
              : {};
          (landingPage.customerResultsSection as any).title =
            typeof data.customerResultsSection.title === "string"
              ? { ...titleObj, en: data.customerResultsSection.title }
              : {
                  ...titleObj,
                  ...(data.customerResultsSection.title as Record<string, any>),
                };
        } else {
          (landingPage.customerResultsSection as any).title = {};
        }
      }

      if (data.customerResultsSection.description !== undefined) {
        if (data.customerResultsSection.description) {
          const existingDesc = (landingPage.customerResultsSection as any)
            ?.description;
          const descObj =
            existingDesc &&
            typeof existingDesc === "object" &&
            !Array.isArray(existingDesc)
              ? (existingDesc as Record<string, any>)
              : {};
          (landingPage.customerResultsSection as any).description =
            typeof data.customerResultsSection.description === "string"
              ? { ...descObj, en: data.customerResultsSection.description }
              : {
                  ...descObj,
                  ...(data.customerResultsSection.description as Record<
                    string,
                    any
                  >),
                };
        } else {
          (landingPage.customerResultsSection as any).description = {};
        }
      }

      if (data.customerResultsSection.isEnabled !== undefined) {
        (landingPage.customerResultsSection as any).isEnabled = data.customerResultsSection.isEnabled;
      }

      if (data.customerResultsSection.order !== undefined) {
        (landingPage.customerResultsSection as any).order = data.customerResultsSection.order;
      }
    }

    // Update blog section
    if (data.blogSection) {
      if (!landingPage.blogSection) {
        (landingPage as any).blogSection = {};
      }

      // Non-image fields: update if provided, else empty
      if (data.blogSection.title !== undefined) {
        if (data.blogSection.title) {
          const existingTitle = (landingPage.blogSection as any)?.title;
          const titleObj =
            existingTitle &&
            typeof existingTitle === "object" &&
            !Array.isArray(existingTitle)
              ? (existingTitle as Record<string, any>)
              : {};
          (landingPage.blogSection as any).title =
            typeof data.blogSection.title === "string"
              ? { ...titleObj, en: data.blogSection.title }
              : {
                  ...titleObj,
                  ...(data.blogSection.title as Record<string, any>),
                };
        } else {
          (landingPage.blogSection as any).title = {};
        }
      }

      if (data.blogSection.description !== undefined) {
        if (data.blogSection.description) {
          const existingDesc = (landingPage.blogSection as any)?.description;
          const descObj =
            existingDesc &&
            typeof existingDesc === "object" &&
            !Array.isArray(existingDesc)
              ? (existingDesc as Record<string, any>)
              : {};
          (landingPage.blogSection as any).description =
            typeof data.blogSection.description === "string"
              ? { ...descObj, en: data.blogSection.description }
              : {
                  ...descObj,
                  ...(data.blogSection.description as Record<string, any>),
                };
        } else {
          (landingPage.blogSection as any).description = {};
        }
      }

      if (data.blogSection.isEnabled !== undefined) {
        (landingPage.blogSection as any).isEnabled = data.blogSection.isEnabled;
      }

      if (data.blogSection.order !== undefined) {
        (landingPage.blogSection as any).order = data.blogSection.order;
      }
    }

    // Update FAQ section
    if (data.faqSection) {
      if (!landingPage.faqSection) {
        (landingPage as any).faqSection = {};
      }

      // Non-image fields: update if provided, else empty
      if (data.faqSection.title !== undefined) {
        if (data.faqSection.title) {
          const existingTitle = (landingPage.faqSection as any)?.title;
          const titleObj =
            existingTitle &&
            typeof existingTitle === "object" &&
            !Array.isArray(existingTitle)
              ? (existingTitle as Record<string, any>)
              : {};
          (landingPage.faqSection as any).title =
            typeof data.faqSection.title === "string"
              ? { ...titleObj, en: data.faqSection.title }
              : {
                  ...titleObj,
                  ...(data.faqSection.title as Record<string, any>),
                };
        } else {
          (landingPage.faqSection as any).title = {};
        }
      }

      if (data.faqSection.description !== undefined) {
        if (data.faqSection.description) {
          const existingDesc = (landingPage.faqSection as any)?.description;
          const descObj =
            existingDesc &&
            typeof existingDesc === "object" &&
            !Array.isArray(existingDesc)
              ? (existingDesc as Record<string, any>)
              : {};
          (landingPage.faqSection as any).description =
            typeof data.faqSection.description === "string"
              ? { ...descObj, en: data.faqSection.description }
              : {
                  ...descObj,
                  ...(data.faqSection.description as Record<string, any>),
                };
        } else {
          (landingPage.faqSection as any).description = {};
        }
      }

      if (data.faqSection.isEnabled !== undefined) {
        (landingPage.faqSection as any).isEnabled = data.faqSection.isEnabled;
      }

      if (data.faqSection.order !== undefined) {
        (landingPage.faqSection as any).order = data.faqSection.order;
      }

      // FAQs are not updated here - they are fetched dynamically from FAQs model
    }

    // Update testimonials section
    if (data.testimonialsSection) {
      if (!landingPage.testimonialsSection) {
        (landingPage as any).testimonialsSection = {};
      }

      // Non-image fields: update if provided, else empty
      if (data.testimonialsSection.title !== undefined) {
        if (data.testimonialsSection.title) {
          const existingTitle = (landingPage.testimonialsSection as any)?.title;
          const titleObj =
            existingTitle &&
            typeof existingTitle === "object" &&
            !Array.isArray(existingTitle)
              ? (existingTitle as Record<string, any>)
              : {};
          (landingPage.testimonialsSection as any).title =
            typeof data.testimonialsSection.title === "string"
              ? { ...titleObj, en: data.testimonialsSection.title }
              : {
                  ...titleObj,
                  ...(data.testimonialsSection.title as Record<string, any>),
                };
        } else {
          (landingPage.testimonialsSection as any).title = {};
        }
      }

      if (data.testimonialsSection.subTitle !== undefined) {
        if (data.testimonialsSection.subTitle) {
          const existingSub = (landingPage.testimonialsSection as any)?.subTitle;
          const subObj =
            existingSub &&
            typeof existingSub === "object" &&
            !Array.isArray(existingSub)
              ? (existingSub as Record<string, any>)
              : {};
          (landingPage.testimonialsSection as any).subTitle =
            typeof data.testimonialsSection.subTitle === "string"
              ? { ...subObj, en: data.testimonialsSection.subTitle }
              : {
                  ...subObj,
                  ...(data.testimonialsSection.subTitle as Record<string, any>),
                };
        } else {
          (landingPage.testimonialsSection as any).subTitle = {};
        }
      }

      if (data.testimonialsSection.isEnabled !== undefined) {
        (landingPage.testimonialsSection as any).isEnabled = data.testimonialsSection.isEnabled;
      }

      if (data.testimonialsSection.order !== undefined) {
        (landingPage.testimonialsSection as any).order = data.testimonialsSection.order;
      }

      // Testimonials are not updated here - they are fetched dynamically from ProductTestimonials model
    }

    if (data.isActive !== undefined) {
      landingPage.isActive = data.isActive;
    }

    if (data.updatedBy) {
      (landingPage as any).updatedBy = data.updatedBy;
    }

    await landingPage.save();

    logger.info(`Landing page updated successfully: ${landingPage._id}`);

    return {
      landingPage: landingPage.toObject(),
      message: "Landing page updated successfully",
    };
  }

  /**
   * Delete landing page (soft delete)
   */
  async deleteLandingPage(landingPageId: string): Promise<{ message: string }> {
    const landingPage = await LandingPages.findOne({
      _id: landingPageId,
      isDeleted: { $ne: true },
    });

    if (!landingPage) {
      throw new AppError("Landing page not found", 404);
    }

    (landingPage as any).isDeleted = true;
    (landingPage as any).deletedAt = new Date();
    await landingPage.save();

    logger.info(`Landing page deleted successfully: ${landingPage._id}`);

    return { message: "Landing page deleted successfully" };
  }
}

export const landingPageService = new LandingPageService();
