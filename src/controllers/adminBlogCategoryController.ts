import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { BlogCategories, Blogs } from "@/models/cms";
import { generateSlug, generateUniqueSlug } from "@/utils/slug";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
  };
}

class AdminBlogCategoryController {
  /**
   * Create a new blog category
   */
  createCategory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { title, slug, isActive } = req.body;
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

      const finalSlug = await generateUniqueSlug(
        baseSlug,
        async (slugToCheck) =>
          BlogCategories.exists({
            slug: slugToCheck,
            isDeleted: false,
          }).then((existing) => Boolean(existing))
      );

      const category = await BlogCategories.create({
        title,
        slug: finalSlug,
        isActive: isActive !== undefined ? isActive : true,
        createdBy: requesterId,
      });

      res.apiCreated({ category }, "Blog category created successfully");
    }
  );

  /**
   * Get paginated blog categories (Admin view)
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
        BlogCategories.find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        BlogCategories.countDocuments(filter),
      ]);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(
        categories,
        pagination,
        "Categories retrieved successfully"
      );
    }
  );

  /**
   * Get category by ID
   */
  getCategoryById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const category = await BlogCategories.findOne({
        _id: id,
        isDeleted: false,
      }).lean();

      if (!category) {
        throw new AppError("Category not found", 404);
      }

      res.apiSuccess({ category }, "Category retrieved successfully");
    }
  );

  /**
   * Update blog category
   */
  updateCategory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { title, slug, isActive } = req.body;
      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const category = await BlogCategories.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!category) {
        throw new AppError("Category not found", 404);
      }

      let finalSlug = category.slug;
      if (slug && slug !== category.slug) {
        const baseSlug =
          slug || generateSlug(title?.en || category.title?.en || "");
        finalSlug = await generateUniqueSlug(baseSlug, async (slugToCheck) =>
          BlogCategories.exists({
            slug: slugToCheck,
            _id: { $ne: category._id },
            isDeleted: false,
          }).then((existing) => Boolean(existing))
        );
      } else if (!slug && title?.en && title.en !== category.title?.en) {
        const baseSlug = generateSlug(title.en);
        finalSlug = await generateUniqueSlug(baseSlug, async (slugToCheck) =>
          BlogCategories.exists({
            slug: slugToCheck,
            _id: { $ne: category._id },
            isDeleted: false,
          }).then((existing) => Boolean(existing))
        );
      }

      category.title = title ?? category.title;
      category.slug = finalSlug;
      if (isActive !== undefined) category.isActive = isActive;
      if (requesterId) category.set("updatedBy", requesterId);

      await category.save();

      res.apiSuccess({ category }, "Category updated successfully");
    }
  );

  /**
   * Delete category (soft delete). Prevent deletion if blogs are linked.
   */
  deleteCategory = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const category = await BlogCategories.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!category) {
        throw new AppError("Category not found", 404);
      }

      const linkedBlog = await Blogs.exists({
        categoryId: category._id,
        isDeleted: false,
      });

      if (linkedBlog) {
        throw new AppError(
          "Cannot delete category while blogs are assigned to it. Reassign or delete associated blogs first.",
          400
        );
      }

      category.set("isDeleted", true);
      category.set("deletedAt", new Date());
      await category.save();

      res.apiSuccess(null, "Category deleted successfully");
    }
  );
}

export const adminBlogCategoryController = new AdminBlogCategoryController();
