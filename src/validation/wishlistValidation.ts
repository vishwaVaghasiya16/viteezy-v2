import { body, param, query } from "express-validator";

export const addWishlistItemValidation = [
  body("productId").isMongoId().withMessage("Valid productId is required"),
  body("notes")
    .optional({ nullable: true })
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

export const updateWishlistItemValidation = [
  param("id").isMongoId().withMessage("Invalid wishlist item ID"),
  body("notes")
    .optional({ nullable: true })
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

export const wishlistPaginationValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("includeProduct")
    .optional()
    .isBoolean()
    .withMessage("includeProduct must be a boolean value"),
];

export const wishlistItemParamValidation = [
  param("id").isMongoId().withMessage("Invalid wishlist item ID"),
];
