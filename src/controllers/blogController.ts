/**
 * @fileoverview Blog Controller
 * @description Controller for blog-related operations
 * @module controllers/blogController
 */

import { Request, Response } from "express";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Blogs, IBlog } from "@/models/cms/blogs.model";
import { BlogCategories } from "@/models/cms/blogCategories.model";
import { BlogStatus } from "@/models/enums";
import { User } from "@/models/index.model";
import mongoose from "mongoose";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    language?: string;
  };
}

/**
 * Map user language preference to language code
 * User table stores: "English", "Dutch", "German", "French", "Spanish", "Italian", "Portuguese"
 * API uses: "en", "nl", "de", "fr", "es" (only supported languages in I18n types)
 * Italian and Portuguese fallback to English
 */
const mapLanguageToCode = (
  language?: string
): "en" | "nl" | "de" | "fr" | "es" => {
  const languageMap: Record<string, "en" | "nl" | "de" | "fr" | "es"> = {
    English: "en",
    Dutch: "nl",
    German: "de",
    French: "fr",
    Spanish: "es",
    Italian: "en", // Fallback to English
    Portuguese: "en", // Fallback to English
  };

  if (!language) {
    return "en"; // Default to English
  }

  return languageMap[language] || "en";
};

// Type for populated category
interface PopulatedCategory {
  _id: mongoose.Types.ObjectId;
  slug: string;
  title: { en?: string; nl?: string };
}

// Type for populated author
interface PopulatedAuthor {
  _id: mongoose.Types.ObjectId;
  name?: string;
  email?: string;
}

// Type for blog with populated fields
interface BlogWithPopulated extends Omit<IBlog, "categoryId" | "authorId"> {
  categoryId: PopulatedCategory | mongoose.Types.ObjectId | null;
  authorId: PopulatedAuthor | mongoose.Types.ObjectId | null;
}

class BlogController {
  /**
   * Get paginated list of blogs with filters (authenticated users only)
   * Supports: category, tag, search by title, sort by latest
   * Language is automatically detected from user's profile preference
   */
  getBlogs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;

      if (!authenticatedReq.user || !authenticatedReq.user._id) {
        throw new AppError("User not authenticated", 401);
      }

      // Get user's language preference from database
      const user = await User.findById(authenticatedReq.user._id)
        .select("language")
        .lean();

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Map user's language preference to language code
      const userLang = mapLanguageToCode(user.language);

      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { category, tag, search } = req.query;

      // Build filter object - only published blogs, not deleted
      const filter: any = {
        status: BlogStatus.PUBLISHED,
        isDeleted: false,
      };

      // Filter by category (can be categoryId or category slug)
      if (category) {
        if (mongoose.Types.ObjectId.isValid(category as string)) {
          filter.categoryId = new mongoose.Types.ObjectId(category as string);
        } else {
          // Find category by slug
          const categoryDoc = await BlogCategories.findOne({
            slug: category,
            isDeleted: false,
          });
          if (categoryDoc) {
            filter.categoryId = categoryDoc._id;
          } else {
            // If category not found, return empty result
            filter.categoryId = null;
          }
        }
      }

      // Filter by tag
      if (tag) {
        filter.tags = { $in: [tag] };
      }

      // Search by title (supports all languages)
      if (search) {
        filter.$or = [
          { "title.en": { $regex: search, $options: "i" } },
          { "title.nl": { $regex: search, $options: "i" } },
          { "title.de": { $regex: search, $options: "i" } },
          { "title.fr": { $regex: search, $options: "i" } },
          { "title.es": { $regex: search, $options: "i" } },
        ];
      }

      // Default sort by latest (publishedAt descending)
      const sortOptions: any = { publishedAt: -1, createdAt: -1 };
      if (sort && typeof sort === "object") {
        Object.assign(sortOptions, sort);
      }

      // Get total count
      const total = await Blogs.countDocuments(filter);

