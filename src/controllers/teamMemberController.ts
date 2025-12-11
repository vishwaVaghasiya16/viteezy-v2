import { Request, Response } from "express";
import {
  asyncHandler,
  getPaginationMeta,
  getPaginationOptions,
  markdownToHtml,
} from "@/utils";
import { AppError } from "@/utils/AppError";
import { TeamMembers } from "@/models/cms/teamMembers.model";

class TeamMemberController {
  /**
   * Get all team members (public)
   * Supports pagination and language selection
   */
  getTeamMembers = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { lang = "en" } = req.query as {
        lang?: string;
      };

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

      // Transform team members to include language-specific content
      const transformedTeamMembers = teamMembers.map((member: any) => {
        const supportedLang = ["en", "nl", "de", "fr", "es"].includes(
          lang as string
        )
          ? (lang as "en" | "nl" | "de" | "fr" | "es")
          : "en";

        const markdownContent =
          member.content?.[supportedLang] || member.content?.en || "";
        const htmlContent = markdownToHtml(markdownContent);

        return {
          _id: member._id,
          image: member.image || null,
          name: member.name,
          designation:
            member.designation?.[supportedLang] || member.designation?.en || "",
          content: htmlContent,
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
   * Get team member by ID (public)
   * Supports language selection
   */
  getTeamMemberById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { lang = "en" } = req.query as {
        lang?: string;
      };

      const teamMember = await TeamMembers.findOne({
        _id: id,
        isDeleted: false,
      }).lean();

      if (!teamMember) {
        throw new AppError("Team member not found", 404);
      }

      const supportedLang = ["en", "nl", "de", "fr", "es"].includes(
        lang as string
      )
        ? (lang as "en" | "nl" | "de" | "fr" | "es")
        : "en";

      const markdownContent =
        teamMember.content?.[supportedLang] || teamMember.content?.en || "";
      const htmlContent = markdownToHtml(markdownContent);

      const transformedTeamMember = {
        _id: teamMember._id,
        image: teamMember.image || null,
        name: teamMember.name?.[supportedLang] || teamMember.name?.en || "",
        designation:
          teamMember.designation?.[supportedLang] ||
          teamMember.designation?.en ||
          "",
        content: htmlContent,
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
