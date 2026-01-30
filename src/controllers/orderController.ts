import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";
import { Orders, Payments, Products, Coupons, Carts } from "@/models/commerce";
import { Addresses, User } from "@/models/core";
import {
  CouponType,
  OrderPlanType,
  SubscriptionCycle,
  ProductVariant,
  OrderStatus,
  PaymentStatus,
} from "@/models/enums";
import { PriceType } from "@/models/common.model";
import {
  getSubscriptionPriceFromProduct,
  getBaseSubtotalForSubscription,
} from "@/utils/productSubscriptionPrice";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

interface MembershipPayload {
  isMember?: boolean;
  membershipId?: string;
  level?: string;
  label?: string;
  discountType?: "Percentage" | "Fixed";
  discountValue?: number;
  metadata?: Record<string, any>;
}

interface CouponCalculationInput {
  couponCode: string;
  userId: string;
  orderAmount: number;
  shippingAmount: number;
  productIds: string[];
  categoryIds: string[];
}

interface CouponCalculationResult {
  discountAmount: number;
  metadata?: Record<string, any>;
  shippingDiscount?: number;
}

const roundAmount = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const createPrice = (
  amount: number,
  currency: string,
  taxRate = 0
): PriceType => ({
  amount: roundAmount(amount),
  currency,
  taxRate,
});

const generateOrderNumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `VTZ-${timestamp}-${random}`;
};

const calculateMembershipDiscount = (
  subtotal: number,
  membership?: MembershipPayload
): { amount: number; metadata?: Record<string, any> } => {
  if (!membership?.isMember || !membership.discountValue) {
    return { amount: 0 };
  }

  let discountAmount = 0;
  if (membership.discountType === "Fixed") {
    discountAmount = membership.discountValue;
  } else {
    discountAmount = (subtotal * membership.discountValue) / 100;
  }

  discountAmount = Math.min(discountAmount, subtotal);

  return {
    amount: roundAmount(discountAmount),
    metadata: {
      membershipId: membership.membershipId,
      level: membership.level,
      label: membership.label,
      discountType: membership.discountType,
      discountValue: membership.discountValue,
      ...membership.metadata,
    },
  };
};

/**
 * Calculate 15% discount for 90-day subscription plans
 * This discount applies to the base subtotal amount
 */
const calculate90DaySubscriptionDiscount = (
  subtotal: number,
  planType: OrderPlanType,
  cycleDays?: number
): { amount: number; metadata?: Record<string, any> } => {
  // Only apply discount for subscription plans with 90-day cycle
  if (planType !== OrderPlanType.SUBSCRIPTION || cycleDays !== 90) {
    return { amount: 0 };
  }

  // Apply 15% discount to subtotal
  const discountAmount = (subtotal * 15) / 100;
  const finalDiscountAmount = Math.min(discountAmount, subtotal);

  return {
    amount: roundAmount(finalDiscountAmount),
    metadata: {
      discountType: "90-Day Subscription Discount",
      discountPercentage: 15,
      cycleDays: 90,
      appliedTo: "subtotal",
    },
  };
};

