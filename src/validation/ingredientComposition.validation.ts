import { body, param, query } from "express-validator";

// Validation for creating ingredient composition
export const createIngredientCompositionValidation = [
  body("product")
    .notEmpty()
    .withMessage("Product ID is required")
    .isMongoId()
    .withMessage("Invalid product ID format"),
  
  body("ingredient")
    .notEmpty()
    .withMessage("Ingredient ID is required")
    .isMongoId()
    .withMessage("Invalid ingredient ID format"),
  
  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isFloat({ min: 0 })
    .withMessage("Quantity must be a positive number"),
  
  body("driPercentage")
    .notEmpty()
    .withMessage("DRI percentage is required")
    .custom((value) => {
      // Allow: positive number, "*", or "**"
      if (typeof value === 'number' && value >= 0) {
        return true;
      }
      if (value === "*" || value === "**") {
        return true;
      }
      throw new Error("DRI percentage must be a positive number, '*', or '**'");
    }),
];

// Validation for updating ingredient composition
export const updateIngredientCompositionValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid composition ID format"),
  
  body("quantity")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Quantity must be a positive number"),
  
  body("driPercentage")
    .optional()
    .custom((value) => {
      // Allow: positive number, "*", or "**"
      if (typeof value === 'number' && value >= 0) {
        return true;
      }
      if (value === "*" || value === "**") {
        return true;
      }
      throw new Error("DRI percentage must be a positive number, '*', or '**'");
    }),
];

// Validation for bulk update
export const bulkUpdateCompositionsValidation = [
  param("productId")
    .isMongoId()
    .withMessage("Invalid product ID format"),
  
  body("compositions")
    .isArray({ min: 1 })
    .withMessage("Compositions array is required and must not be empty"),
  
  body("compositions.*.ingredient")
    .notEmpty()
    .withMessage("Ingredient ID is required")
    .isMongoId()
    .withMessage("Invalid ingredient ID format"),
  
  body("compositions.*.quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isFloat({ min: 0 })
    .withMessage("Quantity must be a positive number"),
  
  body("compositions.*.driPercentage")
    .notEmpty()
    .withMessage("DRI percentage is required")
    .custom((value) => {
      // Allow: positive number, "*", or "**"
      if (typeof value === 'number' && value >= 0) {
        return true;
      }
      if (value === "*" || value === "**") {
        return true;
      }
      throw new Error("DRI percentage must be a positive number, '*', or '**'");
    }),
];

// Validation for getting compositions by ID
export const getCompositionByIdValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid composition ID format"),
];

// Validation for getting compositions by product
export const getCompositionsByProductValidation = [
  param("productId")
    .isMongoId()
    .withMessage("Invalid product ID format"),
];

// Validation for query parameters
export const getCompositionsQueryValidation = [
  query("product")
    .optional()
    .isMongoId()
    .withMessage("Invalid product ID format"),
  
  query("ingredient")
    .optional()
    .isMongoId()
    .withMessage("Invalid ingredient ID format"),
  
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  
  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt", "quantity", "driPercentage"])
    .withMessage("Invalid sort field"),
  
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];

// Validation for deleting composition
export const deleteCompositionValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid composition ID format"),
];
