import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { ProductCategory } from "@/models/commerce";
import { Products } from "@/models/commerce";
import { generateSlug, generateUniqueSlug } from "@/utils/slug";
import { fileStorageService } from "@/services/fileStorageService";
import { logger } from "@/utils/logger";
import { MediaType } from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
  };
}

class AdminProductCategoryController {
  /**
   * Create a new product category
   * @route POST /api/v1/admin/product-categories
   * @access Admin
   */
  createCategory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { name, slug, description, sortOrder, icon, image, seo, isActive } =
        req.body;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      // Generate slug if not provided
      const baseSlug = slug || generateSlug(name?.en || "");
      if (!baseSlug) {
        throw new AppError(
          "Unable to generate slug. Please provide a valid name or slug.",
          400
        );
      }

      const finalSlug = await generateUniqueSlug(
        baseSlug,
        async (slugToCheck) =>
          ProductCategory.exists({
            slug: slugToCheck,
            isDeleted: false,
          }).then((existing) => Boolean(existing))
      );

      // Handle icon upload
      let iconUrl: string | null = icon || null;
      if (files?.icon && files.icon.length > 0) {
        try {
          iconUrl = await fileStorageService.uploadFile(
            "product-categories/icons",
            files.icon[0]
          );
        } catch (error: any) {
          throw new AppError(`Failed to upload icon: ${error.message}`, 500);
        }
      }

      // Handle image upload
      let imageData: any = image || null;
      if (files?.image && files.image.length > 0) {
        try {
          const imageUrl = await fileStorageService.uploadFile(
            "product-categories/images",
            files.image[0]
          );

          // Parse image object if provided as JSON string, otherwise create default structure
          let parsedImage = null;
          if (image && typeof image === "string") {
            try {
              parsedImage = JSON.parse(image);
            } catch {
              parsedImage = null;
            }
          } else if (image && typeof image === "object") {
            parsedImage = image;
          }

          imageData = {
            type: MediaType.IMAGE,
            url: imageUrl,
            alt: parsedImage?.alt || {
              en: name?.en || "",
              nl: name?.nl || "",
            },
            sortOrder: parsedImage?.sortOrder || 0,
          };
        } catch (error: any) {
          throw new AppError(`Failed to upload image: ${error.message}`, 500);
        }
      }

      // Create category
      const category = await ProductCategory.create({
        slug: finalSlug,
        name: name || {},
        description: description || {},
        sortOrder: sortOrder || 0,
        icon: iconUrl,
        image: imageData,
        seo: seo || {},
        isActive: isActive !== undefined ? isActive : true,
        productCount: 0,
        createdBy: requesterId,
        updatedBy: requesterId,
      });

