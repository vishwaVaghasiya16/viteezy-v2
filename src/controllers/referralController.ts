import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Carts } from "@/models/commerce";
import { ProductVariant } from "@/models/enums";
import { cartService } from "@/services/cartService";
import { referralService } from "@/services/referralService";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    id?: string;
  };
  userId?: string;
}

class ReferralController {
  /**
   * Validate and apply/remove referral code from cart
   * @route POST /api/v1/referrals/validate
   * @access Private
   */
  validateReferralCode = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?.id || req.user?._id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { cartId, referralCode } = req.body;

      // Get and validate cart
      const cart = await Carts.findOne({
        _id: new mongoose.Types.ObjectId(cartId),
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      }).lean();

      if (!cart) {
        throw new AppError("Cart not found", 404);
      }

      // If referralCode is null or empty, remove referral code from cart
      if (!referralCode || referralCode.trim() === "") {
        // Remove referral code from cart
        const userCart = await Carts.findOne({
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
        }).lean();

        if (!userCart || userCart._id.toString() !== cartId) {
          throw new AppError("Cart not found or does not belong to user", 404);
        }

        // Remove referral code (if it was stored as couponCode)
        await Carts.findByIdAndUpdate(
          cart._id,
          {
            couponCode: null,
            couponDiscountAmount: 0,
            updatedAt: new Date(),
          },
          { new: true }
        );

        const updatedCart = await Carts.findOne({
          _id: cart._id,
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
        }).lean();

        res.apiSuccess(
          {
            cart: updatedCart,
            referralCode: null,
          },
          "Referral code removed successfully"
        );
        return;
      }

      // Normalize referral code
      const normalizedReferralCode = referralCode.toUpperCase().trim();

      try {
        // Calculate order amount for referral validation
        const totalsWithoutCoupon = await (
          cartService as any
        ).calculateCartTotalsWithVariantType(
          cart.items,
          cart.variantType as ProductVariant,
          0 // No discount
        );

        const orderAmount =
          totalsWithoutCoupon.subtotal -
          totalsWithoutCoupon.discount +
          totalsWithoutCoupon.tax;

        // Validate referral code
        const referralValidation = await referralService.validateReferralCode(
          normalizedReferralCode,
          userId,
          orderAmount
        );

        if (!referralValidation.isValid) {
          // Remove referral code from cart if invalid
          await Carts.findByIdAndUpdate(
            cart._id,
            {
              couponCode: null,
              couponDiscountAmount: 0,
              updatedAt: new Date(),
            },
            { new: true }
          );

          const updatedCart = await Carts.findOne({
            _id: cart._id,
            userId: new mongoose.Types.ObjectId(userId),
            isDeleted: false,
          }).lean();

          throw new AppError(
            referralValidation.message || "Invalid referral code",
            400
          );
        }

        // Apply referral discount to cart
        const referralDiscountAmount = referralValidation.discountAmount;

        // Update cart with referral code and discount
        await Carts.findByIdAndUpdate(
          cart._id,
          {
            couponCode: normalizedReferralCode,
            couponDiscountAmount: referralDiscountAmount,
            updatedAt: new Date(),
          },
          { new: true }
        );

        // Recalculate totals with referral discount
        const totalsWithReferral = await (
          cartService as any
        ).calculateCartTotalsWithVariantType(
          cart.items,
          cart.variantType as ProductVariant,
          referralDiscountAmount
        );

        const updatedCart = await Carts.findOne({
          _id: cart._id,
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
        }).lean();

        // Return success response for referral code
        res.apiSuccess(
          {
            cart: {
              ...updatedCart,
              ...totalsWithReferral,
            },
            referralCode: normalizedReferralCode,
            referralDiscount: {
              amount: referralDiscountAmount,
              currency: totalsWithReferral.currency || "EUR",
            },
          },
          "Referral code applied successfully"
        );
      } catch (error: any) {
        // If any validation fails, ensure cart is updated
        const updatedCart = await Carts.findOne({
          _id: cart._id,
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
        }).lean();

        // Return error response with updated cart
        res.status(error.statusCode || 400).json({
          success: false,
          message: error.message || "Referral code validation failed",
          data: {
            cart: updatedCart,
            referralCode: null,
          },
        });
      }
    }
  );
}

export const referralController = new ReferralController();

