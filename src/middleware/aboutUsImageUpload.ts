import { Request, Response, NextFunction } from "express";
import { fileStorageService } from "@/services/fileStorageService";

export const handleAboutUsImageUpload = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    // Handle banner_image (single file for banner section)
    if (files?.banner_image && files.banner_image.length > 0) {
      const imageUrl = await fileStorageService.uploadFile(
        "about-us",
        files.banner_image[0]
      );
      if (!req.body.banner) {
        req.body.banner = {};
      }
      if (!req.body.banner.banner_image) {
        req.body.banner.banner_image = {};
      }
      req.body.banner.banner_image.url = imageUrl;
      // Default to image type if not provided
      if (!req.body.banner.banner_image.type) {
        req.body.banner.banner_image.type = "Image";
      }
    }

    // Handle meet_brains_main_image (single file for meet brains section)
    if (
      files?.meet_brains_main_image &&
      files.meet_brains_main_image.length > 0
    ) {
      const imageUrl = await fileStorageService.uploadFile(
        "about-us",
        files.meet_brains_main_image[0]
      );
      if (!req.body.meetBrains) {
        req.body.meetBrains = {};
      }
      if (!req.body.meetBrains.meet_brains_main_image) {
        req.body.meetBrains.meet_brains_main_image = {};
      }
      req.body.meetBrains.meet_brains_main_image.url = imageUrl;
      // Default to image type if not provided
      if (!req.body.meetBrains.meet_brains_main_image.type) {
        req.body.meetBrains.meet_brains_main_image.type = "Image";
      }
    }


    // Handle people_images (multiple files for people section)
    if (files?.people_images && files.people_images.length > 0) {
      const uploadedImages = await Promise.all(
        files.people_images.map(async (file) => {
          const imageUrl = await fileStorageService.uploadFile(
            "about-us",
            file
          );
          return { url: imageUrl, type: "Image" };
        })
      );
      if (!req.body.people) {
        req.body.people = {};
      }
      req.body.people.images = uploadedImages;
    }

    next();
  } catch (error) {
    next(error);
  }
};
