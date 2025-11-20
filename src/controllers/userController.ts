import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { User } from "@/models/index.model";

interface AuthenticatedRequest extends Request {
  user?: any;
}

class UserController {
  getCurrentUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError("User not authenticated", 401);
      }

      const user = await User.findById(req.user.id).select("-password");

      if (!user) {
        throw new AppError("User not found", 404);
      }

      res.apiSuccess({ user }, "User retrieved successfully");
    }
  );

  updateCurrentUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError("User not authenticated", 401);
      }

      const { name, phone, profileImage, gender, age } = req.body;

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      if (profileImage !== undefined) updateData.profileImage = profileImage;
      if (gender !== undefined) updateData.gender = gender;
      if (age !== undefined) updateData.age = age;

      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        updateData,
        { new: true, runValidators: true }
      ).select("-password");

      if (!updatedUser) {
        throw new AppError("User not found", 404);
      }

      res.apiSuccess(
        { user: updatedUser },
        "User profile updated successfully"
      );
    }
  );
}

export const userController = new UserController();
