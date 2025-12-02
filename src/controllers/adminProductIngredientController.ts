import { Request, Response } from "express";
import mongoose, { FilterQuery } from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { ProductIngredients, Products } from "@/models/commerce";
import { generateSlug, generateUniqueSlug } from "@/utils/slug";
import { IProductIngredient } from "@/models/commerce/productIngredients.model";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

class AdminProductIngredientController {
  /**
   * Create a new product ingredient (admin only)
   */
  createIngredient = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const requesterId = req.user?._id;
      const { name, slug, description, benefits, precautions, isActive } =
        req.body;

      await this.assertNameUnique(name);
      const finalSlug = await this.resolveSlug(name, slug);

      const ingredient = await ProductIngredients.create({
        name,
        slug: finalSlug,
        description,
        benefits,
        precautions,
        isActive: isActive !== undefined ? isActive : true,
        createdBy: requesterId
          ? new mongoose.Types.ObjectId(requesterId)
          : undefined,
      });

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
          { name: regex },
          { slug: regex },
          { description: regex },
          { benefits: regex },
          { precautions: regex },
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

      const ingredientIds = ingredients.map((item) => item._id);

      const linkedCounts =
        ingredientIds.length > 0
          ? await Products.aggregate<{
              _id: mongoose.Types.ObjectId;
              count: number;
            }>([
              {
                $match: {
                  isDeleted: false,
                  productIngredients: { $in: ingredientIds },
                },
              },
              { $unwind: "$productIngredients" },
              {
                $match: {
                  productIngredients: { $in: ingredientIds },
                },
              },
              {
                $group: {
                  _id: "$productIngredients",
                  count: { $sum: 1 },
                },
              },
            ])
          : [];

      const countMap = linkedCounts.reduce<Record<string, number>>(
        (acc, item) => {
          acc[item._id.toString()] = item.count;
          return acc;
        },
        {}
      );

      const enriched = ingredients.map((ingredient) => ({
        ...ingredient,
        linkedProductCount: countMap[ingredient._id.toString()] || 0,
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

      const linkedProductCount = await Products.countDocuments({
        isDeleted: false,
        productIngredients: ingredient._id,
      });

      res.status(200).json({
        success: true,
        message: "Product ingredient retrieved successfully",
        data: {
          ingredient: {
            ...ingredient,
            linkedProductCount,
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
      const { name, slug } = req.body;

      const existing = await ProductIngredients.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!existing) {
        throw new AppError("Product ingredient not found", 404);
      }

      if (name && name !== existing.name) {
        await this.assertNameUnique(name, id);
      }

      let finalSlug = existing.slug;
      if (slug && slug !== existing.slug) {
        finalSlug = await this.resolveSlug(name ?? existing.name, slug, id);
      } else if (!slug && name && name !== existing.name) {
        finalSlug = await this.resolveSlug(name, undefined, id);
      }

      const updated = await ProductIngredients.findByIdAndUpdate(
        id,
        {
          ...req.body,
          slug: finalSlug,
          updatedBy: requesterId
            ? new mongoose.Types.ObjectId(requesterId)
            : undefined,
        },
        { new: true, runValidators: true }
      ).lean();

      res.status(200).json({
        success: true,
        message: "Product ingredient updated successfully",
        data: { ingredient: updated },
      });
    }
  );

  /**
   * Soft delete ingredient (only if not linked to products)
   */
  deleteIngredient = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const ingredient = await ProductIngredients.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!ingredient) {
        throw new AppError("Product ingredient not found", 404);
      }

      const isLinked = await Products.exists({
        isDeleted: false,
        productIngredients: ingredient._id,
      });

      if (isLinked) {
        throw new AppError(
          "Ingredient is linked with one or more products. Remove the link before deleting.",
          400
        );
      }

      await ProductIngredients.findByIdAndUpdate(id, {
        isDeleted: true,
        deletedAt: new Date(),
      });

      res.status(200).json({
        success: true,
        message: "Product ingredient deleted successfully",
      });
    }
  );

  private async assertNameUnique(name: string, excludeId?: string) {
    const query: FilterQuery<IProductIngredient> = {
      name: new RegExp(`^${name}$`, "i"),
      isDeleted: { $ne: true },
    };

    if (excludeId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const exists = await ProductIngredients.findOne(query).lean();

    if (exists) {
      throw new AppError("Ingredient with this name already exists", 409);
    }
  }

  private async resolveSlug(
    name: string,
    providedSlug?: string,
    excludeId?: string
  ): Promise<string> {
    const baseSlug = providedSlug?.trim() || generateSlug(name);
    const finalSlug = await generateUniqueSlug(
      baseSlug,
      async (slugToCheck: string) => {
        const query: FilterQuery<IProductIngredient> = {
          slug: slugToCheck,
          isDeleted: { $ne: true },
        };
        if (excludeId) {
          query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
        }
        const existing = await ProductIngredients.findOne(query).lean();
        return Boolean(existing);
      }
    );
    return finalSlug;
  }
}

export const adminProductIngredientController =
  new AdminProductIngredientController();
