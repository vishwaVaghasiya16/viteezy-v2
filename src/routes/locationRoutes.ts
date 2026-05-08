import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import { validateJoi, validateParams, validateQuery } from "@/middleware/joiValidation";
import {locationController} from "@/controllers/locationController";
import {
  createLocationSchema,
  updateLocationSchema,
  locationIdParamSchema,
  locationFilterSchema,
} from "@/validation/locationValidation";

const router = Router();

// All routes require authentication and Admin role
router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/locations
 * @desc Create a new location
 * @access Admin
 */
router.post("/", validateJoi(createLocationSchema), locationController.create);

/**
 * @route GET /api/v1/admin/locations
 * @desc List all locations with filters and pagination
 * @access Admin
 * @query {String} [type] - Filter by location type
 * @query {Boolean} [isActive] - Filter by active status
 * @query {String} [name] - Search by name (case-insensitive)
 * @query {Number} [page] - Page number
 * @query {Number} [limit] - Items per page
 */
router.get("/", validateQuery(locationFilterSchema), locationController.list);

/**
 * @route GET /api/v1/admin/locations/:id
 * @desc Get location by ID
 * @access Admin
 */
router.get("/:locationId", validateParams(locationIdParamSchema), locationController.getOne);

/**
 * @route PUT /api/v1/admin/locations/:id
 * @desc Update location
 * @access Admin
 */
router.put(
  "/:locationId",
  validateParams(locationIdParamSchema),
  validateJoi(updateLocationSchema),
  locationController.update
);

/**
 * @route DELETE /api/v1/admin/locations/:id
 * @desc Soft delete location (blocks if inventory stock exists)
 * @access Admin
 */
router.delete("/:locationId", validateParams(locationIdParamSchema), locationController.remove);

export default router;
