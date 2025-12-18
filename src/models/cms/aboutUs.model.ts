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
  AuditType,
} from "../common.model";

// Banner Section
export interface BannerSection {
  banner_image: MediaType; // Banner image
  banner_title: I18nStringType;
  banner_subtitle: I18nTextType;
  banner_button_text: I18nStringType;
  banner_button_link: string;
}

const BannerSectionSchema = new Schema<BannerSection>(
  {
    banner_image: {
      type: MediaSchema,
    },
    banner_title: {
      type: I18nString,
      default: () => ({}),
    },
    banner_subtitle: {
      type: I18nText,
      default: () => ({}),
    },
    banner_button_text: {
      type: I18nString,
      default: () => ({}),
    },
    banner_button_link: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// Founder Quote Section
export interface FounderQuoteSection {
  founder_image: MediaType;
  founder_quote_text: I18nTextType;
  founder_name: I18nStringType;
  founder_designation: I18nStringType;
  note: I18nTextType;
}

const FounderQuoteSectionSchema = new Schema<FounderQuoteSection>(
  {
    founder_image: {
      type: MediaSchema,
    },
    founder_quote_text: {
      type: I18nText,
      default: () => ({}),
    },
    founder_name: {
      type: I18nString,
      default: () => ({}),
    },
    founder_designation: {
      type: I18nString,
      default: () => ({}),
    },
    note: {
      type: I18nText,
      default: () => ({}),
    },
  },
  { _id: false }
);

// Meet Brains Section
export interface MeetBrainsSection {
  meet_brains_title: I18nStringType;
  meet_brains_subtitle: I18nTextType;
  meet_brains_main_image: MediaType;
}

const MeetBrainsSectionSchema = new Schema<MeetBrainsSection>(
  {
    meet_brains_title: {
      type: I18nString,
      default: () => ({}),
    },
    meet_brains_subtitle: {
      type: I18nText,
      default: () => ({}),
    },
    meet_brains_main_image: {
      type: MediaSchema,
    },
  },
  { _id: false }
);

// Timeline Event
export interface TimelineEvent {
  year: string;
  title: I18nStringType;
  description: I18nTextType;
  order: number;
}

const TimelineEventSchema = new Schema<TimelineEvent>(
  {
    year: {
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

// Timeline Section
export interface TimelineSection {
  timeline_section_title: I18nStringType;
  timeline_section_description: I18nTextType;
  timeline_events: TimelineEvent[];
}

const TimelineSectionSchema = new Schema<TimelineSection>(
  {
    timeline_section_title: {
      type: I18nString,
      default: () => ({}),
    },
    timeline_section_description: {
      type: I18nText,
      default: () => ({}),
    },
    timeline_events: {
      type: [TimelineEventSchema],
      default: [],
    },
  },
  { _id: false }
);

// People Section
export interface PeopleSection {
  title: I18nStringType;
  subtitle: I18nTextType;
  images: MediaType[];
}

const PeopleSectionSchema = new Schema<PeopleSection>(
  {
    title: {
      type: I18nString,
      default: () => ({}),
    },
    subtitle: {
      type: I18nText,
      default: () => ({}),
    },
    images: {
      type: [MediaSchema],
      default: [],
    },
  },
  { _id: false }
);

// About Us Document Interface
export interface IAboutUs extends Document, AuditType {
  banner: BannerSection;
  founderQuote: FounderQuoteSection;
  meetBrains: MeetBrainsSection;
  timeline: TimelineSection;
  people: PeopleSection;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AboutUsSchema = new Schema<IAboutUs>(
  {
    banner: {
      type: BannerSectionSchema,
      default: () => ({}),
    },
    founderQuote: {
      type: FounderQuoteSectionSchema,
      default: () => ({}),
    },
    meetBrains: {
      type: MeetBrainsSectionSchema,
      default: () => ({}),
    },
    timeline: {
      type: TimelineSectionSchema,
      default: () => ({}),
    },
    people: {
      type: PeopleSectionSchema,
      default: () => ({}),
    },
    ...SoftDelete,
    ...(AuditSchema.obj as Record<string, unknown>),
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for efficient queries
AboutUsSchema.index({ isDeleted: 1 });

export const AboutUs = mongoose.model<IAboutUs>("about_us", AboutUsSchema);
