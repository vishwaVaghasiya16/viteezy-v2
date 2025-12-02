import { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/AppError";

const ARRAY_FIELDS = [
  "benefits",
  "ingredients",
  "categories",
  "healthGoals",
  "galleryImages",
  "sachetImages",
  "standupPouchImages",
];
const JSON_FIELDS = [
  "price",
  "sachetPrices",
  "standupPouchPrice",
  "standupPouchPrices", // Legacy field
  "nutritionTable",
  "meta",
  "sourceInfo",
  "comparisonSection",
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

const parseJSONField = (value: any): Record<string, any> | undefined => {
  if (typeof value === "object" && value !== null) return value as Record<string, any>;
  if (typeof value === "string" && value.length) {
    try {
      return JSON.parse(value);
    } catch {
      throw new AppError("Invalid JSON format in multipart payload", 400);
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
      const parsed = parseJSONField(req.body[field]);
      if (parsed !== undefined) {
        req.body[field] = parsed;
      }
    });

    if (req.body.hasStandupPouch !== undefined) {
      const boolValue = toBoolean(req.body.hasStandupPouch);
      if (boolValue !== undefined) {
        req.body.hasStandupPouch = boolValue;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

