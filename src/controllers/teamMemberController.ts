import { Request, Response } from "express";
import {
  asyncHandler,
  getPaginationMeta,
  getPaginationOptions,
  markdownToHtml,
} from "@/utils";
import { AppError } from "@/utils/AppError";
import { TeamMembers } from "@/models/cms/teamMembers.model";

type SupportedLanguage = "en" | "nl" | "de" | "fr" | "es";

/**
 * Get language from query parameter, default to "en"
 */
const getLanguageFromQuery = (lang?: string): SupportedLanguage => {
  const supportedLanguages: SupportedLanguage[] = [
    "en",
    "nl",
    "de",
    "fr",
    "es",
  ];
  if (lang && supportedLanguages.includes(lang as SupportedLanguage)) {
    return lang as SupportedLanguage;
  }
  return "en";
};

class TeamMemberController {
  /**
   * Get all team members (Public)
   * Language is passed via query parameter
   */
  getTeamMembers = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      // Get language from query parameter
      const userLang = getLanguageFromQuery(req.query.lang as string);

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
   * Get team member by ID (Public)
   * Language is passed via query parameter
   */
  getTeamMemberById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      // Get language from query parameter
      const userLang = getLanguageFromQuery(req.query.lang as string);

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