      // Get blogs with pagination
      const blogs = await Blogs.find(filter)
        .populate("categoryId", "slug title")
        .populate("authorId", "name email")
        .select(
          "slug title excerpt coverImage categoryId tags seo viewCount likeCount commentCount publishedAt createdAt"
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      // Transform blogs to include required fields
      const transformedBlogs = blogs.map((blog: any) => {
        const category =
          blog.categoryId &&
          typeof blog.categoryId === "object" &&
          !(blog.categoryId instanceof mongoose.Types.ObjectId)
            ? {
                _id: blog.categoryId._id,
                slug: blog.categoryId.slug,
                title:
                  blog.categoryId.title?.[userLang] ||
                  blog.categoryId.title?.en ||
                  "",
              }
            : null;

        return {
          slug: blog.slug,
          title: blog.title?.[userLang] || blog.title?.en || "",
          content: blog.excerpt?.[userLang] || blog.excerpt?.en || "",
          coverImage: blog.coverImage || null,
          category,
          tags: blog.tags || [],
          metaTitle: blog.seo?.title || "",
          metaDescription: blog.seo?.description || "",
          metaKeywords: blog.seo?.keywords || "",
          viewCount: blog.viewCount || 0,
          likeCount: blog.likeCount || 0,
          commentCount: blog.commentCount || 0,
          publishedAt: blog.publishedAt || blog.createdAt,
        };
      });

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(
        transformedBlogs,
        pagination,
        "Blogs retrieved successfully"
      );
    }
  );

  /**
   * Get blog details by slug or ID (authenticated users only)
   * Language is automatically detected from user's profile preference
   */
  getBlogDetails = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;

      if (!authenticatedReq.user || !authenticatedReq.user._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { slugOrId } = req.params;

      // Get user's language preference from database
      const user = await User.findById(authenticatedReq.user._id)
        .select("language")
        .lean();

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Map user's language preference to language code
      const userLang = mapLanguageToCode(user.language);

      // Build query - can be slug or ID
      const query: any = {
        status: BlogStatus.PUBLISHED,
        isDeleted: false,
      };

      if (mongoose.Types.ObjectId.isValid(slugOrId)) {
        query._id = new mongoose.Types.ObjectId(slugOrId);
      } else {
        query.slug = slugOrId;
      }

      const blog = await Blogs.findOne(query)
        .populate("categoryId", "slug title")
        .populate("authorId", "name email")
        .lean();

      if (!blog) {
        throw new AppError("Blog not found", 404);
      }

      // Transform blog to show only user's language content
      const category =
        blog.categoryId &&
        typeof blog.categoryId === "object" &&
        !(blog.categoryId instanceof mongoose.Types.ObjectId)
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
        blog.authorId &&
        typeof blog.authorId === "object" &&
        !(blog.authorId instanceof mongoose.Types.ObjectId)
          ? {
              _id: (blog.authorId as any)._id,
              name: (blog.authorId as any).name || "",
              email: (blog.authorId as any).email || "",
            }
          : null;

      const transformedBlog = {
        slug: blog.slug,
        title: blog.title?.[userLang] || blog.title?.en || "",
        content: blog.content?.[userLang] || blog.content?.en || "",
        coverImage: blog.coverImage || null,
        category,
        tags: blog.tags || [],
        metaTitle: blog.seo?.title || "",
        metaDescription: blog.seo?.description || "",
        metaKeywords: blog.seo?.keywords || "",
        viewCount: blog.viewCount || 0,
        likeCount: blog.likeCount || 0,
        commentCount: blog.commentCount || 0,
        publishedAt: blog.publishedAt || blog.createdAt,
        author,
      };

      res.apiSuccess({ blog: transformedBlog }, "Blog retrieved successfully");
    }
  );

  /**
   * Get list of blog categories (authenticated users only)
   * Language is automatically detected from user's profile preference
   * Only shows data in user's selected language
   */
  getBlogCategories = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as any;

      if (!authenticatedReq.user || !authenticatedReq.user._id) {
        throw new AppError("User not authenticated", 401);
      }

      // Get user's language preference from database
      const user = await User.findById(authenticatedReq.user._id)
        .select("language")
        .lean();

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Map user's language preference to language code
      const languageMap: Record<string, "en" | "nl" | "de" | "fr" | "es"> = {
        English: "en",
        Dutch: "nl",
        German: "de",
        French: "fr",
        Spanish: "es",
        Italian: "en", // Fallback to English
        Portuguese: "en", // Fallback to English
      };

      const userLang = languageMap[user.language || "English"] || "en";

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

      // Transform categories to show only user's language content
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
   * Returns top 3-5 blogs based on views/reads
   * Language is automatically detected from user's profile preference
   */
  getPopularBlogs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;

      if (!authenticatedReq.user || !authenticatedReq.user._id) {
        throw new AppError("User not authenticated", 401);
      }

      // Get user's language preference from database
      const user = await User.findById(authenticatedReq.user._id)
        .select("language")
        .lean();

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Map user's language preference to language code
      const userLang = mapLanguageToCode(user.language);

      const { limit = 5, type = "popular" } = req.query;
      const blogLimit = Math.min(
        Math.max(parseInt(limit as string, 10) || 5, 3),
        5
      );

      const filter: any = {
        status: BlogStatus.PUBLISHED,
        isDeleted: false,
      };

      let sortOptions: any = {};

      if (type === "popular") {
        // Sort by viewCount descending
        sortOptions = { viewCount: -1, publishedAt: -1 };
      } else {
        // Sort by latest (publishedAt descending)
        sortOptions = { publishedAt: -1, createdAt: -1 };
      }

      const blogs = await Blogs.find(filter)
        .populate("categoryId", "slug title")
        .select(
          "slug title excerpt coverImage categoryId tags seo viewCount likeCount commentCount publishedAt"
        )
        .sort(sortOptions)
        .limit(blogLimit)
        .lean();

      // Transform blogs to show only user's language content
      const transformedBlogs = blogs.map((blog: any) => {
        const category =
          blog.categoryId &&
          typeof blog.categoryId === "object" &&
          !(blog.categoryId instanceof mongoose.Types.ObjectId)
            ? {
                _id: blog.categoryId._id,
                slug: blog.categoryId.slug,
                title:
                  blog.categoryId.title?.[userLang] ||
                  blog.categoryId.title?.en ||
                  "",
              }
            : null;

        return {
          slug: blog.slug,
          title: blog.title?.[userLang] || blog.title?.en || "",
          content: blog.excerpt?.[userLang] || blog.excerpt?.en || "",
          coverImage: blog.coverImage || null,
          category,
          tags: blog.tags || [],
          metaTitle: blog.seo?.title || "",
          metaDescription: blog.seo?.description || "",
          metaKeywords: blog.seo?.keywords || "",
          viewCount: blog.viewCount || 0,
          likeCount: blog.likeCount || 0,
          commentCount: blog.commentCount || 0,
          publishedAt: blog.publishedAt || blog.createdAt,
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
   * Can be called as a dedicated endpoint or used as middleware
   */
  incrementBlogViews = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { slugOrId } = req.params;

      // Build query - can be slug or ID
      const query: any = {
        status: BlogStatus.PUBLISHED,
        isDeleted: false,
      };

      if (mongoose.Types.ObjectId.isValid(slugOrId)) {
        query._id = new mongoose.Types.ObjectId(slugOrId);
      } else {
        query.slug = slugOrId;
      }

      const blog = await Blogs.findOneAndUpdate(
        query,
        { $inc: { viewCount: 1 } },
        { new: true }
      ).select("slug viewCount");

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
