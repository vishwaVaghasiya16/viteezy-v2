import { Router } from "express";
import { CartController } from "../controllers/cartController";
import {
  validateCart,
  addCartItemSchema,
  updateCartItemSchema,
} from "../validation/cartValidation";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// All cart routes require authentication
router.use(authMiddleware);

// Get user's cart
router.get("/", CartController.getCart);

// Add item to cart
router.post("/items", validateCart(addCartItemSchema), CartController.addItem);

// Update cart item quantity (by productId)
router.put(
  "/items",
  validateCart(updateCartItemSchema),
  CartController.updateItem
);

// Remove item from cart (by productId)
router.delete("/items", CartController.removeItem);

// Clear cart
router.delete("/", CartController.clearCart);

// Validate cart (includes membership discount calculation)
router.post("/validate", CartController.validateCart);

// Get suggested products (non-included products) for cart
router.get("/suggested-products", CartController.getSuggestedProducts);

export default router;