const validateCouponForOrder = async ({
  couponCode,
  userId,
  orderAmount,
  shippingAmount,
  productIds,
  categoryIds,
}: CouponCalculationInput): Promise<CouponCalculationResult> => {
  const coupon = await Coupons.findOne({
    code: couponCode,
    isDeleted: false,
  }).lean();

  if (!coupon) {
    throw new AppError("Invalid coupon code", 404);
  }

  if (!coupon.isActive) {
    throw new AppError("This coupon is not active", 400);
  }

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) {
    throw new AppError("This coupon is not yet valid", 400);
  }
  if (coupon.validUntil && now > coupon.validUntil) {
    throw new AppError("This coupon has expired", 400);
  }

  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    throw new AppError("This coupon has reached its usage limit", 400);
  }

  if (coupon.userUsageLimit) {
    const userUsageCount = await Orders.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      couponCode: coupon.code,
      isDeleted: false,
    });

    if (userUsageCount >= coupon.userUsageLimit) {
      throw new AppError(
        "You have reached the maximum usage limit for this coupon",
        400
      );
    }
  }

  if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
    throw new AppError(
      `Minimum order amount of ${coupon.minOrderAmount} is required for this coupon`,
      400
    );
  }

  if (
    coupon.applicableProducts &&
    coupon.applicableProducts.length > 0 &&
    !productIds.some((id) =>
      coupon.applicableProducts
        .map((productId) => productId.toString())
        .includes(id)
    )
  ) {
    throw new AppError(
      "This coupon is not applicable to the selected products",
      400
    );
  }

  if (
    coupon.applicableCategories &&
    coupon.applicableCategories.length > 0 &&
    !categoryIds.some((id) =>
      coupon.applicableCategories
        .map((categoryId) => categoryId.toString())
        .includes(id)
    )
  ) {
    throw new AppError(
      "This coupon is not applicable to the selected categories",
      400
    );
  }

  if (
    coupon.excludedProducts &&
    coupon.excludedProducts.length > 0 &&
    productIds.some((id) =>
      coupon.excludedProducts
        .map((productId) => productId.toString())
        .includes(id)
    )
  ) {
    throw new AppError(
      "This coupon cannot be applied to one or more selected products",
      400
    );
  }

  let discountAmount = 0;
  let shippingDiscount = 0;

  if (coupon.type === CouponType.PERCENTAGE) {
    discountAmount = (orderAmount * coupon.value) / 100;
    if (coupon.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    }
  } else if (coupon.type === CouponType.FIXED) {
    discountAmount = Math.min(coupon.value, orderAmount);
  } else if (coupon.type === CouponType.FREE_SHIPPING) {
    shippingDiscount = Math.min(shippingAmount, shippingAmount);
    discountAmount = shippingDiscount;
  }

  return {
    discountAmount: roundAmount(discountAmount),
    shippingDiscount: roundAmount(shippingDiscount),
    metadata: {
      type: coupon.type,
      value: coupon.value,
      minOrderAmount: coupon.minOrderAmount,
      maxDiscountAmount: coupon.maxDiscountAmount,
      name: coupon.name,
    },
  };
};

class OrderController {
  /**
   * Create a new order before payment redirection
   * @route POST /api/orders
   * @access Private
   */
  createOrder = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const {
        cartId,
        variantType,
        planDurationDays,
        isOneTime,
        capsuleCount,
        shippingAddressId,
        billingAddressId,
        subTotal,
        discountedPrice,
        couponDiscountAmount = 0,
        membershipDiscountAmount = 0,
        subscriptionPlanDiscountAmount = 0,
        taxAmount = 0,
        grandTotal,
        currency = "EUR",
        couponCode,
        membership,
        metadata,
        paymentMethod,
        notes,
      } = req.body;

      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Delete any existing pending orders with pending payment status
      // This ensures only one pending order exists at a time
      const pendingOrders = await Orders.find({
        userId: userId,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        isDeleted: false,
      })
        .select("_id")
        .lean();

      if (pendingOrders.length > 0) {
        const orderIds = pendingOrders.map((order: any) => order._id);

        // Soft delete pending orders
        const deletedOrders = await Orders.updateMany(
          {
            _id: { $in: orderIds },
          },
          {
            $set: {
              isDeleted: true,
              deletedAt: new Date(),
            },
          }
        );

        // Soft delete associated pending payments
        const deletedPayments = await Payments.updateMany(
          {
            orderId: { $in: orderIds },
            status: PaymentStatus.PENDING,
            isDeleted: false,
          },
          {
            $set: {
              isDeleted: true,
              deletedAt: new Date(),
            },
          }
        );

        logger.info(
          `Deleted ${deletedOrders.modifiedCount} pending order(s) and ${deletedPayments.modifiedCount} associated payment(s) for user ${userId} before creating new order`
        );
      }

      // Validate cartId
      if (!cartId) {
        throw new AppError("Cart ID is required", 400);
      }

      if (!mongoose.Types.ObjectId.isValid(cartId)) {
        throw new AppError("Invalid cart ID format", 400);
      }

      // Fetch cart and validate ownership
      const cart = await Carts.findOne({
        _id: new mongoose.Types.ObjectId(cartId),
        userId: userId,
        isDeleted: false,
      }).lean();

      if (!cart) {
        throw new AppError("Cart not found or does not belong to user", 404);
      }

