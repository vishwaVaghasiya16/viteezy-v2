import { Router } from "express";
import { staffController } from "../controllers/staffController";
import { authenticate, authorize } from "../middleware/auth";
import { validateJoi, validateParams } from "@/middleware/joiValidation";
import {
  createStaffSchema,
  updateStaffSchema,
  staffIdParamSchema,
} from "../validation/staffValidation";
import { UserRole } from "@/models/enums";

const router = Router();

// All staff routes require authentication + Admin role
router.use(authenticate);
router.use(authorize(UserRole.ADMIN));

// POST /api/v1/admin/staff
router.post(
  "/",
  validateJoi(createStaffSchema),
  staffController.createStaff
);

// GET /api/v1/admin/staff
router.get(
  "/",
  staffController.listStaff
);

// PATCH /api/v1/admin/staff/:id
router.patch(
  "/:id",
  validateParams(staffIdParamSchema),
  validateJoi(updateStaffSchema),
  staffController.updateStaff
);

// DELETE /api/v1/admin/staff/:id
router.delete(
  "/:id",
  validateParams(staffIdParamSchema),
  staffController.deleteStaff
);

export default router;
