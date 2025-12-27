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
   */
  getAllUsers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const {
        page = "1",
        limit = "10",
        search,
        isActive,
        userType,
      } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        isActive?: string | boolean;
        userType?: string;
      };

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {};

      // Filter by active status
      if (isActive !== undefined) {
        const value: string | boolean = isActive;
        query.isActive = value === "true" || value === true || value === "1";
      }

      // Search functionality - only by name or email
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      // Get all users first (for userType filtering)
      let allUsers = await User.find(query)
        .select(
          "_id name email phone countryCode memberId registeredAt createdAt isActive lastLogin"
        )
        .sort({ createdAt: -1 })
        .lean();

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

      const orderCountMap = new Map(
        orderCounts.map((item) => [item._id.toString(), item.orderCount])
      );

      // Enrich users with userType and apply userType filter
      const enrichedUsers = allUsers
        .map((user) => {
          const orderCount = orderCountMap.get(user._id.toString()) || 0;
          const isRecurring =
            orderCount > 0 || (user.lastLogin && user.lastLogin !== null);
          const finalUserType = isRecurring ? "Recurring User" : "New User";

          // Use registeredAt if set, otherwise fallback to createdAt
          const registrationDate = user.registeredAt || user.createdAt;

          return {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone || null,
            memberId: user.memberId || null,
            countryCode: user.countryCode || null,
            registeredAt: registrationDate,
            status: {
              userType: finalUserType, // "New User" or "Recurring User"
              isActive: user.isActive, // true or false
            },
          };
        })
        .filter((user) => {
          // Apply userType filter if specified
          if (userType) {
            return user.status.userType === userType;
          }
          return true;
        });

      // Apply pagination after filtering
      const total = enrichedUsers.length;
      const paginatedUsers = enrichedUsers.slice(skip, skip + limitNum);

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

      // Get user basic info
      const user = await User.findById(id)
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
              paymentStatus: PaymentStatus.COMPLETED, // Only count completed/paid orders
            },
          },
          {
            $group: {
              _id: null,
              totalSpent: { $sum: "$total.amount" },
              currency: { $first: "$total.currency" },
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
          .populate("childUserId", "name email phone countryCode profileImage")
          .select("childUserId registeredAt")
          .sort({ registeredAt: -1 })
          .lean(),

        // Recent orders (last 10)
        Orders.find({ userId })
          .select(
            "_id orderNumber paymentMethod createdAt total items paymentStatus paymentId"
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
              currency: totalSpentResult[0].currency || "EUR",
            }
          : { amount: 0, currency: "EUR" };

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
            productImage: product.productImage || null,
            productPrice: {
              amount: item.amount || 0,
              discountedPrice: item.discountedPrice || 0,
              taxRate: item.taxRate || 0,
              totalAmount: item.totalAmount || 0,
              currency: order.currency || "EUR",
            },
          };
        });

        return {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentMethod: paymentMethod, // Mollie, Stripe, etc.
          orderCreatedDate: order.createdAt,
          orderTotalAmount: order.grandTotal || null,
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

      const user = await User.findById(id);

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
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isActive: true });
      const verifiedUsers = await User.countDocuments({
        isEmailVerified: true,
      });

      const roleStats = await User.aggregate([
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
}

export const adminUserController = new AdminUserController();
