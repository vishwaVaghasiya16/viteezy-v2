/**
 * @fileoverview Admin Static Page Controller
 * @description Controller for admin static page operations (CRUD)
 * @module controllers/adminStaticPageController
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import {
  StaticPages,
  AboutUs,
  OurTeamPage,
  LandingPages,
  MembershipCms,
} from "@/models/cms";
import {
  StaticPageStatus,
  SystemPageType,
} from "@/models/enums";
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

// System page definitions (slug + admin route)
const SYSTEM_PAGES: Array<{
  systemPageType: SystemPageType;
  slug: string;
  route: string;
}> = [
  {
    systemPageType: SystemPageType.ABOUT_US,
    slug: "about-us",
    route: "/admin/about-us",
  },
  {
    systemPageType: SystemPageType.OUR_TEAM,
    slug: "our-team",
    route: "/admin/our-team",
  },
  // NOTE: Landing page is managed separately and should not appear in the static pages list.
  // If needed in future, uncomment and adjust as required.
  // {
  //   systemPageType: SystemPageType.LANDING_PAGE,
  //   slug: "landing-page",
  //   route: "/admin/dashboard",
  // },
  {
    systemPageType: SystemPageType.MEMBERSHIP,
    slug: "membership",
    route: "/admin/membership",
  },
  {
    systemPageType: SystemPageType.BLOG,
    slug: "blog",
    route: "/admin/blog-cms",
  },
];


/**
 * Fetch actual data from database for system pages
 */
const fetchSystemPageData = async (
  systemPageType: SystemPageType
): Promise<{ title: any; content?: any } | null> => {
  try {
    switch (systemPageType) {
      case SystemPageType.ABOUT_US: {
        const aboutUs = await AboutUs.findOne({ isDeleted: false }).lean();
        if (aboutUs && aboutUs.banner?.banner_title) {
          return {
            title: aboutUs.banner.banner_title,
            content: aboutUs.banner.banner_description || {},
          };
        }
        // Fallback title
        return {
          title: { en: "About Us", nl: "Over Ons", de: "Über Uns", fr: "À Propos de Nous", es: "Acerca de Nosotros" },
        };
      }

      case SystemPageType.OUR_TEAM: {
        const ourTeam = await OurTeamPage.findOne().lean();
        if (ourTeam && ourTeam.banner?.title) {
          return {
            title: ourTeam.banner.title,
            content: ourTeam.banner.subtitle || {},
          };
        }
        // Fallback title
        return {
          title: { en: "Our Team", nl: "Ons Team", de: "Unser Team", fr: "Notre Équipe", es: "Nuestro Equipo" },
        };
      }

      case SystemPageType.LANDING_PAGE: {
        const landingPage = await LandingPages.findOne({
          isActive: true,
          isDeleted: false,
        })
          .sort({ createdAt: -1 })
          .lean();
        if (landingPage && landingPage.heroSection?.title) {
          return {
            title: landingPage.heroSection.title,
            content: landingPage.heroSection.description || {},
          };
        }
        // Fallback title
        return {
          title: { en: "Home/Landing Page", nl: "Home/Landing Pagina", de: "Startseite/Landing-Seite", fr: "Page d'Accueil/Landing", es: "Página de Inicio/Landing" },
        };
      }

      case SystemPageType.MEMBERSHIP: {
        const membershipCms = await MembershipCms.findOne({
          isActive: true,
          isDeleted: false,
        })
          .sort({ createdAt: -1 })
          .lean();
        if (membershipCms && membershipCms.heading) {
          return {
            title: membershipCms.heading,
            content: membershipCms.description || {},
          };
        }
        // Fallback title
        return {
          title: { en: "Membership", nl: "Lidmaatschap", de: "Mitgliedschaft", fr: "Adhésion", es: "Membresía" },
        };
      }

      case SystemPageType.BLOG: {
        // Blog is just a static entry, use default title
        return {
          title: { en: "Blog", nl: "Blog", de: "Blog", fr: "Blog", es: "Blog" },
        };
      }

      default:
        return null;
    }
  } catch (error) {
    // Return fallback on error
    return null;
  }
};

/**
 * Ensure system pages exist in database
 */
