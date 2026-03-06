import mongoose from "mongoose";
import { Subscriptions } from "@/models/commerce/subscriptions.model";
import { Carts } from "@/models/commerce/carts.model";
import { SubscriptionChanges } from "@/models/commerce/subscriptionChanges.model";
import { AppError } from "@/utils/AppError";
import { SubscriptionStatus } from "@/models/enums";
import { Products } from "@/models/commerce/products.model";

export class SubscriptionUpdateService {
  /**
   * Start subscription update flow: reuse or create a cart and mark it as SUBSCRIPTION_UPDATE.
   */
  async startUpdateFlow(userId: string, subscriptionId: string) {
    const subscription = await Subscriptions.findOne({
      _id: new mongoose.Types.ObjectId(subscriptionId),
      userId: new mongoose.Types.ObjectId(userId),
      status: SubscriptionStatus.ACTIVE,
      isDeleted: false,
    }).lean();

    if (!subscription) {
      throw new AppError("Active subscription not found", 404);
    }

    let cart = await Carts.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!cart) {
      cart = await Carts.create({
        userId: new mongoose.Types.ObjectId(userId),
        items: [],
      });
    }

    cart.cartType = "SUBSCRIPTION_UPDATE";
    cart.linkedSubscriptionId = subscription._id as mongoose.Types.ObjectId;

    await cart.save();

    return {
      cartId: cart._id,
      nextBillingDate: subscription.nextBillingDate,
    };
  }

  /**
   * Build a simple summary for a subscription update cart.
   */
  async getUpdateCartSummary(userId: string, cartId: string) {
    const cart = await Carts.findOne({
      _id: new mongoose.Types.ObjectId(cartId),
      userId: new mongoose.Types.ObjectId(userId),
      cartType: "SUBSCRIPTION_UPDATE",
      isDeleted: false,
    }).lean();

    if (!cart) {
      throw new AppError("Subscription update cart not found", 404);
    }

    // Calculate basic totals from cart items
    let subtotal = 0;
    let tax = 0;
    let total = 0;

    (cart.items || []).forEach((item: any) => {
      const qty = item.quantity || 1;
      const unit = item.price?.amount || 0;
      const unitTax = item.price?.taxRate || 0;
      subtotal += unit * qty;
      tax += unitTax * qty;
    });

    total = subtotal + tax;

    return {
      cart,
      totals: {
        subtotal,
        tax,
        total,
        currency: cart.currency || "EUR",
      },
    };
  }

  /**
   * Confirm subscription update: snapshot cart and create SubscriptionChanges record.
   */
  async confirmUpdate(
    userId: string,
    subscriptionId: string,
    cartId: string
  ) {
    const subscription = await Subscriptions.findOne({
      _id: new mongoose.Types.ObjectId(subscriptionId),
      userId: new mongoose.Types.ObjectId(userId),
      status: SubscriptionStatus.ACTIVE,
      isDeleted: false,
    }).lean();

    if (!subscription) {
      throw new AppError("Active subscription not found", 404);
    }

    const cart = await Carts.findOne({
      _id: new mongoose.Types.ObjectId(cartId),
      userId: new mongoose.Types.ObjectId(userId),
      cartType: "SUBSCRIPTION_UPDATE",
      linkedSubscriptionId: subscription._id,
      isDeleted: false,
    }).lean();

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new AppError("Subscription update cart is empty", 400);
    }

    const productIds = cart.items.map((i: any) => i.productId);
    const products = await Products.find({
      _id: { $in: productIds },
      isDeleted: false,
    })
      .select("_id title name")
      .lean();

    const productMap = new Map(
      products.map((p: any) => [p._id.toString(), p])
    );

    const newPlanSnapshot = cart.items.map((item: any) => {
      const p = productMap.get(item.productId.toString());
      const name = p?.title || p?.name || "";
      const qty = item.quantity || 1;
      const price = item.price?.amount || 0;

      return {
        productId: item.productId as mongoose.Types.ObjectId,
        name,
        price,
        quantity: qty,
      };
    });

    const change = await SubscriptionChanges.create({
      subscriptionId: subscription._id,
      userId: subscription.userId,
      type: "UPDATE_PLAN",
      newPlanSnapshot,
      effectiveDate: subscription.nextBillingDate,
      status: "PENDING",
    });

    return change;
  }
}

export const subscriptionUpdateService = new SubscriptionUpdateService();


