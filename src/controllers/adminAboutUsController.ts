/**
 * @fileoverview Admin About Us Controller
 * @description Controller for admin About Us page operations (CRUD)
 * @module controllers/adminAboutUsController
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { AboutUs } from "@/models/cms";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

class AdminAboutUsController {
  /**
   * Get About Us page content
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
            banner_description: {},
            banner_button_text: {},
            banner_button_link: "",
          },
          founderNote: {
            headline: {},
            description: {},
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

  /**
   * Create or Update About Us page content
   * Since there's only one About Us page, this acts as upsert
   */
  upsertAboutUs = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const { banner, founderNote, meetBrains, timeline, people } = req.body;

      // Find existing About Us page
      let aboutUs = await AboutUs.findOne({
        isDeleted: false,
      });

      if (aboutUs) {
        // Update existing
        if (banner) {
          aboutUs.banner = { ...aboutUs.banner, ...banner };
        }
        if (founderNote) {
          aboutUs.founderNote = { ...aboutUs.founderNote, ...founderNote };
        }
        if (meetBrains) {
          aboutUs.meetBrains = { ...aboutUs.meetBrains, ...meetBrains };
        }
        if (timeline) {
          aboutUs.timeline = { ...aboutUs.timeline, ...timeline };
        }
        if (people) {
          aboutUs.people = { ...aboutUs.people, ...people };
        }

        if (requesterId) {
          aboutUs.updatedBy = requesterId;
        }

        await aboutUs.save();
        res.apiSuccess({ aboutUs }, "About Us content updated successfully");
      } else {
        // Create new
        aboutUs = await AboutUs.create({
          banner: banner || {},
          founderNote: founderNote || {},
          meetBrains: meetBrains || {},
          timeline: timeline || {},
          people: people || {},
          createdBy: requesterId,
        });

        res.apiCreated({ aboutUs }, "About Us content created successfully");
      }
    }
  );

  /**
   * Update specific section of About Us page
   */
  updateSection = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { section } = req.params;

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const validSections = [
        "banner",
        "founderNote",
        "meetBrains",
        "timeline",
        "people",
      ];

      if (!validSections.includes(section)) {
        throw new AppError(
          `Invalid section. Must be one of: ${validSections.join(", ")}`,
          400
        );
      }

      let aboutUs = await AboutUs.findOne({
        isDeleted: false,
      });

      if (!aboutUs) {
        // Create new if doesn't exist
        aboutUs = await AboutUs.create({
          createdBy: requesterId,
        });
      }

      // Extract section data from request body
      // Remove section param and file fields, keep only the section data
      const sectionData = { ...req.body };
      delete sectionData.section;

      // Update the specific section
      if (section === "banner") {
        aboutUs.banner = { ...aboutUs.banner, ...sectionData };
      } else if (section === "founderNote") {
        aboutUs.founderNote = { ...aboutUs.founderNote, ...sectionData };
      } else if (section === "meetBrains") {
        aboutUs.meetBrains = { ...aboutUs.meetBrains, ...sectionData };
      } else if (section === "timeline") {
        aboutUs.timeline = { ...aboutUs.timeline, ...sectionData };
      } else if (section === "people") {
        aboutUs.people = { ...aboutUs.people, ...sectionData };
      }

      if (requesterId) {
        aboutUs.updatedBy = requesterId;
      }

      await aboutUs.save();

      res.apiSuccess({ aboutUs }, `${section} section updated successfully`);
    }
  );

  /**
   * Delete About Us page (soft delete)
   */
  deleteAboutUs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const aboutUs = await AboutUs.findOne({
        isDeleted: false,
      });

      if (!aboutUs) {
        throw new AppError("About Us page not found", 404);
      }

      aboutUs.isDeleted = true;
      aboutUs.deletedAt = new Date();
      await aboutUs.save();

      res.apiSuccess(null, "About Us page deleted successfully");
    }
  );
}

export const adminAboutUsController = new AdminAboutUsController();
