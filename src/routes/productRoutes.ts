import { Router } from "express";
import { ProductController } from "../controllers/productController";
import { validateProduct, createProductSchema, updateProductSchema } from "../validation/productValidation";
import { authMiddleware } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { parseProductFormData } from "../middleware/parseProductFormData";
import { handleProductImageUpload } from "../middleware/productImageUpload";

const router = Router();

// Public routes (no authentication required)
router.get("/", ProductController.getAllProducts);
router.get("/filters", ProductController.getFilterOptions);
router.get("/stats", ProductController.getProductStats);
router.get("/slug/:slug", ProductController.getProductBySlug);
router.get("/:id", ProductController.getProductById);

// Protected routes (authentication required)
router.use(authMiddleware); // Apply auth middleware to all routes below

router.post(
  "/",
  upload.single("productImage"),
  parseProductFormData,
  handleProductImageUpload,
  validateProduct(createProductSchema),
  ProductController.createProduct
);
router.put(
  "/:id",
  upload.single("productImage"),
  parseProductFormData,
  handleProductImageUpload,
  validateProduct(updateProductSchema),
  ProductController.updateProduct
);
router.delete("/:id", ProductController.deleteProduct);

export default router;

