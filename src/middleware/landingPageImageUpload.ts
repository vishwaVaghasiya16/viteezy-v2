import { Request, Response, NextFunction } from "express";
import { fileStorageService } from "@/services/fileStorageService";

/** Collect indexed file fields (e.g. heroPrimaryCTAImages_0, heroPrimaryCTAImages_1) into sorted array by index */
function collectIndexedFiles(
  files: { [fieldname: string]: Express.Multer.File[] } | undefined,
  baseName: string,
  maxIndex: number
): { index: number; file: Express.Multer.File }[] {
  const result: { index: number; file: Express.Multer.File }[] = [];
  if (!files) return result;
  for (let i = 0; i <= maxIndex; i++) {
    const fieldName = `${baseName}_${i}`;
    const fileArray = files[fieldName];
    if (fileArray && fileArray.length > 0) {
      result.push({ index: i, file: fileArray[0] });
    }
  }
  result.sort((a, b) => a.index - b.index);
  return result;
}

export const handleLandingPageImageUpload = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    console.log("[LandingPageImageUpload] Files received:", files ? Object.keys(files) : "none");
    console.log("[LandingPageImageUpload] heroSection before processing:", req.body.heroSection);

    // Handle heroSection_image_url (image file for hero section)
    if (files?.heroSection_image_url && files.heroSection_image_url.length > 0) {
      const imageUrl = await fileStorageService.uploadFile("landing-pages", files.heroSection_image_url[0]);
      if (!req.body.heroSection) {
        req.body.heroSection = {};
      }
      req.body.heroSection.imageUrl = imageUrl;
      // Automatically create media object with Image type
      if (!req.body.heroSection.media) {
        req.body.heroSection.media = {};
      }
      req.body.heroSection.media.url = imageUrl;
      req.body.heroSection.media.type = "Image";
      req.body.heroSection.media.sortOrder = req.body.heroSection.media.sortOrder || 0;
      console.log("[LandingPageImageUpload] Image uploaded, set imageUrl and media:", {
        imageUrl,
        media: req.body.heroSection.media
      });
    }

    // Handle heroSection_video_url (video file for hero section)
    if (files?.heroSection_video_url && files.heroSection_video_url.length > 0) {
      const videoUrl = await fileStorageService.uploadFile("landing-pages", files.heroSection_video_url[0]);
      if (!req.body.heroSection) {
        req.body.heroSection = {};
      }
      req.body.heroSection.videoUrl = videoUrl;
      // Automatically create media object with Video type
      if (!req.body.heroSection.media) {
        req.body.heroSection.media = {};
      }
      req.body.heroSection.media.url = videoUrl;
      req.body.heroSection.media.type = "Video";
      req.body.heroSection.media.sortOrder = req.body.heroSection.media.sortOrder || 0;
      console.log("[LandingPageImageUpload] Video uploaded, set videoUrl and media:", {
        videoUrl,
        media: req.body.heroSection.media
      });
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

    // Handle howItWorksStepImages (indexed: howItWorksStepImages_0, howItWorksStepImages_1, ...)
    const howItWorksStepFiles = collectIndexedFiles(files, "howItWorksStepImages", 9);
    if (howItWorksStepFiles.length > 0) {
      const stepImageUrls = await Promise.all(
        howItWorksStepFiles.map(({ file }) => fileStorageService.uploadFile("landing-pages", file))
      );
      if (!req.body.howItWorksSection) {
        req.body.howItWorksSection = {};
      }
      if (!req.body.howItWorksSection.steps) {
        req.body.howItWorksSection.steps = [];
      }
      howItWorksStepFiles.forEach(({ index }, urlIndex) => {
        if (!req.body.howItWorksSection.steps[index]) {
          req.body.howItWorksSection.steps[index] = {};
        }
        req.body.howItWorksSection.steps[index].image = stepImageUrls[urlIndex];
      });
    }

    // Handle designedByScienceStepImages: non-indexed (designedByScienceStepImages as array) or indexed (designedByScienceStepImages_0..9)
    const designedByScienceArray = files?.designedByScienceStepImages && Array.isArray(files.designedByScienceStepImages) ? files.designedByScienceStepImages : [];
    const designedByScienceStepFiles = designedByScienceArray.length > 0
      ? designedByScienceArray.map((file, index) => ({ index, file }))
      : collectIndexedFiles(files, "designedByScienceStepImages", 9);
    if (designedByScienceStepFiles.length > 0) {
      const stepImageUrls = await Promise.all(
        designedByScienceStepFiles.map(({ file }) => fileStorageService.uploadFile("landing-pages", file))
      );
      if (!req.body.designedByScienceSection) {
        req.body.designedByScienceSection = {};
      }
      if (!req.body.designedByScienceSection.steps) {
        req.body.designedByScienceSection.steps = [];
      }
      designedByScienceStepFiles.forEach(({ index }, urlIndex) => {
        if (!req.body.designedByScienceSection.steps[index]) {
          req.body.designedByScienceSection.steps[index] = {};
        }
        req.body.designedByScienceSection.steps[index].image = stepImageUrls[urlIndex];
      });
    }

    // Handle featureIcons (indexed: featureIcons_0, featureIcons_1, etc.)
    // First, collect all indexed featureIcons
    const indexedFeatureIcons: { index: number; file: Express.Multer.File }[] = [];
    if (files) {
      Object.keys(files).forEach((fieldName) => {
        if (fieldName.startsWith("featureIcons_")) {
          const indexMatch = fieldName.match(/featureIcons_(\d+)/);
          if (indexMatch) {
            const index = parseInt(indexMatch[1], 10);
            const fileArray = files[fieldName];
            if (fileArray && fileArray.length > 0) {
              indexedFeatureIcons.push({ index, file: fileArray[0] });
            }
          }
        }
      });
    }

    // Handle indexed featureIcons (featureIcons_0, featureIcons_1, etc.)
    if (indexedFeatureIcons.length > 0) {
      // Sort by index to maintain order
      indexedFeatureIcons.sort((a, b) => a.index - b.index);
      
      const featureIconUrls = await Promise.all(
        indexedFeatureIcons.map(({ file }) => fileStorageService.uploadFile("landing-pages", file))
      );
      
      if (!req.body.featuresSection) {
        req.body.featuresSection = {};
      }
      if (!req.body.featuresSection.features) {
        req.body.featuresSection.features = [];
      }
      
      // Assign icons to features by their index from field name
      indexedFeatureIcons.forEach(({ index }, urlIndex) => {
        if (!req.body.featuresSection.features[index]) {
          req.body.featuresSection.features[index] = {};
        }
        req.body.featuresSection.features[index].icon = featureIconUrls[urlIndex];
      });
    }

    // Handle backward compatibility: non-indexed featureIcons (old format)
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
      // Assign icons to features by sequential index (old behavior)
      featureIconUrls.forEach((url, index) => {
        if (!req.body.featuresSection.features[index]) {
          req.body.featuresSection.features[index] = {};
        }
        req.body.featuresSection.features[index].icon = url;
      });
    }

    // Handle hero primary CTA images: non-indexed (heroPrimaryCTAImages as array) or indexed (heroPrimaryCTAImages_0, _1, _2)
    const heroCtaArray = files?.heroPrimaryCTAImages && Array.isArray(files.heroPrimaryCTAImages) ? files.heroPrimaryCTAImages : [];
    const heroCtaFilesFromArray = heroCtaArray.length > 0
      ? heroCtaArray.map((file, index) => ({ index, file }))
      : collectIndexedFiles(files, "heroPrimaryCTAImages", 2);
    if (heroCtaFilesFromArray.length > 0) {
      const ctaImageUrls = await Promise.all(
        heroCtaFilesFromArray.map(({ file }) =>
          fileStorageService.uploadFile("landing-pages", file)
        )
      );
      if (!req.body.heroSection) {
        req.body.heroSection = {};
      }
      if (!req.body.heroSection.primaryCTA) {
        req.body.heroSection.primaryCTA = [];
      }
      heroCtaFilesFromArray.forEach(({ index }, urlIndex) => {
        if (!req.body.heroSection.primaryCTA[index]) {
          req.body.heroSection.primaryCTA[index] = {};
        }
        req.body.heroSection.primaryCTA[index].image = ctaImageUrls[urlIndex];
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

    // Handle membershipSection benefits icons (indexed: membershipSection_benefits_0_icon, etc.)
    const indexedMembershipBenefitIcons: { index: number; file: Express.Multer.File }[] = [];
    if (files) {
      Object.keys(files).forEach((fieldName) => {
        if (fieldName.startsWith("membershipSection_benefits_") && fieldName.endsWith("_icon")) {
          const indexMatch = fieldName.match(/membershipSection_benefits_(\d+)_icon/);
          if (indexMatch) {
            const index = parseInt(indexMatch[1], 10);
            const fileArray = files[fieldName];
            if (fileArray && fileArray.length > 0) {
              indexedMembershipBenefitIcons.push({ index, file: fileArray[0] });
            }
          }
        }
      });
    }

    // Handle indexed membershipSection benefits icons
    if (indexedMembershipBenefitIcons.length > 0) {
      // Sort by index to maintain order
      indexedMembershipBenefitIcons.sort((a, b) => a.index - b.index);
      
      const benefitIconUrls = await Promise.all(
        indexedMembershipBenefitIcons.map(({ file }) => fileStorageService.uploadFile("landing-pages", file))
      );
      
      if (!req.body.membershipSection) {
        req.body.membershipSection = {};
      }
      if (!req.body.membershipSection.benefits) {
        req.body.membershipSection.benefits = [];
      }
      
      // Assign icons to benefits by their index from field name
      indexedMembershipBenefitIcons.forEach(({ index }, urlIndex) => {
        if (!req.body.membershipSection.benefits[index]) {
          req.body.membershipSection.benefits[index] = {};
        }
        req.body.membershipSection.benefits[index].icon = benefitIconUrls[urlIndex];
      });
    }

    console.log("[LandingPageImageUpload] heroSection after processing:", req.body.heroSection);

    next();
  } catch (error) {
    next(error);
  }
};

