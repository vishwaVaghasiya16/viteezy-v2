import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { ProductTestimonials } from "@/models/cms";
import { Products } from "@/models/commerce";
import { fileStorageService } from "@/services/fileStorageService";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
  };
  file?: Express.Multer.File;
  files?:
    | {
        [fieldname: string]: Express.Multer.File[];
      }
    | Express.Multer.File[];
}

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
      const isVisibleOnHomepage: boolean =
        req.body.isVisibleOnHomepage || false;
      const isFeatured: boolean = req.body.isFeatured || false;
      const isVisibleInLP: boolean = req.body.isVisibleInLP || false;
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

      // Get files from multer.fields
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Validate video file exists
      if (!files || !files.video || files.video.length === 0) {
        throw new AppError("Video file is required", 400);
      }

      // Parallelize: Verify products exist AND upload files simultaneously
      const [existingProducts, videoUrl, videoThumbnail] = await Promise.all([
        // Verify products exist
        Products.find({
          _id: { $in: productIds },
          isDeleted: { $ne: true },
        }).lean(),

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

      // Create testimonial with populated products in one go
      const testimonial = await ProductTestimonials.create({
        videoUrl,
        videoThumbnail,
        products: productIds,
        isVisibleOnHomepage,
        isFeatured,
        isVisibleInLP,
        isActive: true,
        displayOrder,
        metadata,
        createdBy: req.user?._id,
        updatedBy: req.user?._id,
      });

      // Populate products in parallel with response preparation
      await testimonial.populate("products", "title slug productImage");

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

      // Search functionality (if needed in future)
      if (search) {
        // Can search by product names or metadata - optimize with select to only get _id
        const productIds = await Products.find({
          title: { $regex: search, $options: "i" },
          isDeleted: { $ne: true },
        })
          .select("_id")
          .lean()
          .distinct("_id");

        query.$or = [{ products: { $in: productIds } }];
      }

      // Use Promise.all for parallel execution
      const [testimonials, total] = await Promise.all([
        ProductTestimonials.find(query)
          .populate("products", "title slug productImage")
          .populate("createdBy", "name email")
          .populate("updatedBy", "name email")
          .sort({ displayOrder: 1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        ProductTestimonials.countDocuments(query),
      ]);

      res.apiSuccess(
        {
          testimonials,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
        "Product testimonials retrieved successfully"
      );
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

      const testimonial = await ProductTestimonials.findOne({
        _id: id,
        isDeleted: { $ne: true },
      })
        .populate("products", "title slug productImage")
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email");

      if (!testimonial) {
        throw new AppError("Product testimonial not found", 404);
      }

      res.apiSuccess(
        { testimonial },
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
        isVisibleOnHomepage,
        isFeatured,
        isVisibleInLP,
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

      if (displayOrder !== undefined) {
        testimonial.displayOrder = displayOrder;
      }

      if (metadata !== undefined) {
        testimonial.metadata = metadata;
      }

      testimonial.updatedBy = new mongoose.Types.ObjectId(req.user?._id || "");

      await testimonial.save();

      await testimonial.populate("products", "title slug productImage");

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
