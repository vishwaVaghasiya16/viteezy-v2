import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Products, ProductVariants, Coupons } from "@/models/commerce";
import { User, Addresses } from "@/models/core";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email?: string;
    name?: string;
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: {
    products: Array<{
      productId: string;
      productName: string;
      isAvailable: boolean;
      hasVariants: boolean;
      variantRequired: boolean;
      variantValid: boolean;
      inventoryAvailable: boolean;
      priceValid: boolean;
    }>;
    pricing: {
      subtotal: number;
      membershipDiscount: number;
      total: number;
      currency: string;
    };
    address: {
      shippingAddressValid: boolean;
      billingAddressValid: boolean;
    };
    membership: {
      isValid: boolean;
      discountAmount: number;
    };
    family: {
      isValid: boolean;
      relationshipValid: boolean;
    };
  };
}

class PreCheckoutController {
  /**
   * Validate pre-checkout data
   * @route POST /api/pre-checkout/validate
   * @access Private
   */
  validatePreCheckout = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const {
        items,
        shippingAddressId,
        billingAddressId,
        membership,
        familyMember,
        couponCode,
      } = req.body;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      const errors: string[] = [];
      const warnings: string[] = [];
      const validationData: ValidationResult["data"] = {
        products: [],
        pricing: {
          subtotal: 0,
          membershipDiscount: 0,
          total: 0,
          currency: "EUR",
        },
        address: {
          shippingAddressValid: false,
          billingAddressValid: false,
        },
        membership: {
          isValid: false,
          discountAmount: 0,
        },
        family: {
          isValid: false,
          relationshipValid: false,
        },
      };

      // 1. Validate Products and Variants
      const productIds = items.map(
        (item: any) => new mongoose.Types.ObjectId(item.productId)
      );
      const products = await Products.find({
        _id: { $in: productIds },
        isDeleted: false,
      }).lean();

      if (products.length !== productIds.length) {
        errors.push("One or more products are not found or unavailable");
      }

      const productMap = new Map(
        products.map((product: any) => [product._id.toString(), product])
      );

      // Check for variants for each product
      const variantIds = items
        .filter((item: any) => item.variantId)
        .map((item: any) => new mongoose.Types.ObjectId(item.variantId));

      const variants =
        variantIds.length > 0
          ? await ProductVariants.find({
              _id: { $in: variantIds },
              isDeleted: false,
            }).lean()
          : [];

      const variantMap = new Map(
        variants.map((variant: any) => [variant._id.toString(), variant])
      );

      let subtotal = 0;
      let currency = items[0]?.price?.currency || "EUR";

      // Validate each item
      for (const item of items) {
        const productId = item.productId;
        const product = productMap.get(productId);

        if (!product) {
          errors.push(`Product ${productId} is not found`);
          continue;
        }

        // Check product availability
        const isAvailable = product.status === true; // true = Active, false = Inactive
        if (!isAvailable) {
          errors.push(
            `Product ${product.title?.en || productId} is not available`
          );
        }

        // Check if product has variants
        const productVariants = await ProductVariants.find({
          productId: new mongoose.Types.ObjectId(productId),
          isDeleted: false,
          isActive: true,
        }).lean();

        const hasVariants = productVariants.length > 0;
        const variantRequired = hasVariants;
        let variantValid = true;
        let inventoryAvailable = true;
        let priceValid = true;

        // If product has variants, variant must be provided
        if (hasVariants && !item.variantId) {
          errors.push(
            `Product ${
              product.title?.en || productId
            } requires a variant selection`
          );
          variantValid = false;
        }

        // If variant is provided, validate it
        if (item.variantId) {
          const variant = variantMap.get(item.variantId);
          if (!variant) {
            errors.push(`Variant ${item.variantId} is not found`);
            variantValid = false;
          } else {
            // Check if variant belongs to product
            if (variant.productId.toString() !== productId) {
              errors.push(
                `Variant ${item.variantId} does not belong to product ${productId}`
              );
              variantValid = false;
            }

            // Check inventory
            if (variant.inventory.trackQuantity) {
              const availableQty =
                variant.inventory.quantity - variant.inventory.reserved;
              if (availableQty < item.quantity) {
                if (variant.inventory.allowBackorder) {
                  warnings.push(
                    `Product ${
                      product.title?.en || productId
                    } variant has low stock. Backorder allowed.`
                  );
                } else {
                  errors.push(
                    `Insufficient inventory for product ${
                      product.title?.en || productId
                    } variant. Available: ${availableQty}, Requested: ${
                      item.quantity
                    }`
                  );
                  inventoryAvailable = false;
                }
              }
            }

            // Validate pricing
            const variantPrice = variant.price.amount;
            const itemPrice = item.price.amount;
            if (Math.abs(variantPrice - itemPrice) > 0.01) {
              errors.push(
                `Price mismatch for product ${
                  product.title?.en || productId
                } variant. Expected: ${variantPrice}, Provided: ${itemPrice}`
              );
              priceValid = false;
            }

            // Use variant price for subtotal
            subtotal += variantPrice * item.quantity;
            currency = variant.price.currency || currency;
          }
        } else if (!hasVariants) {
          // Product without variants - check if price is provided correctly
          // Note: Products without variants might not have price in the model
          // This would need to be handled based on your business logic
          subtotal += item.price.amount * item.quantity;
          currency = item.price.currency || currency;
        }

        validationData.products.push({
          productId,
          productName: product.title?.en || product.slug || productId,
          isAvailable,
          hasVariants,
          variantRequired,
          variantValid,
          inventoryAvailable,
          priceValid,
        });
      }

