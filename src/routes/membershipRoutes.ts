import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { validateJoi } from "@/middleware/joiValidation";
import { buyMembershipSchema } from "@/validation/membershipValidation";
import { membershipController } from "@/controllers/membershipController";

const router = Router();

router.use(authenticate);

/**
 * @route   POST /api/memberships/buy
 * @desc    Buy membership plan
 * @access  Private
 */
router.post(
  "/buy",
  validateJoi(buyMembershipSchema),
  membershipController.buyMembership
);

export default router;
