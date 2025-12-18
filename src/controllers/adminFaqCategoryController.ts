import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { FaqCategories, FAQs } from "@/models/cms";
import { generateSlug } from "@/utils/slug";
import { fileStorageService } from "@/services/fileStorageService";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
  };
}

class AdminFaqCategoryController {
  /**
   * Create a new FAQ category
   */
  createCategory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { title, slug, isActive, icon } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const baseSlug = slug || generateSlug(title?.en || "");
      if (!baseSlug) {
        throw new AppError(
          "Unable to generate slug. Please provide a valid title or slug.",
          400
        );
      }

      // Check if slug already exists (no counter, just throw error)
      const existingSlug = await FaqCategories.findOne({
        slug: baseSlug,
        isDeleted: false,
      });

      if (existingSlug) {
        throw new AppError("This title is already in use.", 400);
      }

      // Check if category with same title.en and slug already exists
      if (title?.en) {
        const existingCategory = await FaqCategories.findOne({
          "title.en": title.en,
          slug: baseSlug,
          isDeleted: false,
        });

        if (existingCategory) {
          throw new AppError(
            "A category with this title and slug already exists. Please use a different title or slug.",
            400
          );
        }
      }

      const finalSlug = baseSlug;

      // Handle icon upload
      let iconUrl: string | null = icon || null;
      if (files?.icon && files.icon.length > 0) {
        try {
          iconUrl = await fileStorageService.uploadFile(
            "faq-categories/icons",
            files.icon[0]
          );
        } catch (error: any) {
          throw new AppError(`Failed to upload icon: ${error.message}`, 500);
        }
      }

      const category = await FaqCategories.create({
        title,
        slug: finalSlug,
        icon: iconUrl,
        isActive: isActive !== undefined ? isActive : true,
        createdBy: requesterId,
      });

      res.apiCreated({ category }, "FAQ category created successfully");
    }
  );

  /**
   * Get paginated FAQ categories (Admin view)
   */
  getCategories = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { search, status } = req.query as {
        search?: string;
        status?: "active" | "inactive" | "all";
      };

      const filter: Record<string, any> = {
        isDeleted: false,
      };

      if (status === "active") {
        filter.isActive = true;
      } else if (status === "inactive") {
        filter.isActive = false;
      }

      if (search) {
        filter.$or = [
          { "title.en": { $regex: search, $options: "i" } },
          { "title.nl": { $regex: search, $options: "i" } },
          { slug: { $regex: search, $options: "i" } },
        ];
      }

      const sortOptions = {
        createdAt: -1 as 1 | -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      const [categories, total] = await Promise.all([
        FaqCategories.find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        FaqCategories.countDocuments(filter),
      ]);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(
        categories,
        pagination,
        "FAQ categories retrieved successfully"
      );
    }
  );

  /**
   * Get category by ID
   */
  getCategoryById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const category = await FaqCategories.findOne({
        _id: id,
        isDeleted: false,
      }).lean();

      if (!category) {
        throw new AppError("FAQ category not found", 404);
      }

      res.apiSuccess({ category }, "FAQ category retrieved successfully");
    }
  );

  /**
   * Update FAQ category
   */
  updateCategory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { title, slug, isActive, icon } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const category = await FaqCategories.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!category) {
        throw new AppError("FAQ category not found", 404);
      }

      let finalSlug = category.slug;
      const finalTitle = title?.en || category.title?.en || "";
      const isTitleChanging = title?.en && title.en !== category.title?.en;
      const isSlugChanging = slug && slug !== category.slug;

      if (isSlugChanging) {
        const baseSlug =
          slug || generateSlug(title?.en || category.title?.en || "");

        // Check if slug already exists (no counter, just throw error)
        const existingSlug = await FaqCategories.findOne({
          slug: baseSlug,
          _id: { $ne: category._id },
          isDeleted: false,
        });

        if (existingSlug) {
          throw new AppError("This title is already in use.", 400);
        }

        finalSlug = baseSlug;
      } else if (!slug && isTitleChanging) {
        const baseSlug = generateSlug(title.en);

        // Check if slug already exists (no counter, just throw error)
        const existingSlug = await FaqCategories.findOne({
          slug: baseSlug,
          _id: { $ne: category._id },
          isDeleted: false,
        });

        if (existingSlug) {
          throw new AppError("This title is already in use.", 400);
        }

        finalSlug = baseSlug;
      }

      // Check if another category with same title.en and slug already exists
      // Only check if title or slug is being changed
      if ((isTitleChanging || isSlugChanging) && finalTitle && finalSlug) {
        const existingCategory = await FaqCategories.findOne({
          "title.en": finalTitle,
          slug: finalSlug,
          _id: { $ne: category._id },
          isDeleted: false,
        });

        if (existingCategory) {
          throw new AppError(
            "A category with this title and slug already exists. Please use a different title or slug.",
            400
          );
        }
      }

      // Handle icon upload - delete old icon if new one is uploaded
      if (files?.icon && files.icon.length > 0) {
        try {
          // Delete old icon if it exists
          if (category.icon) {
            await fileStorageService
              .deleteFileByUrl(category.icon)
              .catch((error) => {
                // Log error but don't fail the upload
                logger.warn("Failed to delete old FAQ category icon:", {
                  url: category.icon,
                  error: error?.message,
                });
              });
          }

          // Upload new icon
          const iconUrl = await fileStorageService.uploadFile(
            "faq-categories/icons",
            files.icon[0]
          );
          category.icon = iconUrl;
        } catch (error: any) {
          throw new AppError(`Failed to upload icon: ${error.message}`, 500);
        }
      } else if (icon !== undefined) {
        // If icon is explicitly set to null/empty string, delete old icon
        if (!icon || icon === "") {
          if (category.icon) {
            await fileStorageService
              .deleteFileByUrl(category.icon)
              .catch((error) => {
                logger.warn("Failed to delete old FAQ category icon:", {
                  url: category.icon,
                  error: error?.message,
                });
              });
          }
          category.icon = undefined;
        } else {
          category.icon = icon;
        }
      }

      category.title = title ?? category.title;
      category.slug = finalSlug;
      if (isActive !== undefined) category.isActive = isActive;
      if (requesterId) category.set("updatedBy", requesterId);

      await category.save();

      res.apiSuccess({ category }, "FAQ category updated successfully");
    }
  );

  /**
   * Delete category (soft delete). Prevent deletion if FAQs are linked.
   */
  deleteCategory = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const category = await FaqCategories.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!category) {
        throw new AppError("FAQ category not found", 404);
      }

      const linkedFaq = await FAQs.exists({
        categoryId: category._id,
        isDeleted: false,
      });

      if (linkedFaq) {
        throw new AppError(
          "Cannot delete category while FAQs are assigned to it. Reassign or delete associated FAQs first.",
          400
        );
      }

      // Delete icon from cloud storage
      if (category.icon) {
        await fileStorageService
          .deleteFileByUrl(category.icon)
          .catch((error) => {
            logger.warn("Failed to delete FAQ category icon:", {
              url: category.icon,
              error: error?.message,
            });
          });
      }

      category.set("isDeleted", true);
      category.set("deletedAt", new Date());
      await category.save();

      res.apiSuccess(null, "FAQ category deleted successfully");
    }
  );
}

export const adminFaqCategoryController = new AdminFaqCategoryController();
