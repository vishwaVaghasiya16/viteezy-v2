import { Request, Response } from "express";
import { FilterQuery } from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { User } from "@/models/index.model";
import { Payments } from "@/models/commerce";
import { PaymentMethod, PaymentStatus } from "@/models/enums";
import { IPayment } from "@/models/commerce/payments.model";

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

      const { name, phone, countryCode, profileImage, gender, age } = req.body;

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      if (countryCode !== undefined) updateData.countryCode = countryCode;
      if (profileImage !== undefined) updateData.profileImage = profileImage;
      if (gender !== undefined) updateData.gender = gender;
      if (age !== undefined) updateData.age = age;

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

      const pagination = getPaginationMeta(page, limit, total);

      res.apiSuccess(
        {
          transactions: formattedTransactions,
          pagination,
        },
        "Transaction history retrieved successfully"
      );
    }
  );
}

export const userController = new UserController();
