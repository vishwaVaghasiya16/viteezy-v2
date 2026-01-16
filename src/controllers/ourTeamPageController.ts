import { Request, Response } from "express";
import { asyncHandler, markdownToHtml } from "@/utils";
import { OurTeamPage } from "@/models/cms/ourTeamPage.model";
import { TeamMembers } from "@/models/cms/teamMembers.model";
import { SupportedLanguage, DEFAULT_LANGUAGE } from "@/models/common.model";
import { DEFAULT_LANGUAGE_CODE, normalizeLanguageCode } from "@/utils/languageConstants";
import { languageService } from "@/services/languageService";

/**
 * Get language from query parameter, default to "en"
 * Validates against configured languages dynamically
 */
const getLanguageFromQuery = async (lang?: string): Promise<SupportedLanguage> => {
  if (!lang) {
    return DEFAULT_LANGUAGE_CODE;
  }

  const normalized = normalizeLanguageCode(lang);
  
  // Validate against configured languages
  const isValid = await languageService.isValidLanguage(normalized);
  if (!isValid) {
    return DEFAULT_LANGUAGE_CODE;
  }

  return normalized as SupportedLanguage;
};

class OurTeamPageController {
  /**
   * Get Our Team Page settings with team members (Public)
   */
  getOurTeamPage = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userLang = await getLanguageFromQuery(req.query.lang as string);

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
