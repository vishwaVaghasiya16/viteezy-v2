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
import {
  PriceType,
  I18nStringType,
  I18nTextType,
  DEFAULT_LANGUAGE,
  SupportedLanguage,
} from "@/models/common.model";
import {
  getSubscriptionPriceFromProduct,
  getBaseSubtotalForSubscription,
} from "@/utils/productSubscriptionPrice";
import { getTranslatedString } from "@/utils/translationUtils";
import {
  getStandUpPouchPlanKey,
  DEFAULT_STAND_UP_POUCH_PLAN,
} from "../config/planConfig";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    language?: string;
  };
}

const mapLanguageToCode = (language?: string): SupportedLanguage => {
  const languageMap: Record<string, SupportedLanguage> = {
    English: "en",
    Spanish: "es",
    French: "fr",
    Dutch: "nl",
    German: "de",
  };
  return language ? (languageMap[language] || DEFAULT_LANGUAGE) : DEFAULT_LANGUAGE;
};

const getUserLanguage = async (
  req: AuthenticatedRequest,
  userId: string
): Promise<SupportedLanguage> => {
  if (req.user?.language) return mapLanguageToCode(req.user.language);
  try {
    const user = await User.findById(userId).select("language").lean();
    if (user?.language) return mapLanguageToCode(user.language);
  } catch {
    // ignore
  }
  return DEFAULT_LANGUAGE;
};

const getI18nString = (
  val: I18nStringType | string | undefined,
  lang: SupportedLanguage
): string => {
  if (!val) return "";
  if (typeof val === "string") return val;
  return val[lang] || val.en || "";
};

const getI18nText = (
  val: I18nTextType | string | undefined,
  lang: SupportedLanguage
): string => {
  if (!val) return "";
  if (typeof val === "string") return val;
  return val[lang] || val.en || "";
};

