import { Products } from "../models/commerce/products.model";
import { ProductStatus, ProductVariant } from "../models/enums";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import mongoose from "mongoose";

interface CreateProductData {
  title: string;
  slug: string;
  description: string;
  productImage: string;
  benefits: string[];
  ingredients: string[];
  nutritionInfo: string;
  howToUse: string;
  status: ProductStatus;
  price: {
    currency: string;
    amount: number;
    taxRate: number;
  };
  variant: ProductVariant;
  hasStandupPouch: boolean;
  standupPouchPrices?: {
    oneTime: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    thirtyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    sixtyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    ninetyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    oneEightyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
  };
  createdBy?: mongoose.Types.ObjectId;
}

interface UpdateProductData {
  title?: string;
  slug?: string;
  description?: string;
  productImage?: string;
  benefits?: string[];
  ingredients?: string[];
  nutritionInfo?: string;
  howToUse?: string;
  status?: ProductStatus;
  price?: {
    currency: string;
    amount: number;
    taxRate: number;
  };
  variant?: ProductVariant;
  hasStandupPouch?: boolean;
  standupPouchPrices?: {
    oneTime: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    thirtyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    sixtyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    ninetyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    oneEightyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
  };
  updatedBy?: mongoose.Types.ObjectId;
}

class ProductService {
  /**
   * Create new product
   */
  async createProduct(data: CreateProductData): Promise<{ product: any; message: string }> {
    const { slug, hasStandupPouch, standupPouchPrices } = data;

    // Check if product with same slug already exists
    const existingProduct = await Products.findOne({ slug, isDeleted: false });
    if (existingProduct) {
      throw new AppError("Product with this slug already exists", 409);
    }

    // Validate standupPouchPrices if hasStandupPouch is true
    if (hasStandupPouch && !standupPouchPrices) {
      throw new AppError("standupPouchPrices is required when hasStandupPouch is true", 400);
    }

    // Create product
    const product = await Products.create(data);

    logger.info(`Product created successfully: ${product.slug}`);

    return {
      product: product.toObject(),
      message: "Product created successfully",
    };
  }

  /**
   * Get all products with pagination and filters
   */
  async getAllProducts(
    page: number,
    limit: number,
    skip: number,
    sort: Record<string, 1 | -1>,
    filters: {
      search?: string;
      status?: ProductStatus;
      variant?: ProductVariant;
      hasStandupPouch?: boolean;
    }
  ): Promise<{ products: any[]; total: number }> {
    const { search, status, variant, hasStandupPouch } = filters;

    // Build filter object
    const filter: any = { isDeleted: false };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (variant) {
      filter.variant = variant;
    }

    if (hasStandupPouch !== undefined) {
      filter.hasStandupPouch = hasStandupPouch;
    }

    // Get total count
    const total = await Products.countDocuments(filter);

    // Get products with pagination
    const products = await Products.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    return { products, total };
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<{ product: any }> {
    const product = await Products.findOne({
      _id: productId,
      isDeleted: false,
    }).lean();

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    return { product };
  }

  /**
   * Get product by slug
   */
  async getProductBySlug(slug: string): Promise<{ product: any }> {
    const product = await Products.findOne({
      slug,
      isDeleted: false,
    }).lean();

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    return { product };
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    data: UpdateProductData
  ): Promise<{ product: any; message: string }> {
    const { slug, hasStandupPouch, standupPouchPrices } = data;

    // Check if product exists
    const existingProduct = await Products.findOne({
      _id: productId,
      isDeleted: false,
    });

    if (!existingProduct) {
      throw new AppError("Product not found", 404);
    }

    // Check if slug is being changed and if new slug already exists
    if (slug && slug !== existingProduct.slug) {
      const slugExists = await Products.findOne({
        slug,
        _id: { $ne: productId },
        isDeleted: false,
      });

      if (slugExists) {
        throw new AppError("Product with this slug already exists", 409);
      }
    }

    // Validate standupPouchPrices if hasStandupPouch is true
    if (hasStandupPouch && !standupPouchPrices) {
      throw new AppError("standupPouchPrices is required when hasStandupPouch is true", 400);
    }

    // Update product
    const updatedProduct = await Products.findByIdAndUpdate(
      productId,
      { ...data, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedProduct) {
      throw new AppError("Product not found", 404);
    }

    logger.info(`Product updated successfully: ${updatedProduct.slug}`);

    return {
      product: updatedProduct,
      message: "Product updated successfully",
    };
  }

  /**
   * Delete product (soft delete)
   */
  async deleteProduct(productId: string): Promise<{ message: string }> {
    const product = await Products.findOne({
      _id: productId,
      isDeleted: false,
    });

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    // Soft delete
    await Products.findByIdAndUpdate(productId, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    logger.info(`Product deleted successfully: ${product.slug}`);

    return {
      message: "Product deleted successfully",
    };
  }

  /**
   * Get product statistics
   */
  async getProductStats(): Promise<{
    total: number;
    active: number;
    draft: number;
    hidden: number;
    sachets: number;
    standupPouch: number;
  }> {
    const [total, active, draft, hidden, sachets, standupPouch] = await Promise.all([
      Products.countDocuments({ isDeleted: false }),
      Products.countDocuments({ status: ProductStatus.ACTIVE, isDeleted: false }),
      Products.countDocuments({ status: ProductStatus.DRAFT, isDeleted: false }),
      Products.countDocuments({ status: ProductStatus.HIDDEN, isDeleted: false }),
      Products.countDocuments({ variant: ProductVariant.SACHETS, isDeleted: false }),
      Products.countDocuments({ variant: ProductVariant.STAND_UP_POUCH, isDeleted: false }),
    ]);

    return {
      total,
      active,
      draft,
      hidden,
      sachets,
      standupPouch,
    };
  }
}

export const productService = new ProductService();

