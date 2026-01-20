import { Request, Response, NextFunction } from "express";

const toBoolean = (value: any): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }
  return undefined;
};

const getValue = (value: any): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "null" || trimmed === "undefined" ? undefined : trimmed;
  }
  return String(value);
};

/**
 * Simple field mapping - converts flat form-data fields to nested structure
 * Supports underscore notation: heroSection_title, howItWorksSection_steps_0_title
 */
const buildNestedStructure = (body: any): any => {
  const result: any = {};
  
  // Helper to set nested value with array support
  const setNestedValue = (obj: any, path: string[], value: any) => {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const pathKey = path[i];
      const nextKey = path[i + 1];
      const isNextArrayIndex = /^\d+$/.test(nextKey);
      
      if (isNextArrayIndex) {
        // Handle array: steps[0]
        if (!current[pathKey]) current[pathKey] = [];
        const index = parseInt(nextKey);
        // Ensure array is large enough
        while (current[pathKey].length <= index) {
          current[pathKey].push({});
        }
        current = current[pathKey][index];
        i++; // Skip the index
      } else {
        // Handle object
        if (!current[pathKey]) current[pathKey] = {};
        current = current[pathKey];
      }
    }
    
    const finalKey = path[path.length - 1];
    current[finalKey] = value;
  };
  
  // Process all fields
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null || value === "") continue;
    
    // Handle simple flat fields
    if (key === "isActive") {
      const boolValue = toBoolean(value);
      if (boolValue !== undefined) result[key] = boolValue;
      continue;
    }
    
    // Skip file upload fields (handled by image upload middleware)
    if (key === "heroSection_image_url" ||
        key === "heroSection_video_url" ||
        key === "heroSection_media_url" ||
        key === "heroSectionMedia" ||
        key === "heroBackgroundImage" ||
        key === "membershipBackgroundImage" || 
        key === "missionBackgroundImage" ||
        key === "howItWorksStepImages" ||
        key === "designedByScienceStepImages" ||
        key === "featureIcons" ||
        key.startsWith("featureIcons_") || // Skip indexed featureIcons (featureIcons_0, featureIcons_1, etc.)
        key === "heroPrimaryCTAImages" ||
        key === "communityBackgroundImage") {
      continue;
    }
    
    const stringValue = getValue(value);
    if (stringValue === undefined) continue;
    
    // Handle nested fields with underscore notation
    // Examples: heroSection_title, howItWorksSection_steps_0_title
    if (key.includes("_")) {
      const parts = key.split("_");
      if (parts.length >= 2) {
        // Build path array, handling numbers as array indices
        const path: string[] = [];
        for (let i = 0; i < parts.length; i++) {
          path.push(parts[i]);
        }
        setNestedValue(result, path, stringValue);
      }
    }
    // Handle dot notation: heroSection.title
    else if (key.includes(".")) {
      const path = key.split(".");
      setNestedValue(result, path, stringValue);
    }
    // Keep other fields as-is
    else {
      result[key] = stringValue;
    }
  }
  
  return result;
};

export const parseLandingPageFormData = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Parse nested fields from form-data
    const parsed = buildNestedStructure(req.body);

    // Normalize heroSection.highlightedText coming from keys like:
    // heroSection_highlightedText_0, heroSection_highlightedText_1, ...
    if (parsed.heroSection && Array.isArray(parsed.heroSection.highlightedText)) {
      parsed.heroSection.highlightedText = parsed.heroSection.highlightedText.map(
        (item: any) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const firstKey = Object.keys(item)[0];
            const value = (item as any)[firstKey];
            return typeof value === "string" ? value : String(value);
          }
          return item;
        }
      );
    }

    // Normalize productCategorySection.productCategoryIds coming from keys like:
    // productCategorySection_productCategoryIds_0, productCategorySection_productCategoryIds_1, ...
    if (
      parsed.productCategorySection &&
      Array.isArray(parsed.productCategorySection.productCategoryIds)
    ) {
      parsed.productCategorySection.productCategoryIds =
        parsed.productCategorySection.productCategoryIds.map((item: any) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const firstKey = Object.keys(item)[0];
            const value = (item as any)[firstKey];
            return typeof value === "string" ? value : String(value);
          }
          return item;
        });
    }

    // Normalize testimonialsSection.testimonialIds coming from keys like:
    // testimonialsSection_testimonialIds_0, testimonialsSection_testimonialIds_1, ...
    if (
      parsed.testimonialsSection &&
      Array.isArray(parsed.testimonialsSection.testimonialIds)
    ) {
      parsed.testimonialsSection.testimonialIds =
        parsed.testimonialsSection.testimonialIds.map((item: any) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const firstKey = Object.keys(item)[0];
            const value = (item as any)[firstKey];
            return typeof value === "string" ? value : String(value);
          }
          return item;
        });
    }
    
    // Collect all flat field keys that were converted to nested structure
    // These need to be removed from req.body to avoid validation errors
    const flatFieldsToRemove = new Set<string>();
    for (const key of Object.keys(req.body)) {
      // Skip file upload fields (already handled by image upload middleware)
      if (
        key === "heroSection_image_url" ||
        key === "heroSection_video_url" ||
        key === "heroSection_media_url" ||
        key === "heroSectionMedia" ||
        key === "heroBackgroundImage" ||
        key === "membershipBackgroundImage" ||
        key === "missionBackgroundImage" ||
        key === "howItWorksStepImages" ||
        key === "designedByScienceStepImages" ||
        key === "featureIcons" ||
        key === "heroPrimaryCTAImages" ||
        key === "communityBackgroundImage"
      ) {
        continue;
      }
      
      // If key contains underscore (except isActive), it was converted to nested structure
      if (key.includes("_") && key !== "isActive") {
        flatFieldsToRemove.add(key);
      }
    }
    
    // Remove all flat fields that were converted to nested structure
    for (const key of flatFieldsToRemove) {
      delete req.body[key];
    }
    
    // Replace req.body with parsed nested structure (this overwrites any remaining flat fields)
    req.body = parsed;
    
    // Ensure isActive is boolean if present
    if (req.body.isActive !== undefined) {
      const boolValue = toBoolean(req.body.isActive);
      if (boolValue !== undefined) {
        req.body.isActive = boolValue;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

