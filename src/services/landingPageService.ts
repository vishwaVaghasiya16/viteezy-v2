import { LandingPages } from "../models/cms/landingPage.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import mongoose from "mongoose";
import { ProductCategory } from "../models/commerce/categories.model";
import { ProductIngredients } from "../models/commerce/productIngredients.model";
import { ProductTestimonials } from "../models/cms/productTestimonials.model";
import { Blogs } from "../models/cms/blogs.model";
import { FAQs } from "../models/cms/faqs.model";

type SupportedLanguage = "en" | "nl" | "de" | "fr" | "es";

/**
 * Get translated string from I18nStringType
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
 * Get translated text from I18nTextType (can be string or object)
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

interface PrimaryCTAInput {
  label: string;
  image?: string;
  link?: string;
  order?: number;
}

interface MembershipBenefitInput {
  icon?: string;
  title: string;
  description?: string;
  order?: number;
}

interface CommunityMetricInput {
  label: string;
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
    title: string; // Simple string for now
    description?: string; // Simple string for now
    subTitle?: string;
    highlightedText?: string[];
    primaryCTA?: PrimaryCTAInput[];
    isEnabled?: boolean;
    order?: number;
  };
  membershipSection?: {
    backgroundImage: string;
    title: string; // Simple string for now
    description?: string; // Simple string for now
    subTitle?: string;
    benefits?: MembershipBenefitInput[];
    isEnabled?: boolean;
    order?: number;
  };
  howItWorksSection?: {
    title?: string;
    subTitle?: string;
    stepsCount?: number;
    steps: Array<{
      image: string;
      title: string; // Simple string for now
      description?: string; // Simple string for now
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  productCategorySection?: {
    title: string; // Simple string for now
    description?: string; // Simple string for now
    subTitle?: string;
    productCategoryIds?: mongoose.Types.ObjectId[] | string[];
    isEnabled?: boolean;
    order?: number;
  };
  communitySection?: {
    backgroundImage?: string;
    title?: string;
    subTitle?: string;
    metrics?: CommunityMetricInput[];
    isEnabled?: boolean;
    order?: number;
  };
  missionSection?: {
    backgroundImage: string;
    title: string; // Simple string for now
    description?: string; // Simple string for now
    isEnabled?: boolean;
    order?: number;
  };
  featuresSection?: {
    title: string; // Simple string for now
    description?: string; // Simple string for now
    subTitle?: string;
    features: Array<{
      icon: string;
      title: string; // Simple string for now
      description?: string; // Simple string for now
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  designedByScienceSection?: {
    title: string; // Simple string for now
    description?: string; // Simple string for now
    steps: Array<{
      image: string;
      title: string; // Simple string for now
      description?: string; // Simple string for now
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  testimonialsSection?: {
    title?: string;
    subTitle?: string;
    testimonialIds?: (mongoose.Types.ObjectId | string)[];
    isEnabled?: boolean;
    order?: number;
  };
  customerResultsSection?: {
    title: string; // Simple string for now
    description?: string; // Simple string for now
    isEnabled?: boolean;
    order?: number;
  };
  blogSection?: {
    title: string; // Simple string for now
    description?: string; // Simple string for now
    isEnabled?: boolean;
    order?: number;
  };
  faqSection?: {
    title: string; // Simple string for now
    description?: string; // Simple string for now
    faqs: Array<{
      question: string; // Simple string for now
      answer?: string; // Simple string for now
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
    title?: string;
    description?: string;
    subTitle?: string;
    highlightedText?: string[];
    primaryCTA?: PrimaryCTAInput[];
    isEnabled?: boolean;
    order?: number;
  };
  membershipSection?: {
    backgroundImage?: string;
    title?: string;
    description?: string;
    subTitle?: string;
    benefits?: MembershipBenefitInput[];
    isEnabled?: boolean;
    order?: number;
  };
  howItWorksSection?: {
    title?: string;
    subTitle?: string;
    stepsCount?: number;
    steps?: Array<{
      image?: string;
      title?: string;
      description?: string;
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  productCategorySection?: {
    title?: string;
    description?: string;
    subTitle?: string;
    productCategoryIds?: (mongoose.Types.ObjectId | string)[];
    isEnabled?: boolean;
    order?: number;
  };
  communitySection?: {
    backgroundImage?: string;
    title?: string;
    subTitle?: string;
    metrics?: CommunityMetricInput[];
    isEnabled?: boolean;
    order?: number;
  };
  missionSection?: {
    backgroundImage?: string;
    title?: string;
    description?: string;
    isEnabled?: boolean;
    order?: number;
  };
  featuresSection?: {
    title?: string;
    description?: string;
    subTitle?: string;
    features?: Array<{
      icon?: string;
      title?: string;
      description?: string;
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  designedByScienceSection?: {
    title?: string;
    description?: string;
    steps?: Array<{
      image?: string;
      title?: string;
      description?: string;
      order?: number;
    }>;
    isEnabled?: boolean;
    order?: number;
  };
  testimonialsSection?: {
    title?: string;
    subTitle?: string;
    testimonialIds?: (mongoose.Types.ObjectId | string)[];
    isEnabled?: boolean;
    order?: number;
  };
  customerResultsSection?: {
    title?: string;
    description?: string;
    isEnabled?: boolean;
    order?: number;
  };
  blogSection?: {
    title?: string;
    description?: string;
    isEnabled?: boolean;
    order?: number;
  };
  faqSection?: {
    title?: string;
    description?: string;
    faqs?: Array<{
      question?: string;
      answer?: string;
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
   * Create new landing page
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

    // Convert simple strings to I18n format for database
    const landingPageData: any = {
      heroSection: {
        ...data.heroSection,
        imageUrl: data.heroSection.imageUrl,
        videoUrl: data.heroSection.videoUrl,
        backgroundImage: data.heroSection.backgroundImage,
        title:
          typeof data.heroSection.title === "string"
            ? { en: data.heroSection.title }
            : data.heroSection.title,
        description: data.heroSection.description
          ? typeof data.heroSection.description === "string"
            ? { en: data.heroSection.description }
            : data.heroSection.description
          : undefined,
        subTitle: data.heroSection.subTitle
          ? typeof data.heroSection.subTitle === "string"
            ? { en: data.heroSection.subTitle }
            : data.heroSection.subTitle
          : undefined,
        highlightedText: Array.isArray(data.heroSection.highlightedText)
          ? data.heroSection.highlightedText.map((text) =>
              typeof text === "string" ? { en: text } : text
            )
          : undefined,
        primaryCTA: Array.isArray(data.heroSection.primaryCTA)
          ? data.heroSection.primaryCTA.map((cta) => ({
              label:
                typeof cta.label === "string"
                  ? { en: cta.label }
                  : (cta as any).label,
              image: cta.image,
              link: cta.link,
              order: cta.order ?? 0,
            }))
          : undefined,
        isEnabled:
          data.heroSection.isEnabled !== undefined
            ? data.heroSection.isEnabled
            : true,
        order: data.heroSection.order ?? 0,
        media: data.heroSection.media
          ? {
              ...data.heroSection.media,
            }
          : undefined,
      },
      isActive: data.isActive ?? true,
      createdBy: data.createdBy,
    };

    // Convert membership section strings to I18n format
    if (data.membershipSection) {
      landingPageData.membershipSection = {
        backgroundImage: data.membershipSection.backgroundImage,
        title:
          typeof data.membershipSection.title === "string"
            ? { en: data.membershipSection.title }
            : data.membershipSection.title,
        description: data.membershipSection.description
          ? typeof data.membershipSection.description === "string"
            ? { en: data.membershipSection.description }
            : data.membershipSection.description
          : undefined,
        subTitle: data.membershipSection.subTitle
          ? typeof data.membershipSection.subTitle === "string"
            ? { en: data.membershipSection.subTitle }
            : data.membershipSection.subTitle
          : undefined,
        benefits: Array.isArray(data.membershipSection.benefits)
          ? data.membershipSection.benefits.map((benefit) => ({
              icon: benefit.icon,
              title:
                typeof benefit.title === "string"
                  ? { en: benefit.title }
                  : (benefit as any).title,
              description: benefit.description
                ? typeof benefit.description === "string"
                  ? { en: benefit.description }
                  : (benefit as any).description
                : undefined,
              order: benefit.order ?? 0,
            }))
          : undefined,
        isEnabled:
          data.membershipSection.isEnabled !== undefined
            ? data.membershipSection.isEnabled
            : true,
        order: data.membershipSection.order ?? 0,
      };
    }

    // Convert how it works section strings to I18n format
    if (data.howItWorksSection && data.howItWorksSection.steps) {
      landingPageData.howItWorksSection = {
        title: data.howItWorksSection.title
          ? typeof data.howItWorksSection.title === "string"
            ? { en: data.howItWorksSection.title }
            : (data.howItWorksSection as any).title
          : undefined,
        subTitle: data.howItWorksSection.subTitle
          ? typeof data.howItWorksSection.subTitle === "string"
            ? { en: data.howItWorksSection.subTitle }
            : (data.howItWorksSection as any).subTitle
          : undefined,
        stepsCount:
          data.howItWorksSection.stepsCount ??
          data.howItWorksSection.steps.length,
        steps: data.howItWorksSection.steps.map((step) => ({
          image: step.image,
          title:
            typeof step.title === "string" ? { en: step.title } : step.title,
          description: step.description
            ? typeof step.description === "string"
              ? { en: step.description }
              : step.description
            : undefined,
          order: step.order || 0,
        })),
        isEnabled:
          data.howItWorksSection.isEnabled !== undefined
            ? data.howItWorksSection.isEnabled
            : true,
        order: data.howItWorksSection.order ?? 0,
      };
    }

    // Convert product category section strings to I18n format
    if (data.productCategorySection) {
      landingPageData.productCategorySection = {
        title:
          typeof data.productCategorySection.title === "string"
            ? { en: data.productCategorySection.title }
            : data.productCategorySection.title,
        description: data.productCategorySection.description
          ? typeof data.productCategorySection.description === "string"
            ? { en: data.productCategorySection.description }
            : data.productCategorySection.description
          : undefined,
        subTitle: data.productCategorySection.subTitle
          ? typeof data.productCategorySection.subTitle === "string"
            ? { en: data.productCategorySection.subTitle }
            : (data.productCategorySection as any).subTitle
          : undefined,
        productCategoryIds: data.productCategorySection.productCategoryIds,
        isEnabled:
          data.productCategorySection.isEnabled !== undefined
            ? data.productCategorySection.isEnabled
            : true,
        order: data.productCategorySection.order ?? 0,
      };
    }

    // Community / Social Proof section
    if (data.communitySection) {
      landingPageData.communitySection = {
        backgroundImage: data.communitySection.backgroundImage,
        title: data.communitySection.title
          ? typeof data.communitySection.title === "string"
            ? { en: data.communitySection.title }
            : (data.communitySection as any).title
          : undefined,
        subTitle: data.communitySection.subTitle
          ? typeof data.communitySection.subTitle === "string"
            ? { en: data.communitySection.subTitle }
            : (data.communitySection as any).subTitle
          : undefined,
        metrics: Array.isArray(data.communitySection.metrics)
          ? data.communitySection.metrics.map((metric) => ({
              label:
                typeof metric.label === "string"
                  ? { en: metric.label }
                  : (metric as any).label,
              value: metric.value,
              order: metric.order ?? 0,
            }))
          : undefined,
        isEnabled:
          data.communitySection.isEnabled !== undefined
            ? data.communitySection.isEnabled
            : true,
        order: data.communitySection.order ?? 0,
      };
    }

    // Convert mission section strings to I18n format
    if (data.missionSection) {
      landingPageData.missionSection = {
        backgroundImage: data.missionSection.backgroundImage,
        title:
          typeof data.missionSection.title === "string"
            ? { en: data.missionSection.title }
            : data.missionSection.title,
        description: data.missionSection.description
          ? typeof data.missionSection.description === "string"
            ? { en: data.missionSection.description }
            : data.missionSection.description
          : undefined,
        isEnabled:
          data.missionSection.isEnabled !== undefined
            ? data.missionSection.isEnabled
            : true,
        order: data.missionSection.order ?? 0,
      };
    }

    // Convert features section strings to I18n format
    if (data.featuresSection && data.featuresSection.features) {
      landingPageData.featuresSection = {
        title:
          typeof data.featuresSection.title === "string"
            ? { en: data.featuresSection.title }
            : data.featuresSection.title,
        description: data.featuresSection.description
          ? typeof data.featuresSection.description === "string"
            ? { en: data.featuresSection.description }
            : data.featuresSection.description
          : undefined,
        subTitle: data.featuresSection.subTitle
          ? typeof data.featuresSection.subTitle === "string"
            ? { en: data.featuresSection.subTitle }
            : (data.featuresSection as any).subTitle
          : undefined,
        features: data.featuresSection.features.map((feature) => ({
          icon: feature.icon,
          title:
            typeof feature.title === "string"
              ? { en: feature.title }
              : feature.title,
          description: feature.description
            ? typeof feature.description === "string"
              ? { en: feature.description }
              : feature.description
            : undefined,
          order: feature.order || 0,
        })),
        isEnabled:
          data.featuresSection.isEnabled !== undefined
            ? data.featuresSection.isEnabled
            : true,
        order: data.featuresSection.order ?? 0,
      };
    }

    // Convert designed by science section strings to I18n format
    if (data.designedByScienceSection && data.designedByScienceSection.steps) {
      landingPageData.designedByScienceSection = {
        title:
          typeof data.designedByScienceSection.title === "string"
            ? { en: data.designedByScienceSection.title }
            : data.designedByScienceSection.title,
        description: data.designedByScienceSection.description
          ? typeof data.designedByScienceSection.description === "string"
            ? { en: data.designedByScienceSection.description }
            : data.designedByScienceSection.description
          : undefined,
        steps: data.designedByScienceSection.steps.map((step) => ({
          image: step.image,
          title:
            typeof step.title === "string" ? { en: step.title } : step.title,
          description: step.description
            ? typeof step.description === "string"
              ? { en: step.description }
              : step.description
            : undefined,
          order: step.order || 0,
        })),
        isEnabled:
          data.designedByScienceSection.isEnabled !== undefined
            ? data.designedByScienceSection.isEnabled
            : true,
        order: data.designedByScienceSection.order ?? 0,
      };
    }

    // Testimonials Section
    if (data.testimonialsSection) {
      landingPageData.testimonialsSection = {
        title: data.testimonialsSection.title
          ? typeof data.testimonialsSection.title === "string"
            ? { en: data.testimonialsSection.title }
            : (data.testimonialsSection as any).title
          : undefined,
        subTitle: data.testimonialsSection.subTitle
          ? typeof data.testimonialsSection.subTitle === "string"
            ? { en: data.testimonialsSection.subTitle }
            : (data.testimonialsSection as any).subTitle
          : undefined,
        testimonialIds: data.testimonialsSection.testimonialIds,
        isEnabled:
          data.testimonialsSection.isEnabled !== undefined
            ? data.testimonialsSection.isEnabled
            : true,
        order: data.testimonialsSection.order ?? 0,
      };
    }

    // Convert customer results section strings to I18n format
    if (data.customerResultsSection) {
      landingPageData.customerResultsSection = {
        title:
          typeof data.customerResultsSection.title === "string"
            ? { en: data.customerResultsSection.title }
            : data.customerResultsSection.title,
        description: data.customerResultsSection.description
          ? typeof data.customerResultsSection.description === "string"
            ? { en: data.customerResultsSection.description }
            : data.customerResultsSection.description
          : undefined,
        isEnabled:
          data.customerResultsSection.isEnabled !== undefined
            ? data.customerResultsSection.isEnabled
            : true,
        order: data.customerResultsSection.order ?? 0,
      };
    }

    // Convert blog section strings to I18n format
    if (data.blogSection) {
      landingPageData.blogSection = {
        title:
          typeof data.blogSection.title === "string"
            ? { en: data.blogSection.title }
            : data.blogSection.title,
        description: data.blogSection.description
          ? typeof data.blogSection.description === "string"
            ? { en: data.blogSection.description }
            : data.blogSection.description
          : undefined,
        isEnabled:
          data.blogSection.isEnabled !== undefined
            ? data.blogSection.isEnabled
            : true,
        order: data.blogSection.order ?? 0,
      };
    }

    // Convert FAQ section strings to I18n format
    if (data.faqSection && data.faqSection.faqs) {
      landingPageData.faqSection = {
        title:
          typeof data.faqSection.title === "string"
            ? { en: data.faqSection.title }
            : data.faqSection.title,
        description: data.faqSection.description
          ? typeof data.faqSection.description === "string"
            ? { en: data.faqSection.description }
            : data.faqSection.description
          : undefined,
        faqs: data.faqSection.faqs.map((faq) => ({
          question:
            typeof faq.question === "string"
              ? { en: faq.question }
              : faq.question,
          answer: faq.answer
            ? typeof faq.answer === "string"
              ? { en: faq.answer }
              : faq.answer
            : undefined,
          order: faq.order || 0,
        })),
        isEnabled:
          data.faqSection.isEnabled !== undefined
            ? data.faqSection.isEnabled
            : true,
        order: data.faqSection.order ?? 0,
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

    return { landingPages };
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

    return { landingPage };
  }

  /**
   * Get active landing page (for public use)
   * Populates related data: product categories, testimonials, blogs, FAQs
   * Filters sections by isEnabled and sorts by order
   * Transforms all I18n fields to requested language
   * @param lang - Language code (en, nl, de, fr, es). Defaults to "en"
   */
  async getActiveLandingPage(
    lang: SupportedLanguage = "en"
  ): Promise<{ landingPage: any }> {
    // Debug: Log the language parameter
    console.log(`[Landing Page Service] Processing with language: ${lang}`);

    const landingPage = await LandingPages.findOne({
      isActive: true,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 }) // Get the most recent active landing page
      .lean();

    if (!landingPage) {
      throw new AppError("No active landing page found", 404);
    }

    // Debug: Log sample data structure
    if (landingPage.heroSection?.title) {
      console.log(
        `[Landing Page Service] Sample title structure:`,
        JSON.stringify(landingPage.heroSection.title).substring(0, 100)
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

    // Filter and populate Product Category Section
    if (
      landingPage.productCategorySection &&
      landingPage.productCategorySection.isEnabled !== false
    ) {
      if (
        landingPage.productCategorySection.productCategoryIds &&
        landingPage.productCategorySection.productCategoryIds.length > 0
      ) {
        const categories = await ProductCategory.find({
          _id: { $in: landingPage.productCategorySection.productCategoryIds },
          isActive: true,
          isDeleted: { $ne: true },
        })
          .select("_id slug name description sortOrder icon image productCount")
          .sort({ sortOrder: 1 })
          .lean();

        processedLandingPage.productCategorySection = {
          ...landingPage.productCategorySection,
          productCategories: categories,
        };
      }
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

    // Filter and populate Testimonials Section
    if (
      landingPage.testimonialsSection &&
      landingPage.testimonialsSection.isEnabled !== false
    ) {
      if (
        landingPage.testimonialsSection.testimonialIds &&
        landingPage.testimonialsSection.testimonialIds.length > 0
      ) {
        const testimonials = await ProductTestimonials.find({
          _id: { $in: landingPage.testimonialsSection.testimonialIds },
          isActive: true,
          isDeleted: false,
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
          .select(
            "_id videoUrl videoThumbnail products isFeatured displayOrder"
          )
          .sort({ displayOrder: 1, createdAt: -1 })
          .limit(10) // Max 10 testimonials
          .lean();

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

        // Replace ingredient IDs with populated objects and transform for language
        for (const testimonial of testimonials) {
          if (testimonial.products && Array.isArray(testimonial.products)) {
            for (const product of testimonial.products) {
              const productObj = product as any;
              
              // Transform ingredients for language (same as getAllProducts API)
              if (productObj.ingredients && Array.isArray(productObj.ingredients) && productObj.ingredients.length > 0) {
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

              // Transform categories for language (same as getAllProducts API)
              if (productObj.categories && Array.isArray(productObj.categories) && productObj.categories.length > 0) {
                productObj.categories = productObj.categories.map((category: any) => ({
                  ...category,
                  name: getTranslatedString(category.name, lang),
                  description: getTranslatedText(category.description, lang),
                }));
              }
            }
          }
        }

        processedLandingPage.testimonialsSection = {
          ...landingPage.testimonialsSection,
          testimonials: testimonials,
        };
      }
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

    // Filter and fetch Blogs Section
    if (
      landingPage.blogSection &&
      landingPage.blogSection.isEnabled !== false
    ) {
      // Fetch recent blogs (max 3-4)
      const blogs = await Blogs.find({
        isActive: true,
        isDeleted: { $ne: true },
      })
        .select("_id title description coverImage seo createdAt viewCount")
        .sort({ createdAt: -1 })
        .limit(4) // Max 4 blogs
        .lean();

      processedLandingPage.blogSection = {
        ...landingPage.blogSection,
        blogs: blogs,
      };
    } else {
      delete processedLandingPage.blogSection;
    }

    // Filter and fetch FAQs Section
    if (landingPage.faqSection && landingPage.faqSection.isEnabled !== false) {
      // If FAQs are stored in the section, use them
      // Otherwise, fetch recent FAQs (max 6-8)
      if (
        landingPage.faqSection.faqs &&
        landingPage.faqSection.faqs.length > 0
      ) {
        processedLandingPage.faqSection = {
          ...landingPage.faqSection,
          faqs: landingPage.faqSection.faqs
            .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
            .slice(0, 8), // Max 8 FAQs
        };
      } else {
        // Fetch recent FAQs from FAQs collection
        const recentFaqs = await FAQs.find({
          isDeleted: { $ne: true },
          $or: [
            { status: "active" },
            { status: { $exists: false }, isActive: { $ne: false } },
          ],
        })
          .select("_id question answer sortOrder")
          .sort({ sortOrder: 1, createdAt: -1 })
          .limit(8) // Max 8 FAQs
          .lean();

        processedLandingPage.faqSection = {
          ...landingPage.faqSection,
          faqs: recentFaqs,
        };
      }
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

    // Transform all I18n fields to requested language
    const transformedLandingPage = this.transformToLanguage(
      processedLandingPage,
      lang
    );

    return { landingPage: transformedLandingPage };
  }

  /**
   * Transform all I18n fields in landing page to single language
   */
  private transformToLanguage(landingPage: any, lang: SupportedLanguage): any {
    // Debug: Log transformation start
    console.log(`[Transform] Starting transformation to language: ${lang}`);
    console.log(
      `[Transform] Sample heroSection.title before:`,
      JSON.stringify(landingPage.heroSection?.title).substring(0, 200)
    );

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
      console.log(`[Transform] Hero title after transformation:`, heroTitle);

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

      console.log(
        `[Transform] Hero section transformed title:`,
        transformed.heroSection.title
      );
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
          description: getTranslatedText(blog.description, lang),
          coverImage: blog.coverImage,
          seo: blog.seo,
          createdAt: blog.createdAt,
          viewCount: blog.viewCount,
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
   * Update landing page
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

    // Update fields
    if (data.heroSection) {
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
      if (data.heroSection.title) {
        // Convert title string to I18n format
        const existingTitle = landingPage.heroSection.title as any;
        const titleObj =
          existingTitle &&
          typeof existingTitle === "object" &&
          !Array.isArray(existingTitle)
            ? (existingTitle as Record<string, any>)
            : {};
        (landingPage.heroSection.title as any) =
          typeof data.heroSection.title === "string"
            ? { ...titleObj, en: data.heroSection.title }
            : {
                ...titleObj,
                ...(data.heroSection.title as Record<string, any>),
              };
      }
      if (data.heroSection.description !== undefined) {
        // Convert description string to I18n format
        const existingDesc = landingPage.heroSection.description as any;
        const descObj =
          existingDesc &&
          typeof existingDesc === "object" &&
          !Array.isArray(existingDesc)
            ? (existingDesc as Record<string, any>)
            : {};
        (landingPage.heroSection.description as any) =
          typeof data.heroSection.description === "string"
            ? { ...descObj, en: data.heroSection.description }
            : {
                ...descObj,
                ...(data.heroSection.description as Record<string, any>),
              };
      }
    }

    // Update membership section
    if (data.membershipSection) {
      if (!landingPage.membershipSection) {
        (landingPage as any).membershipSection = {};
      }

      if (data.membershipSection.backgroundImage !== undefined) {
        (landingPage.membershipSection as any).backgroundImage =
          data.membershipSection.backgroundImage;
      }

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
      }

      if (data.membershipSection.description !== undefined) {
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
      }
    }

    // Update how it works section
    if (data.howItWorksSection) {
      if (data.howItWorksSection.steps) {
        const existingSteps =
          (landingPage.howItWorksSection as any)?.steps || [];
        const updatedSteps = data.howItWorksSection.steps.map((step, index) => {
          const existingStep: any = existingSteps[index] || {};
          const existingTitle = existingStep.title;
          const existingDesc = existingStep.description;
          const titleObj =
            existingTitle &&
            typeof existingTitle === "object" &&
            !Array.isArray(existingTitle)
              ? (existingTitle as Record<string, any>)
              : {};
          const descObj =
            existingDesc &&
            typeof existingDesc === "object" &&
            !Array.isArray(existingDesc)
              ? (existingDesc as Record<string, any>)
              : {};

          return {
            image:
              step.image !== undefined ? step.image : existingStep.image || "",
            title: step.title
              ? typeof step.title === "string"
                ? { ...titleObj, en: step.title }
                : { ...titleObj, ...(step.title as Record<string, any>) }
              : existingStep.title || {},
            description:
              step.description !== undefined
                ? typeof step.description === "string"
                  ? { ...descObj, en: step.description }
                  : { ...descObj, ...(step.description as Record<string, any>) }
                : existingStep.description || {},
            order:
              step.order !== undefined
                ? step.order
                : existingStep.order !== undefined
                ? existingStep.order
                : index,
          };
        });

        (landingPage as any).howItWorksSection = {
          steps: updatedSteps,
        };
      }
    }

    // Update product category section
    if (data.productCategorySection) {
      if (!landingPage.productCategorySection) {
        (landingPage as any).productCategorySection = {};
      }

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
      }

      if (data.productCategorySection.description !== undefined) {
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
      }
    }

    // Update mission section
    if (data.missionSection) {
      if (!landingPage.missionSection) {
        (landingPage as any).missionSection = {};
      }

      if (data.missionSection.backgroundImage !== undefined) {
        (landingPage.missionSection as any).backgroundImage =
          data.missionSection.backgroundImage;
      }

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
      }

      if (data.missionSection.description !== undefined) {
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
      }
    }

    // Update features section
    if (data.featuresSection) {
      if (data.featuresSection.title) {
        if (!landingPage.featuresSection) {
          (landingPage as any).featuresSection = {};
        }
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
      }

      if (data.featuresSection.description !== undefined) {
        if (!landingPage.featuresSection) {
          (landingPage as any).featuresSection = {};
        }
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
      }

      if (data.featuresSection.features) {
        const existingFeatures =
          (landingPage.featuresSection as any)?.features || [];
        const updatedFeatures = data.featuresSection.features.map(
          (feature, index) => {
            const existingFeature: any = existingFeatures[index] || {};
            const existingTitle = existingFeature.title;
            const existingDesc = existingFeature.description;
            const titleObj =
              existingTitle &&
              typeof existingTitle === "object" &&
              !Array.isArray(existingTitle)
                ? (existingTitle as Record<string, any>)
                : {};
            const descObj =
              existingDesc &&
              typeof existingDesc === "object" &&
              !Array.isArray(existingDesc)
                ? (existingDesc as Record<string, any>)
                : {};

            return {
              icon:
                feature.icon !== undefined
                  ? feature.icon
                  : existingFeature.icon || "",
              title: feature.title
                ? typeof feature.title === "string"
                  ? { ...titleObj, en: feature.title }
                  : { ...titleObj, ...(feature.title as Record<string, any>) }
                : existingFeature.title || {},
              description:
                feature.description !== undefined
                  ? typeof feature.description === "string"
                    ? { ...descObj, en: feature.description }
                    : {
                        ...descObj,
                        ...(feature.description as Record<string, any>),
                      }
                  : existingFeature.description || {},
              order:
                feature.order !== undefined
                  ? feature.order
                  : existingFeature.order !== undefined
                  ? existingFeature.order
                  : index,
            };
          }
        );

        if (!landingPage.featuresSection) {
          (landingPage as any).featuresSection = {};
        }
        (landingPage.featuresSection as any).features = updatedFeatures;
      }
    }

    // Update designed by science section
    if (data.designedByScienceSection) {
      if (data.designedByScienceSection.title) {
        if (!landingPage.designedByScienceSection) {
          (landingPage as any).designedByScienceSection = {};
        }
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
      }

      if (data.designedByScienceSection.description !== undefined) {
        if (!landingPage.designedByScienceSection) {
          (landingPage as any).designedByScienceSection = {};
        }
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
      }

      if (data.designedByScienceSection.steps) {
        const existingSteps =
          (landingPage.designedByScienceSection as any)?.steps || [];
        const updatedSteps = data.designedByScienceSection.steps.map(
          (step, index) => {
            const existingStep: any = existingSteps[index] || {};
            const existingTitle = existingStep.title;
            const existingDesc = existingStep.description;
            const titleObj =
              existingTitle &&
              typeof existingTitle === "object" &&
              !Array.isArray(existingTitle)
                ? (existingTitle as Record<string, any>)
                : {};
            const descObj =
              existingDesc &&
              typeof existingDesc === "object" &&
              !Array.isArray(existingDesc)
                ? (existingDesc as Record<string, any>)
                : {};

            return {
              image:
                step.image !== undefined
                  ? step.image
                  : existingStep.image || "",
              title: step.title
                ? typeof step.title === "string"
                  ? { ...titleObj, en: step.title }
                  : { ...titleObj, ...(step.title as Record<string, any>) }
                : existingStep.title || {},
              description:
                step.description !== undefined
                  ? typeof step.description === "string"
                    ? { ...descObj, en: step.description }
                    : {
                        ...descObj,
                        ...(step.description as Record<string, any>),
                      }
                  : existingStep.description || {},
              order:
                step.order !== undefined
                  ? step.order
                  : existingStep.order !== undefined
                  ? existingStep.order
                  : index,
            };
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
      }

      if (data.customerResultsSection.description !== undefined) {
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
      }
    }

    // Update blog section
    if (data.blogSection) {
      if (!landingPage.blogSection) {
        (landingPage as any).blogSection = {};
      }

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
      }

      if (data.blogSection.description !== undefined) {
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
      }
    }

    // Update FAQ section
    if (data.faqSection) {
      if (data.faqSection.title) {
        if (!landingPage.faqSection) {
          (landingPage as any).faqSection = {};
        }
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
      }

      if (data.faqSection.description !== undefined) {
        if (!landingPage.faqSection) {
          (landingPage as any).faqSection = {};
        }
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
      }

      if (data.faqSection.faqs) {
        const existingFAQs = (landingPage.faqSection as any)?.faqs || [];
        const updatedFAQs = data.faqSection.faqs.map((faq, index) => {
          const existingFAQ: any = existingFAQs[index] || {};
          const existingQuestion = existingFAQ.question;
          const existingAnswer = existingFAQ.answer;
          const questionObj =
            existingQuestion &&
            typeof existingQuestion === "object" &&
            !Array.isArray(existingQuestion)
              ? (existingQuestion as Record<string, any>)
              : {};
          const answerObj =
            existingAnswer &&
            typeof existingAnswer === "object" &&
            !Array.isArray(existingAnswer)
              ? (existingAnswer as Record<string, any>)
              : {};

          return {
            question: faq.question
              ? typeof faq.question === "string"
                ? { ...questionObj, en: faq.question }
                : { ...questionObj, ...(faq.question as Record<string, any>) }
              : existingFAQ.question || {},
            answer:
              faq.answer !== undefined
                ? typeof faq.answer === "string"
                  ? { ...answerObj, en: faq.answer }
                  : { ...answerObj, ...(faq.answer as Record<string, any>) }
                : existingFAQ.answer || {},
            order:
              faq.order !== undefined
                ? faq.order
                : existingFAQ.order !== undefined
                ? existingFAQ.order
                : index,
          };
        });

        if (!landingPage.faqSection) {
          (landingPage as any).faqSection = {};
        }
        (landingPage.faqSection as any).faqs = updatedFAQs;
      }
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
