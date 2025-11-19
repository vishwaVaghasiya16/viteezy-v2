import { Router } from "express";
import { ProductController } from "../controllers/productController";
import { validateProduct, createProductSchema, updateProductSchema } from "../validation/productValidation";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Public routes (no authentication required)
router.get("/", ProductController.getAllProducts);
router.get("/stats", ProductController.getProductStats);
router.get("/:id", ProductController.getProductById);
router.get("/slug/:slug", ProductController.getProductBySlug);

// Protected routes (authentication required)
router.use(authMiddleware); // Apply auth middleware to all routes below

router.post("/", validateProduct(createProductSchema), ProductController.createProduct);
router.put("/:id", validateProduct(updateProductSchema), ProductController.updateProduct);
router.delete("/:id", ProductController.deleteProduct);

export default router;

