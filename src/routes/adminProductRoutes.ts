import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import { ProductController } from "@/controllers/productController";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route GET /api/v1/admin/products
 * @desc Get all products (active + inactive) with pagination and filters. Admin only.
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [search] - Search term
 * @query {Boolean} [status] - Filter by status (true = active, false = inactive). Omit to get all.
 * @query {String} [variant] - Filter by variant (e.g. SACHETS, STAND_UP_POUCH)
 * @query {Boolean} [hasStandupPouch] - Filter by hasStandupPouch
 * @query {String[]} [categories] - Filter by category slugs/ids
 * @query {String[]} [healthGoals] - Filter by health goals
 * @query {String[]} [ingredients] - Filter by ingredient names/ids
 * @query {String} [sortBy] - relevance | priceLowToHigh | priceHighToLow | rating | trending
 */
router.get("/", ProductController.getAllProductsForAdmin);

export default router;
