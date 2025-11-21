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

export default router;
