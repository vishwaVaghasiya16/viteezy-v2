import { Request, Response, NextFunction } from "express";
import { cartService } from "../services/cartService";
import { AppError } from "../utils/AppError";
import { Addresses } from "../models/core/addresses.model";
import mongoose from "mongoose";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

class CheckoutController {
  /**
   * Get checkout summary with membership discount calculation
   * @route GET /api/checkout/summary
   * @access Private
   */
  static async getCheckoutSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      // Validate cart and get pricing with member discounts
      const cartValidation = await cartService.validateCart(userId);

      if (!cartValidation.isValid) {
        res.status(400).json({
          success: false,
          message: "Cart validation failed",
          errors: cartValidation.errors,
          warnings: cartValidation.warnings,
        });
        return;
      }

      // Get user's default addresses
      const shippingAddress = await Addresses.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        isDefault: true,
        isDeleted: false,
      }).lean();

      const billingAddress = await Addresses.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        isDefault: true,
        isDeleted: false,
      }).lean();

      // Check if user is a member (check if any item has member pricing)
      const isMember = cartValidation.items.some((item) => item.isMember === true);

      // Build summary response
      const summary = {
        cart: {
          items: cartValidation.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            originalPrice: item.originalPrice,
            memberPrice: item.memberPrice,
            discount: item.discount,
            isMember: item.isMember || false,
          })),
        },
        pricing: {
          originalSubtotal: cartValidation.pricing.originalSubtotal,
          subtotal: cartValidation.pricing.subtotal,
          membershipDiscount: cartValidation.pricing.membershipDiscount,
          tax: cartValidation.pricing.tax,
          shipping: cartValidation.pricing.shipping,
          total: cartValidation.pricing.total,
        },
        addresses: {
          shipping: shippingAddress
            ? {
                id: shippingAddress._id,
                firstName: shippingAddress.firstName,
                lastName: shippingAddress.lastName,
                phone: shippingAddress.phone,
                addressLine1: shippingAddress.addressLine1,
                addressLine2: shippingAddress.addressLine2,
                houseNumber: shippingAddress.houseNumber,
                houseNumberAddition: shippingAddress.houseNumberAddition,
                city: shippingAddress.city,
                state: shippingAddress.state,
                zip: shippingAddress.zip,
                country: shippingAddress.country,
                type: shippingAddress.type,
                label: shippingAddress.label,
              }
            : null,
          billing: billingAddress
            ? {
                id: billingAddress._id,
                firstName: billingAddress.firstName,
                lastName: billingAddress.lastName,
                phone: billingAddress.phone,
                addressLine1: billingAddress.addressLine1,
                addressLine2: billingAddress.addressLine2,
                houseNumber: billingAddress.houseNumber,
                houseNumberAddition: billingAddress.houseNumberAddition,
                city: billingAddress.city,
                state: billingAddress.state,
                zip: billingAddress.zip,
                country: billingAddress.country,
                type: billingAddress.type,
                label: billingAddress.label,
              }
            : null,
        },
        membership: {
          isMember,
          discount: isMember
            ? {
                amount: cartValidation.pricing.membershipDiscount.amount,
                currency: cartValidation.pricing.membershipDiscount.currency,
              }
            : null,
        },
        warnings: cartValidation.warnings,
      };

      res.status(200).json({
        success: true,
        message: "Checkout summary retrieved successfully",
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}

export { CheckoutController };

