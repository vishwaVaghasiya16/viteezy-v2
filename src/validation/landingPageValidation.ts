import Joi from "joi";
import { withFieldLabels } from "./helpers";
import { MEDIA_TYPE_VALUES } from "@/models/enums";

// Helper to support JSON strings in form data
const withJsonSupport = <T extends Joi.Schema>(
  schema: T,
  options: { allowEmpty?: boolean } = {}
) =>
  Joi.alternatives().try(
    schema,
    Joi.string().custom((value, helpers) => {
      if (value === undefined || value === null) {
        return undefined;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        if (options.allowEmpty) {
          return undefined;
        }
        return helpers.error("any.required");
      }

      try {
        const parsed = JSON.parse(trimmed);
        const { error, value: validated } = schema.validate(parsed, {
          abortEarly: false,
          allowUnknown: true,
        });

        if (error) {
          return helpers.error("any.invalid", { message: error.message });
        }

        return validated;
      } catch (err) {
        return helpers.error("any.invalid");
      }
    })
  );

// Simple String Schema (English only for now)
const baseStringSchema = Joi.string().trim().min(1).required().messages({
  "any.required": "Content is required",
  "string.min": "Content must be at least 1 character",
});

// Simple Text Schema (optional)
const baseTextSchema = Joi.string().trim().allow("", null).optional();

// Media Schema (Image or Video) - Optional, will be auto-created from imageUrl or videoUrl
const baseMediaSchema = Joi.object({
  type: Joi.string()
    .valid(...MEDIA_TYPE_VALUES)
    .optional()
    .messages({
      "any.only": `Media type must be one of: ${MEDIA_TYPE_VALUES.join(", ")}`,
    })
    .label("Media type"),
  url: Joi.string().uri().optional().messages({
    "string.uri": "Media URL must be a valid URL",
  }),
  sortOrder: Joi.number().integer().min(0).optional(),
});

// Hero Section Schema
const basePrimaryCTASchema = Joi.object({
  label: baseStringSchema.required(),
  image: Joi.string().uri().optional(),
  link: Joi.string().trim().optional().allow(""), // Allow any string value, not just URIs
  order: Joi.number().integer().min(0).optional().default(0),
});

const baseHeroSectionSchema = Joi.object({
  media: baseMediaSchema.optional(),
  imageUrl: Joi.string().uri().optional().allow("", null).messages({
    "string.uri": "Image URL must be a valid URL",
  }),
  videoUrl: Joi.string().uri().optional().allow("", null).messages({
    "string.uri": "Video URL must be a valid URL",
  }),
  backgroundImage: Joi.string().uri().optional().allow("", null).messages({
    "string.uri": "Background image must be a valid URL",
  }),
  title: baseStringSchema.required(),
  // subTitle removed from create API
  description: baseTextSchema.optional(),
  highlightedText: Joi.array().items(baseStringSchema).optional(),
  primaryCTA: Joi.array().items(basePrimaryCTASchema).max(3).optional(),
  isEnabled: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional(),
}).custom((value, helpers) => {
  // Check if imageUrl or videoUrl is provided (as strings, not empty)
  const hasImageUrl = value.imageUrl && typeof value.imageUrl === "string" && value.imageUrl.trim() !== "";
  const hasVideoUrl = value.videoUrl && typeof value.videoUrl === "string" && value.videoUrl.trim() !== "";
  const hasMedia = value.media && value.media.type && value.media.url;
  
  // If media object exists, ensure it has both type and url
  if (value.media) {
    if (!value.media.type || !value.media.url) {
      return helpers.error("any.custom", {
        message: "Media object must have both type and url",
      });
    }
  }
  
  // Note: Files are uploaded via multer and processed in handleLandingPageImageUpload middleware
  // The middleware runs BEFORE validation, so if files are uploaded, imageUrl/videoUrl will be set
  // If no files are uploaded and no imageUrl/videoUrl/media is provided, we allow it
  // The service layer will handle the requirement check if needed
  // This allows flexibility - files can be uploaded OR URLs can be provided directly
  
  return value;
});

// Membership Section Schema
const baseMembershipBenefitSchema = Joi.object({
  icon: Joi.string().trim().optional(),
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
  order: Joi.number().integer().min(0).optional().default(0),
});

const baseMembershipSectionSchema = Joi.object({
  backgroundImage: Joi.string().uri().required().messages({
    "string.uri": "Background image must be a valid URL",
    "any.required": "Background image is required",
  }),
  title: baseStringSchema.required(),
  subTitle: baseStringSchema.optional(),
  description: baseTextSchema.optional(),
  benefits: Joi.array().items(baseMembershipBenefitSchema).min(0).max(5).optional(),
  isEnabled: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional(),
});

