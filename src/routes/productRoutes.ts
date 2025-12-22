import { Router } from "express";
import { ProductController } from "../controllers/productController";
import {
  validateProduct,
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
  getProductCategoriesSchema,
} from "../validation/productValidation";
import { authMiddleware, optionalAuth, authorize } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { parseProductFormData } from "../middleware/parseProductFormData";
import { handleProductImageUpload } from "../middleware/productImageUpload";
import { validateQuery } from "../middleware/joiValidation";

const router = Router();

// Public routes (optional authentication for member pricing)
router.get("/", optionalAuth, ProductController.getAllProducts);
router.get("/featured-or-recent", optionalAuth, ProductController.getFeaturedOrRecentProducts);
router.get("/filters", ProductController.getFilterOptions);
router.get("/stats", ProductController.getProductStats);
router.get(
  "/categories",
  validateQuery(getProductCategoriesSchema),
  ProductController.getProductCategories
);
router.get("/slug/:slug", optionalAuth, ProductController.getProductBySlug);
router.get("/:id", optionalAuth, ProductController.getProductById);

// Admin-only routes (authentication + admin authorization required)
// These routes require Admin role - regular users cannot create/update/delete products
router.use(authMiddleware); // Apply auth middleware first
router.use(authorize("Admin")); // Then check for Admin role

/**
 * @route   POST /api/v1/products
 * @desc    Create a new product
 * @access  Admin Only
 */
router.post(
  "/",
  upload.fields([
    { name: "productImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
    { name: "standupPouchImages", maxCount: 10 },
    { name: "specificationBgImage", maxCount: 1 },
    { name: "specificationItemImage1", maxCount: 1 },
    { name: "specificationItemImagemobile1", maxCount: 1 },
    { name: "specificationItemImage2", maxCount: 1 },
    { name: "specificationItemImagemobile2", maxCount: 1 },
    { name: "specificationItemImage3", maxCount: 1 },
    { name: "specificationItemImagemobile3", maxCount: 1 },
    { name: "specificationItemImage4", maxCount: 1 },
    { name: "specificationItemImagemobile4", maxCount: 1 },
  ]),
  parseProductFormData,
  handleProductImageUpload,
  validateProduct(createProductSchema),
  ProductController.createProduct
);

/**
 * @route   PATCH /api/v1/products/:id/status
 * @desc    Update product status
 * @access  Admin Only
 */
router.patch(
  "/:id/status",
  validateProduct(updateProductStatusSchema),
  ProductController.updateProductStatus
);

/**
 * @route   PUT /api/v1/products/:id
 * @desc    Update product
 * @access  Admin Only
 */
router.put(
  "/:id",
  upload.fields([
    { name: "productImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
    { name: "standupPouchImages", maxCount: 10 },
    { name: "specificationBgImage", maxCount: 1 },
    { name: "specificationItemImage1", maxCount: 1 },
    { name: "specificationItemImagemobile1", maxCount: 1 },
    { name: "specificationItemImage2", maxCount: 1 },
    { name: "specificationItemImagemobile2", maxCount: 1 },
    { name: "specificationItemImage3", maxCount: 1 },
    { name: "specificationItemImagemobile3", maxCount: 1 },
    { name: "specificationItemImage4", maxCount: 1 },
    { name: "specificationItemImagemobile4", maxCount: 1 },
  ]),
  parseProductFormData,
  handleProductImageUpload,
  validateProduct(updateProductSchema),
  ProductController.updateProduct
);

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Delete product
 * @access  Admin Only
 */
router.delete("/:id", ProductController.deleteProduct);

export default router;
