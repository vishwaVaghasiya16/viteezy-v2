import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Blogs, BlogCategories } from "@/models/cms";
import { User } from "@/models/index.model";
import { BlogStatus } from "@/models/enums";
import { generateSlug, generateUniqueSlug } from "@/utils/slug";
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

const sanitizeTags = (tags?: string[]): string[] => {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(tags.map((tag) => tag?.trim()).filter((tag) => !!tag))
  );
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

      // If bucket doesn't exist or upload fails, log warning but don't throw
      // Allow blog creation to proceed without cover image
      logger.warn(
        "Blog will be created without cover image due to upload failure. Please check DigitalOcean Spaces configuration."
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
      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;
      const {
        title,
        slug,
        excerpt,
        content,
        authorId,
        categoryId,
        tags,
        coverImage,
        gallery,
        seo,
        status = BlogStatus.DRAFT,
        publishedAt,
      } = req.body;

      const authorObjectId = ensureObjectId(authorId, "author");
      const categoryObjectId = ensureObjectId(categoryId, "category");

      const [authorExists, categoryExists] = await Promise.all([
        User.exists({ _id: authorObjectId, isDeleted: { $ne: true } }),
        BlogCategories.exists({
          _id: categoryObjectId,
          isDeleted: false,
          isActive: true,
        }),
      ]);

      if (!authorExists) {
        throw new AppError("Author not found", 404);
      }

      if (!categoryExists) {
        throw new AppError("Category not found or inactive", 404);
      }

      const baseSlug = slug || generateSlug(title?.en || "");
      if (!baseSlug) {
        throw new AppError(
          "Unable to generate slug. Please provide a valid title or slug.",
          400
        );
      }

      const finalSlug = await generateUniqueSlug(
        baseSlug,
        async (slugToCheck) =>
          Blogs.exists({
            slug: slugToCheck,
            isDeleted: false,
          }).then((existing) => Boolean(existing))
      );

      const normalizedStatus = status as BlogStatus;
      const finalPublishedAt =
        normalizedStatus === BlogStatus.PUBLISHED
          ? publishedAt || new Date()
          : undefined;

      let coverImageUrl = this.normalizeCoverImageInput(coverImage);
      if (req.file) {
        try {
          const uploadedUrl = await this.uploadCoverImage(req.file);
          if (uploadedUrl) {
            coverImageUrl = uploadedUrl;
          } else {
            logger.warn(
              "Cover image upload failed, creating blog without cover image"
            );
          }
        } catch (error: any) {
          logger.error("Error uploading cover image", {
            error: error.message,
            fileName: req.file.originalname,
          });
          // Continue without cover image
        }
      }

      const blog = await Blogs.create({
        slug: finalSlug,
        title,
        excerpt,
        content,
        authorId: authorObjectId,
        categoryId: categoryObjectId,
        tags: sanitizeTags(tags),
        coverImage: coverImageUrl ?? null,
        gallery,
        seo,
        status: normalizedStatus,
        publishedAt: finalPublishedAt,
        createdBy: requesterId,
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
      const { status, search, categoryId } = req.query as {
        status?: BlogStatus;
        search?: string;
        categoryId?: string;
      };

      const filter: Record<string, any> = {
        isDeleted: false,
      };

      if (status) {
        filter.status = status;
      }

      if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
        filter.categoryId = new mongoose.Types.ObjectId(categoryId);
      }

      if (search) {
        filter.$or = [
          { "title.en": { $regex: search, $options: "i" } },
          { "title.nl": { $regex: search, $options: "i" } },
          { slug: { $regex: search, $options: "i" } },
          { tags: { $regex: search, $options: "i" } },
        ];
      }

      const sortOptions: Record<string, 1 | -1> = {
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      const [blogs, total] = await Promise.all([
        Blogs.find(filter)
          .populate("categoryId", "title slug")
          .populate("authorId", "name email")
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Blogs.countDocuments(filter),
      ]);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(blogs, pagination, "Blogs retrieved successfully");
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
        slug,
        excerpt,
        content,
        authorId,
        categoryId,
        tags,
        coverImage,
        gallery,
        seo,
        status,
        publishedAt,
      } = req.body;

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const blog = await Blogs.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!blog) {
        throw new AppError("Blog not found", 404);
      }

      if (authorId) {
        const authorObjectId = ensureObjectId(authorId, "author");
        const authorExists = await User.exists({
          _id: authorObjectId,
          isDeleted: { $ne: true },
        });
        if (!authorExists) throw new AppError("Author not found", 404);
        blog.authorId = authorObjectId;
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

      if (title) blog.title = title;
      if (excerpt) blog.excerpt = excerpt;
      if (content) blog.content = content;

      if (typeof gallery !== "undefined") {
        blog.gallery = gallery;
      }
      if (seo) blog.seo = seo;
      if (tags) blog.tags = sanitizeTags(tags);

      let nextCoverImage = blog.coverImage ?? null;
      if (req.file) {
        try {
          const uploaded = await this.uploadCoverImage(req.file);
          if (uploaded) {
            await this.deleteCoverImage(nextCoverImage);
            nextCoverImage = uploaded;
          } else {
            logger.warn(
              "Cover image upload failed during update, keeping existing image"
            );
          }
        } catch (error: any) {
          logger.error("Error uploading cover image during update", {
            error: error.message,
            fileName: req.file.originalname,
          });
          // Keep existing image if upload fails
        }
      } else if (Object.prototype.hasOwnProperty.call(req.body, "coverImage")) {
        const normalized = this.normalizeCoverImageInput(coverImage);
        if (normalized !== nextCoverImage && nextCoverImage) {
          await this.deleteCoverImage(nextCoverImage);
        }
        nextCoverImage = normalized;
      }
      blog.coverImage = nextCoverImage ?? null;

      if (slug && slug !== blog.slug) {
        const finalSlug = await generateUniqueSlug(slug, async (slugToCheck) =>
          Blogs.exists({
            slug: slugToCheck,
            _id: { $ne: blog._id },
            isDeleted: false,
          }).then((existing) => Boolean(existing))
        );
        blog.slug = finalSlug;
      } else if (!slug && title?.en && title.en !== blog.title?.en) {
        const baseSlug = generateSlug(title.en);
        const finalSlug = await generateUniqueSlug(
          baseSlug,
          async (slugToCheck) =>
            Blogs.exists({
              slug: slugToCheck,
              _id: { $ne: blog._id },
              isDeleted: false,
            }).then((existing) => Boolean(existing))
        );
        blog.slug = finalSlug;
      }

      if (status) {
        blog.status = status as BlogStatus;
        if (status === BlogStatus.PUBLISHED) {
          blog.publishedAt = publishedAt || blog.publishedAt || new Date();
        } else if (status === BlogStatus.DRAFT) {
          blog.publishedAt = publishedAt ?? blog.publishedAt;
        }
      } else if (publishedAt !== undefined) {
        blog.publishedAt = publishedAt;
      }

      if (requesterId) blog.updatedBy = requesterId;

      await blog.save();

      res.apiSuccess({ blog }, "Blog updated successfully");
    }
  );

  /**
   * Update blog status (publish/unpublish)
   */
  updateBlogStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { status, publishedAt } = req.body as {
        status: BlogStatus;
        publishedAt?: Date;
      };

      const blog = await Blogs.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!blog) {
        throw new AppError("Blog not found", 404);
      }

      blog.status = status;
      if (status === BlogStatus.PUBLISHED) {
        blog.publishedAt = publishedAt || new Date();
      } else {
        blog.publishedAt = publishedAt ?? blog.publishedAt;
      }

      if (req.user?._id) {
        blog.updatedBy = new mongoose.Types.ObjectId(req.user._id);
      }

      await blog.save();

      res.apiSuccess(
        { blog },
        `Blog ${
          status === BlogStatus.PUBLISHED ? "published" : "updated"
        } successfully`
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