// How It Works Step Schema
const baseHowItWorksStepSchema = Joi.object({
  image: Joi.string().uri().required().messages({
    "string.uri": "Step image must be a valid URL",
    "any.required": "Step image is required",
  }),
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
  order: Joi.number().integer().min(0).optional().default(0),
});

// How It Works Section Schema
const baseHowItWorksSectionSchema = Joi.object({
  title: baseStringSchema.required(),
  subTitle: baseStringSchema.optional(),
  stepsCount: Joi.number().integer().min(1).max(10).optional(),
  steps: Joi.array()
    .items(baseHowItWorksStepSchema)
    .min(1)
    .required()
    .messages({
      "array.min": "At least one step is required",
      "any.required": "Steps are required",
    }),
  isEnabled: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional(),
});

// Product Category Section Schema
const baseProductCategorySectionSchema = Joi.object({
  title: baseStringSchema.required(),
  subTitle: baseStringSchema.optional(),
  description: baseTextSchema.optional(),
  productCategoryIds: Joi.array()
    .items(Joi.string().trim().length(24).hex())
    .min(1)
    .optional(),
  isEnabled: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional(),
});

// Mission Section Schema
const baseMissionSectionSchema = Joi.object({
  backgroundImage: Joi.string().uri().required().messages({
    "string.uri": "Background image must be a valid URL",
    "any.required": "Background image is required",
  }),
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
  isEnabled: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional(),
});

// Feature Schema
const baseFeatureSchema = Joi.object({
  icon: Joi.string().trim().required().messages({
    "any.required": "Feature icon is required",
  }),
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
  order: Joi.number().integer().min(0).optional().default(0),
});

// Features Section Schema
const baseFeaturesSectionSchema = Joi.object({
  title: baseStringSchema.required(),
  subTitle: baseStringSchema.optional(),
  description: baseTextSchema.optional(),
  features: Joi.array().items(baseFeatureSchema).min(1).required().messages({
    "array.min": "At least one feature is required",
    "any.required": "Features are required",
  }),
  isEnabled: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional(),
});

// Designed by Science Step Schema
const baseDesignedByScienceStepSchema = Joi.object({
  image: Joi.string().uri().required().messages({
    "string.uri": "Step image must be a valid URL",
    "any.required": "Step image is required",
  }),
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
  order: Joi.number().integer().min(0).optional().default(0),
});

// Designed by Science Section Schema
const baseDesignedByScienceSectionSchema = Joi.object({
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
  steps: Joi.array()
    .items(baseDesignedByScienceStepSchema)
    .min(1)
    .max(4)
    .required()
    .messages({
      "array.min": "At least one step is required",
      "any.required": "Steps are required",
    }),
  isEnabled: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional(),
});

// Community / Social Proof Section Schema
const baseCommunityMetricSchema = Joi.object({
  label: baseStringSchema.required(),
  value: Joi.alternatives()
    .try(Joi.string().trim().min(1).required(), Joi.number().required())
    .required(),
  order: Joi.number().integer().min(0).optional().default(0),
});

const baseCommunitySectionSchema = Joi.object({
  backgroundImage: Joi.string().uri().required().messages({
    "string.uri": "Background image must be a valid URL",
    "any.required": "Background image is required",
  }),
  title: baseStringSchema.required(),
  subTitle: baseStringSchema.optional(),
  metrics: Joi.array()
    .items(baseCommunityMetricSchema)
    .min(1)
    .max(6)
    .required()
    .messages({
      "array.min": "At least one metric is required",
      "any.required": "Metrics are required",
    }),
  isEnabled: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional(),
});

// Customer Results Section Schema
const baseCustomerResultsSectionSchema = Joi.object({
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
  isEnabled: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional(),
});

// Blog Section Schema
const baseBlogSectionSchema = Joi.object({
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
  isEnabled: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional(),
});

// FAQ Item Schema
const baseFAQItemSchema = Joi.object({
  question: baseStringSchema.required(),
  answer: baseTextSchema.optional(),
  order: Joi.number().integer().min(0).optional().default(0),
});

// FAQ Section Schema
const baseFAQSectionSchema = Joi.object({
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
  // FAQs will be fetched dynamically from FAQs model (latest 8)
  isEnabled: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional(),
});

// Testimonials Section Schema
const baseTestimonialsSectionSchema = Joi.object({
  title: baseStringSchema.required(),
  subTitle: baseStringSchema.optional(),
  // Testimonials will be fetched dynamically from ProductTestimonials model (max 6)
  // Priority: isFeatured = true first, then latest
  isEnabled: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional(),
});