const transformOrderProductForLanguage = (
  product: any,
  lang: SupportedLanguage
): any => {
  if (!product || typeof product !== "object") return product;
  return {
    ...product,
    title: getI18nString(product.title, lang),
    description: getI18nText(product.description, lang),
  };
};

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

  // Check usage limit (0 means infinite, so skip check if 0 or undefined)
  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
    throw new AppError("This coupon has reached its usage limit", 400);
  }

  // Check user usage limit (0 means infinite, so skip check if 0 or undefined)
  if (coupon.userUsageLimit !== null && coupon.userUsageLimit !== undefined && coupon.userUsageLimit > 0) {
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
        sachets,
        standUpPouch,
        // Legacy fields (for backward compatibility)
        variantType,
        planDurationDays,
        isOneTime,
        capsuleCount,
        shippingAddressId,
        billingAddressId,
        pricing,
        couponCode,
        membership,
        metadata,
        paymentMethod,
        notes,
      } = req.body;

      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Get user language for feature translation
      const userLang = await getUserLanguage(req, req.user._id.toString());

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

      // Separate cart items by variantType
      const sachetItems = cart.items.filter(
        (item: any) => item.variantType === ProductVariant.SACHETS
      );
      const standupPouchItems = cart.items.filter(
        (item: any) => item.variantType === ProductVariant.STAND_UP_POUCH
      );

      if (sachetItems.length === 0 && standupPouchItems.length === 0) {
        throw new AppError(
          "Cart must contain at least one item with a valid variantType",
          400
        );
      }

      // Extract plan selection from new structure (similar to checkout page summary)
      // Validate that required configs are provided based on cart items
      if (sachetItems.length > 0 && !sachets) {
        throw new AppError(
          "sachets configuration is required when cart contains SACHETS items",
          400
        );
      }
      if (standupPouchItems.length > 0 && !standUpPouch) {
        throw new AppError(
          "standUpPouch configuration is required when cart contains STAND_UP_POUCH items",
          400
        );
      }

      // Extract plan selection values (use new structure if provided, fallback to legacy fields)
      const selectedPlanDays = sachets?.planDurationDays || planDurationDays;
      // Note: isOneTime is NOT allowed for SACHETS (only subscription plans are supported)
      const selectedCapsuleCount = standUpPouch?.capsuleCount || capsuleCount || 30;
      const selectedStandUpPouchPlanDays = standUpPouch?.planDays || selectedCapsuleCount;

      // Create a map of productId -> capsuleCount/planDays from itemQuantities for per-product selection
      const productPlanDaysMap = new Map<string, number>();
      if (
        standUpPouch?.itemQuantities &&
        standUpPouch.itemQuantities.length > 0
      ) {
        for (const itemQty of standUpPouch.itemQuantities) {
          let planDays: number;
          if (itemQty.planDays !== undefined) {
            planDays = itemQty.planDays;
          } else if (itemQty.capsuleCount !== undefined) {
            planDays = itemQty.capsuleCount; // capsuleCount maps to planDays
          } else {
            planDays = selectedStandUpPouchPlanDays;
          }
          productPlanDaysMap.set(itemQty.productId, planDays);
        }
      }

      // Validate variant-specific rules
      // SACHETS: Only subscription plans (30, 60, 90, or 180 days) - one-time plans NOT supported
      // STAND_UP_POUCH: Always one-time (with quantity)
      if (sachetItems.length > 0) {
        // SACHETS subscription only (30, 60, 90, or 180 days)
        if (!selectedPlanDays || ![30, 60, 90, 180].includes(selectedPlanDays)) {
          throw new AppError(
            "For SACHETS, planDurationDays must be 30, 60, 90, or 180 (subscription plans only)",
            400
          );
        }
      }

      // Determine planType based on order contents
      let planType: OrderPlanType;
      if (sachetItems.length > 0 && standupPouchItems.length > 0) {
        planType = OrderPlanType.MIXED; // Both variants present
      } else if (sachetItems.length > 0) {
        planType = OrderPlanType.SUBSCRIPTION; // Only SACHETS (subscription only)
      } else {
        planType = OrderPlanType.ONE_TIME; // Only STAND_UP_POUCH (one-time)
      }

      // Determine isOneTime based on order contents
      // If order has only STAND_UP_POUCH items, it's one-time (isOneTime = true)
      // If order has SACHETS items, it's subscription (isOneTime = false) - one-time NOT supported for SACHETS
      // If order has both, isOneTime = false (because subscriptions are primary)
      const orderIsOneTime = standupPouchItems.length > 0 && sachetItems.length === 0;

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

      // Get product IDs from cart (remove duplicates to allow same product with different variant types)
      const uniqueProductIds = new Set(
        cart.items.map((item: any) => item.productId.toString())
      );
      const productObjectIds = Array.from(uniqueProductIds).map(
        (id: string) => new mongoose.Types.ObjectId(id)
      );

      // Use planDurationDays from new structure or legacy field (already validated above)
      const planDays = selectedPlanDays;

      // Fetch products with pricing information for both variantTypes
      const selectFields =
        "title slug skuRoot categories price variant sachetPrices standupPouchPrice hasStandupPouch";

      const products = await Products.find({
        _id: { $in: productObjectIds },
        isDeleted: false,
      })
        .select(selectFields)
        .lean();

      // Check if all unique products were found (allowing same product with different variant types)
      if (products.length !== productObjectIds.length) {
        throw new AppError("One or more products are unavailable", 400);
      }

      const productMap = new Map(
        products.map((product: any) => [product._id.toString(), product])
      );

      // Pricing is passed in body; store it in DB
      if (!pricing || !pricing.overall) {
        throw new AppError("pricing.overall is required", 400);
      }
      const normalizedCurrency =
        (pricing.overall.currency || "EUR").toString().toUpperCase();

      const categoryIds = new Set<string>();

      products.forEach((product: any) => {
        (product.categories || []).forEach(
          (categoryId: mongoose.Types.ObjectId) =>
            categoryIds.add(categoryId.toString())
        );
      });

      // Build order items with prices calculated from product pricing based on item-level variantType
      const orderItems = cart.items.map((cartItem: any) => {
        const product = productMap.get(cartItem.productId.toString());

        if (!product) {
          throw new AppError("Invalid product in cart", 400);
        }

        // Get variantType from cart item
        const itemVariantType = cartItem.variantType || variantType;
        const itemQuantity = cartItem.quantity || 1; // Get quantity from cart item

        let itemPlanDays: number | undefined;
        let itemCapsuleCount: number | undefined;
        let itemAmount: number = 0;
        let itemDiscountedPrice: number = 0;
        let itemTaxRate: number = 0;
        let itemTotalAmount: number = 0;
        let itemDurationDays: number | undefined;
        let itemSavingsPercentage: number | undefined;
        let itemFeatures: string[] = [];

        // Calculate price based on item-level variantType
        if (itemVariantType === ProductVariant.SACHETS) {
          if (!product.sachetPrices) {
            throw new AppError(
              `Product ${
                product.title?.en || product.slug || product._id
              } does not support SACHETS variant. Please select a different product or variant type.`,
              400
            );
          }

          // Use plan selection from request (subscription only for SACHETS)
          // Note: SACHETS don't store planDays in cart - plan is selected at checkout/order time
          if (planDays) {
            itemPlanDays = planDays;
            let selectedPlan: any = null;
            let planKey = "";

            // Note: One-time plans are NOT supported for SACHETS (only subscription plans)
            // Map planDays to sachetPrices subscription field
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
              ? selectedPlan.features.map((feature: any) =>
                  getTranslatedString(feature, userLang)
                )
              : [];
          }
        } else if (itemVariantType === ProductVariant.STAND_UP_POUCH) {
          // Validate that product supports stand-up pouch
          if (!product.hasStandupPouch || !product.standupPouchPrice) {
            throw new AppError(
              `Product ${
                product.title?.en || product.slug || product._id
              } does not support STAND_UP_POUCH variant`,
              400
            );
          }

          // Get planDays for this specific product from itemQuantities, cart item, or fallback
          // Note: For STAND_UP_POUCH, planDays in cart is treated as capsuleCount (60 or 120)
          const productIdStr = cartItem.productId.toString();
          const itemPlanDays = productPlanDaysMap.get(productIdStr) ||
            cartItem.planDays || // For STAND_UP_POUCH: planDays from cart is capsuleCount (60 or 120)
            selectedStandUpPouchPlanDays ||
            DEFAULT_STAND_UP_POUCH_PLAN;
          
          // For STAND_UP_POUCH: planDays from cart is treated as capsuleCount (60 or 120)
          itemCapsuleCount = itemPlanDays;
          const standupPrice = product.standupPouchPrice as any;

          // Get the correct count key from planDays (60 -> count60, 120 -> count120)
          const countKey = getStandUpPouchPlanKey(itemPlanDays);
          const countData = countKey ? standupPrice[countKey] : null;

          if (countData) {
            // Extract all pricing details for the selected count (count60 or count120)
            itemAmount = countData.amount || 0;
            itemDiscountedPrice =
              countData.discountedPrice || itemAmount;
            itemTaxRate = countData.taxRate || 0;
            itemTotalAmount =
              countData.totalAmount ||
              countData.discountedPrice ||
              itemAmount;
            itemCapsuleCount = countData.capsuleCount || itemPlanDays;
            itemSavingsPercentage =
              countData.savingsPercentage || undefined;
            itemFeatures = Array.isArray(countData.features)
              ? countData.features.map((feature: any) =>
                  getTranslatedString(feature, userLang)
                )
              : [];
          } else {
            // Fallback to simple price object if count structure doesn't exist
            if (standupPrice.amount) {
              itemAmount = standupPrice.amount || 0;
              itemDiscountedPrice =
                standupPrice.discountedPrice || itemAmount;
              itemTaxRate = standupPrice.taxRate || 0;
              itemTotalAmount =
                standupPrice.totalAmount ||
                standupPrice.discountedPrice ||
                itemAmount;
              itemCapsuleCount = itemPlanDays;
              itemFeatures = Array.isArray(standupPrice.features)
                ? standupPrice.features.map((feature: any) =>
                    getTranslatedString(feature, userLang)
                  )
                : [];
            } else {
              throw new AppError(
                `Product ${
                  product.title?.en || product.slug || product._id
                } does not have valid pricing for ${itemPlanDays}-count stand-up pouch. Available counts: 60, 120`,
                400
              );
            }
          }
        } else {
          throw new AppError(
            `Invalid variantType: ${variantType}. Must be SACHETS or STAND_UP_POUCH`,
            400
          );
        }

        // Multiply by quantity for total amounts
          return {
          productId: new mongoose.Types.ObjectId(cartItem.productId),
          name:
            product.title?.en || product.title?.nl || product.slug || "Product",
          variantType: itemVariantType, // Include variantType in order item
          quantity: itemQuantity, // Include quantity in order item
          planDays: itemVariantType === ProductVariant.STAND_UP_POUCH 
            ? (productPlanDaysMap.get(cartItem.productId.toString()) || cartItem.planDays || selectedStandUpPouchPlanDays || DEFAULT_STAND_UP_POUCH_PLAN) // For STAND_UP_POUCH: planDays from cart is capsuleCount (60 or 120)
            : itemPlanDays, // For SACHETS: planDays comes from request (not stored in cart)
          capsuleCount: itemCapsuleCount,
          // Additional pricing and plan details (per unit)
          amount: roundAmount(itemAmount),
          discountedPrice: roundAmount(itemDiscountedPrice),
          taxRate: roundAmount(itemTaxRate),
          totalAmount: roundAmount(itemTotalAmount * itemQuantity), // Total = unit price * quantity
          durationDays: itemDurationDays,
          savingsPercentage: itemSavingsPercentage,
          features: itemFeatures,
        };
      });

      // Validate pricing values from body (minimum sanity check)
      if (
        typeof pricing.overall.subTotal !== "number" ||
        pricing.overall.subTotal < 0
      ) {
        throw new AppError("Invalid pricing.overall.subTotal value", 400);
      }
      if (
        typeof pricing.overall.discountedPrice !== "number" ||
        pricing.overall.discountedPrice < 0
      ) {
        throw new AppError("Invalid pricing.overall.discountedPrice value", 400);
      }
      if (
        typeof pricing.overall.grandTotal !== "number" ||
        pricing.overall.grandTotal < 0
      ) {
        throw new AppError("Invalid pricing.overall.grandTotal value", 400);
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
            orderAmount: pricing.overall.discountedPrice,
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
        planType,
        isOneTime: orderIsOneTime,
      };

      // Add SACHETS plan details if present (subscription only)
      if (sachetItems.length > 0 && selectedPlanDays) {
        planDetails.sachets = {
          planDurationDays: selectedPlanDays,
          // Note: isOneTime is NOT allowed for SACHETS (only subscription plans)
          interval: selectedPlanDays.toString(),
          cycleDays: selectedPlanDays,
        };
      }

      // Add STAND_UP_POUCH plan details if present
      // Store per-product capsuleCount/planDays from itemQuantities
      if (standupPouchItems.length > 0) {
        const standUpPouchPlanDetails: any = {};
        
        // If itemQuantities provided, store per-product details
        if (
          standUpPouch?.itemQuantities &&
          standUpPouch.itemQuantities.length > 0
        ) {
          standUpPouchPlanDetails.itemQuantities = standUpPouch.itemQuantities.map((itemQty: any) => ({
            productId: itemQty.productId,
            quantity: itemQty.quantity,
            capsuleCount: itemQty.capsuleCount || itemQty.planDays || selectedCapsuleCount,
            planDays: itemQty.planDays || itemQty.capsuleCount || selectedStandUpPouchPlanDays,
          }));
        } else {
          // Fallback to single capsuleCount for backward compatibility
          standUpPouchPlanDetails.capsuleCount = selectedCapsuleCount;
          if (selectedStandUpPouchPlanDays) {
            standUpPouchPlanDetails.planDays = selectedStandUpPouchPlanDays;
          }
        }
        
        planDetails.standUpPouch = standUpPouchPlanDetails;
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

      // Pricing breakdown is provided by client; store it as-is (normalize currency casing)
      const pricingBreakdown: any = {
        ...pricing,
        overall: {
          ...pricing.overall,
          currency: normalizedCurrency,
        },
        ...(pricing.sachets
          ? {
              sachets: {
                ...pricing.sachets,
                currency: (pricing.sachets.currency || normalizedCurrency)
                  .toString()
                  .toUpperCase(),
              },
            }
          : {}),
        ...(pricing.standUpPouch
          ? {
              standUpPouch: {
                ...pricing.standUpPouch,
                currency: (pricing.standUpPouch.currency || normalizedCurrency)
                  .toString()
                  .toUpperCase(),
              },
            }
          : {}),
      };

      const order = await Orders.create({
        orderNumber: generateOrderNumber(),
        userId,
        planType: planType,
        items: orderItems,
        pricing: pricingBreakdown,
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
              roundAmount(pricing.overall.discountedPrice)
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
          "orderNumber planType isOneTime variantType status items pricing paymentMethod paymentStatus couponCode metadata couponMetadata membershipMetadata trackingNumber shippedAt deliveredAt createdAt"
        )
        .populate(
          "items.productId",
          "title slug description media categories tags status galleryImages productImage"
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      const userLang = await getUserLanguage(req, req.user!._id.toString());

      // Transform orders for response
      const transformedOrders = orders.map((order: any) => ({
        id: order._id,
        orderNumber: order.orderNumber,
        planType: order.planType,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items.map((item: any) => ({
          productId: item.productId
            ? transformOrderProductForLanguage(item.productId, userLang)
            : item.productId,
          name: item.name,
          amount: item.amount,
          discountedPrice: item.discountedPrice,
          taxRate: item.taxRate,
          totalAmount: item.totalAmount,
          durationDays: item.durationDays,
          capsuleCount: item.capsuleCount,
          savingsPercentage: item.savingsPercentage,
          features: Array.isArray(item.features)
            ? item.features.map((feature: any) =>
                getTranslatedString(feature, userLang)
              )
            : item.features,
        })),
        pricing: order.pricing,
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

      const userLang = await getUserLanguage(req, req.user!._id.toString());

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
        productId: item.productId
          ? transformOrderProductForLanguage(item.productId, userLang)
          : item.productId,
        name: item.name,
        amount: item.amount,
        discountedPrice: item.discountedPrice,
        taxRate: item.taxRate,
        totalAmount: item.totalAmount,
        durationDays: item.durationDays,
        capsuleCount: item.capsuleCount,
        savingsPercentage: item.savingsPercentage,
        features: Array.isArray(item.features)
          ? item.features.map((feature: any) =>
              getTranslatedString(feature, userLang)
            )
          : item.features,
      }));

      // Build response
      const orderDetails = {
        id: order._id,
        orderNumber: order.orderNumber,
        planType: order.planType,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: itemsWithProducts,
        pricing: order.pricing,
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
