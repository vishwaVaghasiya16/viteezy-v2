import { Router } from "express";
import { authMiddleware, authorize } from "../middleware/auth";
import { adminFamilyController } from "../controllers/adminFamilyController";
import { validateJoi } from "../middleware/joiValidation";
import Joi from "joi";

const router = Router();

// Apply authentication and admin middleware to all routes
router.use(authMiddleware);
router.use(authorize("Admin"));

// Validation schemas
const enforceLimitsSchema = Joi.object({
  action: Joi.string().valid("ENFORCE_MAX_LIMIT").required(),
  mainMemberId: Joi.string().optional().pattern(/^[0-9a-fA-F]{24}$/)
});

const detachMemberSchema = Joi.object({
  userId: Joi.string().required().pattern(/^[0-9a-fA-F]{24}$/),
  reason: Joi.string().required().min(1).max(500)
});

// Routes
/**
 * @route GET /api/v1/admin/families
 * @desc Get all families with pagination
 * @access Admin
 */
router.get("/", adminFamilyController.getAllFamilies);

/**
 * @route DELETE /api/v1/admin/families/:mainMemberId/sub-members/:subMemberId
 * @desc Remove sub-member from family
 * @access Admin
 */
router.delete("/:mainMemberId/sub-members/:subMemberId", adminFamilyController.removeSubMember);

/**
 * @route POST /api/v1/admin/families/enforce-limits
 * @desc Enforce max sub-member limit across all families
 * @access Admin
 */
router.post("/enforce-limits", 
  validateJoi(enforceLimitsSchema),
  adminFamilyController.enforceMaxLimits
);

/**
 * @route POST /api/v1/admin/families/detach
 * @desc Detach member from family
 * @access Admin
 */
router.post("/detach",
  validateJoi(detachMemberSchema),
  adminFamilyController.detachMember
);

export default router;
