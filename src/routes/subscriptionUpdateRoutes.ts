import { Router } from "express";
import { authMiddleware } from "@/middleware/auth";
import { subscriptionUpdateController } from "@/controllers/subscriptionUpdateController";

const router = Router();

// All subscription update routes require authentication
router.use(authMiddleware);

// 1️⃣ Start subscription update flow
// POST /subscriptions/:id/update/start
router.post("/:id/update/start", subscriptionUpdateController.startUpdateFlow);

// 2️⃣ Manage update cart items
// POST /subscription-update-cart/:cartId/items
router.post(
  "/update-cart/:cartId/items",
  subscriptionUpdateController.addUpdateCartItem
);

// PATCH /subscription-update-cart/:cartId/items/:itemId
router.patch(
  "/subscription-update-cart/:cartId/items/:itemId",
  subscriptionUpdateController.updateUpdateCartItem
);

// DELETE /subscription-update-cart/:cartId/items/:itemId
router.delete(
  "/subscription-update-cart/:cartId/items/:itemId",
  subscriptionUpdateController.removeUpdateCartItem
);

// 3️⃣ Checkout summary
// GET /subscription-update-cart/:cartId/summary
router.get(
  "/update-cart/:cartId/summary",
  subscriptionUpdateController.getUpdateCartSummary
);

// 4️⃣ Confirm subscription update
// POST /subscriptions/:id/update/confirm
router.post(
  "/:id/update/confirm",
  subscriptionUpdateController.confirmUpdate
);

export default router;


