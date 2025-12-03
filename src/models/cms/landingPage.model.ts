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

export interface HeroSection {
  media: MediaType; // Image or video
  title: I18nStringType;
  description: I18nTextType;
}

const HeroSectionSchema = new Schema<HeroSection>(
  {
    media: {
      type: MediaSchema,
      required: true,
    },
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
  },
  { _id: false }
);

export interface MembershipSection {
  backgroundImage: string; // Background image URL
  title: I18nStringType;
  description: I18nTextType;
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
  steps: HowItWorksStep[];
}

const HowItWorksSectionSchema = new Schema<HowItWorksSection>(
  {
    steps: [HowItWorksStepSchema],
  },
  { _id: false }
);

export interface ProductCategorySection {
  title: I18nStringType;
  description: I18nTextType;
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
  },
  { _id: false }
);

export interface MissionSection {
  backgroundImage: string; // Background image URL
  title: I18nStringType;
  description: I18nTextType;
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
  features: Feature[]; // Array of features
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
  steps: DesignedByScienceStep[];
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
  },
  { _id: false }
);

export interface CustomerResultsSection {
  title: I18nStringType;
  description: I18nTextType;
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
  },
  { _id: false }
);

export interface BlogSection {
  title: I18nStringType;
  description: I18nTextType;
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
  faqs: FAQItem[];
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
    faqs: [FAQItemSchema],
  },
  { _id: false }
);

export interface ILandingPage extends Document {
  heroSection: HeroSection;
  membershipSection?: MembershipSection;
  howItWorksSection?: HowItWorksSection;
  productCategorySection?: ProductCategorySection;
  missionSection?: MissionSection;
  featuresSection?: FeaturesSection;
  designedByScienceSection?: DesignedByScienceSection;
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
    missionSection: {
      type: MissionSectionSchema,
    },
    featuresSection: {
      type: FeaturesSectionSchema,
    },
    designedByScienceSection: {
      type: DesignedByScienceSectionSchema,
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

