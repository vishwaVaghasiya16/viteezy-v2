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
 * Public Routes
 * Language is passed via query parameter
 */

/**
 * @route GET /api/v1/team-members
 * @desc Get all team members (Public)
 * @access Public
 * @query {String} [lang] - Language code: "en", "nl", "de", "fr", "es" (default: "en")
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [sort] - Sort field (default: createdAt)
 * @query {String} [order] - Sort order: "asc" or "desc" (default: "desc")
 */
router.get(
  "/",
  validateQuery(getPublicTeamMembersQuerySchema),
  teamMemberController.getTeamMembers
);

/**
 * @route GET /api/v1/team-members/:id
 * @desc Get team member by ID (Public)
 * @access Public
 * @param {String} id - Team member ID (MongoDB ObjectId)
 * @query {String} [lang] - Language code: "en", "nl", "de", "fr", "es" (default: "en")
 */
router.get(
  "/:id",
  validateParams(getPublicTeamMemberParamsSchema),
  validateQuery(getPublicTeamMemberQuerySchema),
  teamMemberController.getTeamMemberById
);

export default router;
