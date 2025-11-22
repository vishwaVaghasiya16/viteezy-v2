import { Router } from "express";
import { wishlistController } from "@/controllers/wishlistController";
import { authenticate } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import {
  addWishlistItemSchema,
  updateWishlistItemBodySchema,
  wishlistItemParamsSchema,
  wishlistPaginationQuerySchema,
} from "@/validation/wishlistValidation";

const router = Router();

router.use(authenticate);

/**
 * Get total count of wishlist items for current user
 */
router.get("/count", wishlistController.getCount);

/**
 * Add a product to the current user's wishlist
 */
router.post(
  "/",
  validateJoi(addWishlistItemSchema),
  wishlistController.addItem
);

/**
 * Get paginated wishlist items (optionally with product details)
 */
router.get(
  "/",
  validateQuery(wishlistPaginationQuerySchema),
  wishlistController.getItems
);

/**
 * Update wishlist item notes for current user
 */
router.put(
  "/:id",
  validateParams(wishlistItemParamsSchema),
  validateJoi(updateWishlistItemBodySchema),
  wishlistController.updateItem
);

/**
 * Remove a product from the current user's wishlist
 */
router.delete(
  "/:id",
  validateParams(wishlistItemParamsSchema),
  wishlistController.removeItem
);

export default router;
