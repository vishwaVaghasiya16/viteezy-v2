import { Products } from "../models/commerce/products.model";
import { Carts } from "../models/commerce/carts.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import mongoose from "mongoose";
import { ProductVariant } from "../models/enums";

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

interface PurchasePlansResponse {
  products: ProductPurchasePlans[];
  totals: {
    subtotal: { currency: string; amount: number; taxRate: number };
    tax: { currency: string; amount: number; taxRate: number };
    discount: { currency: string; amount: number; taxRate: number };
    total: { currency: string; amount: number; taxRate: number };
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
    const totalAmount = totalSubtotal + totalTax - totalDiscount;

    return {
      products: productPurchasePlans,
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
}

export const checkoutService = new CheckoutService();
