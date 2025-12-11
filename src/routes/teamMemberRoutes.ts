import { Router } from "express";
import { teamMemberController } from "@/controllers/teamMemberController";
import { validateQuery, validateParams } from "@/middleware/joiValidation";
import {
  getPublicTeamMembersQuerySchema,
  getPublicTeamMemberParamsSchema,
  getPublicTeamMemberQuerySchema,
} from "@/validation/teamMemberValidation";

const router = Router();

/**
 * Public Routes (No Authentication Required)
 * These routes are accessible without authentication token
 */

/**
 * @route GET /api/v1/team-members
 * @desc Get all team members (public)
 * @access Public
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [sort] - Sort field (default: sortOrder)
 * @query {String} [order] - Sort order: "asc" or "desc" (default: "asc")
 * @query {String} [lang] - Language for content (en, nl, de, fr, es)
 */
router.get(
  "/",
  validateQuery(getPublicTeamMembersQuerySchema),
  teamMemberController.getTeamMembers
);

/**
 * @route GET /api/v1/team-members/:id
 * @desc Get team member by ID (public)
 * @access Public
 * @param {String} id - Team member ID (MongoDB ObjectId)
 * @query {String} [lang] - Language for content (en, nl, de, fr, es)
 */
router.get(
  "/:id",
  validateParams(getPublicTeamMemberParamsSchema),
  validateQuery(getPublicTeamMemberQuerySchema),
  teamMemberController.getTeamMemberById
);

export default router;
