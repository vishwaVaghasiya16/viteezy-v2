import Joi from "joi";
import { withFieldLabels } from "./helpers";
import { paginationQuerySchema } from "./commonValidation";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

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
  en: Joi.string().trim().min(1).required().messages({
    "any.required": "English content is required",
    "string.min": "English content must be at least 1 character",
  }),
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

const i18nStringSchema = withJsonSupport(baseI18nStringSchema).required();
const i18nTextSchema = withJsonSupport(baseI18nTextSchema, {
  allowEmpty: true,
}).optional();

const imageSchema = Joi.string()
  .uri()
  .allow("", null)
  .empty("")
  .messages({ "string.uri": "Image must be a valid URL" })
  .label("Image");

export const createTeamMemberSchema = Joi.object(
  withFieldLabels({
    name: Joi.string().label("Name").required(),
    designation: i18nStringSchema.label("Designation"),
    content: i18nTextSchema.label("Content/About"),
    image: imageSchema.optional(),
  })
).label("CreateTeamMemberPayload");

export const updateTeamMemberSchema = Joi.object(
  withFieldLabels({
    name: Joi.string().label("Name"),
    designation: i18nStringSchema.label("Designation"),
    content: i18nTextSchema.label("Content/About"),
    image: imageSchema.optional(),
  })
)
  .label("UpdateTeamMemberPayload")
  .min(1);

export const teamMemberIdParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid team member ID",
      "any.required": "Team member ID is required",
    }),
  })
);

export const getTeamMembersQuerySchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sort: Joi.string().optional(),
    order: Joi.string().valid("asc", "desc").optional(),
    search: Joi.string().trim().allow("", null).optional().label("Search term"),
  })
)
  .unknown(false)
  .label("TeamMembersQuery");

/**
 * Public API validation schemas
 */
export const getPublicTeamMembersQuerySchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sort: Joi.string().optional(),
    order: Joi.string().valid("asc", "desc").optional(),
    lang: Joi.string()
      .valid("en", "nl", "de", "fr", "es")
      .optional()
      .label("Language"),
  })
)
  .unknown(false)
  .label("PublicTeamMembersQuery");

export const getPublicTeamMemberParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid team member ID",
      "any.required": "Team member ID is required",
    }),
  })
);

export const getPublicTeamMemberQuerySchema = Joi.object(
  withFieldLabels({
    lang: Joi.string()
      .valid("en", "nl", "de", "fr", "es")
      .optional()
      .label("Language"),
  })
)
  .unknown(false)
  .label("PublicTeamMemberQuery");