// Schemas with JSON support for form data
const stringSchema = withJsonSupport(baseStringSchema).required();
const textSchema = withJsonSupport(baseTextSchema, {
  allowEmpty: true,
}).optional();
const mediaSchema = withJsonSupport(baseMediaSchema).required();
const heroSectionSchema = withJsonSupport(baseHeroSectionSchema).required();
const membershipSectionSchema = withJsonSupport(baseMembershipSectionSchema, {
  allowEmpty: true,
}).optional();
const howItWorksSectionSchema = withJsonSupport(baseHowItWorksSectionSchema, {
  allowEmpty: true,
}).optional();
const productCategorySectionSchema = withJsonSupport(
  baseProductCategorySectionSchema,
  {
    allowEmpty: true,
  }
).optional();
const communitySectionSchema = withJsonSupport(baseCommunitySectionSchema, {
  allowEmpty: true,
}).optional();
const missionSectionSchema = withJsonSupport(baseMissionSectionSchema, {
  allowEmpty: true,
}).optional();
const featuresSectionSchema = withJsonSupport(baseFeaturesSectionSchema, {
  allowEmpty: true,
}).optional();
const designedByScienceSectionSchema = withJsonSupport(
  baseDesignedByScienceSectionSchema,
  {
    allowEmpty: true,
  }
).optional();
const customerResultsSectionSchema = withJsonSupport(
  baseCustomerResultsSectionSchema,
  {
    allowEmpty: true,
  }
).optional();
const blogSectionSchema = withJsonSupport(baseBlogSectionSchema, {
  allowEmpty: true,
}).optional();
const faqSectionSchema = withJsonSupport(baseFAQSectionSchema, {
  allowEmpty: true,
}).optional();
const testimonialsSectionSchema = withJsonSupport(
  baseTestimonialsSectionSchema,
  {
    allowEmpty: true,
  }
).optional();

// Create Landing Page Schema
export const createLandingPageSchema = Joi.object(
  withFieldLabels({
    heroSection: heroSectionSchema.label("Hero section"),
    membershipSection: membershipSectionSchema.label("Membership section"),
    howItWorksSection: howItWorksSectionSchema.label("How it works section"),
    productCategorySection: productCategorySectionSchema.label(
      "Product category section"
    ),
    communitySection: communitySectionSchema.label("Community section"),
    missionSection: missionSectionSchema.label("Mission section"),
    featuresSection: featuresSectionSchema.label("Features section"),
    designedByScienceSection: designedByScienceSectionSchema.label(
      "Designed by science section"
    ),
    customerResultsSection: customerResultsSectionSchema.label(
      "Customer results section"
    ),
    blogSection: blogSectionSchema.label("Blog section"),
    faqSection: faqSectionSchema.label("FAQ section"),
    testimonialsSection: testimonialsSectionSchema.label(
      "Testimonials section"
    ),
    isActive: Joi.boolean().optional().default(true).label("Is active"),
  })
).label("CreateLandingPage");

// Update Landing Page Schema - All fields are optional for partial updates
export const updateLandingPageSchema = Joi.object(
  withFieldLabels({
    heroSection: heroSectionSchema.optional().label("Hero section"),
    membershipSection: membershipSectionSchema
      .optional()
      .label("Membership section"),
    howItWorksSection: howItWorksSectionSchema
      .optional()
      .label("How it works section"),
    productCategorySection: productCategorySectionSchema
      .optional()
      .label("Product category section"),
    communitySection: communitySectionSchema
      .optional()
      .label("Community section"),
    missionSection: missionSectionSchema.optional().label("Mission section"),
    featuresSection: featuresSectionSchema.optional().label("Features section"),
    designedByScienceSection: designedByScienceSectionSchema
      .optional()
      .label("Designed by science section"),
    customerResultsSection: customerResultsSectionSchema
      .optional()
      .label("Customer results section"),
    blogSection: blogSectionSchema.optional().label("Blog section"),
    faqSection: faqSectionSchema.optional().label("FAQ section"),
    testimonialsSection: testimonialsSectionSchema
      .optional()
      .label("Testimonials section"),
    isActive: Joi.boolean().optional().label("Is active"),
  })
)
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  })
  .label("UpdateLandingPage");

// Get Landing Page Query Schema (for filtering)
export const getLandingPageQuerySchema = Joi.object(
  withFieldLabels({
    isActive: Joi.boolean().optional().label("Is active filter"),
  })
).label("GetLandingPageQuery");
