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

// Media Schema (Image or Video)
const baseMediaSchema = Joi.object({
  type: Joi.string()
    .valid(...MEDIA_TYPE_VALUES)
    .required()
    .messages({
      "any.only": `Media type must be one of: ${MEDIA_TYPE_VALUES.join(", ")}`,
      "any.required": "Media type is required",
    })
    .label("Media type"),
  url: Joi.string()
    .uri()
    .required()
    .messages({
      "string.uri": "Media URL must be a valid URL",
      "any.required": "Media URL is required",
    }),
  alt: baseStringSchema.optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
});

// Hero Section Schema
const baseHeroSectionSchema = Joi.object({
  media: baseMediaSchema.required(),
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
});

// Membership Section Schema
const baseMembershipSectionSchema = Joi.object({
  backgroundImage: Joi.string()
    .uri()
    .required()
    .messages({
      "string.uri": "Background image must be a valid URL",
      "any.required": "Background image is required",
    }),
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
});

// How It Works Step Schema
const baseHowItWorksStepSchema = Joi.object({
  image: Joi.string()
    .uri()
    .required()
    .messages({
      "string.uri": "Step image must be a valid URL",
      "any.required": "Step image is required",
    }),
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
  order: Joi.number().integer().min(0).optional().default(0),
});

// How It Works Section Schema
const baseHowItWorksSectionSchema = Joi.object({
  steps: Joi.array()
    .items(baseHowItWorksStepSchema)
    .min(1)
    .required()
    .messages({
      "array.min": "At least one step is required",
      "any.required": "Steps are required",
    }),
});

// Product Category Section Schema
const baseProductCategorySectionSchema = Joi.object({
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
});

// Mission Section Schema
const baseMissionSectionSchema = Joi.object({
  backgroundImage: Joi.string()
    .uri()
    .required()
    .messages({
      "string.uri": "Background image must be a valid URL",
      "any.required": "Background image is required",
    }),
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
});

// Feature Schema
const baseFeatureSchema = Joi.object({
  icon: Joi.string()
    .trim()
    .required()
    .messages({
      "any.required": "Feature icon is required",
    }),
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
  order: Joi.number().integer().min(0).optional().default(0),
});

// Features Section Schema
const baseFeaturesSectionSchema = Joi.object({
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
  features: Joi.array()
    .items(baseFeatureSchema)
    .min(1)
    .required()
    .messages({
      "array.min": "At least one feature is required",
      "any.required": "Features are required",
    }),
});

// Designed by Science Step Schema
const baseDesignedByScienceStepSchema = Joi.object({
  image: Joi.string()
    .uri()
    .required()
    .messages({
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
    .required()
    .messages({
      "array.min": "At least one step is required",
      "any.required": "Steps are required",
    }),
});

// Customer Results Section Schema
const baseCustomerResultsSectionSchema = Joi.object({
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
});

// Blog Section Schema
const baseBlogSectionSchema = Joi.object({
  title: baseStringSchema.required(),
  description: baseTextSchema.optional(),
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
  faqs: Joi.array()
    .items(baseFAQItemSchema)
    .min(1)
    .required()
    .messages({
      "array.min": "At least one FAQ is required",
      "any.required": "FAQs are required",
    }),
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
const productCategorySectionSchema = withJsonSupport(baseProductCategorySectionSchema, {
  allowEmpty: true,
}).optional();
const missionSectionSchema = withJsonSupport(baseMissionSectionSchema, {
  allowEmpty: true,
}).optional();
const featuresSectionSchema = withJsonSupport(baseFeaturesSectionSchema, {
  allowEmpty: true,
}).optional();
const designedByScienceSectionSchema = withJsonSupport(baseDesignedByScienceSectionSchema, {
  allowEmpty: true,
}).optional();
const customerResultsSectionSchema = withJsonSupport(baseCustomerResultsSectionSchema, {
  allowEmpty: true,
}).optional();
const blogSectionSchema = withJsonSupport(baseBlogSectionSchema, {
  allowEmpty: true,
}).optional();
const faqSectionSchema = withJsonSupport(baseFAQSectionSchema, {
  allowEmpty: true,
}).optional();

// Create Landing Page Schema
export const createLandingPageSchema = Joi.object(
  withFieldLabels({
    heroSection: heroSectionSchema.label("Hero section"),
    membershipSection: membershipSectionSchema.label("Membership section"),
    howItWorksSection: howItWorksSectionSchema.label("How it works section"),
    productCategorySection: productCategorySectionSchema.label("Product category section"),
    missionSection: missionSectionSchema.label("Mission section"),
    featuresSection: featuresSectionSchema.label("Features section"),
    designedByScienceSection: designedByScienceSectionSchema.label("Designed by science section"),
    customerResultsSection: customerResultsSectionSchema.label("Customer results section"),
    blogSection: blogSectionSchema.label("Blog section"),
    faqSection: faqSectionSchema.label("FAQ section"),
    isActive: Joi.boolean().optional().default(true).label("Is active"),
  })
).label("CreateLandingPage");

// Update Landing Page Schema - All fields are optional for partial updates
export const updateLandingPageSchema = Joi.object(
  withFieldLabels({
    heroSection: heroSectionSchema.optional().label("Hero section"),
    membershipSection: membershipSectionSchema.optional().label("Membership section"),
    howItWorksSection: howItWorksSectionSchema.optional().label("How it works section"),
    productCategorySection: productCategorySectionSchema.optional().label("Product category section"),
    missionSection: missionSectionSchema.optional().label("Mission section"),
    featuresSection: featuresSectionSchema.optional().label("Features section"),
    designedByScienceSection: designedByScienceSectionSchema.optional().label("Designed by science section"),
    customerResultsSection: customerResultsSectionSchema.optional().label("Customer results section"),
    blogSection: blogSectionSchema.optional().label("Blog section"),
    faqSection: faqSectionSchema.optional().label("FAQ section"),
    isActive: Joi.boolean().optional().label("Is active"),
  })
).min(1).messages({
  "object.min": "At least one field must be provided for update",
}).label("UpdateLandingPage");

// Get Landing Page Query Schema (for filtering)
export const getLandingPageQuerySchema = Joi.object(
  withFieldLabels({
    isActive: Joi.boolean().optional().label("Is active filter"),
  })
).label("GetLandingPageQuery");

