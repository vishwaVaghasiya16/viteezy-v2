import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { getPaginationMeta } from "@/utils/pagination";
import SubscriptionPlanModel from "@/models/cms/subscriptionPlan.model";
import { SubscriptionPlanStatusEnum } from "@/models/enums";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    role?: string;
    email?: string;
  };
}

class AdminSubscriptionPlanController {
  /**
   * Create subscription plan (Admin only)
   * @route POST /api/v1/admin/subscription-plans
   * @access Private (Admin)
   */
  createSubscriptionPlan = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        title,
        durationInDays,
        status,
        hasDiscount,
        discountPercentage,
        freeShipping,
      } = req.body;

      // Validate discount percentage when hasDiscount is true
      if (hasDiscount && !discountPercentage) {
        throw new AppError(
          "discountPercentage is required when hasDiscount is enabled",
          400
        );
      }

      // Create subscription plan
      const subscriptionPlan = await SubscriptionPlanModel.create({
        title,
        durationInDays,
        status: status || SubscriptionPlanStatusEnum.ACTIVE,
        hasDiscount: hasDiscount || false,
        discountPercentage: hasDiscount ? discountPercentage : null,
        freeShipping: freeShipping || false,
      });

      logger.info(
        `Subscription plan created: ${subscriptionPlan._id} by admin ${req.user?._id}`
      );

      res.status(201).json({
        success: true,
        message: "Subscription plan created successfully",
        data: { subscriptionPlan },
      });
    }
  );

  /**
   * Get all subscription plans (Admin only)
   * @route GET /api/v1/admin/subscription-plans
   * @access Private (Admin)
   */
  getAllSubscriptionPlans = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        page = "1",
        limit = "10",
        status,
        search,
      } = req.query as {
        page?: string;
        limit?: string;
        status?: string;
        search?: string;
      };

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {
        isDeleted: { $ne: true }, // Exclude soft-deleted records
      };

      // Filter by status
      if (status) {
        query.status = status;
      }

      // Search functionality - by title
      if (search) {
        query.title = { $regex: search, $options: "i" };
      }

      const [plans, total] = await Promise.all([
        SubscriptionPlanModel.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        SubscriptionPlanModel.countDocuments(query),
      ]);

      const paginationMeta = getPaginationMeta(pageNum, limitNum, total);

      res.status(200).json({
        success: true,
        message: "Subscription plans retrieved successfully",
        data: plans,
        pagination: paginationMeta,
      });
    }
  );

  /**
   * Get subscription plan by ID (Admin only)
   * @route GET /api/v1/admin/subscription-plans/:id
   * @access Private (Admin)
   */
  getSubscriptionPlanById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid subscription plan ID", 400);
      }

      const subscriptionPlan = await SubscriptionPlanModel.findOne({
        _id: id,
        isDeleted: { $ne: true },
      }).lean();

      if (!subscriptionPlan) {
        throw new AppError("Subscription plan not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Subscription plan retrieved successfully",
        data: { subscriptionPlan },
      });
    }
  );

  /**
   * Update subscription plan (Admin only)
   * @route PUT /api/v1/admin/subscription-plans/:id
   * @access Private (Admin)
   */
  updateSubscriptionPlan = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const {
        title,
        durationInDays,
        status,
        hasDiscount,
        discountPercentage,
        freeShipping,
      } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid subscription plan ID", 400);
      }

      const subscriptionPlan = await SubscriptionPlanModel.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!subscriptionPlan) {
        throw new AppError("Subscription plan not found", 404);
      }

      // Validate discount percentage when hasDiscount is true
      if (hasDiscount !== undefined && hasDiscount && !discountPercentage) {
        throw new AppError(
          "discountPercentage is required when hasDiscount is enabled",
          400
        );
      }

      // Build update data
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (durationInDays !== undefined)
        updateData.durationInDays = durationInDays;
      if (status !== undefined) updateData.status = status;
      if (hasDiscount !== undefined) {
        updateData.hasDiscount = hasDiscount;
        // If hasDiscount is false, set discountPercentage to null
        if (!hasDiscount) {
          updateData.discountPercentage = null;
        } else if (discountPercentage !== undefined) {
          updateData.discountPercentage = discountPercentage;
        }
      } else if (discountPercentage !== undefined) {
        // If hasDiscount is not being updated but discountPercentage is
        if (subscriptionPlan.hasDiscount) {
          updateData.discountPercentage = discountPercentage;
        }
      }
      if (freeShipping !== undefined) updateData.freeShipping = freeShipping;

      const updatedPlan = await SubscriptionPlanModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedPlan) {
        throw new AppError("Failed to update subscription plan", 500);
      }

      logger.info(
        `Subscription plan updated: ${updatedPlan._id} by admin ${req.user?._id}`
      );

      res.status(200).json({
        success: true,
        message: "Subscription plan updated successfully",
        data: { subscriptionPlan: updatedPlan },
      });
    }
  );

  /**
   * Delete subscription plan (Admin only) - Soft delete
   * @route DELETE /api/v1/admin/subscription-plans/:id
   * @access Private (Admin)
   */
  deleteSubscriptionPlan = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid subscription plan ID", 400);
      }

      const subscriptionPlan = await SubscriptionPlanModel.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!subscriptionPlan) {
        throw new AppError("Subscription plan not found", 404);
      }

      // Perform soft delete
      subscriptionPlan.isDeleted = true;
      subscriptionPlan.deletedAt = new Date();
      await subscriptionPlan.save();

      logger.info(
        `Subscription plan soft deleted: ${id} by admin ${req.user?._id}`
      );

      res.status(200).json({
        success: true,
        message: "Subscription plan deleted successfully",
      });
    }
  );
}

export const adminSubscriptionPlanController =
  new AdminSubscriptionPlanController();
