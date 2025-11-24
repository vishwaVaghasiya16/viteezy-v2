import { Router } from "express";
import authRoutes from "./authRoutes";
import userRoutes from "./userRoutes";
import adminUserRoutes from "./adminUserRoutes";
import exampleRoutes from "./exampleRoutes";
import paymentRoutes from "./paymentRoutes";
import blogRoutes from "./blogRoutes";
import addressRoutes from "./addressRoutes";
import faqRoutes from "./faqRoutes";
import wishlistRoutes from "./wishlistRoutes";
import orderRoutes from "./orderRoutes";
import couponRoutes from "./couponRoutes";
import deliveryPostponementRoutes from "./deliveryPostponementRoutes";
import preCheckoutRoutes from "./preCheckoutRoutes";
import savedCardRoutes from "./savedCardRoutes";
import subscriptionRoutes from "./subscriptionRoutes";

const router = Router();

// API Routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin/users", adminUserRoutes);
router.use("/examples", exampleRoutes);
router.use("/payments", paymentRoutes);
router.use("/blogs", blogRoutes);
router.use("/faqs", faqRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/addresses", addressRoutes);
router.use("/orders", orderRoutes);
router.use("/coupons", couponRoutes);
router.use("/postponements", deliveryPostponementRoutes);
router.use("/pre-checkout", preCheckoutRoutes);
router.use("/saved-cards", savedCardRoutes);
router.use("/subscriptions", subscriptionRoutes);

export default router;
