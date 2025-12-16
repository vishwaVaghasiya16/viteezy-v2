/**
 * @fileoverview About Us Controller (Public)
 * @description Controller for public About Us page operations
 * @module controllers/aboutUsController
 */

import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AboutUs } from "@/models/cms";

class AboutUsController {
  /**
   * Get About Us page content (Public)
   */
  getAboutUs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const aboutUs = await AboutUs.findOne({
        isDeleted: false,
      }).lean();

      if (!aboutUs) {
        // Return empty structure if not found
        const emptyAboutUs = {
          banner: {
            banner_image: null,
            banner_title: {},
            banner_subtitle: {},
            banner_button_text: {},
            banner_button_link: "",
          },
          founderQuote: {
            founder_quote_text: {},
            founder_name: {},
            founder_designation: {},
            note: {},
          },
          meetBrains: {
            meet_brains_title: {},
            meet_brains_subtitle: {},
            meet_brains_main_image: null,
          },
          timeline: {
            timeline_section_title: {},
            timeline_section_description: {},
            timeline_events: [],
          },
          people: {
            title: {},
            subtitle: {},
          },
        };
        res.apiSuccess(
          { aboutUs: emptyAboutUs },
          "About Us content retrieved successfully"
        );
        return;
      }

      res.apiSuccess({ aboutUs }, "About Us content retrieved successfully");
    }
  );
}

export const aboutUsController = new AboutUsController();
