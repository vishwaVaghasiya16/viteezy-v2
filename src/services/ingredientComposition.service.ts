import { IngredientCompositions, IIngredientComposition, DriValueType } from "../models/commerce/ingredientComposition.model";
import { Products } from "../models/commerce/products.model";
import { ProductIngredients } from "../models/commerce/productIngredients.model";
import { logger } from "../utils/logger";
import mongoose from "mongoose";

export interface CreateIngredientCompositionInput {
  product: string;
  ingredient: string;
  quantity: number;
  driPercentage: DriValueType;
  createdBy?: string;
}

export interface UpdateIngredientCompositionInput {
  quantity?: number;
  driPercentage?: DriValueType;
  updatedBy?: string;
}

export interface IngredientCompositionQuery {
  product?: string;
  ingredient?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class IngredientCompositionService {
  /**
   * Helper method to extract only English language from I18n fields
   */
  private extractEnglishLanguage(obj: any): any {
    const result = { ...obj };
    
    // Handle ingredient name and description
    if (result.ingredient) {
      if (result.ingredient.name && typeof result.ingredient.name === 'object') {
        result.ingredient.name = result.ingredient.name.en || result.ingredient.name;
      }
      if (result.ingredient.description && typeof result.ingredient.description === 'object') {
        result.ingredient.description = result.ingredient.description.en || result.ingredient.description;
      }
    }
    
    // Handle product title
    if (result.product) {
      if (result.product.title && typeof result.product.title === 'object') {
        result.product.title = result.product.title.en || result.product.title;
      }
    }
    
    return result;
  }

  /**
   * Create a new ingredient composition for a product
   */
  async createIngredientComposition(data: CreateIngredientCompositionInput): Promise<IIngredientComposition> {
    try {
      // Validate product exists
      const product = await Products.findById(data.product);
      if (!product) {
        throw new Error("Product not found");
      }

      // Validate ingredient exists
      const ingredient = await ProductIngredients.findById(data.ingredient);
      if (!ingredient) {
        throw new Error("Ingredient not found");
      }

      // Check if composition already exists for this product-ingredient combination
      const existingComposition = await IngredientCompositions.findOne({
        product: data.product,
        ingredient: data.ingredient,
        isDeleted: { $ne: true }
      });

      if (existingComposition) {
        throw new Error("Ingredient composition already exists for this product-ingredient combination");
      }

      // Create new composition
      const composition = new IngredientCompositions({
        ...data,
        product: new mongoose.Types.ObjectId(data.product),
        ingredient: new mongoose.Types.ObjectId(data.ingredient),
        createdBy: data.createdBy ? new mongoose.Types.ObjectId(data.createdBy) : undefined,
      });

      await composition.save();
      logger.info(`Ingredient composition created: ${(composition._id as mongoose.Types.ObjectId).toString()}`);

      // Populate the composition for response
      return await this.getCompositionById((composition._id as mongoose.Types.ObjectId).toString());
    } catch (error) {
      logger.error("Error creating ingredient composition:", error);
      throw error;
    }
  }

  /**
   * Get ingredient composition by ID
   */
  async getCompositionById(id: string): Promise<IIngredientComposition> {
    try {
      const composition = await IngredientCompositions.findById(id)
        .populate('product', 'title slug')
        .populate('ingredient', 'name')
        .exec();

      if (!composition || composition.isDeleted) {
        throw new Error("Ingredient composition not found");
      }

      // Transform to return only English language
      return this.extractEnglishLanguage(composition.toObject());
    } catch (error) {
      logger.error("Error getting ingredient composition by ID:", error);
      throw error;
    }
  }

  /**
   * Get all ingredient compositions with filtering and pagination
   */
  async getIngredientCompositions(query: IngredientCompositionQuery = {}) {
    try {
      const {
        product,
        ingredient,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = query;

      // Build filter
      const filter: any = { isDeleted: { $ne: true } };
      
      if (product) {
        filter.product = new mongoose.Types.ObjectId(product);
      }
      
      if (ingredient) {
        filter.ingredient = new mongoose.Types.ObjectId(ingredient);
      }

      // Build sort
      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute query
      const [compositions, total] = await Promise.all([
        IngredientCompositions.find(filter)
          .populate('product', 'title slug')
          .populate('ingredient', 'name')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        IngredientCompositions.countDocuments(filter)
      ]);

      // Transform to return only English language
      const transformedCompositions = compositions.map(comp => {
        return this.extractEnglishLanguage(comp.toObject());
      });

      return {
        data: transformedCompositions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Error getting ingredient compositions:", error);
      throw error;
    }
  }

  /**
   * Get all ingredient compositions for a specific product
   */
  async getCompositionsByProduct(productId: string): Promise<IIngredientComposition[]> {
    try {
      const compositions = await IngredientCompositions.find({
        product: new mongoose.Types.ObjectId(productId),
        isDeleted: { $ne: true }
      })
        .populate('ingredient', 'name description image')
        .sort({ createdAt: 1 })
        .exec();

      // Transform to return only English language
      return compositions.map(comp => {
        return this.extractEnglishLanguage(comp.toObject());
      });
    } catch (error) {
      logger.error("Error getting compositions by product:", error);
      throw error;
    }
  }

  /**
   * Update an ingredient composition
   */
  async updateIngredientComposition(
    id: string,
    data: UpdateIngredientCompositionInput
  ): Promise<IIngredientComposition> {
    try {
      const composition = await IngredientCompositions.findById(id);
      if (!composition || composition.isDeleted) {
        throw new Error("Ingredient composition not found");
      }

      // Update fields
      if (data.quantity !== undefined) {
        composition.quantity = data.quantity;
      }
      
      if (data.driPercentage !== undefined) {
        composition.driPercentage = data.driPercentage;
      }
      
      if (data.updatedBy) {
        composition.updatedBy = new mongoose.Types.ObjectId(data.updatedBy);
      }

      await composition.save();
      logger.info(`Ingredient composition updated: ${(composition._id as mongoose.Types.ObjectId).toString()}`);

      return await this.getCompositionById((composition._id as mongoose.Types.ObjectId).toString());
    } catch (error) {
      logger.error("Error updating ingredient composition:", error);
      throw error;
    }
  }

  /**
   * Delete an ingredient composition (soft delete)
   */
  async deleteIngredientComposition(id: string, deletedBy?: string): Promise<void> {
    try {
      const composition = await IngredientCompositions.findById(id);
      if (!composition || composition.isDeleted) {
        throw new Error("Ingredient composition not found");
      }

      composition.isDeleted = true;
      composition.deletedAt = new Date();
      
      if (deletedBy) {
        composition.deletedBy = new mongoose.Types.ObjectId(deletedBy);
      }

      await composition.save();
      logger.info(`Ingredient composition deleted: ${(composition._id as mongoose.Types.ObjectId).toString()}`);
    } catch (error) {
      logger.error("Error deleting ingredient composition:", error);
      throw error;
    }
  }

  /**
   * Bulk update ingredient compositions for a product
   */
  async bulkUpdateCompositions(
    productId: string,
    compositions: Array<{
      ingredient: string;
      quantity: number;
      driPercentage: DriValueType;
    }>,
    updatedBy?: string
  ): Promise<IIngredientComposition[]> {
    try {
      // Validate product exists
      const product = await Products.findById(productId);
      if (!product) {
        throw new Error("Product not found");
      }

      const results: IIngredientComposition[] = [];

      for (const compData of compositions) {
        // Validate ingredient exists
        const ingredient = await ProductIngredients.findById(compData.ingredient);
        if (!ingredient) {
          throw new Error(`Ingredient not found: ${compData.ingredient}`);
        }

        // Check if composition exists
        const existing = await IngredientCompositions.findOne({
          product: new mongoose.Types.ObjectId(productId),
          ingredient: new mongoose.Types.ObjectId(compData.ingredient),
          isDeleted: { $ne: true }
        });

        if (existing) {
          // Update existing
          existing.quantity = compData.quantity;
          existing.driPercentage = compData.driPercentage;
          if (updatedBy) {
            existing.updatedBy = new mongoose.Types.ObjectId(updatedBy);
          }
          await existing.save();
          results.push(await this.getCompositionById((existing._id as mongoose.Types.ObjectId).toString()));
        } else {
          // Create new
          const newComposition = await this.createIngredientComposition({
            product: productId,
            ingredient: compData.ingredient,
            quantity: compData.quantity,
            driPercentage: compData.driPercentage,
            createdBy: updatedBy
          });
          results.push(newComposition);
        }
      }

      logger.info(`Bulk updated ${results.length} ingredient compositions for product: ${productId}`);
      return results;
    } catch (error) {
      logger.error("Error bulk updating ingredient compositions:", error);
      throw error;
    }
  }

  /**
   * Validate DRI value format
   */
  validateDriValue(value: any): DriValueType {
    if (typeof value === 'number' && value >= 0) {
      return value;
    }
    if (value === "*" || value === "**") {
      return value;
    }
    throw new Error("DRI percentage must be a positive number, '*', or '**'");
  }
}

export const ingredientCompositionService = new IngredientCompositionService();
