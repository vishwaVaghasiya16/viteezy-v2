import { Products } from "../models/commerce/products.model";
import { Carts } from "../models/commerce/carts.model";
import { Subscriptions } from "../models/commerce/subscriptions.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import mongoose from "mongoose";
import { ProductVariant, SubscriptionStatus } from "../models/enums";
import { Coupons } from "../models/commerce/coupons.model";
import { CouponType } from "../models/enums";
import { Orders } from "../models/commerce/orders.model";
import {
  calculateMemberPrice,
  ProductPriceSource,
} from "../utils/membershipPrice";
import {
  I18nStringType,
  SupportedLanguage,
  DEFAULT_LANGUAGE,
} from "../models/common.model";
import {
  getTranslatedString,
  getUserLanguageCode,
} from "../utils/translationUtils";
import { transformProductForLanguage } from "../services/productEnrichmentService";
import { User } from "../models/core";
import {
  SACHETS_PLANS_CONFIG,
  STAND_UP_POUCH_PLANS_CONFIG,
  SACHETS_PLAN_KEYS,
  STAND_UP_POUCH_PLAN_KEYS,
  SACHETS_SUBSCRIPTION_PLANS,
  STAND_UP_POUCH_PLANS,
  getSachetsPlanKey,
  getStandUpPouchPlanKey,
  getSachetsPlanLabel,
  getStandUpPouchPlanLabel,
  getNormalizedStandupPouchPrice,
  DEFAULT_STAND_UP_POUCH_PLAN,
  SachetsSubscriptionPlanDays,
  StandUpPouchPlanDays,
} from "../config/planConfig";

interface PurchasePlan {
  planType: "oneTime" | "subscription";
  planKey: string; // "oneTime", "thirtyDays", "sixtyDays", "ninetyDays", "oneEightyDays"
  durationDays?: number;
  capsuleCount?: number;
  price: {
    currency: string;
    amount: number;
    discountedPrice?: number;
    taxRate: number;
    totalAmount: number;
  };
  savingsPercentage?: number;
  features?: string[];
  icon?: string;
  label: string; // Display label like "30 Days", "One-Time (30 count)", etc.
}

interface ProductPurchasePlans {
  productId: string;
  productName: string;
  variant: ProductVariant;
  plans: PurchasePlan[];
}

interface MergedSachetPrices {
  thirtyDays?: {
    currency: string;
    amount: number;
    totalAmount: number;
    discountedPrice?: number;
    taxRate: number;
    durationDays: number;
    capsuleCount: number;
    savingsPercentage?: number;
    features?: string[];
    icon?: string;
  };
  sixtyDays?: {
    currency: string;
    amount: number;
    totalAmount: number;
    discountedPrice?: number;
    taxRate: number;
    durationDays: number;
    capsuleCount: number;
    savingsPercentage?: number;
    features?: string[];
    icon?: string;
  };
  ninetyDays?: {
    currency: string;
    amount: number;
    totalAmount: number;
    discountedPrice?: number;
    taxRate: number;
    durationDays: number;
    capsuleCount: number;
    savingsPercentage?: number;
    features?: string[];
    icon?: string;
  };
  oneEightyDays?: {
    currency: string;
    amount: number;
    totalAmount: number;
    discountedPrice?: number;
    taxRate: number;
    durationDays: number;
    capsuleCount: number;
    savingsPercentage?: number;
    features?: string[];
    icon?: string;
  };
}

interface PurchasePlansResponse {
  products: ProductPurchasePlans[];
  merged: {
    sachetPrices: MergedSachetPrices;
    totalCapsules: {
      // Note: oneTime30 and oneTime60 removed - SACHETS no longer support one-time plans
      thirtyDays: number;
      sixtyDays: number;
      ninetyDays: number;
      oneEightyDays: number;
    };
  };
  totals: {
    subtotal: { currency: string; amount: number; taxRate: number };
    tax: { currency: string; amount: number; taxRate: number };
    discount: { currency: string; amount: number; taxRate: number };
    total: { currency: string; amount: number; taxRate: number };
  };
}

export interface PlanSelectionRequest {
  planDurationDays: 30 | 60 | 90 | 180;
  isSubscription: boolean;
  supplementsCount?: 30 | 60;
  variantType: ProductVariant;
}

export interface PlanSelectionProductPrice {
  productId: string;
  productName: string;
  planType: "oneTime" | "subscription";
  durationDays?: number;
  capsuleCount?: number;
  quantity: number;
  unitPrice: {
    currency: string;
    amount: number;
    taxRate: number;
  };
  memberUnitPrice?: {
    currency: string;
    amount: number;
    taxRate: number;
  };
  membershipDiscountAmount?: number;
  membershipDiscountPercentage?: number;
  ninetyDayPlanDiscountAmount?: number;
  lineSubtotal: number;
  lineTotal: number;
}

export interface PlanSelectionResponse {
  products: PlanSelectionProductPrice[];
  payment: {
    subtotal: number;
    discountPrice: number;
    ninetyDayPlanDiscount: number;
    tax: number;
    shippingFees: number;
    membershipDiscount: number;
    totalAmount: number;
    currency: string;
  };
}

class CheckoutService {
  private readonly NINETY_DAY_DISCOUNT_PERCENTAGE = 15; // 15% discount for 90-day plans

  /**
   * Convert I18n features array to string array
   * Extracts English value from I18n objects or returns string as-is
   */
  private convertFeaturesToStringArray(
    features?: (I18nStringType | string)[],
  ): string[] | undefined {
    if (!features || !Array.isArray(features) || features.length === 0) {
      return undefined;
    }

    return features.map((feature) => {
      if (typeof feature === "string") {
        return feature;
      }
      // Extract English value from I18n object
      return getTranslatedString(feature, "en");
    });
  }

