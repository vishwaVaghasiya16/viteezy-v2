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
      // optional shippingAddressId from body
      const { shippingAddressId } = req.body;
      const result =
        await subscriptionUpdateService.getSubscriptionUpdateSummary(
          userId,
          language,
          shippingAddressId
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
          subscriptionChangeId: change._id,
          status: change.status,
          effectiveDate: change.effectiveDate
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
}

export const subscriptionUpdateController = new SubscriptionUpdateController();


