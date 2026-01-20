import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Blogs, BlogCategories, BlogBanner } from "@/models/cms";
import { User } from "@/models/index.model";
import { fileStorageService } from "@/services/fileStorageService";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

const ensureObjectId = (id: string, label: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return new mongoose.Types.ObjectId(id);
};

class AdminBlogController {
  private normalizeCoverImageInput(value: any): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    if (
      !trimmed ||
      trimmed.toLowerCase() === "null" ||
      trimmed.toLowerCase() === "undefined"
    ) {
      return null;
    }

    return trimmed;
  }

  private async uploadCoverImage(
    file?: Express.Multer.File
  ): Promise<string | null> {
    if (!file) {
      return null;
    }

    try {
      return await fileStorageService.uploadFile("blogs", file);
    } catch (error: any) {
      logger.error("Failed to upload cover image to cloud storage", {
        error: error.message,
        fileName: file.originalname,
        stack: error.stack,
      });
      logger.warn(
        "Blog will be created without cover image due to upload failure."
      );
      return null;
    }
  }

  private async deleteCoverImage(url?: string | null): Promise<void> {
    if (!url) {
      return;
    }

    try {
      await fileStorageService.deleteFileByUrl(url);
    } catch (error) {
      logger.warn("Failed to delete blog cover image", { url, error });
    }
  }

  /**
   * Create a new blog post
   */
  createBlog = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        title,
        description,
        seo,
        coverImage,
        isActive = true,
        authorId,
        categoryId,
      } = req.body;

      const categoryObjectId = ensureObjectId(categoryId, "category");

      const categoryExists = await BlogCategories.exists({
        _id: categoryObjectId,
        isDeleted: false,
        isActive: true,
      });

      if (!categoryExists) {
        throw new AppError("Category not found or inactive", 404);
      }

      // Check if title is unique
      if (title?.en) {
        const existingBlog = await Blogs.findOne({
          "title.en": title.en,
          isDeleted: false,
        });
        if (existingBlog) {
          throw new AppError("A blog with this title already exists", 400);
        }
      }

      let authorObjectId: mongoose.Types.ObjectId | null = null;
      if (authorId) {
        authorObjectId = ensureObjectId(authorId, "author");
        const authorExists = await User.exists({
          _id: authorObjectId,
          isDeleted: { $ne: true },
        });
        if (!authorExists) {
          throw new AppError("Author not found", 404);
        }
      }

      let coverImageUrl = this.normalizeCoverImageInput(coverImage);
      if (req.file) {
        const uploadedUrl = await this.uploadCoverImage(req.file);
        if (uploadedUrl) {
          coverImageUrl = uploadedUrl;
        }
      }

      const blog = await Blogs.create({
        title,
        description: description || {},
        seo: seo || {},
        coverImage: coverImageUrl ?? null,
        isActive,
        authorId: authorObjectId,
        categoryId: categoryObjectId,
      });

      res.apiCreated({ blog }, "Blog created successfully");
    }
  );

  /**
   * Get paginated list of all blogs (Admin view)
   */
  getBlogs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { isActive, search, categoryId } = req.query as {
        isActive?: string;
        search?: string;
        categoryId?: string;
      };

      const filter: Record<string, any> = {
        isDeleted: false,
      };

      if (isActive !== undefined) {
        filter.isActive = isActive === "true";
      }

      if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
        filter.categoryId = new mongoose.Types.ObjectId(categoryId);
      }

      if (search) {
        filter.$or = [
          { "title.en": { $regex: search, $options: "i" } },
          { "title.nl": { $regex: search, $options: "i" } },
          { "seo.metaSlug": { $regex: search, $options: "i" } },
        ];
      }

      const sortOptions: Record<string, 1 | -1> = {
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      const [blogs, total, blogBanners] = await Promise.all([
        Blogs.find(filter)
          .populate("categoryId", "title slug")
          .populate("authorId", "name email")
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Blogs.countDocuments(filter),
        BlogBanner.find({ isDeleted: { $ne: true } })
          .sort({ createdAt: -1 })
          .lean(),
      ]);

      const pagination = getPaginationMeta(page, limit, total);

      // Send response with blogs and blog banners
      res.status(200).json({
        success: true,
        message: "Blogs retrieved successfully",
        data: { blogs, blogBanners },
        pagination,
      });
    }
  );

  /**
   * Get blog by ID
   */
  getBlogById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const blog = await Blogs.findOne({
        _id: id,
        isDeleted: false,
      })
        .populate("categoryId", "title slug")
        .populate("authorId", "name email")
        .lean();

      if (!blog) {
        throw new AppError("Blog not found", 404);
      }

      res.apiSuccess({ blog }, "Blog retrieved successfully");
    }
  );

  /**
   * Update blog
   */
  updateBlog = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const {
        title,
        description,
        seo,
        coverImage,
        isActive,
        authorId,
        categoryId,
      } = req.body;

      const blog = await Blogs.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!blog) {
        throw new AppError("Blog not found", 404);
      }

      if (authorId !== undefined) {
        if (authorId === null) {
          blog.authorId = null;
        } else {
          const authorObjectId = ensureObjectId(authorId, "author");
          const authorExists = await User.exists({
            _id: authorObjectId,
            isDeleted: { $ne: true },
          });
          if (!authorExists) throw new AppError("Author not found", 404);
          blog.authorId = authorObjectId;
        }
      }

      if (categoryId) {
        const categoryObjectId = ensureObjectId(categoryId, "category");
        const categoryExists = await BlogCategories.exists({
          _id: categoryObjectId,
          isDeleted: false,
        });
        if (!categoryExists) throw new AppError("Category not found", 404);
        blog.categoryId = categoryObjectId;
      }

      // Check if title is unique (excluding current blog)
      if (title?.en) {
        const existingBlog = await Blogs.findOne({
          "title.en": title.en,
          _id: { $ne: blog._id },
          isDeleted: false,
        });
        if (existingBlog) {
          throw new AppError("A blog with this title already exists", 400);
        }
      }

      if (title) blog.title = title;
      if (description) blog.description = description;
      if (seo) blog.seo = seo;
      if (isActive !== undefined) blog.isActive = isActive;

      let nextCoverImage = blog.coverImage ?? null;
      if (req.file) {
        const uploaded = await this.uploadCoverImage(req.file);
        if (uploaded) {
          await this.deleteCoverImage(nextCoverImage);
          nextCoverImage = uploaded;
        }
      } else if (Object.prototype.hasOwnProperty.call(req.body, "coverImage")) {
        const normalized = this.normalizeCoverImageInput(coverImage);
        if (normalized !== nextCoverImage && nextCoverImage) {
          await this.deleteCoverImage(nextCoverImage);
        }
        nextCoverImage = normalized;
      }
      blog.coverImage = nextCoverImage ?? null;

      await blog.save();

      res.apiSuccess({ blog }, "Blog updated successfully");
    }
  );

  /**
   * Update blog status (activate/deactivate)
   */
  updateBlogStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { isActive } = req.body as { isActive: boolean };

      const blog = await Blogs.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!blog) {
        throw new AppError("Blog not found", 404);
      }

      blog.isActive = isActive;
      await blog.save();

      res.apiSuccess(
        { blog },
        `Blog ${isActive ? "activated" : "deactivated"} successfully`
      );
    }
  );

  /**
   * Delete blog (soft delete)
   */
  deleteBlog = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const blog = await Blogs.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!blog) {
        throw new AppError("Blog not found", 404);
      }

      if (blog.coverImage) {
        await this.deleteCoverImage(blog.coverImage);
        blog.coverImage = null;
      }
      blog.isDeleted = true;
      blog.deletedAt = new Date();
      await blog.save();

      res.apiSuccess(null, "Blog deleted successfully");
    }
  );
}

export const adminBlogController = new AdminBlogController();