  /**
   * Get purchase plans for products in cart
   * For sachets: all purchase plans (one-time + subscriptions)
   * For stand-up pouches: only one-time purchase plans
   */
  async getPurchasePlans(
    userId: string,
    selectedPlans?: Record<string, { planKey: string; capsuleCount?: number }>,
  ): Promise<PurchasePlansResponse> {
    // Get user's cart
    const cart = await Carts.findOne({
      cartType: "NORMAL",
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    }).lean();

    if (!cart || !cart.items || cart.items.length === 0 || cart.cartType !== "NORMAL") {
      throw new AppError("Cart is empty", 400);
    }

    // Fetch all products in cart
    const productIds = cart.items.map((item: any) => item.productId);
    const products = await Products.find({
      _id: { $in: productIds },
      isDeleted: false,
      status: true, // true = Active, false = Inactive
    }).lean();

    if (products.length === 0) {
      throw new AppError("No valid products found in cart", 404);
    }

    // Build purchase plans for each product
    const productPurchasePlans: ProductPurchasePlans[] = [];
    let totalSubtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    const currency = products[0]?.price?.currency || "USD";
    const taxRate = products[0]?.price?.taxRate || 0;

    for (const product of products) {
      const cartItem = cart.items.find(
        (item: any) => item.productId.toString() === product._id.toString(),
      );

      if (!cartItem) continue;

      const plans: PurchasePlan[] = [];
      const selectedPlan = selectedPlans?.[product._id.toString()];

      // Determine product variant
      const variant = product.variant as ProductVariant;

      if (variant === ProductVariant.SACHETS) {
        // For sachets: show all purchase plans
        // Note: One-time plans are NOT supported for SACHETS (only subscription plans)
        if (product.sachetPrices) {
          // Removed one-time purchase plans - SACHETS only supports subscription plans

          // Subscription plans
          if (product.sachetPrices.thirtyDays) {
            plans.push({
              planType: "subscription",
              planKey: "thirtyDays",
              durationDays: product.sachetPrices.thirtyDays.durationDays || 30,
              capsuleCount: product.sachetPrices.thirtyDays.capsuleCount,
              price: {
                currency: product.sachetPrices.thirtyDays.currency || currency,
                amount: product.sachetPrices.thirtyDays.amount || 0,
                discountedPrice:
                  product.sachetPrices.thirtyDays.discountedPrice,
                taxRate: product.sachetPrices.thirtyDays.taxRate || taxRate,
                totalAmount:
                  product.sachetPrices.thirtyDays.totalAmount ||
                  product.sachetPrices.thirtyDays.amount ||
                  0,
              },
              savingsPercentage:
                product.sachetPrices.thirtyDays.savingsPercentage,
              features: this.convertFeaturesToStringArray(
                product.sachetPrices.thirtyDays.features as any,
              ),
              icon: product.sachetPrices.thirtyDays.icon,
              label: "30 Days",
            });
          }

          if (product.sachetPrices.sixtyDays) {
            plans.push({
              planType: "subscription",
              planKey: "sixtyDays",
              durationDays: product.sachetPrices.sixtyDays.durationDays || 60,
              capsuleCount: product.sachetPrices.sixtyDays.capsuleCount,
              price: {
                currency: product.sachetPrices.sixtyDays.currency || currency,
                amount: product.sachetPrices.sixtyDays.amount || 0,
                discountedPrice: product.sachetPrices.sixtyDays.discountedPrice,
                taxRate: product.sachetPrices.sixtyDays.taxRate || taxRate,
                totalAmount:
                  product.sachetPrices.sixtyDays.totalAmount ||
                  product.sachetPrices.sixtyDays.amount ||
                  0,
              },
              savingsPercentage:
                product.sachetPrices.sixtyDays.savingsPercentage,
              features: this.convertFeaturesToStringArray(
                product.sachetPrices.sixtyDays.features as any,
              ),
              icon: product.sachetPrices.sixtyDays.icon,
              label: "60 Days",
            });
          }

          if (product.sachetPrices.ninetyDays) {
            const ninetyDaysPrice = product.sachetPrices.ninetyDays;
            const baseAmount =
              ninetyDaysPrice.totalAmount || ninetyDaysPrice.amount || 0;

            // Apply 15% discount for 90-day plan
            const discountAmount =
              baseAmount * (this.NINETY_DAY_DISCOUNT_PERCENTAGE / 100);
            const discountedPrice = baseAmount - discountAmount;

            plans.push({
              planType: "subscription",
              planKey: "ninetyDays",
              durationDays: ninetyDaysPrice.durationDays || 90,
              capsuleCount: ninetyDaysPrice.capsuleCount,
              price: {
                currency: ninetyDaysPrice.currency || currency,
                amount: baseAmount,
                discountedPrice: discountedPrice,
                taxRate: ninetyDaysPrice.taxRate || taxRate,
                totalAmount: discountedPrice,
              },
              savingsPercentage: this.NINETY_DAY_DISCOUNT_PERCENTAGE,
              features: this.convertFeaturesToStringArray(
                ninetyDaysPrice.features as any,
              ),
              icon: ninetyDaysPrice.icon,
              label: "90 Days",
            });
          }

          if (product.sachetPrices.oneEightyDays) {
            plans.push({
              planType: "subscription",
              planKey: "oneEightyDays",
              durationDays:
                product.sachetPrices.oneEightyDays.durationDays || 180,
              capsuleCount: product.sachetPrices.oneEightyDays.capsuleCount,
              price: {
                currency:
                  product.sachetPrices.oneEightyDays.currency || currency,
                amount: product.sachetPrices.oneEightyDays.amount || 0,
                discountedPrice:
                  product.sachetPrices.oneEightyDays.discountedPrice,
                taxRate: product.sachetPrices.oneEightyDays.taxRate || taxRate,
                totalAmount:
                  product.sachetPrices.oneEightyDays.totalAmount ||
                  product.sachetPrices.oneEightyDays.amount ||
                  0,
              },
              savingsPercentage:
                product.sachetPrices.oneEightyDays.savingsPercentage,
              features: this.convertFeaturesToStringArray(
                product.sachetPrices.oneEightyDays.features as any,
              ),
              icon: product.sachetPrices.oneEightyDays.icon,
              label: "180 Days",
            });
          }
        }
      } else if (variant === ProductVariant.STAND_UP_POUCH) {
        // For stand-up pouches: only one-time purchase plans
        if (product.standupPouchPrice) {
          const standupPrice = getNormalizedStandupPouchPrice(product.standupPouchPrice);

          // count_0 / count_1 structure (count_0 e.g. 30 count, count_1 e.g. 60 count)
          if (standupPrice.count_0 || standupPrice.count_1) {
            const plan0Price = standupPrice.count_0;
            if (plan0Price) {
              const capsuleCount = plan0Price.capsuleCount ?? 30;
              plans.push({
                planType: "oneTime",
                planKey: "count_0",
                capsuleCount,
                price: {
                  currency: plan0Price.currency || currency,
                  amount: plan0Price.amount || 0,
                  discountedPrice: plan0Price.discountedPrice,
                  taxRate: plan0Price.taxRate || taxRate,
                  totalAmount:
                    plan0Price.discountedPrice || plan0Price.amount || 0,
                },
                label: getStandUpPouchPlanLabel(capsuleCount),
              });
            }
            const plan1Price = standupPrice.count_1;
            if (plan1Price) {
              const capsuleCount = plan1Price.capsuleCount ?? 60;
              plans.push({
                planType: "oneTime",
                planKey: "count_1",
                capsuleCount,
                price: {
                  currency: plan1Price.currency || currency,
                  amount: plan1Price.amount || 0,
                  discountedPrice: plan1Price.discountedPrice,
                  taxRate: plan1Price.taxRate || taxRate,
                  totalAmount:
                    plan1Price.discountedPrice || plan1Price.amount || 0,
                },
                label: getStandUpPouchPlanLabel(capsuleCount),
              });
            }
          } else {
            // Simple price object
            plans.push({
              planType: "oneTime",
              planKey: "oneTime",
              price: {
                currency: standupPrice.currency || currency,
                amount: standupPrice.amount || 0,
                discountedPrice: standupPrice.discountedPrice,
                taxRate: standupPrice.taxRate || taxRate,
                totalAmount:
                  standupPrice.discountedPrice || standupPrice.amount || 0,
              },
              label: "One-Time",
            });
          }
        }
      }

      if (plans.length > 0) {
        // Get product name
        const productName =
          typeof product.title === "string"
            ? product.title
            : product.title?.en || product.title?.nl || "Product";

        productPurchasePlans.push({
          productId: product._id.toString(),
          productName,
          variant,
          plans,
        });

        // Calculate totals based on selected plan or first plan as default
        const planToUse = selectedPlan
          ? plans.find(
              (p) =>
                p.planKey === selectedPlan.planKey &&
                (!selectedPlan.capsuleCount ||
                  p.capsuleCount === selectedPlan.capsuleCount),
            ) || plans[0]
          : plans[0];

        if (planToUse) {
          const itemQuantity = 1; // Quantity removed from cart, each item is 1
          const itemPrice = planToUse.price.totalAmount || 0;
          const itemSubtotal = itemPrice * itemQuantity;
          const itemTax = itemSubtotal * (planToUse.price.taxRate || 0);

          // Calculate discount (for 90-day plans)
          let itemDiscount = 0;
          if (
            planToUse.planKey === "ninetyDays" &&
            planToUse.price.discountedPrice !== undefined
          ) {
            const originalAmount = planToUse.price.amount || 0;
            const discountedAmount = planToUse.price.discountedPrice || 0;
            itemDiscount = (originalAmount - discountedAmount) * itemQuantity;
          }

          totalSubtotal += itemSubtotal;
          totalTax += itemTax;
          totalDiscount += itemDiscount;
        }
      }
    }

    // Calculate final total
    // Note: totalSubtotal already contains discounted prices for 90-day plans
    // totalDiscount is tracked separately for display purposes only
    // So we don't subtract it again here
    const totalAmount = totalSubtotal + totalTax;

    // Merge sachetPrices from all products
    const mergedSachetPrices: MergedSachetPrices = {};
    const totalCapsules = {
      // Note: oneTime30 and oneTime60 removed - SACHETS no longer support one-time plans
      thirtyDays: 0,
      sixtyDays: 0,
      ninetyDays: 0,
      oneEightyDays: 0,
    };

    // Process each product to merge sachetPrices
    for (const product of products) {
      const cartItem = cart.items.find(
        (item: any) => item.productId.toString() === product._id.toString(),
      );
      if (!cartItem) continue;

      const quantity = 1; // Quantity removed from cart, each item is 1
      const variant = product.variant as ProductVariant;

      if (variant === ProductVariant.SACHETS && product.sachetPrices) {
        const sachetPrices = product.sachetPrices as any;

        // Note: One-time plans are NOT supported for SACHETS (only subscription plans)
        // Removed oneTime price merging logic

        // Merge subscription plans
        const subscriptionPlans = [
          { key: "thirtyDays", totalKey: "thirtyDays" },
          { key: "sixtyDays", totalKey: "sixtyDays" },
          { key: "ninetyDays", totalKey: "ninetyDays" },
          { key: "oneEightyDays", totalKey: "oneEightyDays" },
        ];

        for (const plan of subscriptionPlans) {
          if (sachetPrices[plan.key]) {
            const planData = sachetPrices[plan.key];
            if (!mergedSachetPrices[plan.key as keyof MergedSachetPrices]) {
              mergedSachetPrices[plan.key as keyof MergedSachetPrices] = {
                currency: planData.currency || currency,
                amount: 0,
                totalAmount: 0,
                discountedPrice: 0,
                taxRate: planData.taxRate || taxRate,
                durationDays: planData.durationDays || 0,
                capsuleCount: 0,
                savingsPercentage: planData.savingsPercentage,
                features: planData.features,
                icon: planData.icon,
              } as any;
            }

            const mergedPlan = mergedSachetPrices[
              plan.key as keyof MergedSachetPrices
            ] as any;
            const baseAmount = planData.totalAmount || planData.amount || 0;
            let planPrice = baseAmount;

            // Apply discount for 90-day plan
            if (plan.key === "ninetyDays") {
              const discountAmount =
                baseAmount * (this.NINETY_DAY_DISCOUNT_PERCENTAGE / 100);
              planPrice = baseAmount - discountAmount;
              mergedPlan.discountedPrice =
                (mergedPlan.discountedPrice || 0) + planPrice * quantity;
            } else if (planData.discountedPrice) {
              planPrice = planData.discountedPrice;
              mergedPlan.discountedPrice =
                (mergedPlan.discountedPrice || 0) + planPrice * quantity;
            }

            mergedPlan.amount += baseAmount * quantity;
            mergedPlan.totalAmount += planPrice * quantity;
            const capsules = (planData.capsuleCount || 0) * quantity;
            mergedPlan.capsuleCount += capsules;
            totalCapsules[plan.totalKey as keyof typeof totalCapsules] +=
              capsules;
          }
        }
      }
    }

    // Round merged prices
    const roundPrice = (price: number) => Math.round(price * 100) / 100;

    ["thirtyDays", "sixtyDays", "ninetyDays", "oneEightyDays"].forEach(
      (key) => {
        const plan = mergedSachetPrices[key as keyof MergedSachetPrices] as any;
        if (plan) {
          plan.amount = roundPrice(plan.amount);
          plan.totalAmount = roundPrice(plan.totalAmount);
          if (plan.discountedPrice) {
            plan.discountedPrice = roundPrice(plan.discountedPrice);
          }
        }
      },
    );

    return {
      products: productPurchasePlans,
      merged: {
        sachetPrices: mergedSachetPrices,
        totalCapsules,
      },
      totals: {
        subtotal: {
          currency,
          amount: Math.round(totalSubtotal * 100) / 100,
          taxRate,
        },
        tax: {
          currency,
          amount: Math.round(totalTax * 100) / 100,
          taxRate,
        },
        discount: {
          currency,
          amount: Math.round(totalDiscount * 100) / 100,
          taxRate,
        },
        total: {
          currency,
          amount: Math.round(totalAmount * 100) / 100,
          taxRate,
        },
      },
    };
  }

  /**
   * Calculate pricing for a selected plan on checkout page
   * This uses the same purchase plan logic but focuses on a single
   * global selection (duration + subscription/one-time) for all items in cart.
   */
  async getPlanSelection(
    userId: string,
    payload: PlanSelectionRequest,
  ): Promise<PlanSelectionResponse> {
    const { planDurationDays, isSubscription, supplementsCount, variantType } =
      payload;

    // Map duration + subscription flag to internal planKey
    let planKey: string;
    if (isSubscription) {
      switch (planDurationDays) {
        case 30:
          planKey = "thirtyDays";
          break;
        case 60:
          planKey = "sixtyDays";
          break;
        case 90:
          planKey = "ninetyDays";
          break;
        case 180:
          planKey = "oneEightyDays";
          break;
        default:
          throw new AppError("Unsupported subscription duration", 400);
      }
    } else {
      // Note: One-time plans are NOT supported for SACHETS
      // This branch should not be reached for SACHETS, but kept for STAND_UP_POUCH compatibility
      // STAND_UP_POUCH uses its own logic and doesn't go through this function
      throw new AppError(
        "One-time plans are not supported for SACHETS. Only subscription plans are available.",
        400,
      );
    }

    // Reuse purchase plan builder to avoid duplicating logic
    const basePlans = await this.getPurchasePlans(userId, undefined);

    const products: PlanSelectionProductPrice[] = [];

    let subtotal = 0;
    let membershipDiscountTotal = 0;
    let ninetyDayPlanDiscountTotal = 0;
    const currency =
      basePlans.totals.subtotal.currency || basePlans.totals.total.currency;
    const taxRate = basePlans.totals.subtotal.taxRate || 0;

    // For each product, pick the matching plan according to global selection
    for (const product of basePlans.products) {
      // Skip products that don't match requested variant type
      if (product.variant !== variantType) {
        continue;
      }

      let matchingPlan: PurchasePlan | undefined;

      if (isSubscription) {
        matchingPlan = product.plans.find(
          (p) => p.planType === "subscription" && p.planKey === planKey,
        );
      } else {
        // One-time: match by capsule count where applicable
        matchingPlan = product.plans.find((p) => {
          if (p.planType !== "oneTime" || (p.planKey !== "oneTime" && p.planKey !== "count_0" && p.planKey !== "count_1")) {
            return false;
          }
          if (typeof supplementsCount === "number" && p.capsuleCount) {
            return p.capsuleCount === supplementsCount;
          }
          return true;
        });
      }

      if (!matchingPlan) {
        // If product doesn't support this plan, skip it from selection
        continue;
      }

      // Find cart quantity for this product
      const cart = await Carts.findOne({
        cartType: "NORMAL",
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      }).lean();

      const cartItem = cart?.items?.find(
        (item: any) => item.productId.toString() === product.productId,
      );

      const quantity = 1; // Quantity removed from cart, each item is 1

      // Get the price after 90-day discount (if applicable)
      // For 90-day plans, totalAmount is already the discounted price
      const baseAmount =
        matchingPlan.price.totalAmount || matchingPlan.price.amount || 0;

      // Calculate 90-day plan discount per product (if applicable)
      // This is the discount amount that was already applied to get baseAmount
      let ninetyDayPlanDiscountAmount = 0;
      if (matchingPlan.planKey === "ninetyDays") {
        const originalAmount = matchingPlan.price.amount || 0;
        // For 90-day plans, totalAmount is the discounted price
        const discountedAmount =
          matchingPlan.price.totalAmount ||
          matchingPlan.price.discountedPrice ||
          baseAmount;
        ninetyDayPlanDiscountAmount = this.roundAmount(
          (originalAmount - discountedAmount) * quantity,
        );
      }

      // Calculate membership discount for this product
      const productDoc = await Products.findById(product.productId)
        .select("price metadata")
        .lean();

      let memberUnitPrice:
        | { currency: string; amount: number; taxRate: number }
        | undefined;
      let membershipDiscountAmount: number | undefined;
      let membershipDiscountPercentage: number | undefined;

      if (productDoc) {
        const productDocAny = productDoc as any;
        const productPriceSource: ProductPriceSource = {
          price: {
            currency: matchingPlan.price.currency || currency,
            amount: baseAmount,
            taxRate: matchingPlan.price.taxRate ?? taxRate,
          },
          memberPrice: productDocAny.metadata?.memberPrice,
          memberDiscountOverride:
            productDocAny.metadata?.memberDiscountOverride,
        };

        const memberPriceResult = await calculateMemberPrice(
          productPriceSource,
          userId,
        );

        if (memberPriceResult.isMember) {
          memberUnitPrice = {
            currency: memberPriceResult.memberPrice.currency,
            amount: memberPriceResult.memberPrice.amount,
            taxRate: memberPriceResult.memberPrice.taxRate,
          };
          membershipDiscountAmount = this.roundAmount(
            memberPriceResult.discountAmount * quantity,
          );
          membershipDiscountPercentage = memberPriceResult.discountPercentage;
          membershipDiscountTotal += membershipDiscountAmount;
        }
      }

      // Calculate line subtotal - use member price if available, otherwise use base price
      const effectiveUnitPrice = memberUnitPrice?.amount || baseAmount;
      const lineSubtotal = effectiveUnitPrice * quantity;
      const lineTotal = lineSubtotal;

      subtotal += lineSubtotal;
      ninetyDayPlanDiscountTotal += ninetyDayPlanDiscountAmount;

      products.push({
        productId: product.productId,
        productName: product.productName,
        planType: matchingPlan.planType,
        durationDays: matchingPlan.durationDays,
        capsuleCount: matchingPlan.capsuleCount,
        quantity,
        unitPrice: {
          currency: matchingPlan.price.currency || currency,
          amount: baseAmount,
          taxRate: matchingPlan.price.taxRate ?? taxRate,
        },
        memberUnitPrice,
        membershipDiscountAmount,
        membershipDiscountPercentage,
        lineSubtotal,
        lineTotal,
        ninetyDayPlanDiscountAmount,
      });
    }

    // Tax and shipping handling (future scope for tax, 0 shipping for now)
    const tax = 0;
    const shippingFees = 0;

    // Membership discount is now calculated per product above
    const membershipDiscount = this.roundAmount(membershipDiscountTotal);

    const discountPrice = 0; // Placeholder for additional discounts (e.g. coupons)

    // Calculate total amount: subtotal (already includes member prices) - 90-day discount - coupon discount + tax + shipping
    // Note: subtotal already uses member prices if user is a member, so we don't subtract membershipDiscount again
    const totalAmount = this.roundAmount(
      subtotal -
        ninetyDayPlanDiscountTotal -
        discountPrice +
        tax +
        shippingFees,
    );

    return {
      products,
      payment: {
        subtotal: this.roundAmount(subtotal),
        discountPrice: this.roundAmount(discountPrice),
        ninetyDayPlanDiscount: this.roundAmount(ninetyDayPlanDiscountTotal),
        tax: this.roundAmount(tax),
        shippingFees: this.roundAmount(shippingFees),
        membershipDiscount,
        totalAmount,
        currency,
      },
    };
  }

