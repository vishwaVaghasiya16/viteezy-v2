import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Coupons, Orders, Carts, Products } from "@/models/commerce";
import { CouponType, ProductVariant } from "@/models/enums";
import { cartService } from "@/services/cartService";
import { DEFAULT_LANGUAGE, SupportedLanguage } from "@/models/common.model";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    id?: string;
  };
  userId?: string;
}

class CouponController {
  /**
   * Validate and apply/remove coupon from cart
   * @route POST /api/coupons/validate
   * @access Private
   */
  validateCoupon = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?.id || req.user?._id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { cartId, couponCode, language = DEFAULT_LANGUAGE } = req.body;

      // Get and validate cart
      const cart = await Carts.findOne({
        _id: new mongoose.Types.ObjectId(cartId),
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      }).lean();

      if (!cart) {
        throw new AppError("Cart not found", 404);
      }

      // If couponCode is null or empty, remove coupon from cart
      if (!couponCode || couponCode.trim() === "") {
        // Use cartService to remove coupon (it will get the cart by userId and update it)
        // But first verify the cart belongs to this user
        const userCart = await Carts.findOne({
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
        }).lean();

        if (!userCart || userCart._id.toString() !== cartId) {
          throw new AppError("Cart not found or does not belong to user", 404);
        }

        const result = await cartService.removeCoupon(userId);
        res.apiSuccess(
          {
            cart: result.cart,
            couponCode: null,
          },
          result.message
        );
        return;
      }

      // Normalize coupon code
      const normalizedCouponCode = couponCode.toUpperCase().trim();

      try {
        // Find coupon by code
        const coupon = await Coupons.findOne({
          code: normalizedCouponCode,
          isDeleted: false,
        }).lean();

        if (!coupon) {
          // Remove coupon from cart if invalid
          await Carts.findByIdAndUpdate(
            cart._id,
            {
              couponCode: null,
              couponDiscountAmount: 0,
              updatedAt: new Date(),
            },
            { new: true }
          );
          throw new AppError("Invalid coupon code", 404);
        }

        // Check if coupon is active
        if (!coupon.isActive) {
          // Remove coupon from cart if not active
          await Carts.findByIdAndUpdate(
            cart._id,
            {
              couponCode: null,
              couponDiscountAmount: 0,
              updatedAt: new Date(),
            },
            { new: true }
          );
          throw new AppError("This coupon is not active", 400);
        }

        // Check date validity
        const now = new Date();
        if (coupon.validFrom && now < coupon.validFrom) {
          // Remove coupon from cart if not yet valid
          await Carts.findByIdAndUpdate(
            cart._id,
            {
              couponCode: null,
              couponDiscountAmount: 0,
              updatedAt: new Date(),
            },
            { new: true }
          );
          throw new AppError("This coupon is not yet valid", 400);
        }

        if (coupon.validUntil && now > coupon.validUntil) {
          // Remove coupon from cart if expired
          await Carts.findByIdAndUpdate(
            cart._id,
            {
              couponCode: null,
              couponDiscountAmount: 0,
              updatedAt: new Date(),
            },
            { new: true }
          );
          throw new AppError("This coupon has expired", 400);
        }

        // Check global usage limit
        if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
          // Remove coupon from cart if usage limit reached
          await Carts.findByIdAndUpdate(
            cart._id,
            {
              couponCode: null,
              couponDiscountAmount: 0,
              updatedAt: new Date(),
            },
            { new: true }
          );
          throw new AppError("This coupon has reached its usage limit", 400);
        }

        // Check user usage limit
        if (coupon.userUsageLimit) {
          const userCouponUsageCount = await Orders.countDocuments({
            userId: new mongoose.Types.ObjectId(userId),
            couponCode: coupon.code,
            isDeleted: false,
          });

          if (userCouponUsageCount >= coupon.userUsageLimit) {
            // Remove coupon from cart if user limit reached
            await Carts.findByIdAndUpdate(
              cart._id,
              {
                couponCode: null,
                couponDiscountAmount: 0,
                updatedAt: new Date(),
              },
              { new: true }
            );
            throw new AppError(
              "You have reached the maximum usage limit for this coupon",
              400
            );
          }
        }

        // Calculate order amount (discounted price total before coupon) - same logic as cartService.applyCoupon
        // We need to calculate totals without coupon to get the base amount for validation
        const totalsWithoutCoupon = await (
          cartService as any
        ).calculateCartTotalsWithVariantType(
          cart.items,
          cart.variantType as ProductVariant,
          0 // No coupon discount
        );

