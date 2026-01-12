import { Request, Response } from "express";
import mongoose, { FilterQuery } from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { ProductIngredients, Products } from "@/models/commerce";
import { IProductIngredient } from "@/models/commerce/productIngredients.model";
import { MediaType } from "@/models/common.model";
import { fileStorageService } from "@/services/fileStorageService";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

class AdminProductIngredientController {
  /**
   * Add ingredient ID to products' ingredients array
   */
  private async addIngredientIdToProducts(
    ingredientId: mongoose.Types.ObjectId,
    productIds: mongoose.Types.ObjectId[]
  ): Promise<void> {
    if (productIds.length === 0 || !ingredientId) {
      return;
    }

    try {
      const result = await Products.updateMany(
        {
          _id: { $in: productIds },
          isDeleted: false,
        },
        {
          $addToSet: { ingredients: ingredientId }, // Add if not already present
        }
      );

      logger.info(
        `Added ingredient ID ${ingredientId} to ${result.modifiedCount} out of ${result.matchedCount} products`
      );
    } catch (error: any) {
      logger.error("Error adding ingredient ID to products", {
        ingredientId,
        productIds,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove ingredient ID from products' ingredients array
   */
  private async removeIngredientIdFromProducts(
    ingredientId: mongoose.Types.ObjectId | string,
    productIds: mongoose.Types.ObjectId[]
  ): Promise<void> {
    if (productIds.length === 0 || !ingredientId) {
      return;
    }

    try {
      // Ensure ingredientId is properly converted to ObjectId
      const ingredientObjectId =
        ingredientId instanceof mongoose.Types.ObjectId
          ? ingredientId
          : new mongoose.Types.ObjectId(String(ingredientId));

      const result = await Products.updateMany(
        {
          _id: { $in: productIds },
          isDeleted: false,
        },
        {
          $pull: { ingredients: ingredientObjectId },
        }
      );

      logger.info(
        `Removed ingredient ID ${ingredientObjectId} from ${result.modifiedCount} out of ${result.matchedCount} products`
      );
    } catch (error: any) {
      logger.error("Error removing ingredient ID from products", {
        ingredientId,
        productIds,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update products' ingredients array when ingredient products change
   */
  private async updateIngredientIdInProducts(
    ingredientId: mongoose.Types.ObjectId,
    oldProductIds: mongoose.Types.ObjectId[],
    newProductIds: mongoose.Types.ObjectId[]
  ): Promise<void> {
    if (!ingredientId) {
      return;
    }

    // Find products to remove from (in old but not in new)
    const productsToRemove = oldProductIds.filter(
      (oldId) =>
        !newProductIds.some((newId) => newId.toString() === oldId.toString())
    );

    // Find products to add to (in new but not in old)
    const productsToAdd = newProductIds.filter(
      (newId) =>
        !oldProductIds.some((oldId) => oldId.toString() === newId.toString())
    );

    // Remove from old products
    if (productsToRemove.length > 0) {
      await this.removeIngredientIdFromProducts(ingredientId, productsToRemove);
    }

    // Add to new products
    if (productsToAdd.length > 0) {
      await this.addIngredientIdToProducts(ingredientId, productsToAdd);
    }
  }

  private async uploadImage(
    file?: Express.Multer.File
  ): Promise<MediaType | null> {
    if (!file) {
      return null;
    }

    try {
      const url = await fileStorageService.uploadFile(
        "product-ingredients",
        file
      );
      return {
        type: "image",
        url: url,
      } as MediaType;
    } catch (error: any) {
      logger.error(
        "Failed to upload product ingredient image to cloud storage",
        {
          error: error.message,
          fileName: file.originalname,
          stack: error.stack,
        }
      );

      logger.warn(
        "Product ingredient will be created without image due to upload failure. Please check DigitalOcean Spaces configuration."
      );
      return null;
    }
  }

  private async deleteImage(image?: { url?: string } | null): Promise<void> {
    if (!image?.url) {
      return;
    }

    try {
      await fileStorageService.deleteFileByUrl(image.url);
    } catch (error) {
      logger.warn("Failed to delete product ingredient image", {
        url: image.url,
        error,
      });
    }
  }

  /**
   * Create a new product ingredient (admin only)
   */
  createIngredient = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const requesterId = req.user?._id;
      const { name, description, products, isActive } = req.body;

      if (!name || !name.en) {
        throw new AppError("Name (English) is required", 400);
      }

      // Products is optional, default to empty array
      const productsArray = products && Array.isArray(products) ? products : [];

      // Validate product IDs if products are provided
      const productIds: mongoose.Types.ObjectId[] = [];
      if (productsArray.length > 0) {
        for (const id of productsArray) {
          if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new AppError(`Invalid product ID: ${id}`, 400);
          }
          productIds.push(new mongoose.Types.ObjectId(id));
        }

        // Verify products exist
        const existingProducts = await Products.find({
          _id: { $in: productIds },
          isDeleted: false,
        });

        if (existingProducts.length !== productIds.length) {
          throw new AppError("One or more products not found", 404);
        }
      }

      await this.assertNameUnique(name.en);

      let imageData = null;
      if (req.file) {
        const uploadedImage = await this.uploadImage(req.file);
        if (uploadedImage) {
          imageData = uploadedImage;
        }
      }

      // Transform image type to match Mongoose enum (capitalized)
      const transformedImage = imageData
        ? {
            ...imageData,
            type: imageData.type === "image" ? "Image" : "Video",
          }
        : null;

      const ingredient = await ProductIngredients.create({
        name: name || {},
        description: description || {},
        products: productIds, // Will be empty array if no products provided
        image: transformedImage,
        isActive: isActive !== undefined ? isActive : true,
        createdBy: requesterId
          ? new mongoose.Types.ObjectId(requesterId)
          : undefined,
      });

      // Add ingredient ID to products' ingredients array
      if (productIds.length > 0) {
        // Get ingredient ID - handle both _id and id properties
        let ingredientId: mongoose.Types.ObjectId;

        if (ingredient._id) {
          ingredientId =
            ingredient._id instanceof mongoose.Types.ObjectId
              ? ingredient._id
              : new mongoose.Types.ObjectId(ingredient._id.toString());
        } else if ((ingredient as any).id) {
          ingredientId = new mongoose.Types.ObjectId((ingredient as any).id);
        } else {
          logger.error("Ingredient ID not found after creation", {
            ingredient: ingredient.toObject
              ? ingredient.toObject()
              : ingredient,
          });
          throw new AppError("Failed to get ingredient ID after creation", 500);
        }

        // Add ingredient ID to all associated products
        await this.addIngredientIdToProducts(ingredientId, productIds);
      }

      res.status(201).json({
        success: true,
        message: "Product ingredient created successfully",
        data: { ingredient },
      });
    }
  );

  /**
   * List all product ingredients with pagination + filters
   */
  listIngredients = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { search, isActive } = req.query;

      const filters: FilterQuery<IProductIngredient> = {
        isDeleted: { $ne: true },
      };

      if (typeof isActive === "boolean") {
        filters.isActive = isActive;
      }

      if (typeof search === "string" && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        filters.$or = [
          { "name.en": regex },
          { "name.nl": regex },
          { "name.de": regex },
          { "name.fr": regex },
          { "name.es": regex },
          { "description.en": regex },
          { "description.nl": regex },
          { "description.de": regex },
          { "description.fr": regex },
          { "description.es": regex },
        ];
      }

      const [ingredients, total] = await Promise.all([
        ProductIngredients.find(filters)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        ProductIngredients.countDocuments(filters),
      ]);

      // Enrich with product count (products array length)
      const enriched = ingredients.map((ingredient) => ({
        ...ingredient,
        linkedProductCount: ingredient.products?.length || 0,
      }));

      const pagination = getPaginationMeta(page, limit, total);

      res.status(200).json({
        success: true,
        message: "Product ingredients retrieved successfully",
        data: enriched,
        pagination,
      });
    }
  );

  /**
   * Get a single ingredient by id (with linked product count)
   */
  getIngredientById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const ingredient = await ProductIngredients.findOne({
        _id: id,
        isDeleted: { $ne: true },
      }).lean();

      if (!ingredient) {
        throw new AppError("Product ingredient not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Product ingredient retrieved successfully",
        data: {
          ingredient: {
            ...ingredient,
            linkedProductCount: ingredient.products?.length || 0,
          },
        },
      });
    }
  );

  /**
   * Update ingredient details
   */
  updateIngredient = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const requesterId = req.user?._id;
      const { name, description, products, isActive } = req.body;

      const existing = await ProductIngredients.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!existing) {
        throw new AppError("Product ingredient not found", 404);
      }