  /**
   * Round amount to 2 decimal places
   */
  private roundAmount(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /**
   * Validate and calculate coupon discount
   */
  private async validateCouponForSummary({
    couponCode,
    userId,
    orderAmount,
    productIds,
    categoryIds,
    planDurationDays,
    isSubscription,
    variantType,
  }: {
    couponCode: string;
    userId: string;
    orderAmount: number;
    productIds: string[];
    categoryIds: string[];
    planDurationDays?: number;
    isSubscription?: boolean;
    variantType?: ProductVariant;
  }): Promise<{ discountAmount: number; metadata?: Record<string, any> }> {
    const coupon = await Coupons.findOne({
      code: couponCode.toUpperCase(),
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
    if (
      coupon.usageLimit !== null &&
      coupon.usageLimit !== undefined &&
      coupon.usageLimit > 0 &&
      coupon.usageCount >= coupon.usageLimit
    ) {
      throw new AppError("This coupon has reached its usage limit", 400);
    }

    // Check user usage limit (0 means infinite, so skip check if 0 or undefined)
    if (
      coupon.userUsageLimit !== null &&
      coupon.userUsageLimit !== undefined &&
      coupon.userUsageLimit > 0
    ) {
      const userUsageCount = await Orders.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        couponCode: coupon.code,
        isDeleted: false,
      });

      if (userUsageCount >= coupon.userUsageLimit) {
        throw new AppError(
          "You have reached the maximum usage limit for this coupon",
          400,
        );
      }
    }

    if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
      throw new AppError(
        `Minimum order amount of ${coupon.minOrderAmount} is required for this coupon`,
        400,
      );
    }

    if (
      coupon.applicableProducts &&
      coupon.applicableProducts.length > 0 &&
      !productIds.some((id) =>
        coupon.applicableProducts
          .map((productId) => productId.toString())
          .includes(id),
      )
    ) {
      throw new AppError(
        "This coupon is not applicable to the selected products",
        400,
      );
    }

    if (
      coupon.applicableCategories &&
      coupon.applicableCategories.length > 0 &&
      !categoryIds.some((id) =>
        coupon.applicableCategories
          .map((categoryId) => categoryId.toString())
          .includes(id),
      )
    ) {
      throw new AppError(
        "This coupon is not applicable to the selected categories",
        400,
      );
    }

    // Additional validation: recurringMonths for subscription sachet plans
    // If coupon has recurringMonths configured, it should only apply to matching subscription plan durations
    if (
      isSubscription &&
      variantType === ProductVariant.SACHETS &&
      Array.isArray((coupon as any).recurringMonths) &&
      (coupon as any).recurringMonths.length > 0
    ) {
      if (!planDurationDays) {
        throw new AppError(
          "This coupon is only valid for specific subscription plans",
          400,
        );
      }

      const recurringMonths: number[] = (coupon as any).recurringMonths;

      // Map recurring month values to allowed duration days
      // 1 -> 30 days, 2 -> 60 days, 3 -> 90 days, 6 -> 180 days
      const monthToDuration: Record<number, number> = {
        1: 30,
        2: 60,
        3: 90,
        6: 180,
      };

      const allowedDurations = new Set<number>();
      for (const month of recurringMonths) {
        const mappedDuration = monthToDuration[month];
        if (mappedDuration) {
          allowedDurations.add(mappedDuration);
        }
      }

      if (!allowedDurations.has(planDurationDays)) {
        throw new AppError(
          "This coupon is not applicable to the selected subscription plan",
          400,
        );
      }
    }

    if (
      coupon.excludedProducts &&
      coupon.excludedProducts.length > 0 &&
      productIds.some((id) =>
        coupon.excludedProducts
          .map((productId) => productId.toString())
          .includes(id),
      )
    ) {
      throw new AppError(
        "This coupon cannot be applied to one or more selected products",
        400,
      );
    }

    let discountAmount = 0;

    if (coupon.type === CouponType.PERCENTAGE) {
      discountAmount = (orderAmount * coupon.value) / 100;
      if (coupon.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
    } else if (coupon.type === CouponType.FIXED) {
      discountAmount = Math.min(coupon.value, orderAmount);
    } else if (coupon.type === CouponType.FREE_SHIPPING) {
      // Free shipping discount is handled separately
      discountAmount = 0;
    }

    return {
      discountAmount: this.roundAmount(discountAmount),
      metadata: {
        type: coupon.type,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        name: coupon.name,
      },
    };
  }

  /**
   * Get checkout summary with plan selection, membership discounts, and coupon
   * This method combines plan selection with membership pricing and coupon validation
   */
  async getCheckoutSummaryWithPlanSelection(
    userId: string,
    options?: {
      planDurationDays?: 30 | 60 | 90 | 180;
      isSubscription?: boolean;
      supplementsCount?: 30 | 60;
      variantType?: ProductVariant;
      couponCode?: string;
    },
  ): Promise<{
    products: Array<{
      productId: string;
      productName: string;
      planType: "oneTime" | "subscription";
      durationDays?: number;
      capsuleCount?: number;
      quantity: number;
      unitPrice: { currency: string; amount: number; taxRate: number };
      memberUnitPrice?: { currency: string; amount: number; taxRate: number };
      membershipDiscountAmount?: number;
      membershipDiscountPercentage?: number;
      ninetyDayPlanDiscountAmount?: number;
      lineSubtotal: number;
      lineTotal: number;
    }>;
    payment: {
      subtotal: number;
      discountPrice: number;
      ninetyDayPlanDiscount: number;
      tax: number;
      shippingFees: number;
      membershipDiscount: number;
      totalAmount: number;
      currency: string;
    };
  }> {
    // If plan selection parameters are provided, use plan selection logic
    if (
      options?.planDurationDays &&
      options?.isSubscription !== undefined &&
      options?.variantType
    ) {
      // Get base plan selection
      const planSelection = await this.getPlanSelection(userId, {
        planDurationDays: options.planDurationDays,
        isSubscription: options.isSubscription,
        supplementsCount: options.supplementsCount,
        variantType: options.variantType,
      });

      // Calculate membership discounts for each product
      const productsWithMembership = await Promise.all(
        planSelection.products.map(async (product) => {
          // Get product details to calculate member price
          const productDoc = await Products.findById(product.productId)
            .select("price metadata")
            .lean();

          if (!productDoc) {
            return product;
          }

          const productDocAny = productDoc as any;

          const productPriceSource: ProductPriceSource = {
            price: {
              currency: product.unitPrice.currency,
              amount: product.unitPrice.amount,
              taxRate: product.unitPrice.taxRate,
            },
            memberPrice: productDocAny.metadata?.memberPrice,
            memberDiscountOverride:
              productDocAny.metadata?.memberDiscountOverride,
          };

          const memberPriceResult = await calculateMemberPrice(
            productPriceSource,
            userId,
          );

          let memberUnitPrice:
            | { currency: string; amount: number; taxRate: number }
            | undefined;
          let membershipDiscountAmount: number | undefined;
          let membershipDiscountPercentage: number | undefined;

          if (memberPriceResult.isMember) {
            memberUnitPrice = {
              currency: memberPriceResult.memberPrice.currency,
              amount: memberPriceResult.memberPrice.amount,
              taxRate: memberPriceResult.memberPrice.taxRate,
            };
            membershipDiscountAmount = this.roundAmount(
              memberPriceResult.discountAmount, // Quantity removed from cart, each item is 1
            );
            membershipDiscountPercentage = memberPriceResult.discountPercentage;
          }

          // Recalculate line totals with member price if applicable
          const lineSubtotal = memberUnitPrice
            ? memberUnitPrice.amount // Quantity removed from cart, each item is 1
            : product.lineSubtotal;
          const lineTotal = lineSubtotal;

          return {
            ...product,
            memberUnitPrice,
            membershipDiscountAmount,
            membershipDiscountPercentage,
            lineSubtotal,
            lineTotal,
          };
        }),
      );

      // Calculate total membership discount
      const membershipDiscountTotal = productsWithMembership.reduce(
        (sum, product) => sum + (product.membershipDiscountAmount || 0),
        0,
      );

      // Calculate subtotal after membership discount
      const subtotalAfterMembership = productsWithMembership.reduce(
        (sum, product) => sum + product.lineSubtotal,
        0,
      );

      // Get product IDs and category IDs for coupon validation
      const productIds = productsWithMembership.map((p) => p.productId);
      const productDocs = await Products.find({
        _id: { $in: productIds.map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select("categories")
        .lean();
      const categoryIds = Array.from(
        new Set(
          productDocs
            .flatMap((p) => p.categories || [])
            .map((c) => c.toString()),
        ),
      );

      // Validate and calculate coupon discount
      let couponDiscountAmount = 0;
      if (options.couponCode) {
        const couponResult = await this.validateCouponForSummary({
          couponCode: options.couponCode,
          userId,
          orderAmount: subtotalAfterMembership,
          productIds,
          categoryIds,
          planDurationDays: options.planDurationDays,
          isSubscription: options.isSubscription,
          variantType: options.variantType,
        });
        couponDiscountAmount = couponResult.discountAmount;
      }

      // Calculate final totals
      const subtotal = planSelection.payment.subtotal;
      const ninetyDayPlanDiscount = planSelection.payment.ninetyDayPlanDiscount;
      const tax = planSelection.payment.tax;
      const shippingFees = planSelection.payment.shippingFees;
      const discountPrice = couponDiscountAmount;
      const totalAmount = this.roundAmount(
        subtotalAfterMembership -
          ninetyDayPlanDiscount -
          discountPrice +
          tax +
          shippingFees,
      );

      return {
        products: productsWithMembership,
        payment: {
          subtotal: this.roundAmount(subtotalAfterMembership),
          discountPrice: this.roundAmount(discountPrice),
          ninetyDayPlanDiscount: this.roundAmount(ninetyDayPlanDiscount),
          tax: this.roundAmount(tax),
          shippingFees: this.roundAmount(shippingFees),
          membershipDiscount: this.roundAmount(membershipDiscountTotal),
          totalAmount,
          currency: planSelection.payment.currency,
        },
      };
    }

    // If no plan selection, return empty result (fallback to old behavior)
    throw new AppError(
      "Plan selection parameters are required for checkout summary",
      400,
    );
  }

  /**
   * Enhanced plan selection and pricing calculation API
   * Implements comprehensive pricing logic with:
   * - Sachet subscription vs one-time detection
   * - Standup pouch one-time purchase support
   * - Plan discount calculation (from sachetPrices or standupPouchPrice)
   * - Membership discount (percentage or fixed)
   * - Coupon discount support
   * - 90-day default discount (15% extra)
   * - Detailed breakdowns per product and overall
   */
  async getEnhancedPlanPricing(
    userId: string,
    options: {
      planDurationDays: 30 | 60 | 90 | 180;
      planType: "SACHET" | "STANDUP_POUCH";
      capsuleCount?: 60 | 120; // For one-time purchases (STAND_UP_POUCH: 60 or 120)
      couponCode?: string;
    },
  ): Promise<{
    success: boolean;
    data: {
      selectedPlan: {
        type: "SACHET" | "STANDUP_POUCH";
        durationDays: number;
        capsuleCount: number;
        label: string;
      };
      cart: {
        items: Array<{
          productId: string;
          title: string;
          planType: "SACHET" | "STANDUP_POUCH";
          mrp: number;
          planPrice: number;
          planDiscount: number;
          membershipDiscount: number;
          finalPrice: number;
          quantity: number;
        }>;
      };
      pricing: {
        mrpTotal: number;
        planDiscountTotal: number;
        membershipDiscountTotal: number;
        couponDiscountTotal: number;
        subtotal: number;
        tax: number;
        shipping: number;
        grandTotal: number;
      };
    };
  }> {
    const { planDurationDays, planType, capsuleCount, couponCode } = options;

    // Get user's cart
    const cart = await Carts.findOne({
      cartType: "NORMAL",
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    }).lean();

    if (!cart || !cart.items || cart.items.length === 0 || cart.cartType !== "NORMAL") {
      throw new AppError("Cart is empty", 400);
    }

    // Fetch all products in cart
    const productIds = cart.items.map((item: any) => item.productId);
    const products = await Products.find({
      _id: { $in: productIds },
      isDeleted: false,
      status: true,
    }).lean();

    if (products.length === 0) {
      throw new AppError("No valid products found in cart", 404);
    }

    const currency = "USD";
    let mrpTotal = 0;
    let planDiscountTotal = 0;
    let membershipDiscountTotal = 0;
    const cartItems: Array<{
      productId: string;
      title: string;
      planType: "SACHET" | "STANDUP_POUCH";
      mrp: number;
      planPrice: number;
      planDiscount: number;
      membershipDiscount: number;
      finalPrice: number;
      quantity: number;
    }> = [];

    // Determine if this is a subscription or one-time purchase
    const isSubscription = planType === "SACHET" && planDurationDays >= 30;
    const planKey = this.getPlanKey(planDurationDays, isSubscription);

    for (const product of products) {
      const cartItem = cart.items.find(
        (item: any) => item.productId.toString() === product._id.toString(),
      );

      if (!cartItem) continue;

      const quantity = 1; // Quantity removed from cart, each item is 1
      const productTitle =
        typeof product.title === "string"
          ? product.title
          : product.title?.en || product.title?.nl || "Product";

      let mrpPerUnit = 0;
      let planPricePerUnit = 0;

      // Determine pricing based on plan type
      if (planType === "SACHET" && product.sachetPrices) {
        const sachetPrices = product.sachetPrices as any;

        if (isSubscription) {
          // Subscription pricing
          const subscriptionPrice = sachetPrices[planKey];
          if (subscriptionPrice) {
            mrpPerUnit = subscriptionPrice.amount || 0;
            planPricePerUnit = subscriptionPrice.discountedPrice || mrpPerUnit;

            // Apply 90-day default discount (15% extra)
            if (planDurationDays === 90) {
              const ninetyDayDiscount =
                mrpPerUnit * (this.NINETY_DAY_DISCOUNT_PERCENTAGE / 100);
              planPricePerUnit = mrpPerUnit - ninetyDayDiscount;
            }
          }
        } else {
          // Note: One-time plans are NOT supported for SACHETS
          // This branch should not be reached, but kept for safety
          throw new AppError(
            "One-time plans are not supported for SACHETS. Only subscription plans are available.",
            400
          );
        }
      } else if (
        planType === "STANDUP_POUCH" &&
        product.hasStandupPouch &&
        product.standupPouchPrice
      ) {
        // Standup pouch pricing (one-time only) - uses count_0 / count_1
        const standupPrice = getNormalizedStandupPouchPrice(product.standupPouchPrice);
        if (standupPrice.count_0 || standupPrice.count_1) {
          const countKey = capsuleCount ? getStandUpPouchPlanKey(capsuleCount) : null;
          const selectedPrice =
            (countKey && standupPrice[countKey]) ||
            (capsuleCount === 60 ? standupPrice.count_0 : null) ||
            (capsuleCount === 120 ? standupPrice.count_1 : null) ||
            standupPrice.count_0 ||
            standupPrice.count_1;
          if (selectedPrice) {
            mrpPerUnit = selectedPrice.amount || 0;
            planPricePerUnit = selectedPrice.discountedPrice || mrpPerUnit;
          }
        } else {
          // Simple price object
          mrpPerUnit = standupPrice.amount || 0;
          planPricePerUnit = standupPrice.discountedPrice || mrpPerUnit;
        }
      }

      // Calculate plan discount per unit
      const planDiscountPerUnit = mrpPerUnit - planPricePerUnit;

      // Calculate membership discount
      const productPriceSource: ProductPriceSource = {
        price: {
          currency,
          amount: planPricePerUnit,
          taxRate: 0,
        },
        memberPrice: (product as any).metadata?.memberPrice,
        memberDiscountOverride: (product as any).metadata
          ?.memberDiscountOverride,
      };

      const memberPriceResult = await calculateMemberPrice(
        productPriceSource,
        userId,
      );

      let membershipDiscountPerUnit = 0;
      let finalPricePerUnit = planPricePerUnit;

      if (memberPriceResult.isMember) {
        membershipDiscountPerUnit = memberPriceResult.discountAmount;
        finalPricePerUnit = memberPriceResult.memberPrice.amount;
      }

      // Calculate totals for this product
      const mrpTotal_forProduct = mrpPerUnit * quantity;
      const planDiscountTotal_forProduct = planDiscountPerUnit * quantity;
      const membershipDiscountTotal_forProduct =
        membershipDiscountPerUnit * quantity;
      const finalPriceTotal_forProduct = finalPricePerUnit * quantity;

      mrpTotal += mrpTotal_forProduct;
      planDiscountTotal += planDiscountTotal_forProduct;
      membershipDiscountTotal += membershipDiscountTotal_forProduct;

      cartItems.push({
        productId: product._id.toString(),
        title: productTitle,
        planType,
        mrp: this.roundAmount(mrpPerUnit),
        planPrice: this.roundAmount(planPricePerUnit),
        planDiscount: this.roundAmount(planDiscountPerUnit),
        membershipDiscount: this.roundAmount(membershipDiscountPerUnit),
        finalPrice: this.roundAmount(finalPricePerUnit),
        quantity,
      });
    }

    // Calculate subtotal (sum of final prices)
    let subtotal = cartItems.reduce(
      (sum, item) => sum + item.finalPrice, // Quantity removed from cart, each item is 1
      0,
    );

    // Apply coupon discount if provided
    let couponDiscountTotal = 0;
    if (couponCode) {
      try {
        const productDocs = await Products.find({
          _id: { $in: productIds },
        })
          .select("categories")
          .lean();
        const categoryIds = Array.from(
          new Set(
            productDocs
              .flatMap((p) => p.categories || [])
              .map((c) => c.toString()),
          ),
        );

        const couponResult = await this.validateCouponForSummary({
          couponCode,
          userId,
          orderAmount: subtotal,
          productIds: productIds.map((id) => id.toString()),
          categoryIds,
          planDurationDays,
          isSubscription,
          variantType:
            planType === "SACHET"
              ? ProductVariant.SACHETS
              : ProductVariant.STAND_UP_POUCH,
        });
        couponDiscountTotal = couponResult.discountAmount;
      } catch (error) {
        logger.warn(`Coupon validation failed: ${error}`);
        // Continue without coupon if validation fails
      }
    }

    // Calculate tax and shipping (future scope)
    const tax = 0;
    const shipping = 0;

    // Calculate grand total
    const grandTotal = this.roundAmount(
      subtotal - couponDiscountTotal + tax + shipping,
    );

    return {
      success: true,
      data: {
        selectedPlan: {
          type: planType,
          durationDays: planDurationDays,
          capsuleCount: capsuleCount || (planDurationDays === 30 ? 30 : 60),
          label: this.getPlanLabel(planDurationDays, planType, capsuleCount),
        },
        cart: {
          items: cartItems,
        },
        pricing: {
          mrpTotal: this.roundAmount(mrpTotal),
          planDiscountTotal: this.roundAmount(planDiscountTotal),
          membershipDiscountTotal: this.roundAmount(membershipDiscountTotal),
          couponDiscountTotal: this.roundAmount(couponDiscountTotal),
          subtotal: this.roundAmount(subtotal),
          tax: this.roundAmount(tax),
          shipping: this.roundAmount(shipping),
          grandTotal,
        },
      },
    };
  }

  /**
   * Helper to get plan key from duration and subscription flag
   */
  private getPlanKey(durationDays: number, isSubscription: boolean): string {
    if (!isSubscription) {
      return "oneTime";
    }

    switch (durationDays) {
      case 30:
        return "thirtyDays";
      case 60:
        return "sixtyDays";
      case 90:
        return "ninetyDays";
      case 180:
        return "oneEightyDays";
      default:
        return "oneTime";
    }
  }

  /**
   * Helper to get plan label
   */
  private getPlanLabel(
    durationDays: number,
    planType: string,
    capsuleCount?: number,
  ): string {
    if (planType === "STANDUP_POUCH") {
      return `Stand-up Pouch (${capsuleCount || 60} count)`;
    }

    if (durationDays >= 30) {
      return `${durationDays} Day Plan`;
    }

    return `One-Time (${capsuleCount || 30} count)`;
  }

  /**
   * Get comprehensive checkout summary for display on checkout page
   * Includes: Products in cart, subscription plans, pricing, suggested products
   */
  async getCheckoutPageSummary(
    userId: string,
    options: {
      sachets?: {
        planDurationDays: 30 | 60 | 90 | 180;
        // isOneTime is NOT allowed for SACHETS - only subscription plans are supported
      };
      standUpPouch?: {
        capsuleCount?: 60 | 120;
        planDays?: 60 | 120;
        itemQuantities?: Array<{
          productId: string;
          quantity: number;
          capsuleCount?: 60 | 120;
          planDays?: 60 | 120;
        }>;
      };
      couponCode?: string;
      shippingAddressId?: string | null;
      billingAddressId?: string | null;
    } = {},
  ): Promise<{
    success: boolean;
    data: {
      cart: {
        items: Array<{
          productId: string;
          title: string;
          image: string;
          variant: string;
          quantity: number;
          basePlanPrice: {
            currency: string;
            amount: number;
            discountedPrice: number;
            planType: string;
          };
          membershipDiscount: number;
        }>;
        cartId: string;
      };
      sachetsPlans: Array<{
        planKey: string;
        label: string;
        durationDays: number;
        capsuleCount: number;
        totalAmount: number;
        discountedPrice: number;
        savePercentage: number;
        supplementsCount: number;
        perMonthAmount: number;
        perDeliveryAmount: number;
        features: string[];
        isRecommended: boolean;
        isSelected: boolean;
        isSubscription: boolean;
      }> | null;
      standUpPouchPlans: Record<
        string,
        Array<{
          planKey: string;
          label: string;
          durationDays: number;
          capsuleCount: number;
          totalAmount: number;
          discountedPrice: number;
          savePercentage: number;
          supplementsCount: number;
          perMonthAmount: number;
          perDeliveryAmount: number;
          features: string[];
          isRecommended: boolean;
          isSelected: boolean;
          isSubscription: boolean;
        }>
      > | null;
      pricing: {
        sachets: {
          subTotal: number;
          discountedPrice: number;
          membershipDiscountAmount: number;
          subscriptionPlanDiscountAmount: number;
          taxAmount: number;
          total: number;
          currency: string;
        } | null;
        standUpPouch: {
          subTotal: number;
          discountedPrice: number;
          membershipDiscountAmount: number;
          taxAmount: number;
          total: number;
          currency: string;
        } | null;
        overall: {
          subTotal: number;
          discountedPrice: number;
          couponDiscountAmount: number;
          membershipDiscountAmount: number;
          subscriptionPlanDiscountAmount: number;
          taxAmount: number;
          grandTotal: number;
          currency: string;
        };
      };
      coupon?: {
        code: string;
        isValid: boolean;
        discountAmount: number;
        message?: string;
      };
      suggestedProducts: Array<{
        productId: string;
        title: string;
        image: string;
        price: number;
        variant: string;
      }>;
    };
  }> {
    // Get user's cart first
    const cart = await Carts.findOne({
      cartType: "NORMAL",
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    }).lean();

    if (!cart || !cart.items || cart.items.length === 0 || cart.cartType !== "NORMAL") {
      throw new AppError("Cart is empty", 400);
    }

    // Separate items by variantType
    const sachetItems = cart.items.filter(
      (item: any) => item.variantType === ProductVariant.SACHETS,
    );
    const standupPouchItems = cart.items.filter(
      (item: any) => item.variantType === ProductVariant.STAND_UP_POUCH,
    );

    if (sachetItems.length === 0 && standupPouchItems.length === 0) {
      throw new AppError("No valid items found in cart", 400);
    }

    // Extract values from options - validate that required configs are provided based on cart items
    const sachetsConfig = options.sachets;
    const standUpPouchConfig = options.standUpPouch;

    // Validate that configs are provided for items in cart
    if (sachetItems.length > 0 && !sachetsConfig) {
      throw new AppError(
        "sachets configuration is required when cart contains SACHETS items",
        400,
      );
    }
    if (standupPouchItems.length > 0 && !standUpPouchConfig) {
      throw new AppError(
        "standUpPouch configuration is required when cart contains STAND_UP_POUCH items",
        400,
      );
    }

    // Use provided configs or defaults
    // Note: SACHETS only support subscription plans (isOneTime is NOT allowed)
    const selectedPlanDays = sachetsConfig?.planDurationDays || 180;
    const selectedCapsuleCount: number = standUpPouchConfig?.capsuleCount || DEFAULT_STAND_UP_POUCH_PLAN;
    const selectedStandUpPouchPlanDays =
      standUpPouchConfig?.planDays || selectedCapsuleCount; // Use planDays if provided, otherwise use capsuleCount
    // SACHETS are always subscription (isOneTime is NOT allowed)
    const isOneTimePurchase = false;

    /**
     * Resolve the correct STAND_UP_POUCH price entry for a given capsuleCount.
     *
     * Why: DB can store `standupPouchPrice` under `count_0` / `count_1` (or older keys),
     * and those keys are not always reliably tied to 60/120. The most reliable signal is
     * `priceEntry.capsuleCount` inside each entry.
     *
     * Priority:
     * 1) Find any entry where `entry.capsuleCount === capsuleCount`
     * 2) Fallback to config mapping (`getStandUpPouchPlanKey`)
     * 3) Otherwise null
     */
    const resolveStandUpPouchPriceEntry = (
      standupPrice: any,
      capsuleCount: number,
    ): { key: string; price: any } | null => {
      if (!standupPrice || typeof standupPrice !== "object") return null;

      // Try capsuleCount matching first (handles swapped count_0/count_1 scenarios)
      for (const [key, value] of Object.entries(standupPrice)) {
        if (!value || typeof value !== "object") continue;
        const entryCapsuleCount = Number((value as any).capsuleCount);
        if (Number.isFinite(entryCapsuleCount) && entryCapsuleCount === capsuleCount) {
          return { key, price: value };
        }
      }

      // Fallback to configured key mapping
      const mappedKey = getStandUpPouchPlanKey(capsuleCount);
      if (mappedKey && (standupPrice as any)[mappedKey]) {
        return { key: mappedKey, price: (standupPrice as any)[mappedKey] };
      }

      return null;
    };

    // Update cart items for STAND_UP_POUCH: planDays and quantities (if provided)
    if (standupPouchItems.length > 0 && standUpPouchConfig) {
      const updatedItems = [...cart.items];
      let hasUpdates = false;

      // Create a map of productId -> itemQuantities for quick lookup
      const itemQuantitiesMap = new Map();
      if (
        standUpPouchConfig.itemQuantities &&
        standUpPouchConfig.itemQuantities.length > 0
      ) {
        for (const itemQty of standUpPouchConfig.itemQuantities) {
          // Normalize productId to string for consistent comparison
          const normalizedProductId = String(itemQty.productId).trim();
          itemQuantitiesMap.set(normalizedProductId, itemQty);
        }
      }

      // Fetch products to get pricing
      const allProductIds = cart.items.map((item: any) => item.productId);
      const productsForUpdate = await Products.find({
        _id: { $in: allProductIds },
        isDeleted: false,
        status: true,
      }).lean();

      const productMapForUpdate = new Map(
        productsForUpdate.map((p: any) => [p._id.toString(), p]),
      );

      // Update planDays and quantities for STAND_UP_POUCH items
      for (let i = 0; i < updatedItems.length; i++) {
        const item = updatedItems[i];
        if (item.variantType === ProductVariant.STAND_UP_POUCH) {
          // Normalize productId for consistent lookup
          const normalizedItemProductId = String(item.productId).trim();
          const itemQty = itemQuantitiesMap.get(normalizedItemProductId);

          // Determine planDays for this specific product:
          // 1. Use planDays from itemQuantities if provided
          // 2. Use capsuleCount from itemQuantities if provided (convert to planDays)
          // 3. Fall back to top-level planDays or capsuleCount
          // 4. Default to 60
          let itemPlanDays: number;
          if (itemQty) {
            if (itemQty.planDays !== undefined) {
              itemPlanDays = itemQty.planDays;
            } else if (itemQty.capsuleCount !== undefined) {
              itemPlanDays = itemQty.capsuleCount; // capsuleCount maps to planDays
            } else {
              itemPlanDays = selectedStandUpPouchPlanDays;
            }
          } else {
            itemPlanDays = selectedStandUpPouchPlanDays;
          }

          const product = productMapForUpdate.get(item.productId.toString());
          let quantity = item.quantity || 1;
          let unitPrice = item.price?.amount || 0;
          let totalAmount = item.totalAmount || 0;

          // Update quantity if provided in itemQuantities
          if (itemQty && itemQty.quantity >= 1) {
            quantity = itemQty.quantity;
          }

          // Calculate price based on the determined planDays
          // Match planDays (60 or 120) with count_0 / count_1 in standupPouchPrice
          if (product && product.standupPouchPrice) {
            const standupPrice = getNormalizedStandupPouchPrice(product.standupPouchPrice);
            const resolved = resolveStandUpPouchPriceEntry(standupPrice, itemPlanDays);
            const selectedCountPrice =
              resolved?.price ||
              standupPrice.count_0 ||
              standupPrice.count_1 ||
              standupPrice;

            if (selectedCountPrice) {
              unitPrice =
                selectedCountPrice.discountedPrice ||
                selectedCountPrice.amount ||
                0;
              totalAmount = unitPrice * quantity;

              updatedItems[i] = {
                ...item,
                planDays: itemPlanDays, // Set per-product planDays
                isOneTime: true, // STAND_UP_POUCH is always one-time
                quantity: quantity,
                totalAmount: totalAmount,
                price: {
                  currency:
                    selectedCountPrice.currency ||
                    item.price?.currency ||
                    "USD",
                  amount: unitPrice,
                  taxRate:
                    selectedCountPrice.taxRate || item.price?.taxRate || 0,
                },
              };
              hasUpdates = true;
            } else {
              // Fallback: update planDays even if price calculation fails
              updatedItems[i] = {
                ...item,
                planDays: itemPlanDays,
                isOneTime: true,
                quantity: quantity,
              };
              hasUpdates = true;
            }
          } else {
            // Update planDays and quantity even if product not found
            updatedItems[i] = {
              ...item,
              planDays: itemPlanDays,
              isOneTime: true,
              quantity: quantity,
            };
            hasUpdates = true;
          }
        }
      }

      if (hasUpdates) {
        // Recalculate cart totals manually
        let subtotalAmount = 0;
        let totalTaxAmount = 0;
        let totalDiscount = 0;

        // Fetch products to get pricing for recalculation
        const allProductIds = cart.items.map((item: any) => item.productId);
        const productsForRecalc = await Products.find({
          _id: { $in: allProductIds },
          isDeleted: false,
          status: true,
        }).lean();

        const productMapForRecalc = new Map(
          productsForRecalc.map((p: any) => [p._id.toString(), p]),
        );

        updatedItems.forEach((item: any) => {
          const product = productMapForRecalc.get(item.productId.toString());
          if (!product) return;

          const itemVariantType = item.variantType || ProductVariant.SACHETS;
          const itemQuantity = item.quantity || 1;

          let originalAmount = 0;
          let discountedPrice = 0;
          let taxRate = 0;

          if (
            itemVariantType === ProductVariant.SACHETS &&
            product.sachetPrices
          ) {
            const thirtyDaysPlan = product.sachetPrices.thirtyDays;
            if (thirtyDaysPlan) {
              originalAmount =
                thirtyDaysPlan.amount || thirtyDaysPlan.totalAmount || 0;
              discountedPrice =
                thirtyDaysPlan.discountedPrice ||
                thirtyDaysPlan.amount ||
                thirtyDaysPlan.totalAmount ||
                0;
              taxRate = thirtyDaysPlan.taxRate || 0;
            }
          } else if (
            itemVariantType === ProductVariant.STAND_UP_POUCH &&
            product.standupPouchPrice
          ) {
            const standupPrice = getNormalizedStandupPouchPrice(product.standupPouchPrice);
            // Use planDays from item if available, otherwise use selectedStandUpPouchPlanDays or selectedCapsuleCount
            const itemPlanDays =
              item.planDays ||
              selectedStandUpPouchPlanDays ||
              selectedCapsuleCount;
            const resolved = resolveStandUpPouchPriceEntry(standupPrice, itemPlanDays);
            const selectedCountPrice =
              resolved?.price ||
              standupPrice.count_0 ||
              standupPrice.count_1 ||
              standupPrice;
            if (selectedCountPrice) {
              originalAmount = selectedCountPrice.amount || 0;
              discountedPrice =
                selectedCountPrice.discountedPrice ||
                selectedCountPrice.amount ||
                0;
              taxRate = selectedCountPrice.taxRate || 0;
            } else if (standupPrice.amount) {
              originalAmount = standupPrice.amount || 0;
              discountedPrice =
                standupPrice.discountedPrice || standupPrice.amount || 0;
              taxRate = standupPrice.taxRate || 0;
            }
          } else {
            originalAmount = item.price?.amount || 0;
            discountedPrice = item.price?.amount || 0;
            taxRate = item.price?.taxRate || 0;
          }

          subtotalAmount += originalAmount * itemQuantity;
          totalTaxAmount += taxRate * itemQuantity;
          const itemDiscount =
            (originalAmount - discountedPrice) * itemQuantity;
          totalDiscount += itemDiscount;
        });

        // Round all amounts
        subtotalAmount = Math.round(subtotalAmount * 100) / 100;
        totalTaxAmount = Math.round(totalTaxAmount * 100) / 100;
        totalDiscount = Math.round(totalDiscount * 100) / 100;
        const couponDiscountAmount =
          Math.round((cart.couponDiscountAmount || 0) * 100) / 100;

        const total =
          Math.round(
            (subtotalAmount +
              totalTaxAmount -
              totalDiscount -
              couponDiscountAmount) *
              100,
          ) / 100;

        // Update cart with new quantities and recalculated totals
        await Carts.findByIdAndUpdate(
          cart._id,
          cart.cartType === "NORMAL"
          ? {
            items: updatedItems,
            subtotal: subtotalAmount,
            tax: totalTaxAmount,
            discount: totalDiscount,
            total: Math.max(0, total),
            updatedAt: new Date(),
          } : {
            items: updatedItems,
            linkedSubscriptionId: cart.linkedSubscriptionId,
            updatedAt: new Date(),
          },
          { new: true },
        );

        // Refresh cart from database
        const updatedCart = await Carts.findOne({
          _id: cart._id,
          cartType: "NORMAL",
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
        }).lean();
        if (!updatedCart || updatedCart.cartType !== "NORMAL") {
          throw new AppError("Cart is not valid", 400);
        }

        if (updatedCart) {
          // Re-assign cart and re-separate items after update
          Object.assign(cart, updatedCart);
          // Re-separate items after update
          const updatedStandupPouchItems = cart.items.filter(
            (item: any) => item.variantType === ProductVariant.STAND_UP_POUCH,
          );
          standupPouchItems.length = 0;
          standupPouchItems.push(...updatedStandupPouchItems);
        }
      } else if (standupPouchItems.length > 0 && standUpPouchConfig) {
        // If no itemQuantities but planDays needs to be updated, update cart directly
        const updatedItems = cart.items.map((item: any) => {
          if (item.variantType === ProductVariant.STAND_UP_POUCH) {
            return {
              ...item,
              planDays: selectedStandUpPouchPlanDays,
              isOneTime: true,
            };
          }
          return item;
        });

        await Carts.findByIdAndUpdate(
          cart._id,
          cart.cartType === "NORMAL"
          ? {
            items: updatedItems,
            updatedAt: new Date(),
          } : {
            items: updatedItems,
            linkedSubscriptionId: cart.linkedSubscriptionId,
            updatedAt: new Date(),
          },
          { new: true },
        );

        // Refresh cart from database
        const updatedCart = await Carts.findOne({
          _id: cart._id,
          cartType: "NORMAL",
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
        }).lean();

        if (updatedCart) {
          Object.assign(cart, updatedCart);
          const updatedStandupPouchItems = cart.items.filter(
            (item: any) => item.variantType === ProductVariant.STAND_UP_POUCH,
          );
          standupPouchItems.length = 0;
          standupPouchItems.push(...updatedStandupPouchItems);
        }
      }
    }

    // Fetch all products
    const allProductIds = cart.items.map((item: any) => item.productId);
    const products = await Products.find({
      _id: { $in: allProductIds },
      isDeleted: false,
      status: true,
    }).lean();

    if (products.length === 0) {
      throw new AppError("No valid products found in cart", 404);
    }

    // Determine user's language for translating any I18n fields
    const userDoc = await User.findById(userId).select("language").lean();
    const userLang = getUserLanguageCode(userDoc?.language);
    
    // TEMP DEBUG: Log language detection
    console.log(`[DEBUG] User ID: ${userId}`);
    console.log(`[DEBUG] User Doc Language: ${userDoc?.language}`);
    console.log(`[DEBUG] Detected Language: ${userLang}`);

    // Transform all products for user's language
    const transformedProducts = products.map(product => 
      transformProductForLanguage(product, userLang)
    );
    
    // TEMP DEBUG: Log transformation
    console.log(`[DEBUG] Transformed ${transformedProducts.length} products`);
    console.log(`[DEBUG] Sample product title: ${transformedProducts[0]?.title}`);

    // For SACHETS with subscription: Check if user already has an active subscription with same cycleDays
    // Show warning if user tries to create a subscription plan that already exists
    let existingSubscription = null;
    if (
      sachetItems.length > 0 &&
      !isOneTimePurchase &&
      [30, 60, 90, 180].includes(selectedPlanDays)
    ) {
      existingSubscription = await Subscriptions.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        cycleDays: selectedPlanDays,
        status: SubscriptionStatus.ACTIVE,
        isDeleted: false,
      }).lean();

      if (existingSubscription) {
        logger.warn(
          `User ${userId} already has an active ${selectedPlanDays}-day subscription (${existingSubscription.subscriptionNumber}). User cannot create a new subscription with the same cycle days. They must cancel existing subscription first.`,
        );
      }
    }

    const currency = "USD";

    // Determine plan key based on selected plan duration for SACHETS
    const planKey = this.getPlanKey(selectedPlanDays, true); // true for subscription

    // Build cart items with selected plan price and membership discount
    // Process SACHETS items
    const sachetCartItemsPromises = sachetItems.map(async (item: any) => {
      const product = transformedProducts.find(
        (p) => p._id.toString() === item.productId.toString(),
      );

      if (!product || !product.sachetPrices) return null;

      // Use transformed product title (already translated)
      const productTitle = product.title || "Product";

      const sachetPrices = product.sachetPrices as any;
      const selectedPlanData = sachetPrices[planKey];

      let basePlanPrice = {
        currency,
        amount: 0,
        discountedPrice: 0,
        totalAmount: 0,
        planType: `${selectedPlanDays} Day Plan`,
        taxRate: 0,
      };

      if (selectedPlanData) {
        let discountedPrice =
          selectedPlanData.discountedPrice || selectedPlanData.amount || 0;

        // Apply 90-day bonus discount (15% extra) on discountedPrice
        if (selectedPlanDays === 90) {
          discountedPrice = discountedPrice * 0.85; // 15% discount on discountedPrice
        }

        basePlanPrice = {
          currency: selectedPlanData.currency || currency,
          amount: selectedPlanData.amount || 0,
          discountedPrice,
          totalAmount:
            selectedPlanData.totalAmount || selectedPlanData.amount || 0,
          planType: `${selectedPlanDays} Day Plan`,
          taxRate: selectedPlanData.taxRate || 0,
        };
      }

      // Calculate membership discount
      const productPriceSource: ProductPriceSource = {
        price: {
          currency,
          amount: basePlanPrice.discountedPrice,
          taxRate: 0,
        },
        memberPrice: (product as any).metadata?.memberPrice,
        memberDiscountOverride: (product as any).metadata
          ?.memberDiscountOverride,
      };

      const memberPriceResult = await calculateMemberPrice(
        productPriceSource,
        userId,
      );

      const membershipDiscount = memberPriceResult.isMember
        ? memberPriceResult.discountAmount
        : 0;

      return {
        productId: product._id.toString(),
        title: productTitle,
        image: product.productImage || "",
        variant: ProductVariant.SACHETS,
        quantity: 1,
        basePlanPrice,
        membershipDiscount: this.roundAmount(membershipDiscount),
        taxRate: basePlanPrice.taxRate || 0,
      };
    });

    // Process STAND_UP_POUCH items
    const standupPouchCartItemsPromises = standupPouchItems.map(
      async (item: any) => {
        const product = transformedProducts.find(
          (p) => p._id.toString() === item.productId.toString(),
        );

        if (!product || !product.hasStandupPouch || !product.standupPouchPrice)
          return null;

        // Use transformed product title (already translated)
        const productTitle = product.title || "Product";

        const standupPrice = getNormalizedStandupPouchPrice(product.standupPouchPrice);
        
        // Use cart item's planDays as capsuleCount (60 or 120), fallback to selectedCapsuleCount or default
        // Note: For STAND_UP_POUCH, planDays in cart is treated as capsuleCount
        const itemCapsuleCount = item.planDays || selectedCapsuleCount || DEFAULT_STAND_UP_POUCH_PLAN;
        
        let basePlanPrice = {
          currency,
          amount: 0,
          discountedPrice: 0,
          totalAmount: 0,
          planType: `Stand-up Pouch (${itemCapsuleCount} count)`,
          taxRate: 0,
        };

        const resolved = resolveStandUpPouchPriceEntry(standupPrice, itemCapsuleCount);
        if ((resolved?.price || standupPrice.count_0 || standupPrice.count_1) && (standupPrice.count_0 || standupPrice.count_1 || resolved?.price)) {
          const selectedCountPrice =
            resolved?.price ||
            standupPrice.count_0 ||
            standupPrice.count_1 ||
            standupPrice;

          if (selectedCountPrice) {
            basePlanPrice = {
              currency: selectedCountPrice.currency || currency,
              amount: selectedCountPrice.amount || 0,
              discountedPrice:
                selectedCountPrice.discountedPrice ||
                selectedCountPrice.amount ||
                0,
              totalAmount:
                selectedCountPrice.totalAmount ||
                selectedCountPrice.amount ||
                0,
              planType: `Stand-up Pouch (${itemCapsuleCount} count)`,
              taxRate: selectedCountPrice.taxRate || 0,
            };
          }
        } else {
          // Fallback to simple price object
          basePlanPrice = {
            currency: standupPrice.currency || currency,
            amount: standupPrice.amount || 0,
            discountedPrice:
              standupPrice.discountedPrice || standupPrice.amount || 0,
            totalAmount: standupPrice.totalAmount || standupPrice.amount || 0,
            planType: "Stand-up Pouch",
            taxRate: standupPrice.taxRate || 0,
          };
        }

        // Calculate membership discount
        const productPriceSource: ProductPriceSource = {
          price: {
            currency,
            amount: basePlanPrice.discountedPrice,
            taxRate: 0,
          },
          memberPrice: (product as any).metadata?.memberPrice,
          memberDiscountOverride: (product as any).metadata
            ?.memberDiscountOverride,
        };

        const memberPriceResult = await calculateMemberPrice(
          productPriceSource,
          userId,
        );

        const membershipDiscount = memberPriceResult.isMember
          ? memberPriceResult.discountAmount
          : 0;

        const itemQuantity = item.quantity || 1;

        return {
          productId: product._id.toString(),
          title: productTitle,
          image: product.productImage || "",
          variant: ProductVariant.STAND_UP_POUCH,
          quantity: itemQuantity,
          basePlanPrice,
          membershipDiscount: this.roundAmount(
            membershipDiscount * itemQuantity,
          ),
          taxRate: (basePlanPrice.taxRate || 0) * itemQuantity,
        };
      },
    );

    // Combine all cart items
    const sachetCartItems = (await Promise.all(sachetCartItemsPromises)).filter(
      (item) => item !== null,
    );
    const standupPouchCartItems = (
      await Promise.all(standupPouchCartItemsPromises)
    ).filter((item) => item !== null);
    const cartItems = [...sachetCartItems, ...standupPouchCartItems];

    // Build subscription plans listing - separate maps for each variantType
    const sachetsPlansMap = new Map<
      string,
      {
        planKey: string;
        label: string;
        durationDays: number;
        totalAmount: number;
        discountedPrice: number;
        capsuleCount: number;
        supplementsCount: number;
        features: Set<string>;
        isSubscription: boolean;
      }
    >();

    // Map to store plans per product: Map<productId, Map<planKey, planData>>
    const standUpPouchPlansByProductMap = new Map<
      string,
      Map<
        string,
        {
          planKey: string;
          label: string;
          durationDays: number;
          unitAmount: number;
          totalAmount: number;
          discountedPrice: number;
          capsuleCount: number;
          supplementsCount: number;
          features: Set<string>;
          isSubscription: boolean;
          isSelected: boolean;
        }
      >
    >();

    // Build plans for SACHETS variant
    if (sachetItems.length > 0) {
      for (const product of transformedProducts) {
        if (product.sachetPrices) {
          const sachetPrices = product.sachetPrices as any;
          const cartItem = sachetItems.find(
            (item: any) => item.productId.toString() === product._id.toString(),
          );
          if (!cartItem) continue;
          const quantity = 1; // Quantity removed from cart, each item is 1

          const plans = [
            {
              key: "thirtyDays",
              label: "30 Day Plan",
              days: 30,
              isSubscription: true,
            },
            {
              key: "sixtyDays",
              label: "60 Day Plan",
              days: 60,
              isSubscription: true,
            },
            {
              key: "ninetyDays",
              label: "90 Day Plan",
              days: 90,
              isSubscription: true,
            },
            {
              key: "oneEightyDays",
              label: "180 Day Plan",
              days: 180,
              isSubscription: true,
            },
          ];

          // Note: One-time plans are NOT supported for SACHETS (only subscription plans)
          // Removed oneTime plan logic

          for (const planInfo of plans) {
            // Only subscription plans are supported (one-time removed)
            const planData = sachetPrices[planInfo.key];

            if (planData) {
              const existing = sachetsPlansMap.get(planInfo.key);

              let planPrice = planData.totalAmount || planData.amount || 0;
              let discountedPrice = planData.discountedPrice || planPrice;

              // Apply 90-day bonus discount only for subscription plans
              // Apply 15% discount on the existing discountedPrice
              if (planInfo.isSubscription && planInfo.days === 90) {
                discountedPrice = discountedPrice * 0.85; // 15% discount on discountedPrice
              } else if (planData.discountedPrice) {
                discountedPrice = planData.discountedPrice;
              }

              const capsuleCount = (planData.capsuleCount || 0) * quantity;
              const totalAmount = planPrice * quantity;
              const totalDiscountedPrice = discountedPrice * quantity;

              if (existing) {
                existing.totalAmount += totalAmount;
                existing.discountedPrice += totalDiscountedPrice;
                existing.capsuleCount += capsuleCount;
                existing.supplementsCount += capsuleCount;
                if (planData.features && Array.isArray(planData.features)) {
                  planData.features.forEach((f: I18nStringType | string) =>
                    existing.features.add(
                      getTranslatedString(f as any, userLang),
                    ),
                  );
                }
              } else {
                const featuresSet = new Set<string>();
                if (planData.features && Array.isArray(planData.features)) {
                  planData.features.forEach((f: I18nStringType | string) =>
                    featuresSet.add(getTranslatedString(f as any, userLang)),
                  );
                }

                sachetsPlansMap.set(planInfo.key, {
                  planKey: planInfo.key,
                  label: planInfo.label,
                  durationDays: planInfo.days,
                  totalAmount,
                  discountedPrice: totalDiscountedPrice,
                  capsuleCount,
                  supplementsCount: capsuleCount,
                  features: featuresSet,
                  isSubscription: planInfo.isSubscription,
                });
              }
            }
          }
        }
      }
    }

    // Build plans for STAND_UP_POUCH variant - per product
    if (standupPouchItems.length > 0) {
      // Create a map of productId -> selected planDays from itemQuantities (body)
      // Priority: body itemQuantities > cart planDays > default
      const productPlanDaysMap = new Map<string, number>();
      if (
        standUpPouchConfig?.itemQuantities &&
        standUpPouchConfig.itemQuantities.length > 0
      ) {
        for (const itemQty of standUpPouchConfig.itemQuantities) {
          let planDays: number;
          // Priority: planDays > capsuleCount > default
          if (itemQty.planDays !== undefined) {
            planDays = itemQty.planDays;
          } else if (itemQty.capsuleCount !== undefined) {
            planDays = itemQty.capsuleCount; // capsuleCount maps to planDays for STAND_UP_POUCH
          } else {
            planDays = selectedStandUpPouchPlanDays || DEFAULT_STAND_UP_POUCH_PLAN;
          }
          // Normalize productId to string for consistent comparison
          // Handle both string and ObjectId formats
          const normalizedProductId = String(itemQty.productId).trim();
          productPlanDaysMap.set(normalizedProductId, planDays);
        }
      }
      
      // If no itemQuantities provided, populate map with cart items' planDays or default
      if (productPlanDaysMap.size === 0) {
        for (const cartItem of standupPouchItems) {
          const productId = String(cartItem.productId).trim();
          const planDays = (cartItem as any).planDays || selectedStandUpPouchPlanDays || DEFAULT_STAND_UP_POUCH_PLAN;
          productPlanDaysMap.set(productId, planDays);
        }
      }

      // For STAND_UP_POUCH, use dynamic plan configuration (60-count and 120-count plans)
      const standupPouchPlans = STAND_UP_POUCH_PLANS_CONFIG;

      for (const product of transformedProducts) {
        if (product.hasStandupPouch && product.standupPouchPrice) {
          const standupPrice = getNormalizedStandupPouchPrice(product.standupPouchPrice);
          const cartItem = standupPouchItems.find(
            (item: any) => item.productId.toString() === product._id.toString(),
          );
          if (!cartItem) continue;
          const quantity = (cartItem as any).quantity || 1; // Quantity from cart for stand-up pouch
          const productId = product._id.toString();
          const normalizedProductId = String(productId).trim();

          // Get selected planDays for this product
          // Priority: body itemQuantities > cart planDays > top-level config > default (60)
          // IMPORTANT: Always prioritize productPlanDaysMap (from request body) over cart values
          const selectedPlanDaysForProduct = productPlanDaysMap.has(normalizedProductId)
            ? productPlanDaysMap.get(normalizedProductId)!
            : (cartItem as any).planDays ||
              selectedStandUpPouchPlanDays ||
              DEFAULT_STAND_UP_POUCH_PLAN;

          // Initialize product plans map if not exists
          if (!standUpPouchPlansByProductMap.has(productId)) {
            standUpPouchPlansByProductMap.set(productId, new Map());
          }
          const productPlansMap = standUpPouchPlansByProductMap.get(productId)!;

          for (const planInfo of standupPouchPlans) {
            // Resolve planData by matching capsuleCount first (DB may have swapped keys)
            const desiredCapsuleCount = planInfo.count;
            const resolved = resolveStandUpPouchPriceEntry(
              standupPrice,
              desiredCapsuleCount,
            );
            const planKeyForResponse = resolved?.key || planInfo.key;
            const planData = resolved?.price || standupPrice[planInfo.key];
            if (planData) {
              const planPrice = planData.amount || 0;
              const discountedPrice = planData.discountedPrice || planPrice;
              const baseCapsuleCount = desiredCapsuleCount;
              const totalAmount = planPrice * quantity;
              const totalDiscountedPrice = discountedPrice * quantity;

              // Check if this plan is selected for this product
              const isSelected = selectedPlanDaysForProduct === desiredCapsuleCount;

              productPlansMap.set(planKeyForResponse, {
                planKey: planKeyForResponse,
                label: planInfo.label, // Label from config (60/120)
                durationDays: 0, // Not applicable for stand-up pouch
              unitAmount: planPrice,
                totalAmount,
                discountedPrice: totalDiscountedPrice,
                // capsuleCount should reflect the configured value (60 or 120), not from DB
                capsuleCount: baseCapsuleCount,
                // supplementsCount represents total capsules across quantity
                supplementsCount: baseCapsuleCount * quantity,
                features: new Set<string>(),
                isSubscription: false, // Stand-up pouch is one-time purchase
                isSelected, // Set based on product's selected planDays
              } as any);
            }
          }
        }
      }
    }

    // Helper function to convert plan map to array with calculated fields
    const convertPlansToArray = (
      plansMap: Map<
        string,
        {
          planKey: string;
          label: string;
          durationDays: number;
          totalAmount: number;
          discountedPrice: number;
          capsuleCount: number;
          supplementsCount: number;
          features: Set<string>;
          isSubscription: boolean;
        }
      >,
      variantType: "SACHETS" | "STAND_UP_POUCH",
    ) => {
      return Array.from(plansMap.values())
        .map((plan) => {
          const saveAmount = plan.totalAmount - plan.discountedPrice;
          const savePercentage =
            plan.totalAmount > 0
              ? Math.round((saveAmount / plan.totalAmount) * 100 * 100) / 100
              : 0;

          // Calculate per month amount
          const months = plan.durationDays / 30;
          const perMonthAmount =
            months > 0
              ? Math.round((plan.discountedPrice / months) * 100) / 100
              : plan.discountedPrice;

          // Calculate per delivery amount
          const perDeliveryAmount = this.roundAmount(plan.discountedPrice);

          // Determine if this plan is selected
          let isSelected = false;
          if (variantType === "SACHETS") {
            // SACHETS are subscription-only
            isSelected =
              plan.durationDays === selectedPlanDays && plan.isSubscription;
          } else {
            // STAND_UP_POUCH - this logic is now handled per product in plan building
            // This should not be reached for STAND_UP_POUCH plans anymore
            isSelected = false;
          }

          return {
            planKey: plan.planKey,
            // Ensure label always matches durationDays (e.g. "30 Day Plan", "60 Day Plan")
            label: getSachetsPlanLabel(plan.durationDays),
            durationDays: plan.durationDays,
            capsuleCount: plan.capsuleCount,
            totalAmount: this.roundAmount(plan.totalAmount),
            discountedPrice: this.roundAmount(plan.discountedPrice),
            savePercentage,
            supplementsCount: plan.supplementsCount,
            perMonthAmount,
            perDeliveryAmount,
            features: Array.from(plan.features),
            isRecommended: plan.planKey === "ninetyDays",
            isSelected,
            isSubscription: plan.isSubscription,
          };
        })
        .sort((a, b) => a.durationDays - b.durationDays);
    };

    // Convert SACHETS plans to array
    // Always include sachetsPlans in response (null if no SACHETS items)
    const sachetsPlans =
      sachetsPlansMap.size > 0
        ? convertPlansToArray(sachetsPlansMap, "SACHETS")
        : null;

    // Convert STAND_UP_POUCH plans to product-wise object
    // Always include standUpPouchPlans in response (null if no STAND_UP_POUCH items)
    let standUpPouchPlans: Record<string, any[]> | null = null;
    if (standUpPouchPlansByProductMap.size > 0) {
      standUpPouchPlans = {};
      for (const [
        productId,
        productPlansMap,
      ] of standUpPouchPlansByProductMap) {
        const plansArray = Array.from(productPlansMap.values())
          .map((plan) => {
            const saveAmount = plan.totalAmount - plan.discountedPrice;
            const savePercentage =
              plan.totalAmount > 0
                ? Math.round((saveAmount / plan.totalAmount) * 100 * 100) / 100
                : 0;

            // Calculate per month amount (not applicable for stand-up pouch, but keep for consistency)
            const perMonthAmount = this.roundAmount(plan.discountedPrice);

            // Calculate per delivery amount
            const perDeliveryAmount = this.roundAmount(plan.discountedPrice);

            return {
              planKey: plan.planKey,
              // Label should reflect the configured plan label (e.g. "60 Count", "120 Count")
              // Use the label that was set from planInfo.label (from config)
              label: plan.label || getStandUpPouchPlanLabel(plan.capsuleCount),
              durationDays: plan.durationDays,
              capsuleCount: plan.capsuleCount,
              amount: this.roundAmount(((plan as any).unitAmount || 0)),
              totalAmount: this.roundAmount(plan.totalAmount),
              discountedPrice: this.roundAmount(plan.discountedPrice),
              savePercentage,
              supplementsCount: plan.supplementsCount,
              perMonthAmount,
              perDeliveryAmount,
              features: Array.from(plan.features),
              isRecommended: false, // Stand-up pouch doesn't have recommended plan
              isSelected: plan.isSelected, // Already set per product
              isSubscription: plan.isSubscription,
            };
          })
          .sort((a, b) => {
            // Sort by capsuleCount (60 before 120)
            // Use actual capsuleCount from plan data
            return a.capsuleCount - b.capsuleCount;
          });
        standUpPouchPlans[productId] = plansArray;
      }
    }

    // For backward compatibility, create combined array for plan selection logic
    // Note: standUpPouchPlans is now product-wise, so we only include sachetsPlans here
    const allPlans = [...(sachetsPlans ?? [])];

    // Calculate separate pricing for SACHETS items
    let sachetSubtotal = 0;
    let sachetDiscountedPrice = 0;
    let sachetMembershipDiscount = 0;
    let sachetSubscriptionPlanDiscountAmount = 0;
    let sachetTaxAmount = 0;

    if (sachetItems.length > 0) {
      // Note: SACHETS no longer support one-time purchases (only subscription)
      const selectedSachetPlan = sachetsPlans?.find(
        (p) => p.durationDays === selectedPlanDays && p.isSubscription,
      ) ||
      sachetsPlans?.find((p) => p.planKey === "oneEightyDays") ||
          sachetsPlans?.find((p) => p.durationDays > 0);

      if (selectedSachetPlan) {
        sachetSubtotal = selectedSachetPlan.totalAmount;
        sachetDiscountedPrice = selectedSachetPlan.discountedPrice;

        // Calculate 15% discount for 90-day SACHETS subscription plan
        if (
          selectedPlanDays === 90 &&
          !isOneTimePurchase &&
          sachetDiscountedPrice > 0
        ) {
          sachetSubscriptionPlanDiscountAmount = this.roundAmount(
            sachetDiscountedPrice * (this.NINETY_DAY_DISCOUNT_PERCENTAGE / 100),
          );
        }
      } else {
        // Calculate from cart items if plan not found
        sachetSubtotal = sachetCartItems.reduce(
          (sum, item: any) => sum + (item.basePlanPrice.amount || 0),
          0,
        );
        sachetDiscountedPrice = sachetCartItems.reduce(
          (sum, item: any) => sum + (item.basePlanPrice.discountedPrice || 0),
          0,
        );
      }

      // Calculate SACHETS membership discount
      sachetMembershipDiscount = sachetCartItems.reduce(
        (sum, item: any) => sum + (item.membershipDiscount || 0),
        0,
      );

      // Calculate SACHETS tax
      sachetTaxAmount = sachetCartItems.reduce(
        (sum, item: any) => sum + (item.taxRate || 0),
        0,
      );
    }

    // Calculate separate pricing for STAND_UP_POUCH items
    let standupPouchSubtotal = 0;
    let standupPouchDiscountedPrice = 0;
    let standupPouchMembershipDiscount = 0;
    let standupPouchTaxAmount = 0;

    if (standupPouchItems.length > 0) {
      // Calculate pricing from cart items since plans are now product-wise
      // Sum up all STAND_UP_POUCH items' prices
      for (const item of standupPouchItems) {
        const itemPlanDays =
          (item as any).planDays || selectedStandUpPouchPlanDays || DEFAULT_STAND_UP_POUCH_PLAN;
        const product = products.find(
          (p) => p._id.toString() === item.productId.toString(),
        );

        if (product && product.standupPouchPrice) {
          const standupPrice = getNormalizedStandupPouchPrice(product.standupPouchPrice);
          const resolved = resolveStandUpPouchPriceEntry(standupPrice, itemPlanDays);
          const selectedCountPrice =
            resolved?.price ||
            standupPrice.count_0 ||
            standupPrice.count_1 ||
            standupPrice;

          if (selectedCountPrice) {
            const quantity = item.quantity || 1;
            const unitPrice = selectedCountPrice.amount || 0;
            const unitDiscountedPrice =
              selectedCountPrice.discountedPrice || unitPrice;

            standupPouchSubtotal += unitPrice * quantity;
            standupPouchDiscountedPrice += unitDiscountedPrice * quantity;
          }
        }
      }

      // If we have product-wise plans, we can also calculate from them as a fallback
      if (standUpPouchPlans && Object.keys(standUpPouchPlans).length > 0) {
        // This is already calculated above from cart items, but we can use plans as validation
        let calculatedSubtotal = 0;
        let calculatedDiscounted = 0;

        for (const [productId, plans] of Object.entries(standUpPouchPlans)) {
          const selectedPlan = plans.find((p) => p.isSelected);
          if (selectedPlan) {
            calculatedSubtotal += selectedPlan.totalAmount;
            calculatedDiscounted += selectedPlan.discountedPrice;
          }
        }

        // Use calculated values if cart items don't have prices
        if (standupPouchSubtotal === 0 && calculatedSubtotal > 0) {
          standupPouchSubtotal = calculatedSubtotal;
          standupPouchDiscountedPrice = calculatedDiscounted;
        }
      }

      // Calculate STAND_UP_POUCH membership discount
      standupPouchMembershipDiscount = standupPouchCartItems.reduce(
        (sum, item: any) => sum + (item.membershipDiscount || 0),
        0,
      );

      // Calculate STAND_UP_POUCH tax
      standupPouchTaxAmount = standupPouchCartItems.reduce(
        (sum, item: any) => sum + (item.taxRate || 0),
        0,
      );
    }

    // Calculate overall totals from both variantTypes
    const subtotal = this.roundAmount(sachetSubtotal + standupPouchSubtotal);
    const totalDiscountedPrice = this.roundAmount(
      sachetDiscountedPrice + standupPouchDiscountedPrice,
    );
    const membershipDiscountTotal = this.roundAmount(
      sachetMembershipDiscount + standupPouchMembershipDiscount,
    );
    const subscriptionPlanDiscountAmount = sachetSubscriptionPlanDiscountAmount;
    const taxAmount = this.roundAmount(sachetTaxAmount + standupPouchTaxAmount);

    // Calculate subtotal after plan discount and membership discount
    const subtotalAfterDiscounts = this.roundAmount(
      totalDiscountedPrice - membershipDiscountTotal,
    );

    // Calculate order amount for coupon validation (before coupon, after all discounts + tax)
    // This should match the grandTotal before coupon is applied
    const orderAmountForCoupon = this.roundAmount(
      subtotalAfterDiscounts + taxAmount,
    );

    // Validate and apply coupon if provided
    let couponDiscountAmount = 0;
    let couponInfo:
      | {
          code: string;
          isValid: boolean;
          discountAmount: number;
          message?: string;
        }
      | undefined;

    // Determine coupon code to use
    // First, try to use coupon from options (request body)
    // If not provided, use existing coupon from cart
    let couponCodeToProcess: string | null = null;
    
    if (options.couponCode && options.couponCode.trim()) {
      couponCodeToProcess = options.couponCode.trim().toUpperCase();
    } else if (cart.couponCode && cart.couponCode.trim()) {
      // Use existing coupon from cart if none provided in options
      couponCodeToProcess = cart.couponCode.trim().toUpperCase();
    }

    if (couponCodeToProcess) {
      try {
        // Get product IDs and category IDs for coupon validation
        const productIdsArray = products.map((p) => p._id.toString());
        const categoryIdsArray = products
          .map((p) => (p as any).category?.toString())
          .filter((c) => c) as string[];

        // For coupon validation, use SACHETS if we have sachet items, otherwise STAND_UP_POUCH
        const couponVariantType =
          sachetItems.length > 0
            ? ProductVariant.SACHETS
            : ProductVariant.STAND_UP_POUCH;

        const couponResult = await this.validateCouponForSummary({
          couponCode: couponCodeToProcess,
          userId,
          orderAmount: orderAmountForCoupon, // Use amount with tax for validation
          productIds: productIdsArray,
          categoryIds: categoryIdsArray,
          planDurationDays: selectedPlanDays,
          isSubscription: !isOneTimePurchase,
          variantType: couponVariantType,
        });

        couponDiscountAmount = couponResult.discountAmount;
        couponInfo = {
          code: couponCodeToProcess,
          isValid: true,
          discountAmount: this.roundAmount(couponDiscountAmount),
          message: "Coupon applied successfully",
        };

        // Update cart with valid coupon only if it's different from existing
        if (cart.couponCode !== couponCodeToProcess || cart.couponDiscountAmount !== couponDiscountAmount) {
          await Carts.findByIdAndUpdate(
            cart._id,
            {
              couponCode: couponCodeToProcess,
              couponDiscountAmount: this.roundAmount(couponDiscountAmount),
              updatedAt: new Date(),
            },
            { new: true },
          );
        }
      } catch (error: any) {
        // Coupon validation failed
        // If we're using the existing cart coupon, use its stored discount amount as fallback
        const isUsingExistingCartCoupon = cart.couponCode === couponCodeToProcess;
        
        couponInfo = {
          code: couponCodeToProcess,
          isValid: false,
          discountAmount: isUsingExistingCartCoupon ? (cart.couponDiscountAmount || 0) : 0,
          message: error.message || "Invalid coupon code",
        };
        logger.warn(
          `Coupon validation failed for ${couponCodeToProcess}: ${error.message}`,
        );

        // If using existing cart coupon, keep it (don't remove)
        // If new coupon failed, remove it
        if (!isUsingExistingCartCoupon) {
          // Update cart to remove invalid coupon only if coupon exists in cart
          if (cart.couponCode || cart.couponDiscountAmount > 0) {
            await Carts.findByIdAndUpdate(
              cart._id,
              {
                couponCode: null,
                couponDiscountAmount: 0,
                updatedAt: new Date(),
              },
              { new: true },
            );
          }
        }
        
        // Use existing cart discount amount if available
        couponDiscountAmount = isUsingExistingCartCoupon ? (cart.couponDiscountAmount || 0) : 0;
      }
    } else {
      // No coupon code provided (null or empty string)
      // But if cart has existing coupon, use its discount amount
      if (cart.couponCode && cart.couponDiscountAmount > 0) {
        couponDiscountAmount = cart.couponDiscountAmount;
        couponInfo = {
          code: cart.couponCode,
          isValid: true,
          discountAmount: this.roundAmount(cart.couponDiscountAmount),
          message: "Using existing coupon from cart",
        };
      } else {
        // Update cart to remove coupon only if coupon exists
        if (cart.couponCode || cart.couponDiscountAmount > 0) {
          await Carts.findByIdAndUpdate(
            cart._id,
            cart.cartType === "NORMAL"
            ? {
              couponCode: null,
              couponDiscountAmount: 0,
              updatedAt: new Date(),
              } : {
                couponCode: null,
                couponDiscountAmount: 0,
                linkedSubscriptionId: cart.linkedSubscriptionId,
                updatedAt: new Date(),
            },
            { new: true },
          );
        }
      }
    }

    // Calculate subtotal after coupon
    // Note: couponDiscountAmount is calculated on orderAmountForCoupon (which includes tax)
    // So we subtract it from subtotalAfterDiscounts (before tax)
    const subtotalAfterCoupon = this.roundAmount(
      subtotalAfterDiscounts - couponDiscountAmount,
    );

    // Ensure subtotalAfterCoupon doesn't go negative
    const finalSubtotalAfterCoupon = Math.max(0, subtotalAfterCoupon);

    // Calculate grand total (subtotal after all discounts + tax)
    const grandTotal = this.roundAmount(finalSubtotalAfterCoupon + taxAmount);

    // Calculate total discount amount (plan discount + membership discount + coupon discount)
    const planDiscount = this.roundAmount(subtotal - totalDiscountedPrice);
    const totalDiscountAmount = this.roundAmount(
      planDiscount + membershipDiscountTotal + couponDiscountAmount,
    );

    // Get suggested products (3-5 products not in cart)
    const suggestedProducts = await this.getSuggestedProductsForCheckout(
      userId,
      allProductIds,
      3,
      5,
      userLang
    );

    const result: any = {
      success: true,
      data: {
        cart: {
          items: cartItems as any,
          cartId: cart._id.toString(),
        },
        // Always include both keys in response (null if not applicable)
        sachetsPlans: sachetsPlans ?? null,
        standUpPouchPlans: standUpPouchPlans ?? null,
        // Include existing subscription warning for SACHETS subscription plans
        sachetsWarning:
          existingSubscription && sachetItems.length > 0 && !isOneTimePurchase
            ? {
                hasActiveSubscription: true,
                subscriptionId: existingSubscription._id.toString(),
                subscriptionNumber: existingSubscription.subscriptionNumber,
                cycleDays: existingSubscription.cycleDays,
                status: existingSubscription.status,
                nextBillingDate: existingSubscription.nextBillingDate
                  ? new Date(existingSubscription.nextBillingDate).toISOString()
                  : null,
                nextDeliveryDate: existingSubscription.nextDeliveryDate
                  ? new Date(
                      existingSubscription.nextDeliveryDate,
                    ).toISOString()
                  : null,
                message: `You already have an active ${selectedPlanDays}-day subscription plan. You cannot create a new subscription with the same cycle days. If you want to proceed with this plan, please cancel your existing subscription first, then you can continue with this plan.`,
                actionRequired: "cancel_existing_subscription",
              }
            : null,
        pricing: {
          // Always include SACHETS pricing key (null if no SACHETS items)
          sachets:
            sachetItems.length > 0
              ? {
                  subTotal: this.roundAmount(sachetSubtotal),
                  discountedPrice: this.roundAmount(sachetDiscountedPrice),
                  membershipDiscountAmount: this.roundAmount(
                    sachetMembershipDiscount,
                  ),
                  subscriptionPlanDiscountAmount: this.roundAmount(
                    sachetSubscriptionPlanDiscountAmount,
                  ),
                  taxAmount: this.roundAmount(sachetTaxAmount),
                  total: this.roundAmount(
                    sachetDiscountedPrice -
                      sachetMembershipDiscount +
                      sachetTaxAmount,
                  ),
                  currency,
                }
              : null,
          // Always include STAND_UP_POUCH pricing key (null if no STAND_UP_POUCH items)
          standUpPouch:
            standupPouchItems.length > 0
              ? {
                  subTotal: this.roundAmount(standupPouchSubtotal),
                  discountedPrice: this.roundAmount(
                    standupPouchDiscountedPrice,
                  ),
                  membershipDiscountAmount: this.roundAmount(
                    standupPouchMembershipDiscount,
                  ),
                  taxAmount: this.roundAmount(standupPouchTaxAmount),
                  total: this.roundAmount(
                    standupPouchDiscountedPrice -
                      standupPouchMembershipDiscount +
                      standupPouchTaxAmount,
                  ),
                  currency,
                }
              : null,
          // Overall combined pricing
          overall: {
            subTotal: this.roundAmount(subtotal),
            discountedPrice: this.roundAmount(totalDiscountedPrice),
            couponDiscountAmount: this.roundAmount(couponDiscountAmount),
            membershipDiscountAmount: this.roundAmount(membershipDiscountTotal),
            subscriptionPlanDiscountAmount: this.roundAmount(
              subscriptionPlanDiscountAmount,
            ), // 15% discount for 90-day sachets, 0 for others
            taxAmount: this.roundAmount(taxAmount),
            grandTotal: this.roundAmount(grandTotal),
            currency,
          },
        },
        shippingAddressId: options.shippingAddressId || null,
        billingAddressId: options.billingAddressId || null,
        suggestedProducts,
      },
    };

    // Add coupon info if coupon was provided
    if (couponInfo) {
      result.data.coupon = couponInfo;
    }

    return result;
  }

  /**
   * Get suggested products for checkout page
   */
  private async getSuggestedProductsForCheckout(
    userId: string,
    excludeProductIds: mongoose.Types.ObjectId[],
    minCount: number = 3,
    maxCount: number = 5,
    userLang: SupportedLanguage = DEFAULT_LANGUAGE,
  ): Promise<
    Array<{
      productId: string;
      title: string;
      image: string;
      price: number;
      variant: string;
    }>
  > {
    // Get products not in cart
    const suggestedProductDocs = await Products.find({
      _id: { $nin: excludeProductIds },
      isDeleted: false,
      status: true,
    })
      .select("_id title productImage price variant sachetPrices")
      .limit(maxCount)
      .sort({ isFeatured: -1, createdAt: -1 })
      .lean();

    // Transform suggested products for user's language
    const transformedSuggestedProducts = suggestedProductDocs.map(product => 
      transformProductForLanguage(product, userLang)
    );

    return transformedSuggestedProducts.map((product) => {
      // Use transformed product title (already translated)
      const productTitle = product.title || "Product";

      // Get base price from product
      let price = product.price?.amount || 0;

      // Try to get from sachetPrices if available
      if (product.sachetPrices) {
        const sachetPrices = product.sachetPrices as any;
        if (sachetPrices.thirtyDays) {
          price =
            sachetPrices.thirtyDays.discountedPrice ||
            sachetPrices.thirtyDays.amount ||
            price;
        }
      }

      return {
        productId: product._id.toString(),
        title: productTitle,
        image: product.productImage || "",
        price: this.roundAmount(price),
        variant: product.variant || "SACHETS",
      };
    });
  }
}

export const checkoutService = new CheckoutService();
