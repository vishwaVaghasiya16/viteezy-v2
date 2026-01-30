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
    return trimmed === "" || trimmed === "null" || trimmed === "undefined"
      ? undefined
      : trimmed;
  }
  return String(value);
};

/**
 * Parse nested structure from form-data
 * Handles About Us specific field naming patterns:
 * - banner_banner_title_en -> banner.banner_title.en
 * - founderQuote_founder_quote_text_en -> founderQuote.founder_quote_text.en
 * - timeline_timeline_events_0_year -> timeline.timeline_events[0].year
 * - people_title_en -> people.title.en
 */
const buildNestedStructure = (body: any): any => {
  const result: any = {};

  // Known section names mapping (lowercase key -> actual section name)
  // IMPORTANT: Order matters - longer/more specific names should come first
  const sectionMap: { [key: string]: string } = {
    foundernote: "founderNote", // Must come before any other matching
    meetbrains: "meetBrains",
    banner: "banner",
    timeline: "timeline",
    people: "people",
  };

  // Language codes
  const languageCodes = ["en", "nl", "de", "fr", "es"];

  // Helper to set nested value with array support
  const setNestedValue = (obj: any, path: string[], value: any) => {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const pathKey = path[i];
      const nextKey = path[i + 1];
      const isNextArrayIndex = /^\d+$/.test(nextKey);

      if (isNextArrayIndex) {
        // Handle array: timeline_events[0]
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

    // Skip file upload fields (handled by image upload middleware)
    if (
      key === "banner_image" ||
      key === "meet_brains_main_image" ||
      key === "people_images"
    ) {
      continue;
    }

    const stringValue = getValue(value);
    if (stringValue === undefined) continue;

    // Handle dot notation: banner.banner_title.en
    if (key.includes(".")) {
      const path = key.split(".");
      setNestedValue(result, path, stringValue);
      continue;
    }

    // Handle underscore notation
    if (key.includes("_")) {
      const keyLower = key.toLowerCase();

      // Find matching section name
      let matchedSection: string | null = null;
      let sectionPrefix: string | null = null;

      for (const [sectionKeyLower, sectionName] of Object.entries(sectionMap)) {
        if (keyLower.startsWith(sectionKeyLower + "_")) {
          matchedSection = sectionName;
          // Find the actual prefix in original key (case-sensitive)
          // Try exact match first
          if (key.startsWith(sectionName + "_")) {
            sectionPrefix = sectionName;
          } else {
            // Try camelCase variations
            const camelCase =
              sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
            if (key.startsWith(camelCase + "_")) {
              sectionPrefix = camelCase;
            } else {
              // Use lowercase version
              sectionPrefix = sectionKeyLower;
            }
          }
          break;
        }
      }

      if (matchedSection && sectionPrefix) {
        // Extract remaining part after section prefix
        const remaining = key.substring(sectionPrefix.length + 1);
        
        // Handle array pattern: timeline_events_0_title
        const arrayMatch = remaining.match(/^(.+?)_(\d+)_(.+)$/);
        if (arrayMatch) {
          const [, arrayName, index, fieldName] = arrayMatch;
          const lastPart = fieldName.split("_").pop() || "";
          const isLastPartLang = languageCodes.includes(lastPart);
          
          const path: string[] = [matchedSection];
          if (isLastPartLang) {
            const fieldNameWithoutLang = fieldName.substring(0, fieldName.lastIndexOf("_"));
            path.push(arrayName, index, fieldNameWithoutLang, lastPart);
          } else {
            path.push(arrayName, index, fieldName);
          }
          setNestedValue(result, path, stringValue);
          continue;
        }
        
        // Handle language suffix: field_name_en
        const parts = remaining.split("_");
        const lastPart = parts[parts.length - 1];
        const isLastPartLang = languageCodes.includes(lastPart);
        
        const path: string[] = [matchedSection];
        
        if (isLastPartLang) {
          // Has language code: field_name_lang
          const fieldName = parts.slice(0, -1).join("_");
          path.push(fieldName, lastPart);
        } else {
          // No language code: just field_name (keep as single string)
          const fieldName = remaining; // Keep entire remaining part as field name
          path.push(fieldName);
        }

        setNestedValue(result, path, stringValue);
      } else {
        // No section match, treat as top-level field (don't create nested structure)
        // This handles keys that don't match any known section
        result[key] = stringValue;
      }
    } else {
      // No underscores, keep as-is
      result[key] = stringValue;
    }
  }

  return result;
};

export const parseAboutUsFormData = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Store original body for reference
    const originalBody = { ...req.body };

    // Parse nested fields from form-data
    const parsed = buildNestedStructure(req.body);

    // Replace req.body with parsed structure (don't merge, replace)
    req.body = parsed;

    next();
  } catch (error) {
    next(error);
  }
};
