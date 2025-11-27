import { Router } from "express";
import { authMiddleware } from "@/middleware/auth";
import { validateJoi, validateParams } from "@/middleware/joiValidation";
import { productReviewController } from "@/controllers/productReviewController";
import {
  productReviewParamsSchema,
  reviewIdParamsSchema,
  createProductReviewSchema,
  updateProductReviewSchema,
} from "@/validation/productReviewValidation";

const router = Router();

router.use(authMiddleware);

router.post(
  "/products/:productId",
  validateParams(productReviewParamsSchema),
  validateJoi(createProductReviewSchema),
  productReviewController.addProductReview
);

router.get("/products", productReviewController.listMyProductReviews);

router.put(
  "/products/:reviewId",
  validateParams(reviewIdParamsSchema),
  validateJoi(updateProductReviewSchema),
  productReviewController.updateProductReview
);

router.delete(
  "/products/:reviewId",
  validateParams(reviewIdParamsSchema),
  productReviewController.deleteProductReview
);

export default router;
