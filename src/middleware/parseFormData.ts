import { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/AppError";

/**
 * Middleware to parse JSON strings in multipart form data
 * This is needed because form data sends all values as strings,
 * including JSON arrays/objects that need to be parsed
 *
 * @param fields - Array of field names that should be parsed as JSON
 * @returns Express middleware function
 */
export const parseFormDataJson = (
  fields: string[] = ["products", "metadata"]
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse each specified field if it's a string
      for (const field of fields) {
        if (req.body[field] && typeof req.body[field] === "string") {
          try {
            req.body[field] = JSON.parse(req.body[field]);
          } catch (parseError) {
            throw new AppError(
              `Invalid JSON format in field "${field}": ${
                parseError instanceof Error
                  ? parseError.message
                  : "Unknown error"
              }`,
              400
            );
          }
        }
      }

      // Also handle boolean strings
      if (req.body.isVisibleOnHomepage !== undefined) {
        if (typeof req.body.isVisibleOnHomepage === "string") {
          req.body.isVisibleOnHomepage =
            req.body.isVisibleOnHomepage === "true" ||
            req.body.isVisibleOnHomepage === "1";
        }
      }

      // Handle number strings
      if (req.body.displayOrder !== undefined) {
        if (typeof req.body.displayOrder === "string") {
          const parsed = parseInt(req.body.displayOrder, 10);
          if (!isNaN(parsed)) {
            req.body.displayOrder = parsed;
          }
        }
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      next(
        new AppError(
          `Error parsing form data: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          400
        )
      );
    }
  };
};
