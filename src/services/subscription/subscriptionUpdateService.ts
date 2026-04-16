import mongoose from "mongoose";
import { Subscriptions } from "@/models/commerce/subscriptions.model";
import { Carts } from "@/models/commerce/carts.model";
import { SubscriptionChanges } from "@/models/commerce/subscriptionChanges.model";
import { AppError } from "@/utils/AppError";
import { CouponType, ProductVariant, SubscriptionStatus, OrderPlanType, PaymentStatus, OrderStatus } from "@/models/enums";
import { Products } from "@/models/commerce/products.model";
import { Coupons, Orders } from "@/models/commerce";
import { Addresses } from "@/models/core";

function resolveI18nString(value: any, lang: string) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return (
    value?.[lang] ||
    value?.en ||
    value?.nl ||
    value?.de ||
    value?.fr ||
    value?.es ||
    ""
  );
}

function resolveTitle(value: any) {
  if (!value) return "";

  if (typeof value === "string") return value;

  return value.en || value.nl || value.de || value.fr || value.es || "";
}

function resolveSachetPlan(product: any, cycleDays: number) {
  if (!product.sachetPrices) throw new Error("Sachet pricing missing");
  switch (cycleDays) {
    case 30:
      return product.sachetPrices.thirtyDays;
    case 60:
      return product.sachetPrices.sixtyDays;
    case 90:
      return product.sachetPrices.ninetyDays;
    case 180:
      return product.sachetPrices.oneEightyDays;
    default:
      throw new Error(`Unsupported subscription cycleDays: ${cycleDays}`);
  }
}

