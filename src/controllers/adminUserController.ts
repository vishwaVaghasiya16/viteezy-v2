import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { getPaginationMeta } from "@/utils/pagination";
import { User, MemberReferrals, Addresses } from "@/models/core";
import {
  Orders,
  Subscriptions,
  Memberships,
  Payments,
  Products,
} from "@/models/commerce";
import {
  PaymentStatus,
  SubscriptionStatus,
  MembershipStatus,
} from "@/models/enums";
import { emailService } from "@/services/emailService";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
  };
}

class AdminUserController {
  /**
   * Get all users with pagination and filters
   * @route GET /api/v1/admin/users
   * @access Admin
   * @query {Number} [page] - Page number (default: 1)
   * @query {Number} [limit] - Items per page (default: 10)
   * @query {String} [search] - Search by name or email
   * @query {Boolean} [isActive] - Filter by active status (true/false)
   * @query {String} [userType] - Filter by user type: "new" or "recurring"
   * @query {String} [registrationDate] - Filter by registration date (format: YYYY-MM-DD, e.g., 2025-02-21)
   */
  getAllUsers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const {
        page = "1",
        limit = "10",
        search,
        isActive,
        userType,
        registrationDate,
      } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        isActive?: string | boolean;
        userType?: string;
        registrationDate?: string;
      };

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      // Build query for non-search filters
      const baseQuery: any = {};

      // Exclude deleted users by default
      baseQuery.isDeleted = { $ne: true };

      // Filter by active status
      if (isActive !== undefined) {
        const value: string | boolean = isActive;
        baseQuery.isActive = value === "true" || value === true || value === "1";
      }

      // Filter by registration date
      if (registrationDate) {
        // Parse date string (YYYY-MM-DD format)
        const date = new Date(registrationDate);
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Filter by registeredAt or createdAt (fallback)
        baseQuery.$or = [
          {
            registeredAt: {
              $gte: startOfDay,
              $lte: endOfDay,
            },
          },
          {
            registeredAt: { $exists: false },
            createdAt: {
              $gte: startOfDay,
              $lte: endOfDay,
            },
          },
        ];
      }

      // Get all users first (for userType filtering)
      let allUsers;

      // If search is provided, use aggregation pipeline for combined name search
      if (search) {
        const searchPipeline: any[] = [
          {
            $match: baseQuery
          },
          {
            $addFields: {
              fullName: { $concat: ["$firstName", " ", "$lastName"] }
            }
          },
          {
            $match: {
              $or: [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { fullName: { $regex: search, $options: "i" } }
              ]
            }
          },
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              email: 1,
              phone: 1,
              countryCode: 1,
              memberId: 1,
              registeredAt: 1,
              createdAt: 1,
              isActive: 1,
              lastLogin: 1,
              parentId: 1,
              mainMemberId: 1,   
            },
          },
          { $sort: { createdAt: -1 as const } },
          { $skip: skip },
          { $limit: limitNum },
        ];

        allUsers = await User.aggregate(searchPipeline);
      } else {
        // Normal query without search
        allUsers = await User.find(baseQuery)
          .select(
            "_id firstName lastName email phone countryCode memberId registeredAt createdAt isActive lastLogin parentId mainMemberId"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean();
      }

      // Get order counts for all users
      const userIds = allUsers.map((user) => user._id);
      const orderCounts = await Orders.aggregate([
        {
          $match: {
            userId: {
              $in: userIds.map((id) => new mongoose.Types.ObjectId(id)),
            },
          },
        },
        {
          $group: {
            _id: "$userId",
            orderCount: { $sum: 1 },
          },
        },
      ]);

      const orderMap = new Map(
        orderCounts.map((i) => [i._id.toString(), i.orderCount])
      );

      // FAMILY LOGIC (ADDED ONLY)

      const mainMemberMap = new Map<string, number>();
      const childToParentMap = new Map<string, string>();

      // Build relationship map from users themselves
      allUsers.forEach((u: any) => {
        if (u.parentId) {
          const parent = u.parentId.toString();
          const child = u._id.toString();

          mainMemberMap.set(parent, (mainMemberMap.get(parent) || 0) + 1);
          childToParentMap.set(child, parent);
        }
      });

      const enrichedUsers = allUsers.map((user: any) => {
        const userId = user._id.toString();

        let familyStatus: "independent" | "main" | "sub" = "independent";
        let subMemberCount = 0;
        let parentMemberId: string | null = null;

        // SUB MEMBER
        if (childToParentMap.has(userId)) {
          familyStatus = "sub";
          parentMemberId = childToParentMap.get(userId)!;
        }

        // MAIN MEMBER
        else if (mainMemberMap.has(userId)) {
          familyStatus = "main";
          subMemberCount = mainMemberMap.get(userId)!;
        }

        const orderCount = orderMap.get(userId) || 0;
        const isRecurring = orderCount > 0 || !!user.lastLogin;

        return {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone || null,
          memberId: user.memberId || null,
          countryCode: user.countryCode || null,
          registeredAt: user.registeredAt || user.createdAt,
          family: {
            familyStatus,
            subMemberCount,
            parentMemberId,
          },

          status: {
            userType: isRecurring ? "Recurring User" : "New User",
            isActive: user.isActive,
          },
        };
      });

      const filtered = userType
        ? enrichedUsers.filter((u) => u.status.userType === userType)
        : enrichedUsers;

      const total = filtered.length;
      const paginatedUsers = filtered.slice(skip, skip + limitNum);

      res.apiPaginated(
        paginatedUsers,
        getPaginationMeta(pageNum, limitNum, total),
        "Users retrieved"
      );
    }
  );

  /**
   * Get user by ID with comprehensive details
   * @route GET /api/v1/admin/users/:id
   * @access Admin
   */
  getUserById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid user ID", 400);
      }

      const userId = new mongoose.Types.ObjectId(id);

      // Get user basic info (exclude deleted users)
      const user = await User.findOne({ _id: id, isDeleted: { $ne: true } })
        .select(
          "_id firstName lastName email phone countryCode memberId registeredAt createdAt isActive lastLogin profileImage isMember membershipStatus membershipPlanId membershipExpiresAt membershipActivatedAt language"
        )
        .lean();

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Get all data in parallel
      const [
        totalOrderCount,
        totalSpentResult,
        subscriptions,
        activeMembership,
        addresses,
        linkedFamilyMembers,
        recentOrders,
      ] = await Promise.all([
        // Total order count
        Orders.countDocuments({ userId }),

        // Total spent (sum of all successful order totals)
        Orders.aggregate([
          {
            $match: {
              userId,
              paymentStatus: { $in: [PaymentStatus.COMPLETED, PaymentStatus.PROCESSING] }, // Include completed and processing orders
            },
          },
          {
            $addFields: {
              // Try to get grandTotal from pricing, fallback to sum of item totals
              orderTotal: {
                $ifNull: [
                  "$pricing.overall.grandTotal",
                  { $sum: "$items.totalAmount" } // Fallback: sum of all item totals
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              totalSpent: { $sum: "$orderTotal" },
              currency: { $first: { $ifNull: ["$pricing.overall.currency", "USD"] } },
            },
          },
        ]),

        // Active subscriptions
        Subscriptions.find({
          userId,
          status: SubscriptionStatus.ACTIVE,
          isDeleted: { $ne: true },
        })
          .select(
            "subscriptionNumber createdAt nextBillingDate cycleDays status"
          )
          .sort({ createdAt: -1 })
          .lean(),

        // Active membership
        Memberships.findOne({
          userId,
          status: MembershipStatus.ACTIVE,
          isDeleted: { $ne: true },
          expiresAt: { $gt: new Date() },
        })
          .select("startedAt expiresAt status planSnapshot")
          .lean(),

        // User addresses
        Addresses.find({ userId, isDeleted: { $ne: true } })
          .select(
            "firstName lastName streetName houseNumber houseNumberAddition postalCode address phone country city isDefault note"
          )
          .sort({ isDefault: -1, createdAt: -1 })
          .lean(),

        // Linked family members (children registered using this user's member ID)
        MemberReferrals.find({
          parentUserId: userId,
          isActive: true,
          isDeleted: { $ne: true },
        })
          .populate("childUserId", "firstName lastName email phone countryCode profileImage")
          .select("childUserId registeredAt")
          .sort({ registeredAt: -1 })
          .lean(),

        // Recent orders (last 10)
        Orders.find({ userId })
          .select(
            "_id orderNumber paymentMethod createdAt grandTotal items paymentStatus paymentId"
          )
          .populate("items.productId", "title productImage slug")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ]);

      // Calculate total spent
      const totalSpent =
        totalSpentResult.length > 0
          ? {
              amount: totalSpentResult[0].totalSpent || 0,
              currency: totalSpentResult[0].currency || "USD",
            }
          : { amount: 0, currency: "USD" };

      // Format subscriptions
      const subscriptionDetails = subscriptions.map((sub) => ({
        purchaseDate: sub.createdAt,
        nextBillingDate: sub.nextBillingDate,
        dayPlans: sub.cycleDays, // 60, 90, or 180 days
        subscriptionNumber: sub.subscriptionNumber,
        status: sub.status,
      }));

      // Format membership
      const membershipDetails = activeMembership
        ? {
            planStartDate: activeMembership.startedAt || null,
            planEndDate: activeMembership.expiresAt || null,
            membershipStatus: activeMembership.status || null,
            planName: activeMembership.planSnapshot?.name || null,
          }
        : null;

      // Format addresses
      const personalDetails = {
        address: addresses.length > 0 ? addresses[0] : null, // Default or first address
        email: user.email,
        phone: user.phone || null,
        countryCode: user.countryCode || null,
        language: user.language || "English", // Default to English if not set
      };

      // Format linked family list
      const linkedFamilyList = linkedFamilyMembers.map((referral: any) => {
        const childUser = referral.childUserId;
        return {
          profileImage: childUser?.profileImage || null,
          firstName: childUser?.firstName || null,
          lastName: childUser?.lastName || null,
          email: childUser?.email || null,
          phone: childUser?.phone || null,
          countryCode: childUser?.countryCode || null,
          registeredAt: referral.registeredAt,
        };
      });

      // Get payment details for recent orders
      const orderIds = recentOrders.map((order: any) => order._id);
      const payments = await Payments.find({
        orderId: { $in: orderIds },
      })
        .select("orderId paymentMethod")
        .lean();

      const paymentMethodMap = new Map(
        payments.map((payment: any) => [
          payment.orderId.toString(),
          payment.paymentMethod,
        ])
      );

      // Format recent orders
      const formattedRecentOrders = recentOrders.map((order: any) => {
        // Get payment method from payment record, fallback to order paymentMethod
        const paymentMethod =
          paymentMethodMap.get(order._id.toString()) ||
          order.paymentMethod ||
          "Unknown";

        // Format order items
        const orderItems = (order.items || []).map((item: any) => {
          const product = item.productId || {};
          return {
            productName: item.name || product.title || "Unknown Product",
            planDays: item.planDays || item.capsuleCount || null,
            productImage: product.productImage || null,
            productPrice: {
              amount: item.amount || 0,
              discountedPrice: item.discountedPrice || 0,
              taxRate: item.taxRate || 0,
              totalAmount: item.totalAmount || 0,
              currency: order.pricing?.overall?.currency || "USD",
            },
          };
        });

        return {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentMethod: paymentMethod, // Mollie, Stripe, etc.
          orderCreatedDate: order.createdAt,
          orderTotalAmount: order.pricing?.overall?.grandTotal || 
                           order.grandTotal || 
                           (order.items && order.items.length > 0 
                            ? order.items.reduce((sum: number, item: any) => sum + (item.totalAmount || 0), 0)
                            : 0),
          items: orderItems,
          paymentStatus: order.paymentStatus,
        };
      });

      // Use registeredAt if set, otherwise fallback to createdAt
      const registrationDate = user.registeredAt || user.createdAt;

      res.apiSuccess(
        {
          user: {
            // Basic Info
            firstName: user.firstName,
            lastName: user.lastName,
            profileImage: user.profileImage || null,

            // Status
            isPremiumMember: user.isMember || false,
            isActive: user.isActive,

            // Registration & Membership
            registrationDate: registrationDate,
            membershipId: user.memberId || null,

            // Order Statistics
            totalOrderCount: totalOrderCount,
            totalSpent: totalSpent,

            // Subscription Details
            subscriptionDetails:
              subscriptionDetails.length > 0 ? subscriptionDetails : null,

            // Membership Details
            membership: membershipDetails,

            // Personal Details
            personalDetails: personalDetails,

            // Linked Family List
            linkedFamilyList: linkedFamilyList,

            // Recent Orders
            recentOrders: formattedRecentOrders,
          },
        },
        "User details retrieved successfully"
      );
    }
  );

  /**
   * Toggle user active status (block/unblock or activate)
   * @route PATCH /api/v1/admin/users/:id/status
   * @access Admin
   * @body {Boolean} isActive - Active status (true to activate, false to block)
   */
  toggleUserStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { isActive } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid user ID", 400);
      }

      // Prevent admin from blocking themselves
      if (id === req.user?._id) {
        throw new AppError("You cannot block your own account", 400);
      }

      const user = await User.findOne({ _id: id, isDeleted: { $ne: true } });

      if (!user) {
        throw new AppError("User not found", 404);
      }

      user.isActive = isActive;
      await user.save();

      // Send email notification to user about status change
      if (user.email) {
        const fullName = `${user.firstName} ${user.lastName}`.trim();
        emailService
          .sendUserStatusChangeEmail(user.email, fullName, isActive)
          .catch((error) => {
            // Log error but don't break the API response
            logger.error("Failed to send user status change email:", {
              userId: id,
              email: user.email,
              isActive,
              error: error?.message,
            });
          });
      }

      res.apiSuccess(
        {
          user: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone || null,
            memberId: user.memberId || null,
            countryCode: user.countryCode || null,
            registeredAt: user.registeredAt || user.createdAt,
            status: {
              userType: "Recurring User", // Will be calculated if needed
              isActive: user.isActive,
            },
          },
        },
        `User ${isActive ? "activated" : "blocked"} successfully`
      );
    }
  );

  /**
   * Get user statistics
   * @route GET /api/v1/admin/users/stats
   * @access Admin
   */
  getUserStats = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const totalUsers = await User.countDocuments({
        isDeleted: { $ne: true },
      });
      const activeUsers = await User.countDocuments({
        isActive: true,
        isDeleted: { $ne: true },
      });
      const verifiedUsers = await User.countDocuments({
        isEmailVerified: true,
        isDeleted: { $ne: true },
      });

      const roleStats = await User.aggregate([
        {
          $match: { isDeleted: { $ne: true } },
        },
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
          },
        },
      ]);

      const stats = {
        totalUsers: totalUsers,
        activeUsers: activeUsers,
        verified: verifiedUsers,
        inActive: totalUsers - activeUsers,
        unVerified: totalUsers - verifiedUsers,
        roleDistribution: roleStats,
      };

      res.apiSuccess({ stats }, "User statistics retrieved successfully");
    }
  );

  /**
   * Delete user (soft delete)
   * @route DELETE /api/v1/admin/users/:id
   * @access Admin
   */
  deleteUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid user ID", 400);
      }

      // Prevent admin from deleting themselves
      if (id === req.user?._id) {
        throw new AppError("You cannot delete your own account", 400);
      }

      const user = await User.findOne({ _id: id, isDeleted: { $ne: true } });

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Perform soft delete
      user.isDeleted = true;
      user.deletedAt = new Date();
      user.isActive = false; // Also deactivate the user
      await user.save();

      logger.info(`User soft deleted: ${id} by admin: ${req.user?._id}`);

      res.apiSuccess(null, "User deleted successfully");
    }
  );
}

export const adminUserController = new AdminUserController();
