/**
 * @fileoverview Blog Controller
 * @description Controller for blog-related operations
 * @module controllers/blogController
 */

import { Request, Response } from "express";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Blogs } from "@/models/cms/blogs.model";
import { BlogCategories } from "@/models/cms/blogCategories.model";
import { BlogBanner } from "@/models/cms/blogBanner.model";
import { GeneralSettings } from "@/models/cms/generalSettings.model";
import { User } from "@/models/index.model";
import mongoose from "mongoose";
import { markdownToHtml } from "@/utils/markdown";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    language?: string;
  };
}

/**
 * Map user language preference to language code
 */
const mapLanguageToCode = (
  language?: string
): "en" | "nl" | "de" | "fr" | "es" => {
  const languageMap: Record<string, "en" | "nl" | "de" | "fr" | "es"> = {
    English: "en",
    Spanish: "es",
    French: "fr",
    Dutch: "nl",
    German: "de",
  };

  if (!language) {
    return "en";
  }

  return languageMap[language] || "en";
};

class BlogController {
  /**
   * Get paginated list of blogs with filters (optional authentication)
   */
  getBlogs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;

      const { lang } = req.query as {
        lang?: "en" | "nl" | "de" | "fr" | "es";
      };

      // Get language priority: query param > user token > default "en"
      let userLang: "en" | "nl" | "de" | "fr" | "es" = "en";

      if (lang) {
        // Use language from query parameter if provided
        userLang = lang;
      } else if (authenticatedReq.user?._id) {
        // Use language from user token if authenticated
        const user = await User.findById(authenticatedReq.user._id)
          .select("language")
          .lean();

        if (user) {
          userLang = mapLanguageToCode(user.language);
        }
      }

      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { category, search } = req.query;

      const filter: any = {
        isActive: true,
        isDeleted: false,
      };

      if (category) {
        if (mongoose.Types.ObjectId.isValid(category as string)) {
          filter.categoryId = new mongoose.Types.ObjectId(category as string);
        } else {
          const categoryDoc = await BlogCategories.findOne({
            slug: category,
            isDeleted: false,
          });
          if (categoryDoc) {
            filter.categoryId = categoryDoc._id;
          } else {
            filter.categoryId = null;
          }
        }
      }

      if (search) {
        filter.$or = [
          { "title.en": { $regex: search, $options: "i" } },
          { "title.nl": { $regex: search, $options: "i" } },
          { "seo.metaSlug": { $regex: search, $options: "i" } },
        ];
      }

      const sortOptions: any = { createdAt: -1 };
      if (sort && typeof sort === "object") {
        Object.assign(sortOptions, sort);
      }

      const [total, blogs, blogBanners, settings] = await Promise.all([
        Blogs.countDocuments(filter),
        Blogs.find(filter)
          .populate("categoryId", "slug title")
          .populate("authorId", "name email")
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        BlogBanner.find({ isDeleted: { $ne: true } })
          .sort({ createdAt: -1 })
          .lean(),
        GeneralSettings.findOne({
          isDeleted: { $ne: true },
        }).lean(),
      ]);

      const transformedBlogs = blogs.map((blog: any) => {
        const category =
          blog.categoryId && typeof blog.categoryId === "object"
            ? {
                _id: blog.categoryId._id,
                slug: blog.categoryId.slug,
                title:
                  blog.categoryId.title?.[userLang] ||
                  blog.categoryId.title?.en ||
                  "",
              }
            : null;

        const descriptionMarkdown =
          blog.description?.[userLang] || blog.description?.en || "";

        return {
          _id: blog._id,
          title: blog.title?.[userLang] || blog.title?.en || "",
          description: markdownToHtml(descriptionMarkdown),
          coverImage: blog.coverImage || null,
          category,
          seo: blog.seo || {},
          viewCount: blog.viewCount || 0,
          createdAt: blog.createdAt,
        };
      });

