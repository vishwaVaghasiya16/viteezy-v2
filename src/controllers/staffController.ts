import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { User } from "@/models/core";
import { UserRole } from "@/models/enums";
import mongoose from "mongoose";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    role?: string;
  };
}

class StaffController {
  /**
   * Create a new staff member (Admin, Moderator, or Inventory Manager)
   * @route POST /api/v1/admin/staff
   */
  createStaff = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError("A user with this email already exists", 400);
    }

    // Create staff member
    const staff = await User.create({
      ...req.body,
      isEmailVerified: true, // Internal staff accounts are pre-verified
    });

    res.apiCreated(staff, `${role} account created successfully`);
  });

  /**
   * List all staff members
   * @route GET /api/v1/admin/staff
   */
  listStaff = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const staff = await User.find({
      role: { 
        $in: [UserRole.ADMIN, UserRole.MODERATOR, UserRole.INVENTORY_MANAGER] 
      },
      isDeleted: { $ne: true }
    }).sort({ createdAt: -1 });

    res.apiSuccess(staff, "Staff list retrieved successfully");
  });

  /**
   * Update staff member details
   * @route PATCH /api/v1/admin/staff/:id
   */
  updateStaff = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid staff ID", 400);
    }

    const staff = await User.findOneAndUpdate(
      { 
        _id: id, 
        role: { $in: [UserRole.ADMIN, UserRole.MODERATOR, UserRole.INVENTORY_MANAGER] },
        isDeleted: { $ne: true }
      },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!staff) {
      throw new AppError("Staff member not found", 404);
    }

    res.apiSuccess(staff, "Staff member updated successfully");
  });

  /**
   * Delete staff member (soft delete)
   * @route DELETE /api/v1/admin/staff/:id
   */
  deleteStaff = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid staff ID", 400);
    }

    // Prevent self-deletion
    if (id === req.user?._id) {
      throw new AppError("You cannot delete your own account", 400);
    }

    const staff = await User.findOneAndUpdate(
      { 
        _id: id, 
        role: { $in: [UserRole.ADMIN, UserRole.MODERATOR, UserRole.INVENTORY_MANAGER] },
        isDeleted: { $ne: true }
      },
      { 
        $set: { 
          isDeleted: true, 
          isActive: false,
          deletedAt: new Date() 
        } 
      },
      { new: true }
    );

    if (!staff) {
      throw new AppError("Staff member not found", 404);
    }

    res.apiSuccess(null, "Staff member deleted successfully");
  });
}

export const staffController = new StaffController();
