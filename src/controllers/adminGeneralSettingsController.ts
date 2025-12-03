import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { GeneralSettings } from "@/models/cms";
import { fileStorageService } from "@/services/fileStorageService";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
  };
}

class AdminGeneralSettingsController {
  /**
   * Get general settings
   * @route GET /api/v1/admin/general-settings
   * @access Admin
   */
  getGeneralSettings = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      let settings = await GeneralSettings.findOne({
        isDeleted: { $ne: true },
      }).lean();

      // If no settings exist, create default settings
      if (!settings) {
        const defaultSettings = await GeneralSettings.create({
          languages: [
            { code: "EN", name: "English", isEnabled: true },
            { code: "NL", name: "Dutch", isEnabled: true },
            { code: "DE", name: "German", isEnabled: false },
            { code: "FR", name: "French", isEnabled: false },
            { code: "ES", name: "Spanish", isEnabled: false },
          ],
          createdBy: req.user?._id as any,
          updatedBy: req.user?._id as any,
        });

        settings = defaultSettings.toObject() as any;
      }

      res.apiSuccess({ settings }, "General settings retrieved successfully");
    }
  );

  /**
   * Update general settings
   * @route PUT /api/v1/admin/general-settings
   * @access Admin
   */
  updateGeneralSettings = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const {
        tagline,
        supportEmail,
        supportPhone,
        address,
        socialMedia,
        languages,
      } = req.body;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Find existing settings or create new
      let settings = await GeneralSettings.findOne({
        isDeleted: { $ne: true },
      });

      const updateData: any = {
        updatedBy: req.user?._id,
      };

      // Update branding
      if (tagline !== undefined) updateData.tagline = tagline || null;

      // Handle logo uploads - delete old logos before uploading new ones
      if (files?.logoLight && files.logoLight.length > 0) {
        try {
          // Delete old light logo if it exists
          if (settings && settings.logoLight) {
            const oldLogoLightUrl = settings.logoLight;
            await fileStorageService
              .deleteFileByUrl(oldLogoLightUrl)
              .catch((error) => {
                // Log error but don't fail the upload
                logger.warn("Failed to delete old light logo:", {
                  url: oldLogoLightUrl,
                  error: error?.message,
                });
              });
          }

          // Upload new light logo
          const logoLightUrl = await fileStorageService.uploadFile(
            "general-settings/logos",
            files.logoLight[0]
          );
          updateData.logoLight = logoLightUrl;
        } catch (error: any) {
          throw new AppError(
            `Failed to upload light logo: ${error.message}`,
            500
          );
        }
      }

      if (files?.logoDark && files.logoDark.length > 0) {
        try {
          // Delete old dark logo if it exists
          if (settings && settings.logoDark) {
            const oldLogoDarkUrl = settings.logoDark;
            await fileStorageService
              .deleteFileByUrl(oldLogoDarkUrl)
              .catch((error) => {
                // Log error but don't fail the upload
                logger.warn("Failed to delete old dark logo:", {
                  url: oldLogoDarkUrl,
                  error: error?.message,
                });
              });
          }

          // Upload new dark logo
          const logoDarkUrl = await fileStorageService.uploadFile(
            "general-settings/logos",
            files.logoDark[0]
          );
          updateData.logoDark = logoDarkUrl;
        } catch (error: any) {
          throw new AppError(
            `Failed to upload dark logo: ${error.message}`,
            500
          );
        }
      }

      // Update contact information
      if (supportEmail !== undefined)
        updateData.supportEmail = supportEmail || null;
      if (supportPhone !== undefined)
        updateData.supportPhone = supportPhone || null;
      if (address !== undefined) updateData.address = address || null;

      // Update social media links
      if (socialMedia !== undefined) {
        updateData.socialMedia = {
          facebook: socialMedia.facebook || null,
          instagram: socialMedia.instagram || null,
          youtube: socialMedia.youtube || null,
          linkedin: socialMedia.linkedin || null,
          tiktok: socialMedia.tiktok || null,
        };
      }

      // Update language settings
      if (languages !== undefined && Array.isArray(languages)) {
        // Validate that all 5 languages are present
        const validCodes = ["EN", "NL", "DE", "FR", "ES"];
        const validNames = ["English", "Dutch", "German", "French", "Spanish"];

        // Map code to name for validation
        const expectedNameMap: { [key: string]: string } = {
          EN: "English",
          NL: "Dutch",
          DE: "German",
          FR: "French",
          ES: "Spanish",
        };

        if (languages.length !== 5) {
          throw new AppError("Exactly 5 languages must be provided", 400);
        }

        // Validate each language
        const languageMap = new Map<
          string,
          { name: string; isEnabled: boolean }
        >();
        languages.forEach((lang: any) => {
          if (!validCodes.includes(lang.code)) {
            throw new AppError(`Invalid language code: ${lang.code}`, 400);
          }
          if (!validNames.includes(lang.name)) {
            throw new AppError(`Invalid language name: ${lang.name}`, 400);
          }
          if (typeof lang.isEnabled !== "boolean") {
            throw new AppError(
              `isEnabled must be a boolean for language ${lang.code}`,
              400
            );
          }

          if (expectedNameMap[lang.code] !== lang.name) {
            throw new AppError(
              `Language code ${lang.code} does not match name ${lang.name}`,
              400
            );
          }

          languageMap.set(lang.code, {
            name: lang.name,
            isEnabled: lang.isEnabled,
          });
        });

        // Ensure all 5 languages are present
        if (languageMap.size !== 5) {
          throw new AppError(
            "All 5 languages (EN, NL, DE, FR, ES) must be provided",
            400
          );
        }

        // Convert map back to array in correct order
        updateData.languages = validCodes.map((code) => ({
          code,
          name: expectedNameMap[code],
          isEnabled: languageMap.get(code)?.isEnabled || false,
        }));
      }

      if (!settings) {
        // Create new settings
        settings = await GeneralSettings.create({
          ...updateData,
          createdBy: req.user?._id,
        });
      } else {
        // Update existing settings
        Object.assign(settings, updateData);
        await settings.save();
      }

      res.apiSuccess({ settings }, "General settings updated successfully");
    }
  );

  /**
   * Update language status (enable/disable)
   * @route PATCH /api/v1/admin/general-settings/languages/:code
   * @access Admin
   */
  updateLanguageStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { code } = req.params;
      const { isEnabled } = req.body;

      const validCodes = ["EN", "NL", "DE", "FR", "ES"];
      if (!validCodes.includes(code.toUpperCase())) {
        throw new AppError("Invalid language code", 400);
      }

      const languageCode = code.toUpperCase();

      let settings = await GeneralSettings.findOne({
        isDeleted: { $ne: true },
      });

      if (!settings) {
        // Create default settings if they don't exist
        settings = await GeneralSettings.create({
          languages: [
            { code: "EN", name: "English", isEnabled: true },
            { code: "NL", name: "Dutch", isEnabled: true },
            { code: "DE", name: "German", isEnabled: false },
            { code: "FR", name: "French", isEnabled: false },
            { code: "ES", name: "Spanish", isEnabled: false },
          ],
          createdBy: req.user?._id,
          updatedBy: req.user?._id,
        });
      }

      // Update the specific language status
      const languageIndex = settings.languages?.findIndex(
        (lang) => lang.code === languageCode
      );

      if (languageIndex === undefined || languageIndex === -1) {
        throw new AppError(
          `Language ${languageCode} not found in settings`,
          404
        );
      }

      if (settings.languages) {
        settings.languages[languageIndex].isEnabled = isEnabled;
        settings.updatedBy = req.user?._id as any;
        await settings.save();
      }

      res.apiSuccess(
        {
          language: settings.languages?.[languageIndex],
        },
        `Language ${languageCode} ${
          isEnabled ? "enabled" : "disabled"
        } successfully`
      );
    }
  );
}

export const adminGeneralSettingsController =
  new AdminGeneralSettingsController();
