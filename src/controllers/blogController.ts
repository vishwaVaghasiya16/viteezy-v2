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
   * Get paginated list of blogs with filters (authenticated users only)
   */
  getBlogs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;

      if (!authenticatedReq.user || !authenticatedReq.user._id) {
        throw new AppError("User not authenticated", 401);
      }

      const user = await User.findById(authenticatedReq.user._id)
        .select("language")
        .lean();

      if (!user) {
        throw new AppError("User not found", 404);
      }

      const userLang = mapLanguageToCode(user.language);

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

      const total = await Blogs.countDocuments(filter);

      const blogs = await Blogs.find(filter)
        .populate("categoryId", "slug title")
        .populate("authorId", "name email")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
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

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(transformedBlogs, pagination, "Blogs retrieved");
    }
  );

  /**
   * Get blog details by slug or ID (authenticated users only)
   */
  getBlogDetails = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;

      if (!authenticatedReq.user || !authenticatedReq.user._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { slugOrId } = req.params;

      const user = await User.findById(authenticatedReq.user._id)
        .select("language")
        .lean();

      if (!user) {
        throw new AppError("User not found", 404);
      }

      const userLang = mapLanguageToCode(user.language);

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
   * Get list of blog categories (authenticated users only)
   */
  getBlogCategories = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as any;

      if (!authenticatedReq.user || !authenticatedReq.user._id) {
        throw new AppError("User not authenticated", 401);
      }

      const user = await User.findById(authenticatedReq.user._id)
        .select("language")
        .lean();

      if (!user) {
        throw new AppError("User not found", 404);
      }

      const userLang = mapLanguageToCode(user.language);

      const { status = "active" } = req.query as {
        status?: "active" | "all";
      };

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

      const transformedCategories = categories.map((category: any) => ({
        _id: category._id,
        slug: category.slug,
        title: category.title?.[userLang] || category.title?.en || "",
        isActive: category.isActive !== false,
      }));

      res.apiSuccess(
        { categories: transformedCategories },
        "Blog categories retrieved successfully"
      );
    }
  );

  /**
   * Get popular or latest blogs (authenticated users only)
   */
  getPopularBlogs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;

      if (!authenticatedReq.user || !authenticatedReq.user._id) {
        throw new AppError("User not authenticated", 401);
      }

      const user = await User.findById(authenticatedReq.user._id)
        .select("language")
        .lean();

      if (!user) {
        throw new AppError("User not found", 404);
      }

      const userLang = mapLanguageToCode(user.language);

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