export class SubscriptionUpdateService {
  /**
   * Build a simple summary for a subscription update cart.
   */
  async getSubscriptionUpdateSummary(
    userId: string,
    lang: string,
    shippingAddressId?: string,
    couponCode?: string,
  ) {
    const round = (num: number) => Number((num || 0).toFixed(2));

    const resolveTitle = (value: any, lang: string) => {
      if (!value) return "";
      if (typeof value === "string") return value;

      return (
        value?.[lang] ||
        value?.en ||
        value?.nl ||
        value?.de ||
        value?.fr ||
        value?.es ||
        ""
      );
    };

    const getPlan = (product: any, days: number) => {
      const plans = product?.sachetPrices;
      if (!plans) return null;

      switch (days) {
        case 30:
          return {
            key: "thirtyDays",
            label: "30 Day Plan",
            plan: plans.thirtyDays,
          };
        case 60:
          return {
            key: "sixtyDays",
            label: "60 Day Plan",
            plan: plans.sixtyDays,
          };
        case 90:
          return {
            key: "ninetyDays",
            label: "90 Day Plan",
            plan: plans.ninetyDays,
          };
        case 180:
          return {
            key: "oneEightyDays",
            label: "180 Day Plan",
            plan: plans.oneEightyDays,
          };
        default:
          return null;
      }
    };

    /**
     * STEP 1
     * Fetch subscription update cart only
     */

    const cart = await Carts.findOne({
      userId,
      cartType: "SUBSCRIPTION_UPDATE",
      isDeleted: false,
    }).lean();

    if (!cart) throw new AppError("Subscription update cart not found", 404);

    /**
     * STEP 2
     * Filter subscription-change sachets
     */

    const subscriptionItems = (cart.items || []).filter(
      (item: any) =>
        item &&
        item.isSubscriptionChange === true &&
        item.variantType === ProductVariant.SACHETS,
    );

    if (!subscriptionItems.length)
      throw new AppError("No subscription items found", 404);

    /**
     * STEP 3
     * Fetch products
     */

    const productIds = subscriptionItems.map((i: any) => i.productId);

    const products = await Products.find({
      _id: { $in: productIds },
      isDeleted: false,
    }).lean();

    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

    /**
     * STEP 4
     * Calculate pricing
     */

    let subTotal = 0;
    let discountedPrice = 0;
    let taxAmount = 0;
    let planDays = 30;

    const cartItems: any[] = [];

    for (const item of subscriptionItems) {
      const product = productMap.get(item.productId.toString());
      if (!product) continue;

      planDays = item.planDays || 30;

      const resolvedPlan = getPlan(product, planDays);
      if (!resolvedPlan) continue;

      const { plan, label } = resolvedPlan;

      const base = plan.amount ?? plan.totalAmount ?? 0;
      const discounted = plan.discountedPrice ?? base;
      const taxRate = plan.taxRate ?? 0;

      subTotal += base;
      discountedPrice += discounted;
      taxAmount += taxRate;

      cartItems.push({
        productId: product._id,
        title: resolveTitle(product.title, lang),
        image: product.productImage,
        variant: ProductVariant.SACHETS,
        quantity: 1,
        basePlanPrice: {
          currency: plan.currency,
          amount: round(base),
          discountedPrice: round(discounted),
          totalAmount: round(base),
          planType: label,
          taxRate,
        },
        membershipDiscount: 2,
        taxRate,
      });
    }

    subTotal = round(subTotal);
    discountedPrice = round(discountedPrice);
    taxAmount = round(taxAmount);

    /**
     * STEP 5
     * Plan calculations
     */

    const savePercentage = subTotal
      ? round(((subTotal - discountedPrice) / subTotal) * 100)
      : 0;

    const sachetsPlans = [
      {
        planKey: `${planDays}Days`,
        label: `${planDays} Day Plan`,
        durationDays: planDays,
        capsuleCount: subscriptionItems.length * planDays * 3,
        totalAmount: subTotal,
        discountedPrice,
        savePercentage,
        supplementsCount: subscriptionItems.length * planDays,
        perMonthAmount: discountedPrice,
        perDeliveryAmount: discountedPrice,
        features: ["Free shipping", "Cancel anytime"],
        isRecommended: false,
        isSelected: true,
        isSubscription: true,
      },
    ];

    /**
     * STEP 6
     * Pricing summary
     */

    const membershipDiscountAmount = round(cartItems.length * 2);

    const pricing = {
      sachets: {
        subTotal,
        discountedPrice,
        membershipDiscountAmount,
        subscriptionPlanDiscountAmount: 0,
        taxAmount,
        total: round(discountedPrice - membershipDiscountAmount),
        currency: "USD",
      },
      standUpPouch: null,
      overall: {
        subTotal,
        discountedPrice,
        couponDiscountAmount: 0,
        membershipDiscountAmount,
        subscriptionPlanDiscountAmount: 0,
        taxAmount,
        grandTotal: round(
          discountedPrice - membershipDiscountAmount + taxAmount,
        ),
        currency: "USD",
      },
    };

    let couponSummary: null | {
      code: string;
      isValid: boolean;
      isApplied: boolean;
      discountAmount: number;
      message?: string;
    } = null;

    if (couponCode) {
      const code = couponCode.toUpperCase();
      couponSummary = {
        code,
        isValid: false,
        isApplied: false,
        discountAmount: 0,
        message: undefined,
      };
      try {
        const coupon = await Coupons.findOne({
          code,
          isDeleted: false,
        }).lean();

        if (!coupon) {
          throw new Error("Invalid coupon code");
        }

        if (!coupon.isActive) {
          throw new Error("This coupon is not active");
        }

        const now = new Date();
        if (coupon.validFrom && now < coupon.validFrom) {
          throw new Error("This coupon is not yet valid");
        }
        if (coupon.validUntil && now > coupon.validUntil) {
          throw new Error("This coupon has expired");
        }

        if (
          coupon.usageLimit !== null &&
          coupon.usageLimit !== undefined &&
          coupon.usageLimit > 0 &&
          coupon.usageCount >= coupon.usageLimit
        ) {
          throw new Error("This coupon has reached its usage limit");
        }

        if (
          coupon.userUsageLimit !== null &&
          coupon.userUsageLimit !== undefined &&
          coupon.userUsageLimit > 0
        ) {
          const userUsageCount = await Orders.countDocuments({
            userId: new mongoose.Types.ObjectId(userId),
            couponCode: coupon.code,
            paymentStatus: PaymentStatus.COMPLETED,
            isDeleted: false,
          });
          if (userUsageCount >= coupon.userUsageLimit) {
            throw new Error(
              "You have reached the maximum usage limit for this coupon",
            );
          }
        }

        const orderAmount = round(discountedPrice - membershipDiscountAmount);

        if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount - 0.001) {
          throw new Error(
            `Minimum order amount of ${coupon.minOrderAmount} is required for this coupon`,
          );
        }

        const categoryIds = new Set<string>();
        for (const p of products) {
          if (p.categories && Array.isArray(p.categories)) {
            for (const c of p.categories) {
              categoryIds.add(c.toString());
            }
          }
        }

        if (
          coupon.applicableProducts &&
          coupon.applicableProducts.length > 0
        ) {
          const applicableIds = coupon.applicableProducts.map((id: any) =>
            id.toString(),
          );
          const hasApplicable = productIds
            .map((id: any) => id.toString())
            .some((id: string) => applicableIds.includes(id));
          if (!hasApplicable) {
            throw new Error(
              "This coupon is not applicable to the selected products",
            );
          }
        }

        if (
          coupon.applicableCategories &&
          coupon.applicableCategories.length > 0
        ) {
          const applicableCats = coupon.applicableCategories.map((id: any) =>
            id.toString(),
          );
          const hasApplicableCategory = Array.from(categoryIds).some((id) =>
            applicableCats.includes(id),
          );
          if (!hasApplicableCategory) {
            throw new Error(
              "This coupon is not applicable to the selected categories",
            );
          }
        }

        if (
          coupon.excludedProducts &&
          coupon.excludedProducts.length > 0
        ) {
          const excludedIds = coupon.excludedProducts.map((id: any) =>
            id.toString(),
          );
          const hasExcluded = productIds
            .map((id: any) => id.toString())
            .some((id: string) => excludedIds.includes(id));
          if (hasExcluded) {
            throw new Error(
              "This coupon cannot be applied to one or more selected products",
            );
          }
        }

        if (
          Array.isArray((coupon as any).recurringMonths) &&
          (coupon as any).recurringMonths.length > 0
        ) {
          const map: Record<number, number> = { 1: 30, 2: 60, 3: 90, 6: 180 };
          const allowed = new Set<number>();
          for (const m of (coupon as any).recurringMonths) {
            const d = map[m];
            if (d) allowed.add(d);
          }
          if (!allowed.has(planDays)) {
            throw new Error(
              "This coupon is not applicable to the selected subscription plan",
            );
          }
        }

        let discountAmount = 0;
        if (coupon.type === CouponType.PERCENTAGE) {
          discountAmount = (orderAmount * (coupon.value || 0)) / 100;
          if (coupon.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
          }
        } else if (coupon.type === CouponType.FIXED) {
          discountAmount = Math.min(coupon.value || 0, orderAmount);
        }

        const finalDiscount = round(discountAmount);
        pricing.overall.couponDiscountAmount = finalDiscount;
        pricing.overall.grandTotal = round(
          discountedPrice - membershipDiscountAmount - finalDiscount + taxAmount,
        );

        couponSummary = {
          code,
          isValid: true,
          isApplied: finalDiscount > 0,
          discountAmount: finalDiscount,
        };
      } catch (e: any) {
        couponSummary = {
          code,
          isValid: false,
          isApplied: false,
          discountAmount: 0,
          message: e?.message || "Invalid coupon code",
        };
      }
    }

