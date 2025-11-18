/**
 * @fileoverview Blog Controller
 * @description Controller for blog-related operations
 * @module controllers/blogController
 */

import { Request, Response } from "express";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { Blogs, IBlog } from "@/models/cms/blogs.model";
import { BlogCategories } from "@/models/cms/blogCategories.model";
import { BlogStatus } from "@/models/enums";
import mongoose from "mongoose";

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
   * Get paginated list of blogs with filters
   * Supports: category, tag, search by title, sort by latest
   */
  getBlogs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { category, tag, search, lang = "en" } = req.query;

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

      // Search by title (supports both en and nl)
      if (search) {
        filter.$or = [
          { "title.en": { $regex: search, $options: "i" } },
          { "title.nl": { $regex: search, $options: "i" } },
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
          "slug title excerpt featuredImage categoryId tags seo viewCount likeCount commentCount publishedAt createdAt"
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
                id: blog.categoryId._id,
                slug: blog.categoryId.slug,
                title:
                  blog.categoryId.title?.[lang as "en" | "nl"] ||
                  blog.categoryId.title?.en ||
                  "",
              }
            : null;

        return {
          slug: blog.slug,
          title: blog.title?.[lang as "en" | "nl"] || blog.title?.en || "",
          content:
            blog.excerpt?.[lang as "en" | "nl"] || blog.excerpt?.en || "",
          coverImage: blog.featuredImage?.url || null,
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
   * Get blog details by slug or ID
   */
  getBlogDetails = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { slugOrId } = req.params;
      const { lang = "en" } = req.query;

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
        res.apiNotFound("Blog not found");
        return;
      }

      // Transform blog to include required fields
      const category =
        blog.categoryId &&
        typeof blog.categoryId === "object" &&
        !(blog.categoryId instanceof mongoose.Types.ObjectId)
          ? {
              id: (blog.categoryId as any)._id,
              slug: (blog.categoryId as any).slug,
              title:
                (blog.categoryId as any).title?.[lang as "en" | "nl"] ||
                (blog.categoryId as any).title?.en ||
                "",
            }
          : null;

      const author =
        blog.authorId &&
        typeof blog.authorId === "object" &&
        !(blog.authorId instanceof mongoose.Types.ObjectId)
          ? {
              id: (blog.authorId as any)._id,
              name: (blog.authorId as any).name || "",
              email: (blog.authorId as any).email || "",
            }
          : null;

      const transformedBlog = {
        slug: blog.slug,
        title: blog.title?.[lang as "en" | "nl"] || blog.title?.en || "",
        content: blog.content?.[lang as "en" | "nl"] || blog.content?.en || "",
        coverImage: blog.featuredImage?.url || null,
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
   * Get list of blog categories
   */
  getBlogCategories = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { lang = "en" } = req.query;

      const categories = await BlogCategories.find({
        isDeleted: false,
      })
        .sort({ sortOrder: 1, createdAt: 1 })
        .select("slug title sortOrder")
        .lean();

      const transformedCategories = categories.map((category) => ({
        id: category._id,
        slug: category.slug,
        title: category.title[lang as "en" | "nl"] || category.title.en || "",
        sortOrder: category.sortOrder || 0,
      }));

      res.apiSuccess(
        { categories: transformedCategories },
        "Blog categories retrieved successfully"
      );
    }
  );

  /**
   * Get popular or latest blogs
   * Returns top 3-5 blogs based on views/reads
   */
  getPopularBlogs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { limit = 5, type = "popular", lang = "en" } = req.query;
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
          "slug title excerpt featuredImage categoryId tags seo viewCount likeCount commentCount publishedAt"
        )
        .sort(sortOptions)
        .limit(blogLimit)
        .lean();

      // Transform blogs to include required fields
      const transformedBlogs = blogs.map((blog: any) => {
        const category =
          blog.categoryId &&
          typeof blog.categoryId === "object" &&
          !(blog.categoryId instanceof mongoose.Types.ObjectId)
            ? {
                id: blog.categoryId._id,
                slug: blog.categoryId.slug,
                title:
                  blog.categoryId.title?.[lang as "en" | "nl"] ||
                  blog.categoryId.title?.en ||
                  "",
              }
            : null;

        return {
          slug: blog.slug,
          title: blog.title?.[lang as "en" | "nl"] || blog.title?.en || "",
          content:
            blog.excerpt?.[lang as "en" | "nl"] || blog.excerpt?.en || "",
          coverImage: blog.featuredImage?.url || null,
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
        res.apiNotFound("Blog not found");
        return;
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
