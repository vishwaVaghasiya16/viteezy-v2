import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { FILE_UPLOAD } from "@/constants";
import { config } from "@/config";
import { AppError } from "@/utils/AppError";

const storage = multer.memoryStorage();

const allowedMimeTypes: ReadonlyArray<string> = FILE_UPLOAD.ALLOWED_TYPES;

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Invalid file type. Allowed types are JPEG, PNG, GIF, and WEBP.",
        400
      )
    );
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter,
});

/**
 * Middleware to handle Multer errors and provide user-friendly messages
 * @param multerMiddleware - The multer middleware (e.g., upload.single('fieldName'))
 * @param fieldName - The field name for the file (for error messages)
 * @returns Express middleware
 */
export const handleMulterError = (
  multerMiddleware: any,
  fieldName: string = "file"
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    multerMiddleware(req, res, (err: any) => {
      if (err) {
        // Handle Multer errors
        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case "LIMIT_UNEXPECTED_FILE":
              return next(
                new AppError(
                  `Only one ${fieldName} is allowed. Please upload a single file.`,
                  400
                )
              );
            case "LIMIT_FILE_SIZE":
              return next(
                new AppError(
                  `File size too large. Maximum allowed size is ${Math.round(
                    config.upload.maxFileSize / 1024 / 1024
                  )}MB.`,
                  400
                )
              );
            case "LIMIT_FILE_COUNT":
              return next(
                new AppError(
                  `Too many files. Only one ${fieldName} is allowed.`,
                  400
                )
              );
            case "LIMIT_FIELD_KEY":
              return next(
                new AppError(
                  `Invalid field name. Use '${fieldName}' as the field name.`,
                  400
                )
              );
            default:
              return next(
                new AppError(
                  `File upload error: ${err.message || "Unknown error"}`,
                  400
                )
              );
          }
        }

        // Handle other errors (like AppError from fileFilter)
        if (err instanceof AppError) {
          return next(err);
        }

        // Handle unknown errors
        return next(
          new AppError(
            `File upload failed: ${err.message || "Unknown error"}`,
            400
          )
        );
      }

      // No error, continue
      next();
    });
  };
};
