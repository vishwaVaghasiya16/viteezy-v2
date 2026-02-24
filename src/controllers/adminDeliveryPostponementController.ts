import { Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import {
  DeliveryPostponements,
  Orders,
  Subscriptions,
} from "@/models/commerce";
import { PostponementStatus } from "@/models/enums";
import { emailService } from "@/services/emailService";
import { logger } from "@/utils/logger";
import type { AuthenticatedRequest } from "@/types";

/**
 * Admin Delivery Postponement Approval Flow
 * - List all requests (user, plan, current delivery date, requested date, status)
 * - Approve (optionally with modified date)
 * - Reject (with mandatory reason)
 * - Email user on approval, rejection, or date update
 */
class AdminDeliveryPostponementController {
  /**
   * List all postponement requests (admin)
   * GET /api/v1/admin/postponements
   */
  listAll = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { status, page, limit } = req.query as {
      status?: string;
      page?: string;
      limit?: string;
    };
    const pagination = getPaginationOptions(req);
    const skip = (pagination.page - 1) * pagination.limit;

    const query: Record<string, unknown> = { isDeleted: false };
    if (status) query.status = status;

    const [postponements, total] = await Promise.all([
      DeliveryPostponements.find(query)
        .populate("userId", "firstName lastName email")
        .populate("orderId", "orderNumber planType selectedPlanDays")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .lean(),
      DeliveryPostponements.countDocuments(query),
    ]);

    const orderIds = (postponements as any[])
      .map((p) => (p.orderId as any)?._id || p.orderId)
      .filter(Boolean);
    const subscriptions = await Subscriptions.find({
      orderId: { $in: orderIds },
      isDeleted: { $ne: true },
    })
      .select("orderId nextDeliveryDate cycleDays subscriptionNumber")
      .lean();

    const orderIdToSub = new Map<string | number, any>();
    subscriptions.forEach((s: any) => {
      const oid = s.orderId?.toString();
      if (oid) orderIdToSub.set(oid, s);
    });

    const list = (postponements as any[]).map((p) => {
      const user = p.userId as any;
      const order = p.orderId as any;
      const orderIdStr = order?._id?.toString() || (p.orderId && (p.orderId as mongoose.Types.ObjectId).toString());
      const sub = orderIdStr ? orderIdToSub.get(orderIdStr) : null;
      const planLabel = order?.planType === "Subscription"
        ? sub
          ? `Subscription (${sub.cycleDays || order?.selectedPlanDays || "—"} days)`
          : `Subscription`
        : order?.planType || "—";
      return {
        id: p._id,
        user: user
          ? {
              id: user._id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
            }
          : null,
        orderNumber: order?.orderNumber,
        plan: planLabel,
        currentDeliveryDate: sub?.nextDeliveryDate ?? p.originalDeliveryDate,
        originalDeliveryDate: p.originalDeliveryDate,
        requestedDeliveryDate: p.requestedDeliveryDate,
        approvedDeliveryDate: p.approvedDeliveryDate ?? undefined,
        status: p.status,
        reason: p.reason,
        adminNotes: p.adminNotes,
        processedAt: p.processedAt,
        createdAt: p.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      message: "Postponement requests retrieved successfully",
      data: list,
      pagination: getPaginationMeta(pagination.page, pagination.limit, total),
    });
  });

  /**
   * Approve postponement (optionally with modified delivery date)
   * POST /api/v1/admin/postponements/:id/approve
   */
  approve = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { approvedDeliveryDate } = req.body || {};
    const adminId = req.user?._id;
    if (!adminId) throw new AppError("Unauthorized", 401);

    const postponement = await DeliveryPostponements.findOne({
      _id: new mongoose.Types.ObjectId(id),
      isDeleted: false,
    })
      .populate("userId", "firstName lastName email")
      .populate("orderId", "orderNumber planType");

    if (!postponement) throw new AppError("Postponement request not found", 404);
    if (postponement.status !== PostponementStatus.PENDING) {
      throw new AppError(`Cannot approve: request is ${postponement.status}`, 400);
    }

    const finalDate = approvedDeliveryDate
      ? new Date(approvedDeliveryDate)
      : new Date(postponement.requestedDeliveryDate);

    postponement.status = PostponementStatus.APPROVED;
    postponement.approvedDeliveryDate = finalDate;
    postponement.processedAt = new Date();
    postponement.processedBy = new mongoose.Types.ObjectId(adminId);
    await postponement.save();

    const subscription = await Subscriptions.findOne({
      orderId: postponement.orderId,
      isDeleted: { $ne: true },
    });
    if (subscription) {
      subscription.nextDeliveryDate = finalDate;
      await subscription.save();
      logger.info(
        `Subscription ${subscription.subscriptionNumber} nextDeliveryDate updated to ${finalDate.toISOString()} (postponement ${id})`
      );
    }

    const user = postponement.userId as any;
    const email = user?.email;
    const dateModified = !!approvedDeliveryDate;
    try {
      if (email) {
        await emailService.sendPostponementApprovedEmail({
          to: email,
          userName: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Customer",
          orderNumber: (postponement.orderId as any)?.orderNumber || "",
          approvedDeliveryDate: finalDate,
          wasDateModified: dateModified,
          requestedDeliveryDate: postponement.requestedDeliveryDate,
        });
      }
    } catch (e: any) {
      logger.error(`Failed to send postponement approved email: ${e?.message}`);
    }

    res.status(200).json({
      success: true,
      message: dateModified
        ? "Postponement approved with updated delivery date"
        : "Postponement approved successfully",
      data: {
        postponement: {
          id: postponement._id,
          status: postponement.status,
          approvedDeliveryDate: postponement.approvedDeliveryDate,
          processedAt: postponement.processedAt,
        },
      },
    });
  });

  /**
   * Reject postponement (mandatory reason)
   * POST /api/v1/admin/postponements/:id/reject
   */
  reject = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body || {};
    const adminId = req.user?._id;
    if (!adminId) throw new AppError("Unauthorized", 401);

    const postponement = await DeliveryPostponements.findOne({
      _id: new mongoose.Types.ObjectId(id),
      isDeleted: false,
    })
      .populate("userId", "firstName lastName email")
      .populate("orderId", "orderNumber");

    if (!postponement) throw new AppError("Postponement request not found", 404);
    if (postponement.status !== PostponementStatus.PENDING) {
      throw new AppError(`Cannot reject: request is ${postponement.status}`, 400);
    }

    const reasonStr = (reason && String(reason).trim()) || "";
    if (!reasonStr) throw new AppError("Rejection reason is required", 400);

    postponement.status = PostponementStatus.REJECTED;
    postponement.adminNotes = reasonStr;
    postponement.processedAt = new Date();
    postponement.processedBy = new mongoose.Types.ObjectId(adminId);
    await postponement.save();

    const user = postponement.userId as any;
    const email = user?.email;
    try {
      if (email) {
        await emailService.sendPostponementRejectedEmail({
          to: email,
          userName: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Customer",
          orderNumber: (postponement.orderId as any)?.orderNumber || "",
          reason: reasonStr,
          requestedDeliveryDate: postponement.requestedDeliveryDate,
        });
      }
    } catch (e: any) {
      logger.error(`Failed to send postponement rejected email: ${e?.message}`);
    }

    res.status(200).json({
      success: true,
      message: "Postponement rejected successfully",
      data: {
        postponement: {
          id: postponement._id,
          status: postponement.status,
          processedAt: postponement.processedAt,
        },
      },
    });
  });
}

export const adminDeliveryPostponementController =
  new AdminDeliveryPostponementController();
