import { Router } from "express";
import authRoutes from "./authRoutes";
import userRoutes from "./userRoutes";
import exampleRoutes from "./exampleRoutes";
import paymentRoutes from "./paymentRoutes";
import blogRoutes from "./blogRoutes";
import addressRoutes from "./addressRoutes";
import productRoutes from "./productRoutes";
import cartRoutes from "./cartRoutes";

const router = Router();

// API Routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/examples", exampleRoutes);
router.use("/payments", paymentRoutes);
router.use("/blogs", blogRoutes);
router.use("/addresses", addressRoutes);
router.use("/products", productRoutes);
router.use("/carts", cartRoutes);

export default router;
