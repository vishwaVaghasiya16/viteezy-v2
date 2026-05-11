import { Router } from "express";
import { movementController } from "../controllers/movementController";
import { validate, validateJoi, validateParams, validateQuery } from "@/middleware/joiValidation";
import {
  createMovementSchema,
  movementFilterSchema,
  movementIdParamSchema,
} from "../validation/movementValidation";
import { authenticate, authorize } from "../middleware/auth";
import { UserRole } from "@/models/enums";

const router = Router();

// All movement routes require authentication
router.use(authenticate);

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// POST /api/movements
// Staff records a new stock movement (purchase, transfer, sale, return, adjustment)
router.post(
  "/",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  validateJoi(createMovementSchema),
  movementController.create.bind(movementController) 
);

// GET /api/movements
// List movements with filters (skuId, locationId, movementType, dateRange etc.)
router.get(
  "/",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  validateQuery(movementFilterSchema),
  movementController.list.bind(movementController)
);

// GET /api/movements/:movementId
// Get a single movement record with all references populated
router.get(
  "/:movementId",
  authorize(UserRole.ADMIN, UserRole.INVENTORY_MANAGER),
  validateParams(movementIdParamSchema),
  movementController.getOne.bind(movementController)
);

export default router;