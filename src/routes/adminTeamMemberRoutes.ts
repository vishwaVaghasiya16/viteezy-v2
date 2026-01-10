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
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";
import { autoTranslateMiddleware } from "@/middleware/translationMiddleware";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/team-members
 * @desc Create a new team member
 * @access Admin
 * @contentType multipart/form-data
 * @note I18n fields (name, designation, content) can be sent as plain strings or I18n objects. Plain strings will be automatically converted to I18n objects.
 */
router.post(
  "/",
  handleMulterError(upload.single("image"), "image"),
  autoTranslateMiddleware("teamMembers"), // Converts plain strings to I18n objects for supported fields
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
 * @query {String} [lang] - Language code (en, nl, de, fr, es). If not provided, uses authenticated user's language or defaults to English.
 * @note I18n fields will be automatically transformed to single language strings based on detected language.
 */
router.get(
  "/",
  validateQuery(getTeamMembersQuerySchema),
  transformResponseMiddleware("teamMembers"),
  adminTeamMemberController.getTeamMembers
);

/**
 * @route GET /api/v1/admin/team-members/:id
 * @desc Get team member by ID
 * @access Admin
 * @param {String} id - Team member ID (MongoDB ObjectId)
 * @query {String} [lang] - Language code (en, nl, de, fr, es). If not provided, uses authenticated user's language or defaults to English.
 * @note I18n fields will be automatically transformed to single language strings based on detected language.
 */
router.get(
  "/:id",
  validateParams(teamMemberIdParamsSchema),
  transformResponseMiddleware("teamMembers"),
  adminTeamMemberController.getTeamMemberById
);

/**
 * @route PUT /api/v1/admin/team-members/:id
 * @desc Update team member
 * @access Admin
 * @contentType multipart/form-data
 * @note I18n fields (name, designation, content) can be sent as plain strings or I18n objects. Plain strings will be automatically converted to I18n objects.
 */
router.put(
  "/:id",
  handleMulterError(upload.single("image"), "image"),
  validateParams(teamMemberIdParamsSchema),
  autoTranslateMiddleware("teamMembers"), // Converts plain strings to I18n objects for supported fields
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
