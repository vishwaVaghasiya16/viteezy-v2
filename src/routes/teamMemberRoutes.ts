import { Router } from "express";
import { authMiddleware } from "@/middleware/auth";
import { teamMemberController } from "@/controllers/teamMemberController";
import { validateQuery, validateParams } from "@/middleware/joiValidation";
import {
  getPublicTeamMembersQuerySchema,
  getPublicTeamMemberParamsSchema,
  getPublicTeamMemberQuerySchema,
} from "@/validation/teamMemberValidation";

const router = Router();

/**
 * Protected Routes (Authentication Required)
 * User must be logged in to access these routes
 * Language will be automatically detected from user's profile
 */

/**
 * @route GET /api/v1/team-members
 * @desc Get all team members (authenticated users only)
 * @access Private (User must be logged in)
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [sort] - Sort field (default: createdAt)
 * @query {String} [order] - Sort order: "asc" or "desc" (default: "desc")
 * @note Language is automatically detected from user's profile preference
 */
router.get(
  "/",
  authMiddleware,
  validateQuery(getPublicTeamMembersQuerySchema),
  teamMemberController.getTeamMembers
);

/**
 * @route GET /api/v1/team-members/:id
 * @desc Get team member by ID (authenticated users only)
 * @access Private (User must be logged in)
 * @param {String} id - Team member ID (MongoDB ObjectId)
 * @note Language is automatically detected from user's profile preference
 */
router.get(
  "/:id",
  authMiddleware,
  validateParams(getPublicTeamMemberParamsSchema),
  validateQuery(getPublicTeamMemberQuerySchema),
  teamMemberController.getTeamMemberById
);

export default router;