      if (!cart.items || cart.items.length === 0) {
        throw new AppError("Cart is empty", 400);
      }

      // Validate variantType
      if (
        !variantType ||
        !Object.values(ProductVariant).includes(variantType)
      ) {
        throw new AppError(
          "Valid variantType (SACHETS or STAND_UP_POUCH) is required",
          400
        );
      }

      // Validate that cart variantType matches order variantType
      if (cart.variantType) {
        if (cart.variantType !== variantType) {
          throw new AppError(
            `Cart variantType (${cart.variantType}) does not match order variantType (${variantType}). All items in cart must have the same variant type.`,
            400
          );
        }
      } else {
        // If cart doesn't have variantType set, it means cart is empty or was created before variantType was added
        // In this case, we'll use the variantType from the order request
        // But we should log a warning or handle this edge case
        logger.warn(
          `Cart ${cartId} does not have variantType set. Using variantType from order request: ${variantType}`
        );
      }

      // Determine planType from isOneTime
      const planType: OrderPlanType = isOneTime
        ? OrderPlanType.ONE_TIME
        : OrderPlanType.SUBSCRIPTION;

      // Validate planDurationDays based on isOneTime
      if (isOneTime) {
        // For one-time purchase, planDurationDays must be 30 or 60
        // if (!planDurationDays || ![30, 60].includes(planDurationDays)) {
        //   throw new AppError(
        //     "For one-time purchase, planDurationDays must be 30 or 60",
        //     400
        //   );
        // }
      } else {
        // For subscription, planDurationDays must be 30, 60, 90, or 180
        if (
          !planDurationDays ||
          ![30, 60, 90, 180].includes(planDurationDays)
        ) {
          throw new AppError(
            "For subscription plans, planDurationDays must be 30, 60, 90, or 180",
            400
          );
        }
      }

      // Validate and fetch shipping address
      if (!shippingAddressId) {
        throw new AppError("Shipping address ID is required", 400);
      }

      if (!mongoose.Types.ObjectId.isValid(shippingAddressId)) {
        throw new AppError("Invalid shipping address ID format", 400);
      }

      const shippingAddressDoc = await Addresses.findOne({
        _id: new mongoose.Types.ObjectId(shippingAddressId),
        userId: userId,
        isDeleted: false,
      }).lean();

      if (!shippingAddressDoc) {
        throw new AppError(
          "Shipping address not found or does not belong to user",
          404
        );
      }

      // Validate billing address if provided
      if (billingAddressId) {
        if (!mongoose.Types.ObjectId.isValid(billingAddressId)) {
          throw new AppError("Invalid billing address ID format", 400);
        }

        const billingAddressDoc = await Addresses.findOne({
          _id: new mongoose.Types.ObjectId(billingAddressId),
          userId: userId,
          isDeleted: false,
        }).lean();

        if (!billingAddressDoc) {
          throw new AppError(
            "Billing address not found or does not belong to user",
            404
          );
        }
      }

      // Get product IDs from cart
      const productObjectIds = cart.items.map(
        (item: any) => new mongoose.Types.ObjectId(item.productId)
      );

      // Use planDurationDays from body (already validated above)
      const planDays = planDurationDays;

      // For SACHETS one-time, use planDurationDays as capsuleCount
      // For STAND_UP_POUCH, use capsuleCount from body
      let effectiveCapsuleCount: number | undefined;
      if (variantType === ProductVariant.STAND_UP_POUCH) {
        effectiveCapsuleCount = capsuleCount;
      } else if (variantType === ProductVariant.SACHETS && isOneTime) {
        // For SACHETS one-time, planDurationDays represents capsuleCount
        effectiveCapsuleCount = planDurationDays;
      }

      // Additional validation: Subscription plans only for SACHETS
      if (!isOneTime && variantType !== ProductVariant.SACHETS) {
        throw new AppError(
          "Subscription plans are only available for SACHETS variant type",
          400
        );
      }

      // Fetch products with pricing information based on variantType and planType
      let selectFields = "title slug skuRoot categories price variant";
      if (variantType === ProductVariant.SACHETS) {
        selectFields += " sachetPrices";
      }
      if (variantType === ProductVariant.STAND_UP_POUCH) {
        selectFields += " standupPouchPrice hasStandupPouch";
      }

