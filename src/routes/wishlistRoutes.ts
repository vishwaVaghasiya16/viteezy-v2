import { Router } from "express";
import { wishlistController } from "@/controllers/wishlistController";
import { authenticate } from "@/middleware/auth";
import { validateRequest } from "@/middleware/validation";
import {
  addWishlistItemValidation,
  updateWishlistItemValidation,
  wishlistItemParamValidation,
  wishlistPaginationValidation,
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
  addWishlistItemValidation,
  validateRequest,
  wishlistController.addItem
);

/**
 * Get paginated wishlist items (optionally with product details)
 */
router.get(
  "/",
  wishlistPaginationValidation,
  validateRequest,
  wishlistController.getItems
);

/**
 * Update wishlist item notes for current user
 */
router.put(
  "/:id",
  updateWishlistItemValidation,
  validateRequest,
  wishlistController.updateItem
);

/**
 * Remove a product from the current user's wishlist
 */
router.delete(
  "/:id",
  wishlistItemParamValidation,
  validateRequest,
  wishlistController.removeItem
);

export default router;
