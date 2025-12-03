import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { config } from "@/config";
import { FILE_UPLOAD } from "@/constants";
import { AppError } from "@/utils/AppError";

const storage = multer.memoryStorage();

// Allowed video MIME types
const allowedVideoMimeTypes = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime", // .mov
  "video/x-msvideo", // .avi
  "video/webm",
  "video/ogg",
];

// Allowed image MIME types for thumbnails
const allowedImageMimeTypes: ReadonlyArray<string> = FILE_UPLOAD.ALLOWED_TYPES;

// Maximum file size for videos (50MB)
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

const videoFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (allowedVideoMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Invalid video file type. Allowed types are MP4, MPEG, MOV, AVI, WEBM, and OGG.",
        400
      )
    );
  }
};

const imageFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
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

export const videoUpload = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE,
  },
  fileFilter: videoFileFilter,
});

// Separate multer instance for images (thumbnails)
export const imageUpload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: imageFileFilter,
});

// Combined multer for both video and thumbnail
export const videoAndThumbnailUpload = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Use video size limit as max
  },
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    // Check if it's a video file
    if (allowedVideoMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    // Check if it's an image file
    if (allowedImageMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    // Neither video nor image
    cb(
      new AppError(
        "Invalid file type. Allowed types are: Videos (MP4, MPEG, MOV, AVI, WEBM, OGG) or Images (JPEG, PNG, GIF, WEBP).",
        400
      )
    );
  },
});

/**
 * Middleware to handle Multer errors for video uploads
 */
export const handleVideoUploadError = (
  multerMiddleware: any,
  fieldName: string = "video"
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    multerMiddleware(req, res, (err: any) => {
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
                  `Video file size too large. Maximum allowed size is 50MB.`,
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
            default:
              return next(
                new AppError(
                  `Video upload error: ${err.message || "Unknown error"}`,
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
            `Video upload failed: ${err.message || "Unknown error"}`,
            400
          )
        );
      }

      next();
    });
  };
};

/**
 * Middleware to handle Multer errors for video and thumbnail uploads
 */
export const handleVideoAndThumbnailUploadError = (multerMiddleware: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    multerMiddleware(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case "LIMIT_UNEXPECTED_FILE":
              return next(
                new AppError(
                  "Invalid field name. Use 'video' for video file and 'thumbnail' for thumbnail image.",
                  400
                )
              );
            case "LIMIT_FILE_SIZE":
              return next(
                new AppError(
                  `File size too large. Maximum allowed size is 50MB for videos and ${Math.round(
                    config.upload.maxFileSize / 1024 / 1024
                  )}MB for images.`,
                  400
                )
              );
            case "LIMIT_FILE_COUNT":
              return next(
                new AppError(
                  "Too many files. Only one video and one thumbnail are allowed.",
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
            `File upload failed: ${err.message || "Unknown error"}`,
            400
          )
        );
      }

      next();
    });
  };
};
