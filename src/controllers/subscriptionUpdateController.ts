import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { subscriptionUpdateService } from "@/services/subscription/subscriptionUpdateService";
import { Carts } from "@/models/commerce/carts.model";
import { cartService } from "@/services/cartService";
import { ProductVariant } from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

class SubscriptionUpdateController {
  /**
   * 1️⃣ Start subscription update flow
   * POST /subscriptions/:id/update/start
   */
  startUpdateFlow = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { id: subscriptionId } = req.params;
      const result = await subscriptionUpdateService.startUpdateFlow(
        userId,
        subscriptionId
      );

      res.apiSuccess(
        {
          cartId: result.cartId,
          nextBillingDate: result.nextBillingDate,
        },
        "Subscription update flow started"
      );
    }
  );

  /**
   * 2️⃣ Manage update cart items - ADD
   * POST /subscription-update-cart/:cartId/items
   * Uses existing cartService.addItem under the hood.
   */
  addUpdateCartItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { cartId } = req.params;

      const cart = await Carts.findOne({
        _id: cartId,
        userId,
        cartType: "SUBSCRIPTION_UPDATE",
        isDeleted: false,
      }).lean();

      if (!cart) {
        throw new AppError("Subscription update cart not found", 404);
      }

      const { productId, variantType, quantity, isOneTime, planDays } = req.body;

      if (!productId || !variantType) {
        throw new AppError("productId and variantType are required", 400);
      }

      const result = await cartService.addItem(userId, {
        productId,
        variantType: variantType as ProductVariant,
        quantity: quantity ? Number(quantity) : undefined,
        isOneTime:
          isOneTime !== undefined ? Boolean(isOneTime) : undefined,
        planDays: planDays !== undefined ? Number(planDays) : undefined,
        isSubscriptionChange: true,
      });

      res.apiSuccess(
        {
          cart: result.cart,
        },
        "Subscription update cart item added"
      );
    }
  );

  /**
   * 2️⃣ Manage update cart items - UPDATE
   * PATCH /subscription-update-cart/:cartId/items/:itemId
   * Uses existing cartService.updateItem under the hood.
   */
  updateUpdateCartItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { cartId } = req.params;

      const cart = await Carts.findOne({
        _id: cartId,
        userId,
        cartType: "SUBSCRIPTION_UPDATE",
        isDeleted: false,
      }).lean();

      if (!cart) {
        throw new AppError("Subscription update cart not found", 404);
      }

      const { productId, variantType, quantity, isOneTime, planDays } = req.body;

      if (!productId || !variantType) {
        throw new AppError("productId and variantType are required", 400);
      }

      const result = await cartService.updateItem(userId, {
        productId,
        variantType: variantType as ProductVariant,
        quantity: quantity ? Number(quantity) : undefined,
        isOneTime:
          isOneTime !== undefined ? Boolean(isOneTime) : undefined,
        planDays: planDays !== undefined ? Number(planDays) : undefined,
        isSubscriptionChange: true,
      });

      res.apiSuccess(
        {
          cart: result.cart,
        },
        "Subscription update cart item updated"
      );
    }
  );

  /**
   * 2️⃣ Manage update cart items - DELETE
   * DELETE /subscription-update-cart/:cartId/items/:itemId
   * Uses existing cartService.removeItem under the hood.
   */
  removeUpdateCartItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { cartId, itemId } = req.params;

      const cart = await Carts.findOne({
        _id: cartId,
        userId,
        cartType: "SUBSCRIPTION_UPDATE",
        isDeleted: false,
      }).lean();

      if (!cart) {
        throw new AppError("Subscription update cart not found", 404);
      }

      const item = (cart.items || []).find(
        (i: any) => i._id.toString() === itemId
      );

      if (!item) {
        throw new AppError("Cart item not found", 404);
      }

      const result = await cartService.removeItem(userId, {
        productId: item.productId.toString(),
      });

      res.apiSuccess(
        {
          cart: result.cart,
        },
        "Subscription update cart item removed"
      );
    }
  );

  /**
   * 3️⃣ Checkout summary
   * GET /subscription-update-cart/:cartId/summary
   */
  getUpdateCartSummary = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { cartId } = req.params;

      const summary = await subscriptionUpdateService.getUpdateCartSummary(
        userId,
        cartId
      );

      res.apiSuccess(
        {
          cart: summary.cart,
          totals: summary.totals,
          message: "Changes will apply from next billing cycle",
        },
        "Subscription update cart summary"
      );
    }
  );

  /**
   * 4️⃣ Confirm subscription update
   * POST /subscriptions/:id/update/confirm
   */
  confirmUpdate = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { id: subscriptionId } = req.params;
      const { cartId } = req.body;

      if (!cartId) {
        throw new AppError("cartId is required", 400);
      }

      const change = await subscriptionUpdateService.confirmUpdate(
        userId,
        subscriptionId,
        cartId
      );

      res.apiSuccess(
        {
          subscriptionChangeId: change._id,
          status: change.status,
          effectiveDate: change.effectiveDate,
        },
        "Subscription update scheduled for next billing cycle"
      );
    }
  );

  changeSubscriptionPlan = asyncHandler(
    async (req: any, res: Response) => {
      const userId = req.userId || req.user?.id;
  
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }
  
      const { subscriptionId, items } = req.body;
  
      if (!subscriptionId) {
        throw new AppError("subscriptionId is required", 400);
      }
  
      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new AppError("Items are required", 400);
      }
  
      // STEP 1: Fetch Subscription
      const subscription = await Subscriptions.findById(subscriptionId).lean();
  
      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }
  
      if (subscription.userId.toString() !== userId.toString()) {
        throw new AppError("Unauthorized access to subscription", 403);
      }
  
      const today = new Date();
      const nextBillingDate = new Date(subscription.nextBillingDate);
  
      const diffDays =
        (nextBillingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  
      // STEP 2: Validate 10 day rule
      if (diffDays < 10) {
        throw new AppError(
          "Subscription plan can only be updated at least 10 days before next billing date",
          400
        );
      }
  
      // STEP 3: Find existing cart
      let cart = await Carts.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      });
  
      // STEP 4: Create cart if not exists
      if (!cart) {
        cart = new Carts({
          userId,
          cartType: "SUBSCRIPTION_UPDATE",
          linkedSubscriptionId: subscriptionId,
          items: [],
        });
      } else {
        // STEP 5: Update existing cart
        cart.cartType = "SUBSCRIPTION_UPDATE";
        cart.linkedSubscriptionId = new mongoose.Types.ObjectId(subscriptionId);
      }
  
      // STEP 6: Add items to cart
      for (const item of items) {
        cart.items.push({
          productId: new mongoose.Types.ObjectId(item.productId),
          variantType: item.variantType,
          quantity: item.quantity || 1,
          isOneTime: item.isOneTime ?? false,
          planDays: item.planDays ?? null,
          price: item.price,
          isSubscriptionChange: true,
          addedAt: new Date(),
        });
      }
  
      // STEP 7: Recalculate totals
      let subtotal = 0;
      let tax = 0;
      let discount = 0;
  
      for (const item of cart.items) {
        const qty = item.quantity || 1;
  
        const unitPrice = item.price?.price || 0;
        const taxRate = item.price?.taxRate || 0;
        const discountedPrice = item.price?.discountedPrice || 0;
  
        subtotal += unitPrice * qty;
  
        tax += (taxRate / 100) * unitPrice * qty;
  
        discount += discountedPrice || 0;
      }
  
      cart.subtotal = subtotal;
      cart.tax = tax;
      cart.discount = discount;
  
      cart.total =
        subtotal +
        tax +
        cart.shipping -
        discount -
        (cart.couponDiscountAmount || 0);
  
      // STEP 8: Save cart
      await cart.save();
  
      return res.apiSuccess(
        {
          cart,
        },
        "Subscription change request added to cart"
      );
    }
  );
}

export const subscriptionUpdateController = new SubscriptionUpdateController();


