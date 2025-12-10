/**
 * @fileoverview Admin Ingredient Controller
 * @description Controller for admin ingredient operations (CRUD)
 * @module controllers/adminIngredientController
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Ingredients } from "@/models/commerce";
import { MediaType } from "@/models/common.model";
import { fileStorageService } from "@/services/fileStorageService";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

class AdminIngredientController {
  private async uploadImage(
    file?: Express.Multer.File
  ): Promise<MediaType | null> {
    if (!file) {
      return null;
    }

    try {
      const url = await fileStorageService.uploadFile("ingredients", file);
      return {
        type: "image",
        url: url,
      } as MediaType;
    } catch (error: any) {
      logger.error("Failed to upload ingredient image to cloud storage", {
        error: error.message,
        fileName: file.originalname,
        stack: error.stack,
      });

      logger.warn(
        "Ingredient will be created without image due to upload failure. Please check DigitalOcean Spaces configuration."
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
      logger.warn("Failed to delete ingredient image", {
        url: image.url,
        error,
      });
    }
  }

  /**
   * Create a new ingredient
   */
  createIngredient = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const { name, description, isActive = true } = req.body;

      if (!name?.en) {
        throw new AppError("Name (English) is required", 400);
      }

      let imageData = null;
      if (req.file) {
        const uploadedImage = await this.uploadImage(req.file);
        if (uploadedImage) {
          imageData = uploadedImage;
        }
      }

      const ingredient = await Ingredients.create({
        name,
        description: description || {},
        isActive,
        image: imageData,
        createdBy: requesterId,
      });

      res.apiCreated({ ingredient }, "Ingredient created successfully");
    }
  );

  /**
   * Get paginated list of all ingredients (Admin view)
   */
  getIngredients = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { isActive, search } = req.query as {
        isActive?: boolean | string;
        search?: string;
      };

      const filter: Record<string, any> = {
        isDeleted: false,
      };

      // Handle isActive filter (can be boolean or string "true"/"false")
      if (isActive !== undefined) {
        if (typeof isActive === "string") {
          filter.isActive = isActive === "true";
        } else {
          filter.isActive = Boolean(isActive);
        }
      }

      if (search) {
        filter.$or = [
          { "name.en": { $regex: search, $options: "i" } },
          { "name.nl": { $regex: search, $options: "i" } },
          { "description.en": { $regex: search, $options: "i" } },
          { "description.nl": { $regex: search, $options: "i" } },
          { scientificName: { $regex: search, $options: "i" } },
        ];
      }

      const sortOptions: Record<string, 1 | -1> = {
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      const [ingredients, total] = await Promise.all([
        Ingredients.find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Ingredients.countDocuments(filter),
      ]);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(
        ingredients,
        pagination,
        "Ingredients retrieved successfully"
      );
    }
  );

  /**
   * Get ingredient by ID
   */
  getIngredientById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const ingredient = await Ingredients.findOne({
        _id: id,
        isDeleted: false,
      }).lean();

      if (!ingredient) {
        throw new AppError("Ingredient not found", 404);
      }

      res.apiSuccess({ ingredient }, "Ingredient retrieved successfully");
    }
  );

  /**
   * Update ingredient
   */
  updateIngredient = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const ingredient = await Ingredients.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!ingredient) {
        throw new AppError("Ingredient not found", 404);
      }

      // Update fields if provided
      if (name) {
        ingredient.name = name;
      }

      if (description !== undefined) {
        ingredient.description = description;
      }

      if (isActive !== undefined) {
        ingredient.isActive = Boolean(isActive);
      }

      // Handle image upload
      if (req.file) {
        try {
          const uploadedImage = await this.uploadImage(req.file);
          if (uploadedImage) {
            // Delete old image if exists
            if (ingredient.image) {
              await this.deleteImage(ingredient.image);
            }
            ingredient.image = uploadedImage;
          }
        } catch (error: any) {
          logger.error("Error uploading ingredient image during update", {
            error: error.message,
            fileName: req.file.originalname,
          });
          // Continue with update even if image upload fails
        }
      }

      if (requesterId) {
        (ingredient as any).updatedBy = requesterId;
      }

      await ingredient.save();

      res.apiSuccess({ ingredient }, "Ingredient updated successfully");
    }
  );

  /**
   * Update ingredient status (enable/disable)
   */
  updateIngredientStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { isActive } = req.body as {
        isActive: boolean;
      };

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const ingredient = await Ingredients.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!ingredient) {
        throw new AppError("Ingredient not found", 404);
      }

      ingredient.isActive = Boolean(isActive);

      if (requesterId) {
        (ingredient as any).updatedBy = requesterId;
      }

      await ingredient.save();

      res.apiSuccess(
        { ingredient },
        `Ingredient ${isActive ? "enabled" : "disabled"} successfully`
      );
    }
  );

  /**
   * Delete ingredient (soft delete)
   */
  deleteIngredient = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const ingredient = await Ingredients.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!ingredient) {
        throw new AppError("Ingredient not found", 404);
      }

      // Delete image if exists
      if (ingredient.image) {
        await this.deleteImage(ingredient.image);
      }

      (ingredient as any).isDeleted = true;
      (ingredient as any).deletedAt = new Date();
      await ingredient.save();

      res.apiSuccess(null, "Ingredient deleted successfully");
    }
  );
}

export const adminIngredientController = new AdminIngredientController();
