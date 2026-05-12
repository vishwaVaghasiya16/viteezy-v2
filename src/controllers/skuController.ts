// ── SKU CRUD ──────────────────────────────────────────────────────────────
import { Skus } from "@/models/inventory/sku.model";
import { Request, Response, NextFunction } from "express";
import { CreateSkuDto, SkuFilterDto, UpdateSkuDto } from "../types/inventory.types";
import { AppError } from "@/utils/AppError";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

class SkuController {

  // POST /api/inventory/skus
  async createSku(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: CreateSkuDto = req.body;

      const existing = await Skus.findOne({
        skuCode: dto.skuCode.toUpperCase(),
        isDeleted: false,
      });

      if (existing) {
        throw new AppError(`SKU code "${dto.skuCode}" already exists`, 409);
      }

      const sku = await Skus.create({
        ...dto,
        skuCode: dto.skuCode.toUpperCase(),
        createdBy: req.user?.id || req.userId || null,
      });

      res.apiCreated(sku, "SKU created successfully");
    }
    catch (error) {
      next(error)
    }
  }

  // GET /api/inventory/skus
  async listSkus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { variantType, isActive, search, page = 1, limit = 20 }: SkuFilterDto =
        req.query as any;

      const filter: Record<string, any> = { isDeleted: false };
      if (variantType) filter.variantType = variantType;
      if (isActive !== undefined) filter.isActive = isActive;
      if (search) {
        filter.$or = [
          { skuCode: { $regex: search, $options: "i" } },
          { displayName: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [data, total] = await Promise.all([
        Skus.find(filter)
          .sort({ skuCode: 1 })
          .skip(skip)
          .limit(Number(limit))
          .populate("productId", "title slug productImage variant status")
          .lean(),
        Skus.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / Number(limit));

      res.apiPaginated(
        data,
        {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: totalPages,
        },
        "SKUs retrieved successfully"
      );
    }
    catch (error) {
      next(error)
    }
  }

  // GET /api/inventory/skus/:skuId
  async getOneSku(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sku = await Skus.findOne({
        _id: req.params.skuId,
        isDeleted: false,
      })
        .populate("productId", "title slug productImage variant status")
        .lean();

      if (!sku) throw new AppError("SKU not found", 404);

      res.apiSuccess(sku, "SKU details retrieved successfully");
    }
    catch (error) {
      next(error)
    }
  }

  // PATCH /api/inventory/skus/:skuId
  async updateSku(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: UpdateSkuDto = req.body;

      const sku = await Skus.findOneAndUpdate(
        { _id: req.params.skuId, isDeleted: false },
        { $set: { ...dto, updatedBy: req.user?.id || req.userId || null } },
        { new: true, runValidators: true }
      ).lean();

      if (!sku) throw new AppError("SKU not found", 404);

      res.apiSuccess(sku, "SKU updated successfully");
    }
    catch (error) {
      next(error)
    }
  }

  // DELETE /api/inventory/skus/:skuId  (soft delete)
  async removeSku(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sku = await Skus.findOneAndUpdate(
        { _id: req.params.skuId, isDeleted: false },
        {
          $set: {
            isDeleted: true,
            isActive: false,
            deletedAt: new Date(),
            updatedBy: req.user?.id || req.userId || null,
          },
        },
        { new: true }
      ).lean();

      if (!sku) throw new AppError("SKU not found", 404);

      res.apiSuccess(null, "SKU deleted successfully");
    }
    catch (error) {
      next(error)
    }
  }
}

export const skuController = new SkuController();