      res.apiCreated({ category }, "Product category created successfully");
    }
  );

  /**
   * Get all product categories with pagination and filters
   * @route GET /api/v1/admin/product-categories
   * @access Admin
   */
  getProductCategory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { search, isActive } = req.query as {
        search?: string;
        isActive?: string | boolean;
      };

      const filter: any = {
        isDeleted: { $ne: true },
      };

      // Filter by active status
      if (isActive !== undefined) {
        const value: string | boolean = isActive;
        filter.isActive = value === "true" || value === true || value === "1";
      }

      // Search functionality
      if (search) {
        filter.$or = [
          { "name.en": { $regex: search, $options: "i" } },
          { "name.nl": { $regex: search, $options: "i" } },
          { slug: { $regex: search, $options: "i" } },
        ];
      }

      const sortOptions = {
        sortOrder: 1 as 1 | -1,
        createdAt: -1 as 1 | -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      const [categories, total] = await Promise.all([
        ProductCategory.find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        ProductCategory.countDocuments(filter),
      ]);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(
        categories,
        pagination,
        "Product categories retrieved successfully"
      );
    }
  );

  /**
   * Get category by ID
   * @route GET /api/v1/admin/product-categories/:id
   * @access Admin
   */
  getCategoryById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid category ID", 400);
      }

      const category = await ProductCategory.findOne({
        _id: id,
        isDeleted: { $ne: true },
      }).lean();

      if (!category) {
        throw new AppError("Category not found", 404);
      }

      res.apiSuccess({ category }, "Category retrieved successfully");
    }
  );

  /**
   * Update category
   * @route PUT /api/v1/admin/product-categories/:id
   * @access Admin
   */
  updateCategory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { name, slug, description, sortOrder, icon, image, seo, isActive } =
        req.body;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid category ID", 400);
      }

      const category = await ProductCategory.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!category) {
        throw new AppError("Category not found", 404);
      }

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const updateData: any = {
        updatedBy: requesterId,
      };

      // Update name
      if (name !== undefined) {
        updateData.name = name;
        // Regenerate slug if name changed
        if (name.en && name.en !== category.name?.en) {
          const baseSlug = slug || generateSlug(name.en);
          if (baseSlug) {
            const finalSlug = await generateUniqueSlug(
              baseSlug,
              async (slugToCheck) =>
                ProductCategory.exists({
                  slug: slugToCheck,
                  _id: { $ne: id },
                  isDeleted: false,
                }).then((existing) => Boolean(existing))
            );
            updateData.slug = finalSlug;
          }
        }
      }

      // Update slug if provided separately
      if (slug !== undefined && slug !== category.slug) {
        const finalSlug = await generateUniqueSlug(slug, async (slugToCheck) =>
          ProductCategory.exists({
            slug: slugToCheck,
            _id: { $ne: id },
            isDeleted: false,
          }).then((existing) => Boolean(existing))
        );
        updateData.slug = finalSlug;
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
                logger.warn("Failed to delete old icon:", {
                  url: category.icon,
                  error: error?.message,
                });
              });
          }

          // Upload new icon
          const iconUrl = await fileStorageService.uploadFile(
            "product-categories/icons",
            files.icon[0]
          );
          updateData.icon = iconUrl;
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
                logger.warn("Failed to delete old icon:", {
                  url: category.icon,
                  error: error?.message,
                });
              });
          }
          updateData.icon = null;
        } else {
          updateData.icon = icon;
        }
      }

      // Handle image upload - delete old image if new one is uploaded
      if (files?.image && files.image.length > 0) {
        try {
          // Delete old image if it exists
          if (category.image?.url) {
            await fileStorageService
              .deleteFileByUrl(category.image.url)
              .catch((error) => {
                // Log error but don't fail the upload
                logger.warn("Failed to delete old image:", {
                  url: category.image?.url,
                  error: error?.message,
                });
              });
          }

          // Upload new image
          const imageUrl = await fileStorageService.uploadFile(
            "product-categories/images",
            files.image[0]
          );

          // Parse image object if provided as JSON string, otherwise create default structure
          let parsedImage = null;
          if (image && typeof image === "string") {
            try {
              parsedImage = JSON.parse(image);
            } catch {
              parsedImage = null;
            }
          } else if (image && typeof image === "object") {
            parsedImage = image;
          }

          updateData.image = {
            type: MediaType.IMAGE,
            url: imageUrl,
            alt: parsedImage?.alt ||
              category.image?.alt || {
                en: name?.en || category.name?.en || "",
                nl: name?.nl || category.name?.nl || "",
              },
            sortOrder: parsedImage?.sortOrder || category.image?.sortOrder || 0,
          };
        } catch (error: any) {
          throw new AppError(`Failed to upload image: ${error.message}`, 500);
        }
      } else if (image !== undefined) {
        // If image is explicitly set to null/empty, delete old image
        if (!image || image === "" || image === "null") {
          if (category.image?.url) {
            await fileStorageService
              .deleteFileByUrl(category.image.url)
              .catch((error) => {
                logger.warn("Failed to delete old image:", {
                  url: category.image?.url,
                  error: error?.message,
                });
              });
          }
          updateData.image = null;
        } else {
          // Parse image object if provided as JSON string
          let parsedImage = null;
          if (typeof image === "string") {
            try {
              parsedImage = JSON.parse(image);
            } catch {
              parsedImage = image;
            }
          } else {
            parsedImage = image;
          }

          // If only updating image metadata (alt, sortOrder), keep existing URL
          if (parsedImage && !parsedImage.url && category.image?.url) {
            updateData.image = {
              ...category.image,
              ...parsedImage,
              url: category.image.url,
            };
          } else {
            updateData.image = parsedImage;
          }
        }
      }

      // Update other fields
      if (description !== undefined) updateData.description = description;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (seo !== undefined) updateData.seo = seo || {};
      if (isActive !== undefined) updateData.isActive = isActive;

      // Update category
      const updatedCategory = await ProductCategory.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).lean();

      res.apiSuccess(
        { category: updatedCategory },
        "Category updated successfully"
      );
    }
  );

  /**
   * Delete category (soft delete)
   * @route DELETE /api/v1/admin/product-categories/:id
   * @access Admin
   */
  deleteCategory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid category ID", 400);
      }

      const category = await ProductCategory.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!category) {
        throw new AppError("Category not found", 404);
      }

      // Check if category has products
      const productCount = await Products.countDocuments({
        categories: { $in: [category._id] },
        isDeleted: { $ne: true },
      });

      if (productCount > 0) {
        throw new AppError(
          `Cannot delete category. ${productCount} product(s) are assigned to this category. Please reassign products before deleting.`,
          400
        );
      }

      // Delete icon and image from cloud storage
      const deletePromises: Promise<void>[] = [];

      if (category.icon) {
        deletePromises.push(
          fileStorageService.deleteFileByUrl(category.icon).catch((error) => {
            logger.warn("Failed to delete category icon:", {
              url: category.icon,
              error: error?.message,
            });
          })
        );
      }

      if (category.image?.url) {
        deletePromises.push(
          fileStorageService
            .deleteFileByUrl(category.image.url)
            .catch((error) => {
              logger.warn("Failed to delete category image:", {
                url: category.image?.url,
                error: error?.message,
              });
            })
        );
      }

      // Wait for all deletions to complete (don't fail if deletion fails)
      await Promise.all(deletePromises);

      // Soft delete
      await ProductCategory.findByIdAndUpdate(id, {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: req.user?._id
          ? new mongoose.Types.ObjectId(req.user._id)
          : undefined,
      });

      res.apiSuccess(null, "Category deleted successfully");
    }
  );
}

export const adminProductCategoryController =
  new AdminProductCategoryController();
