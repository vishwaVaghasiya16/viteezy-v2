import Joi from "joi";
import { MEDIA_TYPE_VALUES } from "@/models/enums";
import { withFieldLabels } from "./helpers";

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

const baseI18nStringSchema = Joi.object({
  en: Joi.string().trim().allow("", null),
  nl: Joi.string().trim().allow("", null),
  de: Joi.string().trim().allow("", null),
  fr: Joi.string().trim().allow("", null),
  es: Joi.string().trim().allow("", null),
});

const baseI18nTextSchema = Joi.object({
  en: Joi.string().trim().allow("", null),
  nl: Joi.string().trim().allow("", null),
  de: Joi.string().trim().allow("", null),
  fr: Joi.string().trim().allow("", null),
  es: Joi.string().trim().allow("", null),
});

const baseMediaSchema = Joi.object({
  type: Joi.string()
    .valid(...MEDIA_TYPE_VALUES)
    .optional(),
  url: Joi.string().uri().trim().allow("", null),
  sortOrder: Joi.number().integer().min(0).optional(),
});

const i18nStringSchema = withJsonSupport(baseI18nStringSchema, {
  allowEmpty: true,
}).optional();
const i18nTextSchema = withJsonSupport(baseI18nTextSchema, {
  allowEmpty: true,
}).optional();
const mediaSchema = withJsonSupport(baseMediaSchema, {
  allowEmpty: true,
}).optional();

// Banner Section Schema
const bannerSectionSchema = Joi.object({
  banner_image: mediaSchema.label("Banner image"),
  banner_title: i18nStringSchema.label("Banner title"),
  banner_subtitle: i18nTextSchema.label("Banner subtitle"),
  banner_button_text: i18nStringSchema.label("Banner button text"),
  banner_button_link: Joi.string()
    .uri()
    .trim()
    .allow("", null)
    .optional()
    .label("Banner button link"),
});

// Founder Quote Section Schema
const founderQuoteSectionSchema = Joi.object({
  founder_image: mediaSchema.label("Founder image"),
  founder_quote_text: i18nTextSchema.label("Founder quote text"),
  founder_name: i18nStringSchema.label("Founder name"),
  founder_designation: i18nStringSchema.label("Founder designation"),
  note: i18nTextSchema.label("Note"),
});

// Meet Brains Section Schema
const meetBrainsSectionSchema = Joi.object({
  meet_brains_title: i18nStringSchema.label("Meet brains title"),
  meet_brains_subtitle: i18nTextSchema.label("Meet brains subtitle"),
  meet_brains_main_image: mediaSchema.label("Meet brains main image"),
});

// Timeline Event Schema
const timelineEventSchema = Joi.object({
  year: Joi.string().trim().allow("", null).optional(),
  title: i18nStringSchema.label("Timeline event title"),
  description: i18nTextSchema.label("Timeline event description"),
  order: Joi.number().integer().min(0).optional(),
});

// Timeline Section Schema
const timelineSectionSchema = Joi.object({
  timeline_section_title: i18nStringSchema.label("Timeline section title"),
  timeline_section_description: i18nTextSchema.label(
    "Timeline section description"
  ),
  timeline_events: Joi.array()
    .items(timelineEventSchema)
    .optional()
    .label("Timeline events"),
});

// People Section Schema
const peopleSectionSchema = Joi.object({
  title: i18nStringSchema.label("People section title"),
  subtitle: i18nTextSchema.label("People section subtitle"),
  images: Joi.array().items(mediaSchema).optional().label("People images"),
});

// Upsert About Us Schema
export const upsertAboutUsSchema = Joi.object(
  withFieldLabels({
    banner: withJsonSupport(bannerSectionSchema, {
      allowEmpty: true,
    }).optional(),
    founderQuote: withJsonSupport(founderQuoteSectionSchema, {
      allowEmpty: true,
    }).optional(),
    meetBrains: withJsonSupport(meetBrainsSectionSchema, {
      allowEmpty: true,
    }).optional(),
    timeline: withJsonSupport(timelineSectionSchema, {
      allowEmpty: true,
    }).optional(),
    people: withJsonSupport(peopleSectionSchema, {
      allowEmpty: true,
    }).optional(),
  })
)
  .min(1)
  .label("UpsertAboutUsPayload");

// Update Section Params Schema
export const updateSectionParamsSchema = Joi.object(
  withFieldLabels({
    section: Joi.string()
      .valid("banner", "founderQuote", "meetBrains", "timeline", "people")
      .required()
      .label("Section name"),
  })
).label("UpdateSectionParams");

// Update Section Data Schema (validates the body data based on section)
export const updateSectionDataSchema = Joi.alternatives()
  .try(
    bannerSectionSchema,
    founderQuoteSectionSchema,
    meetBrainsSectionSchema,
    timelineSectionSchema,
    peopleSectionSchema
  )
  .optional();

// Section Data Schemas (for updateSection endpoint)
export const bannerSectionDataSchema =
  withJsonSupport(bannerSectionSchema).optional();
export const founderQuoteSectionDataSchema = withJsonSupport(
  founderQuoteSectionSchema
).optional();
export const meetBrainsSectionDataSchema = withJsonSupport(
  meetBrainsSectionSchema
).optional();
export const timelineSectionDataSchema = withJsonSupport(
  timelineSectionSchema
).optional();
export const peopleSectionDataSchema =
  withJsonSupport(peopleSectionSchema).optional();