      // 2. Validate Address Selection
      if (shippingAddressId) {
        const shippingAddress = await Addresses.findOne({
          _id: new mongoose.Types.ObjectId(shippingAddressId),
          userId,
          isDeleted: false,
        }).lean();

        if (!shippingAddress) {
          errors.push("Shipping address not found or does not belong to user");
        } else {
          validationData.address.shippingAddressValid = true;
        }
      } else {
        errors.push("Shipping address is required");
      }

      if (billingAddressId) {
        const billingAddress = await Addresses.findOne({
          _id: new mongoose.Types.ObjectId(billingAddressId),
          userId,
          isDeleted: false,
        }).lean();

        if (!billingAddress) {
          errors.push("Billing address not found or does not belong to user");
        } else {
          validationData.address.billingAddressValid = true;
        }
      } else {
        // Billing address is optional, use shipping address if not provided
        validationData.address.billingAddressValid = true;
      }

      // 3. Validate Membership Discount
      if (membership?.isMember) {
        if (!membership.discountType || !membership.discountValue) {
          errors.push(
            "Membership discount type and value are required when isMember is true"
          );
        } else {
          let discountAmount = 0;
          if (membership.discountType === "Fixed") {
            discountAmount = Math.min(membership.discountValue, subtotal);
          } else {
            discountAmount = (subtotal * membership.discountValue) / 100;
            discountAmount = Math.min(discountAmount, subtotal);
          }

          validationData.membership.isValid = true;
          validationData.membership.discountAmount =
            Math.round((discountAmount + Number.EPSILON) * 100) / 100;
        }
      } else {
        validationData.membership.isValid = true; // No membership is valid
      }

      // 4. Validate Family Relationship (if family member is buying)
      if (familyMember?.isBuyingForFamily) {
        if (!familyMember.familyMemberId) {
          errors.push("Family member ID is required when buying for family");
        } else {
          // Check if family member exists and belongs to user's family
          // Note: This assumes family relationships are stored in user metadata or a separate collection
          // You may need to adjust this based on your actual family relationship implementation
          const familyMemberUser = await User.findOne({
            _id: new mongoose.Types.ObjectId(familyMember.familyMemberId),
            isActive: true,
          }).lean();

          if (!familyMemberUser) {
            errors.push("Family member not found");
          } else {
            // Validate relationship (you may need to check a family relationship collection)
            // For now, we'll assume if the user exists, relationship is valid
            // You can add more specific relationship validation here
            validationData.family.isValid = true;
            validationData.family.relationshipValid = true;
          }
        }
      } else {
        validationData.family.isValid = true; // Not buying for family is valid
      }

      // 5. Validate Coupon (if provided)
      if (couponCode) {
        const coupon = await Coupons.findOne({
          code: couponCode,
          isDeleted: false,
        }).lean();

        if (!coupon) {
          warnings.push(`Coupon code ${couponCode} is not found`);
        } else if (!coupon.isActive) {
          warnings.push(`Coupon code ${couponCode} is not active`);
        } else {
          const now = new Date();
          if (coupon.validFrom && now < coupon.validFrom) {
            warnings.push(`Coupon code ${couponCode} is not yet valid`);
          }
          if (coupon.validUntil && now > coupon.validUntil) {
            warnings.push(`Coupon code ${couponCode} has expired`);
          }
        }
      }

      // Calculate final totals
      const membershipDiscount = validationData.membership.discountAmount || 0;
      const total = subtotal - membershipDiscount;

      validationData.pricing = {
        subtotal: Math.round((subtotal + Number.EPSILON) * 100) / 100,
        membershipDiscount,
        total: Math.round((total + Number.EPSILON) * 100) / 100,
        currency,
      };

      const isValid = errors.length === 0;

      const response: ValidationResult = {
        isValid,
        errors,
        warnings,
        data: validationData,
      };

      res.status(200).json({
        success: true,
        message: isValid
          ? "Pre-checkout validation passed"
          : "Pre-checkout validation failed",
        data: response,
      });
    }
  );
}

export const preCheckoutController = new PreCheckoutController();
