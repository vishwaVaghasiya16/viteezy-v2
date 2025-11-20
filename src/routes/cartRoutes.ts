import { Router } from "express";
import { CartController } from "../controllers/cartController";
import { validateCart, addCartItemSchema, updateCartItemSchema } from "../validation/cartValidation";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// All cart routes require authentication
router.use(authMiddleware);

// Get user's cart
router.get("/", CartController.getCart);

// Add item to cart
router.post("/items", validateCart(addCartItemSchema), CartController.addItem);

// Update cart item quantity
router.put("/items/:index", validateCart(updateCartItemSchema), CartController.updateItem);

// Remove item from cart
router.delete("/items/:index", CartController.removeItem);

// Clear cart
router.delete("/", CartController.clearCart);

export default router;