      const products = await Products.find({
        _id: { $in: productObjectIds },
        isDeleted: false,
      })
        .select(selectFields)
        .lean();

      if (products.length !== productObjectIds.length) {
        throw new AppError("One or more products are unavailable", 400);
      }

      const productMap = new Map(
        products.map((product: any) => [product._id.toString(), product])
      );

      // Use currency from body (already normalized)
      const normalizedCurrency = currency.toUpperCase();

      const categoryIds = new Set<string>();

      products.forEach((product: any) => {
        (product.categories || []).forEach(
          (categoryId: mongoose.Types.ObjectId) =>
            categoryIds.add(categoryId.toString())
        );
      });

      // Build order items with prices calculated from product pricing based on variantType and planType
      const orderItems = cart.items.map((cartItem: any) => {
        const product = productMap.get(cartItem.productId.toString());

        if (!product) {
          throw new AppError("Invalid product in cart", 400);
        }

        let itemPlanDays: number | undefined;
        let itemCapsuleCount: number | undefined;
        let itemAmount: number = 0;
        let itemDiscountedPrice: number = 0;
        let itemTaxRate: number = 0;
        let itemTotalAmount: number = 0;
        let itemDurationDays: number | undefined;
        let itemSavingsPercentage: number | undefined;
        let itemFeatures: string[] = [];

        // Calculate price based on variantType and planType with proper validations
        if (variantType === ProductVariant.SACHETS) {
          if (!product.sachetPrices) {
            throw new AppError(
              `Product ${
                product.title?.en || product.slug || product._id
              } does not support SACHETS variant. Please select a different product or variant type.`,
              400
            );
          }

          if (planType === OrderPlanType.SUBSCRIPTION && planDays) {
            // Use subscription pricing based on planDays
            itemPlanDays = planDays;
            let selectedPlan: any = null;
            let planKey = "";

            // Map planDays to sachetPrices field
            switch (planDays) {
              case 30:
                selectedPlan = product.sachetPrices.thirtyDays;
                planKey = "thirtyDays";
                break;
              case 60:
                selectedPlan = product.sachetPrices.sixtyDays;
                planKey = "sixtyDays";
                break;
              case 90:
                selectedPlan = product.sachetPrices.ninetyDays;
                planKey = "ninetyDays";
                break;
              case 180:
                selectedPlan = product.sachetPrices.oneEightyDays;
                planKey = "oneEightyDays";
                break;
              default:
                throw new AppError(
                  `Invalid planDays: ${planDays}. Must be 30, 60, 90, or 180 for subscription plans`,
                  400
                );
            }

            // Validate that the product supports the selected plan
            if (!selectedPlan) {
              throw new AppError(
                `Product ${
                  product.title?.en || product.slug || product._id
                } does not support ${planDays}-day subscription plan. Available plans: ${Object.keys(
                  product.sachetPrices
                )
                  .filter((k) => k !== "oneTime")
                  .join(", ")}`,
                400
              );
            }

            // Extract all pricing and plan details
            itemAmount = selectedPlan.amount || selectedPlan.totalAmount || 0;
            itemDiscountedPrice =
              selectedPlan.discountedPrice ||
              selectedPlan.totalAmount ||
              itemAmount;
            itemTaxRate = selectedPlan.taxRate || 0;
            itemTotalAmount =
              selectedPlan.totalAmount ||
              selectedPlan.discountedPrice ||
              itemAmount;
            itemDurationDays = selectedPlan.durationDays || planDays;
            // Get capsuleCount from product DB for subscription plans
            itemCapsuleCount = selectedPlan.capsuleCount || undefined;
            itemSavingsPercentage = selectedPlan.savingsPercentage || undefined;
            itemFeatures = Array.isArray(selectedPlan.features)
              ? selectedPlan.features
              : [];
          } else {
            // Use one-time pricing based on effectiveCapsuleCount (which is planDurationDays for SACHETS one-time)
            itemCapsuleCount = effectiveCapsuleCount || 30; // Default to 30 if not provided
            const oneTimePlan = product.sachetPrices.oneTime;

            if (!oneTimePlan) {
              throw new AppError(
                `Product ${
                  product.title?.en || product.slug || product._id
                } does not support one-time purchase for SACHETS variant`,
                400
              );
            }

            if (itemCapsuleCount === 60) {
              if (!oneTimePlan.count60) {
                throw new AppError(
                  `Product ${
                    product.title?.en || product.slug || product._id
                  } does not support 60-count one-time purchase. Only 30-count is available.`,
                  400
                );
              }
              // Extract all pricing details for count60
              const count60Plan = oneTimePlan.count60;
              itemAmount = count60Plan.amount || 0;
              itemDiscountedPrice = count60Plan.discountedPrice || itemAmount;
              itemTaxRate = count60Plan.taxRate || 0;
              itemTotalAmount = count60Plan.discountedPrice || itemAmount;
              itemCapsuleCount = count60Plan.capsuleCount || 60;
              itemSavingsPercentage =
                count60Plan.savingsPercentage || undefined;
              itemFeatures = Array.isArray(count60Plan.features)
                ? count60Plan.features
                : [];
            } else {
              if (!oneTimePlan.count30) {
                throw new AppError(
                  `Product ${
                    product.title?.en || product.slug || product._id
                  } does not support one-time purchase for SACHETS variant`,
                  400
                );
              }
              // Extract all pricing details for count30
              const count30Plan = oneTimePlan.count30;
              itemAmount = count30Plan.amount || 0;
              itemDiscountedPrice = count30Plan.discountedPrice || itemAmount;
              itemTaxRate = count30Plan.taxRate || 0;
              itemTotalAmount = count30Plan.discountedPrice || itemAmount;
              itemCapsuleCount = count30Plan.capsuleCount || 30;
              itemSavingsPercentage =
                count30Plan.savingsPercentage || undefined;
              itemFeatures = Array.isArray(count30Plan.features)
                ? count30Plan.features
                : [];
            }
          }
        } else if (variantType === ProductVariant.STAND_UP_POUCH) {
          // Validate that product supports stand-up pouch
          if (!product.hasStandupPouch || !product.standupPouchPrice) {
            throw new AppError(
              `Product ${
                product.title?.en || product.slug || product._id
              } does not support STAND_UP_POUCH variant`,
              400
            );
          }

          itemCapsuleCount = capsuleCount;
          const standupPrice = product.standupPouchPrice as any;

          if (itemCapsuleCount === 60) {
            if (!standupPrice.count60) {
              throw new AppError(
                `Product ${
                  product.title?.en || product.slug || product._id
                } does not support 60-count stand-up pouch. Only 30-count is available.`,
                400
              );
            }
            // Extract all pricing details for count60
            itemAmount = standupPrice.count60.amount || 0;
            itemDiscountedPrice =
              standupPrice.count60.discountedPrice || itemAmount;
            itemTaxRate = standupPrice.count60.taxRate || 0;
            itemTotalAmount =
              standupPrice.count60.totalAmount ||
              standupPrice.count60.discountedPrice ||
              itemAmount;
            itemCapsuleCount = standupPrice.count60.capsuleCount || 60;
            itemSavingsPercentage =
              standupPrice.count60.savingsPercentage || undefined;
            itemFeatures = Array.isArray(standupPrice.count60.features)
              ? standupPrice.count60.features
              : [];
          } else {
            if (!standupPrice.count30) {
              // Fallback to simple price object if count30 structure doesn't exist
              if (standupPrice.amount) {
                itemAmount = standupPrice.amount || 0;
                itemDiscountedPrice =
                  standupPrice.discountedPrice || itemAmount;
                itemTaxRate = standupPrice.taxRate || 0;
                itemTotalAmount =
                  standupPrice.totalAmount ||
                  standupPrice.discountedPrice ||
                  itemAmount;
                itemCapsuleCount = 30;
                itemFeatures = Array.isArray(standupPrice.features)
                  ? standupPrice.features
                  : [];
              } else {
                throw new AppError(
                  `Product ${
                    product.title?.en || product.slug || product._id
                  } does not have valid pricing for 30-count stand-up pouch`,
                  400
                );
              }
            } else {
              // Extract all pricing details for count30
              itemAmount = standupPrice.count30.amount || 0;
              itemDiscountedPrice =
                standupPrice.count30.discountedPrice || itemAmount;
              itemTaxRate = standupPrice.count30.taxRate || 0;
              itemTotalAmount =
                standupPrice.count30.totalAmount ||
                standupPrice.count30.discountedPrice ||
                itemAmount;
              itemCapsuleCount = standupPrice.count30.capsuleCount || 30;
              itemSavingsPercentage =
                standupPrice.count30.savingsPercentage || undefined;
              itemFeatures = Array.isArray(standupPrice.count30.features)
                ? standupPrice.count30.features
                : [];
            }
          }
        } else {
          throw new AppError(
            `Invalid variantType: ${variantType}. Must be SACHETS or STAND_UP_POUCH`,
            400
          );
        }

        return {
          productId: new mongoose.Types.ObjectId(cartItem.productId),
          name:
            product.title?.en || product.title?.nl || product.slug || "Product",
          planDays: itemPlanDays,
          capsuleCount: itemCapsuleCount,
          // Additional pricing and plan details
          amount: roundAmount(itemAmount),
          discountedPrice: roundAmount(itemDiscountedPrice),
          taxRate: roundAmount(itemTaxRate),
          totalAmount: roundAmount(itemTotalAmount),
          durationDays: itemDurationDays,
          savingsPercentage: itemSavingsPercentage,
          features: itemFeatures,
        };
      });

