import { Request, Response } from "express";
import { asyncHandler, markdownToHtml } from "@/utils";
import { OurTeamPage } from "@/models/cms/ourTeamPage.model";
import { TeamMembers } from "@/models/cms/teamMembers.model";

type SupportedLanguage = "en" | "nl" | "de" | "fr" | "es";

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

class OurTeamPageController {
  /**
   * Get Our Team Page settings with team members (Public)
   */
  getOurTeamPage = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userLang = getLanguageFromQuery(req.query.lang as string);

      // Fetch page settings and team members in parallel
      const [pageSettings, teamMembers] = await Promise.all([
        OurTeamPage.findOne().lean(),
        TeamMembers.find({ isDeleted: false }).sort({ createdAt: -1 }).lean(),
      ]);

      // Transform team members for user's language
      const transformedTeamMembers = teamMembers.map((member: any) => {
        const markdownContent =
          member.content?.[userLang] || member.content?.en || "";

        return {
          _id: member._id,
          image: member.image || null,
          name: member.name?.[userLang] || member.name?.en || "",
          designation:
            member.designation?.[userLang] || member.designation?.en || "",
          content: markdownToHtml(markdownContent),
        };
      });

      if (!pageSettings) {
        // Return empty banner with team members
        res.apiSuccess(
          {
            banner: {
              banner_image: null,
              title: "",
              subtitle: "",
            },
            teamMembers: transformedTeamMembers,
          },
          "Our Team page retrieved successfully"
        );
        return;
      }

      const banner = pageSettings.banner || {};
      const subtitleMarkdown =
        banner.subtitle?.[userLang] || banner.subtitle?.en || "";

      const transformedSettings = {
        banner: {
          banner_image: banner.banner_image || null,
          title: banner.title?.[userLang] || banner.title?.en || "",
          subtitle: markdownToHtml(subtitleMarkdown),
        },
        teamMembers: transformedTeamMembers,
      };

      res.apiSuccess(
        transformedSettings,
        "Our Team page retrieved successfully"
      );
    }
  );
}

export const ourTeamPageController = new OurTeamPageController();
