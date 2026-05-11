import Joi from "joi";
import { UserRole } from "@/models/enums";

export const createStaffSchema = Joi.object({
  firstName: Joi.string().required().trim().min(1).max(50),
  lastName: Joi.string().allow("").trim().max(50),
  email: Joi.string().required().email().lowercase().trim(),
  password: Joi.string().required().min(6),
  phone: Joi.string().allow(null, "").pattern(/^[+]?[1-9]\d{1,14}$/),
  role: Joi.string()
    .valid(UserRole.ADMIN, UserRole.MODERATOR, UserRole.INVENTORY_MANAGER)
    .required(),
  isActive: Joi.boolean().default(true),
});

export const updateStaffSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(50),
  lastName: Joi.string().allow("").trim().max(50),
  email: Joi.string().email().lowercase().trim(),
  password: Joi.string().min(6),
  phone: Joi.string().allow(null, "").pattern(/^[+]?[1-9]\d{1,14}$/),
  role: Joi.string().valid(
    UserRole.ADMIN,
    UserRole.MODERATOR,
    UserRole.INVENTORY_MANAGER
  ),
  isActive: Joi.boolean(),
});

export const staffIdParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});
