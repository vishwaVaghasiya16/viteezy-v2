import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { validateJoi } from "@/middleware/joiValidation";
import { preCheckoutValidationSchema } from "@/validation/preCheckoutValidation";
import { preCheckoutController } from "@/controllers/preCheckoutController";

const router = Router();

/**
 * All pre-checkout routes require authentication
 */
router.use(authenticate);

/**
 * @route   POST /api/pre-checkout/validate
 * @desc    Validate pre-checkout data (products, variants, pricing, membership, address, family)
 * @access  Private
 */
router.post(
  "/validate",
  validateJoi(preCheckoutValidationSchema),
  preCheckoutController.validatePreCheckout
);

export default router;