        // Order amount is the discounted price total (subtotal - discount + tax)
        // This represents the amount before coupon is applied
        const orderAmount =
          totalsWithoutCoupon.subtotal -
          totalsWithoutCoupon.discount +
          totalsWithoutCoupon.tax;

        // Validate cart order amount with coupon minimum order amount
        if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
          // Remove coupon from cart if minimum order amount not met
          await Carts.findByIdAndUpdate(
            cart._id,
            {
              couponCode: null,
              couponDiscountAmount: 0,
              updatedAt: new Date(),
            },
            { new: true }
          );
          throw new AppError(
            `Minimum order amount of ${coupon.minOrderAmount} ${
              totalsWithoutCoupon.currency || cart.currency || "EUR"
            } is required for this coupon`,
            400
          );
        }

        // Get product IDs and category IDs from cart
        const productIds = cart.items.map((item: any) =>
          item.productId.toString()
        );
        const products = await Products.find({
          _id: { $in: cart.items.map((item: any) => item.productId) },
          isDeleted: false,
        })
          .select("categories")
          .lean();

        const categoryIds = new Set<string>();
        products.forEach((product: any) => {
          if (product.categories && Array.isArray(product.categories)) {
            product.categories.forEach(
              (catId: mongoose.Types.ObjectId | string) => {
                categoryIds.add(catId.toString());
              }
            );
          }
        });

        // Check product applicability
        if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
          const applicableProductIds = coupon.applicableProducts.map(
            (id: mongoose.Types.ObjectId) => id.toString()
          );
          if (
            !productIds.some((id: string) => applicableProductIds.includes(id))
          ) {
            // Remove coupon from cart if not applicable to products
            await Carts.findByIdAndUpdate(
              cart._id,
              {
                couponCode: null,
                couponDiscountAmount: 0,
                updatedAt: new Date(),
              },
              { new: true }
            );
            throw new AppError(
              "This coupon is not applicable to the selected products",
              400
            );
          }
        }

        // Check category applicability
        if (
          coupon.applicableCategories &&
          coupon.applicableCategories.length > 0
        ) {
          const applicableCategoryIds = coupon.applicableCategories.map(
            (id: mongoose.Types.ObjectId) => id.toString()
          );
          if (
            !Array.from(categoryIds).some((id: string) =>
              applicableCategoryIds.includes(id)
            )
          ) {
            // Remove coupon from cart if not applicable to categories
            await Carts.findByIdAndUpdate(
              cart._id,
              {
                couponCode: null,
                couponDiscountAmount: 0,
                updatedAt: new Date(),
              },
              { new: true }
            );
            throw new AppError(
              "This coupon is not applicable to the selected categories",
              400
            );
          }
        }

        // Check excluded products
        if (coupon.excludedProducts && coupon.excludedProducts.length > 0) {
          const excludedProductIds = coupon.excludedProducts.map(
            (id: mongoose.Types.ObjectId) => id.toString()
          );
          if (
            productIds.some((id: string) => excludedProductIds.includes(id))
          ) {
            // Remove coupon from cart if excluded products found
            await Carts.findByIdAndUpdate(
              cart._id,
              {
                couponCode: null,
                couponDiscountAmount: 0,
                updatedAt: new Date(),
              },
              { new: true }
            );
            throw new AppError(
              "This coupon cannot be applied to one or more selected products",
              400
            );
          }
        }

        // Apply coupon to cart using cartService
        const result = await cartService.applyCoupon(
          userId,
          normalizedCouponCode
        );

        // Get localized coupon name and description based on language
        const couponName =
          (coupon.name as any)?.[language as SupportedLanguage] ||
          (coupon.name as any)?.en ||
          coupon.code;
        const couponDescription =
          (coupon.description as any)?.[language as SupportedLanguage] ||
          (coupon.description as any)?.en ||
          "";

        // Return cart and couponCode
        res.apiSuccess(
          {
            cart: result.cart,
            couponCode: normalizedCouponCode,
            coupon: {
              code: coupon.code,
              name: couponName,
              description: couponDescription,
              type: coupon.type,
              value: coupon.value,
              discountAmount: result.couponDiscountAmount,
            },
          },
          result.message
        );
      } catch (error: any) {
        // If any validation fails, ensure cart is updated
        // Re-fetch cart to get latest state
        const updatedCart = await Carts.findOne({
          _id: cart._id,
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
        }).lean();

        // Return error response with updated cart
        res.status(error.statusCode || 400).json({
          success: false,
          message: error.message || "Coupon validation failed",
          data: {
            cart: updatedCart,
            couponCode: null,
          },
        });
      }
    }
  );
}

export const couponController = new CouponController();
