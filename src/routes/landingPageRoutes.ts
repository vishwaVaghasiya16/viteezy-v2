import { Router } from "express";
import { landingPageController } from "../controllers/landingPageController";
import { optionalAuth } from "../middleware/auth";

const router = Router();

// Public route - Get active landing page (with optional authentication)
router.get("/", optionalAuth, landingPageController.getActiveLandingPage);

export default router;

