import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { getPaginationMeta } from "@/utils/pagination";
import { ProductTestimonials } from "@/models/cms";
import { Products } from "@/models/commerce";
import { fileStorageService } from "@/services/fileStorageService";
import {
  I18nStringType,
  I18nTextType,
  DEFAULT_LANGUAGE,
  SupportedLanguage,
} from "@/models/common.model";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
    language?: string;
  };
  file?: Express.Multer.File;
  files?:
    | {
        [fieldname: string]: Express.Multer.File[];
      }
    | Express.Multer.File[];
}

/**
 * Get user language from request: query param (lang) > user profile > default English
 */
const getUserLanguage = (req: AuthenticatedRequest): SupportedLanguage => {
  const queryLang = req.query?.lang;
  if (typeof queryLang === "string" && ["en", "nl", "de", "fr", "es"].includes(queryLang)) {
    return queryLang as SupportedLanguage;
  }
  if (req.user?.language) {
    const languageMap: Record<string, SupportedLanguage> = {
      English: "en",
      Spanish: "es",
      French: "fr",
      Dutch: "nl",
      German: "de",
    };
    return languageMap[req.user.language] || DEFAULT_LANGUAGE;
  }
  return DEFAULT_LANGUAGE;
};

/**
 * Get translated string from I18nStringType
 */
const getTranslatedString = (
  i18nString: I18nStringType | string | undefined,
  lang: SupportedLanguage
): string => {
  if (!i18nString) return "";

  // If it's already a plain string, return it
  if (typeof i18nString === "string") {
    return i18nString;
  }

  // Return translated string or fallback to English
  return i18nString[lang] || i18nString.en || "";
};

/**
 * Transform product titles to single language
 */
const transformProductsToLanguage = (products: any[], lang: SupportedLanguage): any[] => {
  return products.map((product: any) => {
    // Get clean product object without Mongoose internals
    const cleanProduct = product.toObject ? product.toObject() : product;
    
    return {
      _id: cleanProduct._id,
      title: getTranslatedString(cleanProduct.title, lang),
      slug: cleanProduct.slug,
      productImage: cleanProduct.productImage,
    };
  });
};

class AdminProductTestimonialController {
  /**
   * Create a new product testimonial
   * @route POST /api/v1/admin/product-testimonials
   * @access Admin
   */
  createTestimonial = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      // Data is already parsed by middleware, but we'll extract for clarity
      const products: string[] = req.body.products || [];
      const productsForDetailsPage: string[] = req.body.productsForDetailsPage || [];
      const isVisibleOnHomepage: boolean =
        req.body.isVisibleOnHomepage || false;
      const isFeatured: boolean = req.body.isFeatured || false;
      const isVisibleInLP: boolean = req.body.isVisibleInLP || false;
      const isActive: boolean = req.body.isActive ?? true;
      const displayOrder: number = req.body.displayOrder || 0;
      const metadata: any = req.body.metadata || {};

      // Validate products array (should already be validated by Joi, but keeping as defensive check)
      if (!products || !Array.isArray(products) || products.length === 0) {
        throw new AppError("At least one product is required", 400);
      }

