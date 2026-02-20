import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { getPaginationMeta } from "@/utils/pagination";
import { BlogBanner } from "@/models/cms/blogBanner.model";
import { fileStorageService } from "@/services/fileStorageService";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    role?: string;
    email?: string;
  };
}

class AdminBlogBannerController {
  /**
   * Normalize media input from form-data
   */
  private normalizeMediaInput(
    value: any
  ): { type: "Image" | "Video"; url: string; sortOrder: number } | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        // Handle both lowercase and capitalized values
        const typeValue = parsed.type || "Image";
        const normalizedType =
          typeValue === "Video" || typeValue === "video" ? "Video" : "Image";
        return {
          type: normalizedType as "Image" | "Video",
          url: parsed.url || "",
          sortOrder: parsed.sortOrder || 0,
        };
      } catch {
        // If not JSON, treat as URL string
        return {
          type: "Image" as const,
          url: value.trim() || "",
          sortOrder: 0,
        };
      }
    }

    if (typeof value === "object") {
      // Handle both lowercase and capitalized values
      const typeValue = value.type || "Image";
      const normalizedType =
        typeValue === "Video" || typeValue === "video" ? "Video" : "Image";
      return {
        type: normalizedType as "Image" | "Video",
        url: value.url || "",
        sortOrder: value.sortOrder || 0,
      };
    }

    return null;
  }

  /**
   * Upload banner image
   */
  private async uploadBannerImage(file?: Express.Multer.File): Promise<{
    type: "Image" | "Video";
    url: string;
    sortOrder: number;
  } | null> {
    if (!file) {
      return null;
    }

    try {
      const url = await fileStorageService.uploadFile("blog-banners", file);
      return {
        type: "Image" as const,
        url,
        sortOrder: 0,
      };
    } catch (error: any) {
      logger.error("Failed to upload banner image to cloud storage", {
        error: error.message,
        fileName: file.originalname,
        stack: error.stack,
      });
      throw new AppError(
        `Failed to upload banner image: ${error.message}`,
        500
      );
    }
  }

  /**
   * Delete banner image
   */
  private async deleteBannerImage(
    media?: { url?: string } | null
  ): Promise<void> {
    if (!media || !media.url) {
      return;
    }

    try {
      await fileStorageService.deleteFileByUrl(media.url);
    } catch (error) {
      logger.warn("Failed to delete blog banner image", {
        url: media.url,
        error,
      });
    }
  }

  /**
   * Create blog banner (Admin only)
   * @route POST /api/v1/admin/blog-banners
   * @access Private (Admin)
   */
  createBlogBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { heading, description, banner_image } = req.body;

      // Handle banner image upload
      let bannerImageData = null;
      if (req.file) {
        bannerImageData = await this.uploadBannerImage(req.file);
      } else if (banner_image) {
        bannerImageData = this.normalizeMediaInput(banner_image);
      }

      // Create blog banner
      const blogBanner = await BlogBanner.create({
        banner_image: bannerImageData,
        heading: heading || {},
        description: description || {},
        createdBy: req.user?._id
          ? new mongoose.Types.ObjectId(req.user._id)
          : undefined,
        updatedBy: req.user?._id
          ? new mongoose.Types.ObjectId(req.user._id)
          : undefined,
      });

      logger.info(
        `Blog banner created: ${blogBanner._id} by admin ${req.user?._id}`
      );

      res.status(201).json({
        success: true,
        message: "Blog banner created successfully",
        data: { blogBanner },
      });
    }
  );

  /**
   * Get all blog banners (Admin only)
   * @route GET /api/v1/admin/blog-banners
   * @access Private (Admin)
   */
  getAllBlogBanners = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        page = "1",
        limit = "10",
        search,
      } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
      };

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {
        isDeleted: { $ne: true }, // Exclude soft-deleted records
      };

      // Search functionality - by heading in any language
      if (search) {
        query.$or = [
          { "heading.en": { $regex: search, $options: "i" } },
          { "heading.nl": { $regex: search, $options: "i" } },
          { "heading.de": { $regex: search, $options: "i" } },
          { "heading.fr": { $regex: search, $options: "i" } },
          { "heading.es": { $regex: search, $options: "i" } },
        ];
      }

      const [banners, total] = await Promise.all([
        BlogBanner.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        BlogBanner.countDocuments(query),
      ]);

      const paginationMeta = getPaginationMeta(pageNum, limitNum, total);

      res.status(200).json({
        success: true,
        message: "Blog banners retrieved successfully",
        data: banners,
        pagination: paginationMeta,
      });
    }
  );

  /**
   * Get blog banner by ID (Admin only)
   * @route GET /api/v1/admin/blog-banners/:id
   * @access Private (Admin)
   */
  getBlogBannerById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid blog banner ID", 400);
      }

      const blogBanner = await BlogBanner.findOne({
        _id: id,
        isDeleted: { $ne: true },
      }).lean();

      if (!blogBanner) {
        throw new AppError("Blog banner not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Blog banner retrieved successfully",
        data: { blogBanner },
      });
    }
  );

  /**
   * Update blog banner (Admin only)
   * @route PUT /api/v1/admin/blog-banners/:id
   * @access Private (Admin)
   */
  updateBlogBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { heading, description, banner_image } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid blog banner ID", 400);
      }

      const blogBanner = await BlogBanner.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!blogBanner) {
        throw new AppError("Blog banner not found", 404);
      }

      // Handle banner image update
      if (req.file) {
        // Delete old image if exists
        if (blogBanner.banner_image) {
          await this.deleteBannerImage(blogBanner.banner_image);
        }
        // Upload new image
        const uploadedImage = await this.uploadBannerImage(req.file);
        if (uploadedImage) {
          blogBanner.banner_image = uploadedImage as any;
        }
      } else if (banner_image !== undefined) {
        // Update from JSON or URL string
        if (banner_image === null || banner_image === "") {
          // Delete old image if exists
          if (blogBanner.banner_image) {
            await this.deleteBannerImage(blogBanner.banner_image);
          }
          blogBanner.banner_image = null;
        } else {
          const normalizedImage = this.normalizeMediaInput(banner_image);
          if (normalizedImage && normalizedImage.url) {
            // Delete old image if URL changed
            if (
              blogBanner.banner_image &&
              blogBanner.banner_image.url !== normalizedImage.url
            ) {
              await this.deleteBannerImage(blogBanner.banner_image);
            }
            blogBanner.banner_image = normalizedImage as any;
          }
        }
      }

      // Update heading and description
      if (heading !== undefined) {
        blogBanner.heading = heading || {};
      }
      if (description !== undefined) {
        blogBanner.description = description || {};
      }

      blogBanner.updatedBy = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      await blogBanner.save();

      logger.info(
        `Blog banner updated: ${blogBanner._id} by admin ${req.user?._id}`
      );

      res.status(200).json({
        success: true,
        message: "Blog banner updated successfully",
        data: { blogBanner },
      });
    }
  );

  /**
   * Delete blog banner (Admin only) - Soft delete
   * @route DELETE /api/v1/admin/blog-banners/:id
   * @access Private (Admin)
   */
  deleteBlogBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid blog banner ID", 400);
      }

      const blogBanner = await BlogBanner.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!blogBanner) {
        throw new AppError("Blog banner not found", 404);
      }

      // Delete banner image from storage
      if (blogBanner.banner_image) {
        await this.deleteBannerImage(blogBanner.banner_image);
      }

      // Perform soft delete
      blogBanner.isDeleted = true;
      blogBanner.deletedAt = new Date();
      await blogBanner.save();

      logger.info(`Blog banner soft deleted: ${id} by admin ${req.user?._id}`);

      res.status(200).json({
        success: true,
        message: "Blog banner deleted successfully",
      });
    }
  );
}

export const adminBlogBannerController = new AdminBlogBannerController();