      // Transform blog banners with localized content
      const transformedBlogBanners = blogBanners.map((banner: any) => ({
        _id: banner._id,
        banner_image: banner.banner_image || null,
        heading: banner.heading?.[userLang] || banner.heading?.en || "",
        description:
          banner.description?.[userLang] || banner.description?.en || "",
        createdAt: banner.createdAt,
        updatedAt: banner.updatedAt,
      }));

      const pagination = getPaginationMeta(page, limit, total);

      // Send response with blogs, blog banners, and CMS settings
      res.status(200).json({
        success: true,
        message: "Blogs retrieved",
        data: { blogs: transformedBlogs, blogBanners: transformedBlogBanners },
        pagination,
      });
    }
  );

  /**
   * Get blog details by slug or ID (optional authentication)
   */
  getBlogDetails = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;

      const { slugOrId } = req.params;
      const { lang } = req.query as {
        lang?: "en" | "nl" | "de" | "fr" | "es";
      };

      // Get language priority: query param > user token > default "en"
      let userLang: "en" | "nl" | "de" | "fr" | "es" = "en";

      if (lang) {
        // Use language from query parameter if provided
        userLang = lang;
      } else if (authenticatedReq.user?._id) {
        // Use language from user token if authenticated
        const user = await User.findById(authenticatedReq.user._id)
          .select("language")
          .lean();

        if (user) {
          userLang = mapLanguageToCode(user.language);
        }
      }

      const query: any = {
        isActive: true,
        isDeleted: false,
      };

      if (mongoose.Types.ObjectId.isValid(slugOrId)) {
        query._id = new mongoose.Types.ObjectId(slugOrId);
      } else {
        query["seo.metaSlug"] = slugOrId;
      }

      const blog = await Blogs.findOne(query)
        .populate("categoryId", "slug title")
        .populate("authorId", "name email")
        .lean();

      if (!blog) {
        throw new AppError("Blog not found", 404);
      }

      const category =
        blog.categoryId && typeof blog.categoryId === "object"
          ? {
              _id: (blog.categoryId as any)._id,
              slug: (blog.categoryId as any).slug,
              title:
                (blog.categoryId as any).title?.[userLang] ||
                (blog.categoryId as any).title?.en ||
                "",
            }
          : null;

      const author =
        blog.authorId && typeof blog.authorId === "object"
          ? {
              _id: (blog.authorId as any)._id,
              name: (blog.authorId as any).name || "",
              email: (blog.authorId as any).email || "",
            }
          : null;

      const descriptionMarkdown =
        blog.description?.[userLang] || blog.description?.en || "";

      const transformedBlog = {
        _id: blog._id,
        title: blog.title?.[userLang] || blog.title?.en || "",
        description: markdownToHtml(descriptionMarkdown),
        coverImage: blog.coverImage || null,
        category,
        author,
        seo: blog.seo || {},
        viewCount: blog.viewCount || 0,
        createdAt: blog.createdAt,
      };

      res.apiSuccess({ blog: transformedBlog }, "Blog retrieved successfully");
    }
  );

  /**
   * Get list of blog categories (optional authentication)
   */
  getBlogCategories = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;

      const { status = "active", lang } = req.query as {
        status?: "active" | "all";
        lang?: "en" | "nl" | "de" | "fr" | "es";
      };

      // Get language priority: query param > user token > default "en"
      let userLang: "en" | "nl" | "de" | "fr" | "es" = "en";

      if (lang) {
        // Use language from query parameter if provided
        userLang = lang;
      } else if (authenticatedReq.user?._id) {
        // Use language from user token if authenticated
        const user = await User.findById(authenticatedReq.user._id)
          .select("language")
          .lean();

        if (user) {
          userLang = mapLanguageToCode(user.language);
        }
      }

      const filter: any = {
        isDeleted: false,
      };

      if (status !== "all") {
        filter.isActive = true;
      }

      const categories = await BlogCategories.find(filter)
        .sort({ createdAt: -1 })
        .select("slug title isActive")
        .lean();

      // Get blog counts for each category
      const categoryIds = categories.map((cat: any) => cat._id);
      const blogCounts = await Blogs.aggregate([
        {
          $match: {
            categoryId: { $in: categoryIds },
            isActive: true,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: "$categoryId",
            count: { $sum: 1 },
          },
        },
      ]);

      // Create a map of categoryId -> count
      const countMap = new Map<string, number>();
      blogCounts.forEach((item) => {
        if (item._id) {
          countMap.set(item._id.toString(), item.count);
        }
      });

      const transformedCategories = categories.map((category: any) => ({
        _id: category._id,
        slug: category.slug,
        title: category.title?.[userLang] || category.title?.en || "",
        isActive: category.isActive !== false,
        blogCount: countMap.get(category._id.toString()) || 0,
      }));

      res.apiSuccess(
        { categories: transformedCategories },
        "Blog categories retrieved successfully"
      );
    }
  );

  /**
   * Get popular or latest blogs (optional authentication)
   */
  getPopularBlogs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;

      const { lang } = req.query as {
        lang?: "en" | "nl" | "de" | "fr" | "es";
      };

      // Get language priority: query param > user token > default "en"
      let userLang: "en" | "nl" | "de" | "fr" | "es" = "en";

      if (lang) {
        // Use language from query parameter if provided
        userLang = lang;
      } else if (authenticatedReq.user?._id) {
        // Use language from user token if authenticated
        const user = await User.findById(authenticatedReq.user._id)
          .select("language")
          .lean();

        if (user) {
          userLang = mapLanguageToCode(user.language);
        }
      }

      const { limit = 5, type = "popular" } = req.query;
      const blogLimit = Math.min(
        Math.max(parseInt(limit as string, 10) || 5, 3),
        5
      );

      const filter: any = {
        isActive: true,
        isDeleted: false,
      };

      let sortOptions: any = {};

      if (type === "popular") {
        sortOptions = { viewCount: -1, createdAt: -1 };
      } else {
        sortOptions = { createdAt: -1 };
      }

      const blogs = await Blogs.find(filter)
        .populate("categoryId", "slug title")
        .sort(sortOptions)
        .limit(blogLimit)
        .lean();

      const transformedBlogs = blogs.map((blog: any) => {
        const category =
          blog.categoryId && typeof blog.categoryId === "object"
            ? {
                _id: blog.categoryId._id,
                slug: blog.categoryId.slug,
                title:
                  blog.categoryId.title?.[userLang] ||
                  blog.categoryId.title?.en ||
                  "",
              }
            : null;

        const descriptionMarkdown =
          blog.description?.[userLang] || blog.description?.en || "";

        return {
          _id: blog._id,
          title: blog.title?.[userLang] || blog.title?.en || "",
          description: markdownToHtml(descriptionMarkdown),
          coverImage: blog.coverImage || null,
          category,
          seo: blog.seo || {},
          viewCount: blog.viewCount || 0,
          createdAt: blog.createdAt,
        };
      });

      res.apiSuccess(
        { blogs: transformedBlogs },
        `${
          type === "popular" ? "Popular" : "Latest"
        } blogs retrieved successfully`
      );
    }
  );

  /**
   * Increment blog view count
   */
  incrementBlogViews = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { slugOrId } = req.params;

      const query: any = {
        isActive: true,
        isDeleted: false,
      };

      if (mongoose.Types.ObjectId.isValid(slugOrId)) {
        query._id = new mongoose.Types.ObjectId(slugOrId);
      } else {
        query["seo.metaSlug"] = slugOrId;
      }

      const blog = await Blogs.findOneAndUpdate(
        query,
        { $inc: { viewCount: 1 } },
        { new: true }
      ).select("seo.metaSlug viewCount");

      if (!blog) {
        throw new AppError("Blog not found", 404);
      }

      res.apiSuccess(
        { viewCount: blog.viewCount },
        "Blog view count incremented successfully"
      );
    }
  );
}

const blogController = new BlogController();
export { blogController as BlogController };
