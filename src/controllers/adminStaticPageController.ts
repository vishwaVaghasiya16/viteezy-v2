/**
 * @fileoverview Admin Static Page Controller
 * @description Controller for admin static page operations (CRUD)
 * @module controllers/adminStaticPageController
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { StaticPages } from "@/models/cms";
import { StaticPageStatus } from "@/models/enums";
import { generateSlug, generateUniqueSlug } from "@/utils/slug";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

const ensureObjectId = (id: string, label: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return new mongoose.Types.ObjectId(id);
};

class AdminStaticPageController {
  /**
   * Create a new static page
   */
  createStaticPage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const {
        title,
        slug,
        content,
        status = StaticPageStatus.UNPUBLISHED,
        seo,
      } = req.body;

      if (!title?.en) {
        throw new AppError("Title (English) is required", 400);
      }

      // Generate slug if not provided
      const baseSlug = slug || generateSlug(title.en || "");
      if (!baseSlug) {
        throw new AppError(
          "Unable to generate slug. Please provide a valid title or slug.",
          400
        );
      }

      // Ensure slug is unique
      const finalSlug = await generateUniqueSlug(
        baseSlug,
        async (slugToCheck) =>
          StaticPages.exists({
            slug: slugToCheck,
            isDeleted: false,
          }).then((existing) => Boolean(existing))
      );

      const staticPage = await StaticPages.create({
        slug: finalSlug,
        title,
        content: content || {},
        status: status as StaticPageStatus,
        seo: seo || {},
        createdBy: requesterId,
      });

      res.apiCreated({ staticPage }, "Static page created successfully");
    }
  );

  /**
   * Get paginated list of all static pages (Admin view)
   */
  getStaticPages = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { status, search } = req.query as {
        status?: StaticPageStatus;
        search?: string;
      };

      const filter: Record<string, any> = {
        isDeleted: false,
      };

      if (status) {
        filter.status = status;
      }

      if (search) {
        filter.$or = [
          { "title.en": { $regex: search, $options: "i" } },
          { "title.nl": { $regex: search, $options: "i" } },
          { slug: { $regex: search, $options: "i" } },
        ];
      }

      const sortOptions: Record<string, 1 | -1> = {
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      const [staticPages, total] = await Promise.all([
        StaticPages.find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        StaticPages.countDocuments(filter),
      ]);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(staticPages, pagination, "Static pages retrieved");
    }
  );

  /**
   * Get static page by ID
   */
  getStaticPageById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const staticPage = await StaticPages.findOne({
        _id: id,
        isDeleted: false,
      }).lean();

      if (!staticPage) {
        throw new AppError("Static page not found", 404);
      }

      res.apiSuccess({ staticPage }, "Static page retrieved successfully");
    }
  );

  /**
   * Update static page
   */
  updateStaticPage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { title, slug, content, status, seo } = req.body;

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const staticPage = await StaticPages.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!staticPage) {
        throw new AppError("Static page not found", 404);
      }

      // Update fields if provided
      if (title) {
        staticPage.title = title;
      }

      if (content !== undefined) {
        staticPage.content = content;
      }

      if (seo !== undefined) {
        staticPage.seo = seo;
      }

      if (status) {
        staticPage.status = status as StaticPageStatus;
      }

      // Handle slug update with uniqueness check
      if (slug && slug !== staticPage.slug) {
        const finalSlug = await generateUniqueSlug(slug, async (slugToCheck) =>
          StaticPages.exists({
            slug: slugToCheck,
            _id: { $ne: staticPage._id },
            isDeleted: false,
          }).then((existing) => Boolean(existing))
        );
        staticPage.slug = finalSlug;
      } else if (!slug && title?.en && title.en !== staticPage.title?.en) {
        // Auto-generate slug if title changed and slug not provided
        const baseSlug = generateSlug(title.en);
        const finalSlug = await generateUniqueSlug(
          baseSlug,
          async (slugToCheck) =>
            StaticPages.exists({
              slug: slugToCheck,
              _id: { $ne: staticPage._id },
              isDeleted: false,
            }).then((existing) => Boolean(existing))
        );
        staticPage.slug = finalSlug;
      }

      if (requesterId) {
        staticPage.updatedBy = requesterId;
      }

      await staticPage.save();

      res.apiSuccess({ staticPage }, "Static page updated successfully");
    }
  );

  /**
   * Update static page status (publish/unpublish)
   */
  updateStaticPageStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { status } = req.body as {
        status: StaticPageStatus;
      };

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const staticPage = await StaticPages.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!staticPage) {
        throw new AppError("Static page not found", 404);
      }

      staticPage.status = status;

      if (requesterId) {
        staticPage.updatedBy = requesterId;
      }

      await staticPage.save();

      res.apiSuccess(
        { staticPage },
        `Static page ${
          status === StaticPageStatus.PUBLISHED ? "published" : "unpublished"
        } successfully`
      );
    }
  );

  /**
   * Delete static page (soft delete)
   */
  deleteStaticPage = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const staticPage = await StaticPages.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!staticPage) {
        throw new AppError("Static page not found", 404);
      }

      staticPage.isDeleted = true;
      staticPage.deletedAt = new Date();
      await staticPage.save();

      res.apiSuccess(null, "Static page deleted successfully");
    }
  );
}

export const adminStaticPageController = new AdminStaticPageController();
