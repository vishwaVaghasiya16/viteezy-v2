import { LandingPages } from "../models/cms/landingPage.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import mongoose from "mongoose";

interface CreateLandingPageData {
  heroSection: {
    media: {
      type: "image" | "video";
      url: string;
      sortOrder?: number;
    };
    title: string; // Simple string for now
    description?: string; // Simple string for now
  };
  membershipSection?: {
    backgroundImage: string;
    title: string; // Simple string for now
    description?: string; // Simple string for now
  };
  howItWorksSection?: {
    steps: Array<{
      image: string;
      title: string; // Simple string for now
      description?: string; // Simple string for now
      order?: number;
    }>;
  };
  productCategorySection?: {
    title: string; // Simple string for now
    description?: string; // Simple string for now
  };
  missionSection?: {
    backgroundImage: string;
    title: string; // Simple string for now
    description?: string; // Simple string for now
  };
  featuresSection?: {
    title: string; // Simple string for now
    description?: string; // Simple string for now
    features: Array<{
      icon: string;
      title: string; // Simple string for now
      description?: string; // Simple string for now
      order?: number;
    }>;
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
  };
  customerResultsSection?: {
    title: string; // Simple string for now
    description?: string; // Simple string for now
  };
  blogSection?: {
    title: string; // Simple string for now
    description?: string; // Simple string for now
  };
  faqSection?: {
    title: string; // Simple string for now
    description?: string; // Simple string for now
    faqs: Array<{
      question: string; // Simple string for now
      answer?: string; // Simple string for now
      order?: number;
    }>;
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
    title?: string; // Simple string for now
    description?: string; // Simple string for now
  };
  membershipSection?: {
    backgroundImage?: string;
    title?: string; // Simple string for now
    description?: string; // Simple string for now
  };
  howItWorksSection?: {
    steps?: Array<{
      image?: string;
      title?: string; // Simple string for now
      description?: string; // Simple string for now
      order?: number;
    }>;
  };
  productCategorySection?: {
    title?: string; // Simple string for now
    description?: string; // Simple string for now
  };
  missionSection?: {
    backgroundImage?: string;
    title?: string; // Simple string for now
    description?: string; // Simple string for now
  };
  featuresSection?: {
    title?: string; // Simple string for now
    description?: string; // Simple string for now
    features?: Array<{
      icon?: string;
      title?: string; // Simple string for now
      description?: string; // Simple string for now
      order?: number;
    }>;
  };
  designedByScienceSection?: {
    title?: string; // Simple string for now
    description?: string; // Simple string for now
    steps?: Array<{
      image?: string;
      title?: string; // Simple string for now
      description?: string; // Simple string for now
      order?: number;
    }>;
  };
  customerResultsSection?: {
    title?: string; // Simple string for now
    description?: string; // Simple string for now
  };
  blogSection?: {
    title?: string; // Simple string for now
    description?: string; // Simple string for now
  };
  faqSection?: {
    title?: string; // Simple string for now
    description?: string; // Simple string for now
    faqs?: Array<{
      question?: string; // Simple string for now
      answer?: string; // Simple string for now
      order?: number;
    }>;
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
    // Convert simple strings to I18n format for database
    const landingPageData: any = {
      ...data,
      heroSection: {
        ...data.heroSection,
        title:
          typeof data.heroSection.title === "string"
            ? { en: data.heroSection.title }
            : data.heroSection.title,
        description: data.heroSection.description
          ? typeof data.heroSection.description === "string"
            ? { en: data.heroSection.description }
            : data.heroSection.description
          : undefined,
        media: {
          ...data.heroSection.media,
        },
      },
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
      };
    }

    // Convert how it works section strings to I18n format
    if (data.howItWorksSection && data.howItWorksSection.steps) {
      landingPageData.howItWorksSection = {
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
   */
  async getActiveLandingPage(): Promise<{ landingPage: any }> {
    const landingPage = await LandingPages.findOne({
      isActive: true,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 }) // Get the most recent active landing page
      .lean();

    if (!landingPage) {
      throw new AppError("No active landing page found", 404);
    }

    return { landingPage };
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
