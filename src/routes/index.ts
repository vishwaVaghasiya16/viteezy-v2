import { Router } from "express";
import authRoutes from "./authRoutes";
import userRoutes from "./userRoutes";
import exampleRoutes from "./exampleRoutes";
import paymentRoutes from "./paymentRoutes";

const router = Router();

// API Routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/examples", exampleRoutes);
router.use("/payments", paymentRoutes);

export default router;
