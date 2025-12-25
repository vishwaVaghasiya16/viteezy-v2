import { Products } from "../models/commerce/products.model";
import { Carts } from "../models/commerce/carts.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import mongoose from "mongoose";
import { ProductVariant } from "../models/enums";
import { Coupons } from "../models/commerce/coupons.model";
import { CouponType } from "../models/enums";
import { Orders } from "../models/commerce/orders.model";
import {
  calculateMemberPrice,
  ProductPriceSource,
} from "../utils/membershipPrice";

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
  oneTime?: {
    count30?: {
      currency: string;
      amount: number;
      discountedPrice?: number;
      taxRate: number;
      capsuleCount: number;
    };
    count60?: {
      currency: string;
      amount: number;
      discountedPrice?: number;
      taxRate: number;
      capsuleCount: number;
    };
  };
}

interface PurchasePlansResponse {
  products: ProductPurchasePlans[];
  merged: {
    sachetPrices: MergedSachetPrices;
    totalCapsules: {
      oneTime30: number;
      oneTime60: number;
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
   * Get purchase plans for products in cart
   * For sachets: all purchase plans (one-time + subscriptions)
   * For stand-up pouches: only one-time purchase plans
   */
  async getPurchasePlans(
    userId: string,
    selectedPlans?: Record<string, { planKey: string; capsuleCount?: number }>
  ): Promise<PurchasePlansResponse> {
    // Get user's cart
    const cart = await Carts.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    }).lean();

    if (!cart || !cart.items || cart.items.length === 0) {
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
    const currency = products[0]?.price?.currency || "EUR";
    const taxRate = products[0]?.price?.taxRate || 0;

    for (const product of products) {
      const cartItem = cart.items.find(
        (item: any) => item.productId.toString() === product._id.toString()
      );

      if (!cartItem) continue;

      const plans: PurchasePlan[] = [];
      const selectedPlan = selectedPlans?.[product._id.toString()];

      // Determine product variant
      const variant = product.variant as ProductVariant;

      if (variant === ProductVariant.SACHETS) {
        // For sachets: show all purchase plans
        if (product.sachetPrices) {
          // One-time purchase plans
          if (product.sachetPrices.oneTime) {
            if (product.sachetPrices.oneTime.count30) {
              plans.push({
                planType: "oneTime",
                planKey: "oneTime",
                capsuleCount:
                  product.sachetPrices.oneTime.count30.capsuleCount || 30,
                price: {
                  currency:
                    product.sachetPrices.oneTime.count30.currency || currency,
                  amount: product.sachetPrices.oneTime.count30.amount || 0,
                  discountedPrice:
                    product.sachetPrices.oneTime.count30.discountedPrice,
                  taxRate:
                    product.sachetPrices.oneTime.count30.taxRate || taxRate,
                  totalAmount:
                    product.sachetPrices.oneTime.count30.discountedPrice ||
                    product.sachetPrices.oneTime.count30.amount ||
                    0,
                },
                label: `One-Time (30 count)`,
              });
            }

            if (product.sachetPrices.oneTime.count60) {
              plans.push({
                planType: "oneTime",
                planKey: "oneTime",
                capsuleCount:
                  product.sachetPrices.oneTime.count60.capsuleCount || 60,
                price: {
                  currency:
                    product.sachetPrices.oneTime.count60.currency || currency,
                  amount: product.sachetPrices.oneTime.count60.amount || 0,
                  discountedPrice:
                    product.sachetPrices.oneTime.count60.discountedPrice,
                  taxRate:
                    product.sachetPrices.oneTime.count60.taxRate || taxRate,
                  totalAmount:
                    product.sachetPrices.oneTime.count60.discountedPrice ||
                    product.sachetPrices.oneTime.count60.amount ||
                    0,
                },
                label: `One-Time (60 count)`,
              });
            }
          }

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
              features: product.sachetPrices.thirtyDays.features,
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
              features: product.sachetPrices.sixtyDays.features,
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
              features: ninetyDaysPrice.features,
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
              features: product.sachetPrices.oneEightyDays.features,
              icon: product.sachetPrices.oneEightyDays.icon,
              label: "180 Days",
            });
          }
        }
      } else if (variant === ProductVariant.STAND_UP_POUCH) {
        // For stand-up pouches: only one-time purchase plans
        if (product.standupPouchPrice) {
          const standupPrice = product.standupPouchPrice as any;

          // Check if it has count30/count60 structure
          if (standupPrice.count30 || standupPrice.count60) {
            if (standupPrice.count30) {
              plans.push({
                planType: "oneTime",
                planKey: "oneTime",
                capsuleCount: standupPrice.count30.capsuleCount || 30,
                price: {
                  currency: standupPrice.count30.currency || currency,
                  amount: standupPrice.count30.amount || 0,
                  discountedPrice: standupPrice.count30.discountedPrice,
                  taxRate: standupPrice.count30.taxRate || taxRate,
                  totalAmount:
                    standupPrice.count30.discountedPrice ||
                    standupPrice.count30.amount ||
                    0,
                },
                label: `One-Time (30 count)`,
              });
            }

            if (standupPrice.count60) {
              plans.push({
                planType: "oneTime",
                planKey: "oneTime",
                capsuleCount: standupPrice.count60.capsuleCount || 60,
                price: {
                  currency: standupPrice.count60.currency || currency,
                  amount: standupPrice.count60.amount || 0,
                  discountedPrice: standupPrice.count60.discountedPrice,
                  taxRate: standupPrice.count60.taxRate || taxRate,
                  totalAmount:
                    standupPrice.count60.discountedPrice ||
                    standupPrice.count60.amount ||
                    0,
                },
                label: `One-Time (60 count)`,
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
                  p.capsuleCount === selectedPlan.capsuleCount)
            ) || plans[0]
          : plans[0];

        if (planToUse) {
          const itemQuantity = cartItem.quantity;
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
      oneTime30: 0,
      oneTime60: 0,
      thirtyDays: 0,
      sixtyDays: 0,
      ninetyDays: 0,
      oneEightyDays: 0,
    };

    // Process each product to merge sachetPrices
    for (const product of products) {
      const cartItem = cart.items.find(
        (item: any) => item.productId.toString() === product._id.toString()
      );
      if (!cartItem) continue;

      const quantity = cartItem.quantity;
      const variant = product.variant as ProductVariant;

      if (variant === ProductVariant.SACHETS && product.sachetPrices) {
        const sachetPrices = product.sachetPrices as any;

        // Merge oneTime prices
        if (sachetPrices.oneTime) {
          if (sachetPrices.oneTime.count30) {
            if (!mergedSachetPrices.oneTime) {
              mergedSachetPrices.oneTime = {};
            }
            if (!mergedSachetPrices.oneTime.count30) {
              mergedSachetPrices.oneTime.count30 = {
                currency: sachetPrices.oneTime.count30.currency || currency,
                amount: 0,
                discountedPrice: 0,
                taxRate: sachetPrices.oneTime.count30.taxRate || taxRate,
                capsuleCount: 0,
              };
            }
            const price =
              sachetPrices.oneTime.count30.discountedPrice ||
              sachetPrices.oneTime.count30.amount ||
              0;
            mergedSachetPrices.oneTime.count30.amount += price * quantity;
            if (
              sachetPrices.oneTime.count30.discountedPrice &&
              mergedSachetPrices.oneTime.count30.discountedPrice !== undefined
            ) {
              mergedSachetPrices.oneTime.count30.discountedPrice =
                (mergedSachetPrices.oneTime.count30.discountedPrice || 0) +
                sachetPrices.oneTime.count30.discountedPrice * quantity;
            }
            const capsules =
              (sachetPrices.oneTime.count30.capsuleCount || 30) * quantity;
            mergedSachetPrices.oneTime.count30.capsuleCount += capsules;
            totalCapsules.oneTime30 += capsules;
          }

          if (sachetPrices.oneTime.count60) {
            if (!mergedSachetPrices.oneTime) {
              mergedSachetPrices.oneTime = {};
            }
            if (!mergedSachetPrices.oneTime.count60) {
              mergedSachetPrices.oneTime.count60 = {
                currency: sachetPrices.oneTime.count60.currency || currency,
                amount: 0,
                discountedPrice: 0,
                taxRate: sachetPrices.oneTime.count60.taxRate || taxRate,
                capsuleCount: 0,
              };
            }
            const price =
              sachetPrices.oneTime.count60.discountedPrice ||
              sachetPrices.oneTime.count60.amount ||
              0;
            mergedSachetPrices.oneTime.count60.amount += price * quantity;
            if (
              sachetPrices.oneTime.count60.discountedPrice &&
              mergedSachetPrices.oneTime.count60.discountedPrice !== undefined
            ) {
              mergedSachetPrices.oneTime.count60.discountedPrice =
                (mergedSachetPrices.oneTime.count60.discountedPrice || 0) +
                sachetPrices.oneTime.count60.discountedPrice * quantity;
            }
            const capsules =
              (sachetPrices.oneTime.count60.capsuleCount || 60) * quantity;
            mergedSachetPrices.oneTime.count60.capsuleCount += capsules;
            totalCapsules.oneTime60 += capsules;
          }
        }

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

    if (mergedSachetPrices.oneTime) {
      if (mergedSachetPrices.oneTime.count30) {
        mergedSachetPrices.oneTime.count30.amount = roundPrice(
          mergedSachetPrices.oneTime.count30.amount
        );
        if (mergedSachetPrices.oneTime.count30.discountedPrice) {
          mergedSachetPrices.oneTime.count30.discountedPrice = roundPrice(
            mergedSachetPrices.oneTime.count30.discountedPrice
          );
        }
      }
      if (mergedSachetPrices.oneTime.count60) {
        mergedSachetPrices.oneTime.count60.amount = roundPrice(
          mergedSachetPrices.oneTime.count60.amount
        );
        if (mergedSachetPrices.oneTime.count60.discountedPrice) {
          mergedSachetPrices.oneTime.count60.discountedPrice = roundPrice(
            mergedSachetPrices.oneTime.count60.discountedPrice
          );
        }
      }
    }

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
      }
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
    payload: PlanSelectionRequest
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
      // One-time plans only support sachets or stand-up pouches
      if (!supplementsCount) {
        throw new AppError(
          "Supplements count is required for one-time purchases",
          400
        );
      }
      planKey = "oneTime";
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
          (p) => p.planType === "subscription" && p.planKey === planKey
        );
      } else {
        // One-time: match by capsule count where applicable
        matchingPlan = product.plans.find((p) => {
          if (p.planType !== "oneTime" || p.planKey !== "oneTime") {
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
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      }).lean();

      const cartItem = cart?.items?.find(
        (item: any) => item.productId.toString() === product.productId
      );

      const quantity = cartItem?.quantity || 1;

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
          (originalAmount - discountedAmount) * quantity
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
          userId
        );

        if (memberPriceResult.isMember) {
          memberUnitPrice = {
            currency: memberPriceResult.memberPrice.currency,
            amount: memberPriceResult.memberPrice.amount,
            taxRate: memberPriceResult.memberPrice.taxRate,
          };
          membershipDiscountAmount = this.roundAmount(
            memberPriceResult.discountAmount * quantity
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
      subtotal - ninetyDayPlanDiscountTotal - discountPrice + tax + shippingFees
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
  }: {
    couponCode: string;
    userId: string;
    orderAmount: number;
    productIds: string[];
    categoryIds: string[];
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
    }
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
            userId
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
              memberPriceResult.discountAmount * product.quantity
            );
            membershipDiscountPercentage = memberPriceResult.discountPercentage;
          }

          // Recalculate line totals with member price if applicable
          const lineSubtotal = memberUnitPrice
            ? memberUnitPrice.amount * product.quantity
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
        })
      );