      // Validate product IDs
      const productIds = products.map((id: string) => {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new AppError(`Invalid product ID: ${id}`, 400);
        }
        return new mongoose.Types.ObjectId(id);
      });

      // Validate productsForDetailsPage IDs if provided
      let productsForDetailsPageIds: mongoose.Types.ObjectId[] = [];
      if (productsForDetailsPage && productsForDetailsPage.length > 0) {
        productsForDetailsPageIds = productsForDetailsPage.map((id: string) => {
          if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new AppError(`Invalid product ID for details page: ${id}`, 400);
          }
          return new mongoose.Types.ObjectId(id);
        });
      }

      // Get files from multer.fields
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Validate video file exists
      if (!files || !files.video || files.video.length === 0) {
        throw new AppError("Video file is required", 400);
      }

      // Parallelize: Verify products exist AND upload files simultaneously
      const [existingProducts, existingProductsForDetailsPage, videoUrl, videoThumbnail] = await Promise.all([
        // Verify products exist
        Products.find({
          _id: { $in: productIds },
          isDeleted: { $ne: true },
        }).lean(),

        // Verify productsForDetailsPage exist if provided
        productsForDetailsPageIds.length > 0
          ? Products.find({
              _id: { $in: productsForDetailsPageIds },
              isDeleted: { $ne: true },
            }).lean()
          : Promise.resolve([]),

        // Upload video (required)
        fileStorageService
          .uploadFile("testimonials", files.video[0])
          .catch((error: any) => {
            throw new AppError(`Failed to upload video: ${error.message}`, 500);
          }),

        // Upload thumbnail if provided (optional) - use null if not provided
        files.thumbnail && files.thumbnail.length > 0
          ? fileStorageService
              .uploadFile("testimonials/thumbnails", files.thumbnail[0])
              .catch((error: any) => {
                throw new AppError(
                  `Failed to upload thumbnail: ${error.message}`,
                  500
                );
              })
          : Promise.resolve(null),
      ]);

      // Validate products exist
      if (existingProducts.length !== productIds.length) {
        throw new AppError("One or more products not found", 404);
      }

      // Validate productsForDetailsPage exist if provided
      if (productsForDetailsPageIds.length > 0 && existingProductsForDetailsPage.length !== productsForDetailsPageIds.length) {
        throw new AppError("One or more products for details page not found", 404);
      }

      // Create testimonial with populated products in one go
      const testimonial = await ProductTestimonials.create({
        videoUrl,
        videoThumbnail,
        products: productIds,
        productsForDetailsPage: productsForDetailsPageIds.length > 0 ? productsForDetailsPageIds : undefined,
        isVisibleOnHomepage,
        isFeatured,
        isVisibleInLP,
        isActive,
        displayOrder,
        metadata,
        createdBy: req.user?._id,
        updatedBy: req.user?._id,
      });

      // Populate products in parallel with response preparation
      await testimonial.populate("products", "title slug productImage");
      await testimonial.populate("productsForDetailsPage", "title slug productImage");

      res.apiSuccess(
        { testimonial },
        "Product testimonial created successfully"
      );
    }
  );

  /**
   * Get all product testimonials
   * @route GET /api/v1/admin/product-testimonials
   * @access Admin
   */
  getAllTestimonials = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const {
        page = "1",
        limit = "10",
        search,
        isVisibleOnHomepage,
        isActive,
      } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        isVisibleOnHomepage?: string | boolean;
        isActive?: string | boolean;
      };

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      // Get user language for translation
      const userLang = getUserLanguage(req);

      // Build query
      const query: any = { isDeleted: { $ne: true } };

      if (isVisibleOnHomepage !== undefined) {
        const value: string | boolean = isVisibleOnHomepage;
        query.isVisibleOnHomepage =
          value === "true" || value === true || value === "1";
      }

      if (isActive !== undefined) {
        const value: string | boolean = isActive;
        query.isActive = value === "true" || value === true || value === "1";
      }

      // Search functionality - search in product titles (handle both I18n objects and plain strings)
      if (search) {
        const searchRegex = { $regex: search, $options: "i" };
        
        // Find products that match the search term
        const matchingProducts = await Products.find({
          $or: [
            { title: searchRegex }, // Plain string match
            { "title.en": searchRegex }, // I18n English match
            { "title.nl": searchRegex }, // I18n Dutch match
            { "title.de": searchRegex }, // I18n German match
            { "title.fr": searchRegex }, // I18n French match
            { "title.es": searchRegex }, // I18n Spanish match
          ],
          isDeleted: { $ne: true },
        })
          .select("_id")
          .lean()
          .distinct("_id");

        // Also search in metadata if it contains searchable text
        const testimonialsWithMetadataMatch = await ProductTestimonials.find({
          isDeleted: { $ne: true },
          $or: [
            { "metadata.customerName": searchRegex },
            { "metadata.testimonialText": searchRegex },
            { "metadata.rating": searchRegex },
          ],
        })
          .select("_id")
          .lean()
          .distinct("_id");

        query.$or = [
          { products: { $in: matchingProducts } },
          { _id: { $in: testimonialsWithMetadataMatch } },
        ];
      }

      // Use Promise.all for parallel execution
      const [testimonials, total] = await Promise.all([
        ProductTestimonials.find(query)
          .populate("products", "title slug productImage")
          .populate("productsForDetailsPage", "title slug productImage")
          .populate("createdBy", "name email")
          .populate("updatedBy", "name email")
          .sort({ displayOrder: 1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        ProductTestimonials.countDocuments(query),
      ]);

      // Transform product titles to single language
      const transformedTestimonials = testimonials.map((testimonial: any) => ({
        ...testimonial,
        products: testimonial.products ? transformProductsToLanguage(testimonial.products, userLang) : [],
        productsForDetailsPage: testimonial.productsForDetailsPage 
          ? transformProductsToLanguage(testimonial.productsForDetailsPage, userLang) 
          : [],
      }));

      const paginationMeta = getPaginationMeta(pageNum, limitNum, total);
      res.status(200).json({
        success: true,
        message: "Product testimonials retrieved successfully",
        data: {
          testimonials: transformedTestimonials,
        },
        pagination: paginationMeta,
      });
    }
  );

  /**
   * Get testimonial by ID
   * @route GET /api/v1/admin/product-testimonials/:id
   * @access Admin
   */
  getTestimonialById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid testimonial ID", 400);
      }

      // Get user language for translation
      const userLang = getUserLanguage(req);

      const testimonial = await ProductTestimonials.findOne({
        _id: id,
        isDeleted: { $ne: true },
      })
        .populate("products", "title slug productImage")
        .populate("productsForDetailsPage", "title slug productImage")
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email");

      if (!testimonial) {
        throw new AppError("Product testimonial not found", 404);
      }

      // Transform product titles to single language
      const transformedTestimonial = {
        ...testimonial.toObject(),
        products: testimonial.products ? transformProductsToLanguage(testimonial.products, userLang) : [],
        productsForDetailsPage: testimonial.productsForDetailsPage 
          ? transformProductsToLanguage(testimonial.productsForDetailsPage, userLang) 
          : [],
      };

      res.apiSuccess(
        { testimonial: transformedTestimonial },
        "Product testimonial retrieved successfully"
      );
    }
  );

  /**
   * Update product testimonial
   * @route PUT /api/v1/admin/product-testimonials/:id
   * @access Admin
   */
  updateTestimonial = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const {
        products,
        productsForDetailsPage,
        isVisibleOnHomepage,
        isFeatured,
        isVisibleInLP,
        isActive,
        displayOrder,
        metadata,
      } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid testimonial ID", 400);
      }

      const testimonial = await ProductTestimonials.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!testimonial) {
        throw new AppError("Product testimonial not found", 404);
      }

      // Get files from multer.fields
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Prepare parallel operations
      const parallelOperations: Promise<any>[] = [];

      // Handle products update if provided
      if (products) {
        if (!Array.isArray(products) || products.length === 0) {
          throw new AppError("At least one product is required", 400);
        }

        const productIds = products.map((productId: string) => {
          if (!mongoose.Types.ObjectId.isValid(productId)) {
            throw new AppError(`Invalid product ID: ${productId}`, 400);
          }
          return new mongoose.Types.ObjectId(productId);
        });

        // Verify products exist (add to parallel operations)
        parallelOperations.push(
          Products.find({
            _id: { $in: productIds },
            isDeleted: { $ne: true },
          })
            .lean()
            .then((existingProducts) => {
              if (existingProducts.length !== productIds.length) {
                throw new AppError("One or more products not found", 404);
              }
              testimonial.products = productIds;
              return existingProducts;
            })
        );
      }

      // Handle productsForDetailsPage update if provided
      if (productsForDetailsPage !== undefined) {
        if (Array.isArray(productsForDetailsPage) && productsForDetailsPage.length > 0) {
          const productsForDetailsPageIds = productsForDetailsPage.map((productId: string) => {
            if (!mongoose.Types.ObjectId.isValid(productId)) {
              throw new AppError(`Invalid product ID for details page: ${productId}`, 400);
            }
            return new mongoose.Types.ObjectId(productId);
          });

          // Verify productsForDetailsPage exist (add to parallel operations)
          parallelOperations.push(
            Products.find({
              _id: { $in: productsForDetailsPageIds },
              isDeleted: { $ne: true },
            })
              .lean()
              .then((existingProducts) => {
                if (existingProducts.length !== productsForDetailsPageIds.length) {
                  throw new AppError("One or more products for details page not found", 404);
                }
                testimonial.productsForDetailsPage = productsForDetailsPageIds;
                return existingProducts;
              })
          );
        } else {
          // If empty array is provided, set to empty array
          testimonial.productsForDetailsPage = [];
        }
      }

      // Handle video upload if new video provided
      if (files && files.video && files.video.length > 0) {
        parallelOperations.push(
          fileStorageService
            .uploadFile("testimonials", files.video[0])
            .then((newVideoUrl) => {
              testimonial.videoUrl = newVideoUrl;
            })
            .catch((error: any) => {
              throw new AppError(
                `Failed to upload video: ${error.message}`,
                500
              );
            })
        );
      }

      // Handle thumbnail upload if new thumbnail provided
      if (files && files.thumbnail && files.thumbnail.length > 0) {
        parallelOperations.push(
          fileStorageService
            .uploadFile("testimonials/thumbnails", files.thumbnail[0])
            .then((newThumbnailUrl) => {
              testimonial.videoThumbnail = newThumbnailUrl;
            })
            .catch((error: any) => {
              throw new AppError(
                `Failed to upload thumbnail: ${error.message}`,
                500
              );
            })
        );
      }

      // Execute all parallel operations
      if (parallelOperations.length > 0) {
        await Promise.all(parallelOperations);
      }

      // Update other fields
      if (isVisibleOnHomepage !== undefined) {
        testimonial.isVisibleOnHomepage = isVisibleOnHomepage;
      }

      if (isFeatured !== undefined) {
        testimonial.isFeatured = isFeatured;
      }

      if (isVisibleInLP !== undefined) {
        testimonial.isVisibleInLP = isVisibleInLP;
      }

      if (isActive !== undefined) {
        testimonial.isActive = isActive;
      }

      if (displayOrder !== undefined) {
        testimonial.displayOrder = displayOrder;
      }

      if (metadata !== undefined) {
        testimonial.metadata = metadata;
      }

      testimonial.updatedBy = new mongoose.Types.ObjectId(req.user?._id || "");

      await testimonial.save();

      await testimonial.populate("products", "title slug productImage");
      await testimonial.populate("productsForDetailsPage", "title slug productImage");

      res.apiSuccess(
        { testimonial },
        "Product testimonial updated successfully"
      );
    }
  );

  /**
   * Delete product testimonial (soft delete)
   * @route DELETE /api/v1/admin/product-testimonials/:id
   * @access Admin
   */
  deleteTestimonial = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid testimonial ID", 400);
      }

      const testimonial = await ProductTestimonials.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!testimonial) {
        throw new AppError("Product testimonial not found", 404);
      }

      // Soft delete
      testimonial.isDeleted = true;
      testimonial.deletedAt = new Date();
      testimonial.updatedBy = new mongoose.Types.ObjectId(req.user?._id || "");

      await testimonial.save();

      res.apiSuccess(null, "Product testimonial deleted successfully");
    }
  );

  /**
   * Toggle testimonial active status
   * @route PATCH /api/v1/admin/product-testimonials/:id/status
   * @access Admin
   */
  toggleStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid testimonial ID", 400);
      }

      const testimonial = await ProductTestimonials.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!testimonial) {
        throw new AppError("Product testimonial not found", 404);
      }

      testimonial.isActive = !testimonial.isActive;
      testimonial.updatedBy = new mongoose.Types.ObjectId(req.user?._id || "");

      await testimonial.save();

      res.apiSuccess(
        { testimonial },
        `Testimonial ${
          testimonial.isActive ? "activated" : "deactivated"
        } successfully`
      );
    }
  );
}

export const adminProductTestimonialController =
  new AdminProductTestimonialController();