      // Validate pricing values from body
      if (typeof subTotal !== "number" || subTotal < 0) {
        throw new AppError("Invalid subTotal value", 400);
      }
      if (typeof discountedPrice !== "number" || discountedPrice < 0) {
        throw new AppError("Invalid discountedPrice value", 400);
      }
      if (typeof grandTotal !== "number" || grandTotal < 0) {
        throw new AppError("Invalid grandTotal value", 400);
      }

      // Normalize coupon code
      const normalizedCouponCode = couponCode
        ? couponCode.toUpperCase().trim()
        : undefined;

      // Validate coupon if provided (for metadata purposes)
      let couponMetadata: Record<string, any> | undefined;
      if (normalizedCouponCode) {
        try {
          const couponResult = await validateCouponForOrder({
            couponCode: normalizedCouponCode,
            userId: req.user._id,
            orderAmount: discountedPrice,
            shippingAmount: 0,
            productIds: productObjectIds.map((id: mongoose.Types.ObjectId) =>
              id.toString()
            ),
            categoryIds: Array.from(categoryIds),
          });
          couponMetadata = couponResult.metadata;
        } catch (error: any) {
          // Log but don't fail order creation if coupon validation fails
          logger.warn(
            `Coupon validation failed during order creation: ${error.message}`
          );
        }
      }

