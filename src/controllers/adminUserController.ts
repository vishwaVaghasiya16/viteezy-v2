import { Request, Response } from "express";
import { User } from "@/models/index.model";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";

class AdminUserController {
  getAllUsers = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { search, role, isActive } = req.query;

      const filter: any = {};

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      if (role) {
        filter.role = role;
      }

      if (isActive !== undefined) {
        filter.isActive = isActive === "true";
      }

      const total = await User.countDocuments(filter);

      const users = await User.find(filter)
        .select("-password")
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(users, pagination, "Users retrieved successfully");
    }
  );

  getUserById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const user = await User.findById(id).select("-password");

      if (!user) {
        res.apiNotFound("User not found");
        return;
      }

      res.apiSuccess({ user }, "User retrieved successfully");
    }
  );

  updateUserStatus = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const { isActive } = req.body;

      const user = await User.findByIdAndUpdate(
        id,
        { isActive },
        { new: true, runValidators: true }
      ).select("-password");

      if (!user) {
        res.apiNotFound("User not found");
        return;
      }

      res.apiSuccess({ user }, "User status updated successfully");
    }
  );

  deleteUser = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const user = await User.findByIdAndDelete(id);

      if (!user) {
        res.apiNotFound("User not found");
        return;
      }

      res.apiSuccess(null, "User deleted successfully");
    }
  );

  getUserStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
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
        total: totalUsers,
        active: activeUsers,
        verified: verifiedUsers,
        inactive: totalUsers - activeUsers,
        unverified: totalUsers - verifiedUsers,
        roleDistribution: roleStats,
      };

      res.apiSuccess({ stats }, "User statistics retrieved successfully");
    }
  );
}

export const adminUserController = new AdminUserController();