      // Calculate total membership discount
      const membershipDiscountTotal = productsWithMembership.reduce(
        (sum, product) => sum + (product.membershipDiscountAmount || 0),
        0
      );

      // Calculate subtotal after membership discount
      const subtotalAfterMembership = productsWithMembership.reduce(
        (sum, product) => sum + product.lineSubtotal,
        0
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
            .map((c) => c.toString())
        )
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
          shippingFees
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
      400
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
      capsuleCount?: 30 | 60; // For one-time purchases
      couponCode?: string;
    }
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
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    }).lean();

    if (!cart || !cart.items || cart.items.length === 0) {
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

    const currency = "EUR";
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
        (item: any) => item.productId.toString() === product._id.toString()
      );

      if (!cartItem) continue;

      const quantity = cartItem.quantity;
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
          // One-time sachet purchase
          if (sachetPrices.oneTime) {
            const oneTimePrice =
              capsuleCount === 60
                ? sachetPrices.oneTime.count60
                : sachetPrices.oneTime.count30;
            if (oneTimePrice) {
              mrpPerUnit = oneTimePrice.amount || 0;
              planPricePerUnit = oneTimePrice.discountedPrice || mrpPerUnit;
            }
          }
        }
      } else if (
        planType === "STANDUP_POUCH" &&
        product.hasStandupPouch &&
        product.standupPouchPrice
      ) {
        // Standup pouch pricing (one-time only)
        const standupPrice = product.standupPouchPrice as any;
        if (standupPrice.count30 || standupPrice.count60) {
          const selectedPrice =
            capsuleCount === 60 ? standupPrice.count60 : standupPrice.count30;
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
        userId
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
      (sum, item) => sum + item.finalPrice * item.quantity,
      0
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
              .map((c) => c.toString())
          )
        );

        const couponResult = await this.validateCouponForSummary({
          couponCode,
          userId,
          orderAmount: subtotal,
          productIds: productIds.map((id) => id.toString()),
          categoryIds,
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
      subtotal - couponDiscountTotal + tax + shipping
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
    capsuleCount?: number
  ): string {
    if (planType === "STANDUP_POUCH") {
      return `Stand-up Pouch (${capsuleCount || 30} count)`;
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
      planDurationDays?: 30 | 60 | 90 | 180;
      variantType?: "SACHETS" | "STAND_UP_POUCH";
      capsuleCount?: 30 | 60;
      couponCode?: string;
      isOneTime?: boolean; // true for one-time purchase, false/undefined for subscription
    } = {}
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
      };
      subscriptionPlans: Array<{
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
      }>;
      pricing: {
        subTotal: number;
        discountedPrice: number;
        couponDiscountAmount: number;
        membershipDiscountAmount: number;
        subscriptionPlanDiscountAmount: number;
        taxAmount: number;
        grandTotal: number;
        currency: string;
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
    // Default to 180-day plan and SACHETS variant
    const selectedPlanDays = options.planDurationDays || 180;
    const selectedVariant = options.variantType || "SACHETS";
    const selectedCapsuleCount = options.capsuleCount || 60; // Default to 60 for standup pouch
    const isOneTimePurchase = options.isOneTime || false; // Default to subscription

    // Get user's cart
    const cart = await Carts.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    }).lean();

    if (!cart || !cart.items || cart.items.length === 0) {
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

    const currency = "EUR";

    // Determine plan key based on selected plan duration
    const planKey = this.getPlanKey(selectedPlanDays, true); // true for subscription

    // Build cart items with selected plan price and membership discount
    const cartItemsPromises = cart.items.map(async (item: any) => {
      const product = products.find(
        (p) => p._id.toString() === item.productId.toString()
      );

      if (!product) return null;

      const productTitle =
        typeof product.title === "string"
          ? product.title
          : product.title?.en || product.title?.nl || "Product";

      // Get selected plan price based on variant and plan duration
      let basePlanPrice = {
        currency,
        amount: 0,
        discountedPrice: 0,
        planType: `${selectedPlanDays} Day Plan`,
      };

      if (selectedVariant === "SACHETS" && product.sachetPrices) {
        const sachetPrices = product.sachetPrices as any;
        const selectedPlanData = sachetPrices[planKey];

        if (selectedPlanData) {
          let discountedPrice =
            selectedPlanData.discountedPrice || selectedPlanData.amount || 0;

          // Apply 90-day bonus discount (15% extra)
          if (selectedPlanDays === 90) {
            const originalAmount = selectedPlanData.amount || 0;
            discountedPrice = originalAmount * 0.85; // 15% discount
          }

          basePlanPrice = {
            currency: selectedPlanData.currency || currency,
            amount: selectedPlanData.amount || 0,
            discountedPrice,
            planType: `${selectedPlanDays} Day Plan`,
          };
        }
      } else if (
        selectedVariant === "STAND_UP_POUCH" &&
        product.hasStandupPouch &&
        product.standupPouchPrice
      ) {
        const standupPrice = product.standupPouchPrice as any;

        // Check if count30 or count60 pricing exists
        if (standupPrice.count30 || standupPrice.count60) {
          const selectedCountPrice =
            selectedCapsuleCount === 60
              ? standupPrice.count60
              : standupPrice.count30;

          if (selectedCountPrice) {
            basePlanPrice = {
              currency: selectedCountPrice.currency || currency,
              amount: selectedCountPrice.amount || 0,
              discountedPrice:
                selectedCountPrice.discountedPrice ||
                selectedCountPrice.amount ||
                0,
              planType: `Stand-up Pouch (${selectedCapsuleCount} count)`,
            };
          }
        } else {
          // Fallback to simple price object
          basePlanPrice = {
            currency: standupPrice.currency || currency,
            amount: standupPrice.amount || 0,
            discountedPrice:
              standupPrice.discountedPrice || standupPrice.amount || 0,
            planType: "Stand-up Pouch",
          };
        }
      }

      // Calculate membership discount for this product
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
        userId
      );

      const membershipDiscount = memberPriceResult.isMember
        ? memberPriceResult.discountAmount * item.quantity
        : 0;

      return {
        productId: product._id.toString(),
        title: productTitle,
        image: product.productImage || "",
        variant: product.variant || "SACHETS",
        quantity: item.quantity,
        basePlanPrice,
        membershipDiscount: this.roundAmount(membershipDiscount),
      };
    });

    const cartItems = (await Promise.all(cartItemsPromises)).filter(
      (item) => item !== null
    );

    // Calculate total membership discount
    const membershipDiscountTotal = cartItems.reduce(
      (sum, item: any) => sum + item.membershipDiscount,
      0
    );

    // Build subscription plans listing based on selected variant
    const subscriptionPlansMap = new Map<
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

    // Only build plans for SACHETS variant
    if (selectedVariant === "SACHETS") {
      for (const product of products) {
        if (product.sachetPrices) {
          const sachetPrices = product.sachetPrices as any;
          const cartItem = cart.items.find(
            (item: any) => item.productId.toString() === product._id.toString()
          );
          const quantity = cartItem?.quantity || 1;

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

          // Add oneTime plans if available
          if (sachetPrices.oneTime) {
            const oneTimeData = sachetPrices.oneTime;
            if (oneTimeData.count30) {
              plans.push({
                key: "oneTime30",
                label: "One-Time (30 count)",
                days: 30,
                isSubscription: false,
              });
            }
            if (oneTimeData.count60) {
              plans.push({
                key: "oneTime60",
                label: "One-Time (60 count)",
                days: 60,
                isSubscription: false,
              });
            }
          }

          for (const planInfo of plans) {
            let planData: any = null;

            // Handle oneTime plans differently
            if (planInfo.key.startsWith("oneTime")) {
              const oneTimeData = sachetPrices.oneTime;
              if (planInfo.key === "oneTime30" && oneTimeData?.count30) {
                planData = oneTimeData.count30;
              } else if (planInfo.key === "oneTime60" && oneTimeData?.count60) {
                planData = oneTimeData.count60;
              }
            } else {
              planData = sachetPrices[planInfo.key];
            }

            if (planData) {
              const existing = subscriptionPlansMap.get(planInfo.key);

              let planPrice = planData.totalAmount || planData.amount || 0;
              let discountedPrice = planData.discountedPrice || planPrice;

              // Apply 90-day bonus discount only for subscription plans
              if (planInfo.isSubscription && planInfo.days === 90) {
                discountedPrice = planPrice * 0.85; // 15% discount
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
                  planData.features.forEach((f: string) =>
                    existing.features.add(f)
                  );
                }
              } else {
                const featuresSet = new Set<string>();
                if (planData.features && Array.isArray(planData.features)) {
                  planData.features.forEach((f: string) => featuresSet.add(f));
                }

                subscriptionPlansMap.set(planInfo.key, {
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
    } else if (selectedVariant === "STAND_UP_POUCH") {
      // For STAND_UP_POUCH, create plans from standupPouchPrice
      const standupPouchPlans = [
        { key: "count30", label: "30 Count", count: 30 },
        { key: "count60", label: "60 Count", count: 60 },
      ];

      for (const product of products) {
        if (product.hasStandupPouch && product.standupPouchPrice) {
          const standupPrice = product.standupPouchPrice as any;
          const cartItem = cart.items.find(
            (item: any) => item.productId.toString() === product._id.toString()
          );
          const quantity = cartItem?.quantity || 1;

          for (const planInfo of standupPouchPlans) {
            const planData = standupPrice[planInfo.key];
            if (planData) {
              const existing = subscriptionPlansMap.get(planInfo.key);

              const planPrice = planData.amount || 0;
              const discountedPrice = planData.discountedPrice || planPrice;
              const capsuleCount = planInfo.count * quantity;
              const totalAmount = planPrice * quantity;
              const totalDiscountedPrice = discountedPrice * quantity;

              if (existing) {
                existing.totalAmount += totalAmount;
                existing.discountedPrice += totalDiscountedPrice;
                existing.capsuleCount += capsuleCount;
                existing.supplementsCount += capsuleCount;
              } else {
                subscriptionPlansMap.set(planInfo.key, {
                  planKey: planInfo.key,
                  label: planInfo.label,
                  durationDays: 0, // Not applicable for stand-up pouch
                  totalAmount,
                  discountedPrice: totalDiscountedPrice,
                  capsuleCount,
                  supplementsCount: capsuleCount,
                  features: new Set<string>(),
                  isSubscription: false, // Stand-up pouch is one-time purchase
                });
              }
            }
          }
        }
      }
    }

    // Convert subscription plans to array with calculated fields
    const subscriptionPlans = Array.from(subscriptionPlansMap.values()).map(
      (plan) => {
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

        // Calculate per delivery amount (this is the total amount for the plan duration)
        // For subscription plans, this is what user pays every delivery cycle
        // 30 days = pay every 1 month, 60 days = every 2 months, etc.
        const perDeliveryAmount = this.roundAmount(plan.discountedPrice);

        // Determine if this plan is selected
        let isSelected = false;
        if (selectedVariant === "SACHETS") {
          // For SACHETS, check if durationDays matches AND subscription type matches
          if (isOneTimePurchase) {
            // OneTime plan selected: match by days and isSubscription=false
            isSelected =
              plan.durationDays === selectedPlanDays && !plan.isSubscription;
          } else {
            // Subscription plan selected: match by days and isSubscription=true
            isSelected =
              plan.durationDays === selectedPlanDays && plan.isSubscription;
          }
        } else if (selectedVariant === "STAND_UP_POUCH") {
          // For STAND_UP_POUCH, check if capsuleCount matches
          const planCapsuleCount =
            plan.planKey === "count30"
              ? 30
              : plan.planKey === "count60"
              ? 60
              : 0;
          isSelected = planCapsuleCount === selectedCapsuleCount;
        }

        return {
          planKey: plan.planKey,
          label: plan.label,
          durationDays: plan.durationDays,
          capsuleCount: plan.capsuleCount,
          totalAmount: this.roundAmount(plan.totalAmount),
          discountedPrice: this.roundAmount(plan.discountedPrice),
          savePercentage,
          supplementsCount: plan.supplementsCount,
          perMonthAmount,
          perDeliveryAmount, // Amount to pay per delivery cycle
          features: Array.from(plan.features),
          isRecommended: plan.planKey === "ninetyDays", // 90-day is recommended
          isSelected, // Mark if this plan is currently selected
          isSubscription: plan.isSubscription, // Mark if this is a subscription or one-time plan
        };
      }
    );

    // Sort plans by duration
    subscriptionPlans.sort((a, b) => a.durationDays - b.durationDays);

    // Calculate overall pricing based on selected plan
    const selectedPlan = isOneTimePurchase
      ? subscriptionPlans.find(
          (p) => p.durationDays === selectedPlanDays && !p.isSubscription
        ) ||
        subscriptionPlans.find((p) => p.planKey === "oneTime60") ||
        subscriptionPlans[0]
      : subscriptionPlans.find(
          (p) => p.durationDays === selectedPlanDays && p.isSubscription
        ) ||
        subscriptionPlans.find((p) => p.planKey === "oneEightyDays") ||
        subscriptionPlans[0];

    const subtotal = selectedPlan ? selectedPlan.totalAmount : 0;
    const totalDiscountedPrice = selectedPlan
      ? selectedPlan.discountedPrice
      : 0;
    const savePercentage = selectedPlan ? selectedPlan.savePercentage : 0;

    // Calculate plan discount (difference between subtotal and discounted price)
    const planDiscount = this.roundAmount(subtotal - totalDiscountedPrice);

    // Calculate plan discount percentage
    const planDiscountPercentage = selectedPlanDays === 90 ? 15 : 0;

    // Calculate subtotal after plan discount and membership discount
    const subtotalAfterDiscounts = this.roundAmount(
      totalDiscountedPrice - membershipDiscountTotal
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

    if (options.couponCode && options.couponCode.trim()) {
      try {
        // Get product IDs and category IDs for coupon validation
        const productIdsArray = products.map((p) => p._id.toString());
        const categoryIdsArray = products
          .map((p) => (p as any).category?.toString())
          .filter((c) => c) as string[];

        const couponResult = await this.validateCouponForSummary({
          couponCode: options.couponCode,
          userId,
          orderAmount: subtotalAfterDiscounts,
          productIds: productIdsArray,
          categoryIds: categoryIdsArray,
        });

        couponDiscountAmount = couponResult.discountAmount;
        couponInfo = {
          code: options.couponCode.toUpperCase(),
          isValid: true,
          discountAmount: this.roundAmount(couponDiscountAmount),
          message: "Coupon applied successfully",
        };
      } catch (error: any) {
        // Coupon validation failed, but don't throw error
        couponInfo = {
          code: options.couponCode.toUpperCase(),
          isValid: false,
          discountAmount: 0,
          message: error.message || "Invalid coupon code",
        };
        logger.warn(
          `Coupon validation failed for ${options.couponCode}: ${error.message}`
        );
      }
    }

    // Calculate subtotal after coupon
    const subtotalAfterCoupon = this.roundAmount(
      subtotalAfterDiscounts - couponDiscountAmount
    );

    // Calculate tax (21% VAT for Netherlands/EU)
    const taxRate = 0.21; // 21% VAT
    const taxAmount = this.roundAmount(subtotalAfterCoupon * taxRate);

    // Calculate grand total (subtotal after all discounts + tax)
    const grandTotal = this.roundAmount(subtotalAfterCoupon + taxAmount);

    // Calculate total discount amount (plan discount + membership discount + coupon discount)
    const totalDiscountAmount = this.roundAmount(
      planDiscount + membershipDiscountTotal + couponDiscountAmount
    );

    // Get suggested products (3-5 products not in cart)
    const suggestedProducts = await this.getSuggestedProductsForCheckout(
      userId,
      productIds,
      3,
      5
    );

    const result: any = {
      success: true,
      data: {
        cart: {
          items: cartItems as any,
        },
        subscriptionPlans,
        pricing: {
          subTotal: this.roundAmount(subtotal),
          discountedPrice: this.roundAmount(totalDiscountedPrice),
          couponDiscountAmount: this.roundAmount(couponDiscountAmount),
          membershipDiscountAmount: this.roundAmount(membershipDiscountTotal),
          subscriptionPlanDiscountAmount: this.roundAmount(planDiscount),
          taxAmount: this.roundAmount(taxAmount),
          grandTotal: this.roundAmount(grandTotal),
          currency,
        },
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
    maxCount: number = 5
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

    return suggestedProductDocs.map((product) => {
      const productTitle =
        typeof product.title === "string"
          ? product.title
          : (product.title as any)?.en ||
            (product.title as any)?.nl ||
            "Product";

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
