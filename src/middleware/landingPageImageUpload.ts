import { Request, Response, NextFunction } from "express";
import { fileStorageService } from "@/services/fileStorageService";

export const handleLandingPageImageUpload = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // Handle heroSection_media_url (single file for hero section media)
    if (files?.heroSection_media_url && files.heroSection_media_url.length > 0) {
      const imageUrl = await fileStorageService.uploadFile("landing-pages", files.heroSection_media_url[0]);
      if (!req.body.heroSection) {
        req.body.heroSection = {};
      }
      if (!req.body.heroSection.media) {
        req.body.heroSection.media = {};
      }
      req.body.heroSection.media.url = imageUrl;
      // Default to image type if not provided
      if (!req.body.heroSection.media.type) {
        req.body.heroSection.media.type = "image";
      }
    }
    
    // Also support legacy heroSectionMedia field name for backward compatibility
    if (files?.heroSectionMedia && files.heroSectionMedia.length > 0) {
      const imageUrl = await fileStorageService.uploadFile("landing-pages", files.heroSectionMedia[0]);
      if (!req.body.heroSection) {
        req.body.heroSection = {};
      }
      if (!req.body.heroSection.media) {
        req.body.heroSection.media = {};
      }
      req.body.heroSection.media.url = imageUrl;
      // Default to image type if not provided
      if (!req.body.heroSection.media.type) {
        req.body.heroSection.media.type = "image";
      }
    }

    // Handle membershipBackgroundImage (single file)
    if (files?.membershipBackgroundImage && files.membershipBackgroundImage.length > 0) {
      const imageUrl = await fileStorageService.uploadFile("landing-pages", files.membershipBackgroundImage[0]);
      if (!req.body.membershipSection) {
        req.body.membershipSection = {};
      }
      req.body.membershipSection.backgroundImage = imageUrl;
    }

    // Handle missionBackgroundImage (single file)
    if (files?.missionBackgroundImage && files.missionBackgroundImage.length > 0) {
      const imageUrl = await fileStorageService.uploadFile("landing-pages", files.missionBackgroundImage[0]);
      if (!req.body.missionSection) {
        req.body.missionSection = {};
      }
      req.body.missionSection.backgroundImage = imageUrl;
    }

    // Handle howItWorksStepImages (multiple files for steps)
    if (files?.howItWorksStepImages && files.howItWorksStepImages.length > 0) {
      const stepImageUrls = await Promise.all(
        files.howItWorksStepImages.map((file) => fileStorageService.uploadFile("landing-pages", file))
      );
      if (!req.body.howItWorksSection) {
        req.body.howItWorksSection = {};
      }
      if (!req.body.howItWorksSection.steps) {
        req.body.howItWorksSection.steps = [];
      }
      // Assign images to steps by index
      stepImageUrls.forEach((url, index) => {
        if (!req.body.howItWorksSection.steps[index]) {
          req.body.howItWorksSection.steps[index] = {};
        }
        req.body.howItWorksSection.steps[index].image = url;
      });
    }

    // Handle designedByScienceStepImages (multiple files for steps)
    if (files?.designedByScienceStepImages && files.designedByScienceStepImages.length > 0) {
      const stepImageUrls = await Promise.all(
        files.designedByScienceStepImages.map((file) => fileStorageService.uploadFile("landing-pages", file))
      );
      if (!req.body.designedByScienceSection) {
        req.body.designedByScienceSection = {};
      }
      if (!req.body.designedByScienceSection.steps) {
        req.body.designedByScienceSection.steps = [];
      }
      // Assign images to steps by index
      stepImageUrls.forEach((url, index) => {
        if (!req.body.designedByScienceSection.steps[index]) {
          req.body.designedByScienceSection.steps[index] = {};
        }
        req.body.designedByScienceSection.steps[index].image = url;
      });
    }

    // Handle featureIcons (multiple files for features)
    if (files?.featureIcons && files.featureIcons.length > 0) {
      const featureIconUrls = await Promise.all(
        files.featureIcons.map((file) => fileStorageService.uploadFile("landing-pages", file))
      );
      if (!req.body.featuresSection) {
        req.body.featuresSection = {};
      }
      if (!req.body.featuresSection.features) {
        req.body.featuresSection.features = [];
      }
      // Assign icons to features by index
      featureIconUrls.forEach((url, index) => {
        if (!req.body.featuresSection.features[index]) {
          req.body.featuresSection.features[index] = {};
        }
        req.body.featuresSection.features[index].icon = url;
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

