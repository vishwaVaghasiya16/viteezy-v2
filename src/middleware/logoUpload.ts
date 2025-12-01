import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { FILE_UPLOAD } from "@/constants";
import { AppError } from "@/utils/AppError";

const storage = multer.memoryStorage();

// Allowed image MIME types
const allowedImageMimeTypes: ReadonlyArray<string> = FILE_UPLOAD.ALLOWED_TYPES;

// Maximum file size for logos (5MB)
const MAX_LOGO_SIZE = FILE_UPLOAD.MAX_SIZE; // 5MB

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.fieldname === "logoLight" || file.fieldname === "logoDark") {
    if (allowedImageMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          "Invalid logo file type. Allowed types are JPEG, PNG, GIF, and WEBP.",
          400
        )
      );
    }
  } else {
    cb(
      new AppError(
        "Unexpected field. Only 'logoLight' and 'logoDark' are allowed.",
        400
      )
    );
  }
};

export const logoUpload = multer({
  storage,
  limits: {
    fileSize: MAX_LOGO_SIZE,
  },
  fileFilter,
});

export const handleLogoUploadError = (multerMiddleware: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    multerMiddleware(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          let message = `File upload error: ${err.message || "Unknown error"}`;
          let fieldName = "file";

          if (err.field) {
            fieldName = err.field;
          }

          switch (err.code) {
            case "LIMIT_UNEXPECTED_FILE":
              message = `Only one ${fieldName} is allowed. Please upload a single file.`;
              break;
            case "LIMIT_FILE_SIZE":
              message = `${fieldName} file size too large. Maximum allowed size is 5MB.`;
              break;
            case "LIMIT_FILE_COUNT":
              message = `Too many files. Only one ${fieldName} is allowed.`;
              break;
            default:
              break;
          }
          return next(new AppError(message, 400));
        }
        if (err instanceof AppError) {
          return next(err);
        }
        return next(
          new AppError(
            `File upload failed: ${err.message || "Unknown error"}`,
            400
          )
        );
      }
      next();
    });
  };
};