      // Handle name update - merge with existing if provided
      const existingEnglishName = existing.name?.en;
      let finalName = existing.name || {};
      if (name) {
        // Check if English name is being changed
        const newEnglishName = name.en;

        if (newEnglishName && newEnglishName !== existingEnglishName) {
          await this.assertNameUnique(newEnglishName, id);
        }

        // Merge name fields
        finalName = {
          ...finalName,
          ...name,
        };
      }

      // Handle description update - merge with existing if provided
      let finalDescription = existing.description || {};
      if (description !== undefined) {
        finalDescription = {
          ...finalDescription,
          ...description,
        };
      }

      // Validate products if provided
      const oldProductIds = existing.products || [];
      let productIds = oldProductIds;
      if (products && Array.isArray(products)) {
        if (products.length === 0) {
          throw new AppError("At least one product must be selected", 400);
        }

        productIds = products.map((productId: string) => {
          if (!mongoose.Types.ObjectId.isValid(productId)) {
            throw new AppError(`Invalid product ID: ${productId}`, 400);
          }
          return new mongoose.Types.ObjectId(productId);
        });

        // Verify products exist
        const existingProducts = await Products.find({
          _id: { $in: productIds },
          isDeleted: false,
        });

        if (existingProducts.length !== productIds.length) {
          throw new AppError("One or more products not found", 404);
        }
      }

