import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { upload, handleMulterError } from "@/middleware/upload";
import { adminTeamMemberController } from "@/controllers/adminTeamMemberController";
import {
  createTeamMemberSchema,
  updateTeamMemberSchema,
  teamMemberIdParamsSchema,
  getTeamMembersQuerySchema,
} from "@/validation/teamMemberValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/team-members
 * @desc Create a new team member
 * @access Admin
 * @contentType multipart/form-data
 */
router.post(
  "/",
  handleMulterError(upload.single("image"), "image"),
  validateJoi(createTeamMemberSchema),
  adminTeamMemberController.createTeamMember
);

/**
 * @route GET /api/v1/admin/team-members
 * @desc Get paginated list of all team members (Admin view)
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [search] - Search by name or designation
 * @query {String} [sort] - Sort field (default: sortOrder)
 * @query {String} [order] - Sort order: "asc" or "desc" (default: "asc")
 */
router.get(
  "/",
  validateQuery(getTeamMembersQuerySchema),
  adminTeamMemberController.getTeamMembers
);

/**
 * @route GET /api/v1/admin/team-members/:id
 * @desc Get team member by ID
 * @access Admin
 * @param {String} id - Team member ID (MongoDB ObjectId)
 */
router.get(
  "/:id",
  validateParams(teamMemberIdParamsSchema),
  adminTeamMemberController.getTeamMemberById
);

/**
 * @route PUT /api/v1/admin/team-members/:id
 * @desc Update team member
 * @access Admin
 * @contentType multipart/form-data
 */
router.put(
  "/:id",
  handleMulterError(upload.single("image"), "image"),
  validateParams(teamMemberIdParamsSchema),
  validateJoi(updateTeamMemberSchema),
  adminTeamMemberController.updateTeamMember
);

/**
 * @route DELETE /api/v1/admin/team-members/:id
 * @desc Delete team member (soft delete)
 * @access Admin
 * @param {String} id - Team member ID (MongoDB ObjectId)
 * @note Deletes image from cloud storage if exists
 */
router.delete(
  "/:id",
  validateParams(teamMemberIdParamsSchema),
  adminTeamMemberController.deleteTeamMember
);

export default router;
