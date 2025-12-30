import { Request, Response, NextFunction } from "express";
import { fileStorageService } from "@/services/fileStorageService";

export const handleLandingPageImageUpload = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // Handle heroSection_image_url (image file for hero section)
    if (files?.heroSection_image_url && files.heroSection_image_url.length > 0) {
      const imageUrl = await fileStorageService.uploadFile("landing-pages", files.heroSection_image_url[0]);
      if (!req.body.heroSection) {
        req.body.heroSection = {};
      }
      req.body.heroSection.imageUrl = imageUrl;
      // If media type is not set or is Image, set media.url to imageUrl
      if (!req.body.heroSection.media) {
        req.body.heroSection.media = {};
      }
      if (!req.body.heroSection.media.type || req.body.heroSection.media.type === "Image") {
        req.body.heroSection.media.url = imageUrl;
        req.body.heroSection.media.type = "Image";
      }
    }

    // Handle heroSection_video_url (video file for hero section)
    if (files?.heroSection_video_url && files.heroSection_video_url.length > 0) {
      const videoUrl = await fileStorageService.uploadFile("landing-pages", files.heroSection_video_url[0]);
      if (!req.body.heroSection) {
        req.body.heroSection = {};
      }
      req.body.heroSection.videoUrl = videoUrl;
      // If media type is Video, set media.url to videoUrl
      if (!req.body.heroSection.media) {
        req.body.heroSection.media = {};
      }
      if (req.body.heroSection.media.type === "Video") {
        req.body.heroSection.media.url = videoUrl;
      }
    }

    // Set media.url based on media.type if not already set
    if (req.body.heroSection && req.body.heroSection.media) {
      if (req.body.heroSection.media.type === "Image" && req.body.heroSection.imageUrl && !req.body.heroSection.media.url) {
        req.body.heroSection.media.url = req.body.heroSection.imageUrl;
      } else if (req.body.heroSection.media.type === "Video" && req.body.heroSection.videoUrl && !req.body.heroSection.media.url) {
        req.body.heroSection.media.url = req.body.heroSection.videoUrl;
      }
      // Default to Image if type not specified
      if (!req.body.heroSection.media.type && req.body.heroSection.imageUrl) {
        req.body.heroSection.media.type = "Image";
        req.body.heroSection.media.url = req.body.heroSection.imageUrl;
      }
    }

    // Handle heroBackgroundImage (optional background image for hero section)
    if (files?.heroBackgroundImage && files.heroBackgroundImage.length > 0) {
      const backgroundImageUrl = await fileStorageService.uploadFile("landing-pages", files.heroBackgroundImage[0]);
      if (!req.body.heroSection) {
        req.body.heroSection = {};
      }
      req.body.heroSection.backgroundImage = backgroundImageUrl;
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

    // Handle hero primary CTA images (multiple files for up to 3 CTAs)
    if (files?.heroPrimaryCTAImages && files.heroPrimaryCTAImages.length > 0) {
      const ctaImageUrls = await Promise.all(
        files.heroPrimaryCTAImages.map((file) =>
          fileStorageService.uploadFile("landing-pages", file)
        )
      );
      if (!req.body.heroSection) {
        req.body.heroSection = {};
      }
      if (!req.body.heroSection.primaryCTA) {
        req.body.heroSection.primaryCTA = [];
      }
      ctaImageUrls.forEach((url, index) => {
        if (!req.body.heroSection.primaryCTA[index]) {
          req.body.heroSection.primaryCTA[index] = {};
        }
        req.body.heroSection.primaryCTA[index].image = url;
      });
    }

    // Handle community background image (single file)
    if (files?.communityBackgroundImage && files.communityBackgroundImage.length > 0) {
      const imageUrl = await fileStorageService.uploadFile(
        "landing-pages",
        files.communityBackgroundImage[0]
      );
      if (!req.body.communitySection) {
        req.body.communitySection = {};
      }
      req.body.communitySection.backgroundImage = imageUrl;
    }

    next();
  } catch (error) {
    next(error);
  }
};

