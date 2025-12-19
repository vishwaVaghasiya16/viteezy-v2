import { Request, Response, NextFunction } from "express";
import { fileStorageService } from "@/services/fileStorageService";

export const handleProductImageUpload = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // Handle productImage (single file)
    if (files?.productImage && files.productImage.length > 0) {
      const imageUrl = await fileStorageService.uploadFile("products", files.productImage[0]);
      req.body.productImage = imageUrl;
    }

    // Handle galleryImages (multiple files)
    if (files?.galleryImages && files.galleryImages.length > 0) {
      const galleryUrls = await Promise.all(
        files.galleryImages.map((file) => fileStorageService.uploadFile("products", file))
      );
      // Merge with existing galleryImages if any (from form data)
      const existingGallery = Array.isArray(req.body.galleryImages) ? req.body.galleryImages : [];
      req.body.galleryImages = [...existingGallery, ...galleryUrls];
    }

    // Handle sachetImages (multiple files)
    if (files?.sachetImages && files.sachetImages.length > 0) {
      const sachetUrls = await Promise.all(
        files.sachetImages.map((file) => fileStorageService.uploadFile("products", file))
      );
      // Merge with existing sachetImages if any (from form data)
      const existingSachet = Array.isArray(req.body.sachetImages) ? req.body.sachetImages : [];
      req.body.sachetImages = [...existingSachet, ...sachetUrls];
    }

    // Handle standupPouchImages (multiple files)
    if (files?.standupPouchImages && files.standupPouchImages.length > 0) {
      const standupPouchUrls = await Promise.all(
        files.standupPouchImages.map((file) => fileStorageService.uploadFile("products", file))
      );
      // Merge with existing standupPouchImages if any (from form data)
      const existingStandupPouch = Array.isArray(req.body.standupPouchImages)
        ? req.body.standupPouchImages
        : [];
      req.body.standupPouchImages = [...existingStandupPouch, ...standupPouchUrls];
    }

    // Handle specification images
    if (files?.specificationBgImage && files.specificationBgImage.length > 0) {
      const bgImageUrl = await fileStorageService.uploadFile("products", files.specificationBgImage[0]);
      if (!req.body.specification) {
        req.body.specification = {};
      }
      req.body.specification.bg_image = bgImageUrl;
    }

    // Handle specification item images (1-4)
    for (let i = 1; i <= 4; i++) {
      const fieldName = `specificationItemImage${i}` as keyof typeof files;
      if (files?.[fieldName] && files[fieldName].length > 0) {
        const imageUrl = await fileStorageService.uploadFile("products", files[fieldName][0]);
        if (!req.body.specification) {
          req.body.specification = {};
        }
        if (!req.body.specification.items) {
          req.body.specification.items = [];
        }
        if (!req.body.specification.items[i - 1]) {
          req.body.specification.items[i - 1] = {};
        }
        req.body.specification.items[i - 1].image = imageUrl;
      }

      // Handle specification item mobile images (1-4)
      const mobileFieldName = `specificationItemImagemobile${i}` as keyof typeof files;
      if (files?.[mobileFieldName] && files[mobileFieldName].length > 0) {
        const mobileImageUrl = await fileStorageService.uploadFile("products", files[mobileFieldName][0]);
        if (!req.body.specification) {
          req.body.specification = {};
        }
        if (!req.body.specification.items) {
          req.body.specification.items = [];
        }
        if (!req.body.specification.items[i - 1]) {
          req.body.specification.items[i - 1] = {};
        }
        req.body.specification.items[i - 1].imageMobile = mobileImageUrl;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

