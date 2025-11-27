import Joi from "joi";
import { GENDER_VALUES } from "@/models/enums";
import { withFieldLabels } from "./helpers";

export const updateCurrentUserSchema = Joi.object(
  withFieldLabels({
    name: Joi.string().trim().min(2).max(50),
    phone: Joi.string()
      .pattern(/^[+]?[1-9]\d{1,14}$/)
      .message("Phone must be a valid E.164 number"),
    profileImage: Joi.string().uri().allow(null),
    gender: Joi.string()
      .allow(null)
      .valid(...GENDER_VALUES),
    age: Joi.number().integer().min(1).max(150).allow(null),
  })
)
  .min(1)
  .label("UserUpdatePayload");
