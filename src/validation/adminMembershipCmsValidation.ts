import Joi from "joi";
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

// I18n String Schema - accepts either a plain string (will be converted to I18n by middleware) or an I18n object
const i18nStringSchema = Joi.alternatives()
  .try(
    Joi.string().trim().min(1), // Plain string (before auto-translation)
    withJsonSupport(baseI18nStringSchema, { allowEmpty: true }) // I18n object (after auto-translation middleware or direct input)
  )
  .optional()
  .allow(null);

// I18n Text Schema - accepts either a plain string (will be converted to I18n by middleware) or an I18n object
const i18nTextSchema = Joi.alternatives()
  .try(
    Joi.string().trim().allow("", null), // Plain string (before auto-translation)
    withJsonSupport(baseI18nTextSchema, { allowEmpty: true }) // I18n object (after auto-translation middleware or direct input)
  )
  .optional()
  .allow(null);

// Membership Benefit Schema
const membershipBenefitSchema = Joi.object({
  title: i18nStringSchema.label("Benefit title"),
  subtitle: i18nStringSchema.label("Benefit subtitle"),
  image: Joi.string().uri().trim().allow("", null).optional(),
});

// Helper to support array as JSON string in multipart/form-data
const membershipBenefitsArraySchema = Joi.alternatives()
  .try(
    Joi.array().items(membershipBenefitSchema).max(3).default([]),
    Joi.string().custom((value, helpers) => {
      if (!value || value.trim() === "") {
        return []; // Return empty array if empty string
      }
      try {
        const parsed = JSON.parse(value.trim());
        if (!Array.isArray(parsed)) {
          return helpers.error("any.invalid", {
            message: "Membership benefits must be an array",
          });
        }
        // Validate each item in the array
        if (parsed.length > 3) {
          return helpers.error("any.invalid", {
            message: "Membership benefits cannot exceed 3 items",
          });
        }
        // Validate each benefit object
        for (let i = 0; i < parsed.length; i++) {
          const { error } = membershipBenefitSchema.validate(parsed[i], {
            abortEarly: false,
          });
          if (error) {
            return helpers.error("any.invalid", {
              message: `Invalid benefit at index ${i}: ${error.details[0].message}`,
            });
          }
        }
        return parsed;
      } catch (err) {
        return helpers.error("any.invalid", {
          message: "Invalid JSON format for membership benefits",
        });
      }
    })
  )
  .optional()
  .default([]);

// Create Membership CMS Schema
export const createMembershipCmsSchema = Joi.object(
  withFieldLabels({
    coverImage: Joi.string().uri().trim().allow("", null).optional(),
    heading: i18nStringSchema.label("Heading"),
    description: i18nTextSchema.label("Description"),
    membershipBenefits: membershipBenefitsArraySchema.label("Membership benefits"),
    ctaButtonText: i18nStringSchema.label("CTA button text"),
    note: i18nTextSchema.label("Note"),
    isActive: Joi.boolean().optional(),
  })
);

// Update Membership CMS Schema
export const updateMembershipCmsSchema = Joi.object(
  withFieldLabels({
    coverImage: Joi.string().uri().trim().allow("", null).optional(),
    heading: i18nStringSchema.label("Heading"),
    description: i18nTextSchema.label("Description"),
    membershipBenefits: membershipBenefitsArraySchema.label("Membership benefits"),
    ctaButtonText: i18nStringSchema.label("CTA button text"),
    note: i18nTextSchema.label("Note"),
    isActive: Joi.boolean().optional(),
  })
);

// ID Params Schema
export const membershipCmsIdParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "Invalid membership CMS ID format",
        "any.required": "Membership CMS ID is required",
      })
      .label("ID"),
  })
);

