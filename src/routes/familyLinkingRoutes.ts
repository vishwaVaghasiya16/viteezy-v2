/**
 * @fileoverview Family Linking Routes
 * @description API routes for family management
 * @module routes/familyLinkingRoutes
 */

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/joiValidation";
import {
  linkByMemberIdSchema,
  linkFamilyMembersSchema,
  unlinkFamilyMembersSchema,
  getFamilyMembersSchema,
  getMySubMembersSchema,
  leaveFamilySchema,
  removeSubMemberSchema,
} from "../validation/familyLinkingValidation";
import {
  linkByMemberId,
  linkFamilyMembers,
  unlinkFamilyMembers,
  getFamilyInfo,
  getAdminFamilyInfo,
  getMyFamilyDetails,
  getMySubMembers,
  leaveFamily,
  removeSubMember,
} from "../controllers/familyLinkingController";

const router = Router();

// ============================================================================
// USER ROUTES
// ============================================================================

/**
 * @route POST /family/link
 * @desc Link current user to a family using member ID
 * @access Private
 */
router.post(
  "/link",
  authenticate,
  validate(linkByMemberIdSchema),
  linkByMemberId
);

/**
 * @route GET /family/info
 * @desc Get family information for current user
 * @access Private
 */
router.get("/info", authenticate, getFamilyInfo);

/**
 * @route GET /family/members/:mainMemberId
 * @desc Get family members for a main member
 * @access Private
 */
router.get(
  "/members/:mainMemberId",
  authenticate,
  validate(getFamilyMembersSchema),
  linkFamilyMembers
);

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * @route POST /admin/family/link
 * @desc Link family members by IDs (admin endpoint)
 * @access Admin
 */
router.post(
  "/admin/family/link",
  authenticate,
  authorize("ADMIN", "MODERATOR"),
  validate(linkFamilyMembersSchema),
  linkFamilyMembers
);

/**
 * @route DELETE /admin/family/unlink
 * @desc Unlink family members
 * @access Admin
 */
router.delete(
  "/admin/family/unlink",
  authenticate,
  authorize("ADMIN", "MODERATOR"),
  validate(unlinkFamilyMembersSchema),
  unlinkFamilyMembers
);

/**
 * @route GET /admin/family/members/:mainMemberId
 * @desc Get family members for admin
 * @access Admin
 */
router.get(
  "/admin/family/members/:mainMemberId",
  authenticate,
  authorize("ADMIN", "MODERATOR"),
  validate(getFamilyMembersSchema),
  linkFamilyMembers
);

/**
 * @route GET /admin/family/info/:userId
 * @desc Get family information for admin
 * @access Admin
 */
router.get(
  "/admin/family/info/:userId",
  authenticate,
  authorize("ADMIN", "MODERATOR"),
  getAdminFamilyInfo
);

/**
 * @route GET /family/me
 * @desc Get current user's family details
 * @access Private
 */
router.get("/family/me", authenticate, getMyFamilyDetails);

/**
 * @route GET /family/sub-members
 * @desc Get sub-members for main member
 * @access Private
 */
router.get("/family/sub-members", authenticate, validate(getMySubMembersSchema), getMySubMembers);

/**
 * @route POST /family/leave
 * @desc Sub-member leaves family
 * @access Private
 */
router.post("/family/leave", authenticate, validate(leaveFamilySchema), leaveFamily);

/**
 * @route DELETE /family/remove/:subMemberId
 * @desc Main member removes sub-member
 * @access Private
 */
router.delete("/family/remove/:subMemberId", authenticate, validate(removeSubMemberSchema), removeSubMember);

export default router;
