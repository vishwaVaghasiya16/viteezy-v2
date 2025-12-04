import { Router } from "express";
import { landingPageController } from "../controllers/landingPageController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Public route - Get active landing page
router.get("/", landingPageController.getActiveLandingPage);

export default router;

