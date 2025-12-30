import { Router } from "express";
import { generalSettingsController } from "@/controllers/generalSettingsController";

const router = Router();

/**
 * @route GET /api/v1/general-settings
 * @desc Get general settings (creates default if not exists)
 * @access Public
 */
router.get("/", generalSettingsController.getGeneralSettings); 

export default router;