    /**
     * STEP 7
     * Shipping validation
     */

    let validShippingAddressId = null;

    if (shippingAddressId) {
      const address = await Addresses.findOne({
        _id: shippingAddressId,
        userId,
        isDeleted: false,
      }).select("_id");

      if (address) validShippingAddressId = address._id;
    }

    /**
     * RESPONSE
     */

    return {
      cart: {
        items: cartItems,
        cartId: cart._id,
      },
      sachetsPlans,
      standUpPouchPlans: null,
      sachetsWarning: null,
      pricing,
      shippingAddressId: validShippingAddressId,
      billingAddressId: null,
      coupon: couponSummary,
    };
  }

  /**
   * Confirm subscription update: snapshot cart and create SubscriptionChanges record.
   */
  async confirmUpdate(userId: string, subscriptionId: string, cartId: string) {
    const resolveTitle = (value: any) => {
      if (!value) return "";
      if (typeof value === "string") return value;

      return (
        value?.en || value?.nl || value?.de || value?.fr || value?.es || ""
      );
    };

    /**
     * STEP 1
     * Validate subscription
     */

    const subscription = await Subscriptions.findOne({
      _id: new mongoose.Types.ObjectId(subscriptionId),
      userId: new mongoose.Types.ObjectId(userId),
      status: SubscriptionStatus.ACTIVE,
      isDeleted: false,
    });

    if (!subscription) throw new AppError("Active subscription not found", 404);

    /**
     * STEP 2
     * Fetch SUBSCRIPTION_UPDATE cart
     */

    const cart = await Carts.findOne({
      _id: new mongoose.Types.ObjectId(cartId),
      userId: new mongoose.Types.ObjectId(userId),
      cartType: "SUBSCRIPTION_UPDATE",
      linkedSubscriptionId: subscription._id,
      isDeleted: false,
    });

    if (!cart || !cart.items?.length)
      throw new AppError("Subscription update cart is empty", 400);

    /**
     * STEP 3
     * Only snapshot subscription-change items
     */

    const subscriptionItems = cart.items.filter(
      (item: any) =>
        item.isSubscriptionChange === true &&
        item.variantType === ProductVariant.SACHETS,
    );

    if (!subscriptionItems.length)
      throw new AppError("No subscription items found", 400);

    const productIds = subscriptionItems.map((i: any) => i.productId);

    const products = await Products.find({
      _id: { $in: productIds },
      isDeleted: false,
    }).lean();

    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

    const newPlanSnapshot = subscriptionItems.map((item: any) => {
      const product = productMap.get(item.productId.toString());

      return {
        productId: item.productId,
        name: resolveTitle(product?.title || product?.name),
        price: Number(item.price?.amount || 0),
        quantity: Number(item.quantity || 1),
      };
    });

    /**
     * STEP 4
     * Create subscription change record
     */

    const change = await SubscriptionChanges.create({
      subscriptionId: subscription._id,
      userId: subscription.userId,
      type: "UPDATE_PLAN",
      newPlanSnapshot,
      effectiveDate: subscription.nextBillingDate,
      status: "PENDING",
    });

    /**
     * STEP 5
     * Delete temporary subscription update cart
     */

    await Carts.deleteOne({
      _id: cart._id,
    });

    // Create placeholder renewal order for the upcoming effectiveDate
    try {
      const originalOrder = await Orders.findById(subscription.orderId).lean();
      const orderNumber = `UPD-${subscription.subscriptionNumber}-${(subscription.renewalCount || 0) + 1}`;

      // Build items and totals from snapshot
      const items = newPlanSnapshot.map((snap: any) => ({
        productId: snap.productId,
        name: snap.name,
        variantType: ProductVariant.SACHETS,
        quantity: snap.quantity || 1,
        planDays: subscription.cycleDays || 30,
        amount: Number(snap.price || 0),
        discountedPrice: Number(snap.price || 0),
        taxRate: 0,
        totalAmount: Number(snap.price || 0) * (snap.quantity || 1),
      }));

      const subTotal = items.reduce((s: number, i: any) => s + i.amount * (i.quantity || 1), 0);
      const discountedPrice = items.reduce((s: number, i: any) => s + i.discountedPrice * (i.quantity || 1), 0);
      const taxAmount = 0;
      const grandTotal = discountedPrice + taxAmount;
      const currency = "USD";

      const renewalOrder = await Orders.create({
        orderNumber,
        userId: subscription.userId,
        planType: OrderPlanType.SUBSCRIPTION,
        orderType: "SUBSCRIPTION_RENEWAL",
        subscriptionId: subscription._id,
        items,
        pricing: {
          sachets: {
            subTotal,
            discountedPrice,
            membershipDiscountAmount: 0,
            subscriptionPlanDiscountAmount: 0,
            taxAmount,
            total: grandTotal,
            currency,
          },
          overall: {
            subTotal,
            discountedPrice,
            couponDiscountAmount: 0,
            membershipDiscountAmount: 0,
            subscriptionPlanDiscountAmount: 0,
            taxAmount,
            grandTotal,
            currency,
          },
        },
        shippingAddressId: originalOrder?.shippingAddressId || new mongoose.Types.ObjectId(),
        billingAddressId: originalOrder?.billingAddressId || new mongoose.Types.ObjectId(),
        paymentMethod: originalOrder?.paymentMethod || "Stripe",
        paymentStatus: PaymentStatus.PENDING,
        status: OrderStatus.PENDING,
        metadata: {
          isRenewalOrder: true,
          isSubscriptionChange: true,
          subscriptionChangeId: (change as any)._id.toString(),
          effectiveDate: subscription.nextBillingDate,
          originalOrderId: (subscription.orderId as mongoose.Types.ObjectId).toString(),
        },
      });

      return {
        subscriptionChangeId: (change as any)._id,
        status: change.status,
        effectiveDate: change.effectiveDate,
        renewalOrderId: renewalOrder._id,
        orderNumber: renewalOrder.orderNumber,
      };
    } catch (e) {
      // If order creation fails, still return change info
      return {
        subscriptionChangeId: (change as any)._id,
        status: change.status,
        effectiveDate: change.effectiveDate,
      };
    }
  }

  async updateSubscriptionProducts(
    userId: string,
    subscriptionId: string,
    productIds: string[],
  ) {
    const subscription = await Subscriptions.findOne({
      _id: subscriptionId,
      userId,
      status: SubscriptionStatus.ACTIVE,
      isDeleted: false,
    });

    if (!subscription) throw new AppError("Subscription not found", 404);

    /**
     * STEP 1
     * Find existing subscription update cart
     */

    let cart = await Carts.findOne({
      userId,
      linkedSubscriptionId: subscription._id,
      cartType: "SUBSCRIPTION_UPDATE",
      isDeleted: false,
    });

    /**
     * STEP 2
     * Create cart if not exists
     */

    if (!cart) {
      cart = await Carts.create({
        userId,
        items: [],
        cartType: "SUBSCRIPTION_UPDATE",
        linkedSubscriptionId: subscription._id,
        subtotal: 0,
        tax: 0,
        total: 0,
        currency: "USD",
      });
    }

    /**
     * STEP 3
     * Clear existing subscription items
     */

    cart.items = [];

    /**
     * STEP 4
     * Fetch products
     */

    const products = await Products.find({
      _id: { $in: productIds },
      variant: ProductVariant.SACHETS,
      status: true,
      isDeleted: false,
    }).lean();

    if (!products.length) throw new AppError("Sachet products not found", 404);

    /**
     * STEP 5
     * Resolve pricing using subscription cycleDays
     */

    const cycleDays = subscription.cycleDays || 30;

    for (const product of products) {
      const plan = resolveSachetPlan(product, cycleDays);

      if (!plan)
        throw new AppError(
          "Sachet pricing missing for subscription cycle",
          400,
        );

      const baseAmount = plan.amount ?? plan.totalAmount ?? 0;

      const price = {
        currency: plan.currency,
        amount: baseAmount,
        taxRate: plan.taxRate ?? 0,
      };

      cart.items.push({
        productId: product._id as mongoose.Types.ObjectId,
        variantType: ProductVariant.SACHETS,
        quantity: 1,
        isOneTime: false,
        planDays: cycleDays,
        price,
        totalAmount: baseAmount,
        isSubscriptionChange: true,
        addedAt: new Date(),
      });
    }

    /**
     * STEP 6
     * Recalculate totals
     */

    let subtotal = 0;
    let tax = 0;

    for (const item of cart.items) {
      const qty = item.quantity || 1;
      const price = item.price?.amount || 0;
      const taxRate = item.price?.taxRate || 0;

      subtotal += price * qty;
      tax += taxRate * qty;
    }

    cart.subtotal = Number(subtotal.toFixed(2));
    cart.tax = Number(tax.toFixed(2));
    cart.total = Number((subtotal + tax).toFixed(2));

    await cart.save();

    return {
      cartId: cart._id,
      cartType: cart.cartType,
      items: cart.items,
      subtotal: cart.subtotal,
      tax: cart.tax,
      total: cart.total,
    };
  }

  async removeSubscriptionProduct(
    userId: string,
    subscriptionId: string,
    productId: string
  ) {
    const subscription = await Subscriptions.findOne({
      _id: subscriptionId,
      userId,
      status: SubscriptionStatus.ACTIVE,
      isDeleted: false,
    });

    if (!subscription) throw new AppError("Subscription not found", 404);

    let cart = await Carts.findOne({
      userId,
      linkedSubscriptionId: subscription._id,
      cartType: "SUBSCRIPTION_UPDATE",
      isDeleted: false,
    });

    if (!cart) {
      throw new AppError("Subscription update cart not found", 404);
    }

    const beforeCount = cart.items.length;
    cart.items = (cart.items || []).filter((item: any) => {
      const id = item.productId?.toString?.() || String(item.productId);
      const isSubChange = item.isSubscriptionChange === true;
      return !(isSubChange && id === productId);
    });

    if (cart.items.length === beforeCount) {
      throw new AppError("Product not found in subscription update cart", 404);
    }

    let subtotal = 0;
    let tax = 0;
    for (const item of cart.items) {
      const qty = item.quantity || 1;
      const price = item.price?.amount || 0;
      const taxRate = item.price?.taxRate || 0;
      subtotal += price * qty;
      tax += taxRate * qty;
    }
    cart.subtotal = Number(subtotal.toFixed(2));
    cart.tax = Number(tax.toFixed(2));
    cart.total = Number((subtotal + tax).toFixed(2));

    await cart.save();

    return {
      cartId: cart._id,
      cartType: cart.cartType,
      items: cart.items,
      subtotal: cart.subtotal,
      tax: cart.tax,
      total: cart.total,
    };
  }
}

export const subscriptionUpdateService = new SubscriptionUpdateService();
