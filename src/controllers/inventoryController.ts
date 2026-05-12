import { Request, Response, NextFunction } from "express";
import { inventoryService } from "../services/inventory.service";
import { alertService } from "../services/alert.service";
import { Skus } from "@/models/inventory";
import {
  InventoryFilterDto,
  UpdateThresholdDto,
  CreateSkuDto,
  UpdateSkuDto,
  SkuFilterDto,
} from "../types/inventory.types";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

/**
 * InventoryController
 * Covers: dashboard, stock views, low-stock, threshold update, SKU CRUD
 */

class InventoryController {
  // ── DASHBOARD ─────────────────────────────────────────────────────────────

  // GET /api/inventory/dashboard
  async getDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await inventoryService.getDashboard();
      res.apiSuccess(data, "Inventory dashboard retrieved successfully");
    }
    catch (error) {
      next(error)
    }
  }

  // ── STOCK VIEWS ───────────────────────────────────────────────────────────

  // GET /api/inventory/sku/:skuId
  async getStockBySku(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await inventoryService.getStockBySku(req.params.skuId);
      res.apiSuccess(data, "SKU stock details retrieved successfully");
    }
    catch (error) {
      next(error)
    }
  }

  // GET /api/inventory/location/:locationId
  async getStockByLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await inventoryService.getStockByLocation(
        req.params.locationId
      );
      res.apiSuccess(data, "Location stock details retrieved successfully");
    } catch (error: any) {
      next(error)
    }
  }

  // GET /api/inventory/list
  async getInventoryList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters: InventoryFilterDto = req.query as any;
      const { data, pagination } = await inventoryService.getInventoryList(filters);
      res.apiPaginated(data, pagination, "Inventory list retrieved successfully");
    }
    catch (error) {
      next(error)
    }
  }

  // ── LOW STOCK ─────────────────────────────────────────────────────────────

  // GET /api/inventory/low-stock
  async getLowStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await inventoryService.getLowStockItems();
      res.apiSuccess(
        { count: data.length, data },
        "Low stock items retrieved successfully"
      );
    }
    catch (error) {
      next(error)
    }
  }

  // POST /api/inventory/low-stock/check  (manual admin trigger)
  async runLowStockCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alerts = await alertService.checkAllLowStock();
      res.apiSuccess(
        { count: alerts.length, data: alerts },
        `Low stock check complete. ${alerts.length} alert(s) found.`
      );
    } catch (error) {
      next(error)
    }
  }
  // ── THRESHOLD ─────────────────────────────────────────────────────────────

  // PATCH /api/inventory/:skuId/:locationId/threshold
  async updateThreshold(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: UpdateThresholdDto = req.body;
      const { skuId, locationId } = req.params;
      const updatedBy = req.user?.id || req.userId;

      if (!updatedBy) throw new AppError("Unauthorized", 401);

      const data = await inventoryService.updateThreshold(
        skuId,
        locationId,
        dto,
        updatedBy
      );

      res.apiSuccess(data, "Low stock threshold updated successfully");
    }
    catch (error) {
      next(error)
    }
  }

  }

export const inventoryController = new InventoryController();