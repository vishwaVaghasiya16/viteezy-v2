import Joi from "joi";
import { withFieldLabels } from "./helpers";

/**
 * Public API validation schema for About Us
 */
export const getAboutUsQuerySchema = Joi.object(
  withFieldLabels({
    lang: Joi.string()
      .valid("en", "nl", "de", "fr", "es")
      .optional()
      .label("Language"),
  })
)
  .unknown(false)
  .label("AboutUsQuery");
