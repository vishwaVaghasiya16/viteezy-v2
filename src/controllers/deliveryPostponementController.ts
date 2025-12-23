import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Orders, DeliveryPostponements } from "@/models/commerce";
import { OrderPlanType, PostponementStatus } from "@/models/enums";
import { emailService } from "@/services/emailService";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email?: string;
    name?: string;
  };
}

/**
 * Calculate the next delivery date based on subscription interval
 */
const calculateNextDeliveryDate = (
  startDate: Date,
  interval: string,
  currentDate: Date = new Date()
): Date => {
  const start = new Date(startDate);
  const now = new Date(currentDate);

  // Calculate how many intervals have passed since start
  let intervalsPassed = 0;
  const intervalLower = interval.toLowerCase();

  if (intervalLower.includes("month") || intervalLower === "monthly") {
    const monthsDiff =
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth());
    intervalsPassed = Math.floor(monthsDiff);
  } else if (intervalLower.includes("week") || intervalLower === "weekly") {
    const weeksDiff = Math.floor(
      (now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    intervalsPassed = weeksDiff;
  } else if (intervalLower.includes("day") || intervalLower === "daily") {
    const daysDiff = Math.floor(
      (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
    );
    intervalsPassed = daysDiff;
  }

  // Calculate next delivery date (current interval + 1)
  const nextDelivery = new Date(start);
  if (intervalLower.includes("month") || intervalLower === "monthly") {
    nextDelivery.setMonth(start.getMonth() + intervalsPassed + 1);
  } else if (intervalLower.includes("week") || intervalLower === "weekly") {
    nextDelivery.setDate(start.getDate() + (intervalsPassed + 1) * 7);
  } else if (intervalLower.includes("day") || intervalLower === "daily") {
    nextDelivery.setDate(start.getDate() + intervalsPassed + 1);
  }

  return nextDelivery;
};

/**
 * Calculate the end of current subscription cycle
 */
const calculateCycleEndDate = (
  startDate: Date,
  interval: string,
  currentDate: Date = new Date()
): Date => {
  const nextDelivery = calculateNextDeliveryDate(
    startDate,
    interval,
    currentDate
  );
  // Cycle ends just before next delivery
  const cycleEnd = new Date(nextDelivery);
  cycleEnd.setDate(cycleEnd.getDate() - 1);
  return cycleEnd;
};

class DeliveryPostponementController {
  /**
   * Create a delivery postponement request
   * @route POST /api/orders/:orderId/postpone-delivery
   * @access Private
   */
  createPostponement = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { orderId, requestedDeliveryDate, reason, metadata } = req.body;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Find the order
      const order = await Orders.findOne({
        _id: new mongoose.Types.ObjectId(orderId),
        userId,
        isDeleted: false,
      }).lean();

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      // Validate that it's a subscription order
      if (order.planType !== OrderPlanType.SUBSCRIPTION) {
        throw new AppError(
          "Delivery postponement is only available for subscription orders",
          400
        );
      }

      // Get subscription details from order metadata
      const planMetadata = order.metadata?.plan || {};
      const interval = planMetadata.interval || "monthly";
      const startDate = planMetadata.startDate
        ? new Date(planMetadata.startDate)
        : order.createdAt;

      // Calculate original next delivery date
      const originalDeliveryDate = calculateNextDeliveryDate(
        startDate,
        interval,
        new Date()
      );

      // Calculate cycle end date
      const cycleEndDate = calculateCycleEndDate(
        startDate,
        interval,
        new Date()
      );

      // Validate requested date is within subscription cycle
      const requestedDate = new Date(requestedDeliveryDate);
      if (requestedDate > cycleEndDate) {
        throw new AppError(
          `Requested delivery date must be within the current subscription cycle (before ${
            cycleEndDate.toISOString().split("T")[0]
          })`,
          400
        );
      }

      // Check if there's already a pending postponement for this order
      const existingPostponement = await DeliveryPostponements.findOne({
        orderId: new mongoose.Types.ObjectId(orderId),
        userId,
        status: PostponementStatus.PENDING,
        isDeleted: false,
      });

      if (existingPostponement) {
        throw new AppError(
          "A pending postponement request already exists for this order",
          400
        );
      }

      // Create postponement request
      const postponement = await DeliveryPostponements.create({
        orderId: new mongoose.Types.ObjectId(orderId),
        userId,
        originalDeliveryDate,
        requestedDeliveryDate: requestedDate,
        reason: reason?.trim(),
        status: PostponementStatus.PENDING,
        metadata: metadata || {},
      });

      // Send admin notification
      try {
        await this.sendAdminNotification(postponement, order, req.user);
      } catch (error: any) {
        logger.error("Failed to send admin notification for postponement:", {
          postponementId: postponement._id,
          error: error?.message,
        });
        // Don't fail the request if notification fails
      }

      res.status(201).json({
        success: true,
        message: "Delivery postponement request created successfully",
        data: {
          postponement: {
            id: postponement._id,
            orderId: postponement.orderId,
            originalDeliveryDate: postponement.originalDeliveryDate,
            requestedDeliveryDate: postponement.requestedDeliveryDate,
            reason: postponement.reason,
            status: postponement.status,
            createdAt: postponement.createdAt,
          },
        },
      });
    }
  );

  /**
   * Get postponement details
   * @route GET /api/postponements/:postponementId
   * @access Private
   */
  getPostponementDetails = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { postponementId } = req.params;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      const postponement = await DeliveryPostponements.findOne({
        _id: new mongoose.Types.ObjectId(postponementId),
        userId,
        isDeleted: false,
      })
        .populate("orderId", "orderNumber status planType")
        .lean();

      if (!postponement) {
        throw new AppError("Postponement request not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Postponement details retrieved successfully",
        data: {
          postponement,
        },
      });
    }
  );

  /**
   * Get user's postponement history
   * @route GET /api/postponements
   * @access Private
   */
  getPostponementHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { status, orderId } = req.query;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      const paginationOptions = getPaginationOptions(req);
      const skip = (paginationOptions.page - 1) * paginationOptions.limit;

      // Build query
      const query: any = {
        userId,
        isDeleted: false,
      };

      if (status) {
        query.status = status;
      }

      if (orderId) {
        query.orderId = new mongoose.Types.ObjectId(orderId as string);
      }

      // Get postponements
      const [postponements, total] = await Promise.all([
        DeliveryPostponements.find(query)
          .populate("orderId", "orderNumber status planType")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(paginationOptions.limit)
          .lean(),
        DeliveryPostponements.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        message: "Postponement history retrieved successfully",
        data: postponements,
        pagination: getPaginationMeta(
          paginationOptions.page,
          paginationOptions.limit,
          total
        ),
      });
    }
  );

  /**
   * Send admin notification email
   */
  private async sendAdminNotification(
    postponement: any,
    order: any,
    user: { email?: string; name?: string }
  ): Promise<void> {
    const adminEmail =
      process.env.ADMIN_EMAIL ||
      process.env.SENDGRID_FROM_EMAIL ||
      "admin@viteezy.com";
    const userName = user.name || user.email || "User";
    const orderNumber = order.orderNumber || order._id.toString();

    const subject = `New Delivery Postponement Request - Order ${orderNumber}`;
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header {
            background: #4f46e5;
            color: #ffffff;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            background: #ffffff;
            padding: 40px 30px;
          }
          .content p {
            margin: 0 0 15px 0;
            font-size: 16px;
            color: #333333;
          }
          .info-box {
            background: #f9fafb;
            border-left: 4px solid #4f46e5;
            padding: 20px;
            margin: 20px 0;
          }
          .info-box strong {
            color: #4f46e5;
          }
          .footer {
            text-align: center;
            padding: 20px 30px;
            background-color: #f9fafb;
            color: #6b7280;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>Delivery Postponement Request</h1>
          </div>
          <div class="content">
            <p>Hello Admin,</p>
            <p>A new delivery postponement request has been submitted.</p>
            <div class="info-box">
              <p><strong>User:</strong> ${userName} (${user.email || "N/A"})</p>
              <p><strong>Order Number:</strong> ${orderNumber}</p>
              <p><strong>Original Delivery Date:</strong> ${new Date(
                postponement.originalDeliveryDate
              ).toLocaleDateString()}</p>
              <p><strong>Requested Delivery Date:</strong> ${new Date(
                postponement.requestedDeliveryDate
              ).toLocaleDateString()}</p>
              ${
                postponement.reason
                  ? `<p><strong>Reason:</strong> ${postponement.reason}</p>`
                  : ""
              }
              <p><strong>Status:</strong> ${postponement.status}</p>
              <p><strong>Request ID:</strong> ${postponement._id}</p>
            </div>
            <p>Please review and process this request in the admin panel.</p>
            <p>Best regards,<br><strong>Viteezy System</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Viteezy. All rights reserved.</p>
            <p>This is an automated notification email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Delivery Postponement Request

A new delivery postponement request has been submitted.

User: ${userName} (${user.email || "N/A"})
Order Number: ${orderNumber}
Original Delivery Date: ${new Date(
      postponement.originalDeliveryDate
    ).toLocaleDateString()}
Requested Delivery Date: ${new Date(
      postponement.requestedDeliveryDate
    ).toLocaleDateString()}
${postponement.reason ? `Reason: ${postponement.reason}` : ""}
Status: ${postponement.status}
Request ID: ${postponement._id}

Please review and process this request in the admin panel.

© ${new Date().getFullYear()} Viteezy. All rights reserved.
    `;

    await emailService.sendAdminNotification(adminEmail, subject, html);

    logger.info(
      `Admin notification sent for postponement request: ${postponement._id}`
    );
  }
}

export const deliveryPostponementController =
  new DeliveryPostponementController();