const ensureSystemPagesExist = async (): Promise<void> => {
  for (const systemPage of SYSTEM_PAGES) {
    const existing = await StaticPages.findOne({
      isSystemPage: true,
      systemPageType: systemPage.systemPageType,
      isDeleted: false,
    });

    if (!existing) {
      const pageData = await fetchSystemPageData(systemPage.systemPageType);

      await StaticPages.create({
        slug: systemPage.slug,
        title: pageData?.title || { en: systemPage.slug },
        content: pageData?.content || {},
        status: StaticPageStatus.PUBLISHED,
        seo: {},
        isSystemPage: true,
        systemPageType: systemPage.systemPageType,
        route: systemPage.route,
      });
    }
  }
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
        isSystemPage: false, // Explicitly set to false for regular pages
        createdBy: requesterId,
      });

      // Ensure isSystemPage is explicitly set in response
      const pageWithFlag = {
        ...staticPage.toObject(),
        isSystemPage: false,
        systemPageType: undefined,
      };

      res.apiCreated({ staticPage: pageWithFlag }, "Static page created successfully");
    }
  );

  /**
   * Get paginated list of all static pages (Admin view)
   * System pages are always included and shown first
   */
  getStaticPages = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      // Ensure system pages exist
      await ensureSystemPagesExist();

      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { status, search } = req.query as {
        status?: StaticPageStatus;
        search?: string;
      };

      const baseFilter: Record<string, any> = {
        isDeleted: false,
      };

      if (search) {
        baseFilter.$or = [
          { "title.en": { $regex: search, $options: "i" } },
          { "title.nl": { $regex: search, $options: "i" } },
          { "title.de": { $regex: search, $options: "i" } },
          { "title.fr": { $regex: search, $options: "i" } },
          { "title.es": { $regex: search, $options: "i" } },
          { slug: { $regex: search, $options: "i" } },
        ];
      }

      // Get system pages separately (always show first, ignore status filter)
      const systemPagesFilter = {
        ...baseFilter,
        isSystemPage: true,
      };

      // Get regular pages (apply status filter if provided)
      const regularPagesFilter: Record<string, any> = {
        ...baseFilter,
        $or: [
          { isSystemPage: { $exists: false } },
          { isSystemPage: false },
        ],
      };

      if (status) {
        regularPagesFilter.status = status;
      }

      const sortOptions: Record<string, 1 | -1> = {
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      // Fetch system pages and regular pages
      const [systemPagesFromDb, regularPages, systemPagesCount, regularPagesCount] =
        await Promise.all([
          StaticPages.find(systemPagesFilter)
            .sort({ systemPageType: 1 }) // Sort by system page type order
            .lean(),
          StaticPages.find(regularPagesFilter)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean(),
          StaticPages.countDocuments(systemPagesFilter),
          StaticPages.countDocuments(regularPagesFilter),
        ]);

      // Fetch actual data from database for each system page and merge
      const systemPages = await Promise.all(
        systemPagesFromDb.map(async (page) => {
          const actualData = await fetchSystemPageData(
            page.systemPageType as SystemPageType
          );
      
          const systemConfig = SYSTEM_PAGES.find(
            (p) => p.systemPageType === page.systemPageType
          );
      
          return {
            ...page,
            title: actualData?.title || page.title,
            content: actualData?.content || page.content,
            isSystemPage: true,
            systemPageType: page.systemPageType,
            route: systemConfig?.route || page.route || null,
          };
        })
      );      

      // Ensure regular pages have isSystemPage: false explicitly set
      const regularPagesWithFlag = regularPages.map((page) => ({
        ...page,
        isSystemPage: page.isSystemPage || false,
        systemPageType: page.systemPageType || undefined,
        route: page.route || null,
      }));      

      // Combine: system pages first, then regular pages
      const allPages = [...systemPages, ...regularPagesWithFlag];
      const total = systemPagesCount + regularPagesCount;

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(allPages, pagination, "Static pages retrieved");
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

      // Ensure isSystemPage is explicitly set in response
      const pageWithFlag = {
        ...staticPage,
        isSystemPage: staticPage.isSystemPage || false,
        systemPageType: staticPage.systemPageType || undefined,
      };

      res.apiSuccess({ staticPage: pageWithFlag }, "Static page retrieved successfully");
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

      // Prevent slug change for system pages
      if (staticPage.isSystemPage && slug && slug !== staticPage.slug) {
        throw new AppError(
          "Cannot change slug for system pages. System pages have fixed slugs.",
          400
        );
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

      // Prevent status change for system pages (they are always published)
      if (staticPage.isSystemPage && status) {
        // System pages are always published, ignore status change
        // Don't throw error, just ignore the status update
      } else if (status) {
        // Only update status for non-system pages
        staticPage.status = status as StaticPageStatus;
      }

      // Handle slug update with uniqueness check (only for non-system pages)
      if (slug && slug !== staticPage.slug && !staticPage.isSystemPage) {
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

      // Prevent status toggle for system pages
      if (staticPage.isSystemPage) {
        throw new AppError(
          "Cannot change status for system pages. System pages are always published.",
          400
        );
      }

      staticPage.status = status;

      if (requesterId) {
        staticPage.updatedBy = requesterId;
      }

      await staticPage.save();

      // Ensure isSystemPage is explicitly set in response
      const pageWithFlag = {
        ...staticPage.toObject(),
        isSystemPage: staticPage.isSystemPage || false,
        systemPageType: staticPage.systemPageType || undefined,
      };

      res.apiSuccess(
        { staticPage: pageWithFlag },
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

      // Prevent deletion of system pages
      if (staticPage.isSystemPage) {
        throw new AppError(
          "Cannot delete system pages. System pages are pre-defined and cannot be removed.",
          400
        );
      }

      staticPage.isDeleted = true;
      staticPage.deletedAt = new Date();
      await staticPage.save();

      res.apiSuccess(null, "Static page deleted successfully");
    }
  );
}

export const adminStaticPageController = new AdminStaticPageController();
