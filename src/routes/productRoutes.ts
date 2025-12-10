import { Router } from "express";
import { ProductController } from "../controllers/productController";
import {
  validateProduct,
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
  getProductCategoriesSchema,
} from "../validation/productValidation";
import { authMiddleware, optionalAuth } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { parseProductFormData } from "../middleware/parseProductFormData";
import { handleProductImageUpload } from "../middleware/productImageUpload";
import { validateQuery } from "../middleware/joiValidation";

const router = Router();

// Public routes (optional authentication for member pricing)
router.get("/", optionalAuth, ProductController.getAllProducts);
router.get("/filters", ProductController.getFilterOptions);
router.get("/stats", ProductController.getProductStats);
router.get(
  "/categories",
  validateQuery(getProductCategoriesSchema),
  ProductController.getProductCategories
);
router.get("/slug/:slug", optionalAuth, ProductController.getProductBySlug);
router.get("/:id", optionalAuth, ProductController.getProductById);

// Protected routes (authentication required)
router.use(authMiddleware); // Apply auth middleware to all routes below

router.post(
  "/",
  upload.fields([
    { name: "productImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
    { name: "sachetImages", maxCount: 10 },
    { name: "standupPouchImages", maxCount: 10 },
  ]),
  parseProductFormData,
  handleProductImageUpload,
  validateProduct(createProductSchema),
  ProductController.createProduct
);
// Status update route should be before /:id route to ensure proper matching
router.patch(
  "/:id/status",
  validateProduct(updateProductStatusSchema),
  ProductController.updateProductStatus
);
router.put(
  "/:id",
  upload.fields([
    { name: "productImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
    { name: "sachetImages", maxCount: 10 },
    { name: "standupPouchImages", maxCount: 10 },
  ]),
  parseProductFormData,
  handleProductImageUpload,
  validateProduct(updateProductSchema),
  ProductController.updateProduct
);
router.delete("/:id", ProductController.deleteProduct);

export default router;
