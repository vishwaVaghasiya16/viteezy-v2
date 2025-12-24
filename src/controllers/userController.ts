import { Request, Response } from "express";
import { FilterQuery } from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { User } from "@/models/index.model";
import { Payments } from "@/models/commerce";
import { PaymentMethod, PaymentStatus } from "@/models/enums";
import { IPayment } from "@/models/commerce/payments.model";
import { fileStorageService } from "@/services/fileStorageService";

interface AuthenticatedRequest extends Request {
  user?: any;
}

class UserController {
  getCurrentUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError("User not authenticated", 401);
      }

      const user = await User.findById(req.user._id).select("-password");

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Use registeredAt if set, otherwise fallback to createdAt
      const registrationDate = user.registeredAt || user.createdAt;

      res.apiSuccess(
        {
          user: {
            ...user.toObject(),
            registeredAt: registrationDate,
          },
        },
        "User retrieved successfully"
      );
    }
  );

  updateCurrentUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError("User not authenticated", 401);
      }

      // Get current user to check existing profile image and avatar
      const currentUser = await User.findById(req.user._id).select(
        "profileImage avatar"
      );
      if (!currentUser) {
        throw new AppError("User not found", 404);
      }

      const {
        name,
        phone,
        countryCode,
        profileImage,
        avatar,
        gender,
        age,
        language,
      } = req.body;

      const updateData: Record<string, unknown> = {};
      const { firstName, lastName } = req.body;
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (phone !== undefined) updateData.phone = phone;
      if (countryCode !== undefined) updateData.countryCode = countryCode;
      if (gender !== undefined) updateData.gender = gender;
      if (age !== undefined) updateData.age = age;
      if (language !== undefined) updateData.language = language;

      // Extract files from multer.fields() result
      const files = req.files as
        | { [fieldname: string]: Express.Multer.File[] }
        | undefined;

      // Handle profile image upload
      const profileImageFile = files?.["profileImage"]?.[0];

      if (profileImageFile) {
        // Upload new image to cloud storage
        const imageUrl = await fileStorageService.uploadFile(
          "user-profiles",
          profileImageFile
        );
        updateData.profileImage = imageUrl;

        // Delete old profile image if exists
        if (currentUser.profileImage) {
          await fileStorageService
            .deleteFileByUrl(currentUser.profileImage)
            .catch((error) => {
              // Log error but don't fail the request
              console.error("Failed to delete old profile image:", error);
            });
        }
      } else if (profileImage !== undefined) {
        // If profileImage is explicitly set (including null to remove)
        if (profileImage === null || profileImage === "") {
          // Delete old image if exists
          if (currentUser.profileImage) {
            await fileStorageService
              .deleteFileByUrl(currentUser.profileImage)
              .catch((error) => {
                console.error("Failed to delete profile image:", error);
              });
          }
          updateData.profileImage = null;
        } else {
          // Update with provided URL (if updating from external source)
          updateData.profileImage = profileImage;
        }
      }

      // Handle avatar upload
      const avatarFile = files?.["avatar"]?.[0];

      if (avatarFile) {
        // Upload new avatar to cloud storage
        const avatarUrl = await fileStorageService.uploadFile(
          "user-avatars",
          avatarFile
        );
        updateData.avatar = avatarUrl;

        // Delete old avatar if exists
        if (currentUser.avatar) {
          await fileStorageService
            .deleteFileByUrl(currentUser.avatar)
            .catch((error) => {
              // Log error but don't fail the request
              console.error("Failed to delete old avatar:", error);
            });
        }
      } else if (avatar !== undefined) {
        // If avatar is explicitly set (including null to remove)
        if (avatar === null || avatar === "") {
          // Delete old avatar if exists
          if (currentUser.avatar) {
            await fileStorageService
              .deleteFileByUrl(currentUser.avatar)
              .catch((error) => {
                console.error("Failed to delete avatar:", error);
              });
          }
          updateData.avatar = null;
        } else {
          // Update with provided URL (if updating from external source)
          updateData.avatar = avatar;
        }
      }

      console.log({ updateData });

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        updateData,
        { new: true, runValidators: true }
      ).select("-password");

      if (!updatedUser) {
        throw new AppError("User not found", 404);
      }

      // Use registeredAt if set, otherwise fallback to createdAt
      const registrationDate =
        updatedUser.registeredAt || updatedUser.createdAt;

      res.apiSuccess(
        {
          user: {
            ...updatedUser.toObject(),
            registeredAt: registrationDate,
          },
        },
        "User profile updated successfully"
      );
    }
  );

  /**
   * Remove profile image
   */
  removeProfileImage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError("User not authenticated", 401);
      }

      const user = await User.findById(req.user._id).select("profileImage");
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Delete image from cloud storage if exists
      if (user.profileImage) {
        await fileStorageService
          .deleteFileByUrl(user.profileImage)
          .catch((error) => {
            console.error("Failed to delete profile image:", error);
          });
      }

      // Remove profile image from user record
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { profileImage: null },
        { new: true, runValidators: true }
      ).select("-password");

      if (!updatedUser) {
        throw new AppError("User not found", 404);
      }

      const registrationDate =
        updatedUser.registeredAt || updatedUser.createdAt;

      res.apiSuccess(
        {
          user: {
            ...updatedUser.toObject(),
            registeredAt: registrationDate,
          },
        },
        "Profile image removed successfully"
      );
    }
  );

  /**
   * Remove avatar
   */
  removeAvatar = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError("User not authenticated", 401);
      }

      const user = await User.findById(req.user._id).select("avatar");
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Delete avatar from cloud storage if exists
      if (user.avatar) {
        await fileStorageService.deleteFileByUrl(user.avatar).catch((error) => {
          console.error("Failed to delete avatar:", error);
        });
      }

      // Remove avatar from user record
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { avatar: null },
        { new: true, runValidators: true }
      ).select("-password");

      if (!updatedUser) {
        throw new AppError("User not found", 404);
      }

      const registrationDate =
        updatedUser.registeredAt || updatedUser.createdAt;

      res.apiSuccess(
        {
          user: {
            ...updatedUser.toObject(),
            registeredAt: registrationDate,
          },
        },
        "Avatar removed successfully"
      );
    }
  );

  /**
   * Get authenticated user's transaction history with pagination and filters
   */
  getTransactionHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { page, limit, skip, sort } = getPaginationOptions(req);

      const filters: FilterQuery<IPayment> = {
        userId: req.user._id,
        isDeleted: { $ne: true },
      };

      const { status, paymentMethod, search } = req.query;

      if (typeof status === "string" && status.trim().length) {
        filters.status = status as PaymentStatus;
      }

      if (typeof paymentMethod === "string" && paymentMethod.trim().length) {
        filters.paymentMethod = paymentMethod as PaymentMethod;
      }

      if (typeof search === "string" && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        filters.$or = [
          { transactionId: regex },
          { gatewayTransactionId: regex },
          { gatewaySessionId: regex },
        ];
      }

      const [transactions, total] = await Promise.all([
        Payments.find(filters)
          .select(
            "paymentMethod status amount currency transactionId gatewayTransactionId gatewaySessionId processedAt createdAt orderId membershipId"
          )
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Payments.countDocuments(filters),
      ]);

      const formattedTransactions = transactions.map((payment) => ({
        id: payment._id,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        transactionId:
          payment.transactionId ||
          payment.gatewayTransactionId ||
          payment.gatewaySessionId ||
          null,
        amount: payment.amount?.amount ?? null,
        currency: payment.amount?.currency || payment.currency || "EUR",
        taxRate: payment.amount?.taxRate ?? null,
        processedAt: payment.processedAt || payment.createdAt,
        orderId: payment.orderId,
        membershipId: payment.membershipId,
        createdAt: payment.createdAt,
      }));

      res.apiPaginated(
        formattedTransactions,
        getPaginationMeta(page, limit, total),
        "Transaction history retrieved"
      );
    }
  );
}

export const userController = new UserController();
