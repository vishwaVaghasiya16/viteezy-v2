import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Coupons, Orders } from "@/models/commerce";
import { CouponType } from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

class CouponController {
  /**
   * Validate a discount coupon applied at checkout
   * @route POST /api/coupons/validate
   * @access Private
   */
  validateCoupon = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { couponCode, orderAmount, productIds, categoryIds } = req.body;

      // Find coupon by code
      const coupon = await Coupons.findOne({
        code: couponCode.toUpperCase(),
        isDeleted: false,
      });

      if (!coupon) {
        throw new AppError("Invalid coupon code", 404);
      }

      // Check if coupon is active
      if (!coupon.isActive) {
        throw new AppError("This coupon is not active", 400);
      }

      // Check date validity
      const now = new Date();
      if (coupon.validFrom) {
        if (now < coupon.validFrom) {
          throw new AppError("This coupon is not yet valid", 400);
        }
      }

      if (coupon.validUntil) {
        if (now > coupon.validUntil) {
          throw new AppError("This coupon has expired", 400);
        }
      }

      // Validate that validUntil is after validFrom if both exist
      if (
        coupon.validFrom &&
        coupon.validUntil &&
        coupon.validUntil <= coupon.validFrom
      ) {
        throw new AppError("Coupon has invalid date range", 400);
      }

      // Check global usage limit
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        throw new AppError("This coupon has reached its usage limit", 400);
      }

      // Check user usage limit
      if (coupon.userUsageLimit) {
        const userCouponUsageCount = await Orders.countDocuments({
          userId: new mongoose.Types.ObjectId(req.user._id),
          couponCode: coupon.code,
          isDeleted: false,
        });

        if (userCouponUsageCount >= coupon.userUsageLimit) {
          throw new AppError(
            "You have reached the maximum usage limit for this coupon",
            400
          );
        }
      }

      // Check minimum order amount
      if (coupon.minOrderAmount && orderAmount) {
        if (orderAmount < coupon.minOrderAmount) {
          throw new AppError(
            `Minimum order amount of ${coupon.minOrderAmount} is required for this coupon`,
            400
          );
        }
      }

      // Check product applicability
      if (
        coupon.applicableProducts &&
        coupon.applicableProducts.length > 0 &&
        productIds &&
        productIds.length > 0
      ) {
        const applicableProductIds = coupon.applicableProducts.map((id) =>
          id.toString()
        );
        const hasApplicableProduct = productIds.some((id: string) =>
          applicableProductIds.includes(id.toString())
        );

        if (!hasApplicableProduct) {
          throw new AppError(
            "This coupon is not applicable to the selected products",
            400
          );
        }
      }

      // Check category applicability
      if (
        coupon.applicableCategories &&
        coupon.applicableCategories.length > 0 &&
        categoryIds &&
        categoryIds.length > 0
      ) {
        const applicableCategoryIds = coupon.applicableCategories.map((id) =>
          id.toString()
        );
        const hasApplicableCategory = categoryIds.some((id: string) =>
          applicableCategoryIds.includes(id.toString())
        );

        if (!hasApplicableCategory) {
          throw new AppError(
            "This coupon is not applicable to the selected categories",
            400
          );
        }
      }

      // Check excluded products
      if (
        coupon.excludedProducts &&
        coupon.excludedProducts.length > 0 &&
        productIds &&
        productIds.length > 0
      ) {
        const excludedProductIds = coupon.excludedProducts.map((id) =>
          id.toString()
        );
        const hasExcludedProduct = productIds.some((id: string) =>
          excludedProductIds.includes(id.toString())
        );

        if (hasExcludedProduct) {
          throw new AppError(
            "This coupon cannot be applied to one or more selected products",
            400
          );
        }
      }

      // Calculate discount amount
      let discountAmount = 0;
      let discountDetails = {
        type: coupon.type,
        value: coupon.value,
        discountAmount: 0,
        maxDiscountAmount: coupon.maxDiscountAmount || null,
      };

      if (orderAmount) {
        if (coupon.type === CouponType.PERCENTAGE) {
          // Validate percentage value (should be between 0 and 100)
          if (coupon.value < 0 || coupon.value > 100) {
            throw new AppError("Invalid percentage value for coupon", 400);
          }
          discountAmount = (orderAmount * coupon.value) / 100;
          if (coupon.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
          }
        } else if (coupon.type === CouponType.FIXED) {
          // Fixed discount cannot exceed order amount
          discountAmount = Math.min(coupon.value, orderAmount);
        } else if (coupon.type === CouponType.FREE_SHIPPING) {
          // Free shipping - discount amount would be shipping cost
          // This is handled separately in checkout
          discountAmount = 0;
        }

        // Ensure discount doesn't exceed order amount
        discountAmount = Math.min(discountAmount, orderAmount);
        discountDetails.discountAmount = Math.round(discountAmount * 100) / 100; // Round to 2 decimal places
      }

      // Return validation result
      res.apiSuccess(
        {
          isValid: true,
          coupon: {
            code: coupon.code,
            name: coupon.name,
            description: coupon.description,
            type: coupon.type,
            value: coupon.value,
            minOrderAmount: coupon.minOrderAmount || null,
            maxDiscountAmount: coupon.maxDiscountAmount || null,
          },
          discount: discountDetails,
        },
        "Coupon is valid"
      );
    }
  );
}

export const couponController = new CouponController();
