import { Router } from "express";
import { aboutUsController } from "@/controllers/aboutUsController";

const router = Router();

/**
 * @route GET /api/v1/about-us
 * @desc Get About Us page content (Public)
 * @access Public
 */
router.get("/", aboutUsController.getAboutUs);

export default router;