      const orderMetadata: Record<string, any> = {
        ...(metadata || {}),
      };

      // Build plan details from new structure
      const planDetails: Record<string, any> = {
        planDurationDays,
        isOneTime,
        variantType,
      };

      if (variantType === ProductVariant.STAND_UP_POUCH && capsuleCount) {
        planDetails.capsuleCount = capsuleCount;
      } else if (variantType === ProductVariant.SACHETS && isOneTime) {
        // For SACHETS one-time, planDurationDays is the capsuleCount
        planDetails.capsuleCount = planDurationDays;
      }

      if (!isOneTime) {
        // For subscription plans, add interval
        planDetails.interval = planDurationDays.toString();
        planDetails.cycleDays = planDurationDays;
      }

      const sanitizedPlanDetails = Object.entries(planDetails).reduce(
        (acc, [key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, any>
      );

      if (Object.keys(sanitizedPlanDetails).length > 0) {
        orderMetadata.planDetails = sanitizedPlanDetails;
      }

      // Store membership metadata if provided
      const membershipMetadata = membership?.metadata || {};

      // Determine plan type from body
      const orderPlanType: OrderPlanType = planType as OrderPlanType;

      const order = await Orders.create({
        orderNumber: generateOrderNumber(),
        userId,
        planType: orderPlanType,
        isOneTime,
        variantType: variantType as ProductVariant,
        selectedPlanDays: !isOneTime ? planDurationDays : undefined,
        items: orderItems,
        subTotal: roundAmount(subTotal),
        discountedPrice: roundAmount(discountedPrice),
        couponDiscountAmount: roundAmount(couponDiscountAmount),
        membershipDiscountAmount: roundAmount(membershipDiscountAmount),
        subscriptionPlanDiscountAmount: roundAmount(
          subscriptionPlanDiscountAmount
        ),
        taxAmount: roundAmount(taxAmount),
        grandTotal: roundAmount(grandTotal),
        currency: normalizedCurrency,
        shippingAddressId: new mongoose.Types.ObjectId(shippingAddressId),
        billingAddressId: billingAddressId
          ? new mongoose.Types.ObjectId(billingAddressId)
          : undefined,
        paymentMethod,
        couponCode: normalizedCouponCode,
        couponMetadata: couponMetadata || {},
        membershipMetadata: membershipMetadata,
        metadata: orderMetadata,
        notes,
      });

      // Send order placed notification
      try {
        const { orderNotifications } = await import("@/utils/notificationHelpers");
        await orderNotifications.orderPlaced(
          userId,
          String(order._id),
          order.orderNumber,
          userId
        );
      } catch (error: any) {
        logger.error(`Failed to send order placed notification: ${error.message}`);
        // Don't fail the order creation if notification fails
      }

      // Check if couponCode is a referral code and create referral record
      if (normalizedCouponCode) {
        try {
          const referrer = await User.findOne({
            referralCode: normalizedCouponCode,
            isDeleted: false,
            isActive: true,
          });

          if (referrer && referrer._id.toString() !== userId.toString()) {
            // It's a referral code, create referral record
            const { referralService } = await import(
              "@/services/referralService"
            );
            await referralService.createReferralRecord(
              referrer._id.toString(),
              userId.toString(),
              normalizedCouponCode,
              (order._id as mongoose.Types.ObjectId).toString(),
              roundAmount(discountedPrice)
            );
            logger.info(
              `Referral record created for order ${order.orderNumber} with referral code ${normalizedCouponCode}`
            );
          }
        } catch (error: any) {
          // Log error but don't fail order creation
          logger.error(
            `Failed to create referral record for order ${order.orderNumber}:`,
            error
          );
        }
      }

      const orderData = order.toObject();

      res.apiCreated(
        {
          order: orderData,
        },
        "Order created successfully"
      );
    }
  );

