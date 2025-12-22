import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { getPaginationMeta } from "@/utils/pagination";
import { MembershipPlans } from "@/models/commerce/membershipPlans.model";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    role?: string;
    email?: string;
  };
}

class AdminMembershipPlanController {
  /**
   * Escape special regex chars in user input
   */
  private escapeRegex(value: string): string {
    return value.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  }

  /**
   * Check if membership plan name is already used
   */
  private async isNameTaken(
    name: string,
    excludeId?: mongoose.Types.ObjectId
  ): Promise<boolean> {
    if (!name) {
      return false;
    }

    return !!(await MembershipPlans.findOne({
      name: {
        $regex: new RegExp(`^${this.escapeRegex(name)}$`, "i"),
      },
      isDeleted: false,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).lean());
  }

  /**
   * Sanitize input text to slug-friendly format
   */
  private sanitizeSlug(text: string): string {
    if (!text) {
      return "";
    }
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Generate unique slug based on provided text
   */
  private async generateUniqueSlug(
    text: string,
    excludeId?: mongoose.Types.ObjectId
  ): Promise<string> {
    const baseSlug = this.sanitizeSlug(text);

    if (!baseSlug) {
      throw new AppError("Name is required to generate slug", 400);
    }

    let candidate = baseSlug;
    let counter = 1;

    while (
      await MembershipPlans.findOne({
        slug: candidate,
        isDeleted: false,
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      })
    ) {
      candidate = `${baseSlug}-${counter++}`;
    }

    return candidate;
  }

  /**
   * Create membership plan (Admin only)
   * @route POST /api/v1/admin/membership-plans
   * @access Private (Admin)
   */
  createMembershipPlan = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        name,
        slug,
        shortDescription,
        description,
        price,
        interval,
        durationDays,
        benefits,
        isActive,
        isAutoRenew,
        metadata,
        // New: universal discount % for products
        discountPercentage,
      } = req.body;

      if (!name) {
        throw new AppError("Name is required", 400);
      }

      if (await this.isNameTaken(name)) {
        throw new AppError(
          "Membership plan with this name already exists",
          400
        );
      }

      let slugValue: string;
      if (slug) {
        const sanitizedSlug = this.sanitizeSlug(slug);
        if (!sanitizedSlug) {
          throw new AppError("Slug cannot be empty", 400);
        }

        const existingPlan = await MembershipPlans.findOne({
          slug: sanitizedSlug,
          isDeleted: false,
        });

        if (existingPlan) {
          throw new AppError(
            "Membership plan with this slug already exists",
            400
          );
        }

        slugValue = sanitizedSlug;
      } else {
        slugValue = await this.generateUniqueSlug(name);
      }

      const plan = await MembershipPlans.create({
        name,
        slug: slugValue,
        shortDescription,
        description,
        price,
        interval,
        durationDays,
        benefits: benefits || [],
        isActive: isActive !== undefined ? isActive : true,
        isAutoRenew: isAutoRenew !== undefined ? isAutoRenew : true,
        metadata: {
          ...(metadata || {}),
          ...(discountPercentage !== undefined
            ? { discountPercentage: Number(discountPercentage) }
            : {}),
        },
        createdBy: new mongoose.Types.ObjectId(req.user?._id),
        updatedBy: new mongoose.Types.ObjectId(req.user?._id),
      });

      logger.info(
        `Membership plan created: ${plan._id} by admin ${req.user?._id}`
      );

      res.status(201).json({
        success: true,
        message: "Membership plan created successfully",
        data: { plan },
      });
    }
  );

  /**
   * Get all membership plans (Admin only)
   * @route GET /api/v1/admin/membership-plans
   * @access Private (Admin)
   */
  getAllMembershipPlans = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { page = 1, limit = 10, isActive, search } = req.query;

      const query: any = { isDeleted: false };

      if (isActive !== undefined) {
        query.isActive = isActive === "true";
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { slug: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [plans, total] = await Promise.all([
        MembershipPlans.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        MembershipPlans.countDocuments(query),
      ]);

      const paginationMeta = getPaginationMeta(
        Number(page),
        Number(limit),
        total
      );
      res.status(200).json({
        success: true,
        message: "Membership plans retrieved successfully",
        data: {
          plans,
        },
        meta: {
          pagination: paginationMeta,
        },
      });
    }
  );

  /**
   * Get membership plan by ID (Admin only)
   * @route GET /api/v1/admin/membership-plans/:id
   * @access Private (Admin)
   */
  getMembershipPlanById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid membership plan ID", 400);
      }

      const plan = await MembershipPlans.findOne({
        _id: new mongoose.Types.ObjectId(id),
        isDeleted: false,
      }).lean();

      if (!plan) {
        throw new AppError("Membership plan not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Membership plan retrieved successfully",
        data: { plan },
      });
    }
  );

  /**
   * Update membership plan (Admin only)
   * @route PUT /api/v1/admin/membership-plans/:id
   * @access Private (Admin)
   */
  updateMembershipPlan = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const {
        name,
        slug,
        shortDescription,
        description,
        price,
        interval,
        durationDays,
        benefits,
        isActive,
        isAutoRenew,
        metadata,
        // New: universal discount % for products
        discountPercentage,
      } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid membership plan ID", 400);
      }

      const plan = await MembershipPlans.findOne({
        _id: new mongoose.Types.ObjectId(id),
        isDeleted: false,
      });

      if (!plan) {
        throw new AppError("Membership plan not found", 404);
      }

      // Enforce unique name if it is being changed
      if (name !== undefined && name !== plan.name) {
        if (!name) {
          throw new AppError("Name cannot be empty", 400);
        }
        if (await this.isNameTaken(name, plan._id as mongoose.Types.ObjectId)) {
          throw new AppError(
            "Membership plan with this name already exists",
            400
          );
        }
      }

      // Update fields
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (slug !== undefined) {
        if (!slug) {
          throw new AppError("Slug cannot be empty", 400);
        }
        const sanitizedSlug = this.sanitizeSlug(slug);
        if (!sanitizedSlug) {
          throw new AppError("Slug cannot be empty", 400);
        }

        const existingPlan = await MembershipPlans.findOne({
          slug: sanitizedSlug,
          _id: { $ne: plan._id },
          isDeleted: false,
        });

        if (existingPlan) {
          throw new AppError(
            "Membership plan with this slug already exists",
            400
          );
        }

        updateData.slug = sanitizedSlug;
      } else if (name !== undefined && name !== plan.name) {
        updateData.slug = await this.generateUniqueSlug(
          name,
          plan._id as mongoose.Types.ObjectId
        );
      }
      if (shortDescription !== undefined)
        updateData.shortDescription = shortDescription;
      if (description !== undefined) updateData.description = description;
      if (price !== undefined) updateData.price = price;
      if (interval !== undefined) updateData.interval = interval;
      if (durationDays !== undefined) updateData.durationDays = durationDays;
      if (benefits !== undefined) updateData.benefits = benefits;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (isAutoRenew !== undefined) updateData.isAutoRenew = isAutoRenew;
      if (metadata !== undefined) updateData.metadata = metadata;
      if (discountPercentage !== undefined) {
        updateData.metadata = {
          ...(updateData.metadata || plan.metadata || {}),
          discountPercentage: Number(discountPercentage),
        };
      }

      if (req.user?._id) {
        updateData.updatedBy = new mongoose.Types.ObjectId(req.user._id);
      }

      const updatedPlan = await MembershipPlans.findByIdAndUpdate(
        plan._id,
        updateData,
        { new: true }
      );

      if (!updatedPlan) {
        throw new AppError("Failed to update membership plan", 500);
      }

      logger.info(
        `Membership plan updated: ${updatedPlan._id} by admin ${req.user?._id}`
      );

      res.status(200).json({
        success: true,
        message: "Membership plan updated successfully",
        data: { plan: updatedPlan },
      });
    }
  );

  /**
   * Delete membership plan (Admin only) - Soft delete
   * @route DELETE /api/v1/admin/membership-plans/:id
   * @access Private (Admin)
   */
  deleteMembershipPlan = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid membership plan ID", 400);
      }

      const plan = await MembershipPlans.findOne({
        _id: new mongoose.Types.ObjectId(id),
        isDeleted: false,
      });

      if (!plan) {
        throw new AppError("Membership plan not found", 404);
      }

      // Soft delete
      const updateData: any = {
        isDeleted: true,
        deletedAt: new Date(),
      };

      if (req.user?._id) {
        updateData.updatedBy = new mongoose.Types.ObjectId(req.user._id);
      }

      await MembershipPlans.findByIdAndUpdate(plan._id, updateData);

      logger.info(
        `Membership plan deleted: ${plan._id} by admin ${req.user?._id}`
      );

      res.status(200).json({
        success: true,
        message: "Membership plan deleted successfully",
      });
    }
  );
}

export const adminMembershipPlanController =
  new AdminMembershipPlanController();
