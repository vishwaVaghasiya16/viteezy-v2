import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { FILE_UPLOAD } from "@/constants";
import { AppError } from "@/utils/AppError";

const storage = multer.memoryStorage();
const allowedImageMimeTypes: ReadonlyArray<string> = FILE_UPLOAD.ALLOWED_TYPES;
const MAX_TEAM_MEMBER_IMAGE_SIZE = FILE_UPLOAD.TEAM_MEMBER_IMAGE_MAX_SIZE; // 10MB
const MAX_SIZE_MB = Math.round(MAX_TEAM_MEMBER_IMAGE_SIZE / 1024 / 1024);

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.fieldname !== "image") {
    cb(
      new AppError("Invalid field. Only 'image' is allowed for team member.", 400)
    );
    return;
  }
  if (allowedImageMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Invalid image file type. Allowed types are JPEG, PNG, GIF, and WEBP.",
        400
      )
    );
  }
};

export const teamMemberImageUpload = multer({
  storage,
  limits: {
    fileSize: MAX_TEAM_MEMBER_IMAGE_SIZE,
  },
  fileFilter,
});

export const handleTeamMemberImageUploadError = (
  multerMiddleware: ReturnType<typeof teamMemberImageUpload.single>,
  fieldName: string = "image"
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    multerMiddleware(req, res, (err: unknown) => {
      if (err) {
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
                  `Team member image size too large. Maximum allowed size is ${MAX_SIZE_MB}MB.`,
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
        if (err instanceof AppError) {
          return next(err);
        }
        return next(
          new AppError(
            `File upload failed: ${err instanceof Error ? err.message : "Unknown error"}`,
            400
          )
        );
      }
      next();
    });
  };
};
