import { Router } from "express";
import { StateController } from "@/controllers/stateController";

const router = Router();

/**
 * Public Routes
 */

// Get all states (with optional filters: ?countryCode=US&isActive=true)
router.get("/", StateController.getAllStates);

// Get states by country code
router.get("/country/:countryCode", StateController.getStatesByCountryCode);

// Get state by code (with optional countryCode query param)
router.get("/:code", StateController.getStateByCode);

export default router;