      const ingredientId = new mongoose.Types.ObjectId(id);

      // Handle image upload
      let imageData = existing.image;
      if (req.file) {
        try {
          const uploadedImage = await this.uploadImage(req.file);
          if (uploadedImage) {
            // Delete old image if exists
            if (existing.image) {
              await this.deleteImage(existing.image);
            }
            imageData = uploadedImage;
          }
        } catch (error: any) {
          logger.error(
            "Error uploading product ingredient image during update",
            {
              error: error.message,
              fileName: req.file.originalname,
            }
          );
          // Continue with update even if image upload fails
        }
      }

      // Transform image type to match Mongoose enum (capitalized) if imageData changed
      const transformedImage =
        imageData && imageData !== existing.image
          ? {
              ...imageData,
              type: imageData.type === "image" ? "Image" : "Video",
            }
          : imageData;

      const updateData: any = {};
      if (name !== undefined) updateData.name = finalName;
      if (description !== undefined) updateData.description = finalDescription;
      if (products !== undefined) updateData.products = productIds;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (imageData !== undefined) updateData.image = transformedImage;
      updateData.updatedBy = requesterId
        ? new mongoose.Types.ObjectId(requesterId)
        : undefined;

      const updated = await ProductIngredients.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).lean();

      // Update products' ingredients array if products changed
      if (products && Array.isArray(products)) {
        await this.updateIngredientIdInProducts(
          ingredientId,
          oldProductIds,
          productIds
        );
      }

      res.status(200).json({
        success: true,
        message: "Product ingredient updated successfully",
        data: { ingredient: updated },
      });
    }
  );

  /**
   * Soft delete ingredient
   */
  deleteIngredient = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const requesterId = req.user?._id;

      const ingredient = await ProductIngredients.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!ingredient) {
        throw new AppError("Product ingredient not found", 404);
      }

      // Delete image if exists
      if (ingredient.image) {
        await this.deleteImage(ingredient.image);
      }

      // Remove ingredient ID from all products' ingredients array
      const productIds = ingredient.products || [];
      if (productIds.length > 0) {
        // Get ingredient ID - handle both _id and id properties, ensure proper ObjectId conversion
        let ingredientId: mongoose.Types.ObjectId;

        if (ingredient._id) {
          ingredientId =
            ingredient._id instanceof mongoose.Types.ObjectId
              ? ingredient._id
              : new mongoose.Types.ObjectId(ingredient._id.toString());
        } else if ((ingredient as any).id) {
          ingredientId = new mongoose.Types.ObjectId((ingredient as any).id);
        } else {
          // Use the id from params as fallback
          ingredientId = new mongoose.Types.ObjectId(id);
        }

        logger.info(
          `Removing ingredient ID ${ingredientId} from ${productIds.length} products`
        );
        await this.removeIngredientIdFromProducts(ingredientId, productIds);
      }

      await ProductIngredients.findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: requesterId
            ? new mongoose.Types.ObjectId(requesterId)
            : undefined,
        },
        { new: true }
      );

      res.status(200).json({
        success: true,
        message: "Product ingredient deleted successfully",
      });
    }
  );

  private async assertNameUnique(englishName: string, excludeId?: string) {
    if (!englishName || englishName.trim() === "") {
      return; // Skip check if name is empty
    }

    // Escape special regex characters in the name
    const escapedName = englishName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const query: FilterQuery<IProductIngredient> = {
      "name.en": { $regex: new RegExp(`^${escapedName}$`, "i") },
      isDeleted: { $ne: true },
    };

    if (excludeId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const exists = await ProductIngredients.findOne(query).lean();

    if (exists) {
      throw new AppError(
        `Ingredient with name "${englishName}" already exists. Please use a different name.`,
        409
      );
    }
  }
}

export const adminProductIngredientController =
  new AdminProductIngredientController();
