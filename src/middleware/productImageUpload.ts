import { Request, Response, NextFunction } from "express";
import { fileStorageService } from "@/services/fileStorageService";

export const handleProductImageUpload = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (req.file) {
      const imageUrl = await fileStorageService.uploadFile("products", req.file);
      req.body.productImage = imageUrl;
    }
    next();
  } catch (error) {
    next(error);
  }
};

