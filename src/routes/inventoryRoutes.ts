import { Router } from "express";
import { inventoryController } from "../controllers/inventoryController";
import { skuController } from "../controllers/skuController";
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
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  inventoryController.getDashboard.bind(inventoryController)
);

// ─── LOW STOCK 

// GET /api/inventory/low-stock
router.get(
  "/low-stock",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  inventoryController.getLowStock.bind(inventoryController)
);

// POST /api/inventory/low-stock/check  (manual admin trigger)
router.post(
  "/low-stock/check",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  inventoryController.runLowStockCheck.bind(inventoryController)
);

// ─── INVENTORY LIST 
// GET /api/inventory/list
router.get(
  "/list",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  validateQuery(inventoryFilterSchema),
  inventoryController.getInventoryList.bind(inventoryController)
);

// ─── STOCK VIEWS 

// GET /api/inventory/sku/:skuId
router.get(
  "/sku/:skuId",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  validateParams(skuIdParamSchema),
  inventoryController.getStockBySku.bind(inventoryController)
);

// GET /api/inventory/location/:locationId
router.get(
  "/location/:locationId",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  validateParams(locationIdParamSchema),
  inventoryController.getStockByLocation.bind(inventoryController)
);

// ─── THRESHOLD 

// PATCH /api/inventory/:skuId/:locationId/threshold
router.patch(
  "/:skuId/:locationId/threshold",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  validate(updateThresholdRequestSchema),
  inventoryController.updateThreshold.bind(inventoryController)
);

// ─── SKU CRUD 

// POST /api/inventory/skus
router.post(
  "/skus",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  validateJoi(createSkuSchema),
  skuController.createSku.bind(skuController)
);

// GET /api/inventory/skus
router.get(
  "/skus",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  validateQuery(skuFilterSchema),
  skuController.listSkus.bind(skuController)
);

// GET /api/inventory/skus/:skuId
router.get(
  "/skus/:skuId",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  validateParams(skuParamSchema),
  skuController.getOneSku.bind(skuController)
);

// PATCH /api/inventory/skus/:skuId
router.patch(
  "/skus/:skuId",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  validate(updateSkuRequestSchema),
  skuController.updateSku.bind(skuController)
);

// DELETE /api/inventory/skus/:skuId
router.delete(
  "/skus/:skuId",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  validateParams(skuParamSchema),
  skuController.removeSku.bind(skuController)
);

export default router;