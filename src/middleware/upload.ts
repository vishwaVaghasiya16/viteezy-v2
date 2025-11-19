import multer from "multer";
import { Request } from "express";
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

