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
  const sectionMap: { [key: string]: string } = {
    banner: "banner",
    founderquote: "founderQuote",
    meetbrains: "meetBrains",
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
      key === "founder_image" ||
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
        const parts = remaining.split("_");

        const path: string[] = [matchedSection];

        // Find array index in parts (look for numeric values)
        let arrayIndex: number | null = null;
        let arrayIndexPosition: number = -1;

        for (let i = 0; i < parts.length; i++) {
          if (/^\d+$/.test(parts[i])) {
            arrayIndex = parseInt(parts[i]);
            arrayIndexPosition = i;
            break;
          }
        }

        const lastPart = parts[parts.length - 1];
        const isLastPartLang = languageCodes.includes(lastPart);

        // Pattern: array_name_index_field_lang (e.g., timeline_events_0_title_en)
        if (arrayIndex !== null && arrayIndexPosition >= 0) {
          const arrayName = parts.slice(0, arrayIndexPosition).join("_");
          const fieldParts = parts.slice(arrayIndexPosition + 1);

          if (isLastPartLang && fieldParts.length >= 2) {
            // Has language code
            const fieldName = fieldParts.slice(0, -1).join("_");
            const lang = lastPart;
            path.push(arrayName, String(arrayIndex), fieldName, lang);
          } else {
            // No language code
            const fieldName = fieldParts.join("_");
            path.push(arrayName, String(arrayIndex), fieldName);
          }
        }
        // Pattern: field_name_lang (e.g., banner_title_en)
        else if (isLastPartLang) {
          const fieldName = parts.slice(0, -1).join("_");
          path.push(fieldName, lastPart);
        }
        // Pattern: just field_name (no language, no array)
        else {
          const fieldName = parts.join("_");
          path.push(fieldName);
        }

        setNestedValue(result, path, stringValue);
      } else {
        // No section match, treat as simple nested structure
        const parts = key.split("_");
        setNestedValue(result, parts, stringValue);
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
