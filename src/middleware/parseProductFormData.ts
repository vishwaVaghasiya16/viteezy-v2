import { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/AppError";

const ARRAY_FIELDS = [
  "benefits",
  "ingredients",
  "categories",
  "healthGoals",
  "galleryImages",
  "standupPouchImages",
];
const JSON_FIELDS = [
  "price",
  "sachetPrices",
  "standupPouchPrice",
  "comparisonSection",
  "specification",
];

const toBoolean = (value: any): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }
  return undefined;
};

const parseArrayField = (value: any): string[] | undefined => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.length) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return undefined;
};

/**
 * Fixes common JSON escaping issues that can occur when JSON is sent via form data
 * - Removes invalid escape sequences like \$ (dollar sign doesn't need escaping in JSON)
 * - Handles cases where backslash+dollar appears in the string
 */
const fixJSONEscaping = (jsonString: string): string => {
  // Fix invalid escape sequences: \$ should be just $ (dollar doesn't need escaping in JSON)
  // Handle patterns like \\$ (escaped backslash + dollar) or \$ (invalid escape)
  // We need to be careful to only fix invalid escapes, not break valid ones
  let fixed = jsonString;
  
  // Replace \\$ (literal backslash + dollar) with just $ 
  // This handles cases where curl sends \\\$ which becomes \\$ in the JSON string
  fixed = fixed.replace(/\\\\\$/g, '$');
  
  // Replace \$ (invalid escape sequence) with $ 
  // This handles direct invalid escapes
  fixed = fixed.replace(/\\\$/g, '$');
  
  return fixed;
};

const parseJSONField = (value: any, fieldName: string): Record<string, any> | undefined => {
  // Skip if undefined or null
  if (value === undefined || value === null) return undefined;
  
  // If already an object, return as is
  if (typeof value === "object" && value !== null) return value as Record<string, any>;
  
  // Handle string values
  if (typeof value === "string") {
    const trimmed = value.trim();
    
    // Skip empty strings
    if (!trimmed || trimmed === "" || trimmed === "null" || trimmed === "undefined") {
      return undefined;
    }
    
    try {
      // Try parsing as-is first
      return JSON.parse(trimmed);
    } catch (error) {
      // If parsing fails, try fixing common escaping issues
      try {
        const fixed = fixJSONEscaping(trimmed);
        return JSON.parse(fixed);
      } catch (fixError) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new AppError(
          `Invalid JSON format in multipart payload for field '${fieldName}': ${errorMessage}. Value preview: ${trimmed.substring(0, 200)}`,
          400
        );
      }
    }
  }
  
  return undefined;
};

export const parseProductFormData = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    ARRAY_FIELDS.forEach((field) => {
      const parsed = parseArrayField(req.body[field]);
      if (parsed !== undefined) {
        req.body[field] = parsed;
      }
    });

    JSON_FIELDS.forEach((field) => {
      // Only process if field exists in request body
      if (req.body[field] !== undefined) {
        const parsed = parseJSONField(req.body[field], field);
        if (parsed !== undefined) {
          req.body[field] = parsed;
        } else {
          // Remove empty/null values for optional JSON fields
          delete req.body[field];
        }
      }
    });

    if (req.body.hasStandupPouch !== undefined) {
      const boolValue = toBoolean(req.body.hasStandupPouch);
      if (boolValue !== undefined) {
        req.body.hasStandupPouch = boolValue;
      }
    }

    // Handle specification with individual fields (title1, descr1, etc.)
    const hasSpecificationFields = req.body.specificationMainTitle || 
      req.body.specificationTitle1 || req.body.specificationTitle2 || 
      req.body.specificationTitle3 || req.body.specificationTitle4;
    
    if (hasSpecificationFields) {
      if (!req.body.specification) {
        req.body.specification = {};
      }
      
      if (req.body.specificationMainTitle) {
        req.body.specification.main_title = req.body.specificationMainTitle;
        delete req.body.specificationMainTitle;
      }
      
      if (!req.body.specification.items) {
        req.body.specification.items = [];
      }
      
      // Build items array from individual fields
      for (let i = 1; i <= 4; i++) {
        const titleKey = `specificationTitle${i}`;
        const descrKey = `specificationDescr${i}`;
        
        if (req.body[titleKey] || req.body[descrKey]) {
          if (!req.body.specification.items[i - 1]) {
            req.body.specification.items[i - 1] = {};
          }
          if (req.body[titleKey]) {
            req.body.specification.items[i - 1].title = req.body[titleKey];
            delete req.body[titleKey];
          }
          if (req.body[descrKey]) {
            req.body.specification.items[i - 1].descr = req.body[descrKey];
            delete req.body[descrKey];
          }
        }
      }
      
      // Filter out empty items
      req.body.specification.items = req.body.specification.items.filter(
        (item: any) => item && (item.title || item.descr || item.image)
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

