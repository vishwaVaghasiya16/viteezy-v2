import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { getPaginationMeta } from "@/utils/pagination";
import { HeaderBanner } from "@/models/cms/headerBanner.model";
import { DeviceType } from "@/models/enums";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    role?: string;
    email?: string;
  };
}

class AdminHeaderBannerController {
  /**
   * Create header banner (Admin only)
   * @route POST /api/v1/admin/header-banners
   * @access Private (Admin)
   * @body {String} text - Banner text in English only (simple string)
   * @body {String} deviceType - Device type (WEB or MOBILE)
   * @body {Boolean} [isActive] - Active status (default: false)
   */
  createHeaderBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { text, deviceType, isActive } = req.body;

      // Validate text is a simple string (English only)
      if (typeof text !== "string" || text.trim().length === 0) {
        throw new AppError("Banner text must be a non-empty English string", 400);
      }

      // Convert simple English string to I18n object format
      const i18nText = {
        en: text.trim(),
      };

      // If setting as active, deactivate all other banners for this device type
      if (isActive === true) {
        await HeaderBanner.updateMany(
          {
            deviceType: deviceType as DeviceType,
            isActive: true,
            isDeleted: { $ne: true },
          },
          {
            $set: { isActive: false },
          }
        );
      }

      // Create header banner with I18n text object (English only)
      const headerBanner = await HeaderBanner.create({
        text: i18nText,
        deviceType: deviceType as DeviceType,
        isActive: isActive === true,
        createdBy: req.user?._id
          ? new mongoose.Types.ObjectId(req.user._id)
          : undefined,
        updatedBy: req.user?._id
          ? new mongoose.Types.ObjectId(req.user._id)
          : undefined,
      });

      logger.info(
        `Header banner created: ${headerBanner._id} by admin ${req.user?._id}`
      );

      res.status(201).json({
        success: true,
        message: "Header banner created successfully",
        data: { headerBanner },
      });
    }
  );

  /**
   * Get all header banners (Admin only)
   * @route GET /api/v1/admin/header-banners
   * @access Private (Admin)
   */
  getAllHeaderBanners = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        page = "1",
        limit = "10",
        search,
        deviceType,
        isActive,
      } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        deviceType?: string;
        isActive?: string;
      };

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {
        isDeleted: { $ne: true }, // Exclude soft-deleted records
      };

      // Filter by device type
      if (deviceType) {
        query.deviceType = deviceType;
      }

      // Filter by active status
      if (isActive !== undefined) {
        query.isActive = isActive === "true";
      }

      // Search functionality - by text in any language
      if (search) {
        query.$or = [
          { "text.en": { $regex: search, $options: "i" } },
          { "text.nl": { $regex: search, $options: "i" } },
          { "text.de": { $regex: search, $options: "i" } },
          { "text.fr": { $regex: search, $options: "i" } },
          { "text.es": { $regex: search, $options: "i" } },
        ];
      }

      const [banners, total] = await Promise.all([
        HeaderBanner.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        HeaderBanner.countDocuments(query),
      ]);

      const paginationMeta = getPaginationMeta(pageNum, limitNum, total);

      res.status(200).json({
        success: true,
        message: "Header banners retrieved successfully",
        data: banners,
        pagination: paginationMeta,
      });
    }
  );

  /**
   * Get header banner by ID (Admin only)
   * @route GET /api/v1/admin/header-banners/:id
   * @access Private (Admin)
   */
  getHeaderBannerById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid header banner ID", 400);
      }

      const headerBanner = await HeaderBanner.findOne({
        _id: id,
        isDeleted: { $ne: true },
      }).lean();

      if (!headerBanner) {
        throw new AppError("Header banner not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Header banner retrieved successfully",
        data: { headerBanner },
      });
    }
  );

  /**
   * Update header banner (Admin only)
   * @route PUT /api/v1/admin/header-banners/:id
   * @access Private (Admin)
   */
  updateHeaderBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { text, deviceType, isActive } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid header banner ID", 400);
      }

      const headerBanner = await HeaderBanner.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!headerBanner) {
        throw new AppError("Header banner not found", 404);
      }

      // If device type is being changed, check if new device type already has an active banner
      if (deviceType && deviceType !== headerBanner.deviceType) {
        // If setting as active, deactivate all other banners for the new device type
        if (isActive === true) {
          await HeaderBanner.updateMany(
            {
              deviceType: deviceType as DeviceType,
              isActive: true,
              isDeleted: { $ne: true },
              _id: { $ne: new mongoose.Types.ObjectId(id) },
            },
            {
              $set: { isActive: false },
            }
          );
        }
        headerBanner.deviceType = deviceType as DeviceType;
      }

      // If setting as active, deactivate all other banners for this device type
      if (isActive === true && headerBanner.isActive !== true) {
        await HeaderBanner.updateMany(
          {
            deviceType: headerBanner.deviceType,
            isActive: true,
            isDeleted: { $ne: true },
            _id: { $ne: new mongoose.Types.ObjectId(id) },
          },
          {
            $set: { isActive: false },
          }
        );
      }

      // Update fields
      if (text !== undefined) {
        headerBanner.text = text || {};
      }
      if (isActive !== undefined) {
        headerBanner.isActive = isActive === true;
      }

      headerBanner.updatedBy = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      await headerBanner.save();

      logger.info(
        `Header banner updated: ${headerBanner._id} by admin ${req.user?._id}`
      );

      res.status(200).json({
        success: true,
        message: "Header banner updated successfully",
        data: { headerBanner },
      });
    }
  );

  /**
   * Delete header banner (Admin only) - Soft delete
   * @route DELETE /api/v1/admin/header-banners/:id
   * @access Private (Admin)
   */
  deleteHeaderBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid header banner ID", 400);
      }

      const headerBanner = await HeaderBanner.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!headerBanner) {
        throw new AppError("Header banner not found", 404);
      }

      // Perform soft delete
      headerBanner.isDeleted = true;
      headerBanner.deletedAt = new Date();
      await headerBanner.save();

      logger.info(
        `Header banner soft deleted: ${id} by admin ${req.user?._id}`
      );

      res.status(200).json({
        success: true,
        message: "Header banner deleted successfully",
      });
    }
  );

  /**
   * Toggle header banner active status (Admin only)
   * @route PATCH /api/v1/admin/header-banners/:id/toggle-status
   * @access Private (Admin)
   */
  toggleHeaderBannerStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid header banner ID", 400);
      }

      const headerBanner = await HeaderBanner.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!headerBanner) {
        throw new AppError("Header banner not found", 404);
      }

      const newActiveStatus = !headerBanner.isActive;

      // If setting as active, deactivate all other banners for this device type
      if (newActiveStatus === true) {
        await HeaderBanner.updateMany(
          {
            deviceType: headerBanner.deviceType,
            isActive: true,
            isDeleted: { $ne: true },
            _id: { $ne: new mongoose.Types.ObjectId(id) },
          },
          {
            $set: { isActive: false },
          }
        );
      }

      headerBanner.isActive = newActiveStatus;
      headerBanner.updatedBy = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      await headerBanner.save();

      logger.info(
        `Header banner status toggled: ${headerBanner._id} to ${newActiveStatus} by admin ${req.user?._id}`
      );

      res.status(200).json({
        success: true,
        message: `Header banner ${newActiveStatus ? "activated" : "deactivated"} successfully`,
        data: { headerBanner },
      });
    }
  );
}

export const adminHeaderBannerController = new AdminHeaderBannerController();

