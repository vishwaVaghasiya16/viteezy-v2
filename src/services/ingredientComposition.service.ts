import mongoose from "mongoose";
import { IngredientComposition, IIngredientComposition } from "../models/commerce/ingredientComposition.model";
import { Products } from "../models/commerce/products.model";
import { ProductIngredients } from "../models/commerce/productIngredients.model";
import { AppError } from "../utils/AppError";

export class IngredientCompositionService {
  /**
   * Create a new ingredient composition
   */
  static async createComposition(
    compositionData: Partial<IIngredientComposition>,
    userId: string
  ): Promise<IIngredientComposition> {
    const { product, ingredient, quantity, driPercentage } = compositionData;

    // Validate product exists
    const productExists = await Products.findById(product);
    if (!productExists) {
      throw new AppError("Product not found", 404);
    }

    // Validate ingredient exists
    const ingredientExists = await ProductIngredients.findById(ingredient);
    if (!ingredientExists) {
      throw new AppError("Ingredient not found", 404);
    }

    // Check if composition already exists for this product-ingredient combination
    const existingComposition = await IngredientComposition.findOne({
      product,
      ingredient,
      isDeleted: false,
    });

    if (existingComposition) {
      throw new AppError(
        "Ingredient composition already exists for this product",
        409
      );
    }

    // Validate DRI percentage
    this.validateDriPercentage(driPercentage);

    const composition = new IngredientComposition({
      ...compositionData,
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    return await composition.save();
  }

  /**
   * Get ingredient composition by ID
   */
  static async getCompositionById(id: string): Promise<IIngredientComposition> {
    const composition = await IngredientComposition.findById(id)
      .populate("product", "title slug")
      .populate("ingredient", "name scientificName")
      .where({ isDeleted: false });

    if (!composition) {
      throw new AppError("Ingredient composition not found", 404);
    }

    return composition;
  }

  /**
   * Get all ingredient compositions with optional filtering
   */
  static async getAllCompositions(
    page: number = 1,
    limit: number = 10,
    productId?: string,
    ingredientId?: string
  ): Promise<{
    compositions: IIngredientComposition[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const filter: any = { isDeleted: false };

    if (productId) {
      filter.product = new mongoose.Types.ObjectId(productId);
    }

    if (ingredientId) {
      filter.ingredient = new mongoose.Types.ObjectId(ingredientId);
    }

    const compositions = await IngredientComposition.find(filter)
      .populate("product", "title slug")
      .populate("ingredient", "name scientificName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await IngredientComposition.countDocuments(filter);

    return {
      compositions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get ingredient compositions by product ID
   */
  static async getCompositionsByProduct(
    productId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    compositions: IIngredientComposition[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return await this.getAllCompositions(page, limit, productId);
  }

  /**
   * Update ingredient composition
   */
  static async updateComposition(
    id: string,
    updateData: Partial<IIngredientComposition>,
    userId: string
  ): Promise<IIngredientComposition> {
    const { quantity, driPercentage, product, ingredient } = updateData;

    // Validate DRI percentage if provided
    if (driPercentage !== undefined) {
      this.validateDriPercentage(driPercentage);
    }

    // Validate product exists if provided
    if (product) {
      const productExists = await Products.findById(product);
      if (!productExists) {
        throw new AppError("Product not found", 404);
      }
    }

    // Validate ingredient exists if provided
    if (ingredient) {
      const ingredientExists = await ProductIngredients.findById(ingredient);
      if (!ingredientExists) {
        throw new AppError("Ingredient not found", 404);
      }
    }

    // Check for duplicate if changing product or ingredient
    if (product || ingredient) {
      const existingComposition = await IngredientComposition.findOne({
        _id: { $ne: new mongoose.Types.ObjectId(id) },
        ...(product && { product }),
        ...(ingredient && { ingredient }),
        isDeleted: false,
      });

      if (existingComposition) {
        throw new AppError(
          "Ingredient composition already exists for this product-ingredient combination",
          409
        );
      }
    }

    const composition = await IngredientComposition.findByIdAndUpdate(
      id,
      {
        ...updateData,
        updatedBy: new mongoose.Types.ObjectId(userId),
      },
      { new: true, runValidators: true }
    )
      .populate("product", "title slug")
      .populate("ingredient", "name scientificName")
      .where({ isDeleted: false });

    if (!composition) {
      throw new AppError("Ingredient composition not found", 404);
    }

    return composition;
  }

  /**
   * Delete ingredient composition (soft delete)
   */
  static async deleteComposition(
    id: string,
    userId: string
  ): Promise<IIngredientComposition> {
    const composition = await IngredientComposition.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: new mongoose.Types.ObjectId(userId),
      },
      { new: true }
    ).where({ isDeleted: false });

    if (!composition) {
      throw new AppError("Ingredient composition not found", 404);
    }

    return composition;
  }

  /**
   * Bulk update compositions for a product
   */
  static async bulkUpdateCompositions(
    productId: string,
    compositions: Array<{
      ingredient: string;
      quantity: number;
      driPercentage: number | string;
    }>,
    userId?: string
  ): Promise<IIngredientComposition[]> {
    // Validate product exists
    const productExists = await Products.findById(productId);
    if (!productExists) {
      throw new AppError("Product not found", 404);
    }

    const results: IIngredientComposition[] = [];

    const userObjectId =
      userId && mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : null;

    for (const comp of compositions) {
      const { ingredient, quantity, driPercentage } = comp;

      // Validate ingredient exists
      const ingredientExists = await ProductIngredients.findById(ingredient);
      if (!ingredientExists) {
        throw new AppError(`Ingredient with ID ${ingredient} not found`, 404);
      }

      // Validate DRI percentage
      this.validateDriPercentage(driPercentage);

      // Check if composition exists
      const existingComposition = await IngredientComposition.findOne({
        product: new mongoose.Types.ObjectId(productId),
        ingredient: new mongoose.Types.ObjectId(ingredient),
      });

      if (existingComposition) {
        const updatePayload: Record<string, any> = {
          quantity,
          driPercentage,
          // Revive soft-deleted composition instead of creating duplicate
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        };
        if (userObjectId) {
          updatePayload.updatedBy = userObjectId;
        }

        // Update existing
        const updated = await IngredientComposition.findByIdAndUpdate(
          existingComposition._id,
          updatePayload,
          { new: true, runValidators: true }
        )
          .populate("product", "title slug")
          .populate("ingredient", "name scientificName");

        results.push(updated!);
      } else {
        const createPayload: Record<string, any> = {
          product: new mongoose.Types.ObjectId(productId),
          ingredient: new mongoose.Types.ObjectId(ingredient),
          quantity,
          driPercentage,
        };
        if (userObjectId) {
          createPayload.createdBy = userObjectId;
        }

        // Create new
        const created = await IngredientComposition.create(createPayload);

        const populated = await IngredientComposition.findById(created._id)
          .populate("product", "title slug")
          .populate("ingredient", "name scientificName");

        results.push(populated!);
      }
    }

    return results;
  }

  /**
   * Validate DRI percentage value
   */
  private static validateDriPercentage(value: any): void {
    if (typeof value === 'number') {
      if (value < 0) {
        throw new AppError("DRI percentage must be a positive number", 400);
      }
    } else if (typeof value === 'string') {
      if (value !== '*' && value !== '**') {
        throw new AppError('DRI percentage string must be "*" or "**"', 400);
      }
    } else {
      throw new AppError('DRI percentage must be a number, "*", or "**"', 400);
    }
  }
}
