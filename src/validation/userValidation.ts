import { body } from "express-validator";
import { GENDER_VALUES } from "@/models/enums";

export const getCurrentUserValidation: any[] = [];

export const updateCurrentUserValidation = [
  body("name")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("phone")
    .optional()
    .matches(/^[+]?[1-9]\d{1,14}$/)
    .withMessage("Phone must be a valid E.164 number"),
  body("profileImage")
    .optional({ nullable: true })
    .isURL()
    .withMessage("Profile image must be a valid URL"),
  body("gender")
    .optional({ nullable: true })
    .isIn(GENDER_VALUES)
    .withMessage(`Gender must be one of: ${GENDER_VALUES.join(", ")}`),
  body("age")
    .optional({ nullable: true })
    .isInt({ min: 1, max: 150 })
    .withMessage("Age must be between 1 and 150"),
];
