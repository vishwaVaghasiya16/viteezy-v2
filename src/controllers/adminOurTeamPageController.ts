import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, markdownI18nToHtml } from "@/utils";
import { OurTeamPage } from "@/models/cms/ourTeamPage.model";
import { fileStorageService } from "@/services/fileStorageService";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

class AdminOurTeamPageController {
  private async uploadImage(
    file?: Express.Multer.File
  ): Promise<string | null> {
    if (!file) {
      return null;
    }

    try {
      return await fileStorageService.uploadFile("our-team-page", file);
    } catch (error: any) {
      logger.error("Failed to upload our team page image", {
        error: error.message,
        fileName: file.originalname,
      });
      return null;
    }
  }

  private async deleteImage(url?: string | null): Promise<void> {
    if (!url) {
      return;
    }

    try {
      await fileStorageService.deleteFileByUrl(url);
    } catch (error) {
      logger.warn("Failed to delete our team page image", { url, error });
    }
  }

  /**
   * Get Our Team Page settings (Admin view - returns all languages)
   */
  getOurTeamPage = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      let pageSettings = await OurTeamPage.findOne().lean();

      if (!pageSettings) {
        // Return empty structure if no settings exist
        res.apiSuccess(
          {
            banner: {
              banner_image: null,
              title: {},
              subtitle: {},
            },
          },
          "Our Team page settings retrieved successfully"
        );
        return;
      }

      const banner = pageSettings.banner || {};

      // Convert markdown to HTML for all languages
      const transformedSettings = {
        _id: pageSettings._id,
        banner: {
          banner_image: banner.banner_image || null,
          title: banner.title || {},
          subtitle: markdownI18nToHtml(
            (banner.subtitle as Record<string, string | null | undefined>) || {}
          ),
        },
        createdAt: pageSettings.createdAt,
        updatedAt: pageSettings.updatedAt,
      };

      res.apiSuccess(
        transformedSettings,
        "Our Team page settings retrieved successfully"
      );
    }
  );

  /**
   * Update Our Team Page settings (upsert)
   */
  updateOurTeamPage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const { banner } = req.body;

      // Get existing settings
      let pageSettings = await OurTeamPage.findOne();

      const updateData: any = {};

      if (banner) {
        updateData.banner = {};

        if (banner.title !== undefined) {
          updateData.banner.title = banner.title;
        }

        if (banner.subtitle !== undefined) {
          updateData.banner.subtitle = banner.subtitle;
        }

        // Handle banner image
        if (req.file) {
          const uploadedUrl = await this.uploadImage(req.file);
          if (uploadedUrl) {
            // Delete old image if exists
            if (pageSettings?.banner?.banner_image?.url) {
              await this.deleteImage(pageSettings.banner.banner_image.url);
            }
            updateData.banner.banner_image = {
              type: "Image",
              url: uploadedUrl,
              alt: banner.banner_image?.alt || {},
            };
          }
        } else if (banner.banner_image !== undefined) {
          // Update image metadata (alt text) without changing the URL
          if (pageSettings?.banner?.banner_image) {
            updateData.banner.banner_image = {
              ...pageSettings.banner.banner_image,
              alt: banner.banner_image?.alt || {},
            };
          } else if (banner.banner_image === null) {
            // Remove image
            if (pageSettings?.banner?.banner_image?.url) {
              await this.deleteImage(pageSettings.banner.banner_image.url);
            }
            updateData.banner.banner_image = null;
          }
        }
      }

      if (requesterId) {
        updateData.updatedBy = requesterId;
      }

      if (!pageSettings) {
        // Create new settings
        if (requesterId) {
          updateData.createdBy = requesterId;
        }
        pageSettings = await OurTeamPage.create(updateData);
      } else {
        // Update existing settings
        pageSettings = await OurTeamPage.findByIdAndUpdate(
          pageSettings._id,
          { $set: updateData },
          { new: true, runValidators: true }
        );
      }

      const result: any = pageSettings?.toObject() || {};
      const bannerData = result.banner || {};

      const transformedSettings = {
        _id: result._id,
        banner: {
          banner_image: bannerData.banner_image || null,
          title: bannerData.title || {},
          subtitle: markdownI18nToHtml(
            (bannerData.subtitle as Record<
              string,
              string | null | undefined
            >) || {}
          ),
        },
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };

      res.apiSuccess(
        transformedSettings,
        "Our Team page settings updated successfully"
      );
    }
  );
}

export const adminOurTeamPageController = new AdminOurTeamPageController();
