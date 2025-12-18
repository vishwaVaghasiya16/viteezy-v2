import { Router } from "express";
import { wishlistController } from "@/controllers/wishlistController";
import { authenticate } from "@/middleware/auth";
import { validateJoi, validateQuery } from "@/middleware/joiValidation";
import {
  wishlistPaginationQuerySchema,
  toggleWishlistItemSchema,
} from "@/validation/wishlistValidation";

const router = Router();

router.use(authenticate);

/**
 * Get total count of wishlist items for current user
 */
router.get("/count", wishlistController.getCount);

/**
 * Toggle wishlist item - Add if not exists, Remove if exists
 * Single endpoint to manage add/remove operations
 */
router.put(
  "/toggle",
  validateJoi(toggleWishlistItemSchema),
  wishlistController.toggleItem
);

/**
 * Get paginated wishlist items (optionally with product details)
 */
router.get(
  "/",
  validateQuery(wishlistPaginationQuerySchema),
  wishlistController.getItems
);

export default router;
