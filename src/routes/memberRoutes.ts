import { Router } from "express";
import { memberController } from "@/controllers/memberController";
import { authMiddleware } from "@/middleware/auth";
import { validateJoi, validateParams } from "@/middleware/joiValidation";
import {
  registerWithMemberIdSchema,
  verifyMemberIdParamsSchema,
} from "@/validation/memberValidation";

const router = Router();

/**
 * @route   POST /api/v1/members/register
 * @desc    Register user with parent member ID
 * @access  Public
 */
router.post(
  "/register",
  validateJoi(registerWithMemberIdSchema),
  memberController.registerWithMemberId
);

/**
 * @route   GET /api/v1/members/verify/:memberId
 * @desc    Verify member ID exists
 * @access  Public
 */
router.get(
  "/verify/:memberId",
  validateParams(verifyMemberIdParamsSchema),
  memberController.verifyMemberId
);

/**
 * @route   GET /api/v1/members/me
 * @desc    Get user's member ID and referral info
 * @access  Private
 */
router.get("/me", authMiddleware, memberController.getMyMemberInfo);

/**
 * @route   GET /api/v1/members/children
 * @desc    Get list of child members linked to authenticated parent
 * @access  Private
 */
router.get("/children", authMiddleware, memberController.getMyChildMembers);

export default router;
