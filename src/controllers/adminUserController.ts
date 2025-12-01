import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { User } from "@/models/core";
import { Orders } from "@/models/commerce";

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
            name: user.name,
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

      res.apiSuccess(
        {
          users: paginatedUsers,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
        "Users retrieved successfully"
      );
    }
  );

  /**
   * Get user by ID
   * @route GET /api/v1/admin/users/:id
   * @access Admin
   */
  getUserById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid user ID", 400);
      }

      const user = await User.findById(id)
        .select(
          "_id name email phone countryCode memberId registeredAt createdAt isActive lastLogin"
        )
        .lean();

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Get user order count and determine type
      const orderCount = await Orders.countDocuments({
        userId: new mongoose.Types.ObjectId(id),
      });

      const isRecurring =
        orderCount > 0 || (user.lastLogin && user.lastLogin !== null);

      // Use registeredAt if set, otherwise fallback to createdAt
      const registrationDate = user.registeredAt || user.createdAt;

      res.apiSuccess(
        {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone || null,
            memberId: user.memberId || null,
            countryCode: user.countryCode || null,
            registeredAt: registrationDate,
            status: {
              userType: isRecurring ? "recurring" : "new",
              isActive: user.isActive,
            },
          },
        },
        "User retrieved successfully"
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

      res.apiSuccess(
        {
          user: {
            name: user.name,
            email: user.email,
            phone: user.phone || null,
            memberId: user.memberId || null,
            countryCode: user.countryCode || null,
            registeredAt: user.registeredAt || user.createdAt,
            status: {
              userType: "recurring", // Will be calculated if needed
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
