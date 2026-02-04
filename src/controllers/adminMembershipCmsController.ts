/**
 * @fileoverview Admin Membership CMS Controller
 * @description Controller for admin Membership CMS operations (CRUD)
 * @module controllers/adminMembershipCmsController
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { MembershipCms } from "@/models/cms";
import { fileStorageService } from "@/services/fileStorageService";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
  };
}

class AdminMembershipCmsController {
  /**
   * Get Membership CMS content
   * Since there's only one Membership CMS record, this returns the single record
   */
  getMembershipCms = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const membershipCms = await MembershipCms.findOne({
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .lean();

      if (!membershipCms) {
        // Return empty structure if not found
        const emptyMembershipCms = {
          coverImage: null,
          heading: {},
          description: {},
          membershipBenefits: [],
          ctaButtonText: {},
          note: {},
          isActive: true,
        };
        res.apiSuccess(
          { membershipCms: emptyMembershipCms },
          "Membership CMS content retrieved successfully"
        );
        return;
      }

      res.apiSuccess(
        { membershipCms },
        "Membership CMS content retrieved successfully"
      );
    }
  );

  /**
   * Create or Update Membership CMS content
   * Since there's only one Membership CMS record, this acts as upsert
   */
  upsertMembershipCms = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const {
        coverImage,
        heading,
        description,
        membershipBenefits,
        ctaButtonText,
        note,
        isActive,
      } = req.body;

      const files = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };

      // Find existing Membership CMS
      let membershipCms = await MembershipCms.findOne({
        isDeleted: false,
      });

      if (membershipCms) {
        // Update existing
        // Handle cover image upload
        if (files?.coverImage && files.coverImage.length > 0) {
          try {
            // Delete old cover image if it exists
            const oldCoverImageUrl = membershipCms.coverImage;
            if (oldCoverImageUrl) {
              await fileStorageService
                .deleteFileByUrl(oldCoverImageUrl)
                .catch((error) => {
                  logger.warn("Failed to delete old cover image:", {
                    url: oldCoverImageUrl,
                    error: error?.message,
                  });
                });
            }

            // Upload new cover image
            const coverImageUrl = await fileStorageService.uploadFile(
              "membership-cms/cover",
              files.coverImage[0]
            );
            membershipCms.coverImage = coverImageUrl;
          } catch (error: any) {
            throw new AppError(
              `Failed to upload cover image: ${error.message}`,
              500
            );
          }
        } else if (coverImage !== undefined) {
          // If coverImage is explicitly set to null/empty string, delete old image
          if (!coverImage || coverImage === "") {
            const oldCoverImageUrl = membershipCms.coverImage;
            if (oldCoverImageUrl) {
              await fileStorageService
                .deleteFileByUrl(oldCoverImageUrl)
                .catch((error) => {
                  logger.warn("Failed to delete old cover image:", {
                    url: oldCoverImageUrl,
                    error: error?.message,
                  });
                });
            }
            membershipCms.coverImage = null;
          } else {
            membershipCms.coverImage = coverImage;
          }
        }

        // Handle membership benefits
        if (membershipBenefits !== undefined) {
          logger.info("Processing membershipBenefits in controller", {
            count: membershipBenefits.length,
            firstBenefit: membershipBenefits[0],
          });
          
          const processedBenefits = [];
          for (let i = 0; i < membershipBenefits.length; i++) {
            const benefit = membershipBenefits[i];
            logger.debug(`Processing benefit ${i}`, {
              benefit,
              title: benefit.title,
              titleType: typeof benefit.title,
              titleKeys: benefit.title ? Object.keys(benefit.title) : [],
            });
            
            let benefitImageUrl = benefit.image || null;

            // Check if there's a file upload for this benefit
            const benefitImageField = `benefitImage_${i}`;
            if (
              files?.[benefitImageField] &&
              files[benefitImageField].length > 0
            ) {
              try {
                // Delete old benefit image if it exists
                const existingBenefit =
                  membershipCms.membershipBenefits?.[i];
                if (existingBenefit?.image) {
                  await fileStorageService
                    .deleteFileByUrl(existingBenefit.image)
                    .catch((error) => {
                      logger.warn("Failed to delete old benefit image:", {
                        url: existingBenefit.image,
                        error: error?.message,
                      });
                    });
                }

                // Upload new benefit image
                benefitImageUrl = await fileStorageService.uploadFile(
                  "membership-cms/benefits",
                  files[benefitImageField][0]
                );
              } catch (error: any) {
                throw new AppError(
                  `Failed to upload benefit image ${i + 1}: ${error.message}`,
                  500
                );
              }
            } else if (benefit.image === "" || benefit.image === null) {
              // Delete old benefit image if explicitly set to empty
              const existingBenefit = membershipCms.membershipBenefits?.[i];
              if (existingBenefit?.image) {
                await fileStorageService
                  .deleteFileByUrl(existingBenefit.image)
                  .catch((error) => {
                    logger.warn("Failed to delete old benefit image:", {
                      url: existingBenefit.image,
                      error: error?.message,
                    });
                  });
              }
              benefitImageUrl = null;
            }

            // Translation middleware has already converted strings to I18n objects with all languages
            // Use the translated data directly (same pattern as blog controller)
            processedBenefits.push({
              title: benefit.title || {},
              subtitle: benefit.subtitle || {},
              image: benefitImageUrl,
            });
          }

          // Validate benefits limit
          if (processedBenefits.length > 3) {
            throw new AppError(
              "Membership benefits cannot exceed 3 items",
              400
            );
          }

          membershipCms.membershipBenefits = processedBenefits;
        }

        // Translation middleware has already converted strings to I18n objects with all languages
        // Use the translated data directly (same pattern as blog controller)
        if (heading !== undefined) {
          membershipCms.heading = heading || {};
        }
        if (description !== undefined) {
          membershipCms.description = description || {};
        }
        if (ctaButtonText !== undefined) {
          membershipCms.ctaButtonText = ctaButtonText || {};
        }
        if (note !== undefined) {
          membershipCms.note = note || {};
        }
        if (isActive !== undefined) membershipCms.isActive = isActive;

        if (requesterId) membershipCms.updatedBy = requesterId;

        await membershipCms.save();
        res.apiSuccess(
          { membershipCms },
          "Membership CMS updated successfully"
        );
      } else {
        // Create new
        // Handle cover image upload
        let coverImageUrl: string | null = coverImage || null;
        if (files?.coverImage && files.coverImage.length > 0) {
          try {
            coverImageUrl = await fileStorageService.uploadFile(
              "membership-cms/cover",
              files.coverImage[0]
            );
          } catch (error: any) {
            throw new AppError(
              `Failed to upload cover image: ${error.message}`,
              500
            );
          }
        }

        // Handle membership benefits images
        const processedBenefits = [];
        if (membershipBenefits && Array.isArray(membershipBenefits)) {
          for (let i = 0; i < membershipBenefits.length; i++) {
            const benefit = membershipBenefits[i];
            let benefitImageUrl = benefit.image || null;

            // Check if there's a file upload for this benefit
            const benefitImageField = `benefitImage_${i}`;
            if (
              files?.[benefitImageField] &&
              files[benefitImageField].length > 0
            ) {
              try {
                benefitImageUrl = await fileStorageService.uploadFile(
                  "membership-cms/benefits",
                  files[benefitImageField][0]
                );
              } catch (error: any) {
                throw new AppError(
                  `Failed to upload benefit image ${i + 1}: ${error.message}`,
                  500
                );
              }
            }

            // Translation middleware has already converted strings to I18n objects with all languages
            // Use the translated data directly (same pattern as blog controller)
            processedBenefits.push({
              title: benefit.title || {},
              subtitle: benefit.subtitle || {},
              image: benefitImageUrl,
            });
          }
        }

        // Validate benefits limit
        if (processedBenefits.length > 3) {
          throw new AppError(
            "Membership benefits cannot exceed 3 items",
            400
          );
        }

        // Translation middleware has already converted strings to I18n objects with all languages
        // Use the translated data directly (same pattern as blog controller)
        membershipCms = await MembershipCms.create({
          coverImage: coverImageUrl,
          heading: heading || {},
          description: description || {},
          membershipBenefits: processedBenefits,
          ctaButtonText: ctaButtonText || {},
          note: note || {},
          isActive: isActive !== undefined ? isActive : true,
          createdBy: requesterId,
        });

        res.apiCreated(
          { membershipCms },
          "Membership CMS created successfully"
        );
      }
    }
  );

  /**
   * Delete Membership CMS entry (soft delete)
   * Since there's only one record, this deletes the single record
   */
  deleteMembershipCms = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const membershipCms = await MembershipCms.findOne({
        isDeleted: false,
      });

      if (!membershipCms) {
        throw new AppError("Membership CMS not found", 404);
      }

      // Delete cover image from cloud storage
      if (membershipCms.coverImage) {
        await fileStorageService
          .deleteFileByUrl(membershipCms.coverImage)
          .catch((error) => {
            logger.warn("Failed to delete cover image:", {
              url: membershipCms.coverImage,
              error: error?.message,
            });
          });
      }

      // Delete benefit images from cloud storage
      if (membershipCms.membershipBenefits) {
        for (const benefit of membershipCms.membershipBenefits) {
          if (benefit.image) {
            await fileStorageService
              .deleteFileByUrl(benefit.image)
              .catch((error) => {
                logger.warn("Failed to delete benefit image:", {
                  url: benefit.image,
                  error: error?.message,
                });
              });
          }
        }
      }

      membershipCms.isDeleted = true;
      membershipCms.deletedAt = new Date();
      await membershipCms.save();

      res.apiSuccess(null, "Membership CMS deleted successfully");
    }
  );
}

export const adminMembershipCmsController =
  new AdminMembershipCmsController();

