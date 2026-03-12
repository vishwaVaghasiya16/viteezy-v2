import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { subscriptionUpdateService } from "@/services/subscription/subscriptionUpdateService";
import { Carts } from "@/models/commerce/carts.model";
import { Subscriptions } from "@/models/commerce";
import mongoose from "mongoose";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

class SubscriptionUpdateController {
  /**
   * 3️⃣ Checkout summary
   * GET /subscription-update-cart/:cartId/summary
   */
  getSubscriptionUpdateSummary = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?.id || req.userId;
      if (!userId)
        throw new AppError("User not authenticated", 401);
      const language = req.user?.language || "en";
      const { shippingAddressId } = req.body || {};
      const couponCode = (req.body?.couponCode as string | undefined)?.trim();
      const result =
        await subscriptionUpdateService.getSubscriptionUpdateSummary(
          userId,
          language,
          shippingAddressId,
          couponCode
        );
      res.apiSuccess(result, "Subscription cart summary fetched");
    }
  );

  /**
   * 4️⃣ Confirm subscription update
   * POST /subscriptions/:id/update/confirm
   */
  confirmUpdate = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
  
      const userId = req.user?.id || req.userId;
      if (!userId)
        throw new AppError("User not authenticated", 401);
  
      const { id: subscriptionId } = req.params;
      const { cartId } = req.body;
  
      if (!cartId)
        throw new AppError("cartId is required", 400);
  
      const change =
        await subscriptionUpdateService.confirmUpdate(
          userId,
          subscriptionId,
          cartId
        );
  
      res.apiSuccess(
        {
          subscriptionChangeId: (change as any).subscriptionChangeId || (change as any)._id,
          status: change.status,
          effectiveDate: change.effectiveDate,
          ...(change as any).renewalOrderId ? { renewalOrderId: (change as any).renewalOrderId } : {},
          ...(change as any).orderNumber ? { orderNumber: (change as any).orderNumber } : {},
        },
        "Subscription update scheduled for next billing cycle"
      );
  
    }
  );

  updateSubscriptionProducts = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
  
      const userId = req.user?.id || req.userId;
      if (!userId)
        throw new AppError("User not authenticated", 401);
  
      const { subscriptionId } = req.params;
      const { productIds } = req.body;
  
      if (!Array.isArray(productIds))
        throw new AppError("productIds must be array", 400);
  
      const result =
        await subscriptionUpdateService.updateSubscriptionProducts(
          userId,
          subscriptionId,
          productIds
        );
  
      res.apiSuccess(result, "Subscription cart updated");
    }
  );

  removeSubscriptionProduct = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?.id || req.userId;
      if (!userId) throw new AppError("User not authenticated", 401);
      const { subscriptionId } = req.params;
      const { productId } = req.body || {};
      if (!productId || typeof productId !== "string") {
        throw new AppError("productId is required", 400);
      }
      const result = await subscriptionUpdateService.removeSubscriptionProduct(
        userId,
        subscriptionId,
        productId
      );
      res.apiSuccess(result, "Product removed from subscription update cart");
    }
  );
}

export const subscriptionUpdateController = new SubscriptionUpdateController();
