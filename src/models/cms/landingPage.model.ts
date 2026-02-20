import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nText,
  MediaSchema,
  AuditSchema,
  SoftDelete,
  I18nStringType,
  I18nTextType,
  MediaType,
} from "../common.model";

export interface PrimaryCTA {
  label: I18nStringType;
  image: string; // CTA image URL
  link: string; // CTA link URL
  order: number; // CTA order (1, 2, 3)
}

const PrimaryCTASchema = new Schema<PrimaryCTA>(
  {
    label: {
      type: I18nString,
      default: () => ({}),
    },
    image: {
      type: String,
      trim: true,
    },
    link: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface HeroSection {
  media: MediaType; // Image or video (type determines which is active)
  imageUrl?: string; // Optional: Image URL (stored separately)
  videoUrl?: string; // Optional: Video URL (stored separately)
  backgroundImage?: string; // Optional background image URL (separate from media)
  title: I18nStringType;
  highlightedText: I18nStringType[]; // Array of highlighted texts
  subTitle: I18nStringType;
  description: I18nTextType;
  primaryCTA: PrimaryCTA[]; // 3 CTAs with label, image, link
  isEnabled: boolean;
  order: number;
}

const HeroSectionSchema = new Schema<HeroSection>(
  {
    media: {
      type: MediaSchema,
      required: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    videoUrl: {
      type: String,
      trim: true,
    },
    backgroundImage: {
      type: String,
      trim: true,
    },
    title: {
      type: I18nString,
      default: () => ({}),
    },
    highlightedText: [I18nString],
    subTitle: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    primaryCTA: [PrimaryCTASchema],
    isEnabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface MembershipBenefit {
  icon: string; // Icon URL or icon identifier
  title: I18nStringType;
  description: I18nTextType;
  order: number;
}

const MembershipBenefitSchema = new Schema<MembershipBenefit>(
  {
    icon: {
      type: String,
      trim: true,
    },
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface MembershipSection {
  backgroundImage: string; // Background image URL
  title: I18nStringType;
  description: I18nTextType;
  benefits: MembershipBenefit[]; // 3-5 max features/benefits
  isEnabled: boolean;
  order: number;
}

const MembershipSectionSchema = new Schema<MembershipSection>(
  {
    backgroundImage: {
      type: String,
      trim: true,
    },
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    benefits: [MembershipBenefitSchema],
    isEnabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface HowItWorksStep {
  image: string; // Step image URL
  title: I18nStringType;
  description: I18nTextType;
  order: number; // Step order/number
}

const HowItWorksStepSchema = new Schema<HowItWorksStep>(
  {
    image: {
      type: String,
      trim: true,
    },
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface HowItWorksSection {
  title: I18nStringType;
  subTitle: I18nStringType;
  stepsCount: number; // Default: 3
  steps: HowItWorksStep[];
  isEnabled: boolean;
  order: number;
}

const HowItWorksSectionSchema = new Schema<HowItWorksSection>(
  {
    title: {
      type: I18nString,
      default: () => ({}),
    },
    subTitle: {
      type: I18nString,
      default: () => ({}),
    },
    stepsCount: {
      type: Number,
      default: 3,
    },
    steps: [HowItWorksStepSchema],
    isEnabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface ProductCategorySection {
  title: I18nStringType;
  description: I18nTextType;
  productCategoryIds?: mongoose.Types.ObjectId[]; // Optional - categories are fetched dynamically in GET APIs (max 10 recent)
  isEnabled: boolean;
  order: number;
}

const ProductCategorySectionSchema = new Schema<ProductCategorySection>(
  {
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    productCategoryIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "product_categories",
        },
      ],
      optional: true, // Categories are fetched dynamically in GET APIs
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface MissionSection {
  backgroundImage: string; // Background image URL
  title: I18nStringType;
  description: I18nTextType;
  isEnabled: boolean;
  order: number;
}

const MissionSectionSchema = new Schema<MissionSection>(
  {
    backgroundImage: {
      type: String,
      trim: true,
    },
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface Feature {
  icon: string; // Icon URL or icon identifier
  title: I18nStringType;
  description: I18nTextType;
  order: number; // Feature order/number
}

const FeatureSchema = new Schema<Feature>(
  {
    icon: {
      type: String,
      trim: true,
    },
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface FeaturesSection {
  title: I18nStringType; // Section title like "Why choose Viteezy?"
  description: I18nTextType; // Section description
  features: Feature[]; // Array of features (4 max)
  isEnabled: boolean;
  order: number;
}

const FeaturesSectionSchema = new Schema<FeaturesSection>(
  {
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    features: [FeatureSchema],
    isEnabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface DesignedByScienceStep {
  image: string; // Step image URL
  title: I18nStringType;
  description: I18nTextType;
  order: number; // Step order/number
}

const DesignedByScienceStepSchema = new Schema<DesignedByScienceStep>(
  {
    image: {
      type: String,
      trim: true,
    },
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface DesignedByScienceSection {
  title: I18nStringType;
  description: I18nTextType;
  steps: DesignedByScienceStep[]; // 3-4 max pillars
  isEnabled: boolean;
  order: number;
}

const DesignedByScienceSectionSchema = new Schema<DesignedByScienceSection>(
  {
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    steps: [DesignedByScienceStepSchema],
    isEnabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

// Community/Social Proof Strip Section
export interface CommunityMetric {
  label: I18nStringType;
  value: string | number; // Value/Count
  order: number;
}

const CommunityMetricSchema = new Schema<CommunityMetric>(
  {
    label: {
      type: I18nString,
      default: () => ({}),
    },
    value: {
      type: Schema.Types.Mixed, // Can be string or number
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface CommunitySection {
  backgroundImage: string; // Background image URL
  title: I18nStringType;
  subTitle: I18nStringType;
  metrics: CommunityMetric[]; // 4-6 max metrics
  isEnabled: boolean;
  order: number;
}

const CommunitySectionSchema = new Schema<CommunitySection>(
  {
    backgroundImage: {
      type: String,
      trim: true,
    },
    title: {
      type: I18nString,
      default: () => ({}),
    },
    subTitle: {
      type: I18nString,
      default: () => ({}),
    },
    metrics: [CommunityMetricSchema],
    isEnabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

// Testimonials Section
export interface TestimonialsSection {
  title: I18nStringType;
  subTitle: I18nStringType;
  testimonialIds?: mongoose.Types.ObjectId[]; // Testimonials are fetched dynamically (max 6)
  isEnabled: boolean;
  order: number;
  // Testimonials will be fetched dynamically from ProductTestimonials model
  // Priority: isFeatured = true first, then latest
}

const TestimonialsSectionSchema = new Schema<TestimonialsSection>(
  {
    title: {
      type: I18nString,
      default: () => ({}),
    },
    subTitle: {
      type: I18nString,
      default: () => ({}),
    },
    testimonialIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "product_testimonials",
        },
      ],
      default: undefined, // Testimonials will be fetched dynamically
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface CustomerResultsSection {
  title: I18nStringType;
  description: I18nTextType;
  isEnabled: boolean;
  order: number;
}

const CustomerResultsSectionSchema = new Schema<CustomerResultsSection>(
  {
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface BlogSection {
  title: I18nStringType;
  description: I18nTextType;
  isEnabled: boolean;
  order: number;
  // Blogs will be fetched dynamically (max 4 recent blogs)
}

const BlogSectionSchema = new Schema<BlogSection>(
  {
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface FAQItem {
  question: I18nStringType;
  answer: I18nTextType;
  order: number; // FAQ order/number
}

const FAQItemSchema = new Schema<FAQItem>(
  {
    question: {
      type: I18nString,
      default: () => ({}),
    },
    answer: {
      type: I18nText,
      default: () => ({}),
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface FAQSection {
  title: I18nStringType;
  description: I18nTextType;
  faqs?: FAQItem[]; // FAQs are fetched dynamically from FAQs model (latest 8)
  isEnabled: boolean;
  order: number;
}

const FAQSectionSchema = new Schema<FAQSection>(
  {
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    faqs: {
      type: [FAQItemSchema],
      default: undefined, // FAQs will be fetched dynamically
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

export interface ILandingPage extends Document {
  heroSection: HeroSection;
  membershipSection?: MembershipSection;
  howItWorksSection?: HowItWorksSection;
  productCategorySection?: ProductCategorySection;
  communitySection?: CommunitySection; // Community/Social Proof Strip
  missionSection?: MissionSection;
  featuresSection?: FeaturesSection; // Why Choose Viteezy
  designedByScienceSection?: DesignedByScienceSection;
  testimonialsSection?: TestimonialsSection;
  customerResultsSection?: CustomerResultsSection;
  blogSection?: BlogSection;
  faqSection?: FAQSection;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LandingPageSchema = new Schema<ILandingPage>(
  {
    heroSection: {
      type: HeroSectionSchema,
      required: true,
    },
    membershipSection: {
      type: MembershipSectionSchema,
    },
    howItWorksSection: {
      type: HowItWorksSectionSchema,
    },
    productCategorySection: {
      type: ProductCategorySectionSchema,
    },
    communitySection: {
      type: CommunitySectionSchema,
    },
    missionSection: {
      type: MissionSectionSchema,
    },
    featuresSection: {
      type: FeaturesSectionSchema,
    },
    designedByScienceSection: {
      type: DesignedByScienceSectionSchema,
    },
    testimonialsSection: {
      type: TestimonialsSectionSchema,
    },
    customerResultsSection: {
      type: CustomerResultsSectionSchema,
    },
    blogSection: {
      type: BlogSectionSchema,
    },
    faqSection: {
      type: FAQSectionSchema,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    ...SoftDelete,
    ...AuditSchema.obj,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
LandingPageSchema.index({ isActive: 1, isDeleted: 1 });

export const LandingPages = mongoose.model<ILandingPage>(
  "landing_pages",
  LandingPageSchema
);

