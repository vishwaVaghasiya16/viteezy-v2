import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { upload, handleMulterError } from "@/middleware/upload";
import { adminIngredientController } from "@/controllers/adminIngredientController";
import {
  createIngredientSchema,
  updateIngredientSchema,
  ingredientIdParamsSchema,
  updateIngredientStatusSchema,
  getIngredientsSchema,
} from "@/validation/adminIngredientValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/ingredients
 * @desc Create a new ingredient
 * @access Admin
 * @contentType multipart/form-data
 */
router.post(
  "/",
  handleMulterError(upload.single("image"), "image"),
  validateJoi(createIngredientSchema),
  adminIngredientController.createIngredient
);

/**
 * @route GET /api/v1/admin/ingredients
 * @desc Get paginated list of all ingredients (Admin view)
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [search] - Search by name or description
 * @query {Boolean} [isActive] - Filter by active status
 */
router.get(
  "/",
  validateQuery(getIngredientsSchema),
  adminIngredientController.getIngredients
);

/**
 * @route GET /api/v1/admin/ingredients/:id
 * @desc Get ingredient by ID
 * @access Admin
 * @param {String} id - Ingredient ID (MongoDB ObjectId)
 */
router.get(
  "/:id",
  validateParams(ingredientIdParamsSchema),
  adminIngredientController.getIngredientById
);

/**
 * @route PUT /api/v1/admin/ingredients/:id
 * @desc Update ingredient
 * @access Admin
 * @contentType multipart/form-data
 */
router.put(
  "/:id",
  handleMulterError(upload.single("image"), "image"),
  validateParams(ingredientIdParamsSchema),
  validateJoi(updateIngredientSchema),
  adminIngredientController.updateIngredient
);

/**
 * @route PATCH /api/v1/admin/ingredients/:id/status
 * @desc Update ingredient status (enable/disable)
 * @access Admin
 * @param {String} id - Ingredient ID (MongoDB ObjectId)
 * @body {Boolean} isActive - Active status (true/false)
 */
router.patch(
  "/:id/status",
  validateParams(ingredientIdParamsSchema),
  validateJoi(updateIngredientStatusSchema),
  adminIngredientController.updateIngredientStatus
);

/**
 * @route DELETE /api/v1/admin/ingredients/:id
 * @desc Delete ingredient (soft delete)
 * @access Admin
 * @param {String} id - Ingredient ID (MongoDB ObjectId)
 * @note Deletes image from cloud storage if exists
 */
router.delete(
  "/:id",
  validateParams(ingredientIdParamsSchema),
  adminIngredientController.deleteIngredient
);

export default router;
