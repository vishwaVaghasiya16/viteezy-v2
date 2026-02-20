/**
 * @fileoverview Static Page Controller (Public)
 * @description Controller for public static page operations
 * @module controllers/staticPageController
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { StaticPages } from "@/models/cms";
import { StaticPageStatus, SystemPageType } from "@/models/enums";
import { logger } from "@/utils/logger";

/**
 * Get list of active static pages (excluding system pages like about-us, our-team)
 * @route GET /api/v1/static-pages
 * @access Public
 * @query {String} [lang] - Language code (en, nl, de, fr, es) - defaults to 'en'
 */
export const getStaticPages = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const lang = (req.query.lang as string) || "en";

    // Get active static pages excluding system pages (about-us, our-team)
    const staticPages = await StaticPages.find({
      status: StaticPageStatus.PUBLISHED,
      isDeleted: false,
      // Exclude system pages
      $or: [
        { isSystemPage: false },
        { isSystemPage: { $exists: false } },
      ],
      // Exclude specific system page types
      systemPageType: { $nin: [SystemPageType.ABOUT_US, SystemPageType.OUR_TEAM] },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Transform I18n fields to single language
    const transformedPages = staticPages.map((page: any) => {
      const titleObj = page.title || {};
      const contentObj = page.content || {};
      return {
        id: page._id,
        slug: page.slug,
        title: (titleObj as any)[lang] || titleObj.en || "",
        content: (contentObj as any)[lang] || contentObj.en || "",
        status: page.status,
        seo: page.seo || {},
        route: page.route,
        lang: lang, // Include language in response
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      };
    });

    logger.info(`Retrieved ${transformedPages.length} active static pages for language: ${lang}`);

    res.status(200).json({
      success: true,
      message: "Static pages retrieved successfully",
      data: {
        pages: transformedPages,
        count: transformedPages.length,
        lang: lang, // Include language in response
      },
    });
  }
);

/**
 * Get static page by ID or slug
 * @route GET /api/v1/static-pages/:idOrSlug
 * @access Public
 * @param {String} idOrSlug - Static page ID (MongoDB ObjectId) or slug
 * @query {String} [lang] - Language code (en, nl, de, fr, es) - defaults to 'en'
 */
export const getStaticPageByIdOrSlug = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { idOrSlug } = req.params;
    const lang = (req.query.lang as string) || "en";

    // Check if idOrSlug is a valid ObjectId
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrSlug);

    // Build query - search by ID or slug
    const query: any = {
      status: StaticPageStatus.PUBLISHED,
      isDeleted: false,
      // Exclude system pages (about-us, our-team)
      $or: [
        { isSystemPage: false },
        { isSystemPage: { $exists: false } },
      ],
      systemPageType: { $nin: [SystemPageType.ABOUT_US, SystemPageType.OUR_TEAM] },
    };

    if (isObjectId) {
      query._id = new mongoose.Types.ObjectId(idOrSlug);
    } else {
      query.slug = idOrSlug.toLowerCase().trim();
    }

    const page = await StaticPages.findOne(query).lean();

    if (!page) {
      throw new AppError("Static page not found", 404);
    }

    // Transform I18n fields to single language
    const titleObj = page.title || {};
    const contentObj = page.content || {};
    const transformedPage = {
      id: page._id,
      slug: page.slug,
      title: (titleObj as any)[lang] || titleObj.en || "",
      content: (contentObj as any)[lang] || contentObj.en || "",
      status: page.status,
      seo: page.seo || {},
      route: page.route,
      lang: lang, // Include language in response
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };

    logger.info(`Retrieved static page: ${page.slug} (${isObjectId ? "by ID" : "by slug"}) for language: ${lang}`);

    res.status(200).json({
      success: true,
      message: "Static page retrieved successfully",
      data: {
        page: transformedPage,
        lang: lang, // Include language in response
      },
    });
  }
);