  /**
   * Get order history for authenticated user (Paginated)
   * @route GET /api/orders
   * @access Private
   */
  getOrderHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { status, paymentStatus, startDate, endDate } = req.query;

      // Build filter for user's orders
      const filter: any = {
        userId: new mongoose.Types.ObjectId(req.user._id),
        isDeleted: false,
      };

      // Filter by order status
      if (status) {
        filter.status = status;
      }

      // Filter by payment status
      if (paymentStatus) {
        filter.paymentStatus = paymentStatus;
      }

      // Filter by date range
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate as string);
        }
        if (endDate) {
          filter.createdAt.$lte = new Date(endDate as string);
        }
      }

      // Default sort by latest orders
      const sortOptions: any = { createdAt: -1 };
      if (sort && typeof sort === "object") {
        Object.assign(sortOptions, sort);
      }

      // Get total count
      const total = await Orders.countDocuments(filter);

      // Get orders with pagination
      const orders = await Orders.find(filter)
        .select(
          "orderNumber planType isOneTime variantType status items subTotal discountedPrice couponDiscountAmount membershipDiscountAmount subscriptionPlanDiscountAmount taxAmount grandTotal currency paymentMethod paymentStatus couponCode metadata couponMetadata membershipMetadata trackingNumber shippedAt deliveredAt createdAt"
        )
        .populate(
          "items.productId",
          "title slug description media categories tags status galleryImages productImage"
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      // Transform orders for response
      const transformedOrders = orders.map((order: any) => ({
        id: order._id,
        orderNumber: order.orderNumber,
        planType: order.planType,
        isOneTime: order.isOneTime,
        variantType: order.variantType,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items.map((item: any) => ({
          productId: item.productId,
          name: item.name,
          amount: item.amount,
          discountedPrice: item.discountedPrice,
          taxRate: item.taxRate,
          totalAmount: item.totalAmount,
          durationDays: item.durationDays,
          capsuleCount: item.capsuleCount,
          savingsPercentage: item.savingsPercentage,
          features: item.features,
        })),
        pricing: {
          subTotal: order.subTotal,
          discountedPrice: order.discountedPrice,
          couponDiscountAmount: order.couponDiscountAmount,
          membershipDiscountAmount: order.membershipDiscountAmount,
          subscriptionPlanDiscountAmount: order.subscriptionPlanDiscountAmount,
          taxAmount: order.taxAmount,
          grandTotal: order.grandTotal,
          currency: order.currency,
        },
        couponCode: order.couponCode,
        couponMetadata: order.couponMetadata,
        membershipMetadata: order.membershipMetadata,
        metadata: order.metadata,
        paymentMethod: order.paymentMethod,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        createdAt: order.createdAt,
      }));

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(transformedOrders, pagination, "Orders retrieved");
    }
  );

  /**
   * Get order details by ID
   * Includes product details, payment data, and shipping address
   * @route GET /api/orders/:orderId
   * @access Private
   */
  getOrderDetails = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { orderId } = req.params;

      // Validate orderId
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        throw new AppError("Invalid order ID", 400);
      }

      // Get order with populated addresses
      const order = await Orders.findOne({
        _id: new mongoose.Types.ObjectId(orderId),
        userId: new mongoose.Types.ObjectId(req.user._id),
        isDeleted: false,
      })
        .populate(
          "shippingAddressId",
          "firstName lastName streetName houseNumber houseNumberAddition postalCode address phone city country note"
        )
        .populate(
          "billingAddressId",
          "firstName lastName streetName houseNumber houseNumberAddition postalCode address phone city country note"
        )
        .populate(
          "items.productId",
          "title slug description media categories tags status galleryImages productImage"
        )
        .lean();

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      // Get payment details for this order
      let paymentData = null;
      const payment = await Payments.findOne({
        orderId: new mongoose.Types.ObjectId(orderId),
        userId: new mongoose.Types.ObjectId(req.user._id),
        isDeleted: false,
      })
        .select(
          "paymentMethod status amount currency transactionId gatewayTransactionId gatewayResponse failureReason refundAmount refundReason refundedAt processedAt createdAt"
        )
        .lean();

      if (payment) {
        paymentData = {
          id: payment._id,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId,
          gatewayTransactionId: payment.gatewayTransactionId,
          failureReason: payment.failureReason,
          refundAmount: payment.refundAmount,
          refundReason: payment.refundReason,
          refundedAt: payment.refundedAt,
          processedAt: payment.processedAt,
          createdAt: payment.createdAt,
        };
      }

      // Transform order items with product details
      const itemsWithProducts = order.items.map((item: any) => ({
        productId: item.productId,
        name: item.name,
        amount: item.amount,
        discountedPrice: item.discountedPrice,
        taxRate: item.taxRate,
        totalAmount: item.totalAmount,
        durationDays: item.durationDays,
        capsuleCount: item.capsuleCount,
        savingsPercentage: item.savingsPercentage,
        features: item.features,
      }));

      // Build response
      const orderDetails = {
        id: order._id,
        orderNumber: order.orderNumber,
        planType: order.planType,
        isOneTime: order.isOneTime,
        variantType: order.variantType,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: itemsWithProducts,
        pricing: {
          subTotal: order.subTotal,
          discountedPrice: order.discountedPrice,
          couponDiscountAmount: order.couponDiscountAmount,
          membershipDiscountAmount: order.membershipDiscountAmount,
          subscriptionPlanDiscountAmount: order.subscriptionPlanDiscountAmount,
          taxAmount: order.taxAmount,
          grandTotal: order.grandTotal,
          currency: order.currency,
        },
        shippingAddressId: order.shippingAddressId,
        billingAddressId: order.billingAddressId,
        paymentMethod: order.paymentMethod,
        payment: paymentData,
        couponCode: order.couponCode,
        couponMetadata: order.couponMetadata,
        membershipMetadata: order.membershipMetadata,
        notes: order.notes,
        metadata: order.metadata,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };

      res.apiSuccess(
        { order: orderDetails },
        "Order details retrieved successfully"
      );
    }
  );
}

export const orderController = new OrderController();
