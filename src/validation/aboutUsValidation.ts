import Joi from "joi";
import { withFieldLabels } from "./helpers";
import { getLanguageQuerySchema } from "@/utils/i18nValidationHelper";

/**
 * Public API validation schema for About Us
 */
export const getAboutUsQuerySchema = Joi.object(
  withFieldLabels({
    lang: getLanguageQuerySchema().label("Language"),
  })
)
  .unknown(false)
  .label("AboutUsQuery");
