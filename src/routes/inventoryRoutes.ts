import { Router } from "express";
import { inventoryController } from "../controllers/inventoryController";
import { validate, validateJoi, validateParams, validateQuery } from "@/middleware/joiValidation";
import {
  inventoryFilterSchema,
  updateThresholdRequestSchema,
  locationIdParamSchema,
  skuIdParamSchema,
} from "../validation/inventoryValidation";
import {
  createSkuSchema,
  updateSkuSchema,
  skuFilterSchema,
  skuIdParamSchema as skuParamSchema,
  updateSkuRequestSchema,
} from "../validation/skuValidation";
import { authenticate, authorize } from "../middleware/auth";
import { UserRole } from "@/models/enums";

const router = Router();

// All inventory routes require authentication
router.use(authenticate);

// ─── DASHBOARD 

// GET /api/inventory/dashboard
router.get(
  "/dashboard",
  authorize(UserRole.ADMIN, UserRole.MODERATOR),
  inventoryController.getDashboard.bind(inventoryController)
);

// ─── LOW STOCK 

// GET /api/inventory/low-stock
router.get(
  "/low-stock",
  authorize(UserRole.ADMIN, UserRole.MODERATOR),
  inventoryController.getLowStock.bind(inventoryController)
);

// POST /api/inventory/low-stock/check  (manual admin trigger)
router.post(
  "/low-stock/check",
  authorize(UserRole.ADMIN),
  inventoryController.runLowStockCheck.bind(inventoryController)
);

// ─── INVENTORY LIST 
// GET /api/inventory/list
router.get(
  "/list",
  authorize(UserRole.ADMIN, UserRole.MODERATOR),
  validateQuery(inventoryFilterSchema),
  inventoryController.getInventoryList.bind(inventoryController)
);

// ─── STOCK VIEWS 

// GET /api/inventory/sku/:skuId
router.get(
  "/sku/:skuId",
  authorize(UserRole.ADMIN, UserRole.MODERATOR),
  validateParams(skuIdParamSchema),
  inventoryController.getStockBySku.bind(inventoryController)
);

// GET /api/inventory/location/:locationId
router.get(
  "/location/:locationId",
  authorize(UserRole.ADMIN, UserRole.MODERATOR),
  validateParams(locationIdParamSchema),
  inventoryController.getStockByLocation.bind(inventoryController)
);

// ─── THRESHOLD 

// PATCH /api/inventory/:skuId/:locationId/threshold
router.patch(
  "/:skuId/:locationId/threshold",
  authorize(UserRole.ADMIN),
  validate(updateThresholdRequestSchema),
  inventoryController.updateThreshold.bind(inventoryController)
);

// ─── SKU CRUD 

// POST /api/inventory/skus
router.post(
  "/skus",
  authorize(UserRole.ADMIN),
  validateJoi(createSkuSchema),
  inventoryController.createSku.bind(inventoryController)
);

// GET /api/inventory/skus
router.get(
  "/skus",
  authorize(UserRole.ADMIN, UserRole.MODERATOR),
  validateQuery(skuFilterSchema),
  inventoryController.listSkus.bind(inventoryController)
);

// GET /api/inventory/skus/:skuId
router.get(
  "/skus/:skuId",
  authorize(UserRole.ADMIN, UserRole.MODERATOR),
  validateParams(skuParamSchema),
  inventoryController.getOneSku.bind(inventoryController)
);

// PATCH /api/inventory/skus/:skuId
router.patch(
  "/skus/:skuId",
  authorize(UserRole.ADMIN),
  validate(updateSkuRequestSchema),
  inventoryController.updateSku.bind(inventoryController)
);

// DELETE /api/inventory/skus/:skuId
router.delete(
  "/skus/:skuId",
  authorize(UserRole.ADMIN),
  validateParams(skuParamSchema),
  inventoryController.removeSku.bind(inventoryController)
);

export default router;