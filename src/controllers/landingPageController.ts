import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "@/utils";
import { landingPageService } from "@/services/landingPageService";
import mongoose from "mongoose";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
  };
}

class LandingPageController {
  /**
   * Create new landing page
   * @route POST /api/v1/admin/landing-pages
   * @access Admin
   */
  createLandingPage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?._id;

      const result = await landingPageService.createLandingPage({
        ...req.body,
        createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      });

      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          landingPage: result.landingPage,
        },
      });
    }
  );

  /**
   * Get all landing pages
   * @route GET /api/v1/admin/landing-pages
   * @access Admin
   */
  getAllLandingPages = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { isActive } = req.query;

      const filters: any = {};
      if (isActive !== undefined) {
        filters.isActive = isActive === "true";
      }

      const result = await landingPageService.getAllLandingPages(filters);

      res.status(200).json({
        success: true,
        message: "Landing pages retrieved successfully",
        data: result.landingPages,
      });
    }
  );

  /**
   * Get landing page by ID
   * @route GET /api/v1/admin/landing-pages/:id
   * @access Admin
   */
  getLandingPageById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      const result = await landingPageService.getLandingPageById(id);

      res.status(200).json({
        success: true,
        message: "Landing page retrieved successfully",
        data: {
          landingPage: result.landingPage,
        },
      });
    }
  );

  /**
   * Get active landing page (public endpoint)
   * @route GET /api/v1/landing-page
   * @access Public
   */
  getActiveLandingPage = asyncHandler(
    async (req: Request, res: Response) => {
      const result = await landingPageService.getActiveLandingPage();

      res.status(200).json({
        success: true,
        message: "Landing page retrieved successfully",
        data: {
          landingPage: result.landingPage,
        },
      });
    }
  );

  /**
   * Update landing page
   * @route PUT /api/v1/admin/landing-pages/:id
   * @access Admin
   */
  updateLandingPage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const userId = req.user?._id;

      const result = await landingPageService.updateLandingPage(id, {
        ...req.body,
        updatedBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          landingPage: result.landingPage,
        },
      });
    }
  );

  /**
   * Delete landing page
   * @route DELETE /api/v1/admin/landing-pages/:id
   * @access Admin
   */
  deleteLandingPage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      const result = await landingPageService.deleteLandingPage(id);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    }
  );
}

export const landingPageController = new LandingPageController();

