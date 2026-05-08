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

// POST /api/inventory/movements
// Staff records a new stock movement (purchase, transfer, sale, return, adjustment)
router.post(
  "/",
  authorize(UserRole.ADMIN, UserRole.MODERATOR),
  validateJoi(createMovementSchema),
  movementController.create.bind(movementController)
);

// GET /api/inventory/movements
// List movements with filters (skuId, locationId, movementType, dateRange etc.)
router.get(
  "/",
  authorize(UserRole.ADMIN, UserRole.MODERATOR),
  validateQuery(movementFilterSchema),
  movementController.list.bind(movementController)
);

// GET /api/inventory/movements/:movementId
// Get a single movement record with all references populated
router.get(
  "/:movementId",
  authorize(UserRole.ADMIN, UserRole.MODERATOR),
  validateParams(movementIdParamSchema),
  movementController.getOne.bind(movementController)
);

export default router;