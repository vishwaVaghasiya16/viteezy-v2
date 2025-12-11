import { Request, Response } from "express";
import {
  asyncHandler,
  getPaginationMeta,
  getPaginationOptions,
  markdownToHtml,
} from "@/utils";
import { AppError } from "@/utils/AppError";
import { TeamMembers } from "@/models/cms/teamMembers.model";
import { User } from "@/models/index.model";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    language?: string;
  };
}

/**
 * Map user language preference to language code
 * User table stores: "English", "Dutch", "German", "French", "Spanish", "Italian", "Portuguese"
 * API uses: "en", "nl", "de", "fr", "es" (only supported languages in I18n types)
 * Italian and Portuguese fallback to English
 */
const mapLanguageToCode = (
  language?: string
): "en" | "nl" | "de" | "fr" | "es" => {
  const languageMap: Record<string, "en" | "nl" | "de" | "fr" | "es"> = {
    English: "en",
    Dutch: "nl",
    German: "de",
    French: "fr",
    Spanish: "es",
    Italian: "en", // Fallback to English (not supported in I18n types)
    Portuguese: "en", // Fallback to English (not supported in I18n types)
  };

  if (!language) {
    return "en"; // Default to English
  }

  return languageMap[language] || "en";
};

class TeamMemberController {
  /**
   * Get all team members (authenticated users only)
   * Language is automatically detected from user's profile preference
   * Only shows data in user's selected language
   */
  getTeamMembers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user || !req.user._id) {
        throw new AppError("User not authenticated", 401);
      }

      // Get user's language preference from database
      const user = await User.findById(req.user._id).select("language").lean();
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Map user's language preference to language code
      const userLang = mapLanguageToCode(user.language);

      const { page, limit, skip, sort } = getPaginationOptions(req);

      const filter: Record<string, any> = {
        isDeleted: false,
      };

      const sortOptions: Record<string, 1 | -1> = {
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      const [teamMembers, total] = await Promise.all([
        TeamMembers.find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        TeamMembers.countDocuments(filter),
      ]);

      // Transform team members to show only user's language content
      const transformedTeamMembers = teamMembers.map((member: any) => {
        // Get content for user's language only
        const markdownContent =
          member.content?.[userLang] || member.content?.en || "";
        const htmlContent = markdownToHtml(markdownContent);

        return {
          _id: member._id,
          image: member.image || null,
          name: member.name?.[userLang] || member.name?.en || "",
          designation:
            member.designation?.[userLang] || member.designation?.en || "",
          content: htmlContent, // Only user's language content
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
        };
      });

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(
        transformedTeamMembers,
        pagination,
        "Team members retrieved successfully"
      );
    }
  );

  /**
   * Get team member by ID (authenticated users only)
   * Language is automatically detected from user's profile preference
   * Only shows data in user's selected language
   */
  getTeamMemberById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user || !req.user._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { id } = req.params;

      // Get user's language preference from database
      const user = await User.findById(req.user._id).select("language").lean();
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Map user's language preference to language code
      const userLang = mapLanguageToCode(user.language);

      const teamMember = await TeamMembers.findOne({
        _id: id,
        isDeleted: false,
      }).lean();

      if (!teamMember) {
        throw new AppError("Team member not found", 404);
      }

      // Get content for user's language only
      const markdownContent =
        teamMember.content?.[userLang] || teamMember.content?.en || "";
      const htmlContent = markdownToHtml(markdownContent);

      const transformedTeamMember = {
        _id: teamMember._id,
        image: teamMember.image || null,
        name: teamMember.name?.[userLang] || teamMember.name?.en || "",
        designation:
          teamMember.designation?.[userLang] ||
          teamMember.designation?.en ||
          "",
        content: htmlContent, // Only user's language content
        createdAt: teamMember.createdAt,
        updatedAt: teamMember.updatedAt,
      };

      res.apiSuccess(
        { teamMember: transformedTeamMember },
        "Team member retrieved successfully"
      );
    }
  );
}

export const teamMemberController = new TeamMemberController();
