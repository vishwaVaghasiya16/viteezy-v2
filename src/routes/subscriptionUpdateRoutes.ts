import { Router } from "express";
import { authMiddleware } from "@/middleware/auth";
import { subscriptionUpdateController } from "@/controllers/subscriptionUpdateController";

const router = Router();

// All subscription update routes require authentication
router.use(authMiddleware);

// 3️⃣ Checkout summary
// GET /subscription-update-cart/summary
router.get(
  "/summary",
  subscriptionUpdateController.getSubscriptionUpdateSummary
);

// 4️⃣ Confirm subscription update
// POST /subscriptions/:id/update/confirm
router.post(
  "/:id/update/confirm",
  subscriptionUpdateController.confirmUpdate
);

// 5️⃣ Update subscription products
// POST /subscriptions/:id/update/products
router.post(
  "/:subscriptionId/update/products",
  subscriptionUpdateController.updateSubscriptionProducts
);

export default router;
